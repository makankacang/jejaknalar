
-- JejakNalar B-03: Learning Analyzer database foundation.
-- Teacher-owned modules, immutable-by-API text snapshots,
-- asynchronous analysis jobs, and reviewable objectives.

-- 1. Modul milik guru
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 0 and 160),
  source_type text not null check (
    source_type in ('pdf', 'docx', 'system')
  ),
  created_at timestamptz not null default now()
);

create index modules_owner_idx
  on public.modules (owner_uid);


-- 2. Snapshot teks berdasarkan versi
create table public.module_text_versions (
  text_version uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  document_id text,
  extracted_text text not null check (char_length(btrim(extracted_text)) > 0),
  source_map jsonb not null,
  created_at timestamptz not null default now(),

  unique (module_id, version_no),
  unique (module_id, text_version)
);


-- 3. Pekerjaan analisis AI
create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null,
  text_version uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  error_code text,
  error_message text,
  retryable boolean,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,

  foreign key (module_id, text_version)
    references public.module_text_versions(module_id, text_version),

  unique (id, module_id, text_version)
);

create index analysis_jobs_module_idx
  on public.analysis_jobs (module_id, created_at desc);

create index analysis_jobs_status_idx
  on public.analysis_jobs (status, created_at);


-- 4. Tujuan pembelajaran hasil analisis
create table public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null,
  text_version uuid not null,
  analysis_job_id uuid not null,
  statement text not null
    check (char_length(btrim(statement)) between 1 and 500),
  basis text not null
    check (basis in ('explicit', 'inferred')),
  source_references jsonb not null
    check (
      jsonb_typeof(source_references) = 'array'
      and jsonb_array_length(source_references) > 0
    ),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (analysis_job_id, module_id, text_version)
    references public.analysis_jobs(id, module_id, text_version)
);

create index learning_objectives_module_idx
  on public.learning_objectives (module_id);


-- 5. Aktifkan RLS
alter table public.modules enable row level security;
alter table public.module_text_versions enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.learning_objectives enable row level security;


-- 6. Guru hanya dapat melihat modulnya sendiri
create policy "modules_select_own"
  on public.modules
  for select
  to authenticated
  using ((select auth.uid()) = owner_uid);

create policy "modules_insert_own"
  on public.modules
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_uid);


-- 7. Guru hanya dapat membaca versi teks miliknya
create policy "module_text_versions_select_own"
  on public.module_text_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = module_id
        and m.owner_uid = (select auth.uid())
    )
  );


-- 8. Guru hanya dapat membaca job miliknya
create policy "analysis_jobs_select_own"
  on public.analysis_jobs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = module_id
        and m.owner_uid = (select auth.uid())
    )
  );


-- 9. Guru hanya dapat membaca LO miliknya
create policy "learning_objectives_select_own"
  on public.learning_objectives
  for select
  to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = module_id
        and m.owner_uid = (select auth.uid())
    )
  );


-- 10. Batasi akses langsung ke tabel
revoke all on public.modules from anon, authenticated;
revoke all on public.module_text_versions from anon, authenticated;
revoke all on public.analysis_jobs from anon, authenticated;
revoke all on public.learning_objectives from anon, authenticated;

grant select, insert on public.modules to authenticated;

grant select on public.module_text_versions to authenticated;
grant select on public.analysis_jobs to authenticated;
grant select on public.learning_objectives to authenticated;

-- Backend tepercaya akan mengelola penulisan job dan LO.
grant all on public.modules to service_role;
grant all on public.module_text_versions to service_role;
grant all on public.analysis_jobs to service_role;
grant all on public.learning_objectives to service_role;
