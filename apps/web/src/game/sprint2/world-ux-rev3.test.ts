import { describe, it, expect } from 'vitest';
import { ROOMS, blocked, approach, canUsePortal, move, FEET, safeSpawn } from './world';

describe('World UX Rev 3 collision and portal regression', () => {
  it('main school facade is physically solid behind its doorway', () => {
    const room = ROOMS['school.courtyard'];
    const entrance = room.targets.find(t => t.to === 'school.corridor')!;
    expect(room.solids.some(s => s.id === 'pic-d:school:entrance-facade')).toBe(true);
    expect(blocked(room, {x: entrance.portal!.approach.x, y: 398})).toBe(true);
    const end = move(room, entrance.portal!.approach, 0, -800);
    expect(end.y).toBeGreaterThanOrEqual(entrance.portal!.backing.y + entrance.portal!.backing.height + FEET);
    expect(blocked(room, end)).toBe(false);
    const route = approach(room, room.spawn, entrance);
    expect(route.length).toBeGreaterThan(0);
    expect(canUsePortal(room, route.at(-1)!, entrance)).toBe(true);
  });
  it('all current school and city portals stay reachable without clipping', () => {
    expect(Object.keys(ROOMS)).toHaveLength(15);
    let portals = 0;
    for (const room of Object.values(ROOMS)) {
      expect(blocked(room, room.spawn), room.id).toBe(false);
      for (const portal of room.targets.filter(t => t.portal)) {
        const route = approach(room, room.spawn, portal);
        expect(route.length, portal.id).toBeGreaterThan(0);
        expect(canUsePortal(room, route.at(-1)!, portal), portal.id).toBe(true);
        const spawn = safeSpawn(ROOMS[portal.to!], portal.portal!.target_spawn);
        expect(blocked(ROOMS[portal.to!], spawn)).toBe(false);
        portals++;
      }
    }
    expect(portals).toBe(26);
  });
  it('Taman Kota remains an outdoor area and stays gated by decide', () => {
    expect(ROOMS.city_park.theme).toBe('outdoor');
    expect(ROOMS.city_park.walls).toHaveLength(0);
    const entrance = ROOMS.city_hub.targets.find(t => t.to === 'city_park')!;
    expect(entrance.required).toBe('decide');
    expect(ROOMS.city_hub.objects.find(o => o.kind === 'city_park_entrance')?.solid).toBe(false);
  });
});
