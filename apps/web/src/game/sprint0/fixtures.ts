import type { GameQuest } from './types.js';
/** Synthetic, public quest fixture. NO secret scoring keys. */
export const mockQuest: GameQuest = {
  schemaVersion:'picd-draft-0', questId:'QUEST-DEMO-001', versionId:'V-DEMO-001',
  objectiveIds:['LO-LIT-INFERENSI-01'],template:'evidence_hunt',sceneId:'school_library',
  steps:[
    {id:'read',type:'read_document',documentRef:'DOC-001'},
    {id:'npc',type:'talk_npc',npcRef:'NPC-LIBRARIAN'},
    {id:'evidence',type:'select_evidence',itemRef:'Q-001'},
    {id:'inference',type:'make_inference',itemRef:'Q-002'},
  ],
  variants:{needs_support:'QVAR-S',developing:'QVAR-D',ready_for_extension:'QVAR-E'}
};
