# PIC C code handoff — BI8 Misi Redaksi

Status artefak: **candidate implementation / teacher review pending / source-map staging verification pending**.

## Repository additions

- `supabase/functions/_shared/ai/quest-generator/examples/bi8/questv1_bi8_candidate.json`
- `supabase/functions/_shared/ai/quest-generator/examples/bi8/story_bundle_draft_v01.json`
- `supabase/functions/_shared/ai/quest-generator/examples/bi8/student_presentation.json`
- `supabase/functions/_shared/ai/quest-generator/examples/bi8/paired_binding_v2.json`
- `supabase/functions/_shared/ai/quest-generator/examples/bi8/registry_mapping.json`
- `supabase/functions/_shared/ai/quest-generator/examples/bi8/source_manifest.test.json`
- `supabase/functions/_shared/ai/quest-generator/bi8-candidate.test.ts`
- `scripts/validate-bi8-pic-c.mjs`

The private rubric and scoring vectors are deliberately not copied into `apps/web` or the public repository patch. Share the separate backend-only archive with PIC B over the team's approved private channel.

## Locked identity from PIC B

- Quest: `QUEST-BI8-B1S5-REDAKSI-001`
- Approved draft: `b0b973e1-ea14-423d-9b9c-c935b8f895ff`
- Provisional version: `QV-BI8-B1S5-REDAKSI-001` (not published)
- Objective: `LO-8A857C13-422A-4C5B-AD8A-8403955C067E`
- Step: `submit-bi8-classification` (`select_evidence`)
- Item: `ITEM-BI8-B1S5-REDAKSI-KLASIFIKASI-001`
- Document: `doc_a305829d3917b4ca`
- Text version: `1c8e29fe-698d-4d6c-ad2b-ff178de1ace2`

One item contains six labeled response parts. Partial answers are allowed. The public UI may validate serialization/completeness hints but must not evaluate correctness.

## Local source evidence and limitation

The supplied local `DocumentParseResult.json` has the same `documentId` as the staging document and contains all three locators with exact excerpts:

- `DOC-P-559`: concept explanation.
- `DOC-P-599`: Sepeda Mira paragraph.
- `DOC-P-596`: Sepeda Motor paragraph.

The parser result does not carry the `text_version` from the staging lock. Consequently, local text/source references can be verified syntactically, but PIC B must still resolve each locator against the authoritative staging snapshot and confirm the exact text version. Do not mark this gate PASS based only on this test.

## Academic approval

- Paragraph A: proposed classification `Deskripsi`.
- Paragraph B: proposed classification `Eksposisi`, pending explicit teacher approval.

The assessment covers classification, text evidence, and reasoning. The full Learning Objective also mentions writing both types of paragraph, so this assessment alone does not evidence the whole objective.

## Registry and runtime compatibility

The candidate uses the code-side registry pin previously seen in D's audit, `D-school-1.4-sprint2-1`. The supplied registry export declares `1.4-mock-complete` and `DESIGN_MOCK_NOT_PRODUCTION`. D must confirm the final merged runtime registry pin and that every room/NPC/object is supported. `school_library` (QuestV1 scene ID) is not assumed to equal `school.library` (Story Bundle world room ID).

The paired-binding manifest is a contract proposal for the additive Student Runtime adapter. It does not claim the legacy demo renderer can already play this candidate. Runtime/E2E remains D's gate.

## Validation commands

From repository root:

```powershell
node scripts/validate-bi8-pic-c.mjs
deno lint supabase/functions/_shared/ai/quest-generator/
deno check supabase/functions/_shared/ai/quest-generator/
deno test supabase/functions/_shared/ai/quest-generator/
npm run typecheck
npm run lint
npm run test
npm run build
npm run contract:lint
```

The new Deno test validates the Story Bundle candidate against the current generator validator and local source excerpts. The Node validation script validates both JSON files against the repository's QuestV1 and Story Bundle schemas, the locked identities, paired binding, six response fields, local provenance, and public/private boundary.

A passing local test does not equal staging source-map verification, Published Quest, live AI completion, or Student E2E.

## PIC ownership after handoff

- PIC C: generator, source-safe candidate, Story Bundle/presentation content, validation tests and AI contract.
- PIC B: staging source-map resolution, final LO identity authorization, private rubric registration, evaluator, worker, scoring finalization, publication.
- PIC D: registry runtime confirmation, Student adapter/renderer, demo UI, browser QA and E2E.
- PIC A/teacher: approve Paragraph B classification and the final academic content.
