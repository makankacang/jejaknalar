import { normalizeEvidenceText } from "../learning-analyzer/source-reference.ts";
import {
  QuestStoryGeneratorError,
  type QuestStoryGenerationInput,
  type StorySourceReference,
  type QuestSource,
  type StoryBundleDraftV01,
} from "./types.ts";

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function fail(
  code: ConstructorParameters<typeof QuestStoryGeneratorError>[0],
  message: string,
): never {
  throw new QuestStoryGeneratorError(code, message);
}

function nonBlank(value: unknown, max = 3000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function strings(
  value: unknown,
  label: string,
  allowed?: Set<string>,
  min = 0,
): asserts value is string[] {
  if (!Array.isArray(value)) {
    fail("MODEL_INVALID_RESPONSE", `${label} harus berupa array.`);
  }
  const entries = value as unknown[];
  if (
    entries.length < min ||
    entries.some((item) => typeof item !== "string" || !item.trim()) ||
    new Set(entries).size !== entries.length ||
    (allowed && entries.some((item) => !allowed.has(item as string)))
  ) {
    fail("MODEL_INVALID_RESPONSE", `${label} tidak valid, duplikat, atau berisi ID yang tidak diizinkan.`);
  }
}

function uniqueRegistryIds(values: string[], label: string): Set<string> {
  if (
    values.some((value) => !nonBlank(value, 160)) ||
    new Set(values).size !== values.length
  ) {
    fail("INVALID_INPUT", `${label} registry kosong, tidak valid, atau duplikat.`);
  }
  return new Set(values);
}

function validateSnapshot(input: QuestStoryGenerationInput): void {
  const document = input.document;
  const registry = input.registry;

  if (
    !nonBlank(document.documentId, 200) ||
    !nonBlank(document.textVersion, 200) ||
    !nonBlank(document.extractedText, 2_000_000) ||
    !Array.isArray(document.sourceMap) ||
    document.sourceMap.length === 0
  ) {
    fail("INVALID_INPUT", "Snapshot dokumen tidak lengkap.");
  }

  const sourceIds = new Set<string>();
  for (const source of document.sourceMap as QuestSource[]) {
    if (!source || !nonBlank(source.id, 200) || !nonBlank(source.text, 100_000)) {
      fail("INVALID_INPUT", "Source map memiliki ID atau teks kosong/tidak valid.");
    }
    if (sourceIds.has(source.id)) {
      fail("INVALID_INPUT", `source_map_id duplikat: ${source.id}`);
    }
    sourceIds.add(source.id);

    if (
      (document.format === "pdf" && source.kind !== "page") ||
      (document.format === "docx" && source.kind !== "paragraph")
    ) {
      fail("INVALID_INPUT", "Format dokumen tidak sesuai dengan jenis source map.");
    }
    if (
      source.kind === "page" &&
      (!Number.isInteger(source.page) || (source.page ?? 0) < 1)
    ) {
      fail("INVALID_INPUT", `Nomor halaman source map tidak valid: ${source.id}`);
    }
    if (
      source.kind === "paragraph" &&
      (!Number.isInteger(source.paragraphIndex) || (source.paragraphIndex ?? 0) < 1)
    ) {
      fail("INVALID_INPUT", `Nomor paragraf source map tidak valid: ${source.id}`);
    }
    if (
      !normalizeEvidenceText(document.extractedText)
        .includes(normalizeEvidenceText(source.text))
    ) {
      fail("INVALID_INPUT", `Teks source map ${source.id} tidak ditemukan pada snapshot dokumen.`);
    }
  }

  if (
    !nonBlank(registry.version, 160) ||
    !["school", "city"].includes(registry.worldPreset) ||
    !nonBlank(registry.startRoomId, 160)
  ) {
    fail("INVALID_INPUT", "Trusted registry tidak memiliki versi, world preset, atau start room yang valid.");
  }
  const rooms = uniqueRegistryIds(registry.roomIds, "Room");
  if (!rooms.has(registry.startRoomId)) {
    fail("INVALID_INPUT", "startRoomId harus terdaftar di roomIds.");
  }
  uniqueRegistryIds(registry.npcIds, "NPC");
  uniqueRegistryIds(registry.objectIds, "Object");
}

function sourceReferences(
  value: unknown,
  input: QuestStoryGenerationInput,
  required: boolean,
): StorySourceReference[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value)) {
    fail("INVALID_SOURCE_REFERENCE", "Referensi sumber wajib berupa array.");
  }
  const entries = value as unknown[];
  if (required && entries.length === 0) {
    fail("INVALID_SOURCE_REFERENCE", "Referensi sumber wajib tersedia.");
  }

  const seen = new Set<string>();
  return entries.map((entry: unknown) => {
    if (!isObj(entry) ||
        typeof entry.source_map_id !== "string" ||
        typeof entry.excerpt !== "string") {
      fail("INVALID_SOURCE_REFERENCE", "Format source reference tidak valid.");
    }
    const ref = entry as Obj;
    const sourceMapId = ref.source_map_id as string;
    const excerpt = (ref.excerpt as string).trim();

    if (seen.has(sourceMapId)) {
      fail("INVALID_SOURCE_REFERENCE", `Source reference duplikat: ${sourceMapId}`);
    }
    seen.add(sourceMapId);

    const found = input.document.sourceMap.find((item) => item.id === sourceMapId);
    if (!found) {
      fail("INVALID_SOURCE_REFERENCE", `Source map tidak ditemukan: ${sourceMapId}`);
    }
    const source = found as QuestSource;

    if (
      excerpt.length < 8 ||
      excerpt.length > 1000 ||
      !normalizeEvidenceText(source.text).includes(normalizeEvidenceText(excerpt)) ||
      !normalizeEvidenceText(input.document.extractedText).includes(normalizeEvidenceText(excerpt))
    ) {
      fail("INVALID_SOURCE_REFERENCE", `Kutipan sumber tidak terverifikasi: ${sourceMapId}`);
    }

    return {
      document_id: input.document.documentId,
      text_version: input.document.textVersion,
      source_map_id: source.id,
      locator: source.kind === "page"
        ? { kind: "pdf_page" as const, page: source.page! }
        : {
          kind: "docx_paragraph" as const,
          paragraph_index: source.paragraphIndex!,
          ...(source.section ? { section: source.section } : {}),
        },
      excerpt,
    };
  });
}

export function validateAndNormalizeStoryBundle(
  raw: unknown,
  input: QuestStoryGenerationInput,
): StoryBundleDraftV01 {
  validateSnapshot(input);

  if (
    !isObj(raw) ||
    !nonBlank(raw.title, 160) ||
    !nonBlank(raw.opening, 3000) ||
    !Array.isArray(raw.missions) ||
    raw.missions.length === 0 ||
    !Array.isArray(raw.tasks) ||
    raw.tasks.length === 0 ||
    !Array.isArray(raw.dialogues) ||
    !Array.isArray(raw.evidence) ||
    !isObj(raw.endings)
  ) {
    fail("MODEL_INVALID_RESPONSE", "Struktur utama Story Bundle tidak lengkap.");
  }

  const data = raw as Obj;
  const missions = data.missions as unknown[];
  const tasks = data.tasks as unknown[];
  const dialogueInput = data.dialogues as unknown[];
  const evidenceInput = data.evidence as unknown[];
  const endings = data.endings as Obj;

  const objectiveIds = new Set(input.objectives.map((objective) => objective.id));
  const rooms = new Set(input.registry.roomIds);
  const npcs = new Set(input.registry.npcIds);
  const objects = new Set(input.registry.objectIds);
  const missionIds = new Set<string>();
  const activityIds = new Set<string>();
  const missionById = new Map<string, Obj>();

  for (const entry of missions) {
    if (!isObj(entry)) fail("MODEL_INVALID_RESPONSE", "Mission harus berupa object.");
    const mission = entry as Obj;
    if (
      !nonBlank(mission.mission_id, 160) ||
      !nonBlank(mission.room_id, 160) ||
      !rooms.has(mission.room_id) ||
      typeof mission.required !== "boolean"
    ) {
      fail("UNSUPPORTED_REGISTRY_REFERENCE", "Mission menggunakan room atau metadata tidak valid.");
    }
    const missionId = mission.mission_id as string;
    if (missionIds.has(missionId)) {
      fail("INVALID_STORY_GRAPH", `mission_id duplikat: ${missionId}`);
    }
    missionIds.add(missionId);
    missionById.set(missionId, mission);
    strings(mission.objective_ids, "Mission objective_ids", objectiveIds, 1);
    strings(mission.prerequisites, "Mission prerequisites");
    strings(mission.activity_ids, "Mission activity_ids");
  }

  const taskByActivity = new Map<string, Obj>();
  for (const entry of tasks) {
    if (!isObj(entry)) fail("MODEL_INVALID_RESPONSE", "Task harus berupa object.");
    const task = entry as Obj;
    if (
      !nonBlank(task.activity_id, 160) ||
      !/^ACT-[A-Z0-9-]+$/.test(task.activity_id) ||
      !nonBlank(task.room_id, 160) ||
      !rooms.has(task.room_id) ||
      !nonBlank(task.object_id, 160) ||
      !objects.has(task.object_id) ||
      !["observe", "operate", "investigate", "decide"].includes(String(task.template)) ||
      !nonBlank(task.instruction, 2000)
    ) {
      fail("UNSUPPORTED_REGISTRY_REFERENCE", "Task menggunakan room/object/template tidak valid.");
    }
    const activityId = task.activity_id as string;
    if (activityIds.has(activityId)) {
      fail("INVALID_STORY_GRAPH", `activity_id duplikat: ${activityId}`);
    }
    activityIds.add(activityId);
    taskByActivity.set(activityId, task);
    strings(task.objective_ids, "Task objective_ids", objectiveIds, 1);
    task.source_refs = sourceReferences(task.source_refs, input, true);
    if (task.evidence_ids !== undefined) strings(task.evidence_ids, "Task evidence_ids");
  }

  const mappedActivities = new Set<string>();
  for (const mission of missions) {
    const item = mission as Obj;
    strings(item.prerequisites, "Mission prerequisites", missionIds);
    strings(item.activity_ids, "Mission activity_ids", activityIds);
    for (const activityId of item.activity_ids as string[]) mappedActivities.add(activityId);
  }
  for (const activityId of activityIds) {
    if (!mappedActivities.has(activityId)) {
      fail("INVALID_STORY_GRAPH", `Task ${activityId} tidak dipetakan ke mission mana pun.`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      fail("INVALID_STORY_GRAPH", "Mission prerequisite graph memiliki siklus.");
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const mission = missionById.get(id);
    for (const prerequisite of (mission?.prerequisites as string[]) ?? []) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of missionIds) visit(id);

  const globalNodeIds = new Set<string>();
  const globalChoiceIds = new Set<string>();
  const dialogues = dialogueInput.map((entry: unknown) => {
    if (!isObj(entry)) fail("MODEL_INVALID_RESPONSE", "Dialogue harus berupa object.");
    const dialogue = entry as Obj;
    if (
      !nonBlank(dialogue.npc_id, 160) ||
      !npcs.has(dialogue.npc_id) ||
      !nonBlank(dialogue.room_id, 160) ||
      !rooms.has(dialogue.room_id) ||
      !Array.isArray(dialogue.nodes) ||
      dialogue.nodes.length === 0 ||
      !nonBlank(dialogue.start_node_id, 160)
    ) {
      fail("UNSUPPORTED_REGISTRY_REFERENCE", "Dialogue menggunakan NPC/room atau struktur yang tidak valid.");
    }
    const nodesInput = dialogue.nodes as unknown[];
    const nodeIds = new Set<string>();
    for (const nodeEntry of nodesInput) {
      if (!isObj(nodeEntry)) fail("MODEL_INVALID_RESPONSE", "Dialogue node harus berupa object.");
      const node = nodeEntry as Obj;
      if (!nonBlank(node.node_id, 160) ||
          !nonBlank(node.text, 2000) ||
          !Array.isArray(node.choices)) {
        fail("MODEL_INVALID_RESPONSE", "Dialogue node tidak valid.");
      }
      const nodeId = node.node_id as string;
      if (nodeIds.has(nodeId) || globalNodeIds.has(nodeId)) {
        fail("INVALID_STORY_GRAPH", `node_id duplikat: ${nodeId}`);
      }
      nodeIds.add(nodeId);
      globalNodeIds.add(nodeId);
    }
    if (!nodeIds.has(dialogue.start_node_id as string)) {
      fail("INVALID_STORY_GRAPH", "start_node_id tidak ditemukan.");
    }

    const nodes = nodesInput.map((nodeEntry: unknown) => {
      const node = nodeEntry as Obj;
      if (node.objective_ids !== undefined) {
        strings(node.objective_ids, "Dialogue objective_ids", objectiveIds);
      }
      const choicesInput = node.choices as unknown[];
      const choices = choicesInput.map((choiceEntry: unknown) => {
        if (!isObj(choiceEntry)) fail("MODEL_INVALID_RESPONSE", "Dialogue choice harus berupa object.");
        const choice = choiceEntry as Obj;
        if (
          !nonBlank(choice.choice_id, 160) ||
          !nonBlank(choice.label, 500) ||
          (choice.next_node_id === undefined && choice.unlock_mission_id === undefined) ||
          (choice.next_node_id !== undefined &&
            (typeof choice.next_node_id !== "string" || !nodeIds.has(choice.next_node_id))) ||
          (choice.unlock_mission_id !== undefined &&
            (typeof choice.unlock_mission_id !== "string" || !missionIds.has(choice.unlock_mission_id)))
        ) {
          fail("INVALID_STORY_GRAPH", "Dialogue choice memiliki ID atau tujuan yang tidak ditemukan.");
        }
        const choiceId = choice.choice_id as string;
        if (globalChoiceIds.has(choiceId)) {
          fail("INVALID_STORY_GRAPH", `choice_id duplikat: ${choiceId}`);
        }
        globalChoiceIds.add(choiceId);
        return choice;
      });
      return {
        ...node,
        choices,
        ...(node.source_refs !== undefined
          ? { source_refs: sourceReferences(node.source_refs, input, false) }
          : {}),
      };
    });
    return { ...dialogue, nodes };
  });

  const evidenceIds = new Set<string>();
  const evidence = evidenceInput.map((entry: unknown) => {
    if (!isObj(entry)) fail("MODEL_INVALID_RESPONSE", "Evidence harus berupa object.");
    const item = entry as Obj;
    if (
      !nonBlank(item.evidence_id, 160) ||
      !nonBlank(item.mission_id, 160) ||
      !missionIds.has(item.mission_id) ||
      !nonBlank(item.room_id, 160) ||
      !rooms.has(item.room_id) ||
      !nonBlank(item.object_id, 160) ||
      !objects.has(item.object_id) ||
      !nonBlank(item.title, 160) ||
      !nonBlank(item.summary, 2000)
    ) {
      fail("UNSUPPORTED_REGISTRY_REFERENCE", "Evidence menunjuk mission/room/object atau metadata tidak valid.");
    }
    const evidenceId = item.evidence_id as string;
    if (evidenceIds.has(evidenceId)) {
      fail("INVALID_STORY_GRAPH", `evidence_id duplikat: ${evidenceId}`);
    }
    evidenceIds.add(evidenceId);
    strings(item.objective_ids, "Evidence objective_ids", objectiveIds, 1);
    return { ...item, source_refs: sourceReferences(item.source_refs, input, true) };
  });

  for (const task of taskByActivity.values()) {
    strings(task.evidence_ids ?? [], "Task evidence_ids", evidenceIds);
  }

  const hints = data.hints === undefined ? undefined : (() => {
    if (!Array.isArray(data.hints)) fail("MODEL_INVALID_RESPONSE", "hints harus berupa array.");
    const hintIds = new Set<string>();
    return (data.hints as unknown[]).map((entry: unknown) => {
      if (!isObj(entry)) fail("MODEL_INVALID_RESPONSE", "Hint harus berupa object.");
      const hint = entry as Obj;
      if (
        !nonBlank(hint.hint_id, 160) ||
        !nonBlank(hint.activity_id, 160) ||
        !activityIds.has(hint.activity_id) ||
        !Number.isInteger(hint.level) ||
        (hint.level as number) < 1 ||
        (hint.level as number) > 5 ||
        !nonBlank(hint.text, 2000)
      ) {
        fail("MODEL_INVALID_RESPONSE", "Hint tidak valid atau menunjuk activity yang tidak ada.");
      }
      const hintId = hint.hint_id as string;
      if (hintIds.has(hintId)) fail("INVALID_STORY_GRAPH", `hint_id duplikat: ${hintId}`);
      hintIds.add(hintId);
      return {
        ...hint,
        ...(hint.source_refs !== undefined
          ? { source_refs: sourceReferences(hint.source_refs, input, false) }
          : {}),
      };
    });
  })();

  const feedback = data.feedback === undefined ? undefined : (() => {
    if (!Array.isArray(data.feedback)) fail("MODEL_INVALID_RESPONSE", "feedback harus berupa array.");
    const feedbackIds = new Set<string>();
    return (data.feedback as unknown[]).map((entry: unknown) => {
      if (!isObj(entry)) fail("MODEL_INVALID_RESPONSE", "Feedback harus berupa object.");
      const item = entry as Obj;
      if (
        !nonBlank(item.feedback_id, 160) ||
        !nonBlank(item.activity_id, 160) ||
        !activityIds.has(item.activity_id) ||
        !["needs_support", "developing", "ready_for_extension"].includes(String(item.path)) ||
        !nonBlank(item.text, 2000)
      ) {
        fail("MODEL_INVALID_RESPONSE", "Feedback tidak valid atau menunjuk activity yang tidak ada.");
      }
      const feedbackId = item.feedback_id as string;
      if (feedbackIds.has(feedbackId)) {
        fail("INVALID_STORY_GRAPH", `feedback_id duplikat: ${feedbackId}`);
      }
      feedbackIds.add(feedbackId);
      return {
        ...item,
        ...(item.source_refs !== undefined
          ? { source_refs: sourceReferences(item.source_refs, input, false) }
          : {}),
      };
    });
  })();

  const adaptivePaths = ["needs_support", "developing", "ready_for_extension"] as const;
  const endingKeys = Object.keys(endings);
  if (
    endingKeys.length !== adaptivePaths.length ||
    endingKeys.some((key) => !adaptivePaths.includes(key as typeof adaptivePaths[number])) ||
    adaptivePaths.some((path) => !nonBlank(endings[path], 2000))
  ) {
    fail("MODEL_INVALID_RESPONSE", "endings wajib berisi teks untuk ketiga jalur adaptif yang dikenal.");
  }

    return {
    bundle_schema_version: "0.1-draft",
    quest_version_id: input.questVersionId,

    source_document_versions: [{
      document_id: input.document.documentId,
      text_version: input.document.textVersion,
    }],

    registry_version: input.registry.version,
    world_preset: input.registry.worldPreset,
    start_room_id: input.registry.startRoomId,

    title: (data.title as string).trim(),
    opening: (data.opening as string).trim(),

    ...(input.learningContext
      ? { learning_context: input.learningContext }
      : {}),

    missions: missions as StoryBundleDraftV01["missions"],
    dialogues: dialogues as StoryBundleDraftV01["dialogues"],
    tasks: tasks as StoryBundleDraftV01["tasks"],
    evidence: evidence as StoryBundleDraftV01["evidence"],

    ...(hints
      ? { hints: hints as StoryBundleDraftV01["hints"] }
      : {}),

    ...(feedback
      ? { feedback: feedback as StoryBundleDraftV01["feedback"] }
      : {}),

    endings: endings as StoryBundleDraftV01["endings"],
  };
}