# To-do (ideas for later)

Kept in the project so they travel with the code. Tick them off as they're built.

## World
- [ ] Bridges and platforms; moving platforms (left ↔ right, rising ↔ falling).
- [ ] Water at level 0: wet puddles on the floor, little splashes when walked through.
- [x] Real-world date under the game time in the HUD (update 37). Events that happen on certain days or days of the week
      (every Saturday a certain enemy spawns in a certain place with rare items…).

## Menus and saving
- [ ] Open / save a whole project as a zip in the Map Editor artifact (so it works on the Android tablet).
- [ ] Journal: Achievements tab.
- [ ] Journal: Story tab. Like the quest log but for the main storyline; each entry shows the game time and real-world
      date it was unlocked, with a screenshot of the moment (an event command "Story note" that takes it).

## Messages
- [ ] Speech bubble position chosen in the editor (per message or per character), not a player setting.
- [ ] Message window backgrounds: imported images, cropped like props (a "Window backgrounds" tab).
      Default: white with black text. Text colour, bold, italic options.

## Abilities and combat
- [ ] Turn-based battles, next steps: learned spells (Database → Spells; taught by skill tree nodes, events and
      trainers; ranks add charge turns; Counterspell breaks a charge; a learned spell as the action mode's field
      spell; shards stay for enchanting), Additions (timed strikes with button prompts, ranks gained by use, set per
      character or chosen in battle), classes (a skill tree per class, class change keeps what's learned), a
      "Start battle" event command, buffs in battle, swapping party members mid-battle (FFX), a battle backdrop
      image per map.

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
