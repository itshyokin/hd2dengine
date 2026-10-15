/** Left panel: layer tabs, tools, brush options and the swatch / sprite palette. */
import { cliffChoices, deleteProp, deleteTile, mapCliffName, resetProp, setTileAilment, setTileCliff, setTileRoad, setTileSteps } from './assets';
import { AILMENTS, AILMENT_INFO } from '../game/status';
import type { Ailment } from '../world/types';
import { FOOT_MATERIALS, guessFootstep } from '../world/footsteps';
import { isBuiltinProp } from '../world/props';
import { canvasCopy, checkbox, confirmModal, h, numberInput, select } from './dom';
import { characterImage, paletteProps, propImage, tileNote, tileThumb } from './editorArt';
import { openTileImporter } from './TileImporter';
import { openBlendSettings } from './BlendSettings';
import type { TileDef } from '../world/types';
import { LIGHT_PRESETS } from './lightPresets';
import { openPropImporter } from './PropImporter';
import { openLpcLibrary } from './LpcLibrary';
import type { BuildingTool, EditorStore, HeightTool, LightType, Mode, ObjectTool, TerrainTool } from './store';
import type { WaterKind } from '../world/heights';
import type { FishZone, WaterStyle } from '../world/types';
import { WATER_PRESETS, WATER_SYMBOLS, waterStyles } from '../world/waterStyles';
import { defaultZone } from '../world/fishing';
import { PASSAGE_FLAGS, type PassageFlag } from '../world/passage';
import { passageThumb } from './passageIcons';
import { WEEKDAY_SHORT, ZONE_LETTERS, zoneColor } from '../world/zones';
import { ABILITIES } from '../world/types';
import { ABILITY_NAMES } from './CommandEditor';
import { MAX_HEIGHT, MIN_HEIGHT } from '../world/heights';
import { BUILDING_PRESETS, drawBuildingTop } from './buildingPresets';
import { TS } from './editorArt';

const MODES: [Mode, string, string][] = [
  ['terrain', 'Terrain', '1'], ['height', 'Height', '2'], ['passage', 'Passage', '3'], ['props', 'Props', '4'], ['lights', 'Lights', '5'], ['events', 'Events', '6'], ['buildings', 'Buildings', '7'], ['water', 'Water', '8'], ['zones', 'Spawns', '9'],
];
const TERRAIN_TOOLS: [TerrainTool, string, string][] = [['pencil', 'Pencil', 'B'], ['rect', 'Rectangle', 'R'], ['fill', 'Fill', 'G']];
const PROP_TOOLS: [ObjectTool, string, string][] = [['place', 'Place', 'P'], ['scatter', 'Scatter', 'S'], ['select', 'Select', 'V'], ['erase', 'Erase', 'E']];
const HEIGHT_TOOLS: [HeightTool, string, string][] = [['raise', 'Raise', 'R'], ['lower', 'Lower', 'L'], ['set', 'Set', 'S'], ['fill', 'Fill', 'G'], ['ramp', 'Ramp', 'A']];
const BUILDING_TOOLS: [BuildingTool, string, string][] = [['draw', 'Draw', 'D'], ['select', 'Select', 'V']];
const LIGHT_TOOLS: [ObjectTool, string, string][] = [['place', 'Place', 'P'], ['select', 'Select', 'V'], ['erase', 'Erase', 'E']];

export const MODE_HINTS: Record<string, string> = {
  'terrain:pencil': 'Click and drag to paint. Brush size changes the footprint.',
  'terrain:rect': 'Drag to fill a rectangle.',
  'terrain:fill': 'Click to fill a connected area of the same terrain.',
  'height:raise': 'Click or drag to raise the ground one step (half a tile). Each cell rises once per stroke.',
  'height:lower': 'Click or drag to lower the ground one step. Go below 0 for pits and riverbeds.',
  'height:set': 'Click or drag to set the ground to the chosen height.',
  'water:fill': 'Paint bucket: click inside a hollow (or on water) to fill the connected area that matches it, in the chosen style.',
  'water:paint': 'Click or drag to paint water at this level and style. Cells whose ground is at or above the level stay dry.',
  'water:remove': 'Drag over water to remove it.',
  'water:style': 'Click a pool (or river): all of its connected water takes the chosen style.',
  'water:fish': 'Paint fishing spots over water (Erase removes them). Each spot has its own list of catches.',
  'height:ramp': 'Click a cell for a ramp or stairs. It rises toward the neighbour one step higher. Click an existing one to select it. E erases.',
  'passage:paint': 'Click or drag to paint the chosen flag; Erase clears it. Red crosses show what already blocks (tiles, props, deep water).',
  'zones:paint': 'Click or drag to paint the chosen encounter zone; Erase clears it. Each zone has its own troops (below the letters).',
  'props:place': 'Click or drag to place, one prop per tile (placing on a taken tile replaces its prop). Turn off “Snap to tiles” for free placement.',
  'props:scatter': 'Drag to scatter props naturally, with varied sizes.',
  'props:select': 'Click a prop to select it, drag to move. Delete removes it.',
  'props:erase': 'Click or drag over props to remove them.',
  'lights:place': 'Click a tile to place a light, one per tile. For area lights, drag to draw the area (areas may overlap).',
  'lights:select': 'Click a light to select it, drag to move. Drag an area’s corner handle to resize it.',
  'lights:erase': 'Click a light to remove it.',
  'buildings:draw': 'Drag out a footprint to build (a click places the preset at its own size). Click a building to select and move it.',
  'buildings:select': 'Click a building to select it, drag to move. Drag the corner handle to resize. Delete removes it.',
  'events:select': 'Click a tile or event to select it; drag events to move them. Drag across empty tiles to select an area for one big event. Ctrl+C / Ctrl+V copy and paste events.',
};

export class Palette {
  readonly el: HTMLElement;

  constructor(private readonly store: EditorStore, private readonly onFocusEvent: (id: number) => void) {
    this.el = h('aside', { class: 'side left', 'aria-label': 'Tools and palette' });
    store.on('ui', () => this.render());
    store.on('structure', () => this.render());
    store.on('selection', () => { if (store.mode === 'events' || store.mode === 'buildings') this.render(); });
    this.render();
  }

  render(): void {
    const s = this.store;
    if (!s.map) return;
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, ...MODES.map(([m, label, key]) =>
      h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(s.mode === m), title: `${label} (${key})`, onclick: () => { s.mode = m; s.select(null); s.emit('ui'); } }, label)));

    const body: Node[] = [];
    if (s.mode === 'terrain') {
      const blendSummary = (key: string) => { const b = s.tiles.blendFor(key); return b.blend ? `priority ${Math.round(b.priority)}` : 'off'; };
      body.push(this.tools(TERRAIN_TOOLS, s.terrainTool, (t) => (s.terrainTool = t)));
      if (s.terrainTool === 'pencil') body.push(this.brush());
      const tiles = s.tiles.all();
      const editTile = (key: string) => { const d = s.tiles.get(key); if (d) void openTileImporter(s, d); };
      const cur = s.tiles.get(s.terrain);
      const cliffField = (key: string) => {
        const choice = s.tiles.cliffChoice(key) ?? '';
        const sel = select([['', `Map default (${mapCliffName(s)})`], ...cliffChoices(s)], choice, (v) => void setTileCliff(s, key, v || undefined),
          { 'aria-label': 'Cliff walls under this tile' });
        return h('div', { class: 'cliff-field' }, h('span', { class: 'swatch-note' }, 'Cliff walls under it'), sel);
      };
      const stepsField = (key: string) => {
        const guess = FOOT_MATERIALS.find(([m]) => m === guessFootstep(s.tiles.get(key)))?.[1] ?? '';
        const sel = select([['', `Automatic (${guess.split(',')[0].toLowerCase()})`], ...FOOT_MATERIALS], s.tiles.footstepChoice(key) ?? '', (v) => void setTileSteps(s, key, v || undefined),
          { 'aria-label': 'Footsteps on this tile' });
        return h('div', { class: 'cliff-field' }, h('span', { class: 'swatch-note' }, 'Footsteps'), sel);
      };
      const ailmentField = (key: string) => {
        const cur = s.tiles.ailment(key);
        const chance = numberInput(cur?.chance ?? 100, (v) => { const c = s.tiles.ailment(key); if (c) void setTileAilment(s, key, { ...c, chance: Math.max(1, Math.min(100, Math.round(v))) }); },
          { step: 5, min: 1, max: 100, 'aria-label': 'Chance each half second', class: 'tile-ail-chance' });
        chance.hidden = !cur;
        const sel = select([['', 'Nothing'], ...AILMENTS.map((a) => [a, AILMENT_INFO[a].name] as [string, string])], cur?.ailment ?? '',
          (v) => { void setTileAilment(s, key, v ? { ailment: v as Ailment, chance: s.tiles.ailment(key)?.chance ?? 100 } : undefined); chance.hidden = !v; },
          { 'aria-label': 'Ailment while standing on this tile' });
        const f = h('div', { class: 'cliff-field' }, h('span', { class: 'swatch-note' }, 'Standing on it gives'), h('div', { class: 'el-pick' }, sel, chance));
        f.title = 'Lava that burns, a swamp that poisons, cursed ground… The chance (%) is rolled every half second while the hero stands on it.';
        return f;
      };
      const roadField = (key: string) => {
        const c = checkbox('Is road (continues past the map edge)', s.tiles.isRoad(key), (v) => void setTileRoad(s, key, v));
        c.title = 'Where this tile touches the map edge, it carries on straight out: through the scenery, a gap in cliffs, or a causeway over water.';
        return c;
      };
      if (cur?.builtin) {
        body.push(h('div', { class: 'prop-current' },
          h('span', { class: 'prop-current-thumb' }, tileThumb(cur.key, 40)),
          h('div', { class: 'prop-current-info' }, h('div', { class: 'prop-current-name' }, cur.name), h('div', { class: 'swatch-note' }, `Built-in · ${tileNote(cur)}`)),
          h('div', { class: 'prop-current-actions' }, cliffField(cur.key), stepsField(cur.key), ailmentField(cur.key), roadField(cur.key),
            h('button', { type: 'button', class: 'btn small', onclick: () => openBlendSettings(s, cur.key) }, `Edge blending… (${blendSummary(cur.key)})`))));
      }
      if (cur && !cur.builtin) {
        body.push(h('div', { class: 'prop-current' },
          h('span', { class: 'prop-current-thumb' }, tileThumb(cur.key, 40)),
          h('div', { class: 'prop-current-info' },
            h('div', { class: 'prop-current-name' }, cur.name),
            h('div', { class: 'swatch-note' }, `Imported · ${tileNote(cur)} · repeats every ${cur.span} tile${cur.span === 1 ? '' : 's'}`)),
          h('div', { class: 'prop-current-actions' },
            cliffField(cur.key), stepsField(cur.key), ailmentField(cur.key), roadField(cur.key),
            h('button', { type: 'button', class: 'btn small', onclick: () => openBlendSettings(s, cur.key) }, `Edge blending… (${blendSummary(cur.key)})`),
            h('button', { type: 'button', class: 'btn small', onclick: () => editTile(cur.key) }, 'Edit…'),
            h('button', { type: 'button', class: 'btn small danger', onclick: () => confirmModal('Delete tile?',
              `“${cur.name}” will be removed from the tile list. On this map its cells turn back into grass (you can undo that). Its image files stay in your project.`,
              'Delete', () => void deleteTile(s, cur.key), true) }, 'Delete'))));
      }
      const swatch = (t: TileDef) => h('div', { class: 'swatch-row' },
        h('button', { type: 'button', class: 'swatch', 'aria-pressed': String(s.terrain === t.key), title: tileNote(t), onclick: () => { s.terrain = t.key; s.emit('ui'); } },
          tileThumb(t.key),
          h('span', { class: 'swatch-name' }, t.name),
          h('span', { class: 'swatch-note' }, tileNote(t))),
        t.builtin ? null : h('button', { type: 'button', class: 'mini-btn swatch-edit', title: `Edit ${t.name}`, 'aria-label': `Edit ${t.name}`, onclick: () => editTile(t.key) }, '✎'));
      const imported = tiles.filter((t) => !t.builtin);
      body.push(
        h('button', { type: 'button', class: 'btn import-btn', onclick: () => void openTileImporter(s) }, '+ Import tile from texture…'),
        h('button', { type: 'button', class: 'btn import-btn', onclick: () => void openLpcLibrary(s, 'tile') }, '+ Add from the LPC library…'),
        h('div', { class: 'section-label' }, 'Built-in'),
        h('div', { class: 'swatches' }, ...tiles.filter((t) => t.builtin).map(swatch)),
        h('div', { class: 'section-label' }, `Imported (${imported.length})`),
        imported.length ? h('div', { class: 'swatches' }, ...imported.map(swatch)) : h('p', { class: 'note' }, 'Tiles you import from textures appear here.'));
    } else if (s.mode === 'water') {
      body.push(...this.waterPanel());
    } else if (s.mode === 'height') {
      if (s.heightTool === 'water') s.heightTool = 'raise';
      body.push(this.tools(HEIGHT_TOOLS, s.heightTool, (t) => (s.heightTool = t)));
      if (s.heightTool !== 'ramp' && s.heightTool !== 'fill') body.push(this.brush());
      if (s.heightTool === 'fill') {
        const setting = s.heightFillMode === 'set';
        const val = setting ? s.heightValue : s.heightFillBy;
        const out = h('output', { class: 'height-out' }, String(val));
        const slider = h('input', { type: 'range', min: setting ? String(MIN_HEIGHT) : '1', max: setting ? String(MAX_HEIGHT) : '10', step: '1', value: String(val), 'aria-label': setting ? 'Height to fill with' : 'Steps',
          oninput: () => { const v = parseInt(slider.value, 10); if (setting) s.heightValue = v; else s.heightFillBy = v; out.textContent = String(v); },
          onchange: () => s.emit('ui') });
        body.push(
          h('div', { class: 'toolrow small' }, ...(['set', 'raise', 'lower'] as const).map((md) =>
            h('button', { type: 'button', class: 'tool', 'aria-pressed': String(s.heightFillMode === md), onclick: () => { s.heightFillMode = md; s.emit('ui'); } },
              { set: 'Set to', raise: 'Raise by', lower: 'Lower by' }[md]))),
          h('div', { class: 'height-set' }, h('span', { class: 'section-label' }, setting ? 'Height' : 'Steps'), slider, out),
          h('p', { class: 'note' }, 'Click a cell: every connected cell at the same height as it changes together (a whole wall, a whole floor, a plateau), up to where the height changes. Undo (Ctrl+Z) puts it back.'));
      }
      if (s.heightTool === 'set') {
        const out = h('output', { class: 'height-out' }, String(s.heightValue));
        const slider = h('input', { type: 'range', min: String(MIN_HEIGHT), max: String(MAX_HEIGHT), step: '1', value: String(s.heightValue), 'aria-label': 'Height to set',
          oninput: () => { s.heightValue = parseInt(slider.value, 10); out.textContent = String(s.heightValue); },
          onchange: () => s.emit('ui') });
        body.push(h('div', { class: 'height-set' }, h('span', { class: 'section-label' }, 'Height'), slider, out),
          h('div', { class: 'presets' }, ...[-4, -2, 0, 2, 4, 6].map((v) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(s.heightValue === v), onclick: () => { s.heightValue = v; s.emit('ui'); } }, v > 0 ? `+${v}` : String(v)))));
      }
      if (s.heightTool === 'ramp') {
        body.push(h('div', { class: 'toolrow' }, ...(['place', 'erase'] as const).map((m) =>
          h('button', { type: 'button', class: 'tool', 'aria-pressed': String(s.rampTool === m), title: m === 'place' ? 'Place (A)' : 'Erase (E)',
            onclick: () => { s.rampTool = m; s.emit('ui'); } }, m === 'place' ? 'Place' : 'Erase'))));
        if (s.rampTool === 'place') body.push(h('div', { class: 'section-label' }, 'Style'),
          h('div', { class: 'toolrow' }, ...(['stairs', 'ramp'] as const).map((st) =>
            h('button', { type: 'button', class: 'tool', 'aria-pressed': String(s.rampStyle === st), onclick: () => { s.rampStyle = st; s.emit('ui'); } }, st === 'stairs' ? 'Stairs' : 'Ramp'))));
        body.push(h('p', { class: 'note' }, s.rampTool === 'erase'
          ? 'Click or drag over ramps and stairs to remove them.'
          : 'Place it on the lower cell, next to ground one step higher. For taller climbs, chain several in a row, each one step higher than the last. A red cross means it has no higher neighbour to rise to: switch to Erase to remove it.'));
        const broken = s.brokenRamps();
        if (broken.length) body.push(h('button', { type: 'button', class: 'btn danger small', style: 'white-space: normal; max-width: 100%', onclick: () => {
          s.checkpoint();
          const gone = new Set(broken);
          s.map.ramps = (s.map.ramps ?? []).filter((r) => !gone.has(r));
          if (s.selection?.kind === 'ramp' && !s.rampAt(s.selection.x, s.selection.z)) s.selection = null;
          s.changed('structure');
        } }, `Remove ${broken.length} broken ramp${broken.length === 1 ? '' : 's'} (red ✕)`));
      }
      body.push(h('p', { class: 'note' }, 'Heights go from −10 to 10; one step is half a tile. Cliff walls appear wherever neighbouring cells differ. The player can’t walk up or down a cliff, only ramps and stairs, but can jump up one step, and climb walls marked Climbable on the Passage layer.'));
    } else if (s.mode === 'zones') {
      body.push(...this.zonesPanel());
    } else if (s.mode === 'passage') {
      const flagBtn = (key: PassageFlag, name: string, note: string, shortcut: string) =>
        h('button', { type: 'button', class: 'swatch passage-swatch', 'aria-pressed': String(s.passageFlag === key), title: `${name} (${shortcut})`, onclick: () => { s.passageFlag = key; s.emit('ui'); } },
          passageThumb(key), h('span', { class: 'swatch-name' }, name), h('span', { class: 'swatch-note' }, note));
      body.push(this.brush(),
        h('div', { class: 'section-label' }, 'Paint'),
        h('div', { class: 'swatches' },
          ...PASSAGE_FLAGS.map((f) => flagBtn(f.key, f.name, f.note, f.key.toUpperCase())),
          flagBtn('.', 'Erase', 'Back to normal: the tile, props and heights decide.', 'E')),
        h('p', { class: 'note' }, 'Climbable goes on either side of a cliff (top or bottom cell). The player climbs by walking into the wall.'));
      // Abilities are for the whole game (saved in the database), not this map.
      const NOTES: Record<string, string> = {
        run: 'Hold Shift (Run button on touch screens).',
        jump: 'C (Jump button): up one step, or across a one-tile gap.',
        climb: 'Walk into a climbable wall.',
        crawl: 'Walk into a low-clearance cell.',
      };
      body.push(h('div', { class: 'section-label' }, 'Player abilities at the start'),
        h('div', { class: 'abilities-list' }, ...ABILITIES.map((a) => h('div', { class: 'ability-row' },
          checkbox(ABILITY_NAMES[a], s.db.abilities?.[a] ?? true, (v) => {
            s.checkpoint();
            const ab = (s.db.abilities ??= {});
            if (v) delete ab[a]; else ab[a] = false;
            if (!Object.keys(ab).length) delete s.db.abilities;
            s.changedDb();
          }),
          h('span', { class: 'swatch-note' }, NOTES[a])))),
        h('p', { class: 'note' }, 'Turn one off to unlock it later with the “Change ability” event command (climbing gloves, a crawl-through-vents skill…).'));
    } else if (s.mode === 'props') {
      body.push(this.tools(PROP_TOOLS, s.propTool, (t) => (s.propTool = t)));
      if (s.propTool === 'scatter') body.push(this.brush());
      body.push(checkbox('Snap to tiles', s.snap, (v) => { s.snap = v; s.emit('ui'); }));
      const defs = paletteProps();
      const edit = (id: string) => { const d = s.catalog.get(id); if (d) void openPropImporter(s, d); };
      const remove = (id: string, name: string) => confirmModal('Delete prop?',
        `“${name}” will be removed from the prop list and from this map. Its image files stay in your project.`, 'Delete', () => void deleteProp(s, id), true);
      const reset = (id: string, name: string) => confirmModal('Reset to original?',
        `“${name}” goes back to the built-in art and settings, everywhere it’s placed.`, 'Reset', () => void resetProp(s, id));
      const customised = (id: string) => isBuiltinProp(id) && !!s.catalog.get(id)?.image;

      // The selected prop, with its actions always in view.
      const cur = s.catalog.get(s.propType);
      if (cur) {
        const builtin = isBuiltinProp(cur.id);
        body.push(h('div', { class: 'prop-current' },
          h('span', { class: 'prop-current-thumb' }, spriteThumb(propImage(cur.id), 40, 40)),
          h('div', { class: 'prop-current-info' },
            h('div', { class: 'prop-current-name' }, cur.name),
            h('div', { class: 'swatch-note' }, `${builtin ? (customised(cur.id) ? 'Built-in, customised' : 'Built-in') : 'Imported'} · ${fmtTiles(cur.w)} × ${fmtTiles(cur.h)} tiles`)),
          h('div', { class: 'prop-current-actions' },
            h('button', { type: 'button', class: 'btn small', onclick: () => edit(cur.id) }, builtin && !customised(cur.id) ? 'Customise…' : 'Edit…'),
            customised(cur.id) ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => reset(cur.id, cur.name) }, 'Reset to original') : null,
            !builtin ? h('button', { type: 'button', class: 'btn small danger', onclick: () => remove(cur.id, cur.name) }, 'Delete') : null)));
      }

      const card = (id: string, name: string, lit: boolean) => {
        const pick = () => { s.propType = id; if (s.propTool === 'select' || s.propTool === 'erase') s.propTool = 'place'; s.emit('ui'); };
        return h('div', { class: 'sprite-card' },
          h('button', { type: 'button', class: 'sprite-btn', 'aria-pressed': String(s.propType === id), title: name, onclick: pick },
            h('span', { class: 'sprite-frame' }, spriteThumb(propImage(id))),
            h('span', { class: 'sprite-name' }, name),
            lit ? h('span', { class: 'sprite-badge', title: 'Carries a light' }, '✦') : null,
            customised(id) ? h('span', { class: 'sprite-badge left', title: 'Customised' }, '●') : null),
          h('button', { type: 'button', class: 'mini-btn sprite-edit', title: `Edit ${name}`, 'aria-label': `Edit ${name}`, onclick: () => edit(id) }, '✎'));
      };
      const builtins = defs.filter((d) => isBuiltinProp(d.id)), imported = defs.filter((d) => !isBuiltinProp(d.id));
      body.push(
        h('button', { type: 'button', class: 'btn import-btn', onclick: () => void openPropImporter(s) }, '+ Import prop from image…'),
        h('button', { type: 'button', class: 'btn import-btn', onclick: () => void openLpcLibrary(s, 'prop') }, '+ Add from the LPC library…'),
        h('div', { class: 'section-label' }, 'Built-in'),
        h('div', { class: 'sprites' }, ...builtins.map((d) => card(d.id, d.name, !!d.light))));
      body.push(h('div', { class: 'section-label' }, `Imported (${imported.length})`),
        imported.length
          ? h('div', { class: 'sprites' }, ...imported.map((d) => card(d.id, d.name, !!d.light)))
          : h('p', { class: 'note' }, 'Props you import from images appear here.'));
    } else if (s.mode === 'lights') {
      body.push(this.tools(LIGHT_TOOLS, s.lightTool, (t) => (s.lightTool = t)));
      const TYPES: [LightType, string, string][] = [
        ['point', 'Point', 'Shines in every direction: torches, lamps, magic.'],
        ['spot', 'Spotlight', 'A beam facing up, down, left or right, like a flashlight.'],
        ['area', 'Area', 'Tints or shades everything inside a shape, fading at the edge.'],
      ];
      body.push(h('div', { class: 'section-label' }, 'Light type'),
        h('div', { class: 'swatches' }, ...TYPES.map(([t, name, note]) =>
          h('button', { type: 'button', class: 'swatch light-swatch', 'aria-pressed': String(s.lightType === t),
            onclick: () => { s.lightType = t; s.lightTool = 'place'; s.emit('ui'); } },
            h('span', { class: `light-icon ${t}`, 'aria-hidden': 'true' }),
            h('span', { class: 'swatch-name' }, name),
            h('span', { class: 'swatch-note' }, note)))),
        h('div', { class: 'section-label' }, 'Preset for new lights'),
        h('div', { class: 'presets' }, ...LIGHT_PRESETS[s.lightType].map((p) =>
          h('button', { type: 'button', class: 'chip', 'aria-pressed': String(s.lightPreset[s.lightType] === p),
            onclick: () => { s.lightPreset[s.lightType] = p; s.lightTool = 'place'; s.emit('ui'); } },
            h('span', { class: 'chip-dot', style: `background:${p.values.color}` }), p.name))),
        h('p', { class: 'note' }, 'Campfires and torches are props now: place them from the Props layer and their light comes with them.'));
    } else if (s.mode === 'buildings') {
      body.push(this.tools(BUILDING_TOOLS, s.buildingTool, (t) => (s.buildingTool = t)));
      body.push(h('div', { class: 'section-label' }, 'Preset for new buildings'),
        h('div', { class: 'sprites' }, ...BUILDING_PRESETS.map((p) =>
          h('div', { class: 'sprite-card' }, h('button', { type: 'button', class: 'sprite-btn', 'aria-pressed': String(s.buildingPreset === p.id), title: p.note,
            onclick: () => { s.buildingPreset = p.id; s.buildingTool = 'draw'; s.emit('ui'); } },
            h('span', { class: 'sprite-frame' }, buildingThumb(p.id)), h('span', { class: 'sprite-name' }, p.name))))),
        h('p', { class: 'note' }, 'Change the walls, roof, height, doors and windows of a selected building on the right. Buildings block their tiles. For an interior, make a new map and put a Transfer event in front of the door (the building’s panel can add one).'));
      const list = s.map.buildings ?? [];
      if (list.length)
        body.push(h('div', { class: 'section-label' }, `Buildings on this map (${list.length})`),
          h('ul', { class: 'event-list' }, ...list.map((b, i) => h('li', {}, h('button', { type: 'button', class: 'event-item',
            'aria-pressed': String(s.selection?.kind === 'building' && s.selection.index === i), onclick: () => s.select({ kind: 'building', index: i }) },
            h('span', { class: 'ev-name' }, b.name || BUILDING_PRESETS.find((p) => p.values.wall === b.wall && p.values.roof === b.roof)?.name || 'Building'),
            h('span', { class: 'ev-pos' }, `${b.x}, ${b.z} · ${b.w}×${b.d}`))))));
    } else {
      body.push(h('p', { class: 'note' }, 'Click an empty tile to create an event or move the player start there. Drag across tiles for one event covering an area (wide doorways). Ctrl+C / Ctrl+V copy and paste events.'));
      const hero = s.db.characters[s.db.player];
      body.push(h('div', { class: 'section-label' }, `Events on this map (${s.map.events.length})`),
        h('ul', { class: 'event-list' },
          s.startHere && hero ? h('li', {}, h('button', { type: 'button', class: 'event-item', 'aria-pressed': String(s.selection?.kind === 'start'),
            onclick: () => { s.select({ kind: 'start' }); this.onFocusEvent(-1); } },
            canvasCopy(characterImage(s.db.player, hero), 'mini'), h('span', {}, 'Player start'))) : null,
          ...s.map.events.map((ev) => {
            const onMap = s.inMap(ev.x, ev.z);
            const sel = s.selection?.kind === 'event' && s.selection.id === ev.id;
            return h('li', {}, h('button', { type: 'button', class: 'event-item', 'aria-pressed': String(sel), onclick: () => { s.select({ kind: 'event', id: ev.id }); this.onFocusEvent(ev.id); } },
              h('span', { class: 'ev-id' }, String(ev.id).padStart(3, '0')),
              h('span', { class: 'ev-name' }, ev.name),
              h('span', { class: 'ev-pos' }, onMap ? `${ev.x}, ${ev.z}${(ev.w ?? 1) > 1 || (ev.h ?? 1) > 1 ? ` · ${ev.w ?? 1}×${ev.h ?? 1}` : ''}` : 'Off map')));
          })));
    }
    body.push(checkbox('Show grid', s.showGrid, (v) => { s.showGrid = v; s.emit('ui'); }));

    this.el.replaceChildren(tabs, h('div', { class: 'side-body' }, ...body));
  }

  /**
   * The Water tab: fill, paint, remove or restyle water; its level and kind; and the map's water styles (a pond, a
   * river, the sea, lava…), each with its colour, clarity, surface, current and glow.
   */
  private waterPanel(): HTMLElement[] {
    const s = this.store, m = s.map;
    const styles = waterStyles(m);
    if (s.waterStyle >= styles.length) s.waterStyle = 0;
    // Editing a style: the map gets its own list (made from the older single look the first time).
    const editStyles = (fn: (list: WaterStyle[]) => void, rerender = true) => {
      s.checkpoint();
      if (!m.waterStyles?.length) { m.waterStyles = waterStyles(m).map((x) => ({ ...x })); delete m.waterLook; }
      fn(m.waterStyles);
      s.changed('structure');
      if (rerender) s.emit('ui');
    };
    const out = h('output', { class: 'height-out' }, String(s.waterLevel));
    const slider = h('input', { type: 'range', min: String(MIN_HEIGHT), max: String(MAX_HEIGHT), step: '1', value: String(s.waterLevel), 'aria-label': 'Water level',
      oninput: () => { s.waterLevel = parseInt(slider.value, 10); out.textContent = String(s.waterLevel); } });
    const KINDS: [WaterKind, string, string][] = [
      ['auto', 'Auto', 'Shallow if one step deep or less, otherwise swimmable.'],
      ['shallow', 'Shallow', 'Wade through it, a bit slower.'],
      ['swim', 'Swimmable', 'The player swims.'],
      ['deep', 'Deep', 'Can’t be entered: oceans, map borders.'],
    ];
    const st = styles[s.waterStyle];
    const near = (v: number, opts: number[]) => String(opts.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)));
    const set = <K extends keyof WaterStyle>(k: K, v: WaterStyle[K] | undefined, rerender = false) => editStyles((list) => {
      const x = list[s.waterStyle];
      if (v === undefined) delete x[k]; else x[k] = v;
    }, rerender);
    const color = h('input', { type: 'color', value: st.color, 'aria-label': 'Water colour' });
    color.addEventListener('change', () => set('color', color.value, true));
    const presetPick = select([['', '+ New style…'], ...WATER_PRESETS.map(([k, p]) => [k, p.name] as [string, string])], '', (v) => {
      const p = WATER_PRESETS.find(([k]) => k === v)?.[1];
      if (!p) return;
      editStyles((list) => { list.push({ ...p }); s.waterStyle = list.length - 1; });
    }, { 'aria-label': 'New water style' });
    const toolRow = h('div', { class: 'toolrow small' }, ...(['fill', 'paint', 'remove', 'style', 'fish'] as const).map((md) =>
      h('button', { type: 'button', class: 'tool', 'aria-pressed': String(s.waterMode === md), title: { fill: 'F', paint: 'P', remove: 'X', style: 'R', fish: 'G' }[md], onclick: () => { s.waterMode = md; s.emit('ui'); } },
        { fill: 'Fill basin', paint: 'Paint', remove: 'Remove', style: 'Restyle pool', fish: 'Fishing' }[md])));
    if (s.waterMode === 'fish') return [toolRow, ...this.fishPanel()];
    const parts: (HTMLElement | null)[] = [
      toolRow,
      s.waterMode === 'paint' || s.waterMode === 'remove' ? this.brush() : null,
      s.waterMode === 'remove' || s.waterMode === 'style' ? null : h('div', { class: 'height-set' }, h('span', { class: 'section-label' }, 'Level'), slider, out),
      s.waterMode === 'remove' || s.waterMode === 'style' ? null : h('div', { class: 'section-label' }, 'Type'),
      s.waterMode === 'remove' || s.waterMode === 'style' ? null : h('div', { class: 'swatches' }, ...KINDS.map(([k, name, note]) =>
        h('button', { type: 'button', class: 'swatch water-swatch', 'aria-pressed': String(s.waterKind === k), onclick: () => { s.waterKind = k; s.emit('ui'); } },
          h('span', { class: `water-icon ${k}`, 'aria-hidden': 'true' }), h('span', { class: 'swatch-name' }, name), h('span', { class: 'swatch-note' }, note)))),
      s.waterMode === 'remove' ? null : h('div', { class: 'section-label' }, 'Style'),
      s.waterMode === 'remove' ? null : h('div', { class: 'swatches' }, ...styles.map((x, i) =>
        h('button', { type: 'button', class: 'swatch water-swatch', 'aria-pressed': String(s.waterStyle === i), onclick: () => { s.waterStyle = i; s.emit('ui'); } },
          h('span', { class: 'water-dot', style: `background:${x.color}${x.glow ? `;box-shadow:0 0 6px ${x.color}` : ''}`, 'aria-hidden': 'true' }, x.symbol ?? ''),
          h('span', { class: 'swatch-name' }, x.name), h('span', { class: 'swatch-note' }, [x.flow ? 'flowing' : 'still', x.glow ? 'glows' : '', x.ailment ? AILMENT_INFO[x.ailment].name.toLowerCase() : ''].filter(Boolean).join(' · '))))),
      s.waterMode === 'remove' ? null : presetPick,
      s.waterMode === 'remove' ? null : h('div', { class: 'water-style-form' },
        h('label', { class: 'field' }, h('span', {}, 'Name'), (() => { const i = h('input', { type: 'text', value: st.name }); i.addEventListener('change', () => set('name', i.value.trim() || st.name, true)); return i; })()),
        h('label', { class: 'field' }, h('span', {}, 'Colour'), color),
        h('label', { class: 'field' }, h('span', {}, 'Editor mark'), select(WATER_SYMBOLS.map((k) => [k, k ? `${k}` : 'None'] as [string, string]), st.symbol ?? '', (v) => set('symbol', v || undefined, true), { 'aria-label': 'Mark shown on this water in the editor' })),
        h('label', { class: 'field' }, h('span', {}, 'Clarity'), select([['0', 'Crystal clear'], ['0.25', 'Clear'], ['0.5', 'Normal'], ['0.75', 'Murky'], ['1', 'Muddy / thick']], near(st.murk ?? 0.5, [0, 0.25, 0.5, 0.75, 1]), (v) => set('murk', Number(v) === 0.5 ? undefined : Number(v)))),
        h('label', { class: 'field' }, h('span', {}, 'Surface'), select([['0.3', 'Glassy'], ['0.6', 'Calm'], ['1', 'Normal'], ['1.6', 'Choppy'], ['2.2', 'Rough']], near(st.bumpy ?? 1, [0.3, 0.6, 1, 1.6, 2.2]), (v) => set('bumpy', Number(v) === 1 ? undefined : Number(v)))),
        h('label', { class: 'field' }, h('span', {}, 'Current'), select([['0', 'Still (a pond, a lake)'], ['0.12', 'Barely (lava)'], ['0.4', 'Slow'], ['1', 'A stream'], ['2', 'A fast river']], near(st.flow ?? 0, [0, 0.12, 0.4, 1, 2]), (v) => set('flow', Number(v) || undefined, true))),
        (st.flow ?? 0) > 0 ? h('label', { class: 'field' }, h('span', {}, 'Flowing towards'), select([['0', 'East →'], ['45', 'South-east ↘'], ['90', 'South ↓'], ['135', 'South-west ↙'], ['180', 'West ←'], ['225', 'North-west ↖'], ['270', 'North ↑'], ['315', 'North-east ↗']],
          near(st.flowDir ?? 0, [0, 45, 90, 135, 180, 225, 270, 315]), (v) => set('flowDir', Number(v) || undefined))) : null,
        h('label', { class: 'field' }, h('span', {}, 'Glows'), select([['0', 'No'], ['0.35', 'Faintly (goo)'], ['0.7', 'Brightly'], ['1', 'Like lava']], near(st.glow ?? 0, [0, 0.35, 0.7, 1]), (v) => set('glow', Number(v) || undefined))),
        h('label', { class: 'field' }, h('span', {}, 'Being in it gives'), select([['', 'Nothing'], ...AILMENTS.filter((a) => a !== 'zombie').map((a) => [a, AILMENT_INFO[a].name] as [string, string])], st.ailment ?? '', (v) => set('ailment', (v || undefined) as Ailment | undefined, true))),
        st.ailment ? h('label', { class: 'field' }, h('span', {}, 'Chance (% each half second)'), numberInput(st.chance ?? 100, (v) => set('chance', Math.max(1, Math.min(100, Math.round(v))) === 100 ? undefined : Math.max(1, Math.min(100, Math.round(v)))), { min: 1, max: 100, step: 5 })) : null,
        styles.length > 1 ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => {
          const used = (m.water ?? []).some((r) => r.split(/\s+/).some((t) => t.endsWith(`@${s.waterStyle}`)) || (s.waterStyle === 0 && /\d/.test(r)));
          if (used && !confirm(`Water on this map uses “${st.name}”. Delete it? That water takes the first style.`)) return;
          const gone = s.waterStyle;
          editStyles((list) => { list.splice(gone, 1); });
          // Renumber the cells: the deleted style's water takes the first, later styles move down one.
          s.checkpoint();
          s.editWater((grid) => { let any = false; for (let i = 0; i < grid.length; i++) { const c = grid[i]; if (!c?.style) continue; if (c.style === gone) { delete c.style; any = true; } else if (c.style > gone) { c.style--; any = true; } } return any; });
          s.waterStyle = 0;
          s.changed('structure');
          s.emit('ui');
        } }, 'Delete this style') : null),
      h('p', { class: 'note' }, s.waterMode === 'fill'
        ? 'Dig a hollow with Height → Lower, then click inside it: water fills every connected cell whose ground is below the level.'
        : s.waterMode === 'paint' ? 'Paint water at this level. Cells whose ground is at or above the level stay dry.'
          : s.waterMode === 'style' ? 'Click any water: its whole pool takes the chosen style. A pond and the stream running out of it can be different styles: paint the stream on its own.'
            : 'Drag over water to remove it.'),
    ];
    return parts.filter((n): n is HTMLElement => !!n);
  }

  /** Water tab → Fishing: paint fishing spots over water, each with a catch table (what bites, how often, when). */
  private fishPanel(): HTMLElement[] {
    const s = this.store, m = s.map, items = s.db.items ?? [];
    const zones = m.fishZones ?? [];
    if (s.fishZone >= zones.length) s.fishZone = Math.max(0, zones.length - 1);
    const edit = (fn: (list: FishZone[]) => void, rerender = true) => { s.checkpoint(); m.fishZones ??= []; fn(m.fishZones); if (!m.fishZones.length) delete m.fishZones; s.changed('structure'); if (rerender) s.emit('ui'); };
    const tools = h('div', { class: 'toolrow small fish-tools' },
      h('button', { type: 'button', class: 'tool', 'aria-pressed': String(!s.fishErase), onclick: () => { s.fishErase = false; s.emit('ui'); } }, 'Paint spot'),
      h('button', { type: 'button', class: 'tool', 'aria-pressed': String(s.fishErase), onclick: () => { s.fishErase = true; s.emit('ui'); } }, 'Erase'));
    const COLORS = ['#7fd0ff', '#ffd27a', '#a6f08a', '#ff9ad0', '#c8a6ff', '#ffb070'];
    const list = h('div', { class: 'swatches' }, ...zones.map((z, i) =>
      h('button', { type: 'button', class: 'swatch water-swatch', 'aria-pressed': String(s.fishZone === i), onclick: () => { s.fishZone = i; s.fishErase = false; s.emit('ui'); } },
        h('span', { class: 'water-dot', style: `background:${z.color ?? '#7fd0ff'}`, 'aria-hidden': 'true' }, '><'),
        h('span', { class: 'swatch-name' }, z.name), h('span', { class: 'swatch-note' }, `${z.fish.length} catch${z.fish.length === 1 ? '' : 'es'}`))));
    const add = h('button', { type: 'button', class: 'btn small', onclick: () => edit((l) => { l.push({ ...defaultZone(items, `Spot ${l.length + 1}`), color: COLORS[l.length % COLORS.length] }); s.fishZone = l.length - 1; s.fishErase = false; }) }, '+ New fishing spot');
    const out: HTMLElement[] = [tools, this.brush(), h('div', { class: 'section-label' }, 'Fishing spots'), list, add];
    const z = zones[s.fishZone];
    if (z) {
      const name = h('input', { type: 'text', value: z.name });
      name.addEventListener('change', () => edit((l) => { l[s.fishZone].name = name.value.trim() || z.name; }));
      const col = h('input', { type: 'color', value: z.color ?? '#7fd0ff' });
      col.addEventListener('change', () => edit((l) => { l[s.fishZone].color = col.value; }));
      const itemOpts = items.map((d) => [d.id, `${d.name}${d.fish ? '' : d.kind === 'material' || d.kind === 'consumable' ? '' : ` (${d.kind})`}`] as [string, string]);
      const total = z.fish.reduce((a, f) => a + Math.max(0, f.chance), 0) || 1;
      const rows = z.fish.map((f, k) => h('div', { class: 'fish-row' },
        select(itemOpts, f.item, (v) => edit((l) => { l[s.fishZone].fish[k].item = v; }), { 'aria-label': 'Catch' }),
        numberInput(f.chance, (v) => edit((l) => { l[s.fishZone].fish[k].chance = Math.max(0, Math.round(v)); }), { min: 0, step: 1, 'aria-label': 'Weight', title: 'Weight against the others' }),
        h('span', { class: 'fish-pct' }, `${Math.round((Math.max(0, f.chance) / total) * 100)}%`),
        select([['', 'Any time'], ['day', 'By day'], ['night', 'At night']], f.time ?? '', (v) => edit((l) => { const x = l[s.fishZone].fish[k]; if (v) x.time = v as 'day' | 'night'; else delete x.time; }), { 'aria-label': 'When' }),
        h('label', { class: 'fish-rare', title: 'Rare: a better rod makes it more likely' }, (() => { const c = h('input', { type: 'checkbox', checked: !!f.rare, onchange: () => edit((l) => { const x = l[s.fishZone].fish[k]; if (c.checked) x.rare = true; else delete x.rare; }) }); return c; })(), 'Rare'),
        h('button', { type: 'button', class: 'btn small ghost', title: 'Remove', onclick: () => edit((l) => { l[s.fishZone].fish.splice(k, 1); }) }, '×')));
      out.push(h('div', { class: 'water-style-form' },
        h('label', { class: 'field' }, h('span', {}, 'Name'), name),
        h('label', { class: 'field' }, h('span', {}, 'Colour (editor only)'), col),
        h('div', { class: 'section-label' }, 'What bites (weight · chance · when)'),
        ...rows,
        h('button', { type: 'button', class: 'btn small', onclick: () => edit((l) => { l[s.fishZone].fish.push({ item: items.find((d) => d.fish)?.id ?? items[0]?.id ?? '', chance: 10 }); }) }, '+ Add a catch'),
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => {
          if (!confirm(`Delete the fishing spot “${z.name}”? Water painted with it stops being a fishing spot.`)) return;
          const gone = s.fishZone;
          edit((l) => { l.splice(gone, 1); }, false);
          s.editFishing((grid) => { let any = false; for (let i = 0; i < grid.length; i++) { const c = grid[i]; if (c === null) continue; if (c === gone) { grid[i] = null; any = true; } else if (c > gone) { grid[i] = c - 1; any = true; } } return any; });
          s.fishZone = 0; s.changed('structure'); s.emit('ui');
        } }, 'Delete this spot')));
    }
    out.push(h('p', { class: 'note' }, zones.length
      ? 'Paint over water where fish can be caught. In the game, a hero with a fishing rod faces the spot and presses Talk to cast; when the float is pulled under, Talk again to land it. What bites is picked from the spot’s list by weight (night or day fish only at that time; rare ones are likelier with a better rod).'
      : 'Add a fishing spot, then paint it over water. Each spot has its own list of catches (a pond’s minnows, the river’s trout, the sea’s…).'));
    return out;
  }

  private tools<T extends string>(list: [T, string, string][], current: T, set: (t: T) => void): HTMLElement {
    return h('div', { class: 'toolrow', role: 'group', 'aria-label': 'Tool' }, ...list.map(([t, label, key]) =>
      h('button', { type: 'button', class: 'tool', 'aria-pressed': String(current === t), title: `${label} (${key})`, onclick: () => { set(t); this.store.emit('ui'); } }, label)));
  }

  /** The Spawns layer: zone letters to paint, and the chosen zone's troops, conditions and frequency. */
  private zonesPanel(): HTMLElement[] {
    const s = this.store, m = s.map, grid = s.zoneGrid();
    const used = new Set(grid.filter((c) => c !== '.'));
    for (const k of Object.keys(m.zones ?? {})) used.add(k);
    // The letters in use, plus the next free one.
    const letters = ZONE_LETTERS.filter((l) => used.has(l));
    const next = ZONE_LETTERS.find((l) => !used.has(l));
    if (next) letters.push(next);
    const edit = (fn: () => void) => { s.checkpoint(); fn(); s.changed(); s.emit('ui'); };
    const btn = (l: string) => h('button', { type: 'button', class: 'swatch zone-swatch', 'aria-pressed': String(s.zoneLetter === l), title: l === '.' ? 'Erase' : `Zone ${l}`,
      onclick: () => { s.zoneLetter = l; s.emit('ui'); } },
      h('span', { class: 'zone-chip', style: l === '.' ? '' : `background:${zoneColor(l)}` }, l === '.' ? '✕' : l),
      h('span', { class: 'swatch-name' }, l === '.' ? 'Erase' : m.zones?.[l]?.name || `Zone ${l}`),
      h('span', { class: 'swatch-note' }, l === '.' ? 'No random battles here.' : `${grid.filter((c) => c === l).length} tiles · ${m.zones?.[l]?.troops.length ?? 0} troop${(m.zones?.[l]?.troops.length ?? 0) === 1 ? '' : 's'}`));
    const out: HTMLElement[] = [this.brush(), h('div', { class: 'section-label' }, 'Paint'), h('div', { class: 'swatches' }, ...letters.map(btn), btn('.'))];
    const l = s.zoneLetter;
    if (l === '.') { out.push(h('p', { class: 'note' }, 'Erase: tiles with no zone have no random battles (unless the map has its own random encounters, in map settings).')); return out; }
    const troops = s.db.troops ?? [];
    const zone = m.zones?.[l];
    const ensure = () => ((m.zones ??= {})[l] ??= { troops: [] });
    out.push(h('div', { class: 'section-label' }, `Zone ${l}`),
      h('div', { class: 'field' }, h('label', {}, 'Name'), h('input', { type: 'text', value: zone?.name ?? '', placeholder: `Zone ${l}`, onchange: (e: Event) => edit(() => { const v = (e.target as HTMLInputElement).value.trim(); if (v) ensure().name = v; else if (m.zones?.[l]) delete m.zones[l].name; }) })),
      h('div', { class: 'field' }, h('label', {}, 'Tiles between battles'), numberInput(zone?.steps ?? 30, (v) => edit(() => { const n = Math.max(4, Math.round(v)); if (n === 30) { if (m.zones?.[l]) delete m.zones[l].steps; } else ensure().steps = n; }), { min: 4, step: 1 }), h('div', { class: 'hint' }, 'About this far on average (it varies).')));
    if (!troops.length) { out.push(h('p', { class: 'note' }, 'Add troops (groups of enemies) in Database → Troops first, then choose which come in this zone.')); return out; }
    const tOpts = troops.map((t) => [t.id, t.name] as [string, string]);
    (zone?.troops ?? []).forEach((zt, k) => {
      const days = new Set(zt.days ?? []);
      out.push(h('div', { class: 'zone-troop' },
        h('div', { class: 'field-row' },
          select(tOpts, zt.troop, (v) => edit(() => (zt.troop = v)), { 'aria-label': `Troop ${k + 1}` }),
          h('button', { type: 'button', class: 'mini-btn', 'aria-label': `Remove troop ${k + 1}`, onclick: () => edit(() => { zone!.troops.splice(k, 1); if (!zone!.troops.length && !zone!.name && !zone!.steps) delete m.zones![l]; }) }, '✕')),
        h('div', { class: 'field-row' },
          h('div', { class: 'field' }, h('label', {}, 'How often'), numberInput(zt.weight ?? 1, (v) => edit(() => { const w = Math.max(0, Math.round(v)); if (w === 1) delete zt.weight; else zt.weight = w; }), { min: 0, step: 1, 'aria-label': `Troop ${k + 1} weight` })),
          h('div', { class: 'field' }, h('label', {}, 'When'), select([['', 'Any time'], ['day', 'By day'], ['night', 'At night']], zt.time ?? '', (v) => edit(() => { if (v) zt.time = v as 'day' | 'night'; else delete zt.time; }), { 'aria-label': `Troop ${k + 1} time` }))),
        h('div', { class: 'zone-days', role: 'group', 'aria-label': 'Real-world days' }, ...WEEKDAY_SHORT.map((name, d) => h('button', { type: 'button', class: 'day-chip', 'aria-pressed': String(days.has(d)), title: 'Only on these real-world days (none: every day)',
          onclick: () => edit(() => { if (days.has(d)) days.delete(d); else days.add(d); const list = [...days].sort(); if (list.length) zt.days = list; else delete zt.days; }) }, name))),
        h('div', { class: 'field' }, h('label', {}, 'Only while switch is ON'), h('input', { type: 'text', value: zt.switch ?? '', placeholder: 'Any (optional)', onchange: (e: Event) => edit(() => { const v = (e.target as HTMLInputElement).value.trim(); if (v) zt.switch = v; else delete zt.switch; }) }))));
    });
    out.push(h('button', { type: 'button', class: 'btn small', onclick: () => edit(() => ensure().troops.push({ troop: tOpts[0][0] })) }, '+ Add troop'),
      h('p', { class: 'note' }, 'Walking in this zone brings a battle now and then (turn-based battles), with one of these troops by how often each is set, among those allowed right then: by day or at night (game time), on the chosen real-world days of the week, or while a switch is on.'));
    return out;
  }

  private brush(): HTMLElement {
    const s = this.store;
    return h('div', { class: 'brush' }, h('span', { class: 'section-label' }, 'Brush'),
      h('div', { class: 'toolrow small' }, ...[1, 2, 3, 5].map((n) =>
        h('button', { type: 'button', class: 'tool', 'aria-pressed': String(s.brushSize === n), onclick: () => { s.brushSize = n; s.emit('ui'); } }, `${n}×${n}`))));
  }
}

/** A preset seen from above, for the palette. */
function buildingThumb(id: string): HTMLCanvasElement {
  const p = BUILDING_PRESETS.find((q) => q.id === id)!, v = p.values;
  const pad = 0.6, scale = Math.min(64 / ((v.w + pad * 2) * TS), 54 / ((v.d + pad * 2) * TS));
  const c = h('canvas', { class: 'sprite-thumb', width: Math.round((v.w + pad * 2) * TS * scale), height: Math.round((v.d + pad * 2) * TS * scale) });
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  drawBuildingTop(ctx, { ...v, x: pad, z: pad }, 1);
  return c;
}

/** Copy that fits a 64×54 frame. */
function spriteThumb(src: HTMLCanvasElement, maxW = 64, maxH = 54): HTMLCanvasElement {
  // Small pixel art is enlarged with hard edges; large imported images are shrunk smoothly to fit.
  const k = Math.min(2.5, maxW / src.width, maxH / src.height);
  const c = h('canvas', { class: 'sprite-thumb', width: Math.max(1, Math.round(src.width * k)), height: Math.max(1, Math.round(src.height * k)) });
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = k < 1;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const fmtTiles = (v: number) => (Math.abs(v - Math.round(v)) < 0.01 ? String(Math.round(v)) : v.toFixed(1));
