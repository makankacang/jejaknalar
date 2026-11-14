$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Assert-Exit([string]$stage) {
    if ($LASTEXITCODE -ne 0) { throw "$stage FAILED - STOP" }
}

if ((git branch --show-current) -ne 'feat/D-bi8-story-preview') {
    throw 'BRANCH SALAH: gunakan WT_D_BI8_PREVIEW - STOP'
}
if (-not (Test-Path 'apps/web/bi8.preview.html')) {
    throw 'Halaman preview belum ditemukan. Extract ZIP ke root repo.'
}
if (-not (Test-Path 'node_modules/.bin/tsc.cmd')) {
    Write-Host '[0/4] npm ci' -ForegroundColor Cyan
    npm ci
    Assert-Exit 'NPM CI'
}
Write-Host '[1/4] TypeScript typecheck' -ForegroundColor Cyan
npm run typecheck
Assert-Exit 'TYPECHECK'

Write-Host '[2/4] Vitest BI8' -ForegroundColor Cyan
Push-Location 'apps/web'
try {
    npx vitest run src/features/student/bi8/bi8-model.test.ts
    Assert-Exit 'BI8 UNIT TEST'
} finally { Pop-Location }

Write-Host '[3/4] All unit tests' -ForegroundColor Cyan
npm test
Assert-Exit 'ALL UNIT TESTS'

Write-Host '[4/4] Production build' -ForegroundColor Cyan
npm run build
Assert-Exit 'BUILD'

git diff --check
Assert-Exit 'GIT DIFF CHECK'
Write-Host "`nBI8 TERMINAL CHECKS PASS - BROWSER TEST MASIH DIPERLUKAN" -ForegroundColor Green
Write-Host 'Open: http://localhost:5173/bi8.preview.html (setelah npm run dev -w apps/web -- --port 5173)' -ForegroundColor Green
git status -sb
