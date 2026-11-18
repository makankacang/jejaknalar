import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { NPC_GENDER } from './character-looks';
import { paintPerson, facePerson } from './character-renderer';
import type { Heading } from './world';
// Record the geometry produced by the actual renderer without requiring WebGL.
function shape(x: number, y: number, width: number, height: number) {
  return { x, y, width, height, visible: true,
    setVisible(value: boolean) { this.visible = value; return this; },
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
    setX(x: number) { this.x = x; return this; },
    setDepth() { return this; }, setFillStyle() { return this; }, setStrokeStyle() { return this; },
  };
}
const scene = { add: { rectangle: shape, ellipse: shape, container: () => ({ setDepth() { return this; } }) } } as unknown as Phaser.Scene;
describe('all NPC faces use readable paired eyes', () => {
  for (const name of Object.keys(NPC_GENDER)) {
    it(`${name}: front/side eyes stay separated; back hides face and glasses`, () => {
      const p = paintPerson(scene, 0, 0, 0, name, name);
      // Repeat after the back pose to catch stale visibility during a turn.
      for (const direction of ['down','left','right','up','left','down'] as Heading[]) {
        facePerson(p, direction);
        expect(p.eyeLeft.visible).toBe(direction !== 'up');
        expect(p.eyeRight.visible).toBe(direction !== 'up');
        expect(p.backOfHead.visible).toBe(direction === 'up');
        expect(Math.abs(p.eyeRight.x - p.eyeLeft.x)).toBeGreaterThan(p.eyeLeft.width);
        for (const glasses of p.glasses) expect(glasses.visible).toBe(direction !== 'up');
      }
    });
  }
});
