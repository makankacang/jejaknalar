
import type { AIModelRequest } from "../core/model.ts";
import { LearningAnalyzerError } from "../learning-analyzer/errors.ts";

import { QUEST_STORY_RESPONSE_SCHEMA } from "./output-schema.ts";
import {
  buildQuestStoryPrompt,
  QUEST_STORY_SYSTEM_INSTRUCTION,
} from "./prompt.ts";
import { validateAndNormalizeStoryBundle } from "./validator.ts";

import {
  QuestStoryGeneratorError,
  type QuestStoryGenerationInput,
  type QuestStoryGenerationResult,
  type QuestStoryGeneratorOptions,
  type QuestStoryGeneratorErrorCode,
} from "./types.ts";

const QV = /^QV-[A-Z0-9-]+$/;
const LO = /^LO-[A-Z0-9-]+$/;

function validateInput(
  input: QuestStoryGenerationInput,
  model: QuestStoryGeneratorOptions["model"],
): void {
  if (
    !input ||
    !QV.test(input.questVersionId) ||
    !Array.isArray(input.objectives) ||
    !input.objectives.length ||
    !input.document?.documentId ||
    !input.document.textVersion ||
    !input.document.extractedText?.trim() ||
    !Array.isArray(input.document.sourceMap) ||
    !input.registry?.version ||
    !input.registry.startRoomId ||
    !Array.isArray(input.registry.roomIds) ||
    !Array.isArray(input.registry.npcIds) ||
    !Array.isArray(input.registry.objectIds)
  ) {
    throw new QuestStoryGeneratorError(
      "INVALID_INPUT",
      "Input, snapshot, atau trusted registry tidak lengkap.",
    );
  }

  const ids = input.objectives.map((objective) => objective.id);

  if (
    ids.some((id) => typeof id !== "string" || !LO.test(id)) ||
    new Set(ids).size !== ids.length ||
    input.objectives.some(
      (objective) =>
        typeof objective.statement !== "string" ||
        objective.statement.trim().length < 12,
    )
  ) {
    throw new QuestStoryGeneratorError(
      "INVALID_INPUT",
      "Approved learning objectives tidak valid atau duplikat.",
    );
  }

  if (!input.document.sourceMap.some((source) => source.text.trim())) {
    throw new QuestStoryGeneratorError(
      "INVALID_INPUT",
      "Snapshot tidak memiliki source map berisi teks.",
    );
  }

  if (!model || typeof model.generateStructuredOutput !== "function") {
    throw new QuestStoryGeneratorError(
      "INVALID_INPUT",
      "AIModel belum dikonfigurasi.",
    );
  }
}

/**
 * Convert provider errors into Quest Story Generator error codes.
 *
 * Provider adapters currently use LearningAnalyzerError as
 * their provider-neutral error contract.
 */
function mapProviderError(error: unknown): {
  code: QuestStoryGeneratorErrorCode;
  message: string;
} {
  if (!(error instanceof LearningAnalyzerError)) {
    return {
      code: "MODEL_REQUEST_FAILED",
      message: "Terjadi kegagalan saat menjalankan request AI.",
    };
  }

  switch (error.code) {
    case "MODEL_CONFIGURATION_ERROR":
      return {
        code: "MODEL_CONFIGURATION_ERROR",
        message: error.message,
      };

    case "MODEL_UNAVAILABLE":
      return {
        code: "MODEL_UNAVAILABLE",
        message: error.message,
      };

    case "MODEL_TIMEOUT":
      return {
        code: "MODEL_TIMEOUT",
        message: error.message,
      };

    case "MODEL_INVALID_RESPONSE":
      return {
        code: "MODEL_INVALID_RESPONSE",
        message: error.message,
      };

    case "MODEL_REQUEST_FAILED":
      return {
        code: "MODEL_REQUEST_FAILED",
        message: error.message,
      };

    case "INVALID_INPUT":
    case "NO_ANALYZABLE_TEXT":
    default:
      return {
        code: "MODEL_REQUEST_FAILED",
        message: error.message,
      };
  }
}

export async function generateQuestStoryDraft(
  input: QuestStoryGenerationInput,
  options: QuestStoryGeneratorOptions,
): Promise<QuestStoryGenerationResult> {
  validateInput(input, options?.model);

  const request: AIModelRequest = {
    system_instruction: QUEST_STORY_SYSTEM_INSTRUCTION,
    prompt: buildQuestStoryPrompt(input),
    response_json_schema: QUEST_STORY_RESPONSE_SCHEMA,
  };

  let raw: unknown;

  try {
    raw = await options.model.generateStructuredOutput(request);
  } catch (error) {
    const mapped = mapProviderError(error);

    throw new QuestStoryGeneratorError(
      mapped.code,
      mapped.message,
      { cause: error },
    );
  }

  const bundle = validateAndNormalizeStoryBundle(raw, input);

  return {
    status: "draft_for_teacher_review",
    generation_mode: "ai",
    bundle,
    warnings: [
      "Story Bundle v0.1 masih proposal dan belum menjamin kompatibilitas runtime.",
      "Assessment IDs tidak dibuat atau dipetakan oleh generator.",
      "Guru wajib meninjau konten dan sumber sebelum persetujuan/publikasi backend.",
    ],
  };
}