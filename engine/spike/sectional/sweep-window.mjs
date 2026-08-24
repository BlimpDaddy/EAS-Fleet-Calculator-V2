/**
 * WINDOW-SIZE METROLOGY SWEEP (2026-08-16) — the r18-prescribed final
 * knob. Smooth-body floor scales with the window (curvature × span);
 * a kink's tangent-angle jump does not. Find the config where the
 * SMOOTH MAX and the CORNER MIN separate cleanly, then the threshold
 * is placed mid-gap in calibration-hr4.mjs. No thresholds are set in
 * this file — it only measures.
 */
import { shoulderAngleScore, makeShoulderAt } from './calibration-hr4.mjs';
import { measureSections } from './sections.mjs';
import { makeSphere, makeTeardrop, makeEllipsoid, makeLathe } from '../flow-chamber/shapes.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { parseObjMesh } = await import('../../src/obj.js');
const sun = parseObjMesh(readFileSync(join(here, '..', '..', '..', '..', '3D OBJ', 'Sunship.obj'), 'utf8'));

const r18body = makeLathe((t) => {
  if (t < 0.18) return 0.5 * Math.sin((t / 0.18) * Math.PI / 2);
  if (t < 0.40) return 0.5;
  if (t < 0.80) return 0.5 - (0.125 / 0.40) * (t - 0.40);
  return Math.max(0.375 - (0.375 / 0.20) * (t - 0.80), 0);
}, 3);

const SMOOTH = [
  ['sphere', makeSphere(), '+X'], ['teardrop', makeTeardrop(3), '+X'],
  ['ellipsoid3', makeEllipsoid(3), '+X'], ['sunship', sun, '+Z'],
  ['family blended 1.0/0.30', makeShoulderAt(0.30, 1.0), '+X'],
];
const CORNERS = [
  ['r17 knife 1.0', makeShoulderAt(0, 1.0), '+X'],
  ['r18 body (verbatim)', r18body, '+X'],
  ['family 0.75 sharp', makeShoulderAt(0, 0.75), '+X'],
  ['family 0.55 sharp', makeShoulderAt(0, 0.55), '+X'],
  ['family 0.35 sharp', makeShoulderAt(0, 0.35), '+X'],
];

const msec = new Map();
const M = (mesh, axis, ST = 128) => {
  const key = `${SMOOTH.concat(CORNERS).findIndex(([, m]) => m === mesh)}/${axis}/${ST}`;
  if (!msec.has(key)) msec.set(key, measureSections(mesh.verts, mesh.faces, { axis, STATIONS: ST }));
  return msec.get(key);
};

console.log('config          | smooth: sph  tear  ell   sun   blnd | corners: knife r18   0.75  0.55  0.35 | GAP (cornerMin/smoothMax)');
for (const kFrac of [64, 48, 32, 24]) {
  for (const smoothW of [1, 3, 5]) {
    const opts = { kFrac, smoothW };
    const s = SMOOTH.map(([, mesh, ax]) => shoulderAngleScore(M(mesh, ax), opts));
    const c = CORNERS.map(([, mesh, ax]) => shoulderAngleScore(M(mesh, ax), opts));
    const smoothMax = Math.max(...s), cornerMin = Math.min(...c);
    const gap = cornerMin / smoothMax;
    console.log(`L/${String(kFrac).padEnd(2)} sw=${smoothW}      | ${s.map((x) => x.toFixed(3)).join(' ')} | ${c.map((x) => x.toFixed(3)).join(' ')} | ${gap.toFixed(2)}${gap > 1.5 ? '  <-- CANDIDATE' : ''}`);
  }
}
console.log('\nresolution stability check at the best candidates (128 vs 256 stations):');
for (const [kFrac, smoothW] of [[64, 1], [64, 3], [48, 3], [48, 1]]) {
  const opts = { kFrac, smoothW };
  const rows = [];
  for (const [name, mesh, ax] of [SMOOTH[0], CORNERS[1], CORNERS[3]]) {
    const a = shoulderAngleScore(M(mesh, ax, 128), opts);
    const b = shoulderAngleScore(M(mesh, ax, 256), opts);
    rows.push(`${name} ${a.toFixed(3)}/${b.toFixed(3)}`);
  }
  console.log(`L/${kFrac} sw=${smoothW}: ${rows.join(' · ')}`);
}
