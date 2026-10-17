/**
 * A hero's Status page (Party → a hero → Status): their numbers on the left, what they're wearing in the middle, and
 * on the right who they are (About, from the database), any ailments, and their fighting style (party members), which
 * is the one thing to change here. Equipping is done from the bag.
 * Keys: ↑ ↓ choose a fighting style · Space picks it · Esc back.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';
import { ATTRS, ATTR_INFO, type Attr } from '../game/attributes';
import { rankPill, type Rank } from '../game/statRanks';
import { esc } from './InventoryScreen';
import type { EquipChoice, EquipView } from './EquipScreen';

export interface CharacterHost {
  hero(h: number): { name: string; level: number; portrait: string; color: string; about?: string };
  gauges(h: number): { hp: [number, number]; mp: [number, number]; sp: [number, number]; xp: { have: number; next: number | null } };
  slots(h: number): { label: string; item: EquipChoice | null }[];
  view(h: number): EquipView;
  ailments(h: number): { name: string; icon: string; left?: string }[];
  /** Party members' fighting styles (null for the hero you play), with a line on what each does. */
  styles(h: number): { value: string; options: { value: string; name: string; does: string }[]; note?: string } | null;
  setStyle(h: number, value: string): void;
  /** Each stat's progression rank (A … F), shown as a pill beside it. */
  ranks?(h: number): Record<Attr, Rank>;
}

export class CharacterScreen {
  private readonly root = document.createElement('div');
  private open = false;
  private hero = 0;
  private sel = 0;
  private onClose: () => void = () => {};

  constructor(parent: HTMLElement, private readonly input: Input, private readonly host: CharacterHost) {
    this.root.className = 'inv char-screen';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Status');
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) { e.preventDefault(); this.close(); } });
    this.root.addEventListener('click', () => (document.activeElement as HTMLElement | null)?.blur?.());
    parent.appendChild(this.root);
  }

  get isOpen(): boolean { return this.open; }

  show(hero: number, onClose: () => void): void {
    this.hero = hero;
    this.onClose = onClose;
    this.open = true;
    const st = this.host.styles(hero);
    this.sel = st ? Math.max(0, st.options.findIndex((o) => o.value === st.value)) : 0;
    this.root.hidden = false;
    this.render();
  }

  private close(): void { this.open = false; this.root.hidden = true; uiSound('menuBack'); this.onClose(); }
  /** Put away without going back (another pause tab was picked). */
  hide(): void { this.open = false; this.root.hidden = true; }

  update(): void {
    if (!this.open) return;
    const i = this.input, st = this.host.styles(this.hero);
    if (i.consume('cancel')) { this.close(); return; }
    if (!st) { i.confirm(); return; }
    const n = st.options.length;
    if (i.consume('up') || i.consume('left')) { this.sel = (this.sel + n - 1) % n; uiSound('menuMove'); this.render(); return; }
    if (i.consume('down') || i.consume('right')) { this.sel = (this.sel + 1) % n; uiSound('menuMove'); this.render(); return; }
    if (i.confirm()) this.pick(this.sel);
  }

  private pick(k: number): void {
    const st = this.host.styles(this.hero);
    if (!st?.options[k]) return;
    this.sel = k;
    this.host.setStyle(this.hero, st.options[k].value);
    uiSound('menuOk');
    this.render();
  }

  private render(): void {
    const h = this.host, k = this.hero, who = h.hero(k), g = h.gauges(k), v = h.view(k), st = h.styles(k), ail = h.ailments(k);
    const bar = (label: string, [a, max]: [number, number], cls: string) =>
      `<div class="cs-bar ${cls}"><span>${label}</span><div><i style="width:${Math.max(0, Math.min(100, (a / Math.max(1, max)) * 100))}%"></i></div><b>${Math.round(a)} / ${Math.round(max)}</b></div>`;
    const xp = g.xp.next === null ? 1 : g.xp.have / Math.max(1, g.xp.next);
    const stat = (label: string, val: number | string, pill = '') => `<div class="cs-stat"><span>${label}</span>${pill}<b>${val}</b></div>`;
    const rk = h.ranks?.(k);
    const slots = h.slots(k).map((s) => `<div class="cs-slot"><span class="eq-label">${esc(s.label)}</span>${s.item ? `<img src="${s.item.icon}" alt="">` : '<span class="eq-empty"></span>'}
      <span class="eq-name${s.item ? '' : ' none'}"${s.item?.color ? ` style="color:${s.item.color}"` : ''}>${s.item ? esc(s.item.name) : '(nothing)'}</span>${s.item?.shard ? `<img class="eq-shard" src="${s.item.shard.icon}" alt="${esc(s.item.shard.name)}" title="Set with ${esc(s.item.shard.name)}">` : '<span></span>'}</div>`).join('');
    this.root.innerHTML = `<div class="inv-box cs-box" style="--hero:${who.color}">
      <div class="inv-head"><span class="menu-title">Status</span><span class="sk-points">${esc(who.name)}</span></div>
      <div class="cs-body">
        <div class="cs-left">
          <div class="cs-id"><img class="cs-face" src="${who.portrait}" alt=""><div><b>${esc(who.name)}</b><small>Level ${who.level}</small></div></div>
          ${bar('HP', g.hp, 'hp')}${bar('MP', g.mp, 'mp')}${bar('SP', g.sp, 'sp')}
          <div class="cs-bar xp"><span>EXP</span><div><i style="width:${Math.round(xp * 100)}%"></i></div><b>${g.xp.next === null ? 'MAX' : `${g.xp.have} / ${g.xp.next}`}</b></div>
          <div class="cs-stats">${ATTRS.map((a) => stat(ATTR_INFO[a].name, v.attrs[a], rk ? rankPill(rk[a]) : '')).join('')}<hr>
            ${stat('Melee damage', Math.round(v.melee))}${stat('Bow damage', Math.round(v.bow))}${stat('Spell damage', Math.round(v.spell))}
            ${stat('Critical hits', `${Math.round(v.crit)}%`)}${stat('Defence', Math.round(v.armour))}${stat('Magic defence', Math.round(v.magicArmour))}</div>
        </div>
        <div class="cs-mid"><div class="eq-col-title">Equipped</div>${slots}<p class="cs-hint">Equip and take things off in the bag (Inventory → Gear, Shards).</p></div>
        <div class="cs-right">
          <div class="cs-who"><b>${esc(who.name)}</b><small>Level ${who.level}</small></div>
          <div class="eq-col-title">About</div>
          <p class="cs-about">${who.about ? esc(who.about).replace(/\n/g, '<br>') : '<span class="cs-none">Nothing written about them yet.</span>'}</p>
          <div class="eq-col-title">Ailments</div>
          ${ail.length ? `<div class="cs-ail">${ail.map((a) => `<span><img src="${a.icon}" alt=""> ${esc(a.name)}${a.left ? ` <small>${esc(a.left)}</small>` : ''}</span>`).join('')}</div>` : '<p class="cs-none">None.</p>'}
          ${st ? `<div class="eq-col-title">Fighting style</div>
          <div class="cs-styles" role="listbox">${st.options.map((o, j) => `<button type="button" class="cs-style${j === this.sel ? ' sel' : ''}${o.value === st.value ? ' on' : ''}" data-s="${j}" role="option" aria-selected="${j === this.sel}">
            <span class="cs-dot" aria-hidden="true"></span><span><b>${esc(o.name)}</b><small>${esc(o.does)}</small></span></button>`).join('')}</div>
          ${st.note ? `<p class="cs-note">${esc(st.note)}</p>` : ''}` : ''}
        </div>
      </div>
      <div class="menu-note">${st ? '↑ ↓ choose a fighting style · Space: use it · ' : ''}Esc: back</div>
    </div>`;
    this.root.querySelectorAll<HTMLElement>('[data-s]').forEach((b) => b.addEventListener('click', () => this.pick(Number(b.dataset.s))));
  }
}
