# B-04 — Analysis Worker Reliability

## Ringkasan

B-04 menambahkan pemulihan analysis job yang macet, retry terbatas untuk kegagalan sementara, dan scheduler berbasis Supabase Cron.

Implementasi melanjutkan B-03 tanpa mengubah nama atau parameter publik RPC:

- `b03_claim_next_analysis_job()`
- `b03_finish_analysis_job(...)`

## Kebijakan retry

| Kondisi                         | Perilaku                                      |
| ------------------------------- | --------------------------------------------- |
| Error retryable, percobaan 1    | `queued`, retry setelah 30 detik              |
| Error retryable, percobaan 2    | `queued`, retry setelah 2 menit               |
| Error retryable, percobaan 3    | `failed`, tidak retry lagi                    |
| Error non-retryable             | Langsung `failed`                             |
| Worker macet lebih dari 5 menit | Recovery ketika RPC claim berikutnya berjalan |
| `insufficient_evidence`         | `completed`, tanpa Learning Objectives        |

Waktu retry adalah waktu paling awal job boleh diambil. Eksekusi aktual bergantung pada interval scheduler.

Worker lama tidak boleh menyelesaikan job setelah status atau nomor percobaannya berubah.

## Komponen database

Migrasi:

1. `20261112213000_b04_stale_job_recovery.sql`
2. `20261112223000_b04_transient_retry.sql`
3. `20261112230000_b04_worker_scheduler.sql`

Kolom `analysis_jobs.next_attempt_at` menentukan kapan job boleh diklaim kembali.

Fungsi `b04_internal.dispatch_analysis_worker()`:

- Tidak mengirim HTTP jika tidak ada pekerjaan.
- Mendeteksi job `queued` yang sudah jatuh tempo.
- Mendeteksi job `processing` yang melewati lease 5 menit.
- Mengambil URL dan secret dari Supabase Vault.
- Mengirim HTTP POST melalui `pg_net`.

Schema `b04_internal` tidak diekspos sebagai public API.

## Setup staging/produksi

### 1. Prasyarat

- Migrasi B-03 dan B-04 telah diterapkan.
- Edge Function `analysis-worker` telah di-deploy.
- Dependency Learning Analyzer PIC C tersedia pada deployment.
- Extension `pg_cron`, `pg_net`, dan Supabase Vault aktif.
- Konfigurasi `analysis-worker` menggunakan `verify_jwt = false`.

Penting: `verify_jwt = false` hanya untuk worker internal. Kode worker tetap wajib memverifikasi header `x-worker-secret`.

### 2. Konfigurasi secret

Siapkan `ANALYSIS_WORKER_SECRET` pada environment Edge Function dengan nilai acak minimal 32 karakter.

Simpan dua secret bernama berikut di Supabase Vault:

- `b04_analysis_worker_url`: URL HTTPS Edge Function pada environment terkait.
- `b04_analysis_worker_secret`: nilai yang sama persis dengan `ANALYSIS_WORKER_SECRET`.

Gunakan pengelolaan secret environment yang aman. Jangan menaruh nilai secret di repository, migrasi SQL, dokumentasi, atau log.

URL lokal `http://kong:8000/functions/v1/analysis-worker` hanya berlaku untuk jaringan Docker Supabase lokal. Jangan gunakan URL tersebut pada staging/produksi.

### 3. Aktifkan Cron

Jadwal tidak dibuat otomatis oleh migrasi B-04. Periksa terlebih dahulu apakah job sudah terdaftar:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'b04-analysis-worker';
```

Jika belum ada, aktifkan satu kali melalui akses database administrator:

```sql
select cron.schedule(
  'b04-analysis-worker',
  '* * * * *',
  'SELECT b04_internal.dispatch_analysis_worker();'
);
```

Jadwal berjalan setiap menit. Jangan membuat jadwal duplikat.

### 4. Monitoring

Periksa status jadwal:

```sql
select jobid, jobname, active
from cron.job
where jobname = 'b04-analysis-worker';
```

Periksa riwayat eksekusi:

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where jobname = 'b04-analysis-worker'
)
order by start_time desc
limit 20;
```

Status Cron `succeeded` berarti perintah SQL selesai tanpa error. Itu tidak otomatis menjamin HTTP berhasil atau analisis AI selesai. Periksa juga respons `pg_net`, log Edge Function, dan status `analysis_jobs`.

### 5. Menonaktifkan scheduler

Jika scheduler harus dihentikan:

```sql
select cron.unschedule('b04-analysis-worker');
```

Ini menghentikan pemanggilan berikutnya, tetapi tidak membatalkan HTTP request atau job yang sudah berjalan.

## Respons worker

Worker membaca status job terbaru dari database setelah finalisasi.

- `completed`: hasil analisis disimpan.
- `queued`: kegagalan sementara, menunggu retry.
- `failed`: kegagalan terminal.

Untuk job yang kembali `queued`, respons menyertakan `retryable` dan `next_attempt_at`.

HTTP 200 dari worker menunjukkan permintaan worker ditangani, bukan berarti analisis selalu `completed`.

## Validasi lokal

Telah berhasil:

- Stale-job recovery dan batas tiga percobaan.
- Penolakan finalisasi worker lama.
- Retry 30 detik dan 2 menit.
- Penanganan error non-retryable.
- Persistence Learning Objectives.
- Hasil `insufficient_evidence`.
- TypeScript, ESLint, 55 unit test, dan build web.
- Deno check dan lint pada `analysis-worker`.
- Autentikasi `x-worker-secret`.
- Cron lokal, izin fungsi scheduler, Vault, dan `pg_net`.
- HTTP worker saat antrean kosong.
- Dispatch job sintetis dalam transaksi ROLLBACK.

Belum diverifikasi:

- Pemrosesan job AI end-to-end setelah retry.
- Deployment dan monitoring pada staging/produksi.

## Catatan integrasi

B-04 bergantung pada Learning Analyzer C-02. Pada saat pengujian lokal, dependency tersebut diambil sementara dari branch PIC C karena belum tersedia pada `develop`.

Jangan memasukkan source PIC C sementara atau `deno.lock` hasil pemeriksaan lokal ke commit B-04.

Merge B-04 perlu menunggu dependency PIC C tersedia dan regresi pada branch integrasi dinyatakan PASS.

Temuan dependency dari `npm audit` juga perlu ditinjau sebelum deployment produksi.
