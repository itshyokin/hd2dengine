/**
 * Ailments shown as a pill beside a fighter's name and level in battle ("PSN" on purple): the pill's colour, its
 * text colour, the short tag and the full word. Database → Combat → Status pills changes any of them.
 */
import type { BattleAilment } from './status';

export interface StatusPill { color: string; ink: string; tag: string; word: string }

export const DEFAULT_STATUS_PILLS: Record<BattleAilment, StatusPill> = {
  burn: { color: '#ff7a3a', ink: '#2a0e00', tag: 'BRN', word: 'BURNED' },
  poison: { color: '#8a4fd0', ink: '#ffffff', tag: 'PSN', word: 'POISONED' },
  chill: { color: '#9ad8ff', ink: '#0a2236', tag: 'CHL', word: 'CHILLED' },
  frozen: { color: '#cfefff', ink: '#0a2236', tag: 'FRZ', word: 'FROZEN' },
  paralyze: { color: '#ffe04a', ink: '#2a2200', tag: 'PAR', word: 'PARALYZED' },
  blind: { color: '#4a4a60', ink: '#e8e8f4', tag: 'BLD', word: 'BLINDED' },
  silence: { color: '#c8a0ff', ink: '#24104a', tag: 'SIL', word: 'SILENCED' },
  stagger: { color: '#ffd0a0', ink: '#3a2000', tag: 'STG', word: 'STAGGERED' },
  sleep: { color: '#a0b4ff', ink: '#141a3a', tag: 'SLP', word: 'ASLEEP' },
  confusion: { color: '#ff9ad8', ink: '#3a0a26', tag: 'CNF', word: 'CONFUSED' },
  zombie: { color: '#6a8a5a', ink: '#e8ffd8', tag: 'ZMB', word: 'ZOMBIE' },
};

/** The defaults with the Database's changes on top. */
export function statusPills(over?: Partial<Record<string, Partial<StatusPill>>>): Record<BattleAilment, StatusPill> {
  const out = {} as Record<BattleAilment, StatusPill>;
  for (const [k, d] of Object.entries(DEFAULT_STATUS_PILLS) as [BattleAilment, StatusPill][]) {
    const o = over?.[k] ?? {};
    out[k] = { color: o.color || d.color, ink: o.ink || d.ink, tag: (o.tag || d.tag).slice(0, 6), word: (o.word || d.word).slice(0, 14) };
  }
  return out;
}
