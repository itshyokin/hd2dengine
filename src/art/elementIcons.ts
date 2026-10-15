/**
 * Small element icons (12 × 12 pixel art, outlined), drawn in code: a drop, a flame, a leaf, a rock, a bolt, a sun,
 * a crescent moon, and a plain diamond for non-elemental. For enemy tags, menus and the editor.
 */
import { Pix, ell, segD } from '../core/pixel';
import type { Element } from '../world/types';

const S = 12;
type Shape = (x: number, y: number) => boolean;

const SHAPES: Record<Element, { shape: Shape; ramp: [string, string, string] }> = {
  water: { shape: (x, y) => (y > 6 ? ell(x, y, 6, 7.4, 3.6, 3.6) : Math.abs(x - 6) < (y - 1) * 0.62), ramp: ['#bfe6ff', '#5ab4ff', '#2a6ad0'] },
  fire: { shape: (x, y) => ell(x, y, 6, 8, 3.6, 3.2) || (y > 1 && y < 8 && Math.abs(x - 6 - Math.sin(y) * 0.6) < (y - 1) * 0.55), ramp: ['#fff2a0', '#ff9a3a', '#d8401e'] },
  nature: { shape: (x, y) => ell(x - (y - 6) * 0.35, y, 6, 6, 2.6, 4.6) || segD(x, y, 3, 11, 5, 8) < 0.7, ramp: ['#c8f59a', '#6fd05a', '#2e8a2c'] },
  earth: { shape: (x, y) => y > 3 && y < 11 && Math.abs(x - 6) < 5 - Math.abs(y - 7.5) * 0.45 && !(y < 5 && x > 8), ramp: ['#ecc888', '#c8964e', '#7a5428'] },
  shock: { shape: (x, y) => segD(x, y, 8, 1, 4.5, 6.5) < 1.1 || segD(x, y, 4.5, 6.5, 7.5, 6.5) < 1 || segD(x, y, 7.5, 6.5, 4, 11) < 1.1, ramp: ['#fffbd0', '#ffe04a', '#c8a014'] },
  light: { shape: (x, y) => ell(x, y, 6, 6, 2.6, 2.6) || ((Math.round(x) === 6 || Math.round(y) === 6 || Math.abs(x - y) < 0.6 || Math.abs(x + y - 12) < 0.6) && ell(x, y, 6, 6, 5.2, 5.2)), ramp: ['#ffffff', '#fff4c2', '#e0c25a'] },
  dark: { shape: (x, y) => ell(x, y, 6, 6, 4.6, 4.6) && !ell(x, y, 8.2, 4.8, 3.8, 3.8), ramp: ['#d8c4ff', '#a77cff', '#5a3aa8'] },
  neutral: { shape: (x, y) => Math.abs(x - 6) + Math.abs(y - 6) < 4.6, ramp: ['#ffffff', '#d8d2c4', '#8a8478'] },
};

const cache = new Map<Element, string>();

/** An element's icon as a data URL (cached). */
export function elementIconUrl(e: Element): string {
  let u = cache.get(e);
  if (u) return u;
  const p = new Pix(S, S), { shape, ramp } = SHAPES[e] ?? SHAPES.neutral;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!shape(x + 0.5, y + 0.5)) continue;
      const t = (x + y) / (2 * S);
      p.set(x, y, ramp[t < 0.36 ? 0 : t < 0.62 ? 1 : 2]);
    }
  p.outline('#1a1420');
  u = p.canvas().toDataURL();
  cache.set(e, u);
  return u;
}
