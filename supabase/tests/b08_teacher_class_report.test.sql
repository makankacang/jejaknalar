-- B08: Teacher report accuracy and class isolation.
-- All synthetic records are rolled back.

begin;

do $test$
declare
  v_teacher_a uuid := gen_random_uuid();
  v_teacher_b uuid := gen_random_uuid();
  v_class_a uuid := gen_random_uuid();
  v_class_b uuid := gen_random_uuid();
  v_student_a uuid := gen_random_uuid();
  v_student_b uuid := gen_random_uuid();

  v_suffix text := upper(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  );

  v_quest_id text;
  v_version text;
  v_payload jsonb;
  v_rubric uuid;

  v_scored uuid;
  v_pending uuid;
  v_insufficient uuid;

  v_report jsonb;
  v_other_report jsonb;
  v_summary jsonb;
  v_student_row jsonb;

  v_answers jsonb := '[
    {"item_id":"ITEM-B08-REPORT","value":"Jawaban sintetis"}
  ]'::jsonb;
begin
  v_quest_id := 'QUEST-B08-REPORT-' || v_suffix;
  v_version := 'QV-B08-REPORT-' || v_suffix;

  -- Browser clients must not invoke the report RPC directly.
  if has_function_privilege(
    'anon',
    'public.b08_teacher_class_report(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.b08_teacher_class_report(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Teacher report RPC is publicly executable';
  end if;

  raise notice 'B08_REPORT_PRIVATE_RPC_PASS';

  insert into auth.users (
    instance_id, id, aud, role, email, created_at, updated_at
  ) values
  (
    '00000000-0000-0000-0000-000000000000',
    v_teacher_a, 'authenticated', 'authenticated',
    'b08-report-a-' || v_teacher_a || '@example.test',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    v_teacher_b, 'authenticated', 'authenticated',
    'b08-report-b-' || v_teacher_b || '@example.test',
    now(), now()
  );

  insert into public.classes (
    id, teacher_uid, name, grade, class_code
  ) values
  (
    v_class_a, v_teacher_a, 'B08 Report Class A', 7,
    upper(translate(
      substr(replace(v_class_a::text, '-', ''), 1, 8),
      '01', '23'
    ))
  ),
  (
    v_class_b, v_teacher_b, 'B08 Report Class B', 7,
    upper(translate(
      substr(replace(v_class_b::text, '-', ''), 1, 8),
      '01', '23'
    ))
  );

  insert into public.student_sessions (
    id, class_id, display_name,
    access_code_hash, recovery_token_hash
  ) values
  (
    v_student_a, v_class_a, 'Student Report A',
    md5(v_student_a::text) || md5(v_teacher_a::text),
    md5(v_teacher_a::text) || md5(v_student_a::text)
  ),
  (
    v_student_b, v_class_b, 'Student Report B',
    md5(v_student_b::text) || md5(v_teacher_b::text),
    md5(v_teacher_b::text) || md5(v_student_b::text)
  );

  v_payload := jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', v_quest_id,
    'quest_version_id', v_version,
    'objective_ids', jsonb_build_array('LO-B08-REPORT'),
    'template', 'evidence_hunt',
    'scene_id', 'school_library',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'read-01',
        'type', 'read_document',
        'ref', 'DOC-B08-REPORT'
      ),
      jsonb_build_object(
        'id', 'evidence-01',
        'type', 'select_evidence',
        'item_id', 'ITEM-B08-REPORT'
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
    v_class_a, v_quest_id, v_version,
    v_teacher_a, v_payload
  );

  update public.quest_review_drafts
  set status = 'approved',
      approved_by = v_teacher_a
  where quest_version_id = v_version;

  insert into public.published_quest_versions (
    class_id, quest_id, quest_version_id,
    approved_by, public_payload
  ) values (
    v_class_a, v_quest_id, v_version,
    v_teacher_a, v_payload
  );

  insert into public.assessment_rubric_versions (
    quest_version_id, revision,
    registered_by, private_spec
  ) values (
    v_version, 1, v_teacher_a,
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object(
          'item_id', 'ITEM-B08-REPORT',
          'objective_id', 'LO-B08-REPORT',
          'answer_key', 'PRIVATE-B08-KEY',
          'max_points', 4
        )
      )
    )
  )
  returning id into v_rubric;

  -- One scored attempt.
  select attempt_id into v_scored
  from public.b05_create_assessment_attempt(
    v_student_a, v_version, gen_random_uuid(), v_answers
  );

  perform public.b07_finalize_assessment_score(
    v_scored, v_rubric, 'scored', 75,
    '[{"objective_id":"LO-B08-REPORT","score":75}]'::jsonb,
    '[{"message":"Perlu latihan tambahan"}]'::jsonb,
    '[{"criterion":"C1","internal_notes":"SECRET-DO-NOT-EXPOSE"}]'::jsonb,
    'b08-report-synthetic-test'
  );

  perform public.b08_record_adaptive_decision(
    v_scored, 'b08-provisional-1'
  );

  -- One pending attempt.
  select attempt_id into v_pending
  from public.b05_create_assessment_attempt(
    v_student_a, v_version, gen_random_uuid(), v_answers
  );

  -- One attempt with insufficient evidence.
  select attempt_id into v_insufficient
  from public.b05_create_assessment_attempt(
    v_student_a, v_version, gen_random_uuid(), v_answers
  );

  perform public.b07_finalize_assessment_score(
    v_insufficient, v_rubric, 'insufficient_evidence', null,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'b08-report-synthetic-test'
  );

  -- Teacher A reads only their own class.
  v_report := public.b08_teacher_class_report(
    v_teacher_a, v_class_a
  );

  v_summary := v_report -> 'summary';

  if (v_summary ->> 'total_students')::integer <> 1
    or (v_summary ->> 'active_students')::integer <> 1
    or (v_summary ->> 'published_quests')::integer <> 1
    or (v_summary ->> 'total_attempts')::integer <> 3
    or (v_summary ->> 'pending_scoring')::integer <> 1
    or (v_summary ->> 'scored_attempts')::integer <> 1
    or (v_summary ->> 'insufficient_evidence')::integer <> 1
  then
    raise exception 'Teacher report summary counts are incorrect: %',
      v_summary;
  end if;

  raise notice 'B08_REPORT_SUMMARY_COUNTS_PASS';

  if jsonb_array_length(v_report -> 'students') <> 1
    or jsonb_array_length(v_report -> 'attempt_history') <> 3
    or jsonb_array_length(v_report -> 'objectives') <> 1
  then
    raise exception 'Teacher report collections are incorrect';
  end if;

  v_student_row := v_report -> 'students' -> 0;

  if v_student_row ->> 'student_id' <> v_student_a::text
    or (v_student_row ->> 'attempts')::integer <> 3
    or (v_student_row ->> 'last_score')::integer <> 75
    or v_student_row ->> 'last_adaptive_path' <> 'developing'
    or v_student_row ->> 'last_policy_status' <> 'provisional'
  then
    raise exception 'Teacher report student summary is incorrect';
  end if;

  if v_report -> 'objectives' -> 0 ->> 'objective_id'
       <> 'LO-B08-REPORT'
    or (
      v_report -> 'objectives' -> 0 ->> 'scored_result_count'
    )::integer <> 1
  then
    raise exception 'Teacher report objective summary is incorrect';
  end if;

  raise notice 'B08_REPORT_STUDENTS_OBJECTIVES_PASS';

  -- Missing learning data must not be fabricated as zero.
  if v_summary -> 'quest_completion_count' <> 'null'::jsonb
    or v_student_row -> 'quest_completion' <> 'null'::jsonb
    or v_report -> 'reinforcement_groups' <> 'null'::jsonb
    or v_report -> 'intervention_history' <> 'null'::jsonb
  then
    raise exception 'Unavailable report data was fabricated';
  end if;

  raise notice 'B08_REPORT_UNAVAILABLE_DATA_PASS';

  -- Private rubric, answers, and raw evidence must not leak.
  if v_report::text like '%PRIVATE-B08-KEY%'
    or v_report::text like '%SECRET-DO-NOT-EXPOSE%'
    or v_report::text like '%Jawaban sintetis%'
    or v_report::text like '%access_code_hash%'
  then
    raise exception 'Private assessment data leaked into report';
  end if;

  raise notice 'B08_REPORT_NO_PRIVATE_DATA_PASS';

  -- Teacher B cannot request teacher A's report.
  begin
    perform public.b08_teacher_class_report(
      v_teacher_b, v_class_a
    );

    raise exception 'Foreign teacher accessed class report';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B08_REPORT_FOREIGN_TEACHER_DENIED_PASS';

  -- Teacher B's own class must not include A's assessments.
  v_other_report := public.b08_teacher_class_report(
    v_teacher_b, v_class_b
  );

  if (v_other_report -> 'summary' ->> 'total_attempts')::integer <> 0
    or jsonb_array_length(
      v_other_report -> 'attempt_history'
    ) <> 0
    or jsonb_array_length(
      v_other_report -> 'students'
    ) <> 1
  then
    raise exception 'Cross-class assessment data leaked';
  end if;

  raise notice 'B08_REPORT_CLASS_ISOLATION_PASS';
  raise notice 'B08_TEACHER_REPORT_ALL_PASS';
end;
$test$;

rollback;