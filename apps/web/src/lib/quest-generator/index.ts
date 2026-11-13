export { CURRENT_GAME_CAPABILITIES, getCurrentEvidenceHuntCapability } from './capabilities';
export { generateCompatibleQuestDraft } from './generator';
export {
  QuestGenerationError,
  type ApprovedLearningObjective,
  type QuestGenerationIdentity,
  type QuestGenerationInput,
  type QuestGenerationResult,
  type QuestPayloadV1,
  type QuestGenerationWarning,
} from './types';

export type {
  AdaptivePath,
  StoryBundleDraftV01,
  StoryDialogue,
  StoryDialogueChoice,
  StoryDialogueNode,
  StoryEvidence,
  StoryFeedback,
  StoryHint,
  StoryLearningContext,
  StoryMission,
  StorySourceDocumentVersion,
  StorySourceLocator,
  StorySourceReference,
  StoryTask,
  StoryTaskTemplate,
  StoryWorldPreset,
} from './story-bundle/types';

export {
  validateC04PairedBinding,
  type C04BindingIssue,
  type C04BindingIssueCode,
  type C04BindingValidationResult,
  type C04ExplicitPairedBinding,
  type C04PairedBindingInput,
} from './paired-binding';