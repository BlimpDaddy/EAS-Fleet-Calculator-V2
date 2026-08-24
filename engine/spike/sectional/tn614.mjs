/**
 * FROZEN HISTORICAL ARTIFACT (r11 #9, 2026-08-16): this file preserves
 * the ORIGINAL BLIND EXAM — the pre-vNEXT four-anchor calibration meeting
 * the six TN-614 bodies with zero TN-614 information in the map. Its
 * near-perfect ordering result is the genuinely external evidence event.
 * DO NOT MODIFY; living calibration is calibration.mjs.
 *
 * NACA TN-614 VALIDATION (incremental corpus, body #1–#6).
 * Abbott 1937, "Fuselage-drag tests in the variable-density wind tunnel:
 * streamline bodies of revolution, fineness ratio of 5" — NTRS 19930081378.
 *
 * PROVENANCE OF EVERY NUMBER BELOW (transcribed 2026-08-16 from 300-dpi
 * renders of the original scan; the scan is skewed ~1 row across the
 * table width, so every cell was anchored either by adjacent station
 * labels, by the shared 221 column across crops, or by monotone-chain
 * logic; full method in session record):
 *  - Table II: computed ordinates, % of basic length (models 40 in).
 *  - Footnote a: the TESTED 121 = nose of 111 + tail of 221, joined at
 *    station B; the TESTED 211 = nose of 222 + tail of 111. Built so.
 *  - Table III: measured CD_A (CROSS-SECTIONAL = frontal basis — the
 *    report's own basis, no conversion) at effective Re 66,000,000
 *    (test Re 25M × 0.875 skin-friction correction, reference 6).
 *  - 332's A ambiguous glyph (1.39/1.89): 1.89 chosen — its nose
 *    constants (Table I: e=.00625, f=.175) are identical to 321
 *    (A=1.91) and 322 (A=1.88); immaterial to results (tip extension
 *    only). DOCUMENTED, not hidden.
 *
 * DISCIPLINE: in-calibration: FALSE for every body. The estimator and
 * its calibration are FROZEN (anchors only). These bodies are the exam.
 * Run from CalcV2: `node spike/sectional/tn614.mjs`
 */
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf } from '../../src/dynamicsCore.js';
import { makeSphere, makeCube, makePlate, makeTeardrop } from '../flow-chamber/shapes.mjs';
import { measureSections, scoreSections } from './sections.mjs';

/* ---------------- Table II transcription (station %, radius %) -------- */
const NOSE_111 = [[-0.18, 0], [1.25, 2.075], [2.50, 3.135], [5, 4.700], [10, 6.725], [20, 8.880], [30, 9.800], [38.83, 10.000]];
const TAIL_111 = [[38.83, 10.000], [50, 9.700], [60, 8.875], [70, 7.350], [80, 5.145], [85, 3.930], [90, 2.655], [95, 1.340], [97.5, 0.675], [100, 0]];
const NOSE_222 = [[-1.17, 0], [0, 2.735], [1.25, 3.900], [2.50, 4.755], [5, 6.035], [10, 7.700], [20, 9.370], [30, 9.900], [40.02, 10.000]];
const TAIL_221 = [[41.05, 10.000], [50, 9.930], [60, 9.540], [70, 8.485], [80, 6.450], [85, 5.035], [90, 3.460], [95, 1.800], [97.5, 0.920], [100, 0]];
const BODY_221 = [[-1.17, 0], [0, 2.725], [1.25, 3.890], [2.50, 4.745], [5, 6.025], [10, 7.695], [20, 9.365], [30, 9.885], [41.05, 10.000],
  ...TAIL_221.slice(1)];
const BODY_222 = [...NOSE_222, [50, 9.895], [60, 9.500], [70, 8.690], [80, 7.335], [85, 6.345], [90, 5.005], [95, 3.035], [97.5, 1.700], [100, 0]];
const BODY_332 = [[-1.89, 0], [0, 3.825], [1.25, 4.865], [2.50, 5.670], [5, 6.865], [10, 8.375], [20, 9.620], [30, 9.925], [42.00, 10.000],
  [50, 9.970], [60, 9.760], [70, 9.170], [80, 7.985], [85, 7.070], [90, 5.800], [95, 3.895], [97.5, 2.455], [100, 0]];
const BODY_111 = [...NOSE_111, ...TAIL_111.slice(1)];
// Tested composites (footnote a), tail shifted to join at the nose's B:
const shift = (pts, dx) => pts.map(([x, r]) => [x + dx, r]);
const BODY_121T = [...NOSE_111, ...shift(TAIL_221, 38.83 - 41.05).slice(1)]; // ends 97.78
const BODY_211T = [...NOSE_222, ...shift(TAIL_111, 40.02 - 38.83).slice(1)]; // ends 101.19

/* Measured CD_A, Table III (frontal basis, effective Re 66e6). */
const BODIES = [
  ['111', BODY_111, 0.0401],
  ['121 (as tested)', BODY_121T, 0.0405],
  ['211 (as tested)', BODY_211T, 0.0415],
  ['221', BODY_221, 0.0437],
  ['222', BODY_222, 0.0472],
  ['332', BODY_332, 0.0508],
];

/* ---------------- monotone cubic (Fritsch–Carlson) profile ------------ */
function pchip(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const h = [], d = [];
  for (let i = 0; i + 1 < n; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = [d[0]];
  for (let i = 1; i + 1 < n; i++) {
    if (d[i - 1] * d[i] <= 0) m.push(0);
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m.push((w1 + w2) / (w1 / d[i - 1] + w2 / d[i])); }
  }
  m.push(d[n - 2]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (xs[i + 1] < x) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return ys[i] * (2 * t3 - 3 * t2 + 1) + h[i] * m[i] * (t3 - 2 * t2 + t)
      + ys[i + 1] * (-2 * t3 + 3 * t2) + h[i] * m[i + 1] * (t3 - t2);
  };
}

/** Lathe a profile ([x%, r%] list) into a mesh, flow along +X. */
function latheProfile(pts, rings = 96, segs = 28) {
  const f = pchip(pts);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const verts = [], faces = [];
  const ringIdx = [];
  for (let i = 0; i <= rings; i++) {
    const x = x0 + ((x1 - x0) * i) / rings;
    const r = Math.max(f(x), 0);
    if (r < 1e-4) { ringIdx.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
    ringIdx.push(first);
  }
  const pole = (i) => verts[ringIdx[i]].length && verts[ringIdx[i] + 1] === undefined; // unused guard
  const isPole = (i) => (ringIdx[i] === verts.length - 1) || (verts[ringIdx[i]][1] === 0 && verts[ringIdx[i]][2] === 0 && (ringIdx[i] + 1 >= verts.length || verts[ringIdx[i] + 1][0] !== verts[ringIdx[i]][0]));
  // simpler: pole when the ring has a single vertex — detect via next ring start
  const ringSize = (i) => (i + 1 <= rings ? ((i + 1 === rings + 1 ? verts.length : ringIdx[i + 1] ?? verts.length) - ringIdx[i]) : verts.length - ringIdx[i]);
  for (let i = 0; i < rings; i++) {
    const a = ringIdx[i], b = ringIdx[i + 1];
    const aP = ringSize(i) === 1, bP = ringSize(i + 1) === 1;
    if (aP && bP) continue;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      if (aP) faces.push([a, b + s, b + s1]);
      else if (bP) faces.push([b, a + s1, a + s]);
      else faces.push([a + s, b + s, b + s1], [a + s, b + s1, a + s1]);
    }
  }
  return { verts, faces };
}

/* ---------------- frozen calibration (anchors ONLY, as in battery) ---- */
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(4) : String(x));
const V = 100 / 3.6, LEN = 100;
const frictionAt = (mesh, re) => {
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: LEN });
  return { cdf: ittcCf(re) * (g.wettedArea / g.frontalArea), ratio: g.wettedArea / g.frontalArea };
};
const proxy = (mesh) => scoreSections(measureSections(mesh.verts, mesh.faces, {})).compositeV1;

const anchors = [
  { mesh: makeTeardrop(3), total: 0.045 }, { mesh: makeSphere(), total: 0.47 },
  { mesh: makeCube(), total: 1.05 }, { mesh: makePlate(), total: 1.17 },
];
const REF_RE = (V * LEN) / 1.5e-5; // anchor calibration at the standard reference condition
for (const a of anchors) { a.p = proxy(a.mesh); a.pressure = a.total - frictionAt(a.mesh, REF_RE).cdf; }
const rawPairs = anchors.map((a) => [a.p, a.pressure]).sort((x, y) => x[0] - y[0]);
const pairs = [];
for (const [x, y] of rawPairs) {
  const last = pairs[pairs.length - 1];
  if (last && Math.abs(x - last.x0) < 1e-3) { last.xs.push(x); last.ys.push(y); }
  else pairs.push({ x0: x, xs: [x], ys: [y] });
}
const knots = pairs.map((p) => [p.xs.reduce((a, b) => a + b) / p.xs.length, p.ys.reduce((a, b) => a + b) / p.ys.length]);
const calibrate = (x) => {
  if (!Number.isFinite(x)) return NaN;
  if (x <= knots[0][0]) return Math.max(0, knots[0][1] * (x / knots[0][0] || 0));
  for (let i = 0; i + 1 < knots.length; i++) {
    if (x <= knots[i + 1][0]) {
      const t = (x - knots[i][0]) / (knots[i + 1][0] - knots[i][0]);
      return knots[i][1] + t * (knots[i + 1][1] - knots[i][1]);
    }
  }
  return knots[knots.length - 1][1];
};

/* ---------------- the exam ---------------- */
console.log('== TN-614 HELD-OUT VALIDATION — six 1937 wind-tunnel bodies, frozen estimator, zero retuning ==');
console.log('basis: CD_A (frontal) at effective Re 66,000,000, per the report\'s own Table III\n');
const RE_TEST = 66e6;
console.log('form               proxy   pressure  friction  PREDICT  MEASURED  error');
const errors = [];
let prevPred = -1, orderOK = true;
const preds = [];
for (const [name, pts, measured] of BODIES) {
  const mesh = latheProfile(pts);
  const p = proxy(mesh);
  const pr = calibrate(p);
  const { cdf, ratio } = frictionAt(mesh, RE_TEST);
  const pred = pr + cdf;
  const err = (pred - measured) / measured;
  errors.push(Math.abs(err));
  preds.push({ name, pred, measured });
  console.log(`${name.padEnd(18)} ${f3(p)}  ${f3(pr)}    ${f3(cdf)}    ${f3(pred)}   ${measured.toFixed(4)}   ${(err * 100).toFixed(1)}%`);
}
const sorted = [...errors].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const within20 = errors.filter((e) => e <= 0.20).length;
const measuredOrder = BODIES.map((b) => b[0]).join(' < ');
const predictedOrder = [...preds].sort((a, b) => a.pred - b.pred).map((p) => p.name).join(' < ');
console.log(`\nmeasured ordering:  ${measuredOrder}`);
console.log(`predicted ordering: ${predictedOrder}`);
console.log(`median |error| ${(median * 100).toFixed(1)}% · within ±20%: ${within20}/6 · worst ${(Math.max(...errors) * 100).toFixed(1)}%`);
console.log('\n(±20% gate for the earned band: median <10–15%, ~80% within ±20%, no family inversion.)');
