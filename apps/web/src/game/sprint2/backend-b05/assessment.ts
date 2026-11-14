import { StudentApiClient, StudentApiError, successData } from './client';

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
export type PendingAssessment = {
  attempt_id: string;
  status: 'pending_scoring';
  replayed: boolean;
  request_id: string;
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

export function parsePendingAssessment(raw: unknown): PendingAssessment {
  const { data, requestId } = successData(raw);
  if (!uuid.test(String(data.attempt_id)) || data.status !== 'pending_scoring' ||
      typeof data.replayed !== 'boolean' ||
      // The official B-05 endpoint does NOT return scoring or next_path yet.
      ['score', 'feedback', 'next_path'].some(field => field in data)) {
    throw new StudentApiError(502, 'BAD_RESPONSE', requestId,
      'Assessment B-05 belum mempunyai respons scoring resmi.');
  }
  return { attempt_id: data.attempt_id as string, status: 'pending_scoring',
    replayed: data.replayed, request_id: requestId };
}

export class StudentAssessmentApi {
  constructor(private readonly api: StudentApiClient) {}
  async submit(request: B05Submission): Promise<PendingAssessment> {
    const raw = await this.api.request('/assessments/submit', {
      method: 'POST', expectedStatus: 202, body: request,
    });
    return parsePendingAssessment(raw);
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
