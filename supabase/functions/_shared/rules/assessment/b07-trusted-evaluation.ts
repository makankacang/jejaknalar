/**
 * B07 trusted-evaluator boundary.
 *
 * This module NEVER evaluates the meaning of a student's answer. It only
 * validates criterion points produced by a separate, trusted server-side
 * evaluator and normalizes the score using the private rubric.
 *
 * The worker must remain fail-closed until that evaluator, its provenance,
 * and the lease-token-protected DB finalization are implemented and tested.
 */
import {
  normalizeAssessmentPoints,
  type NormalizedAssessmentResult,
  type RubricCriterion,
} from "./b07-score-normalization.ts";
import type { ScoringAnswer, ScoringItem } from "./b07-scoring-input.ts";

type PreparedScoring = {
  items: ScoringItem[];
  answers: ScoringAnswer[];
  missing_item_ids: string[];
};

export type ValidatedEvaluation = {
  item_id: string;
  objective_id: string;
  outcome: NormalizedAssessmentResult["outcome"];
  score: number | null;
  earned_points: number | null;
  max_points: number;
  feedback: string[];
  evidence: string[];
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function stringList(
  value: unknown,
  label: string,
  maxEntries: number,
  maxSize: number,
): string[] {
  if (
    !Array.isArray(value) || value.length > maxEntries ||
    value.some((v) => typeof v !== "string" || v.length > maxSize)
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return value as string[];
}

/**
 * Every item and criterion must exactly match the immutable server-only
 * private_spec. Never accept criterion weights, scores or objective IDs from
 * the browser or use model-provided totals as authoritative.
 */
export function validateTrustedEvaluations(
  prepared: PreparedScoring,
  privateSpec: unknown,
  evaluations: unknown,
): ValidatedEvaluation[] {
  if (
    !isRecord(privateSpec) || !Array.isArray(privateSpec.items) ||
    !Array.isArray(prepared?.items) || !Array.isArray(prepared.answers) ||
    !Array.isArray(evaluations) || prepared.items.length === 0 ||
    prepared.items.length !== privateSpec.items.length ||
    evaluations.length !== prepared.items.length
  ) {
    throw new Error("Invalid evaluator batch");
  }
  const rubricByItem = new Map<string, RubricCriterion[]>();
  for (const raw of privateSpec.items) {
    if (
      !isRecord(raw) || typeof raw.item_id !== "string" ||
      rubricByItem.has(raw.item_id) || !Array.isArray(raw.rubric) ||
      raw.rubric.length === 0 || raw.rubric.length > 50
    ) {
      throw new Error("Invalid rubric item");
    }
    const criteria: RubricCriterion[] = [];
    const names = new Set<string>();
    for (const entry of raw.rubric) {
      if (
        !isRecord(entry) || typeof entry.criterion !== "string" ||
        entry.criterion.length > 100 || !entry.criterion.trim() ||
        names.has(entry.criterion) || typeof entry.points !== "number" ||
        !Number.isSafeInteger(entry.points) || entry.points < 1 ||
        entry.points > 10000
      ) {
        throw new Error("Invalid private rubric criterion");
      }
      names.add(entry.criterion);
      criteria.push({ criterion: entry.criterion, points: entry.points });
    }
    rubricByItem.set(raw.item_id, criteria);
  }
  const answers = new Map(prepared.answers.map((a) => [a.item_id, a.value]));
  const expected = new Map(prepared.items.map((item) => [item.item_id, item]));
  if (
    expected.size !== prepared.items.length ||
    rubricByItem.size !== expected.size ||
    [...rubricByItem.keys()].some((id) => !expected.has(id))
  ) {
    throw new Error("Rubric/assessment item mismatch");
  }

  const seen = new Set<string>();
  const result: ValidatedEvaluation[] = [];
  for (const raw of evaluations) {
    if (
      !isRecord(raw) || typeof raw.item_id !== "string" ||
      seen.has(raw.item_id) || !expected.has(raw.item_id)
    ) {
      throw new Error("Invalid evaluator item identity");
    }
    seen.add(raw.item_id);
    const item = expected.get(raw.item_id)!;
    const criteria = rubricByItem.get(raw.item_id)!;
    const total = criteria.reduce((n, c) => n + c.points, 0);
    if (total !== item.max_points) {
      throw new Error("Private rubric maximum does not match scoring item");
    }
    const feedback = stringList(raw.feedback, "feedback", 8, 1000);
    const evidence = stringList(raw.evidence, "evidence", 20, 1000);
    if (feedback.length === 0) throw new Error("Feedback is required");
    if (
      raw.evidence_status !== "sufficient" &&
      raw.evidence_status !== "insufficient_evidence"
    ) {
      throw new Error("Invalid evidence status");
    }
    // A blank or missing answer must never receive a numeric score.
    if (
      raw.evidence_status === "sufficient" &&
      !(answers.get(raw.item_id) ?? "").trim()
    ) {
      throw new Error("Empty answer cannot be scored");
    }
    const normalized = normalizeAssessmentPoints(
      criteria,
      raw.evidence_status,
      raw.awarded_points as Readonly<Record<string, number>> | null,
    );
    result.push({
      item_id: item.item_id,
      objective_id: item.objective_id,
      outcome: normalized.outcome,
      score: normalized.score,
      earned_points: normalized.earned_points,
      max_points: normalized.max_points,
      feedback,
      evidence,
    });
  }
  if (seen.size !== expected.size) throw new Error("Missing evaluator item");
  return result;
}
