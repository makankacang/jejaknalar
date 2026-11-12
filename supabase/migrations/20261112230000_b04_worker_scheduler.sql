-- B-04: Prepare a secure scheduler for analysis jobs.
-- Secrets are stored in Supabase Vault, not in source code.
-- The cron schedule is intentionally NOT activated here.

create extension if not exists pg_cron
  with schema pg_catalog;

create extension if not exists pg_net
  with schema extensions;

-- Internal schema: not exposed as a public Supabase RPC.
create schema if not exists b04_internal;

revoke all on schema b04_internal
  from public, anon, authenticated, service_role;

create or replace function b04_internal.dispatch_analysis_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_url text;
  v_worker_secret text;
  v_request_id bigint;
begin
  -- Do not invoke the worker when there is no work.
  -- Expired processing jobs must also be dispatched so
  -- b03_claim_next_analysis_job() can recover them.
  if not exists (
    select 1
    from public.analysis_jobs j
    where (
      j.status = 'queued'
      and j.next_attempt_at <= now()
    )
    or (
      j.status = 'processing'
      and coalesce(j.started_at, j.created_at)
          < now() - interval '5 minutes'
    )
  ) then
    return null;
  end if;

  -- Read credentials at execution time.
  -- Never embed the secret in cron.job.command.
  select
    max(
      case
        when name = 'b04_analysis_worker_url'
          then decrypted_secret
      end
    ),
    max(
      case
        when name = 'b04_analysis_worker_secret'
          then decrypted_secret
      end
    )
  into v_worker_url, v_worker_secret
  from vault.decrypted_secrets
  where name in (
    'b04_analysis_worker_url',
    'b04_analysis_worker_secret'
  );

  if nullif(btrim(v_worker_url), '') is null
     or nullif(btrim(v_worker_secret), '') is null then
    raise exception 'B-04 worker scheduler is not configured';
  end if;

  select net.http_post(
    url := v_worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', v_worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 240000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

-- Only the owning database role should invoke this function.
revoke all on function b04_internal.dispatch_analysis_worker()
  from public, anon, authenticated, service_role;