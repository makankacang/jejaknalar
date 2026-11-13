/** Provider-neutral request contract shared by all AI tasks. */
export interface AIModelRequest {
  system_instruction: string;
  prompt: string;
  response_json_schema: Record<string, unknown>;
}

/**
 * Minimal server-side model adapter contract.
 * Provider adapters return unknown intentionally; task-specific validators own
 * schema, provenance, and semantic validation.
 */
export interface AIModel {
  generateStructuredOutput(request: AIModelRequest): Promise<unknown>;
}
