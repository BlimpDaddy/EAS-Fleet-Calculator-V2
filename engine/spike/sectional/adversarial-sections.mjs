/**
 * ITEM 3 — ADVERSARIAL SECTION SHAPES. Spec 87.
 *
 * THE QUESTION (owner, 2026-08-21):
 *   "can the frozen estimator + ribbon/context layer recognise shapes that the
 *    scalar alone rewards suspiciously?"
 *
 * DIAGNOSTIC ONLY. Current frozen calibration. NO knot, geometry-convention,
 * estimator, classifier or ribbon change. Production byte-untouched.
 *
 * THE CONSTRUCTION, and why it is the sharpest possible test of the scalar:
 *
 *   The ENTIRE production scalar is a functional of A(x). `measureSections`
 *   rasterises cross-sectional AREA per station; `scoreSections` consumes
 *   `{A, L, cell}`; `classifySections` and `shoulderAngleScore` consume the same
 *   `m.A`. Nothing downstream of the raster knows what SHAPE those sections
 *   were.
 *
 *   So: hold A(x) IDENTICAL and vary only the section shape. The scalar must be
 *   invariant. Anything that then distinguishes these bodies is coming from
 *   somewhere other than the scalar — which is precisely what item 3 asks.
 *
 * THE FAMILIES, all sharing the Series 58 parent's A(x) — the same profile the
 * step-2 sweeps used, already in the corpus at proxy 0.023552 / Cd 0.05108:
 *
 *   RADIAL        circular sections. The control.
 *   ELLIPTICAL    semi-axes a = r*sqrt(k), b = r/sqrt(k). Area preserved
 *                 EXACTLY for every k, so A(x) is untouched.
 *   SUPERELLIPSE  |y/R|^n + |z/R|^n = 1, with R scaled by
 *                 R = r * sqrt(pi*Gamma(1+2/n) / (4*Gamma(1+1/n)^2))
 *                 so the section area is again EXACTLY pi*r^2. n = 2 is the
 *                 circle; n -> infinity is a square.
 *
 * Frontal area is matched by construction too: for a body whose sections all
 * share one shape, the frontal projection is the largest section, and every
 * family's largest section has the same area. **Only WETTED area differs** — a
 * circle minimises perimeter for a given area, so every non-circular family
 * carries more skin.
 *
 * MESH: structured lathe, rings x azimuths, NOT hulled. A superellipse is
 * convex, so hulling would be nearly inert, but sampling-then-hulling would
 * round the corners at the sampling scale and the corner is the whole point.
 * The authored surface is the DYNAMIC identity (80.5, 84.11.1) and the ribbon
 * layer reads it directly.
 */
import { s58Poly, s58Radius } from './sweep-generic.mjs';
import { evaluate } from './batch-harness.mjs';
import { volumeCentroid } from './ribbons.mjs';

const RINGS = 240, NAZ = 128;
const L_M = 100, SPEED = 100;                    // the step-2 artificial common scale
const PARENT = { m: 0.40, r0: 0.50, r1: 0.10, Cp: 0.65, LD: 7 };

/** Lanczos gamma — needed for the equal-area superellipse scale factor. */
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

/** section shape: given the equal-area circular radius r, return radius at theta */
const SHAPES = {
  circle: () => (r) => () => r,
  ellipse: (k) => (r) => {
    const a = r * Math.sqrt(k), b = r / Math.sqrt(k);      // area pi*a*b = pi*r^2
    return (th) => {
      const c = Math.cos(th), s = Math.sin(th);
      return (a * b) / Math.hypot(b * c, a * s);
    };
  },
  superellipse: (n) => {
    /* area of |y/R|^n + |z/R|^n = 1 is 4 R^2 G(1+1/n)^2 / G(1+2/n) */
    const scale = Math.sqrt((Math.PI * gamma(1 + 2 / n)) / (4 * gamma(1 + 1 / n) ** 2));
    return (r) => {
      const R = r * scale;
      return (th) => {
        const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
        return R / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
      };
    };
  },
};

/** structured lathe over an arbitrary section shape */
function build(radiusAt, sectionOf, half, identity) {
  const verts = [], faces = [], ringStart = [];
  for (let i = 0; i <= RINGS; i++) {
    const x = -half + (2 * half * i) / RINGS;
    const r = Math.max(radiusAt(x), 0);
    if (r < 1e-9) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
    const sec = sectionOf(r);
    ringStart.push(verts.length);
    for (let j = 0; j < NAZ; j++) {
      const th = (2 * Math.PI * j) / NAZ;
      const rr = sec(th);
      verts.push([x, rr * Math.cos(th), rr * Math.sin(th)]);
    }
  }
  const size = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
  for (let i = 0; i < RINGS; i++) {
    const a = ringStart[i], b = ringStart[i + 1];
    const aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let j = 0; j < NAZ; j++) {
      const j1 = (j + 1) % NAZ;
      if (aP) faces.push([a, b + j, b + j1]);
      else if (bP) faces.push([a + j, b, a + j1]);
      else { faces.push([a + j, b + j, b + j1]); faces.push([a + j, b + j1, a + j1]); }
    }
  }
  const c = volumeCentroid(verts, faces).c;
  return { verts: verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]), faces, identity };
}

const a = s58Poly(PARENT.m, PARENT.r0, PARENT.r1, PARENT.Cp);
const prof = s58Radius(a, PARENT.LD);

const CASES = [
  { fam: 'RADIAL', label: 'circle (control)', shape: SHAPES.circle() },
  { fam: 'ELLIPTICAL', label: 'ellipse k=1.5', shape: SHAPES.ellipse(1.5) },
  { fam: 'ELLIPTICAL', label: 'ellipse k=2.0', shape: SHAPES.ellipse(2.0) },
  { fam: 'ELLIPTICAL', label: 'ellipse k=3.0', shape: SHAPES.ellipse(3.0) },
  { fam: 'ELLIPTICAL', label: 'ellipse k=5.0', shape: SHAPES.ellipse(5.0) },
  { fam: 'SUPERELLIPSE', label: 'superellipse n=3', shape: SHAPES.superellipse(3) },
  { fam: 'SUPERELLIPSE', label: 'superellipse n=4', shape: SHAPES.superellipse(4) },
  { fam: 'SUPERELLIPSE', label: 'superellipse n=6', shape: SHAPES.superellipse(6) },
  { fam: 'SUPERELLIPSE', label: 'superellipse n=10', shape: SHAPES.superellipse(10) },
  { fam: 'SUPERELLIPSE', label: 'superellipse n=20 (near-square)', shape: SHAPES.superellipse(20) },
];

console.log('\nITEM 3 — ADVERSARIAL SECTION SHAPES (spec 87)');
console.log('  A(x) held IDENTICAL across every row; only the SECTION SHAPE varies.');
console.log('  Frontal area matched by construction. Only WETTED area differs.');
console.log(`  L = ${L_M} m, ${SPEED} km/h, ${RINGS} rings x ${NAZ} azimuths, authored surface (no global hull).`);
console.log('  Frozen calibration. Diagnostic only. Nothing altered.\n');

console.log('  case                        proxy      Cd       press    fric     class    elig         ' +
  'F1      F2a    F3      F4      F5      wetted     dPx%  conf');
const out = [];
for (const c of CASES) {
  const s = build((X) => prof.r(X), c.shape, prof.half, `authored-lathe(${c.label})`);
  const r = evaluate(s, { label: c.label, lengthM: L_M, speedKmh: SPEED });
  out.push({ ...c, r });
  console.log(`  ${c.label.padEnd(27)} ${r.scalar.compositeV1.toFixed(6)} ${r.cd.value.toFixed(5)}  ` +
    `${r.cd.pressure.toFixed(5)}  ${r.cd.friction.toFixed(5)}  ${r.scalar.cls.padEnd(8)} ` +
    `${r.ribbon.eligibility.padEnd(12)} ${r.ribbon.F1.toFixed(4)} ${r.ribbon.F2a.toFixed(3).padStart(6)} ` +
    `${r.ribbon.F3.toFixed(4)} ${r.ribbon.F4.toFixed(4)} ${r.ribbon.F5.toFixed(4)} ` +
    `${Math.round(r.geometry.wettedArea).toLocaleString().padStart(9)}  ` +
    `${(100 * r.sensitivity.dProxy).toFixed(1).padStart(4)}  ${r.ood.confidence}`);
}

/* ---- the pre-registered predictions, checked ---- */
const ctl = out[0].r;
console.log('\n  PRE-REGISTERED PREDICTIONS (spec 87.2), checked:');
const pxSpread = Math.max(...out.map((o) => o.r.scalar.compositeV1)) - Math.min(...out.map((o) => o.r.scalar.compositeV1));
const pxRel = pxSpread / ctl.scalar.compositeV1;
console.log(`    P1 scalar invariant to section shape at fixed A(x):`);
console.log(`       proxy spread ${pxSpread.toExponential(2)} = ${(100 * pxRel).toFixed(2)}% of the control` +
  `   -> ${pxRel < 0.02 ? 'HOLDS' : 'FAILS'}`);
const classes = [...new Set(out.map((o) => o.r.scalar.cls))];
console.log(`       classes present: ${classes.join(', ')}  -> ${classes.length === 1 ? 'HOLDS' : 'FAILS'}`);

const pressSpread = Math.max(...out.map((o) => o.r.cd.pressure)) - Math.min(...out.map((o) => o.r.cd.pressure));
const fricSpread = Math.max(...out.map((o) => o.r.cd.friction)) - Math.min(...out.map((o) => o.r.cd.friction));
console.log(`    P2 Cd moves only through friction / wetted area:`);
console.log(`       pressure spread ${pressSpread.toExponential(2)}   friction spread ${fricSpread.toExponential(2)}` +
  `   -> ${fricSpread > 10 * pressSpread ? 'HOLDS' : 'FAILS'}`);

const ell = out.filter((o) => o.fam === 'ELLIPTICAL');
const f5rising = ell.every((o, i) => i === 0 || o.r.ribbon.F5 >= ell[i - 1].r.ribbon.F5 - 1e-12);
console.log(`    P3 F5 rises with ellipse aspect ratio:`);
console.log(`       F5 ${ctl.ribbon.F5.toFixed(4)} -> ${ell.map((o) => o.r.ribbon.F5.toFixed(4)).join(' -> ')}` +
  `   -> ${f5rising && ell[ell.length - 1].r.ribbon.F5 > ctl.ribbon.F5 ? 'HOLDS' : 'FAILS'}`);

const sup = out.filter((o) => o.fam === 'SUPERELLIPSE');
const supF5max = Math.max(...sup.map((o) => o.r.ribbon.F5));
console.log(`    P4 F5 is BLIND to superellipses (180-degree symmetry), despite gross shape change:`);
console.log(`       worst superellipse F5 ${supF5max.toFixed(4)} vs control ${ctl.ribbon.F5.toFixed(4)}` +
  `   -> ${supF5max < 0.05 ? 'HOLDS — F5 sees nothing' : 'FAILS — F5 does see it'}`);

/* ---- so WHAT does distinguish them? ---- */
console.log('\n  IF THE SCALAR IS BLIND, WHAT IS NOT? (the item-3 question)');
console.log('    case                        wetted vs control   Cd vs control   elig / E4 shift      OOD');
for (const o of out) {
  const dW = (o.r.geometry.wettedArea / ctl.geometry.wettedArea - 1) * 100;
  const dCd = (o.r.cd.value / ctl.cd.value - 1) * 100;
  console.log(`    ${o.label.padEnd(27)} ${dW >= 0 ? '+' : ''}${dW.toFixed(2)}%` .padEnd(20) +
    `  ${dCd >= 0 ? '+' : ''}${dCd.toFixed(2)}%`.padEnd(16) +
    `  ${o.r.ribbon.eligibility.padEnd(11)} ${(100 * o.r.ribbon.checks.e4Shift).toFixed(2)}%` .padEnd(21) +
    `  ${o.r.ood.confidence}`);
}

console.log('\n  Frozen calibration. No knot, convention, estimator, classifier or ribbon change.\n');
