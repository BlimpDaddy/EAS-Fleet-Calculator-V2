/**
 * SPIKE 2 TEST BATTERY (2026-08-15, Toby's go) — the four questions the
 * 9/9 raw pass did NOT answer:
 *   [A] CALIBRATION on the PRESSURE basis (anchor pressure = published
 *       total − ITTC friction for that shape), sphere round-trip to 0.47,
 *       held-out sanity. (Answers "does the sphere line up with 0.47?")
 *   [B] The saturation defect: teardrop f2/f3/f4 must SEPARATE and order
 *       under the soft closure term. (Answers "how can a teardrop be 0?")
 *   [C] Mathematical invariants: scale, translation, mesh density,
 *       sharp-cut sanity, tail-growth monotonicity, direction symmetry.
 *   [D] Discretisation: station-count convergence (Toby's infinite-slices
 *       intuition, measured) + cross-grid resolution stability.
 * Run from CalcV2: `node spike/sectional/battery.mjs`
 */
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf, NU_M2_S } from '../../src/dynamicsCore.js';
import { makeSphere, makeCube, makePlate, makeTeardrop, makeEllipsoid, makeChoppedTeardrop } from '../flow-chamber/shapes.mjs';
import { measureSections, scoreSections } from './sections.mjs';

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));

const score = (mesh, opts = {}) => scoreSections(measureSections(mesh.verts, mesh.faces, opts));
const proxyOf = (mesh, opts = {}) => score(mesh, opts).compositeV1;

/* Reference condition for anchor friction: 100 m body at 100 km/h (declared;
 * the published anchor Cds are broad-regime numbers — ±50% covers this). */
const V = 100 / 3.6, LEN = 100;
function frictionCd(mesh) {
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: LEN });
  const re = (V * LEN) / NU_M2_S;
  return ittcCf(re) * (g.wettedArea / g.frontalArea);
}

/* ---------------- [B] first: the soft term must fix the saturation ---- */
console.log('[B] soft closure term: streamlined family separates and orders');
const td = { f2: makeTeardrop(2), f3: makeTeardrop(3), f4: makeTeardrop(4) };
const sTd = { f2: score(td.f2), f3: score(td.f3), f4: score(td.f4) };
for (const k of ['f2', 'f3', 'f4']) console.log(`  teardrop ${k}: softAft ${f3(sTd[k].softAft)} (hard base ${f3(sTd[k].aftBaseFrac)})`);
check('no more flat zero: every teardrop softAft > 0', Object.values(sTd).every((s) => s.softAft > 0.005));
check('family orders f4 < f3 < f2 (longer tail = better)',
  sTd.f4.softAft < sTd.f3.softAft && sTd.f3.softAft < sTd.f2.softAft,
  `${f3(sTd.f4.softAft)} < ${f3(sTd.f3.softAft)} < ${f3(sTd.f2.softAft)}`);

/* ---------------- anchors under v1 ---- */
console.log('\n[anchors, composite v1]');
const anchors = {
  teardrop: { mesh: td.f3, total: 0.045 },
  sphere: { mesh: makeSphere(), total: 0.47 },
  cube: { mesh: makeCube(), total: 1.05 },
  plate: { mesh: makePlate(), total: 1.17 },
};
for (const [name, a] of Object.entries(anchors)) {
  a.s = score(a.mesh);
  a.friction = frictionCd(a.mesh);
  a.pressure = a.total - a.friction;
  console.log(`  ${name.padEnd(9)} proxyV1 ${f3(a.s.compositeV1)}  friction ${f3(a.friction)}  -> anchor PRESSURE ${f3(a.pressure)}`);
}
check('v1 keeps the raw ordering (teardrop << sphere < cube <= plate)',
  anchors.teardrop.s.compositeV1 < 0.6 * anchors.sphere.s.compositeV1
  && anchors.sphere.s.compositeV1 < 0.9 * anchors.cube.s.compositeV1
  && anchors.cube.s.compositeV1 <= 1.05 * anchors.plate.s.compositeV1);
check('anchor proxies strictly monotone with anchor pressures (calibratable)',
  [...Object.values(anchors)].sort((x, y) => x.s.compositeV1 - y.s.compositeV1)
    .every((a, i, arr) => i === 0 || a.pressure >= arr[i - 1].pressure));

/* ---------------- [A] calibration vNEXT (RATIFIED 2026-08-16) ---- */
console.log('\n[A] calibration vNEXT: real-data knots (TN-614 111+332) + textbook bluff anchors');
// History: r9 #1 aggregation/clamping proven here; then the TN-614 exam
// showed the synthetic teardrop knot's regime-fuzzy pressure split
// poisoned the streamlined segment (+132/+187% on full tails) — knot
// RETIRED FOR CAUSE; family extremes promoted to real-data knots.
// Full provenance: calibration.mjs + RESULTS.md.
const { buildCalibration } = await import('./calibration.mjs');
const { knots, calibrate, provenance } = buildCalibration();
console.log(`  knots: ${knots.map(([x, y]) => `(${f3(x)} -> ${f3(y)})`).join('  ')}`);
console.log(`  provenance: ${provenance.join(' · ')}`);
check('knots strictly monotone in proxy AND pressure',
  knots.every(([x, y], i) => i === 0 || (x > knots[i - 1][0] && y >= knots[i - 1][1])));
const predictTotal = (mesh) => calibrate(proxyOf(mesh)) + frictionCd(mesh);
// Textbook bluff anchors still round-trip (by construction):
check('sphere round-trips 0.47 within 2%', Math.abs(predictTotal(anchors.sphere.mesh) - 0.47) <= 0.02 * 0.47, f3(predictTotal(anchors.sphere.mesh)));
check('cube round-trips within 15% (pooled bluff knot)', Math.abs(predictTotal(anchors.cube.mesh) - 1.05) <= 0.15 * 1.05, f3(predictTotal(anchors.cube.mesh)));
check('plate round-trips within 15% (pooled bluff knot)', Math.abs(predictTotal(anchors.plate.mesh) - 1.17) <= 0.15 * 1.17, f3(predictTotal(anchors.plate.mesh)));
// The synthetic teardrop is NO LONGER an anchor: under real-data
// calibration it PREDICTS a high-Re streamlined total (~0.024) — the
// textbook 0.045 belongs to model-scale Re. Sanity band, not round-trip:
const tdTotal = predictTotal(anchors.teardrop.mesh);
console.log(`  teardrop f3 (retired knot) now PREDICTS ${f3(tdTotal)} — high-Re streamlined class`);
check('teardrop f3 predicts in the plausible high-Re band [0.015, 0.05]', tdTotal >= 0.015 && tdTotal <= 0.05, f3(tdTotal));

// TN-614 permanent regression fixtures (the exam that earned vNEXT):
{
  const { BODIES, TEST_RE, latheProfile } = await import('./tn614-bodies.mjs');
  const { frictionCdAt } = await import('./calibration.mjs');
  const predictAt = (mesh) => calibrate(proxyOf(mesh)) + frictionCdAt(mesh, TEST_RE);
  console.log('  TN-614 family under vNEXT (111/332 in-calibration; middle four HELD OUT):');
  const preds = {};
  for (const [name, b] of Object.entries(BODIES)) {
    const mesh = latheProfile(b.pts);
    preds[name] = predictAt(mesh);
    console.log(`    ${name.padEnd(5)} predicted ${f3(preds[name])} vs measured ${b.cdA} (${(100 * (preds[name] - b.cdA) / b.cdA).toFixed(1)}%)`);
  }
  check('calibration members round-trip within 2% (111, 332)',
    Math.abs(preds['111'] - 0.0401) <= 0.02 * 0.0401 && Math.abs(preds['332'] - 0.0508) <= 0.02 * 0.0508);
  // r11 #1/#9: relabelled — 121T/211T reuse the knots' own physical
  // sections (proxies ≡ 111/221 to 4 decimals) and all six informed
  // vNEXT's design: this is WITHIN-FAMILY regression evidence guarding
  // the interpolation behaviour, NOT an independent accuracy test.
  check('NON-KNOT TN-614 WITHIN-FAMILY REGRESSION: 121T, 211T, 221, 222 within 6%',
    ['121T', '211T', '221', '222'].every((n) => Math.abs(preds[n] - BODIES[n].cdA) <= 0.06 * BODIES[n].cdA));
  check('family ordering preserved (2.4% 121/211 tie tolerated)',
    preds['111'] < preds['221'] && preds['221'] < preds['222'] && preds['222'] < preds['332']
    && preds['121T'] < preds['221'] && preds['211T'] < preds['221']);
}
console.log('  held-out (never calibrated):');
// Bands are BROAD deliberately (no confirmed frontal-basis held-out
// anchor exists — the spec forbids importing TC-6/Navy until their basis
// is verified). First battery run had these too narrow by guesswork.
const heldOut = {
  'ellipsoid 3:1': { mesh: makeEllipsoid(3), lo: 0.03, hi: 0.35, note: 'streamlined-ish, well below sphere' },
  'teardrop REVERSED': { mesh: { verts: td.f3.verts.map(([x, y, z]) => [-x, y, z]), faces: td.f3.faces }, lo: 0.10, hi: 0.90, note: 'blunt-back body, bluff-ish' },
};
for (const [name, h] of Object.entries(heldOut)) {
  const total = predictTotal(h.mesh);
  console.log(`  ${name.padEnd(20)} predicted total ${f3(total)} (broad-band [${h.lo}, ${h.hi}] — ${h.note})`);
  check(`${name} lands in its broad plausibility band`, total >= h.lo && total <= h.hi, f3(total));
}
check('held-out ordering: ellipsoid < reversed teardrop < sphere-total',
  predictTotal(heldOut['ellipsoid 3:1'].mesh) < predictTotal(heldOut['teardrop REVERSED'].mesh)
  && predictTotal(heldOut['teardrop REVERSED'].mesh) < anchors.sphere.total * 1.2);

/* ---------------- [C] invariants ---- */
console.log('\n[C] invariants');
{
  const base = proxyOf(anchors.sphere.mesh);
  const scaled = proxyOf({ verts: anchors.sphere.mesh.verts.map((p) => p.map((c) => c * 3)), faces: anchors.sphere.mesh.faces });
  check('scale x3 leaves the proxy identical (dimensionless)', Math.abs(scaled - base) < 1e-9, `${base} vs ${scaled}`);
  const moved = proxyOf({ verts: anchors.sphere.mesh.verts.map(([x, y, z]) => [x + 17, y - 4, z + 9]), faces: anchors.sphere.mesh.faces });
  check('translation leaves the proxy identical', Math.abs(moved - base) < 1e-9, `${base} vs ${moved}`);
  const coarse = proxyOf(makeSphere(14, 9)), fine = proxyOf(makeSphere(56, 36));
  check('mesh density (sphere 14x9 vs 56x36) moves proxy < 8%',
    Math.abs(fine - coarse) / fine < 0.08, `${f3(coarse)} vs ${f3(fine)}`);
  const chopped = proxyOf(makeChoppedTeardrop(3, 0.7));
  check('sharp-cut sanity: chopping the tail worsens the aft score',
    chopped > 2 * proxyOf(td.f3), `chopped ${f3(chopped)} vs full ${f3(proxyOf(td.f3))}`);
  const sphereFwd = proxyOf(anchors.sphere.mesh), sphereRev = proxyOf(anchors.sphere.mesh, { axis: '-X' });
  check('symmetric body: forward == reverse (sphere)', Math.abs(sphereFwd - sphereRev) / sphereFwd < 0.02,
    `${f3(sphereFwd)} vs ${f3(sphereRev)}`);
}

/* ---------------- [D] discretisation ---- */
console.log('\n[D] discretisation: Toby\'s slices-converge-toward-infinity intuition, measured');
{
  for (const [name, mesh] of [['teardrop f3', td.f3], ['sphere', anchors.sphere.mesh]]) {
    const s32 = proxyOf(mesh, { STATIONS: 32 }), s64 = proxyOf(mesh, { STATIONS: 64 }), s128 = proxyOf(mesh, { STATIONS: 128 });
    console.log(`  ${name}: 32 stations ${f3(s32)} · 64 ${f3(s64)} · 128 ${f3(s128)}`);
    check(`${name}: 64 -> 128 stations moves proxy < 5% (converged)`,
      Math.abs(s128 - s64) / Math.max(s128, 1e-9) < 0.05);
  }
  const r128 = proxyOf(anchors.sphere.mesh, { RES: 128 }), r192 = proxyOf(anchors.sphere.mesh, { RES: 192 });
  check('cross-grid 128 vs 192 moves proxy < 5%', Math.abs(r192 - r128) / r192 < 0.05, `${f3(r128)} vs ${f3(r192)}`);
}

/* ---------------- [E] r9 adversaries + guards (review 2026-08-15) ---- */
console.log('\n[E] r9: adversarial fixtures + production guards');
{
  const { makeFlatFrontBoatTail, makeNeckBody, makeRoundRod, makeSquareRod } = await import('../flow-chamber/shapes.mjs');

  // (1) calibration finiteness across the whole plausible proxy range
  let allFinite = true;
  for (let x = 0; x <= 1.6001; x += 0.05) if (!Number.isFinite(calibrate(x))) allFinite = false;
  check('calibration finite for every proxy in [0, 1.6]', allFinite);
  check('above-top proxies CLAMP (no extrapolation)', calibrate(1.6) === calibrate(1.2));

  // (2) flat-front boat-tail: the aft-only blind spot, now guarded by fore
  const ff = score(makeFlatFrontBoatTail(4));
  console.log(`  flat-front boat-tail: softAft ${f3(ff.softAft)}, softFore ${f3(ff.softFore)}, composite ${f3(ff.compositeV1)}, predicted total ${f3(calibrate(ff.compositeV1) + frictionCd(makeFlatFrontBoatTail(4)))}`);
  check('flat-front body must NOT beat the teardrop (>= 5x its composite)',
    ff.compositeV1 >= 5 * score(td.f3).compositeV1, `${f3(ff.compositeV1)} vs teardrop ${f3(score(td.f3).compositeV1)}`);
  check('flat-front body scores bluff-ish (composite >= 0.5)', ff.compositeV1 >= 0.5);

  // (3) neck/re-expansion: raw diagnostic exceeds 1, consumed score bounded
  const nk = score(makeNeckBody());
  console.log(`  neck body: softAftRaw ${f3(nk.softAftRaw)} (the old unbounded path), consumed softAft ${f3(nk.softAft)}, composite ${f3(nk.compositeV1)}`);
  check('neck body: raw walk demonstrates the old defect (> 1)', nk.softAftRaw > 1, f3(nk.softAftRaw));
  check('neck body: CONSUMED score bounded <= 1 (monotone envelope)', nk.softAft <= 1 + 1e-9 && nk.compositeV1 <= 1 + 1e-9);
  check('neck body: calibrated total finite', Number.isFinite(calibrate(nk.compositeV1) + frictionCd(makeNeckBody())));

  // (4) equal-A(x) round vs square rods: the DOCUMENTED sectional-shape
  // blindness — this fixture records the limitation, it does not fix it.
  const rr = score(makeRoundRod()), sr = score(makeSquareRod());
  check('KNOWN BLINDNESS documented: equal-A(x) round vs square score within 3%',
    Math.abs(rr.compositeV1 - sr.compositeV1) / rr.compositeV1 < 0.03,
    `round ${f3(rr.compositeV1)} vs square ${f3(sr.compositeV1)} — identical BY DESIGN LIMITATION`);

  // (5) parity quality: holed mesh must be measurable as damaged
  const sphereMesh = anchors.sphere.mesh;
  const holed = { verts: sphereMesh.verts, faces: sphereMesh.faces.filter((_, i) => i % 3 !== 0) };
  const qClean = measureSections(sphereMesh.verts, sphereMesh.faces, {}).quality;
  const qHoled = measureSections(holed.verts, holed.faces, {}).quality;
  console.log(`  parity quality: clean oddFraction ${qClean.oddFraction.toFixed(3)}, holed (1/3 faces removed) ${qHoled.oddFraction.toFixed(3)}`);
  check('clean mesh: negligible odd columns (< 2%)', qClean.oddFraction < 0.02);
  check('holed mesh: damage is COUNTED (oddFraction > 5%) — production maps this to estimate-unavailable',
    qHoled.oddFraction > 0.05);
  // r10 #1: the 3-crossing case — closed cube + one open sheet downstream.
  // EVERY ray that hits anything crosses an odd count (cube rays: 2+1=3,
  // sheet-only rays: 1). The old denominator double-counted odd columns
  // that also carried a valid interval and reported 0.50; truth ≈ 1.0.
  const cubeM = anchors.cube.mesh;
  const base = cubeM.verts.length;
  const cubeSheet = {
    verts: [...cubeM.verts, [1.2, -0.6, -0.6], [1.2, 0.6, -0.6], [1.2, 0.6, 0.6], [1.2, -0.6, 0.6]],
    faces: [...cubeM.faces, [base, base + 1, base + 2], [base, base + 2, base + 3]],
  };
  const qSheet = measureSections(cubeSheet.verts, cubeSheet.faces, {}).quality;
  console.log(`  cube + open sheet: oddFraction ${qSheet.oddFraction.toFixed(3)} (old buggy denominator gave ~0.50)`);
  check('3-crossing damage fully counted (oddFraction > 0.9)', qSheet.oddFraction > 0.9);
  // r10 #4: numerical failure is UNAVAILABLE, never a plausible bluff Cd.
  check('calibrate(NaN) is NaN (estimate-unavailable), not the top knot', Number.isNaN(calibrate(NaN)));

  // Anchors + family must SURVIVE the fore term (no damage to good shapes)
  check('fore term leaves sphere unchanged (aft still governs)',
    Math.abs(score(anchors.sphere.mesh).compositeV1 - score(anchors.sphere.mesh).softAft) < 1e-9);
  check('teardrop family ordering survives the fore term',
    score(td.f4).compositeV1 < score(td.f3).compositeV1 && score(td.f3).compositeV1 < score(td.f2).compositeV1);
}

/* ---------------- [F] fore-term nose family (pre-empting r10's attack:
 * the fore guard must fire ONLY on face-like fronts — every legitimate
 * nose must pass through untouched, and prior orderings must survive.
 * Mostly REPORTED, deliberately few pass/fail checks, to avoid
 * self-fulfilling fixtures.) ---- */
console.log('\n[F] fore-term nose family (fore should fire on faces, never on noses)');
{
  const { makeLathe, makeFlatFrontBoatTail } = await import('../flow-chamber/shapes.mjs');
  const bodies = {
    'ogive-cyl (blunt base)': makeLathe((t) => t < 0.3 ? 0.5 * Math.sin((t / 0.3) * Math.PI / 2) : 0.5, 3),
    'hemis-nose + boat-tail': makeLathe((t) => {
      if (t < 0.15) return 0.5 * Math.sqrt(1 - ((0.15 - t) / 0.15) ** 2);
      if (t < 0.55) return 0.5;
      return Math.max(0.5 * (1 - (t - 0.55) / 0.45), 0.001);
    }, 3.5),
    'long cone fore (blunt base)': makeLathe((t) => t < 0.7 ? 0.5 * (t / 0.7) : 0.5, 3),
    'bad both ends (rod)': makeLathe(() => 0.5, 3),
    'max-area near REAR': makeLathe((t) => 0.5 * Math.min(1, t / 0.9), 4),
  };
  const rows = {};
  for (const [name, mesh] of Object.entries(bodies)) {
    const s = score(mesh);
    rows[name] = s;
    console.log(`  ${name.padEnd(28)} fore ${f3(s.softFore)}  aft ${f3(s.softAft)}  composite ${f3(s.compositeV1)}`);
  }
  check('legitimate noses stay untouched by fore (ogive, hemis, cone all < 0.05)',
    rows['ogive-cyl (blunt base)'].softFore < 0.05
    && rows['hemis-nose + boat-tail'].softFore < 0.05
    && rows['long cone fore (blunt base)'].softFore < 0.05);
  check('their scores remain aft-governed (composite === softAft for nose-clean bodies)',
    ['ogive-cyl (blunt base)', 'long cone fore (blunt base)'].every((k) => rows[k].compositeV1 === rows[k].softAft));
  check('bad-both-ends governed by max(), not sum (composite <= 1)',
    rows['bad both ends (rod)'].compositeV1 <= 1 + 1e-9);
  check('hemis-nose boat-tail stays streamlined-ish (composite < 0.5 x sphere)',
    rows['hemis-nose + boat-tail'].compositeV1 < 0.5 * score(anchors.sphere.mesh).compositeV1,
    `${f3(rows['hemis-nose + boat-tail'].compositeV1)} vs sphere ${f3(score(anchors.sphere.mesh).compositeV1)}`);
  // The one the reviewer will look for: fore fired the flat face, nothing else.
  check('ONLY the face-like front fires fore (flat-front 0.7+; all noses < 0.05)',
    score(makeFlatFrontBoatTail(4)).softFore > 0.7);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
