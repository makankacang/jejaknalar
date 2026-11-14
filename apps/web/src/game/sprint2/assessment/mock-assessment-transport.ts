import type { AssessmentTransport, AsyncAssessmentEnvelope, AsyncSubmitRequest } from './assessment-types';

/** Test-only transport. No network, scoring, or synthetic score is generated. */
export class MockAssessmentTransport implements AssessmentTransport {
  readonly submitted: Array<{ input: AsyncSubmitRequest; accessCode: string; idempotencyKey: string }> = [];
  readonly polled: Array<{ attemptId: string; accessCode: string }> = [];
  constructor(
    private readonly submitResponse: AsyncAssessmentEnvelope,
    private readonly pollResponses: AsyncAssessmentEnvelope[],
  ) {}

  async submit(input: AsyncSubmitRequest, accessCode: string, idempotencyKey: string): Promise<AsyncAssessmentEnvelope> {
    this.submitted.push({ input: structuredClone(input), accessCode, idempotencyKey });
    return structuredClone(this.submitResponse);
  }

  async getResult(attemptId: string, accessCode: string): Promise<AsyncAssessmentEnvelope> {
    this.polled.push({ attemptId, accessCode });
    const next = this.pollResponses.shift();
    if (!next) throw new Error('Tidak ada respons mock polling tersisa');
    return structuredClone(next);
  }
}
