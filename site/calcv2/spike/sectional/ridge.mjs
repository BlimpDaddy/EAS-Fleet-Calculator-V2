/**
 * PHASE 1F — CONTINUOUS KINK FIELD AND RIDGE EXTRACTION. Spec 45.4 / 46,
 * frozen 9932db2.
 *
 * WHY THIS EXISTS. Edge-chain seeding was RETIRED in spec 45.3: a real crease
 * is not in general a chain of mesh edges, and thresholding at vertices
 * aliased the ridge badly enough that a JITTERED mesh detected it better than
 * a regular one (98.8% vs 62.9% station coverage). The feature curve must be
 * free to run THROUGH faces, like an isoline on a terrain map running through
 * grid cells rather than along their borders.
 *
 * THE FIELD. At any (x, u), fit a local weighted quadratic to the surrounding
 * mesh vertices and take
 *
 *      K(x, u) = weighted RMS residual / weighted physical spread
 *
 * Dimensionless, and the same quantity the frozen 0.05 floor was derived
 * against: ~(h/R)^3 on a smooth patch, ~tan(delta/2) scale across a crease.
 * Unlike the retired vertex measure this is defined everywhere, not only where
 * the tessellation happens to have put a sample.
 *
 * SPEC 41.2: vertices and connectivity only. Nothing analytic enters.
 *
 * DECLARED v1 LIMITATION (spec 46.6B): ridges are extracted by scanning u at
 * each x and linking across x, which suits features running broadly along the
 * flight axis. A circumferential step would NOT be found. Recorded as a
 * limitation, not a claim about generality.
 */

const TWO_PI = Math.PI * 2;
const wrap = (d) => { let t = d; while (t > Math.PI) t -= TWO_PI; while (t < -Math.PI) t += TWO_PI; return t; };
const W = (t) => (t >= 1 ? 0 : (1 - t) ** 4 * (4 * t + 1));

function solve(M, b, n) {
  const A = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-14) return null;
    const t = A[c]; A[c] = A[piv]; A[piv] = t;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / A[i][i]);
}

/** Continuous crease-evidence field over the (x, u) parameter domain. */
export function makeKinkField(verts, faces, { cx = 2.5, cu = 2.5, rMin = 1e-9 } = {}) {
  // local sampling scale from connectivity, as in the skin
  const seen = new Set(), dxs = [], dus = [];
  for (const f of faces) {
    for (let e = 0; e < f.length; e++) {
      const a = f[e], b = f[(e + 1) % f.length];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const A = verts[a], B = verts[b];
      if (Math.hypot(A[1], A[2]) < rMin || Math.hypot(B[1], B[2]) < rMin) continue;
      dxs.push(Math.abs(B[0] - A[0]));
      dus.push(Math.abs(wrap(Math.atan2(B[2], B[1]) - Math.atan2(A[2], A[1]))));
    }
  }
  const med = (a) => { const z = a.filter((v) => v > 1e-12).sort((p, q) => p - q); return z.length ? z[Math.floor(z.length / 2)] : 0; };
  const hx = cx * med(dxs), hu = cu * med(dus);
  if (!(hx > 0) || !(hu > 0)) throw new Error('makeKinkField: degenerate mesh scale');

  const P = [];
  for (const v of verts) {
    const r = Math.hypot(v[1], v[2]);
    if (r < rMin) continue;
    P.push({ x: v[0], u: Math.atan2(v[2], v[1]), y: v[1], z: v[2] });
  }
  let x0 = Infinity, x1 = -Infinity;
  for (const p of P) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; }
  const nbx = Math.max(1, Math.ceil((x1 - x0) / hx)), nbu = Math.max(3, Math.ceil(TWO_PI / hu));
  const bins = Array.from({ length: nbx * nbu }, () => []);
  const bx = (x) => Math.min(nbx - 1, Math.max(0, Math.floor(((x - x0) / (x1 - x0 || 1)) * nbx)));
  const bu = (u) => ((Math.floor(((u + Math.PI) / TWO_PI) * nbu) % nbu) + nbu) % nbu;
  P.forEach((p, i) => bins[bx(p.x) * nbu + bu(p.u)].push(i));

  /** K(x, u); returns 0 where the neighbourhood cannot support a quadratic. */
  function K(x, u) {
    const ix = bx(x), iu = bu(u);
    const M = Array.from({ length: 6 }, () => new Array(6).fill(0));
    const by = new Array(6).fill(0), bz = new Array(6).fill(0);
    const loc = [];
    let wsum = 0, sp2 = 0;
    let r0 = 0, rw = 0;
    for (let a = -1; a <= 1; a++) {
      const jx = ix + a; if (jx < 0 || jx >= nbx) continue;
      for (let c = -1; c <= 1; c++) {
        const ju = ((iu + c) % nbu + nbu) % nbu;
        for (const i of bins[jx * nbu + ju]) {
          const p = P[i];
          const dx = (p.x - x) / hx, du = wrap(p.u - u) / hu;
          const w = W(Math.hypot(dx, du));
          if (w <= 0) continue;
          const B = [1, dx, du, dx * dx, dx * du, du * du];
          for (let r = 0; r < 6; r++) {
            for (let s = 0; s < 6; s++) M[r][s] += w * B[r] * B[s];
            by[r] += w * B[r] * p.y; bz[r] += w * B[r] * p.z;
          }
          loc.push({ p, B, w, dx, du });
          r0 += w * Math.hypot(p.y, p.z); rw += w;
        }
      }
    }
    if (loc.length < 8 || rw <= 0) return 0;
    const cy = solve(M.map((r) => [...r]), by, 6), cz = solve(M.map((r) => [...r]), bz, 6);
    if (!cy || !cz) return 0;
    const rmean = r0 / rw;
    for (const { p, B, w, dx, du } of loc) {
      let fy = 0, fz = 0;
      for (let r = 0; r < 6; r++) { fy += cy[r] * B[r]; fz += cz[r] * B[r]; }
      wsum += w * ((fy - p.y) ** 2 + (fz - p.z) ** 2);
      const ax = dx * hx, au = rmean * du * hu;
      sp2 += w * (ax * ax + au * au);
    }
    const resid = Math.sqrt(wsum / rw), spread = Math.sqrt(sp2 / rw);
    return spread > 0 ? resid / spread : 0;
  }

  return { K, hx, hu, x0, x1, vertices: P.length };
}

/**
 * Ridge curves: local maxima of K along u at each x, linked across x.
 * `floor` is the FROZEN 0.05 evidence floor; `minSpan` is the persistence
 * parameter, re-expressed for this representation per spec 46.6A.
 */
export function extractRidges(field, { nx = 128, nu = 256, floor = 0.05, minSpan, linkTolSteps = 3 }) {
  const { K, x0, x1 } = field;
  const xs = Array.from({ length: nx }, (_, i) => x0 + ((x1 - x0) * i) / (nx - 1));
  const du = TWO_PI / nu;
  const peaks = [];                       // peaks[i] = [{u, k}]
  for (let i = 0; i < nx; i++) {
    const row = new Array(nu);
    for (let j = 0; j < nu; j++) row[j] = K(xs[i], -Math.PI + j * du);
    const pk = [];
    for (let j = 0; j < nu; j++) {
      const a = row[(j - 1 + nu) % nu], b = row[j], c = row[(j + 1) % nu];
      if (b >= floor && b >= a && b > c) {
        // parabolic refinement -> sub-grid u, so the ridge is not quantised
        const den = a - 2 * b + c;
        const off = Math.abs(den) > 1e-18 ? (0.5 * (a - c)) / den : 0;
        pk.push({ u: -Math.PI + (j + Math.max(-1, Math.min(1, off))) * du, k: b });
      }
    }
    peaks.push(pk);
  }
  // Link across x: nearest peak in u within linkTolSteps grid steps.
  //
  // SPEC 48: a PREDICTIVE variant was tried on the retired residual field and
  // is NOT banked. It was introduced after seeing the failure and made the
  // measured result worse (components 32->34, 64->68, 92->103). Bank the
  // measurement, not the intuition; the new detector starts clean.
  const tol = linkTolSteps * du;
  const used = peaks.map((p) => new Array(p.length).fill(false));
  const curves = [];
  for (let i = 0; i < nx; i++) {
    for (let a = 0; a < peaks[i].length; a++) {
      if (used[i][a]) continue;
      const cur = [{ i, u: peaks[i][a].u, k: peaks[i][a].k }];
      used[i][a] = true;
      let ci = i, cu2 = peaks[i][a].u;
      while (ci + 1 < nx) {
        let best = -1, bd = Infinity;
        for (let b = 0; b < peaks[ci + 1].length; b++) {
          if (used[ci + 1][b]) continue;
          const d = Math.abs(wrap(peaks[ci + 1][b].u - cu2));
          if (d < bd) { bd = d; best = b; }
        }
        if (best < 0 || bd > tol) break;
        used[ci + 1][best] = true;
        cur.push({ i: ci + 1, u: peaks[ci + 1][best].u, k: peaks[ci + 1][best].k });
        cu2 = peaks[ci + 1][best].u; ci++;
      }
      curves.push(cur);
    }
  }
  const kept = curves.filter((c) => c.length >= minSpan);
  return {
    curves: kept, allCurves: curves, xs,
    stats: {
      peakRows: peaks.reduce((s, p) => s + p.length, 0),
      components: curves.length, kept: kept.length,
      longest: curves.length ? Math.max(...curves.map((c) => c.length)) : 0,
      nx, nu, floor, minSpan,
    },
  };
}

/* ================================================================== */
/* TANGENT-JUMP FIELD — spec 48, frozen b4d84cf.                       */
/*                                                                     */
/* Measures the physical thing a chine IS: a discontinuity in surface   */
/* direction. The retired residual field measured "how badly does one   */
/* smooth model fit this neighbourhood", which detects a feature but    */
/* does not centre on it -- an even quadratic partly absorbs a centred  */
/* roof, so the residual DIPS on the crease and peaks either side.      */
/*                                                                     */
/* Here the surface is fitted INDEPENDENTLY on each side of the         */
/* candidate, both fits are extrapolated to the SAME candidate          */
/* location, and their Cartesian tangents are compared there. Smooth    */
/* surface -> the two converge. Crease -> they may disagree, by the     */
/* crease angle.                                                        */
/*                                                                     */
/* Spec 41.2: vertices and connectivity only.                           */
/* ================================================================== */

/**
 * dPsi(x, u) in RADIANS; NaN where either side cannot support a fit.
 * The `1/hu` scaling of the derivative is common to both sides and
 * cancels in the angle, so tangents are compared in raw coefficient form.
 */
/**
 * DETECTOR WINDOW, DERIVED NOT TUNED, AND DISTINCT FROM THE SKIN'S.
 *
 * The skin's frozen bandwidth is (cx, cu) = (2.5, 2.5) and is NOT changed by
 * this file. But a ONE-SIDED quadratic in du needs at least 3 distinct sample
 * columns on its own side, and a half-window of cu vertex spacings contains
 * about floor(cu) columns. Measured consequence of cu = 2.5: the narrow side
 * held 8 points spanning only 2 distinct du values, so [1, du, du^2] had rank
 * 2 and every evaluation returned NaN.
 *
 * cu = 3 is exactly determined; cu = 4 is the SMALLEST value that leaves the
 * one-sided quadratic over-determined, i.e. a least-squares fit rather than an
 * interpolation. That is an identifiability requirement derivable before any
 * result is looked at, not a value chosen because it produced a good answer.
 */
export function makeJumpField(verts, faces, { cx = 2.5, cu = 4.0, rMin = 1e-9, minSide = 8 } = {}) {
  const seen = new Set(), dxs = [], dus = [];
  for (const f of faces) {
    for (let e = 0; e < f.length; e++) {
      const a = f[e], b = f[(e + 1) % f.length];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const A = verts[a], B = verts[b];
      if (Math.hypot(A[1], A[2]) < rMin || Math.hypot(B[1], B[2]) < rMin) continue;
      dxs.push(Math.abs(B[0] - A[0]));
      dus.push(Math.abs(wrap(Math.atan2(B[2], B[1]) - Math.atan2(A[2], A[1]))));
    }
  }
  const med = (a) => { const z = a.filter((v) => v > 1e-12).sort((p, q) => p - q); return z.length ? z[Math.floor(z.length / 2)] : 0; };
  const hx = cx * med(dxs), hu = cu * med(dus);
  if (!(hx > 0) || !(hu > 0)) throw new Error('makeJumpField: degenerate mesh scale');

  const P = [];
  for (const v of verts) {
    const r = Math.hypot(v[1], v[2]);
    if (r < rMin) continue;
    P.push({ x: v[0], u: Math.atan2(v[2], v[1]), y: v[1], z: v[2] });
  }
  let x0 = Infinity, x1 = -Infinity;
  for (const p of P) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; }
  const nbx = Math.max(1, Math.ceil((x1 - x0) / hx)), nbu = Math.max(3, Math.ceil(TWO_PI / hu));
  const bins = Array.from({ length: nbx * nbu }, () => []);
  const bx = (x) => Math.min(nbx - 1, Math.max(0, Math.floor(((x - x0) / (x1 - x0 || 1)) * nbx)));
  const bu = (u) => ((Math.floor(((u + Math.PI) / TWO_PI) * nbu) % nbu) + nbu) % nbu;
  P.forEach((p, i) => bins[bx(p.x) * nbu + bu(p.u)].push(i));

  const stats = { undefinedEvals: 0, evals: 0 };

  /**
   * One-sided weighted fit; returns the du-tangent at the candidate.
   *
   * BASIS REDUCED TO [1, dx, du, du^2] AND WHY. The full six-term quadratic
   * used by the two-sided skin is NOT IDENTIFIABLE from a one-sided
   * neighbourhood: measured at x=0 on the burned chine the narrow side holds
   * 8 points spanning ~2 distinct du values, so the du^2 column is nearly
   * collinear with du and 1, the normal matrix is rank-deficient and every
   * evaluation returned NaN. Dropping dx^2 and dx*du costs nothing in the
   * extracted quantity: d/du at the candidate is `c_du + c_dxdu*dx`, and dx=0
   * there, so those terms never entered the answer. du^2 is RETAINED because
   * without it the curved side's curvature biases the boundary derivative.
   */
  const sideTangent = (pts) => {
    if (pts.length < minSide) return null;
    const M = Array.from({ length: 4 }, () => new Array(4).fill(0));
    const by = new Array(4).fill(0), bz = new Array(4).fill(0);
    for (const { dx, du, w, p } of pts) {
      const B = [1, dx, du, du * du];
      for (let r = 0; r < 4; r++) {
        for (let s = 0; s < 4; s++) M[r][s] += w * B[r] * B[s];
        by[r] += w * B[r] * p.y; bz[r] += w * B[r] * p.z;
      }
    }
    const cy = solve(M.map((r) => [...r]), by, 4), cz = solve(M.map((r) => [...r]), bz, 4);
    if (!cy || !cz) return null;
    const t = [cy[2], cz[2]];                      // d(y,z)/d(du) at the candidate
    const m = Math.hypot(t[0], t[1]);
    return m > 1e-14 ? [t[0] / m, t[1] / m] : null;
  };

  function J(x, u0) {
    stats.evals++;
    const ix = bx(x), iu = bu(u0);
    const neg = [], pos = [];
    for (let a = -1; a <= 1; a++) {
      const jx = ix + a; if (jx < 0 || jx >= nbx) continue;
      for (let c = -1; c <= 1; c++) {
        const ju = ((iu + c) % nbu + nbu) % nbu;
        for (const i of bins[jx * nbu + ju]) {
          const p = P[i];
          const dx = (p.x - x) / hx, duRaw = wrap(p.u - u0), du = duRaw / hu;
          const w = W(Math.hypot(dx, du));
          if (w <= 0 || duRaw === 0) continue;
          (duRaw < 0 ? neg : pos).push({ dx, du, w, p });
        }
      }
    }
    const tm = sideTangent(neg), tp = sideTangent(pos);
    stats.last = { neg: neg.length, pos: pos.length, tm: !!tm, tp: !!tp };
    if (!tm || !tp) { stats.undefinedEvals++; return NaN; }
    // both sides are parameterised in increasing u, so a smooth surface gives
    // tangents pointing the same way; no sign folding is applied
    const d = Math.max(-1, Math.min(1, tm[0] * tp[0] + tm[1] * tp[1]));
    return Math.acos(d);
  }

  return { J, hx, hu, x0, x1, vertices: P.length, stats };
}

/** Ridge extraction on the jump field. Identical linking to extractRidges. */
export function extractJumpRidges(field, { nx = 128, nu = 256, floorRad, minSpan = 1, linkTolSteps = 3 }) {
  const { J, x0, x1 } = field;
  const xs = Array.from({ length: nx }, (_, i) => x0 + ((x1 - x0) * i) / (nx - 1));
  const du = TWO_PI / nu;
  const peaks = [];
  for (let i = 0; i < nx; i++) {
    const row = new Array(nu);
    for (let j = 0; j < nu; j++) { const v = J(xs[i], -Math.PI + j * du); row[j] = Number.isNaN(v) ? 0 : v; }
    const pk = [];
    for (let j = 0; j < nu; j++) {
      const a = row[(j - 1 + nu) % nu], b = row[j], c = row[(j + 1) % nu];
      if (b >= floorRad && b >= a && b > c) {
        const den = a - 2 * b + c;
        const off = Math.abs(den) > 1e-18 ? (0.5 * (a - c)) / den : 0;
        pk.push({ u: -Math.PI + (j + Math.max(-1, Math.min(1, off))) * du, k: b });
      }
    }
    peaks.push(pk);
  }
  const tol = linkTolSteps * du;
  const used = peaks.map((p) => new Array(p.length).fill(false));
  const curves = [];
  for (let i = 0; i < nx; i++) {
    for (let a = 0; a < peaks[i].length; a++) {
      if (used[i][a]) continue;
      const cur = [{ i, u: peaks[i][a].u, k: peaks[i][a].k }];
      used[i][a] = true;
      let ci = i, cu2 = peaks[i][a].u;
      while (ci + 1 < nx) {
        let best = -1, bd = Infinity;
        for (let b = 0; b < peaks[ci + 1].length; b++) {
          if (used[ci + 1][b]) continue;
          const d = Math.abs(wrap(peaks[ci + 1][b].u - cu2));
          if (d < bd) { bd = d; best = b; }
        }
        if (best < 0 || bd > tol) break;
        used[ci + 1][best] = true;
        cur.push({ i: ci + 1, u: peaks[ci + 1][best].u, k: peaks[ci + 1][best].k });
        cu2 = peaks[ci + 1][best].u; ci++;
      }
      curves.push(cur);
    }
  }
  const kept = curves.filter((c) => c.length >= minSpan);
  return { curves: kept, allCurves: curves, xs, peaks,
    stats: { peakRows: peaks.reduce((s, p) => s + p.length, 0), components: curves.length,
      kept: kept.length, longest: curves.length ? Math.max(...curves.map((c) => c.length)) : 0 } };
}
