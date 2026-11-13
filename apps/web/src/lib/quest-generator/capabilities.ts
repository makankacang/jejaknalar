/**
 * PIC C snapshot of the current PIC D Sprint 1 renderer capabilities.
 * Source inspected: apps/web/src/game/sprint1/content.ts and flow.ts.
 * Keep this registry aligned with PIC D; it is deliberately not a new game API.
 */
export interface EvidenceHuntCapability {
  scene_id: string;
  template: 'evidence_hunt';
  document_ref: string;
  assessment_item_id: string;
  variants: {
    needs_support: string;
    developing: string;
    ready_for_extension: string;
  };
  supported_step_types: readonly ['read_document', 'select_evidence'];
  supports_dynamic_npc_dialogue: false;
  supports_dynamic_document_body: false;
  supports_distinct_reassessment_item: false;
}

export const CURRENT_GAME_CAPABILITIES: readonly EvidenceHuntCapability[] = [
  {
    scene_id: 'school_library',
    template: 'evidence_hunt',
    document_ref: 'DOC-001',
    assessment_item_id: 'ITEM-001',
    variants: {
      needs_support: 'QVAR-S',
      developing: 'QVAR-D',
      ready_for_extension: 'QVAR-E',
    },
    supported_step_types: ['read_document', 'select_evidence'],
    supports_dynamic_npc_dialogue: false,
    supports_dynamic_document_body: false,
    supports_distinct_reassessment_item: false,
  },
] as const;

export function getCurrentEvidenceHuntCapability(sceneId = 'school_library'): EvidenceHuntCapability {
  const capability = CURRENT_GAME_CAPABILITIES.find((item) => item.scene_id === sceneId);
  if (!capability) {
    throw new Error(`Scene belum didukung renderer: ${sceneId}`);
  }
  return capability;
}
