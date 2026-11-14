import { describe, expect, it } from 'vitest';
import { initialStoryProgress } from '../../../game/sprint2/story-c03/runtime';
import { previewPlan, story, activeMission, isActivityAllowed, emptyAnswer, canComplete, initialSpatialState, completedPreviewState, missionGuidance, hasReasonContent } from './bi8-model';

describe('PIC D BI8 candidate — isolated preview', () => {
  const plan = previewPlan();
  it('validates full non-fixture BI8 story against the real D06 world slots', () => {
    expect(plan.previewOnly).toBe(true);
    expect(plan.startRoom).toBe('school.library');
    expect(plan.objectives).toHaveLength(3);
    expect(plan.tasks.map(t=>t.template)).toEqual(['observe','investigate','decide']);
    expect(plan.dialogues[0].npc_id).toBe('school.npc.librarian');
  });
  it('pins all source_refs to PIC B-approved document identity with no DOC-001 fixture', () => {
    for (const t of story.tasks) for (const ref of t.source_refs) {
      expect(ref.document_id).toBe('doc_a305829d3917b4ca');
      expect(ref.text_version).toBe('1c8e29fe-698d-4d6c-ad2b-ff178de1ace2');
      expect(ref.excerpt.length).toBeGreaterThan(10);
      expect(ref.document_id).not.toBe('DOC-001');
    }
    expect(story.quest_version_id).toBe('QV-BI8-B1S5-REDAKSI-001');
  });
  it('starts in the library without activating a fixture episode', () => {
    const spatial = initialSpatialState(plan);
    expect(spatial.room).toBe('school.library');
    expect(spatial.questVersion).toBe(story.quest_version_id);
    expect(spatial.episode).toBe('PIC-D-BI8-LOCAL-PREVIEW');
    expect(spatial.evidence).toEqual([]);
  });
  it('gates the first activity behind the librarian dialogue', () => {
    const p = initialStoryProgress();
    expect(activeMission(p)?.mission_id).toBe(story.missions[0].mission_id);
    expect(isActivityAllowed(story.tasks[0],p)).toBe(false);
    p.unlockedMissionIds.push(story.missions[0].mission_id);
    expect(isActivityAllowed(story.tasks[0],p)).toBe(true);
    expect(isActivityAllowed(story.tasks[1],p)).toBe(false);
  });
  it('enforces sequential mission progression', () => {
    const p=initialStoryProgress();
    p.unlockedMissionIds=[story.missions[0].mission_id];
    p.completedActivityIds=[story.tasks[0].activity_id];
    expect(isActivityAllowed(story.tasks[1],p)).toBe(true);
    expect(isActivityAllowed(story.tasks[2],p)).toBe(false);
    p.completedActivityIds.push(story.tasks[1].activity_id);
    expect(isActivityAllowed(story.tasks[2],p)).toBe(true);
  });
  it('requires reading and meaningful input, without grading answers', () => {
    const observe=story.tasks[0],investigate=story.tasks[1],decide=story.tasks[2];
    const a=emptyAnswer();
    expect(canComplete(observe,a)).toBe(false);
    a.viewedSourceIndices=[0];
    expect(canComplete(observe,a)).toBe(true);
    a.viewedSourceIndices=[0,1];
    expect(canComplete(investigate,a)).toBe(false);
    a.comparison='Kedua paragraf menyajikan informasi dengan cara yang berbeda.';
    expect(canComplete(investigate,a)).toBe(true);
    a.viewedSourceIndices=[0,1,2];
    expect(canComplete(decide,a)).toBe(false);
    a.categories=['deskripsi','eksposisi'];
    a.evidenceIndices=[1,2];
    a.reasons=['Memaparkan ciri objek secara jelas.','Memberikan data informatif dalam teks.'];
    expect(canComplete(decide,a)).toBe(true);
  });
  it('rejects filler while leaving correctness and scoring to PIC B worker', () => {
    expect(hasReasonContent('aaaaaaaa aaaaaaaa aaaaaaaa aaaaaaaa aaaaaaaa')).toBe(false);
    expect(hasReasonContent('Karena kata kata kata kata kata')).toBe(false);
    expect(hasReasonContent('Paragraf ini menjelaskan benda dengan detail yang dapat dibaca.')).toBe(true);
    const decide = story.tasks[2], a=emptyAnswer();
    a.viewedSourceIndices=[0,1,2];
    a.categories=['deskripsi','eksposisi'];
    a.evidenceIndices=[1,1];
    a.reasons=['Paragraf ini menjelaskan ciri objek dengan kata yang terperinci.','Bagian tersebut memaparkan informasi dan data dalam teks.'];
    expect(canComplete(decide,a)).toBe(false); // same evidence cannot support both distinct source choices
    a.evidenceIndices=[1,2];
    expect(canComplete(decide,a)).toBe(true);
  });
  it('records only local evidence mapped to completed activity IDs', () => {
    const p=initialStoryProgress();
    p.completedActivityIds=[story.tasks[0].activity_id];
    const state=completedPreviewState(initialSpatialState(plan),p);
    expect(state.evidence).toEqual(['EVD-REDAKSI-KONSEP']);
    expect(state.statuses.observe).toBe('completed');
  });
  it('guides learners from librarian to observe, investigate and decide', () => {
    const p=initialStoryProgress();
    const start=missionGuidance(p,'school.library',null);
    expect(start.heading).toContain('Bu Maya');
    expect(start.instruction).toContain('Dekati');
    const npc=missionGuidance(p,'school.library','school.npc.librarian');
    expect(npc.callToAction).toContain('Tekan E');
    p.unlockedMissionIds=[story.missions[0].mission_id];
    const observe=missionGuidance(p,'school.library',null);
    expect(observe.heading).toContain('panduan');
    p.completedActivityIds=[story.tasks[0].activity_id];
    const investigate=missionGuidance(p,'school.library',null);
    expect(investigate.location).toBe('school.staff_room');
    expect(investigate.callToAction).toContain('Menuju');
    p.completedActivityIds.push(story.tasks[1].activity_id);
    const decide=missionGuidance(p,'school.discussion_hall',null);
    expect(decide.heading).toContain('Klasifikasikan');
    p.completedActivityIds.push(story.tasks[2].activity_id);
    expect(missionGuidance(p,'school.discussion_hall',null).heading).toContain('selesai');
  });

});
