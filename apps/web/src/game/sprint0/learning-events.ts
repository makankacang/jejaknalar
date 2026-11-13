/** Public client event: the server attaches authenticated student identity. */
export type EventType='QUEST_STARTED'|'DOCUMENT_READ'|'NPC_INTERACTED'|'EVIDENCE_SELECTED'|'ANSWER_SUBMITTED'|'HINT_REQUESTED'|'FEEDBACK_VIEWED'|'CHALLENGE_RETRIED'|'QUEST_COMPLETED';
export interface LearningEvent {
 eventId:string;attemptId:string;questVersionId:string;objectiveId?:string;
 eventType:EventType;occurredAt:string;payload:Record<string,string|number|boolean|null>;
}
export type LearningEventDraft=Omit<LearningEvent,'eventId'|'occurredAt'>;
export function makeLearningEvent(draft:LearningEventDraft, id:string, nowIso:string):LearningEvent{
 if(!id||!draft.attemptId||!draft.questVersionId)throw new Error('Identitas event wajib ada');
 if(Number.isNaN(Date.parse(nowIso)))throw new Error('Timestamp tidak valid');
 return {...draft,eventId:id,occurredAt:nowIso};
}
