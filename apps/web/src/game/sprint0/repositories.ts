import { mockQuest } from './fixtures.js';
import { parseInternalQuest, type GameQuest, type LearningPath } from './types.js';
/** Internal presentation-side ports only; reconcile with v1.0 OpenAPI before integration. */
export interface QuestRepository { getPublishedQuest(questId:string):Promise<GameQuest>; }
export interface SubmissionInput { attempt_id:string;answers:Array<{item_id:string;response:string}>;idempotency_key:string; }
export interface PublicAssessmentFeedback {item_id:string;status:'review_required'|'feedback_ready';message:string;}
export interface AssessmentResult {attempt_id:string;feedback:PublicAssessmentFeedback[];next_path:LearningPath; provisional:boolean;}
export interface ApiSuccess<T>{ok:true;data:T;request_id:string;}
export interface AssessmentRepository {submitAnswers(input:SubmissionInput):Promise<ApiSuccess<AssessmentResult>>;}
export class MockQuestRepository implements QuestRepository {
 async getPublishedQuest(id:string){if(id!==mockQuest.questId)throw new Error('QUEST_NOT_FOUND');return parseInternalQuest(mockQuest);}
}
/** Synthetic fixture response. NOT real scoring. Never ship as production validation. */
export class MockAssessmentRepository implements AssessmentRepository {
 constructor(private readonly path:LearningPath='need_more_evidence'){}
 async submitAnswers(input:SubmissionInput):Promise<ApiSuccess<AssessmentResult>>{
  if(!input.attempt_id||!input.idempotency_key||input.answers.length===0)throw new Error('INVALID_SUBMISSION');
  return {ok:true,request_id:'mock-request',data:{attempt_id:input.attempt_id,
   feedback:input.answers.map(a=>({item_id:a.item_id,status:'review_required' as const,message:'Jawaban diterima untuk simulasi. Penilaian resmi dilakukan server.'})),
   next_path:this.path,provisional:true}};
 }
}
