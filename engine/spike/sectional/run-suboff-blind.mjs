/**
 * SUBOFF AFF-1 — BLIND PREDICTION PHASE. Spec 93.
 *
 * Runs the reconstructed AFF-1 geometry through the frozen pipeline and
 * freezes the complete prediction record BEFORE the experimental summary
 * (ADA359226) is opened. Per 92.3 / 90.7 R2:
 *
 *   geometry/source definition -> freeze prediction + ribbons/modes
 *   -> COMMIT the blind file -> only then reveal measured data.
 *
 * DECLARED CONDITIONS, chosen without reading the data report: a grid of
 * length Reynolds numbers spanning the typical deep-water towing range for a
 * 4.356 m model, Re_L = {1.2e7, 2.0e7, 2.8e7, 3.6e7}. Speeds are set through
 * the harness's air viscosity so that Re_L matches; Re is the quantity the
 * frozen friction and regime terms consume. If the revealed test Re fall
 * outside this grid, the nearest-Re prediction is used and the gap declared.
 *
 * Exam status: UNSPENT VALIDATION EVIDENCE (92.2 #1) — explicitly NOT a new
 * calibration anchor. R3: the published pressure and skin-friction data will
 * be preserved SEPARATELY at reveal, never collapsed into the ITTC residual.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { radiusM, aff1SelfTest, L_M, D_M } from './suboff-aff1.mjs';
import { latheFn } from './item4-corpus.mjs';
import { evaluate } from './batch-harness.mjs';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const ENGINE = ['obj.js', 'sections.js', 'cdEstimator.js', 'dynamicsGeometry.js', 'dynamicsCore.js'];
const fp = ENGINE.map((f) => f + ':' + sha(readFileSync(`${ROOT}site/calcv2/src/${f}`))).join(' ');
const NU = 1.5e-5;
const RE_GRID = [1.2e7, 2.0e7, 2.8e7, 3.6e7];

const st = aff1SelfTest();
if (!st.ok) { console.error('AFF-1 SELF-TEST FAILED:\n  ' + st.problems.join('\n  ')); process.exit(1); }

/* canonical convention (90.7 R1): exact-equation axisymmetric -> 96x28 lathe;
   768x224 as the provenance sensitivity column */
const mesh = latheFn(radiusM, 0, L_M, 96, 28);
const hi = latheFn(radiusM, 0, L_M, 768, 224);

let out = 'SUBOFF AFF-1 — BLIND PREDICTIONS (spec 93). FROZEN BEFORE ADA359226 IS OPENED.\n';
out += `geometry: exact equations, Groves/Huang/Chang 1989 (ADA210642). self-test PASS.\n`;
out += `L ${L_M.toFixed(4)} m, D ${D_M.toFixed(4)} m, fineness ${(L_M / D_M).toFixed(3)}. Canonical 96x28 lathe.\n`;
out += 'Declared Re_L grid chosen blind; nearest-Re prediction will be used at reveal.\n';
out += 'Status: UNSPENT VALIDATION EVIDENCE — not a calibration anchor candidate.\n\n';

for (const re of RE_GRID) {
  const speedKmh = ((re * NU) / L_M) * 3.6;
  const r = evaluate({ ...mesh, identity: 'exact-equation(SUBOFF-AFF1)' },
    { label: `AFF1 Re ${re.toExponential(1)}`, lengthM: L_M, speedKmh });
  const m = r.ribbon.modes;
  out += `Re_L ${re.toExponential(2)}  proxy ${r.scalar.compositeV1.toFixed(6)}  class ${r.scalar.cls}  ` +
    `Cd ${r.cd.value.toFixed(5)}  press ${r.cd.pressure.toFixed(5)}  fric ${r.cd.friction.toFixed(5)}  ` +
    `elig ${r.ribbon.eligibility}  conf ${r.ood.confidence}\n`;
  if (re === RE_GRID[0]) {
    out += `descriptors  F1 ${r.ribbon.F1.toFixed(4)}  F2a ${r.ribbon.F2a.toFixed(3)}  F2f ${r.ribbon.F2f.toFixed(4)}  ` +
      `F3 ${r.ribbon.F3.toFixed(4)}  F4 ${r.ribbon.F4.toFixed(4)}  F5 ${r.ribbon.F5.toFixed(4)}  ` +
      `A1 ${m.A1.toFixed(4)}  A2 ${m.A2.toFixed(4)}  A4 ${m.A4.toFixed(4)}\n`;
    out += `zones        ${r.ribbon.zones.map((z) => z.toFixed(2)).join('  ')}\n`;
    out += `geometry     wetted ${r.geometry.wettedArea.toFixed(4)} m2  frontal ${r.geometry.frontalArea.toFixed(4)} m2  ` +
      `wetted/frontal ${(r.geometry.wettedArea / r.geometry.frontalArea).toFixed(3)}\n`;
    out += `sensitivity  dPx(hull) ${(100 * r.sensitivity.dProxy).toFixed(2)}%  dCd(hull) ${(100 * r.sensitivity.dCd).toFixed(2)}%\n`;
  }
}
/* resolution provenance column */
import('../../../site/calcv2/src/cdEstimator.js').then(({ measureSectionalProxy }) => {
  const p96 = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' }).proxy;
  const p768 = measureSectionalProxy(hi.verts, hi.faces, { axis: '+X' }).proxy;
  out += `resolution   proxy 96x28 ${p96.toFixed(6)}  768x224 ${p768.toFixed(6)}  drift ${(100 * (p768 - p96) / p96).toFixed(2)}%\n`;
  out += `\nengine ${fp}\n`;
  writeFileSync('SUBOFF-BLIND-PREDICTIONS.txt', out);
  console.log(out);
  console.log('written to SUBOFF-BLIND-PREDICTIONS.txt — COMMIT BEFORE opening ADA359226.');
});
