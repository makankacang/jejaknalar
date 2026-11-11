import { LearningAnalyzerError } from "./errors.ts";
import type { LearningAnalyzerModel, LearningAnalyzerModelRequest } from "./types.ts";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiRestModelOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxOutputTokens?: number;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/** Server-side REST caller. Construct only from a trusted server environment, never from VITE_* values. */
export class GeminiRestModel implements LearningAnalyzerModel {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly maxOutputTokens: number;

  constructor(options: GeminiRestModelOptions) {
    const apiKey = options.apiKey?.trim();
    const model = options.model?.trim();
    if (!apiKey || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) {
      throw new LearningAnalyzerError(
        "MODEL_CONFIGURATION_ERROR",
        "GEMINI_API_KEY dan nama GEMINI_MODEL server harus dikonfigurasi dengan benar.",
      );
    }
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxOutputTokens = options.maxOutputTokens ?? 4096;
  }

  async generateStructuredOutput(request: LearningAnalyzerModelRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `${GEMINI_API_BASE_URL}/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system_instruction }] },
            contents: [{ role: "user", parts: [{ text: request.prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: request.response_json_schema,
              temperature: 0.2,
              candidateCount: 1,
              maxOutputTokens: this.maxOutputTokens,
            },
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new LearningAnalyzerError(
            "MODEL_UNAVAILABLE",
            "Gemini sedang tidak tersedia atau kuota request tercapai.",
            { retryable: true },
          );
        }
        throw new LearningAnalyzerError(
          "MODEL_REQUEST_FAILED",
          `Permintaan Gemini ditolak (HTTP ${response.status}). Periksa konfigurasi model dan structured output.`,
        );
      }

      const payload = await response.json() as GeminiGenerateContentResponse;
      if (payload.promptFeedback?.blockReason) {
        throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", "Permintaan analisis ditolak oleh safety filter Gemini.");
      }

      const candidate = payload.candidates?.[0];
      if (!candidate) {
        throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", "Gemini tidak mengembalikan candidate hasil analisis.");
      }
      if (candidate.finishReason === "MAX_TOKENS") {
        throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", "Output Gemini terpotong karena batas token. Kurangi ukuran materi atau sesuaikan konfigurasi model.");
      }

      const text = candidate.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!text) {
        throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", "Gemini mengembalikan output kosong.");
      }

      try {
        return JSON.parse(text) as unknown;
      } catch (error) {
        throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", "Output Gemini bukan JSON yang valid.", { cause: error });
      }
    } catch (error) {
      if (error instanceof LearningAnalyzerError) throw error;
      if (controller.signal.aborted) {
        throw new LearningAnalyzerError("MODEL_TIMEOUT", "Permintaan Gemini melewati batas waktu.", {
          retryable: true,
          cause: error,
        });
      }
      throw new LearningAnalyzerError("MODEL_UNAVAILABLE", "Tidak dapat terhubung ke layanan Gemini.", {
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
