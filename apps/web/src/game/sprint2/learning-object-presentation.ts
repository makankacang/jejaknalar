/** Render mapping for module-driven learning props. Not a change to immutable QuestV1.
 *  Unknown physical types are intentionally rejected, not silently shown as generic modals.
 */
import { ROOMS, type ArtObject, type Target } from './world';

export type CloseupType = 'book' | 'folder' | 'board' | 'poster' | 'screen' | 'letter' | 'panel' | 'instrument';
export type RuntimeStateMarker = 'not_started' | 'active' | 'completed';

/** Runtime-only presentation metadata. This is NOT a QuestV1 field or assessment evidence. */
export type ObjectPresentation = {
  world_object: string;
  interaction_anchor: string;
  closeup_type: CloseupType;
  content_source: 'story_bundle.source_refs.excerpt';
  state_marker: RuntimeStateMarker;
  label: string;
};

const CATEGORIES: Record<CloseupType, readonly string[]> = {
  book: ['guestbook', 'book_pile', 'atlas', 'attendance', 'textbook', 'book', 'diary'],
  folder: ['document', 'folder', 'report', 'file', 'binder'],
  board: ['case_board', 'whiteboard', 'notice_board', 'blackboard', 'bulletin_board'],
  poster: ['poster', 'wall_poster', 'infographic'],
  screen: ['interactive_screen', 'screen_board', 'computer', 'monitor', 'tablet', 'projector'],
  letter: ['letter', 'note', 'envelope', 'paper', 'worksheet'],
  panel: ['control_panel', 'switchboard', 'electric_panel', 'circuit', 'machine_panel'],
  instrument: ['demo_table', 'microscope', 'lab_desk', 'measuring_device', 'thermometer', 'multimeter'],
};

export function closeupTypeForKind(kind: string): CloseupType | null {
  for (const [type, kinds] of Object.entries(CATEGORIES)) {
    if (kinds.includes(kind)) return type as CloseupType;
  }
  return null;
}

export function presentationForTarget(
  object: ArtObject,
  target: Target,
  stateMarker: RuntimeStateMarker = 'not_started',
): ObjectPresentation | null {
  if (target.kind !== 'task' || target.objectId !== object.id || !target.id) return null;
  const type = closeupTypeForKind(object.kind);
  if (!type) return null;
  return {
    world_object: object.id,
    interaction_anchor: target.id,
    closeup_type: type,
    content_source: 'story_bundle.source_refs.excerpt',
    state_marker: stateMarker,
    label: object.label || target.label,
  };
}

/** Must return a known physical type for an activity to be recorded.
 *  If null, PIC C/D must map the new kind before the quest is publish-ready.
 */
export function presentationForTask(
  roomId: string,
  objectId: string,
  stateMarker: RuntimeStateMarker = 'not_started',
): ObjectPresentation | null {
  const room = ROOMS[roomId];
  if (!room) return null;
  const object = room.objects.find(o => o.id === objectId);
  const target = room.targets.find(t => t.kind === 'task' && t.objectId === objectId);
  return object && target ? presentationForTarget(object, target, stateMarker) : null;
}
