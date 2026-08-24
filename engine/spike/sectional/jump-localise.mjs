/**
 * TANGENT-JUMP LOCALISATION EXPERIMENT + PRE-REGISTERED THRESHOLD SWEEP.
 * Spec 48.4 / 48.5, frozen b4d84cf. Development data ONLY.
 *
 * The independent asymmetric chine is NOT touched by this file.
 * Analytic chine coordinates appear only as SCORING truth.
 */
import { analyticBody } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { makeJumpField, extractJumpRidges } from './ridge.mjs';

const DEG = 180 / Math.PI, A = 3, NX = 240, D = 0.700, JIT = 0.4;
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
const chineFn = (x, th) => { const c = Math.cos(th); return c < -1e-12 ? Math.min(rc(x), D / -c) : rc(x); };
const cornerTh = (x) => (rc(x) > D ? Math.acos(-D / rc(x)) : null);   // SCORING ONLY
const GRID = { nx: 128, nu: 256 };
const X_END = A * Math.sqrt(1 - D * D);
/** SPAN CRITERION, fixed before the sweep (48.5): half the chine's own extent. */
const S = 46;
const SWEEP = [2, 3, 5, 7.5, 10, 15, 20, 25, 30, 35, 40];    // degrees

const NEG = [
  ['regular', rc, null, 30], ['G1 jitter', rc, 'sineJitter', 30], ['G2 density', rc, 'blockDensity', 30],
  ['G3 shear', rc, 'azimuthalShear', 30], ['G4 walk', rc, 'surfaceWalk', 30],
  ['regular', rc, null, 118], ['G1 jitter', rc, 'sineJitter', 118], ['G2 density', rc, 'blockDensity', 118],
  ['G3 shear', rc, 'azimuthalShear', 118], ['G4 walk', rc, 'surfaceWalk', 118],
];
const POS = [['regular', chineFn, null, 96], ['G1 jitter', chineFn, 'sineJitter', 96],
  ['regular', chineFn, null, 30], ['G1 jitter', chineFn, 'sineJitter', 30]];

const build = (fn, gen, nt) => (gen ? GENERATORS[gen](fn, A, NX, nt, JIT) : analyticBody(fn, A, { nx: NX, nt }));
const fields = new Map();
const fieldFor = (key, fn, gen, nt) => {
  if (!fields.has(key)) fields.set(key, makeJumpField(build(fn, gen, nt).verts, build(fn, gen, nt).faces));
  return fields.get(key);
};

console.log('\nTANGENT-JUMP LOCALISATION — development data only. Independent control untouched.');
console.log(`grid ${GRID.nx} x ${GRID.nu}, span criterion S = ${S} x-steps (half the chine's ${Math.round(2 * X_END / (2 * A) * GRID.nx)}-step extent)\n`);

/* ---- demonstrations 2 and 3: is the response single and centred? ---- */
console.log('  DEMO 2/3 — response shape and centring on the burned chine (scoring vs analytic corner)');
console.log('    body            nt     rows with 1 peak/side   mean |offset| from true corner   peak dPsi (deg)');
for (const [lab, fn, gen, nt] of POS) {
  const f = fieldFor(`P:${lab}:${nt}`, fn, gen, nt);
  const du = 2 * Math.PI / GRID.nu;
  let rows = 0, single = 0, offSum = 0, offN = 0, pkMax = 0;
  for (let i = 0; i < GRID.nx; i += 2) {
    const x = f.x0 + (f.x1 - f.x0) * i / (GRID.nx - 1);
    const c = cornerTh(x);
    if (c === null || Math.abs(x) > X_END - 0.1) continue;
    rows++;
    const row = new Array(GRID.nu);
    for (let j = 0; j < GRID.nu; j++) { const v = f.J(x, -Math.PI + j * du); row[j] = Number.isNaN(v) ? 0 : v; }
    const pk = [];
    for (let j = 0; j < GRID.nu; j++) {
      const a = row[(j - 1 + GRID.nu) % GRID.nu], b = row[j], cc = row[(j + 1) % GRID.nu];
      if (b >= 5 / DEG && b >= a && b > cc) pk.push({ u: -Math.PI + j * du, k: b });
    }
    // one peak per side of the body means exactly 2 in total for this geometry
    if (pk.length === 2) single++;
    for (const w of [c, -c]) {
      if (!pk.length) continue;
      const near = pk.reduce((bb, p) => (Math.abs(p.u - w) < Math.abs(bb.u - w) ? p : bb));
      offSum += Math.abs(near.u - w) * DEG; offN++;
      pkMax = Math.max(pkMax, near.k);
    }
  }
  console.log(`    ${lab.padEnd(14)} ${String(nt).padEnd(5)} ${`${single}/${rows}`.padStart(20)}   ` +
    `${(offSum / Math.max(1, offN)).toFixed(2).padStart(26)} deg   ${(pkMax * DEG).toFixed(2).padStart(12)}`);
}
console.log(`\n    (true chine angle for D=${D} is ${(Math.acos(D) * DEG).toFixed(3)} deg at mid-body)`);

/* ---- the pre-registered sweep ---- */
console.log('\n  PRE-REGISTERED SWEEP (48.5). Valid iff every negative gives ZERO curves of span >= S');
console.log('  AND the burned chine gives >= 2 curves of span >= S at BOTH resolutions.\n');
console.log('   threshold   worst negative (curves >= S)   chine nt=96   chine nt=30   valid');
const valid = [];
for (const t of SWEEP) {
  const floorRad = t / DEG;
  let worstNeg = 0, negWho = '';
  for (const [lab, fn, gen, nt] of NEG) {
    const f = fieldFor(`N:${lab}:${nt}`, fn, gen, nt);
    const r = extractJumpRidges(f, { ...GRID, floorRad });
    const n = r.allCurves.filter((c) => c.length >= S).length;
    if (n > worstNeg) { worstNeg = n; negWho = `${lab} nt=${nt}`; }
  }
  const pos = {};
  for (const [lab, fn, gen, nt] of POS) {
    if (lab !== 'regular') continue;
    const f = fieldFor(`P:${lab}:${nt}`, fn, gen, nt);
    const r = extractJumpRidges(f, { ...GRID, floorRad });
    pos[nt] = r.allCurves.filter((c) => c.length >= S).length;
  }
  const ok = worstNeg === 0 && pos[96] >= 2 && pos[30] >= 2;
  if (ok) valid.push(t);
  console.log(`   ${String(t).padStart(7)} deg ${String(worstNeg).padStart(14)}${worstNeg ? ` (${negWho})` : '            '}   ` +
    `${String(pos[96]).padStart(11)}   ${String(pos[30]).padStart(11)}   ${ok ? 'YES' : 'no'}`);
}

if (!valid.length) {
  console.log('\n  ==> NO VALID INTERVAL. Per 48.5 the detector FAILS; the criterion is not relaxed.');
} else {
  // widest contiguous run within the swept list
  let bi = 0, bl = 1, ci = 0, cl = 1;
  for (let i = 1; i < valid.length; i++) {
    if (SWEEP.indexOf(valid[i]) === SWEEP.indexOf(valid[i - 1]) + 1) cl++; else { ci = i; cl = 1; }
    if (cl > bl) { bl = cl; bi = ci; }
  }
  const run = valid.slice(bi, bi + bl);
  const centre = (run[0] + run[run.length - 1]) / 2;
  console.log(`\n  valid thresholds: ${valid.join(', ')} deg`);
  console.log(`  widest contiguous run: ${run.join(', ')} deg  ->  CENTRE = ${centre.toFixed(2)} deg`);
}
