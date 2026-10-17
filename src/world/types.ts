/**
 * Data formats. Everything the editor will eventually create lives in these shapes,
 * saved as JSON under public/data/.
 */

/** Terrain characters: . grass  = path  : sand  ~ water  # raised plateau (height 1) */
export type Terrain = '.' | '=' | ':' | '~' | '#';

export type Dir = 'down' | 'left' | 'right' | 'up';

/** A decoration placed on the map (trees, rocks, flowers…). Positions are in tiles; x/z may be fractional. */
export interface PropFoot { w: number; d: number; solid: string[] }

export interface PropData {
  type: string;
  x: number;
  z: number;
  /** Height the prop stands on (1 for plateau tops). */
  y?: number;
  /** Uniform scale. */
  s?: number;
}

/* ------------------------------------------------------------------ lights */

/** When a light is on. "night" lights fade in at dusk and out at dawn. */
export type LightSchedule = 'always' | 'night' | 'nightBoost';
export type Flicker = 'none' | 'fire' | 'candle' | 'pulse' | 'faulty';

/** Settings every light shares. */
export interface LightSettings {
  /** sRGB hex colour. */
  color: string;
  /** Brightness (point / spot: about 1–4; area: 1 = no change, below 1 shades, above 1 brightens). */
  intensity: number;
  schedule?: LightSchedule;
  /** Only on while this switch is ON. */
  switch?: string;
}

export interface PointLightData extends LightSettings {
  type: 'point';
  /** Position in tiles (x, z on the ground; y height above the ground). */
  x: number; z: number; y?: number;
  /** Reach in tiles. */
  radius: number;
  flicker?: Flicker;
  shadows?: boolean;
}

export interface SpotLightData extends LightSettings {
  type: 'spot';
  x: number; z: number; y?: number;
  radius: number;
  /** Which way the beam points. */
  dir: Dir;
  /** Cone width in degrees. */
  angle: number;
  /** How steeply it points down, in degrees (0 = level, 90 = straight down). */
  tilt: number;
  flicker?: Flicker;
  shadows?: boolean;
}

/** Local tint: colours and lights or shades everything inside a shape, fading at the edge. */
export interface AreaLightData extends LightSettings {
  type: 'area';
  /** Centre in tiles. */
  x: number; z: number;
  shape: 'rect' | 'ellipse';
  /** Size in tiles. */
  w: number; h: number;
  /** Soft edge width in tiles. */
  feather: number;
}

export type LightData = PointLightData | SpotLightData | AreaLightData;

/** Pre-0.2 maps stored campfires and torches as lights; they are props now. */
export interface LegacyLightData { kind: 'campfire' | 'torch'; x: number; z: number }

/* ------------------------------------------------------------------ props */

/** A light carried by a prop. Offset in tiles from the prop's anchor (bottom centre): x sideways, y up. */
export interface PropLight extends LightSettings {
  x: number; y: number;
  radius: number;
  flicker?: Flicker;
  shadows?: boolean;
}

/** A prop type: built in, or imported from an image (stored in public/data/assets.json). */
export interface PropDef {
  id: string;
  name: string;
  /** Image path relative to public/, e.g. "assets/props/lamp.png". Built-in props have none. */
  image?: string;
  /** Built-in props only: key of the art generated in code. */
  builtin?: string;
  /** Optional normal map (same framing as the image). Generated from the image when missing. */
  normal?: string;
  /** Optional night-glow mask: bright pixels glow at night (lit windows). */
  glow?: string;
  glowColor?: string;
  /** Size in tiles. */
  w: number; h: number;
  /** Tiles that block movement, as offsets in tiles from the anchor along x (0 = the tile under the anchor). */
  block: number[];
  /**
   * Its footprint on the tile grid (props set up in the importer): `w` tiles across and `d` deep, and which of them
   * are solid (one string per row from the back row to the front, "#" solid, "." walkable). A prop with a footprint
   * stands on its front edge: placed, it covers whole tiles, its picture rising from the footprint's front edge.
   * Without one (built-ins, older props), it stands in the middle of a tile and `block` says what it blocks.
   */
  foot?: PropFoot;
  /**
   * How it's drawn: a flat card (default); "solid", its outline pushed back `thickness` tiles (default: the footprint's
   * depth) so it looks like a block; or two crossing copies of the picture, "crossX" (at 45°) or "crossPlus" (one side-on).
   */
  shape?: 'flat' | 'solid' | 'crossX' | 'crossPlus';
  thickness?: number;
  /** Props with a footprint: "solid" (default) blocks its solid tiles; "flat" only a thin strip along the picture. */
  collide?: 'solid' | 'flat';
  /** "point" keeps pixels crisp; "smooth" filters them. */
  filter?: 'point' | 'smooth';
  castShadow?: boolean;
  light?: PropLight;
  /** Using it (facing it and pressing the action button) makes it where the player comes back after losing all health. */
  respawn?: boolean;
  /** Sways in the wind: how much (1 for a tree, more for grass, 0 or missing: stays still). The base doesn't move. */
  sway?: number;
  /** Sits flat against the cliff face behind it (cave mouths, doorways, doors, wall banners) instead of standing in its tile. */
  wall?: boolean;
  /** Fires that burn out: starts unlit the first time the player comes (light it with fuel or a fire attack). */
  startsOut?: boolean;
  /** Weapons cut it down (vines, thin trees); fire burns it away (giving nothing). */
  cuttable?: boolean;
  /** Mining weapons (pickaxes, hammers) break it after `hits` blows (default 3): boulders, ore veins. */
  mineable?: boolean;
  hits?: number;
  /** A forge (an anvil): using it smelts ore into ingots, upgrades weapons and armor, and sets shards in them. */
  forge?: boolean;
  /** After being cut it grows back when the player leaves the map (otherwise it stays cut, saved with the game). */
  regrows?: boolean;
  /** Cut down or mined: the prop left in its place (a stump, rubble), and items it gives (firewood, stone, ore). */
  stump?: string;
  /** Seasons: its leaves change colour (and get snow in winter), it's bare in winter, or it doesn't change. Unset: guessed from its name. */
  season?: 'leaves' | 'bare' | 'off';
  /** `chance`: percent (default 100), for rarer finds (gold in an ore vein). */
  drops?: { item: string; count: number; chance?: number }[];
  /** Fires (props with a flame or light): game hours one burns before going out. Missing: burns forever. */
  burns?: number;
  /** Fires: the prop shown instead while it's out (when the flames are part of this prop's own image). */
  burntOut?: string;
  /** Animated flame drawn over the prop (built-in campfire and torch). */
  flame?: { x: number; y: number; w: number; h: number; embers?: boolean };
  /** Who made the art (props added from the LPC library); shown in the Credits screen. */
  credits?: SpriteCredit[];
}

/** A ground tile type: built in, or imported from a texture (stored in public/data/assets.json). */
export interface TileDef {
  /** The single character that stands for this tile in a map's terrain rows. */
  key: string;
  id: string;
  name: string;
  /** Texture path relative to public/, e.g. "assets/tiles/cobble.png". Built-in tiles have none. */
  image?: string;
  /** Optional normal map. Generated from the texture when missing. */
  normal?: string;
  /** How many tiles across one copy of the texture covers (1 = every tile shows the whole texture). */
  span: number;
  /** "point" keeps pixels crisp (like Unity's "Point (no filter)"); "smooth" filters them. */
  filter?: 'point' | 'smooth';
  /** Blocks movement (water, walls…). */
  blocks?: boolean;
  /** Built-in tiles only: painted in code. */
  builtin?: boolean;
  /** Who made the art (tiles added from the LPC library); shown in the Credits screen. */
  credits?: SpriteCredit[];
}

/** Imported assets, saved as public/data/assets.json. */
export interface AssetRegistry {
  props: PropDef[];
  tiles: TileDef[];
  /**
   * Cliff walls per tile type: tile key → what the walls under that tile look like
   * ("bricks" for the built-in stone bricks, or an imported tile's key). Tiles not listed use the map's setting.
   */
  tileCliffs?: Record<string, string>;
  /** Tiles that are roads (true) or not (false), overriding the default (only the built-in path is a road). Roads continue past the map edge. */
  tileRoads?: Record<string, boolean>;
  /** Edge blending per tile key (built-in or imported). Missing settings use the defaults (see world/blend.ts). */
  tileBlend?: Record<string, Partial<TileBlend>>;
  /** Footstep sounds per tile key ("grass", "stone", "wood"…), overriding the guess from the tile's name. */
  tileSteps?: Record<string, string>;
  /** Ailments a tile gives while it's stood on (lava burns, a swamp poisons): a % chance each half second. */
  tileAilments?: Record<string, { ailment: Ailment; chance?: number; seconds?: number }>;
}

/** How a tile's edges blend into its neighbours. */
export interface TileBlend {
  blend: boolean;
  /** Where two blending tiles meet, the higher priority spreads over the lower. */
  priority: number;
  /** How far the edge spreads into the neighbour, in tiles (0.05 – 0.5). */
  width: number;
  /** 0 = an even edge, 1 = very irregular. */
  roughness: number;
  /** ragged: hard pixel edge; dither: a dithered fade (pixel art); smooth: a soft fade (smooth textures). */
  edge: 'ragged' | 'dither' | 'smooth';
  /** Imported tiles: the edge follows the texture (bright parts like stones reach further). */
  detail: boolean;
}

/** When a page applies. With several matching pages, the last one wins (as in RPG Maker). */
export type Condition =
  | { switch: string; is?: boolean }
  | { var: string; op: '>=' | '<=' | '==' | '>' | '<'; value: number }
  /** The player carries at least `count` of an item (equipped counts too). */
  | { item: string; count?: number }
  /** The player has at least this much gold. */
  | { gold: number }
  /** A quest's state ('started': active or ready to hand in). */
  | { quest: string; is: QuestStatus | 'started' }
  /** One of a quest's objectives is done (or not, with `done: false`). */
  | { quest: string; objective: string; done?: boolean }
  /** The real world's day of the week is one of these (0 Sunday … 6 Saturday, from the player's date). */
  | { weekday: number[] }
  /** The real moon's phase tonight is one of these (full and new for werewolves…). */
  | { moon: import('./moon').MoonPhase[] }
  /** The temperature here (°F) is at least / at most this. */
  | { temp: number; op: '>=' | '<=' }
  /** The weather here is one of these. */
  | { weather: WeatherKind[] };

/** Event commands. Branches nest as lists, so no indent bookkeeping is needed. */
export type Command =
  /** `bubble`: a speech bubble with a tail pointing at the speaker, or a plain box (default: a tail when the event shows a character). */
  | { cmd: 'text'; text: string; speaker?: string; bubble?: 'speech' | 'plain'; /** A text box style (Database → Text boxes; unset: automatic). */ style?: string; /** Its own look: colours, size, bold… (like word bubbles), over the style's. */ look?: import('../ui/richText').TextLook }
  | { cmd: 'choice'; options: string[]; branches: Command[][]; cancel?: number }
  | { cmd: 'if'; condition: Condition; then: Command[]; else?: Command[] }
  | { cmd: 'setSwitch'; switch: string; value: boolean }
  | { cmd: 'setVar'; var: string; op: 'set' | 'add'; value: number }
  | { cmd: 'wait'; seconds: number }
  | { cmd: 'fadeOut'; seconds?: number }
  | { cmd: 'fadeIn'; seconds?: number }
  | { cmd: 'setTime'; hour: number; instant?: boolean }
  /**
   * Sleep (a camp, an inn): the camera tilts up to the sky, the hours rush by overhead, then it comes back down.
   * Until morning (7:00), until night (21:00), or for some hours; `rest`: health, magic and stamina refill.
   */
  /** Change how a hero's stat grows each level (for good). hero: an id, '' for the hero you play, 'all' for everyone. */
  | { cmd: 'statRank'; hero: string; stat: 'str' | 'dex' | 'def' | 'mag' | 'mdf'; rank: import('../game/statRanks').Rank }
  | { cmd: 'sleep'; until?: 'morning' | 'night' | 'hours'; hours?: number; rest?: boolean }
  | { cmd: 'ability'; ability: Ability; on: boolean }
  | { cmd: 'gauge'; gauge: Gauge; op: 'add' | 'set' | 'fill'; value: number }
  /** Give the hero an ailment (for `seconds`, 0: its usual time), or cure one ('all': every one but Zombie). */
  | { cmd: 'ailment'; op: 'give' | 'cure'; ailment: Ailment | 'all'; seconds?: number }
  /** Open the nearest fire's fuel menu (add firewood, see how long it burns). */
  | { cmd: 'tendFire' }
  /** A full rest (campfire, inn): health, magic and stamina to full for the whole party, ailments cured (not Zombie). */
  | { cmd: 'fullRest' }
  /** Open the save screen (a save point). */
  | { cmd: 'save' }
  /** Give items; if the bag is full the player is told and the event stops (so a chest stays closed). */
  | { cmd: 'giveItem'; item: string; count: number; silent?: boolean }
  | { cmd: 'takeItem'; item: string; count: number }
  | { cmd: 'gold'; op: 'add' | 'set'; value: number; silent?: boolean }
  /** A shop: what it sells (price overrides optional) and whether the player can sell to it. */
  | { cmd: 'shop'; goods: { item: string; price?: number }[]; canSell?: boolean; name?: string }
  /** Move the player to a map (this one or another) at x, z. Ends the event. */
  | { cmd: 'transfer'; map: string; x: number; z: number; dir?: Dir; fade?: 'black' | 'white' | 'none' }
  /** Play a sound effect (a built-in name like "levelUp", or a file path). */
  | { cmd: 'sound'; sound: string }
  /** Change the music or the background sound ('' stops it; omitted: back to the map's own). */
  | { cmd: 'music'; music?: string; fade?: number }
  | { cmd: 'ambience'; ambience?: string }
  /** A hero (Database → Heroes, not the first) joins or leaves the party. */
  | { cmd: 'party'; op: 'add' | 'remove'; hero: string; quiet?: boolean }
  /** Change this map's weather (kept for the rest of the game); wind: a new breeze strength (blank: unchanged). */
  | { cmd: 'weather'; kind: WeatherKind; amount?: number; wind?: number; scope?: 'here' | 'world' }
  /** Change the temperature on this map (set to, or warmer / colder by, °F) until the player leaves it; reset: back to normal. */
  | { cmd: 'temperature'; op: 'set' | 'add' | 'reset'; value?: number }
  /** Give skill points (a quest reward). */
  | { cmd: 'skillPoints'; value: number }
  /** Overworld weapons (the field sword and bow) on or off: off indoors or in restricted areas (greyed out on the HUD). */
  | { cmd: 'fieldWeapons'; on: boolean }
  /** Unlock an achievement (Database → Achievements). */
  | { cmd: 'achievement'; id: string }
  /** Run a developer-console command (testing shortcuts: give items, teleport…). */
  | { cmd: 'console'; line: string }
  /**
   * Quests: start one, tick off (or count up) an objective, complete it (gives the rewards), fail it, or forget it
   * (back to not started). `add` counts an objective up by that much instead of finishing it.
   */
  | { cmd: 'quest'; quest: string; op: QuestOp; objective?: string; add?: number; silent?: boolean }
  /**
   * A turn-based battle against these enemies (a boss, a set-piece fight). The event waits for it. `canRun`: the
   * party may run away (default false); `lose: 'continue'`: losing doesn't send the party back (the event goes
   * on, with the party on 1 health); `resultVar`: a variable set to 1 (won), 2 (ran away) or 0 (lost).
   */
  | { cmd: 'battle'; enemies: string[]; canRun?: boolean; lose?: 'respawn' | 'continue'; resultVar?: string; music?: string; /** The battle map to fight on (unset: the map's). */ map?: string }
  /** Teach a spell (at a rank) or an Addition: to the hero you play (''), a party hero by id, or everyone ('@party'). */
  | { cmd: 'learn'; who: string; spell?: string; rank?: number; addition?: string; silent?: boolean }
  /** Change a hero's class, or let them change to it later (unlock). */
  | { cmd: 'heroClass'; who: string; op: 'change' | 'unlock'; cls: string; silent?: boolean };

export type QuestOp = 'start' | 'objective' | 'complete' | 'fail' | 'reset';
/** inactive: not started; ready: every objective done, waiting to be handed in. */
export type QuestStatus = 'inactive' | 'active' | 'ready' | 'done' | 'failed';
/**
 * What an objective asks for. task: ticked off by an event (talk to someone, open a gate…); defeat: beat `count` of an
 * enemy type; collect: carry `count` of an item (counted live: selling them undoes it); visit: reach a map.
 */
export type ObjectiveKind = 'task' | 'defeat' | 'collect' | 'visit';
export interface QuestObjective {
  id: string;
  text: string;
  kind: ObjectiveKind;
  enemy?: string;
  item?: string;
  map?: string;
  /** How many (defeat, collect; a task with a count is counted up with "add"). Default 1. */
  count?: number;
  /** Not needed to finish the quest. */
  optional?: boolean;
}
export interface QuestReward { xp?: number; gold?: number; skillPoints?: number; items?: { item: string; count: number }[] }
export interface QuestDef {
  id: string;
  name: string;
  /** Main story or side quest (main quests are listed first, with a star). */
  kind: 'main' | 'side';
  /** Who gave it and where (shown in the quest log). */
  giver?: string;
  location?: string;
  description?: string;
  objectives: QuestObjective[];
  /** One objective at a time: the next shows (and counts) once the one before is done. */
  inOrder?: boolean;
  /** Finishes by itself when the last objective is done; otherwise it waits to be handed in (an event completes it). */
  autoComplete?: boolean;
  /** Shown once every objective is done and it's waiting to be handed in, e.g. "Return to Mira". */
  turnIn?: string;
  rewards?: QuestReward;
  /** Completing it takes the items its collect objectives asked for. */
  takeItems?: boolean;
}

/** Ways the player can move beyond walking. */
export type Ability = 'run' | 'jump' | 'climb' | 'crawl';
export const ABILITIES: Ability[] = ['run', 'jump', 'climb', 'crawl'];

export type Trigger = 'action' | 'touch' | 'auto' | 'none';

export interface EventPage {
  condition?: Condition;
  /** Static sprite key (see SpriteLibrary), e.g. "sign". */
  sprite?: string;
  /** Character key from database.json, drawn with a walking sprite sheet. */
  character?: string;
  dir?: Dir;
  /** Turn to face the player when activated. */
  facePlayer?: boolean;
  trigger: Trigger;
  solid?: boolean;
  /** Its picture sits flat against the wall behind (default: as its prop says; cave mouths and doors do). */
  wall?: boolean;
  /** Running this page makes it where the player comes back after losing all health. */
  respawn?: boolean;
  /** An enemy (id from Database → Enemies) instead of an NPC: it fights, and the page's commands run when it's defeated. */
  enemy?: string;
  /**
   * Something to break (a crate, a cracked boulder, a crystal switch): it can be locked on to and hit, and when its
   * health runs out the page's commands run (set a switch to lower a bridge, open a gate…).
   */
  breakable?: BreakableDef;
  /** A word bubble over the event while this page is showing: "!" / "?" for quests, or short text. */
  bubble?: import('../ui/BubbleLayer').EventBubble;
  /** A sound that plays all the time while this page shows (a campfire, a shore, a waterfall): loud up close, fading with distance. */
  sound?: EventSound;
  commands: Command[];
}

export interface EventSound {
  /** A loop: 'builtin:fire', 'builtin:shore'… or a file (audio/ambience/…). */
  src: string;
  /** 0 … 100 (default 80). */
  volume?: number;
  /** Heard up to this many tiles away (default 8). */
  range?: number;
}

/** Elements: water beats fire beats nature beats earth beats shock beats water; light and dark beat each other. */
export type Element = 'neutral' | 'water' | 'fire' | 'nature' | 'earth' | 'shock' | 'light' | 'dark';

/** Ailments a hit can give (each with a chance), and buffs items can give. */
export type Ailment = 'burn' | 'poison' | 'chill' | 'paralyze' | 'blind' | 'silence' | 'stagger' | 'sleep' | 'confusion' | 'zombie';
export type BuffKind = 'crit' | 'str' | 'dex' | 'def' | 'mag' | 'mdf' | 'regen';
/** A chance (%) for a hit to give an ailment, for `seconds` (0 or missing: its usual time). */
export interface Inflict { ailment: Ailment; chance: number; seconds?: number }
/** A buff an item gives: how much (default per kind) for how long. */
export interface BuffGrant { buff: BuffKind; amount?: number; seconds?: number }

export interface BreakableDef {
  /** How much damage it takes to break. */
  hp: number;
  /** Softens each hit like armour: damage × 50 / (defence + 50). */
  defense?: number;
  /** What can break it (all of them when left out): a crystal only magic reaches, a rope only arrows… */
  hitBy?: ('melee' | 'bow' | 'magic')[];
  /** Only hits of this element hurt it (an ice wall only fire melts). */
  needs?: Element;
  /** Shown over its health bar (default: the event's name). */
  name?: string;
}

export interface EventData {
  id: number;
  name: string;
  /** Top-left tile. */
  x: number;
  z: number;
  /** Size in tiles (1 × 1 when omitted). Any tile of the area triggers the event. */
  w?: number;
  h?: number;
  /** A marker on the world map (Quest location, Landmark…), optionally only while a switch is on. */
  marker?: import('./landmarks').EventMarker;
  pages: EventPage[];
}

/** A ramp or stairs on one cell. Without `dir` it faces the neighbour that is one step higher. */
export interface RampData {
  x: number;
  z: number;
  /** corner: a walkable slope that rounds a hill's corner (its raised corners meet the higher ground around it). */
  style: 'ramp' | 'stairs' | 'corner';
  /** Direction it rises towards. */
  dir?: Dir;
  /** Corner slopes: which corners are raised one step (unset: found from the neighbours one step higher). */
  raise?: CornerName[];
}

/** A cell's corners, in the order north-west, north-east, south-east, south-west. */
export type CornerName = 'nw' | 'ne' | 'se' | 'sw';
export const CORNER_NAMES: CornerName[] = ['nw', 'ne', 'se', 'sw'];

/** Which wall of a building: front faces the camera (down the map), back faces up the map. */
export type BuildingSide = 'front' | 'back' | 'left' | 'right';

export interface BuildingDoor {
  side: BuildingSide;
  /** Tiles from the wall's left end (front and back, as seen from the front) or its top end (left and right walls). */
  at: number;
}

/**
 * A building: a rectangle of tiles (its footprint, all blocked) with walls, a roof, doors and windows, drawn as a 3D
 * model. Interiors are separate maps: put a Transfer event on the tile in front of a door.
 */
export interface BuildingData {
  x: number;
  z: number;
  /** Footprint size in tiles: w across, d up the map. */
  w: number;
  d: number;
  /** Wall height in tiles (default 2.5). */
  height?: number;
  /** Wall look: "plaster" (default), "stone", "brick", "timber", or an imported tile's key. */
  wall?: string;
  /** Roof look: "shingle" (default), "thatch", "slate", "wood", or an imported tile's key. */
  roof?: string;
  /** Roof shape (default gable). */
  roofStyle?: 'gable' | 'hip' | 'flat';
  /** Which way the ridge runs: "x" across the map, "z" up it (default: along the longer side). */
  ridge?: 'x' | 'z';
  /** How far the roof rises above the walls, in tiles (default: from the building's depth). */
  pitch?: number;
  /** How far the roof reaches past the walls, in tiles (default 0.3). */
  overhang?: number;
  /** Windows on each wall (default few). They light up at night. */
  windows?: 'none' | 'few' | 'many';
  doors?: BuildingDoor[];
  /** Shown in the editor only. */
  name?: string;
}

/** Random encounters on a map: which enemies, how often, how many at once, and where. */
export interface EncounterTable {
  /** Enemy ids with weights (higher: more often). */
  enemies: { enemy: string; weight?: number }[];
  /** About this many tiles walked between battles (default 30). */
  steps?: number;
  /** Enemies in each battle (default 1 – 3). */
  min?: number;
  max?: number;
  /** Only on these terrain characters (tall grass, say). Empty: anywhere on the map. */
  terrain?: string;
}

/** A troop: a group of enemies that fight together (Database → Troops). */
export interface BattleMarker { side: 'party' | 'enemy'; x: number; z: number }
export interface BattleCamera { distance?: number; height?: number; side?: number; fov?: number }

export interface TroopDef {
  id: string;
  name: string;
  /** Each kind of enemy and how many of it (a range: 1–3 slimes). */
  members: { enemy: string; min?: number; max?: number }[];
  /** Its own battle music (else the map's), and whether the party may run (default yes). */
  music?: string;
  noRun?: boolean;
}

/** One troop in a zone: how often it comes, and when it can. */
export interface ZoneTroop {
  troop: string;
  /** How often, against the zone's other troops (default 1). */
  weight?: number;
  /** Only by day or only at night (game time). */
  time?: 'day' | 'night';
  /** Only on these real-world days of the week (0 Sunday … 6 Saturday). */
  days?: number[];
  /** Only while this switch is ON (story progress). */
  switch?: string;
}

/** A painted zone on a map: its troops and about how many tiles are walked between battles. */
export interface EncounterZone {
  name?: string;
  steps?: number;
  troops: ZoneTroop[];
  /** The battle map for battles in this zone (unset: the map's). */
  battleMap?: string;
}

export interface MapData {
  name: string;
  width: number;
  height: number;
  terrain: string[];
  /** Height layer: one row per line, space-separated steps from -10 to 10 (a step is half a tile). Omitted when flat. */
  heights?: string[];
  /**
   * Water layer: one row per line, space-separated: "." for none, else the surface level in steps plus an
   * optional kind letter (s shallow, w swimmable, d deep; none = automatic by depth). Omitted when dry.
   */
  water?: string[];
  /**
   * How this map's water looks: bumpiness of its surface (0 glassy … 2 rough, default 1), murkiness (0 crystal clear …
   * 1 muddy, default 0.5), and flow (tiles per second of current, 0 still; direction in degrees, 0 = east, 90 = south).
   */
  waterLook?: { bumpy?: number; murk?: number; flow?: number; flowDir?: number };
  /**
   * The map's kinds of water (Water tab): each cell of water uses one (its "@n" in the water rows; the first when
   * none), so a pond, a river and a lava pool can share a map. Missing: one style, from `waterLook`.
   */
  waterStyles?: WaterStyle[];
  /**
   * Fishing spots painted over water (Map editor → Water → Fishing): one string per row, space-separated, "." for none,
   * otherwise the number of the spot's catch table in `fishZones`.
   */
  fishing?: string[];
  /** This map's season, whatever the day (a snowy peak); unset: the season of the day. Outdoor maps only. */
  season?: import('./seasons').Season;
  /** What can be caught where fishing is painted: a catch table per spot (a pond, the river, the sea…). */
  fishZones?: FishZone[];
  /** Ramps and stairs, each rising one step towards a higher neighbour. */
  ramps?: RampData[];
  /**
   * Passage layer: one row per line, one character per cell. "." nothing special, "c" climbable
   * (its cliff walls can be climbed), "l" low clearance (crawl through), "x" always blocked,
   * "o" always passable (overrides blocking tiles and props). Omitted when empty.
   */
  passage?: string[];
  props: PropData[];
  lights: LightData[];
  events: EventData[];
  /** Houses, shops and other buildings, drawn in 3D from a footprint. Omitted when there are none. */
  buildings?: BuildingData[];
  /** A map theme (Database → Map themes): settings this map leaves unset come from it. */
  theme?: string;
  /** What cliff walls look like unless a tile chooses its own: "bricks" (default) or an imported tile's key. */
  cliffTile?: string;
  /** What lies beyond each edge of the map (older maps: { kind: 'forest', seed }). */
  border?: MapBorder;
  /** Outdoor (full day and night), indoor (muted, windows lit by day) or dark (caves: dark at any hour). */
  environment?: MapEnvironment;
  /** Sound: music, music while fighting, and the background sound by day and at night (sources: "builtin:field" or a file path; '' = none). */
  music?: string;
  battleMusic?: string;
  /** Turn-based battles: random encounters while walking (Pokémon tall grass, classic JRPG overworlds). */
  encounters?: EncounterTable;
  /**
   * Encounter zones painted on the map (the editor's Spawns layer): one character per cell, A–Z for a zone, "."
   * for none. Each zone's troops and how often battles come are in `zones`.
   */
  zoneGrid?: string[];
  zones?: Record<string, EncounterZone>;
  /**
   * 'battle': a battle map (a stage for turn-based battles: forest clearing, plains, city street…), listed apart in
   * the editor and never walked on. Its `markers` say where the party and the enemies stand.
   */
  kind?: 'field' | 'battle';
  /** Battle maps: where each party member (in party order) and each enemy (in order) stands. */
  markers?: BattleMarker[];
  /** Battle maps: the camera behind the party (tiles back, tiles up, tiles to the side; field of view in degrees). */
  battleCamera?: BattleCamera;
  /** Field maps: the battle map turn-based battles here are fought on (its file name); unset: the flat battle screen. */
  battleMap?: string;
  /** How battles here begin (one, or several picked at random): shatter, swirl, smudge, blinds, zoom, flash. Unset: any. */
  battleTransitions?: string[];
  ambience?: string;
  ambienceNight?: string;
  /** Background sound in autumn and winter (outdoors, by day). Unset: the forest's birds give way to cold wind. */
  ambienceCold?: string;
  /** The breeze: strength 0 (calm) … 1 (stormy), default 0.3 outdoors and 0 indoors; direction in degrees (0 = east, 90 = south). */
  wind?: { strength?: number; dir?: number };
  /**
   * Unique weather: this map has its own weather (below) instead of sharing the outdoor weather every other outdoor
   * map shares. Omitted: unique when `weather` is set (maps from before sharing). Maps with the same `weatherZone`
   * share their weather with each other (a desert, a mountain range).
   */
  uniqueWeather?: boolean;
  weatherZone?: string;
  /** Climate: this many °F warmer (+) or colder (−) than the season says (a desert, a mountain top). */
  tempOffset?: number;
  /** Its own weather at the start, when unique (a "Change weather" command can change it for the rest of the game). */
  weather?: { kind: WeatherKind; amount?: number };
  /** Air: distance haze, low ground mist (all day, mornings or nights only) and shafts of sunlight; each 0 … 1. */
  atmosphere?: { haze?: number; mist?: number; mistWhen?: MistWhen; rays?: number; clouds?: number };
}

export type MistWhen = 'always' | 'morning' | 'night';

export type WeatherKind = 'none' | 'rain' | 'storm' | 'snow' | 'blizzard' | 'haze' | 'sandstorm' | 'pollen' | 'dust' | 'leaves';
export const WEATHER_KINDS: WeatherKind[] = ['none', 'rain', 'storm', 'snow', 'blizzard', 'haze', 'sandstorm', 'pollen', 'dust', 'leaves'];

/** Palette for a generated character sprite sheet (stand-in until real sheets are imported). */
export interface CharacterPalette {
  hair: string; hairLight: string; hairDark: string;
  skin: string; skinShade: string; eye: string;
  tunic: string; tunicShade: string; tunicLight: string;
  belt: string; buckle: string;
  pants: string; pantsShade: string; boot: string;
  cape: string; capeShade: string;
}

/** One animation in an animated sheet: its first row, frame count, 1 or 4 directions, frame order and speed. */
export interface SheetAnim { row: number; frames: number; dirs: 1 | 4; cycle: number[]; ms: number }

/** An animated character sheet (Character Builder, LPC layout): square frames, named animations. */
export interface CharacterAnimLayout {
  /** Frame size in pixels (64 for LPC). Characters are drawn at 32 pixels per tile. */
  frame: number;
  /** The order of the 4 direction rows in each 4-direction animation (LPC: up, left, down, right). */
  dirs: Dir[];
  anims: Record<string, SheetAnim>;
}

/** Credit for an artwork used in the game (sprite parts from the Character Builder). */
export interface SpriteCredit { item: string; authors: string[]; licenses: string[]; urls: string[] }

/** Where one animation's frames are in a weapon sheet (y in pixels; frames are `frame` px square, `dirs` rows). */
export interface WeaponSheetAnim { y: number; frame: number; frames: number; dirs: 1 | 4 }
export type WeaponSpriteKind = 'sword' | 'blunt' | 'staff' | 'bow' | 'shield';
/**
 * An LPC weapon drawn over an animated character, frame for frame (assets/weapons/weapons.json). The back layer
 * is drawn behind the body, the front layer over it. Attack frames can be bigger than the body's (128 or 192 px,
 * centred on it). Animation names follow the body's; "slash_reverse" is the slash played backwards.
 */
export interface WeaponSpriteDef {
  id: string;
  name: string;
  kind: WeaponSpriteKind;
  file: string;
  width: number;
  height: number;
  layers: { back: Record<string, WeaponSheetAnim>; front: Record<string, WeaponSheetAnim> };
  anims: string[];
  /** Index of its icon in thumbs.png (built-in weapons). */
  thumb: number;
  /** Where its icon is in its own sheet (weapons made in the weapon builder). */
  icon?: { x: number; y: number; w: number; h: number };
  /** Made in the weapon builder (imported into the project, not one of the built-in sheets). */
  custom?: boolean;
  /** The built-in weapon it was made from. */
  base?: string;
  /** The glow and trail it was made with (an item choosing it starts with them). */
  effects?: { glow?: WeaponGlow; trail?: WeaponTrail };
  credits: SpriteCredit[];
}
export interface WeaponGlow { color: string; /** 0.2 – 2, default 1. */ strength?: number; /** Slow pulse (default on). */ pulse?: boolean }
export interface WeaponTrail { color: string; /** How many earlier frames echo behind the swing (1 – 4, default 3). */ length?: number }
export interface WeaponSpriteManifest { version: number; thumbSize: number; thumbCols: number; weapons: WeaponSpriteDef[] }

/** A section of the Credits screen you write yourself (Database → Credits). */
export interface CreditEntry { title: string; names: string }

export interface CharacterDef {
  name: string;
  /** The built-in placeholder look, recoloured (used when there's no sheet). */
  palette?: CharacterPalette;
  /**
   * An imported character sheet (path relative to public/, e.g. "assets/characters/mira.png"): 3 frames across ×
   * 4 rows (down, left, right, up), any frame size; it's always shown 1.5 tiles tall. Sheets from the Character
   * Builder's LPC edition carry `anim` instead (then frames are square, 32 pixels per tile).
   */
  sheet?: string;
  /** The animations in an animated sheet (read from the PNG when it's imported). */
  anim?: CharacterAnimLayout;
  /** Who made the sheet's parts (read from the PNG; shown on the Credits screen). */
  credits?: SpriteCredit[];
}

/** How a new game's hero gets their stats (Database → Heroes). */
export interface CreationSettings {
  /** Show the stat screen after New Game (off: the hero's stats are used as set). */
  enabled?: boolean;
  /** Which ways are offered (default: roll, point buy and standard array). 'hard' is 3d6 in order. */
  methods?: ('roll' | 'pointBuy' | 'array' | 'hard')[];
  /** How many rerolls (0 or missing: as many as they like). */
  rerolls?: number;
}

/** A hero (Database → Heroes): their name, look and starting stats. */
export interface HeroDef {
  id: string;
  name: string;
  /** Which look from Characters (the first hero's is the player's look). */
  look?: string;
  /** Face art for the battle screen and menus (an image path); unset: a face cut from their look. */
  face?: string;
  /** Turn-based: voice clips, one at random as they land a weapon or bow attack (sound sources). */
  attackSounds?: string[];
  /** Turn-based battles: raise (+) or lower (−) their picture, in tiles, when the art floats or sinks. */
  battleOffset?: number;
  /** The Addition Attack performs unless the player picks another (Party → Addition); unset: their first. */
  defaultAddition?: string;
  /** Starting Strength, Dexterity, Defence, Magic and Magic Defence (10 each when left out). */
  stats?: Partial<Record<'str' | 'dex' | 'def' | 'mag' | 'mdf', number>>;
  /** How each stat grows a level: A +4, B +3, C +2 (default), D +1, F +0 (game/statRanks.ts). */
  ranks?: Partial<Record<'str' | 'dex' | 'def' | 'mag' | 'mdf', import('../game/statRanks').Rank>>;
  /** Set up their stats when they join (dice, point buy, standard array, or the Database's): the hero you play does by default. */
  setupStats?: boolean;
  /** The first hero: how a new game makes their stats. */
  creation?: CreationSettings;
  /** Their colour in menus (behind "equipped" on what they wear, on their card). Unset: one of a few defaults. */
  color?: string;
  /** A few lines about them, shown on their Status page. */
  about?: string;
  /** Up to two elements, and elements they're immune to or absorb. */
  elements?: Element[];
  immune?: Element[];
  absorb?: Element[];
  /** Ailments they can't get. */
  resists?: Ailment[];
  /** Party members (every hero but the first): how they fight on their own, and whether they're in the party from the start. */
  ai?: AllyStyle;
  startsInParty?: boolean;
  /** The level they join at (unset: the level of the hero you play when they join). */
  joinLevel?: number;
  /** Equipment they join with (item ids by slot): given to them, not taken from the bag. */
  gear?: Partial<Record<EquipSlot, string>>;
  /** Class they start in, and spells (id → rank) and Additions they know from the start. */
  cls?: string;
  spells?: Record<string, number>;
  additions?: string[];
}

/** Fighter: closes in with their weapon. Archer: keeps back and shoots. Caster: their spell shard. Healer: heals the hurt, else casts. */
export type AllyStyle = 'fighter' | 'archer' | 'caster' | 'healer';

export interface Database {
  title: string;
  /** The World layout (Map editor → World): where each map sits, place names, and the world map's fog. */
  world?: import('./worldLayout').WorldData;
  /** Kinds of world-map marker for events (Database → Map markers; default: Quest location, Landmark, Town, Danger). */
  markers?: import('./landmarks').MarkerKind[];
  /** Map themes (Database → Map themes). Unset: the starter themes. */
  mapThemes?: import('./mapThemes').MapTheme[];
  /** Named text colours for messages: [id]words[/id] (Database → Text colours). */
  textColors?: import('../ui/richText').TextColor[];
  /** Text box styles for messages (Database → Text boxes): Speech, Sign, Item received… and your own. */
  messageStyles?: import('../ui/richText').MessageStyle[];
  /** Achievements (Database → Achievements). */
  achievements?: import('../game/achievements').AchievementDef[];
  /** The developer console (the ` key): in playtests only (default), always, or never. */
  devConsole?: 'playtest' | 'always' | 'off';
  startMap: string;
  start: { x: number; z: number; dir?: Dir };
  startHour: number;
  /** The shared outdoor weather when a new game starts (outdoor maps without their own weather all share it). */
  weather?: { kind: WeatherKind; amount?: number };
  /** Dynamic weather and temperature (Database → Weather); anything left out uses the defaults (world/climate.ts). */
  climate?: Partial<Omit<import('./climate').ClimateConfig, 'seasons'>> & { seasons?: Partial<Record<import('./seasons').Season, Partial<import('./climate').SeasonClimate>>> };
  player: string;
  characters: Record<string, CharacterDef>;
  /** Which movement abilities the player starts with (all of them when omitted). Events can change them. */
  abilities?: Partial<Record<Ability, boolean>>;
  /** Player stats, speeds and stamina costs. Anything left out uses the defaults (see game/stats.ts). */
  stats?: PlayerConfigData;
  /** Saving rules (defaults: save from the menu anywhere, autosave on map change). */
  saving?: { anywhere?: boolean; autosave?: boolean };
  /** Title screen and pause menu wording (anything left out uses the defaults). */
  menus?: MenuConfig;
  /** Your own sections of the Credits screen (Database → Credits); sprite credits are added from the characters. */
  credits?: CreditEntry[];
  /** Combat tuning (Database → Combat); anything left out uses the defaults (see game/combat/config.ts). */
  combat?: CombatData;
  /** Sound (Database → Audio): imported files, effects swapped for files, title music. */
  audio?: { files?: string[]; sfx?: Record<string, string>; titleMusic?: string; /** After the victory fanfare (unset: the map's music). */ victoryMusic?: string; /** Every battle's music unless a map, zone, troop or Start battle command overrides it (unset: the built-in theme). */ battleMusic?: string };
  /** The skill tree (Database → Skills). Without it, the built-in tree is used. */
  skills?: SkillsData;
  /** Troops: groups of enemies for random encounters (encounter zones on maps). */
  troops?: TroopDef[];
  /** Learned spells, Additions and classes (built-in ones when left out). */
  spells?: SpellEntry[];
  additions?: AdditionDef[];
  classes?: ClassDef[];
  /** Enemy types (Database → Enemies), placed on maps as event pages. */
  enemies?: EnemyDef[];
  /** Items the game uses (see Database → Items). */
  items?: ItemDef[];
  /** The heroes: the first is the one you play (its look is `player`); more join the party later. */
  heroes?: HeroDef[];
  /** Weapon looks made in the weapon builder and imported (sheets in assets/weapons/custom/). */
  weaponSprites?: WeaponSpriteDef[];
  /** Bag size and what a new game starts with. */
  inventory?: InventorySetup;
  /** Quests (Database → Quests), started and advanced by events. */
  quests?: QuestDef[];
  /** The clock: game minutes per real minute (0 stops it; default 20) and how dark night gets (0 – 1, default 0.85). */
  time?: { rate?: number; darkness?: number; seasons?: import('./seasons').SeasonSettings };
}

export type ItemKind = 'consumable' | 'equipment' | 'key' | 'ammo' | 'material';
/** weapon: melee (key 1); ranged: a bow (key 2); magic: the spell shard cast with key 3. */
export type EquipSlot = 'weapon' | 'shield' | 'ranged' | 'magic' | 'armor' | 'accessory';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'shield', 'ranged', 'magic', 'armor', 'accessory'];
/** Older databases and saves: the Ring slot (rings are accessories now). */
export type OldEquipSlot = EquipSlot | 'ring' | 'light';

/** How rare a piece of equipment is: the colour its name is shown in (other items are plain white). */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary', mythic: 'Mythic' };
export const RARITY_COLORS: Record<Rarity, string> = { common: '#a9acb6', uncommon: '#5fd068', rare: '#4f9dff', legendary: '#b571ff', mythic: '#ff9a2e' };

/** A spell shard: equipped in the magic slot, it's the spell key 3 (or Y to switch to it) casts. */
export interface SpellDef {
  /**
   * A field spell instead of a bolt: Light (a light around the hero) or Water Walk (walk on water of any depth). The
   * magic button (or F) switches it on and off: `mp` is spent to switch it on, `mpPerSecond` drains while it's on.
   */
  power?: FieldPower;
  mpPerSecond?: number;
  /** Field spells: the colour the hero glows while it's on (default gold for Light, blue for Water Walk). */
  glow?: string;
  /** Damage of each bolt (0 for field spells), and the magic it costs (field spells: to switch on). */
  damage: number;
  mp: number;
  /** Tiles per second, and how far it flies (defaults: Database → Combat's spell values). */
  speed?: number;
  range?: number;
  /** The bolt's colour, its sparks, and the light it and the hero's hands give off. */
  color: string;
  /** The light in the hands while it's readied (intensity 0 – 3, radius in tiles; intensity 0 for none). */
  light?: { intensity?: number; radius?: number };
}

/** Melee weapon weight class: light (daggers, short swords), medium (longswords, rapiers), heavy (greatswords, great axes). */
export type WeaponClass = 'light' | 'medium' | 'heavy';
export const WEAPON_CLASSES: WeaponClass[] = ['light', 'medium', 'heavy'];

export interface WeaponDef {
  /** Melee class, or 'bow' for the ranged slot. */
  class: WeaponClass | 'bow';
  damage: number;
}

/** Field spells a spell shard can carry, switched on and off with the magic button (or F). */
export type FieldPower = 'light' | 'waterWalk';
export const FIELD_POWERS: FieldPower[] = ['light', 'waterWalk'];
/**
 * Older databases: powers rings used to carry. Light and Water walking are spell shards now (moved over when the
 * database loads); cutting is gone (swords cut vines).
 */
export type RingPower = FieldPower | 'cut';

export interface RingDef {
  power: RingPower;
  /** Magic spent each use (cut) or each time it's switched on (light, water walking). */
  mpCost?: number;
  /** Magic drained per second while it's on (light, water walking). */
  mpPerSecond?: number;
  /** The colour the hero glows while it's on (default by power: gold light, blue water, green cutting). */
  glow?: string;
}

/** The light a Light shard gives while it's on. */
export interface ItemLight {
  /** orb: a ball of light floating by the hero, lighting all around; flashlight: a beam where the hero faces; lantern: a glow all around; torch: a flickering flame. */
  type: 'orb' | 'flashlight' | 'lantern' | 'torch';
  color: string;
  intensity: number;
  /** Reach in tiles. */
  radius: number;
  /** Beam width in degrees (flashlight). */
  angle?: number;
  /** Casts shadows (looks great, costs speed). */
  shadows?: boolean;
  /** Flashlight: a soft lantern-like glow around the hero as well as the beam. */
  glow?: { intensity: number; radius: number };
}

export interface ItemDef {
  id: string;
  name: string;
  description?: string;
  kind: ItemKind;
  /**
   * "builtin:potion" (built-in icons), an image path like "assets/icons/feather.png", or "sprite": the icon cut from
   * its weapon sprite (so the bag, shop and back icons look like the weapon in the hand).
   */
  icon: string;
  /** What shops charge (they buy it back for half). 0 or missing: not sold in shops by default. */
  price?: number;
  /** How many fit in one bag slot (equipment always 1). */
  stack?: number;
  /** Consumables: what using it restores. */
  restore?: Partial<Record<Gauge, number>>;
  /** Restore amounts are percentages of the maximum. */
  restorePercent?: boolean;
  /** Changes how a stat grows each level: a consumable changes it for good (a Potion of Defense), gear while it's worn. */
  statRank?: { stat: 'str' | 'dex' | 'def' | 'mag' | 'mdf'; rank: import('../game/statRanks').Rank };
  /** Equipment: which slot it goes in. */
  slot?: EquipSlot;
  /** Equipment (weapons, armor, spell shards…): how rare it is (default common). Other items have none. */
  rarity?: Rarity;
  /** Fire fuel: game hours it adds to a fire (firewood, coal…). Feed fires by using them (action button). */
  fuel?: number;
  /** Weapons, bows, arrows and spell shards: ailments their hits can give. */
  inflicts?: Inflict[];
  /** Consumables: ailments they cure ('all': every one but Zombie, which must be listed itself). */
  cures?: (Ailment | 'all')[];
  /** Consumables: buffs they give. */
  buffs?: BuffGrant[];
  /** Equipment: ailments it keeps away while worn. */
  protects?: Ailment[];
  /** Weapons, bows, arrows and spell shards: the element they hit with (arrows override the bow's). */
  element?: Element;
  /** Spell shards (magic slot): the spell. Its icon is held in the hero's hands while it's readied. */
  spell?: SpellDef;
  /** Weapons: class and damage. */
  weapon?: WeaponDef;
  /**
   * Key items: a field use the player switches on and off from the bag, or with the B button once it's assigned
   * there: Light (a lantern's glow around the hero; set the light below) or Water Walk (walk on water of any depth).
   */
  tool?: FieldPower;
  /** Weapons: breaks rock (pickaxes, hammers): mineable boulders and ore veins. */
  mines?: boolean;
  /** A fishing rod: with one in the bag, Talk / interact facing a fishing spot casts. `power` (0 … 100) brings bites sooner and rarer fish. */
  rod?: { power?: number };
  /** A fish: its usual length in cm (each catch is a little bigger or smaller; Records keep the biggest). */
  fish?: { size: number };
  /**
   * Weapons, armor, shields and accessories: what it's made of, the ingot (item id) a forge upgrades it with
   * ('none': it can't be upgraded).
   */
  material?: string;
  /** Ores (and ingots that make better ones): smelted at a forge into `into`, `need` at a time (default 2). */
  smelt?: { into: string; need?: number };
  /** Set at a forge (the game fills this in): the element of the shard set in it, for its glow. */
  enchanted?: Element;
  /** Equipment: the heroes (ids) who can use it. Unset or empty: everyone. */
  users?: string[];
  /** Armor and other worn things: elements whose damage it halves (a fire shard set in it wards off fire). */
  wards?: Element[];
  /**
   * Weapons, bows and shields: the LPC sprite drawn on animated characters (an id from assets/weapons/weapons.json,
   * or a look made in the weapon builder, from Database.weaponSprites).
   */
  sprite?: string;
  /** Weapons and bows: a coloured glow around the weapon while it's in the hand. */
  glow?: WeaponGlow;
  /** Weapons: a coloured streak following each swing. */
  trail?: WeaponTrail;
  /** Armor and accessories: damage taken is reduced by defence / (defence + 50). */
  defense?: number;
  /** The same against spells. */
  magicDefense?: number;
  /** Equipment: stats it adds while worn (negative takes away: a heavy axe might cost Dexterity). */
  bonus?: Partial<Record<'str' | 'dex' | 'def' | 'mag' | 'mdf', number>>;
  /** Equipment: extra critical hit chance, in percent. */
  crit?: number;
  /** Arrows: extra damage, and whether the stack never runs out (the basic arrows). */
  ammo?: { damage: number; infinite?: boolean };
  /** Rings: the field power, and its magic cost. */
  ring?: RingDef;
  /** Light rings: the light they give. */
  light?: ItemLight;
}

export interface InventorySetup {
  /** Slots in each tab (pocket) of the bag (default 64: 8 × 8). */
  slots?: number;
  startGold?: number;
  startItems?: { item: string; count: number }[];
  startEquip?: Partial<Record<EquipSlot, string>>;
}

export type MapEnvironment = 'outdoor' | 'indoor' | 'dark';
/** Scenery outside the map: open grass, forest, meadow (bushes and flowers), rocky cliffs, water, or nothing. */
export type BorderKind = 'grass' | 'forest' | 'meadow' | 'plains' | 'rocks' | 'rocky' | 'desert' | 'snow' | 'snowforest' | 'water' | 'none' | 'seamless';
export interface MapBorder {
  /** Old maps: one kind for every side. */
  kind?: BorderKind;
  /** Per side: top (north), bottom (south), left (west), right (east). */
  n?: BorderKind; s?: BorderKind; w?: BorderKind; e?: BorderKind;
  seed: number;
}

export type TitleOption = 'continue' | 'newGame' | 'load' | 'options' | 'credits' | 'exit';
export type PauseOption = 'items' | 'equipment' | 'skills' | 'abilities' | 'journal' | 'log' | 'status' | 'quests' | 'settings' | 'saveLoad' | 'quitToTitle' | 'map' | 'achievements' | 'system';

export interface MenuConfig {
  /** Big text on the title screen (defaults to the game's title) and a line under it. */
  titleText?: string;
  subtitle?: string;
  /** Renamed title options, and ones to hide. */
  titleLabels?: Partial<Record<TitleOption, string>>;
  titleHidden?: Partial<Record<TitleOption, boolean>>;
  /** Renamed pause menu entries, and ones to hide. */
  pauseLabels?: Partial<Record<PauseOption, string>>;
  pauseHidden?: Partial<Record<PauseOption, boolean>>;
  /** Start playtests straight on the map instead of at the title screen. */
  skipTitleInPlaytest?: boolean;
  /**
   * Behind the title menu: a map (`map`, looking around `x`, `z`; unset map: the start map), or a picture or a
   * video (paths) with no map behind it. Unset: the start map.
   */
  titleBackground?: { kind: 'map' | 'image' | 'video'; map?: string; x?: number; z?: number; image?: string; video?: string };
  /** The game's lettering: "classic" Game Boy-style pixels (default), "soft" rounder pixels, or "smooth" (not pixel). */
  font?: 'classic' | 'soft' | 'smooth';
}

/** A gauge: health (hp), magic (mp) or stamina (sp). */
export type Gauge = 'hp' | 'mp' | 'sp';

export interface PlayerConfigData {
  /** Maximum (and starting) health, magic and stamina. */
  max?: Partial<Record<Gauge, number>>;
  /** Points regained per second. */
  regen?: Partial<Record<Gauge, number>>;
  /** Gauges that don't refill on their own (only events or items restore them). */
  noRegen?: Partial<Record<Gauge, boolean>>;
  /** Movement speeds in tiles per second. */
  speed?: Partial<Record<'walk' | 'run' | 'wade' | 'swim' | 'crawl' | 'climb', number>>;
  /** Stamina costs: per second for run, climb and swim; per jump for jump. */
  cost?: Partial<Record<'run' | 'climb' | 'swim' | 'jump', number>>;
  /** After running out, stamina must refill to this percentage before run, jump and climb work again. */
  recoverPercent?: number;
  /** Seconds after using stamina before it starts to refill. */
  regenDelay?: number;
  /** Health lost per second while swimming with no stamina left. */
  drownDamage?: number;
  /** Walking off ledges: collide, walk off any, or walk off except into cells of height `min` … `max` (steps). */
  ledges?: Partial<{ mode: 'collision' | 'walk' | 'limited'; min: number; max: number }>;
}

/* ------------------------------------------------------------------ combat */

export type EnemyBehaviour = 'melee' | 'ranged' | 'charger';

export interface EnemyDef {
  id: string;
  name: string;
  /** What the Journal's Bestiary says about it. */
  description?: string;
  /** Left out of the Bestiary (a story-only foe, a training dummy). */
  noBestiary?: boolean;
  /** Recolour its picture (RPG Maker style): hue turned this many degrees, saturation ×, and a colour mixed in. */
  tint?: { hue?: number; sat?: number; color?: string; amount?: number };
  /** Turn-based battles: raise (+) or lower (−) its picture, in tiles, when its art floats or sinks. */
  battleOffset?: number;
  /**
   * How it looks: a character from the database (a sheet, like the player's), a flat image (one picture, brought to
   * life with generic motion: breathing, sliding, hopping or flying), or a built-in monster sheet.
   */
  look: { character?: string; monster?: string; image?: string; flat?: FlatLook };
  hp: number;
  /** Damage of its attack, and its defence (reduces damage like the player's armor). */
  damage: number;
  /** Turn-based battles: each one's health is rolled this many percent either side of `hp` (0: always the same). */
  hpVariance?: number;
  /** How much each of its hits varies, percent either side (default 10). */
  damageVariance?: number;
  defense?: number;
  /** Defence against spells (default: the same as its defence). */
  magicDefense?: number;
  /** Its attack is a spell (the hero's Magic Defence counts, not Defence; ranged casters throw firebolts). */
  attackType?: 'physical' | 'magic';
  /**
   * Light: "avoid" keeps away from a hero lit by a fire or a light ring (creatures of the dark); "drawn" spots a lit-up
   * hero much sooner (bandits). Missing: light makes no difference beyond being easier to see.
   */
  light?: 'avoid' | 'drawn';
  /** Up to two elements (hits are weighed against both), and elements it's immune to or absorbs (heals from). */
  elements?: Element[];
  immune?: Element[];
  absorb?: Element[];
  /** The element its attacks hit with (default: its first element). */
  attackElement?: Element;
  /** Ailments its hits can give, ailments it can't get, and undead (always a zombie: healing hurts it). */
  inflicts?: Inflict[];
  resists?: Ailment[];
  undead?: boolean;
  /** Tiles per second. */
  speed: number;
  behaviour: EnemyBehaviour;
  /** How close it gets before attacking (ranged: the distance it shoots from). */
  attackRange: number;
  /** Seconds between attacks, and the wind-up before each one (the tell the player reacts to). */
  cooldown: number;
  windup: number;
  /** Sight range in tiles (in full light; darkness and sneaking shorten it), field of view in degrees, and hearing range. */
  sight: number;
  fov: number;
  hearing: number;
  xp: number;
  gold?: [number, number];
  drops?: { item: string; chance: number; count?: number }[];
  /** The built-in icon it holds while attacking ("sword", "bow", "axe"…; '' for nothing). People default to a sword (archers a bow). */
  weapon?: string;
  /** Animated (LPC) people: the weapon and shield sprites they carry instead of the icon ('' for none). */
  weaponSprite?: string;
  shieldSprite?: string;
  /** Bosses: can't be killed outright by a sneak attack (for later perks). */
  boss?: boolean;
  /** Sprite size (1 = normal). */
  scale?: number;
  /** Turn-based battles: how quickly its turns come round (like the heroes' Dexterity; default from its speed). */
  agility?: number;
  /** Turn-based battles: what else it can do on its turn, and how often it uses its plain attack (default 1; 0: never). */
  actions?: EnemyAction[];
  attackWeight?: number;
  /** Its plain attack breaks a spell being charged (turn-based). */
  counterspell?: boolean;
}

/**
 * Something an enemy can do on its turn in a turn-based battle, besides its plain attack.
 * attack: a hit (its damage × power); spell: a magic hit (its damage × power, Magic Defence counts);
 * heal: health back for itself or a hurt friend (power % of their health); guard: half damage, a little health back
 * and no ailments until its next turn.
 */
export interface EnemyAction {
  name: string;
  kind: 'attack' | 'spell' | 'heal' | 'guard';
  /** Attacks and spells: × its damage (default 1). Heals: % of the target's health (default 30). */
  power?: number;
  element?: Element;
  inflicts?: Inflict[];
  /** One of the party, or all of them. */
  targets?: 'one' | 'all';
  /** How often it's chosen, against the others (default 1). */
  weight?: number;
  /** Only when its own health is below this % (e.g. a heal at 40). */
  hpBelow?: number;
  /** Breaks a spell being charged. */
  counterspell?: boolean;
}

/** A kind of water on a map: how it looks and flows, and what standing in it does. */
export interface WaterStyle {
  name: string;
  /** Its colour (deep water shows it fullest). */
  color: string;
  /** 0 crystal clear … 1 muddy (default 0.5). */
  murk?: number;
  /** Surface: 0 glassy … 2 rough (default 1). */
  bumpy?: number;
  /** Current (tiles per second, 0 still) and the way it flows (degrees, 0 = east, 90 = south). */
  flow?: number;
  flowDir?: number;
  /** Glows by itself (lava, poison goo): 0 … 1. */
  glow?: number;
  /** A mark drawn on its water in the map editor only (~, -, ≈…), to tell styles of the same colour apart. */
  symbol?: string;
  /** Being in it gives this ailment (a % chance every half second): poison goo poisons, lava burns. */
  ailment?: Ailment;
  chance?: number;
}

/** A flat-image enemy: how it moves and which way the picture faces. */
export interface FlatLook {
  /** slide: glides with a little sway; hop: bounces along; fly: hovers above the ground and bobs. Default slide. */
  move?: 'slide' | 'hop' | 'fly';
  /** The way the picture faces: it's mirrored to face the other way. 'none' never mirrors. Default right. */
  faces?: 'left' | 'right' | 'none';
  /** Height in tiles (before Size); the width follows the picture. Default 1. */
  height?: number;
  /** Breathes (swells gently) while standing. Default on. */
  breathe?: boolean;
}

/** Combat tuning, all optional (see game/combat/config.ts for the defaults). */
/** Which battle system the game uses: action combat on the map, or turn-based battles (FFX / classic JRPG style). */
export type BattleMode = 'action' | 'turnBased';
/** Turn-based battles: who acts next. ctb: FFX-style (fast fighters act more often; actions have weight); rounds: everyone once a round, fastest first. */
export type TurnOrder = 'ctb' | 'rounds';

/** Database → Combat → Battle system: turn-based settings (only what differs from the defaults is kept). */
export interface TurnBasedData {
  order?: TurnOrder;
  /** Chance to run away (%) when both sides are equally fast; each point of Dexterity / Agility between them moves it 2%. */
  flee?: number;
  /** Enemies this many tiles from the one that started the fight join it (up to `maxEnemies`). */
  joinRadius?: number;
  maxEnemies?: number;
  /** Damage multipliers: the party's hits and the enemies' hits (enemies attack only on their turns, so they hit harder). */
  partyDamage?: number;
  enemyDamage?: number;
  /** Seconds after a battle (won or fled) before another can start. */
  grace?: number;
  /** Guarding gives back this % of the guard's health (default 10). */
  guardHeal?: number;
  /** Additions: one set per hero in the menu (Legend of Dragoon), or chosen from a list each Attack. */
  additions?: 'set' | 'choose';
  /** Additions' timing: pressed by the player, or automatic (every strike lands; for accessibility). */
  additionTiming?: 'press' | 'auto';
  /** The battle screen's look: 'dragon' (default; Legend of Dragoon-like) or 'fantasy' (Final Fantasy-like). */
  layout?: 'dragon' | 'fantasy';
  /** The hero always fights: can't be swapped onto the bench (default: anyone can). */
  heroLocked?: boolean;
  /** Party members follow the hero on the map (default on). Off: only the hero walks the map. */
  partyFollows?: boolean;
}

export interface CombatData {
  /** Battle system (default action). */
  mode?: BattleMode;
  /** The Journal's Bestiary: defeats needed before an enemy's numbers, elements and drops show. */
  bestiary?: Partial<{ stats: number; elements: number; drops: number }>;
  turnBased?: TurnBasedData;
  /** Forges: how many times one item can be upgraded, and the percent of damage or defence each upgrade adds. */
  forge?: { maxLevel?: number; percent?: number; enchantPercent?: number };
  unarmedDamage?: number;
  /** Per melee class: swings per second multiplier, reach in tiles, damage multiplier. */
  classes?: Partial<Record<WeaponClass, { speed?: number; reach?: number; damage?: number }>>;
  bow?: { drawTime?: number; arrowSpeed?: number; lockRange?: number };
  lockRange?: number;
  dodge?: { cost?: number; distance?: number; time?: number };
  block?: { cost?: number; reduction?: number; parry?: number };
  /** kindle: seconds a fire attack keeps an out-of-fuel fire (a torch, a campfire) lit. */
  fire?: { mp?: number; damage?: number; speed?: number; range?: number; kindle?: number };
  /** Damage multiplier for hitting an unaware enemy. */
  sneakMultiplier?: number;
  campSafe?: number;
  /** Seconds the player can't be hurt again after a hit. */
  hurtGrace?: number;
  /** Experience to reach level 2, and how much more each level after needs (1.3 = 30% more). */
  xpBase?: number;
  xpGrowth?: number;
  /** Highest level the player can reach (default 50). */
  maxLevel?: number;
  /**
   * Hand-set EXP table (Database → Player → EXP progression): entry i is the EXP needed to go from level i + 1 to
   * level i + 2. Levels it doesn't cover follow the curve above. Without it the whole table follows the curve.
   */
  expTable?: number[];
  /** Skill points per level up, and to start a new game with. */
  pointsPerLevel?: number;
  /** Stat points per level up (default 2), spent on the Status screen. */
  statPointsPerLevel?: number;
  startPoints?: number;
}

/* ------------------------------------------------------------------ skills */

/** What a skill changes. Percentages add up across ranks and skills; flags are on at 1. */
export type SkillStat =
  | 'maxHp' | 'maxMp' | 'maxSp'
  | 'meleeDamage' | 'swingSpeed' | 'lightDamage' | 'mediumDamage' | 'heavyDamage' | 'lightSpeed' | 'mediumSpeed' | 'heavySpeed'
  | 'bowDamage' | 'drawSpeed' | 'bowRange'
  | 'sneakHide' | 'quietSteps' | 'sneakDamage' | 'silentShot' | 'assassinate'
  | 'blockStamina' | 'spellFire'
  | 'spellDamage' | 'spellCost' | 'spellRange' | 'lightReach' | 'proficientMedium' | 'proficientHeavy'
  | 'str' | 'dex' | 'def' | 'mag' | 'mdf' | 'crit';

export interface SkillTreeDef { id: string; name: string; color?: string }

export interface SkillNode {
  id: string;
  /** Which tree (tab) it's in. */
  tree: string;
  name: string;
  description?: string;
  /** Position in the tree's grid: column (x) and row (y, 0 at the bottom, growing upwards like Skyrim's constellations). */
  x: number; y: number;
  /** Needs at least one rank in each of these first. */
  parents?: string[];
  /** How many times it can be taken (default 1). */
  ranks?: number;
  /** Skill points per rank (default 1). */
  cost?: number;
  /** Level needed (optional). */
  level?: number;
  /** What each rank adds. */
  effects: { stat: SkillStat; value: number }[];
  /** Older databases: a spell shard (item id) the skill gave. Shards are items now (moved to spell perks on load). */
  teaches?: string;
  /** Teaches a spell (Database → Spells): rank r of this skill gives the spell's rank r + spellRankFrom − 1. */
  teachesSpell?: string;
  spellRankFrom?: number;
  /** Teaches an Addition (Database → Additions). */
  teachesAddition?: string;
}

/* ------------------------------------------------------------------ learned spells, Additions, classes */

/** A spell heroes learn (Database → Spells), from skill-tree skills, events and trainers. */
export interface SpellEntry {
  id: string;
  name: string;
  description?: string;
  /** bolt: a magic hit (in action mode, the bolt the magic button throws); heal: health back for the party. */
  kind: 'bolt' | 'heal';
  /** Rank 1's damage (bolts) or health given back (heals), before the caster's Magic. */
  power: number;
  /** Rank 1's magic cost. */
  mp: number;
  element?: Element;
  inflicts?: Inflict[];
  /** One target or all of them (turn-based). */
  targets?: 'one' | 'all';
  color?: string;
  /** Highest rank (default 1). Each rank above the first: +rankPower % power, +rankMp % magic, one more turn to charge. */
  maxRank?: number;
  rankPower?: number;
  rankMp?: number;
  /** Turns rank 1 takes to charge (default 0: cast at once). */
  charge?: number;
  /** Turn-based: the caster's call-out as it goes off ("Fire!"), and a chant while it charges (sound sources). */
  sound?: string;
  chant?: string;
  /** Action mode: bolt speed and range in tiles (0 / unset: Database → Combat's spell values). */
  speed?: number;
  range?: number;
}

export type FaceButton = 'A' | 'B' | 'X' | 'Y';

/** One strike of an Addition: its damage and the button to press as the ring closes. */
export interface AdditionStrike {
  /** × the hero's attack. */
  power: number;
  /** The button to press ('any': any of them). Default A. */
  button?: FaceButton | 'any';
  /** Seconds the ring takes to close (default 0.7), and the timing window in seconds (default 0.24). */
  time?: number;
  window?: number;
}

/** A Legend of Dragoon-style Addition: a string of timed strikes, stronger as it's mastered by use. */
export interface AdditionDef {
  id: string;
  name: string;
  description?: string;
  strikes: AdditionStrike[];
  /** Highest rank (default 5), and completions needed for each rank (default 6; rank n needs n × this in all). */
  maxRank?: number;
  usesPerRank?: number;
  /** Each rank above the first: +rankDamage % damage (default 12), +rankWindow % wider timing (default 6). */
  rankDamage?: number;
  rankWindow?: number;
  /** The hero's call-out when the whole string lands ("Quick slash!"): a sound source. */
  sound?: string;
}

/** A class: the skill trees its members learn from. Changing class keeps everything already learned. */
export interface ClassDef {
  id: string;
  name: string;
  description?: string;
  /** Skill tree ids (Database → Skills). */
  trees: string[];
  color?: string;
}

/** What a hero has learned and chosen: spell ranks, Additions (with how often each was completed), class. */
export interface AbilityData {
  spells?: Record<string, number>;
  additions?: Record<string, number>;
  /** The Addition used by Attack (turn-based, "set per character"). */
  addition?: string;
  /** The learned bolt readied for the magic button in action mode (and its rank). */
  fieldSpell?: string;
  fieldRank?: number;
  /** Their class, and every class they can change to (held before or unlocked). */
  cls?: string;
  classes?: string[];
}

export interface SkillsData { trees: SkillTreeDef[]; nodes: SkillNode[] }

/** A fishing spot's catch table: the fish (and junk) it gives and how often. */
export interface FishZone {
  name: string;
  /** Shown on the map editor's fishing overlay. */
  color?: string;
  fish: FishCatch[];
}
/** One thing a spot can give: its weight against the others (a chance), and when it bites. */
export interface FishCatch {
  item: string;
  /** Weight against the others in the table (they needn't add up to 100). */
  chance: number;
  /** Only by day or only at night (default: any time). */
  time?: 'day' | 'night';
  /** Rare: a better rod makes it more likely. */
  rare?: boolean;
}
