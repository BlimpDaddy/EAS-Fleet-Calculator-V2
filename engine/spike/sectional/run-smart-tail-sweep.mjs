/**
 * STEP 3 — SMART TAIL OAT SWEEPS. Spec 84, gates frozen before the build.
 *
 * THE QUESTION (84.0): does the ~0.022 baseline belong to a coherent
 * neighbourhood of reasonable Smart Tail geometries, or is it an isolated
 * numerical sweet spot? AN ESTIMATOR-RESPONSE EXPERIMENT, NOT AERODYNAMIC
 * VALIDATION. No statement about real drag follows from it.
 *
 * NO AERODYNAMIC DIRECTION IS PRE-REGISTERED for any of the five parameters
 * (84.4). The gates are structural (84.5 S1-S8).
 *
 * ONE GEOMETRY (84.11.1): Cd, the scalar AND the ribbons all read the same
 * DYNAMIC surface — convex envelope + authored Smart Tail, concavity intact.
 * NO GLOBAL 3D HULL. The hull path is computed only as the 78 sensitivity
 * diagnostic and has no authority over anything.
 *
 * Usage:  node run-smart-tail-sweep.mjs [--json out.json]
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSmartTail, BASELINE, FIXED } from './smart-tail.mjs';
import { capOpenRings } from './eas-bodies.mjs';
import { evaluate } from './batch-harness.mjs';
import { volumeCentroid } from './ribbons.mjs';
import { CALIBRATION_KNOTS, CLASSIFIER_TAU, CLASSIFIER_REEXPANSION, SHOULDER_ANGLE_MAX }
  from '../../../site/calcv2/src/cdEstimator.js';

/**
 * WHICH of the four scorer-native triggers put a row in 'pinned' (S5). The
 * thresholds are production's own frozen constants, read, never redefined.
 */
function firedTriggers(r) {
  const t = r.scalar.triggers;
  if (!t) return ['(triggers unavailable)'];
  const out = [];
  if (t.softFore > t.softAft) out.push(`(a) fore-dominance softFore ${t.softFore.toFixed(6)} > softAft ${t.softAft.toFixed(6)}`);
  if (t.terminalBaseFrac > CLASSIFIER_TAU) out.push(`(b) terminal base ${t.terminalBaseFrac.toFixed(4)} > TAU ${CLASSIFIER_TAU}`);
  if (t.rawRatio > CLASSIFIER_REEXPANSION) out.push(`(c) re-expansion ${t.rawRatio.toFixed(3)} > ${CLASSIFIER_REEXPANSION}`);
  if (t.shoulder > SHOULDER_ANGLE_MAX) out.push(`(d) aft shoulder ${t.shoulder.toFixed(4)} > ${SHOULDER_ANGLE_MAX}`);
  return out.length ? out : ['none above threshold'];
}

const SPEED = 100;                       // km/h, EAS IDEAL
const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
const ENGINE_FILES = ['obj.js', 'sections.js', 'cdEstimator.js', 'dynamicsGeometry.js'];
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const engineFingerprint = () => ENGINE_FILES
  .map((f) => f + ':' + sha(readFileSync(`${ROOT}site/calcv2/src/${f}`))).join(' ');

/* ---- 84.8.1 exploit-flag thresholds: RECORDED VALUES, not new numbers ---- */
const EX1_KNOT = CALIBRATION_KNOTS[0][0];        // TN614-111, the lowest REAL anchor
const EX3_CORPUS_F2A_MIN = 3.490;                // S58-4167 at 81.3
const EX3_ZONE45_MAX = 1.00;                     // deg; baseline 80.4 reads 0.80 + 1.17
const EX5_WETTED_RISE = 1.10;                    // vs the baseline row

/* ---- 84.6 the five frozen families ---- */
const FAMILIES = [
  { key: 'T-LEN', param: 'extraM', label: 'DEPLOYED LENGTH (EXTRA_M, m)',
    steps: [0, 54, 108, 162, 216, 270, 324] },
  { key: 'T-ATT', param: 'attach', label: 'ATTACHMENT / FAIRING START (ATTACH)',
    steps: [0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90] },
  { key: 'T-EXP', param: 'P', label: 'TAPER EXPONENT / CLOSURE LAW (P)',
    steps: [0.4, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 2.0] },
  { key: 'T-WST', param: 'W', label: 'FLARE / WAIST DEPTH (W)',
    steps: [-0.20, -0.10, -0.05, 0, 0.05, 0.10, 0.20] },
  { key: 'T-BAS', param: 'rTip', label: 'TERMINAL RADIUS / BASE (rTip / ra)',
    steps: [0, 0.05, 0.10, 0.20, 0.28, 0.35] },
];

/**
 * ONE variant -> one complete record. Centre on the volume centroid (4.1),
 * then TIP-ONLY completion (80.2) — the same order `eas-bodies.mjs` uses for
 * the stored surrogate, so every row is treated exactly as R3's baseline is.
 */
function evaluateVariant(param, value, label) {
  const built = buildSmartTail({ [param]: value });
  const c = volumeCentroid(built.verts, built.faces).c;
  const verts = built.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
  const capped = capOpenRings(verts, built.faces);
  const surface = { verts, faces: capped.faces, identity: built.identity };

  const r = evaluate(surface, { label, lengthM: built.params.xTip, speedKmh: SPEED });
  return { param, value, label, r, capped: capped.capped, validity: built.validity,
    params: built.params, nVerts: verts.length, nFaces: capped.faces.length };
}

/* ================= A5: the frozen path, before anything runs ================= */
const fpBefore = engineFingerprint();
console.log('\nSTEP 3 — SMART TAIL OAT SWEEPS (spec 84)');
console.log(`  ${SPEED} km/h. ONE geometry: convex envelope + authored Smart Tail, concavity intact.`);
console.log('  NO global 3D hull before ribbons. The hull path is the 78 sensitivity diagnostic only.');
console.log('  Estimator-response experiment, NOT aerodynamic validation. No Cd direction pre-registered.\n');

/* ================= the baseline row, shared by all five families ================= */
const base = evaluateVariant('extraM', BASELINE.extraM, 'BASELINE');
const B = base.r;
console.log('  BASELINE (84.1), and the two recorded values it must reproduce:');
console.log(`    compositeV1 ${B.scalar.compositeV1.toFixed(6)}   vs 80.4's recorded 0.161170`);
console.log(`    Cd          ${B.cd.value.toFixed(4)}       vs 81.3 R3's recorded 0.0222`);
console.log(`    class ${B.scalar.cls}   eligibility ${B.ribbon.eligibility}   caps ${base.capped} (tip-only)`);
console.log(`    F1 ${B.ribbon.F1.toFixed(4)}  F2a ${B.ribbon.F2a.toFixed(3)}  F3 ${B.ribbon.F3.toFixed(4)}  ` +
  `F4 ${B.ribbon.F4.toFixed(4)}  F5 ${B.ribbon.F5.toFixed(3)}`);
console.log(`    pressure ${B.cd.pressure.toFixed(5)}  friction ${B.cd.friction.toFixed(5)}  ` +
  `wetted ${Math.round(B.geometry.wettedArea).toLocaleString()} m2  frontal ${Math.round(B.geometry.frontalArea).toLocaleString()} m2\n`);

const basePressureFrac = B.cd.pressure / B.cd.value;
const baseWetted = B.geometry.wettedArea, baseCd = B.cd.value;

/* 84.8.1 — five signals, reported per row, never gating, never collapsed */
function exploitFlags(rec) {
  const r = rec.r, z = r.ribbon.zones;
  const zone45 = (z[4] || 0) + (z[5] || 0);
  return {
    EX1: r.scalar.compositeV1 < EX1_KNOT,
    EX2: (r.cd.pressure / r.cd.value) < 0.5 * basePressureFrac,
    EX3: r.ribbon.F2a < EX3_CORPUS_F2A_MIN && zone45 < EX3_ZONE45_MAX,
    EX4: r.sensitivity && r.sensitivity.verdict === 'DIVERGENT_GEOMETRY_SHALLOW_MAP',
    EX5: r.geometry.wettedArea > EX5_WETTED_RISE * baseWetted && r.cd.value < baseCd,
    zone45,
  };
}
const exStr = (f) => ['EX1', 'EX2', 'EX3', 'EX4', 'EX5'].filter((k) => f[k]).join(',') || '-';

/* ================= the five families ================= */
const results = [], anomalies = [], allRows = [];
for (const fam of FAMILIES) {
  console.log('='.repeat(126));
  console.log(`  ${fam.key}  ${fam.label}`);
  console.log(`    ${fam.param.padEnd(7)} proxy      Cd       press    fric     class    elig        ` +
    `F1      F2a     F4      z4+z5   caps  dCd%  dPx%  path                  conf        exploit`);
  const rows = [];
  for (const v of fam.steps) {
    let rec;
    try { rec = evaluateVariant(fam.param, v, `${fam.key} ${fam.param}=${v}`); }
    catch (e) {
      console.log(`    ${String(v).padEnd(7)} EVALUATION FAILED: ${e.message}`);
      anomalies.push(`${fam.key} @ ${v}: ${e.message}`);
      continue;
    }
    const r = rec.r, f = exploitFlags(rec);
    rec.flags = f;
    rows.push(rec); allRows.push(rec);
    const s = r.sensitivity;
    console.log(`    ${String(v).padEnd(7)} ${r.scalar.compositeV1.toFixed(6)} ${r.cd.value.toFixed(5)}  ` +
      `${r.cd.pressure.toFixed(5)}  ${r.cd.friction.toFixed(5)}  ${r.scalar.cls.padEnd(8)} ` +
      `${r.ribbon.eligibility.padEnd(11)} ${r.ribbon.F1.toFixed(4)} ${r.ribbon.F2a.toFixed(3).padStart(7)} ` +
      `${r.ribbon.F4.toFixed(4)} ${f.zone45.toFixed(3).padStart(7)} ${String(rec.capped).padStart(4)}  ` +
      `${(100 * s.dCd).toFixed(1).padStart(4)} ${(100 * s.dProxy).toFixed(1).padStart(5)}  ` +
      `${s.verdict.padEnd(21)} ${r.ood.confidence.padEnd(10)}  ${exStr(f)}` +
      (rec.validity.ok ? '' : '   *** GEOMETRY INVALID'));
  }
  if (!rows.length) continue;

  /* zone histories, all 8 — S4 keeps them, they are not optional */
  console.log(`\n    zone turning histories (deg), all 8 zones; earned domain is 1-5 (55.2):`);
  for (const rec of rows) {
    console.log(`      ${fam.param}=${String(rec.value).padEnd(6)} ` +
      rec.r.ribbon.zones.map((z) => z.toFixed(2).padStart(7)).join(' '));
  }

  /* boundaries — 84.8 question 3. Flips are IDENTIFIED, never smoothed (S5). */
  const bounds = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.r.scalar.cls !== b.r.scalar.cls) {
      const pinnedSide = a.r.scalar.cls === 'pinned' ? a : b;
      const why = firedTriggers(pinnedSide.r).join('; ');
      const line = `class ${a.r.scalar.cls} -> ${b.r.scalar.cls} between ${fam.param}=${a.value} and ${b.value}` +
        `  [${fam.param}=${pinnedSide.value} pinned by: ${why}]`;
      bounds.push(line); anomalies.push(`${fam.key}: CLASSIFIER FLIP — ${line}`);
    }
    if (a.r.ribbon.eligibility !== b.r.ribbon.eligibility) {
      bounds.push(`eligibility ${a.r.ribbon.eligibility} -> ${b.r.ribbon.eligibility} between ${fam.param}=${a.value} and ${b.value}`);
    }
    if (a.r.ood.confidence !== b.r.ood.confidence) {
      bounds.push(`confidence ${a.r.ood.confidence} -> ${b.r.ood.confidence} between ${fam.param}=${a.value} and ${b.value}`);
    }
  }
  console.log(`\n    boundaries: ${bounds.length ? '' : 'none'}`);
  for (const b of bounds) console.log(`      *** ${b}`);

  /* 84.8 q1/q2 — the baseline's local response, and the width of the in-band run */
  const iBase = rows.findIndex((r) => Math.abs(r.value - BASELINE[fam.param]) < 1e-12);
  const cds = rows.map((r) => r.r.cd.value);
  let local = 'baseline not in this family';
  if (iBase >= 0) {
    const lo = iBase > 0 ? cds[iBase - 1] : null, hi = iBase < cds.length - 1 ? cds[iBase + 1] : null;
    const dLo = lo === null ? null : (cds[iBase] - lo) / cds[iBase], dHi = hi === null ? null : (hi - cds[iBase]) / cds[iBase];
    local = `Cd ${cds[iBase].toFixed(5)}; neighbours ` +
      `${lo === null ? 'n/a' : lo.toFixed(5)} / ${hi === null ? 'n/a' : hi.toFixed(5)}` +
      `  (${dLo === null ? 'n/a' : (100 * dLo).toFixed(1) + '%'} below, ${dHi === null ? 'n/a' : (100 * dHi).toFixed(1) + '%'} above)` +
      `  ${(lo !== null && hi !== null && cds[iBase] < lo && cds[iBase] < hi) ? '<-- LOCAL MINIMUM' : ''}`;
  }
  /* the contiguous in-band run THROUGH the baseline, in the parameter's own units */
  let band = 'baseline out of band';
  if (iBase >= 0 && cds[iBase] >= 0.02 && cds[iBase] < 0.03) {
    let a = iBase, b = iBase;
    while (a > 0 && cds[a - 1] >= 0.02 && cds[a - 1] < 0.03) a--;
    while (b < cds.length - 1 && cds[b + 1] >= 0.02 && cds[b + 1] < 0.03) b++;
    band = `${fam.param} ${rows[a].value} .. ${rows[b].value}  (${b - a + 1} of ${rows.length} steps)` +
      (a === 0 && b === rows.length - 1 ? '  — the WHOLE swept range' : '');
  }
  console.log(`\n    baseline local response: ${local}`);
  console.log(`    contiguous Cd 0.02x-0.03x run through baseline: ${band}`);
  console.log(`    full Cd series:    ${cds.map((c) => c.toFixed(5)).join('  ')}`);
  console.log(`    full proxy series: ${rows.map((r) => r.r.scalar.compositeV1.toFixed(6)).join('  ')}`);

  /* F2 — family-level kill (84.7) */
  const inelig = rows.filter((r) => r.r.ribbon.eligibility !== 'ELIGIBLE');
  const killed = inelig.length > rows.length / 3;
  if (inelig.length) {
    console.log(`    *** ${inelig.length}/${rows.length} INELIGIBLE at ${fam.param} = ${inelig.map((r) => r.value).join(', ')}` +
      (killed ? '  -> F2: this family\'s AERODYNAMIC INTERPRETATION IS KILLED and the parameter is barred from any grid'
              : '  (below the 1/3 threshold; interpretation stands)'));
    anomalies.push(`${fam.key}: ${inelig.length}/${rows.length} INELIGIBLE${killed ? ' — F2 KILL' : ''}`);
  }
  const invalid = rows.filter((r) => !r.validity.ok);
  if (invalid.length) anomalies.push(`${fam.key}: geometry INVALID at ${invalid.map((r) => r.value).join(', ')}`);

  results.push({ fam, rows, bounds, killed, local, band, cds });
  console.log('');
}

/* ================= A5 again: did the frozen path move under us? ================= */
const fpAfter = engineFingerprint();
console.log('='.repeat(126));
if (fpBefore !== fpAfter) {
  console.log('  *** A5 GLOBAL HARD STOP: the production engine changed during the run.');
  console.log(`      before ${fpBefore}`);
  console.log(`      after  ${fpAfter}`);
  process.exitCode = 1;
} else {
  console.log('  A5 PASS — the production engine is byte-identical before and after the run.');
}

/* ================= the summary table (84.9) ================= */
console.log('\n  SUMMARY — one row per family');
console.log('    family  n   Cd min      at        Cd max      at        Cd range   elig    flips  worst dPx%  0.02x-0.03x run');
for (const R of results) {
  const cds = R.cds, lo = Math.min(...cds), hi = Math.max(...cds);
  const at = (v) => R.rows[cds.indexOf(v)].value;
  const nElig = R.rows.filter((r) => r.r.ribbon.eligibility === 'ELIGIBLE').length;
  const flips = R.bounds.filter((b) => b.startsWith('class')).length;
  const worstPx = Math.max(...R.rows.map((r) => 100 * r.r.sensitivity.dProxy));
  console.log(`    ${R.fam.key}   ${String(R.rows.length).padStart(2)}  ${lo.toFixed(5)}  ${String(at(lo)).padEnd(8)}  ` +
    `${hi.toFixed(5)}  ${String(at(hi)).padEnd(8)}  ${(hi - lo).toFixed(5)}    ${nElig}/${R.rows.length}` +
    `${R.killed ? ' KILL' : '    '}  ${String(flips).padStart(3)}    ${worstPx.toFixed(1).padStart(6)}      ${R.band}`);
}

/* the basin count — a count with its list, not a verdict (84.9) */
const seen = new Map();
for (const r of allRows) {
  const k = `${r.param}=${r.value}`;
  const isBaseline = Math.abs(r.value - BASELINE[r.param]) < 1e-12;
  seen.set(isBaseline ? 'BASELINE' : k, r);
}
const distinct = [...seen.values()];
const inBand = distinct.filter((r) => r.r.cd.value >= 0.02 && r.r.cd.value < 0.03);
console.log(`\n  BASIN COUNT: ${inBand.length} of ${distinct.length} distinct variants land in Cd 0.02-0.03.`);
console.log('    ' + inBand.map((r) => `${r.param}=${r.value}(${r.r.cd.value.toFixed(4)})`).join('  '));

/* exploit flags — reported, never gating */
const flagged = allRows.filter((r) => ['EX1', 'EX2', 'EX3', 'EX4', 'EX5'].filter((k) => r.flags[k]).length >= 2);
console.log(`\n  EXPLOIT-PATTERN FLAGS (84.8.1) — reported, NEVER gating. ${flagged.length} row(s) trip two or more:`);
for (const r of flagged) {
  console.log(`    ${r.label.padEnd(24)} Cd ${r.r.cd.value.toFixed(5)}  proxy ${r.r.scalar.compositeV1.toFixed(6)}  ` +
    `F2a ${r.r.ribbon.F2a.toFixed(3)}  z4+z5 ${r.flags.zone45.toFixed(2)}  wetted ${Math.round(r.r.geometry.wettedArea).toLocaleString()}  [${exStr(r.flags)}]`);
}

console.log(`\n  ANOMALIES RECORDED (not repaired): ${anomalies.length}`);
for (const a of anomalies) console.log(`    - ${a}`);
console.log('\n  Nothing retuned. No calibration read or written. Production Cd path untouched.\n');

/* S1 determinism: this file is run twice in separate processes and the JSONs diffed */
const jsonArg = process.argv.indexOf('--json');
if (jsonArg > 0 && process.argv[jsonArg + 1]) {
  const dump = allRows.map((r) => ({
    label: r.label, param: r.param, value: r.value,
    proxy: r.r.scalar.compositeV1, cd: r.r.cd.value, pressure: r.r.cd.pressure, friction: r.r.cd.friction,
    cls: r.r.scalar.cls, elig: r.r.ribbon.eligibility, caps: r.capped,
    F1: r.r.ribbon.F1, F2a: r.r.ribbon.F2a, F3: r.r.ribbon.F3, F4: r.r.ribbon.F4, F5: r.r.ribbon.F5,
    zones: r.r.ribbon.zones, wetted: r.r.geometry.wettedArea, frontal: r.r.geometry.frontalArea,
    dCd: r.r.sensitivity.dCd, dProxy: r.r.sensitivity.dProxy, verdict: r.r.sensitivity.verdict,
    conf: r.r.ood.confidence, flags: r.flags,
  }));
  writeFileSync(process.argv[jsonArg + 1], JSON.stringify(dump, null, 1));
  console.log(`  wrote ${process.argv[jsonArg + 1]} (S1 determinism compare)\n`);
}
