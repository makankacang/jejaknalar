import { describe, expect, it } from "vitest";
import { OpenRouterModel } from "../../../../../supabase/functions/_shared/ai/providers/openrouter-model.ts";
import { LearningAnalyzerError } from "../../../../../supabase/functions/_shared/ai/learning-analyzer/errors.ts";

const request = {
  system_instruction: "Kamu adalah Learning Analyzer.",
  prompt: "Buat output terstruktur.",
  response_json_schema: { type: "object" },
};

function createFetchCapture() {
  let capturedBody: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ ok: true }) },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  return { fetchImpl, getBody: () => capturedBody };
}

describe("OpenRouter generation budget", () => {
  it("keeps the agreed defaults when no budget options are supplied", async () => {
    const capture = createFetchCapture();
    const model = new OpenRouterModel({
      apiKey: "test-only-key",
      model: "test/model",
      fetchImpl: capture.fetchImpl,
    });

    await model.generateStructuredOutput(request);

    expect(capture.getBody()).toMatchObject({
      max_tokens: 4096,
      reasoning: { max_tokens: 256 },
    });
  });

  it("uses task-specific output and reasoning budgets", async () => {
    const capture = createFetchCapture();
    const model = new OpenRouterModel({
      apiKey: "test-only-key",
      model: "test/model",
      maxOutputTokens: 8192,
      reasoningMaxTokens: 512,
      fetchImpl: capture.fetchImpl,
    });

    await model.generateStructuredOutput(request);

    expect(capture.getBody()).toMatchObject({
      max_tokens: 8192,
      reasoning: { max_tokens: 512 },
    });
  });

  it("omits reasoning when the selected model does not support it", async () => {
    const capture = createFetchCapture();
    const model = new OpenRouterModel({
      apiKey: "test-only-key",
      model: "test/model-without-reasoning-parameter",
      reasoningMaxTokens: null,
      fetchImpl: capture.fetchImpl,
    });

    await model.generateStructuredOutput(request);

    expect(capture.getBody()).toMatchObject({ max_tokens: 4096 });
    expect(capture.getBody()).not.toHaveProperty("reasoning");
  });

  it("rejects non-positive or non-integer output budgets", () => {
    for (const maxOutputTokens of [0, -1, 1.5, Number.NaN]) {
      expect(() => new OpenRouterModel({
        apiKey: "test-only-key",
        model: "test/model",
        maxOutputTokens,
      })).toThrow(LearningAnalyzerError);
    }
  });

  it("rejects invalid reasoning budgets but accepts null as explicit opt-out", () => {
    for (const reasoningMaxTokens of [0, -1, 1.5, Number.NaN]) {
      expect(() => new OpenRouterModel({
        apiKey: "test-only-key",
        model: "test/model",
        reasoningMaxTokens,
      })).toThrow(LearningAnalyzerError);
    }

    expect(() => new OpenRouterModel({
      apiKey: "test-only-key",
      model: "test/model",
      reasoningMaxTokens: null,
    })).not.toThrow();
  });
});
