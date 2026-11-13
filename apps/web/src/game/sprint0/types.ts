/** PIC D internal mock model ONLY; not the team's approved JSON Schema. */
export type LearningPath = 'needs_support'|'developing'|'ready_for_extension'|'need_more_evidence';
export type QuestStep =
  | { id:string; type:'read_document'; documentRef:string }
  | { id:string; type:'talk_npc'; npcRef:string }
  | { id:string; type:'select_evidence'; itemRef:string }
  | { id:string; type:'make_inference'; itemRef:string };
export interface GameQuest {
  schemaVersion: 'picd-draft-0';
  questId: string;
  versionId: string;
  objectiveIds: string[];
  template: 'evidence_hunt';
  sceneId: string;
  steps: QuestStep[];
  variants: Record<Exclude<LearningPath,'need_more_evidence'>, string>;
}
export class QuestValidationError extends Error { constructor(message: string) { super(message);this.name='QuestValidationError'; } }
/** Validate the internal fixture; contract v1.0 mapping is PENDING REVIEW. */
export function parseInternalQuest(value:unknown):GameQuest {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new QuestValidationError('Quest bukan objek');
  const q=value as Record<string,unknown>;
  if(q.schemaVersion!=='picd-draft-0' || q.template!=='evidence_hunt') throw new QuestValidationError('Versi/template mock tidak valid');
  if(typeof q.questId!=='string'||!q.questId.trim()||typeof q.versionId!=='string'||!q.versionId.trim()) throw new QuestValidationError('ID wajib ada');
  if(typeof q.sceneId!=='string'||!q.sceneId.trim()||!Array.isArray(q.objectiveIds)||q.objectiveIds.length===0||!q.objectiveIds.every(x=>typeof x==='string'&&x.length>0)) throw new QuestValidationError('Objective/scene tidak valid');
  if(!Array.isArray(q.steps)||q.steps.length===0) throw new QuestValidationError('Quest membutuhkan step');
  const allowed=new Set(['read_document','talk_npc','select_evidence','make_inference']);
  const seen=new Set<string>();
  for(const raw of q.steps){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new QuestValidationError('Step tidak valid');
    const s=raw as Record<string,unknown>;
    if(typeof s.id!=='string'||!s.id||seen.has(s.id)||!allowed.has(String(s.type)))throw new QuestValidationError('Step ID/type tidak valid');
    seen.add(s.id);
    const field=s.type==='read_document'?'documentRef':s.type==='talk_npc'?'npcRef':'itemRef';
    if(typeof s[field]!=='string'||!s[field])throw new QuestValidationError('Ref step tidak valid');
  }
  const v=q.variants;
  if(!v||typeof v!=='object'||Array.isArray(v))throw new QuestValidationError('Varian tidak valid');
  for(const k of ['needs_support','developing','ready_for_extension']){
    if(typeof (v as Record<string,unknown>)[k]!=='string'||!(v as Record<string,string>)[k])throw new QuestValidationError('Varian '+k+' tidak valid');
  }
  return value as GameQuest;
}
