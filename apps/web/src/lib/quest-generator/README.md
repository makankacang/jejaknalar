# C-03 — Quest Generator Compatibility Scaffold

Status: **implemented as a schema/game-compatible scaffold; not yet an AI story generator.**

## Why this is scoped narrowly

The current `contracts/quest.schema.json` v1.0 allows only:

- `template: evidence_hunt`;
- `scene_id`;
- `read_document` and `select_evidence` steps;
- three variant IDs.

The PIC D v0.2 handoff clarifies two separate profiles: `library_evening` is playable only for the exact local Episode 01 fixture, while `school_library` is accepted for static C-03 compatibility preview only (not a dynamic student episode). The C-03 scaffold still uses the fixed `DOC-001` and `ITEM-001` references. NPC dialogue, document paragraphs, challenge prompt, and scene layout are stored in `apps/web/src/game/sprint1/content.ts`; they are not fields in Quest Schema v1.0.

The generator therefore builds a deterministic compatibility scaffold. It does not call Gemini to invent content that the current public contract cannot carry. The backend must supply persistent quest IDs and teacher-approved LO IDs.

## Usage

```ts
const result = generateCompatibleQuestDraft({
  identity: {
    quest_id: 'QUEST-GENERATED-001',
    quest_version_id: 'QV-GENERATED-001',
  },
  objectives: [
    { id: 'LO-BAHASA-001', statement: 'Siswa mampu mengidentifikasi informasi penting.' },
  ],
});

// Send only result.quest to the public Quest Schema v1.0 validator/API.
// result.warnings and generation_mode are internal diagnostics.
```

The output is checked in tests against PIC D's `parseQuestV1` and `prepareEvidenceHunt` compatibility preflight. This test does not establish general Story Adapter support or student-mode playability. The contract-level JSON Schema validation remains `npm run contract:lint`.

## Current limitations

- No generated story, NPC dialogue, document body, room/door layout, object catalog, or dynamic challenge prompt.
- No source-reference fields are copied into the quest. Provenance remains attached to Learning Objectives in backend storage and is reachable through `objective_ids` only if PIC B persists that relation.
- Only the fixed `school_library` static preview scaffold and `DOC-001`/`ITEM-001` references are supported; this is not the `library_evening` Episode 01 playable profile.
- No distinct reassessment item or per-objective assessment mapping. Current retry returns to the existing challenge flow.
- This is not yet a Gemini-backed C-03 model call. It is the contract-safe integration baseline while the story/content contract is unresolved.

## Next integration gate

Before dynamic AI content is implemented, PIC B/D/A must agree on a versioned content contract or Story Adapter boundary that defines: generated content payload, allowed scene/NPC/object IDs, document and evidence references, assessment item shape, reassessment/BedaJalur mapping, source provenance, and public/private fields. Do not add those fields to Quest Schema v1.0 without a reviewed contract change.

## Story Bundle v0.1 proposal

A separate Story Bundle draft contract is now documented at `docs/C03_STORY_BUNDLE_CONTRACT_DRAFT_v0.1.md`, with its JSON Schema at `contracts/story-bundle.schema.json` and TypeScript mirror under `story-bundle/`. It is proposal-only and does not change Quest Schema v1.0 or make the current RPG v4 adapter capable of playing dynamic bundles.

The draft uses `activity_id` (not the earlier `task_id` proposal) to align with C5 ID decisions, models `evidence_id` as a separate entity, and leaves `public_item_ids` optional while `ITEM-001` versus `Q-001` remains unresolved. PIC D review is required before treating this as a shared/final contract.
