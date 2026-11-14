import { describe, expect, it } from 'vitest';
import { initialStoryProgress } from '../../../game/sprint2/story-c03/runtime';
import {
  previewPlan, story, activeMission, isActivityAllowed, emptyAnswer, canComplete,
  initialSpatialState, completedPreviewState, missionGuidance, evidenceOptionsForParagraph,
  serializeBi8Assessment, toBi8AssessmentAnswer, missingAssessmentFields, BI8_ASSESSMENT_ITEM_ID, BI8_OBJECTIVE_ID,
} from './bi8-model';

describe('PIC D BI8 candidate — isolated local preview', () => {
  const plan = previewPlan();
  it('validates the full BI8 story against the real D06 world slots', () => {
    expect(plan.previewOnly).toBe(true);
    expect(plan.startRoom).toBe('school.library');
    expect(plan.objectives).toHaveLength(3);
    expect(plan.tasks.map(t=>t.template)).toEqual(['observe','investigate','decide']);
    expect(plan.dialogues[0].npc_id).toBe('school.npc.librarian');
  });
  it('pins source refs to the candidate document identity and text version', () => {
    for (const t of story.tasks) for (const ref of t.source_refs) {
      expect(ref.document_id).toBe('doc_a305829d3917b4ca');
      expect(ref.text_version).toBe('1c8e29fe-698d-4d6c-ad2b-ff178de1ace2');
      expect(ref.excerpt.length).toBeGreaterThan(10);
      expect(ref.document_id).not.toBe('DOC-001');
    }
    expect(story.quest_version_id).toBe('QV-BI8-B1S5-REDAKSI-001');
  });
  it('uses the official item and objective IDs without promoting provisional version to published', () => {
    expect(BI8_ASSESSMENT_ITEM_ID).toBe('ITEM-BI8-B1S5-REDAKSI-KLASIFIKASI-001');
    expect(BI8_OBJECTIVE_ID).toBe('LO-8A857C13-422A-4C5B-AD8A-8403955C067E');
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
  it('requires an explicit finish-reading action for the reading activity', () => {
    const observe=story.tasks[0], a=emptyAnswer();
    expect(canComplete(observe,a)).toBe(false);
    a.viewedSourceIndices=[0];
    expect(canComplete(observe,a)).toBe(true);
  });
  it('accepts a non-empty investigation note without grading its meaning', () => {
    const investigate=story.tasks[1], a=emptyAnswer();
    expect(canComplete(investigate,a)).toBe(false);
    a.comparison='A';
    expect(canComplete(investigate,a)).toBe(true);
    a.comparison='jawaban siswa yang berbeda dari contoh';
    expect(canComplete(investigate,a)).toBe(true);
  });
  it('requires all six BI8 response fields but never checks whether the answers are correct', () => {
    const decide=story.tasks[2], a=emptyAnswer();
    expect(canComplete(decide,a)).toBe(false);
    expect(missingAssessmentFields(decide,a)).toEqual([
      'Paragraf A — Klasifikasi', 'Paragraf A — Bukti', 'Paragraf A — Alasan',
      'Paragraf B — Klasifikasi', 'Paragraf B — Bukti', 'Paragraf B — Alasan',
    ]);

    // Five filled fields are not enough: both paragraphs must be complete.
    a.categories=['eksposisi','deskripsi'];
    a.evidenceIndices=[0,1];
    a.reasons=['Alasan bebas untuk A.',''];
    expect(canComplete(decide,a)).toBe(false);
    expect(missingAssessmentFields(decide,a)).toEqual(['Paragraf B — Alasan']);

    // Whitespace-only text and an invalid evidence index do not count as completed fields.
    a.reasons=['Alasan bebas untuk A.','   '];
    a.evidenceIndices=[0,99];
    expect(canComplete(decide,a)).toBe(false);
    expect(missingAssessmentFields(decide,a)).toEqual(['Paragraf B — Bukti', 'Paragraf B — Alasan']);

    // All six fields filled with deliberately swapped classifications still pass.
    // The UI checks completeness only; semantic correctness belongs to the server evaluator.
    a.evidenceIndices=[0,1];
    a.reasons=['Alasan bebas untuk A.','Alasan bebas untuk B.'];
    expect(missingAssessmentFields(decide,a)).toEqual([]);
    expect(canComplete(decide,a)).toBe(true);
  });
  it('splits the full A/B paragraphs into selectable evidence without exposing source IDs in the options', () => {
    const decide=story.tasks[2];
    const a=evidenceOptionsForParagraph(decide,0);
    const b=evidenceOptionsForParagraph(decide,1);
    expect(a.length).toBe(3);
    expect(b.length).toBe(3);
    expect(a[0]).toContain('Sepeda baru Mira');
    expect(b[1]).toContain('Rp7.800,00');
    expect(b[2]).toContain('rute-rute sulit');
    expect(a.join(' ')).not.toContain('DOC-P-');
  });
  it('serializes all six completed fields into one string for the official item', () => {
    const decide=story.tasks[2], a=emptyAnswer();
    a.categories=['eksposisi','deskripsi'];
    a.evidenceIndices=[0,1];
    a.reasons=['Alasan bebas A, walaupun klasifikasinya tidak tepat.','Alasan bebas B, walaupun klasifikasinya tidak tepat.'];
    const serialized=serializeBi8Assessment(decide,a);
    expect(serialized).toContain('Paragraf A\nKlasifikasi: eksposisi');
    expect(serialized).toContain('Bukti: Sepeda baru Mira');
    expect(serialized).toContain('Alasan: Alasan bebas A');
    expect(serialized).toContain('Paragraf B\nKlasifikasi: deskripsi');
    expect(serialized).toContain('Bukti: Dengan bahan bakar');
    expect(serialized).toContain('Alasan: Alasan bebas B');
    expect(serialized).not.toContain('DOC-P-');
    expect(toBi8AssessmentAnswer(decide,a)).toEqual({item_id: BI8_ASSESSMENT_ITEM_ID, value: serialized});
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
