/**
 * TR-397 SENSITIVITY RUN #2 — BARE-HULL RECONSTRUCTION (2026-08-16).
 * Prescribed by the r14 interim review: the exam #1 FIN-CLIP rule is
 * not neutral — it leaves an artificial constant-radius plateau
 * followed by an abrupt collapse (e.g. Los Angeles 83–92%L, TC
 * 75–88%L), and the estimator's aft term penalises local closure
 * slope to the FOURTH power, so a plateau-then-cliff artifact can
 * materially inflate the proxy. This run reconstructs the bare hull
 * SMOOTHLY through the fin-obscured region and re-examines.
 *
 * DISCIPLINE: tr397.mjs (exam #1) stays FROZEN as historical evidence —
 * its rules forbade changing traces after seeing results, so this is a
 * separately-declared SENSITIVITY, not a revision. No calibration
 * changes here either; vNEXT2 remains HELD pending r14's verdict on
 * these numbers.
 *
 * RECONSTRUCTION RULE (geometry-only, declared BEFORE computing any
 * result; no drag value enters the reconstruction):
 *  1. The fin-obscured interval is detected from GEOMETRY alone: the
 *     contiguous stations where the RAWFINS trace exceeds the clipped
 *     hull trace by more than 2% of the hull's max radius (i.e. where
 *     fins visibly leave the hull line), plus every plateau station the
 *     exam-1 clip manufactured inside that span.
 *  2. Those stations are DELETED, and the hull is bridged by the same
 *     monotone cubic (Fritsch–Carlson pchip) the lathe already uses,
 *     from the last clean pre-fin ordinate to the first clean post-fin
 *     ordinates (the visible tail cone aft of the fins + the tip).
 *     Monotone cubic cannot overshoot and preserves the closure trend —
 *     the plateau-then-cliff becomes a smooth taper.
 *  3. Everything else is identical to exam #1: same anchoring to
 *     published L and D, same lathe, same frozen estimator, same
 *     published Reynolds numbers, same exact frontal conversion.
 *
 * (The reviewer's "published bare-hull offsets where they exist" remains
 * the escalation path — TR-397's reference 1 (NACA TR-318) may carry
 * Los Angeles offsets, and the ZMC-2 is described analytically in the
 * report ("forward portion an ellipsoid, after portion a hyperboloid");
 * neither is consumed here. This run is the uniform bridge rule only.)
 *
 * Run from CalcV2: `node spike/sectional/tr397-recon.mjs`
 */
import { measureSectionalProxy, calibratePressure } from '../../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf } from '../../src/dynamicsCore.js';
import { latheProfile, pchip } from './tn614-bodies.mjs';
import { SHIPS, PROFILES } from './tr397.mjs';

const f3 = (x) => x.toFixed(3);
const FT = 0.3048;

/** Apply the declared reconstruction rule to one profile pair. */
function reconstruct(profileKey) {
  const hull = PROFILES[profileKey];
  const raw = PROFILES[profileKey + '-RAWFINS'];
  const rMax = Math.max(...hull.map((p) => p[1]));
  // 1. fin-deviation stations (geometry-only detection)
  const deviates = hull.map((p, i) => raw[i][1] - p[1] > 0.02 * rMax);
  const i0 = deviates.indexOf(true);
  const i1 = deviates.lastIndexOf(true);
  if (i0 < 0) return { pts: hull, removed: [] };
  // include exam-1 plateau stations inside/adjacent to the span: walk
  // forward from i1 while the clip left consecutive equal ordinates
  let j1 = i1;
  while (j1 + 1 < hull.length - 1 && Math.abs(hull[j1 + 1][1] - hull[j1][1]) < 1e-9) j1++;
  // and walk i0 back across any pre-span plateau the clip created
  let j0 = i0;
  while (j0 - 1 > 0 && Math.abs(hull[j0 - 1][1] - hull[j0][1]) < 1e-9) j0--;
  const removed = hull.slice(j0, j1 + 1).map((p) => p[0]);
  const kept = hull.filter((_, i) => i < j0 || i > j1);
  // 2. bridge with monotone cubic through the kept ordinates
  const f = pchip(kept);
  const pts = hull.map(([x]) => [x, Math.max(0, f(x))]);
  return { pts, removed };
}

console.log('== TR-397 SENSITIVITY #2 — smooth bare-hull reconstruction (r14-prescribed) ==');
console.log('Rule: delete fin-deviation + clip-plateau stations, bridge with monotone cubic. Geometry only.\n');

console.log('ship                      finclip-proxy  recon-proxy   finclip-pred  recon-pred  MEASURED   recon gap');
const uniq = SHIPS.filter((x, i, a) => a.findIndex((y) => y.profile === x.profile) === i);
const reconCache = {};
for (const s of uniq) {
  const { pts, removed } = reconstruct(s.profile);
  reconCache[s.profile] = pts;
  console.log(`  [${s.profile}] removed stations: ${removed.map((x) => x.toFixed(1) + '%').join(', ') || 'none'}`);
}
console.log();
for (const s of SHIPS) {
  const lengthM = s.lengthFt * FT;
  const run = (pts) => {
    const mesh = latheProfile(pts);
    const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM });
    const p = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' });
    const friction = ittcCf(s.reM * 1e6) * (g.wettedArea / g.frontalArea);
    return { proxy: p.proxy, predicted: friction + calibratePressure(p.proxy) };
  };
  const a = run(PROFILES[s.profile]);
  const b = run(reconCache[s.profile]);
  const measured = s.dragAreaFt2 / (Math.PI * s.diameterFt * s.diameterFt / 4);
  const gap = 100 * (b.predicted - measured) / measured;
  console.log(`${s.name.padEnd(24)}    ${f3(a.proxy)}        ${f3(b.proxy)}        ${f3(a.predicted)}       ${f3(b.predicted)}      ${f3(measured)}   ${gap >= 0 ? '+' : ''}${gap.toFixed(0)}%`);
}
console.log('\nNo calibration changed. vNEXT2 remains HELD for r14.');
