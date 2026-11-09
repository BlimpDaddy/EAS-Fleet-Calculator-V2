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
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
/* THE TEST SUITES TRAVEL TOO. Until 2026-11-09 this script copied only the deploy tree, so the
 * public repo's test/ folder kept the copy taken at skeleton time and silently went stale: after the
 * S 12 -> 28 % and deployed-Cd 0.028 rulings it reported 123 passed / 20 FAILED while the working
 * repo was 143 / 0. An outside reviewer read those 20 as calculator disagreements. They were a
 * sync gap. Only the two portable suites are copied (the zero-diff gate is git-based and specific
 * to the working repo); imports are re-targeted from the working layout to this repo's site/. */
const TESTS = ['dynamic-state-fixtures.mjs', 'economics-fixtures.mjs'];
const TEST_OUT = fileURLToPath(new URL('../test/', import.meta.url));
mkdirSync(TEST_OUT, { recursive: true });
for (const f of TESTS) {
  const s = readFileSync(SRC + 'test/' + f, 'utf8')
    .replaceAll("'../calcv2/", "'../site/calcv2/").replaceAll("'../v2/", "'../site/v2/");
  writeFileSync(TEST_OUT + f, s);
}
console.log(`site/ synced from CalcV1-site (${DEPLOY.length} top-level entries) + ${TESTS.length} test suites`);
