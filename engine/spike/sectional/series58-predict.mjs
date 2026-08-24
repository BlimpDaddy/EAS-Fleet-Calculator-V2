/**
 * SERIES 58 — PREDICTIONS FROM GEOMETRY ALONE. Spec 61.4 / 62.5.
 *
 * Records, BEFORE Table 2 (net residual resistance) is opened:
 *   1. production scalar + class          (measureSections/scoreSections/classifySections)
 *   2. the frozen F1-F5 descriptors        (spec 59.3, earned zones 1-5 only)
 *   3. which groups/pairs the scalar can distinguish beyond its own noise
 *   4. the predicted directional ordering  (spec 59.4, frozen from physics)
 *   5. an exposure flag per model          (spec 62.1)
 *
 * NOTHING here reads a resistance value. No fitting, no weights, no combined
 * score. Geometry is solved in closed form from the five Series 58 parameters
 * (six conditions, six unknowns) and was verified against the report's own
 * printed constants to ~1e-6 on five models.
 */
import { ZONES, ribbonMetrics } from './ribbons.mjs';
import { hullMesh, verifyOnSurface, PATTERNS } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, STATIONS, TIP } from './support-skin.mjs';
import { measureSections, scoreSections } from '../../../site/calcv2/src/sections.js';
import { classifySections } from '../../../site/calcv2/src/cdEstimator.js';
import { SOLVED, GROUPS, EXPOSED } from './series58-data.mjs';

const DEG = 180 / Math.PI, SEED = 12345, CANON = 24;
const RUNG = { sx: 0.005, thDeg: 2 };
const EARNED = [1, 2, 3, 4, 5];
const rays = Array.from({ length: 2 * CANON }, (_, k) => (Math.PI * (k % CANON)) / CANON + (k >= CANON ? Math.PI : 0));
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));

/** r(X) for one model. y^2 = sum a_n x^n, y = r/D, x = X/L. D = 1, L = LD. */
function bodyOf(mid) {
  const { a, LD } = SOLVED[mid];
  const L = LD, half = L / 2;
  return {
    a: half,
    r: (X) => {
      const x = (X + half) / L;
      if (x <= 0 || x >= 1) return 0;
      let y2 = 0;
      for (let n = 0; n < 6; n++) y2 += a[n] * Math.pow(x, n + 1);
      return y2 > 0 ? Math.sqrt(y2) : 0;
    },
  };
}

function measure(mid, pattern, n) {
  const b = bodyOf(mid);
  const oracle = (X) => b.r(X);
  const pts = PATTERNS[pattern]((X) => oracle(X), b.a, n, SEED);
  if (!verifyOnSurface((X) => oracle(X), pts).pass) throw new Error(`INPUT FAILURE ${mid}`);
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
  const met = R.map((rib) => ribbonMetrics(rib, 2 * b.a, { tipFrac: TIP }));
  const perRibbon = met.map((q) => {
    const z = EARNED.map((zi) => q.zones[zi].abs * DEG);
    const tot = z.reduce((s, v) => s + v, 0);
    const mean = tot / z.length;
    // zone centres in normalised earned-domain position, for F4
    const uc = EARNED.map((zi) => (zi + 0.5) / ZONES);
    return {
      z,
      F1: tot > 0 ? (z[0] + z[1]) / tot : 0,
      F2a: z[3] + z[4],
      F2f: tot > 0 ? (z[3] + z[4]) / tot : 0,
      F3: mean > 0 ? Math.max(...z) / mean : 0,
      F4: tot > 0 ? z.reduce((s, v, k) => s + v * uc[k], 0) / tot : 0,
    };
  });
  // spec 10: median / worst / spread, never the mean alone. Axisymmetric here,
  // so the distribution is degenerate by construction and that is reported.
  const med = (key) => { const v = perRibbon.map((p) => p[key]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const spread = (key) => { const v = perRibbon.map((p) => p[key]); return Math.max(...v) - Math.min(...v); };
  // F5: opposite-ribbon disagreement, frozen but NOT claimable on axisymmetric bodies
  let F5 = 0;
  for (let k = 0; k < CANON; k++) {
    F5 = Math.max(F5, ...EARNED.map((_, zi) => Math.abs(perRibbon[k].z[zi] - perRibbon[k + CANON].z[zi])));
  }
  return {
    proxy: sc.compositeV1, softAft: sc.softAft, softFore: sc.softFore, cls,
    F1: med('F1'), F2a: med('F2a'), F2f: med('F2f'), F3: med('F3'), F4: med('F4'), F5,
    spreadF1: spread('F1'), zones: perRibbon[0].z,
  };
}

/* ---- noise, measured exactly as 56.6, on THESE bodies ---- */
const NOISE_PATTERNS = ['fibonacci', 'lathe', 'random'];
const IDS = Object.keys(SOLVED).map(Number).sort();
let sigScalar = 0, sigF1 = 0, sigF2a = 0, sigF3 = 0, sigF4 = 0;
for (const mid of IDS) {
  const reps = NOISE_PATTERNS.map((p) => measure(mid, p, 12000));
  const sp = (k) => Math.max(...reps.map((r) => r[k])) - Math.min(...reps.map((r) => r[k]));
  sigScalar = Math.max(sigScalar, sp('proxy'));
  sigF1 = Math.max(sigF1, sp('F1')); sigF2a = Math.max(sigF2a, sp('F2a'));
  sigF3 = Math.max(sigF3, sp('F3')); sigF4 = Math.max(sigF4, sp('F4'));
}

console.log('\nSERIES 58 — PREDICTIONS FROM GEOMETRY ALONE (spec 61.4). NO RESISTANCE VALUE READ.');
console.log(`  noise, measured as 56.6: sigma_scalar=${sigScalar.toExponential(3)}  sigma_F1=${sigF1.toFixed(5)}  ` +
  `sigma_F2a=${sigF2a.toFixed(4)}deg  sigma_F3=${sigF3.toFixed(5)}  sigma_F4=${sigF4.toFixed(5)}\n`);

const M = Object.fromEntries(IDS.map((mid) => [mid, measure(mid, 'fibonacci', 12000)]));

console.log('  model  exp  m    r0    r1    Cp   L/D | compositeV1  softFore  class    |    F1      F2a     F2f     F3      F4     F5');
for (const mid of IDS) {
  const s = SOLVED[mid], q = M[mid];
  console.log(`  ${mid} ${EXPOSED.includes(mid) ? ' * ' : '   '} ${s.m.toFixed(2)}  ${s.r0.toFixed(2)}  ${s.r1.toFixed(2)}  ${s.Cp.toFixed(2)} ${String(s.LD).padStart(4)} | ` +
    `${q.proxy.toFixed(6)}  ${q.softFore.toExponential(1)}  ${q.cls.padEnd(8)} | ` +
    `${q.F1.toFixed(4)}  ${q.F2a.toFixed(3)}  ${q.F2f.toFixed(4)}  ${q.F3.toFixed(4)}  ${q.F4.toFixed(4)}  ${q.F5.toExponential(1)}`);
}
console.log('  ( * = resistance value already seen, spec 62.1 )');

/* ---- per group: is the scalar blind? do the descriptors resolve? ---- */
console.log('\n  GROUP ANALYSIS — scalar blindness and ribbon resolution, both noise-referenced:');
const primary = { 'G-NOSE': 'F1', 'G-TAIL': 'F2a', 'G-M': 'F4', 'G-CP': 'F2a', 'G-LD': 'F1', 'G-CP5': 'F2a' };
const sig = { F1: sigF1, F2a: sigF2a, F3: sigF3, F4: sigF4 };
const predictions = {};
for (const [g, ids] of Object.entries(GROUPS)) {
  const key = primary[g];
  const px = ids.map((i) => M[i].proxy);
  const spanScalar = Math.max(...px) - Math.min(...px);
  const dv = ids.map((i) => M[i][key]);
  const spanDesc = Math.max(...dv) - Math.min(...dv);
  const blind = spanScalar <= sigScalar;
  // 59.4 directions: F1 LOW -> worse ; F2a HIGH -> worse ; F4 aft -> worse
  const worseIsHigh = (key !== 'F1');
  const order = [...ids].sort((p, q) => (worseIsHigh ? M[q][key] - M[p][key] : M[p][key] - M[q][key]));
  predictions[g] = { key, blind, spanScalar, spanDesc, order };
  console.log(`\n    ${g}  (varies ${g === 'G-NOSE' ? 'r0' : g === 'G-TAIL' ? 'r1' : g === 'G-M' ? 'm' : g === 'G-LD' ? 'L/D' : 'Cp'})  primary descriptor ${key}`);
  console.log(`      scalar span ${spanScalar.toExponential(2)} vs noise ${sigScalar.toExponential(2)}  -> scalar ${blind ? 'BLIND' : 'RESOLVES'} (${(spanScalar / sigScalar).toFixed(1)}x)`);
  console.log(`      ${key} span ${spanDesc.toFixed(4)} vs noise ${sig[key].toFixed(5)}  -> ribbons ${spanDesc > sig[key] ? 'RESOLVE' : 'blind'} (${(spanDesc / sig[key]).toFixed(1)}x)`);
  console.log(`      PREDICTED ordering, most drag -> least (59.4): ${order.join(' > ')}`);
  console.log(`      per model ${key}: ` + ids.map((i) => `${i}:${M[i][key].toFixed(3)}`).join('  '));
}

/* ---- the registered structural prediction, 62.6 ---- */
console.log('\n  62.6 STRUCTURAL PREDICTION CHECK (registered before Table 2):');
for (const g of ['G-NOSE', 'G-LD', 'G-CP', 'G-TAIL']) {
  const want = g === 'G-NOSE' ? 'BLIND' : 'RESOLVES';
  const got = predictions[g].blind ? 'BLIND' : 'RESOLVES';
  console.log(`    ${g.padEnd(8)} predicted ${want.padEnd(8)} -> measured ${got.padEnd(8)} ${want === got ? 'AS PREDICTED' : '*** CONTRARY ***'}`);
}
console.log('\n  Unseen-value subset (62.1 / secondary): ' +
  Object.entries(GROUPS).map(([g, ids]) => `${g}:[${ids.filter((i) => !EXPOSED.includes(i)).join(',')}]`).join('  '));
console.log('\n  NO RESISTANCE VALUE HAS BEEN READ BY THIS SCRIPT.\n');
