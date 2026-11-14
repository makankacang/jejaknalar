// Fail closed until a reviewed server-only scoring engine is implemented.
const SCORING_ENGINE_IMPLEMENTED = false;
// deno-lint-ignore no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2.46.2";
import { prepareAssessmentScoring } from "../_shared/rules/assessment/b07-scoring-input.ts";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
async function sameSecret(a: string, b: string) {
  const encode = (v: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  const [x, y] = await Promise.all([encode(a), encode(b)]);
  const left = new Uint8Array(x);
  const right = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
export async function handleAssessmentScoringRequest(
  req: Request,
): Promise<Response> {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const expected = Deno.env.get("ASSESSMENT_SCORING_WORKER_SECRET") ?? "";
  if (expected.length < 32) {
    return json(503, { ok: false, error: "WORKER_NOT_CONFIGURED" });
  }
  const supplied = req.headers.get("x-worker-secret") ?? "";
  if (
    !supplied || supplied.length > 512 ||
    !(await sameSecret(supplied, expected))
  ) return json(401, { ok: false, error: "UNAUTHORIZED" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return json(503, { ok: false, error: "DATABASE_NOT_CONFIGURED" });
  }
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (Deno.env.get("ASSESSMENT_SCORING_ENGINE_READY") !== "true") {
    return json(503, { ok: false, error: "SCORING_ENGINE_NOT_READY" });
  }
  if (!SCORING_ENGINE_IMPLEMENTED) {
    return json(503, { ok: false, error: "SCORING_ENGINE_NOT_IMPLEMENTED" });
  }
  const { data: claims, error: claimError } = await db.rpc(
    "b07_claim_scoring_attempt",
    { p_lease_seconds: 120 },
  );
  if (claimError) {
    return json(500, { ok: false, error: "SCORING_CLAIM_FAILED" });
  }
  const claim = Array.isArray(claims) ? claims[0] : null;
  if (!claim) return json(200, { ok: true, status: "idle" });
  if (
    typeof claim.attempt_id !== "string" ||
    typeof claim.claim_token !== "string"
  ) return json(500, { ok: false, error: "INVALID_SCORING_CLAIM" });
  const { data: attempt, error: attemptError } = await db.from(
    "assessment_attempts",
  ).select("id,student_session_id,quest_version_id,answers,status").eq(
    "id",
    claim.attempt_id,
  ).eq("status", "pending_scoring").maybeSingle();
  if (attemptError || !attempt) {
    return json(409, { ok: false, error: "CLAIMED_ATTEMPT_UNAVAILABLE" });
  }
  const { data: session, error: sessionError } = await db.from(
    "student_sessions",
  ).select("class_id").eq("id", attempt.student_session_id).maybeSingle();
  if (sessionError || !session) {
    return json(409, { ok: false, error: "SESSION_MISMATCH" });
  }
  const { data: quest, error: questError } = await db.from(
    "published_quest_versions",
  ).select("public_payload").eq("quest_version_id", attempt.quest_version_id)
    .eq("class_id", session.class_id).maybeSingle();
  if (questError || !quest) {
    return json(409, { ok: false, error: "PUBLISHED_QUEST_MISMATCH" });
  }
  const { data: rubric, error: rubricError } = await db.from(
    "assessment_rubric_versions",
  ).select("id,private_spec").eq("quest_version_id", attempt.quest_version_id)
    .order("revision", { ascending: false }).limit(1).maybeSingle();
  if (rubricError) {
    return json(500, { ok: false, error: "RUBRIC_LOOKUP_FAILED" });
  }
  if (!rubric) return json(200, { ok: true, status: "awaiting_rubric" });
  let prepared;
  try {
    prepared = prepareAssessmentScoring(
      quest.public_payload,
      rubric.private_spec,
      attempt.answers,
    );
  } catch {
    return json(409, { ok: false, error: "SCORING_INPUT_MISMATCH" });
  }
  return json(503, {
    ok: false,
    error: "SCORING_ENGINE_NOT_READY",
    validated_item_count: prepared.items.length,
    missing_item_count: prepared.missing_item_ids.length,
  });
}

if (import.meta.main) Deno.serve(handleAssessmentScoringRequest);
