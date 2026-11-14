/** PIC D draft spatial registry, derived from mock v1.4. Never a QuestV1 alias. */
import mock from './school-v1.4.json';
import { createCityRooms, CITY_LAYOUT_VERSION } from './city/world';
export type { WorldId, Point, Heading } from './legacy-world';
import type { WorldId, Point, Heading } from './legacy-world';
export type Rect = Point & { width: number; height: number };
export type ArtObject = { id: string; x: number; y: number; w: number; h: number; kind: string; solid: boolean; label?: string; description?: string; interaction: string; anchor?: number[]; task?: string };
export type Solid = Rect & { id: string; kind: string; heightArt: number };
export type Portal = { door_id: string; from_room: string; to_room: string; opening: Rect; approach: Point; trigger: Rect; target_spawn: Point; normal: Heading; backing: Rect };
export type Target = Point & { id: string; label: string; kind: 'npc' | 'task' | 'door' | 'inspect' | 'map'; task?: string; to?: string; required?: string; role?: string; message?: string; color?: string; portal?: Portal; objectId?: string; display?: Point; description?: string };
export type Room = { id: string; title: string; world: WorldId; theme: string; width: number; height: number; spawn: Point; solids: Solid[]; targets: Target[]; objects: ArtObject[]; walls: Rect[] };
export const REGISTRY_VERSION = 'D-school-1.4-sprint2-1';
export const registryFor = (world:WorldId) => world === 'city' ? CITY_LAYOUT_VERSION : REGISTRY_VERSION;
export const TILE = 40, CELL = 16, FEET = 9, RANGE = 62;
export const WALK_SPEED = 170, RUN_SPEED = 272;
const SCHOOL = ['school.courtyard', 'school.corridor', 'school.classroom', 'school.library', 'school.staff_room', 'school.laboratory', 'school.knowledge_lab', 'school.discussion_hall'];
const CITY = ['city_hub', 'city_market', 'city_council', 'city_library', 'city_clinic', 'city_utility', 'city_park'];
export const roomIds = (w: WorldId) => w === 'school' ? SCHOOL : CITY;
export const roomId = (w: WorldId, i: number) => roomIds(w)[i];
export const locationName = (room: Room) => `${room.world === 'school' ? 'SEKOLAH' : 'KOTA'} · ${room.title}`;
const inside = (p: Point, r: Rect, pad = 0) => p.x >= r.x + pad && p.x <= r.x + r.width - pad && p.y >= r.y + pad && p.y <= r.y + r.height - pad;
const hits = (p: Point, r: Rect, pad: number) => p.x + pad > r.x && p.x - pad < r.x + r.width && p.y + pad > r.y && p.y - pad < r.y + r.height;
export const ROOMS: Record<string, Room> = {};
const taskSlots: Record<string, string> = {
  'school.library.guestbook': 'observe', 'school.staff_room.teacher_note': 'investigate',
  'school.laboratory.demo_table': 'operate', 'school.knowledge_lab.interactive_screen': 'support',
  'school.classroom.attendance': 'side', 'school.discussion_hall.case_board': 'decide',
  'school.discussion_hall.evidence_desk': 'transfer',
};
function footprint(o: ArtObject): Solid {
  let x = o.x * TILE, y = o.y * TILE, width = o.w * TILE, height = o.h * TILE;
  if (o.kind === 'tree') {
    // Canopy occupies walkable-looking pixels in top-down view. Keep a generous
    // physical footprint so the avatar cannot appear to stand in the foliage.
    x += width * .12; y += height * .18; width *= .76; height *= .79;
  }
  if (o.kind === 'flagpole') { x += width * .37; y += height * .6; width = 10; height = 16; }
  return { id: o.id, x, y, width, height, heightArt: o.kind.includes('shelf') ? 18 : 0, kind: o.kind };
}
for (const raw of Object.values(mock.scenes)) {
  const objects: ArtObject[] = raw.objects;
  const width = raw.width * TILE, height = raw.height * TILE;
  const room: Room = { id: raw.id, title: raw.name, world: 'school', theme: raw.theme, width, height, spawn: { x: raw.spawn[0] * TILE, y: raw.spawn[1] * TILE }, objects, solids: objects.filter(o => o.solid).map(footprint), walls: raw.theme === 'outdoor' ? [] : [{ x: 0, y: 0, width, height: 96 }, { x: 0, y: 0, width: 40, height }, { x: width - 40, y: 0, width: 40, height }, { x: 0, y: height - 40, width, height: 40 }], targets: [] };
  for (const n of raw.npcs) room.targets.push({ id: n.id, label: n.name, role: n.role, message: n.message, color: n.color, kind: 'npc', x: n.x * TILE, y: n.y * TILE });
  for (const p of raw.portals) {
    const north = p.side === 'north', x = (p.x + .6) * TILE;
    // A short vestibule cuts ONLY its wall opening. Solid backing prevents walking into void.
    const y = raw.theme === 'outdoor' ? p.y * TILE : north ? 80 : height - 28;
    const opening: Rect = { x: x - 42, y: north ? y - 32 : y - 60, width: 84, height: 100 };
    const portal: Portal = { door_id: `${raw.id}:${p.id}`, from_room: raw.id, to_room: p.target, opening, approach: { x, y: north ? y + 58 : y - 58 }, trigger: { x: x - 24, y: north ? y + 12 : y - 42, width: 48, height: 30 }, target_spawn: { x: p.target_spawn[0] * TILE, y: p.target_spawn[1] * TILE }, normal: north ? 'up' : 'down', backing: { x: x - 42, y: north ? y - 6 : y + 6, width: 84, height: 12 } };
    // Visual door leaves occupy a taller strip than the wall's logical opening.
    // Put the hard stop AT the painted threshold and the interaction zone on
    // the accessible floor, independent of the wall collision and decoration.
    if (north) {
      portal.backing = { x: x - 48, y: y - 27, width: 96, height: 91 };
      portal.approach = { x, y: y + 94 };
      portal.trigger = { x: x - 62, y: y + 64, width: 124, height: 78 };
    } else {
      portal.backing = { x: x - 48, y: y - 76, width: 96, height: 83 };
      portal.approach = { x, y: y - 112 };
      portal.trigger = { x: x - 62, y: y - 148, width: 124, height: 78 };
    }
    if (room.id === 'school.courtyard' && p.id === 'main_entrance') {
      // Stand in front of the painted entrance. A player must press E here;
      // walking north must never put their feet underneath the door sprite.
      portal.trigger = { x: x - 27, y: y + 54, width: 54, height: 38 };
      portal.approach = { x, y: y + 87 };
      portal.backing = { x: x - 46, y: y + 38, width: 92, height: 14 };
    }
    room.targets.push({ id: portal.door_id, label: p.label, kind: 'door', x, y: north ? y + 27 : y - 27, display: { x, y }, to: p.target, required: p.target === 'school.discussion_hall' ? 'investigate' : undefined, portal });
  }
  for (const o of objects) {
    if (o.interaction === 'none' || o.kind === 'building_sign') continue;
    const task = taskSlots[o.id];
    // Interaction anchors are in free floor space, not inside desks/objects.
    let point = o.anchor ? { x: o.anchor[0] * TILE, y: o.anchor[1] * TILE } : { x: (o.x + o.w / 2) * TILE, y: (o.y + o.h) * TILE + 24 };
    // Reviewed mock anchors: chair footprints block the front of student desks.
    if (o.kind === 'student_desk') point = { x: (o.x + o.w) * TILE + 24, y: (o.y + o.h / 2) * TILE };
    if (o.id === 'school.courtyard.tree_2') point = { x: 6.4 * TILE, y: 28.5 * TILE };
    if (o.id === 'school.courtyard.sport_court') point = { x: 36 * TILE, y: 18 * TILE };
    if (o.id === 'school.library.bookshelf_wall_0') point = { x: 10.7 * TILE, y: 3.6 * TILE };
    if (o.id === 'school.library.reading_clock') point = { x: 25.5 * TILE, y: 3.5 * TILE };
    if (o.id === 'school.staff_room.teacher_note') point = { x: 22.6 * TILE, y: 20.2 * TILE };
    if (o.id === 'school.knowledge_lab.interactive_screen') point = { x: 17 * TILE, y: 3.5 * TILE };
    room.targets.push({ id: `${o.id}:interaction`, label: o.label || o.id.split('.').at(-1)!, kind: task ? 'task' : o.interaction === 'map' ? 'map' : 'inspect', task, objectId: o.id, display: { x: (o.x + o.w / 2) * TILE, y: (o.y + o.h / 2) * TILE }, description: o.description || 'Bisa kamu lihat-lihat. Tidak diperlukan untuk tugas saat ini.', ...point });
  }
  // Visual identity only: differentiate repeated furniture, preserve IDs/colliders.
  const counts = new Map<string,number>();
  for (const t of room.targets) if (t.kind==='inspect' || t.kind==='task') counts.set(t.label,(counts.get(t.label)??0)+1);
  const index = new Map<string,number>();
  for (const t of room.targets) if ((counts.get(t.label)??0)>1) {
    const n=(index.get(t.label)??0)+1;index.set(t.label,n);
    t.label=`${t.label} ${n}`;
  }
  ROOMS[room.id] = room;
}
// School front door is a portal, not a hole through the painted building.
// This rear façade collider ends before the approach trigger, so E remains usable.
// Internal world geometry only: does not change any PIC B/C object or portal IDs.
const schoolEntrance = ROOMS['school.courtyard']?.targets.find(t => t.portal?.to_room === 'school.corridor')?.portal;
if (schoolEntrance) ROOMS['school.courtyard'].solids.push({
  id: 'pic-d:school:entrance-facade', kind: 'entrance-facade',
  x: schoolEntrance.approach.x - 72, y: 326, width: 144,
  height: schoolEntrance.backing.y - 326 + 5, heightArt: 0,
});
Object.assign(ROOMS, createCityRooms());
export function blocked(room: Room, p: Point, radius = FEET, ignoreNpc = false): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x - radius < 0 || p.y - radius < 0 || p.x + radius > room.width || p.y + radius > room.height) return true;
  const portals = room.targets.flatMap(t => t.portal ? [t.portal] : []);
  if (portals.some(d => hits(p, d.backing, radius))) return true;
  if (room.walls.some(w => hits(p, w, radius)) && !portals.some(d => inside(p, d.opening, radius))) return true;
  // NPCs are people occupying space, not decals the player can walk through.
  if (!ignoreNpc && room.targets.some(t => t.kind === 'npc' && Math.hypot(p.x - t.x, p.y - t.y) < radius + 13)) return true;
  return room.solids.some(s => hits(p, s, radius));
}
export function lineClear(room: Room, a: Point, b: Point, radius = 0, ignoreNpc = false): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  for (let i = 0; i <= steps; i++) if (blocked(room, { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }, radius, ignoreNpc)) return false;
  return true;
}
export function canUsePortal(room: Room, p: Point, t: Target) {
  const d = t.portal;
  if (!d || d.from_room !== room.id || !ROOMS[d.to_room] || ROOMS[d.to_room].world !== room.world || blocked(room, p)) return false;
  // Wider, floor-side interaction area fixes 'too close to the door = E fails'.
  // Never grant a transition from inside a wall, behind the leaf, or through
  // an obstacle. A target's required quest status is still checked by state.ts.
  const lateral = Math.abs(p.x - d.approach.x);
  const distance = Math.hypot(p.x - d.approach.x, p.y - d.approach.y);
  const front = d.normal === 'up'
    ? p.y >= d.backing.y + d.backing.height + FEET - 1
    : p.y <= d.backing.y - FEET + 1;
  return front && lateral <= 83 && distance <= 112 && lineClear(room, p, d.approach, FEET);
}
export function canInteract(room: Room, a: Point, b: Point): boolean {
  const t = b as Target;
  if (t.portal) return canUsePortal(room, a, t);
  // The NPC endpoint is intentionally occupied; stop the sightline at conversation distance.
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  if (t.kind === 'npc') {
    if (blocked(room, a) || distance > RANGE || distance < 1) return false;
    const stop = Math.max(0, distance - (FEET + 15)) / distance;
    return lineClear(room, a, { x: a.x + (b.x - a.x) * stop, y: a.y + (b.y - a.y) * stop }, FEET);
  }
  return !blocked(room, a) && distance <= RANGE && lineClear(room, a, b);
}
export function move(room: Room, from: Point, dx: number, dy: number): Point {
  const p = { ...from }, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
  for (let i = 0; i < steps; i++) { if (!blocked(room, { x: p.x + dx / steps, y: p.y })) p.x += dx / steps; if (!blocked(room, { x: p.x, y: p.y + dy / steps })) p.y += dy / steps; }
  return p;
}
export function movementDelta(axis: Point, dt: number, running: boolean): Point {
  const mag = Math.hypot(axis.x, axis.y), step = (running ? RUN_SPEED : WALK_SPEED) * Math.max(0, Math.min(dt, 50)) / 1000;
  return mag ? { x: axis.x / mag * step, y: axis.y / mag * step } : { x: 0, y: 0 };
}
/** Cardinal grid and swept connectors. Grid centers are found near arbitrary free-floor endpoints. */
export function findPath(room: Room, start: Point, goal: Point): Point[] {
  if (blocked(room, start) || blocked(room, goal)) return [];
  const cols = Math.ceil(room.width / CELL), rows = Math.ceil(room.height / CELL);
  const point = (n: number) => ({ x: (n % cols + .5) * CELL, y: (Math.floor(n / cols) + .5) * CELL });
  const nearest = (p: Point) => {
    const found: number[] = []; const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy, n = yy * cols + xx; if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && lineClear(room, p, point(n), FEET)) found.push(n); }
    return found.sort((a, b) => Math.hypot(point(a).x - p.x, point(a).y - p.y) - Math.hypot(point(b).x - p.x, point(b).y - p.y))[0];
  };
  const first = nearest(start), last = nearest(goal); if (first === undefined || last === undefined) return [];
  const queue = [first], prev = new Map<number, number>([[first, -1]]);
  for (let at = 0; at < queue.length; at++) {
    const n = queue[at]; if (n === last) { const path: Point[] = [goal]; for (let k = n; k !== -1; k = prev.get(k)!) path.unshift(point(k)); return path; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = n % cols + dx, y = Math.floor(n / cols) + dy, next = y * cols + x; if (x < 0 || y < 0 || x >= cols || y >= rows || prev.has(next) || !lineClear(room, point(n), point(next), FEET)) continue; prev.set(next, n); queue.push(next); }
  }
  return [];
}
export function approach(room: Room, start: Point, target: Target): Point[] {
  if (target.portal) {
    // Approach a safe point OUTSIDE the painted door instead of the midpoint
    // of a trigger that might lie within the sprite or wall.
    return findPath(room, start, target.portal.approach);
  }
  const points: Point[] = [];
  for (let y = target.y - 32; y <= target.y + 32; y += 16) for (let x = target.x - 32; x <= target.x + 32; x += 16) if (canInteract(room, { x, y }, target)) points.push({ x, y });
  points.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
  for (const p of points) { const path = findPath(room, start, p); if (path.length) return path; } return [];
}
export const safeSpawn = (room: Room, p: Point) => blocked(room, p) || !findPath(room, room.spawn, p).length ? { ...room.spawn } : { ...p };
