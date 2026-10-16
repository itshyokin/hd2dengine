/**
 * The in-game menu: pause menu, save and load screens, and the title choice (Continue / New Game).
 * Works with the keyboard (arrows, Space/Enter, Esc) and with clicks and taps.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';
import { type SaveData, type SlotId, formatPlayTime } from '../game/saves';

export interface MenuItem {
  label: string;
  /** A small picture before the label (SVG markup drawn in the current colour). */
  icon?: string;
  /** Colours for the label and the detail (an item's rarity). */
  color?: string;
  detail?: string;
  detailColor?: string;
  disabled?: boolean;
  /** A plain entry runs `pick`. */
  pick?: () => void;
  /** A setting: on/off, a number (left/right change it), or one of a few choices (left/right cycle). */
  toggle?: { value: boolean; set: (v: boolean) => void };
  slider?: { value: number; min: number; max: number; step: number; set: (v: number) => void; format?: (v: number) => string };
  choice?: { value: string; options: [string, string][]; set: (v: string) => void };
}

interface Screen { title: string; items: MenuItem[]; note?: string; canBack: boolean; index: number; style: 'panel' | 'title'; subtitle?: string }

export class GameMenu {
  private readonly root = document.createElement('div');
  private readonly titleEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly noteEl: HTMLElement;
  private readonly stack: Screen[] = [];
  private readonly noticeEl = document.createElement('div');
  private noticeTimer = 0;

  constructor(parent: HTMLElement, private readonly input: Input) {
    this.root.className = 'menu';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.innerHTML = '<div class="menu-box"><div class="menu-title"></div><div class="menu-list" role="listbox"></div><div class="menu-note"></div></div>';
    this.titleEl = this.root.querySelector('.menu-title')!;
    this.listEl = this.root.querySelector('.menu-list')!;
    this.noteEl = this.root.querySelector('.menu-note')!;
    // Taps on the dimmed background go back (like Esc).
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) { e.preventDefault(); this.back(); } });
    this.noticeEl.className = 'notice';
    this.noticeEl.setAttribute('role', 'status');
    parent.append(this.root, this.noticeEl);
  }

  get isOpen(): boolean { return this.stack.length > 0; }

  /** Show a screen on top of the current one (or as the first). */
  push(title: string, items: MenuItem[], opts: { note?: string; canBack?: boolean; style?: 'panel' | 'title'; subtitle?: string } = {}): void {
    const first = Math.max(0, items.findIndex((i) => !i.disabled));
    this.stack.push({ title, items, note: opts.note, canBack: opts.canBack ?? true, index: first, style: opts.style ?? 'panel', subtitle: opts.subtitle });
    this.render();
  }

  /** Replace the current screen's items (after saving into a slot, say). */
  refresh(items: MenuItem[], note?: string): void {
    const s = this.stack[this.stack.length - 1];
    if (!s) return;
    s.items = items;
    if (note !== undefined) s.note = note;
    s.index = Math.min(s.index, items.length - 1);
    this.render();
  }

  close(): void {
    this.stack.length = 0;
    this.root.hidden = true;
  }

  back(): void {
    const s = this.stack[this.stack.length - 1];
    if (!s?.canBack) return;
    this.stack.pop();
    if (this.stack.length) this.render(); else this.root.hidden = true;
  }

  /** Call every frame while open: arrow keys move, OK picks, Cancel goes back. */
  update(): void {
    const s = this.stack[this.stack.length - 1];
    if (!s) return;
    const move = (d: number) => {
      for (let k = 1; k <= s.items.length; k++) {
        const i = (s.index + d * k + s.items.length * 4) % s.items.length;
        if (!s.items[i].disabled) { if (i !== s.index) uiSound('menuMove'); s.index = i; break; }
      }
      this.render();
    };
    if (this.input.consume('down')) move(1);
    if (this.input.consume('up')) move(-1);
    const it = s.items[s.index];
    if (this.input.consume('left') && it && !it.disabled) this.adjust(it, -1);
    if (this.input.consume('right') && it && !it.disabled) this.adjust(it, 1);
    if (this.input.confirm()) { if (it && !it.disabled) this.activate(it); return; }
    if (this.input.consume('cancel')) { if (s.canBack) uiSound('menuBack'); this.back(); }
  }

  /** OK / click: run an entry, flip a toggle, or step a choice forward. */
  private activate(it: MenuItem): void {
    uiSound('menuOk');
    if (it.toggle) { it.toggle.value = !it.toggle.value; it.toggle.set(it.toggle.value); this.render(); }
    else if (it.choice || it.slider) this.adjust(it, 1);
    else it.pick?.();
  }

  /** Left / right on a setting. */
  private adjust(it: MenuItem, d: number): void {
    if (it.toggle) { it.toggle.value = d > 0; it.toggle.set(it.toggle.value); }
    else if (it.slider) {
      const sl = it.slider, v = Math.min(sl.max, Math.max(sl.min, Math.round((sl.value + d * sl.step) / sl.step) * sl.step));
      if (v === sl.value) return;
      sl.value = v; sl.set(v);
    } else if (it.choice) {
      const c = it.choice, i = c.options.findIndex(([k]) => k === c.value);
      const n = (i + d + c.options.length) % c.options.length;
      c.value = c.options[n][0]; c.set(c.value);
    } else return;
    uiSound('menuMove');
    this.render();
  }

  /** A short message at the top of the screen ("Saved", "Respawn point set"). */
  notice(text: string, seconds = 2.2): void {
    this.noticeEl.textContent = text;
    this.noticeEl.classList.add('show');
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => this.noticeEl.classList.remove('show'), seconds * 1000);
  }

  private render(): void {
    const s = this.stack[this.stack.length - 1];
    if (!s) return;
    this.root.hidden = false;
    this.root.classList.toggle('title-screen', s.style === 'title');
    this.titleEl.textContent = s.title;
    this.titleEl.dataset.sub = s.subtitle ?? '';
    this.noteEl.textContent = s.note ?? '';
    this.noteEl.hidden = !s.note;
    this.listEl.replaceChildren(...s.items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu-item';
      b.disabled = !!it.disabled;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(i === s.index));
      const value = settingText(it);
      b.classList.toggle('setting', value !== null);
      b.innerHTML = `${it.icon ? `<span class="menu-icon" aria-hidden="true">${it.icon}</span>` : ''}<span class="menu-label"></span>${value !== null ? '<span class="menu-value"></span>' : ''}${it.detail ? '<span class="menu-detail"></span>' : ''}`;
      b.querySelector('.menu-label')!.textContent = it.label;
      if (it.color) b.querySelector<HTMLElement>('.menu-label')!.style.color = it.color;
      if (value !== null) {
        const v = b.querySelector<HTMLElement>('.menu-value')!;
        v.textContent = value;
        if (it.slider) v.style.setProperty('--fill', `${((it.slider.value - it.slider.min) / (it.slider.max - it.slider.min)) * 100}%`);
        if (it.slider) v.classList.add('bar');
      }
      if (it.detail) b.querySelector('.menu-detail')!.textContent = it.detail;
      if (it.detail && it.detailColor) b.querySelector<HTMLElement>('.menu-detail')!.style.color = it.detailColor;
      b.addEventListener('pointerenter', () => { if (!it.disabled && s.index !== i) { s.index = i; this.render(); } });
      b.addEventListener('click', (e) => {
        if (it.disabled) return;
        s.index = i;
        // Clicking the left part of a slider lowers it; the right part raises it.
        if (it.slider) { const r = b.getBoundingClientRect(); this.adjust(it, e.clientX < r.left + r.width * 0.6 ? -1 : 1); }
        else this.activate(it);
      });
      return b;
    }));
  }
}

/** The value shown on the right of a setting, or null for a plain entry. */
function settingText(it: MenuItem): string | null {
  if (it.toggle) return it.toggle.value ? 'On' : 'Off';
  if (it.slider) return it.slider.format ? it.slider.format(it.slider.value) : String(it.slider.value);
  if (it.choice) return it.choice.options.find(([k]) => k === it.choice!.value)?.[1] ?? it.choice.value;
  return null;
}

/** One line describing a save, for a slot in the list. */
export function slotLabel(slot: SlotId): string {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
}

export function saveDetail(d: SaveData | null): string {
  if (!d) return 'Empty';
  const when = new Date(d.savedAt);
  const date = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${d.mapTitle} · ${formatPlayTime(d.playTime)} played · HP ${Math.ceil(d.gauges.hp)} · ${date}`;
}
