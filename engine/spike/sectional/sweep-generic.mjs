/**
 * STEP 2 — CONTROLLED GENERIC GEOMETRY SWEEPS. Spec 82.
 *
 * DIAGNOSTIC, NOT EXPLORATORY. Six ONE-PARAMETER families, each varying a
 * single geometric quantity, to find:
 *   continuity | monotonicity where physically expected | classifier cliffs |
 *   scalar-vs-ribbon disagreement | eligibility failures | path sensitivity |
 *   physically nonsensical trends
 *
 * NOTHING IS REPAIRED OR RETUNED DURING THE SWEEP. Defects and anomalies are
 * recorded only. Production Cd and all calibration stay frozen.
 *
 * Five families are Series 58 forms solved in closed form from their own
 * parameters (spec 62.2), so the geometry is exact. The BASE family truncates
 * the parent; the CAMBER family offsets each section vertically, which is the
 * only one that can move F5 (an elliptical squash is symmetric under a
 * 180-degree rotation and would leave F5 at zero).
 */
import { PATTERNS, hullMesh } from './hull-bodies.mjs';
import { volumeCentroid } from './ribbons.mjs';


const SEED = 12345;

/** Series 58 polynomial solved from (m, r0, r1, Cp) — six conditions, six unknowns. */
export function s58Poly(m, r0, r1, Cp) {
  const A = [[1, 1, 1, 1, 1, 1], [1, 0, 0, 0, 0, 0], [1, 2, 3, 4, 5, 6],
    [1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7],
    [m, m ** 2, m ** 3, m ** 4, m ** 5, m ** 6],
    [1, 2 * m, 3 * m ** 2, 4 * m ** 3, 5 * m ** 4, 6 * m ** 5]];
  const b = [0, 2 * r0, -2 * r1, Cp / 4, 0.25, 0];
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 6; c++) {
    let p = c; for (let k = c; k < 6; k++) if (Math.abs(M[k][c]) > Math.abs(M[p][c])) p = k;
    [M[c], M[p]] = [M[p], M[c]];
    for (let k = 0; k < 6; k++) {
      if (k === c) continue;
      const f = M[k][c] / M[c][c];
      for (let j = c; j <= 6; j++) M[k][j] -= f * M[c][j];
    }
  }
  return Array.from({ length: 6 }, (_, i) => M[i][6] / M[i][i]);
}

/** r(x) for a Series 58 form of given L/D, with x measured from the body centre. */
export function s58Radius(a, LD) {
  const L = LD, half = L / 2;
  return { half, r: (X) => {
    const x = (X + half) / L;
    if (x <= 0 || x >= 1) return 0;
    let y2 = 0; for (let n = 0; n < 6; n++) y2 += a[n] * Math.pow(x, n + 1);
    return y2 > 0 ? Math.sqrt(y2) : 0;
  } };
}

/** build a surface from r(x[,theta]) and centre it on its volume centroid (spec 4.1) */
export function build(rFn, half, identity, n = 12000) {
  const pts = PATTERNS.fibonacci((X, th) => rFn(X, th), half, n, SEED);
  const h = hullMesh(pts);
  const c = volumeCentroid(h.verts, h.faces).c;
  return { verts: h.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]),
    faces: h.faces, identity };
}

const GOLD = Math.PI * (3 - Math.sqrt(5));

/**
 * A TRUNCATED body with a GENUINE FLAT BASE — spec 83.A, the 82.5 repair.
 *
 * 82.5: the old family zeroed `r` past the cut but KEPT SAMPLING, so every
 * station beyond it contributed a point ON THE AXIS and the convex hull spanned
 * those into a CONE. Measured aftmost radius was 0.0000. That family therefore
 * tested conical aft closures of varying steepness and never showed the
 * classifier a base at all.
 *
 * The repair is what 82.5 prescribed and nothing more: STOP SAMPLING PAST THE
 * CUT, and close the body with a base ring at the cut station.
 *
 * The retained samples are BIT-IDENTICAL to the old family's — same golden-angle
 * sequence, same x positions, same r — so the only change to the input cloud is
 * the axis points removed and the base ring added. At `cut` = 1.00 the base
 * radius is zero, no ring is added, and the body is the untruncated parent
 * exactly as before (pass condition B1).
 *
 * RIM RESOLUTION IS FORCED BY A HULL DEFECT, NOT CHOSEN FOR ACCURACY, and the
 * whole sequence is recorded because the parameter was changed AFTER seeing a
 * result:
 *
 *   1. 128 was picked first on an area criterion — an inscribed regular N-gon
 *      has (N/2pi)*sin(2pi/N) of the disc area, so 128 gives 1.3e-4.
 *   2. At 128 the vendored production QuickHull returned an OPEN SURFACE at
 *      cut 0.95, 0.90 and 0.70 (136, 132 and 59 boundary edges), dropping 11,
 *      9 and 3 of the exactly-coplanar rim points. Those three rows failed E3
 *      and were ribbon-INELIGIBLE.
 *   3. A resolution scan showed the failure is monotone in rim density, and
 *      that 32 is the only value tested that closes at every cut:
 *
 *        naz   1.00  0.975  0.95  0.90  0.85  0.80  0.70
 *         32    ok    ok     ok    ok    ok    ok    ok
 *         48    ok    ok    OPEN   ok    ok    ok    ok
 *         64    ok    ok    OPEN   ok    ok    ok    ok
 *         96    ok    ok    OPEN  OPEN   ok    ok    ok
 *        128    ok    ok    OPEN  OPEN   ok    ok   OPEN
 *        160    ok    ok    OPEN  OPEN   ok    ok   OPEN
 *
 *      At 256 the hull did not complete cut 0.95 in 900 s — nor did 257 in
 *      100 s — while 224 and 255 complete in ~0.3 s and 256 itself completes at
 *      cut 0.90 and 0.80. Whether that is non-termination or merely a blow-up
 *      is not established and is not claimed; the measurement is the 900 s.
 *      A dense helical body sample meeting an exactly planar rim makes sliver
 *      faces whose plane distances sit near the hull's ~3e-15 tolerance.
 *
 * THE COST OF 32 IS QUANTIFIED, NOT WAVED THROUGH: the base is a 32-gon, so its
 * area is 99.358% of the disc (measured 0.99359) and its radius ripples 0.48%
 * between vertex and edge midpoint. Against CLASSIFIER_TAU the nearest margin
 * is 65%, so the flip point moves by ~1e-3 in cut fraction — and the flip was
 * ALREADY MEASURED AT cut 0.95 WITH NAZ 128 before this parameter was touched,
 * so the change did not manufacture the result it is checked against.
 *
 * The hull behaviour is a robustness limit of a PRODUCTION component on a
 * degenerate input. It is recorded in 83.A and flagged, not repaired.
 */
const NAZ_BASE = 32;
export function buildTruncated(f, v, n = 12000) {
  const xCut = f.half * (2 * v - 1);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const X = ((2 * i) / (n - 1) - 1) * f.half;
    if (X > xCut) continue;                       // 82.5: nothing past the cut
    const r = f.r(X), th = i * GOLD;
    pts.push([X, r * Math.cos(th), r * Math.sin(th)]);
  }
  const rBase = f.r(xCut);
  if (rBase > 0) {
    for (let j = 0; j < NAZ_BASE; j++) {
      const th = (2 * Math.PI * j) / NAZ_BASE;
      pts.push([xCut, rBase * Math.cos(th), rBase * Math.sin(th)]);
    }
  }
  const h = hullMesh(pts);
  const c = volumeCentroid(h.verts, h.faces).c;
  return {
    verts: h.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]),
    faces: h.faces,
    identity: rBase > 0 ? 'analytic-truncated-with-base -> hull' : 'analytic-truncated -> hull',
    baseRadius: rBase, xCut, sampled: pts.length,
  };
}

export const PARENT = { m: 0.40, r0: 0.50, r1: 0.10, Cp: 0.65, LD: 7 };
/** the analytic profile only — {half, r}; NOT a surface */
export const form = (o) => {
  const p = { ...PARENT, ...o };
  const a = s58Poly(p.m, p.r0, p.r1, p.Cp);
  return s58Radius(a, p.LD);
};
/** the built, hulled, volume-centred SURFACE for a Series 58 form */
const surf = (o) => { const f = form(o); return build((X) => f.r(X), f.half, 'analytic -> hull'); };

export const SWEEPS = [
  { name: 'NOSE bluntness (r0)', param: 'r0', expect: 'smooth; F1 falls as r0 rises',
    steps: [0, 0.15, 0.30, 0.50, 0.70, 0.85, 1.00].map((v) => ({ v, s: surf({ r0: v }) })) },
  { name: 'AFT taper (r1)', param: 'r1', expect: 'smooth; F2a falls as r1 rises',
    steps: [0, 0.05, 0.10, 0.15, 0.20, 0.25].map((v) => ({ v, s: surf({ r1: v }) })) },
  { name: 'FINENESS (L/D)', param: 'L/D', expect: 'Cd falls monotonically with slenderness',
    steps: [3, 4, 5, 6, 7, 8, 10, 12].map((v) => ({ v, s: surf({ LD: v }) })) },
  { name: 'SHOULDER position (m)', param: 'm', expect: 'F4 rises monotonically with m',
    steps: [0.30, 0.34, 0.38, 0.42, 0.46, 0.50, 0.56].map((v) => ({ v, s: surf({ m: v }) })) },
  /* 83.A: was a cone family, not a base family. Repaired per 82.5. */
  { name: 'TERMINAL BASE (truncation)', param: 'cut', expect: 'class flips to pinned once the base exceeds TAU, predicted between cut 0.975 and 0.95',
    steps: [1.00, 0.975, 0.95, 0.90, 0.85, 0.80, 0.70].map((v) => ({ v, s: buildTruncated(form({}), v) })) },
  { name: 'CAMBER (vertical section offset)', param: 'k', expect: 'F5 rises from ~0 with camber',
    steps: [0, 0.02, 0.05, 0.10, 0.15, 0.20].map((v) => {
      const f = form({});
      // section centre offset vertically by k*R*sin(pi x/L): top and bottom differ,
      // sections stay circular. r(x,theta) is the offset circle's radius along theta.
      return { v, s: build((X, th) => {
        const rr = f.r(X); if (rr <= 0) return 0;
        const off = v * 0.5 * Math.sin((Math.PI * (X + f.half)) / (2 * f.half));
        // radius from the AXIS to the offset circle along direction theta
        const c = off * Math.cos(th);
        return c + Math.sqrt(Math.max(0, rr * rr - off * off * Math.sin(th) ** 2));
      }, f.half, 'analytic-cambered -> hull') };
    }) },
];

/* the fibonacci sampler is called with (X, theta) for cambered/general bodies and
   (X) for bodies of revolution; hull-bodies.mjs passes theta as the 2nd argument. */
