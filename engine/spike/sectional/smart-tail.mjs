/**
 * SMART TAIL GENERATOR — spec 84.1 / 84.2, extracted from
 * `CalcV2/lab/sunship-tail-aerohull.mjs` so a sweep can call it as a function.
 *
 * THE BASELINE IS THE STORED SURROGATE, NOT A RE-DERIVATION. At the baseline
 * parameters this must reproduce `lab/sunship-tail-aerohull-candidate.obj`
 * byte-for-byte — gate G0 in `run-smart-tail-g0.mjs`. Every line below that
 * differs from the lab script is therefore a bug, not an improvement, and the
 * gate is what says so.
 *
 * THE PROFILE, with `s = (x - xA)/(xTip - xA)` and `t = 1 - s`:
 *
 *   r(x <= xA)  = the envelope's own measured radius
 *   r(x >  xA)  = [ rTip + (ra - rTip) * t^P ] * (1 + W*sin(pi*s))
 *
 * `W = 0` and `rTip = 0` collapse this to the lab script's `ra * t^P` exactly,
 * which is what makes G0 possible at all. 84.2:
 *
 *   - the `sin(pi*s)` bump VANISHES AT BOTH ENDS, so `W` moves the middle of
 *     the fairing and touches neither the attach radius nor the tip;
 *   - the `rTip` blend preserves `r(xA) = ra` identically, so it moves the tip
 *     and nothing else.
 *
 * THE TIP RETURNS rTip, NOT ZERO — 82.5's lesson applied before it could bite a
 * second time. The lab script returns 0 at and beyond xTip, which is right when
 * the profile closes to a point but would have made `rTip` a NULLITY: the last
 * ring would collapse to a pole and every "base" variant would in fact have been
 * a cone tapering to nothing over one ring spacing (1.6 m). That is exactly the
 * defect 82.5 caught in the generic base family. At the baseline rTip = 0, so
 * this returns 0 and the mesh is unchanged — which is why G0 still holds.
 *
 * THE GENERATOR DOES NOT CAP ANYTHING. The stored surrogate has an open ring at
 * the nose (80.1) and, with rTip > 0, there is an open ring at the base too.
 * Closing them here would break G0 and would move mesh completion out of the
 * one place that is authorised to do it. Both are closed downstream by
 * `capOpenRings`, TIP-ONLY inside the frozen 2.5% band (80.2), with every cap
 * counted and reported (S3).
 *
 * RECORDED, unchanged from r20: the graft matches RADIUS at the attach point
 * and nothing else. THE SLOPE IS NOT MATCHED — this is radius-continuous, not
 * tangential. Earlier wording claiming tangency was wrong.
 *
 * G0b: this file imports the CalcV1-site copy of the engine, because that is
 * what production serves. The lab script imports `CalcV2/src`. The two are
 * byte-identical today and the gate asserts it.
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../../../site/calcv2/src/obj.js';
import { measureSections } from '../../../site/calcv2/src/sections.js';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
export const SUNSHIP_OBJ = `${ROOT}3D OBJ/Sunship.obj`;
export const CANDIDATE_OBJ = `${ROOT}CalcV2/lab/sunship-tail-aerohull-candidate.obj`;

/** the lab script's fixed quantities — NOT swept */
export const FIXED = { LENGTH_M: 300, RINGS: 320, SEGS: 64, STATIONS: 256 };

/** 84.1 baseline: the stored surrogate's own parameters */
export const BASELINE = { extraM: 216, attach: 0.80, P: 0.8, W: 0, rTip: 0 };

let ENVELOPE = null;
/** the envelope's measured radius profile, computed once (deterministic) */
export function envelopeProfile() {
  if (ENVELOPE) return ENVELOPE;
  const mesh = parseObjMesh(readFileSync(SUNSHIP_OBJ, 'utf8'));
  const m = measureSections(mesh.verts, mesh.faces, { axis: '+Z', STATIONS: FIXED.STATIONS });
  const N = m.A.length, scale = FIXED.LENGTH_M / m.L, cellM = m.cell * scale;
  ENVELOPE = {
    N, dx: FIXED.LENGTH_M / N,
    r: Array.from(m.A, (a) => Math.sqrt((a * cellM * cellM) / Math.PI)),
  };
  return ENVELOPE;
}

/**
 * @param  {{extraM,attach,P,W,rTip}} p   rTip is a FRACTION OF ra, per 84.6
 * @return {{verts,faces,identity,params,geom,validity}}
 */
export function buildSmartTail(opts = {}) {
  const p = { ...BASELINE, ...opts };
  const { N, dx, r: rHull } = envelopeProfile();
  const { LENGTH_M, RINGS, SEGS } = FIXED;

  const ia = Math.min(N - 1, Math.round((p.attach * LENGTH_M) / dx - 0.5));
  const ra = rHull[ia], xA = (ia + 0.5) * dx, xTip = LENGTH_M + p.extraM;
  const rTipM = p.rTip * ra;

  const radiusAt = (x) => {
    if (x <= xA) return rHull[Math.min(N - 1, Math.max(0, Math.round(x / dx - 0.5)))];
    if (x >= xTip) return rTipM;   // 82.5's lesson: a base must actually BE there
    const s = (x - xA) / (xTip - xA), t = 1 - s;
    const core = rTipM + (ra - rTipM) * Math.pow(t, p.P);
    return core * (1 + p.W * Math.sin(Math.PI * s));
  };

  /* ---- lathe to a closed mesh along +X. Identical structure to the lab script ---- */
  const verts = [], faces = [], ringStart = [];
  for (let i = 0; i <= RINGS; i++) {
    const x = (xTip * i) / RINGS;
    const r = Math.max(radiusAt(x), 0);
    if (r < 1e-6) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
    ringStart.push(verts.length);
    for (let s = 0; s < SEGS; s++) {
      const th = (2 * Math.PI * s) / SEGS;
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
  }
  const ringSize = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
  for (let i = 0; i < RINGS; i++) {
    const a = ringStart[i], b = ringStart[i + 1];
    const aPole = ringSize(i) === 1, bPole = ringSize(i + 1) === 1;
    if (aPole && bPole) continue;
    for (let s = 0; s < SEGS; s++) {
      const s1 = (s + 1) % SEGS;
      if (aPole) faces.push([a, b + s, b + s1]);
      else if (bPole) faces.push([a + s, b, a + s1]);
      else { faces.push([a + s, b + s, b + s1]); faces.push([a + s, b + s1, a + s1]); }
    }
  }

  return {
    verts, faces,
    identity: 'authored-smart-tail(formula)',
    params: { ...p, ra, xA, xTip, rTipM },
    validity: checkValidity(radiusAt, { ra, xA, xTip, rHull, RINGS }),
  };
}

/**
 * 84.6 V1–V3, checked on the SAME stations the lathe uses plus a finer probe.
 * Reported, never silently fixed.
 *
 *   V1  r finite and >= 0 everywhere
 *   V2  the fairing never exceeds the envelope's own maximum radius
 *   V3  no monotonicity requirement — a flare is deliberately non-monotone
 *   +   SELF-INTERSECTION: for a lathe this is exactly "r < 0 somewhere", and
 *       separately a step in r so large the surface folds; both are measured.
 */
function checkValidity(radiusAt, { ra, xA, xTip, rHull, RINGS }) {
  const rMaxEnv = Math.max(...rHull);
  const probe = 4 * RINGS;                     // finer than the mesh, to catch dips between rings
  let minR = Infinity, maxFairing = 0, nonFinite = 0, worstStep = 0;
  let prev = null;
  for (let i = 0; i <= probe; i++) {
    const x = (xTip * i) / probe;
    const r = radiusAt(x);
    if (!Number.isFinite(r)) { nonFinite++; continue; }
    if (r < minR) minR = r;
    if (x > xA && r > maxFairing) maxFairing = r;
    if (prev !== null) worstStep = Math.max(worstStep, Math.abs(r - prev));
    prev = r;
  }
  const dxProbe = xTip / probe;
  return {
    minRadius: minR,
    negativeRadius: minR < 0,
    nonFinite,
    maxFairingRadius: maxFairing,
    envelopeMaxRadius: rMaxEnv,
    fairingExceedsEnvelope: maxFairing > rMaxEnv,
    /* a lathe folds on itself only if |dr/dx| is unbounded; report the worst slope */
    worstSlope: worstStep / dxProbe,
    ok: minR >= 0 && nonFinite === 0 && maxFairing <= rMaxEnv,
  };
}

/** the lab script's exact OBJ serialisation — G0 compares against this */
export function toObj(surface, header) {
  let s = header;
  for (const v of surface.verts) s += `v ${v[0].toFixed(5)} ${v[1].toFixed(5)} ${v[2].toFixed(5)}\n`;
  for (const f of surface.faces) s += `f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1}\n`;
  return s;
}
