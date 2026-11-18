import { describe, expect, it } from 'vitest';
import {
  getProximity,
  INTERACTION_RADIUS,
  isWithinInteractionRange,
  nearestInteractableTarget,
  sameProximity,
  TARGET_POINTS,
} from './proximity';

describe('Sprint 1: interaksi harus berdasarkan jarak pemain', () => {
  it('semua target tidak dapat diakses dari titik mulai', () => {
    const start = getProximity({ x: 395, y: 292 });
    expect(start).toEqual({ npc: false, document: false, challenge: false });
    expect(nearestInteractableTarget({ x: 395, y: 292 })).toBeNull();
  });
  it('berada tepat di radius diperbolehkan; di luar radius ditolak', () => {
    const npc = TARGET_POINTS.npc;
    expect(isWithinInteractionRange({ x: npc.x + INTERACTION_RADIUS, y: npc.y }, 'npc')).toBe(true);
    expect(isWithinInteractionRange({ x: npc.x + INTERACTION_RADIUS + 1, y: npc.y }, 'npc')).toBe(false);
  });
  it('dekat Bu Rani tidak bisa berbicara dengan dokumen jauh', () => {
    const besideNpc = { x: 165, y: 205 };
    expect(getProximity(besideNpc)).toEqual({ npc: true, document: false, challenge: false });
    expect(nearestInteractableTarget(besideNpc)).toBe('npc');
  });
  it('dokumen dan tantangan punya jangkauan sendiri', () => {
    expect(isWithinInteractionRange({ x: 610, y: 170 }, 'document')).toBe(true);
    expect(isWithinInteractionRange({ x: 610, y: 170 }, 'npc')).toBe(false);
    expect(isWithinInteractionRange({ x: 615, y: 330 }, 'challenge')).toBe(true);
  });
  it('tombol E memilih yang paling dekat jika dua hotspot bertumpang tindih', () => {
    expect(nearestInteractableTarget({ x: 610, y: 218 })).toBe('document');
    expect(nearestInteractableTarget({ x: 614, y: 290 })).toBe('challenge');
  });
  it('pembanding hanya mendeteksi perubahan target dekat/jauh', () => {
    const far = getProximity({ x: 395, y: 292 });
    expect(sameProximity(far, getProximity({ x: 395, y: 292 }))).toBe(true);
    expect(sameProximity(far, getProximity({ x: 160, y: 175 }))).toBe(false);
  });
});
