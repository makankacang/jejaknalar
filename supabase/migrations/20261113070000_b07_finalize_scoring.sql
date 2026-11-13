-- B07: Atomic, idempotent scoring finalization.
-- Only the trusted backend service role may execute this function.

alter table public.assessment_attempts
  drop constraint assessment_attempts_status_check;

alter table public.assessment_attempts
  add constraint b07_assessment_status_check
  check (
    status in (
      'pending_scoring',
      'scored',
      'insufficient_evidence'
    )
  );

create function public.b07_finalize_assessment_score(
  p_attempt_id uuid,
  p_rubric_version_id uuid,
  p_outcome text,
  p_score integer,
  p_objective_results jsonb,
  p_feedback jsonb,
  p_evidence jsonb,
  p_engine_version text
)
returns table (
  attempt_id uuid,
  status text,
  replayed boolean,
  result_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_existing public.assessment_scoring_results%rowtype;
  v_result_id uuid;
begin
  -- Validate finalization input.
  if p_attempt_id is null
    or p_rubric_version_id is null
    or p_outcome not in ('scored', 'insufficient_evidence')
    or p_outcome is null
    or p_engine_version is null
    or char_length(p_engine_version) not between 1 and 100
    or p_objective_results is null
    or jsonb_typeof(p_objective_results) <> 'array'
    or p_feedback is null
    or jsonb_typeof(p_feedback) <> 'array'
    or p_evidence is null
    or jsonb_typeof(p_evidence) <> 'array'
  then
    raise exception 'Invalid scoring finalization input'
      using errcode = '22023';
  end if;

  if (
    p_outcome = 'scored'
    and (
      p_score is null
      or p_score not between 0 and 100
    )
  ) or (
    p_outcome = 'insufficient_evidence'
    and p_score is not null
  ) then
    raise exception 'Score and outcome mismatch'
      using errcode = '22023';
  end if;

  -- Serialize concurrent finalization attempts.
  select a.*
  into v_attempt
  from public.assessment_attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    raise exception 'Assessment attempt not found'
      using errcode = '22023';
  end if;

  -- Already finalized: replay only when the result is identical.
  if v_attempt.status <> 'pending_scoring' then
    select r.*
    into v_existing
    from public.assessment_scoring_results r
    where r.attempt_id = p_attempt_id;

    if not found then
      raise exception 'Finalized attempt has no scoring result'
        using errcode = '23505';
    end if;

    if v_existing.rubric_version_id <> p_rubric_version_id
      or v_existing.outcome <> p_outcome
      or v_existing.score is distinct from p_score
      or v_existing.objective_results <> p_objective_results
      or v_existing.feedback <> p_feedback
      or v_existing.evidence <> p_evidence
      or v_existing.engine_version <> p_engine_version
      or v_attempt.status <> v_existing.outcome
    then
      raise exception 'Conflicting scoring finalization'
        using errcode = '23505';
    end if;

    return query
      select
        p_attempt_id,
        v_existing.outcome,
        true,
        v_existing.id;

    return;
  end if;

  -- The scoring-result trigger verifies:
  -- attempt, quest version, class, and rubric compatibility.
  insert into public.assessment_scoring_results (
    attempt_id,
    rubric_version_id,
    outcome,
    score,
    objective_results,
    feedback,
    evidence,
    engine_version
  )
  values (
    p_attempt_id,
    p_rubric_version_id,
    p_outcome,
    p_score,
    p_objective_results,
    p_feedback,
    p_evidence,
    p_engine_version
  )
  returning id into v_result_id;

  -- Executed in the same transaction as result insertion.
  update public.assessment_attempts a
  set status = p_outcome
  where a.id = p_attempt_id;

  return query
    select
      p_attempt_id,
      p_outcome,
      false,
      v_result_id;
end;
$$;

revoke all on function public.b07_finalize_assessment_score(
  uuid, uuid, text, integer, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.b07_finalize_assessment_score(
  uuid, uuid, text, integer, jsonb, jsonb, jsonb, text
) to service_role;

comment on function public.b07_finalize_assessment_score(
  uuid, uuid, text, integer, jsonb, jsonb, jsonb, text
) is
  'Atomic idempotent scoring finalization for trusted backend workers only.';