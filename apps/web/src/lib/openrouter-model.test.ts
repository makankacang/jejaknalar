import { describe, it, expect } from 'vitest';
import { OpenRouterModel } from '../../../../supabase/functions/_shared/ai/providers/openrouter-model.ts';

const request = {
  system_instruction: 'Kamu adalah Learning Analyzer.',
  prompt: 'Identifikasi tujuan pembelajaran.',
  response_json_schema: { type: 'object' },
};

describe('B-03 OpenRouter Adapter', () => {
  it('menerima respons JSON dari provider', async () => {
    const mockFetch: typeof fetch = async (url, options) => {
      expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');

      expect(new Headers(options?.headers).get('Authorization')).toBe(
        'Bearer dummy-test-key',
      );

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  objectives: [],
                  warnings: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    };

    const model = new OpenRouterModel({
      apiKey: 'dummy-test-key',
      model: 'test/model',
      fetchImpl: mockFetch,
    });

    const result = await model.generateStructuredOutput(request);

    expect(result).toEqual({
      objectives: [],
      warnings: [],
    });
  });

  it('menangani provider yang tidak tersedia', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response('Service unavailable', { status: 503 });

    const model = new OpenRouterModel({
      apiKey: 'dummy-test-key',
      model: 'test/model',
      fetchImpl: mockFetch,
    });

    await expect(model.generateStructuredOutput(request)).rejects.toMatchObject(
      {
        code: 'MODEL_UNAVAILABLE',
        retryable: true,
      },
    );
  });

  it('menolak output yang terpotong', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'length',
              message: {
                content: '{"objectives":[]}',
              },
            },
          ],
        }),
        { status: 200 },
      );

    const model = new OpenRouterModel({
      apiKey: 'dummy-test-key',
      model: 'test/model',
      fetchImpl: mockFetch,
    });

    await expect(model.generateStructuredOutput(request)).rejects.toMatchObject(
      {
        code: 'MODEL_INVALID_RESPONSE',
      },
    );
  });
});
