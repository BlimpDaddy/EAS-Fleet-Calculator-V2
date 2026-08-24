/**
 * VT OBLATE — BLIND PHASE. Spec 98. Frozen BEFORE any drag result is read
 * from DeMoss 2007 chapters 4-5.
 *
 * FROZEN QUESTIONS (owner, 2026-08-21):
 *   Q-A  does an independent oblate body reproduce "oblate sits above the
 *        universal map"?
 *   Q-B  do the ribbon angular modes identify the geometry BEFORE the drag
 *        result is revealed? Pre-registered analytic values for the 1.7316
 *        section ellipse: A2 = 0.2703, A4 = 0.0545 (4096-pt quadrature).
 *
 * Conditions declared from ch.2 only: Re_L 1.6e6 and 4.3e6, zero incidence.
 * Coefficient basis at reveal: the thesis's length-squared coefficients,
 * converted with A_frontal = pi*0.2*0.1155 = 0.072571 m2, L^2 = 2.56 m2.
 * Evidence role: INDEPENDENT oblate-family + non-circular-section evidence.
 * NOT an anchor.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildVtOblate, vtSelfTest, L, K_SECTION } from './vt-oblate.mjs';
import { evaluate } from './batch-harness.mjs';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const ENGINE = ['obj.js', 'sections.js', 'cdEstimator.js', 'dynamicsGeometry.js', 'dynamicsCore.js'];
const fp = ENGINE.map((f) => f + ':' + sha(readFileSync(`${ROOT}site/calcv2/src/${f}`))).join(' ');
const NU = 1.5e-5;
const RE_GRID = [1.6e6, 4.3e6];

const st = vtSelfTest();
if (!st.ok) { console.error('VT SELF-TEST FAILED: ' + st.problems.join('; ')); process.exit(1); }

let out = 'VT OBLATE (DeMoss 2007) — BLIND PREDICTIONS (spec 98). FROZEN BEFORE any drag result is read.\n';
out += `geometry: exact analytic (ch 2.2.1), volume self-test PASS (${st.vMesh.toFixed(5)} vs ${st.vAn.toFixed(5)} m3).\n`;
out += `section ellipse aspect ${K_SECTION.toFixed(4)}; PRE-REGISTERED analytic modes A2 0.2703, A4 0.0545.\n`;
out += 'Roles: independent oblate-family + first measured non-circular-section drag body. NOT an anchor.\n\n';

for (const [rings, naz, tag] of [[96, 28, 'canonical 96x28'], [240, 128, 'sensitivity 240x128']]) {
  const mesh = buildVtOblate(rings, naz);
  for (const re of RE_GRID) {
    const speedKmh = ((re * NU) / L) * 3.6;
    const r = evaluate({ ...mesh, identity: `exact-equation(VT-oblate,${tag})` },
      { label: `VT-oblate ${tag} Re ${re.toExponential(1)}`, lengthM: L, speedKmh });
    const m = r.ribbon.modes;
    out += `${tag.padEnd(20)} Re ${re.toExponential(1)}  proxy ${r.scalar.compositeV1.toFixed(6)}  ${r.scalar.cls.padEnd(7)}  ` +
      `Cd ${r.cd.value.toFixed(5)}  press ${r.cd.pressure.toFixed(5)}  fric ${r.cd.friction.toFixed(5)}  ` +
      `elig ${r.ribbon.eligibility}  conf ${r.ood.confidence}\n`;
    if (re === RE_GRID[0]) {
      out += `${''.padEnd(20)} F1 ${r.ribbon.F1.toFixed(4)}  F2a ${r.ribbon.F2a.toFixed(3)}  F3 ${r.ribbon.F3.toFixed(4)}  ` +
        `F4 ${r.ribbon.F4.toFixed(4)}  F5 ${r.ribbon.F5.toFixed(4)}  ` +
        `A1 ${m.A1.toFixed(4)}  A2 ${m.A2.toFixed(4)}  A4 ${m.A4.toFixed(4)}  ` +
        `wf ${(r.geometry.wettedArea / r.geometry.frontalArea).toFixed(3)}  dPx(hull) ${(100 * r.sensitivity.dProxy).toFixed(1)}%\n`;
    }
  }
}
out += `\nengine ${fp}\n`;
writeFileSync('VT-OBLATE-BLIND.txt', out);
console.log(out);
console.log('written to VT-OBLATE-BLIND.txt — COMMIT BEFORE reading chapters 4-5.');
