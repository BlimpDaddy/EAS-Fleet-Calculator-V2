/**
 * PHASE 2, EXPERIMENT 1 — spec 56, implemented as frozen.
 *
 * Does the interior ribbon representation (zones 1-5, the only zones 55.2
 * declared earned) resolve distinctions the PRODUCTION scalar cannot see?
 *
 * Baseline is production code, imported directly -- not reimplemented.
 * Nothing is fitted to anything. No Cd, no calibration.
 *
 * DECLARED LIMIT (56.4): distinguishing two bodies is NOT the same as
 * mattering aerodynamically. This measures information survival, nothing more.
 */
import { ZONES, ribbonMetrics } from './ribbons.mjs';
import { hullMesh, verifyOnSurface, PATTERNS, rng } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, STATIONS, TIP } from './support-skin.mjs';
import { measureSections, scoreSections } from '../../../site/calcv2/src/sections.js';
import { classifySections } from '../../../site/calcv2/src/cdEstimator.js';

const DEG = 180 / Math.PI, SEED = 12345, CANON = 24;
const RUNG = { sx: 0.005, thDeg: 2 };
const EARNED = [1, 2, 3, 4, 5];                     // 55.2 — and only these
const rays = Array.from({ length: 2 * CANON }, (_, k) => (Math.PI * (k % CANON)) / CANON + (k >= CANON ? Math.PI : 0));
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));

/* ---- 56.5 the frozen family. Convex for p in (0,1]: r is concave on each half. */
const P_VALUES = [0.4, 0.6, 0.8, 1.0];
const FINENESS = [3, 5];
const BODIES = [];
for (const f of FINENESS) for (const pf of P_VALUES) for (const pa of P_VALUES) {
  const R = 1, a = (f * 2 * R) / 2;
  BODIES.push({
    label: `f${f} pf${pf} pa${pa}`, f, pf, pa, a, R,
    r: (x) => { const u = x / a; if (Math.abs(u) >= 1) return 0;
      return R * Math.pow(1 - u * u, u < 0 ? pf : pa); },
  });
}

/* the production scalar wants a mesh; the ribbon path wants the same hull.
   BOTH SEE THE IDENTICAL HULL -- that is the whole point of the comparison. */
function cloudOf(body, pattern, n) {
  const oracle = (x, th) => body.r(x);
  return { oracle, pts: PATTERNS[pattern](oracle, body.a, n, SEED) };
}

function measureBoth(body, pattern, n) {
  const { oracle, pts } = cloudOf(body, pattern, n);
  if (!verifyOnSurface(oracle, pts).pass) throw new Error(`INPUT FAILURE ${body.label} ${pattern}`);
  const mesh = hullMesh(pts);

  /* --- production scalar, on the same hull */
  const m = measureSections(mesh.verts, mesh.faces, { axis: '+X' });
  const sc = scoreSections(m);
  const { cls } = classifySections(m, sc);

  /* --- ribbon path, on the same hull */
  const skin = makeSupportSkin(mesh.verts, mesh.faces, RUNG);
  const R = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
  for (let i = 0; i < STATIONS; i++) {
    const got = supportRadii(skin, i, rays);
    for (let k = 0; k < rays.length; k++) R[k][i] = got.r[k];
  }
  const met = R.map((rib) => ribbonMetrics(rib, 2 * body.a, { tipFrac: TIP }));
  const zones = Array.from({ length: ZONES }, (_, z) => {
    const v = met.map((q) => q.zones[z].abs * DEG).sort((p, q) => p - q);
    return v[Math.floor(v.length / 2)];
  });
  return { proxy: sc.compositeV1, cls, zones };
}

/** 56.6 ribbon distance: max absolute per-zone difference over the EARNED zones. */
const ribbonDist = (A, B) => Math.max(...EARNED.map((z) => Math.abs(A.zones[z] - B.zones[z])));

console.log('\nSPEC 56 — PHASE 2 EXPERIMENT 1: does the interior ribbon resolve what the scalar cannot?');
console.log('  baseline: production measureSections/scoreSections/classifySections, imported directly.');
console.log(`  ribbon domain: zones ${EARNED.join(',')} only (55.2 earned domain). Nothing is fitted.\n`);

/* ---- STEP 1: measure each representation's OWN tessellation noise (56.6) */
const NOISE_PATTERNS = ['fibonacci', 'lathe', 'random'];
let sigScalar = 0, sigRibbon = 0, sigScalarAt = '', sigRibbonAt = '';
let classFlip = 0;
for (const body of BODIES) {
  const reps = NOISE_PATTERNS.map((p) => measureBoth(body, p, 12000));
  const proxies = reps.map((r) => r.proxy);
  const sp = Math.max(...proxies) - Math.min(...proxies);
  if (sp > sigScalar) { sigScalar = sp; sigScalarAt = body.label; }
  for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
    const d = ribbonDist(reps[a], reps[b]);
    if (d > sigRibbon) { sigRibbon = d; sigRibbonAt = body.label; }
  }
  if (new Set(reps.map((r) => r.cls)).size > 1) classFlip++;
}
console.log('  STEP 1 — each representation measured against its OWN tessellation noise:');
console.log(`    sigma_scalar  = ${sigScalar.toExponential(3)}   (worst body: ${sigScalarAt})`);
console.log(`    sigma_ribbon  = ${sigRibbon.toFixed(4)} deg   (worst body: ${sigRibbonAt})`);
console.log(`    bodies whose binary class flips across tessellations: ${classFlip} / ${BODIES.length}`);

/* ---- STEP 2: the 32-body grid, one canonical sampling each */
const M = BODIES.map((b) => ({ body: b, ...measureBoth(b, 'fibonacci', 12000) }));
const proxies = M.map((q) => q.proxy);
console.log(`\n  STEP 2 — 32-body grid. compositeV1 range ${Math.min(...proxies).toFixed(5)} .. ${Math.max(...proxies).toFixed(5)}` +
  `   classes: ${M.filter((q) => q.cls === 'pinned').length} pinned / ${M.filter((q) => q.cls === 'rounded').length} rounded`);

/* ---- STEP 3: pair analysis, both directions (56.7) */
let blindResolved = [], ribbonBlindScalarResolved = 0, pairs = 0;
for (let a = 0; a < M.length; a++) for (let b = a + 1; b < M.length; b++) {
  pairs++;
  const dScalar = Math.abs(M[a].proxy - M[b].proxy);
  const dRibbon = ribbonDist(M[a], M[b]);
  const scalarBlind = dScalar <= sigScalar && M[a].cls === M[b].cls;
  const ribbonBlind = dRibbon <= sigRibbon;
  if (scalarBlind && !ribbonBlind) blindResolved.push({ a: M[a], b: M[b], dScalar, dRibbon });
  if (ribbonBlind && dScalar > sigScalar) ribbonBlindScalarResolved++;
}
blindResolved.sort((p, q) => q.dRibbon - p.dRibbon);

console.log(`\n  STEP 3 — all ${pairs} pairs:`);
console.log(`    scalar-blind AND ribbon-resolved : ${blindResolved.length}`);
console.log(`    ribbon-blind AND scalar-resolved : ${ribbonBlindScalarResolved}   (required by 56.7 — the other direction)`);

if (blindResolved.length) {
  console.log('\n    largest margins — the scalar cannot separate these; the ribbons can:');
  console.log('      body A                body B                 d(scalar)     vs noise    d(ribbon)   vs noise');
  for (const p of blindResolved.slice(0, 8)) {
    console.log(`      ${p.a.body.label.padEnd(20)}  ${p.b.body.label.padEnd(20)}  ${p.dScalar.toExponential(2)}   ` +
      `${(p.dScalar / sigScalar).toFixed(2)}x      ${p.dRibbon.toFixed(3)} deg   ${(p.dRibbon / sigRibbon).toFixed(1)}x`);
  }
  const top = blindResolved[0];
  console.log(`\n    per-zone turning of the widest pair (deg), zones 1-5:`);
  console.log(`      ${top.a.body.label.padEnd(20)} ` + EARNED.map((z) => top.a.zones[z].toFixed(2).padStart(7)).join(''));
  console.log(`      ${top.b.body.label.padEnd(20)} ` + EARNED.map((z) => top.b.zones[z].toFixed(2).padStart(7)).join(''));
  console.log(`      ${'difference'.padEnd(20)} ` + EARNED.map((z) => (top.a.zones[z] - top.b.zones[z]).toFixed(2).padStart(7)).join(''));
}

console.log('\n' + '='.repeat(100));
console.log(`  ${blindResolved.length ? 'PASS' : 'FAIL'} — ${blindResolved.length
  ? `${blindResolved.length} of ${pairs} pairs carry information the production scalar destroys.`
  : 'no pair is scalar-blind and ribbon-resolved; ribbons add no resolvable information. Phase 2 stops.'}`);
console.log('  56.4 DECLARED LIMIT: this shows information SURVIVES, not that it predicts drag.');
console.log('='.repeat(100) + '\n');
