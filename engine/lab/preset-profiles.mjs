/**
 * PRESET PROFILE CARD (dev-only) — draws what the estimator SEES for
 * each preset: the true elevation silhouette along the flight axis,
 * nose on the LEFT (flying left), with proxies + calibrated estimates
 * for BOTH signs of the authored axis. Built for the cigar/bottle
 * nose-direction ruling (Toby, 2026-08-16). Output: lab/preset-profiles.svg
 * Run from CalcV2: `node lab/preset-profiles.mjs`
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { parseGlbVertices } from '../src/glb.js';
import { convexHull } from '../src/hull.js';
import { measureSections, scoreSections } from '../src/sections.js';
import { calibratePressure } from '../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';
import { ittcCf, NU_M2_S } from '../src/dynamicsCore.js';

const here = dirname(fileURLToPath(import.meta.url));
const GLB = (id) => join(here, '..', '..', 'site', 'assets', 'shape-models', `${id}.glb`);
const CORPUS = (f) => join(here, '..', '..', '..', '3D OBJ', f);

const SHAPES = [
  ['sunship', 'Sunship.obj', 'Z'],
  ['cigar', 'cigar.obj', 'Z'],
  ['bottle', 'Bottle.obj', 'Y'],
  ['car', 'car.obj', 'Z'],
  ['washingmachine', 'washingmachine.obj', 'Y'],
  ['aerosmena', 'Aerosmena.obj', 'Z'],
];

function loadMesh(id, objName) {
  // Same source hierarchy as the record generator (2026-08-16 amendment):
  // corpus faces > corpus point-hull (bare design body) > glb hull (may
  // include appendages — the finned-cigar wedge lesson).
  if (objName && existsSync(CORPUS(objName))) {
    const m = parseObjMesh(readFileSync(CORPUS(objName), 'utf8'));
    if (m.faces.length) return m;
    return { verts: m.verts, faces: convexHull(m.verts).faces };
  }
  const verts = parseGlbVertices(new Uint8Array(readFileSync(GLB(id))));
  return { verts, faces: convexHull(verts).faces };
}

function estimateAt(mesh, axisLetter, signedAxis, lengthM = 300, kmh = 100) {
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: axisLetter, lengthM });
  const proxy = scoreSections(measureSections(mesh.verts, mesh.faces, { axis: signedAxis })).compositeV1;
  const v = kmh / 3.6;
  const friction = ittcCf((v * lengthM) / NU_M2_S) * (g.wettedArea / g.frontalArea);
  return { proxy, cd: friction + calibratePressure(proxy) };
}

const ROW_H = 150, W = 900, PAD = 20;
let svg = '';
let y = PAD;
for (const [id, objName, axisLetter] of SHAPES) {
  const mesh = loadMesh(id, objName);
  for (const sign of ['+', '-']) {
    const ax = sign + axisLetter;
    const m = measureSections(mesh.verts, mesh.faces, { axis: ax, STATIONS: 128, silhouettes: true });
    const e = estimateAt(mesh, axisLetter, ax);
    // Silhouette polygon: nose (station 0) on the LEFT, flying left.
    const N = m.A.length;
    const pts = [];
    const lo = m.silhouettes.elev.lo, hi = m.silhouettes.elev.hi;
    let cMin = Infinity, cMax = -Infinity;
    for (let i = 0; i < N; i++) if (hi[i] >= lo[i]) { cMin = Math.min(cMin, lo[i]); cMax = Math.max(cMax, hi[i]); }
    const boxW = 320, boxH = ROW_H / 2 - 24;
    const sc = Math.min(boxW / m.L, boxH / (cMax - cMin));
    const x0 = PAD + 90, yMid = y + (ROW_H / 4);
    const X = (i) => x0 + ((i + 0.5) / N) * m.L * sc;
    const Y = (c) => yMid + (c - (cMin + cMax) / 2) * sc;
    for (let i = 0; i < N; i++) if (hi[i] >= lo[i]) pts.push(`${X(i).toFixed(1)},${Y(hi[i]).toFixed(1)}`);
    for (let i = N - 1; i >= 0; i--) if (hi[i] >= lo[i]) pts.push(`${X(i).toFixed(1)},${Y(lo[i]).toFixed(1)}`);
    svg += `<polygon points="${pts.join(' ')}" fill="#c628a4" fill-opacity="0.25" stroke="#c628a4" stroke-width="1.5"/>`;
    // Flight arrow (ship flies LEFT; nose is the left end):
    svg += `<path d="M ${x0 - 14} ${yMid} l 26 -7 v 14 z" fill="#ff9900"/>`;
    svg += `<text x="${PAD}" y="${yMid + 4}" font-size="13" fill="#eee" font-family="monospace">${sign}${axisLetter}</text>`;
    svg += `<text x="${x0 + boxW + 30}" y="${yMid - 4}" font-size="13" fill="#eee" font-family="monospace">proxy ${e.proxy.toFixed(3)}</text>`;
    svg += `<text x="${x0 + boxW + 30}" y="${yMid + 14}" font-size="13" fill="#ff9900" font-family="monospace">Cd est ${e.cd.toFixed(3)} (300 m, 100 km/h)</text>`;
    y += ROW_H / 2;
  }
  svg += `<text x="${PAD}" y="${y - ROW_H + 8}" font-size="16" fill="#eaeaea" font-family="sans-serif" font-weight="bold">${id.toUpperCase()}</text>`;
  svg += `<line x1="${PAD}" y1="${y + 2}" x2="${W - PAD}" y2="${y + 2}" stroke="#474747"/>`;
  y += 14;
}
const H = y + PAD;
const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#111"/>
<text x="${PAD}" y="${PAD - 4}" font-size="13" fill="#888" font-family="sans-serif">What the estimator sees — elevation silhouettes, NOSE LEFT (flying left). Both signs of each authored axis. Screening grade ±20%.</text>
${svg}</svg>`;
writeFileSync(join(here, 'preset-profiles.svg'), doc);
console.log('wrote lab/preset-profiles.svg');
