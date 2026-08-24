/**
 * CALIBRATION vHR3 — CANDIDATE (2026-08-16, NOT ADOPTED). The r17
 * Part-A send-back answered: vHR2's map UNCHANGED, plus the ONE
 * general diagnostic r17 prescribed — separating SMOOTH severe
 * recovery from EDGE/SHOULDER-dictated recovery — with its threshold
 * EARNED by a swept family, not hand-placed around one adversary.
 * Owner's go on record ("if that's the last step before hopefully a
 * final review then go for it"); r18 is intended as the closing
 * review.
 *
 * WHAT r17 PROVED (reviewer-built, verified here): a CONVEX body —
 * rounded nose → constant radius → SHARP AFT SHOULDER → conical
 * closure to a point — passes all three vHR2 guards (no face, no
 * base, no re-expansion) yet its separation is dictated by the
 * shoulder edge, not by recoverable rounded-body physics. It would
 * collect a ~2.5× pressure discount. NASA axisymmetric-afterbody
 * work: smooth→separated purely by afterbody geometry.
 *
 * THE DIAGNOSTIC — SHOULDER SCORE (one number, one knob):
 *   On the aft monotone envelope (the same envelope the frozen
 *   scorer walks), measure closure slopes over FIXED-FRACTION
 *   windows (L/32 — resolution-stable by construction: finer
 *   stations refine the same physical window), take the largest
 *   INCREASE between adjacent windows (a sudden steepening = the
 *   flow asked to turn a corner), and weight it by the frontal-area
 *   fraction where it happens ((r/rMax)² at the steep side) — a
 *   kink at full radius pins a full-width wake; the same kink at a
 *   5%-radius tail tip is aerodynamically trivial (this is also
 *   what keeps the SPHERE quiet: its steepest closure lives at
 *   vanishing radius near the pole).
 *   Dimensionless (slope × area fraction), scale-invariant.
 *
 * WHY NOT "trigger #4 = whatever catches the adversary": the r9
 * kill rule (no bespoke per-body corrections accumulating). The
 * shoulder score is a GENERAL property of the closure curve — the
 * sweep below runs a fillet family from knife-sharp shoulder to
 * fully blended and the score must fall CONTINUOUSLY, with the
 * whole smooth zoo on one side and true edges on the other, before
 * the threshold gets to exist.
 *
 * THRESHOLD: SHOULDER_MAX = 0.25, declared knob — placed mid-gap
 * AFTER measurement (see the sweep + zoo print; the run must show
 * the gap, or the candidate dies here). All other vHR2 semantics
 * carried unchanged (three prior triggers, rounded/pinned lines,
 * rounded ≤ pinned invariant, E2 held-out markers, zero E2 knots).
 *
 * Provenance names all FOUR triggers (r17 hygiene finding applied).
 */
import { buildCalibration } from './calibration.mjs';
import { buildCalibrationHR2, TAU, REEXPANSION, SPHERE_TRANSCRITICAL } from './calibration-hr2.mjs';
import { measureSections, scoreSections } from './sections.mjs';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf, NU_M2_S } from '../../src/dynamicsCore.js';
import {
  makeSphere, makeCube, makePlate, makeTeardrop, makeEllipsoid,
  makeChoppedTeardrop, makeFlatFrontBoatTail, makeNeckBody, makeLathe,
} from '../flow-chamber/shapes.mjs';
import { latheProfile, BODIES } from './tn614-bodies.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHOULDER_MAX = 0.25; // declared knob — earned by the sweep below

/** Shoulder score from a measureSections record (see header).
 * UNITS: A is in raster-cell counts — r converts via m.cell (the same
 * conversion the frozen scorer uses), so slopes are true dr/dx.
 * WEIGHT: area-fraction SQUARED ((r/rMax)⁴). Plain area-fraction is
 * not enough: EVERY smooth closed body ends arbitrarily steep at its
 * tail pole (a sphere's last window has slope → ∞), and the pole's
 * shrinking radius must beat the growing slope. With w², the smooth
 * pole contribution DECAYS (~1/(16·√(1+s²)) for a sphere at L/32
 * windows) while a shoulder at full radius keeps ~its full kink
 * angle. The sweep + zoo below demonstrate the resulting gap
 * empirically — the weight earns its exponent there, not by fiat. */
export function shoulderScore(m) {
  const { A, L, cell } = m;
  const N = A.length, dx = L / N;
  const r = Array.from(A, (a) => Math.sqrt(Math.max(a, 0) * cell * cell / Math.PI));
  const rMax = Math.max(...r);
  if (!(rMax > 0)) return 0;
  const iMax = r.indexOf(rMax);
  // Aft monotone envelope (identical construction to the frozen scorer).
  const env = r.slice();
  for (let i = N - 2; i >= iMax; i--) env[i] = Math.max(env[i], env[i + 1]);
  const k = Math.max(2, Math.round(N / 32)); // fixed-fraction window L/32
  let score = 0;
  for (let j = iMax; j + 2 * k < N; j++) {
    const s1 = (env[j] - env[j + k]) / (k * dx);          // closure slope, window 1
    const s2 = (env[j + k] - env[j + 2 * k]) / (k * dx);  // closure slope, window 2
    const jump = s2 - s1;                                  // sudden steepening only
    if (jump <= 0) continue;
    const w = (env[j + k] / rMax) ** 4;                    // area-fraction², see header
    if (jump * w > score) score = jump * w;
  }
  return score;
}

/** vHR3 classification: vHR2's three triggers + the shoulder score. */
export function classifyMesh3(verts, faces, { axis = '+X' } = {}) {
  const m = measureSections(verts, faces, { axis });
  const sc = scoreSections(m);
  const aMax = Math.max(...m.A);
  let last = m.A.length - 1;
  while (last > 0 && m.A[last] <= 1e-4 * aMax) last--;
  const terminalBaseFrac = aMax > 0 ? m.A[last] / aMax : 1;
  const rawRatio = sc.softAft > 1e-9 ? sc.softAftRaw / sc.softAft : 1;
  const shoulder = shoulderScore(m);
  const cls = (sc.softFore > sc.softAft || terminalBaseFrac > TAU
    || rawRatio > REEXPANSION || shoulder > SHOULDER_MAX) ? 'pinned' : 'rounded';
  return {
    cls, proxy: sc.compositeV1, softAft: sc.softAft, softFore: sc.softFore,
    terminalBaseFrac, rawRatio, shoulder,
  };
}

/** vHR3 = vHR2's two lines (unchanged) behind the four-trigger classifier. */
export function buildCalibrationHR3() {
  const hr2 = buildCalibrationHR2();
  return {
    ...hr2,
    provenance: [
      hr2.provenance[0], hr2.provenance[1],
      `classifier: softFore>softAft OR terminalBase>${TAU} OR rawRatio>${REEXPANSION} OR shoulderScore>${SHOULDER_MAX} → pinned (four scorer-native triggers; r16 #3 + r17 shoulder finding)`,
    ],
  };
}

/* ---- The r17 shoulder adversary + the fillet sweep family ----
 * Rounded (hemispherical) nose → constant radius → shoulder → cone to
 * a point. `blend` = fraction of length over which the corner is
 * smoothed (0 = knife-sharp kink; larger = the slope ramps gradually —
 * a quadratic blend, C1-continuous). Convex for all blend values. */
export function makeShoulderBody(blend = 0, fineness = 3) {
  const NOSE = 0.18, SHOULDER = 0.62; // fractions of length
  const coneSlope = 0.5 / (1 - SHOULDER); // in t-units, closes to a point at t=1
  return makeLathe((t) => {
    if (t < NOSE) return 0.5 * Math.sin((t / NOSE) * Math.PI / 2);
    const b = blend / 2;
    if (t < SHOULDER - b) return 0.5;
    if (t >= SHOULDER + b) return Math.max(0.5 - coneSlope * (t - SHOULDER), 0);
    // quadratic blend: slope ramps 0 → coneSlope across [SHOULDER-b, SHOULDER+b]
    const u = (t - (SHOULDER - b)) / (2 * b);
    return 0.5 - coneSlope * (2 * b) * (u * u) / 2;
  }, fineness);
}

/* ================= FIXTURES + SWEEP (direct execution) ================= */
if (process.argv[1]?.endsWith('calibration-hr3.mjs')) {
  const here = dirname(fileURLToPath(import.meta.url));
  const CORPUS = (f) => join(here, '..', '..', '..', '..', '3D OBJ', f);
  const { parseObjMesh } = await import('../../src/obj.js');
  const { convexHull } = await import('../../src/hull.js');
  function loadCorpus(objName) {
    const m = parseObjMesh(readFileSync(CORPUS(objName), 'utf8'));
    if (m.faces.length) return m;
    return { verts: m.verts, faces: convexHull(m.verts).faces };
  }
  const vnext = buildCalibration();
  const hr3 = buildCalibrationHR3();
  const f3 = (x) => Number(x).toFixed(3);
  const f4 = (x) => Number(x).toFixed(4);
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  console.log('== CALIBRATION vHR3 (four-trigger candidate) ==\n');
  console.log('-- THE SWEEP: shoulder blend 0 (knife) → 0.30 (fully blended); the diagnostic must fall continuously --');
  console.log('blend   proxy   shoulder  class    (at STATIONS 128 vs 256: stability)');
  const sweep = [];
  for (const blend of [0, 0.02, 0.05, 0.08, 0.12, 0.18, 0.24, 0.30]) {
    const mesh = makeShoulderBody(blend);
    const c = classifyMesh3(mesh.verts, mesh.faces, {});
    const m256 = measureSections(mesh.verts, mesh.faces, { STATIONS: 256 });
    const s256 = shoulderScore(m256);
    sweep.push({ blend, ...c, s256 });
    console.log(`${blend.toFixed(2)}    ${f3(c.proxy)}   ${f3(c.shoulder)}     ${c.cls.padEnd(8)} (256st: ${f3(s256)})`);
  }
  check('sweep is MONOTONE falling (sharper shoulder = higher score)',
    sweep.every((s, i) => i === 0 || s.shoulder <= sweep[i - 1].shoulder + 1e-6));
  check('knife-sharp end classified PINNED', sweep[0].cls === 'pinned',
    `shoulder ${f3(sweep[0].shoulder)}`);
  check('fully-blended end classified ROUNDED', sweep[sweep.length - 1].cls === 'rounded',
    `shoulder ${f3(sweep[sweep.length - 1].shoulder)}`);
  check('diagnostic resolution-stable at the sharp end (128 vs 256 stations within 25%)',
    Math.abs(sweep[0].shoulder - sweep[0].s256) < 0.25 * sweep[0].shoulder,
    `${f3(sweep[0].shoulder)} vs ${f3(sweep[0].s256)}`);

  console.log('\n-- ZOO under the fourth trigger (all prior classifications must HOLD) --');
  console.log('body                      class    proxy   shoulder');
  const zoo = [
    ['sphere', makeSphere(), 'rounded'],
    ['cube', makeCube(), 'pinned'],
    ['plate', makePlate(), 'pinned'],
    ['teardrop f3', makeTeardrop(3), 'rounded'],
    ['ellipsoid 3:1', makeEllipsoid(3), 'rounded'],
    ['chopped teardrop', makeChoppedTeardrop(3, 0.7), 'pinned'],
    ['flat-front boat-tail', makeFlatFrontBoatTail(4), 'pinned'],
    ['neck body', makeNeckBody(), 'pinned'],
    ['r17 SHOULDER ADVERSARY (blend 0)', makeShoulderBody(0), 'pinned'],
  ];
  for (const [name, mesh, expect] of zoo) {
    const c = classifyMesh3(mesh.verts, mesh.faces, {});
    console.log(`${name.padEnd(26)}${c.cls.padEnd(9)}${f3(c.proxy)}   ${f3(c.shoulder)}`
      + (c.cls !== expect ? '  <-- EXPECTED ' + expect : ''));
    check(`${name} classified ${expect}`, c.cls === expect,
      `shoulder ${f3(c.shoulder)} fore ${f3(c.softFore)} tb ${f3(c.terminalBaseFrac)}`);
  }
  // The adversary must get vNEXT treatment bit-identically.
  const adv = classifyMesh3(makeShoulderBody(0).verts, makeShoulderBody(0).faces, {});
  check('shoulder adversary pressure BIT-IDENTICAL to frozen vNEXT (no discount)',
    hr3.calibrate(adv.proxy, adv.cls) === vnext.calibrate(adv.proxy),
    f4(hr3.calibrate(adv.proxy, adv.cls)));

  console.log('\n-- LEDGER + PRESETS (vHR2 regressions must hold) --');
  let tnOk = true;
  for (const [, body] of Object.entries(BODIES)) {
    const mesh = latheProfile(body.pts);
    const c = classifyMesh3(mesh.verts, mesh.faces, {});
    if (c.cls !== 'rounded' || hr3.calibrate(c.proxy, c.cls) !== vnext.calibrate(c.proxy)) tnOk = false;
  }
  check('all six TN-614 bodies: rounded, pressure BIT-IDENTICAL', tnOk);
  const reProduct = ((100 / 3.6) * 300) / NU_M2_S;
  console.log('preset          class    proxy   shoulder  vNEXT Cd  vHR3 Cd');
  const PRESETS = [
    ['sunship', 'Sunship.obj', '+Z', 'rounded'], ['cigar', 'cigar.obj', '+Z', 'pinned'],
    ['bottle', 'Bottle.obj', '-Y', 'pinned'], ['car', 'car.obj', '+Z', 'pinned'],
    ['washingmachine', 'washingmachine.obj', '+Y', 'pinned'], ['aerosmena', 'Aerosmena.obj', '+Z', null],
  ];
  for (const [id, objName, axis, expect] of PRESETS) {
    const mesh = loadCorpus(objName);
    const c = classifyMesh3(mesh.verts, mesh.faces, { axis });
    const letter = axis.replace(/^[+-]/, '');
    const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: letter, lengthM: 300 });
    const fr = ittcCf(reProduct) * (g.wettedArea / g.frontalArea);
    console.log(`${id.padEnd(15)} ${c.cls.padEnd(8)}${f3(c.proxy)}   ${f3(c.shoulder)}     ${f4(fr + vnext.calibrate(c.proxy))}    ${f4(fr + hr3.calibrate(c.proxy, c.cls))}`);
    if (expect) check(`${id} stays ${expect}`, c.cls === expect, `shoulder ${f3(c.shoulder)}`);
  }
  check('provenance names all four triggers',
    hr3.provenance.some((p) => p.includes('shoulderScore')));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('CANDIDATE ONLY — production runs frozen vNEXT until r18 + owner adoption.');
  if (fail > 0) process.exitCode = 1;
}
