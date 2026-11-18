/** PIC D: C-03 draft Story Bundle -> validated preview-only scene plan. */
import { REGISTRY_VERSION, ROOMS } from '../world';
import type { TaskKind } from '../content';

export type StoryRef = { document_id: string; text_version: string; source_map_id: string; excerpt: string; locator: { kind: 'pdf_page'; page: number } | { kind: 'docx_paragraph'; paragraph_index: number; section?: string } };
export type StoryTask = { activity_id: string; room_id: string; object_id: string; template: TaskKind; objective_ids: string[]; instruction: string; source_refs: StoryRef[]; evidence_ids?: string[]; public_item_ids?: string[] };
export type StoryMission = { mission_id: string; objective_ids: string[]; required: boolean; room_id: string; prerequisites: string[]; activity_ids: string[] };
export type StoryDialogue = { npc_id: string; room_id: string; start_node_id: string; nodes: { node_id: string; text: string; source_refs?: StoryRef[]; choices: { choice_id: string; label: string; next_node_id?: string; unlock_mission_id?: string }[] }[] };
export type StoryBundle = { bundle_schema_version: '0.1-draft'; quest_version_id: string; source_document_versions: { document_id: string; text_version: string }[]; registry_version: string; world_preset: 'school' | 'city'; start_room_id: string; title: string; opening: string; missions: StoryMission[]; dialogues: StoryDialogue[]; tasks: StoryTask[]; evidence: { evidence_id: string; mission_id: string; room_id: string; object_id: string; objective_ids: string[]; title: string; summary: string; source_refs: StoryRef[] }[]; endings: Partial<Record<'needs_support' | 'developing' | 'ready_for_extension', string>> };
export type QuestV1 = { schema_version: '1.0'; quest_version_id: string; objective_ids: string[]; scene_id: string };
export type StoryPlan = { previewOnly: true; title: string; prologue: string; startRoom: string; objectives: { id: string; label: string; room: string; activityIds: string[] }[]; dialogues: StoryDialogue[]; tasks: StoryTask[] };
export class StoryContractError extends Error { constructor(readonly issues: string[]) { super(issues.join('; ')); this.name = 'StoryContractError'; } }
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const unique = (xs: string[]) => new Set(xs).size === xs.length;
/** Explicit mapping: no guessing scene_id -> room_id or NPC/object identifiers. */
export function adaptStoryBundle(input: unknown, quest: QuestV1, options: { registryVersion?: string; allowedSceneIds: string[]; allowedItemIds?: string[] } ): StoryPlan {
  const errors: string[] = [];
  if (!record(input)) throw new StoryContractError(['Bundle must be an object']);
  const b = input as Record<string, unknown>;
  if (b.bundle_schema_version !== '0.1-draft') errors.push('Unsupported bundle_schema_version');
  if (b.quest_version_id !== quest.quest_version_id) errors.push('quest_version_id mismatch');
  if (b.registry_version !== (options.registryVersion ?? REGISTRY_VERSION)) errors.push('registry_version mismatch: C-03 draft is not automatically playable');
  if (!options.allowedSceneIds.includes(quest.scene_id)) errors.push('Quest scene_id not explicitly approved');
  if (b.world_preset !== 'school' && b.world_preset !== 'city') errors.push('Unknown world_preset');
  if (!text(b.title) || !text(b.opening)) errors.push('Missing title/opening');
  const roomOK = (id: unknown) => text(id) && !!ROOMS[id] && ROOMS[id].world === b.world_preset;
  if (!roomOK(b.start_room_id)) errors.push('Unknown start_room_id');
  if (!Array.isArray(b.source_document_versions) || !b.source_document_versions.length) errors.push('Missing source document versions');
  const versions = new Set((Array.isArray(b.source_document_versions) ? b.source_document_versions : []).filter(record).map(v => `${v.document_id}:${v.text_version}`));
  const objectiveIDs = new Set(quest.objective_ids);
  const validateObjectives = (ids: unknown, where: string) => { if (!Array.isArray(ids) || !ids.length || ids.some(x => !text(x) || !objectiveIDs.has(x))) errors.push(`Invalid objective_ids at ${where}`); };
  const validateRefs = (refs: unknown, where: string) => {
    if (!Array.isArray(refs) || !refs.length) { errors.push(`Missing source_refs at ${where}`); return; }
    for (const r of refs) {
      if (!record(r) || !text(r.document_id) || !text(r.text_version) || !versions.has(`${r.document_id}:${r.text_version}`) || !text(r.source_map_id) || !text(r.excerpt) || !record(r.locator) || !(r.locator.kind === 'pdf_page' && Number.isInteger(r.locator.page) && Number(r.locator.page) >= 1 || r.locator.kind === 'docx_paragraph' && Number.isInteger(r.locator.paragraph_index) && Number(r.locator.paragraph_index) >= 1)) errors.push(`Invalid source reference at ${where}`);
    }
  };
  const missions = Array.isArray(b.missions) ? b.missions as StoryMission[] : [];
  const tasks = Array.isArray(b.tasks) ? b.tasks as StoryTask[] : [];
  const dialogues = Array.isArray(b.dialogues) ? b.dialogues as StoryDialogue[] : [];
  const evidence = Array.isArray(b.evidence) ? b.evidence as StoryBundle['evidence'] : [];
  if (!missions.length || !tasks.length || !Array.isArray(b.dialogues) || !Array.isArray(b.evidence)) errors.push('Missing missions/tasks/dialogues/evidence');
  const mids = missions.map(m => m?.mission_id), aids = tasks.map(t => t?.activity_id), eids = evidence.map(e => e?.evidence_id);
  if (!unique(mids) || !unique(aids) || !unique(eids) || [...mids,...aids,...eids].some(x=>!text(x))) errors.push('Duplicate or empty IDs');
  const taskById = new Map(tasks.map(t => [t.activity_id, t]));
  const missionById = new Map(missions.map(m => [m.mission_id, m]));
  for (const m of missions) {
    if (!roomOK(m.room_id)) errors.push(`Unknown mission room: ${m.mission_id}`);
    validateObjectives(m.objective_ids, `mission ${m.mission_id}`);
    if (!Array.isArray(m.activity_ids) || !m.activity_ids.length || m.activity_ids.some(id => !taskById.has(id))) errors.push(`Unknown activity in mission ${m.mission_id}`);
    if (!Array.isArray(m.prerequisites) || m.prerequisites.some(id => !missionById.has(id) || id === m.mission_id)) errors.push(`Unknown/self prerequisite ${m.mission_id}`);
  }
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (id: string): boolean => { if (visiting.has(id)) return false; if (done.has(id)) return true; const m = missionById.get(id); if (!m) return false; visiting.add(id); const ok = m.prerequisites.every(visit); visiting.delete(id); done.add(id); return ok; };
  if (!missions.every(m => visit(m.mission_id))) errors.push('Mission graph contains cycle');
  for (const t of tasks) {
    if (!roomOK(t.room_id) || !ROOMS[t.room_id]?.targets.some(x => x.objectId === t.object_id && x.kind === 'task')) errors.push(`Task object not playable: ${t.activity_id}`);
    if (!['observe','operate','investigate','decide'].includes(t.template)) errors.push(`Unknown task template: ${t.activity_id}`);
    validateObjectives(t.objective_ids, `task ${t.activity_id}`);
    validateRefs(t.source_refs, `task ${t.activity_id}`);
    if (!text(t.instruction)) errors.push(`Missing instruction: ${t.activity_id}`);
    if (t.evidence_ids?.some(id => !eids.includes(id))) errors.push(`Unknown evidence: ${t.activity_id}`);
    if (t.public_item_ids?.some(id => !options.allowedItemIds?.includes(id))) errors.push(`Unapproved public_item_ids: ${t.activity_id}`);
  }
  for (const e of evidence) {
    if (!missionById.has(e.mission_id) || !roomOK(e.room_id) || !ROOMS[e.room_id]?.targets.some(x => x.objectId === e.object_id)) errors.push(`Invalid evidence placement: ${e.evidence_id}`);
    validateObjectives(e.objective_ids, `evidence ${e.evidence_id}`);
    validateRefs(e.source_refs, `evidence ${e.evidence_id}`);
  }
  for (const d of dialogues) {
    const room = ROOMS[d.room_id];
    if (!roomOK(d.room_id) || !room?.targets.some(t => t.kind === 'npc' && t.id === d.npc_id)) errors.push(`Unknown NPC: ${d.npc_id}`);
    const nodes = new Map(d.nodes?.map(n => [n.node_id, n]) ?? []);
    if (!nodes.has(d.start_node_id) || nodes.size !== d.nodes?.length) errors.push(`Invalid dialogue graph: ${d.npc_id}`);
    for (const n of d.nodes ?? []) for (const c of n.choices ?? []) if ((!c.next_node_id && !c.unlock_mission_id) || c.next_node_id && !nodes.has(c.next_node_id) || c.unlock_mission_id && !missionById.has(c.unlock_mission_id)) errors.push(`Dangling dialogue choice: ${d.npc_id}`);
  }
  if (!record(b.endings)) errors.push('Missing endings');
  if (errors.length) throw new StoryContractError(errors);
  return { previewOnly: true, title: b.title as string, prologue: b.opening as string, startRoom: b.start_room_id as string, objectives: missions.map(m => ({id:m.mission_id,label:tasks.find(t=>m.activity_ids.includes(t.activity_id))?.instruction ?? m.mission_id,room:m.room_id,activityIds:[...m.activity_ids]})), dialogues, tasks };
}
