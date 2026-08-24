/**
 * E2 DIAGNOSTIC — spec 71.4. Bounded implementation check, nothing else.
 *
 * The invariants say 114 multi-hits are IMPOSSIBLE:
 *   - the axis lies inside all 120 retained sections (min support +0.0458);
 *   - `reflexCount` reports 0 non-convex stations.
 * A convex section containing the origin admits exactly ONE outward
 * intersection per ray. So either an invariant is false, or `supportRadii`
 * miscounts.
 *
 * TWO CHECKS:
 *  1. dump every reported multi-hit's actual positive ray parameters and ask
 *     whether they are COINCIDENT (same point, reported twice by adjacent
 *     edges) or GENUINELY DISTINCT;
 *  2. an independent HALF-SPACE ORACLE. For a convex body given as
 *     { p : n_j . p <= h_j } and a ray p = t.d from an interior point,
 *
 *         t_max = min over { j : n_j . d > 0 } of  h_j / (n_j . d)
 *
 *     which is unique BY CONSTRUCTION — no edge counting at all. This uses
 *     the support representation in its native form.
 *
 * Nothing is suppressed. No threshold is touched.
 */
import { readFileSync } from 'node:fs';
import { parseObjVertices } from '../../../site/calcv2/src/obj.js';
import { volumeCentroid } from './ribbons.mjs';
import { hullMesh } from './hull-bodies.mjs';
import { makeSupportSkin, supportPolygon, STATIONS, TIP } from './support-skin.mjs';

const TWO_PI = Math.PI * 2, CANON = 24;
const rays = Array.from({ length: 2 * CANON }, (_, k) => (Math.PI * (k % CANON)) / CANON + (k >= CANON ? Math.PI : 0));
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));

/** the frozen edge-intersection primitive, instrumented to KEEP the hits */
function edgeHits(loop, th) {
  const ct = Math.cos(th), st = Math.sin(th), n = loop.length, hits = [];
  for (let i = 0; i < n; i++) {
    const p = loop[i], q = loop[(i + 1) % n];
    const g1 = p[0] * st - p[1] * ct, g2 = q[0] * st - q[1] * ct;
    if (g1 === g2 || (g1 < 0 && g2 < 0) || (g1 > 0 && g2 > 0)) continue;
    const t = g1 / (g1 - g2);
    const X = p[0] + t * (q[0] - p[0]), Y = p[1] + t * (q[1] - p[1]);
    const proj = X * ct + Y * st;
    if (proj > 0) hits.push({ edge: i, t, proj, X, Y });
  }
  return hits;
}

/** the half-space oracle — unique by construction */
function halfSpaceRadius(h, th) {
  const naz = h.length, ct = Math.cos(th), st = Math.sin(th);
  let t = Infinity, arg = -1;
  for (let j = 0; j < naz; j++) {
    const a = -Math.PI + (TWO_PI * j) / naz;
    const nd = Math.cos(a) * ct + Math.sin(a) * st;
    if (nd > 1e-12) { const c = h[j] / nd; if (c < t) { t = c; arg = j; } }
  }
  return { t, arg };
}

const v = parseObjVertices(readFileSync('C:/Users/Toby/Desktop/CodeEverything/3D OBJ/Sunship.obj', 'utf8'));
const h0 = hullMesh(v.map((p) => [p[2], p[1], -p[0]]));
const c = volumeCentroid(h0.verts, h0.faces).c;
const verts = h0.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
const skin = makeSupportSkin(verts, h0.faces, { sx: 0.005, thDeg: 2 });

console.log('\nE2 DIAGNOSTIC — SUNSHIP bare. Bounded implementation check (71.4).\n');

let nMulti = 0, coincident = 0, distinct = 0, worstGap = 0, worstOracleErr = 0;
const samples = [];
for (let i = i0; i <= i1; i++) {
  const loop = supportPolygon(skin.H[i], skin.naz);
  for (const th of rays) {
    const hits = edgeHits(loop, th);
    const orc = halfSpaceRadius(skin.H[i], th);
    if (hits.length > 1) {
      nMulti++;
      const projs = hits.map((q) => q.proj).sort((a, b) => a - b);
      const gap = projs[projs.length - 1] - projs[0];
      const rel = gap / projs[projs.length - 1];
      if (rel < 1e-6) coincident++; else { distinct++; if (gap > worstGap) worstGap = gap; }
      if (samples.length < 6) samples.push({ i, thDeg: th * (180 / Math.PI), hits, orc, gap, rel });
    }
    // oracle vs the frozen primitive, on EVERY ray, multi or not
    if (hits.length) {
      const rEdge = Math.max(...hits.map((q) => q.proj));
      const e = Math.abs(rEdge - orc.t) / Math.max(rEdge, 1e-12);
      if (e > worstOracleErr) worstOracleErr = e;
    }
  }
}

console.log(`  multi-hit ray-samples: ${nMulti}`);
console.log(`    COINCIDENT (same point, relative gap < 1e-6): ${coincident}`);
console.log(`    GENUINELY DISTINCT:                           ${distinct}`);
if (distinct) console.log(`    worst distinct separation: ${worstGap.toExponential(3)}`);
console.log(`\n  HALF-SPACE ORACLE vs the frozen edge primitive, over ALL retained rays:`);
console.log(`    worst relative difference: ${worstOracleErr.toExponential(3)}`);

console.log('\n  sample multi-hit cases:');
for (const s of samples) {
  console.log(`    station ${s.i} theta ${s.thDeg.toFixed(1)}deg — ${s.hits.length} hits, ` +
    `relative gap ${s.rel.toExponential(2)}, oracle t=${s.orc.t.toFixed(8)}`);
  for (const q of s.hits) console.log(`        edge ${String(q.edge).padStart(4)}  t=${q.t.toFixed(6)}  proj=${q.proj.toFixed(8)}  at (${q.X.toFixed(6)}, ${q.Y.toFixed(6)})`);
}

console.log('\n  VERDICT:');
if (nMulti === 0) console.log('    no multi-hits reproduced — investigate the harness difference');
else if (distinct === 0) {
  console.log('    ALL reported multi-hits are the SAME POINT counted twice by adjacent edges.');
  console.log('    The geometry is fine; `supportRadii` has a duplicate-hit bookkeeping defect.');
} else {
  console.log(`    ${distinct} genuinely distinct multi-hits — an invariant is false and must be isolated.`);
}
console.log('');
