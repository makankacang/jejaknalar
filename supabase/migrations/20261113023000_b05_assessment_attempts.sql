
-- B-05: Secure assessment submission persistence.
-- Does NOT perform scoring.
-- A separate, approved scoring flow must finalize attempts later.

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),

  student_session_id uuid not null
    references public.student_sessions(id)
    on delete cascade,

  quest_version_id text not null
    check (
      quest_version_id ~ '^QV-[A-Z0-9-]+$'
      and char_length(quest_version_id) <= 100
    ),

  idempotency_key uuid not null,

  answers jsonb not null
    check (jsonb_typeof(answers) = 'array'),

  status text not null default 'pending_scoring'
    check (status = 'pending_scoring'),

  created_at timestamptz not null default now(),

  constraint b05_assessment_idempotency_unique
    unique (student_session_id, idempotency_key)
);

create index b05_assessment_session_created_idx
  on public.assessment_attempts (
    student_session_id,
    created_at desc
  );

alter table public.assessment_attempts
  enable row level security;

revoke all on public.assessment_attempts
  from public, anon, authenticated;

grant select, insert
  on public.assessment_attempts
  to service_role;

-- Atomic idempotent submission.
-- Only trusted backend code may invoke this function,
-- after verifying X-Student-Access-Code.
create or replace function public.b05_create_assessment_attempt(
  p_student_session_id uuid,
  p_quest_version_id text,
  p_idempotency_key uuid,
  p_answers jsonb
)
returns table (
  attempt_id uuid,
  status text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_id uuid;
  v_existing_id uuid;
  v_existing_quest text;
  v_existing_answers jsonb;
  v_existing_status text;
begin
  if p_student_session_id is null
    or p_idempotency_key is null
    or p_quest_version_id is null
    or p_quest_version_id !~ '^QV-[A-Z0-9-]+$'
    or char_length(p_quest_version_id) > 100
  then
    raise exception 'Invalid assessment identifiers'
      using errcode = '22023';
  end if;

  if p_answers is null
    or jsonb_typeof(p_answers) is distinct from 'array'
  then
    raise exception 'Answers must be an array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_answers) not between 1 and 50 then
    raise exception 'Invalid answer count'
      using errcode = '22023';
  end if;

  -- Enforce the PIC D request contract and basic size limits.
  if exists (
    select 1
    from jsonb_array_elements(p_answers) as a(value)
    where jsonb_typeof(a.value) is distinct from 'object'
      or jsonb_typeof(a.value -> 'item_id') is distinct from 'string'
      or char_length(btrim(a.value ->> 'item_id')) not between 1 and 128
      or jsonb_typeof(a.value -> 'value') is distinct from 'string'
      or char_length(a.value ->> 'value') > 5000
  ) then
    raise exception 'Invalid assessment answer'
      using errcode = '22023';
  end if;

  -- A single submission cannot contain the same item twice.
  if (
    select count(distinct a.value ->> 'item_id')
    from jsonb_array_elements(p_answers) as a(value)
  ) <> jsonb_array_length(p_answers) then
    raise exception 'Duplicate assessment item'
      using errcode = '22023';
  end if;

  -- Reject revoked or nonexistent student sessions.
  -- Lock the session against concurrent deletion/revocation.
  perform 1
  from public.student_sessions as s
  where s.id = p_student_session_id
    and s.revoked_at is null
  for share;

  if not found then
    raise exception 'Student session is not active'
      using errcode = '42501';
  end if;

  -- ON CONFLICT DO NOTHING handles concurrent requests safely.
  insert into public.assessment_attempts (
    student_session_id,
    quest_version_id,
    idempotency_key,
    answers
  )
  values (
    p_student_session_id,
    p_quest_version_id,
    p_idempotency_key,
    p_answers
  )
  on conflict (student_session_id, idempotency_key)
  do nothing
  returning id into v_created_id;

  if v_created_id is not null then
    return query
      select v_created_id, 'pending_scoring'::text, false;
    return;
  end if;

  -- The key already exists: return the original only if the
  -- payload matches exactly.
  select
    a.id,
    a.quest_version_id,
    a.answers,
    a.status
  into
    v_existing_id,
    v_existing_quest,
    v_existing_answers,
    v_existing_status
  from public.assessment_attempts as a
  where a.student_session_id = p_student_session_id
    and a.idempotency_key = p_idempotency_key;

  if not found then
    raise exception 'Assessment submission conflict'
      using errcode = '40001';
  end if;

  if v_existing_quest is distinct from p_quest_version_id
    or v_existing_answers is distinct from p_answers
  then
    raise exception 'Idempotency key reused with different payload'
      using errcode = '23505';
  end if;

  return query
    select v_existing_id, v_existing_status, true;
end;
$$;

-- A SECURITY DEFINER function must not remain public.
revoke all on function public.b05_create_assessment_attempt(
  uuid, text, uuid, jsonb
) from public, anon, authenticated;

grant execute on function public.b05_create_assessment_attempt(
  uuid, text, uuid, jsonb
) to service_role;

comment on table public.assessment_attempts is
  'Server-owned assessment submissions. Scoring is not yet enabled.';

comment on function public.b05_create_assessment_attempt(
  uuid, text, uuid, jsonb
) is
  'Idempotent submission persistence for verified student sessions.';
