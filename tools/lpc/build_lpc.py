#!/usr/bin/env python3
"""
Turns a checkout of the Universal LPC Spritesheet Character Generator into the Character Builder's library:

  out/catalog.json       every item: name, part, layers (z order + folder per body), animations, colours,
                         credits and whether it's Steam-safe (CC0 or OGA-BY among its licences)
  out/packs/pNNN.json    the PNGs as base64 data, a few MB per pack (each item's files stay together, loaded when needed)
  out/thumbs_N.png       a 64 × 64 preview of every item for every body (the builder's tiles)

Usage:  python tools/lpc/build_lpc.py <path to the LPC repo> <out dir>
Only facts are read from the repo's sheet_definitions and palette_definitions (paths, z order, palette colours,
credits); the sprite PNGs are copied unchanged. Nothing from the generator's code is used.
"""
import json, os, sys, glob, base64, re
from PIL import Image

REPO, OUT = sys.argv[1], sys.argv[2]
SHEETS = os.path.join(REPO, 'spritesheets')
FRAME = 64
BODIES = ['male', 'female', 'teen', 'child', 'muscular', 'pregnant']
# Animation folders the builder knows, with their frame counts and whether they have 4 directions.
ANIMS = {
    'walk': (9, 4), 'idle': (2, 4), 'run': (8, 4), 'jump': (5, 4), 'climb': (6, 1), 'combat_idle': (2, 4),
    'slash': (6, 4), 'backslash': (13, 4), 'halfslash': (6, 4), 'thrust': (8, 4), 'shoot': (13, 4),
    'spellcast': (7, 4), 'hurt': (6, 1), 'sit': (3, 4), 'emote': (3, 4),
}
# The definitions name some animations differently from their folders.
DEF_TO_FOLDER = {'combat': 'combat_idle', '1h_slash': 'backslash', '1h_backslash': 'backslash', '1h_halfslash': 'halfslash'}
SAFE_PREFIXES = ('CC0', 'OGA-BY')
PACK_LIMIT = 4_500_000
# Builder tabs, from the repo's top folders and part types.
TAB_OF_TOP = {'body': 'body', 'head': 'head', 'hair': 'hair', 'torso': 'torso', 'legs': 'legs', 'feet': 'feet',
              'arms': 'arms', 'headwear': 'headwear', 'weapons': 'weapons', 'tools': 'weapons'}
BACK_TYPES = {'cape', 'cape_trim', 'wings', 'wings_dots', 'wings_edge', 'backpack', 'backpack_straps', 'quiver', 'tail'}


def safe(licenses):
    return any(l.strip().startswith(SAFE_PREFIXES) for l in licenses)


# ---------------------------------------------------------------------------------------------------- palettes
palettes = {}      # material -> {version -> {name -> [colours]}}
materials = {}     # material -> {label, base, default}
for meta in glob.glob(os.path.join(REPO, 'palette_definitions', '*', 'meta_*.json')):
    m = json.load(open(meta))
    mat = os.path.basename(os.path.dirname(meta))
    materials[mat] = {'label': m.get('label', mat), 'base': m.get('base'), 'default': m.get('default', 'ulpc')}
for f in glob.glob(os.path.join(REPO, 'palette_definitions', '*', '*.json')):
    if os.path.basename(f).startswith('meta_'):
        continue
    mat = os.path.basename(os.path.dirname(f))
    version = os.path.basename(f)[:-5].split('_', 1)[1]  # body_ulpc.json -> ulpc
    palettes.setdefault(mat, {})[version] = {k: [c.lower() for c in v] for k, v in json.load(open(f)).items()}


def source_colours(mat, base):
    """The colours an item is drawn in (its material's base palette, or the item's own base)."""
    m = materials.get(mat, {})
    name = base or m.get('base')
    for version in [m.get('default', 'ulpc'), 'ulpc', 'lpcr']:
        p = palettes.get(mat, {}).get(version, {})
        if name in p:
            return p[name]
    return None


def colour_channel(spec, label):
    mat = spec.get('material')
    src = [c.lower() for c in spec['source']] if spec.get('source') else source_colours(mat, spec.get('base'))
    versions = []
    for v in spec.get('palettes', []):
        if v.startswith('all.'):
            versions.append(['all', v.split('.', 1)[1]])
        else:
            versions.append([mat, v])
    return {'label': spec.get('label', label), 'type': spec.get('type_name'), 'material': mat, 'source': src, 'palettes': versions}


# ------------------------------------------------------------------------------------------------------- items
items = []
for f in sorted(glob.glob(os.path.join(REPO, 'sheet_definitions', '**', '*.json'), recursive=True)):
    if os.path.basename(f).startswith('meta_'):
        continue
    d = json.load(open(f))
    rel = os.path.relpath(f, os.path.join(REPO, 'sheet_definitions'))
    top = rel.split(os.sep)[0]
    item_id = os.path.splitext(os.path.basename(f))[0]
    layers = []
    for k in sorted([k for k in d if k.startswith('layer_')], key=lambda s: int(s.split('_')[1])):
        L = d[k]
        if L.get('custom_animation'):
            continue  # oversized weapon frames: not supported yet
        paths = {b: re.sub('/+', '/', L[b]) for b in BODIES if isinstance(L.get(b), str)}
        if paths:
            layers.append({'z': L.get('zPos', 0), 'paths': paths})
    if not layers:
        continue
    variants = d.get('variants')
    def anim_files(folder, anim):
        if variants:
            return [f'{folder}{anim}/{v.replace(" ", "_")}.png' for v in variants]
        return [f'{folder}{anim}.png']
    # Which animations exist, per body (checked on disk: definitions aren't always complete).
    anims = {}
    for b in BODIES:
        if not all(b in L['paths'] for L in layers[:1]):
            continue
        have = []
        for a in ANIMS:
            folder = layers[0]['paths'][b]
            if '${' in folder:
                folder = re.sub(r'\$\{[a-z_]+\}', next(iter((d.get('replace_in_path') or {}).get('head', {}).values()), 'male'), folder)
            if any(os.path.exists(os.path.join(SHEETS, p)) for p in anim_files(folder, a)):
                have.append(a)
        if have:
            anims[b] = have
    if not anims:
        continue
    rec = d.get('recolors')
    colours = None
    if isinstance(rec, dict) and 'material' in rec:
        colours = [colour_channel(rec, 'Colour')]
    elif isinstance(rec, dict):
        colours = [colour_channel(rec[k], 'Colour' if k == 'color_1' else k.replace('_', ' ').title()) for k in sorted(rec)]
    credits = [{'file': c.get('file', ''), 'authors': c.get('authors', []), 'licenses': c.get('licenses', []),
                'urls': c.get('urls', []), 'notes': c.get('notes', '')} for c in d.get('credits', [])]
    tab = TAB_OF_TOP.get(top, top)
    if d['type_name'] in BACK_TYPES:
        tab = 'back'
    if top == 'hair' and d['type_name'] in ('beard', 'mustache'):
        tab = 'face'
    if top == 'head' and d['type_name'] not in ('head',):
        tab = 'face'
    items.append({
        'id': item_id, 'name': d['name'], 'type': d['type_name'], 'tab': tab, 'priority': d.get('priority'),
        'layers': layers, 'anims': anims, 'variants': variants, 'colours': colours,
        'matchBody': bool(d.get('match_body_color')), 'tags': d.get('tags', []), 'requires': d.get('required_tags', []),
        'replace': d.get('replace_in_path'), 'credits': credits, 'safe': all(safe(c['licenses']) for c in credits) if credits else False,
        '_files': None,
    })

# Files for each item (all bodies, all supported animations, all variants).
def item_files(it):
    out = set()
    for L in it['layers']:
        for b, folder in L['paths'].items():
            folders = [folder]
            if '${' in folder:
                folders = sorted({re.sub(r'\$\{head\}', v, folder) for v in (it['replace'] or {}).get('head', {}).values()})
            for fo in folders:
                for a in ANIMS:
                    names = [f'{fo}{a}/{v.replace(" ", "_")}.png' for v in it['variants']] if it['variants'] else [f'{fo}{a}.png']
                    for n in names:
                        if os.path.exists(os.path.join(SHEETS, n)):
                            out.add(n)
    return sorted(out)

# ------------------------------------------------------------------------------------------------------- packs
os.makedirs(os.path.join(OUT, 'packs'), exist_ok=True)
for old in glob.glob(os.path.join(OUT, 'packs', '*')):
    os.remove(old)
packs, cur, cur_size = [], [], 0
def flush():
    global cur, cur_size
    if not cur:
        return
    name = f'p{len(packs):03d}.json'
    data = {n: base64.b64encode(open(os.path.join(SHEETS, n), 'rb').read()).decode('ascii') for n in sorted(set(cur))}
    with open(os.path.join(OUT, 'packs', name), 'w') as fh:
        json.dump({'files': data}, fh, separators=(',', ':'))
    packs.append(name)
    cur, cur_size = [], 0

# Keep each tab's items together so opening a tab loads few packs.
order = sorted(range(len(items)), key=lambda i: (items[i]['tab'], items[i]['type'], items[i]['name']))
total = 0
for i in order:
    it = items[i]
    files = [n for n in item_files(it) if n not in cur]
    size = sum(os.path.getsize(os.path.join(SHEETS, n)) for n in files)
    total += size
    if cur and cur_size + size > PACK_LIMIT:
        flush()
    it['pack'] = len(packs)
    cur.extend(files); cur_size += size
flush()

# -------------------------------------------------------------------------------------------------- thumbnails
def frame_of(path, row, col=0):
    full = os.path.join(SHEETS, path)
    if not os.path.exists(full):
        return None
    im = Image.open(full).convert('RGBA')
    y = row * FRAME if im.height >= (row + 1) * FRAME else 0
    return im.crop((col * FRAME, y, col * FRAME + FRAME, y + FRAME))

thumb_cells = {}   # key (paths tuple, variant) -> cell index
cells = []
for it in items:
    it['thumbs'] = {}
    row = 0 if it['type'] in BACK_TYPES else 2  # facing up for capes and wings, down otherwise
    for b in it['anims']:
        anim = 'walk' if 'walk' in it['anims'][b] else it['anims'][b][0]
        nrow = row if ANIMS[anim][1] == 4 else 0
        v = it['variants'][0].replace(' ', '_') if it['variants'] else None
        key = (tuple(L['paths'].get(b, '') for L in it['layers']), v, anim, nrow)
        if key not in thumb_cells:
            img = Image.new('RGBA', (FRAME, FRAME))
            for L in sorted(it['layers'], key=lambda L: L['z']):
                folder = L['paths'].get(b)
                if not folder:
                    continue
                if '${' in folder:
                    folder = folder.replace('${head}', next(iter((it['replace'] or {}).get('head', {}).values()), 'male'))
                p = f'{folder}{anim}/{v}.png' if v else f'{folder}{anim}.png'
                fr = frame_of(p, nrow)
                if fr:
                    img.alpha_composite(fr)
            thumb_cells[key] = len(cells)
            cells.append(img)
        it['thumbs'][b] = thumb_cells[key]

COLS, PER_SHEET = 64, 64 * 64
sheets = []
for s in range(0, len(cells), PER_SHEET):
    chunk = cells[s:s + PER_SHEET]
    rows = (len(chunk) + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * FRAME, rows * FRAME))
    for i, c in enumerate(chunk):
        atlas.paste(c, ((i % COLS) * FRAME, (i // COLS) * FRAME))
    name = f'thumbs_{len(sheets)}.png'
    atlas.save(os.path.join(OUT, name), optimize=True)
    sheets.append(name)

# Steam-safe per body: the credits for that body's folders (muscular and pregnant bases differ from the rest).
for it in items:
    it.pop('_files', None)
    it['safeBy'] = {}
    for b in it['anims']:
        folders = [L['paths'][b].split('${')[0] for L in it['layers'] if b in L['paths']]
        entries = [c for c in it['credits'] if any(f.startswith(c['file']) or c['file'].startswith(f.rstrip('/')) for f in folders)] or it['credits']
        it['safeBy'][b] = bool(entries) and all(safe(c['licenses']) for c in entries)
catalog = {
    'version': 1, 'frame': FRAME, 'bodies': BODIES,
    'anims': {k: {'frames': v[0], 'dirs': v[1]} for k, v in ANIMS.items()},
    'materials': materials, 'palettes': palettes,
    'packs': packs, 'thumbs': {'sheets': sheets, 'cols': COLS, 'perSheet': PER_SHEET},
    'items': items,
}
json.dump(catalog, open(os.path.join(OUT, 'catalog.json'), 'w'), separators=(',', ':'))
print(f'{len(items)} items, {sum(1 for i in items if i["safe"])} Steam-safe, {len(packs)} packs, {total / 1e6:.1f} MB of sprites, {len(cells)} thumbnails')
