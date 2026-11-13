
-- B06 published quest security tests.
-- All synthetic data is rolled back.

begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  test_class_id uuid := gen_random_uuid();
  version_id text := 'QV-B06-' || upper(replace(gen_random_uuid()::text, '-', ''));
  quest_payload jsonb;
  published_id uuid;
  rejected boolean;
begin
  -- No direct public/student access.
  if has_table_privilege('anon', 'public.published_quest_versions', 'SELECT')
    or has_table_privilege('authenticated', 'public.published_quest_versions', 'SELECT')
    or has_table_privilege('authenticated', 'public.published_quest_versions', 'INSERT')
  then
    raise exception 'SECURITY FAIL: public table access';
  end if;

  if not has_table_privilege('service_role', 'public.published_quest_versions', 'SELECT')
    or not has_table_privilege('service_role', 'public.published_quest_versions', 'INSERT')
  then
    raise exception 'SECURITY FAIL: service role permissions';
  end if;

  -- Synthetic teachers.
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at
  )
  values
    ('00000000-0000-0000-0000-000000000000',
     owner_id, 'authenticated', 'authenticated',
     'b06-owner-' || owner_id || '@example.test',
     '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000',
     other_id, 'authenticated', 'authenticated',
     'b06-other-' || other_id || '@example.test',
     '', now(), now(), now());

  insert into public.classes (
    id, teacher_uid, name, grade, class_code
  )
  values (
    test_class_id, owner_id, 'B06 Test Class', 7, 'B6QUEST7'
  );

  quest_payload := jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', 'QUEST-B06-TEST',
    'quest_version_id', version_id,
    'objective_ids', jsonb_build_array('LO-B06-TEST'),
    'template', 'evidence_hunt',
    'scene_id', 'school_library',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'read-01',
        'type', 'read_document',
        'ref', 'DOC-001'
      )
    ),
    'variants', jsonb_build_object(
      'needs_support', 'QVAR-S',
      'developing', 'QVAR-D',
      'ready_for_extension', 'QVAR-E'
    )
  );

      -- B06: Publication requires a matching approved draft.
  insert into public.quest_review_drafts (
    class_id,
    quest_id,
    quest_version_id,
    submitted_by,
    public_payload
  )
  values (
    test_class_id,
    'QUEST-B06-TEST',
    version_id,
    owner_id,
    quest_payload
  );

  -- The class owner explicitly approves the unchanged draft.
  update public.quest_review_drafts
  set status = 'approved',
      approved_by = owner_id
  where quest_version_id = version_id
    and class_id = test_class_id
    and status = 'pending_review';

  if not exists (
    select 1
    from public.quest_review_drafts
    where quest_version_id = version_id
      and status = 'approved'
      and approved_by = owner_id
  ) then
    raise exception 'FAIL: draft approval was not recorded';
  end if;

  -- A class owner can publish.
  insert into public.published_quest_versions (
    class_id, quest_id, quest_version_id,
    approved_by, public_payload
  )
  values (
    test_class_id, 'QUEST-B06-TEST',
    version_id, owner_id, quest_payload
  )
  returning id into published_id;

  if published_id is null then
    raise exception 'FAIL: publication was not created';
  end if;

  -- Another teacher must not publish to this class.
  rejected := false;
  begin
    insert into public.published_quest_versions (
      class_id, quest_id, quest_version_id,
      approved_by, public_payload
    )
    values (
      test_class_id, 'QUEST-B06-TEST',
      'QV-B06-OTHER', other_id,
      jsonb_set(quest_payload, '{quest_version_id}', '"QV-B06-OTHER"')
    );
  exception when sqlstate '42501' then
    rejected := true;
  end;

  if not rejected then
    raise exception 'SECURITY FAIL: another teacher published';
  end if;

  -- Published versions cannot be modified.
  rejected := false;
  begin
    update public.published_quest_versions
    set quest_id = 'QUEST-CHANGED'
    where id = published_id;
  exception when sqlstate '42501' then
    rejected := true;
  end;

  if not rejected then
    raise exception 'SECURITY FAIL: published quest updated';
  end if;

  -- Published versions cannot be deleted.
  rejected := false;
  begin
    delete from public.published_quest_versions
    where id = published_id;
  exception when sqlstate '42501' then
    rejected := true;
  end;

  if not rejected then
    raise exception 'SECURITY FAIL: published quest deleted';
  end if;

  raise notice 'B06_PUBLISHED_QUEST_SECURITY_PASS';
end;
$$;

rollback;
