/**
 * The prop catalog: built-in props (art generated in code) plus props imported from images
 * (public/data/assets.json). Shared by the game and the editor.
 */
import { migratePlateaus, migrateWaterTiles } from './heights';
import type { AssetRegistry, LegacyLightData, LightData, MapData, PropData, PropDef } from './types';

const T = 16; // pixels per tile in the built-in art

/** Built-in props. Sizes match their generated art (16 px per tile). */
export const BUILTIN_PROPS: PropDef[] = [
  { id: 'oak', name: 'Oak tree', builtin: 'oak', w: 32 / T, h: 40 / T, block: [0], sway: 1 },
  { id: 'pine', name: 'Pine tree', builtin: 'pine', w: 26 / T, h: 44 / T, block: [0], sway: 0.8 },
  { id: 'bush', name: 'Bush', builtin: 'bush', w: 22 / T, h: 15 / T, block: [0], sway: 0.5 },
  { id: 'rock', name: 'Rock', builtin: 'rock', w: 18 / T, h: 13 / T, block: [0] },
  { id: 'pebble', name: 'Pebble', builtin: 'pebble', w: 10 / T, h: 7 / T, block: [] },
  { id: 'tuft', name: 'Grass tuft', builtin: 'tuft', w: 12 / T, h: 9 / T, block: [], sway: 1.3 },
  { id: 'flowers', name: 'Flowers', builtin: 'flowers', w: 14 / T, h: 9 / T, block: [], sway: 1.2 },
  { id: 'cactus', name: 'Cactus', builtin: 'cactus', w: 16 / T, h: 26 / T, block: [0], season: 'off' },
  { id: 'dry_bush', name: 'Dry bush (desert)', builtin: 'dry_bush', w: 16 / T, h: 10 / T, block: [], sway: 0.6, season: 'off' },
  { id: 'sandstone', name: 'Sandstone rock', builtin: 'sandstone', w: 20 / T, h: 14 / T, block: [0] },
  { id: 'snowy_pine', name: 'Snowy pine', builtin: 'snowy_pine', w: 26 / T, h: 44 / T, block: [0], sway: 0.6, season: 'off' },
  { id: 'snow_rock', name: 'Snowy rock', builtin: 'snow_rock', w: 18 / T, h: 13 / T, block: [0] },
  { id: 'bridge_wood_h', name: 'Wooden bridge (east–west)', builtin: 'bridge_wood_h', w: 1, h: 0.4, block: [], castShadow: false, deck: { style: 'wood', dir: 'h', rails: true } },
  { id: 'bridge_wood_v', name: 'Wooden bridge (north–south)', builtin: 'bridge_wood_v', w: 1, h: 0.4, block: [], castShadow: false, deck: { style: 'wood', dir: 'v', rails: true } },
  { id: 'bridge_rope_h', name: 'Rope bridge (east–west)', builtin: 'bridge_rope_h', w: 1, h: 0.4, block: [], castShadow: false, deck: { style: 'rope', dir: 'h' } },
  { id: 'bridge_rope_v', name: 'Rope bridge (north–south)', builtin: 'bridge_rope_v', w: 1, h: 0.4, block: [], castShadow: false, deck: { style: 'rope', dir: 'v' } },
  { id: 'bridge_stone_h', name: 'Stone bridge (east–west)', builtin: 'bridge_stone_h', w: 1, h: 0.4, block: [], castShadow: false, deck: { style: 'stone', dir: 'h', rails: true } },
  { id: 'bridge_stone_v', name: 'Stone bridge (north–south)', builtin: 'bridge_stone_v', w: 1, h: 0.4, block: [], castShadow: false, deck: { style: 'stone', dir: 'v', rails: true } },
  { id: 'dock', name: 'Dock / wooden platform', builtin: 'dock', w: 1, h: 0.2, block: [], castShadow: false, deck: { style: 'wood', dir: 'h' } },
  { id: 'platform_stone', name: 'Stone platform', builtin: 'platform_stone', w: 1, h: 0.3, block: [], castShadow: false, deck: { style: 'stone', rails: false } },
  { id: 'sign', name: 'Signpost', builtin: 'sign', w: 14 / T, h: 18 / T, block: [0] },
  {
    id: 'campfire', name: 'Campfire', builtin: 'logs', w: 22 / T, h: 11 / T, block: [0], castShadow: false, respawn: true,
    flame: { x: 0, y: 0.12, w: 1.0, h: 1.5, embers: true },
    light: { x: 0, y: 0.7, color: '#ff9a45', intensity: 3, radius: 9, schedule: 'nightBoost', flicker: 'fire', shadows: true },
  },
  {
    id: 'torch', name: 'Torch', builtin: 'torch', w: 8 / T, h: 22 / T, block: [0],
    flame: { x: 0, y: 1.08, w: 0.5, h: 0.75, embers: true },
    light: { x: 0, y: 1.35, color: '#ffb35c', intensity: 2.2, radius: 7, schedule: 'nightBoost', flicker: 'fire' },
  },
  // Wall lights: they sit flat against the wall behind them and burn out like the campfire (feed them fuel, or light
  // them for a moment with a fire attack).
  {
    id: 'wall_torch', name: 'Wall torch', builtin: 'wall_torch', w: 12 / T, h: 28 / T, block: [], castShadow: false, wall: true, burns: 6,
    flame: { x: 0.09, y: 1.36, w: 0.45, h: 0.65, embers: true },
    light: { x: 0.09, y: 1.6, color: '#ffb35c', intensity: 2.2, radius: 7, schedule: 'nightBoost', flicker: 'fire' },
  },
  {
    id: 'wall_lantern', name: 'Wall lantern', builtin: 'wall_lantern', w: 12 / T, h: 28 / T, block: [], castShadow: false, wall: true, burns: 12,
    flame: { x: 0.16, y: 0.72, w: 0.16, h: 0.28 },
    light: { x: 0.16, y: 0.9, color: '#ffcf7a', intensity: 1.8, radius: 6.5, schedule: 'nightBoost', flicker: 'candle' },
  },
  {
    id: 'wall_brazier', name: 'Wall brazier', builtin: 'wall_brazier', w: 18 / T, h: 26 / T, block: [], castShadow: false, wall: true, burns: 8,
    flame: { x: 0.03, y: 1.12, w: 0.8, h: 1.0, embers: true },
    light: { x: 0.03, y: 1.5, color: '#ff9a45', intensity: 2.8, radius: 8.5, schedule: 'nightBoost', flicker: 'fire' },
  },
  { id: 'vines', name: 'Vines (cuttable)', builtin: 'vines', w: 16 / T, h: 22 / T, block: [0], sway: 0.6, cuttable: true, castShadow: false },
  { id: 'sapling', name: 'Sapling (cuttable)', builtin: 'sapling', w: 14 / T, h: 26 / T, block: [0], sway: 1.1, cuttable: true, stump: 'stump', drops: [{ item: 'firewood', count: 2 }] },
  { id: 'stump', name: 'Tree stump', builtin: 'stump', w: 14 / T, h: 8 / T, block: [], castShadow: false },
  { id: 'chest', name: 'Chest', builtin: 'chest', w: 16 / T, h: 14 / T, block: [0] },
  { id: 'crate', name: 'Crate (breakable)', builtin: 'crate', w: 16 / T, h: 16 / T, block: [0] },
  { id: 'boulder_cracked', name: 'Cracked boulder (breakable)', builtin: 'boulder_cracked', w: 22 / T, h: 18 / T, block: [0] },
  // Mining: break with a pickaxe or hammer for stone and ore (they're back the next time the player comes).
  { id: 'boulder', name: 'Large boulder (mineable)', builtin: 'boulder', w: 32 / T, h: 26 / T, block: [0], foot: { w: 2, d: 1, solid: ['##'] }, mineable: true, hits: 4, regrows: true, stump: 'rubble',
    drops: [{ item: 'stone', count: 3 }] },
  { id: 'ore_iron', name: 'Iron vein (mineable)', builtin: 'ore_iron', w: 28 / T, h: 23 / T, block: [0], mineable: true, hits: 4, regrows: true, stump: 'rubble',
    drops: [{ item: 'iron_ore', count: 2 }, { item: 'stone', count: 1 }, { item: 'iron_ore', count: 1, chance: 40 }] },
  { id: 'ore_gold', name: 'Gold vein (mineable)', builtin: 'ore_gold', w: 28 / T, h: 23 / T, block: [0], mineable: true, hits: 5, regrows: true, stump: 'rubble',
    drops: [{ item: 'gold_ore', count: 1 }, { item: 'stone', count: 1 }, { item: 'gold_ore', count: 1, chance: 35 }] },
  { id: 'anvil', name: 'Anvil (forge)', builtin: 'anvil', w: 24 / T, h: 18 / T, block: [0], forge: true },
  { id: 'crystal', name: 'Crystal switch', builtin: 'crystal', w: 14 / T, h: 24 / T, block: [0] },
  { id: 'rubble', name: 'Rubble', builtin: 'rubble', w: 20 / T, h: 8 / T, block: [], castShadow: false },
  { id: 'chest_open', name: 'Chest (open)', builtin: 'chest_open', w: 16 / T, h: 14 / T, block: [0] },
  // Openings for cliff faces and walls: they sit flat against the wall behind them. Put an event on one (touch
  // trigger) to walk through it.
  { id: 'cave_mouth', name: 'Cave mouth (on wall)', builtin: 'cave_mouth', w: 32 / T, h: 26 / T, block: [], castShadow: false, wall: true },
  { id: 'square_hole', name: 'Square opening (on wall)', builtin: 'square_hole', w: 16 / T, h: 20 / T, block: [], castShadow: false, wall: true },
  { id: 'wall_door', name: 'Door (on wall)', builtin: 'wall_door', w: 18 / T, h: 26 / T, block: [], castShadow: false, wall: true },
  { id: 'sparkle', name: 'Item sparkle', builtin: 'sparkle', w: 10 / T, h: 10 / T, block: [], castShadow: false },
  // Woodland and camping.
  { id: 'fence', name: 'Wooden fence', builtin: 'fence', w: 16 / T, h: 14 / T, block: [0] },
  { id: 'fence_post', name: 'Fence post', builtin: 'fence_post', w: 6 / T, h: 15 / T, block: [0] },
  { id: 'fence_gate', name: 'Fence gate', builtin: 'fence_gate', w: 16 / T, h: 15 / T, block: [0] },
  { id: 'tent_red', name: 'Tent (red)', builtin: 'tent_red', w: 30 / T, h: 22 / T, block: [0], foot: { w: 2, d: 1, solid: ['##'] } },
  { id: 'tent_blue', name: 'Tent (blue)', builtin: 'tent_blue', w: 30 / T, h: 22 / T, block: [0], foot: { w: 2, d: 1, solid: ['##'] } },
  { id: 'tent_green', name: 'Tent (green)', builtin: 'tent_green', w: 30 / T, h: 22 / T, block: [0], foot: { w: 2, d: 1, solid: ['##'] } },
  { id: 'tent_tan', name: 'Tent (tan)', builtin: 'tent_tan', w: 30 / T, h: 22 / T, block: [0], foot: { w: 2, d: 1, solid: ['##'] } },
  { id: 'tent_purple', name: 'Tent (purple)', builtin: 'tent_purple', w: 30 / T, h: 22 / T, block: [0], foot: { w: 2, d: 1, solid: ['##'] } },
  { id: 'bedroll', name: 'Bedroll', builtin: 'bedroll', w: 22 / T, h: 9 / T, block: [], castShadow: false },
  { id: 'log_seat', name: 'Log seat', builtin: 'log_seat', w: 24 / T, h: 10 / T, block: [0] },
  { id: 'firewood', name: 'Firewood stack', builtin: 'firewood', w: 18 / T, h: 13 / T, block: [0] },
  {
    id: 'lantern_post', name: 'Lantern post', builtin: 'lantern_post', w: 12 / T, h: 30 / T, block: [0],
    light: { x: 0.12, y: 1.15, color: '#ffcf7a', intensity: 1.8, radius: 6.5, schedule: 'night', flicker: 'candle' },
  },
  { id: 'cooking_pot', name: 'Cooking pot', builtin: 'cooking_pot', w: 18 / T, h: 18 / T, block: [0] },
  // Kept so old maps that placed bare logs still load.
  { id: 'logs', name: 'Fire logs', builtin: 'logs', w: 22 / T, h: 11 / T, block: [0], castShadow: false },
];

const BUILTIN_IDS = new Set(BUILTIN_PROPS.map((p) => p.id));
/** Built-ins hidden from the palette (superseded, kept for old maps). */
export const HIDDEN_BUILTINS = new Set(['logs']);

export const isBuiltinProp = (id: string): boolean => BUILTIN_IDS.has(id);
/** The original definition of a built-in prop (before any customisation). */
export const builtinProp = (id: string): PropDef | undefined => BUILTIN_PROPS.find((p) => p.id === id);

export const EMPTY_ASSETS: AssetRegistry = { props: [], tiles: [] };

export class PropCatalog {
  private readonly byId = new Map<string, PropDef>();

  constructor(assets: AssetRegistry = EMPTY_ASSETS) {
    for (const d of BUILTIN_PROPS) this.byId.set(d.id, d);
    for (const d of assets.props ?? []) {
      // A saved prop with a built-in's id is a customised version of that built-in: it replaces it,
      // keeping the built-in's flame (which can't be edited).
      const builtin = this.byId.get(d.id);
      this.byId.set(d.id, builtin?.flame && !d.flame ? { ...d, flame: builtin.flame } : d);
    }
  }

  get(id: string): PropDef | undefined {
    return this.byId.get(id);
  }

  all(): PropDef[] {
    return [...this.byId.values()];
  }
}

/**
 * The tiles a prop blocks, given its anchor position. Offsets are in tiles along x from the anchor;
 * the blocked row is the one the anchor stands in.
 */
export function blockedTiles(def: PropDef, x: number, z: number, scale = 1): [number, number][] {
  // Flat collision blocks no whole tiles, only a strip along the picture (propBoxes).
  if (def.foot && def.collide === 'flat') return [];
  if (def.foot) return footTiles(def, x, z, scale, true);
  return def.block.map((dx) => [Math.floor(x + dx * scale), Math.floor(z)] as [number, number]);
}

/** A thin blocker along the picture of a prop with flat collision: one per run of solid front-row tiles. */
export interface PropBox { x0: number; z0: number; x1: number; z1: number }
export function propBoxes(def: PropDef, x: number, z: number, scale = 1): PropBox[] {
  const f = def.foot;
  if (!f || def.collide !== 'flat') return [];
  const row = f.solid[f.d - 1] ?? '', x0 = x - (f.w * scale) / 2, out: PropBox[] = [];
  let c = 0;
  while (c < f.w) {
    if (row[c] !== '#') { c++; continue; }
    const c0 = c; while (c < f.w && row[c] === '#') c++;
    out.push({ x0: x0 + c0 * scale, x1: x0 + c * scale, z0: z - 0.3 * scale, z1: z + 0.06 });
  }
  return out;
}

/** The tiles a prop's footprint covers (`solidOnly`: just the solid ones). Props without one: the tile it stands in. */
export function footTiles(def: PropDef, x: number, z: number, scale = 1, solidOnly = false): [number, number][] {
  const f = def.foot;
  if (!f) return solidOnly ? blockedTiles(def, x, z, scale) : [[Math.floor(x), Math.floor(z)]];
  const x0 = x - (f.w * scale) / 2, z0 = z - f.d * scale, out: [number, number][] = [];
  for (let r = 0; r < f.d; r++) for (let c = 0; c < f.w; c++) {
    if (solidOnly && f.solid[r]?.[c] !== '#') continue;
    out.push([Math.floor(x0 + (c + 0.5) * scale), Math.floor(z0 + (r + 0.5) * scale)]);
  }
  return out;
}

/** Is tile (x, z) part of this placed prop (its footprint, or for older props its tile and blocked tiles)? */
export function propCovers(def: PropDef, p: PropData, x: number, z: number): boolean {
  if (def.foot) return footTiles(def, p.x, p.z, p.s ?? 1).some(([a, b]) => a === x && b === z);
  return (Math.floor(p.x) === x && Math.floor(p.z) === z) || blockedTiles(def, p.x, p.z, p.s ?? 1).some(([a, b]) => a === x && b === z);
}

/**
 * Props that gained a footprint stand on their front edge, not the middle of a tile: ones placed before (in the
 * middle, at .5) move down to the edge of that tile, so they still cover the tile they were in. True if any moved.
 */
export function alignFootProps(map: MapData, def: (type: string) => PropDef | undefined): boolean {
  let moved = false;
  for (const p of map.props) {
    if (!def(p.type)?.foot) continue;
    if (Math.abs((p.z % 1) - 0.5) < 1e-6) { p.z += 0.5; moved = true; }
  }
  return moved;
}

/** Make a prop id from a name: lowercase letters, digits and underscores, unique among `taken`. */
export function propIdFromName(name: string, taken: (id: string) => boolean): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'prop';
  let id = base, n = 2;
  while (taken(id)) id = `${base}_${n++}`;
  return id;
}

/** Bring maps saved by older versions up to date (in place). Returns true when anything changed. */
export function migrateMap(map: MapData): boolean {
  let changed = migratePlateaus(map);
  if (migrateWaterTiles(map)) changed = true;
  const kept: LightData[] = [];
  for (const l of (map.lights ?? []) as (LightData | LegacyLightData)[]) {
    if ('kind' in l) {
      // Campfires and torches used to be lights with built-in visuals; now they're props that carry a light.
      map.props.push({ type: l.kind, x: l.x + 0.5, z: l.z + 0.5 });
      changed = true;
    } else if ('type' in l) kept.push(l);
    else changed = true;
  }
  map.lights = kept;
  return changed;
}
