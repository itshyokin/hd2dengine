# To-do (ideas for later)

Kept in the project so they travel with the code. Tick them off as they're built.

## Next (planned Oct 17)
- [x] Update 61: active fighter's ring in their Database colour and a glowing outline on their card; self-switches
      (A–D per event, Set self switch command, page condition); a Switches window (+ / − / rename) wherever a switch
      is picked, the names kept in the Database.
- [x] Update 62: the scenery beyond the map edge follows the height of the edge tiles (cliff faces between steps);
      bridges and platforms (plank, rope and stone bridges, docks; a "walk on top" prop setting).
- [x] Update 62b: height styles for raised and lowered ground, painted like water kinds with their own symbols:
      Blocky (as now), Soft blocky (bevelled, rounded edges and corners), Smooth / hills (heights blended into rolling
      hills), Cliffs (1×1 like blocks but jagged rock faces); waterfalls where water drops more than 2 heights.
      (Props in water half-submerged: done in update 62.)
      Bridges with two levels: walked on from the bank, swum or walked under from below (with enough headroom),
      for the hero, the party and enemies.
- [x] Update 63: window themes (Ember, Medieval Parchment, Medieval Wood, Dwarven, Elvish, Titan) for menus, text
      boxes and the HUD; a default in the Database, chosen by players in Settings; a preview page first.
- [x] Update 63b: soft-blocky bevels closed where they end against higher or square-edged ground (no gaps or
      floating corners); cliff faces flush at their ends (no seams down corners); bridges keep walkers on them (along
      the bridge only, off at open ends; getting on only from the ends) for the hero, the party and enemies.
- [x] Update 64: seven stats (STR melee, DEX ranged / accuracy / crits, AGI turn speed and evasion, END ailment
      resistance and a little HP, DEF, MAG, MDF); buffs and debuffs working in battle, Haste / Slow; a Shared skill
      tree for the whole party (stamina and party-wide boosts, new members included). Also: hits can miss (accuracy
      against dodging), Support spells (Haste, Slow), enemy Buff actions, enemy Accuracy / Evasion / Ailment resist /
      Critical hit % fields, party points (Give skill points → Party points).
- [x] Update 65: remove the action battle system (keep bumping into foes, and the sword / bow as field tools with the
      bow's lock-on for sniping foes to start a battle); skills that only worked in real time removed or reworked;
      Database forms reorganised Guerilla-style (all switches together at the top, then named sections with a jump bar)
      and the tabs regrouped. Also: Assassinate and Silent Shot reworked for the map, Steady Guard heals on Guard,
      untrained medium / heavy weapons hit for three quarters, battle Records now count (damage, crits, best hit).

## Tablet editing (Oct 19)
- [x] Update 67: Push to GitHub and Pull from GitHub in the online editor (Project menu): a fine-grained token kept
      in the browser, one commit per Push on top of what's there, Pull brings in the PC's pushes, files changed in
      both places ask which to keep; the site records the commit it was built from (data/build.json).
- [x] Update 67b: Backspace works as Esc everywhere outside text boxes (editor, game, Character Builder).
- [x] Update 68: support spells on either side (Cast on → Either side: Haste a friend or a foe); buffs that last the
      whole battle; battle weather (starts as the map's; spells and enemy Buff actions can bring Rain, Sunlight,
      Sandstorm… for some rounds or the whole battle, strengthening and weakening elements); a Rain Call spell.
- [x] Update 69: Terrain → a built-in tile → Picture: Built-in or Custom picture (swap its look on every map without
      repainting; everything else about the tile stays).

## Combat and classes (planned Oct 19, before Travel)
- [x] Update 70: classes give a one-time stat boost when joined (classes can't be changed); per class, each weapon
      type (swords, daggers, axes, maces, spears, bows, staves, wands…) and armor weight (light, medium, heavy,
      shields) is Trained / Untrained (weaker: ¾ damage, armor costs Agility and Evasion) / Can't use; items get a
      weapon type; skill trees can still teach a proficiency.
- [x] Update 71: enemy levels: a level range per troop / spawn on the map (stats grow per level); an event command
      for "dynamic" levels (spawns come out near the party's average level, a couple either side). EXP rework: only
      active fighters earn EXP (others with an EXP Share accessory or the EXP All key item, switched on and off in
      Key items, each giving a % set on the item); EXP given per foe as it falls, bonuses for the finishing blow,
      Additions (more for faster and more accurate ones; a "+10 EXP" pop-up at the bottom left per strike, like
      Legend of Dragoon's SP), no KOs, weakness; a breakdown on the victory screen.
      Misses: an Addition that misses (the hero runs up, no prompt, MISS, a pause, snaps back); accuracy on weapons
      and spells (spells against MDF); Accuracy / Evasion buffs; a Never miss option.
- [x] Update 72: spell additions: a fixed button sequence per spell (more at higher ranks) while the camera pulls in on
      the caster; mistakes weaken it, a fast and accurate cast earns bonus EXP; per spell, a good cast makes support
      spells stronger or last longer.
- [x] Update 73: Single battle mode (Database → Combat; Pokémon-style): one hero out at a time, swap any time (the
      swap goes first) or after a KO, items on the reserve, both sides pick and the faster acts first (no turn bar);
      up to 8 active members in this mode. Troops: Full troop (a normal group fight), One at random (wild
      encounters), One at a time (trainers: the next steps in), up to 8 foes in this mode. A map sprite you bump into
      is the foe you fight.
- [x] Update 74: Single mode defaults: wild encounter (one at random) unless a troop, a Start battle event (wild /
      trainer / swarm), the map (Map Properties → Battles) or Database → Combat says otherwise.

## Combat (ideas, Oct 18)
- [x] Impact materials: each enemy has a Material type in the Database (flesh, plant, metal, stone, wood, bone,
      liquid, gel, crystal, spirit / ethereal, cloth…) setting the sound when a sword or arrow hits it (squish, vine
      chop, metal ding, stone crack…), plus up to two Material effects (blood — recolourable for ooze / sap / ichor —,
      sparks, stone bits, wood chips, water / gel splash, bone shards, crystal shards, wisps). Critical hits: screen
      shake, a big CRITICAL with a crack / rumble. Weak or immune hits: a soft thump and a big WEAK (the pop-up made
      larger).
- [x] Battle log beside the battle window (left side): Y selects it to scroll up and down, to review what happened.
- [x] Monster stat blocks (Database switch): blocks across the top, lined up with the party's, one per foe — picture
      left, name, element (or Normal) and HP + MP bars (MP greyed when unused) right; bosses can have an overdrive
      gauge across the whole bottom. A fallen foe's block fades out. With blocks on, the names and bars over the
      sprites are hidden; targeting a foe glows its block in its element colour (a left-to-right blend for two
      elements, gold / tan for Normal), with the pause menu's arrows above and below the block, and still the arrow
      over the foe's head.
      (Done in update 66; the overdrive gauge fills as the boss is hurt and makes its next move hit half again as hard.)

## Travel (ideas, Oct 17)
- [x] Horses (update 75): rented at stables (one at a time, tiers with their own stamina and jump, priced by tier); A next to
      the horse mounts, B dismounts (B's key item / spell otherwise); faster on the map; jump 1★ 3 tiles, 2★ 4,
      3★ 5; left where the player got off (saved per map); a Saddle key item sends it home to its stable (so a new
      one can be rented elsewhere). Not shown in battles; still mounted after one. Placeholder horse art for now.
- [x] Griffin flights (update 76; WoW-style): roosts in some towns, fly to known roosts picked on the world map, priced by
      distance. Only roosts unlocked by talking to their griffin master. The griffin flies the route over the World
      layout's maps (lighter versions) with the camera following, unmapped stretches filled with forest / theme
      scenery, at one speed (long flights take longer, no skip), then lands, drops the player off and flies away.
- [x] Pocket Handheld battle layout (update 77; Pokémon Gold / Silver style): foe block top left, hero block right with
      HP numbers, EXP bar and a violet MP orb; four spheres per side (orange to fight, dark with a red ✕ when KO'd,
      empty); commands as a 3 × 2 word grid; the log as a bottom text box; the handheld camera (hero from behind at
      the lower left, foe upper right). Single mode now fights at most 4 (party pool and trainer foes).
- [x] Pocket polish (update 78): blocks half the screen wide and scaled; a fixed-size command box with a boxed choice;
      EXP and loot told in the log (no results screen in Pocket Handheld; EXP Share / All named); the Settings list
      scrolls to follow the controller; themed frames no longer show a gap inside the outline; the bottom EXP bar
      takes the theme's frame; Controls opened from Settings no longer shows the list through it.
- [x] Element stones (update 79): Fragments / Shards / Heart Stones per element in two Element slots (Primary sets the
      basic attack's element), tiered damage and weakness, pair bonus, same-element spell bonus, fusing from the bag,
      Fragment drops; shards no longer set in gear; Normal instead of Non-elemental; element pills and circles; the
      Journal's Type Chart.
- [x] Forms (update 80): heroes' mid and final forms (level, look, face) with a transformation scene after the battle
      that reached the level; monsters' advanced forms (own entry, comes out at a level, Bestiary chain and order).
- [x] Pocket text box and Potato quality (update 81): shorter stat blocks (HP numbers beside the bar); a one-line
      text box that waits for OK (attacks, damage with its element, effectiveness, defeats, EXP, level ups with a
      stats box, loot), centred when the commands are hidden; Potato quality and a cloud-shadows switch.
- [x] Pocket flow (update 82): one foe out → no target choice; moves announced (typed, short pause, no button);
      no damage lines, effectiveness / criticals wait for OK; the text box types its lines; RetroMon window theme
      (also skins the Pocket blocks, text box and commands in every theme).
- [x] Window touches and results order (update 83): window opacity, colour, text colour and frame colour (Settings and
      Database); element pills at the end of the HP bar's row; Pocket results: Victory + fanfare, EXP (with bonus)
      in one window, loot, level ups with stats; transformations play in the dark before the map fades in.
      83b/c: the hero block: name, HP bar with its numbers under it, EXP bar and spheres in a column (the element pill
      ending with the bars), the MP orb beside them inside the block.
- [x] Update 84: Pocket Use Item picks from two lists (party with the one out in gold and the bench, and the foes; harmful
      items list the foes first), so benched members can be healed; the empty top HUD panel (condensed HUD) no longer
      draws a window in themes; keys reach the game again when a clicked button or hidden field kept the focus.
- [x] Update 85: handheld-style map camera (Database → World → Camera: angle 56°, distance, field of view; "Classic"
      preset for the old one) with standing sprites leaning back to face it (Sprite lean, 55% by default).
- [x] Update 86: compact Database pages (Player, Heroes, Combat, Enemies, Spells, Weather & temperature, Camera):
      edit panel at most 800px, side-by-side short boxes, setting help behind an "i" button, switches stacked in one
      column, enemy Immune / Absorbs as a checkbox table; the Weather page's spell-length row lines up again.

## World
- [ ] Moving platforms (left ↔ right, rising ↔ falling), after bridges and platforms.
- [x] Shallow water to wade through, with ripples round the feet and splashing footsteps (earlier updates).
- [x] Real-world date under the game time in the HUD (update 37). Events that happen on certain days or days of the week
      (every Saturday a certain enemy spawns in a certain place with rare items…).
- [x] Enemies walking the maps as events, to bump into or attack to start a battle (earlier updates).

## Menus and saving
- [x] Achievements: their own tab in the pause menu (update 48), with a points bar (update 57).
- [ ] Journal: Story tab. Like the quest log but for the main storyline; each entry shows the game time and real-world
      date it was unlocked, with a screenshot of the moment (an event command "Story note" that takes it).

## Messages
- [ ] Speech bubble position chosen in the editor (per message or per character). Now: text box styles choose
      speech bubble or plain box (update 51), but above / below / top / bottom is still the player's setting.
- [ ] Message window backgrounds: imported images, cropped like props. (Text box styles cover colours, bold, italic.)

## Abilities and combat
- [x] Swapping party members mid-battle (Swap in the battle menu) and battle maps as backdrops (earlier updates).
- [x] Spells that charge for turns, with chants (earlier updates).
- [ ] Turn-based, next steps: ~~buffs in battle (update 64)~~, enemy spells that charge and the party's Counterspell,
      Limit / Overdrive-style specials.
- [ ] Classes: a class change screen at a trainer (an event command opening it), class stat bonuses. Now: Party → a
      hero → Class changes it.

## Gathering
- [ ] Fishing, next steps: cooking fish at a campfire; a reeling mini-game for big fish.

## Resting
- [x] The Sleep command: the camera tilts up to the sky as the hours roll by, then back down (update 53).
- [ ] The hero sits down at a campfire when resting there (before the sky turns).
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
- [x] Map themes (Database tab, Theme default in Map Properties), more edges (plains, rocky, desert, snowfield, snowy forest), built-in dirt / stone / rock / snow terrain and desert and snow props; map saves keep every setting (update 59).
- [x] Built-in effects and music remade as Game Boy-style chiptune (pulse, wave and noise channels), with Classic kept as a choice in Database → Audio (update 60); console audio_chiptune true / false to hear them in place of imported sounds (update 60b).
