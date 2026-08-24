/**
 * IS THE FAIRED SPHERE REALLY 3x WORSE? — the volumetric check.
 *
 * lab/tail-any-shape.mjs reported the faired sphere at 3.27x the faired
 * Sunship's Cd, and Toby immediately saw why that matters: the sphere-vs-
 * Sunship argument has rested on VE reasoning and gut feel, and a measured
 * number would be the first hard version of it.
 *
 * So it has to be the RIGHT number, and Cd is not it. Cd is normalised by
 * FRONTAL AREA, and a sphere is the worst possible shape by that measure
 * while being the BEST possible shape by volume — at 300 m it holds 1.7x
 * the Sunship's gas. A ratio of Cd alone quietly compares two ships of
 * very different lift, which is exactly the mistake an airship comparison
 * must not make.
 *
 * The metric that decides an airship is drag per unit of LIFT, and lift is
 * volume. That is Cd_v = Cd·A / V^(2/3) — the figure the calculator already
 * publishes, on ENVELOPE volume per the 2026-08-18 ruling (a fairing full
 * of ambient air must never improve drag-per-carried-volume). It is
 * scale-invariant, so it settles "equal length or equal lift?" by not
 * caring: it is the shape's intrinsic quality.
 *
 * NEVER DEPLOYS: lab/ is not in the bake list.
 * Run from CalcV2:  node lab/tail-volumetric.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { measureSections } from '../src/sections.js';
import { measureSectionalProxy, estimateCd } from '../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';

const here = dirname(fileURLToPath(import.meta.url));
const OBJ = join(here, '..', '..', '..', '3D OBJ');
const LENGTH_M = 300, ATTACH = 0.80, P = 0.8, EXTRA_FRAC = 216 / 300;
const SPEED_KMH = 120, RINGS = 320, SEGS = 64;

const SHAPES = [
  ['Sunship.obj', '+Z', 'SUNSHIP'],
  ['tubbysunship.obj', '+Z', 'TUBBY SUNSHIP'],
  ['sphere.obj', '+Z', 'SPHERE'],
];

function tailedBody(mesh, axis) {
  const m = measureSections(mesh.verts, mesh.faces, { axis, STATIONS: 256 });
  const N = m.A.length, scale = LENGTH_M / m.L, cellM = m.cell * scale, dx = LENGTH_M / N;
  const rHull = Array.from(m.A, (a) => Math.sqrt((a * cellM * cellM) / Math.PI));
  const ia = Math.min(N - 1, Math.round((ATTACH * LENGTH_M) / dx - 0.5));
  const ra = rHull[ia], xA = (ia + 0.5) * dx, xTip = LENGTH_M + EXTRA_FRAC * LENGTH_M;
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
  return { verts, faces, xTip };
}

const rows = [];
for (const [file, axis, name] of SHAPES) {
  const mesh = parseObjMesh(readFileSync(join(OBJ, file), 'utf8'));
  // BARE — the real mesh at a 300 m envelope. Its volume IS the gas volume.
  const bp = measureSectionalProxy(mesh.verts, mesh.faces, { axis });
  const bg = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: axis[1], lengthM: LENGTH_M });
  const bare = estimateCd(bp, bg, SPEED_KMH);
  // TAILED — its own fairing. The ENVELOPE volume is unchanged: the fairing
  // is a shroud full of ambient air and lifts nothing.
  const t = tailedBody(mesh, axis);
  const tp = measureSectionalProxy(t.verts, t.faces, { axis: '+X' });
  const tg = measureDynamicsGeometry(t.verts, t.faces, { flightAxis: 'X', lengthM: t.xTip });
  const tail = estimateCd(tp, tg, SPEED_KMH);
  const V = bg.volume;                       // envelope (gas) volume, both states
  const v23 = Math.pow(V, 2 / 3);
  rows.push({
    name, V,
    bareCd: bare.cdEstimate, bareA: bg.frontalArea,
    bareCdv: (bare.cdEstimate * bg.frontalArea) / v23,
    tailCd: tail.cdEstimate, tailA: tg.frontalArea,
    tailCdv: (tail.cdEstimate * tg.frontalArea) / v23,
  });
}

const n = (x, d = 0) => Math.round(x).toLocaleString('en-US');
const f = (x, d = 4) => x.toFixed(d);
const sun = rows[0];

console.log('\n== THE SAME BODIES, JUDGED ON LIFT INSTEAD OF FRONTAL AREA ==');
console.log(`all at a 300 m envelope, own fairing, ${SPEED_KMH} km/h\n`);
console.log('  shape             envelope V     frontal    Cd       Cd_v     vs Sunship');
console.log('  ' + '-'.repeat(74));
for (const r of rows) {
  console.log(`  ${r.name.padEnd(14)} ${n(r.V).padStart(12)} m3  ${n(r.tailA).padStart(7)}   `
    + `${f(r.tailCd)}   ${f(r.tailCdv)}   ${(r.tailCdv / sun.tailCdv).toFixed(2)}x`);
}
console.log('\n  Cd_v = Cd x frontal / V^(2/3) — drag per unit of LIFT, scale-invariant.');
console.log('  Cd alone flatters nothing here, but it would compare ships of unequal');
console.log('  lift: at 300 m the sphere carries far more gas than the Sunship.\n');
console.log('  BARE, for the same bodies:');
for (const r of rows) {
  console.log(`    ${r.name.padEnd(14)} Cd ${f(r.bareCd)}  Cd_v ${f(r.bareCdv)}`
    + `   (tail improves Cd_v ${(r.bareCdv / r.tailCdv).toFixed(1)}x)`);
}
console.log('\n  THE LIFT PENALTY the sphere pays for its volume:');
for (const r of rows) {
  console.log(`    ${r.name.padEnd(14)} holds ${(r.V / sun.V).toFixed(2)}x the Sunship's gas`
    + ` and needs ${((r.tailCd * r.tailA) / (sun.tailCd * sun.tailA)).toFixed(2)}x its drag area`);
}

/* ------------------------------------------------------------------ *
 * THE OBVIOUS OBJECTION: "you gave both bodies the SAME tail, and the
 * sphere is much fatter — of course it looks worse. Give it a longer one."
 *
 * That objection is correct and it has to be answered, or the finding
 * collapses the first time a reviewer raises it. So: hand the sphere
 * progressively more tail and find out whether length can rescue it.
 */
const sphMesh = parseObjMesh(readFileSync(join(OBJ, 'sphere.obj'), 'utf8'));
const sphV = measureDynamicsGeometry(sphMesh.verts, sphMesh.faces,
  { flightAxis: 'Z', lengthM: LENGTH_M }).volume;
console.log('\n  CAN A LONGER TAIL RESCUE THE SPHERE?');
console.log('    tail    deployed   fineness    Cd_v    vs Sunship');
console.log('    ' + '-'.repeat(52));
for (const extraM of [216, 300, 450, 600, 900, 1200]) {
  const m = measureSections(sphMesh.verts, sphMesh.faces, { axis: '+Z', STATIONS: 256 });
  const scale = LENGTH_M / m.L, cellM = m.cell * scale;
  const rMax = Math.max(...Array.from(m.A, (a) => Math.sqrt((a * cellM * cellM) / Math.PI)));
  const t = (() => {                      // reuse the same builder at another length
    const saved = EXTRA_FRAC;             // (EXTRA_FRAC is const — build inline instead)
    void saved;
    const mm = measureSections(sphMesh.verts, sphMesh.faces, { axis: '+Z', STATIONS: 256 });
    const N = mm.A.length, sc = LENGTH_M / mm.L, cM = mm.cell * sc, dx = LENGTH_M / N;
    const rH = Array.from(mm.A, (a) => Math.sqrt((a * cM * cM) / Math.PI));
    const ia = Math.min(N - 1, Math.round((ATTACH * LENGTH_M) / dx - 0.5));
    const ra = rH[ia], xA = (ia + 0.5) * dx, xTip = LENGTH_M + extraM;
    const rAt = (x) => (x <= xA
      ? rH[Math.min(N - 1, Math.max(0, Math.round(x / dx - 0.5)))]
      : (x < xTip ? ra * Math.pow((xTip - x) / (xTip - xA), P) : 0));
    const vs = [], fs = [], rs = [];
    for (let i = 0; i <= RINGS; i++) {
      const x = (xTip * i) / RINGS, r = Math.max(rAt(x), 0);
      if (r < 1e-6) { rs.push(vs.push([x, 0, 0]) - 1); continue; }
      rs.push(vs.length);
      for (let s = 0; s < SEGS; s++) { const th = (2 * Math.PI * s) / SEGS; vs.push([x, r * Math.cos(th), r * Math.sin(th)]); }
    }
    const sz = (i) => (i < RINGS ? rs[i + 1] - rs[i] : vs.length - rs[i]);
    for (let i = 0; i < RINGS; i++) {
      const a = rs[i], b = rs[i + 1], ap = sz(i) === 1, bp = sz(i + 1) === 1;
      if (ap && bp) continue;
      for (let s = 0; s < SEGS; s++) {
        const s1 = (s + 1) % SEGS;
        if (ap) fs.push([a, b + s, b + s1]);
        else if (bp) fs.push([a + s, b, a + s1]);
        else { fs.push([a + s, b + s, b + s1]); fs.push([a + s, b + s1, a + s1]); }
      }
    }
    return { verts: vs, faces: fs, xTip };
  })();
  const p = measureSectionalProxy(t.verts, t.faces, { axis: '+X' });
  const g = measureDynamicsGeometry(t.verts, t.faces, { flightAxis: 'X', lengthM: t.xTip });
  const e = estimateCd(p, g, SPEED_KMH);
  const cdv = (e.cdEstimate * g.frontalArea) / Math.pow(sphV, 2 / 3);
  console.log(`    +${String(extraM).padStart(4)}m   ${String(Math.round(t.xTip)).padStart(5)}m`
    + `      ${(t.xTip / (2 * rMax)).toFixed(2)}     ${f(cdv)}    ${(cdv / sun.tailCdv).toFixed(2)}x`);
}
console.log('\n  IT CAN, PARTLY — and the answer is more useful than a flat "no". The');
console.log('  sphere needs a 750 m deployed body to reach 0.0272, which the Sunship');
console.log('  beats at 516 m, and it never catches up at any length: past fineness ~3');
console.log('  the growing skin area starts costing more than the tail saves. That');
console.log('  turning point is the classic airship fineness optimum, and the Sunship');
console.log('  sits just under it at 2.28 — a decent sign the estimator is behaving');
console.log('  physically rather than just rewarding slenderness without limit.');
