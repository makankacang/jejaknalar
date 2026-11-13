// deno-lint-ignore-file no-import-prefix
import { type Context, Hono } from "npm:hono@4.6.14";
import { createClient } from "npm:@supabase/supabase-js@2.46.2";
import { validatePublicQuestV1 } from "../_shared/quest-validation.ts";

export const questPublishRoutes = new Hono();

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(
  c: Context,
  status: 401 | 404 | 409 | 422 | 500,
  code: string,
  message: string,
  requestId: string,
) {
  return c.json(
    { ok: false, error: { code, message }, request_id: requestId },
    status,
  );
}

questPublishRoutes.post("/publish", async (c) => {
  const requestId = crypto.randomUUID();

  const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") ?? "");

  if (!bearer) {
    return fail(c, 401, "UNAUTHORIZED", "Token guru diperlukan", requestId);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return fail(
      c,
      500,
      "INTERNAL_ERROR",
      "Konfigurasi server belum siap",
      requestId,
    );
  }

  const body: unknown = await c.req.json().catch(() => null);

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(c, 422, "VALIDATION_ERROR", "JSON tidak valid", requestId);
  }

  const input = body as Record<string, unknown>;
  const classId = input.class_id;
  const questVersionId = input.quest_version_id;

  // Never accept arbitrary quest content from the publishing request.
  const allowedKeys = new Set(["class_id", "quest_version_id"]);

  if (
    Object.keys(input).some((key) => !allowedKeys.has(key)) ||
    typeof classId !== "string" ||
    !uuid.test(classId) ||
    typeof questVersionId !== "string" ||
    questVersionId.length > 100 ||
    !/^QV-[A-Z0-9-]+$/.test(questVersionId)
  ) {
    return fail(
      c,
      422,
      "VALIDATION_ERROR",
      "class_id atau quest_version_id tidak valid",
      requestId,
    );
  }

  const teacherDb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${bearer[1]}` },
    },
  });

  const { data: identity, error: authError } = await teacherDb.auth.getUser(
    bearer[1],
  );

  if (authError || !identity.user) {
    return fail(c, 401, "UNAUTHORIZED", "Sesi guru tidak valid", requestId);
  }

  // Teacher JWT + class RLS enforce ownership.
  const { data: ownedClass, error: classError } = await teacherDb
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    return fail(
      c,
      500,
      "INTERNAL_ERROR",
      "Gagal memverifikasi kelas",
      requestId,
    );
  }

  if (!ownedClass) {
    return fail(c, 404, "NOT_FOUND", "Kelas tidak ditemukan", requestId);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Only an approved draft belonging to this teacher and class is usable.
  const { data: draft, error: draftError } = await admin
    .from("quest_review_drafts")
    .select("quest_id,quest_version_id,public_payload")
    .eq("class_id", classId)
    .eq("quest_version_id", questVersionId)
    .eq("approved_by", identity.user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (draftError) {
    console.error("[B06] Approved draft lookup failed", {
      requestId,
      code: draftError.code,
    });

    return fail(
      c,
      500,
      "INTERNAL_ERROR",
      "Gagal memverifikasi persetujuan quest",
      requestId,
    );
  }

  if (!draft) {
    return fail(
      c,
      404,
      "NOT_FOUND",
      "Draft yang disetujui tidak ditemukan",
      requestId,
    );
  }

  const quest = validatePublicQuestV1(draft.public_payload);

  if (
    !quest ||
    quest.quest_id !== draft.quest_id ||
    quest.quest_version_id !== draft.quest_version_id
  ) {
    return fail(
      c,
      422,
      "VALIDATION_ERROR",
      "Konten draft approved tidak valid",
      requestId,
    );
  }

  // Insert the exact reviewed payload, not content provided by the client.
  // The database trigger independently checks approval and equality.
  const { data: published, error: insertError } = await admin
    .from("published_quest_versions")
    .insert({
      class_id: classId,
      quest_id: draft.quest_id,
      quest_version_id: draft.quest_version_id,
      approved_by: identity.user.id,
      public_payload: draft.public_payload,
    })
    .select("quest_version_id,published_at")
    .single();

  if (insertError?.code === "23505") {
    return fail(
      c,
      409,
      "CONFLICT",
      "Versi quest sudah pernah diterbitkan",
      requestId,
    );
  }

  if (insertError?.code === "42501") {
    return fail(
      c,
      409,
      "CONFLICT",
      "Persetujuan quest tidak lagi memenuhi syarat",
      requestId,
    );
  }

  if (insertError || !published) {
    console.error("[B06] Quest publish failed", {
      requestId,
      code: insertError?.code,
    });

    return fail(c, 500, "INTERNAL_ERROR", "Gagal menerbitkan quest", requestId);
  }

  return c.json(
    {
      ok: true,
      data: {
        class_id: classId,
        quest_version_id: published.quest_version_id,
        published_at: published.published_at,
      },
      request_id: requestId,
    },
    201,
  );
});
