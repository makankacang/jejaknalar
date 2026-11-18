# PIC D Final Integration Candidate

Candidate branch: `feat/pic-d-student-runtime-final`
Base: `origin/develop` (B-14 / PR #43 already present in the snapshot)

## What is included
- D-02 through D-07 source ancestry.
- Fetch fix and D-04 async assessment adapter.
- BI8 Story Preview and local draft persistence.
- World UX REV5 / mobile UI.
- Keyboard focus guard for student text input.
- Isolated paired C-03 preview.
- Assessment result parser and bounded polling tests.

## Important
This is an integration candidate, not a production release. `/student/join` is still the A-provided placeholder and `/demo/play` remains synthetic demo. Student Runtime must not be described as live until the blockers in `docs/pic-d-final/PIC_D_FINAL_EXECUTION_AUDIT.md` are closed.

## Windows PowerShell testing
Run from repository root after extracting this source into a clean working tree:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run contract:lint
npm run build
git diff --check
```

Run local previews:

```powershell
npm run dev -w apps/web -- --host 127.0.0.1 --port 5173
```

- `http://localhost:5173/sprint2.preview.html`
- `http://localhost:5173/bi8.preview.html`
- `http://localhost:5173/paired-c03.preview.html`
- `http://localhost:5173/demo/play` only when running the integrated router from `develop`; this remains synthetic demo.

## Git safety
- Do not overwrite `apps/web/src/App.tsx` with the old PIC D placeholder.
- Do not use `git add .` for the final PR.
- Do not push secrets, `.env`, `node_modules`, `dist`, or local demo session files.
- Create PR against `develop`; ask PIC B/A to review contract and routing boundaries.
