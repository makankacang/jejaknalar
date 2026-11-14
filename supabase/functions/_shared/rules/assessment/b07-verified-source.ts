/**
 * B07: resolve provenance of server-held material for a published QuestV1.
 * Never accept source text, LO identities, or teacher approval from a student.
 * The calling worker must obtain each row using its service-role DB connection.
 */
import { publicLoIdToUuid } from "../../../api/lo-identity.ts";

type Row = Record<string, unknown>;
const record = (x: unknown): x is Row =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function publicObjectiveUuids(questPayload: unknown): string[] {
  if (
    !record(questPayload) || !Array.isArray(questPayload.objective_ids) ||
    questPayload.objective_ids.length < 1 ||
    questPayload.objective_ids.length > 50
  ) {
    throw new Error("INVALID_QUEST_OBJECTIVES");
  }
  const ids = questPayload.objective_ids.map((publicId: unknown) =>
    typeof publicId === "string" ? publicLoIdToUuid(publicId) : null
  );
  if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) {
    throw new Error("UNRESOLVED_QUEST_OBJECTIVES");
  }
  return ids as string[];
}

export function verifyApprovedSource(input: {
  questPayload: unknown;
  publishedApprovedBy: unknown;
  objectiveRows: unknown;
  moduleRow: unknown;
  snapshotRow: unknown;
}): string {
  const expectedIds = publicObjectiveUuids(input.questPayload);
  const teacherId = input.publishedApprovedBy;
  if (
    typeof teacherId !== "string" || !uuid.test(teacherId) ||
    !Array.isArray(input.objectiveRows) ||
    input.objectiveRows.length !== expectedIds.length ||
    !record(input.moduleRow) || !record(input.snapshotRow)
  ) {
    throw new Error("UNVERIFIED_SCORING_SOURCE");
  }
  const objectives = input.objectiveRows;
  const seen = new Set<string>();
  let moduleId: string | null = null;
  let textVersion: string | null = null;
  for (const row of objectives) {
    if (
      !record(row) || typeof row.id !== "string" ||
      !expectedIds.includes(row.id.toLowerCase()) ||
      seen.has(row.id.toLowerCase()) ||
      row.review_status !== "approved" ||
      typeof row.module_id !== "string" || !uuid.test(row.module_id) ||
      typeof row.text_version !== "string" || !uuid.test(row.text_version)
    ) {
      throw new Error("UNAPPROVED_OR_MISMATCHED_OBJECTIVE");
    }
    seen.add(row.id.toLowerCase());
    if (moduleId !== null && moduleId !== row.module_id) {
      throw new Error("MIXED_OBJECTIVE_MODULES");
    }
    if (textVersion !== null && textVersion !== row.text_version) {
      throw new Error("MIXED_SOURCE_VERSIONS");
    }
    moduleId = row.module_id;
    textVersion = row.text_version;
  }
  if (
    input.moduleRow.id !== moduleId ||
    input.moduleRow.owner_uid !== teacherId ||
    input.snapshotRow.module_id !== moduleId ||
    input.snapshotRow.text_version !== textVersion ||
    typeof input.snapshotRow.extracted_text !== "string"
  ) {
    throw new Error("SCORING_SOURCE_OWNERSHIP_MISMATCH");
  }
  const source = input.snapshotRow.extracted_text;
  if (
    !source.trim() || source.length > 20_000 ||
    new TextEncoder().encode(source).byteLength > 20_000
  ) {
    // Do not silently truncate teacher material: that could alter academic meaning.
    throw new Error("SCORING_SOURCE_NOT_SUPPORTED");
  }
  return source;
}
