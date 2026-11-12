-- B-05 rate limit regression test.
-- Synthetic records are rolled back after testing.

BEGIN;

DO $test$
DECLARE
  v_teacher uuid := gen_random_uuid();
  v_class uuid := gen_random_uuid();
  v_allowed boolean;
  v_attempts integer;
BEGIN
  -- Create synthetic teacher and class.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, created_at, updated_at
  )
  VALUES (
    v_teacher,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'b05-limit-' || replace(v_teacher::text, '-', '') || '@example.invalid',
    now(),
    now()
  );

  INSERT INTO public.classes (
    id, teacher_uid, name, grade, class_code
  )
  VALUES (
    v_class, v_teacher, 'B05 Rate Limit Test', 7, 'B5TEST79'
  );

  -- Attempts 1 through 30 must succeed.
  FOR i IN 1..30 LOOP
    SELECT public.b05_consume_join_budget(v_class)
    INTO v_allowed;

    IF v_allowed IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FAIL: attempt % rejected too early', i;
    END IF;
  END LOOP;

  -- Attempt 31 must be rejected.
  SELECT public.b05_consume_join_budget(v_class)
  INTO v_allowed;

  IF v_allowed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: attempt 31 was not blocked';
  END IF;

  SELECT attempts
  INTO v_attempts
  FROM public.b05_join_rate_limits
  WHERE class_id = v_class;

  IF v_attempts <> 31 THEN
    RAISE EXCEPTION 'FAIL: expected 31 attempts, got %', v_attempts;
  END IF;

  -- Simulate an expired 10-minute window.
  UPDATE public.b05_join_rate_limits
  SET window_started_at = clock_timestamp() - interval '11 minutes'
  WHERE class_id = v_class;

  SELECT public.b05_consume_join_budget(v_class)
  INTO v_allowed;

  IF v_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: budget did not reset';
  END IF;

  SELECT attempts
  INTO v_attempts
  FROM public.b05_join_rate_limits
  WHERE class_id = v_class;

  IF v_attempts <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected reset to 1, got %', v_attempts;
  END IF;

  -- Public clients must not call the budget function directly.
  IF has_function_privilege(
    'anon',
    'public.b05_consume_join_budget(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon can execute budget function';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.b05_consume_join_budget(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated can execute budget function';
  END IF;

  RAISE NOTICE 'B05_JOIN_RATE_LIMIT_TESTS_PASS';
END;
$test$;

ROLLBACK;