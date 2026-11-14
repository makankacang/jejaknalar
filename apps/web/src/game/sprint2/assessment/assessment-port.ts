import type { AssessmentPortAsync, AsyncSubmitData, AsyncSubmitRequest, AssessmentTransport } from './assessment-types';

/** Domain adapter. It preserves the backend attempt ID and never fabricates a result. */
export class AsyncAssessmentPort implements AssessmentPortAsync {
  constructor(private readonly transport: AssessmentTransport, private readonly getAccessCode: () => string | Promise<string>) {}

  async submit(input: AsyncSubmitRequest): Promise<AsyncSubmitData> {
    const accessCode = await this.requireAccessCode();
    const response = await this.transport.submit(input, accessCode, input.idempotency_key);
    this.assertAttempt(response.data);
    return response.data;
  }

  async getResult(attemptId: string): Promise<AsyncSubmitData> {
    if (!attemptId.trim()) throw new Error('attempt_id wajib diisi untuk polling hasil');
    const accessCode = await this.requireAccessCode();
    const response = await this.transport.getResult(attemptId, accessCode);
    if (response.data.attempt_id !== attemptId) throw new Error('attempt_id pada hasil tidak cocok');
    this.assertAttempt(response.data);
    return response.data;
  }

  private async requireAccessCode(): Promise<string> {
    const value = await this.getAccessCode();
    if (!value || !value.trim()) throw new Error('Student access code tidak tersedia');
    return value;
  }

  private assertAttempt(data: AsyncSubmitData): void {
    if (!data.attempt_id?.trim()) throw new Error('Respons submit tidak memiliki attempt_id');
    if (data.status === 'scored' && (!Number.isInteger(data.score) || data.score! < 0 || data.score! > 100)) {
      throw new Error('Skor backend tidak valid');
    }
    if (data.status === 'insufficient_evidence' && data.score !== null) {
      throw new Error('insufficient_evidence harus memiliki score null');
    }
    if (data.status === 'pending_scoring' && data.score !== null) {
      throw new Error('pending_scoring tidak boleh membawa skor final');
    }
  }
}

/** Fetch transport is explicit opt-in: construct only when live integration is approved. */
export class FetchAssessmentTransport implements AssessmentTransport {
  constructor(private readonly config: { submitUrl: string; resultUrl: (attemptId: string) => string; fetchImpl?: typeof fetch }) {}

  async submit(input: import('./assessment-types').AsyncSubmitRequest, accessCode: string, idempotencyKey: string) {
    const response = await (this.config.fetchImpl ?? fetch)(this.config.submitUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-student-access-code': accessCode,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(input),
    });
    return this.readEnvelope(response);
  }

  async getResult(attemptId: string, accessCode: string) {
    const response = await (this.config.fetchImpl ?? fetch)(this.config.resultUrl(attemptId), {
      method: 'GET',
      headers: { 'x-student-access-code': accessCode },
    });
    return this.readEnvelope(response);
  }

  private async readEnvelope(response: Response) {
    let body: unknown;
    try { body = await response.json(); } catch { throw new Error(`Assessment API mengembalikan JSON tidak valid (HTTP ${response.status})`); }
    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
      throw new Error(message);
    }
    if (typeof body !== 'object' || body === null || !('ok' in body) || (body as { ok?: unknown }).ok !== true || !('data' in body)) {
      throw new Error('Envelope assessment API tidak sesuai kontrak');
    }
    const data = (body as { data: unknown }).data;
    if (typeof data !== 'object' || data === null || !('attempt_id' in data) || !('status' in data) || !('score' in data)) {
      throw new Error('Data assessment API tidak lengkap');
    }
    const status = (data as { status: unknown }).status;
    if (status !== 'pending_scoring' && status !== 'scored' && status !== 'insufficient_evidence') {
      throw new Error('Status assessment tidak dikenal');
    }
    return body as import('./assessment-types').AsyncAssessmentEnvelope;
  }
}
