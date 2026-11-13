# C-02 Learning Objective Analyzer — PIC C

Modul server-side yang menganalisis hasil parser C-01 dan mengusulkan Learning Objectives dengan provenance yang diverifikasi terhadap `sourceMap` asli.

## Batas ownership

- PIC C memiliki prompt, analyzer core, shared AI model contract, provider adapters, normalisasi output, dan validasi source reference.
- PIC B memiliki Edge Function entrypoint, auth, RLS, job lifecycle, persistence, rate limit, API envelope, serta kontrak OpenAPI.
- PIC A mengonsumsi hasil melalui API dan menyediakan review/edit/approval oleh guru.
- PIC D menentukan kemampuan game; C-02 tidak membuat quest atau mekanik game.

Modul ini sengaja tidak membuat endpoint `/modules/analyze` dan tidak mengubah `contracts/api.openapi.yaml` atau `contracts/quest.schema.json`.

## Pemakaian internal

```ts
import {
  analyzeLearningObjectives,
  GeminiRestModel,
  type LearningAnalysisInput,
} from "./learning-analyzer/index.ts";

const model = new GeminiRestModel({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
  model: Deno.env.get("GEMINI_MODEL") ?? "",
});

const input: LearningAnalysisInput = {
  module_id: module.id,
  text_version: module.text_version,
  document: parsedDocumentSnapshot, // snapshot C-01 yang tersimpan untuk text_version ini
  context: { grade: 7, subject: "Bahasa Indonesia", topic: "Teks Deskripsi" },
};

const result = await analyzeLearningObjectives(input, model);
```

Contoh tersebut merupakan pemanggilan dari server/Edge Function milik PIC B. Jangan menaruh `GEMINI_API_KEY` di frontend atau `VITE_*`.

## Input

`LearningAnalysisInput.document` adalah snapshot hasil C-01 yang lengkap: `documentId`, `filename`, `format`, `mimeType`, `sizeBytes`, `extractedText`, `sourceMap`, `metadata`, dan `warnings`. Tipe boundary server didefinisikan di `document-types.ts` dan sengaja dibuat *structurally compatible* dengan `apps/web/src/lib/parser/types.ts`; Edge Function tidak mengimpor kode frontend. Tes compile-time memeriksa kompatibilitas bentuk kedua tipe tersebut.

`text_version` berasal dari metadata/versi modul backend; field ini belum ada pada `DocumentParseResult` dan tidak ditambahkan secara sepihak ke parser. Entry point PIC B harus menyelesaikan `module_id + text_version` menjadi snapshot hasil parse yang tepat sebelum memanggil analyzer. `extractedText` dan `sourceMap` wajib berasal dari snapshot versi yang sama, bukan dicampur dari hasil parsing/penyuntingan yang berbeda.

ID `sourceMap` adalah locator dalam satu snapshot, bukan ID permanen lintas versi: PDF memakai `PDF-P-NNN` sesuai halaman; DOCX memakai `DOC-P-NNN` sesuai urutan paragraf berisi teks. DOCX tidak memiliki nomor halaman pada kontrak parser. Analyzer memvalidasi pasangan ID dan metadata halaman/paragraf, serta memverifikasi excerpt terhadap teks pada entri sumber yang dirujuk.

Jika guru mengoreksi teks hasil preview, backend harus membuat `text_version` baru dan menyimpan `extractedText` serta `sourceMap` yang sudah diselaraskan dalam snapshot yang sama. Analyzer memvalidasi konsistensi internal snapshot yang diterima, tetapi tidak memiliki akses database untuk membuktikan bahwa `module_id + text_version` benar-benar menunjuk snapshot tersebut. Jaminan pengikatan versi, penyimpanan snapshot immutable, dan penyajian referensi historis menjadi tanggung jawab PIC B. Jangan membawa `source_map_id` dari versi lama ke versi baru tanpa pemetaan ulang. Jika hasil parse belum disimpan, mekanisme penyimpanan/transport perlu disepakati oleh PIC B; kontrak API publik PRD tetap hanya `module_id + text_version`.

## Output internal C-02

Output menggunakan snake_case agar cocok dengan konvensi payload API proyek:

- `analysis_schema_version`: versi bentuk hasil C-02, terpisah dari quest schema.
- `module_id`, `document_id`, `text_version`: identitas input yang dipertahankan dari caller.
- `status`: `completed` atau `insufficient_evidence`.
- `objectives`: `statement`, `basis`, `source_references`. Tidak ada ID permanen LO pada output analyzer; PIC B membuat ID setelah menyimpan objective.
- `warnings`: daftar kode dan pesan yang dapat ditindaklanjuti.

`basis` LO dibedakan menjadi `explicit` atau `inferred`. ID permanen LO ditetapkan oleh PIC B setelah objective disimpan.

## Provenance

Model internal hanya mengembalikan `source_id` dan kutipan verbatim. Kode C-02 melakukan lookup pada `sourceMap` C-01 dan membentuk referensi output sesuai usulan C3 PIC B:

- PDF: `source_type: pdf`, `source_map_id`, dan `page` asli.
- DOCX: `source_type: docx`, `source_map_id`, `paragraph_index`, dan `section` bila tersedia.
- `source_map_id` mempertahankan ID C-01 apa adanya (misalnya `PDF-P-001` atau `DOC-P-001`).

DOCX tidak diberi nomor halaman. Kutipan dibandingkan dengan teks sumber setelah normalisasi Unicode dan whitespace. Referensi yang tidak ditemukan tidak diterima.

## Provider adapters

`GeminiRestModel` dan `OpenRouterModel` mengimplementasikan kontrak bersama `AIModel` dari `../core/model.ts`. Keduanya mengembalikan `unknown` setelah parsing respons provider; analyzer tetap menjadi gerbang validasi schema, evidence, dan source reference. Nama `LearningAnalyzerModel` dan `LearningAnalyzerModelRequest` dipertahankan sebagai compatibility alias untuk kode C-02 dan worker B-03.

`GeminiRestModel` memakai `generateContent` REST dan structured JSON output. `OpenRouterModel` memakai Chat Completions dan saat ini mengarahkan JSON melalui prompt; dukungan native structured output dapat ditambahkan setelah pengujian per model. `apiKey` dan `model` wajib diberikan oleh server melalui secret/config, bukan ditulis ke source. Model dibuat configurable melalui `GEMINI_MODEL`; jangan mengunci nama model yang belum disetujui/diaktifkan pada project AI tim.

Tidak ada automatic retry atau caching pada modul ini. Pemetaan error ke envelope API (`AI_UNAVAILABLE`, `VALIDATION_ERROR`, dan lain-lain), quota guard, caching, serta job status dikelola PIC B/C-04 sesuai kesepakatan.

## Async job handoff (C2)

`analyzeLearningObjectives(input, model)` already returns a `Promise<LearningAnalysisResult>` and is the callable boundary for the backend job runner. PIC B invokes it after authenticating the teacher and resolving the exact `module_id + text_version` snapshot. The function itself does not create a job, persist status/result, retry, cache, or access the database.

A successful analyzer call can return `status: "completed"` or `status: "insufficient_evidence"`; the latter is a completed analysis outcome, not a failed backend job. Provider/input failures reject with `LearningAnalyzerError`, including a stable internal `code` and `retryable` flag. PIC B owns mapping to the public API envelope and must keep `causeValue` server-side.

The PRD specifies `analysis_job_id` for `POST /api/modules/analyze`, but does not specify the public operation for retrieving job status/result. PIC B must publish that endpoint/operation in OpenAPI before PIC A wires its result UI. See `docs/C02_ASYNC_JOB_HANDOFF.md` for the detailed handoff.

## Testing

Unit test di `apps/web/src/lib/learning-analyzer/learning-analyzer.test.ts` menggunakan fake model caller. Test tidak memerlukan jaringan, API key, Supabase, atau Gemini live.
