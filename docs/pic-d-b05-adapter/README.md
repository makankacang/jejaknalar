# D-04: PIC D -> PIC B-05 student backend adapter

## Status per 13 November 2026

Ini adalah **PATCH ADDITIVE** untuk branch `feat/D-04-student-assessment-adapter` dan **bukan** pengganti seluruh repository. Semua file adalah path baru. Tidak menimpa `supabase/functions/student-api/index.ts`, `contracts/api.openapi.yaml`, `QuestGame.tsx`, atau game mock yang ada.

Audited from `D04_B05_CONTRACT_AUDIT.zip`, containing B-05 `student-api/index.ts`, `api.openapi.yaml`, and PIC D Sprint 2 assessment/state/QuestGame.

**Kontrak aktual B-05**:

| Route (under `/functions/v1/student-api`) | B-05 status | Outcome |
| --- | --- | --- |
| `POST /classes/:id/join` | 201 | session, access code, recovery token (shown once) |
| `GET /session` | 200 | validated student identity |
| `POST /assessments/submit` | 202 | `{attempt_id,status:"pending_scoring",replayed}` **NO SCORE** |
| `GET /checkpoints/:quest_version_id` | 200 | `{checkpoint:null}` or checkpoint |
| `PUT /checkpoints/:quest_version_id` | 200 | checkpoint with incremented `revision` |

Backend authentication: `X-Student-Access-Code` header; if gateway requires it, add **public** Supabase anon/publishable key to `apikey` + `Authorization: Bearer`. Never provide service-role or HMAC secrets to browser. `recovery_token` must be displayed once, then stored by user via appropriate recovery workflow; **this patch does not persist it**.

OpenAPI currently describes assessment `201 scored`, while B-05 implementation returns `202 pending_scoring`. This patch deliberately follows the deployed-code contract and MUST NOT be advertised as full scoring integration until team updates contract. Also `JoinClassRequest.class_code` in OpenAPI uses 6 chars but backend requires 8 chars (alphabet without confusing characters). GET `/session` and checkpoint endpoints are provisional and are not documented in OpenAPI.

## Install (PowerShell, from `D:\JEJAKNALAR\jejaknalar-pr-D04`)

Download and extract `JejakNalar_D04_B05_Adapter_PATCH.zip` into `D:\JEJAKNALAR\jejaknalar-pr-D04` using `Expand-Archive` or Windows Explorer. Keep path structure. The archive has **no `jejaknalar/` prefix**.

Verify before staging:

```powershell
cd D:\JEJAKNALAR\jejaknalar-pr-D04
git status -sb
npm run typecheck
npm run lint
npm test
npm run build
```

If tests or builds fail, do not commit. No backend/staging integration claim is made from unit tests.

## Minimal integration example (do not put credentials in source or storage)

```ts
import {
  InMemoryStudentCredential, StudentApiClient, StudentSessionApi,
  StudentAssessmentApi, StudentSubmitController, StudentCheckpointApi,
  type PublishedItemCatalog,
} from './backend-b05';

const code = new InMemoryStudentCredential();
const api = new StudentApiClient({
  baseUrl: 'https://YOUR-PROJECT.supabase.co/functions/v1/student-api',
  accessCode: code.get,
  publicApiKey: 'PUBLIC_ANON_KEY_IF_REQUIRED',
});
const sessions = new StudentSessionApi(api);
const assessments = new StudentSubmitController(new StudentAssessmentApi(api));
const checkpoints = new StudentCheckpointApi(api);

// Join: show recovery_token once to the student; NEVER log it.
// const issued = await sessions.join(validClassUuid, eightCharClassCode, displayName);
// code.set(issued.access_code);
// await sessions.session();

// catalog MUST come from the authority for that exact published quest version.
// The current D-03 local fixture is NOT authorized for production submission.
const catalog: PublishedItemCatalog = {
  origin: 'published-quest', quest_version_id: 'QV-EXAMPLE-001', item_ids: ['ITEM-FROM-PUBLISHED-QUEST'],
};
// After authority is available:
// assessments.prepare(catalog, [{ item_id: catalog.item_ids[0], value: 'student response' }]);
// const receipt = await assessments.submitOrRetry(); // status === pending_scoring
// No score, no feedback, no official BedaJalur until PIC B implements scoring.
void catalog; void sessions; void assessments; void checkpoints;
```

`PublishedItemCatalog` is a **client-side validation boundary, not cryptographic proof of publication**. Upstream authoritative quest/version/item mapping is still required. Never map `Q-001` -> `ITEM-001` automatically, or use `assessment-demo.fixture.json` as published authority. `new StudentApiClient(...)` intentionally rejects non-HTTPS hosts other than localhost and requires the full `/functions/v1/student-api` prefix.

## Checkpoint rules

- `GET`: `checkpoint: null` is a first-time student, not an error.
- `PUT`: first save uses `expected_revision: 0`, subsequent saves use the revision returned by the previous save/load.
- `409 CONFLICT`: **no silent overwrite**; load latest revision and reconcile. Keep changed UI state locally until resolved.
- Progress is **unverified UI state**, never academic evidence. `UiProgress` intentionally has no score, feedback, mastery, or answer key. After loading, validate world, registry version, room membership, collision and spawn in Phaser before accepting a position.
- `X-Student-Access-Code` never saved automatically. Session refresh requires a new entry/recovery mechanism supplied by PIC A/B.

## Boundaries / integration gates

1. B-05 currently returns **pending_scoring**, NOT `scored`/`score`/`feedback`/`next_path`. Do not call existing D-03 `AssessmentController` with this result; it accepts only simulated `scored` receipts. Keep current preview unchanged.
2. C5-02 remains open: published `quest_version_id` + `item_id` authority needed before real submission.
3. PIC B must implement authoritative scoring/status retrieval/feedback before the real `BedaJalur` path can change. `need_more_evidence` is not a fourth BedaJalur level.
4. Authenticated student entrypoint is not wired to `QuestGame.tsx` by this patch because session/join UX and official published quest availability are not in the supplied contract. This is an explicit integration boundary, not an implicit claim of feature completeness.
5. Backend source availability does not prove a deployed staging endpoint or a working student session.

## Git PR sequence

For per-feature commits, stage only each feature's files (see `docs/pic-d-b05-adapter/PUSH_PER_FITUR.md`). Keep D-03 as stacked PR base until D-03 enters develop.
