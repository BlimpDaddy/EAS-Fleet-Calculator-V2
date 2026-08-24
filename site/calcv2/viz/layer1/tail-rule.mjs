/**
 * GENERIC TAIL RULE — the canonical rule proven in `lab/tail-any-shape.mjs`,
 * ported here per the sealed plan (§2.1, round-3 F1). One fixed, dumb
 * construction with no shape-specific cases: take the body's own measured
 * radius profile, pick the fairing up at 80% of the length (matching RADIUS
 * only — radius-continuous, not tangential), taper to a point over another
 * 72% of the length, exponent 0.8.
 *
 * THIS BUILDS VISUAL GEOMETRY ONLY. Smart Tail availability and its
 * numerical effect belong to the page (`DYNAMIC-SPEC.md` §5.4 is the Cd
 * term, not a geometry source) and are NEVER gated by anything here. A
 * refusal below means "no tail picture", never "no tail toggle".
 *
 * THE REFUSAL is the lab's observed self-detection made explicit: the
 * construction assumes the body is already CLOSING at the attach point.
 * Where it is not, the fairing starts narrower than the hull it should wrap
 * and cuts into it. We test that directly: if the hull's own radius beyond
 * the attach station exceeds the fairing radius (beyond a small declared
 * tolerance), the rule refuses. (In the lab this surfaced downstream as a
 * self-intersecting mesh the production estimator refused unaided.)
 *
 * Input mesh must already be in the payload frame: +X flight, metres.
 */
import { measureSections } from '../../src/sections.js';

export const TAIL_RULE = Object.freeze({
  attach: 0.80,          // pick-up point, fraction of body length
  extraFrac: 216 / 300,  // fairing length as a fraction of body length (the Sunship's own)
  P: 0.8,                // taper exponent
  RINGS: 320,
  SEGS: 64,
  STATIONS: 256,
  cutInTolFrac: 0.005,   // × attach radius — below this, overlap is measurement noise
});

/**
 * @param verts,faces  the body's mesh, payload frame (+X flight), metres
 * @returns {refused:true, reason} | {refused:false, verts, faces, xTipM, rAttachM}
 */
export function buildGenericTailBody(verts, faces) {
  const { attach, extraFrac, P, RINGS, SEGS, STATIONS, cutInTolFrac } = TAIL_RULE;
  const m = measureSections(verts, faces, { axis: '+X', STATIONS });
  const N = m.A.length, L = m.L, x0 = m.minX, dx = L / N;
  const rHull = Array.from(m.A, (a) => Math.sqrt((a * m.cell * m.cell) / Math.PI));

  const ia = Math.min(N - 1, Math.round((attach * L) / dx - 0.5));
  const ra = rHull[ia];
  if (!(ra > 0)) return { refused: true, reason: 'no measurable radius at the attach station' };
  const xA = (ia + 0.5) * dx;                    // distance from nose
  const extraM = extraFrac * L;
  const xTip = L + extraM;                       // distance from nose

  const radiusAt = (xn) => (xn <= xA
    ? rHull[Math.min(N - 1, Math.max(0, Math.round(xn / dx - 0.5)))]
    : (xn < xTip ? ra * Math.pow((xTip - xn) / (xTip - xA), P) : 0));

  /* refusal: the fairing must WRAP the body it grafts onto */
  const tol = cutInTolFrac * ra;
  for (let i = ia + 1; i < N; i++) {
    const xn = (i + 0.5) * dx;
    if (rHull[i] > radiusAt(xn) + tol) {
      return { refused: true, reason: `body not closing at the attach point: hull radius ${rHull[i].toFixed(2)} m exceeds fairing ${radiusAt(xn).toFixed(2)} m at ${(100 * xn / L).toFixed(0)}% of length` };
    }
  }

  /* lathe — identical structure to the lab script and smart-tail.mjs */
  const outV = [], outF = [], ringStart = [];
  for (let i = 0; i <= RINGS; i++) {
    const xn = (xTip * i) / RINGS;
    const r = Math.max(radiusAt(xn), 0);
    const x = x0 + xn;
    if (r < 1e-6) { ringStart.push(outV.push([x, 0, 0]) - 1); continue; }
    ringStart.push(outV.length);
    for (let s = 0; s < SEGS; s++) {
      const th = (2 * Math.PI * s) / SEGS;
      outV.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
  }
  const ringSize = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : outV.length - ringStart[i]);
  for (let i = 0; i < RINGS; i++) {
    const a = ringStart[i], b = ringStart[i + 1];
    const aPole = ringSize(i) === 1, bPole = ringSize(i + 1) === 1;
    if (aPole && bPole) continue;
    for (let s = 0; s < SEGS; s++) {
      const s1 = (s + 1) % SEGS;
      if (aPole) outF.push([a, b + s, b + s1]);
      else if (bPole) outF.push([a + s, b, a + s1]);
      else { outF.push([a + s, b + s, b + s1]); outF.push([a + s, b + s1, a + s1]); }
    }
  }
  return { refused: false, verts: outV, faces: outF, xTipM: x0 + xTip, rAttachM: ra };
}
