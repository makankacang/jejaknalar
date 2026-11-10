# Parser Dokumen (C-01) — PIC C

Mengubah PDF/DOCX menjadi teks terstruktur **dengan referensi sumber**. Berjalan sepenuhnya di browser;
tidak ada panggilan jaringan, tidak ada AI.

## Pemakaian (untuk PIC A)

```ts
import { parseDocument, isDocumentParseError } from '../../lib/parser'; // sesuaikan path relatif

async function onFileSelected(file: File) {
  try {
    const result = await parseDocument(file);
    // result.extractedText  -> teks gabungan untuk pratinjau / input AI
    // result.sourceMap      -> referensi per halaman (PDF) atau per paragraf (DOCX)
    // result.warnings       -> tampilkan ke guru (halaman kosong, tabel diratakan, dst.)
  } catch (error) {
    if (isDocumentParseError(error)) {
      showError(error.message); // pesan Indonesia, aman ditampilkan
      // error.code & error.details stabil untuk logika UI
    }
  }
}
```

`parsePdf(file)` dan `parseDocx(file)` tersedia bila format sudah pasti. Semua fungsi menerima
`{ limits }` opsional untuk menimpa batas. Hasil parse berupa data biasa (aman untuk state/cache).

> Pratinjau: render `extractedText`/`text` sebagai **teks** (React meng-escape otomatis). Jangan memakai
> `dangerouslySetInnerHTML`. Parser tidak menghasilkan HTML.

## Bentuk hasil

| Format | `sourceMap[]` | Catatan |
|---|---|---|
| PDF | `{ id: "PDF-P-002", kind: "page", page: 2, text }` | Satu entri per halaman asli, termasuk halaman kosong (`text: ""`). |
| DOCX | `{ id: "DOC-P-003", kind: "paragraph", paragraphIndex: 3, section?, text }` | `paragraphIndex` menghitung paragraf **berisi teks** mulai 1. Tidak ada nomor halaman. `section` = heading terdekat di atasnya. |

`extractedText` PDF diberi penanda `[Halaman N]` per halaman berisi teks; DOCX digabung per paragraf dengan baris kosong.
`documentId` = `doc_` + 16 heks SHA-256 isi file (sama untuk isi sama → cocok untuk cache C-02).

## Batas

Satu-satunya lokasi: `config.ts` → `DOCUMENT_LIMITS` (5 MB, 20 halaman PDF). Batas 20 halaman adalah **kebijakan
produk MVP**, bukan batas PDF.js. DOCX hanya dibatasi ukuran file (tidak ada batas halaman).

## Kode error (`DocumentParseError.code`)

`UNSUPPORTED_FILE_TYPE`, `FILE_TOO_LARGE`, `PDF_PAGE_LIMIT_EXCEEDED`, `PDF_INVALID`, `PDF_PASSWORD_PROTECTED`,
`EMPTY_DOCUMENT`, `NO_EXTRACTABLE_TEXT` (PDF pindai; OCR belum didukung), `DOCX_INVALID`, `EXTRACTION_FAILED`.

Kode ini sisi-klien dan **belum** menjadi bagian `contracts/error-codes.md`. Pemetaan ke API butuh CCR dengan PIC B.

## Keputusan teknis

- **PDF.js memakai build `legacy`** (`pdfjs-dist/legacy/build`): build standar v6 memanggil `Promise.try`,
  yang tidak ada di Node 22 (CI/Vitest) dan browser lama. Worker dimuat lewat impor `?url` Vite (hash di build produksi).
- **Mammoth memakai `mammoth/mammoth.browser.min.js`**: kode sama di browser, Vitest, dan produksi.
  Hanya pohon dokumen (`transformDocument`) yang dibaca; HTML hasil konversi dibuang, tidak pernah dirender.
- PDF.js dimuat lazy (chunk terpisah). Mammoth ikut termuat bersama modul parser — gunakan `import()` dinamis
  dari UI bila ingin menunda ±300 KB.

## Pengujian

`npm test` — dokumen sintetis dibuat di `test-utils/` (tanpa jaringan, tanpa AI). Satu PDF terenkripsi
(`test-utils/encrypted-pdf.ts`, sandi `rahasia123`) dibuat dengan reportlab karena enkripsi tidak praktis dibuat manual.
