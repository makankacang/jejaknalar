/** Aturan jangkauan interaksi dalam koordinat world Phaser (800 x 420).
 * Murni/data-only supaya bisa diuji tanpa browser dan tanpa Phaser.
 */
export type InteractionTarget = 'npc' | 'document' | 'challenge';
export interface WorldPoint { x: number; y: number }
export type ProximityState = Record<InteractionTarget, boolean>;

export const INTERACTION_RADIUS = 112;
export const TARGET_POINTS: Record<InteractionTarget, WorldPoint> = {
  npc: { x: 160, y: 175 },
  document: { x: 610, y: 170 },
  challenge: { x: 615, y: 330 },
};
export const TARGET_LABELS: Record<InteractionTarget, string> = {
  npc: 'Bu Rani',
  document: 'Dokumen',
  challenge: 'Tantangan',
};
export const INTERACTION_TARGETS: readonly InteractionTarget[] = ['npc', 'document', 'challenge'];

export function distanceToTarget(player: WorldPoint, target: InteractionTarget): number {
  const point = TARGET_POINTS[target];
  return Math.hypot(player.x - point.x, player.y - point.y);
}

export function isWithinInteractionRange(player: WorldPoint, target: InteractionTarget): boolean {
  return distanceToTarget(player, target) <= INTERACTION_RADIUS;
}

export function getProximity(player: WorldPoint): ProximityState {
  return {
    npc: isWithinInteractionRange(player, 'npc'),
    document: isWithinInteractionRange(player, 'document'),
    challenge: isWithinInteractionRange(player, 'challenge'),
  };
}

/** Dipakai tombol E: interaksi hanya dengan target TERDEKAT yang masih dalam radius. */
export function nearestInteractableTarget(player: WorldPoint): InteractionTarget | null {
  let closest: InteractionTarget | null = null;
  let bestDistance = Infinity;
  for (const target of INTERACTION_TARGETS) {
    const distance = distanceToTarget(player, target);
    if (distance <= INTERACTION_RADIUS && distance < bestDistance) {
      closest = target;
      bestDistance = distance;
    }
  }
  return closest;
}

export function sameProximity(a: ProximityState, b: ProximityState): boolean {
  return a.npc === b.npc && a.document === b.document && a.challenge === b.challenge;
}
