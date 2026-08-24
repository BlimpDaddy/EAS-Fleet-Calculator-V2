/**
 * PHASE 1C CORRUPTION GENERATORS + VERIFICATION GATE (2026-08-20)
 *
 * Four deterministic ways to rearrange WHERE a mesh samples a surface,
 * without changing the surface. Every vertex is placed by choosing (x,
 * theta) and then evaluating r = rFn(x, theta), so it lies on the exact
 * analytic body BY CONSTRUCTION. The gate below verifies that rather than
 * trusting it.
 *
 * Ribbons are infinitesimally thin, so what these corrupt is the facet
 * arrangement the zero-width cutting plane passes through -- never a
 * ribbon "width", which does not exist.
 *
 * No fitting here. No corpus. Gate only.
 */
const hash = (i, j, k) => {
  const v = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

/** Shared skeleton: strength 0 must reproduce analyticBody exactly. */
function build(rFn, halfLen, nx, nt, place) {
  const verts = [], faces = [], ring = [];
  for (let i = 0; i <= nx; i++) {
    const xr = -halfLen + (2 * halfLen * i) / nx;
    if (Math.max(0, rFn(xr, 0)) < 1e-9) { ring.push(verts.push([xr, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let j = 0; j < nt; j++) {
      const tip = (i === 0 || i === nx);
      const { x, th } = place(i, j, xr, (2 * Math.PI * j) / nt, tip);
      const r = Math.max(0, rFn(x, th));          // EXACTLY on the surface
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
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

export const GENERATORS = {
  /** G1 sine-hash jitter — scatter each vertex within its own cell. */
  sineJitter: (rFn, H, nx, nt, s) => build(rFn, H, nx, nt, (i, j, xr, th, tip) => ({
    x: xr + (tip ? 0 : s * (2 * H / nx) * hash(i, j, 1)),
    th: th + s * (2 * Math.PI / nt) * hash(i, j, 2),
  })),

  /** G2 block density — alternating fine/coarse axial bands, rings intact. */
  blockDensity: (rFn, H, nx, nt, s) => build(rFn, H, nx, nt, (i, j, xr, th, tip) => {
    const u = (xr + H) / (2 * H);
    const warp = u + s * 0.5 * Math.sin(2 * Math.PI * 4 * u) / (2 * Math.PI * 4);
    return { x: tip ? xr : -H + 2 * H * Math.min(1, Math.max(0, warp)), th };
  }),

  /** G3 azimuthal shear — theta drifts with x, so rings stop lining up. */
  azimuthalShear: (rFn, H, nx, nt, s) => build(rFn, H, nx, nt, (i, j, xr, th) => ({
    x: xr, th: th + s * (2 * Math.PI / nt) * 6 * ((xr + H) / (2 * H)),
  })),

  /** G4 surface random-walk — cumulative deterministic drift along the surface. */
  surfaceWalk: (rFn, H, nx, nt, s) => {
    const wx = [], wt = [];
    for (let j = 0; j < nt; j++) { wx[j] = 0; wt[j] = 0; }
    const rows = [];
    for (let i = 0; i <= nx; i++) {
      const row = [];
      for (let j = 0; j < nt; j++) {
        wx[j] += 0.35 * hash(i, j, 3); wt[j] += 0.35 * hash(i, j, 4);
        row.push([wx[j], wt[j]]);
      }
      rows.push(row);
    }
    return build(rFn, H, nx, nt, (i, j, xr, th, tip) => ({
      x: xr + (tip ? 0 : s * (2 * H / nx) * Math.max(-1, Math.min(1, rows[i][j][0]))),
      th: th + s * (2 * Math.PI / nt) * Math.max(-1, Math.min(1, rows[i][j][1])),
    }));
  },
};

/**
 * GATE: vertices must lie on the exact surface; strength 0 must reproduce the
 * reference to within FLOATING-POINT ROUND-OFF.
 *
 * SPEC 38 AMENDMENT (frozen e64eb4f, verifier only). Check (a) previously
 * demanded exact bit-identity, which IEEE-754 cannot deliver: `blockDensity`
 * reaches the same axial position by a different arithmetic path, so the last
 * bit differs. The bound below is DERIVED FROM THE ARITHMETIC, not fitted to
 * the observed discrepancy -- counting rounding events in the longest
 * strength-0 coordinate chain gives ~9-10, each at most half an ulp of an
 * intermediate no larger than the body's span, and 16 = 2^4 is a power-of-two
 * headroom over that count. It would be the same number had the observed
 * discrepancy been zero.
 *
 * Check (b) -- every vertex on the analytic surface within 1e-9 -- is
 * UNCHANGED.
 */
export function verifyGenerator(name, rFn, H, nx, nt, reference) {
  const problems = [];
  // (a) zero corruption reproduces the reference mesh to within round-off
  const z = GENERATORS[name](rFn, H, nx, nt, 0);
  let span = 0;
  for (let k = 0; k < 3; k++) {
    let lo = Infinity, hi = -Infinity;
    for (const v of reference.verts) { if (v[k] < lo) lo = v[k]; if (v[k] > hi) hi = v[k]; }
    span = Math.max(span, hi - lo);
  }
  const tolIdentical = 16 * Number.EPSILON * (span > 0 ? span : 1);
  if (z.verts.length !== reference.verts.length) problems.push(`vert count ${z.verts.length} vs ${reference.verts.length}`);
  else {
    let worst = 0;
    for (let i = 0; i < z.verts.length; i++)
      for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(z.verts[i][k] - reference.verts[i][k]));
    if (worst > tolIdentical) problems.push(`strength 0 differs from reference by ${worst.toExponential(2)} > ${tolIdentical.toExponential(2)}`);
  }
  // (b) at every strength, every vertex lies on the analytic surface
  let worstOff = 0;
  for (const s of [0.25, 0.5, 1.0]) {
    const m = GENERATORS[name](rFn, H, nx, nt, s);
    for (const [x, y, zz] of m.verts) {
      const rr = Math.hypot(y, zz);
      if (rr < 1e-12) continue;
      const want = rFn(x, Math.atan2(zz, y));
      worstOff = Math.max(worstOff, Math.abs(rr - want));
    }
  }
  if (worstOff > 1e-9) problems.push(`vertices off-surface by up to ${worstOff.toExponential(2)}`);
  return { pass: problems.length === 0, problems, worstOff };
}
