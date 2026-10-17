/** Battles are three a side at most: the hero and two party members, and three enemies. */
export const MAX_FOES = 3;
/**
 * Combat tuning with defaults filled in. Database → Combat stores only what differs.
 * No three.js, so it can be tested on its own.
 */
import { ATTRS, ATTR_MAX, ATTR_POINTS_PER_LEVEL, type Attrs, attrsFrom, baseAttrs, finalDamage, throughFraction } from '../attributes';
import type { AbilityData, BattleMode, CombatData, Database, TurnOrder, WeaponClass } from '../../world/types';
import { abilityJSON } from '../abilities';

export interface ClassTuning { speed: number; reach: number; damage: number }

export interface TurnBasedConfig {
  order: TurnOrder;
  flee: number;
  joinRadius: number;
  maxEnemies: number;
  partyDamage: number;
  enemyDamage: number;
  grace: number;
  guardHeal: number;
  additions: 'set' | 'choose';
  additionTiming: 'press' | 'auto';
  /** The battle screen: Dragon Legend (faces and numbers in a row, lists in the middle) or Forbidden Fantasy (bars in a box, lists at the side). */
  layout: 'dragon' | 'fantasy';
  /** The hero always fights (can't be swapped onto the bench). */
  heroLocked: boolean;
  /** Party members walk behind the hero on the map (off: only the hero is shown; the party appears in battles). */
  partyFollows: boolean;
}

export const DEFAULT_TURN_BASED: TurnBasedConfig = { order: 'ctb', flee: 50, joinRadius: 6, maxEnemies: 3, partyDamage: 1, enemyDamage: 1, grace: 3, guardHeal: 10, additions: 'set', additionTiming: 'press', layout: 'dragon', heroLocked: false, partyFollows: true };

export interface CombatConfig {
  /** Action combat on the map, or turn-based battles. */
  mode: BattleMode;
  turnBased: TurnBasedConfig;
  unarmedDamage: number;
  classes: Record<WeaponClass | 'unarmed', ClassTuning>;
  bow: { drawTime: number; arrowSpeed: number; lockRange: number };
  lockRange: number;
  dodge: { cost: number; distance: number; time: number };
  /** Blocking: stamina per blocked hit, share of damage stopped, and the parry window (seconds after raising the guard). */
  block: { cost: number; reduction: number; parry: number };
  fire: { mp: number; damage: number; speed: number; range: number; kindle: number };
  sneakMultiplier: number;
  /** Enemies keep this many tiles from lit campfires. */
  campSafe: number;
  hurtGrace: number;
  xpBase: number;
  xpGrowth: number;
  maxLevel: number;
  /** Hand-set EXP per level (see CombatData.expTable); the curve fills the rest. */
  expTable?: number[];
  pointsPerLevel: number;
  startPoints: number;
  /** Stat points each level up. */
  statPointsPerLevel: number;
  /** The Journal's Bestiary: how many of a kind must be defeated before its numbers, its elements and its drops show. */
  bestiary: { stats: number; elements: number; drops: number };
}

export const DEFAULT_COMBAT: CombatConfig = {
  mode: 'turnBased',
  turnBased: DEFAULT_TURN_BASED,
  unarmedDamage: 3,
  classes: {
    unarmed: { speed: 1.3, reach: 0.85, damage: 1 },
    light: { speed: 1.45, reach: 1.0, damage: 0.85 },
    medium: { speed: 1.0, reach: 1.2, damage: 1 },
    heavy: { speed: 0.62, reach: 1.4, damage: 1.6 },
  },
  bow: { drawTime: 0.75, arrowSpeed: 15, lockRange: 16 },
  lockRange: 8,
  dodge: { cost: 18, distance: 2.4, time: 0.3 },
  block: { cost: 14, reduction: 0.8, parry: 0.22 },
  fire: { mp: 6, damage: 14, speed: 9, range: 12, kindle: 20 },
  sneakMultiplier: 2.5,
  campSafe: 4,
  hurtGrace: 0.7,
  xpBase: 60,
  xpGrowth: 1.15,
  maxLevel: 50,
  pointsPerLevel: 1,
  startPoints: 1,
  statPointsPerLevel: ATTR_POINTS_PER_LEVEL,
  bestiary: { stats: 1, elements: 3, drops: 5 },
};

/** Base time of one melee swing (at speed 1), in seconds. */
export const SWING_TIME = 0.46;

export function combatConfig(data?: CombatData): CombatConfig {
  const d = DEFAULT_COMBAT, s = data ?? {};
  const classes = { ...d.classes };
  for (const k of ['light', 'medium', 'heavy'] as WeaponClass[]) classes[k] = { ...d.classes[k], ...s.classes?.[k] };
  const tb = { ...d.turnBased, ...s.turnBased };
  return {
    mode: s.mode === 'action' ? 'action' : 'turnBased',
    turnBased: {
      ...tb, order: tb.order === 'rounds' ? 'rounds' : 'ctb',
      flee: Math.max(0, Math.min(100, tb.flee)), joinRadius: Math.max(0, tb.joinRadius), maxEnemies: Math.max(1, Math.min(MAX_FOES, Math.round(tb.maxEnemies))),
      partyDamage: Math.max(0.1, tb.partyDamage), enemyDamage: Math.max(0.1, tb.enemyDamage), grace: Math.max(0, tb.grace), guardHeal: Math.max(0, Math.min(100, tb.guardHeal)), additions: tb.additions === 'choose' ? 'choose' : 'set', additionTiming: tb.additionTiming === 'auto' ? 'auto' : 'press', layout: tb.layout === 'fantasy' ? 'fantasy' : 'dragon', heroLocked: !!tb.heroLocked,
    },
    unarmedDamage: s.unarmedDamage ?? d.unarmedDamage,
    classes,
    bow: { ...d.bow, ...s.bow },
    lockRange: s.lockRange ?? d.lockRange,
    dodge: { ...d.dodge, ...s.dodge },
    block: { ...d.block, ...s.block },
    fire: { ...d.fire, ...s.fire },
    sneakMultiplier: s.sneakMultiplier ?? d.sneakMultiplier,
    campSafe: s.campSafe ?? d.campSafe,
    hurtGrace: s.hurtGrace ?? d.hurtGrace,
    xpBase: s.xpBase ?? d.xpBase,
    xpGrowth: s.xpGrowth ?? d.xpGrowth,
    maxLevel: clampLevel(s.maxLevel ?? d.maxLevel),
    expTable: s.expTable?.length ? s.expTable.map((v) => Math.max(1, Math.round(v))) : undefined,
    pointsPerLevel: s.pointsPerLevel ?? d.pointsPerLevel,
    startPoints: s.startPoints ?? d.startPoints,
    statPointsPerLevel: Math.max(0, Math.round(s.statPointsPerLevel ?? d.statPointsPerLevel)),
    bestiary: { ...d.bestiary, ...s.bestiary },
  };
}

export const combatFromDb = (db: Database): CombatConfig => combatConfig(db.combat);

/** Damage after defence: defence d takes away d / (d + 50) of it (rounded up, never below 1 or above 9999). */
export function mitigate(damage: number, defense: number): number {
  return finalDamage(damage * throughFraction(defense));
}

/** Levels can be set from 2 to 99. */
export const MAX_LEVEL_LIMIT = 99;
const clampLevel = (n: number) => Math.max(2, Math.min(MAX_LEVEL_LIMIT, Math.round(n)));

export type XpRules = Pick<CombatConfig, 'xpBase' | 'xpGrowth'> & Partial<Pick<CombatConfig, 'maxLevel' | 'expTable'>>;

/** EXP from `level` to the next on the curve alone (base × growth^(level − 1)). */
export function curveXp(c: Pick<CombatConfig, 'xpBase' | 'xpGrowth'>, level: number): number {
  return Math.max(1, Math.round(c.xpBase * Math.pow(c.xpGrowth, level - 1)));
}

/** Experience needed to go from `level` to the next (0 at the top level: there is no next). */
export function xpToNext(c: XpRules, level: number): number {
  if (level >= (c.maxLevel ?? MAX_LEVEL_LIMIT)) return 0;
  return c.expTable?.[level - 1] ?? curveXp(c, level);
}

/** The whole table for levels 1 … max − 1: EXP to the next level, and the total EXP to reach that next level. */
export function expRows(c: XpRules): { level: number; toNext: number; total: number }[] {
  const max = c.maxLevel ?? MAX_LEVEL_LIMIT, rows: { level: number; toNext: number; total: number }[] = [];
  let total = 0;
  for (let l = 1; l < max; l++) { const n = xpToNext(c, l); total += n; rows.push({ level: l, toNext: n, total }); }
  return rows;
}

/** Level, experience into the current level, unspent skill points, and the hero's stats. */
export class Progression {
  level = 1;
  xp = 0;
  points = 0;
  /** The hero's own stats (from creation, plus the points spent on them since), and stat points not yet spent. */
  stats: Attrs = baseAttrs();
  statPoints = 0;
  /** Ranks taken in each skill. */
  ranks: Record<string, number> = {};
  /** Skills whose spell shard has been given (so it's given only once, even if it's sold or dropped later). */
  taught: string[] = [];
  /** Learned spells and Additions, the readied ones, and class. */
  abilities: AbilityData = {};
  /** Growth ranks changed for good (potions, events); the rest are the Database's. */
  statRanks: Partial<Record<keyof Attrs, import('../statRanks').Rank>> = {};
  /** What a level adds to each stat (from the hero's ranks; set by the game). */
  growth: () => Partial<Attrs> = () => ({});

  constructor(private cfg: XpRules & Pick<CombatConfig, 'pointsPerLevel'> & Partial<Pick<CombatConfig, 'startPoints' | 'statPointsPerLevel'>>) {
    this.points = cfg.startPoints ?? 0;
  }

  get toNext(): number { return xpToNext(this.cfg, this.level); }
  /** At the top level: experience no longer counts. */
  get maxed(): boolean { return this.level >= (this.cfg.maxLevel ?? MAX_LEVEL_LIMIT); }

  /** Add experience; returns how many levels were gained. */
  add(xp: number): number {
    let gained = 0;
    if (this.maxed) { this.xp = 0; return 0; }
    this.xp += Math.max(0, Math.round(xp));
    while (!this.maxed && this.xp >= this.toNext) {
      this.xp -= this.toNext;
      this.level++;
      this.points += this.cfg.pointsPerLevel;
      // Stats grow by their ranks (A +4 … F +0).
      const g = this.growth();
      for (const k of ATTRS) this.stats[k] = Math.min(ATTR_MAX, this.stats[k] + (g[k] ?? 0));
      gained++;
    }
    if (this.maxed) this.xp = 0;
    return gained;
  }

  toJSON(): ProgressData & { level: number; xp: number; points: number } {
    return { level: this.level, xp: this.xp, points: this.points, ranks: { ...this.ranks }, ...(this.taught.length ? { taught: [...this.taught] } : {}),
      stats: { ...this.stats }, ...(Object.keys(this.statRanks).length ? { statRanks: { ...this.statRanks } } : {}), ...(Object.keys(abilityJSON(this.abilities)).length ? { abilities: abilityJSON(this.abilities) } : {}) };
  }
  /**
   * Restore from a save, or start fresh (no argument) with `base` stats (the hero's, or what character creation
   * made). Saves from before stats get the database's stats and the points their levels would have given.
   */
  load(d?: ProgressData, base: Attrs = baseAttrs()): void {
    this.taught = [...(d?.taught ?? [])];
    this.abilities = abilityJSON(d?.abilities ?? {});
    this.level = Math.max(1, Math.min(this.cfg.maxLevel ?? MAX_LEVEL_LIMIT, d?.level ?? 1));
    this.xp = this.maxed ? 0 : Math.max(0, d?.xp ?? 0);
    this.points = Math.max(0, d?.points ?? (d ? 0 : this.cfg.startPoints ?? 0));
    this.ranks = { ...(d?.ranks ?? {}) };
    this.stats = d?.stats ? attrsFrom(d.stats) : { ...base };
    // Stat points are gone (stats grow by rank now); any left unspent in an older save are dropped.
    this.statPoints = 0;
    this.statRanks = { ...(d?.statRanks ?? {}) };
  }

  /** Spend stat points: `add` is how many go on each stat. False if there aren't enough or a stat would pass 100. */
  spend(add: Partial<Attrs>): boolean {
    const total = ATTRS.reduce((s, k) => s + Math.max(0, Math.round(add[k] ?? 0)), 0);
    if (total > this.statPoints || ATTRS.some((k) => this.stats[k] + (add[k] ?? 0) > ATTR_MAX)) return false;
    for (const k of ATTRS) this.stats[k] += Math.max(0, Math.round(add[k] ?? 0));
    this.statPoints -= total;
    return true;
  }
}

export interface ProgressData {
  level?: number; xp?: number; points?: number; ranks?: Record<string, number>; taught?: string[];
  stats?: Partial<Attrs>; statPoints?: number;
  abilities?: AbilityData;
  /** Stat growth ranks changed by potions and events (game/statRanks.ts). */
  statRanks?: Partial<Record<keyof Attrs, import('../statRanks').Rank>>;
}
