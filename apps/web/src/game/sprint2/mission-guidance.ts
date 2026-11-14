/** PIC D local guidance only. Never represents backend scoring or B08 policy. */
import { ROOMS, approach, roomIds, type Point, type Room, type Target, type WorldId } from './world';
export type MarkerStatus = 'active' | 'available' | 'completed' | 'locked' | 'explore';
export type Guide = { target: Target; label: string; room: string; destination: string; viaDoor: boolean; path: string[] };
export type GuidanceSnapshot = { world: WorldId; room: string; position: Point; objectiveRoom: string | null; objectiveTargetId?: string; statuses?: Record<string, string>; explorer?: boolean };
/** Breadth-first search in the real door graph; locked exits are not routes. */
export function roomRoute(world: WorldId, start: string, finish: string, statuses: Record<string,string> = {}, explorer=false): string[] | null {
  if (!roomIds(world).includes(start) || !roomIds(world).includes(finish)) return null;
  const queue: string[][] = [[start]], visited = new Set([start]);
  for (const path of queue) {
    const last = path[path.length - 1];
    if (last === finish) return path;
    const room = ROOMS[last];
    for (const door of room.targets) {
      if (door.kind !== 'door' || !door.to || ROOMS[door.to]?.world !== world || visited.has(door.to)) continue;
      if (!explorer && door.required && statuses[door.required] !== 'completed') continue;
      visited.add(door.to); queue.push([...path,door.to]);
    }
  }
  return null;
}
/** Target of a single next action: current task in-room, otherwise reachable portal. */
export function resolveGuide(s: GuidanceSnapshot): Guide | null {
  if (!s.objectiveRoom || !ROOMS[s.room] || !ROOMS[s.objectiveRoom]) return null;
  const route = roomRoute(s.world, s.room, s.objectiveRoom, s.statuses, s.explorer);
  if (!route) return null;
  const here = ROOMS[s.room];
  if (route.length === 1) {
    const t = here.targets.find(t=>t.id===s.objectiveTargetId);
    return t ? { target:t, label:t.label, room:s.room, destination:here.title, viaDoor:false, path:route } : null;
  }
  const door = here.targets.find(t=>t.kind==='door' && t.to===route[1] && (s.explorer || !t.required || s.statuses?.[t.required]==='completed'));
  return door ? { target:door, label:`Pintu ke ${ROOMS[route[1]].title}`, room:s.room, destination:ROOMS[s.objectiveRoom].title, viaDoor:true, path:route } : null;
}
export function markerStatus(t: Target, activeTask: string | null, statuses: Record<string,string>): MarkerStatus {
  if (!t.task) return 'explore';
  const status = statuses[t.task] ?? 'locked';
  if (status === 'completed' || status === 'skipped') return 'completed';
  if (status === 'locked') return 'locked';
  return t.task === activeTask ? 'active' : 'available';
}
export function routeWaypoint(room: Room, position: Point, guide: Guide): Point | null {
  const route = approach(room, position, guide.target);
  if (!route.length) return null;
  // First reachable waypoint on the collision-safe route, never a direct-through-wall pointer.
  return route.find(p=>Math.hypot(p.x-position.x,p.y-position.y)>28) ?? route[route.length-1];
}
export function succinctObjective(kind: string, title: string, destination: string): string {
  const hint: Record<string,string> = {
    observe:'Periksa buku pengamatan', operate:'Uji panel lampu', investigate:'Bandingkan catatan petugas',
    decide:'Pilih keputusan berdasarkan bukti', support:'Ikuti latihan pendampingan', transfer:'Selesaikan kasus lanjutan',
  };
  return `${hint[kind] ?? title} · ${destination}`;
}
