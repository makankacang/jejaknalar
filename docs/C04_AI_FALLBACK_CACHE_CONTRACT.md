# C-04 AI Fallback, Quota, and Cached Draft Contract

**Status:** PIC C technical proposal for PIC B integration review
**Scope:** C-04 contract and acceptance guidance. This document does not implement worker orchestration, API routes, database migrations, quota persistence, or cache persistence.

## 1. Ownership and boundaries

### PIC C owns

- The provider-neutral `AIModel` interface and Gemini/OpenRouter adapter contracts.
- Normalized `LearningAnalyzerError` codes and retryability metadata.
- Adapter-level test cases and fallback acceptance scenarios using fake providers.
- Cache identity, versioning, invalidation, and cached-draft behavior specification.
- Technical guidance for retry/fallback, quota, and safe public error mapping.

### PIC B owns

- Provider/model selection and fallback orchestration in the worker.
- Job-level retry policy, deadlines, and attempt limits.
- Public API error mapping and persisted job failure states.
- Quota enforcement, atomic reservation/settlement, and usage persistence.
- Persistent cache storage/retrieval, ownership checks, tenant isolation, and expiry.

PIC C must not modify the analysis worker, API routes/OpenAPI, or database migrations without coordination. PIC B must not change the adapter/error contract unilaterally.

## 2. Current adapter contract

The shared interface is:

```ts
interface AIModelRequest {
  system_instruction: string;
  prompt: string;
  response_json_schema: Record<string, unknown>;
}

interface AIModel {
  generateStructuredOutput(request: AIModelRequest): Promise<unknown>;
}
```

Provider adapters return untrusted parsed output. C-02 remains responsible for task-specific schema, evidence, provenance, and semantic validation.

The normalized error type exposes:

```ts
class LearningAnalyzerError extends Error {
  readonly code: LearningAnalyzerErrorCode;
  readonly retryable: boolean;
  readonly causeValue?: unknown;
}
```

`causeValue` is diagnostic-only. It must never be returned to the browser or included in ordinary application logs if it can contain secrets or provider payloads.

### Existing normalized error codes

| Code | Meaning | Retryable by adapter today? |
|---|---|---:|
| `INVALID_INPUT` | Input or source snapshot is invalid | No |
| `NO_ANALYZABLE_TEXT` | No analyzable extracted text | No |
| `MODEL_CONFIGURATION_ERROR` | Provider configuration/authentication problem | No |
| `MODEL_UNAVAILABLE` | Provider unavailable, 429/5xx, or connection failure | Yes for current provider mappings |
| `MODEL_TIMEOUT` | Provider request exceeded its timeout | Yes |
| `MODEL_REQUEST_FAILED` | Provider rejected the request with a non-retryable response | No |
| `MODEL_INVALID_RESPONSE` | Provider response could not be parsed or is structurally invalid | No |

Current adapter behavior observed on `develop` at `d18ec04`:

- Gemini: 401 maps to `MODEL_CONFIGURATION_ERROR`; 429 and 5xx map to retryable `MODEL_UNAVAILABLE`; timeout/network failures are retryable; malformed/truncated/safety-blocked output maps to non-retryable `MODEL_INVALID_RESPONSE`.
- OpenRouter: 401 maps to `MODEL_CONFIGURATION_ERROR`; 429 and 5xx map to retryable `MODEL_UNAVAILABLE`; 403 and other rejected requests map to non-retryable `MODEL_REQUEST_FAILED`; timeout/network failures are retryable; malformed/truncated/filtered output maps to non-retryable `MODEL_INVALID_RESPONSE`.
- The adapters make one provider request per invocation. They do not implement automatic retry or fallback.
- C-02 propagates typed `LearningAnalyzerError` values and validates the parsed result. Invalid task output must not be silently replaced with fixture/demo data.

## 3. Provider fallback contract

Fallback is a worker/orchestration responsibility owned by PIC B. PIC C's contract and tests define the expected behavior.

### 3.1 Candidate policy

- Provider candidates are selected from trusted server-side configuration.
- The configured primary provider is attempted first.
- At most one configured fallback provider is attempted during a single analyzer invocation. Do not create an unbounded provider chain.
- The worker must respect an overall job deadline. The sum of provider timeouts and orchestration overhead must fit within that deadline.
- Adapter-level automatic retries remain disabled. Any job retry after the invocation is a separate PIC B policy with bounded attempts and idempotent persistence.

### 3.2 When fallback is allowed

Fallback is allowed only when the primary failure is both marked `retryable: true` and has an explicitly approved transient code:

- `MODEL_UNAVAILABLE` (includes mapped HTTP 429/5xx and connection failures)
- `MODEL_TIMEOUT`

The `retryable` flag alone should not authorize arbitrary future error codes to trigger fallback. PIC B should use an explicit allowlist so that adding a new error code cannot silently change retry behavior.

### 3.3 When fallback is not allowed

Do not invoke a fallback provider for:

- `INVALID_INPUT`
- `NO_ANALYZABLE_TEXT`
- `MODEL_CONFIGURATION_ERROR` (including HTTP 401)
- `MODEL_REQUEST_FAILED` (including HTTP 403 and other non-retryable 4xx)
- `MODEL_INVALID_RESPONSE` (malformed JSON, missing output, truncated output, invalid task structure, or safety/content-filter rejection)
- A successful analyzer result with `status: "insufficient_evidence"`

`insufficient_evidence` is a valid analysis outcome, not a provider failure.

### 3.4 Fallback result handling

- A fallback provider's response must pass the exact same C-02 validation as the primary provider's response.
- A successful provider response that fails C-02 validation is not accepted and must not be converted into a demo result.
- If the fallback provider also fails, stop the fallback chain. Persist a sanitized job failure and internal attempt diagnostics. Do not expose provider response bodies, credentials, raw exception messages, or `causeValue` to the client.
- Record which provider/model succeeded and the fallback reason in protected server-side metadata for cost and reliability analysis.
- Provider attempt telemetry is distinct from the user's logical analysis quota. See section 6.

### 3.5 Recommended orchestrator decision rule

Conceptual rule for PIC B's worker (not an implementation requirement or exported PIC C function):

```ts
const FALLBACK_ELIGIBLE_CODES = new Set([
  "MODEL_UNAVAILABLE",
  "MODEL_TIMEOUT",
]);

function mayFallback(error: LearningAnalyzerError): boolean {
  return error.retryable && FALLBACK_ELIGIBLE_CODES.has(error.code);
}
```

The worker must still enforce candidate count, job deadline, and idempotency outside this helper.

## 4. Public API error mapping guidance

PIC B owns the final mapping to the project's public error envelope and OpenAPI contract. The following is a proposed safe mapping, not a new public contract:

| Internal error | Suggested public code | Client retry guidance |
|---|---|---|
| `INVALID_INPUT` | `VALIDATION_ERROR` | No; correct the request/source data |
| `NO_ANALYZABLE_TEXT` | `VALIDATION_ERROR` | No; provide a usable document snapshot |
| `MODEL_CONFIGURATION_ERROR` | `INTERNAL_ERROR` | No; operator must fix server configuration |
| `MODEL_UNAVAILABLE` | `AI_UNAVAILABLE` | Retry only according to job/API policy |
| `MODEL_TIMEOUT` | `AI_UNAVAILABLE` | Retry only according to job/API policy |
| `MODEL_REQUEST_FAILED` | `AI_UNAVAILABLE` or `INTERNAL_ERROR` | No automatic client retry by default |
| `MODEL_INVALID_RESPONSE` | `AI_UNAVAILABLE` | No automatic client retry by default; record diagnostics internally |
| Backend quota denial | `RATE_LIMITED` | No; wait for the quota window or request allowance |

The public response should contain a stable safe code, a user-safe message, and the request/job identifier required by the API contract. Include a `retryable` field only if the public envelope/OpenAPI explicitly supports it. Never serialize `causeValue`, provider response bodies, API keys, internal endpoint URLs, or raw exception messages.

A job that exhausts its fallback attempt should become a terminal or retryable job failure according to PIC B's bounded job policy. This job lifecycle status is distinct from C-02 result status (`completed` / `insufficient_evidence`).

## 5. Cached draft contract

Persistent cache implementation is owned by PIC B. PIC C defines the identity and behavioral requirements.

### 5.1 Cache purpose

A cached draft is the normalized, validated C-02 analyzer result for one immutable source snapshot and one analysis configuration. It is not a substitute for teacher review or approval. Cached drafts must remain separate from teacher-edited/reviewed objective records.

### 5.2 Cache identity

The cache identity must include all inputs that can change the analyzer result or its provenance:

```ts
interface LearningAnalysisCacheIdentity {
  cache_contract_version: "1";
  task: "learning-objectives";

  owner_user_id: string;
  organization_id?: string;

  module_id: string;
  document_id: string;
  text_version: string;

  analysis_schema_version: string;
  prompt_version: string;
  analyzer_version: string;
  provider_policy_version: string;

  context: {
    grade?: 7 | 8 | 9;
    subject?: string;
    topic?: string;
    curriculum?: string;
  };
}
```

Notes:

- `owner_user_id` is required to isolate drafts between teachers. An organization-level shared cache is a separate future policy and must not be inferred from `organization_id` alone.
- `document_id` and `text_version` are both included. The backend must still verify that they resolve to the same immutable stored C-01 snapshot.
- `provider_policy_version` represents the configured provider/model candidate policy. Increment it whenever provider order, model choice, or fallback policy changes in a result-affecting way. It avoids trying to calculate the key using the provider that happens to succeed after fallback.
- Context is canonicalized before hashing. Omitted optional values and explicit `null` must have one consistent representation.
- Add any future result-affecting input to the identity and increment `cache_contract_version` when the key semantics change.

The backend should serialize the identity deterministically (stable property ordering and normalized values) and compute a SHA-256 digest. Do not put API keys, raw document text, provider response bodies, or secrets into the cache key.

### 5.3 Cache value

Store only the validated/normalized analyzer draft and the metadata needed to verify its identity and provenance, for example:

- cache identity fields or their versioned hash;
- normalized `LearningAnalysisResult`;
- owner and module references;
- creation and expiry timestamps;
- provider/model actually used and whether fallback occurred (protected operational metadata);
- analyzer/prompt/schema/provider-policy versions.

Do not store credentials or raw provider diagnostics in the cached value. A cached draft must preserve the C-01 `source_map_id` references and corresponding `document_id`/`text_version` snapshot identity.

### 5.4 Cacheable outcomes

Cache only successfully validated analyzer outcomes:

- `status: "completed"` may be cached.
- `status: "insufficient_evidence"` may be cached because it is a valid completed analyzer outcome.

Do not cache provider errors, timeouts, quota denials, malformed model output, invalid input, or partial/unvalidated output.

### 5.5 Cache hit behavior

- Re-check authenticated owner access and module access before returning a cache hit. A cache hit must never bypass authorization.
- Verify that the current request resolves to the exact `document_id + text_version` snapshot represented by the cache entry.
- Return the draft as a draft. Teacher review/edit/approval remains a separate workflow.
- Repeated retrieval must not create duplicate persistent Learning Objective IDs. PIC B must make ID assignment and persistence idempotent for a given analysis result/job/cache identity.
- A cache hit should not consume a new logical analysis quota unit (proposed policy; PIC B/product must approve).

### 5.6 Invalidation and bypass

Treat the following as a cache miss or invalidate the affected entry:

1. `module_id`, `document_id`, or `text_version` changes.
2. Extracted text/source map is regenerated or a new immutable snapshot is created.
3. Grade, subject, topic, or curriculum context changes.
4. Prompt, analyzer, output schema, or cache contract version changes.
5. Provider policy/model configuration changes in a result-affecting way.
6. Cache TTL expires.
7. Module/document access is revoked, ownership changes, or the underlying module/document is deleted.
8. A teacher explicitly requests a fresh analysis with cache bypass.

Teacher edits to a draft must create/update the separate teacher-review version; they must not mutate the cached AI draft. An explicit re-analysis should generate a new draft identity rather than silently overwrite an already reviewed/approved record.

TTL duration, eviction, and storage retention are backend/product configuration decisions. They must not be hard-coded in the C-02 analyzer.

## 6. Quota guard contract

Quota enforcement and persistence are owned by PIC B. The following rules are proposed acceptance behavior:

- Quota scope must be explicitly chosen: per teacher, per organization, or a defined combination. Do not assume organization sharing means teachers share one quota.
- Quota limits and reset window are configuration/product decisions. No numeric limit is defined by PIC C in this document.
- A cache hit does not consume a new logical analysis quota unit, subject to PIC B/product approval.
- A cache miss reserves quota atomically before provider invocation. Concurrent requests must not exceed the configured limit due to race conditions.
- The same idempotency key/job retry must not reserve or charge quota more than once.
- A logical analysis job counts as one user quota unit, even if the worker invokes a fallback provider. Provider calls, token usage, and estimated provider cost must be recorded separately for operational cost monitoring.
- Recommended settlement: commit the logical quota unit when a validated C-02 outcome (`completed` or `insufficient_evidence`) is persisted. Release the reservation when the job terminates without a validated outcome. Provider-side costs may still have occurred and should remain in usage telemetry.
- Quota denial must happen before contacting any model provider and return a safe `RATE_LIMITED` public error/job outcome.

PIC B/product must explicitly approve quota scope, limits, time window, reservation timeout, and settlement policy before database persistence is implemented.

## 7. Security and privacy requirements

- All provider credentials and provider/model selection remain server-side.
- Cache reads and writes must enforce teacher/module ownership and tenant isolation.
- Do not expose provider details, secrets, `causeValue`, raw provider bodies, or internal retry/fallback traces to the frontend.
- Never use fixture/demo output to mask a provider failure.
- Preserve immutable source snapshot provenance in every cached result.
- Treat user-provided document text as untrusted input, as already required by the C-02 prompt and validation boundary.

## 8. Open decisions requiring PIC B/product approval

- Which provider/model is primary and which is the single fallback candidate for each task/environment?
- What is the total worker deadline and how much timeout budget is allocated to each candidate?
- Is quota scoped per teacher, per organization, or both?
- What are the numeric quota limits and reset window?
- Does one logical analysis consume quota only after a validated outcome, as proposed here?
- What is the cache TTL and retention policy?
- Is any cross-teacher cache reuse allowed? Default recommendation: no.
- Which exact public error envelope fields and HTTP statuses are standardized in OpenAPI?

No database schema, API route, worker behavior, or numeric quota limit is finalized by this PIC C document.
