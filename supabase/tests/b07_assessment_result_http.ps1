$ErrorActionPreference = 'Stop'

function Invoke-LocalSql {
  param([string]$Query)

  $rows = @($Query | docker exec -i supabase_db_jejaknalar psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres)

  if ($LASTEXITCODE -ne 0) {
    throw 'Local SQL failed'
  }

  return ($rows -join "`n").Trim()
}

function Read-AssessmentResult {
  param(
    [string]$AttemptId,
    [string]$AccessCode,
    [int]$ExpectedStatus
  )

  $headers = @{}

  if ($AccessCode) {
    $headers['X-Student-Access-Code'] = $AccessCode
  }

  $url = "$baseUrl/assessments/$AttemptId/result"
  $actual = 0
  $content = $null

  try {
    $response = Invoke-WebRequest -Uri $url -Method Get -Headers $headers -UseBasicParsing -ErrorAction Stop
    $actual = [int]$response.StatusCode
    $content = $response.Content
  }
  catch {
    if ($null -eq $_.Exception.Response) {
      throw
    }

    $actual = [int]$_.Exception.Response.StatusCode
  }

  if ($actual -ne $ExpectedStatus) {
    throw "GET $url expected HTTP $ExpectedStatus but received $actual"
  }

  if ($ExpectedStatus -ne 200) {
    return
  }

  $json = $content | ConvertFrom-Json

  if ($json.ok -ne $true -or $null -eq $json.data) {
    throw 'Invalid assessment result response'
  }

  $allowed = @(
    'attempt_id',
    'quest_version_id',
    'status',
    'score',
    'scored_at'
  )

  foreach ($field in $json.data.PSObject.Properties.Name) {
    if ($field -notin $allowed) {
      throw "Unexpected field in result response: $field"
    }
  }

  if ($content -match 'answer_key|private_spec|rubric_version_id|PRIVATE-B07-ANSWER') {
    throw 'Private rubric information leaked in HTTP response'
  }

  return $json.data
}

$teacherId = [guid]::NewGuid().ToString()
$classId = [guid]::NewGuid().ToString()
$suffix = ([guid]::NewGuid().ToString('N').Substring(0, 12)).ToUpperInvariant()

$questId = "QUEST-B07-HTTP-$suffix"
$questVersion = "QV-B07-HTTP-$suffix"

$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
$classCode = -join (1..8 | ForEach-Object {
  $alphabet[(Get-Random -Minimum 0 -Maximum $alphabet.Length)]
})

$baseUrl = 'http://127.0.0.1:54321/functions/v1/student-api'
$joinUrl = "$baseUrl/classes/$classId/join"
$submitUrl = "$baseUrl/assessments/submit"

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
  'b07-http-$teacherId@example.invalid',
  now(),
  now()
);

INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
)
VALUES (
  '$classId',
  '$teacherId',
  'B07 HTTP Result Test',
  7,
  '$classCode'
);

INSERT INTO public.quest_review_drafts (
  class_id, quest_id, quest_version_id,
  submitted_by, public_payload
)
VALUES (
  '$classId',
  '$questId',
  '$questVersion',
  '$teacherId',
  jsonb_build_object(
    'schema_version', '1.0',
    'quest_id', '$questId',
    'quest_version_id', '$questVersion',
    'objective_ids', jsonb_build_array('LO-B07-TEST'),
    'template', 'evidence_hunt',
    'scene_id', 'school_library',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'read-01',
        'type', 'read_document',
        'ref', 'DOC-B07-001'
      ),
      jsonb_build_object(
        'id', 'evidence-01',
        'type', 'select_evidence',
        'item_id', 'ITEM-B07-001'
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
WHERE quest_version_id = '$questVersion';

INSERT INTO public.published_quest_versions (
  class_id, quest_id, quest_version_id,
  approved_by, public_payload
)
SELECT
  class_id, quest_id, quest_version_id,
  approved_by, public_payload
FROM public.quest_review_drafts
WHERE quest_version_id = '$questVersion'
  AND status = 'approved';

INSERT INTO public.assessment_rubric_versions (
  quest_version_id, revision, registered_by, private_spec
)
VALUES (
  '$questVersion',
  1,
  '$teacherId',
  jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object(
        'item_id', 'ITEM-B07-001',
        'objective_id', 'LO-B07-TEST',
        'answer_key', 'PRIVATE-B07-ANSWER',
        'max_points', 4
      )
    )
  )
);

COMMIT;
"@

  Invoke-LocalSql $setupSql | Out-Null
  $fixtureCreated = $true

  $rubricId = Invoke-LocalSql "SELECT id FROM public.assessment_rubric_versions WHERE quest_version_id = '$questVersion';"

  if (-not $rubricId) {
    throw 'Synthetic rubric was not created'
  }

  $joinA = @{
    class_code = $classCode
    display_name = 'B07 HTTP Student A'
  } | ConvertTo-Json -Compress

  $joinB = @{
    class_code = $classCode
    display_name = 'B07 HTTP Student B'
  } | ConvertTo-Json -Compress

  $studentA = (Invoke-WebRequest -Uri $joinUrl -Method Post -ContentType 'application/json' -Body $joinA -UseBasicParsing -ErrorAction Stop).Content | ConvertFrom-Json
  $studentB = (Invoke-WebRequest -Uri $joinUrl -Method Post -ContentType 'application/json' -Body $joinB -UseBasicParsing -ErrorAction Stop).Content | ConvertFrom-Json

  if ($studentA.ok -ne $true -or $studentB.ok -ne $true) {
    throw 'Student registration failed'
  }

  $codeA = [string]$studentA.data.access_code
  $codeB = [string]$studentB.data.access_code

  Write-Host 'B07_HTTP_STUDENTS_READY'

  $idempotencyKey = [guid]::NewGuid().ToString()

  $body = @{
    quest_version_id = $questVersion
    idempotency_key = $idempotencyKey
    answers = @(
      @{
        item_id = 'ITEM-B07-001'
        value = 'Jawaban siswa sintetis'
      }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  $submissionResponse = Invoke-WebRequest -Uri $submitUrl -Method Post -ContentType 'application/json' -Headers @{
    'X-Student-Access-Code' = $codeA
  } -Body $body -UseBasicParsing -ErrorAction Stop

  if ([int]$submissionResponse.StatusCode -ne 202) {
    throw 'Initial submission did not return HTTP 202'
  }

  $submission = $submissionResponse.Content | ConvertFrom-Json
  $attemptA = [string]$submission.data.attempt_id

  if (-not $attemptA -or $submission.data.status -ne 'pending_scoring') {
    throw 'Initial submission returned invalid attempt data'
  }

  $pending = Read-AssessmentResult -AttemptId $attemptA -AccessCode $codeA -ExpectedStatus 200

  if (
    $pending.status -ne 'pending_scoring' -or
    $null -ne $pending.score -or
    $null -ne $pending.scored_at
  ) {
    throw 'Pending assessment result is incorrect'
  }

  Write-Host 'B07_RESULT_PENDING_200_PASS'

  Read-AssessmentResult -AttemptId $attemptA -AccessCode $codeB -ExpectedStatus 404
  Write-Host 'B07_RESULT_STUDENT_ISOLATION_404_PASS'

  Read-AssessmentResult -AttemptId $attemptA -AccessCode '' -ExpectedStatus 401
  Write-Host 'B07_RESULT_MISSING_AUTH_401_PASS'

  Read-AssessmentResult -AttemptId 'invalid-id' -AccessCode $codeA -ExpectedStatus 422
  Write-Host 'B07_RESULT_INVALID_ID_422_PASS'

  $finalizeSql = @"
SELECT status
FROM public.b07_finalize_assessment_score(
  '$attemptA'::uuid,
  '$rubricId'::uuid,
  'scored',
  75,
  '[{"objective_id":"LO-B07-TEST","score":75}]'::jsonb,
  '[{"item_id":"ITEM-B07-001","message":"Perlu penguatan"}]'::jsonb,
  '[{"item_id":"ITEM-B07-001","criterion":"C1","earned_points":3,"max_points":4}]'::jsonb,
  'b07-http-fixture-1'
);
"@

  $finalized = Invoke-LocalSql $finalizeSql

  if ($finalized -ne 'scored') {
    throw 'Scoring finalization failed'
  }

  $scored = Read-AssessmentResult -AttemptId $attemptA -AccessCode $codeA -ExpectedStatus 200

  if (
    $scored.status -ne 'scored' -or
    $scored.score -ne 75 -or
    -not $scored.scored_at -or
    $scored.quest_version_id -ne $questVersion
  ) {
    throw 'Scored assessment result is incorrect'
  }

  Write-Host 'B07_RESULT_SCORED_200_PASS'

  $replayResponse = Invoke-WebRequest -Uri $submitUrl -Method Post -ContentType 'application/json' -Headers @{
    'X-Student-Access-Code' = $codeA
  } -Body $body -UseBasicParsing -ErrorAction Stop

  $replay = $replayResponse.Content | ConvertFrom-Json

  if (
    [int]$replayResponse.StatusCode -ne 200 -or
    $replay.data.attempt_id -ne $attemptA -or
    $replay.data.status -ne 'scored' -or
    $replay.data.replayed -ne $true
  ) {
    throw 'Submission replay after scoring failed'
  }

  Write-Host 'B07_RESULT_SUBMISSION_REPLAY_200_PASS'

  $insufficientBody = @{
    quest_version_id = $questVersion
    idempotency_key = [guid]::NewGuid().ToString()
    answers = @(
      @{
        item_id = 'ITEM-B07-001'
        value = 'Bukti belum mencukupi'
      }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  $insufficientResponse = Invoke-WebRequest -Uri $submitUrl -Method Post -ContentType 'application/json' -Headers @{
    'X-Student-Access-Code' = $codeA
  } -Body $insufficientBody -UseBasicParsing -ErrorAction Stop

  $insufficientSubmission = $insufficientResponse.Content | ConvertFrom-Json
  $attemptB = [string]$insufficientSubmission.data.attempt_id

  if (-not $attemptB -or [int]$insufficientResponse.StatusCode -ne 202) {
    throw 'Insufficient evidence test submission failed'
  }

  $insufficientSql = @"
SELECT status
FROM public.b07_finalize_assessment_score(
  '$attemptB'::uuid,
  '$rubricId'::uuid,
  'insufficient_evidence',
  NULL,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'b07-http-fixture-1'
);
"@

  if ((Invoke-LocalSql $insufficientSql) -ne 'insufficient_evidence') {
    throw 'Insufficient evidence finalization failed'
  }

  $insufficient = Read-AssessmentResult -AttemptId $attemptB -AccessCode $codeA -ExpectedStatus 200

  if (
    $insufficient.status -ne 'insufficient_evidence' -or
    $null -ne $insufficient.score -or
    -not $insufficient.scored_at
  ) {
    throw 'Insufficient evidence result is incorrect'
  }

  Write-Host 'B07_RESULT_INSUFFICIENT_EVIDENCE_PASS'
  Write-Host 'B07_ASSESSMENT_RESULT_HTTP_ALL_PASS'
}
finally {
  if ($fixtureCreated) {
    $cleanupSql = @"
BEGIN;

ALTER TABLE public.assessment_scoring_results
  DISABLE TRIGGER b07_guard_scoring_result_trigger;

DELETE FROM public.assessment_scoring_results
WHERE attempt_id IN (
  SELECT a.id
  FROM public.assessment_attempts a
  JOIN public.student_sessions s
    ON s.id = a.student_session_id
  WHERE s.class_id = '$classId'
);

ALTER TABLE public.assessment_scoring_results
  ENABLE TRIGGER b07_guard_scoring_result_trigger;

ALTER TABLE public.assessment_rubric_versions
  DISABLE TRIGGER b07_guard_private_rubric_trigger;

DELETE FROM public.assessment_rubric_versions
WHERE quest_version_id = '$questVersion';

ALTER TABLE public.assessment_rubric_versions
  ENABLE TRIGGER b07_guard_private_rubric_trigger;

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
    Write-Host 'B07_HTTP_SYNTHETIC_DATA_CLEANED'
  }
}