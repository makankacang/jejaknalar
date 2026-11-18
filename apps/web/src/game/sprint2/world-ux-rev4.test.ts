import { describe, it, expect } from 'vitest';
import { ROOMS, blocked, canUsePortal, approach, move, safeSpawn, FEET } from './world';
import { characterLook } from './character-looks';

describe('PIC D Rev 4 / city-school collision + interactive portals', () => {
  it('all 15 rooms, 26 portals and task anchors remain accessible', () => {
    expect(Object.keys(ROOMS)).toHaveLength(15);
    let portalCount = 0;
    for (const room of Object.values(ROOMS)) {
      expect(blocked(room, room.spawn), `blocked spawn ${room.id}`).toBe(false);
      for (const target of room.targets) {
        if (target.portal) {
          const path = approach(room, room.spawn, target);
          expect(path.length, `no path: ${target.id}`).toBeGreaterThan(0);
          expect(canUsePortal(room, path.at(-1)!, target), `E cannot work: ${target.id}`).toBe(true);
          expect(blocked(ROOMS[target.to!], safeSpawn(ROOMS[target.to!], target.portal.target_spawn)), `unsafe arrival ${target.id}`).toBe(false);
          portalCount++;
        } else if (target.kind === 'task') {
          expect(approach(room, room.spawn, target).length, `task unreachable ${target.id}`).toBeGreaterThan(0);
        }
      }
    }
    expect(portalCount).toBe(26);
  });

  it('a near door works without standing at the exact trigger and never works through solid walls', () => {
    const room=ROOMS['school.corridor'];
    const door=room.targets.find(t=>t.to==='school.library')!;
    const p=door.portal!.approach;
    const near={x:p.x,y:p.y+59}; // outside narrow original trigger; still on safe public floor
    expect(blocked(room,near)).toBe(false);
    expect(canUsePortal(room,near,door)).toBe(true);
    expect(canUsePortal(room,{x:p.x,y:p.y+250},door)).toBe(false);
    expect(canUsePortal(room,{x:p.x,y:door.portal!.backing.y+10},door)).toBe(false);
  });

  it('door leaf stops the avatar before its visible edge, both entry and exit', () => {
    for (const [id,to,sign] of [['school.corridor','school.library',-1],['school.laboratory','school.corridor',1],['city_hub','city_market',-1],['city_market','city_hub',1]] as const) {
      const room=ROOMS[id],t=room.targets.find(x=>x.to===to)!,d=t.portal!;
      const after=move(room,d.approach,0,sign*600);
      if (sign < 0) expect(after.y,`${id} leaf north`).toBeGreaterThanOrEqual(d.backing.y+d.backing.height+FEET-1);
      else expect(after.y,`${id} leaf south`).toBeLessThanOrEqual(d.backing.y-FEET+1);
      expect(blocked(room,after)).toBe(false);
    }
  });

  it('city roof edges, tree canopy and lamppost top cannot be walked on', () => {
    const room=ROOMS.city_hub;
    const obj=(kind:string)=>room.objects.find(o=>o.kind===kind)!;
    const facade=obj('city_facade_1'), fX=facade.x*40, fY=facade.y*40;
    expect(blocked(room,{x:fX-8,y:fY+40})).toBe(true);
    const tree=obj('tree'),tx=tree.x*40,ty=tree.y*40,tw=tree.w*40,th=tree.h*40;
    expect(blocked(room,{x:tx+tw/2,y:ty+th*.15})).toBe(true);
    const lamp=obj('city_lamp'),lx=lamp.x*40,ly=lamp.y*40;
    expect(blocked(room,{x:lx+lamp.w*20,y:ly-40})).toBe(true);
  });

  it('Taman Kota remains outdoor, gated, with physically solid posts and a clear central path', () => {
    const hub=ROOMS.city_hub,park=ROOMS.city_park;
    expect(park.theme).toBe('outdoor');expect(park.walls).toHaveLength(0);
    const entrance=hub.targets.find(t=>t.to==='city_park')!;
    expect(entrance.required).toBe('decide');
    const arch=hub.objects.find(o=>o.kind==='city_park_entrance')!;
    const x=arch.x*40,y=arch.y*40,w=arch.w*40;
    expect(blocked(hub,{x:x+w-92,y:y+80})).toBe(true);
    expect(blocked(hub,{x:x+w/2,y:y+45})).toBe(false);
  });
});

describe('PIC D Rev 4 / deterministic original NPC looks', () => {
  const people=['Bu Rani','Bu Maya','Bu Sari','Pak Damar','Pak Bima','Bu Lestari','Bu Ratna','Mas Bayu','Kak Wulan'];
  it('different NPC names have repeatable, visually different looks', () => {
    const looks=people.map(name=>characterLook(name,name,'Warga',0x546878));
    for(let i=0;i<people.length;i++)expect(looks[i]).toEqual(characterLook(people[i],people[i],'Warga',0x546878));
    expect(new Set(looks.map(l=>JSON.stringify(l))).size).toBe(people.length);
  });
  it('fictional NPC silhouettes include short and long hair', () => {
    expect(characterLook('bu','Bu Sari','Pedagang pasar',0x546878).longHair).toBe(true);
    expect(characterLook('pak','Pak Damar','Pengurus lingkungan',0x546878).longHair).toBe(false);
  });
});
