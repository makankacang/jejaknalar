import { expect, it } from 'vitest';
import { ROOMS } from './world';
import { missionMarkerY } from './marker-layout';
it('active mission markers clear every NPC head instead of masking the eyes', () => {
  const npcs = Object.values(ROOMS).flatMap(r => r.targets.filter(t => t.kind === 'npc'));
  expect(npcs).toHaveLength(15);
  for (const npc of npcs) expect(missionMarkerY(npc) + 8).toBeLessThan(npc.y - 56);
});
