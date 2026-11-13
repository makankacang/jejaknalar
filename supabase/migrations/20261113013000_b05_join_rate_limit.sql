-- B-05: Atomic join-attempt budget per class.
-- Initial protection against brute-force class-code guessing.
-- Limit: 30 requests per 10-minute window per class.

create table public.b05_join_rate_limits (
  class_id uuid primary key
    references public.classes(id) on delete cascade,

  window_started_at timestamptz not null default now(),

  attempts integer not null default 0
    check (attempts between 0 and 31)
);

alter table public.b05_join_rate_limits
  enable row level security;

revoke all on public.b05_join_rate_limits
  from public, anon, authenticated;

grant select, insert, update, delete
  on public.b05_join_rate_limits
  to service_role;

create or replace function public.b05_consume_join_budget(
  p_class_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  insert into public.b05_join_rate_limits (
    class_id,
    window_started_at,
    attempts
  )
  values (
    p_class_id,
    clock_timestamp(),
    1
  )
  on conflict (class_id)
  do update set
    window_started_at =
      case
        when excluded.window_started_at >=
          public.b05_join_rate_limits.window_started_at
          + interval '10 minutes'
        then excluded.window_started_at
        else public.b05_join_rate_limits.window_started_at
      end,
    attempts =
      case
        when excluded.window_started_at >=
          public.b05_join_rate_limits.window_started_at
          + interval '10 minutes'
        then 1
        else least(
          public.b05_join_rate_limits.attempts + 1,
          31
        )
      end
  returning attempts into v_attempts;

  return v_attempts <= 30;
end;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC on new functions by default.
-- Remove that permission explicitly.
revoke all on function public.b05_consume_join_budget(uuid)
  from public, anon, authenticated;

grant execute on function public.b05_consume_join_budget(uuid)
  to service_role;

comment on function public.b05_consume_join_budget(uuid) is
  'Atomic B-05 class join budget. Trusted backend only.';