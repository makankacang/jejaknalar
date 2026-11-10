import { describe, expect, it } from 'vitest';
import { parseQuestV1, toInternalGameQuest } from './contract-v1';
import { questFixtureV1 } from './fixtures-v1';
import { MockAssessmentRepositoryV1, MockQuestRepositoryV1 } from './repositories-v1';

describe('PIC D Contract v1.0 adapter', () => {
  it('accepts the official snake_case quest shape', () => {
    expect(parseQuestV1(questFixtureV1).schema_version).toBe('1.0');
    expect(toInternalGameQuest(questFixtureV1).steps[0]).toEqual({
      id: 'read-01', type: 'read_document', documentRef: 'DOC-001'
    });
  });
  it('rejects unknown top-level fields (additionalProperties false)', () => {
    expect(() => parseQuestV1({ ...questFixtureV1, private_answer_key: 'never' })).toThrow();
  });
  it('rejects incomplete step refs to prevent game rendering failure', () => {
    expect(() => parseQuestV1({ ...questFixtureV1, steps: [{ id: 'x', type: 'read_document' }] })).toThrow();
    expect(() => parseQuestV1({ ...questFixtureV1, steps: [{ id: 'x', type: 'select_evidence' }] })).toThrow();
  });
  it('supports independent mock quest loading', async () => {
    const repo = new MockQuestRepositoryV1();
    expect((await repo.getPublishedQuest('QUEST-DEMO-001')).quest_id).toBe('QUEST-DEMO-001');
    await expect(repo.getPublishedQuest('QUEST-NOT-FOUND')).rejects.toThrow();
  });
  it('uses the official SubmitAssessmentRequest keys', async () => {
    const repo = new MockAssessmentRepositoryV1('developing');
    const input = {
      quest_version_id: 'QV-DEMO-001',
      idempotency_key: '00000000-0000-4000-8000-000000000002',
      answers: [{ item_id: 'ITEM-001', value: 'Bukti teks yang dipilih' }]
    };
    const response = await repo.submitAnswers(input);
    expect(response.data.status).toBe('scored');
    expect(response.data.next_path).toBe('developing');
    expect(response.data.attempt_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.data.feedback[0].message).toContain('BUKAN');
    await expect(repo.submitAnswers({ ...input, idempotency_key: 'not-a-uuid' })).rejects.toThrow();
  });
  it('handles need_more_evidence without inventing a fourth quest variant', async () => {
    const repo = new MockAssessmentRepositoryV1('need_more_evidence');
    const response = await repo.submitAnswers({
      quest_version_id: 'QV-DEMO-001',
      idempotency_key: '00000000-0000-4000-8000-000000000003',
      answers: [{ item_id: 'ITEM-001', value: 'Teks' }]
    });
    expect(response.data.next_path).toBe('need_more_evidence');
    expect(Object.keys(questFixtureV1.variants)).toHaveLength(3);
  });
});
