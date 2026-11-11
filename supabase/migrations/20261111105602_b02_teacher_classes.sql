-- JejakNalar B-02, Day 2: Teacher-owned classes foundation.
-- Only apply to a local development DB (via `supabase db reset`) today.
-- Other entities (student join, quest, assessment) will use later reviewed migrations.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_uid uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  grade integer not null check (grade between 7 and 9),
  class_code text not null unique check (class_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_uid_idx on public.classes (teacher_uid);

alter table public.classes enable row level security;

-- Teacher can read only classes that they own.
create policy "classes_select_own"
  on public.classes
  for select
  to authenticated
  using ((select auth.uid()) = teacher_uid);

-- Teacher can create only classes belonging to them.
create policy "classes_insert_own"
  on public.classes
  for insert
  to authenticated
  with check ((select auth.uid()) = teacher_uid);

-- Explicitly block anonymous access. No UPDATE/DELETE grants or policies yet.
revoke all on table public.classes from anon;
revoke all on table public.classes from authenticated;
grant select, insert on table public.classes to authenticated;

comment on table public.classes is 'Teacher-owned classes; B-02 Day 2 migration. Class code is not a student authentication factor.';
