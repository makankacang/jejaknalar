import Phaser from 'phaser';
import { NPC_GENDER } from './character-looks';
import { paintPerson, facePerson } from './character-renderer';
import type { Heading } from './world';
class Gallery extends Phaser.Scene {
  create() {
    const headings: Heading[] = ['down', 'left', 'right', 'up'];
    Object.entries(NPC_GENDER).forEach(([name, gender], index) => {
      const x = 20 + index % 3 * 365, y = 10 + Math.floor(index / 3) * 205;
      this.add.rectangle(x + 173, y + 95, 350, 190, 0x23434a).setOrigin(.5);
      this.add.text(x + 12, y + 12, name + ' · ' + (gender === 'male' ? 'Laki-laki' : 'Perempuan'), { fontFamily: 'Arial', fontSize: '17px', color: '#fff1c5' }).setDepth(2000);
      headings.forEach((heading, column) => {
        const p = paintPerson(this, x + 45 + column * 83, y + 158, 0, name, name);
        p.container.setScale(1.7).setDepth(1000);
        facePerson(p, heading);
        this.add.text(x + 45 + column * 83, y + 173, ['Depan','Kiri','Kanan','Belakang'][column], { fontFamily: 'Arial', fontSize: '12px', color: '#c8d9d5' }).setOrigin(.5).setDepth(2000);
      });
    });
  }
}
new Phaser.Game({ type: Phaser.CANVAS, parent: 'gallery', width: 1100, height: 1030, backgroundColor: '#142d34', pixelArt: true, roundPixels: true, scene: Gallery, banner: false });
