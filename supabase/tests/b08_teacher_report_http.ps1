
$ErrorActionPreference = 'Stop'

$base = 'http://127.0.0.1:54321'
$reportApi = "$base/functions/v1/api/classes"
$db = 'supabase_db_jejaknalar'

# Read local keys without printing them.
$envLines = @(cmd /c "npx supabase status -o env 2>NUL")
if ($LASTEXITCODE -ne 0) {
  throw 'Supabase lokal tidak tersedia'
}

function Get-LocalKey {
  param([string]$Name)

  $line = $envLines |
    Where-Object { $_.StartsWith("$Name=") } |
    Select-Object -First 1

  if (-not $line) {
    throw "Kunci $Name tidak ditemukan"
  }

  return $line.Substring($Name.Length + 1).Trim('"').Trim("'")
}

$anonKey = Get-LocalKey 'ANON_KEY'
$serviceKey = Get-LocalKey 'SERVICE_ROLE_KEY'

$adminHeaders = @{
  apikey = $serviceKey
  Authorization = "Bearer $serviceKey"
}

$authHeaders = @{
  apikey = $anonKey
}

function Invoke-LocalSql {
  param([string]$Query)

  $null = $Query |
    docker exec -i $db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres

  if ($LASTEXITCODE -ne 0) {
    throw 'SQL lokal gagal'
  }
}

function New-Teacher {
  param([string]$Email, [string]$Password)

  $body = @{
    email = $Email
    password = $Password
    email_confirm = $true
  } | ConvertTo-Json -Compress

  return Invoke-RestMethod `
    -Uri "$base/auth/v1/admin/users" `
    -Method Post `
    -Headers $adminHeaders `
    -ContentType 'application/json' `
    -Body $body `
    -ErrorAction Stop
}

function Get-TeacherToken {
  param([string]$Email, [string]$Password)

  $body = @{
    email = $Email
    password = $Password
  } | ConvertTo-Json -Compress

  $session = Invoke-RestMethod `
    -Uri "$base/auth/v1/token?grant_type=password" `
    -Method Post `
    -Headers $authHeaders `
    -ContentType 'application/json' `
    -Body $body `
    -ErrorAction Stop

  if (-not $session.access_token) {
    throw 'JWT guru tidak tersedia'
  }

  return [string]$session.access_token
}

function Invoke-Report {
  param(
    [string]$ClassId,
    [string]$Token,
    [int]$ExpectedStatus
  )

  $headers = @{ apikey = $anonKey }

  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $actual = 0
  $content = $null

  try {
    $response = Invoke-WebRequest `
      -Uri "$reportApi/$ClassId/report" `
      -Method Get `
      -Headers $headers `
      -UseBasicParsing `
      -ErrorAction Stop

    $actual = [int]$response.StatusCode
    $content = $response.Content
  }
  catch {
    if (-not $_.Exception.Response) {
      throw
    }

    $actual = [int]$_.Exception.Response.StatusCode
  }

  if ($actual -ne $ExpectedStatus) {
    throw "Report expected HTTP $ExpectedStatus, got $actual"
  }

  if ($ExpectedStatus -ne 200) {
    return $null
  }

  if (
    $content -match 'DO-NOT-EXPOSE-B08-ANSWER' -or
    $content -match 'access_code_hash' -or
    $content -match 'recovery_token_hash' -or
    $content -match '"private_spec"' -or
    $content -match '"answers"'
  ) {
    throw 'Private student data leaked'
  }

  $result = $content | ConvertFrom-Json

  if ($result.ok -ne $true -or -not $result.data) {
    throw 'Invalid teacher report response'
  }

  return $result.data
}

function New-ClassCode {
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return -join (1..8 | ForEach-Object {
    $alphabet[(Get-Random -Minimum 0 -Maximum $alphabet.Length)]
  })
}

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
$emailA = "b08-report-a-$suffix@example.test"
$emailB = "b08-report-b-$suffix@example.test"
$passwordA = "B08!A$suffix"
$passwordB = "B08!B$suffix"

$classA = [guid]::NewGuid().ToString()
$classB = [guid]::NewGuid().ToString()
$studentId = [guid]::NewGuid().ToString()
$attemptKey = [guid]::NewGuid().ToString()

$classCodeA = New-ClassCode
$classCodeB = New-ClassCode

$versionId = "QV-B08-REPORT-$($suffix.ToUpperInvariant())"

$createdUsers = @()
$classesCreated = $false

try {
  $userA = New-Teacher $emailA $passwordA
  $createdUsers += [string]$userA.id

  $userB = New-Teacher $emailB $passwordB
  $createdUsers += [string]$userB.id

  $tokenA = Get-TeacherToken $emailA $passwordA
  $tokenB = Get-TeacherToken $emailB $passwordB

  Write-Host 'B08_REPORT_REAL_TEACHER_JWTS_PASS'

  # Synthetic classes and one pending assessment.
  # No published quest needed for this internal report fixture.
  $setupSql = @"
BEGIN;

INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
) VALUES
(
  '$classA', '$($userA.id)',
  'B08 HTTP Report Class A', 7, '$classCodeA'
),
(
  '$classB', '$($userB.id)',
  'B08 HTTP Report Class B', 7, '$classCodeB'
);

INSERT INTO public.student_sessions (
  id, class_id, display_name,
  access_code_hash, recovery_token_hash
) VALUES (
  '$studentId', '$classA', 'B08 HTTP Student',
  md5('$studentId'::text) || md5('$classA'::text),
  md5('$classA'::text) || md5('$studentId'::text)
);

SELECT attempt_id
FROM public.b05_create_assessment_attempt(
  '$studentId'::uuid,
  '$versionId',
  '$attemptKey'::uuid,
  '[{"item_id":"ITEM-B08-HTTP","value":"DO-NOT-EXPOSE-B08-ANSWER"}]'::jsonb
);

COMMIT;
"@

  Invoke-LocalSql $setupSql
  $classesCreated = $true

  Write-Host 'B08_REPORT_HTTP_FIXTURE_CREATED'

  # Owner gets their own report.
  $reportA = Invoke-Report -ClassId $classA -Token $tokenA -ExpectedStatus 200

  if (
    $reportA.class_id -ne $classA -or
    [int]$reportA.summary.total_students -ne 1 -or
    [int]$reportA.summary.total_attempts -ne 1 -or
    [int]$reportA.summary.pending_scoring -ne 1 -or
    $reportA.students.Count -ne 1 -or
    $reportA.attempt_history.Count -ne 1
  ) {
    throw 'Owner report contains incorrect counts'
  }

  Write-Host 'B08_REPORT_OWNER_200_PASS'

  # No JWT.
  $null = Invoke-Report -ClassId $classA -Token '' -ExpectedStatus 401
  Write-Host 'B08_REPORT_MISSING_AUTH_401_PASS'

  # Another teacher cannot access class A.
  $null = Invoke-Report -ClassId $classA -Token $tokenB -ExpectedStatus 404
  Write-Host 'B08_REPORT_FOREIGN_TEACHER_404_PASS'

  # Invalid UUID.
  $null = Invoke-Report -ClassId 'invalid-id' -Token $tokenA -ExpectedStatus 422
  Write-Host 'B08_REPORT_INVALID_CLASS_422_PASS'

  # Teacher B's own class is empty.
  $reportB = Invoke-Report -ClassId $classB -Token $tokenB -ExpectedStatus 200

  if (
    [int]$reportB.summary.total_attempts -ne 0 -or
    [int]$reportB.summary.total_students -ne 0 -or
    $reportB.attempt_history.Count -ne 0
  ) {
    throw 'Cross-class data leaked'
  }

  Write-Host 'B08_REPORT_CLASS_ISOLATION_PASS'
  Write-Host 'B08_REPORT_NO_PRIVATE_DATA_PASS'
  Write-Host 'B08_TEACHER_REPORT_HTTP_ALL_PASS'
}
finally {
  if ($classesCreated) {
    try {
      Invoke-LocalSql "DELETE FROM public.classes WHERE id IN ('$classA', '$classB');"
      Write-Host 'B08_REPORT_TEST_CLASSES_CLEANED'
    }
    catch {
      Write-Warning "Cleanup kelas gagal: $($_.Exception.Message)"
    }
  }

  foreach ($userId in $createdUsers) {
    try {
      $null = Invoke-RestMethod `
        -Uri "$base/auth/v1/admin/users/$userId" `
        -Method Delete `
        -Headers $adminHeaders `
        -ErrorAction Stop
    }
    catch {
      Write-Warning "Cleanup guru gagal: $userId"
    }
  }

  Write-Host 'B08_REPORT_TEST_CLEANUP_FINISHED'
}
