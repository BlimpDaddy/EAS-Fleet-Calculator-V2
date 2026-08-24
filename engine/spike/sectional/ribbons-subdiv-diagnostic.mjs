/**
 * CAUSE-SEPARATION DIAGNOSTIC (2026-08-20) — NOT a Phase 1 re-test.
 *
 * Phase 1 failed stability on ONE body: Sunship BARE, 7.94% vs a 5% limit,
 * with turningExcess 21.6% where every clean lathe body reads ~0. Two
 * candidate causes were not separable from the corpus run:
 *   (a) facet noise on a 2778-vertex mesh cut by 48 half-planes, or
 *   (b) REAL directional content being under-sampled -- bare Sunship is the
 *       only body with genuine inter-ribbon spread (63 deg vs 0.0).
 *
 * This test separates them with GEOMETRY-PRESERVING subdivision: each
 * triangle is split 1->4 at its edge midpoints. Every midpoint lies exactly
 * on the original planar facet, so the SURFACE IS UNCHANGED -- only the
 * tessellation density changes. Any movement in the metrics is therefore
 * attributable to tessellation, not to the object.
 *
 * THE FORK, declared before running:
 *   A. excess -> ~0 AND spread survives  => facet discretisation was the
 *      numerical problem; the directional signal is real; the
 *      representation survives and needs a mesh-quality precondition.
 *   B. BOTH collapse => much of the apparent directional structure was
 *      sampling artefact.
 *   C. excess stays high => deeper than faceting; stop and understand it
 *      before trying any remedy.
 *
 * No spec change. No threshold change. No production remedy. The frozen
 * extractor is used exactly as committed.
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../../src/obj.js';
import { extractRibbons, ribbonMetrics } from './ribbons.mjs';

const TIP = 0.025, DEG = 180 / Math.PI;

/** 1->4 split at edge midpoints. Surface EXACTLY preserved; verts never moved. */
function subdivide(verts, faces) {
  const V = verts.map((v) => v.slice());
  const mid = new Map();
  const M = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (mid.has(k)) return mid.get(k);
    const p = [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2];
    const i = V.push(p) - 1; mid.set(k, i); return i;
  };
  const F = [];
  for (const f of faces) {
    for (let k = 1; k + 1 < f.length; k++) {      // fan-triangulate first
      const [a, b, c] = [f[0], f[k], f[k + 1]];
      const ab = M(a, b), bc = M(b, c), ca = M(c, a);
      F.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
  }
  return { verts: V, faces: F };
}

function stats(mesh, planes) {
  const F = extractRibbons(mesh.verts, mesh.faces, { axis: 'Z', up: 'Y', planes });
  const per = F.ribbons.map((r) => ribbonMetrics(r, F.L, { tipFrac: TIP }));
  const tot = per.map((p) => p.absTurn * DEG).sort((a, b) => a - b);
  const zoneMed = [];
  for (let z = 0; z < 8; z++) {
    const a = per.map((p) => p.zones[z].abs * DEG).sort((x, y) => x - y);
    zoneMed.push(a[Math.floor(a.length / 2)]);
  }
  return {
    excess: Math.max(...per.map((p) => p.turningExcess)),
    spread: tot[tot.length - 1] - tot[0],
    median: tot[Math.floor(tot.length / 2)],
    zoneMed, multiHit: F.report.multiHitFrac,
  };
}
const rms = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
const mag = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

let mesh = parseObjMesh(readFileSync('../3D OBJ/Sunship.obj', 'utf8'));
console.log('CAUSE SEPARATION — Sunship BARE under geometry-preserving subdivision');
console.log('surface unchanged at every level; only tessellation density changes\n');
console.log('level   verts    tris    turningExcess   ribbon spread   median turn   multiHit');
const rows = [];
for (let lvl = 0; lvl <= 2; lvl++) {
  if (lvl) mesh = subdivide(mesh.verts, mesh.faces);
  const s = stats(mesh, 24);
  rows.push({ lvl, mesh, s });
  console.log(`  ${lvl}   ${String(mesh.verts.length).padStart(6)}  ${String(mesh.faces.length).padStart(6)}   ${(100 * s.excess).toFixed(2).padStart(11)}%   ${s.spread.toFixed(1).padStart(11)} deg  ${s.median.toFixed(1).padStart(10)}   ${(100 * s.multiHit).toFixed(0).padStart(6)}%`);
}
console.log('\n-- 12/24/48 stability at each subdivision level (the Phase 1 failure mode) --');
console.log('level   12p vs 24p   48p vs 24p   WORST   (spec 6 limit 5%)');
for (const r of rows) {
  const base = stats(r.mesh, 24).zoneMed, M = mag(base);
  const a = (100 * rms(stats(r.mesh, 12).zoneMed, base)) / M;
  const b = (100 * rms(stats(r.mesh, 48).zoneMed, base)) / M;
  const w = Math.max(a, b);
  console.log(`  ${r.lvl}   ${a.toFixed(2).padStart(9)}%   ${b.toFixed(2).padStart(9)}%   ${w.toFixed(2)}%  ${w < 5 ? 'within' : 'EXCEEDS'}`);
}
const f = rows[0].s, l = rows[rows.length - 1].s;
console.log('\n-- THE FORK --');
const excessCollapsed = l.excess < 0.05;
const spreadSurvived = l.spread > 0.5 * f.spread;
console.log(`turningExcess ${(100 * f.excess).toFixed(1)}% -> ${(100 * l.excess).toFixed(1)}%   ${excessCollapsed ? 'COLLAPSED' : 'PERSISTS'}`);
console.log(`ribbon spread ${f.spread.toFixed(1)} -> ${l.spread.toFixed(1)} deg   ${spreadSurvived ? 'SURVIVES' : 'COLLAPSED'}`);
console.log(`\n>>> ${excessCollapsed && spreadSurvived ? 'FORK A: faceting was the numerical problem; directional signal is REAL.'
  : excessCollapsed && !spreadSurvived ? 'FORK B: apparent directional structure was largely sampling artefact.'
  : 'FORK C: excess persists -- deeper than faceting. Stop and understand before any remedy.'} <<<`);
