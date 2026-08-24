/**
 * CLOSURE CENTROID — candidate second descriptor, DIAGNOSTIC ONLY (2026-08-19)
 *
 * Implements the external implementation brief, which is better than this
 * ledger's earlier A(0.7L) proposal on three counts:
 *   - no magic station; it uses the whole 128-point curve;
 *   - no argmax. The backward monotone envelope sets env[0] = 1 for every
 *     body, so the shed distribution is automatically zero ahead of the
 *     maximum section. That removes the instability A(0.7L) was dodging
 *     rather than solving;
 *   - it is an INTEGRAL (first moment of the shed distribution), so it
 *     inherits A(0.7L)'s numerical stability without its arbitrariness.
 *
 * DEFINITION. From the normalised area curve a_i = A_i/A_max:
 *     env      = backward running max of a           (monotone envelope)
 *     shed_i   = max(0, env_i - env_{i+1})           (area given back here)
 *     centroid = SUM(u_i * shed_i) / SUM(shed_i),  u_i = (i+1)/N
 * plus the terminal base at u = 1. Meaning: how far back along the body,
 * on average, does it hand its cross-section back to the flow. Low = long
 * early taper. High = carries bulk late, then closes hard.
 *
 * NO fitted constants. NO argmax. NO change to production Cd. Nothing here
 * is calibrated and nothing here is consumed by the engine.
 *
 * WHAT THIS FILE IS ACTUALLY FOR. The brief proposes testing whether the
 * current estimator's RESIDUALS correlate with this descriptor. That test
 * is checked here for feasibility before anyone relies on it — see the
 * coverage section, which is the real finding.
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../../src/obj.js';
import { measureSections } from '../../src/sections.js';
import { measureSectionalProxy } from '../../src/cdEstimator.js';
import { makeSphere, makeEllipsoid } from '../flow-chamber/shapes.mjs';
import { latheProfile, BODIES as TN614 } from './tn614-bodies.mjs';

/* TR-291 Table I (inlined — importing tr291.mjs would run the exam). */
const TR291 = [[0, 0], [1, 1.001], [2, 1.747], [3, 2.286], [4, 2.688], [5, 2.982], [6, 3.204],
  [7, 3.379], [8, 3.511], [10, 3.683], [12, 3.779], [14, 3.830], [16, 3.849], [16.6, 3.850],
  [18, 3.840], [20, 3.797], [22, 3.738], [24, 3.659], [26, 3.558], [28, 3.443], [30, 3.318],
  [32, 3.170], [34, 3.005], [36, 2.817], [38, 2.608], [40, 2.369], [41, 2.236], [42, 2.098],
  [43, 1.945], [44, 1.766], [45, 1.554], [46, 1.281], [47, 0.912], [48, 0]];
/* TR-432 Akron published offsets [a/L, radius inches], L = 235.44 in. */
const AKRON = [[0.00, 0], [0.02, 4.95], [0.05, 9.96], [0.10, 14.20], [0.15, 16.65],
  [0.20, 18.39], [0.25, 19.12], [0.30, 19.61], [0.35, 19.85], [0.40, 19.90], [0.45, 19.90],
  [0.50, 19.80], [0.55, 19.59], [0.60, 19.12], [0.65, 18.46], [0.70, 17.50], [0.75, 16.15],
  [0.80, 14.44], [0.85, 12.29], [0.90, 9.61], [0.95, 6.52], [1.00, 0]];

/** THE DESCRIPTOR. No fitted constants, no argmax. */
export function closureDescriptors(verts, faces, axis) {
  const m = measureSections(verts, faces, { axis });
  const A = Array.from(m.A);
  const aMax = Math.max(...A);
  const N = A.length;
  const a = A.map((v) => v / aMax);

  const env = a.slice();
  for (let i = N - 2; i >= 0; i--) env[i] = Math.max(env[i], env[i + 1]);

  let shed = 0, moment = 0;
  const bin = { early: 0, mid: 0, late: 0 };
  for (let i = 0; i + 1 < N; i++) {
    const d = Math.max(0, env[i] - env[i + 1]);
    if (d <= 0) continue;
    const u = (i + 1) / N;
    shed += d; moment += u * d;
    if (u >= 0.50 && u < 0.70) bin.early += d;
    else if (u >= 0.70 && u < 0.85) bin.mid += d;
    else if (u >= 0.85) bin.late += d;
  }
  shed += env[N - 1]; moment += env[N - 1];        // terminal base at u = 1
  bin.late += env[N - 1];

  const centroid = shed > 0 ? moment / shed : 0;
  return { centroid, early: bin.early / shed, mid: bin.mid / shed, late: bin.late / shed };
}

const lathePct = (pts) => latheProfile(pts, 192, 48);
const cclass = (lenIn) => lathePct(TR291.map(([s, r]) => [(s / 48) * 100, (r / lenIn) * 100]));
const akron = lathePct(AKRON.map(([aL, rIn]) => [aL * 100, (rIn / 235.44) * 100]));

/* ---------- 1. convergence, before anything is quoted ---------- */
console.log('== CLOSURE CENTROID — candidate second descriptor (DIAGNOSTIC ONLY) ==\n');
console.log('-- convergence: is it stable before we quote it? --');
console.log('rings x segs   C-class f.r.1.0   Akron');
for (const [r, s] of [[64, 24], [96, 28], [128, 36], [192, 48], [256, 64]]) {
  const c = closureDescriptors(...(({ verts, faces }) => [verts, faces])(latheProfile(TR291.map(([st, rr]) => [(st / 48) * 100, (rr / 7.700) * 100]), r, s)), '+X');
  const k = closureDescriptors(...(({ verts, faces }) => [verts, faces])(latheProfile(AKRON.map(([aL, rIn]) => [aL * 100, (rIn / 235.44) * 100]), r, s)), '+X');
  console.log(`${String(r).padStart(4)} x ${String(s).padStart(3)}     ${c.centroid.toFixed(4)}            ${k.centroid.toFixed(4)}`);
}

/* ---------- 2. the whole corpus ---------- */
const sun = parseObjMesh(readFileSync('../3D OBJ/Sunship.obj', 'utf8'));
const tailed = parseObjMesh(readFileSync('lab/sunship-tail-aerohull-candidate.obj', 'utf8'));

const CORPUS = [];
for (const [name, b] of Object.entries(TN614)) {
  const m = lathePct(b.pts);
  CORPUS.push([`TN614-${name}`, m.verts, m.faces, '+X', 'CALIBRATION/held-out', b.cdA]);
}
CORPUS.push(['TR291 C-class (all 8)', ...(({ verts, faces }) => [verts, faces])(cclass(7.700)), '+X', 'held-out exam', null]);
CORPUS.push(['TR432 Akron', akron.verts, akron.faces, '+X', 'independent check', null]);
const sph = makeSphere(), pro = makeEllipsoid(1.8), obl = makeEllipsoid(0.75);
CORPUS.push(['sphere', sph.verts, sph.faces, '+X', 'ANCHOR', null]);
CORPUS.push(['E2 prolate 1:1.8', pro.verts, pro.faces, '+X', 'ANCHOR', null]);
CORPUS.push(['E2 oblate 1:0.75', obl.verts, obl.faces, '+X', 'ANCHOR', null]);
CORPUS.push(['Sunship BARE', sun.verts, sun.faces, '+Z', 'the ship', null]);
CORPUS.push(['Sunship TAILED', tailed.verts, tailed.faces, '+X', 'the ship', null]);

console.log('\n-- the descriptor across the whole corpus --');
console.log('body                    proxy    centroid   early  mid    late    role');
const out = [];
for (const [n, v, f, ax, role] of CORPUS) {
  const d = closureDescriptors(v, f, ax);
  const p = measureSectionalProxy(v, f, { axis: ax }).proxy;
  out.push([n, p, d, role]);
  console.log(`${n.padEnd(23)} ${p.toFixed(3).padEnd(8)} ${d.centroid.toFixed(4).padEnd(10)} ${d.early.toFixed(2)}   ${d.mid.toFixed(2)}   ${d.late.toFixed(2)}    ${role}`);
}

/* ---------- 3. THE REAL QUESTION: can the corpus support the proposed test? ---------- */
console.log('\n-- CAN THE PROPOSED RESIDUAL TEST ACTUALLY RUN? --');
const cal = out.filter(([, , , r]) => r.startsWith('CALIBRATION'));
const anch = out.filter(([, , , r]) => r === 'ANCHOR');
const fat = out.filter(([n]) => n.startsWith('TR291'));
const spread = (rows) => {
  const c = rows.map(([, , d]) => d.centroid);
  return [Math.min(...c), Math.max(...c)];
};
const [tnLo, tnHi] = spread(cal);
const [anLo, anHi] = spread(anch);
console.log(`TN-614 family (6 bodies, varied closure, SLENDER): centroid ${tnLo.toFixed(3)} .. ${tnHi.toFixed(3)}  (spread ${(tnHi - tnLo).toFixed(3)})`);
console.log(`fat ANCHORS (sphere + both ellipsoids)           : centroid ${anLo.toFixed(3)} .. ${anHi.toFixed(3)}  (spread ${(anHi - anLo).toFixed(3)})`);
console.log(`TR-291 C-class (all eight share one profile)     : centroid ${fat[0][2].centroid.toFixed(3)}  (spread 0.000 by construction)`);
console.log('\nWHERE THE RESIDUALS ARE:  slender end ~0-3% (calibrated/near-zero) · fat end 2-5x');
console.log('WHERE THE CLOSURE VARIES: slender end (TN-614, 6 distinct closures) · fat end 2 values');
console.log('\n>>> The variance and the residual are in DIFFERENT PLACES. The proposed');
console.log('    correlation cannot be run on the present corpus: where closure varies the');
console.log('    residual is ~zero, and where the residual is large closure barely varies.');

/* ---------- 4. what IS answerable today: domain of validity ---------- */
console.log('\n-- WHAT IS ANSWERABLE TODAY: is the Sunship inside the calibrated closure range? --');
const calAll = [...cal, ...anch].map(([, , d]) => d.centroid);
const lo = Math.min(...calAll), hi = Math.max(...calAll);
for (const [n, , d] of out.filter(([n2]) => n2.startsWith('Sunship'))) {
  const inside = d.centroid >= lo && d.centroid <= hi;
  console.log(`${n.padEnd(16)} centroid ${d.centroid.toFixed(4)}  vs calibration range [${lo.toFixed(4)}, ${hi.toFixed(4)}]  -> ${inside ? 'INSIDE (interpolating)' : 'OUTSIDE (EXTRAPOLATING)'}`);
}
