import Phaser from 'phaser';

export interface SceneActions {
  onNpc: () => void;
  onDocument: () => void;
  onChallenge: () => void;
}

/** Satu map kecil berbasis primitive vectors: ringan, tidak membutuhkan asset eksternal. */
export class EvidenceHuntScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private destination?: Phaser.Math.Vector2;
  constructor(private readonly actions: SceneActions) { super({ key: 'EvidenceHuntScene' }); }

  create(): void {
    const W = 800, H = 420;
    this.cameras.main.setBackgroundColor('#f0ebd9');
    this.add.rectangle(W / 2, H / 2, W - 32, H - 28, 0xe7dec4).setStrokeStyle(5, 0x755c49);
    this.add.text(W / 2, 26, 'PERPUSTAKAAN SEKOLAH', {
      fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#34324a'
    }).setOrigin(0.5);
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(285 + i * 49, 96, 35, 90, 0xb99972).setStrokeStyle(3, 0x7c624a);
      for (let j = 0; j < 3; j++) this.add.rectangle(274 + i * 49 + j * 10, 94, 7, 56, [0x5f8496,0x9981ab,0x8da97c][j]);
    }
    this.makeHotspot(160, 175, 0x72869b, 'BU RANI', this.actions.onNpc);
    this.makeHotspot(610, 170, 0x7d9f78, 'DOKUMEN', this.actions.onDocument);
    this.makeHotspot(615, 330, 0xc5a35e, 'TANTANGAN', this.actions.onChallenge);
    this.add.rectangle(95, 320, 150, 64, 0xc4b49b).setStrokeStyle(2, 0x7a6850);
    this.add.text(95, 322, 'MEJA BACA', { fontFamily: 'Arial', fontSize: '14px',color:'#413d43' }).setOrigin(0.5);
    this.player = this.add.rectangle(395, 292, 29, 38, 0x544b90).setStrokeStyle(3, 0xffffff);
    this.add.text(395, 262, 'KAMU', { fontFamily: 'Arial', fontSize: '12px', color: '#252638', backgroundColor:'#ffffff' }).setOrigin(0.5);
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.destination = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    });
  }

  private makeHotspot(x: number, y: number, color: number, label: string, run: () => void): void {
    const hit = this.add.rectangle(x, y, 116, 70, color).setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '14px', color:'#ffffff', fontStyle:'bold' }).setOrigin(0.5);
    hit.on('pointerdown', run);
  }

  update(_time: number, delta: number): void {
    if (!this.player) return;
    const down = (key: string) => !!this.keys?.[key]?.isDown;
    let x = Number(down('D') || down('RIGHT')) - Number(down('A') || down('LEFT'));
    let y = Number(down('S') || down('DOWN')) - Number(down('W') || down('UP'));
    if (x || y) this.destination = undefined;
    if (!x && !y && this.destination) {
      const dx = this.destination.x - this.player.x;
      const dy = this.destination.y - this.player.y;
      if (Math.hypot(dx, dy) < 5) this.destination = undefined;
      else { x = dx; y = dy; }
    }
    const magnitude = Math.hypot(x,y);
    if (!magnitude) return;
    const travel = Math.min(210 * delta / 1000, 30);
    this.player.setPosition(
      Phaser.Math.Clamp(this.player.x + travel * x / magnitude, 40, 755),
      Phaser.Math.Clamp(this.player.y + travel * y / magnitude, 70, 378)
    );
  }
}
