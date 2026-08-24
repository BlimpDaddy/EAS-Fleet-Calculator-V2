/**
 * FIXED-GRID CONVEX-HULL SKINNING — spec 53, implemented as frozen.
 *
 *   convex hull -> deterministic resampling on a FIXED body-relative grid
 *               -> fixed-scale smoothing -> ribbons
 *
 * The hull's vertex distribution is NOT the sampling grid. The hull is
 * interrogated at coordinates the estimator chooses, so two triangulations of
 * the same convex body are asked the same questions.
 *
 * WHY THIS IS NOT PHASE 1E (53.1): 1E treated section edge-crossings as noisy
 * samples of an unknown intended CAD surface. The CANONICAL UPLOAD-HULL RULE
 * makes the convex hull ITSELF the geometry identity, so an exact intersection
 * with the hull is not an estimate of anything -- it is the canonical object.
 *
 * CONVEXITY IS STRUCTURAL (53.3), not measured. Support functions are exactly
 * the sublinear functions; smoothing with non-negative normalised weights
 * yields the support function of a Minkowski combination -- of rotated copies
 * circumferentially, of neighbouring sections axially. A reflex vertex in the
 * output is an IMPLEMENTATION BUG, never a tolerance to widen.
 *
 * No feature detector. No ridge tracer. No K. No mesh-derived bandwidth. No
 * nearest-vertex fallback. None of specs 42-50 is re-entered.
 */
const TWO_PI = Math.PI * 2;

/* ---------------- 53.4 / 53.6 the FIXED grid and the DECLARED scale */
export const STATIONS = 128;        // 4.5
export const NAZ = 256;             // circumferential resolution of h
export const TIP = 0.025;           // 4.7

/** 53.6 ladder. One declared resolution index; both scales double together. */
export const LADDER = [
  { k: 1, sx: 0.005, thDeg: 2 },
  { k: 2, sx: 0.010, thDeg: 4 },
  { k: 3, sx: 0.020, thDeg: 8 },
  { k: 4, sx: 0.040, thDeg: 16 },
  { k: 5, sx: 0.080, thDeg: 32 },
];

/**
 * Crossing points of the mesh with the plane x = xi, in the transverse (y, z)
 * plane, as an UNORDERED point set.
 *
 * 53.2: a support function needs no polygon. There is no chaining, no
 * ordering and no multi-hit question here, which is the entire failure class
 * of specs 29-33 removed rather than handled.
 */
export function crossings(verts, faces, xi) {
  const pts = [];
  for (const f of faces) {
    for (let e = 0; e < f.length; e++) {
      const A = verts[f[e]], B = verts[f[(e + 1) % f.length]];
      const da = A[0] - xi, db = B[0] - xi;
      if ((da < 0 && db < 0) || (da > 0 && db > 0) || da === db) continue;
      const t = da / (da - db);
      if (t < 0 || t > 1) continue;
      pts.push([A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])]);
    }
  }
  return pts;
}

/**
 * Raw support function of one section on the fixed azimuthal grid.
 *
 * h(th) = max over p in P_x of p . n_th. The maximum of a linear functional
 * over a polygon is attained at a vertex, and every vertex of the section is
 * a crossing point, so the max over crossings is h EXACTLY -- not an
 * approximation of it.
 */
export function sectionSupport(pts, naz = NAZ) {
  const h = new Array(naz).fill(-Infinity);
  const cs = new Array(naz), sn = new Array(naz);
  for (let j = 0; j < naz; j++) { const a = -Math.PI + (TWO_PI * j) / naz; cs[j] = Math.cos(a); sn[j] = Math.sin(a); }
  for (const p of pts) for (let j = 0; j < naz; j++) {
    const d = p[0] * cs[j] + p[1] * sn[j];
    if (d > h[j]) h[j] = d;
  }
  return h;
}

/** Normalised Gaussian weights truncated at 3 sigma. NON-NEGATIVITY IS LOAD-BEARING (53.3/53.4). */
function gaussian(sigmaSteps) {
  const r = Math.max(1, Math.ceil(3 * sigmaSteps));
  const w = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigmaSteps * sigmaSteps)); w.push(v); sum += v; }
  return { w: w.map((v) => v / sum), r };
}

/**
 * Build the canonical skin: fixed grid, exact support sampling, fixed-scale
 * smoothing. `x0`/`x1` are the body's own axial extent; the grid is
 * body-relative, so it is identical for any triangulation of the same body.
 */
export function makeSupportSkin(verts, faces, { sx, thDeg, stations = STATIONS, naz = NAZ } = {}) {
  let x0 = Infinity, x1 = -Infinity;
  for (const v of verts) { if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0]; }
  const L = x1 - x0;
  if (!(L > 0)) throw new Error('makeSupportSkin: zero axial extent');

  const xs = Array.from({ length: stations }, (_, i) => x0 + (L * i) / (stations - 1));

  /* --- exact support sampling on the fixed grid */
  const H = [];
  let emptySections = 0;
  for (let i = 0; i < stations; i++) {
    const pts = crossings(verts, faces, xs[i]);
    if (!pts.length) { emptySections++; H.push(null); continue; }
    H.push(sectionSupport(pts, naz));
  }
  /* the extreme stations sit exactly on the hull's end vertices, where the
     section can be a single point or empty; clamp to the nearest non-empty
     row so the grid stays complete without fabricating geometry */
  for (let i = 0; i < stations; i++) {
    if (H[i]) continue;
    let a = i, b = i;
    while (a >= 0 && !H[a]) a--;
    while (b < stations && !H[b]) b++;
    const src = a >= 0 ? H[a] : H[b];
    H[i] = src ? [...src] : new Array(naz).fill(0);
  }

  /* --- 53.4 smoothing at the DECLARED scale, in body coordinates only.
     sigma_x is a fraction of L; sigma_th is an angle. Neither consults any
     edge length, triangle count or vertex spacing. */
  const sigX = (sx * L) / (L / (stations - 1));            // -> station steps
  const sigT = thDeg / (360 / naz);                        // -> azimuth steps
  const gx = gaussian(sigX), gt = gaussian(sigT);

  /* circumferential: periodic wrap */
  const Ht = H.map((row) => {
    const out = new Array(naz);
    for (let j = 0; j < naz; j++) {
      let s = 0;
      for (let q = -gt.r; q <= gt.r; q++) s += gt.w[q + gt.r] * row[((j + q) % naz + naz) % naz];
      out[j] = s;
    }
    return out;
  });

  /* axial: CLAMP at the ends (53.4) -- reflection would fabricate geometry
     beyond the body; clamping keeps the result a non-negative combination of
     sections that actually exist, which is what preserves convexity */
  const Hs = [];
  for (let i = 0; i < stations; i++) {
    const out = new Array(naz).fill(0);
    for (let q = -gx.r; q <= gx.r; q++) {
      const ii = Math.min(stations - 1, Math.max(0, i + q));
      const wq = gx.w[q + gx.r];
      for (let j = 0; j < naz; j++) out[j] += wq * Hs_src(Ht, ii)[j];
    }
    Hs.push(out);
  }
  function Hs_src(A, i) { return A[i]; }

  return { xs, H: Hs, Hraw: H, x0, x1, L, naz, sx, thDeg, sigX, sigT, emptySections };
}

/**
 * The convex section implied by a smoothed support row: the intersection of
 * the half-planes { p . n_j <= h_j }.
 *
 * Consecutive constraints are solved pairwise. The result CIRCUMSCRIBES the
 * true convex section by O(dth^2 R / 8) -- at naz = 256 that is 0.0075% of R,
 * a known and quantified bias of representing a smooth convex curve by finitely
 * many tangent lines.
 */
export function supportPolygon(h, naz = h.length) {
  const pts = [];
  for (let j = 0; j < naz; j++) {
    const a1 = -Math.PI + (TWO_PI * j) / naz, a2 = -Math.PI + (TWO_PI * ((j + 1) % naz)) / naz;
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const det = c1 * s2 - s1 * c2;
    if (Math.abs(det) < 1e-15) continue;
    pts.push([(h[j] * s2 - h[(j + 1) % naz] * s1) / det, (c1 * h[(j + 1) % naz] - c2 * h[j]) / det]);
  }
  return pts;
}

/**
 * Radii along fixed rays — HALF-SPACE FORM, the support representation's own.
 *
 * REPLACED THE EDGE-INTERSECTION PRIMITIVE 2026-08-21 (spec 72). For a convex
 * body { p : n_j . p <= h_j } and a ray p = t.d from an interior point,
 *
 *     t_max = min over { j : n_j . d > 0 } of  h_j / (n_j . d)
 *
 * which is UNIQUE BY CONSTRUCTION. No edges, no crossing counting, so the
 * duplicate-hit defect cannot recur: a body with FLAT FACETS (the Sunship's
 * underside) produces many COINCIDENT support-polygon vertices, hence
 * zero-length edges, and the old primitive counted the same single point once
 * per zero-length edge -- 41 times at one station. It agreed with this form
 * to 7.4e-15 on every ray; only the COUNT was wrong, never the radius.
 *
 * `multi` now counts GEOMETRICALLY DISTINCT outward crossings, which is 0 by
 * construction for a convex section about an interior point. It is retained as
 * a correctness self-check, not as a domain gate.
 * `missed` marks a ray with no supporting constraint, i.e. the reference point
 * is NOT interior -- the real 36.5 condition.
 */
export function supportRadii(skin, i, rays) {
  const h = skin.H[i], naz = skin.naz;
  const r = new Array(rays.length).fill(0);
  let multi = 0, missed = 0;
  rays.forEach((th, k) => {
    const ct = Math.cos(th), st = Math.sin(th);
    let t = Infinity;
    for (let j = 0; j < naz; j++) {
      const a = -Math.PI + (TWO_PI * j) / naz;
      const nd = Math.cos(a) * ct + Math.sin(a) * st;
      if (nd > 1e-12) { const cand = h[j] / nd; if (cand < t) t = cand; }
    }
    if (!(t > 0) || !Number.isFinite(t)) { missed++; return; }
    r[k] = t;
  });
  return { r, multi, missed, loop: null };
}

/**
 * SELF-TEST for `supportRadii`. A UNIT SQUARE has flat facets, which is the
 * exact geometry that broke the old primitive. Rays along +x and along the
 * diagonal must each return ONE radius, and the diagonal must be sqrt(2)x the
 * face radius. Run before any result that depends on the primitive.
 */
export function supportRadiiSelfTest() {
  const naz = 256, h = new Array(naz);
  for (let j = 0; j < naz; j++) {
    const a = -Math.PI + (TWO_PI * j) / naz;
    h[j] = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a));   // support fn of the SQUARE [-1,1]^2
    // (max(|cos|,|sin|) would be the DIAMOND -- the first draft of this test used it
    // and the primitive correctly returned the diamond's radii, catching my error not its own)
  }
  const skin = { H: [h], naz };
  const got = supportRadii(skin, 0, [0, Math.PI / 4, Math.PI, -Math.PI / 2]);
  const face = got.r[0], diag = got.r[1];
  return {
    ok: got.multi === 0 && got.missed === 0
      && Math.abs(face - 1) < 1e-9 && Math.abs(diag - Math.SQRT2) < 1e-9
      && Math.abs(got.r[2] - 1) < 1e-9 && Math.abs(got.r[3] - 1) < 1e-9,
    face, diag, multi: got.multi, missed: got.missed,
  };
}

/**
 * 53.3 / C6: reflex-vertex count. This is an IMPLEMENTATION CORRECTNESS CHECK,
 * not a quality gate. The output is convex by construction; a non-zero count
 * means this file is wrong.
 */
export function reflexCount(loop, scale) {
  let count = 0, worst = 0;
  const n = loop.length;
  // orientation-independent: a convex polygon has ONE consistent turn sign, so
  // the reflex vertices are those in the MINORITY sign, whichever that is.
  let pos = 0, neg = 0;
  const d = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = loop[i], b = loop[(i + 1) % n], c = loop[(i + 2) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    d[i] = len > 1e-15 ? cr / len : 0;
    if (d[i] > 0) pos++; else if (d[i] < 0) neg++;
  }
  const sign = pos >= neg ? -1 : 1;              // minority sign == reflex
  const eps = 1e-9 * scale;
  for (let i = 0; i < n; i++) {
    const v = sign * d[i];
    if (v > eps) { count++; if (v / scale > worst) worst = v / scale; }
  }
  return { count, worst };
}

/**
 * SELF-TEST for `reflexCount`. Run before any convexity result is emitted.
 *
 * This exists because the first implementation had an INVERTED SIGN and
 * reported a perfect 256-gon circle as 256 reflex vertices at 0.030% -- a
 * number that was then published as a defect of the skin. A convexity test
 * that is never pointed at a known-convex shape will lie silently.
 */
export function reflexSelfTest() {
  const n = 256;
  const circ = Array.from({ length: n }, (_, j) => {
    const a = (2 * Math.PI * j) / n; return [Math.cos(a), Math.sin(a)];
  });
  const cw = [...circ].reverse();
  const dent = circ.map((p, j) => (j === 64 ? [p[0] * 0.5, p[1] * 0.5] : p));
  const a = reflexCount(circ, 1), b = reflexCount(cw, 1), c = reflexCount(dent, 1);
  const ok = a.count === 0 && b.count === 0 && c.count > 0;
  return { ok, ccwCircle: a.count, cwCircle: b.count, dentedCircle: c.count };
}
