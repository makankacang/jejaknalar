import { StudentApiClient, StudentApiError, successData } from './client';
import type { AsyncSubmitData, AsyncSubmitRequest } from '../assessment/assessment-types';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const questVersion = /^QV-[A-Z0-9-]{1,97}$/;

/** Only item IDs from the exact PUBLISHED quest version may be submitted. */
export type PublishedItemCatalog = {
  origin: 'published-quest';
  quest_version_id: string;
  item_ids: readonly string[];
};
export type StudentAnswer = { item_id: string; value: string };
export type B05Submission = {
  quest_version_id: string;
  idempotency_key: string;
  answers: StudentAnswer[];
};
export type AssessmentReceipt = {
  attempt_id: string;
  status: 'pending_scoring' | 'scored' | 'insufficient_evidence';
  /** POST never returns an authoritative score; GET result owns the score. */
  score: null;
  replayed: boolean;
  request_id: string;
};
export type PendingAssessment = AssessmentReceipt;

export type OfficialAssessmentResult = AsyncSubmitData & {
  request_id: string;
  quest_version_id: string;
  scored_at: string | null;
};

/** Guard against accidental use of demo item identifiers or Q-001 -> ITEM-001 remaps. */
export function createSubmission(
  catalog: PublishedItemCatalog,
  answers: StudentAnswer[],
  idempotencyKey: string = crypto.randomUUID(),
): B05Submission {
  if (!catalog || catalog.origin !== 'published-quest' ||
      !questVersion.test(catalog.quest_version_id) || catalog.quest_version_id.length > 100 ||
      !Array.isArray(catalog.item_ids) || catalog.item_ids.length === 0 ||
      !uuid.test(idempotencyKey) || !Array.isArray(answers) || !answers.length || answers.length > 50) {
    throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'Versi, katalog published, atau idempotency key tidak valid.');
  }
  const allowed = new Set(catalog.item_ids);
  const seen = new Set<string>();
  for (const a of answers) {
    if (!a || typeof a.item_id !== 'string' || !a.item_id.trim() || a.item_id.length > 128 ||
        typeof a.value !== 'string' || a.value.length > 5000 ||
        !allowed.has(a.item_id) || seen.has(a.item_id)) {
      throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'Item tidak ada dalam versi published atau jawaban invalid/duplikat.');
    }
    seen.add(a.item_id);
  }
  return { quest_version_id: catalog.quest_version_id, idempotency_key: idempotencyKey,
    answers: answers.map(a => ({ item_id: a.item_id, value: a.value })) };
}

export function parseSubmissionReceipt(raw: unknown): AssessmentReceipt {
  const { data, requestId } = successData(raw);
  const statuses = ['pending_scoring', 'scored', 'insufficient_evidence'] as const;
  if (!uuid.test(String(data.attempt_id)) ||
      !statuses.includes(data.status as typeof statuses[number]) ||
      typeof data.replayed !== 'boolean' ||
      'score' in data || 'feedback' in data || 'next_path' in data) {
    throw new StudentApiError(502, 'BAD_RESPONSE', requestId,
      'Receipt assessment B-05 tidak sesuai kontrak.');
  }
  return { attempt_id: data.attempt_id as string, status: data.status as AssessmentReceipt['status'],
    score: null, replayed: data.replayed, request_id: requestId };
}

/** Backward-compatible export; accepts both HTTP 202 and final HTTP 200 replay. */
export const parsePendingAssessment = parseSubmissionReceipt;

export function parseOfficialAssessmentResult(raw: unknown, expectedAttemptId: string): OfficialAssessmentResult {
  const { data, requestId } = successData(raw);
  const status = data.status;
  const score = data.score;
  const scoredAt = data.scored_at;
  if (!uuid.test(String(data.attempt_id)) || data.attempt_id !== expectedAttemptId ||
      !questVersion.test(String(data.quest_version_id)) ||
      !['pending_scoring', 'scored', 'insufficient_evidence'].includes(String(status)) ||
      (status === 'scored' && (!Number.isInteger(score) || Number(score) < 0 || Number(score) > 100)) ||
      ((status === 'pending_scoring' || status === 'insufficient_evidence') && score !== null) ||
      !(scoredAt === null || typeof scoredAt === 'string')) {
    throw new StudentApiError(502, 'BAD_RESPONSE', requestId, 'Hasil assessment backend tidak valid.');
  }
  return {
    attempt_id: data.attempt_id as string,
    quest_version_id: data.quest_version_id as string,
    status: status as OfficialAssessmentResult['status'],
    score: score as number | null,
    scored_at: scoredAt as string | null,
    request_id: requestId,
  };
}

export class StudentAssessmentApi {
  constructor(private readonly api: StudentApiClient) {}

  async submit(request: B05Submission | AsyncSubmitRequest): Promise<AssessmentReceipt> {
    const raw = await this.api.request('/assessments/submit', {
      method: 'POST', expectedStatus: 202, expectedStatuses: [202, 200], body: request,
    });
    const receipt = parseSubmissionReceipt(raw);
    return { attempt_id: receipt.attempt_id, status: receipt.status, score: null,
      replayed: receipt.replayed, request_id: receipt.request_id };
  }

  async getResult(attemptId: string): Promise<AsyncSubmitData & { request_id?: string; quest_version_id?: string; scored_at?: string | null }> {
    if (!uuid.test(attemptId)) throw new StudentApiError(422, 'VALIDATION_ERROR', null, 'attempt_id tidak valid.');
    const raw = await this.api.request(`/assessments/${encodeURIComponent(attemptId)}/result`, {
      method: 'GET', expectedStatus: 200,
    });
    return parseOfficialAssessmentResult(raw, attemptId);
  }
}

export type SubmitPhase = 'idle' | 'ready' | 'submitting' | 'pending_scoring' | 'error';
/**
 * One submission per pending request. Lost responses are retried with exact same
 * JSON + idempotency_key, never by generating another key inside retry().
 */
export class StudentSubmitController {
  phase: SubmitPhase = 'idle';
  pendingRequest: B05Submission | null = null;
  accepted: PendingAssessment | null = null;
  lastError: StudentApiError | null = null;
  constructor(private readonly api: StudentAssessmentApi) {}

  prepare(catalog: PublishedItemCatalog, answers: StudentAnswer[], idempotencyKey?: string): B05Submission {
    if (this.phase === 'submitting') throw new Error('SUBMIT_IN_PROGRESS');
    const request = createSubmission(catalog, answers, idempotencyKey);
    this.pendingRequest = request;
    this.accepted = null;
    this.lastError = null;
    this.phase = 'ready';
    return structuredClone(request);
  }

  async submitOrRetry(): Promise<PendingAssessment> {
    if (this.phase === 'submitting') throw new Error('SUBMIT_IN_PROGRESS');
    if (this.phase === 'pending_scoring' && this.accepted) return this.accepted;
    if (!this.pendingRequest) throw new Error('NO_PENDING_SUBMISSION');
    this.phase = 'submitting';
    try {
      const result = await this.api.submit(structuredClone(this.pendingRequest));
      this.accepted = result;
      this.phase = 'pending_scoring';
      this.lastError = null;
      return result;
    } catch (e) {
      this.phase = 'error';
      this.lastError = e instanceof StudentApiError ? e :
        new StudentApiError(0, 'NETWORK_ERROR', null, 'Koneksi gagal.');
      throw this.lastError;
    }
  }
}

export const isOfficialScore = (data: unknown): false => {
  // No official scoring endpoint exists in the audited B-05 code.
  void data;
  return false;
};

export const hasOfficialBedaJalur = (value: unknown): false => {
  void value;
  return false;
};
