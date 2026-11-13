-- B06: Teacher-reviewed quest drafts.
-- A draft must be explicitly approved before it can be published.
-- Only trusted backend code may read or modify these records.

create table public.quest_review_drafts (
  id uuid primary key default gen_random_uuid(),

  class_id uuid not null
    references public.classes(id) on delete restrict,

  quest_id text not null
    check (
      quest_id ~ '^QUEST-[A-Z0-9-]+$'
      and char_length(quest_id) <= 100
    ),

  quest_version_id text not null unique
    check (
      quest_version_id ~ '^QV-[A-Z0-9-]+$'
      and char_length(quest_version_id) <= 100
    ),

  submitted_by uuid not null
    references auth.users(id),

  public_payload jsonb not null
    check (
      jsonb_typeof(public_payload) = 'object'
      and public_payload ?& array[
        'schema_version',
        'quest_id',
        'quest_version_id',
        'objective_ids',
        'template',
        'scene_id',
        'steps',
        'variants'
      ]
      and public_payload->>'schema_version' = '1.0'
      and public_payload->>'template' = 'evidence_hunt'
      and public_payload->>'quest_id' = quest_id
      and public_payload->>'quest_version_id' = quest_version_id
      and jsonb_typeof(public_payload->'objective_ids') = 'array'
      and jsonb_typeof(public_payload->'steps') = 'array'
      and jsonb_typeof(public_payload->'variants') = 'object'
      and (
        public_payload - array[
          'schema_version',
          'quest_id',
          'quest_version_id',
          'objective_ids',
          'template',
          'scene_id',
          'steps',
          'variants'
        ]
      ) = '{}'::jsonb
    ),

  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved')),

  approved_by uuid
    references auth.users(id),

  approved_at timestamptz,

  created_at timestamptz not null default now(),

  constraint b06_review_status_consistent check (
    (
      status = 'pending_review'
      and approved_by is null
      and approved_at is null
    )
    or
    (
      status = 'approved'
      and approved_by is not null
      and approved_at is not null
    )
  )
);

create index b06_quest_review_class_idx
  on public.quest_review_drafts (class_id, created_at desc);

create function public.b06_guard_quest_review_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending_review'
       or new.approved_by is not null
       or new.approved_at is not null
    then
      raise exception 'Draft must begin pending review'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.classes c
      where c.id = new.class_id
        and c.teacher_uid = new.submitted_by
    ) then
      raise exception 'Draft submitter does not own this class'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only one transition is permitted: pending -> approved.
    if old.status <> 'pending_review'
       or new.status <> 'approved'
    then
      raise exception 'Invalid draft approval transition'
        using errcode = '42501';
    end if;

    -- Approval cannot change the reviewed content or identity.
    if row(
      new.id,
      new.class_id,
      new.quest_id,
      new.quest_version_id,
      new.submitted_by,
      new.public_payload,
      new.created_at
    ) is distinct from row(
      old.id,
      old.class_id,
      old.quest_id,
      old.quest_version_id,
      old.submitted_by,
      old.public_payload,
      old.created_at
    ) then
      raise exception 'Reviewed draft content is immutable'
        using errcode = '42501';
    end if;

    if new.approved_by is null or not exists (
      select 1
      from public.classes c
      where c.id = new.class_id
        and c.teacher_uid = new.approved_by
    ) then
      raise exception 'Only the class teacher may approve'
        using errcode = '42501';
    end if;

    new.approved_at := now();
    return new;
  end if;

  raise exception 'Quest review drafts cannot be deleted'
    using errcode = '42501';
end;
$$;

create trigger b06_guard_quest_review_draft_trigger
before insert or update or delete
on public.quest_review_drafts
for each row
execute function public.b06_guard_quest_review_draft();

alter table public.quest_review_drafts
  enable row level security;

revoke all on public.quest_review_drafts
  from public, anon, authenticated;

grant select, insert, update
  on public.quest_review_drafts
  to service_role;

revoke all on function public.b06_guard_quest_review_draft()
  from public, anon, authenticated;