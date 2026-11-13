/**
 * B07: Normalize trusted rubric criterion points to a 0–100 score.
 *
 * This does NOT evaluate student answers.
 * Criterion points must come from a trusted scoring engine.
 */

export interface RubricCriterion {
  criterion: string;
  points: number;
}

export type NormalizedAssessmentResult =
  | {
    outcome: "scored";
    score: number;
    earned_points: number;
    max_points: number;
  }
  | {
    outcome: "insufficient_evidence";
    score: null;
    earned_points: null;
    max_points: number;
  };

export function normalizeAssessmentPoints(
  criteria: readonly RubricCriterion[],
  evidenceStatus: "sufficient" | "insufficient_evidence",
  awardedPoints: Readonly<Record<string, number>> | null,
): NormalizedAssessmentResult {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new Error("Rubric must contain at least one criterion");
  }

  const criterionNames = new Set<string>();
  let maxPoints = 0;

  for (const criterion of criteria) {
    if (
      typeof criterion.criterion !== "string" ||
      criterion.criterion.trim().length === 0 ||
      criterionNames.has(criterion.criterion) ||
      !Number.isFinite(criterion.points) ||
      criterion.points <= 0
    ) {
      throw new Error("Invalid rubric criterion");
    }

    criterionNames.add(criterion.criterion);
    maxPoints += criterion.points;
  }

  if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
    throw new Error("Invalid rubric maximum points");
  }

  if (evidenceStatus === "insufficient_evidence") {
    if (awardedPoints !== null) {
      throw new Error("Insufficient evidence must not have awarded points");
    }

    return {
      outcome: "insufficient_evidence",
      score: null,
      earned_points: null,
      max_points: maxPoints,
    };
  }

  if (evidenceStatus !== "sufficient") {
    throw new Error("Unknown evidence status");
  }

  if (
    awardedPoints === null ||
    typeof awardedPoints !== "object" ||
    Array.isArray(awardedPoints)
  ) {
    throw new Error("Scored assessment requires criterion points");
  }

  const suppliedNames = Object.keys(awardedPoints);

  if (
    suppliedNames.length !== criterionNames.size ||
    suppliedNames.some((name) => !criterionNames.has(name))
  ) {
    throw new Error("Missing or unknown scoring criterion");
  }

  let earnedPoints = 0;

  for (const criterion of criteria) {
    const earned = awardedPoints[criterion.criterion];

    if (!Number.isFinite(earned) || earned < 0 || earned > criterion.points) {
      throw new Error("Criterion points outside allowed range");
    }

    earnedPoints += earned;
  }

  return {
    outcome: "scored",
    score: Math.round((100 * earnedPoints) / maxPoints),
    earned_points: earnedPoints,
    max_points: maxPoints,
  };
}
