// deno-lint-ignore-file require-await


import { generateQuestStoryDraft } from "./generator.ts";
import type { AIModel } from "../core/model.ts";
import {
  QuestStoryGeneratorError,
  type QuestStoryGenerationInput,
} from "./types.ts";

const input: QuestStoryGenerationInput = {
  questVersionId: "QV-BI8-B1S5-REDAKSI-001",

  objectives: [{
    id: "LO-8A857C13-422A-4C5B-AD8A-8403955C067E",
    statement: "Mengidentifikasi struktur dan tujuan teks berita.",
  }],

  document: {
    documentId: "doc-test",
    textVersion: "version-test",
    format: "docx",
    extractedText:
      "Siswa membaca teks berita dan mengidentifikasi unsur berita.",

    sourceMap: [{
      id: "SRC-001",
      kind: "paragraph",
      paragraphIndex: 1,
      text: "Siswa membaca teks berita dan mengidentifikasi unsur berita.",
    }],
  },

  registry: {
    version: "registry-test-1",
    worldPreset: "school",
    startRoomId: "school.library",
    roomIds: ["school.library"],
    npcIds: ["school.npc.librarian"],
    objectIds: ["school.library.case_board"],
  },
};

function validBundle(): Record<string, unknown> {
  return {
    title: "Misteri Papan Berita",
    opening: "Periksa papan berita di perpustakaan.",

    missions: [{
      mission_id: "MISSION-1",
      objective_ids: [input.objectives[0].id],
      required: true,
      room_id: "school.library",
      prerequisites: [],
      activity_ids: ["ACT-001"],
    }],

    dialogues: [{
      npc_id: "school.npc.librarian",
      room_id: "school.library",
      start_node_id: "NODE-1",

      nodes: [{
        node_id: "NODE-1",
        text: "Apa yang sedang kamu cari?",
        choices: [{
          choice_id: "CHOICE-1",
          label: "Mencari berita",
          unlock_mission_id: "MISSION-1",
        }],
      }],
    }],

    tasks: [{
      activity_id: "ACT-001",
      room_id: "school.library",
      object_id: "school.library.case_board",
      template: "investigate",
      objective_ids: [input.objectives[0].id],
      instruction: "Identifikasi unsur berita dari teks.",

      source_refs: [{
        source_map_id: "SRC-001",
        excerpt: "mengidentifikasi unsur berita",
      }],

      evidence_ids: ["EVIDENCE-1"],
    }],

    evidence: [{
      evidence_id: "EVIDENCE-1",
      mission_id: "MISSION-1",
      room_id: "school.library",
      object_id: "school.library.case_board",
      objective_ids: [input.objectives[0].id],
      title: "Catatan unsur berita",
      summary: "Hasil identifikasi unsur berita.",

      source_refs: [{
        source_map_id: "SRC-001",
        excerpt: "mengidentifikasi unsur berita",
      }],
    }],

    endings: {
      needs_support: "Kamu dapat mencoba lagi dengan petunjuk.",
      developing: "Kamu berhasil menyelesaikan sebagian besar tugas.",
      ready_for_extension: "Kamu siap menghadapi tantangan berikutnya.",
    },
  };
}

function createMockModel(
  response: unknown,
  shouldFail = false,
  onRequest?: (request: unknown) => void,
): AIModel {
  return {
    async generateStructuredOutput(request) {
      onRequest?.(request);

      if (shouldFail) {
        throw new Error("Mock provider unavailable");
      }

      return response;
    },
  };
}

function expectErrorCode(
  action: () => Promise<unknown>,
  expectedCode: QuestStoryGeneratorError["code"],
): Promise<void> {
  return action().then(
    () => {
      throw new Error(
        `Expected error code: ${expectedCode}`,
      );
    },
    (error: unknown) => {
      if (
        error instanceof QuestStoryGeneratorError &&
        error.code === expectedCode
      ) {
        return;
      }

      throw error;
    },
  );
}

Deno.test(
  "generates a valid Story Bundle draft using mock AIModel",
  async () => {
    const result = await generateQuestStoryDraft(input, {
      model: createMockModel(validBundle()),
    });

    if (result.status !== "draft_for_teacher_review") {
      throw new Error("Incorrect generation status");
    }

    if (result.generation_mode !== "ai") {
      throw new Error("Incorrect generation mode");
    }

    if (
      result.bundle.quest_version_id !== input.questVersionId
    ) {
      throw new Error("Quest version mismatch");
    }

    if (
      result.bundle.source_document_versions[0].document_id !==
        input.document.documentId
    ) {
      throw new Error("Trusted document identity mismatch");
    }

    if (result.bundle.tasks.length !== 1) {
      throw new Error("Expected one generated task");
    }

    if (result.warnings.length === 0) {
      throw new Error("Expected teacher review warnings");
    }
  },
);

Deno.test(
  "sends structured generation request to AIModel",
  async () => {
    let capturedRequest: unknown;

    const model = createMockModel(
      validBundle(),
      false,
      (request) => {
        capturedRequest = request;
      },
    );

    await generateQuestStoryDraft(input, { model });

    if (
      typeof capturedRequest !== "object" ||
      capturedRequest === null
    ) {
      throw new Error("AIModel request was not captured");
    }

    const request = capturedRequest as Record<string, unknown>;

    if (
      typeof request.system_instruction !== "string" ||
      request.system_instruction.length === 0
    ) {
      throw new Error("System instruction is missing");
    }

    if (
      typeof request.prompt !== "string" ||
      !request.prompt.includes(input.document.documentId)
    ) {
      throw new Error("Generation prompt is invalid");
    }

    if (
      typeof request.response_json_schema !== "object" ||
      request.response_json_schema === null
    ) {
      throw new Error("Response JSON schema is missing");
    }
  },
);

Deno.test(
  "rejects malformed AI response",
  async () => {
    await expectErrorCode(
      () =>
        generateQuestStoryDraft(input, {
          model: createMockModel({}),
        }),
      "MODEL_INVALID_RESPONSE",
    );
  },
);

Deno.test(
  "rejects unverified source reference from AI",
  async () => {
    const raw = validBundle();

    (raw.tasks as Array<Record<string, unknown>>)[0].source_refs = [{
      source_map_id: "SRC-UNKNOWN",
      excerpt: "mengidentifikasi unsur berita",
    }];

    await expectErrorCode(
      () =>
        generateQuestStoryDraft(input, {
          model: createMockModel(raw),
        }),
      "INVALID_SOURCE_REFERENCE",
    );
  },
);

Deno.test(
  "converts unknown provider failure into MODEL_REQUEST_FAILED",
  async () => {
    await expectErrorCode(
      () =>
        generateQuestStoryDraft(input, {
          model: {
            generateStructuredOutput: async () => {
              throw new Error("Mock provider unavailable");
            },
          },
        }),
      "MODEL_REQUEST_FAILED",
    );
  },
);

Deno.test(
  "rejects invalid input before calling AIModel",
  async () => {
    let modelCalled = false;

    const model: AIModel = {
      async generateStructuredOutput() {
        modelCalled = true;
        return validBundle();
      },
    };

    const invalidInput: QuestStoryGenerationInput = {
      ...input,
      questVersionId: "INVALID-QUEST-ID",
    };

    await expectErrorCode(
      () =>
        generateQuestStoryDraft(invalidInput, { model }),
      "INVALID_INPUT",
    );

    if (modelCalled) {
      throw new Error(
        "AIModel must not be called when input is invalid",
      );
    }
  },
);

Deno.test(
  "does not trust model-authored document identity",
  async () => {
    const raw = validBundle();

    raw.document_id = "fake-document";
    raw.text_version = "fake-version";

    const result = await generateQuestStoryDraft(input, {
      model: createMockModel(raw),
    });

    const sourceVersion =
      result.bundle.source_document_versions[0];

    if (sourceVersion.document_id !== input.document.documentId) {
      throw new Error("Model document identity was trusted");
    }

    if (sourceVersion.text_version !== input.document.textVersion) {
      throw new Error("Model text version was trusted");
    }
  },
);


