/**
 * Lockpicking (Update 119), Skyrim style. The pick swings round the top half of the lock (← → or the stick, or the
 * mouse); holding Space / A turns the cylinder. Near the sweet spot it turns further; on the spot it turns all the way
 * and the lock opens. Off the spot it jams, and holding a jammed lock strains the pick until it snaps (a lockpick from
 * the bag is used up when the game has lockpick items). The sweet spot is wider on easier locks. Controllers rumble
 * more the closer the pick is, and a soft click ticks faster near it for everyone.
 */
import type { Input } from '../game/Input';
import type { LockLevel } from '../world/types';
import { uiSound } from '../audio/sfx';

export const LOCK_LEVELS: LockLevel[] = ['easy', 'medium', 'hard', 'impossible', 'never'];
export const LOCK_NAMES: Record<LockLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', impossible: 'Impossible', never: 'Cannot be picked' };
export const LOCK_COLORS: Record<LockLevel, string> = { easy: '#5ad06a', medium: '#f0d040', hard: '#ff9a3a', impossible: '#ff4a4a', never: '#9a9aa6' };
/** Half the sweet spot's width in degrees, per difficulty. */
const SWEET: Record<LockLevel, number> = { easy: 16, medium: 9, hard: 5, impossible: 2, never: 0 };

export interface LockpickHost {
  /** Picks left in the bag (null: the game has no lockpick items, so picking is free). */
  picks(): number | null;
  /** A pick snapped: take one from the bag. */
  breakPick(): void;
  sound(name: 'lockClick' | 'lockTurn' | 'lockOpen' | 'lockBreak'): void;
  rumble(strength: number, ms: number): void;
}

export class LockpickScreen {
  private readonly root = document.createElement('div');
  private open = false;
  private level: LockLevel = 'easy';
  private done: (ok: boolean) => void = () => {};
  /** The pick's angle, −90 (left) … 90 (right), and the sweet spot's. */
  private angle = 0;
  private sweet = 0;
  /** How far the cylinder has turned, 0 … 1. */
  private turn = 0;
  /** How strained the pick is, 0 … 1 (snaps at 1). */
  private strain = 0;
  private clickT = 0;
  private turnSoundT = 0;
  private closing = 0;
  private mouseHeld = false;

  constructor(parent: HTMLElement, private readonly input: Input, private readonly host: LockpickHost) {
    this.root.className = 'lockpick';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Pick the lock');
    parent.appendChild(this.root);
    this.root.addEventListener('mousemove', (e) => {
      const dial = this.root.querySelector<HTMLElement>('.lp-dial');
      if (!dial || !this.open) return;
      const r = dial.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a = (Math.atan2(e.clientX - cx, cy - e.clientY) * 180) / Math.PI;
      if (this.turn < 0.02) this.angle = Math.max(-90, Math.min(90, a));
    });
    this.root.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseHeld = true; });
    window.addEventListener('mouseup', () => (this.mouseHeld = false));
  }

  get isOpen(): boolean { return this.open; }

  show(level: LockLevel, done: (ok: boolean) => void): void {
    this.open = true;
    this.level = level;
    this.done = done;
    this.angle = 0;
    this.turn = 0;
    this.strain = 0;
    this.closing = 0;
    // Somewhere in the half circle, not hugging the very ends.
    this.sweet = Math.round((Math.random() * 2 - 1) * 78);
    this.root.hidden = false;
    this.render();
  }

  private finish(ok: boolean): void {
    this.open = false;
    this.root.hidden = true;
    this.done(ok);
  }

  /** How far the cylinder may turn with the pick where it is: all the way on the spot, less further off. */
  private reach(): number {
    const w = SWEET[this.level], off = Math.abs(this.angle - this.sweet);
    if (off <= w) return 1;
    const fall = w * 3 + 14;
    return Math.max(0, 1 - (off - w) / fall) * 0.85;
  }

  update(dt: number): void {
    if (!this.open) return;
    const i = this.input;
    if (this.closing > 0) {
      this.closing -= dt;
      this.render();
      if (this.closing <= 0) this.finish(true);
      return;
    }
    if (i.consume('cancel')) { uiSound('menuBack'); this.finish(false); return; }
    const turning = i.isHeld('ok') || i.isHeld('jump') || this.mouseHeld;
    i.consume('ok'); i.consume('jump');
    // The pick only moves while the cylinder is at rest.
    if (!turning || this.turn < 0.02) {
      const sx = Math.abs(i.stick.x) > 0.15 ? i.stick.x : (i.isHeld('right') ? 1 : 0) - (i.isHeld('left') ? 1 : 0);
      this.angle = Math.max(-90, Math.min(90, this.angle + sx * 75 * dt));
    }
    i.consume('left'); i.consume('right');
    const reach = this.reach(), near = Math.max(0, 1 - Math.abs(this.angle - this.sweet) / 60);
    // A soft click that ticks faster (and a rumble that grows) as the pick nears the spot.
    this.clickT -= dt;
    if (this.clickT <= 0 && !turning) {
      this.clickT = 0.55 - near * 0.42;
      if (near > 0.15) { this.host.sound('lockClick'); this.host.rumble(0.08 + near * near * 0.5, 50); }
    }
    if (turning) {
      this.turn = Math.min(reach, this.turn + dt * 1.6);
      this.turnSoundT -= dt;
      if (this.turnSoundT <= 0) { this.turnSoundT = 0.3; this.host.sound('lockTurn'); }
      if (this.turn >= 1) { this.host.sound('lockOpen'); this.host.rumble(0.6, 160); this.closing = 0.6; this.render(); return; }
      if (this.turn >= reach - 0.01) {
        // Jammed: the pick strains (and the controller shakes) until it snaps.
        this.strain += dt * (this.level === 'impossible' ? 1.4 : this.level === 'hard' ? 1.1 : 0.8);
        this.host.rumble(0.35 + this.strain * 0.4, 60);
        if (this.strain >= 1) {
          this.host.sound('lockBreak');
          this.host.rumble(1, 220);
          this.host.breakPick();
          this.strain = 0;
          this.turn = 0;
          const left = this.host.picks();
          if (left !== null && left <= 0) { this.render(); this.finish(false); return; }
        }
      }
    } else {
      this.turn = Math.max(0, this.turn - dt * 3);
      this.strain = Math.max(0, this.strain - dt * 0.6);
    }
    this.render();
  }

  private render(): void {
    const picks = this.host.picks(), color = LOCK_COLORS[this.level];
    const shake = this.strain > 0 ? (Math.random() - 0.5) * this.strain * 6 : 0;
    this.root.innerHTML = `<div class="lp-box" style="--lock:${color}">
      <div class="lp-head"><span class="menu-title">Locked</span><span class="lp-level" style="color:${color};border-color:${color}">${LOCK_NAMES[this.level]}</span></div>
      <div class="lp-dial">
        <div class="lp-ring"></div>
        <div class="lp-cyl" style="transform:translate(-50%,-50%) rotate(${this.turn * 90 + shake}deg)"><i></i></div>
        <div class="lp-pick${this.strain > 0.5 ? ' strain' : ''}" style="transform:rotate(${this.angle + shake * 0.5}deg)"></div>
        <div class="lp-pin" style="transform:translate(-50%,-50%) rotate(${this.turn * 90 + shake}deg)"></div>
      </div>
      <p class="lp-status">${this.closing > 0 ? 'Unlocked!' : picks === null ? '' : `Lockpicks: ${picks}`}</p>
      <div class="menu-note">← → (or the mouse) move the pick · hold Space / A (or click) to turn · Esc: give up</div>
    </div>`;
  }
}
