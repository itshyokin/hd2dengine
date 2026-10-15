/**
 * Wall props and events (a cave mouth, a dark doorway, a door): instead of standing in the middle of their tile, they
 * sit flat against the nearest cliff face, at its foot. That's the face behind them (the tile to the north is higher)
 * or, when placed on the higher tile itself, its own front face. With no wall there, they go to the back of the tile.
 */
import type { TileMap } from './TileMap';

/** A hair in front of the wall, so it never flickers into it. */
const OFF = 0.015;

/**
 * Where a placed prop stands: its base height and depth (wall props on the wall, others on their tile). Props with a
 * footprint stand on its front edge, on the ground of its front row.
 */
export function propBase(map: TileMap, p: { x: number; z: number; y?: number }, def: { wall?: boolean; foot?: unknown } | undefined): { y: number; z: number } {
  const gz = def?.foot ? p.z - 0.05 : p.z;
  if (!def?.wall) return { y: p.y ?? map.surfaceY(p.x, gz), z: p.z };
  const a = wallAnchor(map, p.x, gz);
  return { y: p.y ?? a.y, z: a.z };
}

export function wallAnchor(map: TileMap, x: number, z: number): { y: number; z: number } {
  const cx = Math.floor(x), cz = Math.floor(z);
  const here = map.step(cx, cz);
  if (map.inMap(cx, cz - 1) && map.step(cx, cz - 1) > here) return { y: map.surfaceY(x, cz + 0.01), z: cz + OFF };
  if (map.inMap(cx, cz + 1) && map.step(cx, cz + 1) < here) return { y: map.surfaceY(x, cz + 1.01), z: cz + 1 + OFF };
  return { y: map.surfaceY(x, cz + 0.01), z: cz + OFF };
}
