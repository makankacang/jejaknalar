import { describe, expect, it, vi } from 'vitest';
import { AsyncAssessmentPort, FetchAssessmentTransport } from './assessment-port';
import { pollAssessmentResult } from './assessment-polling';
import { MockAssessmentTransport } from './mock-assessment-transport';
import type { AsyncAssessmentEnvelope, AsyncSubmitRequest } from './assessment-types';

const attemptId = '00000000-0000-4000-8000-000000000001';
const request: AsyncSubmitRequest = {
  quest_version_id: 'QV-TEST-001',
  idempotency_key: '00000000-0000-4000-8000-000000000002',
  answers: [{ item_id: 'ITEM-TEST-001', value: 'jawaban bebas siswa' }],
};
const envelope = (status: 'pending_scoring' | 'scored' | 'insufficient_evidence', score: number | null): AsyncAssessmentEnvelope => ({
  ok: true, request_id: 'req-test', data: { attempt_id: attemptId, status, score, scored_at: status === 'pending_scoring' ? null : '2026-11-14T00:00:00.000Z' },
});

describe('D-04 async assessment adapter (mock only)', () => {
  it('submits once and preserves server attempt_id and idempotency key', async () => {
    const transport = new MockAssessmentTransport(envelope('pending_scoring', null), []);
    const port = new AsyncAssessmentPort(transport, () => 'student-access');
    const result = await port.submit(request);
    expect(result.status).toBe('pending_scoring');
    expect(result.attempt_id).toBe(attemptId);
    expect(transport.submitted).toHaveLength(1);
    expect(transport.submitted[0].idempotencyKey).toBe(request.idempotency_key);
    expect(transport.submitted[0].accessCode).toBe('student-access');
  });

  it('polls the same attempt until scored without POST retry', async () => {
    const transport = new MockAssessmentTransport(envelope('pending_scoring', null), [envelope('pending_scoring', null), envelope('scored', 73)]);
    const port = new AsyncAssessmentPort(transport, () => 'access');
    await port.submit(request);
    const result = await pollAssessmentResult(port, attemptId, { intervalMs: 0, wait: async () => undefined });
    expect(result.status).toBe('scored');
    expect(result.score).toBe(73);
    expect(transport.submitted).toHaveLength(1);
    expect(transport.polled.map(x => x.attemptId)).toEqual([attemptId, attemptId]);
  });

  it('stops on insufficient_evidence with null score', async () => {
    const transport = new MockAssessmentTransport(envelope('pending_scoring', null), [envelope('insufficient_evidence', null)]);
    const port = new AsyncAssessmentPort(transport, () => 'access');
    const result = await pollAssessmentResult(port, attemptId, { intervalMs: 0, wait: async () => undefined });
    expect(result.status).toBe('insufficient_evidence');
    expect(result.score).toBeNull();
  });

  it('does not invent a result when polling remains pending', async () => {
    const transport = new MockAssessmentTransport(envelope('pending_scoring', null), [envelope('pending_scoring', null), envelope('pending_scoring', null)]);
    const port = new AsyncAssessmentPort(transport, () => 'access');
    await expect(pollAssessmentResult(port, attemptId, { maxAttempts: 2, intervalMs: 0, wait: async () => undefined })).rejects.toThrow('masih pending');
  });

  it('rejects missing access code and mismatched attempt id', async () => {
    const transport = new MockAssessmentTransport(envelope('pending_scoring', null), [envelope('scored', 50)]);
    const noAccess = new AsyncAssessmentPort(transport, () => '');
    await expect(noAccess.submit(request)).rejects.toThrow('access code');
    const port = new AsyncAssessmentPort(transport, () => 'access');
    await expect(port.getResult('00000000-0000-4000-8000-000000000099')).rejects.toThrow('tidak cocok');
  });

  it('uses configured URLs and required headers in fetch transport', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope('pending_scoring', null)), { status: 202, headers: { 'content-type': 'application/json' } }));
    const transport = new FetchAssessmentTransport({ submitUrl: '/submit-custom', resultUrl: id => `/result-custom/${id}`, fetchImpl: fetchImpl as typeof fetch });
    await transport.submit(request, 'access', request.idempotency_key);
    await transport.getResult(attemptId, 'access');
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/submit-custom', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'x-student-access-code': 'access', 'idempotency-key': request.idempotency_key }) }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, `/result-custom/${attemptId}`, expect.objectContaining({ method: 'GET', headers: { 'x-student-access-code': 'access' } }));
  });
});
