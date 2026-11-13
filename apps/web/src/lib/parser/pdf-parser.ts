import { resolveLimits, type ParseOptions } from './config';
import { DocumentParseError, toDocumentParseError } from './errors';
import { loadPdfJs } from './pdfjs-loader';
import type { DocumentParseResult, DocumentSourceReference } from './types';
import {
  MIME_TYPES,
  computeDocumentId,
  hasPdfSignature,
  readFileBytes,
  validateFile,
} from './validation';

const NO_TEXT_MESSAGE =
  'PDF tidak memiliki teks yang dapat diekstrak. Kemungkinan dokumen hasil pindai (gambar). OCR belum didukung pada MVP; gunakan PDF berbasis teks atau DOCX.';

function pageId(page: number): string {
  return `PDF-P-${String(page).padStart(3, '0')}`;
}

function normalizePageText(raw: string): string {
  return raw
    .split('\u0000')
    .join('')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Peta error PDF.js (berdasarkan `name`, aman lintas build) ke kode parser. */
function mapPdfJsError(error: unknown): DocumentParseError {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'PasswordException') {
    return new DocumentParseError(
      'PDF_PASSWORD_PROTECTED',
      'PDF dilindungi kata sandi. Hapus proteksi kata sandi lalu unggah ulang.',
      undefined,
      { cause: error },
    );
  }
  if (name === 'InvalidPDFException' || name === 'FormatError' || name === 'MissingPDFException') {
    return new DocumentParseError(
      'PDF_INVALID',
      'File PDF rusak atau bukan PDF yang valid. Coba ekspor ulang dokumen lalu unggah kembali.',
      undefined,
      { cause: error },
    );
  }
  return toDocumentParseError(error);
}

export async function parsePdf(file: File, options?: ParseOptions): Promise<DocumentParseResult> {
  const limits = resolveLimits(options);
  validateFile(file, limits, 'pdf');

  const bytes = await readFileBytes(file);
  if (!hasPdfSignature(bytes)) {
    throw new DocumentParseError(
      'PDF_INVALID',
      'File PDF rusak atau bukan PDF yang valid. Coba ekspor ulang dokumen lalu unggah kembali.',
    );
  }
  const documentId = await computeDocumentId(bytes);

  let loadingTask: ReturnType<Awaited<ReturnType<typeof loadPdfJs>>['getDocument']> | undefined;
  try {
    const pdfjs = await loadPdfJs();
    loadingTask = pdfjs.getDocument({
      data: bytes, // PDF.js memindahkan buffer ini ke worker; `bytes` tidak dipakai lagi setelahnya
      enableXfa: false, // tidak memproses formulir XFA
      useSystemFonts: false,
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    });
    const pdf = await loadingTask.promise;

    const totalPages = pdf.numPages;
    if (totalPages < 1) {
      throw new DocumentParseError('EMPTY_DOCUMENT', 'PDF tidak memiliki halaman.');
    }
    if (totalPages > limits.maxPdfPages) {
      throw new DocumentParseError(
        'PDF_PAGE_LIMIT_EXCEEDED',
        `Dokumen PDF melebihi batas ${limits.maxPdfPages} halaman untuk MVP (dokumen ini ${totalPages} halaman). Pecah dokumen menjadi bagian yang lebih kecil lalu unggah satu per satu.`,
        { actualPages: totalPages, maxPages: limits.maxPdfPages },
      );
    }

    const sourceMap: DocumentSourceReference[] = [];
    const warnings: string[] = [];
    const emptyPages: number[] = [];
    const failedPages: number[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      let text = '';
      try {
        const page = await pdf.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          let raw = '';
          for (const item of content.items) {
            if ('str' in item) raw += item.str + (item.hasEOL ? '\n' : '');
          }
          text = normalizePageText(raw);
        } finally {
          page.cleanup();
        }
      } catch {
        failedPages.push(pageNumber);
      }
      if (text === '' && !failedPages.includes(pageNumber)) emptyPages.push(pageNumber);
      sourceMap.push({ id: pageId(pageNumber), kind: 'page', page: pageNumber, text });
    }

    if (failedPages.length === totalPages) {
      throw new DocumentParseError('EXTRACTION_FAILED', 'Gagal mengekstrak teks dari seluruh halaman PDF.');
    }
    if (failedPages.length > 0) {
      warnings.push(`Halaman ${failedPages.join(', ')} gagal diekstrak dan dikosongkan. Periksa dokumen sumber.`);
    }
    if (emptyPages.length === totalPages) {
      throw new DocumentParseError('NO_EXTRACTABLE_TEXT', NO_TEXT_MESSAGE, { pageCount: totalPages });
    }
    if (emptyPages.length > 0) {
      warnings.push(
        `Halaman ${emptyPages.join(', ')} tidak berisi teks yang dapat diekstrak (mungkin gambar atau hasil pindai; OCR belum didukung).`,
      );
    }

    const extractedText = sourceMap
      .filter((ref) => ref.text !== '')
      .map((ref) => `[Halaman ${ref.kind === 'page' ? ref.page : ''}]\n${ref.text}`)
      .join('\n\n');

    return {
      documentId,
      filename: file.name,
      format: 'pdf',
      mimeType: MIME_TYPES.pdf,
      sizeBytes: file.size,
      extractedText,
      sourceMap,
      metadata: { pageCount: totalPages },
      warnings,
    };
  } catch (error) {
    throw mapPdfJsError(error);
  } finally {
    // Lepas worker dan memori PDF.js; abaikan kegagalan pembersihan.
    await loadingTask?.destroy().catch(() => undefined);
  }
}
