/**
 * The pause menu's Party tab, laid out like the handheld monster games: the lead (whoever is first in the lineup) in a
 * big card on the left, everyone else down the right (those fighting, then the reserve). A message box along the
 * bottom says what to do; choosing someone opens what can be done for them in a menu at the bottom right (Status,
 * Equipment, Skill Tree, Addition, Magic, Swap). Swap then asks where to move them: pick anyone to trade places.
 * Anyone with skill points to spend shows a LEVEL UP badge.
 * Keys: ↑ ↓ choose (← → between the lead and the list) · Space opens · Esc back · LB / RB other tabs.
 */
import { elementPill } from './elementPill';
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
  skillPoints: number;
  down?: boolean;
  /** Can't leave the active party (Database → Combat: the hero always fights). */
  locked?: boolean;
  /** Their elements (element stones worn), as pills. */
  elements?: import('../world/types').Element[];
  /** An ailment they carry (from the map, or left from a battle), as a pill ("PSN"). */
  ailment?: { tag: string; color: string; ink: string; name: string };
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

type Mode = { kind: 'pick' } | { kind: 'actions'; index: number } | { kind: 'swap'; to: number };

export class PartyScreen {
  private readonly root = document.createElement('div');
  private open = false;
  /** Who is chosen: their place in the lineup (0: the lead). */
  private sel = 0;
  /** The last place chosen in the list on the right (→ from the lead goes back there). */
  private listSel = 1;
  private mode: Mode = { kind: 'pick' };
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
    if (!keep) this.mode = { kind: 'pick' };
    this.sel = Math.min(this.sel, Math.max(0, this.all().length - 1));
    this.root.hidden = false;
    this.render();
  }

  /** Put away without closing (another pause tab is taking over). */
  hide(): void { this.open = false; this.root.hidden = true; }

  private all(): PartyMemberView[] { return this.host.members(); }

  /** Whether the chosen one can trade places with whoever is at `k`. */
  private canSwapWith(k: number): boolean {
    const all = this.all(), me = all[this.sel], o = all[k];
    if (!me || !o || k === this.sel) return false;
    // Someone who always fights can only change places with the others fighting (and nobody takes their place from the bench).
    if (me.locked && k >= this.host.active) return false;
    if (o.locked && this.sel >= this.host.active) return false;
    return true;
  }

  private close(): void { this.open = false; this.root.hidden = true; uiSound('menuBack'); this.onClose(); }

  private back(): void {
    if (this.mode.kind === 'swap') { this.mode = { kind: 'actions', index: this.swapIndex() }; uiSound('menuBack'); this.render(); return; }
    if (this.mode.kind === 'actions') { this.mode = { kind: 'pick' }; uiSound('menuBack'); this.render(); return; }
    this.close();
  }

  private swapIndex(): number { return Math.max(0, this.actionList().findIndex((a) => a.id === 'swap')); }

  private actionList(): PartyAction[] {
    const me = this.all()[this.sel];
    if (!me) return [];
    const others = this.all().some((_, k) => this.canSwapWith(k));
    return [...this.host.actions(me.who), { id: 'swap', label: 'Swap', detail: 'Trade places with someone else in the party', disabled: !others }, { id: 'cancel', label: 'Cancel' }];
  }

  private pick(): void {
    const all = this.all(), me = all[this.sel];
    if (!me) return;
    if (this.mode.kind === 'pick') { this.mode = { kind: 'actions', index: Math.max(0, this.actionList().findIndex((a) => !a.disabled)) }; uiSound('menuOk'); this.render(); return; }
    if (this.mode.kind === 'actions') {
      const a = this.actionList()[this.mode.index];
      if (!a || a.disabled) return;
      if (a.id === 'cancel') { this.back(); return; }
      uiSound('menuOk');
      if (a.id === 'swap') {
        const first = all.findIndex((_, k) => this.canSwapWith(k));
        this.mode = { kind: 'swap', to: Math.max(0, first) };
        this.render();
        return;
      }
      const onClose = this.onClose, tabs = this.tabs;
      this.open = false;
      this.root.hidden = true;
      this.host.run(me.who, a.id, () => this.show(onClose, tabs, true));
      return;
    }
    const to = this.mode.to;
    if (!this.canSwapWith(to)) return;
    this.host.swap(me.who, all[to].who);
    uiSound('menuOk');
    // Stay on the place they moved to.
    this.sel = to;
    if (to > 0) this.listSel = to;
    this.mode = { kind: 'pick' };
    this.render();
  }

  /** Move the choice: ↑ ↓ through everyone, ← to the lead, → back into the list. */
  private move(get: () => number, set: (k: number) => void, ok: (k: number) => boolean): boolean {
    const i = this.input, n = this.all().length;
    if (!n) return false;
    const go = (k: number) => { if (k === get()) return; set(k); uiSound('menuMove'); this.render(); };
    const step = (d: number) => { let k = get(); for (let c = 0; c < n; c++) { k = (k + d + n) % n; if (ok(k)) { go(k); return; } } };
    if (i.consume('down')) { step(1); return true; }
    if (i.consume('up')) { step(-1); return true; }
    if (i.consume('left')) { if (ok(0)) go(0); return true; }
    if (i.consume('right')) { const k = get() === 0 ? Math.min(this.listSel, n - 1) : get(); if (k > 0 && ok(k)) go(k); else step(1); return true; }
    return false;
  }

  update(): void {
    if (!this.open) return;
    const i = this.input, m = this.mode;
    if (i.consume('cancel')) { this.back(); return; }
    if (m.kind === 'pick') {
      if (tabKeys(i, this.tabs)) return;
      if (this.move(() => this.sel, (k) => { this.sel = k; if (k > 0) this.listSel = k; }, () => true)) return;
    } else if (m.kind === 'swap') {
      if (this.move(() => m.to, (k) => { m.to = k; }, (k) => this.canSwapWith(k))) return;
    } else {
      const list = this.actionList(), len = list.length;
      const step = (d: number) => {
        let k = m.index;
        for (let c = 0; c < len; c++) { k = (k + d + len) % len; if (!list[k]?.disabled) break; }
        if (k !== m.index) { m.index = k; uiSound('menuMove'); this.render(); }
      };
      if (len && i.consume('down')) { step(1); return; }
      if (len && i.consume('up')) { step(-1); return; }
    }
    if (i.confirm()) this.pick();
  }

  private render(): void {
    const all = this.all(), m = this.mode, me = all[this.sel];
    const pct = (v: number, max: number) => Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
    const hpTier = (c: PartyMemberView) => { const s = c.hp[0] / Math.max(1, c.hp[1]); return s <= 0.2 ? ' low' : s <= 0.5 ? ' mid' : ''; };
    const lv = (c: PartyMemberView) => `<span class="lv-pill" style="color:#3a2200">Lv ${c.level}</span>`;
    const ail = (c: PartyMemberView) => c.down ? '<span class="st-pill" style="background:#5a5a68;color:#f4f4fa" title="Knocked out">KO</span>'
      : c.ailment ? `<span class="st-pill" style="background:${c.ailment.color};color:${c.ailment.ink}" title="${esc(c.ailment.name)}">${esc(c.ailment.tag)}</span>` : '';
    const slotCls = (k: number) => {
      const c = all[k], target = m.kind === 'swap' && m.to === k;
      return `${k === this.sel ? ' sel' : ''}${target ? ' target' : ''}${m.kind === 'swap' && !this.canSwapWith(k) && k !== this.sel ? ' dim' : ''}${c.down ? ' down' : ''}`;
    };
    const lead = all[0];
    const leadCard = lead ? `<div class="pr-lead pr-slot${slotCls(0)}" data-k="0" role="option" aria-selected="${this.sel === 0}"${lead.color ? ` style="--hero:${lead.color}"` : ''}>
        ${lead.skillPoints > 0 ? '<span class="pt-badge">LEVEL UP</span>' : ''}
        <div class="pr-art"><img src="${lead.art}" alt=""></div>
        <div class="pr-name"><b>${esc(lead.name)}</b>${lv(lead)}${ail(lead)}</div>
        ${lead.elements?.length ? `<div class="pr-els">${lead.elements.map((e) => elementPill(e)).join('')}</div>` : ''}
        <div class="pr-line"><span class="pr-k">HP</span><div class="pr-bar hp${hpTier(lead)}"><i style="width:${pct(lead.hp[0], lead.hp[1])}%"></i></div></div>
        <div class="pr-num">${Math.round(lead.hp[0])} / ${Math.round(lead.hp[1])}</div>
        <div class="pr-line"><span class="pr-k">MP</span><div class="pr-bar mp"><i style="width:${pct(lead.mp[0], lead.mp[1])}%"></i></div></div>
        <div class="pr-num">${Math.round(lead.mp[0])} / ${Math.round(lead.mp[1])}</div>
        <div class="pr-line"><span class="pr-k">EXP</span><div class="pr-bar xp"><i style="width:${lead.xp.next === null ? 100 : pct(lead.xp.have, lead.xp.next)}%"></i></div></div>
      </div>` : '';
    const rows = all.slice(1).map((c, j) => {
      const k = j + 1, first = k === this.host.active;
      return `${first ? '<div class="pr-sep">Reserve</div>' : ''}<div class="pr-row pr-slot${slotCls(k)}${k >= this.host.active ? ' bench' : ''}" data-k="${k}" role="option" aria-selected="${this.sel === k}"${c.color ? ` style="--hero:${c.color}"` : ''}>
        <img class="pr-face" src="${c.portrait}" alt="">
        <div class="pr-row-main">
          <div class="pr-row-top"><b>${esc(c.name)}</b>${lv(c)}${ail(c)}${c.skillPoints > 0 ? '<span class="pr-up">LEVEL UP</span>' : ''}${c.elements?.length ? `<span class="pr-els">${c.elements.map((e) => elementPill(e)).join('')}</span>` : ''}</div>
          <div class="pr-line"><span class="pr-k">HP</span><div class="pr-bar hp${hpTier(c)}"><i style="width:${pct(c.hp[0], c.hp[1])}%"></i></div><span class="pr-num">${Math.round(c.hp[0])} / ${Math.round(c.hp[1])}</span></div>
          <div class="pr-line thin"><span class="pr-k">MP</span><div class="pr-bar mp"><i style="width:${pct(c.mp[0], c.mp[1])}%"></i></div><span class="pr-num">${Math.round(c.mp[0])} / ${Math.round(c.mp[1])}</span></div>
        </div>
      </div>`;
    }).join('');
    const acts = m.kind === 'actions' ? this.actionList() : null;
    const act = acts ? acts[(m as { index: number }).index] : null;
    const msg = m.kind === 'pick' ? (all.length > 1 ? 'Choose a party member.' : `${esc(me?.name ?? '')} is on their own.`)
      : m.kind === 'actions' ? `Do what with ${esc(me?.name ?? '')}?${act?.detail ? `<small>${esc(act.detail)}</small>` : ''}`
        : `Move ${esc(me?.name ?? '')} to where?`;
    const note = m.kind === 'pick' ? '↑ ↓ ← → choose · Space: open · Esc: close'
      : m.kind === 'actions' ? '↑ ↓ choose · Space: open · Esc: back' : '↑ ↓ ← → choose · Space: swap · Esc: back';
    this.root.innerHTML = `<div class="inv-box pr-box">
      <div class="pr-main">
        <div class="pr-left">${leadCard}</div>
        <div class="pr-list" role="listbox">${rows || '<p class="pr-empty">Nobody else has joined yet.</p>'}</div>
      </div>
      <div class="pr-foot">
        <div class="pr-msg">${msg}</div>
        ${acts ? `<div class="pr-menu" role="listbox">${acts.map((a, p) => `<button type="button" class="menu-item" data-p="${p}" ${a.disabled ? 'disabled' : ''} aria-selected="${p === (m as { index: number }).index}"><span class="menu-label">${esc(a.label)}</span></button>`).join('')}</div>` : ''}
      </div>
      <div class="menu-note">${esc(note)}</div>
    </div>`;
    this.root.querySelectorAll<HTMLElement>('.pr-slot').forEach((el) => el.addEventListener('click', () => {
      const k = Number(el.dataset.k);
      if (this.mode.kind === 'swap') { if (this.canSwapWith(k)) { this.mode.to = k; this.pick(); } return; }
      if (k === this.sel && this.mode.kind === 'pick') { this.pick(); return; }
      this.sel = k; if (k > 0) this.listSel = k;
      this.mode = { kind: 'pick' }; uiSound('menuMove'); this.render();
    }));
    this.root.querySelectorAll<HTMLElement>('[data-p]').forEach((el) => el.addEventListener('click', () => {
      if (this.mode.kind !== 'actions') return;
      this.mode.index = Number(el.dataset.p); this.pick();
    }));
  }
}
