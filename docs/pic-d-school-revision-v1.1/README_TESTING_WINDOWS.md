# JejakNalar PIC D — MERGED SCHOOL REVISION v1.1

## What this ZIP is
Full updated **repository** with a single top-level folder `jejaknalar/`. This is NOT a patch-only ZIP. It preserves all original project files, fixes the School Sprint 2 preview and adds documentation. It does not contain `.git`, `node_modules`, `.env`, build output or secrets.

## IMPORTANT: Backup and merge
The ZIP has a top-level `jejaknalar/` folder. Extract to `D:\JEJAKNALAR\` **not** into `D:\JEJAKNALAR\jejaknalar\` (which would produce nested folders).

PowerShell:
```powershell
cd D:\JEJAKNALAR\jejaknalar
git status --short
# Save your work / back up the entire folder before replacing any files.
# For example, copy the project folder to a sibling backup folder using File Explorer.

$zip = "$env:USERPROFILE\Downloads\JejakNalar_PIC_D_Sprint2_GDD_MERGED_FULL_SCHOOL_REV_v1_1.zip"
Expand-Archive -LiteralPath $zip -DestinationPath 'D:\JEJAKNALAR' -Force
cd D:\JEJAKNALAR\jejaknalar
npm ci
npm run typecheck
npm run lint
npm test
npm run contract:lint
npm run build
npm run dev
```

Open the LOCAL address printed by Vite (usually `http://localhost:5173/sprint2.preview.html`). If your Vite port differs, use the port actually printed.

Do NOT commit or push yet. The ZIP has `.git` excluded intentionally; your existing branch/history remains on your computer.

## Manual regression checklist
1. Choose **Sekolah**, then click **Mulai episode baru**.
2. **Prolog** should appear before the player can move: who you are, situation, reason and first step. Click **Mulai menjelajah**. Open Jurnal and **Baca ulang prolog**.
3. On the game screen confirm **name of current room** and **objective in bottom dark bar**, without covering mobile controls.
4. Walk to **Bu Rani**: no permanently overlapping NPC label. Interact near her (`E`), dialogue bottom and NPC name only; no portrait or pop-up covering the entire screen.
5. Walk with WASD/arrows; hold Shift to run (mobile: LARI toggle). Legs visibly alternate; cannot move through solids or through the sides of a door.
6. Enter the building through actual front entrance, then check all six room doors and return paths. The physical doors have frames, panels, windows and handles.
7. Go to **Perpustakaan**; inspect guestbook and nearby reference objects; interaction requires proximity.
8. Go to **Ruang Guru**; after book observation, inspect the **Pak Arif / Meja Arsip Guru** investigation. Open the 3 cards and select a contextual dialogue option. This is NOT a test form.
9. Visit Kelas, Lab IPA, Lab Pengetahuan and Aula: distinguish bookshelves, computers, sink, lab table, chairs, podium, case board according to object PDF.
10. Switch DevTools device size **1280×720 → 390×844 → 1280×720** WITHOUT refresh, then move with on-screen controls; canvas must remain visible.
11. Use Help to test simulated assessment scenarios; verify `needs_support`, `developing`, `ready_for_extension` and separate `need_more_evidence`. No real score is produced.
12. Refresh and choose **Lanjutkan checkpoint**; no new prolog should interrupt a successfully restored session.

## Boundaries
`school` currently includes Halaman, Koridor (traversable connector), and 6 destinations. City files are preserved unchanged. This preview still uses a **fixture story and mock assessment**. An approved PIC C story bundle + published QuestV1 + PIC B scoring/versions/checkpoint API are required before authentic student mode. Do not pretend that different modules are automatically integrated already.

## Files and docs
- `CHANGELOG.md`: implemented revisions.
- `TEST_REPORT.md`: real test evidence, including toolchain blockers.
- `OBJECT_REFERENCE_MAPPING.csv`: every school object ID mapped to PDF page and renderer.
- `screenshots/`: browser smoke screenshots, including mobile 390×844.
