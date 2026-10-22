/**
 * Database → Characters → Chatter: what each hero says now and then out of battle (game/chatter.ts). Pick a hero,
 * set how talkative they are, then write General lines per trigger (one line per row; one at random each time) and
 * Map lines (a map and a line; several rows for one map: one at random).
 */
import type { HeroChatter, HeroDef } from '../world/types';
import { CHATTER_TRIGGERS } from '../game/chatter';
import { field, h, select } from './dom';

export interface ChatterState { sel: number }

/** Tidy one hero's chatter for saving (undefined: nothing written). */
export function cleanChatter(c: HeroChatter | undefined): HeroChatter | undefined {
  if (!c) return undefined;
  const out: HeroChatter = {};
  if (c.amount !== undefined && c.amount !== 5) out.amount = Math.max(0, Math.min(10, Math.round(c.amount)));
  const lines = Object.fromEntries(Object.entries(c.lines ?? {}).map(([k, v]) => [k, (v ?? []).map((l) => l.trim()).filter(Boolean)]).filter(([, v]) => v.length));
  if (Object.keys(lines).length) out.lines = lines;
  const maps = (c.maps ?? []).map((r) => ({ map: r.map, line: r.line.trim() })).filter((r) => r.map && r.line);
  if (maps.length) out.maps = maps;
  return Object.keys(out).length ? out : undefined;
}

export function chatterTab(heroes: HeroDef[], maps: string[], st: ChatterState, rerender: () => void): HTMLElement[] {
  if (!heroes.length) return [h('p', { class: 'note' }, 'Add heroes first (Database → Heroes).')];
  st.sel = Math.max(0, Math.min(heroes.length - 1, st.sel));
  const x = heroes[st.sel];
  const c = (x.chatter ??= {});

  const amount = h('input', { type: 'range', min: '0', max: '10', step: '1', value: String(c.amount ?? 5), 'aria-label': 'Chatter amount' });
  const amountNote = h('span', { class: 'chat-amount' });
  const describe = (n: number) => (n === 0 ? 'Never talks' : n <= 2 ? 'Almost never (a stoic knight)' : n <= 4 ? 'Now and then' : n <= 6 ? 'Sometimes' : n <= 8 ? 'Often' : 'All the time (a whiner)');
  const showAmount = () => { amountNote.textContent = `${amount.value}: ${describe(+amount.value)}`; };
  amount.addEventListener('input', () => { c.amount = +amount.value; showAmount(); });
  showAmount();

  const general = CHATTER_TRIGGERS.map(([t, name]) => {
    const ta = h('textarea', { rows: '2', class: 'chat-lines', placeholder: 'One line per row (one is picked at random)', 'aria-label': `${name} lines` });
    ta.value = (c.lines?.[t] ?? []).join('\n');
    ta.addEventListener('change', () => {
      const ls = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (ls.length) (c.lines ??= {})[t] = ls;
      else if (c.lines) { delete c.lines[t]; if (!Object.keys(c.lines).length) delete c.lines; }
    });
    return h('div', { class: 'chat-row' }, h('label', { class: 'chat-trigger' }, name), ta);
  });

  const mapOpts: [string, string][] = maps.map((m) => [m, m]);
  const rows = (c.maps ?? []).map((r, i) => {
    const line = h('input', { type: 'text', value: r.line, placeholder: 'This is Reach City. I grew up here!', 'aria-label': 'Line', class: 'chat-map-line' });
    line.addEventListener('change', () => { r.line = line.value; });
    return h('div', { class: 'chat-row map' },
      select(mapOpts.some(([m]) => m === r.map) ? mapOpts : [[r.map, `${r.map} (missing)`], ...mapOpts], r.map, (v) => { r.map = v; }, { 'aria-label': 'Map' }),
      line,
      h('button', { type: 'button', class: 'btn small', title: 'Remove this line', 'aria-label': 'Remove', onclick: () => { c.maps!.splice(i, 1); if (!c.maps!.length) delete c.maps; rerender(); } }, '−'));
  });

  return [
    h('section', { class: 'db-section' }, h('h3', {}, 'Party chatter'),
      h('p', { class: 'note' }, 'Out of battle, a hero now and then says a line in a speech bubble over their head (one at a time). Every line said goes in the adventure log. The hero you play talks too, but more rarely.'),
      h('div', { class: 'field-row' },
        field('Hero', select(heroes.map((d, i) => [String(i), d.name || d.id] as [string, string]), String(st.sel), (v) => { st.sel = +v; rerender(); })),
        field('Chatter amount', h('div', { class: 'chat-amount-row' }, amount, amountNote), 'How talkative they are: 0 never … 10 all the time.'))),
    h('section', { class: 'db-section' }, h('h3', {}, 'General'),
      h('p', { class: 'note' }, 'Lines for things that happen. Leave a trigger empty and they say nothing then.'),
      h('div', { class: 'chat-grid' }, ...general)),
    h('section', { class: 'db-section' }, h('h3', {}, 'Map chatter'),
      h('p', { class: 'note' }, 'Said on coming onto that map (likeliest the first time). Several lines for one map: one at random.'),
      ...rows,
      h('button', { type: 'button', class: 'btn small', onclick: () => { (c.maps ??= []).push({ map: maps[0] ?? '', line: '' }); rerender(); } }, '+ Add a map line')),
  ];
}
