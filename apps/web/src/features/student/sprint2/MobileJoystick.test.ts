import { describe, expect, it } from 'vitest';
import { normalizeStick } from './MobileJoystick';

describe('mobile analog joystick', () => {
  it('stays idle inside dead zone', () => {
    expect(normalizeStick(0, 0, 40)).toEqual({x:0,y:0});
    expect(normalizeStick(2, 2, 40)).toEqual({x:0,y:0});
  });
  it('supports diagonal movement and clamps to unit disc', () => {
    const axis = normalizeStick(500, 500, 40);
    expect(Math.hypot(axis.x, axis.y)).toBeCloseTo(1);
    expect(axis.x).toBeCloseTo(axis.y);
    const gentle = normalizeStick(12, 0, 40);
    expect(gentle.x).toBeCloseTo(.3);
  });
  it('ignores invalid pointer geometry', () => {
    expect(normalizeStick(Number.NaN, 3, 40)).toEqual({x:0,y:0});
    expect(normalizeStick(3, 2, 0)).toEqual({x:0,y:0});
  });
});
