$ErrorActionPreference = 'Stop'

$base = 'http://127.0.0.1:54321'
$questApi = "$base/functions/v1/api/quests"
$db = 'supabase_db_jejaknalar'

$envLines = @(cmd /c "npx supabase status -o env 2>NUL")
if ($LASTEXITCODE -ne 0) { throw 'Supabase lokal tidak tersedia' }

function Get-LocalKey {
  param([string]$Name)

  $line = $envLines |
    Where-Object { $_.StartsWith("$Name=") } |
    Select-Object -First 1

  if (-not $line) { throw "Kunci $Name tidak ditemukan" }

  return $line.Substring($Name.Length + 1).Trim('"').Trim("'")
}

$anonKey = Get-LocalKey 'ANON_KEY'
$serviceKey = Get-LocalKey 'SERVICE_ROLE_KEY'

$adminHeaders = @{
  apikey = $serviceKey
  Authorization = "Bearer $serviceKey"
}

$authHeaders = @{ apikey = $anonKey }

function Invoke-LocalSql {
  param([string]$Query)

  $null = $Query | docker exec -i $db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres

  if ($LASTEXITCODE -ne 0) {
    throw 'SQL lokal gagal'
  }
}

function Invoke-QuestTest {
  param(
    [string]$Path,
    [string]$Token,
    [object]$Payload,
    [int]$Expected,
    [string]$Label
  )

  $body = ConvertTo-Json -InputObject $Payload -Depth 15 -Compress

  $headers = @{
    apikey = $anonKey
    Authorization = "Bearer $Token"
  }

  $response = $null
  $actual = 0

  try {
    $response = Invoke-WebRequest `
      -Uri "$questApi$Path" `
      -Method Post `
      -Headers $headers `
      -ContentType 'application/json' `
      -Body $body `
      -UseBasicParsing `
      -ErrorAction Stop

    $actual = [int]$response.StatusCode
  }
  catch {
    if (-not $_.Exception.Response) { throw }
    $actual = [int]$_.Exception.Response.StatusCode
  }

  if ($actual -ne $Expected) {
    throw "${Label}: expected HTTP $Expected, got $actual"
  }

  Write-Host "${Label}_PASS"

  if ($response -and $response.Content) {
    return $response.Content | ConvertFrom-Json
  }

  return $null
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
    throw 'JWT guru tidak diterbitkan'
  }

  return [string]$session.access_token
}

$suffix = [guid]::NewGuid().ToString('N')
$emailA = "b06-a-$suffix@example.test"
$emailB = "b06-b-$suffix@example.test"
$passwordA = "B06!A$suffix"
$passwordB = "B06!B$suffix"

$classA = [guid]::NewGuid().ToString()
$classB = [guid]::NewGuid().ToString()

$codeA = [guid]::NewGuid().ToString('N').Substring(0,8).ToUpperInvariant().Replace('0','2').Replace('1','3')
$codeB = [guid]::NewGuid().ToString('N').Substring(0,8).ToUpperInvariant().Replace('0','2').Replace('1','3')

$questId = 'QUEST-B06-HTTP-' + $suffix.Substring(0,12).ToUpperInvariant()
$versionId = 'QV-B06-HTTP-' + $suffix.Substring(0,12).ToUpperInvariant()

$createdUsers = @()
$classesCreated = $false

try {
  $userA = New-Teacher $emailA $passwordA
  $createdUsers += [string]$userA.id

  $userB = New-Teacher $emailB $passwordB
  $createdUsers += [string]$userB.id

  $tokenA = Get-TeacherToken $emailA $passwordA
  $tokenB = Get-TeacherToken $emailB $passwordB

  Write-Host 'B06_TWO_REAL_TEACHER_JWTS_PASS'

  $setupSql = @"
BEGIN;
INSERT INTO public.classes (id, teacher_uid, name, grade, class_code)
VALUES
  ('$classA', '$($userA.id)', 'B06 Teacher Test A', 7, '$codeA'),
  ('$classB', '$($userB.id)', 'B06 Teacher Test B', 7, '$codeB');
COMMIT;
"@

  Invoke-LocalSql $setupSql
  $classesCreated = $true

  $quest = @{
    schema_version = '1.0'
    quest_id = $questId
    quest_version_id = $versionId
    objective_ids = @('LO-B06-TEST')
    template = 'evidence_hunt'
    scene_id = 'school_library'
    steps = @(
      @{ id = 'read-01'; type = 'read_document'; ref = 'DOC-001' },
      @{ id = 'evidence-01'; type = 'select_evidence'; item_id = 'ITEM-B06-001' }
    )
    variants = @{
      needs_support = 'QVAR-S'
      developing = 'QVAR-D'
      ready_for_extension = 'QVAR-E'
    }
  }

  $draftBody = @{ class_id = $classA; quest = $quest }
  $publishBody = @{ class_id = $classA; quest_version_id = $versionId }

  # Teacher B must not submit a draft for Teacher A's class.
  $null = Invoke-QuestTest '/drafts' $tokenB $draftBody 404 'B06_FOREIGN_DRAFT_DENIED_404'

  # Teacher A creates a pending draft.
  $created = Invoke-QuestTest '/drafts' $tokenA $draftBody 201 'B06_DRAFT_CREATED_201'

  $draftId = [string]$created.data.id
  if (-not $draftId -or $created.data.status -ne 'pending_review') {
    throw 'Draft tidak berstatus pending_review'
  }

  # An unapproved draft cannot be published.
  $null = Invoke-QuestTest '/publish' $tokenA $publishBody 404 'B06_PENDING_PUBLISH_DENIED_404'

  # Teacher B cannot approve Teacher A's draft.
  $null = Invoke-QuestTest "/drafts/$draftId/approve" $tokenB @{} 404 'B06_FOREIGN_APPROVAL_DENIED_404'

  # Teacher A approves it.
  $approved = Invoke-QuestTest "/drafts/$draftId/approve" $tokenA @{} 200 'B06_OWNER_APPROVAL_200'

  if ($approved.data.status -ne 'approved') {
    throw 'Status approval tidak valid'
  }

  # Repeated approval is rejected.
  $null = Invoke-QuestTest "/drafts/$draftId/approve" $tokenA @{} 409 'B06_DOUBLE_APPROVAL_DENIED_409'

  # Teacher B cannot publish Teacher A's quest.
  $null = Invoke-QuestTest '/publish' $tokenB $publishBody 404 'B06_FOREIGN_PUBLISH_DENIED_404'

  # Client cannot inject replacement quest content.
  $injected = @{
    class_id = $classA
    quest_version_id = $versionId
    quest = $quest
  }

  $null = Invoke-QuestTest '/publish' $tokenA $injected 422 'B06_PUBLISH_PAYLOAD_INJECTION_DENIED_422'

  # The owning teacher publishes the approved draft.
  $published = Invoke-QuestTest '/publish' $tokenA $publishBody 201 'B06_APPROVED_PUBLISH_201'

  if ($published.data.quest_version_id -ne $versionId) {
    throw 'Quest terbit tidak sesuai versi yang disetujui'
  }

  # Immutable version cannot be published twice.
  $null = Invoke-QuestTest '/publish' $tokenA $publishBody 409 'B06_DUPLICATE_PUBLISH_DENIED_409'

  Write-Host 'B06_TEACHER_QUEST_WORKFLOW_HTTP_PASS'
}
finally {
  if ($classesCreated) {
    try {
      $cleanupSql = @"
BEGIN;
ALTER TABLE public.published_quest_versions DISABLE TRIGGER b06_guard_published_quest_trigger;
DELETE FROM public.published_quest_versions WHERE class_id IN ('$classA', '$classB');
ALTER TABLE public.published_quest_versions ENABLE TRIGGER b06_guard_published_quest_trigger;

ALTER TABLE public.quest_review_drafts DISABLE TRIGGER b06_guard_quest_review_draft_trigger;
DELETE FROM public.quest_review_drafts WHERE class_id IN ('$classA', '$classB');
ALTER TABLE public.quest_review_drafts ENABLE TRIGGER b06_guard_quest_review_draft_trigger;

DELETE FROM public.classes WHERE id IN ('$classA', '$classB');
COMMIT;
"@
      Invoke-LocalSql $cleanupSql
      Write-Host 'B06_TEST_CLASSES_AND_QUESTS_CLEANED'
    }
    catch {
      Write-Warning "Cleanup database gagal: $($_.Exception.Message)"
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
      Write-Warning "Cleanup auth user gagal: $userId"
    }
  }

  Write-Host 'B06_TEST_CLEANUP_FINISHED'
}