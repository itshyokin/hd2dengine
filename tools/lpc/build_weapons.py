#!/usr/bin/env python3
"""
LPC weapons for the game: each Steam-safe weapon (CC0 or OGA-BY among its licences) in each colour becomes one PNG
sheet the game draws over a character, in step with the character's own animation.

  <out>/<id>.png        the weapon's frames: a "back" layer (drawn behind the body) and a "front" layer
  <out>/weapons.json    every weapon: name, kind, file, layout (per layer: animation -> where its frames are and how
                        big; big swings use 128 or 192 px frames centred on the body), credits
  <out>/thumbs.png      a 64 x 64 preview of each weapon (index in weapons.json)

Usage:  python tools/lpc/build_weapons.py <path to the LPC generator repo> <out dir>
        (the game's copy lives in public/assets/weapons/)
Only facts are read from the repo's sheet_definitions (paths, z order, credits); the PNGs are copied, recomposed.
"""
import json, os, re, sys, glob
from PIL import Image

REPO, OUT = sys.argv[1], sys.argv[2]
SHEETS = os.path.join(REPO, 'spritesheets')
SAFE_PREFIXES = ('CC0', 'OGA-BY')
# Body z order is 10: lower is drawn behind the character.
BODY_Z = 10
# Folder names of the standard (64 px) animations, as the game calls them.
ANIM_FOLDERS = {'walk', 'idle', 'run', 'jump', 'climb', 'combat_idle', 'slash', 'backslash', 'halfslash', 'thrust',
                'shoot', 'spellcast', 'hurt', 'sit', 'emote'}
FOLDER_ALIAS = {'combat': 'combat_idle'}
# Bigger frames for the attacks, and which body animation each one follows.
CUSTOM = {
    'slash_128': ('slash', 128), 'backslash_128': ('backslash', 128), 'halfslash_128': ('halfslash', 128),
    'thrust_128': ('thrust', 128), 'walk_128': ('walk', 128),
    'slash_oversize': ('slash', 192), 'thrust_oversize': ('thrust', 192),
    'slash_reverse_oversize': ('slash_reverse', 192),
}
# What to take, and what each is in the game.
WEAPONS = {
    'weapon_sword_dagger': 'sword', 'weapon_sword_arming': 'sword', 'weapon_sword_longsword': 'sword',
    'weapon_sword_longsword_alt': 'sword', 'weapon_sword_rapier': 'sword', 'weapon_sword_katana': 'sword',
    'weapon_sword_scimitar': 'sword', 'weapon_sword_glowsword': 'sword',
    'weapon_blunt_mace': 'blunt', 'weapon_blunt_club': 'blunt',
    'weapon_magic_simple': 'staff', 'weapon_magic_crystal': 'staff', 'weapon_magic_diamond': 'staff',
    'weapon_magic_gnarled': 'staff', 'weapon_magic_loop': 'staff', 'weapon_magic_s': 'staff', 'weapon_magic_wand': 'staff',
    'weapon_ranged_bow_normal': 'bow',
    'shield_round': 'shield', 'shield_spartan': 'shield', 'shield_crusader': 'shield', 'shield_plus': 'shield',
    'shield_two_engrailed': 'shield', 'shield_scutum': 'shield',
}
# Layers borrowed from another definition (the arrow drawn on the bow while shooting).
EXTRA = {'weapon_ranged_bow_normal': ['weapon_ranged_bow_arrow']}


def safe(licenses):
    return any(l.strip().startswith(SAFE_PREFIXES) for l in licenses)


defs = {}
for f in glob.glob(os.path.join(REPO, 'sheet_definitions', 'weapons', '**', '*.json'), recursive=True):
    defs[os.path.splitext(os.path.basename(f))[0]] = json.load(open(f))


def layers_of(d):
    out = []
    for k in sorted([k for k in d if k.startswith('layer_')], key=lambda s: int(s.split('_')[1])):
        L = d[k]
        path = next((L[b] for b in ('male', 'female', 'teen', 'muscular') if isinstance(L.get(b), str)), None)
        if path:
            out.append({'z': L.get('zPos', 0), 'path': re.sub('/+', '/', path), 'custom': L.get('custom_animation')})
    return out


def sources(layer, variant, own_variants):
    """(anim name, frame size, image) for every animation a layer has in this colour."""
    folder = os.path.join(SHEETS, layer['path'])
    v = variant.replace(' ', '_')
    def pick(base):
        for name in ([v] if own_variants else []) + [os.path.basename(os.path.normpath(folder))]:
            p = os.path.join(base, name + '.png')
            if os.path.exists(p):
                return p
        pngs = sorted(glob.glob(os.path.join(base, '*.png')))
        return pngs[0] if len(pngs) == 1 else None
    if layer['custom']:
        if layer['custom'] not in CUSTOM:
            return []
        anim, size = CUSTOM[layer['custom']]
        p = pick(folder)
        return [(anim, size, Image.open(p).convert('RGBA'))] if p else []
    out = []
    if not os.path.isdir(folder):
        return out
    for sub in sorted(os.listdir(folder)):
        anim = FOLDER_ALIAS.get(sub, sub)
        if anim in ANIM_FOLDERS and os.path.isdir(os.path.join(folder, sub)):
            p = pick(os.path.join(folder, sub))
            if p:
                out.append((anim, 64, Image.open(p).convert('RGBA')))
    return out


def build(def_id, kind, variant, d, own_variants):
    """One weapon in one colour: {layer: {anim: (size, image)}} composited in z order."""
    layers = layers_of(d)
    for extra in EXTRA.get(def_id, []):
        layers += [dict(L, extra=True) for L in layers_of(defs[extra])]
    parts = {'back': {}, 'front': {}}
    for L in sorted(layers, key=lambda L: L['z']):
        side = 'back' if L['z'] < BODY_Z else 'front'
        for anim, size, im in sources(L, variant if not L.get('extra') else 'arrow', own_variants and not L.get('extra')):
            dirs = 1 if im.height <= size else 4
            frames = im.width // size
            have = parts[side].get(anim)
            if not have:
                parts[side][anim] = (size, im.copy(), frames, dirs)
                continue
            s0, im0, f0, d0 = have
            # Mixed frame sizes: grow the smaller into the bigger frames (centred on the body).
            if s0 < size:
                im0, s0 = grow(im0, s0, size, f0, d0), size
            elif size < s0:
                im, size = grow(im, size, s0, frames, dirs), s0
            w, h = max(im0.width, im.width), max(im0.height, im.height)
            base = Image.new('RGBA', (w, h)); base.alpha_composite(im0); base.alpha_composite(im)
            parts[side][anim] = (s0, base, max(f0, frames), max(d0, dirs))
    return parts


def grow(im, small, big, frames, dirs):
    out = Image.new('RGBA', (frames * big, dirs * big))
    off = (big - small) // 2
    for r in range(dirs):
        for c in range(frames):
            out.alpha_composite(im.crop((c * small, r * small, (c + 1) * small, (r + 1) * small)), (c * big + off, r * big + off))
    return out


def pack(parts):
    """Stack every animation's block in one image; returns (image, layout)."""
    blocks = []
    for side in ('back', 'front'):
        for anim, (size, im, frames, dirs) in sorted(parts[side].items()):
            if im.getbbox() is None:
                continue
            blocks.append((side, anim, size, im.crop((0, 0, frames * size, dirs * size)), frames, dirs))
    width = max(b[3].width for b in blocks)
    height = sum(b[3].height for b in blocks)
    sheet = Image.new('RGBA', (width, height))
    layout = {'back': {}, 'front': {}}
    y = 0
    for side, anim, size, im, frames, dirs in blocks:
        sheet.alpha_composite(im, (0, y))
        layout[side][anim] = {'y': y, 'frame': size, 'frames': frames, 'dirs': dirs}
        y += im.height
    return sheet, layout


def thumb(parts):
    """The weapon held, facing down (walk, first frame), or its first frame of anything."""
    t = Image.new('RGBA', (64, 64))
    for side in ('back', 'front'):
        p = parts[side]
        anim = 'walk' if 'walk' in p else ('shoot' if 'shoot' in p else next(iter(p), None))
        if not anim:
            continue
        size, im, frames, dirs = p[anim]
        row = 2 if dirs == 4 else 0
        col = 0
        cell = im.crop((col * size, row * size, (col + 1) * size, (row + 1) * size))
        off = (size - 64) // 2
        t.alpha_composite(cell.crop((off, off, off + 64, off + 64)))
    bb = t.getbbox()
    if bb:
        # Zoom in on the weapon for the picker.
        x0, y0, x1, y1 = bb
        s = max(x1 - x0, y1 - y0, 24)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        t = t.crop((cx - s // 2, cy - s // 2, cx - s // 2 + s, cy - s // 2 + s)).resize((64, 64), Image.NEAREST)
    return t


os.makedirs(OUT, exist_ok=True)
for old in glob.glob(os.path.join(OUT, '*.png')):
    os.remove(old)
entries, thumbs = [], []
for def_id, kind in WEAPONS.items():
    d = defs[def_id]
    credits = [{'item': d['name'], 'authors': c.get('authors', []), 'licenses': c.get('licenses', []), 'urls': c.get('urls', [])}
               for c in d.get('credits', [])]
    for extra in EXTRA.get(def_id, []):
        credits += [{'item': defs[extra]['name'], 'authors': c.get('authors', []), 'licenses': c.get('licenses', []), 'urls': c.get('urls', [])}
                    for c in defs[extra].get('credits', [])]
    if not credits or not all(safe(c['licenses']) for c in credits):
        print('skip (not Steam-safe):', def_id)
        continue
    variants = d.get('variants') or [d['name'].lower()]
    if kind in ('staff', 'bow'):
        variants = variants[:4]  # wood shades are enough; the metal tints mostly repeat the swords'
    own = bool(d.get('variants'))
    for v in variants:
        parts = build(def_id, kind, v, d, own)
        if not parts['front'] and not parts['back']:
            print('nothing for', def_id, v)
            continue
        sheet, layout = pack(parts)
        short = re.sub(r'^(sword|blunt|ranged)_', '', re.sub(r'^weapon_', '', def_id)).replace('magic_', 'staff_')
        wid = short if len(variants) == 1 else f'{short}_{v.replace(" ", "_")}'
        sheet.save(os.path.join(OUT, wid + '.png'), optimize=True)
        anims = sorted(set(layout['front']) | set(layout['back']))
        name = d['name'] + ('' if len(variants) == 1 else f' ({v})')
        entries.append({'id': wid, 'name': name, 'kind': kind, 'file': f'assets/weapons/{wid}.png',
                        'width': sheet.width, 'height': sheet.height, 'layers': layout, 'anims': anims,
                        'thumb': len(thumbs), 'credits': credits})
        thumbs.append(thumb(parts))
        print(f'{wid:34s} {sheet.width}x{sheet.height}  {", ".join(anims)}')

cols = 16
atlas = Image.new('RGBA', (cols * 64, ((len(thumbs) + cols - 1) // cols) * 64))
for i, t in enumerate(thumbs):
    atlas.alpha_composite(t, ((i % cols) * 64, (i // cols) * 64))
atlas.save(os.path.join(OUT, 'thumbs.png'), optimize=True)
json.dump({'version': 1, 'thumbSize': 64, 'thumbCols': cols, 'weapons': entries}, open(os.path.join(OUT, 'weapons.json'), 'w'), indent=1)
print(len(entries), 'weapons')

# Icons cut from the sheets (better than the walking-frame previews above): see weapon_icons.py.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import weapon_icons  # noqa: E402
weapon_icons.main(OUT)
