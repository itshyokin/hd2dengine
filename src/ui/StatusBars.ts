/**
 * The HUD. Across the top: the level, magic, a big health bar in the centre, and stamina. Top right: the
 * clock and the worn ring. Bottom left: the selected weapon (with the other two under it). Bottom: EXP.
 * Low health pulses red around the screen edges, and a hit flashes it, so a draining bar is hard to miss.
 */
import type { PlayerStats } from '../game/stats';
import type { Gauge } from '../world/types';

const BARS: [Gauge, string][] = [['mp', 'MP'], ['hp', 'HP'], ['sp', 'SP']];

export interface ClockInfo { time: string; hour: number; night: number; weather: string; /** The real-world date (and season), under the game time. */ date?: string }
export interface WeaponSlot { id: string; name: string; icon: string; available: boolean; /** Its rarity's colour. */ color?: string; /** Disabled by an event (indoors): greyed with a red ✕. */ blocked?: boolean }

/** The HUD pieces a player can move and scale. */
export type HudWidget = 'stats' | 'party' | 'clock' | 'weapons' | 'xp' | 'log' | 'quest' | 'quick';
export const HUD_WIDGETS: [HudWidget, string][] = [['stats', 'Health, magic & stamina'], ['party', 'Party members'], ['clock', 'Time & spell'], ['weapons', 'Weapons'], ['xp', 'EXP bar'], ['log', 'Adventure log'], ['quest', 'Quest tracker'], ['quick', 'Quick items']];
/** How a piece is laid out: its bars side by side or stacked, a face beside them, the log's background. */
export interface HudPieceStyle {
  /** Bars side by side ('h') or stacked ('v'). The stats default to side by side, the party to stacked. */
  stack?: 'h' | 'v';
  /** A face beside the bars (stats: where the level is; party: left of each name). */
  face?: boolean;
  /** The adventure log: one box behind it, a strip behind each line (default), or none. */
  bg?: 'box' | 'lines' | 'none';
  /** The hero's bars: condensed into a card like the party's (first in the party piece) instead of across the top. */
  compact?: boolean;
  /** Not shown at all. */
  hidden?: boolean;
}
/** Which pieces have which options. */
export const HUD_OPTIONS: Partial<Record<HudWidget, (keyof HudPieceStyle)[]>> = { stats: ['stack', 'face'], party: ['stack', 'face'], log: ['bg'] };
export const HUD_DEFAULT_STACK: Partial<Record<HudWidget, 'h' | 'v'>> = { stats: 'h', party: 'v' };
/** Where a piece goes (its centre, as a share of the screen), how big it is, and its style. Missing: the default. */
export type HudLayout = Partial<Record<HudWidget, { x?: number; y?: number; scale?: number } & HudPieceStyle>>;

/** Little pixel-style icons for the clock: sun by day, sun on the horizon at dawn and dusk, moon at night. */
const ICONS = {
  sun: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.4" fill="#ffd36b"/><g stroke="#ffd36b" stroke-width="1.4" stroke-linecap="round"><path d="M8 1.2v1.8M8 13v1.8M1.2 8H3M13 8h1.8M3.2 3.2l1.2 1.2M11.6 11.6l1.2 1.2M3.2 12.8l1.2-1.2M11.6 4.4l1.2-1.2"/></g></svg>',
  horizon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 11a4.5 4.5 0 0 1 9 0z" fill="#ff9a5a"/><g stroke="#ff9a5a" stroke-width="1.3" stroke-linecap="round"><path d="M8 3.2v1.6M2.6 6.2l1.1 1M13.4 6.2l-1.1 1"/></g><path d="M1 12.5h14" stroke="#c9a6ff" stroke-width="1.3" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.2a6 6 0 1 0 3 9.6 5 5 0 0 1-3-9.6z" fill="#cfd8ff"/><circle cx="3.2" cy="3.4" r="0.7" fill="#cfd8ff"/><circle cx="13.6" cy="4.2" r="0.6" fill="#cfd8ff"/></svg>',
};

interface Row { fill: HTMLElement; ghost: HTMLElement; num: HTMLElement; row: HTMLElement; shown: number; last: number }

export class StatusBars {
  private readonly top = document.createElement('div');
  private readonly side = document.createElement('div');
  private readonly vignette = document.createElement('div');
  private readonly weapons = document.createElement('div');
  /** Quick items: three slots like the D-pad (left, up, right). */
  private readonly quick = document.createElement('div');
  private quickKey = '';
  /** A quick slot was tapped (touch screens). */
  onQuick: (k: number) => void = () => {};
  private readonly rows = new Map<Gauge, Row>();
  private readonly clockIcon: HTMLElement;
  private readonly clockTime: HTMLElement;
  private readonly clockWeather: HTMLElement;
  private readonly clockDate: HTMLElement;
  private icon = '';
  private readonly ring = document.createElement('div');
  private readonly levelEl = document.createElement('div');
  private readonly xpBar = document.createElement('div');
  private shownLevel = { level: -1, xp: -1, next: -1 };
  private ringOn = false;
  private weaponKey = '';
  private flashT = 0;
  /** Ailments and buffs: small icons under the gauges. */
  private readonly statusRow = document.createElement('div');
  private statusKey = '';

  /** Party members (their own movable piece): face, name, health and magic (dimmed when knocked out). */
  private readonly partyEl = document.createElement('div');
  private partyKey = '';
  private partyCount = 0;
  setParty(list: { name: string; level?: number; face?: string; hp: number; maxHp: number; mp: number; maxMp: number; down: boolean; sp?: number; maxSp?: number }[]): void {
    const key = JSON.stringify(list.map((m) => [m.name, m.level, m.face?.length, Math.round(m.hp), Math.round(m.mp), Math.round(m.sp ?? -1), m.down]));
    if (key === this.partyKey) return;
    this.partyKey = key;
    this.partyCount = list.length;
    this.partyEl.hidden = this.hiddenAll || !list.length;
    this.partyEl.dataset.empty = list.length ? '' : '1';
    this.partyEl.innerHTML = list.map((m) => `<div class="hud-ally${m.down ? ' down' : ''}">${m.face ? `<img class="hud-ally-face" src="${m.face}" alt="">` : '<span class="hud-ally-face"></span>'}
      <span class="hud-ally-name">${m.name.replace(/[<&]/g, '')}${m.level ? ` <small>Lv ${m.level}</small>` : ''}</span>
      <span class="hud-ally-bar hp"><i style="width:${Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100))}%"></i></span>
      <span class="hud-ally-bar mp"><i style="width:${Math.max(0, Math.min(100, (m.mp / m.maxMp) * 100))}%"></i></span>${m.sp !== undefined && m.maxSp ? `
      <span class="hud-ally-bar sp"><i style="width:${Math.max(0, Math.min(100, (m.sp / m.maxSp) * 100))}%"></i></span>` : ''}</div>`).join('');
  }

  /** The hero's face (shown beside the stats when the player turns it on). */
  setFace(url: string): void {
    const img = this.levelEl.querySelector<HTMLImageElement>('.hud-face')!;
    if (img.getAttribute('src') !== url) img.src = url;
  }

  constructor(parent: HTMLElement) {
    // Low health and hits: a red glow around the edges of the screen.
    this.vignette.className = 'hud-vignette';
    this.vignette.setAttribute('aria-hidden', 'true');

    this.top.className = 'hud-top';
    this.top.setAttribute('aria-label', 'Player status');
    this.levelEl.className = 'hud-level';
    this.levelEl.innerHTML = '<img class="hud-face" alt=""><span class="hud-level-label">LV</span><span class="hud-level-num">1</span>';
    this.top.appendChild(this.levelEl);
    for (const [g, label] of BARS) {
      const row = document.createElement('div');
      row.className = `hud-gauge ${g}`;
      row.innerHTML = `<div class="hud-gauge-head"><span class="hud-label">${label}</span><span class="hud-num"></span></div><span class="hud-bar"><span class="hud-ghost"></span><span class="hud-fill"></span><span class="hud-shine"></span></span>`;
      this.top.appendChild(row);
      this.rows.set(g, { row, fill: row.querySelector('.hud-fill')!, ghost: row.querySelector('.hud-ghost')!, num: row.querySelector('.hud-num')!, shown: 1, last: -1 });
    }

    this.statusRow.className = 'hud-status';
    this.statusRow.setAttribute('aria-label', 'Status effects');
    this.top.appendChild(this.statusRow);
    this.partyEl.className = 'hud-party';
    this.partyEl.setAttribute('aria-label', 'Party');
    this.partyEl.hidden = true;
    this.partyEl.dataset.empty = '1';

    this.side.className = 'hud-side';
    const clock = document.createElement('div');
    clock.className = 'hud-clock';
    clock.innerHTML = '<span class="hud-clock-icon"></span><span class="hud-clock-time"></span><span class="hud-clock-weather"></span><span class="hud-clock-date"></span>';
    this.clockIcon = clock.querySelector('.hud-clock-icon')!;
    this.clockTime = clock.querySelector('.hud-clock-time')!;
    this.clockWeather = clock.querySelector('.hud-clock-weather')!;
    this.clockDate = clock.querySelector('.hud-clock-date')!;
    this.ring.className = 'hud-ring';
    this.ring.hidden = true;
    this.side.append(clock, this.ring);

    // Experience: a thin green bar along the bottom of the screen, this level on the left and the next on the right.
    this.xpBar.className = 'hud-xp';
    this.xpBar.innerHTML = '<span class="hud-xp-lv now"></span><span class="hud-xp-track"><span class="hud-xp-fill"></span></span><span class="hud-xp-lv next"></span>';
    this.xpBar.setAttribute('role', 'progressbar');

    this.weapons.className = 'hud-weapons';
    this.weapons.setAttribute('aria-label', 'Selected weapon');
    this.quick.className = 'hud-quick';
    this.quick.setAttribute('aria-label', 'Quick items');
    this.quick.addEventListener('pointerdown', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-q]');
      if (!b || document.body.classList.contains('hud-arranging')) return;
      e.stopPropagation();
      this.onQuick(Number(b.dataset.q));
    });
    parent.append(this.vignette, this.top, this.partyEl, this.side, this.weapons, this.quick, this.xpBar);
  }

  /** The readied spell shard (icon and name, with the key that casts it), or null for none. */
  setRing(r: { name: string; icon: string } | null): void {
    this.ring.hidden = !r;
    if (!r) return;
    this.ring.innerHTML = `<img src="${r.icon}" alt=""><span class="hud-ring-name"></span><kbd>4</kbd>`;
    this.ring.querySelector('.hud-ring-name')!.textContent = r.name;
    this.ring.title = `${r.name}: press the spell button to cast`;
  }

  /** The key or button that uses the ring (it follows the controls and the device in use). */
  setRingKey(label: string): void {
    const k = this.ring.querySelector('kbd');
    if (k && k.textContent !== label) k.textContent = label;
  }

  /** Light up the ring while its power is on. */
  setRingActive(on: boolean): void {
    if (on === this.ringOn) return;
    this.ringOn = on;
    this.ring.classList.toggle('on', on);
  }

  /** The hero's ailments and buffs: an icon each, with a ring that empties as it runs out (none: until cured). */
  setStatus(list: { id: string; name: string; icon: string; left: number; total: number }[]): void {
    const key = list.map((e) => `${e.id}:${Number.isFinite(e.total) ? Math.ceil((e.left / e.total) * 12) : 'x'}`).join('|');
    if (key === this.statusKey) return;
    const ids = this.statusKey.split('|').map((x) => x.split(':')[0]).join('|'), now = list.map((e) => e.id).join('|');
    this.statusKey = key;
    if (ids !== now) {
      this.statusRow.innerHTML = list.map((e) => `<span class="hud-st${e.id.startsWith('buff:') ? ' buff' : ''}" data-id="${e.id}" title="${e.name}"><img src="${e.icon}" alt="${e.name}"><i></i></span>`).join('');
    }
    for (const e of list) {
      const el = this.statusRow.querySelector<HTMLElement>(`[data-id="${CSS.escape(e.id)}"] i`);
      if (el) el.style.setProperty('--left', Number.isFinite(e.total) && e.total > 0 ? String(Math.max(0, e.left / e.total)) : '1');
    }
  }

  /**
   * The weapon the attack button uses, big, with the other two smaller underneath (in switching order).
   * `switches` changes on every switch, which plays the swap animation.
   */
  setWeapons(slots: WeaponSlot[], current: string, switches: number, keyLabel: string): void {
    const key = `${current}|${switches}|${keyLabel}|${slots.map((s) => s.id + s.icon + s.available + s.name + s.color + !!s.blocked).join()}`;
    if (key === this.weaponKey) return;
    const swapped = this.weaponKey !== '' && this.weaponKey.split('|')[1] !== String(switches);
    this.weaponKey = key;
    const i = Math.max(0, slots.findIndex((s) => s.id === current));
    const order = slots.map((_, k) => slots[(i + k) % slots.length]);
    const slot = (s: WeaponSlot, main: boolean) => `<div class="hud-wslot${main ? ' main' : ''}${s.available ? '' : ' off'}${s.blocked ? ' blocked' : ''}" title="${s.name}${s.blocked ? ' (can’t be used here)' : s.available ? '' : ' (not available)'}">
      <img src="${s.icon}" alt="">${main ? `<span class="hud-wname"${s.color ? ` style="color:${s.color}"` : ''}>${s.name}</span>` : ''}</div>`;
    this.weapons.innerHTML = `${slot(order[0], true)}<div class="hud-wrest">${order.slice(1).map((s) => slot(s, false)).join('')}</div><kbd class="hud-wkey" title="Switch weapon">${keyLabel}</kbd>`;
    if (swapped) {
      this.weapons.classList.remove('swap');
      void this.weapons.offsetWidth;
      this.weapons.classList.add('swap');
    }
  }

  /**
   * The quick items: icon, how many are left and the key for each slot (null: empty). `down` is whatever the fourth
   * D-pad direction does (Release target by default; it follows the player's controls), so the cross is complete.
   */
  setQuick(slots: ({ icon: string; name: string; count: number } | null)[], keys: string[], down?: { label: string; key: string } | null): void {
    const key = JSON.stringify([slots, keys, down]);
    if (key === this.quickKey) return;
    this.quickKey = key;
    const pos = ['left', 'up', 'right'];
    this.quick.innerHTML = slots.map((s, k) => `<button type="button" class="hud-qslot ${pos[k]}${s ? '' : ' empty'}${s && s.count < 1 ? ' out' : ''}" data-q="${k}" title="${s ? `${s.name} (${s.count})` : 'Empty: assign an item in the bag'}">${
      s ? `<img src="${s.icon}" alt=""><span class="hud-qn">${s.count}</span>` : ''}<kbd>${keys[k]}</kbd></button>`).join('')
      + (down ? `<div class="hud-qslot down action" title="${down.label}"><span class="hud-qact">${down.label.replace(/[<&]/g, '')}</span><kbd>${down.key}</kbd></div>` : '');
    this.quick.hidden = this.hiddenAll || slots.every((s) => !s);
    this.quick.dataset.empty = slots.every((s) => !s) ? '1' : '';
  }
  private hiddenAll = false;

  /** The movable pieces. */
  get widgets(): Record<HudWidget, HTMLElement> { return { stats: this.top, party: this.partyEl, clock: this.side, weapons: this.weapons, xp: this.xpBar, log: this.logEl, quest: this.questEl, quick: this.quick }; }

  /** The adventure log's feed, arranged with the rest of the HUD. */
  logEl: HTMLElement = document.createElement('div');
  /** The followed quest's objectives. */
  questEl: HTMLElement = document.createElement('div');

  /** Place and scale the pieces as the player arranged them. */
  applyLayout(layout: HudLayout | undefined): void {
    for (const [k, el] of Object.entries(this.widgets) as [HudWidget, HTMLElement][]) {
      const l = layout?.[k];
      el.style.setProperty('--hud-scale', String(l?.scale ?? 1));
      const placed = l?.x !== undefined && l?.y !== undefined;
      el.classList.toggle('hud-placed', placed);
      el.style.left = placed ? `${l!.x! * 100}%` : '';
      el.style.top = placed ? `${l!.y! * 100}%` : '';
      // Its style: bars stacked or side by side, faces, the log's background.
      const stack = l?.stack ?? HUD_DEFAULT_STACK[k];
      el.classList.toggle('stack-v', stack === 'v');
      el.classList.toggle('stack-h', stack === 'h');
      el.classList.toggle('with-face', !!l?.face);
      el.classList.toggle('hud-off', !!l?.hidden);
      el.classList.toggle('hud-compact', !!l?.compact);
      if (k === 'log') for (const b of ['box', 'lines', 'none']) el.classList.toggle(`bg-${b}`, (l?.bg ?? 'lines') === b);
    }
  }

  setHidden(hidden: boolean): void {
    for (const el of [this.top, this.side, this.xpBar, this.weapons, this.vignette]) el.hidden = hidden;
    this.hiddenAll = hidden;
    this.partyEl.hidden = hidden || !this.partyCount;
    this.quick.hidden = hidden || this.quick.dataset.empty === '1';
  }

  /** Level and experience towards the next one. */
  setLevel(level: number, xp: number, next: number): void {
    const s = this.shownLevel;
    if (s.level === level && s.xp === xp && s.next === next) return;
    this.shownLevel = { level, xp, next };
    this.levelEl.querySelector('.hud-level-num')!.textContent = String(level);
    // next = 0: the top level, so the bar stays full.
    const max = next <= 0;
    this.xpBar.querySelector<HTMLElement>('.hud-xp-fill')!.style.width = `${max ? 100 : Math.min(1, xp / next) * 100}%`;
    this.xpBar.querySelector('.now')!.textContent = String(level);
    this.xpBar.querySelector('.next')!.textContent = max ? 'MAX' : String(level + 1);
    this.xpBar.title = max ? `Level ${level}: the highest level` : `Level ${level}: ${xp} / ${next} EXP`;
    this.xpBar.setAttribute('aria-valuenow', String(max ? 1 : xp));
    this.xpBar.setAttribute('aria-valuemax', String(max ? 1 : next));
    this.xpBar.setAttribute('aria-label', max ? `Experience: level ${level}, the highest level` : `Experience: level ${level}, ${xp} of ${next}`);
  }

  update(dt: number, s: PlayerStats, clock?: ClockInfo): void {
    if (clock) {
      const h = clock.hour;
      const icon = (h >= 5 && h < 7) || (h >= 18.5 && h < 20.5) ? 'horizon' : clock.night > 0.5 ? 'moon' : 'sun';
      if (icon !== this.icon) { this.icon = icon; this.clockIcon.innerHTML = ICONS[icon as keyof typeof ICONS]; this.clockIcon.title = icon === 'moon' ? 'Night' : icon === 'sun' ? 'Day' : h < 12 ? 'Dawn' : 'Dusk'; }
      this.clockTime.textContent = clock.time;
      this.clockWeather.textContent = clock.weather;
      const d = clock.date ?? '';
      if (this.clockDate.textContent !== d) this.clockDate.textContent = d;
    }
    for (const [g] of BARS) {
      const r = this.rows.get(g)!, max = s.cfg.max[g], f = max > 0 ? s[g] / max : 0;
      r.fill.style.width = `${f * 100}%`;
      // A pale "ghost" trails behind drops, so a hit is easy to read.
      r.shown = f < r.shown ? Math.max(f, r.shown - dt * 0.5) : f;
      r.ghost.style.width = `${r.shown * 100}%`;
      const text = `${Math.ceil(s[g])} / ${max}`;
      if (r.num.textContent !== text) r.num.textContent = text;
      // A real drop (a hit, a spell) shakes the bar.
      if (r.last >= 0 && s[g] < r.last - 0.9 && (g === 'hp' || s[g] < r.last - 5)) {
        r.row.classList.remove('hit');
        void r.row.offsetWidth;
        r.row.classList.add('hit');
        if (g === 'hp') this.flashT = 0.35;
      }
      r.last = s[g];
      r.row.classList.toggle('low', f < 0.3);
    }
    this.rows.get('sp')!.row.classList.toggle('exhausted', s.exhausted);
    const hp = s.cfg.max.hp > 0 ? s.hp / s.cfg.max.hp : 1;
    const danger = s.drowning || hp < 0.3;
    this.rows.get('hp')!.row.classList.toggle('danger', danger);
    // Red edges: a flash on each hit, and a slow pulse while health is low (stronger the lower it gets).
    this.flashT = Math.max(0, this.flashT - dt);
    const low = danger && s.hp > 0 ? Math.min(1, (0.3 - hp) / 0.3 + 0.35) : 0;
    this.vignette.style.setProperty('--low', low.toFixed(2));
    this.vignette.style.setProperty('--flash', (this.flashT / 0.35).toFixed(2));
    this.vignette.classList.toggle('pulse', low > 0);
  }
}
