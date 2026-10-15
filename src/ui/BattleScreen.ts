/**
 * The turn-based battle screen: enemies on the left, the party on the right facing them, the turn order down the
 * right edge (FFX-style), a message line, the command menu and the party's health and magic. Keyboard, controller
 * and touch: arrows / D-pad move, OK picks, Cancel goes back; fighters and menu entries can be tapped.
 * It only shows things and asks questions: the battle itself is run by TurnBattle.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';

export interface FighterView {
  key: string;
  side: 'party' | 'enemy';
  name: string;
  /** Full-body picture, and a small one for the turn order (party: their face). */
  picture: HTMLCanvasElement;
  icon: string;
  /** Mirror the picture (a flat enemy drawn facing the wrong way). */
  flip?: boolean;
  /** Size multiplier (Database → Enemies → Size). */
  scale?: number;
  color?: string;
}

export interface Vitals { hp: number; maxHp: number; mp: number; maxMp: number; guarding?: boolean; /** Ailments on them: icon and a name for the tooltip. */ status?: { icon: string; name: string }[] }

export interface ChoiceItem {
  label: string;
  detail?: string;
  disabled?: boolean;
  /** Shown on the right (an MP cost, a count). */
  right?: string;
  /** Hovering it: what it would do to the turn order (the action's weight). */
  rank?: number;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'list'; title: string; items: ChoiceItem[]; index: number; pick: (i: number) => void; back?: () => void; hover?: (i: number) => void }
  | { kind: 'target'; keys: string[]; index: number; pick: (key: string) => void; back: () => void; all?: boolean }
  | { kind: 'wait'; done: () => void };

export class BattleScreen {
  private readonly root = document.createElement('div');
  private readonly field: HTMLElement;
  private readonly enemiesEl: HTMLElement;
  private readonly partyEl: HTMLElement;
  private readonly orderEl: HTMLElement;
  private readonly msgEl: HTMLElement;
  private readonly cmdEl: HTMLElement;
  private readonly cmdTitle: HTMLElement;
  private readonly cmdList: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly resultEl: HTMLElement;
  private readonly flashEl: HTMLElement;
  private readonly fighters = new Map<string, { view: FighterView; el: HTMLElement; img: HTMLCanvasElement; bar: HTMLElement | null; row: HTMLElement | null; icons: HTMLElement; rowIcons: HTMLElement | null; statusKey: string }>();
  private mode: Mode = { kind: 'idle' };
  private msgTimer = 0;

  constructor(parent: HTMLElement, private readonly input: Input) {
    this.root.className = 'battle';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Battle');
    this.root.innerHTML = `
      <div class="battle-shade"></div>
      <div class="battle-flash"></div>
      <div class="battle-msg" role="status" aria-live="polite"></div>
      <div class="battle-field"><div class="battle-floor"></div><div class="battle-enemies"></div><div class="battle-party"></div></div>
      <div class="battle-order" aria-label="Turn order"></div>
      <div class="battle-bottom">
        <div class="battle-cmd" hidden><div class="battle-cmd-title"></div><div class="battle-cmd-list" role="listbox"></div></div>
        <div class="battle-status"></div>
      </div>
      <div class="battle-result" hidden></div>`;
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.field = q('.battle-field');
    this.enemiesEl = q('.battle-enemies');
    this.partyEl = q('.battle-party');
    this.orderEl = q('.battle-order');
    this.msgEl = q('.battle-msg');
    this.cmdEl = q('.battle-cmd');
    this.cmdTitle = q('.battle-cmd-title');
    this.cmdList = q('.battle-cmd-list');
    this.statusEl = q('.battle-status');
    this.resultEl = q('.battle-result');
    this.flashEl = q('.battle-flash');
    // Tapping anywhere while a message waits moves it on.
    this.root.addEventListener('pointerdown', (e) => {
      if (this.mode.kind === 'wait' && !(e.target as HTMLElement).closest('.battle-cmd')) { e.preventDefault(); this.finishWait(); }
    });
    parent.append(this.root);
  }

  get isOpen(): boolean { return !this.root.hidden; }

  /** Open with these fighters. `opening` decides the banner. */
  open(views: FighterView[]): void {
    this.fighters.clear();
    this.enemiesEl.replaceChildren();
    this.partyEl.replaceChildren();
    this.statusEl.replaceChildren();
    this.resultEl.hidden = true;
    this.cmdEl.hidden = true;
    this.mode = { kind: 'idle' };
    const enemies = views.filter((v) => v.side === 'enemy'), party = views.filter((v) => v.side === 'party');
    enemies.forEach((v, i) => this.addFighter(v, i, enemies.length));
    party.forEach((v, i) => this.addFighter(v, i, party.length));
    this.enemiesEl.dataset.count = String(enemies.length);
    this.partyEl.dataset.count = String(party.length);
    this.root.hidden = false;
    this.root.classList.remove('closing');
    this.root.classList.remove('entering');
    void this.root.offsetWidth;
    this.root.classList.add('entering');
  }

  close(): void {
    this.mode = { kind: 'idle' };
    this.root.hidden = true;
    this.fighters.clear();
  }

  private addFighter(v: FighterView, i: number, n: number): void {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `bfighter ${v.side}`;
    el.style.setProperty('--i', String(i));
    el.style.setProperty('--n', String(n));
    el.setAttribute('aria-label', v.name);
    const img = document.createElement('canvas');
    img.width = v.picture.width; img.height = v.picture.height;
    img.getContext('2d')!.drawImage(v.picture, 0, 0);
    img.className = 'bf-pic';
    // A crowd is drawn smaller so it fits (more than 3 in the party, more than 4 enemies).
    const crowd = v.side === 'party' ? (n > 3 ? 3.3 / n : 1) : n > 4 ? 4.6 / n : 1;
    const s = Math.max(0.3, Math.min(3, (v.scale ?? 1) * crowd));
    img.style.width = `${Math.round(v.picture.width * s)}px`;
    img.style.height = `${Math.round(v.picture.height * s)}px`;
    if (v.flip) img.classList.add('flip');
    const shadow = document.createElement('span');
    shadow.className = 'bf-shadow';
    const icons = document.createElement('span');
    icons.className = 'bf-status';
    el.append(shadow, icons, img);
    let bar: HTMLElement | null = null;
    if (v.side === 'enemy') {
      const tag = document.createElement('span');
      tag.className = 'bf-tag';
      tag.innerHTML = `<span class="bf-name"></span><span class="bf-hp"><span></span></span>`;
      (tag.querySelector('.bf-name') as HTMLElement).textContent = v.name;
      bar = tag.querySelector('.bf-hp span') as HTMLElement;
      el.append(tag);
    }
    el.addEventListener('click', () => this.tapFighter(v.key));
    (v.side === 'enemy' ? this.enemiesEl : this.partyEl).append(el);
    let row: HTMLElement | null = null;
    if (v.side === 'party') {
      row = document.createElement('div');
      row.className = 'bstat';
      if (v.color) row.style.setProperty('--hero', v.color);
      row.innerHTML = `<span class="bstat-name"><span class="bstat-label"></span><span class="bstat-status"></span></span><span class="bstat-bar hp"><span></span></span><span class="bstat-num hp"></span><span class="bstat-bar mp"><span></span></span><span class="bstat-num mp"></span>`;
      (row.querySelector('.bstat-label') as HTMLElement).textContent = v.name;
      row.addEventListener('click', () => this.tapFighter(v.key));
      this.statusEl.append(row);
    }
    this.fighters.set(v.key, { view: v, el, img, bar, row, icons, rowIcons: row?.querySelector('.bstat-status') as HTMLElement | null, statusKey: '' });
  }

  /** Health and magic for one fighter (party rows show numbers; enemies a bar). */
  setVitals(key: string, v: Vitals): void {
    const f = this.fighters.get(key);
    if (!f) return;
    const down = v.hp <= 0;
    f.el.classList.toggle('down', down);
    f.el.classList.toggle('guarding', !!v.guarding);
    // Ailment icons over the fighter (and beside a party member's name).
    const sk = (v.status ?? []).map((x) => x.name).join('|');
    if (sk !== f.statusKey) {
      f.statusKey = sk;
      const make = () => (v.status ?? []).map((x) => { const im = document.createElement('img'); im.src = x.icon; im.alt = x.name; im.title = x.name; return im; });
      f.icons.replaceChildren(...make());
      f.rowIcons?.replaceChildren(...make());
    }
    if (f.bar) f.bar.style.width = `${Math.max(0, Math.min(100, (v.hp / Math.max(1, v.maxHp)) * 100))}%`;
    if (f.row) {
      const q = (s: string) => f.row!.querySelector(s) as HTMLElement;
      q('.bstat-bar.hp span').style.width = `${Math.max(0, Math.min(100, (v.hp / Math.max(1, v.maxHp)) * 100))}%`;
      q('.bstat-bar.mp span').style.width = `${Math.max(0, Math.min(100, (v.mp / Math.max(1, v.maxMp)) * 100))}%`;
      q('.bstat-num.hp').textContent = `${Math.ceil(v.hp)}/${v.maxHp}`;
      q('.bstat-num.mp').textContent = `${Math.floor(v.mp)}/${v.maxMp}`;
      f.row.classList.toggle('down', down);
      f.row.classList.toggle('low', !down && v.hp <= v.maxHp * 0.25);
    }
  }

  /** Whose turn it is (highlighted), and the turn order after them. */
  setOrder(keys: string[], active: string | null): void {
    this.orderEl.replaceChildren(...keys.map((k, i) => {
      const f = this.fighters.get(k);
      const chip = document.createElement('div');
      chip.className = `border-chip ${f?.view.side ?? ''}${i === 0 ? ' now' : ''}`;
      const im = document.createElement('img');
      im.src = f?.view.icon ?? '';
      im.alt = '';
      if (f?.view.flip) im.classList.add('flip');
      const nm = document.createElement('span');
      nm.textContent = f?.view.name ?? k;
      chip.append(im, nm);
      return chip;
    }));
    for (const [k, f] of this.fighters) {
      f.el.classList.toggle('active', k === active);
      f.row?.classList.toggle('active', k === active);
    }
  }

  /** A line at the top. Without `hold` it fades after a moment. */
  message(text: string, hold = false): void {
    this.msgEl.textContent = text;
    this.msgEl.classList.toggle('on', !!text);
    this.msgTimer = hold ? Infinity : 2.2;
  }

  /** A number or word rising from a fighter. */
  popup(key: string, text: string, kind: 'dmg' | 'crit' | 'heal' | 'info' | 'mp' = 'dmg', color?: string): void {
    const f = this.fighters.get(key);
    if (!f) return;
    const el = document.createElement('span');
    el.className = `bpop ${kind}`;
    el.textContent = text;
    if (color) el.style.color = color;
    const n = f.el.querySelectorAll('.bpop').length;
    el.style.setProperty('--lift', `${n * 18}px`);
    f.el.append(el);
    setTimeout(() => el.remove(), 1300);
  }

  /** Step forward and back (an attack), shake (hit), flash in a colour (a spell), or fall (knocked out). */
  animate(key: string, how: 'lunge' | 'hit' | 'cast' | 'heal' | 'faint', color?: string): void {
    const f = this.fighters.get(key);
    if (!f) return;
    f.el.classList.remove('lunge', 'hit', 'cast', 'heal', 'faint');
    if (color) f.el.style.setProperty('--fx', color);
    void f.el.offsetWidth;
    f.el.classList.add(how);
    if (how !== 'faint') setTimeout(() => f.el.classList.remove(how), 650);
  }

  /** A white flash over everything (critical hits, the battle starting). */
  flash(color = '#fff'): void {
    this.flashEl.style.background = color;
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }

  /* ------------------------------------------------------------------ questions */

  /** A list to pick from (commands, spells, items). */
  choose(title: string, items: ChoiceItem[], pick: (i: number) => void, back?: () => void, hover?: (i: number) => void, start = 0): void {
    const first = items[start] && !items[start].disabled ? start : Math.max(0, items.findIndex((i) => !i.disabled));
    this.mode = { kind: 'list', title, items, index: first, pick, back, hover };
    this.renderList();
    hover?.(first);
  }

  /** Pick a fighter (arrows cycle, OK confirms). `all`: the whole group is hit (shown, not chosen). */
  target(keys: string[], pick: (key: string) => void, back: () => void, start?: string, all = false): void {
    if (!keys.length) { back(); return; }
    const i = Math.max(0, start ? keys.indexOf(start) : 0);
    this.mode = { kind: 'target', keys, index: i, pick, back, all };
    this.cmdEl.hidden = true;
    this.renderTarget();
  }

  /** Wait for OK (or a tap), then go on. */
  waitForOk(done: () => void): void { this.mode = { kind: 'wait', done }; this.cmdEl.hidden = true; }

  /** Nothing to answer (enemies acting, animations). */
  idle(): void { this.mode = { kind: 'idle' }; this.cmdEl.hidden = true; this.clearTargets(); }

  /** The victory panel: a heading and lines (EXP, gold, items, level-ups). */
  result(title: string, lines: string[]): void {
    this.resultEl.replaceChildren();
    const h = document.createElement('div');
    h.className = 'battle-result-title';
    h.textContent = title;
    const list = document.createElement('div');
    list.className = 'battle-result-list';
    for (const l of lines) { const p = document.createElement('div'); p.textContent = l; list.append(p); }
    const hint = document.createElement('div');
    hint.className = 'battle-result-hint';
    hint.textContent = 'OK to continue';
    this.resultEl.append(h, list, hint);
    this.resultEl.hidden = false;
  }

  private renderList(): void {
    const m = this.mode;
    if (m.kind !== 'list') return;
    this.cmdEl.hidden = false;
    this.cmdTitle.textContent = m.title;
    this.cmdList.replaceChildren(...m.items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bcmd';
      b.disabled = !!it.disabled;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(i === m.index));
      const l = document.createElement('span'); l.className = 'bcmd-label'; l.textContent = it.label;
      b.append(l);
      if (it.right) { const r = document.createElement('span'); r.className = 'bcmd-right'; r.textContent = it.right; b.append(r); }
      if (it.detail) { const d = document.createElement('span'); d.className = 'bcmd-detail'; d.textContent = it.detail; b.append(d); }
      b.addEventListener('pointerenter', () => { if (this.mode === m && !it.disabled && m.index !== i) { m.index = i; this.renderList(); m.hover?.(i); } });
      b.addEventListener('click', () => { if (this.mode !== m || it.disabled) return; m.index = i; uiSound('menuOk'); this.idle(); m.pick(i); });
      return b;
    }));
    (this.cmdList.children[m.index] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }

  private renderTarget(): void {
    const m = this.mode;
    this.clearTargets();
    if (m.kind !== 'target') return;
    m.keys.forEach((k, i) => this.fighters.get(k)?.el.classList.toggle('targeted', m.all || i === m.index));
    const f = this.fighters.get(m.keys[m.index]);
    this.message(f ? f.view.name : '', true);
  }

  private clearTargets(): void { for (const f of this.fighters.values()) f.el.classList.remove('targeted'); }

  private tapFighter(key: string): void {
    const m = this.mode;
    if (m.kind !== 'target' || !m.keys.includes(key)) return;
    if (m.keys[m.index] !== key) { m.index = m.keys.indexOf(key); this.renderTarget(); uiSound('menuMove'); return; }
    uiSound('menuOk');
    this.idle();
    this.message('');
    m.pick(key);
  }

  private finishWait(): void {
    const m = this.mode;
    if (m.kind !== 'wait') return;
    this.mode = { kind: 'idle' };
    uiSound('menuOk');
    m.done();
  }

  /** Keys and buttons, and the message timer. */
  update(dt: number): void {
    if (this.msgTimer !== Infinity && this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) this.msgEl.classList.remove('on');
    const i = this.input, m = this.mode;
    if (m.kind === 'list') {
      const step = (d: number) => {
        const n = m.items.length;
        for (let k = 1; k <= n; k++) { const j = (m.index + d * k + n * k) % n; if (!m.items[j].disabled) { m.index = j; break; } }
        uiSound('menuMove');
        this.renderList();
        m.hover?.(m.index);
      };
      if (i.consume('down')) step(1);
      if (i.consume('up')) step(-1);
      if (i.consume('ok')) { const it = m.items[m.index]; if (it && !it.disabled) { uiSound('menuOk'); this.idle(); m.pick(m.index); } }
      else if (i.consume('cancel') && m.back) { uiSound('menuBack'); this.idle(); m.back(); }
    } else if (m.kind === 'target') {
      const n = m.keys.length;
      let moved = false;
      if (!m.all) {
        if (i.consume('down') || i.consume('right')) { m.index = (m.index + 1) % n; moved = true; }
        if (i.consume('up') || i.consume('left')) { m.index = (m.index - 1 + n) % n; moved = true; }
      }
      if (moved) { uiSound('menuMove'); this.renderTarget(); }
      if (i.consume('ok')) { uiSound('menuOk'); const k = m.keys[m.index]; this.idle(); this.message(''); m.pick(k); }
      else if (i.consume('cancel')) { uiSound('menuBack'); this.idle(); this.message(''); m.back(); }
    } else if (m.kind === 'wait') {
      if (i.consume('ok') || i.consume('cancel')) this.finishWait();
    }
  }

  /** The battle field's size, for laying out sprites (unused for now, kept for later camera work). */
  get bounds(): DOMRect { return this.field.getBoundingClientRect(); }
}
