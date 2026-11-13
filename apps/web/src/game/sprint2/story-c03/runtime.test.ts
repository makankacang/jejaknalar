import { describe, expect, it } from 'vitest';
import { activeStoryObjective, chooseStoryDialogue, closeStoryDialogue, completeStoryInteraction, currentStoryDialogue, initialStoryProgress, openStoryDialogue } from './runtime';
import type { StoryPlan } from './adapter';
const plan: StoryPlan = {
  previewOnly: true, title: 'Demo', prologue: 'Pengantar', startRoom: 'school.library',
  objectives: [{ id: 'm1', label: 'Amati arsip', room: 'school.library', activityIds: ['a1'] }],
  tasks: [{ activity_id: 'a1', room_id: 'school.library', object_id: 'archive', template: 'observe', objective_ids: ['LO-1'], instruction: 'Amati arsip', source_refs: [] }],
  dialogues: [{ npc_id: 'guide', room_id: 'school.library', start_node_id: 'start', nodes: [
    { node_id: 'start', text: 'Halo', choices: [{ choice_id: 'next', label: 'Lanjut', next_node_id: 'end' }] },
    { node_id: 'end', text: 'Selesai', choices: [{ choice_id: 'finish', label: 'Tutup', unlock_mission_id: 'm1' }] },
  ] }],
};
describe('D-05B story runtime', () => {
  it('starts with an objective and no dialogue', () => {
    const s = initialStoryProgress(); expect(activeStoryObjective(plan, s)?.id).toBe('m1'); expect(currentStoryDialogue(plan, s)).toBeNull();
  });
  it('ignores interactions in wrong rooms or objects', () => {
    const s = initialStoryProgress(); expect(completeStoryInteraction(plan, s, 'other', 'archive')).toBe(s);
    expect(completeStoryInteraction(plan, s, 'school.library', 'other')).toBe(s);
  });
  it('completes only mapped activity and clears objective', () => {
    const s = completeStoryInteraction(plan, initialStoryProgress(), 'school.library', 'archive');
    expect(s.completedActivityIds).toEqual(['a1']); expect(activeStoryObjective(plan, s)).toBeNull();
    expect(completeStoryInteraction(plan, s, 'school.library', 'archive')).toBe(s);
  });
  it('navigates dialogue nodes and unlocks a mission', () => {
    let s = openStoryDialogue(plan, initialStoryProgress(), 'guide', 'school.library');
    expect(currentStoryDialogue(plan, s)?.node.text).toBe('Halo');
    s = chooseStoryDialogue(plan, s, 'next'); expect(currentStoryDialogue(plan, s)?.node.text).toBe('Selesai');
    s = chooseStoryDialogue(plan, s, 'finish'); expect(s.unlockedMissionIds).toEqual(['m1']);
    expect(currentStoryDialogue(plan, s)).toBeNull();
  });
  it('ignores unknown NPC and choices and allows closing', () => {
    const s = initialStoryProgress(); expect(openStoryDialogue(plan, s, 'wrong', 'school.library')).toBe(s);
    const opened = openStoryDialogue(plan, s, 'guide', 'school.library');
    expect(chooseStoryDialogue(plan, opened, 'missing')).toBe(opened);
    expect(closeStoryDialogue(opened).activeDialogue).toBeNull();
  });
});
