/**
 * IS THE C-CLASS TEARDROP A VALID STAND-IN FOR THE BARE SUNSHIP? (2026-08-19)
 *
 * Owner challenge, and a correct one: fineness ratio is a coarse scalar.
 * The Sunship is ~1.3:1 but is NOT an axisymmetric prolate body — it is
 * monomonostatic (gömböc-class), non-axisymmetric, and asymmetric fore/aft
 * and vertically. "f.r. 1.3" must not become shorthand for "a 1.3:1
 * spheroid".
 *
 * WHY THIS MATTERS TO THE TR-291 RESULT. The exam showed the estimator
 * over-prices the fat region by 2-5x, and diagnosed it to the
 * proxy->pressure map: the proxy under-discriminates there (13% of proxy
 * separating a 3-5x drag difference). But if the proxy under-discriminates
 * in that region, then the proxy is NOT a sound vehicle for carrying a
 * C-class measurement onto the Sunship. Using it as one would rely on
 * exactly the property the exam disproved.
 *
 * So this file does NOT try to correct the bare-Sunship number. It asks a
 * narrower, answerable question: HOW different are the two bodies, in the
 * terms the estimator itself uses? If they are close in section evolution,
 * the TR-291 evidence transfers more; if they differ, it transfers less,
 * and the bare figure is simply demoted rather than rescaled.
 *
 * Frozen estimator. Measurement only. No calibration change.
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../../src/obj.js';
import { measureSections, scoreSections } from '../../src/sections.js';
import { measureSectionalProxy } from '../../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { latheProfile } from './tn614-bodies.mjs';
/* Table I specified radii, inlined — importing tr291.mjs would run the exam. */
const TR291_OFFSETS_IN = [
  [0, 0], [1, 1.001], [2, 1.747], [3, 2.286], [4, 2.688], [5, 2.982], [6, 3.204],
  [7, 3.379], [8, 3.511], [10, 3.683], [12, 3.779], [14, 3.830], [16, 3.849],
  [16.6, 3.850], [18, 3.840], [20, 3.797], [22, 3.738], [24, 3.659], [26, 3.558],
  [28, 3.443], [30, 3.318], [32, 3.170], [34, 3.005], [36, 2.817], [38, 2.608],
  [40, 2.369], [41, 2.236], [42, 2.098], [43, 1.945], [44, 1.766], [45, 1.554],
  [46, 1.281], [47, 0.912], [48, 0],
];

const f3 = (x) => x.toFixed(3);
const SUNSHIP_OBJ = '../3D OBJ/Sunship.obj';
const SUNSHIP_AXIS = '+Z';   // the validated flight direction

/** Normalised area distribution: 20 samples of A(x)/Amax over x/L. */
function areaCurve(m, n = 20) {
  const A = Array.from(m.A);
  const aMax = Math.max(...A);
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.min(A.length - 1, Math.round(((i + 0.5) / n) * A.length));
    out.push(A[idx] / aMax);
  }
  return out;
}

function describe(name, verts, faces, axis) {
  const m = measureSections(verts, faces, { axis });
  const s = scoreSections(m);
  const p = measureSectionalProxy(verts, faces, { axis });
  const A = Array.from(m.A);
  const aMax = Math.max(...A);
  const iMax = A.indexOf(aMax);
  let last = A.length - 1;
  while (last > 0 && A[last] <= 1e-4 * aMax) last--;
  return {
    name, proxy: p.proxy, cls: p.cls, triggers: p.triggers,
    maxAt: iMax / A.length,                     // where the max section sits, x/L
    terminalBase: A[last] / aMax,               // how bluntly it closes
    curve: areaCurve(m),
    scores: s,
  };
}

console.log('== Is the C-class teardrop a valid stand-in for the bare Sunship? ==\n');

/* ---- the Sunship, as production reads it ---- */
const sun = parseObjMesh(readFileSync(SUNSHIP_OBJ, 'utf8'));
const sunG = measureDynamicsGeometry(sun.verts, sun.faces, { flightAxis: SUNSHIP_AXIS.slice(1) });
const S = describe('Sunship (bare)', sun.verts, sun.faces, SUNSHIP_AXIS);

/* ---- non-axisymmetry: the owner's actual point, measured ---- */
const ext = [0, 1, 2].map((i) => {
  const v = sun.verts.map((p) => p[i]);
  return Math.max(...v) - Math.min(...v);
});
const AX = { X: 0, Y: 1, Z: 2 }[SUNSHIP_AXIS.slice(1)];
const cross = [0, 1, 2].filter((i) => i !== AX).map((i) => ext[i]);
console.log('-- the Sunship is not axisymmetric, measured --');
console.log(`extents X ${f3(ext[0])}  Y ${f3(ext[1])}  Z ${f3(ext[2])}  (flight axis ${SUNSHIP_AXIS})`);
console.log(`cross-section aspect (the two non-flight axes): ${(Math.max(...cross) / Math.min(...cross)).toFixed(3)} : 1`);
console.log(`  -> a body of revolution would read exactly 1.000 : 1`);
console.log(`fineness along flight axis: ${(ext[AX] / Math.max(...cross)).toFixed(3)} : 1 (widest) / ${(ext[AX] / Math.min(...cross)).toFixed(3)} : 1 (narrowest)`);
console.log(`wetted/frontal ${f3(sunG.wettedOverFrontal)}\n`);

/* ---- the two TR-291 hulls that bracket it on fineness ---- */
const N_ST = 48;
const mk = (lengthIn) => latheProfile(
  TR291_OFFSETS_IN.map(([st, rIn]) => [(st / N_ST) * 100, (rIn / lengthIn) * 100]), 192, 48,
);
const c10 = mk(7.700), c15 = mk(11.550);
const C10 = describe('C-class f.r. 1.0', c10.verts, c10.faces, '+X');
const C15 = describe('C-class f.r. 1.5', c15.verts, c15.faces, '+X');

/* ---- the sphere: the anchor that prices this whole region ---- */
const sph = parseObjMesh(readFileSync('../3D OBJ/sphere.obj', 'utf8'));
const SPH = describe('sphere (anchor)', sph.verts, sph.faces, '+Z');
const gom = parseObjMesh(readFileSync('../3D OBJ/gomboc.obj', 'utf8'));
const GOM = describe('gomboc', gom.verts, gom.faces, '+Z');

console.log('-- what the estimator sees in each --');
console.log('body                 proxy   class    max-section at   terminal base');
for (const b of [S, C10, C15, SPH, GOM]) {
  console.log(`${b.name.padEnd(20)} ${f3(b.proxy).padEnd(7)} ${String(b.cls).padEnd(8)} ${f3(b.maxAt).padEnd(16)} ${f3(b.terminalBase)}`);
}

console.log('\n-- classifier triggers (why each landed in its class) --');
for (const b of [S, C10, C15, SPH, GOM]) {
  const t = b.triggers || {};
  console.log(`${b.name.padEnd(20)} softFore ${f3(t.softFore ?? NaN)} softAft ${f3(t.softAft ?? NaN)} base ${f3(t.terminalBaseFrac ?? NaN)} reexp ${f3(t.rawRatio ?? NaN)} shoulder ${f3(t.shoulder ?? NaN)}`);
}

console.log('\n-- normalised area distribution A(x)/Amax, 20 stations nose->tail --');
console.log('the question: do these bodies actually evolve the same way?');
for (const b of [S, C10, C15, SPH, GOM]) {
  console.log(`${b.name.padEnd(20)} ${b.curve.map((v) => v.toFixed(2)).join(' ')}`);
}

/* ---- how far apart are they, in the estimator's own terms? ---- */
const rms = (a, b) => Math.sqrt(a.curve.reduce((s, v, i) => s + (v - b.curve[i]) ** 2, 0) / a.curve.length);
console.log('\n-- distance between area curves (RMS of A/Amax) --');
console.log(`Sunship vs C-class f.r. 1.0 : ${rms(S, C10).toFixed(3)}`);
console.log(`Sunship vs SPHERE           : ${rms(S, SPH).toFixed(3)}  <- the anchor pricing proxy ~0.8`);
console.log(`C-class 1.0 vs SPHERE       : ${rms(C10, SPH).toFixed(3)}`);
console.log(`Sunship vs C-class f.r. 1.5 : ${rms(S, C15).toFixed(3)}`);
console.log(`C-class 1.0 vs C-class 1.5  : ${rms(C10, C15).toFixed(3)}  <- same family, different fineness`);

console.log('\nREAD: the proxy collapses each of these curves to ONE number. Two bodies');
console.log('with similar proxy but different curves are exactly the case TR-291 showed');
console.log('the fat-region map cannot price. That is why the bare-Sunship figure is');
console.log('DEMOTED by the exam, not rescaled by it.');
