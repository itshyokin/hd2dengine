/**
 * Database → Items → an armor, accessory or shield → Look when worn.
 * Update 128: an outfit from the built-in clothing (made from the Character Builder's parts): a Top, a Bottom and an
 * Accessory, each picked with ← → (or None), each with colour swatches (the part's own palettes) or a tint of your
 * choosing, and a live preview of the outfit on the player's look. On the far right, "Use custom clothes sprite"
 * switches to sheets of your own instead: Character Builder parts (Update 120) or exported PNGs (Update 114), for
 * masculine and feminine bodies. Heroes wear the version for their outfit gender (Database → Heroes).
 */
import type { CharacterDef, ItemDef, WornPick } from '../world/types';
import type { EditorStore } from './store';
import { readBuilderMeta } from '../shared/pngText';
import { canvasFromBlob } from '../shared/images';
import { characterSheetImage, setCharacterSheet } from './editorArt';
import { checkbox, h, toast } from './dom';
import { LPC_BODY, TAB_NAMES, WORN_TABS, buildWornSheet, channelChoices, loadParts, partById, partSafe, partsIn, previewParts, type WornPart } from './lpcParts';
import { WORN_SLOTS, WORN_SLOT_NAMES, loadWornParts, recolorCanvas, recolorPairs, standingCell, tintSheet, wornPart, wornParts, type WornSlot } from '../world/wornParts';

type Body = 'masc' | 'femme';
const toPng = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
let steamSafe = true;
let previewBody: Body = 'masc';

/** Built-in part sheets for the editor's previews (path → image). */
const sheetCache = new Map<string, Promise<HTMLImageElement | null>>();
function sheetImage(store: EditorStore, path: string): Promise<HTMLImageElement | null> {
  let p = sheetCache.get(path);
  if (!p) {
    p = (async () => {
      try {
        const b = await store.project.readFile(path);
        const url = URL.createObjectURL(b);
        return await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
      } catch { return null; }
    })();
    sheetCache.set(path, p);
  }
  return p;
}
let partsLoad: Promise<unknown> | null = null;
const ensureParts = (store: EditorStore) => (partsLoad ??= loadWornParts(async (p) => (await store.project.readFile(p)).text()));

/** One pick drawn standing (its swatch or tint applied) onto `g` at size `s`. */
async function drawPick(store: EditorStore, g: CanvasRenderingContext2D, pick: WornPick | undefined, body: Body, s: number, under = false): Promise<void> {
  const p = wornPart(pick?.part);
  const path = under ? p?.under?.[body] : p?.sheets[body], lay = p?.layout[body], cell = standingCell(lay);
  if (!p || !path || !cell) return;
  const img = await sheetImage(store, path);
  if (!img) return;
  const one = document.createElement('canvas'); one.width = one.height = cell.size;
  one.getContext('2d')!.drawImage(img, cell.x, cell.y, cell.size, cell.size, 0, 0, cell.size, cell.size);
  let c: HTMLCanvasElement = one;
  const pairs = recolorPairs(p, pick?.swatch);
  if (pairs) c = recolorCanvas(c, pairs);
  if (pick?.tint) c = tintSheet(c, pick.tint);
  g.drawImage(c, 0, 0, cell.size, cell.size, 0, 0, s, s);
}

export function wornLookForm(store: EditorStore, d: ItemDef, rerender: () => void): HTMLElement {
  const w = d.worn ?? {};
  const set = () => {
    const keep = w.masc || w.femme || w.parts?.masc?.length || w.parts?.femme?.length || w.top || w.bottom || w.accessory;
    if (keep) d.worn = w; else delete d.worn;
  };
  const animKey = (b: Body) => (b === 'masc' ? 'mascAnim' : 'femmeAnim') as 'mascAnim' | 'femmeAnim';
  const box = h('section', { class: 'db-section worn-look' }, h('h3', {}, 'Look when worn'), h('p', { class: 'note' }, 'Loading the clothing…'));

  /** Save a custom sheet for this body and use it. */
  const useSheet = async (body: Body, blob: Blob, canvas: HTMLCanvasElement, layout: NonNullable<typeof w.mascAnim>): Promise<boolean> => {
    const path = `assets/worn/${d.id}_${body}.png`;
    const p = store.project;
    if (p.canSave && p.canStoreImages) {
      try { await p.writeFile(path, blob); } catch (err) { toast(`Couldn’t save it: ${err instanceof Error ? err.message : String(err)}`, 'error'); return false; }
    }
    store.files.set(path, blob);
    setCharacterSheet(path, canvas);
    w[body] = path;
    w[animKey(body)] = layout;
    set();
    return true;
  };
  const pickPng = (body: Body) => {
    const input = h('input', { type: 'file', accept: 'image/png' });
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      const meta = await readBuilderMeta(f);
      if (!meta) { toast('That PNG has no animation layout: export it from the Character Builder (Export clothes only).', 'error'); return; }
      let canvas: HTMLCanvasElement;
      try { canvas = await canvasFromBlob(f); } catch { toast('That file isn’t an image the browser can read', 'error'); return; }
      if (w.parts) delete w.parts[body];
      if (await useSheet(body, f, canvas, { frame: meta.frame, dirs: meta.dirs, anims: meta.anims })) rerender();
    });
    input.click();
  };

  /** The combined preview: the player's look with the outfit over it (or the custom sheets). */
  const preview = h('canvas', { class: 'worn-preview big', width: '128', height: '128' }) as HTMLCanvasElement;
  const drawPreview = async () => {
    const g = preview.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 128, 128);
    const look: CharacterDef | undefined = store.db.characters[store.db.player];
    const base = look?.sheet ? characterSheetImage(look.sheet) : undefined, bc = standingCell(look?.anim);
    for (const slot of WORN_SLOTS) await drawPick(store, g, w[slot], previewBody, 128, true);
    if (base && bc) g.drawImage(base, bc.x, bc.y, bc.size, bc.size, 0, 0, 128, 128);
    if (w.custom) {
      const path = w[previewBody], c = standingCell(w[animKey(previewBody)]);
      const img = path ? characterSheetImage(path) : undefined;
      if (img && c) g.drawImage(w.tint ? tintSheet(img, w.tint) : img, c.x, c.y, c.size, c.size, 0, 0, 128, 128);
      return;
    }
    for (const slot of WORN_SLOTS) await drawPick(store, g, w[slot], previewBody, 128);
  };

  /** One slot's panel: its picture, ← name →, swatches and a tint. */
  const slotPanel = (slot: WornSlot): HTMLElement => {
    const list = wornParts().filter((p) => p.slot === slot);
    const pick = w[slot], part = wornPart(pick?.part), idx = part ? list.indexOf(part) : -1;
    const pic = h('canvas', { class: 'worn-preview', width: '96', height: '96' }) as HTMLCanvasElement;
    const g = pic.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    void drawPick(store, g, pick, previewBody, 96, true).then(() => drawPick(store, g, pick, previewBody, 96));
    const go = (step: number) => {
      const n = list.length + 1, k = ((idx + 1 + step) % n + n) % n - 1;
      if (k < 0) delete w[slot]; else w[slot] = { part: list[k].id };
      set(); rerender();
    };
    const swatches = part?.recolor?.swatches ?? [];
    const chips = h('div', { class: 'worn-swatches' },
      h('button', { type: 'button', class: `worn-chip none${pick && pick.swatch === undefined && !pick.tint ? ' on' : ''}`, title: 'As drawn', disabled: !pick, onclick: () => { if (!pick) return; delete pick.swatch; delete pick.tint; set(); rerender(); } }, '·'),
      ...swatches.map((s, k) => h('button', { type: 'button', class: `worn-chip${pick?.swatch === k ? ' on' : ''}`, title: s.name, style: `background:linear-gradient(${s.cols[4] ?? s.cols[3]}, ${s.cols[2] ?? s.cols[1]})`, onclick: () => { if (!pick) return; pick.swatch = k; delete pick.tint; set(); rerender(); } })));
    const tint = h('input', { type: 'color', value: pick?.tint ?? '#c0a080', disabled: !pick, title: 'More colours: tint it any colour' }) as HTMLInputElement;
    tint.addEventListener('change', () => { if (!pick) return; pick.tint = tint.value; delete pick.swatch; set(); rerender(); });
    return h('div', { class: `worn-panel${w.custom ? ' off' : ''}` },
      h('b', { class: 'worn-slot' }, WORN_SLOT_NAMES[slot]),
      pic,
      h('div', { class: 'worn-cycle' },
        h('button', { type: 'button', class: 'btn small', 'aria-label': `Previous ${WORN_SLOT_NAMES[slot]}`, onclick: () => go(-1) }, '◀'),
        h('span', { class: 'worn-name' }, part?.name ?? 'None'),
        h('button', { type: 'button', class: 'btn small', 'aria-label': `Next ${WORN_SLOT_NAMES[slot]}`, onclick: () => go(1) }, '▶')),
      part ? chips : h('span'),
      part ? h('label', { class: 'worn-tint' }, 'More colours / tint ', tint) : h('span'));
  };

  /** The custom sheets panel: builder parts or PNGs, per body. */
  const customPanel = (): HTMLElement => {
    const row = (body: Body, label: string) => h('div', { class: 'worn-row' },
      h('span', { class: 'worn-label' }, label),
      h('code', {}, w[body] ?? '(none)'),
      h('button', { type: 'button', class: 'btn small', onclick: () => pickPng(body) }, w[body] ? 'Replace PNG…' : 'Choose a PNG…'),
      w[body] ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => { delete w[body]; delete w[animKey(body)]; if (w.parts) delete w.parts[body]; set(); rerender(); } }, 'Remove') : '');
    const tint = h('input', { type: 'color', value: w.tint ?? '#c0a080', disabled: !w.tint }) as HTMLInputElement;
    tint.addEventListener('change', () => { w.tint = tint.value; set(); rerender(); });
    return h('div', { class: `worn-panel custom${w.custom ? '' : ' dim'}` },
      h('b', { class: 'worn-slot' }, 'Custom sprite'),
      checkbox('Use custom clothes sprite', !!w.custom, (v) => { if (v) w.custom = true; else delete w.custom; set(); rerender(); }),
      row('masc', 'Masc'), row('femme', 'Femme'),
      h('div', { class: 'worn-row' }, checkbox('Tint it', !!w.tint, (on) => { if (on) w.tint = tint.value; else delete w.tint; tint.disabled = !on; set(); rerender(); }), tint),
      h('details', { class: 'worn-builder' }, h('summary', {}, 'Build from Character Builder parts'),
        h('div', { class: 'worn-bodies' }, partsPanel('masc', 'Masc'), partsPanel('femme', 'Femme')),
        checkbox('Steam-safe parts only (CC0 / OGA-BY)', steamSafe, (v) => { steamSafe = v; rerender(); })));
  };

  /** Character Builder parts for a custom sheet (Update 120), rebuilt and saved on each change. */
  function partsPanel(body: Body, label: string): HTMLElement {
    const lb = LPC_BODY[body];
    const pbox = h('div', { class: 'worn-parts' }, h('p', { class: 'note' }, 'Loading the Character Builder’s parts…'));
    const status = h('span', { class: 'note' });
    let timer = 0;
    const build = () => {
      clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const parts = w.parts?.[body] ?? [];
        if (!parts.length) { status.textContent = ''; return; }
        status.textContent = 'Building the sheet…';
        const r = await buildWornSheet(parts, lb);
        if (!r) { status.textContent = 'Nothing to draw for this body.'; return; }
        status.textContent = (await useSheet(body, await toPng(r.canvas), r.canvas, r.layout)) ? `Built: ${Object.keys(r.layout.anims).length} animations` : 'Couldn’t save the sheet.';
        void drawPreview();
      }, 500);
    };
    const draw = async () => {
      const cat = await loadParts();
      if (!cat) { pbox.replaceChildren(h('p', { class: 'note' }, 'The Character Builder’s parts library isn’t available here (open the editor with “Start Map Editor.bat”). A PNG works too.')); return; }
      const parts = (w.parts ??= {})[body] ??= [];
      const changed = () => { if (!parts.length) delete w.parts![body]; if (w.parts && !w.parts.masc && !w.parts.femme) delete w.parts; set(); void draw(); build(); };
      const rows = parts.map((p, k) => {
        const it = partById(p.id);
        if (!it) return h('div', { class: 'worn-part' }, h('b', {}, `${p.id} (missing)`), h('button', { type: 'button', class: 'btn small ghost', onclick: () => { parts.splice(k, 1); changed(); } }, 'Remove'));
        const variant = it.variants ? h('select', { onchange: (e: Event) => { p.variant = (e.target as HTMLSelectElement).value; changed(); } }, ...it.variants.map((v) => h('option', { value: v, selected: (p.variant ?? it.variants![0]) === v }, v))) : null;
        const colours = (it.colours ?? []).map((ch, ci) => {
          if (!ch.source) return null;
          const choices = channelChoices(ch), cur = p.colours?.[ci];
          return h('select', { title: ch.label, onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; p.colours ??= []; p.colours[ci] = v ? choices[Number(v)].ref : null; if (!p.colours.some(Boolean)) delete p.colours; changed(); } },
            h('option', { value: '' }, `${ch.label}: as drawn`), ...choices.map((c, i) => h('option', { value: String(i), selected: !!cur && cur.mat === c.ref.mat && cur.ver === c.ref.ver && cur.name === c.ref.name }, `${ch.label}: ${c.ref.name}`)));
        });
        return h('div', { class: 'worn-part' }, h('b', {}, `${TAB_NAMES[it.tab] ?? it.tab}: ${it.name}`), variant, ...colours, h('button', { type: 'button', class: 'btn small ghost', onclick: () => { parts.splice(k, 1); changed(); } }, 'Remove'));
      });
      const add = h('select', { onchange: (e: Event) => {
        const id = (e.target as HTMLSelectElement).value, it = id ? partById(id) : undefined;
        if (!it) return;
        const same = parts.findIndex((p) => partById(p.id)?.type === it.type), part: WornPart = { id };
        if (same >= 0) parts[same] = part; else parts.push(part);
        changed();
      } }, h('option', { value: '' }, '+ Add a part…'), ...WORN_TABS.map((tab) => h('optgroup', { label: TAB_NAMES[tab] }, ...partsIn(tab, lb).filter((it) => !steamSafe || partSafe(it, lb)).map((it) => h('option', { value: it.id }, it.name)))));
      const prev = await previewParts(parts, lb, 64);
      prev.className = 'worn-preview';
      pbox.replaceChildren(h('div', { class: 'worn-parts-head' }, h('b', {}, label), prev), ...rows, add, status);
    };
    void draw();
    return pbox;
  }

  void ensureParts(store).then(() => {
    const has = wornParts().length;
    box.replaceChildren(h('h3', {}, 'Look when worn'),
      h('p', { class: 'note' }, 'Pick a Top, a Bottom and an Accessory (← →; None for nothing), each with a colour swatch or a tint of your own. Heroes wearing the item get it drawn over their sprite, covering their own clothes, in the version for their outfit gender (Database → Heroes). Tick “Use custom clothes sprite” to use sheets of your own instead.'),
      h('div', { class: 'worn-head' }, h('span', { class: 'note' }, 'Preview:'),
        h('button', { type: 'button', class: `btn small${previewBody === 'masc' ? ' primary' : ''}`, onclick: () => { previewBody = 'masc'; rerender(); } }, 'Masc'),
        h('button', { type: 'button', class: `btn small${previewBody === 'femme' ? ' primary' : ''}`, onclick: () => { previewBody = 'femme'; rerender(); } }, 'Femme'), preview),
      h('div', { class: 'worn-panels' }, ...(has ? WORN_SLOTS.map(slotPanel) : [h('p', { class: 'note' }, 'The built-in clothing (public/assets/worn/builtin) is missing.')]), customPanel()));
    void drawPreview();
  });
  return box;
}
