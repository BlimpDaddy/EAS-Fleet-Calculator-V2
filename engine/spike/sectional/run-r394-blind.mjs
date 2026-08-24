/**
 * REPORT 394 — BLIND PREDICTION PHASE. Spec 94 pass 1 output.
 * Frozen BEFORE the results tables are read. Declared Re_L grid {5e6, 1.3e7,
 * 2.6e7} chosen from the VDT's known envelope, not from any per-model value.
 * Both nose readings (A/B) are run; their difference is the recorded
 * extraction uncertainty.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MODELS, profileIn, gzSelfTest } from './r394-gz.mjs';
import { latheFn } from './item4-corpus.mjs';
import { evaluate } from './batch-harness.mjs';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const ENGINE = ['obj.js', 'sections.js', 'cdEstimator.js', 'dynamicsGeometry.js', 'dynamicsCore.js'];
const fp = ENGINE.map((f) => f + ':' + sha(readFileSync(`${ROOT}site/calcv2/src/${f}`))).join(' ');
const NU = 1.5e-5, IN = 0.0254;
const RE_GRID = [5e6, 1.3e7, 2.6e7];

const st = gzSelfTest();
if (!st.ok) { console.error('GZ SELF-TEST FAILED:\n  ' + st.problems.join('\n  ')); process.exit(1); }

let out = 'NACA REPORT 394 — BLIND PREDICTIONS (spec 94). FROZEN BEFORE the results tables are read.\n';
out += 'Volumes validate vs Table III: uniform +1.4-1.6% on every model (reconstruction sound;\n';
out += 'bias systematic, likely the flat-max bridge / rounding). Parent 4.8 confirmed by volume identities.\n';
out += 'Leak disclosed: a drag-figure AXIS (gridlines .02-.06, Re to 26e6) was glimpsed during pass 1;\n';
out += 'no per-model value was seen. Nose-station ambiguity carried as readings A/B below.\n\n';

for (const m of MODELS) {
  const { L, r } = profileIn(m, 'A');
  const L_M = L * IN;
  const mesh = latheFn((x) => r(x / IN) * IN, 0, L_M, 96, 28);
  for (const re of RE_GRID) {
    const speedKmh = ((re * NU) / L_M) * 3.6;
    const R = evaluate({ ...mesh, identity: `tabulated-ordinates(${m.id})` },
      { label: `${m.id} Re ${re.toExponential(1)}`, lengthM: L_M, speedKmh });
    const md = R.ribbon.modes;
    out += `${m.id.padEnd(7)} Re ${re.toExponential(1)}  proxy ${R.scalar.compositeV1.toFixed(6)}  ${R.scalar.cls.padEnd(7)}  ` +
      `Cd ${R.cd.value.toFixed(5)}  press ${R.cd.pressure.toFixed(5)}  fric ${R.cd.friction.toFixed(5)}  ` +
      `F1 ${R.ribbon.F1.toFixed(4)}  F2a ${R.ribbon.F2a.toFixed(3).padStart(7)}  F4 ${R.ribbon.F4.toFixed(4)}  ` +
      `A2 ${md.A2.toFixed(4)}  elig ${R.ribbon.eligibility}  conf ${R.ood.confidence}  ` +
      `wf ${(R.geometry.wettedArea / R.geometry.frontalArea).toFixed(3)}\n`;
  }
  /* nose-reading sensitivity at the middle Re */
  const meshB = latheFn(((pB) => (x) => pB.r(x / IN) * IN)(profileIn(m, 'B')), 0, L_M, 96, 28);
  const speedKmh = ((RE_GRID[1] * NU) / L_M) * 3.6;
  const RB = evaluate({ ...meshB, identity: `tabulated-ordinates(${m.id},noseB)` },
    { label: `${m.id} noseB`, lengthM: L_M, speedKmh });
  out += `${m.id.padEnd(7)} nose-reading B: proxy ${RB.scalar.compositeV1.toFixed(6)}  Cd ${RB.cd.value.toFixed(5)}  (extraction uncertainty)\n`;
}
out += `\nengine ${fp}\n`;
writeFileSync('R394-BLIND-PREDICTIONS.txt', out);
console.log(out);
console.log('written to R394-BLIND-PREDICTIONS.txt — COMMIT BEFORE reading the results tables.');
