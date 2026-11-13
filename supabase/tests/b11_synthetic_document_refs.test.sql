-- B11: Verify synthetic C-04 document references are blocked.
-- Uses temporary table constraints; existing quest data is untouched.

begin;

create temporary table b11_document_probe (
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
          'c04_osis',
          'DOC-SYN-BI-OSIS-ANNOUNCEMENT-A',
          false
        ),
        (
          'c04_group_message',
          'DOC-SYN-BI-CLASS-GROUP-MESSAGE-B',
          false
        ),
        (
          'mixed_case',
          'doc-sYn-BI-OSIS-ANNOUNCEMENT-A',
          false
        ),
        (
          'normal_document',
          'DOC-PROD-B11-001',
          true
        )
    ) as cases(test_name, document_id, should_accept)
  loop
    payload := jsonb_build_object(
      'schema_version', '1.0',
      'quest_id', 'QUEST-B11-SAFE-001',
      'quest_version_id', 'QV-B11-SAFE-001',
      'objective_ids', jsonb_build_array('LO-B11-001'),
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
          'item_id', 'ITEM-B11-001'
        )
      ),
      'variants', jsonb_build_object(
        'needs_support', 'QVAR-B11-SUPPORT',
        'developing', 'QVAR-B11-DEVELOPING',
        'ready_for_extension', 'QVAR-B11-EXTENSION'
      )
    );

    if test_case.should_accept then
      insert into pg_temp.b11_document_probe (
        class_id,
        quest_id,
        quest_version_id,
        approved_by,
        public_payload
      )
      values (
        '00000000-0000-4000-8000-000000000001'::uuid,
        'QUEST-B11-SAFE-001',
        'QV-B11-SAFE-001',
        '00000000-0000-4000-8000-000000000002'::uuid,
        payload
      );

      accepted_count := accepted_count + 1;
      raise notice 'B11_NORMAL_DOCUMENT_ID_ACCEPTED_PASS';
    else
      begin
        insert into pg_temp.b11_document_probe (
          class_id,
          quest_id,
          quest_version_id,
          approved_by,
          public_payload
        )
        values (
          '00000000-0000-4000-8000-000000000001'::uuid,
          'QUEST-B11-SAFE-001',
          'QV-B11-SAFE-001',
          '00000000-0000-4000-8000-000000000002'::uuid,
          payload
        );

        raise exception
          'Synthetic document ID was accepted: %',
          test_case.test_name;
      exception
        when check_violation then
          get stacked diagnostics
            failed_constraint = constraint_name;

          if failed_constraint <> 'b11_no_synthetic_document_refs' then
            raise exception
              'Unexpected constraint for %: %',
              test_case.test_name,
              failed_constraint;
          end if;

          blocked_count := blocked_count + 1;
          raise notice
            'B11_%_BLOCKED_PASS',
            test_case.test_name;
      end;
    end if;
  end loop;

  if accepted_count <> 1 or blocked_count <> 3 then
    raise exception
      'Wrong results: % accepted, % blocked',
      accepted_count,
      blocked_count;
  end if;

  raise notice 'B11_SYNTHETIC_DOCUMENT_TEST_PASS';
end;
$test$;

rollback;