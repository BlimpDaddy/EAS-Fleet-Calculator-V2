/**
 * ribbon-render/1 V0 FIXTURES — the sealed plan's V0 definition of done,
 * executed. Pass conditions were pre-registered in
 * DYNAMIC-VISUALIZER-BUILD-PLAN.md §4 before this file existed.
 *
 *   G0  machinery self-tests (house rule: no result before its self-test)
 *   G1  byte-stability: two CLEAN PROCESSES produce identical payloadIds
 *   G2  decode-vs-source quantization: quantized fields within 0.5 quantum
 *   G3  second body (sphere) exports through the same code path
 *   G4  E+A+S round trip: accepted body gains extended; refusing body gets
 *       the fully-defined null case (visual absence only) — exemplars
 *       sphere/washingmachine since the 2026-08-22 cigar-axis amendment
 *   G5  size budget: fail > 256 KB, warn > 200 KB
 *   G6  serializer forbids non-finite / undefined; normalizes -0
 *   G7  canonical round-trip: parse(bytes) re-serializes to the SAME bytes
 *   G8  payloadId verifies against the exclusion rule
 *   G9  grid contract structure
 *
 * Run from CalcV2:  node viz/test/run-fixtures.mjs
 */
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supportRadiiSelfTest, reflexSelfTest } from '../../spike/sectional/support-skin.mjs';
import { buildBodyPayload } from '../run-payloads.mjs';
import { canonicalStringify, verifyPayloadId } from '../layer1/canonical-json.mjs';
import { Q, SIZE_WARN_BYTES, SIZE_FAIL_BYTES, N_STATIONS, N_THETA } from '../layer1/constants.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(here, '..', 'run-payloads.mjs');

let failures = 0;
const gate = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

/* G0 — self-tests first */
const sr = supportRadiiSelfTest(), rf = reflexSelfTest();
gate('G0 supportRadii self-test', sr.ok);
gate('G0 reflexCount self-test', rf.ok);

/* build once in-process (the port guard inside the generator also runs here) */
const sun = buildBodyPayload('sunship', 'authored');

/* G1 — byte stability across two clean processes */
const h1 = execFileSync(process.execPath, [RUNNER, '--hash-only', 'sunship'], { encoding: 'utf8' }).trim();
const h2 = execFileSync(process.execPath, [RUNNER, '--hash-only', 'sunship'], { encoding: 'utf8' }).trim();
gate('G1 byte-stable across two clean processes', h1 === h2 && h1 === sun.payloadId, `${h1} / ${h2} / in-process ${sun.payloadId}`);

/* G2 — decode-vs-source quantization (quantum from constants.Q) */
{
  const qM = 0.5 * 10 ** -Q.METERS, qA = 0.5 * 10 ** -Q.AREA_M2;
  const rails = sun.payload.retracted.railsRM;
  let worst = 0;
  for (let s = 0; s < N_STATIONS; s++) {
    worst = Math.max(worst, Math.abs(rails[s] - sun.raw.retractedRail0[s]));
  }
  gate('G2 rails quantization ≤ 0.5 quantum', worst <= qM + 1e-12, `worst ${worst.toExponential(2)}`);
  gate('G2 frontal area quantization', Math.abs(sun.payload.frame.frontalAreaM2 - sun.raw.frontalAreaM2) <= qA + 1e-9);
  gate('G2 sphere1 radius quantization', Math.abs(sun.payload.spheres.sphere1.radiusM - sun.raw.sphere1RadiusM) <= qM + 1e-9);
}

/* G3 — second body, same code path, no special-casing */
{
  const sp = buildBodyPayload('sphere', 'none');
  const p = sp.payload;
  const ok = p.schema === 'ribbon-render/1' && p.feedsNumbers === false
    && p.retracted && p.retracted.eligibility && p.retracted.railsRM.length === N_THETA * N_STATIONS
    && p.extended === null && p.spheres.sphere2 === null && verifyPayloadId(p);
  gate('G3 sphere preset exports cleanly', ok, `eligibility ${p.retracted?.eligibility?.outcome}`);
}

/* G4 — E+A+S regeneration round trip.
   AMENDED 2026-08-22: the accepting exemplar is the SPHERE. The original
   "cigar accepts" premise was measured against a mis-declared cigar axis
   ('+X' for a z-long file — a 300 × 2211 m pancake); the TRUE cigar
   refuses the generic tail honestly (aft closes 0.09 m slower than the
   fairing taper at 81% of length). The fixture's intent — an accepting
   body gains extended + a regenerated payloadId; a refusing body gets
   the fully-defined null — is unchanged. */
{
  const bare = buildBodyPayload('sphere', 'none');
  const tailed = buildBodyPayload('sphere', 'generic');
  const okAccept = tailed.payload.extended !== null
    && tailed.payload.spheres.sphere2 !== null
    && tailed.payloadId !== bare.payloadId;
  gate('G4 accepted body: generic tail present, payloadId regenerated', okAccept,
    `sphere bare ${bare.payloadId} → tailed ${tailed.payloadId}`);

  const wm = buildBodyPayload('washingmachine', 'generic');
  const p = wm.payload, r = p.retracted.extentM;
  const wantXMax = r.x1M + p.worldBounds.wakeMarginFrac * r.lengthM;
  const okRefuse = p.extended === null
    && p.spheres.sphere2 === null
    && Math.abs(p.worldBounds.xMaxM - wantXMax) <= 0.02
    && /refused/.test(p.extendedReason)
    && /toggle and numbers untouched/.test(p.extendedReason);
  gate('G4 refusing body: fully-defined null case, visual absence only', okRefuse, p.extendedReason);
}

/* G5 — size budget */
{
  const n = sun.bytes.length;
  gate('G5 size ≤ fail budget (256 KB)', n <= SIZE_FAIL_BYTES, `${(n / 1024).toFixed(1)} KB`);
  if (n > SIZE_WARN_BYTES) console.log(`      note: over the 200 KB warn budget`);
}

/* G6 — serializer refusals and -0 */
{
  const throws = (v) => { try { canonicalStringify(v); return false; } catch { return true; } };
  gate('G6 NaN refused', throws({ a: NaN }));
  gate('G6 Infinity refused', throws([1, Infinity]));
  gate('G6 undefined refused', throws({ a: undefined }));
  gate('G6 -0 normalizes to 0', canonicalStringify({ a: -0 }) === '{"a":0}');
}

/* G7 — canonical round-trip identity (proves key order + number formatting) */
{
  const reparsed = JSON.parse(sun.bytes);
  gate('G7 parse → re-serialize reproduces bytes', canonicalStringify(reparsed) === sun.bytes);
}

/* G8 — payloadId exclusion rule */
gate('G8 payloadId verifies', verifyPayloadId(sun.payload));

/* G9 — grid contract structure */
{
  const p = sun.payload;
  const okLen = p.retracted.railsRM.length === N_THETA * N_STATIONS
    && p.retracted.tangentRad.length === N_THETA * N_STATIONS
    && p.extended.railsRM.length === N_THETA * N_STATIONS
    && p.grid.thetaRad.length === N_THETA;
  const d = p.retracted.tangentDomain;
  gate('G9 grid contract lengths + tangent domain', okLen && d.i0 > 0 && d.i1 < N_STATIONS - 1 && d.i0 < d.i1);
}

console.log(failures ? `\n${failures} FIXTURE(S) FAILED` : '\nALL V0 FIXTURES PASS');
process.exit(failures ? 1 : 0);
