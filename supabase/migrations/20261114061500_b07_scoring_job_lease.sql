create table public.assessment_scoring_leases (
  attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
  claim_token uuid not null,
  leased_until timestamptz not null,
  claimed_at timestamptz not null default now()
);
create index assessment_scoring_leases_expiry_idx on public.assessment_scoring_leases(leased_until);
alter table public.assessment_scoring_leases enable row level security;
revoke all on public.assessment_scoring_leases from public, anon, authenticated;
grant select, insert, update, delete on public.assessment_scoring_leases to service_role;
create function public.b07_claim_scoring_attempt(p_lease_seconds integer default 120)
returns table(attempt_id uuid, claim_token uuid)
language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid; v_token uuid;
begin
  if p_lease_seconds is null or p_lease_seconds not between 30 and 600 then
    raise exception 'Invalid scoring lease duration' using errcode = '22023';
  end if;
  select a.id into v_id
  from public.assessment_attempts a
  join public.student_sessions s on s.id = a.student_session_id
  join public.published_quest_versions p on p.quest_version_id = a.quest_version_id and p.class_id = s.class_id
  where a.status = 'pending_scoring'
    and exists (select 1 from public.assessment_rubric_versions r where r.quest_version_id = a.quest_version_id)
    and not exists (select 1 from public.assessment_scoring_leases l where l.attempt_id = a.id and l.leased_until > clock_timestamp())
  order by a.created_at, a.id limit 1 for update of a skip locked;
  if v_id is null then return; end if;
  insert into public.assessment_scoring_leases(attempt_id, claim_token, leased_until)
  values(v_id, gen_random_uuid(), clock_timestamp() + make_interval(secs => p_lease_seconds))
  on conflict on constraint assessment_scoring_leases_pkey do update
  set claim_token = excluded.claim_token, leased_until = excluded.leased_until, claimed_at = clock_timestamp()
  where public.assessment_scoring_leases.leased_until <= clock_timestamp()
  returning public.assessment_scoring_leases.claim_token into v_token;
  if v_token is null then return; end if;
  return query select v_id, v_token;
end; $fn$;
revoke all on function public.b07_claim_scoring_attempt(integer) from public, anon, authenticated;
grant execute on function public.b07_claim_scoring_attempt(integer) to service_role;
create function public.b07_finalize_claimed_assessment_score(p_attempt_id uuid, p_claim_token uuid, p_rubric_version_id uuid, p_outcome text, p_score integer, p_objective_results jsonb, p_feedback jsonb, p_evidence jsonb, p_engine_version text)
returns table(attempt_id uuid, status text, replayed boolean, result_id uuid)
language plpgsql security definer set search_path = '' as $fn$
begin
  if p_attempt_id is null or p_claim_token is null then raise exception 'Missing scoring claim' using errcode = '42501'; end if;
  perform 1 from public.assessment_attempts a where a.id = p_attempt_id for update;
  if not found then raise exception 'Assessment attempt not found' using errcode = '42501'; end if;
  perform 1 from public.assessment_scoring_leases l where l.attempt_id = p_attempt_id and l.claim_token = p_claim_token and l.leased_until > clock_timestamp() for update;
  if not found then raise exception 'Invalid or expired scoring claim' using errcode = '42501'; end if;
  return query select f.attempt_id, f.status, f.replayed, f.result_id from public.b07_finalize_assessment_score(p_attempt_id, p_rubric_version_id, p_outcome, p_score, p_objective_results, p_feedback, p_evidence, p_engine_version) as f;
end; $fn$;
revoke all on function public.b07_finalize_assessment_score(uuid,uuid,text,integer,jsonb,jsonb,jsonb,text) from service_role;
revoke all on function public.b07_finalize_claimed_assessment_score(uuid,uuid,uuid,text,integer,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.b07_finalize_claimed_assessment_score(uuid,uuid,uuid,text,integer,jsonb,jsonb,jsonb,text) to service_role;
