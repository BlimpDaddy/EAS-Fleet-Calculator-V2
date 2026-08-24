/**
 * DEMONSTRATIONS 1-4 AT THE SELECTED THRESHOLD. Spec 48.4.
 *
 * The sweep in `jump-localise.mjs` selected 21.50 deg as the centre of the
 * widest valid interval. The shape/centring columns in that file were computed
 * at a placeholder 5 deg floor and therefore did NOT demonstrate anything about
 * the operating point. These are the honest numbers at 21.50 deg.
 *
 * Development data only. Analytic chine is SCORING truth. Independent control
 * untouched.
 */
import { analyticBody } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { makeJumpField, extractJumpRidges } from './ridge.mjs';

const DEG = 180 / Math.PI, A = 3, NX = 240, D = 0.700, JIT = 0.4;
const SELECTED = 21.50;                       // deg, from the pre-registered sweep
const GRID = { nx: 128, nu: 256 };
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
const chineFn = (x, th) => { const c = Math.cos(th); return c < -1e-12 ? Math.min(rc(x), D / -c) : rc(x); };
const cornerTh = (x) => (rc(x) > D ? Math.acos(-D / rc(x)) : null);
const X_END = A * Math.sqrt(1 - D * D);
const build = (fn, gen, nt) => (gen ? GENERATORS[gen](fn, A, NX, nt, JIT) : analyticBody(fn, A, { nx: NX, nt }));

console.log(`\nDEMONSTRATIONS AT THE SELECTED THRESHOLD ${SELECTED} deg (spec 48.4)\n`);

console.log('  DEMO 1 — Gate 1 smooth negatives must remain feature-free');
let worstNeg = 0;
for (const [lab, gen, nt] of [['regular', null, 30], ['G1 jitter', 'sineJitter', 30], ['G2 density', 'blockDensity', 30],
  ['G3 shear', 'azimuthalShear', 30], ['G4 walk', 'surfaceWalk', 30], ['regular', null, 118],
  ['G1 jitter', 'sineJitter', 118], ['G2 density', 'blockDensity', 118], ['G3 shear', 'azimuthalShear', 118],
  ['G4 walk', 'surfaceWalk', 118]]) {
  const m = build(rc, gen, nt);
  const r = extractJumpRidges(makeJumpField(m.verts, m.faces), { ...GRID, floorRad: SELECTED / DEG });
  worstNeg = Math.max(worstNeg, r.stats.longest);
  console.log(`    ${lab.padEnd(12)} nt=${String(nt).padEnd(4)} peaks ${String(r.stats.peakRows).padStart(4)}   longest curve ${String(r.stats.longest).padStart(3)} of ${GRID.nx}`);
}
console.log(`    -> longest spurious curve on ANY smooth body: ${worstNeg} x-steps\n`);

console.log('  DEMOS 2/3/4 — burned chine: response shape, centring, extent, phase dependence');
console.log('    body            nt    rows   rows with exactly 2 peaks   mean|offset|   curves>=46   longest span');
const cov = {};
for (const [lab, gen, nt] of [['regular', null, 96], ['G1 jitter', 'sineJitter', 96],
  ['regular', null, 30], ['G1 jitter', 'sineJitter', 30]]) {
  const m = build(chineFn, gen, nt);
  const f = makeJumpField(m.verts, m.faces);
  const du = 2 * Math.PI / GRID.nu;
  let rows = 0, two = 0, offSum = 0, offN = 0;
  for (let i = 0; i < GRID.nx; i++) {
    const x = f.x0 + (f.x1 - f.x0) * i / (GRID.nx - 1);
    const c = cornerTh(x);
    if (c === null || Math.abs(x) > X_END - 0.1) continue;
    rows++;
    const row = new Array(GRID.nu);
    for (let j = 0; j < GRID.nu; j++) { const v = f.J(x, -Math.PI + j * du); row[j] = Number.isNaN(v) ? 0 : v; }
    const pk = [];
    for (let j = 0; j < GRID.nu; j++) {
      const a = row[(j - 1 + GRID.nu) % GRID.nu], b = row[j], cc = row[(j + 1) % GRID.nu];
      if (b >= SELECTED / DEG && b >= a && b > cc) pk.push(-Math.PI + j * du);
    }
    if (pk.length === 2) two++;
    for (const w of [c, -c]) {
      if (!pk.length) continue;
      offSum += Math.min(...pk.map((p) => Math.abs(p - w))) * DEG; offN++;
    }
  }
  const r = extractJumpRidges(f, { ...GRID, floorRad: SELECTED / DEG });
  const long = r.allCurves.filter((c) => c.length >= 46).map((c) => c.length).sort((a, b) => b - a);
  cov[`${lab}|${nt}`] = two / rows;
  console.log(`    ${lab.padEnd(14)} ${String(nt).padEnd(5)} ${String(rows).padStart(4)}   ${`${two}/${rows} (${(100 * two / rows).toFixed(0)}%)`.padStart(24)}   ` +
    `${(offSum / Math.max(1, offN)).toFixed(2).padStart(8)} deg   ${String(long.length).padStart(10)}   ${String(long[0] ?? 0).padStart(12)}`);
}
console.log(`\n    chine analytic extent = ${Math.round(2 * X_END / (2 * A) * GRID.nx)} of ${GRID.nx} x-steps`);
console.log(`    DEMO 4 phase dependence: regular vs jittered row coverage`);
console.log(`      nt=96  regular ${(100 * cov['regular|96']).toFixed(0)}%  vs jittered ${(100 * cov['G1 jitter|96']).toFixed(0)}%`);
console.log(`      nt=30  regular ${(100 * cov['regular|30']).toFixed(0)}%  vs jittered ${(100 * cov['G1 jitter|30']).toFixed(0)}%`);
console.log(`      (retired detector: 62.9% regular vs 98.8% jittered -- a 36-point gap)`);
