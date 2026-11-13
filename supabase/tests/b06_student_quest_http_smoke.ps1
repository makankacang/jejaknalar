
$ErrorActionPreference = 'Stop'

$base = 'http://127.0.0.1:54321/functions/v1/student-api'
$db = 'supabase_db_jejaknalar'

function Invoke-LocalSql {
  param([string]$Query)

  $result = @($Query | docker exec -i $db psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres)

  if ($LASTEXITCODE -ne 0) {
    throw "SQL lokal gagal: $($result -join ' ')"
  }

  return ($result -join "`n").Trim()
}

function New-ClassCode {
  $code = [guid]::NewGuid().ToString('N').Substring(0, 8).ToUpperInvariant()
  return $code.Replace('0', '2').Replace('1', '3')
}

function Join-TestStudent {
  param(
    [string]$ClassId,
    [string]$ClassCode,
    [string]$DisplayName
  )

  $body = @{
    class_code = $ClassCode
    display_name = $DisplayName
  } | ConvertTo-Json -Compress

  $response = Invoke-WebRequest `
    -Uri "$base/classes/$ClassId/join" `
    -Method Post `
    -ContentType 'application/json' `
    -Body $body `
    -UseBasicParsing `
    -ErrorAction Stop

  if ([int]$response.StatusCode -ne 201) {
    throw 'Join siswa tidak menghasilkan HTTP 201'
  }

  $joined = $response.Content | ConvertFrom-Json
  $accessCode = [string]$joined.data.access_code

  if ([string]::IsNullOrWhiteSpace($accessCode)) {
    throw 'Access code tidak ditemukan'
  }

  return $accessCode
}

function Assert-QuestGet {
  param(
    [string]$VersionId,
    [string]$AccessCode,
    [int]$ExpectedStatus,
    [string]$Label
  )

  $headers = @{}
  if ($AccessCode) {
    $headers['X-Student-Access-Code'] = $AccessCode
  }

  $response = $null
  $actualStatus = 0

  try {
    $response = Invoke-WebRequest `
      -Uri "$base/student/quests/$VersionId" `
      -Method Get `
      -Headers $headers `
      -UseBasicParsing `
      -ErrorAction Stop

    $actualStatus = [int]$response.StatusCode
  }
  catch {
    if ($null -eq $_.Exception.Response) {
      throw
    }

    $actualStatus = [int]$_.Exception.Response.StatusCode
  }

  if ($actualStatus -ne $ExpectedStatus) {
    throw "${Label}: expected HTTP $ExpectedStatus, got $actualStatus"
  }

  if ($ExpectedStatus -eq 200) {
    $json = $response.Content | ConvertFrom-Json

    if (
      -not $json.ok -or
      [string]$json.data.quest_version_id -ne $VersionId
    ) {
      throw "${Label}: response quest tidak sesuai"
    }

    if ($response.Content -match '"answer_key"|"rubric"|"expected"') {
      throw "${Label}: kemungkinan data privat bocor"
    }
  }

  Write-Host "${Label}_PASS"
}

$teacherA = [guid]::NewGuid().ToString()
$teacherB = [guid]::NewGuid().ToString()
$classA = [guid]::NewGuid().ToString()
$classB = [guid]::NewGuid().ToString()

$codeA = New-ClassCode
$codeB = New-ClassCode

if ($codeA -eq $codeB) {
  throw 'Kode kelas sintetis bertabrakan'
}

$versionA = 'QV-B06-' + [guid]::NewGuid().ToString('N').ToUpperInvariant()
$versionB = 'QV-B06-' + [guid]::NewGuid().ToString('N').ToUpperInvariant()

function New-TestQuest {
  param(
    [string]$VersionId,
    [string]$QuestId
  )

  return @{
    schema_version = '1.0'
    quest_id = $QuestId
    quest_version_id = $VersionId
    objective_ids = @('LO-B06-TEST')
    template = 'evidence_hunt'
    scene_id = 'school_library'
    steps = @(
    @{
        id = 'read-01'
        type = 'read_document'
        ref = 'DOC-001'
    },
    @{
        id = 'evidence-01'
        type = 'select_evidence'
        item_id = 'ITEM-B06-001'
    }
    )
    variants = @{
      needs_support = 'QVAR-S'
      developing = 'QVAR-D'
      ready_for_extension = 'QVAR-E'
    }
  } | ConvertTo-Json -Depth 10 -Compress
}

$payloadA = (New-TestQuest $versionA 'QUEST-B06-A').Replace("'", "''")
$payloadB = (New-TestQuest $versionB 'QUEST-B06-B').Replace("'", "''")

$setupComplete = $false

try {
  $setupSql = @"
BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000',
   '$teacherA', 'authenticated', 'authenticated',
   'b06-a-$teacherA@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '$teacherB', 'authenticated', 'authenticated',
   'b06-b-$teacherB@example.test', '', now(), now(), now());

INSERT INTO public.classes (
  id, teacher_uid, name, grade, class_code
)
VALUES
  ('$classA', '$teacherA', 'B06 Quest Test A', 7, '$codeA'),
  ('$classB', '$teacherB', 'B06 Quest Test B', 7, '$codeB');

    -- Create pending drafts for both classes.
    INSERT INTO public.quest_review_drafts (
    class_id, quest_id, quest_version_id,
    submitted_by, public_payload
    )
    VALUES
    ('$classA', 'QUEST-B06-A', '$versionA',
    '$teacherA', '$payloadA'::jsonb),
    ('$classB', 'QUEST-B06-B', '$versionB',
    '$teacherB', '$payloadB'::jsonb);

    -- Each owning teacher approves their own unchanged draft.
    UPDATE public.quest_review_drafts
    SET status = 'approved',
        approved_by = submitted_by
    WHERE quest_version_id IN ('$versionA', '$versionB');

INSERT INTO public.published_quest_versions (
  class_id, quest_id, quest_version_id,
  approved_by, public_payload
)
VALUES
  ('$classA', 'QUEST-B06-A', '$versionA',
   '$teacherA', '$payloadA'::jsonb),
  ('$classB', 'QUEST-B06-B', '$versionB',
   '$teacherB', '$payloadB'::jsonb);

COMMIT;
"@

  Invoke-LocalSql $setupSql | Out-Null
  $setupComplete = $true

  Write-Host 'B06_SYNTHETIC_FIXTURES_CREATED'

    # B06: Assessment must reference a published quest and valid item.
  $studentA = Join-TestStudent $classA $codeA 'B06 Student A'
  $studentB = Join-TestStudent $classB $codeB 'B06 Student B'

  Write-Host 'B06_TWO_STUDENT_JOINS_PASS'

  Assert-QuestGet $versionA $studentA 200 'B06_CLASS_A_OWN_200'
  Assert-QuestGet $versionB $studentB 200 'B06_CLASS_B_OWN_200'
  Assert-QuestGet $versionB $studentA 404 'B06_CLASS_A_OTHER_404'
  Assert-QuestGet $versionA $studentB 404 'B06_CLASS_B_OTHER_404'
  Assert-QuestGet $versionA '' 401 'B06_MISSING_ACCESS_401'

  Write-Host 'B06_QUEST_CLASS_ISOLATION_PASS'

  $cases = @(
    @{ Version = $versionA; Access = $studentA; Item = 'ITEM-B06-001'; Status = 202; Label = 'B06_ASSESSMENT_OWN_202' },
    @{ Version = $versionB; Access = $studentB; Item = 'ITEM-B06-001'; Status = 202; Label = 'B06_ASSESSMENT_CLASS_B_202' },
    @{ Version = $versionB; Access = $studentA; Item = 'ITEM-B06-001'; Status = 404; Label = 'B06_ASSESSMENT_CROSS_CLASS_404' },
    @{ Version = $versionA; Access = $studentA; Item = 'ITEM-FAKE'; Status = 422; Label = 'B06_ASSESSMENT_FAKE_ITEM_422' }
    )

    foreach ($case in $cases) {
    $body = @{
        quest_version_id = $case.Version
        idempotency_key = [guid]::NewGuid().ToString()
        answers = @(
        @{ item_id = $case.Item; value = 'Bukti percobaan' }
        )
    } | ConvertTo-Json -Depth 8 -Compress

    $actual = 0
    $response = $null

    try {
        $response = Invoke-WebRequest `
        -Uri "$base/assessments/submit" `
        -Method Post `
        -Headers @{ 'X-Student-Access-Code' = $case.Access } `
        -ContentType 'application/json' `
        -Body $body `
        -UseBasicParsing `
        -ErrorAction Stop

        $actual = [int]$response.StatusCode
    }
    catch {
        if ($null -eq $_.Exception.Response) { throw }
        $actual = [int]$_.Exception.Response.StatusCode
    }

    if ($actual -ne $case.Status) {
        throw "$($case.Label): expected HTTP $($case.Status), got $actual"
    }

    if ($actual -eq 202) {
        $result = $response.Content | ConvertFrom-Json
        if (-not $result.ok -or $result.data.status -ne 'pending_scoring') {
        throw "$($case.Label): respons assessment tidak sesuai"
        }
    }

    Write-Host "$($case.Label)_PASS"
    }

    Write-Host 'B06_ASSESSMENT_QUEST_BINDING_HTTP_PASS'
}
finally {
  if ($setupComplete) {
    # Local test cleanup only. The immutable trigger is disabled
    # inside one transaction and restored before commit.
    $cleanupSql = @"
BEGIN;

ALTER TABLE public.published_quest_versions
  DISABLE TRIGGER b06_guard_published_quest_trigger;

DELETE FROM public.published_quest_versions
WHERE quest_version_id IN ('$versionA', '$versionB');

ALTER TABLE public.published_quest_versions
  ENABLE TRIGGER b06_guard_published_quest_trigger;

ALTER TABLE public.quest_review_drafts
  DISABLE TRIGGER b06_guard_quest_review_draft_trigger;

DELETE FROM public.quest_review_drafts
WHERE quest_version_id IN ('$versionA', '$versionB');

ALTER TABLE public.quest_review_drafts
  ENABLE TRIGGER b06_guard_quest_review_draft_trigger;

DELETE FROM public.classes
WHERE id IN ('$classA', '$classB');

DELETE FROM auth.users
WHERE id IN ('$teacherA', '$teacherB');

COMMIT;
"@

    Invoke-LocalSql $cleanupSql | Out-Null
    Write-Host 'B06_SYNTHETIC_DATA_CLEANED'
  }
}
