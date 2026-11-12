-- B-05 student session database regression tests.
-- All synthetic records are rolled back.

BEGIN;

DO $test$
DECLARE
  v_teacher uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
BEGIN
  -- Synthetic teacher for the classes.teacher_uid foreign key.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, created_at, updated_at
  )
  VALUES (
    v_teacher,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'b05-test-' || replace(v_teacher::text, '-', '') || '@example.invalid',
    now(),
    now()
  );

  INSERT INTO public.classes (
    id, teacher_uid, name, grade, class_code
  )
  VALUES (
    v_class, v_teacher, 'B05 Test Class', 7, 'B5TEST77'
  );

  INSERT INTO public.student_sessions (
    id, class_id, display_name,
    access_code_hash, recovery_token_hash
  )
  VALUES (
    v_session, v_class, '  Rina  ',
    repeat('a', 64), repeat('b', 64)
  );

  -- Names must be normalized for uniqueness.
  IF (
    SELECT display_name_key
    FROM public.student_sessions
    WHERE id = v_session
  ) IS DISTINCT FROM 'rina' THEN
    RAISE EXCEPTION 'FAIL: display name normalization';
  END IF;

  -- Duplicate active name, ignoring case and whitespace.
  BEGIN
    INSERT INTO public.student_sessions (
      class_id, display_name, access_code_hash, recovery_token_hash
    )
    VALUES (v_class, 'rInA', repeat('c', 64), repeat('d', 64));

    RAISE EXCEPTION 'FAIL: duplicate active name was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Access-code hashes must be unique.
  BEGIN
    INSERT INTO public.student_sessions (
      class_id, display_name, access_code_hash, recovery_token_hash
    )
    VALUES (v_class, 'Sari', repeat('a', 64), repeat('c', 64));

    RAISE EXCEPTION 'FAIL: duplicate access hash was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Recovery-token hashes must be unique.
  BEGIN
    INSERT INTO public.student_sessions (
      class_id, display_name, access_code_hash, recovery_token_hash
    )
    VALUES (v_class, 'Dina', repeat('c', 64), repeat('b', 64));

    RAISE EXCEPTION 'FAIL: duplicate recovery hash was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Invalid hash format must be rejected.
  BEGIN
    INSERT INTO public.student_sessions (
      class_id, display_name, access_code_hash, recovery_token_hash
    )
    VALUES (v_class, 'Budi', 'not-a-hash', repeat('c', 64));

    RAISE EXCEPTION 'FAIL: invalid hash was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- Access and recovery credentials must differ.
  BEGIN
    INSERT INTO public.student_sessions (
      class_id, display_name, access_code_hash, recovery_token_hash
    )
    VALUES (v_class, 'Eka', repeat('e', 64), repeat('e', 64));

    RAISE EXCEPTION 'FAIL: identical credential hashes accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- Session cannot reference a nonexistent class.
  BEGIN
    INSERT INTO public.student_sessions (
      class_id, display_name, access_code_hash, recovery_token_hash
    )
    VALUES (
      gen_random_uuid(), 'Fajar',
      repeat('c', 64), repeat('d', 64)
    );

    RAISE EXCEPTION 'FAIL: invalid class reference accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  -- Revoked names may be registered again.
  UPDATE public.student_sessions
  SET revoked_at = now()
  WHERE id = v_session;

  INSERT INTO public.student_sessions (
    class_id, display_name, access_code_hash, recovery_token_hash
  )
  VALUES (v_class, ' RINA ', repeat('c', 64), repeat('d', 64));

  IF (
    SELECT count(*)
    FROM public.student_sessions
    WHERE class_id = v_class
      AND display_name_key = 'rina'
      AND revoked_at IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'FAIL: active session after revocation';
  END IF;

  RAISE NOTICE 'B05_SESSION_CONSTRAINT_TESTS_PASS';
END;
$test$;

ROLLBACK;