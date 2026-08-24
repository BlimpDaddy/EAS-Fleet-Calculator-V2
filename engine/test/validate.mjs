/**
 * Runs the JS pipeline over .obj files and prints metrics for diffing against the
 * Python oracle (CalcV2.vsve.py / scratchpad oracle.py).
 *
 * Deterministic quantities (simple VS, VE, hull volume, radius) should agree with
 * Python to near machine precision. VS_inf is a Monte-Carlo estimate drawn from a
 * different RNG, so it agrees only within sampling error — hence --seeds, which
 * reports the spread across independent seeds so we can see whether a JS/Python gap
 * is real or just noise.
 *
 *   node test/validate.mjs                  # default shape set
 *   node test/validate.mjs --seeds 5 a.obj  # spread across 5 seeds
 *   node test/validate.mjs --samples 10000  # faster sweep
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { parseObjVertices } from '../src/obj.js';
import { computeShapeMetrics } from '../src/shapeMetrics.js';

const OBJ_DIR = 'C:/Users/Toby/Desktop/CodeEverything/3D OBJ';

const DEFAULTS = [
  'sphere.obj',
  'Sunship.obj',
  'tubbysunship.obj',
  'cigar.obj',
  'gomboc.obj',
  'dodecahedron.obj',
  'tetrahedron.obj',
  '10303_pencil_V1_iterations-2.obj',
];

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return Number(v);
};
const samples = opt('samples', 69420);
const seeds = opt('seeds', 1);
const files = args.length ? args : DEFAULTS.map((f) => `${OBJ_DIR}/${f}`);

console.log(`samples=${samples}  seeds=${seeds}\n`);
console.log(
  'file'.padEnd(34) +
    'simpleVS'.padStart(11) +
    'VS_inf'.padStart(11) +
    'VE %'.padStart(10) +
    'verts'.padStart(8) +
    'hull'.padStart(7) +
    'ballErr'.padStart(11) +
    'time'.padStart(8)
);
console.log('-'.repeat(100));

for (const path of files) {
  if (!existsSync(path)) {
    console.log(`${basename(path).slice(0, 33).padEnd(34)}  MISSING`);
    continue;
  }
  const t0 = performance.now();
  const verts = parseObjVertices(readFileSync(path, 'utf8'));

  let first = null;
  const vsInfRuns = [];
  for (let s = 1; s <= seeds; s++) {
    const m = computeShapeMetrics(verts, { samples, seed: s });
    if (!first) first = m;
    vsInfRuns.push(m.vsInf);
  }
  const dt = (performance.now() - t0) / 1000;

  const spread =
    seeds > 1
      ? `  [${Math.min(...vsInfRuns).toFixed(4)}..${Math.max(...vsInfRuns).toFixed(4)}]`
      : '';

  console.log(
    basename(path).slice(0, 33).padEnd(34) +
      first.simpleVS.toFixed(4).padStart(11) +
      (vsInfRuns.reduce((a, b) => a + b, 0) / seeds).toFixed(4).padStart(11) +
      first.ve.toFixed(3).padStart(10) +
      String(first.vertexCount).padStart(8) +
      String(first.hullVertexCount).padStart(7) +
      first.ballMaxExcess.toExponential(1).padStart(11) +
      `${dt.toFixed(1)}s`.padStart(8) +
      spread
  );
}
