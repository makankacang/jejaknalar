# C-02 — Async Analysis Job Handoff

Status: **PIC C integration handoff; job lifecycle and public API contract remain owned by PIC B.**

## 1. Scope and ownership

The asynchronous job is an API/backend orchestration concern. The existing Learning Analyzer is a server-side asynchronous function that PIC B can invoke from its Edge Function or worker:

```ts
const result = await analyzeLearningObjectives(input, model);
```

PIC C owns the analyzer core, prompt, Gemini model caller, output normalization, source-reference validation, and typed analyzer errors. PIC B owns request authentication, authorization, job creation and status, durable asynchronous execution mechanism, persistence, retries, quota/rate limits, API envelope, and the public status/result endpoint. PIC A consumes the public API and displays the job/result state.

C-02 must not create its own Edge Function endpoint, write directly to the database, or manage job state. This preserves the PRD contract and repository ownership boundaries.

## 2. Expected invocation sequence

1. Frontend sends the PRD request `module_id` + `text_version` to `POST /api/modules/analyze`.
2. PIC B authenticates the teacher and verifies module ownership.
3. PIC B creates or reuses an analysis job and resolves the exact immutable document snapshot for that `module_id` + `text_version`.
4. PIC B invokes `analyzeLearningObjectives(input, model)` with the C-01-compatible snapshot, matching `module_id` and `text_version`, and any permitted learning context.
5. On success, PIC B persists the analyzer result. PIC B assigns persistent Learning Objective IDs when saving objectives; the analyzer output intentionally has no permanent LO ID.
6. PIC B marks the job complete and exposes the result through the public API contract selected by PIC B.
7. PIC A reads job status/result and presents the objectives for teacher review. Teacher approval remains required before quest generation/publishing.

The `extractedText` and `sourceMap` passed to C-02 must belong to the same snapshot/version. See `C04_SOURCE_REFERENCE_VERSIONING.md`.

## 3. Distinguish job status from analyzer result status

These are separate concepts:

| Layer | Meaning | Values currently defined |
|---|---|---|
| Backend job lifecycle | Whether asynchronous work has started/finished | PIC B defines the persisted enum and transitions. Suggested logical states: `queued`, `processing`, `completed`, `failed`. |
| Analyzer result | Whether supported Learning Objectives were found | `completed`, `insufficient_evidence` |

`insufficient_evidence` is a successful analyzer execution with no sufficiently grounded objective. It is **not** a worker/job failure and should not be represented as a provider exception.

## 4. Error handoff from C-02 to PIC B

`analyzeLearningObjectives` rejects with `LearningAnalyzerError` for known analyzer/provider failures. The error exposes:

- `code`: stable internal error code;
- `message`: sanitized, user-safe summary;
- `retryable`: whether the failure is transient according to the analyzer/provider layer;
- `causeValue`: diagnostic cause for server-side logging only.

PIC B should catch the error at the worker boundary, persist a safe error code/state, and map it to the agreed API error envelope. Do not serialize or return `causeValue`, provider response bodies, API keys, or raw internal diagnostics to the browser. Do not treat every error as retryable; use `retryable` together with B's retry/attempt policy.

The existing internal codes and suggested API mapping are documented in `C02_LEARNING_OBJECTIVE_OUTPUT_PROPOSAL.md` and `contracts/error-codes.md`. Final public mapping remains PIC B's decision.

## 5. Public API detail still required from PIC B

The PRD specifies:

- `POST /api/modules/analyze` request minimum: `module_id` + `text_version`;
- response minimum: `analysis_job_id`;
- access: teacher who owns the module.

The PRD does not yet specify how clients retrieve job status and the completed result. Before A integrates polling/result display, PIC B should add the selected status/result retrieval operation to `contracts/api.openapi.yaml` and provide public response fixtures. The exact route, polling interval, and response shape are intentionally not prescribed by PIC C in this handoff.

The API must retain the project's standard response envelope:

```json
{ "ok": true, "data": {}, "request_id": "req-..." }
```

or the corresponding standard failure envelope. `analysis_job_id` is backend-generated and must not be replaced with a client-generated identifier.

## 6. Retry, cache, and persistence boundaries

- PIC B owns durable job creation, claiming, status transitions, and persistence. Do not rely on a detached in-memory promise in a request handler as durable background execution.
- PIC B owns the cache/deduplication policy for a module text version, including how it accounts for analyzer/schema/prompt changes.
- A retry must not create duplicate persisted Learning Objectives. Persistence should be idempotent or transactional at the backend boundary.
- Retry transient failures only under B's attempt/timeout policy. Invalid input, missing text, or malformed non-retryable output should be surfaced for correction or controlled failure rather than retried indefinitely.
- C-02 itself performs one model call per analyzer invocation; it does not run a job queue, persist results, cache outputs, or automatically retry.

## 7. Minimal handoff checklist

### PIC B

- [ ] Confirm the exact snapshot lookup for `module_id` + `text_version`.
- [ ] Own the durable job lifecycle, asynchronous execution mechanism, and status transitions.
- [ ] Add a status/result retrieval operation to OpenAPI; publish success and failure fixtures.
- [ ] Catch `LearningAnalyzerError`, map safe errors, and keep diagnostic causes server-side.
- [ ] Persist result idempotently and assign persistent LO IDs.
- [ ] Apply authentication, module ownership checks, rate limits, cache policy, and server-only Gemini secrets.

### PIC C

- [x] Export `analyzeLearningObjectives` and `LearningAnalyzerError` from the shared analyzer module.
- [x] Keep analyzer free of database, authentication, endpoint, and job lifecycle responsibilities.
- [x] Return typed analyzer errors with retryability metadata.
- [x] Preserve C3 output and C4 source-reference/version validation.

### PIC A

- [ ] Consume the status/result contract after PIC B publishes it.
- [ ] Show pending/processing, successful result, insufficient evidence, and failed/retryable states distinctly.
- [ ] Keep teacher review/edit/approval before quest generation.

### PIC D

- No C-02 async job change is required.

