-- B11: Reject synthetic C-04 document references in published QuestV1.
--
-- Known synthetic examples:
-- DOC-SYN-BI-OSIS-ANNOUNCEMENT-A
-- DOC-SYN-BI-CLASS-GROUP-MESSAGE-B
--
-- Check only steps[].ref, where QuestV1 read_document
-- references are stored. Case-insensitive DOC-SYN- prefix.
--
-- This does not validate whether production document IDs
-- exist in the backend document registry.

alter table public.published_quest_versions
  add constraint b11_no_synthetic_document_refs
  check (
    not jsonb_path_exists(
      public_payload,
      '$.steps[*].ref ? (@.type() == "string" && @ like_regex "^DOC-SYN-" flag "i")'
    )
  );

comment on constraint b11_no_synthetic_document_refs
  on public.published_quest_versions is
  'Reject DOC-SYN- synthetic document references in published QuestV1 steps.';