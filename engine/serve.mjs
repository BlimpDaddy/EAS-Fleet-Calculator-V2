/**
 * Tiny zero-dependency static server for the shape inspector.
 *
 * Needed because browsers refuse to load ES modules from file:// URLs. Serves the
 * CalcV2 folder and opens the page. Nothing to install.
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
// The existing shape library lives next door; expose it read-only at /objs/ so the
// page can offer one-click loading of known shapes alongside drag-and-drop.
const OBJ_DIR = fileURLToPath(new URL('../../3D OBJ/', import.meta.url));
const PORT = Number(process.env.PORT) || 5178;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.obj': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

    // Redirect rather than silently serving web/index.html at "/": the browser resolves
    // the page's relative script paths against the URL, so serving it at "/" would make
    // "./app.js" request "/app.js" and 404.
    if (path === '/') {
      res.writeHead(302, { location: '/web/' }).end();
      return;
    }
    if (path === '/web' || path === '/web/') path = '/web/index.html';

    if (path === '/objs-list') {
      let names = [];
      try {
        names = (await readdir(OBJ_DIR)).filter((f) => f.toLowerCase().endsWith('.obj')).sort();
      } catch { /* folder may not exist — page falls back to drag-and-drop */ }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(names));
      return;
    }

    if (path.startsWith('/objs/')) {
      const name = normalize(path.slice('/objs/'.length)).replace(/^(\.\.[/\\])+/, '');
      const file = join(OBJ_DIR, name);
      if (!file.startsWith(OBJ_DIR)) { res.writeHead(403).end('forbidden'); return; }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(await readFile(file));
      return;
    }

    // Keep requests inside ROOT.
    const full = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const body = await readFile(full);
    res.writeHead(200, {
      'content-type': TYPES[extname(full)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`\n  EAS shape inspector running at  ${url}`);
  console.log('  Close this window to stop it.\n');
  // Open the default browser (Windows). NO_OPEN=1 suppresses it for automated checks.
  if (!process.env.NO_OPEN) {
    spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref();
  }
});
