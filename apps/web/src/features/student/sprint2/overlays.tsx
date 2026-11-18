import { useEffect, useRef, type ReactNode } from 'react';
import { locationName, type Room } from '../../../game/sprint2/world';
export function Dialog({ title, close, children, dialogue = false }: { title: string; close: () => void; children: ReactNode; dialogue?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { const last = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLElement>('button, input')?.focus(); return () => last?.focus(); }, []);
  return <div className={"vn-backdrop " + (dialogue ? "vn-npc-dialogue" : "")}><section className="vn-dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} onKeyDown={e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') ?? []); const first = controls[0], last = controls[controls.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}><header><h2>{title}</h2><button onClick={close} aria-label="Tutup">✕</button></header>{children}</section></div>;
}

export function LocationBadge({room}:{room:Room}) { return <div className="vn-location" aria-live="polite">⌖ {locationName(room)}</div>; }
