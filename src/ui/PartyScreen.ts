/**
 * Party: everyone in the party (the hero first) with their level, health, magic and EXP. Pick one for their
 * Equipment, Skill Tree or Stats (where level-up points are spent); coming back lands here again, so another can be
 * picked. Anyone with points to spend has a gold outline, a LEVEL UP badge and what they have to spend.
 * Keys: ↑ ↓ (← →) choose · Space picks · Esc back.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';
import { esc } from './InventoryScreen';

export type PartyPage = 'equip' | 'skills' | 'stats';

export interface PartyMemberView {
  name: string; level: number; portrait: string;
  hp: [number, number]; mp: [number, number];
  /** EXP into this level and needed for the next (null: the top level). */
  xp: { have: number; next: number | null };
  skillPoints: number; statPoints: number;
  down?: boolean;
}

export interface PartyHost {
  members(): PartyMemberView[];
  /** Open one of a member's pages; `back` brings the Party screen back. */
  open(hero: number, page: PartyPage, back: () => void): void;
}

const PAGES: [PartyPage, string][] = [['equip', 'Status'], ['skills', 'Skill Tree'], ['stats', 'Stats']];

export class PartyScreen {
  private readonly root = document.createElement('div');
  private open = false;
  private sel = 0;
  /** The page list for the chosen member (null: choosing a member). */
  private page: number | null = null;
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

  show(onClose: () => void, keepPage = false): void {
    this.open = true;
    this.onClose = onClose;
    if (!keepPage) this.page = null;
    this.sel = Math.min(this.sel, Math.max(0, this.host.members().length - 1));
    this.root.hidden = false;
    this.render();
  }

  private close(): void { this.open = false; this.root.hidden = true; uiSound('menuBack'); this.onClose(); }

  private back(): void {
    if (this.page !== null) { this.page = null; uiSound('menuBack'); this.render(); return; }
    this.close();
  }

  private go(): void {
    if (this.page === null) { this.page = 0; uiSound('menuOk'); this.render(); return; }
    const page = PAGES[this.page][0], hero = this.sel, onClose = this.onClose;
    uiSound('menuOk');
    this.open = false;
    this.root.hidden = true;
    // Coming back from the page: here again, on the same member and page.
    this.host.open(hero, page, () => this.show(onClose, true));
  }

  update(): void {
    if (!this.open) return;
    const i = this.input, n = this.host.members().length;
    if (i.consume('cancel')) { this.back(); return; }
    if (this.page !== null) {
      if (i.consume('up') || i.consume('left')) { this.page = (this.page + PAGES.length - 1) % PAGES.length; uiSound('menuMove'); this.render(); return; }
      if (i.consume('down') || i.consume('right')) { this.page = (this.page + 1) % PAGES.length; uiSound('menuMove'); this.render(); return; }
    } else if (n) {
      if (i.consume('up') || i.consume('left')) { this.sel = (this.sel + n - 1) % n; uiSound('menuMove'); this.render(); return; }
      if (i.consume('down') || i.consume('right')) { this.sel = (this.sel + 1) % n; uiSound('menuMove'); this.render(); return; }
    }
    if (i.confirm()) this.go();
  }

  private render(): void {
    const list = this.host.members();
    const bar = (cls: string, v: number, max: number, label: string) =>
      `<div class="pt-bar ${cls}"><span>${label}</span><div><i style="width:${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%"></i></div><b>${Math.round(v)} / ${Math.round(max)}</b></div>`;
    const cards = list.map((m, k) => {
      const up = m.skillPoints > 0 || m.statPoints > 0;
      const gains = [m.skillPoints > 0 ? `${m.skillPoints} Skill Point${m.skillPoints === 1 ? '' : 's'}` : '', m.statPoints > 0 ? `${m.statPoints} Stat Increase${m.statPoints === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
      const xp = m.xp.next === null ? 1 : m.xp.have / Math.max(1, m.xp.next);
      const open = this.page !== null && k === this.sel;
      return `<div class="pt-card${k === this.sel ? ' sel' : ''}${up ? ' lvlup' : ''}${m.down ? ' down' : ''}" data-k="${k}" role="option" aria-selected="${k === this.sel}">
        ${up ? '<span class="pt-badge">LEVEL UP</span>' : ''}
        <img class="pt-face" src="${m.portrait}" alt="">
        <div class="pt-main">
          <div class="pt-name"><b>${esc(m.name)}</b><small>Level ${m.level}${m.down ? ' · knocked out' : ''}</small></div>
          ${bar('hp', m.hp[0], m.hp[1], 'HP')}${bar('mp', m.mp[0], m.mp[1], 'MP')}
          <div class="pt-bar xp"><span>EXP</span><div><i style="width:${Math.round(xp * 100)}%"></i></div><b>${m.xp.next === null ? 'MAX' : `${m.xp.have} / ${m.xp.next}`}</b></div>
          ${gains ? `<div class="pt-gains">${gains}</div>` : ''}
        </div>
        ${open ? `<div class="pt-pages" role="listbox">${PAGES.map(([, label], p) => `<button type="button" class="menu-item" data-p="${p}" aria-selected="${p === this.page}"><span class="menu-label">${label}</span></button>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    this.root.innerHTML = `<div class="inv-box pt-box">
      <div class="inv-head"><span class="menu-title">Party</span><span class="sk-points">${list.length} member${list.length === 1 ? '' : 's'}</span></div>
      <div class="pt-list" role="listbox">${cards}</div>
      <div class="menu-note">${this.page === null ? '↑ ↓ choose · Space: Status, Skill Tree or Stats · Esc: back' : '↑ ↓ choose · Space: open · Esc: back to the party'}</div>
    </div>`;
    this.root.querySelector('.pt-card.sel')?.scrollIntoView({ block: 'nearest' });
    this.root.querySelectorAll<HTMLElement>('.pt-card').forEach((el) => el.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).closest<HTMLElement>('[data-p]');
      const k = Number(el.dataset.k);
      if (p) { this.page = Number(p.dataset.p); this.go(); return; }
      if (k === this.sel && this.page === null) { this.go(); return; }
      this.sel = k; this.page = null; uiSound('menuMove'); this.render();
    }));
  }
}
