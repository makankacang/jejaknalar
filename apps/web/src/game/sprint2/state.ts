import { validateSubmission, parseResponse, assessmentItem, type Submission, type AssessmentEnvelope } from './assessment';
import { DIALOGUE } from './dialogue';
import { REGISTRY_VERSION, ROOMS, roomId, safeSpawn, blocked, canInteract, type Heading, type Point } from './world';
import type { Episode, Task } from './content';
export type LearningPath = 'needs_support' | 'developing' | 'ready_for_extension';
export type MissionStatus = 'locked' | 'available' | 'active' | 'completed' | 'skipped';
export type TaskDraft = { seen: number[]; selection: number | null; power: boolean; duration: number; touched: boolean };
export type AssessmentReceipt = { request: Submission; response: AssessmentEnvelope };
export type State = { feedback: Partial<Record<'decide' | 'transfer', AssessmentReceipt>>; version: 1; registry: string; episode: string; questVersion: string; room: string; position: Point; heading: Heading; statuses: Record<string, MissionStatus>; evidence: string[]; heldItem: string | null; delivered: boolean; drafts: Record<string, TaskDraft>; dialogue: string; route: string | null; visited: string[]; revision: number; decision: { status: 'need_more_evidence' | 'decided'; path: LearningPath | null; simulation: true }; ending: LearningPath | null };
export type Intent = {type:'npc_open';npcId:string} | { type: 'position'; position: Point; heading: Heading } | { type: 'door'; targetId: string } | { type: 'dialogue'; choice: 'library' | 'office' | 'deliver' } | { type: 'start'; task: string } | { type: 'draft'; task: string; draft: TaskDraft } | { type: 'complete'; task: string; assessment?: AssessmentReceipt } | { type: 'skip'; task: string };
export const emptyDraft = (): TaskDraft => ({ seen: [], selection: null, power: false, duration: 1, touched: false });
export function initial(ep: Episode): State { const room = roomId(ep.world, 0); return { feedback: {}, version: 1, registry: REGISTRY_VERSION, episode: ep.id, questVersion: ep.quest_version_id, room, position: { ...ROOMS[room].spawn }, heading: 'down', statuses: Object.fromEntries(Object.values(ep.tasks).map(t => [t.task_id, t.prerequisite.length ? 'locked' : 'available'])), evidence: [], heldItem: null, delivered: false, drafts: {}, dialogue: 'start', route: null, visited: [room], revision: 0, decision: { status: 'need_more_evidence', path: null, simulation: true }, ending: null }; }
export function validateDAG(tasks: Record<string, Task>): boolean {
  const done = new Set<string>(), stack = new Set<string>();
  function visit(id: string): boolean { if (stack.has(id) || !tasks[id]) return false; if (done.has(id)) return true; stack.add(id); if (!tasks[id].prerequisite.every(visit)) return false; stack.delete(id); done.add(id); return true; }
  return Object.keys(tasks).every(visit);
}
export function validDraft(d: TaskDraft, task: Task): boolean {
  return !!d && Object.keys(d).length === 5 && Object.keys(d).every(k => ['seen', 'selection', 'power', 'duration', 'touched'].includes(k)) && Array.isArray(d.seen) && new Set(d.seen).size === d.seen.length && d.seen.every(n => Number.isInteger(n) && n >= 0 && n < task.sections.length) && (d.selection === null || (Number.isInteger(d.selection) && d.selection >= 0 && d.selection < (task.options?.length ?? 0))) && typeof d.power === 'boolean' && typeof d.touched === 'boolean' && Number.isInteger(d.duration) && d.duration >= 1 && d.duration <= 8;
}
export function ready(task: Task, d: TaskDraft): boolean { if (!validDraft(d, task)) return false; switch (task.kind) { case 'observe': return d.seen.length === task.sections.length; case 'operate': return d.touched; case 'investigate': return d.seen.length === task.sections.length && d.selection !== null; case 'decide': return d.selection !== null; } }
function onsite(ep: Episode, s: State, task: string) { return ROOMS[s.room].world === ep.world && ROOMS[s.room].targets.some(t => t.task === task && canInteract(ROOMS[s.room], s.position, t)); }
export function reduce(ep: Episode, state: State, intent: Intent, explorer = false): State {
  const s: State = structuredClone(state), room = ROOMS[s.room];
  const reject = (message: string): never => { throw new Error(message); };
  if (intent.type === 'position') { s.position = blocked(room, intent.position) ? { ...room.spawn } : { ...intent.position }; s.heading = intent.heading; }
  if (intent.type === 'door') {
    const door = room.targets.find(t => t.id === intent.targetId && t.kind === 'door');
    if (!door?.to || !canInteract(room, s.position, door)) return reject('Dekati pintu terlebih dahulu.');
    if (!explorer && door.required && s.statuses[door.required] !== 'completed') return reject('Pintu terkunci: selesaikan ' + (ep.tasks[door.required]?.title ?? 'misi prasyarat') + ' dahulu.');
    const dest = ROOMS[door.to]; if (!dest || dest.world !== ep.world) return reject('WORLD_MISMATCH');
    s.room = dest.id; s.position = safeSpawn(dest, door.portal?.target_spawn ?? dest.spawn); s.visited = [...new Set([...s.visited, dest.id])];
  }
  if(intent.type==='npc_open'){const npc=room.targets.find(t=>t.kind==='npc'&&t.id===intent.npcId);if(!npc||!canInteract(room,s.position,npc))return reject('NPC terlalu jauh atau terhalang.');s.dialogue='start';}
  if (intent.type === 'dialogue') {
    if (!room.targets.some(t => t.kind === 'npc' && canInteract(room, s.position, t))) return reject('NPC terlalu jauh atau terhalang.');
    const choice = DIALOGUE.start.choices.find(c => c.id === intent.choice); if (!choice) return reject('DIALOGUE_CHOICE_UNSUPPORTED');
    if (choice.requires === 'held_item' && !s.heldItem) return reject('Belum membawa titipan.');
    if (intent.choice === 'deliver') { if (!s.heldItem) return reject('Belum membawa titipan.'); s.heldItem = null; s.delivered = true; s.dialogue = 'thanks'; }
    else { s.route = intent.choice; s.dialogue = choice.next; }
  }
  if ('task' in intent) {
    const task = ep.tasks[intent.task]; if (!task) return reject('TASK_UNSUPPORTED');
    if (!onsite(ep, s, intent.task)) return reject('Dekati objek task dahulu.');
    if (intent.type === 'skip') { if (intent.task !== 'side' || s.statuses.side === 'completed') return reject('Hanya side quest belum selesai boleh dilewati.'); s.statuses.side = 'skipped'; }
    else {
      if (s.statuses[intent.task] === 'locked' || s.statuses[intent.task] === 'skipped') return reject('Prasyarat: ' + task.prerequisite.join(', '));
      if (intent.type === 'start' && s.statuses[intent.task] !== 'completed') s.statuses[intent.task] = 'active';
      if (intent.type === 'draft') { if (!validDraft(intent.draft, task)) return reject('DRAFT_INVALID'); if (s.statuses[intent.task] !== 'completed') { s.drafts[intent.task] = structuredClone(intent.draft); if(intent.task==='decide'||intent.task==='transfer')delete s.feedback[intent.task]; } }
      if (intent.type === 'complete' && s.statuses[intent.task] !== 'completed') {
        const d = s.drafts[intent.task] ?? emptyDraft(); if (!ready(task, d)) return reject('Lakukan interaksi terlebih dahulu.');
        if (intent.task === 'transfer' && s.decision.path === 'needs_support' && s.statuses.support !== 'completed') return reject('Kunjungi meja pendampingan dahulu.');
        if (intent.task === 'decide' || intent.task === 'transfer') {
          if (!intent.assessment) return reject('SUBMIT_REQUIRED: kirim assessment dahulu.');
          const request=validateSubmission(intent.assessment.request,intent.task), response=parseResponse(intent.assessment.response,request);
          if(request.answers[0].value!==assessmentItem(intent.task).options[d.selection!]?.id)return reject('ANSWER_CHANGED: gunakan attempt baru untuk jawaban berbeda.');
          s.feedback[intent.task]={request,response};
          if(response.data.next_path==='need_more_evidence'){s.revision++;return s;}
        }
        s.statuses[intent.task] = 'completed'; s.evidence = [...new Set([...s.evidence, task.evidence_id])];
        if (intent.task === 'side') s.heldItem = 'Titipan petugas';
        // Transparent local simulation, NEVER official score/mastery or an assessment endpoint.
        if (intent.task === 'decide') s.decision = { simulation: true, status: 'decided', path: s.feedback.decide!.response.data.next_path as LearningPath };
        if (intent.task === 'transfer') s.ending = s.feedback.transfer!.response.data.next_path as LearningPath;
      }
    }
  }
  for (const t of Object.values(ep.tasks)) if (s.statuses[t.task_id] === 'locked' && t.prerequisite.every(id => s.statuses[id] === 'completed')) s.statuses[t.task_id] = 'available';
  s.revision++;
  return s;
}
export function restore(ep: Episode, raw: string): { state: State; warning?: string } {
  try {
    const s: State = JSON.parse(raw), base = initial(ep), keys = Object.keys(ep.tasks);
    if (!s || Object.keys(s).length !== Object.keys(base).length || Object.keys(s).some(k => !(k in base))) throw Error('CHECKPOINT_SHAPE');
    if (s.version !== 1 || s.registry !== REGISTRY_VERSION || s.episode !== ep.id || s.questVersion !== ep.quest_version_id || ROOMS[s.room]?.world !== ep.world) throw Error('VERSION');
    if (!s.position || !Number.isFinite(s.position.x) || !Number.isFinite(s.position.y) || !['up', 'down', 'left', 'right'].includes(s.heading) || !Number.isInteger(s.revision) || s.revision < 0) throw Error('POSITION');
    if (!s.statuses || Object.keys(s.statuses).length !== keys.length || keys.some(k => !['locked', 'available', 'active', 'completed', ...(k === 'side' ? ['skipped'] : [])].includes(s.statuses[k]))) throw Error('STATUSES');
    if (!s.drafts || Object.entries(s.drafts).some(([k, d]) => !ep.tasks[k] || !validDraft(d, ep.tasks[k]))) throw Error('DRAFTS');
    for (const t of Object.values(ep.tasks)) {
      const deps = t.prerequisite.every(id => s.statuses[id] === 'completed');
      if ((s.statuses[t.task_id] !== 'locked' && !deps) || (s.statuses[t.task_id] === 'locked' && deps) || (s.statuses[t.task_id] === 'completed' && !ready(t, s.drafts[t.task_id]))) throw Error('DEPENDENCIES');
    }
    const expected = Object.values(ep.tasks).filter(t => s.statuses[t.task_id] === 'completed').map(t => t.evidence_id).sort();
    if (!Array.isArray(s.evidence) || JSON.stringify([...s.evidence].sort()) !== JSON.stringify(expected)) throw Error('EVIDENCE');
    if (!Array.isArray(s.visited) || !s.visited.includes(s.room) || s.visited.some(id => ROOMS[id]?.world !== ep.world)) throw Error('VISITED');
    if (!['start', 'library_hint', 'office_hint', 'thanks'].includes(s.dialogue) || ![null, 'library', 'office'].includes(s.route) || typeof s.delivered !== 'boolean' || ![null, 'Titipan petugas'].includes(s.heldItem)) throw Error('ITEM');
    if ((s.heldItem !== null || s.delivered) && s.statuses.side !== 'completed' || s.heldItem && s.delivered) throw Error('ITEM');
    if (!s.feedback || Object.keys(s.feedback).some(k=>!['decide','transfer'].includes(k))) throw Error('FEEDBACK');
    for(const id of ['decide','transfer'] as const){const f=s.feedback[id];if(f){validateSubmission(f.request,id);parseResponse(f.response,f.request);if(f.request.answers[0].value!==assessmentItem(id).options[s.drafts[id]?.selection??-1]?.id)throw Error('ANSWER_CHANGED');}if(s.statuses[id]==='completed'&&(!f||f.response.data.next_path==='need_more_evidence'))throw Error('SUBMIT_REQUIRED');}
    const path = s.statuses.decide === 'completed' ? s.feedback.decide!.response.data.next_path : null;
    if (!s.decision || s.decision.simulation !== true || s.decision.path !== path || s.decision.status !== (path ? 'decided' : 'need_more_evidence')) throw Error('DECISION');
    const ending = s.statuses.transfer === 'completed' ? s.feedback.transfer!.response.data.next_path : null;
    if (s.ending !== ending || (s.statuses.transfer === 'completed' && path === 'needs_support' && s.statuses.support !== 'completed')) throw Error('ENDING');
    const position = safeSpawn(ROOMS[s.room], s.position), recovered = position.x !== s.position.x || position.y !== s.position.y;
    return { state: { ...base, ...s, position }, warning: recovered ? 'Posisi dipulihkan ke titik aman.' : undefined };
  } catch { return { state: initial(ep), warning: 'Checkpoint tidak valid/berbeda versi. Episode dimulai ulang.' }; }
}
/** Local in-memory command adapter; localStorage is owned only by preview UI. */
export class PreviewSessionAdapter {
  private state: State;
  private cache = new Map<string, { payload: string; result: State }>();
  constructor(readonly episode: Episode, state = initial(episode), readonly explorer = false) { this.state = state; }
  snapshot() { return structuredClone(this.state); }
  command(id: string, revision: number, intent: Intent) { const payload = JSON.stringify(intent), cached = this.cache.get(id); if (cached) { if (cached.payload !== payload) throw Error('CONFLICT: idempotency key reused'); return structuredClone(cached.result); } if (revision !== this.state.revision) throw Error('CONFLICT: revision'); this.state = reduce(this.episode, this.state, intent, this.explorer); this.cache.set(id, { payload, result: this.snapshot() }); return this.snapshot(); }
}
