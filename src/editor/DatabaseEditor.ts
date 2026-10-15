/**
 * Database window: game-wide settings — the player (abilities, health / magic / stamina,
 * regeneration, speeds, stamina costs, EXP progression), items and the starting inventory, time, saving and menus.
 * Saved in database.json; only values that differ from the defaults are written.
 */
import { SEASONS, SEASON_NAMES, type Season, type SeasonSettings } from '../world/seasons';
import { DEFAULT_PLAYER, type PlayerConfig, playerConfig } from '../game/stats';
import { ABILITIES, type Gauge, type MenuConfig, type PlayerConfigData } from '../world/types';
import { PAUSE_OPTIONS, TITLE_OPTIONS } from '../game/menus';
import { ABILITY_NAMES, GAUGE_NAMES } from './CommandEditor';
import { checkbox, field, h, numberInput, openModal, select, textInput } from './dom';
import type { EditorStore } from './store';
import { cleanInventory, inventoryTab, itemsTab, type ItemsWork } from './ItemsEditor';
import type { CombatData, EnemyDef, ItemDef } from '../world/types';
import { cleanCombat, combatTab, enemiesTab } from './CombatEditor';
import { type AudioWork, audioTab, cleanAudio } from './audioEditor';
import { cleanSkills, skillsTab } from './SkillsEditor';
import { additionsTab, classesTab, spellsTab } from './AbilitiesEditor';
import { DEFAULT_ADDITIONS, DEFAULT_SPELLS, additionList, spellList } from '../game/abilities';
import type { AdditionDef, ClassDef, SpellEntry, TroopDef } from '../world/types';
import { troopsTab } from './TroopsEditor';
import { expSection, trimExpTable } from './ExpEditor';
import { type CharactersWork, charactersTab } from './CharactersEditor';
import { cleanCredits, creditsTab } from './CreditsEditor';
import { cleanQuests, questsTab } from './QuestsEditor';
import { cleanHeroes, heroesTab, heroesWork } from './HeroesEditor';
import type { QuestDef } from '../world/types';
import type { CreditEntry } from '../world/types';
import { skillsData } from '../game/skills';
import type { SkillsData } from '../world/types';

const GAUGES: Gauge[] = ['hp', 'mp', 'sp'];
const SPEEDS: [keyof PlayerConfig['speed'], string][] = [
  ['walk', 'Walk'], ['run', 'Run'], ['wade', 'Wade (shallow water)'], ['swim', 'Swim'], ['crawl', 'Crawl'], ['climb', 'Climb'],
];
const COSTS: [keyof PlayerConfig['cost'], string, string][] = [
  ['run', 'Run', 'per second'], ['jump', 'Jump', 'per jump'], ['climb', 'Climb', 'per second'], ['swim', 'Swim', 'per second'],
];

export function openDatabase(store: EditorStore, startTab: 'player' | 'heroes' | 'characters' | 'items' | 'inventory' | 'quests' | 'combat' | 'enemies' | 'troops' | 'skills' | 'spells' | 'additions' | 'classes' | 'audio' | 'time' | 'saving' | 'menus' | 'credits' = 'player'): void {
  const cfg: PlayerConfig = playerConfig(store.db.stats);
  let tab: 'player' | 'heroes' | 'characters' | 'items' | 'inventory' | 'quests' | 'combat' | 'enemies' | 'troops' | 'skills' | 'spells' | 'additions' | 'classes' | 'audio' | 'time' | 'saving' | 'menus' | 'credits' = startTab;
  const work: ItemsWork = { items: JSON.parse(JSON.stringify(store.db.items ?? [])) as ItemDef[], inventory: JSON.parse(JSON.stringify(store.db.inventory ?? {})) };
  const itemState = { sel: 0 }, enemyState = { sel: 0 };
  const combat: CombatData = JSON.parse(JSON.stringify(store.db.combat ?? {}));
  const enemies: EnemyDef[] = JSON.parse(JSON.stringify(store.db.enemies ?? []));
  const audio: AudioWork = { files: [...(store.db.audio?.files ?? [])], sfx: { ...(store.db.audio?.sfx ?? {}) }, titleMusic: store.db.audio?.titleMusic };
  const skills: SkillsData = JSON.parse(JSON.stringify(skillsData(store.db.skills)));
  const skillState = { tree: 0, sel: '' };
  const time = { rate: store.db.time?.rate ?? 20, darkness: store.db.time?.darkness ?? 0.85, seasons: { ...store.db.time?.seasons } as SeasonSettings };
  let gameTitle = store.db.title;
  const menus: MenuConfig = JSON.parse(JSON.stringify(store.db.menus ?? {})) as MenuConfig;
  const saving = { anywhere: store.db.saving?.anywhere !== false, autosave: store.db.saving?.autosave !== false };
  const abilities = Object.fromEntries(ABILITIES.map((a) => [a, store.db.abilities?.[a] ?? true])) as Record<string, boolean>;
  const body = h('div', { class: 'db-editor' });
  const people: CharactersWork = { chars: JSON.parse(JSON.stringify(store.db.characters)), player: store.db.player };
  const credits: CreditEntry[] = JSON.parse(JSON.stringify(store.db.credits ?? []));
  const quests: QuestDef[] = JSON.parse(JSON.stringify(store.db.quests ?? []));
  const questState = { sel: 0 };
  const heroes = heroesWork(store.db.heroes, store.db.player), heroState = { sel: 0 };
  const spells: SpellEntry[] = JSON.parse(JSON.stringify(spellList(store.db)));
  const additions: AdditionDef[] = JSON.parse(JSON.stringify(additionList(store.db)));
  const classes: ClassDef[] = JSON.parse(JSON.stringify(store.db.classes ?? []));
  const spellState = { sel: 0 }, additionState = { sel: 0 }, classState = { sel: 0 };
  const troops: TroopDef[] = JSON.parse(JSON.stringify(store.db.troops ?? []));
  const troopState = { sel: 0 };

  const num = (value: number, set: (v: number) => void, min = 0, step = 1, label = '') =>
    numberInput(value, (v) => set(Math.max(min, v)), { min: String(min), step: String(step), 'aria-label': label, class: 'db-num' });

  const tabs = h('div', { class: 'db-tabs', role: 'tablist' });
  const content = h('div', { class: 'db-editor' });
  body.className = 'db-wrap';
  body.append(tabs, content);
  const render = () => {
    tabs.replaceChildren(...([['player', 'Player'], ['heroes', 'Heroes'], ['characters', 'Characters'], ['items', 'Items'], ['inventory', 'Inventory'], ['quests', 'Quests'], ['combat', 'Combat'], ['enemies', 'Enemies'], ['troops', 'Troops'], ['skills', 'Skills'], ['spells', 'Spells'], ['additions', 'Additions'], ['classes', 'Classes'], ['audio', 'Audio'], ['time', 'Time'], ['saving', 'Saving'], ['menus', 'Title & menus'], ['credits', 'Credits']] as const).map(([id, label]) =>
      h('button', { type: 'button', role: 'tab', class: 'db-tab', 'aria-selected': String(tab === id), onclick: () => { (document.activeElement as HTMLElement | null)?.blur?.(); tab = id; render(); } }, label)));
    if (tab === 'heroes') { content.replaceChildren(...heroesTab(heroes, people, combat, heroState, render, work.items, { spells, additions, classes })); return; }
    if (tab === 'characters') { content.replaceChildren(...charactersTab(store, people, render)); return; }
    if (tab === 'credits') { content.replaceChildren(...creditsTab(credits, people.chars, render, [...store.assets.props, ...store.assets.tiles].map((d) => d.credits ?? []))); return; }
    if (tab === 'quests') { content.replaceChildren(...questsTab(store, quests, { items: work.items, enemies }, questState, render)); return; }
    if (tab === 'items') { content.replaceChildren(...itemsTab(store, work, itemState, render)); return; }
    if (tab === 'skills') { content.replaceChildren(...skillsTab(skills, skillState, render, work.items, { spells, additions })); return; }
    if (tab === 'troops') { content.replaceChildren(...troopsTab(troops, enemies, audio.files, troopState, render)); return; }
    if (tab === 'spells') { content.replaceChildren(...spellsTab(spells, spellState, render)); return; }
    if (tab === 'additions') { content.replaceChildren(...additionsTab(additions, additionState, render)); return; }
    if (tab === 'classes') { content.replaceChildren(...classesTab(classes, skills, classState, render)); return; }
    if (tab === 'audio') { content.replaceChildren(...audioTab(store, audio, render)); return; }
    if (tab === 'combat') { content.replaceChildren(...combatTab(combat)); return; }
    if (tab === 'enemies') { content.replaceChildren(...enemiesTab(store, enemies, enemyState, render)); return; }
    if (tab === 'inventory') { content.replaceChildren(...inventoryTab(store, work, render)); return; }
    if (tab === 'menus') { content.replaceChildren(...menusTab()); return; }
    if (tab === 'saving') { content.replaceChildren(...savingTab()); return; }
    if (tab === 'time') { content.replaceChildren(...timeTab()); return; }
    content.replaceChildren(
      h('section', { class: 'db-section' },
        h('h3', {}, 'Health, magic and stamina'),
        h('div', { class: 'db-table gauges', role: 'table' },
          h('span', { class: 'db-head' }, ''), h('span', { class: 'db-head' }, 'Maximum'), h('span', { class: 'db-head' }, 'Regains per second'), h('span', { class: 'db-head' }, ''),
          ...GAUGES.flatMap((g) => {
            const regen = num(cfg.regen[g], (v) => (cfg.regen[g] = v), 0, 0.5, `${GAUGE_NAMES[g]} per second`);
            regen.disabled = cfg.noRegen[g];
            return [
              h('span', { class: `db-name gauge-${g}` }, GAUGE_NAMES[g]),
              num(cfg.max[g], (v) => (cfg.max[g] = Math.max(1, Math.round(v))), 1, 1, `Maximum ${GAUGE_NAMES[g]}`),
              regen,
              checkbox('Does not regenerate automatically', cfg.noRegen[g], (v) => { cfg.noRegen[g] = v; regen.disabled = v; }),
            ];
          })),
        h('p', { class: 'note' }, 'Everything starts full. By default only magic and stamina refill on their own; health comes back from items and events. Health at 0 sends the player back to their last rest point.')),

      h('section', { class: 'db-section' },
        h('h3', {}, 'Stamina'),
        h('div', { class: 'db-table costs' },
          ...COSTS.flatMap(([k, name, unit]) => [
            h('span', { class: 'db-name' }, name),
            num(cfg.cost[k], (v) => (cfg.cost[k] = v), 0, 1, `${name} stamina cost`),
            h('span', { class: 'db-unit' }, unit),
          ])),
        h('div', { class: 'db-table costs' },
          h('span', { class: 'db-name' }, 'Abilities return at'), num(cfg.recoverPercent, (v) => (cfg.recoverPercent = Math.min(100, v)), 0, 5, 'Recover percent'), h('span', { class: 'db-unit' }, '% stamina'),
          h('span', { class: 'db-name' }, 'Refills after'), num(cfg.regenDelay, (v) => (cfg.regenDelay = v), 0, 0.1, 'Regen delay'), h('span', { class: 'db-unit' }, 'seconds of rest'),
          h('span', { class: 'db-name' }, 'Drowning'), num(cfg.drownDamage, (v) => (cfg.drownDamage = v), 0, 1, 'Drowning damage'), h('span', { class: 'db-unit' }, 'health per second')),
        h('p', { class: 'note' }, 'At 0 stamina the player can only walk (and crawl): no running, jumping or climbing until stamina refills to the percentage above. Swimming with no stamina left drowns the player slowly.')),

      h('section', { class: 'db-section' },
        h('h3', {}, 'Movement speed'),
        h('div', { class: 'db-table speeds' },
          ...SPEEDS.flatMap(([k, name]) => [
            h('span', { class: 'db-name' }, name),
            num(cfg.speed[k], (v) => (cfg.speed[k] = Math.max(0.2, v)), 0.2, 0.1, `${name} speed`),
            h('span', { class: 'db-unit' }, 'tiles / s'),
          ])),
        h('p', { class: 'note' }, `Defaults: walk ${DEFAULT_PLAYER.speed.walk}, run ${DEFAULT_PLAYER.speed.run}. Jump height is fixed so a jump always clears one step.`)),

      h('section', { class: 'db-section' },
        h('h3', {}, 'Starting abilities'),
        h('div', { class: 'db-abilities' }, ...ABILITIES.map((a) => checkbox(ABILITY_NAMES[a], abilities[a], (v) => (abilities[a] = v)))),
        h('p', { class: 'note' }, 'Unticked abilities can be given later with the “Change ability” event command.')),

      expSection(combat),
    );
  };

  const dayLength = (rate: number) => {
    if (rate <= 0) return 'The clock stands still (events can still change the time).';
    const min = (24 * 60) / rate, hrs = Math.floor(min / 60), mins = Math.round(min % 60);
    return `A full day takes ${hrs ? `${hrs} h ` : ''}${mins ? `${mins} min` : ''} of play. ${rate === 1 ? '1 game minute per real minute.' : `${rate} game minutes per real minute.`}`;
  };
  const range = (value: number, min: number, max: number, step: number, label: string, fmt: (v: number) => string, set: (v: number) => void, note?: HTMLElement, noteText?: (v: number) => string) => {
    const out = h('output', { class: 'blend-out' }, fmt(value));
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label,
      oninput: () => { const v = parseFloat(input.value); set(v); out.textContent = fmt(v); if (note && noteText) note.textContent = noteText(v); } });
    return h('div', { class: 'blend-slider' }, input, out);
  };
  const timeTab = () => {
    const rateNote = h('div', { class: 'hint' }, dayLength(time.rate));
    const darkNote = h('div', { class: 'hint' });
    const darkText = (v: number) => v >= 0.95 ? 'Pitch black away from lights.' : v >= 0.7 ? 'Very dark: lights and moonlit outlines.' : v >= 0.35 ? 'Dark blue moonlit night.' : 'A bright, storybook night.';
    darkNote.textContent = darkText(time.darkness);
    return [
      h('section', { class: 'db-section' },
        h('h3', {}, 'Clock'),
        field('Clock speed', range(time.rate, 0, 60, 1, 'Clock speed', (v) => (v ? `${v}×` : 'Stopped'), (v) => (time.rate = v), rateNote, dayLength)),
        rateNote,
        h('p', { class: 'note' }, 'The clock pauses in menus and on the title screen. The starting hour is in the map settings under “Game start”.')),
      h('section', { class: 'db-section' },
        h('h3', {}, 'Night'),
        field('Night darkness', range(Math.round(time.darkness * 100), 0, 100, 5, 'Night darkness', (v) => `${v}%`, (v) => (time.darkness = v / 100), darkNote, (v) => darkText(v / 100))),
        darkNote,
        h('p', { class: 'note' }, 'Also how dark “Dark” maps (caves, dungeons) are. Each map chooses Outdoor, Indoor or Dark under Lighting in its settings.')),
      h('section', { class: 'db-section' },
        h('h3', {}, 'Seasons'),
        checkbox('Seasons change with the days', !time.seasons.off, (v) => { if (v) delete time.seasons.off; else time.seasons.off = true; }),
        field('Seasons follow', select([['real', 'The real world (the player’s date, northern hemisphere)'], ['realSouth', 'The real world (southern hemisphere)'], ['days', 'In-game days']], time.seasons.mode ?? 'real', (v) => { if (v === 'real') delete time.seasons.mode; else time.seasons.mode = v as SeasonSettings['mode']; }), 'Real world: March–May spring, June–August summer, September–November autumn, December–February winter.'),
        field('Days per season (in-game days)', numberInput(time.seasons.length ?? 7, (v) => { const n = Math.max(1, Math.round(v)); if (n === 7) delete time.seasons.length; else time.seasons.length = n; }, { min: 1, step: 1 })),
        field('A new game starts in', select(SEASONS.map((x) => [x, SEASON_NAMES[x]] as [string, string]), time.seasons.start ?? 'spring', (v) => { if (v === 'spring') delete time.seasons.start; else time.seasons.start = v as Season; })),
        h('p', { class: 'note' }, 'Outdoors, grass and leaves follow the season: fresh green in spring, green-gold in summer, orange and red in autumn. Winter brings snow, bare trees (each prop chooses: Props → Seasons) and ice on still water, which the hero slides on. A map can keep one season (map settings → Season).')),
    ];
  };

  const savingTab = () => [
    h('section', { class: 'db-section' },
      h('h3', {}, 'Saving'),
      checkbox('Save from the menu anywhere', saving.anywhere, (v) => (saving.anywhere = v)),
      checkbox('Autosave on every map change', saving.autosave, (v) => (saving.autosave = v)),
      h('p', { class: 'note' }, 'With saving anywhere off, players save at save points: events with the “Open save screen” command. Esc (or Menu on touch screens) opens the menu; there are 3 slots plus the autosave.')),
  ];

  const text = (value: string | undefined, placeholder: string, set: (v: string | undefined) => void, label: string) =>
    textInput(value ?? '', (v) => set(v.trim() || undefined), { placeholder, 'aria-label': label });
  const menusTab = () => [
    h('section', { class: 'db-section' },
      h('h3', {}, 'Title screen'),
      field('Game title', textInput(gameTitle, (v) => (gameTitle = v.trim() || gameTitle)), 'Also names the save files: changing it starts a fresh set of saves.'),
      field('Title shown on screen', text(menus.titleText, gameTitle, (v) => (menus.titleText = v), 'Title shown on screen'), 'Leave empty to show the game title.'),
      field('Subtitle', text(menus.subtitle, 'e.g. Chapter One: The Forest', (v) => (menus.subtitle = v), 'Subtitle')),
      h('div', { class: 'db-table menu-rows' },
        h('span', { class: 'db-head' }, 'Option'), h('span', { class: 'db-head' }, 'Shown as'), h('span', { class: 'db-head' }, 'Show'),
        ...TITLE_OPTIONS.flatMap(([o, name]) => [
          h('span', { class: 'db-name' }, name),
          text(menus.titleLabels?.[o], name, (v) => ((menus.titleLabels ??= {})[o] = v), `${name} label`),
          o === 'newGame' ? h('span', { class: 'db-unit' }, 'always') : checkboxOnly(!menus.titleHidden?.[o], (v) => ((menus.titleHidden ??= {})[o] = v ? undefined : true), `Show ${name}`),
        ])),
      h('p', { class: 'note' }, 'Continue and Load are greyed out until there’s a save. Exit closes the game (in a browser tab it can only ask the player to close the tab).'),
      checkbox('Skip the title screen in playtests', !!menus.skipTitleInPlaytest, (v) => (menus.skipTitleInPlaytest = v || undefined)),
      field('Game lettering', select([['classic', 'Classic pixel (Game Boy style: Press Start 2P)'], ['soft', 'Soft pixel (Pixelify Sans)'], ['smooth', 'Smooth (Atkinson Hyperlegible, not pixel)']], menus.font ?? 'classic',
        (v) => { if (v === 'classic') delete menus.font; else menus.font = v as 'soft' | 'smooth'; }),
        'The font for all of the game’s text: messages, menus, the HUD. All are free for commercial games (SIL Open Font License) and built into the game, so they work offline. Players can switch to an easy-to-read font in Settings.')),
    h('section', { class: 'db-section' },
      h('h3', {}, 'Pause menu'),
      h('div', { class: 'db-table menu-rows pause' },
        h('span', { class: 'db-head' }, 'Entry'), h('span', { class: 'db-head' }, 'Shown as'), h('span', { class: 'db-head' }, 'Show'), h('span', { class: 'db-head' }, ''),
        ...PAUSE_OPTIONS.flatMap(([o, name, works]) => [
          h('span', { class: 'db-name' }, name),
          text(menus.pauseLabels?.[o], name, (v) => ((menus.pauseLabels ??= {})[o] = v), `${name} label`),
          checkboxOnly(!menus.pauseHidden?.[o], (v) => ((menus.pauseHidden ??= {})[o] = v ? undefined : true), `Show ${name}`),
          h('span', { class: works ? 'db-unit works' : 'db-unit' }, works ? 'works' : 'coming soon'),
        ])),
      h('p', { class: 'note' }, 'Entries that aren’t built yet show greyed out (“Coming soon”); hide them if you’d rather not show them. Settings are the player’s own and stay the same whichever save is loaded.')),
  ];

  render();

  const reset = h('button', { type: 'button', class: 'btn ghost', onclick: () => {
    Object.assign(cfg, playerConfig());
    for (const a of ABILITIES) abilities[a] = true;
    saving.anywhere = true; saving.autosave = true;
    time.rate = 20; time.darkness = 0.85; time.seasons = {};
    for (const k of Object.keys(menus)) delete (menus as Record<string, unknown>)[k];
    render();
  } }, 'Reset to defaults');

  openModal('Database', body, [
    { label: 'Cancel' },
    { label: 'Apply', primary: true, onClick: () => {
      // Commit any number field still being typed in.
      (document.activeElement as HTMLElement | null)?.blur?.();
      const stats = diffFromDefaults(cfg);
      const ab = Object.fromEntries(ABILITIES.filter((a) => !abilities[a]).map((a) => [a, false]));
      const db = store.db;
      const sv: { anywhere?: boolean; autosave?: boolean } = {};
      if (!saving.anywhere) sv.anywhere = false;
      if (!saving.autosave) sv.autosave = false;
      const svOut = Object.keys(sv).length ? sv : null;
      const mOut = cleanMenus(menus);
      const tOut: { rate?: number; darkness?: number; seasons?: SeasonSettings } = {};
      if (Object.keys(time.seasons).length) tOut.seasons = { ...time.seasons };
      if (time.rate !== 20) tOut.rate = time.rate;
      if (Math.abs(time.darkness - 0.85) > 0.001) tOut.darkness = time.darkness;
      const tFinal = Object.keys(tOut).length ? tOut : null;
      const itemsOut = work.items.length ? work.items : null;
      const invOut = cleanInventory(work.inventory);
      trimExpTable(combat);
      const combatOut = cleanCombat(combat) ?? null;
      const enemiesOut = enemies.length ? enemies : null;
      const audioOut = cleanAudio(audio) ?? null;
      const skillsOut = cleanSkills(skills) ?? null;
      const questsOut = cleanQuests(quests) ?? null;
      const heroesOut = cleanHeroes(heroes) ?? null;
      const spellsOut = JSON.stringify(spells) === JSON.stringify(DEFAULT_SPELLS) && !db.spells ? null : spells;
      const additionsOut = JSON.stringify(additions) === JSON.stringify(DEFAULT_ADDITIONS) && !db.additions ? null : additions;
      const classesOut = classes.length ? classes : null;
      const troopsOut = troops.length ? troops : null;
      if (JSON.stringify(stats ?? null) === JSON.stringify(db.stats ?? null) && JSON.stringify(svOut) === JSON.stringify(db.saving ?? null) &&
        JSON.stringify(mOut ?? null) === JSON.stringify(db.menus ?? null) && gameTitle === db.title && JSON.stringify(tFinal) === JSON.stringify(db.time ?? null) &&
        JSON.stringify(Object.keys(ab).length ? ab : null) === JSON.stringify(db.abilities && Object.keys(db.abilities).length ? db.abilities : null) &&
        JSON.stringify(itemsOut) === JSON.stringify(db.items?.length ? db.items : null) && JSON.stringify(invOut ?? null) === JSON.stringify(db.inventory ?? null) &&
        JSON.stringify(combatOut) === JSON.stringify(db.combat ?? null) && JSON.stringify(enemiesOut) === JSON.stringify(db.enemies?.length ? db.enemies : null) &&
        JSON.stringify(audioOut) === JSON.stringify(db.audio ?? null) && JSON.stringify(skillsOut) === JSON.stringify(db.skills ?? null) &&
        JSON.stringify(people.chars) === JSON.stringify(db.characters) && people.player === db.player &&
        JSON.stringify(cleanCredits(credits) ?? null) === JSON.stringify(db.credits ?? null) && JSON.stringify(questsOut) === JSON.stringify(db.quests?.length ? db.quests : null) &&
        JSON.stringify(heroesOut) === JSON.stringify(db.heroes?.length ? db.heroes : null) &&
        JSON.stringify(spellsOut) === JSON.stringify(db.spells ?? null) && JSON.stringify(additionsOut) === JSON.stringify(db.additions ?? null) &&
        JSON.stringify(classesOut) === JSON.stringify(db.classes?.length ? db.classes : null) &&
        JSON.stringify(troopsOut) === JSON.stringify(db.troops?.length ? db.troops : null)) return;
      store.checkpoint();
      if (stats) db.stats = stats; else delete db.stats;
      if (Object.keys(ab).length) db.abilities = ab; else delete db.abilities;
      if (svOut) db.saving = svOut; else delete db.saving;
      if (mOut) db.menus = mOut; else delete db.menus;
      db.title = gameTitle;
      if (tFinal) db.time = tFinal; else delete db.time;
      if (itemsOut) db.items = itemsOut; else delete db.items;
      if (invOut) db.inventory = invOut; else delete db.inventory;
      if (combatOut) db.combat = combatOut; else delete db.combat;
      if (enemiesOut) db.enemies = enemiesOut; else delete db.enemies;
      if (audioOut) db.audio = audioOut; else delete db.audio;
      if (skillsOut) db.skills = skillsOut; else delete db.skills;
      if (questsOut) db.quests = questsOut; else delete db.quests;
      if (heroesOut) db.heroes = heroesOut; else delete db.heroes;
      if (spellsOut) db.spells = spellsOut; else delete db.spells;
      if (additionsOut) db.additions = additionsOut; else delete db.additions;
      if (classesOut) db.classes = classesOut; else delete db.classes;
      if (troopsOut) db.troops = troopsOut; else delete db.troops;
      db.characters = people.chars;
      const cr = cleanCredits(credits);
      if (cr) db.credits = cr; else delete db.credits;
      if (people.chars[people.player]) db.player = people.player;
      store.changedDb('ui');
    } },
  ], undefined, { wide: true, footStart: reset });
}

/** A checkbox with no text (its label is for screen readers). */
function checkboxOnly(checked: boolean, onchange: (v: boolean) => void, label: string): HTMLElement {
  const i = h('input', { type: 'checkbox', checked, 'aria-label': label, class: 'db-check', onchange: () => onchange(i.checked) });
  return i;
}

/** Drop empty entries, so database.json only lists what was changed. */
function cleanMenus(m: MenuConfig): MenuConfig | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (v === undefined || v === '' || v === false) continue;
    if (typeof v === 'object') {
      const inner = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined && x !== '' && x !== false));
      if (Object.keys(inner).length) out[k] = inner;
    } else out[k] = v;
  }
  return Object.keys(out).length ? (out as MenuConfig) : undefined;
}

/** Only the settings that differ from the defaults (or undefined when nothing does). */
function diffFromDefaults(cfg: PlayerConfig): PlayerConfigData | undefined {
  const out: PlayerConfigData = {};
  const d = DEFAULT_PLAYER as unknown as Record<string, unknown>, c = cfg as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PLAYER)) {
    const dv = d[key], cv = c[key];
    if (typeof dv === 'object' && dv) {
      const part: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cv as Record<string, unknown>)) if (v !== (dv as Record<string, unknown>)[k]) part[k] = v;
      if (Object.keys(part).length) (out as Record<string, unknown>)[key] = part;
    } else if (cv !== dv) (out as Record<string, unknown>)[key] = cv;
  }
  return Object.keys(out).length ? out : undefined;
}
