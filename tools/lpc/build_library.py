#!/usr/bin/env python3
"""
The LPC library: tiles and props from LPC Revised (Eliza Wyatt and others, github.com/ElizaWy/LPC, OGA-BY 3.0),
for the editor's "LPC library" browser. Nothing is added to a project until you pick it there.

  <out>/library.json    every entry: name, group, kind (prop or tile), which sheet and where in it, size, credits
  <out>/s/*.png         the source sheets, copied unchanged (props are cut out of them in the editor)

Props are found automatically: each separate shape on a sheet (with its shadow) is one prop. Tiles are the plain
fill of the terrain sheets (grass, dirt, sand, water in each season) and repeating patches of floors and walls.

Usage:  python tools/lpc/build_library.py <path to the ElizaWy/LPC checkout> <out dir>
        (the game's copy lives in public/assets/lpc-library/)
"""
import json, os, re, sys, glob, shutil
from PIL import Image

REPO, OUT = sys.argv[1], sys.argv[2]
SEASONS = ['spring', 'summer', 'autumn', 'winter']
# Modern things a fantasy RPG won't want, and a pack whose source is a commercial store.
SKIP = re.compile(r'TV|Vending|Copy Machine|Fridge|Oven, Modern|Water Cooler|Laptop|Rotary Phone|Coffee Maker|Shopping Cart|'
                  r'Wheelchair|Graffiti|Posters|Desk, Office|Chair, Office|Hamburger|CutawayOverlay|Shadows|Overlays|Emission', re.I)
# Whole folders of surfaces (cut into repeating tiles, not props).
SURFACES = {'Structure/Floor': 'Floors', 'Structure/Walls': 'Walls'}
SURFACE_EXTRA = {'Structure/Roofing/Flat Shingle Roof A.png': 'Roofs', 'Terrain/tilled_soil.png': 'Terrain'}
# Prop groups by folder.
GROUP = [
    ('Terrain/trees_', 'Trees'), ('Terrain/plants_', 'Plants'), ('Terrain/wildflowers_', 'Flowers'),
    ('Terrain/flowers', 'Flowers'), ('Terrain/mushrooms', 'Plants'), ('Terrain/Rocks', 'Rocks'),
    ('Terrain/Waterfall', 'Water'), ('Terrain/ice-shallows', 'Water'),
    ('Objects/Furniture/Beds', 'Beds'), ('Objects/Furniture/Seating', 'Seating'), ('Objects/Furniture/Rugs', 'Rugs'),
    ('Objects/Furniture/Smithing', 'Smithing'), ('Objects/Furniture/Sewing', 'Crafts'), ('Objects/Furniture', 'Furniture'),
    ('Objects/Small Items/Food', 'Food'), ('Objects/Small Items/Ores', 'Ores'), ('Objects/Small Items/Fabric', 'Crafts'),
    ('Objects/Small Items', 'Small items'), ('Objects/Wall Items', 'Wall decor'),
    ('Structure/Doors', 'Doors'), ('Structure/Windows', 'Windows'), ('Structure/Fences', 'Fences'),
    ('Structure/Bridges', 'Bridges'), ('Structure/Stairs', 'Stairs'), ('Structure/Pillars', 'Pillars'),
    ('Structure/Signs', 'Signs'), ('Structure/Misc/Drain', 'Floor marks'), ('Structure/Misc/Pool', 'Floor marks'),
    ('Structure/Misc', 'Outdoor'), ('Structure/Platforms', 'Floor marks'), ('Structure/Wall Borders', 'Floor marks'),
    ('Structure/Structures', 'Buildings'), ('Structure/Roofing', 'Roofing'),
]
# Drawn lying flat (seen from above): they'd stand up wrong as props, which are upright in the 3D world.
FLAT = {'Rugs', 'Bridges', 'Stairs', 'Roofing', 'Floor marks'}
# Terrain fills: name -> (x, y, size) in pixels on terrain_<season>.png.
FILLS = {'Grass': (96, 32, 64), 'Dirt': (96, 96, 64), 'Sand': (96, 160, 32), 'Warm sand': (96, 192, 32),
         'Stream bed': (384, 512, 64), 'Pond water': (32, 352, 32), 'Lagoon': (32, 672, 32), 'Deep water': (32, 768, 32)}


# ------------------------------------------------------------------------------------------------ credits
def parse_credits(path):
    """Credits.txt → [{title, authors, licenses, urls}]"""
    out, cur = [], None
    lines = open(path, encoding='utf-8', errors='replace').read().splitlines()
    for i, line in enumerate(lines):
        if i + 1 < len(lines) and re.match(r'^-{5,}\s*$', lines[i + 1]) and line.strip():
            cur = {'title': line.strip(), 'authors': [], 'licenses': [], 'urls': []}
            out.append(cur)
            continue
        if not cur:
            continue
        m = re.match(r'\s*(ARTIST\(S\)|SOURCE|LICENSE):\s*(.*)', line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            if key.startswith('ARTIST'):
                cur['authors'] += [a.strip() for a in re.split(r',(?![^()]*\))', val) if a.strip()]
            elif key == 'SOURCE':
                cur['urls'].append(val)
            else:
                cur['licenses'].append(re.sub(r'(?i)oga-by', 'OGA-BY', val.split('(')[0].strip()))
    return out


def words(s):
    return set(w for w in re.findall(r'[a-z]+', s.lower()) if w not in {'a', 'b', 'c', 'd', 'the', 'and', 'all', 'seasons', 'png'})


credit_files = {}
for f in glob.glob(os.path.join(REPO, '**', 'Credits.txt'), recursive=True):
    if '/Characters/' in f or os.path.dirname(f) == REPO:
        continue
    credit_files[os.path.dirname(f)] = parse_credits(f)


def credit_for(path):
    """The Credits.txt entry for a sheet: in its folder or the nearest one above, the title sharing most words."""
    d = os.path.dirname(path)
    name = words(os.path.splitext(os.path.basename(path))[0])
    while d.startswith(REPO):
        best, score = None, 0
        for c in credit_files.get(d, []):
            s = len(name & words(c['title']))
            if s > score:
                best, score = c, s
        if best:
            return best
        d = os.path.dirname(d)
    return None


# ------------------------------------------------------------------------------------------------ cutting
def components(im, gap=1):
    """Bounding boxes of the separate shapes (alpha > 0), joining bits closer than `gap` pixels."""
    w, h = im.size
    a = im.getchannel('A').load()
    solid = [[a[x, y] > 8 for x in range(w)] for y in range(h)]
    seen = [[False] * w for _ in range(h)]
    boxes = []
    for y0 in range(h):
        for x0 in range(w):
            if not solid[y0][x0] or seen[y0][x0]:
                continue
            stack = [(x0, y0)]
            seen[y0][x0] = True
            x1 = x2 = x0; y1 = y2 = y0; n = 0
            while stack:
                x, y = stack.pop(); n += 1
                x1, x2, y1, y2 = min(x1, x), max(x2, x), min(y1, y), max(y2, y)
                for dy in range(-gap, gap + 1):
                    for dx in range(-gap, gap + 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and solid[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            boxes.append([x1, y1, x2 + 1, y2 + 1, n])
    return boxes


def merge_close(boxes, pad=2):
    """Merge boxes that overlap (with a little padding): a lamp's glow ring, a tree's loose leaves."""
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] - pad < b[2] and b[0] - pad < a[2] and a[1] - pad < b[3] and b[1] - pad < a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]), a[4] + b[4]]
                    del boxes[j]
                    changed = True
                    break
            if changed:
                break
    return boxes


def surface_tiles(im, limit=16):
    """32 px cells inside an opaque area that look like their neighbours: patches that repeat. One per colour."""
    w, h = im.size
    px = im.load()
    def cell_stats(cx, cy):
        r = g = b = n = 0
        for y in range(cy * 32, cy * 32 + 32, 2):
            for x in range(cx * 32, cx * 32 + 32, 2):
                p = px[x, y]
                if p[3] < 250:
                    return None
                r += p[0]; g += p[1]; b += p[2]; n += 1
        return (r / n, g / n, b / n)
    cols, rows = w // 32, h // 32
    stats = {(x, y): cell_stats(x, y) for y in range(rows) for x in range(cols)}
    picks, colours = [], []
    near = lambda n, c: n is not None and sum(abs(n[k] - c[k]) for k in range(3)) <= 24
    for y in range(rows):
        for x in range(cols):
            c = stats[(x, y)]
            if not c:
                continue
            # Repeats along a row or down a column (wood floors come in 1-tile strips).
            g = lambda dx, dy: stats.get((x + dx, y + dy))
            if not ((near(g(1, 0), c) and near(g(-1, 0), c)) or (near(g(0, 1), c) and near(g(0, -1), c))):
                continue
            if any(sum(abs(o[k] - c[k]) for k in range(3)) < 30 for o in colours):
                continue
            colours.append(c)
            picks.append((x * 32, y * 32, 32))
            if len(picks) >= limit:
                return picks
    return picks


# ------------------------------------------------------------------------------------------------ build
os.makedirs(os.path.join(OUT, 's'), exist_ok=True)
for old in glob.glob(os.path.join(OUT, 's', '*.png')):
    os.remove(old)
entries, sheets = [], {}


def slug(rel):
    return re.sub(r'[^a-z0-9]+', '_', os.path.splitext(rel)[0].lower()).strip('_')


def copy_sheet(path):
    rel = os.path.relpath(path, REPO)
    if rel not in sheets:
        name = slug(rel) + '.png'
        shutil.copyfile(path, os.path.join(OUT, 's', name))
        sheets[rel] = 's/' + name
    return sheets[rel]


def cred(path, label):
    c = credit_for(path)
    if not c:
        return [{'item': label, 'authors': ['Eliza Wyatt (DeathsDarling)'], 'licenses': ['OGA-BY 3.0'], 'urls': ['https://github.com/ElizaWy/LPC']}]
    lic = c['licenses'] or ['OGA-BY 3.0']
    if not all(l.upper().startswith(('OGA-BY', 'CC0')) for l in lic):
        return None
    return [{'item': c['title'], 'authors': c['authors'], 'licenses': lic, 'urls': c['urls'] + ['https://github.com/ElizaWy/LPC']}]


def nice(path):
    n = os.path.splitext(os.path.basename(path))[0]
    n = re.sub(r'_(spring|summer|autumn|winter)(_ice)?$', '', n).replace('_', ' ')
    return re.sub(r'\s+', ' ', n).strip().title() if n.islower() else re.sub(r'\s+', ' ', n).strip()


def season_of(path):
    m = re.search(r'_(spring|summer|autumn|winter)', os.path.basename(path))
    return m.group(1) if m else None


skipped = 0
# Terrain fills.
for season in SEASONS + ['winter_ice']:
    path = os.path.join(REPO, 'Terrain', f'terrain_{season}.png')
    if not os.path.exists(path):
        continue
    sheet = copy_sheet(path)
    c = cred(path, 'Terrain')
    for name, (x, y, s) in FILLS.items():
        if season == 'winter_ice' and name not in ('Pond water', 'Deep water', 'Lagoon', 'Stream bed'):
            continue
        label = name if season != 'winter' else {'Grass': 'Snow'}.get(name, name)
        entries.append({'kind': 'tile', 'group': 'Terrain', 'season': season.split('_')[0], 'name': f'{label} ({season.replace("_", " ")})',
                        'sheet': sheet, 'x': x, 'y': y, 'w': s, 'h': s, 'credits': c})

files = sorted(glob.glob(os.path.join(REPO, 'Terrain', '*.png')) + glob.glob(os.path.join(REPO, 'Objects', '**', '*.png'), recursive=True)
               + glob.glob(os.path.join(REPO, 'Structure', '**', '*.png'), recursive=True))
for path in files:
    rel = os.path.relpath(path, REPO)
    base = os.path.basename(path)
    if SKIP.search(base) or re.match(r'Terrain/(terrain_|cliff_)', rel):
        continue
    c = cred(path, nice(path))
    if c is None:
        print('not OGA-BY/CC0, skipped:', rel); skipped += 1
        continue
    im = Image.open(path).convert('RGBA')
    surface = next((g for k, g in SURFACES.items() if rel.startswith(k)), None) or SURFACE_EXTRA.get(rel)
    if surface:
        picks = surface_tiles(im)
        if not picks:
            continue
        sheet = copy_sheet(path)
        for i, (x, y, s) in enumerate(picks):
            entries.append({'kind': 'tile', 'group': surface, 'name': f'{nice(path)} {i + 1}' if len(picks) > 1 else nice(path),
                            'sheet': sheet, 'x': x, 'y': y, 'w': s, 'h': s, 'credits': c})
        continue
    group = next((g for k, g in GROUP if rel.startswith(k)), 'Other')
    if group in FLAT:
        continue
    boxes = [b for b in merge_close(components(im)) if b[4] >= 24 and (b[2] - b[0]) >= 6 and (b[3] - b[1]) >= 6]
    # Leave out drop shadows on their own (the engine casts real ones) and repeats of the same picture.
    kept, seen_px = [], set()
    for b in boxes:
        crop = im.crop(tuple(b[:4]))
        alphas = [p for p in crop.getchannel('A').tobytes() if p > 8]
        if alphas and sum(alphas) / len(alphas) < 170:
            continue
        if len(set(crop.getdata())) <= 4:  # one flat colour: a drop shadow
            continue
        key = crop.tobytes()
        if key in seen_px:
            continue
        seen_px.add(key)
        kept.append(b)
    boxes = kept
    # Doors are drawn opening, frame by frame: keep the closed ones (full width).
    if rel.startswith('Structure/Doors') and boxes:
        widest = max(b[2] - b[0] for b in boxes)
        boxes = [b for b in boxes if b[2] - b[0] >= widest * 0.8]
    if not boxes:
        continue
    sheet = copy_sheet(path)
    glow_path = os.path.splitext(path)[0] + ' - Emission.png'
    glow = copy_sheet(glow_path) if os.path.exists(glow_path) else None
    boxes.sort(key=lambda b: (b[1] // 16, b[0]))
    for i, (x1, y1, x2, y2, n) in enumerate(boxes):
        e = {'kind': 'prop', 'group': group, 'name': f'{nice(path)} {i + 1}' if len(boxes) > 1 else nice(path),
             'sheet': sheet, 'x': x1, 'y': y1, 'w': x2 - x1, 'h': y2 - y1, 'credits': c}
        if season_of(path):
            e['season'] = season_of(path)
        if glow:
            e['glow'] = glow
        entries.append(e)

for i, e in enumerate(entries):
    e['id'] = f'lpcr_{slug(e["name"])}'
ids = {}
for e in entries:
    n = ids.get(e['id'], 0)
    ids[e['id']] = n + 1
    if n:
        e['id'] += f'_{n + 1}'
json.dump({'version': 1, 'source': 'LPC Revised', 'url': 'https://github.com/ElizaWy/LPC', 'license': 'OGA-BY 3.0',
           'pixelsPerTile': 32, 'entries': entries}, open(os.path.join(OUT, 'library.json'), 'w'), indent=0)
kinds = {}
for e in entries:
    kinds[(e['kind'], e['group'])] = kinds.get((e['kind'], e['group']), 0) + 1
for k in sorted(kinds):
    print(f'{k[0]:5s} {k[1]:14s} {kinds[k]}')
print(len(entries), 'entries,', len(sheets), 'sheets,', skipped, 'skipped')
