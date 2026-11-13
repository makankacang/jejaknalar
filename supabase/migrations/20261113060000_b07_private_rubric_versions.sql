-- B07: Private, versioned assessment specifications.
-- Answer keys and rubrics must never be exposed to students.
-- Rubric revisions are immutable and stored separately.

create table public.assessment_rubric_versions (
  id uuid primary key default gen_random_uuid(),

  quest_version_id text not null
    references public.published_quest_versions(quest_version_id)
    on delete restrict,

  revision integer not null
    check (revision between 1 and 1000),

  registered_by uuid not null
    references auth.users(id),

  private_spec jsonb not null
    check (
      jsonb_typeof(private_spec) = 'object'
      and octet_length(private_spec::text) <= 262144
    ),

  created_at timestamptz not null default now(),

  constraint b07_rubric_revision_unique
    unique (quest_version_id, revision)
);

create index b07_rubric_quest_idx
  on public.assessment_rubric_versions (
    quest_version_id,
    revision desc
  );

create function public.b07_guard_private_rubric()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Private rubric versions are immutable'
      using errcode = '42501';
  end if;

  -- Rubric must belong to a published version approved
  -- by the same owning teacher.
  if not exists (
    select 1
    from public.published_quest_versions p
    where p.quest_version_id = new.quest_version_id
      and p.approved_by = new.registered_by
  ) then
    raise exception 'Rubric registration is not authorized'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger b07_guard_private_rubric_trigger
before insert or update or delete
on public.assessment_rubric_versions
for each row
execute function public.b07_guard_private_rubric();

alter table public.assessment_rubric_versions
  enable row level security;

revoke all on public.assessment_rubric_versions
  from public, anon, authenticated;

grant select, insert
  on public.assessment_rubric_versions
  to service_role;

revoke all on function public.b07_guard_private_rubric()
  from public, anon, authenticated;

comment on table public.assessment_rubric_versions is
  'Server-only immutable rubric versions. Private spec is not a public quest payload.';