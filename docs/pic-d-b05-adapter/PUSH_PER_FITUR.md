# D-04 - staging dan commit terpisah per fitur

From `D:\JEJAKNALAR\jejaknalar-pr-D04`, after extracting patch and verifying tests:

```powershell
# D-04A: HTTP + Session (no data write to backend)
git add -- apps/web/src/game/sprint2/backend-b05/client.ts apps/web/src/game/sprint2/backend-b05/session.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(pic-d): add B-05 student session HTTP boundary"

# D-04B: 202 pending assessment, retry, idempotency
git add -- apps/web/src/game/sprint2/backend-b05/assessment.ts
git diff --cached --check
git commit -m "feat(pic-d): support B-05 pending assessment submissions"

# D-04C: optimistic-revision checkpoint
git add -- apps/web/src/game/sprint2/backend-b05/checkpoint.ts
git diff --cached --check
git commit -m "feat(pic-d): add B-05 UI checkpoint adapter"

# D-04D: public exports, test and contract documentation
git add -- apps/web/src/game/sprint2/backend-b05/index.ts apps/web/src/game/sprint2/backend-b05/backend-b05.test.ts docs/pic-d-b05-adapter/README.md docs/pic-d-b05-adapter/PUSH_PER_FITUR.md
git diff --cached --check
git commit -m "test(pic-d): cover B-05 API contract and safety boundaries"

# Only after checks and review of staged files:
git push -u origin feat/D-04-student-assessment-adapter
```

The tests are committed last but should be run BEFORE committing any feature. Do not stage `supabase/functions`, `contracts`, `apps/web/src/game/sprint2/assessment.ts`, or any D-05 PIC C fixture. If a command fails, STOP. There is no automatic push or merge.

**Pull request:** target `feat/D-03-school-world` while D-03 is not yet part of develop; otherwise target `develop`. Expected scope: pure frontend adapter, not scoring integration and not live game UI integration.
