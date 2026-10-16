/**
 * The pause menu's frame: it covers most of the screen, with its tabs (Party, Items, Map, Journal, Achievements,
 * Settings, System) across the top and a line about the journey (where, time played, gold) along the bottom. Each
 * tab's screen shows inside it. LB / RB (Q / E) or a click change tab.
 */
import { esc } from './InventoryScreen';
import type { TabGroup } from './tabs';

export interface ShellTab { id: string; label: string; icon?: string }

export class PauseShell {
  private readonly root = document.createElement('div');
  private tabs: ShellTab[] = [];
  private index = 0;
  private go: (k: number) => void = () => {};
  private keys: [string, string] = ['Q', 'E'];
  private open = false;

  constructor(parent: HTMLElement, private readonly info: () => string) {
    this.root.className = 'pause-shell';
    this.root.hidden = true;
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (b) { e.stopPropagation(); const k = Number(b.dataset.tab); if (k !== this.index) this.go(k); }
    });
    parent.appendChild(this.root);
  }

  get isOpen(): boolean { return this.open; }
  get tab(): string | undefined { return this.tabs[this.index]?.id; }

  show(tabs: ShellTab[], index: number, keys: [string, string], go: (k: number) => void): void {
    this.tabs = tabs; this.index = index; this.keys = keys; this.go = go;
    this.open = true;
    this.root.hidden = false;
    document.body.classList.add('pause-open');
    this.render();
  }

  /** Another tab is showing. */
  select(index: number): void { this.index = index; this.render(); }

  close(): void {
    this.open = false;
    this.root.hidden = true;
    document.body.classList.remove('pause-open');
  }

  /** The tab group a tab's screen is given (no labels of its own: LB / RB go to the other tabs). */
  group(inner?: Omit<TabGroup, 'main'>): TabGroup {
    const n = this.tabs.length, main: TabGroup = {
      labels: this.tabs.map((t) => t.label), index: this.index, keys: this.keys,
      go: (step, to) => this.go((((to ?? this.index + step) % n) + n) % n),
    };
    return inner ? { ...inner, main } : { labels: [], index: 0, keys: this.keys, go: () => {}, main };
  }

  /** Refresh the bottom line (gold changed…). */
  refresh(): void { if (this.open) this.render(); }

  private render(): void {
    this.root.innerHTML = `<div class="ps-bar" role="tablist"><span class="tab-key" aria-hidden="true">${esc(this.keys[0])}</span>${
      this.tabs.map((t, k) => `<button type="button" class="ps-tab" role="tab" data-tab="${k}" aria-selected="${k === this.index}">${t.icon ? `<span class="menu-icon" aria-hidden="true">${t.icon}</span>` : ''}<span>${esc(t.label)}</span></button>`).join('')
    }<span class="tab-key" aria-hidden="true">${esc(this.keys[1])}</span></div><div class="ps-foot">${esc(this.info())}</div>`;
  }
}
