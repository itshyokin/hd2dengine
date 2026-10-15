/**
 * Runs event command lists one step at a time inside the game loop.
 * It is a stack machine (like RPG Maker's), so a running event could later be saved and resumed.
 */
import type { GameState } from '../game/GameState';
import type { MessageWindow } from '../ui/MessageWindow';
import type { Ailment, Command, Gauge, WeatherKind } from '../world/types';

/** What the interpreter needs from the rest of the game. */
export interface EventContext {
  readonly state: GameState;
  readonly message: MessageWindow;
  setTime(hour: number, instant: boolean): void;
  /** Animate the screen fade toward `to` (0 clear, 1 black) over `seconds`. */
  fadeTo(to: number, seconds: number): void;
  isFading(): boolean;
  /** Switches or variables changed: event pages may need to switch. */
  refreshEvents(): void;
  /** Change the player's health, magic or stamina. */
  changeGauge(g: Gauge, op: 'add' | 'set' | 'fill', value: number): void;
  /** The nearest fire's fuel menu. */
  tendFire(): void;
  /** Health, magic and stamina to full for the party; ailments cured (not Zombie). */
  fullRest(): void;
  /** Give or cure an ailment on the hero. */
  ailment(op: 'give' | 'cure', a: Ailment | 'all', seconds?: number): void;
  /** Move the player to another map (or another spot on this one). */
  transfer(t: Extract<Command, { cmd: 'transfer' }>): void;
  /** Open the save screen (a save point); the event waits until it closes. */
  openSave(): void;
  /** The bag: give and take items, change gold, item names. */
  items: {
    /** Gives all `n`, or nothing when they don't all fit. */
    give(id: string, n: number): 'ok' | 'full' | 'unknown';
    take(id: string, n: number): number;
    gold(op: 'add' | 'set', value: number): void;
    name(id: string): string;
  };
  /** Open a shop; the event waits until the player leaves it. */
  openShop(c: Extract<Command, { cmd: 'shop' }>): void;
  /** Sound: an effect, the music and the background sound (undefined = back to the map's own). */
  sound(src: string): void;
  music(src: string | undefined, fade?: number): void;
  ambience(src: string | undefined): void;
  /** A hero joins or leaves the party. */
  party(op: 'add' | 'remove', hero: string, quiet?: boolean): void;
  /** Change this map's weather (and breeze), kept for the rest of the game. */
  weather(kind: WeatherKind, amount?: number, wind?: number, scope?: 'here' | 'world'): void;
  /** Give skill points (a quest reward). */
  skillPoints(n: number): void;
  /** Start, advance, complete, fail or forget a quest. */
  quest(c: Extract<Command, { cmd: 'quest' }>): void;
}

interface Frame { list: Command[]; i: number }

export class Interpreter {
  private stack: Frame[] = [];
  private waitTime = 0;
  private awaitingChoice: Extract<Command, { cmd: 'choice' }> | null = null;

  constructor(private readonly ctx: EventContext) {}

  get running(): boolean {
    return this.stack.length > 0;
  }

  /** Stop the running event (loading a save). */
  stop(): void {
    this.stack = [];
    this.waitTime = 0;
    this.awaitingChoice = null;
    this.ctx.message.close();
  }

  start(commands: Command[]): void {
    this.stack = [{ list: commands, i: 0 }];
    this.waitTime = 0;
    this.awaitingChoice = null;
  }

  update(dt: number): void {
    // Execute as many instant commands as possible this frame; stop at anything that waits.
    for (let guard = 0; guard < 1000 && this.stack.length; guard++) {
      if (this.waitTime > 0) { this.waitTime -= dt; if (this.waitTime > 0) return; this.waitTime = 0; }
      if (this.ctx.isFading()) return;
      if (this.awaitingChoice) {
        const picked = this.ctx.message.takeChoice();
        if (picked === null) return;
        const branch = this.awaitingChoice.branches[picked] ?? [];
        this.awaitingChoice = null;
        if (branch.length) this.stack.push({ list: branch, i: 0 });
        continue;
      }
      if (this.ctx.message.busy) return;
      const top = this.stack[this.stack.length - 1];
      if (top.i >= top.list.length) { this.stack.pop(); continue; }
      const next = top.list[top.i + 1];
      this.execute(top.list[top.i++], next);
    }
    if (!this.stack.length) this.ctx.message.close();
  }

  private execute(c: Command, next: Command | undefined): void {
    const { state, message } = this.ctx;
    switch (c.cmd) {
      case 'text':
        // When choices follow, keep the text on screen and show the choices under it.
        message.showText(state.format(c.text), c.speaker, next?.cmd === 'choice', c.bubble);
        break;
      case 'choice':
        message.showChoices(c.options.map((o) => state.format(o)), c.cancel);
        this.awaitingChoice = c;
        break;
      case 'if': {
        const branch = state.test(c.condition) ? c.then : c.else ?? [];
        if (branch.length) this.stack.push({ list: branch, i: 0 });
        break;
      }
      case 'setSwitch':
        state.setSwitch(c.switch, c.value);
        this.ctx.refreshEvents();
        break;
      case 'setVar':
        state.setVar(c.var, c.op === 'add' ? state.getVar(c.var) + c.value : c.value);
        this.ctx.refreshEvents();
        break;
      case 'wait':
        this.waitTime = c.seconds;
        break;
      case 'fadeOut':
        message.close();
        this.ctx.fadeTo(1, c.seconds ?? 0.8);
        break;
      case 'fadeIn':
        this.ctx.fadeTo(0, c.seconds ?? 0.8);
        break;
      case 'setTime':
        this.ctx.setTime(c.hour, !!c.instant);
        break;
      case 'ability':
        state.setAbility(c.ability, c.on);
        break;
      case 'tendFire':
        message.close();
        this.ctx.tendFire();
        break;
      case 'fullRest':
        this.ctx.fullRest();
        break;
      case 'ailment':
        this.ctx.ailment(c.op, c.ailment, c.seconds);
        break;
      case 'gauge':
        this.ctx.changeGauge(c.gauge, c.op, c.value);
        break;
      case 'save':
        message.close();
        this.ctx.openSave();
        break;
      case 'giveItem': {
        const r = this.ctx.items.give(c.item, c.count);
        const name = this.ctx.items.name(c.item);
        if (r === 'full') {
          // Not enough room: say so and stop the event, so a chest stays closed to try again later.
          message.showText(`Not enough room in your bag for ${c.count > 1 ? `${c.count} × ` : ''}${name}.`, undefined, false);
          this.stack = [{ list: [], i: 0 }];
        } else if (r === 'ok' && !c.silent) message.showText(`Received ${c.count > 1 ? `${c.count} × ` : ''}${name}!`, undefined, next?.cmd === 'choice');
        if (r === 'ok') this.ctx.refreshEvents();
        break;
      }
      case 'takeItem':
        this.ctx.items.take(c.item, c.count);
        this.ctx.refreshEvents();
        break;
      case 'gold':
        this.ctx.items.gold(c.op, c.value);
        if (!c.silent && c.op === 'add' && c.value > 0) message.showText(`Received ${c.value.toLocaleString()} gold!`, undefined, next?.cmd === 'choice');
        this.ctx.refreshEvents();
        break;
      case 'shop':
        message.close();
        this.ctx.openShop(c);
        break;
      case 'sound': this.ctx.sound(c.sound); break;
      case 'music': this.ctx.music(c.music, c.fade); break;
      case 'ambience': this.ctx.ambience(c.ambience); break;
      case 'weather': this.ctx.weather(c.kind, c.amount, c.wind, c.scope); break;
      case 'party': this.ctx.party(c.op, c.hero, c.quiet); break;
      case 'skillPoints': this.ctx.skillPoints(c.value); break;
      case 'quest': this.ctx.quest(c); this.ctx.refreshEvents(); break;
      case 'transfer':
        // A transfer ends the event: its map is about to go away.
        this.stack = [];
        message.close();
        this.ctx.transfer(c);
        break;
    }
  }
}
