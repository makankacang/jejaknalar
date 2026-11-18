import { describe, expect, it } from 'vitest';
import { closeupTypeForKind, presentationForTask } from './learning-object-presentation';

describe('Module-linked world object and physical close-up contract', () => {
  it('BI8 library book is a real book with same interaction anchor', () => {
    const p = presentationForTask('school.library', 'school.library.guestbook');
    expect(p).toMatchObject({world_object:'school.library.guestbook',closeup_type:'book',content_source:'story_bundle.source_refs.excerpt'});
    expect(p?.interaction_anchor).toBe('school.library.guestbook:interaction');
    expect(p?.state_marker).toBe('not_started');
  });
  it('BI8 staff document appears as a folder, not a generic modal', () => {
    expect(presentationForTask('school.staff_room', 'school.staff_room.teacher_note')?.closeup_type).toBe('folder');
  });
  it('BI8 case board opens a board, not a book', () => {
    expect(presentationForTask('school.discussion_hall', 'school.discussion_hall.case_board')?.closeup_type).toBe('board');
  });
  it('keeps the state marker runtime-only and separate from assessment evidence', () => {
    expect(presentationForTask('school.library', 'school.library.guestbook', 'active')?.state_marker).toBe('active');
    expect(presentationForTask('school.library', 'school.library.guestbook', 'completed')?.state_marker).toBe('completed');
  });
  it('supports additional documented learning props for future modules', () => {
    expect(closeupTypeForKind('poster')).toBe('poster');
    expect(closeupTypeForKind('interactive_screen')).toBe('screen');
    expect(closeupTypeForKind('microscope')).toBe('instrument');
  });
  it('unknown kind is rejected to avoid invisible objects or mismatched close-ups', () => {
    expect(closeupTypeForKind('unmapped_object_xyz')).toBeNull();
    expect(presentationForTask('school.library', 'not-in-the-registry')).toBeNull();
  });
});
