import type Phaser from 'phaser';
import { characterLook } from './character-looks';
import type { Heading } from './world';
export type Person = { container: Phaser.GameObjects.Container; left: Phaser.GameObjects.Rectangle; right: Phaser.GameObjects.Rectangle; eyeLeft: Phaser.GameObjects.Rectangle; eyeRight: Phaser.GameObjects.Rectangle; head: Phaser.GameObjects.Rectangle; backOfHead: Phaser.GameObjects.Rectangle; glasses: Phaser.GameObjects.Rectangle[] };
/** Shared by gameplay and the visual inspection gallery. */
export function paintPerson(scene: Phaser.Scene, x: number, y: number, color: number, identity = 'pemain', name = 'Pemain', role = ''): Person {
    const look = characterLook(identity, name, role, color);
    const shadow = scene.add.ellipse(0, 0, 23, 8, 0x101d29, .31);
    const shoes = scene.add.rectangle(0, -3, 23, 6, look.shoe);
    const left = scene.add.rectangle(-6, -7, 6, 12, look.shoe);
    const right = scene.add.rectangle(6, -7, 6, 12, look.shoe);
    // Build a distinct, persistent outfit and hair silhouette for each named NPC.
    const body = scene.add.rectangle(0, -18, look.tunic ? 23 : 20, 22, look.shirt);
    const lowerCoat = scene.add.rectangle(0, -11, look.tunic ? 25 : 20, 8, look.shirt);
    const seam = scene.add.rectangle(0, -18, 2, 16, look.trim);
    const armLeft = scene.add.rectangle(-13, -18, 5, 17, look.shirt);
    const armRight = scene.add.rectangle(13, -18, 5, 17, look.shirt);
    const cuffLeft = scene.add.rectangle(-13, -11, 5, 3, look.trim);
    const cuffRight = scene.add.rectangle(13, -11, 5, 3, look.trim);
    const neck = scene.add.rectangle(0, -29, 9, 7, look.skin);
    const backHair = scene.add.rectangle(0, look.longHair ? -34 : -42, look.longHair ? 24 : 20, look.longHair ? 28 : 14, look.hair);
    const head = scene.add.rectangle(0, -36, 18, 18, look.skin);
    const leftLock = scene.add.rectangle(-10, look.hairStyle==='long'?-30:-41, 4, look.hairStyle==='long'?30:10, look.hair);
    const rightLock = scene.add.rectangle(10, look.hairStyle==='long'?-30:-41, 4, look.hairStyle==='long'?30:10, look.hair);
    const fringe = scene.add.rectangle(0, -46, 21, look.hairStyle==='spiky'?6:9, look.hair);
    const hairAccent = scene.add.rectangle(look.accentSide * 7, -45, 4, 4, look.accent);
    const eyeLeft = scene.add.rectangle(-4, -36, 3, 3, 0x28313b);
    const eyeRight = scene.add.rectangle(4, -36, 3, 3, 0x28313b);
    const bag = scene.add.rectangle(look.accentSide * 15, -18, 5, 13, look.accent);
    const backOfHead = scene.add.rectangle(0, -36, 18, 19, look.hair).setVisible(false);
    const glasses: Phaser.GameObjects.Rectangle[] = [];
    const clothes = [shadow, shoes, left, right, body, lowerCoat, seam, armLeft, armRight,
      cuffLeft, cuffRight, bag, neck, backHair, head, leftLock, rightLock, fringe, hairAccent, eyeLeft, eyeRight];
    if (look.hairStyle==='ponytail') {
      clothes.splice(clothes.indexOf(head),0,
        scene.add.rectangle(look.accentSide*13,-32,9,25,look.hair),
        scene.add.rectangle(look.accentSide*13,-47,10,7,look.accent));
    }
    if (look.hairStyle==='spiky') {
      clothes.push(scene.add.rectangle(-7,-52,6,7,look.hair));
      clothes.push(scene.add.rectangle(5,-53,7,7,look.hair));
    }
    if (look.glasses) {
      glasses.push(scene.add.rectangle(-4,-36,7,6).setFillStyle(0,0).setStrokeStyle(1,0x34484c));
      glasses.push(scene.add.rectangle(4,-36,7,6).setFillStyle(0,0).setStrokeStyle(1,0x34484c));
      glasses.push(scene.add.rectangle(0,-36,2,1,0x34484c));
      clothes.push(...glasses);
    }
    if (look.hat) {
      clothes.push(scene.add.rectangle(0, -49, 22, 7, look.hair));
      clothes.push(scene.add.rectangle(0, -53, 16, 7, look.accent));
    }
    clothes.push(backOfHead);
    const container = scene.add.container(x, y, clothes).setDepth(y + 4);
    return { container, left, right, eyeLeft, eyeRight, head, backOfHead, glasses };
  }

/** Side poses use a three-quarter face, never one eye on a frontal head. */
export function facePerson(person: Person, heading: Heading) {
  const visible = heading !== 'up';
  const offset = heading === 'left' ? -2 : heading === 'right' ? 2 : 0;
  person.eyeLeft.setVisible(visible).setPosition(-4 + offset, -36);
  person.eyeRight.setVisible(visible).setPosition(4 + offset, -36);
  person.backOfHead.setVisible(!visible);
  person.glasses.forEach((part, index) => part.setVisible(visible).setX((index === 0 ? -4 : index === 1 ? 4 : 0) + offset));
}
