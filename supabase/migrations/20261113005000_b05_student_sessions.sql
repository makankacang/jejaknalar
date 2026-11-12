-- B-05: Student sessions and secure credential storage.
-- Student credentials must be generated and HMAC-hashed by
-- the server. Never store raw access codes or recovery tokens.

create table public.student_sessions (
  id uuid primary key default gen_random_uuid(),

  class_id uuid not null
    references public.classes(id)
    on delete cascade,

  display_name text not null,

  display_name_key text generated always as (
    lower(btrim(display_name))
  ) stored,

  access_code_hash text not null,
  recovery_token_hash text not null,

  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,

  constraint student_sessions_name_check
    check (
      char_length(btrim(display_name))
      between 1 and 80
    ),

  constraint student_sessions_access_hash_check
    check (
      access_code_hash ~ '^[0-9a-f]{64}$'
    ),

  constraint student_sessions_recovery_hash_check
    check (
      recovery_token_hash ~ '^[0-9a-f]{64}$'
    ),

  constraint student_sessions_distinct_credentials_check
    check (
      access_code_hash <> recovery_token_hash
    )
);

-- An active student name may only appear once per class.
-- Case and surrounding whitespace do not create duplicates.
create unique index student_sessions_active_name_idx
  on public.student_sessions (
    class_id,
    display_name_key
  )
  where revoked_at is null;

-- Prevent credential-hash duplication across sessions.
create unique index student_sessions_access_hash_idx
  on public.student_sessions (access_code_hash);

create unique index student_sessions_recovery_hash_idx
  on public.student_sessions (recovery_token_hash);

create index student_sessions_class_idx
  on public.student_sessions (class_id);

-- No direct access to student credentials from public clients.
alter table public.student_sessions
  enable row level security;

revoke all on public.student_sessions
  from public, anon, authenticated;

-- Only trusted backend code may manage student sessions.
grant select, insert, update, delete
  on public.student_sessions
  to service_role;

comment on column public.student_sessions.access_code_hash is
  'Server-generated HMAC-SHA256 hex digest. Never store plaintext.';

comment on column public.student_sessions.recovery_token_hash is
  'Server-generated HMAC-SHA256 hex digest. Never store plaintext.';