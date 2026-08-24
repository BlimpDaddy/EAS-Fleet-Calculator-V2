/**
 * ACHENBACH 1972 — BLIND PHASE. Spec 97. The predicted pressure/friction
 * split across the published Re range, FROZEN before any decomposition figure
 * is opened. Geometry and estimator unchanged (97.1 item 1).
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { latheFn } from './item4-corpus.mjs';
import { evaluate } from './batch-harness.mjs';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const ENGINE = ['obj.js', 'sections.js', 'cdEstimator.js', 'dynamicsGeometry.js', 'dynamicsCore.js'];
const fp = ENGINE.map((f) => f + ':' + sha(readFileSync(`${ROOT}site/calcv2/src/${f}`))).join(' ');
const NU = 1.5e-5, D = 1;                 // 1 m sphere; Re_D = Re_L
const RE_GRID = [1e5, 3e5, 1e6, 3e6, 6e6];

const mesh = latheFn((x) => Math.sqrt(Math.max(0, 0.25 - x * x)), -0.5, 0.5, 96, 28);

let out = 'ACHENBACH 1972 — BLIND SPLIT PREDICTIONS (spec 97). FROZEN BEFORE the decomposition is seen.\n';
out += 'Mechanism exam only: NOT a total-Cd validation (total is calibration-adjacent), NOT an anchor.\n';
out += 'Declared grid Re_D {1e5, 3e5, 1e6, 3e6, 6e6} spanning the published 5e4-6e6.\n\n';
out += 'Re_D      proxy      class    CdTot    press    fric     FRICTION FRACTION of predicted total\n';
for (const re of RE_GRID) {
  const speedKmh = ((re * NU) / D) * 3.6;
  const r = evaluate({ ...mesh, identity: 'exact-equation(sphere)' },
    { label: `sphere Re ${re.toExponential(1)}`, lengthM: D, speedKmh, hullCompare: false });
  out += `${re.toExponential(1)}   ${r.scalar.compositeV1.toFixed(6)}  ${r.scalar.cls.padEnd(7)}  ` +
    `${r.cd.value.toFixed(5)}  ${r.cd.pressure.toFixed(5)}  ${r.cd.friction.toFixed(5)}   ` +
    `${(100 * r.cd.friction / r.cd.value).toFixed(1)}%\n`;
}
out += `\nengine ${fp}\n`;
writeFileSync('ACHENBACH-BLIND-SPLIT.txt', out);
console.log(out);
console.log('written to ACHENBACH-BLIND-SPLIT.txt — COMMIT BEFORE the reveal.');
