/**
 * B07: lease-claim-protected finalization of already-validated evaluator output.
 *
 * This module does not query students, read rubrics, resolve source text, or
 * evaluate answers. Callers must bind all of those to an immutable approved
 * published quest before calling this module. No direct unclaimed finalizer.
 */
import type { ValidatedEvaluation } from "./b07-trusted-evaluation.ts";

export interface ScoringClaim {
  attempt_id: string;
  claim_token: string;
}

/** The only DB capability required by this module. */
export interface FinalizationRpc {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export interface ClaimedFinalization {
  attempt_id: string;
  status: "scored" | "insufficient_evidence";
  replayed: boolean;
  result_id: string;
}

export type FinalizationPayload = {
  outcome: "scored" | "insufficient_evidence";
  score: number | null;
  objective_results: Array<{
    item_id: string;
    objective_id: string;
    outcome: "scored" | "insufficient_evidence";
    score: number | null;
    earned_points: number | null;
    max_points: number;
  }>;
  feedback: Array<{ item_id: string; messages: string[] }>;
  evidence: Array<{ item_id: string; excerpts: string[] }>;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const bytes = (v: unknown) =>
  new TextEncoder().encode(JSON.stringify(v)).byteLength;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Do not use a model-reported aggregate score. Compute weighted totals from
 * validated per-item earned_points/max_points. A gradable partial submission
 * can score even if another item has insufficient evidence; missing items
 * contribute zero to the numerator and remain visible in objective_results.
 * All-insufficient is the only case that yields an overall null score.
 */
export function makeFinalizationPayload(
  evaluations: readonly ValidatedEvaluation[],
): FinalizationPayload {
  if (
    !Array.isArray(evaluations) || evaluations.length === 0 ||
    evaluations.length > 50
  ) throw new Error("INVALID_EVALUATION_BATCH");
  const seen = new Set<string>();
  let totalMax = 0;
  let earned = 0;
  let anyScored = false;
  const objective_results: FinalizationPayload["objective_results"] = [];
  const feedback: FinalizationPayload["feedback"] = [];
  const evidence: FinalizationPayload["evidence"] = [];
  for (const e of evaluations) {
    if (
      !e || !text(e.item_id, 100) || !text(e.objective_id, 150) ||
      seen.has(e.item_id) || !Number.isSafeInteger(e.max_points) ||
      e.max_points < 1 || e.max_points > 10_000 ||
      !Array.isArray(e.feedback) || e.feedback.length < 1 ||
      e.feedback.length > 8 ||
      e.feedback.some((f: unknown) => !text(f, 1000)) ||
      !Array.isArray(e.evidence) || e.evidence.length > 20 ||
      e.evidence.some((v: unknown) => !text(v, 1000))
    ) {
      throw new Error("INVALID_EVALUATION_RESULT");
    }
    seen.add(e.item_id);
    totalMax += e.max_points;
    if (e.outcome === "scored") {
      if (
        typeof e.earned_points !== "number" ||
        !Number.isFinite(e.earned_points) ||
        e.earned_points < 0 || e.earned_points > e.max_points ||
        !Number.isInteger(e.score) ||
        e.score !== Math.round((e.earned_points * 100) / e.max_points)
      ) {
        throw new Error("INVALID_EVALUATION_SCORE");
      }
      anyScored = true;
      earned += e.earned_points;
    } else if (e.outcome === "insufficient_evidence") {
      if (e.score !== null || e.earned_points !== null) {
        throw new Error("INSUFFICIENT_EVIDENCE_MUST_HAVE_NULL_SCORE");
      }
    } else throw new Error("UNKNOWN_EVALUATION_OUTCOME");
    objective_results.push({
      item_id: e.item_id,
      objective_id: e.objective_id,
      outcome: e.outcome,
      score: e.score,
      earned_points: e.earned_points,
      max_points: e.max_points,
    });
    feedback.push({ item_id: e.item_id, messages: [...e.feedback] });
    evidence.push({ item_id: e.item_id, excerpts: [...e.evidence] });
  }
  if (
    !Number.isSafeInteger(totalMax) || totalMax < 1 ||
    !Number.isFinite(earned)
  ) throw new Error("INVALID_TOTAL_POINTS");
  if (
    bytes(objective_results) > 65536 || bytes(feedback) > 65536 ||
    bytes(evidence) > 131072
  ) throw new Error("FINALIZATION_PAYLOAD_TOO_LARGE");
  return {
    outcome: anyScored ? "scored" : "insufficient_evidence",
    score: anyScored ? Math.round((100 * earned) / totalMax) : null,
    objective_results,
    feedback,
    evidence,
  };
}

/**
 * Uses the claim-token-protected RPC ONLY, never the deprecated directly
 * executable b07_finalize_assessment_score. A DB error or malformed response
 * fails closed, and raw DB errors are not returned to the browser.
 */
export async function finalizeClaimedAssessment(
  db: FinalizationRpc,
  claim: ScoringClaim,
  rubricVersionId: string,
  evaluations: readonly ValidatedEvaluation[],
  engineVersion: string,
): Promise<ClaimedFinalization> {
  if (
    !db || typeof db.rpc !== "function" ||
    !uuid.test(claim?.attempt_id ?? "") ||
    !uuid.test(claim?.claim_token ?? "") ||
    !uuid.test(rubricVersionId) || !text(engineVersion, 100)
  ) {
    throw new Error("INVALID_FINALIZATION_CONTEXT");
  }
  const payload = makeFinalizationPayload(evaluations);
  const { data, error } = await db.rpc(
    "b07_finalize_claimed_assessment_score",
    {
      p_attempt_id: claim.attempt_id,
      p_claim_token: claim.claim_token,
      p_rubric_version_id: rubricVersionId,
      p_outcome: payload.outcome,
      p_score: payload.score,
      p_objective_results: payload.objective_results,
      p_feedback: payload.feedback,
      p_evidence: payload.evidence,
      p_engine_version: engineVersion,
    },
  );
  if (error) throw new Error("SCORING_FINALIZATION_REJECTED");
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new Error("INVALID_FINALIZATION_ACK");
  }
  const result = data[0];
  if (
    result.attempt_id !== claim.attempt_id ||
    result.status !== payload.outcome ||
    typeof result.replayed !== "boolean" ||
    typeof result.result_id !== "string" || !uuid.test(result.result_id)
  ) {
    throw new Error("FINALIZATION_ACK_MISMATCH");
  }
  return {
    attempt_id: claim.attempt_id,
    status: payload.outcome,
    replayed: result.replayed,
    result_id: result.result_id,
  };
}
