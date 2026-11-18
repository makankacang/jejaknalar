/** Physical tabletop/world detail for module-linked quest objects.
 *  Visual only: uses existing object coordinates and never creates a new hitbox.
 *  Spatial anchor and collision are still owned by world.ts.
 */
import type Phaser from 'phaser';
import { TILE, type ArtObject, type Target } from './world';
import { closeupTypeForKind } from './learning-object-presentation';

export function paintLearningObjectProp(scene: Phaser.Scene, object: ArtObject, target: Target) {
  if (target.kind !== 'task' || target.objectId !== object.id) return;
  const type = closeupTypeForKind(object.kind);
  if (!type) return;
  const x = (object.x + object.w / 2) * TILE;
  const y = (object.y + object.h / 2) * TILE;
  const g = scene.add.graphics().setPosition(x, y);
  // Keep prop above its desk/board, but below players standing in front.
  g.setDepth((object.y + object.h) * TILE + 5);
  const fill = (color: number, x0: number, y0: number, w: number, h: number) => {
    g.fillStyle(color, 1).fillRoundedRect(x0, y0, w, h, 2);
  };
  const stroke = (color: number, x0: number, y0: number, w: number, h: number) => {
    g.lineStyle(2, color, 1).strokeRoundedRect(x0, y0, w, h, 2);
  };
  if (type === 'book') {
    // Open readable paper, hardback cover, spine and bookmark — not a yellow hotspot.
    fill(0x62423b, -29, -19, 58, 38);
    fill(0xf1dcb0, -25, -16, 24, 32);
    fill(0xffefca, 1, -16, 24, 32);
    fill(0x8e6550, -1, -16, 2, 32);
    g.lineStyle(1, 0xa89778, .8);
    for (let row = -10; row <= 8; row += 6) {
      g.lineBetween(-20, row, -5, row);
      g.lineBetween(5, row, 20, row);
    }
    fill(0xd6a450, 19, -16, 4, 23);
    stroke(0x513b32, -29, -19, 58, 38);
  } else if (type === 'folder' || type === 'letter') {
    fill(0x9f7344, -30, -17, 60, 34);
    fill(0xe6bc75, -25, -21, 22, 8);
    fill(0xffefce, -21, -14, 43, 27);
    g.lineStyle(2, 0x867568, 1);
    for (let i = -7; i <= 7; i += 7) g.lineBetween(-14, i, 16, i);
    fill(0xd3a656, -28, 10, 56, 8);
    stroke(0x694b34, -30, -17, 60, 34);
  } else if (type === 'board' || type === 'poster') {
    // Existing board geometry is preserved; make source pins visually prominent.
    fill(0xd8c49c, -28, -23, 56, 44);
    stroke(0x71543b, -30, -25, 60, 48);
    for (let col = 0; col < 2; col++) for (let row = 0; row < 2; row++) {
      const xx = -21 + 23 * col, yy = -16 + 18 * row;
      fill([0xf6edd4, 0xd7e5dc, 0xe8d8be, 0xfff2cf][row * 2 + col], xx, yy, 19, 16);
      g.fillStyle(0xad5b4b, 1).fillCircle(xx + 9, yy + 1, 2);
    }
  } else if (type === 'screen') {
    fill(0x283942, -30, -23, 60, 43);
    fill(0x6db2c4, -25, -18, 50, 32);
    fill(0xadd9ce, -20, -11, 22, 3);
    fill(0xf4db98, -20, -4, 38, 3);
    fill(0x86d6bf, -20, 3, 30, 3);
    fill(0x5a6670, -6, 20, 12, 9);
  } else if (type === 'panel' || type === 'instrument') {
    fill(0x51636d, -29, -20, 58, 39);
    stroke(0xc5d4d0, -29, -20, 58, 39);
    fill(0x8abcc0, -20, -13, 27, 13);
    g.fillStyle(0xf5ce69).fillCircle(17, -8, 5);
    g.fillStyle(0x9bd0b4).fillCircle(17, 6, 4);
  }
  return g;
}
