-- B10: Prevent synthetic C-04 fixture identities from being
-- published as real quest identities.
--
-- Fixture-only drafts may still be used for local contract testing.
-- Production ID mapping must be completed before publication.

alter table public.published_quest_versions
  add constraint b10_no_fixture_quest_identity
  check (
    quest_id !~* '(^|-)FIXTURE(-|$)'
    and quest_version_id !~* '(^|-)FIXTURE(-|$)'
  );

comment on constraint b10_no_fixture_quest_identity
  on public.published_quest_versions is
  'Reject C-04 fixture aliases in published quest identities. Does not replace backend ID assignment.';