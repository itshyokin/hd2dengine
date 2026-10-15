/**
 * The skill tree: built-in trees (Might, Dexterity, Magic, Vitality), what each skill does, and the
 * hero's ranks. Skill points come from levels (and quest rewards). No three.js, so it can be tested alone.
 */
import type { SkillNode, SkillStat, SkillsData } from '../world/types';

/** What each stat means, for the tree screen and the editor. `flag`: on or off rather than an amount. */
export const SKILL_STATS: Record<SkillStat, { name: string; unit: string; flag?: boolean }> = {
  maxHp: { name: 'Max health', unit: '' },
  maxMp: { name: 'Max magic', unit: '' },
  maxSp: { name: 'Max stamina', unit: '' },
  meleeDamage: { name: 'Melee damage', unit: '%' },
  swingSpeed: { name: 'Swing speed', unit: '%' },
  lightDamage: { name: 'Light weapon damage', unit: '%' },
  mediumDamage: { name: 'Medium weapon damage', unit: '%' },
  heavyDamage: { name: 'Heavy weapon damage', unit: '%' },
  lightSpeed: { name: 'Light weapon speed', unit: '%' },
  mediumSpeed: { name: 'Medium weapon speed', unit: '%' },
  heavySpeed: { name: 'Heavy weapon speed', unit: '%' },
  bowDamage: { name: 'Bow damage', unit: '%' },
  drawSpeed: { name: 'Draw speed', unit: '%' },
  bowRange: { name: 'Bow lock-on range', unit: '%' },
  sneakHide: { name: 'Harder to see while sneaking', unit: '%' },
  quietSteps: { name: 'Quieter while sneaking', unit: '%' },
  sneakDamage: { name: 'Sneak attack multiplier', unit: '×' },
  silentShot: { name: 'Silent shot', unit: '', flag: true },
  assassinate: { name: 'Assassinate', unit: '', flag: true },
  blockStamina: { name: 'Less stamina to block', unit: '%' },
  /** Older databases: the Fire skill (Arcana now: spell shards are items). */
  spellFire: { name: 'Spell: Fire', unit: '', flag: true },
  spellDamage: { name: 'Spell bolt damage', unit: '%' },
  spellCost: { name: 'Less magic for spells', unit: '%' },
  spellRange: { name: 'Spell bolt range', unit: '%' },
  lightReach: { name: 'Light spell reach', unit: '%' },
  proficientMedium: { name: 'Trained: medium weapons', unit: '', flag: true },
  proficientHeavy: { name: 'Trained: heavy weapons', unit: '', flag: true },
  str: { name: 'Strength', unit: '' },
  dex: { name: 'Dexterity', unit: '' },
  def: { name: 'Defence', unit: '' },
  mag: { name: 'Magic', unit: '' },
  mdf: { name: 'Magic Defence', unit: '' },
  crit: { name: 'Critical hit chance', unit: '%' },
};

const n = (id: string, tree: string, name: string, x: number, y: number, effects: SkillNode['effects'], o: Partial<SkillNode> = {}): SkillNode =>
  ({ id, tree, name, x, y, effects, ...o });

/** The built-in tree, used when the database has none (and copied into it by the editor to change). */
export const DEFAULT_SKILLS: SkillsData = {
  trees: [
    { id: 'might', name: 'Might', color: '#e8784e' },
    { id: 'dexterity', name: 'Dexterity', color: '#7cc46a' },
    { id: 'magic', name: 'Magic', color: '#7aa8ff' },
    { id: 'vitality', name: 'Vitality', color: '#e6c25a' },
  ],
  nodes: [
    // Might: swing speed, weapon damage, and mastery of light, medium or heavy weapons.
    n('fighter', 'might', 'Fighter', 2, 0, [{ stat: 'meleeDamage', value: 5 }], { description: 'The basics of the blade. Opens the Might tree.', teachesAddition: 'quick_strike' }),
    n('quick_hands', 'might', 'Quick Hands', 0, 1, [{ stat: 'swingSpeed', value: 8 }], { parents: ['fighter'], ranks: 3, description: 'Swing every weapon faster.' }),
    n('steady_guard', 'might', 'Steady Guard', 0, 2, [{ stat: 'blockStamina', value: 25 }], { parents: ['quick_hands'], ranks: 2, description: 'Blocking costs less stamina.' }),
    n('heavy_blows', 'might', 'Heavy Blows', 2, 1, [{ stat: 'meleeDamage', value: 10 }], { parents: ['fighter'], ranks: 3, description: 'Every melee hit does more damage.' }),
    n('arms_training', 'might', 'Arms Training', 4, 1, [{ stat: 'meleeDamage', value: 3 }, { stat: 'proficientMedium', value: 1 }], { parents: ['fighter'], description: 'Trained with medium weapons (longswords, rapiers): untrained, they swing slowly. Opens the masteries.' }),
    n('heavy_arms', 'might', 'Heavy Arms', 6, 1.6, [{ stat: 'proficientHeavy', value: 1 }], { parents: ['arms_training'], level: 3, description: 'Trained with heavy weapons (greatswords, great axes, hammers): untrained, they swing slowly.' }),
    n('light_mastery', 'might', 'Light Mastery', 3, 2, [{ stat: 'lightDamage', value: 15 }, { stat: 'lightSpeed', value: 8 }], { parents: ['arms_training'], ranks: 2, description: 'Daggers and short swords: faster and deadlier.' }),
    n('medium_mastery', 'might', 'Medium Mastery', 4, 2.4, [{ stat: 'mediumDamage', value: 15 }, { stat: 'mediumSpeed', value: 5 }], { parents: ['arms_training'], ranks: 2, description: 'Longswords and rapiers: the balanced path.' }),
    n('heavy_mastery', 'might', 'Heavy Mastery', 5, 2, [{ stat: 'heavyDamage', value: 20 }], { parents: ['heavy_arms'], ranks: 2, description: 'Greatswords and great axes hit even harder.' }),
    // Additions (turn-based battles): strings of timed strikes.
    n('double_slash', 'might', 'Double Slash', 1, 2, [], { parents: ['quick_hands'], teachesAddition: 'double_slash', description: 'An Addition: two timed strikes.' }),
    n('volley', 'might', 'Volley', 2, 3, [], { parents: ['heavy_blows'], level: 4, teachesAddition: 'volley', description: 'An Addition: four timed strikes with mixed buttons.' }),
    n('crescent_storm', 'might', 'Crescent Storm', 2, 4, [], { parents: ['volley'], level: 10, cost: 2, teachesAddition: 'crescent_storm', description: 'An Addition: seven fast strikes.' }),
    // Dexterity: archery on the left, stealth on the right.
    n('archer', 'dexterity', 'Archer', 1, 0, [{ stat: 'bowDamage', value: 10 }], { description: 'Arrows fly true. Opens archery.' }),
    n('steady_draw', 'dexterity', 'Steady Draw', 0, 1, [{ stat: 'drawSpeed', value: 15 }], { parents: ['archer'], ranks: 2, description: 'Draw the bow faster.' }),
    n('eagle_eye', 'dexterity', 'Eagle Eye', 2, 1, [{ stat: 'bowRange', value: 25 }], { parents: ['archer'], ranks: 2, description: 'Lock on to enemies further away with a bow: spot them first, prepare, snipe.' }),
    n('power_shot', 'dexterity', 'Power Shot', 1, 2, [{ stat: 'bowDamage', value: 15 }], { parents: ['steady_draw'], ranks: 2, description: 'Arrows hit harder.' }),
    n('shadow', 'dexterity', 'Shadow', 4, 0, [{ stat: 'sneakHide', value: 25 }], { description: 'Harder to see while sneaking. Opens stealth.' }),
    n('light_step', 'dexterity', 'Light Step', 3, 1, [{ stat: 'quietSteps', value: 30 }], { parents: ['shadow'], ranks: 2, description: 'Make less noise while sneaking.' }),
    n('backstab', 'dexterity', 'Backstab', 5, 1, [{ stat: 'sneakDamage', value: 1 }], { parents: ['shadow'], ranks: 2, description: 'Sneak attacks (on enemies that haven’t noticed you) do even more damage.' }),
    n('silent_shot', 'dexterity', 'Silent Shot', 3, 2, [{ stat: 'silentShot', value: 1 }], { parents: ['light_step', 'archer'], description: 'Killing an unaware enemy with an arrow from 5 or more tiles away doesn’t make the others come looking.' }),
    n('assassinate', 'dexterity', 'Assassinate', 5, 2, [{ stat: 'assassinate', value: 1 }], { parents: ['backstab'], level: 5, description: 'A sneak attack kills an ordinary enemy outright (not bosses).' }),
    // Magic: spells come as shards (equipped in the magic slot); this one gives the first.
    // Spell shards are found, bought or given as items; the Magic tree makes them better.
    n('fire', 'magic', 'Arcana', 2, 0, [{ stat: 'spellDamage', value: 10 }], { description: 'Spell bolts hit harder, and learn Fire. Opens the Magic tree.', teachesSpell: 'fire' }),
    n('thrift', 'magic', 'Mana Thrift', 1, 1, [{ stat: 'spellCost', value: 10 }], { parents: ['fire'], ranks: 3, description: 'Every spell costs less magic: bolts, and Light and Water Walk to cast and to keep going.' }),
    n('empower', 'magic', 'Empower', 3, 1, [{ stat: 'spellDamage', value: 10 }], { parents: ['fire'], ranks: 3, description: 'Spell bolts hit harder still, and Fire ranks up (Fire II, Fire III).', teachesSpell: 'fire', spellRankFrom: 2 }),
    n('frost_lore', 'magic', 'Frost Lore', 0, 1, [], { parents: ['fire'], ranks: 3, teachesSpell: 'frost', description: 'Learn Frost; more ranks raise it.' }),
    n('storm_lore', 'magic', 'Storm Lore', 4, 2, [], { parents: ['empower'], ranks: 3, level: 5, teachesSpell: 'spark', description: 'Learn Spark, lightning on every foe; more ranks raise it.' }),
    n('radiance', 'magic', 'Radiance', 1, 2, [{ stat: 'lightReach', value: 25 }], { parents: ['thrift'], ranks: 2, description: 'The Light spell shines further.' }),
    n('far_cast', 'magic', 'Far Cast', 3, 2, [{ stat: 'spellRange', value: 25 }], { parents: ['empower'], ranks: 2, description: 'Spell bolts fly further.' }),
    // Vitality: health, stamina and magic.
    n('toughness', 'vitality', 'Toughness', 0, 0, [{ stat: 'maxHp', value: 20 }], { ranks: 5, description: 'More health.' }),
    n('endurance', 'vitality', 'Endurance', 2, 0, [{ stat: 'maxSp', value: 20 }], { ranks: 5, description: 'More stamina.' }),
    n('focus', 'vitality', 'Focus', 4, 0, [{ stat: 'maxMp', value: 15 }], { ranks: 5, description: 'More magic.' }),
    n('mending', 'vitality', 'Mending', 6, 0, [], { ranks: 3, teachesSpell: 'mend', description: 'Learn Mend, healing for one of the party; more ranks raise it.' }),
  ],
};

export const skillsData = (data?: SkillsData): SkillsData => (data?.nodes?.length ? data : DEFAULT_SKILLS);

export class Skills {
  private totals = new Map<SkillStat, number>();

  constructor(public data: SkillsData, readonly ranks: Record<string, number>) { this.recount(); }

  node(id: string): SkillNode | undefined { return this.data.nodes.find((x) => x.id === id); }
  rank(id: string): number { return this.ranks[id] ?? 0; }
  maxRank(node: SkillNode): number { return Math.max(1, node.ranks ?? 1); }

  /** Can the hero take the next rank of this skill? Says why not. */
  check(node: SkillNode, points: number, level: number): { ok: boolean; why?: string } {
    if (this.rank(node.id) >= this.maxRank(node)) return { ok: false, why: 'Fully learned' };
    const missing = (node.parents ?? []).filter((p) => this.rank(p) < 1).map((p) => this.node(p)?.name ?? p);
    if (missing.length) return { ok: false, why: `Needs ${missing.join(' and ')}` };
    if (node.level && level < node.level) return { ok: false, why: `Needs level ${node.level}` };
    if (points < (node.cost ?? 1)) return { ok: false, why: 'Not enough skill points' };
    return { ok: true };
  }

  /** Take one rank (after check). Returns the points it cost. */
  take(node: SkillNode): number {
    this.ranks[node.id] = this.rank(node.id) + 1;
    this.recount();
    return node.cost ?? 1;
  }

  /** The total of a stat over every skill and rank taken. */
  get(stat: SkillStat): number { return this.totals.get(stat) ?? 0; }
  has(stat: SkillStat): boolean { return this.get(stat) > 0; }

  recount(): void {
    this.totals.clear();
    for (const [id, r] of Object.entries(this.ranks)) {
      const node = this.node(id);
      if (!node || r <= 0) continue;
      const k = Math.min(r, this.maxRank(node));
      for (const e of node.effects) this.totals.set(e.stat, (this.totals.get(e.stat) ?? 0) + e.value * k);
    }
  }
}

/** "+8% Swing speed" style text for an effect. */
export function effectText(e: { stat: SkillStat; value: number }): string {
  const info = SKILL_STATS[e.stat];
  if (!info) return e.stat;
  if (info.flag) return info.name;
  if (info.unit === '×') return `+${e.value}× ${info.name.toLowerCase()}`;
  return `+${e.value}${info.unit} ${info.name.toLowerCase()}`;
}
