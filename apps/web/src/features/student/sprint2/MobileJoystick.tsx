import { useRef, type PointerEvent, type KeyboardEvent } from 'react';
import type { Point } from '../../../game/sprint2/world';

/** Analog thumbstick, clamped to the unit disc; no teleport or collision bypass. */
export function normalizeStick(dx: number, dy: number, radius: number): Point {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || radius <= 0) return {x:0,y:0};
  const length = Math.hypot(dx,dy);
  if (length <= radius * .12) return {x:0,y:0};
  const distance = Math.min(1, length / radius);
  return {x:dx/length*distance,y:dy/length*distance};
}

export function MobileJoystick({onMove}: {onMove:(direction:Point)=>void}) {
  const pointer = useRef<number|null>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const set = (axis:Point) => {
    onMove(axis);
    if (knob.current) knob.current.style.transform = `translate(${axis.x * 33}px, ${axis.y * 33}px)`;
  };
  const track = (e:PointerEvent<HTMLDivElement>) => {
    const bounds=e.currentTarget.getBoundingClientRect();
    set(normalizeStick(e.clientX - (bounds.left + bounds.width/2), e.clientY - (bounds.top + bounds.height/2), Math.min(bounds.width,bounds.height)*.36));
  };
  const release = (e:PointerEvent<HTMLDivElement>) => {
    if (pointer.current!==e.pointerId) return;
    pointer.current=null; set({x:0,y:0});
  };
  const keys:Record<string,Point>={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  const onKey=(e:KeyboardEvent<HTMLDivElement>)=>{const axis=keys[e.key];if(axis){e.preventDefault();set(axis);}};
  return <div className="vn-mobile-joystick" role="group" tabIndex={0} aria-label="Joystick analog gerak. Geser untuk berjalan. Bisa juga memakai tombol panah keyboard."
    onPointerDown={e=>{e.preventDefault();pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);track(e);}}
    onPointerMove={e=>{if(pointer.current===e.pointerId){e.preventDefault();track(e);}}}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onKeyDown={onKey} onKeyUp={e=>{if(keys[e.key]){e.preventDefault();set({x:0,y:0});}}}>
    <span className="vn-joystick-ring" aria-hidden="true"/><span ref={knob} className="vn-joystick-knob" aria-hidden="true"/>
  </div>;
}
