/**
 * Sound in the editor: previewing, importing audio files (saved to assets/audio/), the map's music and
 * background sound, and Database → Audio (which file each sound effect uses, the title music).
 */
import { AudioManager, loopChoices } from '../audio/sfx';
import { SFX_LABELS, SFX_NAMES } from '../audio/synth';
import type { MapData } from '../world/types';
import { field, h, select, toast } from './dom';
import type { EditorStore } from './store';

let manager: AudioManager | null = null;
const urls = new Map<string, string>();

/** The editor's player (it plays imported files straight from memory). */
export function editorAudio(store: EditorStore): AudioManager {
  manager ??= new AudioManager((path) => {
    const b = store.files.get(path);
    if (!b) return path;
    let u = urls.get(path);
    if (!u) { u = URL.createObjectURL(b); urls.set(path, u); }
    return u;
  });
  manager.setVolumes(70, 80, 70);
  return manager;
}

export const audioFiles = (store: EditorStore): string[] => store.db.audio?.files ?? [];

/** Read the database's audio files into memory (for previews and playtests). */
export async function loadAudioFiles(store: EditorStore): Promise<void> {
  await Promise.all(audioFiles(store).map(async (f) => {
    if (store.files.has(f)) return;
    try { store.files.set(f, await store.project.readFile(f)); } catch { console.warn(`Audio file ${f} is missing`); }
  }));
}

/** Play a sound, or a few seconds of a loop. */
export function preview(store: EditorStore, src: string, loop = false): void {
  const a = editorAudio(store);
  a.start();
  if (!loop) { a.play(src); return; }
  a.music(src, 0.3);
  window.setTimeout(() => { if (a.currentMusic === src) a.music('', 1); }, 6000);
}

/** Pick a file and add it to the project's audio. Returns its path, or null. */
export function importAudio(store: EditorStore, files: string[], done: (path: string) => void): void {
  const input = h('input', { type: 'file', accept: 'audio/*,.ogg,.mp3,.wav,.m4a' });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    const ext = (f.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.ogg').toLowerCase();
    const base = f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sound';
    let path = `assets/audio/${base}${ext}`, n = 2;
    while (files.includes(path)) path = `assets/audio/${base}_${n++}${ext}`;
    const p = store.project, persistent = p.canSave && p.canStoreImages;
    try { if (persistent) await p.writeFile(path, f); }
    catch (err) { toast(`Couldn’t save the sound: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
    store.files.set(path, f);
    if (!persistent) toast('Sound kept for this session only: open the project folder itself to save imported files.');
    done(path);
  });
  input.click();
}

const play = (onclick: () => void, label = 'Preview') => h('button', { type: 'button', class: 'mini-btn', title: label, 'aria-label': label, onclick }, '▶');

/** Map settings: music, battle music, background sound by day and at night. */
export function mapAudioFields(store: EditorStore, m: MapData, edit: (fn: () => void) => void): HTMLElement[] {
  const files = audioFiles(store);
  const row = (label: string, kind: 'music' | 'ambience', key: 'music' | 'battleMusic' | 'ambience' | 'ambienceNight' | 'ambienceCold', hint?: string) => {
    const opts = loopChoices(kind, files);
    const v = m[key] ?? '';
    if (v && !opts.some(([o]) => o === v)) opts.push([v, `${v} (missing)`]);
    return h('div', { class: 'field-row audio-row' },
      field(label, select(opts, v, (nv) => edit(() => { if (nv) m[key] = nv; else delete m[key]; })), hint),
      play(() => { const src = m[key]; if (src) preview(store, src, true); }));
  };
  return [
    row('Music', 'music', 'music'),
    row('Battle music', 'music', 'battleMusic', 'Takes over while an enemy is hunting the hero (turn-based battles: during each battle).'),
    row('Background sound', 'ambience', 'ambience'),
    row('At night', 'ambience', 'ambienceNight', 'Outdoor maps switch to this after dark (crickets, say). None: the same as by day.'),
    row('In autumn & winter', 'ambience', 'ambienceCold', 'Outdoors by day in the cold seasons. None: a forest’s birdsong gives way to cold wind; anything else stays.'),
    h('p', { class: 'hint' }, 'Import your own music and sounds in Database → Audio.'),
  ];
}

export interface AudioWork { files: string[]; sfx: Record<string, string>; titleMusic?: string }

/** Database → Audio. */
export function audioTab(store: EditorStore, w: AudioWork, rerender: () => void): HTMLElement[] {
  const fileOpts = w.files.map((f) => [f, f.split('/').pop()!] as [string, string]);
  const titleOpts = loopChoices('music', w.files);
  return [
    h('section', { class: 'db-section' }, h('h3', {}, 'Audio files'),
      ...(w.files.length ? w.files.map((f) => h('div', { class: 'audio-file' },
        play(() => preview(store, f, true)), h('span', {}, f.split('/').pop()!),
        h('button', { type: 'button', class: 'mini-btn', title: 'Remove from the list', 'aria-label': `Remove ${f}`, onclick: () => {
          w.files = w.files.filter((x) => x !== f);
          for (const k of Object.keys(w.sfx)) if (w.sfx[k] === f) delete w.sfx[k];
          rerender();
        } }, '✕'))) : [h('p', { class: 'note' }, 'No audio files yet. The built-in sounds, music and ambience are made in code; import .ogg, .mp3 or .wav files to use your own.')]),
      h('button', { type: 'button', class: 'btn', onclick: () => importAudio(store, w.files, (p) => { w.files = [...w.files, p]; rerender(); }) }, 'Import audio file…'),
      h('p', { class: 'note' }, 'Files are saved to assets/audio/. Music and background sounds loop; use files that loop cleanly.')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Title screen'),
      h('div', { class: 'field-row audio-row' },
        field('Title music', select(titleOpts, w.titleMusic ?? 'builtin:title', (v) => { w.titleMusic = v; })),
        play(() => preview(store, w.titleMusic ?? 'builtin:title', true)))),
    h('section', { class: 'db-section sfx-section' }, h('h3', {}, 'Sound effects'),
      h('div', { class: 'sfx-grid' }, ...SFX_NAMES.flatMap((n) => {
        const cur = w.sfx[n] ?? `builtin:${n}`;
        const opts: [string, string][] = [[`builtin:${n}`, 'Built-in'], ['', 'Silent'], ...fileOpts];
        return [
          h('span', { class: 'db-name' }, SFX_LABELS[n]),
          select(opts, cur, (v) => { if (v === `builtin:${n}`) delete w.sfx[n]; else w.sfx[n] = v; }, { 'aria-label': `${SFX_LABELS[n]} sound` }),
          play(() => { const src = w.sfx[n] ?? `builtin:${n}`; if (src) preview(store, src); }),
        ];
      }))),
  ];
}

/** Only what differs from the defaults, for database.json. */
export function cleanAudio(w: AudioWork): { files?: string[]; sfx?: Record<string, string>; titleMusic?: string } | undefined {
  const out: { files?: string[]; sfx?: Record<string, string>; titleMusic?: string } = {};
  if (w.files.length) out.files = w.files;
  if (Object.keys(w.sfx).length) out.sfx = w.sfx;
  if (w.titleMusic && w.titleMusic !== 'builtin:title') out.titleMusic = w.titleMusic;
  return Object.keys(out).length ? out : undefined;
}
