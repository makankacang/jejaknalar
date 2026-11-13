-- B06: Quest review security regression test.
-- All synthetic data is rolled back.

begin;

do $test$
declare
  teacher_a uuid := gen_random_uuid();
  teacher_b uuid := gen_random_uuid();
  class_a uuid := gen_random_uuid();
  draft_id uuid;

  code_a text := upper(translate(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    '01', '23'
  ));

  payload jsonb := jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', 'QUEST-B06-REVIEW-TEST',
    'quest_version_id', 'QV-B06-REVIEW-TEST',
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
begin
  -- No direct browser/client access.
  if has_table_privilege(
    'anon', 'public.quest_review_drafts', 'SELECT'
  ) or has_table_privilege(
    'anon', 'public.quest_review_drafts', 'INSERT'
  ) or has_table_privilege(
    'authenticated', 'public.quest_review_drafts', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.quest_review_drafts', 'UPDATE'
  ) then
    raise exception 'Client privileges are too broad';
  end if;

  raise notice 'B06_REVIEW_CLIENT_ACCESS_DENIED_PASS';

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at
  ) values
  (
    '00000000-0000-0000-0000-000000000000',
    teacher_a, 'authenticated', 'authenticated',
    'b06-review-a@example.test',
    '', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    teacher_b, 'authenticated', 'authenticated',
    'b06-review-b@example.test',
    '', now(), now(), now()
  );

  insert into public.classes (
    id, teacher_uid, name, grade, class_code
  ) values (
    class_a, teacher_a, 'B06 Review Test', 7, code_a
  );

  -- A draft must not start in approved status.
  begin
    insert into public.quest_review_drafts (
      class_id, quest_id, quest_version_id,
      submitted_by, public_payload,
      status, approved_by, approved_at
    ) values (
      class_a,
      'QUEST-B06-REVIEW-TEST',
      'QV-B06-REVIEW-TEST',
      teacher_a,
      payload,
      'approved',
      teacher_a,
      now()
    );

    raise exception 'Pre-approved insert unexpectedly succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_REVIEW_NO_DIRECT_APPROVAL_PASS';

  -- A different teacher cannot submit for this class.
  begin
    insert into public.quest_review_drafts (
      class_id, quest_id, quest_version_id,
      submitted_by, public_payload
    ) values (
      class_a,
      'QUEST-B06-REVIEW-TEST',
      'QV-B06-REVIEW-TEST',
      teacher_b,
      payload
    );

    raise exception 'Foreign teacher submission succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_REVIEW_CLASS_OWNERSHIP_PASS';

  -- Legitimate draft starts pending review.
  insert into public.quest_review_drafts (
    class_id, quest_id, quest_version_id,
    submitted_by, public_payload
  ) values (
    class_a,
    'QUEST-B06-REVIEW-TEST',
    'QV-B06-REVIEW-TEST',
    teacher_a,
    payload
  )
  returning id into draft_id;

  if not exists (
    select 1
    from public.quest_review_drafts
    where id = draft_id
      and status = 'pending_review'
      and approved_by is null
  ) then
    raise exception 'Draft initial state invalid';
  end if;

  raise notice 'B06_REVIEW_PENDING_DRAFT_PASS';

  -- Another teacher cannot approve it.
  begin
    update public.quest_review_drafts
    set status = 'approved',
        approved_by = teacher_b
    where id = draft_id;

    raise exception 'Foreign teacher approval succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_REVIEW_FOREIGN_APPROVAL_DENIED_PASS';

  -- The teacher cannot alter content during approval.
  begin
    update public.quest_review_drafts
    set status = 'approved',
        approved_by = teacher_a,
        public_payload = jsonb_set(
          payload,
          '{scene_id}',
          '"school_corridor"'::jsonb
        )
    where id = draft_id;

    raise exception 'Content modification during approval succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_REVIEW_CONTENT_IMMUTABLE_PASS';

  -- The owning teacher can approve the unchanged draft.
  update public.quest_review_drafts
  set status = 'approved',
      approved_by = teacher_a
  where id = draft_id;

  if not exists (
    select 1
    from public.quest_review_drafts
    where id = draft_id
      and status = 'approved'
      and approved_by = teacher_a
      and approved_at is not null
      and public_payload = payload
  ) then
    raise exception 'Legitimate approval failed';
  end if;

  raise notice 'B06_REVIEW_OWNER_APPROVAL_PASS';

  -- An approved draft cannot be approved twice or modified.
  begin
    update public.quest_review_drafts
    set status = 'approved'
    where id = draft_id;

    raise exception 'Approved draft was modified';
  exception
    when sqlstate '42501' then null;
  end;

  -- Deletion must also be rejected.
  begin
    delete from public.quest_review_drafts
    where id = draft_id;

    raise exception 'Draft deletion succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B06_REVIEW_APPROVED_IMMUTABLE_PASS';
  raise notice 'B06_REVIEW_SECURITY_PASS';
end;
$test$;

rollback;