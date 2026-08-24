/**
 * DIAGNOSTIC ONLY — NOT A GATE, NOT A K SELECTION, NOT A CRITERION.
 *
 * Spec 28 scopes Phase 1E as CIRCUMFERENTIAL ONLY with zero longitudinal
 * smoothing. Spec 28 test 1 nonetheless asks reconstruction to "drive false
 * turning to ~0" on a smooth control built with `sineJitter`, which displaces
 * vertices BOTH azimuthally and AXIALLY.
 *
 * Measured in the K-selection run: at nt = 30 the raw chained polygon already
 * carries 128.1 deg of false turning before any reconstruction exists, and the
 * section polygon's own vertices sit up to 1.62% off the analytic surface --
 * 3x the 0.55% pure chord sagitta. Reconstruction interpolates THROUGH those
 * vertices, so a circumferential fit cannot recover the surface no matter what
 * basis or K it uses.
 *
 * This script separates the two corruption axes so the reviewer can rule on
 * whether test 1's smooth control is inside the method's declared scope. It
 * deliberately selects nothing and decides nothing.
 */
import { analyticBody, ribbonMetrics } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { chainContour } from './ribbons-contour.mjs';
import { reconstructContourCartesian } from './ribbons-reconstruct.mjs';
import { sectionSegments, stationGrid, RAYS } from './ribbons-section.mjs';

const DEG = 180 / Math.PI;
const A = 3, NX = 240, STATIONS = 128, TIP = 0.025, J = 0.4;
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
const hash = (i, j, k) => { const v = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1; };

/**
 * AZIMUTHAL-ONLY jitter. Same hash, same strength, same degeneracy boundary
 * analysis as spec 31 (0.5 closes the gap exactly; 0.4 is inside the valid
 * regime). Rings stay planar, so every section vertex lies EXACTLY on the
 * analytic surface and the only corruption left is the circumferential
 * chord/phase artefact Phase 1E is scoped to attack.
 */
function azimuthalOnly(rFn, H, nx, nt, s) {
  const verts = [], faces = [], ring = [];
  for (let i = 0; i <= nx; i++) {
    const x = -H + (2 * H * i) / nx;
    if (Math.max(0, rFn(x, 0)) < 1e-9) { ring.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let j = 0; j < nt; j++) {
      const th = (2 * Math.PI * j) / nt + s * (2 * Math.PI / nt) * hash(i, j, 2);
      const r = Math.max(0, rFn(x, th));
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
    ring.push(first);
  }
  const size = (i) => (i < nx ? ring[i + 1] - ring[i] : verts.length - ring[i]);
  for (let i = 0; i < nx; i++) {
    const a = ring[i], b = ring[i + 1], ap = size(i) === 1, bp = size(i + 1) === 1;
    if (ap && bp) continue;
    for (let j = 0; j < nt; j++) {
      const j1 = (j + 1) % nt;
      if (ap) faces.push([a, b + j, b + j1]);
      else if (bp) faces.push([b, a + j1, a + j]);
      else faces.push([a + j, b + j, b + j1], [a + j, b + j1, a + j1]);
    }
  }
  return { verts, faces };
}

function rawIntersect(loop, rays) {
  const n = loop.length;
  return rays.map((th) => {
    const ct = Math.cos(th), st = Math.sin(th);
    let best = 0;
    for (let i = 0; i < n; i++) {
      const p = loop[i], q = loop[(i + 1) % n];
      const g1 = p[0] * st - p[1] * ct, g2 = q[0] * st - q[1] * ct;
      if (g1 === g2 || (g1 < 0 && g2 < 0) || (g1 > 0 && g2 > 0)) continue;
      const t = g1 / (g1 - g2);
      const X = p[0] + t * (q[0] - p[0]), Y = p[1] + t * (q[1] - p[1]);
      const proj = X * ct + Y * st;
      if (proj > best) best = proj;
    }
    return best;
  });
}

const xs = stationGrid(A, STATIONS);
function falseTurn(mesh, mode, K) {
  const R = Array.from({ length: RAYS.length }, () => new Array(STATIONS).fill(NaN));
  let offMax = 0;
  for (let i = 0; i < STATIONS; i++) {
    const { segs } = sectionSegments(mesh.verts, mesh.faces, xs[i]);
    if (segs.length < 3) continue;
    const c = chainContour(segs); if (!c.ok) continue;
    const want = rc(xs[i]);
    for (const v of c.loop) offMax = Math.max(offMax, Math.abs(Math.hypot(v[0], v[1]) - want));
    const r = mode === 'raw' ? rawIntersect(c.loop, RAYS) : reconstructContourCartesian(c.loop, RAYS, K).r;
    for (let k = 0; k < RAYS.length; k++) R[k][i] = r[k];
  }
  for (const rib of R) {
    let prev = -1;
    for (let i = 0; i < STATIONS; i++) {
      if (Number.isNaN(rib[i])) continue;
      if (prev < 0) { for (let j = 0; j < i; j++) rib[j] = 0; }
      else if (i - prev > 1) for (let j = prev + 1; j < i; j++) rib[j] = rib[prev] + ((rib[i] - rib[prev]) * (j - prev)) / (i - prev);
      prev = i;
    }
    if (prev < 0) rib.fill(0); else for (let j = prev + 1; j < STATIONS; j++) rib[j] = 0;
  }
  const ft = R.map((rib) => { const m = ribbonMetrics(rib, 2 * A, { tipFrac: TIP });
    return (m.absTurn - Math.abs(m.netTurn)) * DEG; });
  const s = [...ft].sort((a, b) => a - b);
  return { max: Math.max(...ft), med: s[Math.floor(ft.length / 2)], offMax };
}

console.log('\nSMOOTH-CONTROL SCOPE DIAGNOSTIC — decides nothing, selects nothing.');
console.log('False turning in deg (frozen tolerances: max <= 0.5, median <= 0.1)\n');
console.log('  sampling regime          nt    vertices off    RAW (no recon)      CARTESIAN K=3');
console.log('                                 surface, max    max      median     max      median');
for (const [label, gen] of [['clean lathe', null], ['azimuthal jitter 0.4', azimuthalOnly], ['sineJitter 0.4 (axial+azim)', GENERATORS.sineJitter]]) {
  for (const nt of [30, 118]) {
    const mesh = gen ? gen(rc, A, NX, nt, J) : analyticBody(rc, A, { nx: NX, nt });
    const r = falseTurn(mesh, 'raw', 3), c = falseTurn(mesh, 'cart', 3);
    console.log(`  ${label.padEnd(26)} ${String(nt).padEnd(5)} ${(100 * r.offMax).toFixed(4).padStart(8)}%    ` +
      `${r.max.toFixed(3).padStart(7)} ${r.med.toFixed(3).padStart(8)}   ${c.max.toFixed(3).padStart(7)} ${c.med.toFixed(3).padStart(8)}`);
  }
}
console.log('\n  Pure chord sagitta if vertices were exactly on the surface:');
console.log(`    nt=30 -> ${(100 * (1 - Math.cos(Math.PI / 30))).toFixed(4)}%   nt=118 -> ${(100 * (1 - Math.cos(Math.PI / 118))).toFixed(4)}%`);
