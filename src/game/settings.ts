/**
 * Player settings (the title's Options and the pause menu's Settings): picture, sound and controls.
 * They belong to the player, not to a save: kept in the browser per game, and loading a save never
 * changes them.
 */
import { BINDINGS_VERSION, type Bindings } from './Input';
import type { HudLayout } from '../ui/StatusBars';

/** Text boxes: above or below whoever is talking, or fixed at the top, bottom or centre of the screen. */
export type TextBoxPlace = 'above' | 'below' | 'top' | 'bottom' | 'center';

/** Picture quality: how sharp the picture is drawn and how often shadows are redrawn (auto: by the device). */
export type Quality = 'auto' | 'high' | 'balanced' | 'performance';

export interface Settings {
  quality: Quality;
  /** Show frames per second in a corner. */
  showFps: boolean;
  bloom: boolean;
  depthOfField: boolean;
  shadows: boolean;
  /** Soft shading in corners (SSAO); only on High / Balanced quality. */
  ambientOcclusion: boolean;
  lightShadows: boolean;
  detailedLighting: boolean;
  /** Brightness multiplier, 0.6 – 1.4. */
  brightness: number;
  /** 0 – 100. */
  musicVolume: number;
  soundVolume: number;
  ambienceVolume: number;
  /** Keyboard and controller bindings the player changed (the rest use the defaults). */
  bindings?: Bindings;
  /** Which default controller layout `bindings` was made with (older layouts are replaced). */
  bindingsVersion?: number;
  /** Sneak while the button is held (like Halo's crouch), or press once to toggle. */
  crouch: 'hold' | 'toggle';
  /** Sprint while the run button is held (default), or press once to start and again to stop (controller and touch). */
  sprint: 'hold' | 'toggle';
  /** On a controller, pushing the stick all the way runs. */
  stickRun: boolean;
  /** Where the HUD pieces are and how big (Settings → HUD → Arrange). */
  hud?: HudLayout;
  /** Where text boxes appear. */
  textBox: TextBoxPlace;
  /** The game's own lettering, or an easy-to-read one (players who find pixel text hard to read). */
  easyText?: boolean;
  /** A soft tick as message letters appear (off: silent typing). */
  textTicks?: boolean;
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  alwaysRun: boolean;
  /** Show the clock as 6:30 PM instead of 18:30. */
  clock12: boolean;
  /** Footstep sounds for the hero. */
  footsteps: boolean;
  /** What the adventure log shows on screen (its history in the pause menu always has everything). */
  adventureLog: 'all' | 'noCombat' | 'off';
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'auto', showFps: false, bloom: true, depthOfField: true, shadows: true, ambientOcclusion: true, lightShadows: true, detailedLighting: true,
  brightness: 1, musicVolume: 70, soundVolume: 80, ambienceVolume: 70, textSpeed: 'normal', alwaysRun: false, clock12: false, crouch: 'toggle', sprint: 'hold', stickRun: true, textBox: 'above', adventureLog: 'all', footsteps: true,
};

export const TEXT_SPEEDS: Record<Settings['textSpeed'], number> = { slow: 25, normal: 45, fast: 90, instant: Infinity };

export class SettingsStore {
  private readonly key: string;

  constructor(gameTitle: string, playtest: boolean) {
    const id = gameTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'game';
    this.key = `hd2d:${playtest ? 'playtest:' : ''}${id}:settings`;
  }

  load(): Settings {
    try {
      const raw = localStorage.getItem(this.key);
      return normalizeSettings(raw ? JSON.parse(raw) : {});
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  save(s: Settings): void {
    try { localStorage.setItem(this.key, JSON.stringify(s)); } catch { /* settings just won't stick */ }
  }
}

/** Fill in defaults, keep only known settings, and replace a controller layout made for an older default layout. */
export function normalizeSettings(raw: unknown): Settings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s: Settings = { ...DEFAULT_SETTINGS };
  const out = s as unknown as Record<string, unknown>;
  for (const k of [...Object.keys(DEFAULT_SETTINGS), 'bindings', 'bindingsVersion', 'hud']) if (src[k] !== undefined) out[k] = src[k];
  // The default controller layout changed: a layout saved with an older one is replaced (keys are kept).
  if (s.bindings && (s.bindingsVersion ?? 1) < BINDINGS_VERSION) { s.bindings = { keys: s.bindings.keys ?? {}, pad: {} }; s.bindingsVersion = BINDINGS_VERSION; }
  return s;
}

const FILE_KIND = 'hd2d-settings';

/** Download the settings as a small .json file (HUD layout, controls, picture, sound, gameplay). */
export function exportSettings(s: Settings, gameTitle: string): void {
  const data = { kind: FILE_KIND, version: 1, game: gameTitle, saved: new Date().toISOString(), settings: s };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${gameTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'game'}-settings.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Ask for a settings file and read it. Resolves with the settings, null if the player closed the picker, or throws
 * with a message to show. Browsers only open the file picker right after a key press or click, so a controller
 * button can't open it (`needsClick` tells the caller to say so).
 */
export function importSettings(): { needsClick: true } | Promise<Settings | null> {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  if (ua && !ua.isActive) return { needsClick: true };
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    const finish = () => { done = true; input.remove(); };
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      finish();
      if (!file) { resolve(null); return; }
      try {
        const data = JSON.parse(await file.text()) as { kind?: string; settings?: unknown };
        // A plain settings object (copied from the browser's storage) works too.
        const raw = data?.kind === FILE_KIND ? data.settings : data;
        if (!raw || typeof raw !== 'object' || !('textSpeed' in raw || 'bindings' in raw || 'hud' in raw)) throw new Error('not settings');
        resolve(normalizeSettings(raw));
      } catch { reject(new Error('That file isn’t a settings file')); }
    });
    input.addEventListener('cancel', () => { if (!done) { finish(); resolve(null); } });
    input.click();
  });
}
