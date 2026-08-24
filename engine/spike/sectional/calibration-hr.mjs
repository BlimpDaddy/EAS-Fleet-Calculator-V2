/**
 * CALIBRATION vHR — CANDIDATE (2026-08-16, NOT ADOPTED). The r15
 * "bounded rebuild": a regime-consistent HIGH-RE REFERENCE pressure
 * map, built per the adopted framing (proxy = scale-free aerodynamic
 * shape quality; calibration = reference high-Re form drag; friction
 * = the Re-dependent part). Owner's go: "try bounded rebuild"
 * (2026-08-16). ADOPTION GATED on r16 external review + owner ruling;
 * production keeps frozen vNEXT until then. This file touches NO
 * frozen artifact.
 *
 * METHOD (owner-proposed, r15-shaped): SPHERE-CRISIS-RATIO CLASS
 * SCALING. The sphere is the only rounded body measured across the
 * whole regime span (Achenbach 1972, JFM 54: Re 5e4–6e6; subcritical
 * plateau ~0.50, critical 3.7e5, smooth-sphere transcritical rising
 * to ~0.19 by 6e6 — PROVENANCE GRADE: widely-reproduced literature
 * figures, primary PDF paywalled, verification queued; roughness
 * raises the transcritical level, caveat carried). For rounded
 * bodies with only subcritical measurements, apply the sphere's own
 * crisis ratio 0.19/0.50 = 0.38 as a DECLARED engineering
 * correction. One parameter, real provenance, honest label.
 *
 * KNOTS (proxy → pressure at the REF condition, monotone
 * piecewise-linear, clamped — same structure as vNEXT):
 *   1–2. TN-614 forms 111 + 332 — UNCHANGED (real data, effective
 *        Re 66e6, already regime-consistent). The validated
 *        streamlined end must not move.
 *   3. E2 PROLATE 1:1.8 (proxy 0.597) — scaled grade: subcritical
 *      0.269 (Zahlentafel 36, print-verified) × 0.38 = 0.102 total;
 *      pressure = total − ITTC friction at REF. Cross-checks on
 *      record: its own supercritical trend was rising 0.055→0.084
 *      toward this value; sphere-style recovery from its 0.055 min
 *      suggests ~0.15 — the knot is the ratio method's number, the
 *      spread 0.10–0.15 is declared uncertainty, band must cover it.
 *   4. SPHERE (proxy 0.816) — transcritical 0.19 DIRECT (no scaling;
 *      it is the measured high-Re value; 6e6→REF extrapolation
 *      declared: transcritical trend ~flat-to-slowly-rising).
 *   5. E2 OBLATE 1:0.75 (proxy 0.894) — scaled grade: subcritical
 *      plateau 0.58 × 0.38 = 0.220 total. Consistency check: its
 *      measured transition was already down to 0.205 and falling at
 *      Re_d 546k — the scaled value is plausibly conservative.
 *   6. Cube+plate pooled bluff — UNCHANGED (sharp edges fix
 *      separation; no drag crisis; Re-independent by physics).
 *
 * NO ROUNDED-VS-ANGULAR CLASSIFIER NEEDED (r15 question resolved):
 * the proxy already prices pinned separation — every angular body
 * measured proxies ≥ ~1.15 (washing machine 1.15, cube 1.21, plate
 * 1.21) and every rounded body ≤ ~0.9 (sphere 0.816, gömböc 0.836,
 * oblate 0.894); the steep segment 0.894→~1.2 IS the rounded→pinned
 * transition, geometrically driven. VS was considered and REJECTED
 * for this job (it measures compactness — a cube's VS ~1.24 sits
 * next to spheres while obeying opposite separation physics). If a
 * counterexample body ever lands inside the gap, the objective-
 * diagnostic seam (r11 #7) is the escalation path — not VS.
 *
 * Failure semantics identical to vNEXT: non-finite proxy → NaN.
 */
import { buildCalibration, frictionCdAt, REF_RE } from './calibration.mjs';
import { measureSections, scoreSections } from './sections.mjs';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf, NU_M2_S } from '../../src/dynamicsCore.js';
import { makeSphere } from '../flow-chamber/shapes.mjs';
import { latheProfile, BODIES, TEST_RE } from './tn614-bodies.mjs';
import { PRESET_DYNAMICS } from '../../src/presetDynamics.js';

/* Akron constants INLINED from the frozen tr432-akron.mjs (importing that
 * artifact executes its exam — side effect avoided; values verbatim). */
const AKRON_OFFSETS = [
  [0.00, 0], [0.02, 4.95], [0.05, 9.96], [0.10, 14.20], [0.15, 16.65],
  [0.20, 18.39], [0.25, 19.12], [0.30, 19.61], [0.35, 19.85], [0.40, 19.90],
  [0.45, 19.90], [0.50, 19.80], [0.55, 19.59], [0.60, 19.12], [0.65, 18.46],
  [0.70, 17.50], [0.75, 16.15], [0.80, 14.44], [0.85, 12.29], [0.90, 9.61],
  [0.95, 6.52], [1.00, 0],
];
const AKRON_MEASURED_MID_CS = 0.0193; // P.R.T. 1/40 model, Re_v 3.73e6

/* Achenbach 1972 sphere figures (declared literature grade — see header). */
export const SPHERE_SUBCRITICAL = 0.50;
export const SPHERE_TRANSCRITICAL = 0.19;
export const CRISIS_RATIO = SPHERE_TRANSCRITICAL / SPHERE_SUBCRITICAL; // 0.38

/* E2 subcritical references (print-verified, gottingen2-ellipsoids.mjs). */
const E2_PROLATE_SUBCRIT = 0.269; // Zahlentafel 36 first row (pre-fall)
const E2_OBLATE_SUBCRIT = 0.58;   // Zahlentafel 35 plateau

/* The exam's analytic ellipsoid profile (copied verbatim from the frozen
 * exam artifact — that file may not be edited post-seal). */
function ellipsoidProfile(lengthMm, diaMm, n = 64) {
  const rMaxPct = (diaMm / 2 / lengthMm) * 100;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = (Math.PI * i) / n;
    const xPct = 50 * (1 - Math.cos(th));
    const t = (xPct - 50) / 50;
    pts.push([xPct, rMaxPct * Math.sqrt(Math.max(0, 1 - t * t))]);
  }
  return pts;
}

const proxyOf = (mesh) => scoreSections(measureSections(mesh.verts, mesh.faces, {})).compositeV1;

/** Build the vHR candidate. Same return shape as buildCalibration(). */
export function buildCalibrationHR() {
  const vnext = buildCalibration();
  // Streamlined pair (two lowest) + bluff pooled (highest, proxy exactly
  // 1.0 — envelope-capped) carried over unchanged; the old sphere knot
  // (index 2) is REPLACED. Sanity-gated on the frozen layout.
  if (vnext.knots.length !== 4 || vnext.knots[1][0] > 0.2 || vnext.knots[3][0] < 0.95) {
    throw new Error('vNEXT knot layout changed — vHR carry-over assumptions invalid');
  }
  const streamlined = vnext.knots.slice(0, 2);
  const bluff = [vnext.knots[3]];

  const prolate = latheProfile(ellipsoidProfile(360, 200), 128, 36);
  const oblate = latheProfile(ellipsoidProfile(150, 200), 128, 36);
  const sphere = makeSphere();

  const rounded = [
    {
      name: 'E2-prolate-1.8 (scaled ×' + CRISIS_RATIO.toFixed(2) + ')',
      proxy: proxyOf(prolate),
      pressure: E2_PROLATE_SUBCRIT * CRISIS_RATIO - frictionCdAt(prolate, REF_RE),
    },
    {
      name: 'sphere-HR (Achenbach transcritical 0.19 direct)',
      proxy: proxyOf(sphere),
      pressure: SPHERE_TRANSCRITICAL - frictionCdAt(sphere, REF_RE),
    },
    {
      name: 'E2-oblate-0.75 (scaled ×' + CRISIS_RATIO.toFixed(2) + ')',
      proxy: proxyOf(oblate),
      pressure: E2_OBLATE_SUBCRIT * CRISIS_RATIO - frictionCdAt(oblate, REF_RE),
    },
  ];

  const knots = [...streamlined, ...rounded.map((k) => [k.proxy, k.pressure]), ...bluff]
    .sort((a, b) => a[0] - b[0]);
  for (let i = 0; i + 1 < knots.length; i++) {
    if (!(knots[i][1] <= knots[i + 1][1])) throw new Error('vHR map not monotone');
    if (!Number.isFinite(knots[i][1])) throw new Error('vHR non-finite knot');
  }

  const calibrate = (x) => {
    if (!Number.isFinite(x)) return NaN;
    if (x <= knots[0][0]) return Math.max(0, knots[0][1] * (x / knots[0][0] || 0));
    for (let i = 0; i + 1 < knots.length; i++) {
      if (x <= knots[i + 1][0]) {
        const t = (x - knots[i][0]) / (knots[i + 1][0] - knots[i][0]);
        return knots[i][1] + t * (knots[i + 1][1] - knots[i][1]);
      }
    }
    return knots[knots.length - 1][1];
  };

  return {
    knots,
    calibrate,
    provenance: [
      'TN614-111 (real, unchanged)', 'TN614-332 (real, unchanged)',
      ...rounded.map((k) => k.name),
      'bluff pooled cube+plate (unchanged — no drag crisis)',
    ],
  };
}

/* ================= LEDGER RE-RUN (direct execution) ================= */
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
  || process.argv[1]?.endsWith('calibration-hr.mjs')) {
  const oldC = buildCalibration();
  const newC = buildCalibrationHR();
  const f3 = (x) => Number(x).toFixed(3);
  const f4 = (x) => Number(x).toFixed(4);

  console.log('== CALIBRATION vHR (candidate) vs frozen vNEXT ==\n');
  console.log('knots (proxy → pressure):');
  console.log('  vNEXT: ' + oldC.knots.map(([p, c]) => `${f3(p)}→${f4(c)}`).join('  '));
  console.log('  vHR:   ' + newC.knots.map(([p, c]) => `${f3(p)}→${f4(c)}`).join('  '));

  console.log('\n-- LEDGER: TN-614 six bodies at effective Re 66e6 (must be ~unchanged) --');
  console.log('body   measured  vNEXT    vHR');
  for (const [name, body] of Object.entries(BODIES)) {
    const mesh = latheProfile(body.pts);
    const p = proxyOf(mesh);
    const fr = frictionCdAt(mesh, TEST_RE);
    console.log(`${name.padEnd(6)} ${f4(body.cdA)}   ${f4(fr + oldC.calibrate(p))}   ${f4(fr + newC.calibrate(p))}`);
  }

  console.log('\n-- LEDGER: TR-432 Akron (must be unchanged) --');
  {
    const L_IN = 19.62 * 12;
    const pts = AKRON_OFFSETS.map(([aL, rIn]) => [aL * 100, (rIn / L_IN) * 100]);
    const mesh = latheProfile(pts, 128, 36);
    const p = proxyOf(mesh);
    const reL = 3.73e6 * (19.62 / Math.pow(115, 1 / 3));
    const fr = frictionCdAt(mesh, reL);
    const measured = AKRON_MEASURED_MID_CS * (Math.pow(115, 2 / 3) / (Math.PI * Math.pow((2 * 19.90) / 12, 2) / 4));
    console.log(`proxy ${f3(p)} · measured ${f4(measured)} · vNEXT ${f4(fr + oldC.calibrate(p))} · vHR ${f4(fr + newC.calibrate(p))}`);
  }

  console.log('\n-- PRODUCT PRESETS at 300 m / 100 km/h (authored axis, bare hull) --');
  const reProduct = ((100 / 3.6) * 300) / NU_M2_S;
  console.log('preset          proxy   vNEXT Cd  vHR Cd');
  for (const [id, rec] of Object.entries(PRESET_DYNAMICS)) {
    const axis = rec.defaultAxis;
    const letter = axis.replace(/^[+-]/, '');
    const p = rec.proxies[axis].proxy;
    const wf = rec.raw.wettedRaw / rec.raw.frontalRaw[letter];
    const fr = ittcCf(reProduct) * wf;
    console.log(`${id.padEnd(15)} ${f3(p)}   ${f4(fr + oldC.calibrate(p))}    ${f4(fr + newC.calibrate(p))}`);
  }

  console.log('\n-- E2 self-check (knots reproduce scaled targets at REF by construction) --');
  console.log('prolate scaled target ' + f4(E2_PROLATE_SUBCRIT * CRISIS_RATIO)
    + ' · oblate ' + f4(E2_OBLATE_SUBCRIT * CRISIS_RATIO)
    + ' · sphere ' + f4(SPHERE_TRANSCRITICAL));

  console.log('\nCANDIDATE ONLY — production runs frozen vNEXT until r16 + owner adoption.');
}
