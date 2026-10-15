/**
 * Ailment and buff pickers for the database: what a hit can inflict (with chances), which ailments something
 * resists or wards off, and what a consumable cures and buffs.
 */
import { statusIconUrl } from '../art/statusIcons';
import { AILMENTS, AILMENT_INFO, BUFFS, BUFF_INFO } from '../game/status';
import type { Ailment, BuffGrant, Inflict } from '../world/types';
import { field, h, numberInput, select } from './dom';

const AIL_CHOICES = AILMENTS.map((a) => [a, AILMENT_INFO[a].name] as [string, string]);

/** A list of ailments a hit can give: ailment, chance %, seconds (0: its usual time). */
export function inflictsField(get: () => Inflict[] | undefined, set: (v: Inflict[] | undefined) => void, rerender: () => void, label = 'Ailments its hits can give'): HTMLElement {
  const list = get() ?? [];
  const save = (l: Inflict[]) => set(l.length ? l : undefined);
  return h('div', { class: 'field st-field' }, h('label', {}, label),
    ...list.map((f, k) => h('div', { class: 'st-line' },
      h('img', { src: statusIconUrl(f.ailment), alt: '', class: 'el-icon' }),
      select(AIL_CHOICES, f.ailment, (v) => { f.ailment = v as Ailment; save(list); rerender(); }, { 'aria-label': `Ailment ${k + 1}` }),
      h('span', { class: 'note' }, 'chance'),
      numberInput(f.chance, (v) => { f.chance = Math.max(0, Math.min(100, Math.round(v))); save(list); }, { step: 5, min: 0, max: 100, 'aria-label': `Ailment ${k + 1} chance` }),
      h('span', { class: 'note' }, '% for'),
      numberInput(f.seconds ?? 0, (v) => { const n = Math.max(0, Math.round(v * 10) / 10); if (n) f.seconds = n; else delete f.seconds; save(list); }, { step: 1, min: 0, 'aria-label': `Ailment ${k + 1} seconds` }),
      h('span', { class: 'note' }, 's'),
      h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove ailment ${k + 1}`, onclick: () => { list.splice(k, 1); save(list); rerender(); } }, '✕'))),
    h('button', { type: 'button', class: 'btn small', onclick: () => { list.push({ ailment: 'poison', chance: 20 }); save(list); rerender(); } }, '+ Ailment'),
    h('p', { class: 'note' }, `Seconds 0: its usual time (${AILMENTS.filter((a) => a !== 'zombie').map((a) => `${AILMENT_INFO[a].name} ${AILMENT_INFO[a].seconds}`).join(', ')}; Zombie lasts until cured). Bosses shake ailments off twice as fast.`));
}

/** Toggle chips for a set of ailments (resists, wards off, cures). `all` adds an "All ailments" chip (not Zombie). */
export function ailmentChips(get: () => (Ailment | 'all')[] | undefined, set: (v: (Ailment | 'all')[] | undefined) => void, rerender: () => void, label: string, opts: { all?: boolean } = {}): HTMLElement {
  const cur = new Set(get() ?? []);
  const toggle = (a: Ailment | 'all') => {
    if (cur.has(a)) cur.delete(a); else cur.add(a);
    const order: (Ailment | 'all')[] = ['all', ...AILMENTS];
    const out = order.filter((x) => cur.has(x));
    set(out.length ? out : undefined);
    rerender();
  };
  const chip = (a: Ailment | 'all', name: string) => h('button', { type: 'button', class: 'el-chip', 'aria-pressed': String(cur.has(a)), onclick: () => toggle(a) },
    a === 'all' ? h('span') : h('img', { src: statusIconUrl(a), alt: '' }), name);
  return h('div', { class: 'el-grid', role: 'group', 'aria-label': label },
    ...(opts.all ? [chip('all', 'All (not Zombie)')] : []),
    ...AILMENTS.map((a) => chip(a, AILMENT_INFO[a].name)));
}

/** A consumable's buffs: kind, amount, seconds. */
export function buffsField(get: () => BuffGrant[] | undefined, set: (v: BuffGrant[] | undefined) => void, rerender: () => void): HTMLElement {
  const list = get() ?? [];
  const save = (l: BuffGrant[]) => set(l.length ? l : undefined);
  return h('div', { class: 'field st-field' }, h('label', {}, 'Buffs it gives'),
    ...list.map((b, k) => h('div', { class: 'st-line' },
      h('img', { src: statusIconUrl(`buff:${b.buff}`), alt: '', class: 'el-icon' }),
      select(BUFFS.map((x) => [x, BUFF_INFO[x].name] as [string, string]), b.buff, (v) => { b.buff = v as BuffGrant['buff']; delete b.amount; save(list); rerender(); }, { 'aria-label': `Buff ${k + 1}` }),
      h('span', { class: 'note' }, '+'),
      numberInput(b.amount ?? BUFF_INFO[b.buff].amount, (v) => { const n = Math.max(1, Math.round(v)); if (n === BUFF_INFO[b.buff].amount) delete b.amount; else b.amount = n; save(list); }, { step: 1, min: 1, 'aria-label': `Buff ${k + 1} amount` }),
      h('span', { class: 'note' }, `${BUFF_INFO[b.buff].unit || ''} for`),
      numberInput(b.seconds ?? BUFF_INFO[b.buff].seconds, (v) => { const n = Math.max(1, Math.round(v)); if (n === BUFF_INFO[b.buff].seconds) delete b.seconds; else b.seconds = n; save(list); }, { step: 5, min: 1, 'aria-label': `Buff ${k + 1} seconds` }),
      h('span', { class: 'note' }, 's'),
      h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove buff ${k + 1}`, onclick: () => { list.splice(k, 1); save(list); rerender(); } }, '✕'))),
    h('button', { type: 'button', class: 'btn small', onclick: () => { list.push({ buff: 'crit' }); save(list); rerender(); } }, '+ Buff'));
}

export const statusField = (label: string, el: HTMLElement, hint?: string): HTMLElement => field(label, el, hint);
