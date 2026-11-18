/** LOCAL DEMO ONLY. No auth or persistent database. Never deploy this development middleware. */
import { assess, type Answer, type RubricItem } from '../../supabase/functions/_shared/rules/assessment/sprint1';
import { recommend } from '../../supabase/functions/_shared/rules/adaptive/sprint1';
const objective = 'LO-LIT-INFERENSI-01';
const rubric: RubricItem[] = [
  { item_id: 'ITEM-001', objective_id: objective, expected: 'P-002', options: ['P-001','P-002','P-003'], transfer: false, explanation: 'Catatan 80 kunjungan pada Juli dan 125 pada Agustus mendukung kenaikan jumlah kunjungan.' },
  { item_id: 'ITEM-002', objective_id: objective, expected: 'I-A', options: ['I-A','I-B','I-C'], transfer: false, explanation: '125 − 80 = 45. Perubahan jumlah tidak membuktikan satu-satunya penyebab, dan kunjungan bukan jumlah peminjaman.' },
  { item_id: 'ITEM-003', objective_id: objective, expected: 'T-B', options: ['T-A','T-B','T-C'], transfer: true, explanation: '30 − 20 = 10 peserta tambahan. Kehadiran sebagian siswa tidak membuktikan kesukaan semua siswa.' },
];
export function createDemoService() {
  const cache = new Map<string, { signature: string; response: ReturnType<typeof score> }>();
  function score(answers: Answer[], context: { hintsUsed: number; attemptCount: number }) {
    const result = assess(rubric, answers);
    const decision = recommend(objective, result.evidence.map(e => ({ ...e, ...context })));
    return { ok: true as const, request_id: crypto.randomUUID(), data: { attempt_id: crypto.randomUUID(), status: 'scored' as const, score: result.score, feedback: result.feedback, next_path: decision.path } };
  }
  return (input: unknown, context = { hintsUsed: 0, attemptCount: 1 }) => {
    if (!Number.isInteger(context.hintsUsed) || context.hintsUsed < 0 || !Number.isInteger(context.attemptCount) || context.attemptCount < 1) throw new Error('VALIDATION_ERROR');
    if (!input || typeof input !== 'object') throw new Error('VALIDATION_ERROR');
    const r = input as { quest_version_id?: unknown; idempotency_key?: unknown; answers?: unknown };
    if (r.quest_version_id !== 'QV-DEMO-001' || typeof r.idempotency_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.idempotency_key) || !Array.isArray(r.answers) || !r.answers.length || r.answers.length > 3 || !r.answers.every(a => a && typeof a.item_id === 'string' && typeof a.value === 'string')) throw new Error('VALIDATION_ERROR');
    const signature = JSON.stringify({ version: r.quest_version_id, answers: r.answers, context });
    const saved = cache.get(r.idempotency_key);
    if (saved) { if (signature !== saved.signature) throw new Error('CONFLICT'); return saved.response; }
    const response = score(r.answers, context);
    if (cache.size >= 1000) throw new Error('RATE_LIMITED');
    cache.set(r.idempotency_key, { signature, response });
    return response;
  };
}
