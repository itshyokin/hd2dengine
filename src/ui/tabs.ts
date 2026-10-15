/**
 * Tabs across the top of a menu screen that groups several screens (the Inventory: items, equipment, status; the
 * Journal: quests, the adventure log, records). LB / RB (Q / E, Page Up / Down) move between them, or click one.
 * Each screen draws the strip with `tabStrip`, wires it with `wireTabs`, and asks `tabKeys` first in its update.
 */
import type { Input } from '../game/Input';
import { esc } from './InventoryScreen';

export interface TabGroup {
  labels: string[];
  index: number;
  /** The keys or buttons that move between tabs (shown at each end). */
  keys: [string, string];
  /** Go to another tab: by a step (-1, 1) or, with `to`, straight to that tab. */
  go(step: number, to?: number): void;
}

export function tabStrip(t: TabGroup | undefined): string {
  if (!t || t.labels.length < 2) return '';
  return `<div class="tab-strip" role="tablist"><span class="tab-key" aria-hidden="true">${esc(t.keys[0])}</span>${
    t.labels.map((l, k) => `<button type="button" class="tab-btn" role="tab" aria-selected="${k === t.index}" data-tabgo="${k}">${esc(l)}</button>`).join('')
  }<span class="tab-key" aria-hidden="true">${esc(t.keys[1])}</span></div>`;
}

export function wireTabs(root: HTMLElement, t: TabGroup | undefined): void {
  if (!t) return;
  root.querySelectorAll<HTMLElement>('[data-tabgo]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const k = Number(b.dataset.tabgo);
    if (k !== t.index) t.go(k - t.index, k);
  }));
}

/** LB / RB: true when it moved to another tab (the screen should stop handling keys this frame). */
export function tabKeys(input: Input, t: TabGroup | undefined): boolean {
  if (!t || t.labels.length < 2) return false;
  if (input.consume('tabPrev')) { t.go(-1); return true; }
  if (input.consume('tabNext')) { t.go(1); return true; }
  return false;
}
