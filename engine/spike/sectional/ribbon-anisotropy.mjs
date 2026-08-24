/**
 * RIBBON CLOCK-ANGLE ANISOTROPY — SHADOW DIAGNOSTIC. Spec 89.
 *
 * THE OWNER'S AMENDMENT (2026-08-21): do not build a separate transverse
 * geometry system. First determine whether the EXISTING per-ribbon clock-angle
 * data already contains the missing section-shape signal. F5 only tests
 * 180-degree opposition (central asymmetry); it is not a general
 * non-axisymmetry descriptor.
 *
 * WHAT THIS IS: angular Fourier modes of `ribbonContext`'s EXISTING positional
 * field `R[ribbon][station]` — 48 rays per station, already computed for every
 * body. Per station, with mean radius `rbar`:
 *
 *     A_m = 2|sum_k R_k e^{-i m th_k}| / (N rbar)      for m = 1, 2, 4
 *
 *   A1  central asymmetry  — the mode family F5 already sees (camber)
 *   A2  ellipse-like anisotropy — long axis vs short axis
 *   A4  four-sided character    — squareness
 *
 * Aggregated as the MEDIAN over retained-domain stations with rbar >= 10% of
 * the body's max radius (tiny tip sections would dominate a ratio).
 *
 * WHAT THIS IS NOT: a new frozen descriptor. 59.3's descriptor set is frozen
 * and F1-F5 are untouched; 70.4's schema is untouched (this file CONSUMES
 * ribbonContext, adding nothing to it). Adopting any of A1/A2/A4 as an F6
 * would be a dated ruling on the 59.3 set — NOT taken here. Shadow only; no
 * Cd is read differently anywhere.
 *
 * PRE-REGISTERED PREDICTIONS — analytic values computed from the exact section
 * curves (4096-point quadrature, no mesh, no pipeline) BEFORE this file was
 * run, frozen here with a +/-15% relative tolerance (the support skin's
 * sigma_theta = 2 deg smoothing attenuates mode m by ~exp(-(m*sigma)^2/2),
 * under 1% even at m=4, so the tolerance is dominated by the 48-ray sampling
 * and the raster, not the skin):
 *
 *   Q1  circle:            A1, A2, A4 all < 0.01
 *   Q2  ellipse k:         A2 = 0.201 / 0.338 / 0.518 / 0.715 for k = 1.5/2/3/5,
 *                          rising monotonically; A2 > 3x A4 at every k
 *   Q3  superellipse n:    A4 = 0.057 / 0.086 / 0.112 / 0.128 / 0.136 for
 *                          n = 3/4/6/10/20, rising monotonically; A2 < 0.01
 *                          (a superellipse has NO m=2 content at all)
 *   Q4  camber (82.3, k=0.2 vertical offset): A1 dominant, A2 and A4 small —
 *                          the ONE mode family F5 already sees
 *
 * If Q1-Q4 hold, the conclusion is the owner's: the raw ribbon field can see
 * ellipticity and squareness; the frozen SUMMARIES are what cannot.
 */
import { ribbonContext } from './ribbon-context.mjs';
import { clockModes } from './clock-modes.mjs';
import { s58Poly, s58Radius } from './sweep-generic.mjs';
import { volumeCentroid } from './ribbons.mjs';

const RINGS = 240, NAZ = 128;
const PARENT = { m: 0.40, r0: 0.50, r1: 0.10, Cp: 0.65, LD: 7 };
const a = s58Poly(PARENT.m, PARENT.r0, PARENT.r1, PARENT.Cp);
const prof = s58Radius(a, PARENT.LD);

function gamma(z) {
  const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = C[0];
  for (let i = 1; i < g + 2; i++) x += C[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/* the same section families as spec 87, equal-area by construction */
const circle = () => (r) => () => r;
const ellipse = (k) => (r) => {
  const A = r * Math.sqrt(k), B = r / Math.sqrt(k);
  return (th) => (A * B) / Math.hypot(B * Math.cos(th), A * Math.sin(th));
};
const superellipse = (n) => {
  const scale = Math.sqrt((Math.PI * gamma(1 + 2 / n)) / (4 * gamma(1 + 1 / n) ** 2));
  return (r) => {
    const R = r * scale;
    return (th) => {
      const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
      return R / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
    };
  };
};
/* 82.3's camber: circular sections offset vertically, k = 0.2 */
const camber = (v) => (r, X) => {
  const off = v * 0.5 * Math.sin((Math.PI * (X + prof.half)) / (2 * prof.half));
  return (th) => {
    const c = off * Math.cos(th);
    return c + Math.sqrt(Math.max(0, r * r - off * off * Math.sin(th) ** 2));
  };
};

function build(sectionOf, identity) {
  const verts = [], faces = [], ringStart = [];
  for (let i = 0; i <= RINGS; i++) {
    const x = -prof.half + (2 * prof.half * i) / RINGS;
    const r = Math.max(prof.r(x), 0);
    if (r < 1e-9) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
    const sec = sectionOf(r, x);
    ringStart.push(verts.length);
    for (let j = 0; j < NAZ; j++) {
      const th = (2 * Math.PI * j) / NAZ, rr = sec(th);
      verts.push([x, rr * Math.cos(th), rr * Math.sin(th)]);
    }
  }
  const size = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
  for (let i = 0; i < RINGS; i++) {
    const A = ringStart[i], B = ringStart[i + 1];
    const aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let j = 0; j < NAZ; j++) {
      const j1 = (j + 1) % NAZ;
      if (aP) faces.push([A, B + j, B + j1]);
      else if (bP) faces.push([A + j, B, A + j1]);
      else { faces.push([A + j, B + j, B + j1]); faces.push([A + j, B + j1, A + j1]); }
    }
  }
  const c = volumeCentroid(verts, faces).c;
  return { verts: verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]), faces, identity };
}

/* pre-registered analytic values (header) for the checks */
const ANALYTIC = {
  'ellipse k=1.5': { A2: 0.201 }, 'ellipse k=2': { A2: 0.338 },
  'ellipse k=3': { A2: 0.518 }, 'ellipse k=5': { A2: 0.715 },
  'superellipse n=3': { A4: 0.0574 }, 'superellipse n=4': { A4: 0.0860 },
  'superellipse n=6': { A4: 0.1120 }, 'superellipse n=10': { A4: 0.1285 },
  'superellipse n=20': { A4: 0.1365 },
};

const CASES = [
  { label: 'circle (control)', sec: circle() },
  { label: 'ellipse k=1.5', sec: ellipse(1.5) }, { label: 'ellipse k=2', sec: ellipse(2) },
  { label: 'ellipse k=3', sec: ellipse(3) }, { label: 'ellipse k=5', sec: ellipse(5) },
  { label: 'superellipse n=3', sec: superellipse(3) }, { label: 'superellipse n=4', sec: superellipse(4) },
  { label: 'superellipse n=6', sec: superellipse(6) }, { label: 'superellipse n=10', sec: superellipse(10) },
  { label: 'superellipse n=20', sec: superellipse(20) },
  { label: 'camber k=0.2 (82.3)', sec: camber(0.2) },
];

console.log('\nRIBBON CLOCK-ANGLE ANISOTROPY (spec 89) — SHADOW DIAGNOSTIC');
console.log('  Measures the EXISTING ribbonContext positional field. F1-F5 untouched,');
console.log('  70.4 schema untouched, no Cd read differently anywhere.\n');
console.log('  case                  A1       A2       A4      max/min  analytic     d%      F5(frozen)');

const out = [];
const fails = [];
for (const c of CASES) {
  const s = build(c.sec, `authored-lathe(${c.label})`);
  const ctx = ribbonContext(s.verts, s.faces, { label: c.label });
  const m = clockModes(ctx);
  const f5 = ctx.descriptors.F5.median;
  const an = ANALYTIC[c.label];
  let anStr = '', dStr = '';
  if (an) {
    const key = an.A2 !== undefined ? 'A2' : 'A4';
    const d = (m[key] - an[key]) / an[key];
    anStr = `${key}=${an[key].toFixed(3)}`;
    dStr = `${(100 * d).toFixed(1)}%`;
    if (Math.abs(d) > 0.15) fails.push(`${c.label}: ${key} ${m[key].toFixed(4)} vs analytic ${an[key].toFixed(4)} (${dStr})`);
  }
  out.push({ ...c, m, f5 });
  console.log(`  ${c.label.padEnd(21)} ${m.A1.toFixed(4)}  ${m.A2.toFixed(4)}  ${m.A4.toFixed(4)}  ` +
    `${m.ratio.toFixed(4)}   ${anStr.padEnd(10)} ${dStr.padStart(6)}   ${f5.toFixed(4)}`);
}

/* ---- the pre-registered checks ---- */
const get = (lab) => out.find((o) => o.label === lab).m;
const ctl = get('circle (control)');
console.log('\n  PRE-REGISTERED CHECKS:');
const q1 = ctl.A1 < 0.01 && ctl.A2 < 0.01 && ctl.A4 < 0.01;
console.log(`    Q1 circle all modes < 0.01:            ${q1 ? 'HOLDS' : 'FAILS'}  (A1 ${ctl.A1.toFixed(5)}, A2 ${ctl.A2.toFixed(5)}, A4 ${ctl.A4.toFixed(5)})`);
const ellK = ['ellipse k=1.5', 'ellipse k=2', 'ellipse k=3', 'ellipse k=5'].map(get);
const q2 = ellK.every((m, i) => (i === 0 || m.A2 > ellK[i - 1].A2) && m.A2 > 3 * m.A4);
console.log(`    Q2 ellipse A2 monotone, A2 > 3x A4:    ${q2 ? 'HOLDS' : 'FAILS'}  (A2: ${ellK.map((m) => m.A2.toFixed(3)).join(' -> ')})`);
const supN = ['superellipse n=3', 'superellipse n=4', 'superellipse n=6', 'superellipse n=10', 'superellipse n=20'].map(get);
const q3 = supN.every((m, i) => (i === 0 || m.A4 > supN[i - 1].A4) && m.A2 < 0.01);
console.log(`    Q3 superellipse A4 monotone, A2 < 0.01: ${q3 ? 'HOLDS' : 'FAILS'}  (A4: ${supN.map((m) => m.A4.toFixed(3)).join(' -> ')})`);
const cam = get('camber k=0.2 (82.3)');
const q4 = cam.A1 > 3 * cam.A2 && cam.A1 > 3 * cam.A4;
console.log(`    Q4 camber A1-dominant:                 ${q4 ? 'HOLDS' : 'FAILS'}  (A1 ${cam.A1.toFixed(4)}, A2 ${cam.A2.toFixed(4)}, A4 ${cam.A4.toFixed(4)})`);
if (fails.length) {
  console.log('\n  ANALYTIC-AGREEMENT FAILURES (>15%):');
  for (const f of fails) console.log(`    - ${f}`);
}

console.log('\n  F5 column: the frozen descriptor, for contrast — it sees A1 (camber) and');
console.log('  nothing else, exactly as spec 87.3 established.');
console.log('\n  SHADOW ONLY. Descriptor set 59.3 and schema 70.4 unchanged; adopting any');
console.log('  A_m as an F6 is a separate dated ruling. Production untouched.\n');
