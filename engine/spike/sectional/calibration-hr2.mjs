/**
 * CALIBRATION vHR2 — CANDIDATE (2026-08-16, NOT ADOPTED). The r16
 * send-back answered: a MECHANISM-AWARE two-line calibration built
 * entirely from diagnostics the frozen scorer already computes.
 * Owner's go: estimator "only worth having if it's semi reliable /
 * been scrutinized" — this candidate exists to be scrutinized (r17).
 * Production runs frozen vNEXT until r17 PASS + owner ruling.
 *
 * WHAT r16 KILLED, AND HOW vHR2 COMPLIES:
 *  - "E2 × sphere-ratio knots are not calibration-grade" → vHR2 has
 *    ZERO E2-derived knots. The scaled values are demoted to
 *    HELD-OUT plausibility markers, printed, never consumed.
 *  - "The prolate 0.269 subcritical reference FAILS (no plateau)" →
 *    gone entirely.
 *  - "No-classifier claim falsified: flat-front boat-tail composite
 *    0.778 ≈ Sunship 0.770, opposite mechanisms" → vHR2 branches on
 *    the MECHANISM, using the scorer's own separated terms:
 *    softAft vs softFore dominance + an objective terminal-base
 *    fraction (the two diagnostics the r16 reviewer named). VS and
 *    cornerPenalty remain rejected for this job.
 *
 * THE TWO LINES:
 *  - ROUNDED line (aft-dominated, smoothly-closing bodies — the
 *    drag-crisis class): streamlined pair (TN-614, real, unchanged)
 *    → sphere-HR knot (Achenbach smooth-sphere transcritical 0.19,
 *    literature grade, smooth-equivalent reference; the ONE
 *    replacement r15/r16 both endorse conceptually) → CLAMPED above
 *    the sphere proxy. Clamp rationale, declared: the only rounded
 *    bodies measured above the sphere's proxy (E2 oblate: measured
 *    supercritical 0.205 still falling; scaled sensitivity 0.220)
 *    sit within ~10–20% of the sphere's own transcritical level —
 *    the crisis rescues the whole rounded class to a similar
 *    plateau. Uncertainty declared: the clamp may sit ~10–20% low
 *    for extreme rounded-bluff bodies.
 *  - PINNED line (fore-dominated faces, chopped tails, boxes —
 *    separation fixed by geometry, NO crisis rescue): the frozen
 *    vNEXT map VERBATIM. Its middle stays conservative screening —
 *    honest, and it can never flatter a face-first impostor.
 *
 * THE CLASSIFIER (two existing diagnostics, one declared threshold):
 *    pinned  iff  softFore > softAft  OR  terminalBaseFrac > TAU
 *    rounded otherwise.
 *  terminalBaseFrac = A(last station)/A_max — objective, computed
 *  from the scorer's own A(x) record (the scorer already charges
 *  the terminal base full price as infinite-slope closure; this
 *  merely EXPOSES that quantity). TAU = 0.20, declared knob: the
 *  measured corpus separates by an order of magnitude (smooth
 *  closers < 0.02; chopped teardrop 0.49; cylinders/boxes 1.0) —
 *  the threshold sits in an empty decade, printed for inspection.
 *
 * WHY THE BRANCH MATTERS (the r16 danger, kept in view): lowering
 * the rounded line WITHOUT the branch hands the crisis discount to
 * fore-pinned bodies — the estimator's first flattering error
 * class. Under vHR2 the flat-front boat-tail's prediction is
 * BIT-IDENTICAL to frozen vNEXT (fixture 1).
 *
 * Failure semantics identical to vNEXT: non-finite → NaN.
 */
import { buildCalibration, frictionCdAt, REF_RE } from './calibration.mjs';
import { measureSections, scoreSections } from './sections.mjs';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf, NU_M2_S } from '../../src/dynamicsCore.js';
import {
  makeSphere, makeCube, makePlate, makeTeardrop, makeEllipsoid,
  makeChoppedTeardrop, makeFlatFrontBoatTail, makeNeckBody,
} from '../flow-chamber/shapes.mjs';
import { latheProfile, BODIES, TEST_RE } from './tn614-bodies.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SPHERE_TRANSCRITICAL = 0.19; // Achenbach 1972, smooth-equivalent (literature grade)
export const TAU = 0.05;        // terminal-base threshold — declared knob (see gap note below)
export const REEXPANSION = 1.15; // raw/enveloped aft ratio guard — declared knob (see below)

/**
 * Full mechanism-aware measurement: scores + terminal-base + class.
 * THREE pinned triggers, each a scorer-native diagnostic:
 *  (a) fore-dominated (softFore > softAft): face-like front — fixed
 *      separation at the face, no crisis rescue (r16 counterexample #1).
 *  (b) terminal base > TAU: chopped/flat aft — separation pinned at
 *      the base edge (r16 counterexample #2). Measured at the last
 *      OCCUPIED station (A > 0.01% of Amax) — the literal last bbox
 *      station is fragile to meshes carrying orphan vertices beyond
 *      the geometry (the chopped-teardrop constructor does exactly
 *      that; found by this candidate's own fixture run). TAU = 0.05
 *      sits in a measured 20× empty span: smooth closers ≤ 0.008
 *      (discretization pole ring), the mildest pinned body (chopped
 *      teardrop) 0.181; first TAU draft (0.20) sat INSIDE the
 *      population and was caught by the fixtures — moved with the
 *      measurement on record, not silently.
 *  (c) re-expansion (softAftRaw > softAft × REEXPANSION): the raw
 *      walk exceeding the monotone-envelope walk means the body
 *      re-expands after a contraction — a wake trapped mid-body,
 *      which turbulent attachment does not rescue. Guard found by
 *      THIS candidate's zoo (the r9 neck adversary classified
 *      rounded without it — a flattering alias r16 did not name).
 */
export function classifyMesh(verts, faces, { axis = '+X' } = {}) {
  const m = measureSections(verts, faces, { axis });
  const sc = scoreSections(m);
  const aMax = Math.max(...m.A);
  let last = m.A.length - 1;
  while (last > 0 && m.A[last] <= 1e-4 * aMax) last--;
  const terminalBaseFrac = aMax > 0 ? m.A[last] / aMax : 1;
  const rawRatio = sc.softAft > 1e-9 ? sc.softAftRaw / sc.softAft : 1;
  const cls = (sc.softFore > sc.softAft || terminalBaseFrac > TAU || rawRatio > REEXPANSION)
    ? 'pinned' : 'rounded';
  return {
    cls, proxy: sc.compositeV1, softAft: sc.softAft, softFore: sc.softFore,
    terminalBaseFrac, rawRatio,
  };
}

/** Build the vHR2 candidate. */
export function buildCalibrationHR2() {
  const vnext = buildCalibration();
  if (vnext.knots.length !== 4 || vnext.knots[1][0] > 0.2 || vnext.knots[3][0] < 0.95) {
    throw new Error('vNEXT knot layout changed — vHR2 carry-over assumptions invalid');
  }
  const sphere = makeSphere();
  const sphereKnot = [
    scoreSections(measureSections(sphere.verts, sphere.faces, {})).compositeV1,
    SPHERE_TRANSCRITICAL - frictionCdAt(sphere, REF_RE),
  ];
  const roundedKnots = [...vnext.knots.slice(0, 2), sphereKnot];
  for (let i = 0; i + 1 < roundedKnots.length; i++) {
    if (!(roundedKnots[i][1] <= roundedKnots[i + 1][1]) || !Number.isFinite(roundedKnots[i][1])) {
      throw new Error('vHR2 rounded line not monotone/finite');
    }
  }
  const calibrateRounded = (x) => {
    if (!Number.isFinite(x)) return NaN;
    const k = roundedKnots;
    if (x <= k[0][0]) return Math.max(0, k[0][1] * (x / k[0][0] || 0));
    for (let i = 0; i + 1 < k.length; i++) {
      if (x <= k[i + 1][0]) {
        const t = (x - k[i][0]) / (k[i + 1][0] - k[i][0]);
        return k[i][1] + t * (k[i + 1][1] - k[i][1]);
      }
    }
    return k[k.length - 1][1]; // CLAMP above the sphere knot (declared)
  };
  const calibratePinned = vnext.calibrate; // frozen vNEXT VERBATIM

  const calibrate = (proxy, cls) => (cls === 'rounded' ? calibrateRounded(proxy) : calibratePinned(proxy));
  return {
    roundedKnots, pinnedKnots: vnext.knots, calibrate, calibrateRounded, calibratePinned,
    provenance: [
      'rounded: TN614-111 + TN614-332 (real, unchanged) + sphere-HR (Achenbach transcritical 0.19, literature grade) + clamp',
      'pinned: frozen vNEXT verbatim (conservative screening; no crisis rescue for fixed separation)',
      `classifier: softFore>softAft OR terminalBase>${TAU} OR rawRatio>${REEXPANSION} → pinned (scorer-native diagnostics; r16 finding #3 + the re-expansion guard; r17 hygiene fix — this line previously omitted the third trigger)`,
    ],
  };
}

/* ================= FIXTURES + LEDGER (direct execution) ================= */
if (process.argv[1]?.endsWith('calibration-hr2.mjs')) {
  const here = dirname(fileURLToPath(import.meta.url));
  const CORPUS = (f) => join(here, '..', '..', '..', '..', '3D OBJ', f);
  const { parseObjMesh } = await import('../../src/obj.js');
  const { parseGlbVertices } = await import('../../src/glb.js');
  const { convexHull } = await import('../../src/hull.js');
  const GLB = (id) => join(here, '..', '..', '..', 'site', 'assets', 'shape-models', `${id}.glb`);
  function loadPreset(id, objName) {
    if (objName && existsSync(CORPUS(objName))) {
      const m = parseObjMesh(readFileSync(CORPUS(objName), 'utf8'));
      if (m.faces.length) return m;
      return { verts: m.verts, faces: convexHull(m.verts).faces };
    }
    const verts = parseGlbVertices(new Uint8Array(readFileSync(GLB(id))));
    return { verts, faces: convexHull(verts).faces };
  }

  const vnext = buildCalibration();
  const hr2 = buildCalibrationHR2();
  const f3 = (x) => Number(x).toFixed(3);
  const f4 = (x) => Number(x).toFixed(4);
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  console.log('== CALIBRATION vHR2 (mechanism-aware candidate) ==\n');
  console.log('rounded knots: ' + hr2.roundedKnots.map(([p, c]) => `${f3(p)}→${f4(c)}`).join('  ') + '  then CLAMP');
  console.log('pinned knots:  ' + hr2.pinnedKnots.map(([p, c]) => `${f3(p)}→${f4(c)}`).join('  ') + '  (= frozen vNEXT)');

  console.log('\n-- CLASSIFICATION ZOO (mechanism made visible) --');
  console.log('body                      class    proxy   softAft softFore termBase rawRatio');
  const zoo = [
    ['sphere', makeSphere(), 'rounded'],
    ['cube', makeCube(), 'pinned'],
    ['plate', makePlate(), 'pinned'],
    ['teardrop f3', makeTeardrop(3), 'rounded'],
    ['ellipsoid 3:1', makeEllipsoid(3), 'rounded'],
    ['CHOPPED teardrop (r16 #2)', makeChoppedTeardrop(3, 0.7), 'pinned'],
    ['FLAT-FRONT boat-tail (r16 #1)', makeFlatFrontBoatTail(4), 'pinned'],
    ['neck body (re-expansion)', makeNeckBody(), 'pinned'],
  ];
  const zc = {};
  for (const [name, mesh, expect] of zoo) {
    const c = classifyMesh(mesh.verts, mesh.faces, {});
    zc[name] = c;
    console.log(`${name.padEnd(26)}${c.cls.padEnd(9)}${f3(c.proxy)}   ${f3(c.softAft)}   ${f3(c.softFore)}    ${f3(c.terminalBaseFrac)}    ${f3(c.rawRatio)}`
      + (expect && c.cls !== expect ? '  <-- EXPECTED ' + expect : ''));
  }

  console.log('\n-- r16 REQUIRED FIXTURES --');
  // (1) flat-front alias must NOT receive the rounded discount — bit-identical to vNEXT.
  const ff = zc['FLAT-FRONT boat-tail (r16 #1)'];
  check('(1) flat-front boat-tail classified PINNED', ff.cls === 'pinned',
    `fore ${f3(ff.softFore)} > aft ${f3(ff.softAft)}`);
  check('(1) its calibrated pressure is BIT-IDENTICAL to frozen vNEXT',
    hr2.calibrate(ff.proxy, ff.cls) === vnext.calibrate(ff.proxy),
    f4(hr2.calibrate(ff.proxy, ff.cls)));
  // (2) chopped teardrop recognized as terminal-base/pinned.
  const ch = zc['CHOPPED teardrop (r16 #2)'];
  check('(2) chopped teardrop classified PINNED via terminal base', ch.cls === 'pinned',
    `termBase ${f3(ch.terminalBaseFrac)} > TAU ${TAU}`);
  check('(2) its calibrated pressure is BIT-IDENTICAL to frozen vNEXT',
    hr2.calibrate(ch.proxy, ch.cls) === vnext.calibrate(ch.proxy));
  // (2b) builder-added: the re-expansion alias found by this candidate's zoo.
  const nk = zc['neck body (re-expansion)'];
  check('(2b) neck body classified PINNED via re-expansion guard', nk.cls === 'pinned',
    `rawRatio ${f3(nk.rawRatio)} > ${REEXPANSION}`);
  check('(2b) its calibrated pressure is BIT-IDENTICAL to frozen vNEXT',
    hr2.calibrate(nk.proxy, nk.cls) === vnext.calibrate(nk.proxy));
  // (3) Sunship fixtures its dominant term.
  const sun = loadPreset('sunship', 'Sunship.obj');
  const sc = classifyMesh(sun.verts, sun.faces, { axis: '+Z' });
  check('(3) Sunship +Z is AFT-dominated (softAft > 10× softFore)',
    sc.softAft > 10 * sc.softFore, `aft ${f3(sc.softAft)} vs fore ${f3(sc.softFore)}`);
  check('(3) Sunship classified ROUNDED with negligible terminal base',
    sc.cls === 'rounded' && sc.terminalBaseFrac < 0.05, `termBase ${f3(sc.terminalBaseFrac)}`);
  // (4) TN-614 + Akron bit-identical (rounded class; at/below the shared knots).
  let tnIdentical = true;
  for (const [name, body] of Object.entries(BODIES)) {
    const mesh = latheProfile(body.pts);
    const c = classifyMesh(mesh.verts, mesh.faces, {});
    const a = hr2.calibrate(c.proxy, c.cls), b = vnext.calibrate(c.proxy);
    if (a !== b || c.cls !== 'rounded') { tnIdentical = false; console.log(`    TN-614 ${name}: ${c.cls} ${f4(a)} vs ${f4(b)}`); }
  }
  check('(4) all six TN-614 bodies: rounded class, calibrated pressure BIT-IDENTICAL', tnIdentical);
  {
    const L_IN = 19.62 * 12;
    const AKRON = [[0, 0], [0.02, 4.95], [0.05, 9.96], [0.10, 14.20], [0.15, 16.65], [0.20, 18.39], [0.25, 19.12], [0.30, 19.61], [0.35, 19.85], [0.40, 19.90], [0.45, 19.90], [0.50, 19.80], [0.55, 19.59], [0.60, 19.12], [0.65, 18.46], [0.70, 17.50], [0.75, 16.15], [0.80, 14.44], [0.85, 12.29], [0.90, 9.61], [0.95, 6.52], [1.00, 0]];
    const mesh = latheProfile(AKRON.map(([aL, rIn]) => [aL * 100, (rIn / L_IN) * 100]), 128, 36);
    const c = classifyMesh(mesh.verts, mesh.faces, {});
    check('(4) Akron: rounded class, calibrated pressure BIT-IDENTICAL',
      c.cls === 'rounded' && hr2.calibrate(c.proxy, c.cls) === vnext.calibrate(c.proxy),
      `proxy ${f3(c.proxy)}`);
  }
  // (5) both lines finite + monotone + NaN semantics.
  let mono = true, finite = true;
  for (let x = 0, prevR = -1, prevP = -1; x <= 1.6; x += 0.01) {
    const r = hr2.calibrateRounded(x), p = hr2.calibratePinned(x);
    if (!Number.isFinite(r) || !Number.isFinite(p)) finite = false;
    if (r < prevR - 1e-12 || p < prevP - 1e-12) mono = false;
    prevR = r; prevP = p;
  }
  check('(5) both lines finite over [0, 1.6]', finite);
  check('(5) both lines monotone', mono);
  check('(5) calibrate(NaN) is NaN on both lines',
    Number.isNaN(hr2.calibrateRounded(NaN)) && Number.isNaN(hr2.calibratePinned(NaN)));
  check('(5) rounded ≤ pinned everywhere (the discount never inverts)',
    (() => { for (let x = 0; x <= 1.6; x += 0.01) if (hr2.calibrateRounded(x) > hr2.calibratePinned(x) + 1e-12) return false; return true; })());
  // (6) band: display ruling parked by the owner — no band code exists in this candidate (nothing to fixture).

  console.log('\n-- E2 HELD-OUT plausibility (markers, never knots — r16 finding #1) --');
  const prolateProfile = (() => { const pts = []; for (let i = 0; i <= 64; i++) { const th = Math.PI * i / 64, xPct = 50 * (1 - Math.cos(th)), t = (xPct - 50) / 50; pts.push([xPct, (100 / 360) * 100 / 2 * 0 + (200 / 2 / 360) * 100 * Math.sqrt(Math.max(0, 1 - t * t))]); } return pts; })();
  const prol = latheProfile(prolateProfile, 128, 36);
  const pc = classifyMesh(prol.verts, prol.faces, {});
  console.log(`E2 prolate 1:1.8: class ${pc.cls}, proxy ${f3(pc.proxy)} → rounded-line pressure ${f4(hr2.calibrate(pc.proxy, pc.cls))}`
    + ` | markers: ×0.38 sensitivity 0.1022 · measured trend ≥0.084 (rising, Re_L ~1e6)`);
  const obl = latheProfile((() => { const pts = []; for (let i = 0; i <= 64; i++) { const th = Math.PI * i / 64, xPct = 50 * (1 - Math.cos(th)), t = (xPct - 50) / 50; pts.push([xPct, (200 / 2 / 150) * 100 * Math.sqrt(Math.max(0, 1 - t * t))]); } return pts; })(), 128, 36);
  const oc = classifyMesh(obl.verts, obl.faces, {});
  console.log(`E2 oblate 1:0.75: class ${oc.cls}, proxy ${f3(oc.proxy)} → rounded-line pressure ${f4(hr2.calibrate(oc.proxy, oc.cls))} (clamp)`
    + ` | markers: measured supercritical 0.205 (falling) · ×0.38 sensitivity 0.2204`);

  console.log('\n-- PRODUCT PRESETS at 300 m / 100 km/h (bare hull, authored axis) --');
  const reProduct = ((100 / 3.6) * 300) / NU_M2_S;
  const PRESETS = [
    ['sunship', 'Sunship.obj', '+Z'], ['cigar', 'cigar.obj', '+Z'], ['bottle', 'Bottle.obj', '-Y'],
    ['car', 'car.obj', '+Z'], ['washingmachine', 'washingmachine.obj', '+Y'], ['aerosmena', 'Aerosmena.obj', '+Z'],
  ];
  console.log('preset          class    proxy   softAft softFore termBase rawRatio  vNEXT Cd  vHR2 Cd');
  for (const [id, objName, axis] of PRESETS) {
    const mesh = loadPreset(id, objName);
    const c = classifyMesh(mesh.verts, mesh.faces, { axis });
    const letter = axis.replace(/^[+-]/, '');
    const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: letter, lengthM: 300 });
    const fr = ittcCf(reProduct) * (g.wettedArea / g.frontalArea);
    console.log(`${id.padEnd(15)} ${c.cls.padEnd(8)}${f3(c.proxy)}   ${f3(c.softAft)}   ${f3(c.softFore)}    ${f3(c.terminalBaseFrac)}    ${f3(c.rawRatio)}     ${f4(fr + vnext.calibrate(c.proxy))}    ${f4(fr + hr2.calibrate(c.proxy, c.cls))}`);
  }
  console.log('\nNOTE (honest, for r17): the corpus cigar mesh is a POINT-HULL whose');
  console.log('nose is hull-flattened — its 0.499 proxy is FORE-dominated (aft only');
  console.log('0.253), so vHR2 honestly classifies it pinned and it keeps the harsh');
  console.log('number. The queued faced-cigar mesh (round nose) would classify');
  console.log('rounded on its aft score. The estimator measures what it is given.');

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('CANDIDATE ONLY — production runs frozen vNEXT until r17 + owner adoption.');
  if (fail > 0) process.exitCode = 1;
}
