-- B03 follow-up: Create parser snapshots safely.
-- Only the trusted backend service role may call this function.
--
-- The module row is locked so concurrent requests cannot
-- allocate the same version_no.

create or replace function public.b03_create_parser_snapshot(
  p_teacher_uid uuid,
  p_module_id uuid,
  p_document_id text,
  p_filename text,
  p_format text,
  p_mime_type text,
  p_size_bytes bigint,
  p_extracted_text text,
  p_source_map jsonb,
  p_metadata jsonb,
  p_warnings jsonb
)
returns table (
  text_version uuid,
  version_no integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_module_id uuid;
  v_next_version integer;
  v_created_text_version uuid;
begin
  -- Verify teacher ownership and serialize snapshot creation.
  select m.id
  into v_module_id
  from public.modules m
  where m.id = p_module_id
    and m.owner_uid = p_teacher_uid
  for update;

  if v_module_id is null then
    raise exception 'Module not found or access denied'
      using errcode = '42501';
  end if;

  -- Validate basic snapshot structure.
  if p_document_id is null
    or length(btrim(p_document_id)) not between 1 and 200
    or p_filename is null
    or length(btrim(p_filename)) not between 1 and 255
    or p_format is null
    or p_format not in ('pdf', 'docx')
    or p_mime_type is null
    or length(btrim(p_mime_type)) not between 1 and 120
    or p_size_bytes is null
    or p_size_bytes < 0
    or p_size_bytes > 9007199254740991
    or p_extracted_text is null
    or length(btrim(p_extracted_text)) = 0
    or length(p_extracted_text) > 1000000
    or coalesce(jsonb_typeof(p_source_map), '') <> 'array'
    or jsonb_array_length(p_source_map) not between 1 and 5000
    or coalesce(jsonb_typeof(p_metadata), '') <> 'object'
    or coalesce(jsonb_typeof(p_warnings), '') <> 'array'
  then
    raise exception 'Invalid parser snapshot'
      using errcode = '22023';
  end if;

  -- The module row lock makes version allocation atomic.
  select coalesce(max(s.version_no), 0) + 1
  into v_next_version
  from public.module_text_versions s
  where s.module_id = p_module_id;

  insert into public.module_text_versions (
    module_id,
    version_no,
    document_id,
    filename,
    format,
    mime_type,
    size_bytes,
    extracted_text,
    source_map,
    metadata,
    warnings
  )
  values (
    p_module_id,
    v_next_version,
    p_document_id,
    p_filename,
    p_format,
    p_mime_type,
    p_size_bytes,
    p_extracted_text,
    p_source_map,
    p_metadata,
    p_warnings
  )
  returning module_text_versions.text_version
  into v_created_text_version;

  return query
  select v_created_text_version, v_next_version;
end;
$$;

revoke all on function public.b03_create_parser_snapshot(
  uuid, uuid, text, text, text, text,
  bigint, text, jsonb, jsonb, jsonb
)
from public, anon, authenticated;

grant execute on function public.b03_create_parser_snapshot(
  uuid, uuid, text, text, text, text,
  bigint, text, jsonb, jsonb, jsonb
)
to service_role;