/**
 * CALIBRATION vHR4 — CANDIDATE (2026-08-16, NOT ADOPTED). The r18
 * Part-A send-back answered by REPLACING (not augmenting) the fourth
 * diagnostic, exactly per the reviewer's prescription:
 *
 *   OLD (vHR3): Δslope × (r/rMax)⁴ — the w⁴ existed only to tame the
 *   sphere pole's slope singularity, and r18 proved it over-pays: a
 *   ~26° tangent break at 75% radius (56% of max area!) lost 68% of
 *   its signal to the weight and classified ROUNDED (score ~0.12 vs
 *   threshold 0.25) — a 2.4× discount for a real corner.
 *
 *   NEW: **Δθ × (r/rMax)²** — tangent-ANGLE jump (θ = atan(slope),
 *   bounded: a sphere's surface angle merely tends to 90°, so no
 *   singularity exists and the weight can mean what it says: the
 *   actual affected area fraction. Sphere analytic ceiling at L/32
 *   windows: Δθ·cos²φ = (Δx/R)·cosφ ≤ 1/16 = 0.0625, maximal at the
 *   equator, DECAYING at the pole — the pole tames itself.
 *
 * THRESHOLD: SHOULDER_ANGLE_MAX = 0.13 (see the five-field comment at
 * the constant below — r19 corrected a stale 0.15 here). VALIDATED
 * CATCH REGION, stated conservatively per the r19 ruling: at the
 * production sampling settings, ~26° or sharper abrupt aft tangent
 * breaks at ≥~70% of maximum radius were caught in the prescribed
 * family (r19's independent constant-angle sweep: 0.70→0.161/0.182,
 * 0.75→0.184/0.210, pinned at both resolutions). Detection improves
 * with corner severity and affected radius, but DEEPER CORNERS ARE
 * NOT GUARANTEED (r19 falsified a naive Δθ·w²>0.13 analytic
 * boundary: a 45° break at ~44% radius read 0.125/0.139 —
 * straddling the threshold across resolutions).
 *
 * Also fixed per r18: the vHR3 header/implementation doc mismatch
 * (the old file said (r/rMax)² in one place and implemented ⁴ —
 * vHR3 stays frozen as history; this file is the revision).
 * Everything else carried from vHR2/vHR3 unchanged: three prior
 * triggers, two lines, rounded ≤ pinned, zero E2 knots.
 */
import { buildCalibration } from './calibration.mjs';
import { buildCalibrationHR2, TAU, REEXPANSION } from './calibration-hr2.mjs';
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

/* THRESHOLD + config, set from the window sweep (sweep-window.mjs,
 * 2026-08-16) with the DETECTION LIMIT DECLARED rather than hidden:
 * the sweep discovered the smooth-body floor is MESH FACETING (real
 * corners in the given geometry — sphere 28×18 scores 0.118, 56×36
 * 0.071, 96×64 0.059 at L/48 sw3; window size and raster RES both
 * ruled out as levers). Consequence: no config opens a wide gap —
 * modest corners (~26°) at ≤~55% radius occupy the same band as
 * practical mesh faceting and are BELOW the guarantee. At L/48 sw3,
 * threshold 0.13 sits between the fattest real smooth body measured
 * (corpus Sunship 0.102, default sphere 0.118) and the r18 adversary
 * (0.144) — margins ~10% both sides, declared thin. VALIDATED CATCH
 * REGION (r19 wording): ~26° or sharper abrupt aft breaks at ≥~70%
 * radius, caught in the prescribed family at production settings;
 * detection improves with severity/radius but deeper corners are NOT
 * guaranteed. Floor wording (r19): DOMINATED by real mesh faceting;
 * raster resolution contributes a smaller residual (reviewer
 * measured 0.118/0.136/0.125/0.128 across RES 160–480). DECLARED
 * RESIDUAL RISK (r19, replacing an over-claimed "bounded 2×"):
 * moderate/deep shoulders may receive the rounded line; local
 * affected section shrinks with radius (~30% of max at 55%) and the
 * two BRANCHES differ ~2× there — but the resulting absolute
 * aerodynamic error is NOT independently quantified. ACCEPTED at
 * r19 as a declared limit (equal-A(x) precedent); the limit belongs
 * to THIS pinned metrology configuration (see fixture). */
export const SHOULDER_ANGLE_MAX = 0.13;
export const SHOULDER_OPTS = { kFrac: 48, smoothW: 3 };

/** Angle-based shoulder score (see header).
 * opts.kFrac: window = L/kFrac (default 32) · opts.smoothW: centred
 * moving-average width for the anti-raster filter (default 3; 1 = off).
 * Defaults are THE production values, chosen by the window sweep
 * (sweep-window.mjs) — change only with a fresh sweep on record. */
export function shoulderAngleScore(m, { kFrac = 32, smoothW = 3 } = {}) {
  const { A, L, cell } = m;
  const N = A.length, dx = L / N;
  const r = Array.from(A, (a) => Math.sqrt(Math.max(a, 0) * cell * cell / Math.PI));
  const rMax = Math.max(...r);
  if (!(rMax > 0)) return 0;
  const iMax = r.indexOf(rMax);
  const env = r.slice();
  for (let i = N - 2; i >= iMax; i--) env[i] = Math.max(env[i], env[i + 1]);
  // Anti-raster filter (documented, narrow): the raster A(x) quantizes
  // r by ~cell/2, injecting slope noise ~0.1 into endpoint-difference
  // windows — measured on the sphere as +0.08 over its analytic
  // ceiling. A width-3 centred average removes most of it while a
  // kink's angle change (spread over ≤3 stations) still lands almost
  // entirely inside one k=4 window. Smoothing width < window width —
  // the corner survives, the noise does not.
  const sm = env.slice();
  if (smoothW >= 3) {
    const h = Math.floor(smoothW / 2);
    for (let i = Math.max(iMax, h); i < N - h; i++) {
      let s = 0;
      for (let d = -h; d <= h; d++) s += env[i + d];
      sm[i] = s / (2 * h + 1);
    }
  }
  const k = Math.max(2, Math.round(N / kFrac));
  let score = 0;
  for (let j = iMax; j + 2 * k < N; j++) {
    const th1 = Math.atan((sm[j] - sm[j + k]) / (k * dx));
    const th2 = Math.atan((sm[j + k] - sm[j + 2 * k]) / (k * dx));
    const jump = th2 - th1; // sudden steepening of the surface ANGLE
    if (jump <= 0) continue;
    const w = (sm[j + k] / rMax) ** 2; // true affected-area fraction
    if (jump * w > score) score = jump * w;
  }
  return score;
}

/** vHR4 classification: three vHR2 triggers + the angle-based shoulder. */
export function classifyMesh4(verts, faces, { axis = '+X' } = {}) {
  const m = measureSections(verts, faces, { axis });
  const sc = scoreSections(m);
  const aMax = Math.max(...m.A);
  let last = m.A.length - 1;
  while (last > 0 && m.A[last] <= 1e-4 * aMax) last--;
  const terminalBaseFrac = aMax > 0 ? m.A[last] / aMax : 1;
  const rawRatio = sc.softAft > 1e-9 ? sc.softAftRaw / sc.softAft : 1;
  const shoulder = shoulderAngleScore(m, SHOULDER_OPTS);
  const cls = (sc.softFore > sc.softAft || terminalBaseFrac > TAU
    || rawRatio > REEXPANSION || shoulder > SHOULDER_ANGLE_MAX) ? 'pinned' : 'rounded';
  return {
    cls, proxy: sc.compositeV1, softAft: sc.softAft, softFore: sc.softFore,
    terminalBaseFrac, rawRatio, shoulder,
  };
}

export function buildCalibrationHR4() {
  const hr2 = buildCalibrationHR2();
  return {
    ...hr2,
    provenance: [
      hr2.provenance[0], hr2.provenance[1],
      `classifier: softFore>softAft OR terminalBase>${TAU} OR rawRatio>${REEXPANSION} OR shoulderAngleScore>${SHOULDER_ANGLE_MAX} → pinned (four scorer-native triggers; angle-based shoulder per r18)`,
    ],
  };
}

/* Two-parameter shoulder family (the r18-prescribed 2D sweep):
 * rounded nose → cylinder → gentle taper (~6°-class) down to rSh·rMax
 * → tangent break (blended over `blend` of length) → cone to a point.
 * rSh = 1 reduces to the r17 full-radius family shape-class; rSh 0.75
 * with blend 0 is the r18 adversary's class. Convex for all params. */
export function makeShoulderAt(blend = 0, rSh = 0.75, fineness = 3) {
  const NOSE = 0.18, CYL = 0.40, KINK = 0.80;
  const taperSlope = (0.5 - 0.5 * rSh) / (KINK - CYL);
  const coneSlope = (0.5 * rSh) / (1 - KINK);
  const rAt = (t) => {
    if (t < NOSE) return 0.5 * Math.sin((t / NOSE) * Math.PI / 2);
    if (t < CYL) return 0.5;
    if (t < KINK) return 0.5 - taperSlope * (t - CYL);
    return Math.max(0.5 * rSh - coneSlope * (t - KINK), 0);
  };
  const b = blend / 2;
  return makeLathe((t) => {
    if (b <= 0 || t < KINK - b || t >= KINK + b) return rAt(t);
    // quadratic blend of the tangent break across [KINK-b, KINK+b]
    const u = (t - (KINK - b)) / (2 * b);
    const r0 = rAt(KINK - b);
    return r0 - taperSlope * (t - (KINK - b)) - (coneSlope - taperSlope) * (2 * b) * (u * u) / 2;
  }, fineness);
}

/* ================= FIXTURES + 2D SWEEP (direct execution) ================= */
if (process.argv[1]?.endsWith('calibration-hr4.mjs')) {
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
  const hr4 = buildCalibrationHR4();
  const f3 = (x) => Number(x).toFixed(3);
  const f4 = (x) => Number(x).toFixed(4);
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  console.log('== CALIBRATION vHR4 (angle-based shoulder, 2D-swept) ==\n');
  console.log('-- THE 2D SWEEP: blend (sharpness) × rSh (shoulder radius) --');
  console.log('rSh\\blend   0.00      0.05      0.12      0.30');
  const grid = {};
  for (const rSh of [1.0, 0.75, 0.55, 0.35]) {
    const row = [];
    for (const blend of [0, 0.05, 0.12, 0.30]) {
      const mesh = makeShoulderAt(blend, rSh);
      const c = classifyMesh4(mesh.verts, mesh.faces, {});
      grid[`${rSh}/${blend}`] = c;
      row.push(`${f3(c.shoulder)}${c.cls === 'pinned' ? 'P' : 'r'}`);
    }
    console.log(`${rSh.toFixed(2)}       ${row.join('    ')}`);
  }
  check('sharp full-radius shoulder PINNED (r17 class)', grid['1/0'].cls === 'pinned', f3(grid['1/0'].shoulder));
  check('THE r18 ADVERSARY CLASS (sharp, rSh 0.75) now PINNED', grid['0.75/0'].cls === 'pinned', f3(grid['0.75/0'].shoulder));
  // r19 LABELLING CORRECTION: makeShoulderAt does NOT hold the corner
  // angle constant as rSh changes (0.75 → ~26.1° jump; 0.55 → ~14.0°;
  // 0.35 → the upstream corner dominates). This family member is a
  // ~14° corner at 55% radius — recorded as such, below guarantee.
  check('family 0.55 member (~14° corner) scores below threshold',
    grid['0.55/0'].shoulder < 0.13, f3(grid['0.55/0'].shoulder));

  // r19 REQUIRED FIXTURE: the FIXED-ANGLE radius sweep — the corner
  // held at 6°→32° (~26° jump) BY CONSTRUCTION while only its radius
  // moves. .70/.75 must be PINNED; .55 explicitly below guarantee;
  // .60/.65 record the transition (not a threshold-selection).
  console.log('\n-- r19 FIXED-26° RADIUS SWEEP (angle constant by construction) --');
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
  const fx = {};
  for (const rSh of [0.55, 0.60, 0.65, 0.70, 0.75]) {
    const mesh = fixedAngle(rSh);
    const c = classifyMesh4(mesh.verts, mesh.faces, {});
    fx[rSh] = c;
    console.log(`26°@${rSh}: shoulder ${f3(c.shoulder)} → ${c.cls}`);
  }
  check('r19 GUARANTEE: 26°@0.70 PINNED', fx[0.70].cls === 'pinned', f3(fx[0.70].shoulder));
  check('r19 GUARANTEE: 26°@0.75 PINNED', fx[0.75].cls === 'pinned', f3(fx[0.75].shoulder));
  check('r19 DECLARED LIMIT: 26°@0.55 below guarantee (rounded)', fx[0.55].cls === 'rounded', f3(fx[0.55].shoulder));
  console.log(`  transition record (not asserted): 0.60 → ${fx[0.60].cls} (${f3(fx[0.60].shoulder)}), 0.65 → ${fx[0.65].cls} (${f3(fx[0.65].shoulder)})`);

  // r19 REQUIRED FIXTURE: the metrology-configuration pin — the
  // documented detection limit belongs to THIS configuration.
  check('METROLOGY PIN: kFrac 48 · smoothW 3 · threshold 0.13',
    SHOULDER_OPTS.kFrac === 48 && SHOULDER_OPTS.smoothW === 3 && SHOULDER_ANGLE_MAX === 0.13);
  check('fully blended full-radius body ROUNDED', grid['1/0.3'].cls === 'rounded', f3(grid['1/0.3'].shoulder));
  check('sweep monotone in blend at every radius',
    [1.0, 0.75, 0.55, 0.35].every((rSh) => {
      const s = [0, 0.05, 0.12, 0.30].map((b) => grid[`${rSh}/${b}`].shoulder);
      return s.every((v, i) => i === 0 || v <= s[i - 1] + 1e-6);
    }));
  // NOTE (honest, replaces a misconceived monotonicity-in-radius
  // assertion): at small rSh this FAMILY grows a SECOND corner — the
  // cylinder→taper onset steepens as the taper must drop further —
  // and the diagnostic correctly reports the WORST corner wherever it
  // is. The right invariant is that every knife-sharp member stays
  // pinned, which the column check above asserts per-radius.
  check('GUARANTEE BAND: sharp shoulders at rSh ≥ 0.75 PINNED (0.55 declared below limit)',
    grid['1/0'].cls === 'pinned' && grid['0.75/0'].cls === 'pinned');
  check('deep sharp shoulder (0.35, second-corner regime) PINNED', grid['0.35/0'].cls === 'pinned',
    f3(grid['0.35/0'].shoulder));

  console.log('\n-- THE REVIEWER\'S EXACT r18 BODY (their published profile, verbatim) --');
  const r18body = makeLathe((t) => {
    if (t < 0.18) return 0.5 * Math.sin((t / 0.18) * Math.PI / 2);
    if (t < 0.40) return 0.5;
    if (t < 0.80) return 0.5 - (0.125 / 0.40) * (t - 0.40);
    return Math.max(0.375 - (0.375 / 0.20) * (t - 0.80), 0);
  }, 3);
  const rb = classifyMesh4(r18body.verts, r18body.faces, {});
  const rb256 = shoulderAngleScore(measureSections(r18body.verts, r18body.faces, { STATIONS: 256 }));
  console.log(`proxy ${f3(rb.proxy)} · shoulder ${f3(rb.shoulder)} (256st ${f3(rb256)}) · fore ${f3(rb.softFore)} · tb ${f3(rb.terminalBaseFrac)} · raw ${f3(rb.rawRatio)}`);
  check('r18 adversary classified PINNED', rb.cls === 'pinned');
  check('its pressure BIT-IDENTICAL to frozen vNEXT (no discount)',
    hr4.calibrate(rb.proxy, rb.cls) === vnext.calibrate(rb.proxy), f4(hr4.calibrate(rb.proxy, rb.cls)));
  check('CLASSIFICATION resolution-stable (pinned at both 128 and 256 stations)',
    rb.shoulder > 0.13 && rb256 > 0.13, `${f3(rb.shoulder)} vs ${f3(rb256)} (both > 0.13)`);

  console.log('\n-- ZOO (every prior classification must HOLD) --');
  const zoo = [
    ['sphere', makeSphere(), 'rounded'], ['cube', makeCube(), 'pinned'],
    ['plate', makePlate(), 'pinned'], ['teardrop f3', makeTeardrop(3), 'rounded'],
    ['ellipsoid 3:1', makeEllipsoid(3), 'rounded'],
    ['chopped teardrop', makeChoppedTeardrop(3, 0.7), 'pinned'],
    ['flat-front boat-tail', makeFlatFrontBoatTail(4), 'pinned'],
    ['neck body', makeNeckBody(), 'pinned'],
  ];
  for (const [name, mesh, expect] of zoo) {
    const c = classifyMesh4(mesh.verts, mesh.faces, {});
    check(`${name} stays ${expect}`, c.cls === expect, `shoulder ${f3(c.shoulder)}`);
  }
  // FACET-FLOOR documentation (the sweep's discovery): the default
  // 28×18 sphere's 0.118 is its own faceting, not noise — density
  // drives it toward the analytic smooth value.
  check('default sphere below threshold (rounded) despite facet floor',
    classifyMesh4(makeSphere().verts, makeSphere().faces, {}).shoulder < 0.13);
  check('FACET FLOOR: dense 56×36 sphere scores materially lower (faceting confirmed as the floor)',
    classifyMesh4(makeSphere(56, 36).verts, makeSphere(56, 36).faces, {}).shoulder < 0.09);

  console.log('\n-- LEDGER + PRESETS --');
  let tnOk = true;
  for (const [, body] of Object.entries(BODIES)) {
    const mesh = latheProfile(body.pts);
    const c = classifyMesh4(mesh.verts, mesh.faces, {});
    if (c.cls !== 'rounded' || hr4.calibrate(c.proxy, c.cls) !== vnext.calibrate(c.proxy)) tnOk = false;
  }
  check('all six TN-614 bodies: rounded, pressure BIT-IDENTICAL', tnOk);
  const reProduct = ((100 / 3.6) * 300) / NU_M2_S;
  console.log('preset          class    shoulder  vNEXT Cd  vHR4 Cd');
  for (const [id, objName, axis, expect] of [
    ['sunship', 'Sunship.obj', '+Z', 'rounded'], ['cigar', 'cigar.obj', '+Z', 'pinned'],
    ['bottle', 'Bottle.obj', '-Y', 'pinned'], ['car', 'car.obj', '+Z', 'pinned'],
    ['washingmachine', 'washingmachine.obj', '+Y', 'pinned'], ['aerosmena', 'Aerosmena.obj', '+Z', null],
  ]) {
    const mesh = loadCorpus(objName);
    const c = classifyMesh4(mesh.verts, mesh.faces, { axis });
    const letter = axis.replace(/^[+-]/, '');
    const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: letter, lengthM: 300 });
    const fr = ittcCf(reProduct) * (g.wettedArea / g.frontalArea);
    console.log(`${id.padEnd(15)} ${c.cls.padEnd(8)}${f3(c.shoulder)}     ${f4(fr + vnext.calibrate(c.proxy))}    ${f4(fr + hr4.calibrate(c.proxy, c.cls))}`);
    if (expect) check(`${id} stays ${expect}`, c.cls === expect, `shoulder ${f3(c.shoulder)}`);
  }
  check('provenance names the angle-based fourth trigger',
    hr4.provenance.some((p) => p.includes('shoulderAngleScore')));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('CANDIDATE ONLY — production runs frozen vNEXT until r19 + owner adoption.');
  if (fail > 0) process.exitCode = 1;
}
