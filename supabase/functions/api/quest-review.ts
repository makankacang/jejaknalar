// deno-lint-ignore-file no-import-prefix
import { Hono } from "npm:hono@4.6.14";
import { createClient } from "npm:@supabase/supabase-js@2.46.2";
import { validatePublicQuestV1 } from "../_shared/quest-validation.ts";

export const questReviewRoutes = new Hono();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

questReviewRoutes.post("/drafts", async (c) => {
  const requestId = crypto.randomUUID();

  const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") ?? "");

  if (!bearer) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Token guru diperlukan",
        },
        request_id: requestId,
      },
      401,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return c.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Konfigurasi server belum siap",
        },
        request_id: requestId,
      },
      500,
    );
  }

  const raw = await c.req.text().catch(() => "");

  if (new TextEncoder().encode(raw).byteLength > 40000) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Draft terlalu besar",
        },
        request_id: requestId,
      },
      422,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "JSON draft tidak valid",
        },
        request_id: requestId,
      },
      422,
    );
  }

  const input = parsed as Record<string, unknown>;
  const classId = input.class_id;
  const quest = validatePublicQuestV1(input.quest);

  if (
    Object.keys(input).some((key) => key !== "class_id" && key !== "quest") ||
    typeof classId !== "string" ||
    !uuidPattern.test(classId) ||
    !quest ||
    quest.quest_id.length > 100 ||
    quest.quest_version_id.length > 100
  ) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Draft tidak sesuai kontrak",
        },
        request_id: requestId,
      },
      422,
    );
  }

  try {
    const teacherDb = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${bearer[1]}`,
        },
      },
    });

    const { data: identity, error: authError } = await teacherDb.auth.getUser(
      bearer[1],
    );

    if (authError || !identity.user) {
      return c.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Sesi guru tidak valid",
          },
          request_id: requestId,
        },
        401,
      );
    }

    const { data: ownedClass, error: classError } = await teacherDb
      .from("classes")
      .select("id")
      .eq("id", classId)
      .maybeSingle();

    if (classError) {
      return c.json(
        {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Gagal memverifikasi kelas",
          },
          request_id: requestId,
        },
        500,
      );
    }

    if (!ownedClass) {
      return c.json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Kelas tidak ditemukan",
          },
          request_id: requestId,
        },
        404,
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: draft, error: insertError } = await admin
      .from("quest_review_drafts")
      .insert({
        class_id: classId,
        quest_id: quest.quest_id,
        quest_version_id: quest.quest_version_id,
        submitted_by: identity.user.id,
        public_payload: quest,
        status: "pending_review",
      })
      .select("id,quest_version_id,status,created_at")
      .single();

    if (insertError?.code === "23505") {
      return c.json(
        {
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Versi quest sudah memiliki draft",
          },
          request_id: requestId,
        },
        409,
      );
    }

    if (insertError || !draft) {
      console.error("[B06] Draft creation failed", {
        requestId,
        code: insertError?.code,
      });

      return c.json(
        {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Gagal menyimpan draft",
          },
          request_id: requestId,
        },
        500,
      );
    }

    return c.json(
      {
        ok: true,
        data: draft,
        request_id: requestId,
      },
      201,
    );
  } catch {
    console.error("[B06] Unexpected draft error", { requestId });

    return c.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Terjadi kesalahan server",
        },
        request_id: requestId,
      },
      500,
    );
  }
});

/**
 * B06: Approve a pending quest draft.
 * Only the teacher who owns the draft's class may approve it.
 */
questReviewRoutes.post("/drafts/:id/approve", async (c) => {
  const requestId = crypto.randomUUID();
  c.header("Cache-Control", "no-store");

  const draftId = c.req.param("id");

  if (!uuidPattern.test(draftId)) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "ID draft tidak valid",
        },
        request_id: requestId,
      },
      422,
    );
  }

  const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") ?? "");

  if (!bearer) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Token guru diperlukan",
        },
        request_id: requestId,
      },
      401,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return c.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Konfigurasi server belum siap",
        },
        request_id: requestId,
      },
      500,
    );
  }

  try {
    const teacherDb = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${bearer[1]}`,
        },
      },
    });

    const { data: identity, error: authError } = await teacherDb.auth.getUser(
      bearer[1],
    );

    if (authError || !identity.user) {
      return c.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Sesi guru tidak valid",
          },
          request_id: requestId,
        },
        401,
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: draft, error: draftError } = await admin
      .from("quest_review_drafts")
      .select("id,class_id,status")
      .eq("id", draftId)
      .maybeSingle();

    if (draftError) {
      console.error("[B06] Draft lookup failed", {
        requestId,
        code: draftError.code,
      });

      return c.json(
        {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Gagal mengambil draft",
          },
          request_id: requestId,
        },
        500,
      );
    }

    if (!draft) {
      return c.json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Draft tidak ditemukan",
          },
          request_id: requestId,
        },
        404,
      );
    }

    // Verify ownership using the teacher's JWT and class RLS.
    const { data: ownedClass, error: classError } = await teacherDb
      .from("classes")
      .select("id")
      .eq("id", draft.class_id)
      .eq("teacher_uid", identity.user.id)
      .maybeSingle();

    if (classError) {
      return c.json(
        {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Gagal memverifikasi kelas",
          },
          request_id: requestId,
        },
        500,
      );
    }

    if (!ownedClass) {
      return c.json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Draft tidak ditemukan",
          },
          request_id: requestId,
        },
        404,
      );
    }

    if (draft.status !== "pending_review") {
      return c.json(
        {
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Draft sudah pernah disetujui",
          },
          request_id: requestId,
        },
        409,
      );
    }

    // Conditional update avoids approving the same draft twice.
    // The database trigger independently enforces class ownership,
    // the allowed state transition, and content immutability.
    const { data: approved, error: updateError } = await admin
      .from("quest_review_drafts")
      .update({
        status: "approved",
        approved_by: identity.user.id,
      })
      .eq("id", draftId)
      .eq("status", "pending_review")
      .select("id,quest_version_id,status,approved_at")
      .maybeSingle();

    if (updateError?.code === "42501") {
      return c.json(
        {
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Draft tidak dapat disetujui",
          },
          request_id: requestId,
        },
        409,
      );
    }

    if (updateError) {
      console.error("[B06] Draft approval failed", {
        requestId,
        code: updateError.code,
      });

      return c.json(
        {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Gagal menyetujui draft",
          },
          request_id: requestId,
        },
        500,
      );
    }

    if (!approved) {
      return c.json(
        {
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Status draft sudah berubah",
          },
          request_id: requestId,
        },
        409,
      );
    }

    return c.json(
      {
        ok: true,
        data: approved,
        request_id: requestId,
      },
      200,
    );
  } catch {
    console.error("[B06] Unexpected draft approval error", {
      requestId,
    });

    return c.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Terjadi kesalahan server",
        },
        request_id: requestId,
      },
      500,
    );
  }
});
