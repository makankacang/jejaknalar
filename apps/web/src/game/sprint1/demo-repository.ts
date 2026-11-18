import type { AssessmentPortV1, SubmitAssessmentRequestV1, ApiSuccessV1, SubmitAssessmentDataV1 } from '../sprint0/repositories-v1';
const paths = ['needs_support', 'developing', 'ready_for_extension', 'need_more_evidence'];
/** Calls LOCAL fixture service only; public client never imports the private rubric. */
export class DemoAssessmentRepository implements AssessmentPortV1 {
  failNext = false;
  constructor(private readonly context: () => { hintsUsed: number; attemptCount: number } = () => ({ hintsUsed: 0, attemptCount: 1 })) {}
  async submitAnswers(input: SubmitAssessmentRequestV1): Promise<ApiSuccessV1<SubmitAssessmentDataV1>> {
    if (this.failNext) { this.failNext = false; throw new Error('SIMULATED_NETWORK_FAILURE'); }
    const response = await fetch('/__pic_d_demo/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Context': JSON.stringify(this.context()) }, body: JSON.stringify(input), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`DEMO_HTTP_${response.status}`);
    const result = await response.json();
    if (result?.ok !== true || result.data?.status !== 'scored' || !Number.isInteger(result.data.score) || result.data.score < 0 || result.data.score > 100 || !paths.includes(result.data.next_path) || !Array.isArray(result.data.feedback) || !result.data.feedback.every((f: {message?: unknown}) => typeof f.message === 'string')) throw new Error('INVALID_RESPONSE');
    return result;
  }
}
