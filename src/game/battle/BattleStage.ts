/**
 * A turn-based battle fought on a battle map (Legend of Dragoon / FFX style): the map is built in its own scene, the
 * party stands on its party markers with their backs to the camera, the enemies on theirs facing it, and the camera
 * waits behind the party. Attackers dash to their target, strike and run back; spells flare in their colour; the
 * fallen lie down or sink away. The battle screen's name tags, health bars and numbers follow the sprites on screen.
 *
 * The stage only shows things: the battle itself is run by TurnBattle, which talks to it through the battle screen.
 */
import * as THREE from 'three';
import type { BattleCamera, MapData } from '../../world/types';
import { CharacterSprite, type CarriedWeapon } from '../CharacterSprite';
import { FlatSprite } from '../FlatSprite';
import type { StageHooks } from '../../ui/BattleScreen';

/** Where a fighter stands and what it looks like. */
export interface StageFighterSpec {
  key: string;
  side: 'party' | 'enemy';
  sprite: CharacterSprite | FlatSprite;
  scale?: number;
  /** Weapon sprites held throughout the battle (animated sheets). */
  weapons?: CarriedWeapon[];
  /** The animation an attack plays (slash, thrust, shoot). */
  attackAnim?: string;
}

type Step =
  | { kind: 'move'; to: THREE.Vector3; dur: number; t: number; from?: THREE.Vector3; run?: boolean }
  | { kind: 'play'; anim: string; dur: number; t: number; started?: boolean }
  | { kind: 'wait'; dur: number; t: number };

interface Fighter {
  key: string;
  side: 'party' | 'enemy';
  sprite: CharacterSprite | FlatSprite;
  flat: FlatSprite | null;
  scale: number;
  /** Height and width of the sprite at scale 1 (tiles). */
  tall: number;
  wide: number;
  home: THREE.Vector3;
  /** Where it is now (before shakes and steps). */
  at: THREE.Vector3;
  attackAnim: string;
  steps: Step[];
  shake: number;
  /** Stepping forward as the one whose turn it is (0 … 1). */
  step: number;
  active: boolean;
  down: boolean;
  /** 0 standing … 1 gone (enemies sink away). */
  fade: number;
  fading: boolean;
  ring: THREE.Mesh;
  ringColor: string | null;
  lunge: number;
}

interface Burst { sprite: THREE.Sprite; t: number; dur: number; grow: number; rise: number }

const UP = new THREE.Vector3(0, 1, 0);

let glowTexture: THREE.Texture | null = null;
/** A soft round glow (spell flares, hit sparks). */
function glow(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.encoding = THREE.sRGBEncoding;
  return glowTexture;
}

const RING_GEOMETRY = new THREE.RingGeometry(0.34, 0.5, 40).rotateX(-Math.PI / 2);

export class BattleStage implements StageHooks {
  readonly scene = new THREE.Scene();
  readonly group = new THREE.Group();
  private readonly fighters = new Map<string, Fighter>();
  private readonly bursts: Burst[] = [];
  private readonly party: THREE.Vector3[] = [];
  private readonly enemies: THREE.Vector3[] = [];
  private readonly cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), basePos: new THREE.Vector3(), baseLook: new THREE.Vector3(), t: 0, intro: 1.4 };
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly settings: Required<BattleCamera>;
  private focusKey: string | null = null;
  private focusT = 0;
  private targets = new Set<string>();
  private elapsed = 0;
  /** Field of view the game's camera had before the battle. */
  savedFov = 0;

  /**
   * `stand(x, z)`: the ground height there. `data`: the battle map (its markers and camera).
   */
  constructor(readonly data: MapData, private readonly stand: (x: number, z: number) => number) {
    this.scene.add(this.group);
    const c = data.battleCamera ?? {};
    this.settings = { distance: c.distance ?? 6, height: c.height ?? 3.2, side: c.side ?? 0, fov: c.fov ?? 40 };
    const marks = (side: 'party' | 'enemy') => (data.markers ?? []).filter((m) => m.side === side).map((m) => new THREE.Vector3(m.x + 0.5, 0, m.z + 0.5));
    this.party.push(...marks('party'));
    this.enemies.push(...marks('enemy'));
  }

  /** Where the n-th fighter of a side stands: its marker, or a spot near the others when there are too few. */
  private spot(side: 'party' | 'enemy', i: number): THREE.Vector3 {
    const list = side === 'party' ? this.party : this.enemies;
    const cx = this.data.width / 2, cz = this.data.height / 2;
    let p: THREE.Vector3;
    if (!list.length) {
      // No markers: a row each side of the middle, the party nearer the bottom (the camera's side).
      const k = i % 4, row = Math.floor(i / 4), off = (k - 1.5) * 1.5 + (row % 2) * 0.75;
      p = new THREE.Vector3(cx + off, 0, side === 'party' ? cz + 2.5 + row : cz - 2 - row * 1.4);
    } else if (i < list.length) p = list[i].clone();
    else {
      // More fighters than markers: a step behind the markers, shifted a little.
      const m = list[i % list.length], row = Math.floor(i / list.length);
      p = m.clone().add(new THREE.Vector3(0.7 * (row % 2 ? -1 : 1), 0, (side === 'party' ? 1 : -1.2) * row));
    }
    p.y = this.stand(p.x, p.z);
    return p;
  }

  addFighters(list: StageFighterSpec[]): void {
    const counts = { party: 0, enemy: 0 };
    for (const s of list) {
      const i = counts[s.side]++;
      const home = this.spot(s.side, i);
      const mesh = s.sprite.mesh;
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      const ring = new THREE.Mesh(RING_GEOMETRY, new THREE.MeshBasicMaterial({ color: '#ffc46e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.renderOrder = 2;
      this.group.add(mesh, ring);
      const flat = s.sprite instanceof FlatSprite ? s.sprite : null;
      const f: Fighter = {
        key: s.key, side: s.side, sprite: s.sprite, flat, scale: s.scale ?? 1,
        tall: Math.max(0.4, bb.max.y - bb.min.y), wide: Math.max(0.3, bb.max.x - bb.min.x),
        home, at: home.clone(), attackAnim: s.attackAnim ?? 'slash', steps: [], shake: 0, step: 0, active: false, down: false,
        fade: 0, fading: false, ring, ringColor: null, lunge: 0,
      };
      if (s.weapons?.length && s.sprite instanceof CharacterSprite) s.sprite.setWeapons(s.weapons);
      this.fighters.set(s.key, f);
    }
    // Everyone faces the other side.
    const pc = this.centre('party'), ec = this.centre('enemy');
    for (const f of this.fighters.values()) {
      const to = f.side === 'party' ? ec : pc;
      f.sprite.faceVector(to.x - f.home.x, to.z - f.home.z);
    }
    this.frameCamera();
  }

  private centre(side: 'party' | 'enemy'): THREE.Vector3 {
    const c = new THREE.Vector3();
    let n = 0;
    for (const f of this.fighters.values()) if (f.side === side) { c.add(f.home); n++; }
    return n ? c.divideScalar(n) : c.set(this.data.width / 2, 0, this.data.height / 2);
  }

  /** The camera's resting place: behind the party, looking past them at the enemies, far enough to see everyone. */
  private frameCamera(): void {
    const s = this.settings, pc = this.centre('party'), ec = this.centre('enemy');
    const back = this.v.copy(pc).sub(ec).setY(0);
    if (back.lengthSq() < 0.01) back.set(0, 0, 1);
    back.normalize();
    // Keep the view within about 35° of looking north, so the map's props (drawn facing south) still look right.
    let yaw = Math.atan2(back.x, back.z);
    yaw = THREE.MathUtils.clamp(yaw, -0.6, 0.6);
    back.set(Math.sin(yaw), 0, Math.cos(yaw));
    const right = this.w.crossVectors(UP, back).normalize();
    const look = pc.clone().lerp(ec, 0.6);
    look.y = Math.max(pc.y, ec.y) + 0.7;
    // Back off until every fighter is comfortably on screen.
    const probe = new THREE.PerspectiveCamera(s.fov, innerWidth / Math.max(1, innerHeight), 0.3, 200);
    let dist = s.distance;
    const place = (d: number) => {
      probe.position.copy(pc).addScaledVector(back, d).addScaledVector(right, -s.side);
      probe.position.y = pc.y + s.height * (d / s.distance);
      probe.lookAt(look);
      probe.updateMatrixWorld();
    };
    for (let k = 0; k < 12; k++) {
      place(dist);
      let fits = true;
      for (const f of this.fighters.values()) {
        for (const y of [0, f.tall * f.scale]) {
          const p = this.v.copy(f.home).setY(f.home.y + y).project(probe);
          if (Math.abs(p.x) > 0.82 || p.y > 0.8 || p.y < -0.55 || p.z > 1) fits = false;
        }
      }
      if (fits) break;
      dist *= 1.15;
    }
    place(dist);
    this.cam.basePos.copy(probe.position);
    this.cam.baseLook.copy(look);
    // The battle opens with the camera sweeping down from high above the enemies.
    this.cam.pos.copy(probe.position).add(new THREE.Vector3(0, 5, 0)).addScaledVector(back, 4);
    this.cam.look.copy(ec).setY(ec.y + 0.5);
    this.cam.t = 0;
  }

  get fov(): number { return this.settings.fov; }

  /* ------------------------------------------------------------------ what the battle screen asks for */

  animate(key: string, how: 'lunge' | 'hit' | 'cast' | 'heal' | 'faint' | 'approach' | 'strike' | 'back', color?: string, target?: string): void {
    const f = this.fighters.get(key);
    if (!f) return;
    const t = target ? this.fighters.get(target) : undefined;
    if (how === 'lunge' || how === 'approach') {
      this.focus(key);
      f.steps = [];
      const to = t ? this.front(f, t) : this.v.copy(f.home).lerp(this.centre(f.side === 'party' ? 'enemy' : 'party'), 0.25).clone();
      to.y = this.stand(to.x, to.z);
      f.steps.push({ kind: 'move', to, dur: 0.22, t: 0, run: true });
      f.steps.push({ kind: 'play', anim: f.attackAnim, dur: 0.32, t: 0 });
      if (how === 'lunge') f.steps.push({ kind: 'wait', dur: 0.2, t: 0 }, { kind: 'move', to: f.home.clone(), dur: 0.3, t: 0, run: true });
    } else if (how === 'strike') {
      f.steps.push({ kind: 'play', anim: f.attackAnim, dur: 0.26, t: 0 });
    } else if (how === 'back') {
      f.steps.push({ kind: 'wait', dur: 0.15, t: 0 }, { kind: 'move', to: f.home.clone(), dur: 0.32, t: 0, run: true });
    } else if (how === 'hit') {
      f.shake = 0.35;
      if (!f.down && f.sprite instanceof CharacterSprite && f.sprite.has('hurt')) f.sprite.play('hurt', 0.22, 0, undefined, 1);
      this.burst(f, color ?? '#ffffff', color ? 1.6 : 0.8, color ? 0.55 : 0.25);
    } else if (how === 'cast' || how === 'heal') {
      this.focus(key);
      if (f.sprite instanceof CharacterSprite && f.sprite.has('spellcast')) f.sprite.play('spellcast', 0.6);
      this.burst(f, color ?? '#9dffb0', 1.3, 0.7, how === 'heal' ? 0.8 : 0.3);
    } else if (how === 'faint') {
      if (f.side === 'enemy') f.fading = true;
      else if (!f.down) this.lie(f, true);
    }
  }

  /** Just in front of a target, on the attacker's side. */
  private front(f: Fighter, t: Fighter): THREE.Vector3 {
    const d = this.v.copy(f.home).sub(t.home).setY(0);
    const len = d.length() || 1;
    return t.home.clone().addScaledVector(d, Math.min(1, 0.9 / len) * (len > 0.9 ? 1 : 0));
  }

  vitals(key: string, down: boolean, guarding: boolean): void {
    const f = this.fighters.get(key);
    if (!f) return;
    if (f.side === 'party' && down !== f.down) this.lie(f, down);
    f.down = down;
    if (f.side === 'enemy' && !down && f.fading) { f.fading = false; f.fade = 0; }
    f.ringColor = guarding ? '#8cc8ff' : null;
  }

  private lie(f: Fighter, down: boolean): void {
    f.down = down;
    if (!(f.sprite instanceof CharacterSprite)) return;
    const s = f.sprite;
    if (down) { if (s.has('hurt')) s.play('hurt', 0.45, 0, () => s.hold('hurt', 5)); }
    else s.clearAction();
  }

  active(key: string | null): void {
    for (const f of this.fighters.values()) f.active = f.key === key;
    if (key) this.focus(key);
  }

  highlight(keys: string[]): void { this.targets = new Set(keys); }

  private focus(key: string): void { this.focusKey = key; this.focusT = 1.6; }

  private burst(f: Fighter, color: string, size: number, dur: number, rise = 0): void {
    const m = new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sp = new THREE.Sprite(m);
    sp.position.copy(f.at).addScaledVector(UP, f.tall * f.scale * 0.55);
    sp.scale.setScalar(size * 0.4);
    sp.renderOrder = 3;
    this.group.add(sp);
    this.bursts.push({ sprite: sp, t: 0, dur, grow: size, rise });
  }

  /* ------------------------------------------------------------------ every frame */

  update(dt: number): void {
    this.elapsed += dt;
    for (const f of this.fighters.values()) this.updateFighter(f, dt);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      b.sprite.scale.setScalar(b.grow * (0.4 + 0.8 * Math.sin(k * Math.PI * 0.5)));
      b.sprite.position.y += b.rise * dt;
      (b.sprite.material as THREE.SpriteMaterial).opacity = 1 - k * k;
      if (k >= 1) { b.sprite.removeFromParent(); b.sprite.material.dispose(); this.bursts.splice(i, 1); }
    }
    if (this.focusT > 0) this.focusT -= dt;
  }

  private updateFighter(f: Fighter, dt: number): void {
    const s = f.steps[0];
    let moving = false;
    if (s) {
      s.t += dt;
      if (s.kind === 'move') {
        s.from ??= f.at.clone();
        const k = Math.min(1, s.t / s.dur), e = k * k * (3 - 2 * k);
        f.at.lerpVectors(s.from, s.to, e);
        moving = k < 1;
        const dx = s.to.x - s.from.x, dz = s.to.z - s.from.z;
        // Run facing the way they go; back home, turn to face the foe again.
        if (k < 1 && Math.hypot(dx, dz) > 0.05) f.sprite.faceVector(dx, dz);
        if (k >= 1) { f.steps.shift(); if (s.to.distanceToSquared(f.home) < 0.01) this.faceFoes(f); }
      } else if (s.kind === 'play') {
        if (!s.started) {
          s.started = true;
          this.faceFoes(f);
          const sp = f.sprite;
          if (!(sp instanceof CharacterSprite) || !sp.play(s.anim, s.dur)) f.lunge = 0.001;
        }
        if (s.t >= s.dur) f.steps.shift();
      } else if (s.t >= s.dur) f.steps.shift();
    }
    // The one whose turn it is steps forward a little (party), like FFX.
    const want = f.active && f.side === 'party' && !f.steps.length && !f.down ? 1 : 0;
    f.step += (want - f.step) * (1 - Math.exp(-dt * 8));
    if (f.lunge > 0) f.lunge = Math.min(1, f.lunge + dt * 3.5) % 1;
    f.sprite.animate(dt, f.flat ? { moving } : { moving, running: moving, combat: true });
    if (f.fading) f.fade = Math.min(1, f.fade + dt * 1.4);
    const m = f.sprite.mesh;
    const toward = this.v.copy(this.centre(f.side === 'party' ? 'enemy' : 'party')).sub(f.home).setY(0).normalize();
    m.position.copy(f.at).addScaledVector(toward, f.step * 0.5);
    if (f.shake > 0) { f.shake -= dt; m.position.x += Math.sin(f.shake * 70) * 0.06 * (f.shake / 0.35); }
    const sc = f.scale;
    m.scale.set(sc, sc * (1 - f.fade * 0.85), sc);
    m.position.y -= f.fade * 0.3;
    m.visible = f.fade < 1;
    if (f.flat) f.flat.pose(f.lunge, toward.x, toward.z, !f.down && !f.fading);
    // Lying down (no "hurt" animation to fall with): tipped over.
    m.rotation.z = f.down && f.side === 'party' && !(f.sprite instanceof CharacterSprite && f.sprite.has('hurt')) ? Math.PI / 2 * 0.9 : 0;
    // Rings on the ground: the one whose turn it is (gold), targets (ember), guarding (blue).
    const target = this.targets.has(f.key), color = target ? '#ff9a3c' : f.active ? '#ffc46e' : f.ringColor;
    const mat = f.ring.material as THREE.MeshBasicMaterial;
    const op = color && m.visible ? (target ? 0.75 + Math.sin(this.elapsed * 8) * 0.2 : 0.55) : 0;
    mat.opacity += (op - mat.opacity) * (1 - Math.exp(-dt * 12));
    if (color) mat.color.set(color);
    f.ring.position.set(m.position.x, this.stand(m.position.x, m.position.z) + 0.04, m.position.z);
    f.ring.scale.setScalar(Math.max(0.8, f.wide * sc * 0.9));
  }

  private faceFoes(f: Fighter): void {
    const c = this.centre(f.side === 'party' ? 'enemy' : 'party');
    f.sprite.faceVector(c.x - f.home.x, c.z - f.home.z);
  }

  /** Place the camera (sweeping in at the start, then breathing gently, leaning towards whoever acts). */
  updateCamera(dt: number, camera: THREE.PerspectiveCamera): THREE.Vector3 {
    const c = this.cam;
    c.t += dt;
    const sway = Math.sin(this.elapsed * 0.35) * 0.35, bob = Math.sin(this.elapsed * 0.5) * 0.12;
    const pos = this.v.copy(c.basePos);
    pos.x += sway; pos.y += bob;
    const look = this.w.copy(c.baseLook);
    const f = this.focusKey && this.focusT > 0 ? this.fighters.get(this.focusKey) : undefined;
    if (f) {
      // Lean towards the one acting: a party member pulls the camera behind them; an enemy draws the eye.
      const k = Math.min(1, this.focusT);
      if (f.side === 'party') pos.x += (f.home.x - this.centre('party').x) * 0.35 * k;
      look.lerp(f.at, 0.18 * k);
    }
    const rate = c.t < c.intro ? 3 : 2.2;
    c.pos.lerp(pos, 1 - Math.exp(-dt * rate));
    c.look.lerp(look, 1 - Math.exp(-dt * rate));
    camera.position.copy(c.pos);
    camera.lookAt(c.look);
    // Sprites turn to face the camera (only around the up axis).
    for (const fi of this.fighters.values()) {
      const m = fi.sprite.mesh;
      m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
    }
    return c.look;
  }

  /** Where each fighter is on screen (for the battle screen's tags and numbers). */
  project(camera: THREE.Camera, width: number, height: number, place: (key: string, x: number, y: number, w: number, h: number, shown: boolean) => void): void {
    for (const f of this.fighters.values()) {
      const m = f.sprite.mesh;
      const foot = this.v.copy(m.position).project(camera);
      const head = this.w.copy(m.position).addScaledVector(UP, f.tall * f.scale).project(camera);
      const x = (foot.x * 0.5 + 0.5) * width, y = (-foot.y * 0.5 + 0.5) * height;
      const hy = (-head.y * 0.5 + 0.5) * height;
      const h = Math.max(8, y - hy);
      place(f.key, x, y, h * (f.wide / f.tall), h, foot.z < 1 && m.visible);
    }
  }

  /** Midpoint of the fighters on screen (0 bottom … 1 top), for the tilt-shift's sharp band. */
  focusHeight(camera: THREE.Camera): number {
    const p = this.v.copy(this.centre('party')).lerp(this.centre('enemy'), 0.5).project(camera);
    return THREE.MathUtils.clamp(p.y * 0.5 + 0.5, 0.25, 0.75);
  }

  /** The battle's lights and water need their own updates (`each` is handed the built world's parts). */
  dispose(free: (root: THREE.Object3D) => void): void {
    for (const b of this.bursts) { b.sprite.removeFromParent(); b.sprite.material.dispose(); }
    this.bursts.length = 0;
    for (const f of this.fighters.values()) { (f.ring.material as THREE.Material).dispose(); f.ring.removeFromParent(); f.sprite.mesh.removeFromParent(); }
    this.fighters.clear();
    free(this.group);
    this.scene.remove(this.group);
  }
}
