/**
 * QUICKHULL TRANSFER EXPERIMENT — MEASUREMENT. Spec 52.
 *
 * Do the Gate 1 smooth-skin results transfer from LATHE topology to the
 * QuickHull polyhedra production actually feeds the estimator?
 *
 * Pipeline UNCHANGED (52.3). Tolerances carried forward verbatim (52.4).
 * Convexity reported, never gated (52.4). Hull inscription measured as an
 * INPUT property so a positional failure can be attributed (52.4).
 *
 * No EAS mesh. No independent chine. No bandwidth change.
 */
import { ribbonMetrics, ZONES } from './ribbons.mjs';
import { makeSkin, skinSection } from './skin.mjs';
import { chainContour } from './ribbons-contour.mjs';
import { sectionSegments } from './ribbons-section.mjs';
import { BODIES, DENSITIES, PATTERN_ORDER, PATTERNS, ellipsoidOracle, hullMesh, verifyOnSurface } from './hull-bodies.mjs';
import { reflexCount, reflexSelfTest } from './support-skin.mjs';

const DEG = 180 / Math.PI;
const STATIONS = 128, TIP = 0.025, NU = 256, SEED = 12345;
const PLANES = [12, 24, 48], CANON = 24;
/** FROZEN, spec 21 — carried forward, not re-derived. */
const TOL = { rms: 0.005, p99: 0.015, turnMax: 0.5, turnMed: 0.1, shift: 0.05, zonePct: 0.02, zoneDeg: 0.5 };

const raysOf = (p) => Array.from({ length: 2 * p }, (_, k) => (Math.PI * (k % p)) / p + (k >= p ? Math.PI : 0));
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));

/**
 * Ray intersection of a closed transverse polyline — verbatim inner loop of
 * the frozen `skinRadii`, hoisted so one section serves all three ray counts.
 * Asserted identical to `skinRadii` before any result is emitted.
 */
function raysOnLoop(pts, rays) {
  const n = pts.length, r = new Array(rays.length).fill(0);
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

/** Reflex depth, corrected and self-tested. See support-skin.mjs. */
const reflex = (pts, Rmax) => reflexCount(pts, Rmax);

/** The hull's OWN radius at (x, theta) — the frozen RAW path. 52.4 inscription. */
function rawRadii(mesh, x, rays) {
  const { segs } = sectionSegments(mesh.verts, mesh.faces, x);
  if (segs.length < 3) return null;
  const c = chainContour(segs);
  if (!c.ok) return null;
  return raysOnLoop(c.loop, rays).r;
}

function errStats(R, xs, oracle, rays, Rmax) {
  const errs = [];
  for (let i = i0; i <= i1; i++) {
    for (let k = 0; k < rays.length; k++) {
      if (R[k][i] === null) continue;
      errs.push(Math.abs(R[k][i] - oracle(xs[i], rays[k])) / Rmax);
    }
  }
  errs.sort((a, b) => a - b);
  return {
    rms: Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length),
    p99: errs[Math.min(errs.length - 1, Math.floor(0.99 * errs.length))],
  };
}

function measure(mesh, oracle, A, features) {
  const skin = makeSkin(mesh.verts, mesh.faces, { features });
  const xs = Array.from({ length: STATIONS }, (_, i) => -A + (2 * A * i) / (STATIONS - 1));
  let Rmax = 0;
  for (let i = i0; i <= i1; i++) for (const th of [0, Math.PI / 2]) Rmax = Math.max(Rmax, oracle(xs[i], th));

  const byCount = new Map(PLANES.map((p) => [p, {
    rays: raysOf(p), R: Array.from({ length: 2 * p }, () => new Array(STATIONS).fill(0)), multi: 0, missed: 0,
  }]));
  let reflexStations = 0, reflexWorst = 0;

  for (let i = i0; i <= i1; i++) {
    const pts = skinSection(skin, xs[i], NU);          // ONE section serves all ray counts
    const rf = reflex(pts, Rmax);
    if (rf.worst > 1e-6) reflexStations++;
    if (rf.worst > reflexWorst) reflexWorst = rf.worst;
    for (const [, c] of byCount) {
      const got = raysOnLoop(pts, c.rays);
      for (let k = 0; k < c.rays.length; k++) c.R[k][i] = got.r[k];
      c.multi += got.multi; c.missed += got.missed;
    }
  }
  /* Diagnostics above are RETAINED-DOMAIN ONLY, so the fit statistics are
     snapshotted before the tips are touched. */
  const fitRetained = { quadratic: skin.stats.quadratic, linear: skin.stats.linear,
    nearest: skin.stats.nearest, empty: skin.stats.empty };

  /* The tip stations are filled in for `ribbonMetrics` ALONE. Its 3% symmetric
     secant (4.6) is a PHYSICAL span reaching ~2 stations past the retained
     boundary; leaving those zero fabricates an enormous false slope at the
     first and last retained station. Gate 1 and Gate 2 both evaluate all 128
     stations and let `ribbonMetrics` restrict. */
  for (let i = 0; i < STATIONS; i++) {
    if (i >= i0 && i <= i1) continue;
    const pts = skinSection(skin, xs[i], NU);
    for (const [, c] of byCount) {
      const got = raysOnLoop(pts, c.rays);
      for (let k = 0; k < c.rays.length; k++) c.R[k][i] = got.r[k];
    }
  }

  const L = 2 * A;
  const profile = PLANES.map((p) => {
    const c = byCount.get(p);
    const met = c.R.map((rib) => ribbonMetrics(rib, L, { tipFrac: TIP }));
    const ft = met.map((m) => (m.absTurn - Math.abs(m.netTurn)) * DEG).sort((a, b) => a - b);
    return {
      planes: p,
      turnMax: ft[ft.length - 1], turnMed: ft[Math.floor(ft.length / 2)],
      zones: Array.from({ length: ZONES }, (_, z) => {
        const v = met.map((m) => m.zones[z].abs * DEG).sort((a, b) => a - b);
        return { median: v[Math.floor(v.length / 2)], worst: v[v.length - 1], spread: v[v.length - 1] - v[0] };
      }),
    };
  });

  const rel = (a, b) => { const m = Math.max(Math.abs(a), Math.abs(b)); return m < 1e-9 ? 0 : Math.abs(a - b) / m; };
  let shift = 0;
  for (let q = 0; q + 1 < profile.length; q++) for (let z = 0; z < ZONES; z++) {
    shift = Math.max(shift, rel(profile[q].zones[z].median, profile[q + 1].zones[z].median));
  }

  const canon = byCount.get(CANON);
  const pos = errStats(canon.R, xs, oracle, canon.rays, Rmax);
  const s = { ...fitRetained, hu: skin.stats.hu, hx: skin.stats.hx };
  return {
    pos, profile, shift, Rmax, xs, R: canon.R, rays: canon.rays,
    multi: [...byCount.values()].reduce((a, c) => a + c.multi, 0),
    missed: [...byCount.values()].reduce((a, c) => a + c.missed, 0),
    reflexStations, reflexWorst, retained: i1 - i0 + 1,
    fit: fitRetained,
    huDeg: s.hu * DEG, hx: s.hx,
    turnMax: profile.find((p) => p.planes === CANON).turnMax,
    turnMed: profile.find((p) => p.planes === CANON).turnMed,
  };
}

/* ------------------------------------------------------------------ */
console.log('\nSPEC 52 — QUICKHULL TRANSFER EXPERIMENT');
console.log('Analytic convex bodies -> point clouds -> VENDORED PRODUCTION QuickHull -> unchanged skin/ribbon path.');
console.log(`Tolerances carried forward verbatim: RMS <= ${100 * TOL.rms}% Rmax, p99 <= ${100 * TOL.p99}% Rmax,`);
console.log(`false turning <= ${TOL.turnMax}/${TOL.turnMed} deg, convergence < ${100 * TOL.shift}%.\n`);

/* verify the hoisted intersector is identical to the frozen skinRadii */
{
  const { skinRadii } = await import('./skin.mjs');
  const b = BODIES[0], oracle = ellipsoidOracle(b);
  const m = hullMesh(PATTERNS.fibonacci(oracle, b.A, 2500, SEED));
  const skin = makeSkin(m.verts, m.faces, { features: null });
  const rays = raysOf(CANON);
  let worst = 0;
  for (const x of [-2, -1, 0, 1, 2]) {
    const a = skinRadii(skin, x, rays, NU), c = raysOnLoop(skinSection(skin, x, NU), rays);
    for (let k = 0; k < rays.length; k++) worst = Math.max(worst, Math.abs(a.r[k] - c.r[k]));
  }
  console.log(`  hoisted intersector vs frozen skinRadii: max difference ${worst.toExponential(1)} ${worst === 0 ? '(IDENTICAL)' : '*** DIVERGENT ***'}\n`);
  if (worst !== 0) process.exit(1);
}

const FEATURES = { kinkThreshold: 0.05, minEdges: 24 };
const CONFIGS = [['features:null', null], ['features:FEATURES (Gate 1 config)', FEATURES]];

for (const body of BODIES) {
  const oracle = ellipsoidOracle(body);
  console.log('='.repeat(112));
  console.log(`BODY: ${body.label}  A=${body.A} By=${body.By} Bz=${body.Bz}`);

  /* build every representation once */
  const reps = [];
  for (const n of DENSITIES) for (const pat of PATTERN_ORDER) {
    const pts = PATTERNS[pat](oracle, body.A, n, SEED);
    const v = verifyOnSurface(oracle, pts);
    if (!v.pass) { console.log(`  INPUT FAILURE ${pat} n=${n}: ${v.worst}`); continue; }
    reps.push({ label: `${pat} n=${n}`, pat, n, mesh: hullMesh(pts), onSurface: v.worst });
  }

  for (const [cfgLabel, features] of CONFIGS) {
    console.log(`\n  --- ${cfgLabel} ---`);
    console.log('  representation          hullV     hu     HULL rms/p99 (input)   SKIN rms     p99     turn max/med   conv   verdict');
    for (const rep of reps) {
      const M = measure(rep.mesh, oracle, body.A, features);
      rep[features ? 'mF' : 'mN'] = M;
      const rays = raysOf(CANON);
      const RAW = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(null));
      for (let i = i0; i <= i1; i++) {
        const got = rawRadii(rep.mesh, M.xs[i], rays);
        if (got) for (let k = 0; k < rays.length; k++) RAW[k][i] = got[k];
      }
      const insc = errStats(RAW, M.xs, oracle, rays, M.Rmax);
      const pass = M.pos.rms <= TOL.rms && M.pos.p99 <= TOL.p99 && M.turnMax <= TOL.turnMax
        && M.turnMed <= TOL.turnMed && M.shift < TOL.shift;
      rep[features ? 'passF' : 'passN'] = pass;
      console.log(`  ${rep.label.padEnd(22)} ${String(rep.mesh.verts.length).padStart(6)} ${M.huDeg.toFixed(2).padStart(6)}  ` +
        `${(100 * insc.rms).toFixed(3).padStart(7)}%/${(100 * insc.p99).toFixed(3).padStart(6)}%   ` +
        `${(100 * M.pos.rms).toFixed(3).padStart(7)}% ${(100 * M.pos.p99).toFixed(3).padStart(7)}% ` +
        `${M.turnMax.toFixed(3).padStart(8)}/${M.turnMed.toFixed(3).padStart(6)} ${(100 * M.shift).toFixed(2).padStart(6)}%  ${pass ? 'PASS' : 'FAIL'}`);
    }

    /* fit fallbacks + convexity, per 52.4 */
    console.log('\n    fit fallbacks over the retained domain, and CONVEXITY (reported, NOT gated):');
    for (const rep of reps) {
      const M = rep[features ? 'mF' : 'mN'];
      console.log(`      ${rep.label.padEnd(22)} quad ${String(M.fit.quadratic).padStart(7)} lin ${String(M.fit.linear).padStart(6)} ` +
        `near ${String(M.fit.nearest).padStart(6)} empty ${String(M.fit.empty).padStart(5)}  multi ${String(M.multi).padStart(5)} missed ${String(M.missed).padStart(5)}  ` +
        `nonconvex ${String(M.reflexStations).padStart(4)}/${M.retained} worst ${(100 * M.reflexWorst).toFixed(4)}%`);
    }

    /* cross-representation agreement — the oracle-free criterion, ALL PAIRS */
    console.log('\n    CROSS-REPRESENTATION AGREEMENT — all pairs, worst reported (52.4):');
    let wRms = 0, wP99 = 0, wZone = 0, wRmsAt = '', wZoneAt = '';
    for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
      const A = reps[a][features ? 'mF' : 'mN'], B = reps[b][features ? 'mF' : 'mN'];
      const errs = [];
      for (let i = i0; i <= i1; i++) for (let k = 0; k < A.rays.length; k++) {
        errs.push(Math.abs(A.R[k][i] - B.R[k][i]) / A.Rmax);
      }
      errs.sort((p, q) => p - q);
      const rms = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
      const p99 = errs[Math.floor(0.99 * errs.length)];
      if (rms > wRms) { wRms = rms; wRmsAt = `${reps[a].label} vs ${reps[b].label}`; }
      if (p99 > wP99) wP99 = p99;
      const pa = A.profile.find((p) => p.planes === CANON), pb = B.profile.find((p) => p.planes === CANON);
      for (let z = 0; z < ZONES; z++) {
        const d = Math.abs(pa.zones[z].median - pb.zones[z].median);
        const lim = Math.max(TOL.zonePct * Math.max(pa.zones[z].median, pb.zones[z].median), TOL.zoneDeg);
        const ratio = d / lim;
        if (ratio > wZone) { wZone = ratio; wZoneAt = `${reps[a].label} vs ${reps[b].label}, zone ${z} (${pa.zones[z].median.toFixed(3)} vs ${pb.zones[z].median.toFixed(3)} deg)`; }
      }
    }
    const pairs = (reps.length * (reps.length - 1)) / 2;
    const xPass = wRms <= TOL.rms && wP99 <= TOL.p99 && wZone <= 1;
    console.log(`      ${pairs} pairs.  worst RMS ${(100 * wRms).toFixed(3)}% (limit ${100 * TOL.rms}%)   worst p99 ${(100 * wP99).toFixed(3)}% (limit ${100 * TOL.p99}%)`);
    console.log(`      worst RMS pair: ${wRmsAt}`);
    console.log(`      worst zone-turning: ${(100 * wZone).toFixed(1)}% of its limit — ${wZoneAt}`);
    console.log(`      CROSS-REPRESENTATION: ${xPass ? 'PASS' : 'FAIL'}`);

    const nFail = reps.filter((r) => !r[features ? 'passF' : 'passN']).length;
    console.log(`\n    ${cfgLabel}: per-representation ${reps.length - nFail}/${reps.length} PASS; cross-representation ${xPass ? 'PASS' : 'FAIL'}`);
  }
}
console.log('\n' + '='.repeat(112) + '\n');
