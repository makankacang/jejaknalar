$ErrorActionPreference = 'Stop'

$base = 'http://127.0.0.1:54321'
$db = 'supabase_db_jejaknalar'
$createdUsers = @()
$moduleId = [guid]::NewGuid().ToString()
$fixtureCreated = $false

$envLines = @(cmd /c "npx supabase status -o env 2>NUL")
if ($LASTEXITCODE -ne 0) {
  throw 'LOCAL_SUPABASE_NOT_AVAILABLE'
}

function Get-LocalKey {
  param([string]$Name)

  $line = $envLines |
    Where-Object { $_.StartsWith("$Name=") } |
    Select-Object -First 1

  if (-not $line) {
    throw "MISSING_LOCAL_KEY_$Name"
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

function New-TestTeacher {
  param([string]$Label)

  $suffix = [guid]::NewGuid().ToString('N')
  $email = "b03-$Label-$suffix@example.test"
  $password = "B03-Test-$suffix!"

  $body = @{
    email = $email
    password = $password
    email_confirm = $true
  } | ConvertTo-Json -Compress

  $user = Invoke-RestMethod `
    -Uri "$base/auth/v1/admin/users" `
    -Method Post `
    -Headers $adminHeaders `
    -ContentType 'application/json' `
    -Body $body

  $script:createdUsers += [string]$user.id

  $session = Invoke-RestMethod `
    -Uri "$base/auth/v1/token?grant_type=password" `
    -Method Post `
    -Headers $authHeaders `
    -ContentType 'application/json' `
    -Body (@{
      email = $email
      password = $password
    } | ConvertTo-Json -Compress)

  if (-not $session.access_token) {
    throw 'TEACHER_JWT_MISSING'
  }

  return @{
    id = [string]$user.id
    token = [string]$session.access_token
  }
}

function Invoke-ExpectedPost {
  param(
    [string]$Uri,
    [string]$Body,
    [string]$Token,
    [int]$ExpectedStatus
  )

  $headers = @{ apikey = $anonKey }

  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $status = 0
  $content = $null

  try {
    $response = Invoke-WebRequest `
      -Uri $Uri `
      -Method Post `
      -Headers $headers `
      -ContentType 'application/json' `
      -Body $Body `
      -UseBasicParsing `
      -ErrorAction Stop

    $status = [int]$response.StatusCode
    $content = $response.Content
  }
  catch {
    if (-not $_.Exception.Response) {
      throw
    }

    $status = [int]$_.Exception.Response.StatusCode
  }

  if ($status -ne $ExpectedStatus) {
    throw "EXPECTED_HTTP_$ExpectedStatus`_GOT_$status"
  }

  if ($ExpectedStatus -eq 201) {
    if (-not $content) {
      throw 'SNAPSHOT_RESPONSE_EMPTY'
    }

    return $content | ConvertFrom-Json
  }
}

try {
  $owner = New-TestTeacher 'owner'
  $other = New-TestTeacher 'other'

  Write-Host 'B03_REAL_TEACHER_JWTS_PASS'

  $sql = @"
insert into public.modules (
  id, owner_uid, title, source_type
) values (
  '$moduleId'::uuid,
  '$($owner.id)'::uuid,
  'B03 HTTP Snapshot Fixture',
  'pdf'
);
"@

  $null = $sql |
    docker exec -i $db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres

  if ($LASTEXITCODE -ne 0) {
    throw 'SNAPSHOT_MODULE_FIXTURE_FAILED'
  }

  $fixtureCreated = $true
  Write-Host 'B03_SNAPSHOT_FIXTURE_CREATED'

  $document = @{
    documentId = 'DOC-B03-HTTP-TEST-001'
    filename = 'test.pdf'
    format = 'pdf'
    mimeType = 'application/pdf'
    sizeBytes = 1024
    extractedText = 'Sumber A mencantumkan penerbit yang dapat ditelusuri.'
    sourceMap = @(
      @{
        id = 'PDF-P-001'
        kind = 'page'
        page = 1
        text = 'Sumber A mencantumkan penerbit yang dapat ditelusuri.'
      }
    )
    metadata = @{
      pageCount = 1
    }
    warnings = @()
  }

  $validBody = @{
    document = $document
  } | ConvertTo-Json -Depth 12 -Compress

  $uri = "$base/functions/v1/api/modules/$moduleId/text-versions"

  Invoke-ExpectedPost `
    -Uri $uri `
    -Body $validBody `
    -Token '' `
    -ExpectedStatus 401

  Write-Host 'B03_SNAPSHOT_NO_AUTH_401_PASS'

  Invoke-ExpectedPost `
    -Uri $uri `
    -Body $validBody `
    -Token $other.token `
    -ExpectedStatus 404

  Write-Host 'B03_SNAPSHOT_FOREIGN_TEACHER_404_PASS'

  Invoke-ExpectedPost `
    -Uri $uri `
    -Body '{"document":{}}' `
    -Token $owner.token `
    -ExpectedStatus 422

  Write-Host 'B03_SNAPSHOT_INVALID_DOCUMENT_422_PASS'

  $first = Invoke-ExpectedPost `
    -Uri $uri `
    -Body $validBody `
    -Token $owner.token `
    -ExpectedStatus 201

  $uuidPattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

  if (
    -not $first.ok -or
    $first.data.module_id -ne $moduleId -or
    $first.data.text_version -notmatch $uuidPattern -or
    $first.data.version_no -ne 1
  ) {
    throw 'SNAPSHOT_FIRST_VERSION_INVALID'
  }

  Write-Host 'B03_SNAPSHOT_OWNER_201_PASS'

  $second = Invoke-ExpectedPost `
    -Uri $uri `
    -Body $validBody `
    -Token $owner.token `
    -ExpectedStatus 201

  if (
    $second.data.text_version -notmatch $uuidPattern -or
    $second.data.text_version -eq $first.data.text_version -or
    $second.data.version_no -ne 2
  ) {
    throw 'SNAPSHOT_VERSION_ALLOCATION_INVALID'
  }

  Write-Host 'B03_SNAPSHOT_BACKEND_VERSIONING_PASS'

  $checkSql = @"
select case when exists (
  select 1
  from public.module_text_versions
  where module_id = '$moduleId'::uuid
    and text_version = '$($first.data.text_version)'::uuid
    and version_no = 1
    and document_id = 'DOC-B03-HTTP-TEST-001'
    and source_map #>> '{0,id}' = 'PDF-P-001'
) then 'PASS' else 'FAIL' end;
"@

  $dbResult = docker exec $db psql `
    -X -A -t -v ON_ERROR_STOP=1 `
    -U postgres -d postgres -c $checkSql

  if (
    $LASTEXITCODE -ne 0 -or
    ($dbResult -join '').Trim() -ne 'PASS'
  ) {
    throw 'SNAPSHOT_DATABASE_PERSISTENCE_FAILED'
  }

  Write-Host 'B03_SNAPSHOT_DATABASE_PERSISTENCE_PASS'

  # B03 integration: persisted C-01 snapshot -> C-02 analysis job.
  $analyzeUri = "$base/functions/v1/api/modules/analyze"
  $analyzeBody = @{
    module_id = $moduleId
    text_version = [string]$first.data.text_version
  } | ConvertTo-Json -Compress

  $ownerHeaders = @{
    apikey = $anonKey
    Authorization = "Bearer $($owner.token)"
  }

  $enqueueResponse = Invoke-WebRequest `
    -Uri $analyzeUri `
    -Method Post `
    -Headers $ownerHeaders `
    -ContentType 'application/json' `
    -Body $analyzeBody `
    -UseBasicParsing `
    -ErrorAction Stop

  $enqueue = $enqueueResponse.Content | ConvertFrom-Json

  if (
    $enqueueResponse.StatusCode -ne 202 -or
    -not $enqueue.ok -or
    $enqueue.data.analysis_job_id -notmatch $uuidPattern -or
    $enqueue.data.status -notin @('queued', 'processing')
  ) {
    throw 'B03_ANALYZE_ENQUEUE_INVALID'
  }

  Write-Host 'B03_ANALYZE_ENQUEUE_202_PASS'

  $jobId = [string]$enqueue.data.analysis_job_id
  $jobUri = "$base/functions/v1/api/analysis-jobs/$jobId"

  $jobResponse = Invoke-WebRequest `
    -Uri $jobUri `
    -Method Get `
    -Headers $ownerHeaders `
    -UseBasicParsing `
    -ErrorAction Stop

  $job = $jobResponse.Content | ConvertFrom-Json

  if (
    $jobResponse.StatusCode -ne 200 -or
    -not $job.ok -or
    $job.data.analysis_job_id -ne $jobId -or
    $job.data.module_id -ne $moduleId -or
    $job.data.text_version -ne $first.data.text_version -or
    $job.data.status -notin @('queued', 'processing', 'completed', 'failed')
  ) {
    throw 'B03_ANALYSIS_JOB_RESPONSE_INVALID'
  }

  Write-Host 'B03_ANALYSIS_JOB_GET_200_PASS'

  $otherHeaders = @{
    apikey = $anonKey
    Authorization = "Bearer $($other.token)"
  }

  $foreignStatus = 0

  try {
    $foreignResponse = Invoke-WebRequest `
      -Uri $jobUri `
      -Method Get `
      -Headers $otherHeaders `
      -UseBasicParsing `
      -ErrorAction Stop

    $foreignStatus = [int]$foreignResponse.StatusCode
  }
  catch {
    if (-not $_.Exception.Response) {
      throw
    }

    $foreignStatus = [int]$_.Exception.Response.StatusCode
  }

  if ($foreignStatus -ne 404) {
    throw "B03_FOREIGN_JOB_EXPECTED_404_GOT_$foreignStatus"
  }

  Write-Host 'B03_ANALYSIS_JOB_FOREIGN_404_PASS'
  Write-Host 'B03_ANALYZER_API_INTEGRATION_PASS'

  Write-Host 'B03_SNAPSHOT_HTTP_ALL_PASS'
}
finally {
  if ($fixtureCreated) {
$cleanupSql =
@"
        begin;

        delete from public.learning_objectives
        where analysis_job_id in (
        select id from public.analysis_jobs
        where module_id = '$moduleId'::uuid
        );

        delete from public.analysis_jobs
        where module_id = '$moduleId'::uuid;

        delete from public.modules
        where id = '$moduleId'::uuid;

        commit;
"@

    $null = $cleanupSql |
      docker exec -i $db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres

    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'Snapshot test module cleanup failed'
    }
    else {
      Write-Host 'B03_SNAPSHOT_MODULE_CLEANED'
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
      Write-Warning "Could not clean test user $userId"
    }
  }

  Write-Host 'B03_SNAPSHOT_TEST_CLEANUP_FINISHED'
}