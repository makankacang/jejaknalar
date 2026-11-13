-- B07: Server-authoritative assessment scoring results.
-- Scoring is calculated by trusted backend code, never the client.

create table public.assessment_scoring_results (
  id uuid primary key default gen_random_uuid(),

  attempt_id uuid not null unique
    references public.assessment_attempts(id)
    on delete restrict,

  rubric_version_id uuid not null
    references public.assessment_rubric_versions(id)
    on delete restrict,

  outcome text not null
    check (outcome in ('scored', 'insufficient_evidence')),

  score integer,

  objective_results jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(objective_results) = 'array'
      and octet_length(objective_results::text) <= 65536
    ),

  feedback jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(feedback) = 'array'
      and octet_length(feedback::text) <= 65536
    ),

  evidence jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(evidence) = 'array'
      and octet_length(evidence::text) <= 131072
    ),

  engine_version text not null
    check (
      char_length(engine_version) between 1 and 100
    ),

  scored_at timestamptz not null default now(),

  constraint b07_score_outcome_consistency check (
    (
      outcome = 'scored'
      and score is not null
      and score between 0 and 100
    )
    or
    (
      outcome = 'insufficient_evidence'
      and score is null
    )
  )
);

create index b07_scoring_rubric_idx
  on public.assessment_scoring_results (
    rubric_version_id,
    scored_at desc
  );

-- Prevent mismatching a student's attempt with another
-- quest's rubric or another class's published quest.
create function public.b07_guard_scoring_result()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Official scoring results are immutable'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.assessment_attempts a
    join public.student_sessions s
      on s.id = a.student_session_id
    join public.assessment_rubric_versions r
      on r.id = new.rubric_version_id
    join public.published_quest_versions p
      on p.quest_version_id = a.quest_version_id
    where a.id = new.attempt_id
      and a.status = 'pending_scoring'
      and a.quest_version_id = r.quest_version_id
      and s.class_id = p.class_id
  ) then
    raise exception 'Scoring attempt and rubric do not match'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger b07_guard_scoring_result_trigger
before insert or update or delete
on public.assessment_scoring_results
for each row
execute function public.b07_guard_scoring_result();

alter table public.assessment_scoring_results
  enable row level security;

revoke all on public.assessment_scoring_results
  from public, anon, authenticated;

grant select, insert
  on public.assessment_scoring_results
  to service_role;

revoke all on function public.b07_guard_scoring_result()
  from public, anon, authenticated;

comment on table public.assessment_scoring_results is
  'Immutable server-only scoring results linked to one attempt and rubric version.';