
$ErrorActionPreference = 'Stop'

function Invoke-LocalSql {
  param([string]$Query)

  $rows = @(docker exec supabase_db_jejaknalar psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c $Query)

  if ($LASTEXITCODE -ne 0) {
    throw 'Perintah SQL lokal gagal'
  }

  return ($rows -join "`n").Trim()
}

function Assert-HttpUnauthorized {
  param(
    [string]$Url,
    [hashtable]$Headers = @{}
  )

  try {
    $null = Invoke-WebRequest -Uri $Url -Method Get -Headers $Headers -UseBasicParsing -ErrorAction Stop
    throw 'Request tanpa akses seharusnya ditolak'
  }
  catch {
    $response = $_.Exception.Response

    if ($null -eq $response) {
      throw
    }

    $status = [int]$response.StatusCode

    if ($status -ne 401) {
      throw "Expected HTTP 401, received HTTP $status"
    }
  }
}

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

$fixtureCreated = $false

$baseUrl = 'http://127.0.0.1:54321/functions/v1/student-api'
$joinUrl = "$baseUrl/classes/$classId/join"
$sessionUrl = "$baseUrl/session"

try {
  # Create a synthetic teacher and class.
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
  'b05-auth-$teacherId@example.invalid',
  now(),
  now()
);
INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
)
VALUES (
  '$classId',
  '$teacherId',
  'B05 Auth Smoke',
  7,
  '$classCode'
);
COMMIT;
"@

  Invoke-LocalSql $setupSql | Out-Null
  $fixtureCreated = $true

  # Test 1: Join and receive a new access code.
  $joinBody = @{
    class_code = $classCode
    display_name = 'Auth Test Student'
  } | ConvertTo-Json -Compress

  $joinResponse = Invoke-WebRequest -Uri $joinUrl -Method Post -ContentType 'application/json' -Body $joinBody -UseBasicParsing -ErrorAction Stop

  if ([int]$joinResponse.StatusCode -ne 201) {
    throw 'Join must return HTTP 201'
  }

  $join = $joinResponse.Content | ConvertFrom-Json

  if (
    $join.ok -ne $true -or
    -not $join.data.student_session_id -or
    -not $join.data.access_code
  ) {
    throw 'Join response is incomplete'
  }

  Write-Host 'B05_AUTH_JOIN_201_PASS'

  $accessCode = [string]$join.data.access_code
  $sessionId = [string]$join.data.student_session_id

  # Test 2: Valid access code must return the correct session.
  $validResponse = Invoke-WebRequest -Uri $sessionUrl -Method Get -Headers @{
    'X-Student-Access-Code' = $accessCode
  } -UseBasicParsing -ErrorAction Stop

  $session = $validResponse.Content | ConvertFrom-Json

  if (
    [int]$validResponse.StatusCode -ne 200 -or
    $session.ok -ne $true -or
    $session.data.student_session_id -ne $sessionId -or
    $session.data.class_id -ne $classId -or
    $session.data.display_name -ne 'Auth Test Student'
  ) {
    throw 'Valid student session response does not match'
  }

  if (
    $validResponse.Content.Contains('access_code_hash') -or
    $validResponse.Content.Contains('recovery_token_hash') -or
    $validResponse.Content.Contains($accessCode)
  ) {
    throw 'Sensitive credential information leaked in session response'
  }

  Write-Host 'B05_AUTH_VALID_CODE_200_PASS'

  # Test 3: Missing header must return HTTP 401.
  Assert-HttpUnauthorized -Url $sessionUrl

  Write-Host 'B05_AUTH_MISSING_HEADER_401_PASS'

  # Test 4: A syntactically valid but unknown code must return HTTP 401.
  $wrongCode = 'AAAAAAAAAAAAAAAAAAAA'

  if ($wrongCode -eq $accessCode) {
    $wrongCode = 'BBBBBBBBBBBBBBBBBBBB'
  }

  Assert-HttpUnauthorized -Url $sessionUrl -Headers @{
    'X-Student-Access-Code' = $wrongCode
  }

  Write-Host 'B05_AUTH_WRONG_CODE_401_PASS'

  # Test 5: Revocation must invalidate the access code.
  $updated = Invoke-LocalSql "UPDATE public.student_sessions SET revoked_at = now() WHERE id = '$sessionId' AND class_id = '$classId' RETURNING id;"

  if ($updated -ne $sessionId) {
    throw 'Failed to revoke the synthetic student session'
  }

  Assert-HttpUnauthorized -Url $sessionUrl -Headers @{
    'X-Student-Access-Code' = $accessCode
  }

  Write-Host 'B05_AUTH_REVOKED_SESSION_401_PASS'
  Write-Host 'B05_STUDENT_AUTH_HTTP_PASS'
}
finally {
  if ($fixtureCreated) {
    Invoke-LocalSql "BEGIN; DELETE FROM public.classes WHERE id = '$classId'; DELETE FROM auth.users WHERE id = '$teacherId'; COMMIT;" | Out-Null

    Write-Host 'B05_AUTH_SYNTHETIC_DATA_CLEANED'
  }
}
