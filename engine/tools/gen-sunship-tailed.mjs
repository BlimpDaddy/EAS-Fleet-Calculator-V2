/**
 * SUNSHIP TAILED VARIANT — generates the DEPLOYED-fairing dynamics record.
 *
 * WHY A VARIANT AND NOT A REPLACEMENT (Toby ruling 2026-08-18): the tail
 * RETRACTS. The ship genuinely has two geometric states, and the Smart
 * Tail toggle already exists to express exactly that. So the bare record
 * — and every one of the ~30 pinned references to the 300 m envelope's
 * frontal 40,522 / wetted 206,795 — stays untouched, and this record is
 * purely additive, reached only when the tail is deployed.
 *
 * ENVELOPE vs TOTAL: the 300 m the user sets is the ENVELOPE, nose to
 * rear of envelope, tail stowed. The deployed aero body is longer, so the
 * record carries `envelopeFraction` = envelope / total, and the page
 * scales by lengthM / envelopeFraction to keep the ENVELOPE on the
 * slider's number.
 *
 * Run from CalcV2:  node tools/gen-sunship-tailed.mjs
 * Writes src/sunshipTailed.js (generated — do not hand-edit). Lives in
 * src/ now that the page imports it; it was held in lab/ while unwired
 * so the bake could not ship dead code.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';
import { measureSectionalProxy } from '../src/cdEstimator.js';

const here = dirname(fileURLToPath(import.meta.url));
const HULL = join(here, '..', '..', '..', '3D OBJ', 'Sunship.obj');
const ENVELOPE_M = 300;            // the ruled meaning of "ship length"
const EXTRA_M = 216, ATTACH = 0.80, P_EXP = 0.8;
// Converged discretisation (sweep 2026-08-19, lab/sunship-tail-truesurface.mjs):
// Cd stable to 4 dp for RINGS>=256, STATIONS>=128, SEGS 48-288.
const RINGS = 512, SEGS = 96, STATIONS = 192;
const AXES = ['X', 'Y', 'Z'];
const SIGNED = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

const hullBuf = readFileSync(HULL);
const objSha256 = createHash('sha256').update(hullBuf).digest('hex');
const hull = parseObjMesh(hullBuf.toString('utf8'));
if (!hull.faces.length) throw new Error('gen-sunship-tailed: source hull has no faces — HARD ERROR, never a silent fallback');

/* ---- build the deployed body from the hull's TRUE SECTIONS ---- */
const zs = hull.verts.map((v) => v[2]);
const zMin = Math.min(...zs), zMax = Math.max(...zs);
const sc = ENVELOPE_M / (zMax - zMin);
const P3 = hull.verts.map((v) => [v[0] * sc, v[1] * sc, (v[2] - zMin) * sc]);

/** The hull's real outline at station z, by plane-triangle intersection —
 *  exact regardless of how coarse the source mesh is. */
function outlineAt(z) {
  const segs = [];
  for (const tri of hull.faces) {
    const q = tri.map((k) => P3[k]);
    const d = q.map((v) => v[2] - z);
    const hits = [];
    for (let e = 0; e < 3; e++) {
      const a = q[e], b = q[(e + 1) % 3], da = d[e], db = d[(e + 1) % 3];
      if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
        const t = da / (da - db);
        hits.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    if (hits.length === 2) segs.push(hits);
  }
  const out = new Float64Array(SEGS);
  for (let s = 0; s < SEGS; s++) {
    const th = -Math.PI + (2 * Math.PI * s) / SEGS;
    const cx = Math.cos(th), cy = Math.sin(th);
    let best = 0;
    for (const [A, B] of segs) {
      const ex = B[0] - A[0], ey = B[1] - A[1];
      const den = cx * ey - cy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const u = (A[0] * ey - A[1] * ex) / den;
      const v = (A[0] * cy - A[1] * cx) / den;
      if (u > best && v >= 0 && v <= 1) best = u;
    }
    out[s] = best;
  }
  return out;
}
const dxS = ENVELOPE_M / STATIONS;
const rHull = [];
for (let i = 0; i < STATIONS; i++) rHull.push(outlineAt((i + 0.5) * dxS));

const iA = Math.min(STATIONS - 1, Math.round((ATTACH * ENVELOPE_M) / dxS - 0.5));
const xA = (iA + 0.5) * dxS, xTip = ENVELOPE_M + EXTRA_M;
/** Outline at x, INTERPOLATED between stations. Nearest-station snapping
 *  makes the surface piecewise-constant and its wetted area grows without
 *  bound with ring count — the defect that made the previous record's
 *  wetted area a function of its own discretisation. */
const shapeAt = (x) => {
  if (x <= xA) {
    const t = Math.max(0, Math.min(STATIONS - 1.0001, x / dxS - 0.5));
    const i = Math.floor(t), fr = t - i, jj = Math.min(STATIONS - 1, i + 1);
    const a = rHull[i], b = rHull[jj];
    return Array.from({ length: SEGS }, (_, k) => a[k] * (1 - fr) + b[k] * fr);
  }
  if (x >= xTip) return null;
  const k = Math.pow((xTip - x) / (xTip - xA), P_EXP);
  return Array.from(rHull[iA], (r) => r * k);
};
const verts = [], faces = [], ringStart = [];
for (let i = 0; i <= RINGS; i++) {
  const x = (xTip * i) / RINGS;
  const shape = shapeAt(x);
  if (!shape || Math.max(...shape) < 1e-6) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
  ringStart.push(verts.length);
  for (let s = 0; s < SEGS; s++) {
    const th = -Math.PI + (2 * Math.PI * s) / SEGS;
    verts.push([x, shape[s] * Math.cos(th), shape[s] * Math.sin(th)]);
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
const mesh = { verts, faces };

const per = {};
for (const ax of AXES) per[ax] = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: ax });
const raw = {
  extents: per.Z.extents,
  frontalRaw: { X: per.X.frontalArea, Y: per.Y.frontalArea, Z: per.Z.frontalArea },
  wettedRaw: per.Z.wettedArea,
  hullRaw: per.Z.hullArea,
  meshRaw: per.Z.meshArea,
  wettedSource: per.Z.wettedSource,
  volumeRaw: per.Z.volume,
  volumeSource: per.Z.volumeSource,
  warnings: per.Z.warnings,
};
const proxies = {};
for (const ax of SIGNED) {
  const p = measureSectionalProxy(mesh.verts, mesh.faces, { axis: ax });
  if (!Number.isFinite(p.proxy)) throw new Error(`gen-sunship-tailed: proxy NaN on ${ax} — HARD ERROR`);
  proxies[ax] = { proxy: p.proxy, cls: p.cls, triggers: p.triggers, oddFraction: p.quality ? p.quality.oddFraction : null };
}
// The hull is lathed along +X, so its total length is the X extent.
const totalRaw = per.X.extents[0];
const envelopeFraction = ENVELOPE_M / (ENVELOPE_M + EXTRA_M);   // the authored geometry
const j = (x) => JSON.stringify(x);

const out = `/**
 * SUNSHIP TAILED — GENERATED by tools/gen-sunship-tailed.mjs. Do not hand-edit.
 *
 * The Sunship with its Smart Tail DEPLOYED: the aero fairing picked up at
 * 80% of the envelope, profile exponent 0.8, extending 216 m beyond it.
 *
 * BUILT FROM THE HULL'S TRUE SECTION SHAPE (r20 send-back, closed
 * 2026-08-19). The previous version replaced each station's cross-
 * sectional AREA with an equal-area CIRCLE and lathed the result — an
 * axisymmetric surrogate, not the Sunship. This one samples the hull's
 * real outline r(x, theta) by plane-triangle intersection, so the body
 * keeps the Sunship's actual wider-than-tall sections, and the fairing
 * inherits that outline scaled by the profile rather than becoming a cone
 * of revolution. Cost of the correction: Cd 0.0215 -> 0.0221 (+2.8%),
 * wetted 253,919 -> 266,094 m2 (+4.8%). The surrogate was optimistic.
 *
 * Outlines are INTERPOLATED between stations, not snapped to the nearest.
 * Snapping makes the surface piecewise-constant in x, so wetted area grows
 * without bound with ring count (measured 266,518 -> 286,302 m2 from 128
 * to 1024 rings, still climbing) — the old record's wetted area was partly
 * a function of its own discretisation. Converged settings below.
 *
 * ATTACHMENT IS RADIUS-CONTINUOUS, NOT TANGENTIAL, and deliberately so.
 * Solving the profile exponent for C1 continuity with the hull gives
 * P = 2.4, and that tail is aerodynamically ruinous: proxy 0.674, Cd 0.154,
 * seven times worse. A single power law cannot be both tangent and a good
 * fairing, so P = 0.8 stays as an AERODYNAMIC choice. Earlier docs claiming
 * tangency were wrong; implementing it as claimed would have been worse.
 *
 * PAIRS WITH the bare record in presetDynamics.js — the tail RETRACTS, so
 * the ship has two geometric states and the Smart Tail toggle selects
 * between them. The bare record is untouched.
 *
 * envelopeFraction: the user's "ship length" is the ENVELOPE. Scale this
 * record by lengthM / envelopeFraction so the ENVELOPE lands on the
 * slider's number and the fairing extends beyond it.
 */
export const SUNSHIP_TAILED = Object.freeze({
  sourceHull: '3D OBJ/Sunship.obj',
  objSha256: ${j(objSha256)},
  defaultAxis: '+X',
  envelopeFraction: ${envelopeFraction.toFixed(6)},
  deployedOverEnvelope: ${(1 / envelopeFraction).toFixed(6)},
  raw: Object.freeze(${j(raw)}),
  proxies: Object.freeze(${j(proxies)}),
});
`;
writeFileSync(join(here, '..', 'src', 'sunshipTailed.js'), out);
console.log(`wrote src/sunshipTailed.js`);
console.log(`  sha256           ${objSha256.slice(0, 16)}…`);
console.log(`  raw X extent     ${totalRaw.toFixed(4)} (mesh units)`);
console.log(`  envelopeFraction ${envelopeFraction.toFixed(6)}  (deployed = ${(1 / envelopeFraction).toFixed(4)} x envelope)`);
console.log(`  proxy +X         ${proxies['+X'].proxy.toFixed(6)}  class ${proxies['+X'].cls}`);
console.log(`  oddFraction      ${proxies['+X'].oddFraction}`);
