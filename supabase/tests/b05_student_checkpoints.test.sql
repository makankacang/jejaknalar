
-- B-05: Checkpoint revision, isolation, and access-control tests.
-- All records are synthetic and rolled back.

BEGIN;

DO $test$
DECLARE
  v_teacher uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_student_a uuid := gen_random_uuid();
  v_student_b uuid := gen_random_uuid();

  v_checkpoint_a uuid;
  v_checkpoint_b uuid;
  v_returned_id uuid;
  v_revision bigint;
  v_progress jsonb;
  v_updated_at timestamptz;

  v_conflict boolean;
  v_rejected boolean;
  v_error_message text;

  v_initial jsonb := '{"state":"EXPLORING","step":1}'::jsonb;
  v_updated jsonb := '{"state":"CHALLENGE","step":2}'::jsonb;
BEGIN
  -- Create a synthetic teacher and class.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, created_at, updated_at
  )
  VALUES (
    v_teacher,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'b05-checkpoint-' || replace(v_teacher::text, '-', '')
      || '@example.invalid',
    now(),
    now()
  );

  INSERT INTO public.classes (
    id, teacher_uid, name, grade, class_code
  )
  VALUES (
    v_class,
    v_teacher,
    'B05 Checkpoint Test',
    7,
    upper(translate(substr(md5(v_class::text), 1, 8), '01', 'AB'))
  );

  INSERT INTO public.student_sessions (
    id, class_id, display_name,
    access_code_hash, recovery_token_hash
  )
  VALUES
    (
      v_student_a,
      v_class,
      'Checkpoint Student A',
      md5(v_student_a::text || ':access')
        || md5(v_student_a::text || ':access2'),
      md5(v_student_a::text || ':recovery')
        || md5(v_student_a::text || ':recovery2')
    ),
    (
      v_student_b,
      v_class,
      'Checkpoint Student B',
      md5(v_student_b::text || ':access')
        || md5(v_student_b::text || ':access2'),
      md5(v_student_b::text || ':recovery')
        || md5(v_student_b::text || ':recovery2')
    );

  -- Test 1: Initial write, revision 0 -> 1.
  SELECT checkpoint_id, revision, progress, updated_at
  INTO v_checkpoint_a, v_revision, v_progress, v_updated_at
  FROM public.b05_save_student_checkpoint(
    v_student_a,
    'QV-DEMO-001',
    0,
    v_initial
  );

  IF v_checkpoint_a IS NULL
    OR v_revision IS DISTINCT FROM 1
    OR v_progress IS DISTINCT FROM v_initial
    OR v_updated_at IS NULL
  THEN
    RAISE EXCEPTION 'FAIL: initial checkpoint save';
  END IF;

  RAISE NOTICE 'B05_CHECKPOINT_CREATE_REVISION_1_PASS';

  -- Test 2: Valid update, revision 1 -> 2.
  SELECT checkpoint_id, revision, progress, updated_at
  INTO v_returned_id, v_revision, v_progress, v_updated_at
  FROM public.b05_save_student_checkpoint(
    v_student_a,
    'QV-DEMO-001',
    1,
    v_updated
  );

  IF v_returned_id IS DISTINCT FROM v_checkpoint_a
    OR v_revision IS DISTINCT FROM 2
    OR v_progress IS DISTINCT FROM v_updated
  THEN
    RAISE EXCEPTION 'FAIL: checkpoint revision update';
  END IF;

  RAISE NOTICE 'B05_CHECKPOINT_UPDATE_REVISION_2_PASS';

  -- Test 3: Stale revision 1 must be rejected.
  v_conflict := false;

  BEGIN
    PERFORM public.b05_save_student_checkpoint(
      v_student_a,
      'QV-DEMO-001',
      1,
      '{"state":"OLD_PROGRESS"}'::jsonb
    );
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;

    IF v_error_message = 'B05_CHECKPOINT_REVISION_CONFLICT' THEN
      v_conflict := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_conflict THEN
    RAISE EXCEPTION 'FAIL: stale revision was accepted';
  END IF;

  -- Repeating initial creation must also conflict.
  v_conflict := false;

  BEGIN
    PERFORM public.b05_save_student_checkpoint(
      v_student_a,
      'QV-DEMO-001',
      0,
      v_initial
    );
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;

    IF v_error_message = 'B05_CHECKPOINT_REVISION_CONFLICT' THEN
      v_conflict := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_conflict THEN
    RAISE EXCEPTION 'FAIL: duplicate initial checkpoint accepted';
  END IF;

  -- Verify that rejected writes did not overwrite newer progress.
  SELECT revision, progress
  INTO v_revision, v_progress
  FROM public.student_checkpoints
  WHERE id = v_checkpoint_a;

  IF v_revision IS DISTINCT FROM 2
    OR v_progress IS DISTINCT FROM v_updated
  THEN
    RAISE EXCEPTION 'FAIL: newer checkpoint was overwritten';
  END IF;

  RAISE NOTICE 'B05_CHECKPOINT_STALE_REVISION_REJECTED_PASS';

  -- Test 4: Another student has an independent checkpoint.
  SELECT checkpoint_id, revision, progress, updated_at
  INTO v_checkpoint_b, v_revision, v_progress, v_updated_at
  FROM public.b05_save_student_checkpoint(
    v_student_b,
    'QV-DEMO-001',
    0,
    '{"state":"READY","step":0}'::jsonb
  );

  IF v_checkpoint_b IS NULL
    OR v_checkpoint_b = v_checkpoint_a
    OR v_revision IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION 'FAIL: student checkpoint isolation';
  END IF;

  IF (
    SELECT count(*)
    FROM public.student_checkpoints
    WHERE student_session_id IN (v_student_a, v_student_b)
      AND quest_version_id = 'QV-DEMO-001'
  ) <> 2 THEN
    RAISE EXCEPTION 'FAIL: independent checkpoint count';
  END IF;

  RAISE NOTICE 'B05_CHECKPOINT_STUDENT_ISOLATION_PASS';

  -- Test 5: Invalid revision must be rejected.
  v_rejected := false;

  BEGIN
    PERFORM public.b05_save_student_checkpoint(
      v_student_a,
      'QV-DEMO-001',
      -1,
      v_initial
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: negative revision accepted';
  END IF;

  -- Progress must be a JSON object.
  v_rejected := false;

  BEGIN
    PERFORM public.b05_save_student_checkpoint(
      v_student_a,
      'QV-DEMO-001',
      2,
      '[]'::jsonb
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: invalid progress type accepted';
  END IF;

  -- Oversized progress must be rejected.
  v_rejected := false;

  BEGIN
    PERFORM public.b05_save_student_checkpoint(
      v_student_a,
      'QV-DEMO-001',
      2,
      jsonb_build_object('text', repeat('x', 17000))
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: oversized progress accepted';
  END IF;

  RAISE NOTICE 'B05_CHECKPOINT_INPUT_VALIDATION_PASS';

  -- Test 6: Nonexistent session must be rejected.
  v_rejected := false;

  BEGIN
    PERFORM public.b05_save_student_checkpoint(
      gen_random_uuid(),
      'QV-DEMO-001',
      0,
      v_initial
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: nonexistent session accepted';
  END IF;

  -- Revocation must block further writes.
  UPDATE public.student_sessions
  SET revoked_at = now()
  WHERE id = v_student_a;

  v_rejected := false;

  BEGIN
    PERFORM public.b05_save_student_checkpoint(
      v_student_a,
      'QV-DEMO-001',
      2,
      '{"state":"COMPLETED"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: revoked session can save progress';
  END IF;

  RAISE NOTICE 'B05_CHECKPOINT_REVOKED_SESSION_PASS';

  -- Test 7: Public clients have no direct database access.
  IF has_table_privilege(
    'anon', 'public.student_checkpoints', 'SELECT'
  ) OR has_table_privilege(
    'authenticated', 'public.student_checkpoints', 'SELECT'
  ) OR has_table_privilege(
    'anon', 'public.student_checkpoints', 'INSERT'
  ) OR has_table_privilege(
    'authenticated', 'public.student_checkpoints', 'UPDATE'
  ) OR has_function_privilege(
    'anon',
    'public.b05_save_student_checkpoint(uuid,text,bigint,jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.b05_save_student_checkpoint(uuid,text,bigint,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: public checkpoint permissions';
  END IF;

  RAISE NOTICE 'B05_CHECKPOINT_ACCESS_CONTROL_PASS';
  RAISE NOTICE 'B05_CHECKPOINT_TESTS_PASS';
END;
$test$;

ROLLBACK;
