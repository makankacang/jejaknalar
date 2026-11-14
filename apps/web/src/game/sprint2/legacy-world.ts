/** Internal PIC D registry. All IDs provisional; not a QuestV1 extension. */
export type WorldId = 'school' | 'city';
export type Point = { x: number; y: number };
export type Heading = 'up' | 'down' | 'left' | 'right';
export type Solid = Point & { id: string; width: number; height: number; heightArt: number; kind: 'desk' | 'shelf' | 'plant' };
export type Target = Point & { id: string; label: string; kind: 'npc' | 'task' | 'door'; task?: string; to?: string; required?: string };
export type Room = { id: string; title: string; world: WorldId; width: number; height: number; spawn: Point; solids: Solid[]; targets: Target[] };
export const REGISTRY_VERSION = 'D-internal-1.0';
export const CELL = 16, FEET = 7, RANGE = 54;
const names = { school: ['Koridor sekolah', 'Perpustakaan', 'Kelas', 'Kantor petugas', 'Laboratorium', 'Ruang listrik', 'Aula diskusi'], city: ['Alun-alun', 'Pasar', 'Balai warga', 'Perpustakaan kota', 'Klinik', 'Bengkel utilitas', 'Taman kota'] };
const suffix = { school: ['hub', 'library', 'class', 'office', 'lab', 'energy', 'hall'], city: ['hub', 'market', 'council', 'library', 'clinic', 'utility', 'park'] };
export const roomId = (world: WorldId, index: number) => `${world}_${suffix[world][index]}`;
export const ROOMS: Record<string, Room> = {};
for (const world of ['school', 'city'] as const) for (let i = 0; i < 7; i++) {
  const id = roomId(world, i);
  const targets: Target[] = [{ id: `${id}:npc`, label: i === 0 ? (world === 'school' ? 'Bu Rani' : 'Pak Damar') : `Petugas ${names[world][i]}`, kind: 'npc', x: 360, y: 280 }];
  if (i === 0) for (let j = 1; j <= 6; j++) targets.push({ id: `${id}:door${j}`, label: names[world][j], kind: 'door', x: 120 + (j - 1) % 3 * 264, y: j <= 3 ? 96 : 480, to: roomId(world, j), required: j === 6 ? 'decide' : undefined });
  else targets.push({ id: `${id}:return`, label: 'Kembali ke pusat', kind: 'door', x: 392, y: 480, to: roomId(world, 0) });
  const task = ['', 'observe', 'side', 'investigate', 'support', 'operate', 'transfer'][i];
  targets.push({ id: `${id}:task`, kind: 'task', task: i === 0 ? 'decide' : task, label: ['Papan keputusan', 'Buku pengamatan', 'Titipan petugas', 'Bandingkan catatan', 'Meja pendampingan', 'Panel simulasi', 'Kasus lanjutan'][i], x: 584, y: 280 });
  const solids: Solid[] = [
    { id: `${id}:shelf`, kind: 'shelf', x: 224, y: 144, width: 96, height: 32, heightArt: 52 },
    { id: `${id}:table`, kind: 'desk', x: 432, y: 336, width: 112, height: 48, heightArt: 24 },
    { id: `${id}:plant`, kind: 'plant', x: 128, y: 320, width: 32, height: 32, heightArt: 32 },
    { id: `${id}:cabinet`, kind: 'shelf', x: 640, y: 160, width: 64, height: 32, heightArt: 48 },
  ];
  ROOMS[id] = { id, title: names[world][i], world, width: 784, height: 560, spawn: { x: 392, y: 424 }, solids, targets };
}
export function blocked(room: Room, p: Point, radius = FEET): boolean {
  return !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x - radius < 32 || p.y - radius < 64 || p.x + radius > room.width - 32 || p.y + radius > room.height - 32 || room.solids.some(s => p.x + radius > s.x && p.x - radius < s.x + s.width && p.y + radius > s.y && p.y - radius < s.y + s.height);
}
export function lineClear(room: Room, a: Point, b: Point, radius = 0): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
  for (let i = 0; i <= n; i++) if (blocked(room, { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }, radius)) return false;
  return true;
}
export function canInteract(room: Room, a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y) <= RANGE && lineClear(room, a, b); }
export function move(room: Room, from: Point, dx: number, dy: number): Point {
  const p = { ...from }, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
  for (let i = 0; i < steps; i++) {
    if (!blocked(room, { x: p.x + dx / steps, y: p.y })) p.x += dx / steps;
    if (!blocked(room, { x: p.x, y: p.y + dy / steps })) p.y += dy / steps;
  }
  return p;
}
/** Cardinal BFS, swept edges and exact end segments: never diagonally cut corners. */
export function findPath(room: Room, start: Point, goal: Point): Point[] {
  if (blocked(room, start) || blocked(room, goal)) return [];
  const cols = Math.ceil(room.width / CELL), rows = Math.ceil(room.height / CELL);
  const index = (p: Point) => Math.floor(p.y / CELL) * cols + Math.floor(p.x / CELL);
  const point = (n: number) => ({ x: (n % cols) * CELL + CELL / 2, y: Math.floor(n / cols) * CELL + CELL / 2 });
  const first = index(start), last = index(goal);
  if (!lineClear(room, start, point(first), FEET) || !lineClear(room, point(last), goal, FEET)) return [];
  const queue = [first], prev = new Map<number, number>([[first, -1]]);
  for (let at = 0; at < queue.length; at++) {
    const n = queue[at];
    if (n === last) { const result: Point[] = [goal]; for (let k = n; k !== -1; k = prev.get(k)!) result.unshift(point(k)); return result; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = n % cols + dx, y = Math.floor(n / cols) + dy, next = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows || prev.has(next) || !lineClear(room, point(n), point(next), FEET)) continue;
      prev.set(next, n); queue.push(next);
    }
  }
  return [];
}
export function approach(room: Room, start: Point, target: Point): Point[] {
  const candidates: Point[] = [];
  for (let y = target.y - 40; y <= target.y + 40; y += 16) for (let x = target.x - 40; x <= target.x + 40; x += 16) if (canInteract(room, { x, y }, target) && !blocked(room, { x, y })) candidates.push({ x, y });
  candidates.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
  for (const p of candidates) { const path = findPath(room, start, p); if (path.length) return path; }
  return [];
}
export const safeSpawn = (room: Room, p: Point) => blocked(room, p) || !findPath(room, room.spawn, p).length ? { ...room.spawn } : p;
