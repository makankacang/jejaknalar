# Shared AI Core — PIC C

`core/model.ts` defines the provider-neutral `AIModel` and `AIModelRequest` contract.
Provider adapters return `unknown` intentionally. The consuming AI task remains responsible
for schema, source-reference, and semantic validation.

## Compatibility

C-02 keeps `LearningAnalyzerModel` and `LearningAnalyzerModelRequest` as type aliases to
`AIModel` and `AIModelRequest`. Existing analyzer callers therefore retain their names and
behavior while new tasks can use the shared contract directly.

## Ownership boundary

- PIC C: shared interface, provider adapters, prompts, task schemas, and task validators.
- PIC B: server-side secrets, task/provider/model selection, worker orchestration, timeout
  configuration, retry/fallback policy, authorization, and metadata persistence.

Provider adapters never decide fallback. They return parsed but untrusted JSON, or throw a
normalized `LearningAnalyzerError`. `MODEL_INVALID_RESPONSE` is non-retryable and must not be
used to bypass task validators or silently substitute demo content.

API keys must only be supplied by trusted server-side code. Do not place secrets in frontend
variables, fixtures, source control, or logs.
