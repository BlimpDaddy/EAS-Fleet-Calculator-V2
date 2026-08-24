/**
 * SPIKE GATE — the six agreed criteria + kill rule (NEXT-THREAD, r8-amended,
 * 2026-08-15). Run: `node spike/flow-chamber/gate.mjs` from CalcV2.
 * Exit code = verdict. Honest reporting is the deliverable: a FAIL here is
 * a successful spike (it answers the question).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../../src/obj.js';
import { runChamber, makeCalibration } from './chamber.mjs';
import { makeSphere, makeCube, makePlate, makeTeardrop, makeEllipsoid } from './shapes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const corpusDir = join(here, '..', '..', '..', '..', '3D OBJ');

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));

const BASE = { NX: 80, NY: 36, NZ: 36, targetCross: 11, startX: 18, U: 0.1, tau: 0.56, ticks: 700 };
const run = (mesh, opts = {}) => runChamber(mesh.verts, mesh.faces, { ...BASE, ...opts });

console.log('== SPIKE: coarse geometric flow chamber vs the gate ==');
console.log(`base grid ${BASE.NX}x${BASE.NY}x${BASE.NZ}, U=${BASE.U}, tau=${BASE.tau} (the ONE physics knob), ticks=${BASE.ticks}\n`);

/* ---- anchors ---- */
const anchors = {
  teardrop: { mesh: makeTeardrop(3), cd: 0.045 },
  sphere: { mesh: makeSphere(), cd: 0.47 },
  cube: { mesh: makeCube(), cd: 1.05 },
  plate: { mesh: makePlate(), cd: 1.17 },
};
console.log('[anchors]');
for (const [name, a] of Object.entries(anchors)) {
  a.r = run(a.mesh);
  console.log(`  ${name.padEnd(9)} proxy ${f3(a.r.proxy)}  (frontal ${a.r.frontalArea} cells, ${a.r.converged ? 'converged' : 'NOT CONVERGED'}, ${Math.round(a.r.ms)} ms)`);
}

/* ---- 1. deterministic + convergent ---- */
console.log('\n[1] deterministic + convergent');
{
  const again = run(anchors.sphere.mesh);
  check('same input, bit-identical proxy', again.proxy === anchors.sphere.r.proxy,
    `${anchors.sphere.r.proxy} vs ${again.proxy}`);
  check('all anchors converged within the tick cap',
    Object.values(anchors).every((a) => a.r.converged));
}

/* ---- 2. anchor ordering with real separation ---- */
console.log('\n[2] anchor ordering: teardrop << sphere < cube <= plate');
{
  const [t, s, c, p] = [anchors.teardrop.r.proxy, anchors.sphere.r.proxy, anchors.cube.r.proxy, anchors.plate.r.proxy];
  check('teardrop MUCH lower than sphere (< 0.6x)', t < 0.6 * s, `${f3(t)} vs ${f3(s)}`);
  check('sphere clearly below cube (>= 10% gap)', s < 0.9 * c, `${f3(s)} vs ${f3(c)}`);
  check('cube <= plate (within 5%)', c <= 1.05 * p, `${f3(c)} vs ${f3(p)}`);
}

/* ---- 3. grid-alignment stability + signed-axis distinction ---- */
console.log('\n[3] grid-alignment stability (same orientation, sub-cell raster shifts)');
{
  for (const [name, mesh] of [['teardrop', anchors.teardrop.mesh], ['sphere', anchors.sphere.mesh]]) {
    const vals = [anchors[name].r.proxy];
    for (const off of [[0.33, 0.25, 0.4], [0.5, 0.5, 0.5], [0.7, 0.1, 0.85]]) {
      vals.push(run(mesh, { offset: off }).proxy);
    }
    const spread = (Math.max(...vals) - Math.min(...vals)) / (vals.reduce((a, b) => a + b) / vals.length);
    check(`${name}: raster-shift spread < 10%`, spread < 0.10, `spread ${(spread * 100).toFixed(1)}% [${vals.map(f3)}]`);
  }
  const fwd = anchors.teardrop.r.proxy;
  const rev = run(anchors.teardrop.mesh, { axis: '-X' }).proxy;
  check('+axis vs −axis differ for fore/aft-asymmetric body (> 5%)',
    Math.abs(fwd - rev) > 0.05 * Math.max(fwd, rev), `fwd ${f3(fwd)} vs rev ${f3(rev)}`);
}

/* ---- 4. 2x resolution ---- */
console.log('\n[4] 2x resolution: ordering preserved, results not radically moved');
{
  const hi = { NX: 160, NY: 72, NZ: 72, targetCross: 22, startX: 36, ticks: 1400 };
  const hiR = {};
  for (const [name, a] of Object.entries(anchors)) {
    hiR[name] = run(a.mesh, hi);
    console.log(`  ${name.padEnd(9)} proxy ${f3(hiR[name].proxy)}  (${hiR[name].converged ? 'converged' : 'NOT CONVERGED'}, ${Math.round(hiR[name].ms)} ms)`);
  }
  const order = (o) => ['teardrop', 'sphere', 'cube', 'plate'].sort((x, y) => o[x] - o[y]).join('<');
  check('2x keeps the anchor ordering',
    order({ teardrop: hiR.teardrop.proxy, sphere: hiR.sphere.proxy, cube: hiR.cube.proxy, plate: hiR.plate.proxy })
    === order({ teardrop: anchors.teardrop.r.proxy, sphere: anchors.sphere.r.proxy, cube: anchors.cube.r.proxy, plate: anchors.plate.r.proxy }));
  for (const name of Object.keys(anchors)) {
    const ratio = hiR[name].proxy / anchors[name].r.proxy;
    check(`${name}: 2x within x/÷1.6 of base`, ratio > 1 / 1.6 && ratio < 1.6, `ratio ${ratio.toFixed(2)}`);
  }
}

/* ---- calibration (anchors ONLY), then out-of-sample ---- */
console.log('\n[calibration] proxy -> Cd through the four anchors (monotone piecewise-linear)');
const cal = makeCalibration(Object.values(anchors).map((a) => [a.r.proxy, a.cd]));
for (const [name, a] of Object.entries(anchors)) {
  console.log(`  ${name.padEnd(9)} proxy ${f3(a.r.proxy)} -> Cd ${f3(cal(a.r.proxy))} (published ${a.cd})`);
}

console.log('\n[5] out-of-sample gross sanity (calibrated on anchors only)');
{
  const ell = run(makeEllipsoid(3).verts ? makeEllipsoid(3) : null);
  const ellCd = cal(ell.proxy);
  console.log(`  ellipsoid3:1 proxy ${f3(ell.proxy)} -> Cd ${f3(ellCd)}`);
  check('elongated smooth body beats the bluff sphere', ell.proxy < anchors.sphere.r.proxy,
    `${f3(ell.proxy)} vs ${f3(anchors.sphere.r.proxy)}`);

  const corpus = [
    ['Sunship.obj', 'Z'], ['washingmachine.obj', 'Z'], ['tubbysunship.obj', 'Z'], ['gomboc.obj', 'Z'],
  ];
  const results = {};
  if (!existsSync(corpusDir)) {
    console.log('  corpus absent — corpus checks skipped');
  } else {
    for (const [file, axis] of corpus) {
      const path = join(corpusDir, file);
      if (!existsSync(path)) { console.log(`  ${file}: not found, skipped`); continue; }
      const mesh = parseObjMesh(readFileSync(path, 'utf8'));
      if (!mesh.faces.length) { console.log(`  ${file}: point cloud, skipped`); continue; }
      const r = run(mesh, { axis: `+${axis}` });
      results[file] = r;
      console.log(`  ${file.padEnd(20)} proxy ${f3(r.proxy)} -> Cd ${f3(cal(r.proxy))} (${r.converged ? 'converged' : 'NOT CONVERGED'}, ${Math.round(r.ms)} ms)`);
    }
    if (results['Sunship.obj']) {
      check('bare Sunship in the broad high-drag region (Cd >= 0.15)',
        cal(results['Sunship.obj'].proxy) >= 0.15, f3(cal(results['Sunship.obj'].proxy)));
    }
    if (results['washingmachine.obj']) {
      check('washing machine never scores streamlined (Cd >= 0.3)',
        cal(results['washingmachine.obj'].proxy) >= 0.3, f3(cal(results['washingmachine.obj'].proxy)));
    }
    if (results['tubbysunship.obj']) {
      const cd = cal(results['tubbysunship.obj'].proxy);
      check('tubby merely PLAUSIBLE (0.05..1.3, no ordering required)', cd >= 0.05 && cd <= 1.3, f3(cd));
    }
  }
}

/* ---- 6. interactive cost (measured, not assumed) ---- */
console.log('\n[6] interactive cost');
{
  const msBase = Object.values(anchors).map((a) => a.r.ms);
  const worst = Math.max(...msBase);
  console.log(`  base-resolution runs: ${msBase.map((m) => Math.round(m) + ' ms').join(', ')}`);
  check('base-resolution estimate lands in interactive territory (< 5000 ms)', worst < 5000, `worst ${Math.round(worst)} ms`);
}

console.log(`\n${passed} passed, ${failed} failed`);
console.log(failed === 0
  ? 'GATE: PASS — the dumb chamber earned the next conversation.'
  : 'GATE: FAIL — per the kill rule, descriptors ship M6 unless the failure is plainly a bug (report honestly either way).');
process.exit(failed ? 1 : 0);
