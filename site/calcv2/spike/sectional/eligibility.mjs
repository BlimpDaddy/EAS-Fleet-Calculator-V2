/**
 * RIBBON ELIGIBILITY GATE — spec 51, implemented exactly as frozen.
 *
 * Answers ONE question: did the ribbon pipeline run WELL-POSED on this mesh,
 * over the retained domain, without silently forcing anything?
 *
 *   51.2 ELIGIBLE MEANS WELL-POSED. IT DOES NOT MEAN CORRECT.
 *
 * There is no analytic oracle for a supplied mesh, so nothing here measures
 * accuracy. Every criterion is well-posedness or self-consistency. A caller
 * that reads ELIGIBLE as "validated" is misreading the gate.
 *
 * NO REPAIR IS ATTEMPTED ANYWHERE IN THIS FILE. On any failure the gate
 * reports the failing condition and its location and stops.
 *
 * TWO IMPLEMENTATION DECISIONS, RECORDED RATHER THAN BURIED:
 *
 * 1. THE SKIN IS BUILT DETECTOR-FREE (`features: null`). Spec 50 retired the
 *    detector family and 51.9 forbids detector work, so the gate must not
 *    depend on `detectFeatureCurvesV2`. Spec 42 established that the
 *    partitioning was INERT, so this should not move the Gate 1 numbers --
 *    and if it does, that is itself a reportable result.
 *
 * 2. E5 USES `makeJumpField` AS A MAGNITUDE STATISTIC ONLY. That is the
 *    BANKED observable of spec 48/50 (45.61 deg measured against 45.573 deg
 *    analytic), not the retired detector. No linking, no span filter, no
 *    completion, no merging, no tracing -- none of 42-50 is re-entered. It
 *    answers "is a feature present", never "where is the curve".
 */
import { ribbonMetrics, ZONES } from './ribbons.mjs';
import { meshScale, makeSkin, skinRadii } from './skin.mjs';
import { makeJumpField } from './ridge.mjs';

const DEG = 180 / Math.PI;

/* ---------------- 51.3 RETAINED DOMAIN — carried forward, not re-derived */
export const STATIONS = 128;          // 4.5
export const TIP = 0.025;             // 4.7
export const NU = 256;                // skin section density, as Gate 1 / Gate 2
export const PLANES = [12, 24, 48];   // 5 / 6 convergence test, NOT hyperparameters

/* ---------------- 51.4 frozen criterion constants */
export const E4_SHIFT = 0.05;                              // spec 6, verbatim
export const E5_SELECT_LADDER_DEG = [10, 15, 20];          // 51.4 ascent, starts at 10
export const E5_REPORT_LADDER_DEG = [3, 5, 7.5, 10, 15, 20];
export const E5_GRID = { nx: STATIONS, nu: 256 };

/** Station grid over the mesh's own axial extent (general; for the analytic
 *  controls x0 = -A, x1 = +A, so this reproduces `stationGrid` exactly). */
export function stations(x0, x1, n = STATIONS) {
  return Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
}
export function retainedRange(n = STATIONS, tip = TIP) {
  return [Math.ceil(tip * (n - 1)), Math.floor((1 - tip) * (n - 1))];
}

/* ------------------------------------------------------------------ */
/* E3 — INPUT VALIDATION                                              */
/* ------------------------------------------------------------------ */
/**
 * 36.4: invalid or self-intersecting inputs are INPUT failures, NOT
 * reconstruction failures. This routes them to a THIRD outcome so they can
 * never fall through to either eligibility answer.
 *
 * KNOWN HOLE, DECLARED: a full self-intersection test is NOT implemented.
 * Non-manifold, open, degenerate-face and degenerate-scale meshes are caught;
 * a closed manifold that passes through itself is not. Recorded, not papered
 * over.
 */
export function validateInput(verts, faces) {
  const problems = [];
  if (!Array.isArray(verts) || verts.length < 4) problems.push(`fewer than 4 vertices (${verts ? verts.length : 0})`);
  if (!Array.isArray(faces) || faces.length < 4) problems.push(`fewer than 4 faces (${faces ? faces.length : 0})`);
  if (problems.length) return { ok: false, problems, selfIntersection: 'NOT TESTED' };

  for (const v of verts) {
    if (!Array.isArray(v) || v.length < 3 || v.some((c) => !Number.isFinite(c))) {
      problems.push('non-finite or malformed vertex');
      break;
    }
  }

  // degenerate (zero-area) faces, and face index validity
  let degenerate = 0, badIndex = 0;
  for (const f of faces) {
    if (f.some((i) => !Number.isInteger(i) || i < 0 || i >= verts.length)) { badIndex++; continue; }
    if (new Set(f).size < 3) { degenerate++; continue; }
    const [a, b, c] = [verts[f[0]], verts[f[1]], verts[f[2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
    if (!(n > 1e-15)) degenerate++;
  }
  if (badIndex) problems.push(`${badIndex} face(s) with out-of-range vertex index`);
  if (degenerate) problems.push(`${degenerate} degenerate (zero-area) face(s)`);

  // manifoldness: every undirected edge must be shared by exactly 2 faces
  const inc = new Map();
  for (const f of faces) {
    for (let e = 0; e < f.length; e++) {
      const a = f[e], b = f[(e + 1) % f.length];
      if (a === b) continue;
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      inc.set(k, (inc.get(k) || 0) + 1);
    }
  }
  let boundary = 0, nonManifold = 0;
  for (const c of inc.values()) { if (c === 1) boundary++; else if (c > 2) nonManifold++; }
  if (nonManifold) problems.push(`${nonManifold} non-manifold edge(s) (shared by >2 faces)`);
  if (boundary) problems.push(`${boundary} boundary edge(s) — surface is not closed`);

  // degenerate mesh scale — the same quantity `makeSkin` refuses to build on
  let scale = null;
  try {
    scale = meshScale(verts, faces);
    if (!(scale.dx > 0) || !(scale.du > 0)) problems.push(`degenerate mesh scale (dx=${scale.dx}, du=${scale.du})`);
  } catch (e) {
    problems.push(`mesh scale failed: ${e.message}`);
  }

  return { ok: problems.length === 0, problems, scale, boundary, nonManifold, degenerate,
    selfIntersection: 'NOT TESTED' };
}

/* ------------------------------------------------------------------ */
/* E5 — SHARP-FEATURE PRESENCE, MAGNITUDE ONLY                        */
/* ------------------------------------------------------------------ */
/**
 * Count retained-domain evaluation windows whose tangent jump exceeds each
 * ladder value. NO linking, NO span filter, NO completion, NO merging, NO
 * tracing (51.4).
 *
 * NaN means the one-sided fit was not identifiable at that window, not that
 * a feature is absent. It is counted and REPORTED separately, and is treated
 * as "no feature" for the count -- identical to the convention already used
 * by `jump-sweep-full.mjs`.
 */
export function jumpCounts(verts, faces, ladderDeg = E5_REPORT_LADDER_DEG) {
  const field = makeJumpField(verts, faces);
  const { nx, nu } = E5_GRID;
  const xs = stations(field.x0, field.x1, nx);
  const [i0, i1] = retainedRange(nx);
  const du = (2 * Math.PI) / nu;
  const counts = new Map(ladderDeg.map((d) => [d, 0]));
  let nan = 0, evals = 0, maxDeg = 0, maxAt = null;
  for (let i = i0; i <= i1; i++) {
    for (let j = 0; j < nu; j++) {
      const u = -Math.PI + j * du;
      const v = field.J(xs[i], u);
      evals++;
      if (Number.isNaN(v)) { nan++; continue; }
      const d = v * DEG;
      if (d > maxDeg) { maxDeg = d; maxAt = { x: xs[i], uDeg: u * DEG }; }
      for (const t of ladderDeg) if (d > t) counts.set(t, counts.get(t) + 1);
    }
  }
  return { counts, nan, evals, maxDeg, maxAt, nanFrac: evals ? nan / evals : 0 };
}

/* ------------------------------------------------------------------ */
/* THE GATE                                                           */
/* ------------------------------------------------------------------ */
/**
 * @param e5ThresholdDeg  the value SELECTED by the 51.4 rule on known-good
 *                        controls and FROZEN before any validation body is
 *                        evaluated. Pass null to run E1-E4 only (the
 *                        registered fallback if E5 fails as a criterion).
 */
export function evaluate(verts, faces, { e5ThresholdDeg = null, label = '' } = {}) {
  const R = { label, outcome: null, E1: null, E2: null, E3: null, E4: null, E5: null };

  /* ---- E3 first: an invalid input is an INPUT FAILURE, never an
     eligibility answer. This ordering IS the criterion. */
  const input = validateInput(verts, faces);
  R.E3 = { pass: input.ok, ...input };
  if (!input.ok) { R.outcome = 'INPUT FAILURE'; return R; }

  let skin;
  try {
    skin = makeSkin(verts, faces, { features: null });   // detector-free, per the header note
  } catch (e) {
    R.E3 = { pass: false, problems: [`makeSkin: ${e.message}`], selfIntersection: 'NOT TESTED' };
    R.outcome = 'INPUT FAILURE';
    return R;
  }

  const xs = stations(skin.x0, skin.x1);
  const [i0, i1] = retainedRange();
  const L = skin.x1 - skin.x0;

  /* ---- E2 + the ribbon fields for E4. Every evaluation performed here is a
     retained-domain evaluation, which is what E1 then reads. */
  const perCount = [];
  for (const p of PLANES) {
    const rays = Array.from({ length: 2 * p }, (_, k) => (Math.PI * (k % p)) / p + (k >= p ? Math.PI : 0));
    const Rk = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
    let multi = 0, missed = 0;
    const sites = [];
    for (let i = i0; i <= i1; i++) {
      const got = skinRadii(skin, xs[i], rays, NU);
      for (let k = 0; k < rays.length; k++) Rk[k][i] = got.r[k];
      if (got.multi || got.missed) sites.push({ x: xs[i], multi: got.multi, missed: got.missed });
      multi += got.multi; missed += got.missed;
    }
    perCount.push({ planes: p, rays: rays.length, multi, missed, sites, R: Rk });
  }

  /* E1/E2 read ONLY the retained domain (51.3), so their statistics are
     snapshotted here, before the tip stations are touched. */
  const s = { ...skin.stats };

  /* The tip stations are then filled in for `ribbonMetrics` ALONE. Its 3%
     symmetric secant (4.6) is a PHYSICAL span and reaches ~2 stations beyond
     the retained boundary; leaving those zero fabricates an enormous false
     slope at the first and last retained station. Gate 1 and Gate 2 both
     evaluate all 128 stations and let `ribbonMetrics` do the restricting.
     Evaluating only the retained band was NARROWER THAN THE FROZEN OPERATOR. */
  for (const c of perCount) {
    const rays = Array.from({ length: c.rays }, (_, k) => (Math.PI * (k % (c.planes))) / c.planes + (k >= c.planes ? Math.PI : 0));
    for (let i = 0; i < STATIONS; i++) {
      if (i >= i0 && i <= i1) continue;
      const got = skinRadii(skin, xs[i], rays, NU);
      for (let k = 0; k < rays.length; k++) c.R[k][i] = got.r[k];
    }
  }

  R.E2 = {
    pass: perCount.every((c) => c.multi === 0 && c.missed === 0),
    byCount: perCount.map((c) => ({ planes: c.planes, multi: c.multi, missed: c.missed })),
    firstSite: perCount.flatMap((c) => c.sites)[0] || null,
  };

  /* ---- E1: every retained-domain evaluation used the intended quadratic
     fit. `linear` counts as a failure alongside `nearest` and `empty`: all
     three are the same event, the intended fit was unavailable and something
     else was substituted (51.4 rationale). */
  R.E1 = {
    pass: s.nearest + s.empty + s.linear === 0,
    quadratic: s.quadratic, linear: s.linear, nearest: s.nearest, empty: s.empty,
    total: s.quadratic + s.linear + s.nearest + s.empty,
    hx: s.hx, huDeg: s.hu * DEG, vertices: s.vertices, poles: s.poles,
  };

  /* ---- E4: spec 6 convergence, 12/24/48, carried forward unchanged.
     10 forbids collapsing the ribbons, so median, worst and spread are all
     reported. The CRITERION is on the median: increasing the ray count
     strictly enlarges the sampled set, so the worst ribbon is monotone by
     construction and cannot be a convergence test. Worst and spread are
     reported as required diagnostics. */
  const profile = perCount.map((c) => {
    const met = c.R.map((rib) => ribbonMetrics(rib, L, { tipFrac: TIP }));
    const zones = Array.from({ length: ZONES }, (_, z) => {
      const vals = met.map((m) => m.zones[z].abs * DEG).sort((a, b) => a - b);
      const worst = Math.max(...vals);
      return {
        median: vals[Math.floor(vals.length / 2)],
        worst,
        worstRibbon: met.findIndex((m) => m.zones[z].abs * DEG === worst),
        spread: worst - vals[0],
      };
    });
    return { planes: c.planes, zones };
  });

  const rel = (a, b) => {
    const m = Math.max(Math.abs(a), Math.abs(b));
    return m < 1e-9 ? 0 : Math.abs(a - b) / m;
  };
  let worstShift = 0, worstShiftAt = null;
  for (let q = 0; q + 1 < profile.length; q++) {
    for (let z = 0; z < ZONES; z++) {
      const d = rel(profile[q].zones[z].median, profile[q + 1].zones[z].median);
      if (d > worstShift) {
        worstShift = d;
        worstShiftAt = { pair: `${profile[q].planes}->${profile[q + 1].planes}`, zone: z,
          a: profile[q].zones[z].median, b: profile[q + 1].zones[z].median };
      }
    }
  }
  R.E4 = { pass: worstShift < E4_SHIFT, worstShift, worstShiftAt, profile,
    secondResolution: 'NOT EVALUATED (51.4 known gap — single supplied mesh)' };

  /* ---- E5: presence, not geometry. */
  if (e5ThresholdDeg === null) {
    R.E5 = { pass: true, applied: false,
      note: 'E5 NOT APPLIED — no frozen threshold supplied (registered E1-E4 fallback)' };
  } else {
    let jc = null, err = null;
    try { jc = jumpCounts(verts, faces, [e5ThresholdDeg]); }
    catch (e) { err = e.message; }
    if (err) {
      R.E3 = { pass: false, problems: [`makeJumpField: ${err}`], selfIntersection: 'NOT TESTED' };
      R.outcome = 'INPUT FAILURE';
      return R;
    }
    const n = jc.counts.get(e5ThresholdDeg);
    R.E5 = { pass: n === 0, applied: true, thresholdDeg: e5ThresholdDeg, count: n,
      maxDeg: jc.maxDeg, maxAt: jc.maxAt, nan: jc.nan, nanFrac: jc.nanFrac, evals: jc.evals };
  }

  R.outcome = (R.E1.pass && R.E2.pass && R.E3.pass && R.E4.pass && R.E5.pass) ? 'ELIGIBLE' : 'INELIGIBLE';
  R.failed = ['E1', 'E2', 'E3', 'E4', 'E5'].filter((k) => !R[k].pass);
  return R;
}
