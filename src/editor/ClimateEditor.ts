/**
 * Database → Weather: dynamic weather and temperature. Whether the shared outdoor weather changes by itself, how long
 * each spell lasts, and per season the morning lows and afternoon highs (°F) and how likely each weather is.
 */
import { checkbox, h, numberInput } from './dom';
import { DEFAULT_CLIMATE, climateConfig, type ClimateConfig } from '../world/climate';
import { WEATHER_KINDS, type WeatherKind } from '../world/types';
import { WEATHER_NAMES } from './CommandEditor';
import type { Season } from '../world/seasons';

const SEASONS: [Season, string][] = [['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']];

export function climateTab(c: ClimateConfig, rerender: () => void): HTMLElement[] {
  const num = (v: number, set: (x: number) => void, step = 1, label = '') => numberInput(v, (x) => { set(x); }, { step: String(step), class: 'db-num', 'aria-label': label });
  const seasons = SEASONS.map(([k, name]) => {
    const s = c.seasons[k];
    const total = Object.values(s.weather).reduce((a, b) => a + (b ?? 0), 0) || 1;
    return h('section', { class: 'db-section climate-season' }, h('h3', {}, name),
      h('div', { class: 'db-table climate-temps' },
        h('span', { class: 'db-name' }, 'Morning low'), num(s.low[0], (v) => (s.low = [Math.round(v), Math.max(Math.round(v), s.low[1])]), 1, `${name} low from`), h('span', { class: 'db-unit' }, 'to'),
        num(s.low[1], (v) => (s.low = [Math.min(s.low[0], Math.round(v)), Math.round(v)]), 1, `${name} low to`), h('span', { class: 'db-unit' }, '°F'),
        h('span', { class: 'db-name' }, 'Afternoon high'), num(s.high[0], (v) => (s.high = [Math.round(v), Math.max(Math.round(v), s.high[1])]), 1, `${name} high from`), h('span', { class: 'db-unit' }, 'to'),
        num(s.high[1], (v) => (s.high = [Math.min(s.high[0], Math.round(v)), Math.round(v)]), 1, `${name} high to`), h('span', { class: 'db-unit' }, '°F')),
      h('div', { class: 'climate-chances' }, ...WEATHER_KINDS.map((w: WeatherKind) => {
        const v = s.weather[w] ?? 0;
        return h('label', { class: 'climate-chance' }, h('span', {}, WEATHER_NAMES[w]),
          num(v, (x) => { const n = Math.max(0, Math.round(x)); if (n) s.weather[w] = n; else delete s.weather[w]; rerender(); }, 1, `${name} ${WEATHER_NAMES[w]} chance`),
          h('small', {}, `${Math.round((v / total) * 100)}%`));
      })),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { c.seasons[k] = structuredClone(DEFAULT_CLIMATE.seasons[k]); rerender(); } }, `Back to the default ${name.toLowerCase()}`));
  });
  return [
    h('section', { class: 'db-section' }, h('h3', {}, 'Dynamic weather'),
      checkbox('The outdoor weather changes by itself', c.dynamic, (v) => { c.dynamic = v; rerender(); }),
      h('div', { class: 'db-table climate-temps' },
        h('span', { class: 'db-name' }, 'Each spell lasts'), num(c.spell[0], (v) => (c.spell = [Math.max(0.5, v), Math.max(Math.max(0.5, v), c.spell[1])]), 0.5, 'Shortest spell'), h('span', { class: 'db-unit' }, 'to'),
        num(c.spell[1], (v) => (c.spell = [Math.min(c.spell[0], Math.max(0.5, v)), Math.max(0.5, v)]), 0.5, 'Longest spell'), h('span', { class: 'db-unit' }, 'game hours'),
        h('span', { class: 'db-name' }, 'Heat and cold in battle'), num(c.battle, (v) => (c.battle = Math.max(0, Math.min(100, Math.round(v)))), 5, 'Battle effect'), h('span', { class: 'db-unit' }, '%'), h('span'), h('span')),
      h('p', { class: 'note' }, 'Outdoor maps share the weather (except maps with Unique weather in Map Properties → Weather). Every few game hours it changes, picked from the season’s chances below; rain falls as snow below freezing and snow as rain above it. A Change weather command (or a spell) changes it until the next change. Temperatures: each day rolls its own low (around dawn) and high (mid-afternoon) inside the ranges; rain and storms cool it, haze warms it, and each map can be warmer or colder (Map Properties → Weather → Climate). Below freezing, grass and leaves frost over; in a heat wave grass turns straw-coloured; rain leaves the ground damp for a while. In turn-based battles heat makes fire stronger and water-type foes weaker; cold the reverse (water is the cold element).')),
    ...seasons,
  ];
}

/** Only what differs from the defaults (or undefined). */
export function cleanClimate(c: ClimateConfig): ReturnType<typeof climateConfig> extends infer T ? Partial<T> | undefined : never {
  const d = DEFAULT_CLIMATE, out: Record<string, unknown> = {};
  if (c.dynamic !== d.dynamic) out.dynamic = c.dynamic;
  if (c.spell[0] !== d.spell[0] || c.spell[1] !== d.spell[1]) out.spell = c.spell;
  if (c.battle !== d.battle) out.battle = c.battle;
  const seasons: Record<string, unknown> = {};
  for (const [k] of SEASONS) if (JSON.stringify(c.seasons[k]) !== JSON.stringify(d.seasons[k])) seasons[k] = c.seasons[k];
  if (Object.keys(seasons).length) out.seasons = seasons;
  return (Object.keys(out).length ? out : undefined) as never;
}
