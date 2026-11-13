import { describe, expect, it } from 'vitest';

import { OpenRouterModel } from '../../../../supabase/functions/_shared/ai/providers/openrouter-model.ts';

import { analyzeLearningObjectives } from '../../../../supabase/functions/_shared/ai/learning-analyzer/analyzer.ts';

import type { LearningAnalysisInput } from '../../../../supabase/functions/_shared/ai/learning-analyzer/types.ts';

const sourceText =
  'Teks deskripsi menggambarkan ciri-ciri objek secara jelas agar pembaca dapat membayangkannya.';

const input: LearningAnalysisInput = {
  module_id: 'B03-MOCK-MODULE',
  text_version: 'B03-MOCK-V1',
  document: {
    documentId: 'B03-MOCK-DOC',
    filename: 'materi-deskripsi.pdf',
    format: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    extractedText: sourceText,
    sourceMap: [
      {
        id: 'PDF-P-001',
        kind: 'page',
        page: 1,
        text: sourceText,
      },
    ],
    metadata: {
      pageCount: 1,
    },
    warnings: [],
  },
};

function createMockOpenRouter(
  sourceId: string,
  quote: string,
): OpenRouterModel {
  const aiOutput = {
    objectives: [
      {
        statement:
          'Siswa mampu mengidentifikasi ciri-ciri objek yang dijelaskan dalam teks deskripsi.',
        basis: 'inferred',
        evidence: [
          {
            source_id: sourceId,
            quote,
          },
        ],
      },
    ],
    warnings: [],
  };

  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify(aiOutput),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

  return new OpenRouterModel({
    apiKey: 'dummy-test-key',
    model: 'mock/model',
    fetchImpl: mockFetch,
  });
}

describe('B-03 OpenRouter + PIC C Learning Analyzer', () => {
  it('menerima Learning Objective dengan sumber valid', async () => {
    const model = createMockOpenRouter(
      'PDF-P-001',
      'Teks deskripsi menggambarkan ciri-ciri objek secara jelas',
    );

    const result = await analyzeLearningObjectives(input, model);

    expect(result.status).toBe('completed');
    expect(result.objectives).toHaveLength(1);

    expect(result.objectives[0].source_references[0]).toMatchObject({
      source_type: 'pdf',
      source_map_id: 'PDF-P-001',
      page: 1,
    });
  });

  it('menolak Learning Objective dengan sumber tidak valid', async () => {
    const model = createMockOpenRouter(
      'PDF-P-999',
      'Teks deskripsi menggambarkan ciri-ciri objek secara jelas',
    );

    const result = await analyzeLearningObjectives(input, model);

    expect(result.status).toBe('insufficient_evidence');
    expect(result.objectives).toHaveLength(0);

    expect(
      result.warnings.some(
        (warning) => warning.code === 'UNVERIFIED_EVIDENCE_REMOVED',
      ),
    ).toBe(true);
  });
});
