"""
Rebuild public/assets/weapons/thumbs.png: one 64 x 64 icon per weapon sprite, cut from the weapon's own sheet, so
the bag, shop, back and editor icons look exactly like the weapon the characters swing.

For each weapon it looks through the frames for the one that shows the weapon best:
  - swords and blunt weapons: their held poses (walk, idle, stance), the longest, straightest, most diagonal blade
    in one piece (the swing frames have motion smears in them);
  - staffs: any frame, the same way;
  - bows: the widest frame; shields: the one with the most shield showing.
The icon is drawn at 1:1 (halved if it would not fit), centred in its cell.

    python tools/lpc/weapon_icons.py [public/assets/weapons]
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CELL = 64
HELD = ['walk', 'idle', 'combat_idle']
PREF = {'sword': HELD, 'blunt': HELD, 'staff': ['thrust', 'slash', 'walk'], 'bow': ['shoot', 'walk'], 'shield': ['walk', 'idle', 'combat_idle', 'slash']}


def frame(sheet, a, f, d):
    d = d if a['dirs'] == 4 else 0
    x, y = f * a['frame'], a['y'] + d * a['frame']
    return sheet.crop((x, y, x + a['frame'], y + a['frame']))


def score(kind, img):
    a = np.array(img.getchannel('A')) > 0
    ys, xs = np.nonzero(a)
    if len(xs) < 4:
        return None
    bb = img.getbbox()
    bw, bh = bb[2] - bb[0], bb[3] - bb[1]
    if kind == 'shield':
        return float(len(xs))
    if kind == 'bow':
        return max(bw, bh) * 4 + len(xs) * 0.05
    lab, n = ndimage.label(a, structure=np.ones((3, 3)))
    if n > 1:
        sizes = sorted(ndimage.sum(a, lab, range(1, n + 1)))
        if sizes[-2] > 0.08 * len(xs):
            return None  # in pieces (a hand covers the grip)
    ev, vec = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
    v = vec[:, 1]
    elong = np.sqrt(ev[1] / max(ev[0], 0.05))
    length = 4 * np.sqrt(ev[1])
    diagonal = abs(np.sin(2 * np.arctan2(v[1], v[0])))
    return length * min(1, elong / 10) ** 3 * (0.35 + 0.65 * diagonal)


def best_icon(w, sheet):
    kind = w['kind']
    names = PREF[kind]
    if not (kind in ('sword', 'blunt') and any(n in w['anims'] for n in names)):
        names = names + w['anims']
    best = None
    for an in names:
        layers = [w['layers'][k].get(an) for k in ('back', 'front')]
        if not any(layers):
            continue
        size = max(a['frame'] for a in layers if a)
        n = max(a['frames'] for a in layers if a)
        for d in (3, 1, 2, 0):
            for f in range(n):
                c = Image.new('RGBA', (size, size))
                for a in layers:
                    if a and f < a['frames']:
                        o = (size - a['frame']) // 2
                        c.alpha_composite(frame(sheet, a, f, d), (o, o))
                bb = c.getbbox()
                if not bb:
                    continue
                s = score(kind, c)
                if s is not None and (best is None or s > best[0]):
                    best = (s, c.crop(bb))
    return best[1] if best else None


def orient(kind, icon):
    """Turn a weapon icon (by flipping only) so it lies like the built-in icons: on the / diagonal, the grip at the
    bottom left. Swords: the guard and pommel end (heavier than the blade) is the grip; maces and staffs: the head
    (heavier) goes to the top right."""
    if kind not in ('sword', 'blunt', 'staff'):
        return icon
    a = np.array(icon.getchannel('A')) > 0
    ys, xs = np.nonzero(a)
    if len(xs) < 4:
        return icon
    xs = xs - xs.mean()
    ys = ys - ys.mean()
    ev, vec = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
    vx, vy = vec[:, 1]
    if vx * vy > 0:  # lying like \ (y grows downwards): mirror it into /
        icon = icon.transpose(Image.FLIP_LEFT_RIGHT)
        xs = -xs
        vx = -vx
    # Along the / axis, pointing to the top right.
    ux, uy = (vx, vy) if vx > 0 else (-vx, -vy)
    t = xs * ux + ys * uy
    span = max(1e-6, t.max() - t.min())
    low = np.sum(t < t.min() + span * 0.35)   # bottom-left end
    high = np.sum(t > t.max() - span * 0.35)  # top-right end
    heavy_low = low > high
    want_heavy_low = kind == 'sword'
    if heavy_low != want_heavy_low:
        icon = icon.transpose(Image.ROTATE_180)
    return icon


def main(folder):
    m = json.load(open(os.path.join(folder, 'weapons.json')))
    cols = m.get('thumbCols', 16)
    count = len(m['weapons'])
    out = Image.new('RGBA', (cols * CELL, ((count + cols - 1) // cols) * CELL))
    for w in m['weapons']:
        sheet = Image.open(os.path.join(folder, os.path.basename(w['file']))).convert('RGBA')
        icon = best_icon(w, sheet)
        if icon is None:
            print('no icon for', w['id'])
            continue
        icon = orient(w['kind'], icon)
        if max(icon.size) > CELL:
            k = CELL / max(icon.size)
            icon = icon.resize((max(1, round(icon.width * k)), max(1, round(icon.height * k))), Image.NEAREST)
        i = w['thumb']
        x, y = (i % cols) * CELL, (i // cols) * CELL
        out.alpha_composite(icon, (x + (CELL - icon.width) // 2, y + (CELL - icon.height) // 2))
    out.save(os.path.join(folder, 'thumbs.png'), optimize=True)
    m['thumbSize'] = CELL
    print('icons for', count, 'weapons')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'weapons'))
