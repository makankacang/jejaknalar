/** Server-only BedaJalur candidate. Thresholds are HYPOTHESES to review with teachers. */
export type Path='needs_support'|'developing'|'ready_for_extension'|'need_more_evidence';
export interface VerifiedEvidence { objectiveId:string;activityId:string;correct:boolean;explanationVerified:boolean;hintsUsed:number;transfer:boolean; }
export interface AdaptiveDecision {objectiveId:string;path:Path;reasonCodes:string[];evidenceCount:number;ruleVersion:'picd-draft-0';}
export function recommendLearningPath(objectiveId:string, records:VerifiedEvidence[]):AdaptiveDecision {
 const evidence=records.filter(e=>e.objectiveId===objectiveId);
 const independentActivities=new Set(evidence.map(e=>e.activityId)).size;
 let path:Path='need_more_evidence';const reasons:string[]=[];
 if(independentActivities<3){reasons.push('INSUFFICIENT_DISTINCT_ACTIVITIES');}
 else {
  const success=evidence.filter(e=>e.correct&&e.explanationVerified).length/evidence.length;
  const transfer=evidence.some(e=>e.transfer&&e.correct&&e.explanationVerified);
  if(success<0.5){path='needs_support';reasons.push('REPEATED_EVIDENCE_DIFFICULTY');}
  else if(success>=0.8 && transfer){path='ready_for_extension';reasons.push('CONSISTENT_WITH_TRANSFER');}
  else {path='developing';reasons.push('PARTIAL_OR_UNVERIFIED_TRANSFER');}
 }
 return {objectiveId,path,reasonCodes:reasons,evidenceCount:evidence.length,ruleVersion:'picd-draft-0'};
}
