-- B08: Server-authoritative adaptive decisions.
-- The thresholds below are provisional, not production-approved.

create table public.assessment_adaptive_policies (
  version text primary key,
  developing_min_score integer not null,
  extension_min_score integer not null,
  approval_status text not null default 'provisional'
    check (approval_status in ('provisional', 'approved')),

  created_at timestamptz not null default now(),

  constraint b08_policy_thresholds_valid check (
    developing_min_score between 1 and 99
    and extension_min_score between 2 and 100
    and developing_min_score < extension_min_score
  )
);

insert into public.assessment_adaptive_policies (
  version,
  developing_min_score,
  extension_min_score,
  approval_status
)
values (
  'b08-provisional-1',
  60,
  80,
  'provisional'
);

create table public.assessment_adaptive_decisions (
  attempt_id uuid primary key
    references public.assessment_scoring_results(attempt_id)
    on delete restrict,

  policy_version text not null
    references public.assessment_adaptive_policies(version),

  outcome text not null
    check (outcome in ('scored', 'insufficient_evidence')),

  score_snapshot integer,

  next_path text
    check (
      next_path in (
        'needs_support',
        'developing',
        'ready_for_extension'
      )
    ),

  decided_at timestamptz not null default now(),

  constraint b08_decision_consistency check (
    (
      outcome = 'scored'
      and score_snapshot is not null
      and score_snapshot between 0 and 100
      and next_path is not null
    )
    or
    (
      outcome = 'insufficient_evidence'
      and score_snapshot is null
      and next_path is null
    )
  )
);

create function public.b08_guard_adaptive_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Adaptive decisions are immutable'
    using errcode = '42501';
end;
$$;

create trigger b08_guard_adaptive_decision_trigger
before update or delete
on public.assessment_adaptive_decisions
for each row
execute function public.b08_guard_adaptive_decision();

create function public.b08_record_adaptive_decision(
  p_attempt_id uuid,
  p_policy_version text
)
returns table (
  attempt_id uuid,
  outcome text,
  score integer,
  next_path text,
  policy_version text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outcome text;
  v_score integer;
  v_path text;

  v_developing integer;
  v_extension integer;

  v_inserted_id uuid;
  v_existing public.assessment_adaptive_decisions%rowtype;
begin
  if p_attempt_id is null
    or p_policy_version is null
    or length(trim(p_policy_version)) = 0
  then
    raise exception 'Invalid adaptive decision request'
      using errcode = '22023';
  end if;

  -- Thresholds are owned by the backend, not the client.
  select
    p.developing_min_score,
    p.extension_min_score
  into
    v_developing,
    v_extension
  from public.assessment_adaptive_policies p
  where p.version = p_policy_version;

  if not found then
    raise exception 'Unknown adaptive policy'
      using errcode = '22023';
  end if;

  -- Only an officially finalized B07 result can be used.
  select
    r.outcome,
    r.score
  into
    v_outcome,
    v_score
  from public.assessment_scoring_results r
  join public.assessment_attempts a
    on a.id = r.attempt_id
  where r.attempt_id = p_attempt_id
    and a.status = r.outcome
  for share of a, r;

  if not found then
    raise exception 'Official scoring result is not finalized'
      using errcode = '22023';
  end if;

  if v_outcome = 'insufficient_evidence' then
    v_path := null;
  elsif v_outcome = 'scored' then
    if v_score < v_developing then
      v_path := 'needs_support';
    elsif v_score < v_extension then
      v_path := 'developing';
    else
      v_path := 'ready_for_extension';
    end if;
  else
    raise exception 'Unsupported scoring outcome'
      using errcode = '22023';
  end if;

  -- Concurrent calls cannot create duplicate decisions.
  insert into public.assessment_adaptive_decisions as d (
    attempt_id,
    policy_version,
    outcome,
    score_snapshot,
    next_path
  )
  values (
    p_attempt_id,
    p_policy_version,
    v_outcome,
    v_score,
    v_path
  )
  on conflict on constraint assessment_adaptive_decisions_pkey
  do nothing
  returning d.attempt_id into v_inserted_id;

  if v_inserted_id is null then
    select d.*
    into v_existing
    from public.assessment_adaptive_decisions d
    where d.attempt_id = p_attempt_id;

    if not found
      or v_existing.policy_version <> p_policy_version
      or v_existing.outcome <> v_outcome
      or v_existing.score_snapshot is distinct from v_score
      or v_existing.next_path is distinct from v_path
    then
      raise exception 'Conflicting adaptive decision'
        using errcode = '23505';
    end if;
  end if;

  return query
    select
      p_attempt_id,
      v_outcome,
      v_score,
      v_path,
      p_policy_version,
      (v_inserted_id is null);
end;
$$;

-- Both tables are private.
alter table public.assessment_adaptive_policies
  enable row level security;

alter table public.assessment_adaptive_decisions
  enable row level security;

revoke all on public.assessment_adaptive_policies
  from public, anon, authenticated;

revoke all on public.assessment_adaptive_decisions
  from public, anon, authenticated;

grant select on public.assessment_adaptive_policies
  to service_role;

grant select on public.assessment_adaptive_decisions
  to service_role;

revoke all on function public.b08_guard_adaptive_decision()
  from public, anon, authenticated;

revoke all on function public.b08_record_adaptive_decision(
  uuid, text
) from public, anon, authenticated;

grant execute on function public.b08_record_adaptive_decision(
  uuid, text
) to service_role;

comment on table public.assessment_adaptive_decisions is
  'Immutable adaptive decisions derived from official B07 scoring results.';