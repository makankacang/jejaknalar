/**
 * PIC D adapter for the teacher-approved Quest JSON Schema v1.0 pasted into chat.
 * Does not modify the authoritative contracts/quest.schema.json.
 * Some rules below are ADDITIONAL rendering checks; see docs/REVIEW-V1.md.
 */
import { parseInternalQuest, QuestValidationError, type GameQuest } from './types';

export type QuestStepV1 =
  | { id: string; type: 'read_document'; ref?: string; item_id?: string; [extra: string]: unknown }
  | { id: string; type: 'select_evidence'; ref?: string; item_id?: string; [extra: string]: unknown };

export interface QuestV1 {
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
    [other: string]: unknown;
  };
}

const questIdPattern = /^QUEST-[A-Z0-9-]+$/;
const versionIdPattern = /^QV-[A-Z0-9-]+$/;
const objectiveIdPattern = /^LO-[A-Z0-9-]+$/;
const topLevelKeys = new Set([
  'schema_version', 'quest_id', 'quest_version_id', 'objective_ids',
  'template', 'scene_id', 'steps', 'variants'
]);
const record = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input);
const nonemptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

export function parseQuestV1(input: unknown): QuestV1 {
  if (!record(input)) throw new QuestValidationError('Quest v1 harus berupa objek');
  if (Object.keys(input).some(k => !topLevelKeys.has(k))) {
    throw new QuestValidationError('Quest v1 memiliki properti root yang tidak disetujui schema');
  }
  if (input.schema_version !== '1.0' || input.template !== 'evidence_hunt') {
    throw new QuestValidationError('Versi atau template quest tidak didukung');
  }
  if (typeof input.quest_id !== 'string' || !questIdPattern.test(input.quest_id)) {
    throw new QuestValidationError('quest_id tidak sesuai format QUEST-*');
  }
  if (typeof input.quest_version_id !== 'string' || !versionIdPattern.test(input.quest_version_id)) {
    throw new QuestValidationError('quest_version_id tidak sesuai format QV-*');
  }
  if (!nonemptyString(input.scene_id)) throw new QuestValidationError('scene_id wajib diisi');
  if (!Array.isArray(input.objective_ids) || input.objective_ids.length === 0 ||
      !input.objective_ids.every(x => typeof x === 'string' && objectiveIdPattern.test(x))) {
    throw new QuestValidationError('objective_ids minimal satu dan mengikuti format LO-*');
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new QuestValidationError('steps minimal satu');
  }
  const ids = new Set<string>();
  for (const step of input.steps) {
    if (!record(step) || typeof step.id !== 'string') {
      throw new QuestValidationError('Setiap step harus memiliki id string');
    }
    // Team schema v1.0 does not yet require id uniqueness or ref/item_id conditional.
    // PIC D enforces these additional constraints to avoid renderer crashes.
    if (!nonemptyString(step.id) || ids.has(step.id)) {
      throw new QuestValidationError('Step ID kosong atau duplikat');
    }
    ids.add(step.id);
    if (step.type === 'read_document') {
      if (!nonemptyString(step.ref)) {
        throw new QuestValidationError('read_document memerlukan ref dokumen');
      }
    } else if (step.type === 'select_evidence') {
      if (!nonemptyString(step.item_id)) {
        throw new QuestValidationError('select_evidence memerlukan item_id');
      }
    } else {
      throw new QuestValidationError('Step type tidak didukung kontrak v1.0');
    }
    if (step.ref !== undefined && typeof step.ref !== 'string') {
      throw new QuestValidationError('Step ref harus string');
    }
    if (step.item_id !== undefined && typeof step.item_id !== 'string') {
      throw new QuestValidationError('Step item_id harus string');
    }
  }
  if (!record(input.variants)) throw new QuestValidationError('variants harus objek');
  for (const key of ['needs_support', 'developing', 'ready_for_extension']) {
    if (!nonemptyString(input.variants[key])) {
      throw new QuestValidationError(`Variant ${key} harus berupa ID string non-kosong`);
    }
  }
  return input as unknown as QuestV1;
}

/** Temporary projection: keeps existing internal types/fixtures usable in Sprint 0.
 * The internal schemaVersion marker is intentionally NOT the official v1 payload.
 */
export function toInternalGameQuest(payload: unknown): GameQuest {
  const q = parseQuestV1(payload);
  const internal: GameQuest = {
    schemaVersion: 'picd-draft-0',
    questId: q.quest_id,
    versionId: q.quest_version_id,
    objectiveIds: [...q.objective_ids],
    template: q.template,
    sceneId: q.scene_id,
    steps: q.steps.map(step => step.type === 'read_document'
      ? { id: step.id, type: 'read_document' as const, documentRef: step.ref! }
      : { id: step.id, type: 'select_evidence' as const, itemRef: step.item_id! }),
    variants: {
      needs_support: q.variants.needs_support,
      developing: q.variants.developing,
      ready_for_extension: q.variants.ready_for_extension
    }
  };
  return parseInternalQuest(internal);
}
