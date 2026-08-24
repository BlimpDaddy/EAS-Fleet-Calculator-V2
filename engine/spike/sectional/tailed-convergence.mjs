/**
 * TAILED SUNSHIP — ONE BOUNDED CONVERGENCE DIAGNOSTIC. Spec 73.
 *
 * THE VERDICT DOES NOT MOVE: INELIGIBLE at 5.29% against the frozen spec 6
 * limit of 5%. No tolerance is relaxed, no smoothing added, no geometry
 * changed. This only asks WHERE the 5.29% comes from and whether it is
 * contracting.
 *
 * 96 ribbons is run as a NON-GATING observation. Spec 5 already allows 96 on
 * analytic controls to establish the numerical asymptote; it is not part of
 * the 12/24/48 criterion and does not enter any verdict.
 */
import { readFileSync } from 'node:fs';
import { parseObjVertices } from '../../../site/calcv2/src/obj.js';
import { volumeCentroid, ribbonMetrics, ZONES } from './ribbons.mjs';
import { hullMesh } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, supportRadiiSelfTest, STATIONS, TIP } from './support-skin.mjs';

const DEG = 180 / Math.PI;
const COUNTS = [12, 24, 48, 96];
const raysOf = (p) => Array.from({ length: 2 * p }, (_, k) => (Math.PI * (k % p)) / p + (k >= p ? Math.PI : 0));
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const st = supportRadiiSelfTest();
console.log('\nTAILED SUNSHIP — bounded convergence diagnostic (spec 73)');
console.log(`  supportRadii self-test: ${st.ok ? 'PASS' : 'FAIL'} (face ${st.face}, diag ${st.diag.toFixed(6)})`);
if (!st.ok) process.exit(1);
console.log('  VERDICT UNCHANGED: INELIGIBLE at 5.29% vs the frozen 5%. Nothing here relaxes it.');
console.log('  96 ribbons is NON-GATING (spec 5 asymptote observation only).\n');

const v = parseObjVertices(readFileSync('C:/Users/Toby/Desktop/CodeEverything/CalcV2/lab/sunship-tail-aerohull-candidate.obj', 'utf8'));
const h0 = hullMesh(v.map((p) => [p[2], p[1], -p[0]]));
const c = volumeCentroid(h0.verts, h0.faces).c;
const verts = h0.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
const skin = makeSupportSkin(verts, h0.faces, { sx: 0.005, thDeg: 2 });
const L = skin.L;

const profile = {};
for (const p of COUNTS) {
  const rays = raysOf(p);
  const R = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
  for (let i = 0; i < STATIONS; i++) {
    const got = supportRadii(skin, i, rays);
    for (let k = 0; k < rays.length; k++) R[k][i] = got.r[k];
  }
  const met = R.map((rib) => ribbonMetrics(rib, L, { tipFrac: TIP }));
  profile[p] = Array.from({ length: ZONES }, (_, z) => med(met.map((q) => q.zones[z].abs * DEG)));
}

console.log('  median zone turning (deg) by ribbon count:');
console.log('  zone      12        24        48        96');
for (let z = 0; z < ZONES; z++) {
  console.log(`   ${z}    ` + COUNTS.map((p) => profile[p][z].toFixed(4).padStart(9)).join(' '));
}

const rel = (a, b) => { const m = Math.max(Math.abs(a), Math.abs(b)); return m < 1e-9 ? 0 : Math.abs(a - b) / m; };
console.log('\n  RELATIVE SHIFT PER TRANSITION, per zone (the criterion is the worst of 12->24 and 24->48):');
console.log('  zone    12->24     24->48   |   48->96 (non-gating)');
let worst = 0, worstAt = '';
for (let z = 0; z < ZONES; z++) {
  const a = rel(profile[12][z], profile[24][z]), b = rel(profile[24][z], profile[48][z]), d = rel(profile[48][z], profile[96][z]);
  if (a > worst) { worst = a; worstAt = `zone ${z}, 12->24`; }
  if (b > worst) { worst = b; worstAt = `zone ${z}, 24->48`; }
  const flag = Math.max(a, b) >= 0.05 ? '  <== drives the miss' : '';
  console.log(`   ${z}    ${(100 * a).toFixed(3).padStart(7)}%  ${(100 * b).toFixed(3).padStart(7)}%   |  ${(100 * d).toFixed(3).padStart(7)}%${flag}`);
}
console.log(`\n  worst gating shift: ${(100 * worst).toFixed(3)}%  at ${worstAt}`);

/* is it contracting? compare each zone's successive shifts */
console.log('\n  CONTRACTION CHECK — does each transition shrink?');
let contracting = 0, expanding = 0;
for (let z = 0; z < ZONES; z++) {
  const a = rel(profile[12][z], profile[24][z]), b = rel(profile[24][z], profile[48][z]), d = rel(profile[48][z], profile[96][z]);
  const ok = b <= a && d <= b;
  if (ok) contracting++; else expanding++;
  console.log(`   zone ${z}: ${(100 * a).toFixed(3)}% -> ${(100 * b).toFixed(3)}% -> ${(100 * d).toFixed(3)}%   ${ok ? 'contracting' : 'NOT monotone'}`);
}
console.log(`\n  zones contracting monotonically: ${contracting}/${ZONES}`);
const w48 = Math.max(...Array.from({ length: ZONES }, (_, z) => rel(profile[24][z], profile[48][z])));
const w96 = Math.max(...Array.from({ length: ZONES }, (_, z) => rel(profile[48][z], profile[96][z])));
console.log(`  worst 24->48 ${(100 * w48).toFixed(3)}%   worst 48->96 ${(100 * w96).toFixed(3)}%  -> ` +
  (w96 < w48 ? 'SLOW CONVERGENCE (48->96 contracts)' : 'NOT contracting at 96 — genuinely unstable'));
console.log('\n  Verdict stands: INELIGIBLE. No tolerance changed.\n');
