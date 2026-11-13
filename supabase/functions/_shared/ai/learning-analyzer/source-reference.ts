import { LearningAnalyzerError } from "./errors.ts";
import type {
  LearningAnalysisInput,
  LearningAnalyzerSource,
  LearningObjectiveSourceReference,
} from "./types.ts";

export interface RawEvidence {
  source_id: string;
  quote: string;
}

interface NormalizedTextWithOffsets {
  value: string;
  starts: number[];
  ends: number[];
}

function normalizeTextWithOffsets(input: string): NormalizedTextWithOffsets {
  let value = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let pendingWhitespace: { start: number; end: number } | null = null;

  for (let index = 0; index < input.length;) {
    const codePoint = String.fromCodePoint(input.codePointAt(index) ?? 0);
    const originalStart = index;
    const originalEnd = index + codePoint.length;
    index = originalEnd;

    const normalizedPoint = codePoint.normalize("NFKC").toLocaleLowerCase("id");
    if (/^\s+$/u.test(normalizedPoint)) {
      if (pendingWhitespace) pendingWhitespace.end = originalEnd;
      else pendingWhitespace = { start: originalStart, end: originalEnd };
      continue;
    }

    if (pendingWhitespace && value.length > 0) {
      value += " ";
      starts.push(pendingWhitespace.start);
      ends.push(pendingWhitespace.end);
    }
    pendingWhitespace = null;

    value += normalizedPoint;
    for (let unit = 0; unit < normalizedPoint.length; unit += 1) {
      starts.push(originalStart);
      ends.push(originalEnd);
    }
  }

  return { value, starts, ends };
}

export function normalizeEvidenceText(value: string): string {
  return normalizeTextWithOffsets(value).value;
}

function findVerifiedExcerpt(sourceText: string, quote: string): string | null {
  const normalizedSource = normalizeTextWithOffsets(sourceText);
  const normalizedQuote = normalizeEvidenceText(quote);
  if (normalizedQuote.length < 8) return null;

  const matchAt = normalizedSource.value.indexOf(normalizedQuote);
  if (matchAt < 0) return null;
  const finalIndex = matchAt + normalizedQuote.length - 1;
  const start = normalizedSource.starts[matchAt];
  const end = normalizedSource.ends[finalIndex];
  return sourceText.slice(start, end).trim();
}

export function resolveSourceReference(
  input: LearningAnalysisInput,
  evidence: RawEvidence,
): LearningObjectiveSourceReference | null {
  const source: LearningAnalyzerSource | undefined = input.document.sourceMap.find(
    (candidate) => candidate.id === evidence.source_id,
  );

  if (!source || typeof evidence.quote !== "string") return null;
  const quote = evidence.quote.trim();
  if (quote.length < 8 || quote.length > 1000) return null;
  const verifiedExcerpt = findVerifiedExcerpt(source.text, quote);
  if (!verifiedExcerpt) return null;

  if (source.kind === "page") {
    return {
      source_type: "pdf",
      source_map_id: source.id,
      page: source.page,
      excerpt: verifiedExcerpt,
    };
  }

  return {
    source_type: "docx",
    source_map_id: source.id,
    paragraph_index: source.paragraphIndex,
    ...(source.section ? { section: source.section } : {}),
    excerpt: verifiedExcerpt,
  };
}

export function validateLearningAnalysisInput(input: LearningAnalysisInput): void {
  if (!input || typeof input !== "object") {
    throw new LearningAnalyzerError("INVALID_INPUT", "Input analisis tidak valid.");
  }

  const moduleId = typeof input.module_id === "string" ? input.module_id.trim() : "";
  const textVersion = typeof input.text_version === "string" ? input.text_version.trim() : "";
  const document = input.document;

  if (!moduleId || moduleId.length > 128 || !textVersion || textVersion.length > 128) {
    throw new LearningAnalyzerError("INVALID_INPUT", "module_id dan text_version wajib diisi (maksimal 128 karakter).");
  }
  if (!document || typeof document !== "object") {
    throw new LearningAnalyzerError("INVALID_INPUT", "Snapshot hasil parser C-01 tidak tersedia.");
  }
  if (typeof document.documentId !== "string" || !document.documentId.trim() ||
      typeof document.filename !== "string" || !document.filename.trim() ||
      (document.format !== "pdf" && document.format !== "docx") ||
      typeof document.mimeType !== "string" || !document.mimeType.trim() ||
      !Number.isSafeInteger(document.sizeBytes) || document.sizeBytes < 0) {
    throw new LearningAnalyzerError("INVALID_INPUT", "Metadata snapshot hasil parser C-01 tidak lengkap atau tidak valid.");
  }
  if (typeof document.extractedText !== "string" || !document.extractedText.trim()) {
    throw new LearningAnalyzerError("NO_ANALYZABLE_TEXT", "Dokumen tidak memiliki teks yang dapat dianalisis.");
  }
  if (!Array.isArray(document.sourceMap)) {
    throw new LearningAnalyzerError("INVALID_INPUT", "sourceMap dari snapshot C-01 tidak valid.");
  }
  if (!document.metadata || typeof document.metadata !== "object" || Array.isArray(document.metadata) ||
      !Array.isArray(document.warnings) || document.warnings.some((warning) => typeof warning !== "string")) {
    throw new LearningAnalyzerError("INVALID_INPUT", "Metadata tambahan atau warnings dari snapshot C-01 tidak valid.");
  }

  const optionalCount = document.format === "pdf" ? document.metadata.pageCount : document.metadata.paragraphCount;
  if (optionalCount !== undefined && (!Number.isInteger(optionalCount) || optionalCount < 1)) {
    throw new LearningAnalyzerError("INVALID_INPUT", "Jumlah halaman/paragraf pada metadata C-01 tidak valid.");
  }

  const ids = new Set<string>();
  const normalizedExtractedText = normalizeEvidenceText(document.extractedText);
  let hasAnalyzableSource = false;

  for (const rawSource of document.sourceMap as unknown[]) {
    if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
      throw new LearningAnalyzerError("INVALID_INPUT", "Terdapat entri sourceMap yang tidak valid.");
    }
    const source = rawSource as Record<string, unknown>;
    if (typeof source.id !== "string" || !source.id.trim() || typeof source.text !== "string") {
      throw new LearningAnalyzerError("INVALID_INPUT", "Terdapat entri sourceMap yang tidak valid.");
    }
    if (ids.has(source.id)) {
      throw new LearningAnalyzerError("INVALID_INPUT", `sourceMap memiliki ID duplikat: ${source.id}.`);
    }
    ids.add(source.id);

    if (source.text.trim().length > 0) {
      hasAnalyzableSource = true;
      if (!normalizedExtractedText.includes(normalizeEvidenceText(source.text))) {
        throw new LearningAnalyzerError(
          "INVALID_INPUT",
          `Teks sumber ${source.id} tidak cocok dengan extractedText pada snapshot yang sama.`,
        );
      }
    }

    if (document.format === "pdf") {
      if (source.kind !== "page" || !Number.isInteger(source.page) || (source.page as number) < 1) {
        throw new LearningAnalyzerError("INVALID_INPUT", `Referensi PDF ${source.id} harus memiliki nomor halaman asli yang valid.`);
      }
      const expectedSourceId = `PDF-P-${String(source.page).padStart(3, "0")}`;
      if (source.id !== expectedSourceId) {
        throw new LearningAnalyzerError(
          "INVALID_INPUT",
          `ID referensi PDF ${source.id} tidak cocok dengan halaman ${source.page}; expected ${expectedSourceId}.`,
        );
      }
    } else {
      if (source.kind !== "paragraph" ||
          !Number.isInteger(source.paragraphIndex) || (source.paragraphIndex as number) < 1 ||
          (source.section !== undefined && typeof source.section !== "string")) {
        throw new LearningAnalyzerError("INVALID_INPUT", `Referensi DOCX ${source.id} harus memiliki nomor paragraf/bagian yang valid.`);
      }
      const expectedSourceId = `DOC-P-${String(source.paragraphIndex).padStart(3, "0")}`;
      if (source.id !== expectedSourceId) {
        throw new LearningAnalyzerError(
          "INVALID_INPUT",
          `ID referensi DOCX ${source.id} tidak cocok dengan paragraf ${source.paragraphIndex}; expected ${expectedSourceId}.`,
        );
      }
    }
  }

  if (!hasAnalyzableSource) {
    throw new LearningAnalyzerError("NO_ANALYZABLE_TEXT", "Tidak ditemukan sumber berisi teks yang dapat dianalisis.");
  }
}
