/**
 * SPEC 53 — FIXED-GRID CONVEX-HULL SKINNING: LADDER ASCENT. 53.6 / 53.7.
 *
 * Smallest declared resolution k satisfying EVERY criterion. Test k=1 first
 * and ascend. If k=5 fails, THE ARCHITECTURE FAILS (53.8).
 *
 * Measured on the already-authorised spec 52 QuickHull families only: two
 * convex analytic bodies, five sampling patterns, three densities. No EAS
 * mesh. The independent chine is not touched. The adversarial `graded` family
 * is a CONVERGENCE TEST here, not a repair target -- no pattern receives
 * special handling of any kind.
 */
import { ribbonMetrics, ZONES } from './ribbons.mjs';
import { BODIES, DENSITIES, PATTERN_ORDER, PATTERNS, ellipsoidOracle, hullMesh, verifyOnSurface } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, supportPolygon, reflexCount, reflexSelfTest, LADDER, STATIONS, TIP } from './support-skin.mjs';

const DEG = 180 / Math.PI, SEED = 12345;
const PLANES = [12, 24, 48], CANON = 24;
/** FROZEN — spec 21 / spec 6, carried forward verbatim (53.7). */
const TOL = { rms: 0.005, p99: 0.015, turnMax: 0.5, turnMed: 0.1, shift: 0.05, zonePct: 0.02, zoneDeg: 0.5 };
const raysOf = (p) => Array.from({ length: 2 * p }, (_, k) => (Math.PI * (k % p)) / p + (k >= p ? Math.PI : 0));
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));

function measure(mesh, oracle, A, rung) {
  const skin = makeSupportSkin(mesh.verts, mesh.faces, { sx: rung.sx, thDeg: rung.thDeg });
  let Rmax = 0;
  for (let i = i0; i <= i1; i++) for (const th of [0, Math.PI / 2]) Rmax = Math.max(Rmax, oracle(skin.xs[i], th));

  const byCount = new Map(PLANES.map((p) => [p, {
    rays: raysOf(p), R: Array.from({ length: 2 * p }, () => new Array(STATIONS).fill(0)), multi: 0, missed: 0,
  }]));
  let reflexStations = 0, reflexWorst = 0;

  for (let i = 0; i < STATIONS; i++) {
    const retained = i >= i0 && i <= i1;
    if (retained) {
      const rf = reflexCount(supportPolygon(skin.H[i], skin.naz), Rmax);
      if (rf.count > 0) reflexStations++;
      if (rf.worst > reflexWorst) reflexWorst = rf.worst;
    }
    for (const [, c] of byCount) {
      const got = supportRadii(skin, i, c.rays);
      for (let k = 0; k < c.rays.length; k++) c.R[k][i] = got.r[k];
      if (retained) { c.multi += got.multi; c.missed += got.missed; }
    }
  }

  const L = 2 * A;
  const profile = PLANES.map((p) => {
    const c = byCount.get(p);
    const met = c.R.map((rib) => ribbonMetrics(rib, L, { tipFrac: TIP }));
    const ft = met.map((m) => (m.absTurn - Math.abs(m.netTurn)) * DEG).sort((a, b) => a - b);
    return {
      planes: p, turnMax: ft[ft.length - 1], turnMed: ft[Math.floor(ft.length / 2)],
      zones: Array.from({ length: ZONES }, (_, z) => {
        const v = met.map((m) => m.zones[z].abs * DEG).sort((a, b) => a - b);
        return { median: v[Math.floor(v.length / 2)], worst: v[v.length - 1], spread: v[v.length - 1] - v[0] };
      }),
    };
  });
  const rel = (a, b) => { const m = Math.max(Math.abs(a), Math.abs(b)); return m < 1e-9 ? 0 : Math.abs(a - b) / m; };
  let shift = 0;
  for (let q = 0; q + 1 < profile.length; q++) for (let z = 0; z < ZONES; z++) shift = Math.max(shift, rel(profile[q].zones[z].median, profile[q + 1].zones[z].median));

  const canon = byCount.get(CANON);
  const errs = [];
  for (let i = i0; i <= i1; i++) for (let k = 0; k < canon.rays.length; k++) {
    errs.push(Math.abs(canon.R[k][i] - oracle(skin.xs[i], canon.rays[k])) / Rmax);
  }
  errs.sort((a, b) => a - b);
  const cur = profile.find((p) => p.planes === CANON);
  return {
    rms: Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length),
    p99: errs[Math.floor(0.99 * errs.length)],
    turnMax: cur.turnMax, turnMed: cur.turnMed, shift, profile,
    R: canon.R, rays: canon.rays, Rmax, xs: skin.xs,
    multi: canon.multi, missed: canon.missed, reflexStations, reflexWorst, retained: i1 - i0 + 1,
  };
}

/* ---- C6 precondition: the convexity test must be trustworthy (52.7.4) */
const st = reflexSelfTest();
console.log('\nSPEC 53 — FIXED-GRID CONVEX-HULL SKINNING: LADDER ASCENT');
console.log(`  reflex self-test: CCW circle ${st.ccwCircle}, CW circle ${st.cwCircle}, dented circle ${st.dentedCircle} -> ${st.ok ? 'TRUSTWORTHY' : 'BROKEN'}`);
if (!st.ok) { console.log('  convexity test is broken; no result emitted.'); process.exit(1); }
console.log('  criteria: C1 invariance (all pairs), C2 refinement cannot worsen, C3 fidelity, C4 turning, C5 convergence, C6 convexity==0\n');

/* ---- build every representation once, shared across all rungs */
const REPS = [];
for (const body of BODIES) {
  const oracle = ellipsoidOracle(body);
  for (const n of DENSITIES) for (const pat of PATTERN_ORDER) {
    const pts = PATTERNS[pat](oracle, body.A, n, SEED);
    const v = verifyOnSurface(oracle, pts);
    if (!v.pass) throw new Error(`INPUT FAILURE ${pat} n=${n}: ${v.worst}`);
    REPS.push({ body, oracle, pat, n, label: `${pat} n=${n}`, mesh: hullMesh(pts) });
  }
}

let selected = null;
for (const rung of LADDER) {
  console.log('='.repeat(104));
  console.log(`  k=${rung.k}:  sigma_x = ${rung.sx} L,  sigma_theta = ${rung.thDeg} deg`);
  const results = new Map();
  for (const rep of REPS) results.set(rep, measure(rep.mesh, rep.oracle, rep.body.A, rung));

  let allPass = true;
  for (const body of BODIES) {
    const reps = REPS.filter((r) => r.body === body);
    console.log(`\n    ${body.label}`);
    console.log('      representation             rms      p99    turn max/med   conv   multi  nonconvex');
    for (const rep of reps) {
      const M = results.get(rep);
      console.log(`      ${rep.label.padEnd(22)} ${(100 * M.rms).toFixed(3).padStart(7)}% ${(100 * M.p99).toFixed(3).padStart(7)}% ` +
        `${M.turnMax.toFixed(3).padStart(7)}/${M.turnMed.toFixed(3).padStart(6)} ${(100 * M.shift).toFixed(2).padStart(6)}% ${String(M.multi).padStart(6)} ` +
        `${String(M.reflexStations).padStart(5)}/${M.retained}`);
    }

    /* C3/C4/C5/C6 per representation */
    const bad = reps.filter((r) => { const M = results.get(r);
      return M.rms > TOL.rms || M.p99 > TOL.p99 || M.turnMax > TOL.turnMax || M.turnMed > TOL.turnMed
        || M.shift >= TOL.shift || M.reflexStations > 0; });
    /* C2 refinement cannot make it worse: finest density lowest RMS, per pattern */
    const c2bad = PATTERN_ORDER.filter((pat) => {
      const byN = DENSITIES.map((n) => results.get(reps.find((r) => r.pat === pat && r.n === n)).rms);
      return !(byN[2] <= byN[1] && byN[2] <= byN[0]);
    });
    /* C1 invariance: all pairs, worst */
    let wRms = 0, wP99 = 0, wZone = 0, wAt = '';
    for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
      const A = results.get(reps[a]), B = results.get(reps[b]);
      const e = [];
      for (let i = i0; i <= i1; i++) for (let k = 0; k < A.rays.length; k++) e.push(Math.abs(A.R[k][i] - B.R[k][i]) / A.Rmax);
      e.sort((p, q) => p - q);
      const rms = Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length);
      if (rms > wRms) { wRms = rms; wAt = `${reps[a].label} vs ${reps[b].label}`; }
      wP99 = Math.max(wP99, e[Math.floor(0.99 * e.length)]);
      const pa = A.profile.find((p) => p.planes === CANON), pb = B.profile.find((p) => p.planes === CANON);
      for (let z = 0; z < ZONES; z++) {
        const lim = Math.max(TOL.zonePct * Math.max(pa.zones[z].median, pb.zones[z].median), TOL.zoneDeg);
        wZone = Math.max(wZone, Math.abs(pa.zones[z].median - pb.zones[z].median) / lim);
      }
    }
    const c1 = wRms <= TOL.rms && wP99 <= TOL.p99 && wZone <= 1;
    console.log(`      C1 invariance: worst RMS ${(100 * wRms).toFixed(3)}% p99 ${(100 * wP99).toFixed(3)}% zone ${(100 * wZone).toFixed(1)}% of limit -> ${c1 ? 'PASS' : 'FAIL'}  (${wAt})`);
    console.log(`      C2 refinement: ${c2bad.length ? `FAIL on ${c2bad.join(', ')}` : 'PASS'}`);
    console.log(`      C3-C6 per representation: ${bad.length ? `FAIL on ${bad.map((r) => r.label).join(', ')}` : `PASS on all ${reps.length}`}`);
    if (!c1 || c2bad.length || bad.length) allPass = false;
  }

  console.log(`\n  k=${rung.k}: ${allPass ? 'ALL CRITERIA PASS' : 'not clean, ascend'}`);
  if (allPass) { selected = rung; break; }
}

console.log('\n' + '='.repeat(104));
if (selected) {
  console.log(`  DECLARED RESOLUTION SELECTED: k=${selected.k}  (sigma_x = ${selected.sx} L, sigma_theta = ${selected.thDeg} deg)`);
  console.log('  Selected on authorised analytic QuickHull families only. No EAS geometry was inspected.');
} else {
  console.log('  NO RUNG THROUGH k=5 SATISFIES 53.7 — per 53.8 the ARCHITECTURE FAILS. No sixth rung is added.');
}
console.log('='.repeat(104) + '\n');
