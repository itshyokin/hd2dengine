// ---------------------------------------------------------------------------------------------------------------
// The LPC library: catalog, packs (PNGs as base64 data, loaded when needed), palette recolouring and compositing.
// Sheets use LPC's layout: 64 × 64 frames, each animation a strip with 4 rows (facing up, left, down, right) or
// 1 row (hurt, climb).
// ---------------------------------------------------------------------------------------------------------------

const F = 64;
const DIRS = ['up', 'left', 'down', 'right'];
const ANIM_ORDER = ['walk', 'idle', 'run', 'jump', 'climb', 'combat_idle', 'slash', 'backslash', 'halfslash', 'thrust', 'shoot', 'spellcast', 'hurt', 'sit', 'emote'];
const ANIM_LABEL = { walk: 'Walk', idle: 'Idle', run: 'Run', jump: 'Jump', climb: 'Climb', combat_idle: 'Combat stance', slash: 'Slash', backslash: 'Backslash', halfslash: 'Half slash', thrust: 'Thrust', shoot: 'Shoot', spellcast: 'Cast', hurt: 'Hurt', sit: 'Sit', emote: 'Emote' };
// How each animation plays (frame order and speed), for the preview and the engine.
const ANIM_PLAY = {
  walk: { cycle: [1, 2, 3, 4, 5, 6, 7, 8], ms: 100 }, idle: { cycle: [0, 0, 1], ms: 380 }, run: { cycle: [0, 1, 2, 3, 4, 5, 6, 7], ms: 80 },
  jump: { cycle: [0, 1, 2, 3, 4, 1], ms: 120 }, climb: { cycle: [0, 1, 2, 3, 4, 5], ms: 120 }, combat_idle: { cycle: [0, 0, 1], ms: 300 },
  slash: { cycle: [0, 1, 2, 3, 4, 5], ms: 80 }, backslash: { cycle: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12], ms: 70 }, halfslash: { cycle: [0, 1, 2, 3, 4, 5], ms: 80 },
  thrust: { cycle: [0, 1, 2, 3, 4, 5, 6, 7], ms: 80 }, shoot: { cycle: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ms: 70 },
  spellcast: { cycle: [0, 1, 2, 3, 4, 5, 6], ms: 90 }, hurt: { cycle: [0, 1, 2, 3, 4, 5], ms: 110 }, sit: { cycle: [0, 1, 2], ms: 600 }, emote: { cycle: [0, 1, 2], ms: 600 },
};
// Animation sets the export can include (walk and idle always).
const ANIM_SETS = {
  base: { label: 'Walk & idle', anims: ['walk', 'idle'], always: true },
  move: { label: 'Run, jump, climb', anims: ['run', 'jump', 'climb'] },
  combat: { label: 'Combat', anims: ['combat_idle', 'slash', 'backslash', 'halfslash', 'thrust', 'shoot', 'spellcast', 'hurt'] },
  extra: { label: 'Sit & emote', anims: ['sit', 'emote'] },
};

const Lib = {
  cat: null,
  byId: new Map(),
  packs: new Map(),      // index -> Promise<Map<name, entry>>
  images: new Map(),     // path -> Promise<ImageBitmap|HTMLImageElement|null>
  thumbs: [],            // atlas images
  base: './',

  async load(base = './') {
    this.base = base;
    const res = await fetch(base + 'catalog.json');
    if (!res.ok) throw new Error('The character library didn’t load (' + res.status + ')');
    this.cat = await res.json();
    for (const it of this.cat.items) this.byId.set(it.id, it);
    this.thumbs = await Promise.all(this.cat.thumbs.sheets.map((s) => loadImg(base + s)));
    return this.cat;
  },

  pack(i) {
    let p = this.packs.get(i);
    if (!p) {
      p = (async () => {
        const url = this.base + 'packs/' + this.cat.packs[i];
        let res = null;
        try { const c = await caches.open('lpc-packs-v1'); res = await c.match(url); } catch { /* no cache here */ }
        if (!res) {
          res = await fetch(url);
          if (!res.ok) throw new Error('A part of the library didn’t load (' + res.status + ')');
          try { const c = await caches.open('lpc-packs-v1'); await c.put(url, res.clone()); } catch { /* fine */ }
        }
        return new Map(Object.entries((await res.json()).files));
      })();
      p.catch(() => this.packs.delete(i));
      this.packs.set(i, p);
    }
    return p;
  },

  /** One sprite file from an item's pack (null if it doesn't exist). */
  image(item, path) {
    const key = item.pack + ':' + path;
    let p = this.images.get(key);
    if (!p) {
      p = this.pack(item.pack).then((m) => {
        const b64 = m.get(path);
        return b64 ? loadImg('data:image/png;base64,' + b64) : null;
      });
      this.images.set(key, p);
    }
    return p;
  },

  thumb(index) {
    const per = this.cat.thumbs.perSheet, cols = this.cat.thumbs.cols;
    const img = this.thumbs[Math.floor(index / per)], i = index % per;
    return { img, x: (i % cols) * F, y: Math.floor(i / cols) * F };
  },

  /** A palette by reference { mat, ver, name } → its colours. */
  colours(ref) { return ref ? this.cat.palettes[ref.mat]?.[ref.ver]?.[ref.name] ?? null : null; },
  /** All palettes a colour channel may use, deduplicated by colours. */
  choices(channel) {
    const out = [], seen = new Set();
    for (const [mat, ver] of channel.palettes) {
      for (const [name, cols] of Object.entries(this.cat.palettes[mat]?.[ver] ?? {})) {
        if (cols.length !== channel.source?.length) continue;
        const k = cols.join();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ ref: { mat, ver, name }, cols, group: mat === 'all' ? 'all' : ver });
      }
    }
    return out;
  },
};

function loadImg(src, revoke = false) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { if (revoke) URL.revokeObjectURL(src); res(img); };
    img.onerror = () => { if (revoke) URL.revokeObjectURL(src); res(null); };
    img.src = src;
  });
}

/* Recolouring --------------------------------------------------------------------------------------------------- */
const hexInt = (h) => parseInt(h.slice(1, 7), 16);
/** The eye colour picked on the head (expressions and other eye parts follow it unless recoloured themselves). */
function headEyes(rec) {
  const head = rec.sel.head && Lib.byId.get(rec.sel.head.id);
  const i = head?.colours?.findIndex((c) => c.material === 'eye') ?? -1;
  return i >= 0 ? rec.sel.head.colours?.[i] : undefined;
}

/**
 * Colour maps for an item: `map` (source colour → target colour) for everything, which also colours the right eye;
 * `left` for the left eye when the character has a different left-eye colour; `eyes`, the eye colours to split.
 */
function colourMaps(item, chosen, rec) {
  const map = new Map(), eyes = new Set();
  let left = null;
  (item.colours ?? []).forEach((ch, i) => {
    if (!ch.source) return;
    // Skin-coloured channels follow the body's skin tone (unless it's an extra the player recoloured).
    const followsSkin = ch.material === 'body' && (item.matchBody || item.type === 'body' || !chosen?.[i]);
    let pick = chosen?.[i];
    if (ch.material === 'eye' && !pick && item.type !== 'head') pick = headEyes(rec);
    const target = followsSkin ? Lib.colours(rec.skin) : pick ? Lib.colours(pick) : null;
    if (target) ch.source.forEach((c, k) => { if (target[k]) map.set(hexInt(c), hexInt(target[k])); });
    if (ch.material === 'eye') {
      ch.source.forEach((c) => eyes.add(hexInt(c)));
      const lt = rec.leftEye && Lib.colours(rec.leftEye);
      if (lt) { left ??= new Map(); ch.source.forEach((c, k) => { if (lt[k]) left.set(hexInt(c), hexInt(lt[k])); }); }
    }
  });
  return { map, left, eyes };
}
const mapsKey = (m) => [...m.map].join(';') + (m.left ? '|L' + [...m.left].join(';') : '');

function nearKey(map, r, g, b) {
  for (const s of map.keys()) if (Math.abs((s >> 16) - r) <= 1 && Math.abs(((s >> 8) & 255) - g) <= 1 && Math.abs((s & 255) - b) <= 1) return s;
  return undefined;
}

const recolorCache = new Map();
/**
 * Draw `img` (or part of it) recoloured into a new canvas. With a left-eye map, each 64 × 64 frame's eye pixels are
 * split: facing you, the eye on screen-left is the character's right eye; facing left only the left eye shows, facing
 * right only the right. `view` says which way each row faces: { dirs, anim } for an animation strip, or 'down'.
 */
function recolored(img, maps, key, sx = 0, sy = 0, w = img.width, h = img.height, view = 'down') {
  const ck = key + '|' + sx + ',' + sy + ',' + w + ',' + h;
  const hit = recolorCache.get(ck);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const { map, left, eyes } = maps;
  if (map.size || left) {
    const d = g.getImageData(0, 0, w, h), px = d.data;
    // Where each frame's two eyes divide (only needed for a different left eye).
    const cols = Math.ceil(w / F), rows = Math.ceil(h / F);
    const split = left ? new Float32Array(cols * rows).fill(-1) : null;
    if (left) {
      const mn = new Float32Array(cols * rows).fill(1e9), mx = new Float32Array(cols * rows).fill(-1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!px[i + 3] || !eyes.has((px[i] << 16) | (px[i + 1] << 8) | px[i + 2])) continue;
        const cell = Math.floor(y / F) * cols + Math.floor(x / F), lx = x % F;
        if (lx < mn[cell]) mn[cell] = lx;
        if (lx > mx[cell]) mx[cell] = lx;
      }
      for (let k = 0; k < split.length; k++) if (mx[k] >= 0) split[k] = (mn[k] + mx[k]) / 2;
    }
    const facing = (row) => (view === 'down' ? 'down' : view.dirs === 4 ? DIRS[row % 4] : view.anim === 'climb' ? 'up' : 'down');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!px[i + 3]) continue;
      const v = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      let useLeft = false;
      if (left && eyes.has(v)) {
        const dir = facing(Math.floor(y / F)), cell = Math.floor(y / F) * cols + Math.floor(x / F);
        useLeft = dir === 'left' || (dir === 'down' && (x % F) > split[cell]);
      }
      const m = useLeft ? left : map;
      let t = m.get(v);
      if (t === undefined) {
        // LPC allows ±1 per channel for colours that drifted in editing.
        const near = nearKey(m, px[i], px[i + 1], px[i + 2]);
        if (near === undefined) continue;
        t = m.get(near);
      }
      px[i] = t >> 16; px[i + 1] = (t >> 8) & 255; px[i + 2] = t & 255;
    }
    g.putImageData(d, 0, 0);
  }
  if (recolorCache.size > 1500) recolorCache.clear();
  recolorCache.set(ck, c);
  return c;
}

/* A character recipe -------------------------------------------------------------------------------------------- */
// { body, skin: paletteRef, leftEye?: paletteRef, sel: { [type]: { id, variant?, colours?: [paletteRef] } } }

function selectedItems(rec) {
  return Object.values(rec.sel).map((s) => ({ s, it: Lib.byId.get(s.id) })).filter((x) => x.it && x.it.anims[rec.body]);
}

function headName(rec) {
  const head = rec.sel.head && Lib.byId.get(rec.sel.head.id);
  return head ? head.name.replace(/ /g, '_') : 'Human_Male';
}

/** The layers to draw for one animation, back to front: [{ item, sel, path }]. */
function layerList(rec, anim) {
  const out = [];
  for (const { s, it } of selectedItems(rec)) {
    if (!it.anims[rec.body].includes(anim)) continue;
    for (const L of it.layers) {
      let folder = L.paths[rec.body];
      if (!folder) continue;
      if (folder.includes('${head}')) {
        const rep = it.replace?.head?.[headName(rec)];
        if (!rep) continue;
        folder = folder.replace('${head}', rep);
      }
      const v = it.variants ? (s.variant ?? it.variants[0]).replace(/ /g, '_') : null;
      out.push({ z: L.z, item: it, sel: s, path: v ? `${folder}${anim}/${v}.png` : `${folder}${anim}.png` });
    }
  }
  return out.sort((a, b) => a.z - b.z);
}

/** The whole strip for one animation (frames × rows), composited and recoloured. */
async function compositeAnim(rec, anim) {
  const info = Lib.cat.anims[anim];
  const c = document.createElement('canvas');
  c.width = info.frames * F; c.height = info.dirs * F;
  const g = c.getContext('2d');
  const layers = layerList(rec, anim);
  const imgs = await Promise.all(layers.map((l) => Lib.image(l.item, l.path)));
  layers.forEach((l, i) => {
    const img = imgs[i];
    if (!img) return;
    const maps = colourMaps(l.item, l.sel.colours, rec);
    const key = l.item.pack + ':' + l.path + '|' + mapsKey(maps);
    g.drawImage(recolored(img, maps, key, 0, 0, img.width, img.height, { dirs: info.dirs, anim }), 0, 0);
  });
  return c;
}

/** Which animations every selected item supports (an animation is offered when the body has it). */
function availableAnims(rec) {
  const body = Lib.byId.get(rec.sel.body?.id);
  const have = new Set(body?.anims[rec.body] ?? ['walk']);
  return ANIM_ORDER.filter((a) => have.has(a));
}

/** A quick standing preview from the thumbnail atlas (no packs needed). */
function drawThumbRecipe(rec, ctx, dx = 0, dy = 0, size = F, only = null) {
  const list = selectedItems(rec).filter((x) => x.it.thumbs?.[rec.body] !== undefined && (!only || only.includes(x.it.type)));
  const z = (x) => Math.min(...x.it.layers.map((l) => l.z));
  list.sort((a, b) => z(a) - z(b));
  for (const { s, it } of list) drawItemThumb(it, rec, s, ctx, dx, dy, size);
}
function drawItemThumb(it, rec, s, ctx, dx, dy, size) {
  const t = Lib.thumb(it.thumbs[rec.body]);
  if (!t.img) return;
  const maps = colourMaps(it, s?.colours, rec);
  const c = recolored(t.img, maps, 'thumb:' + it.thumbs[rec.body] + '|' + mapsKey(maps), t.x, t.y, F, F, 'down');
  ctx.drawImage(c, 0, 0, F, F, dx, dy, size, size);
}

/** Is this item Steam-safe for this body (CC0 or OGA-BY among its licences)? */
const licenceSafe = (licenses) => licenses.some((l) => /^(CC0|OGA-BY)/.test(l.trim()));
const itemSafe = (it, body) => it.safeBy?.[body] ?? it.safe;

/** Credits for a recipe: one line per item (authors, licences, links), and whether everything is Steam-safe. */
function creditsFor(rec) {
  const out = [];
  for (const { it } of selectedItems(rec)) {
    const folders = new Set(it.layers.map((l) => (l.paths[rec.body] ?? '').split('${')[0]));
    let entries = it.credits.filter((c) => [...folders].some((f) => f.startsWith(c.file) || c.file.startsWith(f.replace(/\/$/, ''))));
    if (!entries.length) entries = it.credits;
    for (const c of entries) out.push({ item: it.name, file: c.file, authors: c.authors, licenses: c.licenses, urls: c.urls, safe: licenceSafe(c.licenses) });
  }
  return out;
}

/* Export ------------------------------------------------------------------------------------------------------- */
/** The engine sheet: chosen animations stacked, plus a layout. */
async function buildSheet(rec, anims) {
  const strips = [];
  for (const a of anims) strips.push({ a, c: await compositeAnim(rec, a) });
  const width = Math.max(...strips.map((s) => s.c.width));
  const height = strips.reduce((h, s) => h + s.c.height, 0);
  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const g = out.getContext('2d');
  const layout = {};
  let y = 0;
  for (const s of strips) {
    g.drawImage(s.c, 0, y);
    const info = Lib.cat.anims[s.a];
    layout[s.a] = { row: y / F, frames: info.frames, dirs: info.dirs, cycle: ANIM_PLAY[s.a].cycle, ms: ANIM_PLAY[s.a].ms };
    y += s.c.height;
  }
  return { canvas: out, layout };
}

/** Add an iTXt chunk (UTF-8 text) to a PNG, before IEND. */
async function pngWithText(blob, keyword, text) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const enc = new TextEncoder();
  const body = new Uint8Array([...enc.encode(keyword), 0, 0, 0, 0, 0, ...enc.encode(text)]);
  const type = enc.encode('iTXt');
  const chunk = new Uint8Array(12 + body.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, body.length);
  chunk.set(type, 4); chunk.set(body, 8);
  dv.setUint32(8 + body.length, crc32(new Uint8Array([...type, ...body])));
  const iend = buf.length - 12; // IEND is always the last 12 bytes
  return new Blob([buf.subarray(0, iend), chunk, buf.subarray(iend)], { type: 'image/png' });
}
