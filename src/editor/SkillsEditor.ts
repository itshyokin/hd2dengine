/**
 * Database → Skills: the skill trees. Pick a tree, click a skill in the preview to edit it (name, place in
 * the grid, ranks, cost, what it needs, what it does), or add trees and skills as new abilities arrive.
 */
import { DEFAULT_SKILLS, SKILL_STATS, addPartyTree, effectText } from '../game/skills';
import type { AdditionDef, ItemDef, SkillNode, SkillStat, SkillsData, SpellEntry } from '../world/types';
import { checkbox, field, h, numberInput, select, textInput } from './dom';

const CELL = 70;

export function skillsTab(data: SkillsData, state: { tree: number; sel: string }, rerender: () => void, items: ItemDef[] = [], learnable: { spells: SpellEntry[]; additions: AdditionDef[] } = { spells: [], additions: [] }): HTMLElement[] {
  // Databases from before the Party tree get the built-in one (the game adds it too).
  if (data.nodes.length) addPartyTree(data, true);
  state.tree = Math.min(state.tree, data.trees.length - 1);
  const tree = data.trees[state.tree];
  const nodes = tree ? data.nodes.filter((n) => n.tree === tree.id) : [];
  if (!nodes.some((n) => n.id === state.sel)) state.sel = nodes[0]?.id ?? '';
  const tabs = h('div', { class: 'sk-ed-tabs' },
    ...data.trees.map((t, k) => h('button', { type: 'button', class: 'db-tab', 'aria-selected': String(k === state.tree), style: `color:${k === state.tree ? t.color ?? '' : ''}`, onclick: () => { state.tree = k; state.sel = ''; rerender(); } }, t.name)),
    h('button', { type: 'button', class: 'btn small', onclick: () => {
      let id = 'tree', n = 2;
      while (data.trees.some((t) => t.id === id)) id = `tree_${n++}`;
      data.trees.push({ id, name: 'New tree', color: '#c8a0ff' });
      state.tree = data.trees.length - 1; rerender();
    } }, '+ Tree'));
  if (!tree) return [tabs];

  // Preview: the constellation, clickable.
  const maxX = Math.max(4, ...nodes.map((n) => n.x)), maxY = Math.max(2, ...nodes.map((n) => n.y));
  const W = (maxX + 1) * CELL, H = (maxY + 1) * CELL;
  const pos = (n: SkillNode) => [n.x * CELL + CELL / 2, (maxY - n.y) * CELL + CELL / 2];
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'sk-ed-map');
  for (const n of nodes) for (const pid of n.parents ?? []) {
    const p = nodes.find((m) => m.id === pid);
    if (!p) continue;
    const [x1, y1] = pos(p), [x2, y2] = pos(n), l = document.createElementNS(ns, 'line');
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, String(v)));
    l.setAttribute('class', 'sk-ed-line');
    svg.appendChild(l);
  }
  for (const n of nodes) {
    const [x, y] = pos(n), g = document.createElementNS(ns, 'g');
    g.setAttribute('class', `sk-ed-node${n.id === state.sel ? ' sel' : ''}`);
    g.innerHTML = `<circle cx="${x}" cy="${y}" r="13" fill="${tree.color ?? '#e9c46a'}"/><text x="${x}" y="${y - 19}">${n.name.replace(/[&<>]/g, '')}</text>`;
    g.addEventListener('click', () => { state.sel = n.id; rerender(); });
    svg.appendChild(g);
  }
  const addSkill = () => {
    let id = 'skill', k = 2;
    while (data.nodes.some((x) => x.id === id)) id = `skill_${k++}`;
    const free = (x: number, y: number) => !nodes.some((m) => m.x === x && m.y === y);
    let x = 0, y = 0;
    while (!free(x, y)) { x++; if (x > 5) { x = 0; y++; } }
    data.nodes.push({ id, tree: tree.id, name: 'New skill', x, y, effects: [{ stat: 'meleeDamage', value: 5 }] });
    state.sel = id; rerender();
  };

  const node = nodes.find((n) => n.id === state.sel);
  const treeForm = h('div', { class: 'field-row' },
    field('Tree name', textInput(tree.name, (v) => { tree.name = v.trim() || tree.name; rerender(); })),
    field('Colour', (() => { const c = h('input', { type: 'color', value: tree.color ?? '#e9c46a' }); c.addEventListener('change', () => { tree.color = c.value; rerender(); }); return c; })()),
    checkbox('Party tree: shared by the whole party (Party points, one each level)', !!tree.shared, (v) => { if (v) tree.shared = true; else delete tree.shared; rerender(); }),
    h('button', { type: 'button', class: 'btn small danger', disabled: nodes.length > 0, title: nodes.length ? 'Remove its skills first' : 'Remove this tree', onclick: () => { data.trees.splice(state.tree, 1); state.tree = 0; rerender(); } }, 'Delete tree'));

  return [h('div', { class: 'sk-ed' },
    tabs,
    h('div', { class: 'sk-ed-body' },
      h('div', { class: 'sk-ed-left' }, treeForm, svg,
        h('div', { class: 'stack row' },
          h('button', { type: 'button', class: 'btn', onclick: addSkill }, '+ Skill'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => {
            if (!confirm('Replace every tree with the built-in Might, Dexterity, Magic, Vitality and Party trees?')) return;
            data.trees = JSON.parse(JSON.stringify(DEFAULT_SKILLS.trees)); data.nodes = JSON.parse(JSON.stringify(DEFAULT_SKILLS.nodes)); state.tree = 0; state.sel = ''; rerender();
          } }, 'Reset to built-in')),
        h('p', { class: 'note' }, 'Row 0 is the bottom: trees grow upwards. A skill needs at least one rank in each skill it’s linked from. Players earn skill points from levels (Database → Combat) and the “Give skill points” event command. A Party tree is learned once with Party points (one each time the hero levels up) and counts for everyone in the party, members who join later too; every hero sees it, whatever their class.')),
      h('div', { class: 'item-form' }, ...(node ? nodeForm(data, node, nodes, items, learnable, rerender, () => {
        data.nodes = data.nodes.filter((x) => x !== node);
        for (const x of data.nodes) if (x.parents) x.parents = x.parents.filter((p) => p !== node.id);
        state.sel = ''; rerender();
      }) : [h('p', { class: 'note' }, 'Click a skill to edit it, or add one.')]))))];
}

function nodeForm(data: SkillsData, n: SkillNode, siblings: SkillNode[], items: ItemDef[], learnable: { spells: SpellEntry[]; additions: AdditionDef[] }, rerender: () => void, remove: () => void): HTMLElement[] {
  const num = (v: number, set: (x: number) => void, min = 0, step = 1) => numberInput(v, (x) => { set(Math.max(min, x)); rerender(); }, { step, min });
  // "Spell: Fire" is from before spell shards: only offered where it's already used.
  const stats = Object.entries(SKILL_STATS).filter(([k]) => k !== 'spellFire' || n.effects.some((e) => e.stat === 'spellFire')).map(([k, v]) => [k, `${v.name}${v.flag ? ' (on/off)' : v.unit ? ` (${v.unit})` : ''}`] as [string, string]);
  return [
    h('div', { class: 'field-row' },
      field('Name', textInput(n.name, (v) => { n.name = v.trim() || n.name; rerender(); })),
      field('Id', textInput(n.id, (v) => {
        const id = v.trim().replace(/[^A-Za-z0-9_-]+/g, '_');
        if (!id || data.nodes.some((o) => o !== n && o.id === id)) return;
        for (const o of data.nodes) if (o.parents) o.parents = o.parents.map((p) => (p === n.id ? id : p));
        n.id = id; rerender();
      }, { title: 'Saves remember skills by id' }))),
    field('Description', textInput(n.description ?? '', (v) => (n.description = v.trim() || undefined))),
    h('div', { class: 'field-row' },
      field('Column', num(n.x, (v) => (n.x = Math.round(v * 10) / 10), 0, 0.5)),
      field('Row', num(n.y, (v) => (n.y = Math.round(v * 10) / 10), 0, 0.5)),
      field('Ranks', num(n.ranks ?? 1, (v) => (n.ranks = Math.max(1, Math.round(v)) === 1 ? undefined : Math.round(v)), 1)),
      field('Points per rank', num(n.cost ?? 1, (v) => (n.cost = Math.max(1, Math.round(v)) === 1 ? undefined : Math.round(v)), 1)),
      field('Level needed', num(n.level ?? 0, (v) => (n.level = Math.round(v) || undefined), 0))),
    h('div', { class: 'db-section' }, h('h3', {}, 'Needs'),
      ...(siblings.length > 1 ? siblings.filter((o) => o !== n).map((o) => checkbox(o.name, !!n.parents?.includes(o.id), (on) => {
        const set = new Set(n.parents ?? []);
        if (on) set.add(o.id); else set.delete(o.id);
        n.parents = set.size ? [...set] : undefined;
        rerender();
      })) : [h('p', { class: 'note' }, 'Nothing else in this tree yet.')])),
    h('div', { class: 'db-section' }, h('h3', {}, 'Each rank gives'),
      ...n.effects.map((e, k) => h('div', { class: 'field-row effect-row' },
        select(stats, e.stat, (v) => { e.stat = v as SkillStat; if (SKILL_STATS[e.stat].flag) e.value = 1; rerender(); }, { 'aria-label': `Effect ${k + 1}` }),
        SKILL_STATS[e.stat].flag ? h('span', { class: 'note' }, 'on') : numberInput(e.value, (v) => { e.value = v; rerender(); }, { step: 1, 'aria-label': `Effect ${k + 1} amount` }),
        h('span', { class: 'note' }, effectText(e)),
        h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove effect ${k + 1}`, onclick: () => { n.effects.splice(k, 1); rerender(); } }, '✕'))),
      h('button', { type: 'button', class: 'btn small', onclick: () => { n.effects.push({ stat: 'maxHp', value: 10 }); rerender(); } }, '+ Effect')),
    h('div', { class: 'db-section' }, h('h3', {}, 'Teaches'),
      h('div', { class: 'field-row' },
        field('Spell', select([['', '(none)'], ...learnable.spells.map((x) => [x.id, x.name] as [string, string])], n.teachesSpell ?? '', (v) => { if (v) n.teachesSpell = v; else { delete n.teachesSpell; delete n.spellRankFrom; } rerender(); })),
        n.teachesSpell ? field('Rank 1 of this skill teaches spell rank', num(n.spellRankFrom ?? 1, (v) => (n.spellRankFrom = Math.max(1, Math.round(v)) === 1 ? undefined : Math.round(v)), 1), 'Each further rank of the skill raises the spell one rank (Fire, then Fire II…).') : h('span'),
        field('Addition', select([['', '(none)'], ...learnable.additions.map((x) => [x.id, x.name] as [string, string])], n.teachesAddition ?? '', (v) => { if (v) n.teachesAddition = v; else delete n.teachesAddition; rerender(); }))),
      h('p', { class: 'note' }, 'Learning the skill teaches the spell or Addition (Database → Spells, Additions). A skill can teach without giving any other effect.')),
    h('div', { class: 'item-foot' }, h('button', { type: 'button', class: 'btn danger', onclick: remove }, 'Delete skill')),
  ];
}

/** Undefined when the trees are exactly the built-in ones (so they keep up with engine updates). */
export function cleanSkills(d: SkillsData): SkillsData | undefined {
  return JSON.stringify(d) === JSON.stringify(DEFAULT_SKILLS) ? undefined : d;
}
