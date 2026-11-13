-- B06: Publishing requires an approved, identical draft.
-- Synthetic data is rolled back after the test.

begin;

do $test$
declare
  teacher_id uuid := gen_random_uuid();
  class_id uuid := gen_random_uuid();
  draft_id uuid;
  publication_id uuid;

  quest_id text :=
    'QUEST-B06-GATE-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  version_id text :=
    'QV-B06-GATE-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  class_code text := upper(translate(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    '01', '23'
  ));

  payload jsonb;
begin
  payload := jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', quest_id,
    'quest_version_id', version_id,
    'objective_ids', jsonb_build_array('LO-B06-TEST'),
    'template', 'evidence_hunt',
    'scene_id', 'school_library',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'read-01',
        'type', 'read_document',
        'ref', 'DOC-001'
      ),
      jsonb_build_object(
        'id', 'evidence-01',
        'type', 'select_evidence',
        'item_id', 'ITEM-B06-001'
      )
    ),
    'variants', jsonb_build_object(
      'needs_support', 'QVAR-S',
      'developing', 'QVAR-D',
      'ready_for_extension', 'QVAR-E'
    )
  );

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    teacher_id, 'authenticated', 'authenticated',
    'b06-gate-' || teacher_id::text || '@example.test',
    '', now(), now(), now()
  );

  insert into public.classes (
    id, teacher_uid, name, grade, class_code
  ) values (
    class_id, teacher_id, 'B06 Approval Gate Test', 7, class_code
  );

  -- 1. A quest without a draft must not be published.
  begin
    insert into public.published_quest_versions (
      class_id, quest_id, quest_version_id,
      approved_by, public_payload
    ) values (
      class_id, quest_id, version_id,
      teacher_id, payload
    );

    raise exception 'Publication without draft succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_PUBLISH_NO_DRAFT_DENIED_PASS';

  -- Create a legitimate pending-review draft.
  insert into public.quest_review_drafts (
    class_id, quest_id, quest_version_id,
    submitted_by, public_payload
  ) values (
    class_id, quest_id, version_id,
    teacher_id, payload
  )
  returning id into draft_id;

  -- 2. Pending review is insufficient for publication.
  begin
    insert into public.published_quest_versions (
      class_id, quest_id, quest_version_id,
      approved_by, public_payload
    ) values (
      class_id, quest_id, version_id,
      teacher_id, payload
    );

    raise exception 'Pending draft was published';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_PUBLISH_PENDING_DENIED_PASS';

  -- The owning teacher approves the unchanged draft.
  update public.quest_review_drafts
  set status = 'approved',
      approved_by = teacher_id
  where id = draft_id;

  -- 3. A changed payload must not pass the approval gate.
  begin
    insert into public.published_quest_versions (
      class_id, quest_id, quest_version_id,
      approved_by, public_payload
    ) values (
      class_id, quest_id, version_id,
      teacher_id,
      jsonb_set(
        payload,
        '{scene_id}',
        '"school_corridor"'::jsonb
      )
    );

    raise exception 'Modified quest was published';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_PUBLISH_CHANGED_PAYLOAD_DENIED_PASS';

  -- 4. The exact approved payload may be published.
  insert into public.published_quest_versions (
    class_id, quest_id, quest_version_id,
    approved_by, public_payload
  ) values (
    class_id, quest_id, version_id,
    teacher_id, payload
  )
  returning id into publication_id;

  if not exists (
    select 1
    from public.published_quest_versions
    where id = publication_id
      and public_payload = payload
      and approved_by = teacher_id
  ) then
    raise exception 'Approved publication was not stored correctly';
  end if;

  raise notice 'B06_PUBLISH_APPROVED_IDENTICAL_PASS';

  -- 5. A published quest must remain immutable.
  begin
    update public.published_quest_versions
    set public_payload = jsonb_set(
      payload, '{scene_id}', '"school_corridor"'::jsonb
    )
    where id = publication_id;

    raise exception 'Published quest was modified';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    delete from public.published_quest_versions
    where id = publication_id;

    raise exception 'Published quest was deleted';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_PUBLISHED_IMMUTABLE_PASS';
  raise notice 'B06_PUBLICATION_APPROVAL_SECURITY_PASS';
end;
$test$;

rollback;