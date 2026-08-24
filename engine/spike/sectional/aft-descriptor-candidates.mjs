/**
 * CANDIDATE AFTERBODY DESCRIPTORS — DOES ANY OF THEM SEPARATE THE TWO
 * FAMILIES? (2026-08-19)
 *
 * TR-291 falsified monotonicity of the fat rounded map and named the
 * missing information: mid-max bodies (sphere, ellipsoids — every fat
 * ANCHOR) versus forward-max bodies with long recovery (the C-class
 * family — the only measured body that FAILS). A second geometric axis
 * is the architecturally correct fix.
 *
 * Before anyone builds one, the candidate metric has to be shown to
 * actually separate the two families. This file measures several
 * candidates on the same 128-station area curve the proxy already uses,
 * so all of them are free at runtime.
 *
 * NOTHING HERE IS CALIBRATED OR FITTED. It is a screening test of
 * DESCRIPTORS, not of drag. TR-291 remains held out: these four hulls
 * appear only so the descriptor can be shown to separate them from the
 * anchors, which is a geometric question, not a calibration one.
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../../src/obj.js';
import { measureSections } from '../../src/sections.js';
import { measureSectionalProxy } from '../../src/cdEstimator.js';
import { makeSphere, makeEllipsoid } from '../flow-chamber/shapes.mjs';
import { latheProfile } from './tn614-bodies.mjs';

const OFF = [[0, 0], [1, 1.001], [2, 1.747], [3, 2.286], [4, 2.688], [5, 2.982], [6, 3.204],
  [7, 3.379], [8, 3.511], [10, 3.683], [12, 3.779], [14, 3.830], [16, 3.849], [16.6, 3.850],
  [18, 3.840], [20, 3.797], [22, 3.738], [24, 3.659], [26, 3.558], [28, 3.443], [30, 3.318],
  [32, 3.170], [34, 3.005], [36, 2.817], [38, 2.608], [40, 2.369], [41, 2.236], [42, 2.098],
  [43, 1.945], [44, 1.766], [45, 1.554], [46, 1.281], [47, 0.912], [48, 0]];
const cclass = (lengthIn) => latheProfile(OFF.map(([s, r]) => [(s / 48) * 100, (r / lengthIn) * 100]), 192, 48);

/** All candidates, from one normalised area curve A(x)/Amax over x/L. */
function descriptors(verts, faces, axis) {
  const m = measureSections(verts, faces, { axis });
  const A = Array.from(m.A);
  const aMax = Math.max(...A);
  const N = A.length;
  const a = A.map((v) => v / aMax);
  const iMax = a.indexOf(1);
  const xMax = iMax / N;

  // GPT's proposed R_aft: mean retained area AFTER the max section,
  // normalised by the afterbody length.
  let s = 0, n = 0;
  for (let i = iMax; i < N; i++) { s += a[i]; n++; }
  const rAftNormalised = s / n;

  // The same integral WITHOUT dividing by afterbody length, i.e. as a
  // fraction of total length — keeps the length information.
  const rAftAbsolute = s / N;

  // Closure length: axial distance from 0.95*Amax down to 0.05*Amax, /L.
  let i95 = iMax; while (i95 < N - 1 && a[i95] > 0.95) i95++;
  let i05 = i95; while (i05 < N - 1 && a[i05] > 0.05) i05++;
  const closureLength = (i05 - i95) / N;

  // Mean closure slope over that span: d(A/Amax)/d(x/L).
  const closureSlope = closureLength > 0 ? 0.9 / closureLength : Infinity;

  // Area still to be recovered at 70% of length.
  const a70 = a[Math.min(N - 1, Math.round(0.7 * N))];

  return { xMax, rAftNormalised, rAftAbsolute, closureLength, closureSlope, a70,
    proxy: measureSectionalProxy(verts, faces, { axis }).proxy };
}

const sph = makeSphere(), pro = makeEllipsoid(1.8), obl = makeEllipsoid(0.75);
const sun = parseObjMesh(readFileSync('../3D OBJ/Sunship.obj', 'utf8'));

const BODIES = [
  ['sphere            ANCHOR', sph.verts, sph.faces, '+X', 0.462],
  ['E2 prolate 1:1.8  ANCHOR', pro.verts, pro.faces, '+X', 0.213],
  ['E2 oblate 1:0.75  ANCHOR', obl.verts, obl.faces, '+X', 0.559],
  ['Sunship (bare)      SHIP', sun.verts, sun.faces, '+Z', null],
  ['C-class f.r. 1.0  FAILED', ...(({ verts, faces }) => [verts, faces])(cclass(7.700)), '+X', 0.063],
  ['C-class f.r. 1.5  FAILED', ...(({ verts, faces }) => [verts, faces])(cclass(11.550)), '+X', 0.022],
  ['C-class f.r. 2.0  FAILED', ...(({ verts, faces }) => [verts, faces])(cclass(15.400)), '+X', 0.008],
];

console.log('== CANDIDATE AFTERBODY DESCRIPTORS: does any separate the two families? ==\n');
console.log('A descriptor is USEFUL here only if the ANCHOR bodies and the FAILED bodies');
console.log('land in clearly different ranges. Otherwise it carries no new information.\n');
console.log('body                       proxy   x_max   R_aft(norm)  R_aft(abs)  closureL  slope   A@0.7L');
const rows = [];
for (const [name, v, f, ax] of BODIES) {
  const d = descriptors(v, f, ax);
  rows.push([name, d]);
  console.log(`${name.padEnd(26)} ${d.proxy.toFixed(3)}   ${d.xMax.toFixed(3)}   ${d.rAftNormalised.toFixed(3)}        ${d.rAftAbsolute.toFixed(3)}       ${d.closureLength.toFixed(3)}     ${d.closureSlope.toFixed(2)}    ${d.a70.toFixed(3)}`);
}

const anchors = rows.filter(([n]) => n.includes('ANCHOR')).map(([, d]) => d);
const failed = rows.filter(([n]) => n.includes('FAILED')).map(([, d]) => d);
const ship = rows.find(([n]) => n.includes('SHIP'))[1];

console.log('\n-- separation test: do ANCHOR and FAILED ranges overlap? --');
const keys = ['xMax', 'rAftNormalised', 'rAftAbsolute', 'closureLength', 'closureSlope', 'a70'];
for (const k of keys) {
  const A = anchors.map((d) => d[k]), F = failed.map((d) => d[k]);
  const aLo = Math.min(...A), aHi = Math.max(...A), fLo = Math.min(...F), fHi = Math.max(...F);
  const aMid = (aLo + aHi) / 2, fMid = (fLo + fHi) / 2;
  const sep = Math.abs(aMid - fMid);
  // strength = separation as a fraction of the two families' mean level
  const strength = 100 * sep / ((Math.abs(aMid) + Math.abs(fMid)) / 2);
  // the ship: which family centre is it nearer, and by how much
  const dA = Math.abs(ship[k] - aMid), dF = Math.abs(ship[k] - fMid);
  console.log(`${k.padEnd(16)} anchors ${aMid.toFixed(3)}  failed ${fMid.toFixed(3)}  separation ${strength.toFixed(1)}%   ship ${ship[k].toFixed(3)} sits ${(100 * dA / sep).toFixed(0)}% of the gap from ANCHOR, ${(100 * dF / sep).toFixed(0)}% from FAILED -> ${dA < dF ? 'ANCHOR side' : 'FAILED side'}`);
}
