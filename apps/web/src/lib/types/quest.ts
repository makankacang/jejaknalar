/**
 * QuestV1 types — matches contracts/quest.schema.json
 * PIC A — read-only consumer of quest data
 */

export interface QuestStep {
  id: string;
  type: 'read_document' | 'select_evidence';
  ref?: string;
  item_id?: string;
}

export interface QuestV1 {
  schema_version: '1.0';
  quest_id: string;
  quest_version_id: string;
  objective_ids: string[];
  template: 'evidence_hunt';
  scene_id: string;
  steps: QuestStep[];
  variants: {
    needs_support: string;
    developing: string;
    ready_for_extension: string;
  };
}
