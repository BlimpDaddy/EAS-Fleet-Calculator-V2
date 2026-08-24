/**
 * SUNSHIP CLOCKFACE — spec 74. WHICH directions carry the turning burden and
 * the directional disagreement, rather than collapsing them into a scalar.
 *
 * SHADOW ONLY. No Cd. Bare hull only — the tailed body is INELIGIBLE and gets
 * no interpretation.
 *
 * FRAME (4.1 / 4.2): flight +X, axis on the VOLUME centroid, theta = 0 is UP.
 * So theta 180 deg is the flat underside, theta 90/270 are the sides.
 */
import { readFileSync } from 'node:fs';
import { parseObjVertices } from '../../../site/calcv2/src/obj.js';
import { volumeCentroid, ribbonMetrics, ZONES } from './ribbons.mjs';
import { hullMesh } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, supportRadiiSelfTest, STATIONS, TIP } from './support-skin.mjs';

const DEG = 180 / Math.PI, PLANES = 24, EARNED = [1, 2, 3, 4, 5];
const rays = Array.from({ length: 2 * PLANES }, (_, k) => (Math.PI * (k % PLANES)) / PLANES + (k >= PLANES ? Math.PI : 0));

const st = supportRadiiSelfTest();
console.log('\nSUNSHIP BARE — CLOCKFACE BREAKDOWN (spec 74). SHADOW ONLY, no Cd.');
console.log(`  supportRadii self-test: ${st.ok ? 'PASS' : 'FAIL'}`);
if (!st.ok) process.exit(1);
console.log('  frame: flight +X, axis on the VOLUME centroid, theta = 0 is UP (4.2).');
console.log('  so theta 180 = flat underside, theta 90 / 270 = the sides.\n');

const v = parseObjVertices(readFileSync('C:/Users/Toby/Desktop/CodeEverything/3D OBJ/Sunship.obj', 'utf8'));
const h0 = hullMesh(v.map((p) => [p[2], p[1], -p[0]]));
const c = volumeCentroid(h0.verts, h0.faces).c;
const verts = h0.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
const skin = makeSupportSkin(verts, h0.faces, { sx: 0.005, thDeg: 2 });

const R = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
for (let i = 0; i < STATIONS; i++) {
  const got = supportRadii(skin, i, rays);
  for (let k = 0; k < rays.length; k++) R[k][i] = got.r[k];
}
const met = R.map((rib) => ribbonMetrics(rib, skin.L, { tipFrac: TIP }));
const zones = met.map((q) => Array.from({ length: ZONES }, (_, z) => q.zones[z].abs * DEG));
const desc = zones.map((all) => {
  const z = EARNED.map((zi) => all[zi]);
  const tot = z.reduce((s, x) => s + x, 0), mean = tot / z.length;
  const uc = EARNED.map((zi) => (zi + 0.5) / ZONES);
  return { tot, F1: (z[0] + z[1]) / tot, F2a: z[3] + z[4], F3: Math.max(...z) / mean,
    F4: z.reduce((s, x, k) => s + x * uc[k], 0) / tot };
});

const name = (d) => {
  const a = ((d % 360) + 360) % 360;
  if (a < 15 || a >= 345) return 'UP';
  if (a >= 165 && a < 195) return 'UNDERSIDE';
  if (a >= 75 && a < 105) return 'SIDE(+)';
  if (a >= 255 && a < 285) return 'SIDE(-)';
  // theta is measured FROM UP, so 90..270 is the LOWER half. An earlier
  // draft used `a < 180` and mislabelled 105-165 deg as upper.
  return (a < 90 || a > 270) ? 'upper-quarter' : 'lower-quarter';
};

console.log('  ribbon  theta   region          zones 1..5 (deg)                     F2a     F1     F3     F4');
const order = rays.map((th, k) => ({ k, d: th * DEG })).sort((a, b) => a.d - b.d);
for (const { k, d } of order) {
  console.log(`   ${String(k).padStart(3)}   ${d.toFixed(1).padStart(6)}  ${name(d).padEnd(14)} ` +
    EARNED.map((z) => zones[k][z].toFixed(1).padStart(6)).join('') +
    `   ${desc[k].F2a.toFixed(2).padStart(6)} ${desc[k].F1.toFixed(3)} ${desc[k].F3.toFixed(3)} ${desc[k].F4.toFixed(3)}`);
}

/* which directions carry the burden */
const byF2a = [...order].sort((a, b) => desc[b.k].F2a - desc[a.k].F2a);
console.log('\n  WHICH DIRECTIONS CARRY THE AFT TURNING BURDEN (F2a), highest first:');
for (const { k, d } of byF2a.slice(0, 6)) console.log(`    theta ${d.toFixed(1).padStart(6)} (${name(d)})  F2a ${desc[k].F2a.toFixed(2)}`);
console.log('    ...');
for (const { k, d } of byF2a.slice(-4)) console.log(`    theta ${d.toFixed(1).padStart(6)} (${name(d)})  F2a ${desc[k].F2a.toFixed(2)}`);

/* which opposite pairs disagree */
console.log('\n  WHICH OPPOSITE PAIRS DISAGREE (F5 per pair), highest first:');
const pairs = [];
for (let k = 0; k < PLANES; k++) {
  const gap = Math.max(...EARNED.map((z) => Math.abs(zones[k][z] - zones[k + PLANES][z])));
  const worstZone = EARNED.reduce((b, z) => (Math.abs(zones[k][z] - zones[k + PLANES][z]) > Math.abs(zones[k][b] - zones[k + PLANES][b]) ? z : b), EARNED[0]);
  pairs.push({ k, d: rays[k] * DEG, gap, worstZone });
}
pairs.sort((a, b) => b.gap - a.gap);
for (const p of pairs.slice(0, 8)) {
  console.log(`    ${p.d.toFixed(1).padStart(6)} vs ${(p.d + 180).toFixed(1).padStart(6)}  (${name(p.d)} vs ${name(p.d + 180)})  ` +
    `gap ${p.gap.toFixed(2)} deg  worst in zone ${p.worstZone}  ` +
    `[${zones[p.k][p.worstZone].toFixed(1)} vs ${zones[p.k + PLANES][p.worstZone].toFixed(1)}]`);
}
const quiet = pairs.slice(-3);
console.log('    most coherent pairs:');
for (const p of quiet) console.log(`    ${p.d.toFixed(1).padStart(6)} vs ${(p.d + 180).toFixed(1).padStart(6)}  gap ${p.gap.toFixed(2)} deg`);
console.log('');
