-- READ ONLY. Run in Supabase staging SQL Editor; do not publish or mutate any data.
-- Locator names are local parser identifiers, not authoritative until text/version compared.
WITH requested(locator, usage) AS (
  VALUES
    ('DOC-P-559', 'Konsep deskripsi/eksposisi'),
    ('DOC-P-599', 'Paragraf A - Sepeda Mira'),
    ('DOC-P-596', 'Paragraf B - Sepeda Motor')
), extracted AS (
  SELECT s.document_id, s.text_version, s.version_no,
         entry.value ->> 'id' AS locator,
         entry.value ->> 'kind' AS kind,
         entry.value ->> 'paragraphIndex' AS paragraph_index,
         entry.value ->> 'text' AS source_text
  FROM public.module_text_versions AS s
  CROSS JOIN LATERAL jsonb_array_elements(s.source_map) AS entry(value)
  WHERE s.document_id = 'doc_a305829d3917b4ca'
)
SELECT r.locator, r.usage, e.document_id, e.text_version,
       e.version_no, e.kind, e.paragraph_index, e.source_text,
       CASE WHEN e.locator IS NULL THEN 'NOT_FOUND_IN_THIS_DOCUMENT'
            ELSE 'FOUND_COMPARE_EXACT_TEXT_AND_TEACHER_APPROVAL' END AS verification_status
FROM requested AS r
LEFT JOIN extracted AS e ON e.locator = r.locator
ORDER BY r.locator, e.version_no DESC;
