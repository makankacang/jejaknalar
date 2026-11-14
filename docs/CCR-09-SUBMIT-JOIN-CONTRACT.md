# CCR-09 — Kontrak submit/result dan mode join siswa

Status: USULAN dari PIC B. Belum final sampai disetujui A + D (dan C bila menyentuh ID). Tidak mengubah `contracts/*` pada PR ini.
Dasar: kode `develop` (`supabase/functions/student-api/index.ts`), PRD 8.2 dan 9.1, OpenAPI v1.0, `apps/web/src/game/sprint0/repositories-v1.ts`.

## 1. Ketidaksesuaian yang ditemukan

| Hal | PRD / OpenAPI | Game (`repositories-v1.ts`, `flow.ts`) | Backend `develop` |
|---|---|---|---|
| Status submit | OpenAPI: 201 hasil scoring; PRD: scored items + feedback + `next_path` | `status: 'scored'` wajib; selain itu `flow.ts` melempar error | 202 `pending_scoring` (200 bila sudah final) |
| Data submit | PRD: `attempt_id`, `answers[]`, `idempotency_key` | `quest_version_id`, `idempotency_key`, `answers[{item_id,value}]` | `quest_version_id`, `idempotency_key` (uuid), `answers[{item_id,value}]`; respons `{attempt_id,status,replayed}` |
| Skor dan feedback | di respons submit | `score`, `feedback[]` di respons submit | hanya di `GET /assessments/:attempt_id/result`: `{attempt_id,quest_version_id,status,score,scored_at}`; tidak ada feedback per item atau `next_path` |
| Join | PRD: `class_code` + `student_access_code`; kode kelas bukan faktor autentikasi | placeholder | `class_code` + `display_name`; server menerbitkan `access_code` dan `recovery_token` |
| Base URL | satu `/api/...` | satu `VITE_API_BASE_URL` | dua fungsi: `/functions/v1/api` dan `/functions/v1/student-api` |

## 2. Usulan A — submit asinkron dengan polling (backend tidak berubah)

- `POST /student-api/assessments/submit` tetap: 202 `pending_scoring`, 200 `scored` atau `insufficient_evidence`.
- Klien memanggil `GET /student-api/assessments/:attempt_id/result` sampai `status` bukan `pending_scoring`. Saran: jeda 1 s, 2 s, 4 s, 4 s, ... maksimal sekitar 30 s, lalu tampilkan status "belum dinilai" dengan tombol coba lagi.
- Tipe game: `SubmitAssessmentDataV1.status` menjadi `'pending_scoring' | 'scored' | 'insufficient_evidence'`; `score` bisa `null` bila `insufficient_evidence`.
- Timeout atau `pending_scoring` tidak boleh ditampilkan sebagai skor, dan retry jaringan memakai `idempotency_key` yang sama.
- Feedback per item dan `next_path` BELUM disediakan backend. Sampai ada keputusan terpisah (B + D), UI menampilkan hanya skor dan status; teks feedback yang ada di game bersifat presentasi dan tidak boleh berisi kunci jawaban.
- Perubahan OpenAPI yang menyertai (PR kontrak terpisah): submit menjadi 200/202; tambah `/assessments/{attempt_id}/result`, `/session`, `/checkpoints/{quest_version_id}`; hapus `/quests/generate` sampai ada route.

Pemilik perubahan: D (adapter dan tipe), B (OpenAPI). Persetujuan: D.

## 3. Usulan B — mode join

- Pilihan 1 (usulan untuk demo): pertahankan perilaku saat ini. Kode kelas cukup untuk mendaftar; server menerbitkan kode akses individual yang disimpan klien. Dibatasi rate limit join per kelas. Ini menyimpang dari PRD 9.1 dan harus diungkapkan sebagai keterbatasan MVP.
- Pilihan 2 (pasca-MVP): roster guru + kode individual (CCR-01/02). Membutuhkan UI guru dan perubahan backend; tidak realistis sebelum submission.
- Mode guest/demo publik tetap terpisah dari mode kelas dan tidak membuat attempt resmi.

Persetujuan: A + D + B. Jika tidak disetujui, tidak ada perubahan kode pada PR ini.

## 4. Konfigurasi frontend yang dibutuhkan D

Tambahkan variabel publik untuk fungsi siswa, misalnya `VITE_STUDENT_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1/student-api`. Header siswa: `x-student-access-code`. Kode akses disimpan di klien; jangan masuk ke log atau URL.
