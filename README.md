# JejakNalar — Edu-Roguelike

## Prasyarat
- Node.js **20** (lihat `.nvmrc`)
- npm 10+
- Git

## Setup Lokal
```bash
git clone <URL_REPOSITORY>
cd jejaknalar
npm ci
Scripts
Perintah	Fungsi
npm run dev	Jalankan frontend
npm run typecheck	Cek TypeScript
npm run lint	ESLint
npm test	Unit test
npm run contract:lint	Validasi OpenAPI
Mode Data
Set VITE_DATA_MODE=mock di apps/web/.env untuk pakai fixture (tanpa backend).
Set VITE_DATA_MODE=real untuk pakai Supabase staging.

Kontrak
contracts/api.openapi.yaml v1.0

contracts/quest.schema.json v1.0

Branch
main — release

develop — integrasi

feat/<PIC>-<ticket>-<slug> — kerja harian

text

- **Paste** ke dalam file `README.md` di VS Code (klik di area editor, Ctrl+V)
- Tekan **Ctrl + S** untuk simpan

**4. Verifikasi**

- Di VS Code, klik kanan tab `README.md` → **Reveal in File Explorer** → pastikan lokasinya `jejaknalar/README.md` (bukan `jejaknalar/apps/README.md` atau lainnya)
- Buka terminal PowerShell (Ctrl + `) di dalam VS Code, jalankan:

```powershell
Test-Path README.md