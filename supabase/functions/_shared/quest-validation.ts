/**
 * B06: Strict public QuestV1 validation.
 * Never persist or expose private scoring data in public_payload.
 */

export type PublicQuestV1 = {
  schema_version: "1.0";
  quest_id: string;
  quest_version_id: string;
  objective_ids: string[];
  template: "evidence_hunt";
  scene_id: string;
  steps: Array<
    | { id: string; type: "read_document"; ref: string }
    | { id: string; type: "select_evidence"; item_id: string }
  >;
  variants: {
    needs_support: string;
    developing: string;
    ready_for_extension: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function validString(value: unknown, max = 120): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

export function validatePublicQuestV1(input: unknown): PublicQuestV1 | null {
  if (!isRecord(input)) return null;

  // Reject unknown top-level fields, including private answer keys.
  if (
    !exactKeys(input, [
      "schema_version",
      "quest_id",
      "quest_version_id",
      "objective_ids",
      "template",
      "scene_id",
      "steps",
      "variants",
    ])
  ) {
    return null;
  }

  if (input.schema_version !== "1.0") return null;
  if (input.template !== "evidence_hunt") return null;

  if (
    !validString(input.quest_id) ||
    !/^QUEST-[A-Z0-9-]+$/.test(input.quest_id)
  ) {
    return null;
  }

  if (
    !validString(input.quest_version_id) ||
    !/^QV-[A-Z0-9-]+$/.test(input.quest_version_id)
  ) {
    return null;
  }

  if (!validString(input.scene_id)) return null;

  if (
    !Array.isArray(input.objective_ids) ||
    input.objective_ids.length < 1 ||
    input.objective_ids.length > 32
  ) {
    return null;
  }

  const objectiveIds: string[] = [];
  for (const id of input.objective_ids) {
    if (!validString(id) || !/^LO-[A-Z0-9-]+$/.test(id)) {
      return null;
    }
    if (objectiveIds.includes(id)) return null;
    objectiveIds.push(id);
  }

  if (
    !Array.isArray(input.steps) ||
    input.steps.length < 1 ||
    input.steps.length > 100
  ) {
    return null;
  }

  const steps: PublicQuestV1["steps"] = [];
  const stepIds = new Set<string>();

  for (const step of input.steps) {
    if (!isRecord(step) || !validString(step.id, 80)) {
      return null;
    }

    if (stepIds.has(step.id)) return null;
    stepIds.add(step.id);

    if (step.type === "read_document") {
      if (!exactKeys(step, ["id", "type", "ref"]) || !validString(step.ref)) {
        return null;
      }

      steps.push({
        id: step.id,
        type: "read_document",
        ref: step.ref,
      });
    } else if (step.type === "select_evidence") {
      if (
        !exactKeys(step, ["id", "type", "item_id"]) ||
        !validString(step.item_id)
      ) {
        return null;
      }

      steps.push({
        id: step.id,
        type: "select_evidence",
        item_id: step.item_id,
      });
    } else {
      return null;
    }
  }

  if (!isRecord(input.variants)) return null;

  if (
    !exactKeys(input.variants, [
      "needs_support",
      "developing",
      "ready_for_extension",
    ])
  ) {
    return null;
  }

  const support = input.variants.needs_support;
  const developing = input.variants.developing;
  const extension = input.variants.ready_for_extension;

  if (
    !validString(support) ||
    !validString(developing) ||
    !validString(extension)
  ) {
    return null;
  }

  // Construct a new public-only object. Never return raw input.
  const publicQuest: PublicQuestV1 = {
    schema_version: "1.0",
    quest_id: input.quest_id,
    quest_version_id: input.quest_version_id,
    objective_ids: objectiveIds,
    template: "evidence_hunt",
    scene_id: input.scene_id,
    steps,
    variants: {
      needs_support: support,
      developing,
      ready_for_extension: extension,
    },
  };

  if (
    new TextEncoder().encode(JSON.stringify(publicQuest)).length > 32 * 1024
  ) {
    return null;
  }

  return publicQuest;
}
