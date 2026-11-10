import { DocumentParseError } from './errors';
import type { DocumentLimits } from './config';
import type { DocumentFormat } from './types';

export const MIME_TYPES: Record<DocumentFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Browser kadang melaporkan MIME kosong atau generik; keduanya tidak dianggap konflik. */
const NEUTRAL_MIME_TYPES = new Set(['', 'application/octet-stream']);

const UNSUPPORTED_MESSAGE = 'Format file tidak didukung. Unggah dokumen PDF (.pdf) atau Word (.docx).';

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

/**
 * Validasi murah sebelum membaca isi file: ekstensi, MIME, dan ukuran.
 * Ekstensi saja tidak dipercaya; struktur sebenarnya diperiksa saat parsing.
 */
export function validateFile(
  file: File,
  limits: DocumentLimits,
  expected?: DocumentFormat,
): DocumentFormat {
  const ext = extensionOf(file.name);
  const format: DocumentFormat | null = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : null;

  if (!format || (expected && format !== expected)) {
    throw new DocumentParseError('UNSUPPORTED_FILE_TYPE', UNSUPPORTED_MESSAGE, {
      extension: ext || '(tidak ada)',
    });
  }

  const mime = file.type.toLowerCase();
  if (!NEUTRAL_MIME_TYPES.has(mime) && mime !== MIME_TYPES[format]) {
    throw new DocumentParseError(
      'UNSUPPORTED_FILE_TYPE',
      `Jenis file tidak cocok dengan ekstensi .${format}. Pastikan file belum diganti namanya dari format lain.`,
      { extension: format, mimeType: mime },
    );
  }

  if (file.size === 0) {
    throw new DocumentParseError('EMPTY_DOCUMENT', 'File kosong (0 byte). Pilih dokumen yang berisi materi.');
  }

  if (file.size > limits.maxFileSizeBytes) {
    const maxMb = +(limits.maxFileSizeBytes / (1024 * 1024)).toFixed(1);
    throw new DocumentParseError(
      'FILE_TOO_LARGE',
      `Ukuran file melebihi batas ${maxMb} MB. Kompres atau pecah dokumen lalu coba lagi.`,
      { actualBytes: file.size, maxBytes: limits.maxFileSizeBytes },
    );
  }

  return format;
}

/** "%PDF-" harus muncul di 1024 byte pertama (toleransi spesifikasi PDF). */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + 4 < head.length; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2d) {
      return true;
    }
  }
  return false;
}

/** DOCX adalah ZIP: diawali "PK\x03\x04". Struktur dalamnya divalidasi oleh Mammoth. */
export function hasZipSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (cause) {
    throw new DocumentParseError('EXTRACTION_FAILED', 'File tidak dapat dibaca. Coba pilih ulang file tersebut.', undefined, { cause });
  }
}

/** ID dokumen deterministik dari isi file; fallback acak bila Web Crypto tidak tersedia. */
export async function computeDocumentId(bytes: Uint8Array): Promise<string> {
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      return `doc_${hex.slice(0, 16)}`;
    }
  } catch {
    /* jatuh ke fallback */
  }
  return `doc_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16)}`;
}
