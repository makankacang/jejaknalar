-- B-05: Assessment persistence and idempotency regression.
-- Synthetic data is rolled back. No official scoring is performed.

BEGIN;

DO $test$
DECLARE
  v_teacher uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_student_a uuid := gen_random_uuid();
  v_student_b uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();

  v_answers jsonb :=
    '[{"item_id":"ITEM-001","value":"Bukti dari teks"}]'::jsonb;

  v_attempt_a uuid;
  v_attempt_b uuid;
  v_returned_id uuid;
  v_status text;
  v_replayed boolean;
BEGIN
  -- 1. Prepare synthetic teacher, class, and two student sessions.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, created_at, updated_at
  )
  VALUES (
    v_teacher,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'b05-assessment-' || replace(v_teacher::text, '-', '')
      || '@example.invalid',
    now(),
    now()
  );

  INSERT INTO public.classes (
    id, teacher_uid, name, grade, class_code
  )
  VALUES (
    v_class, v_teacher, 'B05 Assessment Test', 7, 'B5TEST7B'
  );

  INSERT INTO public.student_sessions (
    id, class_id, display_name,
    access_code_hash, recovery_token_hash
  )
  VALUES
    (
      v_student_a, v_class, 'B05 Student A',
      repeat('a', 64), repeat('b', 64)
    ),
    (
      v_student_b, v_class, 'B05 Student B',
      repeat('c', 64), repeat('d', 64)
    );

  -- 2. First submission creates a pending attempt.
  SELECT attempt_id, status, replayed
  INTO v_attempt_a, v_status, v_replayed
  FROM public.b05_create_assessment_attempt(
    v_student_a, 'QV-DEMO-001', v_key, v_answers
  );

  IF v_attempt_a IS NULL
    OR v_status IS DISTINCT FROM 'pending_scoring'
    OR v_replayed IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'FAIL: initial assessment submission';
  END IF;

  -- 3. Same student + key + payload must replay the same attempt.
  SELECT attempt_id, status, replayed
  INTO v_returned_id, v_status, v_replayed
  FROM public.b05_create_assessment_attempt(
    v_student_a, 'QV-DEMO-001', v_key, v_answers
  );

  IF v_returned_id IS DISTINCT FROM v_attempt_a
    OR v_status IS DISTINCT FROM 'pending_scoring'
    OR v_replayed IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'FAIL: idempotency replay';
  END IF;

  IF (
    SELECT count(*)
    FROM public.assessment_attempts
    WHERE student_session_id = v_student_a
  ) <> 1 THEN
    RAISE EXCEPTION 'FAIL: replay created duplicate attempt';
  END IF;

  RAISE NOTICE 'B05_ASSESSMENT_IDEMPOTENCY_PASS';

  -- 4. Same key but different answers must be rejected.
  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      v_student_a,
      'QV-DEMO-001',
      v_key,
      '[{"item_id":"ITEM-001","value":"Jawaban berubah"}]'::jsonb
    );

    RAISE EXCEPTION 'FAIL: changed payload accepted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  -- Same key but different quest version must also be rejected.
  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      v_student_a,
      'QV-DEMO-002',
      v_key,
      v_answers
    );

    RAISE EXCEPTION 'FAIL: changed quest version accepted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  RAISE NOTICE 'B05_ASSESSMENT_PAYLOAD_CONFLICT_PASS';

  -- 5. Different student may use the same idempotency key.
  SELECT attempt_id, status, replayed
  INTO v_attempt_b, v_status, v_replayed
  FROM public.b05_create_assessment_attempt(
    v_student_b, 'QV-DEMO-001', v_key, v_answers
  );

  IF v_attempt_b IS NULL
    OR v_attempt_b = v_attempt_a
    OR v_replayed IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'FAIL: student isolation';
  END IF;

  IF (
    SELECT count(*)
    FROM public.assessment_attempts
    WHERE student_session_id IN (v_student_a, v_student_b)
  ) <> 2 THEN
    RAISE EXCEPTION 'FAIL: incorrect assessment row count';
  END IF;

  RAISE NOTICE 'B05_ASSESSMENT_STUDENT_ISOLATION_PASS';

  -- 6. Invalid or duplicate answers must be rejected.
  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      v_student_a, 'QV-DEMO-001',
      gen_random_uuid(), '[]'::jsonb
    );

    RAISE EXCEPTION 'FAIL: empty answers accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      v_student_a, 'QV-DEMO-001',
      gen_random_uuid(),
      '[
        {"item_id":"ITEM-001","value":"A"},
        {"item_id":"ITEM-001","value":"B"}
      ]'::jsonb
    );

    RAISE EXCEPTION 'FAIL: duplicate item accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      v_student_a, 'INVALID-VERSION',
      gen_random_uuid(), v_answers
    );

    RAISE EXCEPTION 'FAIL: invalid quest version accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      v_student_a, 'QV-DEMO-001',
      gen_random_uuid(),
      '[{"item_id":"ITEM-001","value":123}]'::jsonb
    );

    RAISE EXCEPTION 'FAIL: non-string answer accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  RAISE NOTICE 'B05_ASSESSMENT_INPUT_VALIDATION_PASS';

  -- 7. Nonexistent or revoked sessions cannot submit.
  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      gen_random_uuid(), 'QV-DEMO-001',
      gen_random_uuid(), v_answers
    );

    RAISE EXCEPTION 'FAIL: nonexistent session accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE public.student_sessions
  SET revoked_at = now()
  WHERE id = v_student_a;

  BEGIN
    PERFORM public.b05_create_assessment_attempt(
      v_student_a, 'QV-DEMO-001',
      gen_random_uuid(), v_answers
    );

    RAISE EXCEPTION 'FAIL: revoked session accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  RAISE NOTICE 'B05_ASSESSMENT_REVOKED_SESSION_PASS';

  -- 8. Public database roles must not access assessments.
  IF has_table_privilege(
    'anon', 'public.assessment_attempts', 'SELECT'
  ) OR has_table_privilege(
    'authenticated', 'public.assessment_attempts', 'SELECT'
  ) OR has_function_privilege(
    'anon',
    'public.b05_create_assessment_attempt(uuid,text,uuid,jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.b05_create_assessment_attempt(uuid,text,uuid,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: public assessment permissions';
  END IF;

  RAISE NOTICE 'B05_ASSESSMENT_ACCESS_CONTROL_PASS';
  RAISE NOTICE 'B05_ASSESSMENT_TESTS_PASS';
END;
$test$;

ROLLBACK;