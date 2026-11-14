/** PIC D BI8 draft-only runtime model. This is NOT a public QuestV1 publication or assessment. */
import candidate from './story-bi8.json';
import { adaptStoryBundle, StoryContractError, type StoryBundle, type StoryPlan, type StoryTask, type QuestV1 } from '../../../game/sprint2/story-c03/adapter';
import { REGISTRY_VERSION, ROOMS } from '../../../game/sprint2/world';
import type { State } from '../../../game/sprint2/state';
import { initialStoryProgress, type StoryProgress } from '../../../game/sprint2/story-c03/runtime';

export const story = candidate as unknown as StoryBundle;

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

/** Input-hygiene only: reject repeated filler, not correctness. Real grading is server-only. */
export function hasReasonContent(text: string): boolean {
  const words = text.toLocaleLowerCase('id-ID').match(/[a-z\u00c0-\u024f]{3,}/g) ?? [];
  return text.trim().length >= 25 && words.length >= 5 && new Set(words).size >= 4;
}

export function canComplete(task: StoryTask, a: LocalAnswer): boolean {
  const readAll = task.source_refs.every((_, i) => a.viewedSourceIndices.includes(i));
  if (!readAll) return false;
  if (task.template === 'observe') return true;
  if (task.template === 'investigate') return hasReasonContent(a.comparison);
  if (task.template === 'decide') return a.categories.every(Boolean) &&
    a.evidenceIndices.every(i => i > 0 && i < task.source_refs.length) && a.evidenceIndices[0] !== a.evidenceIndices[1] &&
    a.reasons.every(hasReasonContent);
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
    observe:'buku tamu di meja perpustakaan', investigate:'map laporan di Ruang Guru', decide:'papan kasus di Aula Diskusi',
  };
  const isNear = nearbyTargetId === target?.id;
  const instructions: Record<string,string> = {
    observe: 'Buka panduan, baca kutipan materi, dan tandai bagian yang sudah dipelajari.',
    investigate: 'Baca contoh sepeda Mira dan sepeda motor, lalu tuliskan perbedaan kedua paragraf.',
    decide: 'Pilih jenis kedua paragraf, tentukan kutipan bukti, dan tuliskan alasan untuk masing-masing.',
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
