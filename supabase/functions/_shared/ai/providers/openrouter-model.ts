import { LearningAnalyzerError } from '../learning-analyzer/errors.ts';
import type {
  LearningAnalyzerModel,
  LearningAnalyzerModelRequest,
} from '../learning-analyzer/types.ts';

export interface OpenRouterModelOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface OpenRouterResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
}

export class OpenRouterModel implements LearningAnalyzerModel {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenRouterModelOptions) {
    if (!options.apiKey?.trim() || !options.model?.trim()) {
      throw new LearningAnalyzerError(
        'MODEL_CONFIGURATION_ERROR',
        'Konfigurasi OpenRouter belum lengkap.',
      );
    }

    this.apiKey = options.apiKey.trim();
    this.model = options.model.trim();
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateStructuredOutput(
    request: LearningAnalyzerModelRequest,
  ): Promise<unknown> {
    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: request.system_instruction,
              },
              {
                role: 'user',
                content:
                  request.prompt +
                  '\n\nReturn only valid JSON matching this schema:\n' +
                  JSON.stringify(request.response_json_schema),
              },
            ],
            temperature: 0.2,
            reasoning: {
              max_tokens: 256,
            },
            max_tokens: 4096,
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new LearningAnalyzerError(
            'MODEL_UNAVAILABLE',
            'OpenRouter sedang tidak tersedia atau kuota tercapai.',
            { retryable: true },
          );
        }

        throw new LearningAnalyzerError(
          'MODEL_REQUEST_FAILED',
          'Permintaan ke OpenRouter ditolak.',
        );
      }

      const data = (await response.json()) as OpenRouterResponse;

      const choice = data.choices?.[0];

      if (choice?.finish_reason === 'length') {
        throw new LearningAnalyzerError(
          'MODEL_INVALID_RESPONSE',
          'Output OpenRouter terpotong karena batas token.',
        );
      }

      const content = choice?.message?.content;

      if (typeof content !== 'string' || !content.trim()) {
        throw new LearningAnalyzerError(
          'MODEL_INVALID_RESPONSE',
          'OpenRouter menghasilkan respons kosong.',
        );
      }

      try {
        return JSON.parse(content);
      } catch {
        throw new LearningAnalyzerError(
          'MODEL_INVALID_RESPONSE',
          'Respons OpenRouter bukan JSON yang valid.',
        );
      }
    } catch (error) {
      if (error instanceof LearningAnalyzerError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new LearningAnalyzerError(
          'MODEL_TIMEOUT',
          'OpenRouter melewati batas waktu.',
          { retryable: true },
        );
      }

      throw new LearningAnalyzerError(
        'MODEL_UNAVAILABLE',
        'Tidak dapat menghubungi OpenRouter.',
        { retryable: true },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
