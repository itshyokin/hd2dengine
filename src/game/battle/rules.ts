/**
 * Turn-based battle rules: turn order (FFX-style CTB or classic rounds), damage, running away and what enemies
 * choose to do. No three.js and no DOM, so it can be tested on its own.
 */
import type { Element, TurnOrder } from '../../world/types';
import { type ElementalDefence, elementResult } from '../elements';
import { CRIT_MULTIPLIER, finalDamage, throughFraction } from '../attributes';

export type Side = 'party' | 'enemy';

/** A spell a fighter can cast in battle. */
export interface BattleSpell {
  id: string;
  name: string;
  mp: number;
  /** Damage before Magic Defence (bolts), or health given back (heals). */
  power: number;
  kind: 'bolt' | 'heal';
  element: Element;
  color?: string;
}

/** Everyone in a battle, on either side. */
export interface Battler {
  /** Unique in this battle ("p0" the hero, "p1"… party members, "e0"… enemies). */
  key: string;
  side: Side;
  name: string;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  /** Attack damage before defence, its element, and whether it's a spell (Magic Defence counts). */
  attack: number;
  attackElement: Element;
  attackMagic: boolean;
  armour: number;
  magicArmour: number;
  /** How quickly turns come round (heroes: Dexterity). */
  agility: number;
  /** Critical hit chance, %. */
  crit: number;
  defence: ElementalDefence;
  spells: BattleSpell[];
  /** CTB: ticks until this fighter's next turn. */
  ct: number;
  /** Guarding until their next turn (half damage). */
  guarding: boolean;
  /** Bosses: no running away. */
  boss?: boolean;
  /** Healing hurts it. */
  undead?: boolean;
}

export const isUp = (b: Battler): boolean => b.hp > 0;

/* ------------------------------------------------------------------ turn order */

/** Rank: how heavy an action is. Light actions bring the next turn round sooner (FFX: Defend 2, Attack 3). */
export const RANK = { attack: 3, magic: 3, item: 2, guard: 2, flee: 2 } as const;
export type ActionKind = keyof typeof RANK;

/** Ticks one rank of action costs at this agility (agility 10: 60; 30: 36; 50: 26). */
export const tickOf = (agility: number): number => 1800 / (Math.max(1, agility) + 20);
export const delayOf = (agility: number, rank: number): number => tickOf(agility) * rank;

/** How a battle opened: the party got the jump (hit first), normally, or the enemies did. */
export type Opening = 'preemptive' | 'normal' | 'ambush';

/** Where everyone's counter starts: a little random, and well behind for the side that was caught out. */
export function startCounters(all: Battler[], opening: Opening, rng: () => number = Math.random): void {
  for (const b of all) {
    let ct = delayOf(b.agility, RANK.attack) * (0.6 + rng() * 0.5);
    if (opening === 'preemptive' && b.side === 'enemy') ct += delayOf(b.agility, RANK.attack);
    if (opening === 'ambush' && b.side === 'party') ct += delayOf(b.agility, RANK.attack);
    b.ct = ct;
  }
}

/** CTB: who acts next (the lowest counter; the party wins ties), and how far the clock moves to get there. */
export function nextUp(all: Battler[]): Battler | null {
  let best: Battler | null = null;
  for (const b of all) {
    if (!isUp(b)) continue;
    if (!best || b.ct < best.ct - 1e-9 || (Math.abs(b.ct - best.ct) < 1e-9 && b.side === 'party' && best.side === 'enemy')) best = b;
  }
  return best;
}

/** Run the clock until `who`'s turn: everyone's counter goes down by theirs. */
export function advanceTo(all: Battler[], who: Battler): void {
  const by = who.ct;
  for (const b of all) if (isUp(b)) b.ct = Math.max(0, b.ct - by);
}

/** After acting, a fighter waits this action's delay for their next turn. */
export function spend(b: Battler, rank: number): void { b.ct += delayOf(b.agility, rank); }

/**
 * CTB forecast: the next `n` turns, assuming everyone after the one acting uses a normal (rank 3) action.
 * `acting` with `rank`: the fighter choosing now and the weight of what they're pointing at (so the bar shows
 * what a lighter action would change, like FFX).
 */
export function forecast(all: Battler[], n: number, acting?: Battler, rank: number = RANK.attack): Battler[] {
  const sim = all.filter(isUp).map((b) => ({ b, ct: b.ct }));
  const out: Battler[] = [];
  if (acting) {
    out.push(acting);
    const s = sim.find((x) => x.b === acting);
    if (s) s.ct += delayOf(acting.agility, rank);
  }
  while (out.length < n && sim.length) {
    let best = sim[0];
    for (const s of sim) if (s.ct < best.ct - 1e-9 || (Math.abs(s.ct - best.ct) < 1e-9 && s.b.side === 'party' && best.b.side === 'enemy')) best = s;
    const by = best.ct;
    for (const s of sim) s.ct -= by;
    out.push(best.b);
    best.ct += delayOf(best.b.agility, RANK.attack);
  }
  return out;
}

/** Rounds: everyone standing, fastest first (a little luck in it); the party's openings act first in round one. */
export function roundOrder(all: Battler[], opening: Opening = 'normal', rng: () => number = Math.random): Battler[] {
  const up = all.filter(isUp).map((b) => ({ b, k: b.agility * (0.9 + rng() * 0.2) }));
  up.sort((a, c) => c.k - a.k);
  const order = up.map((x) => x.b);
  if (opening === 'preemptive') return order.filter((b) => b.side === 'party');
  if (opening === 'ambush') return order.filter((b) => b.side === 'enemy');
  return order;
}

export const turnOrderName: Record<TurnOrder, string> = { ctb: 'Conditional turns (FFX)', rounds: 'Rounds (classic)' };

/* ------------------------------------------------------------------ damage */

export interface HitResult {
  kind: 'hit' | 'immune' | 'absorb';
  amount: number;
  crit: boolean;
  label: 'Weak!' | 'Resist' | null;
}

/** One hit: element, a little spread, a critical, defence (or magic defence), guarding, then the damage scale. */
export function strike(power: number, element: Element, magic: boolean, by: Pick<Battler, 'crit'>, target: Battler, scale = 1, rng: () => number = Math.random): HitResult {
  const el = elementResult(element, target.defence);
  if (el.kind === 'immune') return { kind: 'immune', amount: 0, crit: false, label: null };
  let dmg = power * scale * (0.9 + rng() * 0.2);
  if (el.kind === 'absorb' && !target.undead) return { kind: 'absorb', amount: finalDamage(dmg), crit: false, label: null };
  const mult = el.kind === 'hit' ? el.mult : 1;
  dmg *= mult;
  const crit = rng() * 100 < by.crit;
  if (crit) dmg *= CRIT_MULTIPLIER;
  dmg *= throughFraction(magic ? target.magicArmour : target.armour);
  if (target.guarding) dmg *= 0.5;
  return { kind: 'hit', amount: finalDamage(dmg), crit, label: el.kind === 'hit' ? el.label : null };
}

/** Health given back by a heal (the undead are hurt by it instead: a negative number). */
export function healAmount(power: number, target: Battler, rng: () => number = Math.random): number {
  const n = Math.max(1, Math.round(power * (0.95 + rng() * 0.1)));
  return target.undead ? -n : n;
}

/* ------------------------------------------------------------------ running away, enemy choices */

/** Chance (0 … 1) to get away: the base, plus 2% for each point the party is faster on average. */
export function fleeChance(party: Battler[], enemies: Battler[], base: number): number {
  const avg = (l: Battler[]) => { const u = l.filter(isUp); return u.length ? u.reduce((s, b) => s + b.agility, 0) / u.length : 0; };
  if (enemies.some((e) => isUp(e) && e.boss)) return 0;
  return Math.max(0.05, Math.min(0.95, (base + (avg(party) - avg(enemies)) * 2) / 100));
}

/** What an enemy does on its turn: usually its attack, on someone standing (the weak a little more often). */
export function enemyChoice(e: Battler, party: Battler[], rng: () => number = Math.random): { kind: 'attack' | 'spell'; target: Battler; spell?: BattleSpell } | null {
  const up = party.filter(isUp);
  if (!up.length) return null;
  // A healer-type enemy patches itself up when low (if it has a heal).
  const heal = e.spells.find((s) => s.kind === 'heal' && s.mp <= e.mp);
  if (heal && e.hp < e.maxHp * 0.35 && rng() < 0.6) return { kind: 'spell', target: e, spell: heal };
  const weights = up.map((b) => 1 + (1 - b.hp / Math.max(1, b.maxHp)));
  let r = rng() * weights.reduce((s, w) => s + w, 0), target = up[0];
  for (let i = 0; i < up.length; i++) { r -= weights[i]; if (r <= 0) { target = up[i]; break; } }
  const bolt = e.spells.filter((s) => s.kind === 'bolt' && s.mp <= e.mp);
  if (bolt.length && rng() < 0.35) return { kind: 'spell', target, spell: bolt[Math.floor(rng() * bolt.length)] };
  return { kind: 'attack', target };
}

/** An enemy's agility when Database → Enemies leaves it unset: from how fast it moves on the map (1.6 tiles/s: 10). */
export const enemyAgility = (def: { agility?: number; speed: number }): number => Math.max(1, Math.round(def.agility ?? def.speed * 6.25));

/** Pick from weighted entries. */
export function weighted<T extends { weight?: number }>(list: T[], rng: () => number = Math.random): T | undefined {
  const total = list.reduce((s, x) => s + Math.max(0, x.weight ?? 1), 0);
  if (total <= 0) return list[0];
  let r = rng() * total;
  for (const x of list) { r -= Math.max(0, x.weight ?? 1); if (r <= 0) return x; }
  return list[list.length - 1];
}
