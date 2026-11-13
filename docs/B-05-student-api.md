# B-05 — Student API, Assessment Persistence & Checkpoint

Status: Local integration tested; provisional API contract.
Branch: `feat/B-05-student-assessment`

## 1. Scope

B-05 provides:

- Anonymous student class join and session creation.
- Student access-code authentication.
- Server-side HMAC-SHA256 credential storage.
- Assessment submission persistence with idempotency.
- Gameplay checkpoint save/resume with optimistic revision control.
- Database access restrictions, basic join rate limiting, and local regression tests.

B-05 does **not** yet provide approved assessment scoring, feedback, adaptive BedaJalur decisions, or reassessment grading.

## 2. Base URL and authentication

Local base URL:

`http://127.0.0.1:54321/functions/v1/student-api`

Student endpoints use the `student-api` Edge Function, separately from the existing teacher `api` function.

`student-api` has `verify_jwt = false` because student join does not use a teacher JWT. Protected student endpoints authenticate server-side using:

`X-Student-Access-Code: <access_code>`

The student session identity is derived from the verified credential, not from a client-supplied `student_session_id`.

The service-role key and `STUDENT_CREDENTIAL_HMAC_KEY` must remain server-side. Never place them in frontend code or Git.

## 3. Join class

`POST /classes/{class_id}/join`

Request:

```json
{
  "class_code": "ABCD2345",
  "display_name": "Rina"
}
```

Successful response: HTTP `201`, envelope `{ "ok": true, "data": ..., "request_id": "..." }`.

The data contains `student_session_id`, `access_code`, `recovery_token`, `class_id`, and `class_name`.

The access code and recovery token are returned at creation; only their HMAC hashes are stored in the database.

Current database class codes have **8 characters**, while `contracts/api.openapi.yaml` still documents 6. This discrepancy requires team alignment.

Observed error cases include HTTP `404` for an incorrect code, `409` for an active duplicate student name, and `429` when the class budget is exceeded.

A database budget limits join attempts to 30 per 10-minute window for an existing class. It is not comprehensive HTTP-layer or per-IP protection.

## 4. Verify student session

`GET /session`

Required header: `X-Student-Access-Code`.

Successful response: HTTP `200`.

```json
{
  "ok": true,
  "data": {
    "student_session_id": "<uuid>",
    "class_id": "<uuid>",
    "display_name": "Rina"
  },
  "request_id": "<request-id>"
}
```

Missing, invalid, or revoked credentials return HTTP `401`. Credential hashes and raw credentials are not returned.

This endpoint is provisional and is not yet documented in the team OpenAPI contract.

## 5. Submit assessment — provisional

`POST /assessments/submit`

Required header: `X-Student-Access-Code`.

Request:

```json
{
  "quest_version_id": "QV-DEMO-001",
  "idempotency_key": "00000000-0000-4000-8000-000000000002",
  "answers": [
    {
      "item_id": "ITEM-001",
      "value": "Bukti dari teks"
    }
  ]
}
```

Current successful response: HTTP `202`.

```json
{
  "ok": true,
  "data": {
    "attempt_id": "<uuid>",
    "status": "pending_scoring",
    "replayed": false
  },
  "request_id": "<request-id>"
}
```

Idempotency is scoped to the authenticated student session.

The same idempotency key and identical payload return the original `attempt_id` with `replayed: true`. Reusing the key with a different payload returns HTTP `409`.

**Important:** this is not the final OpenAPI `201/scored` response. No score, feedback, or `next_path` is generated.

The endpoint currently checks identifier formats and answer structure, but does not verify that a quest is published or that its items belong to that quest. The C5-02 mapping is pending.

PIC D must not display `pending_scoring` as a completed assessment or infer a BedaJalur path from it.

## 6. Checkpoint / resume — provisional

`GET /checkpoints/{quest_version_id}`

Required header: `X-Student-Access-Code`.

Returns HTTP `200`, with `data.checkpoint: null` if no saved progress exists.

`PUT /checkpoints/{quest_version_id}`

Required header: `X-Student-Access-Code`.

Request:

```json
{
  "expected_revision": 0,
  "progress": {
    "state": "EXPLORING",
    "step": 1
  }
}
```

Successful response: HTTP `200`, containing:

- `checkpoint_id`
- `quest_version_id`
- `revision`
- `progress`
- `updated_at`

For initial creation, send revision `0`; the stored revision becomes `1`. For updates, use the latest returned revision.

A stale revision returns HTTP `409`. The client should GET the latest checkpoint and reconcile progress rather than blindly overwriting it.

Checkpoints are strictly **unverified gameplay UI progress**. They must not act as proof of scoring, mastery, or quest completion.

The GET/PUT checkpoint endpoints are not yet part of the team OpenAPI contract.

## 7. Local security and testing

Implemented and locally tested:

- Student access-code verification and revoked-session rejection.
- HMAC-SHA256 credential persistence.
- RLS and restricted database permissions.
- Assessment idempotency and isolation between students.
- Checkpoint compare-and-swap revision handling.
- Parallel HTTP request tests for assessment and checkpoint.
- Synthetic test-data cleanup.

Test files are under `supabase/tests/`. Local migrations are under `supabase/migrations/`.

The Edge Function uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `STUDENT_CREDENTIAL_HMAC_KEY`. The local HMAC environment file must never be committed.

## 8. Outstanding integration and production blockers

- Team approval of C5-02 mapping: published quest versions, item IDs, and their relationships.
- Approved scoring rubric, feedback, reassessment, and BedaJalur decisions.
- Alignment with OpenAPI response contracts and physical Edge Function routing.
- Recovery-token verification, rotation, and session restoration.
- HTTP/gateway rate limiting, abuse prevention, monitoring, and security review.
- Validation of gameplay checkpoint progress against an approved quest schema.
- Staging deployment, load testing, and end-to-end game integration with PIC D.

Do not describe B-05 as a completed authoritative learning-assessment system until these dependencies are resolved.
