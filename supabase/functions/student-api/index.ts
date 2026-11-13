// deno-lint-ignore-file no-import-prefix
// Supabase Edge Functions use pinned npm: imports.

/**
 * B-05: Public student join endpoint.
 *
 * POST /functions/v1/student-api/classes/:id/join
 *
 * The service-role key and HMAC secret are server-side only.
 * Never log or persist plaintext student credentials.
 */

import { type Context, Hono } from "npm:hono@4.6.14";
import { cors } from "npm:hono@4.6.14/cors";
import { createClient } from "npm:@supabase/supabase-js@2.46.2";
import {
  authenticateStudentAccessCode,
  hashStudentCredential,
} from "./student-auth.ts";

const app = new Hono().basePath("/student-api");

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const classCodePattern = /^[A-HJ-NP-Z2-9]{8}$/;

const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  "/*",
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : ""),
    allowHeaders: [
      "authorization",
      "apikey",
      "content-type",
      "x-client-info",
      "x-student-access-code",
    ],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  }),
);

type ErrorStatus = 401 | 404 | 409 | 422 | 429 | 500;

type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

function responseError(
  c: Context,
  status: ErrorStatus,
  code: ErrorCode,
  message: string,
  requestId: string,
) {
  return c.json(
    {
      ok: false,
      error: { code, message },
      request_id: requestId,
    },
    status,
  );
}

function generateCredential(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(bytes, (byte) => alphabet[byte & 31]).join("");
}

app.post("/classes/:id/join", async (c) => {
  const requestId = crypto.randomUUID();

  // Credentials must never be cached by browsers or proxies.
  c.header("Cache-Control", "no-store");

  const classId = c.req.param("id");

  if (!uuidPattern.test(classId)) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "ID kelas tidak valid",
      requestId,
    );
  }

  const parsed: unknown = await c.req.json().catch(() => null);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "JSON request tidak valid",
      requestId,
    );
  }

  const body = parsed as Record<string, unknown>;

  const classCode = typeof body.class_code === "string"
    ? body.class_code.trim().toUpperCase()
    : "";

  const displayName = typeof body.display_name === "string"
    ? body.display_name.trim()
    : "";

  if (
    !classCodePattern.test(classCode) ||
    displayName.length < 1 ||
    displayName.length > 80
  ) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Kode kelas atau nama siswa tidak valid",
      requestId,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hmacSecret = Deno.env.get("STUDENT_CREDENTIAL_HMAC_KEY");

  if (
    !url ||
    !serviceRoleKey ||
    !hmacSecret ||
    new TextEncoder().encode(hmacSecret).length < 32
  ) {
    console.error("[B-05] Student API configuration missing", {
      requestId,
    });

    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Konfigurasi server belum siap",
      requestId,
    );
  }

  // Administrative access is restricted to this server function.
  // Never send this key to the browser.
  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: classRow, error: classError } = await admin
      .from("classes")
      .select("id, name, class_code")
      .eq("id", classId)
      .maybeSingle();

    if (classError) {
      console.error("[B-05] Class lookup failed", {
        requestId,
        code: classError.code,
      });

      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Gagal memeriksa kelas",
        requestId,
      );
    }

    if (!classRow) {
      return responseError(
        c,
        404,
        "NOT_FOUND",
        "Kelas atau kode kelas tidak ditemukan",
        requestId,
      );
    }

    // Atomic database rate limit: max 30 attempts / 10 minutes.
    // Count attempts before checking whether the code is correct.
    const { data: allowed, error: budgetError } = await admin.rpc(
      "b05_consume_join_budget",
      {
        p_class_id: classId,
      },
    );

    if (budgetError) {
      console.error("[B-05] Join budget failed", {
        requestId,
        code: budgetError.code,
      });

      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Gagal memeriksa batas percobaan",
        requestId,
      );
    }

    if (allowed !== true) {
      return responseError(
        c,
        429,
        "RATE_LIMITED",
        "Terlalu banyak percobaan. Coba lagi nanti.",
        requestId,
      );
    }

    // Return the same 404 response as an unknown class.
    if (classRow.class_code !== classCode) {
      return responseError(
        c,
        404,
        "NOT_FOUND",
        "Kelas atau kode kelas tidak ditemukan",
        requestId,
      );
    }

    // 20 base32 characters ~= 100 bits of random entropy.
    // 32 base32 characters ~= 160 bits of random entropy.
    const accessCode = generateCredential(20);
    const recoveryToken = generateCredential(32);

    const accessCodeHash = await hashStudentCredential(accessCode, hmacSecret);

    const recoveryTokenHash = await hashStudentCredential(
      recoveryToken,
      hmacSecret,
    );

    const { data: session, error: insertError } = await admin
      .from("student_sessions")
      .insert({
        class_id: classId,
        display_name: displayName,
        access_code_hash: accessCodeHash,
        recovery_token_hash: recoveryTokenHash,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return responseError(
          c,
          409,
          "CONFLICT",
          "Nama siswa sudah terdaftar di kelas ini",
          requestId,
        );
      }

      console.error("[B-05] Session insert failed", {
        requestId,
        code: insertError.code,
      });

      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Gagal membuat sesi siswa",
        requestId,
      );
    }

    return c.json(
      {
        ok: true,
        data: {
          student_session_id: session.id,
          access_code: accessCode,
          recovery_token: recoveryToken,
          class_id: classRow.id,
          class_name: classRow.name,
        },
        request_id: requestId,
      },
      201,
    );
  } catch {
    console.error("[B-05] Unexpected join error", {
      requestId,
    });

    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Terjadi kesalahan server",
      requestId,
    );
  }
});

/**
 * B-05: Validate a student access code.
 * Provisional endpoint; not yet part of the team OpenAPI contract.
 */
app.get("/session", async (c) => {
  const requestId = crypto.randomUUID();
  c.header("Cache-Control", "no-store");

  const auth = await authenticateStudentAccessCode(
    c.req.header("x-student-access-code"),
  );

  if (!auth.ok) {
    if (auth.reason === "UNAUTHORIZED") {
      return responseError(
        c,
        401,
        "UNAUTHORIZED",
        "Sesi siswa tidak valid",
        requestId,
      );
    }

    console.error("[B-05] Student authentication unavailable", {
      requestId,
    });

    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Gagal memeriksa sesi siswa",
      requestId,
    );
  }

  return c.json({
    ok: true,
    data: {
      student_session_id: auth.session.id,
      class_id: auth.session.class_id,
      display_name: auth.session.display_name,
    },
    request_id: requestId,
  });
});

/**
 * B-05: Persist student assessment submissions.
 *
 * Provisional endpoint:
 * POST /functions/v1/student-api/assessments/submit
 *
 * Returns 202 pending_scoring. Does not generate a score,
 * feedback, or adaptive path.
 */
app.post("/assessments/submit", async (c) => {
  const requestId = crypto.randomUUID();
  c.header("Cache-Control", "no-store");

  // Student identity must come from the verified access code.
  const auth = await authenticateStudentAccessCode(
    c.req.header("x-student-access-code"),
  );

  if (!auth.ok) {
    if (auth.reason === "UNAUTHORIZED") {
      return responseError(
        c,
        401,
        "UNAUTHORIZED",
        "Sesi siswa tidak valid",
        requestId,
      );
    }

    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Autentikasi siswa tidak tersedia",
      requestId,
    );
  }

  // Limit parsed JSON size to avoid oversized submissions.
  const contentLength = Number(c.req.header("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > 300000) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Request assessment terlalu besar",
      requestId,
    );
  }

  const raw = await c.req.text().catch(() => "");

  if (new TextEncoder().encode(raw).byteLength > 300000) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Request assessment terlalu besar",
      requestId,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "JSON assessment tidak valid",
      requestId,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Request assessment harus berupa objek",
      requestId,
    );
  }

  const body = parsed as Record<string, unknown>;
  const questVersionId = body.quest_version_id;
  const idempotencyKey = body.idempotency_key;
  const answers = body.answers;

  if (
    typeof questVersionId !== "string" ||
    !/^QV-[A-Z0-9-]+$/.test(questVersionId) ||
    questVersionId.length > 100 ||
    typeof idempotencyKey !== "string" ||
    !uuidPattern.test(idempotencyKey) ||
    !Array.isArray(answers) ||
    answers.length < 1 ||
    answers.length > 50
  ) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Request assessment tidak sesuai kontrak",
      requestId,
    );
  }

  const seenItems = new Set<string>();

  for (const entry of answers) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return responseError(
        c,
        422,
        "VALIDATION_ERROR",
        "Format jawaban tidak valid",
        requestId,
      );
    }

    const answer = entry as Record<string, unknown>;
    const itemId = answer.item_id;
    const value = answer.value;

    if (
      typeof itemId !== "string" ||
      itemId.trim().length < 1 ||
      itemId.length > 128 ||
      typeof value !== "string" ||
      value.length > 5000 ||
      seenItems.has(itemId)
    ) {
      return responseError(
        c,
        422,
        "VALIDATION_ERROR",
        "Item assessment tidak valid atau duplikat",
        requestId,
      );
    }

    seenItems.add(itemId);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Konfigurasi server belum siap",
      requestId,
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data, error } = await admin.rpc("b05_create_assessment_attempt", {
      p_student_session_id: auth.session.id,
      p_quest_version_id: questVersionId,
      p_idempotency_key: idempotencyKey,
      p_answers: answers,
    });

    if (error) {
      if (error.code === "23505") {
        return responseError(
          c,
          409,
          "CONFLICT",
          "Idempotency key sudah digunakan untuk submission berbeda",
          requestId,
        );
      }

      if (error.code === "22023" || error.code === "22P02") {
        return responseError(
          c,
          422,
          "VALIDATION_ERROR",
          "Data assessment tidak valid",
          requestId,
        );
      }

      if (error.code === "42501" || error.code === "23503") {
        return responseError(
          c,
          401,
          "UNAUTHORIZED",
          "Sesi siswa tidak aktif",
          requestId,
        );
      }

      console.error("[B-05] Assessment persistence failed", {
        requestId,
        code: error.code,
      });

      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Gagal menyimpan assessment",
        requestId,
      );
    }

    const result: unknown = Array.isArray(data) ? data[0] : null;

    if (
      typeof result !== "object" ||
      result === null ||
      Array.isArray(result)
    ) {
      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Respons penyimpanan assessment tidak valid",
        requestId,
      );
    }

    const attempt = result as Record<string, unknown>;

    if (
      typeof attempt.attempt_id !== "string" ||
      attempt.status !== "pending_scoring" ||
      typeof attempt.replayed !== "boolean"
    ) {
      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Status assessment tidak valid",
        requestId,
      );
    }

    return c.json(
      {
        ok: true,
        data: {
          attempt_id: attempt.attempt_id,
          status: "pending_scoring",
          replayed: attempt.replayed,
        },
        request_id: requestId,
      },
      202,
    );
  } catch {
    console.error("[B-05] Unexpected assessment error", {
      requestId,
    });

    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Terjadi kesalahan server",
      requestId,
    );
  }
});

// B-05: Student checkpoint endpoints.
// These store unverified gameplay UI progress, not scoring evidence.

app.get("/checkpoints/:quest_version_id", async (c) => {
  const requestId = crypto.randomUUID();
  c.header("Cache-Control", "no-store");

  const auth = await authenticateStudentAccessCode(
    c.req.header("x-student-access-code"),
  );

  if (!auth.ok) {
    return auth.reason === "UNAUTHORIZED"
      ? responseError(
        c,
        401,
        "UNAUTHORIZED",
        "Sesi siswa tidak valid",
        requestId,
      )
      : responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Autentikasi tidak tersedia",
        requestId,
      );
  }

  const questVersionId = c.req.param("quest_version_id");

  if (!/^QV-[A-Z0-9-]+$/.test(questVersionId) || questVersionId.length > 100) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Quest version tidak valid",
      requestId,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Konfigurasi server belum siap",
      requestId,
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await admin
      .from("student_checkpoints")
      .select("id, revision, progress, updated_at")
      .eq("student_session_id", auth.session.id)
      .eq("quest_version_id", questVersionId)
      .maybeSingle();

    if (error) {
      console.error("[B-05] Checkpoint read failed", {
        requestId,
        code: error.code,
      });

      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Gagal memuat checkpoint",
        requestId,
      );
    }

    // No checkpoint is a normal state for a first-time player.
    return c.json({
      ok: true,
      data: {
        checkpoint: data
          ? {
            checkpoint_id: data.id,
            quest_version_id: questVersionId,
            revision: data.revision,
            progress: data.progress,
            updated_at: data.updated_at,
          }
          : null,
      },
      request_id: requestId,
    });
  } catch {
    console.error("[B-05] Unexpected checkpoint read error", {
      requestId,
    });

    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Terjadi kesalahan server",
      requestId,
    );
  }
});

app.put("/checkpoints/:quest_version_id", async (c) => {
  const requestId = crypto.randomUUID();
  c.header("Cache-Control", "no-store");

  const auth = await authenticateStudentAccessCode(
    c.req.header("x-student-access-code"),
  );

  if (!auth.ok) {
    return auth.reason === "UNAUTHORIZED"
      ? responseError(
        c,
        401,
        "UNAUTHORIZED",
        "Sesi siswa tidak valid",
        requestId,
      )
      : responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Autentikasi tidak tersedia",
        requestId,
      );
  }

  const questVersionId = c.req.param("quest_version_id");

  if (!/^QV-[A-Z0-9-]+$/.test(questVersionId) || questVersionId.length > 100) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Quest version tidak valid",
      requestId,
    );
  }

  // Check both declared and actual request size.
  const contentLength = Number(c.req.header("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > 20000) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Checkpoint terlalu besar",
      requestId,
    );
  }

  const raw = await c.req.text().catch(() => "");

  if (new TextEncoder().encode(raw).byteLength > 20000) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Checkpoint terlalu besar",
      requestId,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "JSON tidak valid",
      requestId,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Body tidak valid",
      requestId,
    );
  }

  const body = parsed as Record<string, unknown>;
  const expectedRevision = body.expected_revision;
  const progress = body.progress;

  if (
    typeof expectedRevision !== "number" ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    typeof progress !== "object" ||
    progress === null ||
    Array.isArray(progress)
  ) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Revision atau progress tidak valid",
      requestId,
    );
  }

  if (new TextEncoder().encode(JSON.stringify(progress)).byteLength > 16384) {
    return responseError(
      c,
      422,
      "VALIDATION_ERROR",
      "Progress terlalu besar",
      requestId,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Konfigurasi server belum siap",
      requestId,
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await admin.rpc("b05_save_student_checkpoint", {
      p_student_session_id: auth.session.id,
      p_quest_version_id: questVersionId,
      p_expected_revision: expectedRevision,
      p_progress: progress,
    });

    if (error) {
      if (
        error.code === "P0001" &&
        error.message.includes("B05_CHECKPOINT_REVISION_CONFLICT")
      ) {
        return responseError(
          c,
          409,
          "CONFLICT",
          "Checkpoint sudah berubah. Muat progres terbaru sebelum menyimpan.",
          requestId,
        );
      }

      if (error.code === "22023" || error.code === "22P02") {
        return responseError(
          c,
          422,
          "VALIDATION_ERROR",
          "Checkpoint tidak valid",
          requestId,
        );
      }

      if (error.code === "42501") {
        return responseError(
          c,
          401,
          "UNAUTHORIZED",
          "Sesi siswa tidak aktif",
          requestId,
        );
      }

      console.error("[B-05] Checkpoint save failed", {
        requestId,
        code: error.code,
      });

      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Gagal menyimpan checkpoint",
        requestId,
      );
    }

    const checkpoint = Array.isArray(data) ? data[0] : null;

    if (
      !checkpoint ||
      typeof checkpoint.checkpoint_id !== "string" ||
      !Number.isSafeInteger(Number(checkpoint.revision))
    ) {
      return responseError(
        c,
        500,
        "INTERNAL_ERROR",
        "Respons checkpoint tidak valid",
        requestId,
      );
    }

    return c.json({
      ok: true,
      data: {
        checkpoint: {
          checkpoint_id: checkpoint.checkpoint_id,
          quest_version_id: questVersionId,
          revision: Number(checkpoint.revision),
          progress: checkpoint.progress,
          updated_at: checkpoint.updated_at,
        },
      },
      request_id: requestId,
    });
  } catch {
    console.error("[B-05] Unexpected checkpoint save error", {
      requestId,
    });

    return responseError(
      c,
      500,
      "INTERNAL_ERROR",
      "Terjadi kesalahan server",
      requestId,
    );
  }
});

Deno.serve(app.fetch);
