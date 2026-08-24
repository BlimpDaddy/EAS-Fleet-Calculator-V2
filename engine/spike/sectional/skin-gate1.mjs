/**
 * PHASE 1F GATE 1 — SMOOTH ANALYTIC SURFACES ACROSS THE REUSED TESSELLATION
 * FAMILIES. Spec 36.6 step 1, tolerances carried forward verbatim from spec 21.
 *
 * JUDGED BOTH WAYS, as 36.4.1 requires:
 *   DIRECT   positional fidelity on the operator-matched fixed (x, theta)
 *            grid against the analytic oracle -- says whether reconstruction
 *            worked at all.
 *   RIBBON   false turning per ribbon -- says whether it worked for the
 *            purpose of the programme. Headline, but it may not hide a
 *            geometrically bad skin that happens to summarise well.
 *
 * Nearest-surface distance is NOT used anywhere: prohibited by 36.4.2 because
 * nearest-neighbour matching flatters a surface displaced along itself.
 *
 * The RAW column is the pre-Phase-1F pipeline (section -> chain -> ray) on the
 * identical mesh. Without it a pass cannot be attributed to reconstruction.
 */
import { analyticBody, ribbonMetrics } from './ribbons.mjs';
import { GENERATORS, verifyGenerator } from './ribbons-generators.mjs';
import { chainContour } from './ribbons-contour.mjs';
import { sectionSegments, stationGrid, RAYS } from './ribbons-section.mjs';
import { makeSkin, skinRadii } from './skin.mjs';

/** Detector parameters SELECTED on development data (burned Gate 2 chine +
 * Gate 1 smooth negatives), spec 41.1. kink 0.05 sits between the smooth-body
 * scale and a real chine; minEdges 24 sits between the longest smooth
 * artefact (8 edges) and the shortest real chine component (61). */
const FEATURES = { kinkThreshold: 0.05, minEdges: 24 };

const DEG = 180 / Math.PI;
const A = 3, NX = 240, STATIONS = 128, TIP = 0.025, JIT = 0.4;
const NU = 256;
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));   // monotone, so false turning IS noise

/** FROZEN, spec 21 — not re-derived, not loosened. */
const TOL = { rms: 0.005, p99: 0.015, turnMax: 0.5, turnMed: 0.1 };

const xs = stationGrid(A, STATIONS);
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));

function rawRadii(mesh, x) {
  const { segs } = sectionSegments(mesh.verts, mesh.faces, x);
  if (segs.length < 3) return null;
  const c = chainContour(segs);
  if (!c.ok) return null;
  const loop = c.loop, n = loop.length;
  return RAYS.map((th) => {
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

function fill(rib) {
  let prev = -1;
  for (let i = 0; i < STATIONS; i++) {
    if (Number.isNaN(rib[i])) continue;
    if (prev < 0) { for (let j = 0; j < i; j++) rib[j] = 0; }
    else if (i - prev > 1) for (let j = prev + 1; j < i; j++) rib[j] = rib[prev] + ((rib[i] - rib[prev]) * (j - prev)) / (i - prev);
    prev = i;
  }
  if (prev < 0) rib.fill(0); else for (let j = prev + 1; j < STATIONS; j++) rib[j] = 0;
  return rib;
}

function assess(getR) {
  const R = Array.from({ length: RAYS.length }, () => new Array(STATIONS).fill(NaN));
  let multi = 0, missed = 0, fails = 0;
  for (let i = 0; i < STATIONS; i++) {
    const got = getR(xs[i]);
    if (!got) { fails++; continue; }
    for (let k = 0; k < RAYS.length; k++) R[k][i] = got.r ? got.r[k] : got[k];
    if (got.multi) multi += got.multi;
    if (got.missed) missed += got.missed;
  }
  R.forEach(fill);
  // DIRECT positional, retained domain only, against the analytic oracle
  const errs = [];
  let Rmax = 0;
  for (let i = i0; i <= i1; i++) Rmax = Math.max(Rmax, rc(xs[i]));
  for (let i = i0; i <= i1; i++) {
    const want = rc(xs[i]);
    for (let k = 0; k < RAYS.length; k++) errs.push(Math.abs(R[k][i] - want) / Rmax);
  }
  errs.sort((a, b) => a - b);
  const rms = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
  const p99 = errs[Math.min(errs.length - 1, Math.floor(0.99 * errs.length))];
  // RIBBON false turning
  const ft = R.map((rib) => { const m = ribbonMetrics(rib, 2 * A, { tipFrac: TIP });
    return (m.absTurn - Math.abs(m.netTurn)) * DEG; });
  const s = [...ft].sort((a, b) => a - b);
  return { rms, p99, turnMax: Math.max(...ft), turnMed: s[Math.floor(ft.length / 2)], multi, missed, fails };
}

const FAMILIES = [
  ['regular', null],
  ['G1 sine jitter', 'sineJitter'],
  ['G2 block density', 'blockDensity'],
  ['G3 azimuthal shear', 'azimuthalShear'],
  ['G4 surface walk', 'surfaceWalk'],
];

console.log('\nPHASE 1F GATE 1 — smooth analytic surface, reused tessellation families');
console.log(`spec 21 tolerances, carried forward: RMS <= ${100 * TOL.rms}% Rmax, p99 <= ${100 * TOL.p99}% Rmax,`);
console.log(`false turning <= ${TOL.turnMax} deg max and <= ${TOL.turnMed} deg median\n`);
console.log('  family              nt    generator gate   RAW turn max/med      SKIN rms    p99     turn max/med   verdict');

const results = [];
for (const nt of [30, 118]) {
  const reference = analyticBody(rc, A, { nx: NX, nt });
  for (const [label, gen] of FAMILIES) {
    let mesh = reference, vg = 'n/a (reference)';
    if (gen) {
      const v = verifyGenerator(gen, rc, A, NX, nt, reference);
      vg = v.pass ? `PASS ${v.worstOff.toExponential(1)}` : `FAIL ${v.problems.join('; ')}`;
      mesh = GENERATORS[gen](rc, A, NX, nt, JIT);
    }
    const raw = assess((x) => rawRadii(mesh, x));
    const skin = makeSkin(mesh.verts, mesh.faces, { features: FEATURES });
    const sk = assess((x) => skinRadii(skin, x, RAYS, NU));
    const pass = sk.rms <= TOL.rms && sk.p99 <= TOL.p99 && sk.turnMax <= TOL.turnMax && sk.turnMed <= TOL.turnMed;
    results.push({ nt, label, raw, sk, pass, skin });
    console.log(`  ${label.padEnd(19)} ${String(nt).padEnd(5)} ${vg.padEnd(16)} ` +
      `${raw.turnMax.toFixed(2).padStart(7)}/${raw.turnMed.toFixed(2).padStart(6)}   ` +
      `${(100 * sk.rms).toFixed(3).padStart(7)}% ${(100 * sk.p99).toFixed(3).padStart(7)}% ` +
      `${sk.turnMax.toFixed(3).padStart(8)}/${sk.turnMed.toFixed(3).padStart(6)}   ${pass ? 'PASS' : 'FAIL'}`);
  }
}

console.log('\n  skin diagnostics (36.5 domain rule + fit fallbacks):');
for (const r of results) {
  const s = r.skin.stats;
  console.log(`    ${r.label.padEnd(19)} nt=${String(r.nt).padEnd(4)} verts ${String(s.vertices).padStart(6)} ` +
    `hx ${s.hx.toFixed(4)} hu ${(s.hu * DEG).toFixed(2)}deg  quad ${s.quadratic} lin ${s.linear} nearest ${s.nearest} empty ${s.empty}  ` +
    `multiHit ${r.sk.multi} missed ${r.sk.missed}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n  GATE 1: ${failed.length ? `FAIL on ${failed.length}/${results.length} — ${failed.map((f) => `${f.label} nt=${f.nt}`).join(', ')}` : `PASS on all ${results.length} tessellations`}`);
