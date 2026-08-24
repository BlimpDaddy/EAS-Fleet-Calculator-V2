/**
 * BATCH EVALUATION HARNESS — spec 81. The single test machine.
 *
 * Baseline frozen at 9746da7. Takes any surface and exports one complete,
 * deterministic record:
 *
 *   geometry identity | scalar proxy + class | Cd, pressure/friction split, Re,
 *   band, provenance | F1-F5 | zone histories | eligibility |
 *   raw-vs-hull sensitivity | analogue bracket | OOD/confidence context
 *
 * IT ALTERS NOTHING. Cd comes from the existing production estimator; the
 * ribbon layer is computed alongside and is proven not to touch it (the
 * harness recomputes Cd after the ribbon pass and asserts bit-equality).
 *
 * Determinism: no Math.random anywhere; analytic bodies are sampled with the
 * seeded generators of hull-bodies.mjs.
 */
import { measureDynamicsGeometry } from '../../../site/calcv2/src/dynamicsGeometry.js';
import { measureSectionalProxy, estimateCd, CALIBRATION_KNOTS, CALIBRATION_PROVENANCE } from '../../../site/calcv2/src/cdEstimator.js';
import { ribbonContext } from './ribbon-context.mjs';
import { supportRadiiSelfTest } from './support-skin.mjs';
import { reflexSelfTest } from './support-skin.mjs';
import { hullMesh } from './hull-bodies.mjs';
import { clockModes } from './clock-modes.mjs';

export const NU_M2_S = 1.5e-5;         // matches the estimator's air kinematic viscosity
export const DEFAULT_SPEED = 100;      // km/h, EAS IDEAL

/** measured-corpus envelopes, from spec 73.2 — used for OOD context only */
export const CORPUS = { scalarMax: 0.186851, F2aMax: 10.260, F5Axisym: 0.05 };

let selfTested = false;
function preflight() {
  if (selfTested) return;
  if (!supportRadiiSelfTest().ok) throw new Error('supportRadii self-test FAILED');
  if (!reflexSelfTest().ok) throw new Error('reflex self-test FAILED');
  selfTested = true;
}

/** which calibration segment does this proxy sit in, and is it bracketed by measured data? */
function analogueBracket(proxy) {
  let lo = 0, hi = CALIBRATION_KNOTS.length - 1;
  for (let i = 0; i + 1 < CALIBRATION_KNOTS.length; i++) {
    if (proxy >= CALIBRATION_KNOTS[i][0] && proxy <= CALIBRATION_KNOTS[i + 1][0]) { lo = i; hi = i + 1; }
  }
  if (proxy > CALIBRATION_KNOTS[CALIBRATION_KNOTS.length - 1][0]) { lo = hi = CALIBRATION_KNOTS.length - 1; }
  const bounds = lo === hi ? [CALIBRATION_PROVENANCE[lo]] : [CALIBRATION_PROVENANCE[lo], CALIBRATION_PROVENANCE[hi]];
  const measured = bounds.filter((s) => s.includes('real')).length;
  return { segment: [lo, hi], bounds, measuredAnchors: measured, of: bounds.length,
    extrapolated: proxy > CALIBRATION_KNOTS[CALIBRATION_KNOTS.length - 1][0] };
}

/**
 * @param surface {verts, faces, identity}
 * @param opts    {label, lengthM, speedKmh, hullCompare}
 */
export function evaluate(surface, { label = '', lengthM, speedKmh = DEFAULT_SPEED, hullCompare = true } = {}) {
  preflight();
  const geo = measureDynamicsGeometry(surface.verts, surface.faces, { flightAxis: 'X', lengthM });
  const proxy = measureSectionalProxy(surface.verts, surface.faces, { axis: '+X' });
  const est = estimateCd(proxy, geo, speedKmh);

  const ctx = ribbonContext(surface.verts, surface.faces, { label, geometrySource: surface.identity });

  /* PROOF, not assertion: recompute Cd AFTER the ribbon pass and require bit-equality */
  const est2 = estimateCd(measureSectionalProxy(surface.verts, surface.faces, { axis: '+X' }), geo, speedKmh);
  const cdUnchanged = est2.cdEstimate === est.cdEstimate && est2.pressureCd === est.pressureCd;
  if (!cdUnchanged) throw new Error(`${label}: the ribbon pass altered Cd — this must never happen`);

  /* raw-vs-hull geometry-path sensitivity (spec 78) */
  let sensitivity = null;
  if (hullCompare) {
    const h = hullMesh(surface.verts);
    const hGeo = measureDynamicsGeometry(h.verts, h.faces, { flightAxis: 'X', lengthM });
    const hProxy = measureSectionalProxy(h.verts, h.faces, { axis: '+X' });
    const hEst = estimateCd(hProxy, hGeo, speedKmh);
    const dCd = Math.abs(hEst.cdEstimate - est.cdEstimate) / Math.max(hEst.cdEstimate, est.cdEstimate);
    const dPx = Math.abs(hProxy.proxy - proxy.proxy) / Math.max(hProxy.proxy, proxy.proxy, 1e-12);
    sensitivity = { hullProxy: hProxy.proxy, hullCd: hEst.cdEstimate, dCd, dProxy: dPx,
      verdict: (dCd <= 0.10 && dPx <= 0.10) ? 'ROBUST'
        : dCd > 0.10 ? 'DIVERGENT_CD' : 'DIVERGENT_GEOMETRY_SHALLOW_MAP' };
  }

  const d = ctx.descriptors.median;
  const oodSignals = {
    scalarOutside: proxy.proxy > CORPUS.scalarMax,
    F2aOutside: d.F2a > CORPUS.F2aMax,
    directional: ctx.descriptors.F5.median > CORPUS.F5Axisym,
  };
  const nOut = Object.values(oodSignals).filter(Boolean).length;

  return {
    label,
    geometry: { identity: surface.identity, lengthM: geo.lengthM, frontalArea: geo.frontalArea,
      wettedArea: geo.wettedArea, wettedSource: geo.wettedSource },
    scalar: { compositeV1: proxy.proxy, cls: proxy.cls,
      softAft: proxy.scores ? proxy.scores.softAft : null,
      softFore: proxy.scores ? proxy.scores.softFore : null,
      /* spec 84.5 S5: a class flip must be reported WITH the trigger that caused
         it. These are already computed by the production classifier; exposing
         them recomputes nothing and changes no value. */
      triggers: proxy.triggers || null },
    cd: { speedKmh, value: est.cdEstimate, friction: est.frictionCd, pressure: est.pressureCd,
      band: est.band, status: est.status,
      reL: ((speedKmh / 3.6) * geo.lengthM) / NU_M2_S,
      provenance: est.provenance ? est.provenance.calibration : null },
    ribbon: { eligibility: ctx.eligibility.outcome,
      checks: { multi: ctx.eligibility.checks.E2.multi, missed: ctx.eligibility.checks.E2.missed,
        e4Shift: ctx.eligibility.checks.E4.worstShift, e3: ctx.eligibility.checks.E3.pass },
      F1: d.F1, F2a: d.F2a, F2f: d.F2f, F3: d.F3, F4: d.F4, F5: ctx.descriptors.F5.median,
      /* 89.6 ruling: shadow ANGULAR SYMMETRY MODES from the existing positional
         field. Additive; 70.4 schema and the 59.3 F1-F5 set (F5 included) untouched. */
      modes: clockModes(ctx),
      zones: ctx.zones.median, zoneSpread: ctx.zones.spread },
    analogue: analogueBracket(proxy.proxy),
    ood: { ...oodSignals, count: nOut,
      confidence: nOut === 0 ? 'SUPPORTED' : nOut === 3 ? 'LOW' : 'REDUCED' },
    sensitivity,
    cdUnchangedByRibbons: cdUnchanged,
  };
}

/** compact one-line form for sweep tables */
export function row(r) {
  const s = r.sensitivity;
  return {
    label: r.label,
    proxy: +r.scalar.compositeV1.toFixed(6),
    cd: +r.cd.value.toFixed(5),
    pressure: +r.cd.pressure.toFixed(5),
    friction: +r.cd.friction.toFixed(5),
    elig: r.ribbon.eligibility,
    F1: +r.ribbon.F1.toFixed(4), F2a: +r.ribbon.F2a.toFixed(3),
    F3: +r.ribbon.F3.toFixed(4), F4: +r.ribbon.F4.toFixed(4), F5: +r.ribbon.F5.toFixed(3),
    anchors: `${r.analogue.measuredAnchors}/${r.analogue.of}`,
    conf: r.ood.confidence,
    dCd: s ? +(100 * s.dCd).toFixed(1) : null,
    dPx: s ? +(100 * s.dProxy).toFixed(1) : null,
  };
}
