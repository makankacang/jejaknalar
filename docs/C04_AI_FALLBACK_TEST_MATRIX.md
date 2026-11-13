# C-04 AI Fallback and Cache Acceptance Test Matrix

**Status:** PIC C test specification for PIC B worker/API/database integration.
**Purpose:** Define observable acceptance behavior without implementing backend orchestration in PIC C.

## 1. Test boundaries

| Test layer | Owner | What it verifies |
|---|---|---|
| Provider adapter unit tests | PIC C | HTTP/error normalization, timeout behavior, no hidden retries |
| Fallback orchestration tests | PIC B, using this matrix | Candidate selection, fallback eligibility, attempt limits, deadlines |
| Quota persistence tests | PIC B | Atomic reservation, idempotency, enforcement, settlement |
| Persistent cache tests | PIC B | Cache key, hit/miss, ownership, invalidation, expiry |
| Public API/job tests | PIC B | Safe public error mapping and job lifecycle |
| Frontend state tests | PIC A | Pending/result/insufficient-evidence/failure presentation |

PIC C should not add tests that import or depend on private worker/database implementation. The worker integration tests are acceptance cases for PIC B.

## 2. Existing coverage observed on `develop` at `d18ec04`

The repository already contains:

- `apps/web/src/lib/learning-analyzer/ai-provider.test.ts`
- `apps/web/src/lib/learning-analyzer/learning-analyzer.test.ts`
- `apps/web/src/lib/learning-analyzer/openrouter-budget.test.ts`
- `apps/web/src/lib/learning-analyzer/openrouter-integration.test.ts`
- `apps/web/src/lib/learning-analyzer-openrouter.live.test.ts`
- `apps/web/src/lib/learning-analyzer-openrouter.test.ts`
- `apps/web/src/lib/openrouter-model.test.ts`

The current test inventory includes adapter error mapping and token-budget tests. It does not demonstrate persistent quota enforcement, persistent cache behavior, or worker-level provider fallback. A token-generation budget is not equivalent to a user/organization quota guard.

Before adding tests, inspect these existing test files and extend them rather than duplicating coverage.

## 3. Provider adapter unit tests (PIC C)

| ID | Setup | Expected result | Priority |
|---|---|---|---|
| ADP-01 | Gemini HTTP 401 | `MODEL_CONFIGURATION_ERROR`, `retryable: false` | P0 |
| ADP-02 | Gemini HTTP 429 | `MODEL_UNAVAILABLE`, `retryable: true` | P0 |
| ADP-03 | Gemini HTTP 5xx | `MODEL_UNAVAILABLE`, `retryable: true` | P0 |
| ADP-04 | Gemini timeout | `MODEL_TIMEOUT`, `retryable: true` | P0 |
| ADP-05 | Gemini malformed/truncated/safety-blocked response | `MODEL_INVALID_RESPONSE`, `retryable: false` | P0 |
| ADP-06 | OpenRouter HTTP 401 | `MODEL_CONFIGURATION_ERROR`, `retryable: false` | P0 |
| ADP-07 | OpenRouter HTTP 403 | `MODEL_REQUEST_FAILED`, `retryable: false` | P0 |
| ADP-08 | OpenRouter HTTP 429 | `MODEL_UNAVAILABLE`, `retryable: true` | P0 |
| ADP-09 | OpenRouter HTTP 5xx | `MODEL_UNAVAILABLE`, `retryable: true` | P0 |
| ADP-10 | OpenRouter timeout | `MODEL_TIMEOUT`, `retryable: true` | P0 |
| ADP-11 | OpenRouter malformed/truncated/filtered response | `MODEL_INVALID_RESPONSE`, `retryable: false` | P0 |
| ADP-12 | Any adapter call | Exactly one HTTP provider request per invocation; no implicit retry | P0 |
| ADP-13 | Any adapter error | No API key, provider response body, or raw secret-bearing diagnostic in public `message` | P0 |

If an existing test already proves one of these behaviors, retain it as the acceptance test; do not duplicate it.

## 4. Fallback orchestration tests (PIC B)

Use fake primary/fallback adapters and call counters. Every test must assert both the returned result/error and the exact number of provider invocations.

| ID | Scenario | Expected behavior | Priority |
|---|---|---|---|
| FAL-01 | Primary succeeds with valid output | Return primary result; fallback not called | P0 |
| FAL-02 | Primary returns retryable `MODEL_UNAVAILABLE` (e.g. 429) | Invoke the configured fallback exactly once | P0 |
| FAL-03 | Primary returns retryable `MODEL_UNAVAILABLE` (e.g. 5xx) | Invoke the configured fallback exactly once | P0 |
| FAL-04 | Primary returns retryable `MODEL_TIMEOUT` | Invoke the configured fallback exactly once, if total deadline permits | P0 |
| FAL-05 | Primary returns `MODEL_CONFIGURATION_ERROR` | Do not invoke fallback; fail safely | P0 |
| FAL-06 | Primary returns `MODEL_REQUEST_FAILED` (e.g. 403) | Do not invoke fallback; fail safely | P0 |
| FAL-07 | Primary returns `MODEL_INVALID_RESPONSE` | Do not invoke fallback; do not substitute fixture/demo output | P0 |
| FAL-08 | Primary returns `INVALID_INPUT` or `NO_ANALYZABLE_TEXT` | Do not invoke fallback | P0 |
| FAL-09 | Primary returns `insufficient_evidence` | Return the valid analyzer outcome; fallback not called | P0 |
| FAL-10 | Fallback succeeds with structurally valid but ungrounded evidence | C-02 validation rejects/removes unsupported objectives; never bypass source validation | P0 |
| FAL-11 | Fallback also fails | Stop; no third provider/cascade; persist safe terminal outcome | P0 |
| FAL-12 | Both providers time out near job deadline | Stop within the configured overall job deadline | P0 |
| FAL-13 | Retryable error with no fallback configured | Return safe failure; do not invent another provider | P1 |
| FAL-14 | New unknown error code has `retryable: true` | No fallback unless code is explicitly allowlisted | P1 |

## 5. Public error and job lifecycle tests (PIC B)

| ID | Scenario | Expected behavior | Priority |
|---|---|---|---|
| ERR-01 | Internal `MODEL_UNAVAILABLE` reaches API boundary | Map to agreed safe public code/message; no provider detail | P0 |
| ERR-02 | Internal `MODEL_TIMEOUT` reaches API boundary | Map to agreed safe public code/message; no raw timeout stack | P0 |
| ERR-03 | `MODEL_CONFIGURATION_ERROR` reaches API boundary | Safe generic server error; operational detail remains server-side | P0 |
| ERR-04 | `MODEL_INVALID_RESPONSE` reaches API boundary | Safe generic AI failure; do not expose raw model output | P0 |
| ERR-05 | `causeValue` contains a fake API key/provider body | Response and ordinary client logs do not contain that value | P0 |
| ERR-06 | C-02 returns `insufficient_evidence` | Backend job is completed successfully; result status remains `insufficient_evidence` | P0 |
| ERR-07 | All configured providers fail | Job reaches the agreed failure state and exposes only safe error fields | P0 |
| ERR-08 | Retryable job is retried by worker | Attempt policy is bounded and persisted result/LO IDs remain idempotent | P0 |

## 6. Cached draft tests (PIC B)

| ID | Scenario | Expected behavior | Priority |
|---|---|---|---|
| CAC-01 | Same owner, module, snapshot, context, and versioned analysis config | Cache hit | P0 |
| CAC-02 | `text_version` changes | Cache miss | P0 |
| CAC-03 | `document_id` changes | Cache miss | P0 |
| CAC-04 | Grade/subject/topic/curriculum changes | Cache miss | P0 |
| CAC-05 | Prompt/analyzer/output-schema/cache-contract version changes | Cache miss | P0 |
| CAC-06 | Provider policy/model candidate version changes | Cache miss | P1 |
| CAC-07 | Same module/snapshot requested by a different teacher | No cross-teacher cache hit by default | P0 |
| CAC-08 | Teacher access to module is revoked | Existing cache entry cannot be read | P0 |
| CAC-09 | Cache entry expires | Cache miss and normal analysis path applies | P1 |
| CAC-10 | Teacher requests explicit fresh analysis | Bypass existing cache and create a new draft identity | P0 |
| CAC-11 | Previous outcome is provider timeout/429/5xx | Do not cache the failure | P0 |
| CAC-12 | Previous outcome is validated `insufficient_evidence` | May be cached as a valid analyzer outcome | P1 |
| CAC-13 | Cache hit returns an existing draft repeatedly | No duplicate persistent Learning Objective IDs | P0 |
| CAC-14 | Cached draft contains source references | References remain bound to the same immutable document/text version | P0 |
| CAC-15 | Teacher edits cached draft | Preserve original AI draft; store edits/review state separately | P0 |

## 7. Quota guard tests (PIC B)

| ID | Scenario | Expected behavior | Priority |
|---|---|---|---|
| QUA-01 | Cache miss with quota available | Atomically reserve quota before provider call | P0 |
| QUA-02 | Quota exhausted | Return `RATE_LIMITED`; no provider is called | P0 |
| QUA-03 | Cache hit | No new logical-analysis quota charge, subject to approved product policy | P0 |
| QUA-04 | Same idempotency key/job retry | No duplicate quota reservation/charge | P0 |
| QUA-05 | Concurrent requests at quota boundary | Atomic enforcement prevents overrun | P0 |
| QUA-06 | Primary fails retryably and fallback succeeds | One logical analysis quota unit; both provider attempts recorded in usage telemetry | P0 |
| QUA-07 | All providers fail before validated outcome | Release reservation under the proposed settlement policy; retain provider usage telemetry | P1 |
| QUA-08 | `completed` or `insufficient_evidence` is persisted | Commit one logical analysis quota unit | P0 |
| QUA-09 | Quota scope is teacher-specific | One teacher cannot consume another teacher's allowance | P0 |

## 8. Cross-cutting security tests

- No test response or client-visible log contains API keys, Authorization headers, provider raw response bodies, `causeValue`, stack traces, or internal provider diagnostics.
- A provider fallback cannot bypass C-02 schema/evidence/source-reference validation.
- Cache lookup always follows authentication and current module ownership authorization.
- Cache identity includes owner isolation and immutable source snapshot identity.
- Fixture/synthetic source identifiers must not become production source references or be published as real document references.

## 9. C-04 acceptance exit criteria

C-04 should not be marked complete until:

1. Adapter-level tests prove the normalized transient/non-transient error contract.
2. PIC B worker tests prove fallback allowlist, bounded attempts, deadlines, and safe failure behavior.
3. PIC B cache tests prove identity, invalidation, ownership isolation, expiry, and idempotent objective persistence.
4. PIC B quota tests prove atomic reservation, cache-hit behavior, idempotency, and settlement.
5. Public API/job tests prove safe error mapping and distinguish job failure from `insufficient_evidence`.
6. PIC A can consume the agreed job/result contract without accessing provider adapters or secrets.

C-04 is an integrated PIC C + PIC B deliverable. Passing PIC C adapter tests alone is not sufficient to claim persistent fallback, cache, or quota behavior complete.
