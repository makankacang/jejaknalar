/**
 * Story Bundle v0.1 proposal types.
 * These types mirror contracts/story-bundle.schema.json and are not a final API contract.
 * QuestV1 v1.0 remains a separate, unchanged payload.
 */

export type StoryWorldPreset = 'school' | 'city';
export type StoryTaskTemplate = 'observe' | 'operate' | 'investigate' | 'decide';
export type AdaptivePath = 'needs_support' | 'developing' | 'ready_for_extension';

export interface StorySourceDocumentVersion {
  document_id: string;
  text_version: string;
}

export type StorySourceLocator =
  | { kind: 'pdf_page'; page: number }
  | { kind: 'docx_paragraph'; paragraph_index: number; section?: string };

export interface StorySourceReference {
  document_id: string;
  text_version: string;
  source_map_id: string;
  locator: StorySourceLocator;
  excerpt: string;
}

export interface StoryLearningContext {
  grade?: 7 | 8 | 9;
  subject?: string;
  topic?: string;
  curriculum?: string;
}

export interface StoryMission {
  mission_id: string;
  objective_ids: string[];
  required: boolean;
  room_id: string;
  prerequisites: string[];
  activity_ids: string[];
}

export interface StoryDialogueChoice {
  choice_id: string;
  label: string;
  next_node_id?: string;
  unlock_mission_id?: string;
}

export interface StoryDialogueNode {
  node_id: string;
  text: string;
  /** Required when this node contains academic claims; optional for fictional narrative. */
  source_refs?: StorySourceReference[];
  choices: StoryDialogueChoice[];
}

export interface StoryDialogue {
  npc_id: string;
  room_id: string;
  start_node_id: string;
  nodes: StoryDialogueNode[];
}

export interface StoryTask {
  /** Activity identity. C may generate the content ID; D validates renderer capability. */
  activity_id: string;
  room_id: string;
  object_id: string;
  template: StoryTaskTemplate;
  objective_ids: string[];
  instruction: string;
  /** At least one validated source reference for learning tasks. */
  source_refs: StorySourceReference[];
  evidence_ids?: string[];
  /** Opaque public item IDs; omit until B has registered them for this quest version. */
  public_item_ids?: string[];
}

export interface StoryEvidence {
  evidence_id: string;
  mission_id: string;
  room_id: string;
  object_id: string;
  objective_ids: string[];
  title: string;
  summary: string;
  source_refs: StorySourceReference[];
}

export interface StoryHint {
  hint_id: string;
  activity_id: string;
  level: number;
  text: string;
  /** Required when the hint contains an academic claim. */
  source_refs?: StorySourceReference[];
}

export interface StoryFeedback {
  feedback_id: string;
  activity_id: string;
  path: AdaptivePath;
  text: string;
  /** Required when the feedback contains an academic claim. */
  source_refs?: StorySourceReference[];
}

export interface StoryBundleDraftV01 {
  bundle_schema_version: '0.1-draft';
  quest_version_id: string;
  source_document_versions: StorySourceDocumentVersion[];
  registry_version: string;
  world_preset: StoryWorldPreset;
  start_room_id: string;
  title: string;
  opening: string;
  learning_context?: StoryLearningContext;
  missions: StoryMission[];
  dialogues: StoryDialogue[];
  tasks: StoryTask[];
  evidence: StoryEvidence[];
  hints?: StoryHint[];
  feedback?: StoryFeedback[];
  endings: Partial<Record<AdaptivePath, string>>;
}
