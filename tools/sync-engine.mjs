/**
 * SYNC — refresh engine/ from the working engine repo (../../CalcV2).
 *
 * CONSOLIDATION (owner direction 2026-08-24): the calculator becomes ONE
 * repo — site/ (what deploys) + engine/ (the full development home:
 * sources, bench, gate suites, payload runner, lab, canonical spike).
 * Until the cutover, day-to-day engine development continues in the
 * CalcV2 working repo; this script keeps engine/ an exact copy so the
 * two can never drift silently. It touches NOTHING outside ./engine.
 *
 * ONE deliberate transform (same class as the bake's, and for the same
 * reason): CalcV2's cross-repo imports point at the DEPLOYED engine
 * bytes in the CalcV1-site sibling. In this repo the deployed bytes
 * live at site/, at the SAME relative depth — so every
 * '…/CalcV1-site/calcv2/…' path becomes '…/site/calcv2/…' and every
 * '…, 'CalcV1-site', 'assets', …' join becomes '…, 'site', 'assets', …',
 * with the ../ prefixes untouched. Nothing else changes; the script
 * fails loudly if any CalcV1-site reference survives in code.
 *
 * ⚠ The frozen spike modules are among the transformed files. The
 * frozen-module rule allows exactly this class (path re-target at
 * copy time, content otherwise byte-identical), but the CUTOVER —
 * when engine/ becomes canonical instead of a mirror — still needs
 * the owner's dated amendment recorded in the rulings ledger.
 *
 * Run from anywhere:  node tools/sync-engine.mjs
 * Dev-machine only: it needs the CalcV2 sibling checkout.
 */
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../CalcV2/', import.meta.url));
const DEST = fileURLToPath(new URL('../engine/', import.meta.url));
if (!existsSync(SRC)) throw new Error('CalcV2 sibling not found — sync only runs on the dev machine');

/* never mirrored: git internals and installed packages (the vendored
 * quickhull3d in vendor/ is what the engine actually imports) */
const EXCLUDE = new Set(['.git', 'node_modules']);

/* clear CONTENTS rather than the folder itself — on Windows a shell
 * parked inside engine/ (or an indexer) holds the top directory and
 * rmSync(DEST) dies EPERM; its children delete fine */
if (existsSync(DEST)) {
  for (const e of readdirSync(DEST)) rmSync(join(DEST, e), { recursive: true, force: true });
}
cpSync(SRC, DEST, {
  recursive: true,
  filter: (from) => !EXCLUDE.has(from.slice(SRC.length).split(/[\\/]/)[0]),
});

/* re-target the deployed-bytes references (see header). Only PATH
 * STRINGS are rewritten — prose mentions of CalcV1-site in comments,
 * spec text and log messages are history and stay as written. */
const CODE_EXT = new Set(['.mjs', '.js', '.html', '.md']);
/* G0b's drift harness (run-smart-tail-g0.mjs) uses an absolute
 * dev-machine ROOT to compare the two WORKING repos byte-for-byte —
 * that is still its job until cutover, so it is copied untouched.
 * CUTOVER TODO: re-point it at engine/src vs site/calcv2/src. */
const TRANSFORM_EXCLUDE = new Set(['run-smart-tail-g0.mjs']);
const PATH_REF = /(\.\.\/)+CalcV1-site\/|'CalcV1-site', 'assets'/;
let transformed = 0, leftovers = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!CODE_EXT.has(extname(p)) || TRANSFORM_EXCLUDE.has(e)) continue;
    const before = readFileSync(p, 'utf8');
    const after = before
      .replaceAll('CalcV1-site/calcv2/', 'site/calcv2/')
      .replaceAll("'CalcV1-site', 'assets'", "'site', 'assets'")
      /* the local shape corpus (3D OBJ) sits beside the WORKING repos in
         CodeEverything, one level further up from engine/ than from
         CalcV2 — re-target so the mirror's V0 gate, payload runner and
         corpus fixtures still find it on the dev machine. Cloners are
         unaffected either way: without the corpus these skip/refuse
         exactly as they do in CalcV2. */
      .replaceAll("'..', '..', '3D OBJ'", "'..', '..', '..', '3D OBJ'")
      .replaceAll("'../3D OBJ/'", "'../../3D OBJ/'");
    if (after !== before) { writeFileSync(p, after); transformed++; }
    if (PATH_REF.test(after)) leftovers.push(p.slice(DEST.length));
  }
})(DEST);

if (leftovers.length) {
  throw new Error('unmapped CalcV1-site path reference(s) survived the sync:\n  ' + leftovers.join('\n  '));
}
console.log(`engine/ synced from CalcV2 — ${transformed} file(s) re-targeted to site/, no path leftovers`);
