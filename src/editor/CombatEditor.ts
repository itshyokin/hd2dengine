/**
 * Database → Combat (tuning: weapon classes, the bow, dodging, Fire, sneak attacks, levels)
 * and Database → Enemies (the list of enemy types with a form for the selected one).
 */
import { ailmentChips, inflictsField } from './statusFields';
import type { Ailment } from '../world/types';
import { defenceSection, elementSelect } from './elementFields';
import { ELEMENT_NAMES } from '../game/elements';
import { MONSTERS } from '../art/placeholderArt';
import { ITEM_ICONS } from '../art/itemIcons';
import { enemyWeaponSprites } from '../game/combat/weaponSprites';
import { weaponSpriteField } from './weaponPicker';
import { DEFAULT_COMBAT, combatConfig } from '../game/combat/config';
import { enemyAgility } from '../game/battle/rules';
import type { CombatData, EnemyAction, EnemyBehaviour, EnemyDef, FlatLook, WeaponClass } from '../world/types';
import { checkbox, field, h, numberInput, select, textInput } from './dom';
import { enemyImage, setFlatImage } from './editorArt';
import { canvasFromBlob } from '../shared/images';
import { toast } from './dom';
import type { EditorStore } from './store';

const num = (v: number, set: (n: number) => void, step = 1, min = 0, label = '') =>
  numberInput(v, (n) => set(Math.max(min, n)), { step, min, 'aria-label': label, class: 'db-num' });

/** The Combat tab. Edits `data` (only differences from the defaults are kept when saving). */
export function combatTab(data: CombatData): HTMLElement[] {
  const c = combatConfig(data), D = DEFAULT_COMBAT;
  const setClass = (k: WeaponClass, f: 'speed' | 'reach' | 'damage', v: number) => { ((data.classes ??= {})[k] ??= {})[f] = v; };
  const tb = (data.turnBased ??= {}), T = c.turnBased;
  return [
    h('section', { class: 'db-section' }, h('h3', {}, 'Battle system'),
      field('Battles are', select([['action', 'Action: fought on the map in real time (Zelda / Fable style)'], ['turnBased', 'Turn-based: a battle screen with commands (Final Fantasy X / Pokémon style)']],
        c.mode, (v) => { if (v === 'turnBased') data.mode = 'turnBased'; else delete data.mode; }),
        'Turn-based: touching or being hit by an enemy on the map starts a battle with it and its friends nearby. Hitting it first (best of all from behind, unseen) gives the party the first turns. Maps can also have random encounters (map settings → Random encounters).'),
      h('div', { class: 'field-row' },
        field('Turn order', select([['ctb', 'Conditional turns (FFX)'], ['rounds', 'Rounds (classic)']],
          T.order, (v) => { tb.order = v === 'rounds' ? 'rounds' : undefined; }),
          'Conditional turns: fast fighters act more often, and Guard or an item brings the next turn sooner. Rounds: everyone acts once a round, fastest first.'),
        field('Run away chance %', num(T.flee, (v) => (tb.flee = Math.min(100, Math.round(v))), 5, 0, 'Run away chance'), 'When both sides are as fast. Each point of Dexterity / Agility the party has over the enemies adds 2%. Never from a boss.')),
      h('div', { class: 'field-row' },
        field('Enemies who join (tiles)', num(T.joinRadius, (v) => (tb.joinRadius = v), 0.5, 0, 'Join radius'), 'Enemies this close to the one that started it join the battle.'),
        field('Most enemies in a battle', num(T.maxEnemies, (v) => (tb.maxEnemies = Math.max(1, Math.min(8, Math.round(v)))), 1, 1, 'Max enemies')),
        field('Safe after a battle (s)', num(T.grace, (v) => (tb.grace = v), 0.5, 0, 'Grace after battle'), 'No new battle starts for this long after one is won or run from.'),
        field('Guard heals %', num(T.guardHeal, (v) => (tb.guardHeal = Math.min(100, Math.round(v))), 1, 0, 'Guard heal'), 'Guarding gives back this much of the guard’s health, halves damage and keeps ailments away until their next turn (Legend of Dragoon).')),
      h('div', { class: 'field-row' },
        field('Additions', select([['set', 'Set per hero in Menu → Abilities (Legend of Dragoon)'], ['choose', 'Chosen from a list with each Attack']], T.additions, (v) => { tb.additions = v === 'choose' ? 'choose' : undefined; }),
          'Additions: strings of timed strikes (Database → Additions), learned from the skill tree, events and trainers.'),
        field('Addition timing', select([['press', 'Pressed by the player'], ['auto', 'Automatic (every strike lands; for accessibility)']], T.additionTiming, (v) => { tb.additionTiming = v === 'auto' ? 'auto' : undefined; }))),
      h('div', { class: 'field-row' },
        field('Party damage ×', num(T.partyDamage, (v) => (tb.partyDamage = Math.max(0.1, v)), 0.05, 0.1, 'Party damage')),
        field('Enemy damage ×', num(T.enemyDamage, (v) => (tb.enemyDamage = Math.max(0.1, v)), 0.05, 0.1, 'Enemy damage'), 'Scale either side to make battles quicker or harder. Both start at 1 (the same numbers as on the map).')),
      h('p', { class: 'note' }, 'The same heroes, stats, gear, spell shards, items, enemies and rewards work in both systems, so a game can switch at any time. The rest of this page tunes the action system (EXP and skill points count in both).')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Melee (key 1)'),
      h('div', { class: 'db-table classes' },
        h('span', { class: 'db-head' }, 'Class'), h('span', { class: 'db-head' }, 'Swing speed'), h('span', { class: 'db-head' }, 'Reach (tiles)'), h('span', { class: 'db-head' }, 'Damage ×'),
        ...(['light', 'medium', 'heavy'] as WeaponClass[]).flatMap((k) => [
          h('span', { class: 'db-name' }, k[0].toUpperCase() + k.slice(1)),
          num(c.classes[k].speed, (v) => setClass(k, 'speed', v), 0.05, 0.2, `${k} speed`),
          num(c.classes[k].reach, (v) => setClass(k, 'reach', v), 0.05, 0.5, `${k} reach`),
          num(c.classes[k].damage, (v) => setClass(k, 'damage', v), 0.05, 0.1, `${k} damage`),
        ])),
      field('Unarmed damage', num(c.unarmedDamage, (v) => (data.unarmedDamage = v), 1, 0, 'Unarmed damage')),
      h('p', { class: 'note' }, `Swing speed 1 = one swing in ${0.46}s. Three swings in a row make a combo; the third is slower and hits harder. Skill-tree bonuses for each class come next.`)),
    h('section', { class: 'db-section' }, h('h3', {}, 'Bow (key 2) and lock-on (Q / Tab)'),
      h('div', { class: 'field-row' },
        field('Full draw (s)', num(c.bow.drawTime, (v) => ((data.bow ??= {}).drawTime = Math.max(0.1, v)), 0.05, 0.1, 'Draw time')),
        field('Arrow speed', num(c.bow.arrowSpeed, (v) => ((data.bow ??= {}).arrowSpeed = v), 1, 2, 'Arrow speed'))),
      h('div', { class: 'field-row' },
        field('Lock-on range with a bow', num(c.bow.lockRange, (v) => ((data.bow ??= {}).lockRange = v), 1, 2, 'Bow lock range')),
        field('Lock-on range otherwise', num(c.lockRange, (v) => (data.lockRange = v), 1, 2, 'Lock range'))),
      h('p', { class: 'note' }, 'A bow locks on much further away, so distant enemies can be picked off before they close in.')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Dodge (Space while locked on) and block'),
      h('div', { class: 'field-row' },
        field('Stamina cost', num(c.dodge.cost, (v) => ((data.dodge ??= {}).cost = v), 1, 0, 'Dodge cost')),
        field('Distance (tiles)', num(c.dodge.distance, (v) => ((data.dodge ??= {}).distance = v), 0.1, 0.5, 'Dodge distance')),
        field('Time (s)', num(c.dodge.time, (v) => ((data.dodge ??= {}).time = Math.max(0.1, v)), 0.02, 0.1, 'Dodge time'))),
      h('div', { class: 'field-row' },
        field('Block: stamina per hit', num(c.block.cost, (v) => ((data.block ??= {}).cost = v), 1, 0, 'Block cost')),
        field('Block: damage stopped %', num(Math.round(c.block.reduction * 100), (v) => ((data.block ??= {}).reduction = Math.min(100, v) / 100), 5, 0, 'Block reduction')),
        field('Parry window (s)', num(c.block.parry, (v) => ((data.block ??= {}).parry = v), 0.02, 0, 'Parry window'))),
      h('p', { class: 'note' }, 'Block (E / RT, hold) stops most of a hit from the front. Raising it just as a hit lands parries: no damage, and the attacker staggers.'),
      field('Safe after a hit (s)', num(c.hurtGrace, (v) => (data.hurtGrace = v), 0.05, 0, 'Hurt grace'), 'The hero can’t be hurt again for this long after taking a hit. A dodge can’t be hurt at all.')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Spells (key 3)'),
      h('div', { class: 'field-row' },
        field('Speed', num(c.fire.speed, (v) => ((data.fire ??= {}).speed = v), 0.5, 1, 'Spell speed')),
        field('Range', num(c.fire.range, (v) => ((data.fire ??= {}).range = v), 0.5, 1, 'Spell range'))),
      h('p', { class: 'note' }, 'Used by spell shards that leave their own speed or range at 0. Each shard’s damage, MP cost, colour and light are set on the item (Database → Items, slot Spell shard).'),
      field('A fire attack lights a fire for (s)', num(c.fire.kindle, (v) => ((data.fire ??= {}).kindle = Math.max(1, v)), 1, 1, 'Kindle time'),
        'Fire spells, fire arrows and fire weapons light a torch, brazier or campfire that has run out of fuel, but only for this many seconds (real time). Fuel keeps it going.')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Forges (anvils)'),
      h('div', { class: 'field-row' },
        field('Upgrades per item', num(data.forge?.maxLevel ?? 5, (v) => ((data.forge ??= {}).maxLevel = Math.max(1, Math.round(v))), 1, 1, 'Forge max level')),
        field('Each upgrade adds %', num(data.forge?.percent ?? 8, (v) => ((data.forge ??= {}).percent = Math.max(0, v)), 1, 0, 'Forge upgrade percent')),
        field('A set shard adds % damage', num(data.forge?.enchantPercent ?? 10, (v) => ((data.forge ??= {}).enchantPercent = Math.max(0, v)), 1, 0, 'Enchant percent'))),
      h('p', { class: 'note' }, 'At an anvil (the Anvil prop, or any prop marked as a forge) the player smelts ore into ingots, upgrades weapons and armor with ingots of their material (+1 takes 1 ingot, +2 takes 2…: damage or defence goes up by the percent above each time), and sets an elemental spell shard in them: weapons hit with its element, armor halves damage of it.')),
    h('section', { class: 'db-section' }, h('h3', {}, 'Stealth and levels'),
      field('Sneak attack damage ×', num(c.sneakMultiplier, (v) => (data.sneakMultiplier = Math.max(1, v)), 0.1, 1, 'Sneak multiplier'), 'Hitting an enemy that hasn’t noticed the hero (no ? or !).'),
      field('Campfire safe ground (tiles)', num(c.campSafe, (v) => (data.campSafe = Math.max(0, v)), 0.5, 0, 'Campfire safe radius'),
        'No enemy comes within this many tiles of a lit campfire (a fire that’s also a respawn point), or attacks a hero inside it. 0: off.'),
      h('div', { class: 'field-row' },
        field('Skill points per level', num(c.pointsPerLevel, (v) => (data.pointsPerLevel = Math.round(v)), 1, 0, 'Points per level')),
        field('Skill points at the start', num(c.startPoints, (v) => (data.startPoints = Math.round(v)), 1, 0, 'Start points'))),
      h('p', { class: 'note' }, `Default sneak attack ×${D.sneakMultiplier}. How much EXP each level takes is under Player → EXP progression.`)),
  ];
}

/** Only the combat settings that differ from the defaults (or undefined). */
export function cleanCombat(data: CombatData): CombatData | undefined {
  const D = DEFAULT_COMBAT as unknown as Record<string, unknown>, out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v; continue; }
    if (k === 'classes') {
      const cls: Record<string, Record<string, number>> = {};
      for (const [ck, cv] of Object.entries(v as Record<string, Record<string, number>>)) {
        const base = DEFAULT_COMBAT.classes[ck as WeaponClass] as unknown as Record<string, number>;
        const part = Object.fromEntries(Object.entries(cv ?? {}).filter(([f, n]) => n !== undefined && n !== base[f]));
        if (Object.keys(part).length) cls[ck] = part;
      }
      if (Object.keys(cls).length) out.classes = cls;
    } else if (typeof v === 'object') {
      const base = D[k] as Record<string, unknown>;
      const part = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([f, n]) => n !== undefined && n !== base[f]));
      if (Object.keys(part).length) out[k] = part;
    } else if (v !== D[k]) out[k] = v;
  }
  return Object.keys(out).length ? (out as CombatData) : undefined;
}

const BEHAVIOURS: [EnemyBehaviour, string][] = [
  ['melee', 'Melee: walks up and strikes'],
  ['ranged', 'Ranged: keeps its distance and shoots arrows'],
  ['charger', 'Charger: winds up, then rushes in a straight line'],
];

export function defaultEnemy(id: string): EnemyDef {
  return { id, name: 'New enemy', look: { monster: 'slime' }, hp: 20, damage: 6, speed: 1.6, behaviour: 'melee', attackRange: 0.9, cooldown: 1.5, windup: 0.5, sight: 6, fov: 140, hearing: 5, xp: 10, gold: [0, 4] };
}

/** The Enemies tab: list on the left, the selected enemy's form on the right. */
export function enemiesTab(store: EditorStore, list: EnemyDef[], state: { sel: number }, rerender: () => void): HTMLElement[] {
  state.sel = Math.min(state.sel, list.length - 1);
  const add = () => {
    let id = 'enemy', n = 2;
    while (list.some((d) => d.id === id)) id = `enemy_${n++}`;
    list.push(defaultEnemy(id));
    state.sel = list.length - 1;
    rerender();
  };
  const thumb = (d: EnemyDef) => { const c = enemyImage(store.db, d.look); return c ? h('img', { src: c.toDataURL(), alt: '', class: 'item-icon' }) : h('span'); };
  const side = h('div', { class: 'item-list', role: 'listbox', 'aria-label': 'Enemies' },
    ...list.map((d, i) => h('button', { type: 'button', class: 'item-row', role: 'option', 'aria-selected': String(i === state.sel), onclick: () => { state.sel = i; rerender(); } }, thumb(d), h('span', {}, d.name))),
    h('button', { type: 'button', class: 'btn item-add', onclick: add }, '+ New enemy'));
  const d = list[state.sel];
  const form = h('div', { class: 'item-form' });
  if (!d) form.append(h('p', { class: 'note' }, 'No enemies yet. Add a type here, then place it on a map: Events layer → click a tile → Create enemy here.'));
  else form.append(...enemyForm(store, list, d, rerender, () => { list.splice(state.sel, 1); state.sel = Math.max(0, state.sel - 1); rerender(); }));
  return [h('div', { class: 'items-layout' }, side, form)];
}

/** Load the flat enemy pictures the database uses (for the editor's previews and playtests). */
export async function loadEnemyImages(store: EditorStore): Promise<void> {
  await Promise.all((store.db.enemies ?? []).map(async (d) => {
    const p = d.look.image;
    if (!p || store.files.has(p)) return;
    try { const b = await store.project.readFile(p); store.files.set(p, b); setFlatImage(p, await canvasFromBlob(b)); }
    catch { console.warn(`${d.name}: picture ${p} is missing`); }
  }));
}

/** Choose a picture for a flat enemy: saved to assets/enemies/ (or kept for the session when the editor can't save). */
function pickFlatImage(store: EditorStore, d: EnemyDef, done: () => void): void {
  const input = h('input', { type: 'file', accept: 'image/png,image/webp,image/gif' });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    let canvas: HTMLCanvasElement;
    try { canvas = await canvasFromBlob(f); } catch { toast('That file isn’t an image the browser can read', 'error'); return; }
    // A new name each time, so the game never shows an old copy.
    const path = `assets/enemies/${d.id}_${Date.now().toString(36)}.png`;
    const p = store.project, persistent = p.canSave && p.canStoreImages;
    try { if (persistent) await p.writeFile(path, f); }
    catch (err) { toast(`Couldn’t save the picture: ${err instanceof Error ? err.message : String(err)}`, 'error'); return; }
    store.files.set(path, f);
    setFlatImage(path, canvas);
    d.look = { image: path, flat: d.look.flat ?? {} };
    if (!persistent) toast('Picture kept for this session only: open the project folder itself to save imported images.');
    done();
  });
  input.click();
}

function enemyForm(store: EditorStore, list: EnemyDef[], d: EnemyDef, rerender: () => void, remove: () => void): HTMLElement[] {
  const n = (v: number, set: (x: number) => void, step = 1, min = 0) => numberInput(v, (x) => set(Math.max(min, x)), { step, min });
  const chars = Object.entries(store.db.characters).map(([k, c]) => [`c:${k}`, `Character: ${c.name}`] as [string, string]);
  const monsters = Object.entries(MONSTERS).map(([k, m]) => [`m:${k}`, `Monster: ${m.name}`] as [string, string]);
  const look = d.look.character ? `c:${d.look.character}` : `m:${d.look.monster ?? 'slime'}`;
  const kind = d.look.image ? 'flat' : d.look.character ? 'sheet' : 'monster';
  const flat: FlatLook = d.look.flat ?? {};
  const setFlat = (k: keyof FlatLook, v: FlatLook[keyof FlatLook] | undefined) => {
    const f: FlatLook = { ...flat, [k]: v };
    if (v === undefined) delete f[k];
    d.look = { ...d.look, flat: f };
    rerender();
  };
  const firstChar = Object.keys(store.db.characters)[0];
  const kindField = field('Sprite', select([['sheet', 'Matches the player’s sprite sheet (a character)'], ['flat', 'Flat sprite (one picture, moved for you)'], ['monster', 'Built-in monster']], kind, (v) => {
    if (v === kind) return;
    if (v === 'sheet') d.look = firstChar ? { character: firstChar } : { monster: 'slime' };
    else if (v === 'monster') d.look = { monster: 'slime' };
    else { pickFlatImage(store, d, rerender); return; }
    rerender();
  }), kind === 'flat' ? 'One picture (a wolf, a giant bee…), no frames needed: it breathes while standing and slides, hops or flies when it moves, mirrored to face where it’s going.' : kind === 'sheet' ? 'Characters from Database → Characters, like the ones you make in the Character Builder.' : 'Drawn by the engine.');
  const lookFields: HTMLElement[] = kind === 'flat' ? [
    h('div', { class: 'field-row' },
      field('Picture', h('button', { type: 'button', class: 'btn', onclick: () => pickFlatImage(store, d, rerender) }, 'Choose another picture…'), d.look.image ? d.look.image.split('/').pop() : ''),
      field('Moves by', select([['slide', 'Sliding (a little sway)'], ['hop', 'Hopping'], ['fly', 'Flying (hovers and bobs)']], flat.move ?? 'slide', (v) => setFlat('move', v === 'slide' ? undefined : v as FlatLook['move']))),
      field('The picture faces', select([['right', 'Right'], ['left', 'Left'], ['none', 'Doesn’t matter (never mirror it)']], flat.faces ?? 'right', (v) => setFlat('faces', v === 'right' ? undefined : v as FlatLook['faces'])), 'It’s mirrored to face the other way.')),
    h('div', { class: 'field-row' },
      field('Height (tiles)', n(flat.height ?? 1, (v) => setFlat('height', Math.abs(v - 1) < 1e-6 ? undefined : Math.max(0.25, Math.round(v * 20) / 20)), 0.25, 0.25), 'Its width follows the picture. Size (above) scales it further.'),
      checkbox('Breathes while standing still', flat.breathe !== false, (v) => setFlat('breathe', v ? undefined : false))),
  ] : [];
  const items = (store.db.items ?? []).map((i) => [i.id, i.name] as [string, string]);
  const drops = (d.drops ??= []);
  const img = enemyImage(store.db, d.look);
  return [
    h('div', { class: 'item-head' }, img ? h('img', { src: img.toDataURL(), alt: '', class: 'item-icon big' }) : h('span'),
      field('Name', textInput(d.name, (v) => { d.name = v.trim() || d.name; rerender(); }, { 'aria-label': 'Enemy name' })),
      field('Id', textInput(d.id, (v) => {
        const id = v.trim().replace(/[^A-Za-z0-9_-]+/g, '_');
        if (id && !list.some((o) => o !== d && o.id === id)) d.id = id;
        rerender();
      }, { 'aria-label': 'Enemy id', title: 'Event pages refer to the enemy by this id' }))),
    kindField,
    ...lookFields,
    h('div', { class: 'field-row' },
      kind === 'flat' ? h('span') : field('Looks like', select(kind === 'sheet' ? chars : monsters, look, (v) => { d.look = v.startsWith('c:') ? { character: v.slice(2) } : { monster: v.slice(2) }; rerender(); }), kind === 'sheet' ? 'From Database → Characters.' : ''),
      field('Size', n(d.scale ?? 1, (v) => (d.scale = v === 1 ? undefined : Math.max(0.4, v)), 0.1, 0.4)),
      field('Holds', select([['@auto', d.look.character ? `Automatic (${d.behaviour === 'ranged' ? 'bow' : 'sword'})` : 'Automatic (nothing)'], ['', 'Nothing'],
        ...['sword', 'dagger', 'greatsword', 'axe', 'bow'].map((k) => [k, ITEM_ICONS[k]?.name ?? k] as [string, string])],
        d.weapon === undefined ? '@auto' : d.weapon, (v) => { if (v === '@auto') delete d.weapon; else d.weapon = v; rerender(); }), 'Shown in its hand while it attacks.')),
    ...(d.look.character && store.db.characters[d.look.character]?.anim ? [h('div', { class: 'field-row' },
      field('Weapon sprite', weaponSpriteField(store, {
        value: d.weaponSprite, auto: enemyWeaponSprites({ ...d, weaponSprite: undefined, shieldSprite: '' }, d.weapon ?? (d.behaviour === 'ranged' ? 'bow' : 'sword'))[0] ?? '',
        kinds: d.behaviour === 'ranged' ? ['bow'] : ['sword', 'blunt', 'staff'], autoLabel: 'Matches “Holds”',
        onChange: (v) => { if (v === undefined) delete d.weaponSprite; else d.weaponSprite = v; rerender(); },
      }), 'Its character is animated: it carries this LPC weapon and swings it.'),
      d.behaviour === 'ranged' ? h('span') : field('Shield', weaponSpriteField(store, {
        value: d.shieldSprite, auto: '', kinds: ['shield'], autoLabel: 'None',
        onChange: (v) => { if (v === undefined || v === '') delete d.shieldSprite; else d.shieldSprite = v; rerender(); },
      })))] : []),
    h('section', { class: 'db-section' }, h('h3', {}, 'Fighting'),
      field('Behaviour', select(BEHAVIOURS, d.behaviour, (v) => { d.behaviour = v as EnemyBehaviour; if (v === 'ranged' && d.attackRange < 4) d.attackRange = 7; if (v === 'charger' && d.attackRange < 2) d.attackRange = 3.5; if (v === 'melee' && d.attackRange > 2) d.attackRange = 1; rerender(); })),
      h('div', { class: 'field-row' },
        field('Health', n(d.hp, (v) => (d.hp = Math.max(1, Math.round(v))), 1, 1)),
        field('Damage', n(d.damage, (v) => (d.damage = Math.round(v)))),
        field('Defence', n(d.defense ?? 0, (v) => (d.defense = Math.round(v) || undefined)), 'Against swords and arrows. 50 halves the damage.'),
        field('Magic defence', n(d.magicDefense ?? d.defense ?? 0, (v) => (d.magicDefense = Math.round(v) === (d.defense ?? 0) ? undefined : Math.round(v))), 'Against spells (the same as Defence unless changed).'),
        field('Speed', n(d.speed, (v) => (d.speed = v), 0.1, 0.2), 'Tiles per second (the hero walks 3.4).'),
        field('Agility', n(enemyAgility(d), (v) => (d.agility = Math.max(1, Math.round(v)) === enemyAgility({ speed: d.speed }) ? undefined : Math.max(1, Math.round(v))), 1, 1),
          'Turn-based battles: how often its turns come round, like a hero’s Dexterity (10 is normal). Unset, it follows its speed.')),
      field('Its attacks are', select([['physical', 'Physical: the hero’s Defence and armour count'], ['magic', d.behaviour === 'ranged' ? 'Magic: it casts firebolts; the hero’s Magic Defence counts' : 'Magic: the hero’s Magic Defence counts']], d.attackType ?? 'physical',
        (v) => { d.attackType = v === 'magic' ? 'magic' : undefined; })),
      field('Light', select([['', 'Makes no difference (only easier to see)'], ['avoid', 'Avoids light: won’t come near a hero by a fire or using a light ring'], ['drawn', 'Drawn to light: spots a lit-up hero much sooner (bandits)']],
        d.light ?? '', (v) => { if (v) d.light = v as 'avoid' | 'drawn'; else delete d.light; }),
        'Every enemy stays out of a lit campfire’s safe ground (Database → Combat), so resting there is safe.'),
      h('div', { class: 'field-row' },
        field(d.behaviour === 'ranged' ? 'Shoots from (tiles)' : d.behaviour === 'charger' ? 'Charges from (tiles)' : 'Reach (tiles)', n(d.attackRange, (v) => (d.attackRange = v), 0.1, 0.3)),
        field('Wind-up (s)', n(d.windup, (v) => (d.windup = v), 0.05, 0.1), 'The tell before each attack: it glows. Longer is easier to dodge.'),
        field('Between attacks (s)', n(d.cooldown, (v) => (d.cooldown = v), 0.1, 0.2))),
      checkbox('Boss (a hit doesn’t interrupt its wind-up; can’t be killed outright by future stealth perks)', !!d.boss, (v) => (d.boss = v || undefined))),
    defenceSection(d, rerender),
    h('section', { class: 'db-section' }, h('h3', {}, 'Ailments'),
      inflictsField(() => d.inflicts, (v) => { if (v) d.inflicts = v; else delete d.inflicts; }, rerender),
      field('Can’t get', ailmentChips(() => d.resists, (v) => { if (v) d.resists = v as Ailment[]; else delete d.resists; }, rerender, 'Can’t get')),
      checkbox('Undead (always a zombie: healing and absorbing hurt it, can’t be killed outright or given ailments)', !!d.undead, (v) => { d.undead = v || undefined; rerender(); })),
    h('div', { class: 'field-row' }, field('Its attacks hit with', elementSelect(d.attackElement, (e) => { if (e) d.attackElement = e; else delete d.attackElement; }, 'Attack element', { auto: d.elements?.[0] ? `Its element (${ELEMENT_NAMES[d.elements[0]]})` : 'Its element (non-elemental)' }))),
    battleActions(d, rerender),
    h('section', { class: 'db-section' }, h('h3', {}, 'Senses'),
      h('div', { class: 'field-row' },
        field('Sight (tiles)', n(d.sight, (v) => (d.sight = v), 0.5, 1), 'In full light. Darkness and sneaking shorten it a lot.'),
        field('Field of view (°)', n(d.fov, (v) => (d.fov = Math.min(360, Math.round(v))), 5, 10)),
        field('Hearing', n(d.hearing, (v) => (d.hearing = v), 0.5, 0), '5 = normal. Running is loud, sneaking quiet.'))),
    h('section', { class: 'db-section' }, h('h3', {}, 'Rewards'),
      h('div', { class: 'field-row' },
        field('EXP', n(d.xp, (v) => (d.xp = Math.round(v)))),
        field('Gold from', n(d.gold?.[0] ?? 0, (v) => (d.gold = [Math.round(v), Math.max(Math.round(v), d.gold?.[1] ?? 0)]))),
        field('Gold to', n(d.gold?.[1] ?? 0, (v) => (d.gold = [Math.min(d.gold?.[0] ?? 0, Math.round(v)), Math.round(v)])))),
      ...drops.map((dr, k) => h('div', { class: 'field-row drop-row' },
        select(items.length ? items : [['', '(no items)']], dr.item, (v) => (dr.item = v), { 'aria-label': `Drop ${k + 1} item` }),
        field('Chance %', n(Math.round(dr.chance * 100), (v) => (dr.chance = Math.min(100, v) / 100), 5, 0)),
        field('How many', n(dr.count ?? 1, (v) => (dr.count = Math.max(1, Math.round(v)) === 1 ? undefined : Math.max(1, Math.round(v))), 1, 1)),
        h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove drop ${k + 1}`, onclick: () => { drops.splice(k, 1); rerender(); } }, '✕'))),
      items.length ? h('button', { type: 'button', class: 'btn', onclick: () => { drops.push({ item: items[0][0], chance: 0.25 }); rerender(); } }, '+ Add drop') : h('span'),
      h('p', { class: 'note' }, 'Loot goes straight into the bag (shown bottom left). Beaten enemies come back when the player returns to the map.')),
    h('div', { class: 'item-foot' }, h('button', { type: 'button', class: 'btn danger', onclick: remove }, 'Delete enemy')),
  ];
}

const ACTION_KINDS: [EnemyAction['kind'], string][] = [
  ['attack', 'Attack: a hit (its damage × power)'],
  ['spell', 'Spell: a magic hit (its damage × power; Magic Defence counts)'],
  ['heal', 'Heal: itself or a hurt friend (power: % of their health)'],
  ['guard', 'Guard: half damage, some health back, no ailments until its next turn'],
];

/** Database → Enemies → Turn-based battles: its plain attack's weight, Counterspell, and its other actions. */
function battleActions(d: EnemyDef, rerender: () => void): HTMLElement {
  const n = (v: number, set: (x: number) => void, step = 1, min = 0, label = '') => numberInput(v, (x) => set(Math.max(min, x)), { step, min, 'aria-label': label, class: 'db-num' });
  const list = d.actions ?? [];
  const save = () => { if (list.length) d.actions = list; else delete d.actions; };
  const rows = list.map((a, k) => {
    const powerLabel = a.kind === 'heal' ? 'Heals % of health' : a.kind === 'guard' ? '' : 'Power × its damage';
    return h('div', { class: 'db-section enemy-action' },
      h('div', { class: 'field-row' },
        field('Name', textInput(a.name, (v) => { a.name = v.trim(); }, { 'aria-label': `Action ${k + 1} name`, placeholder: 'Shown when it’s used' })),
        field('Does', select(ACTION_KINDS, a.kind, (v) => { a.kind = v as EnemyAction['kind']; rerender(); }, { 'aria-label': `Action ${k + 1} kind` })),
        h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove action ${k + 1}`, onclick: () => { list.splice(k, 1); save(); rerender(); } }, '✕')),
      h('div', { class: 'field-row' },
        powerLabel ? field(powerLabel, n(a.power ?? (a.kind === 'heal' ? 30 : 1), (v) => (a.power = v), a.kind === 'heal' ? 5 : 0.1, 0, `Action ${k + 1} power`)) : h('span'),
        field('How often', n(a.weight ?? 1, (v) => { const w = Math.round(v); if (w === 1) delete a.weight; else a.weight = w; }, 1, 0, `Action ${k + 1} weight`), 'Against its plain attack and its other actions.'),
        field('Only below health %', n(a.hpBelow ?? 0, (v) => { if (v > 0) a.hpBelow = Math.min(100, Math.round(v)); else delete a.hpBelow; }, 5, 0, `Action ${k + 1} health condition`), '0: any time.')),
      a.kind === 'attack' || a.kind === 'spell' ? h('div', { class: 'field-row' },
        field('Hits', select([['one', 'One of the party'], ['all', 'The whole party']], a.targets ?? 'one', (v) => { if (v === 'all') a.targets = 'all'; else delete a.targets; }, { 'aria-label': `Action ${k + 1} targets` })),
        field('Element', elementSelect(a.element, (e) => { if (e) a.element = e; else delete a.element; }, `Action ${k + 1} element`, { auto: 'Its attack’s element' })),
        checkbox('Counterspell (breaks a spell being charged)', !!a.counterspell, (v) => { if (v) a.counterspell = true; else delete a.counterspell; })) : h('span'),
      a.kind === 'attack' || a.kind === 'spell' ? inflictsField(() => a.inflicts, (v) => { if (v) a.inflicts = v; else delete a.inflicts; }, rerender, 'Ailments it can give (empty: its usual ones, for attacks)') : h('span'));
  });
  return h('section', { class: 'db-section' }, h('h3', {}, 'Turn-based battles'),
    h('div', { class: 'field-row' },
      field('Plain attack: how often', n(d.attackWeight ?? 1, (v) => { const w = Math.round(v); if (w === 1) delete d.attackWeight; else d.attackWeight = w; }, 1, 0, 'Attack weight'), '0: it never just attacks (only its actions below).'),
      checkbox('Its plain attack is a Counterspell (breaks a spell being charged)', !!d.counterspell, (v) => { if (v) d.counterspell = true; else delete d.counterspell; })),
    ...rows,
    h('button', { type: 'button', class: 'btn', onclick: () => { list.push({ name: '', kind: 'attack' }); save(); rerender(); } }, '+ Add action'),
    h('p', { class: 'note' }, 'On its turn it picks its plain attack or one of these by how often each is set. Enemies only guard if given a Guard action. Counterspell takes effect once spells can be charged (learned spells, coming next).'));
}
