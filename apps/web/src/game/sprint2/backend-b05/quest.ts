import { parseQuestV1, type QuestV1 } from '../../sprint0/contract-v1';
import type { PublishedItemCatalog } from './assessment';
import { StudentApiClient, StudentApiError, successData } from './client';

export type PublishedQuest = { quest: QuestV1; catalog: PublishedItemCatalog };
const questVersion = /^QV-[A-Z0-9-]{1,117}$/;

export class StudentQuestApi {
  constructor(private readonly api: StudentApiClient) {}

  async load(version: string): Promise<PublishedQuest> {
    if (!questVersion.test(version)) {
      throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'Masukkan ID versi quest yang dibagikan guru.');
    }
    const { data, requestId } = successData(await this.api.request(`/student/quests/${version}`, {
      method: 'GET', expectedStatus: 200,
    }));
    try {
      const quest = parseQuestV1(data);
      if (quest.quest_version_id !== version) throw new Error('Quest version mismatch');
      const itemIds = quest.steps.flatMap(step => step.type === 'select_evidence' && step.item_id ? [step.item_id] : []);
      return { quest, catalog: { origin: 'published-quest', quest_version_id: version, item_ids: [...new Set(itemIds)] } };
    } catch {
      throw new StudentApiError(502, 'BAD_RESPONSE', requestId, 'Format quest atau versi yang diterima tidak sesuai.');
    }
  }
}
