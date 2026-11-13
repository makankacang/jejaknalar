type PdfJsModule = typeof import('pdfjs-dist');

let cached: Promise<PdfJsModule> | null = null;

/**
 * Memuat PDF.js secara lazy (tidak membebani bundle awal) dan mengonfigurasi worker.
 *
 * - Browser: worker di-bundle Vite lewat impor `?url` (berfungsi di dev dan build produksi).
 * - Node/Vitest: tidak ada `window`; PDF.js memakai "fake worker" bawaannya.
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  cached ??= (async () => {
    // Build "legacy": menyertakan polyfill (mis. Promise.try) agar jalan di Node 22 dan browser lama.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    }
    return pdfjs;
  })().catch((error) => {
    cached = null; // izinkan percobaan ulang jika pemuatan gagal
    throw error;
  });
  return cached;
}
