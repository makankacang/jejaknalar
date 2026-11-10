export type DocumentFormat = 'pdf' | 'docx';

export type DocumentSourceReference =
  | {
      /** Stabil dalam satu hasil parse, mis. "PDF-P-002". */
      id: string;
      kind: 'page';
      /** Nomor halaman asli PDF (mulai 1). Teks kosong berarti halaman tanpa teks. */
      page: number;
      text: string;
    }
  | {
      /** Stabil dalam satu hasil parse, mis. "DOC-P-001". */
      id: string;
      kind: 'paragraph';
      /** Urutan paragraf BERISI TEKS dalam dokumen, mulai 1. Bukan nomor halaman. */
      paragraphIndex: number;
      /** Judul (heading) terdekat di atas paragraf, bila ada. */
      section?: string;
      text: string;
    };

export interface DocumentParseResult {
  /** ID deterministik berbasis isi file (SHA-256 terpotong) — cocok untuk cache. */
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
