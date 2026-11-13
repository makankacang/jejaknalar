import type { AIModel, AIModelRequest } from "../core/model.ts";
import { LearningAnalyzerError } from "../learning-analyzer/errors.ts";

export interface OpenRouterModelOptions {
  apiKey: string;
  model: string;
  /** Supplied by the server-side task/provider configuration (PIC B). */
  timeoutMs?: number;
  /** Maximum completion tokens. Defaults to 4096. */
  maxOutputTokens?: number;
  /**
   * Reasoning token budget. Defaults to 256. Set to null to omit the
   * reasoning parameter for models that do not support it.
   */
  reasoningMaxTokens?: number | null;
  fetchImpl?: typeof fetch;
}

interface OpenRouterMessage {
  content?: unknown;
}

interface OpenRouterResponse {
  choices?: Array<{
    finish_reason?: string | null;
    message?: OpenRouterMessage;
  }>;
}

function extractMessageText(content: unknown): string | null {
  if (typeof content === "string") return content.trim() || null;

  // Some OpenAI-compatible responses represent text as content blocks.
  // Accept only explicit text blocks; never stringify arbitrary objects.
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (typeof part === "string") {
        parts.push(part);
      } else if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        parts.push((part as { text: string }).text);
      } else {
        return null;
      }
    }
    const text = parts.join("").trim();
    return text || null;
  }

  return null;
}

/** Server-side OpenRouter adapter. It returns untrusted parsed JSON for C validation. */
export class OpenRouterModel implements AIModel {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;
  private readonly reasoningMaxTokens: number | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenRouterModelOptions) {
    const apiKey = options.apiKey?.trim();
    const model = options.model?.trim();
    if (!apiKey || !model) {
      throw new LearningAnalyzerError(
        "MODEL_CONFIGURATION_ERROR",
        "Konfigurasi OpenRouter belum lengkap.",
      );
    }

    const maxOutputTokens = options.maxOutputTokens ?? 4096;
    const reasoningMaxTokens = options.reasoningMaxTokens === undefined
      ? 256
      : options.reasoningMaxTokens;

    if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens <= 0) {
      throw new LearningAnalyzerError(
        "MODEL_CONFIGURATION_ERROR",
        "maxOutputTokens OpenRouter harus berupa bilangan bulat positif.",
      );
    }

    if (
      reasoningMaxTokens !== null &&
      (!Number.isSafeInteger(reasoningMaxTokens) || reasoningMaxTokens <= 0)
    ) {
      throw new LearningAnalyzerError(
        "MODEL_CONFIGURATION_ERROR",
        "reasoningMaxTokens OpenRouter harus berupa bilangan bulat positif atau null.",
      );
    }

    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxOutputTokens = maxOutputTokens;
    this.reasoningMaxTokens = reasoningMaxTokens;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateStructuredOutput(request: AIModelRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: "system", content: request.system_instruction },
              {
                role: "user",
                content: request.prompt +
                  "\n\nReturn only valid JSON matching this schema:\n" +
                  JSON.stringify(request.response_json_schema),
              },
            ],
            temperature: 0.2,
            ...(this.reasoningMaxTokens === null
              ? {}
              : { reasoning: { max_tokens: this.reasoningMaxTokens } }),
            max_tokens: this.maxOutputTokens,
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new LearningAnalyzerError(
            "MODEL_CONFIGURATION_ERROR",
            "Autentikasi OpenRouter gagal. Periksa konfigurasi secret provider.",
          );
        }
        if (response.status === 429 || response.status >= 500) {
          throw new LearningAnalyzerError(
            "MODEL_UNAVAILABLE",
            "OpenRouter sedang tidak tersedia atau kuota request tercapai.",
            { retryable: true },
          );
        }
        // 403 is deliberately non-retryable. It can represent account, model,
        // or permission policy; do not assume every 403 means a bad API key.
        throw new LearningAnalyzerError(
          "MODEL_REQUEST_FAILED",
          `Permintaan ke OpenRouter ditolak (HTTP ${response.status}).`,
        );
      }

      let data: OpenRouterResponse;
      try {
        data = await response.json() as OpenRouterResponse;
      } catch (error) {
        throw new LearningAnalyzerError(
          "MODEL_INVALID_RESPONSE",
          "OpenRouter mengembalikan payload yang bukan JSON valid.",
          { cause: error },
        );
      }

      const choice = data.choices?.[0];
      if (!choice) {
        throw new LearningAnalyzerError(
          "MODEL_INVALID_RESPONSE",
          "OpenRouter tidak mengembalikan choice hasil model.",
        );
      }

      if (choice.finish_reason === "length") {
        throw new LearningAnalyzerError(
          "MODEL_INVALID_RESPONSE",
          "Output OpenRouter terpotong karena batas token.",
        );
      }
      if (choice.finish_reason === "content_filter") {
        throw new LearningAnalyzerError(
          "MODEL_INVALID_RESPONSE",
          "Output OpenRouter dihentikan oleh content filter.",
        );
      }

      const content = extractMessageText(choice.message?.content);
      if (!content) {
        throw new LearningAnalyzerError(
          "MODEL_INVALID_RESPONSE",
          "OpenRouter menghasilkan respons kosong atau format content tidak didukung.",
        );
      }

      try {
        return JSON.parse(content) as unknown;
      } catch (error) {
        throw new LearningAnalyzerError(
          "MODEL_INVALID_RESPONSE",
          "Respons OpenRouter bukan JSON yang valid.",
          { cause: error },
        );
      }
    } catch (error) {
      if (error instanceof LearningAnalyzerError) throw error;
      if (controller.signal.aborted) {
        throw new LearningAnalyzerError(
          "MODEL_TIMEOUT",
          "OpenRouter melewati batas waktu.",
          { retryable: true, cause: error },
        );
      }
      throw new LearningAnalyzerError(
        "MODEL_UNAVAILABLE",
        "Tidak dapat menghubungi OpenRouter.",
        { retryable: true, cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
