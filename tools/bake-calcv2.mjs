/**
 * Bakes the shape pipeline (../engine: src, vendor, web, viz + the
 * spike closure) into ../site/calcv2/ so the deployed static tree is
 * self-contained — Cloudflare Pages has no serve.mjs to route /calcv2/*
 * to a sibling folder.
 *
 * CONSOLIDATED LAYOUT (2026-08-24): the engine lives in THIS repo at
 * engine/ (kept in step with the CalcV2 working repo by sync-engine.mjs
 * until cutover). Run `node tools/bake-calcv2.mjs` after engine
 * changes, before releasing. serve.mjs prefers site/calcv2 when
 * present, so local testing exercises exactly what deploys.
 *
 * Repo-layout note: this is CalcV1-site's bake-calcv2.mjs with the
 * output moved to site/calcv2 and the source to ../engine — plus the
 * spike re-path string updated for the consolidated layout (the engine
 * copies already point at site/, see sync-engine.mjs). Behaviour is
 * otherwise unchanged; keep in step with CalcV1-site's until cutover.
 */
import { cpSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/* DEV-ONLY files never baked into the deployable tree (ruling 2026-08-15):
 * the DYNAMIC bench is the engineer's console — it exposes engineer-fields
 * (floors, evidence zones, full contract dump) deliberately excluded from
 * the product page, and deploying it would publish a second, unreviewed
 * calculator. It stays in the CalcV2 repo, run locally via serve.mjs. */
const BAKE_EXCLUDE = new Set([
  'dynamic-bench.html',
  /* viz dev apparatus (V5 step 1, 2026-08-23): the bench page and the
     headless gate suites stay in the CalcV2 repo — only the panel,
     engine, payload layers and fixtures ship. */
  'bench', 'test',
]);

const site = fileURLToPath(new URL('../site/', import.meta.url));
const src = new URL('../engine/', import.meta.url);
if (!existsSync(fileURLToPath(src))) throw new Error('../engine not found — run node tools/sync-engine.mjs first');
rmSync(site + 'calcv2', { recursive: true, force: true });
for (const dir of ['src', 'vendor', 'web', 'viz']) {   // viz added V5 step 1 (2026-08-23)
  cpSync(fileURLToPath(new URL(dir, src)), `${site}calcv2/${dir}`, {
    recursive: true,
    filter: (from) => !BAKE_EXCLUDE.has(basename(from)),
  });
}
/* V5 step 2 (2026-08-23): the in-browser payload generator needs the
 * ribbon machinery. Copy ONLY its pure dependency closure (7 modules) and
 * rewrite ribbon-context's deliberate CalcV1-site engine imports to the
 * baked copies — the SAME bytes (hash-verified: CalcV2/src/sections.js ==
 * calcv2/src/sections.js by construction of this very bake), re-pathed so
 * a browser can resolve them. The canonical spike files stay untouched
 * (their node-side deployed-bytes intent, G0b, is preserved). */
const SPIKE_MODULES = ['ribbon-context.mjs', 'ribbons.mjs', 'support-skin.mjs',
  'eligibility.mjs', 'skin.mjs', 'ridge.mjs', 'features.mjs'];
mkdirSync(`${site}calcv2/spike/sectional`, { recursive: true });
for (const f of SPIKE_MODULES) {
  let text = readFileSync(fileURLToPath(new URL(`spike/sectional/${f}`, src)), 'utf8');
  text = text.replaceAll('../../../site/calcv2/src/', '../../src/');
  // node-only CLI self-run guards must not throw in a browser worker
  text = text.replaceAll('if (process.argv[1]', 'if (typeof process !== \'undefined\' && process.argv[1]');
  writeFileSync(`${site}calcv2/spike/sectional/${f}`, text);
}
console.log('baked engine/{src,vendor,web,viz} + spike closure -> site/calcv2/ (excluded: ' +
  [...BAKE_EXCLUDE].join(', ') + ')');
