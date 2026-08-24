/**
 * PHASE 1D STEP 1 — CANONICAL SKIN BY POSITIONAL CONTOUR SAMPLING (2026-08-20)
 * Spec 21, frozen 2e63ac4. No longitudinal smoothing. No reconstruction.
 *
 * At each x station take the EXACT planar section of the mesh, then read
 * its radius along a ray at each fixed theta. Topology-independent: no
 * contour chaining, no facet normals, no derivative of raw triangles.
 * Position only.
 *
 * This does NOT modify the frozen extractor; it is a parallel path.
 */
const AXIS_VEC = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = (a) => { const n = Math.hypot(...a); return [a[0]/n, a[1]/n, a[2]/n]; };

export function volumeCentroid(verts, faces) {
  let V = 0, c = [0, 0, 0];
  for (const f of faces) for (let k = 1; k + 1 < f.length; k++) {
    const a = verts[f[0]], b = verts[f[k]], d = verts[f[k+1]];
    const v = dot(a, cross(b, d)) / 6; V += v;
    for (let i = 0; i < 3; i++) c[i] += v * (a[i] + b[i] + d[i]) / 4;
  }
  if (Math.abs(V) < 1e-12) return [0, 0, 0];
  return c.map((x) => x / V);
}

/** Canonical skin r[theta][station] from exact planar sections. */
export function extractSkin(verts, faces, { axis = 'X', up = 'Y', nTheta = 24, stations = 128 } = {}) {
  const fdir = AXIS_VEC[axis];
  let e0 = sub(AXIS_VEC[up], fdir.map((c) => c * dot(AXIS_VEC[up], fdir)));
  e0 = norm(e0); const e1 = norm(cross(fdir, e0));
  const C = volumeCentroid(verts, faces);
  const P = verts.map((v) => { const d = sub(v, C);
    return { x: dot(d, fdir), a: dot(d, e0), b: dot(d, e1) }; });
  const xs = P.map((p) => p.x);
  const x0 = Math.min(...xs), L = Math.max(...xs) - x0;

  // bucket triangles by the station range they span
  const buckets = Array.from({ length: stations }, () => []);
  for (const f of faces) {
    for (let k = 1; k + 1 < f.length; k++) {
      const T = [P[f[0]], P[f[k]], P[f[k+1]]];
      const lo = Math.min(T[0].x, T[1].x, T[2].x), hi = Math.max(T[0].x, T[1].x, T[2].x);
      const i0 = Math.max(0, Math.ceil(((lo - x0) / L) * (stations - 1)));
      const i1 = Math.min(stations - 1, Math.floor(((hi - x0) / L) * (stations - 1)));
      for (let i = i0; i <= i1; i++) buckets[i].push(T);
    }
  }

  const R = Array.from({ length: nTheta }, () => new Float64Array(stations));
  // PHASE 1D-R1: LOCAL azimuthal adequacy. Arbitrary meshes have no uniform
  // nt, so the quantity that matters is the angular gap of the contour
  // segment THIS ray actually strikes. Predicted positional error from the
  // chord sagitta is then 1 - cos(gap/2), exact for the circular case and
  // to be tested for generalisation on the later curvature controls.
  const G = Array.from({ length: nTheta }, () => new Float64Array(stations));
  const dirs = [];
  for (let t = 0; t < nTheta; t++) { const th = (2 * Math.PI * t) / nTheta;
    dirs.push([Math.cos(th), Math.sin(th)]); }

  for (let i = 0; i < stations; i++) {
    const xi = x0 + (i / (stations - 1)) * L;
    // EXACT planar section: segments of every triangle crossing x = xi
    const segs = [];
    for (const T of buckets[i]) {
      const pts = [];
      for (let e = 0; e < 3; e++) {
        const p = T[e], q = T[(e + 1) % 3];
        if ((p.x < xi && q.x < xi) || (p.x > xi && q.x > xi) || p.x === q.x) continue;
        const t = (xi - p.x) / (q.x - p.x);
        if (t < 0 || t > 1) continue;
        pts.push([p.a + t * (q.a - p.a), p.b + t * (q.b - p.b)]);
      }
      if (pts.length >= 2) segs.push([pts[0], pts[1]]);
    }
    // ray-polygon radius per theta: outermost crossing, no chaining needed
    for (let t = 0; t < nTheta; t++) {
      const [dx, dy] = dirs[t]; let best = 0, bestGap = 0;
      for (const [[ax, ay], [bx, by]] of segs) {
        const ex = bx - ax, ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-15) continue;
        const s = (ax * ey - ay * ex) / den;          // distance along ray
        if (s <= 0) continue;
        const u = (dx * ay - dy * ax) / -den;          // position along segment
        if (u < -1e-9 || u > 1 + 1e-9) continue;
        if (s > best) {
          best = s;
          let g = Math.abs(Math.atan2(by, bx) - Math.atan2(ay, ax));
          if (g > Math.PI) g = 2 * Math.PI - g;
          bestGap = g;                                 // bracketing angular gap
        }
      }
      R[t][i] = best; G[t][i] = bestGap;
    }
  }
  return { ribbons: R.map((r) => Array.from(r)), L, stations, nTheta,
    gaps: G.map((g) => Array.from(g)),
    rMax: R.reduce((m, r) => Math.max(m, ...r), 0) };
}

/** Operator-matched oracle: analytic surface at the SAME stations/thetas. */
export function oracleSkin(rFn, halfLen, { nTheta = 24, stations = 128 } = {}) {
  const R = [];
  for (let t = 0; t < nTheta; t++) {
    const th = (2 * Math.PI * t) / nTheta, row = [];
    for (let i = 0; i < stations; i++) {
      const x = -halfLen + (2 * halfLen * i) / (stations - 1);
      row.push(Math.max(0, rFn(x, th)));
    }
    R.push(row);
  }
  return { ribbons: R, L: 2 * halfLen, stations, nTheta,
    rMax: R.reduce((m, r) => Math.max(m, ...r), 0) };
}
