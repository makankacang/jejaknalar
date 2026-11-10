/** Pembuat PDF sintetis minimal (Helvetica, ASCII) khusus pengujian. */
export interface PdfPageSpec {
  /** Baris teks; kosong/undefined = halaman tanpa teks (mirip hasil pindai). */
  lines?: string[];
}

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function buildPdf(pages: PdfPageSpec[]): Uint8Array {
  const objects: string[] = [];
  const pageObjIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((page, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    const lines = page.lines ?? [];
    const stream = lines.length
      ? `BT /F1 12 Tf 14 TL 50 740 Td ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
      : '0.5 g 50 50 100 100 re f'; // hanya gambar vektor, tanpa teks
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
