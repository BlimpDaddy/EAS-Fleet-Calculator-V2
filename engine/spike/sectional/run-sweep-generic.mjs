/**
 * STEP 2 RUNNER — spec 82. Diagnostic only. Nothing repaired or retuned.
 */
import { evaluate } from './batch-harness.mjs';
import { SWEEPS } from './sweep-generic.mjs';

const L_M = 100, SPEED = 100;                 // common artificial scale, regression basis
const mono = (v) => {
  let up = true, dn = true;
  for (let i = 1; i < v.length; i++) { if (v[i] < v[i - 1] - 1e-12) up = false; if (v[i] > v[i - 1] + 1e-12) dn = false; }
  return up ? 'increasing' : dn ? 'decreasing' : 'NON-MONOTONE';
};
/**
 * CLIFF DETECTOR — spec 83.B, the 82.7 repair.
 *
 * 82.7: normalising a step by the series RANGE alone reported "71% of range" on
 * the SHOULDER family, whose entire Cd range is 0.00087 — 1.2% of Cd. Those
 * flags were spurious. A step is only a cliff if it is large BOTH relative to
 * the variation in the series AND relative to the quantity itself.
 *
 *   MATERIAL  iff  step >= CLIFF_FRAC * range  AND  step >= CLIFF_MAG * level
 *
 * `level` is the median magnitude of the series — the denominator that 82.7's
 * ratio was missing. Every ratio below is printed WITH its denominator; the
 * fifth error in the handover's list is reporting a ratio without one.
 *
 * The thresholds are set from the ALREADY-RECORDED step-2 data, not from this
 * run: FINENESS Cd steps 0.02807 on a level of 0.05123 = 54.8%; SHOULDER steps
 * 0.00062 on the same level = 1.2%. They differ by 45x, so any threshold in
 * (0.02, 0.50) separates them identically. 0.05 is a round 5% of level.
 */
const CLIFF_FRAC = 0.50, CLIFF_MAG = 0.05;
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const cliff = (v) => {
  const range = Math.max(...v) - Math.min(...v);
  const level = median(v.map(Math.abs));
  let step = 0, at = -1;
  for (let i = 1; i < v.length; i++) {
    const d = Math.abs(v[i] - v[i - 1]);
    if (d > step) { step = d; at = i; }
  }
  const frac = range > 1e-12 ? step / range : 0;
  const mag = level > 1e-12 ? step / level : 0;
  return { step, range, level, frac, mag, at, material: frac >= CLIFF_FRAC && mag >= CLIFF_MAG };
};
/** one line per series, every ratio carrying its denominator (83.B / C3) */
const cliffLine = (name, c, param, rec) => `    largest ${name} step ${c.step.toPrecision(3)}` +
  (c.at > 0 ? ` at ${param}=${rec[c.at].v}` : '') +
  ` = ${(100 * c.frac).toFixed(0)}% of range ${c.range.toPrecision(3)}` +
  ` = ${(100 * c.mag).toFixed(1)}% of level ${c.level.toPrecision(4)}` +
  `  -> ${c.material ? 'MATERIAL' : 'not material'}`;

console.log('\nSTEP 2 — CONTROLLED GENERIC GEOMETRY SWEEPS (spec 82)');
console.log(`  Diagnostic only. L = ${L_M} m, ${SPEED} km/h (artificial common scale).`);
console.log('  Production Cd and calibration FROZEN. Nothing repaired during the sweep.\n');

const anomalies = [];
for (const sw of SWEEPS) {
  console.log('='.repeat(104));
  console.log(`  ${sw.name}    expect: ${sw.expect}`);
  console.log(`    ${sw.param.padEnd(6)}  proxy      Cd       class     elig        F1      F2a     F3      F4      F5     dCd%  dPx%`);
  const rec = [];
  for (const { v, s } of sw.steps) {
    let r;
    try { r = evaluate(s, { label: `${sw.param}=${v}`, lengthM: L_M, speedKmh: SPEED }); }
    catch (e) { console.log(`    ${String(v).padEnd(6)}  EVALUATION FAILED: ${e.message}`); anomalies.push(`${sw.name} @ ${v}: ${e.message}`); continue; }
    rec.push({ v, r });
    const q = r.ribbon;
    console.log(`    ${String(v).padEnd(6)}  ${r.scalar.compositeV1.toFixed(6)} ${r.cd.value.toFixed(5)}  ${r.scalar.cls.padEnd(8)} ` +
      `${q.eligibility.padEnd(11)} ${q.F1.toFixed(4)} ${q.F2a.toFixed(3).padStart(7)} ${q.F3.toFixed(4)} ${q.F4.toFixed(4)} ` +
      `${q.F5.toFixed(3).padStart(6)} ${(100 * r.sensitivity.dCd).toFixed(1).padStart(5)} ${(100 * r.sensitivity.dProxy).toFixed(1).padStart(5)}`);
  }
  if (rec.length < 2) continue;

  const series = {
    proxy: rec.map((x) => x.r.scalar.compositeV1), Cd: rec.map((x) => x.r.cd.value),
    F1: rec.map((x) => x.r.ribbon.F1), F2a: rec.map((x) => x.r.ribbon.F2a),
    F3: rec.map((x) => x.r.ribbon.F3), F4: rec.map((x) => x.r.ribbon.F4), F5: rec.map((x) => x.r.ribbon.F5),
  };
  console.log('\n    monotonicity:  ' + Object.entries(series).map(([k, v]) => `${k} ${mono(v)}`).join('   '));
  const cCd = cliff(series.Cd), cPx = cliff(series.proxy);
  console.log(cliffLine('Cd   ', cCd, sw.param, rec));
  console.log(cliffLine('proxy', cPx, sw.param, rec));

  const classes = [...new Set(rec.map((x) => x.r.scalar.cls))];
  if (classes.length > 1) {
    const flip = rec.findIndex((x, i) => i > 0 && x.r.scalar.cls !== rec[i - 1].r.scalar.cls);
    console.log(`    *** CLASSIFIER CLIFF: class flips ${rec[flip - 1].r.scalar.cls} -> ${rec[flip].r.scalar.cls} at ${sw.param}=${rec[flip].v}`);
    anomalies.push(`${sw.name}: classifier flips at ${sw.param}=${rec[flip].v}`);
  }
  const bad = rec.filter((x) => x.r.ribbon.eligibility !== 'ELIGIBLE');
  if (bad.length) {
    console.log(`    *** ELIGIBILITY FAILURES at ${sw.param} = ${bad.map((x) => x.v).join(', ')}`);
    anomalies.push(`${sw.name}: ineligible at ${bad.map((x) => x.v).join(', ')}`);
  }
  if (cCd.material) anomalies.push(`${sw.name}: MATERIAL Cd cliff — one step of ${cCd.step.toPrecision(3)} at ${sw.param}=${rec[cCd.at].v}, ` +
    `${(100 * cCd.frac).toFixed(0)}% of range ${cCd.range.toPrecision(3)} and ${(100 * cCd.mag).toFixed(1)}% of level ${cCd.level.toPrecision(4)}`);
  if (cPx.material) anomalies.push(`${sw.name}: MATERIAL proxy cliff — one step of ${cPx.step.toPrecision(3)} at ${sw.param}=${rec[cPx.at].v}, ` +
    `${(100 * cPx.frac).toFixed(0)}% of range ${cPx.range.toPrecision(3)} and ${(100 * cPx.mag).toFixed(1)}% of level ${cPx.level.toPrecision(4)}`);
  const worstPx = Math.max(...rec.map((x) => x.r.sensitivity.dProxy));
  if (worstPx > 0.10) anomalies.push(`${sw.name}: geometry-path divergence up to ${(100 * worstPx).toFixed(0)}% in proxy`);
  console.log('');
}

console.log('='.repeat(104));
console.log(`  ANOMALIES RECORDED (not repaired): ${anomalies.length}`);
for (const a of anomalies) console.log(`    - ${a}`);
console.log('\n  Nothing retuned. Production Cd path and calibration untouched.\n');
