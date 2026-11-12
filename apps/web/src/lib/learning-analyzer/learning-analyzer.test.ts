import { describe, expect, it, vi } from 'vitest';
import type { DocumentParseResult as C01DocumentParseResult } from '../parser/types';
import {
  analyzeLearningObjectives,
  GeminiRestModel,
  LearningAnalyzerError,
  type LearningAnalysisInput,
  type LearningAnalyzerModel,
} from '../../../../../supabase/functions/_shared/ai/learning-analyzer/index.ts';

const pdfInput: LearningAnalysisInput = {
  module_id: 'MODULE-BAHASA-7',
  text_version: 'TEXT-V1',
  document: {
    documentId: 'doc_0123456789abcdef',
    filename: 'teks-deskripsi.pdf',
    format: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    extractedText: '[Halaman 1]\nTujuan Pembelajaran\nSiswa dapat mengidentifikasi ciri teks deskripsi.\n\n[Halaman 2]\nTeks deskripsi menggambarkan objek secara rinci melalui pengamatan pancaindra.',
    sourceMap: [
      {
        id: 'PDF-P-001',
        kind: 'page',
        page: 1,
        text: 'Tujuan Pembelajaran\nSiswa dapat mengidentifikasi ciri teks deskripsi.',
      },
      {
        id: 'PDF-P-002',
        kind: 'page',
        page: 2,
        text: 'Teks deskripsi menggambarkan objek secara rinci melalui pengamatan pancaindra.',
      },
    ],
    metadata: { pageCount: 2 },
    warnings: [],
  },
  context: { grade: 7, subject: 'Bahasa Indonesia', topic: 'Teks Deskripsi' },
};

const docxInput: LearningAnalysisInput = {
  ...pdfInput,
  text_version: 'TEXT-DOCX-V1',
  document: {
    ...pdfInput.document,
    documentId: 'doc_fedcba9876543210',
    filename: 'teks-deskripsi.docx',
    format: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extractedText: 'Ciri-ciri\nTeks deskripsi menggambarkan objek secara rinci melalui pengamatan pancaindra.',
    sourceMap: [
      { id: 'DOC-P-001', kind: 'paragraph', paragraphIndex: 1, section: 'Ciri-ciri', text: 'Ciri-ciri' },
      {
        id: 'DOC-P-002',
        kind: 'paragraph',
        paragraphIndex: 2,
        section: 'Ciri-ciri',
        text: 'Teks deskripsi menggambarkan objek secara rinci melalui pengamatan pancaindra.',
      },
    ],
    metadata: { paragraphCount: 2 },
  },
};

function fakeModel(output: unknown): LearningAnalyzerModel {
  return { generateStructuredOutput: vi.fn().mockResolvedValue(output) };
}

const supportedOutput = {
  objectives: [
    {
      statement: 'Siswa mampu mengidentifikasi ciri-ciri teks deskripsi.',
      basis: 'explicit',
      evidence: [{
        source_id: 'PDF-P-001',
        quote: 'Siswa dapat mengidentifikasi ciri teks deskripsi.',
      }],
    },
    {
      statement: 'Siswa mampu menjelaskan cara teks deskripsi menggambarkan objek.',
      basis: 'inferred',
      evidence: [{
        source_id: 'PDF-P-002',
        quote: 'Teks deskripsi menggambarkan objek secara rinci melalui pengamatan pancaindra.',
      }],
    },
  ],
  warnings: [],
};

describe('C-02 Learning Analyzer', () => {
  it('accepts the unchanged C-01 parser result shape at the server boundary', async () => {
    // Compile-time assignment verifies both contracts stay structurally compatible.
    const parserSnapshot: C01DocumentParseResult = pdfInput.document;
    const analyzerInput: LearningAnalysisInput = { ...pdfInput, document: parserSnapshot };
    const result = await analyzeLearningObjectives(analyzerInput, fakeModel(supportedOutput));

    expect(result.document_id).toBe(parserSnapshot.documentId);
  });

  it('menolak extractedText dan sourceMap yang berasal dari snapshot berbeda', async () => {
    const input: LearningAnalysisInput = {
      ...pdfInput,
      document: {
        ...pdfInput.document,
        extractedText: 'Materi dari versi dokumen yang berbeda.',
      },
    };

    await expect(analyzeLearningObjectives(input, fakeModel(supportedOutput)))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('menghasilkan LO terstruktur dan mempertahankan identitas modul, dokumen, serta versi teks', async () => {
    const result = await analyzeLearningObjectives(pdfInput, fakeModel(supportedOutput));

    expect(result).toMatchObject({
      analysis_schema_version: '1.0',
      module_id: 'MODULE-BAHASA-7',
      document_id: 'doc_0123456789abcdef',
      text_version: 'TEXT-V1',
      status: 'completed',
    });
    expect(result.objectives).toHaveLength(2);
    expect(result.objectives[0].basis).toBe('explicit');
    expect(result.objectives[1].basis).toBe('inferred');
    expect(result.objectives[0]).not.toHaveProperty('id');
    expect(result.objectives[1]).not.toHaveProperty('id');
  });

  it('mengembalikan excerpt persis dari sourceMap meskipun quote model berbeda kapitalisasi dan whitespace', async () => {
    const result = await analyzeLearningObjectives(pdfInput, fakeModel({
      objectives: [{
        statement: 'Siswa mampu mengidentifikasi ciri-ciri teks deskripsi.',
        basis: 'explicit',
        evidence: [{
          source_id: 'PDF-P-001',
          quote: 'siswa dapat   mengidentifikasi CIRI teks deskripsi.',
        }],
      }],
      warnings: [],
    }));

    expect(result.objectives[0].source_references[0].excerpt)
      .toBe('Siswa dapat mengidentifikasi ciri teks deskripsi.');
  });

  it('mengambil metadata halaman PDF dari sourceMap, bukan dari klaim model', async () => {
    const result = await analyzeLearningObjectives(pdfInput, fakeModel({
      objectives: [{
        statement: 'Siswa mampu mengidentifikasi ciri-ciri teks deskripsi.',
        basis: 'explicit',
        evidence: [{ source_id: 'PDF-P-001', quote: 'Siswa dapat mengidentifikasi ciri teks deskripsi.' }],
      }],
      warnings: [],
    }));

    expect(result.objectives[0].source_references[0]).toEqual({
      source_type: 'pdf',
      source_map_id: 'PDF-P-001',
      page: 1,
      excerpt: 'Siswa dapat mengidentifikasi ciri teks deskripsi.',
    });
  });

  it('menghasilkan referensi DOCX berbasis paragraf tanpa nomor halaman', async () => {
    const result = await analyzeLearningObjectives(docxInput, fakeModel({
      objectives: [{
        statement: 'Siswa mampu menjelaskan cara teks deskripsi menggambarkan objek.',
        basis: 'inferred',
        evidence: [{
          source_id: 'DOC-P-002',
          quote: 'Teks deskripsi menggambarkan objek secara rinci melalui pengamatan pancaindra.',
        }],
      }],
      warnings: [],
    }));

    expect(result.objectives[0].source_references[0]).toEqual({
      source_type: 'docx',
      source_map_id: 'DOC-P-002',
      paragraph_index: 2,
      section: 'Ciri-ciri',
      excerpt: 'Teks deskripsi menggambarkan objek secara rinci melalui pengamatan pancaindra.',
    });
    expect(result.objectives[0].source_references[0]).not.toHaveProperty('page');
    expect(result.objectives[0].source_references[0].source_map_id).toBe('DOC-P-002');
  });

  it('membuang evidence palsu dan tidak meloloskan LO tanpa sumber valid', async () => {
    const result = await analyzeLearningObjectives(pdfInput, fakeModel({
      objectives: [{
        statement: 'Siswa mampu mengidentifikasi ciri-ciri teks deskripsi.',
        basis: 'explicit',
        evidence: [{ source_id: 'PDF-P-999', quote: 'Kutipan yang tidak ada pada dokumen sumber.' }],
      }],
      warnings: [],
    }));

    expect(result.status).toBe('insufficient_evidence');
    expect(result.objectives).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain('UNVERIFIED_EVIDENCE_REMOVED');
  });

  it('mempertahankan LO jika setidaknya satu dari beberapa evidence valid', async () => {
    const result = await analyzeLearningObjectives(pdfInput, fakeModel({
      objectives: [{
        statement: 'Siswa mampu mengidentifikasi ciri-ciri teks deskripsi.',
        basis: 'explicit',
        evidence: [
          { source_id: 'PDF-P-999', quote: 'Kutipan yang tidak ada pada dokumen sumber.' },
          { source_id: 'PDF-P-001', quote: 'Siswa dapat mengidentifikasi ciri teks deskripsi.' },
        ],
      }],
      warnings: [],
    }));

    expect(result.status).toBe('completed');
    expect(result.objectives).toHaveLength(1);
    expect(result.objectives[0].source_references).toHaveLength(1);
    expect(result.warnings.map((warning) => warning.code)).toContain('UNVERIFIED_EVIDENCE_REMOVED');
  });

  it('mendeduplikasi pernyataan LO tanpa membedakan kapitalisasi dan whitespace', async () => {
    const result = await analyzeLearningObjectives(pdfInput, fakeModel({
      objectives: [
        {
          statement: 'Siswa mampu mengidentifikasi ciri-ciri teks deskripsi.',
          basis: 'explicit',
          evidence: [{ source_id: 'PDF-P-001', quote: 'Siswa dapat mengidentifikasi ciri teks deskripsi.' }],
        },
        {
          statement: '  SISWA mampu mengidentifikasi ciri-ciri teks deskripsi. ',
          basis: 'explicit',
          evidence: [{ source_id: 'PDF-P-001', quote: 'Siswa dapat mengidentifikasi ciri teks deskripsi.' }],
        },
      ],
      warnings: [],
    }));

    expect(result.objectives).toHaveLength(1);
    expect(result.warnings.map((warning) => warning.code)).toContain('DUPLICATE_OBJECTIVE_REMOVED');
  });

  it('mengembalikan insufficient_evidence ketika model tidak menemukan LO', async () => {
    const result = await analyzeLearningObjectives(pdfInput, fakeModel({ objectives: [], warnings: ['Materi terlalu singkat.'] }));

    expect(result.status).toBe('insufficient_evidence');
    expect(result.objectives).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain('MODEL_WARNING');
    expect(result.warnings.map((warning) => warning.code)).toContain('NO_SUPPORTED_OBJECTIVES');
  });

  it('menolak input tanpa text_version', async () => {
    const input = { ...pdfInput, text_version: ' ' };

    await expect(analyzeLearningObjectives(input, fakeModel(supportedOutput)))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('menolak dokumen tanpa sumber teks yang bisa dianalisis', async () => {
    const input: LearningAnalysisInput = {
      ...pdfInput,
      document: { ...pdfInput.document, extractedText: ' ', sourceMap: [] },
    };

    await expect(analyzeLearningObjectives(input, fakeModel(supportedOutput)))
      .rejects.toMatchObject({ code: 'NO_ANALYZABLE_TEXT' });
  });

  it('menolak jenis referensi yang tidak sesuai format dokumen', async () => {
    const input: LearningAnalysisInput = {
      ...docxInput,
      document: {
        ...docxInput.document,
        sourceMap: [pdfInput.document.sourceMap[0]],
      },
    };

    await expect(analyzeLearningObjectives(input, fakeModel(supportedOutput)))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('menolak ID PDF yang tidak cocok dengan nomor halaman sumber', async () => {
    const input: LearningAnalysisInput = {
      ...pdfInput,
      document: {
        ...pdfInput.document,
        sourceMap: pdfInput.document.sourceMap.map((source, index) =>
          index === 0 ? { ...source, page: 2 } : source,
        ),
      },
    };

    await expect(analyzeLearningObjectives(input, fakeModel(supportedOutput)))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('menolak ID DOCX yang tidak cocok dengan indeks paragraf sumber', async () => {
    const input: LearningAnalysisInput = {
      ...docxInput,
      document: {
        ...docxInput.document,
        sourceMap: docxInput.document.sourceMap.map((source, index) =>
          index === 1 && source.kind === 'paragraph'
            ? { ...source, paragraphIndex: 3 }
            : source,
        ),
      },
    };

    await expect(analyzeLearningObjectives(input, fakeModel(supportedOutput)))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('menolak ID sourceMap duplikat', async () => {
    const input: LearningAnalysisInput = {
      ...pdfInput,
      document: {
        ...pdfInput.document,
        sourceMap: [pdfInput.document.sourceMap[0], pdfInput.document.sourceMap[0]],
      },
    };

    await expect(analyzeLearningObjectives(input, fakeModel(supportedOutput)))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('menolak output model malformed', async () => {
    await expect(analyzeLearningObjectives(pdfInput, fakeModel({ objectives: 'bukan-array', warnings: [] })))
      .rejects.toMatchObject({ code: 'MODEL_INVALID_RESPONSE' });
  });

  it('memetakan kegagalan model ke error internal yang aman', async () => {
    const model: LearningAnalyzerModel = {
      generateStructuredOutput: vi.fn().mockRejectedValue(new Error('private network detail')),
    };

    await expect(analyzeLearningObjectives(pdfInput, model)).rejects.toMatchObject({
      code: 'MODEL_UNAVAILABLE',
      retryable: true,
      message: 'Layanan AI tidak dapat menyelesaikan analisis saat ini.',
    });
  });

  it('memasukkan sumber terstruktur dan perlindungan prompt injection ke prompt model', async () => {
    const model = fakeModel({ objectives: [], warnings: [] });
    await analyzeLearningObjectives(pdfInput, model);

    const request = vi.mocked(model.generateStructuredOutput).mock.calls[0][0];
    expect(request.system_instruction).toContain('DATA TIDAK TEPERCAYA');
    expect(request.prompt).toContain('PDF-P-001');
    expect(request.prompt).toContain('text_version');
    expect(request.response_json_schema).toMatchObject({ type: 'object' });
  });
});

describe('GeminiRestModel', () => {
  it('mengirim structured-output request dan membaca JSON result', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        finishReason: 'STOP',
        content: { parts: [{ text: JSON.stringify({ objectives: [], warnings: [] }) }] },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const model = new GeminiRestModel({
      apiKey: 'test-only-key',
      model: 'test-model',
      fetchImpl: fetchMock,
    });
    const output = await model.generateStructuredOutput({
      system_instruction: 'system',
      prompt: 'user',
      response_json_schema: { type: 'object' },
    });

    expect(output).toEqual({ objectives: [], warnings: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/models/test-model:generateContent');
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('test-only-key');
    const body = JSON.parse(String(init?.body)) as { generationConfig: Record<string, unknown> };
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
      temperature: 0.2,
    });
  });

  it('memetakan HTTP 429/5xx menjadi model unavailable tanpa memaparkan body provider', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('private provider detail', { status: 503 }));
    const model = new GeminiRestModel({ apiKey: 'test-only-key', model: 'test-model', fetchImpl: fetchMock });

    await expect(model.generateStructuredOutput({
      system_instruction: 'system', prompt: 'user', response_json_schema: {},
    })).rejects.toMatchObject({
      code: 'MODEL_UNAVAILABLE',
      retryable: true,
      message: 'Gemini sedang tidak tersedia atau kuota request tercapai.',
    });
  });

  it('menolak konfigurasi tanpa API key atau model', () => {
    expect(() => new GeminiRestModel({ apiKey: '', model: 'test-model' }))
      .toThrowError(LearningAnalyzerError);
    expect(() => new GeminiRestModel({ apiKey: 'test-only-key', model: 'bad/model' }))
      .toThrowError(LearningAnalyzerError);
  });
});
