# Handoff: where the project stands (Oct 18, 2026)

A summary for picking the work back up in a new Claude session or account. Everything is committed to
`itshyokin/hd2dengine` (branch `main`). To start a new session, attach the repo and say: *"Read HANDOFF.md,
NOTES.md and README.md, then continue with the next update."*

## What this is
An HD-2D RPG engine (TypeScript + three.js 0.149 + Vite): pixel sprites in a 3D tile world, a Map Editor with
a full Database, a Character Builder, and a playtest game. It has turn-based battles (FFX-style turn order,
Legend of Dragoon-style Additions and Guard, battle maps); on the map the sword and bow are field tools and
bumping into (or striking) a foe starts a battle. It builds to standalone HTML files and runs on an Android tablet through the online editor.

- `README.md`: the full feature guide (what every tool, tab and command does).
- `NOTES.md`: the to-do list and roadmap, with ticked items. **This is the master plan.**
- `HANDOFF.md`: this file.

## How we work (conventions to keep)
- Work in numbered updates ("Update 63", small follow-ups "63b"). Each update: build it, test it in the browser
  (Playwright headless, with the game exposed as `window.__game`), update README.md and NOTES.md, then commit and
  push to `main`.
- Before committing: `npx tsc --noEmit`, then `npm run build:standalone` (rebuilds `Map Editor.html` and
  `Playtest.html`, which are committed).
- Before pushing: `git fetch -q && git rebase -q origin/main` (the owner also commits from other machines).
- Never commit `package-lock.json`.
- Dev server: `npx vite --port 5190 --strictPort`. Typecheck: `npx tsc --noEmit`.
- Preview visual changes (screenshots) before or alongside committing; the owner playtests and reports back
  with annotated screenshots.
- Tone of the docs: plain words, what the user sees and does, no internal jargon.

## Done so far (recent highlights; the full list is under "Done" in NOTES.md)
- 50–54: playtest fixes, HUD rework, styled text, Bestiary, text box styles, seamless maps, Map Properties,
  the sky over Titan with the real moon phase, sleeping, dynamic weather and temperature.
- 55: stat growth ranks (A–F) and stat setup on a 3D dice table (Roll Dice / Point Buy / Standard Array).
- 56: Duplicate / Copy / Paste in every Database list (right-click, Ctrl+D / C / V).
- 57: turn-based party on the map, lineup leader sprite, achievement pop-up with description and points bar.
  57b: everyone uses the plain idle pose in battle.
- 58: event sounds that fade with distance (campfire, shore, waterfall, hum).
- 59: Map Themes Database tab, more map edges, built-in dirt / stone / rock / snow terrain, desert and snow props.
- 60: Game Boy-style chiptune built-in sounds and music; console `audio_chiptune true/false`.
- 61: hero-coloured turn ring and card glow; self-switches A–D; Switches window (+ / − / rename).
- 62: bridges and platforms (wood, rope, stone, docks), edge scenery follows edge heights, props half-submerged.
- 62b: height styles (Blocky, Soft blocky, Smooth hills, Cliffs), waterfalls, two-level bridges (swim under).
- 63: window themes (Ember, Medieval Parchment, Medieval Wood, Dwarven, Elvish, Titan) for menus, text boxes,
  battle panels and the HUD; default in Database → Menus, player choice in Settings → Gameplay.
- 63b: soft-blocky and cliff seam fixes; bridges keep walkers on them (along the bridge only, on and off at
  the ends; same for the party and enemies).
- 64: seven stats (STR, DEX, AGI, END, DEF, MAG, MDF), hits can miss, buffs and debuffs in battle (Haste, Slow,
  Support spells, enemy Buff actions), the Party skill tree shared by everyone.
- 65: the real-time battle system removed (sword and bow are field tools; bow lock-on snipes to strike first;
  Assassinate and Silent Shot reworked; old real-time skills updated); Database forms with switches at the top and
  a jump bar; Database tabs regrouped (Party, Battle, Abilities, Items, Story, World, Game).
- 66: impact materials (hit sounds and effects per enemy), big CRITICAL / WEAK / IMMUNE with shake and thump, a
  battle log on the left (Y scrolls it), monster stat blocks across the top (Database switch) with a boss overdrive
  gauge.
- Tooling note: in the cloud workspace npm install is blocked, so typecheck with a global tsc and build the
  standalone files with bun (`bun tools/build-standalone.mjs` with a small esbuild stand-in); the owner's own
  `npm run build:standalone` makes slightly smaller files.

## Next up (in order; details in NOTES.md)
1. **Travel**: horses (stables, tiers with stamina and jump of 3 / 4 / 5 tiles, A to mount, B to dismount, Saddle
   key item sends the horse home, placeholder art) and griffin flights (roosts unlocked by talking to the griffin
   master, fly over the World layout's maps at one speed, no skip).
2. **Other open items**: Story journal tab, enemy charging spells and Counterspell, Limit specials, class trainer
   screen and class stat bonuses, cooking fish and a reeling mini-game, sitting at campfires (hero and party),
   moving platforms, speech bubble position per message, message window background images, a Bestiary
   achievement rule.

## Code map (where things live)
- `src/game/Game.ts`: the game (large). `PlayerMotion.ts` (hero movement, jumps, ledges, bridges), `party.ts`
  (followers), `combat/Enemy.ts`, `battle/` (turn-based: `TurnBattle.ts`, `BattleStage.ts`), `GameState.ts`,
  `Interpreter.ts` (event commands), `settings.ts`, `statRanks.ts`.
- `src/world/`: `TileMap.ts` (heights, water, decks / bridges, `deckStepOK`), `WorldBuilder.ts` (terrain, map
  edges, props, waterfalls), `terrainGeometry.ts` (cell surfaces, walls, bevels, cliffs, hills), `decks.ts`,
  `heights.ts`, `mapThemes.ts`, `types.ts`.
- `src/ui/`: screens and HUD; `themes.ts` + `themeFonts.css` (window themes); `BattleScreen.ts`,
  `StatusBars.ts`, `CreationScreen.ts`.
- `src/editor/`: the Map Editor; `DatabaseEditor.ts` (tabs, the `listOf` registry for duplicate / copy /
  paste), `CommandEditor.ts` (a new event command needs COMMAND_TYPES, CATEGORY, create, summary and form
  entries), `switchPicker.ts`, `MapThemesEditor.ts`.
- `src/audio/`: `sfx.ts`, `synth.ts`, `chip.ts` (chiptune).
- `src/shared/dataFiles.ts`: `formatMap` (map JSON layout; keeps every key).
