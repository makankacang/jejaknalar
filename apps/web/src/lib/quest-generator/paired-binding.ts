
/**
 * C-04 explicit paired binding validator.
 *
 * C validates content identity across QuestV1, Story Bundle,
 * backend identity aliases, and private assessment references.
 *
 * Registry, presentation rendering, and Phaser runtime are owned by PIC D.
 * Persistent IDs and assessment scoring are owned by PIC B.
 */

export type C04BindingIssueCode =
  | "INVALID_OBJECT"
  | "FIXTURE_IDENTITY_REQUIRED"
  | "QUEST_VERSION_MISMATCH"
  | "IDENTITY_ALIAS_MISMATCH"
  | "QUEST_STEP_NOT_FOUND"
  | "QUEST_STEP_ITEM_MISMATCH"
  | "READ_STEP_MISMATCH"
  | "ACTIVITY_NOT_FOUND"
  | "OBJECTIVE_BINDING_MISMATCH"
  | "EVIDENCE_BINDING_MISMATCH"
  | "MISSION_BINDING_MISMATCH"
  | "SOURCE_REFERENCE_MISMATCH"
  | "ASSESSMENT_BINDING_MISMATCH"
  | "PRIVATE_DATA_IN_PUBLIC_PAYLOAD";

export interface C04BindingIssue {
  code: C04BindingIssueCode;
  path: string;
  message: string;
}

export interface C04BindingValidationResult {
  valid: boolean;
  errors: C04BindingIssue[];
  warnings: string[];
}

/**
 * This is a fixture/test-side binding.
 * It is not a new public QuestV1 or Story Bundle schema.
 */
export interface C04ExplicitPairedBinding {
  fixture_only: true;
  production_ready: false;
  quest_version_id: string;
  mission_id: string;
  read_document_step_ids: string[];
  quest_step_id: string;
  activity_id: string;
  item_id: string;
  objective_id: string;
  evidence_id: string;
  room_id: string;
  object_id: string;
}

export interface C04PairedBindingInput {
  quest: unknown;
  storyBundle: unknown;
  identityBinding: unknown;
  privateAssessment: unknown;
  binding: unknown;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord | null =>
  isRecord(value) ? value : null;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asRecords = (value: unknown): JsonRecord[] =>
  asArray(value).filter(isRecord);

const validString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function findPrivateField(
  value: unknown,
  path = "$",
): string | null {
  const forbidden = new Set([
    "answer_key",
    "private_answer_key",
    "correct_answer",
    "correct_answers",
    "rubric",
    "scoring_criteria",
    "accepted_answers",
    "accepted_answer_variants",
    "full_credit_anchor",
    "zero_credit_anchor",
  ]);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findPrivateField(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key.toLowerCase())) {
      return `${path}.${key}`;
    }

    const found = findPrivateField(child, `${path}.${key}`);
    if (found) return found;
  }

  return null;
}

export function validateC04PairedBinding(
  input: C04PairedBindingInput,
): C04BindingValidationResult {
  const errors: C04BindingIssue[] = [];
  const warnings: string[] = [];

  const issue = (
    code: C04BindingIssueCode,
    path: string,
    message: string,
  ) => errors.push({ code, path, message });

  const quest = asRecord(input.quest);
  const story = asRecord(input.storyBundle);
  const identity = asRecord(input.identityBinding);
  const assessment = asRecord(input.privateAssessment);
  const binding = asRecord(input.binding);

  const required = [
    ["quest", quest],
    ["storyBundle", story],
    ["identityBinding", identity],
    ["privateAssessment", assessment],
    ["binding", binding],
  ] as const;

  for (const [name, value] of required) {
    if (!value) {
      issue(
        "INVALID_OBJECT",
        name,
        `${name} must be a JSON object.`,
      );
    }
  }

  if (!quest || !story || !identity || !assessment || !binding) {
    return { valid: false, errors, warnings };
  }

  // All identifiers in this C-04 package are fixture aliases.
  if (
    identity.fixture_only !== true ||
    identity.not_for_production !== true ||
    binding.fixture_only !== true ||
    binding.production_ready !== false
  ) {
    issue(
      "FIXTURE_IDENTITY_REQUIRED",
      "identityBinding",
      "C-04 validation requires explicitly fixture-only identities.",
    );
  } else {
    warnings.push(
      "Fixture aliases must be replaced by backend-persisted IDs before production.",
    );
  }

  // Quest version must stay identical across public and private artifacts.
  const version = quest.quest_version_id;

  if (
    !validString(version) ||
    version !== story.quest_version_id ||
    version !== assessment.quest_version_id ||
    version !== binding.quest_version_id
  ) {
    issue(
      "QUEST_VERSION_MISMATCH",
      "quest_version_id",
      "Quest, Story Bundle, private assessment, and binding must match.",
    );
  }

  // Verify fixture aliases against the backend identity fixture.
  const identifiers = asRecord(identity.identifiers);

  const aliasChecks: Array<[string, unknown]> = [
    ["quest_id", quest.quest_id],
    ["quest_version_id", version],
    ["objective_id", binding.objective_id],
    ["item_id", binding.item_id],
    ["activity_id", binding.activity_id],
    ["evidence_id", binding.evidence_id],
  ];

  for (const [name, actual] of aliasChecks) {
    const identityEntry = asRecord(identifiers?.[name]);

    if (
      !identityEntry ||
      identityEntry.fixture_alias !== actual
    ) {
      issue(
        "IDENTITY_ALIAS_MISMATCH",
        `identityBinding.identifiers.${name}`,
        `Fixture alias for ${name} does not match the paired artifacts.`,
      );
    }
  }

  const assessmentItems = asRecords(assessment.items);
  const matchingItems = assessmentItems.filter(
    (item) => item.item_id === binding.item_id,
  );

  const item = matchingItems[0];

  if (matchingItems.length !== 1 || !item) {
    issue(
      "ASSESSMENT_BINDING_MISMATCH",
      "privateAssessment.items",
      "Exactly one private assessment item must match the explicit item_id.",
    );
  }

  // QuestV1 submission step -> explicit item binding.
  const steps = asRecords(quest.steps);
  const step = steps.find(
    (entry) => entry.id === binding.quest_step_id,
  );

  if (!step || step.type !== "select_evidence") {
    issue(
      "QUEST_STEP_NOT_FOUND",
      "binding.quest_step_id",
      "The bound step must exist and use select_evidence.",
    );
  } else if (step.item_id !== binding.item_id) {
    issue(
      "QUEST_STEP_ITEM_MISMATCH",
      "quest.steps.item_id",
      "QuestV1 item_id does not match the explicit binding.",
    );
  }

  // Exactly the two expected read_document steps.
  const readSteps = steps.filter(
    (entry) => entry.type === "read_document",
  );

  const readIds = binding.read_document_step_ids;
  const readIdSet = new Set<string>(
  Array.isArray(readIds)
    ? readIds.filter((id): id is string => typeof id === 'string')
    : []
);

  if (
    !Array.isArray(readIds) ||
    readSteps.length !== 2 ||
    readIds.length !== 2 ||
    readIdSet.size !== 2 ||
    readSteps.some((entry) => {
  const id = isRecord(entry) ? entry.id : undefined;
  return typeof id !== 'string' || !readIdSet.has(id);
})
  ) {
    issue(
      "READ_STEP_MISMATCH",
      "quest.steps",
      "Both read_document steps must be explicitly bound.",
    );
  }

  // Quest step -> Story Bundle activity.
  const tasks = asRecords(story.tasks);
  const matchingTasks = tasks.filter(
    (task) => task.activity_id === binding.activity_id,
  );

  const task = matchingTasks[0];

  if (matchingTasks.length !== 1 || !task) {
    issue(
      "ACTIVITY_NOT_FOUND",
      "storyBundle.tasks",
      "Exactly one Story Bundle task must match activity_id.",
    );
  } else {
    if (
      task.template !== "investigate" ||
      task.room_id !== binding.room_id ||
      task.object_id !== binding.object_id
    ) {
      issue(
        "ACTIVITY_NOT_FOUND",
        "storyBundle.tasks",
        "Activity template, room, or object differs from explicit binding.",
      );
    }

    if (
      !asArray(task.objective_ids).includes(binding.objective_id) ||
      !asArray(quest.objective_ids).includes(binding.objective_id)
    ) {
      issue(
        "OBJECTIVE_BINDING_MISMATCH",
        "storyBundle.tasks.objective_ids",
        "Objective must be referenced by QuestV1 and Story Bundle task.",
      );
    }

    if (!asArray(task.evidence_ids).includes(binding.evidence_id)) {
      issue(
        "EVIDENCE_BINDING_MISMATCH",
        "storyBundle.tasks.evidence_ids",
        "Task must reference the explicitly bound evidence.",
      );
    }

    // Source document references must match both read_document steps.
    const sourceRefs = asRecords(task.source_refs);
    const declaredVersions = asRecords(story.source_document_versions);

    const readRefs = readSteps.map((entry) => entry.ref);
    const sourceDocumentIds = sourceRefs.map(
      (entry) => entry.document_id,
    );
    const sourceMapIds = sourceRefs.map(
      (entry) => entry.source_map_id,
    );

    const versionsValid = sourceRefs.every((source) =>
      declaredVersions.some((doc) =>
        doc.document_id === source.document_id &&
        doc.text_version === source.text_version
      )
    );

    if (
      sourceRefs.length !== 2 ||
      readRefs.some((ref) => !sourceDocumentIds.includes(ref)) ||
      new Set(sourceMapIds).size !== 2 ||
      !versionsValid
    ) {
      issue(
        "SOURCE_REFERENCE_MISMATCH",
        "storyBundle.tasks.source_refs",
        "Both source references must match read steps and document versions.",
      );
    }
  }

  // Mission -> activity and objective.
  const missions = asRecords(story.missions);
  const mission = missions.find(
    (entry) => entry.mission_id === binding.mission_id,
  );

  if (
    !mission ||
    !asArray(mission.activity_ids).includes(binding.activity_id) ||
    !asArray(mission.objective_ids).includes(binding.objective_id)
  ) {
    issue(
      "MISSION_BINDING_MISMATCH",
      "storyBundle.missions",
      "Mission must contain the bound activity and objective.",
    );
  }

  // Narrative evidence is distinct from assessment item.
  const evidenceItems = asRecords(story.evidence);
  const evidence = evidenceItems.find(
    (entry) => entry.evidence_id === binding.evidence_id,
  );

  if (
    !evidence ||
    evidence.mission_id !== binding.mission_id ||
    evidence.room_id !== binding.room_id ||
    evidence.object_id !== binding.object_id ||
    !asArray(evidence.objective_ids).includes(binding.objective_id) ||
    binding.evidence_id === binding.item_id
  ) {
    issue(
      "EVIDENCE_BINDING_MISMATCH",
      "storyBundle.evidence",
      "Narrative evidence must match the mission and remain distinct from item_id.",
    );
  }

  // Private assessment must bind the same item/activity/evidence/objective.
  if (
    item &&
    (
      item.activity_id !== binding.activity_id ||
      item.evidence_id !== binding.evidence_id ||
      item.objective_id !== binding.objective_id ||
      item.response_type !== "constructed_response" ||
      item.submission_value_type !== "string" ||
      item.scoring_mode !== "analytic_rubric"
    )
  ) {
    issue(
      "ASSESSMENT_BINDING_MISMATCH",
      "privateAssessment.items",
      "Private assessment references or response contract do not match.",
    );
  }

  if (assessment.exposure !== "backend_only") {
    issue(
      "ASSESSMENT_BINDING_MISMATCH",
      "privateAssessment.exposure",
      "Private assessment must remain backend-only.",
    );
  }

  // Public payload must not include private scoring fields.
  const privateLeak = findPrivateField({
    quest,
    storyBundle: story,
  });

  if (privateLeak) {
    issue(
      "PRIVATE_DATA_IN_PUBLIC_PAYLOAD",
      privateLeak,
      "Answer key and rubric fields must not enter the public payload.",
    );
  }

  warnings.push(
    "Registry object/NPC capability validation remains owned by PIC D.",
    "Presentation rendering and completion guard remain owned by PIC D.",
    "Live B06 submission and production ID binding have not been verified.",
  );

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
