-- B07: review-before-deploy provenance protection for server-authored scoring.
-- IMPORTANT: Apply to STAGING first, after coordination with PIC C (parser)
-- and PIC A (teacher review). Do not apply directly to production.
-- Parser workers must create a NEW text_version instead of altering existing snapshots.
-- This trigger intentionally blocks UPDATE/DELETE on ALL snapshots, including
-- ON DELETE CASCADE from modules. Review retention/deletion workflow separately.

create function public.b07_guard_text_snapshot_immutable()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  raise exception 'Module text versions are immutable; create a new version'
    using errcode = '42501';
end;
$fn$;

create trigger b07_text_snapshot_immutable
before update or delete on public.module_text_versions
for each row execute function public.b07_guard_text_snapshot_immutable();

-- A teacher can revoke approval to halt new scoring, but historical approval
-- MUST NOT be undone by switching approved -> rejected -> editing provenance.
-- Sticky lock also protects historical IDs when re-approved later.
alter table public.learning_objectives
  add column b07_provenance_locked boolean not null default false;

-- Backfill existing approved objectives; historic approval/revocation events
-- before this migration cannot be reconstructed from current status alone.
update public.learning_objectives
set b07_provenance_locked = true
where review_status = 'approved';

create function public.b07_guard_approved_objective_provenance()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    if old.b07_provenance_locked or old.review_status = 'approved' then
      raise exception 'Previously approved learning objective cannot be deleted'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.b07_provenance_locked := (new.review_status = 'approved');
    return new;
  end if;

  if old.b07_provenance_locked or old.review_status = 'approved' then
    if (new.id, new.module_id, new.text_version, new.analysis_job_id,
        new.statement, new.basis, new.source_references, new.created_at)
      is distinct from
       (old.id, old.module_id, old.text_version, old.analysis_job_id,
        old.statement, old.basis, old.source_references, old.created_at)
    then
      raise exception 'Previously approved learning objective provenance is immutable'
        using errcode = '42501';
    end if;
  end if;

  -- Do not allow service role to clear the lock explicitly. The lock is
  -- automatically set on first approval and survives later review changes.
  new.b07_provenance_locked :=
    old.b07_provenance_locked or old.review_status = 'approved'
    or new.review_status = 'approved';
  return new;
end;
$fn$;

create trigger b07_approved_objective_provenance
before insert or update or delete on public.learning_objectives
for each row execute function public.b07_guard_approved_objective_provenance();

revoke all on function public.b07_guard_text_snapshot_immutable()
  from public, anon, authenticated;
revoke all on function public.b07_guard_approved_objective_provenance()
  from public, anon, authenticated;
