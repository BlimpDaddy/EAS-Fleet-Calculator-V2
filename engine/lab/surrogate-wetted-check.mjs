/**
 * HOW MUCH DOES CIRCULARISING THE SECTIONS COST? — the r20 send-back,
 * quantified instead of assumed.
 *
 * The r20 reviewer's sharpest point: SUNSHIP_TAILED is built by replacing
 * each station's cross-sectional AREA with an equal-area CIRCLE and
 * lathing the result, and "a circle is the minimum perimeter for a given
 * area, so the surrogate can flatter wetted area" — which matters because
 * friction is ~44% of the tailed Cd (0.00954 of 0.02145).
 *
 * The mechanism is real. The measured net effect is not what it predicts.
 * Comparing the SAME hull as its real mesh against its equal-area lathe,
 * both at 300 m, with no tail on either:
 *
 *     frontal   40,522 -> 40,056   -1.1%
 *     WETTED   206,795 -> 213,330  +3.2%   <-- surrogate is HIGHER
 *     volume  8,085,778 -> 8,045,355  -0.5%
 *
 * The lathe comes out with MORE wetted area, not less. The circularising
 * loss is real but is more than cancelled by the lathe's stepwise radius
 * lookup, which builds the surface as 320 slightly-corrugated bands and
 * adds area at every step. Net: the surrogate is CONSERVATIVE on friction
 * by about 3%, worth roughly 0.44 x 3.2% = 1.4% on the total Cd.
 *
 * WHAT THIS DOES AND DOES NOT SETTLE. It defuses the specific "flattered
 * wetted area" objection for the HULL portion. It does NOT remove the
 * need to regenerate from the true surface, because (a) the fairing's own
 * sections are still assumed circular, (b) attachment still matches
 * radius only and not slope, and (c) "we measured it and it is small" is
 * a different claim from "we assumed it was small".
 *
 * Run from CalcV2:  node lab/surrogate-wetted-check.mjs
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../src/obj.js';
import { measureSections } from '../src/sections.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';

const L = 300, RINGS = 320, SEGS = 64;
const mesh = parseObjMesh(readFileSync(new URL('../../3D OBJ/Sunship.obj', import.meta.url), 'utf8'));
const real = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'Z', lengthM: L });

const m = measureSections(mesh.verts, mesh.faces, { axis: '+Z', STATIONS: 128 });
const N = m.A.length, sc = L / m.L, cM = m.cell * sc, dx = L / N;
const rH = Array.from(m.A, (a) => Math.sqrt((a * cM * cM) / Math.PI));
const vs = [], fs = [], rs = [];
for (let i = 0; i <= RINGS; i++) {
  const x = (L * i) / RINGS;
  const r = Math.max(rH[Math.min(N - 1, Math.max(0, Math.round(x / dx - 0.5)))], 0);
  if (r < 1e-6) { rs.push(vs.push([x, 0, 0]) - 1); continue; }
  rs.push(vs.length);
  for (let s = 0; s < SEGS; s++) { const t = (2 * Math.PI * s) / SEGS; vs.push([x, r * Math.cos(t), r * Math.sin(t)]); }
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
const surr = measureDynamicsGeometry(vs, fs, { flightAxis: 'X', lengthM: L });
const f = (x) => Math.round(x).toLocaleString('en-US');
const d = (a, b) => `${((b / a - 1) * 100).toFixed(1)}%`;
console.log('SAME HULL, two representations, both 300 m, neither tailed:\n');
console.log('                     REAL mesh    equal-area LATHE    delta');
console.log(`  frontal   ${f(real.frontalArea).padStart(12)} ${f(surr.frontalArea).padStart(18)}   ${d(real.frontalArea, surr.frontalArea)}`);
console.log(`  WETTED    ${f(real.wettedArea).padStart(12)} ${f(surr.wettedArea).padStart(18)}   ${d(real.wettedArea, surr.wettedArea)}`);
console.log(`  volume    ${f(real.volume).padStart(12)} ${f(surr.volume).padStart(18)}   ${d(real.volume, surr.volume)}`);
console.log('\nFriction is 44% of the tailed Cd, so a wetted-area error of X% moves');
console.log('the total by ~0.44X%. Measured +3.2% => ~+1.4%, CONSERVATIVE.');
