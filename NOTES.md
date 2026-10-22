# To-do (ideas for later)

Kept in the project so they travel with the code. Tick them off as they're built.

## Roadmap (planned Oct 21, updated Oct 22): PC first, the elements, then more 3D
The game targets PC (a console port, PS1/PS2-style, may come much later as its own project). Tablet limits no longer
decide things; the tablet editor keeps working.
- [x] Update 98: "Stats can't be lowered" buff (Guard Spec: blocks lowering only, buffs still land); "Level up"
      items (Rare Candy: exactly the EXP to the next level); console `achievements_allow` (achievements again after
      cheats); weapon types editable (add / rename / remove, like Armor types, each with a row in every class's table);
      skill-tree Training (a skill can make its hero Trained with a weapon or armor type, whatever their class says).
- [x] Update 99: prop collision seen from above (RPG Maker style): the footprint grid marks each tile X (blocks),
      O (walkable) or ★ (walk behind); flat pictures stand on the front edge of their footprint, so a blocking tile
      stops the player in front of the vines, not behind them. Old props converted. (The grid 3D props will use.)
      Done: wall props' footprints reach back from the wall they hang on (props.ts `footZ`); the importer grid
      cycles X / O / ★ (saved '#', '.', '*'); ★ walks like O until 3D props.
- [x] Update 100: toon water like the GBA references: flat colour, drifting wave-line pattern, a light foam outline
      along shores, a darker ring round rocks and props in it; water styles and recolouring kept.
      Done: WaterStyle `look` ('toon' default, 'real' for glowing styles), `lines`, `noFoam`; waterEdge.ts
      `patchToonWater` (lines and foam in the shader, `toonWaterTime`); Game rings round wet props.
- [x] Update 101: 3D props (GLB first, FBX best-effort), sized on the prop grid.
      Done: render/models.ts (parse, bake into one multi-material mesh fitted to the footprint, icon render);
      PropDef `model` / `modelRot`; importer "+ 3D model…" (Faces, refit on Width / Depth); instanced in
      WorldBuilder like sprite props. Rest pose only (animation comes with Update 102).
- [x] Update 102: 3D characters and enemies: Sprite or 3D model per hero / character / enemy; animation slots picked
      from the file's clips: Idle, Walk, Run, Jump, Swim, Climb, Sit, Injured, KO, Attack, Spellcast (enemies: Idle,
      Attack, Spellcast, Dead), missing ones falling back to Idle; battle, map, Bestiary and portraits. A "3D look"
      setting: Legend of Dragoon style (low resolution, outlined) or FFX style (smooth).
      Done: render/characterModel.ts (ModelRig: slots, guessing by name, root motion kept in place, LoD / FFX look
      with an outline shell, pictures), CharacterDef `model`, Database `modelLook`; CharacterSprite drives the rig
      behind the same calls as sheets; Database → Characters → 3D model window with a live preview. Enemies use
      a 3D character through their Person look. Weapons on models: Update 108.
- [ ] Updates 103–106: the elements (planned Oct 22). Out of battle only: weather states never change a battle, but
      last through one (Freezing before a fight, still Freezing after). Each hero: 1 ailment + 1 weather state +
      1 good state. Every character in the party is affected (the first is the leader); KO'd heroes (0 HP) take no
      chip damage, and falling to 0 HP cures their ailment. Everything is saved.
  - [x] Update 103: Warmth and temperature. Armor and accessories get Warmth 0–10 (10 best against cold, 0 coolest
        in heat). Maps get Temperature: follows outside, or a fixed base (a cool cave, a warm house) that wanders a
        few degrees but never into another state's range; and Damp / Dry (damp caves slowly make you Wet). Warmth
        zones round lit fires, torches and braziers, and indoors. A cold / heat meter per hero fills with the
        temperature over time (faster when Wet), less with the right Warmth. States: Comfortable (by a fire,
        indoors or dressed right; can be set to always show), Wet, Cold, Freezing, Hot, Overheating. Database →
        Weather & temperature: the temperatures for each (e.g. 40 / 25 / 85 / 100 °F), how fast the meter fills,
        chip damage (every N steps, % of max HP, never below 1). Movement: Wet a little slower, Cold / Hot slower,
        Freezing / Overheating slowest (the worst one counts). Rain and swimming wet you; fires, shelter and sun
        dry you. Horses and griffins are never slowed; on a griffin the rider is immune until they land. Items
        (potions, food, drinks) get Warms / Cools (Hot Cocoa, Chilled Tea) and a Camp value.
        Done: game/body.ts (meter, wet, felt temperature, states, slow, soothe), GameState `body`, Game
        `updateBody` / `weatherStates` / console `body`, Lights `byFire`, MapData fixedTemp / damp / noElements,
        ItemDef warmth / warms / camp, Database `body` (Weather & temperature → On the body).
  - [ ] Update 104: showing it. The HUD party panels and the pause menu's party cards get a frame per weather state
        (Comfortable gold, Wet drops, Cold frost corners, Freezing frost and icicles with a cold pulse, Hot shimmer,
        Overheating embers and a hot pulse) and a pill row (weather first, then the ailment, then the good state;
        three at most, then "+N"). Ailments show an RPG Maker-style balloon off the face. Chip damage: a screen
        shake, a hurt sound and that hero's panel rumbling (seconds set in the Database). Each ailment can recolour
        the HP bar (off by default; a colour per ailment). On the map: breath puffs in the cold (thicker when
        colder), wet heroes drip and squelch, overheated ones steam.
  - [ ] Update 105: ailments out of battle. One per hero, and a hero with one can't get another (Zombie too) until
        it's cured. Poison and Burn chip HP to 1, then wear off. The rest (Paralyze, Sleep, Confusion, Blind,
        Silence, Zombie) stay until cured, a rest of 5+ hours, or an event cures them; shown only (balloon, pill).
        Stagger, Chill and Frozen end with the battle.
  - [ ] Update 106: resting and camping. A "Rest point" event (like the enemy / transfer prefabs: put it on a
        campfire prop); resting there also sets the respawn point. Rest how many hours: the party's panels refill
        20% an hour as the hours are picked; 1 hour already warms and dries the party; 5+ hours: full restore and
        cures every ailment. Then the camping supplies screen: each item's Camp value (food, potions, drinks);
        a bar to 50 with marks at 25 (Rested) and 50 (Well Rested), Fill buttons that pick the cheapest mix, a
        warning before waste; under 25 nothing is spent ("Add X more to gain additional benefits"). Camping with
        no supplies still restores fully. Rested: +1 to every stat and +10% EXP; Well Rested: +3 and +25% EXP,
        shorter; their lengths set in the Database. Shown on the stat page as gold "+1" beside each stat with the
        time left, and an "EXP +25% (Well Rested)" line. A new good state replaces the old (Well Rested is never
        downgraded by Rested; resting again restarts the timer). Inns give Well Rested. Event commands: Give buff
        (Rested / Well Rested, hours and minutes; also for blessings), Set weather state, Give / cure ailment; event
        conditions "if a hero is Freezing / Well Rested / Poisoned…".
- [ ] Update 107: Additions with 3D models: each swing a part of a clip (Attack by default, changeable), the next
      swing starting where the last ended; a missed button stops the chain there.
- [ ] Update 108: equipment on 3D characters: body types (masculine, feminine, more later) in the Database; armor and
      accessories get a model per body type, rigged to the base skeleton (bones matched by name; rigid pieces such as
      hats follow a bone); weapons attach to empties named like #right_hand.
- [ ] Update 109: 3D character builder (its own page): base model, + add parts per category (hat, armor, clothes,
      accessory, weapon), hair style and colour, skin tone, facial expressions as planes over the face; export the
      whole character as one GLB (for NPCs mostly).
- [ ] Later: desktop build (Windows app: Electron or Tauri; saves in a folder, real fullscreen, Steam-ready); an
      optional "PS2 era" render mode.

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
- [x] Update 87: status pills beside the name and level in Pocket Handheld (short tags by default, full words as a
      setting; colours, tag and word per ailment in Database → Combat → Status pills); one ailment at a time in
      turn-based battles; element pills get their circle and symbol docked on the left; the Addition ring in the
      middle of the screen; battle pauses run on while the text box is read (no wait after OK); slung weapons, the
      bow and the hand fire lean with their sprite (no more poking out in front); the window theme and other unset
      settings no longer reset when the game loads; the party pop-up, swap list, selected party card, skill tree
      names and tabs follow the theme (selected words readable on a tinted selection).
- [x] Update 88: soft-blocky bevels taper into closed corners (no dark wedges; no round shoreline walls through
      them); battle EXP told and filled once after Victory (total + bonus), the bar running through each level;
      ailments last into the next battle (per ailment, Database → Combat → Ailments → Lasts; cured by items or rest);
      hits play out in order (strike, step back, flash, drain with counting numbers, then the lines); burn and poison
      bite at the end of each round with a line; "is fast asleep!" and "woke up!" lines; party members no longer heal
      on the map when the hero's health doesn't; HUD MP purple and EXP light blue (as in battle) and a gold level
      pill; loot lines with icons; the Party tab and Status page redone in the handheld games' style.
- [x] Update 89 (part 1): Status page Stats with the seven stats on the left and the battle numbers on the right;
      fighting styles gone from Status and Equipment. Soft-blocky rounded corners and a dithered grass lip over the
      cliff tops are built in but off (SOFT_LOOK in terrainGeometry.ts) until a look is picked from the previews.
- [x] Update 89 (part 2): Version C picked: soft-blocky outer corners rounded (half a tile), inner corners curving
      round into the lower cell, bevels and lip lit like the top (no line); the grass lip on every height style
      (and the round shoreline banks); Status stats zero-padded (08) so the rank pills line up.
- [x] Update 90: the pale green line along cliff edges gone (the grass lip's texture stays sharp at any angle);
      torch, campfire and lamp flames, lights and embers lean with their props; battle results: each hero's level up
      straight after their EXP, before the loot, and no EXP bar movement before "Victory!" (Addition strikes moved
      it); "Jordan was poisoned!" lines that wait for OK; new prop shapes for tall grass: Star ✳, Rows ≡, Thicket.
- [x] Tall-grass shapes: the owner keeps all three (Star ✳, Rows ≡, Thicket) alongside Cross ×.
- [ ] Lingering ailments as pills on the HUD party cards.
- [x] Update 91 (part 1): Party tab boxes 60% wide, centred, three to the column's height, with EXP bar and numbers;
      Items: the party strip beside the bag is gone; using an item opens a "Use X on whom?" pop-up like the battle's.
- [x] Update 91 (part 2): sprites and props drawn over bevels and cliff walls (they keep the depth they'd have
      standing upright); wall props don't lean; ladders stretch to their wall; tall grass rustles; built-in Tall
      grass, Really tall grass and Wheat; everyone who fought a foe shares its EXP (shown after the first hero's);
      low-HP alert in battle; MP no longer comes back on the map (hero and party); pause tab icons follow the tab's
      text; coin beside the bag's gold; Database → Title & menus: Bars (health, magic, EXP, stamina colours; HP green
      everywhere by default), stamina wheel steady option, Party page layout editor; per-tile "make a normal map".
- [x] Update 91b: terrain gives way to characters and props in depth on the map (no hiding behind a ledge or a tall
      cliff, like the handheld games; buildings still hide you); a hero swapped out still gets the EXP of the foes
      they fought (they were dropped from the battle's lists), told in turn after the first hero's EXP and level up.
- [x] Owner's list (Oct 20, late) (update 92): battle item picker HP bars yellow/red by health; low-HP alert not playing; map /
      title music sometimes kept playing under the battle music; hero briefly faces the camera when hit; battle
      depth-of-field blurs the tops of tall enemies; title → New / Load: keep the title picture up through the fade
      out, then fade in on the right map; steel arrows auto-equipped (the map bow and sword are hidden field tools:
      no arrows used, nothing equipped); Equipment page top-aligned (gear and stats beside the picture panel);
      the triggers (LT / RT) on Equipment, Status and Skill Tree switch party member; Swap first in the Party menu; Addition moves
      into the Equipment page (one equipped at a time), everyone starts with Quick Strike, "plain attack" only for
      heroes set to No Additions in the Database (with Melee or Ranged: ranged fires the bow without running in);
      Settings → Restore defaults asks "Are you sure?"; console command reset_achievements; check every pause-menu
      key/button hint is right.
- [x] Owner's list (Oct 20, night) (update 93):
  - [x] Props: a "Drawn in front of tiles" toggle (on by default, as now). Off for props like the tall wooden
        bridge/platform, whose legs show through the cliff ground in front of them.
  - [x] Items: remove the "Amounts are percentages of the maximum" toggle (it doesn't seem to work for the owner).
        Instead HP and MP each get a plain amount box and a % box, used together: 10 + 30% restores 10 plus 30% of
        max HP. Text reads "Restores 10 + 30% HP".
  - [x] Battle log: the menu confirm chime plays when pressing Next / Continue on a message.
  - [x] Battles show the map's sky (skybox) instead of plain grey fog.
  - [x] Day/night sky: the dawn/dusk change is too fast. Slow it down, with a Database "Sky transition speed" setting.
  - [x] Battle spell menu: the element's icon beside each spell's name (the spell's own Database icon if it has no
        element).
  - [x] Battle start: health bars start at the hero's current health (no drain down from full). If needed, build
        the scene first and fade in once the bars are set.
- [x] Props: a Walk sound (ground sounds or any sound file); bridges sound like their wood or stone (update 96b).
- [x] Owner's list (Oct 21, noon) (update 97):
  - [x] Shop lists follow the cursor (Buy and Sell).
  - [x] Battle Items list no longer under the hero's block (it moves up), with item icons.
  - [x] Buff / debuff arrows with the stat under them, beside the spheres (not over the head).
  - [x] Item target lists and the Swap list show buffs beside names; Swap shows faces and HP / MP / EXP bars (no
        repeated HP on the right).
  - [x] Using a healing item: the bar fills first, then "X recovered N HP!" waits for OK (bag and battle).
  - [x] Knocked-out party members stay down (no getting back up with a quarter of their health) and are hidden on the
        map until healed.
  - [x] Revive items (a Revives switch) usable on knocked-out heroes from the bag; other items refuse them.
- [x] Owner's list (Oct 21, morning) (update 96):
  - [x] Picture bridges drawn at the deck's height (where the banks meet), not down at the ground or water; lying
        flat on the deck by default (or standing up); no water ripples round them.
  - [x] Props: a "Camera tilt" setting (off: the prop stays upright instead of leaning toward the map camera).
  - [x] Props palette: the tools, chosen prop and import buttons stay at the top while the lists scroll.
- [x] Owner's list (Oct 20, 11:35 pm) (update 95):
  - [x] Stat order (Database → Game → Stat order): reorder STR, DEX… once; every list in the game and the Database follows it.
  - [x] "Weight" renamed "Armor type", with an Armor types window (add, rename, remove; untrained costs per type).
  - [x] Items split into tabs: Items, Weapons, Gear (armor, shields, accessories), Shards (spell shards and element
        stones), Key items.
  - [x] Many more built-in icons (weapons, armor and clothes, potions and bottles, food, drinks, materials, gems,
        ores, herbs, containers, spell symbols…), in folding groups, and a Tint for any item icon.
  - [x] Spells: their own icon (built-in, tintable) or "Use its element".
  - [x] Classes → Skill trees: a dropdown per tree (the old checkboxes had been moved to the top of the form by the
        switches-first layout, so only the note showed), with a picture of each tree that opens it in Skill trees.
- [x] Owner's list (Oct 20, late night) (update 94):
  - [x] Props: a "Walk on top (bridge or platform)" setting (east–west, north–south, or a platform any way), drawn as
        the prop's own picture or built in 3D. Customised built-in bridges that had lost it work as bridges again.
  - [x] Props palette keeps its scroll position when a prop's window opens and closes (or a prop is picked).
  - [x] Props palette: tick props (checkbox on each card, Tick all per section) and Edit together: only the settings
        changed there are given to every ticked prop; each keeps everything else.

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
