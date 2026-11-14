# Read-only integration inventory. No checkout/merge/push/deploy.
param([string]$Repo = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path (Join-Path $Repo '.git'))) {
  # git worktrees use a .git FILE, which Test-Path supports.
  throw "Bukan root repository/worktree Git: $Repo"
}
Write-Host "=== B-14 Integration audit (READ ONLY) ==="
& git -C $Repo status --short
if ($LASTEXITCODE -ne 0) { throw 'git status gagal' }
Write-Host 'Develop:'
& git -C $Repo log -1 --oneline origin/develop
if ($LASTEXITCODE -ne 0) { throw 'origin/develop belum tersedia; jalankan git fetch origin dahulu' }
$branches = @(
 'feat/B-12-persistent-id-binding',
 'feat/C-bi8-questv1-paired-binding',
 'feat/D-04-student-assessment-adapter',
 'feat/D-05-story-adapter',
 'feat/D-06-world-final',
 'feat/D-07-mobile-ui',
 'feat/B-assessment-scoring-worker',
 'feat/B-13-release-readiness'
)
foreach ($branch in $branches) {
  $ref = "refs/remotes/origin/$branch"
  & git -C $Repo show-ref --verify --quiet $ref
  if ($LASTEXITCODE -ne 0) { Write-Host "MISSING (remote ref belum tersedia): $branch"; continue }
  Write-Host "`n--- $branch ---"
  $counts = (& git -C $Repo rev-list --left-right --count "origin/develop...origin/$branch")
  Write-Host "Behind/Ahead vs develop: $counts"
  & git -C $Repo log -1 --oneline "origin/$branch"
  & git -C $Repo diff --stat "origin/develop...origin/$branch"
}
Write-Host "`nAudit selesai. BELUM berarti branch siap merge: tetap wajib review PR + CI + smoke test."
