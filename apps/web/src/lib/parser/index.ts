/**
 * Public API parser dokumen JejakNalar (C-01, PIC C).
 *
 * Contoh pemakaian (mis. dari apps/web/src/features/teacher/...):
 *
 *   import { parseDocument, isDocumentParseError } from '../../lib/parser';
 *
 *   try {
 *     const result = await parseDocument(file);
 *     // result.extractedText, result.sourceMap, result.warnings
 *   } catch (error) {
 *     if (isDocumentParseError(error)) showToast(error.message); // error.code stabil
 *   }
 */
import { resolveLimits, type ParseOptions } from './config';
import { toDocumentParseError } from './errors';
import { parseDocx } from './docx-parser';
import { parsePdf } from './pdf-parser';
import type { DocumentParseResult } from './types';
import { validateFile } from './validation';

export async function parseDocument(file: File, options?: ParseOptions): Promise<DocumentParseResult> {
  try {
    const format = validateFile(file, resolveLimits(options));
    return format === 'pdf' ? await parsePdf(file, options) : await parseDocx(file, options);
  } catch (error) {
    throw toDocumentParseError(error);
  }
}

export { parsePdf, parseDocx };
export { DOCUMENT_LIMITS } from './config';
export type { DocumentLimits, ParseOptions } from './config';
export { DocumentParseError, isDocumentParseError } from './errors';
export type { DocumentParseErrorCode, DocumentParseErrorDetails } from './errors';
export type { DocumentFormat, DocumentParseResult, DocumentSourceReference } from './types';
