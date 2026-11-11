import { describe, it, expect } from 'vitest';
import {
  DOCUMENT_LIMITS,
  DocumentParseError,
  isDocumentParseError,
  parseDocument,
  parseDocx,
  parsePdf,
  type DocumentParseErrorCode,
} from './index';
import { buildPdf } from './test-utils/build-pdf';
import { IMAGE_PARAGRAPH_XML, IMAGE_REL, buildDocx, buildZip, buildZipWithoutDocument } from './test-utils/build-docx';
import { encryptedPdfBytes } from './test-utils/encrypted-pdf';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function makeFile(bytes: Uint8Array | string, name: string, type = ''): File {
  return new File([bytes as BlobPart], name, { type });
}

async function expectCode(promise: Promise<unknown>, code: DocumentParseErrorCode) {
  const error = await promise.then(
    () => {
      throw new Error(`Diharapkan error ${code}, tetapi parse berhasil`);
    },
    (e: unknown) => e,
  );
  expect(isDocumentParseError(error)).toBe(true);
  expect((error as DocumentParseError).code).toBe(code);
  return error as DocumentParseError;
}

describe('konfigurasi batas', () => {
  it('default 5 MB dan 20 halaman PDF, terpusat', () => {
    expect(DOCUMENT_LIMITS.maxFileSizeBytes).toBe(5 * 1024 * 1024);
    expect(DOCUMENT_LIMITS.maxPdfPages).toBe(20);
  });
});

describe('validasi file', () => {
  it('menolak ekstensi tidak didukung (.txt)', async () => {
    await expectCode(parseDocument(makeFile('halo', 'materi.txt', 'text/plain')), 'UNSUPPORTED_FILE_TYPE');
  });

  it('menolak file tanpa ekstensi', async () => {
    await expectCode(parseDocument(makeFile('halo', 'materi')), 'UNSUPPORTED_FILE_TYPE');
  });

  it('menolak MIME yang bertentangan dengan ekstensi', async () => {
    const pdf = buildPdf([{ lines: ['Halo'] }]);
    await expectCode(parseDocument(makeFile(pdf, 'a.pdf', DOCX_MIME)), 'UNSUPPORTED_FILE_TYPE');
    await expectCode(parseDocument(makeFile(buildDocx([{ text: 'x' }]), 'a.docx', PDF_MIME)), 'UNSUPPORTED_FILE_TYPE');
  });

  it('menerima MIME kosong atau generik', async () => {
    const pdf = buildPdf([{ lines: ['Halo'] }]);
    await expect(parseDocument(makeFile(pdf, 'a.pdf', ''))).resolves.toBeTruthy();
    await expect(parseDocument(makeFile(pdf, 'b.pdf', 'application/octet-stream'))).resolves.toBeTruthy();
  });

  it('menolak parsePdf untuk file .docx dan sebaliknya', async () => {
    await expectCode(parsePdf(makeFile(buildDocx([{ text: 'x' }]), 'a.docx')), 'UNSUPPORTED_FILE_TYPE');
    await expectCode(parseDocx(makeFile(buildPdf([{ lines: ['x'] }]), 'a.pdf')), 'UNSUPPORTED_FILE_TYPE');
  });

  it('menolak file di atas 5 MB sebelum membaca isinya', async () => {
    const big = new File([new Uint8Array(DOCUMENT_LIMITS.maxFileSizeBytes + 1)], 'besar.pdf', { type: PDF_MIME });
    const error = await expectCode(parseDocument(big), 'FILE_TOO_LARGE');
    expect(error.details).toEqual({ actualBytes: DOCUMENT_LIMITS.maxFileSizeBytes + 1, maxBytes: DOCUMENT_LIMITS.maxFileSizeBytes });
    expect(error.message).toContain('5 MB');
  });

  it('menerima file tepat di batas ukuran (lolos validasi ukuran)', async () => {
    const atLimit = new File([new Uint8Array(DOCUMENT_LIMITS.maxFileSizeBytes)], 'pas.pdf', { type: PDF_MIME });
    // Isi bukan PDF, jadi gagal di struktur — bukan FILE_TOO_LARGE.
    await expectCode(parseDocument(atLimit), 'PDF_INVALID');
  });

  it('menolak file 0 byte', async () => {
    await expectCode(parseDocument(makeFile('', 'kosong.pdf', PDF_MIME)), 'EMPTY_DOCUMENT');
  });

  it('batas dapat dikonfigurasi lewat opsi', async () => {
    const pdf = buildPdf([{ lines: ['Halo'] }]);
    await expectCode(parseDocument(makeFile(pdf, 'a.pdf'), { limits: { maxFileSizeBytes: 100 } }), 'FILE_TOO_LARGE');
  });
});

describe('PDF', () => {
  it('mengekstrak teks dari PDF satu halaman', async () => {
    const pdf = buildPdf([{ lines: ['Unsur intrinsik teks narasi', 'meliputi tema dan alur.'] }]);
    const result = await parseDocument(makeFile(pdf, 'narasi.pdf', PDF_MIME));

    expect(result.format).toBe('pdf');
    expect(result.filename).toBe('narasi.pdf');
    expect(result.mimeType).toBe(PDF_MIME);
    expect(result.sizeBytes).toBe(pdf.byteLength);
    expect(result.documentId).toMatch(/^doc_[0-9a-f]{16}$/);
    expect(result.metadata).toEqual({ pageCount: 1 });
    expect(result.extractedText).toContain('Unsur intrinsik teks narasi');
    expect(result.extractedText).toContain('meliputi tema dan alur.');
    expect(result.warnings).toEqual([]);
  });

  it('mempertahankan nomor halaman dan source map pada PDF multi-halaman', async () => {
    const pdf = buildPdf([{ lines: ['Isi halaman satu'] }, { lines: ['Isi halaman dua'] }, { lines: ['Isi halaman tiga'] }]);
    const result = await parsePdf(makeFile(pdf, 'tiga.pdf'));

    expect(result.metadata.pageCount).toBe(3);
    expect(result.sourceMap.map((r) => r.id)).toEqual(['PDF-P-001', 'PDF-P-002', 'PDF-P-003']);
    result.sourceMap.forEach((ref, i) => {
      expect(ref.kind).toBe('page');
      if (ref.kind === 'page') expect(ref.page).toBe(i + 1);
    });
    expect(result.sourceMap[1].text).toBe('Isi halaman dua');
    expect(result.extractedText).toContain('[Halaman 2]\nIsi halaman dua');
    expect(result.extractedText.indexOf('Halaman 1')).toBeLessThan(result.extractedText.indexOf('Halaman 3'));
  });

  it('menjaga referensi halaman kosong dan memberi peringatan', async () => {
    const pdf = buildPdf([{ lines: ['Halaman pertama'] }, {}, { lines: ['Halaman ketiga'] }]);
    const result = await parsePdf(makeFile(pdf, 'sebagian.pdf'));

    expect(result.sourceMap).toHaveLength(3);
    expect(result.sourceMap[1]).toMatchObject({ kind: 'page', page: 2, text: '' });
    expect(result.sourceMap[2]).toMatchObject({ page: 3, text: 'Halaman ketiga' });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Halaman 2');
    expect(result.extractedText).not.toContain('[Halaman 2]');
  });

  it('melaporkan keterbatasan OCR untuk PDF tanpa teks (hasil pindai)', async () => {
    const pdf = buildPdf([{}, {}]);
    const error = await expectCode(parsePdf(makeFile(pdf, 'scan.pdf')), 'NO_EXTRACTABLE_TEXT');
    expect(error.message).toContain('OCR');
    expect(error.details).toEqual({ pageCount: 2 });
  });

  it('menerima PDF tepat di batas halaman dan menolak yang melebihi', async () => {
    const max = DOCUMENT_LIMITS.maxPdfPages;
    const pages = (n: number) => Array.from({ length: n }, (_, i) => ({ lines: [`Isi ${i + 1}`] }));

    const ok = await parsePdf(makeFile(buildPdf(pages(max)), 'dua-puluh.pdf'));
    expect(ok.metadata.pageCount).toBe(max);

    const error = await expectCode(parsePdf(makeFile(buildPdf(pages(max + 1)), 'dua-satu.pdf')), 'PDF_PAGE_LIMIT_EXCEEDED');
    expect(error.details).toEqual({ actualPages: max + 1, maxPages: max });
    expect(error.message).toContain(String(max));
  });

  it('batas halaman dapat diubah lewat konfigurasi, bukan angka tertanam', async () => {
    const pdf = buildPdf(Array.from({ length: 25 }, (_, i) => ({ lines: [`Isi ${i + 1}`] })));
    const result = await parsePdf(makeFile(pdf, 'dua-lima.pdf'), { limits: { maxPdfPages: 30 } });
    expect(result.metadata.pageCount).toBe(25);
    const error = await expectCode(parsePdf(makeFile(pdf, 'dua-lima.pdf'), { limits: { maxPdfPages: 10 } }), 'PDF_PAGE_LIMIT_EXCEEDED');
    expect(error.details).toEqual({ actualPages: 25, maxPages: 10 });
  });

  it('PDF tanpa halaman → error terkontrol', async () => {
    await expectCode(parsePdf(makeFile(buildPdf([]), 'nol.pdf')), 'EMPTY_DOCUMENT');
  });

  it('menolak byte acak berekstensi .pdf', async () => {
    await expectCode(parsePdf(makeFile(new TextEncoder().encode('ini bukan pdf sama sekali'), 'palsu.pdf', PDF_MIME)), 'PDF_INVALID');
  });

  it('menolak PDF terpotong/rusak (header valid, isi rusak)', async () => {
    const pdf = buildPdf([{ lines: ['Halo'] }]);
    const truncated = pdf.slice(0, Math.floor(pdf.length / 3));
    await expectCode(parsePdf(makeFile(truncated, 'rusak.pdf')), 'PDF_INVALID');
  });

  it('PDF berkata sandi → PDF_PASSWORD_PROTECTED', async () => {
    await expectCode(parsePdf(makeFile(encryptedPdfBytes(), 'rahasia.pdf', PDF_MIME)), 'PDF_PASSWORD_PROTECTED');
  });

  it('ID dokumen deterministik untuk isi yang sama', async () => {
    const pdf = buildPdf([{ lines: ['Sama'] }]);
    const a = await parsePdf(makeFile(pdf, 'a.pdf'));
    const b = await parsePdf(makeFile(pdf, 'nama-lain.pdf'));
    expect(a.documentId).toBe(b.documentId);
  });
});

describe('DOCX', () => {
  it('mengekstrak paragraf dengan indeks, ID, dan section dari heading', async () => {
    const docx = buildDocx([
      { text: 'Unsur Intrinsik', heading: 1 },
      { text: 'Unsur intrinsik merupakan unsur pembangun dari dalam karya.' },
      { text: 'Tema dan Alur', heading: 2 },
      { text: 'Tema adalah gagasan pokok cerita.' },
    ]);
    const result = await parseDocument(makeFile(docx, 'materi.docx', DOCX_MIME));

    expect(result.format).toBe('docx');
    expect(result.mimeType).toBe(DOCX_MIME);
    expect(result.metadata).toEqual({ paragraphCount: 4 });
    expect(result.warnings).toEqual([]);
    expect(result.sourceMap).toEqual([
      { id: 'DOC-P-001', kind: 'paragraph', paragraphIndex: 1, section: 'Unsur Intrinsik', text: 'Unsur Intrinsik' },
      { id: 'DOC-P-002', kind: 'paragraph', paragraphIndex: 2, section: 'Unsur Intrinsik', text: 'Unsur intrinsik merupakan unsur pembangun dari dalam karya.' },
      { id: 'DOC-P-003', kind: 'paragraph', paragraphIndex: 3, section: 'Tema dan Alur', text: 'Tema dan Alur' },
      { id: 'DOC-P-004', kind: 'paragraph', paragraphIndex: 4, section: 'Tema dan Alur', text: 'Tema adalah gagasan pokok cerita.' },
    ]);
    expect(result.extractedText).toBe(result.sourceMap.map((r) => r.text).join('\n\n'));
  });

  it('tidak membuat nomor halaman untuk DOCX', async () => {
    const result = await parseDocx(makeFile(buildDocx([{ text: 'Satu paragraf.' }]), 'a.docx'));
    expect(result.metadata.pageCount).toBeUndefined();
    expect(result.sourceMap.every((r) => r.kind === 'paragraph' && !('page' in r))).toBe(true);
  });

  it('paragraf sebelum heading tidak punya section, dan memberi peringatan bila tanpa heading', async () => {
    const result = await parseDocx(makeFile(buildDocx([{ text: 'Tanpa judul.' }, { text: 'Paragraf kedua.' }]), 'a.docx'));
    expect(result.sourceMap[0]).not.toHaveProperty('section');
    expect(result.warnings.some((w) => w.includes('heading'))).toBe(true);
  });

  it('melewati paragraf kosong tetapi indeks tetap berurutan', async () => {
    const docx = buildDocx([{ text: 'A' }, { text: '   ' }, { text: 'B' }]);
    const result = await parseDocx(makeFile(docx, 'a.docx'));
    expect(result.sourceMap.map((r) => (r.kind === 'paragraph' ? r.paragraphIndex : 0))).toEqual([1, 2]);
    expect(result.sourceMap.map((r) => r.text)).toEqual(['A', 'B']);
  });

  it('teks berisi markup tidak dieksekusi atau diinterpretasi sebagai HTML', async () => {
    const docx = buildDocx([{ text: '<script>alert(1)</script> & <b>tebal</b>' }]);
    const result = await parseDocx(makeFile(docx, 'xss.docx'));
    expect(result.sourceMap[0].text).toBe('<script>alert(1)</script> & <b>tebal</b>');
  });

  it('DOCX kosong → EMPTY_DOCUMENT', async () => {
    await expectCode(parseDocx(makeFile(buildDocx([]), 'kosong.docx')), 'EMPTY_DOCUMENT');
    await expectCode(parseDocx(makeFile(buildDocx([{ text: '  ' }]), 'spasi.docx')), 'EMPTY_DOCUMENT');
  });

  it('menolak byte acak berekstensi .docx', async () => {
    await expectCode(parseDocx(makeFile('ini bukan zip', 'palsu.docx', DOCX_MIME)), 'DOCX_INVALID');
  });

  it('menolak ZIP valid yang bukan dokumen Word', async () => {
    await expectCode(parseDocx(makeFile(buildZipWithoutDocument(), 'zip.docx', DOCX_MIME)), 'DOCX_INVALID');
  });

  it('menolak DOCX terpotong', async () => {
    const docx = buildDocx([{ text: 'Halo dunia' }]);
    await expectCode(parseDocx(makeFile(docx.slice(0, 80), 'rusak.docx')), 'DOCX_INVALID');
  });

  it('menolak ZIP dengan document.xml rusak', async () => {
    const zip = buildZip({ '[Content_Types].xml': '<x/>', 'word/document.xml': '<<bukan xml' });
    await expectCode(parseDocx(makeFile(zip, 'xml-rusak.docx')), 'DOCX_INVALID');
  });

  it('menandai gambar yang diabaikan', async () => {
    const docx = buildDocx([{ text: 'Ada gambar di bawah.' }], IMAGE_PARAGRAPH_XML, { 'word/media/gambar.png': 'PNGDATA' }, IMAGE_REL);
    const result = await parseDocx(makeFile(docx, 'gambar.docx'));
    expect(result.sourceMap.map((r) => r.text)).toEqual(['Ada gambar di bawah.']);
    expect(result.warnings.some((w) => w.includes('1 gambar diabaikan'))).toBe(true);
  });

  it('menandai tabel yang diratakan', async () => {
    const table =
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Sel A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Sel B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    const result = await parseDocx(makeFile(buildDocx([{ text: 'Pengantar' }], table), 't.docx'));
    expect(result.sourceMap.map((r) => r.text)).toEqual(['Pengantar', 'Sel A', 'Sel B']);
    expect(result.warnings.some((w) => w.includes('tabel'))).toBe(true);
  });
});

describe('kontrak error', () => {
  it('error serializable tanpa stack trace dan tanpa isi dokumen', async () => {
    const error = await expectCode(parseDocument(makeFile('rahasia-isi-dokumen', 'x.txt')), 'UNSUPPORTED_FILE_TYPE');
    const json = JSON.parse(JSON.stringify(error)) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(['code', 'details', 'message']);
    expect(JSON.stringify(json)).not.toContain('rahasia-isi-dokumen');
    expect(JSON.stringify(json)).not.toMatch(/\n\s+at /);
    expect(json).not.toHaveProperty('stack');
  });

  it('parseDocument hanya melempar DocumentParseError', async () => {
    const files = [
      makeFile('x', 'a.txt'),
      makeFile('bukan pdf', 'a.pdf'),
      makeFile('bukan zip', 'a.docx'),
      makeFile(encryptedPdfBytes(), 'b.pdf'),
    ];
    for (const file of files) {
      const error = await parseDocument(file).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DocumentParseError);
    }
  });
});
