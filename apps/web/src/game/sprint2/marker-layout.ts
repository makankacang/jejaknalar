import type { Target } from './world';
/** A 16px marker must stay above the tallest NPC hair (-56px from feet). */
export const missionMarkerY = (target: Pick<Target, 'kind' | 'y'>) => target.y - (target.kind === 'npc' ? 76 : 48);
