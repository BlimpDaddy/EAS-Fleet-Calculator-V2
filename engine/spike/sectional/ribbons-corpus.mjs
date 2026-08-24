/**
 * RIBBON PHASE 1 — CORPUS RUN (2026-08-20)
 *
 * Executes spec 8 step 4 after the four analytic controls passed clean at
 * tip 2.5% (run 2, commit 737caf4). Every definition is frozen; nothing
 * here chooses a parameter. Reporting follows spec 10: median across
 * ribbons, worst ribbon and WHICH, inter-ribbon spread — never the mean.
 *
 * NO Cd. NO calibration. NO classification. No production change.
 * Pass/fail is decided by spec 6, fixed in advance:
 *   - results shift < 5% across ribbon counts 12/24/48 and two mesh
 *     resolutions, AND
 *   - sphere-vs-C-class zone-turning profiles differ by > 3x that noise.
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../../src/obj.js';
import { latheProfile, BODIES as TN614 } from './tn614-bodies.mjs';
import { extractRibbons, ribbonMetrics, analyticBody, CONTROLS, ZONES } from './ribbons.mjs';

const TIP = 0.025;                    // frozen by run 2 under spec 4.7
const DEG = 180 / Math.PI;

/* ---- corpus geometry ---- */
const TR291 = [[0, 0], [1, 1.001], [2, 1.747], [3, 2.286], [4, 2.688], [5, 2.982], [6, 3.204],
  [7, 3.379], [8, 3.511], [10, 3.683], [12, 3.779], [14, 3.830], [16, 3.849], [16.6, 3.850],
  [18, 3.840], [20, 3.797], [22, 3.738], [24, 3.659], [26, 3.558], [28, 3.443], [30, 3.318],
  [32, 3.170], [34, 3.005], [36, 2.817], [38, 2.608], [40, 2.369], [41, 2.236], [42, 2.098],
  [43, 1.945], [44, 1.766], [45, 1.554], [46, 1.281], [47, 0.912], [48, 0]];
const AKRON = [[0, 0], [.02, 4.95], [.05, 9.96], [.10, 14.20], [.15, 16.65], [.20, 18.39],
  [.25, 19.12], [.30, 19.61], [.35, 19.85], [.40, 19.90], [.45, 19.90], [.50, 19.80],
  [.55, 19.59], [.60, 19.12], [.65, 18.46], [.70, 17.50], [.75, 16.15], [.80, 14.44],
  [.85, 12.29], [.90, 9.61], [.95, 6.52], [1, 0]];

const cclassPts = (lenIn) => TR291.map(([s, r]) => [(s / 48) * 100, (r / lenIn) * 100]);
const akronPts = AKRON.map(([u, r]) => [u * 100, (r / 235.44) * 100]);

/** Bodies. `mesh(res)` lets the same body be re-meshed for the stability test. */
const CORPUS = [
  { name: 'sphere', axis: 'X', up: 'Y', analytic: true, mesh: (r) => analyticBody(CONTROLS[0].rFn, 1, r) },
  { name: 'prolate f=3', axis: 'X', up: 'Y', analytic: true, mesh: (r) => analyticBody(CONTROLS[1].rFn, 3, r) },
  { name: 'C-class f=1.0', axis: 'X', up: 'Y', mesh: (r) => latheProfile(cclassPts(7.700), r.rings, r.segs) },
  { name: 'C-class f=3.0', axis: 'X', up: 'Y', mesh: (r) => latheProfile(cclassPts(23.100), r.rings, r.segs) },
  ...Object.entries(TN614).map(([k, b]) => ({ name: `TN614-${k}`, axis: 'X', up: 'Y', mesh: (r) => latheProfile(b.pts, r.rings, r.segs) })),
  { name: 'Akron', axis: 'X', up: 'Y', mesh: (r) => latheProfile(akronPts, r.rings, r.segs) },
  { name: 'Sunship BARE', axis: 'Z', up: 'Y', obj: '../3D OBJ/Sunship.obj' },
  { name: 'Sunship TAILED', axis: 'X', up: null, obj: 'lab/sunship-tail-aerohull-candidate.obj' },
];

const RES_A = { rings: 192, segs: 48, nx: 240, nt: 96 };
const RES_B = { rings: 288, segs: 72, nx: 360, nt: 144 };

function meshOf(b, res) {
  if (b.obj) { const m = parseObjMesh(readFileSync(b.obj, 'utf8')); return m; }
  return b.mesh(res);
}

/** Per-body ribbon statistics, spec 10 — distribution preserved. */
function measure(b, { planes, res }) {
  const m = meshOf(b, res);
  const F = extractRibbons(m.verts, m.faces, { axis: b.axis, up: b.up, planes });
  const per = F.ribbons.map((r) => ribbonMetrics(r, F.L, { tipFrac: TIP }));
  const nz = ZONES;
  const med = [], worst = [], spread = [], net = [];
  for (let z = 0; z < nz; z++) {
    const a = per.map((p) => p.zones[z].abs * DEG).sort((x, y) => x - y);
    const n = per.map((p) => p.zones[z].net * DEG);
    med.push(a[Math.floor(a.length / 2)]);
    worst.push(a[a.length - 1]);
    spread.push(a[a.length - 1] - a[0]);
    net.push(n.slice().sort((x, y) => x - y)[Math.floor(n.length / 2)]);
  }
  const tot = per.map((p) => p.absTurn * DEG).sort((x, y) => x - y);
  const worstIdx = per.reduce((bi, p, i, arr) => (p.absTurn > arr[bi].absTurn ? i : bi), 0);
  return {
    medZone: med, worstZone: worst, spreadZone: spread, netZone: net,
    medTotal: tot[Math.floor(tot.length / 2)], worstTotal: tot[tot.length - 1],
    worstRibbon: worstIdx, ribbonSpread: tot[tot.length - 1] - tot[0],
    turnCentroid: per.map((p) => p.turnCentroid).sort((a2, b2) => a2 - b2)[Math.floor(per.length / 2)],
    excess: Math.max(...per.map((p) => p.turningExcess)),
    report: F.report, frame: F.frame,
  };
}

const rms = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
const mag = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

/* ---------- 1. STABILITY ---------- */
console.log('== RIBBON PHASE 1 — CORPUS RUN ==');
console.log('tip 2.5% (frozen run 2) · 8 zones · secant 3% of L · reporting per spec 10\n');
console.log('-- STABILITY: zone-turning vector across ribbon count and mesh resolution --');
console.log('reference config = 24 planes, resolution A. Shift is RMS vs reference, as % of vector magnitude.\n');
console.log('body                 12p      48p      24p/resB   WORST SHIFT');
const REF = {}, shifts = [];
for (const b of CORPUS) {
  REF[b.name] = measure(b, { planes: 24, res: RES_A });
  const base = REF[b.name].medZone, M = mag(base);
  const variants = [
    measure(b, { planes: 12, res: RES_A }),
    measure(b, { planes: 48, res: RES_A }),
    measure(b, { planes: 24, res: RES_B }),
  ].map((v) => (100 * rms(v.medZone, base)) / M);
  const w = Math.max(...variants);
  shifts.push(w);
  console.log(`${b.name.padEnd(20)} ${variants.map((v) => (v.toFixed(2) + '%').padStart(8)).join(' ')}   ${w.toFixed(2)}%${w < 5 ? '' : '  <-- EXCEEDS 5%'}`);
}
const noise = Math.max(...shifts);
console.log(`\nworst stability shift across the whole corpus: ${noise.toFixed(2)}%  (spec 6 limit: 5%)`);

/* ---------- 2. THE KILL TEST ---------- */
const sph = REF['sphere'].medZone, cc = REF['C-class f=1.0'].medZone;
const sep = (100 * rms(sph, cc)) / mag(sph);
console.log('\n-- KILL TEST (spec 6): sphere vs C-class f=1.0, same fineness class, different profile family --');
console.log(`separation ${sep.toFixed(2)}%   vs   3x stability noise = ${(3 * noise).toFixed(2)}%`);
const pass = noise < 5 && sep > 3 * noise;
console.log(`\n>>> PHASE 1 ${pass ? 'PASSES' : 'FAILS'} <<<`);

/* ---------- 3. BODY BY BODY ---------- */
console.log('\n-- ZONE TURNING, median across ribbons, degrees. NET sign in brackets (+ = opening out, - = closing in) --');
console.log('body                  z1        z2        z3        z4        z5        z6        z7        z8      total  centroid');
for (const b of CORPUS) {
  const r = REF[b.name];
  const cells = r.medZone.map((v, i) => `${v.toFixed(1)}(${r.netZone[i] >= 0 ? '+' : '-'})`.padStart(9)).join(' ');
  console.log(`${b.name.padEnd(20)}${cells} ${r.medTotal.toFixed(1).padStart(7)} ${r.turnCentroid.toFixed(3).padStart(8)}`);
}
console.log('\n-- DISTRIBUTION ACROSS RIBBONS (spec 10: never the mean) --');
console.log('body                 median total  worst ribbon  spread   max turningExcess  multiHit  noHit  frame');
for (const b of CORPUS) {
  const r = REF[b.name];
  console.log(`${b.name.padEnd(20)} ${r.medTotal.toFixed(1).padStart(11)}  #${String(r.worstRibbon).padStart(2)} ${r.worstTotal.toFixed(1).padStart(7)}  ${r.ribbonSpread.toFixed(1).padStart(6)}  ${(100 * r.excess).toFixed(2).padStart(15)}%  ${(100 * r.report.multiHitFrac).toFixed(0).padStart(6)}%  ${(100 * r.report.noHitFrac).toFixed(1).padStart(5)}%  ${r.frame.orientationReference}`);
}
