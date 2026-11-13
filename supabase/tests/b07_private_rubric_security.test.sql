-- B07: Private rubric security regression.
-- All synthetic data is rolled back.

begin;

do $test$
declare
  teacher_a uuid := gen_random_uuid();
  teacher_b uuid := gen_random_uuid();
  class_a uuid := gen_random_uuid();
  rubric_id uuid;

  quest_id text := 'QUEST-B07-RUBRIC-TEST';
  version_id text := 'QV-B07-RUBRIC-TEST';

  class_code text := upper(translate(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    '01', '23'
  ));

  quest_payload jsonb;
  rubric_spec jsonb;
begin
  -- Browser roles must have no direct access.
  if has_table_privilege(
    'anon', 'public.assessment_rubric_versions', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.assessment_rubric_versions', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.assessment_rubric_versions', 'INSERT'
  ) then
    raise exception 'Private rubric is accessible by client roles';
  end if;

  if not has_table_privilege(
    'service_role', 'public.assessment_rubric_versions', 'SELECT'
  ) or not has_table_privilege(
    'service_role', 'public.assessment_rubric_versions', 'INSERT'
  ) then
    raise exception 'Backend rubric permissions are missing';
  end if;

  raise notice 'B07_RUBRIC_ACCESS_CONTROL_PASS';

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at
  ) values
  (
    '00000000-0000-0000-0000-000000000000',
    teacher_a, 'authenticated', 'authenticated',
    'b07-a-' || teacher_a || '@example.test',
    '', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    teacher_b, 'authenticated', 'authenticated',
    'b07-b-' || teacher_b || '@example.test',
    '', now(), now(), now()
  );

  insert into public.classes (
    id, teacher_uid, name, grade, class_code
  ) values (
    class_a, teacher_a, 'B07 Rubric Security Test',
    7, class_code
  );

  quest_payload := jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', quest_id,
    'quest_version_id', version_id,
    'objective_ids', jsonb_build_array('LO-B07-TEST'),
    'template', 'evidence_hunt',
    'scene_id', 'school_library',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'evidence-01',
        'type', 'select_evidence',
        'item_id', 'ITEM-B07-001'
      )
    ),
    'variants', jsonb_build_object(
      'needs_support', 'QVAR-S',
      'developing', 'QVAR-D',
      'ready_for_extension', 'QVAR-E'
    )
  );

  rubric_spec := jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object(
        'item_id', 'ITEM-B07-001',
        'objective_id', 'LO-B07-TEST',
        'answer_key', 'PRIVATE-TEST-ANSWER',
        'max_points', 10
      )
    )
  );

  -- Create and approve a draft before publishing.
  insert into public.quest_review_drafts (
    class_id, quest_id, quest_version_id,
    submitted_by, public_payload
  ) values (
    class_a, quest_id, version_id,
    teacher_a, quest_payload
  );

  update public.quest_review_drafts
  set status = 'approved',
      approved_by = teacher_a
  where quest_version_id = version_id;

  insert into public.published_quest_versions (
    class_id, quest_id, quest_version_id,
    approved_by, public_payload
  ) values (
    class_a, quest_id, version_id,
    teacher_a, quest_payload
  );

  -- Another teacher cannot register the rubric.
  begin
    insert into public.assessment_rubric_versions (
      quest_version_id, revision,
      registered_by, private_spec
    ) values (
      version_id, 1, teacher_b, rubric_spec
    );

    raise exception 'Foreign teacher registered a rubric';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B07_RUBRIC_FOREIGN_TEACHER_DENIED_PASS';

  -- The owning teacher may register a private rubric.
  insert into public.assessment_rubric_versions (
    quest_version_id, revision,
    registered_by, private_spec
  ) values (
    version_id, 1, teacher_a, rubric_spec
  )
  returning id into rubric_id;

  if not exists (
    select 1
    from public.assessment_rubric_versions
    where id = rubric_id
      and revision = 1
      and private_spec = rubric_spec
  ) then
    raise exception 'Private rubric was not stored correctly';
  end if;

  raise notice 'B07_RUBRIC_OWNER_REGISTRATION_PASS';

    -- B07: Reject private rubrics that do not match
  -- the published quest's items and objectives.
  declare
    v_test record;
  begin
    for v_test in
      select *
      from (
        values
          (
            'UNKNOWN_ITEM',
            jsonb_set(
              rubric_spec,
              '{items,0,item_id}',
              to_jsonb('ITEM-UNKNOWN'::text)
            )
          ),
          (
            'UNKNOWN_OBJECTIVE',
            jsonb_set(
              rubric_spec,
              '{items,0,objective_id}',
              to_jsonb('LO-UNKNOWN'::text)
            )
          ),
          (
            'ZERO_MAX_POINTS',
            jsonb_set(
              rubric_spec,
              '{items,0,max_points}',
              to_jsonb(0)
            )
          ),
          (
            'DUPLICATE_ITEMS',
            jsonb_set(
              rubric_spec,
              '{items}',
              (rubric_spec -> 'items') || (rubric_spec -> 'items')
            )
          ),
          (
            'EMPTY_ITEMS',
            jsonb_set(
              rubric_spec,
              '{items}',
              '[]'::jsonb
            )
          )
      ) as cases(case_name, bad_spec)
    loop
      begin
        insert into public.assessment_rubric_versions (
          quest_version_id,
          revision,
          registered_by,
          private_spec
        )
        values (
          version_id,
          2,
          teacher_a,
          v_test.bad_spec
        );

        raise exception
          'Invalid rubric was accepted: %',
          v_test.case_name;
      exception
        when sqlstate '22023' then
          raise notice
            'B07_RUBRIC_%_DENIED_PASS',
            v_test.case_name;
      end;
    end loop;
  end;

  -- The same revision cannot be registered twice.
  begin
    insert into public.assessment_rubric_versions (
      quest_version_id, revision,
      registered_by, private_spec
    ) values (
      version_id, 1, teacher_a, rubric_spec
    );

    raise exception 'Duplicate rubric revision was accepted';
  exception
    when unique_violation then null;
  end;

  raise notice 'B07_RUBRIC_REVISION_UNIQUE_PASS';

  -- Rubric contents are immutable.
  begin
    update public.assessment_rubric_versions
    set private_spec = '{}'::jsonb
    where id = rubric_id;

    raise exception 'Rubric modification succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    delete from public.assessment_rubric_versions
    where id = rubric_id;

    raise exception 'Rubric deletion succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  raise notice 'B07_RUBRIC_IMMUTABLE_PASS';
  raise notice 'B07_PRIVATE_RUBRIC_SECURITY_PASS';
end;
$test$;

rollback;