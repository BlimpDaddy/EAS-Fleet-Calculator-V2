/**
 * GEOMETRY IDENTITY + PATH SENSITIVITY — spec 78.
 *
 * Every run states WHICH GEOMETRY each number came from, and runs BOTH paths
 * automatically so the difference is visible rather than hidden:
 *
 *   Cd geometry:      authored | hull
 *   Ribbon geometry:  the SAME surface as Cd. The ribbon layer does NOT
 *                     require a convex hull — the support skin convexifies each
 *                     transverse section, not the body along its length (80.3).
 *                     The hull path below is a SENSITIVITY DIAGNOSTIC only.
 *   Path sensitivity: raw Cd vs hull Cd
 *
 * WHY: spec 77.2 found that for a preset the Cd path uses the AUTHORED mesh
 * while the ribbon layer necessarily uses the CONVEX HULL. Reporting one
 * number without its geometry identity hides that.
 *
 * The sensitivity is itself a confidence signal, free of charge:
 *   paths AGREE closely  -> the low-order estimate is robust to representation
 *   paths DIVERGE badly  -> concavity/detail is materially affecting it
 *
 * SHADOW ONLY. No Cd is altered. Nothing fitted.
 */
import { measureDynamicsGeometry } from '../../../site/calcv2/src/dynamicsGeometry.js';
import { measureSectionalProxy, estimateCd } from '../../../site/calcv2/src/cdEstimator.js';
import { loadEasBody } from './eas-bodies.mjs';
import { ribbonContext } from './ribbon-context.mjs';
import { supportRadiiSelfTest } from './support-skin.mjs';

const SPEED = 100;                     // EAS IDEAL
/** divergence above this is flagged; it is a REPORTING threshold, not a gate. */
const FLAG = 0.10;

if (!supportRadiiSelfTest().ok) throw new Error('supportRadii self-test FAILED');

function run(surface, lengthM) {
  const geo = measureDynamicsGeometry(surface.verts, surface.faces, { flightAxis: 'X', lengthM });
  const proxy = measureSectionalProxy(surface.verts, surface.faces, { axis: '+X' });
  const est = estimateCd(proxy, geo, SPEED);
  return { identity: surface.identity, geo, proxy, est };
}

console.log('\nGEOMETRY IDENTITY + PATH SENSITIVITY (spec 78)');
console.log(`  Cd at ${SPEED} km/h from the EXISTING production estimator. Both paths, always.`);
console.log('  SHADOW: no Cd altered, nothing fitted.\n');

for (const key of ['bare', 'tailed']) {
  const b = loadEasBody(key);
  const hull = run(b.hull, b.lengthM);
  const auth = b.authored ? run(b.authored, b.lengthM) : null;
  const ctx = ribbonContext(b.hull.verts, b.hull.faces, { label: b.label });

  console.log('='.repeat(76));
  console.log(`  ${b.label}   (L ${b.lengthM} m)`);
  console.log(`    production path for THIS body: ${key === 'bare' ? 'UPLOAD -> hull always' : 'PRESET -> authored aeroHullMesh'}`);
  console.log('');
  console.log('    geometry identity        proxy      Cd        frontal m2   wetted m2');
  for (const r of [auth, hull].filter(Boolean)) {
    console.log(`      ${r.identity.padEnd(24)} ${r.proxy.proxy.toFixed(6)}  ${r.est.cdEstimate.toFixed(4)}    ` +
      `${r.geo.frontalArea.toFixed(0).padStart(9)}   ${r.geo.wettedArea.toFixed(0).padStart(9)}`);
  }
  if (auth) {
    const dCd = Math.abs(auth.est.cdEstimate - hull.est.cdEstimate) / Math.max(auth.est.cdEstimate, hull.est.cdEstimate);
    const dPx = Math.abs(auth.proxy.proxy - hull.proxy.proxy) / Math.max(auth.proxy.proxy, hull.proxy.proxy);
    console.log('');
    // FLAG ON EITHER. A small Cd divergence with a large PROXY divergence means
    // the two representations genuinely differ and the calibration map merely
    // happens to be shallow there -- steepen the map and that divergence
    // becomes a large Cd difference. Watching Cd alone would call that "agree".
    const flagCd = dCd > FLAG, flagPx = dPx > FLAG;
    let verdict;
    if (!flagCd && !flagPx) verdict = '-> ROBUST: both representations agree';
    else if (flagCd) verdict = '-> DIVERGENT Cd: concavity/detail materially affects the estimate';
    else verdict = '-> DIVERGENT GEOMETRY, shallow map: the representations differ materially ' +
      'but the calibration map is insensitive here. Treat the Cd agreement as a property of ' +
      'the map, NOT evidence that the geometry paths agree.';
    console.log(`    PATH SENSITIVITY   Cd ${(100 * dCd).toFixed(1)}%   proxy ${(100 * dPx).toFixed(1)}%`);
    console.log(`      ${verdict}`);
  }
  console.log('');
  console.log(`    Cd geometry      ${key === 'bare' ? hull.identity : auth.identity}`);
  console.log(`    Ribbon geometry  ${b.hull.identity}   (HULL PATH — sensitivity diagnostic only; 80.5 makes the`);
  console.log('                     authored surface the canonical DYNAMIC identity for the tailed body)');
  console.log(`    ribbon layer     ${ctx.eligibility.outcome}`);
  if (key !== 'bare') {
    console.log('    NOTE: Cd and ribbon paths use DIFFERENT geometry for this body, so the ribbon');
    console.log('          layer may NOT formally qualify this Cd (spec 77.2). Reported side by side.');
  } else {
    console.log('    NOTE: same geometry on both paths — ribbon-derived confidence may qualify this Cd.');
  }
}
console.log('\n' + '='.repeat(76));
console.log('  Path sensitivity is a REPORTING diagnostic. It gates nothing and alters no Cd.\n');
