/**
 * Batas dokumen untuk parser (C-01).
 *
 * Batas 20 halaman PDF adalah KEBIJAKAN PRODUK MVP, bukan keterbatasan PDF.js.
 * Ubah nilai di sini (satu-satunya tempat) jika tim menyetujui perubahan.
 * Jangan menulis angka batas secara langsung di fungsi parser lain.
 */
export interface DocumentLimits {
  /** Ukuran file maksimum (byte) untuk PDF dan DOCX. */
  maxFileSizeBytes: number;
  /** Jumlah halaman PDF maksimum. DOCX tidak memiliki batas halaman. */
  maxPdfPages: number;
}

export const DOCUMENT_LIMITS: Readonly<DocumentLimits> = Object.freeze({
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxPdfPages: 20,
});

export interface ParseOptions {
  /** Menimpa sebagian batas default (mis. untuk pengujian atau persetujuan tim). */
  limits?: Partial<DocumentLimits>;
}

export function resolveLimits(options?: ParseOptions): DocumentLimits {
  return { ...DOCUMENT_LIMITS, ...options?.limits };
}
