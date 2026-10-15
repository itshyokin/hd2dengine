// ---------------------------------------------------------------------------------------------------------------
// Saved characters and settings.
//  - Published on claude.ai: kept with the page in your Claude account (the same on your tablet and computer).
//  - Elsewhere: kept in this browser (IndexedDB), or only for this visit when storage is blocked.
// ---------------------------------------------------------------------------------------------------------------

async function claudeUse(name) {
  try { return window.claude?.use ? await window.claude.use(name) : null; } catch { return null; }
}

const DEFAULT_SETTINGS = { steamSafe: true, sets: { move: true, combat: true, extra: false } };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

class CloudStore {
  constructor(db) { this.db = db; this.kind = 'cloud'; }
  subscribe(cb) {
    const st = { chars: [], weapons: [], settings: { ...DEFAULT_SETTINGS } }, got = new Set();
    const emit = (k) => { got.add(k); if (got.size === 3) cb({ ...st }); };
    const fail = (e) => cb({ ...st, error: e?.message || 'Your saved characters could not be loaded' });
    this.db.collection('lpc_chars').onSnapshot((q) => { st.chars = q.docs.map((d) => ({ id: d.id, ...d.data() })); emit('chars'); }, fail);
    this.db.collection('lpc_weapons').onSnapshot((q) => { st.weapons = q.docs.map((d) => ({ id: d.id, ...d.data() })); emit('weapons'); }, fail);
    this.db.doc('config/lpc').onSnapshot((d) => { st.settings = { ...DEFAULT_SETTINGS, ...(d.exists ? d.data() : {}) }; emit('settings'); }, fail);
  }
  async saveChar(c) {
    const id = c.id || newId();
    const { id: _, ...body } = c;
    await this.db.collection('lpc_chars').doc(id).set({ ...body, updated: Date.now() });
    return id;
  }
  deleteChar(id) { return this.db.collection('lpc_chars').doc(id).delete(); }
  async saveWeapon(w) {
    const id = w.id || newId();
    const { id: _, ...body } = w;
    await this.db.collection('lpc_weapons').doc(id).set({ ...body, updated: Date.now() });
    return id;
  }
  deleteWeapon(id) { return this.db.collection('lpc_weapons').doc(id).delete(); }
  saveSettings(s) { return this.db.doc('config/lpc').set(s); }
}

class LocalStore {
  constructor() { this.kind = 'local'; this.listeners = []; }
  async open() {
    this.idb = await new Promise((res, rej) => {
      const r = indexedDB.open('lpc-character-builder', 2);
      r.onupgradeneeded = () => {
        const names = r.result.objectStoreNames;
        if (!names.contains('chars')) r.result.createObjectStore('chars', { keyPath: 'id' });
        if (!names.contains('kv')) r.result.createObjectStore('kv');
        if (!names.contains('weapons')) r.result.createObjectStore('weapons', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this;
  }
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.idb.transaction(store, mode), req = fn(t.objectStore(store));
      t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error);
    });
  }
  async snapshot() {
    return {
      chars: await this.tx('chars', 'readonly', (s) => s.getAll()),
      weapons: await this.tx('weapons', 'readonly', (s) => s.getAll()),
      settings: { ...DEFAULT_SETTINGS, ...((await this.tx('kv', 'readonly', (s) => s.get('settings'))) ?? {}) },
    };
  }
  async subscribe(cb) { this.listeners.push(cb); cb(await this.snapshot()); }
  async changed() { const s = await this.snapshot(); for (const l of this.listeners) l(s); }
  async saveChar(c) { const id = c.id || newId(); await this.tx('chars', 'readwrite', (s) => s.put({ ...c, id, updated: Date.now() })); await this.changed(); return id; }
  async deleteChar(id) { await this.tx('chars', 'readwrite', (s) => s.delete(id)); await this.changed(); }
  async saveWeapon(w) { const id = w.id || newId(); await this.tx('weapons', 'readwrite', (s) => s.put({ ...w, id, updated: Date.now() })); await this.changed(); return id; }
  async deleteWeapon(id) { await this.tx('weapons', 'readwrite', (s) => s.delete(id)); await this.changed(); }
  async saveSettings(st) { await this.tx('kv', 'readwrite', (s) => s.put(st, 'settings')); await this.changed(); }
}

class MemoryStore extends LocalStore {
  constructor() { super(); this.kind = 'memory'; this.mem = { chars: [], weapons: [], settings: { ...DEFAULT_SETTINGS } }; }
  async open() { return this; }
  async snapshot() { return { chars: [...this.mem.chars], weapons: [...this.mem.weapons], settings: { ...this.mem.settings } }; }
  async saveWeapon(w) { const id = w.id || newId(); this.mem.weapons = [...this.mem.weapons.filter((x) => x.id !== id), { ...w, id, updated: Date.now() }]; await this.changed(); return id; }
  async deleteWeapon(id) { this.mem.weapons = this.mem.weapons.filter((w) => w.id !== id); await this.changed(); }
  async saveChar(c) { const id = c.id || newId(); this.mem.chars = [...this.mem.chars.filter((x) => x.id !== id), { ...c, id, updated: Date.now() }]; await this.changed(); return id; }
  async deleteChar(id) { this.mem.chars = this.mem.chars.filter((c) => c.id !== id); await this.changed(); }
  async saveSettings(s) { this.mem.settings = s; await this.changed(); }
}

async function openStore() {
  if (window.parent !== window) for (let i = 0; i < 15 && !window.claude?.use; i++) await new Promise((r) => setTimeout(r, 100));
  if (window.claude?.use) {
    const db = await claudeUse('db');
    if (db) return new CloudStore(db);
  }
  try { return await new LocalStore().open(); } catch { return new MemoryStore(); }
}

/** Offer a file to save: through claude.ai's download prompt when published, else a normal download. */
async function saveFile(filename, blob) {
  const dl = await claudeUse('downloads');
  if (dl) {
    try { await dl.save({ filename, data: blob }); return 'saved'; }
    catch (e) { if (e?.code === 'declined') return 'declined'; throw new Error(e?.message || 'The file could not be saved'); }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return 'saved';
}
