-- B08: Teacher class report based on persisted assessment data.
-- No student answers, private rubrics, answer keys, or raw evidence.
-- Service-role-only RPC. The API must verify the teacher JWT
-- and pass the verified user ID, never a client-supplied teacher ID.

create function public.b08_teacher_class_report(
  p_teacher_uid uuid,
  p_class_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_name text;
  v_summary jsonb;
  v_students jsonb;
  v_objectives jsonb;
  v_history jsonb;
  v_total_attempts bigint;
begin
  if p_teacher_uid is null or p_class_id is null then
    raise exception 'Invalid teacher report request'
      using errcode = '22023';
  end if;

  -- Enforce teacher ownership inside the database as well.
  select c.name
  into v_class_name
  from public.classes c
  where c.id = p_class_id
    and c.teacher_uid = p_teacher_uid;

  if not found then
    raise exception 'Class not found or access denied'
      using errcode = '42501';
  end if;

  select count(*)
  into v_total_attempts
  from public.assessment_attempts a
  join public.student_sessions s
    on s.id = a.student_session_id
  where s.class_id = p_class_id;

  select jsonb_build_object(
    'total_students', (
      select count(*)
      from public.student_sessions s
      where s.class_id = p_class_id
    ),
    'active_students', (
      select count(*)
      from public.student_sessions s
      where s.class_id = p_class_id
        and s.revoked_at is null
    ),
    'published_quests', (
      select count(distinct p.quest_id)
      from public.published_quest_versions p
      where p.class_id = p_class_id
    ),
    'total_attempts', v_total_attempts,
    'pending_scoring', (
      select count(*)
      from public.assessment_attempts a
      join public.student_sessions s
        on s.id = a.student_session_id
      where s.class_id = p_class_id
        and a.status = 'pending_scoring'
    ),
    'scored_attempts', (
      select count(*)
      from public.assessment_scoring_results r
      join public.assessment_attempts a
        on a.id = r.attempt_id
        and a.status = r.outcome
      join public.student_sessions s
        on s.id = a.student_session_id
      where s.class_id = p_class_id
        and r.outcome = 'scored'
    ),
    'insufficient_evidence', (
      select count(*)
      from public.assessment_scoring_results r
      join public.assessment_attempts a
        on a.id = r.attempt_id
        and a.status = r.outcome
      join public.student_sessions s
        on s.id = a.student_session_id
      where s.class_id = p_class_id
        and r.outcome = 'insufficient_evidence'
    ),
    'quest_completion_count', null
  )
  into v_summary;

  -- Student rows, including students without assessment attempts.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'student_id', s.id,
        'display_name', s.display_name,
        'active', s.revoked_at is null,
        'attempts', (
          select count(*)
          from public.assessment_attempts a
          where a.student_session_id = s.id
        ),
        'last_score', last_score.score,
        'last_adaptive_path', last_path.next_path,
        'last_policy_version', last_path.policy_version,
        'last_policy_status', last_path.approval_status,
        'quest_completion', null
      )
      order by s.display_name, s.id
    ),
    '[]'::jsonb
  )
  into v_students
  from public.student_sessions s
  left join lateral (
    select r.score
    from public.assessment_attempts a
    join public.assessment_scoring_results r
      on r.attempt_id = a.id
      and r.outcome = a.status
    where a.student_session_id = s.id
      and r.outcome = 'scored'
    order by r.scored_at desc, r.id desc
    limit 1
  ) last_score on true
  left join lateral (
    select
      d.next_path,
      d.policy_version,
      p.approval_status
    from public.assessment_attempts a
    join public.assessment_scoring_results r
      on r.attempt_id = a.id
      and r.outcome = a.status
    join public.assessment_adaptive_decisions d
      on d.attempt_id = r.attempt_id
      and d.outcome = r.outcome
      and d.score_snapshot is not distinct from r.score
    join public.assessment_adaptive_policies p
      on p.version = d.policy_version
    where a.student_session_id = s.id
    order by d.decided_at desc, d.attempt_id desc
    limit 1
  ) last_path on true
  where s.class_id = p_class_id;

  -- Derive objective IDs from published public quest metadata.
  -- Count recorded objective results, not fabricated evidence.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'objective_id', o.objective_id,
        'statement', null,
        'scored_result_count', (
          select count(*)
          from public.assessment_attempts a
          join public.student_sessions s
            on s.id = a.student_session_id
          join public.assessment_scoring_results r
            on r.attempt_id = a.id
            and r.outcome = a.status
          cross join lateral jsonb_array_elements(
            r.objective_results
          ) x(result)
          where s.class_id = p_class_id
            and r.outcome = 'scored'
            and x.result ->> 'objective_id' = o.objective_id
        ),
        'evidence_count', null,
        'learning_status', null
      )
      order by o.objective_id
    ),
    '[]'::jsonb
  )
  into v_objectives
  from (
    select distinct x.objective_id
    from public.published_quest_versions p
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(
          p.public_payload -> 'objective_ids'
        ) = 'array'
        then p.public_payload -> 'objective_ids'
        else '[]'::jsonb
      end
    ) x(objective_id)
    where p.class_id = p_class_id
  ) o;

  -- Latest 100 assessment records, ordered newest first.
  -- Never include raw answers, private rubric, or raw evidence.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attempt_id', h.id,
        'student_id', h.student_id,
        'quest_version_id', h.quest_version_id,
        'submitted_at', h.created_at,
        'status', h.status,
        'score', h.score,
        'scored_at', h.scored_at,
        'next_path', h.next_path,
        'policy_version', h.policy_version,
        'policy_status', h.approval_status
      )
      order by h.created_at desc, h.id desc
    ),
    '[]'::jsonb
  )
  into v_history
  from (
    select
      a.id,
      s.id as student_id,
      a.quest_version_id,
      a.created_at,
      a.status,
      r.score,
      r.scored_at,
      d.next_path,
      d.policy_version,
      p.approval_status
    from public.assessment_attempts a
    join public.student_sessions s
      on s.id = a.student_session_id
    left join public.assessment_scoring_results r
      on r.attempt_id = a.id
      and r.outcome = a.status
    left join public.assessment_adaptive_decisions d
      on d.attempt_id = r.attempt_id
    left join public.assessment_adaptive_policies p
      on p.version = d.policy_version
    where s.class_id = p_class_id
    order by a.created_at desc, a.id desc
    limit 100
  ) h;

  return jsonb_build_object(
    'class_id', p_class_id,
    'class_name', v_class_name,
    'summary', v_summary,
    'students', v_students,
    'objectives', v_objectives,
    'attempt_history', v_history,
    'history_limit', 100,
    'history_truncated', v_total_attempts > 100,
    'reinforcement_groups', null,
    'intervention_history', null,
    'data_availability', jsonb_build_object(
      'quest_completion', 'not_tracked',
      'objective_learning_status', 'awaiting_scoring_contract',
      'objective_evidence_count', 'awaiting_scoring_contract',
      'reinforcement_groups', 'awaiting_objective_scoring',
      'intervention_history', 'not_implemented'
    )
  );
end;
$$;

revoke all on function public.b08_teacher_class_report(
  uuid, uuid
) from public, anon, authenticated;

grant execute on function public.b08_teacher_class_report(
  uuid, uuid
) to service_role;

comment on function public.b08_teacher_class_report(
  uuid, uuid
) is
  'Private class report for a teacher verified by the backend API.';