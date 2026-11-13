
-- B06: Immutable published QuestV1 storage.
-- Only the backend service role may access this table.
-- Student-facing access must pass through authenticated Edge Functions.

create table public.published_quest_versions (
  id uuid primary key default gen_random_uuid(),

  class_id uuid not null
    references public.classes(id) on delete restrict,

  quest_id text not null
    check (quest_id ~ '^QUEST-[A-Z0-9-]+$'),

  quest_version_id text not null unique
    check (quest_version_id ~ '^QV-[A-Z0-9-]+$'),

  approved_by uuid not null
    references auth.users(id),

  public_payload jsonb not null
    check (
      jsonb_typeof(public_payload) = 'object'
      and public_payload ?& array[
        'schema_version', 'quest_id', 'quest_version_id',
        'objective_ids', 'template', 'scene_id',
        'steps', 'variants'
      ]
      and public_payload->>'schema_version' = '1.0'
      and public_payload->>'template' = 'evidence_hunt'
      and public_payload->>'quest_id' = quest_id
      and public_payload->>'quest_version_id' = quest_version_id
      and jsonb_typeof(public_payload->'objective_ids') = 'array'
      and jsonb_typeof(public_payload->'steps') = 'array'
      and jsonb_typeof(public_payload->'variants') = 'object'
    ),

  published_at timestamptz not null default now()
);

create index published_quest_versions_class_idx
  on public.published_quest_versions (class_id, published_at desc);

-- Verify class ownership on INSERT; reject later changes.
create function public.b06_guard_published_quest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Published quest versions are immutable'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.classes c
    where c.id = new.class_id
      and c.teacher_uid = new.approved_by
  ) then
    raise exception 'Quest approver does not own this class'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger b06_guard_published_quest_trigger
before insert or update or delete
on public.published_quest_versions
for each row
execute function public.b06_guard_published_quest();

alter table public.published_quest_versions
  enable row level security;

revoke all on public.published_quest_versions
  from public, anon, authenticated;

grant select, insert on public.published_quest_versions
  to service_role;

revoke all on function public.b06_guard_published_quest()
  from public, anon, authenticated;

comment on table public.published_quest_versions is
  'Immutable QuestV1 publications. Public payload must be schema-validated and stripped of private scoring data by the backend before insertion.';
