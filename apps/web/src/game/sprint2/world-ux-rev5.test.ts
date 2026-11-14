import { describe, expect, it } from 'vitest';
import { NPC_GENDER, characterLook } from './character-looks';
import { ROOMS, blocked, approach, canUsePortal, safeSpawn } from './world';

const women=['Bu Rani','Bu Dita','Bu Maya','Bu Sinta','Kak Nara','Bu Nisa',
  'Bu Sari','Bu Lestari','Bu Ratna','Kak Wulan'];
const men=['Adit','Pak Arif','Pak Damar','Pak Bima','Mas Bayu'];

describe('Rev5: approved gender and non-random NPC visual identity',()=>{
  it('explicitly maps all 15 names to their approved gender',()=>{
    expect(Object.keys(NPC_GENDER)).toHaveLength(15);
    for(const name of women)expect(NPC_GENDER[name],name).toBe('female');
    for(const name of men)expect(NPC_GENDER[name],name).toBe('male');
  });
  it('all NPCs receive a different stable outfit and hairstyle configuration',()=>{
    const names=[...women,...men];
    const looks=names.map(name=>characterLook('npc:'+name,name,'Warga',0x785f70));
    expect(new Set(looks.map(x=>JSON.stringify([x.shirt,x.hair,x.skin,x.trim,x.accent,x.hairStyle]))).size).toBe(15);
    for(let i=0;i<names.length;i++){
      expect(looks[i]).toEqual(characterLook('npc:'+names[i],names[i],'Warga',0x785f70));
      expect(looks[i].gender).toBe(NPC_GENDER[names[i]]);
    }
  });
  it('every actual quest NPC is included in the cast',()=>{
    const actual=Object.values(ROOMS).flatMap(r=>r.targets.filter(t=>t.kind==='npc').map(t=>t.label));
    expect(new Set(actual)).toEqual(new Set([...women,...men]));
  });
});

describe('Rev5: Taman Kota open-air collision, portals and spawn',()=>{
  const hub=ROOMS.city_hub, park=ROOMS.city_park;
  it('is a real outdoor room, not a building',()=>{
    expect(park.theme).toBe('outdoor');
    expect(park.walls).toHaveLength(0);
    expect(park.objects.some(o=>o.kind.startsWith('city_facade'))).toBe(false);
    expect(park.objects.some(o=>o.kind==='city_pond')).toBe(true);
  });
  it('never spawns a student in a wall, pond, tree or quest object',()=>{
    expect(blocked(park,park.spawn)).toBe(false);
    const inbound=hub.targets.find(t=>t.to==='city_park')!;
    expect(inbound.required).toBe('decide');
    expect(blocked(park,safeSpawn(park,inbound.portal!.target_spawn))).toBe(false);
    expect(park.targets.some(t=>t.kind==='npc'&&t.label==='Kak Wulan')).toBe(true);
  });
  it('keeps the middle of the entrance walkable while the side sign is solid',()=>{
    const entrance=hub.objects.find(o=>o.kind==='city_park_entrance')!;
    const x=entrance.x*40,y=entrance.y*40,w=entrance.w*40;
    expect(blocked(hub,{x:x+w/2,y:y+90})).toBe(false);
    expect(blocked(hub,{x:x+w-92,y:y+80})).toBe(true);
  });
  it('keeps return-to-hub and arrive-from-hub routes accessible',()=>{
    for(const [from,to] of [[hub,park],[park,hub]] as const){
      const portal=from.targets.find(t=>t.to===to.id)!;
      expect(portal).toBeDefined();
      const path=approach(from,from.spawn,portal);
      expect(path.length).toBeGreaterThan(0);
      expect(canUsePortal(from,path.at(-1)!,portal)).toBe(true);
    }
  });
});
