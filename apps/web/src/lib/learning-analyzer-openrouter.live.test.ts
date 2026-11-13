import { expect, it } from 'vitest';

import { OpenRouterModel } from '../../../../supabase/functions/_shared/ai/providers/openrouter-model.ts';
import { analyzeLearningObjectives } from '../../../../supabase/functions/_shared/ai/learning-analyzer/analyzer.ts';
import type { LearningAnalysisInput } from '../../../../supabase/functions/_shared/ai/learning-analyzer/types.ts';

const apiKey = (
  globalThis as typeof globalThis & {
    process?: {
      env?: {
        OPENROUTER_API_KEY?: string;
      };
    };
  }
).process?.env?.OPENROUTER_API_KEY;

const sourceText =
  'Tujuan pembelajaran: siswa mampu mengidentifikasi ciri-ciri objek ' +
  'berdasarkan teks deskripsi. Teks deskripsi menggambarkan ciri-ciri ' +
  'objek secara jelas agar pembaca dapat membayangkannya. ' +
  'Siswa menggunakan informasi dari teks untuk menjelaskan objek ' +
  'berdasarkan bukti yang ditemukan dalam bacaan.';

const input: LearningAnalysisInput = {
  module_id: 'B03-LIVE-SYNTHETIC-MODULE',
  text_version: 'B03-LIVE-SYNTHETIC-V1',
  document: {
    documentId: 'B03-LIVE-SYNTHETIC-DOC',
    filename: 'contoh-deskripsi.pdf',
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
    metadata: { pageCount: 1 },
    warnings: [],
  },
};

it.skipIf(!apiKey)(
  'OpenRouter asli menghasilkan LO dengan sumber terverifikasi',
  async () => {
    const model = new OpenRouterModel({
      apiKey: apiKey!,
      model: 'nvidia/nemotron-3.5-lightning:free',
      timeoutMs: 60_000,
    });

    const result = await analyzeLearningObjectives(input, model);

    expect(result.status).toBe('completed');
    expect(result.objectives.length).toBeGreaterThan(0);

    for (const objective of result.objectives) {
      expect(objective.source_references.length).toBeGreaterThan(0);

      for (const reference of objective.source_references) {
        expect(reference.source_map_id).toBe('PDF-P-001');
        expect(reference.source_type).toBe('pdf');
        expect(sourceText).toContain(reference.excerpt);
      }
    }
  },
  90_000,
);
