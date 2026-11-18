/** Shared focus guard so Phaser movement keys never steal native text-entry keys. */
export type EditableTargetLike = {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
};

export function isTextEntryTarget(target: EditableTargetLike | null | undefined): boolean {
  if (!target) return false;
  const tagName = (target.tagName ?? '').toUpperCase();
  return target.isContentEditable === true ||
    tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' ||
    target.getAttribute?.('role') === 'textbox';
}
