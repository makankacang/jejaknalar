-- B-03: Complete the immutable parser snapshot metadata for C-02.
-- Nullable fields preserve compatibility with existing test snapshots.

alter table public.module_text_versions
  add column filename text,
  add column format text
    check (format in ('pdf', 'docx')),
  add column mime_type text,
  add column size_bytes bigint
    check (size_bytes between 0 and 9007199254740991),
  add column metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  add column warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array');

comment on column public.module_text_versions.filename
  is 'Original filename from C-01 DocumentParseResult';

comment on column public.module_text_versions.format
  is 'Parser document format: pdf or docx';

comment on column public.module_text_versions.mime_type
  is 'Original file MIME type';

comment on column public.module_text_versions.size_bytes
  is 'Original file size in bytes';

comment on column public.module_text_versions.metadata
  is 'C-01 parser metadata, including pageCount or paragraphCount';

comment on column public.module_text_versions.warnings
  is 'C-01 parser warnings';