/**
 * PHASE 2, EXPERIMENT 2 — spec 57. Frozen, no-fit measured-data audit.
 *
 * When the production scalar sees two TN-614 geometries as effectively the
 * same, does the pre-frozen ribbon representation separate them in the same
 * direction as measured drag?
 *
 * ORDERING ONLY. No fitted Cd, no error metric, no learned weight, nothing
 * selected after seeing a result. `compositeV1` is not modified (57.1).
 *
 * POWER, per 57.7: TWO independent controlled pairs. A direction test on two
 * pairs passes by coincidence 25% of the time. This is a CONSISTENCY CHECK,
 * NOT A VALIDATION.
 */
import { ZONES, ribbonMetrics } from './ribbons.mjs';
import { BODIES as TN, TEST_RE } from './tn614-bodies.mjs';
import { hullMesh, verifyOnSurface, PATTERNS } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, STATIONS, TIP } from './support-skin.mjs';
import { measureSections, scoreSections } from '../../../site/calcv2/src/sections.js';
import { classifySections } from '../../../site/calcv2/src/cdEstimator.js';

const DEG = 180 / Math.PI, SEED = 12345, CANON = 24;
const RUNG = { sx: 0.005, thDeg: 2 };
const EARNED = [1, 2, 3, 4, 5];
const rays = Array.from({ length: 2 * CANON }, (_, k) => (Math.PI * (k % CANON)) / CANON + (k >= CANON ? Math.PI : 0));

/* 57.2 provenance, read from CALIBRATION_KNOTS — measured, not assumed */
const CONSUMED = new Set(['111', '332']);

/* TN-614 ordinates are (station %, radius %) of basic length. Build the
   profile as a monotone interpolant and sample it as a body of revolution. */
function profileOf(name) {
  const pts = TN[name].pts.map(([s, r]) => [s / 100, r / 100]);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const a = (x1 - x0) / 2, cx = (x0 + x1) / 2;
  return {
    a,
    r: (x) => {                                  // x measured from body centre
      const s = x + cx;
      if (s <= x0 || s >= x1) return 0;
      let i = 0;
      while (i + 2 < pts.length && pts[i + 1][0] < s) i++;
      const [sa, ra] = pts[i], [sb, rb] = pts[i + 1];
      return ra + ((rb - ra) * (s - sa)) / (sb - sa);
    },
  };
}

function measureBoth(name, pattern, n) {
  const p = profileOf(name);
  const oracle = (x) => p.r(x);
  const pts = PATTERNS[pattern]((x) => oracle(x), p.a, n, SEED);
  if (!verifyOnSurface((x) => oracle(x), pts).pass) throw new Error(`INPUT FAILURE ${name}`);
  const mesh = hullMesh(pts);

  const m = measureSections(mesh.verts, mesh.faces, { axis: '+X' });
  const sc = scoreSections(m);
  const { cls } = classifySections(m, sc);

  const skin = makeSupportSkin(mesh.verts, mesh.faces, RUNG);
  const R = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
  for (let i = 0; i < STATIONS; i++) {
    const got = supportRadii(skin, i, rays);
    for (let k = 0; k < rays.length; k++) R[k][i] = got.r[k];
  }
  const met = R.map((rib) => ribbonMetrics(rib, 2 * p.a, { tipFrac: TIP }));
  const zones = Array.from({ length: ZONES }, (_, z) => {
    const v = met.map((q) => q.zones[z].abs * DEG).sort((x, y) => x - y);
    return v[Math.floor(v.length / 2)];
  });
  return { proxy: sc.compositeV1, softAft: sc.softAft, softFore: sc.softFore, cls, zones, cdA: TN[name].cdA };
}

const NAMES = Object.keys(TN);
console.log('\nSPEC 57 — PHASE 2 EXPERIMENT 2: frozen, no-fit measured-data audit (NACA TN-614)');
console.log(`  six bodies, fineness 5, effective Re ${(TEST_RE / 1e6).toFixed(0)}e6. Ordering only; nothing fitted.`);
console.log('  POWER (57.7): 2 independent pairs -> 25% chance of agreeing by coincidence. CONSISTENCY CHECK, NOT VALIDATION.\n');

/* ---- noise, measured exactly as in 56.6, on THESE bodies */
const NOISE_PATTERNS = ['fibonacci', 'lathe', 'random'];
let sigScalar = 0, sigRibbon = 0;
for (const name of NAMES) {
  const reps = NOISE_PATTERNS.map((p) => measureBoth(name, p, 12000));
  sigScalar = Math.max(sigScalar, Math.max(...reps.map((r) => r.proxy)) - Math.min(...reps.map((r) => r.proxy)));
  for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
    sigRibbon = Math.max(sigRibbon, Math.max(...EARNED.map((z) => Math.abs(reps[a].zones[z] - reps[b].zones[z]))));
  }
}
console.log(`  sigma_scalar = ${sigScalar.toExponential(3)}    sigma_ribbon = ${sigRibbon.toFixed(4)} deg\n`);

const M = Object.fromEntries(NAMES.map((n) => [n, measureBoth(n, 'fibonacci', 12000)]));

console.log('  body    provenance      CD_A     softFore    softAft   compositeV1  class     zones 1..5 median abs turning (deg)');
for (const n of NAMES) {
  const q = M[n];
  console.log(`  ${n.padEnd(6)}  ${(CONSUMED.has(n) ? 'CONSUMED' : 'unconsumed').padEnd(12)}  ${q.cdA.toFixed(4)}  ` +
    `${q.softFore.toExponential(2).padStart(9)}  ${q.softAft.toFixed(6)}  ${q.proxy.toFixed(6)}  ${q.cls.padEnd(8)} ` +
    EARNED.map((z) => q.zones[z].toFixed(2).padStart(7)).join(''));
}

/* ---- 57.3 controlled pairs, fixed by construction before any descriptor ran */
const PAIRS = [
  { a: '121T', b: '221', shared: 'tail 221', varies: 'nose', zonesOfInterest: [1, 2], independent: true },
  { a: '211T', b: '222', shared: 'nose 222', varies: 'tail', zonesOfInterest: [4, 5], independent: true },
  { a: '111', b: '211T', shared: 'tail 111', varies: 'nose', zonesOfInterest: [1, 2], independent: false },
  { a: '111', b: '121T', shared: 'nose 111', varies: 'tail', zonesOfInterest: [4, 5], independent: false },
];

/**
 * 57.5 pre-registered direction:
 *   nose-varying pairs — LOWER zone 1-2 turning  -> HIGHER CD_A
 *   tail-varying pairs — mirrored, in zones 4-5.
 */
function assess(p) {
  const A = M[p.a], B = M[p.b];
  const dScalar = Math.abs(A.proxy - B.proxy);
  const scalarBlind = dScalar <= sigScalar && A.cls === B.cls;
  const zs = p.zonesOfInterest;
  const dRibbon = Math.max(...zs.map((z) => Math.abs(A.zones[z] - B.zones[z])));
  const ribbonSeparates = dRibbon > sigRibbon;
  // predicted higher-drag body = the one with LESS turning in the zones of interest
  const turnA = zs.reduce((s, z) => s + A.zones[z], 0), turnB = zs.reduce((s, z) => s + B.zones[z], 0);
  const predictedHigher = turnA < turnB ? p.a : p.b;
  const measuredHigher = A.cdA > B.cdA ? p.a : p.b;
  return { dScalar, scalarBlind, dRibbon, ribbonSeparates, predictedHigher, measuredHigher,
    agrees: predictedHigher === measuredHigher, turnA, turnB };
}

for (const group of [true, false]) {
  console.log(`\n  ${group ? 'INDEPENDENT PAIRS (both bodies unconsumed)' : 'SUPPORTING PAIRS (involve calibration-consumed 111) — reported separately, NEVER pooled'}`);
  console.log('    pair               shared      varies  d(scalar)  blind?   d(ribbon)  separates?  predicted   measured   agrees?');
  for (const p of PAIRS.filter((q) => q.independent === group)) {
    const r = assess(p);
    console.log(`    ${(p.a + ' vs ' + p.b).padEnd(18)} ${p.shared.padEnd(11)} ${p.varies.padEnd(6)}  ` +
      `${r.dScalar.toExponential(2)}  ${(r.scalarBlind ? 'BLIND' : 'sees').padEnd(7)} ${r.dRibbon.toFixed(3).padStart(8)}  ` +
      `${(r.ribbonSeparates ? 'YES ' + (r.dRibbon / sigRibbon).toFixed(0) + 'x' : 'no').padEnd(11)} ` +
      `${r.predictedHigher.padEnd(10)}  ${r.measuredHigher.padEnd(9)}  ${r.agrees ? 'YES' : 'NO'}`);
  }
}

const ind = PAIRS.filter((p) => p.independent).map(assess);
const blindInd = ind.filter((r) => r.scalarBlind);
const usable = blindInd.filter((r) => r.ribbonSeparates);
const agree = usable.filter((r) => r.agrees).length;

console.log('\n' + '='.repeat(100));
console.log(`  INDEPENDENT pairs: ${ind.length}   scalar-blind: ${blindInd.length}   also ribbon-separated: ${usable.length}   direction agrees: ${agree}/${usable.length}`);
if (!blindInd.length) {
  console.log('  NO independent controlled pair is scalar-blind — per 57.8 this corpus cannot confirm 56.9.');
  console.log('  OUTSTANDING REQUIREMENT: an external nose-shape / forebody series at matched Re and fineness,');
  console.log('  ideally never used anywhere in this project\'s development.');
} else if (agree === usable.length) {
  console.log('  Direction AGREES on every usable independent pair — WEAK POSITIVE EVIDENCE ONLY (57.7: 25% by coincidence).');
} else {
  console.log('  Direction DISAGREES somewhere — evidence AGAINST the pre-registered ribbon interpretation. Recorded as such.');
}
console.log('='.repeat(100) + '\n');
