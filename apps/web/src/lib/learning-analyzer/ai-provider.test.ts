import { describe, expect, it } from "vitest";
import type { AIModel, AIModelRequest } from "../../../../../supabase/functions/_shared/ai/core/model.ts";
import {
  GeminiRestModel,
  OpenRouterModel,
  type LearningAnalyzerModel,
  type LearningAnalyzerModelRequest,
  LearningAnalyzerError,
} from "../../../../../supabase/functions/_shared/ai/learning-analyzer/index.ts";

const request: AIModelRequest = {
  system_instruction: "Kamu adalah Learning Analyzer.",
  prompt: "Identifikasi tujuan pembelajaran.",
  response_json_schema: { type: "object" },
};

function createModel(fetchImpl: typeof fetch, timeoutMs = 60_000): OpenRouterModel {
  return new OpenRouterModel({
    apiKey: "test-only-key",
    model: "test/model",
    timeoutMs,
    fetchImpl,
  });
}

describe("Shared AI model contract", () => {
  it("keeps C-02 model names structurally compatible with the shared interface", () => {
    const legacyRequest: LearningAnalyzerModelRequest = request;
    const legacyModel: LearningAnalyzerModel = {
      generateStructuredOutput: async () => ({ ok: true }),
    };
    const sharedModel: AIModel = legacyModel;

    expect(legacyRequest).toBe(request);
    expect(sharedModel).toBe(legacyModel);
  });
});

describe("OpenRouterModel", () => {
  it("sends the C-02 compatible request and parses JSON content", async () => {
    const fetchMock: typeof fetch = async (url, init) => {
      expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-only-key");
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
        max_tokens: number;
        reasoning: { max_tokens: number };
      };
      expect(body.messages[0]).toEqual({ role: "system", content: request.system_instruction });
      expect(body.messages[1].content).toContain(JSON.stringify(request.response_json_schema));
      expect(body.max_tokens).toBe(4096);
      expect(body.reasoning.max_tokens).toBe(256);

      return new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ objectives: [], warnings: [] }) } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await createModel(fetchMock).generateStructuredOutput(request);
    expect(result).toEqual({ objectives: [], warnings: [] });
  });

  it("normalizes text content blocks returned by OpenRouter", async () => {
    const fetchMock: typeof fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: [{ type: "text", text: '{"ok":' }, { type: "text", text: 'true}' }] } }],
    }), { status: 200 });

    await expect(createModel(fetchMock).generateStructuredOutput(request)).resolves.toEqual({ ok: true });
  });

  it("maps HTTP 401 to non-retryable configuration error", async () => {
    const model = createModel(async () => new Response("unauthorized", { status: 401 }));
    await expect(model.generateStructuredOutput(request)).rejects.toMatchObject({
      code: "MODEL_CONFIGURATION_ERROR",
      retryable: false,
    });
  });

  it("maps HTTP 403 to a non-retryable request error without assuming an API-key issue", async () => {
    const model = createModel(async () => new Response("forbidden", { status: 403 }));
    await expect(model.generateStructuredOutput(request)).rejects.toMatchObject({
      code: "MODEL_REQUEST_FAILED",
      retryable: false,
    });
  });

  it("maps HTTP 429 and 5xx to retryable provider unavailable", async () => {
    for (const status of [429, 503]) {
      const model = createModel(async () => new Response("provider error", { status }));
      await expect(model.generateStructuredOutput(request)).rejects.toMatchObject({
        code: "MODEL_UNAVAILABLE",
        retryable: true,
      });
    }
  });

  it("maps truncated output to non-retryable invalid response", async () => {
    const model = createModel(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: "length", message: { content: '{"objectives":[]}' } }],
    }), { status: 200 }));

    await expect(model.generateStructuredOutput(request)).rejects.toMatchObject({
      code: "MODEL_INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("maps malformed provider JSON and malformed model JSON to invalid response", async () => {
    const malformedEnvelope = createModel(async () => new Response("{", { status: 200 }));
    await expect(malformedEnvelope.generateStructuredOutput(request)).rejects.toMatchObject({
      code: "MODEL_INVALID_RESPONSE",
      retryable: false,
    });

    const malformedContent = createModel(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "not json" } }],
    }), { status: 200 }));
    await expect(malformedContent.generateStructuredOutput(request)).rejects.toMatchObject({
      code: "MODEL_INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("maps an empty or unsupported response content shape to invalid response", async () => {
    const model = createModel(async () => new Response(JSON.stringify({
      choices: [{ message: { content: { unexpected: "object" } } }],
    }), { status: 200 }));

    const resultPromise = model.generateStructuredOutput(request);
    await expect(resultPromise).rejects.toBeInstanceOf(LearningAnalyzerError);
    await expect(resultPromise).rejects.toMatchObject({
      code: "MODEL_INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("maps request abort to retryable timeout", async () => {
    const fetchMock: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
    const model = createModel(fetchMock, 5);

    await expect(model.generateStructuredOutput(request)).rejects.toMatchObject({
      code: "MODEL_TIMEOUT",
      retryable: true,
    });
  });
});

describe("GeminiRestModel error mapping", () => {
  const geminiRequest: AIModelRequest = {
    system_instruction: "system",
    prompt: "user",
    response_json_schema: { type: "object" },
  };

  it("maps HTTP 401 to non-retryable configuration error", async () => {
    const model = new GeminiRestModel({
      apiKey: "test-only-key",
      model: "test-model",
      fetchImpl: async () => new Response("unauthorized", { status: 401 }),
    });

    await expect(model.generateStructuredOutput(geminiRequest)).rejects.toMatchObject({
      code: "MODEL_CONFIGURATION_ERROR",
      retryable: false,
    });
  });

  it("keeps HTTP 403 non-retryable without assuming every forbidden response is an API-key error", async () => {
    const model = new GeminiRestModel({
      apiKey: "test-only-key",
      model: "test-model",
      fetchImpl: async () => new Response("forbidden", { status: 403 }),
    });

    await expect(model.generateStructuredOutput(geminiRequest)).rejects.toMatchObject({
      code: "MODEL_REQUEST_FAILED",
      retryable: false,
    });
  });

  it("maps a malformed provider response envelope to invalid response", async () => {
    const model = new GeminiRestModel({
      apiKey: "test-only-key",
      model: "test-model",
      fetchImpl: async () => new Response("not-json", { status: 200 }),
    });

    await expect(model.generateStructuredOutput(geminiRequest)).rejects.toMatchObject({
      code: "MODEL_INVALID_RESPONSE",
      retryable: false,
    });
  });
});
