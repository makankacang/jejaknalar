import type { Heading } from './world';
export type Motion = { heading: Heading; phase: number; mode: 'idle' | 'walk' | 'run'; left: number; right: number };
export const idleMotion = (): Motion => ({ heading: 'down', phase: 0, mode: 'idle', left: 0, right: 0 });
/** Distance clock: pushing against a wall NEVER advances the feet. Sprint covers stride faster. */
export function animate(previous: Motion, dx: number, dy: number, running: boolean, locked = false): Motion {
 const distance = Math.hypot(dx, dy);
 if (locked || distance < .01) return { ...previous, mode: 'idle', left: 0, right: 0 };
 const heading: Heading = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
 const phase = (previous.phase + distance / (running ? 10 : 11)) % (Math.PI * 2), stride = Math.sin(phase) * (running ? 7 : 5);
 return { heading, phase, mode: running ? 'run' : 'walk', left: stride, right: -stride };
}
