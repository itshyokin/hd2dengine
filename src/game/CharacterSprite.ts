/**
 * A character drawn from a sheet. Two kinds:
 *  - RPG Maker-style (3 frames × 4 directions): walking and standing only, frames picked with the texture offset.
 *  - Animated (Character Builder / LPC): named animations (walk, idle, run, jump, climb, combat_idle, slash, thrust,
 *    shoot, spellcast, hurt…), frames picked with the geometry's UVs so characters can share one texture.
 * Movement sets a looping "motion"; actions (a swing, a cast, getting hurt) play once over it; a "pose" holds one
 * frame (drawing a bow, lying defeated).
 */
import * as THREE from 'three';
import { ANIM_PIXELS_PER_TILE, SpriteLibrary, withSpriteShadows } from '../render/sprites';
import type { SpriteAsset } from '../render/sprites';
import { patchAreaTint } from '../render/areaTint';
import type { CharacterAnimLayout, CharacterPalette, Dir, SheetAnim, WeaponGlow, WeaponSheetAnim, WeaponSpriteDef, WeaponTrail } from '../world/types';

/** Direction rows of LPC weapon sheets. */
const WEAPON_DIRS: Dir[] = ['up', 'left', 'down', 'right'];
/** Body animations a weapon is hidden in when it has no frames for them (the hands are busy elsewhere). */
const HIDE_WEAPON = new Set(['climb', 'sit', 'emote']);
/** Animations played as another one backwards, for weapons drawn that way ("slash_reverse": a slash, reversed). */
const REVERSED: Record<string, string> = { slash_reverse: 'slash' };

/** Swings that leave a trail (for weapons with one). */
const ATTACKS = new Set(['slash', 'backslash', 'halfslash', 'thrust', 'slash_reverse']);
type Side = 'back' | 'front';
/** One earlier frame of a weapon, echoed behind a swing. */
interface Echo { pos: Float32Array; uv: Float32Array; t: number }

/** A weapon or shield drawn over an animated character: one quad behind the body, one in front. */
interface Overlay {
  def: WeaponSpriteDef; back: THREE.Mesh; front: THREE.Mesh; size: { back: number; front: number };
  glow?: WeaponGlow; trail?: WeaponTrail;
  /** The glow: the weapon's soft silhouette in its colour, over each layer (sharing its quad and frame). */
  glows: THREE.Mesh[];
  /** The trail: quads showing earlier frames, newest first, per layer. */
  echoes: Record<Side, THREE.Mesh[]>;
  history: Record<Side, Echo[]>;
  last: Record<Side, string>;
}

/** A weapon to carry: its sprite, and the glow / trail of the item (with the sheet's silhouette for them). */
export interface CarriedWeapon { def: WeaponSpriteDef; map: THREE.Texture; mask?: THREE.Texture | null; glow?: WeaponGlow; trail?: WeaponTrail }

const DIR_ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };
const WALK_CYCLE = [0, 1, 2, 1];

/** What the character's movement looks like this frame. */
export interface Motion { moving: boolean; running?: boolean; airborne?: boolean; climbing?: boolean; combat?: boolean }

export class CharacterSprite {
  readonly mesh: THREE.Mesh;
  dir: Dir;
  private readonly map: THREE.Texture;
  private walkTime = 0;
  /** Animated sheets only. */
  private readonly anim: { layout: CharacterAnimLayout; width: number; height: number } | null;
  private readonly uv: THREE.BufferAttribute | null = null;
  private motion = 'idle';
  private motionTime = 0;
  private action: { name: string; t: number; dur: number; from: number; to: number; done?: () => void; as?: string } | null = null;
  private pose: { name: string; frame: number; as?: string; asFrame?: number } | null = null;
  /** Weapon and shield sprites, drawn in this order (later ones nearer the body on both sides). */
  private overlays: Overlay[] = [];

  constructor(sprites: SpriteLibrary, palette: CharacterPalette | SpriteAsset, dir: Dir = 'down') {
    const asset = 'map' in palette ? (palette as SpriteAsset) : sprites.character(palette as CharacterPalette);
    this.map = asset.map;
    this.anim = asset.anim ?? null;
    this.mesh = withSpriteShadows(new THREE.Mesh(asset.geometry, asset.material), asset);
    if (this.anim) this.uv = asset.geometry.getAttribute('uv') as THREE.BufferAttribute;
    this.dir = dir;
    this.refresh();
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  /** Has animations beyond walking (an animated sheet)? */
  get animated(): boolean { return !!this.anim; }
  /** Does the sheet have this animation? */
  has(name: string): boolean { return !!this.anim?.layout.anims[name]; }

  /**
   * Advance the animation. `moving` (or a Motion) says how the character moves; animated sheets pick walk, run, jump,
   * climb, combat stance or idle from it.
   */
  animate(dt: number, motion: boolean | Motion): void {
    const m: Motion = typeof motion === 'boolean' ? { moving: motion } : motion;
    if (!this.anim) {
      this.walkTime = m.moving ? this.walkTime + dt : 0;
      this.setFrame(m.moving ? WALK_CYCLE[Math.floor(this.walkTime * 8) % 4] : 1);
      return;
    }
    const want = m.climbing ? 'climb' : m.airborne && this.has('jump') ? 'jump' : m.moving ? (m.running && this.has('run') ? 'run' : 'walk') : m.combat && this.has('combat_idle') ? 'combat_idle' : this.has('idle') ? 'idle' : 'walk';
    if (want !== this.motion) { this.motion = want; this.motionTime = 0; }
    // Climbing only animates while moving; a still walk shows the standing frame.
    if (!(m.climbing && !m.moving)) this.motionTime += dt;
    if (this.action) {
      this.action.t += dt;
      if (this.action.t >= this.action.dur) { const done = this.action.done; this.action = null; done?.(); }
    }
    this.refresh();
  }

  /**
   * Play an animation once over the movement (a swing, a cast, getting hurt), lasting `duration` seconds (its own
   * speed when omitted), from step `from` to step `to` of its cycle (the whole cycle by default). Returns false when
   * the sheet doesn't have it.
   */
  play(name: string, duration?: number, from = 0, done?: () => void, to?: number): boolean {
    // A reversed animation ("slash_reverse"): the body plays the plain one backwards.
    const body = this.anim?.layout.anims[name] ? name : REVERSED[name];
    const a = body ? this.anim?.layout.anims[body] : undefined;
    if (!a || !body) return false;
    const end = Math.min(a.cycle.length - 1, to ?? a.cycle.length - 1);
    const steps = Math.max(1, end - from + 1);
    this.action = { name: body, t: 0, dur: duration ?? (steps * a.ms) / 1000, from, to: end, done, as: body !== name ? name : undefined };
    this.pose = null;
    this.refresh();
    return true;
  }

  /** Hold one frame of an animation (cycle step) until cleared with `hold(null)`. */
  hold(name: string | null, step = 0): void {
    const anims = this.anim?.layout.anims;
    if (name && anims?.[name]) this.pose = { name, frame: step };
    else if (name && anims?.[REVERSED[name]]) {
      // A reversed animation's step: the plain one's frame counted from its end (the weapon's own frame as is).
      const base = REVERSED[name];
      this.pose = { name: base, frame: anims[base].cycle.length - 1 - step, as: name, asFrame: step };
    } else this.pose = null;
    this.refresh();
  }

  /** Stop any action or pose (back to plain movement). */
  clearAction(): void { this.action = null; this.pose = null; this.refresh(); }

  get acting(): boolean { return !!this.action; }

  faceVector(dx: number, dz: number): void {
    if (!dx && !dz) return;
    this.dir = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 'left' : 'right') : dz < 0 ? 'up' : 'down';
    this.refresh();
  }

  faceToward(x: number, z: number): void {
    this.faceVector(x - this.mesh.position.x, z - this.mesh.position.z);
  }

  private refresh(): void {
    if (!this.anim) { this.setFrame(1); return; }
    const anims = this.anim.layout.anims;
    let name: string, step: number;
    if (this.pose) {
      name = this.pose.name; step = this.pose.frame;
      if (this.pose.as) {
        const a0 = anims[name], col0 = a0.cycle[Math.max(0, Math.min(a0.cycle.length - 1, step))];
        this.setCell(a0, col0);
        this.drawOverlays(this.pose.as, this.pose.asFrame ?? 0, name, col0);
        return;
      }
    }
    else if (this.action) {
      const n = this.action.to - this.action.from + 1;
      name = this.action.name;
      step = this.action.from + Math.min(n - 1, Math.floor((this.action.t / this.action.dur) * n));
      if (this.action.as) {
        // Played backwards: the body runs its frames last to first; the weapon has its own frames in order.
        const a0 = anims[name], len = a0.cycle.length, seq = step;
        const col0 = a0.cycle[Math.max(0, Math.min(len - 1, len - 1 - seq))];
        this.setCell(a0, col0);
        this.drawOverlays(this.action.as, seq, name, col0);
        return;
      }
    } else if (!anims[this.motion]) {
      // Standing (or a missing animation) on a walk-only sheet: walk's standing frame, or walk itself while moving.
      name = 'walk';
      step = this.motion === 'idle' || this.motion === 'combat_idle' ? -1 : Math.floor((this.motionTime * 1000) / (anims.walk?.ms ?? 100)) % (anims.walk?.cycle.length ?? 1);
    } else {
      name = this.motion;
      step = Math.floor((this.motionTime * 1000) / anims[name].ms) % anims[name].cycle.length;
    }
    const a = anims[name] ?? anims.walk;
    if (!a) return;
    const col = step < 0 ? 0 : a.cycle[Math.max(0, Math.min(a.cycle.length - 1, step))];
    this.setCell(a, col);
    const shown = anims[name] ? name : 'walk';
    this.drawOverlays(shown, col, shown, col);
  }
  /**
   * Carry these weapon sprites (an LPC sword, bow, shield…), drawn frame for frame with the body. Animated sheets
   * only; pass [] to put them away. Shields first, then the weapon.
   */
  setWeapons(list: CarriedWeapon[]): void {
    const fx = (w: { glow?: WeaponGlow; trail?: WeaponTrail }) => JSON.stringify([w.glow ?? null, w.trail ?? null]);
    const same = list.length === this.overlays.length && list.every((w, i) => w.def.id === this.overlays[i].def.id && fx(w) === fx(this.overlays[i]));
    if (same) return;
    for (const o of this.overlays) {
      for (const m of [o.back, o.front]) {
        this.mesh.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        m.customDepthMaterial?.dispose();
      }
      // Glows share their layer's quad; echoes have their own.
      for (const g of o.glows) (g.material as THREE.Material).dispose();
      for (const e of [...o.echoes.back, ...o.echoes.front]) { this.mesh.remove(e); e.geometry.dispose(); (e.material as THREE.Material).dispose(); }
    }
    this.overlays = [];
    if (!this.anim) return;
    list.forEach((w, i) => {
      const make = (side: 'back' | 'front') => {
        const g = new THREE.PlaneGeometry(1, 1);
        const n = g.attributes.normal as THREE.BufferAttribute, base = this.mesh.geometry.attributes.normal as THREE.BufferAttribute;
        for (let k = 0; k < n.count; k++) n.setXYZ(k, base.getX(0), base.getY(0), base.getZ(0));
        const mat = patchAreaTint(new THREE.MeshStandardMaterial({ map: w.map, alphaTest: 0.5, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }), false);
        const m = new THREE.Mesh(g, mat);
        m.castShadow = true;
        m.receiveShadow = true;
        m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: w.map, alphaTest: 0.5, side: THREE.DoubleSide });
        // Just behind or in front of the body; the later sprite (the weapon) nearer to it than the shield.
        const k = (list.length - i) * 0.012;
        m.position.z = side === 'back' ? -k : k;
        m.visible = false;
        this.mesh.add(m);
        return m;
      };
      const o: Overlay = { def: w.def, back: make('back'), front: make('front'), size: { back: 0, front: 0 }, glow: w.glow, trail: w.trail,
        glows: [], echoes: { back: [], front: [] }, history: { back: [], front: [] }, last: { back: '', front: '' } };
      const fxMat = (color: string, opacity: number) => new THREE.MeshBasicMaterial({ map: w.mask!, color: new THREE.Color(color), transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      if (w.mask && w.glow) for (const layer of [o.back, o.front]) {
        const g = new THREE.Mesh(layer.geometry, fxMat(w.glow.color, 0.7));
        g.position.z = 0.004;
        g.renderOrder = 3;
        layer.add(g);
        o.glows.push(g);
      }
      if (w.mask && w.trail) for (const side of ['back', 'front'] as const) {
        const n = Math.max(1, Math.min(4, w.trail.length ?? 3));
        for (let k = 0; k < n; k++) {
          const e = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fxMat(w.trail.color, 0));
          e.position.z = (side === 'back' ? -1 : 1) * ((list.length - i) * 0.012 - 0.002 * (k + 1));
          e.renderOrder = 3;
          e.visible = false;
          this.mesh.add(e);
          o.echoes[side].push(e);
        }
      }
      this.overlays.push(o);
    });
    this.refresh();
  }

  /** The weapon sprites being carried. */
  get weaponIds(): string[] { return this.overlays.map((o) => o.def.id); }

  /**
   * Show each weapon's frame for what the body is doing: animation `want` at step `wantCol` if the weapon has it
   * (its own frames, e.g. a reversed slash), else the body's animation `name` at frame `col`, else a stand-in
   * (running → walking, anything else → the walking stance), or hidden (climbing, sitting).
   */
  private drawOverlays(want: string, wantCol: number, name: string, col: number): void {
    if (!this.overlays.length) return;
    const bodyMat = this.mesh.material as THREE.MeshStandardMaterial;
    for (const o of this.overlays) {
      const has = (a: string) => !!(o.def.layers.back[a] || o.def.layers.front[a]);
      for (const side of ['back', 'front'] as const) {
        const L = o.def.layers[side], mesh = side === 'back' ? o.back : o.front;
        let cell: WeaponSheetAnim | undefined, c = col;
        if (has(want)) { cell = L[want]; c = wantCol; }
        else if (has(name)) cell = L[name];
        else if (!HIDE_WEAPON.has(name)) {
          cell = L.walk;
          c = name === 'run' && cell ? 1 + (col % Math.max(1, cell.frames - 1)) : 0;
        }
        if (!cell) { mesh.visible = false; continue; }
        mesh.visible = true;
        this.setOverlayCell(o, side, mesh, cell, Math.min(cell.frames - 1, Math.max(0, c)));
        // Follow the body's fading (a defeated enemy) and hurt flash.
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m.opacity !== bodyMat.opacity || m.transparent !== bodyMat.transparent) { m.opacity = bodyMat.opacity; m.transparent = bodyMat.transparent; m.needsUpdate = true; }
        if (bodyMat.emissive) { m.emissive.copy(bodyMat.emissive); m.emissiveIntensity = bodyMat.emissiveIntensity; }
      }
      this.drawEffects(o, ATTACKS.has(want) || ATTACKS.has(name), bodyMat.transparent ? bodyMat.opacity : 1);
    }
  }

  /** The glow's pulse, and the trail's echoes of earlier frames (only while swinging; they fade fast). */
  private drawEffects(o: Overlay, swinging: boolean, fade: number): void {
    const now = performance.now() / 1000;
    if (o.glow) {
      const pulse = o.glow.pulse === false ? 1 : 0.78 + 0.22 * Math.sin(now * 4.2);
      const a = Math.min(1, 0.7 * (o.glow.strength ?? 1) * pulse * fade);
      for (const g of o.glows) (g.material as THREE.MeshBasicMaterial).opacity = a;
    }
    if (!o.trail) return;
    for (const side of ['back', 'front'] as const) {
      const echoes = o.echoes[side], hist = o.history[side];
      if (!swinging) { hist.length = 0; o.last[side] = ''; }
      echoes.forEach((e, k) => {
        const h = hist[k];
        const life = h ? 1 - (now - h.t) / 0.3 : 0;
        if (!h || life <= 0) { e.visible = false; return; }
        const g = e.geometry as THREE.BufferGeometry;
        const pos = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
        if ((e.userData.echo as Echo | undefined) !== h) {
          (pos.array as Float32Array).set(h.pos); pos.needsUpdate = true;
          (uv.array as Float32Array).set(h.uv); uv.needsUpdate = true;
          g.computeBoundingSphere();
          e.userData.echo = h;
        }
        (e.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k / (echoes.length + 1)) * life * fade;
        e.visible = true;
      });
    }
  }

  private setOverlayCell(o: Overlay, side: Side, mesh: THREE.Mesh, cell: WeaponSheetAnim, col: number): void {
    const F = cell.frame, W = o.def.width, H = o.def.height;
    const g = mesh.geometry as THREE.BufferGeometry;
    const r = cell.dirs === 4 ? Math.max(0, WEAPON_DIRS.indexOf(this.dir)) : 0;
    // A new frame: the one it replaces joins the trail (weapons with one).
    const key = `${cell.y}:${col}:${r}`;
    if (o.trail && key !== o.last[side]) {
      if (o.last[side]) {
        const hist = o.history[side];
        hist.unshift({ pos: Float32Array.from((g.attributes.position as THREE.BufferAttribute).array as Float32Array), uv: Float32Array.from((g.attributes.uv as THREE.BufferAttribute).array as Float32Array), t: performance.now() / 1000 });
        hist.length = Math.min(hist.length, o.echoes[side].length);
      }
      o.last[side] = key;
    }
    if (o.size[side] !== F) {
      // Size the quad for this frame size, centred on the body's frame (whose feet are 2 px above its bottom).
      o.size[side] = F;
      const f = this.anim!.layout.frame, px = 1 / ANIM_PIXELS_PER_TILE;
      const bottom = -(f / 32) * px - ((F - f) / 2) * px, top = bottom + F * px, hw = (F * px) / 2;
      const pos = g.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, -hw, top, 0); pos.setXYZ(1, hw, top, 0); pos.setXYZ(2, -hw, bottom, 0); pos.setXYZ(3, hw, bottom, 0);
      pos.needsUpdate = true;
      g.computeBoundingSphere();
    }
    const u0 = (col * F) / W, u1 = ((col + 1) * F) / W;
    const v1 = 1 - (cell.y + r * F) / H, v0 = 1 - (cell.y + (r + 1) * F) / H;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
  }

  private setCell(a: SheetAnim, col: number): void {
    const { layout, width, height } = this.anim!;
    const f = layout.frame;
    const dirIndex = a.dirs === 4 ? Math.max(0, layout.dirs.indexOf(this.dir)) : 0;
    const row = a.row + dirIndex;
    const u0 = (col * f) / width, u1 = ((col + 1) * f) / width;
    const v1 = 1 - (row * f) / height, v0 = 1 - ((row + 1) * f) / height;
    const uv = this.uv!;
    // PlaneGeometry corners: top-left, top-right, bottom-left, bottom-right.
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
  }

  private setFrame(frame: number): void {
    this.map.offset.set(frame / 3, 1 - (DIR_ROW[this.dir] + 1) / 4);
  }
}

export const DIR_VECTOR: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
