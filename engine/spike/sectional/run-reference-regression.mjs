/**
 * STEP 1 — FULL REFERENCE REGRESSION. Spec 81.2.
 *
 * REGRESSION, NOT CALIBRATION. Confirms:
 *   R1  the ribbon layer NEVER alters Cd (proven per body, not asserted)
 *   R2  ribbon descriptors reproduce the recorded spec 73.2 values EXACTLY
 *   R3  the Sunship scalar reproduces its recorded production value
 *   R4  every run is deterministic across repeats
 *
 * Nothing is fitted, no calibration touched, no Cd altered.
 */
import { evaluate, row } from './batch-harness.mjs';
import { BODIES as TN } from './tn614-bodies.mjs';
import { SOLVED } from './series58-data.mjs';
import { PATTERNS, hullMesh } from './hull-bodies.mjs';
import { loadEasBody } from './eas-bodies.mjs';

const SEED = 12345;
const AKRON = [[0.00, 0], [0.02, 4.95], [0.05, 9.96], [0.10, 14.20], [0.15, 16.65],
  [0.20, 18.39], [0.25, 19.12], [0.30, 19.61], [0.35, 19.85], [0.40, 19.90],
  [0.45, 19.90], [0.50, 19.80], [0.55, 19.59], [0.60, 19.12], [0.65, 18.46],
  [0.70, 17.50], [0.75, 16.15], [0.80, 14.44], [0.85, 12.29], [0.90, 9.61],
  [0.95, 6.52], [1.00, 0]];

const lerp = (pts) => (t) => {
  if (t <= pts[0][0] || t >= pts[pts.length - 1][0]) return 0;
  let i = 0; while (i + 2 < pts.length && pts[i + 1][0] < t) i++;
  const [a, ra] = pts[i], [b, rb] = pts[i + 1];
  return ra + ((rb - ra) * (t - a)) / (b - a);
};
function lathe(rFn, half, label) {
  const m = hullMesh(PATTERNS.fibonacci((X) => rFn(X), half, 12000, SEED));
  return { verts: m.verts, faces: m.faces, identity: 'analytic -> hull', label };
}
const tn614 = (n) => {
  const pts = TN[n].pts.map(([s, v]) => [s / 100, v / 100]);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0], half = (x1 - x0) / 2, cx = (x0 + x1) / 2;
  const f = lerp(pts);
  return lathe((X) => f(X + cx), half, `TN614-${n}`);
};
const s58 = (mid) => {
  const { a, LD } = SOLVED[mid], half = LD / 2;
  return lathe((X) => {
    const x = (X + half) / LD; if (x <= 0 || x >= 1) return 0;
    let y2 = 0; for (let n = 0; n < 6; n++) y2 += a[n] * Math.pow(x, n + 1);
    return y2 > 0 ? Math.sqrt(y2) : 0;
  }, half, `S58-${mid}`);
};
const akron = () => {
  const L_IN = 19.62 * 12, pts = AKRON.map(([t, r]) => [t, r / L_IN]);
  const f = lerp(pts);
  return lathe((X) => f(X + 0.5), 0.5, 'TR432-Akron');
};

/** recorded in spec 73.2 — the regression baseline */
const RECORDED = {
  'TN614-111': { F1: 0.4867, F2a: 9.006, F3: 1.4046, F4: 0.4069 },
  'TN614-221': { F1: 0.4238, F2a: 10.260, F3: 1.5506, F4: 0.4408 },
  'TN614-332': { F1: 0.4868, F2a: 6.202, F3: 1.9324, F4: 0.4168 },
  'TR432-Akron': { F1: 0.5824, F2a: 6.090, F3: 2.2532, F4: 0.3803 },
  'S58-4157': { F1: 0.6017, F2a: 4.188, F3: 1.9604, F4: 0.3731 },
  'S58-4171': { F1: 0.5898, F2a: 4.639, F3: 1.9553, F4: 0.3806 },
  'S58-4174': { F1: 0.6142, F2a: 3.734, F3: 1.9659, F4: 0.3651 },
  'S58-4167': { F1: 0.7096, F2a: 3.490, F3: 2.3031, F4: 0.3384 },
  'S58-4170': { F1: 0.4742, F2a: 5.054, F3: 1.6200, F4: 0.4129 },
};

const CORPUS = [
  ...['111', '221', '332'].map(tn614), akron(),
  ...[4157, 4171, 4174, 4167, 4170].map(s58),
];

console.log('\nSTEP 1 — FULL REFERENCE REGRESSION (spec 81.2). Baseline 9746da7.');
console.log('  REGRESSION, NOT CALIBRATION. Nothing fitted, no Cd altered.\n');
console.log('  body            proxy      Cd      elig       F1      F2a     F3      F4     anchors  conf   dCd%  dPx%');

const results = [];
for (const s of CORPUS) {
  const r = evaluate(s, { label: s.label, lengthM: 100 });
  results.push(r);
  const q = row(r);
  console.log(`  ${q.label.padEnd(14)} ${q.proxy.toFixed(6)} ${q.cd.toFixed(5)} ${q.elig.padEnd(10)} ` +
    `${q.F1.toFixed(4)} ${q.F2a.toFixed(3).padStart(7)} ${q.F3.toFixed(4)} ${q.F4.toFixed(4)}  ${q.anchors}` +
    `    ${q.conf.padEnd(9)} ${String(q.dCd).padStart(5)} ${String(q.dPx).padStart(5)}`);
}

/* ---- R1: the ribbon layer never alters Cd ---- */
const r1 = results.every((r) => r.cdUnchangedByRibbons);
console.log(`\n  R1  ribbon layer never alters Cd:            ${r1 ? 'PASS' : 'FAIL'}  (proven per body, ${results.length}/${results.length})`);

/* ---- R2: descriptors reproduce spec 73.2 exactly ---- */
let worst = 0, worstAt = '';
for (const r of results) {
  const rec = RECORDED[r.label]; if (!rec) continue;
  for (const k of ['F1', 'F2a', 'F3', 'F4']) {
    const d = Math.abs(r.ribbon[k] - rec[k]);
    if (d > worst) { worst = d; worstAt = `${r.label}.${k}`; }
  }
}
console.log(`  R2  descriptors reproduce spec 73.2:         ${worst < 5e-4 ? 'PASS' : 'FAIL'}  (worst drift ${worst.toExponential(2)} at ${worstAt})`);

/* ---- R3: Sunship scalars reproduce their recorded values ---- */
const bare = loadEasBody('bare'), tailed = loadEasBody('tailed');
const rb = evaluate({ ...bare.hull }, { label: 'Sunship bare', lengthM: bare.lengthM, hullCompare: false });
const rt = evaluate({ ...tailed.authored }, { label: 'Sunship tailed', lengthM: tailed.lengthM, hullCompare: false });
console.log(`  R3  Sunship bare  proxy ${rb.scalar.compositeV1.toFixed(6)} vs recorded 0.770   ` +
  `${Math.abs(rb.scalar.compositeV1 - 0.770) < 0.006 ? 'PASS' : 'FAIL'}`);
console.log(`      Sunship tailed Cd  ${rt.cd.value.toFixed(4)} vs recorded 0.0217  ` +
  `${Math.abs(rt.cd.value - 0.0217) < 0.001 ? 'PASS' : 'FAIL'}  (residual = the tip-only nose cap, spec 80)`);

/* ---- R4: determinism ---- */
const again = CORPUS.map((s) => evaluate(s, { label: s.label, lengthM: 100, hullCompare: false }));
const det = again.every((r, i) => r.scalar.compositeV1 === results[i].scalar.compositeV1
  && r.cd.value === results[i].cd.value && r.ribbon.F2a === results[i].ribbon.F2a);
console.log(`  R4  deterministic across repeat runs:        ${det ? 'PASS' : 'FAIL'}`);

const allElig = results.every((r) => r.ribbon.eligibility === 'ELIGIBLE');
console.log(`\n  all reference bodies ribbon-ELIGIBLE:        ${allElig ? 'PASS' : 'FAIL'}`);
console.log('\n  Production Cd path untouched. No calibration read or written.\n');
