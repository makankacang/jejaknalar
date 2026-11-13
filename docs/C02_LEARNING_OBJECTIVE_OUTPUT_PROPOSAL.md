# C-02 Learning Objective Output Proposal — PIC C

Status: **Usulan implementasi PIC C untuk review PIC B dan PIC A; belum menjadi kontrak API final.** Format output pada bagian 3–4 telah diselaraskan dengan usulan C3 PIC B dan tetap memerlukan persetujuan contract steward.

## 1. Tanggung jawab

C-02 mengubah hasil C-01 (`DocumentParseResult`) menjadi Learning Objectives terstruktur yang dapat ditinjau guru. C-02 tidak membuat endpoint, job persistence, authentication, RLS, quest JSON, assessment, atau mekanik Phaser.

## 2. Input internal

```ts
interface LearningAnalysisInput {
  module_id: string;
  text_version: string;
  document: DocumentParseResult;
  context?: {
    grade?: 7 | 8 | 9;
    subject?: string;
    topic?: string;
    curriculum?: string;
  };
}
```

`document` adalah snapshot hasil C-01 yang lengkap. Tipe boundary server didefinisikan terpisah di `supabase/functions/_shared/ai/learning-analyzer/document-types.ts` agar Edge Function tidak mengimpor kode frontend; bentuknya diperiksa tetap kompatibel secara struktural dengan `apps/web/src/lib/parser/types.ts`. `text_version` dipasok oleh backend/versi modul karena belum menjadi bagian output parser. Entry point PIC B perlu me-resolve `module_id + text_version` menjadi snapshot hasil parse yang tepat. `extractedText` dan `sourceMap` wajib berasal dari snapshot versi yang sama. Request minimum PRD tetap hanya mencantumkan ID modul dan versi teks; jika hasil parse belum dipersist, PIC B perlu menentukan mekanisme penyimpanan/transport tanpa mengubah kontrak publik API.

## 3. Output internal C-02

```json
{
  "analysis_schema_version": "1.0",
  "module_id": "MODULE-001",
  "document_id": "doc_0123456789abcdef",
  "text_version": "VERSION-001",
  "status": "completed",
  "objectives": [
    {
      "statement": "Siswa mampu mengidentifikasi ciri-ciri teks deskripsi.",
      "basis": "explicit",
      "source_references": [
        {
          "source_type": "pdf",
          "source_map_id": "PDF-P-002",
          "page": 2,
          "excerpt": "Kutipan verbatim dari sumber halaman 2."
        }
      ]
    }
  ],
  "warnings": []
}
```

Contoh di atas sintetis. Output analyzer tidak menyertakan ID permanen LO. PIC B membuat ID permanen setelah objective disimpan ke database, sesuai usulan kontrak integrasi C3. `basis` tetap dipertahankan sebagai metadata provenance tentang apakah tujuan dinyatakan eksplisit atau diinferensikan.

## 4. Source reference

| Format | Output referensi | Metadata hanya dari C-01 |
|---|---|---|
| PDF | `source_type: pdf`, `source_map_id`, `page`, `excerpt` | `sourceMap[].id`, `kind: page`, `page`, `text` |
| DOCX | `source_type: docx`, `source_map_id`, `paragraph_index`, `section?`, `excerpt` | `sourceMap[].id`, `kind: paragraph`, `paragraphIndex`, `section`, `text` |

Model internal tetap mengembalikan `source_id` dan `quote`. C-02 mencocokkan ID dan kutipan ke `sourceMap`, lalu membentuk output integrasi memakai `source_map_id` dan `source_type`. Model tidak dipercaya untuk membuat nomor halaman/paragraf. DOCX tidak menggunakan nomor halaman. Nilai `source_map_id` adalah ID asli C-01 (misalnya `PDF-P-001` atau `DOC-P-001`), bukan ID buatan adapter.

## 5. Analisis dan kualitas

- `explicit`: tujuan dinyatakan secara langsung pada dokumen.
- `inferred`: tujuan disimpulkan secara konservatif dari kemampuan yang dilatihkan oleh materi.
- Setiap LO wajib memiliki satu atau lebih sumber yang valid.
- Tujuan tanpa kutipan valid dihapus dari output dan diberi warning.
- Tujuan duplikat dinormalisasi dan dideduplikasi.
- Jika tidak ada LO yang memiliki bukti valid, status menjadi `insufficient_evidence`.
- AI tidak boleh mengarang kelas, kurikulum, standar, atau konten di luar input.
- Dokumen diperlakukan sebagai data tidak tepercaya, bukan instruksi prompt.

## 6. Usulan pembungkusan API oleh PIC B

PRD menyebut endpoint logis `POST /api/modules/analyze` dan request minimum `module_id` + `text_version`, dengan response minimum `analysis_job_id`. Mekanisme status/pengambilan hasil harus diputuskan PIC B.

Output C-02 di atas adalah hasil internal analyzer. PIC B dapat menyimpan hasil tersebut dan membungkusnya dalam envelope API standar `{ ok, data, request_id }`. C-02 tidak menetapkan route status/polling atau mengubah OpenAPI.

## 6A. Konfigurasi provider

`GeminiRestModel` menerima `GEMINI_API_KEY` dan `GEMINI_MODEL` dari lingkungan server. Nama model tidak dikunci di source code; PIC B perlu menyediakan konfigurasi `GEMINI_MODEL` pada environment lokal/staging bersama secret server. API key tetap secret, sedangkan nama model merupakan konfigurasi deployment.

## 7. Error internal

| C-02 code | Makna | Rekomendasi pemetaan API oleh PIC B |
|---|---|---|
| `INVALID_INPUT` | Input/metadata parser tidak valid | `VALIDATION_ERROR` |
| `NO_ANALYZABLE_TEXT` | Tidak ada teks sumber yang dapat dianalisis | `VALIDATION_ERROR` |
| `MODEL_CONFIGURATION_ERROR` | Secret/model server belum dikonfigurasi | `INTERNAL_ERROR` / konfigurasi staging |
| `MODEL_UNAVAILABLE` | Gemini 429 atau 5xx / koneksi gagal | `AI_UNAVAILABLE` |
| `MODEL_TIMEOUT` | Request melewati timeout | `AI_UNAVAILABLE` |
| `MODEL_REQUEST_FAILED` | Request ditolak provider karena konfigurasi/payload | `AI_UNAVAILABLE` atau `INTERNAL_ERROR` setelah inspeksi server |
| `MODEL_INVALID_RESPONSE` | Output kosong, malformed, atau tidak sesuai struktur | `AI_UNAVAILABLE` / error internal |

Pemetaan final mengikuti keputusan PIC B dan `contracts/error-codes.md`.

## 8. Tanggung jawab lanjutan

- PIC B: endpoint, async job lifecycle, auth, persistence, API response, rate limit.
- PIC C: analyzer, prompt, Gemini caller, structured output, provenance validator, fixture, unit test.
- PIC A: UI review/edit/approval LO.
- PIC D: daftar mekanik game dan sistem evidence/assessment; bukan bagian C-02.
