/**
 * SEED-ALIASING DIAGNOSTIC — burned Gate 2 body ONLY. Spec 45.
 *
 * ONE QUESTION: does the frozen `both endpoints > 0.05` edge-seeding rule fail
 * because a genuine crease need not coincide with a chain of mesh edges?
 *
 * The analytic chine location is used HERE FOR SCORING ONLY. The control is
 * already burned (spec 40.4). It must never enter a production detector.
 *
 * No new detector is built in this file. Nothing is retuned. 0.05 stands.
 */
import { analyticBody } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { detectFeatureCurvesV2, creaseResiduals } from './features.mjs';

const DEG = 180 / Math.PI, A = 3, NX = 240, D = 0.700;
const SEED_T = 0.05;                       // FROZEN. Not retuned here.
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
const chineFn = (x, th) => { const c = Math.cos(th); return c < -1e-12 ? Math.min(rc(x), D / -c) : rc(x); };
/** SCORING TRUTH: angle of the corner at station x. Two corners, +/-. */
const cornerTh = (x) => (rc(x) > D ? Math.acos(-D / rc(x)) : null);
const X_END = A * Math.sqrt(1 - D * D);
const wrapA = (d) => { let t = d; while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; return t; };

console.log('\nSEED-ALIASING DIAGNOSTIC — burned Gate 2 chine only. Analytic chine = scoring truth.');
console.log(`Seed threshold frozen at ${SEED_T}. Flat exists for |x| < ${X_END.toFixed(4)}.\n`);

for (const [lab, gen, nt] of [['regular', null, 96], ['regular', null, 30], ['G1 jitter', 'sineJitter', 96]]) {
  const mesh = gen ? GENERATORS[gen](chineFn, A, NX, nt, 0.4) : analyticBody(chineFn, A, { nx: NX, nt });
  const { kink } = creaseResiduals(mesh.verts, mesh.faces, {});
  const det = detectFeatureCurvesV2(mesh.verts, mesh.faces, { kinkThreshold: SEED_T, minEdges: 24 });
  const V = mesh.verts;
  const dth = (2 * Math.PI) / nt, dx = (2 * A) / NX;

  // signed angular offset of a vertex from the nearer analytic corner, in
  // units of the local vertex spacing
  const offsetOf = (i) => {
    const c = cornerTh(V[i][0]);
    if (c === null) return null;
    const th = Math.atan2(V[i][2], V[i][1]);
    const d1 = wrapA(th - c), d2 = wrapA(th + c);
    return Math.abs(d1) < Math.abs(d2) ? d1 : d2;
  };

  // ---- 1. is the SIGNAL continuous along the chine, station by station? ----
  let stations = 0, sigStations = 0, edgeStations = 0;
  const bandK = [];
  for (let ring = 0; ring <= NX; ring++) {
    const x = -A + 2 * A * ring / NX;
    if (Math.abs(x) > X_END - 0.05) continue;
    const c = cornerTh(x);
    if (c === null) continue;
    stations++;
    let best = 0, anyEdge = false;
    const near = [];
    V.forEach((v, i) => {
      if (Math.abs(v[0] - x) > dx * 0.75) return;
      const o = offsetOf(i);
      if (o === null || Math.abs(o) > 1.5 * dth) return;
      near.push(i);
      if (kink[i] > best) best = kink[i];
    });
    if (best > SEED_T) sigStations++;
    bandK.push(best);
    // does a QUALIFYING EDGE exist in this band?
    const nearSet = new Set(near);
    for (const k of det.edgeFaces.keys()) {
      const ab = k.split('_').map(Number);
      if (!nearSet.has(ab[0]) || !nearSet.has(ab[1])) continue;
      if (kink[ab[0]] > SEED_T && kink[ab[1]] > SEED_T) { anyEdge = true; break; }
    }
    if (anyEdge) edgeStations++;
  }

  // ---- 2. edge endpoint census in the chine band ----
  let e0 = 0, e1 = 0, e2 = 0;
  for (const k of det.edgeFaces.keys()) {
    const ab = k.split('_').map(Number);
    const oa = offsetOf(ab[0]), ob = offsetOf(ab[1]);
    if (oa === null || ob === null) continue;
    if (Math.abs(oa) > 1.5 * dth && Math.abs(ob) > 1.5 * dth) continue;
    const n = (kink[ab[0]] > SEED_T ? 1 : 0) + (kink[ab[1]] > SEED_T ? 1 : 0);
    if (n === 0) e0++; else if (n === 1) e1++; else e2++;
  }

  // ---- 3. how far are the actual seed edges from the analytic chine? ----
  const seedOff = [];
  for (const k of det.featureEdges) {
    for (const i of k.split('_').map(Number)) {
      const o = offsetOf(i);
      if (o !== null) seedOff.push(Math.abs(o) / dth);
    }
  }
  seedOff.sort((a, b) => a - b);

  // ---- 4. how far are the HIGH-KINK vertices from the analytic chine? ----
  const hiOff = [];
  V.forEach((v, i) => {
    if (kink[i] <= SEED_T) return;
    const o = offsetOf(i);
    if (o !== null) hiOff.push(Math.abs(o) / dth);
  });
  hiOff.sort((a, b) => a - b);

  console.log(`  ---- chine ${lab}, nt=${nt} (vertex spacing ${(dth * DEG).toFixed(2)} deg) ----`);
  console.log(`  stations across the chine: ${stations}`);
  console.log(`    with SIGNAL present  (some band vertex kink > ${SEED_T}): ${sigStations}  (${(100 * sigStations / stations).toFixed(1)}%)`);
  console.log(`    with a QUALIFYING EDGE (both endpoints > ${SEED_T}):      ${edgeStations}  (${(100 * edgeStations / stations).toFixed(1)}%)`);
  console.log(`    band max-kink over stations: min ${Math.min(...bandK).toFixed(4)}  median ${bandK.slice().sort((a, b) => a - b)[Math.floor(bandK.length / 2)].toFixed(4)}  max ${Math.max(...bandK).toFixed(4)}`);
  console.log(`  edges in the chine band: 0 endpoints over ${SEED_T}: ${e0}   1 endpoint: ${e1}   2 endpoints: ${e2}`);
  console.log(`  high-kink vertices: ${hiOff.length}, offset from analytic chine in vertex spacings — median ${hiOff.length ? hiOff[Math.floor(hiOff.length / 2)].toFixed(2) : 'n/a'}, p90 ${hiOff.length ? hiOff[Math.floor(0.9 * hiOff.length)].toFixed(2) : 'n/a'}`);
  console.log(`  seed-edge vertices: ${seedOff.length}, same measure — median ${seedOff.length ? seedOff[Math.floor(seedOff.length / 2)].toFixed(2) : 'n/a'}, p90 ${seedOff.length ? seedOff[Math.floor(0.9 * seedOff.length)].toFixed(2) : 'n/a'}\n`);
}
console.log('  READ: if SIGNAL% is high while QUALIFYING EDGE% is much lower, the evidence is');
console.log('  continuous and the EDGE RULE is aliasing it away. That is a representation');
console.log('  failure, not a threshold failure.');
