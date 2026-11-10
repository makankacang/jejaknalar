# Handoff Day 1 (B-01) — JejakNalar

Status: **fondasi repository siap dipasang / diuji pada Windows**, bukan fitur backend selesai.

## Bagian yang disiapkan
- Scaffold React + Vite + TypeScript: `apps/web/index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts`.
- Script root untuk `lint`, `typecheck`, `test`, `contract:lint`, `build`.
- Validasi fixture JSON quest (`data` dalam response envelope) dan pemeriksaan OpenAPI.
- CI GitHub Actions menjalankan `npm ci`, lint, typecheck, test, contract lint, build.
- Dokumentasi: README, error codes, CCR pending. Pemisahan env client/server.

## Belum diimplementasikan (bukan Day 1)
- Auth, database, migrations, Supabase RLS, Hono API, upload parser, Gemini, gameplay dan adaptasi nyata.
- Mock adapter nyata: fixture sudah tersedia, wiring `VITE_DATA_MODE` belum dibuat.
- Siswa join aman: kontrak join saat ini BELUM final; bahas `docs/CCR_DAY1_PENDING.md` dengan PIC A dan PIC D sebelum implementasi.

## Checklist setelah menerapkan ZIP
1. `npm install react react-dom -w apps/web`
2. `npm install -D @types/react @types/react-dom @vitejs/plugin-react -w apps/web`
3. `npm install -D ajv ajv-formats @redocly/cli`
4. `npm ci`
5. `npm run lint && npm run typecheck && npm test && npm run contract:lint && npm run build`
6. `npm run dev` — pastikan landing scaffold tampil.
7. Review `git diff`, buat PR ke `develop`. Jangan commit secret atau folder hasil build.

> Catatan: jika `npm run contract:lint` menemukan warning/error OpenAPI, perbaiki kontrak melalui review PIC B dan konsumen terkait; jangan memakai `|| true` untuk melewati error.

## Handoff anggota
| PIC | Awal yang dapat dilakukan | Batas |
|---|---|---|
| A | Desain teacher UI dan placeholder routes | Tidak mengubah kontrak API sepihak. |
| B | Steward `contracts/`, `supabase/`, CI | Tidak memasuki implementasi schema produksi sebelum rapat CCR. |
| C | Document parser/AI adapter dengan fixture draft | Tidak mengubah `quest.schema.json` sepihak. |
| D | Phaser/quest loader dan mock assessment | Tidak memasukkan answer key ke bundle frontend. |
