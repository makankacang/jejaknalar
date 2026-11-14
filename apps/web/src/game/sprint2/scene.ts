import Phaser from 'phaser';
import { ROOMS, blocked, canInteract, move, findPath, approach, type Heading, type Point, type Target } from './world';
import { paintObject, paintFloor } from './art';
import { animate, idleMotion, type Motion } from './animation';
import { movementDelta, FEET } from './world';
import type { State } from './state';
export type SceneHooks = { snapshot: () => State; active: () => boolean; direction: () => Point; position: (p: Point, h: Heading) => void; interact: (t: Target) => void; nearby: (t: Target | null) => void; message: (s: string) => void; reduced: () => boolean; running: () => boolean; debug: () => boolean };
type Person = { container: Phaser.GameObjects.Container; left: Phaser.GameObjects.Rectangle; right: Phaser.GameObjects.Rectangle; eyes: Phaser.GameObjects.Rectangle; head: Phaser.GameObjects.Rectangle };
export class AdventureScene extends Phaser.Scene {
  private person!: Person;
  private npc!: Person;
  private roomId = '';
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private path: Point[] = [];
  private pending: Target | null = null;
  private heading: Heading = 'down';
  private nearId = '';
  private saveAt = 0;
  private walking = false;
  private motion: Motion = idleMotion();
  private debugLayer!: Phaser.GameObjects.Graphics;
  private textureKeys: string[] = [];
  private doorReadyAt = 0;
  private prompt!: Phaser.GameObjects.Text;
  private labels: { target: Target; text: Phaser.GameObjects.Text }[] = [];
  constructor(private hooks: SceneHooks) { super('D-sprint2'); }
  create() {
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.loadRoom();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.hooks.active()) return;
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y), room = ROOMS[this.roomId];
      const target = room.targets.find(t => Math.hypot((t.display?.x ?? t.x) - p.x, (t.display?.y ?? t.y) - p.y) < 45 || Math.hypot(t.x - p.x, t.y - p.y) < 24);
      if (target) { if (canInteract(room, this.person.container, target)) { if (target.kind === 'door') this.hooks.message('Tekan E untuk melewati pintu.'); else this.activate(target); } else { this.path = approach(room, this.person.container, target); this.pending = target.kind === 'door' ? null : target; if (!this.path.length) this.hooks.message('Objek tidak dapat dijangkau dari sini.'); } }
      else { this.pending = null; this.path = findPath(room, this.person.container, p); if (!this.path.length) this.hooks.message('Tujuan terhalang. Pilih lantai yang terbuka.'); }
    });
    this.scale.on('resize', this.camera, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.camera, this));
  }
  private camera() { if (!this.person) return; const room = ROOMS[this.roomId]; this.cameras.main.setBounds(0, 0, room.width, room.height).setZoom(this.scale.width < 600 ? 1.1 : 1.25).startFollow(this.person.container, true, 0.15, 0.15); this.cameras.main.roundPixels = true; }
  /** Safe to call when the browser changes from desktop to 390×844 without reload. */
  reframe() { if (!this.person || !this.cameras?.main) return; this.cameras.main.setSize(this.scale.width, this.scale.height); this.camera(); }
  private paintPerson(x: number, y: number, color: number): Person {
    const shadow = this.add.ellipse(0, 0, 23, 9, 0x101d29, .3);
    const left = this.add.rectangle(-5, -5, 6, 10, 0x283344), right = this.add.rectangle(5, -5, 6, 10, 0x283344);
    const torso = this.add.rectangle(0, -18, 20, 20, color), head = this.add.rectangle(0, -35, 18, 17, 0xf1bd8b), hair = this.add.rectangle(0, -45, 20, 7, 0x392c32), eyes = this.add.rectangle(5, -35, 3, 3, 0x273040);
    return { container: this.add.container(x, y, [shadow, left, right, torso, head, hair, eyes]).setDepth(y), left, right, eyes, head };
  }
  private face(person: Person, heading: Heading) { person.eyes.setVisible(heading !== 'up'); person.eyes.setPosition(heading === 'left' ? -6 : heading === 'right' ? 6 : 3, -35); }
  private loadRoom() {
    this.children.removeAll(true); for (const key of this.textureKeys) this.textures.remove(key); this.textureKeys = [];
    this.labels = []; this.path = []; this.pending = null; this.nearId = ''; this.hooks.nearby(null); this.motion = idleMotion();
    const s = this.hooks.snapshot(), room = ROOMS[s.room]; this.roomId = s.room; this.heading = s.heading;
    const floorKey = `s2:${room.id}:floor`, floor = this.textures.createCanvas(floorKey, room.width, room.height)!; this.textureKeys.push(floorKey);
    paintFloor(floor.context, room); floor.refresh(); this.add.image(0, 0, floorKey).setOrigin(0).setDepth(-20);
    for (const obj of room.objects) {
      const margin = 140, key = `s2:${obj.id}`, texture = this.textures.createCanvas(key, Math.ceil(obj.w * 40 + margin * 2), Math.ceil(obj.h * 40 + margin * 2))!; this.textureKeys.push(key);
      texture.context.translate(margin - obj.x * 40, margin - obj.y * 40); paintObject(texture.context, obj); texture.refresh();
      // Each prop is independent: real y-sort/occlusion, never a flat map screenshot.
      const depth = ['court', 'gate', 'building_sign', 'window', 'poster', 'clock', 'stage_curtain', 'whiteboard', 'screen_board'].includes(obj.kind) ? 1 : (obj.y + obj.h) * 40;
      this.add.image(obj.x * 40 - margin, obj.y * 40 - margin, key).setOrigin(0).setDepth(depth);
    }
    if (room.world === 'city') for (const o of room.solids) { this.add.rectangle(o.x, o.y - o.heightArt, o.width, o.height + o.heightArt, o.kind === 'plant' ? 0x497b4d : 0xad8657).setOrigin(0).setStrokeStyle(2, 0x4c493b).setDepth(o.y + o.height); }
    for (const t of room.targets) {
      if (t.kind === 'npc') this.npc = this.paintPerson(t.x, t.y, Number(t.color?.replace('#', '0x')) || 0xb78275);
      if (t.kind === 'door') {
        const pos = t.display ?? t, top = pos.y - 56, x = pos.x - 34;
        // Door has visible frame, shadowed recess, inset glass, two wood panels, hinges and knob.
        // Visual is anchored to the SAME portal opening/trigger as world.ts; never grants transit on its own.
        const g = this.add.graphics().setDepth(Math.max(4, pos.y - 47));
        const palette = t.to?.includes('laboratory') ? [0x6a8067,0x8daf84] : t.to?.includes('knowledge') ? [0x4b6c80,0x79a6b5] : t.to?.includes('library') ? [0x754a35,0xba8655] : [0x754a3f,0xa77556];
        g.fillStyle(0x1a292a,0.38).fillRoundedRect(x-7,top+8,83,81,3);
        g.fillStyle(0xd0b68b).fillRoundedRect(x-7,top-6,82,87,3);
        g.fillStyle(0x69513e).fillRoundedRect(x-3,top-2,74,79,2);
        g.fillStyle(0x182c31).fillRect(x+3,top+4,62,68);
        g.fillStyle(palette[0]).fillRoundedRect(x+5,top+3,57,68,2);
        g.fillStyle(palette[1]).fillRect(x+10,top+8,47,58);
        // Upper glazed inset, lower recessed panel and dividers; side-lit for depth.
        g.fillStyle(0x493d39).fillRoundedRect(x+15,top+12,37,24,2);
        g.fillStyle(0x78aebd).fillRect(x+19,top+16,29,16);
        g.fillStyle(0xc9e7e6,0.75).fillRect(x+21,top+17,4,13);
        g.lineStyle(2,0xd1bc94).strokeRect(x+16,top+13,35,22);
        g.fillStyle(palette[0]).fillRoundedRect(x+15,top+43,37,19,2);
        g.lineStyle(2,0xdfbe8c).strokeRoundedRect(x+17,top+45,33,15,2);
        g.fillStyle(0xecc889).fillCircle(x+53,top+41,3.7);
        g.fillStyle(0x3a4647).fillCircle(x+53,top+41,1.5);
        g.fillStyle(0xddcfa8).fillRect(x-8,top+73,84,7); // raised threshold
        const label = this.add.text(pos.x, top-19, t.label, { fontFamily:'monospace', fontSize:'12px', color:'#fff2d6', backgroundColor:'#203942', padding:{x:7,y:4}}).setOrigin(.5).setDepth(Math.max(5,pos.y-45));
        label.setAlpha(.94);
      }
      if (t.kind === 'task') { this.add.text(t.x, t.y - 10, '◆', { fontSize: '20px', color: '#f4d588', stroke: '#253b3c', strokeThickness: 4 }).setOrigin(.5).setDepth(5000); }
      if (t.kind === 'npc' || t.kind === 'task') { const text = this.add.text(t.x, t.y - (t.kind === 'npc' ? 61 : 35), t.label, { fontFamily: 'monospace', fontSize: '12px', color: '#fff0cb', backgroundColor: '#243a42', padding: { x: 6, y: 4 } }).setOrigin(.5).setDepth(5100); text.setVisible(false); this.labels.push({ target: t, text }); }
    }
    this.person = this.paintPerson(s.position.x, s.position.y, 0xd6a75b); this.face(this.person, s.heading);
    this.prompt = this.add.text(0, 0, 'E · Interaksi', { fontSize: '12px', backgroundColor: '#f4dc98', color: '#253644', padding: { x: 6, y: 4 } }).setOrigin(.5).setDepth(5200).setVisible(false);
    this.debugLayer = this.add.graphics().setDepth(5300); this.camera();
  }
  private debug() {
    const g = this.debugLayer; g.clear(); if (!this.hooks.debug()) return;
    const r = ROOMS[this.roomId]; g.lineStyle(2, 0xef5661); for (const box of [...r.solids, ...r.walls]) g.strokeRect(box.x, box.y, box.width, box.height);
    for (const t of r.targets) if (t.portal) { const p = t.portal; g.lineStyle(3, 0x6ed79d).strokeRect(p.opening.x,p.opening.y,p.opening.width,p.opening.height);g.lineStyle(2,0xf3ce68).strokeRect(p.trigger.x,p.trigger.y,p.trigger.width,p.trigger.height);g.fillStyle(0x51caf0).fillCircle(p.approach.x,p.approach.y,5); }
    g.lineStyle(2,0xffffff).strokeRect(this.person.container.x-FEET,this.person.container.y-FEET,FEET*2,FEET*2);
  }
  private activate(t: Target) {
    if (!canInteract(ROOMS[this.roomId], this.person.container, t)) return;
    if (t.kind === 'door') { if (this.time.now < this.doorReadyAt) return; this.doorReadyAt = this.time.now + 500; }
    this.path = []; this.pending = null;
    this.hooks.position({ x: this.person.container.x, y: this.person.container.y }, this.heading);
    if (t.kind === 'npc') { const dx = this.person.container.x-t.x, dy = this.person.container.y-t.y; this.face(this.npc, Math.abs(dx)>Math.abs(dy) ? dx<0?'left':'right' : dy<0?'up':'down'); }
    this.hooks.interact(t);
  }
  readPose() { return this.person ? { x:this.person.container.x,y:this.person.container.y,heading:this.heading,motion:{...this.motion},room:this.roomId } : null; }
  interactNearest() { const t = ROOMS[this.roomId]?.targets.filter(t => canInteract(ROOMS[this.roomId], this.person.container, t)).sort((a, b) => Phaser.Math.Distance.BetweenPoints(a, this.person.container) - Phaser.Math.Distance.BetweenPoints(b, this.person.container))[0]; if (t && this.hooks.active()) this.activate(t); }
  update(time: number, dt: number) {
    if (!this.person) return;
    if (this.hooks.snapshot().room !== this.roomId) this.loadRoom();
    const editing = document.activeElement instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName), active = this.hooks.active();
    if (this.input.keyboard) { if (!active && this.input.keyboard.enabled) this.input.keyboard.resetKeys(); this.input.keyboard.enabled = active && !editing; }
    if (!active) { this.path = []; this.pending = null; this.prompt.setVisible(false); this.motion = animate(this.motion,0,0,false,true); this.person.left.y=-5; this.person.right.y=-5; this.debug(); return; }
    const down = (k: string) => active && !editing && !!this.keys?.[k]?.isDown, joy = this.hooks.direction();
    let dx = Number(down('D') || down('RIGHT')) - Number(down('A') || down('LEFT')) + joy.x, dy = Number(down('S') || down('DOWN')) - Number(down('W') || down('UP')) + joy.y;
    if (dx || dy) { this.path = []; this.pending = null; }
    const p = this.person.container;
    if (!dx && !dy && this.path.length) { const to = this.path[0]; dx = to.x - p.x; dy = to.y - p.y; if (Math.hypot(dx, dy) < 1) { this.path.shift(); dx = dy = 0; } }
    const length = Math.hypot(dx, dy), room = ROOMS[this.roomId];
    const running = down('SHIFT') || this.hooks.running();
    const before = { x: p.x, y: p.y };
    if (length) {
      const delta = movementDelta({ x: dx, y: dy }, dt, running), scale = this.path.length ? Math.min(1, length / Math.max(.001, Math.hypot(delta.x, delta.y))) : 1;
      const next = move(room, before, delta.x * scale, delta.y * scale); p.setPosition(next.x, next.y).setDepth(next.y);
    }
    this.motion = animate(this.motion, p.x-before.x, p.y-before.y, running);
    if (this.motion.mode !== 'idle') { this.heading=this.motion.heading; this.walking=true; }
    this.face(this.person,this.heading);
    // Readable alternating feet. Reduce motion preserves gait (essential movement feedback).
    this.person.left.y=-5+this.motion.left; this.person.right.y=-5+this.motion.right;
    this.person.left.rotation=this.motion.left/30;this.person.right.rotation=this.motion.right/30;
    if (!this.hooks.reduced()) this.npc.head.y = -35 + Math.sin(time / 500) * .6;
    this.debug();
    if (this.walking && (time > this.saveAt || !length)) { this.hooks.position({ x: p.x, y: p.y }, this.heading); this.saveAt = time + 400; this.walking = !!length; }
    if (this.pending && !this.path.length) { const t = this.pending; this.pending = null; if (canInteract(room, p, t)) { this.activate(t); return; } }
    const nearest = room.targets.filter(t => canInteract(room, p, t)).sort((a, b) => Phaser.Math.Distance.BetweenPoints(a, p) - Phaser.Math.Distance.BetweenPoints(b, p))[0];
    if ((nearest?.id ?? '') !== this.nearId) { this.nearId = nearest?.id ?? ''; this.hooks.nearby(nearest ?? null); }
    // Single nearby hint above the target, not overlapping NPC head or feet.
    this.prompt.setText(nearest ? `E · ${nearest.label}` : 'E · Interaksi').setPosition(nearest?.x ?? p.x, (nearest?.y ?? p.y) - (nearest?.kind === 'npc' ? 87 : 48)).setVisible(!!nearest);
    for (const { text } of this.labels) text.setVisible(this.hooks.debug());
    if (down('E') && this.keys?.E && Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interactNearest();
    if (blocked(room, p)) { const spawn = room.spawn; p.setPosition(spawn.x, spawn.y); }
  }
}
