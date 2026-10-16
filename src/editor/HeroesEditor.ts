/**
 * Database → Heroes: the hero you play (first) and heroes who'll join the party later: name, look, starting stats,
 * and for the first hero, how a new game makes their stats (character creation). Also the stat points per level.
 */
import { ailmentChips } from './statusFields';
import type { Ailment } from '../world/types';
import { defenceSection } from './elementFields';
import { ATTRS, ATTR_BASE, ATTR_INFO, ATTR_MAX, ATTR_MIN, ATTR_POINTS_PER_LEVEL, CREATION_METHODS, CREATION_NAMES, attrEffect, attrsFrom } from '../game/attributes';
import type { AdditionDef, AllyStyle, ClassDef, CombatData, CreationSettings, HeroDef, ItemDef, SpellEntry } from '../world/types';
import type { CharactersWork } from './CharactersEditor';
import { checkbox, field, h, numberInput, select, textInput } from './dom';

export interface HeroesWork { heroes: HeroDef[] }

/** The work copy: the database's heroes, or one made from the player's look. */
export function heroesWork(heroes: HeroDef[] | undefined, player: string): HeroesWork {
  const list: HeroDef[] = JSON.parse(JSON.stringify(heroes?.length ? heroes : [{ id: 'hero', name: 'Hero' }]));
  list[0].look = player;
  return { heroes: list };
}

/** What to save: nothing when it's still just the default hero. The first hero's look is the player's (saved there). */
export function cleanHeroes(w: HeroesWork): HeroDef[] | undefined {
  const out = w.heroes.map((x, i) => {
    const c: HeroDef = { id: x.id, name: x.name.trim() || 'Hero' };
    if (i > 0 && x.look) c.look = x.look;
    if (x.face) c.face = x.face;
    if (x.color) c.color = x.color;
    if (x.about) c.about = x.about;
    const st = Object.fromEntries(ATTRS.filter((k) => (x.stats?.[k] ?? ATTR_BASE) !== ATTR_BASE).map((k) => [k, x.stats![k]]));
    if (Object.keys(st).length) c.stats = st;
    if (x.elements?.length) c.elements = x.elements;
    if (x.immune?.length) c.immune = x.immune;
    if (x.absorb?.length) c.absorb = x.absorb;
    if (x.resists?.length) c.resists = x.resists;
    if (i > 0 && x.ai && x.ai !== 'fighter') c.ai = x.ai;
    if (i > 0 && x.startsInParty) c.startsInParty = true;
    if (i > 0 && x.joinLevel && x.joinLevel > 0) c.joinLevel = Math.round(x.joinLevel);
    if (x.cls) c.cls = x.cls;
    if (x.spells && Object.keys(x.spells).length) c.spells = { ...x.spells };
    if (x.additions?.length) c.additions = [...x.additions];
    if (i > 0 && x.gear && Object.values(x.gear).some(Boolean)) c.gear = Object.fromEntries(Object.entries(x.gear).filter(([, v]) => v));
    if (i === 0 && x.creation) {
      const cr: CreationSettings = {};
      if (x.creation.enabled === false) cr.enabled = false;
      const m = x.creation.methods;
      if (m?.length && JSON.stringify(m) !== JSON.stringify(['roll', 'pointBuy', 'array'])) cr.methods = m;
      if (x.creation.rerolls) cr.rerolls = x.creation.rerolls;
      if (Object.keys(cr).length) c.creation = cr;
    }
    return c;
  });
  if (out.length === 1 && out[0].id === 'hero' && out[0].name === 'Hero' && !out[0].stats && !out[0].creation && !out[0].face && !out[0].color && !out[0].about && !out[0].elements && !out[0].immune && !out[0].absorb && !out[0].resists && !out[0].cls && !out[0].spells && !out[0].additions) return undefined;
  return out;
}

export function heroesTab(w: HeroesWork, people: CharactersWork, combat: CombatData, state: { sel: number }, rerender: () => void, items: ItemDef[] = [],
  learnable: { spells: SpellEntry[]; additions: AdditionDef[]; classes: ClassDef[] } = { spells: [], additions: [], classes: [] },
  face?: { pick: (hero: HeroDef, done: () => void) => void; url: (path: string) => string }): HTMLElement[] {
  state.sel = Math.min(state.sel, w.heroes.length - 1);
  const looks = Object.keys(people.chars).map((k) => [k, k] as [string, string]);
  const add = () => {
    let n = w.heroes.length + 1, id = `hero_${n}`;
    while (w.heroes.some((x) => x.id === id)) id = `hero_${++n}`;
    w.heroes.push({ id, name: 'New hero', look: Object.keys(people.chars)[0] });
    state.sel = w.heroes.length - 1;
    rerender();
  };
  const list = h('div', { class: 'item-list', role: 'listbox', 'aria-label': 'Heroes' },
    ...w.heroes.map((x, i) => h('button', { type: 'button', class: 'item-row', role: 'option', 'aria-selected': String(i === state.sel), onclick: () => { state.sel = i; rerender(); } },
      h('span', {}, x.name || '(no name)'), i === 0 ? h('small', { class: 'hero-tag' }, 'you play') : h('span'))),
    h('button', { type: 'button', class: 'btn item-add', onclick: add }, '+ New hero'));
  const x = w.heroes[state.sel];
  const form = h('div', { class: 'item-form' });
  if (x) {
    const main = state.sel === 0;
    const stats = (x.stats ??= {}), base = attrsFrom(stats);
    const statRows = ATTRS.map((k) => {
      const eff = h('span', { class: 'note' }, attrEffect(k, base[k]));
      return h('div', { class: 'hero-stat' },
        h('span', { class: 'db-name' }, `${ATTR_INFO[k].name} (${ATTR_INFO[k].short})`),
        numberInput(base[k], (v) => { const n = Math.max(ATTR_MIN, Math.min(ATTR_MAX, Math.round(v))); stats[k] = n; eff.textContent = attrEffect(k, n); }, { step: 1, min: ATTR_MIN, max: ATTR_MAX, 'aria-label': ATTR_INFO[k].name }),
        h('span', { class: 'note' }, ATTR_INFO[k].does), eff);
    });
    const cr = main ? (x.creation ??= {}) : undefined;
    const methods = cr ? (cr.methods ??= ['roll', 'pointBuy', 'array']) : [];
    form.append(
      field('Name', textInput(x.name, (v) => { x.name = v.trim() || x.name; rerender(); }, { 'aria-label': 'Hero name' })),
      field('Look', select(looks.length ? looks : [['', '(no characters)']], main ? people.player : x.look ?? '', (v) => { if (main) people.player = v; else x.look = v; }),
        main ? 'The player character (the same as Characters → Player).' : 'From Characters.'),
      ...(face ? [field('Face art', h('div', { class: 'face-pick' },
        x.face ? h('img', { class: 'face-thumb', src: face.url(x.face), alt: '' }) : h('span', { class: 'note' }, 'From their look'),
        h('button', { type: 'button', class: 'btn small', onclick: () => face.pick(x, rerender) }, x.face ? 'Change…' : 'Choose a picture…'),
        x.face ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => { delete x.face; rerender(); } }, 'Use their look') : h('span')),
        'Their face on the battle screen (Dragon Legend layout). Square pictures look best; without one, a face is cut from their look.')] : []),
      field('Colour', (() => { const c = h('input', { type: 'color', value: x.color ?? ['#e8b04a', '#5aa8ff', '#7cd66a', '#e87ad0', '#ff8a5a'][Math.max(0, state.sel) % 5] }); c.addEventListener('change', () => { x.color = c.value; }); return c; })(),
        'Shown behind "equipped" on what they wear, and on their card in the menus.'),
      field('About', (() => { const t = h('textarea', { rows: '3', placeholder: 'A few lines of story about them (shown on their Status page).' }); t.value = x.about ?? ''; t.addEventListener('change', () => { const v = t.value.trim(); if (v) x.about = v; else delete x.about; }); return t; })()),
      h('section', { class: 'db-section' }, h('h3', {}, main ? 'Starting stats (when character creation is off)' : 'Starting stats'),
        ...statRows,
        h('p', { class: 'note' }, `10 is normal. Strength and Magic: each point over 10 is +2% damage. Dexterity: +1% swing and draw speed (up to +50%). Defence and Magic Defence add to armour (50 halves a hit). Stats go up to ${ATTR_MAX}.`)),
      ...(main ? [] : [h('section', { class: 'db-section' }, h('h3', {}, 'In the party'),
        field('Fights as', select([['fighter', 'Fighter: closes in with their weapon'], ['archer', 'Archer: keeps back and shoots (needs a bow)'], ['caster', 'Caster: throws their spell shard (needs a shard)'], ['healer', 'Healer: heals whoever drops below half health, otherwise casts']],
          x.ai ?? 'fighter', (v) => { x.ai = v as AllyStyle; })),
        checkbox('In the party from the start of a new game', !!x.startsInParty, (v) => (x.startsInParty = v || undefined)),
        field('Joins at level', numberInput(x.joinLevel ?? 0, (v) => { const n = Math.max(0, Math.round(v)); x.joinLevel = n || undefined; }, { step: 1, min: 0, 'aria-label': 'Joins at level' }), '0: the same level as the hero you play when they join. They get the stat points that level gives, to spend in Party.'),
        h('div', { class: 'field-row' }, ...(['weapon', 'ranged', 'magic', 'armor'] as const).map((slot) => field({ weapon: 'Joins with weapon', ranged: 'Bow', magic: 'Spell shard', armor: 'Armor' }[slot],
          select([['', 'Nothing'], ...items.filter((it) => it.kind === 'equipment' && it.slot === slot).map((it) => [it.id, it.name] as [string, string])], x.gear?.[slot] ?? '', (v) => { x.gear ??= {}; if (v) x.gear[slot] = v; else delete x.gear[slot]; })))),
        h('p', { class: 'note' }, 'Use the event command “Change party” to have them join or leave. Up to three travel with the hero you play: they follow, fight on their own and share the bag and gold. Each has their own level: they get EXP for the enemies beaten while they were standing, once the fight is over (only the hero you play picks up what enemies drop). Their gear can be changed in the game (Inventory → Equipment, ← → for each hero).'))]),
      h('section', { class: 'db-section' }, h('h3', {}, 'Class, spells and Additions at the start'),
        learnable.classes.length ? field('Class', select([['', 'None'], ...learnable.classes.map((c) => [c.id, c.name] as [string, string])], x.cls ?? '', (v) => { if (v) x.cls = v; else delete x.cls; }), 'Opens that class’s skill trees (Database → Classes).') : h('span'),
        h('div', { class: 'db-table start-spells' }, ...learnable.spells.flatMap((sp) => [
          h('span', { class: 'db-name' }, sp.name),
          select([['0', 'Not known'], ...Array.from({ length: Math.max(1, sp.maxRank ?? 1) }, (_, k) => [String(k + 1), `Rank ${k + 1}`] as [string, string])], String(x.spells?.[sp.id] ?? 0), (v) => {
            const r = Number(v);
            if (r > 0) (x.spells ??= {})[sp.id] = r; else if (x.spells) { delete x.spells[sp.id]; if (!Object.keys(x.spells).length) delete x.spells; }
          }, { 'aria-label': `${sp.name} at the start` }),
        ])),
        h('div', { class: 'db-abilities' }, ...learnable.additions.map((ad) => checkbox(ad.name, !!x.additions?.includes(ad.id), (on) => {
          const set = new Set(x.additions ?? []);
          if (on) set.add(ad.id); else set.delete(ad.id);
          x.additions = learnable.additions.map((a) => a.id).filter((id) => set.has(id));
          if (!x.additions.length) delete x.additions;
        }))),
        h('p', { class: 'note' }, 'More are learned in the game from skill-tree skills, events and trainers.')),
      defenceSection(x, rerender, 'They'),
      field('Can’t get', ailmentChips(() => x.resists, (v) => { if (v) x.resists = v as Ailment[]; else delete x.resists; }, rerender, 'Can’t get'), 'Ailments this hero never gets (equipment can ward off more).'),
      ...(cr ? [h('section', { class: 'db-section' }, h('h3', {}, 'Character creation (new game)'),
        checkbox('Players make their stats after New Game', cr.enabled !== false, (v) => { cr.enabled = v ? undefined : false; rerender(); }),
        ...(cr.enabled !== false ? [
          h('div', { class: 'db-abilities' }, ...CREATION_METHODS.map((m) => checkbox(CREATION_NAMES[m], methods.includes(m), (on) => {
            const set = new Set(cr.methods ?? []);
            if (on) set.add(m); else set.delete(m);
            cr.methods = CREATION_METHODS.filter((k) => set.has(k));
            if (!cr.methods.length) cr.methods = ['roll'];
            rerender();
          }))),
          field('Rerolls', numberInput(cr.rerolls ?? 0, (v) => (cr.rerolls = Math.max(0, Math.round(v)) || undefined), { step: 1, min: 0 }), '0: as many as they like.'),
          h('p', { class: 'note' }, 'Roll: 4d6 for each value, the lowest dropped, arranged as the player likes. Point buy: every stat starts at 8, 22 points to raise them up to 15. Standard array: 16, 13, 12, 10, 8. Hard: 3d6 straight down the stats, no swaps or rerolls. The player can look at every way offered before choosing one.'),
        ] : [h('p', { class: 'note' }, 'The hero starts with the stats above.')]))] : []),
      main ? h('span') : h('div', { class: 'item-foot' }, h('button', { type: 'button', class: 'btn danger', onclick: () => { w.heroes.splice(state.sel, 1); state.sel = 0; rerender(); } }, 'Delete hero')),
    );
  }
  return [
    h('section', { class: 'db-section' }, h('h3', {}, 'Levelling'),
      field('Stat points per level', numberInput(combat.statPointsPerLevel ?? ATTR_POINTS_PER_LEVEL, (v) => { const n = Math.max(0, Math.round(v)); combat.statPointsPerLevel = n === ATTR_POINTS_PER_LEVEL ? undefined : n; }, { step: 1, min: 0 }),
        'Spent in Menu → Status. Skill points per level are in Combat.'),
      h('p', { class: 'note' }, 'Heroes after the first can join the party (event command “Change party”, or “In the party from the start”).')),
    h('div', { class: 'items-layout' }, list, form),
  ];
}
