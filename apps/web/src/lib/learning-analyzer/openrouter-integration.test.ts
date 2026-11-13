import { describe, expect, it } from "vitest";
import { OpenRouterModel } from "../../../../../supabase/functions/_shared/ai/providers/openrouter-model.ts";
import { analyzeLearningObjectives } from "../../../../../supabase/functions/_shared/ai/learning-analyzer/analyzer.ts";
import type { LearningAnalysisInput } from "../../../../../supabase/functions/_shared/ai/learning-analyzer/types.ts";

const sourceText =
  "Teks deskripsi menggambarkan ciri-ciri objek secara jelas agar pembaca dapat membayangkannya.";

const input: LearningAnalysisInput = {
  module_id: "C-03-MOCK-MODULE",
  text_version: "C-03-MOCK-V1",
  document: {
    documentId: "C-03-MOCK-DOC",
    filename: "materi-deskripsi.pdf",
    format: "pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    extractedText: sourceText,
    sourceMap: [
      { id: "PDF-P-001", kind: "page", page: 1, text: sourceText },
    ],
    metadata: { pageCount: 1 },
    warnings: [],
  },
};

function createMockOpenRouter(sourceId: string, quote: string): OpenRouterModel {
  const aiOutput = {
    objectives: [{
      statement: "Siswa mampu mengidentifikasi ciri-ciri objek berdasarkan teks deskripsi.",
      basis: "inferred",
      evidence: [{ source_id: sourceId, quote }],
    }],
    warnings: [],
  };

  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: { content: JSON.stringify(aiOutput) },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  return new OpenRouterModel({ apiKey: "test-only-key", model: "mock/model", fetchImpl });
}

describe("OpenRouter + C-02 Learning Analyzer compatibility", () => {
  it("accepts Learning Objectives with verified source references", async () => {
    const model = createMockOpenRouter(
      "PDF-P-001",
      "Teks deskripsi menggambarkan ciri-ciri objek secara jelas",
    );
    const result = await analyzeLearningObjectives(input, model);

    expect(result.status).toBe("completed");
    expect(result.objectives).toHaveLength(1);
    expect(result.objectives[0].source_references[0]).toMatchObject({
      source_type: "pdf",
      source_map_id: "PDF-P-001",
      page: 1,
    });
  });

  it("rejects Learning Objectives that reference an unknown source", async () => {
    const model = createMockOpenRouter(
      "PDF-P-999",
      "Teks deskripsi menggambarkan ciri-ciri objek secara jelas",
    );
    const result = await analyzeLearningObjectives(input, model);

    expect(result.status).toBe("insufficient_evidence");
    expect(result.objectives).toHaveLength(0);
    expect(result.warnings.some((warning) =>
      warning.code === "UNVERIFIED_EVIDENCE_REMOVED"
    )).toBe(true);
  });
});
