
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

function Invoke-LocalSql {
  param([string]$Query)

  $rows = @(docker exec supabase_db_jejaknalar psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c $Query)

  if ($LASTEXITCODE -ne 0) {
    throw 'Perintah SQL lokal gagal'
  }

  return ($rows -join "`n").Trim()
}

function Invoke-ParallelJson {
  param(
    [ValidateSet('PUT', 'POST')]
    [string]$Method,
    [string]$Url,
    [string]$AccessCode,
    [string]$BodyA,
    [string]$BodyB
  )

  $http = [System.Net.Http.HttpClient]::new()
  $http.Timeout = [TimeSpan]::FromSeconds(30)

  $null = $http.DefaultRequestHeaders.TryAddWithoutValidation(
    'X-Student-Access-Code',
    $AccessCode
  )

  $contentA = [System.Net.Http.StringContent]::new(
    $BodyA, [System.Text.Encoding]::UTF8, 'application/json'
  )
  $contentB = [System.Net.Http.StringContent]::new(
    $BodyB, [System.Text.Encoding]::UTF8, 'application/json'
  )

  $responseA = $null
  $responseB = $null

  try {
    # Dispatch both requests before awaiting either response.
    if ($Method -eq 'PUT') {
      $taskA = $http.PutAsync($Url, $contentA)
      $taskB = $http.PutAsync($Url, $contentB)
    }
    else {
      $taskA = $http.PostAsync($Url, $contentA)
      $taskB = $http.PostAsync($Url, $contentB)
    }

    $responseA = $taskA.GetAwaiter().GetResult()
    $responseB = $taskB.GetAwaiter().GetResult()

    $textA = $responseA.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $textB = $responseB.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    return @(
      [pscustomobject]@{
        Status = [int]$responseA.StatusCode
        Data = ($textA | ConvertFrom-Json)
      },
      [pscustomobject]@{
        Status = [int]$responseB.StatusCode
        Data = ($textB | ConvertFrom-Json)
      }
    )
  }
  finally {
    if ($null -ne $responseA) { $responseA.Dispose() }
    if ($null -ne $responseB) { $responseB.Dispose() }
    $contentA.Dispose()
    $contentB.Dispose()
    $http.Dispose()
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
$assessmentUrl = "$baseUrl/assessments/submit"

$fixtureCreated = $false

try {
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
  'b05-concurrency-$teacherId@example.invalid',
  now(),
  now()
);
INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
)
VALUES (
  '$classId', '$teacherId',
  'B05 Concurrency HTTP Test', 7, '$classCode'
);
COMMIT;
"@

  Invoke-LocalSql $setupSql | Out-Null
  $fixtureCreated = $true

  $joinBody = @{
    class_code = $classCode
    display_name = 'B05 Concurrency Student'
  } | ConvertTo-Json -Compress

  $joinedResponse = Invoke-WebRequest -Uri $joinUrl -Method Post -ContentType 'application/json' -Body $joinBody -UseBasicParsing -ErrorAction Stop

  if ([int]$joinedResponse.StatusCode -ne 201) {
    throw 'Gagal membuat siswa sintetis'
  }

  $joined = $joinedResponse.Content | ConvertFrom-Json
  $accessCode = [string]$joined.data.access_code
  $sessionId = [string]$joined.data.student_session_id

  if (-not $accessCode -or -not $sessionId) {
    throw 'Respons join tidak lengkap'
  }

  Write-Host 'B05_CONCURRENCY_STUDENT_READY'

  # Checkpoint: two simultaneous initial writes, both revision 0.
  $createA = @{
    expected_revision = 0
    progress = @{ state = 'CREATE_A'; step = 1 }
  } | ConvertTo-Json -Depth 8 -Compress

  $createB = @{
    expected_revision = 0
    progress = @{ state = 'CREATE_B'; step = 1 }
  } | ConvertTo-Json -Depth 8 -Compress

  $initial = @(Invoke-ParallelJson -Method PUT -Url $checkpointUrl -AccessCode $accessCode -BodyA $createA -BodyB $createB)

  $created = @($initial | Where-Object { $_.Status -eq 200 })
  $conflicts = @($initial | Where-Object { $_.Status -eq 409 })

  if ($created.Count -ne 1 -or $conflicts.Count -ne 1) {
    throw "Concurrent checkpoint creation failed. HTTP statuses: $($initial.Status -join ',')"
  }

  $firstWinner = $created[0].Data.data.checkpoint.progress.state

  $stored = Invoke-LocalSql "SELECT json_build_object('revision',revision,'progress',progress)::text FROM public.student_checkpoints WHERE student_session_id = '$sessionId' AND quest_version_id = 'QV-DEMO-001';"
  $storedCheckpoint = $stored | ConvertFrom-Json

  if (
    $storedCheckpoint.revision -ne 1 -or
    $storedCheckpoint.progress.state -ne $firstWinner
  ) {
    throw 'Concurrent initial writes corrupted checkpoint state'
  }

  Write-Host 'B05_CHECKPOINT_CONCURRENT_CREATE_PASS'

  # Checkpoint: two simultaneous updates from revision 1.
  $updateA = @{
    expected_revision = 1
    progress = @{ state = 'UPDATE_A'; step = 2 }
  } | ConvertTo-Json -Depth 8 -Compress

  $updateB = @{
    expected_revision = 1
    progress = @{ state = 'UPDATE_B'; step = 2 }
  } | ConvertTo-Json -Depth 8 -Compress

  $updates = @(Invoke-ParallelJson -Method PUT -Url $checkpointUrl -AccessCode $accessCode -BodyA $updateA -BodyB $updateB)

  $updated = @($updates | Where-Object { $_.Status -eq 200 })
  $conflicts = @($updates | Where-Object { $_.Status -eq 409 })

  if ($updated.Count -ne 1 -or $conflicts.Count -ne 1) {
    throw "Concurrent checkpoint update failed. HTTP statuses: $($updates.Status -join ',')"
  }

  $secondWinner = $updated[0].Data.data.checkpoint.progress.state

  $stored = Invoke-LocalSql "SELECT json_build_object('revision',revision,'progress',progress)::text FROM public.student_checkpoints WHERE student_session_id = '$sessionId' AND quest_version_id = 'QV-DEMO-001';"
  $storedCheckpoint = $stored | ConvertFrom-Json

  if (
    $storedCheckpoint.revision -ne 2 -or
    $storedCheckpoint.progress.state -ne $secondWinner
  ) {
    throw 'Concurrent updates corrupted checkpoint state'
  }

  Write-Host 'B05_CHECKPOINT_CONCURRENT_UPDATE_PASS'

  # Assessment: two simultaneous identical submissions with one key.
  $assessmentKey = [guid]::NewGuid().ToString()

  $assessmentBody = @{
    quest_version_id = 'QV-DEMO-001'
    idempotency_key = $assessmentKey
    answers = @(
      @{ item_id = 'ITEM-001'; value = 'Bukti dari teks' }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  $assessments = @(Invoke-ParallelJson -Method POST -Url $assessmentUrl -AccessCode $accessCode -BodyA $assessmentBody -BodyB $assessmentBody)

  if (
    $assessments.Count -ne 2 -or
    @($assessments | Where-Object { $_.Status -ne 202 }).Count -ne 0
  ) {
    throw "Concurrent assessment submission failed. HTTP statuses: $($assessments.Status -join ',')"
  }

  $attemptA = $assessments[0].Data.data.attempt_id
  $attemptB = $assessments[1].Data.data.attempt_id

  if (
    -not $attemptA -or
    $attemptA -ne $attemptB -or
    @($assessments | Where-Object { $_.Data.data.replayed -eq $false }).Count -ne 1 -or
    @($assessments | Where-Object { $_.Data.data.replayed -eq $true }).Count -ne 1
  ) {
    throw 'Concurrent assessment idempotency failed'
  }

  $attemptCount = Invoke-LocalSql "SELECT count(*) FROM public.assessment_attempts WHERE student_session_id = '$sessionId' AND idempotency_key = '$assessmentKey';"

  if ([int]$attemptCount -ne 1) {
    throw 'Concurrent submissions created duplicate assessment attempts'
  }

  Write-Host 'B05_ASSESSMENT_CONCURRENT_IDEMPOTENCY_PASS'
  Write-Host 'B05_CONCURRENCY_HTTP_ALL_PASS'
}
finally {
  if ($fixtureCreated) {
    Invoke-LocalSql "BEGIN; DELETE FROM public.classes WHERE id = '$classId'; DELETE FROM auth.users WHERE id = '$teacherId'; COMMIT;" | Out-Null

    Write-Host 'B05_CONCURRENCY_SYNTHETIC_DATA_CLEANED'
  }
}
