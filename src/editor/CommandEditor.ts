/**
 * Event command list: a readable outline of an event's commands (with nested branches)
 * and a form dialog for each command type.
 */
import { WEEKDAYS } from '../world/seasons';
import { ABILITIES, WEATHER_KINDS, type WeatherKind, type Ailment, type Ability, type Command, type Database, type Condition, type Gauge, type QuestDef, type QuestOp, type QuestStatus } from '../world/types';
import { AILMENTS, AILMENT_INFO } from '../game/status';
import { checkbox, field, h, numberInput, openModal, select, textInput } from './dom';
import { transferFields, transferSummary } from './TransferPicker';
import { AMBIENCE_NAMES, MUSIC_NAMES, SFX_LABELS, SFX_NAMES } from '../audio/synth';
import { loopChoices } from '../audio/sfx';
import { additionList, classList, findAddition, findClass, findSpell, rankName, spellList, spellMaxRank } from '../game/abilities';
import type { EditorStore } from './store';
import { applyLook, messageStyles, parseRich, richHTML, setTextColors, textColors, type TextLook } from '../ui/richText';

type Cmd = Command['cmd'];

const COMMAND_TYPES: [Cmd, string][] = [
  ['text', 'Show text'], ['choice', 'Show choices'], ['if', 'Conditional branch'],
  ['setSwitch', 'Set switch'], ['setVar', 'Set variable'], ['wait', 'Wait'],
  ['fadeOut', 'Fade out'], ['fadeIn', 'Fade in'], ['setTime', 'Set time of day'], ['ability', 'Change ability'], ['fieldWeapons', 'Enable / disable overworld weapons'], ['achievement', 'Unlock achievement'], ['console', 'Run console command'], ['gauge', 'Change health / magic / stamina'], ['ailment', 'Give / cure an ailment'], ['fullRest', 'Full rest (restore the party)'], ['tendFire', 'Tend the fire (add fuel)'], ['transfer', 'Transfer player'], ['save', 'Open save screen'],
  ['giveItem', 'Give item'], ['takeItem', 'Take item'], ['gold', 'Change gold'], ['shop', 'Open shop'],
  ['sound', 'Play sound effect'], ['music', 'Change music'], ['ambience', 'Change background sound'], ['weather', 'Change weather'], ['skillPoints', 'Give skill points'], ['party', 'Change party'],
  ['quest', 'Quest'],
  ['battle', 'Start battle'], ['learn', 'Teach spell / Addition'], ['heroClass', 'Change class'],
];

const CATEGORY: Record<Cmd, string> = {
  text: 'msg', choice: 'msg', if: 'flow', setSwitch: 'state', setVar: 'state', wait: 'flow', fadeOut: 'screen', fadeIn: 'screen', setTime: 'screen', ability: 'state', fieldWeapons: 'state', achievement: 'quest', console: 'flow', gauge: 'state', ailment: 'state', fullRest: 'state', tendFire: 'item', transfer: 'screen', save: 'screen',
  giveItem: 'item', takeItem: 'item', gold: 'item', shop: 'item',
  sound: 'screen', music: 'screen', ambience: 'screen', weather: 'screen', party: 'state', skillPoints: 'state', quest: 'quest',
  battle: 'flow', learn: 'state', heroClass: 'state',
};

function defaultCommand(cmd: Cmd): Command {
  switch (cmd) {
    case 'text': return { cmd, text: '' };
    case 'choice': return { cmd, options: ['Yes', 'No'], branches: [[], []], cancel: 1 };
    case 'if': return { cmd, condition: { switch: '', is: true }, then: [], else: [] };
    case 'setSwitch': return { cmd, switch: '', value: true };
    case 'setVar': return { cmd, var: '', op: 'set', value: 0 };
    case 'wait': return { cmd, seconds: 0.5 };
    case 'fadeOut': return { cmd, seconds: 1 };
    case 'fadeIn': return { cmd, seconds: 1 };
    case 'setTime': return { cmd, hour: 8, instant: true };
    case 'ability': return { cmd, ability: 'climb', on: true };
    case 'gauge': return { cmd, gauge: 'hp', op: 'fill', value: 0 };
    case 'ailment': return { cmd, op: 'give', ailment: 'poison' };
    case 'fullRest': return { cmd };
    case 'tendFire': return { cmd };
    case 'transfer': return { cmd, map: '', x: 0, z: 0 };
    case 'save': return { cmd };
    case 'giveItem': return { cmd, item: '', count: 1 };
    case 'takeItem': return { cmd, item: '', count: 1 };
    case 'gold': return { cmd, op: 'add', value: 10 };
    case 'shop': return { cmd, goods: [], canSell: true };
    case 'sound': return { cmd, sound: 'item' };
    case 'music': return { cmd, music: 'builtin:field', fade: 1.5 };
    case 'ambience': return { cmd, ambience: 'builtin:wind' };
    case 'weather': return { cmd, kind: 'rain', amount: 1 };
    case 'party': return { cmd, op: 'add', hero: heroList()[0]?.[0] ?? '' };
    case 'skillPoints': return { cmd, value: 1 };
    case 'fieldWeapons': return { cmd, on: false };
    case 'achievement': return { cmd, id: dbNow?.().achievements?.[0]?.id ?? '' };
    case 'console': return { cmd, line: 'heal' };
    case 'quest': return { cmd, quest: questDefs()[0]?.id ?? '', op: 'start' };
    case 'battle': return { cmd, enemies: dbNow ? (dbNow().enemies ?? []).slice(0, 1).map((e) => e.id) : [] };
    case 'learn': return { cmd, who: '', spell: dbNow ? spellList(dbNow())[0]?.id : undefined, rank: 1 };
    case 'heroClass': return { cmd, who: '', op: 'change', cls: dbNow ? classList(dbNow())[0]?.id ?? '' : '' };
  }
}

/** The database being edited (for names in summaries and lists of enemies, spells, Additions and classes). */
let dbNow: (() => Database) | null = null;
const whoName = (who: string): string => (!who ? 'The hero' : who === '@party' ? 'The whole party' : (dbNow?.().heroes ?? []).find((x) => x.id === who)?.name ?? who);

/** Heroes who can join (all but the first), for the party command (set by the editor that owns the database). */
let heroList: () => [string, string][] = () => [];
export function setHeroLookup(fn: () => [string, string][]): void { heroList = fn; }

/** Item names for summaries (set by the editor that owns the database). */
let itemNames: (id: string) => string = (id) => id;
export function setItemNameLookup(fn: (id: string) => string): void { itemNames = fn; }
const itemName = (id: string) => (id ? itemNames(id) : '(no item)');

/** Item choices for a select, keeping an unknown current value visible. */
function itemChoices(store: EditorStore, current: string): [string, string][] {
  const out: [string, string][] = (store.db.items ?? []).map((d) => [d.id, d.name]);
  if (!out.length) out.push(['', '(no items yet: add some in Database → Items)']);
  else if (!current) out.unshift(['', 'Choose an item…']);
  if (current && !out.some(([id]) => id === current)) out.unshift([current, `${current} (missing)`]);
  return out;
}

export const WEATHER_NAMES: Record<WeatherKind, string> = { none: 'Clear', rain: 'Rain', snow: 'Snow', sandstorm: 'Sandstorm', pollen: 'Pollen', dust: 'Dust motes', leaves: 'Falling leaves' };
export const GAUGE_NAMES: Record<Gauge, string> = { hp: 'Health', mp: 'Magic', sp: 'Stamina' };
export const ABILITY_NAMES: Record<Ability, string> = { run: 'Run', jump: 'Jump', climb: 'Climb', crawl: 'Crawl' };

const hourLabel = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/** Quests in the database (set by the editor that owns it). */
let questDefs: () => QuestDef[] = () => [];
export function setQuestLookup(fn: () => QuestDef[]): void { questDefs = fn; }
const questName = (id: string) => (id ? questDefs().find((q) => q.id === id)?.name ?? `${id} (missing)` : '(no quest)');
const objectiveName = (quest: string, id: string | undefined) => {
  const o = questDefs().find((q) => q.id === quest)?.objectives.find((x) => x.id === id);
  return o ? `“${o.text}”` : id ? `${id} (missing)` : '(no objective)';
};
export const QUEST_STATUS_NAMES: [QuestStatus | 'started', string][] = [
  ['inactive', 'Not started'], ['started', 'Started (in progress or ready)'], ['active', 'In progress'], ['ready', 'Ready to hand in'], ['done', 'Completed'], ['failed', 'Failed']];
const QUEST_OPS: [QuestOp, string][] = [['start', 'Start the quest'], ['objective', 'Complete an objective (or count it up)'], ['complete', 'Complete the quest (gives the rewards)'], ['fail', 'Fail the quest'], ['reset', 'Forget it (back to not started)']];

/** Quest choices for a select, keeping an unknown current value visible. */
function questChoices(current: string): [string, string][] {
  const out: [string, string][] = questDefs().map((q) => [q.id, q.name]);
  if (!out.length) out.push(['', '(no quests yet: add some in Database → Quests)']);
  if (current && !out.some(([id]) => id === current)) out.unshift([current, `${current} (missing)`]);
  return out;
}
function objectiveChoices(quest: string, current: string | undefined): [string, string][] {
  const out: [string, string][] = (questDefs().find((q) => q.id === quest)?.objectives ?? []).map((o) => [o.id, o.text || o.id]);
  if (!out.length) out.push(['', '(this quest has no objectives)']);
  if (current && !out.some(([id]) => id === current)) out.unshift([current, `${current} (missing)`]);
  return out;
}

export function conditionText(c: Condition): string {
  if ('quest' in c) {
    if ('objective' in c) return `${questName(c.quest)}: ${objectiveName(c.quest, c.objective)} ${c.done === false ? 'not done' : 'done'}`;
    return `quest ${questName(c.quest)} is ${QUEST_STATUS_NAMES.find(([k]) => k === c.is)?.[1].toLowerCase() ?? c.is}`;
  }
  if ('switch' in c) return `switch ${c.switch || '(unnamed)'} is ${c.is === false ? 'OFF' : 'ON'}`;
  if ('item' in c) return `has ${(c.count ?? 1) > 1 ? `${c.count} × ` : ''}${itemName(c.item)}`;
  if ('gold' in c) return `gold ≥ ${c.gold}`;
  if ('weekday' in c) return `it's ${c.weekday.length ? c.weekday.map((d) => WEEKDAYS[d]).join(' or ') : '(no day picked)'} (real world)`;
  return `variable ${c.var || '(unnamed)'} ${c.op} ${c.value}`;
}

function summary(c: Command): string {
  switch (c.cmd) {
    case 'text': {
      const first = c.text.split('\n')[0] || '(empty)';
      const st = c.style ? messageStyles(dbNow?.().messageStyles).find((x) => x.id === c.style)?.name.replace(/ \(.*\)$/, '') : '';
      return `${st ? `[${st}] ` : ''}${c.speaker ? c.speaker + ': ' : ''}${first}${c.text.includes('\n') ? ' …' : ''}`;
    }
    case 'choice': return c.options.join(' / ');
    case 'if': return conditionText(c.condition);
    case 'setSwitch': return `${c.switch || '(unnamed)'} = ${c.value ? 'ON' : 'OFF'}`;
    case 'setVar': return `${c.var || '(unnamed)'} ${c.op === 'add' ? (c.value < 0 ? '−=' : '+=') : '='} ${c.op === 'add' ? Math.abs(c.value) : c.value}`;
    case 'wait': return `${c.seconds} s`;
    case 'fadeOut': case 'fadeIn': return `${c.seconds ?? 0.8} s`;
    case 'setTime': return `${hourLabel(c.hour)}${c.instant ? ', instantly' : ''}`;
    case 'ability': return `${ABILITY_NAMES[c.ability]}: ${c.on ? 'learn (on)' : 'lose (off)'}`;
    case 'transfer': return transferSummary(c);
    case 'save': return 'Let the player save (a save point)';
    case 'fullRest': return 'Health, magic and stamina to full; ailments cured';
    case 'tendFire': return 'Open the nearest fire’s fuel menu';
    case 'ailment': return `${c.op === 'give' ? 'Give' : 'Cure'} ${c.ailment === 'all' ? 'all ailments' : AILMENT_INFO[c.ailment].name}${c.op === 'give' && c.seconds ? ` for ${c.seconds}s` : ''}`;
    case 'gauge': return `${GAUGE_NAMES[c.gauge]} ${c.op === 'fill' ? 'to full' : c.op === 'set' ? `= ${c.value}` : c.value < 0 ? `− ${-c.value}` : `+ ${c.value}`}`;
    case 'giveItem': return `${c.count} × ${itemName(c.item)}${c.silent ? ' (quietly)' : ''}`;
    case 'takeItem': return `${c.count} × ${itemName(c.item)}`;
    case 'gold': return c.op === 'set' ? `= ${c.value} G` : c.value < 0 ? `− ${-c.value} G` : `+ ${c.value} G`;
    case 'sound': return soundName(c.sound);
    case 'music': return c.music === undefined ? 'Back to the map’s music' : c.music ? loopName(c.music) : 'Stop the music';
    case 'ambience': return c.ambience === undefined ? 'Back to the map’s sound' : c.ambience ? loopName(c.ambience) : 'Silence';
    case 'weather': return `${c.kind === 'none' ? 'Clear skies' : `${WEATHER_NAMES[c.kind]}${c.amount !== undefined && c.amount !== 1 ? ` × ${c.amount}` : ''}`}${c.wind !== undefined ? `, wind ${c.wind}` : ''}${c.scope === 'world' ? ' (shared outdoor weather)' : ''}`;
    case 'party': return `${heroList().find(([id]) => id === c.hero)?.[1] ?? (c.hero || '(no hero)')} ${c.op === 'add' ? 'joins' : 'leaves'}${c.quiet ? ' (quietly)' : ''}`;
    case 'skillPoints': return `+${c.value} skill point${c.value === 1 ? '' : 's'}`;
    case 'fieldWeapons': return c.on ? 'Overworld weapons: enabled' : 'Overworld weapons: disabled';
    case 'achievement': return `Unlock: ${dbNow?.().achievements?.find((a) => a.id === c.id)?.name ?? (c.id || '(none chosen)')}`;
    case 'console': return `> ${c.line}`;
    case 'battle': {
      const names = c.enemies.map((id) => (dbNow?.().enemies ?? []).find((e) => e.id === id)?.name ?? id);
      return `Battle: ${names.join(', ') || '(no enemies)'}${c.map ? ` on ${c.map}` : ''}${c.canRun ? '' : ' · no running'}${c.lose === 'continue' ? ' · may lose' : ''}${c.resultVar ? ` → ${c.resultVar}` : ''}`;
    }
    case 'learn': {
      const db = dbNow?.(), sp = db ? findSpell(db, c.spell) : undefined, ad = db ? findAddition(db, c.addition) : undefined;
      return `${whoName(c.who)} learns ${[sp ? rankName(sp.name, c.rank ?? 1) : '', ad ? ad.name : ''].filter(Boolean).join(' and ') || '(nothing)'}`;
    }
    case 'heroClass': {
      const cl = dbNow ? findClass(dbNow(), c.cls) : undefined;
      return `${whoName(c.who)}: ${c.op === 'change' ? 'becomes' : 'may become'} ${cl?.name ?? (c.cls || '(no class)')}`;
    }
    case 'quest': {
      const q = questName(c.quest);
      if (c.op === 'objective') return `${q}: ${objectiveName(c.quest, c.objective)}${c.add !== undefined ? ` ${c.add < 0 ? '−' : '+'}${Math.abs(c.add)}` : ' done'}`;
      return `${{ start: 'Start', complete: 'Complete', fail: 'Fail', reset: 'Forget', objective: '' }[c.op]} ${q}`;
    }
    case 'shop': return `${c.name || 'Shop'}: ${c.goods.length ? c.goods.map((g) => itemName(g.item)).join(', ') : 'nothing for sale'}${c.canSell === false ? ' (no selling)' : ''}`;
  }
}
const label = (cmd: Cmd) => COMMAND_TYPES.find(([c]) => c === cmd)![1];

/* ------------------------------------------------------------ list */

/** Copied commands (shared by every event, so they can be pasted into another one). */
let clipboard: Command[] = [];

export class CommandEditor {
  constructor(private readonly store: EditorStore) {
    setItemNameLookup((id) => store.db.items?.find((d) => d.id === id)?.name ?? `${id} (missing)`);
    setConditionItems(() => (store.db.items ?? []).map((d) => [d.id, d.name] as [string, string]));
    setQuestLookup(() => store.db.quests ?? []);
    setHeroLookup(() => (store.db.heroes ?? []).slice(1).map((h) => [h.id, h.name] as [string, string]));
    dbNow = () => store.db;
  }

  /** The highlighted command: the list it's in and where. */
  private sel: { list: Command[]; i: number } | null = null;
  /** The list and element being shown (to redraw after a highlight or move). */
  private root: { el: HTMLElement; list: Command[] } | null = null;
  private drag: { list: Command[]; i: number } | null = null;

  /**
   * Build the outline for a command list. Click highlights a command, double-click edits it. With one highlighted:
   * ↑ ↓ pick another, Alt+↑ / Alt+↓ (or the arrows beside it, or dragging) move it, Ctrl+C / Ctrl+X / Ctrl+V copy,
   * cut and paste (below it), Ctrl+D duplicates, Delete removes, Enter edits. Changes go through the store (undoable).
   */
  render(list: Command[]): HTMLElement {
    if (this.root?.list !== list) this.sel = null;
    if (this.sel && !this.contains(list, this.sel.list)) this.sel = null;
    const focused = !!this.root?.el.contains(document.activeElement);
    const el = h('div', { class: 'commands', tabindex: '0', 'aria-label': 'Commands' });
    el.addEventListener('keydown', (e) => this.key(e));
    this.root = { el, list };
    // Rebuilt after a change: keep the keyboard on the list.
    if (focused) queueMicrotask(() => el.focus({ preventScroll: true }));
    this.draw();
    return el;
  }

  /** Redraw in place (a highlight, a move), keeping the scroll position and focus. */
  private draw(): void {
    const r = this.root;
    if (!r) return;
    const scroller = r.el.closest('.ev-commands, .side-body') as HTMLElement | null, top = scroller?.scrollTop ?? 0;
    r.el.replaceChildren(this.toolbar(), this.list(r.list, 0));
    if (scroller) scroller.scrollTop = top;
  }

  private contains(list: Command[], target: Command[]): boolean {
    if (list === target) return true;
    for (const c of list) {
      if (c.cmd === 'choice' && c.branches.some((b) => this.contains(b, target))) return true;
      if (c.cmd === 'if' && (this.contains(c.then, target) || (c.else && this.contains(c.else, target)))) return true;
    }
    return false;
  }

  private change(fn: () => void): void {
    this.store.checkpoint();
    fn();
    this.store.changed('structure');
  }

  private toolbar(): HTMLElement {
    const sel = this.sel, has = !!sel && !!sel.list[sel.i];
    const b = (text: string, title: string, fn: () => void, on: boolean) =>
      h('button', { type: 'button', class: 'btn small', title, disabled: !on, onclick: (e: Event) => { e.stopPropagation(); fn(); } }, text);
    return h('div', { class: 'cmd-toolbar' },
      b('↑', 'Move up (Alt+↑)', () => this.move(-1), has && sel!.i > 0),
      b('↓', 'Move down (Alt+↓)', () => this.move(1), has && sel!.i < sel!.list.length - 1),
      b('Edit', 'Edit (Enter or double-click)', () => this.edit(sel!.list[sel!.i], sel!.list, false), has),
      b('Copy', 'Copy (Ctrl+C)', () => this.copy(), has),
      b('Cut', 'Cut (Ctrl+X)', () => { this.copy(); this.remove(); }, has),
      b('Paste', clipboard.length ? `Paste ${clipboard.length === 1 ? label(clipboard[0].cmd) : `${clipboard.length} commands`} (Ctrl+V)` : 'Nothing copied yet', () => this.paste(), clipboard.length > 0),
      b('Delete', 'Delete (Del)', () => this.remove(), has));
  }

  private select(list: Command[], i: number): void {
    this.sel = { list, i };
    this.draw();
    this.root?.el.focus({ preventScroll: true });
  }

  private move(d: number): void {
    const s = this.sel;
    if (!s || !s.list[s.i + d] || !s.list[s.i]) return;
    this.change(() => { [s.list[s.i + d], s.list[s.i]] = [s.list[s.i], s.list[s.i + d]]; });
    this.sel = { list: s.list, i: s.i + d };
    this.draw();
  }

  private copy(): void {
    const s = this.sel;
    if (!s?.list[s.i]) return;
    clipboard = [JSON.parse(JSON.stringify(s.list[s.i])) as Command];
    this.draw();
  }

  private paste(): void {
    if (!clipboard.length) return;
    const s = this.sel, list = s?.list ?? this.root?.list;
    if (!list) return;
    const at = s ? s.i + 1 : list.length;
    this.change(() => list.splice(at, 0, ...(JSON.parse(JSON.stringify(clipboard)) as Command[])));
    this.sel = { list, i: at + clipboard.length - 1 };
    this.draw();
  }

  private remove(): void {
    const s = this.sel;
    if (!s?.list[s.i]) return;
    this.change(() => s.list.splice(s.i, 1));
    this.sel = s.list.length ? { list: s.list, i: Math.min(s.i, s.list.length - 1) } : null;
    this.draw();
  }

  private key(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    const mod = e.ctrlKey || e.metaKey, s = this.sel;
    let done = true;
    if (mod && e.key.toLowerCase() === 'z') { if (e.shiftKey) this.store.redo(); else this.store.undo(); }
    else if (mod && e.key.toLowerCase() === 'y') this.store.redo();
    else if (mod && e.key.toLowerCase() === 'c') this.copy();
    else if (mod && e.key.toLowerCase() === 'x') { this.copy(); this.remove(); }
    else if (mod && e.key.toLowerCase() === 'v') this.paste();
    else if (mod && e.key.toLowerCase() === 'd' && s?.list[s.i]) { this.change(() => s.list.splice(s.i + 1, 0, JSON.parse(JSON.stringify(s.list[s.i])) as Command)); this.select(s.list, s.i + 1); }
    else if (e.altKey && e.key === 'ArrowUp') this.move(-1);
    else if (e.altKey && e.key === 'ArrowDown') this.move(1);
    else if (e.key === 'ArrowUp' && s && s.i > 0) this.select(s.list, s.i - 1);
    else if (e.key === 'ArrowDown' && s && s.i < s.list.length - 1) this.select(s.list, s.i + 1);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && s) this.remove();
    else if (e.key === 'Enter' && s?.list[s.i]) this.edit(s.list[s.i], s.list, false);
    else if (e.key === 'Escape' && s) { this.sel = null; this.draw(); }
    else done = false;
    if (done) { e.preventDefault(); e.stopPropagation(); }
    // Keep the map's own shortcuts (copy an event, undo…) from also acting on these keys.
    else if (mod) e.stopPropagation();
  }

  private list(list: Command[], depth: number): HTMLElement {
    const rows = list.map((c, i) => this.row(list, c, i, depth));
    const add = select([['', '+ Add command…'], ...COMMAND_TYPES], '', (v) => {
      if (!v) return;
      const cmd = defaultCommand(v as Cmd);
      this.store.checkpoint();
      // Added under the highlighted command when it's in this list, otherwise at the end.
      const at = this.sel?.list === list ? this.sel.i + 1 : list.length;
      list.splice(at, 0, cmd);
      this.sel = { list, i: at };
      this.store.changed('structure');
      this.edit(cmd, list, true);
    }, { class: 'add-cmd', 'aria-label': 'Add command' });
    const end = h('li', { class: 'cmd-add' }, add);
    // Dropping on the "add" line puts the command at the end of this list.
    this.dropTarget(end, list, () => list.length);
    return h('ol', { class: `cmd-list depth-${Math.min(depth, 3)}` }, ...rows, end);
  }

  /** Something dragged can be dropped here: moved to `at()` in `list`. */
  private dropTarget(el: HTMLElement, list: Command[], at: () => number): void {
    el.addEventListener('dragover', (e) => {
      const d = this.drag;
      if (!d) return;
      const moving = d.list[d.i];
      // Not into its own branches.
      if (moving && (moving.cmd === 'choice' || moving.cmd === 'if') && this.contains([moving], list)) return;
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('drop-here');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-here'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      el.classList.remove('drop-here');
      const d = this.drag;
      this.drag = null;
      if (!d || !d.list[d.i]) return;
      let to = at();
      if (d.list === list && (to === d.i || to === d.i + 1)) return;
      this.change(() => {
        const [c] = d.list.splice(d.i, 1);
        if (d.list === list && d.i < to) to--;
        list.splice(to, 0, c);
        this.sel = { list, i: to };
      });
      this.draw();
    });
  }

  private row(list: Command[], c: Command, i: number, depth: number): HTMLElement {
    const selected = this.sel?.list === list && this.sel.i === i;
    const btn = (text: string, title: string, fn: () => void, disabled = false) =>
      h('button', { type: 'button', class: 'mini-btn', title, 'aria-label': title, disabled, onclick: (e: Event) => { e.stopPropagation(); fn(); } }, text);
    const main = h('button', { type: 'button', class: 'cmd-main', title: 'Click to highlight, double-click to edit',
      onclick: () => this.select(list, i), ondblclick: () => this.edit(c, list, false) },
      h('span', { class: 'cmd-grip', 'aria-hidden': 'true' }, '⋮⋮'),
      h('span', { class: 'cmd-tag' }, label(c.cmd)),
      h('span', { class: 'cmd-text' }, summary(c)));
    const line = h('div', { class: `cmd-line cat-${CATEGORY[c.cmd]}${selected ? ' selected' : ''}`, draggable: 'true' }, main,
      selected ? h('span', { class: 'cmd-actions' },
        btn('↑', 'Move up', () => this.move(-1), i === 0),
        btn('↓', 'Move down', () => this.move(1), i === list.length - 1),
        btn('⧉', 'Duplicate', () => { this.change(() => list.splice(i + 1, 0, JSON.parse(JSON.stringify(c)) as Command)); this.select(list, i + 1); }),
        btn('✕', 'Delete', () => this.remove())) : null);
    line.addEventListener('dragstart', (e) => { this.drag = { list, i }; e.dataTransfer?.setData('text/plain', label(c.cmd)); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; line.classList.add('dragging'); });
    line.addEventListener('dragend', () => { this.drag = null; line.classList.remove('dragging'); });
    // Dropping on a command puts the dragged one just before it.
    this.dropTarget(line, list, () => list.indexOf(c));
    const children: Node[] = [];
    if (c.cmd === 'choice') {
      c.options.forEach((o, k) => children.push(h('div', { class: 'branch' }, h('div', { class: 'branch-label' }, `When “${o}”`), this.list(c.branches[k] ?? (c.branches[k] = []), depth + 1))));
    } else if (c.cmd === 'if') {
      children.push(h('div', { class: 'branch' }, h('div', { class: 'branch-label' }, 'Then'), this.list(c.then, depth + 1)));
      children.push(h('div', { class: 'branch' }, h('div', { class: 'branch-label' }, 'Otherwise'), this.list(c.else ?? (c.else = []), depth + 1)));
    }
    return h('li', { class: 'cmd' }, line, ...children);
  }

  /* ------------------------------------------------------------ dialogs */

  /** Open a command's form (used to set up a just-created transfer event). */
  editCommand(c: Command, list: Command[], isNew = false): void {
    this.edit(c, list, isNew);
  }

  private edit(c: Command, list: Command[], isNew: boolean): void {
    const names = this.store.knownNames();
    const draft = JSON.parse(JSON.stringify(c)) as Command;
    const lists = h('div', { hidden: true },
      h('datalist', { id: 'dl-switches' }, ...names.switches.map((n) => h('option', { value: n }))),
      h('datalist', { id: 'dl-vars' }, ...names.vars.map((n) => h('option', { value: n }))),
      h('datalist', { id: 'dl-speakers' }, ...names.speakers.map((n) => h('option', { value: n }))));
    const form = h('div', { class: 'form' }, lists, ...this.form(draft));
    const removeIfNew = () => {
      if (!isNew) return;
      const i = list.indexOf(c);
      if (i >= 0) { list.splice(i, 1); this.store.dropCheckpoint(); this.store.changed('structure'); }
    };
    openModal(isNew ? `Add: ${label(c.cmd)}` : label(c.cmd), form, [
      { label: 'Cancel', onClick: removeIfNew },
      { label: isNew ? 'Add' : 'Save', primary: true, onClick: () => {
        if (!isNew) this.store.checkpoint();
        if (draft.cmd === 'choice') {
          draft.options = draft.options.map((o) => o.trim()).filter(Boolean);
          if (!draft.options.length) draft.options = ['OK'];
          draft.branches = draft.options.map((_, k) => draft.branches[k] ?? []);
          if (draft.cancel !== undefined && draft.cancel >= draft.options.length) draft.cancel = undefined;
        }
        for (const k of Object.keys(c)) delete (c as unknown as Record<string, unknown>)[k];
        Object.assign(c, draft);
        this.store.changed('structure');
      } },
    ], removeIfNew);
  }

  private form(d: Command): HTMLElement[] {
    switch (d.cmd) {
      case 'text': {
        const ta = h('textarea', { rows: 4, class: 'text-area' });
        ta.value = d.text;
        const td = d;
        const previewBox = h('div', { class: 'msg cmd-msg-preview', 'aria-label': 'Preview' }, h('div', { class: 'msg-box' }, h('div', { class: 'msg-text' })));
        ta.addEventListener('input', () => { d.text = ta.value; preview(); });
        queueMicrotask(() => preview());
        const sp = textInput(d.speaker ?? '', (v) => (d.speaker = v.trim() || undefined), { list: 'dl-speakers', placeholder: 'Nobody (narration)' });
        sp.addEventListener('input', () => (d.speaker = sp.value.trim() || undefined));
        const styles = messageStyles(dbNow?.().messageStyles);
        const styleOf = () => styles.find((x) => x.id === td.style);
        return [field('Speaker', sp), formatBar(ta, () => { d.text = ta.value; preview(); }), field('Text', ta, 'Use new lines to break the text. \\v[name] shows a variable, \\s[name] a switch. Select words and use the buttons above to bold or colour just them.'),
          field('Style', select([['', 'Automatic (Speech for people, Sign for signs and objects, Narration with nobody)'], ...styles.map((x) => [x.id, x.name] as [string, string])], d.style ?? '',
            (v) => { if (v) td.style = v; else delete td.style; preview(); }), 'Text box styles are set up in Database → Text boxes, so every message using one changes together.'),
          field('Box', select([['auto', 'From the style'], ['speech', 'Speech bubble (with a tail)'], ['plain', 'Plain box (no tail)']],
            d.bubble ?? 'auto', (v) => (d.bubble = v === 'auto' ? undefined : (v as 'speech' | 'plain'))), 'Players choose where boxes go (over the speaker, or fixed on screen) in Settings.'),
          ...lookFields(d, () => preview(), 'Change the look just for this message', () => ({ ...(styleOf()?.look ?? { color: '#fff6dc', bubble: '#0e1222' }) })), previewBox];
        function preview(): void {
          setTextColors(dbNow?.().textColors);
          const t = previewBox.querySelector('.msg-text') as HTMLElement;
          t.innerHTML = richHTML(parseRich(td.text || '…'));
          applyLook(previewBox, td.look ?? styleOf()?.look, t);
        }
      }
      case 'choice': {
        const ta = h('textarea', { rows: 4 });
        ta.value = d.options.join('\n');
        const cancel = select([], '', () => {});
        const syncCancel = () => {
          const opts = ta.value.split('\n').map((o) => o.trim()).filter(Boolean);
          cancel.replaceChildren(h('option', { value: '' }, 'Can’t be cancelled'), ...opts.map((o, k) => h('option', { value: String(k) }, o)));
          cancel.value = d.cancel !== undefined && d.cancel < opts.length ? String(d.cancel) : '';
        };
        ta.addEventListener('input', () => { d.options = ta.value.split('\n'); syncCancel(); });
        cancel.addEventListener('change', () => (d.cancel = cancel.value === '' ? undefined : parseInt(cancel.value, 10)));
        syncCancel();
        return [field('Options (one per line)', ta, 'Each option gets its own branch of commands.'), field('If the player cancels (Esc)', cancel)];
      }
      case 'if':
        return [conditionForm(d.condition, (c) => (d.condition = c), false)];
      case 'setSwitch':
        return [field('Switch', textInput(d.switch, (v) => (d.switch = v.trim()), { list: 'dl-switches', placeholder: 'e.g. met_mira' })),
          field('Set to', select([['on', 'ON'], ['off', 'OFF']], d.value ? 'on' : 'off', (v) => (d.value = v === 'on')))];
      case 'setVar':
        return [field('Variable', textInput(d.var, (v) => (d.var = v.trim()), { list: 'dl-vars', placeholder: 'e.g. gold' })),
          field('Operation', select([['set', 'Set to'], ['add', 'Add (use a negative number to subtract)']], d.op, (v) => (d.op = v as 'set' | 'add'))),
          field('Value', numberInput(d.value, (v) => (d.value = v), { step: 1 }))];
      case 'wait':
        return [field('Seconds', numberInput(d.seconds, (v) => (d.seconds = Math.max(0, v)), { step: 0.1, min: 0 }))];
      case 'fadeOut': case 'fadeIn':
        return [field('Duration (seconds)', numberInput(d.seconds ?? 0.8, (v) => (d.seconds = Math.max(0, v)), { step: 0.1, min: 0 }))];
      case 'setTime':
        return [field('Hour (0 – 23.75)', numberInput(d.hour, (v) => (d.hour = Math.min(23.75, Math.max(0, v))), { step: 0.25, min: 0, max: 23.75 }), '0 = midnight, 6 = dawn, 12 = noon, 19.5 = dusk, 22 = night. The clock keeps running from there.'),
          field('Change', select([['instant', 'Instantly'], ['ease', 'Gradually']], d.instant ? 'instant' : 'ease', (v) => (d.instant = v === 'instant')))];
      case 'ability':
        return [field('Ability', select(ABILITIES.map((a) => [a, ABILITY_NAMES[a]] as [string, string]), d.ability, (v) => (d.ability = v as Ability))),
          field('Player', select([['on', 'Learns it (on)'], ['off', 'Loses it (off)']], d.on ? 'on' : 'off', (v) => (d.on = v === 'on')),
            'Lock an ability at the start (Database → Player) and unlock it here, e.g. after finding climbing gloves.')];
      case 'transfer':
        return transferFields(this.store, d);
      case 'save':
        return [h('p', { class: 'hint' }, 'Opens the save screen; the event continues once the player closes it. Use it for save points (a statue, a bed, a journal), especially if saving from the menu is turned off in Database → Saving.')];
      case 'fullRest':
        return [h('p', { class: 'hint' }, 'For an inn bed or a campfire: health, magic and stamina back to full for the whole party, and ailments cured (Zombie needs its own cure). Pair it with “Set time of day” to sleep until morning.')];
      case 'tendFire':
        return [h('p', { class: 'hint' }, 'Opens the fuel menu of the fire nearest the hero (a fire prop with a burn time): how long it burns, and fuel from the bag to add. Use it as one of a campfire event’s choices. In text, \\fire shows how long the nearest fire burns, e.g. “The fire will burn for \\fire.”')];
      case 'ailment': {
        const secs = field('For (seconds)', numberInput(d.seconds ?? 0, (v) => { const n = Math.max(0, Math.round(v * 10) / 10); if (n) d.seconds = n; else delete d.seconds; }, { step: 1, min: 0 }), '0: its usual time (Zombie: until cured).');
        secs.hidden = d.op !== 'give';
        const ailSel = select([...(d.op === 'cure' ? [['all', 'All ailments (not Zombie)'] as [string, string]] : []), ...AILMENTS.map((a) => [a, AILMENT_INFO[a].name] as [string, string])], d.ailment, (v) => (d.ailment = v as Ailment | 'all'));
        return [field('Do', select([['give', 'Give'], ['cure', 'Cure']], d.op, (v) => {
          d.op = v as 'give' | 'cure'; secs.hidden = d.op !== 'give';
          if (d.op === 'give' && d.ailment === 'all') d.ailment = 'poison';
          ailSel.replaceChildren(...[...(d.op === 'cure' ? [['all', 'All ailments (not Zombie)']] : []), ...AILMENTS.map((a) => [a, AILMENT_INFO[a].name])].map(([k, l]) => h('option', { value: k }, l)));
          ailSel.value = d.ailment;
        })), field('Ailment', ailSel), secs,
        h('p', { class: 'hint' }, 'The hero’s own resistances and gear that wards it off still count when giving. For a trap, a poison swamp or a cursed chest.')];
      }
      case 'gauge': {
        const value = numberInput(d.value, (v) => (d.value = v), { step: 1 });
        const valueField = field('Amount', value, 'For Add, a negative amount takes away (damage, spending magic).');
        valueField.hidden = d.op === 'fill';
        return [field('Gauge', select((['hp', 'mp', 'sp'] as Gauge[]).map((g) => [g, GAUGE_NAMES[g]] as [string, string]), d.gauge, (v) => (d.gauge = v as Gauge))),
          field('Change', select([['fill', 'Fill to maximum'], ['add', 'Add'], ['set', 'Set to']], d.op, (v) => { d.op = v as 'add' | 'set' | 'fill'; valueField.hidden = d.op === 'fill'; })),
          valueField];
      }
      case 'giveItem': case 'takeItem': {
        const out = [field('Item', select(itemChoices(this.store, d.item), d.item, (v) => (d.item = v))),
          field('How many', numberInput(d.count, (v) => (d.count = Math.max(1, Math.round(v))), { step: 1, min: 1 }))];
        if (d.cmd === 'giveItem') {
          const g = d;
          out.push(checkbox('Quietly (no “Received …!” message)', !!g.silent, (v) => (g.silent = v || undefined)));
          out.push(h('p', { class: 'hint' }, 'If the bag is full, the player is told and the event stops here, so a chest that sets its switch after this stays closed.'));
        } else out.push(h('p', { class: 'hint' }, 'Takes as many as the player has (equipped items are taken off first). Check with a conditional branch “has item” beforehand.'));
        return out;
      }
      case 'gold':
        return [field('Change', select([['add', 'Add (negative to take away)'], ['set', 'Set to']], d.op, (v) => (d.op = v as 'add' | 'set'))),
          field('Amount', numberInput(d.value, (v) => (d.value = Math.round(v)), { step: 1 })),
          checkbox('Quietly (no message)', !!d.silent, (v) => (d.silent = v || undefined))];
      case 'sound': {
        const opts: [string, string][] = [...SFX_NAMES.map((n) => [n, `${SFX_LABELS[n]} (built-in)`] as [string, string]), ...audioFiles().map((f) => [f, f.split('/').pop()!] as [string, string])];
        if (!opts.some(([v]) => v === d.sound)) opts.unshift([d.sound, d.sound]);
        return [field('Sound', select(opts, d.sound, (v) => (d.sound = v))), previewButton(() => previewSound(d.sound))];
      }
      case 'music': {
        const opts: [string, string][] = [['@map', 'Back to the map’s music'], ...loopChoices('music', audioFiles()).map(([v, l]) => [v, v ? l : 'Stop the music'] as [string, string])];
        return [field('Music', select(opts, d.music === undefined ? '@map' : d.music, (v) => (d.music = v === '@map' ? undefined : v))),
          field('Crossfade (seconds)', numberInput(d.fade ?? 1.5, (v) => (d.fade = Math.max(0, v)), { step: 0.5, min: 0 })),
          h('p', { class: 'hint' }, 'Lasts until the player leaves the map. Battle music (map settings) still takes over in a fight.')];
      }
      case 'ambience': {
        const opts: [string, string][] = [['@map', 'Back to the map’s sound'], ...loopChoices('ambience', audioFiles()).map(([v, l]) => [v, v ? l : 'Silence'] as [string, string])];
        return [field('Background sound', select(opts, d.ambience === undefined ? '@map' : d.ambience, (v) => (d.ambience = v === '@map' ? undefined : v))),
          h('p', { class: 'hint' }, 'Lasts until the player leaves the map.')];
      }
      case 'party': {
        const list = heroList();
        return [
          field('Hero', select(list.length ? list : [['', '(add more heroes in Database → Heroes)']], d.hero, (v) => (d.hero = v))),
          field('Do', select([['add', 'Joins the party'], ['remove', 'Leaves the party']], d.op, (v) => (d.op = v as 'add' | 'remove'))),
          checkbox('Quietly (no message)', !!d.quiet, (v) => (d.quiet = v || undefined)),
          h('p', { class: 'hint' }, `Up to ${3} join the hero you play. They follow, fight on their own (their AI style in Database → Heroes) and share the bag, gold and level. Leaving, their equipment goes back in the bag.`),
        ];
      }
      case 'weather': {
        const amt = field('How heavy', numberInput(d.amount ?? 1, (v) => (d.amount = Math.max(0.1, Math.min(2, Math.round(v * 10) / 10))), { step: 0.1, min: 0.1, max: 2 }), '1 is normal; 0.3 a light drizzle, 2 a downpour.');
        amt.hidden = d.kind === 'none';
        return [field('Weather', select(WEATHER_KINDS.map((k) => [k, WEATHER_NAMES[k]] as [string, string]), d.kind, (v) => { d.kind = v as WeatherKind; amt.hidden = d.kind === 'none'; })), amt,
          field('Wind', select([['', 'Unchanged'], ['0', 'Calm'], ['0.3', 'Breeze'], ['0.6', 'Windy'], ['1', 'Gale']], d.wind === undefined ? '' : String(d.wind), (v) => { if (v === '') delete d.wind; else d.wind = Number(v); })),
          field('Where', select([['here', 'This map’s weather (shared outdoor, its zone’s or its own)'], ['world', 'The shared outdoor weather (even from indoors)']], d.scope ?? 'here', (v) => { if (v === 'world') d.scope = 'world'; else delete d.scope; })),
          h('p', { class: 'hint' }, 'Fades from the old weather to the new over a few seconds. It stays that way for the rest of the game (saved with the game), until another “Change weather”. On a shared outdoor map, “here” changes the weather on every shared map.')];
      }
      case 'quest': {
        const objWrap = h('div');
        const renderObj = () => {
          objWrap.replaceChildren();
          if (d.op !== 'objective') { delete d.objective; delete d.add; return; }
          const opts = objectiveChoices(d.quest, d.objective);
          if (!d.objective || !opts.some(([id]) => id === d.objective)) d.objective = opts[0][0] || undefined;
          const amount = numberInput(d.add ?? 1, (v) => (d.add = Math.round(v)), { step: 1 });
          const amountField = field('By', amount, 'Negative counts back down.');
          amountField.hidden = d.add === undefined;
          objWrap.append(field('Objective', select(opts, d.objective ?? '', (v) => (d.objective = v || undefined))),
            field('Change', select([['done', 'Mark it done'], ['add', 'Count it up']], d.add === undefined ? 'done' : 'add', (v) => {
              if (v === 'add') d.add = 1; else delete d.add;
              renderObj();
            })), amountField);
        };
        renderObj();
        return [field('Quest', select(questChoices(d.quest), d.quest, (v) => { d.quest = v; renderObj(); })),
          field('Do', select(QUEST_OPS, d.op, (v) => { d.op = v as QuestOp; renderObj(); })),
          objWrap,
          checkbox('Quietly (no banner; it’s still written in the adventure log)', !!d.silent, (v) => (d.silent = v || undefined)),
          h('p', { class: 'hint' }, 'Defeat, collect and visit objectives count by themselves while the quest is in progress. A quest that doesn’t complete by itself waits, “ready to hand in”, until an event completes it: check for that with a conditional branch (Quest → Ready to hand in).')];
      }
      case 'achievement': {
        const list = (this.store.db.achievements ?? []).map((a) => [a.id, `${a.name} (${a.points}G)`] as [string, string]);
        return [field('Achievement', select(list.length ? list : [['', '(add achievements in Database → Achievements)']], d.id, (v) => (d.id = v)),
          'Unlocks it with its pop-up (once: it stays unlocked across every save). Achievements set to “An event unlocks it” need this; the others unlock by themselves too.')];
      }
      case 'console':
        return [field('Command', textInput(d.line, (v) => (d.line = v.trim()), { placeholder: 'e.g. give potion 3' }),
          'Any developer-console command (type help in the console, ` in a playtest, to see them all). Handy for test events: give items, teleport, set the time…')];
      case 'fieldWeapons':
        return [field('Overworld weapons', select([['off', 'Disable (greyed out with a red ✕)'], ['on', 'Enable again']], d.on ? 'on' : 'off', (v) => (d.on = v === 'on')),
          'The sword and bow the hero uses on the field (cutting vines, shooting switches). Disable them indoors, in towns or other restricted areas; they stay off (across maps and saves) until an event enables them again.')];
      case 'skillPoints':
        return [field('Skill points', numberInput(d.value, (v) => (d.value = Math.round(v)), { step: 1 }), 'A quest reward. Negative takes points away.')];
      case 'battle': {
        const enemies = (this.store.db.enemies ?? []).map((e) => [e.id, e.name] as [string, string]);
        const list = h('div', { class: 'battle-foes' });
        const render = () => list.replaceChildren(...d.enemies.map((id, k) => h('div', { class: 'field-row' },
          select(enemies.length ? enemies : [['', '(add enemies in Database → Enemies)']], id, (v) => (d.enemies[k] = v), { 'aria-label': `Enemy ${k + 1}` }),
          h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove enemy ${k + 1}`, onclick: () => { d.enemies.splice(k, 1); render(); } }, '✕'))),
          d.enemies.length < 3 && enemies.length ? h('button', { type: 'button', class: 'btn', onclick: () => { d.enemies.push(d.enemies[d.enemies.length - 1] ?? enemies[0][0]); render(); } }, '+ Add enemy') : h('span'));
        render();
        return [list,
          checkbox('The party may run away', !!d.canRun, (v) => (d.canRun = v || undefined)),
          field('If the party loses', select([['respawn', 'Back to the respawn point (as dying does); the event stops'], ['continue', 'The event goes on (a story battle meant to be lost)']], d.lose ?? 'respawn', (v) => { if (v === 'continue') d.lose = 'continue'; else delete d.lose; })),
          field('Result into variable', textInput(d.resultVar ?? '', (v) => (d.resultVar = v.trim() || undefined), { placeholder: 'Optional, e.g. boss_result' }), '1 if won, 2 if the party ran away, 0 if lost. Branch on it afterwards.'),
          field('Battle music', select([['', 'The map’s battle music'], ...loopChoices('music', audioFiles()).filter(([v]) => v)], d.music ?? '', (v) => (d.music = v || undefined))),
          field('Battle map', select([['', 'The map’s battle map'], ...this.store.battleMapNames().map((n) => [n, n] as [string, string])], d.map ?? '', (v) => (d.map = v || undefined)), 'Where it’s fought: a boss arena, a throne room…'),
          h('p', { class: 'hint' }, 'A turn-based battle (in either battle system), for bosses and set-piece fights. The event waits for it to end. Beating these enemies gives EXP, gold and drops as usual.')];
      }
      case 'learn': {
        const db = this.store.db;
        const heroes: [string, string][] = [['', 'The hero you play'], ['@party', 'Everyone in the party'], ...(db.heroes ?? []).slice(1).map((x) => [x.id, x.name] as [string, string])];
        const spells: [string, string][] = [['', '(no spell)'], ...spellList(db).map((x) => [x.id, x.name] as [string, string])];
        const adds: [string, string][] = [['', '(no Addition)'], ...additionList(db).map((x) => [x.id, x.name] as [string, string])];
        const rankWrap = h('div');
        const renderRank = () => {
          const sp = findSpell(db, d.spell);
          rankWrap.replaceChildren(sp && spellMaxRank(sp) > 1 ? field('Rank', select(Array.from({ length: spellMaxRank(sp) }, (_, i) => [String(i + 1), rankName(sp.name, i + 1)] as [string, string]), String(d.rank ?? 1), (v) => (d.rank = Number(v) > 1 ? Number(v) : undefined)), 'Raises it to this rank if they know it lower.') : h('span'));
        };
        renderRank();
        return [field('Who', select(heroes, d.who, (v) => (d.who = v))),
          field('Spell', select(spells, d.spell ?? '', (v) => { d.spell = v || undefined; renderRank(); })), rankWrap,
          field('Addition', select(adds, d.addition ?? '', (v) => (d.addition = v || undefined))),
          checkbox('Quietly (no message)', !!d.silent, (v) => (d.silent = v || undefined)),
          h('p', { class: 'hint' }, 'Trainers: put this after a choice and a gold check (Conditional branch → Gold, then Change gold). Party heroes named here must be in the party.')];
      }
      case 'heroClass': {
        const db = this.store.db;
        const heroes: [string, string][] = [['', 'The hero you play'], ['@party', 'Everyone in the party'], ...(db.heroes ?? []).slice(1).map((x) => [x.id, x.name] as [string, string])];
        const classes = classList(db).map((x) => [x.id, x.name] as [string, string]);
        return [field('Who', select(heroes, d.who, (v) => (d.who = v))),
          field('Do', select([['change', 'Change to this class now'], ['unlock', 'Let them change to it (Menu → Abilities)']], d.op, (v) => (d.op = v as 'change' | 'unlock'))),
          field('Class', select(classes.length ? classes : [['', '(add classes in Database → Classes)']], d.cls, (v) => (d.cls = v))),
          checkbox('Quietly (no message)', !!d.silent, (v) => (d.silent = v || undefined)),
          h('p', { class: 'hint' }, 'A class opens its skill trees. Changing class keeps every skill, spell and Addition already learned.')];
      }
      case 'shop': {
        const goods = h('div', { class: 'shop-goods' });
        const renderGoods = () => {
          goods.replaceChildren(...d.goods.map((g, k) => {
            const def = (this.store.db.items ?? []).find((i) => i.id === g.item);
            return h('div', { class: 'field-row shop-good' },
              select(itemChoices(this.store, g.item), g.item, (v) => { g.item = v; renderGoods(); }, { 'aria-label': `Item ${k + 1}` }),
              priceInput(g.price, def?.price ?? 0, (v) => (g.price = v), `Price ${k + 1}`),
              h('button', { type: 'button', class: 'mini-btn', title: 'Remove', 'aria-label': `Remove item ${k + 1}`, onclick: () => { d.goods.splice(k, 1); renderGoods(); } }, '✕'));
          }), h('button', { type: 'button', class: 'btn', onclick: () => {
            const items = this.store.db.items ?? [];
            const next = items.find((i) => !d.goods.some((g) => g.item === i.id) && i.kind !== 'key') ?? items[0];
            d.goods.push({ item: next?.id ?? '' });
            renderGoods();
          } }, '+ Add item'));
        };
        renderGoods();
        return [field('Shop name', textInput(d.name ?? '', (v) => (d.name = v.trim() || undefined), { placeholder: 'Shop' })),
          field('For sale', goods, 'Price: leave empty to use the item’s price from the Database.'),
          checkbox('The player can sell to this shop (for half the price)', d.canSell !== false, (v) => (d.canSell = v ? true : false))];
      }
    }
  }
}

/**
 * Form for a condition. `allowNone` adds an "Always" option (event pages);
 * onchange receives null for "Always".
 */
/** A price box that may be left empty (meaning: the item's own price). */
function priceInput(value: number | undefined, fallback: number, onchange: (v: number | undefined) => void, label: string): HTMLInputElement {
  const i = h('input', { type: 'number', step: 1, min: 0, inputmode: 'numeric', value: value === undefined ? '' : String(value),
    placeholder: `${fallback} (default)`, 'aria-label': label, title: 'Leave empty to use the item’s price' });
  i.addEventListener('input', () => { const v = parseFloat(i.value); onchange(i.value.trim() === '' || !Number.isFinite(v) ? undefined : Math.max(0, Math.round(v))); });
  return i;
}

/** Imported audio files and a preview player (set by the editor). */
let audioFiles: () => string[] = () => [];
let previewSound: (src: string) => void = () => {};
export function setAudioHooks(files: () => string[], preview: (src: string) => void): void { audioFiles = files; previewSound = preview; }
const previewButton = (play: () => void) => h('button', { type: 'button', class: 'btn small', onclick: play }, '▶ Preview');

/** A sound to pick (none, a built-in effect or an imported file), with a preview button. */
export function soundField(label: string, value: string | undefined, set: (v: string | undefined) => void, hint?: string): HTMLElement {
  const opts: [string, string][] = [['', 'None'], ...audioFiles().map((f) => [f, f.split('/').pop()!] as [string, string]), ...SFX_NAMES.map((n) => [n, `${SFX_LABELS[n]} (built-in)`] as [string, string])];
  let cur = value ?? '';
  return field(label, h('div', { class: 'field-row audio-row' }, select(opts, cur, (v) => { cur = v; set(v || undefined); }), previewButton(() => { if (cur) previewSound(cur); })), hint);
}
const soundName = (src: string) => (SFX_LABELS as Record<string, string>)[src] ?? src.split('/').pop() ?? src;
function loopName(src: string): string {
  const b = src.startsWith('builtin:') ? src.slice(8) : '';
  return (MUSIC_NAMES as Record<string, string>)[b] ?? (AMBIENCE_NAMES as Record<string, string>)[b] ?? src.split('/').pop() ?? src;
}

/** Items offered by condition forms (set by the editor that owns the database). */
let conditionItems: () => [string, string][] = () => [];
export function setConditionItems(fn: () => [string, string][]): void { conditionItems = fn; }

export function conditionForm(initial: Condition | undefined, onchange: (c: Condition) => void, allowNone: true, onNone: () => void): HTMLElement;
export function conditionForm(initial: Condition, onchange: (c: Condition) => void, allowNone: false): HTMLElement;
export function conditionForm(initial: Condition | undefined, onchange: (c: Condition) => void, allowNone: boolean, onNone?: () => void): HTMLElement {
  const wrap = h('div', { class: 'condition' });
  let cur: Condition | undefined = initial ? (JSON.parse(JSON.stringify(initial)) as Condition) : undefined;
  const render = () => {
    const kind = !cur ? 'none' : 'quest' in cur ? ('objective' in cur ? 'objective' : 'quest') : 'switch' in cur ? 'switch' : 'item' in cur ? 'item' : 'gold' in cur ? 'gold' : 'weekday' in cur ? 'weekday' : 'var';
    const kinds: [string, string][] = [...(allowNone ? [['none', 'Always'] as [string, string]] : []), ['switch', 'Switch'], ['var', 'Variable'], ['item', 'Has item'], ['gold', 'Has gold'], ['quest', 'Quest'], ['objective', 'Quest objective'], ['weekday', 'Day of the week (real world)']];
    const firstQuest = questDefs()[0];
    const kindSel = select(kinds, kind, (v) => {
      cur = v === 'none' ? undefined : v === 'switch' ? { switch: '', is: true } : v === 'item' ? { item: conditionItems()[0]?.[0] ?? '', count: 1 }
        : v === 'gold' ? { gold: 100 } : v === 'weekday' ? { weekday: [6] } : v === 'quest' ? { quest: firstQuest?.id ?? '', is: 'started' }
        : v === 'objective' ? { quest: firstQuest?.id ?? '', objective: firstQuest?.objectives[0]?.id ?? '', done: true } : { var: '', op: '>=', value: 1 };
      if (cur) onchange(cur); else onNone?.();
      render();
    }, { 'aria-label': 'Condition type' });
    const parts: HTMLElement[] = [field(allowNone ? 'Active when' : 'Condition', kindSel)];
    if (cur && 'quest' in cur) {
      const c = cur;
      if ('objective' in c) {
        parts.push(field('Quest', select(questChoices(c.quest), c.quest, (v) => { c.quest = v; c.objective = objectiveChoices(v, undefined)[0][0]; onchange(c); render(); })),
          h('div', { class: 'field-row' },
            field('Objective', select(objectiveChoices(c.quest, c.objective), c.objective, (v) => { c.objective = v; onchange(c); })),
            field('Is', select([['done', 'Done'], ['not', 'Not done']], c.done === false ? 'not' : 'done', (v) => { c.done = v === 'done' ? true : false; onchange(c); }))));
      } else {
        parts.push(h('div', { class: 'field-row' },
          field('Quest', select(questChoices(c.quest), c.quest, (v) => { c.quest = v; onchange(c); })),
          field('Is', select(QUEST_STATUS_NAMES, c.is, (v) => { c.is = v as QuestStatus | 'started'; onchange(c); }))));
      }
    } else if (cur && 'switch' in cur) {
      const c = cur;
      parts.push(field('Switch', textInput(c.switch, (v) => { c.switch = v.trim(); onchange(c); }, { list: 'dl-switches', placeholder: 'e.g. met_mira' })),
        field('Is', select([['on', 'ON'], ['off', 'OFF']], c.is === false ? 'off' : 'on', (v) => { c.is = v === 'on'; onchange(c); })));
    } else if (cur && 'item' in cur) {
      const c = cur;
      const opts = conditionItems();
      if (c.item && !opts.some(([id]) => id === c.item)) opts.unshift([c.item, `${c.item} (missing)`]);
      parts.push(h('div', { class: 'field-row' },
        field('Item', select(opts.length ? opts : [['', '(no items yet)']], c.item, (v) => { c.item = v; onchange(c); })),
        field('At least', numberInput(c.count ?? 1, (v) => { c.count = Math.max(1, Math.round(v)); onchange(c); }, { step: 1, min: 1 }))));
    } else if (cur && 'weekday' in cur) {
      const c = cur;
      parts.push(field('On', h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px 12px' }, ...WEEKDAYS.map((name, d) => checkbox(name.slice(0, 3), c.weekday.includes(d), (on) => {
        c.weekday = on ? [...new Set([...c.weekday, d])].sort() : c.weekday.filter((x) => x !== d); onchange(c);
      }))), 'The player’s own date: an event page that only shows on Saturdays, say (a market, a rare enemy).'));
    } else if (cur && 'gold' in cur) {
      const c = cur;
      parts.push(field('At least (gold)', numberInput(c.gold, (v) => { c.gold = Math.max(0, Math.round(v)); onchange(c); }, { step: 1, min: 0 })));
    } else if (cur) {
      const c = cur;
      parts.push(field('Variable', textInput(c.var, (v) => { c.var = v.trim(); onchange(c); }, { list: 'dl-vars', placeholder: 'e.g. gold' })),
        h('div', { class: 'field-row' },
          field('Compare', select([['>=', '≥'], ['>', '>'], ['==', '='], ['<', '<'], ['<=', '≤']], c.op, (v) => { c.op = v as typeof c.op; onchange(c); })),
          field('Value', numberInput(c.value, (v) => { c.value = v; onchange(c); }, { step: 1 }))));
    }
    wrap.replaceChildren(...parts);
  };
  render();
  return wrap;
}

/** Buttons over a message's text: wrap the selected words in a style or colour tag (see ui/richText.ts). */
function formatBar(ta: HTMLTextAreaElement, changed: () => void): HTMLElement {
  const wrap = (open: string, close: string) => {
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a, sel = ta.value.slice(a, b) || 'text';
    ta.value = ta.value.slice(0, a) + open + sel + close + ta.value.slice(b);
    ta.focus();
    ta.setSelectionRange(a + open.length, a + open.length + sel.length);
    changed();
  };
  const btn = (label: string, title: string, tag: string, style = '') => h('button', { type: 'button', class: 'fmt-btn', title, style, onmousedown: (e: Event) => e.preventDefault(), onclick: () => wrap(`[${tag}]`, `[/${tag}]`) }, label);
  const custom = h('input', { type: 'color', value: '#5ab8ff', title: 'Any colour: pick it, then click ◼', 'aria-label': 'Custom colour' }) as HTMLInputElement;
  const named = textColors(dbNow?.().textColors).map((c) => h('button', { type: 'button', class: 'fmt-swatch', title: `${c.name}: [${c.id}]…[/${c.id}]`, style: `background:${c.color}`, onmousedown: (e: Event) => e.preventDefault(), onclick: () => wrap(`[${c.id}]`, `[/${c.id}]`) }));
  return h('div', { class: 'fmt-bar', role: 'toolbar', 'aria-label': 'Style the selected words' },
    btn('B', 'Bold', 'b', 'font-weight:900'), btn('I', 'Italic', 'i', 'font-style:italic'), btn('S', 'Strikethrough', 's', 'text-decoration:line-through'), btn('U', 'Underline', 'u', 'text-decoration:underline'),
    btn('Glow', 'Glowing', 'glow'), btn('Outline', 'Outlined', 'outline'),
    h('span', { class: 'fmt-sep' }), ...named,
    h('span', { class: 'fmt-sep' }), custom,
    h('button', { type: 'button', class: 'fmt-btn', title: 'Colour the selected words with the picked colour', onmousedown: (e: Event) => e.preventDefault(), onclick: () => wrap(`[color=${custom.value}]`, '[/color]') }, '◼'));
}

/** A message's own look (the same settings word bubbles have): off by default, so the window's style shows. */
export function lookFields(d: { look?: TextLook }, changed: () => void, label = 'Give this message its own look', seed: () => TextLook = () => ({ color: '#fff6dc', bubble: '#0e1222' })): HTMLElement[] {
  const box = h('div', { class: 'look-fields' });
  const draw = () => {
    const l = d.look;
    box.replaceChildren(checkbox(label, !!l, (v) => { if (v) d.look = seed(); else delete d.look; draw(); changed(); }));
    if (!l) return;
    const color = (value: string, set: (v: string) => void, label: string) => {
      const i = h('input', { type: 'color', value, 'aria-label': label }) as HTMLInputElement;
      i.addEventListener('input', () => { set(i.value); changed(); });
      return i;
    };
    const tick = (label: string, on: boolean, set: (v: boolean) => void) => checkbox(label, on, (v) => { set(v); draw(); changed(); });
    box.append(
      h('div', { class: 'field-row bubble-colors' },
        field('Text', color(l.color ?? '#fff6dc', (v) => (l.color = v), 'Text colour')),
        field('Box', color(l.bubble ?? '#0e1222', (v) => (l.bubble = v), 'Box colour')),
        field('Outline', color(l.outline ?? '#000000', (v) => (l.outline = v), 'Outline colour')),
        field('Text size', numberInput(l.size ?? 21, (v) => { l.size = Math.max(8, Math.min(96, Math.round(v))); changed(); }, { min: 8, max: 96, step: 1 }))),
      h('div', { class: 'checks' },
        tick('See-through box (just the text)', !!l.transparent, (v) => (l.transparent = v || undefined)),
        tick('Bold', !!l.bold, (v) => (l.bold = v || undefined)),
        tick('Italic', !!l.italic, (v) => (l.italic = v || undefined)),
        tick('Strikethrough', !!l.strike, (v) => (l.strike = v || undefined)),
        tick('Outlined', !!l.outline, (v) => { if (v) l.outline ??= '#000000'; else delete l.outline; }),
        tick('Glowing', !!l.glow, (v) => (l.glow = v || undefined))));
  };
  draw();
  return [h('div', { class: 'section-label' }, 'Look'), box];
}
