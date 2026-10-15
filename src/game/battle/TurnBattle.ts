/**
 * A turn-based battle from start to finish: who acts next (FFX-style conditional turns, or rounds), the party's
 * commands (Attack, Magic, Items, Guard, Run), the enemies' turns, and winning, losing or getting away.
 * The game supplies the fighters and does what lasts beyond the battle (items, rewards, the hero's health);
 * the screen shows it.
 */
import type { Sfx } from '../../audio/sfx';
import type { BattleScreen, ChoiceItem, FighterView } from '../../ui/BattleScreen';
import type { TurnBasedConfig } from '../combat/config';
import { ELEMENT_COLORS } from '../elements';
import {
  type Battler, type BattleSpell, type Opening, RANK, advanceTo, enemyChoice, fleeChance, forecast, healAmount, isUp, nextUp,
  roundOrder, spend, startCounters, strike,
} from './rules';

/** One fighter as the game hands it over. */
export interface BattleEntry { battler: Battler; view: FighterView; /** Party: 0 the hero, 1… members. */ who?: number; /** Enemies: the map's enemy (handed back when it's beaten). */ ref?: unknown }

export interface BattleItem { slot: number; name: string; count: number; detail?: string }

export type BattleOutcome = 'victory' | 'defeat' | 'fled';

export interface BattleHost {
  sound(name: Sfx): void;
  /** Items usable in battle (consumables in the bag) right now. */
  items(): BattleItem[];
  /** Use the item in bag slot `slot` on party member `who` (0 the hero): what happened, and whether it was used up. */
  useItem(slot: number, who: number): { text: string; used: boolean } | null;
  /** Health and magic of party member `who` as the game has them now (after an item, say). */
  readVitals(who: number): { hp: number; mp: number };
  /** Write a party member's health and magic back to the game. */
  writeVitals(who: number, hp: number, mp: number): void;
  /** The battle was won: hand out the rewards for these enemies and say what was won (lines for the panel). */
  victory(beaten: unknown[]): string[];
  /** The battle is over and its screen closed. */
  finished(outcome: BattleOutcome, beaten: unknown[]): void;
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

  start(entries: BattleEntry[], cfg: TurnBasedConfig, opening: Opening): void {
    this.all = entries;
    this.cfg = cfg;
    this.opening = opening;
    this.round = 0;
    this.queue = [];
    this.actor = null;
    this.lastCommand = 0;
    for (const e of entries) e.battler.guarding = false;
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
    // Guarding lasts until their own next turn.
    who.guarding = false;
    this.refresh(who);
    this.showOrder();
    if (who.side === 'party') this.commandMenu(who);
    else { this.phase = 'busy'; this.later(0.45, () => this.enemyTurn(who!)); }
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
    const canFlee = !this.foes.some((f) => isUp(f) && f.boss);
    const cmds: (ChoiceItem & { run: () => void })[] = [
      { label: 'Attack', rank: RANK.attack, run: () => this.pickTarget(this.foes.filter(isUp), (t) => this.doAttack(b, t), () => this.commandMenu(b)) },
      { label: 'Magic', rank: RANK.magic, disabled: !b.spells.length, right: b.spells.length ? '' : '—', run: () => this.magicMenu(b) },
      { label: 'Items', rank: RANK.item, disabled: !items.length, run: () => this.itemMenu(b) },
      { label: 'Guard', rank: RANK.guard, run: () => this.doGuard(b) },
      { label: 'Run', rank: RANK.flee, disabled: !canFlee, detail: canFlee ? undefined : 'Can’t run from this fight', run: () => this.doFlee(b) },
    ];
    this.screen.message(`${b.name}’s turn`, true);
    this.screen.choose(b.name, cmds, (i) => { this.lastCommand = i; this.screen.message(''); cmds[i].run(); }, undefined, (i) => this.showOrder(cmds[i].rank), this.lastCommand);
  }

  private magicMenu(b: Battler): void {
    const list = b.spells.map((s) => ({ label: s.name, right: `${s.mp} MP`, disabled: s.mp > b.mp, rank: RANK.magic, detail: s.kind === 'heal' ? 'Heals one of the party' : undefined }));
    this.screen.choose('Magic', list, (i) => {
      const s = b.spells[i];
      if (s.kind === 'heal') this.pickTarget(this.party.filter(isUp), (t) => this.doSpell(b, s, t), () => this.magicMenu(b));
      else this.pickTarget(this.foes.filter(isUp), (t) => this.doSpell(b, s, t), () => this.magicMenu(b));
    }, () => this.commandMenu(b), () => this.showOrder(RANK.magic));
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
    this.host.sound(b.attack > 0 && b.attackMagic ? 'fire' : 'swing');
    this.later(0.28, () => {
      this.hit(b, t, b.attack, b.attackElement, b.attackMagic);
      this.endTurn(b, RANK.attack, 0.75);
    });
  }

  private doSpell(b: Battler, s: BattleSpell, t: Battler): void {
    b.mp = Math.max(0, b.mp - s.mp);
    this.refresh(b);
    this.screen.message(s.name);
    this.screen.animate(b.key, 'cast', s.color ?? ELEMENT_COLORS[s.element]);
    this.host.sound(s.kind === 'heal' ? 'ringOn' : 'fire');
    this.later(0.4, () => {
      if (s.kind === 'heal') {
        const n = healAmount(s.power, t);
        if (n >= 0) { t.hp = Math.min(t.maxHp, t.hp + n); this.screen.popup(t.key, `+${n}`, 'heal'); this.screen.animate(t.key, 'heal', '#9dffb0'); this.host.log(`${b.name} heals ${t.name} for ${n}`); }
        else this.damage(t, -n, false);
        this.refresh(t);
      } else this.hit(b, t, s.power, s.element, true, s.color);
      this.endTurn(b, RANK.magic, 0.8);
    });
  }

  private doItem(b: Battler, it: BattleItem, t: Battler): void {
    const who = this.entry(t).who ?? 0;
    const r = this.host.useItem(it.slot, who);
    // It did nothing (full health, say): say so and choose again; the turn isn't lost.
    if (!r?.used) { this.screen.message(r?.text ?? 'It wouldn’t do anything.'); this.phase = 'command'; this.later(1.1, () => this.itemMenu(b)); return; }
    const msg = r.text;
    // The item worked on the game's numbers: read them back.
    for (const p of this.party) {
      const e = this.entry(p), before = p.hp, mpBefore = p.mp, v = this.host.readVitals(e.who ?? 0);
      p.hp = v.hp; p.mp = v.mp;
      if (p.hp > before) this.screen.popup(p.key, `+${Math.round(p.hp - before)}`, 'heal');
      if (p.mp > mpBefore) this.screen.popup(p.key, `+${Math.round(p.mp - mpBefore)} MP`, 'mp');
      this.refresh(p);
    }
    this.host.sound('item');
    this.screen.animate(t.key, 'heal', '#9dffb0');
    this.screen.message(msg);
    this.host.log(msg);
    this.endTurn(b, RANK.item, 0.9);
  }

  private doGuard(b: Battler): void {
    b.guarding = true;
    this.refresh(b);
    this.host.sound('guard');
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

  private enemyTurn(e: Battler): void {
    const c = enemyChoice(e, this.party);
    if (!c) { this.endTurn(e, RANK.attack, 0.2); return; }
    if (c.kind === 'spell' && c.spell) { this.doSpell(e, c.spell, c.target); return; }
    this.screen.message(`${e.name} attacks!`);
    this.screen.animate(e.key, 'lunge');
    this.host.sound('swing');
    this.later(0.3, () => {
      this.hit(e, c.target, e.attack, e.attackElement, e.attackMagic);
      this.endTurn(e, RANK.attack, 0.8);
    });
  }

  /** One fighter hits another: elements, criticals, guarding and the side's damage scale. */
  private hit(by: Battler, t: Battler, power: number, element: Battler['attackElement'], magic: boolean, color?: string): void {
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
  }

  private damage(t: Battler, n: number, crit: boolean, color?: string): void {
    t.hp = Math.max(0, t.hp - n);
    this.screen.popup(t.key, String(n), crit ? 'crit' : 'dmg', color);
    this.screen.animate(t.key, 'hit');
    this.host.sound(t.side === 'party' ? 'hurt' : crit ? 'crit' : 'hit');
    if (t.hp <= 0) {
      t.guarding = false;
      setTimeout(() => this.screen.animate(t.key, 'faint'), 260);
      if (t.side === 'enemy') { this.host.sound('defeat'); this.host.log(`${t.name} defeated`); }
      else this.host.log(`${t.name} is knocked out`);
    }
    this.refresh(t);
  }

  private endTurn(b: Battler, rank: number, pause: number): void {
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
    this.screen.setVitals(b.key, { hp: b.hp, maxHp: b.maxHp, mp: b.mp, maxMp: b.maxMp, guarding: b.guarding });
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
