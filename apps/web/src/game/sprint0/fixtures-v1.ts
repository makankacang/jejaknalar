import type { QuestV1 } from './contract-v1';
/** Public synthetic fixture following the fields in quest.schema.json v1.0.
 * It deliberately has no answer key, private rubric, name, student ID, or token.
 */
export const questFixtureV1: QuestV1 = {
  schema_version: '1.0',
  quest_id: 'QUEST-DEMO-001',
  quest_version_id: 'QV-DEMO-001',
  objective_ids: ['LO-LIT-INFERENSI-01'],
  template: 'evidence_hunt',
  scene_id: 'school_library',
  steps: [
    { id: 'read-01', type: 'read_document', ref: 'DOC-001' },
    { id: 'evidence-01', type: 'select_evidence', item_id: 'ITEM-001' }
  ],
  variants: {
    needs_support: 'QVAR-S',
    developing: 'QVAR-D',
    ready_for_extension: 'QVAR-E'
  }
};
