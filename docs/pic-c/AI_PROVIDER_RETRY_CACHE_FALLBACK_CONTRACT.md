# PIC C — AI provider, retry, cache and fallback contract

**Scope:** contract/recommendation owned by PIC C. Worker orchestration, public error mapping, quota enforcement and persistent cache belong to PIC B.

## AIModel contract

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

The provider returns untrusted structured output. The generator attaches trusted `document_id`, `text_version`, locator and source metadata after validating references. Provider output must not author objective IDs, document identities, source locators, assessment IDs, answer keys, or private rubrics.

## Normalized failure policy

| Failure | Retry | Provider switch |
|---|---|---|
| 401/403/configuration | No | No. Correct secret/permission first. |
| 429/rate limit | Only bounded retry if `Retry-After` and quota policy permit | Only if PIC B explicitly permits quota fallback. |
| 5xx | At most one bounded retry with exponential backoff and jitter | Eligible for B-orchestrated secondary provider. |
| Timeout/network | At most one bounded retry with same job identity | Eligible for B-orchestrated secondary provider. |
| Malformed JSON/schema | At most one constrained repair if provider supports it | Do not loop providers to hide invalid output. |
| Source/registry validation | No blind retry | No. Fix trusted input or reject draft. |
| Safety/policy rejection | No automatic retry | No automatic provider switch. |

The generator currently preserves the provider adapter's normalized categories (`MODEL_CONFIGURATION_ERROR`, `MODEL_UNAVAILABLE`, `MODEL_TIMEOUT`, `MODEL_INVALID_RESPONSE`, and `MODEL_REQUEST_FAILED`) as generator errors. It does not itself perform retries, provider switching, quota checks, or persistent caching. B should preserve safe provider diagnostics internally while exposing controlled public error codes and implementing the approved orchestration policy.

## Cache key proposal

Hash canonical JSON containing:

- provider ID and exact model ID;
- prompt/template version;
- response schema version;
- document ID and text version;
- digest of normalized extracted text and ordered source map;
- approved objective IDs and statements;
- registry version and allowed room/NPC/object IDs;
- generation mode and relevant learning context.

Never include API keys, JWTs, or secrets. Store any raw provider response and provenance server-side only.

## Invalidation

A change to document text version/content/source map, objective value or approval state, registry pin/allowlist, prompt version, output schema version, provider/model settings, or generation mode must generate a different cache key. Do not reuse output grounded in another source snapshot.

## Fallback

No silent provider switch inside the pure generator. B owns provider routing and quota policy. A curated fallback may be served only after teacher approval, marked clearly as curated/demo rather than AI-generated, and with its source provenance retained. For BI8, Paragraph B is still pending teacher approval, so the candidate must not be presented as a teacher-approved scoring answer key.

## Evidence boundary

User-reported local tests for the quest-generator baseline: `deno lint`, `deno check`, and 30 Deno tests passed. These are local test results reported in the conversation, not independently rerun in this patch environment. Live Gemini staging completion, automatic Gemini-to-OpenRouter failover, persistent cache and scoring E2E remain unproven.
