-- B08: Server-authoritative adaptive decision regression.
-- All synthetic fixtures are rolled back.

begin;

do $test$
declare
  v_teacher uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_suffix text := upper(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  );
  v_quest_id text;
  v_version text;
  v_class_code text;
  v_payload jsonb;
  v_rubric uuid;
  v_attempt uuid;
  v_last_attempt uuid;
  v_status text;
  v_path text;
  v_expected text;
  v_replayed boolean;
  v_score integer;
  v_count integer;

  v_answers jsonb := '[
    {"item_id":"ITEM-B08-001","value":"Jawaban sintetis"}
  ]'::jsonb;
begin
  v_quest_id := 'QUEST-B08-TEST-' || v_suffix;
  v_version := 'QV-B08-TEST-' || v_suffix;
  v_class_code := translate(substr(v_suffix, 1, 8), '01', '23');

  -- Neither students nor browser-authenticated teachers
  -- may read or write private adaptive decisions.
  if has_table_privilege(
    'anon', 'public.assessment_adaptive_decisions', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.assessment_adaptive_decisions', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.assessment_adaptive_decisions', 'INSERT'
  ) or has_function_privilege(
    'authenticated',
    'public.b08_record_adaptive_decision(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Adaptive decision permissions are unsafe';
  end if;

  raise notice 'B08_ADAPTIVE_PRIVATE_ACCESS_PASS';

  insert into auth.users (
    instance_id, id, aud, role, email,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_teacher, 'authenticated', 'authenticated',
    'b08-test-' || v_teacher || '@example.test',
    now(), now()
  );

  insert into public.classes (
    id, teacher_uid, name, grade, class_code
  ) values (
    v_class, v_teacher, 'B08 Adaptive Test',
    7, v_class_code
  );

  insert into public.student_sessions (
    id, class_id, display_name,
    access_code_hash, recovery_token_hash
  ) values (
    v_student, v_class, 'B08 Test Student',
    md5(v_student::text) || md5(v_teacher::text),
    md5(v_teacher::text) || md5(v_student::text)
  );

  v_payload := jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', v_quest_id,
    'quest_version_id', v_version,
    'objective_ids', jsonb_build_array('LO-B08-TEST'),
    'template', 'evidence_hunt',
    'scene_id', 'school_library',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'read-01',
        'type', 'read_document',
        'ref', 'DOC-B08-001'
      ),
      jsonb_build_object(
        'id', 'evidence-01',
        'type', 'select_evidence',
        'item_id', 'ITEM-B08-001'
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
  set status = 'approved',
      approved_by = v_teacher
  where quest_version_id = v_version;

  insert into public.published_quest_versions (
    class_id, quest_id, quest_version_id,
    approved_by, public_payload
  ) values (
    v_class, v_quest_id, v_version,
    v_teacher, v_payload
  );

  insert into public.assessment_rubric_versions (
    quest_version_id, revision,
    registered_by, private_spec
  ) values (
    v_version, 1, v_teacher,
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object(
          'item_id', 'ITEM-B08-001',
          'objective_id', 'LO-B08-TEST',
          'answer_key', 'PRIVATE-SYNTHETIC-ANSWER',
          'max_points', 4
        )
      )
    )
  )
  returning id into v_rubric;

  -- A pending attempt must NOT receive an adaptive path.
  select f.attempt_id
  into v_attempt
  from public.b05_create_assessment_attempt(
    v_student, v_version, gen_random_uuid(), v_answers
  ) f;

  begin
    perform public.b08_record_adaptive_decision(
      v_attempt, 'b08-provisional-1'
    );

    raise exception 'Pending assessment received an adaptive decision';
  exception
    when sqlstate '22023' then null;
  end;

  raise notice 'B08_PENDING_DECISION_DENIED_PASS';

  -- Finalize six independent attempts with synthetic scores.
  -- The B07 finalization function does NOT calculate scores.
  for v_score in
    select unnest(array[0, 59, 60, 79, 80, 100])
  loop
    select f.attempt_id
    into v_attempt
    from public.b05_create_assessment_attempt(
      v_student, v_version, gen_random_uuid(), v_answers
    ) f;

    perform public.b07_finalize_assessment_score(
      v_attempt,
      v_rubric,
      'scored',
      v_score,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'b08-synthetic-test'
    );

    select d.next_path, d.replayed
    into v_path, v_replayed
    from public.b08_record_adaptive_decision(
      v_attempt, 'b08-provisional-1'
    ) d;

    v_expected := case
      when v_score < 60 then 'needs_support'
      when v_score < 80 then 'developing'
      else 'ready_for_extension'
    end;

    if v_path is distinct from v_expected
      or v_replayed is distinct from false
    then
      raise exception 'Wrong adaptive decision for score %', v_score;
    end if;

    v_last_attempt := v_attempt;

    raise notice 'B08_SCORE_%_PASS', v_score;
  end loop;

  raise notice 'B08_SCORE_BOUNDARIES_DB_PASS';

  -- Identical retry must return the stored decision.
  select d.next_path, d.replayed
  into v_path, v_replayed
  from public.b08_record_adaptive_decision(
    v_last_attempt, 'b08-provisional-1'
  ) d;

  if v_path <> 'ready_for_extension'
    or v_replayed is distinct from true
  then
    raise exception 'Adaptive decision replay failed';
  end if;

  select count(*)
  into v_count
  from public.assessment_adaptive_decisions
  where attempt_id = v_last_attempt;

  if v_count <> 1 then
    raise exception 'Duplicate adaptive decisions created';
  end if;

  raise notice 'B08_ADAPTIVE_IDEMPOTENCY_PASS';

  -- A different policy cannot overwrite an official decision.
  insert into public.assessment_adaptive_policies (
    version, developing_min_score,
    extension_min_score, approval_status
  ) values (
    'b08-test-alternative', 50, 90, 'provisional'
  );

  begin
    perform public.b08_record_adaptive_decision(
      v_last_attempt, 'b08-test-alternative'
    );

    raise exception 'Conflicting policy was accepted';
  exception
    when unique_violation then null;
  end;

  raise notice 'B08_ADAPTIVE_POLICY_CONFLICT_DENIED_PASS';

  -- Insufficient evidence must produce NULL, never score 0.
  select f.attempt_id
  into v_attempt
  from public.b05_create_assessment_attempt(
    v_student, v_version, gen_random_uuid(), v_answers
  ) f;

  perform public.b07_finalize_assessment_score(
    v_attempt,
    v_rubric,
    'insufficient_evidence',
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'b08-synthetic-test'
  );

  select d.next_path, d.outcome
  into v_path, v_status
  from public.b08_record_adaptive_decision(
    v_attempt, 'b08-provisional-1'
  ) d;

  if v_path is not null
    or v_status <> 'insufficient_evidence'
  then
    raise exception 'Insufficient evidence decision is incorrect';
  end if;

  raise notice 'B08_INSUFFICIENT_EVIDENCE_DB_PASS';

  -- Persisted decisions are immutable.
  begin
    update public.assessment_adaptive_decisions
    set next_path = 'needs_support'
    where attempt_id = v_last_attempt;

    raise exception 'Adaptive decision modification succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    delete from public.assessment_adaptive_decisions
    where attempt_id = v_last_attempt;

    raise exception 'Adaptive decision deletion succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B08_ADAPTIVE_IMMUTABILITY_PASS';
  raise notice 'B08_ADAPTIVE_DATABASE_ALL_PASS';
end;
$test$;

rollback;