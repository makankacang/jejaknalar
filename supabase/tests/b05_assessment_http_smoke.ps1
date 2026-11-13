
$ErrorActionPreference = 'Stop'

function Invoke-LocalSql {
  param([string]$Query)

  $rows = @(docker exec supabase_db_jejaknalar psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c $Query)

  if ($LASTEXITCODE -ne 0) {
    throw 'Perintah SQL lokal gagal'
  }

  return ($rows -join "`n").Trim()
}

function Assert-HttpStatus {
  param(
    [string]$Url,
    [string]$Body,
    [hashtable]$Headers,
    [int]$ExpectedStatus
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method Post -ContentType 'application/json' -Headers $Headers -Body $Body -UseBasicParsing -ErrorAction Stop
    $actual = [int]$response.StatusCode
  }
  catch {
    if ($null -eq $_.Exception.Response) {
      throw
    }

    $actual = [int]$_.Exception.Response.StatusCode
  }

  if ($actual -ne $ExpectedStatus) {
    throw "Expected HTTP $ExpectedStatus, received HTTP $actual"
  }
}

function Submit-Assessment {
  param(
    [string]$Url,
    [string]$AccessCode,
    [string]$Body
  )

  $response = Invoke-WebRequest -Uri $Url -Method Post -ContentType 'application/json' -Headers @{
    'X-Student-Access-Code' = $AccessCode
  } -Body $Body -UseBasicParsing -ErrorAction Stop

  if ([int]$response.StatusCode -ne 202) {
    throw "Expected HTTP 202, received HTTP $($response.StatusCode)"
  }

  $result = $response.Content | ConvertFrom-Json

  if (
    $result.ok -ne $true -or
    -not $result.data.attempt_id -or
    $result.data.status -ne 'pending_scoring' -or
    $null -eq $result.data.replayed
  ) {
    throw 'Assessment response does not match provisional contract'
  }

  foreach ($field in @('score', 'feedback', 'next_path')) {
    if ($result.data.PSObject.Properties.Name -contains $field) {
      throw "Unapproved assessment field returned: $field"
    }
  }

  return $result.data
}

$teacherId = [guid]::NewGuid().ToString()
$classId = [guid]::NewGuid().ToString()
$idempotencyKey = [guid]::NewGuid().ToString()

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
$submitUrl = "$baseUrl/assessments/submit"

$fixtureCreated = $false

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
  'b05-assessment-http-$teacherId@example.invalid',
  now(),
  now()
);
INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
)
VALUES (
  '$classId', '$teacherId',
  'B05 Assessment HTTP Test', 7, '$classCode'
);

-- B06 compatibility: create an approved and published quest.
INSERT INTO public.quest_review_drafts (
  class_id, quest_id, quest_version_id,
  submitted_by, public_payload
)
VALUES (
  '$classId',
  'QUEST-B05-ASSESSMENT-TEST',
  'QV-DEMO-001',
  '$teacherId',
  jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', 'QUEST-B05-ASSESSMENT-TEST',
    'quest_version_id', 'QV-DEMO-001',
    'objective_ids', jsonb_build_array('LO-B05-TEST'),
    'template', 'evidence_hunt',
    'scene_id', 'school_library',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'read-01',
        'type', 'read_document',
        'ref', 'DOC-001'
      ),
      jsonb_build_object(
        'id', 'evidence-01',
        'type', 'select_evidence',
        'item_id', 'ITEM-001'
      )
    ),
    'variants', jsonb_build_object(
      'needs_support', 'QVAR-S',
      'developing', 'QVAR-D',
      'ready_for_extension', 'QVAR-E'
    )
  )
);

UPDATE public.quest_review_drafts
SET status = 'approved',
    approved_by = '$teacherId'
WHERE class_id = '$classId'
  AND quest_version_id = 'QV-DEMO-001';

INSERT INTO public.published_quest_versions (
  class_id, quest_id, quest_version_id,
  approved_by, public_payload
)
SELECT
  class_id, quest_id, quest_version_id,
  approved_by, public_payload
FROM public.quest_review_drafts
WHERE class_id = '$classId'
  AND quest_version_id = 'QV-DEMO-001'
  AND status = 'approved';

COMMIT;
"@

  Invoke-LocalSql $setupSql | Out-Null
  $fixtureCreated = $true

  # Register student A and student B independently.
  $joinBodyA = @{
    class_code = $classCode
    display_name = 'B05 Assessment Student A'
  } | ConvertTo-Json -Compress

  $joinBodyB = @{
    class_code = $classCode
    display_name = 'B05 Assessment Student B'
  } | ConvertTo-Json -Compress

  $studentA = (Invoke-WebRequest -Uri $joinUrl -Method Post -ContentType 'application/json' -Body $joinBodyA -UseBasicParsing -ErrorAction Stop).Content | ConvertFrom-Json
  $studentB = (Invoke-WebRequest -Uri $joinUrl -Method Post -ContentType 'application/json' -Body $joinBodyB -UseBasicParsing -ErrorAction Stop).Content | ConvertFrom-Json

  if (
    $studentA.ok -ne $true -or
    $studentB.ok -ne $true -or
    $studentA.data.student_session_id -eq $studentB.data.student_session_id
  ) {
    throw 'Synthetic student registration failed'
  }

  $codeA = [string]$studentA.data.access_code
  $codeB = [string]$studentB.data.access_code
  $sessionA = [string]$studentA.data.student_session_id
  $sessionB = [string]$studentB.data.student_session_id

  Write-Host 'B05_ASSESSMENT_STUDENTS_READY'

  # Valid assessment payload.
  $body = @{
    quest_version_id = 'QV-DEMO-001'
    idempotency_key = $idempotencyKey
    answers = @(
      @{
        item_id = 'ITEM-001'
        value = 'Bukti dari teks'
      }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  # Test 1: First submission creates a pending attempt.
  $first = Submit-Assessment -Url $submitUrl -AccessCode $codeA -Body $body

  if ($first.replayed -ne $false) {
    throw 'First assessment submission was incorrectly marked as replayed'
  }

  Write-Host 'B05_ASSESSMENT_HTTP_202_PASS'

  # Test 2: Identical request returns the same attempt.
  $second = Submit-Assessment -Url $submitUrl -AccessCode $codeA -Body $body

  if (
    $second.attempt_id -ne $first.attempt_id -or
    $second.replayed -ne $true
  ) {
    throw 'HTTP idempotency replay failed'
  }

  Write-Host 'B05_ASSESSMENT_HTTP_IDEMPOTENCY_PASS'

  # Test 3: Same key, changed answer => HTTP 409.
  $changedBody = @{
    quest_version_id = 'QV-DEMO-001'
    idempotency_key = $idempotencyKey
    answers = @(
      @{
        item_id = 'ITEM-001'
        value = 'Jawaban yang berbeda'
      }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  Assert-HttpStatus -Url $submitUrl -Body $changedBody -Headers @{
    'X-Student-Access-Code' = $codeA
  } -ExpectedStatus 409

  Write-Host 'B05_ASSESSMENT_HTTP_CONFLICT_409_PASS'

  # Test 4: Different student can use the same key independently.
  $other = Submit-Assessment -Url $submitUrl -AccessCode $codeB -Body $body

  if (
    $other.attempt_id -eq $first.attempt_id -or
    $other.replayed -ne $false
  ) {
    throw 'Assessment attempts are not isolated by student'
  }

  $attemptA = [string]$first.attempt_id
  $attemptB = [string]$other.attempt_id

  $isolatedRows = Invoke-LocalSql "SELECT count(*) FROM public.assessment_attempts WHERE (id = '$attemptA' AND student_session_id = '$sessionA') OR (id = '$attemptB' AND student_session_id = '$sessionB');"

  if ([int]$isolatedRows -ne 2) {
    throw 'Assessment ownership in database does not match authenticated students'
  }

  Write-Host 'B05_ASSESSMENT_HTTP_STUDENT_ISOLATION_PASS'

  # Test 5: Invalid answer structure => HTTP 422.
  $invalidBody = @{
    quest_version_id = 'QV-DEMO-001'
    idempotency_key = [guid]::NewGuid().ToString()
    answers = @(
      @{ item_id = 'ITEM-001'; value = 'A' },
      @{ item_id = 'ITEM-001'; value = 'B' }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  Assert-HttpStatus -Url $submitUrl -Body $invalidBody -Headers @{
    'X-Student-Access-Code' = $codeA
  } -ExpectedStatus 422

  Write-Host 'B05_ASSESSMENT_HTTP_VALIDATION_422_PASS'

  # Test 6: Missing access code => HTTP 401.
  Assert-HttpStatus -Url $submitUrl -Body $body -Headers @{} -ExpectedStatus 401

  Write-Host 'B05_ASSESSMENT_HTTP_MISSING_AUTH_401_PASS'

  # Test 7: Revoked student may not submit.
  $revoked = Invoke-LocalSql "UPDATE public.student_sessions SET revoked_at = now() WHERE id = '$sessionA' RETURNING id;"

  if ($revoked -ne $sessionA) {
    throw 'Failed to revoke synthetic student session'
  }

  Assert-HttpStatus -Url $submitUrl -Body $body -Headers @{
    'X-Student-Access-Code' = $codeA
  } -ExpectedStatus 401

  Write-Host 'B05_ASSESSMENT_HTTP_REVOKED_401_PASS'
  Write-Host 'B05_ASSESSMENT_HTTP_ALL_PASS'
}
finally {
  if ($fixtureCreated) {
    # Deleting the class cascades to sessions and assessments.
    $cleanupSql = @"
    BEGIN;

    -- Local test cleanup: temporarily disable immutable guards.
    ALTER TABLE public.published_quest_versions
      DISABLE TRIGGER b06_guard_published_quest_trigger;

    DELETE FROM public.published_quest_versions
    WHERE class_id = '$classId';

    ALTER TABLE public.published_quest_versions
      ENABLE TRIGGER b06_guard_published_quest_trigger;

    ALTER TABLE public.quest_review_drafts
      DISABLE TRIGGER b06_guard_quest_review_draft_trigger;

    DELETE FROM public.quest_review_drafts
    WHERE class_id = '$classId';

    ALTER TABLE public.quest_review_drafts
      ENABLE TRIGGER b06_guard_quest_review_draft_trigger;

    DELETE FROM public.classes WHERE id = '$classId';
    DELETE FROM auth.users WHERE id = '$teacherId';

    COMMIT;
"@

    Invoke-LocalSql $cleanupSql | Out-Null

    Write-Host 'B05_ASSESSMENT_SYNTHETIC_DATA_CLEANED'
  }
}
