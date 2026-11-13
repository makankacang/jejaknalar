
$ErrorActionPreference = 'Stop'

function Invoke-LocalSql {
  param([string]$Query)

  $rows = @(docker exec supabase_db_jejaknalar psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c $Query)
  if ($LASTEXITCODE -ne 0) {
    throw 'Perintah SQL lokal gagal'
  }

  return ($rows -join "`n").Trim()
}

function Assert-HttpError {
  param(
    [string]$Url,
    [string]$Body,
    [int]$ExpectedStatus
  )

  try {
    $null = Invoke-WebRequest -Uri $Url -Method Post -ContentType 'application/json' -Body $Body -UseBasicParsing -ErrorAction Stop
    throw "Request seharusnya menghasilkan HTTP $ExpectedStatus"
  }
  catch {
    $response = $_.Exception.Response
    if ($null -eq $response) {
      throw
    }

    $actual = [int]$response.StatusCode
    if ($actual -ne $ExpectedStatus) {
      throw "HTTP $ExpectedStatus diharapkan, tetapi menerima HTTP $actual"
    }
  }
}

$secretFile = '.\supabase\.env.student-api.local'
if (-not (Test-Path $secretFile)) {
  throw 'File HMAC lokal tidak ditemukan'
}

$secretLine = Get-Content $secretFile |
  Where-Object { $_.StartsWith('STUDENT_CREDENTIAL_HMAC_KEY=') } |
  Select-Object -First 1

if (-not $secretLine) {
  throw 'Konfigurasi HMAC tidak ditemukan'
}

$secret = $secretLine.Substring('STUDENT_CREDENTIAL_HMAC_KEY='.Length)

$teacherId = [guid]::NewGuid().ToString()
$classId = [guid]::NewGuid().ToString()

$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
$randomBytes = New-Object byte[] 8
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

try {
  $rng.GetBytes($randomBytes)
}
finally {
  $rng.Dispose()
}

$classCode = -join ($randomBytes | ForEach-Object {
  $alphabet[[int]($_ -band 31)]
})

$wrongCode = if ($classCode -eq 'AAAAAAAA') {
  'BBBBBBBB'
} else {
  'AAAAAAAA'
}

$fixtureCreated = $false
$url = "http://127.0.0.1:54321/functions/v1/student-api/classes/$classId/join"

try {
  # Create local synthetic teacher and class.
  $setupSql = @"
BEGIN;
INSERT INTO auth.users (
  id, instance_id, aud, role, email, created_at, updated_at
)
VALUES (
  '$teacherId',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'b05-$teacherId@example.invalid',
  now(),
  now()
);
INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
)
VALUES (
  '$classId', '$teacherId', 'B05 HTTP Smoke', 7, '$classCode'
);
COMMIT;
"@

  Invoke-LocalSql $setupSql | Out-Null
  $fixtureCreated = $true

  # Test 1: Valid join must return HTTP 201.
  $validBody = @{
    class_code = $classCode
    display_name = 'B05 Smoke Student'
  } | ConvertTo-Json -Compress

  $result = Invoke-WebRequest -Uri $url -Method Post -ContentType 'application/json' -Body $validBody -UseBasicParsing -ErrorAction Stop
  $joined = $result.Content | ConvertFrom-Json

  if (
    [int]$result.StatusCode -ne 201 -or
    $joined.ok -ne $true -or
    -not $joined.data.student_session_id -or
    -not $joined.data.access_code -or
    -not $joined.data.recovery_token -or
    $joined.data.class_id -ne $classId
  ) {
    throw 'Respons HTTP 201 tidak sesuai kontrak'
  }

  Write-Host 'B05_JOIN_201_PASS'

  # Test 2: Wrong class code must return HTTP 404.
  $wrongBody = @{
    class_code = $wrongCode
    display_name = 'B05 Wrong Code'
  } | ConvertTo-Json -Compress

  Assert-HttpError -Url $url -Body $wrongBody -ExpectedStatus 404
  Write-Host 'B05_WRONG_CODE_404_PASS'

  # Test 3: Duplicate active name must return HTTP 409.
  $duplicateBody = @{
    class_code = $classCode
    display_name = '  b05 SMOKE STUDENT  '
  } | ConvertTo-Json -Compress

  Assert-HttpError -Url $url -Body $duplicateBody -ExpectedStatus 409
  Write-Host 'B05_DUPLICATE_NAME_409_PASS'

  # Test 4: Check exact HMAC digests in the database.
  # Credential plaintext is never printed.
  $sessionId = [string]$joined.data.student_session_id

  $storedHashes = Invoke-LocalSql "SELECT access_code_hash || '|' || recovery_token_hash FROM public.student_sessions WHERE id = '$sessionId' AND class_id = '$classId';"

  $hmac = [System.Security.Cryptography.HMACSHA256]::new(
    [System.Text.Encoding]::UTF8.GetBytes($secret)
  )

  try {
    $accessHash = [BitConverter]::ToString(
      $hmac.ComputeHash(
        [System.Text.Encoding]::UTF8.GetBytes(
          [string]$joined.data.access_code
        )
      )
    ).Replace('-', '').ToLowerInvariant()

    $recoveryHash = [BitConverter]::ToString(
      $hmac.ComputeHash(
        [System.Text.Encoding]::UTF8.GetBytes(
          [string]$joined.data.recovery_token
        )
      )
    ).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $hmac.Dispose()
  }

  if ($storedHashes -cne "$($accessHash)|$($recoveryHash)") {
    throw 'HMAC database tidak cocok dengan credential hasil join'
  }

  Write-Host 'B05_CREDENTIAL_HMAC_PASS'

  # All three requests must consume a rate-limit attempt.
  $attempts = Invoke-LocalSql "SELECT attempts FROM public.b05_join_rate_limits WHERE class_id = '$classId';"

  if ([int]$attempts -ne 3) {
    throw "Rate limit seharusnya mencatat 3 percobaan, bukan $attempts"
  }

  Write-Host 'B05_JOIN_BUDGET_COUNT_PASS'
  Write-Host 'B05_STUDENT_JOIN_HTTP_PASS'
}
finally {
  if ($fixtureCreated) {
    # Removing the class cascades to student sessions and budget rows.
    # The synthetic teacher is removed afterward.
    Invoke-LocalSql "BEGIN; DELETE FROM public.classes WHERE id = '$classId'; DELETE FROM auth.users WHERE id = '$teacherId'; COMMIT;" | Out-Null
    Write-Host 'B05_SYNTHETIC_DATA_CLEANED'
  }
}
