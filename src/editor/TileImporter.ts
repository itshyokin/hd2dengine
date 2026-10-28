/**
 * "Import tile" dialog. Load a (seamless) texture and an optional normal map, choose how many
 * tiles one copy covers, the resolution and filtering, and whether it blocks movement.
 * The preview shows a patch of ground tiled with the result, exactly as it will be saved.
 */
import { canvasFromBlob, canvasFromImage, loadImage } from '../shared/images';
import { MAX_CUSTOM_TILES, freeTileKey } from '../world/tiles';
import type { TileDef } from '../world/types';
import { type TileImages, cliffChoices, commitTile, mapCliffName, setTileCliff } from './assets';
import { checkbox, field, h, numberInput, openModal, select, textInput, toast } from './dom';
import { drawPixelTile, frameAt, frameLayout } from '../world/pixelTiles';
import { customTileImage } from './editorArt';
import type { EditorStore } from './store';

type Res = 'keep' | '16' | '24' | '32' | '48' | '64';
interface Src { canvas: HTMLCanvasElement; name: string }

const MAX_OUTPUT = 4096;
const PREVIEW_COLS = 6, PREVIEW_ROWS = 4;

/**
 * `skinOf`: a built-in tile getting a picture of its own (its key, name and everything else kept; `existing` is
 * its current picture, if it has one).
 */
export async function openTileImporter(store: EditorStore, existing?: TileDef, skinOf?: TileDef): Promise<void> {
  if (!existing && !skinOf && store.tiles.custom().length >= MAX_CUSTOM_TILES) {
    toast(`You’ve reached the limit of ${MAX_CUSTOM_TILES} imported tiles.`, 'error');
    return;
  }
  const st = {
    name: skinOf?.name ?? existing?.name ?? '',
    span: existing?.span ?? 1,
    res: 'keep' as Res,
    filter: existing?.filter ?? ('point' as 'point' | 'smooth'),
    blocks: !!existing?.blocks,
    /** Cliff walls under this tile: '' map default, 'self' this tile, or a look key. */
    cliff: existing ? (store.tiles.cliffChoice(existing.key) === existing.key ? 'self' : store.tiles.cliffChoice(existing.key) ?? '') : '',
    flipGreen: false,
    flat: !!existing?.flat,
    /** Update 146: plain, animated (a strip of frames) or an RPG Maker autotile (2 × 3 tiles, perhaps several side by side). */
    kind: (existing?.kind ?? 'plain') as 'plain' | 'animated' | 'autotile',
    /** Frames (0: worked out from the picture). */
    frames: existing?.frames ?? 0,
    fps: existing?.fps ?? 4,
    grid: true,
    image: undefined as Src | undefined,
    normal: undefined as Src | undefined,
  };
  if (existing) {
    const img = customTileImage(existing.key);
    if (!img) { toast('This tile’s texture isn’t loaded, so it can’t be edited.', 'error'); return; }
    st.image = { canvas: img, name: existing.image?.split('/').pop() ?? 'texture.png' };
    const nb = existing.normal ? store.files.get(existing.normal) : undefined;
    if (nb) st.normal = { canvas: await canvasFromBlob(nb), name: existing.normal!.split('/').pop()! };
  }

  /* ---------------------------------------------------------------- preview */
  const canvas = h('canvas', { class: 'tile-preview-canvas', 'aria-label': 'Preview of the tile repeated across the ground' });
  const wrap = h('div', { class: 'crop-wrap tile-preview' }, canvas,
    h('div', { class: 'crop-empty' }, h('p', {}, 'Choose a texture to start, or drop one here.'), h('p', { class: 'hint' }, 'Seamless (tileable) textures work best: 32 × 32 px per tile matches the characters.')));
  const foot = h('span', { class: 'importer-foot' });
  let processed: HTMLCanvasElement | null = null;

  const ppt = () => {
    if (!st.image) return 16;
    const side = Math.min(st.image.canvas.width, st.image.canvas.height);
    const want = st.res === 'keep' ? Math.round(side / st.span) : parseInt(st.res, 10);
    return Math.max(4, Math.min(want, Math.floor(MAX_OUTPUT / st.span)));
  };

  const pixel = () => st.kind !== 'plain';
  /** The tile as it would be saved, for the frame helpers. */
  const asDef = (): TileDef => ({ key: '?', id: '?', name: '', span: 1, ...(pixel() ? { kind: st.kind as 'animated' | 'autotile' } : {}), ...(st.frames ? { frames: st.frames } : {}), fps: st.fps });
  function rebuild(): void {
    // RPG Maker-style tiles keep the picture exactly as it is (every frame, every quarter).
    processed = !st.image ? null : pixel() ? copyCanvas(st.image.canvas) : renderTile(st.image.canvas, st.span, ppt(), st.filter);
    draw();
  }
  // Animated tiles play in the preview while it's open.
  const timer = window.setInterval(() => { if (!wrap.isConnected) { window.clearInterval(timer); return; } if (pixel() && processed) draw(); }, 100);
  /** A pond shape for previewing autotiles (1 inside). */
  const POND = ['........', '..####..', '.######.', '.###.##.', '.######.', '..##....'];

  function draw(): void {
    const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#141826';
    ctx.fillRect(0, 0, r.width, r.height);
    (wrap.querySelector('.crop-empty') as HTMLElement).hidden = !!processed;
    if (!processed) { foot.textContent = ''; return; }
    const cell = Math.floor(Math.min((r.width - 24) / PREVIEW_COLS, (r.height - 24) / PREVIEW_ROWS));
    const ox = Math.round((r.width - cell * PREVIEW_COLS) / 2), oy = Math.round((r.height - cell * PREVIEW_ROWS) / 2);
    if (pixel()) {
      const d = asDef(), l = frameLayout(d, processed.width, processed.height), f = frameAt(d, l.frames, performance.now() / 1000);
      const inside = (x: number, z: number) => st.kind !== 'autotile' || (POND[z]?.[x] ?? '.') === '#';
      for (let z = 0; z < PREVIEW_ROWS; z++) for (let x = 0; x < PREVIEW_COLS; x++) {
        if (!inside(x, z)) { ctx.fillStyle = (x + z) % 2 ? '#2a3a2a' : '#2f402f'; ctx.fillRect(ox + x * cell, oy + z * cell, cell, cell); continue; }
        drawPixelTile(ctx, processed, d, ox + x * cell, oy + z * cell, cell, f, (dx, dz) => { const nx = x + dx, nz = z + dz; return nx < 0 || nz < 0 || nx >= PREVIEW_COLS || nz >= PREVIEW_ROWS || inside(nx, nz); });
      }
      foot.textContent = `${processed.width} × ${processed.height} px · ${l.frames} frame${l.frames === 1 ? '' : 's'}${st.kind === 'autotile' ? ` · ${Math.round(processed.height / 3)} px per tile` : ''}`;
      return;
    }
    const tilePx = processed.width / st.span;
    ctx.imageSmoothingEnabled = st.filter === 'smooth';
    ctx.imageSmoothingQuality = 'high';
    for (let z = 0; z < PREVIEW_ROWS; z++) for (let x = 0; x < PREVIEW_COLS; x++) {
      const ix = x % st.span, iz = z % st.span;
      ctx.drawImage(processed, ix * tilePx, iz * tilePx, tilePx, tilePx, ox + x * cell, oy + z * cell, cell, cell);
    }
    if (st.grid) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < PREVIEW_COLS; x++) { ctx.moveTo(ox + x * cell + 0.5, oy); ctx.lineTo(ox + x * cell + 0.5, oy + cell * PREVIEW_ROWS); }
      for (let z = 1; z < PREVIEW_ROWS; z++) { ctx.moveTo(ox, oy + z * cell + 0.5); ctx.lineTo(ox + cell * PREVIEW_COLS, oy + z * cell + 0.5); }
      ctx.stroke();
    }
    // One copy of the texture, outlined.
    ctx.strokeStyle = '#ffb04a';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 1, oy + 1, cell * Math.min(st.span, PREVIEW_COLS) - 2, cell * Math.min(st.span, PREVIEW_ROWS) - 2);
    const p = ppt();
    foot.textContent = `${p} px per tile · saved at ${processed.width} × ${processed.height} px`;
  }

  /* ---------------------------------------------------------------- files */
  const inputs = {
    image: h('input', { type: 'file', accept: 'image/*', hidden: true }),
    normal: h('input', { type: 'file', accept: 'image/*', hidden: true }),
    frame: h('input', { type: 'file', accept: 'image/*', hidden: true, multiple: true }),
  };
  /** Add frames from separate pictures (Update 146): each goes after the last, scaled to the same size. */
  async function addFrames(files: File[]): Promise<void> {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const fr = canvasFromImage(await loadImage(url));
        if (!st.image) { st.image = { canvas: fr, name: file.name }; if (!st.name) st.name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); continue; }
        const cur = st.image.canvas, d = asDef(), l = frameLayout(d, cur.width, cur.height);
        const fw = l.horiz ? cur.width / l.frames : cur.width, fh = l.horiz ? cur.height : cur.height / l.frames;
        const out = document.createElement('canvas');
        out.width = l.horiz ? cur.width + fw : cur.width; out.height = l.horiz ? cur.height : cur.height + fh;
        const g = out.getContext('2d')!; g.imageSmoothingEnabled = false;
        g.drawImage(cur, 0, 0);
        g.drawImage(fr, l.horiz ? cur.width : 0, l.horiz ? 0 : cur.height, fw, fh);
        st.image = { canvas: out, name: st.image.name };
        st.frames = l.frames + 1;
      } catch { toast(`Couldn’t read ${file.name} as an image.`, 'error'); }
      finally { URL.revokeObjectURL(url); }
    }
    renderForm();
    rebuild();
  }
  inputs.frame.addEventListener('change', () => { const f = [...(inputs.frame.files ?? [])]; if (f.length) void addFrames(f); inputs.frame.value = ''; });
  async function load(slot: 'image' | 'normal', file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      st[slot] = { canvas: canvasFromImage(await loadImage(url)), name: file.name };
      if (slot === 'image' && !st.name) st.name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      renderForm();
      rebuild();
    } catch { toast(`Couldn’t read ${file.name} as an image.`, 'error'); }
    finally { URL.revokeObjectURL(url); }
  }
  for (const slot of ['image', 'normal'] as const) {
    inputs[slot].addEventListener('change', () => { const f = inputs[slot].files?.[0]; if (f) void load(slot, f); inputs[slot].value = ''; });
  }
  wrap.addEventListener('click', () => { if (!st.image) inputs.image.click(); });
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.classList.add('drop'); });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('drop'));
  wrap.addEventListener('drop', (e) => { e.preventDefault(); wrap.classList.remove('drop'); const f = e.dataTransfer?.files?.[0]; if (f) void load('image', f); });

  /* ---------------------------------------------------------------- form */
  const form = h('div', { class: 'importer-form' });
  const slot = (key: 'image' | 'normal', label: string, hint: string) => {
    const src = st[key];
    return h('div', { class: 'slot' },
      h('div', { class: 'slot-head' }, h('span', { class: 'slot-label' }, label), src ? h('span', { class: 'slot-file', title: src.name }, src.name) : h('span', { class: 'slot-none' }, key === 'image' ? 'Required' : 'Optional')),
      h('div', { class: 'slot-actions' },
        h('button', { type: 'button', class: 'btn small', onclick: () => inputs[key].click() }, src ? 'Replace…' : 'Choose…'),
        src && key === 'normal' ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => { st.normal = undefined; renderForm(); } }, 'Remove') : null),
      h('p', { class: 'hint' }, hint));
  };

  function renderForm(): void {
    const parts: Node[] = [
      skinOf ? h('p', { class: 'hint' }, `This picture replaces the built-in “${skinOf.name}” everywhere it’s painted, on every map. Its sounds, edge blending, cliffs and everything else stay as they are; switch back to Built-in any time.`)
        : field('Name', textInput(st.name, (v) => (st.name = v.trim()), { placeholder: 'e.g. Cobblestone', oninput: (e: Event) => (st.name = (e.target as HTMLInputElement).value.trim()) })),
      skinOf ? h('span') : field('Kind', select([['plain', 'Plain (a repeating texture)'], ['animated', 'Animated (frames side by side or stacked)'], ['autotile', 'Autotile (RPG Maker A2: 2 × 3 tiles, edges drawn for you)']], st.kind,
        (v) => { st.kind = v as typeof st.kind; if (pixel()) { st.flat = true; st.filter = 'point'; } renderForm(); rebuild(); })),
      slot('image', pixel() ? 'Picture' : 'Texture', st.kind === 'autotile' ? 'RPG Maker’s A2 layout: 2 tiles wide, 3 tall (64 × 96 at 32 px). Animated (like A1 water): the frames’ blocks side by side.'
        : st.kind === 'animated' ? 'All the frames in one picture, side by side or stacked (3 frames of 32 px: 96 × 32 or 32 × 96), or add them one at a time below.'
        : 'Seamless textures repeat without visible seams. Non-square images are cropped to a square from the centre.'),
    ];
    if (pixel()) {
      const l = st.image ? frameLayout(asDef(), st.image.canvas.width, st.image.canvas.height) : null;
      parts.push(
        h('div', { class: 'field-row' },
          field('Frames', numberInput(st.frames || (l?.frames ?? 1), (v) => { st.frames = Math.max(1, Math.min(32, Math.round(v))); rebuild(); }, { step: 1, min: 1, max: 32 }), 'How many pictures the animation steps through (1: still).'),
          field('Speed (frames per second)', numberInput(st.fps, (v) => { st.fps = Math.max(0.5, Math.min(30, v)); }, { step: 0.5, min: 0.5, max: 30 }))),
        h('button', { type: 'button', class: 'btn small', onclick: () => inputs.frame.click() }, st.image ? '+ Add frames (separate pictures)…' : 'Choose frames (separate pictures)…'),
        h('p', { class: 'hint' }, 'Drawn crisp, flat on the ground, with no blended edges (the picture draws its own).'),
        checkbox('Blocks movement (water, walls…)', st.blocks, (v) => (st.blocks = v)));
      form.replaceChildren(...parts);
      return;
    }
    if (st.image && st.image.canvas.width !== st.image.canvas.height) parts.push(h('p', { class: 'warn' }, `This texture isn’t square (${st.image.canvas.width} × ${st.image.canvas.height}), so the middle square is used.`));
    parts.push(
      h('div', { class: 'section-label' }, 'How it repeats'),
      field('One copy covers', select([1, 2, 3, 4, 6, 8].map((n) => [String(n), `${n} × ${n} tile${n === 1 ? '' : 's'}`] as [string, string]), String(st.span), (v) => { st.span = parseInt(v, 10); rebuild(); }),
        'Bigger values spread a detailed texture over more tiles, so the repeat is less obvious.'),
      h('div', { class: 'field-row' },
        field('Resolution', select([['keep', 'Keep texture detail'], ['16', '16 px per tile'], ['24', '24 px per tile'], ['32', '32 px per tile'], ['48', '48 px per tile'], ['64', '64 px per tile']], st.res, (v) => { st.res = v as Res; rebuild(); })),
        field('Filtering', select([['point', 'Point (crisp pixels)'], ['smooth', 'Smooth']], st.filter, (v) => { st.filter = v as 'point' | 'smooth'; rebuild(); }))),
      h('p', { class: 'hint' }, 'Characters are drawn at 32 px per tile: draw tiles at 32 × 32 (or a seamless 64 × 64 or 128 × 128 covering 2 × 2 or 4 × 4 tiles) and keep Point filtering for crisp pixels.'),
      skinOf ? h('span') : checkbox('Blocks movement (water, walls…)', st.blocks, (v) => (st.blocks = v)),
      skinOf ? h('span') : field('Cliff walls under this tile', select([['', `Map default (${mapCliffName(store)})`], ['self', 'This tile'],
        ...cliffChoices(store).filter(([k]) => k !== existing?.key)], st.cliff, (v) => (st.cliff = v)),
        'When this tile is on top of a cliff, the wall below shows this. “This tile” uses the same texture for the wall.'),
      checkbox('Show grid in preview', st.grid, (v) => { st.grid = v; draw(); }),
      h('div', { class: 'section-label' }, 'Lighting'),
      slot('normal', 'Normal map', 'Adds bumps that react to lights. Without one, a normal map is generated from the texture.'),
    );
    if (st.normal) parts.push(checkbox('Flip green channel (DirectX-style normal map)', st.flipGreen, (v) => (st.flipGreen = v)));
    else parts.push(checkbox('Make a normal map from the texture (off: flat under the lights; cleaner for pixel art)', !st.flat, (v) => (st.flat = !v)));
    form.replaceChildren(...parts);
  }

  /* ---------------------------------------------------------------- save */
  async function save(close: () => void, btn: HTMLButtonElement): Promise<void> {
    if (!st.image || !processed) { toast('Choose a texture first.', 'error'); return; }
    if (!st.name) { toast('Give the tile a name.', 'error'); return; }
    const key = skinOf?.key ?? existing?.key ?? freeTileKey((k) => !!store.tiles.get(k));
    if (!key) { toast(`You’ve reached the limit of ${MAX_CUSTOM_TILES} imported tiles.`, 'error'); return; }
    btn.disabled = true;
    try {
      const p = ppt();
      const images: TileImages = { image: await toPng(processed) };
      if (st.normal && !pixel()) {
        const n = renderTile(st.normal.canvas, st.span, p, 'smooth');
        if (st.flipGreen) flipGreen(n);
        images.normal = await toPng(n);
      }
      const id = skinOf?.id ?? existing?.id ?? uniqueId(st.name, (x) => store.tiles.all().some((t) => t.id === x));
      const def: TileDef = { key, id, name: st.name, span: pixel() ? 1 : st.span, filter: pixel() ? 'point' : st.filter };
      if (pixel()) { def.kind = st.kind as 'animated' | 'autotile'; def.flat = true; if (st.frames) def.frames = st.frames; if (st.fps !== 4) def.fps = st.fps; }
      if (skinOf) def.skin = true;
      if (existing?.credits) def.credits = existing.credits;
      if (st.blocks) def.blocks = true;
      if (st.flat && !st.normal) def.flat = true;
      if (await commitTile(store, def, images, processed)) {
        const look = st.cliff === 'self' ? key : st.cliff || undefined;
        if (!skinOf && look !== store.tiles.cliffChoice(key)) await setTileCliff(store, key, look);
        store.terrain = key;
        store.mode = 'terrain';
        store.emit('ui');
        close();
      }
    } finally { btn.disabled = false; }
  }

  /* ---------------------------------------------------------------- open */
  const body = h('div', { class: 'importer' },
    h('div', { class: 'importer-left' }, wrap,
      h('p', { class: 'hint' }, 'The preview shows a patch of ground covered with this tile. The orange box is one copy of the texture.')),
    form, inputs.image, inputs.normal, inputs.frame);
  let closeFn: () => void = () => {};
  closeFn = openModal(skinOf ? `Picture for “${skinOf.name}”` : existing ? `Edit tile “${existing.name}”` : 'Import tile', body, [
    { label: 'Cancel' },
    { label: skinOf ? 'Use this picture' : existing ? 'Save changes' : 'Import tile', primary: true, onClick: () => {
      const btn = [...document.querySelectorAll<HTMLButtonElement>('.modal-foot .btn.primary')].pop()!;
      void save(closeFn, btn);
      return false;
    } },
  ], undefined, { wide: true, footStart: foot });
  renderForm();
  new ResizeObserver(() => draw()).observe(wrap);
  rebuild();
  if (!existing) inputs.image.click();
}

/**
 * Square texture covering `span` × `span` tiles at `ppt` pixels per tile, cut from the middle of `src`.
 * Shrinking averages pixels; enlarging keeps hard pixel edges unless smooth filtering is chosen.
 */
function renderTile(src: HTMLCanvasElement, span: number, ppt: number, filter: 'point' | 'smooth'): HTMLCanvasElement {
  const side = Math.min(src.width, src.height);
  const out = document.createElement('canvas');
  out.width = out.height = span * ppt;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = filter === 'smooth' || out.width < side;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, out.width, out.height);
  return out;
}

function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

function flipGreen(c: HTMLCanvasElement): void {
  const ctx = c.getContext('2d')!, img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 1; i < img.data.length; i += 4) img.data[i] = 255 - img.data[i];
  ctx.putImageData(img, 0, 0);
}

function toPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t encode the image'))), 'image/png'));
}

function uniqueId(name: string, taken: (id: string) => boolean): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'tile';
  let id = base, n = 2;
  while (taken(id)) id = `${base}_${n++}`;
  return id;
}
