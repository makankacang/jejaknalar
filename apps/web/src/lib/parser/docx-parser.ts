import mammoth from 'mammoth/mammoth.browser.min.js';
import { resolveLimits, type ParseOptions } from './config';
import { DocumentParseError, toDocumentParseError } from './errors';
import type { DocumentParseResult, DocumentSourceReference } from './types';
import {
  MIME_TYPES,
  computeDocumentId,
  hasZipSignature,
  readFileBytes,
  validateFile,
} from './validation';

const INVALID_MESSAGE =
  'File DOCX rusak atau bukan dokumen Word yang valid. Buka di Word, simpan ulang sebagai .docx, lalu unggah kembali.';

/** Node pohon dokumen Mammoth (bentuk minimal yang kita butuhkan). */
interface MammothNode {
  type: string;
  value?: string;
  styleId?: string;
  styleName?: string;
  children?: MammothNode[];
}

interface CollectedParagraph {
  text: string;
  isHeading: boolean;
}

const HEADING_STYLE = /^(heading|judul)\s*\d+$/i;

function isHeadingStyle(node: MammothNode): boolean {
  const name = node.styleName ?? '';
  const id = node.styleId ?? '';
  return HEADING_STYLE.test(name) || HEADING_STYLE.test(id) || /^title$/i.test(name) || /^title$/i.test(id);
}

function textOf(node: MammothNode): string {
  if (node.type === 'text') return node.value ?? '';
  if (node.type === 'tab') return ' ';
  if (node.type === 'break') return ' ';
  return (node.children ?? []).map(textOf).join('');
}

interface Collected {
  paragraphs: CollectedParagraph[];
  imageCount: number;
  tableCount: number;
}

/** Telusuri pohon dokumen berurutan; paragraf di dalam tabel ikut terambil. */
function collect(root: MammothNode): Collected {
  const out: Collected = { paragraphs: [], imageCount: 0, tableCount: 0 };
  const walk = (node: MammothNode): void => {
    if (node.type === 'paragraph') {
      const text = textOf(node).replace(/\s+/g, ' ').trim();
      if (text) out.paragraphs.push({ text, isHeading: isHeadingStyle(node) });
      // Gambar bisa berada di dalam paragraf; hitung tanpa menelusuri teks lagi.
      const countImages = (n: MammothNode): void => {
        if (n.type === 'image') out.imageCount++;
        n.children?.forEach(countImages);
      };
      countImages(node);
      return;
    }
    if (node.type === 'table') out.tableCount++;
    node.children?.forEach(walk);
  };
  walk(root);
  return out;
}

export async function parseDocx(file: File, options?: ParseOptions): Promise<DocumentParseResult> {
  const limits = resolveLimits(options);
  validateFile(file, limits, 'docx');

  const bytes = await readFileBytes(file);
  if (!hasZipSignature(bytes)) throw new DocumentParseError('DOCX_INVALID', INVALID_MESSAGE);
  const documentId = await computeDocumentId(bytes);

  try {
    let collected: Collected = { paragraphs: [], imageCount: 0, tableCount: 0 };

    // Hanya pohon dokumen yang dipakai. HTML hasil konversi DIBUANG dan tidak pernah
    // dirender, sehingga tidak ada markup tak tepercaya yang masuk ke aplikasi.
    // Semua kegagalan dari Mammoth (ZIP rusak, bagian utama hilang, XML tidak valid)
    // berarti struktur DOCX tidak valid.
    const result = await mammoth.convertToHtml(
      { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer },
      {
        externalFileAccess: false,
        // Jangan menanam gambar base64 (hemat memori); gambar tidak dipakai.
        convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
        transformDocument: (document: MammothNode) => {
          collected = collect(document);
          return document;
        },
      },
    ).catch((cause: unknown) => {
      throw new DocumentParseError('DOCX_INVALID', INVALID_MESSAGE, undefined, { cause });
    });

    const sourceMap: DocumentSourceReference[] = [];
    let section: string | undefined;
    collected.paragraphs.forEach((paragraph, i) => {
      const paragraphIndex = i + 1;
      if (paragraph.isHeading) section = paragraph.text;
      sourceMap.push({
        id: `DOC-P-${String(paragraphIndex).padStart(3, '0')}`,
        kind: 'paragraph',
        paragraphIndex,
        ...(section ? { section } : {}),
        text: paragraph.text,
      });
    });

    if (sourceMap.length === 0) {
      throw new DocumentParseError('EMPTY_DOCUMENT', 'Dokumen DOCX tidak berisi teks.');
    }

    const warnings: string[] = [];
    if (collected.imageCount > 0) {
      warnings.push(`${collected.imageCount} gambar diabaikan (hanya teks yang diekstrak; OCR belum didukung).`);
    }
    if (collected.tableCount > 0) {
      warnings.push(`${collected.tableCount} tabel diratakan menjadi paragraf; struktur baris/kolom tidak dipertahankan.`);
    }
    const conversionWarnings = result.messages.filter((m) => m.type === 'error').length;
    if (conversionWarnings > 0) {
      warnings.push(`${conversionWarnings} bagian dokumen tidak dapat dikonversi dan mungkin hilang dari teks.`);
    }
    if (!sourceMap.some((ref) => ref.kind === 'paragraph' && ref.section)) {
      warnings.push('Tidak ditemukan judul (heading); referensi bagian (section) tidak tersedia.');
    }

    return {
      documentId,
      filename: file.name,
      format: 'docx',
      mimeType: MIME_TYPES.docx,
      sizeBytes: file.size,
      extractedText: sourceMap.map((ref) => ref.text).join('\n\n'),
      sourceMap,
      metadata: { paragraphCount: sourceMap.length },
      warnings,
    };
  } catch (error) {
    // DocumentParseError diteruskan apa adanya; selainnya menjadi EXTRACTION_FAILED.
    throw toDocumentParseError(error);
  }
}
