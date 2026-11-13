
-- B-05: Student gameplay checkpoints.
-- UI progress only. Never treat checkpoint data as verified scoring.
-- Optimistic locking prevents stale requests overwriting newer progress.

create table public.student_checkpoints (
  id uuid primary key default gen_random_uuid(),

  student_session_id uuid not null
    references public.student_sessions(id)
    on delete cascade,

  quest_version_id text not null
    check (
      quest_version_id ~ '^QV-[A-Z0-9-]+$'
      and char_length(quest_version_id) <= 100
    ),

  revision bigint not null default 1
    check (revision >= 1),

  progress jsonb not null
    check (
      jsonb_typeof(progress) = 'object'
      and octet_length(progress::text) <= 16384
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint b05_checkpoint_unique_session_quest
    unique (student_session_id, quest_version_id)
);

alter table public.student_checkpoints
  enable row level security;

revoke all on public.student_checkpoints
  from public, anon, authenticated;

grant select, insert, update
  on public.student_checkpoints
  to service_role;

create or replace function public.b05_save_student_checkpoint(
  p_student_session_id uuid,
  p_quest_version_id text,
  p_expected_revision bigint,
  p_progress jsonb
)
returns table (
  checkpoint_id uuid,
  revision bigint,
  progress jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_revision bigint;
  v_progress jsonb;
  v_updated_at timestamptz;
begin
  if p_student_session_id is null
    or p_quest_version_id is null
    or p_quest_version_id !~ '^QV-[A-Z0-9-]+$'
    or char_length(p_quest_version_id) > 100
    or p_expected_revision is null
    or p_expected_revision < 0
    or p_expected_revision = 9223372036854775807
    or p_progress is null
    or jsonb_typeof(p_progress) is distinct from 'object'
    or octet_length(p_progress::text) > 16384
  then
    raise exception 'Invalid checkpoint input'
      using errcode = '22023';
  end if;

  -- A revoked or nonexistent student may not save progress.
  -- Locking prevents concurrent revocation during this transaction.
  perform 1
  from public.student_sessions as s
  where s.id = p_student_session_id
    and s.revoked_at is null
  for share;

  if not found then
    raise exception 'Student session is not active'
      using errcode = '42501';
  end if;

  if p_expected_revision = 0 then

    -- Initial write: succeeds only if no checkpoint exists.
    -- The unique constraint also protects concurrent inserts.
    insert into public.student_checkpoints as cp (
      student_session_id,
      quest_version_id,
      revision,
      progress
    )
    values (
      p_student_session_id,
      p_quest_version_id,
      1,
      p_progress
    )
    on conflict (student_session_id, quest_version_id)
      do nothing
    returning
      cp.id, cp.revision, cp.progress, cp.updated_at
    into
      v_id, v_revision, v_progress, v_updated_at;

  else

    -- Existing checkpoint: compare-and-swap revision.
    -- Concurrent requests with the same revision cannot both win.
    update public.student_checkpoints as cp
    set
      revision = cp.revision + 1,
      progress = p_progress,
      updated_at = clock_timestamp()
    where cp.student_session_id = p_student_session_id
      and cp.quest_version_id = p_quest_version_id
      and cp.revision = p_expected_revision
    returning
      cp.id, cp.revision, cp.progress, cp.updated_at
    into
      v_id, v_revision, v_progress, v_updated_at;

  end if;

  if v_id is null then
    raise exception 'B05_CHECKPOINT_REVISION_CONFLICT'
      using errcode = 'P0001';
  end if;

  return query
    select v_id, v_revision, v_progress, v_updated_at;
end;
$$;

revoke all on function public.b05_save_student_checkpoint(
  uuid, text, bigint, jsonb
) from public, anon, authenticated;

grant execute on function public.b05_save_student_checkpoint(
  uuid, text, bigint, jsonb
) to service_role;

comment on table public.student_checkpoints is
  'Unverified UI progress for session-scoped gameplay resume.';

comment on function public.b05_save_student_checkpoint(
  uuid, text, bigint, jsonb
) is
  'Atomic revision-checked checkpoint write for trusted student API.';
