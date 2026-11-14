import { describe, expect, it } from 'vitest';
import { isTextEntryTarget } from './keyboard-focus';

describe('Phaser keyboard focus guard', () => {
  it.each(['INPUT', 'SELECT', 'TEXTAREA'])('recognizes %s as a text-entry target', tagName => {
    expect(isTextEntryTarget({ tagName })).toBe(true);
  });
  it('recognizes contenteditable and role=textbox controls', () => {
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'DIV', getAttribute: name => name === 'role' ? 'textbox' : null })).toBe(true);
  });
  it('does not disable movement for ordinary game canvas/body focus', () => {
    expect(isTextEntryTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isTextEntryTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
