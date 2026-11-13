/**
 * B12 — Persistent Learning Objective Identity
 *
 * Database identity: public.learning_objectives.id (UUID)
 * Public QuestV1 identity: LO-<UPPERCASE_UUID>
 *
 * Mapping is deterministic and reversible.
 * This module does NOT grant authorization.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_LO_PATTERN =
  /^LO-([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})$/;

export function uuidToPublicLoId(uuid: string): string | null {
  if (!UUID_PATTERN.test(uuid)) {
    return null;
  }

  return `LO-${uuid.toUpperCase()}`;
}

export function publicLoIdToUuid(publicId: string): string | null {
  const match = PUBLIC_LO_PATTERN.exec(publicId);

  if (!match) {
    return null;
  }

  return match[1].toLowerCase();
}
