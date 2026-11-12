-- B-03: Store the analyzer result separately from the job lifecycle.
alter table public.analysis_jobs
  add column result_status text
    check (result_status in ('completed', 'insufficient_evidence')),
  add column warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array');

-- Complete or fail a claimed job atomically.
create function public.b03_finish_analysis_job(
  p_job_id uuid,
  p_attempt_count integer,
  p_outcome text,
  p_objectives jsonb default '[]'::jsonb,
  p_warnings jsonb default '[]'::jsonb,
  p_error_code text default null,
  p_error_message text default null,
  p_retryable boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.analysis_jobs%rowtype;
begin
  -- Only the trusted backend worker may finalize jobs.
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  -- Lock the job to prevent concurrent finalization.
  select *
  into v_job
  from public.analysis_jobs
  where id = p_job_id
  for update;

  if not found then
    return false;
  end if;

  -- Reject stale attempts or jobs that are not processing.
  if v_job.status <> 'processing'
     or v_job.attempt_count <> p_attempt_count then
    return false;
  end if;

  if p_outcome = 'failed' then
    update public.analysis_jobs
    set status = 'failed',
        result_status = null,
        warnings = '[]'::jsonb,
        error_code = coalesce(p_error_code, 'AI_UNAVAILABLE'),
        error_message = left(
          coalesce(p_error_message, 'Analisis gagal.'),
          300
        ),
        retryable = p_retryable,
        finished_at = now()
    where id = p_job_id;

    return true;
  end if;

  if p_outcome not in ('completed', 'insufficient_evidence') then
    raise exception 'Invalid analysis outcome';
  end if;

  if p_objectives is null
     or jsonb_typeof(p_objectives) <> 'array'
     or p_warnings is null
     or jsonb_typeof(p_warnings) <> 'array' then
    raise exception 'Invalid analyzer result';
  end if;

  if p_outcome = 'insufficient_evidence'
     and jsonb_array_length(p_objectives) <> 0 then
    raise exception 'Insufficient evidence must have no objectives';
  end if;

  -- An exception rolls back both the inserts and status update.
  insert into public.learning_objectives (
    module_id,
    text_version,
    analysis_job_id,
    statement,
    basis,
    source_references
  )
  select
    v_job.module_id,
    v_job.text_version,
    v_job.id,
    item.value ->> 'statement',
    item.value ->> 'basis',
    item.value -> 'source_references'
  from jsonb_array_elements(p_objectives) as item(value);

  update public.analysis_jobs
  set status = 'completed',
      result_status = p_outcome,
      warnings = p_warnings,
      error_code = null,
      error_message = null,
      retryable = null,
      finished_at = now()
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function public.b03_finish_analysis_job(
  uuid, integer, text, jsonb, jsonb, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.b03_finish_analysis_job(
  uuid, integer, text, jsonb, jsonb, text, text, boolean
) to service_role;