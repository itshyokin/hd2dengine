/**
 * Elements shown as a coloured pill with the element's name ("NATURE" in green), or, where space is short, a circle
 * of its colour with its symbol in black.
 */
import { ELEMENT_COLORS, ELEMENT_NAMES } from '../game/elements';
import { PILL_INK, elementIconUrl } from '../art/elementIcons';
import type { Element } from '../world/types';

/** A pill: "FIRE" on orange. */
export function elementPill(e: Element, extra = ''): string {
  return `<span class="el-pill${extra ? ` ${extra}` : ''}" style="background:${ELEMENT_COLORS[e]};color:${PILL_INK[e]}">${ELEMENT_NAMES[e].toUpperCase()}</span>`;
}

/** A circle with the symbol, for small spaces. */
export function elementDot(e: Element): string {
  return `<img class="el-dot" src="${elementIconUrl(e)}" alt="${ELEMENT_NAMES[e]}" title="${ELEMENT_NAMES[e]}">`;
}
