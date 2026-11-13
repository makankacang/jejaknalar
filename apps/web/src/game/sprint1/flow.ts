/** Controller Sprint 1. Reuse transition engine, quest schema, & event types Sprint 0. */
import { transitionGameState, type GameEvent, type GameState } from '../sprint0/state-machine';
import { makeLearningEvent, type LearningEvent, type EventType } from '../sprint0/learning-events';
import type { QuestV1 } from '../sprint0/contract-v1';
import type { AssessmentPortV1, ApiSuccessV1, SubmitAssessmentDataV1, SubmitAssessmentRequestV1 } from '../sprint0/repositories-v1';
import type { SceneContent } from './content';

export type OverlayKind = 'npc' | 'document' | null;
export interface QuestSnapshot {
  state: GameState;
  overlay: OverlayKind;
  hasReadDocument: boolean;
  selectedEvidenceId: string | null;
  busy: boolean;
  submitError: string | null;
  result: SubmitAssessmentDataV1 | null;
  events: readonly LearningEvent[];
}

export class QuestFlow {
  private state: GameState = 'IDLE';
  private overlay: OverlayKind = null;
  private hasReadDocument = false;
  private selectedEvidenceId: string | null = null;
  private busy = false;
  private submitError: string | null = null;
  private result: SubmitAssessmentDataV1 | null = null;
  private pendingRequest: SubmitAssessmentRequestV1 | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly events: LearningEvent[] = [];
  private readonly localSessionId = crypto.randomUUID();

  constructor(
    readonly quest: QuestV1,
    readonly content: SceneContent,
    private readonly assessment: AssessmentPortV1,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  getSnapshot(): QuestSnapshot {
    return {
      state: this.state, overlay: this.overlay, hasReadDocument: this.hasReadDocument,
      selectedEvidenceId: this.selectedEvidenceId, busy: this.busy,
      submitError: this.submitError, result: this.result, events: [...this.events],
    };
  }
  private notify(): void { for (const listener of this.listeners) listener(); }
  private move(event: GameEvent): void { this.state = transitionGameState(this.state, event); this.notify(); }
  private log(eventType: EventType, payload: Record<string, string | number | boolean | null> = {}): void {
    this.events.push(makeLearningEvent({
      attemptId: this.localSessionId,
      questVersionId: this.quest.quest_version_id,
      objectiveId: this.quest.objective_ids[0],
      eventType, payload,
    }, crypto.randomUUID(), new Date().toISOString()));
    this.notify();
  }
  /** Event cache only; not persisted to Supabase until PIC B defines a protected endpoint. */
  start(): void {
    if (this.state !== 'IDLE') return;
    this.move('LOAD'); this.move('LOADED'); this.move('PLAY');
    this.log('QUEST_STARTED');
  }
  interactNpc(): void {
    if (this.state !== 'EXPLORING') return;
    this.move('INTERACT'); this.overlay = 'npc';
    this.log('NPC_INTERACTED', { npc_id: this.content.npc.id });
    this.notify();
  }
  openDocument(): void {
    if (this.state !== 'EXPLORING') return;
    this.move('INTERACT'); this.overlay = 'document'; this.notify();
  }
  closeInteraction(): void {
    if (this.state !== 'INTERACTING') return;
    if (this.overlay === 'document') {
      this.hasReadDocument = true;
      this.log('DOCUMENT_READ', { document_ref: this.content.document.id });
    }
    this.overlay = null; this.move('CLOSE_INTERACTION');
  }
  openChallenge(): void {
    if (!this.hasReadDocument || this.state !== 'EXPLORING') return;
    this.move('CHALLENGE_START'); this.move('ASSESSMENT_START');
  }
  selectEvidence(paragraphId: string): void {
    if (this.state !== 'ASSESSMENT' ||
        !this.content.document.paragraphs.some(p => p.id === paragraphId)) return;
    this.selectedEvidenceId = paragraphId;
    this.log('EVIDENCE_SELECTED', { paragraph_id: paragraphId }); this.notify();
  }
  hint(): void {
    if (this.state !== 'ASSESSMENT') return;
    this.log('HINT_REQUESTED', { item_id: this.content.challenge.itemId });
  }
  /** Retry with SAME immutable request & UUID if network previously failed. */
  async submit(): Promise<void> {
    if (this.busy) return;
    if (this.state === 'ASSESSMENT') {
      if (!this.selectedEvidenceId) throw new Error('Pilih kutipan sebelum mengirim');
      this.pendingRequest = {
        quest_version_id: this.quest.quest_version_id,
        idempotency_key: crypto.randomUUID(),
        answers: [{ item_id: this.content.challenge.itemId, value: this.selectedEvidenceId }],
      };
      this.move('SUBMIT');
      this.log('ANSWER_SUBMITTED', { item_id: this.content.challenge.itemId });
    } else if (this.state !== 'SUBMITTING' || !this.submitError || !this.pendingRequest) {
      return;
    }
    this.busy = true; this.submitError = null; this.notify();
    try {
      const response: ApiSuccessV1<SubmitAssessmentDataV1> = await this.assessment.submitAnswers(this.pendingRequest!);
      if (response.ok !== true || response.data.status !== 'scored') throw new Error('Respons assessment tidak valid');
      this.result = response.data;
      this.move('SCORED');
      this.log('FEEDBACK_VIEWED', { mode: 'mock_preview' });
    } catch {
      // Deliberately stay SUBMITTING to permit retry with the SAME idempotency key.
      this.submitError = 'Pengiriman gagal. Periksa koneksi dan coba lagi. Permintaan yang sama akan digunakan.';
    } finally {
      this.busy = false; this.notify();
    }
  }
  nextPath(): void {
    if (this.state !== 'FEEDBACK' || !this.result) return;
    this.move('NEXT_PATH');
  }
  finish(): void {
    if (this.state !== 'ADAPTIVE_TRANSITION') return;
    this.move('COMPLETE'); this.log('QUEST_COMPLETED');
  }
}
