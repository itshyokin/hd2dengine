import { defineConfig, type Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const DATA_DIR = path.resolve('public/data');

/**
 * Dev-server endpoints that let the editor save straight into public/data/.
 *   GET  /__editor/maps                     → ["map001", ...]
 *   POST /__editor/save?file=maps/x.json    → writes the request body
 *   POST /__editor/upload?file=assets/props/x.png → writes an imported image (or sound)
 * Only database.json, assets.json, maps/*.json, assets/(props|tiles|icons|characters|weapons/custom)/*.png and assets/audio/* can be written.
 */
function editorApi(): Plugin {
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };
  const readBytes = (req: IncomingMessage) =>
    new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  const readBody = async (req: IncomingMessage) => (await readBytes(req)).toString('utf8');

  return {
    name: 'editor-api',
    configureServer(server) {
      // Saving from the editor shouldn't make Vite reload the editor page.
      server.watcher.unwatch(DATA_DIR);
      server.watcher.unwatch(path.resolve('public/assets'));
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__editor/')) return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          if (url.pathname === '/__editor/ping') return send(res, 200, { ok: true });
          if (req.method === 'GET' && url.pathname === '/__editor/maps') {
            const files = await fs.readdir(path.join(DATA_DIR, 'maps'));
            return send(res, 200, files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort());
          }
          if (req.method === 'POST' && url.pathname === '/__editor/save') {
            const file = url.searchParams.get('file') ?? '';
            if (!/^(database|assets|maps\/[A-Za-z0-9_-]+)\.json$/.test(file)) return send(res, 400, { error: 'Invalid file name' });
            const body = await readBody(req);
            JSON.parse(body); // refuse anything that isn't valid JSON
            const target = path.join(DATA_DIR, file);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, body, 'utf8');
            return send(res, 200, { ok: true });
          }
          if (req.method === 'POST' && url.pathname === '/__editor/upload') {
            const file = url.searchParams.get('file') ?? '';
            if (!/^assets\/(?:(?:props|tiles|icons|characters|enemies|weapons\/custom)\/[A-Za-z0-9_.-]+\.png|audio\/[A-Za-z0-9_.-]+\.(?:ogg|mp3|wav|m4a))$/.test(file)) return send(res, 400, { error: 'Invalid file name' });
            const target = path.resolve('public', file);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, await readBytes(req));
            return send(res, 200, { ok: true });
          }
          send(res, 404, { error: 'Unknown editor endpoint' });
        } catch (err) {
          send(res, 500, { error: String(err) });
        }
      });
    },
  };
}

export default defineConfig({
  // Relative paths so the built game runs from any folder,
  // and later inside Tauri (Windows) or Capacitor (Android).
  base: './',
  plugins: [editorApi()],
  build: {
    target: 'es2020',
    rollupOptions: { input: { main: path.resolve('index.html'), editor: path.resolve('editor.html') } },
  },
  // `host: true` lets a phone on the same Wi-Fi open the dev server.
  server: { host: true },
});
