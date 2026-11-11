# C-03 — Quest Generator Compatibility Scaffold

Status: **implemented as a schema/game-compatible scaffold; not yet an AI story generator.**

## Why this is scoped narrowly

The current `contracts/quest.schema.json` v1.0 allows only:

- `template: evidence_hunt`;
- `scene_id`;
- `read_document` and `select_evidence` steps;
- three variant IDs.

The inspected PIC D Sprint 1 implementation currently registers only `school_library`, with fixed references `DOC-001` and `ITEM-001`. NPC dialogue, document paragraphs, challenge prompt, and scene layout are stored in `apps/web/src/game/sprint1/content.ts`; they are not fields in Quest Schema v1.0.

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

The output is checked in tests against PIC D's `parseQuestV1` and `prepareEvidenceHunt` runtime preflight. The contract-level JSON Schema validation remains `npm run contract:lint`.

## Current limitations

- No generated story, NPC dialogue, document body, room/door layout, object catalog, or dynamic challenge prompt.
- No source-reference fields are copied into the quest. Provenance remains attached to Learning Objectives in backend storage and is reachable through `objective_ids` only if PIC B persists that relation.
- Only the fixed `school_library` scene and `DOC-001`/`ITEM-001` references are supported.
- No distinct reassessment item or per-objective assessment mapping. Current retry returns to the existing challenge flow.
- This is not yet a Gemini-backed C-03 model call. It is the contract-safe integration baseline while the story/content contract is unresolved.

## Next integration gate

Before dynamic AI content is implemented, PIC B/D/A must agree on a versioned content contract or Story Adapter boundary that defines: generated content payload, allowed scene/NPC/object IDs, document and evidence references, assessment item shape, reassessment/BedaJalur mapping, source provenance, and public/private fields. Do not add those fields to Quest Schema v1.0 without a reviewed contract change.
