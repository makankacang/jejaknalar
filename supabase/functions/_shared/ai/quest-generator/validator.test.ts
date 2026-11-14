
import {
  validateAndNormalizeStoryBundle,
} from "./validator.ts";
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
    extractedText: "Siswa membaca teks berita dan mengidentifikasi unsur berita.",
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

function expectCode(
  action: () => unknown,
  code: QuestStoryGeneratorError["code"],
): void {
  try {
    action();
  } catch (error) {
    if (
      error instanceof QuestStoryGeneratorError &&
      error.code === code
    ) {
      return;
    }
    throw error;
  }

  throw new Error(
    `Expected QuestStoryGeneratorError with code ${code}`,
  );
}

Deno.test(
  "accepts a valid Story Bundle and attaches trusted source metadata",
  () => {
    const result = validateAndNormalizeStoryBundle(
      validBundle(),
      input,
    );

    const normalized = result as unknown as {
      quest_version_id: string;
      tasks: Array<{
        source_refs: Array<{
          document_id: string;
          locator: {
            kind: string;
          };
        }>;
      }>;
    };

    if (normalized.quest_version_id !== input.questVersionId) {
      throw new Error("Quest version mismatch");
    }

    if (
      normalized.tasks[0].source_refs[0].document_id !==
        input.document.documentId
    ) {
      throw new Error("Trusted document identity was not attached");
    }

    if (
      normalized.tasks[0].source_refs[0].locator.kind !==
        "docx_paragraph"
    ) {
      throw new Error("Incorrect source locator");
    }
  },
);

Deno.test(
  "rejects a source excerpt that is not grounded in the document",
  () => {
    const raw = validBundle();

    (raw.tasks as Array<Record<string, unknown>>)[0].source_refs = [{
      source_map_id: "SRC-001",
      excerpt: "kalimat rekaan yang tidak ada",
    }];

    expectCode(
      () => validateAndNormalizeStoryBundle(raw, input),
      "INVALID_SOURCE_REFERENCE",
    );
  },
);

Deno.test("rejects duplicate evidence IDs", () => {
  const raw = validBundle();
  const evidence = raw.evidence as Array<Record<string, unknown>>;

  evidence.push({
    ...evidence[0],
  });

  expectCode(
    () => validateAndNormalizeStoryBundle(raw, input),
    "INVALID_STORY_GRAPH",
  );
});

Deno.test(
  "rejects a task whose evidence reference does not exist",
  () => {
    const raw = validBundle();

    (raw.tasks as Array<Record<string, unknown>>)[0].evidence_ids = [
      "EVIDENCE-MISSING",
    ];

    expectCode(
      () => validateAndNormalizeStoryBundle(raw, input),
      "MODEL_INVALID_RESPONSE",
    );
  },
);

Deno.test(
  "rejects a task that is not mapped to a mission",
  () => {
    const raw = validBundle();

    (raw.missions as Array<Record<string, unknown>>)[0].activity_ids = [];

    expectCode(
      () => validateAndNormalizeStoryBundle(raw, input),
      "INVALID_STORY_GRAPH",
    );
  },
);

Deno.test("rejects cyclic mission prerequisites", () => {
  const raw = validBundle();
  const missions = raw.missions as Array<Record<string, unknown>>;

  missions.push({
    mission_id: "MISSION-2",
    objective_ids: [input.objectives[0].id],
    required: false,
    room_id: "school.library",
    prerequisites: ["MISSION-1"],
    activity_ids: [],
  });

  missions[0].prerequisites = ["MISSION-2"];

  expectCode(
    () => validateAndNormalizeStoryBundle(raw, input),
    "INVALID_STORY_GRAPH",
  );
});

Deno.test("rejects duplicate dialogue node IDs", () => {
  const raw = validBundle();
  const dialogue = (raw.dialogues as Array<Record<string, unknown>>)[0];

  (dialogue.nodes as Array<Record<string, unknown>>).push({
    node_id: "NODE-1",
    text: "Node duplikat",
    choices: [],
  });

  expectCode(
    () => validateAndNormalizeStoryBundle(raw, input),
    "INVALID_STORY_GRAPH",
  );
});

Deno.test("requires all three adaptive endings", () => {
  const raw = validBundle();

  raw.endings = {
    developing: "Selesai.",
  };

  expectCode(
    () => validateAndNormalizeStoryBundle(raw, input),
    "MODEL_INVALID_RESPONSE",
  );
});

Deno.test(
  "rejects source-map kind that conflicts with document format",
  () => {
    const invalidInput: QuestStoryGenerationInput = {
      ...input,
      document: {
        ...input.document,
        format: "pdf",
      },
    };

    expectCode(
      () => validateAndNormalizeStoryBundle(
        validBundle(),
        invalidInput,
      ),
      "INVALID_INPUT",
    );
  },
);
