import { describe, it, expect } from 'vitest';
import { assess, type RubricItem } from '../../../../../supabase/functions/_shared/rules/assessment/sprint1';
import { recommend, type Evidence } from '../../../../../supabase/functions/_shared/rules/adaptive/sprint1';
import { createDemoService } from '../../../../../tools/d-sprint1/mock-service';
const item: RubricItem = { item_id: 'Q1', objective_id: 'LO1', expected: 'A', options: ['A','B'], explanation: 'Rujuk sumber.', transfer: false };
const record = (activityId: string, patch: Partial<Evidence> = {}): Evidence => ({ objectiveId: 'LO1', activityId, correct: true, explanationVerified: true, hintsUsed: 0, attemptCount: 1, transfer: false, ...patch });
const good = [record('1'), record('2'), record('3', { transfer: true })];
describe('assessment pure rules server-side', () => {
  it('scores correct, wrong and unanswered objectively', () => {
    expect(assess([item], [{ item_id:'Q1', value:'A' }]).score).toBe(100);
    expect(assess([item], [{ item_id:'Q1', value:'B' }]).score).toBe(0);
    expect(assess([item], []).evidence).toEqual([]);
    expect(assess([item], []).feedback[0].message).toContain('Belum dijawab');
  });
  it('rejects duplicate/foreign items and invalid options or rubrics', () => {
    expect(() => assess([item], [{ item_id:'Q1', value:'C' }])).toThrow();
    expect(() => assess([item], [{ item_id:'other', value:'A' }])).toThrow();
    expect(() => assess([item], [{ item_id:'Q1', value:'A' },{ item_id:'Q1', value:'A' }])).toThrow();
    expect(() => assess([item,item], [])).toThrow();
    expect(() => assess([{...item,expected:'X'}], [])).toThrow();
  });
});
describe('BedaJalur observations', () => {
  it('requires three distinct activities on the same objective', () => {
    expect(recommend('LO1', []).path).toBe('need_more_evidence');
    expect(recommend('LO1', [record('1'),record('1'),record('1')]).path).toBe('need_more_evidence');
    expect(recommend('OTHER', good).evidenceCount).toBe(0);
  });
  it('selects the three learning paths with auditable reason and version', () => {
    expect(recommend('LO1', good).path).toBe('ready_for_extension');
    expect(recommend('LO1', good.map((e,i)=>({...e,correct:i!==0}))).path).toBe('developing');
    expect(recommend('LO1', good.map(e=>({...e,correct:false}))).path).toBe('needs_support');
    expect(recommend('LO1',good).ruleVersion).toBe('picd-sprint1-v1');
  });
  it('requires confirmed reasoning, transfer and independence for extension', () => {
    for (const patch of [{transfer:false},{hintsUsed:1},{attemptCount:2},{explanationVerified:false}]) {
      expect(recommend('LO1',good.map(e=>({...e,...patch}))).path).not.toBe('ready_for_extension');
    }
  });
  it('reassessment uses latest evidence without counting retries as new activities', () => {
    const result = recommend('LO1',[...good,...good.map(e=>({...e,correct:false,attemptCount:2}))]);
    expect(result.evidenceCount).toBe(3); expect(result.path).toBe('needs_support');
    expect(() => recommend('LO1',[record('1',{hintsUsed:-1})])).toThrow();
  });
});
describe('local demo service, same v1 submit envelope', () => {
  const request = () => ({ quest_version_id:'QV-DEMO-001', idempotency_key:crypto.randomUUID(), answers:[{item_id:'ITEM-001',value:'P-002'},{item_id:'ITEM-002',value:'I-A'},{item_id:'ITEM-003',value:'T-B'}] });
  it('gives reproducible feedback and replays duplicate request exactly', () => {
    const submit = createDemoService(); const input = request();
    const result = submit(input); expect(result.data.score).toBe(100);
    expect(result.data.next_path).toBe('ready_for_extension'); expect(submit(input)).toEqual(result);
    expect(() => submit({...input, answers:input.answers.slice(0,1)})).toThrow('CONFLICT');
  });
  it('handles all four paths and rejects invalid requests', () => {
    const submit = createDemoService();
    const support = request(); support.answers = support.answers.map((a,i)=>({...a,value:['P-001','I-B','T-A'][i]}));
    expect(submit(support).data.next_path).toBe('needs_support');
    expect(submit(request(),{hintsUsed:1,attemptCount:1}).data.next_path).toBe('developing');
    const diagnostic = request(); diagnostic.answers = diagnostic.answers.slice(0,1);
    expect(submit(diagnostic).data.next_path).toBe('need_more_evidence');
    expect(() => submit({...request(),quest_version_id:'forged'})).toThrow();
    expect(() => submit({...request(),answers:[]})).toThrow();
  });
});
