/**
 * Database → Items → an armor, accessory or shield → Look when worn (Update 114): the clothes-only sheets from the
 * Character Builder ("Export clothes only") for masculine and feminine bodies, and an optional tint. Wearing the item
 * draws it over the hero's own sheet, animation for animation.
 */
import type { ItemDef } from '../world/types';
import type { EditorStore } from './store';
import { readBuilderMeta } from '../shared/pngText';
import { canvasFromBlob } from '../shared/images';
import { setCharacterSheet } from './editorArt';
import { checkbox, field, h, toast } from './dom';

export function wornLookForm(store: EditorStore, d: ItemDef, rerender: () => void): HTMLElement {
  const w = d.worn ?? {};
  const set = () => { const keep = w.masc || w.femme; if (keep) d.worn = w; else delete d.worn; };
  const pick = (body: 'masc' | 'femme') => {
    const input = h('input', { type: 'file', accept: 'image/png' });
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      const meta = await readBuilderMeta(f);
      if (!meta) { toast('That PNG has no animation layout: export it from the Character Builder (Export clothes only).', 'error'); return; }
      const path = `assets/worn/${d.id}_${body}.png`;
      let canvas: HTMLCanvasElement;
      try { canvas = await canvasFromBlob(f); } catch { toast('That file isn’t an image the browser can read', 'error'); return; }
      const p = store.project;
      if (p.canSave && p.canStoreImages) {
        try { await p.writeFile(path, f); } catch (err) { toast(`Couldn’t save it: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
      } else toast('Kept for this session only: open the project folder itself to keep it.');
      store.files.set(path, f);
      setCharacterSheet(path, canvas);
      w[body] = path;
      w[body === 'masc' ? 'mascAnim' : 'femmeAnim'] = { frame: meta.frame, dirs: meta.dirs, anims: meta.anims };
      set(); rerender();
    });
    input.click();
  };
  const row = (body: 'masc' | 'femme', label: string) => h('div', { class: 'worn-row' },
    h('span', { class: 'worn-label' }, label),
    h('code', {}, w[body] ?? '(none)'),
    h('button', { type: 'button', class: 'btn small', onclick: () => pick(body) }, w[body] ? 'Replace…' : 'Choose sheet…'),
    w[body] ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => { delete w[body]; delete w[body === 'masc' ? 'mascAnim' : 'femmeAnim']; set(); rerender(); } }, 'Remove') : '');
  const tint = h('input', { type: 'color', value: w.tint ?? '#c0a080', disabled: !w.tint });
  tint.addEventListener('change', () => { w.tint = tint.value; set(); });
  return h('section', { class: 'db-section' }, h('h3', {}, 'Look when worn'),
    row('masc', 'Masculine body'), row('femme', 'Feminine body'),
    h('div', { class: 'field-row' },
      checkbox('Tint it', !!w.tint, (on) => { if (on) w.tint = tint.value; else delete w.tint; tint.disabled = !on; set(); }),
      field('Colour', tint)),
    h('p', { class: 'note' }, 'In the Character Builder, dress a character in the armor or clothes (body type to match) and press Export clothes only; choose that PNG here. Heroes wearing the item get it drawn over their sheet (Database → Characters → a card’s Body says which version they use; with only one version, everyone uses it). The tint multiplies its colours, keeping the shading.'));
}
