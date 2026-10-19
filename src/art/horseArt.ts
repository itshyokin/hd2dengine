/**
 * Placeholder horse art, drawn in code: a 3 × 4 sheet (walk frames; facing down, left, right, up) like the
 * characters', 40 × 32 px a frame. A saddle on its back. Replaced by real art later.
 */
import { Pix } from '../core/pixel';

const OUTLINE = '#17131d';
export const HORSE_FRAME_W = 40, HORSE_FRAME_H = 32;

/** Lighter and darker shades of a colour (#rrggbb). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** A horse sheet: `coat` its colour, `mane` the mane and tail. */
export function horseSheet(coat: string, mane: string): HTMLCanvasElement {
  const FW = HORSE_FRAME_W, FH = HORSE_FRAME_H, p = new Pix(FW * 3, FH * 4);
  const ramp = [shade(coat, 1.25), coat, shade(coat, 0.78), shade(coat, 0.6)];
  const maneC = [shade(mane, 1.2), mane, shade(mane, 0.7)];
  const hoof = '#2a2024', saddle = ['#8a5228', '#6b3a1e', '#4a2612'];
  for (let row = 0; row < 4; row++)
    for (let f = 0; f < 3; f++) {
      const ox = f * FW, oy = row * FH;
      // Walk: frames 0 and 2 swing the legs opposite ways, 1 stands.
      const swing = f === 0 ? 1 : f === 2 ? -1 : 0;
      const put = (x: number, y: number, c: string, flip = false) => {
        const xx = Math.round(flip ? FW - 1 - x : x), yy = Math.round(y);
        if (xx >= 0 && xx < FW && yy >= 0 && yy < FH) p.set(ox + xx, oy + yy, c);
      };
      const ellipse = (cx: number, cy: number, rx: number, ry: number, col: (y: number) => string, flip = false) => {
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
          for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) put(x, y, col((y + 0.5 - cy) / ry), flip);
          }
      };
      const tone = (t: number) => ramp[Math.max(0, Math.min(3, Math.floor((t + 1) * 2)))];
      const line = (x0: number, y0: number, x1: number, y1: number, w: number, c: (k: number) => string, flip = false) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
        for (let i = 0; i <= n; i++) {
          const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
          for (let a = 0; a < w; a++) put(x + a - (w - 1) / 2, y, c(k), flip);
        }
      };
      if (row === 1 || row === 2) {
        // Side on (drawn facing right; mirrored for left).
        const flip = row === 1;
        // Legs behind the body first (the far pair, darker), then the body, then the near pair.
        const leg = (x: number, s: number, far: boolean) => {
          line(x, 20, x + s * 1.5, 29, 2, (k) => (k > 0.86 ? hoof : far ? ramp[3] : ramp[2]), flip);
        };
        leg(12, -swing, true); leg(26, swing, true);
        // Tail.
        line(9, 13, 6 + swing * 0.5, 25, 2, (k) => maneC[k < 0.3 ? 0 : 1], flip);
        ellipse(19, 17, 10.5, 5.2, tone, flip);
        // Neck and head.
        line(26, 15, 31, 6, 4, (k) => ramp[k < 0.5 ? 1 : 0], flip);
        ellipse(33.5, 6.5, 4.2, 2.6, (t) => (t > 0.3 ? ramp[2] : ramp[1]), flip);
        put(37, 7, ramp[3], flip); put(37, 6, ramp[3], flip);
        put(33, 5, '#1a1420', flip);
        put(31, 2, ramp[1], flip); put(31, 3, ramp[1], flip); put(32, 3, ramp[2], flip);
        // Mane along the top of the neck.
        line(24, 12, 29.5, 3.5, 2, (k) => maneC[k > 0.7 ? 0 : 1], flip);
        leg(14, swing, false); leg(28, -swing, false);
        // The saddle and its stirrup.
        for (let x = 15; x <= 22; x++) for (let y = 11; y <= 13; y++) put(x, y, saddle[y === 11 ? 0 : 1], flip);
        line(19, 14, 19, 18, 1, () => saddle[2], flip);
        put(19, 19, '#b8b0a0', flip);
      } else {
        // Facing down (the face) or up (the tail).
        const front = row === 0;
        const leg = (x: number, top: number, s: number, far: boolean) => line(x, top - (s > 0 ? 1 : 0), x, 29, 2, (k) => (k > 0.85 ? hoof : far ? ramp[3] : ramp[2]));
        leg(16, 24, -swing, true); leg(24, 24, swing, true);
        ellipse(20, 17, 6.5, 6.5, tone);
        leg(17.5, 22, swing, false); leg(22.5, 22, -swing, false);
        // The saddle's sides.
        for (let y = 12; y <= 14; y++) { put(13, y, saddle[1]); put(14, y, saddle[0]); put(26, y, saddle[1]); put(25, y, saddle[0]); }
        if (front) {
          ellipse(20, 8, 3.2, 5.2, (t) => (t > 0.45 ? ramp[2] : ramp[1]));
          for (let x = 18; x <= 22; x++) put(x, 12, ramp[3]);
          put(18, 7, '#1a1420'); put(22, 7, '#1a1420');
          put(17, 2, ramp[1]); put(17, 3, ramp[1]); put(23, 2, ramp[1]); put(23, 3, ramp[1]);
          for (let x = 19; x <= 21; x++) { put(x, 3, maneC[1]); put(x, 4, maneC[0]); }
        } else {
          ellipse(20, 7, 3, 3, () => ramp[2]);
          put(17, 3, ramp[1]); put(17, 4, ramp[1]); put(23, 3, ramp[1]); put(23, 4, ramp[1]);
          for (let y = 5; y <= 11; y++) put(20, y, maneC[1]);
          line(20, 14, 20 + swing * 0.5, 26, 3, (k) => maneC[k < 0.25 ? 0 : 1]);
        }
      }
    }
  p.outline(OUTLINE);
  return p.canvas();
}
