// ---------------------------------------------------------------------------------------------------------------
// The Character Builder (LPC edition): wardrobe, animated preview, saving, exporting sheets and credits.
// ---------------------------------------------------------------------------------------------------------------

const BODY_TYPES = [['male', 'Masculine'], ['female', 'Feminine'], ['teen', 'Teen'], ['child', 'Kid'], ['muscular', 'Muscular'], ['pregnant', 'Pregnant']];
const BODY_NAME = Object.fromEntries(BODY_TYPES);
const TABS = [['body', 'Body'], ['head', 'Head'], ['face', 'Face'], ['hair', 'Hair'], ['torso', 'Torso'], ['legs', 'Legs'], ['feet', 'Feet'], ['arms', 'Arms'], ['headwear', 'Hats & jewelry'], ['back', 'Back'], ['weapons', 'Weapons']];
const REQUIRED = new Set(['body', 'head']);
const TYPE_LABEL = {
  hairextl: 'Hair extension (left)', hairextr: 'Hair extension (right)', updo: 'Updo', facial_eyes: 'Eyepatches', facial_left: 'Monocle (left)',
  facial_right: 'Monocle (right)', facial_left_trim: 'Monocle frame (left)', facial_right_trim: 'Monocle frame (right)', facial_mask: 'Masks',
  shoes_toe: 'Toe plates', ears_inner: 'Inner ears', furry_ears_skin: 'Furry ears (skin)', expression_crying: 'Tears',
  wound_arm: 'Wound: arm', wound_brain: 'Wound: head', wound_eye_left: 'Wound: left eye', wound_eye_right: 'Wound: right eye', wound_mouth: 'Wound: mouth', wound_ribs: 'Wound: ribs',
  prosthesis_hand: 'Prosthetic hand', prosthesis_leg: 'Prosthetic leg', weapon_magic_crystal: 'Magic crystal', ammo: 'Ammo', body: 'Body',
};
const typeLabel = (t) => TYPE_LABEL[t] ?? t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const DEFAULT_HEAD = { male: 'heads_human_male', muscular: 'heads_human_male', female: 'heads_human_female', pregnant: 'heads_human_female', teen: 'heads_human_male_small', child: 'heads_human_child' };
const SKIN_DEFAULT = { mat: 'body', ver: 'ulpc', name: 'light' };

/* State -------------------------------------------------------------------------------------------------------- */
let store = null;
let saved = { chars: [], weapons: [], settings: { ...DEFAULT_SETTINGS } };
/** 'chars' (the character builder) or 'weapons' (the weapon builder). */
let MODE = 'chars';
const S = { id: null, name: 'New character', body: 'male', skin: SKIN_DEFAULT, leftEye: null, sel: {}, tab: 'hair', type: 'hair', anim: 'walk', dir: 2, playing: true, bg: 'grass', dirty: false, query: '' };

const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const canvas = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
const slug = (s) => (s || 'character').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'character';
function toast(msg, bad = false) {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), bad ? 5200 : 2600);
}

/* Choices ------------------------------------------------------------------------------------------------------ */
const steamOnly = () => saved.settings.steamSafe !== false;
function tagsOf(rec, except) {
  const t = new Set();
  for (const [type, s] of Object.entries(rec.sel)) if (type !== except) for (const x of Lib.byId.get(s.id)?.tags ?? []) t.add(x);
  return t;
}
function fits(it, rec, type) {
  if (!it.anims[rec.body]) return false;
  if (steamOnly() && !itemSafe(it, rec.body)) return false;
  if (it.requires?.length) { const t = tagsOf(rec, type); if (!it.requires.every((r) => t.has(r))) return false; }
  if (it.replace?.head && !it.replace.head[headName(rec)]) return false;
  return true;
}
function typesOf(tab) {
  const types = [];
  for (const it of Lib.cat.items) if (it.tab === tab && !types.includes(it.type)) types.push(it.type);
  // Main choice first (the type named like the tab, or the biggest).
  const count = (t) => Lib.cat.items.filter((i) => i.type === t).length;
  return types.sort((a, b) => (b === tab) - (a === tab) || count(b) - count(a));
}
const itemsOf = (type, rec = S) => Lib.cat.items.filter((it) => it.type === type && fits(it, rec, type)).sort((a, b) => a.name.localeCompare(b.name));

function findItem(type, re, rec) {
  const list = itemsOf(type, rec);
  return list.find((i) => re.test(i.name)) ?? list[0];
}
function defaultSel(body) {
  const rec = { body, skin: S.skin, sel: {} };
  rec.sel.body = { id: 'body' };
  rec.sel.head = { id: Lib.byId.get(DEFAULT_HEAD[body]) ? DEFAULT_HEAD[body] : findItem('head', /Human/, rec)?.id };
  const add = (type, re, colours) => { const it = findItem(type, re, rec); if (it) rec.sel[type] = { id: it.id, colours }; };
  add('hair', /^(Plain|Messy|Parted|Bangs|Pixie|Bob)/i, [{ mat: 'hair', ver: 'ulpc', name: 'dark_brown' }]);
  add('clothes', /^(Longsleeve|Shortsleeve|Tunic|Shirt)/i, [{ mat: 'cloth', ver: 'ulpc', name: 'blue' }]);
  add('legs', /Pants/i, [{ mat: 'cloth', ver: 'ulpc', name: 'brown' }]);
  add('shoes', /Shoes|Boots/i, [{ mat: 'cloth', ver: 'ulpc', name: 'leather' }]);
  return rec.sel;
}

/** Drop what no longer fits (after a body change or the Steam-safe filter), keeping body and head. */
const SAFE_BODY = { muscular: 'male', pregnant: 'female' };
function adapt(rec) {
  if (steamOnly() && !itemSafe(Lib.byId.get('body'), rec.body) && SAFE_BODY[rec.body]) rec.body = SAFE_BODY[rec.body];
  for (const [type, s] of Object.entries(rec.sel)) {
    const it = Lib.byId.get(s.id);
    if (it && fits(it, rec, type)) continue;
    if (type === 'head') rec.sel.head = { id: DEFAULT_HEAD[rec.body], colours: s.colours };
    else if (type === 'body' && s.id !== 'body') rec.sel.body = { id: 'body' };
    else if (type === 'body') rec.sel.body = { id: 'body' };
    else {
      // The same thing for this body, if there is one (often "… child").
      const twin = it && itemsOf(type, rec).find((i) => i.name.replace(/ child$/i, '') === it.name.replace(/ child$/i, ''));
      if (twin) rec.sel[type] = { ...s, id: twin.id }; else delete rec.sel[type];
    }
  }
  return rec;
}

function setDirty(d = true) { S.dirty = d; $('btnSave').classList.toggle('dirty', d); saveDraft(); }

/* Rendering ---------------------------------------------------------------------------------------------------- */
let strip = null, stripKey = '', loading = 0;
let queued = false;
function redraw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; renderAll(); });
}
const recipeKey = () => JSON.stringify([S.body, S.skin, S.leftEye, S.sel, S.anim]);

async function refreshStrip() {
  const key = recipeKey();
  if (key === stripKey) return;
  stripKey = key;
  loading++; $('loading').hidden = false;
  try {
    const c = await compositeAnim(S, S.anim);
    if (key === stripKey) strip = c;
  } catch (e) { toast(e.message, true); }
  finally { loading--; if (!loading) $('loading').hidden = true; }
}

function renderAll() {
  if (!Lib.cat) return;
  renderMode();
  if (MODE === 'weapons') { Weap.render(); return; }
  if (document.activeElement !== $('charName')) $('charName').value = S.name;
  const anims = availableAnims(S);
  if (!anims.includes(S.anim)) S.anim = 'walk';
  renderBodies(); renderTabs(); renderTypes(); renderParts(); renderColours(); renderAnimBar(anims); renderLicence(); renderExportSets();
  $('charCount').textContent = saved.chars.length ? String(saved.chars.length) : '';
  $('steamSafe').checked = steamOnly();
  refreshStrip();
}

function renderBodies() {
  $('bodies').replaceChildren(...BODY_TYPES.map(([id, name]) => {
    const c = canvas(F, F);
    const rec = id === S.body ? S : adapt({ body: id, skin: S.skin, sel: JSON.parse(JSON.stringify(S.sel)) });
    drawThumbRecipe(rec, c.getContext('2d'), 0, 0, F, ['body', 'head', 'hair']);
    const ok = !steamOnly() || itemSafe(Lib.byId.get('body'), id);
    return h('button', { type: 'button', role: 'radio', 'aria-checked': String(id === S.body), disabled: !ok, title: ok ? undefined : 'This body isn’t Steam-safe (turn off “Steam-safe parts only” to use it)', onclick: () => switchBody(id) }, c, h('b', { text: name }));
  }));
}

function renderTabs() {
  $('tabs').replaceChildren(...TABS.map(([id, name]) => {
    const n = typesOf(id).filter((t) => S.sel[t]).length;
    return h('button', { type: 'button', role: 'tab', 'aria-selected': String(id === S.tab), onclick: () => { S.tab = id; S.type = typesOf(id)[0]; S.query = ''; redraw(); } }, name, n ? h('span', { class: 'pick', text: String(n) }) : null);
  }));
}

function renderTypes() {
  const types = typesOf(S.tab).filter((t) => itemsOf(t).length || S.sel[t]);
  if (!types.includes(S.type)) S.type = types[0] ?? S.type;
  $('types').hidden = types.length < 2;
  $('types').replaceChildren(...types.map((t) => {
    const it = S.sel[t] && Lib.byId.get(S.sel[t].id);
    return h('button', { type: 'button', 'aria-pressed': String(t === S.type), onclick: () => { S.type = t; S.query = ''; redraw(); } },
      typeLabel(t), it ? h('small', { text: it.name }) : null);
  }));
}

function renderParts() {
  const type = S.type, cur = S.sel[type]?.id ?? null;
  let list = itemsOf(type);
  const q = S.query.trim().toLowerCase();
  $('partSearch').hidden = list.length < 16;
  if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
  $('partTitle').textContent = typeLabel(type);
  $('partNote').textContent = `${list.length} ${steamOnly() ? 'Steam-safe ' : ''}choice${list.length === 1 ? '' : 's'}` + (S.tab === 'back' ? ' · shown from behind: face ↑ to see them' : '');
  const tile = (it) => {
    const c = canvas(F, F), g = c.getContext('2d');
    // The whole outfit with this choice swapped in (bodies and heads shown on their own).
    const rec = { body: S.body, skin: S.skin, sel: { ...S.sel } };
    if (it) rec.sel[type] = { id: it.id, colours: S.sel[type]?.colours, variant: undefined }; else delete rec.sel[type];
    // Capes, wings and packs are pictured from behind, on their own (over a front view they'd hide the outfit).
    drawThumbRecipe(rec, g, 0, 0, F, type === 'body' ? ['body'] : type === 'head' ? ['body', 'head'] : S.tab === 'back' ? [type] : null);
    return h('button', { type: 'button', class: 'tile' + (it ? '' : ' none'), 'aria-pressed': String((it?.id ?? null) === cur), title: it ? `${it.name}${itemSafe(it, S.body) ? '' : ' (not Steam-safe)'}` : 'None', onclick: () => pick(type, it?.id ?? null) },
      c, h('span', { text: it ? it.name : 'None' }), it && !itemSafe(it, S.body) ? h('i', { class: 'lic', text: 'SA/GPL' }) : null);
  };
  $('parts').replaceChildren(...(REQUIRED.has(type) ? [] : [tile(null)]), ...list.map(tile));
}

function renderColours() {
  const s = S.sel[S.type], it = s && Lib.byId.get(s.id);
  const box = $('colours');
  if (!it || (!it.colours?.length && !it.variants?.length)) { $('colourPanel').hidden = true; return; }
  $('colourPanel').hidden = false;
  const parts = [];
  if (it.variants?.length) {
    parts.push(h('div', { class: 'chan' }, h('span', { class: 'chan-label', text: 'Style' }),
      h('div', { class: 'chips' }, it.variants.map((v) => h('button', { type: 'button', 'aria-pressed': String((s.variant ?? it.variants[0]) === v), onclick: () => { s.variant = v; setDirty(); redraw(); } }, v.replace(/_/g, ' '))))));
  }
  (it.colours ?? []).forEach((ch, i) => {
    const skinLinked = ch.material === 'body' && (it.matchBody || it.type === 'body');
    const cur = skinLinked ? S.skin : s.colours?.[i];
    const choices = Lib.choices(ch);
    const sw = (c) => h('button', { type: 'button', class: 'sw', title: c.ref.name.replace(/_/g, ' '), 'aria-label': c.ref.name.replace(/_/g, ' '),
      style: `background:linear-gradient(135deg, ${c.cols[Math.min(c.cols.length - 1, 4)]} 0 45%, ${c.cols[Math.min(c.cols.length - 1, 2)]} 45%)`,
      'aria-pressed': String(!!cur && cur.mat === c.ref.mat && cur.ver === c.ref.ver && cur.name === c.ref.name),
      onclick: () => {
        if (skinLinked) S.skin = c.ref;
        else { s.colours = [...(s.colours ?? [])]; s.colours[i] = c.ref; }
        setDirty(); redraw();
      } });
    const main = choices.filter((c) => c.group !== 'all'), any = choices.filter((c) => c.group === 'all');
    const eye = ch.material === 'eye';
    const label = skinLinked ? 'Skin tone (whole body)' : eye ? (S.leftEye ? 'Their right eye' : 'Eyes') : ch.label === 'Colour' ? Lib.cat.materials[ch.material]?.label ?? 'Colour' : ch.label;
    parts.push(h('div', { class: 'chan' },
      h('span', { class: 'chan-label', text: label }),
      h('div', { class: 'swatches' }, main.map(sw)),
      any.length ? h('details', { class: 'more' }, h('summary', {}, `More colours (${any.length})`), h('div', { class: 'swatches' }, any.map(sw))) : null));
    if (eye) {
      // A different left eye (heterochromia). Shared by every part that draws eyes.
      const leftSw = (c) => h('button', { type: 'button', class: 'sw', title: c.ref.name.replace(/_/g, ' '), 'aria-label': 'Left eye: ' + c.ref.name.replace(/_/g, ' '),
        style: `background:linear-gradient(135deg, ${c.cols[Math.min(c.cols.length - 1, 4)]} 0 45%, ${c.cols[Math.min(c.cols.length - 1, 2)]} 45%)`,
        'aria-pressed': String(!!S.leftEye && S.leftEye.ver === c.ref.ver && S.leftEye.name === c.ref.name),
        onclick: () => { S.leftEye = c.ref; setDirty(); redraw(); } });
      parts.push(h('div', { class: 'chan' },
        h('label', { class: 'set' }, h('input', { type: 'checkbox', checked: !!S.leftEye, onchange: (e) => {
          S.leftEye = e.target.checked ? (main.find((c) => !cur || c.ref.name !== cur.name) ?? main[0]).ref : null;
          setDirty(); redraw();
        } }), h('span', {}, 'Different colour for each eye')),
        S.leftEye ? h('span', { class: 'chan-label', text: 'Their left eye (on your right when they face you)' }) : null,
        S.leftEye ? h('div', { class: 'swatches' }, main.map(leftSw)) : null));
    }
  });
  box.replaceChildren(...parts);
}

function renderAnimBar(anims) {
  $('anims').replaceChildren(...anims.map((a) => h('button', { type: 'button', 'aria-pressed': String(a === S.anim), onclick: () => { S.anim = a; saveDraft(); redraw(); } }, ANIM_LABEL[a])));
  for (const b of $('dirs').children) b.setAttribute('aria-pressed', String(+b.dataset.dir === S.dir));
  for (const b of $('bgs').children) b.setAttribute('aria-pressed', String(b.dataset.bg === S.bg));
  $('btnPlay').textContent = S.playing ? 'Pause' : 'Play';
}

function renderLicence() {
  const bad = selectedItems(S).filter((x) => !itemSafe(x.it, S.body));
  const box = $('licence');
  if (!bad.length) { box.className = 'licence ok'; box.replaceChildren(h('b', {}, 'Steam-safe'), ' Every part is CC0 or OGA-BY (credit the artists; DRM is fine).'); return; }
  box.className = 'licence warn';
  box.replaceChildren(h('b', {}, 'Not Steam-safe'), ` ${bad.map((x) => x.it.name).join(', ')} ${bad.length === 1 ? 'is' : 'are'} only CC-BY-SA / GPL. `,
    h('button', { type: 'button', class: 'btn small', onclick: () => { for (const x of bad) { const t = x.it.type; if (REQUIRED.has(t)) adapt(S); else delete S.sel[t]; } setDirty(); redraw(); } }, 'Remove them'));
}

function exportAnims() {
  const sets = saved.settings.sets ?? {};
  const want = Object.entries(ANIM_SETS).filter(([k, v]) => v.always || sets[k]).flatMap(([, v]) => v.anims);
  const have = availableAnims(S);
  return want.filter((a) => have.includes(a));
}
function renderExportSets() {
  const sets = saved.settings.sets ?? {};
  $('sets').replaceChildren(...Object.entries(ANIM_SETS).map(([k, v]) => h('label', { class: 'set' },
    h('input', { type: 'checkbox', checked: v.always || !!sets[k], disabled: v.always, onchange: (e) => setSettings({ sets: { ...sets, [k]: e.target.checked } }) }),
    h('span', {}, v.label))));
  const anims = exportAnims();
  const rows = anims.reduce((n, a) => n + Lib.cat.anims[a].dirs, 0);
  const w = Math.max(...anims.map((a) => Lib.cat.anims[a].frames)) * F, hh = rows * F;
  $('sheetSize').textContent = `${w} × ${hh} px · about ${((w * hh * 4) / 1048576).toFixed(1)} MB of video memory in the game`;
}

/* Animated stage ------------------------------------------------------------------------------------------------ */
const bgCache = {};
function background(kind, w, hh, z) {
  const key = `${kind}|${w}|${hh}|${z}`;
  if (bgCache[key]) return bgCache[key];
  const c = canvas(w, hh), g = c.getContext('2d'), t = 32 * z;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < hh; y += t) for (let x = 0; x < w; x += t) {
    if (kind === 'check') { g.fillStyle = ((x + y) / t) % 2 ? '#232a3e' : '#1a2032'; g.fillRect(x, y, t, t); continue; }
    if (kind === 'grass') {
      g.fillStyle = ['#4d7a3a', '#527f3d', '#4a7537'][Math.floor(rnd() * 3)]; g.fillRect(x, y, t, t);
      for (let i = 0; i < 10; i++) { g.fillStyle = rnd() < 0.5 ? '#5f8f46' : '#3f6630'; g.fillRect(x + Math.floor(rnd() * 31) * z, y + Math.floor(rnd() * 30) * z, z, z * 2); }
    } else {
      g.fillStyle = ['#6b6e78', '#72757f', '#666972'][Math.floor(rnd() * 3)]; g.fillRect(x, y, t, t);
      g.fillStyle = '#4f525b'; g.fillRect(x, y + t - z, t, z); g.fillRect(x + t - z, y, z, t);
    }
  }
  return (bgCache[key] = c);
}

const turn = [];
/** Turnaround: the same frame in all four directions. */
function ensureTurn() {
  if (turn.length) return;
  for (const [d, name] of [[2, 'Down'], [1, 'Left'], [3, 'Right'], [0, 'Up']]) {
    const c = canvas(F, F);
    c.addEventListener('click', () => { S.dir = d; saveDraft(); redraw(); });
    turn.push([d, c]);
    $('turn').append(h('figure', {}, c, h('figcaption', { text: name })));
  }
}

/** Show the character builder or the weapon builder. */
function renderMode() {
  const w = MODE === 'weapons';
  for (const b of $('modes').children) b.setAttribute('aria-pressed', String(b.dataset.mode === MODE));
  $('brandText').textContent = w ? 'Weapon Builder' : 'Character Builder';
  for (const [id, show] of [['charNameField', !w], ['charActions', !w], ['wardrobe', !w], ['charExport', !w], ['weapNameField', w], ['weapActions', w], ['armory', w], ['weapStage', w]]) $(id).hidden = !show;
  $('preview').setAttribute('aria-label', w ? 'Your character swinging the weapon' : 'Your character, animated');
}
function setMode(m) {
  if (m === MODE) return;
  MODE = m;
  try { localStorage.setItem('lpc:mode', m); } catch { /* fine */ }
  stripKey = '';
  redraw();
}
function tick(time) {
  requestAnimationFrame(tick);
  const cv = $('preview'), box = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(box.width * dpr)), H = Math.max(1, Math.round(box.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const z = Math.max(1, Math.floor(Math.min(W / (F * 1.3), H / (F * 1.15))));
  g.drawImage(background(S.bg, W, H, Math.max(1, Math.round(z / 2))), 0, 0);
  ensureTurn();
  if (MODE === 'weapons') { if (Lib.cat) Weap.draw(g, W, H, z, time); return; }
  if (!strip) return;
  const info = Lib.cat.anims[S.anim], play = ANIM_PLAY[S.anim];
  const step = S.playing ? Math.floor(time / play.ms) % play.cycle.length : 0;
  const col = Math.min(info.frames - 1, play.cycle[step]);
  const row = info.dirs === 4 ? S.dir : 0;
  const x = Math.round((W - F * z) / 2), y = Math.round((H - F * z) / 2);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.ellipse(W / 2, y + F * z * 0.9, F * z * 0.2, F * z * 0.05, 0, 0, Math.PI * 2); g.fill();
  g.drawImage(strip, col * F, row * F, F, F, x, y, F * z, F * z);
  for (const [d, c] of turn) {
    if (c.width !== F) c.width = c.height = F;
    const tg = c.getContext('2d');
    tg.clearRect(0, 0, F, F);
    tg.drawImage(strip, col * F, (info.dirs === 4 ? d : 0) * F, F, F, 0, 0, F, F);
    c.classList.toggle('on', d === S.dir);
  }
}

/* Actions ------------------------------------------------------------------------------------------------------ */
function pick(type, id) {
  if (!id) delete S.sel[type];
  else {
    const prev = S.sel[type];
    const it = Lib.byId.get(id);
    // Keep the colours when switching between parts of the same kind.
    const keep = prev && Lib.byId.get(prev.id)?.colours?.[0]?.material === it.colours?.[0]?.material ? prev.colours : undefined;
    S.sel[type] = { id, colours: keep, variant: it.variants?.includes(prev?.variant) ? prev.variant : undefined };
  }
  if (type === 'head') adapt(S); // expressions follow the head
  setDirty(); redraw();
}
function switchBody(id) {
  if (id === S.body) return;
  S.body = id; adapt(S);
  if (!S.sel.head) S.sel.head = { id: DEFAULT_HEAD[id] };
  setDirty(); redraw();
}

function randomize() {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  const rec = { body: S.body, skin: r(Lib.choices(Lib.byId.get('body').colours[0]).filter((c) => c.ref.ver === 'ulpc').slice(0, 9)).ref, sel: { body: { id: 'body' } } };
  const heads = itemsOf('head', rec).filter((i) => /Human/.test(i.name));
  rec.sel.head = { id: (r(heads) ?? Lib.byId.get(DEFAULT_HEAD[S.body]))?.id ?? DEFAULT_HEAD[S.body] };
  const colours = (it) => (it.colours ?? []).map((ch) => { const c = Lib.choices(ch).filter((x) => x.group !== 'all'); return c.length ? r(c).ref : undefined; });
  const maybe = (type, chance, filter = () => true) => {
    if (Math.random() > chance) return;
    const list = itemsOf(type, rec).filter(filter);
    if (!list.length) return;
    const it = r(list);
    rec.sel[type] = { id: it.id, colours: colours(it), variant: it.variants ? r(it.variants) : undefined };
  };
  maybe('hair', 0.9); maybe('clothes', 0.95); maybe('legs', 0.95); maybe('shoes', 0.9);
  maybe('jacket', 0.15); maybe('vest', 0.15); maybe('belt', 0.3); maybe('hat', 0.2);
  if (S.body === 'male' || S.body === 'muscular') { maybe('beard', 0.25); maybe('mustache', 0.12); }
  maybe('eyebrows', 0.5); maybe('cape', 0.08);
  Object.assign(S, { skin: rec.skin, leftEye: Math.random() < 0.05 ? r(Lib.choices(Lib.byId.get(DEFAULT_HEAD[S.body] ?? 'heads_human_male').colours.find((c) => c.material === 'eye'))).ref : null, sel: rec.sel });
  setDirty(); redraw();
}

function newCharacter() {
  Object.assign(S, { id: null, name: 'New character', skin: SKIN_DEFAULT, leftEye: null, sel: defaultSel(S.body) });
  setDirty(false); redraw();
}

async function saveCharacter() {
  if (!store) return;
  S.name = $('charName').value.trim() || 'New character';
  try {
    S.id = await store.saveChar({ id: S.id ?? undefined, name: S.name, body: S.body, skin: S.skin, leftEye: S.leftEye ?? null, sel: S.sel });
    setDirty(false); toast(`Saved “${S.name}”`);
  } catch (e) { toast('Couldn’t save: ' + (e?.message || e), true); }
}

function loadCharacter(c) {
  Object.assign(S, { id: c.id, name: c.name, body: c.body, skin: c.skin ?? SKIN_DEFAULT, leftEye: c.leftEye ?? null, sel: JSON.parse(JSON.stringify(c.sel ?? {})) });
  adapt(S); setDirty(false); redraw();
}

const toBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));
function creditsText(list, title) {
  const seen = new Set(), lines = [];
  for (const c of list) {
    const k = c.file + '|' + c.authors.join();
    if (seen.has(k)) continue;
    seen.add(k);
    lines.push(`- ${c.item}: ${c.authors.join(', ')}. Licence: ${c.licenses.join(' / ')}.${c.urls.length ? '\n  ' + c.urls.join('\n  ') : ''}`);
  }
  return `${title}\n${'='.repeat(title.length)}\n\nSprites from the Liberated Pixel Cup (LPC) collection on OpenGameArt.org,\nvia the Universal LPC Spritesheet Character Generator.\nWhere a part lists several licences, it is available under any one of them.\n\n${lines.join('\n')}\n`;
}

async function sheetBlob(rec, name, id = rec === S ? S.id : null) {
  const anims = exportAnims().filter((a) => availableAnims(rec).includes(a));
  const { canvas: c, layout } = await buildSheet(rec, anims);
  const credits = creditsFor(rec);
  const meta = { format: 'lpc', version: 1, name, body: rec.body, frame: F, dirs: DIRS, anims: layout, steamSafe: selectedItems(rec).every((x) => itemSafe(x.it, rec.body)),
    credits: credits.map(({ item, authors, licenses, urls }) => ({ item, authors, licenses, urls })),
    // How it was built, so any copy of the builder can open it again (Import).
    recipe: { id: id ?? undefined, name, body: rec.body, skin: rec.skin, leftEye: rec.leftEye ?? null, sel: rec.sel } };
  return { blob: await pngWithText(await toBlob(c), 'hd2d-character', JSON.stringify(meta)), credits };
}

/**
 * Clothes only (an item's look when worn, Update 114): the character's torso, legs, feet, arms, hats and back pieces
 * without the body, head, face or hair, in the same layout as a full sheet. The engine draws it over a hero's sheet
 * while they wear the item (Database → Items → Look when worn).
 */
const WORN_TABS = new Set(['torso', 'legs', 'feet', 'arms', 'headwear', 'back']);
async function exportWorn() {
  $('loading').hidden = false;
  try {
    const sel = Object.fromEntries(Object.entries(S.sel).filter(([, s]) => WORN_TABS.has(Lib.byId.get(s.id)?.tab)));
    if (!Object.keys(sel).length) { toast('Pick some clothes, armor or a hat first', true); return; }
    const rec = { ...S, sel };
    const anims = exportAnims().filter((a) => availableAnims(S).includes(a));
    const { canvas: c, layout } = await buildSheet(rec, anims);
    const credits = creditsFor(rec);
    const name = `${S.name} (worn)`;
    const meta = { format: 'lpc', version: 1, name, body: S.body, worn: true, frame: F, dirs: DIRS, anims: layout, steamSafe: selectedItems(rec).every((x) => itemSafe(x.it, S.body)),
      credits: credits.map(({ item, authors, licenses, urls }) => ({ item, authors, licenses, urls })) };
    const blob = await pngWithText(await toBlob(c), 'hd2d-character', JSON.stringify(meta));
    const r = await saveFile(slug(S.name) + '_worn_' + (S.body === 'female' || S.body === 'teen' || S.body === 'pregnant' ? 'femme' : 'masc') + '.png', blob);
    if (r === 'saved') toast('Exported the clothes only: use it as an item’s Look when worn (Database → Items)');
  } catch (e) { toast(e.message, true); }
  finally { $('loading').hidden = !loading; }
}

async function exportPng(rec = S, name = S.name, id = rec === S ? S.id : null) {
  $('loading').hidden = false;
  try {
    const { blob } = await sheetBlob(rec, name, id);
    const r = await saveFile(slug(name) + '.png', blob);
    if (r === 'saved') toast(`Exported ${slug(name)}.png (credits are inside it too)`);
  } catch (e) { toast(e.message, true); }
  finally { $('loading').hidden = !loading; }
}
async function exportCredits(rec = S, name = S.name) {
  try { await saveFile(slug(name) + '_credits.txt', new Blob([creditsText(creditsFor(rec), `Credits: ${name}`)], { type: 'text/plain' })); }
  catch (e) { toast(e.message, true); }
}
async function exportAll() {
  if (!saved.chars.length) { toast('Save a character first', true); return; }
  $('loading').hidden = false;
  try {
    const files = [], used = new Set(), allCredits = [];
    for (const c of saved.chars) {
      const rec = adapt({ body: c.body, skin: c.skin ?? SKIN_DEFAULT, leftEye: c.leftEye ?? null, sel: JSON.parse(JSON.stringify(c.sel ?? {})) });
      let n = slug(c.name), k = 2;
      while (used.has(n)) n = slug(c.name) + '_' + k++;
      used.add(n);
      const { blob, credits } = await sheetBlob(rec, c.name, c.id);
      files.push({ name: n + '.png', data: blob });
      allCredits.push(...credits);
    }
    files.push({ name: 'CREDITS.txt', data: creditsText(allCredits, 'Character sprite credits') });
    await saveFile('characters.zip', await Zip.write(files));
    toast(`Exported ${saved.chars.length} characters with their credits`);
  } catch (e) { toast(e.message, true); }
  finally { $('loading').hidden = !loading; }
}

async function setSettings(patch) {
  saved.settings = { ...saved.settings, ...patch };
  if ('steamSafe' in patch) adapt(S);
  redraw();
  try { await store?.saveSettings(saved.settings); } catch (e) { toast('Couldn’t save the setting: ' + e.message, true); }
}

function saveDraft() {
  try { localStorage.setItem('lpc:draft', JSON.stringify({ id: S.id, name: S.name, body: S.body, skin: S.skin, leftEye: S.leftEye, sel: S.sel, tab: S.tab, type: S.type, anim: S.anim, dir: S.dir, bg: S.bg, dirty: S.dirty })); } catch { /* fine */ }
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem('lpc:draft') || 'null');
    if (d && BODY_NAME[d.body] && d.sel) { Object.assign(S, d); return true; }
  } catch { /* fine */ }
  return false;
}

/* Characters sheet --------------------------------------------------------------------------------------------- */
function confirmButton(label, run) {
  const b = h('button', { type: 'button', class: 'btn danger', text: label });
  b.addEventListener('click', async () => {
    if (b.dataset.armed) { b.disabled = true; await run(); return; }
    b.dataset.armed = '1'; b.textContent = 'Tap again to delete';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = label; } }, 3500);
  });
  return b;
}
function renderChars() {
  const body = $('charsBody');
  if (!saved.chars.length) { body.replaceChildren(h('p', { class: 'empty' }, 'No saved characters yet. Build one and press Save, and it will be listed here.')); return; }
  const list = [...saved.chars].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  body.replaceChildren(
    h('p', { class: 'hint' }, 'Export PNG saves the sheet the engine imports (Database → Characters). Its animations and credits are stored inside the PNG.'),
    h('div', { class: 'list' }, list.map((c) => {
      const rec = adapt({ body: c.body, skin: c.skin ?? SKIN_DEFAULT, leftEye: c.leftEye ?? null, sel: JSON.parse(JSON.stringify(c.sel ?? {})) });
      const cv = canvas(F, F); drawThumbRecipe(rec, cv.getContext('2d'));
      const safeOk = selectedItems(rec).every((x) => itemSafe(x.it, rec.body));
      return h('div', { class: 'item' }, cv,
        h('div', { class: 'info' }, h('b', { text: c.name }), h('span', { class: 'sub', text: `${BODY_NAME[c.body] ?? c.body}${safeOk ? ' · Steam-safe' : ' · not Steam-safe'}${c.id === S.id ? ' · open now' : ''}` })),
        h('div', { class: 'btns' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => { loadCharacter(c); closeSheets(); } }, 'Open'),
          h('button', { type: 'button', class: 'btn', onclick: () => { loadCharacter({ ...c, id: null, name: c.name + ' copy' }); setDirty(); closeSheets(); } }, 'Copy'),
          h('button', { type: 'button', class: 'btn', onclick: () => exportPng(rec, c.name, c.id) }, 'PNG'),
          confirmButton('Delete', async () => { await store.deleteChar(c.id); if (S.id === c.id) S.id = null; toast(`Deleted “${c.name}”`); })));
    })));
}
function openSheet(id) { $(id).hidden = false; $(id).querySelector('[data-close]')?.focus(); if (id === 'charsSheet') renderChars(); if (id === 'weapsSheet') Weap.renderList(); }
function closeSheets() { for (const id of ['charsSheet', 'weapsSheet', 'aboutSheet']) $(id).hidden = true; }

/* Start -------------------------------------------------------------------------------------------------------- */
function wire() {
  $('charName').addEventListener('input', (e) => { S.name = e.target.value; setDirty(); });
  $('btnRandom').onclick = randomize;
  $('btnNew').onclick = newCharacter;
  $('btnSave').onclick = saveCharacter;
  $('btnExport').onclick = () => exportPng();
  $('btnExportWorn').onclick = () => exportWorn();
  $('btnCredits').onclick = () => exportCredits();
  $('btnChars').onclick = () => openSheet('charsSheet');
  $('btnAbout').onclick = () => openSheet('aboutSheet');
  $('btnExportAll').onclick = exportAll;
  $('btnPlay').onclick = () => { S.playing = !S.playing; redraw(); };
  for (const b of $('modes').children) b.onclick = () => setMode(b.dataset.mode);
  // Back up / import, the same in the Characters and Weapons lists (one file holds both).
  for (const box of document.querySelectorAll('[data-transfer]')) box.replaceChildren(
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: backupLibrary }, 'Back up (.json)'),
      h('button', { type: 'button', class: 'btn', onclick: pickLibraryFiles }, 'Import…')),
    h('p', { class: 'hint' }, 'Move your characters and weapons between this builder and another one (the tablet and the PC): Back up saves them all, with every setting, in one file; Import adds that file (or exported PNGs, or an Export all .zip) to the library here.'));
  Weap.wire();
  $('steamSafe').onchange = (e) => setSettings({ steamSafe: e.target.checked });
  $('partSearch').addEventListener('input', (e) => { S.query = e.target.value; renderParts(); });
  for (const b of $('dirs').children) b.onclick = () => { S.dir = +b.dataset.dir; saveDraft(); redraw(); };
  for (const b of $('bgs').children) b.onclick = () => { S.bg = b.dataset.bg; saveDraft(); redraw(); };
  for (const s of document.querySelectorAll('.scrim')) s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) closeSheets(); });
  document.addEventListener('keydown', (e) => {
    // Backspace closes too (tablet keyboards without Esc), except while typing.
    if (e.key === 'Escape' || (e.key === 'Backspace' && !e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=button]), textarea, [contenteditable]'))) closeSheets();
    if (e.target.matches('input, select, textarea')) return;
    const d = { ArrowUp: 0, ArrowLeft: 1, ArrowDown: 2, ArrowRight: 3 }[e.key];
    if (d !== undefined) { S.dir = d; redraw(); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (MODE === 'weapons') Weap.save(); else saveCharacter(); }
  });
}

async function start() {
  try { if (localStorage.getItem('lpc:mode') === 'weapons' || /[?&#]weapons\b/.test(location.search + location.hash)) MODE = 'weapons'; } catch { /* fine */ }
  wire();
  renderMode();
  requestAnimationFrame(tick);
  // On your PC (served by the map editor's little server): keep the server running while the builder is open.
  const local = location.protocol.startsWith('http') && /^\/builder\//.test(location.pathname);
  if (local) { const ping = () => fetch('/__editor/ping', { cache: 'no-store' }).catch(() => {}); ping(); setInterval(ping, 20000); }
  try { await Promise.all([Lib.load('./'), Arm.load()]); }
  catch (e) {
    $('loading').hidden = true; $('fatal').hidden = false;
    $('fatal').textContent = local && /\(404\)/.test(e.message)
      ? 'The parts library is missing: tools/lpc/library should be in the engine folder (it comes with the engine). Put it back, then reload this page.'
      : e.message + '. Reload the page to try again.';
    return;
  }
  Weap.loadDraft();
  if (!loadDraft()) S.sel = defaultSel(S.body);
  adapt(S);
  redraw();
  store = await openStore();
  store.subscribe((snap) => {
    if (snap.error) toast(snap.error, true);
    saved = { chars: snap.chars, weapons: snap.weapons ?? [], settings: snap.settings };
    adapt(S);
    redraw();
    if (!$('charsSheet').hidden) renderChars();
    if (!$('weapsSheet').hidden) Weap.renderList();
  });
}
start();
