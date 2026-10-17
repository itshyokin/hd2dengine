# 2.5D Engine

A browser-based 2.5D RPG engine in the spirit of RPG Maker MV, with HD-2D style lighting:
2D sprites standing in a lit 3D world, with dynamic lights, shadows, bloom and tilt-shift.

Written in TypeScript on top of three.js, built with Vite.

## Running it on Windows

1. Install **Node.js LTS** from <https://nodejs.org> (the installer adds `node` and `npm`).
2. Open a terminal (PowerShell or Windows Terminal) in this folder.
3. Install dependencies (once):
   ```
   npm install
   ```
4. Start the dev server:
   ```
   npm run dev
   ```
   Open the address it prints (usually <http://localhost:5173>). Saving any file reloads the game instantly.

### The editor and game online (GitHub Pages), and editing on a tablet

Every push to the repository's `main` branch rebuilds the site (`.github/workflows/pages.yml`):

- Map editor: <https://itshyokin.github.io/hd2dengine/editor.html> (with a link to the Character Builder)
- Game: <https://itshyokin.github.io/hd2dengine/>

The online editor works in any recent browser, Android tablets and phones included. It opens the project as it is
on GitHub and keeps your changes **in that browser, on that device** (they're still there next time). The
**Project** button in the toolbar:

- **Save changes as .zip**: only the files you changed, laid out like the project folder (`public/data/…`,
  `public/assets/…`). On the PC, unzip it into the project folder (replacing files), then commit and push with
  GitHub Desktop.
- **Open project .zip…**: a zip of the project folder (or its `public` folder, or a changes zip from another
  device); its maps, database and imported files replace the ones on this device.
- **Forget my changes…**: back to the project as it is on GitHub.

Playtest works from the online editor too. Pick up fresh changes from GitHub by saving your own as a zip first,
then forgetting them (or opening a newer project zip).

### Testing on an Android phone

With `npm run dev` running, the terminal also prints a **Network** address such as `http://192.168.1.20:5173`.
Open that on your phone while it's on the same Wi-Fi. If it doesn't load, allow Node.js through Windows Firewall
when prompted (private networks only).

### Other commands

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the game into `dist/` (a static site you can host anywhere, including Neocities). |
| `npm run preview` | Serves the `dist/` build locally to check it. |
| `npm run typecheck` | Runs the TypeScript checker over the whole project. |
| `npm run build:standalone` | Rebuilds `Map Editor.html` and `Playtest.html` (single files that run by double-clicking). |

## Character Builder

`Character Builder.html` (double-click; works in Firefox, Brave and on an Android tablet's browser) builds
character sprite sheets from layered parts, like RPG Maker MV's generator. There's also a hosted copy on claude.ai
that keeps your library in your Claude account, so the same parts and characters show on your tablet and PC.
The double-clicked copy saves into the browser it's opened in. Its *Back up library (.zip)* moves everything
between copies.

- **Body type**: Kid, Masculine or Feminine. Parts are made per body type (or for *all bodies*).
- **Parts**: body, eyes, hair, tops, bottoms, shoes, hats, face (beards, glasses), extras (scarves, belts) and back
  (capes, packs). Each has a colour row; *As drawn* keeps a part's own colours.
- **Preview**: walking or standing, facing any way, on grass, stone or a clear background, plus a turnaround of all
  four directions and the full sheet. **Randomize** makes quick NPCs.
- **Save** keeps a character; **Export PNG** saves its sheet; *Characters → Export all* zips every sheet.
- **Parts library**: add your own PNG parts (pick body and part, then the files) or a .zip of folders
  (`feminine/hair/braid.png`, `all/hats/straw_hat.png`). *Starter pack* gives every built-in part as a PNG plus a
  drawing guide per body to redraw in your art app. *Frame size*: 16×24 (one pixel per texel, like the built-in
  art), 32×48 (default) or 48×72.
- **Colours**: paint anything recolourable in greys. `#a8a8a8` becomes the picked colour, lighter greys highlights,
  darker greys shadows. Near-black outlines, pure white and coloured pixels stay as drawn.
- Layers stack: back, body, eyes, bottoms, shoes, tops, extras, face, hair, hats (facing up, the back layer goes over
  the clothes).

**Into the game**: Database → **Characters** → *Import character sheets…* (pick one or many PNGs). Each becomes a
character for events, enemies or the player (*Player* on its card). *Replace sheet…* updates one after you re-export
it. Sheets are saved to `public/assets/characters/`. Any RPG Maker MV-style sheet works: 3 frames across × 4 rows
(down, left, right, up), any frame size; characters always stand 1.5 tiles tall.

The builder's source is in `tools/character-builder/src/`; `python tools/character-builder/build.py` rebuilds it.
(The LPC edition below, with the weapon builder, is in `tools/lpc/builder/src/`; `python tools/lpc/builder/build.py`
rebuilds it into `tools/lpc/builder/site/`.)

### Character Builder, LPC edition

The hosted Character Builder now uses the Liberated Pixel Cup (LPC) sprites: 64 × 64 frames with walk, idle, run,
jump, climb, combat stance, slash, backslash, half slash, thrust, shoot, cast, hurt, sit and emote, for masculine,
feminine, teen, kid, muscular and pregnant bodies. Parts recolour with LPC's palettes.

- **Steam-safe parts only** (on by default) offers only parts available under CC0 or OGA-BY (credit required, DRM
  fine). Parts that are only CC-BY-SA / GPL get an *SA/GPL* tag when it's off, and a banner lists any in the character.
- **Export** chooses the animations in the sheet: walk and idle always, plus run/jump/climb, combat, and sit/emote. A
  townsperson with just walk and idle is a fraction of the size of a fighter.
- **Export PNG** writes the sheet with its animation layout and credits stored inside the PNG (an `hd2d-character`
  text chunk). **Credits** saves them as text; *Characters → Export all* zips every sheet with a combined CREDITS.txt.
- The library is built from a checkout of the LPC generator by `python tools/lpc/build_lpc.py <repo> <out>`
  (catalog, sprite packs, thumbnails). The builder's source is in `tools/lpc/builder/`.
- **Into the game**: import the exported PNG in Database → **Characters** like any sheet. The editor reads the
  animation layout and credits from it (the card says *Animated (13 animations) · Steam-safe*). In the game the
  character walks, idles, runs, jumps, climbs, takes a combat stance while fighting, swings with slash / backslash /
  half slash, draws and looses the bow with *shoot*, casts with *spellcast*, flinches and falls with *hurt*. Enemies
  using an LPC sheet do the same. Sheets without an animation fall back to the nearest one (walk at least).
- LPC sheets are drawn at **32 px per tile** (a 64 × 64 frame covers 2 × 2 tiles, the character about 1.5 tall).
- **Weapons**: animated characters carry the LPC sprite of what's equipped, drawn frame for frame with their own
  swings (see *LPC weapons* below). Build characters without a weapon in the builder, so the equipped one shows.

### Enemy sprites

Database → Enemies → **Sprite** has three kinds:

- **Matches the player's sprite sheet**: any character from Database → Characters (Character Builder sheets animate fully).
- **Flat sprite**: one picture (PNG, any size; huge drawings are shrunk to 256 px tall), no frames needed. The engine
  moves it: it **breathes** while standing, and **slides** (a little sway), **hops** (squash and stretch) or **flies**
  (hovers and bobs) when it moves. It's mirrored to face where it's going (*The picture faces*: right, left, or never
  mirror), lunges when it strikes, and flashes, glows and squashes like any enemy. *Height (tiles)* sets its size; the
  width follows the picture. Pictures are saved to `assets/enemies/`. Credit the artist in Database → Credits.
- **Built-in monster**: the slimes drawn by the engine.

### LPC weapons

Weapons, bows and shields have a **Sprite** (Database → Items, on the item): the LPC weapon an animated character
holds. Swords (dagger, arming sword in 8 metals, longsword, rapier, katana, scimitar, glowswords), a mace and a club,
staffs and a wand, bows, and shields. Only Steam-safe ones are included (no Steam-safe spears or axes exist in LPC yet).

- The weapon rides on the back while exploring and comes into the hand to attack (see *Carried weapons*), so the
  walking, running and jumping frames never show it out of step. Attacks use what the sprite can do: the arming
  sword has the full slash / half-slash / backslash combo, the longsword mixes in a reversed slash and a thrust, staffs
  thrust. Big swings use LPC's oversized frames (up to 6 × 6 tiles), centred on the character.
- Items without a sprite choice get one for their kind (light weapon: steel arming sword; others: longsword; bows: a
  bow; shields: a round shield). *None (icon)* keeps the old icon.
- **Shield** is a new equipment slot (it adds defence). Mira's shop in the sample map sells a Round Shield.
- **Enemies** using an animated character carry a sprite too (Database → Enemies: *Weapon sprite* and *Shield*).
- Characters without animations (RPG Maker-style sheets) still show the icons.
- The sheets are in `public/assets/weapons/` (rebuilt by `python tools/lpc/build_weapons.py <LPC generator repo> public/assets/weapons`).
  Their artists are added to the Credits screen for the sprites in use.

### Weapon builder

The Character Builder has a **Weapons** mode (top left: *Characters | Weapons*) for making your own weapon looks, so a
legendary sword can look different from a plain longsword, everywhere it shows: in the hand, on the back, in the bag.

- **Shape**: start from any of the Steam-safe LPC weapons (swords, maces and clubs, staffs, bows, shields).
- **Colours**: the weapon is split into parts by colour (metal and light parts, gold and brass, wood and leather, gems,
  outline). Give each part a material (steel, gold, obsidian, ice, ruby…), any colour, or keep it as drawn. Each part
  keeps its shading, and the swing smears follow the blade.
- **Effects**: a **glow** (colour, strength, pulse) and, for melee weapons, a **swing trail** (colour, length). They're
  saved with the weapon, and an item that picks it starts with them; Database → Items can still change them per item.
- **Preview**: your current character swings it (slash, backslash, thrust… whatever the shape has), from all four
  sides, with the icon at bag size and actual size.
- **Save** keeps it in your library (with your characters); **Export PNG** writes one PNG with everything inside: the
  sprite sheet, its icon, the LPC artists' credits (a recolour is still their work) and the effects.
- **Into the game**: Database → Items → a weapon → *Sprite* → **Import from the weapon builder…** (pick one or more
  PNGs). The sheet is saved to `assets/weapons/custom/` and the look listed under *Your weapons*. The item's icon
  switches to *From its sprite*, so the bag, shop, HUD and the weapon on the back all match.

**Icons from sprites**: every weapon sprite now has an icon cut from its own art (`thumbs.png`, rebuilt by
`python tools/lpc/weapon_icons.py`, which picks the frame that shows each weapon best and lays it on the same diagonal).
Any weapon, bow or shield item can use it: Items → *Icon* → **From its sprite**. On the hero's back these icons are
drawn at the sprites' own scale, so a dagger stays smaller than a longsword.

**Glow and swing trail per item**: Database → Items → a melee weapon or bow → *Effects*: *Glow* (colour, strength,
pulse) and, for melee weapons, *Swing trail* (colour, how many earlier frames echo behind the swing). Any rarity can
have them. They're drawn on animated (LPC) characters.

### Character Builder on your PC

The LPC Character Builder (characters and weapons) also runs from the engine folder, next to the map editor. Its
parts library is included (`tools/lpc/library/`, about 136 MB, the same one the hosted builder uses).

- Double-click **Start Character Builder.bat**, or press **Character Builder** in the map editor's toolbar (shown
  when the editor runs from *Start Map Editor.bat*).
- It's served by the same little server as the map editor (one window, one address), so your saved characters and
  weapons are there every time. They're kept by the browser on this computer.

**Moving characters and weapons between builders** (say, from the tablet to the PC): open *Characters* (or
*Weapons*) and press **Back up (.json)**: one file with every character and weapon and all their settings. On the
other builder, press **Import…** and pick it. Import also takes exported PNGs (characters and weapons carry their
settings inside them now) and *Export all* .zip files. Ones already there are only replaced by a newer copy, so
importing the same file twice doesn't make duplicates. Character PNGs exported before this change only hold the
sprite sheet: open those characters in the builder they were made in and export them again (or back them up).

### LPC library (tiles and props)

Terrain → *+ Add from the LPC library…* (tiles) and Props → *+ Add from the LPC library…* (props) open a browser of
**LPC Revised** art (Eliza Wyatt and others, github.com/ElizaWy/LPC): about 3,000 pieces, all OGA-BY 3.0 (Steam-safe
with credit). Pick a group (Trees, Plants, Flowers, Rocks, Furniture, Beds, Seating, Smithing, Food, Doors, Windows,
Signs, Fences…; tiles: Terrain in four seasons, Floors, Walls, Roofs), a season, or search; click to pick several,
then *Add to project*.

- Added pieces become ordinary imported props and tiles (in `assets/props/` and `assets/tiles/`): edit them like any
  other. Their credits are saved with them and shown in the Credits screen.
- Props block the tiles under them (flowers, food and small items don't). Wall and roof tiles can be used for
  buildings (a building's *Walls* / *Roof* lists imported tiles).
- Pieces drawn lying flat (rugs, bridges, stairs, roof pieces) are left out: props stand upright in the 3D world.
- The library lives in `public/assets/lpc-library/` (rebuilt by `python tools/lpc/build_library.py <ElizaWy/LPC checkout> public/assets/lpc-library`).
  It's only for the editor: leave it out of a release if you like.

## Credits

The title screen has **Credits**. It lists your own sections first (Database → **Credits**: a heading and names,
one per line, in any order you like), then everyone whose sprite art is in the game, gathered automatically from the
imported characters' credits (with licences and links). Scroll with up / down; Enter or Esc closes it.

## Map editor

### Easiest: double-click `Start Map Editor.bat`

Works in any browser (Firefox, Brave, Chrome, Edge). It starts a tiny editor server
(`tools/editor-server.mjs`, plain Node.js, nothing to install) in a minimized window and opens the editor in your
default browser. **Save** writes straight into `public/data/`, and **▶ Playtest** opens the game in a new tab.
Close the minimized “Map Editor” window to stop it; it also stops on its own a few minutes after you close the editor tab.

### Chrome or Edge only: open `Map Editor.html` directly

1. Open `Map Editor.html` (in this folder) with **Google Chrome** or **Microsoft Edge**.
   Tip: right-click it → *Open with* → Chrome/Edge, or drag it onto a browser window.
2. Click **Choose project folder…** and pick this project folder. Allow the browser to view and edit files.
3. Edit away. **Save** (Ctrl+S) writes straight into `public/data/`. **▶ Playtest** opens `Playtest.html` with your map.

The editor remembers the folder, so next time it's one click (“Open … again”).
`Playtest.html` is meant to be opened by the Playtest button; it needs an internet connection the first time for its
fonts, and for three.js unless you've run `npm install` and rebuilt (below).

If you change the engine's code, rebuild these two files with `npm run build:standalone`.

### With the dev server

With `npm run dev` running, open <http://localhost:5173/editor.html>. Same editor; saving goes through the dev server.

### Using the editor

- **Save** (Ctrl+S) writes `public/data/maps/<map>.json` (and `database.json` when the player start or
  starting hour or abilities changed). A hosted or preview copy that can't reach your project offers an export instead.
- **Database** (toolbar): fills the screen and stays the same size on every tab. The tabs are icons in groups
  (People, Items, Battle, Story, World, System): hover one for its name; the open tab's name shows at the right.
  **Apply** puts the changes into the project **and saves `database.json`** straight away: "Changes saved. It's
  safe to close the Database." shows at the bottom left for a few seconds (or "No changes to save"). The window
  stays open; **Close** with changes not applied asks whether to apply and save them or let them go. Every list
  (items, heroes, enemies, troops, quests, spells, Additions, classes, skills, achievements) has a red **Delete**
  under **+ New**, which asks "Are you sure you wish to delete …?" first (and warns again if it's used elsewhere).
- **▶ Playtest** opens the game in a new tab with the map exactly as it is in the editor, unsaved changes included.
  Under the dev server you can also open a saved map directly with `index.html?map=map002`.
- **Layers** (1–7): Terrain, Height, Passage, Props, Lights, Events, Buildings. Objects from other layers are dimmed.
- **Terrain tools:** Pencil (B) with brush sizes, Rectangle (R), Fill (G).
- **Prop tools:** Place (P), Scatter (S) for natural-looking forests, Select (V) to drag, Erase (E).
  Turn off *Snap to tiles* for free placement. While placing, the tiles the prop will block show in red.
- **Lights:** Point, Spotlight or Area, each with presets. Area lights are drawn by dragging; select one and drag its
  corner handle to resize. The **Lights %** bar in the status bar shows the light budget (hover it for details).
- **Undo / redo** covers map edits. Importing, editing or deleting a prop saves the asset list right away.
- **Events:** click an empty tile to create an event or move the player start. Click an event to edit its pages,
  conditions, appearance, trigger and commands. Drag events to move them.
- **View:** wheel or pinch to zoom; middle/right-drag, Space+drag or two fingers to pan; F fits the map.
- **Undo / redo:** Ctrl+Z, Ctrl+Y (or Ctrl+Shift+Z). Delete removes the selected prop, light or event.

On a tablet or phone the side panels slide in from the **Tools** and **Details** buttons.

### Buildings (Buildings layer, key 7)

Houses, shops, towers and barns drawn as 3D models from a footprint of tiles, so they light, cast shadows and line up
with the ground like everything else.

- **Draw** (D): pick a preset (Cottage, Townhouse, Stone house, Shop, Barn, Tower), then drag out a footprint, or
  click to place the preset at its own size. **Select** (V): click a building to select it, drag to move it, drag
  the corner handle to resize. Delete removes it. Buildings can't overlap each other.
- **Inspector**: walls (plaster, stone, brick, timber, or any imported tile), roof (shingle, thatch, slate, wood, or
  an imported tile), wall height, windows (none / a few / many), roof shape (gable, hip or flat), which way the ridge
  runs, how high it rises and how far it overhangs.
- **Doors**: any number, on any wall. The front wall faces the camera. Windows keep clear of doors and light up at night,
  like the windows of imported props.
- **Interiors** are separate maps. *Add entrance* on a door puts a Transfer event on the tile in front of it (shown
  dashed orange on the map) and opens it so you can pick the interior map and where to arrive. Do the same inside,
  by the interior's door, to come back out.
- A building fades to see-through while the hero is behind it, and comes back when they step out.
- A building blocks every tile it stands on. Props standing inside one aren't drawn in the game (you'll still see
  them on the Props layer, so they come back if you move the building).
- Tiles you draw for walls and roofs: 32 × 32, seamless. A roof tile's top edge is towards the ridge.

### Importing props from images

In the Props layer, click **+ Import prop from image…** (or drop an image on the preview).

1. **Image**: the sprite. A transparent PNG works best; the editor warns if the image has no transparency.
2. **Size on the map**: width × height in tiles. The preview shows the image cut into that grid.
   Drag to move the image, scroll or use the slider to zoom. **Fit** frames the visible part of the image
   (transparent margins are ignored), standing on the bottom edge. The blue marker is where the prop touches the ground.
3. **Blocks movement**: the squares under the preview, one per bottom-row column. Red means that tile blocks.
4. **Resolution**: keep the image's detail, or resample to 16–64 px per tile. **Filtering**: *Point* for crisp
   pixels (like Unity's "Point (no filter)"), or *Smooth*. LPC characters and new art: 32 px per tile + Point
   (props up to 192 px are guessed at 32 px per tile when imported).
5. **Normal map** (optional): framed exactly like the image. Tick *Flip green channel* for DirectX-style maps.
   Without one, a normal map is generated from the image.
6. **Night glow mask** (optional): white where it glows at night (lit windows), black or transparent elsewhere.
   It fades in at dusk and out at dawn, in the colour you choose.
7. **Emits light** (optional): choose *Place light* under the preview and click where the light comes from.
   Set its colour, brightness, reach, flicker, when it's on, and shadows.

Saved files: `public/assets/props/<id>.png` (plus `<id>_normal.png`, `<id>_glow.png`) and the list in
`public/data/assets.json`.

### Heights, cliffs, ramps and stairs (Height layer)

- Heights go from −10 to 10. One step is half a tile. Below 0 makes pits and riverbeds.
- **Raise (R)** / **Lower (L)** change the ground one step under the brush; each cell changes once per stroke.
  **Set (S)** paints a chosen height.
- Cliff walls appear automatically wherever neighbouring cells differ, including around pits.
- **Ramp (A)**: click a cell to put stairs or a ramp there. It rises one step toward the neighbour that is exactly
  one step higher (shown with an arrow). For taller climbs, chain several, each one step higher than the last.
  A red cross means there is no such neighbour. Click an existing one to select it: change its style, set its
  direction by hand, or delete it.
- **Corner slopes** (Ramp → Style: **Corner**): a walkable slope for a hill's corners, so raised ground can be a
  rounded hill instead of cliff steps. Put ramps along a hill's sides and a corner slope on the low cell at each turn:
  at an outside corner it rises toward the higher ground diagonally beside it (one raised corner); tucked into an
  inside corner it rises on two sides (three raised corners). The corners are found from the neighbours one step
  higher (dots on the map mark them); select one to set them by hand.
- **Cliff wall look:** the Map settings' **Cliff walls** sets the default for the whole map (built-in stone bricks
  or any imported tile). A tile can choose its own: select it in the Terrain palette (or in the tile importer) and
  set **Cliff walls under it**. A wall takes its look from the tile on top of the cliff.
- **Water (its own tab, key 8)**: water has a level (−10 to 10), a type and a style. **Fill basin**: dig a hollow with Lower, click inside it,
  and water fills every connected cell whose ground is below the level. **Paint** / **Remove** use the brush.
  **Fill basin** works like a paint bucket: it fills the connected area that matches the cell you click (dry ground,
  or water of the same level, type and style), so filling inside a painted ring fills only the ring. **Restyle
  pool** gives a whole pool (connected water of the style you click) the chosen style. See *Water styles*.
  Water that reaches the map edge carries on past it in the game, like roads (a stream running off into the woods).
  Types: **Auto** (shallow if one step deep or less, otherwise swimmable), **Shallow** (wade, a bit slower),
  **Swimmable** (the player swims), **Deep** (can't be entered: oceans and map borders). Water only appears where
  it's above the ground. In the game the shoreline is softened: bank corners that jut into water are cut round
  and the water's inner corners are filled round, with a natural wobble (the cliff wall curves with them), and water at a bank's level
  laps a little over it. This only applies where flat ground meets water; other cliffs keep square corners.
- In the game the player walks up ramps, stairs and corner slopes, can jump up one step, and climbs only walls marked Climbable
  (Passage layer): walking into one starts the climb at once, even with the stick held a little off straight.
  **Database → Player → Ledges** decides what happens at a drop: **Walk off, except into pits** (the default: the
  hero walks straight off any edge and drops to the ground below, except into cells whose height is between the two
  numbers, -10 to -5 steps by default, whose edges stay walls), **Walk off any ledge**, or **Collision** (drops are
  walls; a jump still comes down up to two steps). Never off climbable walls (they're climbed down) or into deep water. From a bank they can walk straight into water at the bank's level, wade, or swim. Props, events
  and lights stand on the ground at whatever height it is.

### Time, night and map lighting

- **Database → Time**: *Clock speed* from stopped to 60× (1× is real time; the default 20× makes a day last 72
  minutes of play) and *Night darkness* (up to pitch black away from lights). The clock pauses in menus.
  The day runs the full 24 hours, midnight and dawn included. "Set time of day" takes 0 – 23.75.
- **Map settings → Lighting**: *Outdoor* (full day and night), *Indoor* (muted light; windows with a glow mask
  show daylight and go dark at night, the opposite of outside; no fireflies), *Dark* (caves and dungeons: dark at
  any hour, so only lights show; lamps on a night schedule stay lit).
- **Map settings → Beyond the map edge**, per side (top, bottom, left, right) or all at once: open grass, forest,
  meadow (bushes and flowers), rocky cliffs, water, or nothing (darkness).
- **Roads past the edge**: tick **Is road** on a tile (Terrain palette; the built-in path is one already). Wherever
  a road tile touches the map edge, the road carries straight on outside, as wide as it was painted: across grass,
  forest and meadow (with grass growing over its sides, and no trees on it), through a gap cut in rocky cliffs, or
  over water on a stone causeway. Only "Nothing (darkness)" stops it.
- The status box shows the time with a sun or moon (a half-sun at dawn and dusk) and the weather. Weather itself
  comes later, so it reads Clear, Indoors or Underground. Settings → Clock switches 24-hour / 12-hour.

### Title screen, pause menu and settings

- The game (and every playtest) opens on the **title screen**. **Database → Title & menus → Title background**: a
  **map** (any map, centred on a spot you choose, the camera drifting round it), a **picture** or a **video** (no map
  behind it at all). Starting or loading a game fades to black, hides the HUD while the map loads, then fades in with
  the HUD coming up with it (Quit to Title fades the same way). Title options:
  **Continue** (the latest save; greyed out without one), **New Game**, **Load Game**, **Options**, **Exit**.
- **Database → Title & menus**: the game title, the title shown on screen and a subtitle; rename or hide each title
  option and each pause menu entry; *Skip the title screen in playtests* for quick testing.
- **Pause menu** (Esc / Start): one frame from the top of the screen to the bottom (the same size for every tab),
  with its tabs (all the same size) across the top: **Party · Items · Map ·
  Journal · Achievements · Settings · System**. **LB / RB** (Q / E) move between the tabs; tabs inside a tab (the
  bag's pockets, the Journal's pages) move with **LT / RT** (Z / C). The bottom line shows where you are, the time
  played and your gold. The HUD steps aside while it's open. Map shows once there's a World layout, Achievements
  once there are achievements; System holds Save, Load and Quit to Title.
- **Party**: the three fighting, as tall cards with their art (Face art from Database → Heroes, or their sprite drawn
  large), name, level, HP, MP and EXP; the rest of the party (up to eight) shows as **Reserve** underneath. ← → pick
  a card, Space opens its list: **Status**, **Equipment**, **Skill Tree**, **Stats** (level-up points), **Addition**
  (the one Attack performs), **Magic** (their spells; healing spells can be cast from here), **Class** (when they
  have more than one) and **Swap**: the rest of the party appears (Legend of Dragoon style), pick who takes this card's
  place. Anyone can be swapped out, the hero too (they still lead on the map; the others fighting follow them).
  **Database → Combat → The hero always fights** keeps the hero in the three. Anyone with points to spend has a gold
  outline and a **LEVEL UP** badge; the selected card has an arrow above and below it, pointing at it.
- **Map**: the world map (Pokémon Gold / Silver style), drawn from your maps themselves and laid out as in the
  **World layout** (Map editor toolbar → **World**). The **stick glides** across it (faster the further it's pushed);
  the **D-pad** (arrow keys) moves the crosshair **one tile** a press, repeating while held, to fine-tune; or drag it.
  Zoom with LT / RT (Z / C, or the mouse wheel), nine steps, up close to whole regions. **A** (Enter / Space) jumps
  to the next marker and **Y** (R) to the previous one, starting at you (the red pin), nearest first. Place names show over towns and landmarks.
  A **crosshair** sits in the middle: move it over the hero, a marker or a place name for its **tooltip** (with a
  mouse, the tooltip follows the pointer). **Event markers** (below) show as stars, circles, skulls…; an area event's
  whole area is outlined in its marker's colour, with the symbol in the middle.
  The World layout's **Places not visited yet** setting: *hidden*, *greyed out* or *fully visible*; and **Explore**:
  in maps visited, only the ground walked near shows (the rest stays under a dark fog) — mix them as you like.
- **Journal**: Quests, Adventure Log, **Bestiary** and Records (LT / RT). The **Bestiary** lists every enemy (the
  Database's order, numbered), the ones not met yet as "???". Each shows its picture, its description (Database →
  Enemies → Bestiary), the maps it was met on and how many were defeated; its numbers (HP, attack, defences, EXP,
  gold), its elements (weak to, resists, immune to, absorbs, and what it attacks with) and its drops show once enough
  of its kind have been defeated (Database → Combat → Bestiary: 1, 3 and 5 by default). *Leave it out of the
  Bestiary* hides an enemy (a training dummy, a story-only foe).
- **Achievements**: each with its icon, name, description and points (Xbox-style G), the newest unlocks at the top,
  then the rest unlocked, then locked ones (greyed, with how far along they are) closest first; hidden ones as "???"
  until unlocked; your total at the top.
- **Playtest panel**: drag the *2.5D Engine* panel by its title bar to move it anywhere (remembered in this browser).
- **HUD**: level, magic, health and EXP (all the same size) across the top; the clock and readied shard top right,
  with a little picture of the season behind it (blossom, sun, falling leaves, snow; Settings → HUD → Season
  picture) and a round **mini-map** under it (north up, you in the middle, drawn like the world map with the same fog,
  the map's markers, party members as dots); the selected weapon top left; a card per party member under it (face,
  name, HP, MP and EXP); EXP along the bottom; and **stamina** as a green ring with a dash icon (Halo Reach style),
  shown while stamina is used and fading out a moment after it's full again (orange when it ran out). A hit shakes the bar and flashes the screen edges red, and
  below 30% health the edges pulse red. **Settings → HUD → Arrange and resize** lets each player drag the pieces
  anywhere (or pick one with Q / E or LB / RB and move it with the arrows / stick) and change their size; it's saved
  per player. While arranging, the pause menu steps aside and comes back on the same tab afterwards. Each party card is
  a piece of its own (first, second, third card: by place, so swapping people doesn't scatter them), and so are the
  stamina ring and the mini-map. The stats can have their bars **side by side or stacked** (Y / R) and show
  **faces** (X / Shift: the hero's where the level is; the first party card's setting goes for every card); the clock's
  season picture turns on and off with Y / R; the
  adventure log can have **one box** behind it, a strip behind each line, or **no background** (Y / R). In playtests the debug panel sits under the weapons and can be hidden.
- **Text boxes**: by default a speech bubble over whoever is talking, sized to the text, with a tail pointing at
  characters (signs and objects get a plain box). **Settings → Gameplay → Text boxes**: above speaker, below speaker,
  top, bottom or centre of the screen. The Show text command can force a speech bubble or a plain box.
- **Styled words**: tags colour or style just some words in a message, a choice or a word bubble: `[b]bold[/b]`,
  `[i]italic[/i]`, `[s]struck through[/s]`, `[u]underlined[/u]`, `[glow]glowing[/glow]`, `[outline]outlined[/outline]`,
  `[color=#5ab8ff]any colour[/color]`, and the **named colours** of **Database → Text colours** (Names blue, Places
  green, Items gold, Danger red, and any you add): `[name]Lord Varn[/name]`. Change a named colour once and every
  message follows. The typewriter skips the tags, so they never show half-typed. In the Show text window, select
  words and click **B**, **I**, **S**, **U**, **Glow**, **Outline**, a colour dot or ◼ (the picked colour) to wrap them.
- **Text box styles** (**Database → Text boxes**): ready-made looks for messages, set up once. Built in: **Speech**
  (people talking), **Sign** (signs, chests and other objects), **Narration** (nobody speaking), **Item received**,
  **Gold received** and **System** (learned a spell, changed class, no room in the bag); add your own (a villain's
  red box, a ghost's see-through text…). Show text → **Style** picks one; *Automatic* uses Speech, Sign or Narration
  by who's talking. Change a style and every message using it follows; each has a preview.
- **A message's own look** (Show text → *Change the look just for this message*, starting from its style's): text and box colours, text size, bold,
  italic, strikethrough, an outline (and its colour), a glow, and a see-through box (just the text): the same
  settings as word bubbles, with a preview.
- **Tap to walk** (tap or click the ground to walk there, or a person to go and talk to them) is off unless the player
  turns it on in Settings → Gameplay (or the title's Options); tablets have the on-screen stick.
- **Settings** (the title's Options and the pause menu's Settings are the same screen): **Picture** (brightness,
  bloom, depth of field, shadows, lamp/fire shadows, detailed lighting), **Sound** (music, effects, background
  volumes), **HUD** (arrange and resize), **Controls** (keyboard and controller bindings) and **Gameplay** (text boxes, text speed,
  always run, sneak hold / toggle, sprint hold / toggle, run with a full stick push, footsteps on / off, clock format). They belong to the player, not to a save: loading a save never changes them.
  **Save settings to a file** downloads them all (HUD layout, controls, everything) as a small `.json`, and **Load
  settings from a file…** brings them into another copy of the game: a newer version, the other browser, or the
  hosted game. Choosing the file needs a click or Enter (browsers don't open file pickers from a controller button).
- **The game's default settings**: put a saved settings file at `public/data/settings.json` and it becomes the
  starting settings for every player who hasn't changed theirs (controls, HUD layout, picture…). **Restore
  defaults** goes back to it. A browser that already has settings saved keeps them until Restore defaults.
- Exit closes the game where the browser allows it; in a normal tab it asks the player to close the tab.

### World layout, the world map and seamless maps

- **Map editor toolbar → World**: every field map on one grid. Tick a map to put it in the world, drag it into
  place: it snaps edge to edge to the maps around it. **Add a place name** and click the map to put a town, landmark,
  dungeon or region name on the world map (click one to rename it, drag it to move it). The settings at the bottom say
  how places not visited yet show in the game. **Apply**, then save.
- **Seamless edges**: in a map's Inspector → *Beyond the map edge*, set a side to **Seamless**. Where another map
  touches that side in the World layout, it's drawn past the edge (built a moment after you arrive, so arriving stays
  smooth), and walking off the edge takes you straight into it: no fade, the same spot on the other side, the camera
  carrying on. Set the matching side of the other map to Seamless too, to walk back. Make the ground meet at the same
  height along the seam. Parts of a seamless side with no map beyond it show nothing (like *Nothing*), so keep the
  other kinds (forest, cliffs, water…) for the world's outer edges, or a dungeon's darkness.
- The ground under the hero and around them is marked as explored as they walk (kept in saves), for the world map's fog.
- **Map markers on events**: in the event window, **Map marker** puts the event on the world map as a *Quest
  location*, *Landmark*, *Town*, *Danger* or any kind you add, with its own tooltip (default: the event's name).
  **Only while switch** shows it only while a switch is on (or off): turn a quest's switch on when it starts and off
  when it ends, and its location appears and disappears. Area events (bigger than one tile) are outlined.
  **Database → Map markers**: each kind's name, symbol (star, circle, diamond, square, triangle, !, ?, flag, skull,
  house, cross, heart) and colour, and new kinds.

### Word bubbles

- In the event window, each page can have a **Word bubble**: **!** (a quest to take), **?** (ready to hand in) or
  any short text, **above** the event, **on** it or **at its feet**. Set the text and bubble colours, bold, italic,
  strikethrough, an outline (and its colour), a glow, the text size and the bubble's size, and whether it bobs.
  **See-through bubble** shows only the text (a floating gold "!", World of Warcraft style).
- Its text can use the same style tags as messages (`Hello [name]Varn[/name]!`).
- It shows while that page is the one showing, so quest givers use pages: one with "!" while the quest can be taken
  (Condition → Quest not started), one with "?" when it's ready to hand in (Condition → Quest ready to hand in).
  Bubbles hide in menus, battles and on the title screen.

### Achievements

- **Database → Achievements**: each has a **name**, a **description**, an **icon**, **points** and an **ID**
  (letters, numbers and underscores, like `SLIME_SLAYER`: the same as a Steam achievement's API name, so they carry
  over). Tick *Hidden until unlocked* for secrets. **Unlocked by**: an event (the **Unlock achievement** command), a
  switch turning on, defeating enemies (one kind or any, how many), performing Additions (one or any), casting spells,
  reaching a level, completing a quest, holding gold, having an item, the party's size, or any **Journal record**
  reaching a number (steps, fish caught, battles won, battles won without anyone taking damage…).
- Unlocking shows the pop-up (a badge pops in at the bottom, opens into "Achievement unlocked · 20G – Name", holds, and
  fades) with its own sound (Database → Audio → *Achievement unlocked*), and a line in the adventure log.
- Unlocks belong to the player in this browser and count for every save (like Xbox and Steam). Playtests keep their own.
- **Steam**: *Export for Steam (.csv)* lists the API names, names, descriptions and hidden flags for setting them up in
  Steamworks (Steam has no points; theirs stay in the game). A desktop build that talks to Steam (Electron with
  steamworks.js, say) only has to provide `window.hd2dAchievements.unlock(id)`: every unlock is passed on, and on start
  every achievement already unlocked is passed on too, so earlier unlocks carry over.
- Console cheats (below) turn achievements off for that game (the save remembers it).

### Developer console

- Press **`** in a playtest (or three fingers on a touch screen, or **Console** in the playtest panel): the game
  freezes and commands can be typed. **Tab** completes commands and names (items, heroes, spells, enemies, maps…),
  ↑ ↓ go through earlier commands, `help` lists everything (`help give` the ones matching), Esc or ` closes.
- **Who it's for**: commands about a character take a hero's name (or id) anywhere in them, or `all`:
  `level 5 eleanor`, `exp 300 all`, `hp 10 katrina`, `learn_spell fire 2 crowley`. With no name they're for the
  hero you play (`heal`, `revive` and the `learn` / `forget` commands default to everyone).
- Commands: `give <item> [count]`, `take`, `gold <amount>`, `party_add <hero>`, `party_remove`, `learn_spell <spell>
  [rank] [hero]`, `learn_addition`, `forget_spell`, `forget_addition`, `exp <n> [hero]`, `level <n> [hero]`, `heal [hero]`,
  `hp <n> [hero]`, `mp <n> [hero]`, `ko [hero]`, `revive [hero]`, `deathless`,
  `deathless_party`, `infinite_items`, `infinite_gold`, `god` (all four), `ghost` (through walls, props and cliffs),
  `speed <×>`, `unlock_skills [hero|all]`, `teleport <map> [x z]`, `time <hour>`, `weather <kind> [amount]`,
  `season <name|auto>`, `battle <troop|enemies…>`, `win_battle`, `switch <name> <on|off>`, `var <name> <value>`,
  `debug_menu <show|hide>` (the playtest panel), `fps`, `hud <on|off>` (screenshots), `achievement <id>`,
  `achievements_reset`, `explore_all`, `where`, `bug <what went wrong>` (notes the map, tile, height, time, party,
  level and a small picture, kept in this browser) and `bugs` (downloads every note as a `.json`; `bugs clear` starts
  over): handy for playtesting.
- **Database → Title & menus → Developer console**: in playtests only (default), always, or never.
- The **Run console command** event command runs any of them from an event (handy for test events).

### Saving, loading and respawn points

- **Saving**: from the pause menu's Save / Load. There are 3 save
  slots plus an **Autosave** written on every map change. The game keeps the map and position, switches,
  variables, abilities, health / magic / stamina, the bag, gold and equipment, the time of day, the respawn
  point and the play time.
- Playtests keep their saves and settings apart from the real game's.
- **Database → Saving**: *Save from the menu anywhere* (off = only at save points) and *Autosave on every map change*.
- **Save points**: the **Open save screen** event command (a statue, a bed, a journal…).
- **Respawn points**: tick **Is respawn point** on a prop (in its importer, or *Customise* for built-ins; the built-in
  campfire is one already) or on an event page. Using it (facing a prop and pressing Enter, or running the event)
  shows "Respawn point set". After losing all health the player comes back there, or to the player start if they
  haven't used one yet.
- Saves are kept in the browser's storage for now (per game title); a Windows build can store them as files later.

### Items, the bag, equipment and shops

- **Database → Items**: every item has a name, description, icon (pick one of the built-in pixel icons or
  **Import image…**: a 16 × 16 or 32 × 32 PNG, saved to `assets/icons/`), a price and a kind:
  - **Consumable**: restores health, magic and/or stamina (fixed amounts or *percentages of the maximum*).
    It isn't used up when it would do nothing. **Stack** sets how many fit in one bag slot (default 64); more of the
    same item starts another stack.
  - **Equipment**: goes in the **Weapon** (melee: light, medium or heavy class, damage), **Bow** (damage),
    **Shield** / **Armor** / **Accessory** (defence) or **Spell shard** slot. Weapons, bows and shields also choose the LPC
    **Sprite** animated characters hold. **Who can use it** keeps a piece to some heroes (none ticked: everyone).
  - **Arrows**: extra damage, stacks of 64, or *never run out* for the basic arrows.
  - **Loot** (materials): furs, wood, ore and other resources, stacks of 64 (more stacks as needed).
  - **Key / quest item**: can't be sold or discarded, has no stack limit and always fits (even in a full bag).
- **Database → Inventory**: slots per bag tab (8 to a row, default 64), starting gold, starting items and starting equipment.
- **In game**: the pause menu's **Items** opens the bag. Each kind of item has its own tab (pocket) of 8 × 8 slots,
  empty ones shown so things can be arranged (**Move** works within a tab): *Consumables*, *Gear* (weapons, armor,
  arrows), *Shards*, *Materials*, *Key items*; *All* shows everything at once. Use, Equip, Quick slot, Move, Drop one /
  Drop all; nothing is ever thrown away. Older saves sort their items into the tabs when loaded.
  - **Worn things stay in the bag**, like arrows: weapons, armor and shards that someone has on show **in use** in
    their tab, and the details say who (*Equipped by Mira*) or, for a shard set in gear, where (*Set in Short Sword*);
    an enchanted weapon or armor says *Enchanted with …*. Things in use can't be dropped or sold (take them off
    first: **Y / R → Take it off**). Older saves put what was worn back in the bag, marked in use.
  - **Gear** (Space on a weapon, armor or arrows): choose who puts it on (with a party; those who can't use it are
    greyed out). If every copy is in use, it moves from whoever had it.
  - **Shards** (Space on a shard): **Ready for** a hero (their spell, cast with B / F) or **Set in** any weapon or armor
    (elemental shards only). What it replaces simply stays in the bag, free again.
- **Status** (Party → a hero → Status): their gauges and numbers on the left, what they're wearing in the middle, and
  on the right their name, **About** (Database → Heroes → About), any ailments and, for party members, their
  **Fighting style** (Melee, Archery, Magic, Healing, each with a line on what it does): the weapon they mainly use.
  It starts as their database style; without that style's weapon (no bow for Archery, no shard for Magic) they fight
  with what they have (a bow alone makes an archer), and the page says so. Equipping is done from the bag.
- **Gear tab**: **Weapons** (swords, bows, arrows) and **Armor** (armor, shields, accessories) side by side, 4 × 8
  each. Picking a piece shows what it would change for each hero who can use it (+4 melee, −2 DEF…), and Space puts
  it on whoever you choose (those who can't use it are greyed out). What someone wears is tagged **equipped** in
  their colour (Database → Heroes → Colour).
- **The party beside the bag**: with party members, everyone's face, HP, MP and ailments stay on the right of the
  Inventory. Space on a potion (or other consumable) moves the cursor onto them: pick who, and watch the bar fill.
  The bag, gold and equipment are saved with the game.
- **Chests and pickups**: in the Events layer, click a tile and choose **Create chest here** or **Create item
  pickup here**. Both make a two-page event: page 1 gives the item and sets a switch
  (`chest_<map>_<id>`), page 2 (when the switch is on) shows the open chest, or nothing for a pickup.
  If the bag is full the player is told and the chest stays closed.
- **Shops**: the **Open shop** command lists what's for sale (prices come from the item unless you set one) and
  whether the player can sell (for half the price). In the sample map, talk to Mira twice and ask to trade.
- Built-in sprites for events: **Chest**, **Chest (open)** and **Item sparkle** (which glows in the dark).
- The sample map starts with 60 gold, 2 potions and some bread; a potion sparkle lies by the path.

### Action combat (the older battle system)

> Turn-based battles (next section) are the engine's main system and the default. Action combat — fighting on the
> map in real time — still works (Database → Combat → Battles are: Action), and its settings are folded away under
> *Action combat* in Database → Combat. In turn-based games enemies on the map still chase the hero, and reaching
> them starts a battle.

Action combat on the map, Zelda / Fable style:

- **Melee (1)**: the weapon in the *Weapon* slot sets the swing. **Light** weapons (daggers, short swords) are fast with
  short reach; **medium** (longswords, rapiers) are balanced; **heavy** (greatswords, great axes) are slow, reach
  further and hit hard. Press again mid-swing to chain a 3-hit combo; the third hit is the strongest.
- **Bow (2)**: needs a bow in the new *Bow* slot. Hold to draw (the meter under the hero fills), let go to shoot; a
  full draw flies faster and hits harder. Moving while drawing is slow. **Iron Arrows** never run out (∞ in the bag);
  better arrows (Steel Arrows, stacks of 64) are bought or looted and used up. Choose them in the bag with
  *Nock these arrows*; when they run out the iron ones take over.
- **Magic (3)**: Fire, a firebolt that lights its way, once learned in the skill tree (MP cost in Database → Combat).
- **Block (E / RT, hold)**: hits from the front are mostly stopped, for stamina; out of stamina the guard breaks.
  Raising the guard just as a hit lands is a **parry**: no damage, and the attacker staggers.
- **Lock-on (Tab / RB; again for the next target; Q / LB releases)**: the hero faces the target and strafes around it; attacks aim at it.
  With a bow equipped the lock-on reaches much further, so distant enemies can be picked off.
- **Dodge (Space while locked on)**: a quick roll that can't be hurt, for stamina.
- **Carried weapons**: the readied weapon is slung on the hero's back (the sword's hilt or the bow over a shoulder, a
  shield flat on the back), so what's ready shows at a glance. It comes into the hand only to fight: for a swing (and
  between the hits of a combo), while guarding, and while drawing and loosing the bow, then goes back. Animated (LPC)
  heroes hold the weapon's LPC sprite and swing it with their own animation; others show its icon swinging at the hand.
  With a bow readied a quiver rides on the back too (it stays there while shooting). With Fire selected a small ball
  of fire burns in each of the hero's hands, flaring up when a spell is cast.
  Enemies do the same: weapon on the back, in hand from the wind-up to the end of the attack. Database → Enemies →
  *Holds* (and *Weapon sprite* for animated characters) changes what they carry.
- **Feel**: hits freeze the action for a moment (hit-stop), knock enemies back, shake the camera a little, and show
  damage numbers. After being hurt the hero blinks and can't be hurt again for a moment.
- **Defence**: armor and accessories have a defence value; damage is reduced by defence ÷ (defence + 50).

**Stealth (C to sneak)**: sneaking is slow and quiet, and the hero crouches. An eye at the top shows *Hidden*,
*Noticed* or *Detected*, and the screen's edges darken the better hidden you are (in the dark, sneaking): they ease off
when someone grows suspicious and clear when you're seen. Enemies see further in light and much less in the dark (the time of day, the map's lamps
and fires, and the Light spell all count), have a field of view, and hear running and fighting. Each enemy builds up
awareness: **?** = suspicious (it comes to look), **!** = alert (it attacks and calls nearby friends). **Hitting an
unaware enemy is a sneak attack** (×2.5 damage by default). An arrow that kills an unaware enemy only makes its
friends come and look instead of alerting them.

**Enemies** (Database → Enemies): health, damage, defence, speed, a behaviour (**melee**, **ranged**: keeps its
distance and shoots, **charger**: winds up then rushes in a straight line), attack range, wind-up (the glow before
each attack: the tell to dodge), time between attacks, sight, field of view, hearing, EXP, gold and item drops, a
size, and a boss flag. They look like a character from the database or a built-in monster (green, blue and ember
slimes). They walk around cliffs and up ramps to reach the hero. Place one with **Create enemy here** in the Events
layer, or set an event page's Appearance to **Enemy**. The page's commands run when it's defeated (open a gate,
set a switch); beaten enemies come back when the player returns to the map.

**Levels**: enemies give EXP; each level gives a **skill point** (see *Skill tree*). The level
shows big beside the bars, and a green EXP bar runs along the bottom of the screen (full, showing MAX, at the top
level). **Database → Player → EXP progression** sets the highest level (default 50, up to 99) and how much EXP each
level takes: start from a curve (EXP for level 2 and how much more each level needs), then type over any row of the
table to set it by hand. A chart shows the shape; *All ±10%* scales the whole table and *Rebuild from the curve*
drops the hand-set numbers. Database → Combat sets points per level and all the combat tuning above.

**Sample map**: slimes around the pond and paths, an ember slime (charger) in the east meadow, and a bandit camp
on the plateau to the north-east (two bandits and an archer), with the ramp as the way up. The hero starts with a
Short Sword, a Hunting Bow and Iron Arrows; bandits drop Steel Arrows.

### Turn-based battles (optional battle system)

**Database → Combat → Battle system** chooses how the game fights: **Action** (everything above, the default) or
**Turn-based**, in the style of Final Fantasy X and the Game Boy Advance Pokémon games. Heroes, stats, gear, spell
shards, items, enemies, EXP, gold and drops are the same in both, so a game can switch at any time.

- **On the overworld** the hero's **sword and bow are field tools**: always there (not bag items, no arrows needed),
  for cutting vines, breaking crates and shooting switches. An equipped weapon or bow is shown instead when there is
  one. The **Enable / disable overworld weapons** event command turns them off indoors or in restricted areas: they're
  greyed out on the HUD with a red ✕ until an event turns them back on.

- **Starting a battle**: an enemy on the map that reaches the hero (its strike or its arrow) starts a battle with it
  and the enemies near it (*Enemies who join*, up to *Most enemies in a battle*). Hitting it first on the map, with a
  sword, an arrow or a spell, gives the party the first turns (*You caught … off guard!*); being hit from behind is an
  **ambush** (the enemies go first). Stealth still matters: sneak up on an enemy to strike first.
- **Damage and health vary**: every hit varies a little (Database → Enemies → *Damage ± %*, 10 by default) and is
  then cut down by the target's Defence (or Magic Defence for magic) and guarding. *Health ± %* rolls each enemy's
  health either side of its Health, so no two slimes are quite the same.
- **On the battle map** every fighter shows the frame for the camera's direction (from behind the party: three backs,
  never two backs and a side view), and ambient occlusion leaves the fighters alone (no shaded box around them).
- **Random battles**: paint encounter zones on a map's **Spawns** layer and give each zone its troops (below). Maps
  made before zones may still have an older *random encounters* list (shown in map settings → Random battles, with a
  button to remove it); it only applies outside painted zones. Works alongside enemies placed on the map.
- **Battle cameras**: on a battle map, **LB / RB** (Q / E, or tap the camera chip top-left) switch between seven
  cameras: behind the party, over either shoulder, high above, low and close, and wide from either side. Each
  battle starts on one at random, most often the one behind the party.
- **Three a side, eight in the party**: the party holds up to eight (the hero and seven more). The hero and the first
  two of the lineup fight (and follow on the map); the rest wait on the bench. **Swap** on any hero's turn brings one
  in where they stood, and the newcomer takes that turn (no turn is lost). Whoever finishes a battle stays at the front
  of the lineup. Up to three enemies (troops, zones and Start battle are capped at three). On a battle map, put P1 (the
  hero) in the middle and P2 / P3 either side.
- **On the stage**: an arrow over whoever's turn it is while they choose. Additions: the camera closes in from the
  side as the hero rushes up to the front of the target; the damage lands all at once when the string ends (a missed
  strike ends it, with the damage of the strikes that landed); a pause, then they run back. Spells: the camera swings
  round between the caster and the foes, looking back at the caster (who keeps facing the foes) as they raise their
  arms (their chant, for a spell that charges), then back; when it goes off, in front again for the call-out, back,
  and only then the spell. Sprites face the way they're turned in the world whichever way the camera looks.
  Character Builder sheets don't always have every clothing layer in every pose: a pose that loses clothes or
  accessories compared with the walk is left out automatically (the standing / walking frames are used instead). Items: they turn to whoever it's for and toss it. Badly hurt (a
  quarter of their health or less) or ailing, fighters crouch and breathe slow and heavy (a sheet with a `kneel` or
  `sit` animation kneels instead). The field's weather and mist carry on over the battle.
- **Voices**: Database → Spells → *Call-out* (as it goes off) and *Chant* (while it charges); Database → Additions →
  *Call-out* (when the whole string lands); Database → Heroes → *Attack sounds* (one at random when they land a weapon
  or bow attack). Import voice clips in Database → Audio.
- **Victory music**: the fanfare, then Database → Audio → *Music after the fanfare* (unset: the map's music).
- **Healing out of battle**: Menu → Abilities → a hero → a healing spell: cast it on the party (it costs their MP).
- **Battle screen layout** (Database → Combat): **Dragon Legend** (default, Legend of Dragoon style): each hero's
  card in a row along the bottom (the hero in the middle), with their face (Database → Heroes → *Face art*, or one cut
  from their look), name, and HP / MP as numbers that are white, yellow at half or less, red at a quarter or less. A
  gold frame marks whose turn it is; a silver card is the one being chosen for a spell or item. Items and Magic open
  in the middle of the screen with their pictures and costs, and what the chosen one does in a box at the top.
  **Forbidden Fantasy**: health and magic bars in a box at the bottom right, lists at the side.
- **Choosing a target**: enemies are one row and the party another. Left / right move along the row; up / down
  change rows.
- **Commands** (Legend of Dragoon style): a row of pictures, Attack, Guard, Magic, Items and Escape; left / right
  choose. Any fighter can be targeted with an attack, a spell or an item (the usual side first; keep pressing left /
  right to reach the other side): heal a friend, or use a potion on a zombie to hurt it. Spells that hit a whole
  group can be switched to the other group. The arrow over the target shows their health: **cyan** above half,
  **yellow** at half or less, **red** at a quarter or less. Enemies' names and health bars are over their heads.
- **Into battle**: a sting, everything freezes, and the picture breaks into black: **shatter, swirl, smudge,
  blinds, rush in** or **flash**, with a rising swell. Map settings → Battles → *Battle transition* picks one, or
  several to choose from at random (none picked: any).
- **Victory**: a fanfare, then the victory tune. Each hero's EXP bar fills in turn (a level up dings and lists what
  it brought: Max HP, stat and skill points), then the **Spoils**: gold and each item with a sound for its kind
  (coins, a cork and slosh for potions, a chime for key items, a clunk for materials, steel for gear). OK hurries
  things along; **B** (Esc) at the end fades the battle and its music out and the field back in.
- **Battle maps** (FFX / Legend of Dragoon style): a battle can be fought on a map you've made (a forest clearing,
  plains, a city street). Make a map and tick **Battles → This is a battle map** in its settings (or choose *Battle
  map* when making a new map); battle maps are listed apart in the map list. On the **Spawns** layer (key 9) of a
  battle map, place **party markers** (P1 is the hero, then the party in order) and **enemy markers** (E1, E2…). The
  camera stands behind the party looking at the enemies, so put the party near the bottom of the map and the enemies
  above them. *Camera back / up / side* and *View angle* fine-tune it. Then choose where battles are fought: a field
  map's **Battles → Battle map**, a zone's **Battle map** (Spawns layer), or the **Start battle** command's *Battle
  map* (boss arenas). Without one, battles use the flat battle screen. On the stage, attackers dash to their target,
  Additions keep the hero at the foe for the whole string, spells flare in their colour, and the fallen sink away
  (enemies) or fall (heroes). `battle_forest` is a sample.
- **Troops and encounter zones**: **Database → Troops** are groups of enemies that fight together (each enemy with
  *at least* / *at most* how many, their own battle music, and *can't run*). On a map, the **Spawns** layer (key 9)
  paints zone letters A, B, C… on tiles, like the Height layer paints numbers. Pick a letter and, below it, set the
  zone's name, tiles between battles and its troops: each with *how often* (a weight) and optional conditions:
  **day or night** (game clock), **real-world days of the week** (the player's computer clock: a Friday-only
  troop, say) and a **switch** that must be ON. Unpainted tiles have no random battles (unless the map has its own
  Random encounters list, which still applies outside zones).
- **Turn order**: *Conditional turns (FFX)*: fast fighters (Dexterity for heroes, **Agility** for enemies in
  Database → Enemies) act more often, and light actions (Guard, Items, a failed Run) bring the next turn round
  sooner. The bar on the right shows who's coming up, and changes as you move through the commands, like FFX.
  *Rounds (classic)*: everyone acts once a round, fastest first.
- **Commands**: **Attack** (the equipped weapon; a bow if there's no melee weapon), **Magic** (the spell shard in the
  magic slot; healers also have *Heal*), **Items** (consumables from the bag, on anyone in the party; cures work on
  battle ailments), **Guard** (Legend of Dragoon style: half damage, a little health back (*Guard heals %*, default
  10) and no new ailments until your next turn) and **Run** (more likely when the party is faster; never from a boss).
  Elements, weaknesses, immunities, absorbing, critical hits and Defence / Magic Defence work as on the map.
- **Winning** gives EXP to everyone standing, gold and drops straight into the bag (a full bag leaves them on the
  ground) and runs the beaten enemies' page commands. A hero knocked out in a won battle gets back up with 1 HP.
  **Losing** sends the party back to the respawn point, as dying does in action mode. Running away leaves the enemies
  on the map; they lose track of the hero for a moment.
- **Tuning**: *Party damage ×* and *Enemy damage ×* scale each side's hits; *Safe after a battle* stops a new
  battle starting straight away. The map's **battle music** plays during battles (the built-in battle theme if the map
  has none).
- Controls: arrows / D-pad move, OK picks, Cancel goes back; on a tablet, tap a command, then tap the target.
- **Ailments in battle** run on turns instead of seconds, counted on the afflicted fighter's own turns: Burn (8% of
  their health at the start of each turn, 3 turns), Poison (5%, 5 turns), Chill (slower turns; three freeze),
  Frozen and Paralyze (lose a turn), Sleep (lose turns until hit, up to 3), Blind (half their attacks miss),
  Silence (no Magic), Confusion (attacks anyone, friend or foe), Stagger (the next turn comes later) and Zombie
  (healing hurts, all battle). Weapons and enemies give them with the same *Ailments its hits can give* settings
  as on the map (a time set in seconds becomes about one turn per 3 seconds); bosses shake them off in half the
  turns. Icons show over each fighter and beside party names. The hero brings their ailments from the map into a
  battle; battle ailments end with the battle. Buffs don't carry into battles yet.
- **Enemy actions** (Database → Enemies → *Turn-based battles*): besides its plain attack (*how often*, 0 for
  never), an enemy can have actions: **Attack** and **Spell** (its damage × power, on one of the party or all of
  them, with their own element and ailments), **Heal** (itself or a hurt friend, % of their health) and **Guard**
  (enemies only guard when given this). Each has *how often* and can be limited to *only below health %*.
  **Counterspell** (on an action or the plain attack) will break a spell being charged once spells can be charged.
- **Magic** (turn-based): the hero's **learned spells** (see below). Spells known at more than one rank ask which
  rank to cast: a higher rank hits harder and costs more, and **charges** a turn longer for each rank (the caster
  shows *Fire III · 2* and the turn bar keeps going; it goes off on their turn). Casting is quicker than attacking in
  the turn order. A foe's **Counterspell** hit breaks a spell being charged (the magic is lost), and so does Silence.
  Healing spells can heal one or the whole party; attack spells can hit one or every foe.
- **Additions** (Legend of Dragoon): Attack performs the hero's Addition, a string of 1 to 7 timed strikes. For each
  strike a ring closes on the target; press the button shown (A, B, X, Y, or ★ for any) as it meets the marker.
  Keyboard: the letters A, B, X, Y (Space / Enter for A); controller: the face buttons; touch: the four buttons
  that appear. A miss or the wrong button ends the string (a missed first strike still lands, weakly); perfect
  timing adds 10%. Performing an Addition in full counts towards its next **rank** (more damage, a wider window).
  Database → Combat → *Additions*: set per hero in Menu → Abilities (default), or chosen from a list with each Attack;
  *Addition timing: Automatic* lands every strike by itself (accessibility).
- **Start battle** (event command): a turn-based battle against chosen enemies (bosses, set pieces), in either battle
  system. The event waits for it. Options: may the party run, what losing does (back to the respawn point, or the
  event goes on: a story battle meant to be lost), a variable for the result (1 won, 2 ran, 0 lost), its music.

### Learned spells, Additions and classes

- **Database → Spells**: attack spells (bolts) and healing spells: power and magic cost at rank 1, element, ailments,
  one target or all, the highest rank and what each rank adds (power %, magic %, one more charge turn), and for action
  mode the bolt's speed and range. Built-in: Fire, Frost, Spark (every foe) and Mend.
- **Database → Additions**: strikes (power × the hero's attack, button, how long the ring takes, the timing window)
  and mastery (highest rank, completions per rank, damage and window per rank). Built-in: Quick Strike, Double Slash,
  Volley and Crescent Storm (seven strikes).
- **Learning**: a skill-tree skill can teach a spell or an Addition (Database → Skills → *Teaches*; each further rank
  of the skill raises the spell a rank). The built-in trees teach them: Arcana (Fire), Empower (Fire II, III), Frost
  Lore, Storm Lore (Spark), Mending (Mend), Fighter (Quick Strike), Double Slash, Volley and Crescent Storm. Events and
  trainers use the event command **Teach spell / Addition** (to the hero, a party hero or everyone); heroes can start
  with some (Database → Heroes → *Class, spells and Additions at the start*).
- **Classes** (Database → Classes): each class opens skill trees. A hero learns from the trees of their class and of
  every class they've had: changing class adds trees and never takes away what was learned. The event command
  **Change class** changes a hero's class or unlocks it; unlocked classes can be chosen in **Menu → Abilities**.
  Without classes, every hero sees every tree.
- **Menu → Abilities** lists each hero's spells and Additions (with rank and progress), changes class, sets the
  Addition Attack uses, and in action mode readies a learned attack spell for the spell button (it takes the place of
  a spell shard there; shards still enchant gear at the forge, and an equipped shard still works when no spell is
  readied).

### EXP orbs and loot on the ground

Defeated enemies don't hand over their rewards at once: they spill them onto the ground around them.

- **EXP**: under 10, small single orbs (one per point); 10 or more, **large orbs** of up to 50 each (75 EXP is a
  50 orb and a 25 orb).
- **Gold**: under 10, single **coins**; 10 or more, **coin purses** of up to 100 each (130 gold is two purses).
- **Items**: each stack lies on the ground as its icon.

Orbs, coins and purses drift to the hero when they come near and are absorbed (a burst shows as one "+N EXP" and one
"+N G"). Items are picked up by walking over them. If the bag is full, a **BAG FULL** alert offers to open the bag so
the player can drop something; the item stays where it is (walk away and back to try again). Bag →
**Drop** (one, or the whole stack) puts it down by the hero's feet: it lies there dimmed for a few seconds (and
until you step off it), then brightens and can be picked up again by walking over it.

- **Saving** collects everything still lying around (anything that still doesn't fit stays on the ground).
- **Leaving the map**: EXP and gold are collected; **key and quest items** come along; other items **vanish**
  (the log says what was left behind).
- Starting a new game, loading a save or quitting to the title clears it.

### Breakables (crates, boulders, crystal switches)

Events can be **breakable**: the hero can lock on to them and hit them with the sword, arrows or spells, a health bar
shows once they're hit, and when their health runs out they shatter and the page's commands run. Use them for
puzzles: a crystal switch across a gap that lowers a bridge (*Set switch* `bridge_down`, and the bridge event's
page shows up on that switch), a cracked boulder blocking a cave, crates with something inside.

- **Create breakable here** (Events layer, on an empty tile) makes a crate whose commands set a switch, and a second
  page showing rubble once it's set. Change its sprite to **Cracked boulder** or **Crystal switch** (new built-in
  sprites), add your own commands, or tick **Breakable** on any event page (Behaviour).
- **Health** and **Defence** (softens each hit like armour), the **name** over its health bar, and **Broken by**:
  melee, arrows, magic. Attacks it doesn't take show *No effect* (a crystal only magic reaches, a rope only arrows).
- Broken things stay broken while you're on the map; to keep them broken after leaving, set a switch in their
  commands with a later page for it (the helper does this).

### Quick items

Three quick slots, laid out like the D-pad (bottom right): **←, ↑ and →** on a controller, **5, 6 and 7** on a
keyboard (rebindable), or tap them on a touch screen. The fourth spot shows what D-pad ↓ does (*Release target*, or
whatever it's rebound to, with its key). In the bag, pick a
consumable → **Quick slot…** and choose a slot (it shows a small arrow badge in the bag). Each slot shows the item and
how many are left; it stays assigned when they run out (greyed out) and fills again when you get more. An item that
would do nothing (health already full) isn't used up. The HUD arranger can move and resize the slots.

### Footsteps

The hero's footsteps sound like the ground: grass, dirt and paths, stone, wood floors and bridges, sand and gravel,
snow, carpet, metal, and splashes in shallow water. Running is louder and quicker, sneaking soft (quieter still with
the Light Step skill), and landing from a jump thuds. Each tile's sound is guessed from its name; change it in
Terrain → the tile → **Footsteps** (built-in and imported tiles, *Silent* for none). The sounds are made in code, like
the other effects, and can be swapped for your own files in Database → Audio (*Footstep: grass* and so on).
Settings → Sound → *Footsteps* turns them off.

### Adventure log

A short feed of what's happening, bottom left: hits given and taken, defeats, loot, EXP, level-ups, items received
from events and notices. Each line fades after a few seconds (a repeat just counts up: "×3"). The pause menu's
**Adventure Log** has the whole session, newest first, with the in-game time. Settings → *Adventure log* shows
everything, everything but hits, or nothing on screen; the HUD arranger can move and resize it like the other pieces.
Lines start at the left and wrap inside the log's box (the oldest go when it's full).
Database → Title & menus can rename or hide the menu entry.

### Quests

- **Database → Quests**: each quest has a name, **main** (★, listed first) or **side**, who gives it and where, a
  description, its **objectives** and its **rewards** (gold, EXP, skill points, items). Objectives are:
  - **Task**: ticked off by an event (talk to someone, open a gate…). Give it a count above 1 to count it up in steps.
  - **Defeat enemies**: beat a number of one enemy type (counted while the quest is in progress).
  - **Collect items**: carry a number of an item. It's counted from the bag, so selling or using them undoes it.
  - **Reach a map**.
  Any objective can be **optional**. *One at a time, in order* shows (and counts) only the current objective.
- **Finishing**: a quest either *completes by itself* when the last objective is done, or waits, **ready to hand in**
  (the log says "Return to Mira", or your own line), until an event completes it. *Completing it takes the items*
  takes what its collect objectives asked for. Rewards that don't fit in the bag are put down by the hero's feet.
- **Events**: the **Quest** command starts a quest, completes or counts up an objective, completes the quest (gives the
  rewards), fails it, or forgets it (back to not started). Conditions (in branches and on event pages) can check a
  quest's state (not started, in progress, ready to hand in, completed, failed) or one objective. *Quietly* skips the
  banner.
- **In game**: a banner and a jingle when a quest starts, is ready to hand in, completes or fails; every step goes in
  the adventure log. The **tracker** (top right, under the clock) shows the followed quest's objectives with their
  counts; the HUD arranger can move and resize it. The pause menu's **Quest Log** lists quests in progress, completed
  and failed, with the story, objectives, status and rewards; Enter (A) or *Follow this quest* picks the one the
  tracker shows. A new quest is followed automatically when nothing else is. Quests are saved with the game.
- The sample map has a main quest (talk to Mira, then rest at the campfire) and Mira's side quest, *Slime Trouble*
  (defeat three green slimes, then go back to her).

### Skill tree

Each level gives a **skill point** (and a new game starts with one; quests can give more with the **Give skill
points** command). Spend them in **Party → a hero → Skill Tree** (each party member has their own), laid out like Skyrim's constellations: a skill
opens once at least one rank of the skills it's linked from is learned, and many have several ranks.

- **Might**: Fighter → Quick Hands (swing speed) → Steady Guard (cheaper blocking); Heavy Blows (melee damage);
  Arms Training → Light, Medium or Heavy Mastery (damage and speed for that weapon class).
- **Dexterity**: archery (Archer → Steady Draw, Eagle Eye (longer bow lock-on), Power Shot) and stealth (Shadow →
  Light Step (quieter), Backstab (bigger sneak attacks) → Assassinate (level 5: a sneak attack kills an ordinary
  enemy outright), and Silent Shot (needs Light Step and Archer: arrow kills from 5+ tiles don't alert anyone)).
- **Magic**: perks that make every spell shard better (see below).
- **Vitality**: Toughness, Endurance and Focus raise max health, stamina and magic.

Every tree, skill, rank, cost, level requirement and effect can be edited in **Database → Skills** (add trees and
skills as new abilities arrive). A **LEVEL UP** banner appears at the top of the screen on each level.

### Sound

- **Built in**: every sound effect, six background sounds (wind, forest birds, night crickets, cave drips, stream,
  rain) and five music tracks (title, fields, night, battle, cave) are generated in code, so there's sound from the
  start. They're placeholders to swap for real audio.
- **Your own audio**: Database → Audio → *Import audio file…* (.ogg, .mp3, .wav; saved to `assets/audio/`). Swap any
  sound effect for a file (or make it silent) and pick the title music there.
- **Per map** (map settings → Sound): music, **battle music** (takes over while an enemy is hunting the hero and
  fades back after), background sound, and a night background sound for outdoor maps.
- **Events**: Play sound effect, Change music, Change background sound (each lasts until the player leaves the map).
- **Settings → HUD**: *Hero bars* long (across the top) or condensed (a card with the party's), *Show hero bars*,
  *Show party bars*, and *Faces* beside the bars.
- **Settings → Sound**: **Master volume** (50% to start), music, sound effects, background sounds, **menus and text**, and **fanfares and chimes**. Browsers only allow sound after the first
  click or key press, so the title music starts then.

### Field uses: key items (Light, Water Walk)

Overworld abilities come from **key items**: the built-in **Lantern** (Light) and **Strider Boots** (Water Walk).
Pick one in the bag (**Key items** tab) and choose **Turn on** / **Turn off**, or **Assign to the B button** so **B**
(controller), **F** / **3** or the Spell button on touch screens switches it on and off. Only one is on at a time;
they cost no magic. Set them up in **Database → Items**: Kind *Key / quest item* → **Field use**:

| Use | What it does |
| --- | --- |
| **Light** | A glow all around the hero: a **lantern**, a flickering **torch** or an **orb** floating by them. Colour, brightness, reach and shadows are set per item. |
| **Water Walk** | Water of any depth is solid ground: no swimming, no stamina. Switches off by itself when the hero steps back on land. |

- While one is on the hero glows (gold for Light, blue for Water Walk). Over deep water the hero is put back on the last bit of shore.
- The HUD's spell box shows the item on the B button; it lights up while it's on.
- **Older databases**: spell shards that carried Light or Water Walk become these key items when the database loads
  (a shard still named *Light* / *Water Walk* becomes the Lantern / Strider Boots); choosing a field use for a shard
  in the editor makes it a key item too. Older still: Light and Tide rings (open the editor and Save to keep the
  change); cutting rings are removed (sword swings cut vines). Saves wearing one
  in the ring slot move it to the magic slot. There's no Ring slot any more: rings with stats are accessories.
- **Cuttable props**: tick *Can be cut down* in a prop's importer (or *Customise* for built-ins); a sword swing cuts
  them. Built in: **Vines (cuttable)** and **Sapling (cuttable)**.

### Mining and forging

- **Mining**: swing a weapon that *Breaks rock* (Database → Items → a weapon; the built-in **Pickaxe** does) at a
  mineable prop. Each blow chips it; the last breaks it open, leaving rubble and spilling what it gives (stone, ore),
  which can be picked up a moment later. Other weapons bounce off. Built in: **Large boulder** (stone), **Iron vein**
  (iron ore, sometimes extra) and **Gold vein** (gold ore). They're back the next time the player comes to the map.
  Any prop can be made mineable: its importer (or *Customise*) → Behaviour → *Can be broken: Mined*, with the
  number of blows, what it leaves behind, and what it gives (each with a chance in %).
- **Forges**: the **Anvil** prop (or any prop marked *Is a forge*). Facing it, the action button opens the forge:
  - *Smelt ore*: ore into ingots (Database → Items → an ore → *At a forge, smelts into*; two ore make one by
    default). Two Iron Ingots make a Steel Ingot.
  - *Upgrade*: weapons and armor are made of a **material** (an ingot: Database → Items → *Material*). Each upgrade
    takes ingots of it (+1: one, +2: two…) and adds a few percent of damage or defence (Database → Combat →
    *Forges*: how many upgrades, and the percent). The item shows as *Longsword +2*.
  - *Enchanting* is done from the bag now (a shard → Set in…): an elemental shard in a weapon (every hit takes its element, a little more damage, and
    its ailments) or in armor, a shield or an accessory (that element's damage is halved). Take it out any time.
    An enchanted weapon glows softly in the element's colour and its swings leave a trail of it; enchanted
    gear has a coloured halo in the bag.
  - Upgrades and shards apply to every copy of an item, and are saved with the game.
- Fire (a fire spell, arrow or weapon) **burns away** cuttable props (vines, saplings), giving nothing: they catch
  fire, blacken and crumble, with *Burnt!* over them and a line in the adventure log, so it's clear why nothing dropped.
- **Weapon proficiency**: light weapons are ready from the start; medium and heavy weapons swing slowly until the
  hero is trained (Might tree: *Arms Training* for medium, *Heavy Arms* for heavy). Trees without a training skill
  (older copies of the tree) don't slow anything.

### Magic tree

Spell shards are items (found, bought, given by events or quests); the skill tree doesn't hand them out. The
built-in **Magic** tree makes every shard better instead: **Arcana** and **Empower** (spell bolts hit harder),
**Mana Thrift** (every spell costs less magic, including switching on and keeping Light or Water Walk going),
**Radiance** (Light shines further) and **Far Cast** (bolts fly further). Older skills that gave a shard become
spell perks when the database loads; a copied tree gets the new Magic skills with *Reset to built-in*.

### Water styles

Each map has a list of water **styles** (Map editor → **Water** tab), and every bit of water uses one, so a calm
lake, the stream running out of it and a lava pit can share a map. Pick a style, then Fill / Paint with it, or
use **Restyle pool** to change one already placed. **+ New style…** starts from a preset: Pond, Lake, River,
Tropical sea, Muddy pond, Swamp, Poison goo, Lava. Each style sets:

- *Editor mark*: a symbol (~, -, ≈…) drawn on its water in the map editor only, to tell styles of the same colour apart.
- *Colour* and *Clarity* (crystal clear … muddy / thick), *Surface* (glassy … rough), *Current* (still … a fast
  river) with the direction it flows (it carries the ripples along).
- *Glows*: lava and goo shine in the dark (brightly veined, with light seams drifting with the current).
- *Being in it gives*: an ailment with a chance every half second (Lava burns, Poison goo poisons). Water Walk
  keeps the hero above it.

The surface is calm and matte (no plastic glare). Rings spread around anyone in the water (the hero swimming or
wading, party members swimming) and slowly around props standing in it (a stone, a fallen trunk); on glowing
liquids they take its colour. Swimming has its own stroke sound (Database → Audio: *Swimming stroke*). A map's
older single water look becomes its first style.

### Seasons

- Seasons match the **real world** by default (the player's date: March–May spring, June–August summer,
  September–November autumn, December–February winter; a southern-hemisphere option flips them). **Database → Time
  → Seasons** can make them follow the in-game days instead (days per season, the starting season), or turn them off.
- **Real-world date**: the HUD shows the player's date (and the season) under the game time. Event pages can use the
  condition **Day of the week (real world)**: a market only on Saturdays, a rare enemy on Fridays. A map can have its own season
  (Inspector → map settings → **Season**: follows the days, or always spring / summer / autumn / winter). Indoor and
  underground maps don't change. The playtest panel has season buttons for testing.
- Outdoors everything green follows the season: fresh green in spring, green-gold in summer, autumn's even straw-gold
  grass with each tree and bush turning wholly red, orange or gold (one colour per plant, no patches), and snow in winter
  (grass under it, a dusting on evergreen leaves).
- Props have a **Seasons** setting (prop importer): *keeps its leaves* (pines, flowers: snowy in winter), *bare in
  winter* (oaks, bushes: only branches) or *doesn't change*. Unset, it's guessed from the name.
- **Ice**: in winter, still water (no current, not lava or goo) freezes over. The hero walks onto it and slides,
  steering only a little, until a prop, a bank or dry ground stops them. Rivers keep flowing. Going into or out of
  winter, the map is rebuilt with a quick fade.
- **Sound**: map settings → Sound → *In autumn & winter* sets a cold-season background sound; unset, a forest's
  birdsong gives way to cold wind.

### Rivers and drowning

- A water style's **Current** pushes swimmers along the way it flows (waders a little): swimming with it is quicker,
  against it slower, and drifting carries you downstream.
- Running out of health while swimming, the hero sinks below the surface and drowns (a slower fade), then wakes at
  the respawn point as usual.

### Fishing

- **Where**: Map editor → **Water** tab → **Fishing** (key G). **+ New fishing spot** makes a catch table, then paint
  it over water (Erase removes it). A map can have several spots: the pond's minnows, the river's trout, the sea's…
- **What bites**: each spot lists its catches with a **weight** (its share is shown as a %), **when** it bites (any
  time, by day or at night) and whether it's **rare** (a better rod makes rare ones likelier). Any item can be on
  the list (junk too: the Old Boot).
- **The rod**: an item marked **Fishing rod** (Database → Items → Fishing), with a **power** of 0 … 100 (sooner bites,
  a little longer to react, more rare catches). The best rod in the bag is used. Items can also be marked as a
  **fish** with a usual length: each catch is a little bigger or smaller, and Records keep the biggest.
- **In the game**: face a fishing spot from the bank and press **Talk / interact** (A, Enter, or the touch Jump button):
  the hero casts and the float bobs on the water, with the odd nibble. When it's pulled under (a "!" and a plip),
  press again quickly to land the catch; too soon or too late and it gets away. Walking off, jumping or getting hit
  reels in. Catches go in the bag (the adventure log says what and how big); Records count fish caught and the
  biggest.
- **Built in** (added to a database once): the Fishing Rod, Minnow (+10 HP), Trout (+30 HP, by day), Night Eel
  (+20 MP, at night), Golden Koi (rare, sells well) and the Old Boot. Sounds: *Fishing: cast / a bite / caught one*
  in Database → Audio.

### Copying events and area events

- **Copy / paste**: select an event and press **Ctrl+C** (or **Copy** in its panel), point at a tile and press
  **Ctrl+V** (or select a tile and click **Paste … here**). The copy keeps everything: pages, commands, size.
  It works across maps too. **Duplicate** puts a copy right beside the original.
- **Area events**: in the Events layer, drag across empty tiles to select a rectangle, then **Create event over
  these tiles** or **Create transfer over these tiles**. It's one event; stepping on, talking to or bumping into
  any of its tiles counts. Change its **Width / Height** in the event panel; drag it by any tile to move it.
- Events can't overlap. Transfers show an arrow on the map.

### Map transfers

In the Events layer, click a tile and choose **Create transfer here**: it makes an invisible event that runs when
the player steps on it, and opens the **Transfer player** command. Pick the destination map, click the spot on
the picture of that map, choose which way the player faces and the fade (black, white or none).

You can also add **Transfer player** to any event (after a conversation, say, or behind a door that needs a
switch). It ends the event, so put it last. Switches, variables, abilities, health and the time of day carry
over between maps. For a two-way doorway, make a transfer on each map.

▶ Playtest hands every map in the project to the game, so transfers work with unsaved changes too.
Losing all health now sends the player to the player start even when it's on another map.

### Database: player stats

**Database** in the top bar opens the game-wide player settings (saved in `database.json`, only values that differ
from the defaults):

- **Health, magic and stamina**: maximum, how much each regains per second, and *Does not regenerate
  automatically* for each. By default health doesn't regenerate (only items and events heal); magic and stamina
  refill on their own. Everything starts full.
- **Stamina costs**: run, climb and swim per second, jump per jump. At 0 stamina the player can only walk (and
  crawl) until stamina refills to **Abilities return at** (30% by default). Stamina starts refilling after a short
  rest (**Refills after**). Swimming with no stamina left costs health (**Drowning**).
- **Movement speed** for walking, running, wading, swimming, crawling and climbing, in tiles per second.
- **Starting abilities** (the same switches as on the Passage layer).

In the game, HP / MP / SP bars sit top-right. At 0 health the screen fades and the player comes back at the
player start with full stats (respawn points such as campfires come later). The playtest's debug panel has
test buttons: −25 HP, Empty stamina, Refill.

### Passage layer and abilities

- Paint per-cell movement rules with the brush (shortcut letters in brackets):
  **Climbable (C)**: cliff walls next to it can be climbed (mark the top or the bottom cell);
  **Low clearance (L)**: only passable by crawling; **Wall (X)**: always blocked; **Open (O)**: always passable,
  even under a blocking tile or prop; **Erase (E)**.
- Red crosses show what already blocks a cell (blocking tiles, props, deep water), so you can see what to override.
- **Player abilities at the start** (whole game, saved in `database.json`): Run, Jump, Climb, Crawl. Turn one off
  and unlock it later with the **Change ability** event command.
- How they work in the game:
  - **Run**: hold Shift (or the Run button on a touch screen). Not in water or while crawling.
    Running, jumping, climbing and swimming use stamina (see Database).
  - **Jump**: C (or the Jump button). Clears one step up, a one-tile gap walking, about two tiles running. You can
    jump down at most two steps; missing a jump (into deep water, or a longer drop) puts you back where you jumped.
    No jumping while swimming or crawling.
  - **Climb**: walk into a climbable wall for a moment and the hero climbs up or down it.
  - **Crawl**: walking into a low-clearance cell crouches automatically, at a slower pace.

### Edge blending between tiles

Select a tile in the Terrain palette and click **Edge blending…** (works for built-in and imported tiles):

- **Blend edges**: off gives a straight, hard edge with every neighbour.
- **Priority**: where two tiles meet, the higher one spreads over the lower. Built-in: grass 30, path 20,
  sand 10, lake bed 0. Imported tiles start from their name: grass and snow 32, dirt and paths 22, stone 18,
  sand 14, shallow water 8, water 5 (all with ragged edges); floors, walls, roofs and carpets don't blend (straight
  edges, as built things have); anything else 25. With equal priorities, the tile imported later spreads.
- **Blend width** (0.05 – 0.5 tiles) and **Edge roughness** (an even line → a wandering one).
- **Edge style**: *Ragged* (hard pixel edge), *Dithered* (pixel-art fade) or *Smooth* (soft fade, for smooth
  textures). The edge of the tile that spreads is the one used.
- **Follow texture detail** (imported tiles): bright parts of the texture, like stones, reach further.

The window previews the tile next to any other. Blending shows in the game; the editor map keeps square tiles.
Edges never blend across a cliff or a shoreline. Settings are saved in `assets.json` (`tileBlend`).

### Importing tiles from textures

In the Terrain layer, click **+ Import tile from texture…** (or drop a texture on the preview).

- **Texture**: ideally seamless. Non-square images are cropped to their middle square.
- **One copy covers**: 1 × 1 up to 8 × 8 tiles. Spreading a detailed texture over more tiles hides the repeat.
- **Resolution**: keep the texture's detail, or resample to 16–64 px per tile. **Filtering**: *Point* (crisp pixels)
  or *Smooth*. Draw new tiles at 32 × 32 and import them at 32 px per tile + Point, to match LPC characters.
- **Blocks movement** for water, walls and similar.
- **Normal map** (optional, with *Flip green channel* for DirectX-style maps). Without one, one is generated.

The preview shows a patch of ground covered with the tile, exactly as it will be saved. Files go to
`public/assets/tiles/<id>.png` (and `<id>_normal.png`) and the list to `public/data/assets.json`. Select an imported
tile to **Edit…** or **Delete** it (✎ on its swatch also edits). Deleting turns its cells on the open map back into
grass; other maps show grass where it was used. Imported tiles have hard edges for now; soft blending comes later.

### Editing props

Select a prop in the palette: the panel at the top shows its actions. Each card also has a ✎ button, and clicking a
placed prop (Select tool) shows an edit button in the inspector. Edits change every copy on every map.

- **Imported props:** **Edit…** reopens the importer (reframe, resize, blocking, maps, light). **Delete** removes it.
- **Built-in props:** **Customise…** opens the same window, starting from the built-in art. Saving makes a customised
  copy (marked with a blue dot) that replaces the built-in everywhere; campfires and torches keep their flames.
  **Reset to original** brings the built-in back.

## Controls

Every key and button can be changed in **Settings → Controls** (per player, kept for every save).

| Action | Keyboard | Xbox controller |
| --- | --- | --- |
| Move | WASD / arrows | Left stick (push all the way to run) |
| Run / sprint (hold by default; toggle in Settings → Gameplay) | Shift | X, or a full stick push |
| Talk / interact | Enter | A (when facing someone or something) |
| Jump; dodge while locked on | Space | A |
| Attack with the selected weapon (sword or bow) | — (1 / 2 below) | LT (hold with the bow to draw) |
| Switch weapon (sword ↔ bow) | R | Y |
| Sword / bow: select and use at once | 1 / 2 | — |
| Cast the readied spell shard (a bolt, or switch Light / Water Walk on and off) | F, 3 or 4 | B |
| Block (hold; just in time = parry) | E | RT |
| Lock on / next target | Tab | RB (LB cycles the other way) |
| Release target | Q | D-pad ↓ |
| Quick items (left / up / right) | 5 / 6 / 7 | D-pad ← / ↑ / → |
| Sneak / crouch (toggle by default; hold in Settings → Gameplay) | C | Right stick click |
| Menu / back | Esc or X | Start |

The selected weapon shows top left, with the other under it (greyed out when there's no bow equipped). Spells
aren't on the weapon wheel: ready a shard in Bag → **Shards** and cast it with its own button, so a sword swing
can be followed straight away by a spell (pressed mid-swing, it goes off as the swing ends). The readied shard
shows under the bars, and a small gem charm in its colour hangs on the hero's chest while one is readied. A layout you've already changed in Settings → Controls is kept; *Reset to defaults* there
switches to the table above.

In menus the arrows, Enter and Esc always work, and on a controller the D-pad / left stick, A (confirm), B (back)
and LB / RB (switch tabs). Touch screens get Menu, Run (hold, or toggle), Jump and Spell buttons, and the quick
item slots can be tapped. Sneak is on C rather than Ctrl
because Ctrl+W closes the browser tab and a page can't stop it.

## Project layout

```
Map Editor.html           Standalone editor (double-click; built by build:standalone)
Playtest.html             Standalone game page the editor's Playtest button opens
Character Builder.html    Sprite character builder (double-click)
editor.html               The map editor page for the dev server
public/data/              Game data (what the editor creates)
  database.json           Title, start, characters, player stats, items, inventory, menus
  maps/map001.json        Terrain, props, lights and events for one map
  assets.json             Imported props (written by the editor)
public/assets/props/      Imported prop images
public/assets/tiles/      Imported tile textures
public/assets/icons/      Imported item icons
public/assets/audio/      Imported music and sounds
public/assets/characters/ Imported character sheets (Database → Characters)
src/
  main.ts                 Entry point
  game/                   Game loop, player, input, stats, skills, inventory, saves, settings; combat/ (enemies, fighting);
                          battle/ (turn-based battles: rules.ts for turn order and damage, TurnBattle.ts runs a battle)
  audio/                  Sound: the Web Audio player and the built-in sounds, music and ambience made in code
  events/                 Map events (pages, triggers) and the command interpreter
  render/                 Sprite system, textures, post-processing
  world/                  Map data types, tile grid, world building, time of day, fires, fireflies
  art/                    Placeholder art and item icons generated in code
  ui/                     Message window, HUD, menus, bag and shop screens, debug panel
  editor/                 The map editor (canvas, palette, inspector, event and command editors)
  shared/                 Data loading/formatting and the editor → game playtest hand-off
tools/build-standalone.mjs  Builds Map Editor.html and Playtest.html
tools/character-builder/    Character Builder source (build.py makes Character Builder.html)
```

## Map format (`public/data/maps/*.json`)

- **cliffTile** (optional): default cliff wall look, `"bricks"` or an imported tile's key.
- **heights** (optional): one string per row, space-separated heights from −10 to 10 (one step = half a tile).
- **water** (optional): one string per row, space-separated: `.` for none, otherwise the level plus an optional
  type letter (`s` shallow, `w` swimmable, `d` deep; none = automatic) and `@n` for a style other than the first.
  Example: `. . 0 0 -1d 0w@2`.
- **waterStyles** (optional): `{ name, color, murk?, bumpy?, flow?, flowDir?, glow?, ailment?, chance? }` per style.
- **ramps** (optional): `{ "x", "z", "style": "stairs" | "ramp", "dir"? }`; without `dir` it rises toward the
  neighbour one step higher.
- **passage** (optional): one string per row, one character per cell: `.` normal, `c` climbable, `l` low clearance,
  `x` wall, `o` open.
- **terrain**: one string per row, one character per tile. Built-in: `.` grass, `=` path, `:` sand, `~` water,
  Imported tiles get their own character (their `key` in `assets.json`). Older maps' `#` raised tiles are converted
  to grass at height 2, and their `~` water tiles to a dug-out pond with swimmable water (`~` is now "Lake bed").
- **buildings** (optional): `{ "x", "z", "w", "d", "height"?, "wall"?, "roof"?, "roofStyle"?, "ridge"?, "pitch"?,
  "overhang"?, "windows"?, "doors"?: [{ "side": "front" | "back" | "left" | "right", "at" }], "name"? }`. `x, z` is
  the top-left tile, `w × d` the footprint; `at` counts tiles from the wall's left (front / back) or top (left / right)
  end. Left-out settings use the defaults (2.5 tall, plaster, shingle gable, a few windows).
- **encounters** (optional, turn-based battles): `{ "enemies": [{ "enemy": "slime", "weight": 3 }], "steps": 30,
  "min": 1, "max": 3, "terrain": "." }` (random battles while walking; `terrain` limits them to those characters).
- **kind** (optional): `"battle"` for a battle map. Battle maps have **markers** (`[{ "side": "party" | "enemy",
  "x", "z" }]`, tiles, in order) and optionally **battleCamera** (`{ "distance", "height", "side", "fov" }`).
- **battleMap** (optional, field maps): the battle map turn-based battles here are fought on (a file name).
- **zoneGrid** (optional): one string per row, `.` for no zone or a letter `A`–`Z`.
- **zones** (optional): `{ "A": { "name"?, "steps"?, "battleMap"?, "troops": [{ "troop": "slimes", "weight"?, "time"?: "day" |
  "night", "days"?: [5, 6], "switch"? }] } }` (`days`: 0 = Sunday … 6 = Saturday).
- **events**: `{ "id", "name", "x", "z", "w"?, "h"?, "pages": [...] }`; `x, z` is the top-left tile and
  `w × h` the size in tiles (1 × 1 when left out).
- **props**: `{ "type": "oak", "x": 3.6, "z": 1.5, "s": 1.1 }`. Positions are in tiles (x, z is where the prop
  touches the ground). Built-in types: `oak`, `pine`, `bush`, `rock`, `pebble`, `tuft`, `flowers`, `sign`,
  `campfire`, `torch`; imported props use their id from `assets.json`. Campfires and torches carry their own light.
- **lights**: one of
  - `{ "type": "point", "x", "z", "y", "radius", "color", "intensity", "flicker", "schedule", "shadows", "switch" }`
  - `{ "type": "spot", …same…, "dir": "down", "angle": 40, "tilt": 30 }`
  - `{ "type": "area", "x", "z", "shape": "rect" | "ellipse", "w", "h", "feather", "color", "intensity", "schedule", "switch" }`

  `schedule` is `always`, `night` (off by day, fading in at dusk) or `nightBoost` (brighter at night).
  `flicker` is `none`, `fire`, `candle`, `pulse` or `faulty`. With `switch`, the light is only on while that
  switch is ON. For area lights, `intensity` 1 leaves colours unchanged, below 1 shades, above 1 brightens
  (up to 8 area lights per map). Maps from older versions are converted automatically.
- **events**: see below.

## Events

Events work like RPG Maker's. Each event has **pages**. The active page is the last one whose
`condition` is met, and it decides how the event looks, how it's triggered and what it does.

```json
{ "id": 3, "name": "Mira", "x": 11, "z": 16, "pages": [
  { "character": "mira", "facePlayer": true, "trigger": "action", "solid": true,
    "commands": [ { "cmd": "text", "speaker": "Mira", "text": "Hello!" } ] },
  { "condition": { "switch": "met_mira" }, "character": "mira", "trigger": "action", "solid": true,
    "commands": [ ... ] }
] }
```

**Page fields:** `condition`, `sprite` (a prop type) or `character` (from database.json) or `enemy` (from Database → Enemies; its commands run when it's defeated), `breakable` (`{ "hp": 20, "defense": 0, "hitBy": ["magic"], "name": "Crystal" }`: it can be hit and its commands run when it breaks), `dir`,
`facePlayer`, `trigger` (`action` = talk to it, `touch` = step on it, `auto` = runs once when the page activates,
`none`), `solid`, `commands`.

**Conditions:** `{ "switch": "id", "is": true }`, `{ "var": "id", "op": ">=", "value": 3 }`,
`{ "item": "potion", "count": 2 }` (has at least; equipped counts), `{ "gold": 100 }` (has at least),
`{ "quest": "slime_trouble", "is": "ready" }` (`inactive`, `started` = in progress or ready, `active`, `ready`, `done`,
`failed`) or `{ "quest": "first_night", "objective": "rest", "done": true }`.

**Commands:**

| Command | Example |
| --- | --- |
| Show text | `{ "cmd": "text", "speaker": "Mira", "text": "Line one\nLine two" }` |
| Show choices | `{ "cmd": "choice", "options": ["Yes", "No"], "cancel": 1, "branches": [[...], [...]] }` |
| Conditional branch | `{ "cmd": "if", "condition": { "switch": "rested" }, "then": [...], "else": [...] }` |
| Set switch | `{ "cmd": "setSwitch", "switch": "met_mira", "value": true }` |
| Set variable | `{ "cmd": "setVar", "var": "talks", "op": "add", "value": 1 }` |
| Wait | `{ "cmd": "wait", "seconds": 0.5 }` |
| Fade out / in | `{ "cmd": "fadeOut", "seconds": 1 }`, `{ "cmd": "fadeIn" }` |
| Set time of day | `{ "cmd": "setTime", "hour": 21.5, "instant": true }` |
| Change ability | `{ "cmd": "ability", "ability": "climb", "on": true }` (run, jump, climb, crawl) |
| Enable / disable overworld weapons | `{ "cmd": "fieldWeapons", "on": false }`: the field sword and bow greyed out on the HUD with a red ✕ (indoors, towns, restricted areas) until enabled again; kept in saves |
| Unlock achievement | `{ "cmd": "achievement", "id": "SECRET_OF_THE_STONE" }` |
| Run console command | `{ "cmd": "console", "line": "give potion 3" }` |
| Open save screen | `{ "cmd": "save" }` |
| Transfer player | `{ "cmd": "transfer", "map": "map002", "x": 3, "z": 5, "dir": "up", "fade": "black" }` (fade `black`, `white` or `none`; ends the event) |
| Play sound effect | `{ "cmd": "sound", "sound": "levelUp" }` (a built-in name or a file path) |
| Change music | `{ "cmd": "music", "music": "builtin:night", "fade": 2 }` (`""` stops it; no `music`: back to the map's) |
| Change background sound | `{ "cmd": "ambience", "ambience": "builtin:rain" }` |
| Give skill points | `{ "cmd": "skillPoints", "value": 1 }` |
| Start battle | `{ "cmd": "battle", "enemies": ["slime", "slime"], "canRun": false, "lose": "continue", "resultVar": "boss_result" }` |
| Teach spell / Addition | `{ "cmd": "learn", "who": "", "spell": "fire", "rank": 2, "addition": "volley" }` (`who`: '' the hero, '@party' everyone, or a hero id) |
| Change class | `{ "cmd": "heroClass", "who": "", "op": "change", "cls": "mage" }` (op `change` or `unlock`) |
| Quest | `{ "cmd": "quest", "quest": "slime_trouble", "op": "start" }` (op `start`, `objective` with `"objective": "id"` and optional `"add": 1` to count up, `complete`, `fail`, `reset`; `silent: true` skips the banner) |
| Give item | `{ "cmd": "giveItem", "item": "potion", "count": 2 }` (`silent: true` skips the "Received" message; a full bag stops the event) |
| Take item | `{ "cmd": "takeItem", "item": "old_key", "count": 1 }` |
| Change gold | `{ "cmd": "gold", "op": "add", "value": 50 }` (`add` or `set`) |
| Open shop | `{ "cmd": "shop", "name": "Mira's pack", "goods": [{ "item": "potion" }, { "item": "torch", "price": 5 }], "canSell": true }` |
| Change health / magic / stamina | `{ "cmd": "gauge", "gauge": "hp", "op": "add", "value": -10 }` (`hp`, `mp`, `sp`; op `add`, `set` or `fill`) |

Text placed right before a choice stays on screen above the options.
In text, `\v[name]` shows a variable's value and `\s[name]` shows a switch as ON/OFF.

## Notes

- three.js is pinned to **0.149.0**, the version the lighting was tuned on. Newer versions changed how light
  brightness is measured, so upgrading means re-tuning light intensities. That's a planned later step.
- The debug panel (top-left) shows time of day, effect toggles, the light budget, and live switches & variables.
- If an imported prop's image is missing, the game shows a pink chequerboard in its place and logs a warning.

## Roadmap

1. ~~Renderer prototype~~
2. ~~Project structure, JSON maps, events and message window~~
3. ~~Map editor: terrain painting, prop and light placement, event editor, playtest button~~
4. ~~Props from images (importer), point / spot / area lights, light budget~~
5. ~~Custom tiles from textures (point filtering, pixels per tile)~~
6. ~~Height layer, cliff walls, ramps and stairs~~
7. ~~Water levels: shallow, swimmable and deep water, wading and swimming~~
8. ~~Passage layer, and movement abilities (run, jump, climb, crawl)~~
9. ~~Soft tile blending~~, ~~map transfers between maps~~
10. Packaging: Windows app (Tauri); Android (Capacitor) maybe later
11. ~~Respawn points, save / load~~, ~~title screen, pause menu, settings~~
12. ~~Items, bag, equipment, light items, chests and shops~~, ~~magic rings~~
13. Battle system: ~~stage 1 (action combat, enemies, stealth, levels)~~, ~~stage 2 (skill tree, block / parry)~~,
    stage 3 (party: AI companions with their own stats and gear, swapping, wait / follow orders),
    ~~turn-based battles as an option (FFX-style turn order or rounds, random encounters)~~
14. ~~Sound, rebindable controls, Xbox controller~~, ~~quest log~~; plugins
15. ~~LPC characters with full animation sets, Credits screen~~, ~~Buildings~~, ~~fading buildings~~, ~~LPC weapons~~,
    ~~LPC library (tiles and props)~~, ~~adventure / combat log~~, ~~weapon builder~~,
    ~~Character Builder on your PC~~
