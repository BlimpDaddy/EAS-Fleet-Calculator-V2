/**
 * RIDGE TRACER — NEGATIVE CONTROL FIRST. Spec 46.6A.
 *
 * The persistence parameter must be re-expressed for the ridge representation
 * (minEdges = 24 was selected against the retired edge rule). The Gate 1
 * smooth bodies are the BINDING test: a tracer that turns scattered
 * smooth-mesh artefacts into persistent curves fails immediately.
 *
 * So the negatives are measured BEFORE the chine, and the longest spurious
 * curve on any smooth body is what the persistence parameter must clear.
 *
 * Evidence floor held at the FROZEN 0.05. Nothing retuned.
 */
import { analyticBody } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { makeKinkField, extractRidges } from './ridge.mjs';

const A = 3, NX = 240, D = 0.700, JIT = 0.4;
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
const chineFn = (x, th) => { const c = Math.cos(th); return c < -1e-12 ? Math.min(rc(x), D / -c) : rc(x); };
const GRID = { nx: 128, nu: 256, floor: 0.05, minSpan: 1 };   // minSpan 1 = filter nothing yet

console.log('\nRIDGE TRACER — negative controls measured FIRST (spec 46.6A).');
console.log(`grid ${GRID.nx} x ${GRID.nu}, evidence floor ${GRID.floor} (frozen), minSpan 1 so nothing is filtered.\n`);
console.log('  body                  nt    peaks   components   LONGEST curve   max K on longest');

const rows = [];
for (const [lab, fn, gen, nt] of [
  ['SMOOTH regular', rc, null, 30], ['SMOOTH G1 jitter', rc, 'sineJitter', 30],
  ['SMOOTH G2 density', rc, 'blockDensity', 30], ['SMOOTH G3 shear', rc, 'azimuthalShear', 30],
  ['SMOOTH G4 walk', rc, 'surfaceWalk', 30],
  ['SMOOTH regular', rc, null, 118], ['SMOOTH G1 jitter', rc, 'sineJitter', 118],
  ['SMOOTH G2 density', rc, 'blockDensity', 118], ['SMOOTH G3 shear', rc, 'azimuthalShear', 118],
  ['SMOOTH G4 walk', rc, 'surfaceWalk', 118],
  ['CHINE regular', chineFn, null, 96], ['CHINE G1 jitter', chineFn, 'sineJitter', 96],
  ['CHINE regular', chineFn, null, 30], ['CHINE G1 jitter', chineFn, 'sineJitter', 30]]) {
  const mesh = gen ? GENERATORS[gen](fn, A, NX, nt, JIT) : analyticBody(fn, A, { nx: NX, nt });
  const field = makeKinkField(mesh.verts, mesh.faces);
  const r = extractRidges(field, GRID);
  const longest = r.allCurves.length ? r.allCurves.reduce((b, c) => (c.length > b.length ? c : b)) : [];
  const maxK = longest.length ? Math.max(...longest.map((p) => p.k)) : 0;
  rows.push({ lab, nt, smooth: lab.startsWith('SMOOTH'), len: longest.length, maxK, stats: r.stats });
  console.log(`  ${lab.padEnd(20)} ${String(nt).padEnd(5)} ${String(r.stats.peakRows).padStart(6)} ` +
    `${String(r.stats.components).padStart(12)} ${String(longest.length).padStart(15)} ${maxK.toFixed(4).padStart(17)}`);
}

const sm = rows.filter((r) => r.smooth), ch = rows.filter((r) => !r.smooth);
const worstSmooth = Math.max(...sm.map((r) => r.len));
const weakestChine = Math.min(...ch.map((r) => r.len));
console.log(`\n  longest spurious ridge on ANY smooth body : ${worstSmooth} of ${GRID.nx} x-steps`);
console.log(`  shortest real ridge on any chine body     : ${weakestChine} of ${GRID.nx} x-steps`);
console.log(`  separation: ${(weakestChine / Math.max(1, worstSmooth)).toFixed(1)}x`);
console.log('\n  A persistence parameter is legitimate only if it sits strictly between those.');
