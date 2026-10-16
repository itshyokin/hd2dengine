/**
 * The "Achievement unlocked" pop-up, Xbox 360 style: a round badge pops in at the bottom of the screen, opens out into
 * a bar with the icon, "Achievement unlocked" and the points and name, holds, then closes and fades. Several queue up.
 */
import { esc } from './InventoryScreen';

export interface ToastItem { name: string; points: number; icon: string }

export class AchievementToast {
  private readonly root = document.createElement('div');
  private readonly queue: ToastItem[] = [];
  private busy = false;

  constructor(parent: HTMLElement, private readonly sound: () => void) {
    this.root.className = 'ach-toast';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    parent.appendChild(this.root);
  }

  show(item: ToastItem): void {
    this.queue.push(item);
    if (!this.busy) this.next();
  }

  private next(): void {
    const it = this.queue.shift();
    if (!it) { this.busy = false; return; }
    this.busy = true;
    this.root.innerHTML = `<div class="ach-pill"><span class="ach-badge"><img src="${it.icon}" alt=""></span><span class="ach-text"><small>Achievement unlocked</small><b><span class="ach-pts">${it.points}G</span> – ${esc(it.name)}</b></span></div>`;
    this.root.classList.remove('show', 'open', 'leave');
    void this.root.offsetWidth;
    this.root.classList.add('show');
    this.sound();
    // Badge pops in, the bar opens, holds, closes, fades.
    window.setTimeout(() => this.root.classList.add('open'), 450);
    window.setTimeout(() => this.root.classList.remove('open'), 4200);
    window.setTimeout(() => this.root.classList.add('leave'), 4700);
    window.setTimeout(() => { this.root.classList.remove('show', 'leave'); window.setTimeout(() => this.next(), 300); }, 5200);
  }
}
