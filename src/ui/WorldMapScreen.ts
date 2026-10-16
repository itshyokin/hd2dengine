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
import { drawMarker, type MarkerSymbol } from '../world/landmarks';

export interface WorldMapPiece {
  name: string; title: string; at: WorldPlacement;
  /** The map drawn from above (null: not drawn yet, or never shown). */
  art: HTMLCanvasElement | null;
  visited: boolean;
  /** Ground seen so far (null: all of it). */
  explored: Explored | null;
}

/** An event's marker, in world tiles (an area event's whole area: w × h). */
export interface WorldMapMarker { x: number; z: number; w: number; h: number; symbol: MarkerSymbol; color: string; label: string; kind: string }

export interface WorldMapHost {
  /** Event markers shown now (their switches allow it). */
  markers(): WorldMapMarker[];
  /** The hero's name, for the pin's tooltip. */
  heroName(): string;
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
  private readonly tip = document.createElement('div');
  private readonly cross = document.createElement('div');
  /** The pointer over the map (mouse): its tooltip follows it; otherwise the crosshair in the middle has it. */
  private hover: { x: number; y: number } | null = null;
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
    this.cross.className = 'wm-cross';
    this.tip.className = 'wm-tip';
    view.append(this.canvas, this.labelsEl, this.cross, this.tip);
    this.info.className = 'menu-note';
    box.append(view, this.info);
    this.root.append(box);
    view.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz }; view.setPointerCapture(e.pointerId); });
    view.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') { const r = view.getBoundingClientRect(); this.hover = { x: e.clientX - r.left, y: e.clientY - r.top }; }
      if (!this.drag) { if (e.pointerType === 'mouse') this.draw(); return; }
      const s = this.scale(); this.cx = this.drag.cx - (e.clientX - this.drag.x) / s; this.cz = this.drag.cz - (e.clientY - this.drag.y) / s; this.draw();
    });
    view.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
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
    if (moved) { this.hover = null; this.draw(); }
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
    // Event markers: an area's outline in the marker's colour, the symbol at its middle.
    const markers = this.host.markers(), mr = Math.max(7, Math.min(13, s * 1.6));
    for (const m of markers) {
      if (m.w > 1 || m.h > 1) {
        g.save();
        g.fillStyle = m.color; g.globalAlpha = 0.16; g.fillRect(sx(m.x), sz(m.z), m.w * s, m.h * s);
        g.globalAlpha = 0.9; g.strokeStyle = m.color; g.lineWidth = 2; g.setLineDash([5, 4]);
        g.strokeRect(Math.round(sx(m.x)) + 0.5, Math.round(sz(m.z)) + 0.5, Math.round(m.w * s), Math.round(m.h * s));
        g.restore();
      }
      drawMarker(g, m.symbol, sx(m.x + m.w / 2), sz(m.z + m.h / 2), mr, m.color);
    }
    // Names: towns and landmarks (in places shown), and the hero's pin.
    const pieces = this.host.pieces();
    const inShown = (l: WorldLabel) => pieces.some((p) => shown.has(p.name) && l.x >= p.at.x && l.x < p.at.x + p.at.w && l.z >= p.at.z && l.z < p.at.z + p.at.h
      && (p.visited || fogMode === 'visible'));
    const html = this.host.labels().filter(inShown).map((l) => `<span class="wm-label ${l.kind ?? 'town'}" style="left:${sx(l.x)}px;top:${sz(l.z)}px">${esc(l.name)}</span>`);
    if (hero) html.push(`<span class="wm-pin" style="left:${sx(hero.x)}px;top:${sz(hero.z)}px" aria-label="You are here"></span>`);
    this.labelsEl.innerHTML = html.join('');
    // The tooltip: whatever is under the crosshair (or the mouse) — the hero, a marker, a place name.
    const at = this.hover ?? { x: W / 2, y: H / 2 }, wx = (at.x - W / 2) / s + this.cx, wz = (at.y - H / 2) / s + this.cz;
    const near = (x: number, z: number) => Math.hypot(sx(x) - at.x, sz(z) - at.y) < Math.max(14, mr + 4);
    let tip = '';
    if (hero && near(hero.x, hero.z)) tip = `${this.host.heroName()} · ${pieces.find((p) => p.name === hero.map)?.title ?? ''}`;
    else {
      const point = markers.find((m) => near(m.x + m.w / 2, m.z + m.h / 2));
      const area = point ? null : markers.find((m) => (m.w > 1 || m.h > 1) && wx >= m.x && wx < m.x + m.w && wz >= m.z && wz < m.z + m.h);
      const mk = point ?? area;
      if (mk) tip = `${mk.label} · ${mk.kind}`;
      else { const l = this.host.labels().filter(inShown).find((x) => near(x.x, x.z)); if (l) tip = l.name; }
    }
    this.tip.textContent = tip;
    this.tip.hidden = !tip;
    this.tip.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y - 18)}px) translate(-50%, -100%)`;
    this.cross.hidden = !!this.hover;
    const here = pieces.find((p) => p.name === hero?.map);
    this.info.textContent = `${here ? here.title : ''}${here ? ' · ' : ''}Arrows / stick: scroll · ${this.input.label('subPrev')} / ${this.input.label('subNext')}: zoom · Space: back to you · Esc: close`;
  }
}
