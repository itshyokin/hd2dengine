/**
 * The pause menu's Party tab: the three fighting (the active party) as tall cards with their art, name, level,
 * health, magic and EXP. ← → choose one; Space opens what can be done for them (Status, Equipment, Skill Tree, Stats,
 * Addition, Magic, Swap). Swap opens the rest of the party (Legend of Dragoon style) to trade places with.
 * Anyone with points to spend has a gold outline and a LEVEL UP badge.
 * Keys: ← → choose · Space opens · ↑ ↓ in lists · Esc back · LB / RB other tabs.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';
import { esc } from './InventoryScreen';
import { tabKeys, type TabGroup } from './tabs';

export interface PartyMemberView {
  /** 0 the hero, k the k-th party member. */
  who: number;
  name: string; level: number;
  /** A small portrait (lists) and the big picture on the card (face art, or the sprite drawn large). */
  portrait: string; art: string;
  color?: string;
  hp: [number, number]; mp: [number, number];
  /** EXP into this level and needed for the next (null: the top level). */
  xp: { have: number; next: number | null };
  skillPoints: number; statPoints: number;
  down?: boolean;
  /** Can't leave the active party (Database → Combat: the hero always fights). */
  locked?: boolean;
}

export interface PartyAction { id: string; label: string; detail?: string; disabled?: boolean }

export interface PartyHost {
  /** Everyone, in lineup order: the first `active` fight. */
  members(): PartyMemberView[];
  active: number;
  /** What can be done for someone. */
  actions(who: number): PartyAction[];
  /** Do it (opening another screen hides this one; `back` brings it back). */
  run(who: number, action: string, back: () => void): void;
  /** Trade places in the lineup. */
  swap(a: number, b: number): void;
}

type Mode = { kind: 'cards' } | { kind: 'actions'; index: number } | { kind: 'swap'; index: number };

export class PartyScreen {
  private readonly root = document.createElement('div');
  private open = false;
  private sel = 0;
  private mode: Mode = { kind: 'cards' };
  private tabs: TabGroup | undefined;
  private onClose: () => void = () => {};

  constructor(parent: HTMLElement, private readonly input: Input, private readonly host: PartyHost) {
    this.root.className = 'inv party-screen';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Party');
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) { e.preventDefault(); this.back(); } });
    this.root.addEventListener('click', () => (document.activeElement as HTMLElement | null)?.blur?.());
    parent.appendChild(this.root);
  }

  get isOpen(): boolean { return this.open; }

  show(onClose: () => void, tabs?: TabGroup, keep = false): void {
    this.open = true;
    this.onClose = onClose;
    this.tabs = tabs;
    if (!keep) this.mode = { kind: 'cards' };
    this.sel = Math.min(this.sel, Math.max(0, this.cards().length - 1));
    this.root.hidden = false;
    this.render();
  }

  /** Put away without closing (another pause tab is taking over). */
  hide(): void { this.open = false; this.root.hidden = true; }

  private cards(): PartyMemberView[] { return this.host.members().slice(0, this.host.active); }
  /** Who the chosen card can trade places with: the others fighting, then the bench. */
  private others(): PartyMemberView[] {
    const all = this.host.members(), me = this.cards()[this.sel];
    // Someone who always fights can only change places with the others fighting.
    return all.filter((m, k) => m.who !== me?.who && (!me?.locked || k < this.host.active));
  }

  private close(): void { this.open = false; this.root.hidden = true; uiSound('menuBack'); this.onClose(); }

  private back(): void {
    if (this.mode.kind !== 'cards') { this.mode = this.mode.kind === 'swap' ? { kind: 'actions', index: this.swapIndex() } : { kind: 'cards' }; uiSound('menuBack'); this.render(); return; }
    this.close();
  }

  private swapIndex(): number { return Math.max(0, this.actionList().findIndex((a) => a.id === 'swap')); }

  private actionList(): PartyAction[] {
    const me = this.cards()[this.sel];
    if (!me) return [];
    const list = this.host.actions(me.who);
    return [...list, { id: 'swap', label: 'Swap', detail: me.locked ? 'Always fights: change places with the others fighting' : 'Trade places with someone else in the party', disabled: this.others().length < 1 }];
  }

  private pick(): void {
    const me = this.cards()[this.sel];
    if (!me) return;
    if (this.mode.kind === 'cards') { this.mode = { kind: 'actions', index: Math.max(0, this.actionList().findIndex((a) => !a.disabled)) }; uiSound('menuOk'); this.render(); return; }
    if (this.mode.kind === 'actions') {
      const a = this.actionList()[this.mode.index];
      if (!a || a.disabled) return;
      uiSound('menuOk');
      if (a.id === 'swap') { this.mode = { kind: 'swap', index: 0 }; this.render(); return; }
      const onClose = this.onClose, tabs = this.tabs;
      this.open = false;
      this.root.hidden = true;
      this.host.run(me.who, a.id, () => this.show(onClose, tabs, true));
      return;
    }
    const other = this.others()[this.mode.index];
    if (!other) return;
    this.host.swap(me.who, other.who);
    uiSound('menuOk');
    // The newcomer takes this card's place: stay on the card, back to choosing.
    this.mode = { kind: 'cards' };
    this.render();
  }

  update(): void {
    if (!this.open) return;
    const i = this.input, m = this.mode;
    if (i.consume('cancel')) { this.back(); return; }
    if (m.kind === 'cards') {
      if (tabKeys(i, this.tabs)) return;
      const n = this.cards().length;
      if (n && (i.consume('left') || i.consume('up'))) { this.sel = (this.sel + n - 1) % n; uiSound('menuMove'); this.render(); return; }
      if (n && (i.consume('right') || i.consume('down'))) { this.sel = (this.sel + 1) % n; uiSound('menuMove'); this.render(); return; }
    } else {
      const len = m.kind === 'actions' ? this.actionList().length : this.others().length;
      const dis = (k: number) => (m.kind === 'actions' ? !!this.actionList()[k]?.disabled : false);
      const step = (d: number) => {
        let k = m.index;
        for (let c = 0; c < len; c++) { k = (k + d + len) % len; if (!dis(k)) break; }
        if (k !== m.index) { m.index = k; uiSound('menuMove'); this.render(); }
      };
      if (len && (i.consume('down') || (m.kind === 'swap' && i.consume('right')))) { step(1); return; }
      if (len && (i.consume('up') || (m.kind === 'swap' && i.consume('left')))) { step(-1); return; }
    }
    if (i.confirm()) this.pick();
  }

  private render(): void {
    const list = this.cards(), all = this.host.members(), m = this.mode;
    const pct = (v: number, max: number) => Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
    const bar = (cls: string, v: number, max: number, label: string) =>
      `<div class="pc-bar ${cls}"><span>${label}</span><b>${Math.round(v)} / ${Math.round(max)}</b><div><i style="width:${pct(v, max)}%"></i></div></div>`;
    const cards = list.map((c, k) => {
      const up = c.skillPoints > 0 || c.statPoints > 0;
      const gains = [c.skillPoints > 0 ? `${c.skillPoints} Skill Point${c.skillPoints === 1 ? '' : 's'}` : '', c.statPoints > 0 ? `${c.statPoints} Stat Increase${c.statPoints === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
      const xp = c.xp.next === null ? 100 : pct(c.xp.have, c.xp.next);
      const actions = k === this.sel && m.kind === 'actions' ? this.actionList() : null;
      return `<div class="pc-card${k === this.sel ? ' sel' : ''}${up ? ' lvlup' : ''}${c.down ? ' down' : ''}" data-k="${k}" role="option" aria-selected="${k === this.sel}"${c.color ? ` style="--hero:${c.color}"` : ''}>
        ${up ? '<span class="pt-badge">LEVEL UP</span>' : ''}
        <div class="pc-art"><img src="${c.art}" alt=""></div>
        <div class="pc-name"><b>${esc(c.name)}</b><small>Lv ${c.level}${c.down ? ' · KO' : ''}</small></div>
        ${bar('hp', c.hp[0], c.hp[1], 'HP')}${bar('mp', c.mp[0], c.mp[1], 'MP')}
        <div class="pc-bar xp"><span>EXP</span><b>${c.xp.next === null ? 'MAX' : `${c.xp.have} / ${c.xp.next}`}</b><div><i style="width:${xp}%"></i></div></div>
        ${gains ? `<div class="pt-gains">${gains}</div>` : ''}
        ${actions ? `<div class="pc-actions" role="listbox">${actions.map((a, p) => `<button type="button" class="menu-item" data-p="${p}" ${a.disabled ? 'disabled' : ''} aria-selected="${m.kind === 'actions' && p === m.index}"><span class="menu-label">${esc(a.label)}</span></button>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    const bench = all.slice(this.host.active);
    let swap = '';
    if (m.kind === 'swap') {
      const me = list[this.sel], others = this.others();
      swap = `<div class="pc-swap"><div class="pc-swap-title">Swap ${esc(me?.name ?? '')} with…</div><div class="pc-swap-list" role="listbox">${others.map((o, p) => {
        const fighting = all.indexOf(o) < this.host.active;
        return `<button type="button" class="pc-mini${p === m.index ? ' sel' : ''}${o.down ? ' down' : ''}" data-s="${p}" aria-selected="${p === m.index}">
          <img src="${o.portrait}" alt=""><span><b>${esc(o.name)}</b><small>Lv ${o.level} · HP ${Math.round(o.hp[0])}/${Math.round(o.hp[1])} · MP ${Math.round(o.mp[0])}/${Math.round(o.mp[1])}${fighting ? ' · in the party' : ''}</small></span></button>`;
      }).join('') || '<p class="pc-empty">Nobody else to swap with.</p>'}</div></div>`;
    }
    const sel = list[this.sel], act = m.kind === 'actions' ? this.actionList()[m.index] : null;
    const note = m.kind === 'cards' ? '← → choose · Space: open · Esc: close'
      : m.kind === 'actions' ? `${act?.detail ?? ''}${act?.detail ? ' · ' : ''}↑ ↓ choose · Space: open · Esc: back`
        : '↑ ↓ choose · Space: swap · Esc: back';
    this.root.innerHTML = `<div class="inv-box pc-box">
      <div class="pc-cards" role="listbox">${cards}</div>
      ${bench.length && m.kind !== 'swap' ? `<div class="pc-bench"><span>Reserve</span>${bench.map((b) => `<img src="${b.portrait}" alt="${esc(b.name)}" title="${esc(b.name)} · Lv ${b.level}"${b.down ? ' class="down"' : ''}>`).join('')}</div>` : ''}
      ${swap}
      <div class="menu-note">${esc(note)}</div>
    </div>`;
    void sel;
    this.root.querySelectorAll<HTMLElement>('.pc-card').forEach((el) => el.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).closest<HTMLElement>('[data-p]');
      const k = Number(el.dataset.k);
      if (p && this.mode.kind === 'actions') { this.mode.index = Number(p.dataset.p); this.pick(); return; }
      if (k === this.sel && this.mode.kind === 'cards') { this.pick(); return; }
      this.sel = k; this.mode = { kind: 'cards' }; uiSound('menuMove'); this.render();
    }));
    this.root.querySelectorAll<HTMLElement>('[data-s]').forEach((el) => el.addEventListener('click', () => {
      if (this.mode.kind !== 'swap') return;
      this.mode.index = Number(el.dataset.s); this.pick();
    }));
  }
}
