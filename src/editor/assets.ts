/**
 * Imported props: loading them with the project, and saving, replacing or deleting them.
 * Images go to public/assets/props/ and the list to public/data/assets.json, saved straight away
 * (an import isn't part of the map's undo history).
 */
import { formatAssets } from '../shared/dataFiles';
import { canvasFromBlob } from '../shared/images';
import type { Ailment, PropDef, TileDef, TileBlend } from '../world/types';
import { defaultBlend } from '../world/blend';
import { toast } from './dom';
import { setCustomPropImage, setCustomTileImage } from './editorArt';
import { BRICKS } from '../world/tiles';
import type { EditorStore } from './store';

/** Read the asset list and every imported image. Missing images show as a chequerboard. */
export async function loadProjectAssets(store: EditorStore): Promise<void> {
  const assets = await store.project.readAssets();
  await Promise.all(assets.props.map(async (d) => {
    for (const path of [d.image, d.normal, d.glow]) {
      if (!path) continue;
      try {
        const blob = await store.project.readFile(path);
        store.files.set(path, blob);
        if (path === d.image) setCustomPropImage(d.id, await canvasFromBlob(blob));
      } catch {
        if (path === d.image) console.warn(`${d.name}: image ${path} is missing`);
      }
    }
  }));
  await Promise.all(assets.tiles.map(async (t) => {
    for (const path of [t.image, t.normal]) {
      if (!path) continue;
      try {
        const blob = await store.project.readFile(path);
        store.files.set(path, blob);
        if (path === t.image) setCustomTileImage(t.key, await canvasFromBlob(blob));
      } catch {
        if (path === t.image) console.warn(`Tile ${t.name}: texture ${path} is missing`);
      }
    }
  }));
  store.setAssets(assets);
}

export interface PropImages { image: Blob; normal?: Blob; glow?: Blob }

/** Save a new or edited prop: its images, then the updated asset list. Returns false if saving failed. */
export async function commitProp(store: EditorStore, def: PropDef, images: PropImages, preview: HTMLCanvasElement): Promise<boolean> {
  const p = store.project;
  const base = `assets/props/${def.id}`;
  const files: [string, Blob][] = [[`${base}.png`, images.image]];
  def.image = `${base}.png`;
  if (images.normal) { def.normal = `${base}_normal.png`; files.push([def.normal, images.normal]); } else delete def.normal;
  if (images.glow) { def.glow = `${base}_glow.png`; files.push([def.glow, images.glow]); } else delete def.glow;

  const props = store.assets.props.filter((d) => d.id !== def.id);
  props.push(def);
  const next = { ...store.assets, props };

  const persistent = p.canSave && p.canStoreImages;
  if (persistent) {
    try {
      for (const [path, blob] of files) await p.writeFile(path, blob);
      await p.write('assets.json', formatAssets(next));
    } catch (err) {
      toast(`Couldn’t save the prop: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    }
  }
  for (const [path, blob] of files) store.files.set(path, blob);
  setCustomPropImage(def.id, preview);
  store.setAssets(next);
  if (!persistent) {
    toast(p.canSave
      ? 'Imported for this session only. Pick the project folder itself (not public/data) to keep imported props.'
      : 'Imported for this session only. Open the editor from your project to keep imported props.');
  } else toast(`Saved “${def.name}” to assets/props/`);
  return true;
}

/** Remove a prop from the asset list (its image files stay on disk) and from the open map. */
export async function deleteProp(store: EditorStore, id: string): Promise<void> {
  const next = { ...store.assets, props: store.assets.props.filter((d) => d.id !== id) };
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t update the asset list: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  const before = store.map.props.length;
  store.checkpoint();
  store.map.props = store.map.props.filter((p) => p.type !== id);
  const removed = before - store.map.props.length;
  if (removed) store.changed(); else store.dropCheckpoint();
  setCustomPropImage(id, null);
  if (store.propType === id) store.propType = 'oak';
  store.select(null);
  store.setAssets(next);
  toast(removed ? `Deleted the prop and ${removed} placed cop${removed === 1 ? 'y' : 'ies'} on this map.` : 'Deleted the prop.');
}

/** Undo a customised built-in prop: remove the saved copy so the original art and settings return. */
export async function resetProp(store: EditorStore, id: string): Promise<void> {
  const next = { ...store.assets, props: store.assets.props.filter((d) => d.id !== id) };
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t update the asset list: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  setCustomPropImage(id, null);
  store.setAssets(next);
  toast('Back to the original built-in prop.');
}

/* ------------------------------------------------------------ tiles */

export interface TileImages { image: Blob; normal?: Blob }

/** Save a new or edited tile: its textures, then the updated asset list. Returns false if saving failed. */
export async function commitTile(store: EditorStore, def: TileDef, images: TileImages, preview: HTMLCanvasElement): Promise<boolean> {
  const p = store.project;
  const base = `assets/tiles/${def.id}`;
  const files: [string, Blob][] = [[`${base}.png`, images.image]];
  def.image = `${base}.png`;
  if (images.normal) { def.normal = `${base}_normal.png`; files.push([def.normal, images.normal]); } else delete def.normal;

  const tiles = store.assets.tiles.filter((t) => t.key !== def.key);
  tiles.push(def);
  const next = { ...store.assets, tiles };
  const persistent = p.canSave && p.canStoreImages;
  if (persistent) {
    try {
      for (const [path, blob] of files) await p.writeFile(path, blob);
      await p.write('assets.json', formatAssets(next));
    } catch (err) {
      toast(`Couldn’t save the tile: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    }
  }
  for (const [path, blob] of files) store.files.set(path, blob);
  setCustomTileImage(def.key, preview);
  store.setAssets(next);
  toast(persistent ? `Saved “${def.name}” to assets/tiles/` : 'Imported for this session only. Open the editor from your project to keep imported tiles.');
  return true;
}

/**
 * A built-in tile's picture: your own (true) or the built-in art (false). The picture stays in the asset list
 * either way, to switch back to; the tile keeps everything else.
 */
export async function setTileSkin(store: EditorStore, key: string, on: boolean): Promise<void> {
  const tiles = store.assets.tiles.map((t) => (t.key === key ? { ...t, skin: on } : t));
  const next = { ...store.assets, tiles };
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t save the tile setting: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  store.setAssets(next);
}

/** Remove a tile from the asset list. Cells using it on the open map turn back into grass (undoable). */
export async function deleteTile(store: EditorStore, key: string): Promise<void> {
  const next = { ...store.assets, tiles: store.assets.tiles.filter((t) => t.key !== key) };
  // Forget cliff settings of this tile, and any that used it (those fall back to the map default).
  if (next.tileCliffs) {
    const c = Object.fromEntries(Object.entries(next.tileCliffs).filter(([k, v]) => k !== key && v !== key));
    if (Object.keys(c).length) next.tileCliffs = c; else delete next.tileCliffs;
  }
  if (next.tileRoads && key in next.tileRoads) {
    const r = { ...next.tileRoads };
    delete r[key];
    if (Object.keys(r).length) next.tileRoads = r; else delete next.tileRoads;
  }
  if (next.tileAilments && key in next.tileAilments) {
    const r = { ...next.tileAilments };
    delete r[key];
    if (Object.keys(r).length) next.tileAilments = r; else delete next.tileAilments;
  }
  if (next.tileSteps && key in next.tileSteps) {
    const r = { ...next.tileSteps };
    delete r[key];
    if (Object.keys(r).length) next.tileSteps = r; else delete next.tileSteps;
  }
  if (next.tileBlend?.[key]) {
    const b = { ...next.tileBlend };
    delete b[key];
    if (Object.keys(b).length) next.tileBlend = b; else delete next.tileBlend;
  }
  if (store.map.cliffTile === key) { store.checkpoint(); delete store.map.cliffTile; store.changed(); }
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t update the asset list: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  store.checkpoint();
  let n = 0;
  store.map.terrain = store.map.terrain.map((row) => row.replace(new RegExp(escapeRe(key), 'g'), () => { n++; return '.'; }));
  if (n) store.changed(); else store.dropCheckpoint();
  setCustomTileImage(key, null);
  if (store.terrain === key) store.terrain = '.';
  store.setAssets(next);
  toast(n ? `Deleted the tile; ${n} cell${n === 1 ? '' : 's'} on this map became grass.` : 'Deleted the tile.');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Set (or clear, with undefined) a tile type's own cliff wall look, saving the asset list straight away. */
export async function setTileCliff(store: EditorStore, key: string, look: string | undefined): Promise<void> {
  const cliffs = { ...(store.assets.tileCliffs ?? {}) };
  if (look) cliffs[key] = look; else delete cliffs[key];
  const next = { ...store.assets, tileCliffs: Object.keys(cliffs).length ? cliffs : undefined };
  if (!next.tileCliffs) delete next.tileCliffs;
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t save the cliff setting: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  store.setAssets(next);
}

/** Mark a tile as a road (it continues straight on past the map edge), or not. Only differences from the default are saved. */
export async function setTileRoad(store: EditorStore, key: string, on: boolean): Promise<void> {
  const roads = { ...(store.assets.tileRoads ?? {}) };
  if (on === (key === '=')) delete roads[key]; else roads[key] = on;
  const next = { ...store.assets, tileRoads: Object.keys(roads).length ? roads : undefined };
  if (!next.tileRoads) delete next.tileRoads;
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t save the road setting: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  store.setAssets(next);
}

/** Set the ailment a tile gives while stood on (undefined: none). */
export async function setTileAilment(store: EditorStore, key: string, value: { ailment: Ailment; chance?: number; seconds?: number } | undefined): Promise<void> {
  const all = { ...(store.assets.tileAilments ?? {}) };
  if (value) all[key] = value; else delete all[key];
  const next = { ...store.assets, tileAilments: Object.keys(all).length ? all : undefined };
  if (!next.tileAilments) delete next.tileAilments;
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t save the tile’s ailment: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  store.setAssets(next);
}

/** Set what a tile sounds like underfoot ('' or undefined: guessed from its name). */
export async function setTileSteps(store: EditorStore, key: string, material: string | undefined): Promise<void> {
  const steps = { ...(store.assets.tileSteps ?? {}) };
  if (material) steps[key] = material; else delete steps[key];
  const next = { ...store.assets, tileSteps: Object.keys(steps).length ? steps : undefined };
  if (!next.tileSteps) delete next.tileSteps;
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t save the footstep setting: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  store.setAssets(next);
}

/** Save a tile's edge blending (only the settings that differ from its defaults). */
export async function setTileBlend(store: EditorStore, key: string, blend: TileBlend): Promise<void> {
  const def = defaultBlend(store.tiles.get(key));
  const diff = Object.fromEntries(Object.entries(blend).filter(([k, v]) => v !== def[k as keyof TileBlend])) as Partial<TileBlend>;
  const all = { ...(store.assets.tileBlend ?? {}) };
  if (Object.keys(diff).length) all[key] = diff; else delete all[key];
  const next = { ...store.assets, tileBlend: Object.keys(all).length ? all : undefined };
  if (!next.tileBlend) delete next.tileBlend;
  if (store.project.canSave && store.project.canStoreImages) {
    try { await store.project.write('assets.json', formatAssets(next)); }
    catch (err) { toast(`Couldn’t save the blend setting: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
  }
  store.setAssets(next);
}

/** Choices for cliff walls: the built-in bricks and every imported tile. */
export function cliffChoices(store: EditorStore): [string, string][] {
  return [[BRICKS, 'Stone bricks'], ...store.tiles.all().map((t) => [t.key, t.builtin ? t.name : `${t.name} (imported)`] as [string, string])];
}

/** Name of the look the map uses by default. */
export function mapCliffName(store: EditorStore): string {
  const c = store.map.cliffTile;
  return c && c !== BRICKS && store.tiles.get(c) ? store.tiles.get(c)!.name : 'Stone bricks';
}
