/**
 * E2 ELLIPSOID GEOMETRY VERIFICATION (2026-08-16) — built on the
 * owner's challenge: "your shape generation might be fucking up —
 * that's the bit i can't see or verify at all." Two answers:
 *
 *  1. A PICTURE: the estimator-facing elevation silhouette of each
 *     exam mesh with the EXACT analytic ellipse overlaid — any lathe
 *     error is visible as daylight between the curves. Output:
 *     spike/sectional/gottingen2-verify.svg (dev-only, never bakes).
 *  2. NUMBERS: mesh frontal / wetted / volume vs the CLOSED-FORM
 *     spheroid formulas (prolate + oblate surface area, 4/3·π·a·b²
 *     volume). An ellipsoid is one of the few bodies where the exact
 *     answer exists to compare against.
 *
 * Verifies the exam meshes AS BUILT (same profile function, same
 * lathe parameters). No estimator change; no exam re-run.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureSections } from '../../src/sections.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { latheProfile } from './tn614-bodies.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/* EXACTLY the exam's profile function (gottingen2-ellipsoids.mjs). */
function ellipsoidProfile(lengthMm, diaMm, n = 64) {
  const rMaxPct = (diaMm / 2 / lengthMm) * 100;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = (Math.PI * i) / n;
    const xPct = 50 * (1 - Math.cos(th));
    const t = (xPct - 50) / 50;
    pts.push([xPct, rMaxPct * Math.sqrt(Math.max(0, 1 - t * t))]);
  }
  return pts;
}

/* Closed-form spheroid properties. a = semi-axis along flow, b = transverse. */
function analytic(lengthMm, diaMm) {
  const a = lengthMm / 2000, b = diaMm / 2000; // metres
  const frontal = Math.PI * b * b;
  const volume = (4 / 3) * Math.PI * a * b * b;
  let surface;
  if (a > b) { // prolate
    const e = Math.sqrt(1 - (b * b) / (a * a));
    surface = 2 * Math.PI * b * b * (1 + (a / (b * e)) * Math.asin(e));
  } else if (a < b) { // oblate
    const e = Math.sqrt(1 - (a * a) / (b * b));
    surface = 2 * Math.PI * b * b + Math.PI * ((a * a) / e) * Math.log((1 + e) / (1 - e));
  } else surface = 4 * Math.PI * b * b;
  return { frontal, volume, surface };
}

function meshVolume(verts, faces) {
  let v6 = 0;
  for (const [i, j, k] of faces) {
    const A = verts[i], B = verts[j], C = verts[k];
    v6 += A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0]);
  }
  return Math.abs(v6) / 6;
}

const CASES = [
  ['PROLATE 1:1.8 (l 360 / d 200)', 360, 200],
  ['OBLATE 1:0.75 (l 150 / d 200)', 150, 200],
];

const W = 900, ROW_H = 240, PAD = 24;
let svg = '', y = PAD + 10;
const pct = (m, a) => `${(100 * (m / a - 1)).toFixed(2)}%`;

for (const [name, lengthMm, diaMm] of CASES) {
  const mesh = latheProfile(ellipsoidProfile(lengthMm, diaMm), 128, 36);
  const scaleToM = 1 / 1000 / (lengthMm / 1000) * (lengthMm / 1000); // profile is %L; measure at lengthM
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: lengthMm / 1000 });
  const an = analytic(lengthMm, diaMm);
  // mesh volume: verts are in %L units → scale factor (L/100)³ with L in m
  const volScale = Math.pow((lengthMm / 1000) / 100, 3);
  const mVol = meshVolume(mesh.verts, mesh.faces) * volScale;

  console.log(`\n== ${name} ==`);
  console.log(`frontal  mesh ${g.frontalArea.toFixed(5)} m²  analytic ${an.frontal.toFixed(5)}  (${pct(g.frontalArea, an.frontal)})`);
  console.log(`wetted   mesh ${g.wettedArea.toFixed(5)} m²  analytic ${an.surface.toFixed(5)}  (${pct(g.wettedArea, an.surface)})`);
  console.log(`volume   mesh ${mVol.toFixed(6)} m³  analytic ${an.volume.toFixed(6)}  (${pct(mVol, an.volume)})`);

  // Silhouette (what the estimator sees) + exact analytic ellipse overlay.
  const m = measureSections(mesh.verts, mesh.faces, { axis: '+X', STATIONS: 128, silhouettes: true });
  const N = m.A.length, lo = m.silhouettes.elev.lo, hi = m.silhouettes.elev.hi;
  const rMaxPct = (diaMm / 2 / lengthMm) * 100;
  const boxW = 560, boxH = ROW_H - 90;
  const sc = Math.min(boxW / 100, boxH / (2 * rMaxPct));
  const x0 = PAD + 40, yMid = y + ROW_H / 2 - 20;
  const X = (xPct) => x0 + xPct * sc;
  const Y = (c) => yMid - c * sc;
  const pts = [];
  for (let i = 0; i < N; i++) if (hi[i] >= lo[i]) pts.push(`${X(((i + 0.5) / N) * 100).toFixed(1)},${Y(hi[i]).toFixed(1)}`);
  for (let i = N - 1; i >= 0; i--) if (hi[i] >= lo[i]) pts.push(`${X(((i + 0.5) / N) * 100).toFixed(1)},${Y(lo[i]).toFixed(1)}`);
  svg += `<polygon points="${pts.join(' ')}" fill="#c628a4" fill-opacity="0.30" stroke="none"/>`;
  // Exact analytic ellipse, dashed orange, on top:
  const ell = [];
  for (let i = 0; i <= 256; i++) {
    const th = (2 * Math.PI * i) / 256;
    ell.push(`${X(50 + 50 * Math.cos(th)).toFixed(1)},${Y(rMaxPct * Math.sin(th)).toFixed(1)}`);
  }
  svg += `<polyline points="${ell.join(' ')}" fill="none" stroke="#ff9900" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  svg += `<path d="M ${x0 - 16} ${yMid} l 26 -7 v 14 z" fill="#eee"/>`;
  svg += `<text x="${PAD}" y="${y + 6}" font-size="16" fill="#eaeaea" font-family="sans-serif" font-weight="bold">${name}</text>`;
  svg += `<text x="${PAD}" y="${y + 26}" font-size="12" fill="#888" font-family="monospace">pink fill = mesh silhouette the estimator measures · dashed orange = exact analytic ellipse</text>`;
  svg += `<text x="${x0 + boxW + 20}" y="${yMid - 20}" font-size="12" fill="#eee" font-family="monospace">frontal ${pct(g.frontalArea, an.frontal)}</text>`;
  svg += `<text x="${x0 + boxW + 20}" y="${yMid}" font-size="12" fill="#eee" font-family="monospace">wetted ${pct(g.wettedArea, an.surface)}</text>`;
  svg += `<text x="${x0 + boxW + 20}" y="${yMid + 20}" font-size="12" fill="#eee" font-family="monospace">volume ${pct(mVol, an.volume)}</text>`;
  y += ROW_H;
}

const H = y + PAD;
const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#111"/>
<text x="${PAD}" y="${PAD - 4}" font-size="13" fill="#888" font-family="sans-serif">E2 exam geometry check — mesh-as-built vs exact analytic ellipsoid. Flow arrow left. Deviations printed as mesh-vs-analytic %.</text>
${svg}</svg>`;
writeFileSync(join(here, 'gottingen2-verify.svg'), doc);
console.log('\nwrote spike/sectional/gottingen2-verify.svg');
