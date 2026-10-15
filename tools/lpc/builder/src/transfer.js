// ---------------------------------------------------------------------------------------------------------------
// Moving your library between copies of the builder (the hosted one on a tablet, the one on your PC):
//  - Back up: every character and weapon, with all their settings, in one .json file.
//  - Import: that file, exported character or weapon PNGs (their settings are stored inside them), or a .zip of
//    any of these (Export all). Things already here (same id) are updated only by a newer copy.
// ---------------------------------------------------------------------------------------------------------------

const LIBRARY_FORMAT = 'hd2d-builder-library';

async function backupLibrary() {
  const data = {
    format: LIBRARY_FORMAT, version: 1, exported: new Date().toISOString(),
    characters: saved.chars.map(({ id, name, body, skin, leftEye, sel, updated }) => ({ id, name, body, skin, leftEye: leftEye ?? null, sel, updated })),
    weapons: (saved.weapons ?? []).map(({ id, name, base, colours, glow, trail, updated }) => ({ id, name, base, colours, glow, trail, updated })),
  };
  if (!data.characters.length && !data.weapons.length) { toast('Nothing to back up yet: save a character or a weapon first', true); return; }
  try {
    const r = await saveFile('character-builder-library.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    if (r === 'saved') toast(`Backed up ${data.characters.length} character${data.characters.length === 1 ? '' : 's'} and ${data.weapons.length} weapon${data.weapons.length === 1 ? '' : 's'}`);
  } catch (e) { toast(e.message, true); }
}

/** Text stored in a PNG (the builders' iTXt / tEXt chunks), or null. */
async function pngText(blob, keyword) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < 8 || buf[0] !== 137 || buf[1] !== 80) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), latin1 = new TextDecoder('latin1'), utf8 = new TextDecoder();
  for (let p = 8; p + 12 <= buf.length;) {
    const len = dv.getUint32(p), type = latin1.decode(buf.subarray(p + 4, p + 8)), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'tEXt' || type === 'iTXt') {
      const z = data.indexOf(0);
      if (z > 0 && latin1.decode(data.subarray(0, z)) === keyword) {
        if (type === 'tEXt') return latin1.decode(data.subarray(z + 1));
        if (data[z + 1] !== 0) return null;
        let q = data.indexOf(0, z + 3) + 1;
        q = data.indexOf(0, q) + 1;
        return utf8.decode(data.subarray(q));
      }
    }
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return null;
}

/** What a file holds: { chars: [], weapons: [], skipped: [names] }. */
async function readLibraryFile(name, blob, out) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.zip')) {
    for (const e of await Zip.read(blob)) if (!e.dir && /\.(png|json)$/i.test(e.name)) await readLibraryFile(e.name, await e.blob(), out);
    return;
  }
  if (lower.endsWith('.json')) {
    let d = null;
    try { d = JSON.parse(await blob.text()); } catch { /* not JSON */ }
    if (d?.format !== LIBRARY_FORMAT) { out.skipped.push(name); return; }
    out.chars.push(...(d.characters ?? []).filter((c) => c && c.body && c.sel));
    out.weapons.push(...(d.weapons ?? []).filter((w) => w && w.base));
    return;
  }
  if (lower.endsWith('.png')) {
    const ch = await pngText(blob, 'hd2d-character');
    if (ch) {
      const m = JSON.parse(ch);
      if (m.recipe?.sel) { out.chars.push({ ...m.recipe, name: m.name || m.recipe.name || name.replace(/\.png$/i, '') }); return; }
      out.skipped.push(name + ' (exported before characters kept their settings: open it in the builder it was made in and export it again)');
      return;
    }
    const wp = await pngText(blob, 'hd2d-weapon');
    if (wp) {
      const m = JSON.parse(wp), r = m.recipe ?? {};
      out.weapons.push({ id: r.id, name: m.name || name.replace(/\.png$/i, ''), base: r.base ?? m.base, colours: r.colours ?? {},
        glow: r.glow ?? (m.effects?.glow ? { on: true, strength: 1, pulse: true, ...m.effects.glow } : undefined),
        trail: r.trail ?? (m.effects?.trail ? { on: true, length: 3, ...m.effects.trail } : undefined) });
      return;
    }
  }
  out.skipped.push(name);
}

/** Add what the files hold to the library: new ones added, ones already here replaced only by a newer copy. */
async function importLibrary(files) {
  if (!store || !files.length) return;
  const got = { chars: [], weapons: [], skipped: [] };
  $('loading').hidden = false;
  try {
    for (const f of files) {
      try { await readLibraryFile(f.name, f, got); } catch { got.skipped.push(f.name); }
    }
    let added = 0, updated = 0, same = 0;
    const merge = async (list, have, save) => {
      for (const x of list) {
        const mine = x.id ? have.find((h) => h.id === x.id) : null;
        if (mine && (mine.updated ?? 0) >= (x.updated ?? 0)) { same++; continue; }
        const { updated: _u, ...body } = x;
        await save({ ...body, id: x.id || undefined });
        if (mine) updated++; else added++;
      }
    };
    await merge(got.chars.map((c) => ({ ...c, leftEye: c.leftEye ?? null })), saved.chars, (c) => store.saveChar(c));
    const weapons = got.weapons.filter((w) => Arm.byId.has(w.base));
    const missing = got.weapons.length - weapons.length;
    await merge(weapons, saved.weapons ?? [], (w) => store.saveWeapon(w));
    const parts = [];
    if (added) parts.push(`${added} added`);
    if (updated) parts.push(`${updated} updated`);
    if (same) parts.push(`${same} already up to date`);
    if (missing) parts.push(`${missing} weapon${missing === 1 ? '' : 's'} made from a shape this copy doesn’t have`);
    if (got.skipped.length) parts.push(`skipped: ${got.skipped.slice(0, 3).join(', ')}${got.skipped.length > 3 ? '…' : ''}`);
    const n = got.chars.length + got.weapons.length;
    toast(n ? `Imported ${got.chars.length} character${got.chars.length === 1 ? '' : 's'} and ${got.weapons.length} weapon${got.weapons.length === 1 ? '' : 's'}: ${parts.join(', ')}` : `Nothing to import (${parts.join(', ') || 'no builder files'})`, !n);
  } finally { $('loading').hidden = !loading; }
}

/** Ask for files to import (a backup .json, exported PNGs, or a .zip). */
function pickLibraryFiles() {
  const input = h('input', { type: 'file', accept: '.json,.png,.zip,application/json,image/png,application/zip', multiple: true, hidden: true });
  input.addEventListener('change', async () => { const files = [...(input.files ?? [])]; input.remove(); await importLibrary(files); });
  document.body.appendChild(input);
  input.click();
}
