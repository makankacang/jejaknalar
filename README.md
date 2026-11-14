# JejakNalar — Edu-Roguelike

Platform website pembelajaran interaktif untuk siswa SMP: guru menyiapkan materi dan menyetujui quest; siswa menyelesaikan petualangan dan menerima feedback serta latihan adaptif **BedaJalur**.

> **Status (14 Nov 2026):** backend guru dan siswa ada di `supabase/functions/`. Scoring server, publish quest lewat UI, dan koneksi game ke API **belum selesai di `develop`**. Lihat `docs/B-13-RELEASE-RUNBOOK.md` (staging, gerbang keamanan, gap) dan `docs/CCR-09-SUBMIT-JOIN-CONTRACT.md`.

## Anggota dan kepemilikan

| PIC | Area kerja |
| --- | --- |
| A | `apps/web/src/features/teacher/` — Teacher UI |
| B | `supabase/`, `contracts/`, `.github/workflows/` — Backend, kontrak, keamanan, CI |
| C | `apps/web/src/lib/parser/`, `supabase/functions/_shared/ai/` — Parser dan AI |
| D | `apps/web/src/features/student/`, `apps/web/src/game/`, `supabase/functions/_shared/rules/` — Phaser & BedaJalur |

Perubahan `contracts/*` harus disepakati PIC B dan konsumen terkait. Jangan mengedit area PIC lain tanpa PR/review.

## Persyaratan lokal

- Node.js 22 (lihat `.nvmrc`), npm, Git.
- Repository sudah di-clone dan berada di branch fitur dari `develop`.

## Mulai mengembangkan

```bash
npm ci
cp apps/web/.env.example apps/web/.env    # Linux/macOS/Git Bash
npm run dev
```

Untuk PowerShell, salin contoh env dengan `Copy-Item apps/web/.env.example apps/web/.env`.

Alamat lokal Vite secara umum `http://localhost:5173` (lihat output terminal jika berbeda). Mode `VITE_DATA_MODE=mock` adalah **konvensi environment**; adapter mock untuk fitur masing-masing masih perlu diimplementasikan oleh PIC-nya.

## Perintah verifikasi

```bash
npm run lint
npm run typecheck
npm test
npm run contract:lint
npm run build
```

Perintah harus lulus di CI sebelum merge; `npm test` pada Hari 1 baru smoke test fondasi, **bukan** pengujian fitur backend/AI/game.

## Struktur repository

```text
apps/web/                 React + Vite + TypeScript (scaffold)
contracts/                OpenAPI dan Quest JSON Schema versi yang disepakati
fixtures/public/          Payload contoh aman untuk frontend
fixtures/private-test/    Kunci penilaian hanya untuk backend/tests
scripts/                  Validasi struktur kontrak
supabase/                 Migrasi, autentikasi, API Edge Functions (hari berikutnya)
.github/workflows/         CI
```

## Alur kerja tim

1. `git checkout develop` → `git pull origin develop`.
2. `git checkout -b feat/<PIC>-<ticket>-<slug>` (atau `fix/B-01-...`).
3. Gunakan fixture/schema bersama; jangan membuat nama field/endpoints baru sepihak.
4. Jalankan seluruh perintah verifikasi, lalu PR ke `develop`.
5. Review dan CI hijau sebelum merge. `main` khusus rilis.

## Arsitektur yang dituju

- **Frontend:** React, Vite, TypeScript, Tailwind; Phaser untuk game siswa.
- **Backend:** Supabase Auth, PostgreSQL + RLS, Storage, Edge Functions (router Hono direncanakan).
- **AI:** parser PDF.js/Mammoth (PIC C), model cloud dari Edge Function; teacher approval sebelum publish.
- **Adaptive:** rules TypeScript terverifikasi dari PIC D, scoring resmi di server.
- **Hosting (rencana):** Cloudflare Pages + Supabase free tier; batas kuota harus diperiksa sebelum demo.

## Keamanan

- `VITE_*` adalah variabel publik — **jangan** menyimpan AI key atau service-role key di frontend.
- Data siswa yang digunakan dalam fixtures/demo harus sintetis.
- Kode kelas **bukan** kredensial individual. PIC B + A/D perlu mengesahkan kontrak join siswa: kode kelas **dan kode akses individual** untuk mode kelas; mode demo publik dipisahkan.
- Frontend tidak boleh menerima kunci jawaban privat; score dan otorisasi diverifikasi server.
- Kontrak, error, dan session recovery belum final sampai CCR terkait disetujui.

## Status dan blocker

Kontrak yang masih menunggu persetujuan lintas PIC: `docs/CCR_DAY1_PENDING.md` dan `docs/CCR-09-SUBMIT-JOIN-CONTRACT.md`. `contracts/api.openapi.yaml` dan `contracts/quest.schema.json` tidak diubah sepihak. Daftar gap terbuka ada di bagian 5 runbook B-13.

> Dokumen ini tidak mengklaim semua fitur sudah terimplementasi; lihat runbook untuk status per fitur.
