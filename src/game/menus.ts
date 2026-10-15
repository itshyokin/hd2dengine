/** Default wording of the title screen and pause menu, and which pause entries work yet. */
import type { MenuConfig, PauseOption, TitleOption } from '../world/types';

export const TITLE_OPTIONS: [TitleOption, string][] = [
  ['newGame', 'New Game'], ['load', 'Load Game'], ['options', 'Options'], ['credits', 'Credits'], ['exit', 'Exit'],
];

export const PAUSE_OPTIONS: [PauseOption, string, boolean][] = [
  // [id, default name, works yet]
  ['items', 'Inventory', true],
  ['status', 'Party', true],
  ['journal', 'Journal', true],
  ['settings', 'Settings', true],
  ['saveLoad', 'Save / Load', true],
  ['quitToTitle', 'Quit to Title', true],
];

/** Older entries, now tabs (the Inventory's Status; the Journal's quests and log): names kept for old databases. */
const OLD_PAUSE: Partial<Record<PauseOption, string>> = { log: 'Adventure Log', quests: 'Quest Log', equipment: 'Equipment', skills: 'Skill Tree' };

export const titleLabel = (m: MenuConfig | undefined, o: TitleOption): string =>
  m?.titleLabels?.[o]?.trim() || TITLE_OPTIONS.find(([k]) => k === o)![1];
export const pauseLabel = (m: MenuConfig | undefined, o: PauseOption): string =>
  m?.pauseLabels?.[o]?.trim() || PAUSE_OPTIONS.find(([k]) => k === o)?.[1] || OLD_PAUSE[o] || o;
