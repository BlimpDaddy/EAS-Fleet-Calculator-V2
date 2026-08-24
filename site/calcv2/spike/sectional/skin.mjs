/**
 * PHASE 1F — JOINT AXIS-AWARE CARTESIAN CANONICAL SKIN. Spec 36, frozen 7e7b406.
 *
 *   raw mesh vertices + connectivity -> S(x, u) = (x, y(x,u), z(x,u))
 *   -> canonical skin -> transverse / ribbon sampling
 *
 * The fit reads MESH VERTICES. It never reads a section polygon: spec 35.5
 * measured section vertices at up to 1.5566% off the analytic surface even
 * when every mesh vertex lies exactly on it, because a section vertex is an
 * edge-crossing rather than a sample of the surface.
 *
 * TWO DECLARED v1 SIMPLIFICATIONS, both stated because spec 36 permits more
 * than this and a later reader must not mistake v1 for the frozen ceiling:
 *
 *  (A) `u` IS POLAR ANGLE IN v1. Spec 36.2 allows any periodic
 *      circumferential coordinate. Using theta assumes each section is
 *      single-valued in theta. The OUTPUT is still Cartesian (y, z), which is
 *      the substantive change from `r(x, theta)` -- a flat is a straight line
 *      in the fitted quantity rather than a hyperbola. If a control shows the
 *      parameterisation is the limiting factor, `u` becomes arc-length based.
 *      Violations are DETECTED, not assumed away: see `skinRadii`, which
 *      reports multiple ray intersections per the 36.5 domain rule.
 *
 *  (B) CONNECTIVITY SETS THE BANDWIDTH, IT DOES NOT SET THE TOPOLOGY. Edges
 *      give the local sampling scale, so the fit window adapts to mesh density
 *      instead of using a hand-picked constant. A full connectivity-aware
 *      (geodesic) neighbourhood is NOT built in v1.
 *
 * METHOD: moving least squares. A local quadratic in (dx, du) is fitted to
 * the vertices around each evaluation point and evaluated at its centre.
 * APPROXIMATION, NOT INTERPOLATION -- deliberately.
 *
 * SPEC 38.5, wording corrected: this is NOT noise suppression. The analytic
 * mesh vertices are on the true surface to machine precision and carry no
 * positional noise to average. What the joint fit does is ESTIMATE A COHERENT
 * SURFACE FROM NEIGHBOURING TRUE SURFACE SAMPLES, rather than differentiating
 * the arbitrary faceted interpolation between them. Phase 1E differentiated
 * that faceting; that is why it failed.
 */

import { detectFeatureCurvesV2, partitionSurface } from './features.mjs';

const TWO_PI = Math.PI * 2;
const wrap = (d) => { let t = d; while (t > Math.PI) t -= TWO_PI; while (t < -Math.PI) t += TWO_PI; return t; };
/** Wendland C2 weight on t in [0,1]; 0 outside. */
const W = (t) => (t >= 1 ? 0 : (1 - t) ** 4 * (4 * t + 1));

/**
 * Local sampling scale from CONNECTIVITY (declared simplification B).
 * Median axial and angular edge extent over every mesh edge.
 */
export function meshScale(verts, faces, { rMin = 1e-9 } = {}) {
  const seen = new Set(), dxs = [], dus = [];
  for (const f of faces) {
    for (let e = 0; e < f.length; e++) {
      const a = f[e], b = f[(e + 1) % f.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const A = verts[a], B = verts[b];
      const ra = Math.hypot(A[1], A[2]), rb = Math.hypot(B[1], B[2]);
      if (ra < rMin || rb < rMin) continue;            // pole vertices: theta undefined
      dxs.push(Math.abs(B[0] - A[0]));
      dus.push(Math.abs(wrap(Math.atan2(B[2], B[1]) - Math.atan2(A[2], A[1]))));
    }
  }
  const med = (a) => { if (!a.length) return 0; a.sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
  // medians over ALL edges include the near-zero direction of each quad, so
  // take the median of the non-degenerate half in each axis
  const nzx = dxs.filter((v) => v > 1e-12), nzu = dus.filter((v) => v > 1e-12);
  return { dx: med(nzx), du: med(nzu), edges: seen.size };
}

/** Solve a small symmetric normal-equation system by Gaussian elimination. */
function solve(M, b, n) {
  const A = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-14) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / A[i][i]);
}

/**
 * Build the canonical skin. Returns an evaluator plus the diagnostics the
 * gate needs to tell a genuine result from a degenerate one.
 */
export function makeSkin(verts, faces, { cx = 2.5, cu = 2.5, rMin = 1e-9, features = null } = {}) {
  // SPEC 40.3 / 41.4 -- feature curves and patch partitioning happen HERE, on
  // the surface, before any slicing. The detector sees only vertices and
  // connectivity (41.2); nothing analytic reaches it.
  let part = null, det = null;
  if (features) {
    det = detectFeatureCurvesV2(verts, faces, features);
    part = partitionSurface(verts, faces, det.featureEdges, det.edgeFaces);
    if (part.nPatches <= 1) part = null;              // no feature found: identical to the unpartitioned fit
  }
  const scale = meshScale(verts, faces, { rMin });
  const hx = cx * scale.dx, hu = cu * scale.du;
  if (!(hx > 0) || !(hu > 0)) throw new Error('makeSkin: degenerate mesh scale');

  // parameter samples — pole vertices excluded, theta is undefined there
  const P = [];
  let poles = 0;
  verts.forEach((v, vi) => {
    const r = Math.hypot(v[1], v[2]);
    if (r < rMin) { poles++; return; }
    P.push({ x: v[0], u: Math.atan2(v[2], v[1]), y: v[1], z: v[2], vi,
      patches: part ? (part.vertexPatches.get(vi) || null) : null,
      crease: part ? part.creaseVertex.has(vi) : false });
  });
  let x0 = Infinity, x1 = -Infinity;
  for (const p of P) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; }

  // bin in (x, u) so each evaluation scans a 3x3 neighbourhood, not the cloud
  const nbx = Math.max(1, Math.ceil((x1 - x0) / hx)), nbu = Math.max(3, Math.ceil(TWO_PI / hu));
  const bins = Array.from({ length: nbx * nbu }, () => []);
  const bx = (x) => Math.min(nbx - 1, Math.max(0, Math.floor(((x - x0) / (x1 - x0 || 1)) * nbx)));
  const bu = (u) => ((Math.floor(((u + Math.PI) / TWO_PI) * nbu) % nbu) + nbu) % nbu;
  P.forEach((p, i) => bins[bx(p.x) * nbu + bu(p.u)].push(i));

  const stats = { vertices: P.length, poles, hx, hu, scale, quadratic: 0, linear: 0, nearest: 0, empty: 0,
    features: det ? det.stats : null, patches: part ? part.nPatches : 1,
    creaseVertices: part ? part.creaseVertex.size : 0, patchSplitEvals: 0, linearSites: [] };

  /** S(x, u) -> [y, z]. */
  function evalPoint(x, u) {
    const ix = bx(x), iu = bu(u);
    // gather the neighbourhood first, so the patch can be chosen before any
    // vertex is allowed to influence the fit
    const cand = [];
    let bestD = Infinity, bestI = -1, sideD = Infinity, sidePatch = -1;
    for (let a = -1; a <= 1; a++) {
      const jx = ix + a; if (jx < 0 || jx >= nbx) continue;
      for (let c = -1; c <= 1; c++) {
        const ju = ((iu + c) % nbu + nbu) % nbu;
        for (const i of bins[jx * nbu + ju]) {
          const p = P[i];
          const dx = (p.x - x) / hx, du = wrap(p.u - u) / hu;
          const d2 = dx * dx + du * du;
          if (d2 < bestD) { bestD = d2; bestI = i; }
          // SPEC 41.4: which side of the crease is this evaluation point on?
          // Decided by the nearest NON-crease vertex, since a crease vertex
          // belongs to every patch that touches it and cannot disambiguate.
          if (part && !p.crease && d2 < sideD && p.patches && p.patches.size) {
            sideD = d2; sidePatch = p.patches.values().next().value;
          }
          const w = W(Math.hypot(dx, du));
          if (w > 0) cand.push({ p, dx, du, w });
        }
      }
    }
    const M = Array.from({ length: 6 }, () => new Array(6).fill(0));
    const by = new Array(6).fill(0), bz = new Array(6).fill(0);
    let n = 0, wsum = 0, excluded = 0;
    for (const { p, dx, du, w } of cand) {
      // Only this patch's vertices may influence the fit. Crease vertices
      // belong to BOTH patches, so both sides fit through the same points --
      // positional continuity -- while the tangent is free to break.
      if (part && sidePatch >= 0 && p.patches && !p.patches.has(sidePatch)) { excluded++; continue; }
      const B = [1, dx, du, dx * dx, dx * du, du * du];
      for (let r = 0; r < 6; r++) {
        for (let s = 0; s < 6; s++) M[r][s] += w * B[r] * B[s];
        by[r] += w * B[r] * p.y; bz[r] += w * B[r] * p.z;
      }
      n++; wsum += w;
    }
    if (excluded) stats.patchSplitEvals++;
    if (n >= 8) {
      const cy = solve(M.map((r) => [...r]), by, 6), cz = solve(M.map((r) => [...r]), bz, 6);
      if (cy && cz) { stats.quadratic++; return [cy[0], cz[0]]; }
    }
    if (n >= 4) {
      const M3 = M.slice(0, 3).map((r) => r.slice(0, 3));
      const cy = solve(M3.map((r) => [...r]), by.slice(0, 3), 3);
      const cz = solve(M3.map((r) => [...r]), bz.slice(0, 3), 3);
      if (cy && cz) {
        stats.linear++;
        // DIAGNOSTIC ONLY (spec 51.12). Additive: records WHERE the 6-term fit
        // was unavailable. Touches no returned value and no numeric path.
        if (stats.linearSites.length < 512) stats.linearSites.push({ x, u, n, cand: cand.length, excluded });
        return [cy[0], cz[0]];
      }
    }
    if (bestI >= 0) { stats.nearest++; return [P[bestI].y, P[bestI].z]; }
    stats.empty++; return [0, 0];
  }

  return { evalPoint, stats, x0, x1, hx, hu };
}

/** Closed transverse curve of the skin at station x, as a dense polyline. */
export function skinSection(skin, x, nu = 512) {
  const pts = new Array(nu);
  for (let k = 0; k < nu; k++) pts[k] = skin.evalPoint(x, -Math.PI + (TWO_PI * k) / nu);
  return pts;
}

/**
 * Intersect fixed (x, theta) rays with the skin's transverse curve.
 *
 * SPEC 36.5 DOMAIN RULE: multiple radial intersections are REPORTED, never
 * forced into a single-valued answer. `multi` counts rays where the closed
 * curve crosses more than once, which is the signal that the v1 polar
 * parameterisation (simplification A) has met geometry it cannot support.
 */
export function skinRadii(skin, x, rays, nu = 512) {
  const pts = skinSection(skin, x, nu);
  const n = pts.length;
  const r = new Array(rays.length).fill(0);
  let multi = 0, missed = 0;
  rays.forEach((th, k) => {
    const ct = Math.cos(th), st = Math.sin(th);
    const hits = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const g1 = p[0] * st - p[1] * ct, g2 = q[0] * st - q[1] * ct;
      if (g1 === g2 || (g1 < 0 && g2 < 0) || (g1 > 0 && g2 > 0)) continue;
      const t = g1 / (g1 - g2);
      const X = p[0] + t * (q[0] - p[0]), Y = p[1] + t * (q[1] - p[1]);
      const proj = X * ct + Y * st;
      if (proj > 0) hits.push(proj);
    }
    if (!hits.length) { missed++; return; }
    if (hits.length > 1) multi++;
    r[k] = Math.max(...hits);
  });
  return { r, multi, missed };
}
