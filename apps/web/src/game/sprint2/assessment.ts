import episodeFixture from './assessment-demo.fixture.json';
import type { LearningPath } from './state';
export type Submission = { quest_version_id: string; idempotency_key: string; answers: { item_id: string; value: string }[] };
export type AssessmentData = { attempt_id: string; status: 'scored'; score: number; feedback: { item_id: string; correct: boolean; message: string }[]; next_path: LearningPath | 'need_more_evidence' };
export type AssessmentEnvelope = { ok: true; data: AssessmentData; request_id: string };
export type AssessmentPort = { readonly mode: 'preview' | 'student'; submit(input: Submission): Promise<unknown> };
export const ASSESSMENT_VERSION = episodeFixture.versionId;
/** Exact public IDs/options reused from existing local episode fixture, never Q-001 -> ITEM-001. */
export function assessmentItem(task: 'decide' | 'transfer') { return episodeFixture.rounds[task === 'decide' ? 0 : 1][0]; }
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (s: unknown) => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
export class AssessmentError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export function validateSubmission(input: unknown, task: 'decide' | 'transfer'): Submission {
 const item = assessmentItem(task);
 if (!isRecord(input) || Object.keys(input).sort().join(',') !== 'answers,idempotency_key,quest_version_id' || input.quest_version_id !== ASSESSMENT_VERSION || !uuid(input.idempotency_key) || !Array.isArray(input.answers) || input.answers.length !== 1) throw new AssessmentError(400,'Payload atau versi assessment tidak cocok.');
 const a = input.answers[0]; if (!isRecord(a) || Object.keys(a).sort().join(',') !== 'item_id,value' || a.item_id !== item.id || !item.options.some(o => o.id === a.value)) throw new AssessmentError(400,'Item tidak dikenal dalam versi quest ini. Tidak ada pemetaan ID otomatis.');
 return structuredClone(input) as Submission;
}
export function parseResponse(raw: unknown, input: Submission): AssessmentEnvelope {
 if (!isRecord(raw) || raw.ok !== true || typeof raw.request_id !== 'string' || !raw.request_id.trim() || !isRecord(raw.data)) throw new AssessmentError(502,'Respons assessment tidak valid.');
 const d = raw.data;
 if (!uuid(d.attempt_id) || d.status !== 'scored' || !Number.isInteger(d.score) || Number(d.score)<0 || Number(d.score)>100 || !['needs_support','developing','ready_for_extension','need_more_evidence'].includes(String(d.next_path)) || !Array.isArray(d.feedback) || d.feedback.length !== input.answers.length) throw new AssessmentError(502,'Isi feedback tidak sesuai kontrak.');
 const ids = new Set<string>(); for (const f of d.feedback) { if (!isRecord(f) || typeof f.item_id !== 'string' || ids.has(f.item_id) || !input.answers.some(a=>a.item_id===f.item_id) || typeof f.correct !== 'boolean' || typeof f.message !== 'string') throw new AssessmentError(502,'Mapping feedback tidak sesuai item yang dikirim.'); ids.add(f.item_id); }
 return structuredClone(raw) as AssessmentEnvelope;
}
export type MockScenario = 'automatic' | LearningPath | 'need_more_evidence' | 'offline' | '400' | '401' | '403' | '409' | '429' | '500' | 'lost_response';
/** DEMO routing only. Does not grade answers, import private keys or assign official mastery. */
export function mockDecision(evidenceCount: number, requested: MockScenario): LearningPath | 'need_more_evidence' {
 if (evidenceCount < 3 || requested === 'need_more_evidence') return 'need_more_evidence';
 if (requested === 'needs_support' || requested === 'developing' || requested === 'ready_for_extension') return requested;
 return 'developing';
}
export class MockAssessmentPort implements AssessmentPort {
 readonly mode = 'preview' as const;
 scenario: MockScenario = 'automatic'; evidenceCount = 0;
 constructor(private storage?: { read:(key:string)=>string|null; write:(key:string,value:string)=>void }) {}
 private results = new Map<string, { fingerprint: string; result: AssessmentEnvelope }>();
 async submit(input: Submission): Promise<unknown> {
  const task = input.answers[0]?.item_id === assessmentItem('transfer').id ? 'transfer' : 'decide'; validateSubmission(input,task);
  const fingerprint=JSON.stringify(input);let cached=this.results.get(input.idempotency_key);
  if(!cached&&this.storage){try{const raw=this.storage.read(input.idempotency_key);if(raw){const saved=JSON.parse(raw);if(typeof saved.fingerprint==='string'){const savedRequest=JSON.parse(saved.fingerprint);validateSubmission(savedRequest,task);cached={fingerprint:saved.fingerprint,result:parseResponse(saved.result,savedRequest)};this.results.set(input.idempotency_key,cached);}}}catch{/* Corrupt local mock receipt cannot authorize anything. */}}
  if(cached){if(cached.fingerprint!==fingerprint)throw new AssessmentError(409,'Idempotency key digunakan dengan jawaban berbeda.');return structuredClone(cached.result);}
  if(this.scenario==='offline')throw new AssessmentError(0,'Koneksi simulasi terputus.');
  if(/^\d+$/.test(this.scenario))throw new AssessmentError(Number(this.scenario),'Gangguan yang disuntikkan untuk QA simulasi.');
  const result:AssessmentEnvelope={ok:true,request_id:`preview-${input.idempotency_key}`,data:{attempt_id:input.idempotency_key,status:'scored',score:0,feedback:input.answers.map(a=>({item_id:a.item_id,correct:false,message:'SIMULASI: respons dicatat; jawaban tidak dinilai. Skor dan ketepatan resmi menunggu backend.'})),next_path:mockDecision(this.evidenceCount,this.scenario)}};
  this.results.set(input.idempotency_key,{fingerprint,result});try{this.storage?.write(input.idempotency_key,JSON.stringify({fingerprint,result}));}catch{/* Memory-only retry remains available. */}
  if(this.scenario==='lost_response')throw new AssessmentError(0,'Respons simulasi hilang setelah diproses. Retry memakai kunci yang sama.');
  return structuredClone(result);
 }
}
export function errorMessage(error: unknown): string {
 const status=error instanceof AssessmentError?error.status:0;
 const messages:Record<number,string>={0:'Koneksi gagal. Coba kirim ulang; jawaban dan kunci retry dipertahankan.',400:'Jawaban atau identitas item tidak valid. Periksa data sebelum mencoba lagi.',401:'Sesi tidak sah atau sudah berakhir. Mode resmi perlu autentikasi dari backend.',403:'Anda tidak memiliki izin untuk assessment ini.',409:'Konflik versi atau idempotensi. Mulai attempt baru setelah memeriksa versi.',422:'Data tidak memenuhi validasi endpoint.',429:'Terlalu banyak permintaan. Tunggu sebelum mencoba lagi.',500:'Layanan sedang bermasalah. Jawaban tetap tersimpan untuk retry.',502:'Respons tidak sesuai kontrak. Progress tidak diteruskan.'};
 return messages[status] ?? (status>=500?messages[500]:'Assessment belum tersedia.');
}
export type SubmissionState = { phase: 'idle'|'pending'|'submitting'|'success'|'error'; request: Submission|null; response: AssessmentEnvelope|null; error: string|null };
/** No production fetch implementation until B provides publish/auth/session authority. */
export class AssessmentController {
 state:SubmissionState={phase:'idle',request:null,response:null,error:null};
 constructor(private port:AssessmentPort){if(port.mode!=='preview')throw new AssessmentError(503,'BACKEND_NOT_READY');}
 prepare(task:'decide'|'transfer',value:string,key=crypto.randomUUID()) { if(this.state.phase==='submitting')throw Error('SUBMIT_IN_PROGRESS');const input=validateSubmission({quest_version_id:ASSESSMENT_VERSION,idempotency_key:key,answers:[{item_id:assessmentItem(task).id,value}]},task);this.state={phase:'pending',request:input,response:null,error:null}; }
 async send():Promise<AssessmentEnvelope|null> { if(!this.state.request)throw Error('NO_PENDING_SUBMISSION');if(this.state.phase==='submitting')return null;if(this.state.phase==='success')return this.state.response;const request=this.state.request;this.state={...this.state,phase:'submitting',error:null};try{const response=parseResponse(await this.port.submit(structuredClone(request)),request);this.state={...this.state,phase:'success',response};return response;}catch(e){this.state={...this.state,phase:'error',error:errorMessage(e)};return null;} }
 restorePending(task:'decide'|'transfer',input:unknown) { const request=validateSubmission(input,task);this.state={phase:'pending',request,response:null,error:null}; }
}
export const studentAvailability = () => ({ available:false as const, code:'BACKEND_NOT_READY' as const, message:'Endpoint authenticated, published authority dan mapping C5-02 belum tersedia. Preview tidak membuat nilai siswa resmi.' });

