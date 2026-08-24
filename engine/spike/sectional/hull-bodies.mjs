/**
 * QUICKHULL TRANSFER EXPERIMENT — INPUT CONSTRUCTION. Spec 52.2.
 *
 * Analytic convex bodies -> point clouds -> the VENDORED PRODUCTION QuickHull.
 * Nothing here reconstructs, fits or measures; it only builds inputs and
 * proves they are valid inputs.
 *
 * `Math.random` is PROHIBITED by 52.2. Every pattern draws from a seeded
 * deterministic generator so the whole experiment is reproducible.
 */
import quickhull from '../../../site/calcv2/vendor/quickhull3d.js';

const TWO_PI = Math.PI * 2;

/** Deterministic PRNG — mulberry32. Seeded per pattern, never Math.random. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ellipsoid oracle, spec 52.2. Prolate spheroid is By = Bz.
 * r(x, th) = sqrt( (1 - x^2/A^2) / (cos^2/By^2 + sin^2/Bz^2) )
 */
export function ellipsoidOracle({ A, By, Bz }) {
  return (x, th) => {
    const k = 1 - (x / A) ** 2;
    if (k <= 0) return 0;
    const c = Math.cos(th), s = Math.sin(th);
    return Math.sqrt(k / ((c * c) / (By * By) + (s * s) / (Bz * Bz)));
  };
}

/** Surface point at (x, th) in the body frame: flight = X, up = +Y. */
const surfacePoint = (oracle, x, th) => {
  const r = oracle(x, th);
  return [x, r * Math.cos(th), r * Math.sin(th)];
};

/**
 * Signed deviation of a point from the analytic surface, as a fraction of the
 * local radius. Zero for a point exactly on it. Used to prove inputs valid
 * (52.2) and to measure hull inscription (52.4).
 */
export function surfaceDeviation(oracle, p) {
  const th = Math.atan2(p[2], p[1]);
  const r = Math.hypot(p[1], p[2]);
  const want = oracle(p[0], th);
  return want > 1e-12 ? (r - want) / want : 0;
}

/* ------------------------------------------------------------------ */
/* THE FIVE SAMPLING PATTERNS — spec 52.2                             */
/* ------------------------------------------------------------------ */
/**
 * All patterns place points EXACTLY on the analytic surface by evaluating the
 * oracle; none perturbs a point off it. The axial endpoints are included so
 * the hull closes at the tips rather than being truncated.
 */
export const PATTERNS = {
  /** P1 — lathe rings. The old topology, now hulled. */
  lathe(oracle, A, n) {
    const nx = Math.max(6, Math.round(Math.sqrt(n / 2)));
    const nt = Math.max(6, Math.round(n / nx));
    const pts = [];
    for (let i = 0; i < nx; i++) {
      const x = -A + (2 * A * i) / (nx - 1);
      for (let j = 0; j < nt; j++) pts.push(surfacePoint(oracle, x, (TWO_PI * j) / nt));
    }
    return pts;
  },

  /** P2 — Fibonacci spiral. Quasi-uniform, no rings anywhere. */
  fibonacci(oracle, A, n) {
    const gold = Math.PI * (3 - Math.sqrt(5));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (2 * i) / (n - 1) - 1;      // -1 .. 1
      pts.push(surfacePoint(oracle, u * A, i * gold));
    }
    return pts;
  },

  /** P3 — uniform random in (x, th), seeded. */
  random(oracle, A, n, seed) {
    const r = rng(seed);
    const pts = [surfacePoint(oracle, -A, 0), surfacePoint(oracle, A, 0)];
    for (let i = pts.length; i < n; i++) pts.push(surfacePoint(oracle, (2 * r() - 1) * A, r() * TWO_PI));
    return pts;
  },

  /** P4 — density-graded: deliberately biased forward, x ~ -A + 2A*u^2. */
  graded(oracle, A, n, seed) {
    const r = rng(seed);
    const pts = [surfacePoint(oracle, -A, 0), surfacePoint(oracle, A, 0)];
    for (let i = pts.length; i < n; i++) {
      const u = r();
      pts.push(surfacePoint(oracle, -A + 2 * A * u * u, r() * TWO_PI));
    }
    return pts;
  },

  /** P5 — jittered lathe at 0.4, the family that has broken most things. */
  jitteredLathe(oracle, A, n, seed) {
    const r = rng(seed);
    const nx = Math.max(6, Math.round(Math.sqrt(n / 2)));
    const nt = Math.max(6, Math.round(n / nx));
    const dth = TWO_PI / nt;
    const pts = [];
    for (let i = 0; i < nx; i++) {
      const x = -A + (2 * A * i) / (nx - 1);
      for (let j = 0; j < nt; j++) pts.push(surfacePoint(oracle, x, j * dth + 0.4 * dth * (2 * r() - 1)));
    }
    return pts;
  },
};

/* ------------------------------------------------------------------ */
/* HULL CONSTRUCTION                                                   */
/* ------------------------------------------------------------------ */
/**
 * Point cloud -> production QuickHull -> mesh of HULL POINTS ONLY, re-indexed.
 *
 * 52.2: production passes the full vertex array alongside hull faces, which is
 * inert for `axisExtents` / `projectedFrontalArea` / `faceAreaSum` but is NOT
 * inert for a surface fit -- interior points would pull the fit off the hull.
 * The interior points are therefore dropped here, deliberately and visibly.
 */
export function hullMesh(points) {
  const faces = quickhull(points);
  const seen = new Set();
  for (const f of faces) for (const i of f) seen.add(i);
  const idx = [...seen].sort((a, b) => a - b);
  const remap = new Map(idx.map((v, k) => [v, k]));
  return {
    verts: idx.map((i) => points[i]),
    faces: faces.map((f) => f.map((i) => remap.get(i))),
    inputPoints: points.length,
    interiorDropped: points.length - idx.length,
  };
}

/**
 * INPUT VALIDATION, spec 52.2: every sampled point exactly on the analytic
 * surface. A sampling bug must be an INPUT failure, never a result.
 */
export function verifyOnSurface(oracle, points, tol = 1e-12) {
  let worst = 0;
  for (const p of points) worst = Math.max(worst, Math.abs(surfaceDeviation(oracle, p)));
  return { pass: worst < tol, worst };
}

export const BODIES = [
  { label: 'prolate spheroid', A: 3, By: 1, Bz: 1 },
  { label: 'triaxial ellipsoid', A: 3, By: 1, Bz: 0.6 },
];
export const DENSITIES = [600, 2500, 12000];
export const PATTERN_ORDER = ['lathe', 'fibonacci', 'random', 'graded', 'jitteredLathe'];
