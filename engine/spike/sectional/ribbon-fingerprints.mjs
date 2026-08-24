/**
 * SPEC 70.6 — the first ribbonContext result: reference corpus + Sunship.
 *
 * SHADOW ONLY. No Cd is computed, changed or implied. Production untouched.
 *
 * Every body goes through the production CANONICAL UPLOAD-HULL RULE: the
 * convex hull is the geometry identity, so analytic bodies are sampled and
 * hulled and OBJ bodies are hulled directly, exactly as the worker does.
 *
 * Sunship.obj is +Z forward, +Y up (spec 4.2, confirmed two independent ways).
 * The ribbon operator works along +X, so Z->X is applied as a pure axis
 * relabel — no scaling, no reshaping.
 */
import { readFileSync } from 'node:fs';
import { parseObjVertices } from '../../../site/calcv2/src/obj.js';
import { volumeCentroid } from './ribbons.mjs';
import { BODIES as TN } from './tn614-bodies.mjs';
import { SOLVED } from './series58-data.mjs';
import { PATTERNS, hullMesh } from './hull-bodies.mjs';
import { ribbonContext, EARNED } from './ribbon-context.mjs';

const SEED = 12345;

/** analytic body of revolution -> point cloud -> production hull */
function fromProfile(r, half, n = 12000) {
  return hullMesh(PATTERNS.fibonacci((X) => r(X), half, n, SEED));
}

/* ---- TN-614: (station %, radius %) of basic length ---- */
function tn614(name) {
  const pts = TN[name].pts.map(([s, v]) => [s / 100, v / 100]);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0], half = (x1 - x0) / 2, cx = (x0 + x1) / 2;
  return fromProfile((X) => {
    const s = X + cx;
    if (s <= x0 || s >= x1) return 0;
    let i = 0; while (i + 2 < pts.length && pts[i + 1][0] < s) i++;
    const [sa, ra] = pts[i], [sb, rb] = pts[i + 1];
    return ra + ((rb - ra) * (s - sa)) / (sb - sa);
  }, half);
}

/* ---- Series 58: y^2 = sum a_n x^n, y = r/D ---- */
function s58(mid) {
  const { a, LD } = SOLVED[mid], L = LD, half = L / 2;
  return fromProfile((X) => {
    const x = (X + half) / L;
    if (x <= 0 || x >= 1) return 0;
    let y2 = 0; for (let n = 0; n < 6; n++) y2 += a[n] * Math.pow(x, n + 1);
    return y2 > 0 ? Math.sqrt(y2) : 0;
  }, half);
}

/**
 * OBJ -> hull, with the declared body frame of spec 4.1 / 4.2.
 *
 * Sunship.obj is +Z forward, +Y up. The relabel (X,Y,Z) -> (Z, Y, -X) puts
 * flight on +X and keeps UP as the FIRST radial axis, so theta = 0 is up as
 * 4.2 requires. The -X keeps the frame right-handed rather than mirrored.
 *
 * THE AXIS IS PLACED ON THE VOLUME CENTROID (4.1), NOT the vertex centroid.
 * 4.1 rejects the vertex centroid explicitly as biased by triangulation
 * density; using it put the axis off-body on the Sunship and produced
 * hundreds of missed rays that were an artefact of MY framing, not geometry.
 */
function fromObj(path) {
  const v = parseObjVertices(readFileSync(path, 'utf8'));
  const pts = v.map((p) => [p[2], p[1], -p[0]]);          // +Z fwd, +Y up -> +X fwd, up at theta 0
  const h0 = hullMesh(pts);                               // hull first: the canonical object
  const c = volumeCentroid(h0.verts, h0.faces);           // 4.1 volume centroid of THAT object
  const o = c.c;                                          // volumeCentroid -> {c, volume, fallback}
  // TRANSLATE ONLY — a rigid shift cannot change the hull, so the faces stand
  // and no second quickhull pass is needed (or risked).
  return { verts: h0.verts.map((p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]), faces: h0.faces };
}

/* ---- TR-432 Akron: published a/L vs radius, L/D 5.9 ----
   Offsets copied from tr432-akron.mjs's AKRON_OFFSETS (NACA Report 432,
   published DIMENSIONS OF MODEL table). Copied rather than imported because
   that file is a RUNNER whose top level executes an exam and prints. */
const AKRON_OFFSETS = [
  [0.00, 0], [0.02, 4.95], [0.05, 9.96], [0.10, 14.20], [0.15, 16.65],
  [0.20, 18.39], [0.25, 19.12], [0.30, 19.61], [0.35, 19.85], [0.40, 19.90],
  [0.45, 19.90], [0.50, 19.80], [0.55, 19.59], [0.60, 19.12], [0.65, 18.46],
  [0.70, 17.50], [0.75, 16.15], [0.80, 14.44], [0.85, 12.29], [0.90, 9.61],
  [0.95, 6.52], [1.00, 0],
];
function akron() {
  const L = 1.0, half = L / 2;
  const L_IN = 19.62 * 12;                                   // tr432-akron.mjs: L_FT 19.62
  const pts = AKRON_OFFSETS.map(([aL, rIn]) => [aL, rIn / L_IN]);   // radius as a fraction of length
  return fromProfile((X) => {
    const t = (X + half) / L;
    if (t <= 0 || t >= 1) return 0;
    let i = 0; while (i + 2 < pts.length && pts[i + 1][0] < t) i++;
    const [sa, ra] = pts[i], [sb, rb] = pts[i + 1];
    return ra + ((rb - ra) * (t - sa)) / (sb - sa);
  }, half);
}

const CORPUS = [
  ['TN614-111 (parent)', () => tn614('111'), 'analytic -> hull'],
  ['TR432 Akron', () => akron(), 'analytic -> hull'],
  ['TN614-221', () => tn614('221'), 'analytic -> hull'],
  ['TN614-332 (bluffest)', () => tn614('332'), 'analytic -> hull'],
  ['S58-4157 (parent)', () => s58(4157), 'analytic -> hull'],
  ['S58-4171 (r1 0.00)', () => s58(4171), 'analytic -> hull'],
  ['S58-4174 (r1 0.20)', () => s58(4174), 'analytic -> hull'],
  ['S58-4167 (r0 0.00)', () => s58(4167), 'analytic -> hull'],
  ['S58-4170 (r0 1.00)', () => s58(4170), 'analytic -> hull'],
  ['SUNSHIP bare', () => fromObj('C:/Users/Toby/Desktop/CodeEverything/3D OBJ/Sunship.obj'), 'OBJ -> hull'],
  ['SUNSHIP tailed', () => fromObj('C:/Users/Toby/Desktop/CodeEverything/CalcV2/lab/sunship-tail-aerohull-candidate.obj'), 'OBJ -> hull'],
];

console.log('\nSPEC 70.6 — ribbonContext FINGERPRINTS. SHADOW ONLY: no Cd computed, changed or implied.');
console.log('  canonical skin: support function, sx=0.005L, sigma_theta=2deg. Descriptors: earned zones 1-5 only.');
console.log('  Every body via the production convex-hull rule.\n');
console.log('  body                    hullV  compositeV1  class     |    F1      F2a     F2f     F3      F4      F5    | elig');
const ctxs = [];
for (const [label, build, src] of CORPUS) {
  let mesh;
  try { mesh = build(); } catch (e) { console.log(`  ${label.padEnd(22)}  BUILD FAILED: ${e.message}`); continue; }
  const c = ribbonContext(mesh.verts, mesh.faces, { label, geometrySource: src });
  ctxs.push(c);
  const d = c.descriptors.median;
  console.log(`  ${label.padEnd(22)} ${String(mesh.verts.length).padStart(6)}  ${c.scalar.compositeV1.toFixed(6)}  ${c.scalar.cls.padEnd(8)} | ` +
    `${d.F1.toFixed(4)}  ${d.F2a.toFixed(3)}  ${d.F2f.toFixed(4)}  ${d.F3.toFixed(4)}  ${d.F4.toFixed(4)}  ${c.descriptors.F5.median.toFixed(3)} | ${c.eligibility.outcome}`);
}

console.log('\n  ZONE-LEVEL TURNING HISTORY (median across ribbons, deg). Zones 0 and 7 are POSITIONAL ONLY —');
console.log('  outside the earned derivative domain (55.2) — and are shown in brackets, excluded from F1-F5.');
console.log('  body                     [z0]    z1     z2     z3     z4     z5    [z6]   [z7]');
for (const c of ctxs) {
  const z = c.zones.median;
  console.log(`  ${c.label.padEnd(22)} [${z[0].toFixed(1).padStart(5)}] ` +
    EARNED.map((i) => z[i].toFixed(2).padStart(6)).join(' ') +
    ` [${z[6].toFixed(1).padStart(5)}][${z[7].toFixed(1).padStart(5)}]`);
}

console.log('\n  DIRECTIONAL SPREAD — where the ribbons see asymmetry the scalar cannot (F5 per opposite pair):');
for (const c of ctxs) {
  const f5 = c.descriptors.F5;
  const note = f5.worst < 0.05 ? 'axisymmetric — F5 not claimable (59.3)' : 'NON-AXISYMMETRIC — directional content present';
  console.log(`  ${c.label.padEnd(22)} F5 median ${f5.median.toFixed(3)}  worst ${f5.worst.toFixed(3)} deg   ${note}`);
}

console.log('\n  eligibility detail:');
for (const c of ctxs) {
  const e = c.eligibility;
  console.log(`  ${c.label.padEnd(22)} ${e.outcome.padEnd(12)} E2 multi ${String(e.checks.E2.multi).padStart(4)} missed ${String(e.checks.E2.missed).padStart(3)}  ` +
    `E4 shift ${(100 * e.checks.E4.worstShift).toFixed(2)}%  nonconvex ${e.convexity.nonConvexStations}/${e.convexity.retained}` +
    (e.checks.E3.problems && e.checks.E3.problems.length ? `  E3: ${e.checks.E3.problems[0]}` : ''));
}
console.log('\n  No aggregate score exists in this schema by construction (70.3).\n');
