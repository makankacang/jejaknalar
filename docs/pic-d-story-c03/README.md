# D-05 — StoryAdapter C-03 (draft, preview-only)

Source: `origin/feat/C-03-quest-generator`, `contracts/story-bundle.schema.json`, `docs/C03_STORY_BUNDLE_CONTRACT_DRAFT_v0.1.md`, and PIC D school world v1.4.

## Important contract blockers

- C-03 Story Bundle `0.1-draft` is a proposal, not an approved public/student API.
- C-03 example registry `0.2.0-draft` is **not** D-03 `D-school-1.4-sprint2-1`. The bundled C-03 example uses `library` and synthetic NPC/object IDs, so it is intentionally rejected.
- D-03 game currently uses fixed task IDs and state reducer. This patch **does not inject** a dynamic story into `QuestGame.tsx`, change task progression, or claim complete integration.
- The adapter accepts an explicit scene allowlist and only registered world/NPC/task objects. Public item IDs are rejected unless explicitly allowlisted by a trusted caller.
- Source refs are checked for declared document versions, not against immutable C-01/C-02 source snapshots. This validation is necessary but not sufficient for student publish.
- `previewOnly: true` is mandatory. Never treat this plan as authorized official assessment content.

## Test

```powershell
cd D:\JEJAKNALAR\jejaknalar-pr-D05
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

## Next integration gate (requires PIC C/B alignment)

1. Agree on registry version and map C room/NPC/object IDs to D school world; do not silently rewrite IDs.
2. Approve `scene_id` and world combination, task renderer capabilities, and mission progression rules.
3. Define a published paired QuestV1 + Story Bundle payload and immutable source snapshot verification.
4. Add dynamic story runtime/UI integration as a separate reviewed commit, preserving existing proximity/collision rules.
5. Verify mobile 390x844 and story/objective HUD behavior separately.
