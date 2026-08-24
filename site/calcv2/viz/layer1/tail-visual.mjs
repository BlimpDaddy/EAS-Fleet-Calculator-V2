/**
 * THE DESIGN-INTENT TAIL — shared shell builder (extracted from
 * run-payloads' buildCompositeExtended, 2026-08-24, so the node runner
 * and the browser payload worker loft the SAME tail).
 *
 * VISUAL TAIL SHAPE (owner ruling, Toby 2026-08-22): a small concave
 * cone off the hull's aft collapsing to a long thin spike — NOT the
 * tadpole fairing surrogate. Owner rounds same day: fuller base
 * (coneEndFrac 0.10→0.15→0.18, coneP 2.0→1.8→1.5), and the whole
 * assembly LIFTED (liftFrac): smoothstep vertical offset, 0 at the
 * attach ring → liftFrac × hull max radius from the hull end on — the
 * tail floats over the top of the body, per the irl design. REVERT
 * lift = liftFrac 0.
 *
 * E+A+S PASTE RULING (owner, 2026-08-24: the generic fairing "looks
 * weird compared to the one we've settled on… can't we just 'paste'
 * this tail onto anything/everything, even if it's absurd? washing
 * machine would be funny with one just to highlight the point"): the
 * engineer-unlock visual is THIS design at the Sunship's authored
 * proportions on ANY body — always accepted, deliberately absurd
 * elsewhere (the bottle principle as comedy). The generic-tail RULE
 * (tail-rule.mjs) is untouched estimator-land machinery and keeps its
 * sealed G4 gate; only the E+A+S VISUAL uses the paste.
 */
import { makeSupportSkin, supportRadii } from '../../spike/sectional/support-skin.mjs';

export const TAIL_VISUAL = Object.freeze({
  coneEndFrac: 0.18,     // cone collapses to the spike by hull-end + this × extra length
  coneP: 1.5,            // concave profile exponent (r'' > 0 — trumpet flank)
  spikeFrac: 0.035,      // spike radius as a fraction of the attach-ring radius
  liftFrac: 0.10,        // vertical lift × hull max radius (owner 2026-08-22)
});

/* the Sunship's authored proportions (spike/sectional/smart-tail.mjs
   BASELINE: attach 0.80, extraM 216 at 300 m → 0.72 × length), copied
   as plain constants so the browser worker never imports the fs-bound
   smart-tail module. Provenance fixed to those authored values. */
export const DESIGN_TAIL_GENERIC = Object.freeze({
  attachFrac: 0.80,
  extraFrac: 0.72,
});

/**
 * Loft the design tail onto a body: returns a COPY of the body mesh with
 * the grafted shell (rings of the body's own attach-ring section under
 * the taper law, hull-wrapped over the body's aft so the body never
 * pokes through, lifted, closed at base and tip).
 *
 * @param retracted {verts, faces}  payload-frame body mesh
 * @param xA        attach-ring station (m)
 * @param xHullEnd  the body's aft end (m)
 * @param xTip      the deployed tail tip (m)
 */
export function buildDesignTailShell(retracted, { xA, xHullEnd, xTip }) {
  const SEGS = 64, RINGS = 160;
  const skin = makeSupportSkin(retracted.verts, retracted.faces, { sx: 0.005, thDeg: 2 });
  const iA = skin.xs.reduce((best, x, i) => (Math.abs(x - xA) < Math.abs(skin.xs[best] - xA) ? i : best), 0);
  const az = Array.from({ length: SEGS }, (_, s) => -Math.PI + (2 * Math.PI * s) / SEGS);
  const section = supportRadii(skin, iA, az).r;

  const verts = retracted.verts.map((p) => [...p]);
  const faces = retracted.faces.map((f) => [...f]);
  const base = verts.length;
  const ringStart = [];
  const { coneEndFrac, coneP, spikeFrac, liftFrac } = TAIL_VISUAL;
  const xCone = xHullEnd + coneEndFrac * (xTip - xHullEnd);    // cone → spike handoff
  const liftM = liftFrac * Math.max(...retracted.verts.map((p) => Math.hypot(p[1], p[2])));
  const yC = (x) => {
    const t = Math.min(1, Math.max(0, (x - xA) / (xHullEnd - xA)));
    return liftM * t * t * (3 - 2 * t);
  };
  const tau = (x) => {
    if (x <= xCone) {                                          // concave cone (trumpet flank)
      const t = (xCone - x) / (xCone - xA);
      return spikeFrac + (1 - spikeFrac) * Math.pow(Math.max(0, t), coneP);
    }
    return spikeFrac * ((xTip - x) / (xTip - xCone));          // long thin spike to a point
  };
  for (let j = 0; j <= RINGS; j++) {
    const x = xA + ((xTip - xA) * j) / RINGS;
    if (tau(x) < 1e-4) { ringStart.push(verts.push([x, yC(x), 0]) - 1); continue; }
    /* the fairing WRAPS the remaining hull: over the body's own aft the
       ring takes max(taper, hull section) so the composite surface is
       continuous — the body can never poke through the tail */
    let hullSec = null;
    if (x <= xHullEnd) {
      const ix = skin.xs.reduce((best, xv, i) => (Math.abs(xv - x) < Math.abs(skin.xs[best] - x) ? i : best), 0);
      hullSec = supportRadii(skin, ix, az).r;
    }
    ringStart.push(verts.length);
    for (let s = 0; s < SEGS; s++) {
      const R = Math.max(section[s] * tau(x), hullSec ? hullSec[s] : 0);
      verts.push([x, yC(x) + R * Math.cos(az[s]), R * Math.sin(az[s])]);
    }
  }
  const ringSize = (j) => (j < RINGS ? ringStart[j + 1] - ringStart[j] : verts.length - ringStart[j]);
  for (let j = 0; j < RINGS; j++) {
    const a = ringStart[j], b = ringStart[j + 1];
    const aPole = ringSize(j) === 1, bPole = ringSize(j + 1) === 1;
    if (aPole && bPole) continue;
    for (let s = 0; s < SEGS; s++) {
      const s1 = (s + 1) % SEGS;
      if (aPole) faces.push([a, b + s, b + s1]);
      else if (bPole) faces.push([a + s, b, a + s1]);
      else { faces.push([a + s, b + s, b + s1]); faces.push([a + s, b + s1, a + s1]); }
    }
  }
  /* close the graft's base ring (fan to its centroid) — it sits ON the
     body surface at the attach ring */
  const cen = verts.push([xA, 0, 0]) - 1;
  for (let s = 0; s < SEGS; s++) faces.push([cen, base + ((s + 1) % SEGS), base + s]);

  return { verts, faces };
}

/** The design tail at the authored GENERIC proportions on any body. */
export function buildPastedDesignTail(retracted) {
  const xs = retracted.verts.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), L = x1 - x0;
  return buildDesignTailShell(retracted, {
    xA: x0 + DESIGN_TAIL_GENERIC.attachFrac * L,
    xHullEnd: x1,
    xTip: x1 + DESIGN_TAIL_GENERIC.extraFrac * L,
  });
}
