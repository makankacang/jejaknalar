/** PIC C quest-generation boundary. The public payload stays Quest Schema v1.0. */

export interface ApprovedLearningObjective {
  /** Persistent ID assigned by PIC B after teacher approval. */
  id: string;
  statement: string;
}

export interface QuestGenerationIdentity {
  /** IDs are supplied by the backend; the model must never invent persistent IDs. */
  quest_id: string;
  quest_version_id: string;
}

export interface QuestGenerationInput {
  identity: QuestGenerationIdentity;
  objectives: ApprovedLearningObjective[];
}

export interface QuestStepV1 {
  id: string;
  type: 'read_document' | 'select_evidence';
  ref?: string;
  item_id?: string;
}

export interface QuestPayloadV1 {
  schema_version: '1.0';
  quest_id: string;
  quest_version_id: string;
  objective_ids: string[];
  template: 'evidence_hunt';
  scene_id: string;
  steps: QuestStepV1[];
  variants: {
    needs_support: string;
    developing: string;
    ready_for_extension: string;
  };
}

export type QuestGenerationWarningCode =
  | 'COMPATIBILITY_SCAFFOLD_ONLY'
  | 'STATIC_SCENE_CONTENT'
  | 'NO_DYNAMIC_ASSESSMENT_CONTENT';

export interface QuestGenerationWarning {
  code: QuestGenerationWarningCode;
  message: string;
}

export interface QuestGenerationResult {
  /** This object alone is the public Quest Schema v1.0 payload. */
  quest: QuestPayloadV1;
  /** Internal metadata; never merge these fields into the public quest payload. */
  generation_mode: 'compatibility_scaffold';
  warnings: QuestGenerationWarning[];
}

export class QuestGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestGenerationError';
  }
}
