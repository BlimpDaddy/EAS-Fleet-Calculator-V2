/**
 * SUNSHIP NUMERICAL REPORT — spec 75.
 *
 * bare:   production Cd baseline + scalar + ELIGIBLE F1-F5 + OOD/confidence
 * tailed: production Cd baseline + scalar + ribbon INELIGIBLE + shadow values
 *
 * THE Cd NUMBERS HERE ARE THE EXISTING PRODUCTION ESTIMATOR'S, UNCHANGED.
 * Ribbon ineligibility does not block a Cd estimate — it only withholds
 * aerodynamic authority from the ribbon layer. No ribbon descriptor touches
 * any Cd value in this file. Nothing is fitted.
 */
import { measureDynamicsGeometry } from '../../../site/calcv2/src/dynamicsGeometry.js';
import { measureSectionalProxy, estimateCd, CALIBRATION_KNOTS, CALIBRATION_PROVENANCE } from '../../../site/calcv2/src/cdEstimator.js';
import { loadEasBody } from './eas-bodies.mjs';
import { ribbonContext } from './ribbon-context.mjs';
import { supportRadiiSelfTest } from './support-skin.mjs';

const SPEEDS = [80, 100, 120];         // 100 km/h is the EAS IDEAL

if (!supportRadiiSelfTest().ok) throw new Error('supportRadii self-test FAILED');

console.log('\nSUNSHIP NUMERICAL REPORT (spec 75)');
console.log('  Each body at ITS OWN declared scale and frame (eas-bodies.mjs). Cd from the');
console.log('  EXISTING production estimator, unchanged.');
console.log('  No ribbon descriptor touches any Cd value here. Nothing fitted.\n');

const out = [];
for (const key of ['bare', 'tailed']) {
  const mesh = loadEasBody(key);
  const label = mesh.label;
  const geo = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: mesh.lengthM });
  const proxy = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' });
  const cds = SPEEDS.map((s) => ({ s, e: estimateCd(proxy, geo, s) }));
  const ctx = ribbonContext(mesh.verts, mesh.faces, { label });
  out.push({ label, geo, proxy, cds, ctx });

  console.log('='.repeat(78));
  console.log(`  ${label}`);
  console.log(`    source       ${mesh.note}`);
  console.log(`    transverse   Y/Z extent ratio ${mesh.extentRatio.toFixed(4)}` +
    (Math.abs(mesh.extentRatio - 1) < 1e-6 ? '  (transversely AXISYMMETRIC)' : '  (non-axisymmetric)'));
  console.log(`    geometry     L ${geo.lengthM.toFixed(1)} m   frontal ${geo.frontalArea.toFixed(0)} m2   ` +
    `wetted ${geo.wettedArea.toFixed(0)} m2 (${geo.wettedSource})`);
  console.log(`    scalar       compositeV1 ${proxy.proxy.toFixed(6)}   class ${proxy.cls}`);
  console.log('    PRODUCTION Cd (unchanged):');
  for (const { s, e } of cds) {
    console.log(`      ${String(s).padStart(3)} km/h   Cd ${e.cdEstimate === null ? 'unavailable' : e.cdEstimate.toFixed(4)}` +
      `   friction ${e.frictionCd.toFixed(4)}   pressure ${e.pressureCd === null ? 'n/a' : e.pressureCd.toFixed(4)}` +
      `   band [${e.band ? e.band.map((b) => b.toFixed(4)).join(', ') : 'n/a'}]   ${e.status}`);
  }
  const el = ctx.eligibility;
  console.log(`    ribbon layer ${el.outcome}` + (el.outcome === 'ELIGIBLE' ? '' :
    `  (E2 multi ${el.checks.E2.multi} missed ${el.checks.E2.missed}; E4 shift ${(100 * el.checks.E4.worstShift).toFixed(2)}%)`));
  const d = ctx.descriptors.median;
  const tag = el.outcome === 'ELIGIBLE' ? '' : '   <-- SHADOW ONLY, no aerodynamic authority';
  console.log(`      F1 ${d.F1.toFixed(4)}  F2a ${d.F2a.toFixed(3)}  F2f ${d.F2f.toFixed(4)}  ` +
    `F3 ${d.F3.toFixed(4)}  F4 ${d.F4.toFixed(4)}  F5 ${ctx.descriptors.F5.median.toFixed(3)}${tag}`);
}

/* ---------- what evidence is each Cd resting on? ---------- */
console.log('\n' + '='.repeat(78));
console.log('  WHAT EVIDENCE IS EACH Cd RESTING ON?');
console.log('  calibration knots (proxy -> pressure Cd) and their provenance:');
CALIBRATION_KNOTS.forEach((k, i) => console.log(`    ${k[0].toFixed(4)} -> ${k[1].toFixed(5)}   ${CALIBRATION_PROVENANCE[i]}`));
for (const o of out) {
  const p = o.proxy.proxy;
  let lo = 0, hi = CALIBRATION_KNOTS.length - 1;
  for (let i = 0; i + 1 < CALIBRATION_KNOTS.length; i++) {
    if (p >= CALIBRATION_KNOTS[i][0] && p <= CALIBRATION_KNOTS[i + 1][0]) { lo = i; hi = i + 1; }
  }
  const real = (s) => s.includes('real');
  const bounded = [CALIBRATION_PROVENANCE[lo], CALIBRATION_PROVENANCE[hi]];
  const nReal = bounded.filter(real).length;
  console.log(`\n    ${o.label}: proxy ${p.toFixed(4)} sits between knots ${lo} and ${hi}`);
  console.log(`      bounded by: ${bounded.join('  |  ')}`);
  console.log(`      measured-data anchors bounding it: ${nReal} of 2` +
    (nReal === 0 ? '   <-- INTERPOLATING BETWEEN TWO TEXTBOOK ANCHORS' :
      nReal === 1 ? '   <-- one side is a textbook anchor, not measured data' : ''));
  console.log(`      note: the reported provenance for this class is ${o.cds[1].e.provenance.calibration.join(' | ')}`);
}

/* ---------- can the ribbon layer move confidence? ---------- */
console.log('\n' + '='.repeat(78));
console.log('  CAN THE RIBBON LAYER RAISE OR LOWER CONFIDENCE?');
const corpusScalarMax = 0.186851;      // TN614-332, the bluffest measured reference (spec 73.2)
const corpusF2aMax = 10.260;           // TN614-221 (spec 73.2)
for (const o of out) {
  const el = o.ctx.eligibility.outcome;
  const d = o.ctx.descriptors.median;
  console.log(`\n    ${o.label} — ribbon layer ${el}`);
  if (el !== 'ELIGIBLE') {
    console.log('      NO CONFIDENCE INPUT. The ribbon layer is ineligible, so it may neither raise');
    console.log('      nor lower confidence in this Cd. Shadow values are recorded, not used.');
    continue;
  }
  console.log(`      scalar ${o.proxy.proxy.toFixed(4)} vs measured-corpus max ${corpusScalarMax.toFixed(4)}  ` +
    `-> ${(o.proxy.proxy / corpusScalarMax).toFixed(1)}x outside`);
  console.log(`      F2a ${d.F2a.toFixed(1)} deg vs corpus max ${corpusF2aMax.toFixed(1)} deg  ` +
    `-> ${(d.F2a / corpusF2aMax).toFixed(1)}x outside`);
  console.log(`      F5 ${o.ctx.descriptors.F5.median.toFixed(2)} deg vs ~0.01 for every axisymmetric reference`);
  // the direction is COMPUTED, not asserted
  const outScalar = o.proxy.proxy > corpusScalarMax;
  const outF2a = d.F2a > corpusF2aMax;
  const directional = o.ctx.descriptors.F5.median > 0.05;
  const nOut = [outScalar, outF2a, directional].filter(Boolean).length;
  if (nOut === 0) {
    console.log('      DIRECTION: SUPPORTED. Scalar and ribbon descriptors both sit INSIDE the measured');
    console.log('      analogue set, and the body is transversely axisymmetric like every reference in it.');
    console.log('      The ribbon layer finds no reason to lower confidence in this Cd.');
  } else {
    console.log(`      DIRECTION: LOWER confidence (${nOut} of 3 signals outside the corpus).` +
      (outScalar ? ' scalar outside;' : '') + (outF2a ? ' F2a outside;' : '') +
      (directional ? ' directional structure no reference body exercises;' : ''));
  }
  console.log('      This is an OOD/confidence signal ONLY. It does not move the Cd number.');
}
console.log('\n  No Cd was altered by any ribbon descriptor. Production untouched.\n');
