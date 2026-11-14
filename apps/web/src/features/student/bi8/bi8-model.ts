/** PIC D BI8 draft-only runtime model. This is NOT a public QuestV1 publication or assessment. */
import candidate from './story-bi8.json';
import { adaptStoryBundle, StoryContractError, type StoryBundle, type StoryPlan, type StoryTask, type QuestV1 } from '../../../game/sprint2/story-c03/adapter';
import { REGISTRY_VERSION, ROOMS } from '../../../game/sprint2/world';
import type { State } from '../../../game/sprint2/state';
import { initialStoryProgress, type StoryProgress } from '../../../game/sprint2/story-c03/runtime';

export const story = candidate as unknown as StoryBundle;
export const BI8_ASSESSMENT_ITEM_ID = 'ITEM-BI8-B1S5-REDAKSI-KLASIFIKASI-001';
export const BI8_OBJECTIVE_ID = 'LO-8A857C13-422A-4C5B-AD8A-8403955C067E';

/** Quest pairing is local preview metadata ONLY. A published QuestV1 must come from PIC B. */
const localPair: QuestV1 = {
  schema_version: '1.0',
  quest_version_id: story.quest_version_id,
  objective_ids: [...new Set(story.missions.flatMap(m => m.objective_ids))],
  scene_id: 'school_library',
};

export function previewPlan(): StoryPlan {
  const plan = adaptStoryBundle(story, localPair, {allowedSceneIds: ['school_library'], registryVersion: REGISTRY_VERSION});
  const mismatches = story.tasks.filter(task => !ROOMS[task.room_id]?.targets.some(
    target => target.kind === 'task' && target.objectId === task.object_id && target.task === task.template
  ));
  if (mismatches.length) throw new StoryContractError(mismatches.map(t => `Template not mounted: ${t.activity_id}`));
  return plan;
}

export const activityLabels: Record<string, string> = {
  'ACT-REDAKSI-KONSEP': '1. Pahami panduan redaksi',
  'ACT-REDAKSI-PERBANDINGAN': '2. Bandingkan dua paragraf',
  'ACT-REDAKSI-KLASIFIKASI': '3. Klasifikasikan dengan bukti',
};

export type LocalAnswer = {
  viewedSourceIndices: number[];
  comparison: string;
  categories: [string, string];
  /** Zero-based sentence index within the corresponding paragraph; -1 means unanswered. */
  evidenceIndices: [number, number];
  reasons: [string, string];
};

export const emptyAnswer = (): LocalAnswer => ({
  viewedSourceIndices: [], comparison: '', categories: ['', ''], evidenceIndices: [-1, -1], reasons: ['', ''],
});

export function activeMission(progress: StoryProgress) {
  return story.missions.find(m => !m.activity_ids.every(id => progress.completedActivityIds.includes(id))) ?? null;
}

export function isActivityAllowed(task: StoryTask, progress: StoryProgress): boolean {
  const mission = story.missions.find(m => m.activity_ids.includes(task.activity_id));
  const current = activeMission(progress);
  if (!mission || mission.mission_id !== current?.mission_id) return false;
  if (progress.completedActivityIds.includes(task.activity_id)) return false;
  if (mission.prerequisites.some(mid => {
    const prerequisite = story.missions.find(m => m.mission_id === mid);
    return !prerequisite || !prerequisite.activity_ids.every(id => progress.completedActivityIds.includes(id));
  })) return false;
  // Introductory mission is unlocked explicitly by talking with the librarian.
  if (mission.prerequisites.length === 0 && !progress.unlockedMissionIds.includes(mission.mission_id)) return false;
  return true;
}

/** Presentation helper: split complete source excerpts into selectable textual evidence. */
export function splitEvidenceSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/u).map(part => part.trim()).filter(Boolean);
}

/** Paragraph A/B are source_refs 1/2; source_refs[0] is the concept guide. */
export function evidenceOptionsForParagraph(task: StoryTask, paragraphIndex: 0 | 1): string[] {
  const source = task.source_refs[paragraphIndex + 1];
  return source ? splitEvidenceSentences(source.excerpt) : [];
}

/**
 * PIC B-locked single-item response serializer. This only packages student input;
 * it does not decide correctness, award points, or infer a BedaJalur path.
 */
export function serializeBi8Assessment(task: StoryTask, answer: LocalAnswer): string {
  const evidenceA = evidenceOptionsForParagraph(task, 0)[answer.evidenceIndices[0]] ?? '';
  const evidenceB = evidenceOptionsForParagraph(task, 1)[answer.evidenceIndices[1]] ?? '';
  return [
    'Paragraf A',
    `Klasifikasi: ${answer.categories[0].trim()}`,
    `Bukti: ${evidenceA}`,
    `Alasan: ${answer.reasons[0].trim()}`,
    '',
    'Paragraf B',
    `Klasifikasi: ${answer.categories[1].trim()}`,
    `Bukti: ${evidenceB}`,
    `Alasan: ${answer.reasons[1].trim()}`,
  ].join('\n');
}

/** B05 shape only. A live submission still requires a verified published item catalog. */
export function toBi8AssessmentAnswer(task: StoryTask, answer: LocalAnswer): { item_id: string; value: string } {
  return { item_id: BI8_ASSESSMENT_ITEM_ID, value: serializeBi8Assessment(task, answer) };
}

/**
 * Required presentation fields for the BI8 two-paragraph task.
 * This checks only that a choice, evidence quote, and reason exist for A and B.
 * It deliberately does not check whether any answer is academically correct.
 */
export function missingAssessmentFields(task: StoryTask, answer: LocalAnswer): string[] {
  if (task.template !== 'decide') return [];

  const missing: string[] = [];
  const allowedCategories = new Set(['deskripsi', 'eksposisi']);
  const categoryA = answer.categories[0].trim().toLowerCase();
  const categoryB = answer.categories[1].trim().toLowerCase();
  const evidenceAOptions = evidenceOptionsForParagraph(task, 0);
  const evidenceBOptions = evidenceOptionsForParagraph(task, 1);
  const evidenceA = answer.evidenceIndices[0];
  const evidenceB = answer.evidenceIndices[1];

  if (!allowedCategories.has(categoryA)) missing.push('Paragraf A — Klasifikasi');
  if (!Number.isInteger(evidenceA) || evidenceA < 0 || evidenceA >= evidenceAOptions.length) {
    missing.push('Paragraf A — Bukti');
  }
  if (!answer.reasons[0].trim()) missing.push('Paragraf A — Alasan');

  if (!allowedCategories.has(categoryB)) missing.push('Paragraf B — Klasifikasi');
  if (!Number.isInteger(evidenceB) || evidenceB < 0 || evidenceB >= evidenceBOptions.length) {
    missing.push('Paragraf B — Bukti');
  }
  if (!answer.reasons[1].trim()) missing.push('Paragraf B — Alasan');

  return missing;
}

/** Input-completeness gate only; no semantic grading, exact-match, or correctness check. */
export function canComplete(task: StoryTask, answer: LocalAnswer): boolean {
  if (task.template === 'observe') return answer.viewedSourceIndices.includes(0);
  if (task.template === 'investigate') return answer.comparison.trim().length > 0;
  if (task.template === 'decide') return missingAssessmentFields(task, answer).length === 0;
  return false;
}

/** State shape needed by the existing Phaser scene; no fixture Task/assessment is loaded. */
export function initialSpatialState(plan: StoryPlan): State {
  const room = ROOMS[plan.startRoom];
  return {
    feedback: {}, version: 1, registry: REGISTRY_VERSION, episode: 'PIC-D-BI8-LOCAL-PREVIEW',
    questVersion: story.quest_version_id, room: room.id, position: {...room.spawn}, heading: 'down',
    statuses: {observe: 'available', investigate: 'locked', decide: 'locked'},
    evidence: [], heldItem: null, delivered: false, drafts: {}, dialogue: 'start', route: null,
    visited: [room.id], revision: 0,
    decision: {status: 'need_more_evidence', path: null, simulation: true}, ending: null,
  };
}

export function completedPreviewState(before: State, progress: StoryProgress): State {
  const statuses = {...before.statuses};
  for (const t of story.tasks) {
    statuses[t.template] = progress.completedActivityIds.includes(t.activity_id) ? 'completed' :
      isActivityAllowed(t, progress) ? 'available' : 'locked';
  }
  return {...before, statuses, evidence: story.evidence
    .filter(e => progress.completedActivityIds.some(id => story.tasks.find(t => t.activity_id === id)?.evidence_ids?.includes(e.evidence_id)))
    .map(e => e.evidence_id)};
}

export const newProgress = initialStoryProgress;

/** Dynamic, student-facing wayfinding. Guidance is advisory; it never skips proximity checks. */
export type MissionGuidance = {
  step: number;
  heading: string;
  instruction: string;
  location: string;
  targetId: string | null;
  roomId: string | null;
  callToAction: string;
};

export function missionGuidance(progress: StoryProgress, currentRoom: string, nearbyTargetId: string | null): MissionGuidance {
  const mission = activeMission(progress);
  if (!mission) return {
    step: story.missions.length, heading: 'Seluruh misi redaksi selesai',
    instruction: 'Buka Jurnal bukti untuk melihat hasil kegiatan yang tercatat secara lokal.',
    location: currentRoom, targetId: null, roomId: null, callToAction: 'Buka Jurnal bukti',
  };
  const step = story.missions.findIndex(m => m.mission_id === mission.mission_id) + 1;
  if (step === 1 && !progress.unlockedMissionIds.includes(mission.mission_id)) {
    const targetId = 'school.npc.librarian';
    const isNear = nearbyTargetId === targetId;
    return {
      step, heading: 'Temui Bu Maya, pustakawan',
      instruction: isNear
        ? 'Kamu sudah dekat Bu Maya. Tekan E atau tombol Interaksi, lalu pilih “Mulai memeriksa panduan redaksi”.'
        : 'Dekati Bu Maya di depan meja layanan perpustakaan sampai tombol interaksi aktif, lalu ajak berbicara.',
      location: 'school.library', targetId, roomId: 'school.library',
      callToAction: isNear ? 'Tekan E untuk bicara' : 'Dekati Bu Maya',
    };
  }
  const task = story.tasks.find(t => mission.activity_ids.includes(t.activity_id));
  if (!task) return {step,heading:'Periksa misi',instruction:'Konten aktivitas belum tersedia.',location:mission.room_id,targetId:null,roomId:mission.room_id,callToAction:'Buka Jurnal bukti'};
  const target = ROOMS[task.room_id]?.targets.find(t => t.kind === 'task' && t.objectId === task.object_id);
  const location = task.room_id;
  const titles: Record<string,string> = {
    observe:'Baca panduan redaksi', investigate:'Bandingkan dua contoh paragraf', decide:'Klasifikasikan dan jelaskan alasan',
  };
  const targetName: Record<string,string> = {
    observe:'buku panduan redaksi di meja perpustakaan', investigate:'map laporan di Ruang Guru', decide:'papan redaksi di Aula Diskusi',
  };
  const isNear = nearbyTargetId === target?.id;
  const instructions: Record<string,string> = {
    observe: 'Buka buku, baca panduan, lalu tekan “Selesai membaca” untuk melanjutkan.',
    investigate: 'Baca contoh sepeda Mira dan sepeda motor, lalu tuliskan perbedaan cara keduanya menyajikan informasi.',
    decide: 'Lengkapi klasifikasi, bukti, dan alasan untuk kedua paragraf. Jawaban tidak harus benar; permainan hanya memeriksa kelengkapan.',
  };
  return {
    step, heading: titles[task.template] ?? task.instruction,
    instruction: currentRoom !== location
      ? `Pergi ke ${ROOMS[location]?.title ?? location} melalui pintu sekolah. Tujuanmu adalah ${targetName[task.template] ?? 'objek misi'}.`
      : isNear
        ? `Kamu sudah dekat objek misi. Tekan E untuk membuka aktivitas. ${instructions[task.template] ?? ''}`
        : `Cari ${targetName[task.template] ?? 'objek misi'} dan dekati sampai tombol interaksi aktif. ${instructions[task.template] ?? ''}`,
    location, targetId: target?.id ?? null, roomId: location,
    callToAction: currentRoom !== location ? `Menuju ${ROOMS[location]?.title ?? location}` : isNear ? 'Tekan E untuk membuka tugas' : 'Dekati objek misi',
  };
}
