/**
 * Database → Items → an armor, accessory or shield → Look when worn.
 * Update 120: pick the Character Builder's own parts (torso, legs, feet, arms, hats, back) for masculine and feminine
 * bodies, with their colours; the editor builds the clothes-only sheets from the builder's library and saves them in
 * the project (assets/worn/<item>_<body>.png). Wearing the item draws them over the hero's own sheet, animation for
 * animation, covering their own clothes. (Update 114's way still works: a PNG from the builder's "Export clothes only".)
 */
import type { ItemDef } from '../world/types';
import type { EditorStore } from './store';
import { readBuilderMeta } from '../shared/pngText';
import { canvasFromBlob } from '../shared/images';
import { setCharacterSheet } from './editorArt';
import { checkbox, field, h, toast } from './dom';
import { LPC_BODY, TAB_NAMES, WORN_TABS, buildWornSheet, channelChoices, loadParts, partById, partSafe, partsIn, previewParts, type WornPart } from './lpcParts';

type Body = 'masc' | 'femme';
const toPng = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
let steamSafe = true;

export function wornLookForm(store: EditorStore, d: ItemDef, rerender: () => void): HTMLElement {
  const w = d.worn ?? {};
  const set = () => { const keep = w.masc || w.femme || w.parts?.masc?.length || w.parts?.femme?.length; if (keep) d.worn = w; else delete d.worn; };
  const animKey = (b: Body) => (b === 'masc' ? 'mascAnim' : 'femmeAnim') as 'mascAnim' | 'femmeAnim';

  /** Save a sheet for this body and use it. */
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

  const pick = (body: Body) => {
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

  /** One body's parts: the list (variant, colours), add a part, a preview, and the build status. */
  const partsPanel = (body: Body, label: string): HTMLElement => {
    const lb = LPC_BODY[body];
    const box = h('div', { class: 'worn-parts' }, h('p', { class: 'note' }, 'Loading the Character Builder’s parts…'));
    const status = h('span', { class: 'note' });
    let timer = 0;
    const build = () => {
      clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const parts = w.parts?.[body] ?? [];
        if (!parts.length) { delete w[body]; delete w[animKey(body)]; set(); status.textContent = ''; return; }
        status.textContent = 'Building the sheet…';
        const r = await buildWornSheet(parts, lb);
        if (!r) { status.textContent = 'Nothing to draw for this body.'; return; }
        status.textContent = (await useSheet(body, await toPng(r.canvas), r.canvas, r.layout)) ? `Built: ${Object.keys(r.layout.anims).length} animations` : 'Couldn’t save the sheet.';
      }, 500);
    };
    const draw = async () => {
      const cat = await loadParts();
      if (!cat) {
        box.replaceChildren(h('p', { class: 'note' }, 'The Character Builder’s parts library isn’t available here. Open the editor with “Start Map Editor.bat” (it serves tools/lpc/library), or use a PNG from the builder’s Export clothes only.'));
        return;
      }
      const parts = (w.parts ??= {})[body] ??= [];
      const changed = () => { if (!parts.length) delete w.parts![body]; if (w.parts && !w.parts.masc && !w.parts.femme) delete w.parts; set(); void draw(); build(); };
      const rows = parts.map((p, k) => {
        const it = partById(p.id);
        if (!it) return h('div', { class: 'worn-part' }, h('b', {}, `${p.id} (missing)`), h('button', { type: 'button', class: 'btn small ghost', onclick: () => { parts.splice(k, 1); changed(); } }, 'Remove'));
        const variant = it.variants ? h('select', { onchange: (e: Event) => { p.variant = (e.target as HTMLSelectElement).value; changed(); } },
          ...it.variants.map((v) => h('option', { value: v, selected: (p.variant ?? it.variants![0]) === v }, v))) : null;
        const colours = (it.colours ?? []).map((ch, ci) => {
          if (!ch.source) return null;
          const choices = channelChoices(ch), cur = p.colours?.[ci];
          const sel = h('select', { title: ch.label, onchange: (e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            p.colours ??= [];
            p.colours[ci] = v ? choices[Number(v)].ref : null;
            if (!p.colours.some(Boolean)) delete p.colours;
            changed();
          } }, h('option', { value: '' }, `${ch.label}: as drawn`),
          ...choices.map((c, i) => h('option', { value: String(i), selected: !!cur && cur.mat === c.ref.mat && cur.ver === c.ref.ver && cur.name === c.ref.name }, `${ch.label}: ${c.ref.name}`)));
          return sel;
        });
        return h('div', { class: 'worn-part' }, h('b', {}, `${TAB_NAMES[it.tab] ?? it.tab}: ${it.name}`), variant, ...colours,
          h('button', { type: 'button', class: 'btn small ghost', onclick: () => { parts.splice(k, 1); changed(); } }, 'Remove'));
      });
      // Add a part: one per type (a second shirt replaces the first, like in the builder).
      const add = h('select', { onchange: (e: Event) => {
        const id = (e.target as HTMLSelectElement).value, it = id ? partById(id) : undefined;
        if (!it) return;
        const same = parts.findIndex((p) => partById(p.id)?.type === it.type);
        const part: WornPart = { id };
        if (same >= 0) parts[same] = part; else parts.push(part);
        changed();
      } }, h('option', { value: '' }, '+ Add a part…'),
      ...WORN_TABS.map((tab) => h('optgroup', { label: TAB_NAMES[tab] }, ...partsIn(tab, lb).filter((it) => !steamSafe || partSafe(it, lb)).map((it) => h('option', { value: it.id }, it.name)))));
      const prev = await previewParts(parts, lb, 96);
      prev.className = 'worn-preview';
      box.replaceChildren(h('div', { class: 'worn-parts-head' }, h('b', {}, label), prev),
        ...rows, add, status);
    };
    void draw();
    return box;
  };

  const row = (body: Body, label: string) => h('div', { class: 'worn-row' },
    h('span', { class: 'worn-label' }, label),
    h('code', {}, w[body] ?? '(none)'),
    h('button', { type: 'button', class: 'btn small', onclick: () => pick(body) }, w[body] ? 'Use a PNG instead…' : 'Choose a PNG…'),
    w[body] ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => { delete w[body]; delete w[animKey(body)]; if (w.parts) delete w.parts[body]; set(); rerender(); } }, 'Remove') : '');
  const tint = h('input', { type: 'color', value: w.tint ?? '#c0a080', disabled: !w.tint });
  tint.addEventListener('change', () => { w.tint = tint.value; set(); });
  return h('section', { class: 'db-section' }, h('h3', {}, 'Look when worn'),
    h('p', { class: 'note' }, 'Pick the Character Builder’s clothes, armor and hats for each body; the sheet is built and saved for you. Heroes wearing the item get it drawn over their own sprite, covering their clothes (Database → Characters → a card’s Body says which version they use; with only one version, everyone uses it).'),
    checkbox('Steam-safe parts only (CC0 / OGA-BY)', steamSafe, (v) => { steamSafe = v; rerender(); }),
    h('div', { class: 'worn-bodies' }, partsPanel('masc', 'Masculine body'), partsPanel('femme', 'Feminine body')),
    row('masc', 'Masculine sheet'), row('femme', 'Feminine sheet'),
    h('div', { class: 'field-row' },
      checkbox('Tint it', !!w.tint, (on) => { if (on) w.tint = tint.value; else delete w.tint; tint.disabled = !on; set(); }),
      field('Colour', tint)),
    h('p', { class: 'note' }, 'The tint multiplies its colours, keeping the shading (handy for one sheet in several colours). A PNG from the builder’s Export clothes only works too.'));
}
