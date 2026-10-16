/**
 * Built-in item icons: 16 × 16 pixel art drawn in code, with a dark outline.
 * An item's `icon` is "builtin:<name>" for these, or an imported image path.
 */
import { Pix, ell, segD } from '../core/pixel';

const OUT = '#1a1420';
type Draw = (p: Pix) => void;

/** Fill every pixel where `inside` is true, shading from `light` (top-left) to `dark` (bottom-right). */
function fill(p: Pix, inside: (x: number, y: number) => boolean, ramp: string[]): void {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const t = Math.min(ramp.length - 1, Math.max(0, Math.floor(((x + y) / 30) * ramp.length)));
      p.set(x, y, ramp[t]);
    }
}
const line = (p: Pix, x0: number, y0: number, x1: number, y1: number, w: number, ramp: string[]) =>
  fill(p, (x, y) => segD(x, y, x0, y0, x1, y1) <= w, ramp);

/** A fish facing right: body (length rx, height ry), a forked tail and an eye; `spots` adds a few marks. */
function fishArt(ramp: string[], rx: number, ry: number, spots?: string): Draw {
  return (p) => {
    const cx = 9.2 - (5.4 - rx) * 0.4;
    fill(p, (x, y) => ell(x, y, cx, 8.5, rx, ry) || (x < cx - rx + 1.2 && x > cx - rx - 3 && Math.abs(y - 8.5) < (cx - rx + 1.2 - x) * 0.9 + 0.3), ramp);
    p.set(Math.round(cx + rx * 0.55), 7, '#1a1420');
    if (spots) for (const [x, y] of [[Math.round(cx - 1), 8], [Math.round(cx + 1), 10], [Math.round(cx - 2), 10]]) p.set(x, y, spots);
  };
}

function flask(liquid: string[]): Draw {
  return (p) => {
    fill(p, (x, y) => ell(x, y, 8, 10.5, 5, 4.6), ['#e8f4ff', '#b8d2e6', '#8aa8c2']);
    fill(p, (x, y) => ell(x, y, 8, 11, 4.2, 3.8) && y > 9, liquid);
    fill(p, (x, y) => x >= 6.5 && x <= 9.5 && y >= 3 && y <= 6.5, ['#d8ecfa', '#a8c4da']);
    fill(p, (x, y) => x >= 6 && x <= 10 && y >= 1.5 && y <= 3.5, ['#a87a4a', '#7a5434']);
    p.set(6, 9, '#ffffff'); p.set(5, 10, '#ffffff');
  };
}

/** A band with a gem on top. */
function ringIcon(band: string[], gem: string[]): Draw {
  return (p) => {
    fill(p, (x, y) => ell(x, y, 8, 10, 5, 4.5) && !ell(x, y, 8, 10, 3, 2.6), band);
    fill(p, (x, y) => ell(x, y, 8, 4.5, 2.4, 2.2), gem);
    p.set(7, 3, '#ffffff');
  };
}

/** Inside a convex polygon (points clockwise on screen)? */
function inPoly(x: number, y: number, pts: [number, number][]): boolean {
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
  }
  return true;
}

/**
 * A spell shard: a long crystal with a bright left facet and a darker right one (ramp light → dark), a glinting
 * edge down the middle and a small glow mark of the spell in its heart.
 */
function shard(ramp: [string, string, string, string], mark: string): Draw {
  const outline: [number, number][] = [[8, 0.6], [12.2, 4.6], [11.2, 12], [8, 15.4], [4.8, 12], [3.8, 4.6]];
  return (p) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        if (!inPoly(cx, cy, outline)) continue;
        // Facets: the left face catches the light, the right is in shade, the top caps are brightest.
        const left = cx < 8 - (cy - 8) * 0.12, top = cy < 4.8;
        p.set(x, y, top ? (left ? ramp[0] : ramp[1]) : left ? ramp[1] : cy > 11.5 ? ramp[3] : ramp[2]);
      }
    for (let y = 2; y < 14; y++) p.set(y < 5 ? 8 : 7, y, ramp[0]);
    p.set(8, 7, mark); p.set(8, 8, mark); p.set(9, 8, mark); p.set(8, 9, mark);
    p.set(6, 3, '#ffffff'); p.set(5, 5, '#ffffff');
  };
}

/** A lump of rock: stone, or ore with bright flecks (`fleck` ramp, or none for plain stone). */
function lump(rock: string[], fleck: string[] | null): Draw {
  return (p) => {
    fill(p, (x, y) => ell(x, y, 8, 9.5, 6, 4.8) || ell(x, y, 6, 7.5, 3.5, 3.2), rock);
    if (fleck) for (const [x, y, k] of [[5, 7, 0], [6, 8, 1], [9, 9, 0], [10, 10, 1], [7, 11, 0], [11, 8, 1], [8, 6, 1]] as [number, number, number][]) p.set(x, y, fleck[k]);
    else { p.set(5, 7, '#c8cbd4'); p.set(9, 11, '#3a3c46'); p.set(10, 11, '#3a3c46'); }
  };
}

/** An ingot: a trapezoid bar with a bright top face. */
function ingot(ramp: string[], top: string): Draw {
  return (p) => {
    fill(p, (x, y) => y >= 7 && y <= 12 && x >= 2 + (12 - y) * 0.3 && x <= 14 - (12 - y) * 0.3, ramp);
    fill(p, (x, y) => y >= 5 && y < 7.5 && x >= 4 + (7 - y) * 0.6 && x <= 12 - (7 - y) * 0.6, [top]);
    p.set(5, 6, '#ffffff');
  };
}

export const ITEM_ICONS: Record<string, { name: string; draw: Draw }> = {
  stone: { name: 'Stone', draw: lump(['#b2b5bf', '#878b98', '#5c5f6c', '#3c3e48'], null) },
  ore_iron: { name: 'Iron ore', draw: lump(['#8a8d99', '#666975', '#4a4c57', '#33343d'], ['#e8a066', '#a8582a']) },
  ore_gold: { name: 'Gold ore', draw: lump(['#7a7d8a', '#5a5d69', '#40424d', '#2c2d36'], ['#fff0a0', '#e0b030']) },
  ore_silver: { name: 'Silver ore', draw: lump(['#7a7d8a', '#5a5d69', '#40424d', '#2c2d36'], ['#ffffff', '#b8c4d8']) },
  ingot_iron: { name: 'Iron ingot', draw: ingot(['#9aa0ac', '#6e7480', '#4a4f5a'], '#c4c9d2') },
  ingot_steel: { name: 'Steel ingot', draw: ingot(['#c2cad8', '#8a94a8', '#5c6478'], '#eef2fa') },
  ingot_gold: { name: 'Gold ingot', draw: ingot(['#ffd86a', '#e0a82a', '#a8761a'], '#fff2b0') },
  ingot_silver: { name: 'Silver ingot', draw: ingot(['#eef2f8', '#b8c0d0', '#8088a0'], '#ffffff') },
  pickaxe: { name: 'Pickaxe', draw: (p) => {
    line(p, 3, 14, 11, 5, 0.9, ['#a8784a', '#6a4428']);
    fill(p, (x, y) => segD(x, y, 5.5, 3, 15, 8) <= 1.3 && y < 9, ['#eef2fa', '#aab4c4', '#7a8498']);
  } },
  hammer: { name: 'War hammer', draw: (p) => {
    line(p, 3, 14, 10, 6, 0.9, ['#a8784a', '#6a4428']);
    fill(p, (x, y) => segD(x, y, 8, 3, 13.5, 8.5) <= 2.4, ['#c2cad8', '#8a94a8', '#5c6478']);
  } },

  fishing_rod: { name: 'Fishing rod', draw: (p) => {
    line(p, 2, 15, 13, 2, 0.75, ['#c89a5c', '#8a5c30']);
    fill(p, (x, y) => ell(x, y, 5, 12, 1.6, 1.6), ['#c4ccd8', '#7a8494']);
    for (let y = 3; y <= 12; y++) p.set(14, y, '#e8eef8');
    fill(p, (x, y) => ell(x, y, 14, 13.2, 1.2, 1.2), ['#ff6a5a', '#c83a32']);
  } },
  fish_minnow: { name: 'Small fish', draw: fishArt(['#e8f0f8', '#a8b8cc', '#6a7c94'], 3.2, 2) },
  fish_trout: { name: 'Trout', draw: fishArt(['#d8e8b8', '#8cae6a', '#4e7240'], 5.4, 2.6, '#c84a4a') },
  fish_eel: { name: 'Eel', draw: (p) => {
    fill(p, (x, y) => segD(x, y, 2, 11, 7, 6) <= 1.5 || segD(x, y, 7, 6, 11, 9) <= 1.6 || segD(x, y, 11, 9, 14, 4) <= 1.4, ['#9a8ad8', '#5c4c9c', '#3a2c6a']);
    p.set(13, 4, '#ffffff');
  } },
  fish_koi: { name: 'Golden fish', draw: fishArt(['#fff2a0', '#ffc43a', '#d8841a'], 5, 3, '#ffffff') },
  boot: { name: 'Old boot', draw: (p) => {
    fill(p, (x, y) => (x >= 5 && x <= 10 && y >= 2 && y <= 12) || ell(x, y, 9.5, 12.2, 5, 2.4), ['#a87a52', '#7a5434', '#4e3420']);
    line(p, 5, 4, 10, 4, 0.5, ['#4e3420']);
    p.set(12, 10, '#5a8a3a'); p.set(13, 9, '#5a8a3a');
  } },

  potion: { name: 'Red potion', draw: flask(['#ff6b6b', '#d83a3a', '#a01e2a']) },
  ether: { name: 'Blue potion', draw: flask(['#7cc0ff', '#3a7ce0', '#1f4aa0']) },
  tonic: { name: 'Green potion', draw: flask(['#b6f07a', '#6cbf3a', '#3a8424']) },
  herb: { name: 'Herb', draw: (p) => {
    line(p, 8, 15, 8, 6, 0.6, ['#4a7a2c']);
    fill(p, (x, y) => ell(x, y, 5, 7, 3.2, 1.8) || ell(x, y, 11, 6, 3.2, 1.8) || ell(x, y, 6, 11, 3, 1.6) || ell(x, y, 10.5, 10.5, 3, 1.6) || ell(x, y, 8, 3.5, 1.8, 2.5), ['#a8e070', '#6cb444', '#3f7f2a']);
  } },
  bread: { name: 'Bread', draw: (p) => {
    fill(p, (x, y) => ell(x, y, 8, 9.5, 7, 4.5), ['#f2c47a', '#d8964a', '#a8662c']);
    for (const cx of [5, 8, 11]) line(p, cx - 1, 8, cx + 1, 10.5, 0.45, ['#8a4e20']);
  } },
  apple: { name: 'Apple', draw: (p) => {
    fill(p, (x, y) => ell(x, y, 6.2, 9.5, 4, 4.8) || ell(x, y, 9.8, 9.5, 4, 4.8), ['#ff7a6a', '#e03a32', '#9c1e22']);
    line(p, 8, 5, 9, 2, 0.5, ['#6a4422']);
    fill(p, (x, y) => ell(x, y, 11, 3.5, 2.2, 1.2), ['#8ad060', '#4e9a34']);
    p.set(5, 7, '#ffd0c8');
  } },
  flashlight: { name: 'Flashlight', draw: (p) => {
    line(p, 3, 13, 10, 6, 2.1, ['#9aa4b4', '#6a7484', '#464e5c']);
    fill(p, (x, y) => segD(x, y, 10, 6, 12.5, 3.5) <= 3, ['#c4ccd8', '#8a94a4']);
    fill(p, (x, y) => segD(x, y, 12, 3, 13.4, 1.6) <= 2.2 && x + y > 13.5, ['#fff6b0', '#ffd84a']);
    p.set(6, 10, '#d84a3a');
  } },
  lantern: { name: 'Lantern', draw: (p) => {
    fill(p, (x, y) => (x >= 4 && x <= 12 && y >= 4 && y <= 5.5) || (x >= 4 && x <= 12 && y >= 13 && y <= 14.5), ['#6a5a4a', '#4a3e34']);
    fill(p, (x, y) => x >= 5 && x <= 11 && y >= 5.5 && y <= 13, ['#fff2a0', '#ffc24a', '#e08a2a']);
    for (const x of [5, 8, 11]) for (let y = 6; y < 13; y++) p.set(x, y, '#5a4a3c');
    fill(p, (x, y) => !ell(x, y, 8, 3.6, 2.4, 2.2) && ell(x, y, 8, 3.6, 3.4, 3), ['#8a7a6a']);
    p.set(8, 9, '#ffffff');
  } },
  torch: { name: 'Torch', draw: (p) => {
    line(p, 5, 15, 9.5, 7, 1.2, ['#a87a4a', '#7a5434']);
    fill(p, (x, y) => ell(x, y, 10.5, 5, 3, 4) && y < 8, ['#fff2a0', '#ffb43a', '#ff6a2a']);
    fill(p, (x, y) => ell(x, y, 10.5, 5.5, 1.4, 2), ['#fffbe0']);
  } },
  sword: { name: 'Sword', draw: (p) => {
    line(p, 6, 10, 14, 2, 1.2, ['#f2f6ff', '#c2cad8', '#8a94a8']);
    line(p, 3, 9, 7, 13, 0.9, ['#ffd86a', '#c89a2a']);
    line(p, 2, 14, 5, 11, 0.9, ['#8a5a34', '#5a3a22']);
  } },
  greatsword: { name: 'Greatsword', draw: (p) => {
    line(p, 5, 11, 14.5, 1.5, 1.7, ['#f2f6ff', '#c2cad8', '#8a94a8']);
    line(p, 2, 9, 7, 14, 1, ['#d8dce8', '#8a94a8']);
    line(p, 1.5, 14.5, 4, 12, 1, ['#5a3a22']);
  } },
  axe: { name: 'Great axe', draw: (p) => {
    line(p, 3, 14, 12, 4, 0.9, ['#a8784a', '#6a4428']);
    fill(p, (x, y) => ell(x, y, 11.5, 4.5, 3.6, 3.4) && x + y > 13.5, ['#eef2fa', '#aab4c4', '#7a8498']);
  } },
  bow: { name: 'Bow', draw: (p) => {
    fill(p, (x, y) => { const d = Math.hypot(x - 2, y - 14); return d > 10.2 && d < 11.8 && x > 1 && y < 15; }, ['#d8a060', '#a8703a', '#6a4422']);
    line(p, 2.6, 3.4, 12.6, 13.4, 0.35, ['#f0ead8']);
  } },
  arrow: { name: 'Arrow', draw: (p) => {
    line(p, 3, 13, 12, 4, 0.6, ['#c8a070', '#8a6a40']);
    fill(p, (x, y) => x > 10.5 && y < 5.5 && x - y < 10.5 && x + y > 13, ['#c8ccd8', '#8a90a0']);
    line(p, 2, 12, 4, 14, 0.8, ['#e8e0d0']);
  } },
  arrow_steel: { name: 'Steel arrow', draw: (p) => {
    line(p, 3, 13, 12, 4, 0.6, ['#5a5450', '#3a3430']);
    fill(p, (x, y) => x > 10 && y < 6 && x - y < 10.5 && x + y > 12.5, ['#f4f8ff', '#b8c4d8', '#7a8aa8']);
    line(p, 2, 12, 4, 14, 0.8, ['#c84a3a']);
  } },
  spell_fire: { name: 'Fire spell', draw: (p) => {
    fill(p, (x, y) => { const t = (y - 2) / 13; if (t < 0 || t > 1) return false; const w = Math.sin(t * Math.PI * 0.95) * 5.5 * (0.75 + 0.25 * Math.sin(y * 1.7)); return Math.abs(x - 8 - Math.sin(y * 0.6) * (1 - t)) < w; }, ['#fff6c8', '#ffd04a', '#ff8a2a', '#d8431e']);
    fill(p, (x, y) => ell(x, y, 8, 11, 2.2, 3), ['#fffbe8', '#ffe48a']);
  } },
  log: { name: 'Firewood', draw: (p) => {
    line(p, 3, 11, 13, 6, 2.2, ['#a8743f', '#7a4f2d', '#5a3820']);
    line(p, 2, 8, 11, 12, 1.8, ['#94673b', '#6b4325', '#4a2d18']);
    fill(p, (x, y) => ell(x, y, 13, 6, 1.7, 2), ['#f0cf94', '#c8955a']);
    fill(p, (x, y) => ell(x, y, 11.2, 12, 1.4, 1.7), ['#e0b67a', '#b07a48']);
  } },
  shard_fire: { name: 'Fire shard', draw: shard(['#ffe9a8', '#ffab3d', '#e8582a', '#a8301c'], '#fff6d0') },
  shard_frost: { name: 'Frost shard', draw: shard(['#effaff', '#9ad8ff', '#4e9ae8', '#2a5aa8'], '#ffffff') },
  shard_spark: { name: 'Lightning shard', draw: shard(['#fffbd0', '#ffe45a', '#e0b02a', '#9a6e14'], '#ffffff') },
  shard_venom: { name: 'Poison shard', draw: shard(['#e4ffb8', '#9ee05a', '#55a834', '#2e6a24'], '#f4ffd8') },
  shard_arcane: { name: 'Arcane shard', draw: shard(['#f4dcff', '#c48aff', '#8a4ee0', '#552c9a'], '#ffffff') },
  shard_light: { name: 'Light shard', draw: shard(['#ffffff', '#fff2c0', '#e8cf7a', '#b0924a'], '#ffffff') },
  shard_shadow: { name: 'Shadow shard', draw: shard(['#b8a8d8', '#6a5a94', '#3e3462', '#221c3a'], '#d8c8ff') },
  shard_earth: { name: 'Earth shard', draw: shard(['#f0d8a8', '#c89a5a', '#8a6232', '#5a3c1e'], '#fff0c8') },
  shard_tide: { name: 'Water shard', draw: shard(['#e4fbff', '#7ee0f0', '#2fa6c8', '#1a5f86'], '#ffffff') },
  fist: { name: 'Fist', draw: (p) => {
    fill(p, (x, y) => ell(x, y, 8, 8.5, 5, 4.5) || (x > 3.5 && x < 12.5 && y > 9 && y < 14), ['#f4cfa8', '#d9a27a', '#b07a54']);
    for (let x = 5; x <= 11; x += 2) p.set(x, 6, '#8a5a3a');
  } },
  dagger: { name: 'Dagger', draw: (p) => {
    line(p, 7, 9, 12, 4, 1.1, ['#eef2fa', '#aab4c4']);
    line(p, 5, 8, 8, 11, 0.8, ['#c89a2a']);
    line(p, 4, 12, 6, 10, 0.8, ['#6a4428']);
  } },
  shield: { name: 'Shield', draw: (p) => {
    fill(p, (x, y) => y >= 2 && y <= 9 ? x >= 3 && x <= 13 : Math.abs(x - 8) <= (14.5 - y) * 0.9, ['#ffd86a', '#c89a2a']);
    fill(p, (x, y) => y >= 3.2 && y <= 9 ? x >= 4.2 && x <= 11.8 : Math.abs(x - 8) <= (13.3 - y) * 0.85, ['#6a9cf0', '#3a62c0', '#24408a']);
    line(p, 8, 4, 8, 12, 0.5, ['#ffd86a']);
  } },
  armor: { name: 'Armor', draw: (p) => {
    fill(p, (x, y) => (x >= 4 && x <= 12 && y >= 4 && y <= 14) || ell(x, y, 3.5, 5, 2.4, 2) || ell(x, y, 12.5, 5, 2.4, 2), ['#dfe6f2', '#a8b4c8', '#6a7890']);
    fill(p, (x, y) => ell(x, y, 8, 3.6, 2.4, 1.6), ['#1a1420']);
    line(p, 8, 6, 8, 13, 0.4, ['#7a869c']);
  } },
  boots: { name: 'Boots', draw: (p) => {
    fill(p, (x, y) => (x >= 3 && x <= 7 && y >= 3 && y <= 12) || ell(x, y, 6, 13, 4.5, 2), ['#b07a4a', '#7a5032', '#4e321e']);
    fill(p, (x, y) => (x >= 9 && x <= 13 && y >= 4 && y <= 12) || ell(x, y, 12, 13, 3.8, 1.8), ['#a06a3e', '#6a442a']);
  } },
  ring: { name: 'Ring', draw: ringIcon(['#fff0a0', '#e0b43a', '#a87a1e'], ['#c8f4ff', '#4ac0e0', '#2a7aa0']) },
  ring_sun: { name: 'Sun ring', draw: ringIcon(['#fff0a0', '#e0b43a', '#a87a1e'], ['#fffbe0', '#ffd84a', '#e08a1e']) },
  ring_tide: { name: 'Tide ring', draw: ringIcon(['#f4f6ff', '#b8c0d8', '#7a829a'], ['#d8f4ff', '#3aa0f0', '#1a4aa0']) },
  ring_leaf: { name: 'Leaf ring', draw: ringIcon(['#f4e0c0', '#b88a5a', '#7a5434'], ['#d8ffb0', '#5ac03a', '#2a7a1e']) },
  ring_ember: { name: 'Ember ring', draw: ringIcon(['#3a3440', '#26222c', '#141218'], ['#ffd0a0', '#ff5a2a', '#a01e1e']) },
  amulet: { name: 'Amulet', draw: (p) => {
    fill(p, (x, y) => ell(x, y, 8, 5, 6, 5) && !ell(x, y, 8, 5, 5, 4) && y < 7, ['#e0b43a']);
    fill(p, (x, y) => Math.abs(x - 8) + Math.abs(y - 11) <= 3.6, ['#ff9ad0', '#e04a8a', '#9a2a5a']);
  } },
  key: { name: 'Key', draw: (p) => {
    fill(p, (x, y) => ell(x, y, 5, 5.5, 3.4, 3.4) && !ell(x, y, 5, 5.5, 1.4, 1.4), ['#fff0a0', '#e0b43a', '#a87a1e']);
    line(p, 7, 8, 13, 14, 0.9, ['#e0b43a', '#a87a1e']);
    line(p, 11, 12, 13, 10, 0.7, ['#c8962a']);
  } },
  gem: { name: 'Gem', draw: (p) => {
    fill(p, (x, y) => y >= 4 && y <= 7 ? Math.abs(x - 8) <= 4 + (y - 4) * 0.7 : y > 7 && Math.abs(x - 8) <= (14 - y) * 1.1, ['#e0fbff', '#5ad8f0', '#2a90b8', '#1a5a80']);
    line(p, 5, 7, 11, 7, 0.4, ['#bff2ff']);
  } },
  trophy: { name: 'Trophy', draw: (p) => {
    // The cup, its handles, the stem and the base.
    fill(p, (x, y) => y >= 2 && y <= 8 && Math.abs(x - 8) <= 5 - Math.max(0, y - 5) * 0.9, ['#fff4b0', '#f0c44a', '#c8902a', '#8a5a1a']);
    line(p, 2, 3, 2, 5, 0.6, ['#e0b43a']); line(p, 14, 3, 14, 5, 0.6, ['#e0b43a']);
    p.set(3, 6, '#c8902a'); p.set(13, 6, '#c8902a');
    p.rect(7, 9, 2, 3, '#c8902a');
    p.rect(5, 12, 6, 2, '#8a5a1a'); p.rect(5, 12, 6, 1, '#e0b43a');
    p.set(6, 3, '#ffffff'); p.set(6, 4, '#fff8d0');
  } },
  coin: { name: 'Coins', draw: (p) => {
    fill(p, (x, y) => ell(x, y, 6, 10, 4.5, 4.5), ['#fff0a0', '#e0b43a', '#a87a1e']);
    fill(p, (x, y) => ell(x, y, 10.5, 6.5, 4, 4), ['#fff4b0', '#f0c44a', '#b8862a']);
    p.set(10, 6, '#a87a1e'); p.set(11, 6, '#a87a1e'); p.set(6, 10, '#a87a1e');
  } },
  scroll: { name: 'Scroll', draw: (p) => {
    fill(p, (x, y) => x >= 4 && x <= 12 && y >= 3 && y <= 13, ['#fff4d8', '#ead6a8', '#c8ae7a']);
    fill(p, (x, y) => ell(x, y, 8, 3, 5.5, 1.5) || ell(x, y, 8, 13.5, 5.5, 1.5), ['#d8c08a', '#a88a5a']);
    for (const y of [6, 8, 10]) line(p, 6, y, 10.5, y, 0.35, ['#8a7a6a']);
  } },
  book: { name: 'Book', draw: (p) => {
    fill(p, (x, y) => x >= 3 && x <= 13 && y >= 2 && y <= 14, ['#e05a4a', '#a83a2e', '#6a2420']);
    fill(p, (x, y) => x >= 11 && x <= 12.5 && y >= 3 && y <= 13.5, ['#fff4d8']);
    fill(p, (x, y) => x >= 5 && x <= 9 && y >= 5 && y <= 7, ['#ffd86a']);
  } },
  bag: { name: 'Pouch', draw: (p) => {
    fill(p, (x, y) => ell(x, y, 8, 10.5, 5.5, 4.5) || (x >= 6 && x <= 10 && y >= 4 && y <= 7), ['#c8946a', '#9a6a44', '#6a442a']);
    line(p, 5.5, 5, 10.5, 5, 0.6, ['#e0b43a']);
  } },
  mushroom: { name: 'Mushroom', draw: (p) => {
    fill(p, (x, y) => x >= 6.5 && x <= 9.5 && y >= 8 && y <= 14, ['#fff4e0', '#e0d0b8']);
    fill(p, (x, y) => ell(x, y, 8, 8, 6, 4.5) && y < 9, ['#ff7a6a', '#d83a3a', '#9c1e22']);
    p.set(6, 6, '#ffffff'); p.set(10, 5, '#ffffff'); p.set(8, 7, '#ffffff');
  } },
};

const cache = new Map<string, HTMLCanvasElement>();

/** The 16 × 16 canvas for a built-in icon (cached; an unknown name draws a grey square). */
export function builtinIcon(name: string): HTMLCanvasElement {
  let c = cache.get(name);
  if (c) return c;
  const p = new Pix(16, 16);
  const def = ITEM_ICONS[name];
  if (def) def.draw(p); else p.rect(3, 3, 10, 10, '#6a6a7a');
  p.outline(OUT);
  c = p.canvas();
  cache.set(name, c);
  return c;
}

/** "builtin:potion" → "potion", or null for an imported image path. */
export const builtinIconName = (icon: string | undefined): string | null => (icon?.startsWith('builtin:') ? icon.slice(8) : null);
