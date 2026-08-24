/**
 * M6 fixture suite — the Cd estimator (sections.js + cdEstimator.js).
 *
 * The spike battery (spike/sectional/battery.mjs, 42/42 at graduation)
 * PORTED as permanent engine fixtures per the M6 stage-1 order, plus:
 *   [G] calibration-knot REGENERATION guard — the pinned constants are
 *       rebuilt from their source meshes and asserted equal, so the
 *       knots can never silently drift from the code that defines them;
 *   [H] frozen-API fixtures — seam shape, ±20% band arithmetic, status
 *       semantics, strictness, signed-axis behaviour, speed drift,
 *       corpus integration (Sunship ~0.44, skipped if corpus absent).
 *
 * Tiers mirror the battery: [B] saturation family / [anchors] /
 * [A] calibration vNEXT / [C] invariants / [D] discretisation /
 * [E] r9-r10 adversaries + guards / [F] fore-term nose family.
 *
 * Shape generators + TN-614 bodies are imported from the spike tree —
 * TEST-SIDE ONLY (they never bake); engine modules load via the
 * ENGINE_ROOT override for baked-vs-source parity.
 *
 * Plain node, zero deps: `node test/estimator-fixtures.mjs`
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ENGINE_ROOT = process.env.DYNAMICS_ENGINE_ROOT
  ? pathToFileURL(process.env.DYNAMICS_ENGINE_ROOT.replace(/[\\/]*$/, '/'))
  : new URL('../src/', import.meta.url);
if (process.env.DYNAMICS_ENGINE_ROOT) console.log(`engine root: ${ENGINE_ROOT.href}`);

const { measureSections, scoreSections } = await import(new URL('sections.js', ENGINE_ROOT).href);
const {
  estimateCd, measureSectionalProxy, calibratePressure, applyGenericTail,
  CALIBRATION_KNOTS, BAND_FRACTION, ODD_FRACTION_MAX, GENERIC_TAIL_PRESSURE_FRACTION,
  ROUNDED_KNOTS, CLASSIFIER_TAU, CLASSIFIER_REEXPANSION, SHOULDER_ANGLE_MAX, SHOULDER_OPTS,
  shoulderAngleScore, SUBCRITICAL_ROUNDED_KNOTS, crisisBlend, CRISIS_WINDOW_RED,
} = await import(new URL('cdEstimator.js', ENGINE_ROOT).href);
const { measureDynamicsGeometry, scaleGeometryRecord } = await import(new URL('dynamicsGeometry.js', ENGINE_ROOT).href);
const { ittcCf, skinFrictionCd, NU_M2_S, computeDynamics } = await import(new URL('dynamicsCore.js', ENGINE_ROOT).href);
const { parseObjMesh } = await import(new URL('obj.js', ENGINE_ROOT).href);

// Test-side geometry sources (never baked, never in production):
const {
  makeSphere, makeCube, makePlate, makeTeardrop, makeEllipsoid, makeChoppedTeardrop,
  makeFlatFrontBoatTail, makeNeckBody, makeRoundRod, makeSquareRod, makeLathe,
} = await import('../spike/flow-chamber/shapes.mjs');
const { BODIES, TEST_RE, latheProfile } = await import('../spike/sectional/tn614-bodies.mjs');

let passed = 0, failed = 0, skipped = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const skip = (name, why) => { skipped++; console.log(`skip  ${name} — ${why}`); };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));

const score = (mesh, opts = {}) => scoreSections(measureSections(mesh.verts, mesh.faces, opts));
const proxyOf = (mesh, opts = {}) => score(mesh, opts).compositeV1;

/* Reference condition for anchor friction (as the spike battery + the
 * pinned sphere/bluff knots): 100 m body at 100 km/h.
 *
 * THESE HELPERS STAY ON THE SMOOTH ITTC LINE — DELIBERATELY, do not
 * "fix" them to skinFrictionCd (B1, 2026-08-19). They exist to
 * REPRODUCE measured wind-tunnel totals (sphere 0.47, cube 1.05, TN-614
 * cdA) and to REGENERATE the pressure knots, all of which were derived
 * from polished models with no roughness allowance. The allowance is a
 * real-skin term that belongs to the VEHICLE, not to the calibration;
 * mixing it in here would corrupt the knots it is layered on top of. */
const V = 100 / 3.6, LEN = 100;
const REF_RE = (V * LEN) / NU_M2_S;
function frictionCdRef(mesh) {
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: LEN });
  return ittcCf(REF_RE) * (g.wettedArea / g.frontalArea);
}
function frictionCdAt(mesh, re) {
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: LEN });
  return ittcCf(re) * (g.wettedArea / g.frontalArea);
}
const predictTotal = (mesh) => calibratePressure(proxyOf(mesh)) + frictionCdRef(mesh);

/* ---------------- [B] the soft term fixes the saturation defect ---- */
console.log('[B] soft closure term: streamlined family separates and orders');
const td = { f2: makeTeardrop(2), f3: makeTeardrop(3), f4: makeTeardrop(4) };
const sTd = { f2: score(td.f2), f3: score(td.f3), f4: score(td.f4) };
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
  a.friction = frictionCdRef(a.mesh);
  a.pressure = a.total - a.friction;
}
check('v1 keeps the raw ordering (teardrop << sphere < cube <= plate)',
  anchors.teardrop.s.compositeV1 < 0.6 * anchors.sphere.s.compositeV1
  && anchors.sphere.s.compositeV1 < 0.9 * anchors.cube.s.compositeV1
  && anchors.cube.s.compositeV1 <= 1.05 * anchors.plate.s.compositeV1);
check('anchor proxies strictly monotone with anchor pressures (calibratable)',
  [...Object.values(anchors)].sort((x, y) => x.s.compositeV1 - y.s.compositeV1)
    .every((a, i, arr) => i === 0 || a.pressure >= arr[i - 1].pressure));

/* ---------------- [A] calibration vNEXT (pinned knots) ---- */
console.log('\n[A] calibration vNEXT: real-data knots (TN-614 111+332) + textbook bluff anchors');
check('knots strictly monotone in proxy AND pressure',
  CALIBRATION_KNOTS.every(([x, y], i) => i === 0 || (x > CALIBRATION_KNOTS[i - 1][0] && y >= CALIBRATION_KNOTS[i - 1][1])));
check('sphere round-trips 0.47 within 2%', Math.abs(predictTotal(anchors.sphere.mesh) - 0.47) <= 0.02 * 0.47, f3(predictTotal(anchors.sphere.mesh)));
check('cube round-trips within 15% (pooled bluff knot)', Math.abs(predictTotal(anchors.cube.mesh) - 1.05) <= 0.15 * 1.05, f3(predictTotal(anchors.cube.mesh)));
check('plate round-trips within 15% (pooled bluff knot)', Math.abs(predictTotal(anchors.plate.mesh) - 1.17) <= 0.15 * 1.17, f3(predictTotal(anchors.plate.mesh)));
// The synthetic teardrop is NOT an anchor (retired for cause 2026-08-16):
// under real-data calibration it PREDICTS a high-Re streamlined total.
const tdTotal = predictTotal(anchors.teardrop.mesh);
check('teardrop f3 (retired knot) predicts in the plausible high-Re band [0.015, 0.05]', tdTotal >= 0.015 && tdTotal <= 0.05, f3(tdTotal));

// TN-614 permanent regression fixtures (the exam that earned vNEXT):
{
  const predictAt = (mesh) => calibratePressure(proxyOf(mesh)) + frictionCdAt(mesh, TEST_RE);
  const preds = {};
  for (const [name, b] of Object.entries(BODIES)) preds[name] = predictAt(latheProfile(b.pts));
  check('calibration members round-trip within 2% (111, 332)',
    Math.abs(preds['111'] - 0.0401) <= 0.02 * 0.0401 && Math.abs(preds['332'] - 0.0508) <= 0.02 * 0.0508);
  // r11 #1/#9: WITHIN-FAMILY regression evidence guarding interpolation
  // behaviour, NOT an independent accuracy test (121T/211T reuse the
  // knots' own physical sections).
  check('NON-KNOT TN-614 WITHIN-FAMILY REGRESSION: 121T, 211T, 221, 222 within 6%',
    ['121T', '211T', '221', '222'].every((n) => Math.abs(preds[n] - BODIES[n].cdA) <= 0.06 * BODIES[n].cdA));
  check('family ordering preserved (2.4% 121/211 tie tolerated)',
    preds['111'] < preds['221'] && preds['221'] < preds['222'] && preds['222'] < preds['332']
    && preds['121T'] < preds['221'] && preds['211T'] < preds['221']);
}
console.log('  held-out (never calibrated):');
const heldOut = {
  'ellipsoid 3:1': { mesh: makeEllipsoid(3), lo: 0.03, hi: 0.35, note: 'streamlined-ish, well below sphere' },
  'teardrop REVERSED': { mesh: { verts: td.f3.verts.map(([x, y, z]) => [-x, y, z]), faces: td.f3.faces }, lo: 0.10, hi: 0.90, note: 'blunt-back body, bluff-ish' },
};
for (const [name, h] of Object.entries(heldOut)) {
  const total = predictTotal(h.mesh);
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
console.log('\n[D] discretisation: station convergence + cross-grid stability');
{
  for (const [name, mesh] of [['teardrop f3', td.f3], ['sphere', anchors.sphere.mesh]]) {
    const s64 = proxyOf(mesh, { STATIONS: 64 }), s128 = proxyOf(mesh, { STATIONS: 128 });
    check(`${name}: 64 -> 128 stations moves proxy < 5% (converged)`,
      Math.abs(s128 - s64) / Math.max(s128, 1e-9) < 0.05);
  }
  const r128 = proxyOf(anchors.sphere.mesh, { RES: 128 }), r192 = proxyOf(anchors.sphere.mesh, { RES: 192 });
  check('cross-grid 128 vs 192 moves proxy < 5%', Math.abs(r192 - r128) / r192 < 0.05, `${f3(r128)} vs ${f3(r192)}`);
}

/* ---------------- [E] r9-r10 adversaries + production guards ---- */
console.log('\n[E] adversarial fixtures + production guards');
{
  let allFinite = true;
  for (let x = 0; x <= 1.6001; x += 0.05) if (!Number.isFinite(calibratePressure(x))) allFinite = false;
  check('calibration finite for every proxy in [0, 1.6]', allFinite);
  check('above-top proxies CLAMP (no extrapolation)', calibratePressure(1.6) === calibratePressure(1.2));

  const ff = score(makeFlatFrontBoatTail(4));
  check('flat-front body must NOT beat the teardrop (>= 5x its composite)',
    ff.compositeV1 >= 5 * score(td.f3).compositeV1, `${f3(ff.compositeV1)} vs teardrop ${f3(score(td.f3).compositeV1)}`);
  check('flat-front body scores bluff-ish (composite >= 0.5)', ff.compositeV1 >= 0.5);

  const nk = score(makeNeckBody());
  check('neck body: raw walk demonstrates the old defect (> 1)', nk.softAftRaw > 1, f3(nk.softAftRaw));
  check('neck body: CONSUMED score bounded <= 1 (monotone envelope)', nk.softAft <= 1 + 1e-9 && nk.compositeV1 <= 1 + 1e-9);
  check('neck body: calibrated total finite', Number.isFinite(calibratePressure(nk.compositeV1) + frictionCdRef(makeNeckBody())));

  const rr = score(makeRoundRod()), sr = score(makeSquareRod());
  check('KNOWN BLINDNESS documented: equal-A(x) round vs square score within 3%',
    Math.abs(rr.compositeV1 - sr.compositeV1) / rr.compositeV1 < 0.03,
    `round ${f3(rr.compositeV1)} vs square ${f3(sr.compositeV1)} — identical BY DESIGN LIMITATION`);

  const sphereMesh = anchors.sphere.mesh;
  const holed = { verts: sphereMesh.verts, faces: sphereMesh.faces.filter((_, i) => i % 3 !== 0) };
  const qClean = measureSections(sphereMesh.verts, sphereMesh.faces, {}).quality;
  const qHoled = measureSections(holed.verts, holed.faces, {}).quality;
  check('clean mesh: negligible odd columns (< 2%)', qClean.oddFraction < 0.02);
  check('holed mesh: damage is COUNTED (oddFraction > 5%)', qHoled.oddFraction > 0.05);
  const cubeM = anchors.cube.mesh;
  const base = cubeM.verts.length;
  const cubeSheet = {
    verts: [...cubeM.verts, [1.2, -0.6, -0.6], [1.2, 0.6, -0.6], [1.2, 0.6, 0.6], [1.2, -0.6, 0.6]],
    faces: [...cubeM.faces, [base, base + 1, base + 2], [base, base + 2, base + 3]],
  };
  const qSheet = measureSections(cubeSheet.verts, cubeSheet.faces, {}).quality;
  check('3-crossing damage fully counted (oddFraction > 0.9)', qSheet.oddFraction > 0.9, qSheet.oddFraction.toFixed(3));
  check('calibratePressure(NaN) is NaN (estimate-unavailable), not the top knot', Number.isNaN(calibratePressure(NaN)));

  check('fore term leaves sphere unchanged (aft still governs)',
    Math.abs(score(anchors.sphere.mesh).compositeV1 - score(anchors.sphere.mesh).softAft) < 1e-9);
  check('teardrop family ordering survives the fore term',
    score(td.f4).compositeV1 < score(td.f3).compositeV1 && score(td.f3).compositeV1 < score(td.f2).compositeV1);
}

/* ---------------- [F] fore-term nose family ---- */
console.log('\n[F] fore-term nose family (fore fires on faces, never on noses)');
{
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
  for (const [name, mesh] of Object.entries(bodies)) rows[name] = score(mesh);
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
  check('ONLY the face-like front fires fore (flat-front 0.7+; all noses < 0.05)',
    score(makeFlatFrontBoatTail(4)).softFore > 0.7);
}

/* ---------------- [G] pinned-knot regeneration guard ---- */
console.log('\n[G] calibration knots regenerate exactly from their source meshes');
{
  const m111 = latheProfile(BODIES['111'].pts);
  const m332 = latheProfile(BODIES['332'].pts);
  const regen = [
    [proxyOf(m111), BODIES['111'].cdA - frictionCdAt(m111, TEST_RE)],
    [proxyOf(m332), BODIES['332'].cdA - frictionCdAt(m332, TEST_RE)],
    [proxyOf(anchors.sphere.mesh), 0.47 - frictionCdRef(anchors.sphere.mesh)],
    [(proxyOf(anchors.cube.mesh) + proxyOf(anchors.plate.mesh)) / 2,
      ((1.05 - frictionCdRef(anchors.cube.mesh)) + (1.17 - frictionCdRef(anchors.plate.mesh))) / 2],
  ].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < 4; i++) {
    check(`knot [${i}] pinned == regenerated (proxy and pressure within 1e-9)`,
      Math.abs(regen[i][0] - CALIBRATION_KNOTS[i][0]) < 1e-9
      && Math.abs(regen[i][1] - CALIBRATION_KNOTS[i][1]) < 1e-9,
      `pinned (${CALIBRATION_KNOTS[i][0].toFixed(6)}, ${CALIBRATION_KNOTS[i][1].toFixed(6)}) vs regen (${regen[i][0].toFixed(6)}, ${regen[i][1].toFixed(6)})`);
  }
}

/* ---------------- [H] the frozen API ---- */
console.log('\n[H] frozen API: {cdEstimate, frictionCd, pressureCd, band, status, provenance}');
{
  // A metres-grade geometry record + proxy for the reference sphere.
  const sphereGeom = measureDynamicsGeometry(anchors.sphere.mesh.verts, anchors.sphere.mesh.faces, { flightAxis: 'X', lengthM: LEN });
  const sphereProxy = measureSectionalProxy(anchors.sphere.mesh.verts, anchors.sphere.mesh.faces, { axis: '+X' });
  const est = estimateCd(sphereProxy, sphereGeom, 100);

  check('API seam has exactly the frozen keys',
    JSON.stringify(Object.keys(est).sort()) === JSON.stringify(['band', 'cdEstimate', 'frictionCd', 'pressureCd', 'provenance', 'status']));
  check('status ok on a clean mesh', est.status === 'ok');
  check('cdEstimate = frictionCd + pressureCd exactly', est.cdEstimate === est.frictionCd + est.pressureCd);
  check('frictionCd is the engine friction line exactly (smooth + roughness allowance)',
    Math.abs(est.frictionCd - skinFrictionCd(REF_RE, LEN, sphereGeom.wettedArea, sphereGeom.frontalArea)) < 1e-12);
  // ...and it is STRICTLY ABOVE the smooth line at this condition, which
  // is the allowance actually doing something rather than silently
  // clamping to zero and passing the check above trivially.
  check('...and that is strictly above the bare smooth line (allowance is live here)',
    est.frictionCd > ittcCf(REF_RE) * (sphereGeom.wettedArea / sphereGeom.frontalArea));
  // Graduation 2026-08-16: the API sphere now classifies ROUNDED and
  // prices on the sphere-HR knot (Achenbach transcritical 0.19) — the
  // 0.47 subcritical value survives on the PINNED line (checked in [A]).
  check('sphere API estimate round-trips the transcritical 0.19 within 2% (rounded line, graduation)',
    Math.abs(est.cdEstimate - 0.19) <= 0.02 * 0.19, f3(est.cdEstimate));
  check('sphere classifies ROUNDED with the triggers in provenance',
    est.provenance.class === 'rounded' && est.provenance.triggers !== null);
  check(`band is exactly +/-${BAND_FRACTION * 100}% of the estimate (visual-only ruling 2026-08-16)`,
    est.band[0] === est.cdEstimate * (1 - BAND_FRACTION) && est.band[1] === est.cdEstimate * (1 + BAND_FRACTION));
  check('provenance labels ESTIMATED with the sectional method and knot provenance',
    est.provenance.label === 'ESTIMATED' && /sectional/.test(est.provenance.method) && est.provenance.calibration.length === 4);
  check('provenance carries exact input identity (r12 #1b — computeDynamics verifies it)',
    est.provenance.inputs.frontalAreaM2 === sphereGeom.frontalArea
    && est.provenance.inputs.wettedAreaM2 === sphereGeom.wettedArea
    && est.provenance.inputs.lengthM === sphereGeom.lengthM
    && est.provenance.inputs.airspeedKmh === 100);

  // Split-API consistency: cached proxy + per-speed call == one-shot.
  const est2 = estimateCd(sphereProxy, sphereGeom, 100);
  check('same proxy record + same inputs reproduce identical output (deterministic)',
    est2.cdEstimate === est.cdEstimate && est2.band[0] === est.band[0]);

  // Speed drift: pressure term is pure shape; only friction moves.
  const slow = estimateCd(sphereProxy, sphereGeom, 50), fast = estimateCd(sphereProxy, sphereGeom, 150);
  check('pressureCd identical across speeds (pure shape)', slow.pressureCd === fast.pressureCd);
  check('frictionCd drifts gently with speed (log Re)', slow.frictionCd > fast.frictionCd
    && (slow.frictionCd - fast.frictionCd) / fast.frictionCd < 0.25);

  // Signed axis: asymmetric body differs, symmetric does not.
  const tdGeom = measureDynamicsGeometry(td.f3.verts, td.f3.faces, { flightAxis: 'X', lengthM: LEN });
  const fwd = estimateCd(measureSectionalProxy(td.f3.verts, td.f3.faces, { axis: '+X' }), tdGeom, 100);
  const rev = estimateCd(measureSectionalProxy(td.f3.verts, td.f3.faces, { axis: '-X' }), tdGeom, 100);
  check('signed axis: reversed teardrop estimates well above forward (aft measured at the aft)',
    rev.cdEstimate > 3 * fwd.cdEstimate, `${f3(fwd.cdEstimate)} fwd vs ${f3(rev.cdEstimate)} rev`);

  // Unavailable path 1: parity damage above the gate.
  const holed = { verts: anchors.sphere.mesh.verts, faces: anchors.sphere.mesh.faces.filter((_, i) => i % 3 !== 0) };
  const holedProxy = measureSectionalProxy(holed.verts, holed.faces, { axis: '+X' });
  check(`holed mesh proxy is NaN (oddFraction gate at ${ODD_FRACTION_MAX})`, Number.isNaN(holedProxy.proxy));
  const holedGeom = measureDynamicsGeometry(holed.verts, holed.faces, { flightAxis: 'X', lengthM: LEN });
  const holedEst = estimateCd(holedProxy, holedGeom, 100);
  check('unavailable: status set, estimate/pressure/band null, NEVER a plausible bluff Cd',
    holedEst.status === 'unavailable' && holedEst.cdEstimate === null
    && holedEst.pressureCd === null && holedEst.band === null);
  check('unavailable still carries a real frictionCd (the dial bottom survives)',
    Number.isFinite(holedEst.frictionCd) && holedEst.frictionCd > 0);

  // Unavailable path 2: unreadable input never throws (s5.5).
  const junk = measureSectionalProxy([], [], {});
  check('empty input: measureSectionalProxy returns NaN proxy, no throw', Number.isNaN(junk.proxy));
  const junkEst = estimateCd(junk, sphereGeom, 100);
  check('NaN proxy maps to unavailable through the API', junkEst.status === 'unavailable');

  // Strictness: the trust boundary stays hard (same grade as computeDynamics).
  check('estimateCd rejects mesh-units geometry',
    throws(() => estimateCd(sphereProxy, { ...sphereGeom, units: 'mesh-units' }, 100)));
  check('estimateCd rejects v = 0 (parked is a UI state, the engine stays strict)',
    throws(() => estimateCd(sphereProxy, sphereGeom, 0)));
  check('estimateCd rejects non-finite speed', throws(() => estimateCd(sphereProxy, sphereGeom, NaN)));
}

/* ---------------- [I] M6 stage 2: generic tail + record scaling ---- */
console.log('\n[I] stage 2: applyGenericTail (s5.4) + scaleGeometryRecord parity');
{
  const geomOf = (mesh) => measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: LEN });
  const estOf = (mesh) => estimateCd(measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' }), geomOf(mesh), 100);

  const sphereEst = estOf(anchors.sphere.mesh);
  const tailed = applyGenericTail(sphereEst);
  check('generic tail trims pressure by exactly the s5.4 fraction (20%)',
    tailed.pressureCd === sphereEst.pressureCd * (1 - GENERIC_TAIL_PRESSURE_FRACTION));
  check('friction is never touched', tailed.frictionCd === sphereEst.frictionCd);
  check('total = friction + trimmed pressure exactly', tailed.cdEstimate === tailed.frictionCd + tailed.pressureCd);
  check('band re-drawn at +/-20% around the NEW total',
    tailed.band[0] === tailed.cdEstimate * (1 - BAND_FRACTION) && tailed.band[1] === tailed.cdEstimate * (1 + BAND_FRACTION));
  check('provenance names the generic tail as REFERENCE ASSUMPTION and keeps identity',
    /REFERENCE ASSUMPTION/.test(tailed.provenance.genericTail) && tailed.provenance.inputs === sphereEst.provenance.inputs);
  check('tailed estimate passes the engine trust boundary with matching identity (no warnings)', (() => {
    const g = geomOf(anchors.sphere.mesh);
    const c = computeDynamics(g, { airspeedKmh: 100, cd: tailed.cdEstimate, s: 0, estimate: tailed });
    return !c.warnings.some((w) => w.startsWith('estimate-'));
  })());
  const cubeEst = estOf(anchors.cube.mesh), cubeTailed = applyGenericTail(cubeEst);
  check('a cube stays terrible under a generic tail ("some effect, not heaps")',
    cubeTailed.cdEstimate > 0.8 && cubeTailed.cdEstimate < cubeEst.cdEstimate,
    `${f3(cubeEst.cdEstimate)} -> ${f3(cubeTailed.cdEstimate)}`);
  const tdEst = estOf(td.f3);
  check('ordering survives the generic tail (teardrop < sphere < cube)',
    applyGenericTail(tdEst).cdEstimate < tailed.cdEstimate && tailed.cdEstimate < cubeTailed.cdEstimate);
  const unavailable = { cdEstimate: null, frictionCd: 0.01, pressureCd: null, band: null, status: 'unavailable', provenance: {} };
  check('unavailable passes through UNTOUCHED (no tail can rescue a missing estimate)',
    applyGenericTail(unavailable) === unavailable);

  // scaleGeometryRecord: the bake-time raw record scaled to length must
  // equal measuring the mesh at that length directly.
  const mesh = anchors.sphere.mesh;
  const per = {};
  for (const ax of ['X', 'Y', 'Z']) per[ax] = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: ax });
  const raw = {
    extents: per.Z.extents,
    frontalRaw: { X: per.X.frontalArea, Y: per.Y.frontalArea, Z: per.Z.frontalArea },
    wettedRaw: per.Z.wettedArea, hullRaw: per.Z.hullArea, meshRaw: per.Z.meshArea,
    wettedSource: per.Z.wettedSource, warnings: per.Z.warnings,
  };
  const live = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'Y', lengthM: 120 });
  const scaled = scaleGeometryRecord(raw, 'Y', 120);
  const same = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
  check('scaled record == live measurement (frontal, wetted, hull, extents, ratio)',
    same(scaled.frontalArea, live.frontalArea) && same(scaled.wettedArea, live.wettedArea)
    && same(scaled.hullArea, live.hullArea) && same(scaled.wettedOverFrontal, live.wettedOverFrontal)
    && scaled.extents.every((e, i) => same(e, live.extents[i]))
    && scaled.units === 'm' && scaled.wettedSource === live.wettedSource);
  check('scaled record is engine-consumable (computeDynamics accepts it)',
    Number.isFinite(computeDynamics(scaled, { airspeedKmh: 100, cd: 0.3, s: 0 }).powerMW));
  check('scaleGeometryRecord rejects bad axis', throws(() => scaleGeometryRecord(raw, 'Q', 100)));
  check('scaleGeometryRecord rejects non-positive length', throws(() => scaleGeometryRecord(raw, 'X', 0)));
}

/* ---------------- [J] preset dynamics records (generated, guarded) ---- */
console.log('\n[J] presetDynamics.js: integrity + asset-hash guard');
{
  const { PRESET_DYNAMICS } = await import(new URL('presetDynamics.js', ENGINE_ROOT).href);
  const ids = Object.keys(PRESET_DYNAMICS).sort();
  check('all six presets have records',
    JSON.stringify(ids) === JSON.stringify(['aerosmena', 'bottle', 'car', 'cigar', 'sunship', 'washingmachine']));
  let allSane = true;
  for (const r of Object.values(PRESET_DYNAMICS)) {
    for (const ax of ['+X', '-X', '+Y', '-Y', '+Z', '-Z']) {
      const p = r.proxies[ax];
      if (!Number.isFinite(p.proxy) || !(p.oddFraction <= ODD_FRACTION_MAX)) allSane = false;
    }
    const g = scaleGeometryRecord(r.raw, 'Z', 100);
    if (!Number.isFinite(computeDynamics(g, { airspeedKmh: 100, cd: 0.3, s: 0 }).powerMW)) allSane = false;
  }
  check('every record: 6 finite proxies, parity-clean, engine-consumable at any length', allSane);
  const sun = PRESET_DYNAMICS.sunship;
  check('sunship record proxy(+Z) IS the pinned canonical value (bit-exact)',
    sun.proxies['+Z'].proxy === 0.7697920595614333, String(sun.proxies['+Z'].proxy));
  const sunGeo = scaleGeometryRecord(sun.raw, 'Z', 300);
  check('sunship record scaled to 300 m reproduces the pinned M1 numbers',
    Math.abs(sunGeo.frontalArea - 40522) < 1 && Math.abs(sunGeo.wettedArea - 206795) < 2,
    `frontal ${sunGeo.frontalArea.toFixed(1)}, wetted ${sunGeo.wettedArea.toFixed(1)}`);
  check('washing machine reads full-cliff (proxy 1.0 — a box is a box)',
    Math.abs(PRESET_DYNAMICS.washingmachine.proxies['+Z'].proxy - 1) < 1e-6);
  check('sources are labelled (corpus-obj for the faced meshes, convex-hull otherwise)',
    /corpus-obj/.test(sun.source) && /corpus-obj/.test(PRESET_DYNAMICS.washingmachine.source)
    && /convex-hull/.test(PRESET_DYNAMICS.bottle.source));
  // CIGAR AERO HULL (owner ratification 2026-08-17: the 5:1 formula
  // hull IS the cigar preset aeroHullMesh; r17 disqualified the
  // fin-carrying/corrupted exports for comparisons). The record must
  // derive from the authored hull, in the hull's own frame (+X), and
  // reproduce the ratified numbers: proxy 0.045 rounded, Cd ~0.036
  // frontal @300 m/100 km/h, Cd_v ~0.014.
  const cig = PRESET_DYNAMICS.cigar;
  check('cigar record derives from the RATIFIED aero hull (never corpus/glb fallback)',
    /aero-hull/.test(cig.source) && cig.aeroObj === 'lab/cigar-aerohull-candidate.obj');
  check('cigar defaultAxis is the hull frame +X', cig.defaultAxis === '+X');
  check('cigar aero proxy(+X) IS the ratified value (bit-exact, rounded class)',
    cig.proxies['+X'].proxy === 0.04487323070020768 && cig.proxies['+X'].cls === 'rounded',
    String(cig.proxies['+X'].proxy));
  {
    const geo = scaleGeometryRecord(cig.raw, 'X', 300);
    const est = estimateCd(cig.proxies['+X'], geo, 100);
    check('cigar aero estimate @300 m/100 km/h in the ratified window [0.030, 0.042]',
      est.cdEstimate >= 0.030 && est.cdEstimate <= 0.042, f3(est.cdEstimate));
    const d = computeDynamics(geo, { airspeedKmh: 100, cd: est.cdEstimate, s: 0 });
    check('cigar aero Cd_v @300 m in the ratified window [0.012, 0.017] (historical airships 0.023–0.030)',
      d.cdVolumetric >= 0.012 && d.cdVolumetric <= 0.017, String(d.cdVolumetric));
  }
  // Asset-hash guard: the deployed .glb files must match the records.
  const { createHash } = await import('node:crypto');
  const glbDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site', 'assets', 'shape-models');
  if (!existsSync(glbDir)) {
    skip('asset-hash guard', 'CalcV1-site assets not present');
  } else {
    let hashesOk = true;
    for (const r of Object.values(PRESET_DYNAMICS)) {
      const h = createHash('sha256').update(readFileSync(join(glbDir, `${r.id}.glb`))).digest('hex');
      if (h !== r.glbSha256) { hashesOk = false; console.log(`  HASH DRIFT: ${r.id}.glb`); }
    }
    check('asset-hash guard: every deployed .glb matches its record (regenerate on drift)', hashesOk);
    // r13 fix (2026-08-17): the guard checked ONLY the .glb — but the
    // AERO records derive from the corpus .obj files (source
    // hierarchy), so the aerodynamic source could drift without the
    // advertised loud failure. Recompute the corpus hashes too.
    const corpusDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '3D OBJ');
    if (!existsSync(corpusDir)) {
      skip('corpus-hash guard', '3D OBJ corpus not present');
    } else {
      const OBJ_NAMES = { sunship: 'Sunship.obj', cigar: 'cigar.obj', bottle: 'Bottle.obj', car: 'car.obj', washingmachine: 'washingmachine.obj', aerosmena: 'Aerosmena.obj' };
      let objOk = true;
      for (const r of Object.values(PRESET_DYNAMICS)) {
        if (r.aeroObj) continue; // aero-hull records are guarded below against the lab asset
        if (!r.objSha256) continue; // records without a corpus source carry no obj hash
        const p = join(corpusDir, OBJ_NAMES[r.id] ?? `${r.id}.obj`);
        if (!existsSync(p)) { objOk = false; console.log(`  CORPUS MISSING: ${r.id}`); continue; }
        const h = createHash('sha256').update(readFileSync(p)).digest('hex');
        if (h !== r.objSha256) { objOk = false; console.log(`  HASH DRIFT: corpus ${r.id}`); }
      }
      check('corpus-hash guard: every corpus .obj aero source matches its record (r13 #5)', objOk);
      check('every record with a corpus- or aero-hull-derived source carries an objSha256 (guard has no blind spot)',
        Object.values(PRESET_DYNAMICS).every((r) => !/corpus|aero-hull/.test(r.source) || !!r.objSha256));
    }
    // Aero-hull hash guard (cigar wiring 2026-08-17): ratified authored
    // hulls live in CalcV2/lab and bake into the record — the asset
    // must match the record it produced, same doctrine as the corpus
    // guard (drift without regeneration fails loudly).
    {
      const calcv2Root = join(dirname(fileURLToPath(import.meta.url)), '..');
      let aeroOk = true;
      for (const r of Object.values(PRESET_DYNAMICS)) {
        if (!r.aeroObj) continue;
        const p = join(calcv2Root, r.aeroObj);
        if (!existsSync(p)) { aeroOk = false; console.log(`  AERO HULL MISSING: ${r.id} (${r.aeroObj})`); continue; }
        const h = createHash('sha256').update(readFileSync(p, 'utf8')).digest('hex');
        if (h !== r.objSha256) { aeroOk = false; console.log(`  HASH DRIFT: aero hull ${r.id}`); }
      }
      check('aero-hull hash guard: every ratified aero asset matches its record', aeroOk);
    }
  }
}

/* ---------------- corpus integration (skipped if absent) ---- */
console.log('\n[corpus] Sunship end-to-end (the M6 headline number)');
{
  const corpusDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '3D OBJ');
  const sunshipPath = join(corpusDir, 'Sunship.obj');
  if (!existsSync(sunshipPath)) {
    skip('Sunship bare-hull estimate ~0.44', 'corpus absent');
  } else {
    const mesh = parseObjMesh(readFileSync(sunshipPath, 'utf8'));
    const geom = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'Z', lengthM: 300 });
    const proxy = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+Z' });
    const est = estimateCd(proxy, geom, 100);
    console.log(`  Sunship (+Z, 300 m, 100 km/h): estimate ${f3(est.cdEstimate)} = friction ${f3(est.frictionCd)} + pressure ${f3(est.pressureCd)} · band [${f3(est.band[0])}, ${f3(est.band[1])}] · ${Math.round(proxy.ms)} ms`);
    // Graduation 2026-08-16 (r15–r19 sealed): the Sunship is aft-
    // dominated (0.770 vs fore 0.005, measured) → ROUNDED line → the
    // bare hull lands in the high-Re crisis region ~0.18, and the
    // reveal delta becomes ~4× — the owner's preferred story (the old
    // ~0.44 / ~10× values belonged to the subcritical sphere anchor,
    // retired for cause at r15/r16).
    check('Sunship bare-hull estimate in the graduated high-Re region [0.155, 0.205]',
      est.cdEstimate >= 0.155 && est.cdEstimate <= 0.205, f3(est.cdEstimate));
    check('Sunship classifies ROUNDED (aft-dominated by an order of magnitude)',
      est.provenance.class === 'rounded' && est.provenance.triggers.softAft > 10 * est.provenance.triggers.softFore);
    check('the reveal delta: bare estimate / 0.043 in [3.5, 5.5] (~4×, r19-sealed story)',
      est.cdEstimate / 0.043 >= 3.5 && est.cdEstimate / 0.043 <= 5.5, (est.cdEstimate / 0.043).toFixed(1));
    check('authored with-tail 0.043 sits BELOW the bare band (the tail is a claim, not geometry)',
      0.043 < est.band[0]);
    check('measurement interactive-grade (< 500 ms)', proxy.ms < 500, `${Math.round(proxy.ms)} ms`);
  }
}

/* ---------------- [K] GRADUATION: mechanism classifier + two lines
 * (r15–r19, sealed 2026-08-16; ported from calibration-hr2/hr4) ---- */
console.log('\n[K] graduation: mechanism-aware two-line calibration (r15–r19 sealed)');
{
  const clsOf = (mesh, axis = '+X') => measureSectionalProxy(mesh.verts, mesh.faces, { axis });
  // The four alias adversaries, each pinned by its own trigger:
  const ff = clsOf(makeFlatFrontBoatTail(4));
  check('[r16] flat-front boat-tail classified PINNED (fore-dominance)',
    ff.cls === 'pinned' && ff.triggers.softFore > ff.triggers.softAft);
  const ch = clsOf(makeChoppedTeardrop(3, 0.7));
  check('[r16] chopped teardrop classified PINNED (terminal base)',
    ch.cls === 'pinned' && ch.triggers.terminalBaseFrac > CLASSIFIER_TAU);
  const nk = clsOf(makeNeckBody());
  check('[r16] neck body classified PINNED (re-expansion)',
    nk.cls === 'pinned' && nk.triggers.rawRatio > CLASSIFIER_REEXPANSION);
  const r18body = makeLathe((t) => {
    if (t < 0.18) return 0.5 * Math.sin((t / 0.18) * Math.PI / 2);
    if (t < 0.40) return 0.5;
    if (t < 0.80) return 0.5 - (0.125 / 0.40) * (t - 0.40);
    return Math.max(0.375 - (0.375 / 0.20) * (t - 0.80), 0);
  }, 3);
  const rb = clsOf(r18body);
  check('[r18] sharp-shoulder adversary classified PINNED (shoulder trigger)',
    rb.cls === 'pinned' && rb.triggers.shoulder > SHOULDER_ANGLE_MAX, f3(rb.triggers.shoulder));
  check('[r18] its pressure is the PINNED (vNEXT-verbatim) value — no discount',
    calibratePressure(rb.proxy, rb.cls) === calibratePressure(rb.proxy));
  // r19 fixed-26° radius sweep (angle constant by construction):
  const fixedAngle = (rSh) => {
    const FIN = 4, NOSE = 0.12;
    const taperT = (0.5 - 0.5 * rSh) / (Math.tan(6 * Math.PI / 180) * FIN);
    const coneT = (0.5 * rSh) / (Math.tan(32 * Math.PI / 180) * FIN);
    const cylEnd = 1 - coneT - taperT;
    return makeLathe((t) => {
      if (t < NOSE) return 0.5 * Math.sin((t / NOSE) * Math.PI / 2);
      if (t < cylEnd) return 0.5;
      if (t < cylEnd + taperT) return 0.5 - Math.tan(6 * Math.PI / 180) * FIN * (t - cylEnd);
      return Math.max(0.5 * rSh - Math.tan(32 * Math.PI / 180) * FIN * (t - cylEnd - taperT), 0);
    }, FIN);
  };
  check('[r19] GUARANTEE: 26°@0.70 radius PINNED', clsOf(fixedAngle(0.70)).cls === 'pinned');
  check('[r19] GUARANTEE: 26°@0.75 radius PINNED', clsOf(fixedAngle(0.75)).cls === 'pinned');
  check('[r19] DECLARED LIMIT: 26°@0.55 below guarantee (rounded)', clsOf(fixedAngle(0.55)).cls === 'rounded');
  // Smooth bodies stay rounded:
  check('sphere / teardrop / ellipsoid classify ROUNDED',
    clsOf(makeSphere()).cls === 'rounded' && clsOf(makeTeardrop(3)).cls === 'rounded'
    && clsOf(makeEllipsoid(3)).cls === 'rounded');
  // Two-line structural invariants:
  check('rounded knots share the streamlined pair with the pinned line, bit-exact',
    ROUNDED_KNOTS[0][0] === CALIBRATION_KNOTS[0][0] && ROUNDED_KNOTS[0][1] === CALIBRATION_KNOTS[0][1]
    && ROUNDED_KNOTS[1][0] === CALIBRATION_KNOTS[1][0] && ROUNDED_KNOTS[1][1] === CALIBRATION_KNOTS[1][1]);
  check('rounded ≤ pinned everywhere (the discount never inverts)',
    (() => { for (let x = 0; x <= 1.6; x += 0.01) if (calibratePressure(x, 'rounded') > calibratePressure(x) + 1e-12) return false; return true; })());
  check('calibratePressure default (no class) is the pinned vNEXT line — pre-graduation callers unchanged',
    calibratePressure(0.5) === calibratePressure(0.5, 'pinned'));
  check('rounded-line NaN semantics preserved', Number.isNaN(calibratePressure(NaN, 'rounded')));
  // sphere-HR knot regeneration (same pin-the-measurement pattern):
  {
    const sph = makeSphere();
    const g = measureDynamicsGeometry(sph.verts, sph.faces, { flightAxis: 'X', lengthM: 100 });
    const REF_RE = ((100 / 3.6) * 100) / NU_M2_S;
    const regen = 0.19 - ittcCf(REF_RE) * (g.wettedArea / g.frontalArea);
    check('sphere-HR knot regenerates from its source mesh (Achenbach 0.19 − ITTC @ REF)',
      Math.abs(regen - ROUNDED_KNOTS[2][1]) < 1e-9, `${regen} vs ${ROUNDED_KNOTS[2][1]}`);
  }
  // r19 metrology-configuration pin — the documented detection limit
  // belongs to THIS configuration:
  check('[r19] METROLOGY PIN: kFrac 48 · smoothW 3 · threshold 0.13',
    SHOULDER_OPTS.kFrac === 48 && SHOULDER_OPTS.smoothW === 3 && SHOULDER_ANGLE_MAX === 0.13);
}

/* ---------------- [L] vRE: Re-aware rounded-class pressure (owner
 * order 2026-08-17 — "shape at the size at the speed"; r20 pending) */
console.log('\n[L] vRE: the drag-crisis blend (size + speed reach the pressure term)');
{
  const sph = makeSphere();
  const est = (lengthM, kmh) => {
    const g = measureDynamicsGeometry(sph.verts, sph.faces, { flightAxis: 'Z', lengthM });
    const p = measureSectionalProxy(sph.verts, sph.faces, { axis: '+Z' });
    return estimateCd(p, g, kmh);
  };
  const small = est(4, 3);      // Toby's probe: marble-regime sphere
  const big = est(300, 100);    // vehicle-regime sphere
  check('4 m sphere at 3 km/h reads SUBCRITICAL (~0.47-class total)',
    small.cdEstimate > 0.42 && small.cdEstimate < 0.56, f3(small.cdEstimate));
  check('300 m sphere at 100 km/h reads the graduated high-Re value (unchanged)',
    Math.abs(big.cdEstimate - 0.19) <= 0.02 * 0.19, f3(big.cdEstimate));
  check('provenance carries the regime (blend 0 small, 1 big)',
    small.provenance.regime.crisisBlend === 0 && big.provenance.regime.crisisBlend === 1);
  // Continuity: estimate falls monotonically with speed through the crisis.
  let prev = Infinity, mono = true;
  for (const kmh of [1, 3, 8, 20, 50, 120, 300]) {
    const e = est(10, kmh).cdEstimate;
    if (e > prev + 1e-9) mono = false;
    prev = e;
  }
  check('10 m sphere: estimate falls monotonically with speed across the crisis', mono);
  // THE 1923 REPRODUCTION: the E2 prolate at its own tunnel condition.
  const prolPts = [];
  for (let i = 0; i <= 64; i++) {
    const th = (Math.PI * i) / 64, xPct = 50 * (1 - Math.cos(th)), t = (xPct - 50) / 50;
    prolPts.push([xPct, (200 / 2 / 360) * 100 * Math.sqrt(Math.max(0, 1 - t * t))]);
  }
  const prol = latheProfile(prolPts, 128, 36);
  const gP = measureDynamicsGeometry(prol.verts, prol.faces, { flightAxis: 'X', lengthM: 0.36 });
  const pP = measureSectionalProxy(prol.verts, prol.faces, { axis: '+X' });
  const vTunnel = (44000 * 1.5e-5) / 0.2; // Re_d 44k on d = 0.2 m
  const eP = estimateCd(pP, gP, vTunnel * 3.6);
  // r21 evidence correction: the kit called this reproduction "EXACT"
  // while the fixture only demanded ±20% — the claim outran the test.
  // Measured error is 0.087%, so the tolerance is now 1%: "exact at
  // display precision" is what the fixture actually proves.
  check('E2 prolate at its 1923 tunnel condition reproduces the measured 0.269 within 1%',
    Math.abs(eP.cdEstimate - 0.269) <= 0.01 * 0.269, f3(eP.cdEstimate));
  // Pinned class stays Re-flat; omitted reD stays the high line (compat).
  check('pinned class pressure is Re-flat (cube identical at any reD)',
    calibratePressure(1.0, 'pinned', 1e3) === calibratePressure(1.0, 'pinned', 1e9));
  check('omitted reD = the high line exactly (pre-vRE callers unchanged)',
    calibratePressure(0.6, 'rounded') === calibratePressure(0.6, 'rounded', 1e12));
  check('subcritical knots monotone; sphere sub-knot IS the original vNEXT knot re-regimed',
    SUBCRITICAL_ROUNDED_KNOTS.every(([, y], i, a) => i === 0 || y >= a[i - 1][1])
    && SUBCRITICAL_ROUNDED_KNOTS[3][1] === CALIBRATION_KNOTS[2][1]);
  check('blend window is the declared knob (2.5e5–8e5 D-Re, Achenbach centre)',
    CRISIS_WINDOW_RED[0] === 2.5e5 && CRISIS_WINDOW_RED[1] === 8e5
    && crisisBlend(2.5e5) === 0 && crisisBlend(8e5) === 1);
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
