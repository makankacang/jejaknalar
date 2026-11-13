/**
 * B08: Deterministic BedaJalur decision.
 *
 * The caller MUST supply a trusted, persisted assessment result.
 * This function does not score answers or read client checkpoints.
 *
 * Thresholds are explicit because the final policy is not locked.
 */

export type AssessmentStatus =
  | "pending_scoring"
  | "scored"
  | "insufficient_evidence";

export type BedaJalurPath =
  | "needs_support"
  | "developing"
  | "ready_for_extension";

export interface BedaJalurPolicy {
  version: string;
  developing_min_score: number;
  extension_min_score: number;
}

export interface BedaJalurInput {
  status: AssessmentStatus;
  score: number | null;
}

export interface BedaJalurDecision {
  next_path: BedaJalurPath | null;
  decision_status: "decided" | "pending_scoring" | "insufficient_evidence";
  policy_version: string;
}

export function decideBedaJalur(
  input: BedaJalurInput,
  policy: BedaJalurPolicy,
): BedaJalurDecision {
  if (
    !policy ||
    typeof policy.version !== "string" ||
    policy.version.trim().length === 0 ||
    !Number.isInteger(policy.developing_min_score) ||
    !Number.isInteger(policy.extension_min_score) ||
    policy.developing_min_score < 1 ||
    policy.extension_min_score > 100 ||
    policy.developing_min_score >= policy.extension_min_score
  ) {
    throw new Error("Invalid BedaJalur policy");
  }

  if (input.status === "pending_scoring") {
    if (input.score !== null) {
      throw new Error("Pending assessment cannot have a score");
    }

    return {
      next_path: null,
      decision_status: "pending_scoring",
      policy_version: policy.version,
    };
  }

  if (input.status === "insufficient_evidence") {
    if (input.score !== null) {
      throw new Error("Insufficient evidence cannot have a score");
    }

    return {
      next_path: null,
      decision_status: "insufficient_evidence",
      policy_version: policy.version,
    };
  }

  if (input.status !== "scored") {
    throw new Error("Unknown assessment status");
  }

  if (
    !Number.isInteger(input.score) ||
    input.score === null ||
    input.score < 0 ||
    input.score > 100
  ) {
    throw new Error("Invalid official assessment score");
  }

  let nextPath: BedaJalurPath;

  if (input.score < policy.developing_min_score) {
    nextPath = "needs_support";
  } else if (input.score < policy.extension_min_score) {
    nextPath = "developing";
  } else {
    nextPath = "ready_for_extension";
  }

  return {
    next_path: nextPath,
    decision_status: "decided",
    policy_version: policy.version,
  };
}
