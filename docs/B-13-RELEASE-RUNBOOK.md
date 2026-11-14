# B-13 — Runbook staging, gerbang keamanan, dan jalur demo

Status: DRAFT PIC B. Disusun dari kode `develop` (commit `917a7b3`). Belum dijalankan; tidak ada bukti test di dokumen ini.
Semua perintah di bawah ditulis satu baris. Ganti `<...>` dengan nilai Anda. Contoh sintaks mencakup PowerShell 7/Git Bash; PowerShell 5.1 tidak mendukung operator `&&` dan variabel `$(...)` perlu diperiksa. Jangan eksekusi blok setup staging tanpa review perintah satu per satu. `supabase db push` dapat mengubah database proyek yang ditautkan.

## 1. Variabel dan secret

| Nama | Dibaca oleh | Catatan |
|---|---|---|
| `STUDENT_CREDENTIAL_HMAC_KEY` | `student-api` | Wajib, minimal 32 byte. Tanpa ini join dan auth siswa mengembalikan `INTERNAL_ERROR`. Set sekali. |
| `ANALYSIS_WORKER_SECRET` | `analysis-worker` | Wajib, minimal 32 karakter, harus sama dengan secret Vault `b04_analysis_worker_secret`. |
| `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | `analysis-worker` | Pilih satu provider. |
| `ALLOWED_ORIGINS` | `api`, `student-api` | Origin persis dipisah koma. Default hanya `http://localhost:5173`. |
| `B06_ENABLE_QUEST_DEMO_ROUTES` | `api` | Membuka route draft, approve, publish. Default mati. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | semua fungsi | Disediakan otomatis oleh Supabase. |

Frontend butuh dua base URL: `.../functions/v1/api` (guru) dan `.../functions/v1/student-api` (siswa). Saat ini `apps/web/.env.example` hanya punya yang pertama (lihat CCR-09).

## 2. Urutan bring-up staging

1. Hubungkan CLI ke proyek staging:

```
npx supabase link --project-ref <project-ref>
```

2. Terapkan migrasi:

```
npx supabase db push
```

3. Buat nilai acak 64 hex (cukup lihat hasilnya, jangan commit):

```
node -p "require('crypto').randomBytes(32).toString('hex')"
```

4. Set secret (jalankan terpisah untuk `STUDENT_CREDENTIAL_HMAC_KEY` dan `ANALYSIS_WORKER_SECRET`, masing-masing dengan nilai acak sendiri):

```
npx supabase secrets set STUDENT_CREDENTIAL_HMAC_KEY=$(node -p "require('crypto').randomBytes(32).toString('hex')")
```

```
npx supabase secrets set ANALYSIS_WORKER_SECRET=<nilai-yang-sama-dengan-yang-akan-masuk-Vault>
```

5. Set CORS ke domain frontend sebenarnya:

```
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://<domain-pages>.pages.dev
```

6. Set provider AI (contoh Gemini; nama model isi sesuai akun):

```
npx supabase secrets set AI_PROVIDER=gemini GEMINI_API_KEY=<key> GEMINI_MODEL=<model>
```

7. Deploy fungsi (config.toml sudah mengatur `verify_jwt` per fungsi):

```
npx supabase functions deploy api && npx supabase functions deploy student-api && npx supabase functions deploy analysis-worker
```

8. Isi Vault di SQL editor Supabase (dua perintah terpisah; secret harus sama dengan langkah 4):

```
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/analysis-worker', 'b04_analysis_worker_url');
```

```
select vault.create_secret('<ANALYSIS_WORKER_SECRET>', 'b04_analysis_worker_secret');
```

9. Aktifkan cron HANYA setelah langkah 8 (migrasi sengaja tidak mengaktifkannya):

```
select cron.schedule('b04-analysis-worker', '* * * * *', 'select b04_internal.dispatch_analysis_worker()');
```

Jika AI live tidak dipakai di demo, lewati langkah 6, 8, 9 dan pakai fallback yang diberi label jujur.

## 3. Gerbang keamanan SEBELUM scoring atau publish diaktifkan

Jalankan di stack lokal (nama container `supabase_db_jejaknalar` dipakai skrip `.ps1` yang sudah ada). Cara menjalankan SQL test di bawah belum saya uji; kegagalan test berupa error dan exit non-zero karena `ON_ERROR_STOP`.

```
npx supabase start
```

```
npx supabase db reset # HANYA database lokal yang telah dikonfirmasi; JANGAN gunakan --linked
```

SQL test (PowerShell, semua `*.test.sql` berurutan):

```
Get-ChildItem supabase/tests/*.test.sql | ForEach-Object { Write-Host $_.Name; Get-Content $_.FullName -Raw | docker exec -i supabase_db_jejaknalar psql -U postgres -v ON_ERROR_STOP=1 }
```

Smoke HTTP (satu per satu, simpan keluarannya sebagai bukti):

```
powershell -ExecutionPolicy Bypass -File supabase/tests/b06_teacher_quest_workflow_http.ps1
```

Cari secret yang ikut ter-commit (periksa tiap hasil; fixture lokal boleh muncul):

```
git grep -nE "eyJ[A-Za-z0-9_-]{20,}\.|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}" -- . ":(exclude)package-lock.json"
```

Checklist yang harus hijau dan terdokumentasi (G3):

- [ ] Guru A tidak bisa membaca kelas, draft, modul, atau laporan guru B (harus 404/403 tanpa membocorkan record).
- [ ] Siswa A tidak bisa membaca attempt, hasil, atau checkpoint siswa B.
- [ ] Payload `GET /student/quests/:id` hanya berisi 8 key QuestV1; tidak ada kunci jawaban atau rubrik.
- [ ] `b07_finalize_assessment_score` tidak bisa dipanggil oleh `anon` atau `authenticated` (test `b07_scoring_finalization`, `b07_private_rubric_security`).
- [ ] Tabel rubrik privat tidak terbaca dari klien (test `b07_private_rubric_security`).
- [ ] Publish ditolak untuk draft yang belum approved atau tidak identik (test `b06_publication_approval_gate`).
- [ ] ID fixture tidak bisa terbit (test `b10_*`, `b11_*`).
- [ ] Replay `idempotency_key` tidak menggandakan attempt atau skor (`b05_concurrency_http_smoke`).
- [ ] Rate limit join aktif (`b05_join_rate_limit`).
- [ ] `B06_ENABLE_QUEST_DEMO_ROUTES` mati di produksi; bila dinyalakan di staging untuk satu publish, catat kapan dan matikan lagi.

## 4. Jalur demo minimum dan fallback

Jalur: guru login -> kelas -> quest terpublish (satu, dari seed terkontrol) -> siswa join -> main -> submit -> hasil -> laporan (API).
Jika scoring belum aktif saat batas waktu, tampilkan alur siswa dengan label "SIMULASI" yang terlihat jelas; jangan menyebut skor mock sebagai nilai resmi. Fallback AI juga harus diberi label, bukan disamarkan sebagai generasi live.

## 5. Gap terbuka (tidak dikerjakan patch ini)

1. Worker scoring: ada di branch `feat/B-assessment-scoring-worker`, bukan di `develop`. Rubrik privat juga belum punya jalur pengisian di `develop`.
2. Kuota AI per guru (PRD FR-13) belum diberlakukan; hanya ada pembatasan job aktif unik dan retry.
3. `submit` dan `result` tidak mengembalikan feedback per item maupun `next_path` (hanya `attempt_id`, `status`, `score`, `scored_at`); lihat CCR-09.
4. Tidak ada penulis `adaptive_decisions` di fungsi mana pun di `develop`.
5. OpenAPI belum memuat `/session`, `/checkpoints/*`, `/assessments/{id}/result`, `/quests/drafts*`, dan masih memuat `/quests/generate` yang tidak punya route.
6. Tidak ada UI approve/publish quest, buat kelas, atau laporan guru.
7. CI tidak menjalankan SQL test, Deno test, maupun skrip `.ps1`.
8. Penyimpanan Story Bundle belum ada; kontrak bundle masih proposal (GDD 11 dan 13).
