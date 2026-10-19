/** Textures for imported ground tiles: repeating, with point or smooth filtering, plus normal maps. */
import * as THREE from 'three';
import { normalMapFrom } from '../core/pixel';
import { loadCanvas, missingImage } from '../shared/images';
import type { TileCatalog } from '../world/tiles';
import type { TileDef } from '../world/types';

export interface TileTexture { def: TileDef; map: THREE.Texture; normal: THREE.Texture }

let maxAniso = 1;
export function setTileAnisotropy(n: number): void { maxAniso = n; }

function texture(canvas: HTMLCanvasElement, def: TileDef, linear: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.encoding = linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  if (def.filter === 'smooth') {
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = maxAniso;
  } else {
    // "Point": crisp pixels up close; mipmaps keep distant ground from shimmering.
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
  }
  return t;
}

/** Load the textures of every imported tile. Missing files become a visible chequerboard. */
export async function loadTileTextures(catalog: TileCatalog, resolve: (path: string) => string, problems: string[]): Promise<Map<string, TileTexture>> {
  const out = new Map<string, TileTexture>();
  await Promise.all(catalog.textured().map(async (def) => {
    let img: HTMLCanvasElement;
    try { img = await loadCanvas(resolve(def.image!)); }
    catch { problems.push(`Tile ${def.name}: texture “${def.image}” is missing`); img = missingImage(32, 32); }
    let nm: HTMLCanvasElement | undefined;
    if (def.normal) {
      try { nm = await loadCanvas(resolve(def.normal)); }
      catch { problems.push(`Tile ${def.name}: normal map “${def.normal}” is missing`); }
    }
    nm ??= normalMapFrom(img, { strength: 2, wrap: true });
    out.set(def.key, { def, map: texture(img, def, false), normal: texture(nm, def, true) });
  }));
  return out;
}
