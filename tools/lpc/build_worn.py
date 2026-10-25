#!/usr/bin/env python3
"""
Built-in clothing (Update 128): ready-made clothes-only sheets from the Character Builder's parts library, for
masculine (LPC "male") and feminine (LPC "female") bodies, shipped with the engine in public/assets/worn/builtin/.

  python tools/lpc/build_worn.py            (reads tools/lpc/library, writes public/assets/worn/builtin/)

Each part gets <id>_masc.png and <id>_femme.png (layers drawn over the hero's own sheet) and, when the part has
pieces behind the body (a cape's back), <id>_masc_under.png / <id>_femme_under.png. parts.json lists every part:
its slot (top / bottom / accessory), name, the sheets' animation layout, the colour channel the game can recolour
(its source colours and a set of palette swatches), and the art's credits. Only Steam-safe parts (CC0 / OGA-BY).
"""
import base64, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB = os.path.join(ROOT, 'tools', 'lpc', 'library')
OUT = os.environ.get('WORN_OUT') or os.path.join(ROOT, 'public', 'assets', 'worn', 'builtin')
F = 64
BODIES = {'masc': 'male', 'femme': 'female'}
ANIMS = ['walk', 'idle', 'run', 'jump', 'climb', 'combat_idle', 'slash', 'backslash', 'halfslash', 'thrust', 'shoot', 'spellcast', 'hurt', 'sit', 'emote']
PLAY = {
    'walk': ([1, 2, 3, 4, 5, 6, 7, 8], 100), 'idle': ([0, 0, 1], 380), 'run': ([0, 1, 2, 3, 4, 5, 6, 7], 80),
    'jump': ([0, 1, 2, 3, 4, 1], 120), 'climb': ([0, 1, 2, 3, 4, 5], 120), 'combat_idle': ([0, 0, 1], 300),
    'slash': ([0, 1, 2, 3, 4, 5], 80), 'backslash': ([0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12], 70), 'halfslash': ([0, 1, 2, 3, 4, 5], 80),
    'thrust': ([0, 1, 2, 3, 4, 5, 6, 7], 80), 'shoot': (list(range(13)), 70), 'spellcast': ([0, 1, 2, 3, 4, 5, 6], 90),
    'hurt': ([0, 1, 2, 3, 4, 5], 110), 'sit': ([0, 1, 2], 600), 'emote': ([0, 1, 2], 600),
}
# The body is drawn at z 10: lower layers go under the hero's sheet.
BODY_Z = 10

# (slot, catalog id, display name, variant when the part has variants)
PARTS = [
    ('top', 'torso_clothes_longsleeve', 'Longsleeve shirt', None),
    ('top', 'torso_clothes_longsleeve2_buttoned', 'Buttoned shirt', None),
    ('top', 'torso_clothes_longsleeve2_cardigan', 'Cardigan', None),
    ('top', 'torso_clothes_shortsleeve', 'Shortsleeve shirt', None),
    ('top', 'torso_clothes_shortsleeve_polo', 'Polo shirt', None),
    ('top', 'torso_clothes_tshirt_vneck', 'V-neck tee', None),
    ('top', 'torso_clothes_sleeveless2', 'Sleeveless top', None),
    ('top', 'torso_armour_leather', 'Leather armour', None),
    ('top', 'torso_chainmail', 'Chainmail', None),
    ('top', 'torso_armour_plate', 'Plate armour', None),
    ('bottom', 'legs_pants', 'Pants', None),
    ('bottom', 'legs_pants2', 'Long pants', None),
    ('bottom', 'legs_cuffed', 'Cuffed pants', None),
    ('bottom', 'legs_formal', 'Formal pants', None),
    ('bottom', 'legs_shorts', 'Shorts', None),
    ('bottom', 'legs_leggings', 'Leggings', None),
    ('bottom', 'legs_pantaloons', 'Pantaloons', None),
    ('bottom', 'legs_skirts_plain', 'Plain skirt', None),
    ('bottom', 'legs_skirts_slit', 'Slit skirt', None),
    ('bottom', 'legs_armour', 'Armoured greaves', None),
    ('accessory', 'neck_necklace_beaded_small', 'Beaded necklace', None),
    ('accessory', 'neck_necklace_beaded_large', 'Large beaded necklace', None),
    ('accessory', 'neck_necklace_chain', 'Chain necklace', 'brass'),
    ('accessory', 'facial_earrings_stud', 'Stud earrings', 'brass'),
    ('accessory', 'cape_solid', 'Cape', None),
    ('accessory', 'cape_tattered', 'Tattered cape', None),
    ('accessory', 'hat_hood_cloth', 'Hood', None),
    ('accessory', 'hat_bandana', 'Bandana', None),
    ('accessory', 'arms_gloves', 'Gloves', None),
    ('accessory', 'neck_cravat', 'Cravat', None),
]
SWATCHES = 12


def main():
    cat = json.load(open(os.path.join(LIB, 'catalog.json')))
    by = {i['id']: i for i in cat['items']}
    packs = {}

    def pack(i):
        if i not in packs:
            packs[i] = json.load(open(os.path.join(LIB, 'packs', cat['packs'][i])))['files']
        return packs[i]

    def image(it, path):
        b = pack(it['pack']).get(path)
        return Image.open(io.BytesIO(base64.b64decode(b))).convert('RGBA') if b else None

    os.makedirs(OUT, exist_ok=True)
    out = []
    for slot, pid, name, variant in PARTS:
        it = by.get(pid)
        if not it:
            print('missing', pid, file=sys.stderr)
            continue
        entry = {'id': pid, 'slot': slot, 'name': name, 'sheets': {}, 'under': {}, 'layout': {}}
        for body, lb in BODIES.items():
            if not it['anims'].get(lb):
                continue
            safe = (it.get('safeBy') or {}).get(lb, it.get('safe'))
            if not safe:
                print('not steam-safe', pid, lb, file=sys.stderr)
                continue
            anims = [a for a in ANIMS if a in it['anims'][lb] and a in cat['anims']]
            height = sum(cat['anims'][a]['dirs'] for a in anims) * F
            width = max(cat['anims'][a]['frames'] for a in anims) * F
            over, under = Image.new('RGBA', (width, height)), Image.new('RGBA', (width, height))
            any_under = False
            layout, y = {}, 0
            for a in anims:
                info = cat['anims'][a]
                for L in sorted(it['layers'], key=lambda l: l['z']):
                    folder = L['paths'].get(lb)
                    if not folder or '${' in folder:
                        continue
                    v = (variant or (it['variants'] or [None])[0]) if it['variants'] else None
                    path = f"{folder}{a}/{v.replace(' ', '_')}.png" if v else f"{folder}{a}.png"
                    img = image(it, path)
                    if img is None:
                        continue
                    if L['z'] < BODY_Z:
                        under.alpha_composite(img, (0, y)); any_under = True
                    else:
                        over.alpha_composite(img, (0, y))
                cyc, ms = PLAY[a]
                layout[a] = {'row': y // F, 'frames': info['frames'], 'dirs': info['dirs'], 'cycle': cyc, 'ms': ms}
                y += info['dirs'] * F
            over.save(os.path.join(OUT, f'{pid}_{body}.png'), optimize=True)
            entry['sheets'][body] = f'assets/worn/builtin/{pid}_{body}.png'
            if any_under:
                under.save(os.path.join(OUT, f'{pid}_{body}_under.png'), optimize=True)
                entry['under'][body] = f'assets/worn/builtin/{pid}_{body}_under.png'
            entry['layout'][body] = {'frame': F, 'dirs': ['up', 'left', 'down', 'right'], 'anims': layout}
        if not entry['under']:
            del entry['under']
        # The first colour channel can be recoloured in the game: its source colours and some palettes.
        ch = next((c for c in (it.get('colours') or []) if c.get('source')), None)
        if ch:
            seen, sw = set(), []
            for mat, ver in ch['palettes']:
                for pname, cols in cat['palettes'].get(mat, {}).get(ver, {}).items():
                    if len(cols) != len(ch['source']) or ','.join(cols) in seen:
                        continue
                    seen.add(','.join(cols))
                    sw.append({'name': pname, 'cols': cols})
            # An even spread of the palettes (the list runs light to dark within each family).
            step = max(1, len(sw) // SWATCHES)
            entry['recolor'] = {'source': ch['source'], 'swatches': sw[::step][:SWATCHES]}
        folders = {(l['paths'].get('male') or '').split('${')[0] for l in it['layers']} | {(l['paths'].get('female') or '').split('${')[0] for l in it['layers']}
        creds = [c for c in it['credits'] if any(f.startswith(c['file']) or c['file'].startswith(f.rstrip('/')) for f in folders if f)] or it['credits']
        entry['credits'] = [{'item': name, 'authors': c['authors'], 'licenses': c['licenses'], 'urls': c['urls']} for c in creds]
        if entry['sheets']:
            out.append(entry)
        print(pid, list(entry['sheets']), 'under' if entry.get('under') else '', file=sys.stderr)
    json.dump({'version': 1, 'parts': out}, open(os.path.join(OUT, 'parts.json'), 'w'), indent=1)
    print(f'{len(out)} parts', file=sys.stderr)


if __name__ == '__main__':
    main()
