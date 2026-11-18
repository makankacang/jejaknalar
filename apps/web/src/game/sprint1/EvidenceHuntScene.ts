import Phaser from 'phaser';
import {
  getProximity,
  INTERACTION_RADIUS,
  INTERACTION_TARGETS,
  isWithinInteractionRange,
  nearestInteractableTarget,
  sameProximity,
  TARGET_POINTS,
  type InteractionTarget,
  type ProximityState,
} from './proximity';

export interface SceneActions {
  isExploring: () => boolean;
  onNpc: () => void;
  onDocument: () => void;
  onChallenge: () => void;
  /** Dipanggil saat status dekat/jauh berubah, bukan setiap frame. */
  onProximityChange: (nearby: ProximityState) => void;
  onOutOfRange: (target: InteractionTarget) => void;
}

/** Map MVP 800x420: interaksi hanya jika karakter berada dalam jangkauan hotspot. */
export class EvidenceHuntScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private playerLabel!: Phaser.GameObjects.Text;
  private rangeRing!: Phaser.GameObjects.Arc;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private destination?: Phaser.Math.Vector2;
  private lastNearby?: ProximityState;
  private hotspots: Partial<Record<InteractionTarget, Phaser.GameObjects.Rectangle>> = {};

  constructor(private readonly actions: SceneActions) {
    super({ key: 'EvidenceHuntScene' });
  }

  create(): void {
    const W = 800, H = 420;
    this.cameras.main.setBackgroundColor('#f0ebd9');
    this.add.rectangle(W / 2, H / 2, W - 32, H - 28, 0xe7dec4).setStrokeStyle(5, 0x755c49);
    this.add.text(W / 2, 26, 'PERPUSTAKAAN SEKOLAH', {
      fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#34324a',
    }).setOrigin(0.5);
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(285 + i * 49, 96, 35, 90, 0xb99972).setStrokeStyle(3, 0x7c624a);
      for (let j = 0; j < 3; j++) {
        this.add.rectangle(274 + i * 49 + j * 10, 94, 7, 56, [0x5f8496, 0x9981ab, 0x8da97c][j]);
      }
    }

    // Area interaksi terlihat jelas lewat garis hijau hanya saat dekat.
    this.makeHotspot('npc', 0x72869b, 'BU RANI');
    this.makeHotspot('document', 0x7d9f78, 'DOKUMEN');
    this.makeHotspot('challenge', 0xc5a35e, 'TANTANGAN');
    this.add.rectangle(95, 320, 150, 64, 0xc4b49b).setStrokeStyle(2, 0x7a6850);
    this.add.text(95, 322, 'MEJA BACA', {
      fontFamily: 'Arial', fontSize: '14px', color: '#413d43',
    }).setOrigin(0.5);

    this.rangeRing = this.add.circle(395, 292, INTERACTION_RADIUS, 0x4ba882, 0)
      .setStrokeStyle(2, 0x4ba882, 0.3);
    this.player = this.add.rectangle(395, 292, 29, 38, 0x544b90).setStrokeStyle(3, 0xffffff);
    this.playerLabel = this.add.text(395, 262, 'KAMU', {
      fontFamily: 'Arial', fontSize: '12px', color: '#252638', backgroundColor: '#ffffff',
    }).setOrigin(0.5);

    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.actions.isExploring()) this.destination = new Phaser.Math.Vector2(Phaser.Math.Clamp(pointer.worldX, 40, 755), Phaser.Math.Clamp(pointer.worldY, 70, 378));
    });
    this.updateNearby(true);
  }

  private makeHotspot(target: InteractionTarget, color: number, label: string): void {
    const point = TARGET_POINTS[target];
    const hit = this.add.rectangle(point.x, point.y, 116, 70, color)
      .setStrokeStyle(3, 0xb9b2a9).setInteractive({ useHandCursor: true });
    this.add.text(point.x, point.y, label, {
      fontFamily: 'Arial', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    hit.on('pointerdown', (...args: unknown[]) => {
      // Cegah klik hotspot dianggap perintah bergerak ke lokasi objek.
      const event = args[3] as { stopPropagation?: () => void } | undefined;
      event?.stopPropagation?.();
      this.tryInteract(target);
    });
    this.hotspots[target] = hit;
  }

  private tryInteract(target: InteractionTarget): void {
    if (!this.actions.isExploring()) return;
    this.destination = undefined;
    // Guard nyata berada di scene (koordinat pemain), bukan sekadar tombol HTML.
    if (!this.player || !isWithinInteractionRange(this.player, target)) {
      this.actions.onOutOfRange(target);
      return;
    }
    if (target === 'npc') this.actions.onNpc();
    if (target === 'document') this.actions.onDocument();
    if (target === 'challenge') this.actions.onChallenge();
  }

  private updateNearby(force = false): void {
    const nearby = getProximity(this.player);
    if (!force && this.lastNearby && sameProximity(nearby, this.lastNearby)) return;
    this.lastNearby = nearby;
    for (const target of INTERACTION_TARGETS) {
      this.hotspots[target]?.setStrokeStyle(nearby[target] ? 5 : 3,
        nearby[target] ? 0x3fb77a : 0xb9b2a9);
    }
    this.actions.onProximityChange(nearby);
  }

  update(_time: number, delta: number): void {
    if (!this.player) return;
    const focused = document.activeElement;
    const editing = focused instanceof HTMLElement && /INPUT|TEXTAREA|SELECT|BUTTON/.test(focused.tagName);
    if (this.input.keyboard) {
      const enabled = this.actions.isExploring() && !editing;
      if (!enabled && this.input.keyboard.enabled) this.input.keyboard.resetKeys();
      this.input.keyboard.enabled = enabled;
    }
    if (!this.actions.isExploring()) { this.destination = undefined; return; }
    const down = (key: string) => !editing && !!this.keys?.[key]?.isDown;
    let x = Number(down('D') || down('RIGHT')) - Number(down('A') || down('LEFT'));
    let y = Number(down('S') || down('DOWN')) - Number(down('W') || down('UP'));
    if (x || y) this.destination = undefined;
    if (!x && !y && this.destination) {
      const dx = this.destination.x - this.player.x;
      const dy = this.destination.y - this.player.y;
      if (Math.hypot(dx, dy) < 5) this.destination = undefined;
      else { x = dx; y = dy; }
    }
    const magnitude = Math.hypot(x, y);
    if (magnitude) {
      const travel = Math.min(210 * delta / 1000, 30, this.destination ? magnitude : Infinity);
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x + travel * x / magnitude, 40, 755),
        Phaser.Math.Clamp(this.player.y + travel * y / magnitude, 70, 378),
      );
      this.playerLabel.setPosition(this.player.x, this.player.y - 30);
      this.rangeRing.setPosition(this.player.x, this.player.y);
      this.updateNearby();
    }
    const interactionKey = this.keys?.['E'];
    if (!editing && interactionKey && Phaser.Input.Keyboard.JustDown(interactionKey)) {
      const closest = nearestInteractableTarget(this.player);
      if (closest) this.tryInteract(closest);
    }
  }
}
