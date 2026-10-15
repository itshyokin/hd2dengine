import { clamp } from '../core/math';
import { STEP, cornerHeights, parseHeights, parseWater, rampDirection, resolveWater, surfaceInCell } from './heights';
import { type PassageFlag, parsePassage } from './passage';
import { TileCatalog } from './tiles';
import type { Dir, MapData, RampData } from './types';

type Corners = [number, number, number, number];
export type Water = NonNullable<ReturnType<typeof resolveWater>>;

/** Grid queries over a map: tiles, heights, ramps, and which cells block movement. */
export class TileMap {
  readonly w: number;
  readonly h: number;
  private readonly rows: string[];
  private readonly blocked: Uint8Array;
  /** Height in steps per cell. */
  private readonly heights: Int8Array;
  /** Ramp per cell (index → ramp and its resolved direction). */
  private readonly ramps = new Map<number, { ramp: RampData; dir: Dir | null }>();
  private readonly corners: Corners[];
  /** Water per cell after resolving Auto against the ground (null where dry). */
  private readonly water: (Water | null)[];
  /** Passage flags per cell (climbable, low clearance, wall, open). */
  private readonly passage: PassageFlag[];

  /** Frozen water per cell (winter): the ice's top, or null. Ice is walked on (and slid on), not swum in. */
  private readonly ice: (number | null)[];

  /** `frozen(style)`: water of this style is frozen over (still water in winter). */
  constructor(data: MapData, readonly tiles: TileCatalog = new TileCatalog(), frozen?: (style: number) => boolean) {
    this.w = data.width;
    this.h = data.height;
    this.rows = [];
    for (let z = 0; z < this.h; z++) {
      this.rows.push((data.terrain[z] ?? '').padEnd(this.w, '.').slice(0, this.w));
    }
    this.heights = parseHeights(data.heights, this.w, this.h);
    const stepAt = (x: number, z: number) => (this.inMap(x, z) ? this.heights[z * this.w + x] : null);
    for (const r of data.ramps ?? []) {
      if (!this.inMap(r.x, r.z)) continue;
      this.ramps.set(r.z * this.w + r.x, { ramp: r, dir: rampDirection(r, stepAt) });
    }
    this.corners = [];
    for (let z = 0; z < this.h; z++)
      for (let x = 0; x < this.w; x++) {
        const i = z * this.w + x;
        this.corners.push(cornerHeights(this.heights[i], this.ramps.get(i)?.dir ?? null));
      }
    const rawWater = parseWater(data.water, this.w, this.h);
    this.water = rawWater.map((c, i) => resolveWater(c, this.heights[i] * STEP));
    this.ice = this.water.map((w) => (w && frozen?.(w.style) ? w.surface : null));
    this.ice.forEach((v, i) => { if (v !== null) this.water[i] = null; });
    this.passage = parsePassage(data.passage, this.w, this.h);
    this.blocked = new Uint8Array(this.w * this.h);
    for (let z = 0; z < this.h; z++)
      for (let x = 0; x < this.w; x++) if (tiles.blocks(this.terrain(x, z))) this.blocked[z * this.w + x] = 1;
  }

  /** Tile key at a tile; coordinates outside the map are clamped to the edge. */
  terrain(x: number, z: number): string {
    return this.rows[clamp(z, 0, this.h - 1)][clamp(x, 0, this.w - 1)];
  }
  inMap(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.w && z < this.h;
  }
  /** Height of a cell in steps (0 outside the map). */
  step(x: number, z: number): number {
    return this.inMap(x, z) ? this.heights[z * this.w + x] : 0;
  }
  /** World height of a cell's base (its low side, for ramps). */
  heightAt(x: number, z: number): number {
    return this.step(x, z) * STEP;
  }
  /** Corner heights of a cell (NW, NE, SE, SW). Outside the map: flat at 0. */
  cornersAt(x: number, z: number): Corners {
    return this.inMap(x, z) ? this.corners[z * this.w + x] : [0, 0, 0, 0];
  }
  rampAt(x: number, z: number): { ramp: RampData; dir: Dir | null } | undefined {
    return this.inMap(x, z) ? this.ramps.get(z * this.w + x) : undefined;
  }
  /** Ground height at any point (in tiles), following ramps smoothly. */
  surfaceY(x: number, z: number): number {
    const cx = Math.floor(x), cz = Math.floor(z);
    return surfaceInCell(this.cornersAt(cx, cz), x - cx, z - cz);
  }
  /** Water at a cell (surface height, depth, and shallow / swim / deep), or null where it's dry. */
  waterAt(x: number, z: number): Water | null {
    return this.inMap(x, z) ? this.water[z * this.w + x] : null;
  }
  /**
   * The height the player moves at: the ground, or the water surface where there's water to wade or swim in.
   * Using the surface lets the player walk from a bank straight into a pond dug lower than it.
   */
  standY(x: number, z: number): number {
    const g = this.surfaceY(x, z), wtr = this.waterAt(Math.floor(x), Math.floor(z)), ice = this.iceAt(Math.floor(x), Math.floor(z));
    if (ice !== null) return Math.max(g, ice);
    return wtr && wtr.kind !== 'deep' ? Math.max(g, wtr.surface) : g;
  }
  /** The top of the ice on a frozen cell, or null. */
  iceAt(x: number, z: number): number | null {
    return this.inMap(x, z) ? this.ice[z * this.w + x] : null;
  }
  /** Passage flag of a cell ("." outside the map). */
  passageAt(x: number, z: number): PassageFlag {
    return this.inMap(x, z) ? this.passage[z * this.w + x] : '.';
  }
  /**
   * Solid: a wall the player can't pass even in the air (blocking tiles and props, passage Wall).
   * The passage layer's Open overrides tiles and props.
   */
  isSolid(x: number, z: number): boolean {
    if (!this.inMap(x, z)) return true;
    const i = z * this.w + x, f = this.passage[i];
    return f === 'x' ? true : f === 'o' ? false : this.blocked[i] === 1;
  }
  /** Can't be walked into: solid, or deep water. */
  isBlocked(x: number, z: number): boolean {
    return this.isSolid(x, z) || this.water[z * this.w + x]?.kind === 'deep';
  }
  /** Only passable while crawling. */
  isLow(x: number, z: number): boolean {
    return this.passageAt(x, z) === 'l';
  }
  isClimbable(x: number, z: number): boolean {
    return this.passageAt(x, z) === 'c';
  }
  /** Thin blockers that don't fill whole tiles (props with flat collision), each tagged with what made it. */
  private readonly boxes: { x0: number; z0: number; x1: number; z1: number; tag: unknown }[] = [];
  addBox(b: { x0: number; z0: number; x1: number; z1: number }, tag: unknown): void { this.boxes.push({ ...b, tag }); }
  removeBoxes(tag: unknown): void { for (let i = this.boxes.length - 1; i >= 0; i--) if (this.boxes[i].tag === tag) this.boxes.splice(i, 1); }
  /** Is this point inside a thin blocker? */
  inBox(x: number, z: number): boolean {
    for (const b of this.boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
    return false;
  }

  setBlocked(x: number, z: number, on: boolean): void {
    if (this.inMap(x, z)) this.blocked[z * this.w + x] = on ? 1 : 0;
  }
  /** True when any tile within `r` of (x, z) has terrain `t`. */
  near(x: number, z: number, t: string, r: number): boolean {
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) if (this.inMap(x + dx, z + dz) && this.terrain(x + dx, z + dz) === t) return true;
    return false;
  }
}
