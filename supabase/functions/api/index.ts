/**
 * JejakNalar B-02 (Day 2): Supabase Edge Function `api`.
 * POST /functions/v1/api/classes  -> OpenAPI operation POST /classes
 *
 * Auth: Supabase teacher JWT validated with auth.getUser(token).
 * DB: PostgREST request uses the SAME user JWT so RLS applies.
 * Service-role credentials are never used here.
 * Only the class-creation endpoint is implemented in Day 2.
 */
import { Hono, type Context } from "npm:hono@4.6.14";
import { cors } from "npm:hono@4.6.14/cors";
import { createClient } from "npm:@supabase/supabase-js@2.46.2";

const app = new Hono().basePath("/api");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 unambiguous chars
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use("/*", cors({
  origin: (origin) => allowedOrigins.includes(origin) ? origin : "",
  allowHeaders: ["authorization", "apikey", "content-type", "x-client-info"],
  allowMethods: ["POST", "OPTIONS"],
}));

function generateClassCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b & 31]).join("");
}

function responseError(
  c: Context,
  status: 401 | 409 | 422 | 500,
  code: "UNAUTHORIZED" | "CONFLICT" | "VALIDATION_ERROR" | "INTERNAL_ERROR",
  message: string,
  requestId: string,
) {
  return c.json({ ok: false, error: { code, message }, request_id: requestId }, status);
}

app.post("/classes", async (c) => {
  const requestId = crypto.randomUUID();
  const authHeader = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader);
  if (!match) return responseError(c, 401, "UNAUTHORIZED", "Token guru diperlukan", requestId);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    console.error("[JejakNalar] Missing Supabase server environment", requestId);
    return responseError(c, 500, "INTERNAL_ERROR", "Konfigurasi server belum siap", requestId);
  }

  const token = match[1];
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Never trust a decoded, unverified JWT, and never use the service-role key here.
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return responseError(c, 401, "UNAUTHORIZED", "Sesi guru tidak valid", requestId);
  }

  const parsed: unknown = await c.req.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return responseError(c, 422, "VALIDATION_ERROR", "JSON request tidak valid", requestId);
  }
  const body = parsed as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const grade = body.grade;
  if (name.length < 1 || name.length > 80 ||
      !Number.isInteger(grade) || (grade as number) < 7 || (grade as number) > 9) {
    return responseError(c, 422, "VALIDATION_ERROR", "name harus 1–80 karakter dan grade harus 7, 8, atau 9", requestId);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from("classes")
      .insert({ teacher_uid: userData.user.id, name, grade, class_code: generateClassCode() })
      .select("id,name,grade,class_code")
      .single();

    if (!error && data) {
      return c.json({
        ok: true,
        data: {
          class_id: data.id,
          class_code: data.class_code,
          name: data.name,
          grade: data.grade,
        },
        request_id: requestId,
      }, 201);
    }
    if (error?.code === "23505") continue; // Extremely unlikely class_code collision.
    console.error("[JejakNalar] createClass database error", { requestId, code: error?.code });
    return responseError(c, 500, "INTERNAL_ERROR", "Kelas gagal dibuat", requestId);
  }
  return responseError(c, 409, "CONFLICT", "Gagal mengalokasikan kode kelas, coba lagi", requestId);
});

Deno.serve(app.fetch);
