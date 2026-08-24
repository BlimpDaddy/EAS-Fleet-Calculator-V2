/**
 * CAN THE TAIL BE BUILT AUTOMATICALLY FOR ANY SHAPE?
 *
 * Toby, 2026-08-18: "is it possible to have the 'correct' tail
 * measurement work automatically... i guess this is a slippery slope coz
 * how to 'correctly' attach tail for any / other models."
 *
 * The worry is the right one, so this measures it instead of arguing
 * about it. The construction rule is FIXED AND DUMB — take the body's own
 * measured profile, pick the fairing up at 80% of the length (matching
 * RADIUS only — the slope is not matched, so this is radius-continuous
 * rather than tangential; the earlier claim of tangency was wrong, r20
 * 2026-08-19), taper it to a point over another 72% of the length,
 * exponent 0.8. It makes no decisions and has no shape-specific
 * cases. The question this answers is whether a rule that dumb still
 * produces SENSIBLE ORDERING when pointed at bodies nobody would ever
 * fair: does a faired washing machine still read clearly worse than a
 * faired Sunship, or does the tail flatter everything into looking alike?
 *
 * If the ordering survives, the rule can be applied uniformly and the
 * §5.4 flat-20% assumption retires with no exceptions to justify.
 *
 * NEVER DEPLOYS: lab/ is not in the bake list.
 * Run from CalcV2:  node lab/tail-any-shape.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { measureSections } from '../src/sections.js';
import { measureSectionalProxy, estimateCd, applyGenericTail } from '../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';

const here = dirname(fileURLToPath(import.meta.url));
const OBJ = join(here, '..', '..', '..', '3D OBJ');
const LENGTH_M = 300, ATTACH = 0.80, P = 0.8;
const EXTRA_FRAC = 216 / 300;          // the Sunship's tail, as a FRACTION of length
const SPEED_KMH = 120;
const RINGS = 320, SEGS = 64;

// Declared attitudes (§4.1: DECLARED, never detected) — the ratified
// natural-attitude ruling of 2026-08-16, applied to the .obj sources.
const SHAPES = [
  ['Sunship.obj', '+Z', 'SUNSHIP'],
  ['tubbysunship.obj', '+Z', 'TUBBY SUNSHIP'],
  ['cigar.obj', '+X', 'CIGAR'],
  ['thicccigar.obj', '+X', 'THICC CIGAR'],
  ['Aerosmena.obj', '+Z', 'LENTICULAR'],
  ['Bottle.obj', '-Y', 'BOTTLE'],
  ['car.obj', '+Z', 'CAR'],
  ['washingmachine.obj', '+Y', 'WASHING MACHINE'],
  ['sphere.obj', '+Z', 'SPHERE'],
];

/** The deployed body: the hull's own profile plus a fairing, lathed. */
function tailedBody(mesh, axis) {
  const m = measureSections(mesh.verts, mesh.faces, { axis, STATIONS: 256 });
  const N = m.A.length, scale = LENGTH_M / m.L, cellM = m.cell * scale, dx = LENGTH_M / N;
  const rHull = Array.from(m.A, (a) => Math.sqrt((a * cellM * cellM) / Math.PI));
  const extraM = EXTRA_FRAC * LENGTH_M;
  const ia = Math.min(N - 1, Math.round((ATTACH * LENGTH_M) / dx - 0.5));
  const ra = rHull[ia], xA = (ia + 0.5) * dx, xTip = LENGTH_M + extraM;
  const radiusAt = (x) => (x <= xA
    ? rHull[Math.min(N - 1, Math.max(0, Math.round(x / dx - 0.5)))]
    : (x < xTip ? ra * Math.pow((xTip - x) / (xTip - xA), P) : 0));

  const verts = [], faces = [], ringStart = [];
  for (let i = 0; i <= RINGS; i++) {
    const x = (xTip * i) / RINGS;
    const r = Math.max(radiusAt(x), 0);
    if (r < 1e-6) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
    ringStart.push(verts.length);
    for (let s = 0; s < SEGS; s++) {
      const th = (2 * Math.PI * s) / SEGS;
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
  }
  const ringSize = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
  for (let i = 0; i < RINGS; i++) {
    const a = ringStart[i], b = ringStart[i + 1];
    const aPole = ringSize(i) === 1, bPole = ringSize(i + 1) === 1;
    if (aPole && bPole) continue;
    for (let s = 0; s < SEGS; s++) {
      const s1 = (s + 1) % SEGS;
      if (aPole) faces.push([a, b + s, b + s1]);
      else if (bPole) faces.push([a + s, b, a + s1]);
      else { faces.push([a + s, b + s, b + s1]); faces.push([a + s, b + s1, a + s1]); }
    }
  }
  return { verts, faces, xTip, rAttach: ra, rEnd: rHull[N - 1] };
}

const f4 = (x) => Number(x).toFixed(4);
const rows = [];
for (const [file, axis, name] of SHAPES) {
  let mesh;
  try { mesh = parseObjMesh(readFileSync(join(OBJ, file), 'utf8')); }
  catch { console.log(`  (skipped ${file} — not found)`); continue; }
  if (!mesh.faces.length) { console.log(`  (skipped ${file} — no faces)`); continue; }
  const bareProxy = measureSectionalProxy(mesh.verts, mesh.faces, { axis });
  const bareGeom = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: axis[1], lengthM: LENGTH_M });
  const bare = estimateCd(bareProxy, bareGeom, SPEED_KMH);
  const t = tailedBody(mesh, axis);
  const tProxy = measureSectionalProxy(t.verts, t.faces, { axis: '+X' });
  const tGeom = measureDynamicsGeometry(t.verts, t.faces, { flightAxis: 'X', lengthM: t.xTip });
  const tail = estimateCd(tProxy, tGeom, SPEED_KMH);
  rows.push({ name, bare: bare.cdEstimate, bareProxy: bareProxy.proxy, bareCls: bareProxy.cls,
    tail: tail.cdEstimate, status: tail.status, tailProxy: tProxy.proxy,
    odd: tProxy.quality?.oddFraction, rAttach: t.rAttach, rEnd: t.rEnd,
    generic: applyGenericTail(bare).cdEstimate });
}

// A refused estimate must print as REFUSED. The first cut ran these
// through the number formatter, which turned status 'unavailable' into
// "0.0000" and a divide-by-null into "Infinity x" — a broken shape read
// as the best result in the table. Never format a null as a figure.
const cell = (r) => (r.status === 'ok' ? f4(r.tail) : ' REFUSED');
const reveal = (r) => (r.status === 'ok' ? `${(r.bare / r.tail).toFixed(1)}x` : '   —');

console.log('\n== ONE DUMB RULE, POINTED AT EVERYTHING ==');
console.log(`fairing at ${ATTACH * 100}% of length, +${(EXTRA_FRAC * 100).toFixed(0)}% of length, P=${P}, ${SPEED_KMH} km/h\n`);
console.log('  shape              bare Cd   OWN-TAIL Cd   reveal   §5.4 today   r@attach -> r@end');
console.log('  ' + '-'.repeat(84));
for (const r of rows) {
  const taper = `${r.rAttach.toFixed(0)} -> ${r.rEnd.toFixed(0)}`
    + (r.rAttach > r.rEnd ? '  closing' : '  STILL GROWING');
  console.log(`  ${r.name.padEnd(16)}   ${f4(r.bare)}   ${cell(r).padStart(9)}   `
    + `${reveal(r).padStart(6)}   ${f4(r.generic)}       ${taper}`);
}
const sun = rows.find((r) => r.name === 'SUNSHIP');
if (sun) {
  console.log('\n  ORDERING CHECK — own-tail Cd as a multiple of the tailed Sunship:');
  for (const r of rows) {
    console.log(`    ${r.name.padEnd(16)} ${r.status === 'ok' ? `${(r.tail / sun.tail).toFixed(2)}x` : 'refused'}`);
  }
}
console.log('\n  THE PRECONDITION: the construction assumes the body is already CLOSING at');
console.log('  the attach point. Where it is not, the "fairing" starts narrower than the');
console.log('  hull it should wrap and cuts into it — the mesh self-intersects, every');
console.log('  column comes back non-manifold (oddFraction 1.0), and the PRODUCTION');
console.log('  estimator returns status "unavailable" on its own. The failure is');
console.log('  self-detecting: no gate had to be invented for it.');
