# Must run in repository root after npm dependencies can be downloaded.
# Stops at first failed gate, never deploys or changes remote branches.
param([string]$Repo = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
Push-Location $Repo
try {
  $commands = @(
    @('npm', 'ci'),
    @('npm', 'run', 'lint'),
    @('npm', 'run', 'typecheck'),
    @('npm', 'run', 'test'),
    @('npm', 'run', 'contract:lint'),
    @('npm', 'run', 'build')
  )
  foreach ($parts in $commands) {
    Write-Host "`n>>> $($parts -join ' ')"
    $exe = $parts[0]
    $arguments = $parts[1..($parts.Length - 1)]
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "FAIL: $($parts -join ' ') (exit $LASTEXITCODE)" }
    Write-Host "PASS: $($parts -join ' ')"
  }
  Write-Host "`nPASS: Gates frontend/contract. SQL, Deno, security negative, E2E staging belum termasuk!"
} finally { Pop-Location }
