import { describe, expect, it, vi } from 'vitest';
import { QuestFlow } from './flow';
import { prepareEvidenceHunt } from './content';
import { questFixtureV1 } from '../sprint0/fixtures-v1';
import { MockAssessmentRepositoryV1, type AssessmentPortV1, type ApiSuccessV1, type SubmitAssessmentDataV1, type SubmitAssessmentRequestV1 } from '../sprint0/repositories-v1';

const setup = (path: ConstructorParameters<typeof MockAssessmentRepositoryV1>[0] = 'need_more_evidence') => {
  const { quest, content } = prepareEvidenceHunt(questFixtureV1);
  return new QuestFlow(quest, content, new MockAssessmentRepositoryV1(path));
};
const advance = (f: QuestFlow) => {
  f.start(); f.interactNpc(); f.closeInteraction(); f.openDocument(); f.closeInteraction(); f.openChallenge(); f.selectEvidence('P-002');
};

describe('PIC D Sprint 1: Evidence Hunt vertical slice', () => {
  it('loads v1 quest without changing official schema', () => {
    expect(prepareEvidenceHunt(questFixtureV1).quest.schema_version).toBe('1.0');
    expect(() => prepareEvidenceHunt({ ...questFixtureV1, scene_id: 'nonexistent' })).toThrow();
  });
  it('cannot start challenge before reading document', () => {
    const f = setup(); f.start(); f.openChallenge();
    expect(f.getSnapshot().state).toBe('EXPLORING');
  });
  it('opens NPC and document, tracks evidence, and completes quest', async () => {
    const f = setup(); advance(f);
    expect(f.getSnapshot().state).toBe('ASSESSMENT');
    await f.submit();
    expect(f.getSnapshot().state).toBe('FEEDBACK');
    expect(f.getSnapshot().result?.next_path).toBe('need_more_evidence');
    f.nextPath(); f.finish();
    expect(f.getSnapshot().state).toBe('COMPLETED');
    expect(f.getSnapshot().events.map(e => e.eventType)).toContain('QUEST_COMPLETED');
  });
  it('supports all four BedaJalur states in mock presentation', async () => {
    for (const path of ['needs_support','developing','ready_for_extension','need_more_evidence'] as const) {
      const f = setup(path); advance(f); await f.submit();
      expect(f.getSnapshot().result?.next_path).toBe(path);
    }
  });
  it('does not include private answer keys in public model', () => {
    expect(JSON.stringify(questFixtureV1)).not.toMatch(/answer_key|correct_answer|rubric/);
    expect(JSON.stringify(prepareEvidenceHunt(questFixtureV1).content)).not.toMatch(/answer_key|correct_answer|rubric/);
  });
  it('rejects invalid evidence selection', () => {
    const f = setup(); advance(f); f.selectEvidence('INVALID');
    expect(f.getSnapshot().selectedEvidenceId).toBe('P-002');
  });
  it('prevents duplicate submission while request is in flight', async () => {
    const { quest, content } = prepareEvidenceHunt(questFixtureV1);
    let finish!: (value: ApiSuccessV1<SubmitAssessmentDataV1>) => void;
    const pending = new Promise<ApiSuccessV1<SubmitAssessmentDataV1>>(resolve => { finish = resolve; });
    const spy = vi.fn((_input: SubmitAssessmentRequestV1) => pending);
    const f = new QuestFlow(quest, content, { submitAnswers: spy } as AssessmentPortV1);
    advance(f); const first = f.submit(); const second = f.submit();
    expect(spy).toHaveBeenCalledTimes(1);
    finish({ok:true,request_id:'req-demo',data:{attempt_id:'00000000-0000-4000-8000-000000000001',status:'scored',score:0,feedback:[],next_path:'need_more_evidence'}});
    await Promise.all([first, second]);
    expect(f.getSnapshot().state).toBe('FEEDBACK');
  });
  it('retries failure with same immutable UUID/idempotency key', async () => {
    const { quest, content } = prepareEvidenceHunt(questFixtureV1);
    const requests: SubmitAssessmentRequestV1[] = [];
    const repo: AssessmentPortV1 = { async submitAnswers(input) {
      requests.push(input);
      if (requests.length === 1) throw new Error('network');
      return new MockAssessmentRepositoryV1().submitAnswers(input);
    }};
    const f = new QuestFlow(quest, content, repo);
    advance(f); await f.submit();
    expect(f.getSnapshot().state).toBe('SUBMITTING');
    expect(f.getSnapshot().submitError).toBeTruthy();
    await f.submit();
    expect(requests[0].idempotency_key).toBe(requests[1].idempotency_key);
    expect(f.getSnapshot().state).toBe('FEEDBACK');
  });
});
