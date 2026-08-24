/**
 * SYNC — refresh site/ from the working repo (../../CalcV1-site).
 *
 * This repo is the PUBLIC / DEPLOY home of the calculator; until the
 * cutover, day-to-day development continues in the CalcV1-site working
 * repo. This script makes site/ a byte-exact copy of the deployable
 * tree so the two can never drift silently. It touches NOTHING outside
 * ./site — the deletes below only clear this repo's own staging copy
 * before re-copying.
 *
 * Run from anywhere:  node tools/sync-site.mjs
 * Dev-machine only: it needs the CalcV1-site sibling checkout.
 */
import { cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../CalcV1-site/', import.meta.url));
const SITE = fileURLToPath(new URL('../site/', import.meta.url));
if (!existsSync(SRC)) throw new Error('CalcV1-site sibling not found — sync only runs on the dev machine');

/* The deploy tree — exactly what Cloudflare Pages serves. Dev files
 * (serve.mjs, bake-calcv2.mjs, gate-calcv2.mjs, test/, tools/, the
 * .bat launcher) are deliberately absent: they live in this repo's
 * tools/ and test/ instead. */
const DEPLOY = ['index.html', 'style.css', 'main.js', 'main.js.sha256',
  '_headers', '_redirects', 'assets', 'v2', 'calcv2'];

for (const entry of DEPLOY) {
  const from = SRC + entry;
  if (!existsSync(from)) throw new Error(`missing in source: ${entry}`);
  rmSync(SITE + entry, { recursive: true, force: true });
  cpSync(from, SITE + entry, { recursive: true });
}
console.log(`site/ synced from CalcV1-site (${DEPLOY.length} top-level entries)`);
