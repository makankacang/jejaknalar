import type { AssessmentPortAsync, AsyncSubmitData, PollOptions } from './assessment-types';

export function waitForPoll(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Polling dibatalkan'));
    const timer = setTimeout(done, ms);
    function done() { signal?.removeEventListener('abort', abort); resolve(); }
    function abort() { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Polling dibatalkan')); }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Poll only the existing attempt. This function never resubmits POST. */
export async function pollAssessmentResult(
  port: AssessmentPortAsync,
  attemptId: string,
  options: PollOptions = {},
): Promise<AsyncSubmitData & { status: 'scored' | 'insufficient_evidence' }> {
  const intervalMs = options.intervalMs ?? 2000;
  const maxAttempts = options.maxAttempts ?? 30;
  const wait = options.wait ?? waitForPoll;
  if (!attemptId.trim()) throw new Error('attempt_id wajib diisi');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts minimal 1');
  if (!Number.isFinite(intervalMs) || intervalMs < 0) throw new Error('intervalMs tidak valid');

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw new Error('Polling dibatalkan');
    const result = await port.getResult(attemptId);
    if (result.attempt_id !== attemptId) throw new Error('attempt_id hasil polling tidak cocok');
    if (result.status === 'scored' || result.status === 'insufficient_evidence') {
      const finalStatus: 'scored' | 'insufficient_evidence' = result.status;
      return { ...result, status: finalStatus };
    }
    if (attempt < maxAttempts - 1) await wait(intervalMs, options.signal);
  }
  throw new Error(`Hasil assessment masih pending setelah ${maxAttempts} pemeriksaan`);
}
