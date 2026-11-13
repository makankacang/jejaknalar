# C4 — Source Reference and Text Versioning Contract

Status: **PIC C implementation note; confirm with PIC B (contract steward) before treating as a frozen cross-team contract.**

## Source reference identifiers

C-01 keeps the existing parser payload unchanged. Its `sourceMap[].id` values are locators within one parse result, not durable database identifiers.

| Document format | Source ID | Location metadata | Meaning |
|---|---|---|---|
| PDF | `PDF-P-NNN` | `page` | Original one-based PDF page number; empty pages may still have an entry. |
| DOCX | `DOC-P-NNN` | `paragraphIndex` | One-based order of non-empty text paragraphs; includes extracted headings and table paragraphs; not a page number. |

The analyzer preserves the original C-01 ID as `source_map_id`, and derives location metadata from the corresponding source-map entry, never from model-generated claims. It rejects a PDF ID/page or DOCX ID/paragraph-index mismatch.

## Snapshot and version ownership

- `documentId` is derived from the uploaded file bytes by C-01. It is not the backend `text_version`.
- `text_version` is assigned and owned by the backend. The public analyze request remains `module_id + text_version` as specified by the PRD.
- Backend must persist `extractedText` and `sourceMap` together as one immutable snapshot and resolve the requested `module_id + text_version` to that exact snapshot before invoking C-02.
- A teacher correction to the extracted preview creates a new `text_version`; its text and source map must be updated and stored together. Existing versions and source references must not be silently rewritten.
- References from an older version must not be reused against a newer version unless the backend performs and records an explicit remapping.

## Validation boundary

C-02 validates that the received snapshot is structurally valid, that each source entry is consistent with `extractedText`, that the C-01 identifier matches its page/paragraph metadata, and that each returned excerpt can be found in its referenced source text.

C-02 is a pure analyzer and has no database access. It cannot independently prove that the backend selected the correct stored snapshot for a supplied `text_version`. That guarantee belongs to PIC B's persistence and orchestration layer.

## Cross-PIC confirmation requested

PIC B: confirm immutable snapshot storage, `text_version` semantics, and historical source-reference retention.

PIC A: when presenting a source reference, resolve it against the same module text version used for analysis; do not treat `source_map_id` as globally unique.

PIC C: keep parser output unchanged and maintain structural/source-reference tests.

PIC D: no change required for this contract.
