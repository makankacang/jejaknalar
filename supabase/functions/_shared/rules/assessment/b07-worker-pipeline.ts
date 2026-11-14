/** Pure, testable orchestration boundary; no DB or model providers are created here. */
import type { AIModel } from "../../ai/core/model.ts";
import { prepareAssessmentScoring } from "./b07-scoring-input.ts";
import { evaluateAssessmentSemantically } from "./b07-semantic-evaluator.ts";
import {
  type FinalizationRpc,
  finalizeClaimedAssessment,
  type ScoringClaim,
} from "./b07-claimed-finalization.ts";
import { verifyApprovedSource } from "./b07-verified-source.ts";

export async function runVerifiedClaimedScoring(input: {
  db: FinalizationRpc;
  claim: ScoringClaim;
  questPayload: unknown;
  publishedApprovedBy: unknown;
  answers: unknown;
  rubricId: string;
  privateSpec: unknown;
  objectiveRows: unknown;
  moduleRow: unknown;
  snapshotRow: unknown;
  model: AIModel;
  engineVersion: string;
}) {
  // Authorization/provenance before contacting an AI provider or finalizing a grade.
  const verifiedSourceText = verifyApprovedSource({
    questPayload: input.questPayload,
    publishedApprovedBy: input.publishedApprovedBy,
    objectiveRows: input.objectiveRows,
    moduleRow: input.moduleRow,
    snapshotRow: input.snapshotRow,
  });
  const prepared = prepareAssessmentScoring(
    input.questPayload,
    input.privateSpec,
    input.answers,
  );
  const evaluations = await evaluateAssessmentSemantically(
    prepared,
    input.privateSpec,
    verifiedSourceText,
    input.model,
  );
  return await finalizeClaimedAssessment(
    input.db,
    input.claim,
    input.rubricId,
    evaluations,
    input.engineVersion,
  );
}
