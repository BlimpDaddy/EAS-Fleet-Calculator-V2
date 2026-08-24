/**
 * SPIKE 2 runner — raw, untuned sectional scores on anchors + corpus.
 * The question (converged 2026-08-15): does the ordering fall out of the
 * geometry NATURALLY, before any parameter fiddling? Kill-rule analog:
 * S_CRIT and a monotone calibration are the only tunables allowed later.
 * Run: `node spike/sectional/run.mjs` from CalcV2.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../../src/obj.js';
import { makeSphere, makeCube, makePlate, makeTeardrop, makeEllipsoid } from '../flow-chamber/shapes.mjs';
import { measureSections, scoreSections } from './sections.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const corpusDir = join(here, '..', '..', '..', '..', '3D OBJ');

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));

const evaluate = (mesh, axis = '+X') => {
  const m = measureSections(mesh.verts, mesh.faces, { axis });
  return { ...scoreSections(m), ms: m.ms };
};

console.log('== SPIKE 2: sectional estimator — RAW scores, zero tuning ==');
console.log('one knob S_CRIT = tan(15 deg); composite = aftBaseFrac x (1 + cornerPenalty)\n');
console.log('shape                aftBase  nose   rough  compact  COMPOSITE  fineness  ms');

const row = (name, s) => console.log(
  `${name.padEnd(20)} ${f3(s.aftBaseFrac).padStart(6)} ${f3(s.noseFrac).padStart(6)} ${f3(s.rough).padStart(6)}` +
  ` ${f3(s.compactness).padStart(7)} ${f3(s.composite).padStart(9)} ${f3(s.fineness).padStart(9)}  ${Math.round(s.ms)}`);

const S = {};
S.teardrop = evaluate(makeTeardrop(3)); row('teardrop (f3)', S.teardrop);
S.sphere = evaluate(makeSphere()); row('sphere', S.sphere);
S.cube = evaluate(makeCube()); row('cube', S.cube);
S.plate = evaluate(makePlate()); row('plate (normal)', S.plate);
S.ellipsoid = evaluate(makeEllipsoid(3)); row('ellipsoid 3:1', S.ellipsoid);
S.teardropRev = evaluate(makeTeardrop(3), '-X'); row('teardrop REVERSED', S.teardropRev);

console.log('\n[corpus] (flight axis Z, as upstream)');
const corpus = [['Sunship.obj', 'sunship'], ['tubbysunship.obj', 'tubby'], ['washingmachine.obj', 'washmachine'], ['gomboc.obj', 'gomboc']];
if (existsSync(corpusDir)) {
  for (const [file, key] of corpus) {
    const path = join(corpusDir, file);
    if (!existsSync(path)) { console.log(`  ${file}: not found`); continue; }
    const mesh = parseObjMesh(readFileSync(path, 'utf8'));
    if (!mesh.faces.length) { console.log(`  ${file}: point cloud, skipped`); continue; }
    S[key] = evaluate(mesh, '+Z');
    row(key, S[key]);
  }
} else console.log('  corpus absent — skipped');

console.log('\n[gate-lite: does the ordering fall out RAW?]');
check('teardrop MUCH lower than sphere (< 0.6x)', S.teardrop.composite < 0.6 * S.sphere.composite,
  `${f3(S.teardrop.composite)} vs ${f3(S.sphere.composite)}`);
check('sphere clearly below cube (>= 10% gap)', S.sphere.composite < 0.9 * S.cube.composite,
  `${f3(S.sphere.composite)} vs ${f3(S.cube.composite)}`);
check('cube <= plate (within 5%)', S.cube.composite <= 1.05 * S.plate.composite,
  `${f3(S.cube.composite)} vs ${f3(S.plate.composite)}`);
check('elongated smooth ellipsoid beats the sphere', S.ellipsoid.composite < S.sphere.composite,
  `${f3(S.ellipsoid.composite)} vs ${f3(S.sphere.composite)}`);
check('reversed teardrop clearly worse than forward (> 1.5x)', S.teardropRev.composite > 1.5 * S.teardrop.composite,
  `rev ${f3(S.teardropRev.composite)} vs fwd ${f3(S.teardrop.composite)}`);
if (S.sunship) {
  check('bare Sunship scores bluff-ish (composite above ellipsoid, below cube)',
    S.sunship.composite > S.ellipsoid.composite && S.sunship.composite < S.cube.composite,
    f3(S.sunship.composite));
}
if (S.washmachine) {
  check('washing machine never scores streamlined (> 3x teardrop)',
    S.washmachine.composite > 3 * S.teardrop.composite, f3(S.washmachine.composite));
}
if (S.tubby) {
  check('tubby PLAUSIBLE (positive, not above cube-land)', S.tubby.composite > 0 && S.tubby.composite <= 1.3, f3(S.tubby.composite));
}
const worstMs = Math.max(...Object.values(S).map((s) => s.ms));
check('interactive cost: worst measurement < 500 ms', worstMs < 500, `worst ${Math.round(worstMs)} ms`);

console.log(`\n${passed} passed, ${failed} failed`);
console.log(failed === 0 ? 'RAW ORDERING FALLS OUT — the Pareto estimator is real; calibration next.'
  : 'Raw ordering incomplete — see failures; judge whether S_CRIT-only tuning can honestly fix them.');
process.exit(failed ? 1 : 0);
