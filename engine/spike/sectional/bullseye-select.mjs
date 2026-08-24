/**
 * SPEC 54 — BULLSEYE LADDER ASCENT. 54.4 / 54.5.
 *
 * Smallest epsilon in {1%, 2%, 5%} satisfying G1-G4. If 5% fails, THE GUARD
 * FAILS: no further levels, no substitute mechanism (54.4).
 *
 * RUNG: the support skin is built at k=1 (sigma_x = 0.005 L, sigma_theta =
 * 2 deg). SPEC 54 DID NOT STATE THE RUNG -- recorded here as a gap in the
 * freeze and resolved deliberately: k=1 is the smallest declared scale and is
 * exactly where 53.10.4 measured the failure this guard responds to. A larger
 * rung would confound the guard with additional low-pass filtering.
 *
 * Authorised spec 52 analytic QuickHull families only. No EAS geometry. The
 * independent chine is not touched.
 */
import { ribbonMetrics, ZONES } from './ribbons.mjs';
import { BODIES, DENSITIES, PATTERN_ORDER, PATTERNS, ellipsoidOracle, hullMesh, verifyOnSurface } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, supportPolygon, reflexCount, reflexSelfTest, STATIONS, TIP } from './support-skin.mjs';
import { guardedMetrics, LADDER } from './bullseye.mjs';

const DEG = 180 / Math.PI, SEED = 12345, CANON = 24;
const RUNG = { sx: 0.005, thDeg: 2 };
const TOL = { zonePct: 0.02, zoneDeg: 0.5 };          // spec 21, verbatim
const rays = Array.from({ length: 2 * CANON }, (_, k) => (Math.PI * (k % CANON)) / CANON + (k >= CANON ? Math.PI : 0));
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));

/* ---- correctness preconditions, before any result is emitted ---- */
const st = reflexSelfTest();
console.log('\nSPEC 54 — BULLSEYE DERIVATIVE GUARD: LADDER ASCENT');
console.log(`  reflex self-test: ${st.ok ? 'TRUSTWORTHY' : 'BROKEN'}   (support skin at k=1)`);
if (!st.ok) process.exit(1);

/* build every representation once; POSITIONS ARE COMPUTED ONCE AND SHARED
   ACROSS ALL EPSILON VALUES, which is how G4 is guaranteed by construction
   rather than asserted */
const REPS = [];
for (const body of BODIES) {
  const oracle = ellipsoidOracle(body);
  for (const n of DENSITIES) for (const pat of PATTERN_ORDER) {
    const pts = PATTERNS[pat](oracle, body.A, n, SEED);
    if (!verifyOnSurface(oracle, pts).pass) throw new Error(`INPUT FAILURE ${pat} n=${n}`);
    const mesh = hullMesh(pts);
    const skin = makeSupportSkin(mesh.verts, mesh.faces, RUNG);
    let Rmax = 0;
    for (let i = i0; i <= i1; i++) for (const th of [0, Math.PI / 2]) Rmax = Math.max(Rmax, oracle(skin.xs[i], th));
    const R = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
    let reflexStations = 0, multi = 0;
    for (let i = 0; i < STATIONS; i++) {
      const got = supportRadii(skin, i, rays);
      for (let k = 0; k < rays.length; k++) R[k][i] = got.r[k];
      if (i >= i0 && i <= i1) {
        multi += got.multi;
        if (reflexCount(supportPolygon(skin.H[i], skin.naz), Rmax).count > 0) reflexStations++;
      }
    }
    REPS.push({ body, oracle, pat, n, label: `${pat} n=${n}`, R, Rmax, L: 2 * body.A, reflexStations, multi });
  }
}

/* ---- G4 / correctness: unguarded guardedMetrics must reproduce ribbonMetrics */
{
  let worstZone = 0, worstTurn = 0;
  for (const rep of REPS) for (const rib of rep.R) {
    const a = ribbonMetrics(rib, rep.L, { tipFrac: TIP });
    const b = guardedMetrics(rib, rep.L, { tipFrac: TIP, eps: null });
    worstTurn = Math.max(worstTurn, Math.abs(a.absTurn - b.absTurn), Math.abs(a.netTurn - b.netTurn));
    for (let z = 0; z < ZONES; z++) worstZone = Math.max(worstZone, Math.abs(a.zones[z].abs - b.zones[z].abs));
  }
  console.log(`  unguarded guardedMetrics vs frozen ribbonMetrics: max difference ${Math.max(worstZone, worstTurn).toExponential(1)} ` +
    `${Math.max(worstZone, worstTurn) === 0 ? '(IDENTICAL)' : '*** DIVERGENT ***'}`);
  if (Math.max(worstZone, worstTurn) !== 0) process.exit(1);
}
console.log('  G1 selection runs on ALL FIFTEEN representations per body, n=600 INCLUDED.\n');

function zoneProfile(rep, eps) {
  const met = rep.R.map((rib) => guardedMetrics(rib, rep.L, { tipFrac: TIP, eps }));
  return {
    zones: Array.from({ length: ZONES }, (_, z) => {
      const v = met.map((m) => m.zones[z].abs * DEG).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    }),
    falseTurn: Math.max(...met.map((m) => (m.absTurn - Math.abs(m.netTurn)) * DEG)),
    usable: met[0].usable, offered: met[0].offered,
    xFore: met.map((m) => m.xCloseFore), xAft: met.map((m) => m.xCloseAft),
  };
}

function g1(reps, eps) {
  const prof = reps.map((r) => zoneProfile(r, eps));
  const perZone = Array.from({ length: ZONES }, () => ({ worst: 0, at: '' }));
  for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
    for (let z = 0; z < ZONES; z++) {
      const A = prof[a].zones[z], B = prof[b].zones[z];
      const lim = Math.max(TOL.zonePct * Math.max(A, B), TOL.zoneDeg);
      const ratio = Math.abs(A - B) / lim;
      if (ratio > perZone[z].worst) { perZone[z].worst = ratio; perZone[z].at = `${reps[a].label} vs ${reps[b].label}`; }
    }
  }
  return { perZone, prof, pass: perZone.every((p) => p.worst <= 1) };
}

let selected = null;
for (const eps of [null, ...LADDER]) {
  const tag = eps === null ? 'UNGUARDED (baseline)' : `epsilon = ${(100 * eps).toFixed(0)}%`;
  console.log('='.repeat(100));
  console.log(`  ${tag}`);
  let allPass = true;
  for (const body of BODIES) {
    const reps = REPS.filter((r) => r.body === body);
    const { perZone, prof, pass } = g1(reps, eps);
    console.log(`\n    ${body.label}  —  worst cross-representation zone-turning, as a ratio of its limit:`);
    console.log('      zone      0      1      2      3      4      5      6      7');
    console.log('      ratio ' + perZone.map((p) => p.worst.toFixed(2).padStart(6)).join(' ') +
      `    ${pass ? 'G1 PASS' : 'G1 FAIL'}`);
    const ft = Math.max(...prof.map((p) => p.falseTurn));
    const stationsUsed = prof.map((p) => p.usable);
    console.log(`      false turning worst ${ft.toFixed(3)} deg | stations used ${Math.min(...stationsUsed)}-${Math.max(...stationsUsed)} of ${prof[0].offered}` +
      ` | nonconvex ${reps.reduce((a, r) => a + r.reflexStations, 0)} | multi ${reps.reduce((a, r) => a + r.multi, 0)}`);
    if (!pass) {
      const bad = perZone.map((p, z) => ({ z, ...p })).filter((p) => p.worst > 1);
      for (const b of bad) console.log(`      zone ${b.z} worst ${b.worst.toFixed(2)}x — ${b.at}`);
      allPass = false;
    }
  }
  if (eps === null) { console.log('\n  baseline recorded; ascending the ladder.'); continue; }
  console.log(`\n  epsilon ${(100 * eps).toFixed(0)}%: ${allPass ? 'ALL CRITERIA PASS' : 'not clean, ascend'}`);
  if (allPass) { selected = eps; break; }
}

/* ---- x_close spread: OBSERVATION ONLY, never a criterion (54.5) */
if (selected !== null) {
  console.log('\n  x_close cross-representation spread — OBSERVATION ONLY, NOT A CRITERION:');
  for (const body of BODIES) {
    const reps = REPS.filter((r) => r.body === body);
    const prof = reps.map((r) => zoneProfile(r, selected));
    const fore = prof.flatMap((p) => p.xFore), aft = prof.flatMap((p) => p.xAft);
    console.log(`    ${body.label.padEnd(20)} fore station ${Math.min(...fore)}..${Math.max(...fore)}   aft station ${Math.min(...aft)}..${Math.max(...aft)}  (of ${i0}..${i1})`);
  }
}

console.log('\n' + '='.repeat(100));
if (selected !== null) {
  console.log(`  BULLSEYE SELECTED: epsilon = ${(100 * selected).toFixed(0)}% of each ribbon's own maximum radius.`);
  console.log('  Chosen on authorised analytic QuickHull families only. No EAS geometry inspected.');
} else {
  console.log('  NO EPSILON THROUGH 5% SATISFIES 54.5 — per 54.4 THE GUARD FAILS.');
  console.log('  No further levels are added and no substitute mechanism is introduced.');
}
console.log('='.repeat(100) + '\n');
