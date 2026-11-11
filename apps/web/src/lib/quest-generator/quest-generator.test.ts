import { describe, expect, it } from 'vitest';
import { prepareEvidenceHunt } from '../../game/sprint1/content';
import { parseQuestV1 } from '../../game/sprint0/contract-v1';
import { generateCompatibleQuestDraft } from './generator';

const input = {
  identity: { quest_id: 'QUEST-GENERATED-001', quest_version_id: 'QV-GENERATED-001' },
  objectives: [
    { id: 'LO-BAHASA-001', statement: 'Siswa mampu mengidentifikasi informasi penting dalam teks.' },
    { id: 'LO-BAHASA-002', statement: 'Siswa mampu memilih bukti yang mendukung kesimpulan.' },
  ],
};

describe('C-03 compatible quest scaffold', () => {
  it('builds a payload accepted by the PIC D Quest Schema v1.0 adapter', () => {
    const result = generateCompatibleQuestDraft(input);
    expect(parseQuestV1(result.quest)).toEqual(result.quest);
    expect(result.quest.objective_ids).toEqual(['LO-BAHASA-001', 'LO-BAHASA-002']);
  });

  it('passes the current PIC D Evidence Hunt scene preflight', () => {
    const result = generateCompatibleQuestDraft(input);
    const prepared = prepareEvidenceHunt(result.quest);
    expect(prepared.quest.scene_id).toBe('school_library');
    expect(prepared.content.document.id).toBe('DOC-001');
    expect(prepared.content.challenge.itemId).toBe('ITEM-001');
  });

  it('uses only the documented public Quest Schema v1.0 keys', () => {
    const result = generateCompatibleQuestDraft(input);
    expect(Object.keys(result.quest).sort()).toEqual([
      'objective_ids', 'quest_id', 'quest_version_id', 'schema_version', 'scene_id', 'steps', 'template', 'variants',
    ].sort());
    expect(JSON.stringify(result.quest)).not.toMatch(/answer_key|correct_answer|rubric/i);
  });

  it('rejects missing approved objectives', () => {
    expect(() => generateCompatibleQuestDraft({ ...input, objectives: [] })).toThrow(/Minimal satu LO/);
  });

  it('rejects malformed IDs and duplicate LO IDs', () => {
    expect(() => generateCompatibleQuestDraft({
      ...input,
      identity: { quest_id: 'bad-id', quest_version_id: 'QV-GENERATED-001' },
    })).toThrow(/QUEST/);
    expect(() => generateCompatibleQuestDraft({
      ...input,
      objectives: [input.objectives[0], input.objectives[0]],
    })).toThrow(/duplikat/);
  });
});
