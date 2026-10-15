/**
 * Character creation, after New Game: the hero's stats rolled (4d6, drop the lowest, then arranged), bought with
 * points, or from the standard array, or (hard) 3d6 in order. Each way keeps its result while you look at the
 * others; "Use these stats" asks once more before they're final.
 * Keys: ←/→ or LB/RB change the way, ↑/↓ pick a stat, Space swaps two values (or ←/→ change a bought stat),
 * R / Y rerolls, Esc goes back.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';
import {
  ATTRS, ATTR_INFO, POINT_BUY, STANDARD_ARRAY, type Attr, type Attrs, type CreationMethod,
  arranged, attrEffect, baseAttrs, nextCost, pointsSpent, roll3d6, roll4d6, swapOrder,
} from '../game/attributes';
import { esc } from './InventoryScreen';

/** A stat's effect, red when it's a penalty. */
const effSpan = (k: Attr, v: number): string => { const t = attrEffect(k, v); return `<span class="mk-eff${/^−|more damage/.test(t) ? ' bad' : ''}">${t}</span>`; };

export interface CreationOptions {
  heroName: string;
  methods: CreationMethod[];
  /** Rerolls allowed (0: no limit). */
  rerolls: number;
  /** The key or button that rerolls, for the hint. */
  rerollKey: string;
}

interface Rolled { values: number[]; dice: number[][]; order: number[] }

const TAB_NAMES: Record<CreationMethod, string> = { roll: 'Roll', pointBuy: 'Point buy', array: 'Standard array', hard: 'Hard (3d6)' };
const TAB_HINTS: Record<CreationMethod, string> = {
  roll: 'Four dice for each value, the lowest dropped. Swap values between stats to arrange them.',
  pointBuy: `Every stat starts at ${POINT_BUY.min}. Spend ${POINT_BUY.budget} points to raise them, up to ${POINT_BUY.max}. Higher steps cost more.`,
  array: `The same set for everyone: ${STANDARD_ARRAY.join(', ')}. Swap values between stats to arrange them.`,
  hard: 'Three dice for each stat, in order: no swapping, no rerolls. For a real challenge.',
};

export class CreationScreen {
  private readonly root = document.createElement('div');
  private open = false;
  private opts!: CreationOptions;
  private tab = 0;
  /** Selected row: 0 – 4 the stats, 5 "Use these stats". */
  private row = 0;
  /** A value picked up to swap (row index), or null. */
  private picked: number | null = null;
  private confirming = false;
  private rolled: Rolled | null = null;
  private hard: Rolled | null = null;
  private arrayOrder = [0, 1, 2, 3, 4];
  private bought: Attrs = baseAttrs(POINT_BUY.min);
  private rerollsUsed = 0;
  private done: (a: Attrs, how: CreationMethod) => void = () => {};
  private back: () => void = () => {};

  constructor(parent: HTMLElement, private readonly input: Input) {
    this.root.className = 'inv creation-screen';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Create your hero');
    this.root.addEventListener('click', () => (document.activeElement as HTMLElement | null)?.blur?.());
    parent.appendChild(this.root);
  }

  get isOpen(): boolean { return this.open; }

  show(opts: CreationOptions, done: (a: Attrs, how: CreationMethod) => void, back: () => void): void {
    this.opts = { ...opts, methods: opts.methods.length ? opts.methods : ['roll', 'pointBuy', 'array'] };
    this.done = done; this.back = back;
    this.open = true;
    this.tab = 0; this.row = 0; this.picked = null; this.confirming = false;
    this.rolled = null; this.hard = null; this.arrayOrder = [0, 1, 2, 3, 4]; this.bought = baseAttrs(POINT_BUY.min); this.rerollsUsed = 0;
    this.ensure();
    this.root.hidden = false;
    this.render();
  }

  private close(): void { this.open = false; this.root.hidden = true; }

  private get method(): CreationMethod { return this.opts.methods[this.tab]; }

  /** Roll a method's values the first time it's shown. */
  private ensure(): void {
    if (this.method === 'roll' && !this.rolled) this.rolled = this.roll(roll4d6);
    if (this.method === 'hard' && !this.hard) this.hard = this.roll(roll3d6);
  }

  private roll(f: typeof roll4d6): Rolled {
    const r = ATTRS.map(() => f());
    return { values: r.map((x) => x.total), dice: r.map((x) => x.dice), order: [0, 1, 2, 3, 4] };
  }

  /** The stats the current way gives. */
  private stats(m: CreationMethod = this.method): Attrs {
    if (m === 'roll') return this.rolled ? arranged(this.rolled.values, this.rolled.order) : baseAttrs();
    if (m === 'hard') return this.hard ? arranged(this.hard.values, this.hard.order) : baseAttrs();
    if (m === 'array') return arranged(STANDARD_ARRAY, this.arrayOrder);
    return { ...this.bought };
  }

  private get rerollsLeft(): number | null { return this.opts.rerolls > 0 ? Math.max(0, this.opts.rerolls - this.rerollsUsed) : null; }

  update(): void {
    if (!this.open) return;
    const i = this.input;
    if (this.confirming) {
      if (i.consume('cancel')) { this.confirming = false; uiSound('menuBack'); this.render(); return; }
      if (i.consume('left') || i.consume('right') || i.consume('up') || i.consume('down')) { this.confirmSel = 1 - this.confirmSel; uiSound('menuMove'); this.render(); return; }
      if (i.confirm()) { if (this.confirmSel === 0) this.finish(); else { this.confirming = false; uiSound('menuBack'); this.render(); } }
      return;
    }
    if (i.consume('cancel')) {
      uiSound('menuBack');
      if (this.picked !== null) { this.picked = null; this.render(); return; }
      this.close(); this.back();
      return;
    }
    if (i.consume('tabPrev')) { this.switchTab(-1); return; }
    if (i.consume('tabNext')) { this.switchTab(1); return; }
    if (i.consume('switchWeapon')) { this.reroll(); return; }
    if (i.consume('up')) { this.row = (this.row + 5) % 6; uiSound('menuMove'); this.render(); return; }
    if (i.consume('down')) { this.row = (this.row + 1) % 6; uiSound('menuMove'); this.render(); return; }
    const l = i.consume('left'), r = i.consume('right');
    if (l || r) {
      if (this.method === 'pointBuy' && this.row < 5) this.buy(this.row, r ? 1 : -1);
      else this.switchTab(r ? 1 : -1);
      return;
    }
    if (i.confirm()) this.activate(this.row);
  }

  private confirmSel = 0;

  private switchTab(d: number): void {
    const n = this.opts.methods.length;
    if (n < 2) return;
    this.tab = (this.tab + d + n) % n;
    this.picked = null;
    this.ensure();
    uiSound('menuMove');
    this.render();
  }

  private reroll(): void {
    if (this.method !== 'roll') return;
    const left = this.rerollsLeft;
    if (left === 0) { uiSound('menuBack'); return; }
    this.rerollsUsed++;
    this.rolled = this.roll(roll4d6);
    this.picked = null;
    uiSound('dice');
    this.render();
    this.root.querySelector('.mk-stats')?.classList.add('rolling');
  }

  private buy(k: number, d: number): void {
    const a = ATTRS[k], v = this.bought[a] + d;
    if (v < POINT_BUY.min || v > POINT_BUY.max) { uiSound('menuBack'); return; }
    const after = { ...this.bought, [a]: v };
    if (pointsSpent(after) > POINT_BUY.budget) { uiSound('menuBack'); return; }
    this.bought = after;
    uiSound('menuMove');
    this.render();
  }

  /** OK on a row: pick up / swap a value, or use these stats. */
  private activate(row: number): void {
    if (row === 5) {
      if (this.method === 'pointBuy' && pointsSpent(this.bought) < POINT_BUY.budget && !this.warnedLeft) { this.warnedLeft = true; uiSound('menuBack'); this.render(); return; }
      this.confirming = true; this.confirmSel = 0; uiSound('menuOk'); this.render(); return;
    }
    const m = this.method;
    if (m === 'pointBuy' || m === 'hard') return;
    if (this.picked === null) { this.picked = row; uiSound('menuOk'); this.render(); return; }
    if (this.picked !== row) {
      if (m === 'roll' && this.rolled) this.rolled.order = swapOrder(this.rolled.order, this.picked, row);
      if (m === 'array') this.arrayOrder = swapOrder(this.arrayOrder, this.picked, row);
      uiSound('menuOk');
    }
    this.picked = null;
    this.render();
  }

  private warnedLeft = false;

  private finish(): void {
    uiSound('menuOk');
    const a = this.stats(), how = this.method;
    this.close();
    this.done(a, how);
  }

  private render(): void {
    const o = this.opts, m = this.method, a = this.stats();
    const tabs = o.methods.length > 1 ? `<div class="sk-tabs mk-tabs" role="tablist">${o.methods.map((x, k) =>
      `<button type="button" role="tab" class="sk-tab" data-tab="${k}" aria-selected="${k === this.tab}" style="--c:#ffb04a">${TAB_NAMES[x]}</button>`).join('')}</div>` : '';
    const rolled = m === 'roll' ? this.rolled : m === 'hard' ? this.hard : null;
    const rows = ATTRS.map((k, i) => {
      const info = ATTR_INFO[k], v = a[k];
      let extra = '';
      if (rolled) {
        const vi = rolled.order[i], dice = rolled.dice[vi], low = m === 'roll' ? dice.indexOf(Math.min(...dice)) : -1;
        extra = `<span class="mk-dice">${dice.map((d, j) => `<span class="mk-die${j === low ? ' dropped' : ''}">${d}</span>`).join('')}</span>`;
      } else if (m === 'pointBuy') {
        const nc = nextCost(v);
        extra = `<span class="mk-buy"><button type="button" class="mk-pm" data-buy="${i}" data-d="-1" aria-label="Lower ${info.name}" ${v <= POINT_BUY.min ? 'disabled' : ''}>−</button><button type="button" class="mk-pm" data-buy="${i}" data-d="1" aria-label="Raise ${info.name}" ${nc === null ? 'disabled' : ''}>+</button><span class="mk-cost">${nc === null ? 'max' : `next: ${nc} pt${nc === 1 ? '' : 's'}`}</span></span>`;
      }
      const cls = ['mk-row', i === this.row ? 'sel' : '', this.picked === i ? 'picked' : ''].join(' ');
      return `<div class="${cls}" data-row="${i}" role="option" aria-selected="${i === this.row}">
        <span class="mk-short">${info.short}</span><span class="mk-name">${info.name}<small>${info.does}</small></span>
        <span class="mk-val">${v}</span>${effSpan(k, v)}${extra}</div>`;
    }).join('');
    const left = POINT_BUY.budget - pointsSpent(this.bought);
    const status = m === 'pointBuy' ? `<span class="mk-points">Points left: <b>${left}</b> / ${POINT_BUY.budget}</span>`
      : m === 'roll' ? `<span class="mk-points">Total ${ATTRS.reduce((s, k) => s + a[k], 0)} · <button type="button" class="btn-link mk-reroll" ${this.rerollsLeft === 0 ? 'disabled' : ''}>Reroll (${esc(o.rerollKey)})</button>${this.rerollsLeft !== null ? ` · ${this.rerollsLeft} left` : ''}</span>`
      : `<span class="mk-points">Total ${ATTRS.reduce((s, k) => s + a[k], 0)}</span>`;
    const hint = this.picked !== null ? `Now choose the stat to swap ${ATTR_INFO[ATTRS[this.picked]].name} with.` : TAB_HINTS[m];
    const warn = this.warnedLeft && m === 'pointBuy' && left > 0 ? `<div class="mk-warn">You still have ${left} point${left === 1 ? '' : 's'} to spend. Choose again to continue anyway.</div>` : '';
    const confirm = this.confirming ? `<div class="mk-confirm" role="alertdialog">
        <p>Use these ${m === 'roll' ? 'rolled' : m === 'pointBuy' ? 'bought' : m === 'array' ? 'standard' : 'hard-mode'} stats for ${esc(o.heroName)}?</p>
        <p class="mk-sum">${ATTRS.map((k) => `${ATTR_INFO[k].short} <b>${a[k]}</b>`).join(' · ')}</p>
        <p class="mk-note">They can't be changed afterwards (levelling up gives points to raise them).</p>
        <div class="mk-yn"><button type="button" class="menu-item" data-yn="0" aria-selected="${this.confirmSel === 0}"><span class="menu-label">Yes, begin</span></button><button type="button" class="menu-item" data-yn="1" aria-selected="${this.confirmSel === 1}"><span class="menu-label">Not yet</span></button></div>
      </div>` : '';
    this.root.innerHTML = `<div class="inv-box mk-box">
      <div class="inv-head"><span class="menu-title">Create your hero</span><span class="sk-points">${esc(o.heroName)}</span></div>
      ${tabs}
      <p class="mk-hint">${esc(hint)}</p>
      <div class="mk-stats" role="listbox">${rows}</div>
      <div class="mk-foot">${status}<button type="button" class="menu-item mk-use" data-row="5" aria-selected="${this.row === 5}"><span class="menu-label">Use these stats</span></button></div>
      ${warn}
      <div class="menu-note">${o.methods.length > 1 ? 'LB / RB or ← → : another way · ' : ''}↑ ↓ choose · ${m === 'pointBuy' ? '← → lower / raise' : m === 'hard' ? '' : 'Space: swap two values'} · Esc: back</div>
      ${confirm}
    </div>`;
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { const k = Number(b.dataset.tab); if (k !== this.tab) this.switchTab(k - this.tab); }));
    this.root.querySelectorAll<HTMLElement>('.mk-row').forEach((el) => el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.mk-pm')) return;
      const r = Number(el.dataset.row);
      this.row = r;
      this.activate(r);
      if (this.method === 'pointBuy') this.render();
    }));
    this.root.querySelectorAll<HTMLButtonElement>('.mk-pm').forEach((b) => b.addEventListener('click', () => { this.row = Number(b.dataset.buy); this.buy(this.row, Number(b.dataset.d)); }));
    this.root.querySelector('.mk-use')?.addEventListener('click', () => { this.row = 5; this.activate(5); });
    this.root.querySelector('.mk-reroll')?.addEventListener('click', () => this.reroll());
    this.root.querySelectorAll<HTMLElement>('[data-yn]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.yn === '0') this.finish(); else { this.confirming = false; this.render(); } }));
  }
}
