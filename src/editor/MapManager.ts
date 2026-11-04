/**
 * Update 162: the Maps window (toolbar → Maps). Every map of the project in folders, like RPG Maker's map tree:
 *  - folders: new, rename, reorder (▲ ▼), delete (its maps go back to No folder); empty folders are kept
 *  - maps: open, move to a folder (drag a row onto a folder, or its Move menu on a tablet), edit (file name, display
 *    name, folder), duplicate and delete
 *
 * Folders live in the Database (mapFolders: map → folder, mapFolderList: the folders in order), so they travel with
 * the project. Renaming a map's file also updates everything that points at it: Transfer events in every map, the
 * start map, battle maps, quests, chatter, the title screen and the World layout. Deleted maps go to the project's
 * .trash/maps/ folder (dev server, project folder) or are deleted on GitHub with the next Push (tablet).
 */
import { formatDatabase, formatMap } from '../shared/dataFiles';
import type { Database, MapData } from '../world/types';
import { field, h, openModal, select, textInput, toast } from './dom';
import { save } from './io';
import type { EditorStore } from './store';

export interface MapManagerHooks {
  /** Open a map in the editor (asks about unsaved changes itself). */
  open(name: string): Promise<void>;
  /** The New map dialog (`folder`: put the new map in it). */
  newMap(folder?: string): void;
  /** Map Properties of the open map. */
  properties(): void;
}

const FILE_RE = /^[A-Za-z0-9_-]+$/;
/** Keys that hold a map's file name (Transfer's map, a field map's battle map, quests' visit, chatter, title…). */
const REF_KEYS = new Set(['map', 'battleMap', 'startMap']);

/* ------------------------------------------------------------ folders (also used by the toolbar's map list) */

/** The folders in order: the Maps window's order first, then any others (A–Z). */
export function folderNames(db: Database): string[] {
  const listed = db.mapFolderList ?? [];
  const rest = [...new Set(Object.values(db.mapFolders ?? {}))].filter((f) => !listed.includes(f)).sort((a, b) => a.localeCompare(b));
  return [...listed, ...rest];
}

function setFolders(db: Database, folders: Record<string, string>, list: string[]): void {
  if (Object.keys(folders).length) db.mapFolders = folders; else delete db.mapFolders;
  if (list.length) db.mapFolderList = list; else delete db.mapFolderList;
}

/** Put a map in a folder ('' = no folder). */
export function moveToFolder(db: Database, map: string, folder: string): void {
  const f = { ...(db.mapFolders ?? {}) }, list = folderNames(db);
  if (folder) { f[map] = folder; if (!list.includes(folder)) list.push(folder); } else delete f[map];
  setFolders(db, f, list);
}

/* ------------------------------------------------------------ references to a map */

/** Replace (or just count, when `to` is null) every reference to map `from` inside `obj`. */
function refs(obj: unknown, from: string, to: string | null): number {
  let n = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    for (const [k, x] of Object.entries(o)) {
      if (REF_KEYS.has(k) && x === from) { n++; if (to !== null) o[k] = to; }
      else if (typeof x === 'object') walk(x);
    }
  };
  walk(obj);
  return n;
}

/** The database's own references: the above, plus the World layout's place and the folder (keys, not values). */
function dbRefs(db: Database, from: string, to: string | null): number {
  const n = refs(db, from, to), { world, mapFolders } = db;
  if (to !== null) {
    if (world?.maps[from]) { world.maps[to] = world.maps[from]; delete world.maps[from]; }
    if (mapFolders?.[from]) { mapFolders[to] = mapFolders[from]; delete mapFolders[from]; }
  }
  return n;
}

/* ------------------------------------------------------------ the window */

export function openMapManager(store: EditorStore, hooks: MapManagerHooks): void {
  const names = new Map<string, string>(); // file → display name
  const open = new Set<string>(folderNames(store.db)); // folders shown open
  let filter = '';
  const list = h('div', { class: 'mapman-list' });
  const search = h('input', { type: 'search', placeholder: 'Find a map…', 'aria-label': 'Find a map', oninput: () => { filter = search.value.trim().toLowerCase(); render(); } });
  const body = h('div', { class: 'mapman' },
    h('div', { class: 'mapman-tools' },
      search,
      h('button', { type: 'button', class: 'btn small', onclick: () => newFolder() }, '+ Folder'),
      h('button', { type: 'button', class: 'btn small', onclick: () => { close(); hooks.newMap(); } }, '+ Map')),
    h('p', { class: 'note' }, 'Drag a map onto a folder to move it (or use its Move menu). Folders keep the list tidy; they don’t change the game.'),
    list);
  const close = openModal('Maps', body, [{ label: 'Done', primary: true }], undefined, { wide: true });

  /** Folder changes: kept in the Database, saved at once when nothing else is waiting to be saved. */
  const folderChanged = (wasClean: boolean) => {
    store.changedDb();
    if (wasClean && store.project.canSave) {
      void store.project.write('database.json', formatDatabase(store.db)).then(() => { store.dbDirty = false; store.emit('meta'); })
        .catch((e: unknown) => toast(`Couldn’t save the folders: ${e instanceof Error ? e.message : String(e)}`, 'error'));
    }
    render();
  };
  const editFolders = (fn: (folders: Record<string, string>, list: string[]) => void) => {
    const wasClean = !store.dbDirty;
    const f = { ...(store.db.mapFolders ?? {}) }, l = folderNames(store.db);
    fn(f, l);
    setFolders(store.db, f, l);
    folderChanged(wasClean);
  };

  const render = () => {
    const folders = store.db.mapFolders ?? {}, order = folderNames(store.db);
    const all = store.maps.includes(store.mapName) ? store.maps : [...store.maps, store.mapName].sort();
    const shown = (n: string) => !filter || n.toLowerCase().includes(filter) || (names.get(n) ?? '').toLowerCase().includes(filter);
    const group = (key: string, label: string, maps: string[], folder: string | null) => {
      const isOpen = filter ? true : folder === null ? !open.has(`!${key}`) : open.has(folder);
      const head = h('div', { class: 'mapman-folder', 'data-drop': folder ?? '' },
        h('button', { type: 'button', class: 'mapman-twisty', 'aria-expanded': String(isOpen), onclick: () => {
          const k = folder ?? `!${key}`;
          if (folder === null) { if (open.has(k)) open.delete(k); else open.add(k); } else if (open.has(k)) open.delete(k); else open.add(k);
          render();
        } }, isOpen ? '▾' : '▸'),
        h('span', { class: 'mapman-folder-name' }, folder !== null ? `📁 ${label}` : label),
        h('span', { class: 'mapman-count' }, String(maps.length)),
        folder !== null ? h('span', { class: 'mapman-actions' },
          h('button', { type: 'button', class: 'icon-btn', title: 'Move the folder up', disabled: order.indexOf(folder) <= 0, onclick: () => editFolders((_, l) => { const i = l.indexOf(folder); [l[i - 1], l[i]] = [l[i], l[i - 1]]; }) }, '▲'),
          h('button', { type: 'button', class: 'icon-btn', title: 'Move the folder down', disabled: order.indexOf(folder) >= order.length - 1, onclick: () => editFolders((_, l) => { const i = l.indexOf(folder); [l[i + 1], l[i]] = [l[i], l[i + 1]]; }) }, '▼'),
          h('button', { type: 'button', class: 'btn small ghost', title: 'Make a new map in this folder', onclick: () => { close(); hooks.newMap(folder); } }, '+ Map'),
          h('button', { type: 'button', class: 'btn small ghost', onclick: () => renameFolder(folder) }, 'Rename'),
          h('button', { type: 'button', class: 'btn small ghost danger-text', title: 'Delete the folder (its maps are kept, with no folder)', onclick: () => deleteFolder(folder) }, 'Delete')) : null);
      dropTarget(head, folder ?? '');
      const rows = isOpen ? maps.filter(shown).map((n) => row(n, folder ?? '', order)) : [];
      if (isOpen && !rows.length) rows.push(h('div', { class: 'mapman-empty' }, filter ? 'No matches' : 'Empty: drag maps here'));
      return h('section', { class: 'mapman-group' }, head, ...rows);
    };
    const loose = all.filter((n) => !folders[n]);
    list.replaceChildren(
      ...order.map((f) => group(f, f, all.filter((n) => folders[n] === f), f)),
      group('maps', 'No folder', loose.filter((n) => !store.isBattleMap(n)), null),
      ...(loose.some((n) => store.isBattleMap(n)) ? [group('battle', 'Battle maps (no folder)', loose.filter((n) => store.isBattleMap(n)), null)] : []));
  };

  const dropTarget = (el: HTMLElement, folder: string) => {
    el.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('text/x-saturn-map')) { e.preventDefault(); el.classList.add('drop'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.classList.remove('drop');
      const map = e.dataTransfer?.getData('text/x-saturn-map');
      if (!map || (store.db.mapFolders?.[map] ?? '') === folder) return;
      editFolders((f) => { if (folder) f[map] = folder; else delete f[map]; });
      if (folder) open.add(folder);
    });
  };

  const row = (n: string, folder: string, order: string[]) => {
    const current = n === store.mapName;
    const move = select([['', '— No folder —'], ...order.map((f) => [f, `📁 ${f}`] as [string, string]), ['+', '+ New folder…']], folder, (v) => {
      if (v === '+') { move.value = folder; newFolder(n); return; }
      editFolders((f) => { if (v) f[n] = v; else delete f[n]; });
      if (v) open.add(v);
    }, { class: 'mapman-move', title: 'Move to a folder', 'aria-label': `Move ${n} to a folder` });
    const el = h('div', { class: `mapman-row${current ? ' current' : ''}`, draggable: 'true' },
      h('span', { class: 'mapman-grip', 'aria-hidden': 'true' }, '⠿'),
      h('button', { type: 'button', class: 'mapman-name', title: current ? 'The map you’re editing' : `Open ${n}`, onclick: () => { close(); void hooks.open(n); } },
        h('code', {}, n), names.get(n) && names.get(n) !== n ? h('span', { class: 'mapman-display' }, names.get(n)!) : null,
        store.isBattleMap(n) ? h('span', { class: 'mapman-tag' }, 'battle') : null,
        n === store.db.startMap ? h('span', { class: 'mapman-tag start' }, 'start') : null,
        current ? h('span', { class: 'mapman-tag here' }, 'open') : null),
      h('span', { class: 'mapman-actions' }, move,
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => editMap(n) }, 'Edit'),
        h('button', { type: 'button', class: 'btn small ghost', title: 'Make a copy of this map', onclick: () => duplicateMap(n) }, 'Duplicate'),
        h('button', { type: 'button', class: 'btn small ghost danger-text', onclick: () => deleteMap(n) }, 'Delete')));
    el.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/x-saturn-map', n); e.dataTransfer!.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    return el;
  };

  /* ---------------- folders */

  const askName = (title: string, start: string, taken: string[], done: (name: string) => void) => {
    let v = start;
    const err = h('p', { class: 'form-error', role: 'alert' });
    openModal(title, h('div', { class: 'form' }, field('Folder name', textInput(v, (x) => (v = x), { placeholder: 'Town, Dungeons, Interiors…' })), err), [
      { label: 'Cancel' },
      { label: 'OK', primary: true, onClick: () => {
        const name = v.trim();
        if (!name) { err.textContent = 'Give the folder a name.'; return false; }
        if (name !== start && taken.includes(name)) { err.textContent = `There’s already a folder called “${name}”.`; return false; }
        done(name);
      } },
    ]);
  };
  const newFolder = (putIn?: string) => askName('New folder', '', folderNames(store.db), (name) => {
    editFolders((f, l) => { if (!l.includes(name)) l.push(name); if (putIn) f[putIn] = name; });
    open.add(name);
  });
  const renameFolder = (old: string) => askName('Rename folder', old, folderNames(store.db), (name) => {
    if (name === old) return;
    editFolders((f, l) => {
      for (const k of Object.keys(f)) if (f[k] === old) f[k] = name;
      l.splice(l.indexOf(old), 1, name);
    });
    if (open.delete(old)) open.add(name);
  });
  const deleteFolder = (folder: string) => {
    const count = Object.values(store.db.mapFolders ?? {}).filter((f) => f === folder).length;
    openModal('Delete folder?', h('p', { class: 'modal-text' }, count
      ? `Delete the folder “${folder}”? Its ${count} map${count === 1 ? '' : 's'} are kept, with no folder.`
      : `Delete the empty folder “${folder}”?`), [
      { label: 'Cancel' },
      { label: 'Delete folder', danger: true, onClick: () => editFolders((f, l) => {
        for (const k of Object.keys(f)) if (f[k] === folder) delete f[k];
        l.splice(l.indexOf(folder), 1);
      }) },
    ]);
  };

  /* ---------------- file operations (rename, duplicate, delete) */

  /** Rename and delete rewrite files: everything must be saved first. */
  const whenSaved = (what: string, then: () => void) => {
    if (!store.project.canSave) { toast(`This copy of the editor can’t change files, so it can’t ${what}. Open the editor from your project to do it.`, 'error'); return; }
    if (!store.dirty && !store.dbDirty) { then(); return; }
    openModal('Save first?', h('p', { class: 'modal-text' }, `There are unsaved changes. Save them before you ${what}?`), [
      { label: 'Cancel' },
      { label: 'Save and continue', primary: true, onClick: () => { void save(store).then(() => { if (!store.dirty && !store.dbDirty) then(); }); } },
    ]);
  };

  /** Every map's data (the open one from memory). */
  const readAll = async (): Promise<Map<string, MapData>> => {
    const out = new Map<string, MapData>();
    for (const n of store.maps) out.set(n, n === store.mapName ? store.map : await store.project.readMap(n));
    if (!out.has(store.mapName)) out.set(store.mapName, store.map);
    return out;
  };

  const editMap = (n: string) => {
    void (async () => {
      let map: MapData;
      try { map = n === store.mapName ? store.map : await store.project.readMap(n); } catch (e) { toast(`Couldn’t read ${n}: ${e instanceof Error ? e.message : String(e)}`, 'error'); return; }
      const data = { file: n, name: map.name, folder: store.db.mapFolders?.[n] ?? '' };
      const err = h('p', { class: 'form-error', role: 'alert' });
      const current = n === store.mapName;
      openModal(`Edit map: ${n}`, h('div', { class: 'form' },
        field('File name', textInput(data.file, (v) => (data.file = v.trim())), 'Letters, numbers, - and _ only. Renaming also updates Transfer events, the start map, battle maps, quests and the World layout that point at it.'),
        field('Display name', textInput(data.name, (v) => (data.name = v))),
        field('Folder', select([['', '— No folder —'], ...folderNames(store.db).map((f) => [f, f] as [string, string])], data.folder, (v) => (data.folder = v))),
        current
          ? h('button', { type: 'button', class: 'btn small', onclick: () => { close(); hooks.properties(); } }, 'Size, borders, weather… (Map Properties)')
          : h('p', { class: 'note' }, 'Open the map to change its size, borders, weather and the rest of its Map Properties.'),
        err), [
        { label: 'Cancel' },
        { label: 'Save', primary: true, onClick: () => {
          if (!FILE_RE.test(data.file)) { err.textContent = 'Use only letters, numbers, - and _ in the file name.'; return false; }
          if (data.file !== n && store.maps.includes(data.file)) { err.textContent = `A map called “${data.file}” already exists.`; return false; }
          const name = data.name.trim() || data.file;
          // Folder: the Database only.
          if ((store.db.mapFolders?.[n] ?? '') !== data.folder) editFolders((f) => { if (data.folder) f[n] = data.folder; else delete f[n]; });
          const renamed = data.file !== n, retitled = name !== map.name;
          if (!renamed && !retitled) return;
          if (!renamed && current) {
            // The open map: an ordinary edit (undo-able; saved with Save).
            store.checkpoint(); store.map.name = name; store.changed(); names.set(n, name); render();
            return;
          }
          if (!renamed) {
            void store.project.write(`maps/${n}.json`, formatMap({ ...map, name }))
              .then(() => { names.set(n, name); render(); toast(`Renamed ${n} to “${name}”.`); })
              .catch((e: unknown) => toast(`Couldn’t save ${n}: ${e instanceof Error ? e.message : String(e)}`, 'error'));
            return;
          }
          whenSaved('rename a map', () => void renameMap(n, data.file, name));
        } },
      ]);
    })();
  };

  const renameMap = async (from: string, to: string, title: string) => {
    if (!store.project.removeMap) { toast('This copy of the editor can’t delete files, so it can’t rename maps.', 'error'); return; }
    try {
      const maps = await readAll(), moved = maps.get(from)!;
      moved.name = title;
      // The renamed map first (a failure part-way never loses it), then the maps and database that point at it.
      let changed = 0;
      for (const [n, m] of maps) {
        const k = refs(m, from, to);
        changed += k;
        if (n === from) continue;
        if (k) await store.project.write(`maps/${n}.json`, formatMap(m));
      }
      await store.project.write(`maps/${to}.json`, formatMap(moved));
      changed += dbRefs(store.db, from, to);
      await store.project.write('database.json', formatDatabase(store.db));
      await store.project.removeMap(from);
      store.maps = [...store.maps.filter((n) => n !== from), to].sort();
      const kind = store.mapKinds.get(from); store.mapKinds.delete(from); if (kind) store.mapKinds.set(to, kind);
      names.delete(from); names.set(to, title);
      // The open map was renamed, or points at it: open it again as it now is (its undo steps had the old names).
      if (store.mapName === from) store.open(to, moved);
      else store.open(store.mapName, maps.get(store.mapName)!);
      store.dbDirty = false;
      store.emit('meta');
      render();
      toast(`Renamed ${from} to ${to}${changed ? ` (${changed} reference${changed === 1 ? '' : 's'} updated)` : ''}.`);
    } catch (e) {
      toast(`Couldn’t rename ${from}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  const duplicateMap = (n: string) => {
    let i = 2, file = `${n}_copy`;
    while (store.maps.includes(file)) file = `${n}_copy${i++}`;
    const data = { file, name: `${names.get(n) ?? n} (copy)` };
    const err = h('p', { class: 'form-error', role: 'alert' });
    openModal(`Duplicate ${n}`, h('div', { class: 'form' },
      field('New file name', textInput(data.file, (v) => (data.file = v.trim()))),
      field('Display name', textInput(data.name, (v) => (data.name = v))), err), [
      { label: 'Cancel' },
      { label: 'Duplicate', primary: true, onClick: () => {
        if (!FILE_RE.test(data.file)) { err.textContent = 'Use only letters, numbers, - and _ in the file name.'; return false; }
        if (store.maps.includes(data.file)) { err.textContent = `A map called “${data.file}” already exists.`; return false; }
        if (!store.project.canSave) { toast('This copy of the editor can’t make files.', 'error'); return; }
        void (async () => {
          try {
            const src = n === store.mapName ? store.map : await store.project.readMap(n);
            const copy = JSON.parse(JSON.stringify(src)) as MapData;
            copy.name = data.name.trim() || data.file;
            await store.project.write(`maps/${data.file}.json`, formatMap(copy));
            store.maps = [...store.maps, data.file].sort();
            store.mapKinds.set(data.file, copy.kind === 'battle' ? 'battle' : 'field');
            names.set(data.file, copy.name);
            const folder = store.db.mapFolders?.[n];
            if (folder) editFolders((f) => (f[data.file] = folder)); else render();
            store.emit('meta');
            toast(`Made ${data.file}${n === store.mapName && store.dirty ? ' (with this map’s unsaved changes)' : ''}.`);
          } catch (e) { toast(`Couldn’t duplicate ${n}: ${e instanceof Error ? e.message : String(e)}`, 'error'); }
        })();
      } },
    ]);
  };

  const deleteMap = (n: string) => {
    if (store.maps.filter((m) => m !== n).length === 0) { toast('This is the only map: make another one before deleting it.', 'error'); return; }
    if (n === store.db.startMap) { toast(`${n} is the start map. Pick another start map first (Database, or a Transfer’s “start here”).`, 'error'); return; }
    if (!store.project.removeMap) { toast('This copy of the editor can’t delete files.', 'error'); return; }
    whenSaved('delete a map', () => void (async () => {
      let maps: Map<string, MapData>;
      try { maps = await readAll(); } catch (e) { toast(`Couldn’t check the other maps: ${e instanceof Error ? e.message : String(e)}`, 'error'); return; }
      const users = [...maps].filter(([m, d]) => m !== n && refs(d, n, null) > 0).map(([m]) => m);
      const inDb = refs(store.db, n, null);
      const where = store.project.kind === 'browser' ? 'It’s deleted on GitHub too with your next Push.' : 'A copy goes to the project’s .trash/maps/ folder, just in case.';
      openModal('Delete map?', h('div', {},
        h('p', { class: 'modal-text' }, `Delete “${n}”${names.get(n) && names.get(n) !== n ? ` (${names.get(n)})` : ''}? ${where}`),
        users.length || inDb ? h('p', { class: 'modal-text warn' }, `Still pointed at by ${[
          users.length ? `${users.length} map${users.length === 1 ? '' : 's'} (${users.slice(0, 5).join(', ')}${users.length > 5 ? '…' : ''})` : '',
          inDb ? `${inDb} place${inDb === 1 ? '' : 's'} in the Database (quests, chatter, battle maps…)` : ''].filter(Boolean).join(' and ')}: those Transfers and settings will need a new map.`) : null), [
        { label: 'Cancel' },
        { label: 'Delete map', danger: true, onClick: () => void (async () => {
          try {
            if (n === store.mapName) {
              const next = store.maps.includes(store.db.startMap) ? store.db.startMap : store.maps.find((m) => m !== n)!;
              store.open(next, maps.get(next)!);
            }
            await store.project.removeMap!(n);
            store.maps = store.maps.filter((m) => m !== n);
            store.mapKinds.delete(n);
            names.delete(n);
            // Its folder and its place in the World layout go with it.
            if (store.db.mapFolders?.[n]) { const f = { ...store.db.mapFolders }; delete f[n]; setFolders(store.db, f, folderNames(store.db)); }
            if (store.db.world?.maps[n]) delete store.db.world.maps[n];
            await store.project.write('database.json', formatDatabase(store.db));
            store.dbDirty = false;
            store.emit('meta');
            render();
            toast(`Deleted ${n}.`);
          } catch (e) { toast(`Couldn’t delete ${n}: ${e instanceof Error ? e.message : String(e)}`, 'error'); }
        })() },
      ]);
    })());
  };

  // Display names, read in the background (the open map's from memory).
  void (async () => {
    for (const n of [...store.maps]) {
      if (!list.isConnected) return;
      try { names.set(n, n === store.mapName ? store.map.name : (await store.project.readMap(n)).name); } catch { /* unreadable */ }
      render();
    }
  })();

  render();
}
