import type { AIModel } from "../core/model.ts";

export type AdaptivePath = "needs_support" | "developing" | "ready_for_extension";
export type StoryTaskTemplate = "observe" | "operate" | "investigate" | "decide";
export type StoryWorldPreset = "school" | "city";

export interface ApprovedQuestObjective { id: string; statement: string; }
export interface QuestSource {
  id: string; kind: "page" | "paragraph"; text: string;
  page?: number; paragraphIndex?: number; section?: string;
}
export interface QuestDocumentSnapshot {
  documentId: string; textVersion: string; format: "pdf" | "docx";
  extractedText: string; sourceMap: QuestSource[];
}
export interface TrustedQuestRegistry {
  version: string; worldPreset: StoryWorldPreset; startRoomId: string;
  roomIds: string[]; npcIds: string[]; objectIds: string[];
}
export interface QuestStoryGenerationInput {
  questVersionId: string; objectives: ApprovedQuestObjective[];
  document: QuestDocumentSnapshot; registry: TrustedQuestRegistry;
  learningContext?: { grade?: 7 | 8 | 9; subject?: string; topic?: string; curriculum?: string };
}
export interface StorySourceReference {
  document_id: string; text_version: string; source_map_id: string;
  locator: { kind: "pdf_page"; page: number } |
    { kind: "docx_paragraph"; paragraph_index: number; section?: string };
  excerpt: string;
}
export interface StoryBundleDraftV01 {
  bundle_schema_version: "0.1-draft"; quest_version_id: string;
  source_document_versions: Array<{ document_id: string; text_version: string }>;
  registry_version: string; world_preset: StoryWorldPreset; start_room_id: string;
  title: string; opening: string; learning_context?: QuestStoryGenerationInput["learningContext"];
  missions: Array<{
    mission_id: string; objective_ids: string[]; required: boolean; room_id: string;
    prerequisites: string[]; activity_ids: string[];
  }>;
  dialogues: Array<{
    npc_id: string; room_id: string; start_node_id: string;
    nodes: Array<{
      node_id: string; text: string; objective_ids?: string[];
      source_refs?: StorySourceReference[];
      choices: Array<{ choice_id: string; label: string; next_node_id?: string; unlock_mission_id?: string }>;
    }>;
  }>;
  tasks: Array<{
    activity_id: string; room_id: string; object_id: string; template: StoryTaskTemplate;
    objective_ids: string[]; instruction: string; source_refs: StorySourceReference[]; evidence_ids?: string[];
  }>;
  evidence: Array<{
    evidence_id: string; mission_id: string; room_id: string; object_id: string;
    objective_ids: string[]; title: string; summary: string; source_refs: StorySourceReference[];
  }>;
  hints?: Array<{ hint_id: string; activity_id: string; level: number; text: string; source_refs?: StorySourceReference[] }>;
  feedback?: Array<{ feedback_id: string; activity_id: string; path: AdaptivePath; text: string; source_refs?: StorySourceReference[] }>;
  endings: Partial<Record<AdaptivePath, string>>;
}
export interface QuestStoryGenerationResult {
  status: "draft_for_teacher_review"; generation_mode: "ai";
  bundle: StoryBundleDraftV01; warnings: string[];
}
export interface QuestStoryGeneratorOptions { model: AIModel; }
export type QuestStoryGeneratorErrorCode =
  | "INVALID_INPUT"
  | "MODEL_CONFIGURATION_ERROR"
  | "MODEL_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "MODEL_REQUEST_FAILED"
  | "MODEL_INVALID_RESPONSE"
  | "UNSUPPORTED_REGISTRY_REFERENCE"
  | "INVALID_SOURCE_REFERENCE"
  | "INVALID_STORY_GRAPH";

export class QuestStoryGeneratorError extends Error {
  constructor(
    readonly code: QuestStoryGeneratorErrorCode,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.name = "QuestStoryGeneratorError";

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
