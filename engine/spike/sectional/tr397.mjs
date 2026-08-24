/**
 * TR-397 BLIND EXAM — six real airships vs the FROZEN estimator
 * (2026-08-16). Companion artifact to tn614.mjs; becomes historical the
 * moment results are recorded. Run from CalcV2: `node spike/sectional/tr397.mjs`
 *
 * SOURCE: NACA Report No. 397, "The Drag Characteristics of Several
 * Airships Determined by Deceleration Tests", Thompson & Kirschbaum,
 * Langley, March 2 1931 (NTRS 19930091470, public domain; re-fetched
 * 2026-08-16; 13 pages with OCR layer + 500-dpi renders).
 *
 * EXAM RULES (FROZEN r11 #8 BEFORE this run): predict the BARE HULL,
 * report the RAW GAP vs measured complete-airship values; NO post-hoc
 * appendage subtraction; tracing anchored to published dims, done
 * before seeing errors, with tracing sensitivity; the exam is INVALID
 * if traces/k/θ/knots/basis/allowance change after seeing results.
 *
 * PRE-REGISTERED HYPOTHESIS (recorded in NEXT-THREAD.md before this
 * run): if the calibration map's unanchored middle (proxy 0.18–0.82)
 * over-charges, the predictions will come out HIGH by roughly
 * 1.5–2.5× beyond the declared appendage gap; if they land within the
 * band, the cigar-class numbers stand.
 *
 * MEASURED DATA (Table II, verified internally: CD_v = dragArea /
 * totalAirVolume^(2/3) reproduces every printed coefficient):
 *  - Measured values INCLUDE fins, cars, and rigging — only propellers
 *    and the air-speed head were subtracted by the authors. The bare
 *    hull the estimator predicts is therefore EXPECTED to sit BELOW
 *    the measured values by an appendage margin the report does not
 *    quantify (its own fig. 25 bare-hull model discussion suggests
 *    appendages are a substantial fraction on small blimps).
 *  - The report flags ~10% day-to-day scatter (Puritan first vs second
 *    test; TC-6 vs TC-10 same shape differ 0.035 vs 0.040) — this
 *    corpus is inherently looser than TN-614's controlled family.
 *  - Reynolds numbers are the report's own (overall-length basis).
 *
 * TRACING METHOD (all rules declared before running the estimator):
 * fig. 24 rendered at 500 dpi; per-column top-contour extraction
 * (avoids cars/gondolas below the hull); axis = line through nose/tail
 * tip midpoints; 9-px median denoise (kills suspension-line/label
 * strokes); FIN-CLIP rule: hull max radius taken from the FORWARD 65%,
 * then radius forced non-increasing aft of it (clips fin bumps to the
 * hull line) — the -RAWFINS variants keep the bumps as the tracing
 * sensitivity probe; 25 ordinates; x anchored to published LENGTH,
 * max radius anchored to published DIAMETER/2 (aspect forced to the
 * published fineness ratio — drawing distortion ~7% removed);
 * tips pinned to r = 0.
 *
 * NO CALIBRATION CHANGE occurs here. Any knot promotion from these
 * results is a separate dated ruling after external review.
 */
import { measureSectionalProxy, estimateCd, calibratePressure } from '../../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf } from '../../src/dynamicsCore.js';
import { latheProfile } from './tn614-bodies.mjs';

const FT = 0.3048;

/* Table II, NACA TR-397 (+ Re from fig. 24, millions, overall-length
 * basis). dragAreaFt2 is the report's net drag area D/q; measured
 * frontal-basis CD_A = dragArea / (π D²/4) — the EXACT conversion. */
export const SHIPS = [
  { key: 'los-angeles', name: 'USS Los Angeles', profile: 'los-angeles', hullVolFt3: 2760000, totalAirVolFt3: 2840000, lengthFt: 656, diameterFt: 90.7, fr: 7.23, dragAreaFt2: 463, cdV: 0.023, reM: 350 },
  { key: 'tc-10', name: 'Army TC-10', profile: 'tc', hullVolFt3: 200600, totalAirVolFt3: 207700, lengthFt: 195.8, diameterFt: 44.5, fr: 4.40, dragAreaFt2: 141, cdV: 0.040, reM: 71 },
  { key: 'tc-6', name: 'Army TC-6', profile: 'tc', hullVolFt3: 200600, totalAirVolFt3: 207700, lengthFt: 195.8, diameterFt: 44.5, fr: 4.40, dragAreaFt2: 124, cdV: 0.035, reM: 71 },
  { key: 'puritan-1', name: 'Goodyear Puritan (1st)', profile: 'puritan', hullVolFt3: 85870, totalAirVolFt3: 89300, lengthFt: 127.5, diameterFt: 36.4, fr: 3.50, dragAreaFt2: 87, cdV: 0.044, reM: 34 },
  { key: 'puritan-2', name: 'Goodyear Puritan (2nd)', profile: 'puritan', hullVolFt3: 85870, totalAirVolFt3: 89300, lengthFt: 127.5, diameterFt: 36.4, fr: 3.50, dragAreaFt2: 97, cdV: 0.049, reM: 34 },
  { key: 'zmc-2', name: 'Navy ZMC-2', profile: 'zmc2', hullVolFt3: 202200, totalAirVolFt3: 203300, lengthFt: 149.4, diameterFt: 52.7, fr: 2.83, dragAreaFt2: 149, cdV: 0.043, reM: 50 },
  { key: 'te-2', name: 'Army TE-2', profile: 'te2', hullVolFt3: 80200, totalAirVolFt3: 82900, lengthFt: 136, diameterFt: 34.0, fr: 4.00, dragAreaFt2: 86, cdV: 0.045, reM: 36 },
];

/* Hull profiles traced from fig. 24 (method above): [x %L, r %L]. */
export const PROFILES = {
  'los-angeles': [[0.0, 0.000], [4.2, 3.371], [8.3, 4.746], [12.5, 5.608], [16.7, 6.059], [20.8, 6.408], [25.0, 6.654], [29.2, 6.832], [33.3, 6.907], [37.5, 6.913], [41.7, 6.848], [45.8, 6.755], [50.0, 6.623], [54.2, 6.426], [58.3, 6.125], [62.5, 5.858], [66.7, 5.523], [70.8, 5.187], [75.0, 4.783], [79.2, 4.413], [83.3, 4.245], [87.5, 4.245], [91.7, 4.245], [95.8, 1.293], [100.0, 0.000]],
  'los-angeles-RAWFINS': [[0.0, 0.000], [4.2, 3.371], [8.3, 4.746], [12.5, 5.608], [16.7, 6.059], [20.8, 6.408], [25.0, 6.654], [29.2, 6.832], [33.3, 6.907], [37.5, 6.913], [41.7, 6.851], [45.8, 6.755], [50.0, 6.625], [54.2, 6.426], [58.3, 6.125], [62.5, 5.858], [66.7, 5.523], [70.8, 5.187], [75.0, 4.783], [79.2, 4.414], [83.3, 4.762], [87.5, 5.624], [91.7, 6.007], [95.8, 1.293], [100.0, 0.000]],
  'tc': [[0.0, 0.000], [4.2, 4.688], [8.3, 7.236], [12.5, 8.970], [16.7, 10.248], [20.8, 10.841], [25.0, 11.320], [29.2, 11.342], [33.3, 11.364], [37.5, 11.156], [41.7, 11.156], [45.8, 10.956], [50.0, 10.648], [54.2, 10.443], [58.3, 10.193], [62.5, 9.808], [66.7, 9.371], [70.8, 9.045], [75.0, 8.502], [79.2, 8.502], [83.3, 8.502], [87.5, 8.502], [91.7, 5.509], [95.8, 4.039], [100.0, 0.000]],
  'tc-RAWFINS': [[0.0, 0.000], [4.2, 4.688], [8.3, 7.236], [12.5, 8.970], [16.7, 10.248], [20.8, 10.841], [25.0, 11.320], [29.2, 11.342], [33.3, 11.364], [37.5, 11.157], [41.7, 11.178], [45.8, 10.973], [50.0, 10.653], [54.2, 10.446], [58.3, 10.193], [62.5, 9.808], [66.7, 9.371], [70.8, 9.048], [75.0, 8.502], [79.2, 10.578], [83.3, 10.600], [87.5, 10.622], [91.7, 5.509], [95.8, 4.039], [100.0, 0.000]],
  'te2': [[0.0, 0.000], [4.2, 5.190], [8.3, 7.942], [12.5, 9.990], [16.7, 11.160], [20.8, 11.890], [25.0, 12.269], [29.2, 12.473], [33.3, 12.500], [37.5, 12.356], [41.7, 12.379], [45.8, 12.379], [50.0, 12.076], [54.2, 11.756], [58.3, 11.606], [62.5, 11.274], [66.7, 10.782], [70.8, 10.447], [75.0, 10.447], [79.2, 10.447], [83.3, 10.447], [87.5, 6.702], [91.7, 5.328], [95.8, 3.601], [100.0, 0.000]],
  'te2-RAWFINS': [[0.0, 0.000], [4.2, 4.922], [8.3, 7.531], [12.5, 9.474], [16.7, 10.583], [20.8, 11.276], [25.0, 11.635], [29.2, 11.828], [33.3, 11.854], [37.5, 11.717], [41.7, 11.740], [45.8, 11.766], [50.0, 11.458], [54.2, 11.151], [58.3, 11.010], [62.5, 10.699], [66.7, 10.229], [70.8, 12.089], [75.0, 12.448], [79.2, 12.474], [83.3, 12.500], [87.5, 6.355], [91.7, 5.053], [95.8, 3.415], [100.0, 0.000]],
  'puritan': [[0.0, 0.000], [4.2, 4.862], [8.3, 7.415], [12.5, 9.703], [16.7, 11.255], [20.8, 12.316], [25.0, 13.010], [29.2, 13.786], [33.3, 13.949], [37.5, 14.275], [41.7, 14.274], [45.8, 13.946], [50.0, 13.782], [54.2, 13.147], [58.3, 12.963], [62.5, 12.206], [66.7, 11.490], [70.8, 10.774], [75.0, 10.058], [79.2, 9.015], [83.3, 8.872], [87.5, 8.872], [91.7, 8.872], [95.8, 3.147], [100.0, 0.000]],
  'puritan-RAWFINS': [[0.0, 0.000], [4.2, 4.862], [8.3, 7.415], [12.5, 9.703], [16.7, 11.255], [20.8, 12.316], [25.0, 13.010], [29.2, 13.786], [33.3, 13.949], [37.5, 14.275], [41.7, 14.274], [45.8, 13.946], [50.0, 13.782], [54.2, 13.147], [58.3, 12.963], [62.5, 12.206], [66.7, 11.490], [70.8, 10.774], [75.0, 10.058], [79.2, 9.015], [83.3, 10.914], [87.5, 11.812], [91.7, 11.771], [95.8, 3.147], [100.0, 0.000]],
  'zmc2': [[0.0, 0.000], [4.2, 7.450], [8.3, 10.441], [12.5, 12.707], [16.7, 14.257], [20.8, 15.650], [25.0, 16.573], [29.2, 17.184], [33.3, 17.637], [37.5, 17.622], [41.7, 17.606], [45.8, 17.278], [50.0, 17.106], [54.2, 16.777], [58.3, 16.292], [62.5, 15.651], [66.7, 14.853], [70.8, 14.055], [75.0, 13.101], [79.2, 13.100], [83.3, 13.100], [87.5, 9.142], [91.7, 7.379], [95.8, 5.388], [100.0, 0.000]],
  'zmc2-RAWFINS': [[0.0, 0.000], [4.2, 7.450], [8.3, 10.441], [12.5, 12.707], [16.7, 14.257], [20.8, 15.650], [25.0, 16.573], [29.2, 17.184], [33.3, 17.637], [37.5, 17.622], [41.7, 17.606], [45.8, 17.278], [50.0, 17.106], [54.2, 16.777], [58.3, 16.292], [62.5, 15.651], [66.7, 14.853], [70.8, 14.055], [75.0, 13.101], [79.2, 16.834], [83.3, 16.643], [87.5, 9.142], [91.7, 7.379], [95.8, 5.388], [100.0, 0.000]],
};

const f3 = (x) => x.toFixed(3);

function examine(ship, profileKey) {
  const mesh = latheProfile(PROFILES[profileKey]);
  const lengthM = ship.lengthFt * FT;
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM });
  const p = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' });
  const friction = ittcCf(ship.reM * 1e6) * (g.wettedArea / g.frontalArea);
  const pressure = calibratePressure(p.proxy);
  return { proxy: p.proxy, friction, pressure, predicted: friction + pressure };
}

console.log('== TR-397 BLIND EXAM — frozen estimator vs six real airships (deceleration tests, 1931) ==');
console.log('Measured values INCLUDE fins+cars (report subtracted only propellers + air-speed head).');
console.log('Internal check: CD_v = dragArea / totalAirVol^(2/3):');
for (const s of SHIPS) {
  const cdvCheck = s.dragAreaFt2 / Math.pow(s.totalAirVolFt3, 2 / 3);
  console.log(`  ${s.name.padEnd(24)} printed ${s.cdV.toFixed(3)}  recomputed ${cdvCheck.toFixed(4)}`);
}

console.log('\nship                      f.r.   proxy   friction  pressure  PREDICTED  MEASURED   gap');
console.log('                                                              (bare hull) (with fins+cars)');
const rows = [];
for (const s of SHIPS) {
  const e = examine(s, s.profile);
  const frontal = Math.PI * s.diameterFt * s.diameterFt / 4;
  const measured = s.dragAreaFt2 / frontal;
  const gap = 100 * (e.predicted - measured) / measured;
  rows.push({ ...s, ...e, measured, gap });
  console.log(`${s.name.padEnd(24)} ${s.fr.toFixed(2).padStart(5)}  ${f3(e.proxy)}   ${f3(e.friction)}    ${f3(e.pressure)}     ${f3(e.predicted)}     ${f3(measured)}   ${gap >= 0 ? '+' : ''}${gap.toFixed(0)}%`);
}

console.log('\n[sensitivity 1] RAWFINS traces (fin bumps kept — tracing sensitivity):');
for (const s of SHIPS.filter((x, i, a) => a.findIndex((y) => y.profile === x.profile) === i)) {
  const eH = examine(s, s.profile), eR = examine(s, s.profile + '-RAWFINS');
  console.log(`  ${s.profile.padEnd(14)} hull proxy ${f3(eH.proxy)} -> predicted ${f3(eH.predicted)}   rawfins proxy ${f3(eR.proxy)} -> ${f3(eR.predicted)}`);
}

console.log('\n[verdict vs the PRE-REGISTERED hypothesis]');
const bare = rows.map((r) => r.gap);
const mean = bare.reduce((a, b) => a + b, 0) / bare.length;
console.log(`  raw gaps: ${rows.map((r) => `${r.key} ${r.gap >= 0 ? '+' : ''}${r.gap.toFixed(0)}%`).join(' · ')}`);
console.log(`  mean raw gap ${mean >= 0 ? '+' : ''}${mean.toFixed(0)}% (bare-hull prediction vs WITH-appendage measurement — a negative-leaning gap is EXPECTED from appendages alone)`);
console.log('  hypothesis said: mid-map over-charge would show predictions HIGH by ~1.5-2.5x (i.e. +50..+150%) BEYOND the appendage direction.');
console.log('  NO calibration change occurs here — knot promotion is a separate dated ruling after external review.');
