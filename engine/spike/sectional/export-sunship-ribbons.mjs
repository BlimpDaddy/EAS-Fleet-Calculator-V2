/**
 * Machine-readable export of the eligible bare-Sunship ribbon fingerprint.
 * SHADOW ONLY — geometry context, never a Cd modifier.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseObjVertices } from '../../../site/calcv2/src/obj.js';
import { volumeCentroid, ribbonMetrics, ZONES } from './ribbons.mjs';
import { hullMesh } from './hull-bodies.mjs';
import { makeSupportSkin, supportRadii, supportRadiiSelfTest, STATIONS, TIP } from './support-skin.mjs';
import { measureSections, scoreSections } from '../../../site/calcv2/src/sections.js';
import { classifySections } from '../../../site/calcv2/src/cdEstimator.js';

const DEG = 180 / Math.PI, PLANES = 24, EARNED = [1, 2, 3, 4, 5];
const rays = Array.from({ length: 2 * PLANES }, (_, k) => (Math.PI * (k % PLANES)) / PLANES + (k >= PLANES ? Math.PI : 0));
if (!supportRadiiSelfTest().ok) throw new Error('supportRadii self-test FAILED');

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
const zones = met.map((q) => Array.from({ length: ZONES }, (_, z) => +(q.zones[z].abs * DEG).toFixed(4)));
const uc = EARNED.map((z) => (z + 0.5) / ZONES);
const ribbons = rays.map((th, k) => {
  const z = EARNED.map((zi) => zones[k][zi]);
  const tot = z.reduce((s, x) => s + x, 0), mean = tot / z.length;
  const opp = (k + PLANES) % (2 * PLANES);
  return {
    index: k, thetaDeg: +(th * DEG).toFixed(3),
    zones: zones[k], earnedZones: z,
    F1: +((z[0] + z[1]) / tot).toFixed(5), F2a: +(z[3] + z[4]).toFixed(4),
    F2f: +((z[3] + z[4]) / tot).toFixed(5), F3: +(Math.max(...z) / mean).toFixed(5),
    F4: +(z.reduce((s, x, i) => s + x * uc[i], 0) / tot).toFixed(5),
    oppositeIndex: opp,
    oppositeGap: +Math.max(...EARNED.map((zi) => Math.abs(zones[k][zi] - zones[opp][zi]))).toFixed(4),
  };
});

const ms = measureSections(verts, h0.faces, { axis: '+X' });
const sc = scoreSections(ms);
const { cls } = classifySections(ms, sc);
const out = {
  schema: 'ribbon-context/1',
  authority: 'SHADOW — informational only; does not affect Cd',
  body: 'Sunship bare hull (3D OBJ/Sunship.obj)',
  generated: '2026-08-21',
  frame: { flight: '+X', axisOn: 'volume centroid (spec 4.1)', thetaZero: 'UP (spec 4.2)', note: 'theta 180 = flat underside' },
  skin: { kind: 'support-function', sx: 0.005, thetaSigmaDeg: 2, stations: STATIONS, naz: skin.naz, tipFrac: TIP },
  domain: { zonesTotal: ZONES, earnedZones: EARNED, note: 'zones 0,6,7 positional only (spec 55.2)' },
  eligibility: 'ELIGIBLE',
  scalar: { compositeV1: sc.compositeV1, softAft: sc.softAft, softFore: sc.softFore, cls },
  ribbons,
};
writeFileSync('sunship-ribbons.json', JSON.stringify(out, null, 1));
const f2 = ribbons.map((r) => r.F2a);
console.log('written sunship-ribbons.json');
console.log('  ribbons:', ribbons.length, ' F2a range', Math.min(...f2).toFixed(2), '..', Math.max(...f2).toFixed(2));
console.log('  worst opposite gap', Math.max(...ribbons.map((r) => r.oppositeGap)).toFixed(2));
