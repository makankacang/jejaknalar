import { LearningAnalyzerError } from "./errors.ts";
import { LEARNING_ANALYZER_RESPONSE_SCHEMA } from "./output-schema.ts";
import { buildLearningAnalyzerPrompt, LEARNING_ANALYZER_SYSTEM_INSTRUCTION } from "./prompt.ts";
import { resolveSourceReference, validateLearningAnalysisInput } from "./source-reference.ts";
import type {
  LearningAnalysisInput,
  LearningAnalysisResult,
  LearningAnalysisWarning,
  LearningAnalyzerModel,
  LearningObjective,
  LearningObjectiveBasis,
  RawLearningAnalyzerResponse,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRawResponse(value: unknown): RawLearningAnalyzerResponse {
  if (!isRecord(value) || !Array.isArray(value.objectives) || !Array.isArray(value.warnings)) {
    throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", "Respons AI tidak sesuai struktur Learning Analyzer.");
  }

  const objectives = value.objectives.map((item, index) => {
    if (!isRecord(item) || typeof item.statement !== "string" ||
      (item.basis !== "explicit" && item.basis !== "inferred") || !Array.isArray(item.evidence)) {
      throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", `Struktur objective ke-${index + 1} tidak valid.`);
    }

    const evidence = item.evidence.map((entry, evidenceIndex) => {
      if (!isRecord(entry) || typeof entry.source_id !== "string" || typeof entry.quote !== "string") {
        throw new LearningAnalyzerError(
          "MODEL_INVALID_RESPONSE",
          `Evidence ke-${evidenceIndex + 1} pada objective ke-${index + 1} tidak valid.`,
        );
      }
      return { source_id: entry.source_id, quote: entry.quote };
    });

    return {
      statement: item.statement,
      basis: item.basis as LearningObjectiveBasis,
      evidence,
    };
  });

  const warnings = value.warnings.map((warning) => {
    if (typeof warning !== "string") {
      throw new LearningAnalyzerError("MODEL_INVALID_RESPONSE", "Warnings dari AI harus berupa teks.");
    }
    return warning.trim().slice(0, 300);
  }).filter(Boolean).slice(0, 10);

  return { objectives, warnings };
}

function canonicalStatement(statement: string): string {
  return statement.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("id");
}

export async function analyzeLearningObjectives(
  input: LearningAnalysisInput,
  model: LearningAnalyzerModel,
): Promise<LearningAnalysisResult> {
  validateLearningAnalysisInput(input);
  if (!model || typeof model.generateStructuredOutput !== "function") {
    throw new LearningAnalyzerError("MODEL_CONFIGURATION_ERROR", "Model caller Learning Analyzer belum dikonfigurasi.");
  }

  let modelOutput: unknown;
  try {
    modelOutput = await model.generateStructuredOutput({
      system_instruction: LEARNING_ANALYZER_SYSTEM_INSTRUCTION,
      prompt: buildLearningAnalyzerPrompt(input),
      response_json_schema: LEARNING_ANALYZER_RESPONSE_SCHEMA,
    });
  } catch (error) {
    if (error instanceof LearningAnalyzerError) throw error;
    throw new LearningAnalyzerError("MODEL_UNAVAILABLE", "Layanan AI tidak dapat menyelesaikan analisis saat ini.", {
      retryable: true,
      cause: error,
    });
  }

  const raw = parseRawResponse(modelOutput);
  const warnings: LearningAnalysisWarning[] = raw.warnings.map((message) => ({
    code: "MODEL_WARNING",
    message,
  }));
  const seenStatements = new Set<string>();
  const objectives: LearningObjective[] = [];

  for (const rawObjective of raw.objectives) {
    const statement = rawObjective.statement.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (statement.length < 12 || statement.length > 300) {
      throw new LearningAnalyzerError(
        "MODEL_INVALID_RESPONSE",
        "Pernyataan learning objective harus memiliki 12–300 karakter.",
      );
    }

    const canonical = canonicalStatement(statement);
    if (seenStatements.has(canonical)) {
      warnings.push({
        code: "DUPLICATE_OBJECTIVE_REMOVED",
        message: `Tujuan duplikat dihapus: ${statement}`,
      });
      continue;
    }

    const sourceReferences = rawObjective.evidence
      .map((evidence) => resolveSourceReference(input, evidence))
      .filter((reference): reference is NonNullable<typeof reference> => reference !== null);

    const uniqueReferences = sourceReferences.filter((reference, index, all) =>
      all.findIndex((candidate) =>
        candidate.source_map_id === reference.source_map_id && candidate.excerpt === reference.excerpt
      ) === index,
    );

    if (uniqueReferences.length === 0) {
      warnings.push({
        code: "UNVERIFIED_EVIDENCE_REMOVED",
        message: `Tujuan tidak disertakan karena tidak memiliki kutipan sumber yang valid: ${statement}`,
      });
      continue;
    }

    if (uniqueReferences.length !== rawObjective.evidence.length) {
      warnings.push({
        code: "UNVERIFIED_EVIDENCE_REMOVED",
        message: `Sebagian kutipan sumber tidak valid dan diabaikan untuk tujuan: ${statement}`,
      });
    }

    seenStatements.add(canonical);
    objectives.push({
      statement,
      basis: rawObjective.basis,
      source_references: uniqueReferences,
    });
  }

  if (objectives.length === 0) {
    warnings.push({
      code: "NO_SUPPORTED_OBJECTIVES",
      message: "Tidak ditemukan tujuan pembelajaran dengan bukti sumber yang cukup. Periksa kelengkapan atau relevansi materi.",
    });
  }

  return {
    analysis_schema_version: "1.0",
    module_id: input.module_id,
    document_id: input.document.documentId,
    text_version: input.text_version,
    status: objectives.length > 0 ? "completed" : "insufficient_evidence",
    objectives,
    warnings,
  };
}
