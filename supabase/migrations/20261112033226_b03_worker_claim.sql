-- B-03: Prevent duplicate active jobs for one document snapshot.
create unique index analysis_jobs_one_active_per_snapshot
  on public.analysis_jobs (module_id, text_version)
  where status in ('queued', 'processing');

-- Atomically claim one queued job for a trusted server worker.
create function public.b03_claim_next_analysis_job()
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
  -- Never allow browser / teacher JWTs to claim jobs.
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
    with next_job as (
      select j.id
      from public.analysis_jobs j
      where j.status = 'queued'
      order by j.created_at, j.id
      for update skip locked
      limit 1
    )
    update public.analysis_jobs j
    set
      status = 'processing',
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