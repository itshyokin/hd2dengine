/**
 * The party: heroes who travel with the one you play (Database → Heroes, all but the first). Up to three join;
 * they follow the hero's trail and, when enemies come for the party, fight on their own by their AI style:
 *   fighter: closes in with their weapon · archer: keeps back and shoots · caster: their spell shard ·
 *   healer: heals whoever drops below half health, otherwise casts.
 * Shared with the hero: the bag and gold (only the hero picks up what enemies drop). Their own: level and experience
 * (given out once a fight is over, for every enemy beaten while they were standing), stats and stat points, equipment,
 * health, magic and stamina. Knocked out, they get up again a little after the fight with a quarter of their health.
 */
import * as THREE from 'three';
import type { TileMap } from '../world/TileMap';
import type { AbilityData, AllyStyle, Dir, Element, EquipSlot, HeroDef, Inflict } from '../world/types';
import { abilityJSON } from './abilities';
import type { Attrs } from './attributes';
import { ATTRS, ATTR_MAX, baseAttrs } from './attributes';
import { CharacterSprite } from './CharacterSprite';
import { SWIM_SINK } from './PlayerMotion';
import type { SpriteLibrary } from '../render/sprites';
import type { AllyFighter } from './combat/Combat';
import type { Enemy } from './combat/Enemy';
import { MAX_LEVEL_LIMIT, mitigate, xpToNext, type XpRules } from './combat/config';
import { elementResult } from './elements';

/** Party members besides the hero (eight in all). */
export const MAX_PARTY = 7;
/** Party members who fight beside the hero (three a side); the rest wait on the bench and can swap in. */
export const ACTIVE_MEMBERS = 2;

/** A party member's own state (saved with the game). */
export interface MemberData {
  id: string;
  stats: Attrs;
  statPoints: number;
  /** Growth ranks changed for good (potions, events); the rest are the Database's. */
  statRanks?: Partial<Record<keyof Attrs, import('./statRanks').Rank>>;
  /** Their own level, and experience into it. */
  level: number;
  xp: number;
  /** Experience earned in the fight going on (handed out when it's over). */
  pendingXp?: number;
  equip: Partial<Record<EquipSlot, string>>;
  /** Their own skill tree: ranks learned, and skill points to spend (from levels). */
  skills?: Record<string, number>;
  skillPoints?: number;
  /** How they fight, chosen by the player (unset: their database style). */
  style?: AllyStyle;
  hp: number; mp: number; sp: number;
  down?: boolean;
  /** Learned spells and Additions, the readied ones, and class. */
  abilities?: AbilityData;
}

export class PartyState {
  members: MemberData[] = [];

  has(id: string): boolean { return this.members.some((m) => m.id === id); }
  get(id: string): MemberData | undefined { return this.members.find((m) => m.id === id); }
  get full(): boolean { return this.members.length >= MAX_PARTY; }

  toJSON(): MemberData[] { return this.members.map((m) => ({ ...m, stats: { ...m.stats }, equip: { ...m.equip }, ...(m.skills ? { skills: { ...m.skills } } : {}), ...(m.abilities ? { abilities: abilityJSON(m.abilities) } : {}) })); }
  load(d: MemberData[] | undefined): void {
    this.members = (d ?? []).filter((m) => m && typeof m.id === 'string').slice(0, MAX_PARTY).map((m) => ({
      id: m.id, stats: { ...baseAttrs(), ...m.stats }, statPoints: 0, ...(m.statRanks ? { statRanks: { ...m.statRanks } } : {}), level: Math.max(1, Math.round(Number(m.level) || 1)), xp: Math.max(0, Number(m.xp) || 0),
      ...(m.pendingXp ? { pendingXp: m.pendingXp } : {}), equip: { ...m.equip },
      ...(m.skills ? { skills: { ...m.skills } } : {}), ...(m.style ? { style: m.style } : {}), ...(m.skillPoints !== undefined ? { skillPoints: Math.max(0, Math.round(Number(m.skillPoints) || 0)) } : {}),
      hp: Number(m.hp) || 0, mp: Number(m.mp) || 0, sp: Number(m.sp) || 0, ...(m.down ? { down: true } : {}),
      ...(m.abilities ? { abilities: abilityJSON(m.abilities) } : {}),
    }));
  }
}

/** Fighting styles, as the Equipment page names them. */
export const STYLE_NAMES: Record<AllyStyle, string> = { fighter: 'Melee', archer: 'Archery', caster: 'Magic', healer: 'Healing' };

/**
 * How a member fights: their chosen style (or the database's), if they have its weapon; otherwise whatever they do
 * have (a bow alone makes an archer, a shard alone a caster; with nothing, fists).
 */
export function fightingStyle(def: Pick<HeroDef, 'ai'>, m: Pick<MemberData, 'style' | 'equip'>, n: { bow: number; spell: number }): AllyStyle {
  const want = m.style ?? def.ai ?? 'fighter';
  const sword = !!m.equip.weapon, bow = n.bow > 0, magic = n.spell > 0;
  if (want === 'archer' && bow) return 'archer';
  if (want === 'caster' && magic) return 'caster';
  if (want === 'healer') return 'healer';
  if (want === 'fighter' && (sword || (!bow && !magic))) return 'fighter';
  return sword ? 'fighter' : bow ? 'archer' : magic ? 'caster' : 'fighter';
}

/** Give a member experience; returns the levels gained (each adds `gains` to their stats, by rank, and `skillPerLevel` skill points). */
export function memberGainXp(m: MemberData, n: number, rules: XpRules, gains: Partial<Attrs>, skillPerLevel = 0): number {
  const top = rules.maxLevel ?? MAX_LEVEL_LIMIT;
  if (m.level >= top) { m.xp = 0; return 0; }
  m.xp += Math.max(0, Math.round(n));
  let ups = 0;
  while (m.level < top && m.xp >= xpToNext(rules, m.level)) { m.xp -= xpToNext(rules, m.level); m.level++; for (const k of ATTRS) m.stats[k] = Math.min(ATTR_MAX, m.stats[k] + (gains[k] ?? 0)); m.skillPoints = (m.skillPoints ?? 0) + skillPerLevel; ups++; }
  if (m.level >= top) m.xp = 0;
  return ups;
}

/** Spend a member's stat points (as the hero's are spent): false if they haven't the points or a stat would pass the top. */
export function spendMember(m: MemberData, add: Partial<Attrs>): boolean {
  const total = ATTRS.reduce((s, k) => s + Math.max(0, Math.round(add[k] ?? 0)), 0);
  if (total > m.statPoints || ATTRS.some((k) => m.stats[k] + (add[k] ?? 0) > ATTR_MAX)) return false;
  for (const k of ATTRS) m.stats[k] += Math.max(0, Math.round(add[k] ?? 0));
  m.statPoints -= total;
  return true;
}

/** What a party member fights with right now (from their stats and gear). */
export interface AllyNumbers {
  max: { hp: number; mp: number; sp: number };
  melee: number; meleeElement: Element; meleeInflicts?: Inflict[];
  /** Seconds between swings. */
  swing: number;
  bow: number; bowElement: Element;
  spell: number; spellMp: number; spellColor?: string; spellElement: Element;
  heal: number;
  crit: number; armour: number; magicArmour: number;
  elements: Element[];
}

export interface HealTarget { name: string; x: number; z: number; hp: number; max: number; heal(n: number): void }

export interface AllyHost {
  map: TileMap;
  /** A point on the hero's trail this far behind them (tiles). */
  trailPoint(dist: number): { x: number; z: number } | null;
  leader: { x: number; y: number; z: number };
  /** Enemies after the party right now. */
  threats(): Enemy[];
  /** Has the party been out of a fight for a while? */
  calm: boolean;
  numbers(m: MemberData, def: HeroDef): AllyNumbers;
  strike(a: Ally, e: Enemy, damage: number, element: Element, inflicts?: Inflict[]): void;
  shoot(a: Ally, kind: 'arrow' | 'fire', tx: number, ty: number, tz: number, damage: number, color: string | undefined, element: Element): void;
  healTargets(): HealTarget[];
  float(text: string, x: number, y: number, z: number, kind: 'dmg' | 'heal' | 'info' | 'hurt'): void;
  sound(name: 'hurt' | 'swing' | 'heal' | 'save', x: number, z: number): void;
  log(text: string): void;
  /** Where the hero jumped lately (party members hop there too). */
  jumps(): { id: number; x: number; z: number }[];
  sparkle(x: number, y: number, z: number, color: string): void;
}

const RUN = 4.6, WALK = 3.2;
/** How long a party member's hop lasts (s). */
const HOP_TIME = 0.55;

export class Ally implements AllyFighter {
  readonly sprite: CharacterSprite;
  x: number; y: number; z: number;
  private cooldown = 0.5;
  private target: Enemy | null = null;
  private stuck = 0;
  private downFor = 0;
  /** Order behind the hero (0 = right behind). */
  slot = 0;
  /** Only walks along (the hero you play, following whoever leads the lineup): never fights on the map. */
  passive = false;

  constructor(readonly data: MemberData, readonly def: HeroDef, sprites: SpriteLibrary, look: Parameters<SpriteLibrary['forCharacter']>[0], parent: THREE.Object3D, x: number, z: number, map: TileMap) {
    this.sprite = new CharacterSprite(sprites, sprites.forCharacter(look), 'down');
    this.map = map;
    this.x = x; this.z = z; this.y = map.standY(x, z);
    this.sprite.mesh.position.set(x, this.y, z);
    this.sprite.mesh.castShadow = true;
    parent.add(this.sprite.mesh);
    if (data.down) this.sprite.play('hurt', 0.3, 0, () => this.sprite.hold('hurt', 5));
  }

  get name(): string { return this.def.name; }
  get down(): boolean { return !!this.data.down; }
  crit = 5;

  dispose(): void { this.sprite.mesh.removeFromParent(); }

  /** Put them somewhere (a new map, or catching up with the hero). */
  place(x: number, z: number, map: TileMap): void {
    this.map = map;
    this.x = x; this.z = z; this.y = map.standY(x, z);
    this.sprite.mesh.position.set(this.x, this.y, this.z);
    this.stuck = 0;
  }

  hurt(damage: number, from: Enemy | undefined, magic: boolean, element: Element): void {
    if (this.down) return;
    // The numbers are worked out by the host each frame; kept here for hits between updates.
    const n = this.last;
    const el = elementResult(element, this.def);
    if (el.kind === 'immune') { this.float('Immune', 'info'); return; }
    const dmg = mitigate(damage * (el.kind === 'hit' ? el.mult : 1) * (0.9 + Math.random() * 0.2), magic ? n?.magicArmour ?? 0 : n?.armour ?? 0);
    if (el.kind === 'absorb') { this.data.hp = Math.min(n?.max.hp ?? 100, this.data.hp + dmg); this.float(`+${dmg}`, 'heal'); return; }
    this.data.hp = Math.max(0, this.data.hp - dmg);
    this.float(String(dmg), 'hurt');
    this.hostRef?.sound('hurt', this.x, this.z);
    if (from) { const dx = this.x - from.x, dz = this.z - from.z, d = Math.hypot(dx, dz) || 1; this.tryMove((dx / d) * 0.25, (dz / d) * 0.25); }
    if (this.data.hp <= 0) {
      this.data.down = true;
      this.target = null;
      this.downFor = 0;
      this.hostRef?.log(`${this.name} is knocked out!`);
      if (!this.sprite.play('hurt', 0.5, 0, () => this.sprite.hold('hurt', 5))) this.sprite.mesh.rotation.z = Math.PI / 2;
    } else this.sprite.play('hurt', 0.25);
  }

  private last: AllyNumbers | null = null;
  private hostRef: AllyHost | null = null;
  private float(text: string, kind: 'dmg' | 'heal' | 'info' | 'hurt'): void { this.hostRef?.float(text, this.x, this.y + 1.4, this.z, kind); }

  update(dt: number, h: AllyHost): void {
    this.hostRef = h;
    const n = (this.last = h.numbers(this.data, this.def));
    this.crit = n.crit;
    this.cooldown -= dt;
    // Magic and health come back slowly, faster out of a fight.
    this.data.mp = Math.min(n.max.mp, this.data.mp + dt * (h.calm ? 4 : 1));
    this.data.sp = n.max.sp;
    if (this.down) {
      // Up again a moment after the fight, with a quarter of their health.
      this.downFor += dt;
      if (h.calm && this.downFor > 3) {
        this.data.down = false;
        this.data.hp = Math.max(1, Math.round(n.max.hp * 0.25));
        this.sprite.hold(null);
        this.sprite.mesh.rotation.z = 0;
        this.float('Back up!', 'info');
        h.log(`${this.name} gets back up`);
      }
      this.sprite.animate(dt, false);
      return;
    }
    if (h.calm) this.data.hp = Math.min(n.max.hp, this.data.hp + dt * 0.5);

    let moving = false, running = false;
    const threats = this.passive ? [] : h.threats();
    if (this.target && (this.target.dead || !threats.includes(this.target))) this.target = null;
    if (!this.target && threats.length) {
      let bd = 10;
      for (const e of threats) { const d = Math.hypot(e.x - this.x, e.z - this.z); if (d < bd) { bd = d; this.target = e; } }
    }
    const style = fightingStyle(this.def, this.data, n);
    // A healer looks after the party first.
    if (style === 'healer' && !this.passive && this.data.mp >= HEAL_MP) {
      const hurt = h.healTargets().filter((t) => t.hp > 0 && t.hp < t.max * 0.5).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
      if (hurt) {
        const d = Math.hypot(hurt.x - this.x, hurt.z - this.z);
        if (d > 5) { moving = this.moveToward(hurt.x, hurt.z, RUN, dt, 4); running = true; }
        else if (this.cooldown <= 0) {
          this.sprite.faceToward(hurt.x, hurt.z);
          this.sprite.play('spellcast', 0.5) || this.sprite.play('thrust', 0.4);
          hurt.heal(n.heal);
          this.data.mp -= HEAL_MP;
          this.cooldown = 1.8;
          h.sound('heal', hurt.x, hurt.z);
          h.sparkle(hurt.x, h.leader.y + 0.8, hurt.z, '#9be8a0');
          h.float(`+${n.heal}`, hurt.x, h.leader.y + 1.5, hurt.z, 'heal');
        }
        this.finish(dt, moving, running);
        return;
      }
    }
    const e = this.target;
    if (e) {
      const d = Math.hypot(e.x - this.x, e.z - this.z);
      const canCast = n.spell > 0 && this.data.mp >= n.spellMp;
      const ranged = (style === 'archer' && n.bow > 0) || ((style === 'caster' || style === 'healer') && canCast);
      if (ranged) {
        if (d < 2.5) { moving = this.moveToward(this.x - (e.x - this.x), this.z - (e.z - this.z), WALK, dt, 0); }
        else if (d > 7) { moving = this.moveToward(e.x, e.z, RUN, dt, 6); running = true; }
        else if (this.cooldown <= 0) {
          this.sprite.faceToward(e.x, e.z);
          if (style === 'archer') {
            this.sprite.play('shoot', 0.35, 9) || this.sprite.play('thrust', 0.3);
            h.shoot(this, 'arrow', e.x, e.y + 0.6, e.z, n.bow, undefined, n.bowElement);
            this.cooldown = 1.3;
          } else {
            this.sprite.play('spellcast', 0.45) || this.sprite.play('thrust', 0.35);
            h.shoot(this, 'fire', e.x, e.y + 0.6, e.z, n.spell, n.spellColor, n.spellElement);
            this.data.mp -= n.spellMp;
            this.cooldown = 1.6;
          }
        } else this.sprite.faceToward(e.x, e.z);
      } else {
        // Into reach and swing.
        if (d > 1.0) { moving = this.moveToward(e.x, e.z, RUN, dt, 0.8); running = true; }
        else if (this.cooldown <= 0) {
          this.sprite.faceToward(e.x, e.z);
          this.sprite.play('slash', n.swing * 0.8) || this.sprite.play('thrust', n.swing * 0.8);
          h.strike(this, e, n.melee, n.meleeElement, n.meleeInflicts);
          h.sound('swing', this.x, this.z);
          this.cooldown = n.swing + 0.35;
        } else this.sprite.faceToward(e.x, e.z);
      }
      // Too far from the hero: back to them.
      if (Math.hypot(h.leader.x - this.x, h.leader.z - this.z) > 14) this.target = null;
      this.finish(dt, moving, running);
      return;
    }
    // Following: a spot on the hero's trail, hopping where the hero jumped.
    if (this.hopT <= 0) for (const j of h.jumps()) {
      if (j.id <= this.lastJump || Math.hypot(j.x - this.x, j.z - this.z) > 0.45) continue;
      this.lastJump = j.id; this.hopT = HOP_TIME;
      this.sprite.play('jump', HOP_TIME);
      break;
    }
    const spot = h.trailPoint(1.1 * (this.slot + 1));
    if (spot) {
      const far = Math.hypot(spot.x - this.x, spot.z - this.z);
      if (far > 9) this.place(spot.x, spot.z, h.map);
      else if (far > 0.25) {
        running = far > 1.6;
        moving = this.moveToward(spot.x, spot.z, running ? RUN : WALK, dt, 0.05, true);
        if (!moving && far > 1.2) { this.stuck += dt; if (this.stuck > 1.2) this.place(spot.x, spot.z, h.map); }
      }
    }
    this.finish(dt, moving, running);
  }

  private finish(dt: number, moving: boolean, running: boolean): void {
    if (moving) this.stuck = 0;
    this.sprite.animate(dt, this.sprite.animated ? { moving, running, combat: !!this.target } : moving);
    this.swimT += dt;
    // A hop: up and down in an arc (as high as the hero's jump).
    let hop = 0;
    if (this.hopT > 0) { this.hopT = Math.max(0, this.hopT - dt); const k = 1 - this.hopT / HOP_TIME; hop = Math.sin(k * Math.PI) * 0.8; }
    this.sprite.mesh.position.set(this.x, this.feetY() + hop, this.z);
  }

  private hopT = 0;
  /** The last of the hero's jumps copied. */
  private lastJump = 0;

  private swimT = Math.random() * 6;
  /** In water too deep to wade: they sink in up to the chest like the hero (bobbing). */
  get swimming(): boolean {
    const w = this.map?.footWaterAt(Math.floor(this.x), Math.floor(this.z));
    return !!w && w.kind !== 'shallow';
  }
  /** Where their feet are drawn: the ground, or sunk into swimmable water. */
  private feetY(): number {
    const w = this.map?.footWaterAt(Math.floor(this.x), Math.floor(this.z));
    return w && w.kind !== 'shallow' ? w.surface - SWIM_SINK + Math.sin(this.swimT * 3) * 0.03 : this.y;
  }

  private map: TileMap | null = null;

  /** Walk toward a point (`ghost`: following the hero's own steps, so no need to check the way). */
  private moveToward(tx: number, tz: number, speed: number, dt: number, stop: number, ghost = false): boolean {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d <= stop || d < 1e-3) return false;
    const step = Math.min(d - stop, speed * dt);
    this.sprite.faceVector(dx, dz);
    if (ghost) {
      this.x += (dx / d) * step; this.z += (dz / d) * step;
      if (this.map) this.y = this.map.standY(this.x, this.z);
      return true;
    }
    if (this.tryMove((dx / d) * step, (dz / d) * step)) return true;
    // Blocked: a step to the side.
    const sx = -dz / d, sz = dx / d;
    return this.tryMove(sx * step, sz * step) || this.tryMove(-sx * step, -sz * step);
  }

  private tryMove(dx: number, dz: number): boolean {
    const m = this.map;
    if (!m) return false;
    let moved = false;
    if (dx && this.free(this.x + dx, this.z)) { this.x += dx; moved = true; }
    if (dz && this.free(this.x, this.z + dz)) { this.z += dz; moved = true; }
    if (moved) this.y = m.standY(this.x, this.z);
    return moved;
  }

  private free(x: number, z: number): boolean {
    const m = this.map!, r = 0.22, fromY = m.standY(this.x, this.z);
    for (const [px, pz] of [[x - r, z - r * 0.6], [x + r, z - r * 0.6], [x - r, z + r * 0.6], [x + r, z + r * 0.6]]) {
      const cx = Math.floor(px), cz = Math.floor(pz);
      if (!m.inMap(cx, cz) || m.isBlocked(cx, cz) || m.inBox(px, pz)) return false;
      if (Math.abs(m.standY(px, pz) - fromY) > 0.3) return false;
    }
    return true;
  }

  /** Face a direction (lined up behind the hero after a map change). */
  face(dir: Dir): void { this.sprite.dir = dir; }
}

/** Magic a healer spends on a heal. */
export const HEAL_MP = 10;
