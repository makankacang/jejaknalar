// deno-lint-ignore-file no-import-prefix

import { Hono } from "npm:hono@4.6.14";
import { createClient } from "npm:@supabase/supabase-js@2.46.2";

export const moduleSnapshotRoutes = new Hono();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

interface ParserDocument {
  documentId: string;
  filename: string;
  format: "pdf" | "docx";
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  sourceMap: JsonRecord[];
  metadata: JsonRecord;
  warnings: string[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validString(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

function exactKeys(value: JsonRecord, allowed: string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === allowed.length && keys.every((key) => allowed.includes(key))
  );
}

function validDocument(value: unknown): value is ParserDocument {
  if (!isRecord(value)) return false;

  if (
    !exactKeys(value, [
      "documentId",
      "filename",
      "format",
      "mimeType",
      "sizeBytes",
      "extractedText",
      "sourceMap",
      "metadata",
      "warnings",
    ])
  ) {
    return false;
  }

  if (
    !validString(value.documentId, 200) ||
    !validString(value.filename, 255) ||
    !["pdf", "docx"].includes(String(value.format)) ||
    !validString(value.mimeType, 120) ||
    typeof value.sizeBytes !== "number" ||
    !Number.isSafeInteger(value.sizeBytes) ||
    value.sizeBytes < 0 ||
    !validString(value.extractedText, 1_000_000)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.sourceMap) ||
    value.sourceMap.length < 1 ||
    value.sourceMap.length > 5000 ||
    !isRecord(value.metadata) ||
    !Array.isArray(value.warnings) ||
    value.warnings.length > 100 ||
    !value.warnings.every((w) => typeof w === "string" && w.length <= 1000)
  ) {
    return false;
  }

  const metadata = value.metadata;

  if (!isRecord(metadata)) return false;

  const metadataKeys = Object.keys(metadata);

  for (const key of metadataKeys) {
    const count = metadata[key];

    if (
      (key !== "pageCount" && key !== "paragraphCount") ||
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      return false;
    }
  }

  const ids = new Set<string>();
  let totalSourceTextLength = 0;

  for (const source of value.sourceMap) {
    if (!isRecord(source)) return false;

    if (
      !validString(source.id, 120) ||
      typeof source.text !== "string" ||
      ids.has(source.id)
    ) {
      return false;
    }

    ids.add(source.id);
    totalSourceTextLength += source.text.length;

    if (totalSourceTextLength > 1_250_000) return false;

    if (value.format === "pdf") {
      if (
        !exactKeys(source, ["id", "kind", "page", "text"]) ||
        source.kind !== "page" ||
        !Number.isSafeInteger(source.page) ||
        (source.page as number) < 1
      ) {
        return false;
      }
    } else {
      const allowed = ["id", "kind", "paragraphIndex", "text"];
      if (Object.hasOwn(source, "section")) allowed.push("section");

      if (
        !exactKeys(source, allowed) ||
        source.kind !== "paragraph" ||
        !Number.isSafeInteger(source.paragraphIndex) ||
        (source.paragraphIndex as number) < 1 ||
        (Object.hasOwn(source, "section") && !validString(source.section, 500))
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * POST /functions/v1/api/modules/:module_id/text-versions
 *
 * Body:
 * {
 *   "document": <C-01 DocumentParseResult>
 * }
 *
 * Backend generates text_version and version_no.
 */
moduleSnapshotRoutes.post("/:module_id/text-versions", async (c) => {
  c.header("Cache-Control", "no-store");

  const requestId = crypto.randomUUID();
  const moduleId = c.req.param("module_id");

  const fail = (status: 401 | 404 | 422 | 500, code: string, message: string) =>
    c.json(
      {
        ok: false,
        error: { code, message },
        request_id: requestId,
      },
      status,
    );

  if (!uuidPattern.test(moduleId)) {
    return fail(422, "VALIDATION_ERROR", "module_id tidak valid");
  }

  const authHeader = c.req.header("authorization") ?? "";
  const bearer = /^Bearer\s+([^\s]+)$/i.exec(authHeader);

  if (!bearer) {
    return fail(401, "UNAUTHORIZED", "Token guru diperlukan");
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return fail(500, "INTERNAL_ERROR", "Server belum dikonfigurasi");
  }

  const teacherDb = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await teacherDb.auth.getUser(
    bearer[1],
  );

  if (authError || !authData.user) {
    return fail(401, "UNAUTHORIZED", "Sesi guru tidak valid");
  }

  const parsed: unknown = await c.req.json().catch(() => null);

  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["document"]) ||
    !validDocument(parsed.document)
  ) {
    return fail(422, "VALIDATION_ERROR", "Snapshot parser C-01 tidak valid");
  }

  const document = parsed.document;

  // Privileged database access only after JWT verification.
  // RPC independently checks module ownership under a row lock.
  const admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await admin.rpc("b03_create_parser_snapshot", {
    p_teacher_uid: authData.user.id,
    p_module_id: moduleId,
    p_document_id: document.documentId,
    p_filename: document.filename,
    p_format: document.format,
    p_mime_type: document.mimeType,
    p_size_bytes: document.sizeBytes,
    p_extracted_text: document.extractedText,
    p_source_map: document.sourceMap,
    p_metadata: document.metadata,
    p_warnings: document.warnings,
  });

  if (error?.code === "42501") {
    return fail(404, "NOT_FOUND", "Modul tidak ditemukan");
  }

  if (error?.code === "22023") {
    return fail(422, "VALIDATION_ERROR", "Snapshot tidak valid");
  }

  if (error) {
    console.error("[B03] Snapshot creation failed", {
      requestId,
      code: error.code,
    });
    return fail(500, "INTERNAL_ERROR", "Gagal menyimpan snapshot");
  }

  const snapshot = Array.isArray(data) ? data[0] : null;

  if (
    !snapshot ||
    typeof snapshot.text_version !== "string" ||
    !Number.isInteger(snapshot.version_no)
  ) {
    return fail(500, "INTERNAL_ERROR", "Hasil snapshot tidak valid");
  }

  return c.json(
    {
      ok: true,
      data: {
        module_id: moduleId,
        text_version: snapshot.text_version,
        version_no: snapshot.version_no,
      },
      request_id: requestId,
    },
    201,
  );
});
