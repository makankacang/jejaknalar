-- B10: Verify published quest identity constraints.
-- Uses a temporary copy of the real table's CHECK constraints.
-- Does not modify production or existing local quest records.

begin;

create temporary table b10_publication_probe (
  like public.published_quest_versions
    including defaults
    including constraints
) on commit drop;

do $test$
declare
  test_case record;
  payload jsonb;
  failed_constraint text;
  trigger_enabled boolean;
begin
  for test_case in
    select *
    from (
      values
        ('normal', 'QUEST-B10-SAFE-001', 'QV-B10-SAFE-001', true),
        ('fixture_quest', 'QUEST-FIXTURE-C04-001', 'QV-B10-SAFE-002', false),
        ('fixture_version', 'QUEST-B10-SAFE-003', 'QV-FIXTURE-C04-001', false),
        ('fixture_both', 'QUEST-FIXTURE-C04-002', 'QV-FIXTURE-C04-002', false)
    ) as cases(name, quest_id, quest_version_id, should_accept)
  loop
    payload := jsonb_build_object(
      'schema_version', '1.0',
      'quest_id', test_case.quest_id,
      'quest_version_id', test_case.quest_version_id,
      'objective_ids', jsonb_build_array(),
      'template', 'evidence_hunt',
      'scene_id', 'school.library',
      'steps', jsonb_build_array(),
      'variants', jsonb_build_object()
    );

    if test_case.should_accept then
      insert into pg_temp.b10_publication_probe (
        class_id,
        quest_id,
        quest_version_id,
        approved_by,
        public_payload
      )
      values (
        '00000000-0000-4000-8000-000000000001'::uuid,
        test_case.quest_id,
        test_case.quest_version_id,
        '00000000-0000-4000-8000-000000000002'::uuid,
        payload
      );

      raise notice 'B10_NORMAL_ID_ACCEPTED_PASS';
    else
      begin
        insert into pg_temp.b10_publication_probe (
          class_id,
          quest_id,
          quest_version_id,
          approved_by,
          public_payload
        )
        values (
          '00000000-0000-4000-8000-000000000001'::uuid,
          test_case.quest_id,
          test_case.quest_version_id,
          '00000000-0000-4000-8000-000000000002'::uuid,
          payload
        );

        raise exception 'Fixture identity was accepted: %', test_case.name;
      exception
        when check_violation then
          get stacked diagnostics
            failed_constraint = constraint_name;

          if failed_constraint <> 'b10_no_fixture_quest_identity' then
            raise exception
              'Unexpected constraint for %: %',
              test_case.name,
              failed_constraint;
          end if;

          raise notice 'B10_FIXTURE_%_BLOCKED_PASS', test_case.name;
      end;
    end if;
  end loop;

  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'published_quest_versions'
      and t.tgname = 'b06_guard_published_quest_trigger'
      and t.tgenabled in ('O', 'A')
      and not t.tgisinternal
  )
  into trigger_enabled;

  if not trigger_enabled then
    raise exception 'B06 publication immutability trigger is missing or disabled';
  end if;

  raise notice 'B10_PUBLICATION_TRIGGER_ENABLED_PASS';
  raise notice 'B10_FIXTURE_PUBLICATION_TEST_PASS';
end;
$test$;

rollback;