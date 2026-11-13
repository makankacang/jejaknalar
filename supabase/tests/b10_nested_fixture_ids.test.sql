-- B10: Verify nested fixture identities cannot be published.
-- Uses temporary table constraints, leaving existing data untouched.

begin;

create temporary table b10_nested_probe (
  like public.published_quest_versions
    including defaults
    including constraints
) on commit drop;

do $test$
declare
  test_case record;
  payload jsonb;
  failed_constraint text;
  accepted_count integer := 0;
  blocked_count integer := 0;
begin
  for test_case in
    select *
    from (
      values
        (
          'normal',
          'LO-B10-001',
          'ITEM-B10-001',
          'QVAR-B10-001',
          'DOC-B10-001',
          true
        ),
        (
          'objective',
          'LO-FIXTURE-B10-001',
          'ITEM-B10-001',
          'QVAR-B10-001',
          'DOC-B10-001',
          false
        ),
        (
          'item',
          'LO-B10-001',
          'ITEM-FIXTURE-B10-001',
          'QVAR-B10-001',
          'DOC-B10-001',
          false
        ),
        (
          'variant',
          'LO-B10-001',
          'ITEM-B10-001',
          'QVAR-FIXTURE-B10-001',
          'DOC-B10-001',
          false
        ),
        (
          'source_ref',
          'LO-B10-001',
          'ITEM-B10-001',
          'QVAR-B10-001',
          'DOC-FIXTURE-B10-001',
          false
        ),
        (
          'mixed_case',
          'LO-B10-001',
          'ITEM-B10-001',
          'QVAR-B10-001',
          'DOC-fIxTuRe-B10-001',
          false
        )
    ) as cases(
      test_name,
      objective_id,
      item_id,
      variant_id,
      document_id,
      should_accept
    )
  loop
    payload := jsonb_build_object(
      'schema_version', '1.0',
      'quest_id', 'QUEST-B10-SAFE-101',
      'quest_version_id', 'QV-B10-SAFE-101',
      'objective_ids', jsonb_build_array(test_case.objective_id),
      'template', 'evidence_hunt',
      'scene_id', 'school.library',
      'steps', jsonb_build_array(
        jsonb_build_object(
          'id', 'read-source-a',
          'type', 'read_document',
          'ref', test_case.document_id
        ),
        jsonb_build_object(
          'id', 'submit-answer',
          'type', 'select_evidence',
          'item_id', test_case.item_id
        )
      ),
      'variants', jsonb_build_object(
        'needs_support', test_case.variant_id
      )
    );

    if test_case.should_accept then
      insert into pg_temp.b10_nested_probe (
        class_id,
        quest_id,
        quest_version_id,
        approved_by,
        public_payload
      )
      values (
        '00000000-0000-4000-8000-000000000001'::uuid,
        'QUEST-B10-SAFE-101',
        'QV-B10-SAFE-101',
        '00000000-0000-4000-8000-000000000002'::uuid,
        payload
      );

      accepted_count := accepted_count + 1;
      raise notice 'B10_NORMAL_NESTED_IDS_ACCEPTED_PASS';
    else
      begin
        insert into pg_temp.b10_nested_probe (
          class_id,
          quest_id,
          quest_version_id,
          approved_by,
          public_payload
        )
        values (
          '00000000-0000-4000-8000-000000000001'::uuid,
          'QUEST-B10-SAFE-101',
          'QV-B10-SAFE-101',
          '00000000-0000-4000-8000-000000000002'::uuid,
          payload
        );

        raise exception
          'Nested fixture identity was accepted: %',
          test_case.test_name;
      exception
        when check_violation then
          get stacked diagnostics
            failed_constraint = constraint_name;

          if failed_constraint <> 'b10_no_nested_fixture_ids' then
            raise exception
              'Unexpected constraint for %: %',
              test_case.test_name,
              failed_constraint;
          end if;

          blocked_count := blocked_count + 1;
          raise notice
            'B10_NESTED_%_BLOCKED_PASS',
            test_case.test_name;
      end;
    end if;
  end loop;

  if accepted_count <> 1 or blocked_count <> 5 then
    raise exception
      'Incorrect result: % accepted, % blocked',
      accepted_count,
      blocked_count;
  end if;

  raise notice 'B10_NESTED_FIXTURE_TEST_PASS';
end;
$test$;

rollback;