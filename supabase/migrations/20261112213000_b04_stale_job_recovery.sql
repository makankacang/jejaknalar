-- B-04: Recover abandoned analysis jobs.
-- Configuration: 3 attempts, 5-minute processing lease.

alter table public.analysis_jobs
  add column next_attempt_at timestamptz not null default now();

create index analysis_jobs_due_queue_idx
  on public.analysis_jobs (next_attempt_at, created_at, id)
  where status = 'queued';

-- Preserve the B-03 function signature for worker compatibility.
create or replace function public.b03_claim_next_analysis_job()
returns table (
  analysis_job_id uuid,
  module_id uuid,
  text_version uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  -- Exhausted jobs must not retry indefinitely.
  update public.analysis_jobs j
  set status = 'failed',
      result_status = null,
      warnings = '[]'::jsonb,
      error_code = 'WORKER_LEASE_EXPIRED',
      error_message = 'Worker melewati batas waktu pemrosesan.',
      retryable = false,
      finished_at = now()
  where j.status = 'processing'
    and coalesce(j.started_at, j.created_at)
        < now() - interval '5 minutes'
    and j.attempt_count >= 3;

  -- Recover stale jobs that still have attempts remaining.
  update public.analysis_jobs j
  set status = 'queued',
      result_status = null,
      warnings = '[]'::jsonb,
      error_code = 'WORKER_LEASE_EXPIRED',
      error_message = 'Worker terhenti; analisis dijadwalkan ulang.',
      retryable = true,
      started_at = null,
      finished_at = null,
      next_attempt_at = now() +
        case
          when j.attempt_count <= 1
            then interval '30 seconds'
          else interval '2 minutes'
        end
  where j.status = 'processing'
    and coalesce(j.started_at, j.created_at)
        < now() - interval '5 minutes'
    and j.attempt_count < 3;

  -- Only due jobs can be claimed.
  return query
    with next_job as (
      select j.id
      from public.analysis_jobs j
      where j.status = 'queued'
        and j.next_attempt_at <= now()
      order by j.next_attempt_at, j.created_at, j.id
      for update skip locked
      limit 1
    )
    update public.analysis_jobs j
    set status = 'processing',
        attempt_count = j.attempt_count + 1,
        started_at = now(),
        finished_at = null,
        error_code = null,
        error_message = null,
        retryable = null
    from next_job
    where j.id = next_job.id
    returning
      j.id,
      j.module_id,
      j.text_version,
      j.attempt_count;
end;
$$;

revoke all on function public.b03_claim_next_analysis_job()
  from public, anon, authenticated;

grant execute on function public.b03_claim_next_analysis_job()
  to service_role;