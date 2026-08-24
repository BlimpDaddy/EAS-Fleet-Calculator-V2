/**
 * BASE-FAMILY GEOMETRY VERIFICATION — spec 83.A.
 *
 * 82.5 recorded that the family labelled "TERMINAL BASE" did not produce bases:
 * zeroing `r` past the cut still sampled the axis, so the convex hull spanned
 * those points into a cone and the aftmost radius measured 0.0000.
 *
 * This script measures the repaired geometry against predictions computed from
 * the analytic parent BEFORE the surfaces were built (83.A), and asks the
 * PRODUCTION classifier what it sees. It changes nothing: it reads geometry and
 * calls frozen production functions.
 *
 *   B2  measured r_base / rMax within 0.02 of the analytic prediction
 *   B3  production `classifySections` returns `pinned` for cut <= 0.95 and
 *       `rounded` at 1.00 and 0.975 — the predicted flip point
 *   B4  the base is FLAT: radius range over the aftmost 0.5% <= 0.02 * rMax
 *
 * B4 IS MIS-SPECIFIED AND IS LEFT IN PLACE FAILING. A band 0.5% of the body
 * long contains real TAPER as well as the base, so B4 measures the profile
 * slope near the cut, not the flatness of anything. It cannot pass at
 * cut = 1.00, which has no base at all, and it fails at 0.975 only because the
 * tail is steep there. It is NOT retuned to pass: a frozen criterion relaxed
 * once it becomes inconvenient was never a criterion (55.2).
 *
 *   B4-PRIME, POST-HOC and labelled so — the correct statement of the same
 *       intent. "The hull terminates in a flat disc" (82.5) says the rim
 *       vertices share ONE station and lie on ONE circle, and that is what is
 *       gated. The rim polygon area is REPORTED beside it, not gated: a deficit
 *       there is the dropped-vertex observation, not a flatness claim.
 *
 *       THE GEOMETRY NEVER MOVED; MY MEASUREMENT OF IT FAILED TWICE, AND BOTH
 *       failures are recorded rather than quietly corrected:
 *
 *       v1 took the radii ABOUT THE WRONG AXIS. The bodies are centred on their
 *       VOLUME CENTROID (4.1) and the Fibonacci sample azimuthal imbalance puts
 *       that centroid ~1.5e-5 off the axis of revolution, so a radius about the
 *       origin inherits the offset. Reported a 3.15e-5 spread as a defect.
 *
 *       v2 took the centre as the MEAN OF THE SURVIVING RIM POINTS. Where the
 *       hull drops a contiguous run of coplanar rim vertices the survivors are
 *       not symmetric, so their mean sits up to 1.4e-2 off the true centre and
 *       an exact circle reads as 11% out of round. Both are the same error as
 *       the handover list: a plausible statistic computed off a biased sample.
 *
 *       v3 FITS THE CIRCLE (Kasa algebraic fit) and assumes nothing about which
 *       points survived. B2 and B3 — the pre-registered conditions — passed on
 *       the FIRST run and on every run since; none of this touched them.
 */
import { buildTruncated, form } from './sweep-generic.mjs';
import { measureSections, scoreSections } from '../../../site/calcv2/src/sections.js';
import { classifySections, CLASSIFIER_TAU } from '../../../site/calcv2/src/cdEstimator.js';

/* 83.A predictions — analytic, frozen before the build */
const PREDICT = {
  1.00:  { rn: 0.0000, frac: 0.000000, cls: 'rounded' },
  0.975: { rn: 0.1786, frac: 0.031900, cls: 'rounded' },
  0.95:  { rn: 0.2876, frac: 0.082733, cls: 'pinned' },
  0.90:  { rn: 0.4660, frac: 0.217178, cls: 'pinned' },
  0.85:  { rn: 0.6054, frac: 0.366500, cls: 'pinned' },
  0.80:  { rn: 0.7133, frac: 0.508741, cls: 'pinned' },
  0.70:  { rn: 0.8575, frac: 0.735243, cls: 'pinned' },
};
const CUTS = [1.00, 0.975, 0.95, 0.90, 0.85, 0.80, 0.70];
const TOL_RN = 0.02, TOL_FLAT = 0.02, BAND = 0.005, TOL_CIRC = 1e-9;
const RIM_NOMINAL = 32;                          // NAZ_BASE in sweep-generic.mjs

/** Kasa algebraic circle fit in the transverse plane. No centre is assumed. */
function fitCircle(pts) {
  const n = pts.length;
  if (n < 3) return { cy: 0, cz: 0, r: 0 };
  let Sy = 0, Sz = 0, Syy = 0, Szz = 0, Syz = 0, Su = 0, Suy = 0, Suz = 0;
  for (const p of pts) {
    const y = p[1], z = p[2], u = y * y + z * z;
    Sy += y; Sz += z; Syy += y * y; Szz += z * z; Syz += y * z; Su += u; Suy += u * y; Suz += u * z;
  }
  /* normal equations for u = 2a*y + 2b*z + c */
  const M = [[2 * Syy, 2 * Syz, Sy, Suy], [2 * Syz, 2 * Szz, Sz, Suz], [2 * Sy, 2 * Sz, n, Su]];
  for (let c = 0; c < 3; c++) {
    let p = c; for (let k = c; k < 3; k++) if (Math.abs(M[k][c]) > Math.abs(M[p][c])) p = k;
    [M[c], M[p]] = [M[p], M[c]];
    for (let k = 0; k < 3; k++) {
      if (k === c) continue;
      const fq = M[k][c] / M[c][c];
      for (let j = c; j <= 3; j++) M[k][j] -= fq * M[c][j];
    }
  }
  const a = M[0][3] / M[0][0], b = M[1][3] / M[1][1], cc = M[2][3] / M[2][2];
  return { cy: a, cz: b, r: Math.sqrt(Math.max(0, cc + a * a + b * b)) };
}

console.log('\nBASE-FAMILY GEOMETRY VERIFICATION (spec 83.A) — the 82.5 repair');
console.log('  Predictions frozen before the build. CLASSIFIER_TAU = ' + CLASSIFIER_TAU + '.');
console.log('  Production classifier CONSUMED, not modified.\n');
console.log('  cut     verts  rim   r_base/rMax  predict     d      B4 flat  circ/L    area/disc  B4-prime  termBaseFrac  predict    class    predict');

const fails = [], fails4 = [], notes = [];
for (const v of CUTS) {
  const s = buildTruncated(form({}), v);
  let rMax = 0, xMax = -Infinity, xMin = Infinity;
  for (const p of s.verts) {
    const r = Math.hypot(p[1], p[2]);
    if (r > rMax) rMax = r;
    if (p[0] > xMax) xMax = p[0];
    if (p[0] < xMin) xMin = p[0];
  }
  const L = xMax - xMin;

  /* the rim: hull vertices at the aftmost station */
  const rim = s.verts.filter((p) => p[0] >= xMax - 1e-9 * L);
  /* FIT the circle — the centre is not assumed and not averaged (see header) */
  const fit = fitCircle(rim);
  const cy = fit.cy, cz = fit.cz, rBase = fit.r;
  const rr = rim.map((p) => Math.hypot(p[1] - cy, p[2] - cz));
  const circ = rr.length ? Math.max(...rr.map((r) => Math.abs(r - rBase))) / L : 0;
  /* shoelace area of the rim polygon, ordered by angle */
  const ord = rim.map((p) => ({ y: p[1] - cy, z: p[2] - cz, th: Math.atan2(p[2] - cz, p[1] - cy) }))
    .sort((a, b) => a.th - b.th);
  let poly = 0;
  for (let i = 0; i < ord.length; i++) {
    const A = ord[i], B = ord[(i + 1) % ord.length];
    poly += A.y * B.z - B.y * A.z;
  }
  poly = Math.abs(poly) / 2;
  const areaRatio = rBase > 0 ? poly / (Math.PI * rBase * rBase) : 0;

  let lo = Infinity, hi = 0;
  for (const p of s.verts) {
    if (p[0] >= xMax - BAND * L) { const r = Math.hypot(p[1], p[2]); lo = Math.min(lo, r); hi = Math.max(hi, r); }
  }
  const flat = (hi - lo) / rMax;
  const rn = rBase / rMax;

  const m = measureSections(s.verts, s.faces, { axis: '+X' });
  const { cls, triggers } = classifySections(m, scoreSections(m));

  const P = PREDICT[v];
  const dRn = Math.abs(rn - P.rn);
  const hasBase = P.rn > 0;
  const okRn = dRn <= TOL_RN, okCls = cls === P.cls, okFlat = flat <= TOL_FLAT;
  /* B4-prime: ONE station, and the rim points lie on a fitted circle. The
     polygon area is REPORTED, not gated — a deficit there is the dropped-vertex
     observation below, not a statement about flatness. */
  const okDisc = !hasBase || circ <= TOL_CIRC;

  if (!okRn) fails.push('B2 cut=' + v + ': r_base/rMax ' + rn.toFixed(4) + ' vs predicted ' + P.rn.toFixed(4));
  if (!okCls) fails.push('B3 cut=' + v + ': class ' + cls + ' vs predicted ' + P.cls +
    ' (terminalBaseFrac ' + triggers.terminalBaseFrac.toFixed(6) + ')');
  if (!okDisc) fails.push('B4-prime cut=' + v + ': rim is not circular — worst residual ' +
    circ.toExponential(2) + ' of L');
  if (!okFlat) fails4.push('B4 cut=' + v + ' (AS FROZEN, mis-specified): aft 0.5% radius range ' +
    flat.toFixed(4) + ' of rMax > ' + TOL_FLAT);
  if (hasBase && rim.length < RIM_NOMINAL) notes.push('cut=' + v + ': the hull retained ' + rim.length +
    ' of ' + RIM_NOMINAL + ' exactly-coplanar rim points; the rim polygon is ' +
    (100 * areaRatio).toFixed(3) + '% of the fitted disc (a full 32-gon is 99.358%)');

  console.log('  ' + String(v).padEnd(6) + String(s.verts.length).padStart(6) + String(rim.length).padStart(5) +
    '   ' + rn.toFixed(4) + (okRn ? ' ' : '!') + '      ' + P.rn.toFixed(4) + '   ' + dRn.toFixed(4) +
    '   ' + flat.toFixed(4) + (okFlat ? ' ' : '!') + ' ' + (hasBase ? circ.toExponential(1) : '   n/a  ') +
    '   ' + (hasBase ? areaRatio.toFixed(5) : '  n/a  ') + '    ' + (hasBase ? (okDisc ? 'disc    ' : 'NOTDISC ') : 'n/a     ') +
    '  ' + triggers.terminalBaseFrac.toFixed(6) + '     ' + P.frac.toFixed(6) +
    '   ' + cls.padEnd(8) + (okCls ? ' ' : '!') + P.cls);
}

console.log('');
console.log(fails.length === 0
  ? '  B2 (terminal radius), B3 (classifier flip point) and B4-prime (flat disc): PASS at every cut.'
  : '  ' + fails.length + ' FAILURE(S):');
for (const f of fails) console.log('    - ' + f);
if (fails4.length) {
  console.log('\n  B4 as frozen fails at ' + fails4.length + ' cut(s). LEFT FAILING, NOT RETUNED:');
  for (const f of fails4) console.log('    - ' + f);
  console.log('  B4 measures the profile taper inside the band, not base flatness;');
  console.log('  B4-prime is the corrected statement and is reported beside it.');
}
if (notes.length) {
  console.log('\n  RECORDED, not repaired — vendored QuickHull drops coplanar rim vertices:');
  for (const n of notes) console.log('    - ' + n);
}
console.log('');
if (fails.length) process.exitCode = 1;
