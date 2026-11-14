
// deno-lint-ignore-file require-await

import { GeminiRestModel } from "../learning-analyzer/gemini-rest-model.ts";
import { OpenRouterModel } from "../providers/openrouter-model.ts";
import { generateQuestStoryDraft } from "./generator.ts";
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function providerPayload(provider: "gemini" | "openrouter") {
  const content = JSON.stringify(validBundle());

  if (provider === "gemini") {
    return {
      candidates: [{
        finishReason: "STOP",
        content: {
          parts: [{ text: content }],
        },
      }],
    };
  }

  return {
    choices: [{
      finish_reason: "stop",
      message: {
        content,
      },
    }],
  };
}

function expectGeneratorError(
  action: () => Promise<unknown>,
  expectedCode: QuestStoryGeneratorError["code"],
): Promise<void> {
  return action().then(
    () => {
      throw new Error(`Expected error code: ${expectedCode}`);
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

/**
 * Simulates a fetch request that rejects when its AbortSignal fires.
 * This allows the adapter's timeout handling to be tested without
 * making real network requests.
 */
function createTimeoutFetch(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;

      if (!signal) {
        reject(new Error("AbortSignal is missing"));
        return;
      }

      const onAbort = () => {
        reject(new DOMException("Request aborted", "AbortError"));
      };

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    });
}

// ============================================================
// ORIGINAL INTEGRATION TESTS
// ============================================================

Deno.test(
  "integrates Quest Generator with Gemini REST adapter",
  async () => {
    let requestedUrl = "";
    let requestedBody: Record<string, unknown> | undefined;

    const fetchImpl: typeof fetch = async (url, init) => {
      requestedUrl = String(url);
      requestedBody = JSON.parse(String(init?.body)) as Record<
        string,
        unknown
      >;

      return jsonResponse(providerPayload("gemini"));
    };

    const model = new GeminiRestModel({
      apiKey: "test-gemini-key",
      model: "gemini-test-model",
      fetchImpl,
    });

    const result = await generateQuestStoryDraft(input, { model });

    if (result.bundle.title !== "Misteri Papan Berita") {
      throw new Error("Gemini generated bundle was not normalized");
    }

    if (!requestedUrl.includes("gemini-test-model:generateContent")) {
      throw new Error("Gemini endpoint was not called");
    }

    if (
      requestedBody?.systemInstruction === undefined ||
      requestedBody.generationConfig === undefined
    ) {
      throw new Error("Gemini request configuration is incomplete");
    }

    if (
      result.bundle.source_document_versions[0].document_id !==
        input.document.documentId
    ) {
      throw new Error("Trusted document identity mismatch");
    }
  },
);

Deno.test(
  "integrates Quest Generator with OpenRouter adapter",
  async () => {
    let requestedUrl = "";
    let requestedBody: Record<string, unknown> | undefined;

    const fetchImpl: typeof fetch = async (url, init) => {
      requestedUrl = String(url);
      requestedBody = JSON.parse(String(init?.body)) as Record<
        string,
        unknown
      >;

      return jsonResponse(providerPayload("openrouter"));
    };

    const model = new OpenRouterModel({
      apiKey: "test-openrouter-key",
      model: "test/provider-model",
      fetchImpl,
    });

    const result = await generateQuestStoryDraft(input, { model });

    if (result.bundle.title !== "Misteri Papan Berita") {
      throw new Error("OpenRouter generated bundle was not normalized");
    }

    if (
      requestedUrl !==
        "https://openrouter.ai/api/v1/chat/completions"
    ) {
      throw new Error("Incorrect OpenRouter endpoint");
    }

    if (
      requestedBody?.model !== "test/provider-model" ||
      !Array.isArray(requestedBody.messages)
    ) {
      throw new Error("OpenRouter request configuration is incomplete");
    }

    if (
      result.bundle.source_document_versions[0].text_version !==
        input.document.textVersion
    ) {
      throw new Error("Trusted text version mismatch");
    }
  },
);

Deno.test(
  "maps Gemini HTTP 429 provider failure to MODEL_UNAVAILABLE",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: "rate limited" }, 429);

    const model = new GeminiRestModel({
      apiKey: "test-gemini-key",
      model: "gemini-test-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_UNAVAILABLE",
    );
  },
);

Deno.test(
  "maps OpenRouter HTTP 429 provider failure to MODEL_UNAVAILABLE",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: "rate limited" }, 429);

    const model = new OpenRouterModel({
      apiKey: "test-openrouter-key",
      model: "test/provider-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_UNAVAILABLE",
    );
  },
);

Deno.test(
  "rejects invalid JSON returned by Gemini",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        candidates: [{
          finishReason: "STOP",
          content: {
            parts: [{ text: "{invalid-json" }],
          },
        }],
      });

    const model = new GeminiRestModel({
      apiKey: "test-gemini-key",
      model: "gemini-test-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_INVALID_RESPONSE",
    );
  },
);

Deno.test(
  "rejects invalid JSON returned by OpenRouter",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        choices: [{
          finish_reason: "stop",
          message: {
            content: "{invalid-json",
          },
        }],
      });

    const model = new OpenRouterModel({
      apiKey: "test-openrouter-key",
      model: "test/provider-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_INVALID_RESPONSE",
    );
  },
);

// ============================================================
// C-06.2: AUTHENTICATION ERROR
// ============================================================

Deno.test(
  "maps Gemini HTTP 401 authentication failure to MODEL_CONFIGURATION_ERROR",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: "invalid API key" }, 401);

    const model = new GeminiRestModel({
      apiKey: "invalid-gemini-key",
      model: "gemini-test-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_CONFIGURATION_ERROR",
    );
  },
);

Deno.test(
  "maps OpenRouter HTTP 401 authentication failure to MODEL_CONFIGURATION_ERROR",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: "invalid API key" }, 401);

    const model = new OpenRouterModel({
      apiKey: "invalid-openrouter-key",
      model: "test/provider-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_CONFIGURATION_ERROR",
    );
  },
);

// ============================================================
// C-06.2: SERVER UNAVAILABLE
// ============================================================

Deno.test(
  "maps Gemini HTTP 503 to MODEL_UNAVAILABLE",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: "service unavailable" }, 503);

    const model = new GeminiRestModel({
      apiKey: "test-gemini-key",
      model: "gemini-test-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_UNAVAILABLE",
    );
  },
);

Deno.test(
  "maps OpenRouter HTTP 503 to MODEL_UNAVAILABLE",
  async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: "service unavailable" }, 503);

    const model = new OpenRouterModel({
      apiKey: "test-openrouter-key",
      model: "test/provider-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_UNAVAILABLE",
    );
  },
);

// ============================================================
// C-06.2: TIMEOUT
// ============================================================

Deno.test(
  "maps Gemini request timeout to MODEL_TIMEOUT",
  async () => {
    const model = new GeminiRestModel({
      apiKey: "test-gemini-key",
      model: "gemini-test-model",
      timeoutMs: 5,
      fetchImpl: createTimeoutFetch(),
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_TIMEOUT",
    );
  },
);

Deno.test(
  "maps OpenRouter request timeout to MODEL_TIMEOUT",
  async () => {
    const model = new OpenRouterModel({
      apiKey: "test-openrouter-key",
      model: "test/provider-model",
      timeoutMs: 5,
      fetchImpl: createTimeoutFetch(),
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_TIMEOUT",
    );
  },
);

// ============================================================
// C-06.2: NETWORK FAILURE
// ============================================================

Deno.test(
  "maps Gemini network failure to MODEL_UNAVAILABLE",
  async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.reject(new TypeError("Failed to fetch"));

    const model = new GeminiRestModel({
      apiKey: "test-gemini-key",
      model: "gemini-test-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_UNAVAILABLE",
    );
  },
);

Deno.test(
  "maps OpenRouter network failure to MODEL_UNAVAILABLE",
  async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.reject(new TypeError("Failed to fetch"));

    const model = new OpenRouterModel({
      apiKey: "test-openrouter-key",
      model: "test/provider-model",
      fetchImpl,
    });

    await expectGeneratorError(
      () => generateQuestStoryDraft(input, { model }),
      "MODEL_UNAVAILABLE",
    );
  },
);
