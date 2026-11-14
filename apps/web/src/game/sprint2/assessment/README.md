# PIC D — D-04 Async Assessment Adapter (mock-first)

This patch adds a separate asynchronous assessment port. It deliberately does **not** modify Sprint 0 `repositories-v1.ts`, `state-machine.ts`, QuestV1, or the existing Sprint 1 `QuestFlow`.

## Confirmed backend contract

- Submit: `POST /functions/v1/student-api/assessments/submit`
- Poll: `GET /functions/v1/student-api/assessments/{attempt_id}/result`
- Auth header: `x-student-access-code`
- Polling ends on `scored` or `insufficient_evidence`.
- No feedback is synthesized. Current result fields are `attempt_id`, `quest_version_id`, `status`, `score`, and `scored_at`.

## Safety / activation

- `MockAssessmentTransport` is for tests only and never performs network calls.
- `FetchAssessmentTransport` is provided as an explicit transport, but is not instantiated or wired into app routes by this patch.
- Endpoint URLs are injected/configurable; no live endpoint is enabled by default.
- `pollAssessmentResult` only calls GET for the existing `attempt_id`; it never resubmits POST.
- The caller must retain the original `idempotency_key` if it explicitly retries a failed POST. A `pending_scoring` response is **not** a reason to retry POST.
- This adapter is not yet wired into `QuestFlow` because the existing V1 port and state machine are intentionally unchanged pending a separately reviewed runtime integration.

## Add to project

Copy this `assessment` folder into:

`apps/web/src/game/sprint2/assessment/`

Then run from repository root:

```powershell
npm run typecheck -w apps/web
npm run test -w apps/web -- src/game/sprint2/assessment/assessment-adapter.test.ts
npm run lint -w apps/web
npm run build -w apps/web
```

The tests use Vitest and mocked transport only.
