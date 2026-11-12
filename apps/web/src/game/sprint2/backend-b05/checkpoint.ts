import { isRecord, StudentApiClient, StudentApiError, successData } from './client';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const versionId = /^QV-[A-Z0-9-]{1,97}$/;
const encoder = new TextEncoder();

/** A B-05 checkpoint is unverified UI state. It is NEVER learning evidence or a score. */
export type UiProgress = {
  kind: 'jejaknalar.pic-d.ui.v1';
  registry_version: string;
  world: 'school' | 'city';
  room: string;
  position: { x: number; y: number };
  heading: 'up' | 'down' | 'left' | 'right';
  visited: string[];
  ui_task_statuses: Record<string, 'locked' | 'available' | 'active' | 'completed' | 'skipped'>;
  local_evidence_ids: string[]; // not academically verified
};
export type Checkpoint = {
  checkpoint_id: string;
  quest_version_id: string;
  revision: number;
  progress: unknown;
  updated_at: string;
};
export type SavedCheckpoint = Checkpoint & { progress: UiProgress };

export function parseUiProgress(raw: unknown): UiProgress {
  if (!isRecord(raw) ||
      Object.keys(raw).sort().join(',') !== 'heading,kind,local_evidence_ids,position,registry_version,room,ui_task_statuses,visited,world' ||
      raw.kind !== 'jejaknalar.pic-d.ui.v1' ||
      typeof raw.registry_version !== 'string' || !raw.registry_version.trim() ||
      (raw.world !== 'school' && raw.world !== 'city') ||
      typeof raw.room !== 'string' || !raw.room.trim() ||
      !['up', 'down', 'left', 'right'].includes(String(raw.heading)) ||
      !isRecord(raw.position) || typeof raw.position.x !== 'number' || typeof raw.position.y !== 'number' ||
      !Number.isFinite(raw.position.x) || !Number.isFinite(raw.position.y) ||
      !Array.isArray(raw.visited) || raw.visited.some(x => typeof x !== 'string') ||
      !isRecord(raw.ui_task_statuses) || Object.values(raw.ui_task_statuses).some(
        value => !['locked', 'available', 'active', 'completed', 'skipped'].includes(String(value))) ||
      !Array.isArray(raw.local_evidence_ids) || raw.local_evidence_ids.some(x => typeof x !== 'string')) {
    throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'Format checkpoint UI PIC D tidak valid.');
  }
  return structuredClone(raw) as UiProgress;
}

export function parseCheckpoint(raw: unknown, questVersionId: string): Checkpoint | null {
  const { data } = successData(raw);
  if (data.checkpoint === null) return null;
  const c = data.checkpoint;
  if (!isRecord(c) || !uuid.test(String(c.checkpoint_id)) ||
      c.quest_version_id !== questVersionId || typeof c.revision !== 'number' || !Number.isSafeInteger(c.revision) ||
      Number(c.revision) < 1 || !isRecord(c.progress) || typeof c.updated_at !== 'string') {
    throw new StudentApiError(502, 'BAD_RESPONSE', null, 'Checkpoint B-05 tidak valid.');
  }
  // Progress remains untrusted until parseUiProgress + world/registry validation.
  return { checkpoint_id: c.checkpoint_id as string, quest_version_id: c.quest_version_id as string,
    revision: c.revision as number, progress: c.progress, updated_at: c.updated_at };
}

export class StudentCheckpointApi {
  constructor(private readonly api: StudentApiClient) {}

  async load(questVersionId: string): Promise<Checkpoint | null> {
    if (!versionId.test(questVersionId) || questVersionId.length > 100) {
      throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'Quest version tidak valid.');
    }
    const raw = await this.api.request(`/checkpoints/${encodeURIComponent(questVersionId)}`, {
      method: 'GET', expectedStatus: 200,
    });
    return parseCheckpoint(raw, questVersionId);
  }

  /** Do not auto-retry 409 with a new revision: reload and ask user to reconcile. */
  async save(questVersionId: string, expectedRevision: number, progress: UiProgress): Promise<SavedCheckpoint> {
    if (!versionId.test(questVersionId) || questVersionId.length > 100 ||
        !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'Quest version atau expected_revision invalid.');
    }
    const clean = parseUiProgress(progress);
    const body = { expected_revision: expectedRevision, progress: clean };
    if (encoder.encode(JSON.stringify(body)).byteLength > 20000 ||
        encoder.encode(JSON.stringify(clean)).byteLength > 16384) {
      throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'Checkpoint melebihi batas B-05.');
    }
    const raw = await this.api.request(`/checkpoints/${encodeURIComponent(questVersionId)}`, {
      method: 'PUT', expectedStatus: 200, body,
    });
    const result = parseCheckpoint(raw, questVersionId);
    if (!result || result.revision <= expectedRevision) {
      throw new StudentApiError(502, 'BAD_RESPONSE', null, 'Revision checkpoint tidak bertambah.');
    }
    return { ...result, progress: parseUiProgress(result.progress) };
  }
}

/** Never auto-trust server position: host game must validate room, bounds, collision, registry. */
export function matchesWorldAndRegistry(
  progress: UiProgress, expectedWorld: UiProgress['world'], expectedRegistry: string,
): boolean {
  return progress.world === expectedWorld && progress.registry_version === expectedRegistry;
}
