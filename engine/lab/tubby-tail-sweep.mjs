/**
 * DOES A FATTER SUNSHIP NEED A DIFFERENT ANSWER?
 *
 * Toby, 2026-08-18: "the tubby sunship, if it WAS affixed w/ a similarly
 * well done smart tail, should have really similar results as it's almost
 * the same body to begin with?"
 *
 * That is a claim about physics and it is testable, so this tests it
 * rather than agreeing with it. The Tubby Sunship is the stock hull
 * inflated radially a few percent (VE ~54.4% -> ~57%). This sweeps a
 * range of radial inflations and, for each one, builds a fairing BY THE
 * SAME FORMULA the real one was built by — picked up at 80% of the
 * envelope, exponent 0.8, extending +216 m — then scores it down the
 * PRODUCTION path (measureSectionalProxy -> estimateCd), exactly as
 * lab/sunship-tail-aerohull.mjs does for the stock hull.
 *
 * The bare column inflates the REAL mesh (y,z scaled) and measures that,
 * so it is not a body-of-revolution approximation. The tailed column
 * lathes from measured section areas, which is the same construction the
 * shipped SUNSHIP_TAILED record came from — apples to apples.
 *
 * NEVER DEPLOYS: lab/ is not in the bake list.
 * Run from CalcV2:  node lab/tubby-tail-sweep.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { measureSections } from '../src/sections.js';
import { measureSectionalProxy, estimateCd, applyGenericTail } from '../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';

const here = dirname(fileURLToPath(import.meta.url));
const SUNSHIP = join(here, '..', '..', '..', '3D OBJ', 'Sunship.obj');
const LENGTH_M = 300, EXTRA_M = 216, ATTACH = 0.80, P = 0.8;
const SPEED_KMH = 120;                 // the ideal cruise since 2026-08-18
const RINGS = 320, SEGS = 64;
const INFLATIONS = [1.00, 1.02, 1.04, 1.06, 1.08, 1.12, 1.20];

const base = parseObjMesh(readFileSync(SUNSHIP, 'utf8'));

/** The hull with its girth scaled by g (length untouched). */
function inflate(g) {
  return { verts: base.verts.map((v) => [v[0], v[1] * g, v[2] * g]), faces: base.faces };
}

/** Build the fairing on a hull and lathe the whole deployed body. */
function tailedBody(mesh) {
  const m = measureSections(mesh.verts, mesh.faces, { axis: '+Z', STATIONS: 256 });
  const N = m.A.length, scale = LENGTH_M / m.L, cellM = m.cell * scale, dx = LENGTH_M / N;
  const rHull = Array.from(m.A, (a) => Math.sqrt((a * cellM * cellM) / Math.PI));
  const ia = Math.min(N - 1, Math.round((ATTACH * LENGTH_M) / dx - 0.5));
  const ra = rHull[ia], xA = (ia + 0.5) * dx, xTip = LENGTH_M + EXTRA_M;
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
  return { verts, faces, xTip, ra };
}

const f4 = (x) => Number(x).toFixed(4);
const rows = [];
for (const g of INFLATIONS) {
  const hull = inflate(g);
  // BARE — the real inflated mesh, production path, 300 m envelope.
  const bareProxy = measureSectionalProxy(hull.verts, hull.faces, { axis: '+Z' });
  const bareGeom = measureDynamicsGeometry(hull.verts, hull.faces, { flightAxis: 'Z', lengthM: LENGTH_M });
  const bare = estimateCd(bareProxy, bareGeom, SPEED_KMH);
  // TAILED — its OWN fairing, same formula, production path.
  const t = tailedBody(hull);
  const tProxy = measureSectionalProxy(t.verts, t.faces, { axis: '+X' });
  const tGeom = measureDynamicsGeometry(t.verts, t.faces, { flightAxis: 'X', lengthM: t.xTip });
  const tail = estimateCd(tProxy, tGeom, SPEED_KMH);
  rows.push({
    g, bare: bare.cdEstimate, bareProxy: bareProxy.proxy,
    tail: tail.cdEstimate, tailProxy: tProxy.proxy, cls: tProxy.cls,
    generic: applyGenericTail(bare).cdEstimate,
    frontal: tGeom.frontalArea, wetted: tGeom.wettedArea,
  });
}

console.log(`== TUBBY SWEEP — each hull gets its OWN fairing, built by the same formula ==`);
console.log(`envelope ${LENGTH_M} m · fairing at ${ATTACH * 100}% · +${EXTRA_M} m · P=${P} · ${SPEED_KMH} km/h\n`);
console.log('  girth   bare Cd   OWN-TAIL Cd   vs stock   §5.4 generic   reveal');
console.log('  ' + '-'.repeat(68));
const stock = rows[0].tail;
for (const r of rows) {
  console.log(`  ${(r.g * 100).toFixed(0).padStart(4)}%   ${f4(r.bare)}    ${f4(r.tail)}`
    + `      ${((r.tail / stock - 1) * 100).toFixed(1).padStart(5)}%    ${f4(r.generic)}`
    + `       ${(r.bare / r.tail).toFixed(1).padStart(4)}x`);
}
console.log('\n  vs stock = how far this hull\'s own-tail Cd sits from the 100% hull\'s.');
console.log('  §5.4 generic = what the calculator gives it TODAY (flat 20% of pressure).');
