/**
 * Pause → Map: the world map (Pokémon Gold / Silver style), drawn from the maps themselves and laid out as in the
 * Map editor's World layout. Scroll with the arrows / stick (or drag), zoom with LT / RT (Z / C, or the wheel), Space
 * centres on the hero. Places not visited yet are hidden, greyed or shown (Database → World map); inside visited maps
 * only the ground walked near shows, if exploring is on.
 */
import type { Input } from '../game/Input';
import { uiSound } from '../audio/sfx';
import { esc } from './InventoryScreen';
import { tabKeys, type TabGroup } from './tabs';
import type { Explored, WorldFog, WorldLabel, WorldPlacement } from '../world/worldLayout';

export interface WorldMapPiece {
  name: string; title: string; at: WorldPlacement;
  /** The map drawn from above (null: not drawn yet, or never shown). */
  art: HTMLCanvasElement | null;
  visited: boolean;
  /** Ground seen so far (null: all of it). */
  explored: Explored | null;
}

export interface WorldMapHost {
  pieces(): WorldMapPiece[];
  labels(): WorldLabel[];
  unvisited(): WorldFog;
  /** The hero in world tiles, and the map they're on. */
  hero(): { x: number; z: number; map: string } | null;
  /** Pixels per tile the art is drawn at. */
  artScale: number;
}

const ZOOMS = [1, 2, 3, 4, 6, 8];

export class WorldMapScreen {
  private readonly root = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly labelsEl = document.createElement('div');
  private readonly info = document.createElement('div');
  private open = false;
  private tabs: TabGroup | undefined;
  private onClose: () => void = () => {};
  /** The centre of the view, in world tiles, and pixels per tile on screen. */
  private cx = 0; private cz = 0; private zoom = 3;
  private drag: { x: number; y: number; cx: number; cz: number } | null = null;
  private fogCache = new Map<string, HTMLCanvasElement>();

  constructor(parent: HTMLElement, private readonly input: Input, private readonly host: WorldMapHost) {
    this.root.className = 'inv world-map-screen';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'World map');
    const box = document.createElement('div');
    box.className = 'inv-box wm-box';
    const view = document.createElement('div');
    view.className = 'wm-view';
    this.labelsEl.className = 'wm-labels';
    view.append(this.canvas, this.labelsEl);
    this.info.className = 'menu-note';
    box.append(view, this.info);
    this.root.append(box);
    view.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz }; view.setPointerCapture(e.pointerId); });
    view.addEventListener('pointermove', (e) => { if (!this.drag) return; const s = this.scale(); this.cx = this.drag.cx - (e.clientX - this.drag.x) / s; this.cz = this.drag.cz - (e.clientY - this.drag.y) / s; this.draw(); });
    view.addEventListener('pointerup', () => { this.drag = null; });
    view.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    parent.appendChild(this.root);
  }

  get isOpen(): boolean { return this.open; }

  show(onClose: () => void, tabs?: TabGroup): void {
    this.open = true; this.onClose = onClose; this.tabs = tabs;
    this.root.hidden = false;
    this.fogCache.clear();
    this.centre();
    requestAnimationFrame(() => this.draw());
  }

  hide(): void { this.open = false; this.root.hidden = true; }

  private close(): void { this.hide(); uiSound('menuBack'); this.onClose(); }

  private scale(): number { return ZOOMS[this.zoom] * (window.devicePixelRatio > 1 ? 1 : 1); }

  private centre(): void {
    const h = this.host.hero();
    if (h) { this.cx = h.x; this.cz = h.z; return; }
    const ps = this.host.pieces();
    if (ps.length) { this.cx = ps[0].at.x + ps[0].at.w / 2; this.cz = ps[0].at.z + ps[0].at.h / 2; }
  }

  private zoomBy(d: number): void {
    const z = Math.max(0, Math.min(ZOOMS.length - 1, this.zoom + d));
    if (z === this.zoom) return;
    this.zoom = z; uiSound('menuMove'); this.draw();
  }

  update(dt: number): void {
    if (!this.open) return;
    const i = this.input;
    if (i.consume('cancel')) { this.close(); return; }
    if (tabKeys(i, this.tabs)) return;
    if (i.consume('subPrev')) this.zoomBy(-1);
    if (i.consume('subNext')) this.zoomBy(1);
    if (i.confirm()) { this.centre(); uiSound('menuOk'); this.draw(); }
    const speed = (14 / ZOOMS[this.zoom]) * 30 * dt;
    let moved = false;
    if (i.isHeld('left')) { this.cx -= speed; moved = true; }
    if (i.isHeld('right')) { this.cx += speed; moved = true; }
    if (i.isHeld('up')) { this.cz -= speed; moved = true; }
    if (i.isHeld('down')) { this.cz += speed; moved = true; }
    // Menu presses (D-pad, arrows) nudge too.
    for (const [a, dx, dz] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]] as const) if (i.consume(a)) { this.cx += dx * 2; this.cz += dz * 2; moved = true; }
    if (moved) this.draw();
  }

  /** The fog over a map: dark where the ground hasn't been seen yet. */
  private fog(p: WorldMapPiece): HTMLCanvasElement | null {
    if (!p.explored) return null;
    let c = this.fogCache.get(p.name);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = p.at.w; c.height = p.at.h;
    const g = c.getContext('2d')!, img = g.createImageData(p.at.w, p.at.h);
    for (let z = 0; z < p.at.h; z++) for (let x = 0; x < p.at.w; x++) { const i = (z * p.at.w + x) * 4; img.data[i] = 22; img.data[i + 1] = 26; img.data[i + 2] = 38; img.data[i + 3] = p.explored.has(x, z) ? 0 : 235; }
    g.putImageData(img, 0, 0);
    this.fogCache.set(p.name, c);
    return c;
  }

  private draw(): void {
    if (!this.open) return;
    const view = this.canvas.parentElement!, W = view.clientWidth, H = view.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) { this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr); }
    const g = this.canvas.getContext('2d')!, s = this.scale();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#18324a';
    g.fillRect(0, 0, W, H);
    // A faint grid, like a chart.
    g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
    const sx = (x: number) => (x - this.cx) * s + W / 2, sz = (z: number) => (z - this.cz) * s + H / 2;
    const grid = 16;
    for (let x = Math.floor((this.cx - W / 2 / s) / grid) * grid; sx(x) < W; x += grid) { g.beginPath(); g.moveTo(Math.round(sx(x)) + 0.5, 0); g.lineTo(Math.round(sx(x)) + 0.5, H); g.stroke(); }
    for (let z = Math.floor((this.cz - H / 2 / s) / grid) * grid; sz(z) < H; z += grid) { g.beginPath(); g.moveTo(0, Math.round(sz(z)) + 0.5); g.lineTo(W, Math.round(sz(z)) + 0.5); g.stroke(); }
    const fogMode = this.host.unvisited(), hero = this.host.hero();
    const shown = new Set<string>();
    for (const p of this.host.pieces()) {
      if (!p.visited && fogMode === 'hidden') continue;
      const x = sx(p.at.x), z = sz(p.at.z), w = p.at.w * s, h = p.at.h * s;
      if (x > W || z > H || x + w < 0 || z + h < 0) continue;
      shown.add(p.name);
      g.save();
      if (!p.visited && fogMode === 'grey') g.filter = 'grayscale(1) brightness(0.55)';
      if (p.art) g.drawImage(p.art, Math.round(x), Math.round(z), Math.round(w), Math.round(h));
      else { g.fillStyle = '#3d4a3a'; g.fillRect(x, z, w, h); }
      g.restore();
      const f = p.visited ? this.fog(p) : null;
      if (f) { g.imageSmoothingEnabled = true; g.drawImage(f, Math.round(x), Math.round(z), Math.round(w), Math.round(h)); g.imageSmoothingEnabled = false; }
      g.strokeStyle = hero?.map === p.name ? 'rgba(255, 210, 122, 0.85)' : 'rgba(0,0,0,0.45)';
      g.lineWidth = hero?.map === p.name ? 2 : 1;
      g.strokeRect(Math.round(x) + 0.5, Math.round(z) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
    }
    // Names: towns and landmarks (in places shown), and the hero's pin.
    const pieces = this.host.pieces();
    const inShown = (l: WorldLabel) => pieces.some((p) => shown.has(p.name) && l.x >= p.at.x && l.x < p.at.x + p.at.w && l.z >= p.at.z && l.z < p.at.z + p.at.h
      && (p.visited || fogMode === 'visible'));
    const html = this.host.labels().filter(inShown).map((l) => `<span class="wm-label ${l.kind ?? 'town'}" style="left:${sx(l.x)}px;top:${sz(l.z)}px">${esc(l.name)}</span>`);
    if (hero) html.push(`<span class="wm-pin" style="left:${sx(hero.x)}px;top:${sz(hero.z)}px" aria-label="You are here"></span>`);
    this.labelsEl.innerHTML = html.join('');
    const here = pieces.find((p) => p.name === hero?.map);
    this.info.textContent = `${here ? here.title : ''}${here ? ' · ' : ''}Arrows / stick: scroll · ${this.input.label('subPrev')} / ${this.input.label('subNext')}: zoom · Space: back to you · Esc: close`;
  }
}
