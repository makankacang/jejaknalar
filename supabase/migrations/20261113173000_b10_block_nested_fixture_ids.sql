-- B10: Reject fixture aliases anywhere inside a published QuestV1.
--
-- Recursive JSONPath checks nested string values, including:
-- objective_ids, steps.item_id, steps.ref, and variants.
--
-- This blocks fixture markers, but does NOT replace
-- backend-issued production identity mapping.

alter table public.published_quest_versions
  add constraint b10_no_nested_fixture_ids
  check (
    not jsonb_path_exists(
      public_payload,
      '$.** ? (@.type() == "string" && @ like_regex "(^|-)FIXTURE(-|$)" flag "i")'
    )
  );

comment on constraint b10_no_nested_fixture_ids
  on public.published_quest_versions is
  'Reject FIXTURE identity markers anywhere in the published QuestV1 JSON payload.';