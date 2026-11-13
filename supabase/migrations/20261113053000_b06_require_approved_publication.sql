-- B06: Publishing requires an explicitly approved, identical draft.
-- Protects the database even if the API attempts to publish arbitrary JSON.

create or replace function public.b06_guard_published_quest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Published records are append-only.
  if tg_op <> 'INSERT' then
    raise exception 'Published quest versions are immutable'
      using errcode = '42501';
  end if;

  -- The approving teacher must own the class.
  if not exists (
    select 1
    from public.classes c
    where c.id = new.class_id
      and c.teacher_uid = new.approved_by
  ) then
    raise exception 'Quest approver does not own this class'
      using errcode = '42501';
  end if;

  -- Publication must match an approved draft exactly.
  if not exists (
    select 1
    from public.quest_review_drafts d
    where d.class_id = new.class_id
      and d.quest_id = new.quest_id
      and d.quest_version_id = new.quest_version_id
      and d.approved_by = new.approved_by
      and d.status = 'approved'
      and d.approved_at is not null
      and d.public_payload = new.public_payload
  ) then
    raise exception 'Quest has no matching approved draft'
      using errcode = '42501';
  end if;

  return new;
end;
$$;