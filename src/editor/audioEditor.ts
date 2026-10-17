/**
 * Sound in the editor: previewing, the project's audio folders (audio/music, audio/ambience, audio/footsteps,
 * audio/sound_effects/…, audio/voices, audio/spells: any file in them can be picked, no importing), importing single
 * files (saved to assets/audio/), the map's music and background sound, and Database → Audio.
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
  manager.setVolumes({ master: 70, music: 70, sfx: 80, ambience: 70, ui: 70, jingle: 80 });
  return manager;
}

/** The files found in the project's audio/ folders (read when the editor opens; Database → Audio → Look again). */
let library: string[] = [];
export const audioLibrary = (): string[] => library;
export async function scanAudioFolders(store: EditorStore): Promise<string[]> {
  library = (await store.project.listAudio?.().catch(() => [])) ?? [];
  return library;
}

/** Every sound that can be picked: the audio folders' files, then any imported ones. */
export const audioFiles = (store: EditorStore): string[] => [...library, ...(store.db.audio?.files ?? []).filter((f) => !library.includes(f))];

/** How a file is named in lists: its place in the audio folders ("music/Forest.wav"), or an imported file's name. */
export const audioLabel = (f: string): string => (f.startsWith('audio/') ? f.slice(6) : f.split('/').pop()!);

/** Read the database's audio files into memory (for previews and playtests), and look in the audio folders. */
export async function loadAudioFiles(store: EditorStore): Promise<void> {
  await scanAudioFolders(store);
  await Promise.all(audioFiles(store).map(async (f) => {
    if (store.files.has(f)) return;
    try { store.files.set(f, await store.project.readFile(f)); } catch { console.warn(`Audio file ${f} is missing`); }
  }));
}

/** Play a sound, or a few seconds of a loop. */
export function preview(store: EditorStore, src: string, loop = false): void {
  // A project folder opened as a file can't be fetched from: read the sound into memory first.
  if (store.project.kind === 'folder' && src.startsWith('audio/') && !store.files.has(src)) {
    void store.project.readFile(src).then((b) => { store.files.set(src, b); preview(store, src, loop); }).catch(() => toast(`Couldn’t read ${src}`, 'error'));
    return;
  }
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
    if (key === 'battleMusic') opts[0] = ['', 'The game’s battle music'];
    const v = m[key] ?? '';
    if (v && !opts.some(([o]) => o === v)) opts.push([v, `${v} (missing)`]);
    return h('div', { class: 'field-row audio-row' },
      field(label, select(opts, v, (nv) => edit(() => { if (nv) m[key] = nv; else delete m[key]; })), hint),
      play(() => { const src = m[key]; if (src) preview(store, src, true); }));
  };
  return [
    row('Music', 'music', 'music'),
    row('Override battle music', 'music', 'battleMusic', 'Only for areas that need their own: battles started here use this instead of the game’s battle music (Database → Audio). A troop, zone or Start battle command can override it again (bosses).'),
    row('Background sound', 'ambience', 'ambience'),
    row('At night', 'ambience', 'ambienceNight', 'Outdoor maps switch to this after dark (crickets, say). None: the same as by day.'),
    row('In autumn & winter', 'ambience', 'ambienceCold', 'Outdoors by day in the cold seasons. None: a forest’s birdsong gives way to cold wind; anything else stays.'),
    h('p', { class: 'hint' }, 'Everything in your project’s audio folders is listed (music/, ambience/, …). Database → Audio sets the game’s battle music.'),
  ];
}

export interface AudioWork { files: string[]; sfx: Record<string, string>; titleMusic?: string; victoryMusic?: string; battleMusic?: string }

/** Database → Audio. */
export function audioTab(store: EditorStore, w: AudioWork, rerender: () => void): HTMLElement[] {
  const all = [...library, ...w.files.filter((f) => !library.includes(f))];
  const fileOpts = all.map((f) => [f, audioLabel(f)] as [string, string]);
  const titleOpts = loopChoices('music', all);
  const folders = new Map<string, number>();
  for (const f of library) { const dir = f.split('/').slice(1, -1).join('/') || '(audio)'; folders.set(dir, (folders.get(dir) ?? 0) + 1); }
  return [
    h('section', { class: 'db-section' }, h('h3', {}, 'Audio folders'),
      library.length
        ? h('div', { class: 'audio-folders' }, ...[...folders].map(([dir, n]) => h('div', { class: 'audio-folder' }, h('code', {}, `audio/${dir}/`), h('span', {}, `${n} file${n === 1 ? '' : 's'}`))))
        : h('p', { class: 'note' }, 'No audio folders found. Put sounds in your project’s audio/ folder (audio/music, audio/ambience, audio/footsteps, audio/sound_effects, audio/voices, audio/spells… any subfolders) and they can be picked everywhere, no importing.'),
      h('button', { type: 'button', class: 'btn', onclick: () => { void scanAudioFolders(store).then(() => { toast(`Found ${library.length} sound${library.length === 1 ? '' : 's'}`); rerender(); }); } }, 'Look again'),
      h('p', { class: 'note' }, 'Files are used where they are. Music and background sounds loop: use files that loop cleanly.')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Battle music'),
      h('div', { class: 'field-row audio-row' },
        field('Every battle', select([['', 'Built-in battle theme'], ...titleOpts.filter(([v]) => v && v !== 'builtin:battle')], w.battleMusic ?? '', (v) => { w.battleMusic = v || undefined; }),
          'Maps can override it (map settings → Override battle music), and so can a troop, an encounter zone or a Start battle command (bosses).'),
        play(() => preview(store, w.battleMusic ?? 'builtin:battle', true)))),
    h('section', { class: 'db-section' }, h('h3', {}, 'Imported files'),
      ...(w.files.length ? w.files.map((f) => h('div', { class: 'audio-file' },
        play(() => preview(store, f, true)), h('span', {}, f.split('/').pop()!),
        h('button', { type: 'button', class: 'mini-btn', title: 'Remove from the list', 'aria-label': `Remove ${f}`, onclick: () => {
          w.files = w.files.filter((x) => x !== f);
          for (const k of Object.keys(w.sfx)) if (w.sfx[k] === f) delete w.sfx[k];
          rerender();
        } }, '✕'))) : [h('p', { class: 'note' }, 'None. The audio folders above are the easy way; importing copies a single file into assets/audio/.')]),
      h('button', { type: 'button', class: 'btn', onclick: () => importAudio(store, w.files, (p) => { w.files = [...w.files, p]; rerender(); }) }, 'Import audio file…'),
      h('p', { class: 'note' }, 'Files are saved to assets/audio/. Music and background sounds loop; use files that loop cleanly.')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Title screen'),
      h('div', { class: 'field-row audio-row' },
        field('Title music', select(titleOpts, w.titleMusic ?? 'builtin:title', (v) => { w.titleMusic = v; })),
        play(() => preview(store, w.titleMusic ?? 'builtin:title', true)))),
    h('section', { class: 'db-section' }, h('h3', {}, 'Victory'),
      h('div', { class: 'field-row audio-row' },
        field('Music after the fanfare', select([['', 'The map’s music'], ...titleOpts.filter(([v]) => v)], w.victoryMusic ?? '', (v) => { w.victoryMusic = v || undefined; }),
          'Plays on the results screens once the victory fanfare ends.'),
        play(() => { if (w.victoryMusic) preview(store, w.victoryMusic, true); }))),
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
export function cleanAudio(w: AudioWork): { files?: string[]; sfx?: Record<string, string>; titleMusic?: string; victoryMusic?: string; battleMusic?: string } | undefined {
  const out: { files?: string[]; sfx?: Record<string, string>; titleMusic?: string; victoryMusic?: string; battleMusic?: string } = {};
  if (w.victoryMusic) out.victoryMusic = w.victoryMusic;
  if (w.battleMusic) out.battleMusic = w.battleMusic;
  if (w.files.length) out.files = w.files;
  if (Object.keys(w.sfx).length) out.sfx = w.sfx;
  if (w.titleMusic && w.titleMusic !== 'builtin:title') out.titleMusic = w.titleMusic;
  return Object.keys(out).length ? out : undefined;
}
