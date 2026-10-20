/**
 * A hero's Status page (Party → a hero → Status), laid out like the handheld monster games' summary: the hero on the
 * left (their picture, name, level, elements and any ailment), and pages on the right: Profile (who they are and any
 * ailments), Stats (health, magic, their stats on the left and battle numbers on the right, EXP) and Gear (what
 * they're wearing; equipping is done from the bag).
 * Keys: ← → pages · Esc back.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';
import { ATTRS, ATTR_INFO, type Attr } from '../game/attributes';
import { rankPill, type Rank } from '../game/statRanks';
import { esc } from './InventoryScreen';
import { elementPill } from './elementPill';
import type { EquipChoice, EquipView } from './EquipScreen';

export interface CharacterHost {
  hero(h: number): { name: string; level: number; portrait: string; color: string; about?: string; art?: string; elements?: import('../world/types').Element[]; ailment?: { tag: string; color: string; ink: string; name: string } };
  gauges(h: number): { hp: [number, number]; mp: [number, number]; sp: [number, number]; xp: { have: number; next: number | null } };
  slots(h: number): { label: string; item: EquipChoice | null }[];
  view(h: number): EquipView;
  ailments(h: number): { name: string; icon: string; left?: string }[];
  /** Each stat's progression rank (A … F), shown as a pill beside it. */
  ranks?(h: number): Record<Attr, Rank>;
}

export class CharacterScreen {
  private readonly root = document.createElement('div');
  private open = false;
  private hero = 0;
  private page = 0;
  private onClose: () => void = () => {};
  private static readonly PAGES = ['Profile', 'Stats', 'Gear'];

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
    this.page = 0;
    this.root.hidden = false;
    this.render();
  }

  private close(): void { this.open = false; this.root.hidden = true; uiSound('menuBack'); this.onClose(); }
  /** Put away without going back (another pause tab was picked). */
  hide(): void { this.open = false; this.root.hidden = true; }

  private turn(d: number): void {
    const n = CharacterScreen.PAGES.length;
    this.page = (this.page + d + n) % n;
    uiSound('menuMove');
    this.render();
  }

  update(): void {
    if (!this.open) return;
    const i = this.input;
    if (i.consume('cancel')) { this.close(); return; }
    if (i.consume('left') || i.consume('up')) { this.turn(-1); return; }
    if (i.consume('right') || i.consume('down')) { this.turn(1); return; }
    i.confirm();
  }

  private render(): void {
    const h = this.host, k = this.hero, who = h.hero(k), g = h.gauges(k);
    const pct = (a: number, max: number) => Math.max(0, Math.min(100, (a / Math.max(1, max)) * 100));
    const bar = (label: string, [a, max]: [number, number], cls: string) =>
      `<div class="cs-bar ${cls}"><span>${label}</span><div><i style="width:${pct(a, max)}%"></i></div><b>${Math.round(a)} / ${Math.round(max)}</b></div>`;
    const pages = CharacterScreen.PAGES;
    let body = '';
    if (this.page === 0) {
      const ail = h.ailments(k);
      body = `<div class="cs-sec">About</div>
        <p class="cs-about">${who.about ? esc(who.about).replace(/\n/g, '<br>') : '<span class="cs-none">Nothing written about them yet.</span>'}</p>
        <div class="cs-sec">Ailments</div>
        ${ail.length || who.ailment ? `<div class="cs-ail">${who.ailment && !ail.length ? `<span><span class="st-pill" style="background:${who.ailment.color};color:${who.ailment.ink}">${esc(who.ailment.tag)}</span> ${esc(who.ailment.name)} <small>until cured or rested</small></span>` : ''}${ail.map((a) => `<span><img src="${a.icon}" alt=""> ${esc(a.name)}${a.left ? ` <small>${esc(a.left)}</small>` : ''}</span>`).join('')}</div>` : '<p class="cs-none">None.</p>'}
`;
    } else if (this.page === 1) {
      const v = h.view(k), rk = h.ranks?.(k);
      const cell = (label: string, val: number | string, pill = '') => `<div class="cs-cell"><span>${label}</span>${pill}<b>${val}</b></div>`;
      body = `<div class="cs-sec">Health and magic</div>
        ${bar('HP', g.hp, 'hp')}${bar('MP', g.mp, 'mp')}${bar('SP', g.sp, 'sp')}
        <div class="cs-cols">
          <div><div class="cs-sec">Stats</div><div class="cs-list">${ATTRS.map((a) => cell(ATTR_INFO[a].name, v.attrs[a], rk ? rankPill(rk[a]) : '')).join('')}</div></div>
          <div><div class="cs-sec">In battle</div><div class="cs-list">${cell('Melee damage', Math.round(v.melee))}${cell('Bow damage', Math.round(v.bow))}${cell('Spell damage', Math.round(v.spell))}
            ${cell('Critical hits', `${Math.round(v.crit)}%`)}${cell('Defence', Math.round(v.armour))}${cell('Magic defence', Math.round(v.magicArmour))}</div></div>
        </div>
        <div class="cs-sec">EXP</div>
        <div class="cs-grid">${cell('EXP points', g.xp.have)}${cell('Next level', g.xp.next === null ? '—' : Math.max(0, g.xp.next - g.xp.have))}</div>
        <div class="cs-bar xp"><span>EXP</span><div><i style="width:${g.xp.next === null ? 100 : pct(g.xp.have, g.xp.next)}%"></i></div><b>${g.xp.next === null ? 'MAX' : `${g.xp.have} / ${g.xp.next}`}</b></div>`;
    } else {
      const slots = h.slots(k).map((s) => `<div class="cs-slot"><span class="eq-label">${esc(s.label)}</span>${s.item ? `<img src="${s.item.icon}" alt="">` : '<span class="eq-empty"></span>'}
        <span class="eq-name${s.item ? '' : ' none'}"${s.item?.color ? ` style="color:${s.item.color}"` : ''}>${s.item ? esc(s.item.name) : '(nothing)'}</span>${s.item?.shard ? `<img class="eq-shard" src="${s.item.shard.icon}" alt="${esc(s.item.shard.name)}" title="Set with ${esc(s.item.shard.name)}">` : '<span></span>'}</div>`).join('');
      body = `<div class="cs-sec">Equipped</div>${slots}<p class="cs-hint">Equip and take things off in the bag (Inventory → Gear, Shards).</p>`;
    }
    this.root.innerHTML = `<div class="inv-box cs-box cs-summary" style="--hero:${who.color}">
      <div class="cs-body">
        <div class="cs-left">
          <div class="cs-art"><img src="${who.art ?? who.portrait}" alt=""></div>
          <div class="cs-id"><b>${esc(who.name)}</b><span class="lv-pill" style="color:#3a2200">Lv ${who.level}</span>${who.ailment ? `<span class="st-pill" style="background:${who.ailment.color};color:${who.ailment.ink}" title="${esc(who.ailment.name)}">${esc(who.ailment.tag)}</span>` : ''}</div>
          ${who.elements?.length ? `<div class="cs-els">${who.elements.map((e) => elementPill(e)).join('')}</div>` : ''}
        </div>
        <div class="cs-right">
          <div class="cs-pagebar"><span class="menu-title">${pages[this.page]}</span><span class="cs-dots">${pages.map((p, j) => `<button type="button" class="cs-pdot${j === this.page ? ' on' : ''}" data-page="${j}" title="${p}" aria-label="${p}"></button>`).join('')}</span></div>
          <div class="cs-page">${body}</div>
        </div>
      </div>
      <div class="menu-note">← → pages · Esc: back</div>
    </div>`;
    this.root.querySelectorAll<HTMLElement>('[data-page]').forEach((b) => b.addEventListener('click', () => { this.page = Number(b.dataset.page); uiSound('menuMove'); this.render(); }));
  }
}
