import { TRANSITIONS, TRANSITION_NAMES } from '../ui/BattleTransition';
import { formatFishing, parseFishing } from '../world/fishing';
import type { Season } from '../world/seasons';
import { blockedTiles } from '../world/props';
/** Right panel: properties of the selection, or of the map when nothing is selected. */
import { elementSelect } from './elementFields';
import { eventH, eventW } from '../world/eventArea';
import { BORDER_KINDS, type Side, borderSides } from '../world/border';
import type { AreaLightData, BorderKind, BreakableDef, Command, Dir, EventData, MapBorder, MapEnvironment, EventPage, LightData, MapData, PointLightData, SpotLightData, Trigger } from '../world/types';
import { mapAudioFields } from './audioEditor';
import { CommandEditor, WEATHER_NAMES, conditionForm, conditionText } from './CommandEditor';
import { checkbox, confirmModal, openModal, field, h, numberInput, select, textInput, toast } from './dom';
import { paletteProps, propName } from './editorArt';
import { lightFields } from './lightForm';
import { cliffChoices } from './assets';
import { BRICKS } from '../world/tiles';
import { type WaterCell, autoRampDir, formatHeights, formatWater, parseHeights, parseWater } from '../world/heights';
import { openPropImporter } from './PropImporter';
import type { EditorStore } from './store';
import { WEATHER_KINDS, type MistWhen, type BuildingData, type BuildingSide, type WeatherKind } from '../world/types';
import { BUILDING_DEFAULTS, doorstep, resolveBuilding } from '../world/buildingShape';
import { ROOF_CHOICES, WALL_CHOICES } from './buildingPresets';

const DIRS: [Dir, string][] = [['down', 'Down'], ['left', 'Left'], ['right', 'Right'], ['up', 'Up']];
const TRIGGERS: [Trigger, string][] = [
  ['action', 'Action button (talk / examine)'], ['touch', 'Player touch (step on it, or walk into it)'],
  ['auto', 'Autorun (runs once when page becomes active)'], ['none', 'None'],
];

export class Inspector {
  readonly el: HTMLElement;
  private readonly commands: CommandEditor;

  constructor(private readonly store: EditorStore) {
    this.el = h('aside', { class: 'side right', 'aria-label': 'Inspector' });
    this.commands = new CommandEditor(store);
    store.on('selection', () => this.render());
    store.on('structure', () => this.render());
    // The list of battle maps arrives once the project's maps are read.
    let kinds = '';
    store.on('meta', () => { const k = store.battleMapNames().join('|'); if (k !== kinds) { const first = !kinds && !k; kinds = k; if (!first) this.render(); } });
    // Keep the map summary current without rebuilding the form under the cursor.
    store.on('map', () => {
      const line = this.el.querySelector('.stats-line');
      if (line) line.textContent = this.counts();
    });
    this.render();
  }

  render(): void {
    const s = this.store;
    if (!s.map) return;
    const scroll = this.el.querySelector('.side-body')?.scrollTop ?? 0;
    const sel = s.selection;
    let content: HTMLElement[];
    if (sel?.kind === 'prop' && s.map.props[sel.index]) content = this.prop(sel.index);
    else if (sel?.kind === 'light' && s.map.lights[sel.index]) content = this.light(sel.index);
    else if (sel?.kind === 'building' && s.map.buildings?.[sel.index]) content = this.building(sel.index);
    else if (sel?.kind === 'event' && s.event(sel.id)) content = this.event(s.event(sel.id)!);
    else if (sel?.kind === 'start') content = this.start();
    else if (sel?.kind === 'tile') content = this.tile(sel.x, sel.z, sel.w ?? 1, sel.h ?? 1);
    else if (sel?.kind === 'ramp' && s.rampAt(sel.x, sel.z)) content = this.ramp(sel.x, sel.z);
    else content = this.mapProps();
    const body = h('div', { class: 'side-body' }, ...content);
    this.el.replaceChildren(body);
    body.scrollTop = scroll;
    if (this.eventWin) {
      if (sel?.kind === 'event' && sel.id === this.eventWin.id) this.drawEventWindow();
      else this.eventWin.close();
    }
  }

  /** Apply a change as one undo step. */
  private edit(fn: () => void, rebuild = false): void {
    this.store.checkpoint();
    fn();
    if (rebuild) this.store.changed('structure'); else this.store.changed();
  }

  /** Map settings → Battles: a battle map's camera, or the battle map a field map's battles are fought on. */
  private battleFields(): HTMLElement[] {
    const s = this.store, m = s.map, battle = m.kind === 'battle';
    const setKind = (v: boolean) => {
      this.edit(() => { if (v) m.kind = 'battle'; else delete m.kind; });
      s.mapKinds.set(s.mapName, v ? 'battle' : 'field');
      s.emit('meta'); s.emit('ui');
      this.render();
    };
    const out: HTMLElement[] = [checkbox('This is a battle map', battle, setKind)];
    if (!battle) {
      const names = s.battleMapNames();
      out.push(field('Battle map', select([['', 'None: the flat battle screen'], ...names.map((n) => [n, n] as [string, string])], m.battleMap ?? '', (v) => this.edit(() => { if (v) m.battleMap = v; else delete m.battleMap; })),
        names.length ? 'Turn-based battles on this map are fought on this battle map (a zone in the Spawns layer can choose another).'
          : 'No battle maps yet: make a new map, tick “This is a battle map”, and place party and enemy markers on it (Spawns layer, key 9).'));
      // How battles here begin: one transition, or several picked at random (none chosen: any of them).
      const chosen = new Set(m.battleTransitions ?? []);
      out.push(h('div', { class: 'field' }, h('label', {}, 'Battle transition'),
        h('div', { class: 'zone-days', role: 'group', 'aria-label': 'Battle transitions' }, ...TRANSITIONS.map((k) => h('button', { type: 'button', class: 'day-chip', 'aria-pressed': String(chosen.has(k)),
          onclick: () => { this.edit(() => { if (chosen.has(k)) chosen.delete(k); else chosen.add(k); const list = TRANSITIONS.filter((x) => chosen.has(x)); if (list.length) m.battleTransitions = list; else delete m.battleTransitions; }); this.render(); } }, TRANSITION_NAMES[k]))),
        h('div', { class: 'hint' }, chosen.size === 0 ? 'None picked: any of them, at random.' : chosen.size === 1 ? 'Every battle here starts this way.' : 'One of these, at random.')));
      return out;
    }
    const cam = m.battleCamera ?? {};
    const setCam = (k: 'distance' | 'height' | 'side' | 'fov', v: number, def: number) => this.edit(() => {
      const c = { ...m.battleCamera, [k]: v };
      if (v === def) delete c[k];
      m.battleCamera = Object.keys(c).length ? c : undefined;
    });
    out.push(
      h('p', { class: 'hint' }, 'A stage for turn-based battles (a forest clearing, plains, a city street). Place where the party and the enemies stand in the Spawns layer (key 9). Field maps choose it under Battles → Battle map.'),
      h('div', { class: 'field-row' },
        field('Camera back', numberInput(cam.distance ?? 6, (v) => setCam('distance', Math.max(2, Math.min(30, v)), 6), { min: 2, max: 30, step: 0.5 }), 'Tiles behind the party.'),
        field('Camera up', numberInput(cam.height ?? 3.2, (v) => setCam('height', Math.max(0.5, Math.min(20, v)), 3.2), { min: 0.5, max: 20, step: 0.25 }), 'Tiles above the ground.')),
      h('div', { class: 'field-row' },
        field('Camera side', numberInput(cam.side ?? 0, (v) => setCam('side', Math.max(-10, Math.min(10, v)), 0), { min: -10, max: 10, step: 0.5 }), 'Tiles to the right (+) or left (−) of the party.'),
        field('View angle', numberInput(cam.fov ?? 40, (v) => setCam('fov', Math.max(20, Math.min(75, Math.round(v))), 40), { min: 20, max: 75, step: 1 }), 'Degrees: wider shows more.')),
      h('p', { class: 'hint' }, 'The camera backs off further if a crowd wouldn’t fit. Turning the view far from straight up the map makes trees and props look flat, so it stays within about 35°.'));
    return out;
  }

  /** Map settings → Random encounters (turn-based battles): which enemies, how often, how many, and where. */
  private encounterFields(): HTMLElement[] {
    const s = this.store, m = s.map, enemies = s.db.enemies ?? [];
    const turnBased = s.db.combat?.mode === 'turnBased';
    const t = m.encounters;
    const zones = Object.entries(m.zones ?? {}).filter(([, z]) => z.troops.length);
    const goSpawns = h('button', { type: 'button', class: 'btn small', onclick: () => { s.mode = 'zones'; s.emit('ui'); } }, 'Go to the Spawns layer');
    const how = h('p', { class: 'hint' }, `${turnBased ? '' : 'Random battles need turn-based battles (Database → Combat → Battle system). '}Paint encounter zones on the Spawns layer (key 9), then pick each zone’s troops (Database → Troops) below the zone letters.${zones.length ? ` This map has ${zones.length} zone${zones.length === 1 ? '' : 's'} with troops: ${zones.map(([k, z]) => z.name || `Zone ${k}`).join(', ')}.` : ''}`);
    // The older per-map list (before zones and troops): only shown on maps that still have one.
    if (!t || !enemies.length) return [how, goSpawns];
    const opts = enemies.map((e) => [e.id, e.name] as [string, string]);
    return [
      how, goSpawns,
      h('div', { class: 'section-label' }, 'Older random encounters list'),
      h('p', { class: 'hint' }, 'From before zones and troops: still used on tiles outside any painted zone. Remove it once your zones are set up.'),
      h('button', { type: 'button', class: 'btn small danger', onclick: () => { this.edit(() => delete m.encounters); this.render(); } }, 'Remove this list'),
      ...t.enemies.map((row, k) => h('div', { class: 'field-row' },
        select(opts, row.enemy, (v) => this.edit(() => (row.enemy = v)), { 'aria-label': `Encounter ${k + 1} enemy` }),
        field('How often', numberInput(row.weight ?? 1, (v) => this.edit(() => { const w = Math.max(0, Math.round(v)); if (w === 1) delete row.weight; else row.weight = w; }), { min: 0, step: 1, 'aria-label': `Encounter ${k + 1} weight` })),
        h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove encounter ${k + 1}`, onclick: () => { this.edit(() => { t.enemies.splice(k, 1); if (!t.enemies.length) delete m.encounters; }); this.render(); } }, '✕'))),
      h('button', { type: 'button', class: 'btn small', onclick: () => { this.edit(() => t.enemies.push({ enemy: enemies[0].id })); this.render(); } }, '+ Add enemy'),
      h('div', { class: 'field-row' },
        field('Tiles between battles', numberInput(t.steps ?? 30, (v) => this.edit(() => { const n = Math.max(4, Math.round(v)); if (n === 30) delete t.steps; else t.steps = n; }), { min: 4, step: 1 }), 'About this far on average (it varies).'),
        field('Enemies: at least', numberInput(t.min ?? 1, (v) => this.edit(() => { const n = Math.max(1, Math.min(8, Math.round(v))); if (n === 1) delete t.min; else t.min = n; }), { min: 1, max: 8, step: 1 })),
        field('at most', numberInput(t.max ?? 3, (v) => this.edit(() => { const n = Math.max(1, Math.min(8, Math.round(v))); if (n === 3) delete t.max; else t.max = n; }), { min: 1, max: 8, step: 1 }))),
      field('Only on terrain', textInput(t.terrain ?? '', (v) => this.edit(() => { const c = [...new Set(v.replace(/\s+/g, ''))].join(''); if (c) t.terrain = c; else delete t.terrain; }), { 'aria-label': 'Encounter terrain', placeholder: 'Anywhere' }),
        'Terrain characters, e.g. . for grass (the Terrain palette shows each tile’s character). Empty: anywhere on this map.'),
    ];
  }

  private header(title: string, sub?: string, onDelete?: () => void): HTMLElement {
    return h('header', { class: 'insp-head' },
      h('div', {}, h('h2', {}, title), sub ? h('div', { class: 'insp-sub' }, sub) : null),
      onDelete ? h('button', { type: 'button', class: 'btn danger small', onclick: onDelete }, 'Delete') : null);
  }

  /* ------------------------------------------------------------ map */

  private mapProps(): HTMLElement[] {
    const s = this.store, m = s.map;
    let w = m.width, hgt = m.height;
    const resize = () => {
      if (w === m.width && hgt === m.height) return;
      this.edit(() => {
        const old = parseHeights(m.heights, m.width, m.height), next = new Int8Array(w * hgt);
        for (let z = 0; z < Math.min(hgt, m.height); z++) for (let x = 0; x < Math.min(w, m.width); x++) next[z * w + x] = old[z * m.width + x];
        m.heights = formatHeights(next, w, hgt) ?? undefined;
        const oldW = parseWater(m.water, m.width, m.height), nextW: (WaterCell | null)[] = new Array(w * hgt).fill(null);
        for (let z = 0; z < Math.min(hgt, m.height); z++) for (let x = 0; x < Math.min(w, m.width); x++) nextW[z * w + x] = oldW[z * m.width + x];
        m.water = formatWater(nextW, w, hgt) ?? undefined;
        if (m.fishing) {
          const oldF = parseFishing(m.fishing, m.width, m.height), nextF: (number | null)[] = new Array(w * hgt).fill(null);
          for (let z = 0; z < Math.min(hgt, m.height); z++) for (let x = 0; x < Math.min(w, m.width); x++) nextF[z * w + x] = oldF[z * m.width + x];
          m.fishing = formatFishing(nextF, w, hgt) ?? undefined;
        }
        m.ramps = m.ramps?.filter((r) => r.x < w && r.z < hgt);
        m.terrain = Array.from({ length: hgt }, (_, z) => (m.terrain[z] ?? '').padEnd(w, '.').slice(0, w));
        if (m.passage) {
          const rows = Array.from({ length: hgt }, (_, z) => (m.passage![z] ?? '').padEnd(w, '.').slice(0, w));
          m.passage = rows.some((r) => /[^.]/.test(r)) ? rows : undefined;
        }
        if (m.zoneGrid) {
          const rows = Array.from({ length: hgt }, (_, z) => (m.zoneGrid![z] ?? '').padEnd(w, '.').slice(0, w));
          m.zoneGrid = rows.some((r) => /[^.]/.test(r)) ? rows : undefined;
        }
        m.width = w; m.height = hgt;
        m.props = m.props.filter((p) => p.x < w && p.z < hgt);
        m.lights = m.lights.filter((l) => l.x < w && l.z < hgt);
        if (m.buildings) { m.buildings = m.buildings.filter((b) => b.x + b.w <= w && b.z + b.d <= hgt); if (!m.buildings.length) delete m.buildings; }
      }, true);
    };
    return [
      this.header('Map', `${s.mapName}.json`),
      field('Display name', textInput(m.name, (v) => this.edit(() => (m.name = v)))),
      h('div', { class: 'field-row' },
        field('Width', numberInput(m.width, (v) => (w = Math.round(Math.min(128, Math.max(8, v)))), { min: 8, max: 128, step: 1 })),
        field('Height', numberInput(m.height, (v) => (hgt = Math.round(Math.min(128, Math.max(8, v)))), { min: 8, max: 128, step: 1 }))),
      h('button', { type: 'button', class: 'btn small', onclick: resize }, 'Apply size'),
      h('p', { class: 'hint' }, 'Resizing keeps the top-left corner. Anything outside the new size is removed.'),
      field('Cliff walls', select(cliffChoices(s), m.cliffTile && s.tiles.isCliffLook(m.cliffTile) ? m.cliffTile : BRICKS,
        (v) => this.edit(() => { if (v === BRICKS) delete m.cliffTile; else m.cliffTile = v; })),
        'What cliff walls on this map look like. A tile can choose its own in the Terrain palette.'),
      field('Lighting', select([['outdoor', 'Outdoor'], ['indoor', 'Indoor'], ['dark', 'Dark (cave, dungeon)']],
        m.environment ?? 'outdoor', (v) => this.edit(() => { if (v === 'outdoor') delete m.environment; else m.environment = v as MapEnvironment; })),
        'Outdoor: the full day and night. Indoor: muted; windows show daylight and go dark at night. Dark: dark at any hour, only lights show.'),
      field('Season', select([['', 'The day’s season (Database → Time)'], ['spring', 'Always spring'], ['summer', 'Always summer'], ['autumn', 'Always autumn'], ['winter', 'Always winter (snow, ice)']],
        m.season ?? '', (v) => this.edit(() => { if (v) m.season = v as Season; else delete m.season; })),
        'Outdoor maps: grass and leaves follow the season. Winter brings snow, bare trees and ice on still water.'),
      this.borderFields(),
      ...this.weatherFields(),
      h('div', { class: 'section-label' }, 'Sound'),
      ...mapAudioFields(s, m, (fn) => this.edit(fn)),
      h('div', { class: 'section-label' }, 'Battles'),
      ...this.battleFields(),
      ...(m.kind === 'battle' ? [] : [h('div', { class: 'section-label' }, 'Random battles'), ...this.encounterFields()]),
      h('div', { class: 'section-label' }, 'Game start'),
      field('Starting hour', numberInput(s.db.startHour, (v) => { s.checkpoint(); s.db.startHour = Math.min(23.75, Math.max(0, v)); s.changedDb(); }, { min: 0, max: 23.75, step: 0.25 }), 'Time of day when a new game begins (0 – 23.75; 18.5 is 6:30 PM). Clock speed and night darkness are in Database → Time.'),
      h('p', { class: 'hint' }, s.startHere ? 'The player starts on this map. Select it in the Events layer to move it.' : `The player starts on “${s.db.startMap}”. To start here, select a tile in the Events layer and choose “Move player start here”.`),
      h('p', { class: 'stats-line' }, this.counts()),
    ];
  }

  /** Where the map's water is set up now (the Water tab). */
  private waterFields(_m: MapData): HTMLElement[] {
    return [h('div', { class: 'section-label' }, 'Water'),
      h('p', { class: 'hint' }, 'Colour, clarity, surface, current and glow are set per pool in the Water tab (key 8): a pond, a stream and a lava pool can share a map.')];
  }

  /** The breeze and the weather. */
  private weatherFields(): HTMLElement[] {
    const m = this.store.map, outdoor = (m.environment ?? 'outdoor') === 'outdoor';
    const strength = m.wind?.strength ?? (outdoor ? 0.3 : 0);
    const setWind = (k: 'strength' | 'dir', v: number) => this.edit(() => {
      const w = { ...m.wind, [k]: v };
      if (w.strength === undefined || w.strength === (outdoor ? 0.3 : 0)) delete w.strength;
      if (w.dir === undefined || w.dir === 15) delete w.dir;
      m.wind = Object.keys(w).length ? w : undefined;
    });
    const airSelect = (label: string, key: 'haze' | 'mist' | 'rays' | 'clouds') => field(label, select([['0', 'None'], ['0.3', 'Light'], ['0.6', 'Medium'], ['1', 'Thick']],
      String([0, 0.3, 0.6, 1].reduce((a, b) => (Math.abs(b - (m.atmosphere?.[key] ?? 0)) < Math.abs(a - (m.atmosphere?.[key] ?? 0)) ? b : a))), (v) => this.edit(() => {
        const a: NonNullable<typeof m.atmosphere> = { ...m.atmosphere, [key]: Number(v) };
        if (!a[key]) delete a[key];
        m.atmosphere = Object.keys(a).length ? a : undefined;
      })));
    // Weather: shared by every outdoor map, unless this map has its own (Unique weather), maybe shared with a zone.
    const st = this.store, unique = m.uniqueWeather ?? m.weather !== undefined;
    const own = unique ? m.weather : st.db.weather;
    const setOwn = (fn: (w: { kind: WeatherKind; amount?: number } | undefined) => { kind: WeatherKind; amount?: number } | undefined) => {
      if (unique) this.edit(() => { const w = fn(m.weather); if (w) m.weather = w; else delete m.weather; }, true);
      else { st.checkpoint(); const w = fn(st.db.weather); if (w) st.db.weather = w; else delete st.db.weather; st.changedDb('structure'); }
    };
    const kind = own?.kind ?? 'none';
    const amount = numberInput(own?.amount ?? 1, (v) => setOwn((w) => {
      if (!w) return w;
      const a = Math.max(0.1, Math.min(2, Math.round(v * 10) / 10)), out = { ...w };
      if (a === 1) delete out.amount; else out.amount = a;
      return out;
    }), { min: 0.1, max: 2, step: 0.1 });
    const amountField = field('How heavy', amount, '1 is normal; 0.3 light, 2 heavy.');
    amountField.hidden = kind === 'none';
    const weatherRow = h('div', { class: 'field-row' },
      field(unique ? 'Weather' : 'Shared weather at the start', select(WEATHER_KINDS.map((k) => [k, WEATHER_NAMES[k]] as [string, string]), kind,
        (v) => setOwn((w) => (v === 'none' ? (unique ? { kind: 'none' } : undefined) : { ...w, kind: v as WeatherKind })))),
      amountField);
    const weatherParts: HTMLElement[] = [
      checkbox('Unique weather (its own, not the shared outdoor weather)', unique, (v) => this.edit(() => {
        if (v) { m.uniqueWeather = true; m.weather ??= { kind: 'none' }; }
        else { delete m.uniqueWeather; delete m.weather; delete m.weatherZone; }
      }, true)),
      ...(unique ? [field('Weather zone', textInput(m.weatherZone ?? '', (v) => this.edit(() => { if (v.trim()) m.weatherZone = v.trim(); else delete m.weatherZone; })),
        'Optional. Maps with the same zone name share their weather with each other (desert, mountains): a change on one shows on all of them. Blank: this map alone.')] : []),
      weatherRow,
      h('p', { class: 'hint' }, unique
        ? 'This map keeps its own weather (or its zone’s), whatever the weather is on other maps. Good for deserts, mountaintops, a magic storm.'
        : outdoor ? 'Shared: every outdoor map without Unique weather has the same weather, so it’s still raining when the player steps into the next map. This is the weather a new game starts with (it’s the same setting on every shared map). Events change it with “Change weather”.'
          : 'Indoor and dark maps show no weather unless they have Unique weather (the shared outdoor weather carries on outside).'),
    ];
    return [
      h('div', { class: 'section-label' }, 'Wind, weather and air'),
      h('div', { class: 'field-row' },
        field('Wind', select([['0', 'Calm'], ['0.15', 'Light air'], ['0.3', 'Breeze'], ['0.6', 'Windy'], ['1', 'Gale']],
          String([0, 0.15, 0.3, 0.6, 1].reduce((a, b) => (Math.abs(b - strength) < Math.abs(a - strength) ? b : a))), (v) => setWind('strength', Number(v)))),
        field('Blowing towards', select([['0', 'East →'], ['45', 'South-east ↘'], ['90', 'South ↓'], ['135', 'South-west ↙'], ['180', 'West ←'], ['225', 'North-west ↖'], ['270', 'North ↑'], ['315', 'North-east ↗'], ['15', 'Default (east)']],
          String(m.wind?.dir ?? 15), (v) => setWind('dir', Number(v))))),
      h('p', { class: 'hint' }, 'Trees, bushes, grass and flowers sway with the wind (set per prop in its Behaviour tab).'),
      ...weatherParts,
      h('div', { class: 'field-row' },
        airSelect('Distance haze', 'haze'),
        airSelect('Sun rays', 'rays')),
      h('div', { class: 'field-row' },
        airSelect('Ground mist', 'mist'),
        field('Mist when', select([['always', 'All day'], ['morning', 'Mornings (dawn till 9)'], ['night', 'At night']], m.atmosphere?.mistWhen ?? 'always', (v) => this.edit(() => {
          const a: NonNullable<typeof m.atmosphere> = { ...m.atmosphere, mistWhen: v as MistWhen };
          if (v === 'always') delete a.mistWhen;
          m.atmosphere = Object.keys(a).length ? a : undefined;
        })))),
      h('div', { class: 'field-row' }, airSelect('Cloud shadows', 'clouds')),
      ...this.waterFields(m),
      h('p', { class: 'hint' }, 'Cloud shadows drift across the ground with the wind while the sun is out (fainter in rain, gone at night). Haze fades distant things into the sky colour. Mist lies low over the ground and veils feet. Sun rays slant down along the sunlight (gold at dawn and dusk, gone at night and in rain); on indoor maps they fall as if through windows by day. All of this shows in playtests, not in the editor.'),
    ];
  }

  /** What lies beyond each edge of the map. */
  private borderFields(): HTMLElement {
    const m = this.store.map, sides = borderSides(m.border);
    const set = (side: Side | 'all', kind: BorderKind) => this.edit(() => {
      const next: MapBorder = { seed: m.border?.seed ?? Math.floor(Math.random() * 1000), ...(side === 'all' ? { n: kind, s: kind, w: kind, e: kind } : { ...sides, [side]: kind }) };
      // Store compactly: one kind when every side matches, and nothing at all for plain grass.
      const k = [next.n, next.s, next.w, next.e];
      if (k.every((x) => x === k[0])) m.border = k[0] === 'grass' ? undefined : { kind: k[0], seed: next.seed };
      else m.border = next;
    }, true);
    const sideSelect = (side: Side, label: string) => field(label, select(BORDER_KINDS, sides[side], (v) => set(side, v as BorderKind)));
    const same = [sides.n, sides.s, sides.w, sides.e].every((k) => k === sides.n);
    return h('div', { class: 'border-fields' },
      h('div', { class: 'section-label' }, 'Beyond the map edge'),
      field('All sides', select([...(same ? [] : [['mixed', 'Mixed'] as [string, string]]), ...BORDER_KINDS], same ? sides.n : 'mixed', (v) => { if (v !== 'mixed') set('all', v as BorderKind); })),
      h('div', { class: 'field-row' }, sideSelect('n', 'Top'), sideSelect('s', 'Bottom')),
      h('div', { class: 'field-row' }, sideSelect('w', 'Left'), sideSelect('e', 'Right')),
      h('p', { class: 'hint' }, 'Scenery outside the map, seen at its edges. The bottom side is kept low and sparse so it doesn’t hide the map.'));
  }

  private counts(): string {
    const m = this.store.map, b = m.buildings?.length ?? 0;
    return `${m.props.length} props · ${m.lights.length} lights · ${b ? `${b} building${b === 1 ? '' : 's'} · ` : ''}${m.events.length} events`;
  }

  /* ------------------------------------------------------------ building */

  private building(i: number): HTMLElement[] {
    const s = this.store, b = s.map.buildings![i], r = resolveBuilding(b);
    const imported = s.tiles.all().filter((t) => t.image).map((t) => [t.key, `${t.name} (imported tile)`] as [string, string]);
    const looks = (base: [string, string][], cur: string) => {
      const out = [...base, ...imported];
      if (!out.some(([k]) => k === cur)) out.push([cur, `${cur} (missing)`]);
      return out;
    };
    // Move or resize, unless it would overlap another building or leave the map.
    const place = (next: Partial<BuildingData>) => {
      const n = { x: b.x, z: b.z, w: b.w, d: b.d, ...next };
      n.w = Math.max(1, Math.round(n.w)); n.d = Math.max(1, Math.round(n.d)); n.x = Math.round(n.x); n.z = Math.round(n.z);
      if (!s.buildingFits(n, i)) { toast('It would overlap another building or leave the map.', 'error'); this.render(); return; }
      this.edit(() => {
        Object.assign(b, n);
        for (const o of b.doors ?? []) o.at = Math.min(o.at, (o.side === 'front' || o.side === 'back' ? b.w : b.d) - 1);
      }, true);
    };
    const opt = <K extends keyof BuildingData>(key: K, v: BuildingData[K] | undefined, rebuild = false) =>
      this.edit(() => { if (v === undefined) delete b[key]; else b[key] = v; }, rebuild);
    const SIDES: [BuildingSide, string][] = [['front', 'Front (facing the camera)'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right']];
    // The Transfer event in front of a door: select it if there is one, else make one.
    const entrance = (o: { side: BuildingSide; at: number }) => {
      const [x, z] = doorstep(b, o);
      if (!s.inMap(x, z)) { toast('That door faces the edge of the map.', 'error'); return; }
      const ev = s.eventAt(x, z);
      s.mode = 'events';
      if (ev) { s.select({ kind: 'event', id: ev.id }); s.emit('ui'); return; }
      const id = s.nextEventId(), other = s.maps.find((n) => n !== s.mapName) ?? s.mapName;
      const cmd: Command = { cmd: 'transfer', map: other, x: 0, z: 0 };
      const created: EventData = { id, name: `${b.name || 'Door'} → ${other}`, x, z, pages: [{ trigger: 'touch', commands: [cmd] }] };
      s.checkpoint();
      s.map.events.push(created);
      s.changed('structure');
      s.select({ kind: 'event', id });
      s.emit('ui');
      this.commands.editCommand(cmd, created.pages[0].commands);
    };
    const doors = b.doors ?? [];
    const doorRow = (o: { side: BuildingSide; at: number }, k: number) => {
      const len = o.side === 'front' || o.side === 'back' ? b.w : b.d;
      const [dx, dz] = doorstep(b, o), ev = s.inMap(dx, dz) ? s.eventAt(dx, dz) : undefined;
      return h('div', { class: 'credit-row' },
        h('div', { class: 'credit-fields' },
          h('div', { class: 'field-row' },
            field('Wall', select(SIDES, o.side, (v) => this.edit(() => { o.side = v as BuildingSide; o.at = Math.min(o.at, (v === 'front' || v === 'back' ? b.w : b.d) - 1); }, true))),
            field(o.side === 'left' || o.side === 'right' ? 'Tile from top' : 'Tile from left', numberInput(o.at, (v) => this.edit(() => (o.at = Math.max(0, Math.min(len - 1, Math.round(v)))), true), { min: 0, max: len - 1, step: 1 }))),
          h('button', { type: 'button', class: 'btn small', onclick: () => entrance(o) }, ev ? `Edit entrance event (${ev.name})` : 'Add entrance (Transfer event)')),
        h('div', { class: 'credit-btns' }, h('button', { type: 'button', class: 'btn small danger', onclick: () => this.edit(() => { doors.splice(k, 1); if (!doors.length) delete b.doors; }, true) }, 'Remove')));
    };
    const pitched = r.roofStyle !== 'flat';
    return [
      this.header(b.name || 'Building', `${b.w} × ${b.d} tiles at ${b.x}, ${b.z}`, () => this.edit(() => { s.map.buildings!.splice(i, 1); if (!s.map.buildings!.length) delete s.map.buildings; s.select(null); }, true)),
      field('Name', textInput(b.name ?? '', (v) => opt('name', v.trim() || undefined)), 'Only shown in the editor.'),
      h('div', { class: 'field-row' },
        field('X', numberInput(b.x, (v) => place({ x: v }), { step: 1 })),
        field('Z', numberInput(b.z, (v) => place({ z: v }), { step: 1 }))),
      h('div', { class: 'field-row' },
        field('Width', numberInput(b.w, (v) => place({ w: v }), { min: 1, max: 32, step: 1 })),
        field('Depth', numberInput(b.d, (v) => place({ d: v }), { min: 1, max: 32, step: 1 }))),
      h('div', { class: 'section-label' }, 'Look'),
      field('Walls', select(looks(WALL_CHOICES, r.wall), r.wall, (v) => opt('wall', v === BUILDING_DEFAULTS.wall ? undefined : v, true))),
      field('Roof', select(looks(ROOF_CHOICES, r.roof), r.roof, (v) => opt('roof', v === BUILDING_DEFAULTS.roof ? undefined : v, true)),
        imported.length ? 'Imported tiles work too: walls and roofs repeat them like the ground does.' : 'Tiles you import (Terrain layer) can be used for walls and roofs too.'),
      h('div', { class: 'field-row' },
        field('Wall height', numberInput(r.height, (v) => opt('height', Math.max(1, Math.min(12, Math.round(v * 2) / 2))), { min: 1, max: 12, step: 0.5 })),
        field('Windows', select([['none', 'None'], ['few', 'A few'], ['many', 'Many']], r.windows, (v) => opt('windows', v as BuildingData['windows'])))),
      h('div', { class: 'section-label' }, 'Roof'),
      h('div', { class: 'field-row' },
        field('Shape', select([['gable', 'Gable (two slopes)'], ['hip', 'Hip (four slopes)'], ['flat', 'Flat']], r.roofStyle, (v) => opt('roofStyle', v as BuildingData['roofStyle'], true))),
        pitched ? field('Ridge runs', select([['auto', 'Automatic'], ['x', 'Across (left–right)'], ['z', 'Up the map']], b.ridge ?? 'auto', (v) => opt('ridge', v === 'auto' ? undefined : (v as 'x' | 'z'), true))) : h('span')),
      h('div', { class: 'field-row' },
        pitched ? field('Rise', numberInput(r.pitch, (v) => opt('pitch', Math.max(0.25, Math.min(8, Math.round(v * 4) / 4))), { min: 0.25, max: 8, step: 0.25 })) : h('span'),
        field('Overhang', numberInput(r.overhang, (v) => opt('overhang', Math.max(0, Math.min(1.5, Math.round(v * 20) / 20))), { min: 0, max: 1.5, step: 0.05 }))),
      pitched && b.pitch !== undefined ? h('button', { type: 'button', class: 'btn small', onclick: () => opt('pitch', undefined, true) }, 'Automatic rise') : h('span'),
      h('div', { class: 'section-label' }, `Doors (${doors.length})`),
      ...doors.map(doorRow),
      h('button', { type: 'button', class: 'btn small', onclick: () => this.edit(() => (b.doors = [...doors, { side: 'front', at: Math.floor((b.w - 1) / 2) }]), true) }, '+ Add a door'),
      h('p', { class: 'hint' }, 'Sizes are in tiles. The building blocks every tile it stands on. Interiors are separate maps: “Add entrance” puts a Transfer event on the tile in front of the door (dashed orange on the map) — choose the interior map and where to arrive.'),
    ];
  }

  /* ------------------------------------------------------------ prop / light / start / tile */

  private prop(i: number): HTMLElement[] {
    const s = this.store, p = s.map.props[i];
    const def = s.catalog.get(p.type);
    const types = paletteProps().map((d) => [d.id, d.name] as [string, string]);
    if (!def) types.unshift([p.type, `${p.type} (missing)`]);
    const notes: string[] = [];
    const nb = def ? blockedTiles(def, p.x, p.z, p.s ?? 1).length : 0;
    if (def?.foot) notes.push(`Covers ${def.foot.w} × ${def.foot.d} tile${def.foot.w * def.foot.d === 1 ? '' : 's'}; ${nb ? `${nb} solid` : 'all walkable'}.`);
    else if (nb) notes.push(`Blocks ${nb} tile${nb === 1 ? '' : 's'}.`);
    else if (def) notes.push('Doesn’t block movement.');
    if (def?.light) notes.push('Carries a light.');
    if (def?.glow) notes.push('Windows glow at night.');
    return [
      this.header(propName(p.type), def?.image ? 'Imported prop' : 'Prop', () => this.edit(() => { s.map.props.splice(i, 1); s.select(null); })),
      field('Type', select(types, p.type, (v) => this.edit(() => (p.type = v)))),
      h('div', { class: 'field-row' },
        field('X', numberInput(p.x, (v) => this.moveProp(i, v, p.z), { step: 0.1 })),
        field('Z', numberInput(p.z, (v) => this.moveProp(i, p.x, v), { step: 0.1 }))),
      field('Scale', numberInput(p.s ?? 1, (v) => this.edit(() => { const sc = Math.min(3, Math.max(0.3, v)); if (Math.abs(sc - 1) < 0.001) delete p.s; else p.s = sc; }), { step: 0.05, min: 0.3, max: 3 })),
      h('p', { class: 'hint' }, `Positions are in tiles; .5 is the centre of a tile. ${notes.join(' ')}`),
      def ? h('button', { type: 'button', class: 'btn small', onclick: () => void openPropImporter(s, def) },
        def.image ? `Edit “${def.name}” (all copies)` : `Customise “${def.name}” (all copies)`) : null,
    ].filter((x): x is HTMLElement => !!x);
  }

  /** Move a prop by typing its position, unless another prop already stands on that tile. */
  private moveProp(i: number, x: number, z: number): void {
    const s = this.store, p = s.map.props[i];
    if (s.propOnTile(Math.floor(x), Math.floor(z), i) >= 0) {
      toast('Another prop already stands on that tile.', 'error');
      this.render();
      return;
    }
    this.edit(() => { p.x = x; p.z = z; });
  }

  private light(i: number): HTMLElement[] {
    const s = this.store, l = s.map.lights[i];
    const title = { point: 'Point light', spot: 'Spotlight', area: 'Area light' }[l.type];
    const commit = <T extends LightData>(apply: (x: T) => void, rebuild = false) => this.edit(() => apply(l as T), rebuild);
    const names = s.knownNames();
    const out: HTMLElement[] = [
      this.header(title, `${round2(l.x)}, ${round2(l.z)}`, () => this.edit(() => { s.map.lights.splice(i, 1); s.select(null); })),
      h('div', { hidden: true }, h('datalist', { id: 'dl-switches' }, ...names.switches.map((n) => h('option', { value: n })))),
    ];
    if (l.type === 'area') {
      const a = l as AreaLightData;
      out.push(
        h('div', { class: 'field-row' },
          field('Shape', select([['rect', 'Rectangle'], ['ellipse', 'Ellipse']], a.shape, (v) => commit<AreaLightData>((x) => (x.shape = v as 'rect' | 'ellipse')))),
          field('Soft edge (tiles)', numberInput(a.feather, (v) => commit<AreaLightData>((x) => (x.feather = Math.max(0, v))), { step: 0.25, min: 0, max: 20 }))),
        h('div', { class: 'field-row' },
          field('Width (tiles)', numberInput(a.w, (v) => commit<AreaLightData>((x) => (x.w = Math.max(0.5, v))), { step: 0.5, min: 0.5, max: 128 })),
          field('Height (tiles)', numberInput(a.h, (v) => commit<AreaLightData>((x) => (x.h = Math.max(0.5, v))), { step: 0.5, min: 0.5, max: 128 }))),
        ...lightFields(a, (apply) => commit<AreaLightData>(apply), { brightness: 'tint', showFlicker: false, showRadius: false, showSwitch: true }),
        h('p', { class: 'hint' }, 'Area lights tint the ground, props and characters inside them. They cost almost nothing, so use them freely (up to 8 per map).'),
      );
    } else {
      if (l.type === 'spot') {
        const sp = l as SpotLightData;
        out.push(
          field('Facing', select(DIRS, sp.dir, (v) => commit<SpotLightData>((x) => (x.dir = v as Dir)))),
          h('div', { class: 'field-row' },
            field('Beam width (°)', numberInput(sp.angle, (v) => commit<SpotLightData>((x) => (x.angle = Math.min(170, Math.max(5, v)))), { step: 5, min: 5, max: 170 })),
            field('Tilt down (°)', numberInput(sp.tilt, (v) => commit<SpotLightData>((x) => (x.tilt = Math.min(89, Math.max(0, v)))), { step: 5, min: 0, max: 89 }))));
      }
      const pl = l as PointLightData | SpotLightData;
      if (pl.y === undefined) pl.y = pl.type === 'spot' ? 1.6 : 1.2;
      out.push(...lightFields(pl, (apply) => commit<PointLightData | SpotLightData>(apply), {
        showHeight: true, showShadows: true, showSwitch: true,
        shadowHint: l.type === 'spot' ? 'Spotlight shadows are fairly cheap.' : 'Point-light shadows are the most expensive kind. Keep them for one or two key lights.',
      }));
    }
    return out;
  }

  private ramp(x: number, z: number): HTMLElement[] {
    const s = this.store, r = s.rampAt(x, z)!;
    const detected = autoRampDir((cx, cz) => (s.inMap(cx, cz) ? s.heightAt(cx, cz) : null), x, z);
    const dirName = (d: Dir | null) => (d ? DIRS.find(([k]) => k === d)![1] : 'none');
    const remove = () => this.edit(() => { s.map.ramps = (s.map.ramps ?? []).filter((q) => q !== r); s.select(null); }, true);
    const out: HTMLElement[] = [
      this.header(r.style === 'stairs' ? 'Stairs' : 'Ramp', `${x}, ${z} · height ${s.heightAt(x, z)}`, remove),
      field('Style', select([['stairs', 'Stairs'], ['ramp', 'Ramp']], r.style, (v) => this.edit(() => (r.style = v as 'ramp' | 'stairs')))),
      field('Rises toward', select([['auto', `Automatic (${dirName(detected)})`], ...DIRS], r.dir ?? 'auto',
        (v) => this.edit(() => { if (v === 'auto') delete r.dir; else r.dir = v as Dir; }, true))),
    ];
    const dir = r.dir ?? detected;
    if (!dir) out.push(h('p', { class: 'warn' }, 'No neighbour is one step higher, so this lies flat (red ✕ on the map). Raise the cell it should lead up to by one step, lower this cell, or remove it.'));
    else if (r.dir && r.dir !== detected) out.push(h('p', { class: 'hint' }, 'Set by hand. The high end meets the cell on that side; make sure it is one step higher.'));
    out.push(h('p', { class: 'hint' }, `A ${r.style === 'stairs' ? 'flight of stairs' : 'ramp'} climbs one step (half a tile) across its cell. For taller climbs, chain several, each one step higher.`),
      h('button', { type: 'button', class: 'btn danger', onclick: remove }, `Remove ${r.style === 'stairs' ? 'these stairs' : 'this ramp'}`));
    return out;
  }

  private start(): HTMLElement[] {
    const s = this.store, st = s.db.start;
    return [
      this.header('Player start', `${s.db.startMap} · ${Math.floor(st.x)}, ${Math.floor(st.z)}`),
      field('Facing', select(DIRS, st.dir ?? 'down', (v) => { s.checkpoint(); st.dir = v as Dir; s.changedDb(); })),
      h('p', { class: 'hint' }, 'Drag the hero on the map to move the start position.'),
    ];
  }

  private tile(x: number, z: number, w = 1, hgt = 1): HTMLElement[] {
    const s = this.store;
    const area = w > 1 || hgt > 1;
    const size = area ? { w, h: hgt } : {};
    const fits = s.eventFits({ x, z, w, h: hgt });
    const createEvent = () => {
      const id = s.nextEventId();
      // One tile: a solid "talk to it" event. An area: a step-on trigger you can walk through.
      const ev: EventData = { id, name: `Event ${String(id).padStart(3, '0')}`, x, z, ...size,
        pages: [area ? { trigger: 'touch', commands: [] } : { trigger: 'action', solid: true, commands: [] }] };
      s.checkpoint();
      s.map.events.push(ev);
      s.changed('structure');
      s.select({ kind: 'event', id });
      // Straight into its editor, to give it commands.
      this.openEventWindow(ev);
    };
    // A transfer: an invisible event that runs when the player steps on it.
    const createTransfer = () => {
      const id = s.nextEventId();
      const other = s.maps.find((n) => n !== s.mapName) ?? s.mapName;
      const cmd: Command = { cmd: 'transfer', map: other, x: 0, z: 0 };
      const ev: EventData = { id, name: `To ${other}`, x, z, ...size, pages: [{ trigger: 'touch', commands: [cmd] }] };
      s.checkpoint();
      s.map.events.push(ev);
      s.changed('structure');
      s.select({ kind: 'event', id });
      this.commands.editCommand(cmd, ev.pages[0].commands);
    };
    // A way into a cliff or wall: a cave mouth on the wall that moves the player when they walk into it.
    const createEntrance = () => {
      const id = s.nextEventId();
      const other = s.maps.find((n) => n !== s.mapName) ?? s.mapName;
      const cmd: Command = { cmd: 'transfer', map: other, x: 0, z: 0 };
      const ev: EventData = { id, name: `Cave to ${other}`, x, z, pages: [{ sprite: 'cave_mouth', trigger: 'touch', commands: [cmd] }] };
      s.checkpoint();
      s.map.events.push(ev);
      s.changed('structure');
      s.select({ kind: 'event', id });
      this.commands.editCommand(cmd, ev.pages[0].commands);
    };
    // A chest or a pickup: gives an item once, then a switch remembers it was taken.
    const createLoot = (kind: 'chest' | 'pickup') => {
      const id = s.nextEventId();
      const sw = `${kind}_${s.mapName}_${id}`.replace(/[^A-Za-z0-9_]+/g, '_');
      const items = s.db.items ?? [];
      const first = items.find((d) => d.kind === 'consumable') ?? items[0];
      const give: Command = { cmd: 'giveItem', item: first?.id ?? '', count: 1 };
      const ev: EventData = kind === 'chest'
        ? { id, name: 'Chest', x, z, pages: [
          { sprite: 'chest', trigger: 'action', solid: true, commands: [give, { cmd: 'setSwitch', switch: sw, value: true }] },
          { condition: { switch: sw, is: true }, sprite: 'chest_open', trigger: 'action', solid: true, commands: [] }] }
        : { id, name: 'Item', x, z, pages: [
          { sprite: 'sparkle', trigger: 'action', commands: [give, { cmd: 'setSwitch', switch: sw, value: true }] },
          { condition: { switch: sw, is: true }, trigger: 'none', commands: [] }] };
      s.checkpoint();
      s.map.events.push(ev);
      s.changed('structure');
      s.pageIndex = 0;
      s.select({ kind: 'event', id });
      this.commands.editCommand(give, ev.pages[0].commands);
    };
    const createEnemy = () => {
      const id = s.nextEventId(), foe = s.db.enemies?.[0];
      if (!foe) toast('Add an enemy type in Database → Enemies first; the event is ready for it.');
      const ev: EventData = { id, name: foe?.name ?? 'Enemy', x, z, pages: [{ enemy: foe?.id ?? '', trigger: 'none', commands: [] }] };
      s.checkpoint();
      s.map.events.push(ev);
      s.changed('structure');
      s.pageIndex = 0;
      s.select({ kind: 'event', id });
    };
    // Something to break: a crate by default; breaking it sets a switch, and page 2 shows the rubble.
    const createBreakable = () => {
      const id = s.nextEventId();
      const sw = `broken_${s.mapName}_${id}`.replace(/[^A-Za-z0-9_]+/g, '_');
      const ev: EventData = { id, name: 'Crate', x, z, pages: [
        { sprite: 'crate', trigger: 'none', solid: true, breakable: { hp: 20 }, commands: [{ cmd: 'setSwitch', switch: sw, value: true }] },
        { condition: { switch: sw, is: true }, sprite: 'rubble', trigger: 'none', commands: [] }] };
      s.checkpoint();
      s.map.events.push(ev);
      s.changed('structure');
      s.pageIndex = 0;
      s.select({ kind: 'event', id });
      toast('A crate: hit it to break it. Its commands run when it breaks (add “Set switch” for a bridge or a gate). Try the Crystal switch or Cracked boulder sprites too.');
    };
    const paste = () => { const r = s.pasteEvent(x, z); if (typeof r === 'string') toast(r, 'error'); };
    const moveStart = () => {
      s.checkpoint();
      s.db.startMap = s.mapName;
      s.db.start.x = x + 0.5;
      s.db.start.z = z + 0.5;
      s.changedDb('structure');
      s.select({ kind: 'start' });
    };
    const clip = s.eventClipboard;
    return [
      this.header(area ? `Tiles ${x}, ${z} · ${w} × ${hgt}` : `Tile ${x}, ${z}`, area ? `${w * hgt} tiles` : s.terrainAt(x, z) === '~' || s.terrainAt(x, z) === '#' ? 'Not walkable' : 'Empty'),
      fits ? null : h('p', { class: 'hint error' }, 'Part of this area already has an event. Events can’t overlap.'),
      h('div', { class: 'stack' },
        h('button', { type: 'button', class: 'btn primary', disabled: !fits, onclick: createEvent }, area ? `Create event over these ${w * hgt} tiles` : 'Create event here'),
        h('button', { type: 'button', class: 'btn', disabled: !fits, onclick: createTransfer, title: 'An invisible event that moves the player to another map (or elsewhere on this one) when stepped on' },
          area ? `Create transfer over these ${w * hgt} tiles` : 'Create transfer here'),
        area ? null : h('button', { type: 'button', class: 'btn', disabled: !fits, onclick: createEntrance, title: 'A cave mouth on the cliff face behind this tile (or on this tile’s own face): the player walks into it to go to another map. Change its picture to the door or square opening if you like.' }, 'Create cave entrance here'),
        area ? null : h('button', { type: 'button', class: 'btn', disabled: !fits, onclick: createEnemy, title: 'An enemy from Database → Enemies' }, 'Create enemy here'),
        area ? null : h('button', { type: 'button', class: 'btn', disabled: !fits, onclick: createBreakable, title: 'A crate, boulder or crystal switch the player breaks by hitting it; its commands run when it breaks' }, 'Create breakable here'),
        area ? null : h('button', { type: 'button', class: 'btn', disabled: !fits, onclick: () => createLoot('chest'), title: 'A chest that gives an item once, then stays open' }, 'Create chest here'),
        area ? null : h('button', { type: 'button', class: 'btn', disabled: !fits, onclick: () => createLoot('pickup'), title: 'A sparkle on the ground: pick it up once and it’s gone' }, 'Create item pickup here'),
        clip ? h('button', { type: 'button', class: 'btn', onclick: paste, title: 'Ctrl+V pastes on the tile under the mouse' }, `Paste “${clip.name}” here`) : null,
        area ? null : h('button', { type: 'button', class: 'btn', onclick: moveStart }, 'Move player start here')),
      h('p', { class: 'hint' }, area ? 'Any tile of the area triggers the event.' : 'Drag across empty tiles to select an area for one big event (a wide doorway, say).'),
    ].filter((n): n is HTMLElement => !!n);
  }

  /** Health, defence, what can break it, and the name over its health bar. */
  private breakableFields(b: BreakableDef): HTMLElement[] {
    const kinds = new Set(b.hitBy?.length ? b.hitBy : HIT_KINDS.map(([k]) => k));
    return [
      h('div', { class: 'field-row' },
        field('Health', numberInput(b.hp, (v) => this.edit(() => (b.hp = Math.max(1, Math.round(v)))), { step: 1, min: 1 })),
        field('Defence', numberInput(b.defense ?? 0, (v) => this.edit(() => { const n = Math.max(0, Math.round(v)); if (n) b.defense = n; else delete b.defense; }), { step: 1, min: 0 }))),
      field('Name over its health bar', textInput(b.name ?? '', (v) => this.edit(() => (b.name = v.trim() || undefined)), { placeholder: 'The event’s name' })),
      h('div', { class: 'field' }, h('label', {}, 'Broken by'),
        h('div', { class: 'field-row' }, ...HIT_KINDS.map(([k, label]) => checkbox(label, kinds.has(k), (v) => this.edit(() => {
          if (v) kinds.add(k); else kinds.delete(k);
          if (!kinds.size) kinds.add(k);
          const list = HIT_KINDS.map(([x]) => x).filter((x) => kinds.has(x));
          if (list.length === HIT_KINDS.length) delete b.hitBy; else b.hitBy = list;
        }, true))))),
      field('Only hurt by', elementSelect(b.needs, (e) => this.edit(() => { if (e && e !== 'neutral') b.needs = e; else delete b.needs; }), 'Only hurt by element', { auto: 'Any element' }),
        'An ice wall only fire melts, roots only fire burns: other elements show “No effect”.'),
      h('p', { class: 'hint' }, 'A short sword hits for about 8. Other attacks show “No effect” (a crystal only magic reaches, say). Solid by default. To keep it broken, set a switch in its commands and give the event a later page for it (Create breakable here does this, with rubble).'),
    ];
  }

  /* ------------------------------------------------------------ event */

  /** Width and height in tiles; the event can't grow over another event or off the map. */
  private eventSize(ev: EventData): HTMLElement {
    const s = this.store;
    const set = (w: number, hgt: number) => {
      const next = { ...ev, w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(hgt)) };
      if (!s.eventFits(next, ev.id)) { toast('It doesn’t fit: it would leave the map or overlap another event.', 'error'); s.emit('selection'); return; }
      this.edit(() => {
        if (next.w > 1) ev.w = next.w; else delete ev.w;
        if (next.h > 1) ev.h = next.h; else delete ev.h;
      }, true);
    };
    return h('div', { class: 'field-row' },
      field('Width (tiles)', numberInput(eventW(ev), (v) => set(v, eventH(ev)), { min: '1', step: '1' })),
      field('Height (tiles)', numberInput(eventH(ev), (v) => set(eventW(ev), v), { min: '1', step: '1' })));
  }

  /** Copy an event to the first free spot beside it (right, then below, left, above). */
  private duplicate(ev: EventData): void {
    const s = this.store, w = eventW(ev), hgt = eventH(ev);
    s.copyEvent(ev.id);
    for (const [dx, dz] of [[w, 0], [0, hgt], [-w, 0], [0, -hgt]]) {
      if (s.eventFits({ x: ev.x + dx, z: ev.z + dz, w, h: hgt })) { s.pasteEvent(ev.x + dx, ev.z + dz); return; }
    }
    toast('No room right beside it. Select a tile and use Paste instead.', 'error');
  }

  /** The event window (pages, settings and commands), while it's open. */
  private eventWin: { id: number; body: HTMLElement; close: () => void } | null = null;
  /** A copied event page (to paste into this or another event). */
  private pageClip: EventPage | null = null;

  /** The side panel for an event: its name and size, and the button to open its editor window. */
  private event(ev: EventData): HTMLElement[] {
    const s = this.store;
    const del = () => confirmModal('Delete event?', `“${ev.name}” and all its pages will be removed. You can undo this.`, 'Delete', () => {
      this.edit(() => { s.map.events.splice(s.map.events.indexOf(ev), 1); s.select(null); }, true);
    }, true);
    const triggerName = (p: EventPage) => p.enemy !== undefined ? 'enemy' : p.breakable ? 'breakable' : TRIGGERS.find(([k]) => k === p.trigger)?.[1] ?? p.trigger;
    return [
      this.header(ev.name, s.inMap(ev.x, ev.z) ? `Event ${ev.id} · ${ev.x}, ${ev.z}${eventW(ev) > 1 || eventH(ev) > 1 ? ` · ${eventW(ev)} × ${eventH(ev)} tiles` : ''}` : `Event ${ev.id} · off map`, del),
      field('Name', textInput(ev.name, (v) => this.edit(() => (ev.name = v.trim() || ev.name), true))),
      s.inMap(ev.x, ev.z) ? this.eventSize(ev) : h('span', { hidden: true }),
      h('button', { type: 'button', class: 'btn primary wide-btn', onclick: () => this.openEventWindow(ev) }, 'Edit event (pages and commands)…'),
      h('ol', { class: 'ev-page-sum' }, ...ev.pages.map((p, k) => h('li', {},
        h('b', {}, `Page ${k + 1}`), ` · ${triggerName(p)} · ${p.commands.length} command${p.commands.length === 1 ? '' : 's'}${p.condition ? ` · when ${conditionText(p.condition)}` : ''}`))),
      h('div', { class: 'stack row' },
        h('button', { type: 'button', class: 'btn small', title: 'Copy (Ctrl+C)', onclick: () => { s.copyEvent(ev.id); toast(`Copied “${ev.name}”. Select a tile and Paste, or press Ctrl+V over the map.`); s.emit('selection'); } }, 'Copy'),
        h('button', { type: 'button', class: 'btn small', title: 'Copy and paste right next to it', onclick: () => this.duplicate(ev) }, 'Duplicate')),
      h('p', { class: 'hint' }, 'Double-click an event on the map to open its editor too.'),
    ];
  }

  /** Open the event editor window (like RPG Maker's): page tabs on top, settings on the left, commands on the right. */
  openEventWindow(ev: EventData): void {
    this.eventWin?.close();
    const body = h('div', { class: 'ev-window' });
    const close = openModal(`Event: ${ev.name}`, body, [{ label: 'Close', primary: true }], undefined, { wide: true });
    const wrapped = () => { this.eventWin = null; close(); };
    this.eventWin = { id: ev.id, body, close: wrapped };
    // Closing by ✕, Esc or the button: forget it.
    const overlay = body.closest('.overlay');
    const obs = new MutationObserver(() => { if (!overlay?.isConnected) { if (this.eventWin?.body === body) this.eventWin = null; obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    body.closest('.modal')?.classList.add('ev-modal');
    this.drawEventWindow();
  }

  private drawEventWindow(): void {
    const w = this.eventWin;
    if (!w) return;
    const ev = this.store.event(w.id);
    if (!ev) { w.close(); return; }
    const cmdScroll = w.body.querySelector('.ev-commands')?.scrollTop ?? 0, setScroll = w.body.querySelector('.ev-settings')?.scrollTop ?? 0;
    w.body.replaceChildren(...this.eventEditor(ev));
    const title = w.body.closest('.modal')?.querySelector('.modal-head h2');
    if (title) title.textContent = `Event: ${ev.name}`;
    const c = w.body.querySelector('.ev-commands'), st = w.body.querySelector('.ev-settings');
    if (c) c.scrollTop = cmdScroll;
    if (st) st.scrollTop = setScroll;
  }

  private eventEditor(ev: EventData): HTMLElement[] {
    const s = this.store;
    const pi = Math.min(s.pageIndex, ev.pages.length - 1);
    const page = ev.pages[pi];
    const del = () => confirmModal('Delete event?', `“${ev.name}” and all its pages will be removed. You can undo this.`, 'Delete', () => {
      this.edit(() => { s.map.events.splice(s.map.events.indexOf(ev), 1); s.select(null); }, true);
    }, true);

    const pageTabs = h('div', { class: 'page-tabs', role: 'tablist' },
      ...ev.pages.map((p, k) => h('button', { type: 'button', role: 'tab', class: 'page-tab', 'aria-selected': String(k === pi),
        title: p.condition ? `Active when ${conditionText(p.condition)}` : 'Always active',
        onclick: () => { s.pageIndex = k; this.render(); this.drawEventWindow(); } }, `Page ${k + 1}`)),
      h('button', { type: 'button', class: 'page-tab add', title: 'Add a page', onclick: () => this.edit(() => {
        ev.pages.push({ ...JSON.parse(JSON.stringify(page)) as EventPage, condition: { switch: '', is: true }, commands: [] });
        s.pageIndex = ev.pages.length - 1;
      }, true) }, '+ Page'));

    const pageTools = h('div', { class: 'page-tools' },
      h('button', { type: 'button', class: 'btn small', title: 'Copy this page, to paste here or into another event', onclick: () => { this.pageClip = JSON.parse(JSON.stringify(page)) as EventPage; toast(`Copied page ${pi + 1}`); this.drawEventWindow(); } }, 'Copy page'),
      h('button', { type: 'button', class: 'btn small', disabled: !this.pageClip, title: 'Paste the copied page after this one', onclick: () => this.edit(() => {
        ev.pages.splice(pi + 1, 0, JSON.parse(JSON.stringify(this.pageClip)) as EventPage); s.pageIndex = pi + 1;
      }, true) }, 'Paste page'),
      h('button', { type: 'button', class: 'btn small', onclick: () => this.edit(() => {
        ev.pages.splice(pi + 1, 0, JSON.parse(JSON.stringify(page)) as EventPage); s.pageIndex = pi + 1;
      }, true) }, 'Duplicate page'),
      h('button', { type: 'button', class: 'btn small danger', disabled: ev.pages.length < 2, onclick: () => this.edit(() => {
        ev.pages.splice(pi, 1); s.pageIndex = Math.max(0, pi - 1);
      }, true) }, 'Delete page'));

    const enemies = (s.db.enemies ?? []).map((d) => [d.id, d.name] as [string, string]);
    const appearance = page.enemy ? 'enemy' : page.character ? 'character' : page.sprite ? 'sprite' : 'none';
    const chars = Object.entries(s.db.characters).map(([k, c]) => [k, c.name] as [string, string]);
    const lookControls: HTMLElement[] = [
      field('Appearance', select([['none', 'Invisible'], ['character', 'Character'], ['sprite', 'Object sprite'], ['enemy', 'Enemy']], appearance, (v) => this.edit(() => {
        delete page.character; delete page.sprite; delete page.enemy;
        if (v === 'enemy') { page.enemy = enemies[0]?.[0] ?? ''; page.trigger = 'none'; delete page.solid; }
        if (v === 'character') page.character = chars[0]?.[0];
        if (v === 'sprite') page.sprite = 'sign';
      }, true))),
    ];
    if (page.enemy !== undefined) {
      const opts = enemies.length ? [...enemies] : [['', '(no enemies yet: add some in Database → Enemies)'] as [string, string]];
      if (page.enemy && !opts.some(([id]) => id === page.enemy)) opts.unshift([page.enemy, `${page.enemy} (missing)`]);
      lookControls.push(field('Enemy', select(opts, page.enemy, (v) => this.edit(() => (page.enemy = v)))),
        h('p', { class: 'hint' }, 'It fights instead of talking. The commands below run when it’s defeated (open a gate, set a switch). Beaten enemies come back when the player returns to the map; for one that stays beaten, set a switch here and give the event a later page for it.'));
    } else if (page.character) {
      lookControls.push(h('div', { class: 'field-row' },
        field('Character', select(chars, page.character, (v) => this.edit(() => (page.character = v)))),
        field('Facing', select(DIRS, page.dir ?? 'down', (v) => this.edit(() => (page.dir = v as Dir))))));
      lookControls.push(checkbox('Turn to face the player', !!page.facePlayer, (v) => this.edit(() => (page.facePlayer = v || undefined))));
    } else if (page.sprite) {
      const sprites = paletteProps().map((d) => [d.id, d.name] as [string, string]);
      if (!sprites.some(([id]) => id === page.sprite)) sprites.unshift([page.sprite, `${page.sprite} (missing)`]);
      lookControls.push(field('Sprite', select(sprites, page.sprite, (v) => this.edit(() => (page.sprite = v)))));
    }

    const names = s.knownNames();
    void del;
    return [
      h('div', { hidden: true },
        h('datalist', { id: 'dl-switches' }, ...names.switches.map((n) => h('option', { value: n }))),
        h('datalist', { id: 'dl-vars' }, ...names.vars.map((n) => h('option', { value: n })))),
      h('div', { class: 'ev-top' },
        field('Name', textInput(ev.name, (v) => this.edit(() => (ev.name = v.trim() || ev.name), true))),
        pageTools),
      pageTabs,
      h('div', { class: 'ev-grid' },
        h('div', { class: 'ev-settings' },
          h('div', { class: 'section-label' }, 'Condition'),
          conditionForm(page.condition, (c) => this.edit(() => (page.condition = c)), true, () => this.edit(() => delete page.condition, true)),
          ev.pages.length > 1 ? h('p', { class: 'hint' }, 'The last page whose condition is met is the one that runs.') : null,
          h('div', { class: 'section-label' }, 'Appearance'),
          ...lookControls,
          ...(page.enemy !== undefined ? [] : [
            h('div', { class: 'section-label' }, 'Behaviour'),
            checkbox('Breakable: the player can lock on and hit it; the commands run when it breaks', !!page.breakable, (v) => this.edit(() => {
              if (v) { page.breakable = { hp: 20 }; page.trigger = 'none'; page.solid = true; } else delete page.breakable;
            }, true)),
            ...(page.breakable ? this.breakableFields(page.breakable) : [field('Trigger', select(TRIGGERS, page.trigger, (v) => this.edit(() => (page.trigger = v as Trigger), true)))]),
            checkbox('Solid (blocks the player)', !!page.solid, (v) => this.edit(() => (page.solid = v || undefined))),
            ...(page.sprite || page.character ? [checkbox('Flat against the wall behind it (cave mouths, doors, banners)', page.wall ?? (page.sprite ? !!s.catalog.get(page.sprite)?.wall : false), (v) => this.edit(() => {
              const dflt = page.sprite ? !!s.catalog.get(page.sprite)?.wall : false;
              if (v === dflt) delete page.wall; else page.wall = v;
            }))] : []),
            page.trigger === 'touch' ? h('p', { class: 'hint' }, 'Player touch runs when the player steps onto it, or walks into it when they can’t step there (it’s solid, or it’s up on a cliff, like a cave mouth on the wall).') : null,
            checkbox('Is respawn point (after losing all health, the player comes back here)', !!page.respawn, (v) => this.edit(() => (page.respawn = v || undefined)))])),
        h('div', { class: 'ev-commands' },
          h('div', { class: 'section-label' }, page.enemy !== undefined ? 'When defeated' : page.breakable ? 'When it breaks' : 'Commands'),
          this.commands.render(page.commands),
          h('p', { class: 'hint' }, 'Click a command to highlight it, double-click to edit. Drag to move it (into a choice or condition too), or use ↑ ↓. Ctrl+C / Ctrl+X / Ctrl+V copy, cut and paste (below the highlighted one, even in another event), Ctrl+D duplicates, Delete removes.'))),
    ];
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const HIT_KINDS: ['melee' | 'bow' | 'magic', string][] = [['melee', 'Melee'], ['bow', 'Arrows'], ['magic', 'Magic']];
