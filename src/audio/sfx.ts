/**
 * Sound: effects, background music and ambience through Web Audio, each with its own volume.
 *
 * A sound is named by a source string: "builtin:<name>" for the sounds made in code (see synth.ts), or a
 * file path like "assets/audio/forest.ogg". Effects can be swapped for files in Database → Audio.
 * Browsers only start audio after the player clicks or presses a key, so nothing plays before that.
 */
import { AMBIENCE_NAMES, type AmbienceName, JINGLE_SFX, MUSIC_NAMES, type MusicName, RATE, SFX_NAMES, type SfxName, type Stereo, UI_SFX, makeAmbience, makeMusic, makeSfx } from './synth';

/** The volume groups (Settings → Sound), 0 – 100 each. */
export interface Volumes { master: number; music: number; sfx: number; ambience: number; ui: number; jingle: number }
type Bus = 'music' | 'ambience' | 'sfx' | 'ui' | 'jingle';

export type Sfx = SfxName;
export { SFX_NAMES, MUSIC_NAMES, AMBIENCE_NAMES };

interface Loop { src: string; node: AudioBufferSourceNode; gain: GainNode }

/** UI screens play their clicks through this (set by the game). */
let uiPlayer: (s: Sfx) => void = () => {};
export function setUiSound(fn: (s: Sfx) => void): void { uiPlayer = fn; }
export function uiSound(s: Sfx): void { uiPlayer(s); }

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly loops: Record<'music' | 'ambience', Loop | null> = { music: null, ambience: null };
  /** What each loop should be playing (kept while audio is still locked). */
  private readonly want: Record<'music' | 'ambience', string> = { music: '', ambience: '' };
  private volumes: Record<Bus | 'master', number> = { master: 0.25, music: 0.49, ambience: 0.49, sfx: 0.64, ui: 0.49, jingle: 0.64 };
  /** Effects swapped for other sounds (Database → Audio): name → source ('' = silent). */
  overrides: Partial<Record<Sfx, string>> = {};
  /** Where the listener is (the hero), for effects placed in the world. */
  listener = { x: 0, z: 0 };

  constructor(private readonly resolve: (path: string) => string = (p) => p) {
    const unlock = () => { this.start(); };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true });
  }

  get ready(): boolean { return !!this.ctx && this.ctx.state === 'running'; }

  /** Start audio (after the first click or key press). */
  start(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return; }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const bus = () => { const g = this.ctx!.createGain(); g.connect(this.master); return g; };
      this.buses = { music: bus(), ambience: bus(), sfx: bus(), ui: bus(), jingle: bus() };
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    // Anything asked for before audio could start begins now.
    for (const k of ['music', 'ambience'] as const) if (this.want[k] && !this.loops[k]) this.playLoop(k, this.want[k], 1.2, true);
  }

  /** Volumes 0 – 100 from the settings. */
  setVolumes(v: Volumes): void {
    // Perceived loudness: squared.
    const q = (n: number) => (Math.max(0, Math.min(100, n)) / 100) ** 2;
    this.volumes = { master: q(v.master), music: q(v.music), sfx: q(v.sfx), ambience: q(v.ambience), ui: q(v.ui), jingle: q(v.jingle) };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    for (const k of ['music', 'ambience', 'sfx', 'ui', 'jingle'] as const) this.buses[k].gain.setTargetAtTime(this.volumes[k], t, 0.05);
  }

  /** Play an effect. With a world position it gets quieter with distance and pans left / right. */
  play(name: Sfx | string, x?: number, z?: number, gain = 1): void {
    if (!this.ready) return;
    const src = (SFX_NAMES as readonly string[]).includes(name) ? (this.overrides[name as Sfx] ?? `builtin:${name}`) : name;
    if (!src) return;
    let vol = gain, pan = 0;
    if (x !== undefined && z !== undefined) {
      const dx = x - this.listener.x, dz = z - this.listener.z, d = Math.hypot(dx, dz);
      vol *= Math.max(0, 1 - d / 16);
      pan = Math.max(-0.8, Math.min(0.8, dx / 8));
      if (vol <= 0.01) return;
    }
    void this.buffer(src).then((buf) => {
      if (!buf || !this.ctx) return;
      const node = this.ctx.createBufferSource();
      node.buffer = buf;
      // A touch of pitch variety so repeated hits don't sound identical.
      if (src.startsWith('builtin:')) node.playbackRate.value = 0.95 + Math.random() * 0.1;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      let out: AudioNode = g;
      if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
      node.connect(g);
      const bus: Bus = (UI_SFX as readonly string[]).includes(name) ? 'ui' : (JINGLE_SFX as readonly string[]).includes(name) ? 'jingle' : 'sfx';
      out.connect(this.buses[bus]);
      node.start();
    });
  }

  /** Change the music ('' stops it), crossfading over `fade` seconds. */
  music(src: string, fade = 1.5): void { this.playLoop('music', src, fade); }
  /** Change the background sound ('' stops it). */
  ambience(src: string, fade = 2): void { this.playLoop('ambience', src, fade); }
  get currentMusic(): string { return this.want.music; }

  private playLoop(kind: 'music' | 'ambience', src: string, fade: number, force = false): void {
    if (!force && this.want[kind] === src) return;
    this.want[kind] = src;
    if (!this.ready) return;
    const ctx = this.ctx!, t = ctx.currentTime, old = this.loops[kind];
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      old.node.stop(t + fade + 0.05);
      this.loops[kind] = null;
    }
    if (!src) return;
    void this.buffer(src).then((buf) => {
      if (!buf || this.want[kind] !== src || !this.ctx) return;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
      node.connect(g);
      g.connect(this.buses[kind]);
      node.start();
      this.loops[kind] = { src, node, gain: g };
    });
  }

  /** Load (or make) a sound once. */
  private buffer(src: string): Promise<AudioBuffer | null> {
    let b = this.buffers.get(src);
    if (b) return b;
    b = this.load(src);
    this.buffers.set(src, b);
    return b;
  }

  private async load(src: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (src.startsWith('builtin:')) {
      const name = src.slice(8);
      if ((SFX_NAMES as readonly string[]).includes(name)) return mono(ctx, makeSfx(name as SfxName));
      if (name in MUSIC_NAMES) return stereo(ctx, makeMusic(name as MusicName));
      if (name in AMBIENCE_NAMES) return stereo(ctx, makeAmbience(name as AmbienceName));
      return null;
    }
    try {
      const res = await fetch(this.resolve(src));
      if (!res.ok) throw new Error(String(res.status));
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      console.warn(`Sound “${src}” couldn’t be loaded`);
      return null;
    }
  }

  /** Get a sound ready ahead of time (battle music when a map loads), so it doesn't stall when it's needed. */
  prepare(src: string): void { if (this.ready && src && !this.buffers.has(src)) void this.buffer(src); }

  /** Forget a loaded file (after it was replaced in the editor). */
  forget(src: string): void { this.buffers.delete(src); }

  /** Stop everything (leaving the editor's preview, say). */
  stopAll(): void { this.music('', 0.3); this.ambience('', 0.3); }
}

function mono(ctx: AudioContext, data: Float32Array): AudioBuffer {
  const b = ctx.createBuffer(1, Math.max(1, data.length), RATE);
  b.getChannelData(0).set(data);
  return b;
}
function stereo(ctx: AudioContext, s: Stereo): AudioBuffer {
  const b = ctx.createBuffer(2, Math.max(1, s.l.length), s.rate ?? RATE);
  b.getChannelData(0).set(s.l);
  b.getChannelData(1).set(s.r);
  return b;
}

/** Choices for a music or ambience picker: built-ins, then imported files. */
export function loopChoices(kind: 'music' | 'ambience', files: string[]): [string, string][] {
  const names = kind === 'music' ? MUSIC_NAMES : AMBIENCE_NAMES;
  return [['', 'None'], ...Object.entries(names).map(([k, v]) => [`builtin:${k}`, `${v} (built-in)`] as [string, string]),
    ...files.map((f) => [f, f.split('/').pop()!] as [string, string])];
}
