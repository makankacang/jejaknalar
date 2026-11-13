-- B07: Scoring finalization and idempotency.
-- Uses synthetic fixtures; changes are rolled back.

begin;

do $test$
declare
  v_teacher uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();

  v_quest_a text :=
    'QV-B07-A-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_quest_b text :=
    'QV-B07-B-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  v_class_code text := upper(translate(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    '01', '23'
  ));

  v_version text;
  v_quest_id text;
  v_item text;
  v_payload jsonb;

  v_rubric_a uuid;
  v_rubric_b uuid;
  v_attempt_a uuid;
  v_attempt_b uuid;
  v_returned_attempt uuid;
  v_key uuid := gen_random_uuid();
  v_result_id uuid;
  v_replayed_result uuid;
  v_status text;
  v_replayed boolean;

  v_answers jsonb :=
    '[{"item_id":"ITEM-B07-A","value":"Jawaban demo"}]'::jsonb;

  v_objectives jsonb :=
    '[{"objective_id":"LO-B07-TEST","score":75}]'::jsonb;

  v_feedback jsonb :=
    '[{"item_id":"ITEM-B07-A","message":"Jawaban dinilai"}]'::jsonb;

  v_evidence jsonb :=
    '[{"item_id":"ITEM-B07-A","criterion":"demo","earned_points":3,"max_points":4}]'::jsonb;
begin
  -- Direct client access to official scoring results is forbidden.
  if has_table_privilege(
    'anon', 'public.assessment_scoring_results', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.assessment_scoring_results', 'INSERT'
  ) then
    raise exception 'Scoring result access control failed';
  end if;

  raise notice 'B07_SCORING_ACCESS_CONTROL_PASS';

  insert into auth.users (
    instance_id, id, aud, role, email,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_teacher, 'authenticated', 'authenticated',
    'b07-score-' || v_teacher || '@example.test',
    now(), now()
  );

  insert into public.classes (
    id, teacher_uid, name, grade, class_code
  ) values (
    v_class, v_teacher, 'B07 Scoring Test',
    7, v_class_code
  );

  insert into public.student_sessions (
    id, class_id, display_name,
    access_code_hash, recovery_token_hash
  ) values (
    v_student, v_class, 'B07 Scoring Student',
    md5(v_student::text) || md5(v_teacher::text),
    md5(v_teacher::text) || md5(v_student::text)
  );

  -- Prepare two different published quest versions and rubrics.
  for v_version in
    select unnest(array[v_quest_a, v_quest_b])
  loop
    v_quest_id := replace(v_version, 'QV-', 'QUEST-');

    v_item := case
      when v_version = v_quest_a then 'ITEM-B07-A'
      else 'ITEM-B07-B'
    end;

    v_payload := jsonb_build_object(
      'schema_version', '1.0',
      'quest_id', v_quest_id,
      'quest_version_id', v_version,
      'objective_ids', jsonb_build_array('LO-B07-TEST'),
      'template', 'evidence_hunt',
      'scene_id', 'school_library',
      'steps', jsonb_build_array(
        jsonb_build_object(
          'id', 'evidence-01',
          'type', 'select_evidence',
          'item_id', v_item
        )
      ),
      'variants', jsonb_build_object(
        'needs_support', 'QVAR-S',
        'developing', 'QVAR-D',
        'ready_for_extension', 'QVAR-E'
      )
    );

    insert into public.quest_review_drafts (
      class_id, quest_id, quest_version_id,
      submitted_by, public_payload
    ) values (
      v_class, v_quest_id, v_version,
      v_teacher, v_payload
    );

    update public.quest_review_drafts
    set status = 'approved', approved_by = v_teacher
    where quest_version_id = v_version;

    insert into public.published_quest_versions (
      class_id, quest_id, quest_version_id,
      approved_by, public_payload
    ) values (
      v_class, v_quest_id, v_version,
      v_teacher, v_payload
    );

    insert into public.assessment_rubric_versions (
      quest_version_id, revision, registered_by, private_spec
    ) values (
      v_version, 1, v_teacher,
      jsonb_build_object(
        'items', jsonb_build_array(
          jsonb_build_object(
            'item_id', v_item,
            'objective_id', 'LO-B07-TEST',
            'answer_key', 'PRIVATE-DEMO-ANSWER',
            'max_points', 4
          )
        )
      )
    );
  end loop;

  select id into v_rubric_a
  from public.assessment_rubric_versions
  where quest_version_id = v_quest_a;

  select id into v_rubric_b
  from public.assessment_rubric_versions
  where quest_version_id = v_quest_b;

  -- Create a pending attempt through the existing B05 function.
  select f.attempt_id into v_attempt_a
  from public.b05_create_assessment_attempt(
    v_student, v_quest_a, v_key, v_answers
  ) f;

  -- A rubric from another quest must be rejected.
  begin
    perform public.b07_finalize_assessment_score(
      v_attempt_a, v_rubric_b,
      'scored', 75,
      v_objectives, v_feedback, v_evidence,
      'b07-test-1'
    );

    raise exception 'Wrong quest rubric was accepted';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B07_WRONG_RUBRIC_DENIED_PASS';

  -- First finalization must succeed.
  select f.status, f.replayed, f.result_id
  into v_status, v_replayed, v_result_id
  from public.b07_finalize_assessment_score(
    v_attempt_a, v_rubric_a,
    'scored', 75,
    v_objectives, v_feedback, v_evidence,
    'b07-test-1'
  ) f;

  if v_status <> 'scored'
     or v_replayed is distinct from false
     or v_result_id is null
  then
    raise exception 'Initial scoring finalization failed';
  end if;

  if not exists (
    select 1 from public.assessment_attempts
    where id = v_attempt_a and status = 'scored'
  ) then
    raise exception 'Assessment status was not updated';
  end if;

  raise notice 'B07_SCORING_FINALIZATION_PASS';

  -- Repeating the identical finalization must replay the result.
  select f.status, f.replayed, f.result_id
  into v_status, v_replayed, v_replayed_result
  from public.b07_finalize_assessment_score(
    v_attempt_a, v_rubric_a,
    'scored', 75,
    v_objectives, v_feedback, v_evidence,
    'b07-test-1'
  ) f;

  if v_replayed is distinct from true
     or v_replayed_result <> v_result_id
  then
    raise exception 'Scoring retry was not idempotent';
  end if;

  raise notice 'B07_SCORING_IDEMPOTENT_RETRY_PASS';

  -- The original B05 submission key must return the finalized attempt.
  select f.attempt_id, f.status, f.replayed
  into v_returned_attempt, v_status, v_replayed
  from public.b05_create_assessment_attempt(
    v_student, v_quest_a, v_key, v_answers
  ) f;

  if v_returned_attempt <> v_attempt_a
     or v_status <> 'scored'
     or v_replayed is distinct from true
  then
    raise exception 'B05 idempotency replay after scoring failed';
  end if;

  raise notice 'B07_B05_SUBMISSION_REPLAY_PASS';

  -- Changed scoring results must not replace official results.
  begin
    perform public.b07_finalize_assessment_score(
      v_attempt_a, v_rubric_a,
      'scored', 76,
      v_objectives, v_feedback, v_evidence,
      'b07-test-1'
    );

    raise exception 'Conflicting scoring retry succeeded';
  exception
    when unique_violation then null;
  end;

  raise notice 'B07_SCORING_CONFLICT_DENIED_PASS';

  -- Insufficient evidence must not be recorded as score zero.
  select f.attempt_id into v_attempt_b
  from public.b05_create_assessment_attempt(
    v_student, v_quest_a, gen_random_uuid(),
    v_answers
  ) f;

  select f.status, f.replayed, f.result_id
  into v_status, v_replayed, v_replayed_result
  from public.b07_finalize_assessment_score(
    v_attempt_b, v_rubric_a,
    'insufficient_evidence', null,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'b07-test-1'
  ) f;

  if v_status <> 'insufficient_evidence'
     or v_replayed is distinct from false
     or not exists (
       select 1
       from public.assessment_scoring_results
       where attempt_id = v_attempt_b
         and outcome = 'insufficient_evidence'
         and score is null
     )
  then
    raise exception 'Insufficient evidence handling failed';
  end if;

  raise notice 'B07_INSUFFICIENT_EVIDENCE_PASS';

  -- Official scoring results cannot be modified or deleted.
  begin
    update public.assessment_scoring_results
    set score = 100
    where id = v_result_id;

    raise exception 'Official score modification succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    delete from public.assessment_scoring_results
    where id = v_result_id;

    raise exception 'Official score deletion succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B07_SCORING_IMMUTABILITY_PASS';
  raise notice 'B07_SCORING_FINALIZATION_ALL_PASS';
end;
$test$;

rollback;