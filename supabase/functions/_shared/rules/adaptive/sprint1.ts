/** Pure server rule. Thresholds are MVP hypotheses, not a diagnosis of a child. */
export type Path = 'needs_support' | 'developing' | 'ready_for_extension' | 'need_more_evidence';
export interface Evidence {
  objectiveId: string; activityId: string; correct: boolean; explanationVerified: boolean;
  hintsUsed: number; attemptCount: number; transfer: boolean;
}
export function recommend(objectiveId: string, records: readonly Evidence[]) {
  // Keep the last verified observation per activity. Repeated attempts are NOT independent evidence.
  const latest = new Map<string, Evidence>();
  for (const r of records) {
    if (r.objectiveId !== objectiveId) continue;
    if (!r.activityId || !Number.isInteger(r.hintsUsed) || r.hintsUsed < 0 || !Number.isInteger(r.attemptCount) || r.attemptCount < 1) throw new Error('INVALID_EVIDENCE');
    latest.set(r.activityId, r);
  }
  const evidence = [...latest.values()];
  const rate = evidence.length ? evidence.filter(e => e.correct && e.explanationVerified).length / evidence.length : 0;
  const independentTransfer = evidence.some(e => e.transfer && e.correct && e.explanationVerified && e.hintsUsed === 0 && e.attemptCount === 1);
  const supported = evidence.some(e => e.hintsUsed > 0 || e.attemptCount > 1);
  let path: Path = 'need_more_evidence';
  let reason = 'INSUFFICIENT_DISTINCT_ACTIVITIES';
  if (evidence.length >= 3) {
    if (rate < .5) { path = 'needs_support'; reason = 'REPEATED_EVIDENCE_DIFFICULTY'; }
    else if (rate >= .8 && independentTransfer && !supported) { path = 'ready_for_extension'; reason = 'CONSISTENT_INDEPENDENT_TRANSFER'; }
    else { path = 'developing'; reason = supported ? 'SUCCESS_WITH_SUPPORT_OR_RETRY' : 'PARTIAL_OR_UNVERIFIED_TRANSFER'; }
  }
  return { objectiveId, path, reasonCodes: [reason], evidenceCount: evidence.length, ruleVersion: 'picd-sprint1-v1' as const };
}
