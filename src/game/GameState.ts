/** Switches and variables, the persistent memory events read and write (as in RPG Maker). */
import type { ForgeEntry } from './forge';
import { ABILITIES, type Ability, type Condition, type WeatherKind } from '../world/types';
import type { Inventory } from './inventory';
import type { QuestBook } from './quests';

/** Weather an event set for a map. */
export interface MapWeather { kind: WeatherKind; amount?: number; wind?: number }

export class GameState {
  readonly switches = new Map<string, boolean>();
  readonly variables = new Map<string, number>();
  /** The player's bag (for "has item" and "has gold" conditions). */
  inventory: Inventory | null = null;
  /** Quests (for quest conditions). */
  quests: QuestBook | null = null;
  /** Movement abilities the player has right now. */
  readonly abilities = new Map<Ability, boolean>(ABILITIES.map((a) => [a, true]));
  /** "Overworld weapons: off" (an event, for indoors or restricted areas): the field sword and bow can't be used. */
  weaponsOff = false;
  /** Console cheats were used in this game: achievements stay locked for it. */
  cheated = false;
  /** Props cut down with a cutting ring, per map (keys from propKey). */
  readonly cut = new Map<string, Set<string>>();
  /** Game hours passed since the game began (the clock running; fires burn by it). */
  clock = 0;
  /** Fires that burn out, per map: prop key → the game hour (on `clock`) they go out. Missing: never lit yet. */
  /** The Journal's records: counts of things done (steps, enemies defeated by kind, trees chopped…). */
  readonly records = new Map<string, number>();
  /** Weapons and armor upgraded or enchanted at a forge (by item id). */
  readonly forge = new Map<string, ForgeEntry>();

  /** Count something for the Journal's records (`best`: keep the highest instead of adding). */
  tally(key: string, n = 1, best = false): void {
    if (!(n > 0) || !Number.isFinite(n)) return;
    const was = this.records.get(key) ?? 0;
    this.records.set(key, best ? Math.max(was, n) : was + n);
  }

  record(key: string): number { return this.records.get(key) ?? 0; }

  /** Weather changed by events, per map (overrides the map's own). */
  readonly weather = new Map<string, MapWeather>();
  readonly fires = new Map<string, Map<string, number>>();

  fireUntil(map: string, key: string): number | undefined { return this.fires.get(map)?.get(key); }
  setFire(map: string, key: string, until: number): void {
    let m = this.fires.get(map);
    if (!m) this.fires.set(map, (m = new Map()));
    m.set(key, until);
  }

  isCut(map: string, key: string): boolean { return this.cut.get(map)?.has(key) ?? false; }
  setCut(map: string, key: string): void {
    let s = this.cut.get(map);
    if (!s) this.cut.set(map, (s = new Set()));
    s.add(key);
  }

  /** Start with the database's abilities (any not listed are on). */
  initAbilities(from?: Partial<Record<Ability, boolean>>): void {
    for (const a of ABILITIES) this.abilities.set(a, from?.[a] ?? true);
  }
  has(a: Ability): boolean {
    return this.abilities.get(a) ?? true;
  }
  setAbility(a: Ability, on: boolean): void {
    this.abilities.set(a, on);
  }

  getSwitch(id: string): boolean {
    return this.switches.get(id) ?? false;
  }
  setSwitch(id: string, on: boolean): void {
    this.switches.set(id, on);
  }
  getVar(id: string): number {
    return this.variables.get(id) ?? 0;
  }
  setVar(id: string, v: number): void {
    this.variables.set(id, v);
  }

  test(c: Condition): boolean {
    if ('quest' in c) {
      const q = this.quests;
      if ('objective' in c) {
        const d = q?.def(c.quest), o = d?.objectives.find((x) => x.id === c.objective);
        return (!!q && !!d && !!o && q.objectiveDone(d, o)) === (c.done ?? true);
      }
      const s = q?.status(c.quest) ?? 'inactive';
      return c.is === 'started' ? s === 'active' || s === 'ready' : s === c.is;
    }
    if ('switch' in c) return this.getSwitch(c.switch) === (c.is ?? true);
    if ('item' in c) return (this.inventory?.count(c.item) ?? 0) >= (c.count ?? 1);
    if ('gold' in c) return (this.inventory?.gold ?? 0) >= c.gold;
    if ('weekday' in c) return c.weekday.includes(new Date().getDay());
    const v = this.getVar(c.var);
    switch (c.op) {
      case '>=': return v >= c.value;
      case '<=': return v <= c.value;
      case '==': return v === c.value;
      case '>': return v > c.value;
      case '<': return v < c.value;
    }
  }

  /** Replace \v[name] with a variable's value and \s[name] with ON/OFF. */
  /** "2 h 30 min" for the fire nearest the hero, for \fire in messages (the game fills this in). */
  fireText: () => string = () => '';

  format(text: string): string {
    return text
      .replace(/\\fire/g, () => this.fireText())
      .replace(/\\v\[([^\]]+)\]/g, (_, id: string) => String(this.getVar(id)))
      .replace(/\\s\[([^\]]+)\]/g, (_, id: string) => (this.getSwitch(id) ? 'ON' : 'OFF'));
  }

  /** Restore from a save (replaces everything). */
  load(d: { switches?: Record<string, boolean>; variables?: Record<string, number>; abilities?: Record<string, boolean>; cut?: Record<string, string[]>; clock?: number; fires?: Record<string, Record<string, number>>; weather?: Record<string, MapWeather>; records?: Record<string, number>; forge?: Record<string, ForgeEntry>; weaponsOff?: boolean; cheated?: boolean }): void {
    this.weaponsOff = !!d.weaponsOff;
    this.cheated = !!d.cheated;
    this.switches.clear();
    this.variables.clear();
    this.cut.clear();
    this.fires.clear();
    this.weather.clear();
    this.records.clear();
    this.forge.clear();
    for (const [k, v] of Object.entries(d.forge ?? {})) if (v && typeof v === 'object') this.forge.set(k, { ...(v.level ? { level: Math.max(0, Math.round(Number(v.level) || 0)) } : {}), ...(typeof v.shard === 'string' ? { shard: v.shard } : {}) });
    for (const [k, v] of Object.entries(d.records ?? {})) if (Number.isFinite(Number(v))) this.records.set(k, Number(v));
    for (const [m, w] of Object.entries(d.weather ?? {})) if (w && typeof w.kind === 'string') this.weather.set(m, { kind: w.kind, amount: w.amount, wind: w.wind });
    this.clock = Math.max(0, d.clock ?? 0);
    for (const [m, f] of Object.entries(d.fires ?? {})) this.fires.set(m, new Map(Object.entries(f).map(([k, v]) => [k, Number(v) || 0])));
    for (const [m, keys] of Object.entries(d.cut ?? {})) this.cut.set(m, new Set(keys));
    for (const [k, v] of Object.entries(d.switches ?? {})) this.switches.set(k, !!v);
    for (const [k, v] of Object.entries(d.variables ?? {})) this.variables.set(k, Number(v) || 0);
    for (const [k, v] of Object.entries(d.abilities ?? {})) this.abilities.set(k as Ability, !!v);
  }

  /** Plain-object snapshot, the starting point for save files. */
  toJSON(): { switches: Record<string, boolean>; variables: Record<string, number>; abilities: Record<string, boolean>; cut?: Record<string, string[]>; clock?: number; fires?: Record<string, Record<string, number>>; weather?: Record<string, MapWeather>; records?: Record<string, number>; forge?: Record<string, ForgeEntry>; weaponsOff?: boolean; cheated?: boolean } {
    const out: ReturnType<GameState['toJSON']> = { switches: Object.fromEntries(this.switches), variables: Object.fromEntries(this.variables), abilities: Object.fromEntries(this.abilities) };
    if (this.weaponsOff) out.weaponsOff = true;
    if (this.cheated) out.cheated = true;
    if (this.cut.size) out.cut = Object.fromEntries([...this.cut].map(([m, s]) => [m, [...s]]));
    if (this.clock) out.clock = this.clock;
    if (this.fires.size) out.fires = Object.fromEntries([...this.fires].map(([m, f]) => [m, Object.fromEntries(f)]));
    if (this.weather.size) out.weather = Object.fromEntries(this.weather);
    if (this.forge.size) out.forge = Object.fromEntries([...this.forge].map(([k, v]) => [k, { ...v }]));
    if (this.records.size) out.records = Object.fromEntries([...this.records].map(([k, v]) => [k, Math.round(v * 100) / 100]));
    return out;
  }
}

/** Identifies a placed prop across visits and saves: its type and position. */
export function propKey(p: { type: string; x: number; z: number }): string {
  return `${p.type}@${Math.round(p.x * 100) / 100},${Math.round(p.z * 100) / 100}`;
}
