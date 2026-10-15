/**
 * Built-in sounds made in code: short effects, looping ambience and simple music, so a game has sound
 * before any audio files are imported. Each returns raw samples (mono for effects, stereo for loops).
 * No Web Audio here, so it can be tested on its own.
 */

export const SFX_NAMES = [
  'swing', 'swingHeavy', 'hit', 'crit', 'hurt', 'draw', 'shoot', 'arrowHit', 'fire', 'fireHit', 'dodge', 'guard', 'block', 'parry',
  'defeat', 'target', 'levelUp', 'item', 'coin', 'cut', 'ringOn', 'ringOff', 'menuMove', 'menuOk', 'menuBack', 'jump', 'splash',
  'skill', 'save', 'transfer', 'orb', 'questStart', 'questStep', 'questDone',
  'break', 'dice', 'weak', 'stepGrass', 'stepDirt', 'stepStone', 'stepWood', 'stepSand', 'stepSnow', 'stepWater', 'stepMetal', 'stepCarpet',
  'textTick', 'swim', 'fishCast', 'fishBite', 'fishCatch',
] as const;
export type SfxName = typeof SFX_NAMES[number];

export const SFX_LABELS: Record<SfxName, string> = {
  swing: 'Swing', swingHeavy: 'Heavy swing', hit: 'Hit', crit: 'Critical / sneak attack', hurt: 'Hero hurt', draw: 'Bow draw', shoot: 'Bow shot',
  arrowHit: 'Arrow hits', fire: 'Cast Fire', fireHit: 'Fire hits', dodge: 'Dodge', guard: 'Raise guard', block: 'Block', parry: 'Parry',
  defeat: 'Enemy defeated', target: 'Lock on', levelUp: 'Level up', item: 'Item received', coin: 'Gold', cut: 'Cut down',
  ringOn: 'Ring on', ringOff: 'Ring off', menuMove: 'Menu move', menuOk: 'Menu confirm', menuBack: 'Menu back', jump: 'Jump',
  splash: 'Splash', skill: 'Skill learned', save: 'Saved', transfer: 'Map transfer', orb: 'EXP orb absorbed', questStart: 'Quest started', questStep: 'Quest objective done', questDone: 'Quest complete',
  break: 'Something breaks', dice: 'Dice roll', weak: 'Super effective hit', stepGrass: 'Footstep: grass', stepDirt: 'Footstep: dirt', stepStone: 'Footstep: stone', stepWood: 'Footstep: wood', stepSand: 'Footstep: sand',
  stepSnow: 'Footstep: snow', stepWater: 'Footstep: water', stepMetal: 'Footstep: metal', stepCarpet: 'Footstep: carpet',
  textTick: 'Letter tick (message text)',
  swim: 'Swimming stroke',
  fishCast: 'Fishing: cast', fishBite: 'Fishing: a bite', fishCatch: 'Fishing: caught one',
};

export const MUSIC_NAMES = { title: 'Title theme', field: 'Fields (calm)', night: 'Night', battle: 'Battle', cave: 'Cave' } as const;
export const AMBIENCE_NAMES = { wind: 'Wind', forest: 'Forest (birds)', chill: 'Autumn & winter woods (cold wind, rustling, crows)', night: 'Night (crickets)', cave: 'Cave (drips)', water: 'Stream', rain: 'Rain' } as const;
export type MusicName = keyof typeof MUSIC_NAMES;
export type AmbienceName = keyof typeof AMBIENCE_NAMES;

export const RATE = 44100;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

/** A one-pole low-pass over samples (in place). */
function lowpass(a: Float32Array, cutoff: number): Float32Array {
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < a.length; i++) { y += (a[i] - y) * k; a[i] = y; }
  return a;
}
function highpass(a: Float32Array, cutoff: number): Float32Array {
  const lp = lowpass(Float32Array.from(a), cutoff);
  for (let i = 0; i < a.length; i++) a[i] -= lp[i];
  return a;
}

/** Make `secs` of sound from a function of time (and sample index). */
function make(secs: number, f: (t: number, i: number) => number): Float32Array {
  const n = Math.floor(secs * RATE), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f(i / RATE, i);
  return out;
}

const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sweep = (t: number, f0: number, f1: number, dur: number) => f0 + (f1 - f0) * Math.min(1, t / dur);

/** A short sound effect (mono samples). */
export function makeSfx(name: SfxName): Float32Array {
  const R = rng(name.length * 977 + name.charCodeAt(0));
  const noise = () => R() * 2 - 1;
  let phase = 0;
  const tone = (t: number, f: number, type: 'sine' | 'square' | 'tri' = 'sine') => {
    phase += (2 * Math.PI * f) / RATE;
    const s = Math.sin(phase);
    return type === 'square' ? Math.sign(s) * 0.6 : type === 'tri' ? (2 / Math.PI) * Math.asin(s) : s;
  };
  switch (name) {
    case 'swing': return highpass(lowpass(make(0.22, (t) => noise() * env(t, 0.04, 0.06) * 0.9), 3200), 500);
    case 'swingHeavy': return highpass(lowpass(make(0.35, (t) => noise() * env(t, 0.08, 0.1)), 1800), 200);
    case 'hit': return lowpass(make(0.18, (t) => (noise() * 0.5 + tone(t, sweep(t, 180, 60, 0.12)) * 0.8) * env(t, 0.002, 0.05)), 2400);
    case 'crit': return make(0.35, (t) => (tone(t, sweep(t, 900, 300, 0.2), 'tri') * 0.5 + noise() * 0.3 * env(t, 0.001, 0.03)) * env(t, 0.002, 0.12));
    case 'hurt': return lowpass(make(0.3, (t) => (tone(t, sweep(t, 220, 90, 0.25), 'square') * 0.4 + noise() * 0.4) * env(t, 0.005, 0.09)), 1500);
    case 'draw': return lowpass(make(0.4, (t) => noise() * 0.25 * Math.min(1, t * 4) * (t < 0.35 ? 1 : 0) * (0.6 + 0.4 * Math.sin(t * 90))), 1200);
    case 'shoot': return make(0.25, (t) => (tone(t, sweep(t, 420, 180, 0.08), 'tri') * 0.5 * env(t, 0.001, 0.04) + noise() * 0.25 * env(t, 0.01, 0.07)));
    case 'arrowHit': return lowpass(make(0.15, (t) => (noise() * 0.6 + tone(t, 140) * 0.4) * env(t, 0.001, 0.03)), 2500);
    case 'fire': return lowpass(make(0.5, (t) => (noise() * 0.6 * env(t, 0.05, 0.15) + tone(t, sweep(t, 300, 600, 0.3), 'tri') * 0.2 * env(t, 0.02, 0.2))), 2800);
    case 'fireHit': return lowpass(make(0.6, (t) => noise() * env(t, 0.005, 0.18) * (0.7 + 0.3 * Math.sin(t * 60))), 1600);
    case 'dodge': return highpass(lowpass(make(0.25, (t) => noise() * env(t, 0.06, 0.06) * 0.7), 2200), 300);
    case 'guard': return make(0.15, (t) => tone(t, 520, 'tri') * env(t, 0.003, 0.05) * 0.4);
    case 'block': return make(0.3, (t) => (Math.sign(Math.sin(2 * Math.PI * 380 * t)) * 0.15 + Math.sin(2 * Math.PI * 760 * t) * 0.3 + noise() * 0.3 * env(t, 0, 0.02)) * env(t, 0.001, 0.08));
    case 'parry': return make(0.6, (t) => (Math.sin(2 * Math.PI * 1320 * t) * 0.4 + Math.sin(2 * Math.PI * 1980 * t) * 0.25 + noise() * 0.3 * env(t, 0, 0.015)) * env(t, 0.001, 0.18));
    case 'defeat': return lowpass(make(0.5, (t) => (tone(t, sweep(t, 300, 80, 0.4), 'tri') * 0.5 + noise() * 0.3) * env(t, 0.005, 0.15)), 2000);
    case 'target': return make(0.12, (t) => tone(t, t < 0.05 ? 880 : 1320, 'tri') * env(t, 0.002, 0.04) * 0.35);
    case 'levelUp': return arpeggio([523, 659, 784, 1047, 1319], 0.09, 0.9);
    case 'item': return arpeggio([659, 784, 988], 0.08, 0.5);
    // Dice tumbling on a table: woody clicks coming quicker and softer as they settle.
    case 'dice': {
      const hits = [0, 0.1, 0.18, 0.25, 0.31, 0.36, 0.4, 0.43];
      return highpass(make(0.55, (t) => hits.reduce((a, h, k) => a + (t >= h ? (noise() * 0.6 + tone(t, 1700 + k * 90, 'tri') * 0.4) * env(t - h, 0.0005, 0.012) * (1 - k * 0.09) : 0), 0) * 0.5), 600);
    }
    // A super effective hit: a deep thump and crunch with a bright ring on top.
    case 'weak': return make(0.6, (t) => (
      Math.sin(2 * Math.PI * sweep(t, 170, 45, 0.18) * t) * 0.55 * env(t, 0.002, 0.12)
      + noise() * 0.45 * env(t, 0.001, 0.05)
      + (Math.sin(2 * Math.PI * 1480 * t) * 0.18 + Math.sin(2 * Math.PI * 2220 * t) * 0.12) * env(Math.max(0, t - 0.02), 0.004, 0.16) * (t > 0.02 ? 1 : 0)
    ) * 0.9);
    case 'coin': return make(0.3, (t) => tone(t, t < 0.06 ? 988 : 1319, 'square') * env(t, 0.002, 0.09) * 0.25);
    // A soft rising chime: a sine glide with a little shimmer.
    case 'orb': return make(0.22, (t) => (tone(t, 1180 + t * 2400, 'sine') * 0.8 + tone(t, 2360 + t * 4800, 'sine') * 0.2) * env(t, 0.004, 0.07) * 0.22);
    case 'cut': return highpass(make(0.3, (t) => (noise() * env(t, 0.005, 0.06) + noise() * 0.4 * env(Math.max(0, t - 0.08), 0.01, 0.08) * (t > 0.08 ? 1 : 0)) * 0.8), 900);
    case 'ringOn': return make(0.5, (t) => (Math.sin(2 * Math.PI * sweep(t, 600, 1200, 0.3) * t) * 0.3 + Math.sin(2 * Math.PI * 1800 * t) * 0.1) * env(t, 0.02, 0.15));
    case 'ringOff': return make(0.4, (t) => Math.sin(2 * Math.PI * sweep(t, 900, 400, 0.3) * t) * 0.3 * env(t, 0.01, 0.12));
    // Message text: a tiny, soft wooden blip (a sine with a quick fall), quiet enough to sit under the music.
    // A swimming stroke: a soft swell of water, rising and falling, with a little gurgle.
    case 'swim': return lowpass(make(0.55, (t) => (noise() * env(t, 0.09, 0.2) * (0.55 + 0.45 * Math.sin(t * 55)) + Math.sin(2 * Math.PI * sweep(t, 320, 520, 0.4) * t) * 0.12 * env(Math.max(0, t - 0.15), 0.02, 0.12) * (t > 0.15 ? 1 : 0)) * 0.7), 1300);
    // Fishing: a whippy cast ending in a plop; a quick double plip when something bites; a reel-in ratchet and splash.
    case 'fishCast': return make(0.7, (t) => (t < 0.35 ? noise() * env(t, 0.03, 0.12) * 0.35 * (0.4 + 0.6 * Math.sin(t * 30)) : 0)
      + (t > 0.45 ? Math.sin(2 * Math.PI * sweep(t - 0.45, 520, 180, 0.12) * (t - 0.45)) * env(t - 0.45, 0.003, 0.07) * 0.5 : 0));
    case 'fishBite': return make(0.32, (t) => [0, 0.14].reduce((a, s0) => a + (t > s0 ? Math.sin(2 * Math.PI * sweep(t - s0, 900, 380, 0.07) * (t - s0)) * env(t - s0, 0.002, 0.05) * 0.45 : 0), 0));
    case 'fishCatch': return make(0.75, (t) => (t < 0.45 ? tone(t, 2200, 'square') * 0.05 * (Math.sin(t * 2 * Math.PI * 22) > 0.6 ? 1 : 0) : 0)
      + (t > 0.4 ? noise() * env(t - 0.4, 0.01, 0.16) * 0.5 : 0));
    case 'textTick': return make(0.04, (t) => (tone(t, sweep(t, 1500, 900, 0.03), 'sine') * 0.8 + tone(t, 3000, 'sine') * 0.12) * env(t, 0.0015, 0.012) * 0.16);
    case 'menuMove': return make(0.05, (t) => tone(t, 1200, 'square') * env(t, 0.001, 0.015) * 0.12);
    case 'menuOk': return make(0.12, (t) => tone(t, t < 0.04 ? 880 : 1175, 'square') * env(t, 0.001, 0.04) * 0.15);
    case 'menuBack': return make(0.1, (t) => tone(t, t < 0.04 ? 700 : 520, 'square') * env(t, 0.001, 0.035) * 0.13);
    case 'jump': return make(0.15, (t) => tone(t, sweep(t, 300, 600, 0.12), 'tri') * env(t, 0.003, 0.05) * 0.25);
    case 'splash': return lowpass(make(0.5, (t) => noise() * env(t, 0.01, 0.12) * (0.6 + 0.4 * Math.sin(t * 40))), 1800);
    case 'skill': return arpeggio([392, 523, 659, 784], 0.07, 0.8, true);
    case 'save': return arpeggio([523, 784], 0.12, 0.6, true);
    // Footsteps: short, soft and low, so they sit under everything else. Each one is played with a little random
    // pitch and volume, so a walk doesn't sound like a metronome.
    case 'stepGrass': return highpass(lowpass(make(0.16, (t) => noise() * (0.55 + 0.45 * noise()) * env(t, 0.006, 0.045) * 0.7), 4200), 900);
    case 'stepDirt': return lowpass(make(0.16, (t) => (noise() * 0.6 * env(t, 0.003, 0.035) + tone(t, sweep(t, 140, 70, 0.06)) * 0.45 * env(t, 0.002, 0.04))), 1300);
    case 'stepStone': return highpass(make(0.14, (t) => (noise() * 0.5 * env(t, 0.0008, 0.012) + tone(t, sweep(t, 260, 150, 0.05), 'tri') * 0.35 * env(t, 0.001, 0.025)) * 0.8), 120);
    case 'stepWood': return lowpass(make(0.2, (t) => (tone(t, sweep(t, 230, 170, 0.08), 'tri') * 0.55 * env(t, 0.0015, 0.05) + noise() * 0.35 * env(t, 0.0008, 0.012))), 2600);
    case 'stepSand': return lowpass(make(0.2, (t) => noise() * (0.6 + 0.4 * noise()) * env(t, 0.012, 0.06) * 0.6), 2400);
    case 'stepSnow': return lowpass(make(0.22, (t) => noise() * (R() < 0.35 ? 1 : 0.25) * env(t, 0.01, 0.07) * 0.75), 3200);
    case 'stepWater': return lowpass(make(0.28, (t) => noise() * env(t, 0.008, 0.09) * (0.65 + 0.35 * Math.sin(t * 140)) * 0.75), 1900);
    case 'stepMetal': return make(0.25, (t) => (tone(t, 820, 'tri') * 0.25 + Math.sin(2 * Math.PI * 1290 * t) * 0.18 + noise() * 0.25 * env(t, 0, 0.008)) * env(t, 0.001, 0.07));
    case 'stepCarpet': return lowpass(make(0.14, (t) => (noise() * 0.5 + tone(t, 90) * 0.4) * env(t, 0.008, 0.035)), 700);
    // A crack and a crumble: wood and stone giving way.
    case 'break': return lowpass(make(0.7, (t) => (noise() * env(t, 0.002, 0.05) * 0.9 + noise() * (R() < 0.12 ? 1 : 0.15) * env(t, 0.04, 0.22) * 0.7 + tone(t, sweep(t, 120, 50, 0.3)) * 0.5 * env(t, 0.002, 0.12))), 2600);
    case 'questStart': return arpeggio([392, 494, 587, 784], 0.11, 0.9, true);
    case 'questStep': return arpeggio([784, 1047], 0.08, 0.5, true);
    case 'questDone': return arpeggio([523, 659, 784, 659, 784, 1047], 0.1, 1.1, true);
    case 'transfer': return lowpass(make(0.5, (t) => noise() * 0.3 * env(t, 0.15, 0.15)), 900);
  }
}

/** Rising notes with a soft bell tone. */
function arpeggio(freqs: number[], step: number, tail: number, soft = false): Float32Array {
  const out = new Float32Array(Math.floor((freqs.length * step + tail) * RATE));
  freqs.forEach((f, k) => {
    const start = Math.floor(k * step * RATE);
    for (let i = start; i < out.length; i++) {
      const t = (i - start) / RATE;
      out[i] += (Math.sin(2 * Math.PI * f * t) * 0.3 + Math.sin(4 * Math.PI * f * t) * (soft ? 0.05 : 0.12)) * env(t, 0.004, soft ? 0.35 : 0.25);
    }
  });
  return out;
}

/** Stereo samples. */
export interface Stereo { l: Float32Array; r: Float32Array; rate?: number }

/** Blend a loop's end into its start, so it repeats without a click. */
function seamless(s: Stereo, fade: number): Stereo {
  const n = Math.floor(fade * RATE), len = s.l.length - n;
  const out: Stereo = { l: s.l.slice(0, len), r: s.r.slice(0, len) };
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out.l[i] = s.l[i] * k + s.l[len + i] * (1 - k);
    out.r[i] = s.r[i] * k + s.r[len + i] * (1 - k);
  }
  return out;
}

/** A looping background sound (stereo). */
export function makeAmbience(name: AmbienceName): Stereo {
  const secs = 14, R = rng(name.length * 131 + 7), n = secs * RATE;
  const l = new Float32Array(n), r = new Float32Array(n);
  const noise = (a: Float32Array) => { for (let i = 0; i < a.length; i++) a[i] = R() * 2 - 1; return a; };
  const add = (dst: Float32Array, src: Float32Array, gain: number, at = 0) => { for (let i = 0; i < src.length && at + i < dst.length; i++) dst[at + i] += src[i] * gain; };
  // A breeze under almost everything: low-passed noise swelling slowly.
  const breeze = (gain: number, cutoff: number) => {
    const a = lowpass(noise(new Float32Array(n)), cutoff), b = lowpass(noise(new Float32Array(n)), cutoff);
    for (let i = 0; i < n; i++) { const t = i / RATE, sw = 0.55 + 0.45 * Math.sin((2 * Math.PI * t) / secs * 2 + 1.3); l[i] += a[i] * gain * sw; r[i] += b[i] * gain * (1.1 - sw * 0.2); }
  };
  if (name === 'wind') breeze(1.4, 400);
  if (name === 'forest') {
    breeze(0.6, 500);
    for (let k = 0; k < 14; k++) {
      // A bird: a few quick chirps.
      const at = Math.floor(R() * (n - RATE)), f = 2200 + R() * 1800, pan = R();
      const chirp = make(0.5, (t) => { const c = t % 0.11; return Math.sin(2 * Math.PI * (f + Math.sin(c * 60) * 400) * t) * Math.exp(-c * 40) * (t < 0.11 * (2 + Math.floor(R() * 2)) ? 1 : 0); });
      add(l, chirp, 0.12 * (1 - pan), at); add(r, chirp, 0.12 * pan, at);
    }
  }
  if (name === 'chill') {
    // Autumn and winter: a colder, gustier wind, dry leaves skittering, and now and then a far-off crow.
    breeze(1.1, 320);
    for (let k = 0; k < 10; k++) {
      const at = Math.floor(R() * (n - RATE * 2)), pan = R();
      const rustle = highpass(make(1.2, (t) => (R() * 2 - 1) * Math.sin(Math.PI * t / 1.2) * (0.5 + 0.5 * Math.sin(t * 37))), 2500);
      add(l, rustle, 0.07 * (1 - pan), at); add(r, rustle, 0.07 * pan, at);
    }
    for (let k = 0; k < 3; k++) {
      const at = Math.floor(R() * (n - RATE * 2)), pan = R(), f = 520 + R() * 120;
      const caw = lowpass(make(1.1, (t) => { const c = t % 0.38; return (t < 0.38 * 2 ? 1 : 0) * Math.sign(Math.sin(2 * Math.PI * (f - c * 500) * t)) * Math.exp(-c * 9) * (c < 0.25 ? 1 : 0); }), 1400);
      add(l, caw, 0.045 * (1 - pan), at); add(r, caw, 0.045 * pan, at);
    }
  }
  if (name === 'night') {
    breeze(0.45, 350);
    for (let k = 0; k < 40; k++) {
      // Crickets: fast pulses of a high tone.
      const at = Math.floor(R() * (n - RATE)), f = 4200 + R() * 900, pan = R();
      const c = make(0.4, (t) => Math.sin(2 * Math.PI * f * t) * (Math.sin(2 * Math.PI * 30 * t) > 0.2 ? 1 : 0) * Math.sin(Math.PI * t / 0.4));
      add(l, c, 0.04 * (1 - pan), at); add(r, c, 0.04 * pan, at);
    }
  }
  if (name === 'cave') {
    const rum = lowpass(noise(new Float32Array(n)), 90);
    add(l, rum, 2.2); add(r, rum, 2.2);
    for (let k = 0; k < 12; k++) {
      // A drip: a short falling plink with an echo.
      const at = Math.floor(R() * (n - RATE * 1.5)), f = 900 + R() * 900, pan = R();
      const d = make(1.2, (t) => Math.sin(2 * Math.PI * f * (1 - t * 0.6) * t) * (Math.exp(-t * 30) + 0.35 * Math.exp(-Math.max(0, t - 0.25) * 25) * (t > 0.25 ? 1 : 0)));
      add(l, d, 0.18 * (1 - pan), at); add(r, d, 0.18 * pan, at);
    }
  }
  if (name === 'water' || name === 'rain') {
    const a = noise(new Float32Array(n)), b = noise(new Float32Array(n));
    highpass(lowpass(a, name === 'rain' ? 5000 : 2200), 300); highpass(lowpass(b, name === 'rain' ? 5000 : 2200), 300);
    for (let i = 0; i < n; i++) { const t = i / RATE, burble = name === 'water' ? 0.7 + 0.3 * Math.sin(t * 7.3) * Math.sin(t * 3.1) : 1; l[i] += a[i] * 0.5 * burble; r[i] += b[i] * 0.5 * burble; }
    if (name === 'rain') breeze(0.4, 300);
  }
  return seamless({ l, r }, 1.5);
}

/** Note number → frequency (60 = middle C). */
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Simple looping music (stereo): pads, a bass, and a gentle melody; battle adds drums. */
export function makeMusic(name: MusicName): Stereo {
  const plan: Record<MusicName, { bpm: number; chords: number[][]; scale: number[]; root: number; drums?: boolean; melody: number; pad: number; bright: number }> = {
    title: { bpm: 70, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], scale: [0, 2, 4, 7, 9], root: 60, melody: 0.5, pad: 1, bright: 0.6 },
    field: { bpm: 92, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], scale: [0, 2, 4, 7, 9], root: 62, melody: 0.9, pad: 0.8, bright: 0.8 },
    night: { bpm: 66, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], scale: [0, 3, 5, 7, 10], root: 57, melody: 0.5, pad: 1, bright: 0.4 },
    battle: { bpm: 138, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], scale: [0, 2, 3, 5, 7, 8, 11], root: 57, drums: true, melody: 1, pad: 0.6, bright: 0.9 },
    cave: { bpm: 54, chords: [[0, 3, 7], [1, 4, 8], [0, 3, 7], [-2, 1, 5]], scale: [0, 1, 3, 5, 7, 8], root: 50, melody: 0.35, pad: 1.1, bright: 0.25 },
  };
  // Music is made at half rate: it's mostly low notes, and it makes the tracks twice as fast to build.
  const SR = RATE / 2;
  const p = plan[name], R = rng(name.length * 53 + 11);
  const beat = 60 / p.bpm, bar = beat * 4, bars = p.chords.length * 2, secs = bars * bar, n = Math.ceil(secs * SR);
  const l = new Float32Array(n), r = new Float32Array(n);
  const note = (start: number, dur: number, f: number, gain: number, pan: number, kind: 'pad' | 'pluck' | 'bass') => {
    const s = Math.floor(start * SR), len = Math.floor((dur + (kind === 'pad' ? 1.2 : 0.6)) * SR);
    for (let i = 0; i < len; i++) {
      const t = i / SR, idx = (s + i) % n; // wraps, so tails continue at the start of the loop
      let v: number;
      if (kind === 'pad') v = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.003 * t) + 0.15 * Math.sin(2 * Math.PI * f * 0.5 * t)) * Math.min(1, t / 0.8) * (t < dur ? 1 : Math.exp(-(t - dur) * 3));
      else if (kind === 'bass') v = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) * Math.min(1, t / 0.01) * Math.exp(-t * 2.2);
      else v = (Math.sin(2 * Math.PI * f * t) + p.bright * 0.35 * Math.sin(4 * Math.PI * f * t) + p.bright * 0.12 * Math.sin(6 * Math.PI * f * t)) * Math.min(1, t / 0.005) * Math.exp(-t * 4);
      l[idx] += v * gain * (1 - pan); r[idx] += v * gain * pan;
    }
  };
  for (let b = 0; b < bars; b++) {
    const chord = p.chords[b % p.chords.length], t0 = b * bar;
    for (const [k, c] of chord.entries()) note(t0, bar, hz(p.root + c - 12), 0.05 * p.pad, 0.3 + k * 0.2, 'pad');
    note(t0, bar, hz(p.root + chord[0] - 24), 0.16, 0.5, 'bass');
    if (p.drums) note(t0 + beat * 2, beat, hz(p.root + chord[0] - 24), 0.12, 0.5, 'bass');
    // Melody: notes from the scale near the chord, some beats left empty.
    const steps = p.drums ? 8 : 4;
    for (let s = 0; s < steps; s++) {
      if (R() > p.melody * 0.8) continue;
      const deg = p.scale[Math.floor(R() * p.scale.length)] + (R() < 0.3 ? 12 : 0);
      note(t0 + (s * bar) / steps, bar / steps, hz(p.root + deg), 0.09, 0.35 + R() * 0.3, 'pluck');
    }
    if (p.drums) {
      for (let s = 0; s < 8; s++) {
        const at = Math.floor((t0 + (s * beat) / 2) * SR), kick = s % 4 === 0, snare = s % 4 === 2;
        const len = Math.floor(0.2 * SR);
        for (let i = 0; i < len && at + i < n; i++) {
          const t = i / SR;
          const v = kick ? Math.sin(2 * Math.PI * (120 - t * 300) * t) * Math.exp(-t * 18) * 0.5
            : snare ? (R() * 2 - 1) * Math.exp(-t * 22) * 0.25 : (R() * 2 - 1) * Math.exp(-t * 60) * 0.07;
          l[at + i] += v; r[at + i] += v;
        }
      }
    }
  }
  // Keep it under clipping.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const g = peak > 0 ? 0.7 / peak : 1;
  for (let i = 0; i < n; i++) { l[i] *= g; r[i] *= g; }
  return { l, r, rate: SR };
}
