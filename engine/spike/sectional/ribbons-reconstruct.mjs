/**
 * PHASE 1E — FEATURE-PRESERVING CIRCUMFERENTIAL RECONSTRUCTION (2026-08-20)
 * Spec 28 / 28a, frozen dc0a0f8. Circumferential ONLY; no longitudinal
 * smoothing anywhere.
 *
 * DECLARED ASSUMPTION: the OBJ polygon is a SAMPLING of an intended
 * aerodynamic surface, not necessarily the surface itself. True for a
 * smooth hull, FALSE for a chine or flat face — which is why feature
 * detection exists and why an independent chine control gates the method.
 */

/** Turn angle at each vertex of a closed polygon, in radians. */
function turnAngles(pts) {
  const n = pts.length, t = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n], q = pts[i], r = pts[(i + 1) % n];
    const a1 = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const a2 = Math.atan2(r[1] - q[1], r[0] - q[0]);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    t[i] = d;
  }
  return t;
}

/** Natural cubic through (x,y), evaluated at xs. Not-a-knot free ends. */
function naturalCubic(x, y, xs) {
  const n = x.length;
  if (n < 3) return xs.map((q) => {
    if (n === 0) return 0; if (n === 1) return y[0];
    const t = (q - x[0]) / (x[1] - x[0] || 1); return y[0] + t * (y[1] - y[0]);
  });
  const h = [], al = [];
  for (let i = 0; i < n - 1; i++) h.push(x[i + 1] - x[i]);
  for (let i = 1; i < n - 1; i++) al.push(3 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]));
  const l = [1], mu = [0], z = [0];
  for (let i = 1; i < n - 1; i++) {
    l.push(2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1]);
    mu.push(h[i] / l[i]); z.push((al[i - 1] - h[i - 1] * z[i - 1]) / l[i]);
  }
  l.push(1); z.push(0);
  const c = new Array(n).fill(0), b = new Array(n).fill(0), d = new Array(n).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (y[j + 1] - y[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return xs.map((q) => {
    let i = 0; while (i < n - 2 && q > x[i + 1]) i++;
    const dx = q - x[i];
    return y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  });
}

/**
 * Reconstruct r(theta) at fixed rays from the section polygon's VERTICES.
 * Piecewise: natural cubic between detected features; features retained as
 * corners so the fit cannot round them away.
 *
 * @param {number[][]} verts  polygon vertices, any order, transverse plane
 * @param {number[]}   rays   theta values to evaluate at
 * @param {number}     K      feature threshold, multiples of median turn
 */
/**
 * Reconstruct r(theta) at fixed rays from an ORDERED contour loop supplied
 * by the frozen contour primitive (`chainContour`). It arrives already
 * deduplicated and collinear-simplified, so the median turn angle is
 * meaningful — the degeneracy that broke the first K attempt is gone.
 *
 * Piecewise: natural cubic between detected features; features retained as
 * corners so the fit cannot round them away.
 *
 * @param {number[][]} loop  ordered closed polygon from chainContour
 * @param {number[]}   rays  theta values to evaluate at
 * @param {number}     K     feature threshold, multiples of median turn
 */
export function reconstructContour(loop, rays, K) {
  const n = loop.length;
  if (n < 4) return rays.map(() => (n ? Math.hypot(loop[0][0], loop[0][1]) : 0));
  const ta = turnAngles(loop);
  const med = [...ta].sort((a, b) => a - b)[Math.floor(n / 2)] || 1e-12;
  const isFeat = ta.map((t) => t > K * med);
  const pol = loop.map((p) => [Math.atan2(p[1], p[0]), Math.hypot(p[0], p[1])]);
  const out = new Array(rays.length).fill(0);

  const evalRun = (idxs) => {
    const th = [], rr = [];
    let prev = null;
    for (const i of idxs) {
      let t = pol[i][0];
      if (prev !== null) { while (t < prev - 1e-12) t += 2 * Math.PI; }
      if (prev !== null && t <= prev) t = prev + 1e-12;
      th.push(t); rr.push(pol[i][1]); prev = t;
    }
    const lo = th[0], hi = th[th.length - 1];
    const want = [], wi = [];
    rays.forEach((q, k) => {
      for (const off of [-2 * Math.PI, 0, 2 * Math.PI]) {
        const qq = q + off;
        if (qq >= lo - 1e-12 && qq <= hi + 1e-12) { want.push(qq); wi.push(k); return; }
      }
    });
    if (!want.length) return;
    const got = naturalCubic(th, rr, want);
    wi.forEach((k, j) => { out[k] = got[j]; });
  };

  const featIdx = [];
  for (let i = 0; i < n; i++) if (isFeat[i]) featIdx.push(i);
  if (featIdx.length === 0) {
    evalRun([...Array(n).keys(), 0]);
  } else {
    for (let f = 0; f < featIdx.length; f++) {
      const a = featIdx[f], b = featIdx[(f + 1) % featIdx.length];
      const run = []; let i = a;
      for (;;) { run.push(i); if (i === b && run.length > 1) break; i = (i + 1) % n;
        if (run.length > n + 1) break; }
      evalRun(run);
    }
  }
  return out;
}

/* ================================================================== */
/* PHASE 1E-R1 — CARTESIAN ARC-LENGTH RECONSTRUCTION                  */
/* Spec 33, frozen d44b3ae. The polar path above is left BYTE-FOR-BYTE */
/* UNCHANGED so that the 32 reproduction run means something.          */
/* ================================================================== */

/**
 * Natural cubic COEFFICIENTS (free ends), rather than sampled values.
 * Deliberately a separate solve from `naturalCubic` above: editing that one
 * would have changed the polar path the reproduction run has to exercise.
 */
function naturalSpline(t, v) {
  const n = t.length;
  const b = new Array(n).fill(0), c = new Array(n).fill(0), d = new Array(n).fill(0);
  if (n < 2) return { b, c, d };
  const h = [];
  for (let i = 0; i < n - 1; i++) h.push(t[i + 1] - t[i]);
  if (n === 2) { b[0] = (v[1] - v[0]) / h[0]; return { b, c, d }; }
  const al = [];
  for (let i = 1; i < n - 1; i++) al.push(3 * ((v[i + 1] - v[i]) / h[i] - (v[i] - v[i - 1]) / h[i - 1]));
  const l = [1], mu = [0], z = [0];
  for (let i = 1; i < n - 1; i++) {
    l.push(2 * (t[i + 1] - t[i - 1]) - h[i - 1] * mu[i - 1]);
    mu.push(h[i] / l[i]); z.push((al[i - 1] - h[i - 1] * z[i - 1]) / l[i]);
  }
  l.push(1); z.push(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (v[j + 1] - v[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return { b, c, d };
}

/**
 * Cubic pieces of (x(s), y(s)) over CUMULATIVE CHORD LENGTH for one run.
 *
 * SPEC 33.3 RULE 2: a two-point run is the exact straight segment. After
 * the frozen primitive's collinear removal a genuine flat IS two points, so
 * the flat is reproduced exactly by construction with no flat detector
 * anywhere in the path. This is the whole reason the parameterisation
 * changed.
 */
function runPieces(pts) {
  const m = pts.length;
  if (m < 2) return [];
  const s = [0];
  for (let i = 1; i < m; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  if (!(s[m - 1] > 0)) return [];
  const X = pts.map((p) => p[0]), Y = pts.map((p) => p[1]);
  const pieces = [];
  if (m === 2) {
    const h = s[1] - s[0];
    pieces.push({ h, x: [X[0], (X[1] - X[0]) / h, 0, 0], y: [Y[0], (Y[1] - Y[0]) / h, 0, 0] });
    return pieces;
  }
  const sx = naturalSpline(s, X), sy = naturalSpline(s, Y);
  for (let i = 0; i < m - 1; i++) {
    const h = s[i + 1] - s[i];
    if (!(h > 0)) continue;
    pieces.push({ h, x: [X[i], sx.b[i], sx.c[i], sx.d[i]], y: [Y[i], sy.b[i], sy.c[i], sy.d[i]] });
  }
  return pieces;
}

const evalP = (co, u) => co[0] + u * (co[1] + u * (co[2] + u * co[3]));
const evalD = (co, u) => co[1] + u * (2 * co[2] + 3 * u * co[3]);

/**
 * SPEC 33.3 RULE 4. Radius at a fixed theta is the INTERSECTION of the ray
 * with the reconstructed closed curve, not a function evaluation.
 *
 * On each piece the ray condition x(s) sin(th) - y(s) cos(th) = 0 is an
 * exact CUBIC in s, so this is root-finding rather than sampling: a
 * straight run gives a linear equation and an exact root. Each piece is
 * swept in sub-intervals because a cubic may cross the ray up to 3 times,
 * and every crossing is returned — the caller decides, and multiplicity is
 * reported rather than silently maxed away.
 */
function intersectRay(pieces, th) {
  const ct = Math.cos(th), st = Math.sin(th);
  const SUB = 8, hits = [];
  for (const pc of pieces) {
    const g = (u) => evalP(pc.x, u) * st - evalP(pc.y, u) * ct;
    const gd = (u) => evalD(pc.x, u) * st - evalD(pc.y, u) * ct;
    // KNOT TOLERANCE. Adjacent pieces share a knot but evaluate it by two
    // different polynomials, so a ray passing within rounding distance of a
    // vertex can come out ~+1e-17 from one side and ~-1e-16 from the other.
    // Neither piece then sees a sign change and the root is LOST -- which on
    // a clean lathe returned radius 0 and 309 deg / 3116 deg of invented
    // turning from a single ribbon. A closed curve about the origin must meet
    // every ray, so a miss is numerical by definition. Every piece START is a
    // knot of the loop (the end of one piece is the start of the next, and
    // runs are closed head-to-tail), so testing starts covers every vertex.
    const scale = Math.abs(pc.x[0]) + Math.abs(pc.y[0]) + pc.h;
    const EPS = 1e-12 * (scale > 0 ? scale : 1);
    for (let k = 0; k < SUB; k++) {
      let a = (pc.h * k) / SUB, b = (pc.h * (k + 1)) / SUB;
      let ga = g(a), gb = g(b), root = null;
      if (Math.abs(ga) <= EPS) root = a;
      else if (ga * gb < 0) {
        for (let it = 0; it < 100; it++) {
          const mid = (a + b) / 2, gm = g(mid);
          if (ga * gm <= 0) { b = mid; gb = gm; } else { a = mid; ga = gm; }
        }
        root = (a + b) / 2;
        for (let it = 0; it < 4; it++) {
          const dv = gd(root); if (Math.abs(dv) < 1e-18) break;
          const nx = root - g(root) / dv;
          if (nx < -1e-12 || nx > pc.h + 1e-12) break;
          root = nx;
        }
      }
      if (root === null) continue;
      const px = evalP(pc.x, root), py = evalP(pc.y, root);
      const proj = px * ct + py * st;          // signed distance along the ray
      if (proj <= 0) continue;                  // the opposite half-ray is a different ribbon
      hits.push(proj);
    }
  }
  hits.sort((p, q) => p - q);
  const uniq = [];
  for (const h of hits) if (!uniq.length || Math.abs(h - uniq[uniq.length - 1]) > 1e-9) uniq.push(h);
  return uniq;
}

/**
 * Reconstruct r at fixed rays from an ORDERED contour loop, in Cartesian
 * arc-length space. Feature DETECTION is byte-identical to the polar path
 * (same turn-angle rule, same K semantics) — spec 33 changes the
 * parameterisation and nothing else.
 *
 * SPEC 33.3 RULE 1: runs are bounded BY features and no piece ever spans a
 * feature vertex, so tangent continuity cannot leak through a corner.
 *
 * SEAM HANDLING, DECLARED. A loop with no detected feature is a closed
 * periodic curve, so it is fitted with 3 wrapped points of padding at each
 * end and the padding discarded. Without it the free-end conditions would
 * land at whatever vertex `chainContour` happened to start its walk on, and
 * the same geometry would reconstruct differently depending on walk order —
 * a bug, not a tuning choice. `startIndexInvariance` in the driver measures
 * this rather than asserting it.
 *
 * @returns {{r:number[], diag:object}}
 */
export function reconstructContourCartesian(loop, rays, K) {
  const n = loop.length;
  const diag = { vertices: n, features: 0, runs: 0, twoPointRuns: 0, multiHitRays: 0, missedRays: 0 };
  if (n < 4) {
    const r0 = n ? Math.hypot(loop[0][0], loop[0][1]) : 0;
    return { r: rays.map(() => r0), diag };
  }
  const ta = turnAngles(loop);
  const med = [...ta].sort((a, b) => a - b)[Math.floor(n / 2)] || 1e-12;
  const featIdx = [];
  for (let i = 0; i < n; i++) if (ta[i] > K * med) featIdx.push(i);
  diag.features = featIdx.length;

  const pieces = [];
  if (featIdx.length === 0) {
    const PAD = 3, pts = [];
    for (let k = -PAD; k <= n + PAD; k++) pts.push(loop[((k % n) + n) % n]);
    const all = runPieces(pts);
    for (let i = PAD; i < PAD + n && i < all.length; i++) pieces.push(all[i]);
    diag.runs = 1;
  } else {
    for (let f = 0; f < featIdx.length; f++) {
      const a = featIdx[f], b = featIdx[(f + 1) % featIdx.length];
      const run = []; let i = a;
      for (;;) {
        run.push(loop[i]);
        if (i === b && run.length > 1) break;
        i = (i + 1) % n;
        if (run.length > n + 1) break;
      }
      if (run.length === 2) diag.twoPointRuns++;
      pieces.push(...runPieces(run));
      diag.runs++;
    }
  }

  const out = rays.map((th) => {
    const hits = intersectRay(pieces, th);
    if (!hits.length) { diag.missedRays++; return 0; }
    if (hits.length > 1) diag.multiHitRays++;
    return hits[hits.length - 1];
  });
  return { r: out, diag };
}
