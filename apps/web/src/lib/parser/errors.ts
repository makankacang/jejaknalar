/**
 * Kode error parser sisi-klien. Sengaja terpisah dari `contracts/error-codes.md`
 * (kode HTTP API). Jika PIC B ingin memetakan ke API, lakukan lewat CCR.
 */
export type DocumentParseErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PDF_PAGE_LIMIT_EXCEEDED'
  | 'PDF_INVALID'
  | 'PDF_PASSWORD_PROTECTED'
  | 'EMPTY_DOCUMENT'
  | 'NO_EXTRACTABLE_TEXT'
  | 'DOCX_INVALID'
  | 'EXTRACTION_FAILED';

export type DocumentParseErrorDetails = Record<string, string | number | boolean>;

/**
 * Error terkontrol. `message` aman ditampilkan ke guru: tidak memuat isi dokumen
 * maupun stack trace internal. `details` hanya berisi angka/label non-sensitif.
 */
export class DocumentParseError extends Error {
  readonly code: DocumentParseErrorCode;
  readonly details?: DocumentParseErrorDetails;

  constructor(
    code: DocumentParseErrorCode,
    message: string,
    details?: DocumentParseErrorDetails,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'DocumentParseError';
    this.code = code;
    this.details = details;
  }

  /** Bentuk serializable `{ code, message, details }` tanpa stack trace. */
  toJSON(): { code: DocumentParseErrorCode; message: string; details?: DocumentParseErrorDetails } {
    return { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) };
  }
}

export function isDocumentParseError(value: unknown): value is DocumentParseError {
  return value instanceof DocumentParseError;
}

/** Pastikan error apa pun yang keluar dari parser adalah DocumentParseError. */
export function toDocumentParseError(error: unknown): DocumentParseError {
  if (isDocumentParseError(error)) return error;
  return new DocumentParseError(
    'EXTRACTION_FAILED',
    'Gagal mengekstrak teks dari dokumen. Coba unggah ulang atau gunakan file lain.',
    undefined,
    { cause: error },
  );
}
