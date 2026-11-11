import { getCurrentEvidenceHuntCapability } from './capabilities';
import {
  QuestGenerationError,
  type QuestGenerationInput,
  type QuestGenerationResult,
  type QuestPayloadV1,
} from './types';

const QUEST_ID_PATTERN = /^QUEST-[A-Z0-9-]+$/;
const QUEST_VERSION_ID_PATTERN = /^QV-[A-Z0-9-]+$/;
const OBJECTIVE_ID_PATTERN = /^LO-[A-Z0-9-]+$/;

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new QuestGenerationError(`${label} tidak boleh kosong`);
}

/**
 * Builds a schema-compatible scaffold for the only currently registered game scene.
 * This is intentionally deterministic and does not call Gemini: Quest Schema v1.0
 * and the existing renderer do not yet expose fields for generated story/dialogue,
 * document body, or a distinct reassessment item.
 */
export function generateCompatibleQuestDraft(input: QuestGenerationInput): QuestGenerationResult {
  if (!input || typeof input !== 'object') {
    throw new QuestGenerationError('Input generation tidak valid');
  }

  const { quest_id, quest_version_id } = input.identity ?? ({} as QuestGenerationInput['identity']);
  if (typeof quest_id !== 'string' || !QUEST_ID_PATTERN.test(quest_id)) {
    throw new QuestGenerationError('quest_id harus mengikuti format QUEST-*');
  }
  if (typeof quest_version_id !== 'string' || !QUEST_VERSION_ID_PATTERN.test(quest_version_id)) {
    throw new QuestGenerationError('quest_version_id harus mengikuti format QV-*');
  }

  if (!Array.isArray(input.objectives) || input.objectives.length === 0) {
    throw new QuestGenerationError('Minimal satu LO yang sudah disetujui diperlukan');
  }

  const objectiveIds = input.objectives.map((objective, index) => {
    if (!objective || typeof objective !== 'object') {
      throw new QuestGenerationError(`LO pada posisi ${index + 1} tidak valid`);
    }
    if (typeof objective.id !== 'string' || !OBJECTIVE_ID_PATTERN.test(objective.id)) {
      throw new QuestGenerationError(`ID LO pada posisi ${index + 1} harus mengikuti format LO-*`);
    }
    if (typeof objective.statement !== 'string') {
      throw new QuestGenerationError(`Pernyataan LO ${objective.id} harus berupa string`);
    }
    assertNonEmpty(objective.statement, `Pernyataan LO ${objective.id}`);
    return objective.id;
  });

  if (new Set(objectiveIds).size !== objectiveIds.length) {
    throw new QuestGenerationError('Daftar LO tidak boleh mengandung ID duplikat');
  }

  const capability = getCurrentEvidenceHuntCapability();
  const quest: QuestPayloadV1 = {
    schema_version: '1.0',
    quest_id,
    quest_version_id,
    objective_ids: objectiveIds,
    template: capability.template,
    scene_id: capability.scene_id,
    steps: [
      { id: 'read-01', type: 'read_document', ref: capability.document_ref },
      { id: 'evidence-01', type: 'select_evidence', item_id: capability.assessment_item_id },
    ],
    variants: { ...capability.variants },
  };

  return {
    quest,
    generation_mode: 'compatibility_scaffold',
    warnings: [
      {
        code: 'COMPATIBILITY_SCAFFOLD_ONLY',
        message: 'Payload memenuhi kontrak yang tersedia, tetapi belum memuat konten cerita yang dihasilkan AI.',
      },
      {
        code: 'STATIC_SCENE_CONTENT',
        message: 'NPC, dialog, isi dokumen, dan prompt tantangan masih berasal dari konten statis scene school_library.',
      },
      {
        code: 'NO_DYNAMIC_ASSESSMENT_CONTENT',
        message: 'Generator belum membuat item assessment atau reassessment baru; renderer saat ini memakai ITEM-001.',
      },
    ],
  };
}
