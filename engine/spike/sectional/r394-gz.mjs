/**
 * NACA REPORT 394 — GOODYEAR-ZEPPELIN MODEL FAMILY, GEOMETRY ONLY. Spec 94
 * pass 1. Source: Abbott 1931, NTRS 19930091467 scan, Tables I–III extracted
 * 2026-08-21 with tools/pdftext4.js. NO drag/lift value is transcribed here.
 *
 * THE FAMILY: one generating curve (Table I, stations %L, ordinates inches).
 * Four basic models share the curve and the max diameter, differing only in
 * length: fineness 3.6, 4.8, 6.0, 7.2 (an axial stretch family, like TR-291).
 * Four more (5.3, 5.6, 5.8, 6.8) insert a parallel middle body at maximum
 * diameter. Model lengths (Table III, inches): 27.4, 36.5, 45.7, 54.8 —
 * consistent with D = 7.614 in at each fineness to <0.1%.
 *
 * PARENT ATTRIBUTION BY VOLUME ARITHMETIC (the text says the middle bodies
 * went "in the two smallest basic models", but the printed volumes decide):
 * with cylinder area pi*R^2 = 45.54 in2 and parent 4.8 (V 1147, L 36.5):
 *   GZ-5.3: 1147 + 45.54*(40.3-36.5) = 1320 vs printed 1319  -> parent 4.8
 *   GZ-5.8: 1147 + 45.54*(44.1-36.5) = 1493 vs printed 1490  -> parent 4.8
 *   GZ-6.8: 1147 + 45.54*(51.7-36.5) = 1839 vs printed 1833  -> parent 4.8
 *   GZ-5.6: 1147 + 45.54*(42.6-36.5) = 1425 vs printed value OCR-GARBLED
 *           ("1,545"?) — the computed 1425 is adopted and the discrepancy
 *           FLAGGED for the reveal pass.
 * A 3.6 parent fails these identities by ~10%, so 4.8 is adopted for all four.
 *
 * EXTRACTION UNCERTAINTY, recorded per the owner's instruction:
 *   - the two nose stations after 0% are OCR-ambiguous. Two readings are
 *     carried: A = (0.438, 0.752), (1.90, 1.623); B = (0.63, 0.752),
 *     (1.83, 1.623). Both are built and the prediction difference REPORTED.
 *   - station 34.15 read as 34.75 (the 3.65% spacing; 34.15 breaks it).
 *   - ordinate at 9.20 read 2.858 ("2.158" breaks monotonic rise to 3.108).
 *   - ordinates at 45.70 and 49.35 are illegible; the curve is flat at max
 *     there; pchip bridges 42.05 -> 53.00 and the volume check must catch any
 *     material error.
 *   - 93.15's ordinate "1.49" read as 1.498 (column shows 3 decimals).
 * THE VALIDATOR: integrated volumes must reproduce Table III per model.
 */
import { pchip } from './tn614-bodies.mjs';

export const D_IN = 7.614, R_IN = D_IN / 2;

/* Table I — stations %L, ordinates inches (radius). Reading A nose. */
const CURVE_A = [
  [0.00, 0.000], [0.438, 0.752], [1.90, 1.623], [5.55, 2.264], [9.20, 2.858],
  [12.85, 3.108], [16.50, 3.358], [20.15, 3.533], [23.80, 3.653], [27.45, 3.730],
  [31.10, 3.775], [34.75, 3.798], [38.40, 3.807], [42.05, 3.808],
  [53.00, 3.780], [56.65, 3.738], [60.30, 3.667], [63.95, 3.590], [67.60, 3.470],
  [71.25, 3.315], [74.90, 3.127], [78.55, 2.902], [82.20, 2.630], [85.85, 2.313],
  [89.50, 1.937], [93.15, 1.498], [96.80, 0.973], [98.99, 0.529], [100.00, 0.000],
];
const CURVE_B = CURVE_A.map((p, i) => (i === 1 ? [0.63, 0.752] : i === 2 ? [1.83, 1.623] : p));

export const BASIC = { 3.6: 27.41, 4.8: 36.55, 6.0: 45.68, 7.2: 54.82 };   // L = fineness*D
export const MODELS = [
  { id: 'GZ-3.6', fineness: 3.6, kind: 'basic' },
  { id: 'GZ-4.8', fineness: 4.8, kind: 'basic' },
  { id: 'GZ-6.0', fineness: 6.0, kind: 'basic' },
  { id: 'GZ-7.2', fineness: 7.2, kind: 'basic' },
  { id: 'GZ-5.3', fineness: 5.3, kind: 'pmb', printedVol: 1319 },
  { id: 'GZ-5.6', fineness: 5.6, kind: 'pmb', printedVol: null /* OCR-garbled */ },
  { id: 'GZ-5.8', fineness: 5.8, kind: 'pmb', printedVol: 1490 },
  { id: 'GZ-6.8', fineness: 6.8, kind: 'pmb', printedVol: 1833 },
];
export const PRINTED_VOL = { 'GZ-3.6': 860, 'GZ-4.8': 1147, 'GZ-6.0': 1435, 'GZ-7.2': 1720 };
const X_MAX_PCT = 42.05;                       // max-ordinate station of the curve
const PARENT = 4.8;

/** r(x) in inches for a model; x in inches from nose. reading = 'A' | 'B' */
export function profileIn(model, reading = 'A') {
  const curve = reading === 'B' ? CURVE_B : CURVE_A;
  const f = pchip(curve.map(([s, r]) => [s, r]));
  if (model.kind === 'basic') {
    const L = model.fineness * D_IN;
    return { L, r: (x) => (x <= 0 || x >= L ? 0 : f((100 * x) / L)) };
  }
  /* parallel-middle-body model: 4.8 parent split at the max station */
  const Lp = PARENT * D_IN, L = model.fineness * D_IN, cyl = L - Lp;
  const xSplit = (X_MAX_PCT / 100) * Lp;
  return { L, r: (x) => {
    if (x <= 0 || x >= L) return 0;
    if (x <= xSplit) return f((100 * x) / Lp);
    if (x <= xSplit + cyl) return f(X_MAX_PCT);
    return f((100 * (x - cyl)) / Lp);
  } };
}

/** volume of revolution, in^3, midpoint rule */
export function volumeIn3(model, reading = 'A', n = 4000) {
  const { L, r } = profileIn(model, reading);
  let v = 0;
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * L) / n;
    v += Math.PI * r(x) ** 2 * (L / n);
  }
  return v;
}

/** the pass-1 validator: printed Table III volumes must reproduce */
export function gzSelfTest(tolFrac = 0.02) {
  const problems = [], rows = [];
  for (const m of MODELS) {
    const printed = m.kind === 'basic' ? PRINTED_VOL[m.id] : m.printedVol;
    const vA = volumeIn3(m, 'A');
    rows.push({ id: m.id, vA, printed });
    if (printed !== null && Math.abs(vA - printed) / printed > tolFrac) {
      problems.push(`${m.id}: integrated ${vA.toFixed(0)} vs printed ${printed}`);
    }
  }
  return { ok: problems.length === 0, problems, rows };
}
