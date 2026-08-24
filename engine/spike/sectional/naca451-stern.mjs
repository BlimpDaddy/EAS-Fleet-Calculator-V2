/**
 * NACA REPORT 451, MODEL A — ORIGINAL vs ALTERED STERN. Spec 66 / 65.7.
 *
 * SUPPORTING DIRECTIONAL CORROBORATION ONLY. Outcome-exposed (66.2), single
 * pair, not blind, not validation. Descriptors (59.3), directions (59.4) and
 * the question (65.7) were all frozen before this dataset was identified.
 *
 * Compared ONLY against the report's own stated result (p8):
 *   "At the highest values of the Reynolds Number the drag is about 5 per cent
 *    higher with the altered stern than with the original one."
 * Figure 5 is NOT digitised.
 *
 * TABLE I ordinates, recovered with layout-preserving extraction. The two
 * sterns share stations 0.000-30.000 exactly; they differ only aft of that.
 *
 * *** METHODOLOGICAL HAZARD, DECLARED BEFORE THE RESULT ***
 * The two sterns are tabulated at DIFFERENT RESOLUTIONS aft of station 30:
 * the original has 5 stations, the altered has 12. The frozen descriptors
 * measure TURNING, a derivative, so interpolation choice could by itself
 * manufacture a difference in F2a. The run therefore reports BOTH a monotone
 * cubic (Fritsch-Carlson) and a linear interpolant. IF THE PREDICTED
 * DIRECTION DEPENDS ON THAT CHOICE, THE TEST IS VOID and is reported void.
 */
import { ZONES, ribbonMetrics } from './ribbons.mjs';
import { hullMesh, verifyOnSurface, PATTERNS } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, STATIONS, TIP } from './support-skin.mjs';
import { measureSections, scoreSections } from '../../../site/calcv2/src/sections.js';
import { classifySections } from '../../../site/calcv2/src/cdEstimator.js';

const DEG = 180 / Math.PI, SEED = 12345, CANON = 24;
const RUNG = { sx: 0.005, thDeg: 2 };
const EARNED = [1, 2, 3, 4, 5];
const rays = Array.from({ length: 2 * CANON }, (_, k) => (Math.PI * (k % CANON)) / CANON + (k >= CANON ? Math.PI : 0));

export const SHARED = [[0.000, 0.000], [0.250, 0.414], [0.500, 0.726], [1.000, 1.167], [2.000, 1.752],
  [4.000, 2.384], [6.000, 2.744], [8.000, 2.963], [10.000, 3.083], [14.000, 3.187],
  [18.000, 3.179], [22.000, 3.071], [26.000, 2.826], [30.000, 2.304]];
export const ORIGINAL = [...SHARED, [34.000, 1.476], [36.600, 0.658], [37.100, 0.421], [37.350, 0.204], [37.390, 0.000]];
export const ALTERED = [...SHARED, [32.500, 1.830], [33.000, 1.717], [33.500, 1.590], [34.000, 1.473],
  [34.500, 1.344], [34.750, 1.267], [35.000, 1.173], [35.250, 1.055], [35.500, 0.905],
  [35.750, 0.651], [36.000, 0.314], [36.100, 0.000]];

/** Fritsch-Carlson monotone cubic — shape-preserving, no overshoot. */
function monotone(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0] || x >= xs[n - 1]) return 0;
    let i = 0; while (i < n - 2 && xs[i + 1] < x) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
         + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
function linear(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), n = pts.length;
  return (x) => {
    if (x <= xs[0] || x >= xs[n - 1]) return 0;
    let i = 0; while (i < n - 2 && xs[i + 1] < x) i++;
    return ys[i] + ((ys[i + 1] - ys[i]) * (x - xs[i])) / (xs[i + 1] - xs[i]);
  };
}

function measure(pts, interp) {
  const L = pts[pts.length - 1][0], half = L / 2, f = interp(pts);
  const oracle = (X) => f(X + half);
  const cloud = PATTERNS.fibonacci((X) => oracle(X), half, 12000, SEED);
  if (!verifyOnSurface((X) => oracle(X), cloud).pass) throw new Error('INPUT FAILURE');
  const mesh = hullMesh(cloud);
  const m = measureSections(mesh.verts, mesh.faces, { axis: '+X' });
  const sc = scoreSections(m);
  const { cls } = classifySections(m, sc);
  const skin = makeSupportSkin(mesh.verts, mesh.faces, RUNG);
  const R = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
  for (let i = 0; i < STATIONS; i++) {
    const got = supportRadii(skin, i, rays);
    for (let k = 0; k < rays.length; k++) R[k][i] = got.r[k];
  }
  const met = R.map((rib) => ribbonMetrics(rib, L, { tipFrac: TIP }));
  const z = EARNED.map((zi) => {
    const v = met.map((q) => q.zones[zi].abs * DEG).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
  const tot = z.reduce((s, v) => s + v, 0);
  return { L, proxy: sc.compositeV1, softFore: sc.softFore, softAft: sc.softAft, cls,
    F1: (z[0] + z[1]) / tot, F2a: z[3] + z[4], F2f: (z[3] + z[4]) / tot,
    F3: Math.max(...z) / (tot / 5), z };
}

console.log('\nNACA REPORT 451 — MODEL A, ORIGINAL vs ALTERED STERN (spec 66)');
console.log('  SUPPORTING DIRECTIONAL CORROBORATION ONLY: outcome-exposed, single pair, NOT blind, NOT validation.');
console.log('  Measured (report p8, its own words): altered/blunter stern ~5% HIGHER drag at the highest Re.');
console.log('  Frozen 59.4 prediction: heavier late turning (higher F2a) = worse. Nothing here is fitted.\n');
console.log('  interp     stern      length   compositeV1  softFore  class    |   F1      F2a     F2f     F3');
const out = {};
for (const [iname, interp] of [['monotone', monotone], ['linear', linear]]) {
  out[iname] = {};
  for (const [sname, pts] of [['original', ORIGINAL], ['altered ', ALTERED]]) {
    const q = measure(pts, interp);
    out[iname][sname.trim()] = q;
    console.log(`  ${iname.padEnd(9)}  ${sname}   ${q.L.toFixed(3)}   ${q.proxy.toFixed(6)}   ${q.softFore.toExponential(1)}  ${q.cls.padEnd(8)} | ` +
      `${q.F1.toFixed(4)}  ${q.F2a.toFixed(3)}  ${q.F2f.toFixed(4)}  ${q.F3.toFixed(4)}`);
  }
}

console.log('\n  DIRECTION (measured: ALTERED is worse):');
for (const iname of ['monotone', 'linear']) {
  const o = out[iname].original, a = out[iname].altered;
  const ribbonSays = a.F2a > o.F2a ? 'altered' : 'original';
  const scalarSays = a.proxy > o.proxy ? 'altered' : 'original';
  console.log(`    ${iname.padEnd(9)} ribbons(F2a ${o.F2a.toFixed(3)} vs ${a.F2a.toFixed(3)}) -> ${ribbonSays.padEnd(9)}` +
    `${ribbonSays === 'altered' ? 'CORRECT' : 'WRONG  '}   ` +
    `scalar(${o.proxy.toFixed(5)} vs ${a.proxy.toFixed(5)}) -> ${scalarSays.padEnd(9)}${scalarSays === 'altered' ? 'CORRECT' : 'WRONG'}`);
}

const rMono = out.monotone.altered.F2a > out.monotone.original.F2a;
const rLin = out.linear.altered.F2a > out.linear.original.F2a;
const sMono = out.monotone.altered.proxy > out.monotone.original.proxy;
const sLin = out.linear.altered.proxy > out.linear.original.proxy;
console.log('\n  INTERPOLATION SENSITIVITY (declared hazard):');
console.log(`    ribbon direction stable across interpolants: ${rMono === rLin ? 'YES' : 'NO — TEST VOID'}`);
console.log(`    scalar direction stable across interpolants: ${sMono === sLin ? 'YES' : 'NO — TEST VOID'}`);
console.log('');
