/**
 * Element pickers for the database: an element select with its icon, a creature's two elements, and which
 * elements it's immune to or absorbs.
 */
import { elementIconUrl } from '../art/elementIcons';
import { ELEMENT_LIST, ELEMENT_NAMES, TYPED_ELEMENTS, matchups } from '../game/elements';
import type { Element } from '../world/types';
import { field, h, select } from './dom';

/** One element (an attack's): icon + select. */
export function elementSelect(value: Element | undefined, set: (e: Element | undefined) => void, label = 'Element', opts: { auto?: string } = {}): HTMLElement {
  const img = h('img', { src: elementIconUrl(value ?? 'neutral'), alt: '', class: 'el-icon' });
  const choices: [string, string][] = [...(opts.auto ? [['@auto', opts.auto] as [string, string]] : []), ...ELEMENT_LIST.map((e) => [e, ELEMENT_NAMES[e]] as [string, string])];
  const sel = select(choices, value ?? (opts.auto ? '@auto' : 'neutral'), (v) => {
    const e = v === '@auto' ? undefined : (v as Element);
    img.src = elementIconUrl(e ?? 'neutral');
    set(e === 'neutral' && !opts.auto ? undefined : e);
  }, { 'aria-label': label });
  return h('div', { class: 'el-pick' }, img, sel);
}

/** Strong / weak against, for a hint under an element choice. */
export function matchupText(e: Element | undefined): string {
  if (!e || e === 'neutral') return 'Normal: even damage to everything.';
  const m = matchups(e);
  return `Strong against ${m.strong.map((x) => ELEMENT_NAMES[x]).join(', ') || 'nothing'} (×2); weak against ${m.weak.map((x) => ELEMENT_NAMES[x]).join(', ') || 'nothing'} (×½).`;
}

interface Defence { elements?: Element[]; immune?: Element[]; absorb?: Element[] }

/** A creature's elements (up to two), and its immunities and absorbs, as a section. */
export function defenceSection(d: Defence, rerender: () => void, who = 'It'): HTMLElement {
  const els = d.elements ?? [];
  const setEl = (k: number, v: string) => {
    const next = [...els];
    if (v === '') next.splice(k, 1); else next[k] = v as Element;
    const clean = [...new Set(next.filter(Boolean))].slice(0, 2);
    if (clean.length) d.elements = clean; else delete d.elements;
    rerender();
  };
  const typed: [string, string][] = [['', 'None'], ...TYPED_ELEMENTS.map((e) => [e, ELEMENT_NAMES[e]] as [string, string])];
  const pick = (k: number) => h('div', { class: 'el-pick' },
    h('img', { src: elementIconUrl(els[k] ?? 'neutral'), alt: '', class: 'el-icon' }),
    select(typed, els[k] ?? '', (v) => setEl(k, v), { 'aria-label': k ? 'Second element' : 'First element', ...(k && !els[0] ? { disabled: true } : {}) }));
  const grid = (key: 'immune' | 'absorb') => h('div', { class: 'el-grid', role: 'group', 'aria-label': key === 'immune' ? 'Immune to' : 'Absorbs' },
    ...ELEMENT_LIST.map((e) => {
      const on = !!d[key]?.includes(e);
      const b = h('button', { type: 'button', class: 'el-chip', 'aria-pressed': String(on), title: ELEMENT_NAMES[e], onclick: () => {
        const set = new Set(d[key] ?? []);
        if (on) set.delete(e); else set.add(e);
        const other = key === 'immune' ? 'absorb' : 'immune';
        if (!on && d[other]?.includes(e)) d[other] = d[other]!.filter((x) => x !== e);
        if (d[other] && !d[other]!.length) delete d[other];
        if (set.size) d[key] = ELEMENT_LIST.filter((x) => set.has(x)); else delete d[key];
        rerender();
      } }, h('img', { src: elementIconUrl(e), alt: '' }), ELEMENT_NAMES[e]);
      return b;
    }));
  return h('section', { class: 'db-section' }, h('h3', {}, 'Elements'),
    h('div', { class: 'field-row' }, field('Element', pick(0)), field('Second element', pick(1), 'Optional: hits are weighed against both (×4 caps at ×3).')),
    h('p', { class: 'note' }, els.length ? els.map((e) => `${ELEMENT_NAMES[e]}: weak to ${TYPED_ELEMENTS.filter((a) => matchups(a).strong.includes(e)).map((a) => ELEMENT_NAMES[a]).join(', ') || 'nothing'}`).join(' · ') : `${who} ${who === 'They' ? 'take' : 'takes'} normal damage from every element.`),
    field('Immune to', grid('immune'), 'Takes no damage from these.'),
    field('Absorbs', grid('absorb'), 'Healed by these instead of hurt.'));
}
