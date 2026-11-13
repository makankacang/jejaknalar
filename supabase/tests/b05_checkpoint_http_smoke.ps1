
$ErrorActionPreference = 'Stop'

function Invoke-LocalSql {
  param([string]$Query)

  $rows = @(docker exec supabase_db_jejaknalar psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c $Query)
  if ($LASTEXITCODE -ne 0) {
    throw 'Perintah SQL lokal gagal'
  }

  return ($rows -join "`n").Trim()
}

function Invoke-Http {
  param(
    [ValidateSet('GET', 'POST', 'PUT')]
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [string]$Body = ''
  )

  $parameters = @{
    Uri = $Url
    Method = $Method
    Headers = $Headers
    UseBasicParsing = $true
    ErrorAction = 'Stop'
  }

  if ($Method -ne 'GET') {
    $parameters.ContentType = 'application/json'
    $parameters.Body = $Body
  }

  try {
    $response = Invoke-WebRequest @parameters
    return @{
      Status = [int]$response.StatusCode
      Data = ($response.Content | ConvertFrom-Json)
    }
  }
  catch {
    if ($null -eq $_.Exception.Response) {
      throw
    }

    return @{
      Status = [int]$_.Exception.Response.StatusCode
      Data = $null
    }
  }
}

function Assert-Status {
  param($Response, [int]$Expected)

  if ($Response.Status -ne $Expected) {
    throw "Expected HTTP $Expected, received HTTP $($Response.Status)"
  }
}

$teacherId = [guid]::NewGuid().ToString()
$classId = [guid]::NewGuid().ToString()

$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
$bytes = New-Object byte[] 8
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

try {
  $rng.GetBytes($bytes)
}
finally {
  $rng.Dispose()
}

$classCode = -join ($bytes | ForEach-Object {
  $alphabet[[int]($_ -band 31)]
})

$baseUrl = 'http://127.0.0.1:54321/functions/v1/student-api'
$joinUrl = "$baseUrl/classes/$classId/join"
$checkpointUrl = "$baseUrl/checkpoints/QV-DEMO-001"

$fixtureCreated = $false

try {
  # Create synthetic teacher and class.
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
  'b05-checkpoint-http-$teacherId@example.invalid',
  now(),
  now()
);
INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
)
VALUES (
  '$classId', '$teacherId',
  'B05 Checkpoint HTTP Test', 7, '$classCode'
);
COMMIT;
"@

  Invoke-LocalSql $setupSql | Out-Null
  $fixtureCreated = $true

  # Register two independent students.
  $joinBodyA = @{
    class_code = $classCode
    display_name = 'Checkpoint HTTP Student A'
  } | ConvertTo-Json -Compress

  $joinBodyB = @{
    class_code = $classCode
    display_name = 'Checkpoint HTTP Student B'
  } | ConvertTo-Json -Compress

  $joinA = Invoke-Http -Method POST -Url $joinUrl -Body $joinBodyA
  $joinB = Invoke-Http -Method POST -Url $joinUrl -Body $joinBodyB

  Assert-Status $joinA 201
  Assert-Status $joinB 201

  $codeA = [string]$joinA.Data.data.access_code
  $codeB = [string]$joinB.Data.data.access_code
  $sessionA = [string]$joinA.Data.data.student_session_id
  $sessionB = [string]$joinB.Data.data.student_session_id

  if (
    -not $codeA -or -not $codeB -or
    -not $sessionA -or -not $sessionB -or
    $sessionA -eq $sessionB
  ) {
    throw 'Gagal membuat dua sesi siswa terpisah'
  }

  $headersA = @{ 'X-Student-Access-Code' = $codeA }
  $headersB = @{ 'X-Student-Access-Code' = $codeB }

  Write-Host 'B05_CHECKPOINT_STUDENTS_READY'

  # 1. A new student does not have a checkpoint yet.
  $empty = Invoke-Http -Method GET -Url $checkpointUrl -Headers $headersA
  Assert-Status $empty 200

  if ($empty.Data.ok -ne $true -or $null -ne $empty.Data.data.checkpoint) {
    throw 'Checkpoint awal seharusnya null'
  }

  Write-Host 'B05_CHECKPOINT_EMPTY_GET_PASS'

  # 2. Initial save: expected_revision 0 -> revision 1.
  $body1 = @{
    expected_revision = 0
    progress = @{
      state = 'EXPLORING'
      step = 1
    }
  } | ConvertTo-Json -Depth 8 -Compress

  $created = Invoke-Http -Method PUT -Url $checkpointUrl -Headers $headersA -Body $body1
  Assert-Status $created 200

  $checkpointA = $created.Data.data.checkpoint

  if (
    -not $checkpointA.checkpoint_id -or
    $checkpointA.revision -ne 1 -or
    $checkpointA.progress.state -ne 'EXPLORING' -or
    $checkpointA.progress.step -ne 1
  ) {
    throw 'Checkpoint revision 1 tidak sesuai'
  }

  Write-Host 'B05_CHECKPOINT_HTTP_CREATE_REVISION_1_PASS'

  # 3. GET must restore the saved progress.
  $restored = Invoke-Http -Method GET -Url $checkpointUrl -Headers $headersA
  Assert-Status $restored 200

  if (
    $restored.Data.data.checkpoint.checkpoint_id -ne $checkpointA.checkpoint_id -or
    $restored.Data.data.checkpoint.revision -ne 1 -or
    $restored.Data.data.checkpoint.progress.state -ne 'EXPLORING'
  ) {
    throw 'Checkpoint tidak berhasil dipulihkan'
  }

  Write-Host 'B05_CHECKPOINT_HTTP_RESUME_PASS'

  # 4. Correct update: expected_revision 1 -> revision 2.
  $body2 = @{
    expected_revision = 1
    progress = @{
      state = 'CHALLENGE'
      step = 2
    }
  } | ConvertTo-Json -Depth 8 -Compress

  $updated = Invoke-Http -Method PUT -Url $checkpointUrl -Headers $headersA -Body $body2
  Assert-Status $updated 200

  if (
    $updated.Data.data.checkpoint.checkpoint_id -ne $checkpointA.checkpoint_id -or
    $updated.Data.data.checkpoint.revision -ne 2 -or
    $updated.Data.data.checkpoint.progress.state -ne 'CHALLENGE'
  ) {
    throw 'Checkpoint revision 2 tidak sesuai'
  }

  Write-Host 'B05_CHECKPOINT_HTTP_UPDATE_REVISION_2_PASS'

  # 5. Reusing old revision 1 must return HTTP 409.
  $staleBody = @{
    expected_revision = 1
    progress = @{
      state = 'OLD_PROGRESS'
      step = 99
    }
  } | ConvertTo-Json -Depth 8 -Compress

  $stale = Invoke-Http -Method PUT -Url $checkpointUrl -Headers $headersA -Body $staleBody
  Assert-Status $stale 409

  $afterConflict = Invoke-Http -Method GET -Url $checkpointUrl -Headers $headersA
  Assert-Status $afterConflict 200

  if (
    $afterConflict.Data.data.checkpoint.revision -ne 2 -or
    $afterConflict.Data.data.checkpoint.progress.state -ne 'CHALLENGE'
  ) {
    throw 'Request stale telah menimpa progres terbaru'
  }

  Write-Host 'B05_CHECKPOINT_HTTP_STALE_409_PASS'

  # 6. Student B must not see student A's progress.
  $emptyB = Invoke-Http -Method GET -Url $checkpointUrl -Headers $headersB
  Assert-Status $emptyB 200

  if ($null -ne $emptyB.Data.data.checkpoint) {
    throw 'Student B dapat membaca checkpoint Student A'
  }

  $bodyB = @{
    expected_revision = 0
    progress = @{
      state = 'READY'
      step = 0
    }
  } | ConvertTo-Json -Depth 8 -Compress

  $createdB = Invoke-Http -Method PUT -Url $checkpointUrl -Headers $headersB -Body $bodyB
  Assert-Status $createdB 200

  if (
    $createdB.Data.data.checkpoint.revision -ne 1 -or
    $createdB.Data.data.checkpoint.checkpoint_id -eq $checkpointA.checkpoint_id
  ) {
    throw 'Checkpoint antarsiswa tidak terisolasi'
  }

  $rowCount = Invoke-LocalSql "SELECT count(*) FROM public.student_checkpoints WHERE student_session_id IN ('$sessionA', '$sessionB') AND quest_version_id = 'QV-DEMO-001';"

  if ([int]$rowCount -ne 2) {
    throw 'Jumlah checkpoint pada database tidak sesuai'
  }

  Write-Host 'B05_CHECKPOINT_HTTP_STUDENT_ISOLATION_PASS'

  # 7. Invalid revision must return HTTP 422.
  $invalidBody = @{
    expected_revision = -1
    progress = @{ state = 'INVALID' }
  } | ConvertTo-Json -Depth 8 -Compress

  $invalid = Invoke-Http -Method PUT -Url $checkpointUrl -Headers $headersA -Body $invalidBody
  Assert-Status $invalid 422

  Write-Host 'B05_CHECKPOINT_HTTP_VALIDATION_422_PASS'

  # 8. Missing authentication must return HTTP 401.
  $missingAuthGet = Invoke-Http -Method GET -Url $checkpointUrl
  $missingAuthPut = Invoke-Http -Method PUT -Url $checkpointUrl -Body $body2

  Assert-Status $missingAuthGet 401
  Assert-Status $missingAuthPut 401

  Write-Host 'B05_CHECKPOINT_HTTP_MISSING_AUTH_401_PASS'

  # 9. Revoked student cannot read or write checkpoints.
  $revoked = Invoke-LocalSql "UPDATE public.student_sessions SET revoked_at = now() WHERE id = '$sessionA' RETURNING id;"

  if ($revoked -ne $sessionA) {
    throw 'Gagal mencabut sesi sintetis'
  }

  $revokedGet = Invoke-Http -Method GET -Url $checkpointUrl -Headers $headersA
  $revokedPut = Invoke-Http -Method PUT -Url $checkpointUrl -Headers $headersA -Body $body2

  Assert-Status $revokedGet 401
  Assert-Status $revokedPut 401

  # Revoking A must not affect student B.
  $stillValidB = Invoke-Http -Method GET -Url $checkpointUrl -Headers $headersB
  Assert-Status $stillValidB 200

  if ($stillValidB.Data.data.checkpoint.revision -ne 1) {
    throw 'Sesi Student B terdampak pencabutan Student A'
  }

  Write-Host 'B05_CHECKPOINT_HTTP_REVOKED_SESSION_401_PASS'
  Write-Host 'B05_CHECKPOINT_HTTP_ALL_PASS'
}
finally {
  if ($fixtureCreated) {
    # Deleting the class cascades to sessions and checkpoints.
    Invoke-LocalSql "BEGIN; DELETE FROM public.classes WHERE id = '$classId'; DELETE FROM auth.users WHERE id = '$teacherId'; COMMIT;" | Out-Null

    Write-Host 'B05_CHECKPOINT_SYNTHETIC_DATA_CLEANED'
  }
}
