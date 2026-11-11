/**
 * Server-side boundary type for the C-01 parser result.
 *
 * Keep this shape structurally aligned with
 * `apps/web/src/lib/parser/types.ts`. It is intentionally declared inside
 * `supabase/functions` so an Edge Function never needs to import application
 * code from `apps/web` at runtime.
 */
export type DocumentFormat = "pdf" | "docx";

export type DocumentSourceReference =
  | {
      /** Stable within one parse result, e.g. "PDF-P-002". */
      id: string;
      kind: "page";
      /** Original PDF page number, starting at 1. */
      page: number;
      text: string;
    }
  | {
      /** Stable within one parse result, e.g. "DOC-P-001". */
      id: string;
      kind: "paragraph";
      /** One-based index of non-empty text paragraphs; not a page number. */
      paragraphIndex: number;
      /** Nearest preceding heading, when available. */
      section?: string;
      text: string;
    };

export interface DocumentParseResult {
  /** Deterministic identifier derived from file content. */
  documentId: string;
  filename: string;
  format: DocumentFormat;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  sourceMap: DocumentSourceReference[];
  metadata: {
    pageCount?: number;
    paragraphCount?: number;
  };
  warnings: string[];
}
