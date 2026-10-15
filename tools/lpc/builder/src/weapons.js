// ---------------------------------------------------------------------------------------------------------------
// The weapon builder: start from one of the engine's Steam-safe LPC weapons, recolour it part by part (each part
// keeps its shading), try a glow and a swing trail on your character, and export one PNG with everything inside:
// the sprite sheet (the engine's layout), its icon, credits and effects. The map editor imports it
// (Database → Items → Sprite → Import from the weapon builder…).
// ---------------------------------------------------------------------------------------------------------------

const WEAPON_KINDS = [['sword', 'Swords'], ['blunt', 'Maces & clubs'], ['staff', 'Staffs'], ['bow', 'Bows'], ['shield', 'Shields']];
/** Swings (and the body animation each plays over). */
const WEAPON_ANIMS = { slash: 'slash', backslash: 'backslash', halfslash: 'halfslash', thrust: 'thrust', slash_reverse: 'slash', shoot: 'shoot', combat_idle: 'combat_idle', walk: 'walk' };
const WEAPON_ANIM_LABEL = { slash: 'Slash', backslash: 'Backslash', halfslash: 'Half slash', thrust: 'Thrust', slash_reverse: 'Reverse slash', shoot: 'Shoot', combat_idle: 'Guard', walk: 'Walk' };
const ATTACK_ANIMS = new Set(['slash', 'backslash', 'halfslash', 'thrust', 'slash_reverse']);
/** Materials to pick for any part. */
const MATERIALS = [
  ['Steel', '#a9b2bf'], ['Iron', '#7d838d'], ['Silver', '#dfe4ec'], ['Gold', '#e8b53c'], ['Rose gold', '#e0997f'], ['Bronze', '#b0793a'], ['Copper', '#c2683e'],
  ['Obsidian', '#3b3448'], ['Bone', '#e3d8b8'], ['Oak', '#8c5a2e'], ['Ebony', '#3d281b'], ['Leather', '#6e4527'],
  ['Ruby', '#d9334a'], ['Ember', '#ff7a2a'], ['Topaz', '#f2c94c'], ['Emerald', '#36bf68'], ['Jade', '#5fbf9a'], ['Ice', '#9fe6ff'],
  ['Sapphire', '#3a6be0'], ['Amethyst', '#9b5ad9'], ['Void', '#5a2a8a'], ['Blood', '#8a1424'], ['Snow', '#f4f6fb'], ['Shadow', '#1d1f29'],
];

const WS = { id: null, name: 'New weapon', base: 'longsword', kind: 'sword', colours: {}, glow: { on: false, color: '#7fd0ff', strength: 1, pulse: true }, trail: { on: false, color: '#ffffff', length: 3 }, anim: 'slash', dirty: false };

/* Colour helpers ----------------------------------------------------------------------------------------------- */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh * 60, s, l];
}
function hslToRgb(hh, s, l) {
  const k = (n) => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const hexRgb = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const HUE_NAMES = [[15, 'Red'], [45, 'Orange'], [70, 'Yellow'], [165, 'Green'], [200, 'Teal'], [255, 'Blue'], [290, 'Purple'], [335, 'Pink'], [361, 'Red']];
const hueName = (hh) => HUE_NAMES.find(([lim]) => hh < lim)[1];

/* Library ------------------------------------------------------------------------------------------------------ */
const Arm = {
  manifest: null,
  thumbs: null,
  byId: new Map(),
  sheets: new Map(),   // id -> Promise<canvas>
  groups: new Map(),   // id -> palette groups
  base: './weapons/',
  error: null,

  async load() {
    try {
      const r = await fetch(this.base + 'weapons.json');
      if (!r.ok) throw new Error(String(r.status));
      this.manifest = await r.json();
      for (const w of this.manifest.weapons) this.byId.set(w.id, w);
      this.thumbs = await loadImg(this.base + 'thumbs.png');
    } catch (e) { this.error = 'The weapon library didn’t load (' + (e.message || e) + ')'; }
  },

  sheet(id) {
    let p = this.sheets.get(id);
    if (!p) {
      const d = this.byId.get(id);
      p = loadImg(this.base + d.file.split('/').pop()).then((img) => {
        const c = canvas(img.width, img.height);
        c.getContext('2d').drawImage(img, 0, 0);
        return c;
      });
      p.catch(() => this.sheets.delete(id));
      this.sheets.set(id, p);
    }
    return p;
  },

  /** The weapon's icon cell (from thumbs.png), as drawn. */
  iconCell(d) {
    const s = this.manifest.thumbSize || 64, cols = this.manifest.thumbCols || 16;
    const c = canvas(s, s);
    if (this.thumbs) c.getContext('2d').drawImage(this.thumbs, (d.thumb % cols) * s, Math.floor(d.thumb / cols) * s, s, s, 0, 0, s, s);
    return c;
  },
};

/**
 * The parts of a weapon, by colour: metal and light parts, gold and brass, wood and leather, gems and glows by hue,
 * and the dark outline. Each part is a ramp of the sheet's colours (its shading), recoloured together.
 */
function paletteGroups(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const counts = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  const groups = new Map();
  for (const [k, n] of counts) {
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    const [hh, s, l] = rgbToHsl(r, g, b);
    let key, label;
    if (l < 0.13) { key = 'outline'; label = 'Outline'; }
    else if (s < 0.2 || l > 0.8 || (s < 0.32 && l > 0.6)) { key = 'metal'; label = 'Metal & light parts'; }
    else if (hh >= 30 && hh < 62 && l > 0.42 && s > 0.45) { key = 'gold'; label = 'Gold & brass'; }
    else if (hh >= 5 && hh < 50 && l <= 0.58) { key = 'wood'; label = 'Wood & leather'; }
    else { const bucket = Math.round(hh / 40) * 40 % 360; key = 'hue' + bucket; label = hueName(hh) + ' parts'; }
    let gr = groups.get(key);
    if (!gr) groups.set(key, (gr = { key, label, colors: [], n: 0 }));
    gr.colors.push({ k, r, g, b, h: hh, s, l, n });
    gr.n += n;
  }
  // Small parts join the nearest part by colour: specks of anything (under 0.4%), and hue parts under 3% (the
  // in-between shades of a swing's smear, a stray highlight).
  const list = [...groups.values()];
  const big = list.filter((g) => g.key === 'outline' || g.n / total >= (g.key.startsWith('hue') ? 0.03 : 0.004));
  for (const g of list) {
    if (big.includes(g) || !big.length) continue;
    const c0 = g.colors[0];
    let best = big[0], bd = Infinity;
    for (const o of big) if (o.key !== 'outline') for (const c1 of o.colors) { const dd = (c0.r - c1.r) ** 2 + (c0.g - c1.g) ** 2 + (c0.b - c1.b) ** 2; if (dd < bd) { bd = dd; best = o; } }
    best.colors.push(...g.colors); best.n += g.n;
  }
  for (const g of big) {
    g.colors.sort((a, b) => a.l - b.l);
    g.meanL = g.colors.reduce((a, c) => a + c.l * c.n, 0) / g.n;
    g.meanS = g.colors.reduce((a, c) => a + c.s * c.n, 0) / g.n;
    g.share = g.n / total;
  }
  const order = ['metal', 'gold', 'wood'];
  return big.sort((a, b) => (a.key === 'outline') - (b.key === 'outline') || (order.indexOf(a.key) + 1 || 9) - (order.indexOf(b.key) + 1 || 9) || b.n - a.n);
}

/** Colour lookup (source rgb → new rgb) for the chosen colours: a gradient map per part, keeping its light and dark. */
function colourLut(groups, choice) {
  const lut = new Map();
  for (const g of groups) {
    const hex = choice[g.key];
    if (!hex) continue;
    const [th, ts, tl] = rgbToHsl(...hexRgb(hex));
    for (const c of g.colors) {
      const l = Math.max(0.02, Math.min(0.98, tl + (c.l - g.meanL) * (g.key === 'outline' ? 0.6 : 1)));
      const s = Math.max(0, Math.min(1, g.meanS > 0.03 ? ts * (c.s + 0.05) / (g.meanS + 0.05) : ts));
      const [r, gg, b] = hslToRgb(th, s, l);
      lut.set(c.k, (r << 16) | (gg << 8) | b);
    }
  }
  return lut;
}

function applyLut(src, lut, sx = 0, sy = 0, w = src.width, hh = src.height) {
  const out = canvas(w, hh), g = out.getContext('2d');
  g.drawImage(src, sx, sy, w, hh, 0, 0, w, hh);
  if (!lut.size) return out;
  const img = g.getImageData(0, 0, w, hh), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const v = lut.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (v === undefined) continue;
    d[i] = (v >> 16) & 255; d[i + 1] = (v >> 8) & 255; d[i + 2] = v & 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}

/** A frame's silhouette in a colour (for the glow and trail previews). */
function tinted(src, sx, sy, w, hh, color) {
  const c = canvas(w, hh), g = c.getContext('2d');
  g.drawImage(src, sx, sy, w, hh, 0, 0, w, hh);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, w, hh);
  return c;
}

/** The icon: the weapon's cell recoloured, trimmed to what's drawn (with a pixel of room). */
function trimmed(c) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return c;
  const w = x1 - x0 + 1, hh = y1 - y0 + 1, s = Math.max(w, hh) + 2, out = canvas(s, s);
  out.getContext('2d').drawImage(c, x0, y0, w, hh, Math.floor((s - w) / 2), Math.floor((s - hh) / 2), w, hh);
  return out;
}

/* State -------------------------------------------------------------------------------------------------------- */
const Weap = {
  ready: false,
  view: { key: '', lut: null, groups: [], sheet: null, strips: new Map(), icon: null, body: new Map(), bodyKey: '' },

  def() { return Arm.byId.get(WS.base); },

  /** Which animations to preview: the weapon's swings (and what the body can do). */
  anims() {
    const d = this.def();
    if (!d) return [];
    const body = new Set(availableAnims(S));
    return Object.keys(WEAPON_ANIMS).filter((a) => d.anims.includes(a) && body.has(WEAPON_ANIMS[a]) && (a !== 'walk' || d.kind === 'shield'));
  },

  async refresh() {
    const d = this.def();
    if (!d) return;
    const key = WS.base + '|' + JSON.stringify(WS.colours);
    const v = this.view;
    if (v.key === key) return;
    v.key = key;
    const sheet = await Arm.sheet(WS.base);
    if (v.key !== key) return;
    if (!Arm.groups.has(WS.base)) Arm.groups.set(WS.base, paletteGroups(sheet));
    v.groups = Arm.groups.get(WS.base);
    v.lut = colourLut(v.groups, WS.colours);
    v.sheet = sheet;
    v.strips = new Map();
    v.icon = trimmed(applyLut(Arm.iconCell(d), v.lut));
    this.renderSide();
  },

  /** One animation's frames (both layers), recoloured: { back, front } with their frame sizes. */
  strip(anim) {
    const v = this.view, d = this.def();
    if (!v.sheet || !d) return null;
    let s = v.strips.get(anim);
    if (!s) {
      s = {};
      // How far the weapon reaches from the frame's centre (so the stage can fit the whole swing).
      let reach = F / 2;
      for (const side of ['back', 'front']) {
        const L = d.layers[side][anim];
        if (!L) continue;
        const c = applyLut(v.sheet, v.lut, 0, L.y, L.frames * L.frame, L.dirs * L.frame);
        s[side] = { L, c };
        const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, half = L.frame / 2;
        for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
          if (px[(y * c.width + x) * 4 + 3] < 40) continue;
          reach = Math.max(reach, Math.abs((x % L.frame) - half), Math.abs((y % L.frame) - half));
        }
      }
      Object.defineProperty(s, 'reach', { value: Math.ceil(reach + 3), enumerable: false });
      v.strips.set(anim, s);
    }
    return s;
  },

  /** The character's body for an animation, without the weapons picked in the character builder. */
  bodyStrip(anim) {
    const rec = { body: S.body, skin: S.skin, leftEye: S.leftEye, sel: Object.fromEntries(Object.entries(S.sel).filter(([, s]) => Lib.byId.get(s.id)?.tab !== 'weapons')) };
    const key = JSON.stringify([rec, anim]);
    if (this.view.bodyKey !== JSON.stringify(rec)) { this.view.body = new Map(); this.view.bodyKey = JSON.stringify(rec); }
    let p = this.view.body.get(anim);
    if (!p) { p = { c: null }; this.view.body.set(anim, p); compositeAnim(rec, anim).then((c) => { p.c = c; }).catch(() => {}); }
    void key;
    return p.c;
  },

  /* Stage ------------------------------------------------------------------------------------------------------ */
  draw(g, W, H, z0, time) {
    const anims = this.anims();
    if (!anims.includes(WS.anim)) WS.anim = anims.find((a) => ATTACK_ANIMS.has(a)) ?? anims[0] ?? 'walk';
    const anim = WS.anim, bodyAnim = WEAPON_ANIMS[anim] ?? anim;
    const info = Lib.cat.anims[bodyAnim], play = ANIM_PLAY[bodyAnim];
    if (!info || !play) return;
    let cycle = play.cycle;
    if (anim === 'slash_reverse') cycle = [...cycle].reverse();
    // A pause between swings, so each one reads.
    const n = cycle.length + (ATTACK_ANIMS.has(anim) || anim === 'shoot' ? 5 : 0);
    const step = S.playing ? Math.floor(time / play.ms) % n : 0;
    const pos = Math.min(step, cycle.length - 1);
    const col = Math.min(info.frames - 1, cycle[pos]);
    const body = this.bodyStrip(bodyAnim), st = this.strip(anim);
    // Zoom so the whole swing fits (big swords reach well past the body's frame).
    const span = Math.max(F * 1.15, (st?.reach ?? F / 2) * 2 + 4);
    const z = Math.max(1, Math.floor(Math.min(W / span, H / span)));
    void z0;
    const x = Math.round((W - F * z) / 2), y = Math.round((H - F * z) / 2);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath(); g.ellipse(W / 2, y + F * z * 0.9, F * z * 0.2, F * z * 0.05, 0, 0, Math.PI * 2); g.fill();
    const dirRow = (L) => (L.dirs === 4 ? S.dir : 0);
    const wcol = (L, c) => Math.min(L.frames - 1, c);
    const layer = (side, c, alpha = 1, color = null) => {
      const s = st?.[side];
      if (!s) return;
      const L = s.L, fz = L.frame * z, ox = x - ((L.frame - F) / 2) * z, oy = y - ((L.frame - F) / 2) * z;
      const sx = wcol(L, c) * L.frame, sy = dirRow(L) * L.frame;
      if (!color) { g.drawImage(s.c, sx, sy, L.frame, L.frame, ox, oy, fz, fz); return; }
      const t = tinted(s.c, sx, sy, L.frame, L.frame, color);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha;
      g.drawImage(t, ox, oy, fz, fz);
      g.restore();
    };
    // The trail: earlier frames of the swing, fading (only while swinging).
    const trail = (side) => {
      if (!WS.trail.on || !ATTACK_ANIMS.has(anim) || step >= cycle.length) return;
      for (let k = Math.min(4, WS.trail.length); k >= 1; k--) {
        if (pos - k < 0) continue;
        layer(side, Math.min(info.frames - 1, cycle[pos - k]), 0.55 * (1 - k / (WS.trail.length + 1)), WS.trail.color);
      }
    };
    // The glow: the silhouette in colour, spread a pixel or two around the weapon.
    const glow = (side) => {
      if (!WS.glow.on) return;
      const a = Math.min(1, 0.32 * WS.glow.strength * (WS.glow.pulse ? 0.78 + 0.22 * Math.sin(time / 1000 * 4.2) : 1));
      const s = st?.[side];
      if (!s) return;
      const L = s.L, fz = L.frame * z, ox = x - ((L.frame - F) / 2) * z, oy = y - ((L.frame - F) / 2) * z;
      const t = tinted(s.c, wcol(L, col) * L.frame, dirRow(L) * L.frame, L.frame, L.frame, WS.glow.color);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [dx, dy, k] of [[0, 0, 0.9], [-1, 0, 0.6], [1, 0, 0.6], [0, -1, 0.6], [0, 1, 0.6], [-2, 0, 0.3], [2, 0, 0.3], [0, -2, 0.3], [0, 2, 0.3], [-1, -1, 0.35], [1, 1, 0.35], [1, -1, 0.35], [-1, 1, 0.35]]) {
        g.globalAlpha = a * k; g.drawImage(t, ox + dx * z, oy + dy * z, fz, fz);
      }
      g.restore();
    };
    trail('back');
    layer('back', col); glow('back');
    if (body) g.drawImage(body, col * F, (info.dirs === 4 ? S.dir : 0) * F, F, F, x, y, F * z, F * z);
    trail('front');
    layer('front', col); glow('front');
    if (!body || !st) $('loading').hidden = false; else if (!loading) $('loading').hidden = true;
    // Turnaround: the same frame from all four sides, each canvas big enough for the swing.
    const T = Math.max(F, Math.ceil(((st?.reach ?? F / 2) * 2) / 2) * 2);
    for (const [d, c] of turn) {
      if (c.width !== T) { c.width = c.height = T; }
      const tg = c.getContext('2d');
      tg.clearRect(0, 0, T, T);
      tg.imageSmoothingEnabled = false;
      const one = (side) => {
        const s = st?.[side];
        if (!s) return;
        const L = s.L, o = (T - L.frame) / 2;
        tg.drawImage(s.c, wcol(L, col) * L.frame, (L.dirs === 4 ? d : 0) * L.frame, L.frame, L.frame, o, o, L.frame, L.frame);
      };
      one('back');
      if (body) tg.drawImage(body, col * F, (info.dirs === 4 ? d : 0) * F, F, F, (T - F) / 2, (T - F) / 2, F, F);
      one('front');
      c.classList.toggle('on', d === S.dir);
    }
  },

  /* Panels ----------------------------------------------------------------------------------------------------- */
  render() {
    if (!Arm.manifest) {
      $('armory').replaceChildren(h('p', { class: 'empty' }, Arm.error ?? 'Loading the weapons…'));
      return;
    }
    if (document.activeElement !== $('weapName')) $('weapName').value = WS.name;
    $('wSave').classList.toggle('dirty', WS.dirty);
    $('weapCount').textContent = saved.weapons?.length ? String(saved.weapons.length) : '';
    const anims = this.anims();
    $('anims').replaceChildren(...anims.map((a) => h('button', { type: 'button', 'aria-pressed': String(a === WS.anim), onclick: () => { WS.anim = a; this.draft(); redraw(); } }, WEAPON_ANIM_LABEL[a] ?? a)));
    for (const b of $('dirs').children) b.setAttribute('aria-pressed', String(+b.dataset.dir === S.dir));
    for (const b of $('bgs').children) b.setAttribute('aria-pressed', String(b.dataset.bg === S.bg));
    $('btnPlay').textContent = S.playing ? 'Pause' : 'Play';
    this.renderBases();
    this.renderEffects();
    this.renderSide();
    void this.refresh();
  },

  renderBases() {
    const d = this.def();
    WS.kind = d?.kind ?? WS.kind;
    $('weapKinds').replaceChildren(...WEAPON_KINDS.filter(([k]) => Arm.manifest.weapons.some((w) => w.kind === k)).map(([k, name]) =>
      h('button', { type: 'button', 'aria-pressed': String(k === WS.kind), onclick: () => {
        if (k === WS.kind) return;
        const first = Arm.manifest.weapons.find((w) => w.kind === k);
        if (first) this.setBase(first.id);
      } }, name)));
    const list = Arm.manifest.weapons.filter((w) => w.kind === WS.kind);
    $('baseNote').textContent = `${list.length} Steam-safe LPC ${WEAPON_KINDS.find(([k]) => k === WS.kind)?.[1].toLowerCase() ?? 'weapons'}`;
    $('weapBases').replaceChildren(...list.map((w) => {
      const c = canvas(48, 48), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const icon = trimmed(Arm.iconCell(w)), k = icon.width <= 48 ? Math.floor(48 / icon.width) : 48 / icon.width, s = Math.round(icon.width * k);
      g.drawImage(icon, (48 - s) >> 1, (48 - s) >> 1, s, s);
      return h('button', { type: 'button', class: 'tile', 'aria-pressed': String(w.id === WS.base), title: `${w.name} · ${w.anims.filter((a) => WEAPON_ANIMS[a]).map((a) => WEAPON_ANIM_LABEL[a]).join(', ')}`, onclick: () => this.setBase(w.id) },
        c, h('span', { text: w.name }));
    }));
  },

  setBase(id) {
    if (id === WS.base) return;
    WS.base = id;
    WS.kind = Arm.byId.get(id)?.kind ?? WS.kind;
    if (WS.kind !== 'sword' && WS.kind !== 'blunt' && WS.kind !== 'staff') WS.trail.on = false;
    this.changed();
  },

  renderColours() {
    const box = $('weapColours'), groups = this.view.groups;
    if (!groups.length) { box.replaceChildren(h('p', { class: 'hint' }, 'Loading…')); return; }
    box.replaceChildren(...groups.map((gr) => {
      const cur = WS.colours[gr.key] ?? null;
      const ramp = h('span', { class: 'ramp', 'aria-hidden': 'true' }, gr.colors.filter((c, i, a) => a.length <= 8 || i % Math.ceil(a.length / 8) === 0).map((c) => h('i', { style: `background:rgb(${c.r},${c.g},${c.b})` })));
      const sw = (name, hex) => h('button', { type: 'button', class: 'sw', title: name, 'aria-label': name, style: `background:linear-gradient(135deg, ${hex} 0 50%, ${shade(hex, -0.18)} 50%)`, 'aria-pressed': String(cur === hex),
        onclick: () => { WS.colours[gr.key] = hex; this.changed(); } });
      const custom = h('input', { type: 'color', value: cur ?? rgbHex(...hslToRgb(...rgbToHsl(gr.colors[gr.colors.length >> 1].r, gr.colors[gr.colors.length >> 1].g, gr.colors[gr.colors.length >> 1].b))), 'aria-label': `Any colour for ${gr.label}` });
      custom.addEventListener('input', () => { WS.colours[gr.key] = custom.value; this.changed(false); });
      return h('div', { class: 'wgroup' },
        h('div', { class: 'wgroup-head' }, h('b', { text: gr.label }), ramp),
        h('div', { class: 'swatches' },
          h('button', { type: 'button', class: 'sw asdrawn', title: 'As drawn', 'aria-label': 'As drawn', 'aria-pressed': String(!cur), onclick: () => { delete WS.colours[gr.key]; this.changed(); } }),
          ...MATERIALS.map(([n, hex]) => sw(n, hex)),
          h('label', { class: 'custom' }, custom, h('span', { class: 'hint', text: 'Any' }))));
    }));
  },

  renderEffects() {
    const melee = WS.kind === 'sword' || WS.kind === 'blunt' || WS.kind === 'staff';
    const colour = (val, set) => { const i = h('input', { type: 'color', value: val }); i.addEventListener('input', () => { set(i.value); this.touch(); }); return i; };
    const check = (label, on, set) => h('label', { class: 'set' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => { set(e.target.checked); this.touch(); this.renderEffects(); } }), h('span', {}, label));
    const range = (val, min, max, stepV, set, label) => { const i = h('input', { type: 'range', min, max, step: stepV, value: val, 'aria-label': label }); i.addEventListener('input', () => { set(+i.value); this.touch(); }); return i; };
    const parts = [];
    if (WS.kind !== 'shield') {
      parts.push(h('div', { class: 'fx' }, check('Glow while it’s in the hand', WS.glow.on, (v) => (WS.glow.on = v)),
        WS.glow.on ? h('div', { class: 'fx-row' }, colour(WS.glow.color, (v) => (WS.glow.color = v)), h('span', {}, 'Strength'), range(WS.glow.strength, 0.2, 2, 0.1, (v) => (WS.glow.strength = v), 'Glow strength'),
          check('Pulse', WS.glow.pulse, (v) => (WS.glow.pulse = v))) : null));
    }
    if (melee) {
      parts.push(h('div', { class: 'fx' }, check('Swing trail', WS.trail.on, (v) => (WS.trail.on = v)),
        WS.trail.on ? h('div', { class: 'fx-row' }, colour(WS.trail.color, (v) => (WS.trail.color = v)), h('span', {}, 'Length'), range(WS.trail.length, 1, 4, 1, (v) => (WS.trail.length = v), 'Trail length')) : null));
    }
    parts.push(h('p', { class: 'hint' }, WS.kind === 'shield' ? 'Shields have no effects.' : 'Saved with the weapon. In the map editor, an item using it starts with these effects, and Database → Items can turn them on or off for each item.'));
    $('weapEffects').replaceChildren(...parts);
  },

  renderSide() {
    this.renderColours();
    const d = this.def(), icon = this.view.icon;
    const fig = (label, size, k) => {
      const c = canvas(size, size), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      if (icon) { const s = Math.min(size, icon.width * k); g.drawImage(icon, (size - s) >> 1, (size - s) >> 1, s, s); }
      return h('figure', {}, c, h('figcaption', { text: label }));
    };
    $('weapIcons').replaceChildren(fig('Bag icon', 48, 48 / Math.max(1, icon?.width ?? 48)), fig('Actual size', 32, 1), fig('2×', 64, 2));
    if (d) {
      const sz = `${d.width} × ${d.height + (icon?.height ?? 0)} px`;
      $('weapSize').textContent = sz;
      const authors = [...new Set(d.credits.flatMap((c) => c.authors))];
      $('weapLicence').className = 'licence ok';
      $('weapLicence').replaceChildren(h('b', {}, 'Steam-safe'), ` Based on ${d.name} by ${authors.join(', ')} (OGA-BY: credit the artists). The credits go inside the PNG.`);
    }
  },

  /* Changes, saving, exporting --------------------------------------------------------------------------------- */
  changed(rerender = true) { WS.dirty = true; this.draft(); if (rerender) redraw(); else { void this.refresh(); $('wSave').classList.add('dirty'); } },
  touch() { WS.dirty = true; this.draft(); $('wSave').classList.add('dirty'); },

  draft() { try { localStorage.setItem('lpc:wdraft', JSON.stringify(WS)); } catch { /* fine */ } },
  loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem('lpc:wdraft') || 'null');
      if (d && d.base) Object.assign(WS, d, { glow: { ...WS.glow, ...d.glow }, trail: { ...WS.trail, ...d.trail } });
    } catch { /* fine */ }
    if (!Arm.byId.has(WS.base)) WS.base = Arm.byId.has('longsword') ? 'longsword' : Arm.manifest?.weapons[0]?.id ?? WS.base;
  },

  recipe(w = WS) { return { id: w.id ?? undefined, name: w.name, base: w.base, colours: w.colours, glow: w.glow, trail: w.trail }; },

  async save() {
    if (!store) return;
    WS.name = $('weapName').value.trim() || 'New weapon';
    try {
      WS.id = await store.saveWeapon(this.recipe());
      WS.dirty = false; this.draft(); redraw(); toast(`Saved “${WS.name}”`);
    } catch (e) { toast('Couldn’t save: ' + (e?.message || e), true); }
  },

  open(w, copy = false) {
    Object.assign(WS, { id: copy ? null : w.id, name: copy ? w.name + ' copy' : w.name, base: Arm.byId.has(w.base) ? w.base : WS.base, colours: { ...(w.colours ?? {}) },
      glow: { ...WS.glow, ...(w.glow ?? {}) }, trail: { ...WS.trail, ...(w.trail ?? {}) }, dirty: copy });
    WS.kind = Arm.byId.get(WS.base)?.kind ?? WS.kind;
    this.draft(); redraw();
  },

  fresh() {
    Object.assign(WS, { id: null, name: 'New weapon', colours: {}, glow: { on: false, color: '#7fd0ff', strength: 1, pulse: true }, trail: { on: false, color: '#ffffff', length: 3 }, dirty: false });
    this.draft(); redraw();
  },

  /** The PNG the engine imports: the recoloured sheet with its icon under it, and the layout, credits and effects inside. */
  async pngFor(w) {
    const d = Arm.byId.get(w.base);
    if (!d) throw new Error('That weapon’s base isn’t in the library any more');
    const sheet = await Arm.sheet(w.base);
    if (!Arm.groups.has(w.base)) Arm.groups.set(w.base, paletteGroups(sheet));
    const lut = colourLut(Arm.groups.get(w.base), w.colours ?? {});
    const body = applyLut(sheet, lut), icon = trimmed(applyLut(Arm.iconCell(d), lut));
    const out = canvas(d.width, d.height + icon.height);
    const g = out.getContext('2d');
    g.drawImage(body, 0, 0); g.drawImage(icon, 0, d.height);
    const melee = d.kind === 'sword' || d.kind === 'blunt' || d.kind === 'staff';
    const effects = {};
    if (w.glow?.on && d.kind !== 'shield') effects.glow = { color: w.glow.color, ...(Math.abs((w.glow.strength ?? 1) - 1) > 0.01 ? { strength: w.glow.strength } : {}), ...(w.glow.pulse === false ? { pulse: false } : {}) };
    if (w.trail?.on && melee) effects.trail = { color: w.trail.color, ...((w.trail.length ?? 3) !== 3 ? { length: w.trail.length } : {}) };
    const meta = { format: 'hd2d-weapon', version: 1, name: w.name, kind: d.kind, width: d.width, height: d.height + icon.height,
      layers: d.layers, anims: d.anims, icon: { x: 0, y: d.height, w: icon.width, h: icon.height }, credits: d.credits, base: d.id,
      recipe: { id: w.id ?? undefined, base: w.base, colours: w.colours ?? {}, glow: w.glow, trail: w.trail }, effects };
    return pngWithText(await toBlob(out), 'hd2d-weapon', JSON.stringify(meta));
  },

  async exportPng(w = WS) {
    $('loading').hidden = false;
    try {
      const name = (w === WS ? $('weapName').value.trim() : w.name) || 'weapon';
      const blob = await this.pngFor({ ...w, name });
      const r = await saveFile(slug(name) + '.png', blob);
      if (r === 'saved') toast(`Exported ${slug(name)}.png: import it in the map editor (Items → Sprite → Import from the weapon builder)`);
    } catch (e) { toast(e.message, true); }
    finally { $('loading').hidden = !loading; }
  },

  async exportAll() {
    const list = saved.weapons ?? [];
    if (!list.length) { toast('Save a weapon first', true); return; }
    $('loading').hidden = false;
    try {
      const files = [], used = new Set();
      for (const w of list) {
        let n = slug(w.name), k = 2;
        while (used.has(n)) n = slug(w.name) + '_' + k++;
        used.add(n);
        files.push({ name: n + '.png', data: await this.pngFor(w) });
      }
      await saveFile('weapons.zip', await Zip.write(files));
      toast(`Exported ${list.length} weapons`);
    } catch (e) { toast(e.message, true); }
    finally { $('loading').hidden = !loading; }
  },

  renderList() {
    const body = $('weapsBody'), list = [...(saved.weapons ?? [])].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
    if (!list.length) { body.replaceChildren(h('p', { class: 'empty' }, 'No saved weapons yet. Make one and press Save, and it will be listed here.')); return; }
    body.replaceChildren(
      h('p', { class: 'hint' }, 'Export PNG saves what the map editor imports: Database → Items → a weapon → Sprite → Import from the weapon builder. The sprite, icon, credits and effects are all inside the PNG.'),
      h('div', { class: 'list' }, list.map((w) => {
        const d = Arm.byId.get(w.base), cv = canvas(56, 56);
        cv.className = 'wicon';
        if (d) {
          const draw = () => {
            const groups = Arm.groups.get(w.base);
            const icon = trimmed(groups ? applyLut(Arm.iconCell(d), colourLut(groups, w.colours ?? {})) : Arm.iconCell(d));
            const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 56, 56);
            const k = icon.width <= 56 ? Math.floor(56 / icon.width) : 56 / icon.width, s = Math.round(icon.width * k);
            g.drawImage(icon, (56 - s) >> 1, (56 - s) >> 1, s, s);
          };
          draw();
          if (!Arm.groups.has(w.base)) Arm.sheet(w.base).then((sh) => { Arm.groups.set(w.base, paletteGroups(sh)); draw(); });
        }
        const fx = [w.glow?.on && 'glow', w.trail?.on && 'trail'].filter(Boolean).join(' and ');
        return h('div', { class: 'item' }, cv,
          h('div', { class: 'info' }, h('b', { text: w.name }), h('span', { class: 'sub', text: `${d ? d.name : w.base + ' (missing)'}${fx ? ' · ' + fx : ''}${w.id === WS.id ? ' · open now' : ''}` })),
          h('div', { class: 'btns' },
            h('button', { type: 'button', class: 'btn primary', onclick: () => { this.open(w); closeSheets(); } }, 'Open'),
            h('button', { type: 'button', class: 'btn', onclick: () => { this.open(w, true); closeSheets(); } }, 'Copy'),
            h('button', { type: 'button', class: 'btn', onclick: () => this.exportPng(w) }, 'PNG'),
            confirmButton('Delete', async () => { await store.deleteWeapon(w.id); if (WS.id === w.id) WS.id = null; toast(`Deleted “${w.name}”`); })));
      })));
  },

  wire() {
    $('weapName').addEventListener('input', (e) => { WS.name = e.target.value; this.touch(); });
    $('wNew').onclick = () => this.fresh();
    $('wSave').onclick = () => this.save();
    $('wExport').onclick = () => this.exportPng();
    $('wList').onclick = () => openSheet('weapsSheet');
    $('wAbout').onclick = () => openSheet('aboutSheet');
    $('wExportAll').onclick = () => this.exportAll();
  },
};

/** A darker or lighter version of a colour (for the two-tone swatches). */
function shade(hex, dl) {
  const [hh, s, l] = rgbToHsl(...hexRgb(hex));
  return rgbHex(...hslToRgb(hh, s, Math.max(0, Math.min(1, l + dl))));
}
