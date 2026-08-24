/**
 * PHASE 1F GATE 2 — FLAT / CHINE. Spec 36.6 step 2.
 *
 * THE DECISIVE TEST. Gate 1 is structurally incapable of failing an
 * over-smooth fit: every control there was a smooth monotone body, so a
 * surface that turned everything into a beautifully smooth potato would ace
 * it. Gate 2 asks the other half of the proposition:
 *
 *   does Phase 1F remove tessellation artefacts WITHOUT DELETING GENUINE
 *   GEOMETRY?
 *
 * CRITERION CARRIED FORWARD, NOT INVENTED. Spec 28/28a: "the real flat and
 * its corners must be RETAINED"; spec 21 directional row: differences within
 * 2% or 0.5 deg, whichever larger, AND sign/order correct; TOL.profile in
 * ribbons.mjs is 2% of Rmax. Gate 2 therefore fails if the reconstructed
 * radius departs from the analytic chine by more than 2% of Rmax anywhere in
 * the retained domain.
 *
 * BANDWIDTH IS NOT TOUCHED. (cx, cu) = (2.5, 2.5), fixed before any gate
 * result existed (spec 38.4). Per the pre-registration, if this gate fails
 * the bandwidth may NOT be tuned against this control and this same chine
 * then called the validation -- it would become selection data and a fresh
 * independent non-smooth geometry would have to become the proof.
 *
 * RUN ONCE, UNCHANGED.
 */
import { analyticBody, ribbonMetrics } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { chainContour } from './ribbons-contour.mjs';
import { sectionSegments, stationGrid, RAYS } from './ribbons-section.mjs';
import { makeSkin, skinRadii } from './skin.mjs';

/** Detector parameters SELECTED on development data (burned Gate 2 chine +
 * Gate 1 smooth negatives), spec 41.1. kink 0.05 sits between the smooth-body
 * scale and a real chine; minEdges 24 sits between the longest smooth
 * artefact (8 edges) and the shortest real chine component (61). */
const FEATURES = { kinkThreshold: 0.05, minEdges: 24 };

const DEG = 180 / Math.PI;
const A = 3, B = 1, NX = 240, STATIONS = 128, TIP = 0.025, JIT = 0.4, NU = 256;
const D_FLAT = 0.700;
const TOL_PROFILE = 0.02;                 // 2% of Rmax — frozen, ribbons.mjs TOL.profile
const TOL = { turnMax: 0.5, turnMed: 0.1 };

const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2)) * B;
/** Flat-bottomed spheroid: the plane y = -0.700 cuts the hull. */
const chineFn = (x, th) => { const c = Math.cos(th);
  return c < -1e-12 ? Math.min(rc(x), D_FLAT / -c) : rc(x); };

const xs = stationGrid(A, STATIONS);
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));
const FLAT_RAY = RAYS.findIndex((t) => Math.abs(t - Math.PI) < 1e-9);
/** True corner half-angle at station x: where the flat meets the circle. */
const cornerTh = (x) => (rc(x) > D_FLAT ? Math.acos(-D_FLAT / rc(x)) : null);

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
  let multi = 0, missed = 0;
  for (let i = 0; i < STATIONS; i++) {
    const got = getR(xs[i]);
    if (!got) continue;
    const r = got.r || got;
    for (let k = 0; k < RAYS.length; k++) R[k][i] = r[k];
    if (got.multi) multi += got.multi;
    if (got.missed) missed += got.missed;
  }
  R.forEach(fill);
  let Rmax = 0;
  for (let i = i0; i <= i1; i++) Rmax = Math.max(Rmax, rc(xs[i]));
  const errs = [];
  let worst = 0, worstAt = null, flatWorst = 0, cornerWorst = 0;
  for (let i = i0; i <= i1; i++) {
    const cth = cornerTh(xs[i]);
    for (let k = 0; k < RAYS.length; k++) {
      const want = chineFn(xs[i], RAYS[k]);
      const e = Math.abs(R[k][i] - want) / Rmax;
      errs.push(e);
      if (e > worst) { worst = e; worstAt = { x: xs[i].toFixed(3), th: (RAYS[k] * DEG).toFixed(1), got: R[k][i], want }; }
      if (k === FLAT_RAY) flatWorst = Math.max(flatWorst, e);
      if (cth !== null) {
        const d = Math.abs(Math.abs(((RAYS[k] - Math.PI + Math.PI) % (2 * Math.PI)) - Math.PI) - 0);
        const dth = Math.abs(Math.abs(RAYS[k] - Math.PI) - (Math.PI - cth));
        if (dth < 12 / DEG) cornerWorst = Math.max(cornerWorst, e);
      }
    }
  }
  errs.sort((a, b) => a - b);
  const rms = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
  const p99 = errs[Math.floor(0.99 * errs.length)];
  const ft = R.map((rib) => { const m = ribbonMetrics(rib, 2 * A, { tipFrac: TIP });
    return (m.absTurn - Math.abs(m.netTurn)) * DEG; });
  const s = [...ft].sort((a, b) => a - b);
  return { R, worst, worstAt, flatWorst, cornerWorst, rms, p99,
    turnMax: Math.max(...ft), turnMed: s[Math.floor(ft.length / 2)], multi, missed };
}

console.log('\nPHASE 1F GATE 2 — FLAT / CHINE. Run once, unchanged. Bandwidth untouched at (2.5, 2.5).');
console.log(`criterion carried forward: reconstructed radius within ${100 * TOL_PROFILE}% of Rmax of the analytic chine,`);
console.log('everywhere in the retained domain. Flat at y = -0.700 on a prolate spheroid A=3, B=1.\n');
console.log('  mesh                    RAW worst   SKIN worst   at flat   at corner    rms      p99     turn max/med   verdict');

const rows = [];
for (const nt of [96, 30]) {
  const reference = analyticBody(chineFn, A, { nx: NX, nt });
  for (const [label, gen] of [['regular', null], ['G1 jitter 0.4', 'sineJitter']]) {
    const mesh = gen ? GENERATORS[gen](chineFn, A, NX, nt, JIT) : reference;
    const raw = assess((x) => rawRadii(mesh, x));
    const skin = makeSkin(mesh.verts, mesh.faces, { features: FEATURES });
    const sk = assess((x) => skinRadii(skin, x, RAYS, NU));
    const pass = sk.worst <= TOL_PROFILE;
    rows.push({ nt, label, raw, sk, pass, skin });
    console.log(`  chine nt=${String(nt).padEnd(3)} ${label.padEnd(14)} ${(100 * raw.worst).toFixed(3).padStart(8)}%  ` +
      `${(100 * sk.worst).toFixed(3).padStart(9)}%  ${(100 * sk.flatWorst).toFixed(2).padStart(6)}%  ` +
      `${(100 * sk.cornerWorst).toFixed(2).padStart(7)}%  ${(100 * sk.rms).toFixed(3).padStart(6)}% ` +
      `${(100 * sk.p99).toFixed(3).padStart(7)}%  ${sk.turnMax.toFixed(2).padStart(7)}/${sk.turnMed.toFixed(2).padStart(5)}   ${pass ? 'PASS' : 'FAIL'}`);
  }
}

console.log('\n  RAW false turning for comparison (does the skin still remove the fake roughness?):');
for (const r of rows) console.log(`    chine nt=${String(r.nt).padEnd(3)} ${r.label.padEnd(14)} RAW ${r.raw.turnMax.toFixed(2).padStart(7)}/${r.raw.turnMed.toFixed(2).padStart(6)}   SKIN ${r.sk.turnMax.toFixed(3).padStart(7)}/${r.sk.turnMed.toFixed(3).padStart(6)}`);

console.log('\n  worst-error location, and the skin bandwidth in angular terms:');
for (const r of rows) {
  const w = r.sk.worstAt;
  console.log(`    chine nt=${String(r.nt).padEnd(3)} ${r.label.padEnd(14)} worst at x=${w.x} theta=${w.th}deg  got ${w.got.toFixed(5)} want ${w.want.toFixed(5)}` +
    `   hu=${(r.skin.stats.hu * DEG).toFixed(2)}deg  multi ${r.sk.multi} missed ${r.sk.missed}`);
}

/* theta profile at one mid-body station — makes the mechanism visible */
{
  const nt = 96;
  const mesh = analyticBody(chineFn, A, { nx: NX, nt });
  const skin = makeSkin(mesh.verts, mesh.faces, { features: FEATURES });
  const x = xs[64];
  const { r } = skinRadii(skin, x, RAYS, NU);
  const raw = rawRadii(mesh, x);
  const cth = cornerTh(x);
  console.log(`\n  theta profile at x=${x.toFixed(3)} (true corner at ${(cth * DEG).toFixed(2)} / ${(360 - cth * DEG).toFixed(2)} deg):`);
  console.log('    theta    analytic     RAW        SKIN      skin err');
  RAYS.map((th, k) => ({ th, k })).filter(({ th }) => th * DEG >= 105 && th * DEG <= 255)
    .sort((a, b) => a.th - b.th)
    .forEach(({ th, k }) => {
      const want = chineFn(x, th);
      console.log(`    ${(th * DEG).toFixed(0).padStart(5)}  ${want.toFixed(5)}  ${raw[k].toFixed(5)}  ${r[k].toFixed(5)}   ${(100 * Math.abs(r[k] - want)).toFixed(3).padStart(7)}%`);
    });
}

const failed = rows.filter((r) => !r.pass);
console.log(`\n  GATE 2: ${failed.length ? `FAIL on ${failed.length}/${rows.length} — ${failed.map((f) => `nt=${f.nt} ${f.label}`).join(', ')}` : `PASS on all ${rows.length}`}`);
