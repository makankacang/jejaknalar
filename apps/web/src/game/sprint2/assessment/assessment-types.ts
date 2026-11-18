/** D-04 asynchronous assessment types. Separate from immutable Sprint 0 Contract V1. */
export type AssessmentFinalStatus = 'scored' | 'insufficient_evidence';
export type AssessmentStatus = 'pending_scoring' | AssessmentFinalStatus;

export interface AsyncSubmitRequest {
  quest_version_id: string;
  idempotency_key: string;
  answers: Array<{ item_id: string; value: string }>;
}

export interface AsyncSubmitData {
  attempt_id: string;
  status: AssessmentStatus;
  /** Backend score is intentionally nullable; no client-generated score is permitted. */
  score: number | null;
  scored_at?: string | null;
}

export interface AsyncAssessmentEnvelope {
  ok: true;
  request_id?: string;
  data: AsyncSubmitData;
}

export interface AsyncAssessmentErrorEnvelope {
  ok: false;
  request_id?: string;
  error: { code?: string; message?: string };
}

export type AsyncAssessmentResponse = AsyncAssessmentEnvelope;

export interface AssessmentTransport {
  submit(input: AsyncSubmitRequest, accessCode: string, idempotencyKey: string): Promise<AsyncAssessmentEnvelope>;
  getResult(attemptId: string, accessCode: string): Promise<AsyncAssessmentEnvelope>;
}

export interface AssessmentPortAsync {
  submit(input: AsyncSubmitRequest): Promise<AsyncSubmitData>;
  getResult(attemptId: string): Promise<AsyncSubmitData>;
}

export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  /** Injectable delay makes polling deterministic in unit tests. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface AssessmentEndpointConfig {
  /** Full submit URL, e.g. /functions/v1/student-api/assessments/submit. */
  submitUrl: string;
  /** Configurable builder; endpoint path is not hardcoded into the transport. */
  resultUrl: (attemptId: string) => string;
  /** Must return the individual student's access code at request time. */
  getAccessCode: () => string | Promise<string>;
}
