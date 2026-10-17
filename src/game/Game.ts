/**
 * The game: loads data, builds the scene, and runs the frame loop.
 * Systems are kept in their own modules; this file wires them together.
 */
import * as THREE from 'three';
import { tileCursor } from '../art/placeholderArt';
import { clamp } from '../core/math';
import { GameEvent } from '../events/GameEvent';
import { EventContext, Interpreter } from '../events/Interpreter';
import { PostFX } from '../render/PostFX';
import { SpriteLibrary, setSpriteGlow, unregisterGlow, withSpriteShadows } from '../render/sprites';
import { itemWeaponSprite, usedWeaponSprites } from './combat/weaponSprites';
import { fadeBuildings } from '../world/buildings';
import { makeTexture, setMaxAnisotropy, setNormalMapsEnabled, unregisterNormalMap } from '../render/textures';
import { DebugPanel } from '../ui/DebugPanel';
import { MessageWindow, setTextSpeed } from '../ui/MessageWindow';
import { setTextColors } from '../ui/richText';
import { Fireflies } from '../world/Fireflies';
import { Weather } from '../render/Weather';
import { Atmosphere } from '../render/Atmosphere';
import { SSAO, tagAOMeshes } from '../render/ssao';
import { propBase } from '../world/wallAnchor';
import { updateWind, wind } from '../render/wind';
import { setClouds } from '../render/areaTint';
import { Ripples } from '../render/Ripples';
import type { WaterFlow } from '../world/WorldBuilder';
import { waterStyle } from '../world/waterStyles';
import { SEASON_NAMES, type Season, realSeason, seasonOn } from '../world/seasons';
import { setSeason } from '../render/season';
import { biteDelay, biteWindow, catchSize, fishingGrid, pickCatch } from '../world/fishing';
import { Lights, scheduleFactor } from '../world/Lights';
import { PropCatalog, migrateMap } from '../world/props';
import { TileCatalog } from '../world/tiles';
import { type TileTexture, loadTileTextures, setTileAnisotropy } from '../render/tileTextures';
import type { AssetRegistry } from '../world/types';
import { TileMap } from '../world/TileMap';
import { TimeOfDay, wrapHour } from '../world/TimeOfDay';
import { type BuiltWorld, buildWorld, hideProp } from '../world/WorldBuilder';
import { Rings } from './rings';
import { Bursts } from '../render/Bursts';
import { Combat, type CombatHost } from './combat/Combat';
import { type CombatConfig, MAX_FOES, Progression, SWING_TIME, combatFromDb, xpToNext } from './combat/config';
import type { Enemy } from './combat/Enemy';
import { BattleStage, type StageFighterSpec } from './battle/BattleStage';
import { FlatSprite } from './FlatSprite';
import type { CarriedWeapon } from './CharacterSprite';
import { enemyWeaponSprites } from './combat/weaponSprites';
import { TRANSITIONS, type TransitionKind, playTransition } from '../ui/BattleTransition';
import { CombatOverlay } from '../ui/CombatOverlay';
import { BattleScreen, type FighterView, type VictoryHero, type VictoryLoot, type VictoryReport } from '../ui/BattleScreen';
import { pickTroop, zoneAt } from '../world/zones';
import { type BattleEntry, type BattleHost, TurnBattle } from './battle/TurnBattle';
import { type BattleAddition, type BattleSpell, type Battler, type Opening, enemyAgility, weighted } from './battle/rules';
import { type BattleAilment, BattleStatus, turnsFromSeconds } from './battle/status';
import { HEAL_MP } from './party';
import {
  additionBonus, additionList, additionRank, additionToNext, changeClass, classList, findAddition, findClass, findSpell, heroTrees, learnAddition,
  learnSpell, masterAddition, mergeStarting, rankName, spellAtRank, spellList, spellMaxRank, teachFromSkills, unlockClass,
} from './abilities';
import type { AbilityData, Command, EventData } from '../world/types';
import { WEATHER_KINDS } from '../world/types';
import { MONSTERS } from '../art/placeholderArt';
import { enemyElement } from './combat/Combat';
import { AudioManager, type Sfx, setUiSound, uiSound } from '../audio/sfx';
import { Skills, skillsData } from './skills';
import { playerConfig } from './stats';
import { SkillTreeScreen } from '../ui/SkillTreeScreen';
import { ControlsScreen } from '../ui/ControlsScreen';
import { CreditsScreen } from '../ui/CreditsScreen';
import { AdventureLog, AdventureLogScreen } from '../ui/AdventureLog';
import { Pickups } from './Pickups';
import { QuestBook, type QuestNews } from './quests';
import { QuestLogScreen, QuestTracker, rewardText } from '../ui/QuestLog';
import { creditSections } from './credits';
import { HudArranger } from '../ui/HudArranger';
import type { PropDef, SkillNode } from '../world/types';
import { EQUIP_SLOTS, type AllyStyle, type Ailment, type Database, type Dir, type EquipSlot, type HeroDef, type ItemDef, type MapData, type PropData, type PauseOption, type TitleOption, type WeatherKind } from '../world/types';
import { loadAssets, loadDatabase, loadMap } from '../shared/dataFiles';
import { loadCanvas } from '../shared/images';
import { builtinIcon, builtinIconName } from '../art/itemIcons';
import { DEFAULT_BAG_SLOTS, Inventory, QUICK_SLOTS, alwaysFits } from './inventory';
import { forgeRules, forgedDef, settableShard, upgradable, enchantable, upgradeCost } from './forge';
import { ACTIVE_MEMBERS, Ally, MAX_PARTY, PartyState, STYLE_NAMES, fightingStyle, memberGainXp, spendMember, type AllyHost, type AllyNumbers, type MemberData } from './party';
import { POWER_NAMES, itemColor, migrateItems, rarityOf } from '../world/items';
import { ATTRS, ATTR_INFO, type Attrs, type HeroTotals, heroTotals, powerMultiplier, speedMultiplier } from './attributes';
import { BUFF_INFO, effectColor, effectName, type EffectId } from './status';
import { STATUS_WORD } from './combat/Combat';
import type { CharacterDef, EnemyDef } from '../world/types';
import { statusIconUrl } from '../art/statusIcons';
import { elementIconUrl } from '../art/elementIcons';
import { creation, heroBase, mainHero } from '../world/heroes';
import { CreationScreen } from '../ui/CreationScreen';
import { StatusScreen } from '../ui/StatusScreen';
import { SaveScreen } from '../ui/SaveScreen';
import { type EquipChoice, type EquipHost, EquipScreen, type EquipSlotId } from '../ui/EquipScreen';
import { InventoryScreen, type BagFilter, type InventoryActions } from '../ui/InventoryScreen';
import { RecordsScreen, type RecordSection } from '../ui/RecordsScreen';
import { BestiaryScreen, type BestiaryEntry } from '../ui/BestiaryScreen';
import { ELEMENT_LIST, ELEMENT_NAMES, elementResult } from './elements';
import type { Element as Elem } from '../world/types';
import { PartyScreen, type PartyAction, type PartyMemberView } from '../ui/PartyScreen';
import { PauseShell } from '../ui/PauseShell';
import { WorldMapScreen, type WorldMapMarker, type WorldMapPiece } from '../ui/WorldMapScreen';
import { drawMarker, markerKinds } from '../world/landmarks';
import { BubbleLayer } from '../ui/BubbleLayer';
import { AchievementsScreen, type AchievementView } from '../ui/AchievementsScreen';
import { AchievementToast } from '../ui/AchievementToast';
import { DevConsole, type ConsoleCommand } from '../ui/DevConsole';
import { AchievementBook, platformUnlock, progress as achProgress, type AchievementWorld } from './achievements';
import { Explored, type Neighbour, neighbourAt, neighbours, seamlessSides } from '../world/worldLayout';
import { averageColor, builtinTileColor, drawMapArt, propMark } from '../render/worldMapArt';
import { CharacterScreen } from '../ui/CharacterScreen';
import type { TabGroup } from '../ui/tabs';
import { ShopScreen, shopGoods } from '../ui/ShopScreen';
import { waitForPlaytest } from '../shared/playtest';
import { CharacterSprite, DIR_VECTOR } from './CharacterSprite';
import { eventCovers } from '../world/eventArea';
import { GameState } from './GameState';
import { type Action, BINDINGS_VERSION, DEFAULT_BINDINGS, Input } from './Input';
import { PlayerMotion } from './PlayerMotion';
import { PlayerStats, configFromDb } from './stats';
import { StatusBars, type HudWidget } from '../ui/StatusBars';
import { GameMenu, type MenuItem, slotLabel } from '../ui/GameMenu';
import { PAUSE_ICONS, PAUSE_OPTIONS, SYSTEM_OPTIONS, pauseLabel, titleLabel } from './menus';
import { DEFAULT_SETTINGS, type Settings, SettingsStore, TEXT_SPEEDS, exportSettings, importSettings, loadProjectSettings } from './settings';
import { type SaveData, type SavePoint, SAVE_VERSION, SaveStore, type SlotId, formatPlayTime } from './saves';
import { alignFootProps, blockedTiles, footTiles, propCovers } from '../world/props';
import { propKey } from './GameState';
import { TouchControls } from '../ui/TouchControls';

const CAMERA_OFFSET = new THREE.Vector3(0, 10.5, 11.5);

/** The Inventory's tabs: the bag (all items, then by kind), then Equipment. */
const INVENTORY_TABS: { id: BagFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'consumable', label: 'Consumables' }, { id: 'gear', label: 'Gear' }, { id: 'shard', label: 'Shards' }, { id: 'material', label: 'Materials' },
  { id: 'key', label: 'Key items' },
];
/** The key the shared outdoor weather is kept under (events' changes, in the save). */
const WORLD_WEATHER = '@world';
/** The Journal's tabs. */
const JOURNAL_TABS: ['quests' | 'log' | 'bestiary' | 'records', string][] = [['quests', 'Quests'], ['log', 'Adventure Log'], ['bestiary', 'Bestiary'], ['records', 'Records']];
const INTERACT_RANGE = 1.3;

type Start = { x: number; z: number; dir?: Dir };

/** A neighbouring map drawn beside this one (a Seamless side), ready to walk into. */
interface Preview { name: string; n: Neighbour; group: THREE.Group; map: TileMap; built: BuiltWorld; data: MapData; origin: THREE.Vector2 }

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
  private readonly fog = new THREE.Fog(0x000000, 22, 50);
  private readonly post: PostFX;
  private readonly input = new Input();
  private sprites!: SpriteLibrary;
  private tiles!: TileCatalog;
  private tileTextures = new Map<string, TileTexture>();
  private readonly state = new GameState();
  private readonly clock = new THREE.Clock();
  private readonly small: boolean;

  private map!: TileMap;
  private db!: Database;
  private time!: TimeOfDay;
  private lights!: Lights;
  private fireflies!: Fireflies;
  private waterNormals!: THREE.Texture;
  private waterFlows: WaterFlow[] = [];
  private ripples!: Ripples;
  private readonly ripAt = new Map<object, { x: number; z: number }>();
  /** This map's props standing in water (for their ripples). */
  private wetProps: { prop: PropData; y: number; size: number; color: number }[] = [];
  /** Ripples on lava and goo glow in their colour; on water they're white. */
  private rippleColor(style: number): number {
    const st = waterStyle(this.mapData, style);
    return (st.glow ?? 0) > 0.2 ? new THREE.Color(st.color).lerp(new THREE.Color('#ffffff'), 0.45).getHex() : 0xffffff;
  }
  private findWetProps(): void {
    this.wetProps = [];
    for (const prop of this.mapData.props) {
      const d = this.sprites.def(prop.type);
      if (!d || d.wall || d.h < 0.25) continue;
      const w = this.map.waterAt(Math.floor(prop.x), Math.floor(prop.z - 0.01));
      if (!w) continue;
      this.wetProps.push({ prop, y: w.surface, size: Math.max(0.7, Math.min(2.4, d.w * (prop.s ?? 1) * 0.9)), color: this.rippleColor(w.style) });
    }
  }
  private readonly waterFlow = new THREE.Vector2();
  private player!: CharacterSprite;
  private motion!: PlayerMotion;
  private stats!: PlayerStats;
  private hud!: StatusBars;
  /** Where the player comes back after losing all health. */
  private dying = 0;
  /** Objects of the current map (removed as a whole on a transfer). */
  private level: THREE.Group | null = null;
  private mapName = '';
  /** Maps handed over by the editor in a playtest. */
  private handedMaps: Record<string, MapData> | null = null;
  private transfer: { name: string; to: Start; fade: 'black' | 'white' | 'none'; phase: 'out' | 'load' | 'busy'; before?: () => void; after?: () => void; autosave?: boolean; fresh?: boolean; slow?: boolean } | null = null;
  private menu!: GameMenu;
  private saves!: SaveStore;
  private playTime = 0;
  /** The last respawn point used (a campfire, say); null until one is used. */
  private respawnPoint: SavePoint | null = null;
  private settingsStore!: SettingsStore;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  /** The title screen is showing. */
  private onTitle = false;
  private mapData!: MapData;
  private inventory!: Inventory;
  private bag!: InventoryScreen;
  private shop!: ShopScreen;
  private readonly items = new Map<string, ItemDef>();
  private readonly icons = new Map<string, string>();
  private readonly iconCanvases = new Map<string, HTMLCanvasElement>();
  /** Water walking has reached water since it was switched on (stepping back onto land then ends it). */
  private tideOnWater = false;
  /** The worn magic ring and its power (light, water walking, cutting). */
  private rings!: Rings;
  /** Where each prop on this map is drawn, for cutting them down. */
  private propSlots: BuiltWorld['props'] = new Map();
  /** Buildings on this map, faded while they hide the hero. */
  private buildings: BuiltWorld['buildings'] = [];
  /** Props cut on this visit that grow back (forgotten when the player leaves the map). */
  private readonly cutThisVisit = new Set<string>();
  private readonly bursts = new Bursts();
  private readonly combat = new Combat();
  private overlay!: CombatOverlay;
  /** Turn-based battles (Database → Combat → Battle system: Turn-based). */
  private battleScreen!: BattleScreen;
  private battle!: TurnBattle;
  /** Frames since the battle screen opened (the world behind stops being redrawn after a few). */
  private battleFrames = 0;
  /** A battle on a battle map: its 3D stage (its own scene), the map's lights and water, and the field's lighting to go back to. */
  private stage: { stage: BattleStage; lights: Lights; built: BuiltWorld; env: TimeOfDay['environment']; map: TileMap; look: THREE.Vector3 } | null = null;
  /** Battle maps loaded so far (by file name). */
  private readonly battleMaps = new Map<string, MapData>();
  /** A battle map is loading for a battle about to start. */
  private battlePending = false;
  private hemi!: THREE.HemisphereLight;
  /** Where a project file is (in a playtest, the editor's copy). */
  private resolveFile: (path: string) => string = (p) => p;
  /** Battle sound taking over from the map's: a tune (the victory theme), or silence while fading in or out. */
  private battleSound: { music: string; hush?: boolean; fade: number; next?: { at: number; music: string } } | null = null;
  /** Leaving a battle: once the screen is dark, `done` closes it and the field fades back in. */
  private outro: { done: () => void } | null = null;
  /** Seconds before another battle can start (just won or ran from one). */
  private battleGrace = 0;
  /** Random encounters: tiles walked since the last battle, and how far until the next. */
  private encounterWalked = 0;
  private encounterAt = 0;
  private encounterFrom: { x: number; z: number } | null = null;
  /** Page commands of enemies beaten in a battle, run once its screen closes. */
  private battleCommands: GameEvent[] = [];
  private combatCfg!: CombatConfig;
  /** The hero's level, experience and skill points. */
  private progress!: Progression;
  private skills!: Skills;
  private skillScreen!: SkillTreeScreen;
  private statusScreen!: StatusScreen;
  private saveScreen!: SaveScreen;
  private creation!: CreationScreen;
  private equipScreen!: EquipScreen;
  private partyScreen!: PartyScreen;
  private pauseShell!: PauseShell;
  /** Where the hero stands in the lineup: 0 first; past the first three, on the bench. */
  private heroAt = 0;
  private worldMap!: WorldMapScreen;
  private bubbles!: BubbleLayer;
  private achScreen!: AchievementsScreen;
  private achToast!: AchievementToast;
  private achBook!: AchievementBook;
  private devConsole!: DevConsole;
  /** Started from the editor's ▶ Playtest. */
  private isPlaytest = false;
  /** Maps the hero has been to, and the ground seen in each (the world map's fog; kept in saves). */
  private visited = new Set<string>();
  private explored = new Map<string, Explored>();
  /** The console's cheats (not saved; using one marks the game as cheated). */
  private readonly cheats = { deathless: false, deathlessParty: false, infiniteGold: false, ghost: false, speed: 1 };
  private charScreen!: CharacterScreen;
  private controls!: ControlsScreen;
  private creditsScreen!: CreditsScreen;
  /** The adventure log (feed on screen, history in the pause menu). */
  private log!: AdventureLog;
  private logScreen!: AdventureLogScreen;
  private recordsScreen!: RecordsScreen;
  private bestiaryScreen!: BestiaryScreen;
  /** How long the player has pushed into a touch event they can't walk onto. */
  private bumpT = 0;
  /** Party members (saved) and their figures on this map, and the hero's trail they follow. */
  private readonly party = new PartyState();
  private allies: Ally[] = [];
  private trail: { x: number; z: number }[] = [];
  private quests!: QuestBook;
  private questScreen!: QuestLogScreen;
  private tracker!: QuestTracker;
  /** A "Quest" command marked quiet: no banner. */
  private questQuiet = false;
  /** EXP orbs, gold and items lying where enemies fell. */
  private pickups: Pickups | null = null;
  /** EXP absorbed in the last moment (one "+N EXP" for a burst of orbs), and time since the last orb. */
  private xpBurst = 0;
  private xpBurstT = 0;
  /** Gold picked up in the same burst, logged as one line. */
  private goldBurst = 0;
  private arranger!: HudArranger;
  private audio!: AudioManager;
  /** Music an event chose, until the next map change (undefined: the map's own). */
  private musicOverride: string | undefined;
  private ambienceOverride: string | undefined;
  /** Seconds since an enemy was last hunting the hero (for battle music). */
  private calmFor = 99;
  private wasSwimming = false;
  private touch!: TouchControls;
  /** Crouch amount for crawling (0 standing … 1 crawling), eased. */
  private crouch = 0;
  private blockedFor = 0;
  /** After respawning: fade in once the new map is ready. */
  private transferFadeIn = false;
  /** A white transfer finished: switch the fade colour back to black once its fade-in is done. */
  private fadeColorReset = false;
  private events: GameEvent[] = [];
  private interpreter!: Interpreter;
  private message!: MessageWindow;
  private debug!: DebugPanel;
  private sun!: THREE.DirectionalLight;
  private cursor!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private elapsed = 0;
  private readonly camTarget = new THREE.Vector3();
  private readonly weather = new Weather();
  private readonly atmosphere = new Atmosphere();
  private readonly ssao: SSAO;
  private readonly bufferSize = new THREE.Vector2();
  private readonly sunUp = new THREE.Vector3();
  /** Set on entering a map: the weather starts (in full) once the camera is in place. */
  private weatherPending = false;
  private moveTarget: { x: number; z: number } | null = null;
  private pendingEvent: GameEvent | null = null;
  private lastTile = { x: -1, z: -1 };
  private fade = { from: 0, to: 0, t: 1, duration: 1 };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly ui: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    setTileAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.small = Math.min(innerWidth, innerHeight) < 640 || /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.post = new PostFX(this.renderer);
    this.ssao = new SSAO(this.renderer);
    this.scene.fog = this.fog;
    this.scene.background = this.fog.color;
  }

  async start(): Promise<void> {
    // ?playtest  → the map the editor is working on (saved or not)
    // ?map=name  → a specific map file; otherwise the database's start map
    const params = new URLSearchParams(location.search);
    const pt = params.has('playtest') ? await waitForPlaytest(params.get('playtest') || null) : null;
    if (params.has('playtest') && !pt) throw new Error('No playtest data found. Start the playtest from the editor’s ▶ Playtest button.');
    let mapName: string;
    let mapData: MapData;
    let start: Start | null;
    let resolve = (path: string) => path;
    let assets: AssetRegistry;
    if (pt) {
      this.db = pt.db;
      mapName = pt.mapName;
      mapData = pt.map;
      start = pt.start ?? null;
      assets = pt.assets;
      this.handedMaps = { ...(pt.maps ?? {}), [pt.mapName]: pt.map };
      // Images handed over by the editor; anything else loads from the project as usual.
      const urls = new Map(Object.entries(pt.files ?? {}).map(([path, blob]) => [path, URL.createObjectURL(blob)]));
      resolve = (path) => urls.get(path) ?? path;
    } else {
      if (location.protocol === 'file:') throw new Error('Open the game from the editor’s ▶ Playtest button. Opened as a file, it plays the map the editor hands it.');
      this.db = await loadDatabase();
      mapName = params.get('map') ?? this.db.startMap;
      start = mapName === this.db.startMap ? this.db.start : null;
      // A map of its own behind the title.
      const tb = this.db.menus?.titleBackground;
      if (!params.has('map') && tb?.kind === 'map' && tb.map) { mapName = tb.map; start = { x: tb.x ?? 0.5, z: tb.z ?? 0.5 }; }
      mapData = await loadMap(mapName);
      assets = await loadAssets();
    }
    this.resolveFile = resolve;
    migrateMap(mapData);
    migrateItems(this.db);
    setTextColors(this.db.textColors);
    this.sprites = new SpriteLibrary(new PropCatalog(assets));
    alignFootProps(mapData, (t) => this.sprites.def(t));
    this.tiles = new TileCatalog(assets);
    await this.sprites.preload(resolve);
    await this.sprites.preloadCharacters(this.db.characters, resolve);
    await this.sprites.preloadFlats((this.db.enemies ?? []).map((e) => e.look.image).filter((p): p is string => !!p), resolve);
    // LPC weapon sprites used by items and enemies (people default to a sword or a bow).
    await this.sprites.preloadWeapons(usedWeaponSprites(this.db), resolve, this.db.weaponSprites ?? [],
      (this.db.items ?? []).filter((d) => d.icon === 'sprite').map((d) => itemWeaponSprite(d)));
    this.tileTextures = await loadTileTextures(this.tiles, resolve, this.sprites.problems);
    for (const p of this.sprites.problems) console.warn(p);
    await this.loadItemIcons(resolve);
    this.audio = new AudioManager(resolve);
    this.audio.overrides = { ...(this.db.audio?.sfx ?? {}) } as Partial<Record<Sfx, string>>;
    setUiSound((s) => this.audio.play(s));
    this.isPlaytest = !!pt;
    this.saves = new SaveStore(this.db.title || 'game', !!pt);
    this.settingsStore = new SettingsStore(this.db.title || 'game', !!pt);
    // The game's own default settings (controls, HUD…), for players who haven't changed any yet.
    this.settingsStore.projectDefaults = await loadProjectSettings();
    this.settings = this.settingsStore.load();
    this.setup();
    // A playtest that skips the title starts as a new game would: with the starting party.
    if (pt && this.db.menus?.skipTitleInPlaytest) this.startParty();
    this.enterMap(mapName, mapData, start);
    this.applySettings();
    // The title screen, with the map behind it (playtests can skip it: Database → Title & menus).
    if (!(pt && this.db.menus?.skipTitleInPlaytest)) this.openTitle();
    this.bindPointer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    // Fade in from black on start.
    this.post.fade = 1;
    this.fade = { from: 1, to: 0, t: 0, duration: 1.2 };
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /* ------------------------------------------------------------------ setup */

  /** Everything that lasts the whole game: sun and sky, the player, stats, UI, the event interpreter. */
  private setup(): void {
    const hemi = (this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5));
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.castShadow = true;
    const sm = this.small ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 80 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.time = new TimeOfDay(this.db.startHour, this.sun, hemi, this.fog);
    this.time.rate = this.db.time?.rate ?? 20;
    this.time.darkness = this.db.time?.darkness ?? 0.85;

    const hero = this.db.characters[this.db.player];
    this.player = new CharacterSprite(this.sprites, this.sprites.forCharacter(hero), 'down');
    this.scene.add(this.player.mesh);
    this.state.initAbilities(this.db.abilities);
    this.stats = new PlayerStats(configFromDb(this.db));


    this.cursor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: makeTexture(tileCursor()), transparent: true, depthWrite: false, opacity: 0.85 }),
    );
    this.cursor.rotation.x = -Math.PI / 2;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.message = new MessageWindow(this.ui, this.input);
    this.message.setStyles(this.db.messageStyles);
    this.message.tick = () => { if (this.settings.textTicks !== false) this.audio.play('textTick', undefined, undefined, 0.8); };
    this.touch = new TouchControls(this.ui, this.input);
    this.hud = new StatusBars(this.ui);
    this.rings = new Rings(this.scene);
    this.ripples = new Ripples(this.scene);
    this.overlay = new CombatOverlay(this.ui);
    this.overlay.setProjector(this.projector);
    this.battleScreen = new BattleScreen(this.ui, this.input);
    this.battle = new TurnBattle(this.battleScreen, this.battleHost());
    this.battleScreen.onSound = (n) => this.audio.play(n);
    this.combatCfg = combatFromDb(this.db);
    this.progress = new Progression(this.combatCfg);
    this.syncSkills();
    // The skill tree of whoever is chosen in the Party menu (the hero, or a party member's own).
    const skMember = () => (this.skillHero ? this.members()[this.skillHero - 1] : undefined);
    this.skillScreen = new SkillTreeScreen(this.ui, this.input, {
      skills: () => { const m = skMember(); return m ? this.memberSkills(m.data) : this.skills; },
      points: () => { const m = skMember(); return m ? m.data.skillPoints ?? 0 : this.progress.points; },
      level: () => { const m = skMember(); return m ? m.data.level : this.progress.level; },
      who: () => { const m = skMember(); return m ? m.def.name : mainHero(this.db).name; },
      learn: (n) => {
        const m = skMember();
        if (!m) { this.learnSkill(n); return; }
        const sk = this.memberSkills(m.data);
        m.data.skillPoints = Math.max(0, (m.data.skillPoints ?? 0) - sk.take(n));
        const got = teachFromSkills(this.db, (m.data.abilities ??= {}), sk.ranks, sk.data.nodes);
        this.audio.play('skill');
        this.menu.notice(`${m.def.name} learned ${n.name}${got.length ? `: ${got.join(', ')}` : ''}`);
        for (const g of got) this.log.add(`${m.def.name} learned ${g}`, 'level');
      },
      trees: () => { const m = skMember(); return heroTrees(this.db, m ? m.data.abilities ?? {} : this.progress.abilities); },
      teaches: (n) => {
        const sp = findSpell(this.db, n.teachesSpell), ad = findAddition(this.db, n.teachesAddition), out: string[] = [];
        if (sp) {
          const from = Math.max(1, n.spellRankFrom ?? 1), to = Math.min(spellMaxRank(sp), from + Math.max(1, n.ranks ?? 1) - 1);
          out.push(`Teaches the spell ${rankName(sp.name, from)}${to > from ? ` (up to ${rankName(sp.name, to)} with more ranks)` : ''}`);
        }
        if (ad) out.push(`Teaches the Addition ${ad.name} (${ad.strikes.length} strike${ad.strikes.length === 1 ? '' : 's'})`);
        return out.length ? out.join('. ') : null;
      },
      item: (id) => { const d = this.items.get(id); return d ? { name: d.name, color: itemColor(d) } : undefined; },
    });
    this.state.fireText = () => this.fireLeftText();
    this.statusScreen = new StatusScreen(this.ui, this.input, {
      count: () => this.members().length + 1,
      name: (h) => (h ? this.members()[h - 1].def.name : mainHero(this.db).name),
      level: (h) => (h ? this.members()[h - 1].data.level : this.progress.level),
      xp: (h) => {
        const m = h ? this.members()[h - 1]?.data : null;
        if (!m) return { have: this.progress.xp, next: this.progress.maxed ? null : this.progress.toNext };
        const next = xpToNext(this.combatCfg, m.level);
        return { have: m.xp, next: next || null };
      },
      gauges: (h) => {
        const m = h ? this.members()[h - 1] : null;
        if (!m) return { hp: [this.stats.hp, this.stats.cfg.max.hp], mp: [this.stats.mp, this.stats.cfg.max.mp], sp: [this.stats.sp, this.stats.cfg.max.sp] };
        const mx = this.allyNumbers(m.data, m.def).max;
        return { hp: [m.data.hp, mx.hp], mp: [m.data.mp, mx.mp], sp: [m.data.sp, mx.sp] };
      },
      own: (h) => (h ? this.members()[h - 1].data.stats : this.progress.stats),
      points: (h) => (h ? this.members()[h - 1].data.statPoints : this.progress.statPoints),
      totals: (h, extra) => {
        const m = h ? this.members()[h - 1] : null;
        const own = { ...(m ? m.data.stats : this.progress.stats) };
        for (const k of ATTRS) own[k] += extra[k];
        return m ? heroTotals(own, this.wornGear(m.data.equip), (k) => this.memberSkills(m.data).get(k)) : heroTotals(own, this.wornGear(), (k) => (this.skills?.get(k) ?? 0) + this.combat.heroStatus.buff(k));
      },
      spend: (h, add) => (h ? spendMember(this.members()[h - 1].data, add) : this.progress.spend(add)),
    });
    this.creation = new CreationScreen(this.ui, this.input);
    this.equipScreen = new EquipScreen(this.ui, this.input, this.equipHost());
    // A hero's Status page: numbers, what they wear, About, ailments and (party members) fighting style.
    const STYLE_DOES: Record<AllyStyle, string> = {
      fighter: 'Closes in and fights with their melee weapon.',
      archer: 'Keeps back and shoots with their bow.',
      caster: 'Keeps back and throws their readied spell shard.',
      healer: 'Heals whoever drops below half health; otherwise casts.',
    };
    this.charScreen = new CharacterScreen(this.ui, this.input, {
      hero: (h) => {
        const host = this.equipHost(), x = host.heroes()[h], def = h ? this.members()[h - 1]?.def : mainHero(this.db);
        return { name: x?.name ?? '', level: x?.level ?? 1, portrait: x?.portrait ?? '', color: this.heroColor(h), about: def?.about };
      },
      gauges: (h) => {
        const m = h ? this.members()[h - 1] : null;
        if (!m) return { hp: [this.stats.hp, this.stats.cfg.max.hp], mp: [this.stats.mp, this.stats.cfg.max.mp], sp: [this.stats.sp, this.stats.cfg.max.sp], xp: { have: this.progress.xp, next: this.progress.maxed ? null : this.progress.toNext } };
        const mx = this.allyNumbers(m.data, m.def).max, next = xpToNext(this.combatCfg, m.data.level);
        return { hp: [m.data.hp, mx.hp], mp: [m.data.mp, mx.mp], sp: [m.data.sp, mx.sp], xp: { have: m.data.xp, next: next || null } };
      },
      slots: (h) => this.equipHost().slots(h),
      view: (h) => this.equipHost().view(h),
      ailments: (h) => h ? [] : this.combat.heroStatus.list.map((e) => ({ name: effectName(e.id), icon: statusIconUrl(e.id), left: Number.isFinite(e.total) ? `${Math.ceil(e.left)}s` : undefined })),
      styles: (h) => {
        const mem = h ? this.members()[h - 1] : null;
        if (!mem) return null;
        const n = this.allyNumbers(mem.data, mem.def), real = fightingStyle(mem.def, mem.data, n), want = mem.data.style ?? mem.def.ai ?? 'fighter';
        const why: Record<AllyStyle, string> = { fighter: 'No melee weapon', archer: 'No bow equipped', caster: 'No spell shard readied', healer: '' };
        return { value: want, options: (Object.keys(STYLE_NAMES) as AllyStyle[]).map((k) => ({ value: k, name: STYLE_NAMES[k], does: STYLE_DOES[k] })),
          note: real !== want ? `${why[want]}: fights with ${STYLE_NAMES[real].toLowerCase()} for now.` : undefined };
      },
      setStyle: (h, v) => { const mem = h ? this.members()[h - 1] : null; if (mem) mem.data.style = v as AllyStyle; },
    });
    // Party (the pause menu's first tab): the three fighting as cards; Status, Equipment, Skill Tree… and Swap.
    this.partyScreen = new PartyScreen(this.ui, this.input, {
      members: () => this.lineupWhos().map((w) => this.partyView(w)),
      active: ACTIVE_MEMBERS + 1,
      actions: (who) => this.partyActions(who),
      run: (who, id, back) => this.partyRun(who, id, back),
      swap: (a, b) => this.swapLineup(a, b),
    });
    this.pauseShell = new PauseShell(this.ui, () => {
      const where = this.mapData?.name || this.mapName;
      return [where, `Time ${formatPlayTime(this.playTime)}`, `${this.inventory.gold.toLocaleString()} G`].filter(Boolean).join('   ·   ');
    });
    this.worldMap = new WorldMapScreen(this.ui, this.input, {
      pieces: () => this.worldPieces(),
      labels: () => this.db.world?.labels ?? [],
      unvisited: () => this.db.world?.unvisited ?? 'hidden',
      hero: () => { const p = this.db.world?.maps[this.mapName]; return p && this.motion ? { x: p.x + this.motion.x, z: p.z + this.motion.z, map: this.mapName } : null; },
      heroName: () => mainHero(this.db).name,
      markers: () => this.worldMarkers(),
      artScale: 4,
    });
    this.bubbles = new BubbleLayer(this.ui);
    this.achBook = new AchievementBook(`hd2d:${this.db.title || 'game'}${this.isPlaytest ? ':playtest' : ''}:achievements`);
    // Unlocks already earned are passed on to a store's achievements (Steam through a desktop wrapper), if there is one.
    for (const id of this.achBook.all) platformUnlock(id);
    this.achToast = new AchievementToast(this.ui, () => this.audio.play('achievement'));
    this.achScreen = new AchievementsScreen(this.ui, this.input, () => this.achievementViews(),
      () => (this.state.cheated ? 'Console cheats were used in this game, so achievements stay locked in it. · Esc: close' : '↑ ↓ scroll · Esc: close'));
    this.devConsole = new DevConsole(this.ui, () => this.consoleCommands());
    const dc = this.db.devConsole ?? 'playtest';
    this.devConsole.enabled = dc === 'always' || (dc === 'playtest' && this.isPlaytest);
    this.devConsole.onToggle = (open) => { this.input.releaseAll(); if (!open) this.refreshEvents(); };
    this.controls = new ControlsScreen(this.ui, this.input);
    this.creditsScreen = new CreditsScreen(this.ui, this.input);
    this.log = new AdventureLog(this.ui);
    this.log.clock = () => this.time.label(this.settings.clock12);
    this.hud.logEl = this.log.el;
    this.logScreen = new AdventureLogScreen(this.ui, this.input);
    this.recordsScreen = new RecordsScreen(this.ui, this.input);
    this.bestiaryScreen = new BestiaryScreen(this.ui, this.input);
    this.tracker = new QuestTracker(this.ui);
    this.hud.questEl = this.tracker.el;
    this.questScreen = new QuestLogScreen(this.ui, this.input);
    this.arranger = new HudArranger(this.ui, this.input, (l) => this.hud.applyLayout(l));
    this.menu = new GameMenu(this.ui, this.input);
    this.saveScreen = new SaveScreen(this.ui, this.input, {
      slots: (mode) => this.saves.list().filter((s) => mode === 'load' || s.slot !== 'auto').map((s) => ({ slot: s.slot, label: slotLabel(s.slot), data: s.data, shot: s.data ? this.saves.shot(s.slot) : null })),
      act: (mode, slot) => {
        if (mode === 'load') { const d = this.saves.read(slot); if (d) this.loadSave(d); return false; }
        const ok = this.saveTo(slot);
        return !(ok && this.saveFromEvent);
      },
      remove: (slot) => { this.saves.remove(slot); this.state.tally('savesDeleted'); },
    });
    // Notices ("Saved", "Not enough MP"…) go in the adventure log too.
    const notice = this.menu.notice.bind(this.menu);
    this.menu.notice = (t: string) => { notice(t); this.log?.add(t, 'info'); };
    this.inventory = Inventory.fresh(this.db);
    // Worn things stay in the bag (in use): who uses each copy, and taking things off when a copy leaves.
    this.inventory.reserved = (id) => this.wearers(id).length;
    this.inventory.onRemoved = () => this.reconcileWorn();
    // The bag sees forged items (upgraded, enchanted).
    this.inventory.items = (id) => this.items.get(id);
    this.state.inventory = this.inventory;
    this.quests = new QuestBook(this.db.quests, {
      count: (id) => this.inventory.count(id),
      take: (id, n) => { this.inventory.remove(id, n); this.refreshRing(); },
      reward: (r) => this.questReward(r),
      news: (n) => this.questNews(n),
    });
    this.state.quests = this.quests;
    this.refreshRing();
    this.bag = new InventoryScreen(this.ui, this.input, () => this.inventory, {
      use: (i, who) => this.useItem(i, who),
      targets: () => {
        const ms = this.members();
        if (!ms.length) return [];
        const hp = (v: number, mx: number) => `${Math.round(v)} / ${Math.round(mx)} HP`;
        return [{ label: `${mainHero(this.db).name} · ${hp(this.stats.hp, this.stats.cfg.max.hp)}` },
          ...ms.map((m) => ({ label: `${m.def.name} · ${m.data.down ? 'knocked out' : hp(m.data.hp, this.allyNumbers(m.data, m.def).max.hp)}`, disabled: !!m.data.down }))];
      },
      useWarning: (i) => {
        const d = this.items.get(this.inventory.slots[i]?.id ?? '');
        return d?.restore?.hp && this.combat.heroStatus.zombie && !d.cures?.includes('zombie') ? 'Use (hurts: you’re a zombie!)' : null;
      },
      equip: (i) => this.equipItem(i),
      toolOn: (i) => { const id = this.inventory.slots[i]?.id; return !!id && this.rings.ring?.id === id && this.rings.active; },
      toggleTool: (i) => { const id = this.inventory.slots[i]?.id; return id ? this.toggleTool(id) : null; },
      assignB: (i) => {
        const id = this.inventory.slots[i]?.id, d = id ? this.items.get(id) : undefined;
        if (!id || !d?.tool) return null;
        this.inventory.bTool = this.inventory.bTool === id ? null : id;
        this.refreshRing();
        return this.inventory.bTool ? `${d.name} is on the ${this.input.label('ring')} button.` : `${d.name} taken off the ${this.input.label('ring')} button.`;
      },
      bLabel: () => this.input.label('ring'),
      // Equipment picked in the bag: who puts it on (only those who can use it; arrows are the hero's).
      equipTargets: (i) => {
        const id = this.inventory.slots[i]?.id, host = this.equipHost();
        if (!id) return [];
        const g = host.gear().find((x) => x.id === id), heroes = host.heroes();
        if (!g || heroes.length < 2) return [];
        return heroes.map((x, k) => ({ label: `${x.name}${g.users[k] ? '' : ' (can’t use it)'}`, disabled: !g.users[k] }));
      },
      equipOn: (i, who) => {
        const id = this.inventory.slots[i]?.id, host = this.equipHost();
        const g = id ? host.gear(true).find((x) => x.id === id) : undefined;
        if (!g || !id) return this.equipItem(i);
        // Every copy in use: this one moves from whoever had it.
        const had = this.slotWearers().get(i);
        if (this.inventory.free(id) < 1 && had && had.who !== `hero:${who}`) this.takeOffSlot(i);
        const msg = host.equip(who, g.slot, g.id);
        return msg && who ? `${host.heroes()[who].name}: ${msg}` : msg;
      },
      usedBy: (i) => this.slotWearers().get(i)?.label ?? null,
      usedColor: (i) => { const w = this.slotWearers().get(i); return w?.who.startsWith('hero:') ? this.heroColor(Number(w.who.slice(5))) : null; },
      compare: (i) => this.compareGear(i),
      party: () => this.partyCards(),
      takeOff: (i) => this.takeOffSlot(i),
      shardTargets: (i) => this.shardTargets(i),
      placeShard: (i, key) => this.placeShard(i, key),
      changed: () => this.refreshRing(),
      icon: (id) => this.itemIcon(id),
      drop: (i, n) => this.dropItem(i, n),
      quickLabel: (k) => this.input.label(`quick${k + 1}` as Action),
      shardIn: (gear) => { const sh = this.state.forge.get(gear)?.shard; return sh ? { id: sh, name: this.baseItems.get(sh)?.name ?? sh, icon: this.itemIcon(sh) } : null; },
      setShard: (gear, sid) => this.setShard(gear, sid),
    }, () => pauseLabel(this.db.menus, 'items'));
    this.hud.onQuick = (k) => { if (this.fieldFree()) this.useQuick(k); };
    this.shop = new ShopScreen(this.ui, this.input, () => this.inventory, (id) => this.itemIcon(id), () => { this.refreshRing(); this.refreshEvents(); });
    const ctx: EventContext = {
      state: this.state,
      message: this.message,
      setTime: (h, instant) => {
        // Time passing (sleeping until morning) counts for fires too: the clock moves on by the hours skipped forward.
        this.state.clock += wrapHour(h - this.time.target);
        this.fireCheck = 0;
        this.time.set(h, instant);
      },
      tendFire: () => { const f = this.nearestFire(); if (f) this.openFire(f); else this.menu.notice('No fire nearby'); },
      fullRest: () => this.fullRest(),
      fadeTo: (to, seconds) => { this.fade = { from: this.post.fade, to, t: 0, duration: Math.max(0.01, seconds) }; },
      isFading: () => this.fade.t < 1,
      refreshEvents: () => this.refreshEvents(),
      changeGauge: (g, op, v) => this.stats.change(g, op, v),
      ailment: (op, a, secs) => this.ailmentCommand(op, a, secs),
      transfer: (t) => this.requestTransfer(t.map, { x: t.x + 0.5, z: t.z + 0.5, dir: t.dir }, t.fade ?? 'black', { autosave: true }),
      openSave: () => this.openSaveScreen(true),
      items: {
        give: (id, n) => {
          if (!this.items.has(id)) return 'unknown';
          if (this.inventory.room(id) < n) return 'full';
          this.inventory.add(id, n);
          this.audio.play('item');
          this.log.add(`Received ${n > 1 ? `${n} × ` : ''}${this.items.get(id)!.name}`, 'loot');
          return 'ok';
        },
        take: (id, n) => { const k = this.inventory.remove(id, n); this.refreshRing(); return k; },
        gold: (op, v) => { this.inventory.gold = Math.max(0, op === 'set' ? v : this.inventory.gold + v); if (op === 'add' && v > 0) { this.audio.play('coin'); this.log.add(`Received ${v} G`, 'loot'); } },
        name: (id) => this.items.get(id)?.name ?? id,
      },
      openShop: (c) => this.shop.show(c.name || 'Shop', shopGoods(c.goods, (id) => this.items.get(id)?.price ?? 0), c.canSell !== false, () => {}),
      sound: (src) => this.audio.play(src),
      music: (src, fade) => { this.musicOverride = src; this.updateAudio(0, fade ?? 1.5); },
      ambience: (src) => { this.ambienceOverride = src; this.updateAudio(0); },
      party: (op, hero, quiet) => this.changeParty(op, hero, quiet),
      weather: (kind, amount, wind, scope) => {
        // Here: this map's weather (the shared outdoor weather, its zone's or its own); world: the shared outdoor weather.
        const key = scope === 'world' ? WORLD_WEATHER : this.weatherKey();
        const prev = this.state.weather.get(key);
        this.state.weather.set(key, { kind, ...(amount !== undefined ? { amount } : {}), ...(wind !== undefined ? { wind } : prev?.wind !== undefined ? { wind: prev.wind } : {}) });
        const w = this.mapWeather();
        this.weather.set(w.kind, w.amount, this.camTarget);
      },
      quest: (c) => { this.questQuiet = !!c.silent; try { this.quests.run(c.quest, c.op, c.objective, c.add); } finally { this.questQuiet = false; } },
      battle: (c) => {
        const defs = new Map((this.db.enemies ?? []).map((x) => [x.id, x]));
        const list = c.enemies.map((id) => defs.get(id)).filter((d): d is EnemyDef => !!d).slice(0, MAX_FOES).map((def) => ({ def, hp: def.hp, enemy: null }));
        if (!list.length) return;
        this.startBattle(list, 'normal', { canRun: !!c.canRun, lose: c.lose ?? 'respawn', resultVar: c.resultVar, music: c.music, scripted: true, stage: c.map || undefined });
      },
      busy: () => this.battle.active || this.battlePending,
      achievement: (id) => { this.unlockAchievement(id); },
      console: (line) => { const r = this.devConsole.exec(line, false); if (r && !/^Done/.test(r)) console.info(`[console] ${line}: ${r}`); },
      learn: (c) => this.eventLearn(c),
      heroClass: (c) => this.eventClass(c),
      skillPoints: (n) => { this.progress.points = Math.max(0, this.progress.points + n); if (n > 0) { this.menu.notice(`+${n} skill point${n === 1 ? '' : 's'}`); this.audio.play('skill'); } },
    };
    this.interpreter = new Interpreter(ctx);

    this.debug = new DebugPanel(this.ui, '', {
      setHour: (h, instant) => this.time.set(h, instant),
      setSeason: (x) => { this.seasonTest = x; },
      setNormalMaps: (on) => setNormalMapsEnabled(on),
      setSunShadows: (on) => (this.sun.castShadow = on),
      setFireShadows: (on) => this.lights.shadowLights.forEach((l) => (l.castShadow = on)),
      setBloom: (on) => (this.post.settings.bloom = on),
      setTiltShift: (on) => (this.post.settings.tiltShift = on),
      hurt: () => this.stats.change('hp', 'add', -25),
      tire: () => { this.stats.change('sp', 'set', 0); this.stats.exhausted = true; },
      refill: () => this.stats.refill(),
      console: () => this.devConsole.toggle(true),
    });
  }

  /** A map as it is on this visit: props cut down earlier stay gone (leaving their stump, if they have one). */
  private visitData(name: string, data: MapData): MapData {
    if (!data.props.some((p) => this.state.isCut(name, propKey(p)))) return data;
    const kept: PropData[] = [], stumps: PropData[] = [];
    for (const p of data.props) {
      if (!this.state.isCut(name, propKey(p))) { kept.push(p); continue; }
      const st = this.sprites.def(p.type)?.stump;
      if (st && this.sprites.def(st)) stumps.push({ type: st, x: p.x, z: p.z, ...(p.s ? { s: p.s } : {}), ...(p.y !== undefined ? { y: p.y } : {}) });
    }
    return { ...data, props: [...kept, ...stumps] };
  }

  /** Build a map and put the player on it (or take over a neighbour already built beside it). The previous map goes. */
  private enterMap(name: string, data: MapData, start: Start | null, pre?: Preview): void {
    if (pre) this.level?.remove(pre.group);
    this.leaveMap();
    this.mapName = name;
    this.cutThisVisit.clear();
    this.mineHits.clear();
    data = this.visitData(name, data);
    this.mapData = data;
    this.time.environment = data.environment ?? 'outdoor';
    const level = (this.level = pre?.group ?? new THREE.Group());
    level.position.set(0, 0, 0);
    pre?.origin.set(0, 0);
    level.name = `map:${name}`;
    this.scene.add(level);
    // Winter freezes still water over (decided as the map is built; a change of season rebuilds it).
    this.season = this.seasonNow();
    setSeason(this.season);
    this.mapWinter = this.season === 'winter';
    this.map = pre?.map ?? new TileMap(data, this.tiles, (style) => this.frozen(style));
    const built = pre?.built ?? buildWorld(level, this.map, data, this.sprites, this.tileTextures);
    this.waterNormals = built.waterNormals;
    this.waterFlows = built.waterFlows;
    this.findWetProps();
    tagAOMeshes(level);
    this.groundMeshes = built.ground;
    this.propSlots = built.props;
    this.buildings = built.buildings;
    this.bursts.attach(level);
    this.lights = new Lights(level, data, this.map, this.sprites);
    this.fireflies = new Fireflies(level, this.map);
    this.weatherPending = true;
    this.events = data.events.map((e) => new GameEvent(e, level, this.sprites, this.db, this.map));
    this.combat.attach(this.combatHost(level));
    this.warmup = true;
    this.initFires();
    if (this.pickups) this.pickups.reset(level, this.map);
    else this.pickups = new Pickups(level, this.map, {
      xp: (n) => this.absorbXp(n),
      gold: (n) => { this.state.tally('goldFound', n); this.inventory.gold += n; this.audio.play('coin'); this.goldBurst += n; this.xpBurstT = 0; },
      item: (id, n) => {
        const left = this.inventory.add(id, n), got = n - left, name = this.items.get(id)?.name ?? id;
        if (got > 0) { this.state.tally('itemsFound', got); this.audio.play('item'); this.log.add(`Picked up ${got > 1 ? `${got} × ` : ''}${name}`, 'loot'); }
        return left;
      },
      icon: (id) => this.iconCanvases.get(id) ?? builtinIcon('bag'),
      // Uncommon and better loot glows in its rarity's colour.
      color: (id) => { const d = this.items.get(id); return (rarityOf(d) ?? 'common') !== 'common' ? itemColor(d) : null; },
    });
    this.pickups.onFull = (id) => this.bagFull(id);
    this.refreshEvents();
    // Reaching a map counts for "visit" objectives.
    if (!this.onTitle) this.quests.mapEntered(name);
    this.preloadBattleMaps(data);

    const s = start ?? this.findOpenTile(data);
    this.motion = new PlayerMotion({
      map: this.map,
      solidEvent: (x, z) => this.events.some((e) => e.solid && e.covers(x, z)),
      // Out of stamina: only walking (and crawling, so nobody gets stuck in a tunnel) until it refills.
      has: (a) => this.state.has(a) && (a === 'crawl' || !this.stats.exhausted),
      speed: this.stats.cfg.speed,
      ledges: this.stats.cfg.ledges,
      waterWalk: () => this.rings.waterWalk,
      current: (cx, cz) => {
        const w = this.map.waterAt(cx, cz);
        if (!w) return null;
        const st = waterStyle(this.mapData, w.style), f = st.flow ?? 0;
        if (!f || this.frozen(w.style)) return null;
        const a = ((st.flowDir ?? 0) * Math.PI) / 180;
        return [Math.cos(a) * f, Math.sin(a) * f];
      },
    });
    this.motion.place(s.x, s.z);
    if (s.dir) this.player.faceVector(...DIR_VECTOR[s.dir]);
    this.syncPlayer();
    this.camTarget.copy(this.player.position);
    this.lastTile = this.playerTile();
    this.moveTarget = null;
    this.pendingEvent = null;
    this.debug.setMap(data.name || name);
    this.musicOverride = undefined;
    this.ambienceOverride = undefined;
    this.calmFor = 99;
    if (!this.onTitle) this.updateAudio(0);
    this.debug.setLights(this.lights.budget);
    this.spawnAllies();
    this.buildPreviews();
  }

  /* ---------------------------------------------------------------- seamless neighbours */

  /** Seamless neighbours drawn past this map's edges (World layout + Seamless sides), built a moment after arriving. */
  private previews: Preview[] = [];
  private previewToken = 0;

  /** Sides of this map with a seamless neighbour (the camera may look past them). */
  private openSides = new Set<string>();

  private buildPreviews(): void {
    const token = ++this.previewToken;
    const sides = seamlessSides(this.mapData.border);
    const list = neighbours(this.db.world, this.mapName).filter((n) => sides.has(n.side));
    this.openSides = new Set(list.map((n) => n.side));
    if (this.onTitle || !list.length) return;
    void (async () => {
      for (const n of list) {
        // One at a time, a little apart, so arriving stays smooth.
        await new Promise((r) => setTimeout(r, 150));
        if (token !== this.previewToken || !this.level) return;
        try {
          const raw = await this.loadMapData(n.map);
          if (token !== this.previewToken || !this.level) return;
          const data = this.visitData(n.map, raw);
          const group = new THREE.Group(), origin = new THREE.Vector2(n.dx, n.dz);
          group.name = `next:${n.map}`;
          group.position.set(n.dx, 0, n.dz);
          const map = new TileMap(data, this.tiles, (st) => this.season === 'winter' && !(waterStyle(data, st).flow ?? 0) && !(waterStyle(data, st).glow ?? 0));
          const built = buildWorld(group, map, data, this.sprites, this.tileTextures, origin);
          tagAOMeshes(group);
          this.level.add(group);
          this.previews.push({ name: n.map, n, group, map, built, data, origin });
        } catch (e) { console.warn(`Couldn’t draw the map next door (${n.map}):`, e); }
      }
    })();
  }

  /** Walking off a seamless edge into the map next door: no fade, the same spot on the other side. */
  private trySeamless(dx: number, dz: number): boolean {
    if (!this.previews.length || this.transfer || (!dx && !dz)) return false;
    const m = this.motion, W = this.mapData.width, H = this.mapData.height, edge = 0.42;
    const out = dx < 0 && m.x < edge ? [-0.6, 0] : dx > 0 && m.x > W - edge ? [0.6, 0] : dz < 0 && m.z < edge ? [0, -0.6] : dz > 0 && m.z > H - edge ? [0, 0.6] : null;
    if (!out) return false;
    const px = m.x + out[0], pz = m.z + out[1];
    const n = neighbourAt(this.previews.map((p) => p.n), seamlessSides(this.mapData.border), px, pz, W, H);
    const p = n && this.previews.find((q) => q.n === n);
    if (!p) return false;
    const x = px - p.n.dx, z = pz - p.n.dz, cx = Math.floor(x), cz = Math.floor(z);
    if (!p.map.inMap(cx, cz) || p.map.isBlocked(cx, cz) || Math.abs(p.map.standY(x, z) - m.y) > 0.6) return false;
    const view = this.camTarget.clone().add(new THREE.Vector3(-p.n.dx, 0, -p.n.dz)), dir = this.player.dir;
    this.enterMap(p.name, p.data, { x, z, dir }, p);
    // The camera carries on from where it was (the world moved under it, not the view).
    this.camTarget.copy(view);
    return true;
  }

  /** Remove the current map from the scene and free its GPU memory (shared sprite art stays). */
  private leaveMap(): void {
    this.endFishing();
    this.previews = [];
    this.previewToken++;
    if (!this.level) return;
    this.bankPickups('leave');
    this.disposeTree(this.level);
    this.scene.remove(this.level);
    this.level = null;
    this.events = [];
  }

  /** Free the GPU memory of a built map (shared sprite art and tile textures stay). */
  private disposeTree(root: THREE.Object3D): void {
    const keep = this.sprites.shared();
    for (const t of this.tileTextures.values()) { keep.add(t.map); keep.add(t.normal); }
    root.traverse((o) => {
      const m = o as THREE.Mesh & { isLight?: boolean; shadow?: { map?: { dispose(): void } | null } };
      if (m.isLight && m.shadow?.map) m.shadow.map.dispose();
      const geo = m.geometry as THREE.BufferGeometry | undefined;
      if (geo && !keep.has(geo)) geo.dispose();
      const sm = o as THREE.Object3D & { customDepthMaterial?: THREE.Material; customDistanceMaterial?: THREE.Material };
      const mats = [...(Array.isArray(m.material) ? m.material : m.material ? [m.material] : []), sm.customDepthMaterial, sm.customDistanceMaterial]
        .filter((x): x is THREE.Material => !!x);
      for (const mat of mats) {
        if (keep.has(mat)) continue;
        for (const v of [...Object.values(mat), mat.userData?.normalMap]) {
          const tex = v as THREE.Texture | null;
          if (tex?.isTexture && !keep.has(tex)) tex.dispose();
        }
        unregisterNormalMap(mat);
        unregisterGlow(mat);
        mat.dispose();
      }
    });
  }

  /**
   * Start a transfer: fade out, switch maps (or move within this one), fade back in.
   * The map loads while the screen is dark.
   */
  private requestTransfer(name: string, to: Start, fade: 'black' | 'white' | 'none', opts: { before?: () => void; after?: () => void; autosave?: boolean; fresh?: boolean; slow?: boolean } = {}): void {
    if (this.transfer) return;
    this.transfer = { name, to, fade, phase: 'out', ...opts };
    this.moveTarget = null;
    this.pendingEvent = null;
    if (fade === 'none') { this.transfer.phase = 'load'; return; }
    this.audio.play('transfer');
    // Fades back to black afterwards, so event fades keep working.
    this.post.fadeColor = fade === 'white' ? 0xffffff : 0x000000;
    this.fade = { from: this.post.fade, to: 1, t: 0, duration: opts.slow ? 0.9 : 0.35 };
  }

  /** Advance a transfer; returns true while one is under way (the player can't move). */
  private updateTransfer(): boolean {
    const t = this.transfer;
    if (!t) return false;
    if (t.phase === 'out' && this.fade.t >= 1) t.phase = 'load';
    if (t.phase === 'load') {
      t.phase = 'busy';
      const same = t.name === this.mapName && !t.fresh;
      void (same ? Promise.resolve(null) : this.loadMapData(t.name)).then((data) => {
        // Restore saved switches etc. first, so the new map's events pick the right pages.
        t.before?.();
        if (same || !data) {
          this.refreshEvents();
          // Same map: just move the player.
          this.motion.place(t.to.x, t.to.z);
          if (t.to.dir) this.player.faceVector(...DIR_VECTOR[t.to.dir]);
          this.syncPlayer();
          this.camTarget.copy(this.player.position);
          this.lastTile = this.playerTile();
          // Loading a save on the map already shown: its party (perhaps a different one) lines up behind the hero.
          this.spawnAllies();
        } else {
          this.enterMap(t.name, data, t.to);
        }
        if (t.fade !== 'none') this.fade = { from: 1, to: 0, t: 0, duration: t.slow ? 1.3 : 0.45 };
        this.transfer = null;
        this.fadeColorReset = t.fade === 'white';
        if (t.autosave && !same && this.db.saving?.autosave !== false) this.saveTo('auto', true);
        t.after?.();
      }).catch((err: Error) => {
        console.error(err);
        this.interpreter.start([{ cmd: 'text', text: `Can’t go to map “${t.name}”: ${err.message}` }]);
        if (t.fade !== 'none') this.fade = { from: 1, to: 0, t: 0, duration: 0.3 };
        this.transfer = null;
      });
    }
    return true;
  }

  /** A map's data: handed over by the editor in a playtest, otherwise loaded from the project. */
  private async loadMapData(name: string): Promise<MapData> {
    const handed = this.handedMaps?.[name];
    const data = handed ? (JSON.parse(JSON.stringify(handed)) as MapData) : await loadMap(name);
    migrateMap(data);
    alignFootProps(data, (t) => this.sprites.def(t));
    return data;
  }

  /** No start position on this map: use the open tile nearest the centre. */
  private findOpenTile(data: MapData): Start {
    const cx = Math.floor(this.map.w / 2), cz = Math.floor(this.map.h / 2);
    const solidEvent = (x: number, z: number) => data.events.some((e) => eventCovers(e, x, z) && e.pages[0]?.solid);
    for (let r = 0; r < Math.max(this.map.w, this.map.h); r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx, z = cz + dz;
          if (!this.map.isBlocked(x, z) && !solidEvent(x, z)) return { x: x + 0.5, z: z + 0.5 };
        }
    return { x: cx + 0.5, z: cz + 0.5 };
  }

  private refreshEvents(): void {
    for (const e of this.events) e.refresh(this.state);
    this.combat.syncEvents(this.events);
  }

  /** What the combat system needs from the game, for the map just entered. */
  private combatHost(level: THREE.Object3D): CombatHost {
    const game = this;
    return {
      get map() { return game.map; },
      level, sprites: this.sprites, db: this.db, cfg: this.combatCfg,
      get player() { return game.player; },
      get motion() { return game.motion; },
      get stats() { return game.stats; },
      get inventory() { return game.inventory; },
      get skills() { return game.skills; },
      hero: () => this.heroTotals(),
      swingMissed: () => { if (!this.mineAhead()) this.cutAhead(0, true); },
      proficient: (cls) => this.proficient(cls),
      // Worn gear with a shard set in it halves that element.
      heroElements: () => ({ ...mainHero(this.db), halve: this.wornGear().flatMap((g) => g?.wards ?? []) }),
      heroResists: () => [...(mainHero(this.db).resists ?? []), ...this.wornGear().flatMap((g) => g?.protects ?? [])],
      crouchHold: () => this.settings.crouch === 'hold',
      iconCanvas: (id, fallback) => (id && this.iconCanvases.get(id)) || builtinIcon(fallback),
      glow: () => this.rings.glow(this.elapsed),
      sound: (n, x, z) => this.audio.play(n, x, z),
      items: this.items, overlay: this.overlay, bursts: this.bursts,
      lightAt: (x, z) => this.lightLevel(x, z),
      notice: (t) => this.menu.notice(t),
      solidEventAt: (x, z) => this.events.some((e) => e.solid && e.covers(x, z)),
      defeated: (e) => this.enemyDefeated(e),
      ignite: (x, y, z, r) => this.ignite(x, y, z, r),
      allies: () => this.allies,
      heroLit: () => this.heroLit(),
      safeZones: () => this.safeZones(),
      tally: (k, n, best) => this.state.tally(k, n, best),
      fieldSpell: () => this.useRing(),
      broken: (b) => {
        // Its page's commands (set a switch, open a way…), then pages may change (a switch shows the rubble).
        const ev = b.key as unknown as GameEvent;
        if (ev.page?.commands.length && !this.interpreter.running) this.interpreter.start(ev.page.commands);
        this.refreshEvents();
      },
      log: (t, k) => this.log.add(t, k),
      encounter: (e, how) => this.encounter(e, how),
      learnedSpell: () => this.readiedSpell(),
    };
  }

  /** How lit a spot is for stealth: daylight, the map's lamps and fires, and the hero's own light ring. */
  private lightLevel(x: number, z: number): number {
    if (this.rings.active && this.rings.power?.power === 'light') return 1;
    const env = this.time.environment;
    const ambient = env === 'outdoor' ? 1 - this.time.night * 0.82 : env === 'indoor' ? 0.7 - this.time.night * 0.15 : 0.12;
    return Math.max(ambient, this.lights.lightAt(x, z));
  }

  /** Experience, gold and loot for a beaten enemy, then its page's commands (if any). */
  private enemyDefeated(e: Enemy): void {
    const d = e.def;
    this.log.add(`${d.name} defeated`, 'defeat');
    this.state.tally('kills'); this.state.tally(`kill:${d.id}`);
    this.quests.enemyDefeated(d.id);
    // What it leaves: EXP orbs, gold and its drops, spilling onto the ground to be collected.
    const gold = d.gold ? Math.round(d.gold[0] + Math.random() * Math.max(0, d.gold[1] - d.gold[0])) : 0;
    const items: { id: string; count: number }[] = [];
    for (const drop of d.drops ?? []) {
      if (Math.random() >= drop.chance || !this.items.has(drop.item)) continue;
      items.push({ id: drop.item, count: Math.max(1, drop.count ?? 1) });
    }
    this.pickups?.drop(e.x, e.y, e.z, Math.max(0, d.xp), gold, items);
    // Party members standing when it fell get its EXP once the fight is over (the orbs are the hero's to collect).
    for (const a of this.allies) if (!a.down && d.xp > 0) a.data.pendingXp = (a.data.pendingXp ?? 0) + d.xp;
    this.refreshEvents();
    const ev = e.key as GameEvent;
    if (ev.page?.commands.length && !this.interpreter.running) this.interpreter.start(ev.page.commands);
  }

  /** Walked over an item with no room for it: say so, and offer the bag to make room (drop something). */
  private bagFull(id: string): void {
    const name = this.items.get(id)?.name ?? id;
    this.log.add(`Bag full: no room for ${name}`, 'info');
    if (this.menu.isOpen || this.bag.isOpen || this.interpreter.running) return;
    this.audio.play('menuBack');
    this.menu.push('BAG FULL', [
      { label: 'Open the bag', detail: 'Drop something to make room', pick: () => { this.menu.close(); this.openInventory(0); } },
      { label: 'Leave it', pick: () => this.menu.close() },
    ], { note: `No room for ${name}. Walk over it again once there's space.` });
  }

  /**
   * Bag → Drop: put `count` down by the hero's feet. It lies there dimmed for a few seconds (and until the hero steps
   * off it), then can be picked up again by walking over it.
   */
  private dropItem(i: number, count: number): string | null {
    const s = this.inventory.slots[i], d = s && this.items.get(s.id);
    if (!s || !d || !this.pickups || this.onTitle) return null;
    const n = Math.max(1, Math.min(count, s.n)), id = s.id;
    const [fx, fz] = DIR_VECTOR[this.player.dir], p = this.player.position;
    this.inventory.removeAt(i, n);
    this.pickups.place(id, n, p.x + fx * 0.6, p.y, p.z + fz * 0.6);
    this.refreshRing();
    this.log.add(`Dropped ${n > 1 ? `${n} × ` : ''}${d.name}`, 'loot');
    return `Dropped ${n > 1 ? `${n} × ` : ''}${d.name}. Walk over it to pick it up again.`;
  }

  /** A completed quest's rewards: gold, EXP, skill points and items (what doesn't fit is put down by the hero's feet). */
  private questReward(r: NonNullable<import('../world/types').QuestDef['rewards']>): void {
    if (r.gold) { this.inventory.gold += r.gold; this.audio.play('coin'); this.log.add(`Received ${r.gold} G`, 'loot'); }
    for (const it of r.items ?? []) {
      if (!this.items.has(it.item)) continue;
      const left = this.inventory.add(it.item, it.count), got = it.count - left, name = this.items.get(it.item)!.name;
      if (got > 0) this.log.add(`Received ${got > 1 ? `${got} × ` : ''}${name}`, 'loot');
      if (left > 0 && this.pickups) {
        const p = this.player.position;
        this.pickups.place(it.item, left, p.x, p.y, p.z);
        this.log.add(`No room in the bag: ${left > 1 ? `${left} × ` : ''}${name} left on the ground`, 'info');
      }
    }
    if (r.skillPoints) { this.progress.points += r.skillPoints; this.log.add(`+${r.skillPoints} skill point${r.skillPoints === 1 ? '' : 's'}`, 'level'); }
    if (r.xp) { this.log.add(`+${r.xp} EXP`, 'xp'); this.gainXp(r.xp, false); for (const m of this.party.members) m.pendingXp = (m.pendingXp ?? 0) + r.xp; }
    this.refreshRing();
  }

  /** Something happened to a quest: a line in the log, and a banner and a sound for the big moments. */
  private questNews(n: QuestNews): void {
    const q = n.quest, quiet = this.questQuiet || this.onTitle;
    switch (n.type) {
      case 'started': {
        this.log.add(`Quest started: ${q.name}`, 'quest');
        const first = this.quests.visible(q).find((o) => !this.quests.objectiveDone(q, o));
        if (!quiet) { this.overlay.quest(q.kind === 'main' ? 'NEW MAIN QUEST' : 'NEW QUEST', q.name, first?.text ?? '', 'start'); this.audio.play('questStart'); }
        break;
      }
      case 'objective':
        this.log.add(`${q.name}: ${n.objective.text} ✓`, 'quest');
        if (!quiet) this.audio.play('questStep');
        break;
      case 'progress':
        this.log.add(`${q.name}: ${n.objective.text} (${n.have}/${n.need})`, 'quest');
        break;
      case 'ready':
        this.log.add(`${q.name}: ${q.turnIn || (q.giver ? `return to ${q.giver}` : 'ready to hand in')}`, 'quest');
        if (!quiet) this.overlay.quest('OBJECTIVES COMPLETE', q.name, q.turnIn || (q.giver ? `Return to ${q.giver}` : ''), 'ready');
        break;
      case 'done': {
        this.log.add(`Quest complete: ${q.name}`, 'quest');
        if (!quiet) { this.overlay.quest('QUEST COMPLETE', q.name, rewardText(q, { item: (id) => this.items.get(id)?.name ?? id }), 'done'); this.audio.play('questDone'); }
        break;
      }
      case 'failed':
        this.log.add(`Quest failed: ${q.name}`, 'quest');
        if (!quiet) { this.overlay.quest('QUEST FAILED', q.name, '', 'failed'); this.audio.play('menuBack'); }
        break;
      case 'reset': break;
    }
  }

  /* ------------------------------------------------------------------ quick items */

  /** Free to act on the field: no menu, event, transfer or title in the way. */
  private fieldFree(): boolean {
    return !this.onTitle && !this.pauseShell.isOpen && !this.menu.isOpen && !this.bag.isOpen && !this.shop.isOpen && !this.interpreter.running && !this.transfer && !this.dying && !this.message.isOpen;
  }

  /** Use the item on quick slot k (D-pad left / up / right, or 5 / 6 / 7). */
  private useQuick(k: number): void {
    const id = this.inventory.quick[k], dir = ['←', '↑', '→'][k];
    if (!id) { this.menu.notice(`Quick slot ${dir} is empty: assign an item in the bag (Items → an item → Quick slot)`); return; }
    const d = this.items.get(id), i = this.inventory.slots.findIndex((s) => s?.id === id);
    if (i < 0) { this.audio.play('menuBack'); this.menu.notice(`No ${d?.name ?? id} left`); return; }
    const msg = this.useItem(i);
    if (!msg) return;
    if (msg.startsWith('Used')) {
      this.audio.play('item');
      const p = this.player.position;
      this.bursts.spawn(p.x, p.y + 0.6, p.z, { color: '#9cf07a', n: 8, speed: 0.6, up: 1.4, life: 0.5, size: 0.06, additive: true });
      this.refreshRing();
    } else this.audio.play('menuBack');
    this.menu.notice(msg);
  }

  /* ------------------------------------------------------------------ footsteps */

  private stepT = 0;
  private stepAir = false;
  private stepAt = { x: NaN, z: NaN };

  /** Footsteps in time with the hero's stride, sounding like the ground (or the shallow water) underfoot. */
  private tileAilT = 0;
  /** Standing on a tile that gives an ailment (lava, a poison swamp): rolled every half second. */
  private updateTileAilment(dt: number): void {
    const m = this.motion;
    if (!m || this.onTitle || m.airborne || this.dying) return;
    this.tileAilT -= dt;
    if (this.tileAilT > 0) return;
    this.tileAilT = 0.5;
    const cx = Math.floor(m.x), cz = Math.floor(m.z);
    // Water that hurts (poison goo, lava): its style's ailment, unless the hero is walking on it.
    const w = !m.onWater ? this.map.waterAt(cx, cz) : null, ws = w ? waterStyle(this.mapData, w.style) : null;
    if (ws?.ailment && Math.random() * 100 < (ws.chance ?? 100)) { this.ailmentCommand('give', ws.ailment, undefined, true); return; }
    const t = this.map.inMap(cx, cz) ? this.tiles.ailment(this.map.terrain(cx, cz)) : undefined;
    if (t && Math.random() * 100 < (t.chance ?? 100)) this.ailmentCommand('give', t.ailment, t.seconds, true);
  }

  private updateFootsteps(dt: number): void {
    const m = this.motion;
    if (!m || this.onTitle) return;
    const dist = Math.hypot(m.x - this.stepAt.x, m.z - this.stepAt.z);
    this.stepAt = { x: m.x, z: m.z };
    const air = m.airborne, landed = this.stepAir && !air;
    this.stepAir = air;
    // For the Journal: steps on the ground (about two to a tile) and distance swum.
    if (dist > 0 && dist < 1.5 && !air && !m.climbing) this.state.tally(m.swimming ? 'swum' : 'steps', m.swimming ? dist : dist / 0.45);
    // Swimming: a stroke's splash every so often while moving.
    if (m.swimming && this.settings.footsteps && !air) {
      if (!(dist > dt * 0.5) || dist > 1.5) { this.stepT = 0.3; return; }
      this.stepT += dt;
      if (this.stepT >= 0.72) { this.stepT -= 0.72; this.audio.play('swim', undefined, undefined, 0.6 * (0.85 + Math.random() * 0.3)); }
      return;
    }
    if (!this.settings.footsteps || air || m.swimming || m.climbing || m.dashing) { this.stepT = 0.2; return; }
    if (landed) { this.footstep(1.3); this.stepT = 0; return; }
    // Standing still, or moved by a transfer (a jump in place, not a step).
    if (!(dist > dt * 0.5) || dist > 1.5) { this.stepT = 0.25; return; }
    const sneaking = this.combat.sneaking;
    const every = m.running ? 0.3 : m.crawling ? 0.55 : sneaking ? 0.5 : 0.4;
    this.stepT += dt;
    if (this.stepT < every) return;
    this.stepT -= every;
    const quiet = 1 - Math.min(90, this.skills.get('quietSteps')) / 100;
    this.footstep(m.running ? 1.1 : sneaking || m.crawling ? 0.4 * quiet : 0.8);
  }

  /** White rings on the water around the hero (swimming, or wading on the move) and party members swimming. */
  private updateRipples(dt: number): void {
    const m = this.motion;
    if (!m || this.onTitle) return;
    const moved = (key: object, x: number, z: number) => {
      const was = this.ripAt.get(key);
      this.ripAt.set(key, { x, z });
      return !!was && Math.hypot(x - was.x, z - was.z) > dt * 0.4;
    };
    const heroMoving = moved(this.player, m.x, m.z);
    const w = !m.onWater && !m.airborne ? this.map.waterAt(Math.floor(m.x), Math.floor(m.z)) : null;
    if (w) this.ripples.swimmer(this.player, m.x, w.surface, m.z, heroMoving, w.kind !== 'shallow', dt, this.rippleColor(w.style));
    for (const a of this.allies) {
      const am = moved(a, a.x, a.z);
      const aw = this.map.waterAt(Math.floor(a.x), Math.floor(a.z));
      if (aw) this.ripples.swimmer(a, a.x, aw.surface, a.z, am, aw.kind !== 'shallow', dt, this.rippleColor(aw.style));
    }
    // Props standing in water (a rock, a fallen trunk): slow rings around them.
    for (const p of this.wetProps) {
      if (this.gone(p.prop)) continue;
      this.ripples.still(p.prop, p.prop.x, p.y, p.prop.z - 0.15, p.size, dt, p.color);
    }
  }

  private footstep(loud: number): void {
    const m = this.motion, cx = Math.floor(m.x), cz = Math.floor(m.z);
    const water = !m.onWater ? this.map.waterAt(cx, cz) : null;
    const mat = water ? 'water' : this.map.inMap(cx, cz) ? this.tiles.footstep(this.map.terrain(cx, cz)) : 'grass';
    if (mat === 'none') return;
    // The sounds differ in loudness; this evens them out (then a little random variety).
    const even: Record<string, number> = { grass: 1.3, dirt: 0.55, stone: 0.95, wood: 0.55, sand: 1.5, snow: 1.15, water: 1.2, metal: 0.8, carpet: 0.45 };
    this.audio.play(`step${mat[0].toUpperCase()}${mat.slice(1)}`, undefined, undefined, 0.5 * loud * (even[mat] ?? 1) * (0.85 + Math.random() * 0.3));
  }

  /** An EXP orb reached the hero: counted now, shown as one "+N EXP" once the burst of orbs is over. */
  private absorbXp(n: number): void {
    this.xpBurst += n;
    this.xpBurstT = 0;
    this.audio.play('orb');
    const p = this.player.position;
    this.bursts.spawn(p.x, p.y + 0.6, p.z, { color: '#9cf07a', n: 4, speed: 0.8, up: 1.2, life: 0.35, size: 0.06, additive: true });
    this.gainXp(n, false);
  }

  private flushGold(): void {
    if (this.goldBurst > 0) this.log.add(`+${this.goldBurst} G`, 'loot');
    this.goldBurst = 0;
  }

  private flushXp(): void {
    const p = this.player.position;
    this.overlay.float(`+${this.xpBurst} EXP`, p.x, p.y + 1.5, p.z, 'xp');
    this.log.add(`+${this.xpBurst} EXP`, 'xp');
    this.xpBurst = 0;
  }

  /** Add experience; a level-up shows its banner (and is logged). */
  private gainXp(n: number, announce = true, quiet = false): void {
    if (n <= 0) return;
    if (announce) this.log.add(`+${n} EXP`, 'xp');
    const ups = this.progress.add(n);
    if (!ups) return;
    if (quiet) {
      // The battle's results screen shows it.
      const pts = ups * this.combatCfg.pointsPerLevel, st = ups * this.combatCfg.statPointsPerLevel;
      this.log.add(`Level ${this.progress.level}!${pts ? ` +${pts} skill point${pts === 1 ? '' : 's'}` : ''}${st ? ` +${st} stat point${st === 1 ? '' : 's'}` : ''}`, 'level');
      return;
    }
    // The EXP that did it is logged before the level-up.
    if (this.xpBurst > 0) this.flushXp();
    const points = ups * this.combatCfg.pointsPerLevel;
    this.overlay.levelUp(this.progress.level, points, `${pauseLabel(this.db.menus, 'skills')} in the menu`);
    const statPts = ups * this.combatCfg.statPointsPerLevel;
    this.log.add(`Level ${this.progress.level}!${points ? ` +${points} skill point${points === 1 ? '' : 's'}` : ''}${statPts ? ` +${statPts} stat point${statPts === 1 ? '' : 's'}` : ''}`, 'level');
    this.audio.play('levelUp');
    this.bursts.spawn(this.player.position.x, this.player.position.y + 0.6, this.player.position.z, { color: '#ffe48a', n: 26, speed: 1.6, up: 3, life: 0.9, size: 0.09, gravity: 2, additive: true });
  }

  /**
   * What's still on the ground when the hero moves on. Leaving the map: EXP and gold are collected for them, key and
   * quest items too; other items vanish. Saving: everything is collected (items that don't fit stay on the ground).
   * Starting over (new game, load, title): it's all thrown away.
   */
  private bankPickups(why: 'leave' | 'save' | 'discard'): void {
    if (!this.pickups?.count) return;
    if (this.xpBurst > 0) this.flushXp();
    this.flushGold();
    const got = this.pickups.collectAll(why === 'save' ? 'all' : 'keys', (id) => alwaysFits(this.items.get(id)));
    if (why === 'discard') return;
    if (got.xp > 0) { this.log.add(`Gathered ${got.xp} EXP left behind`, 'xp'); this.gainXp(got.xp, false); }
    if (got.gold > 0) { this.inventory.gold += got.gold; this.log.add(`Gathered ${got.gold} G left behind`, 'loot'); }
    for (const it of got.items) if (it.count > 0) this.log.add(`Gathered ${it.count > 1 ? `${it.count} × ` : ''}${this.items.get(it.id)?.name ?? it.id}`, 'loot');
    for (const it of got.lost) this.log.add(`Left behind: ${it.count > 1 ? `${it.count} × ` : ''}${this.items.get(it.id)?.name ?? it.id}`, 'loot');
  }

  /** Most pixels per CSS pixel to draw at: the quality setting (auto: 1.5 on phones and tablets, 2 elsewhere). */
  private get pixelCap(): number {
    const q = this.settings?.quality ?? 'auto';
    return q === 'high' ? 2 : q === 'balanced' ? 1.25 : q === 'performance' ? 1 : this.small ? 1.5 : 2;
  }

  private resize(): void {
    // A resize clears the picture: draw the world behind a battle again.
    this.battleFrames = 0;
    const pr = Math.min(window.devicePixelRatio || 1, this.pixelCap);
    this.renderer.setPixelRatio(pr);
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyFov();
    this.post.resize(pr);
    this.resizeAO();
  }

  private resizeAO(): void {
    this.renderer.getDrawingBufferSize(this.bufferSize);
    this.ssao.resize(this.bufferSize.x, this.bufferSize.y);
  }

  /* ------------------------------------------------------------------ pointer / touch */

  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private groundMeshes: THREE.Object3D[] = [];
  private readonly hit = new THREE.Vector3();

  private pick(e: PointerEvent): THREE.Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    // The ground has heights, so hit-test its surface; fall back to the ground plane.
    const hits = this.ray.intersectObjects(this.groundMeshes, false);
    if (hits.length) return this.hit.copy(hits[0].point);
    return this.ray.ray.intersectPlane(this.groundPlane, this.hit);
  }

  private bindPointer(): void {
    // Three fingers at once on a touch screen: the developer console (no ` key on a tablet).
    this.canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 3 && this.devConsole.enabled) { e.preventDefault(); this.devConsole.toggle(); } }, { passive: false });
    this.canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && this.settings.tapToWalk) this.showCursor(this.pick(e)); });
    this.canvas.addEventListener('pointerleave', () => (this.cursor.visible = false));
    this.canvas.addEventListener('pointerdown', (e) => {
      // While a message is up, a tap anywhere advances it.
      if (this.message.isOpen) { if (!this.message.isChoosing) this.input.press('ok'); return; }
      if (this.interpreter.running || !this.settings.tapToWalk) return;
      const p = this.pick(e);
      if (!p) return;
      this.showCursor(p);
      const tx = Math.floor(p.x), tz = Math.floor(p.z);
      // Tall sprites cover the ground behind them, so a tap may land one tile "above" the event.
      const ev = this.actionEventAt(tx, tz) ?? this.actionEventAt(tx, tz + 1);
      this.pendingEvent = ev;
      const pp = this.player.position;
      this.moveTarget = ev ? (([x, z]) => ({ x, z }))(ev.nearest(pp.x, pp.z)) : { x: p.x, z: p.z };
    });
  }

  private showCursor(p: THREE.Vector3 | null): void {
    if (!p) { this.cursor.visible = false; return; }
    const tx = Math.floor(p.x), tz = Math.floor(p.z);
    if (!this.map.inMap(tx, tz)) { this.cursor.visible = false; return; }
    this.cursor.visible = true;
    this.cursor.position.set(tx + 0.5, this.map.surfaceY(tx + 0.5, tz + 0.5) + 0.02, tz + 0.5);
    const ev = this.actionEventAt(tx, tz) ?? this.actionEventAt(tx, tz + 1);
    this.cursor.material.color.set(ev ? '#ffcf7a' : this.tileBlocked(tx, tz) ? '#ff5a5a' : '#ffffff');
  }

  /* ------------------------------------------------------------------ events */

  private actionEventAt(x: number, z: number): GameEvent | null {
    return this.events.find((e) => e.covers(x, z) && e.trigger === 'action') ?? null;
  }

  /** Distance from the player to the centre of the event's nearest tile. */
  private eventDistance(ev: GameEvent): number {
    const p = this.player.position, [x, z] = ev.nearest(p.x, p.z);
    return Math.hypot(x - p.x, z - p.z);
  }

  private tileBlocked(x: number, z: number): boolean {
    return this.map.isBlocked(x, z) || this.events.some((e) => e.solid && e.covers(x, z));
  }

  private runEvent(ev: GameEvent): void {
    if (ev.page?.respawn) this.setRespawn();
    if (!ev.page || !ev.page.commands.length) return;
    if (ev.onMap) {
      ev.facePlayer(this.player.position.x, this.player.position.z);
      this.player.faceToward(...ev.nearest(this.player.position.x, this.player.position.z));
    }
    this.moveTarget = null;
    this.pendingEvent = null;
    this.setSpeaker(ev);
    this.interpreter.start(ev.page.commands);
  }

  /** Messages from this event float over it (or under it), as the player set in Settings. */
  private setSpeaker(ev: GameEvent | null): void {
    const pt = ev?.speakerPoint();
    if (!pt) { this.message.setSpeaker(null); return; }
    const at = (y: number) => { const p = this.projector(pt.x, y, pt.z); return p.on ? { x: p.x, y: p.y } : null; };
    this.message.setSpeaker({ head: () => at(pt.y + pt.height + 0.1), feet: () => at(pt.y - 0.05), character: pt.character });
  }

  private playerTile(): { x: number; z: number } {
    return { x: Math.floor(this.player.position.x), z: Math.floor(this.player.position.z) };
  }

  /* ------------------------------------------------------------------ frame */

  /** Frame timing for the FPS counter: smoothed frame time, and the slowest frame this second. */
  private fps = { el: null as HTMLElement | null, avg: 1 / 60, worst: 0, t: 0, frames: 0 };
  /** Build every shader the map needs before its first frame, so nothing stutters the first time it's seen. */
  private warmup = false;
  private shadowTick = 0;

  private updateFps(raw: number): void {
    const f = this.fps;
    if (!this.settings.showFps) { if (f.el) f.el.hidden = true; return; }
    if (!f.el) { f.el = document.createElement('div'); f.el.className = 'fps-meter'; f.el.setAttribute('aria-hidden', 'true'); this.ui.appendChild(f.el); }
    f.el.hidden = false;
    f.avg += (raw - f.avg) * 0.1;
    f.worst = Math.max(f.worst, raw);
    f.t += raw; f.frames++;
    if (f.t >= 0.5) {
      const fps = Math.round(f.frames / f.t);
      f.el.textContent = `${fps} FPS · ${(f.avg * 1000).toFixed(1)} ms · slowest ${(f.worst * 1000).toFixed(0)} ms`;
      f.el.dataset.level = fps >= 55 ? 'good' : fps >= 40 ? 'ok' : 'bad';
      f.t = 0; f.frames = 0; f.worst = 0;
    }
  }

  private frame(): void {
    const raw = this.clock.getDelta();
    this.updateFps(raw);
    const dt = Math.min(raw, 0.05);
    this.elapsed += dt;
    const paused = this.devConsole.isOpen || this.worldMap.isOpen || this.achScreen.isOpen || this.pauseShell.isOpen || this.menu.isOpen || this.saveScreen.isOpen || this.statusScreen.isOpen || this.equipScreen.isOpen || this.partyScreen.isOpen || this.charScreen.isOpen || this.creation.isOpen || this.bag.isOpen || this.shop.isOpen || this.skillScreen.isOpen || this.controls.isOpen || this.arranger.isOpen || this.creditsScreen.isOpen || this.logScreen.isOpen || this.questScreen.isOpen || this.recordsScreen.isOpen || this.bestiaryScreen.isOpen;
    // The controller's buttons mean different things in menus and on the field.
    // A turn-based battle holds the field still (the world stays on screen behind it).
    const fighting = this.battle.active && !paused;
    this.input.mode = paused || fighting || this.battlePending || this.message.isOpen || this.interpreter.running || this.onTitle || !!this.transfer || this.dying ? 'menu' : 'field';
    this.input.pollGamepad(dt);
    if (!paused && !fighting) { this.time.update(dt); this.playTime += dt; this.updateExplored(dt); }
    if (!this.devConsole.isOpen) { this.applyCheats(); this.checkAchievements(dt); }
    if (!paused && !fighting && this.battleGrace > 0) this.battleGrace = Math.max(0, this.battleGrace - dt);
    document.body.classList.toggle('in-battle', this.battle.active);

    this.message.update(dt);
    // Arrived after respawning: fade back in (the player can already move).
    if (this.transferFadeIn && !this.transfer) { this.transferFadeIn = false; this.fade = { from: 1, to: 0, t: 0, duration: 0.8 }; }
    if (paused) {
      // The topmost screen takes the keys: shop, then bag, then the menu under them. The console freezes everything.
      if (this.devConsole.isOpen) { /* typing */ }
      else if (this.creation.isOpen) this.creation.update();
      else if (this.worldMap.isOpen) this.worldMap.update(dt);
      else if (this.achScreen.isOpen) this.achScreen.update();
      else if (this.saveScreen.isOpen) this.saveScreen.update();
      else if (this.equipScreen.isOpen) this.equipScreen.update();
      else if (this.partyScreen.isOpen) this.partyScreen.update();
      else if (this.charScreen.isOpen) this.charScreen.update();
      else if (this.statusScreen.isOpen) this.statusScreen.update();
      else if (this.creditsScreen.isOpen) this.creditsScreen.update(dt);
      else if (this.logScreen.isOpen) this.logScreen.update(dt);
      else if (this.recordsScreen.isOpen) this.recordsScreen.update(dt);
      else if (this.bestiaryScreen.isOpen) this.bestiaryScreen.update();
      else if (this.questScreen.isOpen) this.questScreen.update();
      else if (this.arranger.isOpen) this.arranger.update(dt);
      else if (this.controls.isOpen) this.controls.update();
      else if (this.skillScreen.isOpen) this.skillScreen.update();
      else if (this.shop.isOpen) this.shop.update(); else if (this.bag.isOpen) this.bag.update(); else this.menu.update();
      this.player.animate(dt, false);
    }
    else if (fighting) {
      // LB / RB (Q / E): the next or previous battle camera.
      if (this.stage) { if (this.input.consume('tabNext')) this.cycleCamera(1); if (this.input.consume('tabPrev')) this.cycleCamera(-1); }
      this.battle.update(dt); this.stage?.stage.update(dt); this.player.animate(dt, false);
    }
    else if (this.battlePending) this.player.animate(dt, false);
    else if (this.updateDying(dt) || this.updateTransfer()) this.player.animate(dt, false);
    else if (this.interpreter.running) {
      this.interpreter.update(dt);
      this.player.animate(dt, false);
    } else {
      const auto = this.events.find((e) => e.trigger === 'auto' && !e.autoDone);
      if (auto) { auto.autoDone = true; this.runEvent(auto); }
      else {
        for (let k = 0; k < QUICK_SLOTS; k++) if (this.input.consume(`quick${k + 1}` as Action)) this.useQuick(k);
        this.updatePlayer(dt);
        this.updateParty(dt);
        this.updateEncounters();
      }
      this.updateFootsteps(dt);
      this.updateRipples(dt);
      this.updateTileAilment(dt);
      this.updateFires(dt);
    }
    // Quests: carried items count towards collect objectives; the tracker follows along.
    if (!paused && !this.onTitle) this.quests.itemsChanged();
    this.tracker.update(this.quests);
    // Orbs, gold and items on the ground: frozen while paused; picked up only while the hero is free to move.
    if (!paused && !fighting && this.pickups) {
      const p = this.player.position;
      this.pickups.update(dt, p.x, p.y, p.z, !this.onTitle && !this.interpreter.running && !this.dying && !this.transfer && this.player.mesh.visible);
    }
    if ((this.xpBurst > 0 || this.goldBurst > 0) && (this.xpBurstT += dt) > 0.45) { if (this.xpBurst > 0) this.flushXp(); this.flushGold(); }
    for (const e of this.events) e.update(dt);
    this.updateFade(dt);
    if (this.outro && this.fade.t >= 1) {
      const done = this.outro.done;
      this.outro = null;
      done();
      // Back on the field: the picture fades in as its music and sounds return.
      this.battleSound = null;
      this.fade = { from: 1, to: 0, t: 0, duration: 1.4 };
    }
    this.updateCamera(dt);
    this.updateBubbles();
    this.updateEnvironment(dt);
    if (!this.onTitle && !fighting) this.combat.updateBack();
    if (this.buildings.length) { const p = this.player.position; fadeBuildings(this.buildings, p.x, p.y, p.z, dt); }

    // Performance quality: shadows are redrawn every other frame (half the shadow work; moving shadows lag a frame).
    const sm = this.renderer.shadowMap;
    if (this.settings.quality === 'performance') { sm.autoUpdate = false; if ((this.shadowTick++ & 1) === 0) sm.needsUpdate = true; }
    else sm.autoUpdate = true;
    if (this.warmup) { this.warmup = false; try { this.renderer.compile(this.stage?.stage.scene ?? this.scene, this.camera); } catch { /* best effort */ } }
    // In a turn-based battle the world behind is frozen: draw it a few times as the battle opens, then leave the
    // last picture on screen (the battle screen draws over it), which keeps tablets cool.
    this.battleFrames = this.battle.active ? this.battleFrames + 1 : 0;
    // On a battle map the stage is drawn instead (every frame: its fighters move).
    if (!this.titleCovered && (this.stage || this.battleFrames < 4 || this.fade.t < 1)) {
      const scene = this.stage?.stage.scene ?? this.scene;
      this.ssao.render(scene, this.camera);
      this.post.render(scene, this.camera);
      if (this.snapWanted) {
        // Read the picture straight after drawing it (before the browser clears it).
        const c = document.createElement('canvas');
        c.width = this.canvas.width; c.height = this.canvas.height;
        c.getContext('2d')!.drawImage(this.canvas, 0, 0);
        const cb = this.snapWanted; this.snapWanted = null;
        cb(c);
      }
    }
    this.message.position();
    if (!this.onTitle) this.updateAudio(dt);
    this.hud.setRingActive(this.rings.active);
    this.hud.setRingKey(this.input.label('ring'));
    if (!this.faceShown) { this.portraitUrl ??= this.sprites.portrait('hero', this.db.characters[this.db.player], 48).toDataURL(); this.hud.setFace(this.portraitUrl); this.faceShown = true; }
    this.updateWeaponHud();
    this.hud.setQuick(this.inventory.quick.map((id) => {
      const d = id ? this.items.get(id) : undefined;
      return d ? { icon: this.itemIcon(d.id), name: d.name, count: this.inventory.count(d.id) } : null;
    }), [1, 2, 3].map((n) => this.input.label(`quick${n}` as Action)), this.quickDown());
    this.hud.setLevel(this.progress.level, this.progress.xp, this.progress.toNext);
    this.hud.setSeason(this.season ?? '');
    this.updateMinimap(dt);
    this.overlay.update(dt);
    this.hud.update(dt, this.stats, {
      time: this.time.label(this.settings.clock12), night: this.time.night, hour: this.time.hour,
      weather: { outdoor: 'Clear', indoor: 'Indoors', dark: 'Underground' }[this.time.environment],
      // The real-world date under the game time (and the season, outdoors).
      date: `${new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${this.season ? ` · ${SEASON_NAMES[this.season]}` : ''}`,
    });
    this.debug.update(dt, this.time.hour, this.time.label(), this.post.lastDrawCalls, this.state.toJSON());
    this.input.endFrame();
  }

  private updatePlayer(dt: number): void {
    const i = this.input;
    // A solid hit freezes the action for a moment.
    if (this.combat.hitStop > 0) { this.combat.hitStop -= dt; return; }
    const fromX = this.player.position.x, fromZ = this.player.position.z;
    // (While fishing, Talk / interact reels in instead: see updateFishing.)
    if (!this.fishing && i.consume('ok')) {
      const [fx, fz] = DIR_VECTOR[this.player.dir];
      const tx = Math.floor(this.player.position.x + fx * 0.75), tz = Math.floor(this.player.position.z + fz * 0.75);
      // A respawn prop counts even when an event sits on it too (a campfire you can also talk at).
      const ev = this.actionEventAt(tx, tz), rest = this.respawnPropAt(tx, tz), fire = ev ? null : this.fireAt(tx, tz);
      const forge = ev || fire ? null : this.forgeAt(tx, tz);
      if (rest) this.setRespawn();
      // A controller's A both talks and jumps: talking wins when there's something to talk to.
      if (ev || rest || fire || forge) i.consume('jump');
      if (ev) { this.runEvent(ev); return; }
      if (fire) { this.openFire(fire); return; }
      if (forge) { this.openForge(); return; }
      // Facing a fishing spot: cast (with a rod in the bag).
      if (!rest) {
        const spot = this.fishSpotAhead();
        if (spot) {
          i.consume('jump');
          const rod = this.bestRod();
          if (rod) this.startFishing(spot, rod); else this.menu.notice('A good fishing spot. You need a fishing rod.');
        }
      }
    }
    // Fishing: the hero stands still with the rod out (moving, jumping or attacking reels in).
    if (this.fishing) this.updateFishing(dt);
    if (i.consume('cancel') && !this.motion.airborne && !this.motion.climbing) { this.openPauseMenu(); return; }
    // B / F / 3: the key item assigned to it (a lantern…) switches on or off; otherwise cast the readied shard — a
    // field spell (Light, Water Walk) switches on or off; the rest fire a bolt.
    if (i.consume('ring') && !this.motion.climbing) {
      const tool = this.inventory.bTool;
      if (tool && this.inventory.count(tool) > 0) this.toggleTool(tool);
      // A learned spell readied in Menu → Abilities comes first; otherwise the shard in the magic slot.
      else if (this.readiedSpell()) this.combat.castShard();
      else if (this.rings.power) this.useRing();
      else if (this.inventory.equip.magic) this.combat.castShard();
      else this.menu.notice('No spell readied: equip a shard in Menu → Bag → Shards');
    }

    let dx = (i.isHeld('right') ? 1 : 0) - (i.isHeld('left') ? 1 : 0);
    let dz = (i.isHeld('down') ? 1 : 0) - (i.isHeld('up') ? 1 : 0);
    // A controller's stick walks at any angle.
    if (i.stick.x || i.stick.y) { dx = i.stick.x; dz = i.stick.y; }
    if (this.fishing) dx = dz = 0;
    if (dx || dz) { this.moveTarget = null; this.pendingEvent = null; }
    else if (this.moveTarget) {
      const p = this.player.position;
      if (this.pendingEvent && this.eventDistance(this.pendingEvent) < INTERACT_RANGE) {
        this.runEvent(this.pendingEvent);
        return;
      }
      const ex = this.moveTarget.x - p.x, ez = this.moveTarget.z - p.z, d = Math.hypot(ex, ez);
      if (d < 0.06) this.moveTarget = null;
      else { dx = ex / d; dz = ez / d; }
    }

    if (dx || dz) { const len = Math.hypot(dx, dz); dx /= len; dz /= len; }
    // Confused: the directions are scrambled. Frozen, paralysed, asleep or staggered: no moving or acting at all.
    [dx, dz] = this.combat.heroStatus.scramble(dx, dz);
    const stunned = this.combat.heroStunned;
    if (stunned) { dx = dz = 0; for (const a of ['jump', 'melee', 'bow', 'magic', 'attack', 'switchWeapon', 'ring'] as Action[]) i.consume(a); }
    const m = this.motion;
    // Space jumps, or dodges while locked on; 1–3 attack, Q / Tab lock on, C sneaks.
    const space = i.consume('jump');
    const dodged = stunned ? false : this.combat.handleInput(i, space, dx, dz);
    // With "Always run" on, Shift walks instead.
    // On a controller, pushing the stick all the way runs (Settings → Gameplay).
    const stickRun = this.settings.stickRun && i.stickAmount > 0.92;
    i.sprintToggle = this.settings.sprint === 'toggle';
    if (!i.sprintToggle) i.runLatched = false;
    const run = this.settings.alwaysRun ? !i.isHeld('run') : i.isHeld('run') || i.runLatched || i.touchRun || stickRun;
    const res = m.update(dt, { dx, dz, run, jump: space && !dodged, sneak: this.combat.sneaking, speedScale: this.combat.speedScale * this.cheats.speed });
    if (!m.airborne && !m.climbing && this.trySeamless(dx, dz)) return;
    // Locked on, the hero keeps facing the target (strafing); otherwise they face where they walk, unless attacking.
    const lock = this.combat.lock;
    if (lock) this.player.faceToward(lock.x, lock.z);
    else if (res.face && !this.combat.busy) this.player.faceVector(...DIR_VECTOR[res.face]);
    this.stats.update(dt, { running: m.running && res.moving, climbing: m.climbing, swimming: m.swimming, jumped: !!res.jumped, mpDrain: this.rings.mpDrain * this.spellThrift });
    // Out of magic: the ring's power fades.
    if (this.rings.active && this.rings.mpDrain > 0 && this.stats.mp <= 0) { this.rings.off(); this.menu.notice(`${this.rings.ring?.name ?? 'The spell'} fades: out of MP`); }
    // Water Walk switches itself off when the hero walks from water back onto land.
    if (this.rings.waterWalk) {
      const wet = !!this.map.waterAt(Math.floor(m.x), Math.floor(m.z));
      if (wet) this.tideOnWater = true;
      else if (this.tideOnWater && !m.airborne) {
        this.rings.off(); this.tideOnWater = false;
        this.audio.play('ringOff');
        this.menu.notice(`${this.rings.ring?.name ?? 'Water Walk'} off: back on land`);
      }
    }
    if (res.jumped) { this.audio.play('jump'); this.state.tally('jumps'); }
    if (m.swimming && !this.wasSwimming) this.audio.play('splash', m.x, m.z);
    this.wasSwimming = m.swimming;
    this.combat.setMoving(res.moving);
    this.combat.toolsOff = this.state.weaponsOff;
    this.combat.update(dt);
    if (this.stats.dead) { this.die(); return; }
    if (res.fell) {
      // Missed the jump: a quick blink back to where it started.
      this.post.fade = 1;
      this.fade = { from: 1, to: 0, t: 0, duration: 0.4 };
      this.moveTarget = null;
      this.pendingEvent = null;
    }
    this.blockedFor = res.blocked ? this.blockedFor + dt : 0;
    // Give a blocked walk a moment first: pushing against a climbable wall starts a climb.
    if (this.blockedFor > 0.35 && this.moveTarget) {
      // Blocked: if we were walking to an event and got close, talk to it; otherwise give up.
      const pe = this.pendingEvent;
      if (pe && this.eventDistance(pe) < INTERACT_RANGE + 0.5) { this.syncPlayer(); this.runEvent(pe); return; }
      this.moveTarget = null;
      this.pendingEvent = null;
    }
    // Animated sheets have their own run, jump, climb and combat-stance animations; walk-only sheets speed up instead.
    if (this.player.animated) this.player.animate(dt * (m.crawling ? 0.7 : 1), { moving: res.moving, running: m.running, airborne: m.airborne, climbing: m.climbing, combat: this.combat.locked });
    else this.player.animate(dt * (m.running ? 1.6 : m.crawling ? 0.7 : 1), res.moving && !m.airborne);
    this.syncPlayer(dt);
    if (m.airborne || m.climbing) return;

    // Touch triggers fire when the player steps onto a new tile.
    const t = this.playerTile();
    if (t.x !== this.lastTile.x || t.z !== this.lastTile.z) {
      this.lastTile = t;
      const ev = this.events.find((e) => e.covers(t.x, t.z) && e.trigger === 'touch');
      if (ev) { this.runEvent(ev); return; }
    }
    // ...or when the player walks into one that can't be stepped onto (solid, or up on a wall: a cave mouth, a door),
    // pushing against it for a moment.
    const p = this.player.position, push = Math.hypot(dx, dz);
    const stuck = Math.hypot(p.x - fromX, p.z - fromZ) < dt * 0.6;
    const ax = push ? Math.floor(p.x + (dx / push) * 0.6) : t.x, az = push ? Math.floor(p.z + (dz / push) * 0.6) : t.z;
    const ahead = push && stuck && (ax !== t.x || az !== t.z) ? this.events.find((e) => e.trigger === 'touch' && e.covers(ax, az)) : undefined;
    if (ahead && (ahead.solid || this.map.step(ax, az) !== this.map.step(t.x, t.z) || this.map.isBlocked(ax, az))) {
      if ((this.bumpT += dt) > 0.15) { this.bumpT = 0; this.runEvent(ahead); }
    } else this.bumpT = 0;
  }

  /** Out of health: fade out, then back to the respawn point with full stats. */
  private die(): void {
    if (this.dying) return;
    this.dying = 1;
    // Out of health while swimming: the hero sinks under and drowns.
    this.drowning = this.motion.swimming;
    if (this.drowning) { this.audio.play('splash', this.motion.x, this.motion.z); this.log.add('You sink beneath the water…', 'hurt'); }
    this.state.tally('deaths');
    this.rings.off();
    this.combat.reset();
    // Animated sheets fall down (the hurt animation) and stay down while the screen fades.
    this.player.play('hurt', 0.55, 0, () => this.player.hold('hurt', 5));
    this.moveTarget = null;
    this.pendingEvent = null;
    this.fade = { from: this.post.fade, to: 1, t: 0, duration: this.drowning ? 1.6 : 0.6 };
  }
  private drowning = false;

  /* ------------------------------------------------------------------ respawn points, saving */

  /** Is there a prop marked "Is respawn point" on this tile? */
  private respawnPropAt(x: number, z: number): boolean {
    return this.mapData.props.some((p) => {
      const d = this.sprites.def(p.type);
      if (!d?.respawn) return false;
      return propCovers(d, p, x, z);
    });
  }

  /** Come back here after losing all health: where the player stands now. */
  /** A full rest: health, magic and stamina to full, ailments cured (Zombie needs its own cure). */
  private fullRest(quiet = false): void {
    this.stats.refill();
    for (const a of this.allies) { const n = this.allyNumbers(a.data, a.def); a.data.hp = n.max.hp; a.data.mp = n.max.mp; a.data.down = false; a.sprite.hold(null); a.sprite.mesh.rotation.z = 0; }
    for (const m of this.party.members) if (!this.allies.some((a) => a.data === m)) { m.down = false; m.hp = this.stats.cfg.max.hp; m.mp = this.stats.cfg.max.mp; }
    this.combat.heroStatus.cure(['all']);
    const p = this.player.position;
    this.bursts.spawn(p.x, p.y + 0.6, p.z, { color: '#9be8a0', n: 20, speed: 1.2, up: 2.4, life: 0.8, size: 0.08, gravity: -0.5, additive: true });
    this.audio.play('save');
    if (!quiet) { this.menu.notice('Rested: health, magic and stamina restored'); this.state.tally('rests'); }
  }

  private setRespawn(): void {
    const p = this.motion;
    const already = this.respawnPoint && this.respawnPoint.map === this.mapName && Math.hypot(this.respawnPoint.x - p.x, this.respawnPoint.z - p.z) < 1.5;
    this.respawnPoint = { map: this.mapName, x: p.x, z: p.z, dir: this.player.dir };
    if (!already) this.menu.notice('Respawn point set');
  }

  private snapshot(): SaveData {
    return {
      version: SAVE_VERSION, savedAt: Date.now(), playTime: this.playTime,
      map: this.mapName, mapTitle: this.mapData.name || this.mapName,
      x: this.motion.x, z: this.motion.z, dir: this.player.dir, hour: this.time.hour,
      state: this.state.toJSON(),
      gauges: { hp: this.stats.hp, mp: this.stats.mp, sp: this.stats.sp },
      ...(this.combat.heroStatus.list.length ? { status: this.combat.heroStatus.toJSON() } : {}),
      inventory: this.inventory.toJSON(),
      progress: this.progress.toJSON(),
      ...(this.party.members.length ? { party: this.party.toJSON() } : {}),
      ...(this.heroAt ? { heroAt: this.heroAt } : {}),
      ...(this.visited.size ? { visited: [...this.visited] } : {}),
      ...(this.explored.size ? { explored: Object.fromEntries([...this.explored].map(([k, e]) => [k, { w: e.w, h: e.h, bits: e.toString() }])) } : {}),
      quests: this.quests.toJSON(),
      respawn: this.respawnPoint,
    };
  }

  private saveTo(slot: SlotId, quiet = false): boolean {
    // Anything still on the ground is collected first, so it's in the save.
    this.bankPickups('save');
    const ok = this.saves.write(slot, this.snapshot());
    if (ok) this.saves.writeShot(slot, this.captureShot());
    if (ok && !quiet) this.audio.play('save');
    if (!quiet || !ok) this.menu.notice(ok ? `Saved to ${slotLabel(slot)}` : 'Couldn’t save: the browser refused to store it');
    return ok;
  }

  /** Bug notes from the console (kept in this browser until downloaded and cleared). */
  private bugNotes(): Record<string, unknown>[] {
    try { const v = JSON.parse(localStorage.getItem('hd2d.bugNotes') ?? '[]') as unknown; return Array.isArray(v) ? v as Record<string, unknown>[] : []; } catch { return []; }
  }
  private saveBugNotes(list: Record<string, unknown>[]): void {
    // Pictures are dropped from the oldest notes if the browser runs out of room.
    for (let k = 0; k <= list.length; k++) {
      try { localStorage.setItem('hd2d.bugNotes', JSON.stringify(list)); return; } catch { if (list[k]) delete list[k].shot; }
    }
  }

  /** A small picture of the scene right now (no menus or HUD: they're not in the 3D view), for the save screen. */
  private captureShot(): string | null {
    try {
      // Drawn now, then read straight back (the view is only readable until the browser shows it).
      this.ssao.render(this.scene, this.camera);
      this.post.render(this.scene, this.camera);
      const src = this.renderer.domElement, W = 320, H = 180, c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d')!;
      // Cover: crop the middle of the view to 16:9.
      const k = Math.min(src.width / W, src.height / H), sw = W * k, sh = H * k;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, H);
      return c.toDataURL('image/jpeg', 0.72);
    } catch { return null; }
  }

  /** Load a save: fade out, rebuild its map with everything as it was, fade in. */
  private loadSave(d: SaveData): void {
    this.battle.abort();
    this.battleSound = null; this.outro = null;
    // Loading from the title (Continue or Load Game) leaves the title: hero, status bars and camera come back,
    // the HUD fading in with the picture.
    const fromTitle = this.onTitle;
    if (fromTitle) { this.onTitle = false; document.body.classList.add('ui-dim'); this.setTitleLook(false); }
    this.menu.close();
    this.interpreter.stop();
    this.requestTransfer(d.map, { x: d.x, z: d.z, dir: d.dir }, 'black', {
      slow: fromTitle,
      after: () => this.uiIn(),
      before: () => {
        this.bankPickups('discard');
        this.log.clearFeed();
        this.state.load(d.state);
        this.applyForge();
        this.stats.refill();
        this.stats.change('hp', 'set', d.gauges.hp);
        this.stats.change('mp', 'set', d.gauges.mp);
        this.stats.change('sp', 'set', d.gauges.sp);
        this.time.set(d.hour, true);
        this.respawnPoint = d.respawn;
        this.inventory.load(d.inventory ?? Inventory.fresh(this.db).toJSON(), this.bagSize);
        this.fixEquipSlots();
        this.progress.load(d.progress, this.heroBase());
        this.party.load(d.party);
        this.heroAt = Math.max(0, Math.round(Number(d.heroAt) || 0));
        this.visited = new Set(d.visited ?? []);
        this.explored = new Map(Object.entries(d.explored ?? {}).map(([k, e]) => [k, new Explored(e.w, e.h, e.bits)]));
        this.ensureWornInBag();
        // Saves from before party members had skill trees: the skill points their levels would have given.
        for (const m of this.party.members) if (m.skillPoints === undefined) { m.skillPoints = (m.level - 1) * this.combatCfg.pointsPerLevel; m.skills ??= {}; }
        this.combat.heroStatus.load(d.status);
        this.quests.load(d.quests);
        this.syncSkills();
        this.rings.off();
        this.refreshRing();
        this.playTime = d.playTime;
      },
    });
  }

  /* ------------------------------------------------------------------ items */

  private get bagSize(): number { return Math.max(1, Math.min(96, this.db.inventory?.slots ?? DEFAULT_BAG_SLOTS)); }

  /** Icons for every item: built-in pixel art, or the imported image (as a data URL for the menus). */
  private async loadItemIcons(resolve: (p: string) => string): Promise<void> {
    this.items.clear();
    this.baseItems.clear();
    for (const d of this.db.items ?? []) { this.items.set(d.id, d); this.baseItems.set(d.id, d); }
    await Promise.all([...this.items.values()].map(async (d) => {
      const name = builtinIconName(d.icon);
      let c: HTMLCanvasElement;
      if (d.icon === 'sprite') c = this.sprites.weaponIcon(itemWeaponSprite(d)) ?? builtinIcon(d.slot === 'ranged' ? 'bow' : d.slot === 'shield' ? 'shield' : 'sword');
      else if (name || !d.icon) c = builtinIcon(name ?? 'bag');
      else { try { c = await loadCanvas(resolve(d.icon)); } catch { c = builtinIcon('?'); console.warn(`${d.name}: icon “${d.icon}” is missing`); } }
      this.icons.set(d.id, c.toDataURL());
      this.iconCanvases.set(d.id, c);
    }));
    this.applyForge();
  }

  /** Items as the database defines them (`items` holds them as forged: upgraded, enchanted). */
  private readonly baseItems = new Map<string, ItemDef>();

  /** Swap in the forged version of every upgraded or enchanted item (after loading, forging, starting over). */
  private applyForge(): void {
    const rules = forgeRules(this.db.combat);
    for (const [id, base] of this.baseItems) {
      const e = this.state.forge.get(id);
      this.items.set(id, e ? forgedDef(base, e, e.shard ? this.baseItems.get(e.shard) : undefined, rules) : base);
    }
  }

  private itemIcon(id: string): string {
    return this.icons.get(id) ?? builtinIcon('?').toDataURL();
  }

  /**
   * Use a consumable: cure ailments, restore health / magic / stamina, give buffs. Nothing is used up if it would do
   * nothing. A zombie is hurt by healing (cures come first, so curing Zombie and healing in one item heals).
   */
  private useItem(i: number, who = 0): string | null {
    const s = this.inventory.slots[i], d = s && this.items.get(s.id);
    if (!s || !d || d.kind !== 'consumable') return null;
    if (who > 0) {
      // On a party member: what it restores (they have no ailments or buffs of their own).
      const m = this.members()[who - 1];
      if (!m || m.data.down) return null;
      const max = this.allyNumbers(m.data, m.def).max, got: string[] = [];
      for (const g of ['hp', 'mp', 'sp'] as const) {
        const v = d.restore?.[g];
        if (!v) continue;
        const before = m.data[g];
        m.data[g] = Math.min(max[g], before + (d.restorePercent ? (max[g] * v) / 100 : v));
        const n = Math.round(m.data[g] - before);
        if (n > 0) got.push(`+${n} ${g.toUpperCase()}`);
      }
      if (!got.length) return `${d.name} wouldn’t do anything for ${m.def.name} right now.`;
      this.inventory.removeAt(i, 1);
      this.state.tally('itemsUsed');
      const a = this.allies.find((x) => x.data === m.data);
      if (a) this.bursts.spawn(a.x, a.y + 0.6, a.z, { color: '#9dffb0', n: 14, speed: 1, up: 2, life: 0.6, size: 0.08, additive: true });
      return `${m.def.name} used ${d.name}: ${got.join(', ')}.`;
    }
    const st = this.combat.heroStatus;
    const gains: string[] = [];
    if (d.cures?.length) {
      const cured = st.cure(d.cures);
      if (cured.length) gains.push(`cured ${cured.map(effectName).join(', ')}`);
    }
    for (const g of ['hp', 'mp', 'sp'] as const) {
      const v = d.restore?.[g];
      if (!v) continue;
      const amount = d.restorePercent ? (this.stats.cfg.max[g] * v) / 100 : v, before = this.stats[g];
      if (g === 'hp' && st.zombie) {
        this.stats.change('hp', 'add', -amount);
        const lost = Math.round(before - this.stats.hp);
        if (lost > 0) { gains.push(`−${lost} HP (healing hurts a zombie!)`); this.audio.play('hurt'); }
        continue;
      }
      this.stats.change(g, 'add', amount);
      const got = Math.round(this.stats[g] - before);
      if (got > 0) gains.push(`+${got} ${g.toUpperCase()}`);
    }
    for (const b of d.buffs ?? []) { st.boost(b.buff, b.amount, b.seconds); gains.push(`${BUFF_INFO[b.buff].name} up`); }
    if (!gains.length) return `${d.name} wouldn’t do anything right now.`;
    this.inventory.removeAt(i, 1);
    this.state.tally('itemsUsed');
    return `Used ${d.name}: ${gains.join(', ')}.`;
  }

  private equipItem(i: number): string | null {
    const s = this.inventory.slots[i], d = s && this.items.get(s.id);
    if (!d?.slot || d.kind !== 'equipment') return null;
    if (this.inventory.equip[d.slot] === s!.id) return `${d.name} is already on.`;
    if (!this.freeCopy(s!.id)) return `All of those are in use.`;
    this.inventory.equipFrom(i);
    this.refreshRing();
    return `Equipped ${d.name}.`;
  }

  // ---------------------------------------------------------------- seasons
  /** The season shown now (null: none, indoors or with seasons off), and whether this map was built in winter. */
  private season: Season | null = null;
  private mapWinter = false;
  /** A season picked in the playtest panel (overrides the day's). */
  private seasonTest: Season | null = null;

  /** The season here: the map's own, the test pick, or the day's; none indoors or with seasons off. */
  private seasonNow(): Season | null {
    const d = this.mapData;
    if (!d || (d.environment ?? 'outdoor') !== 'outdoor') return null;
    if (d.season) return d.season;
    if (this.seasonTest) return this.seasonTest;
    const cfg = this.db.time?.seasons;
    if (cfg?.off) return null;
    // By default the seasons are the real world's (from the player's date); or they follow the in-game days.
    if ((cfg?.mode ?? 'real') !== 'days') return realSeason(new Date(), cfg?.mode === 'realSouth');
    return seasonOn(Math.floor(this.state.clock / 24), cfg);
  }

  /** Is water of this style frozen over? Still, non-glowing water in winter. */
  private frozen(style: number): boolean {
    if (this.season !== 'winter') return false;
    const st = waterStyle(this.mapData, style);
    return !(st.flow ?? 0) && !(st.glow ?? 0);
  }

  /** Each frame: a new season recolours everything; into or out of winter rebuilds the map (ice on still water). */
  private updateSeason(): void {
    if (this.transfer || this.dying || !this.level) return;
    const now = this.seasonNow();
    if (now === this.season) return;
    const was = this.season;
    this.season = now;
    setSeason(now);
    if (now === 'winter' || was === 'winter') {
      if (this.mapData.water?.length && (now === 'winter') !== this.mapWinter) {
        const p = this.motion;
        // A quick fade while the map is rebuilt (with its water frozen over, or thawed).
        this.requestTransfer(this.mapName, { x: p.x, z: p.z, dir: this.player.dir }, 'black', { fresh: true });
      }
    }
    if (was && now) this.log.add(`${SEASON_NAMES[now]} has come`, 'info');
    this.updateAudio(0);
  }

  /** A hero's colour (0: the hero you play, then party members): from the database, or one of a few defaults. */
  private heroColor(h: number): string {
    const DEFAULTS = ['#e8b04a', '#5aa8ff', '#7cd66a', '#e87ad0', '#ff8a5a'];
    const def = h ? this.members()[h - 1]?.def : mainHero(this.db);
    const k = h ? Math.max(0, (this.db.heroes ?? []).findIndex((x) => x.id === def?.id)) : 0;
    return def?.color || DEFAULTS[k % DEFAULTS.length];
  }

  /** The party beside the bag: everyone's face, gauges and ailments. */
  private partyCards(): NonNullable<ReturnType<NonNullable<InventoryActions['party']>>> {
    if (!this.members().length) return [];
    const ail = (ids: EffectId[]) => ids.map((id) => ({ name: effectName(id), icon: statusIconUrl(id) }));
    this.portraitUrl ??= this.sprites.portrait('hero', this.db.characters[this.db.player], 48).toDataURL();
    const st = this.combat.heroStatus;
    return [{ name: mainHero(this.db).name, color: this.heroColor(0), portrait: this.portraitUrl, level: this.progress.level,
      hp: [this.stats.hp, this.stats.cfg.max.hp] as [number, number], mp: [this.stats.mp, this.stats.cfg.max.mp] as [number, number],
      ailments: ail(st.list.map((e) => e.id)) },
    ...this.members().map((m, k) => {
      const mx = this.allyNumbers(m.data, m.def).max;
      return { name: m.def.name, color: this.heroColor(k + 1), portrait: this.memberPortrait(m.def), level: m.data.level, down: !!m.data.down,
        hp: [m.data.hp, mx.hp] as [number, number], mp: [m.data.mp, mx.mp] as [number, number], ailments: [] };
    })];
  }

  /** What a piece of gear would change for each hero who can use it (null: they're wearing it). */
  private compareGear(i: number): { name: string; color: string; lines: string[] | null }[] {
    const id = this.inventory.slots[i]?.id, d = id ? this.items.get(id) : undefined;
    if (!id || !d || (d.kind !== 'equipment' && d.kind !== 'ammo') || d.slot === 'magic') return [];
    const host = this.equipHost(), g = host.gear(true).find((x) => x.id === id);
    if (!g) return [];
    const out: { name: string; color: string; lines: string[] | null }[] = [];
    host.heroes().forEach((x, h) => {
      if (!g.users[h]) return;
      const worn = host.slots(h).some((sl) => sl.item?.id === id);
      if (worn) { out.push({ name: x.name, color: this.heroColor(h), lines: null }); return; }
      const now = host.view(h), next = host.view(h, { slot: g.slot, id });
      const lines: string[] = [];
      const add = (label: string, a: number, b: number, unit = '') => { const dv = Math.round(b - a); if (dv) lines.push(`${dv > 0 ? '+' : '−'}${Math.abs(dv)}${unit} ${label}`); };
      for (const k of ATTRS) add(ATTR_INFO[k].short, now.attrs[k], next.attrs[k]);
      add('melee', now.melee, next.melee); add('bow', now.bow, next.bow); add('crit', now.crit, next.crit, '%');
      add('DEF', now.armour, next.armour); add('M.DEF', now.magicArmour, next.magicArmour);
      out.push({ name: x.name, color: this.heroColor(h), lines });
    });
    return out;
  }

  // ---------------------------------------------------------------- worn things stay in the bag
  /**
   * Everyone using a copy of an item: the hero and party members wearing it (or with the shard readied), and gear a
   * shard is set in. Each holds one copy in the bag; `off` lets go of it (takes it off, takes the shard out).
   */
  private wearers(id: string): { label: string; who: string; off: () => void }[] {
    const out: { label: string; who: string; off: () => void }[] = [];
    const heroName = mainHero(this.db).name;
    for (const slot of EQUIP_SLOTS) if (this.inventory.equip[slot] === id) out.push({ label: heroName, who: 'hero:0', off: () => { delete this.inventory.equip[slot]; } });
    this.members().forEach((m, k) => {
      for (const slot of EQUIP_SLOTS) if (m.data.equip[slot] === id) out.push({ label: m.def.name, who: `hero:${k + 1}`, off: () => { delete m.data.equip[slot]; } });
    });
    for (const [gid, e] of this.state.forge) if (e.shard === id) out.push({ label: `In ${this.items.get(gid)?.name ?? gid}`, who: `gear:${gid}`, off: () => {
      const n = { ...e }; delete n.shard;
      if (n.level) this.state.forge.set(gid, n); else this.state.forge.delete(gid);
    } });
    return out;
  }

  /** Who uses each bag slot's copy (bag slot → their name, or "In <weapon>"), in bag order. */
  private slotWearers(): Map<number, { label: string; who: string }> {
    const out = new Map<number, { label: string; who: string }>(), byId = new Map<string, number[]>();
    this.inventory.slots.forEach((st, i) => { if (st) { const l = byId.get(st.id) ?? []; l.push(i); byId.set(st.id, l); } });
    for (const [id, slots] of byId) {
      const w = this.wearers(id);
      w.forEach((x, k) => { if (slots[k] !== undefined) out.set(slots[k], { label: x.label, who: x.who }); });
    }
    return out;
  }

  /** Is there a copy of `id` free to put on (not counting the one in slot `i` if that's in use by someone else)? */
  private freeCopy(id: string): boolean { return this.inventory.free(id) > 0; }

  /** Copies left the bag (dropped, sold, taken): whoever used one that's gone takes it off. */
  private reconcileWorn(): void {
    let changed = false;
    const ids = new Set<string>([...EQUIP_SLOTS.map((s) => this.inventory.equip[s]), ...this.members().flatMap((m) => Object.values(m.data.equip)), ...[...this.state.forge.values()].map((e) => e.shard)].filter((x): x is string => !!x));
    for (const id of ids) {
      const w = this.wearers(id);
      for (let k = w.length - 1; k >= this.inventory.count(id); k--) { w[k].off(); changed = true; }
    }
    if (changed) { this.applyForge(); this.refreshRing(); }
  }

  /** Everything worn has its copy in the bag (older saves kept worn things out of it; joining heroes bring their gear). */
  private ensureWornInBag(): void {
    const ids = new Set<string>([...EQUIP_SLOTS.map((s) => this.inventory.equip[s]), ...this.members().flatMap((m) => Object.values(m.data.equip)), ...[...this.state.forge.values()].map((e) => e.shard)].filter((x): x is string => !!x && this.items.has(x)));
    for (const id of ids) {
      const missing = this.wearers(id).length - this.inventory.count(id);
      if (missing > 0) this.inventory.add(id, missing);
    }
    this.reconcileWorn();
  }

  /** Equipment: the slots; pick one to change what's in it. */
  /** The equipment screen's view of the hero: slots, what fits them, and the numbers with a change tried on. */
  private equipHost(): EquipHost {
    const NAMES: Record<EquipSlotId, string> = { weapon: 'Weapon', shield: 'Shield', ranged: 'Bow', magic: 'Spell shard', armor: 'Armor', accessory: 'Accessory', ammo: 'Arrows' };
    const choice = (id: string, count?: number): EquipChoice => {
      const d = this.items.get(id);
      const detail = d?.weapon ? `${d.weapon.damage} damage${d.weapon.class !== 'bow' ? ` · ${d.weapon.class}` : ''}` : d?.spell ? `${d.spell.damage} damage · ${d.spell.mp} MP` : d?.ammo ? `+${d.ammo.damage} damage${d.ammo.infinite ? ' · never run out' : ''}`
        : d?.defense || d?.magicDefense ? `${d.defense ? `+${d.defense} defence` : ''}${d.defense && d.magicDefense ? ' · ' : ''}${d.magicDefense ? `+${d.magicDefense} magic defence` : ''}` : d?.spell?.power ? `${POWER_NAMES[d.spell.power]} · ${d.spell.mp ? `${d.spell.mp} MP to start · ` : ''}${d.spell.mpPerSecond ?? 0} MP/s` : d?.description;
      const sh = this.state.forge.get(id)?.shard;
      return { id, name: d?.name ?? id, icon: this.itemIcon(id), color: itemColor(d), detail, count, shard: sh ? { icon: this.itemIcon(sh), name: this.baseItems.get(sh)?.name ?? sh } : null };
    };
    const heroIds = () => [mainHero(this.db).id, ...this.members().map((m) => m.def.id)];
    // Can hero h wear it? Items can be kept to some heroes (Database → Items → Who can use it); arrows are the hero's.
    const canUse = (h: number, id: string, slot?: EquipSlotId) => {
      const d = this.items.get(id);
      if (slot === 'ammo' || d?.kind === 'ammo') return h === 0;
      return !d?.users?.length || d.users.includes(heroIds()[h]);
    };
    const WORN = EQUIP_SLOTS.filter((x) => x !== 'magic');
    return {
      heroes: () => {
        const hero = mainHero(this.db);
        this.portraitUrl ??= this.sprites.portrait('hero', this.db.characters[this.db.player], 48).toDataURL();
        return [{ id: hero.id, name: hero.name, level: this.progress.level, portrait: this.portraitUrl },
          ...this.members().map((m) => ({ id: m.def.id, name: m.def.name, level: m.data.level, portrait: this.memberPortrait(m.def) }))];
      },
      // Spell shards are readied in the bag's Shards tab, not here.
      slots: (h) => h ? WORN.map((slot) => { const m = this.members()[h - 1]?.data, id = m?.equip[slot]; return { slot: slot as EquipSlotId, label: NAMES[slot], item: id ? choice(id) : null }; }) : [...WORN.map((slot) => ({ slot: slot as EquipSlotId, label: NAMES[slot], item: this.inventory.equip[slot] ? choice(this.inventory.equip[slot]!) : null })),
        { slot: 'ammo' as EquipSlotId, label: NAMES.ammo, item: this.inventory.arrow() ? choice(this.inventory.arrow()!, this.inventory.count(this.inventory.arrow()!)) : null }],
      choices: (h, slot) => {
        const seen = new Map<string, number>();
        for (const st of this.inventory.slots) {
          const d = st && this.items.get(st.id);
          if (!d || !st || !canUse(h, st.id, slot)) continue;
          if (slot === 'ammo' ? d.kind === 'ammo' && st.id !== this.inventory.arrow() : d.kind === 'equipment' && d.slot === slot) seen.set(st.id, (seen.get(st.id) ?? 0) + st.n);
        }
        // Only copies nobody is using (worn things stay in the bag, in use).
        return [...seen].map(([id, n]) => [id, slot === 'ammo' ? n : this.inventory.free(id)] as [string, number]).filter(([, n]) => n > 0).map(([id, n]) => choice(id, n));
      },
      gear: (all = false) => {
        const seen = new Map<string, number>(), n = heroIds().length;
        for (const i of [...this.inventory.pocketSlots('weapon'), ...this.inventory.pocketSlots('armor')]) {
          const st = this.inventory.slots[i], d = st && this.items.get(st.id);
          if (!st || !d || (d.kind !== 'equipment' && d.kind !== 'ammo')) continue;
          if (d.kind === 'ammo' && st.id === this.inventory.arrow()) continue;
          seen.set(st.id, (seen.get(st.id) ?? 0) + st.n);
        }
        if (!all) for (const [id] of seen) { const d = this.items.get(id)!; if (d.kind !== 'ammo') { const f = this.inventory.free(id); if (f > 0) seen.set(id, f); else seen.delete(id); } }
        return [...seen].map(([id, count]) => {
          const d = this.items.get(id)!, slot: EquipSlotId = d.kind === 'ammo' ? 'ammo' : (d.slot as EquipSlotId) ?? 'accessory';
          return { ...choice(id, count), slot, users: Array.from({ length: n }, (_, h) => canUse(h, id, slot)) };
        });
      },
      view: (h, change) => {
        const mem = h ? this.members()[h - 1] : null;
        if (mem) {
          const gear = { ...mem.data.equip };
          if (change && change.slot !== 'ammo') { if (change.id) gear[change.slot as EquipSlot] = change.id; else delete gear[change.slot as EquipSlot]; }
          const n = this.allyNumbers({ ...mem.data, equip: gear }, mem.def), t = heroTotals(mem.data.stats, this.wornGear(gear), (k) => this.memberSkills(mem.data).get(k));
          return { ...t, melee: n.melee, bow: n.bow, spell: n.spell };
        }
        const gear = { ...this.inventory.equip };
        let arrow = this.inventory.arrow();
        if (change?.slot === 'ammo') arrow = change.id;
        else if (change) { if (change.id) gear[change.slot as EquipSlot] = change.id; else delete gear[change.slot as EquipSlot]; }
        const t = this.heroTotals(gear);
        const w = gear.weapon ? this.items.get(gear.weapon) : undefined, cls = w?.weapon && w.weapon.class !== 'bow' ? w.weapon.class : 'unarmed';
        const melee = (cls === 'unarmed' ? this.combatCfg.unarmedDamage : w!.weapon!.damage) * this.combatCfg.classes[cls].damage * powerMultiplier(t.attrs.str);
        const bowDef = gear.ranged ? this.items.get(gear.ranged) : undefined, ammo = arrow ? this.items.get(arrow) : undefined;
        const bow = bowDef?.weapon ? (bowDef.weapon.damage + (ammo?.ammo?.damage ?? 0)) * powerMultiplier(t.attrs.str) : 0;
        const shard = gear.magic ? this.items.get(gear.magic) : undefined;
        const spell = shard?.spell ? (shard.spell.damage ?? this.combatCfg.fire.damage) * powerMultiplier(t.attrs.mag) : 0;
        return { ...t, melee, bow, spell };
      },
      style: (h) => {
        const mem = h ? this.members()[h - 1] : null;
        if (!mem) return null;
        const n = this.allyNumbers(mem.data, mem.def), real = fightingStyle(mem.def, mem.data, n), want = mem.data.style ?? mem.def.ai ?? 'fighter';
        const why: Record<AllyStyle, string> = { fighter: 'no melee weapon', archer: 'no bow', caster: 'no spell shard', healer: '' };
        return { value: want, options: (Object.keys(STYLE_NAMES) as AllyStyle[]).map((k) => [k, STYLE_NAMES[k]] as [string, string]),
          note: real !== want ? `${why[want]}: fights with ${STYLE_NAMES[real].toLowerCase()} for now` : undefined };
      },
      setStyle: (h, v) => { const mem = h ? this.members()[h - 1] : null; if (mem) mem.data.style = v as AllyStyle; },
      equip: (h, slot, id) => {
        if (id && !canUse(h, id, slot)) return `They can’t use ${this.items.get(id)?.name ?? id}.`;
        const mem = h ? this.members()[h - 1] : null;
        if (mem) return this.equipMember(mem.data, slot as EquipSlot, id);
        if (slot === 'ammo') { this.inventory.ammo = id; return id ? `Shooting ${this.items.get(id)?.name ?? id} now.` : 'Back to your plain arrows.'; }
        const s = slot as EquipSlot;
        if (!id) { this.inventory.unequip(s); this.refreshRing(); return 'Taken off.'; }
        const i = this.inventory.slots.findIndex((st) => st?.id === id);
        if (i < 0 || this.inventory.equip[s] !== id && this.inventory.free(id) < 1) return 'All of those are in use.';
        if (!this.inventory.equipFrom(i)) return null;
        this.refreshRing();
        return `Equipped ${this.items.get(id)?.name ?? id}.`;
      },
    };
  }
  /** Whose skill tree the Skill Tree screen shows (0: the hero, then party members). */
  private skillHero = 0;
  private portraitUrl: string | null = null;
  private faceShown = false;
  private memberPortraits = new Map<string, string>();
  private memberPortrait(def: HeroDef): string {
    let u = this.memberPortraits.get(def.id);
    if (!u) { u = this.sprites.portrait(`ally:${def.id}`, this.db.characters[def.look ?? ''] ?? this.db.characters[this.db.player], 48).toDataURL(); this.memberPortraits.set(def.id, u); }
    return u;
  }

  /** The party members with their database entries (any whose hero was deleted from the database are skipped). */
  private members(): { data: MemberData; def: HeroDef }[] {
    const out: { data: MemberData; def: HeroDef }[] = [];
    for (const m of this.party.members) { const def = this.db.heroes?.find((x) => x.id === m.id); if (def) out.push({ data: m, def }); }
    return out;
  }

  /** Put something from the bag on a party member (null takes it off); what they wore goes back in the bag. */
  private equipMember(m: MemberData, slot: EquipSlot, id: string | null): string | null {
    const old = m.equip[slot];
    if (!id) {
      if (!old) return null;
      delete m.equip[slot];
      return 'Taken off.';
    }
    if (old === id) return null;
    if (this.inventory.free(id) < 1) return 'All of those are in use.';
    m.equip[slot] = id;
    return `Equipped ${this.items.get(id)?.name ?? id}.`;
  }

  /**
   * Saves from before field spells were shards: a Light or Water Walk shard worn in the ring slot moves to the magic
   * slot (or the bag, when a shard is already there; the ground, when the bag is full).
   */
  private fixEquipSlots(): void {
    const eq = this.inventory.equip;
    for (const slot of EQUIP_SLOTS) {
      const id = eq[slot], d = id ? this.items.get(id) : undefined;
      if (!id || !d || d.slot === slot) continue;
      delete eq[slot];
      if (d.slot && !eq[d.slot]) { eq[d.slot] = id; continue; }
      if (this.inventory.count(id) > 0) continue;
      const left = this.inventory.add(id, 1);
      if (left) this.pickups?.place(id, left, this.player.position.x, this.player.position.y, this.player.position.z);
    }
  }

  /** What the fourth D-pad direction (↓) does, for the quick items cross: it follows the player's controller bindings. */
  private quickDown(): { label: string; key: string } | null {
    const a = this.input.padAction(13) ?? 'lock';
    const NAMES: Partial<Record<Action, string>> = {
      lock: 'Release target', target: 'Lock on', targetPrev: 'Prev. target', ring: 'Spell', magic: 'Spell', melee: 'Sword', bow: 'Bow',
      switchWeapon: 'Switch weapon', block: 'Block', sneak: 'Sneak', jump: 'Jump', run: 'Run', ok: 'Talk', attack: 'Attack', cancel: 'Menu',
      quick1: 'Quick item', quick2: 'Quick item', quick3: 'Quick item',
    };
    return { label: NAMES[a] ?? a, key: this.input.label(a) };
  }

  /** Ready the field spell of the shard in the magic slot (Light, Water Walk), if it has one. */
  private refreshRing(): void {
    const id = this.inventory.equip.magic, d = id ? this.items.get(id) : undefined;
    // A key item in use (a lantern switched on from the bag or with B) stays in hand while it's in the bag.
    const worn = this.rings.ring, keep = worn?.tool && this.inventory.count(worn.id) > 0 ? this.items.get(worn.id) ?? null : null;
    const bt = this.inventory.bTool && this.inventory.count(this.inventory.bTool) > 0 ? this.items.get(this.inventory.bTool) : undefined;
    this.rings.wear(keep ?? bt ?? (d?.spell?.power ? d : null), this.settings.lightShadows);
    // The HUD shows what the spell button does: the key item on it, or the readied spell (a learned spell, or the
    // shard's bolt or field spell).
    const learned = this.readiedSpell();
    this.hud.setRing(bt ? { name: bt.name, icon: this.itemIcon(bt.id) } : learned ? { name: learned.name, icon: elementIconUrl(learned.element ?? 'neutral') } : d ? { name: d.name, icon: this.itemIcon(d.id) } : null);
    this.touch.setRing(!!(bt || learned || d));
  }

  /** Switch a key item's field use (a lantern, water-walking boots) on or off; another one in use goes off first. */
  private toggleTool(id: string): string | null {
    const d = this.items.get(id);
    if (!d?.tool || this.inventory.count(id) < 1) return null;
    if (this.rings.ring?.id !== id) this.rings.wear(d, this.settings.lightShadows);
    this.useRing();
    return `${d.name}: ${this.rings.active ? 'on' : 'off'}`;
  }

  /** Mana Thrift (Magic tree): spells cost this much of their magic. */
  private get spellThrift(): number { return 1 - Math.min(75, this.skills?.get('spellCost') ?? 0) / 100; }

  /** Cast the field spell (key 3 with its shard, or F): switch Light or Water Walk on or off. */
  private useRing(): void {
    const r = this.rings.power;
    if (!r) { this.menu.notice('No field spell: equip the Light or Water Walk shard in Menu → Equipment'); return; }
    if (!this.rings.isTool && this.combat.heroStatus.silenced && !this.rings.active) { this.menu.notice('Silenced: can’t cast spells'); return; }
    this.tideOnWater = false;
    const was = this.rings.active;
    const msg = this.rings.toggle((mp) => this.stats.spendMp(Math.round(mp * this.spellThrift)), this.stats.mp);
    if (msg) this.menu.notice(msg);
    else this.audio.play(this.rings.active ? 'ringOn' : 'ringOff');
    if (was === this.rings.active && !msg) return;
  }

  /** The first prop in front of the hero (the tile ahead, then the one they stand on) that `want` accepts. */
  private propAhead(want: (d: PropDef) => boolean): { prop: PropData; tiles: [number, number][] } | null {
    const [fx, fz] = DIR_VECTOR[this.player.dir], p = this.player.position;
    const cells = [[Math.floor(p.x + fx * 0.75), Math.floor(p.z + fz * 0.75)], [Math.floor(p.x), Math.floor(p.z)]];
    for (const [cx, cz] of cells) {
      for (const prop of this.mapData.props) {
        const d = this.sprites.def(prop.type);
        if (!d || !want(d) || !this.propSlots.has(prop) || this.gone(prop)) continue;
        const tiles = blockedTiles(d, prop.x, prop.z, prop.s ?? 1);
        const at = d.foot ? footTiles(d, prop.x, prop.z, prop.s ?? 1) : tiles.length ? tiles : [[Math.floor(prop.x), Math.floor(prop.z)] as [number, number]];
        if (at.some(([x, z]) => x === cx && z === cz)) return { prop, tiles };
      }
    }
    return null;
  }

  /** Cut, burnt or mined away already (this visit, or for good)? */
  private gone(prop: PropData): boolean {
    const key = propKey(prop);
    return this.cutThisVisit.has(key) || this.state.isCut(this.mapName, key);
  }

  /** Take a cut, burnt or mined prop off the map: hidden, its tiles freed, remembered (for this visit if it grows back). */
  private clearProp(prop: PropData, tiles: [number, number][]): void {
    const key = propKey(prop);
    if (this.sprites.def(prop.type)?.regrows) this.cutThisVisit.add(key); else this.state.setCut(this.mapName, key);
    hideProp(this.propSlots.get(prop)!);
    // Free its tiles unless the ground or another prop still blocks them.
    for (const [x, z] of tiles) this.map.setBlocked(x, z, this.blockedByOthers(x, z, prop));
    this.map.removeBoxes(prop);
  }

  /** Cut down the cuttable prop in front of the hero (vines, a thin tree). Quiet (a sword swing): no notice if there's nothing. */
  private cutAhead(cost: number, quiet = false): boolean {
    const target = this.propAhead((d) => !!d.cuttable);
    if (!target) { if (!quiet) this.menu.notice('Nothing to cut here'); return false; }
    if (!this.stats.spendMp(cost)) { this.menu.notice('Not enough MP.'); return false; }
    const { prop, tiles } = target;
    this.clearProp(prop, tiles);
    this.bursts.spawn(prop.x, this.map.surfaceY(prop.x, prop.z) + 0.4, prop.z, { color: '#6fae4a', n: 18, speed: 1.8, up: 2.5, size: 0.11 });
    this.audio.play('cut', prop.x, prop.z);
    this.afterCut(prop);
    return true;
  }

  /** Blows landed on rock this visit (prop key → hits so far). */
  private readonly mineHits = new Map<string, number>();
  private mineWarnT = 0;

  /**
   * A swing at the rock in front of the hero: with a mining weapon (a pickaxe, a hammer) each blow chips it, and the
   * last breaks it open (stone, ore). Other weapons just bounce off. Returns true when there was rock to hit.
   */
  private mineAhead(): boolean {
    const target = this.propAhead((d) => !!d.mineable);
    if (!target) return false;
    const { prop, tiles } = target, d = this.sprites.def(prop.type)!, key = propKey(prop);
    const y = this.map.surfaceY(prop.x, prop.z);
    const id = this.inventory.equip.weapon, w = id ? this.items.get(id) : undefined;
    if (!w?.mines) {
      this.audio.play('block', prop.x, prop.z);
      if (this.elapsed > this.mineWarnT) { this.mineWarnT = this.elapsed + 4; this.menu.notice('Too hard: break rock with a pickaxe or hammer'); }
      return true;
    }
    const n = (this.mineHits.get(key) ?? 0) + 1, need = Math.max(1, d.hits ?? 3);
    this.bursts.spawn(prop.x, y + 0.5, prop.z + 0.1, { color: '#9a9ca6', n: 10, speed: 1.6, up: 2.2, life: 0.5, size: 0.07, gravity: 6 });
    if (n < need) {
      this.mineHits.set(key, n);
      this.audio.play('hit', prop.x, prop.z);
      return true;
    }
    this.mineHits.delete(key);
    this.clearProp(prop, tiles);
    this.bursts.spawn(prop.x, y + 0.4, prop.z, { color: '#7c7f8a', n: 26, speed: 2.4, up: 3, life: 0.8, size: 0.12, gravity: 7 });
    this.audio.play('break', prop.x, prop.z);
    this.state.tally('mined');
    this.afterCut(prop);
    return true;
  }

  /** Fire at (x, z): cuttable props there burn away (vines, saplings), giving nothing. Returns true if one did. */
  private burnAt(x: number, z: number, r: number): boolean {
    let any = false;
    for (const prop of this.mapData.props) {
      const d = this.sprites.def(prop.type);
      if (!d?.cuttable || !this.propSlots.has(prop) || this.gone(prop)) continue;
      if (Math.abs(prop.x - x) > r + d.w * (prop.s ?? 1) * 0.5 || Math.abs(prop.z - 0.3 - z) > r + 0.6) continue;
      this.charProp(prop, d);
      this.clearProp(prop, blockedTiles(d, prop.x, prop.z, prop.s ?? 1));
      const y = this.map.surfaceY(prop.x, prop.z);
      this.bursts.spawn(prop.x, y + 0.5, prop.z, { color: '#ff9a3a', n: 22, speed: 1.4, up: 2.6, life: 0.7, size: 0.09, additive: true });
      this.bursts.spawn(prop.x, y + 0.6, prop.z, { color: '#3a3a3a', n: 14, speed: 0.8, up: 2, life: 1.1, size: 0.12, gravity: -0.6 });
      this.audio.play('fire', prop.x, prop.z);
      this.state.tally('burnt');
      // Say why nothing dropped: fire leaves only ash (a flame weapon does this to saplings and vines).
      this.overlay.float('Burnt!', prop.x, y + 1.2, prop.z, 'info', '#ff9a4a');
      if (d.drops?.length) this.log.add(`${d.name} burnt to ash: fire leaves nothing to gather`, 'info');
      this.afterCut(prop, true);
      any = true;
    }
    return any;
  }

  /** Props burning away: a charred copy that glows, blackens and crumbles before it's gone. */
  private readonly charring: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; t: number; s: number; x: number; y: number; z: number }[] = [];

  /** Start a prop's burning: a copy of it in its place, catching fire. */
  private charProp(prop: PropData, d: PropDef): void {
    if (!this.level) return;
    const a = this.sprites.get(prop.type), mat = a.material.clone() as THREE.MeshStandardMaterial;
    mat.emissive = new THREE.Color('#ff6a1a');
    mat.emissiveMap = mat.map;
    mat.emissiveIntensity = 1.4;
    const m = new THREE.Mesh(a.geometry, mat), s = prop.s ?? 1, at = propBase(this.map, prop, d);
    m.scale.setScalar(s);
    m.position.set(prop.x, at.y, prop.z + 0.02);
    this.level.add(m);
    this.charring.push({ mesh: m, mat, t: 0, s, x: prop.x, y: at.y, z: prop.z });
  }

  /** Burning props: orange flames, then black char, then they crumble away (about a second and a half). */
  private updateCharring(dt: number): void {
    for (let i = this.charring.length - 1; i >= 0; i--) {
      const c = this.charring[i];
      c.t += dt;
      const k = c.t / 1.5;
      const burn = Math.min(1, k * 2.2), dark = Math.max(0, Math.min(1, (k - 0.15) * 2));
      c.mat.color.setRGB(1 - dark * 0.88, 1 - burn * 0.55 - dark * 0.37, 1 - burn * 0.8 - dark * 0.15);
      c.mat.emissiveIntensity = (1 - dark) * (1.4 + Math.sin(c.t * 30) * 0.4);
      // Crumbling: it sinks and narrows in its last moments.
      const fall = Math.max(0, (k - 0.6) / 0.4);
      c.mesh.scale.set(c.s * (1 - fall * 0.35), c.s * (1 - fall * 0.85), c.s);
      if (Math.random() < dt * 14 && k < 0.8) this.bursts.spawn(c.x + (Math.random() - 0.5) * 0.4, c.y + 0.3 + Math.random() * 0.6, c.z, { color: k < 0.4 ? '#ffb05a' : '#4a4440', n: 2, speed: 0.5, up: 1.6, life: 0.6, size: 0.07, gravity: k < 0.4 ? -0.4 : 2, additive: k < 0.4 });
      if (k >= 1 || !c.mesh.parent) {
        this.bursts.spawn(c.x, c.y + 0.2, c.z, { color: '#2e2a28', n: 12, speed: 1, up: 1.2, life: 0.8, size: 0.09, gravity: 5 });
        c.mesh.parent?.remove(c.mesh);
        c.mat.dispose();
        this.charring.splice(i, 1);
      }
    }
  }

  /** What's left once something is cut, burnt or mined: its stump or rubble, and (unless burnt) what it gives. */
  private afterCut(prop: PropData, burnt = false): void {
    const d = this.sprites.def(prop.type);
    if (!d || !this.level) return;
    if (!burnt && !d.mineable) this.state.tally(d.stump ? 'trees' : 'cut');
    const st = d.stump && this.sprites.def(d.stump) ? d.stump : null;
    if (st) {
      const a = this.sprites.get(st), m = withSpriteShadows(new THREE.Mesh(a.geometry, a.material), a), s = prop.s ?? 1;
      m.scale.setScalar(s);
      const at = propBase(this.map, prop, d);
      m.position.set(prop.x, at.y, prop.z);
      this.level.add(m);
    }
    if (burnt) return;
    // What it gives tumbles out onto the ground, to be picked up a moment later (not straight into the bag).
    const y = prop.y ?? this.map.surfaceY(prop.x, prop.z);
    for (const it of d.drops ?? []) {
      if (!this.items.get(it.item) || it.count < 1) continue;
      if (it.chance !== undefined && Math.random() * 100 >= it.chance) continue;
      this.pickups?.harvest(it.item, it.count, prop.x, y, prop.z);
    }
  }

  /* ------------------------------------------------------------------ fires that burn out */

  /** This map's fires that burn out (props with a flame or light and a burn time). */
  private fireProps: PropData[] = [];
  private fireCheck = 0;

  /** Fires lit for a moment by a fire attack with no fuel left: seconds (real time) until they go out again. */
  private readonly kindled = new Map<string, number>();

  /** Is this fire out (no fuel time left, and not kindled by a fire attack)? */
  private fireOut(p: PropData): boolean {
    const k = propKey(p);
    return this.state.clock >= (this.state.fireUntil(this.mapName, k) ?? Infinity) && !((this.kindled.get(k) ?? 0) > 0);
  }

  /** How lit up the hero is by firelight (lit fire props' lights) or a light ring: 0 … 1. */
  private heroLit(): number {
    if (this.rings.active && this.rings.ring?.ring?.power === 'light') return 1;
    const p = this.player.position;
    let lit = 0;
    for (const f of this.litFires()) {
      const d = this.sprites.def(f.type)!, r = (d.light?.radius ?? 5) * 0.5 * Math.sqrt(f.s ?? 1);
      lit = Math.max(lit, 1 - Math.hypot(f.x - p.x, f.z - p.z) / r);
    }
    return Math.max(0, lit);
  }

  /** Lit campfires (fires that are respawn points), each with the ground around it no enemy enters. */
  private safeZones(): { x: number; z: number; r: number }[] {
    const r = this.combatCfg.campSafe;
    if (!(r > 0)) return [];
    return this.litFires().filter((f) => this.sprites.def(f.type)?.respawn).map((f) => ({ x: f.x, z: f.z, r }));
  }

  /** Fire props burning now on this map (ones that never go out, and burning ones that do). Cached for a frame. */
  private litCache: { at: number; list: PropData[] } = { at: -1, list: [] };
  private litFires(): PropData[] {
    if (this.litCache.at === this.elapsed) return this.litCache.list;
    const list = this.mapData.props.filter((p) => {
      const d = this.sprites.def(p.type);
      if (!d || !(d.flame || d.light) || !(d.flame || d.light?.flicker === 'fire' || d.light?.flicker === 'candle')) return false;
      return d.burns ? !this.fireOut(p) : true;
    });
    this.litCache = { at: this.elapsed, list };
    return list;
  }

  /** A fire attack at (x, y, z): light the first gone-out fire it reaches, for a few seconds. */
  private ignite(x: number, y: number, z: number, r: number): boolean {
    const burnt = this.burnAt(x, z, r);
    for (const p of this.fireProps) {
      if (!this.fireOut(p)) continue;
      const d = this.sprites.def(p.type)!, s = p.s ?? 1, at = propBase(this.map, p, d);
      const fx = p.x + (d.flame?.x ?? d.light?.x ?? 0) * s, fy = at.y + (d.flame?.y ?? d.light?.y ?? d.h * 0.7) * s;
      // Near the flame's spot, or anywhere on the prop.
      const nearFlame = Math.hypot(fx - x, at.z - z) < r + 0.35 + d.w * s * 0.2 && y > fy - 1.1 && y < fy + 1.1;
      const onProp = Math.abs(p.x - x) < r + d.w * s * 0.45 && Math.abs(at.z - z) < r + 0.4 && y > at.y - 0.3 && y < at.y + d.h * s + 0.3;
      if (!nearFlame && !onProp) continue;
      const secs = this.combatCfg.fire.kindle;
      this.kindled.set(propKey(p), secs);
      this.setFireOut(p, false);
      this.audio.play('fire', p.x, p.z);
      this.bursts.spawn(fx, fy + 0.1, at.z + 0.05, { color: '#ffb347', n: 16, speed: 1.4, up: 2, life: 0.6, size: 0.08, additive: true });
      this.log.add(`${d.name} catches fire (it needs fuel to keep burning)`, 'info');
      return true;
    }
    return burnt;
  }

  private initFires(): void {
    this.outShown.clear();
    this.kindled.clear();
    this.fireProps = this.mapData.props.filter((p) => { const d = this.sprites.def(p.type); return !!d?.burns && (!!d.light || !!d.flame); });
    for (const p of this.fireProps) {
      const k = propKey(p);
      // First time seen: freshly lit, with its full burn time (or unlit, for ones that start out).
      const d = this.sprites.def(p.type)!;
      if (this.state.fireUntil(this.mapName, k) === undefined) this.state.setFire(this.mapName, k, d.startsOut ? this.state.clock : this.state.clock + d.burns!);
    }
    this.fireCheck = 0;
    this.updateFires(0);
  }

  /** The clock runs; fires past their time go out. */
  private updateFires(dt: number): void {
    this.state.clock += (dt * this.time.rate) / 3600;
    // Kindled fires burn down in real time; in their last moments they sputter.
    for (const [k, t] of this.kindled) {
      const left = t - dt;
      const p = this.fireProps.find((f) => propKey(f) === k);
      if (!p) { this.kindled.delete(k); continue; }
      if (left <= 0) { this.kindled.delete(k); this.setFireOut(p, this.fireOut(p)); continue; }
      this.kindled.set(k, left);
      if (left < 2.5 && this.state.clock >= (this.state.fireUntil(this.mapName, k) ?? Infinity)) this.setFireOut(p, Math.floor(left * 7) % 3 === 0);
    }
    if (!this.fireProps.length || (this.fireCheck -= dt) > 0) return;
    this.fireCheck = 0.5;
    for (const p of this.fireProps) if (!this.kindled.has(propKey(p))) this.setFireOut(p, this.fireOut(p));
  }

  /** Burnt-out fires showing their "out" prop: the placed copy, and the fire's own matrix to bring it back. */
  private readonly outShown = new Map<PropData, { mesh: THREE.Mesh; matrix: THREE.Matrix4 }>();

  /** Put a fire out or light it: its light and flame, and its "out" look when it has one. */
  private setFireOut(p: PropData, out: boolean): void {
    this.lights?.setOut(p, out);
    const d = this.sprites.def(p.type), alt = d?.burntOut && this.sprites.def(d.burntOut) ? d.burntOut : null, slot = this.propSlots.get(p);
    if (!alt || !slot || !this.level) return;
    const shown = this.outShown.get(p);
    if (out && !shown) {
      const matrix = new THREE.Matrix4();
      slot.mesh.getMatrixAt(slot.index, matrix);
      hideProp(slot);
      const a = this.sprites.get(alt), m = withSpriteShadows(new THREE.Mesh(a.geometry, a.material), a);
      m.scale.setScalar(p.s ?? 1);
      const at = propBase(this.map, p, this.sprites.def(alt) ?? d);
      m.position.set(p.x, at.y, at.z + 0.001);
      this.level.add(m);
      this.outShown.set(p, { mesh: m, matrix });
    } else if (!out && shown) {
      shown.mesh.removeFromParent();
      slot.mesh.setMatrixAt(slot.index, shown.matrix);
      slot.mesh.instanceMatrix.needsUpdate = true;
      this.outShown.delete(p);
    }
  }

  /** The nearest fire that burns out, within a couple of tiles of the hero. */
  private nearestFire(): PropData | null {
    const p = this.player.position;
    let best: PropData | null = null, bd = 2.5;
    for (const f of this.fireProps) { const d = Math.hypot(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; best = f; } }
    return best;
  }

  /** "2 h 30 min" left on the nearest fire ("out" when it's gone out), for \fire in messages. */
  private fireLeftText(): string {
    const f = this.nearestFire();
    if (!f) return '';
    const left = Math.max(0, (this.state.fireUntil(this.mapName, propKey(f)) ?? 0) - this.state.clock);
    if (left <= 0) return 'no time at all: it has gone out';
    const m = Math.round(left * 60);
    return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
  }

  /** A fire that burns out on this tile (to feed it). */
  private fireAt(x: number, z: number): PropData | null {
    return this.fireProps.find((p) => {
      const d = this.sprites.def(p.type)!;
      // A wall torch can be reached from its tile or by facing the wall it hangs on.
      if (d.wall) { const az = propBase(this.map, p, d).z; return Math.floor(p.x) === x && (Math.floor(az + 0.01) === z || Math.floor(az - 0.01) === z); }
      return propCovers(d, p, x, z);
    }) ?? null;
  }

  /** A forge (an anvil) on this tile? */
  private forgeAt(x: number, z: number): boolean {
    return this.mapData.props.some((p) => { const d = this.sprites.def(p.type); return !!d?.forge && propCovers(d, p, x, z); });
  }

  /** Trained with this kind of weapon? Only medium and heavy need it, and only when the skill tree teaches it. */
  private proficient(cls: 'light' | 'medium' | 'heavy'): boolean {
    if (cls === 'light' || !this.skills) return true;
    const stat = cls === 'medium' ? 'proficientMedium' : 'proficientHeavy';
    if (!this.skills.data.nodes.some((n) => n.effects.some((e) => e.stat === stat))) return true;
    return this.skills.has(stat);
  }

  /**
   * The forge: smelt ore into ingots, upgrade weapons and armor with ingots of their material, and set a spell shard
   * in them (or take it out again). Upgrades and shards apply to every copy of that item.
   */
  private openForge(): void {
    const rules = forgeRules(this.db.combat), inv = this.inventory;
    const name = (id: string) => this.baseItems.get(id)?.name ?? id;
    const color = (id: string) => itemColor(this.items.get(id)) ?? undefined;
    const struck = () => { this.audio.play('block'); const p = this.player.position; this.bursts.spawn(p.x, p.y + 0.8, p.z, { color: '#ffd27a', n: 16, speed: 2.2, up: 2.4, life: 0.5, size: 0.06, additive: true }); };
    // Weapons and armor the hero has: worn first, then the bag (each kind once).
    const gear = (ok: (d: ItemDef) => boolean): string[] => {
      const ids: string[] = [];
      for (const id of Object.values(inv.equip)) if (id && !ids.includes(id) && ok(this.baseItems.get(id)!)) ids.push(id);
      for (const s of inv.slots) if (s && !ids.includes(s.id) && this.baseItems.get(s.id) && ok(this.baseItems.get(s.id)!)) ids.push(s.id);
      return ids;
    };
    const after = () => { this.applyForge(); this.refreshRing(); };

    const smelt = () => {
      const items = (): MenuItem[] => {
        const out: MenuItem[] = [];
        const seen = new Set<string>();
        for (const s of inv.slots) {
          const d = s && this.baseItems.get(s.id);
          if (!s || !d?.smelt || seen.has(s.id) || !this.baseItems.has(d.smelt.into)) continue;
          seen.add(s.id);
          const need = Math.max(1, d.smelt.need ?? 2), have = inv.count(s.id);
          out.push({ label: `${d.name} × ${have} → ${name(d.smelt.into)}`, detail: `${need} for one${have >= need * 2 ? ` · Space again for more` : ''}`, disabled: have < need, pick: () => {
            if (inv.count(s.id) < need || inv.room(d.smelt!.into) < 1) { this.menu.notice(inv.room(d.smelt!.into) < 1 ? 'Your bag is full' : `Needs ${need} ${d.name}`); return; }
            inv.remove(s.id, need);
            inv.add(d.smelt!.into, 1);
            struck();
            this.state.tally('smelted');
            this.menu.refresh(items(), note());
            this.menu.notice(`Smelted a ${name(d.smelt!.into)}`);
          } });
        }
        if (!out.length) out.push({ label: 'Nothing to smelt', detail: 'Ore from mining (iron ore, gold ore…)', disabled: true });
        return out;
      };
      const note = () => 'Ore becomes ingots: ingots upgrade weapons and armor of their material.';
      this.menu.push('Smelt', items(), { note: note() });
    };

    const upgrade = () => {
      const items = (): MenuItem[] => {
        const ids = gear((d) => upgradable(d));
        const out: MenuItem[] = ids.map((id) => {
          const b = this.baseItems.get(id)!, lv = this.state.forge.get(id)?.level ?? 0, cost = upgradeCost(lv), mat = b.material!, have = inv.count(mat);
          const max = lv >= rules.maxLevel;
          const what = b.weapon ? 'damage' : 'defence';
          return { label: `${this.items.get(id)!.name}${max ? '' : ` → +${lv + 1}`}`, color: color(id),
            detail: max ? 'Fully upgraded' : `${cost} ${name(mat)} (you have ${have}) · +${rules.percent}% ${what}`, disabled: max || have < cost, pick: () => {
              if (inv.count(mat) < cost) return;
              inv.remove(mat, cost);
              this.state.forge.set(id, { ...this.state.forge.get(id), level: lv + 1 });
              after(); struck();
              this.state.tally('upgrades');
              this.menu.refresh(items());
              this.menu.notice(`${this.items.get(id)!.name}: upgraded`);
            } };
        });
        if (!out.length) out.push({ label: 'Nothing to upgrade', detail: 'Weapons and armor with a material (iron, steel, gold…)', disabled: true });
        return out;
      };
      this.menu.push('Upgrade', items(), { note: `Each upgrade adds ${rules.percent}% damage (weapons) or defence (armor), up to +${rules.maxLevel}. It applies to every copy of that item.` });
    };

    this.menu.push('Forge', [
      { label: 'Smelt ore', detail: 'Ore into ingots', pick: smelt },
      { label: 'Upgrade', detail: 'More damage or defence, for ingots', pick: upgrade },
      { label: 'Leave', pick: () => this.menu.close() },
    ], { note: 'Upgrades apply to every copy of an item. (Shards are set in gear from the bag: pick a shard → Set in…)' });
  }

  /** Weapons and armor that can hold a shard: worn by the hero, by party members (named), then in the bag; each kind once. */
  private gearAround(): { id: string; who?: string }[] {
    const out: { id: string; who?: string }[] = [], seen = new Set<string>();
    const add = (id: string | undefined, who?: string) => { if (id && !seen.has(id) && enchantable(this.baseItems.get(id))) { seen.add(id); out.push({ id, who }); } };
    for (const id of Object.values(this.inventory.equip)) add(id);
    for (const m of this.members()) for (const id of Object.values(m.data.equip)) add(id, m.def.name);
    for (const s of this.inventory.slots) add(s?.id);
    return out;
  }

  // ---------------------------------------------------------------- shard holders (the bag's Shards tab)
  /** Where the shard in bag slot i can go: each hero (readied as their spell), then weapons and armor (set in them). */
  private shardTargets(i: number): { label: string; value: string; disabled?: boolean }[] {
    const id = this.inventory.slots[i]?.id;
    if (!id) return [];
    const name = (x: string | null) => (x ? this.baseItems.get(x)?.name ?? x : '');
    const out: { label: string; value: string; disabled?: boolean }[] = this.equipHost().heroes().map((x, k) => {
      const cur = this.holderShard(`hero:${k}`);
      return { label: `Ready for ${x.name}${cur ? ` (now ${name(cur)})` : ''}`, value: `hero:${k}`, disabled: cur === id };
    });
    const ok = settableShard(this.baseItems.get(id));
    for (const { id: gid, who } of this.gearAround()) {
      const cur = this.state.forge.get(gid)?.shard ?? null;
      out.push({ label: `Set in ${this.items.get(gid)?.name ?? gid}${who ? ` (${who})` : ''}${cur ? ` (now ${name(cur)})` : ''}${ok ? '' : ': only elemental shards'}`, value: `gear:${gid}`, disabled: !ok || cur === id });
    }
    return out;
  }

  /** Put the shard in bag slot i on a hero (readied) or in a piece of gear. With every copy in use, this one moves. */
  private placeShard(i: number, key: string): string | null {
    const id = this.inventory.slots[i]?.id;
    if (!id || !this.holderTakes(key, id)) return null;
    if (this.inventory.free(id) < 1) this.takeOffSlot(i, true);
    if (this.inventory.free(id) < 1) return 'All of those are in use.';
    this.setHolderShard(key, id);
    this.applyForge(); this.refreshRing();
    this.audio.play('skill');
    const where = key.startsWith('hero:') ? `readied by ${this.equipHost().heroes()[Number(key.slice(5))]?.name ?? ''}` : `set in ${this.items.get(key.slice(5))?.name ?? ''}`;
    return `${this.baseItems.get(id)?.name ?? id} ${where}.`;
  }

  /** Whoever uses the copy in bag slot i lets go of it (it stays in the bag). */
  private takeOffSlot(i: number, quiet = false): string | null {
    const st = this.inventory.slots[i], w = this.slotWearers().get(i);
    if (!st || !w) return null;
    const all = this.wearers(st.id), x = all.find((y) => y.who === w.who);
    x?.off();
    this.applyForge(); this.refreshRing();
    return quiet ? null : `${this.items.get(st.id)?.name ?? st.id}: ${w.who.startsWith('gear:') ? `taken out of ${w.label.replace(/^In /, '')}` : `taken off ${w.label}`}.`;
  }

  /** The shard a holder has (a hero's readied one, or the one set in a piece of gear). */
  private holderShard(key: string): string | null {
    const [kind, rest] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    if (kind === 'hero') { const h = Number(rest); return (h ? this.members()[h - 1]?.data.equip.magic : this.inventory.equip.magic) ?? null; }
    return this.state.forge.get(rest)?.shard ?? null;
  }

  /** Put a shard in a holder (null empties it), without touching the bag. */
  private setHolderShard(key: string, sid: string | null): void {
    const kind = key.slice(0, key.indexOf(':')), rest = key.slice(key.indexOf(':') + 1);
    if (kind === 'hero') {
      const h = Number(rest), eq = h ? this.members()[h - 1]?.data.equip : this.inventory.equip;
      if (!eq) return;
      if (sid) eq.magic = sid; else delete eq.magic;
      return;
    }
    const e = { ...this.state.forge.get(rest) };
    if (sid) e.shard = sid; else delete e.shard;
    if (e.level || e.shard) this.state.forge.set(rest, e); else this.state.forge.delete(rest);
  }

  /** Can this shard go in this holder? (Gear only takes elemental shards; heroes ready any.) */
  private holderTakes(key: string, sid: string | null): boolean {
    return !sid || key.startsWith('hero:') || settableShard(this.baseItems.get(sid));
  }

  /** Set a shard (from the bag) in a piece of gear, or take its shard out (null). The old one goes back in the bag. */
  private setShard(gear: string, sid: string | null): string | null {
    const cur = this.state.forge.get(gear)?.shard, name = (id: string) => this.baseItems.get(id)?.name ?? id;
    if (!sid) {
      if (!cur) return null;
      this.setHolderShard(`gear:${gear}`, null);
      this.applyForge(); this.refreshRing();
      return `${name(cur)} taken out of ${this.items.get(gear)?.name ?? gear}.`;
    }
    const at = this.inventory.slots.findIndex((st) => st?.id === sid);
    return at < 0 ? null : this.placeShard(at, `gear:${gear}`);
  }


  // ---------------------------------------------------------------- fishing
  /** The cast in progress: casting out, waiting for a bite, or a bite to react to. */
  private fishing: {
    phase: 'cast' | 'wait' | 'bite' | 'reel'; t: number; at: number; nibble: number;
    from: THREE.Vector3; x: number; y: number; z: number; zone: number; power: number; hp: number;
    bob: THREE.Sprite; line: THREE.Line; icon: HTMLCanvasElement;
  } | null = null;
  private fishGrid: { data: MapData; grid: (number | null)[] } | null = null;

  /** The fishing spot (painted in the Water tab) one or two tiles ahead of the hero, if any. */
  private fishSpotAhead(): { x: number; y: number; z: number; zone: number } | null {
    const m = this.motion, data = this.mapData;
    if (!data.fishing?.length || m.swimming || m.airborne || m.climbing) return null;
    if (this.fishGrid?.data !== data) this.fishGrid = { data, grid: fishingGrid(data) };
    const [fx, fz] = DIR_VECTOR[this.player.dir], p = this.player.position;
    for (const d of [1, 1.6, 2.3]) {
      const cx = Math.floor(p.x + fx * d), cz = Math.floor(p.z + fz * d);
      if (!this.map.inMap(cx, cz)) break;
      const w = this.map.waterAt(cx, cz), zone = this.fishGrid.grid[cz * this.map.w + cx];
      if (w && zone !== null && zone !== undefined && data.fishZones?.[zone]) return { x: cx + 0.5, y: w.surface, z: cz + 0.5, zone };
    }
    return null;
  }

  /** The best fishing rod in the bag (or worn). */
  private bestRod(): ItemDef | undefined {
    let best: ItemDef | undefined;
    for (const d of this.items.values()) if (d.rod && this.inventory.count(d.id) > 0 && (!best || (d.rod.power ?? 0) > (best.rod!.power ?? 0))) best = d;
    return best;
  }

  private startFishing(spot: { x: number; y: number; z: number; zone: number }, rod: ItemDef): void {
    if (!this.level || this.combat.busy) return;
    const c = document.createElement('canvas');
    c.width = 6; c.height = 8;
    const g = c.getContext('2d')!;
    // A little float: red cap, white body, a dark tip.
    g.fillStyle = '#1a1420'; g.fillRect(2, 0, 2, 1);
    g.fillStyle = '#e8463a'; g.fillRect(1, 1, 4, 3);
    g.fillStyle = '#f4f0e6'; g.fillRect(1, 4, 4, 3);
    g.fillStyle = '#1a1420'; g.fillRect(2, 7, 2, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const bob = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    bob.scale.set(0.16, 0.21, 1);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(12).fill(0).map(() => new THREE.Vector3())),
      new THREE.LineBasicMaterial({ color: 0xeef2f8, transparent: true, opacity: 0.7 }));
    line.frustumCulled = false;
    this.level.add(bob, line);
    const power = rod.rod?.power ?? 0;
    this.fishing = { phase: 'cast', t: 0, at: 0.55, nibble: 1 + Math.random() * 2, from: this.rodTip(), ...spot, power, hp: this.stats.hp, bob, line, icon: this.iconCanvases.get(rod.id) ?? builtinIcon('fishing_rod') };
    this.audio.play('fishCast');
  }

  /** Where the rod's tip is (the line starts there). */
  private rodTip(): THREE.Vector3 {
    const held = this.combat.holdTip();
    if (held) return held;
    const [fx, fz] = DIR_VECTOR[this.player.dir], p = this.player.position, side = this.player.dir === 'left' ? -1 : 1;
    return new THREE.Vector3(p.x + fx * 0.55 + (fz ? side * 0.3 : 0), p.y + 1.05, p.z + fz * 0.45 + 0.05);
  }

  private updateFishing(dt: number): void {
    const f = this.fishing!, i = this.input;
    f.t += dt;
    // Reel in: walking off, jumping, attacking, opening the menu, or getting hit.
    const moving = i.isHeld('up') || i.isHeld('down') || i.isHeld('left') || i.isHeld('right') || Math.hypot(i.stick.x, i.stick.y) > 0.4;
    const press = i.consume('ok') || i.consume('attack') || i.consume('jump');
    for (const a of ['melee', 'bow', 'magic', 'ring', 'switchWeapon'] as Action[]) i.consume(a);
    if (this.stats.hp < f.hp - 0.5 || this.combat.heroStunned) { this.endFishing('The fish will have to wait.'); return; }
    if (moving || i.isHeld('cancel')) { this.endFishing(); return; }
    const surf = f.y + 0.06;
    if (f.phase === 'cast') {
      // The float arcs out over the water and plops in.
      const k = Math.min(1, f.t / f.at);
      f.bob.position.set(f.from.x + (f.x - f.from.x) * k, f.from.y + (surf - f.from.y) * k + Math.sin(k * Math.PI) * 0.8, f.from.z + (f.z - f.from.z) * k);
      if (k >= 1) { f.phase = 'wait'; f.t = 0; f.at = biteDelay(f.power, Math.random()); this.ripples.spawn(f.x, f.y, f.z, 0.8, 0.6); }
      if (press && k < 1) { /* still flying: ignore */ }
    } else if (f.phase === 'wait') {
      f.bob.position.set(f.x, surf + Math.sin(f.t * 2.4) * 0.012, f.z);
      // Little nibbles: a twitch and a ring, nothing to catch yet.
      f.nibble -= dt;
      if (f.nibble <= 0) { f.nibble = 1.2 + Math.random() * 2.2; this.ripples.spawn(f.x, f.y, f.z, 0.4, 0.3); f.bob.position.y -= 0.02; }
      if (press) { this.endFishing('Too soon: nothing was biting.'); return; }
      if (f.t >= f.at) {
        f.phase = 'bite'; f.t = 0; f.at = biteWindow(f.power);
        this.audio.play('fishBite');
        this.ripples.spawn(f.x, f.y, f.z, 1.1, 0.9);
        const p = this.player.position;
        this.overlay.float('!', p.x, p.y + 1.7, p.z, 'crit');
      }
    } else if (f.phase === 'bite') {
      // Pulled under: press now!
      f.bob.position.set(f.x + Math.sin(f.t * 40) * 0.015, surf - 0.07 - Math.sin(f.t * 18) * 0.02, f.z);
      if (press) { this.landCatch(); return; }
      if (f.t >= f.at) { this.endFishing('It got away…'); return; }
    } else {
      // Reeling in: the float comes back to the hero.
      const k = Math.min(1, f.t / 0.35), tip = this.rodTip();
      f.bob.position.set(f.x + (tip.x - f.x) * k, surf + (tip.y - surf) * k + Math.sin(k * Math.PI) * 0.3, f.z + (tip.z - f.z) * k);
      if (k >= 1) { this.endFishing(); return; }
    }
    // The rod out over the water, and the line from its tip to the float (sagging while it waits).
    this.combat.holding = { icon: f.icon, tilt: f.phase === 'cast' ? Math.min(1, f.t / 0.2) : f.phase === 'bite' ? 0.75 : f.phase === 'reel' ? 0.3 : 0.9 };
    const tip = this.rodTip(), b = f.bob.position, pos = f.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const sag = f.phase === 'wait' ? 0.35 : f.phase === 'bite' ? 0.05 : 0.15;
    for (let k = 0; k < 12; k++) {
      const u = k / 11;
      pos.setXYZ(k, tip.x + (b.x - tip.x) * u, tip.y + (b.y + 0.08 - tip.y) * u - Math.sin(u * Math.PI) * sag, tip.z + (b.z - tip.z) * u);
    }
    pos.needsUpdate = true;
  }

  /** A bite answered in time: roll what it was, and into the bag it goes. */
  private landCatch(): void {
    const f = this.fishing!, zone = this.mapData.fishZones?.[f.zone];
    const got = pickCatch(zone, this.time.night > 0.5, f.power, Math.random());
    const d = got ? this.items.get(got.item) : undefined;
    this.audio.play('fishCatch');
    this.ripples.spawn(f.x, f.y, f.z, 1.3, 1);
    f.phase = 'reel'; f.t = 0;
    if (!d) { this.menu.notice('Nothing on the hook.'); return; }
    if (this.inventory.room(d.id) < 1) { this.menu.notice(`A ${d.name}! But your bag is full, so you let it go.`); return; }
    this.inventory.add(d.id, 1);
    const size = catchSize(d, Math.random());
    this.state.tally('fish');
    if (size) this.state.tally('bestFish', size, true);
    const p = this.player.position;
    this.overlay.float(d.name, p.x, p.y + 1.6, p.z, 'info', itemColor(d) ?? undefined);
    this.log.add(`Caught ${/^[aeiou]/i.test(d.name) ? 'an' : 'a'} ${d.name}${size ? ` (${size} cm)` : ''}!`, 'loot');
    this.refreshEvents();
  }

  /** Put the rod away (with a word on why, sometimes). */
  private endFishing(msg?: string): void {
    const f = this.fishing;
    if (!f) return;
    this.fishing = null;
    this.combat.holding = null;
    f.bob.parent?.remove(f.bob); f.line.parent?.remove(f.line);
    (f.bob.material as THREE.SpriteMaterial).map?.dispose(); f.bob.material.dispose();
    f.line.geometry.dispose(); (f.line.material as THREE.Material).dispose();
    if (msg) this.menu.notice(msg);
  }

  /** Feeding a fire: how long it has left, and the fuel in the bag to add. */
  private openFire(p: PropData): void {
    const d = this.sprites.def(p.type)!, key = propKey(p);
    const left = () => Math.max(0, (this.state.fireUntil(this.mapName, key) ?? 0) - this.state.clock);
    const hm = (h: number) => { const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`; };
    const items = (): MenuItem[] => {
      const fuel = new Map<string, number>();
      for (const s of this.inventory.slots) if (s && (this.items.get(s.id)?.fuel ?? 0) > 0) fuel.set(s.id, (fuel.get(s.id) ?? 0) + s.n);
      // The burn time is how much the fire holds: fuel tops it up, never past full.
      const cap = d.burns ?? Infinity, full = left() >= cap - 1e-6;
      const out: MenuItem[] = [...fuel].map(([id, n]) => {
        const it = this.items.get(id)!;
        const adds = Math.min(it.fuel!, Math.max(0, cap - left()));
        return { label: `${it.name} × ${n}`, detail: full ? 'Full' : adds < it.fuel! - 1e-6 ? `+${hm(adds)} (fills it)` : `+${hm(it.fuel!)}`, disabled: full, pick: () => {
          const i = this.inventory.slots.findIndex((s) => s?.id === id);
          if (i < 0) return;
          this.inventory.removeAt(i, 1);
          const was = left();
          this.state.setFire(this.mapName, key, this.state.clock + Math.min(cap, was + it.fuel!));
          this.kindled.delete(key);
          this.state.tally('firesFed');
          this.setFireOut(p, false);
          this.audio.play(was > 0 ? 'fire' : 'ringOn', p.x, p.z);
          this.bursts.spawn(p.x, this.map.surfaceY(p.x, p.z) + 0.3, p.z, { color: '#ffb347', n: 14, speed: 1.2, up: 2, life: 0.6, size: 0.08, additive: true });
          this.menu.refresh(items(), status());
          this.menu.notice(was > 0 ? `${d.name}: burns for ${hm(left())}` : `${d.name} is lit again: burns for ${hm(left())}`);
        } };
      });
      if (!out.length) out.push({ label: 'No fuel in your bag', detail: 'Firewood, coal… (items marked as fire fuel)', disabled: true });
      out.push({ label: 'Leave it', pick: () => this.menu.close() });
      return out;
    };
    const cap = d.burns ?? 0;
    const status = () => (left() > 0 ? `Burns for about ${hm(left())} more (game time)${cap ? `, of ${hm(cap)} when full` : ''}.`
      : this.kindled.has(key) ? 'Only flickering: it’ll go out in a moment. Add fuel to keep it burning.' : 'It has gone out. Add fuel (or use a fire attack, for a moment) to light it again.');
    this.menu.push(d.name, items(), { note: status() });
  }

  private blockedByOthers(x: number, z: number, except: PropData): boolean {
    if (this.tiles.blocks(this.map.terrain(x, z))) return true;
    if (this.mapData.buildings?.some((b) => x >= b.x && x < b.x + b.w && z >= b.z && z < b.z + b.d)) return true;
    return this.mapData.props.some((q) => {
      if (q === except || this.cutThisVisit.has(propKey(q)) || this.state.isCut(this.mapName, propKey(q))) return false;
      const d = this.sprites.def(q.type);
      return !!d && blockedTiles(d, q.x, q.z, q.s ?? 1).some(([bx, bz]) => bx === x && bz === z);
    });
  }

  /** The weapon picker on the HUD: what the attack button uses, and the other two. */
  private updateWeaponHud(): void {
    const c = this.combat, inv = this.inventory;
    if (!inv) return;
    const st = c.heroStatus;
    this.hud.setStatus([...(st.zombie && !st.has('zombie') ? [{ id: 'zombie', name: 'Zombie', icon: statusIconUrl('zombie'), left: 1, total: Infinity }] : []),
      ...st.list.map((e) => ({ id: e.id, name: effectName(e.id), icon: statusIconUrl(e.id), left: e.left, total: e.total }))]);
    const melee = inv.equip.weapon, bow = inv.equip.ranged;
    const icon = (id: string | undefined, fallback: string) => (id ? this.itemIcon(id) : this.builtinUrl(fallback));
    const rc = (id: string | undefined) => (id ? itemColor(this.items.get(id)) ?? undefined : undefined);
    const off = this.state.weaponsOff;
    // Turn-based games: a built-in sword and bow (field tools, not bag items) unless a weapon is equipped.
    const tools = c.fieldTools, ownBow = bow && this.items.get(bow)?.weapon?.class === 'bow' ? bow : undefined;
    this.hud.setWeapons([
      { id: 'melee', name: melee ? this.items.get(melee)?.name ?? 'Weapon' : tools ? 'Sword' : 'Fists', icon: icon(melee, tools ? 'sword' : 'fist'), available: true, color: rc(melee), blocked: off },
      tools
        ? { id: 'bow', name: ownBow ? this.items.get(ownBow)?.name ?? 'Bow' : 'Bow', icon: icon(ownBow, 'bow'), available: true, color: rc(ownBow), blocked: off }
        : { id: 'bow', name: bow ? this.items.get(bow)?.name ?? 'Bow' : 'No bow', icon: icon(bow, 'bow'), available: c.available('bow'), color: rc(bow), blocked: off },
    ], c.weapon, c.switches, this.input.label('switchWeapon'));
  }
  private readonly builtinUrls = new Map<string, string>();
  private builtinUrl(name: string): string {
    let u = this.builtinUrls.get(name);
    if (!u) { u = builtinIcon(name).toDataURL(); this.builtinUrls.set(name, u); }
    return u;
  }

  /* ------------------------------------------------------------------ skills, sound */

  /** Rebuild the hero's skills from the progression (after loading or a new game) and apply their stat bonuses. */
  private syncSkills(): void {
    this.skills = new Skills(skillsData(this.db.skills), this.progress.ranks);
    this.applySkillStats();
    // Saves from before spell shards: skills already learned give their shard now.
    this.teachShards(true);
    this.syncAbilities();
  }

  /**
   * Starting spells, Additions and class from Database → Heroes, and what skills already taken teach (for new games,
   * and saves from before learned spells). Never takes anything away.
   */
  private syncAbilities(): void {
    if (!this.progress) return;
    mergeStarting(this.db, this.progress.abilities, mainHero(this.db));
    teachFromSkills(this.db, this.progress.abilities, this.progress.ranks, this.skills.data.nodes);
    for (const m of this.members()) {
      const a = (m.data.abilities ??= {});
      mergeStarting(this.db, a, m.def);
      const sk = this.memberSkills(m.data);
      teachFromSkills(this.db, a, sk.ranks, sk.data.nodes);
    }
  }

  /** Heroes an event names: '' the hero you play, '@party' everyone in the party, else a hero id (if in the party). */
  private eventHeroes(who: string): { name: string; a: AbilityData }[] {
    const out: { name: string; a: AbilityData }[] = [];
    if (!who || who === '@party') out.push({ name: mainHero(this.db).name, a: this.progress.abilities });
    for (const m of this.members()) if (who === '@party' || m.def.id === who) out.push({ name: m.def.name, a: (m.data.abilities ??= {}) });
    if (who && who !== '@party' && mainHero(this.db).id === who) out.push({ name: mainHero(this.db).name, a: this.progress.abilities });
    return out;
  }

  /** Event command: teach a spell (at a rank) or an Addition. The line to show, or null if nothing was new. */
  private eventLearn(c: Extract<Command, { cmd: 'learn' }>): string | null {
    const sp = findSpell(this.db, c.spell), ad = findAddition(this.db, c.addition), lines: string[] = [];
    for (const h of this.eventHeroes(c.who)) {
      if (sp && learnSpell(h.a, sp, c.rank ?? 1)) lines.push(`${h.name} learned ${rankName(sp.name, h.a.spells![sp.id])}!`);
      if (ad && learnAddition(h.a, ad)) lines.push(`${h.name} learned the Addition ${ad.name}!`);
    }
    for (const l of lines) this.log.add(l, 'level');
    if (lines.length) this.audio.play('skill');
    return lines.length ? lines.join('\n') : null;
  }

  /** Event command: change a hero's class (its skill trees open; nothing learned is lost), or unlock it for later. */
  private eventClass(c: Extract<Command, { cmd: 'heroClass' }>): string | null {
    const cl = findClass(this.db, c.cls);
    if (!cl) return null;
    const lines: string[] = [];
    for (const h of this.eventHeroes(c.who)) {
      if (c.op === 'change') { if (h.a.cls !== cl.id) { changeClass(h.a, cl.id); lines.push(`${h.name} is now a ${cl.name}!`); } }
      else if (unlockClass(h.a, cl.id)) lines.push(`${h.name} can now become a ${cl.name}.`);
    }
    for (const l of lines) this.log.add(l, 'level');
    if (lines.length) this.audio.play('skill');
    return lines.length ? lines.join('\n') : null;
  }

  /** A hero's learned abilities: 0 the hero, k the k-th party member. */
  private abilitiesOf(who: number): AbilityData | null {
    if (!who) return this.progress.abilities;
    const m = this.members()[who - 1];
    return m ? (m.data.abilities ??= {}) : null;
  }

  /**
   * The learned spell readied for the magic button (action mode), as the item a spell shard would be, so the field
   * combat casts it the same way. Undefined: none readied (an equipped shard is used, if any).
   */
  private readiedSpell(a: AbilityData = this.progress.abilities): (ItemDef & { spell: NonNullable<ItemDef['spell']> }) | undefined {
    const s = findSpell(this.db, a.fieldSpell), known = s ? a.spells?.[s.id] ?? 0 : 0;
    if (!s || !known || s.kind !== 'bolt') return undefined;
    const rank = Math.max(1, Math.min(known, a.fieldRank ?? known)), at = spellAtRank(s, rank);
    return {
      id: `spell:${s.id}`, name: rankName(s.name, rank), kind: 'equipment', icon: 'builtin:fire', slot: 'magic', element: s.element, inflicts: s.inflicts,
      spell: { damage: at.power, mp: at.mp, color: s.color ?? '#ffb04a', speed: s.speed, range: s.range },
    } as ItemDef & { spell: NonNullable<ItemDef['spell']> };
  }

  /**
   * Give the spell shard of every learned skill that teaches one and hasn't yet: into the magic slot if it's empty,
   * otherwise the bag. Returns the names of what was given.
   */
  private teachShards(quiet = false): string[] {
    const got: string[] = [];
    if (!this.inventory) return got;
    for (const node of this.skills.data.nodes) {
      const id = node.teaches, d = id ? this.items.get(id) : undefined;
      if (!id || !d || this.skills.rank(node.id) < 1 || this.progress.taught.includes(node.id)) continue;
      this.progress.taught.push(node.id);
      if (this.inventory.count(id) > 0) continue;
      if (d.slot === 'magic' && !this.inventory.equip.magic) this.inventory.equip.magic = id;
      else if (this.inventory.add(id, 1) > 0) { const p = this.player.position; this.pickups?.place(id, 1, p.x, p.y, p.z); }
      got.push(d.name);
      if (!quiet) this.log.add(`Received ${d.name}`, 'loot');
    }
    return got;
  }

  /** The hero's stats with what they wear and their skills (crit chance, defences). */
  heroTotals(gear: Partial<Record<EquipSlot, string>> = this.inventory.equip): HeroTotals {
    return heroTotals(this.progress.stats, this.wornGear(gear), (k) => (this.skills?.get(k) ?? 0) + (this.combat?.heroStatus.buff(k) ?? 0));
  }

  private wornGear(gear: Partial<Record<EquipSlot, string>> = this.inventory.equip): ({ slot: EquipSlot } & ItemDef | undefined)[] {
    return EQUIP_SLOTS.map((slot) => { const id = gear[slot], d = id ? this.items.get(id) : undefined; return d ? { ...d, slot } : undefined; });
  }

  /** Give or cure an ailment on the hero (events, ailment tiles). */
  ailmentCommand(op: 'give' | 'cure', a: Ailment | 'all', seconds?: number, quiet = false): void {
    const st = this.combat.heroStatus, p = this.player.position;
    if (op === 'cure') {
      const cured = st.cure([a]);
      if (cured.length && !quiet) this.overlay.float(`${cured.map(effectName).join(', ')} cured`, p.x, p.y + 1.7, p.z, 'info');
      return;
    }
    if (a === 'all') return;
    st.setOwner({ resists: [...(mainHero(this.db).resists ?? []), ...this.wornGear().flatMap((g) => g?.protects ?? [])] });
    const r = st.inflict(a, seconds);
    if (quiet && r !== 'applied' && r !== 'frozen') return;
    if (r === 'applied' || r === 'refreshed' || r === 'frozen') this.overlay.float(r === 'frozen' ? 'Frozen!' : effectName(a), p.x, p.y + 1.7, p.z, 'info', effectColor(r === 'frozen' ? 'frozen' : a));
    if (r === 'applied' || r === 'frozen') this.log.add(`You are ${STATUS_WORD[r === 'frozen' ? 'frozen' : a]}`, 'hurt');
  }

  /** The hero's starting stats from the database (character creation replaces them on a new game). */
  private heroBase(): Attrs { return heroBase(mainHero(this.db)); }

  /** Max health, magic and stamina: the database's, plus skills. */
  private applySkillStats(): void {
    const base = playerConfig(this.db.stats).max, max = this.stats.cfg.max, sk = this.skills;
    const before = { ...max };
    max.hp = base.hp + sk.get('maxHp'); max.mp = base.mp + sk.get('maxMp'); max.sp = base.sp + sk.get('maxSp');
    // Raising a maximum adds the same to the current amount; lowering one caps it.
    for (const g of ['hp', 'mp', 'sp'] as const) this.stats[g] = Math.min(max[g], this.stats[g] + Math.max(0, max[g] - before[g]));
  }

  private learnSkill(node: SkillNode): void {
    this.progress.points -= this.skills.take(node);
    this.applySkillStats();
    const shards = this.teachShards();
    const got = teachFromSkills(this.db, this.progress.abilities, this.skills.ranks, this.skills.data.nodes);
    for (const g of got) this.log.add(`Learned ${g}`, 'level');
    this.audio.play('skill');
    const extra = [...shards.map((x) => `received ${x}`), ...got];
    this.menu.notice(`Learned ${node.name}${this.skills.maxRank(node) > 1 ? ` (rank ${this.skills.rank(node.id)})` : ''}${extra.length ? `: ${extra.join(', ')}` : ''}`);
  }

  /** Music and background sound for where the hero is: the map's, an event's choice, night ambience, battle music. */
  private updateAudio(dt: number, fade = 1.5): void {
    const d = this.mapData, a = this.audio;
    const bs = this.battleSound;
    if (bs) {
      // A battle's own sound: the victory fanfare then its tune, or silence while the screen fades.
      if (bs.next && (bs.next.at -= dt) <= 0) { bs.music = bs.next.music; bs.fade = 1.2; bs.next = undefined; }
      a.music(bs.hush ? '' : bs.music, bs.fade);
      if (bs.hush) a.ambience('', bs.fade);
      return;
    }
    a.listener.x = this.player.position.x; a.listener.z = this.player.position.z;
    // Battle music while an enemy is hunting the hero nearby (and a moment after).
    const p = this.player.position;
    const turnBased = this.combatCfg.mode === 'turnBased';
    // Turn-based: the battle music plays during battles (the built-in theme when the map has none), not while hunted.
    const hunted = turnBased || this.battle.active ? this.battle.active : this.combat.enemies.some((e) => !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < 16);
    this.calmFor = hunted ? 0 : this.calmFor + dt;
    const fightMusic = (this.battle.active ? this.battleRules.music : undefined) || d.battleMusic || (turnBased || this.battle.active ? 'builtin:battle' : undefined);
    const battle = fightMusic && (turnBased || this.battle.active ? this.battle.active : this.calmFor < 4) ? fightMusic : undefined;
    // Build the battle music while things are calm, so it doesn't stall the moment a fight starts.
    if (fightMusic && this.calmFor > 1) a.prepare(fightMusic);
    a.music(battle ?? this.musicOverride ?? d.music ?? '', battle ? 0.6 : fade);
    const night = this.time.environment === 'outdoor' && this.time.night > 0.5 && d.ambienceNight;
    // Rain brings its own sound (unless an event chose one).
    const rainy = this.time.environment === 'outdoor' && this.weather.kind === 'rain' && this.weather.amount > 0;
    // Autumn and winter: the map's cold-season sound, or birdsong gives way to wind in bare branches.
    const cold = this.season === 'autumn' || this.season === 'winter';
    const day = cold && !night ? d.ambienceCold ?? (d.ambience === 'builtin:forest' ? 'builtin:chill' : d.ambience) : d.ambience;
    a.ambience(this.ambienceOverride ?? (rainy ? 'builtin:rain' : night ? d.ambienceNight! : day ?? ''));
  }

  /* ------------------------------------------------------------------ menus */

  /** The pause menu's tabs shown (built and not hidden in Database → Title & menus). */
  private pauseTabs(): PauseOption[] {
    const m = this.db.menus;
    return PAUSE_OPTIONS.filter(([o, , works]) => works && !m?.pauseHidden?.[o]
      // The Map needs a World layout; Achievements need some achievements.
      && (o !== 'map' || Object.keys(this.db.world?.maps ?? {}).length > 0)
      && (o !== 'achievements' || (this.db.achievements?.length ?? 0) > 0)).map(([o]) => o);
  }

  /** Open the pause menu: it covers most of the screen, its tabs across the top (LB / RB). */
  private openPauseMenu(tab?: PauseOption): void {
    const tabs = this.pauseTabs(), m = this.db.menus;
    if (!tabs.length) return;
    const k = tab ? Math.max(0, tabs.indexOf(tab)) : 0;
    this.pauseShell.show(tabs.map((o) => ({ id: o, label: pauseLabel(m, o), icon: PAUSE_ICONS[o] })), k,
      [this.input.label('tabPrev'), this.input.label('tabNext')], (to) => { uiSound('menuMove'); this.showPauseTab(to); });
    this.showPauseTab(k);
  }

  /** Put away whatever pause tab is showing (another tab is taking over, or the menu is closing). */
  private hidePauseScreens(): void {
    this.partyScreen.hide(); this.bag.hide(); this.questScreen.hide(); this.logScreen.hide(); this.recordsScreen.hide(); this.bestiaryScreen.hide();
    this.worldMap.hide(); this.achScreen.hide();
    // A page opened from a tab (a hero's Status, Equipment, Stats, Skill Tree) goes too when another tab is clicked.
    this.statusScreen.hide(); this.equipScreen.hide(); this.charScreen.hide(); this.skillScreen.hide();
    this.menu.close();
  }

  private closePause(): void {
    this.hidePauseScreens();
    this.pauseShell.close();
  }

  /** Inner tabs remembered while the game runs (the bag's pocket, the Journal's page). */
  private invTab = 0;
  private journalTab = 0;

  private showPauseTab(k: number): void {
    this.hidePauseScreens();
    this.pauseShell.select(k);
    const done = () => this.closePause(), group = this.pauseShell.group();
    switch (this.pauseShell.tab as PauseOption) {
      case 'status': this.partyScreen.show(done, group); break;
      case 'items': this.openInventory(this.invTab, done); break;
      case 'journal': this.openJournal(this.journalTab, done); break;
      case 'map': this.worldMap.show(done, group); this.drawWorldArt(); break;
      case 'achievements': this.achScreen.show(done, group); break;
      case 'settings': this.openSettings({ tabs: group, onBack: done }); break;
      case 'system': this.openSystem(group, done); break;
      default: done();
    }
  }

  /** The System tab: saving, loading and quitting. */
  private openSystem(tabs: TabGroup, done: () => void): void {
    const m = this.db.menus, anywhere = this.db.saving?.anywhere !== false;
    const label = (o: PauseOption) => pauseLabel(m, o);
    const items: MenuItem[] = [
      { label: 'Save', icon: PAUSE_ICONS.saveLoad, detail: anywhere ? undefined : 'Only at save points', disabled: !anywhere || !!m?.pauseHidden?.saveLoad, pick: () => this.openSaveScreen(false) },
      { label: 'Load', icon: PAUSE_ICONS.journal, disabled: !this.saves.latest() || !!m?.pauseHidden?.saveLoad, pick: () => this.openLoadScreen() },
      ...(m?.pauseHidden?.quitToTitle ? [] : [{ label: label('quitToTitle'), icon: PAUSE_ICONS.quitToTitle, pick: () => this.confirmQuit() }]),
    ];
    void SYSTEM_OPTIONS;
    this.menu.push(label('system'), items, { tabs, onBack: done });
  }

  /** Word bubbles over events ("!" / "?" for quests): only on the field, not in menus, battles or the title. */
  private updateBubbles(): void {
    const show = !this.onTitle && !this.battle.active && !this.stage && !this.pauseShell.isOpen && !this.transfer && !this.devConsole.isOpen;
    this.bubbles.visible = show;
    if (!show) return;
    const spots = [];
    for (const e of this.events) {
      const b = e.page?.bubble;
      if (!b || !e.onMap) continue;
      const sp = e.speakerPoint();
      const x = sp?.x ?? e.x + e.w / 2, z = sp?.z ?? e.z + e.h / 2;
      spots.push({ key: e, bubble: b, x, y: sp?.y ?? this.map.surfaceY(x, z), z, height: sp?.height ?? 0.8 });
    }
    this.bubbles.update(spots, this.projector, this.elapsed);
  }

  /* ---------------------------------------------------------------- world map */

  private readonly worldArt = new Map<string, HTMLCanvasElement>();
  private readonly worldTitles = new Map<string, string>();
  private readonly tileColors = new Map<string, string>();
  private worldDrawing = false;

  private tileColor(key: string): string {
    let c = this.tileColors.get(key);
    if (c) return c;
    const t = this.tileTextures.get(key);
    c = builtinTileColor(key) ?? (t?.map.image ? averageColor(t.map.image as CanvasImageSource) : '#5f9a45');
    this.tileColors.set(key, c);
    return c;
  }

  /** Draw the maps of the World layout from above (once each; the current map again, as cut trees change it). */
  private drawWorldArt(): void {
    if (this.worldDrawing) return;
    this.worldDrawing = true;
    const names = Object.keys(this.db.world?.maps ?? {});
    const style = { tile: (k: string) => this.tileColor(k), prop: (t: string) => propMark(this.sprites.def(t)) };
    void (async () => {
      for (const n of names) {
        if (this.worldArt.has(n) && n !== this.mapName) continue;
        try {
          const data = n === this.mapName ? this.mapData : await this.loadMapData(n);
          this.worldArt.set(n, drawMapArt(data, this.tiles, style, 4));
          this.worldEvents.set(n, data.events);
          this.worldTitles.set(n, data.name || n);
          if (this.worldMap.isOpen) this.worldMap.show(() => this.closePause(), this.pauseShell.group());
        } catch { /* a map that can't be read stays blank */ }
      }
      this.worldDrawing = false;
    })();
  }

  /** Each world map's events (for their markers), read as the world map is drawn. */
  private readonly worldEvents = new Map<string, EventData[]>();

  /** Event markers on the world map, where their switches allow. */
  private worldMarkers(): WorldMapMarker[] {
    const kinds = markerKinds(this.db.markers), out: WorldMapMarker[] = [];
    for (const [name, at] of Object.entries(this.db.world?.maps ?? {})) {
      const evs = name === this.mapName ? this.mapData.events : this.worldEvents.get(name) ?? [];
      for (const e of evs) {
        const m = e.marker, k = m && kinds.find((x) => x.id === m.kind);
        if (!m || !k) continue;
        if (m.switch && this.state.getSwitch(m.switch) === !!m.whenOff) continue;
        out.push({ x: at.x + e.x, z: at.z + e.z, w: Math.max(1, e.w ?? 1), h: Math.max(1, e.h ?? 1), symbol: k.symbol, color: k.color, label: m.label || e.name, kind: k.name });
      }
    }
    return out;
  }

  private worldPieces(): WorldMapPiece[] {
    const w = this.db.world, explore = w?.explore !== false;
    return Object.entries(w?.maps ?? {}).map(([name, at]) => ({
      name, at, title: this.worldTitles.get(name) ?? name, art: this.worldArt.get(name) ?? null,
      visited: this.visited.has(name), explored: explore ? this.exploredFor(name, at.w, at.h) : null,
    }));
  }

  private exploredFor(name: string, w: number, h: number): Explored {
    let e = this.explored.get(name);
    if (!e || e.w !== w || e.h !== h) { e = new Explored(w, h); this.explored.set(name, e); }
    return e;
  }

  /** Mark where the hero is as seen (a few times a second). */
  private exploreT = 0;
  private updateExplored(dt: number): void {
    if (this.onTitle || this.transfer || !this.mapData || !this.motion) return;
    this.visited.add(this.mapName);
    this.exploreT -= dt;
    if (this.exploreT > 0) return;
    this.exploreT = 0.3;
    this.exploredFor(this.mapName, this.mapData.width, this.mapData.height).reveal(this.motion.x, this.motion.z, 7);
  }

  /* ---------------------------------------------------------------- mini-map */

  /** The current map drawn from above for the mini-map (redrawn when the map changes). */
  private miniArt: { name: string; art: HTMLCanvasElement } | null = null;
  private miniT = 0;

  /**
   * The HUD's round mini-map: north up, the hero in the middle, the map drawn like the world map (with the same
   * fog where the world map has it), the map's markers and the party as dots.
   */
  private updateMinimap(dt: number): void {
    const el = this.hud.minimap;
    if (this.onTitle || !this.mapData || !this.motion || el.hidden || el.classList.contains('hud-off')) return;
    if ((this.miniT -= dt) > 0) return;
    this.miniT = 0.1;
    const PX = 4;
    if (this.miniArt?.name !== this.mapName) {
      const style = { tile: (k: string) => this.tileColor(k), prop: (t: string) => propMark(this.sprites.def(t)) };
      try { this.miniArt = { name: this.mapName, art: drawMapArt(this.mapData, this.tiles, style, PX) }; } catch { return; }
    }
    const c = this.hud.minimapCanvas, g = c.getContext('2d')!, S = c.width, zoom = 1.5, tile = PX * zoom;
    const px = this.motion.x, pz = this.motion.z;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0b0e16';
    g.fillRect(0, 0, S, S);
    g.save();
    g.translate(S / 2 - px * tile, S / 2 - pz * tile);
    g.scale(zoom, zoom);
    g.drawImage(this.miniArt.art, 0, 0);
    g.restore();
    // Fog: unexplored cells in view stay dark, as on the world map.
    const view = Math.ceil(S / tile / 2) + 1, x0 = Math.floor(px) - view, z0 = Math.floor(pz) - view;
    if (this.db.world?.explore !== false) {
      const ex = this.exploredFor(this.mapName, this.mapData.width, this.mapData.height);
      g.fillStyle = 'rgba(11, 14, 22, 0.92)';
      for (let z = z0; z <= z0 + view * 2; z++)
        for (let x = x0; x <= x0 + view * 2; x++)
          if (!ex.has(x, z)) g.fillRect(Math.floor(S / 2 + (x - px) * tile), Math.floor(S / 2 + (z - pz) * tile), Math.ceil(tile), Math.ceil(tile));
    }
    const at = (x: number, z: number): [number, number] => [S / 2 + (x - px) * tile, S / 2 + (z - pz) * tile];
    // The map's markers (where their switches allow).
    const kinds = markerKinds(this.db.markers);
    for (const e of this.mapData.events) {
      const m = e.marker, k = m && kinds.find((x) => x.id === m.kind);
      if (!m || !k || (m.switch && this.state.getSwitch(m.switch) === !!m.whenOff)) continue;
      const [mx, mz] = at(e.x + Math.max(1, e.w ?? 1) / 2, e.z + Math.max(1, e.h ?? 1) / 2);
      const r = S / 2 - 10, d = Math.hypot(mx - S / 2, mz - S / 2);
      // Off the edge: pinned to the rim, pointing the way.
      const k2 = d > r ? r / d : 1;
      drawMarker(g, k.symbol, S / 2 + (mx - S / 2) * k2, S / 2 + (mz - S / 2) * k2, 7, k.color);
    }
    for (const a of this.allies) {
      const [ax, az] = at(a.x, a.z);
      g.fillStyle = a.down ? '#7a7f8f' : '#8fd0ff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(ax, az, 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // The hero: an arrow the way they face.
    const ang = ({ up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 } as Record<string, number>)[this.player.dir] ?? Math.PI / 2;
    g.save(); g.translate(S / 2, S / 2); g.rotate(ang);
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.stroke(); g.fill();
    g.restore();
  }

  /* ---------------------------------------------------------------- achievements */

  private readonly achWorld: AchievementWorld = {
    record: (k) => this.state.record(k),
    level: () => this.progress.level,
    questDone: (id) => this.quests.status(id) === 'done',
    switchOn: (id) => this.state.getSwitch(id),
    gold: () => this.inventory.gold,
    count: (id) => this.inventory.count(id),
    partySize: () => this.members().length + 1,
  };

  private achIcon(icon: string | undefined): string {
    if (!icon || icon.startsWith('builtin:')) return this.builtinUrl(icon ? builtinIconName(icon) ?? 'trophy' : 'trophy');
    return this.resolveFile(icon);
  }

  private achievementViews(): AchievementView[] {
    return (this.db.achievements ?? []).map((a) => {
      const got = this.achBook.has(a.id), p = got ? null : achProgress(a.rule, this.achWorld);
      return { id: a.id, name: a.name, description: a.description, icon: this.achIcon(a.icon), points: a.points, unlocked: got, hidden: !!a.hidden,
        when: this.achBook.when(a.id), have: p?.have, need: p?.need };
    });
  }

  /** Unlock one (an event, or its rule met): the pop-up, once. Not in a game where console cheats were used. */
  private unlockAchievement(id: string, force = false): boolean {
    const a = this.db.achievements?.find((x) => x.id === id);
    if (!a || this.achBook.has(id) || (this.state.cheated && !force)) return false;
    this.achBook.unlock(id);
    platformUnlock(id);
    this.achToast.show({ name: a.name, points: a.points, icon: this.achIcon(a.icon) });
    this.log.add(`Achievement unlocked: ${a.name} (${a.points}G)`, 'level');
    return true;
  }

  /** Check the rules every so often. */
  private achT = 0;
  private checkAchievements(dt: number): void {
    this.achT -= dt;
    if (this.achT > 0 || this.onTitle || this.state.cheated) return;
    this.achT = 0.5;
    for (const a of this.db.achievements ?? []) {
      if (a.rule.kind === 'event' || this.achBook.has(a.id)) continue;
      const p = achProgress(a.rule, this.achWorld);
      if (p.have >= p.need) this.unlockAchievement(a.id);
    }
  }

  /* ---------------------------------------------------------------- developer console */

  /** Using a cheat marks the game (achievements stay locked in it). */
  private cheat(): void { this.state.cheated = true; }

  private applyCheats(): void {
    if (this.cheats.deathless && this.stats.hp < 1 && !this.onTitle) this.stats.change('hp', 'set', 1);
    if (this.cheats.deathlessParty) for (const m of this.members()) { if (m.data.down || m.data.hp < 1) { m.data.down = false; m.data.hp = Math.max(1, m.data.hp); } }
    if (this.cheats.infiniteGold && this.inventory.gold < 999999) this.inventory.gold = 999999;
    if (this.motion) this.motion.ghost = this.cheats.ghost;
  }

  private consoleCommands(): ConsoleCommand[] {
    const ids = <T extends { id: string }>(list: T[] | undefined) => (list ?? []).map((x) => x.id);
    const items = () => [...this.items.keys()];
    const heroes = () => ['all', ...ids(this.db.heroes)];
    const onOff = (v: string | undefined, now: boolean) => (v === undefined ? !now : /^(on|true|1|yes)$/i.test(v));
    const num = (v: string | undefined, d: number) => { const n = Number(v); if (v !== undefined && !Number.isFinite(n)) throw new Error(`“${v}” isn’t a number`); return v === undefined ? d : n; };
    const need = (v: string | undefined, what: string) => { if (!v) throw new Error(`Which ${what}?`); return v; };
    const run = (cmds: Command[]) => { this.interpreter.start(cmds); return 'Done (it happens as the console closes).'; };
    const toggle = (key: keyof typeof this.cheats, label: string): ConsoleCommand => ({
      name: label.toLowerCase().replace(/ /g, '_'), args: '[on|off]', help: `${label}: toggle`, complete: () => ['on', 'off'],
      run: (a) => { const on = onOff(a[0], !!this.cheats[key]); (this.cheats as Record<string, unknown>)[key] = on; if (on) this.cheat(); return `${label}: ${on ? 'on' : 'off'}`; },
    });
    const learnable = (i: number, kind: 'spell' | 'addition') => [...(kind === 'spell' ? spellList(this.db).map((x) => x.id) : additionList(this.db).map((x) => x.id)), ...(i > 0 ? ['all', ...this.members().map((m) => m.def.name.toLowerCase()), mainHero(this.db).name.toLowerCase()] : [])];
    /**
     * Who a command is for: a hero's id or name anywhere in it (any case: "level 5 eleanor"), "all" / "party" for
     * everyone, or (none named) the hero you play. Returns them as `who`s (0 the hero) and the other words.
     */
    const target = (a: string[], dflt: 'hero' | 'all' = 'hero'): { whos: number[]; rest: string[] } => {
      const ms = this.members(), hero = mainHero(this.db), low = (x: string) => x.toLowerCase();
      const idx = a.findIndex((w) => /^(all|party|everyone)$/i.test(w) || low(w) === low(hero.id) || low(w) === low(hero.name) || ms.some((m) => low(w) === low(m.def.id) || low(w) === low(m.def.name)));
      if (idx < 0) return { whos: dflt === 'all' ? [0, ...ms.map((_, k) => k + 1)] : [0], rest: a };
      const w = low(a[idx]), rest = a.filter((_, k) => k !== idx);
      if (/^(all|party|everyone)$/.test(w)) return { whos: [0, ...ms.map((_, k) => k + 1)], rest };
      if (w === low(hero.id) || w === low(hero.name)) return { whos: [0], rest };
      return { whos: [ms.findIndex((m) => w === low(m.def.id) || w === low(m.def.name)) + 1], rest };
    };
    const nameOf = (who: number) => (who ? this.members()[who - 1]?.def.name ?? '?' : mainHero(this.db).name);
    const party = () => ['all', mainHero(this.db).name.toLowerCase(), ...this.members().map((m) => m.def.name.toLowerCase())];
    const giveXp = (who: number, n: number) => {
      if (!who) { this.gainXp(n, false); return; }
      const m = this.members()[who - 1];
      if (m) memberGainXp(m.data, n, this.combatCfg, this.combatCfg.statPointsPerLevel, this.combatCfg.pointsPerLevel);
    };
    const levelOf = (who: number) => (who ? this.members()[who - 1]?.data.level ?? 1 : this.progress.level);
    const maxOf = (who: number) => (who ? this.allyNumbers(this.members()[who - 1].data, this.members()[who - 1].def).max : this.stats.cfg.max);
    const vitals = (who: number, hp?: number, mp?: number) => {
      if (!who) { if (hp !== undefined) this.stats.change('hp', 'set', hp); if (mp !== undefined) this.stats.change('mp', 'set', mp); return; }
      const m = this.members()[who - 1];
      if (!m) return;
      const mx = maxOf(who);
      if (hp !== undefined) { m.data.hp = Math.max(0, Math.min(mx.hp, hp)); m.data.down = m.data.hp <= 0; }
      if (mp !== undefined) m.data.mp = Math.max(0, Math.min(mx.mp, mp));
    };
    return [
      { name: 'give', args: '<item> [count]', help: 'Put an item in the bag', complete: (i) => (i === 0 ? items() : []),
        run: (a) => { const id = need(a[0], 'item'); if (!this.items.get(id)) throw new Error(`No item “${id}”`); const n = Math.max(1, Math.round(num(a[1], 1))); this.cheat(); const left = this.inventory.add(id, n); this.refreshRing(); return `+${n - left} ${this.items.get(id)!.name}${left ? ` (${left} didn’t fit)` : ''}`; } },
      { name: 'take', args: '<item> [count]', help: 'Take an item out of the bag', complete: (i) => (i === 0 ? items() : []),
        run: (a) => { const id = need(a[0], 'item'); const n = this.inventory.remove(id, Math.max(1, Math.round(num(a[1], 1)))); this.refreshRing(); return `−${n} ${this.items.get(id)?.name ?? id}`; } },
      { name: 'gold', args: '<amount>', help: 'Add gold (negative takes it)', run: (a) => { this.cheat(); this.inventory.gold = Math.max(0, this.inventory.gold + Math.round(num(a[0], 1000))); return `${this.inventory.gold} G`; } },
      { name: 'party_add', args: '<hero>', help: 'A hero joins the party', complete: () => ids(this.db.heroes).filter((h) => h !== mainHero(this.db).id), run: (a) => { this.cheat(); this.changeParty('add', need(a[0], 'hero')); return 'Joined.'; } },
      { name: 'party_remove', args: '<hero>', help: 'A hero leaves the party', complete: () => this.members().map((m) => m.def.id), run: (a) => { this.changeParty('remove', need(a[0], 'hero')); return 'Left.'; } },
      { name: 'learn_spell', args: '<spell> [rank] [hero|all]', help: 'Teach a spell', complete: (i) => learnable(i, 'spell'),
        run: (a) => { const t = target(a, 'all'); this.cheat(); let out = '';
          for (const w of t.whos) out = this.eventLearn({ cmd: 'learn', who: w ? this.members()[w - 1].def.id : mainHero(this.db).id, spell: need(t.rest[0], 'spell'), rank: Math.max(1, Math.round(num(t.rest[1], 1))) }) ?? out;
          return out || 'Already known.'; } },
      { name: 'learn_addition', args: '<addition> [hero|all]', help: 'Teach an Addition', complete: (i) => learnable(i, 'addition'),
        run: (a) => { const t = target(a, 'all'); this.cheat(); let out = '';
          for (const w of t.whos) out = this.eventLearn({ cmd: 'learn', who: w ? this.members()[w - 1].def.id : mainHero(this.db).id, addition: need(t.rest[0], 'Addition') }) ?? out;
          return out || 'Already known.'; } },
      { name: 'forget_spell', args: '<spell> [hero|all]', help: 'Forget a spell', complete: (i) => learnable(i, 'spell'),
        run: (a) => { const t = target(a, 'all'), id = need(t.rest[0], 'spell'); let n = 0; for (const w of t.whos) { const ab = this.abilitiesOf(w); if (ab?.spells?.[id]) { delete ab.spells[id]; n++; } } return `${n} forgot it.`; } },
      { name: 'forget_addition', args: '<addition> [hero|all]', help: 'Forget an Addition', complete: (i) => learnable(i, 'addition'),
        run: (a) => { const t = target(a, 'all'), id = need(t.rest[0], 'Addition'); let n = 0; for (const w of t.whos) { const ab = this.abilitiesOf(w); if (ab?.additions && id in ab.additions) { delete ab.additions[id]; if (ab.addition === id) delete ab.addition; n++; } } return `${n} forgot it.`; } },
      { name: 'exp', args: '<amount> [hero|all]', help: 'Give EXP (you, a hero by name, or all)', complete: (i) => (i === 1 ? party() : []),
        run: (a) => { const t = target(a), n = Math.max(1, Math.round(num(t.rest[0], 100))); this.cheat(); for (const w of t.whos) giveXp(w, n); return t.whos.map((w) => `${nameOf(w)}: level ${levelOf(w)}`).join(' · '); } },
      { name: 'level', args: '<level> [hero|all]', help: 'Level up to this level (you, a hero by name, or all)', complete: (i) => (i === 1 ? party() : []),
        run: (a) => {
          const t = target(a); this.cheat();
          for (const w of t.whos) {
            const want = Math.round(num(t.rest[0], levelOf(w) + 1));
            for (let k = 0; k < 200 && levelOf(w) < want; k++) {
              const before = levelOf(w);
              if (!w) { if (this.progress.maxed) break; this.gainXp(Math.max(1, this.progress.toNext - this.progress.xp), false); }
              else { const m = this.members()[w - 1], need = xpToNext(this.combatCfg, m.data.level); if (!need) break; giveXp(w, Math.max(1, need - m.data.xp)); }
              if (levelOf(w) === before) break;
            }
          }
          return t.whos.map((w) => `${nameOf(w)}: level ${levelOf(w)}`).join(' · ');
        } },
      { name: 'heal', args: '[hero|all]', help: 'Health, magic and stamina back, ailments cured (everyone, or one hero)', complete: () => party(),
        run: (a) => {
          const t = target(a, 'all');
          if (t.whos.length > 1) { this.fullRest(true); for (const m of this.members()) m.data.down = false; return 'Everyone restored.'; }
          const w = t.whos[0], mx = maxOf(w);
          if (!w) { this.stats.refill(); this.combat.heroStatus.clear(); } else vitals(w, mx.hp, mx.mp);
          return `${nameOf(w)} restored.`;
        } },
      { name: 'hp', args: '<amount> [hero|all]', help: 'Set health', complete: (i) => (i === 1 ? party() : []),
        run: (a) => { const t = target(a); this.cheat(); for (const w of t.whos) vitals(w, num(t.rest[0], maxOf(w).hp)); return `${t.whos.map(nameOf).join(', ')}: HP set.`; } },
      { name: 'mp', args: '<amount> [hero|all]', help: 'Set magic', complete: (i) => (i === 1 ? party() : []),
        run: (a) => { const t = target(a); this.cheat(); for (const w of t.whos) vitals(w, undefined, num(t.rest[0], maxOf(w).mp)); return `${t.whos.map(nameOf).join(', ')}: MP set.`; } },
      { name: 'ko', args: '[hero|all]', help: 'Knock someone out (to test revives)', complete: () => party(),
        run: (a) => { const t = target(a); for (const w of t.whos) vitals(w, w ? 0 : 1); return `${t.whos.map(nameOf).join(', ')}${t.whos.includes(0) ? ' (the hero you play keeps 1 HP on the field)' : ' knocked out.'}`; } },
      { name: 'revive', args: '[hero|all]', help: 'Back on their feet at full health', complete: () => party(),
        run: (a) => { const t = target(a, 'all'); for (const w of t.whos) vitals(w, maxOf(w).hp); return `${t.whos.map(nameOf).join(', ')} revived.`; } },
      toggle('deathless', 'Deathless'),
      { ...toggle('deathlessParty', 'Deathless party'), name: 'deathless_party' },
      { name: 'infinite_items', args: '[on|off]', help: 'Using consumables doesn’t use them up', complete: () => ['on', 'off'],
        run: (a) => { const on = onOff(a[0], this.inventory.keepUsed); this.inventory.keepUsed = on; if (on) this.cheat(); return `Infinite items: ${on ? 'on' : 'off'}`; } },
      { ...toggle('infiniteGold', 'Infinite gold'), name: 'infinite_gold' },
      { name: 'god', args: '[on|off]', help: 'Deathless hero and party, infinite items and gold', complete: () => ['on', 'off'],
        run: (a) => { const on = onOff(a[0], this.cheats.deathless); Object.assign(this.cheats, { deathless: on, deathlessParty: on, infiniteGold: on }); this.inventory.keepUsed = on; if (on) this.cheat(); return `God mode: ${on ? 'on' : 'off'}`; } },
      toggle('ghost', 'Ghost'),
      { name: 'speed', args: '<times>', help: 'Walk faster (1 = normal)', run: (a) => { this.cheats.speed = Math.max(0.25, Math.min(6, num(a[0], 1))); return `Speed ×${this.cheats.speed}`; } },
      { name: 'unlock_skills', args: '[hero|all]', help: 'Every skill and perk, at full rank', complete: () => heroes(),
        run: (a) => {
          this.cheat();
          const nodes = skillsData(this.db.skills).nodes, full = Object.fromEntries(nodes.map((n) => [n.id, Math.max(1, n.ranks ?? 1)]));
          const t = target(a, 'all');
          if (t.whos.includes(0)) { Object.assign(this.progress.ranks, full); this.syncSkills(); }
          for (const w of t.whos) if (w) this.members()[w - 1].data.skills = { ...full };
          return `${nodes.length} skills unlocked.`;
        } },
      { name: 'teleport', args: '<map> [x z]', help: 'Go to a map (its start, or a tile)', complete: (i) => (i === 0 ? Object.keys(this.db.world?.maps ?? {}).concat(this.handedMaps ? Object.keys(this.handedMaps) : []) : []),
        run: (a) => { const map = need(a[0], 'map'); const x = num(a[1], NaN), z = num(a[2], NaN);
          const to = Number.isFinite(x) && Number.isFinite(z) ? { x: x + 0.5, z: z + 0.5 } : map === this.db.startMap ? this.db.start : { x: -1, z: -1 };
          this.devConsole.toggle(false);
          this.requestTransfer(map, to.x < 0 ? { x: 0.5, z: 0.5 } : to, 'black');
          return `Off to ${map}.`; } },
      { name: 'time', args: '<hour>', help: 'Set the time of day (0–23.75)', run: (a) => { this.time.set(Math.max(0, Math.min(23.75, num(a[0], 12))), true); return this.time.label(this.settings.clock12); } },
      { name: 'weather', args: '<kind> [amount]', help: 'Change this map’s weather', complete: () => [...WEATHER_KINDS],
        run: (a) => run([{ cmd: 'weather', kind: need(a[0], 'weather') as WeatherKind, amount: num(a[1], 1) }]) },
      { name: 'season', args: '<spring|summer|autumn|winter|auto>', help: 'Show a season (auto: the real one)', complete: () => ['spring', 'summer', 'autumn', 'winter', 'auto'],
        run: (a) => { const v = need(a[0], 'season'); this.seasonTest = v === 'auto' ? null : v as Season; return `Season: ${v}`; } },
      { name: 'battle', args: '<troop|enemy…>', help: 'Start a battle with a troop or some enemies', complete: () => [...ids(this.db.troops), ...ids(this.db.enemies)],
        run: (a) => {
          const troop = this.db.troops?.find((t) => t.id === a[0]);
          const enemies = troop ? troop.members.flatMap((m) => Array.from({ length: Math.max(1, m.min ?? 1) }, () => m.enemy)) : a;
          if (!enemies.length) throw new Error('Which troop or enemies?');
          return run([{ cmd: 'battle', enemies: enemies.slice(0, MAX_FOES), canRun: true }]);
        } },
      { name: 'win_battle', help: 'Every foe in this battle falls', run: () => { if (!this.battle.active) throw new Error('Not in a battle.'); this.cheat(); this.battle.debugWin(); return 'Victory.'; } },
      { name: 'switch', args: '<switch> <on|off>', help: 'Set a switch', run: (a) => { this.state.setSwitch(need(a[0], 'switch'), onOff(a[1], !this.state.getSwitch(a[0]))); this.refreshEvents(); return `${a[0]}: ${this.state.getSwitch(a[0]) ? 'ON' : 'OFF'}`; } },
      { name: 'var', args: '<variable> <value>', help: 'Set a variable', run: (a) => { this.state.setVar(need(a[0], 'variable'), num(a[1], 0)); this.refreshEvents(); return `${a[0]} = ${this.state.getVar(a[0])}`; } },
      { name: 'debug_menu', args: '<show|hide>', help: 'The playtest panel', complete: () => ['show', 'hide'],
        run: (a) => { const on = a[0] ? /^(show|on)$/i.test(a[0]) : !this.debug.visible; this.debug.setVisible(on); return `Debug menu ${on ? 'shown' : 'hidden'}.`; } },
      { name: 'fps', args: '[on|off]', help: 'Show the frame rate', complete: () => ['on', 'off'], run: (a) => { this.settings.showFps = onOff(a[0], !!this.settings.showFps); this.applySettings(); return `Frame rate ${this.settings.showFps ? 'shown' : 'hidden'}.`; } },
      { name: 'hud', args: '[on|off]', help: 'Show or hide the HUD (screenshots)', complete: () => ['on', 'off'], run: (a) => { const on = onOff(a[0], document.body.classList.contains('hud-hidden')); document.body.classList.toggle('hud-hidden', !on); return `HUD ${on ? 'shown' : 'hidden'}.`; } },
      { name: 'achievement', args: '<id>', help: 'Unlock an achievement (even in a cheated game)', complete: () => ids(this.db.achievements),
        run: (a) => (this.unlockAchievement(need(a[0], 'achievement'), true) ? 'Unlocked.' : 'Already unlocked, or no such achievement.') },
      { name: 'achievements_reset', help: 'Lock every achievement again (in this browser)', run: () => { this.achBook.reset(); return 'All achievements locked again.'; } },
      { name: 'explore_all', help: 'Reveal the whole world map', run: () => { for (const [n, p] of Object.entries(this.db.world?.maps ?? {})) { this.visited.add(n); this.exploredFor(n, p.w, p.h).reveal(p.w / 2, p.h / 2, Math.hypot(p.w, p.h)); } return 'The world map is revealed.'; } },
      { name: 'bug', args: '<note…>', help: 'Note a bug here: map, tile, party and a picture (bugs: download the list)', run: (a) => {
          const note = a.join(' ').trim();
          if (!note) throw new Error('Write what went wrong: bug the door won’t open');
          const list = this.bugNotes();
          list.push({ when: new Date().toISOString(), note, map: this.mapName, x: Math.floor(this.motion.x), z: Math.floor(this.motion.z), height: this.map.step(Math.floor(this.motion.x), Math.floor(this.motion.z)),
            hour: Math.round(this.time.hour * 100) / 100, party: [mainHero(this.db).name, ...this.members().map((m) => m.def.name)], level: this.progress.level, battle: this.battle.active || undefined, shot: this.captureShot() ?? undefined });
          this.saveBugNotes(list);
          return `Noted (${list.length} so far). Type bugs to download them, bugs clear to start over.`;
        } },
      { name: 'bugs', args: '[clear]', help: 'Download the bug notes (or clear them)', complete: () => ['clear'], run: (a) => {
          const list = this.bugNotes();
          if (a[0] === 'clear') { this.saveBugNotes([]); return `Cleared ${list.length} note${list.length === 1 ? '' : 's'}.`; }
          if (!list.length) return 'No bug notes yet: bug <what went wrong>';
          const url = URL.createObjectURL(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' }));
          const link = document.createElement('a');
          link.href = url; link.download = `bug-notes-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.append(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          return `Downloaded ${list.length} note${list.length === 1 ? '' : 's'}.`;
        } },
      { name: 'where', help: 'This map and tile', run: () => `${this.mapName} · ${Math.floor(this.motion.x)}, ${Math.floor(this.motion.z)} · height ${this.map.step(Math.floor(this.motion.x), Math.floor(this.motion.z))}` },
    ];
  }

  /* ---------------------------------------------------------------- party lineup */

  /** The party in lineup order as `who`s (0 the hero, k the k-th member): the first three fight. */
  private lineupWhos(): number[] {
    const order = this.members().map((_, k) => k + 1);
    const at = this.combatCfg.turnBased.heroLocked ? Math.min(this.heroAt, ACTIVE_MEMBERS) : this.heroAt;
    order.splice(Math.max(0, Math.min(at, order.length)), 0, 0);
    return order;
  }

  /** Who fights (and walks along on the map). */
  private activeWhos(): number[] { return this.lineupWhos().slice(0, ACTIVE_MEMBERS + 1); }

  /** Reorder the party (a list of `who`s). */
  private setLineup(order: number[]): void {
    const ms = this.party.members;
    const list = order.filter((w) => w > 0).map((w) => ms[w - 1]).filter((x) => !!x);
    this.party.members = [...list, ...ms.filter((x) => !list.includes(x))];
    this.heroAt = Math.max(0, order.indexOf(0));
    this.spawnAllies();
  }

  private swapLineup(a: number, b: number): void {
    const order = this.lineupWhos(), i = order.indexOf(a), j = order.indexOf(b);
    if (i < 0 || j < 0) return;
    [order[i], order[j]] = [order[j], order[i]];
    // The hero who always fights can't end up on the bench.
    if (this.combatCfg.turnBased.heroLocked && order.indexOf(0) > ACTIVE_MEMBERS) return;
    this.setLineup(order);
  }

  private readonly bigArt = new Map<string, string>();
  /** A hero's card picture: their face art (Database → Heroes), or their sprite drawn large. */
  private heroArt(who: number): string {
    const def = who ? this.members()[who - 1]?.def : mainHero(this.db);
    if (def?.face) return this.resolveFile(def.face);
    const key = who ? `ally:${def?.id}` : 'hero';
    let u = this.bigArt.get(key);
    if (!u) {
      const look = who ? this.db.characters[def?.look ?? ''] ?? this.db.characters[this.db.player] : this.db.characters[this.db.player];
      u = this.sprites.portrait(`${key}:big`, look, 128).toDataURL();
      this.bigArt.set(key, u);
    }
    return u;
  }

  private partyView(who: number): PartyMemberView {
    const locked = !who && this.combatCfg.turnBased.heroLocked;
    if (!who) {
      const hero = mainHero(this.db);
      this.portraitUrl ??= this.sprites.portrait('hero', this.db.characters[this.db.player], 48).toDataURL();
      return {
        who, name: hero.name, level: this.progress.level, portrait: hero.face ? this.resolveFile(hero.face) : this.portraitUrl, art: this.heroArt(0), color: this.heroColor(0),
        hp: [this.stats.hp, this.stats.cfg.max.hp], mp: [this.stats.mp, this.stats.cfg.max.mp],
        xp: { have: this.progress.xp, next: this.progress.maxed ? null : this.progress.toNext },
        skillPoints: this.progress.points, statPoints: this.progress.statPoints, down: this.stats.hp <= 0, locked,
      };
    }
    const m = this.members()[who - 1], mx = this.allyNumbers(m.data, m.def).max, next = xpToNext(this.combatCfg, m.data.level);
    return {
      who, name: m.def.name, level: m.data.level, portrait: m.def.face ? this.resolveFile(m.def.face) : this.memberPortrait(m.def), art: this.heroArt(who), color: this.heroColor(who),
      hp: [m.data.down ? 0 : m.data.hp, mx.hp], mp: [m.data.mp, mx.mp],
      xp: { have: m.data.xp, next: next || null }, skillPoints: m.data.skillPoints ?? 0, statPoints: m.data.statPoints, down: !!m.data.down,
    };
  }

  /** What can be done for someone from their card. */
  private partyActions(who: number): PartyAction[] {
    const a = this.abilitiesOf(who) ?? {};
    const spells = spellList(this.db).filter((sp) => (a.spells?.[sp.id] ?? 0) > 0);
    const adds = additionList(this.db).filter((d) => a.additions && d.id in a.additions);
    const classes = classList(this.db).filter((c) => c.id === a.cls || (a.classes ?? []).includes(c.id));
    const cur = adds.find((d) => d.id === a.addition);
    const out: PartyAction[] = [
      { id: 'status', label: 'Status', detail: 'Who they are, what they wear, ailments' },
      { id: 'equip', label: 'Equipment', detail: 'Weapons, armor and accessories' },
      { id: 'skills', label: 'Skill Tree', detail: 'Spend skill points' },
      { id: 'stats', label: 'Stats', detail: 'Spend stat points' },
    ];
    if (this.combatCfg.mode === 'turnBased' && this.combatCfg.turnBased.additions === 'set') out.push({ id: 'addition', label: 'Addition', detail: adds.length ? `Attack performs: ${cur?.name ?? 'a plain attack'}` : 'No Additions learned yet', disabled: !adds.length });
    out.push({ id: 'magic', label: 'Magic', detail: spells.length ? `${spells.length} spell${spells.length === 1 ? '' : 's'}: healing can be cast from here` : 'No spells learned yet', disabled: !spells.length });
    if (classes.length > 1) out.push({ id: 'class', label: 'Class', detail: `Now: ${findClass(this.db, a.cls)?.name ?? 'none'}` });
    return out;
  }

  private partyRun(who: number, id: string, back: () => void): void {
    const name = who ? this.members()[who - 1]?.def.name ?? '' : mainHero(this.db).name;
    const a = this.abilitiesOf(who);
    switch (id) {
      case 'status': this.charScreen.show(who, back); return;
      case 'equip': this.equipScreen.show(back, undefined, undefined, who); return;
      case 'skills': this.skillHero = who; this.skillScreen.show(back); return;
      case 'stats': this.statusScreen.show(back, undefined, who); return;
    }
    if (!a) { back(); return; }
    if (id === 'addition') {
      const adds = additionList(this.db).filter((d) => a.additions && d.id in a.additions);
      const items: MenuItem[] = [{ label: 'A plain attack', detail: a.addition ? undefined : 'Chosen', pick: () => { delete a.addition; this.menu.back(); } },
        ...adds.map((d) => {
          const uses = a.additions![d.id] ?? 0, rank = additionRank(d, uses), next = additionToNext(d, uses);
          return { label: `${d.name} · Rank ${rank}`, color: '#ffd38a', detail: `${a.addition === d.id ? 'Chosen · ' : ''}${d.strikes.map((x) => x.button === 'any' ? '★' : x.button ?? 'A').join(' ')}${next === null ? ' · Mastered' : ` · ${next} more to rank ${rank + 1}`}${d.description ? ` · ${d.description}` : ''}`,
            pick: () => { a.addition = d.id; this.audio.play('skill'); this.menu.back(); } };
        })];
      this.menu.push(`Addition: ${name}`, items, { onBack: back, note: 'The Addition performed with Attack in battle.' });
    } else if (id === 'magic') {
      const spells = spellList(this.db).filter((sp) => (a.spells?.[sp.id] ?? 0) > 0);
      const items: MenuItem[] = spells.map((sp) => {
        const r = Math.min(a.spells![sp.id], spellMaxRank(sp)), at = spellAtRank(sp, r);
        return { label: rankName(sp.name, r), color: sp.color, detail: `${sp.kind === 'heal' ? 'Heal: choose to cast' : 'Battle spell'} · ${at.mp} MP${sp.targets === 'all' ? ' · all' : ''}${sp.description ? ` · ${sp.description}` : ''}`,
          pick: sp.kind === 'heal' ? () => this.castHealMenu(who, sp.id) : undefined };
      });
      this.menu.push(`Magic: ${name}`, items, { onBack: back });
    } else if (id === 'class') {
      const classes = classList(this.db).filter((c) => c.id === a.cls || (a.classes ?? []).includes(c.id));
      this.menu.push(`Class: ${name}`, classes.map((c) => ({ label: c.name, detail: `${c.id === a.cls ? 'Now · ' : ''}${c.description ?? ''}`,
        pick: () => { if (c.id !== a.cls) { changeClass(a, c.id); this.audio.play('skill'); } this.menu.back(); } })), { onBack: back, note: 'Nothing learned is lost when changing class.' });
    } else back();
  }

  private openHeroAbilities(who: number): void {
    const a = this.abilitiesOf(who);
    if (!a) return;
    const name = who ? this.members()[who - 1].def.name : mainHero(this.db).name;
    const items: MenuItem[] = [];
    // Class: change to any class they've held or unlocked (nothing learned is lost).
    const classes = classList(this.db).filter((c) => c.id === a.cls || (a.classes ?? []).includes(c.id));
    if (classes.length) {
      const cur = findClass(this.db, a.cls);
      items.push({ label: 'Class', detail: cur ? `${cur.description ?? ''}${cur.description ? ' · ' : ''}Skill trees: ${cur.trees.map((t) => skillsData(this.db.skills).trees.find((x) => x.id === t)?.name ?? t).join(', ')}` : 'None yet',
        choice: { value: a.cls ?? '', options: [...(a.cls ? [] : [['', 'None'] as [string, string]]), ...classes.map((c) => [c.id, c.name] as [string, string])], set: (v) => { if (v && v !== a.cls) { changeClass(a, v); this.audio.play('skill'); this.menu.back(); this.openHeroAbilities(who); } } } });
    }
    const spells = spellList(this.db).filter((sp) => (a.spells?.[sp.id] ?? 0) > 0);
    const adds = additionList(this.db).filter((d) => a.additions && d.id in a.additions);
    // Action mode: the learned bolt the magic button throws (instead of a spell shard).
    if (this.combatCfg.mode === 'action') {
      const opts: [string, string][] = [['', 'Spell shard in the magic slot'], ...spells.filter((sp) => sp.kind === 'bolt').flatMap((sp) =>
        Array.from({ length: Math.min(a.spells![sp.id], spellMaxRank(sp)) }, (_, i) => [`${sp.id}|${i + 1}`, rankName(sp.name, i + 1)] as [string, string]))];
      items.push({ label: 'Spell on the magic button', detail: 'Cast on the field with the spell button. A higher rank hits harder and costs more.',
        choice: { value: a.fieldSpell ? `${a.fieldSpell}|${Math.min(a.fieldRank ?? 99, a.spells?.[a.fieldSpell] ?? 1)}` : '', options: opts,
          set: (v) => { if (!v) { delete a.fieldSpell; delete a.fieldRank; } else { const [id, r] = v.split('|'); a.fieldSpell = id; a.fieldRank = Number(r); } if (!who) this.refreshRing(); } } });
    } else if (this.combatCfg.turnBased.additions === 'set' && adds.length) {
      items.push({ label: 'Attack uses', detail: 'The Addition performed with Attack in battle.',
        choice: { value: a.addition ?? '', options: [['', 'A plain attack'], ...adds.map((d) => [d.id, d.name] as [string, string])], set: (v) => { if (v) a.addition = v; else delete a.addition; } } });
    }
    for (const sp of spells) {
      const r = Math.min(a.spells![sp.id], spellMaxRank(sp)), at = spellAtRank(sp, r);
      // Healing spells can be cast from here, on the party.
      items.push({ label: `${rankName(sp.name, r)}`, color: sp.color, detail: `${sp.kind === 'heal' ? 'Heal (choose to cast)' : 'Spell'} · ${at.mp} MP${at.charge ? ` · charges ${at.charge} turn${at.charge === 1 ? '' : 's'}` : ''}${sp.targets === 'all' ? ' · all targets' : ''}${sp.description ? ` · ${sp.description}` : ''}`,
        pick: sp.kind === 'heal' ? () => this.castHealMenu(who, sp.id) : undefined });
    }
    for (const d of adds) {
      const uses = a.additions![d.id] ?? 0, rank = additionRank(d, uses), next = additionToNext(d, uses);
      items.push({ label: `${d.name} · Rank ${rank}`, color: '#ffd38a',
        detail: `Addition · ${d.strikes.map((x) => x.button === 'any' ? '★' : x.button ?? 'A').join(' ')}${next === null ? ' · Mastered' : ` · ${next} more to rank ${rank + 1}`}${d.description ? ` · ${d.description}` : ''}` });
    }
    if (!spells.length && !adds.length) items.push({ label: 'Nothing learned yet', detail: 'Spells and Additions are learned from the skill tree, from events and from trainers.', disabled: true });
    this.menu.push(`${pauseLabel(this.db.menus, 'abilities')}: ${name}`, items, { note: 'Left / right change a setting.' });
  }

  /** Out of battle: cast a healing spell (its highest rank known) on one of the party, or all of them. */
  private castHealMenu(who: number, spell: string): void {
    const caster = this.partyBattler(who)?.battler, sp = caster?.spells.find((x) => x.id === spell);
    if (!caster || !sp) return;
    const rank = sp.ranks[sp.ranks.length - 1];
    const mpNow = () => (who ? this.members()[who - 1]?.data.mp ?? 0 : this.stats.mp);
    const vit = (k: number) => {
      if (!k) return { name: mainHero(this.db).name, hp: this.stats.hp, max: this.stats.cfg.max.hp, down: false };
      const m = this.members()[k - 1];
      return { name: m.def.name, hp: m.data.down ? 0 : m.data.hp, max: this.allyNumbers(m.data, m.def).max.hp, down: !!m.data.down };
    };
    const heal = (k: number, n: number): number => {
      if (!k) { const before = this.stats.hp; this.stats.change('hp', 'add', n); return this.stats.hp - before; }
      const m = this.members()[k - 1];
      if (!m || m.data.down) return 0;
      const max = this.allyNumbers(m.data, m.def).max.hp, before = m.data.hp;
      m.data.hp = Math.min(max, m.data.hp + n);
      return m.data.hp - before;
    };
    const spend = () => { if (who) { const m = this.members()[who - 1]; if (m) m.data.mp = Math.max(0, m.data.mp - rank.mp); } else this.stats.change('mp', 'add', -rank.mp); };
    const cast = (targets: number[]) => {
      if (mpNow() < rank.mp) { this.audio.play('menuBack'); this.menu.notice(`Not enough MP (${rank.mp} needed)`); return; }
      const n = Math.max(1, Math.round(rank.power));
      const got = targets.map((k) => heal(k, n));
      if (!got.some((g) => g > 0)) { this.audio.play('menuBack'); this.menu.notice('Nobody needs healing'); return; }
      spend();
      this.audio.play('ringOn');
      this.menu.notice(targets.length === 1 ? `${vit(targets[0]).name} +${got[0]} HP` : `Everyone healed (${rank.name})`);
      this.menu.back();
      this.castHealMenu(who, spell);
    };
    const all = [0, ...this.members().map((_, k) => k + 1)];
    const items: MenuItem[] = sp.targets === 'all'
      ? [{ label: 'The whole party', detail: all.map((k) => { const v = vit(k); return `${v.name} ${Math.ceil(v.hp)}/${v.max}`; }).join(' · '), pick: () => cast(all) }]
      : all.map((k) => { const v = vit(k); return { label: v.name, detail: v.down ? 'Knocked out (healing can’t wake them)' : `${Math.ceil(v.hp)} / ${v.max} HP`, disabled: v.down, pick: () => cast([k]) }; });
    this.menu.push(`${rank.name}: ${rank.mp} MP (${Math.floor(mpNow())} left)`, items);
  }

  /** The Inventory: the bag's tabs (all, by kind), then Equipment and Status. LB / RB move between them. */
  private openInventory(k: number, onClose: () => void = () => {}): void {
    this.bag.hide();
    const n = INVENTORY_TABS.length;
    k = ((k % n) + n) % n;
    this.invTab = k;
    const tabs = this.tabGroup(INVENTORY_TABS.map((t) => t.label), k, (to) => this.openInventory(to, onClose));
    this.bag.show(onClose, tabs, INVENTORY_TABS[k].id);
  }


  /** The Journal: quests, the adventure log and records, as tabs. */
  private openJournal(k: number, onClose: () => void = () => {}): void {
    this.questScreen.hide(); this.logScreen.hide(); this.recordsScreen.hide(); this.bestiaryScreen.hide();
    const m = this.db.menus, n = JOURNAL_TABS.length;
    k = ((k % n) + n) % n;
    this.journalTab = k;
    const tabs = this.tabGroup(JOURNAL_TABS.map((t) => t[1]), k, (to) => this.openJournal(to, onClose));
    const title = pauseLabel(m, 'journal');
    const id = JOURNAL_TABS[k][0];
    if (id === 'quests') this.questScreen.show(title, this.quests, { item: (i) => this.items.get(i)?.name ?? i }, onClose, tabs);
    else if (id === 'log') this.logScreen.show(title, this.log.history, onClose, tabs);
    else if (id === 'bestiary') this.bestiaryScreen.show(title, this.bestiary(), onClose, tabs);
    else this.recordsScreen.show(title, this.records(), onClose, tabs);
  }

  private tabGroup(labels: string[], index: number, open: (k: number) => void): TabGroup {
    const go = (step: number, to?: number) => { uiSound('menuMove'); open(to ?? index + step); };
    // Inside the pause menu: these are inner tabs (LT / RT), LB / RB being the menu's own.
    if (this.pauseShell.isOpen) return this.pauseShell.group({ labels, index, keys: [this.input.label('subPrev'), this.input.label('subNext')], go });
    return { labels, index, keys: [this.input.label('tabPrev'), this.input.label('tabNext')], go };
  }

  /** The Journal's Bestiary: every enemy (but those left out), in the Database's order. */
  private bestiary(): BestiaryEntry[] {
    const B = this.combatCfg.bestiary, r = (k: string) => this.state.record(k);
    const mapTitle = (n: string) => (n === this.mapName ? this.mapData?.name : this.worldTitles.get(n)) || n;
    return (this.db.enemies ?? []).filter((d) => !d.noBestiary).map((d) => {
      const won = r(`kill:${d.id}`), seen = won > 0 || r(`seen:${d.id}`) > 0;
      const places = [...this.state.records].filter(([k, v]) => v > 0 && k.startsWith(`seenAt:${d.id}:`)).map(([k]) => mapTitle(k.slice(`seenAt:${d.id}:`.length)));
      const v = Math.max(0, d.hpVariance ?? 0), hp = v ? `${Math.max(1, Math.round(d.hp * (1 - v / 100)))}–${Math.round(d.hp * (1 + v / 100))}` : String(d.hp);
      const chip = (e: Elem) => ({ name: ELEMENT_NAMES[e], icon: elementIconUrl(e) });
      const groups = { weak: [] as Elem[], resist: [] as Elem[], immune: [] as Elem[], absorb: [] as Elem[] };
      for (const e of ELEMENT_LIST) {
        const x = elementResult(e, d);
        if (x.kind === 'absorb') groups.absorb.push(e); else if (x.kind === 'immune') groups.immune.push(e);
        else if (x.mult > 1) groups.weak.push(e); else if (x.mult < 1) groups.resist.push(e);
      }
      const gate = <T,>(n: number, make: () => T): T | { need: number } => (won >= n ? make() : { need: n - won });
      return {
        id: d.id, name: d.name, seen, defeated: won, picture: this.enemyPicture(d).icon, description: d.description, places,
        stats: gate(B.stats, () => ({ hp, attack: d.damage, defence: d.defense ?? 0, magicDefence: d.magicDefense ?? d.defense ?? 0, exp: d.xp, gold: d.gold ? (d.gold[0] === d.gold[1] ? `${d.gold[0]}` : `${d.gold[0]}–${d.gold[1]}`) : '0', boss: d.boss })),
        elements: gate(B.elements, () => ({ weak: groups.weak.map(chip), resist: groups.resist.map(chip), immune: groups.immune.map(chip), absorb: groups.absorb.map(chip), attack: ELEMENT_NAMES[enemyElement(d) ?? 'neutral'] })),
        drops: gate(B.drops, () => (d.drops ?? []).filter((x) => this.items.has(x.item)).map((x) => ({ name: this.items.get(x.item)!.name, icon: this.itemIcon(x.item), chance: x.chance }))),
      };
    });
  }

  /** The Journal's Records: the tallies, in sections. */
  private records(): RecordSection[] {
    const r = (k: string) => this.state.record(k), num = (v: number) => Math.floor(v).toLocaleString();
    const row = (label: string, k: string, unit = ''): [string, string] | null => (r(k) > 0 ? [label, num(r(k)) + unit] : null);
    const keep = (rows: ([string, string] | null)[]) => rows.filter((x): x is [string, string] => !!x);
    const secs = Math.floor(this.playTime), hrs = Math.floor(secs / 3600), mins = Math.floor((secs % 3600) / 60);
    const days = Math.floor(this.state.clock / 24);
    const done = this.quests.all.filter((q) => this.quests.status(q.id) === 'done').length;
    const kinds = [...this.state.records].filter(([k, v]) => k.startsWith('kill:') && v > 0)
      .map(([k, v]) => [this.db.enemies?.find((e) => e.id === k.slice(5))?.name ?? k.slice(5), v] as [string, number])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { title: 'Journey', rows: keep([
        ['Time played', `${hrs}:${String(mins).padStart(2, '0')}`],
        ['Days passed', num(days)],
        ['Level', String(this.progress.level)],
        row('Steps taken', 'steps'),
        r('swum') > 0 ? ['Distance swum', `${num(r('swum'))} tiles`] : null,
        row('Jumps', 'jumps'),
        ['Quests completed', num(done)],
        row('Times fallen', 'deaths'),
        row('Nights rested', 'rests'),
      ]) },
      { title: 'Battle', rows: keep([
        ['Enemies defeated', num(r('kills'))],
        row('Strongest hit', 'bestHit'),
        row('Critical hits', 'crits'),
        row('Sneak attacks', 'sneakAttacks'),
        row('Damage dealt', 'damageDealt'),
        row('Damage taken', 'damageTaken'),
        row('Attacks dodged', 'dodges'),
        row('Attacks parried', 'parries'),
        row('Spells cast', 'spells'),
        row('Arrows shot', 'arrows'),
      ]) },
      { title: 'Defeated', rows: kinds.map(([name, v]) => [name, num(v)] as [string, string]), empty: 'No enemies defeated yet.' },
      { title: 'Out and about', rows: keep([
        row('Trees chopped', 'trees'),
        row('Fish caught', 'fish'),
        row('Biggest fish', 'bestFish', ' cm'),
        row('Vines and brush cut', 'cut'),
        row('Items picked up', 'itemsFound'),
        row('Gold found', 'goldFound', ' G'),
        row('Items used', 'itemsUsed'),
        row('Fires fed', 'firesFed'),
      ]), empty: 'Nothing yet.' },
    ];
  }

  /* ------------------------------------------------------------------ turn-based battles */

  /**
   * A fight broke out on the map (turn-based mode): a battle with that enemy and its friends nearby. True when it's
   * taken over (so the hit on the map doesn't happen); just after a battle, hits are ignored for a moment.
   */
  private encounter(e: Enemy, opening: Opening): boolean {
    if (this.combatCfg.mode !== 'turnBased') return false;
    if (this.battle.active || this.battlePending || this.battleGrace > 0 || this.dying || this.onTitle || this.transfer || this.interpreter.running) return true;
    const tb = this.combatCfg.turnBased;
    const near = this.combat.enemies
      .filter((o) => o !== e && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) <= tb.joinRadius && (o.alert || Math.hypot(o.x - e.x, o.z - e.z) < 3))
      .sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z));
    const group = [e, ...near].slice(0, Math.min(MAX_FOES, tb.maxEnemies));
    this.startBattle(group.map((en) => ({ def: en.def, hp: en.hp, enemy: en })), opening);
    return true;
  }

  /** Random encounters (the map's table, turn-based mode): count the tiles walked, and now and then a battle. */
  private updateEncounters(): void {
    const m = this.mapData, t = m?.encounters, p = this.player.position;
    const hasZones = !!m?.zoneGrid && !!m.zones && Object.values(m.zones).some((z) => z.troops.length);
    if (this.combatCfg.mode !== 'turnBased' || (!t?.enemies.length && !hasZones) || this.onTitle || this.transfer || this.dying || this.battle.active || this.battlePending || this.interpreter.running) { this.encounterFrom = null; return; }
    const from = this.encounterFrom;
    this.encounterFrom = { x: p.x, z: p.z };
    if (!from || this.motion.swimming || this.motion.airborne) return;
    const d = Math.hypot(p.x - from.x, p.z - from.z);
    if (d <= 0 || d > 2) return;
    // A painted encounter zone under the hero, if any; otherwise the map's own random encounters (if it has them).
    const letter = hasZones ? zoneAt(m, p.x, p.z) : null, zone = letter ? m.zones?.[letter] : undefined;
    if (!zone?.troops.length) {
      if (!t?.enemies.length) return;
      // Only on the chosen ground (tall grass, say).
      if (t.terrain) {
        const row = m.terrain[Math.floor(p.z)], ch = row?.[Math.floor(p.x)];
        if (!ch || !t.terrain.includes(ch)) return;
      }
    }
    if (this.battleGrace > 0) return;
    const steps = Math.max(4, (zone ? zone.steps : t?.steps) ?? 30);
    if (!this.encounterAt) this.encounterAt = steps * (0.5 + Math.random());
    this.encounterWalked += d;
    if (this.encounterWalked < this.encounterAt) return;
    this.encounterWalked = 0;
    this.encounterAt = steps * (0.5 + Math.random());
    const defs = new Map((this.db.enemies ?? []).map((x) => [x.id, x]));
    const opening: Opening = Math.random() < 0.08 ? 'ambush' : Math.random() < 0.08 ? 'preemptive' : 'normal';
    if (zone?.troops.length) {
      // A troop for this zone, among those allowed now (day / night, the real-world day, a switch).
      const pick = pickTroop(zone, { night: this.time.night > 0.5, weekday: new Date().getDay(), switchOn: (id) => this.state.getSwitch(id) });
      const troop = pick ? (this.db.troops ?? []).find((x) => x.id === pick.troop) : undefined;
      if (!troop) return;
      const list: { def: EnemyDef; hp: number; enemy: null }[] = [];
      for (const mem of troop.members) {
        const def = defs.get(mem.enemy);
        if (!def) continue;
        const lo = Math.max(0, Math.round(mem.min ?? 1)), hi = Math.max(lo, Math.round(mem.max ?? mem.min ?? 1));
        const n = lo + Math.floor(Math.random() * (hi - lo + 1));
        for (let k = 0; k < n && list.length < MAX_FOES; k++) list.push({ def, hp: def.hp, enemy: null });
      }
      if (list.length) this.startBattle(list, opening, { canRun: !troop.noRun, music: troop.music, stage: zone.battleMap || undefined });
      return;
    }
    const table = t!.enemies.filter((x) => defs.has(x.enemy));
    if (!table.length) return;
    const lo = Math.max(1, Math.min(MAX_FOES, Math.round(t!.min ?? 1))), hi = Math.max(lo, Math.min(MAX_FOES, Math.round(t!.max ?? 3)));
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    const list: { def: EnemyDef; hp: number; enemy: null }[] = [];
    for (let k = 0; k < n; k++) { const pick = weighted(table)!, def = defs.get(pick.enemy)!; list.push({ def, hp: def.hp, enemy: null }); }
    this.startBattle(list, opening);
  }

  private readonly battlePictures = new Map<string, { picture: HTMLCanvasElement; icon: string; flip: boolean }>();

  /** An enemy's battle picture, facing the party (right), and a small copy for the turn order. */
  private enemyPicture(def: EnemyDef): { picture: HTMLCanvasElement; icon: string; flip: boolean } {
    const key = `${def.id}|${def.look.character ?? ''}|${def.look.monster ?? ''}|${def.look.image ?? ''}`;
    const hit = this.battlePictures.get(key);
    if (hit) return hit;
    let picture: HTMLCanvasElement, flip = false;
    const img = def.look.image ? this.sprites.flatImage(def.look.image) : null;
    if (img) {
      const h = Math.max(0.25, def.look.flat?.height ?? 1);
      picture = SpriteLibrary.trimmed(img, 0, 0, img.width, img.height, Math.min(4, (110 * h / 1.5) / img.height));
      flip = def.look.flat?.faces === 'left';
    } else if (def.look.character && this.db.characters[def.look.character]) {
      picture = this.sprites.standingFrame(`enemy:${def.look.character}`, this.db.characters[def.look.character], 'right', 0);
    } else {
      const sheet = (MONSTERS[def.look.monster ?? 'slime'] ?? MONSTERS.slime).draw(), fw = Math.floor(sheet.width / 3), fh = Math.floor(sheet.height / 4);
      picture = SpriteLibrary.trimmed(sheet, fw, fh * 2, fw, fh, Math.max(1, Math.round(64 / fh)));
    }
    const out = { picture, icon: picture.toDataURL(), flip };
    this.battlePictures.set(key, out);
    return out;
  }

  /** A hero's learned spells for a battle, every rank they know, with their Magic (`power` ×) and thrift (magic ×). */
  private battleSpells(a: AbilityData, power: number, thrift: number): BattleSpell[] {
    const out: BattleSpell[] = [];
    for (const s of spellList(this.db)) {
      const known = Math.min(a.spells?.[s.id] ?? 0, spellMaxRank(s));
      if (known < 1) continue;
      const ranks = Array.from({ length: known }, (_, i) => {
        const at = spellAtRank(s, i + 1);
        return { rank: i + 1, name: rankName(s.name, i + 1), power: at.power * power, mp: Math.max(0, Math.round(at.mp * thrift)), charge: at.charge };
      });
      out.push({ id: s.id, name: s.name, description: s.description, sound: s.sound, chant: s.chant, kind: s.kind, element: s.element ?? 'neutral', color: s.color, targets: s.targets ?? 'one', inflicts: s.inflicts, ranks });
    }
    return out;
  }

  /** A hero's Additions for a battle: strikes, rank and what it adds. */
  private battleAdditions(a: AbilityData): BattleAddition[] {
    const out: BattleAddition[] = [];
    for (const d of additionList(this.db)) {
      if (!a.additions || !(d.id in a.additions)) continue;
      const uses = a.additions[d.id] ?? 0, rank = additionRank(d, uses), bonus = additionBonus(d, rank);
      out.push({
        id: d.id, name: d.name, sound: d.sound, rank, maxRank: d.maxRank ?? 5, toNext: additionToNext(d, uses), damage: bonus.damage,
        strikes: d.strikes.map((x) => ({ power: x.power, button: x.button ?? 'A', time: Math.max(0.25, x.time ?? 0.7), window: Math.max(0.06, (x.window ?? 0.24) * bonus.window) })),
      });
    }
    return out;
  }

  /** The hero's ailments carried into a battle from the map (seconds become turns; buffs stay on the map). */
  private heroBattleStatus(): BattleStatus {
    const resists = [...(mainHero(this.db).resists ?? []), ...this.wornGear().flatMap((g) => g?.protects ?? [])];
    const st = new BattleStatus(resists);
    for (const e of this.combat.heroStatus.list) {
      if (e.id.startsWith('buff:')) continue;
      const a = e.id as BattleAilment;
      st.turns.set(a, turnsFromSeconds(a, e.left));
      if (a === 'chill') st.chillStacks = e.stacks ?? 1;
    }
    return st;
  }

  /** The hero's or a party member's numbers for a battle: attack, spells, defences, agility. */
  private partyBattler(who: number): { battler: Battler; view: FighterView; fig: { look: CharacterDef | undefined; equip: Partial<Record<EquipSlot, string>>; bow: boolean } } | null {
    const pct = (sk: Skills, k: Parameters<Skills['get']>[0]) => 1 + sk.get(k) / 100;
    if (who === 0) {
      const t = this.heroTotals(), sk = this.skills, gear = this.inventory.equip, cfg = this.combatCfg, hero = mainHero(this.db);
      const w = gear.weapon ? this.items.get(gear.weapon) : undefined, cls = w?.weapon && w.weapon.class !== 'bow' ? w.weapon.class : 'unarmed';
      const classPct = cls === 'unarmed' ? 1 : pct(sk, `${cls}Damage` as 'lightDamage');
      const melee = (cls === 'unarmed' ? cfg.unarmedDamage : w!.weapon!.damage) * cfg.classes[cls].damage * powerMultiplier(t.attrs.str) * pct(sk, 'meleeDamage') * classPct;
      const bowDef = gear.ranged ? this.items.get(gear.ranged) : undefined, ammo = this.inventory.arrow() ? this.items.get(this.inventory.arrow()!) : undefined;
      const bow = bowDef?.weapon ? (bowDef.weapon.damage + (ammo?.ammo?.damage ?? 0)) * powerMultiplier(t.attrs.str) * pct(sk, 'bowDamage') : 0;
      const useBow = !w && bow > melee;
      const a = this.progress.abilities;
      const spells = this.battleSpells(a, powerMultiplier(t.attrs.mag) * pct(sk, 'spellDamage'), this.spellThrift);
      const look = this.db.characters[this.db.player];
      this.portraitUrl ??= this.sprites.portrait('hero', look, 48).toDataURL();
      return {
        battler: {
          key: 'p0', side: 'party', name: hero.name, hp: this.stats.hp, maxHp: this.stats.cfg.max.hp, mp: this.stats.mp, maxMp: this.stats.cfg.max.mp,
          attack: useBow ? bow : melee, attackElement: (useBow ? bowDef?.element : w?.element) ?? 'neutral', attackMagic: false,
          armour: t.armour, magicArmour: t.magicArmour, agility: t.attrs.dex, baseAgility: t.attrs.dex, crit: t.crit,
          defence: { ...hero, halve: this.wornGear().flatMap((g) => g?.wards ?? []) }, spells, ct: 0, guarding: false,
          status: this.heroBattleStatus(), inflicts: (useBow ? bowDef?.inflicts : w?.inflicts),
          additions: this.battleAdditions(a), addition: a.addition,
        },
        view: { key: 'p0', side: 'party', name: hero.name, picture: this.sprites.standingFrame('battle:hero', look, 'left', 0), icon: this.portraitUrl, color: this.heroColor(0), face: hero.face ? this.resolveFile(hero.face) : undefined },
        fig: { look, equip: gear, bow: useBow },
      };
    }
    const m = this.members()[who - 1];
    if (!m) return null;
    const n = this.allyNumbers(m.data, m.def), t = heroTotals(m.data.stats, this.wornGear(m.data.equip), (k) => this.memberSkills(m.data).get(k));
    const style = fightingStyle(m.def, m.data, n), msk = this.memberSkills(m.data), ab = (m.data.abilities ??= {});
    const spells = this.battleSpells(ab, powerMultiplier(t.attrs.mag) * (1 + msk.get('spellDamage') / 100), 1 - Math.min(75, msk.get('spellCost')) / 100);
    // Healers who know no healing spell keep their own Heal.
    if ((style === 'healer' || m.def.ai === 'healer') && !spells.some((x) => x.kind === 'heal'))
      spells.unshift({ id: 'heal', name: 'Heal', kind: 'heal', element: 'neutral', color: '#9dffb0', targets: 'one', ranks: [{ rank: 1, name: 'Heal', power: n.heal, mp: HEAL_MP, charge: 0 }] });
    const useBow = !m.data.equip.weapon && n.bow > n.melee;
    const look = this.db.characters[m.def.look ?? ''] ?? this.db.characters[this.db.player];
    const key = `p${who}`;
    return {
      battler: {
        key, side: 'party', name: m.def.name, hp: m.data.down ? 0 : m.data.hp, maxHp: n.max.hp, mp: m.data.mp, maxMp: n.max.mp,
        attack: useBow ? n.bow : n.melee, attackElement: useBow ? n.bowElement : n.meleeElement, attackMagic: false,
        armour: n.armour, magicArmour: n.magicArmour, agility: t.attrs.dex, baseAgility: t.attrs.dex, crit: n.crit,
        defence: { elements: m.def.elements, immune: m.def.immune, absorb: m.def.absorb, halve: this.wornGear(m.data.equip).flatMap((g) => g?.wards ?? []) },
        spells, ct: 0, guarding: false,
        status: new BattleStatus([...(m.def.resists ?? []), ...this.wornGear(m.data.equip).flatMap((g) => g?.protects ?? [])]),
        inflicts: useBow ? undefined : n.meleeInflicts,
        additions: this.battleAdditions(ab), addition: ab.addition,
      },
      view: { key, side: 'party', name: m.def.name, picture: this.sprites.standingFrame(`battle:ally:${m.def.id}`, look, 'left', 0), icon: this.memberPortrait(m.def), color: this.heroColor(who), face: m.def.face ? this.resolveFile(m.def.face) : undefined },
      fig: { look, equip: m.data.equip, bow: useBow },
    };
  }

  /** Start a turn-based battle against these enemies (ones from the map carry their `enemy`, random ones don't). */
  /** A scripted battle's rules (the Start battle event command): running away, losing, the result, its music. */
  private battleRules: { canRun?: boolean; lose?: 'respawn' | 'continue'; resultVar?: string; music?: string; scripted?: boolean; stage?: string } = {};

  /**
   * `rules.stage`: the battle map to fight on (unset: this map's Battle map; '' or none: the flat battle screen).
   * A battle map not loaded yet loads first (battles wait for it).
   */
  private startBattle(list: { def: EnemyDef; hp: number; enemy: Enemy | null }[], opening: Opening, rules: TurnBattle['rules'] & { lose?: 'respawn' | 'continue'; resultVar?: string; music?: string; scripted?: boolean; stage?: string; noIntro?: boolean } = {}): void {
    if (!list.length || this.battle.active || (this.battlePending && !rules.noIntro)) return;
    // The way in: a sudden sting, everything stops, the picture breaks up into black; the battle starts there.
    if (!rules.noIntro) {
      this.battlePending = true;
      // Its battle map loads while the transition plays.
      const want = rules.stage ?? this.mapData?.battleMap;
      if (want && !this.battleMaps.has(want)) void this.loadMapData(want).then((d) => this.battleMaps.set(want, d)).catch(() => { /* reported when the battle starts */ });
      this.moveTarget = null;
      this.battleIntro(() => { this.battlePending = false; this.startBattle(list, opening, { ...rules, noIntro: true }); });
      return;
    }
    const stageName = rules.stage ?? this.mapData?.battleMap ?? '';
    if (stageName && !this.battleMaps.has(stageName)) {
      this.battlePending = true;
      void this.loadMapData(stageName)
        .then((d) => { this.battleMaps.set(stageName, d); })
        .catch((err: Error) => console.warn(`Battle map “${stageName}” couldn’t be loaded: ${err.message}`))
        .finally(() => {
          this.battlePending = false;
          this.startBattle(list, opening, { ...rules, stage: this.battleMaps.has(stageName) ? stageName : '' });
        });
      return;
    }
    const stageData = stageName ? this.battleMaps.get(stageName) : undefined;
    const specs: StageFighterSpec[] = [];
    this.battleRules = rules;
    this.combat.reset();
    this.endFishing();
    this.moveTarget = null;
    const entries: BattleEntry[] = [];
    // The hero and the first two of the lineup fight; the rest wait on the bench.
    this.battleWhos = new Set();
    for (const who of this.activeWhos()) {
      this.battleWhos.add(who);
      const b = this.partyBattler(who);
      if (!b) continue;
      entries.push({ battler: b.battler, view: b.view, who });
      if (stageData) specs.push(this.heroFigure(b.view.key, b.fig.look, b.fig.equip, b.fig.bow));
    }
    // Several of a kind are told apart: Slime A, Slime B…
    const counts = new Map<string, number>(), seen = new Map<string, number>();
    for (const x of list) counts.set(x.def.id, (counts.get(x.def.id) ?? 0) + 1);
    list.forEach((x, i) => {
      const d = x.def, pic = this.enemyPicture(d), k = seen.get(d.id) ?? 0;
      seen.set(d.id, k + 1);
      const name = (counts.get(d.id) ?? 0) > 1 ? `${d.name} ${String.fromCharCode(65 + k)}` : d.name;
      // Health rolled either side of the database's (Health ± %), so no two slimes are quite the same.
      const v = Math.max(0, Math.min(0.9, (d.hpVariance ?? 0) / 100)), maxHp = Math.max(1, Math.round(d.hp * (1 - v + Math.random() * 2 * v)));
      const hp = x.hp >= d.hp ? maxHp : Math.min(maxHp, x.hp);
      const battler: Battler = {
        key: `e${i}`, side: 'enemy', name, hp: Math.max(1, hp), maxHp, mp: 0, maxMp: 0, spread: (d.damageVariance ?? 10) / 100,
        attack: d.damage, attackElement: enemyElement(d), attackMagic: d.attackType === 'magic',
        armour: d.defense ?? 0, magicArmour: d.magicDefense ?? d.defense ?? 0, agility: enemyAgility(d), baseAgility: enemyAgility(d), crit: 5,
        defence: d, spells: [], ct: 0, guarding: false, boss: d.boss,
        status: new BattleStatus(d.resists ?? [], !!d.boss, !!d.undead), inflicts: d.inflicts,
        actions: d.actions, attackWeight: d.attackWeight, counterspell: d.counterspell,
      };
      entries.push({ battler, view: { key: battler.key, side: 'enemy', name, picture: pic.picture, icon: pic.icon, flip: pic.flip, scale: d.scale }, ref: { def: d, enemy: x.enemy, battler } });
      if (stageData) specs.push(this.enemyFigure(battler.key, d));
    });
    if (stageData) this.openStage(stageData, specs);
    this.audio.play('crit');
    // The Bestiary: each kind met, and where.
    for (const id of new Set(list.map((x) => x.def.id))) { this.state.tally(`seen:${id}`); if (this.mapName) this.state.tally(`seenAt:${id}:${this.mapName}`); }
    this.battle.start(entries, this.combatCfg.turnBased, opening, { canRun: rules.canRun });
  }

  /** Party members (0 the hero) fighting in the battle now. */
  private battleWhos = new Set<number>();

  /** After a battle: whoever finished it fighting moves to the front of the lineup (in their places). */
  private keepLineup(whos: number[]): void {
    if (!whos.length) return;
    this.setLineup([...whos, ...this.lineupWhos().filter((w) => !whos.includes(w))]);
  }

  /** A snapshot of the next frame drawn (for the battle transition). */
  private snapWanted: ((c: HTMLCanvasElement) => void) | null = null;
  private transition: { remove(): void } | null = null;

  /** Into battle: sting, freeze, a transition (the map's choice, or any) to black with a swell; then `start`. */
  private battleIntro(start: () => void): void {
    this.audio.play('encounter');
    this.battleSound = { music: '', hush: true, fade: 0.3 };
    const kinds = (this.mapData?.battleTransitions ?? []).filter((k): k is TransitionKind => (TRANSITIONS as readonly string[]).includes(k));
    const pool = kinds.length ? kinds : [...TRANSITIONS];
    const kind = pool[Math.floor(Math.random() * pool.length)];
    this.snapWanted = (snap) => {
      // A beat of stillness, then the picture goes.
      setTimeout(() => {
        this.audio.play(kind === 'shatter' ? 'shatter' : 'battleSwell');
        if (kind === 'shatter') setTimeout(() => this.audio.play('battleSwell'), 120);
        this.transition = playTransition(kind, snap, document.body, kind === 'shatter' ? 1.5 : 1.3, () => {
          this.post.fade = 1;
          this.fade = { from: 1, to: 1, t: 1, duration: 1 };
          this.battleSound = null;
          start();
          // The battle fades in (its music starting) once its first picture is drawn.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            this.transition?.remove(); this.transition = null;
            this.fade = { from: 1, to: 0, t: 0, duration: 0.7 };
          }));
        });
      }, 280);
    };
  }

  /* ------------------------------------------------------------------ battle maps (the 3D stage) */

  /** A hero on the stage: their sprite (back to the camera), holding their weapon, and how they attack. */
  private heroFigure(key: string, look: CharacterDef | undefined, equip: Partial<Record<EquipSlot, string>>, bow: boolean): StageFighterSpec {
    const sprite = new CharacterSprite(this.sprites, this.sprites.forCharacter(look), 'up');
    const weapons: CarriedWeapon[] = [];
    const add = (slot: EquipSlot) => {
      const item = equip[slot] ? this.items.get(equip[slot]!) : undefined, id = itemWeaponSprite(item), w = this.sprites.weapon(id);
      if (!w) return;
      const fx = item?.glow || item?.trail;
      weapons.push({ ...w, glow: item?.glow, trail: item?.trail, mask: fx ? this.sprites.weaponMask(id) : null });
    };
    if (sprite.animated) { if (bow) add('ranged'); else { add('shield'); add('weapon'); } }
    const held = weapons.length ? weapons[weapons.length - 1].def : null;
    const attackAnim = bow ? 'shoot' : held ? (['slash', 'slash_reverse', 'thrust'].find((a) => held.anims.includes(a)) ?? 'slash') : 'slash';
    return { key, side: 'party', sprite, weapons, attackAnim };
  }

  /** An enemy on the stage, drawn as it is on the field (a picture, a monster sheet or a person), facing the camera. */
  private enemyFigure(key: string, def: EnemyDef): StageFighterSpec {
    const monster = def.look.monster && MONSTERS[def.look.monster];
    const person = def.look.character ? this.db.characters[def.look.character] : undefined;
    const picture = def.look.image ? this.sprites.flat(def.look.image, def.look.flat?.height ?? 1) : null;
    const sprite = picture ? new FlatSprite(picture, def.look.flat ?? {}, def.look.flat?.height ?? 1)
      : monster ? new CharacterSprite(this.sprites, this.sprites.sheet(monster.draw()), 'down')
      : person ? new CharacterSprite(this.sprites, this.sprites.forCharacter(person), 'down')
      : new CharacterSprite(this.sprites, this.sprites.sheet(MONSTERS.slime.draw()), 'down');
    let weapons: CarriedWeapon[] = [], attackAnim = def.behaviour === 'ranged' ? 'shoot' : 'slash';
    if (sprite instanceof CharacterSprite && sprite.animated && def.look.character) {
      const w = def.weapon ?? (def.behaviour === 'ranged' ? 'bow' : 'sword');
      weapons = enemyWeaponSprites(def, w).map((id) => this.sprites.weapon(id)).filter((x): x is NonNullable<typeof x> => !!x);
      const held = weapons.length ? weapons[weapons.length - 1].def : null;
      if (held && def.behaviour !== 'ranged') attackAnim = ['slash', 'slash_reverse', 'thrust'].find((a) => held.anims.includes(a)) ?? 'slash';
    }
    return { key, side: 'enemy', sprite, scale: def.scale ?? 1, weapons, attackAnim };
  }

  /** Build a battle map as the stage for the battle about to start, and switch the view to it. */
  private openStage(data: MapData, specs: StageFighterSpec[]): void {
    this.endStage();
    const map = new TileMap(data, this.tiles);
    const stage = new BattleStage(data, (x, z) => map.standY(x, z));
    const built = buildWorld(stage.group, map, data, this.sprites, this.tileTextures);
    tagAOMeshes(stage.group);
    const lights = new Lights(stage.group, data, map, this.sprites);
    stage.scene.fog = this.fog;
    stage.scene.background = this.fog.color;
    // The sun and sky light the stage while it's shown.
    stage.scene.add(this.hemi, this.sun, this.sun.target);
    this.stage = { stage, lights, built, env: this.time.environment, map, look: new THREE.Vector3(data.width / 2, 0, data.height / 2) };
    // The field's weather (rain, snow…) and mist and sun rays carry on over the battle.
    const w = this.mapWeather();
    this.weather.attach(stage.group, w.kind, w.amount, this.stage.look);
    this.atmosphere.attach(stage.group, this.stage.look);
    this.time.environment = data.environment ?? 'outdoor';
    this.time.update(0);
    stage.addFighters(specs);
    tagAOMeshes(stage.group);
    this.applyFov();
    this.battleScreen.setStage(stage);
    this.battleScreen.onClosed = () => this.endStage();
    this.battleScreen.onCamera = (d) => this.cycleCamera(d);
    this.battleScreen.cameraHint(stage.cameraName, this.cameraKeys());
    this.warmup = true;
  }

  private cameraKeys(): [string, string] { return this.input.lastDevice === 'pad' ? ['LB', 'RB'] : ['Q', 'E']; }

  private cycleCamera(dir: 1 | -1): void {
    if (!this.stage) return;
    this.battleScreen.cameraHint(this.stage.stage.cycleCamera(dir), this.cameraKeys());
    this.audio.play('menuMove');
  }

  /** The battle is over: back to the field's view and lighting. */
  private endStage(): void {
    const s = this.stage;
    if (!s) return;
    this.stage = null;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    // The weather goes back to the field (before the stage is thrown away).
    if (this.level) { const w = this.mapWeather(); this.weather.attach(this.level, w.kind, w.amount, this.camTarget); this.atmosphere.attach(this.level, this.camTarget); }
    s.stage.dispose((root) => this.disposeTree(root));
    this.time.environment = s.env;
    this.time.update(0);
    this.applyFov();
    this.battleFrames = 0;
  }

  /** The camera's field of view: the field's (wider on portrait screens), or the battle map's. */
  private applyFov(): void {
    const narrow = this.camera.aspect < 1;
    this.camera.fov = this.stage ? this.stage.stage.fov * (narrow ? 1.4 : 1) : narrow ? 44 : 30; // portrait phones need a wider view
    this.camera.updateProjectionMatrix();
  }

  private updateStageCamera(dt: number): void {
    const st = this.stage!.stage;
    const look = st.updateCamera(dt, this.camera);
    this.stage!.look.copy(look);
    this.sun.target.position.copy(look);
    this.sun.position.copy(look).addScaledVector(this.time.sunDir, 30);
    this.post.focus = st.focusHeight(this.camera);
    this.camera.updateMatrixWorld();
    const r = this.canvas.getBoundingClientRect();
    st.project(this.camera, r.width, r.height, (k, x, y, w, h, shown) => this.battleScreen.place(k, x + r.left, y + r.top, w, h, shown));
  }

  /** Load the battle maps this map's battles use, so battles start without waiting. */
  private preloadBattleMaps(data: MapData): void {
    const names = new Set([data.battleMap, ...Object.values(data.zones ?? {}).map((z) => z.battleMap)].filter((n): n is string => !!n));
    for (const n of names) if (!this.battleMaps.has(n)) void this.loadMapData(n).then((d) => this.battleMaps.set(n, d)).catch(() => { /* loaded (or reported) when a battle needs it */ });
  }

  private battleHost(): BattleHost {
    type Ref = { def: EnemyDef; enemy: Enemy | null; battler: Battler };
    return {
      sound: (n) => this.audio.play(n),
      items: () => this.inventory.slots.flatMap((s, i) => {
        const d = s && this.items.get(s.id);
        if (!s || !d || d.kind !== 'consumable' || !(d.restore || d.cures?.length || d.buffs?.length)) return [];
        const r = d.restore, bits = r ? (['hp', 'mp', 'sp'] as const).filter((g) => r[g]).map((g) => `+${r[g]}${d.restorePercent ? '%' : ''} ${g.toUpperCase()}`) : [];
        return [{ slot: i, name: d.name, icon: this.itemIcon(d.id), count: s.n, detail: [bits.join(' · '), d.description].filter(Boolean).join(' — '), restore: r ? { hp: r.hp, mp: r.mp } : undefined, percent: !!d.restorePercent, cures: d.cures as string[] | undefined }];
      }),
      useItem: (slot, who, ailments) => {
        const s0 = this.inventory.slots[slot], id = s0?.id, d = id ? this.items.get(id) : undefined, before = id ? this.inventory.count(id) : 0;
        // What it cures of the battle's ailments on the one it's used on.
        const cures = d?.cures ?? [], all = cures.includes('all');
        const cured = ailments.filter((a) => (a === 'zombie' ? cures.includes('zombie') : all || cures.includes(a as never) || (a === 'frozen' && cures.includes('chill'))));
        let text = this.useItem(slot, who);
        let used = !!id && this.inventory.count(id) < before;
        if (!used && cured.length && d) {
          // Only a cure (party members' items on the map don't cure): used up here.
          this.inventory.removeAt(slot, 1);
          this.state.tally('itemsUsed');
          used = true;
          text = `${who ? this.members()[who - 1]?.def.name ?? '' : mainHero(this.db).name} used ${d.name}.`;
        }
        return text === null && !used ? null : { text: text ?? '', used, cures: used ? cures : [] };
      },
      voice: (src) => this.audio.play(src),
      reserves: () => this.lineupWhos().flatMap((who) => {
        if (this.battleWhos.has(who)) return [];
        if (!who) {
          // The hero on the bench (unless the hero always fights).
          if (this.combatCfg.turnBased.heroLocked) return [];
          const h = mainHero(this.db);
          this.portraitUrl ??= this.sprites.portrait('hero', this.db.characters[this.db.player], 48).toDataURL();
          return [{ who, name: h.name, icon: h.face ? this.resolveFile(h.face) : this.portraitUrl, hp: Math.max(0, this.stats.hp), maxHp: this.stats.cfg.max.hp, mp: this.stats.mp, maxMp: this.stats.cfg.max.mp, down: this.stats.hp <= 0 }];
        }
        const m = this.members()[who - 1];
        if (!m) return [];
        const n = this.allyNumbers(m.data, m.def);
        return [{ who, name: m.def.name, icon: m.def.face ? this.resolveFile(m.def.face) : this.memberPortrait(m.def), hp: m.data.down ? 0 : m.data.hp, maxHp: n.max.hp, mp: m.data.mp, maxMp: n.max.mp, down: !!m.data.down }];
      }),
      swapIn: (outKey, outWho, inWho) => {
        const b = this.partyBattler(inWho);
        if (!b) return null;
        this.battleWhos.delete(outWho);
        this.battleWhos.add(inWho);
        if (this.stage) this.stage.stage.replaceFighter(outKey, this.heroFigure(b.view.key, b.fig.look, b.fig.equip, b.fig.bow));
        return { battler: b.battler, view: b.view, who: inWho };
      },
      attackVoice: (who) => {
        const def = who ? this.members()[who - 1]?.def : mainHero(this.db);
        const list = (def?.attackSounds ?? []).filter(Boolean);
        if (list.length) this.audio.play(list[Math.floor(Math.random() * list.length)]);
      },
      spendItem: (slot) => { if (this.inventory.slots[slot]) { this.inventory.removeAt(slot, 1); this.state.tally('itemsUsed'); } },
      readVitals: (who) => {
        if (!who) return { hp: this.stats.hp, mp: this.stats.mp };
        const m = this.members()[who - 1];
        return m ? { hp: m.data.down ? 0 : m.data.hp, mp: m.data.mp } : { hp: 0, mp: 0 };
      },
      writeVitals: (who, hp, mp) => {
        if (!who) { this.stats.change('hp', 'set', hp); this.stats.change('mp', 'set', mp); return; }
        const m = this.members()[who - 1];
        if (!m) return;
        m.data.hp = Math.max(0, hp); m.data.mp = Math.max(0, mp); m.data.down = hp <= 0;
        const a = this.allies.find((x) => x.data === m.data);
        if (a && !m.data.down) { a.sprite.hold(null); a.sprite.mesh.rotation.z = 0; }
      },
      victory: (beaten) => this.battleRewards(beaten as Ref[]),
      fanfare: () => {
        // The battle music stops; the fanfare plays; then the victory tune.
        // Then music: the game's victory music (Database → Audio), or the map's own.
        this.battleSound = { music: '', fade: 0.35, next: { at: 3.0, music: this.db.audio?.victoryMusic ?? this.mapData?.music ?? '' } };
        this.audio.play('victory');
      },
      outro: (done) => {
        // Picture and sound fade out together; the field comes back once it's dark.
        this.battleSound = { music: '', hush: true, fade: 1.6 };
        this.battleScreen.fadeOut(1.4);
        this.fade = { from: this.post.fade, to: 1, t: 0, duration: 1.6 };
        this.outro = { done };
      },
      finished: (outcome, beaten) => {
        this.keepLineup(this.battle.lineup());
        this.battleGrace = this.combatCfg.turnBased.grace;
        this.encounterWalked = 0;
        const rules = this.battleRules;
        this.battleRules = {};
        if (rules.resultVar) { this.state.setVar(rules.resultVar, outcome === 'victory' ? 1 : outcome === 'fled' ? 2 : 0); this.refreshEvents(); }
        if (outcome === 'defeat') {
          // A story battle the party may lose: everyone back on their feet with a little health; the event goes on.
          if (rules.lose === 'continue') {
            this.stats.change('hp', 'set', 1);
            for (const m of this.members()) { m.data.down = false; m.data.hp = Math.max(1, m.data.hp); }
            return;
          }
          this.interpreter.stop();
          this.die();
          return;
        }
        // Knocked out but the battle was won: back on their feet with a little health.
        if (this.stats.hp <= 0) this.stats.change('hp', 'set', 1);
        if (outcome === 'fled') {
          for (const e of this.combat.enemies) if (!e.dead && e.alert) e.calm();
          return;
        }
        void beaten;
        this.refreshEvents();
        const evs = this.battleCommands;
        this.battleCommands = [];
        const cmds = evs.flatMap((ev) => ev.page?.commands ?? []);
        if (cmds.length && !this.interpreter.running) this.interpreter.start(cmds);
      },
      log: (t) => this.log.add(t, 'hit'),
      mastered: (who, id) => {
        const a = this.abilitiesOf(who), d = findAddition(this.db, id);
        return a && d ? masterAddition(a, d) : null;
      },
    };
  }

  /** Won: EXP for everyone standing, gold and items into the bag, and what each beaten enemy's page does. */
  private battleRewards(beaten: { def: EnemyDef; enemy: Enemy | null; battler: Battler }[]): VictoryReport {
    let xp = 0, gold = 0;
    const got = new Map<string, number>();
    this.battleCommands = [];
    for (const b of beaten) {
      const d = b.def;
      this.state.tally('kills'); this.state.tally(`kill:${d.id}`);
      this.quests.enemyDefeated(d.id);
      xp += Math.max(0, d.xp);
      gold += d.gold ? Math.round(d.gold[0] + Math.random() * Math.max(0, d.gold[1] - d.gold[0])) : 0;
      for (const drop of d.drops ?? []) if (Math.random() < drop.chance && this.items.has(drop.item)) got.set(drop.item, (got.get(drop.item) ?? 0) + Math.max(1, drop.count ?? 1));
      if (b.enemy) {
        this.combat.beatenInBattle(b.enemy);
        const ev = b.enemy.key as GameEvent;
        if (ev.page?.commands.length) this.battleCommands.push(ev);
      }
    }
    // The loot: gold first, then each item (with the sound its kind makes).
    const loot: VictoryLoot[] = [];
    if (gold > 0) {
      this.inventory.gold += gold; this.state.tally('goldFound', gold); this.log.add(`Received ${gold} G`, 'loot');
      loot.push({ name: `${gold} G`, icon: builtinIcon('coin').toDataURL(), count: 0, kind: 'gold' });
    }
    for (const [id, n] of got) {
      const d = this.items.get(id)!, left = this.inventory.add(id, n), kept = n - left;
      const kind: VictoryLoot['kind'] = d.kind === 'consumable' ? 'potion' : d.kind === 'key' ? 'key' : d.kind === 'material' ? 'material' : d.kind === 'equipment' || d.kind === 'ammo' ? 'gear' : 'item';
      if (kept > 0) this.log.add(`Received ${kept > 1 ? `${kept} × ` : ''}${d.name}`, 'loot');
      // No room: it's left on the ground at the hero's feet.
      if (left > 0) { const p = this.player.position; this.pickups?.place(id, left, p.x, p.y, p.z); }
      loot.push({ name: d.name, icon: this.itemIcon(id), count: n, kind, note: left > 0 ? (kept ? `${left} left on the ground: the bag is full` : 'Left on the ground: the bag is full') : undefined });
    }
    // EXP: each hero's bar, filled level by level, and what their new levels brought.
    const heroes: VictoryHero[] = [];
    const segments = (level: number, have: number, n: number): VictoryHero['segments'] => {
      const out: VictoryHero['segments'] = [];
      let left = n;
      while (left > 0) {
        const need = xpToNext(this.combatCfg, level);
        if (need <= 0) break;
        const take = Math.min(left, need - have);
        out.push({ level, from: have / need, to: (have + take) / need, up: have + take >= need, xp: have + take, toNext: need });
        left -= take;
        if (have + take >= need) { level++; have = 0; } else have += take;
      }
      return out;
    };
    const change = (out: string[], label: string, a: number, b: number) => { if (b !== a) out.push(`${label} ${Math.round(a)} → ${Math.round(b)}`); };
    const gain = (out: string[], label: string, n: number) => { if (n > 0) out.push(`+${n} ${label}${n === 1 ? '' : 's'}`); };
    {
      const pr = this.progress, before = { level: pr.level, xp: pr.xp, toNext: pr.toNext, hp: this.stats.cfg.max.hp, mp: this.stats.cfg.max.mp, st: pr.statPoints, sk: pr.points };
      const segs = xp > 0 ? segments(pr.level, pr.xp, xp) : [];
      if (xp > 0) this.gainXp(xp, true, true);
      const changes: string[] = [];
      if (pr.level > before.level) {
        change(changes, 'Max HP', before.hp, this.stats.cfg.max.hp); change(changes, 'Max MP', before.mp, this.stats.cfg.max.mp);
        gain(changes, 'stat point', pr.statPoints - before.st); gain(changes, 'skill point', pr.points - before.sk);
      }
      this.portraitUrl ??= this.sprites.portrait('hero', this.db.characters[this.db.player], 48).toDataURL();
      heroes.push({ key: 'p0', name: mainHero(this.db).name, icon: this.portraitUrl, color: this.heroColor(0), level: before.level, xp: before.xp, toNext: before.toNext, gained: xp, segments: segs, changes, after: { level: pr.level, xp: pr.xp, toNext: pr.toNext } });
    }
    const per = this.combatCfg.statPointsPerLevel, sk = this.combatCfg.pointsPerLevel;
    this.members().forEach((m, k) => {
      const d = m.data, n0 = this.allyNumbers(d, m.def), before = { level: d.level, xp: d.xp, toNext: xpToNext(this.combatCfg, d.level), st: d.statPoints, sk: d.skillPoints ?? 0 };
      const out = !!d.down, segs = !out && xp > 0 ? segments(d.level, d.xp, xp) : [];
      const changes: string[] = [];
      if (!out && xp > 0) {
        const ups = memberGainXp(d, xp, this.combatCfg, per, sk);
        if (ups) {
          this.log.add(`${m.def.name} reached level ${d.level}!`, 'level');
          const n1 = this.allyNumbers(d, m.def);
          change(changes, 'Max HP', n0.max.hp, n1.max.hp); change(changes, 'Max MP', n0.max.mp, n1.max.mp);
          gain(changes, 'stat point', d.statPoints - before.st); gain(changes, 'skill point', (d.skillPoints ?? 0) - before.sk);
        }
      }
      heroes.push({ key: `p${k + 1}`, name: m.def.name, icon: this.memberPortrait(m.def), color: this.heroColor(k + 1), out, level: before.level, xp: before.xp, toNext: before.toNext, gained: out ? 0 : xp, segments: segs, changes, after: { level: d.level, xp: d.xp, toNext: xpToNext(this.combatCfg, d.level) } });
    });
    return { xp, heroes, loot };
  }

  /* ------------------------------------------------------------------ party */

  /** A hero joining: their starting stats, the stat points their level would have given, their own gear, full health. */
  private newMember(def: HeroDef): MemberData {
    const per = this.combatCfg.statPointsPerLevel;
    const level = Math.max(1, Math.min(this.combatCfg.maxLevel ?? 99, def.joinLevel || this.progress.level));
    const abilities: AbilityData = {};
    mergeStarting(this.db, abilities, def);
    return { id: def.id, stats: heroBase(def), statPoints: (level - 1) * per, level, xp: 0, equip: { ...def.gear }, skills: {}, skillPoints: (level - 1) * this.combatCfg.pointsPerLevel,
      hp: this.stats.cfg.max.hp, mp: this.stats.cfg.max.mp, sp: this.stats.cfg.max.sp, abilities };
  }

  /** New game: the heroes marked "in the party at the start". */
  private startParty(): void {
    this.party.load(undefined);
    for (const def of (this.db.heroes ?? []).slice(1)) if (def.startsInParty && !this.party.full) this.party.members.push(this.newMember(def));
    if (this.inventory) this.ensureWornInBag();
  }

  /** Event command: a hero joins or leaves. */
  private changeParty(op: 'add' | 'remove', id: string, quiet = false): void {
    const def = (this.db.heroes ?? []).slice(1).find((h) => h.id === id);
    if (!def) return;
    if (op === 'add') {
      if (this.party.has(id)) return;
      if (this.party.full) { this.menu.notice(`The party is full (${MAX_PARTY + 1} at most)`); return; }
      this.party.members.push(this.newMember(def));
      // The gear they join with goes in the bag, worn by them.
      this.ensureWornInBag();
      if (!quiet) { this.log.add(`${def.name} joins the party!`, 'level'); this.audio.play('levelUp'); }
    } else {
      const m = this.party.get(id);
      if (!m) return;
      // Their gear was in the bag all along (in use): leaving, they just let go of it.
      this.party.members = this.party.members.filter((x) => x !== m);
      if (!quiet) this.log.add(`${def.name} leaves the party`, 'info');
    }
    this.spawnAllies();
  }

  /** Put the party members on this map, lined up behind the hero. */
  private spawnAllies(): void {
    for (const a of this.allies) a.dispose();
    this.allies = [];
    if (!this.level || this.onTitle) return;
    const p = this.motion, [bx, bz] = DIR_VECTOR[this.player.dir];
    this.trail = [];
    for (let k = 12; k >= 0; k--) this.trail.push({ x: p.x - bx * k * 0.3, z: p.z - bz * k * 0.3 });
    // Only the lineup's front follows the hero (the rest of the party isn't shown walking along).
    this.activeWhos().filter((w) => w > 0).map((w) => this.party.members[w - 1]).filter((m) => !!m).forEach((m, i) => {
      const def = this.db.heroes?.find((h) => h.id === m.id);
      if (!def) return;
      const look = this.db.characters[def.look ?? ''] ?? this.db.characters[this.db.player];
      const a = new Ally(m, def, this.sprites, look, this.level!, p.x, p.z, this.map);
      a.slot = i;
      const spot = this.trailPoint(1.1 * (i + 1));
      if (spot && !this.map.isBlocked(Math.floor(spot.x), Math.floor(spot.z))) a.place(spot.x, spot.z, this.map);
      a.face(this.player.dir);
      this.allies.push(a);
    });
  }

  /** A point on the hero's trail, `dist` tiles back along it. */
  private trailPoint(dist: number): { x: number; z: number } | null {
    const t = this.trail;
    if (!t.length) return null;
    let left = dist, prev = { x: this.motion.x, z: this.motion.z };
    for (let i = t.length - 1; i >= 0; i--) {
      const q = t[i], d = Math.hypot(q.x - prev.x, q.z - prev.z);
      if (d >= left) { const k = left / (d || 1); return { x: prev.x + (q.x - prev.x) * k, z: prev.z + (q.z - prev.z) * k }; }
      left -= d; prev = q;
    }
    return prev;
  }

  private updateParty(dt: number): void {
    if (!this.allies.length) return;
    // The trail: where the hero has walked on the ground (jumps and climbs are smoothed over).
    const m = this.motion, last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(m.x - last.x, m.z - last.z) > 0.2) { this.trail.push({ x: m.x, z: m.z }); if (this.trail.length > 120) this.trail.shift(); }
    const host = this.allyHost();
    for (const a of this.allies) a.update(dt, host);
    if (this.calmFor > 2.5) for (const a of this.allies) if (a.data.pendingXp) this.allyXp(a);
    // Condensed hero bars (Settings → HUD): the hero's card leads the party's.
    const pr = this.progress;
    const heroCard = this.settings.hud?.stats?.compact ? [{ name: mainHero(this.db).name, level: pr.level, face: this.portraitUrl ?? '', hp: this.stats.hp, maxHp: this.stats.cfg.max.hp, mp: this.stats.mp, maxMp: this.stats.cfg.max.mp, xp: pr.xp, toNext: pr.maxed ? 0 : pr.toNext, down: false }] : [];
    this.hud.setParty([...heroCard, ...this.allies.map((a) => { const n = this.allyNumbers(a.data, a.def); return { name: a.def.name, level: a.data.level, face: a.def.face ? this.resolveFile(a.def.face) : this.memberPortrait(a.def), hp: a.data.hp, maxHp: n.max.hp, mp: a.data.mp, maxMp: n.max.mp, xp: a.data.xp, toNext: xpToNext(this.combatCfg, a.data.level), down: a.down }; })]);
  }

  /** The fight is over: a party member's EXP from it (and a level-up, if it came). */
  private allyXp(a: Ally): void {
    const n = a.data.pendingXp ?? 0;
    delete a.data.pendingXp;
    if (n <= 0) return;
    const per = this.combatCfg.statPointsPerLevel;
    const sk = this.combatCfg.pointsPerLevel;
    const ups = memberGainXp(a.data, n, this.combatCfg, per, sk);
    this.overlay.float(`+${n} EXP`, a.x, a.y + 1.5, a.z, 'xp');
    this.log.add(`${a.def.name} +${n} EXP`, 'xp');
    if (!ups) return;
    this.log.add(`${a.def.name} reached level ${a.data.level}! +${ups * sk} skill point${ups * sk === 1 ? '' : 's'} +${ups * per} stat point${ups * per === 1 ? '' : 's'}`, 'level');
    this.audio.play('levelUp', a.x, a.z);
    this.bursts.spawn(a.x, a.y + 0.6, a.z, { color: '#ffe48a', n: 22, speed: 1.4, up: 3, life: 0.9, size: 0.08, gravity: 2, additive: true });
  }

  private allyHostCache: AllyHost | null = null;
  private allyHost(): AllyHost {
    const g = this;
    return (this.allyHostCache ??= {
      get map() { return g.map; },
      trailPoint: (d) => this.trailPoint(d),
      get leader() { return g.player.position as unknown as { x: number; y: number; z: number }; },
      threats: () => {
        const p = this.player.position;
        return this.combat.enemies.filter((e) => !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < 13);
      },
      get calm() { return g.calmFor > 3; },
      numbers: (m, def) => this.allyNumbers(m, def),
      strike: (a, e, dmg, el, inf) => this.combat.allyStrike(a, e, dmg, el, inf),
      shoot: (a, kind, tx, ty, tz, dmg, color, el) => this.combat.allyShoot(a, kind, tx, ty, tz, dmg, color, el),
      healTargets: () => [
        { name: mainHero(this.db).name, x: this.player.position.x, z: this.player.position.z, hp: this.stats.hp, max: this.stats.cfg.max.hp, heal: (n: number) => this.stats.change('hp', 'add', n) },
        ...this.allies.filter((a) => !a.down).map((a) => ({ name: a.def.name, x: a.x, z: a.z, hp: a.data.hp, max: this.allyNumbers(a.data, a.def).max.hp, heal: (n: number) => { a.data.hp = Math.min(this.allyNumbers(a.data, a.def).max.hp, a.data.hp + n); } })),
      ],
      float: (t, x, y, z, k) => this.overlay.float(t, x, y, z, k),
      sound: (n, x, z) => this.audio.play(n === 'swing' ? 'swing' : n === 'heal' ? 'ringOn' : n, x, z),
      log: (t) => this.log.add(t, 'info'),
      sparkle: (x, y, z, color) => this.bursts.spawn(x, y, z, { color, n: 14, speed: 1, up: 2, life: 0.6, size: 0.08, additive: true }),
    });
  }

  /** What a party member fights with: their stats and gear, like the hero's (no skill-tree bonuses). */
  /** A party member's own skill tree (ranks they've learned). */
  memberSkills(m: MemberData): Skills {
    m.skills ??= {};
    let s = this.memberSkillCache.get(m.id);
    if (!s || s.ranks !== m.skills || s.data !== this.skills.data) { s = new Skills(this.skills.data, m.skills); this.memberSkillCache.set(m.id, s); }
    return s;
  }
  private readonly memberSkillCache = new Map<string, Skills>();

  private allyNumbers(m: MemberData, def: HeroDef): AllyNumbers {
    const sk = this.memberSkills(m), pct = (k: Parameters<Skills['get']>[0]) => 1 + sk.get(k) / 100;
    const t = heroTotals(m.stats, this.wornGear(m.equip), (k) => sk.get(k));
    const g = (slot: EquipSlot) => (m.equip[slot] ? this.items.get(m.equip[slot]!) : undefined);
    const w = g('weapon'), cls = w?.weapon && w.weapon.class !== 'bow' ? w.weapon.class : 'unarmed';
    const ct = this.combatCfg.classes[cls];
    const classPct = cls === 'light' ? pct('lightDamage') : cls === 'medium' ? pct('mediumDamage') : cls === 'heavy' ? pct('heavyDamage') : 1;
    const melee = (cls === 'unarmed' ? this.combatCfg.unarmedDamage : w!.weapon!.damage) * ct.damage * powerMultiplier(t.attrs.str) * pct('meleeDamage') * classPct;
    // A learned spell readied for the field takes the place of a spell shard.
    const bowDef = g('ranged'), shard = this.readiedSpell(m.abilities ?? {}) ?? g('magic');
    const base = playerConfig(this.db.stats).max;
    return {
      max: { hp: base.hp + sk.get('maxHp'), mp: base.mp + sk.get('maxMp'), sp: base.sp + sk.get('maxSp') },
      melee, meleeElement: w?.element ?? 'neutral', meleeInflicts: w?.inflicts,
      swing: SWING_TIME / (ct.speed * speedMultiplier(t.attrs.dex)),
      bow: bowDef?.weapon ? bowDef.weapon.damage * powerMultiplier(t.attrs.str) * pct('bowDamage') : 0, bowElement: bowDef?.element ?? 'neutral',
      spell: shard?.spell ? (shard.spell.damage ?? this.combatCfg.fire.damage) * powerMultiplier(t.attrs.mag) * pct('spellDamage') : 0,
      spellMp: Math.round((shard?.spell?.mp ?? this.combatCfg.fire.mp) * (1 - Math.min(75, sk.get('spellCost')) / 100)), spellColor: shard?.spell?.color, spellElement: shard?.element ?? 'neutral',
      heal: Math.round(22 * powerMultiplier(t.attrs.mag)),
      crit: t.crit, armour: t.armour, magicArmour: t.magicArmour,
      elements: def.elements ?? [],
    };
  }

  private confirmQuit(): void {
    this.menu.push('Quit to title?', [
      { label: 'No, keep playing', pick: () => this.menu.back() },
      { label: 'Quit to title', pick: () => this.quitToTitle() },
    ], { note: 'Anything since your last save will be lost.' });
  }

  /** Save slots. From a save point (event command), it closes the whole menu afterwards. */
  private saveFromEvent = false;
  private readonly cloudOff = { x: 0, z: 0 };
  private openSaveScreen(fromEvent: boolean): void {
    this.saveFromEvent = fromEvent;
    this.saveScreen.show('save', () => { if (fromEvent) this.menu.close(); }, 'Saving into a slot replaces what’s there.');
  }

  private openLoadScreen(): void {
    // Back on the title with every save deleted: Load Game is greyed out again.
    this.saveScreen.show('load', () => { if (this.onTitle && !this.saves.latest()) this.openTitle(); }, this.onTitle ? '' : 'Progress since your last save will be lost.');
  }

  /** Settings: the same screen from the title's Options and the pause menu. Changes apply at once and are kept. */
  private openSettings(opts: { tabs?: TabGroup; onBack?: () => void } = {}): void {
    const st = this.settings;
    const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => { st[k] = v; this.applySettings(); this.settingsStore.save(st); };
    const pct = (v: number) => `${v}%`;
    const title = this.onTitle ? titleLabel(this.db.menus, 'options') : pauseLabel(this.db.menus, 'settings');
    const picture = () => this.menu.push('Picture', [
      { label: 'Brightness', slider: { value: Math.round(st.brightness * 100), min: 60, max: 140, step: 5, format: pct, set: (v) => set('brightness')(v / 100) } },
      { label: 'Quality', detail: 'High: sharpest. Balanced and Performance draw fewer pixels and lighter shadows for a steadier frame rate on tablets and older computers.',
        choice: { value: st.quality ?? 'auto', options: [['auto', 'Automatic'], ['high', 'High'], ['balanced', 'Balanced'], ['performance', 'Performance']], set: (v) => set('quality')(v as Settings['quality']) } },
      { label: 'Show frame rate', toggle: { value: !!st.showFps, set: set('showFps') } },
      { label: 'Bloom (glow)', toggle: { value: st.bloom, set: set('bloom') } },
      { label: 'Depth of field', toggle: { value: st.depthOfField, set: set('depthOfField') } },
      { label: 'Shadows', toggle: { value: st.shadows, set: set('shadows') } },
      { label: 'Ambient occlusion', detail: 'Soft shade where the ground meets cliffs, walls and steps (not on characters or props). Off on Performance quality.', toggle: { value: st.ambientOcclusion, set: set('ambientOcclusion') } },
      { label: 'Shadows from lamps and fires', toggle: { value: st.lightShadows, set: set('lightShadows') } },
      { label: 'Detailed lighting', detail: 'Normal maps. Turn off on slower computers.', toggle: { value: st.detailedLighting, set: set('detailedLighting') } },
    ], { note: 'Left / right change a setting.' });
    const sound = () => this.menu.push('Sound', [
      { label: 'Master volume', detail: 'Everything at once.', slider: { value: st.masterVolume, min: 0, max: 100, step: 5, format: pct, set: (v) => { set('masterVolume')(v); this.audio.play('menuOk'); } } },
      { label: 'Music', slider: { value: st.musicVolume, min: 0, max: 100, step: 10, format: pct, set: set('musicVolume') } },
      { label: 'Sound effects', slider: { value: st.soundVolume, min: 0, max: 100, step: 10, format: pct, set: (v) => { set('soundVolume')(v); this.audio.play('item'); } } },
      { label: 'Background sounds', detail: 'Wind, birds, crickets, water…', slider: { value: st.ambienceVolume, min: 0, max: 100, step: 10, format: pct, set: set('ambienceVolume') } },
      { label: 'Menus and text', detail: 'Menu clicks and the letter ticks of messages.', slider: { value: st.uiVolume, min: 0, max: 100, step: 10, format: pct, set: (v) => { set('uiVolume')(v); this.audio.play('menuOk'); } } },
      { label: 'Fanfares and chimes', detail: 'Victory, level up, quests, saving.', slider: { value: st.jingleVolume, min: 0, max: 100, step: 10, format: pct, set: (v) => { set('jingleVolume')(v); this.audio.play('expDing'); } } },
      { label: 'Footsteps', detail: 'The hero’s footsteps, sounding like the ground underfoot.', toggle: { value: st.footsteps, set: set('footsteps') } },
      { label: 'Letter ticks', detail: 'A soft tick as the letters of a message appear.', toggle: { value: st.textTicks !== false, set: (v) => set('textTicks')(v ? undefined : false) } },
    ], { note: 'Left / right change a volume.' });
    const gameplay = () => this.menu.push('Gameplay', [
      { label: 'Easy-to-read text', detail: 'Plain, smooth letters instead of the game’s pixel font.', toggle: { value: !!st.easyText, set: (v) => set('easyText')(v || undefined) } },
      { label: 'Text boxes', detail: 'Above or below whoever is talking (as a speech bubble), or fixed on screen.', choice: { value: st.textBox ?? 'above', options: [['above', 'Above speaker'], ['below', 'Below speaker'], ['top', 'Top of screen'], ['bottom', 'Bottom of screen'], ['center', 'Centre of screen']], set: (v) => set('textBox')(v as Settings['textBox']) } },
      { label: 'Text speed', choice: { value: st.textSpeed, options: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']], set: (v) => set('textSpeed')(v as Settings['textSpeed']) } },
      { label: 'Adventure log', detail: 'On screen: everything, everything but hits, or nothing. The full log is always in the menu.', choice: { value: st.adventureLog, options: [['all', 'All'], ['noCombat', 'No hits'], ['off', 'Off']], set: (v) => set('adventureLog')(v as Settings['adventureLog']) } },
      { label: 'Always run', detail: 'Hold Run to walk instead.', toggle: { value: st.alwaysRun, set: set('alwaysRun') } },
      { label: 'Sneak / crouch', detail: 'Hold: sneak while the button is held. Toggle: press once to start, again to stop.', choice: { value: st.crouch, options: [['hold', 'Hold'], ['toggle', 'Toggle']], set: (v) => set('crouch')(v as Settings['crouch']) } },
      { label: 'Sprint', detail: 'Hold: run while the run button is held (X on a controller, Shift on a keyboard). Toggle: press once to start running, again to stop (controller and touch button).', choice: { value: st.sprint, options: [['hold', 'Hold'], ['toggle', 'Toggle']], set: (v) => set('sprint')(v as Settings['sprint']) } },
      { label: 'Run with a full stick push', detail: 'Controller: push the stick all the way to run.', toggle: { value: st.stickRun, set: set('stickRun') } },
      { label: 'Tap to walk', detail: 'Tap or click the ground to walk there, or a person to go and talk to them.', toggle: { value: !!st.tapToWalk, set: (v) => { set('tapToWalk')(v || undefined); if (!v) { this.cursor.visible = false; this.moveTarget = null; } } } },
      { label: 'Clock', choice: { value: st.clock12 ? '12' : '24', options: [['24', '24-hour'], ['12', '12-hour']], set: (v) => set('clock12')(v === '12') } },
    ], { note: 'Left / right change a setting.' });
    const controls = () => this.controls.show(this.input.current, (b) => { st.bindings = b; st.bindingsVersion = BINDINGS_VERSION; this.applySettings(); this.settingsStore.save(st); }, () => {});
    const hudMenu = () => this.menu.push('HUD', [
      { label: 'Arrange and resize…', detail: 'Move the health bars, clock, weapons and EXP bar; make them bigger or smaller.', pick: () => {
        // On the title the HUD is hidden: show it while arranging.
        if (this.onTitle) { this.hud.setHidden(false); this.log.setHidden(false); this.tracker.setHidden(false); }
        this.arranger.show(this.hud.widgets, st.hud, (l) => { st.hud = Object.keys(l).length ? l : undefined; this.settingsStore.save(st); }, () => { if (this.onTitle) { this.hud.setHidden(true); this.log.setHidden(true); this.tracker.setHidden(true); } });
      } },
      { label: 'Hero bars', detail: 'Long: across the top. Condensed: a card like the party’s (with them).', choice: { value: st.hud?.stats?.compact ? 'compact' : 'long', options: [['long', 'Long'], ['compact', 'Condensed']], set: (v) => piece('stats', { compact: v === 'compact' || undefined }) } },
      { label: 'Show hero bars', toggle: { value: !st.hud?.stats?.hidden, set: (v) => piece('stats', { hidden: v ? undefined : true }) } },
      { label: 'Show party bars', toggle: { value: !st.hud?.party?.hidden, set: (v) => piece('party', { hidden: v ? undefined : true }) } },
      { label: 'Stamina ring', detail: 'A green ring that shows while stamina is used and fades once it’s full.', toggle: { value: !st.hud?.stamina?.hidden, set: (v) => piece('stamina', { hidden: v ? undefined : true }) } },
      { label: 'Mini-map', detail: 'A round map of where you are, under the clock.', toggle: { value: !st.hud?.minimap?.hidden, set: (v) => piece('minimap', { hidden: v ? undefined : true }) } },
      { label: 'Season picture', detail: 'Blossom, sun, falling leaves or snow behind the clock.', toggle: { value: st.hud?.clock?.art !== false, set: (v) => piece('clock', { art: v ? undefined : false }) } },
      { label: 'Faces', detail: 'Faces beside the hero’s and the party’s bars.', toggle: { value: !!st.hud?.party?.face, set: (v) => { piece('stats', { face: v || undefined }); piece('party', { face: v || undefined }); } } },
      { label: 'Put the HUD back', detail: 'Default places and sizes.', pick: () => { delete st.hud; this.applySettings(); this.settingsStore.save(st); this.menu.notice('HUD reset'); } },
    ]);
    // Change one piece's style (Settings → HUD), keeping where it was put.
    const piece = (w: HudWidget, change: Record<string, unknown>) => {
      const hud = (st.hud ??= {}), p = { ...(hud[w] ?? {}), ...change } as Record<string, unknown>;
      for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
      if (Object.keys(p).length) hud[w] = p; else delete hud[w];
      if (!Object.keys(hud).length) delete st.hud;
      this.applySettings(); this.settingsStore.save(st);
    };
    this.menu.push(title, [
      { label: 'Picture', pick: picture },
      { label: 'HUD', detail: 'Arrange and resize', pick: hudMenu },
      { label: 'Sound', pick: sound },
      { label: 'Controls', detail: 'Keyboard and controller', pick: controls },
      { label: 'Gameplay', pick: gameplay },
      { label: 'Save settings to a file', detail: 'HUD layout, controls and everything else, to bring to another copy of the game.', pick: () => {
        exportSettings(st, this.db.title || 'game');
        this.menu.notice('Settings file downloaded');
      } },
      { label: 'Load settings from a file…', detail: 'A file saved with the option above.', pick: () => {
        const r = importSettings();
        if ('needsClick' in r) { this.menu.notice('Click this option, or press Enter on it, to choose a file'); return; }
        r.then((loaded) => {
          if (!loaded) return;
          for (const k of Object.keys(st) as (keyof Settings)[]) delete st[k];
          Object.assign(st, loaded);
          this.applySettings(); this.settingsStore.save(st);
          this.menu.notice('Settings loaded');
        }, (e: Error) => this.menu.notice(e.message));
      } },
      { label: 'Restore defaults', detail: 'Everything, controls and HUD too', pick: () => { delete st.bindings; delete st.bindingsVersion; delete st.hud; Object.assign(st, this.settingsStore.defaults()); this.applySettings(); this.settingsStore.save(st); this.menu.notice('Settings restored'); } },
    ], { note: 'Settings are yours: they stay the same whichever save is loaded.', ...opts });
  }

  /** Push the settings into the renderer, lights and message window. */
  private applySettings(): void {
    const st = this.settings;
    this.post.settings.bloom = st.bloom;
    this.post.settings.tiltShift = st.depthOfField;
    // Ambient occlusion: half-size on High (or Automatic on a computer), quarter-size on Balanced, off on Performance and on Automatic on phones and tablets.
    const q = st.quality ?? 'auto';
    const aoScale = q === 'balanced' ? 4 : 2;
    this.ssao.enabled = st.ambientOcclusion && q !== 'performance' && !(q === 'auto' && this.small);
    if (this.ssao.scale !== aoScale) { this.ssao.scale = aoScale; this.resizeAO(); }
    this.sun.castShadow = st.shadows;
    // Sharper or lighter picture (quality): the drawing resolution and the sun's shadow detail.
    const sm = st.quality === 'balanced' || st.quality === 'performance' || (st.quality === 'auto' && this.small) ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== sm) { this.sun.shadow.mapSize.set(sm, sm); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget; }
    if (this.renderer.getPixelRatio() !== Math.min(window.devicePixelRatio || 1, this.pixelCap)) this.resize();
    this.lights?.shadowLights.forEach((l) => (l.castShadow = st.lightShadows));
    this.rings?.setShadows(st.lightShadows);
    setNormalMapsEnabled(st.detailedLighting);
    setTextSpeed(TEXT_SPEEDS[st.textSpeed]);
    if (this.log) { this.log.feed = st.adventureLog; if (st.adventureLog === 'off') this.log.clearFeed(); }
    this.message?.setPlace(st.textBox ?? 'above');
    // The lettering: the game's (Database → Title & menus), or easy-to-read when the player asks for it.
    document.documentElement.dataset.font = st.easyText ? 'smooth' : this.db?.menus?.font ?? 'classic';
    this.input.setBindings(st.bindings ?? DEFAULT_BINDINGS);
    this.audio?.setVolumes({ master: st.masterVolume, music: st.musicVolume, sfx: st.soundVolume, ambience: st.ambienceVolume, ui: st.uiVolume, jingle: st.jingleVolume });
    this.hud?.applyLayout(st.hud);
  }

  /* ------------------------------------------------------------------ title screen */

  private openTitle(): void {
    const m = this.db.menus, hasSave = !!this.saves.latest();
    this.onTitle = true;
    this.audio.music(this.db.audio?.titleMusic ?? 'builtin:title', 1.5);
    this.setTitleLook(true);
    const opt = (o: TitleOption, item: Omit<MenuItem, 'label'>): MenuItem[] => (m?.titleHidden?.[o] ? [] : [{ label: titleLabel(m, o), ...item }]);
    this.menu.close();
    this.menu.push(m?.titleText?.trim() || this.db.title || 'Untitled', [
      ...opt('newGame', { pick: () => this.startNewGame() }),
      ...opt('load', { disabled: !hasSave, pick: () => this.openLoadScreen() }),
      ...opt('options', { pick: () => this.openSettings() }),
      ...opt('credits', { pick: () => this.creditsScreen.show(m?.titleText?.trim() || this.db.title || 'Credits', creditSections(this.db, (id) => this.sprites.weaponDef(id), [...this.sprites.catalog.all(), ...this.tiles.all()].map((d) => d.credits ?? [])), () => {}) }),
      ...opt('exit', { pick: () => this.exitGame() }),
    ], { canBack: false, style: 'title', subtitle: m?.subtitle ?? '' });
    // Continue is the natural first choice when there's a save; otherwise New Game.
  }

  private leaveTitle(then: () => void): void {
    this.onTitle = false;
    // The HUD stays out of sight while the game loads, and fades in with the picture.
    document.body.classList.add('ui-dim');
    this.setTitleLook(false);
    this.menu.close();
    then();
  }

  /** A picture or video behind the title (Database → Title & menus), shown on the title and faded away after. */
  private titleBgEl: HTMLImageElement | HTMLVideoElement | null = null;
  private get titleCovered(): boolean {
    const tb = this.db.menus?.titleBackground;
    return this.onTitle && !!tb && ((tb.kind === 'image' && !!tb.image) || (tb.kind === 'video' && !!tb.video));
  }
  private showTitleBackground(on: boolean): void {
    const tb = this.db.menus?.titleBackground;
    const media = tb?.kind === 'image' ? tb.image : tb?.kind === 'video' ? tb.video : undefined;
    if (on && tb && media) {
      if (!this.titleBgEl) {
        const el = tb.kind === 'video' ? Object.assign(document.createElement('video'), { autoplay: true, muted: true, loop: true, playsInline: true }) : document.createElement('img');
        el.className = 'title-bg';
        el.src = this.resolveFile(media);
        if (el instanceof HTMLImageElement) el.alt = '';
        document.body.append(el);
        this.titleBgEl = el;
      }
      this.titleBgEl.classList.remove('gone');
      if (this.titleBgEl instanceof HTMLVideoElement) void this.titleBgEl.play().catch(() => { /* starts after the first click */ });
    } else if (this.titleBgEl) {
      this.titleBgEl.classList.add('gone');
      if (this.titleBgEl instanceof HTMLVideoElement) { const v = this.titleBgEl; setTimeout(() => { if (v.classList.contains('gone')) v.pause(); }, 1300); }
    }
  }

  /** The game is on screen: the HUD fades in. */
  private uiIn(): void { requestAnimationFrame(() => document.body.classList.remove('ui-dim')); }

  /** On the title the hero, status bars and touch buttons are hidden, and the camera drifts slowly. */
  private setTitleLook(on: boolean): void {
    this.showTitleBackground(on);
    this.player.mesh.visible = !on;
    this.hud.setHidden(on);
    this.overlay.setHidden(on);
    this.log.setHidden(on);
    this.tracker.setHidden(on);
    this.touch.setHidden(on);
  }

  /** New Game: character creation first (when it's on), then the game. Backing out returns to the title. */
  private startNewGame(): void {
    const c = creation(this.db);
    if (!c.enabled) { this.leaveTitle(() => this.newGame()); return; }
    this.menu.close();
    this.creation.show({ heroName: mainHero(this.db).name, methods: c.methods, rerolls: c.rerolls, rerollKey: this.input.label('switchWeapon') },
      (attrs) => this.leaveTitle(() => this.newGame(attrs)),
      () => this.openTitle());
  }

  /** A fresh game: everything back to the database's starting values (stats from creation), at the player start. */
  private newGame(attrs?: Attrs): void {
    const st = this.db.start;
    this.interpreter.stop();
    this.requestTransfer(this.db.startMap, { x: st.x, z: st.z, dir: st.dir }, 'black', {
      slow: true,
      after: () => this.uiIn(),
      before: () => {
        this.bankPickups('discard');
        this.log.clearFeed();
        this.state.load({});
        this.applyForge();
        this.state.initAbilities(this.db.abilities);
        this.stats.refill();
        this.time.set(this.db.startHour, true);
        this.respawnPoint = null;
        this.playTime = 0;
        this.inventory.load(Inventory.fresh(this.db).toJSON(), this.bagSize);
        this.progress.load(undefined, attrs ?? this.heroBase());
        this.combat.heroStatus.clear();
        this.quests.load(undefined);
        this.startParty();
        this.ensureWornInBag();
        this.syncSkills();
        this.rings.off();
        this.refreshRing();
      },
      fresh: true,
    });
  }

  private quitToTitle(): void {
    this.battle.abort();
    this.battleSound = null; this.outro = null;
    this.menu.close();
    this.interpreter.stop();
    // Back to the start map behind the title, everything reset (New Game or Load picks up from here).
    const st = this.db.start;
    // Back to the map behind the title (its own, or the start map).
    const tb = this.db.menus?.titleBackground, titleMap = tb?.kind === 'map' && tb.map ? tb.map : this.db.startMap;
    this.requestTransfer(titleMap, titleMap === this.db.startMap && !(tb?.kind === 'map' && tb.map) ? { x: st.x, z: st.z, dir: st.dir } : { x: tb?.x ?? 0.5, z: tb?.z ?? 0.5 }, 'black', {
      slow: true,
      before: () => { this.bankPickups('discard'); this.log.clearFeed(); this.state.load({}); this.applyForge(); this.state.initAbilities(this.db.abilities); this.stats.refill(); this.time.set(this.db.startHour, true); this.respawnPoint = null; this.playTime = 0; this.inventory.load(Inventory.fresh(this.db).toJSON(), this.bagSize); this.progress.load(undefined, this.heroBase()); this.combat.heroStatus.clear(); this.quests.load(undefined); this.party.load(undefined); this.heroAt = 0; this.visited.clear(); this.explored.clear(); this.syncSkills(); this.rings.off(); this.refreshRing(); },
      fresh: true,
      after: () => this.openTitle(),
    });
  }

  /** Exit: closes the window when the browser allows it (a desktop build will quit). */
  private exitGame(): void {
    window.close();
    // Browsers only let scripts close tabs they opened; if we're still here, say so.
    window.setTimeout(() => this.menu.notice('You can close this tab now.', 4), 150);
  }

  private updateDying(dt: number): boolean {
    if (!this.dying) return false;
    this.dying += dt;
    if (this.drowning) {
      // Sinking: down below the surface, bubbles rising, the water closing over.
      const m = this.motion, w = this.map.waterAt(Math.floor(m.x), Math.floor(m.z));
      if (w && m.y > w.surface - 1.6) m.y -= dt * 0.9;
      this.syncPlayer();
      if (w && Math.random() < dt * 9) this.bursts.spawn(m.x + (Math.random() - 0.5) * 0.3, w.surface + 0.02, m.z, { color: '#dff4ff', n: 2, speed: 0.3, up: 1.2, life: 0.5, size: 0.05, gravity: -1 });
      if (w && Math.random() < dt * 2) this.ripples.spawn(m.x, w.surface, m.z, 0.7, 0.5);
    }
    if (this.fade.t >= 1 && this.dying > 0.7) {
      // Back to the last respawn point used, or the player start, with everything refilled.
      this.dying = 0;
      this.drowning = false;
      this.player.clearAction();
      this.stats.refill();
      const r = this.respawnPoint ?? { map: this.db.startMap, x: this.db.start.x, z: this.db.start.z, dir: this.db.start.dir };
      this.requestTransfer(r.map, { x: r.x, z: r.z, dir: r.dir }, 'none');
      this.post.fade = 1;
      this.transferFadeIn = true;
    }
    return true;
  }

  /** Put the sprite where the motion says, squashed down while crawling. */
  private syncPlayer(dt = 0): void {
    const m = this.motion, p = this.player.position;
    p.set(m.x, m.y, m.z);
    this.crouch += ((m.crawling ? 1 : this.combat.sneaking ? 0.3 : 0) - this.crouch) * (dt ? 1 - Math.exp(-dt * 14) : 1);
    this.player.mesh.scale.set(1 + this.crouch * 0.12, 1 - this.crouch * 0.42, 1);
    this.touch?.update((a) => this.state.has(a));
  }

  private updateFade(dt: number): void {
    const f = this.fade;
    if (f.t >= 1) {
      if (this.fadeColorReset) { this.fadeColorReset = false; this.post.fadeColor = 0x000000; }
      return;
    }
    f.t = Math.min(1, f.t + dt / f.duration);
    this.post.fade = f.from + (f.to - f.from) * f.t;
  }

  private readonly projected = new THREE.Vector3();
  /** A point in the world to a point on screen (CSS pixels), and whether it's in view. */
  private readonly projector = (x: number, y: number, z: number) => {
    const v = this.projected.set(x, y, z).project(this.camera), r = this.canvas.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * r.width + r.left, y: (1 - v.y) / 2 * r.height + r.top, on: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  };
  private readonly titleFocus = new THREE.Vector3();
  private updateCamera(dt: number): void {
    if (this.stage) { this.updateStageCamera(dt); return; }
    const t = this.camTarget;
    if (this.onTitle) {
      // Drift slowly across the map behind the title.
      const a = this.elapsed * 0.05, tb = this.db.menus?.titleBackground;
      // Its own map: a slow look around the chosen spot; otherwise a drift across the map.
      if (tb?.kind === 'map' && tb.map) this.titleFocus.set((tb.x ?? this.map.w / 2) + Math.sin(a * 2) * 2, this.map.surfaceY(tb.x ?? 0, tb.z ?? 0), (tb.z ?? this.map.h / 2) + Math.cos(a * 1.4) * 1.2);
      else this.titleFocus.set(this.map.w / 2 + Math.sin(a) * this.map.w * 0.3, this.player.position.y, this.map.h / 2 + Math.cos(a * 0.7) * this.map.h * 0.2);
      t.lerp(this.titleFocus, 1 - Math.exp(-dt * 0.8));
    } else t.lerp(this.player.position, 1 - Math.exp(-dt * 5));
    // The view stays inside the map, except toward seamless sides (the next map is there to see).
    const o = this.openSides;
    t.x = clamp(t.x, o.has('w') ? -1e4 : 7, o.has('e') ? 1e4 : this.map.w - 7);
    t.z = clamp(t.z, o.has('n') ? -1e4 : 5, o.has('s') ? 1e4 : this.map.h - 2);
    this.camera.position.copy(t).add(CAMERA_OFFSET);
    this.camera.lookAt(t.x, t.y + 0.6, t.z);
    const sh = this.combat.shake;
    if (sh > 0) this.camera.position.add(this.projected.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0));
    // Keep the player in the sharp band of the tilt-shift.
    this.projected.copy(this.player.position);
    this.projected.y += 0.7;
    this.projected.project(this.camera);
    this.post.focus = clamp(this.projected.y * 0.5 + 0.5, 0.25, 0.75);
    // The sun's shadow camera follows the view so shadows stay sharp.
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).addScaledVector(this.time.sunDir, 30);
  }

  /** Whose weather this map shows: the shared outdoor weather, its zone's, or its own. */
  private weatherKey(): string {
    const d = this.mapData;
    if (!(d.uniqueWeather ?? d.weather !== undefined)) return WORLD_WEATHER;
    return d.weatherZone?.trim() ? `zone:${d.weatherZone.trim()}` : `map:${this.mapName}`;
  }

  /**
   * This map's weather and breeze. Outdoor maps share one weather (set in the Database, changed by events) unless
   * they have Unique weather; indoor and dark maps show none unless they do.
   */
  private mapWeather(): { kind: WeatherKind; amount: number; wind: number; dir: number } {
    const d = this.mapData, outdoor = (d.environment ?? 'outdoor') === 'outdoor', key = this.weatherKey(), shared = key === WORLD_WEATHER;
    // An event's change (saves from before sharing kept it under the map's name).
    const o = this.state.weather.get(key) ?? (shared ? undefined : this.state.weather.get(this.mapName));
    const start = shared ? this.db.weather : d.weather;
    const show = !shared || outdoor;
    const kind = show ? o?.kind ?? start?.kind ?? 'none' : 'none';
    const amount = kind === 'none' ? 0 : o ? o.amount ?? 1 : start?.amount ?? 1;
    const wind = (show ? o?.wind : undefined) ?? d.wind?.strength ?? (outdoor ? 0.3 : 0);
    return { kind, amount, wind, dir: d.wind?.dir ?? 15 };
  }

  private updateWeather(dt: number): void {
    const w = this.mapWeather();
    updateWind(this.elapsed, w.wind, w.dir);
    if (this.weatherPending && this.level) {
      this.weatherPending = false;
      this.weather.attach(this.level, w.kind, w.amount, this.camTarget);
      this.atmosphere.attach(this.level, this.camTarget);
    }
    // In a battle on a battle map, the weather falls around the battle.
    const center = this.stage ? this.stage.look : this.camTarget, ground = this.stage ? this.stage.map : this.map;
    this.weather.update(dt, center, this.elapsed, (x, z) => ground.surfaceY(x, z));
    // Rain dims the day; a sandstorm closes in the view.
    const rain = this.weather.rain, haze = this.weather.haze;
    this.time.gloom = rain;
    this.time.haze = haze;
    const air = this.stage?.stage.data.atmosphere ?? this.mapData.atmosphere, outdoor = this.time.environment === 'outdoor';
    const thick = Math.min(1, Math.max(air?.haze ?? 0, outdoor ? haze * 0.75 + rain * 0.25 : 0));
    this.fog.near = 22 - 16 * thick;
    this.fog.far = 50 - 30 * thick;
    // Mist (perhaps only around dawn or after dark) and sun rays (only while the sun is out).
    const hour = this.time.hour, night = this.time.night;
    const when = air?.mistWhen ?? 'always';
    const mistTime = when === 'morning' ? clamp(1 - Math.abs(hour - 6.5) / 3, 0, 1) : when === 'night' ? night : 1;
    const sun = outdoor ? clamp(this.sun.intensity / 1.5, 0, 1) * (1 - night) * (1 - 0.9 * rain) * (1 - 0.8 * haze) : this.time.environment === 'indoor' ? (1 - night) * 0.6 : 0;
    // Rays slant no flatter than about 30° (a low dawn sun would otherwise lay them along the ground).
    this.sunUp.copy(this.time.sunDir); this.sunUp.y = Math.max(this.sunUp.y, 0.55); this.sunUp.normalize();
    // Cloud shadows: drifting with the wind (at least a slow crawl on a still day).
    const cl = outdoor ? air?.clouds ?? 0 : 0;
    if (cl > 0) {
      const speed = 0.35 + wind.strength * 1.6;
      this.cloudOff.x -= wind.dx * speed * dt; this.cloudOff.z -= wind.dz * speed * dt;
    }
    setClouds(this.cloudOff.x, this.cloudOff.z, Math.min(0.85, cl * 0.7) * (outdoor ? clamp(this.sun.intensity / 1.5, 0, 1) * (1 - night) * (1 - 0.7 * rain) : 0));
    this.atmosphere.update(dt, center, this.elapsed, (x, z) => ground.surfaceY(x, z), {
      mist: (air?.mist ?? 0) * mistTime, rays: air?.rays ?? 0, skyColor: this.fog.color, sunColor: this.sun.color, sun, sunDir: this.sunUp,
    }, this.camera);
  }

  private updateEnvironment(dt: number): void {
    this.updateWeather(dt);
    const night = this.time.night;
    this.lights.update(dt, this.elapsed, night, this.state);
    if (this.stage) {
      this.stage.lights.update(dt, this.elapsed, night, this.state);
      for (const f of this.stage.built.waterFlows) {
        const fd = THREE.MathUtils.degToRad(f.flowDir);
        f.tex.offset.x += (0.03 - Math.cos(fd) * f.flow * 0.45) * dt;
        f.tex.offset.y += (0.018 - Math.sin(fd) * f.flow * 0.45) * dt;
      }
    }
    // Outside, windows light up at night; inside they show daylight and go dark at night.
    const env = this.time.environment;
    setSpriteGlow(env === 'outdoor' ? scheduleFactor('night', this.time.glow) : this.time.glow);
    this.fireflies.update(this.elapsed, env === 'outdoor' ? night : 0);
    this.rings.reach = 1 + (this.skills?.get('lightReach') ?? 0) / 100;
    this.rings.update(dt, this.player.position, this.player.dir, !this.onTitle, this.elapsed);
    this.bursts.update(dt);
    this.updateCharring(dt);
    this.updateSeason();
    this.ripples.update(dt);
    // The water's ripples drift; a flowing river or stream carries them along its current.
    this.waterFlow.x += 0.03 * dt; this.waterFlow.y += 0.018 * dt;
    this.waterNormals.offset.set(this.waterFlow.x, this.waterFlow.y);
    // Each style's ripples: a gentle drift, carried along by its current (a river, a stream).
    for (const f of this.waterFlows) {
      const fd = THREE.MathUtils.degToRad(f.flowDir);
      f.tex.offset.x += (0.03 - Math.cos(fd) * f.flow * 0.45) * dt;
      f.tex.offset.y += (0.018 - Math.sin(fd) * f.flow * 0.45) * dt;
    }
    this.post.exposure = this.time.exposure * 1.1 * this.settings.brightness;
  }
}
