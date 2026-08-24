/**
 * LONGITUDINAL RIBBON EXTRACTOR — PHASE 1, GEOMETRY ONLY (2026-08-20)
 *
 * Conforms to RIBBONS-PHASE1-SPEC.md, committed 207a81e / 2b11c13 BEFORE
 * any corpus body was measured. Every definition here is frozen there.
 * This file contains NO Cd, NO calibration, NO classification, and makes
 * no production change.
 *
 * The owner's sketch-book representation: cut the body with half-planes
 * through the flight axis — clock positions seen from the nose — and
 * follow each surface profile nose to tail. What it preserves that the
 * equivalent-circle radius at src/sections.js:257 destroys is the SPATIAL
 * ORDERING of the turning: not merely how much the surface must bend, but
 * where along the body it bends, and in which direction.
 *
 * A streamlined ribbon turns OUT over the forebody, eases through the
 * shoulder, then turns back IN over a long afterbody. A sphere does the
 * first half and then must unwind all of it in half the runway. Net
 * turning per zone carries the out/in sign; absolute turning per zone
 * carries the severity.
 *
 * SUPERSEDED DRAFT: an earlier version of this file chose radius-based tip
 * exclusion and a 3-point smoothing window. Both were overridden by review
 * before any result existed — see spec 4.6 and 4.7. That is the review
 * working, and the old choices are left visible only in git history.
 */

/* ------------------------------------------------------------------ */
/* frozen constants (spec 4)                                           */
/* ------------------------------------------------------------------ */
export const STATIONS = 128;        // 4.5
export const SECANT_FRAC = 0.03;    // 4.6 — fraction of LENGTH, not stations
export const ZONES = 8;             // 4.8
export const TIP_CANDIDATES = [0.025, 0.05]; // 4.7 — smallest that passes

const AXIS_VEC = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };

/** Spec 4.1 — volume centroid via signed tetrahedra. NOT the vertex centroid. */
export function volumeCentroid(verts, faces) {
  let V = 0, cx = 0, cy = 0, cz = 0;
  for (const f of faces) {
    for (let k = 1; k + 1 < f.length; k++) {
      const a = verts[f[0]], b = verts[f[k]], c = verts[f[k + 1]];
      const v = dot(a, cross(b, c)) / 6;
      V += v;
      cx += v * (a[0] + b[0] + c[0]) / 4;
      cy += v * (a[1] + b[1] + c[1]) / 4;
      cz += v * (a[2] + b[2] + c[2]) / 4;
    }
  }
  if (Math.abs(V) < 1e-12) {            // open/degenerate mesh — declared fallback
    const n = verts.length;
    return { c: verts.reduce((s, v) => [s[0] + v[0] / n, s[1] + v[1] / n, s[2] + v[2] / n], [0, 0, 0]), volume: 0, fallback: true };
  }
  return { c: [cx / V, cy / V, cz / V], volume: V, fallback: false };
}

/**
 * Spec 4.2–4.5. Cut with `planes` half-plane pairs, resample linearly onto
 * STATIONS, return directional profiles plus the reporting the spec demands.
 */
export function extractRibbons(verts, faces, { axis = 'X', up = null, planes = 12, stations = STATIONS } = {}) {
  const fdir = AXIS_VEC[axis];
  if (!fdir) throw new Error(`extractRibbons: bad axis ${axis}`);

  // 4.2 body-fixed frame: e0 along declared up (projected), e1 completes it
  let upv = up ? AXIS_VEC[up] || up : null;
  let inferred = false;
  if (!upv) { upv = AXIS_VEC[['X', 'Y', 'Z'].find((k) => k !== axis)]; inferred = true; }
  let e0 = sub(upv, fdir.map((c) => c * dot(upv, fdir)));
  if (Math.hypot(...e0) < 1e-9) throw new Error('extractRibbons: up vector is parallel to flight axis');
  e0 = norm(e0);
  const e1 = norm(cross(fdir, e0));

  // 4.1 reference axis through the volume centroid
  const { c: C, volume, fallback } = volumeCentroid(verts, faces);

  const proj = verts.map((v) => {
    const d = sub(v, C);
    return { x: dot(d, fdir), a: dot(d, e0), b: dot(d, e1) };
  });
  const xsAll = proj.map((p) => p.x);
  const x0 = Math.min(...xsAll), x1 = Math.max(...xsAll), L = x1 - x0;
  if (!(L > 0)) throw new Error('extractRibbons: zero extent along flight axis');

  const nRib = planes * 2;
  const R = Array.from({ length: nRib }, () => new Float64Array(stations).fill(NaN));
  let multiHit = 0, stationHits = 0;
  // PHASE 1C: additive-only provenance. Nothing existing reads or is
  // affected by this; every prior return value is unchanged.
  const PV = Array.from({ length: nRib }, () => new Array(stations).fill(null));

  // R1 (approved 2026-08-20): collect every plane-crossing SEGMENT, then
  // evaluate each at EXACTLY x = x_i by linear interpolation and take the
  // outermost. Replaces round-both-endpoints-and-fill-between binning,
  // which smeared segment endpoints across stations and stair-stepped the
  // ribbon (multiHitFrac 0.85 on a convex sphere).
  //
  // DIRECTIONAL: "outermost" is the largest SIGNED radial distance along
  // this half-plane's own direction. Never |s| across both halves, which
  // would let a full longitudinal plane mix the +theta and -theta ribbons.
  for (let p = 0; p < planes; p++) {
    const th = (Math.PI * p) / planes;
    const nA = -Math.sin(th), nB = Math.cos(th);
    const dA = Math.cos(th), dB = Math.sin(th);
    const segs = [];
    for (const f of faces) {
      const P = f.map((i) => proj[i]);
      const d = P.map((q) => q.a * nA + q.b * nB);
      // PHASE 1C PROVENANCE (additive): properties of the facet this
      // infinitesimal plane cuts. The ribbon has ZERO width, so these are
      // properties of the MESH around the intersection, never of a strip.
      let axLo = Infinity, axHi = -Infinity, thLo = Infinity, thHi = -Infinity;
      for (const q of P) {
        if (q.x < axLo) axLo = q.x; if (q.x > axHi) axHi = q.x;
        const t = Math.atan2(q.b, q.a);
        if (t < thLo) thLo = t; if (t > thHi) thHi = t;
      }
      let thSpan = thHi - thLo; if (thSpan > Math.PI) thSpan = 2 * Math.PI - thSpan;
      let eMin = Infinity, eMax = 0;
      for (let e = 0; e < P.length; e++) {
        const q = P[e], w = P[(e + 1) % P.length];
        const len = Math.hypot(q.x - w.x, q.a - w.a, q.b - w.b);
        if (len < eMin) eMin = len; if (len > eMax) eMax = len;
      }
      const facet = { ax: axHi - axLo, th: thSpan, asp: eMin > 1e-15 ? eMax / eMin : Infinity };
      const hits = [];
      for (let e = 0; e < P.length; e++) {
        const i = e, j = (e + 1) % P.length;
        if ((d[i] < 0 && d[j] < 0) || (d[i] > 0 && d[j] > 0) || d[i] === d[j]) continue;
        const t = d[i] / (d[i] - d[j]);
        if (t < 0 || t > 1) continue;
        hits.push([
          P[i].x + t * (P[j].x - P[i].x),
          (P[i].a + t * (P[j].a - P[i].a)) * dA + (P[i].b + t * (P[j].b - P[i].b)) * dB,
        ]);
      }
      for (let h = 0; h + 1 < hits.length; h++) segs.push([hits[h], hits[h + 1], facet]);
    }
    for (let i = 0; i < stations; i++) {
      const xi = x0 + (i / (stations - 1)) * L;
      let bestPos = NaN, bestNeg = NaN, nPos = 0, nNeg = 0;
      let axP = 0, thP = 0, aspP = 0, axN = 0, thN = 0, aspN = 0;
      for (const [[xa, sa], [xb, sb], fc] of segs) {
        const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
        if (xi < lo || xi > hi) continue;
        const s = Math.abs(xb - xa) < 1e-12 ? Math.max(sa, sb) : sa + ((xi - xa) / (xb - xa)) * (sb - sa);
        if (s >= 0) { nPos++; axP += fc.ax; thP += fc.th; aspP += fc.asp;
          if (Number.isNaN(bestPos) || s > bestPos) bestPos = s; }
        else { nNeg++; axN += fc.ax; thN += fc.th; aspN += fc.asp;
          if (Number.isNaN(bestNeg) || -s > bestNeg) bestNeg = -s; }
      }
      if (nPos) { R[p][i] = bestPos; stationHits++; if (nPos > 1) multiHit++;
        PV[p][i] = { support: nPos, axialSpan: axP / nPos, azimuthalCoarseness: thP / nPos, aspect: aspP / nPos }; }
      if (nNeg) { R[p + planes][i] = bestNeg; stationHits++; if (nNeg > 1) multiHit++;
        PV[p + planes][i] = { support: nNeg, axialSpan: axN / nNeg, azimuthalCoarseness: thN / nNeg, aspect: aspN / nNeg }; }
    }
  }

  // 4.4 reporting: no-hit stations, then linear gap fill (ends -> 0)
  let noHit = 0, discontinuous = 0;
  for (const rib of R) {
    let gaps = 0, prev = -1;
    for (let i = 0; i < stations; i++) {
      if (!Number.isNaN(rib[i])) {
        if (prev < 0) { for (let j = 0; j < i; j++) rib[j] = 0; }
        else if (i - prev > 1) {
          gaps += i - prev - 1;
          for (let j = prev + 1; j < i; j++) rib[j] = rib[prev] + ((rib[i] - rib[prev]) * (j - prev)) / (i - prev);
        }
        prev = i;
      }
    }
    if (prev < 0) { rib.fill(0); discontinuous++; }
    else for (let j = prev + 1; j < stations; j++) rib[j] = 0;
    noHit += gaps;
    if (gaps > stations * 0.25) discontinuous++;
  }

  const thetas = Array.from({ length: nRib }, (_, k) => (Math.PI * (k % planes)) / planes + (k >= planes ? Math.PI : 0));
  let rMax = 0; for (const rib of R) for (const v of rib) if (v > rMax) rMax = v;

  return {
    ribbons: R.map((r) => Array.from(r)), thetas, L, rMax, x0, stations, planes,
    frame: { axis, up: inferred ? 'inferred' : up, orientationReference: inferred ? 'inferred' : 'declared', e0, e1, centroid: C, volume, centroidFallback: fallback },
    provenance: PV,
    report: { multiHitFrac: stationHits ? multiHit / stationHits : 0, noHitFrac: noHit / (nRib * stations), discontinuous },
  };
}

/**
 * Spec 4.6–4.8. Tangent by symmetric secant of frozen PHYSICAL span;
 * absolute and net turning per zone over the retained domain.
 */
export function ribbonMetrics(r, L, { tipFrac, zones = ZONES, secantFrac = SECANT_FRAC } = {}) {
  const N = r.length, dx = L / (N - 1);
  const half = Math.max(1, Math.round(((secantFrac / 2) * L) / dx));   // physical span
  const i0 = Math.ceil(tipFrac * (N - 1)), i1 = Math.floor((1 - tipFrac) * (N - 1));
  const phi = [], idx = [];
  for (let i = i0; i <= i1; i++) {
    const a = Math.max(0, i - half), b = Math.min(N - 1, i + half);
    phi.push(Math.atan2(r[b] - r[a], (b - a) * dx));
    idx.push(i);
  }
  const z = Array.from({ length: zones }, () => ({ abs: 0, net: 0 }));
  let absTurn = 0, moment = 0;
  const span = i1 - i0;
  for (let k = 0; k + 1 < phi.length; k++) {
    const d = phi[k + 1] - phi[k];
    const u = (idx[k] - i0) / span;
    const zi = Math.min(zones - 1, Math.floor(u * zones));
    z[zi].abs += Math.abs(d); z[zi].net += d;
    absTurn += Math.abs(d); moment += u * Math.abs(d);
  }
  const netTurn = phi.length ? phi[phi.length - 1] - phi[0] : 0;
  return {
    i0, i1, zones: z, absTurn, netTurn,
    turnCentroid: absTurn > 0 ? moment / absTurn : 0,
    // R3 (approved 2026-08-20) PERMANENT NOISE DIAGNOSTIC. For any body
    // whose tangent angle changes monotonically, absolute and net turning
    // must coincide, so this must converge to ~0. It turns extraction
    // noise into a directly visible number.
    turningExcess: Math.abs(netTurn) > 1e-9 ? absTurn / Math.abs(netTurn) - 1 : 0,
  };
}

/* ------------------------------------------------------------------ */
/* analytic control bodies — exact sampling, no interpolation          */
/* ------------------------------------------------------------------ */

/** Build a mesh by evaluating r(x, theta) exactly. Flight = X, up = +Y. */
export function analyticBody(rFn, halfLen, { nx = 240, nt = 96 } = {}) {
  const verts = [], faces = [], ring = [];
  for (let i = 0; i <= nx; i++) {
    const x = -halfLen + (2 * halfLen * i) / nx;
    const rr = Math.max(0, rFn(x, 0));
    if (rr < 1e-9) { ring.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let j = 0; j < nt; j++) {
      const th = (2 * Math.PI * j) / nt;
      const r = Math.max(0, rFn(x, th));
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);   // e0 = +Y, e1 = +Z
    }
    ring.push(first);
  }
  const size = (i) => (i < nx ? ring[i + 1] - ring[i] : verts.length - ring[i]);
  for (let i = 0; i < nx; i++) {
    const a = ring[i], b = ring[i + 1], ap = size(i) === 1, bp = size(i + 1) === 1;
    if (ap && bp) continue;
    for (let j = 0; j < nt; j++) {
      const j1 = (j + 1) % nt;
      if (ap) faces.push([a, b + j, b + j1]);
      else if (bp) faces.push([b, a + j1, a + j]);
      else faces.push([a + j, b + j, b + j1], [a + j, b + j1, a + j1]);
    }
  }
  return { verts, faces };
}

const DEG = 180 / Math.PI;
/** Transverse radius of a triaxial ellipsoid at clock angle theta from +Y. */
const bEff = (B, C, th) => (B * C) / Math.hypot(C * Math.cos(th), B * Math.sin(th));

export const CONTROLS = [
  {
    name: 'sphere',
    A: 1, kind: 'ellipsoid', B: 1, C: 1,
    rFn: (x, th) => Math.sqrt(Math.max(0, 1 - x * x)) * bEff(1, 1, th),
  },
  {
    name: 'prolate spheroid f=3',
    A: 3, kind: 'ellipsoid', B: 1, C: 1,
    rFn: (x, th) => Math.sqrt(Math.max(0, 1 - (x / 3) ** 2)) * bEff(1, 1, th),
  },
  {
    name: 'parabolic body f=3',      // different profile FAMILY, elongated
    A: 3, kind: 'parabolic', R: 1,
    rFn: (x) => Math.max(0, 1 - (x / 3) ** 2),
  },
  {
    name: 'triaxial ellipsoid 2:1:0.6',   // THE DIRECTIONALITY CONTROL
    A: 2, kind: 'ellipsoid', B: 1, C: 0.6,
    rFn: (x, th) => Math.sqrt(Math.max(0, 1 - (x / 2) ** 2)) * bEff(1, 0.6, th),
  },
];

/** Analytic absolute turning over the retained range |x| <= a. */
function analyticTurning(ctrl, a, th) {
  const { kind, A } = ctrl;
  if (kind === 'ellipsoid') {
    const Be = bEff(ctrl.B, ctrl.C, th);
    return 2 * Math.atan((Be * a) / (A * A * Math.sqrt(Math.max(1e-15, 1 - (a / A) ** 2))));
  }
  return 2 * Math.atan((2 * ctrl.R * a) / (A * A));   // parabolic: dr/dx = -2Rx/A^2
}
/** Analytic ribbon radius. */
function analyticRadius(ctrl, x, th) { return ctrl.rFn(x, th); }

/* ------------------------------------------------------------------ */
/* control runner — spec 5, all four hard-fail                         */
/* ------------------------------------------------------------------ */

const TOL = { profile: 0.02, spread: 0.01, turn: 0.06 };

export function runControl(ctrl, tipFrac, { planes = 12, nx = 240, nt = 96 } = {}) {
  const mesh = analyticBody(ctrl.rFn, ctrl.A, { nx, nt });
  const F = extractRibbons(mesh.verts, mesh.faces, { axis: 'X', up: 'Y', planes });
  const { ribbons, L, thetas, rMax } = F;
  const N = ribbons[0].length;
  const problems = [];

  // 1. every ribbon matches its own analytic profile
  // R2 (approved 2026-08-20): judge profile and directionality over the
  // SAME retained domain as turning. Failing a control on stations the
  // metric explicitly excludes was a test bug, not a method failure.
  const j0 = Math.ceil(tipFrac * (N - 1)), j1 = Math.floor((1 - tipFrac) * (N - 1));
  let worstProfile = 0;
  ribbons.forEach((rib, k) => {
    for (let i = j0; i <= j1; i++) {
      const x = -ctrl.A + (i / (N - 1)) * L;
      const want = analyticRadius(ctrl, x, thetas[k]);
      const err = Math.abs(rib[i] - want) / rMax;
      if (err > worstProfile) worstProfile = err;
    }
  });
  if (worstProfile > TOL.profile) problems.push(`profile ${(100 * worstProfile).toFixed(2)}% > ${100 * TOL.profile}%`);

  // 2. directionality: ribbon-to-ribbon behaviour must match analytic
  let worstSpread = 0;
  for (let i = j0; i <= j1; i++) {
    const x = -ctrl.A + (i / (N - 1)) * L;
    const want = ribbons.map((_, k) => analyticRadius(ctrl, x, thetas[k]));
    if (Math.max(...want) < 0.05 * rMax) continue;
    for (let k = 0; k < ribbons.length; k++) {
      const e = Math.abs(ribbons[k][i] - want[k]) / Math.max(...want);
      if (e > worstSpread) worstSpread = e;
    }
  }
  if (worstSpread > TOL.spread) problems.push(`directional ${(100 * worstSpread).toFixed(2)}% > ${100 * TOL.spread}%`);

  // 3. turning over the RETAINED range vs analytic over that same range
  let worstTurn = 0;
  ribbons.forEach((rib, k) => {
    const m = ribbonMetrics(rib, L, { tipFrac });
    const a = ctrl.A * (1 - 2 * tipFrac);
    const want = analyticTurning(ctrl, a, thetas[k]);
    const rel = Math.abs(m.absTurn - want) / want;
    if (rel > worstTurn) worstTurn = rel;
  });
  if (worstTurn > TOL.turn) problems.push(`turning ${(100 * worstTurn).toFixed(1)}% > ${100 * TOL.turn}%`);

  return { pass: problems.length === 0, problems, worstProfile, worstSpread, worstTurn, report: F.report };
}
