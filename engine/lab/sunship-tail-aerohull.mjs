/**
 * SUNSHIP + DEPLOYABLE AERO FAIRING — aero-hull candidate generator.
 *
 * Same route as the cigar aero hull (2026-08-17): authored-by-formula,
 * lathed to a closed mesh, then scored down the PRODUCTION path — not the
 * lab's own shortcut. That distinction is the point of this file. Every
 * tail number quoted before today came from lab/tail-lab.mjs, which
 * bypassed the classifier and (until 2026-08-18) built a geometrically
 * impossible profile. This runs measureSectionalProxy() -> estimateCd(),
 * the exact pair the deployed page calls, so the answer is the
 * calculator's answer rather than a script's.
 *
 * NEVER DEPLOYS: lab/ is not in the bake list.
 * Run from CalcV2:  node lab/sunship-tail-aerohull.mjs
 *
 * GEOMETRY (Toby's ruling 2026-08-18):
 *   - the 300 m figure is the ENVELOPE, nose to rear of envelope
 *   - the fairing is a SHROUD picked up at 80% of the envelope, wrapping
 *     the rear 20%. NOTE (r20, 2026-08-19): the construction matches
 *     RADIUS at the attach point and nothing else — the slope is NOT
 *     matched, so this is radius-continuous, not tangential. Earlier
 *     wording here claimed tangency and was wrong.
 *   - it extends EXTRA_M beyond the envelope; stowed, the vehicle is
 *     unchanged at 300 m with full buoyancy
 *   - profile r(x) = ra * ((x_tip - x)/(x_tip - x_a))^P, P ~ 0.8 optimum
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { measureSections } from '../src/sections.js';
import { measureSectionalProxy, estimateCd } from '../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';

const here = dirname(fileURLToPath(import.meta.url));
const SUNSHIP = join(here, '..', '..', '..', '3D OBJ', 'Sunship.obj');
const LENGTH_M = 300;          // the ENVELOPE, per the ruling
const EXTRA_M = Number(process.env.EXTRA_M ?? 216);
const ATTACH = Number(process.env.ATTACH ?? 0.80);
const P = Number(process.env.P ?? 0.8);
const SPEED_KMH = 100;
const RINGS = 320, SEGS = 64;

// ---- 1. the envelope's own measured profile ----
const mesh = parseObjMesh(readFileSync(SUNSHIP, 'utf8'));
const m = measureSections(mesh.verts, mesh.faces, { axis: '+Z', STATIONS: 256 });
const N = m.A.length, scale = LENGTH_M / m.L, cellM = m.cell * scale, dx = LENGTH_M / N;
const rHull = Array.from(m.A, (a) => Math.sqrt((a * cellM * cellM) / Math.PI));

// ---- 2. graft the fairing, anchored so the surfaces meet ----
const ia = Math.min(N - 1, Math.round((ATTACH * LENGTH_M) / dx - 0.5));
const ra = rHull[ia], xA = (ia + 0.5) * dx, xTip = LENGTH_M + EXTRA_M;
const radiusAt = (x) => (x <= xA
  ? rHull[Math.min(N - 1, Math.max(0, Math.round(x / dx - 0.5)))]
  : (x < xTip ? ra * Math.pow((xTip - x) / (xTip - xA), P) : 0));

// ---- 3. lathe to a closed mesh along +X ----
const verts = [], faces = [], ringStart = [];
for (let i = 0; i <= RINGS; i++) {
  const x = (xTip * i) / RINGS;
  const r = Math.max(radiusAt(x), 0);
  if (r < 1e-6) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
  ringStart.push(verts.length);
  for (let s = 0; s < SEGS; s++) {
    const th = (2 * Math.PI * s) / SEGS;
    verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
  }
}
const ringSize = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
for (let i = 0; i < RINGS; i++) {
  const a = ringStart[i], b = ringStart[i + 1];
  const aPole = ringSize(i) === 1, bPole = ringSize(i + 1) === 1;
  if (aPole && bPole) continue;
  for (let s = 0; s < SEGS; s++) {
    const s1 = (s + 1) % SEGS;
    if (aPole) faces.push([a, b + s, b + s1]);
    else if (bPole) faces.push([a + s, b, a + s1]);
    else { faces.push([a + s, b + s, b + s1]); faces.push([a + s, b + s1, a + s1]); }
  }
}

// ---- 4. score it down the PRODUCTION path ----
const proxyRec = measureSectionalProxy(verts, faces, { axis: '+X' });
const geom = measureDynamicsGeometry(verts, faces, { flightAxis: 'X', lengthM: xTip });
const est = estimateCd(proxyRec, geom, SPEED_KMH);

const fmt = (x, n = 4) => (x === null || x === undefined ? 'null' : Number(x).toFixed(n));
console.log('== SUNSHIP + AERO FAIRING — production estimator ==');
console.log(`envelope ${LENGTH_M} m · fairing picks up at ${(100 * ATTACH).toFixed(0)}% (x=${xA.toFixed(0)} m, r=${ra.toFixed(1)} m)`);
console.log(`extends +${EXTRA_M} m beyond the envelope · deployed ${xTip} m · profile exponent P=${P}`);
console.log(`mesh: ${verts.length.toLocaleString()} verts / ${faces.length.toLocaleString()} faces`);
console.log('');
console.log(`  bluffness (proxy)   ${fmt(proxyRec.proxy)}`);
console.log(`  CLASS               ${proxyRec.cls}`);
console.log(`  triggers            reExp ${fmt(proxyRec.triggers?.rawRatio, 3)} · base ${fmt(proxyRec.triggers?.terminalBaseFrac, 4)} · shoulder ${fmt(proxyRec.triggers?.shoulder, 4)}`);
console.log(`  mesh parity         oddFraction ${fmt(proxyRec.quality?.oddFraction, 5)}`);
console.log(`  frontal area        ${Math.round(geom.frontalArea).toLocaleString()} m2`);
console.log(`  wetted area         ${Math.round(geom.wettedArea).toLocaleString()} m2`);
console.log('');
console.log(`  friction Cd         ${fmt(est.frictionCd)}`);
console.log(`  pressure Cd         ${fmt(est.pressureCd)}`);
console.log(`  Cd ESTIMATE         ${fmt(est.cdEstimate)}   status ${est.status}`);
console.log(`  band (+/-20%)       ${fmt(est.band?.[0])} .. ${fmt(est.band?.[1])}`);
console.log(`  regime              reD ${est.provenance.regime.reD.toExponential(2)} · crisisBlend ${fmt(est.provenance.regime.crisisBlend, 3)}`);
console.log('');
console.log(`  vs authored 0.043   ${fmt(est.cdEstimate / 0.043, 2)}x`);

if (process.env.WRITE_OBJ) {
  const out = join(here, 'sunship-tail-aerohull-candidate.obj');
  let s = `# Sunship + deployable aero fairing — authored-by-formula ${new Date().toISOString().slice(0, 10)}\n`;
  s += `# envelope ${LENGTH_M} m, fairing at ${ATTACH} of length, +${EXTRA_M} m, P=${P}, deployed ${xTip} m\n`;
  s += `# production estimate Cd ${fmt(est.cdEstimate)} (${proxyRec.cls}, proxy ${fmt(proxyRec.proxy)})\n`;
  for (const v of verts) s += `v ${v[0].toFixed(5)} ${v[1].toFixed(5)} ${v[2].toFixed(5)}\n`;
  for (const f of faces) s += `f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1}\n`;
  writeFileSync(out, s);
  console.log(`\nwrote ${out}`);
}
