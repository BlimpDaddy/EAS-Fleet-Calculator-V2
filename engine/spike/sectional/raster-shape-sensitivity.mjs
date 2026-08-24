/**
 * WHY THE SCALAR IS NOT SECTION-SHAPE-INVARIANT. Spec 87.4.
 *
 * 87.2's prediction P1 said: the production scalar is a functional of A(x)
 * alone, so holding A(x) fixed and varying only the section SHAPE must leave
 * `compositeV1` unchanged. **P1 FAILED** — the proxy spread was 15.5% of the
 * control across shapes whose true section area is identical by construction.
 *
 * The mathematics of P1 is not wrong: `measureSections` rasterises AREA per
 * station, and `scoreSections` / `classifySections` / `shoulderAngleScore` all
 * consume only `{A, L, cell}`. Nothing downstream knows the section's shape.
 *
 * What failed is the step before it. **A(x) as MEASURED is not A(x) as BUILT.**
 * This file measures that directly: the rastered section area against the
 * analytic area, station by station, for a circle and for a 5:1 ellipse that
 * share the same r(x) and therefore the same true area everywhere.
 *
 * Diagnostic only. Nothing is altered.
 */
import { measureSections } from '../../../site/calcv2/src/sections.js';
import { s58Poly, s58Radius } from './sweep-generic.mjs';

const RINGS = 240, NAZ = 128;
const PARENT = { m: 0.40, r0: 0.50, r1: 0.10, Cp: 0.65, LD: 7 };
const a = s58Poly(PARENT.m, PARENT.r0, PARENT.r1, PARENT.Cp);
const prof = s58Radius(a, PARENT.LD);

const circle = () => (r) => () => r;
const ellipse = (k) => (r) => {
  const A = r * Math.sqrt(k), B = r / Math.sqrt(k);        // area pi*A*B = pi*r^2
  return (th) => (A * B) / Math.hypot(B * Math.cos(th), A * Math.sin(th));
};

function build(sectionOf) {
  const verts = [], faces = [], ringStart = [];
  for (let i = 0; i <= RINGS; i++) {
    const x = -prof.half + (2 * prof.half * i) / RINGS;
    const r = Math.max(prof.r(x), 0);
    if (r < 1e-9) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
    const sec = sectionOf(r);
    ringStart.push(verts.length);
    for (let j = 0; j < NAZ; j++) {
      const th = (2 * Math.PI * j) / NAZ, rr = sec(th);
      verts.push([x, rr * Math.cos(th), rr * Math.sin(th)]);
    }
  }
  const size = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
  for (let i = 0; i < RINGS; i++) {
    const A = ringStart[i], B = ringStart[i + 1];
    const aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let j = 0; j < NAZ; j++) {
      const j1 = (j + 1) % NAZ;
      if (aP) faces.push([A, B + j, B + j1]);
      else if (bP) faces.push([A + j, B, A + j1]);
      else { faces.push([A + j, B + j, B + j1]); faces.push([A + j, B + j1, A + j1]); }
    }
  }
  return { verts, faces };
}

console.log('\nRASTER SHAPE-SENSITIVITY (spec 87.4) — why P1 failed');
console.log('  Circle and 5:1 ellipse share r(x), so their TRUE section area is identical');
console.log('  at every station. Only the rastered measurement can differ.\n');

const mc = build(circle()), me = build(ellipse(5));
const rc = measureSections(mc.verts, mc.faces, { axis: '+X' });
const re = measureSections(me.verts, me.faces, { axis: '+X' });
const N = rc.A.length;

console.log('  x/L     r(x)       circle err%    ellipse k=5 err%');
let worstC = 0, worstE = 0;
for (let i = 0; i < N; i++) {
  const x = -prof.half + 2 * prof.half * ((i + 0.5) / N);
  const rTrue = prof.r(x);
  if (rTrue < 1e-6) continue;
  const aTrue = Math.PI * rTrue * rTrue;
  const ec = (rc.A[i] * rc.cell * rc.cell - aTrue) / aTrue;
  const ee = (re.A[i] * re.cell * re.cell - aTrue) / aTrue;
  worstC = Math.max(worstC, Math.abs(ec));
  worstE = Math.max(worstE, Math.abs(ee));
  if ([0.30, 0.50, 0.70, 0.80, 0.85, 0.90, 0.94, 0.97].some((f) => Math.abs((i + 0.5) / N - f) < 0.5 / N)) {
    console.log(`  ${((i + 0.5) / N).toFixed(2)}   ${rTrue.toFixed(5)}    ${(100 * ec).toFixed(2).padStart(8)}%    ${(100 * ee).toFixed(2).padStart(10)}%`);
  }
}
console.log(`\n  worst |error| over the whole body:  circle ${(100 * worstC).toFixed(2)}%   ellipse k=5 ${(100 * worstE).toFixed(2)}%`);
console.log('\n  THE MECHANISM: a flattened section is resolved by fewer cells across its');
console.log('  thin axis, and the deficit GROWS through the aft closure as the section');
console.log('  shrinks. That is precisely the region the aft-penalty descriptor reads.');
console.log('  Through the mid-aft closure the ellipse runs 0.8-1.9% low against the circles');
console.log('  <=0.11%; the worst errors, near the tips where sections are tiny, are 5.28%');
console.log('  for the circle and 15.57% for the ellipse. softAft is a THRESHOLD functional');
console.log('  of the equivalent-radius profile, so an error concentrated there does not');
console.log('  average out -- it emerges as the 15.5% spread in compositeV1 that P1 predicted');
console.log('  could not happen.');
console.log('');
console.log('  Recorded, not repaired. The scorer is frozen.\n');
