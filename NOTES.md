# To-do (ideas for later)

Kept in the project so they travel with the code. Tick them off as they're built.

## World
- [ ] Bridges and platforms; moving platforms (left ↔ right, rising ↔ falling).
- [ ] Water at level 0: wet puddles on the floor, little splashes when walked through.
- [x] Real-world date under the game time in the HUD (update 37). Events that happen on certain days or days of the week
      (every Saturday a certain enemy spawns in a certain place with rare items…).

## Menus and saving
- [ ] Journal: Achievements tab.
- [ ] Journal: Story tab. Like the quest log but for the main storyline; each entry shows the game time and real-world
      date it was unlocked, with a screenshot of the moment (an event command "Story note" that takes it).

## Messages
- [ ] Speech bubble position chosen in the editor (per message or per character), not a player setting.
- [ ] Message window backgrounds: imported images, cropped like props (a "Window backgrounds" tab).
      Default: white with black text. Text colour, bold, italic options.

## Abilities and combat
- [ ] Turn-based battles, next steps: buffs in battle, swapping party members mid-battle (FFX), a battle backdrop
      image per map, enemy spells that charge (and the party's Counterspell), Limit / Overdrive-style specials.
- [ ] Classes: a class change screen at a trainer (an event command opening Abilities), class stat bonuses.

## Gathering
- [ ] Fishing, next steps: cooking fish at a campfire; a reeling mini-game for big fish.

## Resting
- [ ] Resting at a campfire: the hero sits down, the camera tilts up to the sky as day and night roll by fast, then
      back down as the hero stands up.
- [ ] Party members gather round a campfire and sit when the hero is within 3–5 tiles of it (they still get up to
      fight if the party is attacked).

## Done
- [x] AI party members (update 23).
- [x] Party members have their own level and EXP (update 24).
- [x] Cloud shadows (update 24: Inspector → Cloud shadows).
- [x] Continue removed from the title; save pictures; delete saves with confirmation (update 24).
- [x] Letter tick sound (update 24: Settings → Sound → Letter ticks).
- [x] Light ring orb (update 24: Items → the ring → Light: Orb).
- [x] Followers on load and in water, water look options and ripples, swim sound (update 27).
- [x] Rings → spell shards "Light" and "Water Walk"; cutting ring removed (update 27).
- [x] Ring slot removed (rings are accessories); Magic tree perks instead of shards; Light is a glow, no beam (update 28).
- [x] Mining, forges (smelt, upgrade, enchant), weapon materials, fire burns vines, weapon proficiency, harvest pickup delay, large boulder (update 29).
- [x] Calmer water; Water tab with per-pool styles (pond, lake, river, sea, muddy, swamp, poison goo, lava with glow and ailments); ripples round props in water (update 30).
- [x] Shards tab in the bag; spells on their own button (B / F), off the weapon wheel; chest gem charm; enchanted weapons glow and trail in the element's colour (update 30).
- [x] Water past the map edge, paint-bucket fill, editor marks per water style; no chest charm; party HUD piece with stacking and faces; log box/wrap; D-pad ↓ in quick items; bag tabs as 8 × 8 pockets; Shards tab enchanting; new Equipment page with who-can-use (update 31).
- [x] Fishing: rod, painted fishing spots with catch tables (weight, day / night, rare), cast / bite / timing, Records (update 32).
- [x] Burning effect; Party menu (Equipment / Skill Tree / Stats per hero, level-up highlight, member skill trees); Shards tab holder lists; quick slots centred; draggable playtest panel (update 33).
- [x] Worn gear and shards stay in the bag (in use, who / where); shards readied or set in gear from the bag (no anvil enchanting); party fighting styles with weapon fallback (update 34).
- [x] Status page (About, ailments, fighting style); Gear tab as Weapons | Armor with per-hero comparison; hero colours; party beside the bag (update 35).
- [x] River currents push swimmers; drowning sinks; seasons (recolouring, snow, bare or snowy trees, ice and sliding, cold-season ambience) (update 36).
- [x] Turn-based battles as an option (Database → Combat → Battle system): FFX-style turn order or rounds, map enemies and random encounters start battles, Attack / Magic / Items / Guard / Run (update 38).
- [x] Turn-based battles: ailments run on turns, Legend of Dragoon Guard (heals, wards off ailments), enemy actions (attack / spell / heal / guard, whole-party hits, health conditions, Counterspell flag) (update 39).
- [x] Editor online (GitHub Pages) for the Android tablet: changes kept in the browser, Project → Save changes as .zip / Open project .zip / Forget my changes (update 40).
- [x] Learned spells with ranks and charge turns, Counterspell, Additions (timed strikes, button prompts, mastery), classes with their own skill trees, Menu → Abilities, Start battle / Teach / Change class event commands, Character Builder online (update 41).
- [x] Database → Troops, encounter zones painted on maps (Spawns layer) with day/night, weekday and switch conditions, the game's default settings file (data/settings.json) (update 42).
- [x] Battle maps: turn-based battles on a map you've made, with party and enemy markers and a camera behind the party (FFX / Legend of Dragoon style); chosen per map, per zone or per Start battle command (update 43).
- [x] Battle cameras on LB / RB, Legend of Dragoon command bar, HP-coloured target arrows, targeting anyone, items on enemies, volume groups with Master at 50%, victory EXP and Spoils screens, battle transitions and fade out / in (update 44).
- [x] Three a side, row targeting (left / right in a row, up / down between rows), Dragon Legend battle layout (default) with face art, Forbidden Fantasy layout, centred Items / Magic lists with a description box (update 45).
- [x] Turn arrow, Addition and casting camera shots, damage at the end of Additions, item toss, wounded pose, voices (call-outs, chants, attack sounds), victory music, party of eight with Swap, healing from the menu, weather in battle, condensed / hidden HUD bars (update 46).
- [x] Spoils panel cleared between battles, Additions run to the front of the target, casting shot from in front (the caster keeps facing the foes), poses that lose clothing layers skipped, title screen on a set map or a picture / video, fade to black and HUD fade-in from the title, menu icons, party / status cropping fixed, overworld sword and bow as field tools (no arrows) with Enable / disable overworld weapons, Light and Water Walk as key items (bag or B button), even autumn colours, corner slopes, hopping down low ledges (update 47).
- [x] Pause menu as one frame with tabs (Party cards with Swap, Items, Map, Journal, Achievements, Settings, System), the hero can be benched, World layout with snapping and place names, world map drawn from the maps with fog options, seamless map edges with neighbours drawn past the edge, achievements (rules, pop-up, Steam-ready IDs), developer console (update 48).
- [x] Pause frame sized to the party cards with equal tabs, world-map crosshair and tooltips, event map markers (kinds in Database → Map markers, switch-controlled, area outlines), console commands aimed at a hero, word bubbles on event pages (update 49).
- [x] Playtest fixes: delete saves with Y, HUD arranging from the pause menu, tap to walk off by default, newest achievements first, no AO box round battle sprites, matching battle frames, pause frame top to bottom with uncut tab names and arrows on the selected card, walking off ledges (Database → Player → Ledges) and quicker climbing, EXP in the HUD bars, stamina ring, a card per party member, mini-map, season picture, world map glide / one-tile steps / marker jumps, styled words in messages and bubbles with named text colours and message looks, enemy health and damage variance, full-screen Database with icon tabs, Delete under + New, Apply saves, Journal Bestiary, bug notes in the console (update 50).
- [x] Text box styles in Database → Text boxes (Speech, Sign, Narration, Item / Gold received, System, your own), picked per message (update 51).
- [x] System tab Load / Quit fixed, battle music (game default + overrides), smoother seamless maps (no slow pixel reads, padded lights, the map left kept as the neighbour), Map Properties window and icon layer tabs, audio from the project folders, enemy tint, battle height offsets, combat preview, gold on the HUD, camping props, erase by type / erase all of a type, heals stay on the hero, save screen on the current save, turns start on Attack, default Additions, party on save cards (update 52).
- [ ] A "Complete the Bestiary" achievement rule (every enemy met / defeated).
- [ ] Visible wandering enemies per zone (later).
- [x] Sky over Titan (stars, Saturn, sun, the real moon's phase with circuit lines, clouds by weather), moon phase in the clock card and as a condition, Sleep command with the sky transition (update 53).
- [x] Dynamic weather (season chances, storms with lightning and thunder, blizzards, haze, rain/snow by temperature), temperature (daily rolls, curve, map climate, Change temperature command, °F/°C), damp / frost / heat on the ground, Temperature and Weather conditions, heat and cold in battle (update 54).
- [x] Stat ranks (A–F growth per level, set per hero, changed by potions, gear and the Change stat growth rank command, coloured pills on Status), stat setup as Default / Custom → Roll Dice on a 3D dice table, Point Buy, Standard Array, "Set up stats on joining" per hero; level-up stat points removed (update 55).
- [x] Database: Duplicate button, right-click Duplicate / Copy / Paste and Ctrl+D / Ctrl+C / Ctrl+V in every list (update 56).
- [x] Turn-based party on the map: never fights or starts battles, follows (toggle in Combat) and hops where the hero jumped; the lineup's leader walks the map with their own sprite; achievement pop-up shows the description; points bar on the Achievements page (update 57). Everyone stands in their plain idle in battle, not the combat stance (update 57b).
- [x] Event sounds: a page's sound plays all the time, fading with distance and panned (built-in campfire, shore, waterfall, hum); lit campfires crackle (update 58).
- [ ] Then (playtest notes, Oct 17):
  - Map Themes (their own tab): surrounding tiles, music, ambience, weather…; map settings show "Theme default" until changed. More map edges (desert, snow, plains, rocky…) and built-in terrain textures (stone, cliffs, snow…).
  - Built-in sounds and music remade as Game Boy-style chiptune.
- [ ] Back burner: water freezing / thawing tile by tile with the temperature.
