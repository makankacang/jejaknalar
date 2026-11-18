export type ScoringItem = {
  item_id: string;
  objective_id: string;
  max_points: number;
};
export type ScoringAnswer = { item_id: string; value: string };
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export function prepareAssessmentScoring(
  quest: unknown,
  privateSpec: unknown,
  submitted: unknown,
) {
  if (
    !record(quest) || !record(privateSpec) || !Array.isArray(quest.steps) ||
    !Array.isArray(quest.objective_ids) || !Array.isArray(privateSpec.items) ||
    !Array.isArray(submitted)
  ) throw new Error("Invalid scoring input structure");
  const objectives = quest.objective_ids;
  if (
    !objectives.length ||
    objectives.some((x) => typeof x !== "string" || !x.trim()) ||
    new Set(objectives).size !== objectives.length
  ) throw new Error("Invalid quest objectives");
  if (quest.steps.some((s) => !record(s))) {
    throw new Error("Invalid quest steps");
  }
  const expectedIds = quest.steps.filter((s) =>
    record(s) && s.type === "select_evidence"
  ).map((s) => (s as Record<string, unknown>).item_id);
  if (
    !expectedIds.length ||
    expectedIds.some((x) => typeof x !== "string" || !x.trim()) ||
    new Set(expectedIds).size !== expectedIds.length
  ) throw new Error("Invalid quest assessment items");
  if (privateSpec.items.length !== expectedIds.length) {
    throw new Error("Rubric item count mismatch");
  }
  const allowed = new Set(expectedIds);
  const items: ScoringItem[] = [];
  const seenRubric = new Set<string>();
  for (const raw of privateSpec.items) {
    if (
      !record(raw) || typeof raw.item_id !== "string" ||
      !allowed.has(raw.item_id) || seenRubric.has(raw.item_id) ||
      typeof raw.objective_id !== "string" ||
      !objectives.includes(raw.objective_id) ||
      typeof raw.max_points !== "number" || !Number.isFinite(raw.max_points) ||
      raw.max_points <= 0 || raw.max_points > 10000
    ) throw new Error("Invalid or mismatched private rubric");
    seenRubric.add(raw.item_id);
    items.push({
      item_id: raw.item_id,
      objective_id: raw.objective_id,
      max_points: raw.max_points,
    });
  }
  if (!submitted.length || submitted.length > 50) {
    throw new Error("Invalid answer count");
  }
  const answers: ScoringAnswer[] = [];
  const seenAnswers = new Set<string>();
  for (const raw of submitted) {
    if (
      !record(raw) || typeof raw.item_id !== "string" ||
      !allowed.has(raw.item_id) || seenAnswers.has(raw.item_id) ||
      typeof raw.value !== "string" || raw.value.length > 5000
    ) throw new Error("Invalid or mismatched answer");
    seenAnswers.add(raw.item_id);
    answers.push({ item_id: raw.item_id, value: raw.value });
  }
  return {
    items,
    answers,
    missing_item_ids: items.filter((x) => !seenAnswers.has(x.item_id)).map((
      x,
    ) => x.item_id),
  };
}
