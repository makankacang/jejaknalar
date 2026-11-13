-- B-03: Prevent concurrent active jobs for the same snapshot.
create unique index if not exists analysis_jobs_one_active_per_snapshot_idx on public.analysis_jobs (module_id, text_version) where status in ('queued', 'processing');
