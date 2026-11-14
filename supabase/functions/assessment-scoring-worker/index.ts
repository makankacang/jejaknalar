/** B07 scoring worker: server-only, claim-token protected, disabled by default. */
// deno-lint-ignore-file no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2.46.2";
import type { AIModel } from "../_shared/ai/core/model.ts";
import { GeminiRestModel } from "../_shared/ai/learning-analyzer/gemini-rest-model.ts";
import { OpenRouterModel } from "../_shared/ai/providers/openrouter-model.ts";
import { publicObjectiveUuids } from "../_shared/rules/assessment/b07-verified-source.ts";
import { runVerifiedClaimedScoring } from "../_shared/rules/assessment/b07-worker-pipeline.ts";

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

function scoringModel(): AIModel | null {
  const provider = Deno.env.get("AI_PROVIDER")?.trim().toLowerCase() ||
    "gemini";
  if (provider === "gemini") {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL");
    return apiKey && model
      ? new GeminiRestModel({ apiKey, model, timeoutMs: 60_000 })
      : null;
  }
  if (provider === "openrouter") {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_MODEL");
    return apiKey && model
      ? new OpenRouterModel({ apiKey, model, timeoutMs: 60_000 })
      : null;
  }
  return null;
}

/** Model is injectable ONLY for offline tests; HTTP clients cannot supply it. */
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
  ) {
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return json(503, { ok: false, error: "DATABASE_NOT_CONFIGURED" });
  }
  // BOTH flags default off. Verify deployment of the immutability migration,
  // privacy/academic approval, and PostgreSQL concurrency tests before enabling.
  if (Deno.env.get("ASSESSMENT_SCORING_ENGINE_READY") !== "true") {
    return json(503, { ok: false, error: "SCORING_ENGINE_NOT_READY" });
  }
  if (Deno.env.get("ASSESSMENT_SCORING_SOURCE_IMMUTABLE_READY") !== "true") {
    return json(503, { ok: false, error: "SCORING_SOURCE_NOT_READY" });
  }
  let model: AIModel;
  try {
    const configured = scoringModel();
    if (!configured) {
      return json(503, { ok: false, error: "SCORING_MODEL_NOT_CONFIGURED" });
    }
    model = configured;
    if (!model || typeof model.generateStructuredOutput !== "function") {
      return json(503, { ok: false, error: "SCORING_MODEL_NOT_CONFIGURED" });
    }
  } catch {
    return json(503, { ok: false, error: "SCORING_MODEL_NOT_CONFIGURED" });
  }

  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  ) {
    return json(500, { ok: false, error: "INVALID_SCORING_CLAIM" });
  }
  const { data: attempt, error: attemptError } = await db.from(
    "assessment_attempts",
  )
    .select("id,student_session_id,quest_version_id,answers,status")
    .eq("id", claim.attempt_id).eq("status", "pending_scoring").maybeSingle();
  if (attemptError || !attempt) {
    return json(409, { ok: false, error: "CLAIMED_ATTEMPT_UNAVAILABLE" });
  }
  const { data: session, error: sessionError } = await db.from(
    "student_sessions",
  )
    .select("class_id").eq("id", attempt.student_session_id).maybeSingle();
  if (sessionError || !session) {
    return json(409, { ok: false, error: "SESSION_MISMATCH" });
  }
  const { data: quest, error: questError } = await db.from(
    "published_quest_versions",
  )
    .select("public_payload,approved_by").eq(
      "quest_version_id",
      attempt.quest_version_id,
    )
    .eq("class_id", session.class_id).maybeSingle();
  if (questError || !quest) {
    return json(409, { ok: false, error: "PUBLISHED_QUEST_MISMATCH" });
  }
  const { data: rubric, error: rubricError } = await db.from(
    "assessment_rubric_versions",
  )
    .select("id,private_spec,registered_by").eq(
      "quest_version_id",
      attempt.quest_version_id,
    )
    .order("revision", { ascending: false }).limit(1).maybeSingle();
  if (rubricError) {
    return json(500, { ok: false, error: "RUBRIC_LOOKUP_FAILED" });
  }
  if (!rubric || rubric.registered_by !== quest.approved_by) {
    return json(409, { ok: false, error: "SCORING_RUBRIC_UNVERIFIED" });
  }

  let objectiveIds: string[];
  try {
    objectiveIds = publicObjectiveUuids(quest.public_payload);
  } catch {
    return json(409, { ok: false, error: "SCORING_SOURCE_UNVERIFIED" });
  }
  const { data: objectives, error: objectiveError } = await db.from(
    "learning_objectives",
  )
    .select("id,module_id,text_version,review_status").in("id", objectiveIds);
  if (
    objectiveError || !objectives || objectives.length !== objectiveIds.length
  ) {
    return json(409, { ok: false, error: "SCORING_SOURCE_UNVERIFIED" });
  }
  const first = objectives[0];
  if (
    !first || typeof first.module_id !== "string" ||
    typeof first.text_version !== "string"
  ) {
    return json(409, { ok: false, error: "SCORING_SOURCE_UNVERIFIED" });
  }
  const { data: ownerModule, error: moduleError } = await db.from("modules")
    .select("id,owner_uid").eq("id", first.module_id).maybeSingle();
  if (moduleError || !ownerModule) {
    return json(409, { ok: false, error: "SCORING_SOURCE_UNVERIFIED" });
  }
  const { data: snapshot, error: sourceError } = await db.from(
    "module_text_versions",
  )
    .select("module_id,text_version,extracted_text")
    .eq("text_version", first.text_version).eq("module_id", first.module_id)
    .maybeSingle();
  if (sourceError || !snapshot) {
    return json(409, { ok: false, error: "SCORING_SOURCE_UNVERIFIED" });
  }
  try {
    const result = await runVerifiedClaimedScoring({
      db: {
        rpc: async (name, args) => {
          const { data, error } = await db.rpc(name, args);
          return { data, error };
        },
      },
      claim,
      questPayload: quest.public_payload,
      publishedApprovedBy: quest.approved_by,
      answers: attempt.answers,
      rubricId: rubric.id,
      privateSpec: rubric.private_spec,
      objectiveRows: objectives,
      moduleRow: ownerModule,
      snapshotRow: snapshot,
      model,
      engineVersion: "b07-semantic-v1",
    });
    return json(200, {
      ok: true,
      status: result.status,
      replayed: result.replayed,
      attempt_id: result.attempt_id,
    });
  } catch {
    // Never expose AI/DB exception details, student answers, or rubric to callers.
    return json(503, {
      ok: false,
      error: "SCORING_VALIDATION_OR_FINALIZATION_FAILED",
    });
  }
}

if (import.meta.main) Deno.serve((req) => handleAssessmentScoringRequest(req));
