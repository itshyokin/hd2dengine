/**
 * A turn-based battle from start to finish: who acts next (FFX-style conditional turns, or rounds), the party's
 * commands (Attack, Magic, Items, Guard, Run), the enemies' turns (their attack or their own actions), ailments
 * running on turns, and winning, losing or getting away.
 * The game supplies the fighters and does what lasts beyond the battle (items, rewards, the hero's health);
 * the screen shows it.
 */
import type { Sfx } from '../../audio/sfx';
import type { BattleScreen, ChoiceItem, FighterView } from '../../ui/BattleScreen';
import type { Ailment, Element, EnemyAction, Inflict } from '../../world/types';
import type { TurnBasedConfig } from '../combat/config';
import { ELEMENT_COLORS } from '../elements';
import { statusIconUrl } from '../../art/statusIcons';
import type { QteResult } from '../../ui/BattleScreen';
import {
  type BattleAddition, type Battler, type BattleSpell, type Opening, RANK, type SpellRank, advanceTo, enemyChoice, fleeChance, forecast, healAmount, isUp, nextUp,
  refreshAgility, roundOrder, spend, startCounters, strike, tickOf,
} from './rules';
import { AILMENT_WORD, BLIND_MISS_CHANCE, type BattleAilment, ailmentName, rollInflicts } from './status';

/** One fighter as the game hands it over. */
export interface BattleEntry { battler: Battler; view: FighterView; /** Party: 0 the hero, 1… members. */ who?: number; /** Enemies: the map's enemy (handed back when it's beaten). */ ref?: unknown }

export interface BattleItem { slot: number; name: string; count: number; detail?: string }

export type BattleOutcome = 'victory' | 'defeat' | 'fled';

export interface BattleHost {
  sound(name: Sfx): void;
  /** Items usable in battle (consumables in the bag) right now. */
  items(): BattleItem[];
  /**
   * Use the item in bag slot `slot` on party member `who` (0 the hero), who has these battle ailments: what
   * happened, whether it was used up, and what it cures.
   */
  useItem(slot: number, who: number, ailments: BattleAilment[]): { text: string; used: boolean; cures: (Ailment | 'all')[] } | null;
  /** Health and magic of party member `who` as the game has them now (after an item, say). */
  readVitals(who: number): { hp: number; mp: number };
  /** Write a party member's health and magic back to the game. */
  writeVitals(who: number, hp: number, mp: number): void;
  /** The battle was won: hand out the rewards for these enemies and say what was won (lines for the panel). */
  victory(beaten: unknown[]): string[];
  /** The battle is over and its screen closed. */
  finished(outcome: BattleOutcome, beaten: unknown[]): void;
  /** Party member `who` performed an Addition in full: count it towards its next rank (the new rank if it went up). */
  mastered?(who: number, addition: string): number | null;
  log(text: string): void;
}

type Phase = 'off' | 'intro' | 'next' | 'command' | 'busy' | 'over';

export class TurnBattle {
  private all: BattleEntry[] = [];
  private phase: Phase = 'off';
  private wait = 0;
  private then: (() => void) | null = null;
  private cfg!: TurnBasedConfig;
  private opening: Opening = 'normal';
  /** Rounds: who's still to act this round, and the round number. */
  private queue: Battler[] = [];
  private round = 0;
  private actor: Battler | null = null;
  private lastCommand = 0;

  constructor(private readonly screen: BattleScreen, private readonly host: BattleHost) {}

  get active(): boolean { return this.phase !== 'off'; }

  /** This battle's own rules (a scripted battle): whether the party may run. */
  rules: { canRun?: boolean } = {};

  start(entries: BattleEntry[], cfg: TurnBasedConfig, opening: Opening, rules: { canRun?: boolean } = {}): void {
    this.rules = rules;
    for (const e of entries) e.battler.charging = null;
    this.all = entries;
    this.cfg = cfg;
    this.opening = opening;
    this.round = 0;
    this.queue = [];
    this.actor = null;
    this.lastCommand = 0;
    for (const e of entries) { e.battler.guarding = false; refreshAgility(e.battler); }
    this.screen.open(entries.map((e) => e.view));
    this.refreshAll();
    startCounters(this.battlers, opening);
    this.screen.flash();
    const foes = this.foes;
    const names = foes.length === 1 ? foes[0].name : `${foes.length} enemies`;
    this.screen.message(opening === 'preemptive' ? `You caught ${names} off guard!` : opening === 'ambush' ? `Ambushed by ${names}!` : `${names} ${foes.length === 1 ? 'appears' : 'appear'}!`, true);
    this.host.log(opening === 'ambush' ? `Ambushed by ${names}` : `Battle: ${names}`);
    this.phase = 'intro';
    this.showOrder();
    this.later(1.1, () => { this.screen.message(''); this.phase = 'next'; });
  }

  private get battlers(): Battler[] { return this.all.map((e) => e.battler); }
  private get party(): Battler[] { return this.all.filter((e) => e.battler.side === 'party').map((e) => e.battler); }
  private get foes(): Battler[] { return this.all.filter((e) => e.battler.side === 'enemy').map((e) => e.battler); }
  private entry(b: Battler): BattleEntry { return this.all.find((e) => e.battler === b)!; }
  private sideOf(b: Battler): Battler[] { return b.side === 'party' ? this.party : this.foes; }
  private otherSide(b: Battler): Battler[] { return b.side === 'party' ? this.foes : this.party; }

  update(dt: number): void {
    if (this.phase === 'off') return;
    this.screen.update(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0 && this.then) { const t = this.then; this.then = null; t(); }
      return;
    }
    if (this.phase === 'next') this.nextTurn();
  }

  private later(seconds: number, fn: () => void): void { this.wait = seconds; this.then = fn; }

  /* ------------------------------------------------------------------ turns */

  private nextTurn(): void {
    if (this.checkOver()) return;
    let who: Battler | null;
    if (this.cfg.order === 'rounds') {
      this.queue = this.queue.filter(isUp);
      if (!this.queue.length) { this.round++; this.queue = roundOrder(this.battlers, this.round === 1 ? this.opening : 'normal'); if (!this.queue.length) this.queue = roundOrder(this.battlers); }
      who = this.queue.shift() ?? null;
    } else {
      who = nextUp(this.battlers);
      if (who) advanceTo(this.battlers, who);
    }
    if (!who) return;
    this.actor = who;
    // Guarding (and its ward against ailments) lasts until their own next turn.
    who.guarding = false;
    const start = who.status.startTurn(who.maxHp);
    this.refresh(who);
    this.showOrder();
    this.phase = 'busy';
    // Burn and poison bite first; then an ailment may take the turn.
    let pause = 0;
    for (const d of start.damage) {
      who.hp = Math.max(0, who.hp - d.amount);
      this.screen.popup(who.key, String(d.amount), 'dmg', d.ailment === 'burn' ? '#ff9a5a' : '#8ee05a');
      this.screen.animate(who.key, 'hit');
      this.host.log(`${who.name} takes ${d.amount} from ${d.ailment === 'burn' ? 'the burn' : 'poison'}`);
      pause = 0.6;
    }
    if (start.damage.length) {
      this.refresh(who);
      if (!isUp(who)) { this.fall(who); this.later(0.7, () => this.endTurn(who!, RANK.attack, 0.2)); return; }
    }
    const go = () => {
      if (start.skip) {
        const words: Partial<Record<BattleAilment, string>> = { frozen: 'is frozen solid', paralyze: 'is paralyzed', sleep: 'is asleep' };
        this.screen.message(`${who!.name} ${words[start.skip] ?? 'can’t move'}…`);
        this.screen.popup(who!.key, ailmentName(start.skip), 'info');
        this.endTurn(who!, RANK.attack, 0.9);
        return;
      }
      if (who!.charging) { this.chargeTurn(who!); return; }
      if (start.confused) { this.confusedTurn(who!); return; }
      if (who!.side === 'party') this.commandMenu(who!);
      else this.later(0.45, () => this.enemyTurn(who!));
    };
    if (pause) this.later(pause, go); else go();
  }

  /** The turn order bar: CTB's forecast (with what the chosen command would change), or this round and the next. */
  private showOrder(rank?: number): void {
    const active = this.actor && this.phase !== 'intro' ? this.actor : null;
    let list: Battler[];
    if (this.cfg.order === 'rounds') {
      const rest = this.queue.filter(isUp);
      list = [...(active ? [active] : []), ...rest, ...roundOrder(this.battlers, 'normal', () => 0.5)].slice(0, 8);
    } else list = forecast(this.battlers, 8, active ?? undefined, rank ?? RANK.attack);
    this.screen.setOrder(list.map((b) => b.key), active?.key ?? null);
  }

  private commandMenu(b: Battler): void {
    this.phase = 'command';
    const items = this.host.items();
    const canFlee = this.rules.canRun !== false && !this.foes.some((f) => isUp(f) && f.boss);
    const silenced = b.status.silenced;
    const cmds: (ChoiceItem & { run: () => void })[] = [
      { label: 'Attack', rank: RANK.attack, right: this.attackLabel(b), run: () => this.attackMenu(b) },
      { label: 'Magic', rank: RANK.magic, disabled: !b.spells.length || silenced, right: silenced ? 'Silenced' : b.spells.length ? '' : '—', run: () => this.magicMenu(b) },
      { label: 'Items', rank: RANK.item, disabled: !items.length, run: () => this.itemMenu(b) },
      { label: 'Guard', rank: RANK.guard, detail: this.cfg.guardHeal > 0 ? `Half damage, +${this.cfg.guardHeal}% HP, no ailments` : 'Half damage, no ailments', run: () => this.doGuard(b) },
      { label: 'Run', rank: RANK.flee, disabled: !canFlee, detail: canFlee ? undefined : 'Can’t run from this fight', run: () => this.doFlee(b) },
    ];
    this.screen.message(`${b.name}’s turn`, true);
    this.screen.choose(b.name, cmds, (i) => { this.lastCommand = i; this.screen.message(''); cmds[i].run(); }, undefined, (i) => this.showOrder(cmds[i].rank), this.lastCommand);
  }

  /** What Attack does: the set Addition's name (when Additions are set per hero). */
  private attackLabel(b: Battler): string {
    if (this.cfg.additions !== 'set' || !b.addition) return '';
    return b.additions?.find((a) => a.id === b.addition)?.name ?? '';
  }

  private attackMenu(b: Battler): void {
    const foes = this.foes.filter(isUp);
    const adds = b.additions ?? [];
    // Set per hero: Attack performs it (or a plain attack without one).
    if (this.cfg.additions === 'set' || !adds.length) {
      const a = adds.find((x) => x.id === b.addition);
      this.pickTarget(foes, (t) => (a ? this.doAddition(b, a, t) : this.doAttack(b, t)), () => this.commandMenu(b));
      return;
    }
    // Chosen each time: a plain attack or any Addition they know.
    const list: ChoiceItem[] = [{ label: 'Attack', detail: 'A plain attack', rank: RANK.attack },
      ...adds.map((a) => ({ label: a.name, right: `${a.strikes.length} hit${a.strikes.length === 1 ? '' : 's'} · Rank ${a.rank}`, detail: a.toNext === null ? 'Mastered' : `${a.toNext} more to rank ${a.rank + 1}`, rank: RANK.attack }))];
    this.screen.choose('Attack', list, (i) => {
      const a = i ? adds[i - 1] : undefined;
      this.pickTarget(foes, (t) => (a ? this.doAddition(b, a, t) : this.doAttack(b, t)), () => this.attackMenu(b));
    }, () => this.commandMenu(b), () => this.showOrder(RANK.attack));
  }

  private magicMenu(b: Battler): void {
    const list = b.spells.map((s) => {
      const top = s.ranks[s.ranks.length - 1], low = s.ranks[0];
      return { label: s.ranks.length > 1 ? `${s.name} (rank ${top.rank})` : s.name, right: `${low.mp} MP`, disabled: low.mp > b.mp, rank: RANK.magic,
        detail: [s.kind === 'heal' ? (s.targets === 'all' ? 'Heals the whole party' : 'Heals one of the party') : s.targets === 'all' ? 'Hits every foe' : '', low.charge ? `charges ${low.charge} turn${low.charge === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || undefined };
    });
    this.screen.choose('Magic', list, (i) => this.rankMenu(b, b.spells[i]), () => this.commandMenu(b), () => this.showOrder(RANK.magic));
  }

  /** Spells known at more than one rank: choose the rank (higher hits harder, costs more and charges longer). */
  private rankMenu(b: Battler, s: BattleSpell): void {
    const go = (r: SpellRank) => {
      const back = () => (s.ranks.length > 1 ? this.rankMenu(b, s) : this.magicMenu(b));
      if (s.targets === 'all') { this.phase = 'busy'; this.doSpell(b, s, r, (s.kind === 'heal' ? this.party : this.foes).filter(isUp)); return; }
      this.pickTarget((s.kind === 'heal' ? this.party : this.foes).filter(isUp), (t) => this.doSpell(b, s, r, [t]), back);
    };
    if (s.ranks.length === 1) { go(s.ranks[0]); return; }
    this.screen.choose(s.name, s.ranks.map((r) => ({ label: r.name, right: `${r.mp} MP`, disabled: r.mp > b.mp, rank: RANK.magic,
      detail: r.charge ? `Charges ${r.charge} turn${r.charge === 1 ? '' : 's'} before it goes off` : 'Goes off at once' })),
    (i) => go(s.ranks[i]), () => this.magicMenu(b), () => this.showOrder(RANK.magic), s.ranks.length - 1);
  }

  private itemMenu(b: Battler): void {
    const items = this.host.items();
    if (!items.length) { this.commandMenu(b); return; }
    this.screen.choose('Items', items.map((it) => ({ label: it.name, right: `×${it.count}`, detail: it.detail, rank: RANK.item })), (i) => {
      const it = items[i];
      this.pickTarget(this.party.filter(isUp), (t) => this.doItem(b, it, t), () => this.itemMenu(b), b);
    }, () => this.commandMenu(b), () => this.showOrder(RANK.item));
  }

  private pickTarget(list: Battler[], pick: (t: Battler) => void, back: () => void, start?: Battler): void {
    if (!list.length) { back(); return; }
    // Start on the enemy with the least health left (or the actor themselves, for items).
    const first = start ?? [...list].sort((x, y) => x.hp - y.hp)[0];
    this.screen.target(list.map((t) => t.key), (k) => { const t = list.find((x) => x.key === k); if (t) { this.phase = 'busy'; pick(t); } }, () => { this.showOrder(); back(); }, first.key);
  }

  /* ------------------------------------------------------------------ actions */

  private doAttack(b: Battler, t: Battler): void {
    this.screen.animate(b.key, 'lunge');
    this.host.sound('swing');
    this.later(0.28, () => {
      this.hit(b, t, b.attack, b.attackElement, b.attackMagic, b.inflicts);
      this.endTurn(b, RANK.attack, 0.75);
    });
  }

  /** Cast a spell: the magic is spent now; it goes off at once, or charges for its turns first. */
  private doSpell(b: Battler, s: BattleSpell, r: SpellRank, targets: Battler[]): void {
    b.mp = Math.max(0, b.mp - r.mp);
    this.refresh(b);
    const color = s.color ?? ELEMENT_COLORS[s.element];
    if (r.charge > 0) {
      b.charging = { spell: s, rank: r, targets, left: r.charge };
      this.screen.setCharging(b.key, `${r.name} · ${r.charge}`, color);
      this.screen.message(`${b.name} begins casting ${r.name}…`);
      this.screen.animate(b.key, 'cast', color);
      this.host.sound('ringOn');
      this.host.log(`${b.name} begins casting ${r.name}`);
      this.endTurn(b, RANK.magic, 0.8);
      return;
    }
    this.release(b, s, r, targets);
  }

  /** A charging spell's turn: one turn closer, or it goes off now (at whoever is still standing). */
  private chargeTurn(b: Battler): void {
    const c = b.charging!;
    if (b.status.silenced) { this.interrupt(b, 'Silenced'); this.endTurn(b, RANK.magic, 0.8); return; }
    c.left--;
    if (c.left > 0) {
      this.screen.setCharging(b.key, `${c.rank.name} · ${c.left}`);
      this.screen.message(`${b.name} keeps casting ${c.rank.name}…`);
      this.endTurn(b, RANK.magic, 0.7);
      return;
    }
    b.charging = null;
    this.screen.setCharging(b.key, null);
    const side = (c.spell.kind === 'heal' ? this.sideOf(b) : this.otherSide(b)).filter(isUp);
    let targets = c.targets.filter(isUp);
    if (!targets.length && side.length) targets = c.spell.targets === 'all' ? side : [side[0]];
    if (!targets.length) { this.endTurn(b, RANK.magic, 0.3); return; }
    this.release(b, c.spell, c.rank, targets);
  }

  /** A charging spell broken (a Counterspell, Silence): the magic spent is lost. */
  private interrupt(b: Battler, why: string): void {
    const c = b.charging;
    if (!c) return;
    b.charging = null;
    this.screen.setCharging(b.key, null);
    this.screen.popup(b.key, why === 'Silenced' ? 'Spell lost' : 'Interrupted!', 'info');
    this.screen.message(`${b.name}’s ${c.rank.name} is ${why === 'Silenced' ? 'silenced' : 'broken'}!`);
    this.host.sound('block');
    this.host.log(`${b.name}’s ${c.rank.name} was interrupted`);
  }

  private release(b: Battler, s: BattleSpell, r: SpellRank, targets: Battler[]): void {
    const color = s.color ?? ELEMENT_COLORS[s.element];
    this.screen.message(r.name);
    this.screen.animate(b.key, 'cast', color);
    this.host.sound(s.kind === 'heal' ? 'ringOn' : 'fire');
    this.later(0.4, () => {
      for (const t of targets) {
        if (!isUp(t)) continue;
        if (s.kind === 'heal') this.heal(b, t, healAmount(r.power, t));
        else this.hit(b, t, r.power, s.element, true, s.inflicts, color);
      }
      this.endTurn(b, RANK.magic, 0.8);
    });
  }

  /**
   * An Addition: the hero closes in, and each strike lands if its button is pressed as the ring meets the marker.
   * A miss ends the string (a first strike missed still lands, weakly). Performed in full, it counts towards the
   * next rank.
   */
  private doAddition(b: Battler, a: BattleAddition, t: Battler): void {
    this.screen.message(a.name);
    this.screen.animate(b.key, 'lunge');
    this.later(0.35, () => {
      let landed = 0;
      const hitOnce = (power: number, last: boolean) => {
        if (!isUp(t)) return;
        this.host.sound('swing');
        this.hit(b, t, power, b.attackElement, b.attackMagic, last ? b.inflicts : undefined);
      };
      this.screen.startQte(t.key, a.strikes.map((x) => ({ button: x.button, time: x.time, window: x.window })), this.cfg.additionTiming === 'auto',
        (i: number, r: QteResult) => {
          const st = a.strikes[i];
          if (r === 'miss') {
            this.screen.popup(t.key, i === 0 ? 'Weak' : 'Missed', 'info');
            if (i === 0) hitOnce(b.attack * st.power * a.damage * 0.5, true);
            return;
          }
          landed++;
          if (r === 'perfect') this.screen.popup(t.key, 'Perfect!', 'info');
          this.screen.animate(b.key, 'lunge');
          hitOnce(b.attack * st.power * a.damage * (r === 'perfect' ? 1.1 : 1), i === a.strikes.length - 1);
        },
        () => {
          const complete = landed === a.strikes.length;
          if (complete) {
            this.screen.popup(b.key, a.strikes.length > 1 ? `${a.name}!` : 'Complete!', 'info');
            const up = this.host.mastered?.(this.entry(b).who ?? 0, a.id) ?? null;
            if (up) { this.screen.popup(b.key, `${a.name} rank ${up}!`, 'info'); this.host.log(`${b.name}’s ${a.name} reached rank ${up}`); this.host.sound('levelUp'); a.rank = up; }
          }
          this.endTurn(b, RANK.attack, 0.6);
        });
    });
  }

  private doItem(b: Battler, it: BattleItem, t: Battler): void {
    const who = this.entry(t).who ?? 0;
    const r = this.host.useItem(it.slot, who, t.status.list);
    // It did nothing (full health, say): say so and choose again; the turn isn't lost.
    if (!r?.used) { this.screen.message(r?.text || 'It wouldn’t do anything.'); this.phase = 'command'; this.later(1.1, () => this.itemMenu(b)); return; }
    // The item worked on the game's numbers: read them back.
    for (const p of this.party) {
      const e = this.entry(p), before = p.hp, mpBefore = p.mp, v = this.host.readVitals(e.who ?? 0);
      p.hp = v.hp; p.mp = v.mp;
      if (p.hp > before) this.screen.popup(p.key, `+${Math.round(p.hp - before)}`, 'heal');
      if (p.mp > mpBefore) this.screen.popup(p.key, `+${Math.round(p.mp - mpBefore)} MP`, 'mp');
      this.refresh(p);
    }
    const cured = r.cures.length ? t.status.cure(r.cures) : [];
    if (cured.length) { refreshAgility(t); this.screen.popup(t.key, `Cured ${cured.map(ailmentName).join(', ')}`, 'info'); this.refresh(t); }
    this.host.sound('item');
    this.screen.animate(t.key, 'heal', '#9dffb0');
    const msg = cured.length && !/cured/i.test(r.text) ? `${r.text.replace(/\.$/, '')}: cured ${cured.map(ailmentName).join(', ')}.` : r.text;
    this.screen.message(msg);
    this.host.log(msg);
    this.endTurn(b, RANK.item, 0.9);
  }

  /** Guard: half damage, some health back and no new ailments until their next turn (Legend of Dragoon). */
  private doGuard(b: Battler): void {
    b.guarding = true;
    b.status.ward = true;
    const n = Math.round(b.maxHp * this.cfg.guardHeal / 100);
    if (n > 0 && b.hp < b.maxHp) {
      const got = Math.min(n, b.maxHp - b.hp);
      if (b.status.zombie) this.damage(b, got, false);
      else { b.hp += got; this.screen.popup(b.key, `+${got}`, 'heal'); }
    }
    this.refresh(b);
    this.host.sound('guard');
    this.screen.animate(b.key, 'heal', '#8cc8ff');
    this.screen.message(`${b.name} guards`);
    this.endTurn(b, RANK.guard, 0.6);
  }

  private doFlee(b: Battler): void {
    const chance = fleeChance(this.party, this.foes, this.cfg.flee);
    if (Math.random() < chance) {
      this.host.sound('dodge');
      this.screen.message('Got away safely!', true);
      this.host.log('You got away');
      this.phase = 'over';
      this.later(1, () => this.close('fled'));
      return;
    }
    this.host.sound('menuBack');
    this.screen.message('Couldn’t get away!');
    this.endTurn(b, RANK.flee, 0.8);
  }

  /** Confused: attacks someone at random, friend or foe. */
  private confusedTurn(b: Battler): void {
    const all = this.battlers.filter((x) => isUp(x) && x !== b);
    const t = all[Math.floor(Math.random() * all.length)];
    this.screen.message(`${b.name} is confused!`);
    if (!t) { this.endTurn(b, RANK.attack, 0.8); return; }
    this.later(0.5, () => {
      this.screen.animate(b.key, 'lunge');
      this.host.sound('swing');
      this.later(0.28, () => { this.hit(b, t, b.attack, b.attackElement, b.attackMagic, b.inflicts); this.endTurn(b, RANK.attack, 0.75); });
    });
  }

  private enemyTurn(e: Battler): void {
    const move = enemyChoice(e, this.party, this.foes);
    if (!move) { this.endTurn(e, RANK.attack, 0.2); return; }
    const a = move.action;
    if (!a) {
      const t = move.targets[0];
      this.screen.message(`${e.name} attacks!`);
      this.screen.animate(e.key, 'lunge');
      this.host.sound('swing');
      this.later(0.3, () => { this.hit(e, t, e.attack, e.attackElement, e.attackMagic, e.inflicts, undefined, !!e.counterspell); this.endTurn(e, RANK.attack, 0.8); });
      return;
    }
    this.screen.message(`${e.name}: ${a.name || this.actionWord(a)}`);
    if (a.kind === 'guard') { this.doGuard(e); return; }
    if (a.kind === 'heal') {
      const t = move.targets[0];
      this.screen.animate(e.key, 'cast', '#9dffb0');
      this.host.sound('ringOn');
      this.later(0.4, () => { this.heal(e, t, healAmount(t.maxHp * (a.power ?? 30) / 100, t)); this.endTurn(e, RANK.magic, 0.8); });
      return;
    }
    const magic = a.kind === 'spell';
    const element: Element = a.element ?? e.attackElement;
    this.screen.animate(e.key, magic ? 'cast' : 'lunge', magic ? ELEMENT_COLORS[element] : undefined);
    this.host.sound(magic ? 'fire' : 'swing');
    this.later(magic ? 0.45 : 0.3, () => {
      for (const t of move.targets) if (isUp(t)) this.hit(e, t, e.attack * (a.power ?? 1), element, magic, a.inflicts ?? (magic ? undefined : e.inflicts), undefined, !!a.counterspell);
      this.endTurn(e, magic ? RANK.magic : RANK.attack, 0.85);
    });
  }

  private actionWord(a: EnemyAction): string { return { attack: 'Strike', spell: 'Spell', heal: 'Heal', guard: 'Guard' }[a.kind]; }

  /** One fighter hits another: blindness, elements, criticals, guarding and the side's damage scale, then ailments. */
  private hit(by: Battler, t: Battler, power: number, element: Element, magic: boolean, inflicts?: Inflict[], color?: string, counter = false): void {
    // Blind: half of their weapon attacks miss (spells still land).
    if (!magic && by.status.blind && Math.random() < BLIND_MISS_CHANCE) {
      this.screen.popup(t.key, 'Miss', 'info');
      this.host.sound('dodge');
      this.host.log(`${by.name} misses`);
      return;
    }
    const scale = by.side === 'party' ? this.cfg.partyDamage : this.cfg.enemyDamage;
    const r = strike(power, element, magic, by, t, scale);
    const tint = color ?? (element !== 'neutral' ? ELEMENT_COLORS[element] : undefined);
    if (r.kind === 'immune') { this.screen.popup(t.key, 'Immune', 'info'); this.host.sound('block'); this.host.log(`${t.name} is immune`); return; }
    if (r.kind === 'absorb') {
      t.hp = Math.min(t.maxHp, t.hp + r.amount);
      this.screen.popup(t.key, `+${r.amount}`, 'heal');
      this.screen.popup(t.key, 'Absorbed', 'info');
      this.host.sound('ringOn');
      this.refresh(t);
      return;
    }
    if (r.crit) { this.screen.flash('rgba(255,250,230,0.7)'); this.screen.popup(t.key, 'Critical!', 'info'); }
    if (r.label) this.screen.popup(t.key, r.label === 'Weak!' ? 'Weak!' : 'Resist', 'info');
    if (r.label === 'Weak!') this.host.sound('weak');
    this.damage(t, r.amount, r.crit, tint);
    this.host.log(`${by.name} hits ${t.name} for ${r.amount}${r.crit ? ' (critical)' : ''}${r.label === 'Weak!' ? ' (super effective)' : r.label === 'Resist' ? ' (resisted)' : ''}`);
    // A Counterspell breaks a spell being charged.
    if (counter && isUp(t) && t.charging) this.interrupt(t, 'Counterspell');
    if (isUp(t)) this.inflict(t, inflicts);
  }

  /** Roll a hit's ailments on someone still standing. */
  private inflict(t: Battler, inflicts?: Inflict[]): void {
    for (const f of rollInflicts(inflicts)) {
      const res = t.status.give(f.ailment, f.turns);
      if (res === 'resisted' && t.status.ward) { this.screen.popup(t.key, 'Warded', 'info'); continue; }
      if (res === 'resisted' || res === 'none') continue;
      if (f.ailment === 'stagger') t.ct += tickOf(t.agility) * 1.5;
      const a: BattleAilment = res === 'frozen' ? 'frozen' : f.ailment;
      this.screen.popup(t.key, AILMENT_WORD[a], 'info');
      this.host.log(`${t.name}: ${ailmentName(a)}`);
      refreshAgility(t);
    }
    this.refresh(t);
  }

  private heal(by: Battler, t: Battler, n: number): void {
    // The undead (and zombies) are hurt by healing.
    if (n < 0) { this.damage(t, -n, false); return; }
    t.hp = Math.min(t.maxHp, t.hp + n);
    this.screen.popup(t.key, `+${n}`, 'heal');
    this.screen.animate(t.key, 'heal', '#9dffb0');
    this.host.log(`${by.name} heals ${t.name} for ${n}`);
    this.refresh(t);
  }

  private damage(t: Battler, n: number, crit: boolean, color?: string): void {
    t.hp = Math.max(0, t.hp - n);
    this.screen.popup(t.key, String(n), crit ? 'crit' : 'dmg', color);
    this.screen.animate(t.key, 'hit');
    this.host.sound(t.side === 'party' ? 'hurt' : crit ? 'crit' : 'hit');
    // A hit wakes the sleeping.
    if (t.hp > 0 && t.status.hurt()) this.screen.popup(t.key, 'Woke up', 'info');
    if (t.hp <= 0) this.fall(t);
    this.refresh(t);
  }

  /** Knocked out: ailments go with it. */
  private fall(t: Battler): void {
    t.guarding = false;
    if (t.charging) { t.charging = null; this.screen.setCharging(t.key, null); }
    for (const a of t.status.list) if (a !== 'zombie') t.status.turns.delete(a);
    t.status.chillStacks = 0;
    refreshAgility(t);
    setTimeout(() => this.screen.animate(t.key, 'faint'), 260);
    if (t.side === 'enemy') { this.host.sound('defeat'); this.host.log(`${t.name} defeated`); }
    else this.host.log(`${t.name} is knocked out`);
  }

  private endTurn(b: Battler, rank: number, pause: number): void {
    // Ailments tick down at the end of the afflicted fighter's own turn.
    const gone = isUp(b) ? b.status.endTurn() : [];
    if (gone.length) {
      refreshAgility(b);
      this.screen.popup(b.key, gone.length === 1 ? `${ailmentName(gone[0])} wore off` : 'Recovered', 'info');
    }
    this.refresh(b);
    if (this.cfg.order === 'ctb') spend(b, rank);
    this.phase = 'busy';
    this.later(pause, () => { if (!this.checkOver()) this.phase = 'next'; });
  }

  /* ------------------------------------------------------------------ the end */

  private checkOver(): boolean {
    if (this.phase === 'over') return true;
    if (!this.foes.some(isUp)) { this.win(); return true; }
    if (!this.party.some(isUp)) { this.lose(); return true; }
    return false;
  }

  private win(): void {
    this.phase = 'over';
    this.screen.idle();
    this.screen.setOrder([], null);
    this.screen.message('Victory!', true);
    const beaten = this.all.filter((e) => e.battler.side === 'enemy').map((e) => e.ref);
    this.writeParty();
    this.later(0.9, () => {
      const lines = this.host.victory(beaten);
      this.screen.message('');
      this.screen.result('Victory!', lines);
      this.screen.waitForOk(() => this.close('victory'));
    });
  }

  private lose(): void {
    this.phase = 'over';
    this.screen.idle();
    this.screen.message('The party has fallen…', true);
    this.writeParty();
    this.later(1.8, () => this.close('defeat'));
  }

  private close(outcome: BattleOutcome): void {
    this.writeParty();
    const beaten = outcome === 'victory' ? this.all.filter((e) => e.battler.side === 'enemy').map((e) => e.ref) : [];
    this.phase = 'off';
    this.wait = 0; this.then = null;
    this.screen.close();
    this.host.finished(outcome, beaten);
  }

  /* ------------------------------------------------------------------ keeping the screen and the game in step */

  private writeParty(): void {
    for (const e of this.all) if (e.battler.side === 'party') this.host.writeVitals(e.who ?? 0, e.battler.hp, e.battler.mp);
  }

  private refresh(b: Battler): void {
    const st = b.status;
    this.screen.setVitals(b.key, {
      hp: b.hp, maxHp: b.maxHp, mp: b.mp, maxMp: b.maxMp, guarding: b.guarding,
      status: st.list.map((a) => ({ icon: statusIconUrl(a), name: `${ailmentName(a)}${Number.isFinite(st.turns.get(a)!) ? ` (${st.turns.get(a)} turn${st.turns.get(a) === 1 ? '' : 's'})` : ''}` })),
    });
    // The party's numbers are the game's too (a save, the HUD).
    if (b.side === 'party') this.host.writeVitals(this.entry(b).who ?? 0, b.hp, b.mp);
  }

  private refreshAll(): void { for (const b of this.battlers) this.refresh(b); }

  /** Abandon the battle at once (quitting to the title, loading a save): nothing is handed out. */
  abort(): void {
    if (this.phase === 'off') return;
    this.phase = 'off';
    this.wait = 0; this.then = null;
    this.screen.close();
  }
}

