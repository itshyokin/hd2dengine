/**
 * Field combat: the hero's attacks (1 melee, 2 bow, 3 magic), lock-on (Q / Tab), dodging (Space while
 * locked on), sneaking (C), the enemies on the map, arrows and firebolts, and the feel of a hit
 * (hit-stop, knock-back, a little camera shake, numbers).
 */
import * as THREE from 'three';
import type { Bursts } from '../../render/Bursts';
import type { SpriteLibrary } from '../../render/sprites';
import { linearColor } from '../../render/textures';
import type { CombatOverlay } from '../../ui/CombatOverlay';
import type { TileMap } from '../../world/TileMap';
import type { Ailment, Database, Element, EnemyDef, EquipSlot, EventPage, Inflict, ItemDef } from '../../world/types';
import type { CarriedWeapon, CharacterSprite } from '../CharacterSprite';
import { DIR_VECTOR } from '../CharacterSprite';
import { Breakable, type BreakableEvent, type HitKind } from './Breakable';
import type { Input } from '../Input';
import type { Inventory } from '../inventory';
import type { PlayerMotion } from '../PlayerMotion';
import type { PlayerStats } from '../stats';
import { type CombatConfig, SWING_TIME, mitigate } from './config';
import type { Skills } from '../skills';
import type { Sfx } from '../../audio/sfx';
import { ENEMY_RADIUS, Enemy, type EnemyWorld, SUSPICIOUS, lineOfSight } from './Enemy';
import { Held } from './Held';
import { elementIconUrl } from '../../art/elementIcons';
import { statusIconUrl } from '../../art/statusIcons';
import type { LogKind } from '../../ui/AdventureLog';
import { itemWeaponSprite } from './weaponSprites';
import { ELEMENT_COLORS, ELEMENT_NAMES, type ElementalDefence, elementResult } from '../elements';
import { AILMENT_INFO, type ApplyResult, BLIND_MISS, StatusSet, effectColor, effectName } from '../status';
import { CRIT_MULTIPLIER, DAMAGE_CAP, type HeroTotals, powerMultiplier, speedMultiplier } from '../attributes';

/** What the attack button uses. */
export type WeaponMode = 'melee' | 'bow' | 'magic';
export const WEAPON_MODES: WeaponMode[] = ['melee', 'bow', 'magic'];
/** What Y switches between and the trigger attacks with (spells have their own button). */
const ARMS: WeaponMode[] = ['melee', 'bow'];

export interface CombatHost {
  map: TileMap;
  level: THREE.Object3D;
  sprites: SpriteLibrary;
  db: Database;
  cfg: CombatConfig;
  player: CharacterSprite;
  motion: PlayerMotion;
  stats: PlayerStats;
  inventory: Inventory;
  items: Map<string, ItemDef>;
  overlay: CombatOverlay;
  bursts: Bursts;
  /** The hero's skills (bonuses, spells, perks). */
  skills: Skills;
  /** The hero's stats with equipment and skills, crit chance and defences. */
  hero(): HeroTotals;
  /** The hero's elements, immunities and absorbs. */
  heroElements(): ElementalDefence;
  /** A melee swing hit nothing: it can chop something cuttable in front of the hero. */
  swingMissed?(): void;
  /** Trained with this weapon class (the skill tree)? Untrained, medium and heavy weapons swing slowly. */
  proficient?(cls: 'light' | 'medium' | 'heavy'): boolean;
  /** Ailments the hero can't get (their own and what their equipment keeps away). */
  heroResists(): Ailment[];
  /** The picture of an item (its icon), or a built-in icon when there's no item. */
  iconCanvas(itemId: string | undefined, fallback: string): HTMLCanvasElement;
  /** The hero's glow while a ring power is on (null: none). */
  glow(): { color: THREE.Color; amount: number } | null;
  /** Sneak while the button is held (true) or toggle it (false). */
  crouchHold(): boolean;
  /** Play a sound effect at a spot (or flat, without one). */
  sound(name: Sfx, x?: number, z?: number): void;
  /** 0 … 1: how lit the spot is (time of day, lamps, the hero's own light). */
  lightAt(x: number, z: number): number;
  notice(text: string): void;
  solidEventAt(x: number, z: number): boolean;
  /** A fire attack reached (x, y, z): light any fire that's gone out within `r` (true if one caught). */
  ignite?(x: number, y: number, z: number, r: number): boolean;
  /** 0 … 1: how lit up the hero is by firelight or a light ring. */
  heroLit?(): number;
  /** Ground no enemy enters: around lit campfires. */
  safeZones?(): { x: number; z: number; r: number }[];
  /** Count something for the Journal's records. */
  tally?(key: string, n?: number, best?: boolean): void;
  /** Cast a field spell (Light, Water Walk): switch it on or off. */
  fieldSpell?(): void;
  /** Party members on the field (enemies may go after them instead of the hero). */
  allies?(): AllyFighter[];
  /** An enemy was defeated: experience, loot and its page's commands. */
  defeated(e: Enemy): void;
  /** Something breakable was broken: its page's commands. */
  broken(b: Breakable): void;
  /** A line in the adventure log. */
  log(text: string, kind: LogKind): void;
  /**
   * Turn-based battles: a fight broke out with `e` on the map (the hero or a friend hit it first: preemptive; it hit
   * first: normal, or from behind: ambush). True when the game took it over (a battle starts, or one just ended and
   * the hit is ignored); the hit itself then doesn't happen.
   */
  encounter?(e: Enemy, opening: 'preemptive' | 'normal' | 'ambush'): boolean;
}

/** An event the combat system can turn into an enemy. */
/** What the hero can lock on to and hit. */
export type Target = Enemy | Breakable;
const radiusOf = (t: Target): number => (t instanceof Breakable ? t.radius : ENEMY_RADIUS);

export interface EnemyEvent { page: EventPage | null; readonly x: number; readonly z: number; readonly w: number; readonly h: number }

/** A party member fighting beside the hero (for hits they land, and for enemies to go after). */
export interface AllyFighter {
  name: string;
  x: number; y: number; z: number;
  /** Knocked out: not a target. */
  down: boolean;
  crit: number;
  /** An enemy's hit landing on them (`magic`: against their magic defence). */
  hurt(damage: number, from: Enemy | undefined, magic: boolean, element: Element): void;
}

interface Projectile {
  mesh: THREE.Object3D;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  left: number;
  damage: number;
  from: 'player' | 'enemy';
  kind: 'arrow' | 'fire';
  light?: THREE.PointLight;
  /** Spells: the bolt's colour (sparks and light); enemy firebolts have none. */
  color?: string;
  element: Element;
  /** Ailments it can give, and whether its shooter was blind (half its hits miss). */
  inflicts?: Inflict[];
  blind?: boolean;
  /** Shot from this far away (for future stealth perks). */
  range: number;
  /** Shot by a party member (not the hero). */
  by?: AllyFighter;
  sneak: boolean;
}

interface Swing { t: number; dur: number; hit: boolean; dx: number; dz: number; combo: number; reach: number; damage: number; element: Element; inflicts?: Inflict[] }

export class Combat {
  readonly enemies: Enemy[] = [];
  /** The locked-on enemy (or something to break). */
  lock: Target | null = null;
  /** Things to break on this map (event pages marked breakable). */
  readonly breakables: Breakable[] = [];
  private readonly byBreakable = new Map<EnemyEvent, { b: Breakable; page: EventPage }>();
  sneaking = false;
  /** Seconds the world stays frozen after a solid hit. */
  hitStop = 0;
  /** Camera shake amount (decays). */
  shake = 0;
  private host!: CombatHost;
  private readonly byEvent = new Map<EnemyEvent, Enemy>();
  /** Enemies already beaten on this visit to the map. */
  private readonly beaten = new Set<EnemyEvent>();
  private readonly projectiles: Projectile[] = [];
  private swing: Swing | null = null;
  private combo = 0;
  private comboWindow = 0;
  /** Seconds the bow stays in hand after a shot (the release animation), before going back on the back. */
  private bowHands = 0;
  private queued = false;
  private draw: { t: number } | null = null;
  /** Holding the guard up: seconds since it was raised. */
  private guard: number | null = null;
  private guardMesh: { pivot: THREE.Object3D; mat: THREE.MeshBasicMaterial } | null = null;
  private cast = 0;
  /** The hero can't be hurt (dodging, or just hit). */
  private invulnerable = 0;
  private hurtFlash = 0;
  private drawPosed = false;
  /** What the hero holds while fighting, and how long the casting glow lasts. */
  private held: Held | null = null;
  private castGlow = 0;
  private readonly fireColor = linearColor('#ff8a3a');
  /** Seconds since the hero last made a fighting noise. */
  private sinceNoise = 99;
  private noiseRadius = 0;
  private moving = false;
  private slash: { pivot: THREE.Object3D; mat: THREE.MeshBasicMaterial } | null = null;
  private readonly fireLights: THREE.PointLight[] = [];
  /** The hero's ailments and buffs. */
  readonly heroStatus = new StatusSet();
  private statusFx = 0;
  private handLight: THREE.PointLight | null = null;
  /** The readied shard's colour, converted once per colour. */
  private spellColor = { hex: '', color: new THREE.Color() };
  private textures: ReturnType<typeof makeTextures> | null = null;

  /** Start on a new map: drop everything from the last one. */
  attach(host: CombatHost): void {
    for (const e of this.enemies) e.remove();
    this.enemies.length = 0;
    this.byEvent.clear();
    this.breakables.length = 0;
    this.byBreakable.clear();
    this.beaten.clear();
    for (const p of this.projectiles) this.dropProjectile(p, false);
    this.projectiles.length = 0;
    this.lock = null;
    this.swing = null; this.draw = null; this.cast = 0; this.queued = false;
    this.host = host;
    host.overlay.clear();
    this.textures ??= makeTextures();
    // The slash arc, laid flat in front of the hero.
    const mat = new THREE.MeshBasicMaterial({ map: this.textures.slash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    const pivot = new THREE.Object3D();
    pivot.add(mesh);
    pivot.visible = false;
    host.level.add(pivot);
    this.slash = { pivot, mat };
    this.held = new Held(host.level);
    // The guard: a curved band in front of the hero while blocking.
    const gmat = new THREE.MeshBasicMaterial({ map: this.textures.guard, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
    const gmesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), gmat);
    gmesh.rotation.x = -Math.PI / 2;
    const gpivot = new THREE.Object3D();
    gpivot.add(gmesh);
    gpivot.visible = false;
    host.level.add(gpivot);
    this.guardMesh = { pivot: gpivot, mat: gmat };
    this.guard = null;
    // Two lights for firebolts, always there (adding lights later would make every material recompile).
    this.fireLights.length = 0;
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(linearColor('#ff8a3a'), 0, 4.5, 2);
      host.level.add(l);
      this.fireLights.push(l);
    }
    // Out-of-sight copies of the bolt and arrow materials, so their shaders are built with the map (the game warms
    // shaders up after loading) instead of stuttering the first time one is shot.
    const t = this.textures;
    for (const mat of [
      new THREE.MeshBasicMaterial({ map: t.bolt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      new THREE.MeshBasicMaterial({ map: t.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      new THREE.MeshBasicMaterial({ map: t.arrow, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
    ]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), mat);
      w.position.set(0, -500, 0);
      w.frustumCulled = true;
      host.level.add(w);
    }
    // The light of a readied spell shard, in its colour.
    this.handLight = new THREE.PointLight(this.fireColor, 0, 3, 2);
    host.level.add(this.handLight);
  }

  get locked(): boolean { return !!this.lock; }
  get dodging(): boolean { return this.host?.motion.dashing && this.invulnerable > 0; }
  get busy(): boolean { return !!this.swing || !!this.draw || this.cast > 0 || this.guard !== null; }
  get blocking(): boolean { return this.guard !== null; }

  /** Spawn enemies for event pages that are enemies (and remove ones whose page changed); the same for breakables. */
  syncEvents(events: readonly EnemyEvent[]): void {
    for (const ev of events) {
      const page = ev.page, have = this.byBreakable.get(ev);
      if (have && have.page !== page) {
        this.breakables.splice(this.breakables.indexOf(have.b), 1);
        this.byBreakable.delete(ev);
        if (this.lock === have.b) this.lock = null;
      }
      if (!page?.breakable || page.enemy || this.byBreakable.has(ev) || !('broken' in ev)) continue;
      const b = new Breakable(ev as unknown as BreakableEvent, page.breakable, this.host.map);
      this.breakables.push(b);
      this.byBreakable.set(ev, { b, page });
    }
    for (const ev of events) {
      const id = ev.page?.enemy, have = this.byEvent.get(ev);
      if (have && (have.def.id !== id || have.dead)) {
        if (!have.dead) { have.remove(); this.enemies.splice(this.enemies.indexOf(have), 1); }
        this.byEvent.delete(ev);
      }
      if (!id || this.byEvent.has(ev) || this.beaten.has(ev)) continue;
      const def = this.host.db.enemies?.find((d) => d.id === id);
      if (!def) continue;
      const e = new Enemy(def, ev, this.host.level, this.host.sprites, this.host.db, ev.x + ev.w / 2, ev.z + ev.h - 0.5, this.host.map);
      this.enemies.push(e);
      this.byEvent.set(ev, e);
    }
  }

  /** Is this event an enemy that's still fighting (so it isn't talked to or bumped into)? */
  isEnemyEvent(ev: EnemyEvent): boolean { return !!ev.page?.enemy; }

  /* ------------------------------------------------------------------ input */

  /**
   * The fighting keys. `space` is whether Space was pressed this frame: while locked on it dodges
   * (returns true when it was used), otherwise the caller jumps.
   */
  handleInput(i: Input, space: boolean, dx: number, dz: number): boolean {
    const h = this.host, m = h.motion;
    // Sneak: held (like Halo's crouch) or toggled, as the player chose in Settings → Gameplay.
    if (h.crouchHold()) { i.consume('sneak'); this.sneaking = i.isHeld('sneak'); }
    else if (i.consume('sneak')) { this.sneaking = !this.sneaking; h.notice(this.sneaking ? 'Sneaking' : 'Stopped sneaking'); }
    // Targeting: lock on / next target; release lets go.
    if (i.consume('lock')) { if (this.lock) { this.lock = null; h.sound('menuBack'); } }
    if (i.consume('target')) {
      if (this.lock) this.cycleTarget(1);
      else { this.lock = this.pickTarget(null); if (this.lock) h.sound('target'); else h.notice('Nothing to lock on to'); }
    }
    if (i.consume('targetPrev')) { if (this.lock) this.cycleTarget(-1); else this.lock = this.pickTarget(null); }
    const free = !m.airborne && !m.climbing && !m.swimming && !m.dashing && !m.crawling;
    let usedSpace = false;
    if (space && this.lock) {
      usedSpace = true;
      if (free) this.dodge(dx, dz);
    }
    // Block: hold to keep the guard up (not while attacking).
    const wantGuard = i.isHeld('block') && free && !this.swing && !this.draw && this.cast <= 0;
    if (wantGuard && this.guard === null) { this.guard = 0; h.sound('guard'); }
    else if (!wantGuard) this.guard = null;

    // Weapons: switch between the sword and the bow (Y), then attack with the one selected (the trigger). The
    // keyboard's 1 / 2 pick one and use it at once. Spells are their own button (B, F, or 3): cast between attacks.
    if (this.weapon === 'magic') this.weapon = 'melee';
    if (i.consume('switchWeapon')) this.switchWeapon();
    let use: WeaponMode | null = null;
    for (const w of ARMS) if (i.consume(w)) { if (this.available(w)) { this.select(w); use = w; } else this.whyNot(w); }
    // A spell pressed mid-swing waits (briefly) for the swing to end, so sword-then-spell combos flow.
    const pressed = i.consume('magic');
    if (pressed || this.castQueued > 0) { use = this.available('magic') ? 'magic' : null; if (!use && pressed) this.whyNot('magic'); }
    if (pressed && use) this.castQueued = Math.max(this.castQueued, 0.5);
    if (i.consume('attack')) use = this.weapon;
    const held = i.isHeld(this.weapon) || i.isHeld('attack');

    if (use === 'melee' && free && this.guard === null) {
      if (this.swing) this.queued = true; else this.startSwing();
    }
    // The bow: hold to draw, let go to shoot.
    if (use === 'bow' && free && !this.swing && !this.draw && this.guard === null) {
      if (!h.inventory.arrow()) h.notice('No arrows');
      else if (this.available('bow')) { this.draw = { t: 0 }; h.sound('draw'); }
      else this.whyNot('bow');
    }
    if (this.draw && (!held || this.weapon !== 'bow' || !free)) {
      if (free && this.draw.t >= 0.12) this.shootArrow(Math.min(1, this.draw.t / this.drawTime));
      this.draw = null;
    }
    if (use === 'magic' && free && !this.swing && !this.draw && this.cast <= 0 && this.guard === null) {
      if (this.available('magic')) this.castSpell(); else this.whyNot('magic');
      this.castQueued = 0;
    }
    return usedSpace;
  }

  private readonly warnedUntrained = new Set<string>();

  /** Something held in the hand instead of a weapon (a fishing rod while fishing), tilted 0 … 1. */
  holding: { icon: HTMLCanvasElement; tilt: number } | null = null;

  /** The tip of what's held (a rod's tip), once it's shown. */
  holdTip(): THREE.Vector3 | null { return this.holding && this.held ? this.held.tip() : null; }

  /** The weapon the attack button uses (shown on the HUD). */
  weapon: WeaponMode = 'melee';
  /** Bumped on every switch, so the HUD can play its swap animation. */
  switches = 0;

  /** Can this weapon be used right now (a bow equipped, Fire learned)? */
  available(w: WeaponMode): boolean {
    if (w === 'bow') return this.equipped('ranged')?.weapon?.class === 'bow';
    if (w === 'magic') return !!this.spell() && !this.heroStatus.silenced;
    return true;
  }

  private whyNot(w: WeaponMode): void {
    this.host.notice(w === 'bow' ? 'No bow equipped: put one on in Menu → Equipment' : this.spell() && this.heroStatus.silenced ? 'Silenced: can’t cast spells' : 'No spell shard equipped: put one in the magic slot in Menu → Equipment');
  }

  private select(w: WeaponMode): void {
    if (this.weapon === w) return;
    this.weapon = w;
    this.switches++;
    this.draw = null;
  }

  /** Cast the readied spell shard's bolt (the spell button: B, F); it goes off on the next update, between attacks. */
  castShard(): void {
    if (!this.available('magic')) { this.whyNot('magic'); return; }
    this.castQueued = 0.5;
  }
  /** Seconds a pressed spell waits for the hero to be free (after a swing or a draw). */
  private castQueued = 0;

  /** Y / R: the other weapon (sword or bow), if it can be used. */
  switchWeapon(): void {
    const start = Math.max(0, ARMS.indexOf(this.weapon));
    for (let k = 1; k <= ARMS.length; k++) {
      const w = ARMS[(start + k) % ARMS.length];
      if (w === this.weapon) break;
      if (this.available(w)) { this.select(w); this.host.sound('menuMove'); return; }
    }
    this.host.notice('Nothing else to switch to: equip a bow (spells are cast with their own button: B or F)');
  }


  /** How fast the hero can move right now (slower while swinging, drawing or casting). */
  get speedScale(): number { return (this.draw ? 0.45 : this.swing ? 0.35 : this.guard !== null ? 0.4 : this.cast > 0 ? 0.5 : 1) * this.heroStatus.speed; }
  /** Frozen, paralysed, asleep or staggered: the hero can't move or act. */
  get heroStunned(): boolean { return this.heroStatus.stunned; }

  /** Seconds for a full bow draw (Steady Draw makes it quicker). */
  private get drawTime(): number { return this.host.cfg.bow.drawTime / (1 + this.host.skills.get('drawSpeed') / 100) / speedMultiplier(this.host.hero().attrs.dex) / this.heroStatus.speed; }
  /** Lock-on reach: further with a bow (Eagle Eye adds more). */
  private get lockReach(): number {
    const h = this.host;
    return this.equipped('ranged')?.weapon?.class === 'bow' ? Math.max(h.cfg.lockRange, h.cfg.bow.lockRange * (1 + h.skills.get('bowRange') / 100)) : h.cfg.lockRange;
  }

  /** After the hero moved this frame (for how much noise they make). */
  setMoving(moving: boolean): void { this.moving = moving; }

  /* ------------------------------------------------------------------ attacks */

  /** The spell shard in the magic slot (with its spell), if any. */
  spell(): (ItemDef & { spell: NonNullable<ItemDef['spell']> }) | undefined {
    const d = this.equipped('magic');
    return d?.spell ? (d as ItemDef & { spell: NonNullable<ItemDef['spell']> }) : undefined;
  }

  private equipped(slot: EquipSlot): ItemDef | undefined {
    const id = this.host.inventory.equip[slot];
    return id ? this.host.items.get(id) : undefined;
  }

  /** Where an attack goes: at the locked target, or a nearby enemy roughly ahead, or straight ahead. */
  private aim(reach: number): [number, number] {
    const p = this.host.player.position;
    if (this.lock) return norm(this.lock.x - p.x, this.lock.z - p.z);
    const [fx, fz] = DIR_VECTOR[this.host.player.dir];
    let best: Target | null = null, bestD = reach + 0.6;
    for (const e of this.targets()) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.5) { best = e; bestD = d; }
    }
    return best ? norm(best.x - p.x, best.z - p.z) : [fx, fz];
  }

  private startSwing(): void {
    const h = this.host, w = this.equipped('weapon');
    const cls = w?.weapon && w.weapon.class !== 'bow' ? w.weapon.class : 'unarmed';
    const t = h.cfg.classes[cls];
    if (this.comboWindow <= 0) this.combo = 0;
    this.combo = (this.combo % 3) + 1;
    const base = cls === 'unarmed' ? h.cfg.unarmedDamage : w!.weapon!.damage;
    const sk = h.skills;
    const hero = h.hero().attrs;
    // Untrained with this kind of weapon (Might tree): slow, heavy swings.
    const untrained = cls !== 'unarmed' && h.proficient?.(cls) === false;
    if (untrained && !this.warnedUntrained.has(cls)) { this.warnedUntrained.add(cls); h.notice(`Untrained with ${cls} weapons: slow swings until you learn them (Skill Tree → Might)`); }
    const speed = t.speed * (1 + (sk.get('swingSpeed') + (cls === 'unarmed' ? 0 : sk.get(`${cls}Speed` as 'lightSpeed'))) / 100) * speedMultiplier(hero.dex) * this.heroStatus.speed * (untrained ? 0.6 : 1);
    const bonus = (1 + (sk.get('meleeDamage') + (cls === 'unarmed' ? 0 : sk.get(`${cls}Damage` as 'lightDamage'))) / 100) * powerMultiplier(hero.str);
    const [dx, dz] = this.aim(t.reach);
    this.swing = { t: 0, dur: SWING_TIME / speed * (this.combo === 3 ? 1.25 : 1), hit: false, dx, dz, combo: this.combo, reach: t.reach, damage: base * t.damage * bonus * (this.combo === 3 ? 1.3 : 1), element: (cls === 'unarmed' ? undefined : w?.element) ?? 'neutral', inflicts: cls === 'unarmed' ? undefined : w?.inflicts };
    h.player.faceVector(dx, dz);
    // Animated sheets: a slash, the other way on the second hit of a combo, and a big backswing to finish
    // (heavy weapons always swing the big one).
    // Off the back and into the hand first, so the swing shows the weapon from its first frame.
    this.updateBack();
    for (const a of this.swingAnims(cls)) if (h.player.play(a, this.swing.dur)) break;
    h.sound(cls === 'heavy' ? 'swingHeavy' : 'swing');
    this.makeNoise(4);
  }

  /**
   * Which animations to try for this swing, best first. Plain: a slash, the other way on the second hit, a big
   * backswing to finish (heavy weapons always swing big). A weapon sprite only has some: a spear-like weapon thrusts,
   * one drawn swinging backwards (a club) reverses the slash.
   */
  private swingAnims(cls: string): string[] {
    const plain = cls === 'heavy' || this.combo === 3 ? ['backslash', 'slash'] : this.combo === 2 ? ['halfslash', 'slash'] : ['slash'];
    const id = itemWeaponSprite(this.equipped('weapon')), w = id && this.host.player.animated && this.host.sprites.weapon(id) ? this.host.sprites.weaponDef(id) : undefined;
    if (!w) return plain;
    const has = (a: string) => w.anims.includes(a);
    const combo: string[][] = [
      ['slash', 'slash_reverse', 'thrust'],
      ['halfslash', 'slash_reverse', 'thrust', 'slash'],
      ['backslash', 'thrust', 'slash_reverse', 'slash'],
    ];
    const pick = (cls === 'heavy' ? combo[2] : combo[this.combo - 1]).filter(has);
    return [...pick, ...plain];
  }

  private updateSwing(dt: number): void {
    const s = this.swing, h = this.host;
    if (!s) { this.comboWindow -= dt; return; }
    s.t += dt;
    const k = s.t / s.dur, p = h.player.position;
    // The arc sweeps across in front of the hero during the active part of the swing.
    if (this.slash) {
      const { pivot, mat } = this.slash;
      pivot.visible = k > 0.2 && k < 0.75;
      // An enchanted (or elemental) weapon's arc takes its element's colour.
      mat.color.set(s.element && s.element !== 'neutral' ? ELEMENT_COLORS[s.element] : '#ffffff');
      pivot.position.set(p.x, p.y + 0.45, p.z);
      const sweep = (k - 0.45) * 1.6 * (s.combo === 2 ? -1 : 1);
      pivot.rotation.y = Math.atan2(-s.dx, -s.dz) + sweep;
      const r = s.reach * 1.9;
      pivot.scale.set(r, 1, r);
      mat.opacity = pivot.visible ? 0.75 * (1 - Math.abs(k - 0.45) * 2.2) : 0;
    }
    if (!s.hit && k >= 0.38) {
      s.hit = true;
      let any = false;
      for (const e of this.targets()) {
        if (e.dead) continue;
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > s.reach + radiusOf(e) || Math.abs(e.y - p.y) > 0.9) continue;
        if (d > 0.35 && (dx * s.dx + dz * s.dz) / d < 0.25) continue;
        any = true;
        if (e instanceof Breakable) this.damageBreakable(e, s.damage, 'melee', s.element);
        else this.damageEnemy(e, s.damage, s.combo === 3 ? 4.5 : 2.6, false, 0, false, s.element, s.inflicts);
      }
      // A fire weapon lights a torch or fire in front of the hero.
      if (s.element === 'fire' && h.ignite?.(p.x + s.dx * s.reach * 0.7, p.y + 0.9, p.z + s.dz * s.reach * 0.7, s.reach * 0.6)) any = true;
      if (!any && this.equipped('weapon')) h.swingMissed?.();
      if (any) { this.hitStop = Math.max(this.hitStop, s.combo === 3 ? 0.09 : 0.06); this.shake = Math.max(this.shake, s.combo === 3 ? 0.12 : 0.06); }
    }
    if (k >= 1) {
      this.swing = null;
      if (this.slash) this.slash.pivot.visible = false;
      this.comboWindow = 0.45;
      if (this.queued) { this.queued = false; this.startSwing(); }
    }
  }

  private shootArrow(power: number): void {
    const h = this.host, bow = this.equipped('ranged'), arrowId = h.inventory.arrow();
    if (!bow?.weapon || !arrowId) return;
    const arrow = h.items.get(arrowId);
    h.inventory.spendArrow(arrowId);
    h.tally?.('arrows');
    const p = h.player.position, range = h.cfg.bow.lockRange * 1.1;
    const [dx, dz] = this.aim(0);
    const ty = this.lock ? this.lock.y + 0.6 : p.y + 0.7;
    const dist = this.lock ? Math.hypot(this.lock.x - p.x, this.lock.z - p.z) : range;
    const speed = h.cfg.bow.arrowSpeed * (0.55 + 0.45 * power);
    const damage = (bow.weapon.damage + (arrow?.ammo?.damage ?? 0)) * (0.35 + 0.65 * power) * (1 + h.skills.get('bowDamage') / 100) * powerMultiplier(h.hero().attrs.str);
    // Elemental arrows hit with their own element; plain ones with the bow's.
    this.launch('arrow', 'player', p.x + dx * 0.3, p.y + 0.7, p.z + dz * 0.3, dx, (ty - (p.y + 0.7)) / Math.max(1, dist), dz, speed, range, damage, undefined, (arrow?.element && arrow.element !== 'neutral' ? arrow.element : bow.element) ?? 'neutral', [...(bow.inflicts ?? []), ...(arrow?.inflicts ?? [])]);
    h.player.faceVector(dx, dz);
    // The release: the end of the shoot animation (its first part is the draw, held while aiming).
    h.player.play('shoot', 0.28, 9);
    this.bowHands = 0.32;
    h.sound('shoot');
    this.makeNoise(1.5);
  }

  /** Cast the equipped shard's spell: a bolt in its colour (speed and range default to Database → Combat's). */
  private castSpell(): void {
    const h = this.host, f = h.cfg.fire, shard = this.spell();
    if (!shard) return;
    // A field spell (Light, Water Walk) is switched on or off instead of hurled.
    if (shard.spell.power) { h.fieldSpell?.(); this.cast = 0.25; return; }
    // The Magic tree: cheaper (Mana Thrift), harder-hitting (Arcana, Empower) and further-flying (Far Cast) bolts.
    const sk = h.skills, thrift = 1 - Math.min(75, sk.get('spellCost')) / 100;
    const sp = shard.spell, mp = Math.round((sp.mp ?? f.mp) * thrift), speed = sp.speed || f.speed, range = (sp.range || f.range) * (1 + sk.get('spellRange') / 100);
    if (!h.stats.spendMp(mp)) { h.notice('Not enough MP'); return; }
    h.tally?.('spells');
    const p = h.player.position, [dx, dz] = this.aim(0);
    const ty = this.lock ? this.lock.y + 0.6 : p.y + 0.6;
    const dist = this.lock ? Math.hypot(this.lock.x - p.x, this.lock.z - p.z) : range;
    this.launch('fire', 'player', p.x + dx * 0.4, p.y + 0.65, p.z + dz * 0.4, dx, (ty - (p.y + 0.65)) / Math.max(1, dist), dz, speed, range, (sp.damage ?? f.damage) * powerMultiplier(h.hero().attrs.mag) * (1 + sk.get('spellDamage') / 100), sp.color || SPELL_DEFAULT_COLOR, shard.element ?? 'neutral', shard.inflicts);
    h.player.faceVector(dx, dz);
    h.player.play('spellcast', 0.42);
    this.cast = 0.28;
    this.castGlow = 0.7;
    h.sound('fire');
    this.makeNoise(3);
  }

  private dodge(dx: number, dz: number): void {
    const h = this.host, d = h.cfg.dodge;
    if (h.stats.exhausted || h.stats.sp <= 0) { h.notice('Too tired to dodge'); return; }
    // No direction held: hop back from the target.
    if (!dx && !dz && this.lock) [dx, dz] = norm(h.player.position.x - this.lock.x, h.player.position.z - this.lock.z);
    if (!dx && !dz) [dx, dz] = DIR_VECTOR[h.player.dir].map((v) => -v) as [number, number];
    if (!h.motion.dash(dx, dz, d.distance, d.time)) return;
    h.stats.change('sp', 'add', -d.cost);
    if (h.stats.sp <= 0) h.stats.exhausted = true;
    this.invulnerable = d.time + 0.05;
    this.guard = null;
    h.sound('dodge');
    this.swing = null; this.draw = null;
    if (this.slash) this.slash.pivot.visible = false;
  }

  /* ------------------------------------------------------------------ damage */

  private damageEnemy(e: Enemy, base: number, knock: number, ranged: boolean, range = 0, magic = false, element: Element = 'neutral', inflicts?: Inflict[], by?: AllyFighter): void {
    const h = this.host, sneak = !by && e.unaware, sk = h.skills, top0 = e.y + e.height;
    const fromX = by ? by.x : h.player.position.x, fromZ = by ? by.z : h.player.position.z;
    // Turn-based: the first blow starts a battle instead (catching it unawares gives the party the first turns).
    if (h.encounter?.(e, 'preemptive')) return;
    // Blind: half the hero's attacks miss.
    if (!by && this.heroStatus.blind && Math.random() < BLIND_MISS) {
      h.overlay.float('Miss', e.x, top0, e.z, 'info');
      h.sound('dodge', e.x, e.z);
      e.becomeAlert(h.player.position.x, h.player.position.z);
      return;
    }
    // Its elements: absorbed (heals it), immune (nothing), or weak / resisting.
    let el = elementResult(element, e.def);
    // A zombie can't absorb: the healing hurts it instead.
    if (el.kind === 'absorb' && e.status.zombie) el = { kind: 'hit', mult: 1, label: null };
    if (el.kind === 'immune') {
      h.overlay.float('Immune', e.x, top0, e.z, 'info');
      h.sound('block', e.x, e.z);
      h.log(`${e.def.name} is immune to ${ELEMENT_NAMES[element].toLowerCase()}`, 'hit');
      e.becomeAlert(h.player.position.x, h.player.position.z);
      return;
    }
    let dmg = base * (0.9 + Math.random() * 0.2);
    if (el.kind === 'absorb') {
      const heal = mitigate(dmg, 0);
      e.heal(heal);
      h.overlay.float(`+${heal}`, e.x, top0, e.z, 'heal');
      h.overlay.float('Absorbed', e.x, top0 + 0.35, e.z, 'info');
      h.sound('ringOn', e.x, e.z);
      h.log(`${e.def.name} absorbs it and heals ${heal}`, 'hit');
      e.becomeAlert(h.player.position.x, h.player.position.z);
      return;
    }
    dmg *= el.mult;
    if (sneak) dmg *= h.cfg.sneakMultiplier + sk.get('sneakDamage');
    // A critical hit: base 5%, more from gear and skills.
    const crit = Math.random() * 100 < (by ? by.crit : h.hero().crit);
    if (crit) dmg *= CRIT_MULTIPLIER;
    dmg = mitigate(dmg, (magic ? e.def.magicDefense ?? e.def.defense : e.def.defense) ?? 0);
    // Assassinate: a sneak attack finishes an ordinary enemy.
    // (Zombies and the undead can't be killed outright.)
    const assassinated = sneak && sk.has('assassinate') && !e.def.boss && !e.status.zombie && dmg < e.hp;
    if (assassinated) dmg = Math.ceil(e.hp);
    const killed = e.hurt(dmg, fromX, fromZ, knock);
    if (!by) { h.tally?.('damageDealt', dmg); h.tally?.('bestHit', dmg, true); }
    if (crit && !by) h.tally?.('crits');
    if (sneak) h.tally?.('sneakAttacks');
    e.status.hurt();
    if (!killed) this.inflictOn(e, inflicts);
    const top = e.y + e.height;
    h.overlay.float(String(dmg), e.x, top, e.z, sneak || crit ? 'crit' : 'dmg', element !== 'neutral' ? ELEMENT_COLORS[element] : undefined);
    const words = [sneak ? (assassinated ? 'Assassinated!' : 'Sneak attack!') : crit ? 'Critical!' : '', el.label ?? ''].filter(Boolean).join(' ');
    if (words) h.overlay.float(words, e.x, top + 0.35, e.z, 'info');
    h.log(assassinated ? `You assassinate ${e.def.name}` : `${sneak ? 'Sneak attack! ' : crit ? 'Critical! ' : ''}${el.label === 'Weak!' ? 'Super effective! ' : el.label === 'Resist' ? 'Resisted: ' : ''}${by ? `${by.name} hits` : 'You hit'} ${e.def.name} for ${dmg}`, 'hit');
    h.sound(sneak || crit ? 'crit' : 'hit', e.x, e.z);
    // A weakness hit lands extra hard: its own sound on top, a bigger shake and a burst in the element's colour.
    if (el.label === 'Weak!') {
      h.sound('weak', e.x, e.z);
      this.shake = Math.max(this.shake, 0.14);
      this.hitStop = Math.max(this.hitStop, 0.08);
      h.bursts.spawn(e.x, e.y + 0.55, e.z, { color: ELEMENT_COLORS[element], n: 16, speed: 3, up: 2, life: 0.45, size: 0.09, additive: true });
    }
    h.bursts.spawn(e.x, e.y + 0.5, e.z, { color: '#fff4d0', n: 8, speed: 2.4, up: 1.5, life: 0.3, size: 0.07, additive: true });
    // The fight is heard: friends nearby join in (a ranged kill out of nowhere only makes them look).
    for (const o of this.enemies) {
      if (o === e || o.dead) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z);
      // An arrow out of nowhere only makes them look (Silent Shot: from 5+ tiles, not even that).
      if (killed && ranged && sneak) { if (d < 5 && !(sk.has('silentShot') && range >= 5)) o.disturb(e.x, e.z, 0.5); }
      else if (d < 7) o.becomeAlert(fromX, fromZ);
    }
    if (killed) this.enemyDown(e);
  }

  /** A party member's melee hit on an enemy. */
  allyStrike(by: AllyFighter, e: Enemy, damage: number, element: Element = 'neutral', inflicts?: Inflict[]): void {
    if (e.dead) return;
    this.damageEnemy(e, damage, 2.2, false, 0, false, element, inflicts, by);
  }

  /** A party member's arrow or spell, aimed at a point. */
  allyShoot(by: AllyFighter, kind: 'arrow' | 'fire', tx: number, ty: number, tz: number, damage: number, color?: string, element: Element = 'neutral', inflicts?: Inflict[]): void {
    const dx = tx - by.x, dz = tz - by.z, d = Math.hypot(dx, dz) || 1;
    const y = by.y + (kind === 'fire' ? 0.6 : 0.7);
    this.launch(kind, 'player', by.x + (dx / d) * 0.3, y, by.z + (dz / d) * 0.3, dx, (ty - y) / d, dz, kind === 'fire' ? this.host.cfg.fire.speed : this.host.cfg.bow.arrowSpeed * 0.9, d + 4, damage, color, element, inflicts);
    this.projectiles[this.projectiles.length - 1].by = by;
    this.host.sound(kind === 'fire' ? 'fire' : 'shoot', by.x, by.z);
  }

  /* ------------------------------------------------------------------ ailments */

  /** Roll a hit's ailments against an enemy. */
  private inflictOn(e: Enemy, inflicts: Inflict[] | undefined): void {
    for (const f of inflicts ?? []) {
      if (Math.random() * 100 >= f.chance) continue;
      const r = e.status.inflict(f.ailment, f.seconds);
      this.announce(r, f.ailment, e.x, e.y + e.height + 0.6, e.z, e.def.name);
    }
  }

  /** Roll an enemy hit's ailments against the hero. */
  private inflictOnHero(inflicts: Inflict[] | undefined): void {
    const h = this.host, p = h.player.position;
    this.heroStatus.setOwner({ resists: h.heroResists() });
    for (const f of inflicts ?? []) {
      if (Math.random() * 100 >= f.chance) continue;
      const r = this.heroStatus.inflict(f.ailment, f.seconds);
      this.announce(r, f.ailment, p.x, p.y + 1.9, p.z, null);
    }
  }

  private announce(r: ApplyResult, a: Ailment, x: number, y: number, z: number, who: string | null): void {
    const h = this.host, name = r === 'frozen' ? 'Frozen' : AILMENT_INFO[a].name;
    if (r === 'immune') { h.overlay.float(`No ${AILMENT_INFO[a].name.toLowerCase()}`, x, y, z, 'info'); return; }
    if (r === 'blocked') return;
    h.overlay.float(r === 'frozen' ? 'Frozen!' : name, x, y, z, 'info', effectColor(r === 'frozen' ? 'frozen' : a));
    if (r === 'applied' || r === 'frozen') h.log(`${who ?? 'You'} ${who ? 'is' : 'are'} ${STATUS_WORD[r === 'frozen' ? 'frozen' : a]}`, who ? 'hit' : 'hurt');
  }

  /** A confused enemy hits another. */
  private confusedHit(t: Enemy, damage: number, from: Enemy): void {
    const h = this.host;
    if (t.dead) return;
    const el = elementResult(enemyElement(from.def), t.def);
    if (el.kind === 'immune' || (el.kind === 'absorb' && !t.status.zombie)) return;
    const dmg = mitigate(damage * (el.kind === 'hit' ? el.mult : 1), (from.def.attackType === 'magic' ? t.def.magicDefense ?? t.def.defense : t.def.defense) ?? 0);
    const killed = t.hurt(dmg, from.x, from.z, 2);
    t.status.hurt();
    h.overlay.float(String(dmg), t.x, t.y + t.height, t.z, 'dmg');
    h.sound('hit', t.x, t.z);
    h.log(`${from.def.name} hits ${t.def.name} in confusion`, 'hit');
    if (killed) this.enemyDown(t);
  }

  /** An enemy beaten (by anything): the sound, it stays beaten for this visit, the lock moves on, rewards. */
  private enemyDown(e: Enemy): void {
    const h = this.host;
    h.sound('defeat', e.x, e.z);
    this.beaten.add(e.key as EnemyEvent);
    if (this.lock === e) this.lock = this.pickTarget(e, true);
    h.defeated(e);
  }

  /** Ailments and buffs run: burn and poison hurt, regeneration heals, and wisps of colour drift off the afflicted. */
  private updateStatuses(dt: number): void {
    const h = this.host, p = h.player.position, hs = this.heroStatus;
    this.statusFx -= dt;
    const fx = this.statusFx <= 0;
    if (fx) this.statusFx = 0.22;
    if (hs.list.length || hs.zombie) {
      const r = hs.tick(dt, h.stats.cfg.max.hp);
      if (r.hp) {
        h.stats.change('hp', 'add', r.hp);
        h.overlay.float(r.hp > 0 ? `+${r.hp}` : String(-r.hp), p.x, p.y + 1.3, p.z, r.hp > 0 ? 'heal' : 'hurt');
      }
      for (const id of r.expired) if (!id.startsWith('buff:')) h.overlay.float(`${effectName(id)} wore off`, p.x, p.y + 1.7, p.z, 'info');
      if (fx) this.wisps(hs, p.x, p.y, p.z);
    }
    h.stats.hpRegenBlocked = hs.noRegen;
    h.stats.zombie = hs.zombie;
    for (const e of this.enemies) {
      if (e.dead || !e.status.list.length) continue;
      const r = e.status.tick(dt, e.maxHp);
      if (r.hp < 0) {
        const dmg = Math.min(DAMAGE_CAP, -r.hp);
        h.overlay.float(String(dmg), e.x, e.y + e.height, e.z, 'dmg');
        if (e.dot(dmg)) { h.log(`${e.def.name} succumbs`, 'hit'); this.enemyDown(e); continue; }
      } else if (r.hp > 0) e.heal(r.hp);
      if (fx) this.wisps(e.status, e.x, e.y, e.z);
    }
  }

  private wisps(st: StatusSet, x: number, y: number, z: number): void {
    const a = st.list.find((e) => !e.id.startsWith('buff:'))?.id ?? (st.zombie ? 'zombie' : null);
    if (!a) return;
    const rise = a === 'burn' ? 1.6 : a === 'poison' || a === 'zombie' ? 0.8 : a === 'sleep' ? 0.5 : 0.3;
    this.host.bursts.spawn(x + (Math.random() - 0.5) * 0.4, y + 0.4 + Math.random() * 0.6, z, { color: effectColor(a), n: 2, speed: 0.3, up: rise, life: 0.6, size: 0.07, gravity: -0.6, additive: a !== 'poison' && a !== 'zombie' });
  }

  /** Everything the hero can hit: enemies and things to break. */
  private targets(): Target[] { return this.breakables.length ? [...this.enemies, ...this.breakables] : this.enemies; }

  /** A hit on something breakable: chips and a knock, "No effect" if this kind of attack can't hurt it. */
  private damageBreakable(b: Breakable, base: number, kind: HitKind, element: Element = 'neutral'): void {
    const h = this.host, top = b.y + b.height;
    if (!b.accepts(kind) || (b.def.needs && b.def.needs !== 'neutral' && b.def.needs !== element)) {
      h.overlay.float('No effect', b.x, top, b.z, 'info');
      h.sound('block', b.x, b.z);
      h.bursts.spawn(b.x, b.y + b.height * 0.5, b.z, { color: '#cfd6e6', n: 5, speed: 1.6, up: 1, life: 0.25, size: 0.05, additive: true });
      return;
    }
    const dmg = mitigate(base * (0.9 + Math.random() * 0.2), b.def.defense ?? 0);
    const broke = b.hurt(dmg);
    h.overlay.float(String(dmg), b.x, top, b.z, 'dmg');
    h.sound(broke ? 'break' : 'block', b.x, b.z);
    h.bursts.spawn(b.x, b.y + b.height * 0.45, b.z, { color: '#9a8a74', n: broke ? 26 : 8, speed: broke ? 3 : 2, up: broke ? 2.6 : 1.4, life: broke ? 0.7 : 0.35, size: broke ? 0.1 : 0.07, gravity: 6 });
    if (!broke) { h.log(`You hit ${b.name} for ${dmg}`, 'hit'); return; }
    h.log(`${b.name} breaks`, 'defeat');
    this.shake = Math.max(this.shake, 0.1);
    if (this.lock === b) this.lock = this.pickTarget(b, true);
    h.broken(b);
  }

  /** An enemy's attack reaching the hero (`from` is the attacker for melee, so a parry can stagger it). */
  hurtPlayer(damage: number, fromX: number, fromZ: number, from?: Enemy, what = 'An attack', magic = from?.def.attackType === 'magic', element: Element = from ? enemyElement(from.def) : 'neutral', inflicts: Inflict[] | undefined = from?.def.inflicts): void {
    const h = this.host, p = h.player.position;
    if (this.invulnerable > 0) {
      if (h.motion.dashing) { h.tally?.('dodges'); h.overlay.float('Dodged', p.x, p.y + 1.3, p.z, 'info'); h.log(`You dodge ${from ? `${from.def.name}’s attack` : 'the attack'}`, 'hit'); }
      return;
    }
    // The hero's elements: immune, absorbing (healed), or a multiplier.
    let el = elementResult(element, h.heroElements());
    if (el.kind === 'absorb' && this.heroStatus.zombie) el = { kind: 'hit', mult: 1, label: null };
    if (el.kind === 'immune') { h.overlay.float('Immune', p.x, p.y + 1.3, p.z, 'info'); h.sound('block', p.x, p.z); this.invulnerable = 0.2; return; }
    if (el.kind === 'absorb') {
      const heal = mitigate(damage, 0);
      h.stats.change('hp', 'add', heal);
      h.overlay.float(`+${heal}`, p.x, p.y + 1.3, p.z, 'heal');
      h.log(`You absorb ${from ? `${from.def.name}’s attack` : 'the attack'} and heal ${heal}`, 'hit');
      h.sound('ringOn', p.x, p.z);
      this.invulnerable = 0.2;
      return;
    }
    damage *= el.mult;
    let scale = 1;
    // Blocking: hits from the front are mostly stopped, for stamina. Raising the guard just in time parries.
    if (this.guard !== null) {
      const [fx, fz] = DIR_VECTOR[h.player.dir], [ax, az] = norm(fromX - p.x, fromZ - p.z);
      const front = this.lock ? (() => { const [lx, lz] = norm(this.lock.x - p.x, this.lock.z - p.z); return ax * lx + az * lz; })() : ax * fx + az * fz;
      if (front > 0.2) {
        const b = h.cfg.block;
        if (from && this.guard <= b.parry) {
          from.stagger(1.1);
          h.overlay.float('Parry!', p.x, p.y + 1.4, p.z, 'crit');
          h.log(`You parry ${from.def.name}`, 'hit');
          h.tally?.('parries');
          h.sound('parry', p.x, p.z);
          this.hitStop = Math.max(this.hitStop, 0.1);
          this.shake = Math.max(this.shake, 0.1);
          this.invulnerable = 0.25;
          return;
        }
        const cost = b.cost * (1 - Math.min(90, h.skills.get('blockStamina')) / 100);
        if (h.stats.sp >= cost) {
          h.stats.change('sp', 'add', -cost);
          scale = 1 - b.reduction;
          h.overlay.float('Blocked', p.x, p.y + 1.4, p.z, 'info');
          h.sound('block', p.x, p.z);
          const [kx, kz] = norm(p.x - fromX, p.z - fromZ);
          if (kx || kz) h.motion.dash(kx, kz, 0.25, 0.1);
          this.invulnerable = 0.2;
          if (scale <= 0) return;
          const dmg = mitigate(damage * scale, 0);
          h.stats.change('hp', 'add', -dmg);
          h.tally?.('damageTaken', dmg);
          h.overlay.float(String(dmg), p.x, p.y + 1.1, p.z, 'hurt');
          h.log(`You block ${from ? `${from.def.name}’s attack` : 'the attack'} (${dmg} gets through)`, 'hurt');
          return;
        }
        // Out of stamina: the guard breaks.
        h.stats.change('sp', 'set', 0); h.stats.exhausted = true;
        this.guard = null;
        h.overlay.float('Guard broken', p.x, p.y + 1.4, p.z, 'info');
        h.log('Your guard breaks: out of stamina', 'hurt');
      }
    }
    // Armour and the hero's Defence against hits; Magic Defence (and magic armour) against spells.
    const hero = h.hero();
    const dmg = mitigate(damage * scale * (0.9 + Math.random() * 0.2), magic ? hero.magicArmour : hero.armour);
    h.sound('hurt', p.x, p.z);
    h.stats.change('hp', 'add', -dmg);
    h.tally?.('damageTaken', dmg);
    this.heroStatus.hurt();
    if (h.stats.hp > 0) this.inflictOnHero(inflicts);
    h.overlay.float(String(dmg), p.x, p.y + 1.3, p.z, 'hurt');
    if (el.label) h.overlay.float(el.label, p.x, p.y + 1.65, p.z, 'info');
    if (el.label === 'Weak!') h.sound('weak', p.x, p.z);
    h.log(`${from ? from.def.name : what} hits you for ${dmg}${el.label === 'Weak!' ? ' (super effective)' : el.label === 'Resist' ? ' (resisted)' : ''}`, 'hurt');
    this.invulnerable = h.cfg.hurtGrace;
    this.hurtFlash = 0.25;
    // A flinch: the first frames of the hurt animation.
    h.player.play('hurt', 0.22, 0, undefined, 1);
    this.hitStop = Math.max(this.hitStop, 0.07);
    this.shake = Math.max(this.shake, 0.18);
    // Knocked back a step (interrupting any attack in progress).
    const [kx, kz] = norm(p.x - fromX, p.z - fromZ);
    if (kx || kz) h.motion.dash(kx, kz, 0.55, 0.14);
    this.swing = null; this.draw = null; this.guard = null;
    if (this.slash) this.slash.pivot.visible = false;
  }

  /* ------------------------------------------------------------------ projectiles */

  private launch(kind: 'arrow' | 'fire', from: 'player' | 'enemy', x: number, y: number, z: number, dx: number, dy: number, dz: number, speed: number, range: number, damage: number, color?: string, element: Element = 'neutral', inflicts?: Inflict[], blind = false): void {
    const h = this.host, t = this.textures!;
    let mesh: THREE.Object3D, light: THREE.PointLight | undefined;
    if (kind === 'arrow') {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.62), new THREE.MeshBasicMaterial({ map: from === 'player' ? t.arrow : t.enemyArrow, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      const pivot = new THREE.Object3D();
      pivot.add(m);
      pivot.rotation.y = Math.atan2(-dx, -dz);
      mesh = pivot;
    } else if (color) {
      // A spell: a glow in its colour round a white-hot core.
      const c = linearColor(color), g = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: t.bolt, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const core = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ map: t.bolt, color: new THREE.Color(1, 1, 1).lerp(c, 0.25), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.position.z = 0.01;
      g.add(outer, core);
      mesh = g;
      light = this.fireLights.find((l) => !this.projectiles.some((p) => p.light === l));
      light?.color.copy(c);
    } else {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: t.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      mesh = m;
      light = this.fireLights.find((l) => !this.projectiles.some((p) => p.light === l));
      light?.color.copy(this.fireColor);
    }
    mesh.position.set(x, y, z);
    h.level.add(mesh);
    const len = Math.hypot(dx, dz) || 1;
    this.projectiles.push({ mesh, x, y, z, vx: (dx / len) * speed, vy: dy * speed, vz: (dz / len) * speed, left: range, damage, from, kind, light, color, element, inflicts, blind, range: 0, sneak: false });
  }

  private updateProjectiles(dt: number): void {
    const h = this.host, m = h.map, p = h.player.position;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      const step = Math.hypot(pr.vx, pr.vz) * dt;
      // Move in small steps so fast arrows can't skip through a thin enemy.
      const n = Math.max(1, Math.ceil(step / 0.2));
      let done = false;
      for (let k = 0; k < n && !done; k++) {
        pr.x += (pr.vx * dt) / n; pr.y += (pr.vy * dt) / n; pr.z += (pr.vz * dt) / n;
        pr.range += step / n;
        const cx = Math.floor(pr.x), cz = Math.floor(pr.z);
        if (!m.inMap(cx, cz) || m.isSolid(cx, cz) || m.inBox(pr.x, pr.z) || m.standY(pr.x, pr.z) > pr.y) { this.impact(pr); done = true; break; }
        if (pr.from === 'player') {
          // Fire bolts and fire arrows light torches and fires that have gone out.
          if (pr.element === 'fire' && h.ignite?.(pr.x, pr.y, pr.z, 0.35)) { this.impact(pr); done = true; break; }
          for (const e of this.targets()) {
            if (e.dead) continue;
            if (Math.hypot(e.x - pr.x, e.z - pr.z) < radiusOf(e) + 0.12 && pr.y > e.y - 0.1 && pr.y < e.y + e.height + 0.1) {
              if (e instanceof Breakable) { if (!pr.by) this.damageBreakable(e, pr.damage, pr.kind === 'fire' ? 'magic' : 'bow', pr.element); else continue; }
              else this.damageEnemy(e, pr.damage, pr.kind === 'fire' ? 2 : 1.4, true, pr.range, pr.kind === 'fire', pr.element, pr.inflicts, pr.by);
              this.impact(pr);
              done = true;
              break;
            }
          }
        } else if (pr.from === 'enemy' && this.allyHitBy(pr)) {
          this.impact(pr);
          done = true;
        } else if (Math.hypot(p.x - pr.x, p.z - pr.z) < 0.32 && pr.y > p.y - 0.1 && pr.y < p.y + 1.3) {
          if (pr.blind && Math.random() < BLIND_MISS) h.overlay.float('Miss', p.x, p.y + 1.3, p.z, 'info');
          else this.hurtPlayer(pr.damage, pr.x - pr.vx * 0.1, pr.z - pr.vz * 0.1, undefined, pr.kind === 'arrow' ? 'An arrow' : 'A firebolt', pr.kind === 'fire', pr.element, pr.inflicts);
          this.impact(pr);
          done = true;
        }
      }
      if (done) { this.projectiles.splice(i, 1); continue; }
      pr.left -= step;
      if (pr.left <= 0) { this.dropProjectile(pr, true); this.projectiles.splice(i, 1); continue; }
      pr.mesh.position.set(pr.x, pr.y, pr.z);
      if (pr.light) { pr.light.position.set(pr.x, pr.y + 0.2, pr.z); pr.light.intensity = 2.2 + Math.sin(performance.now() / 40) * 0.4; }
      if (pr.kind === 'fire' && Math.random() < 0.5) h.bursts.spawn(pr.x, pr.y, pr.z, { color: pr.color ?? '#ff9a3a', n: 2, speed: 0.4, up: 0.6, life: 0.35, size: 0.08, gravity: -1, additive: true });
    }
    // Firebolt lights that aren't carrying a bolt go dark.
    for (const l of this.fireLights) if (!this.projectiles.some((pr) => pr.light === l)) l.intensity = 0;
  }

  /** An enemy's arrow or bolt reaching a party member. */
  private allyHitBy(pr: Projectile): boolean {
    for (const a of this.host.allies?.() ?? []) {
      if (a.down || Math.hypot(a.x - pr.x, a.z - pr.z) >= 0.32 || pr.y < a.y - 0.1 || pr.y > a.y + 1.3) continue;
      a.hurt(pr.damage, undefined, pr.kind === 'fire', pr.element);
      return true;
    }
    return false;
  }

  private impact(pr: Projectile): void {
    const h = this.host;
    h.sound(pr.kind === 'fire' ? 'fireHit' : 'arrowHit', pr.x, pr.z);
    if (pr.kind === 'fire') h.bursts.spawn(pr.x, pr.y, pr.z, { color: pr.color ?? '#ffb347', n: 18, speed: 2.4, up: 1.8, life: 0.5, size: 0.1, additive: true });
    else h.bursts.spawn(pr.x, pr.y, pr.z, { color: '#d8cbb0', n: 5, speed: 1.2, up: 1, life: 0.25, size: 0.05 });
    this.dropProjectile(pr, false);
  }

  private dropProjectile(pr: Projectile, fizzle: boolean): void {
    if (fizzle && pr.kind === 'fire') this.host?.bursts.spawn(pr.x, pr.y, pr.z, { color: pr.color ?? '#ff9a3a', n: 6, speed: 0.6, up: 0.6, life: 0.3, size: 0.08, gravity: -1, additive: true });
    pr.mesh.removeFromParent();
    pr.mesh.traverse((o) => {
      const mm = o as THREE.Mesh;
      mm.geometry?.dispose();
      (mm.material as THREE.Material | undefined)?.dispose?.();
    });
    if (pr.light) pr.light.intensity = 0;
  }

  /* ------------------------------------------------------------------ targets */

  /** The best enemy to lock on to (or the next one after `after` when cycling). */
  pickTarget(after: Target | null, alertOnly = false): Target | null {
    const h = this.host, p = h.player.position;
    const range = this.lockReach;
    const [fx, fz] = DIR_VECTOR[h.player.dir];
    const list = this.targets().filter((e) => !e.dead && e !== after && (!alertOnly || (e instanceof Enemy && e.alert))
      && Math.hypot(e.x - p.x, e.z - p.z) <= range
      && lineOfSight(h.map, p.x, p.y + 0.8, p.z, e.x, e.y + 0.6, e.z));
    const score = (e: Target) => { const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1; return d * (1.6 - (dx * fx + dz * fz) / d); };
    list.sort((a, b) => score(a) - score(b));
    return list[0] ?? null;
  }

  /** Tab / RB: the next target clockwise around the hero (LB: anticlockwise). */
  cycleTarget(dir: 1 | -1): void {
    const h = this.host, p = h.player.position, cur = this.lock;
    if (!cur) return;
    const range = this.lockReach;
    const angle = (e: Target) => Math.atan2(e.z - p.z, e.x - p.x);
    const a0 = angle(cur);
    const list = this.targets().filter((e) => !e.dead && e !== cur && Math.hypot(e.x - p.x, e.z - p.z) <= range
      && lineOfSight(h.map, p.x, p.y + 0.8, p.z, e.x, e.y + 0.6, e.z));
    if (!list.length) return;
    const delta = (e: Target) => { let d = (angle(e) - a0) * dir; while (d <= 0) d += Math.PI * 2; return d; };
    list.sort((a, b) => delta(a) - delta(b));
    this.lock = list[0];
    h.sound('target');
  }

  /* ------------------------------------------------------------------ frame */

  update(dt: number): void {
    if (this.castQueued > 0) this.castQueued = Math.max(0, this.castQueued - dt);
    const h = this.host, p = h.player.position, m = h.motion;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.cast = Math.max(0, this.cast - dt);
    this.sinceNoise += dt;
    this.shake = Math.max(0, this.shake - dt * 0.8);
    if (this.draw) {
      this.draw.t += dt;
      // Animated sheets: the bow drawn back over the first part of the shoot animation, held while aiming.
      h.player.hold('shoot', Math.min(8, Math.floor(Math.min(1, this.draw.t / this.drawTime) * 8)));
      this.drawPosed = true;
    } else if (this.drawPosed) { this.drawPosed = false; h.player.hold(null); }
    this.updateSwing(dt);
    if (this.guard !== null) this.guard += dt;
    if (this.guardMesh) {
      const g = this.guardMesh, on = this.guard !== null;
      g.pivot.visible = on;
      if (on) {
        const [dx, dz] = this.lock ? norm(this.lock.x - p.x, this.lock.z - p.z) : DIR_VECTOR[h.player.dir];
        g.pivot.position.set(p.x + dx * 0.25, p.y + 0.35, p.z + dz * 0.25);
        g.pivot.rotation.y = Math.atan2(-dx, -dz);
        g.mat.opacity = this.guard! <= h.cfg.block.parry ? 0.95 : 0.55;
      }
    }

    // The hero's flash when hurt; blinking while they can't be hurt again.
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    const mat = h.player.mesh.material as THREE.MeshStandardMaterial;
    const glow = h.glow();
    this.updateStatuses(dt);
    const ail = this.heroStatus.list.find((e) => !e.id.startsWith('buff:'));
    if (this.hurtFlash > 0) { mat.emissive.setRGB(1, 0.2, 0.15); mat.emissiveIntensity = this.hurtFlash * 4; }
    else if (glow) { mat.emissive.copy(glow.color); mat.emissiveIntensity = glow.amount; }
    else if (ail) { mat.emissive.set(effectColor(ail.id)); mat.emissiveIntensity = (ail.id === 'frozen' ? 0.55 : 0.25) + Math.sin(performance.now() / 200) * 0.07; }
    else mat.emissiveIntensity = 0;
    // Can't act: an attack under way is lost.
    if (this.heroStatus.stunned) { this.swing = null; this.draw = null; this.guard = null; if (this.slash) this.slash.pivot.visible = false; }
    this.updateHeld(dt);
    h.player.mesh.visible = !(this.invulnerable > 0 && !m.dashing && Math.floor(this.invulnerable * 20) % 2 === 1);

    // Lose a target that's too far, hidden or beaten.
    if (this.lock) {
      const range = this.lockReach * 1.3;
      if (this.lock.dead || Math.hypot(this.lock.x - p.x, this.lock.z - p.z) > range) this.lock = this.lock.dead ? this.pickTarget(this.lock, true) : null;
    }

    const world: EnemyWorld = {
      map: h.map, px: p.x, py: p.y, pz: p.z,
      visibility: this.visibility(),
      noise: this.noise(),
      lit: h.heroLit?.() ?? 0,
      safe: h.safeZones?.() ?? [],
      blockedAt: (x, z) => h.solidEventAt(x, z),
      hurtPlayer: (d, x, z, from) => {
        if (from && h.encounter?.(from, this.behind(x, z) ? 'ambush' : 'normal')) return;
        if (from?.status.blind && Math.random() < BLIND_MISS) { h.overlay.float('Miss', p.x, p.y + 1.3, p.z, 'info'); return; }
        this.hurtPlayer(d, x, z, from);
      },
      hurtEnemy: (t, d, from) => this.confusedHit(t, d, from),
      shoot: (e, tx, ty, tz) => {
        if (h.encounter?.(e, 'normal')) return;
        const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
        // Casters throw firebolts (stopped by Magic Defence); the rest shoot arrows.
        const magic = e.def.attackType === 'magic';
        this.launch(magic ? 'fire' : 'arrow', 'enemy', e.x + (dx / d) * 0.3, e.y + 0.75, e.z + (dz / d) * 0.3, dx, (ty - (e.y + 0.75)) / d, dz, magic ? 9 : 11, e.def.sight * 1.3, e.def.damage, undefined, enemyElement(e.def), e.def.inflicts, e.status.blind);
      },
      others: this.enemies,
    };
    // Each enemy goes after the nearest of the party (the hero, or a party member still standing).
    const allies = (h.allies?.() ?? []).filter((a) => !a.down);
    const heroHurt = world.hurtPlayer;
    for (const e of this.enemies) {
      let best: AllyFighter | null = null, bd = Math.hypot(e.x - p.x, e.z - p.z);
      for (const a of allies) { const d = Math.hypot(e.x - a.x, e.z - a.z); if (d < bd - 0.5) { bd = d; best = a; } }
      if (best) {
        const a = best;
        world.px = a.x; world.py = a.y; world.pz = a.z;
        world.hurtPlayer = (d, _x, _z, from) => {
          if (from && h.encounter?.(from, 'normal')) return;
          if (from?.status.blind && Math.random() < BLIND_MISS) { h.overlay.float('Miss', a.x, a.y + 1.3, a.z, 'info'); return; }
          a.hurt(d, from, from?.def.attackType === 'magic', from ? enemyElement(from.def) : 'neutral');
        };
      } else { world.px = p.x; world.py = p.y; world.pz = p.z; world.hurtPlayer = heroHurt; }
      e.update(dt, world);
    }
    world.px = p.x; world.py = p.y; world.pz = p.z; world.hurtPlayer = heroHurt;
    for (const b of this.breakables) b.update(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].gone) this.enemies.splice(i, 1);
    this.updateProjectiles(dt);
    this.updateOverlay();
  }

  /** Show the weapon in the hero's hand while swinging or drawing, and runes while casting. */
  private updateHeld(dt: number): void {
    const hd = this.held, h = this.host;
    if (!hd) return;
    const p = h.player.position, dir = h.player.dir;
    // Weapons with an LPC sprite are drawn by the hero's own animation; the rest show their icon.
    const drawn = h.player.weaponIds;
    const sprite = (slot: EquipSlot) => { const id = itemWeaponSprite(this.equipped(slot)); return !!id && drawn.includes(id); };
    if (this.holding) hd.hold(this.holding.icon, p, dir, this.holding.tilt);
    else if (this.swing && !sprite('weapon')) hd.swing(h.iconCanvas(h.inventory.equip.weapon, 'fist'), p, dir, this.swing.t / this.swing.dur);
    else if (this.draw && !sprite('ranged')) hd.bow(h.iconCanvas(h.inventory.equip.ranged, 'bow'), p, dir, Math.min(1, this.draw.t / this.drawTime));
    else hd.hideItem();
    this.castGlow = Math.max(0, this.castGlow - dt);
    this.bowHands = Math.max(0, this.bowHands - dt);
    // Magic: the hands glow in the spell's colour only while casting (the readied shard shows on the HUD).
    const shard = this.spell();
    const amount = Math.min(1, this.castGlow / 0.4);
    const hex = shard?.spell.color || SPELL_DEFAULT_COLOR;
    if (this.spellColor.hex !== hex) this.spellColor = { hex, color: linearColor(hex) };
    hd.cast(p, dir, this.spellColor.color, amount, dt);
    const L = this.handLight;
    if (L) {
      const li = shard?.spell.light, on = amount > 0.01 && (li?.intensity ?? 1) > 0;
      L.intensity = on ? (li?.intensity ?? 1) * (0.55 + amount * 0.9) * (0.92 + Math.sin(performance.now() / 70) * 0.08) : 0;
      if (on) {
        L.color.copy(this.spellColor.color);
        L.distance = Math.max(1, li?.radius ?? 3);
        L.position.set(p.x, p.y + 0.75, p.z + 0.25);
      }
    }
  }

  /**
   * The readied weapon slung on the hero's back: the sword with melee chosen, the bow with the bow chosen (nothing
   * with magic, where the hands glow instead). It leaves the back while it's in the hand. Runs every frame, cutscenes
   * and menus included, so it follows the hero wherever events move them.
   */
  updateBack(): void {
    const hd = this.held, h = this.host;
    if (!hd || !h) return;
    if (!h.player.mesh.visible || h.motion.swimming) { hd.hideBack(); h.player.setWeapons([]); return; }
    // The weapon comes off the back only to fight: swinging (and between the hits of a combo), guarding, drawing
    // and loosing the bow. Animated heroes then hold its LPC sprite (with the shield, for melee); otherwise the icon
    // swings at the hand. The rest of the time it's slung on the back, where walking, running and jumping can't
    // make it look out of step.
    const meleeHands = this.weapon === 'melee' && (!!this.swing || this.comboWindow > 0 || this.guard !== null);
    const bowHands = this.weapon === 'bow' && (!!this.draw || this.bowHands > 0);
    const carry: CarriedWeapon[] = [];
    if (h.player.animated) {
      const add = (slot: EquipSlot) => {
        const item = this.equipped(slot), id = itemWeaponSprite(item), w = h.sprites.weapon(id);
        if (!w) return;
        // The item's glow and swing trail, drawn with the sheet's soft silhouette.
        const fx = item?.glow || item?.trail;
        carry.push({ ...w, glow: item?.glow, trail: item?.trail, mask: fx ? h.sprites.weaponMask(id) : null });
      };
      if (meleeHands) { add('shield'); add('weapon'); }
      else if (bowHands && this.available('bow')) add('ranged');
    }
    h.player.setWeapons(carry);
    const shown = h.player.weaponIds;
    const has = (slot: EquipSlot) => { const id = itemWeaponSprite(this.equipped(slot)); return !!id && shown.includes(id); };
    const sword = this.weapon === 'melee' && this.equipped('weapon') && !this.swing && !has('weapon');
    const bow = this.weapon === 'bow' && this.equipped('ranged')?.weapon?.class === 'bow' && !this.draw && !has('ranged');
    const shield = this.equipped('shield') && !has('shield');
    hd.back(
      sword ? h.iconCanvas(h.inventory.equip.weapon, 'sword') : null,
      bow ? h.iconCanvas(h.inventory.equip.ranged, 'bow') : null,
      h.player.position, h.player.dir,
      shield ? h.iconCanvas(h.inventory.equip.shield, 'shield') : null,
      // The quiver goes with the bow (readied), and stays on while shooting.
      this.weapon === 'bow' && this.equipped('ranged')?.weapon?.class === 'bow',
    );
  }

  /** How visible the hero is: light where they stand, halved while sneaking. */
  private visibility(): number {
    const h = this.host, p = h.player.position;
    return Math.max(0.15, Math.min(1, h.lightAt(p.x, p.z))) * (this.sneaking ? 0.5 * (1 - Math.min(80, h.skills.get('sneakHide')) / 100) : 1);
  }

  /** How far the hero can be heard, in tiles. */
  private noise(): number {
    const m = this.host.motion;
    const quiet = 1 - Math.min(90, this.host.skills.get('quietSteps')) / 100;
    let r = this.moving ? (m.running ? 6 : this.sneaking ? 0.9 * quiet : 2.6) : this.sneaking ? 0 : 0.6;
    if (m.swimming) r = Math.max(r, 3);
    if (this.sinceNoise < 0.8) r = Math.max(r, this.noiseRadius);
    return r;
  }

  private makeNoise(radius: number): void {
    this.sinceNoise = 0;
    this.noiseRadius = this.sneaking ? radius * 0.6 : radius;
  }

  private updateOverlay(): void {
    const h = this.host, o = h.overlay, p = h.player.position;
    o.beginTags();
    for (const e of this.enemies) {
      o.tag(e, e.x, e.y + e.height + 0.15, e.z, { hp: e.hp, max: e.maxHp, awareness: e.awareness, alert: e.alert, alertAge: e.alertAge, locked: e === this.lock, name: e.def.name, dead: e.dead, elements: e.def.elements?.slice(0, 2).map(elementIconUrl),
        status: e.status.list.length ? e.status.list.filter((x) => !x.id.startsWith('buff:')).map((x) => statusIconUrl(x.id)) : e.def.undead ? [statusIconUrl('zombie')] : undefined });
    }
    // Breakables show their health once hit (or when locked on).
    for (const b of this.breakables) {
      const show = !b.dead && (b.hp < b.maxHp || b === this.lock);
      o.tag(b, b.x, b.y + b.height + 0.15, b.z, { hp: b.hp, max: b.maxHp, awareness: 0, alert: false, alertAge: 99, locked: b === this.lock, name: b.name, dead: !show });
    }
    o.endTags();
    o.meter(p.x, p.y - 0.05, p.z, this.draw ? this.draw.t / this.drawTime : null);
    if (!this.sneaking) { o.stealth(null); o.hidden(0); }
    else {
      const live = this.enemies.filter((e) => !e.dead);
      const state = live.some((e) => e.alert) ? 'detected' : live.some((e) => e.awareness >= SUSPICIOUS) ? 'noticed' : 'hidden';
      o.stealth(state);
      // The screen's edges darken the better hidden the hero is (in shadow, sneaking); seen, it lifts.
      const hide = Math.max(0, Math.min(1, (0.9 - this.visibility()) / 0.75));
      o.hidden(state === 'detected' ? 0 : state === 'noticed' ? hide * 0.5 : hide);
    }
  }

  /** Stop everything at once (death, a cutscene starting is fine to leave). */
  /** Did a hit from (x, z) come from behind the hero? */
  private behind(x: number, z: number): boolean {
    const p = this.host.player.position, [fx, fz] = DIR_VECTOR[this.host.player.dir], [ax, az] = norm(x - p.x, z - p.z);
    return ax * fx + az * fz < -0.4;
  }

  /** Turn-based: beaten in a battle. It falls and fades on the map and stays beaten until the hero comes back. */
  beatenInBattle(e: Enemy): void {
    e.defeat();
    this.beaten.add(e.key as EnemyEvent);
    if (this.lock === e) this.lock = null;
  }

  reset(): void {
    this.swing = null; this.draw = null; this.cast = 0; this.lock = null; this.invulnerable = 0; this.hurtFlash = 0; this.guard = null; this.bowHands = 0;
    if (this.guardMesh) this.guardMesh.pivot.visible = false;
    this.held?.hide();
    if (this.handLight) this.handLight.intensity = 0;
    this.heroStatus.clear();
    if (this.slash) this.slash.pivot.visible = false;
    if (this.host) { this.host.player.mesh.visible = true; (this.host.player.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0; }
  }
}

function norm(x: number, z: number): [number, number] {
  const d = Math.hypot(x, z);
  return d ? [x / d, z / d] : [0, 0];
}

/** Textures drawn in code: the slash arc, arrows and the firebolt. */
function makeTextures(): { slash: THREE.Texture; arrow: THREE.Texture; enemyArrow: THREE.Texture; fire: THREE.Texture; bolt: THREE.Texture; guard: THREE.Texture } {
  const canvas = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  };
  // A crescent pointing up (towards local -z once laid flat).
  const slash = canvas(64, 64, (c) => {
    const g = c.createRadialGradient(32, 40, 10, 32, 40, 30);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.65, 'rgba(255,250,235,0.0)');
    g.addColorStop(0.82, 'rgba(255,250,235,0.95)');
    g.addColorStop(1, 'rgba(255,250,235,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(32, 40); c.arc(32, 40, 30, Math.PI * 1.12, Math.PI * 1.88); c.closePath(); c.fill();
  });
  const arrowTex = (shaft: string, head: string) => canvas(8, 32, (c) => {
    c.fillStyle = shaft; c.fillRect(3, 6, 2, 22);
    c.fillStyle = head; c.beginPath(); c.moveTo(4, 0); c.lineTo(7, 7); c.lineTo(1, 7); c.closePath(); c.fill();
    c.fillStyle = '#e8e0d0'; c.fillRect(1, 25, 2, 6); c.fillRect(5, 25, 2, 6);
  });
  const fire = canvas(32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.3, 'rgba(255,190,80,0.95)');
    g.addColorStop(0.65, 'rgba(255,90,30,0.5)');
    g.addColorStop(1, 'rgba(255,40,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  });
  // A spell bolt: white, tinted by the material to the spell's colour.
  const bolt = canvas(32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  });
  // The guard: a bright curved band facing up (local -z once laid flat).
  const guard = canvas(64, 64, (c) => {
    c.strokeStyle = 'rgba(170,215,255,0.95)'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.arc(32, 52, 30, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
    c.strokeStyle = 'rgba(220,240,255,0.6)'; c.lineWidth = 2;
    c.beginPath(); c.arc(32, 52, 24, Math.PI * 1.25, Math.PI * 1.75); c.stroke();
  });
  return { slash, arrow: arrowTex('#c8a070', '#d8dce8'), enemyArrow: arrowTex('#6a4a30', '#9a9aa8'), fire, bolt, guard };
}

/** A spell with no colour set. */
const SPELL_DEFAULT_COLOR = '#ff8a3a';

/** The element an enemy's attacks hit with: set on purpose, or its first element. */
export const enemyElement = (d: EnemyDef): Element => d.attackElement ?? d.elements?.[0] ?? 'neutral';

/** "You are poisoned", "Bandit is frozen". */
export const STATUS_WORD: Record<Ailment | 'frozen', string> = {
  burn: 'burning', poison: 'poisoned', chill: 'chilled', frozen: 'frozen', paralyze: 'paralysed', blind: 'blinded', silence: 'silenced',
  stagger: 'staggered', sleep: 'asleep', confusion: 'confused', zombie: 'a zombie',
};
