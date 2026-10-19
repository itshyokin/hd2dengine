/**
 * Turns map data into scene geometry: the ground with its heights, cliff walls and stairs,
 * imported tiles, animated water, and instanced prop sprites.
 */
import { buildDecks, placeDecks } from './decks';
import * as THREE from 'three';
import { propBase } from './wallAnchor';
import { builtinTileArt, glowPattern, iceTile, groundCanvas, grassTile, rippleNormals, rockFace } from '../art/placeholderArt';
import { type BorderGround, type EdgeRoad, type EdgeWater, type Side, borderGround, borderSides, cliffHeight, edgeRoads, edgeWaters, onEdgeRoad, sideOf } from './border';
import { patchRoadEdge } from '../render/roadEdge';
import type { V3 } from './terrainGeometry';
import { normalMapFrom } from '../core/pixel';
import { rng } from '../core/math';
import { patchAreaTint, setBuildOrigin } from '../render/areaTint';
import { patchWaterEdge, waterMask } from '../render/waterEdge';
import { blendMask, patchTileBlend } from '../render/tileBlend';
import { SpriteLibrary, withSpriteShadows } from '../render/sprites';
import { blockedTiles, propBoxes } from './props';
import { type BuiltBuilding, buildBuildings } from './buildings';
import type { TileTexture } from '../render/tileTextures';
import { linearColor, makeTexture, registerNormalMap } from '../render/textures';
import type { TileMap } from './TileMap';
import { QuadList, buildTerrainGeometry, cornerRounding, cornerSliver } from './terrainGeometry';
import { BRICKS } from './tiles';
import type { BorderKind, MapData, PropData } from './types';
import { waterStyles } from './waterStyles';
import { patchSeason } from '../render/season';
import { propSeason } from './seasons';

export interface BuiltWorld {
  /** Scroll this texture's offset each frame to animate the water around the map. */
  waterNormals: THREE.Texture;
  /** Each water style's ripples, scrolled by its current. */
  waterFlows: WaterFlow[];
  /** Ground meshes, for picking the tile under the pointer. */
  ground: THREE.Object3D[];
  /** Where each placed prop is drawn (its instanced mesh and index), so one can be removed (cut down). */
  props: Map<PropData, { mesh: THREE.InstancedMesh; index: number }>;
  /** Each building's materials, to fade it while it hides the player. */
  buildings: BuiltBuilding[];
  /** Waterfalls (where water drops more than two steps to water below): the foot of each, for spray and sound. */
  waterfalls: { x: number; z: number; y: number; top: number }[];
}

/** Falling water: soft streaks running down, foamy white at the edges. */
function fallsTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d')!, img = g.createImageData(64, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
    const streak = 0.5 + 0.5 * Math.sin(x * 0.9 + Math.sin(y * 0.05 + x) * 2) * Math.sin(x * 0.37 + 1.3);
    const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const v = Math.min(1, 0.45 + streak * 0.45 + Math.abs(n) * 0.15);
    const i = (y * 64 + x) * 4;
    img.data[i] = 170 + v * 85; img.data[i + 1] = 210 + v * 45; img.data[i + 2] = 240 + v * 15;
    img.data[i + 3] = 120 + v * 120;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * Waterfalls: wherever a water cell's surface is more than two steps above the water next to it, a sheet of falling
 * water runs down the wall between them (scrolling, see the returned flow), with its foot listed for spray and sound.
 */
function buildWaterfalls(scene: THREE.Object3D, map: TileMap): { flow: WaterFlow | null; spots: BuiltWorld['waterfalls'] } {
  const q = new QuadList(), spots: BuiltWorld['waterfalls'] = [];
  const DROP = 1.0 + 1e-3;
  for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) {
    const up = map.waterAt(x, z);
    if (!up) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, lo = map.waterAt(nx, nz);
      if (!lo || up.surface - lo.surface <= DROP) continue;
      // The sheet stands on the shared edge, a hair out over the lower water.
      const ex = dx === 1 ? x + 1 : dx === -1 ? x : null, ez = dz === 1 ? z + 1 : dz === -1 ? z : null;
      const o = 0.04;
      const a: [number, number] = ex !== null ? [ex + dx * o, z] : [x, ez! + dz * o];
      const b: [number, number] = ex !== null ? [ex + dx * o, z + 1] : [x + 1, ez! + dz * o];
      const top = up.surface, bot = lo.surface - 0.05;
      q.add([[a[0], top, a[1]], [b[0], top, b[1]], [b[0], bot, b[1]], [a[0], bot, a[1]]],
        [[0, top], [1, top], [1, bot], [0, bot]], [dx, 0, dz]);
      spots.push({ x: (a[0] + b[0]) / 2 + dx * 0.3, z: (a[1] + b[1]) / 2 + dz * 0.3, y: lo.surface, top });
    }
  }
  if (!q.quads) return { flow: null, spots };
  const tex = makeTexture(fallsTexture(), { repeat: true, linear: false });
  tex.repeat.set(1, 0.6);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, emissive: new THREE.Color('#9fc8e8'), emissiveIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  const m = mesh(q, mat);
  m.renderOrder = 3;
  scene.add(m);
  return { flow: { tex, flow: 3, flowDir: -90 }, spots };
}

/**
 * Build a map's world into `scene`. `origin`: where it sits when drawn beside another map (a seamless neighbour), so
 * its shader lookups stay in its own tile coordinates.
 */
export function buildWorld(scene: THREE.Object3D, map: TileMap, data: MapData, sprites: SpriteLibrary, tileTextures: Map<string, TileTexture> = new Map(), origin?: THREE.Vector2): BuiltWorld {
  setBuildOrigin(origin ?? null);
  try { return buildWorldAt(scene, map, data, sprites, tileTextures); } finally { setBuildOrigin(null); }
}

function buildWorldAt(scene: THREE.Object3D, map: TileMap, data: MapData, sprites: SpriteLibrary, tileTextures: Map<string, TileTexture>): BuiltWorld {
  const spans = new Map([...tileTextures].map(([k, t]) => [k, Math.max(0.25, t.def.span || 1)] as [string, number]));
  // Cliff walls look the way the tile on top of them says (or the map's default).
  const wallLook = (x: number, z: number) => {
    const look = map.tiles.cliffFor(map.terrain(x, z), data.cliffTile);
    const out = look === BRICKS || tileTextures.has(look) || !map.tiles.isCustom(look) ? look : BRICKS;
    // Cliff-style ground: bare rock unless the map or tile chose a look of its own.
    return out === BRICKS && map.heightStyle(x, z) === 'c' ? '▲' : out;
  };
  const geo = buildTerrainGeometry(map, spans, wallLook);

  // Ground: every cell's top surface, textured with one image painted from the terrain layer.
  const gc = groundCanvas(map);
  const groundMat = patchSeason(patchAreaTint(new THREE.MeshStandardMaterial({ map: makeTexture(gc, { mip: true }), roughness: 1, metalness: 0 })), 'ground');
  registerNormalMap(groundMat, makeTexture(normalMapFrom(gc, { strength: 2 }), { linear: true, mip: true }));
  groundMat.normalScale.set(0.7, 0.7);
  const ground = mesh(geo.ground, groundMat);
  ground.castShadow = true;
  scene.add(ground);

  // Imported tiles: their own repeating textures, just above the painted ground, with blended edges.
  const tileMat = (key: string, blended: boolean) => {
    const t = tileTextures.get(key)!, b = map.tiles.blendFor(key);
    const mat = patchSeason(patchAreaTint(new THREE.MeshStandardMaterial({ map: t.map, roughness: 1, metalness: 0 })), 'ground');
    registerNormalMap(mat, t.normal);
    mat.normalScale.set(0.8, 0.8);
    if (blended && b.blend) {
      const img = t.map.image as { width?: number } | undefined;
      patchTileBlend(mat, blendMask(map, key), b, (img?.width ?? 16) / Math.max(0.25, t.def.span || 1));
    }
    return mat;
  };
  for (const [key, quads] of geo.overlays) {
    const m = mesh(quads, tileMat(key, true));
    m.renderOrder = 0;
    scene.add(m);
  }
  for (const [key, quads] of geo.slivers) scene.add(mesh(quads, tileMat(key, false)));

  // Cliff walls and stair risers, one mesh per look.
  for (const [look, quads] of geo.walls) {
    if (!quads.quads) continue;
    let wallMat: THREE.MeshStandardMaterial;
    if (look === BRICKS || !tileTextures.has(look)) {
      // Built-in looks: the stone bricks, or a built-in tile's art (grass, path, sand, water) on its side.
      const art = look === BRICKS ? rockFace() : builtinTileArt(look);
      wallMat = patchSeason(patchAreaTint(new THREE.MeshStandardMaterial({ map: makeTexture(art, { repeat: true, mip: true }), roughness: 0.95 })), 'ground');
      registerNormalMap(wallMat, makeTexture(normalMapFrom(art, { strength: look === BRICKS ? 4 : 2.5, wrap: true }), { linear: true, repeat: true, mip: true }));
    } else {
      // An imported tile on its side: same texture, repeating every `span` tiles up the wall too.
      const t = tileTextures.get(look)!, span = Math.max(0.25, t.def.span || 1);
      const map2 = t.map.clone(), nm = t.normal.clone();
      for (const tx of [map2, nm]) { tx.repeat.set(1 / span, 1 / span); tx.needsUpdate = true; }
      wallMat = patchAreaTint(new THREE.MeshStandardMaterial({ map: map2, roughness: 0.95 }));
      registerNormalMap(wallMat, nm);
    }
    const walls = mesh(quads, wallMat);
    walls.castShadow = true;
    scene.add(walls);
  }

  // Water reaching the map edge carries on out, like roads (a stream running off into the woods).
  const edgeWater = edgeWaters(map.w, map.h, (x, z) => map.waterAt(x, z), (x, z) => Math.min(...map.cornersAt(x, z)), borderSides(data.border));
  const { ripple: waterNormals, flows: waterFlows } = buildWater(scene, map, data, edgeWater);
  buildBorder(scene, map, data, waterNormals, tileTextures, edgeWater);
  const buildings = buildBuildings(scene, map, data.buildings ?? [], tileTextures);
  const props = buildProps(scene, map, data, sprites);
  const falls = buildWaterfalls(scene, map);
  if (falls.flow) waterFlows.push(falls.flow);
  return { waterNormals, waterFlows, ground: [ground], props, buildings, waterfalls: falls.spots };
}

function mesh(q: QuadList, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(q.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2));
  g.setIndex(q.idx);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/** A water style's animated surface: its own copy of the ripples, scrolled by its current (Game moves them). */
export interface WaterFlow { tex: THREE.Texture; flow: number; flowDir: number }

/**
 * Water surfaces at their levels: one mesh per kind and style, so shallow, swimmable and deep water look different,
 * and each of the map's water styles (a pond, a river, lava) has its own colour, clarity, surface and current.
 */
function buildWater(scene: THREE.Object3D, map: TileMap, data: MapData, edgeWater: EdgeWater[]): { ripple: THREE.Texture; flows: WaterFlow[] } {
  const ripple = makeTexture(rippleNormals(), { linear: true, repeat: true });
  ripple.magFilter = THREE.LinearFilter;
  ripple.minFilter = THREE.LinearFilter;
  // How deep water darkens and thickens the style's colour, by kind.
  const LOOK = {
    shallow: { shade: 1.35, opacity: 0.5 },
    swim: { shade: 1, opacity: 0.74 },
    deep: { shade: 0.55, opacity: 0.9 },
  } as const;
  const styles = waterStyles(data);
  // Per kind and style: "full" pieces are always drawn (water cells, and the water under a bank's rounded corner);
  // "edge" pieces lap over a bank at the water's level and are cut to a rounded shoreline in the shader.
  const groups = new Map<string, { kind: 'shallow' | 'swim' | 'deep'; style: number; full: QuadList; edge: QuadList }>();
  const group = (kind: 'shallow' | 'swim' | 'deep', style: number) => {
    const st = styles[style] ? style : 0, k = `${kind}:${st}`;
    let g = groups.get(k);
    if (!g) { g = { kind, style: st, full: new QuadList(), edge: new QuadList() }; groups.set(k, g); }
    return g;
  };
  const uv = (p: number[][]) => p.map(([x, , z]) => [x * 0.45, z * 0.45] as [number, number]);
  const square = (list: QuadList, x: number, z: number, y: number) =>
    list.add([[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]], uv([[x, 0, z], [x + 1, 0, z], [x + 1, 0, z + 1], [x, 0, z + 1]]), [0, 1, 0]);
  for (let z = 0; z < map.h; z++)
    for (let x = 0; x < map.w; x++) {
      const wtr = map.waterAt(x, z);
      if (wtr) { square(group(wtr.kind, wtr.style).full, x, z, wtr.surface + 0.01); continue; }
      // A bank corner cut round: water fills the gap under it.
      const round = cornerRounding(map, x, z);
      for (let k = 0; k < 4; k++) {
        if (!round.convex[k]) continue;
        const [dx, dz] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][k], nb = map.waterAt(x + dx, z + dz)!;
        for (const t of cornerSliver(x, z, k, nb.surface + 0.01)) group(nb.kind, nb.style).full.add(t, uv(t), [0, 1, 0]);
      }
      // A dry cell next to water, no higher than its surface: the water laps over its edge.
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nb = map.waterAt(x + dx, z + dz);
        if (!nb || Math.max(...map.cornersAt(x, z)) > nb.surface + 0.02) continue;
        square(group(nb.kind, nb.style).edge, x, z, nb.surface + 0.01);
        break;
      }
    }
  // Past the map edge: each run of edge water continues straight out (its own style, never cut by the shoreline).
  const E = 70;
  for (const r of edgeWater) {
    const g = group(r.kind, r.style), y = r.surface + 0.01, a = r.from, b = r.to + 1;
    for (let i = 0; i < E; i++) {
      if (r.side === 'n') for (let x = a; x < b; x++) square(g.full, x, -1 - i, y);
      else if (r.side === 's') for (let x = a; x < b; x++) square(g.full, x, map.h + i, y);
      else if (r.side === 'w') for (let z = a; z < b; z++) square(g.full, -1 - i, z, y);
      else for (let z = a; z < b; z++) square(g.full, map.w + i, z, y);
    }
  }
  // Winter: still water frozen over: a pale, glossy sheet at the surface (walked and slid on).
  const ice = new QuadList();
  for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) { const top = map.iceAt(x, z); if (top !== null) square(ice, x, z, top + 0.012); }
  if (ice.quads) {
    const im = new THREE.MeshStandardMaterial({ map: makeTexture(iceTile(), { repeat: true, mip: true }), roughness: 0.22, metalness: 0, normalMap: ripple, normalScale: new THREE.Vector2(0.05, 0.05) });
    softenSpecular(im);
    const m = mesh(ice, patchAreaTint(im));
    m.renderOrder = 1;
    scene.add(m);
  }
  const mask = waterMask(map);
  // Each style scrolls its own copy of the ripples (by its current); copies share the picture.
  const texOf = new Map<number, THREE.Texture>(), flows: WaterFlow[] = [];
  const tex = (style: number) => {
    let t = texOf.get(style);
    if (!t) {
      t = ripple.clone() as THREE.Texture;
      t.needsUpdate = true;
      texOf.set(style, t);
      flows.push({ tex: t, flow: styles[style].flow ?? 0, flowDir: styles[style].flowDir ?? 0 });
    }
    return t;
  };
  for (const g of groups.values()) {
    const a = g.full, b = g.edge, st = styles[g.style];
    if (!a.quads && !b.quads) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.pos, ...b.pos], 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([...a.nor, ...b.nor], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([...a.uv, ...b.uv], 2));
    geo.setAttribute('hdWaterForce', new THREE.Float32BufferAttribute([...new Array(a.pos.length / 3).fill(1), ...new Array(b.pos.length / 3).fill(0)], 1));
    const offset = a.pos.length / 3;
    geo.setIndex([...a.idx, ...b.idx.map((i) => i + offset)]);
    // Clearer (more see-through, a touch lighter) or murkier (thicker); deeper water darker.
    const murk = Math.max(0, Math.min(1, st.murk ?? 0.5)), look = LOOK[g.kind], base = look.opacity;
    const glow = Math.max(0, Math.min(1, st.glow ?? 0));
    const opacity = Math.min(1, (murk < 0.5 ? base * (0.4 + 1.2 * murk) : base + (0.97 - base) * (murk - 0.5) * 2) + glow * 0.4);
    const color = new THREE.Color(st.color || '#3f86b0');
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    color.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * look.shade)));
    if (murk < 0.5) color.lerp(new THREE.Color('#d6f0f6'), (0.5 - murk) * 0.35);
    // A soft, mostly matte surface: small glints, no glare.
    const bump = 0.32 * Math.max(0, Math.min(2.5, st.bumpy ?? 1));
    const mat = new THREE.MeshStandardMaterial({
      color: linearColor('#' + color.getHexString()), roughness: 0.5 + 0.1 * Math.min(1, bump), metalness: 0, transparent: opacity < 0.995, opacity,
      normalMap: tex(g.style), normalScale: new THREE.Vector2(bump, bump), depthWrite: false,
    });
    if (glow > 0) {
      // Lava and goo: a darker crust, glowing brightest along shifting seams (carried by the current too).
      mat.color.multiplyScalar(1 - glow * 0.7);
      const gm = makeTexture(glowPattern(), { repeat: true });
      gm.magFilter = THREE.LinearFilter;
      flows.push({ tex: gm, flow: (st.flow ?? 0) * 0.6, flowDir: st.flowDir ?? 0 });
      mat.emissiveMap = gm;
      mat.emissive = linearColor(st.color);
      mat.emissiveIntensity = 0.4 + glow * 1.1;
    }
    softenSpecular(mat);
    const water = new THREE.Mesh(geo, patchWaterEdge(patchAreaTint(mat), mask));
    water.receiveShadow = true;
    water.renderOrder = 1;
    scene.add(water);
  }
  return { ripple, flows };
}

/** Water: its highlights kept small and soft (a wet sheen, not the glare of polished jelly). */
function softenSpecular(mat: THREE.MeshStandardMaterial): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>',
      '#include <lights_fragment_end>\n  reflectedLight.directSpecular = min(reflectedLight.directSpecular * 0.35, vec3(0.18));');
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|softSpec';
}

/**
 * The land around the map, per side: open ground (grass, forest, meadow), raised rocky cliffs, water,
 * or nothing at all (darkness, for caves and interiors). It's a frame, so pits inside the map stay open.
 */
/**
 * The ground height beyond the edge at a point along side `side` (tile index along the edge; past the corners it
 * keeps the corner's): the height of the map's edge tile there, so the scenery carries on at the level the map ends.
 */
function edgeHeight(map: TileMap, side: Side, i: number): number {
  const W = map.w, H = map.h, a = Math.floor(i);
  const [x, z] = side === 'n' ? [Math.max(0, Math.min(W - 1, a)), 0] : side === 's' ? [Math.max(0, Math.min(W - 1, a)), H - 1]
    : side === 'w' ? [0, Math.max(0, Math.min(H - 1, a))] : [W - 1, Math.max(0, Math.min(H - 1, a))];
  const c = map.cornersAt(x, z);
  // The edge's outer corners (a ramp at the edge: its height on the outside).
  const outer = side === 'n' ? [c[0], c[1]] : side === 's' ? [c[3], c[2]] : side === 'w' ? [c[0], c[3]] : [c[1], c[2]];
  return Math.min(outer[0], outer[1]);
}

/** The height beyond the edge at an outside cell (x, z): its side's edge tile. */
export function borderHeightAt(map: TileMap, x: number, z: number): number {
  const side = sideOf(x, z, map.w, map.h);
  return edgeHeight(map, side, side === 'n' || side === 's' ? x : z);
}

function buildBorder(scene: THREE.Object3D, map: TileMap, data: MapData, ripple: THREE.Texture, tileTextures: Map<string, TileTexture>, edgeWater: EdgeWater[]): void {
  const sides = borderSides(data.border), E = 70, W = map.w, H = map.h;
  // The four strips: top and bottom run the full width (corners included), left and right fill between.
  const strips: [Side, number, number, number, number][] = [['n', -E, -E, W + E, 0], ['s', -E, H, W + E, H + E], ['w', -E, 0, 0, H], ['e', W, 0, W + E, H]];
  const grounds: Record<BorderGround, QuadList> = { grass: new QuadList(), sand: new QuadList(), snow: new QuadList(), rock: new QuadList() };
  const rockTop = new QuadList(), rockWall = new QuadList(), water = new QuadList(), bed = new QuadList();
  const roads = edgeRoads(W, H, (x, z) => map.terrain(x, z), (k) => map.tiles.isRoad(k), sides);
  // A vertical stone face between two points on the ground plan, from height `top` down to `bottom`, facing `facing`.
  const rect = (q: QuadList, x0: number, z0: number, x1: number, z1: number, y: number) =>
    q.add([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [[x0, -z0], [x1, -z0], [x1, -z1], [x0, -z1]], [0, 1, 0]);
  const wall = (a: [number, number], b: [number, number], top: number, bottom: number, facing: [number, number, number]) => {
    if (top - bottom < 0.005) return;
    rockWall.add([[a[0], top, a[1]], [b[0], top, b[1]], [b[0], bottom, b[1]], [a[0], bottom, a[1]]],
      [[a[0] + a[1], top], [b[0] + b[1], top], [b[0] + b[1], bottom], [a[0] + a[1], bottom]], facing);
  };
  for (const [side, x0, z0, x1, z1] of strips) {
    const kind = sides[side];
    // Seamless: the neighbouring map is drawn there instead (the game adds it).
    if (kind === 'none' || kind === 'seamless') continue;
    const ns = side === 'n' || side === 's';
    const hAt = (i: number) => edgeHeight(map, side, i);
    // Roads leaving on this side, as [start, end] along the edge.
    const gaps = roads.filter((r) => r.side === side).map((r) => [r.from, r.to + 1] as [number, number]).sort((p, q) => p[0] - q[0]);
    // Water leaving on this side: a channel cut into the ground (or through the cliffs).
    const streams = edgeWater.filter((r) => r.side === side);
    const cuts = [...gaps, ...streams.map((r) => [r.from, r.to + 1] as [number, number])].sort((p, q) => p[0] - q[0]);
    // Plan coordinates from (along the edge, out from the map): the far end of the strip is E tiles out.
    const out0 = side === 'n' ? 0 : side === 's' ? H : side === 'w' ? 0 : W;
    const outE = side === 'n' ? -E : side === 's' ? H + E : side === 'w' ? -E : W + E;
    const pt = (along: number, out: number): [number, number] => (ns ? [along, out] : [out, along]);
    const lo = ns ? x0 : z0, hi = ns ? x1 : z1;
    const oLo = Math.min(out0, outE), oHi = Math.max(out0, outE);
    const flat = (q: QuadList, p: number, r: number, y: number) => { if (ns) rect(q, p, oLo, r, oHi, y); else rect(q, oLo, p, oHi, r, y); };
    /** Split [p, r) along the edge into runs of one height: [from, to, height]. */
    const runs = (p: number, r: number): [number, number, number][] => {
      const out: [number, number, number][] = [];
      let a = p;
      while (a < r) {
        const hgt = hAt(a);
        let b = Math.min(r, Math.floor(a) + 1);
        while (b < r && hAt(b) === hgt) b = Math.min(r, b + 1);
        out.push([a, b, hgt]);
        a = b;
      }
      return out;
    };
    /** Faces where the ground steps up or down between runs (across the whole strip). */
    const steps = (list: [number, number, number][], lift = 0) => {
      for (let k = 1; k < list.length; k++) {
        const [, , h0] = list[k - 1], [b, , h1] = list[k];
        if (h0 === h1) continue;
        // Facing the lower side.
        const face: [number, number, number] = h0 > h1 ? (ns ? [1, 0, 0] : [0, 0, 1]) : (ns ? [-1, 0, 0] : [0, 0, -1]);
        wall(pt(b, out0), pt(b, outE), Math.max(h0, h1) + lift, Math.min(h0, h1) - 0.02, face);
      }
    };
    if (kind === 'water') {
      const list = runs(lo, hi);
      for (const [p, r, hgt] of list) { flat(water, p, r, hgt - 0.12); flat(bed, p, r, hgt - 0.9); }
      steps(list.map(([p, r, hgt]) => [p, r, hgt - 0.12]), 0);
      // Roads cross on a stone causeway: its sides drop into the water.
      for (const [a, b] of gaps) {
        const ha = hAt(a), hb = hAt(b - 1);
        wall(pt(a, out0), pt(a, outE), ha - 0.012, ha - 0.9, ns ? [-1, 0, 0] : [0, 0, -1]);
        wall(pt(b, out0), pt(b, outE), hb - 0.012, hb - 0.9, ns ? [1, 0, 0] : [0, 0, 1]);
      }
      continue;
    }
    // The channel: a bed, and banks down to it on both sides (from the ground or the cliff's foot).
    for (const r of streams) {
      const a = r.from, b = r.to + 1, ga = hAt(a), top = Math.max(ga - 0.02, r.surface);
      flat(bed, a, b, r.bed);
      wall(pt(a, out0), pt(a, outE), Math.max(hAt(a - 1) - 0.02, top), r.bed, ns ? [1, 0, 0] : [0, 0, 1]);
      wall(pt(b, out0), pt(b, outE), Math.max(hAt(b) - 0.02, top), r.bed, ns ? [-1, 0, 0] : [0, 0, -1]);
    }
    // Pieces of the strip between the channels (and, for cliffs, the roads).
    const pieces = (list: [number, number][]) => {
      const segs: [number, number][] = [];
      let cur = lo;
      for (const [a, b] of list) { if (a > cur) segs.push([cur, a]); cur = Math.max(cur, b); }
      if (cur < hi) segs.push([cur, hi]);
      return segs;
    };
    if (kind !== 'rocks') {
      const ground = grounds[borderGround(kind)];
      for (const [p, q] of pieces(streams.map((r) => [r.from, r.to + 1] as [number, number]).sort((u, v) => u[0] - v[0]))) {
        const list = runs(p, q);
        for (const [a, b, hgt] of list) flat(ground, a, b, hgt - 0.02);
        steps(list);
      }
      continue;
    }
    const y = cliffHeight(side);
    // The cliff, split wherever a road or a stream passes through, standing on the edge's own height.
    const inward: [number, number, number] = side === 'n' ? [0, 0, 1] : side === 's' ? [0, 0, -1] : side === 'w' ? [1, 0, 0] : [-1, 0, 0];
    for (const [p, q] of pieces(cuts)) {
      const list = runs(p, q);
      for (const [a, b, hgt] of list) {
        flat(rockTop, a, b, hgt + y);
        // The cliff face along the map's edge, facing in.
        wall(pt(a, out0), pt(b, out0), hgt + y, hgt - 0.02, inward);
      }
      steps(list, y);
    }
    // The walls of each cut, facing the road or stream.
    for (const [a, b] of cuts) {
      const ha = hAt(a - 1), hb = hAt(b);
      wall(pt(a, out0), pt(a, outE), ha + y, Math.min(ha, hAt(a)) - 0.02, ns ? [1, 0, 0] : [0, 0, 1]);
      wall(pt(b, out0), pt(b, outE), hb + y, Math.min(hb, hAt(b - 1)) - 0.02, ns ? [-1, 0, 0] : [0, 0, -1]);
    }
  }
  const add = (q: QuadList, mat: THREE.Material) => { if (q.quads) scene.add(mesh(q, patchAreaTint(mat))); };
  // A built-in tile given a picture of your own (Tiles → Picture) shows it out here too.
  const own = (key: string, roughness: number): THREE.MeshStandardMaterial | null => {
    const t = tileTextures.get(key);
    if (!t) return null;
    const span = Math.max(0.25, t.def.span || 1), m2 = t.map.clone(), n2 = t.normal.clone();
    for (const tx of [m2, n2]) { tx.repeat.set(1 / span, 1 / span); tx.needsUpdate = true; }
    const mat = new THREE.MeshStandardMaterial({ map: m2, roughness });
    registerNormalMap(mat, n2);
    return mat;
  };
  if (grounds.grass.quads) scene.add(mesh(grounds.grass, patchSeason(patchAreaTint(own('.', 1) ?? new THREE.MeshStandardMaterial({ map: makeTexture(grassTile(41), { mip: true, repeat: true }), roughness: 1 })), 'ground')));
  add(grounds.sand, own(':', 1) ?? new THREE.MeshStandardMaterial({ map: makeTexture(builtinTileArt(':'), { mip: true, repeat: true }), roughness: 1 }));
  add(grounds.snow, own('❄', 0.9) ?? new THREE.MeshStandardMaterial({ map: makeTexture(builtinTileArt('❄'), { mip: true, repeat: true }), roughness: 0.9 }));
  add(grounds.rock, own('▲', 1) ?? new THREE.MeshStandardMaterial({ map: makeTexture(builtinTileArt('▲'), { mip: true, repeat: true }), roughness: 1 }));
  add(rockTop, own('▲', 1) ?? new THREE.MeshStandardMaterial({ map: makeTexture(builtinTileArt('rock'), { mip: true, repeat: true }), roughness: 1 }));
  if (rockWall.quads) {
    const art = rockFace();
    const wallMat = new THREE.MeshStandardMaterial({ map: makeTexture(art, { repeat: true, mip: true }), roughness: 0.95 });
    registerNormalMap(wallMat, makeTexture(normalMapFrom(art, { strength: 4, wrap: true }), { linear: true, repeat: true, mip: true }));
    const m = mesh(rockWall, patchAreaTint(wallMat));
    m.castShadow = true;
    scene.add(m);
  }
  add(bed, new THREE.MeshStandardMaterial({ color: linearColor('#13283a'), roughness: 1 }));
  buildEdgeRoads(scene, map, sides, roads, tileTextures);
  if (water.quads) {
    const uv = water.uv.map((v) => v * 0.3);
    water.uv.splice(0, water.uv.length, ...uv);
    const sea = new THREE.MeshStandardMaterial({ color: linearColor('#2f6f98'), roughness: 0.55, metalness: 0, normalMap: ripple, normalScale: new THREE.Vector2(0.32, 0.32) });
    softenSpecular(sea);
    add(water, sea);
  }
}

/** Roads that reach the map edge carry on straight out over the scenery, as wide as they were painted. */
function buildEdgeRoads(scene: THREE.Object3D, map: TileMap, sides: Record<Side, BorderKind>, roads: EdgeRoad[], tileTextures: Map<string, TileTexture>): void {
  if (!roads.length) return;
  const E = 70, W = map.w, H = map.h;
  const byKey = new Map<string, { q: QuadList; edge: number[] }>();
  for (const r of roads) {
    // Grass grows over the sides only on open ground; through cliffs and over water the edges are clean.
    const open = sides[r.side] === 'grass' || sides[r.side] === 'forest' || sides[r.side] === 'meadow';
    const gk = `${r.key}|${open ? 'open' : 'clean'}`;
    let g = byKey.get(gk);
    if (!g) byKey.set(gk, (g = { q: new QuadList(), edge: [] }));
    const width = r.to - r.from + 1, a = r.from, b = r.to + 1, y = edgeHeight(map, r.side, r.from) - 0.012;
    // Corners in order, and each corner's distance to the road's two sides.
    let pts: [number, number][];
    if (r.side === 'n') pts = [[a, -E], [b, -E], [b, 0], [a, 0]];
    else if (r.side === 's') pts = [[a, H], [b, H], [b, H + E], [a, H + E]];
    else if (r.side === 'w') pts = [[-E, a], [0, a], [0, b], [-E, b]];
    else pts = [[W, a], [W + E, a], [W + E, b], [W, b]];
    const along = r.side === 'n' || r.side === 's';
    const before = g.q.pos.length;
    g.q.add(pts.map(([x, z]) => [x, y, z] as V3) as [V3, V3, V3, V3], pts.map(([x, z]) => [x, -z] as [number, number]), [0, 1, 0]);
    // QuadList may reverse the corner order to face up; read back the stored positions to pair them with edge distances.
    for (let i = before; i < g.q.pos.length; i += 3) {
      const lateral = along ? g.q.pos[i] - a : g.q.pos[i + 2] - a;
      g.edge.push(lateral, width - lateral);
    }
  }
  const grassBlend = map.tiles.blendFor('.');
  for (const [gk, { q, edge }] of byKey) {
    const [key, mode] = gk.split('|');
    const tt = tileTextures.get(key), rb = map.tiles.blendFor(key);
    let mat: THREE.MeshStandardMaterial;
    if (tt) {
      // Imported road: its own texture, repeating every `span` tiles.
      const span = Math.max(0.25, tt.def.span || 1);
      for (let i = 0; i < q.uv.length; i++) q.uv[i] /= span;
      mat = new THREE.MeshStandardMaterial({ map: tt.map, roughness: 1 });
      registerNormalMap(mat, tt.normal);
    } else {
      const art = builtinTileArt(key);
      mat = new THREE.MeshStandardMaterial({ map: makeTexture(art, { repeat: true, mip: true }), roughness: 1 });
      registerNormalMap(mat, makeTexture(normalMapFrom(art, { strength: 2, wrap: true }), { linear: true, repeat: true, mip: true }));
    }
    // Grass grows over the road's sides as it does inside the map (when both blend).
    const ragged = mode === 'open' && grassBlend.blend && rb.blend && grassBlend.priority > rb.priority;
    patchRoadEdge(patchAreaTint(mat), ragged ? grassBlend.width : 0, ragged ? grassBlend.roughness : 0);
    const m = mesh(q, mat);
    m.geometry.setAttribute('hdRoadEdge', new THREE.Float32BufferAttribute(edge, 2));
    scene.add(m);
  }
}

/** Props are drawn instanced per sprite type: a few draw calls for hundreds of objects. */
function buildProps(scene: THREE.Object3D, map: TileMap, data: MapData, sprites: SpriteLibrary): BuiltWorld['props'] {
  const slots: BuiltWorld['props'] = new Map();
  const placed = new Set(data.props);
  const groups = new Map<string, PropData[]>();
  const add = (p: PropData) => { const list = groups.get(p.type) ?? []; list.push(p); groups.set(p.type, list); };
  // Props standing inside a building aren't drawn (they'd poke through its walls).
  const inside = (p: PropData) => (data.buildings ?? []).some((b) => p.x >= b.x && p.x < b.x + b.w && p.z >= b.z && p.z < b.z + b.d);
  for (const p of data.props) {
    if (inside(p)) continue;
    add(p);
    const def = sprites.def(p.type);
    if (def) for (const [x, z] of blockedTiles(def, p.x, p.z, p.s ?? 1)) map.setBlocked(x, z, true);
    if (def) for (const b of propBoxes(def, p.x, p.z, p.s ?? 1)) map.addBox(b, p);
  }
  // Bridges and platforms: walkable at their deck height, built in 3D (not as upright cards).
  buildDecks(scene, map, placeDecks(map, data, (t) => sprites.def(t)));
  for (const t of [...groups.keys()]) if (sprites.def(t)?.deck) groups.delete(t);
  // Scenery beyond the map edge, per side. The bottom side (toward the camera) is kept sparse near the
  // edge so it doesn't hide the map.
  const sides = borderSides(data.border), R = rng(data.border?.seed ?? 1);
  const roads: EdgeRoad[] = [...edgeRoads(map.w, map.h, (x, z) => map.terrain(x, z), (k) => map.tiles.isRoad(k), sides),
    ...edgeWaters(map.w, map.h, (x, z) => map.waterAt(x, z), () => 0, sides).map((r) => ({ side: r.side, key: 'water', from: r.from, to: r.to }))];
  for (let z = -4; z < map.h + 4; z++)
    for (let x = -4; x < map.w + 4; x++) {
      if (map.inMap(x, z)) continue;
      const side = sideOf(x, z, map.w, map.h), kind = sides[side];
      const near = side === 's' && z < map.h + 2;
      // Standing on the scenery's own ground: the height of the map's edge on that side (cliff tops above it).
      const base = borderHeightAt(map, x, z);
      const at = (s: number, y?: number) => ({ x: x + 0.5 + (R() - 0.5) * 0.5, z: z + 0.5 + (R() - 0.5) * 0.4, s, y: base + (y ?? 0) });
      const r = R();
      // Keep roads clear: no trees right beside them, nothing at all on them.
      if (onEdgeRoad(roads, x, z, map.w, map.h, kind === 'forest' ? 1 : 0)) continue;
      if (kind === 'forest') {
        if (r < (side === 's' ? (near ? 0 : 0.2) : 0.6)) add({ type: R() < 0.55 ? 'oak' : 'pine', ...at(0.9 + R() * 0.4) });
      } else if (kind === 'meadow') {
        if (near ? r < 0.12 : r < 0.32) {
          const k = R();
          add({ type: k < 0.08 && !near ? 'oak' : k < 0.35 ? 'bush' : k < 0.6 ? 'tuft' : k < 0.85 ? 'flowers' : 'rock', ...at(0.8 + R() * 0.4) });
        }
      } else if (kind === 'rocks') {
        if (r < 0.14) add({ type: R() < 0.6 ? 'rock' : 'pebble', ...at(0.8 + R() * 0.6, cliffHeight(side)) });
      } else if (kind === 'plains') {
        if (near ? r < 0.05 : r < 0.14) add({ type: R() < 0.7 ? 'tuft' : R() < 0.6 ? 'flowers' : 'pebble', ...at(0.8 + R() * 0.4) });
      } else if (kind === 'rocky') {
        if (near ? r < 0.06 : r < 0.22) { const k = R(); add({ type: k < 0.7 ? 'rock' : 'pebble', ...at(k < 0.3 && !near ? 1.5 + R() * 0.6 : 0.8 + R() * 0.6) }); }
      } else if (kind === 'desert') {
        if (near ? r < 0.05 : r < 0.16) { const k = R(); add({ type: k < 0.3 && !near ? 'cactus' : k < 0.6 ? 'dry_bush' : k < 0.85 ? 'sandstone' : 'pebble', ...at(0.8 + R() * 0.5) }); }
      } else if (kind === 'snow') {
        if (near ? r < 0.04 : r < 0.12) add({ type: R() < 0.3 && !near ? 'snowy_pine' : 'snow_rock', ...at(0.8 + R() * 0.5) });
      } else if (kind === 'snowforest') {
        if (r < (side === 's' ? (near ? 0 : 0.2) : 0.6)) add({ type: R() < 0.85 ? 'snowy_pine' : 'snow_rock', ...at(0.9 + R() * 0.4) });
      }
    }
  const m = new THREE.Matrix4();
  // Props on the same row are flat cards side by side, so where they overlap they'd flicker (z-fighting). Each is
  // nudged a hair toward the camera: the one further left more, so it's drawn in front; props lower down the map
  // are already in front. Two props on the very same spot keep their order too.
  const span = map.w + 8, NUDGE = 0.03 / span;
  const nudge = (p: PropData) => Math.max(0, Math.min(span, span - (p.x + 4))) * NUDGE;
  for (const [type, list] of groups) {
    const a = sprites.get(type), pdef = sprites.def(type), onWall = !!pdef?.wall;
    // Leaves follow the seasons (bare or snowy in winter), unless the prop says it doesn't change.
    const ps = pdef ? propSeason(pdef) : 'off';
    if (ps !== 'off') patchSeason(a.material, ps === 'bare' ? 'bare' : 'leaves');
    const mesh = withSpriteShadows(new THREE.InstancedMesh(a.geometry, a.material, list.length), a);
    mesh.frustumCulled = false;
    // Flat against a wall, a shadow would only draw a dark copy beside it.
    if (onWall) mesh.castShadow = false;
    list.forEach((p, i) => {
      const s = p.s ?? 1;
      m.makeScale(s, s, s);
      const at = propBase(map, p, pdef);
      if (onWall) m.setPosition(p.x, at.y, at.z + nudge(p) * 0.3);
      else m.setPosition(p.x, at.y, p.z + nudge(p));
      mesh.setMatrixAt(i, m);
      if (placed.has(p)) slots.set(p, { mesh, index: i });
    });
    scene.add(mesh);
  }
  return slots;
}

/** Remove one prop from view (cut down): its instance shrinks to nothing. */
export function hideProp(slot: { mesh: THREE.InstancedMesh; index: number }): void {
  slot.mesh.setMatrixAt(slot.index, new THREE.Matrix4().makeScale(0, 0, 0));
  slot.mesh.instanceMatrix.needsUpdate = true;
}
