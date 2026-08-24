/**
 * G0 / G0b — THE STEP-3 IDENTITY GATES. Spec 84.3. No experiment runs until
 * both pass.
 *
 *   G0   at the baseline parameters `buildSmartTail()` reproduces the stored
 *        surrogate `lab/sunship-tail-aerohull-candidate.obj`. Byte-for-byte is
 *        attempted first. The owner-permitted fallback is full-double-precision
 *        numerical identity, and TAKING IT MUST BE DECLARED WITH ITS REASON.
 *   G0b  the two copies of the engine source are still byte-identical.
 *
 * Neither produces an experimental result. They only say whether the instrument
 * is the thing it claims to be.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSmartTail, toObj, BASELINE, FIXED, CANDIDATE_OBJ } from './smart-tail.mjs';
import { parseObjMesh } from '../../../CalcV1-site/calcv2/src/obj.js';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
const ENGINE_FILES = ['obj.js', 'sections.js', 'cdEstimator.js', 'dynamicsGeometry.js'];
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

console.log('\nSTEP 3 IDENTITY GATES (spec 84.3)');
console.log('  No experiment runs until both pass. Neither produces a result.\n');

let fail = 0;

/* ---------------- G0b: one engine, two copies ---------------- */
console.log('  G0b — engine source copies');
let drift = 0;
for (const f of ENGINE_FILES) {
  const a = readFileSync(`${ROOT}CalcV2/src/${f}`);
  const b = readFileSync(`${ROOT}CalcV1-site/calcv2/src/${f}`);
  const same = a.equals(b);
  if (!same) drift++;
  console.log(`      ${f.padEnd(22)} CalcV2 ${sha(a)}   CalcV1-site ${sha(b)}   ${same ? 'IDENTICAL' : '*** DRIFTED ***'}`);
}
if (drift) { console.log(`      G0b FAIL — ${drift} file(s) drifted. A1: global hard stop.\n`); fail++; }
else console.log('      G0b PASS — step 3 reads the CalcV1-site copy, which is what production serves.\n');

/* ---------------- G0: the refactor IS the stored surrogate ---------------- */
console.log('  G0 — buildSmartTail(baseline) vs the stored candidate OBJ');
const storedText = readFileSync(CANDIDATE_OBJ, 'utf8');
const built = buildSmartTail(BASELINE);

/* the stored file's own 3-line header, reused verbatim: G0 tests the GEOMETRY,
   and a regenerated date stamp would be a false failure. */
const header = storedText.slice(0, storedText.indexOf('\nv ') + 1);
const builtText = toObj(built, header);

const byteEqual = builtText === storedText;
console.log(`      stored  ${storedText.length.toLocaleString()} bytes   sha ${sha(storedText)}`);
console.log(`      built   ${builtText.length.toLocaleString()} bytes   sha ${sha(builtText)}`);

if (byteEqual) {
  console.log('      G0 PASS — BYTE-FOR-BYTE. No fallback taken.\n');
} else {
  /* the declared fallback: full-precision numerical identity */
  const stored = parseObjMesh(storedText);
  const nv = stored.verts.length === built.verts.length;
  const nf = stored.faces.length === built.faces.length;
  let worstV = 0, badF = 0;
  const n = Math.min(stored.verts.length, built.verts.length);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) worstV = Math.max(worstV, Math.abs(stored.verts[i][k] - built.verts[i][k]));
  }
  const m = Math.min(stored.faces.length, built.faces.length);
  for (let i = 0; i < m; i++) {
    const a = stored.faces[i], b = built.faces[i];
    if (a.length !== b.length || a.some((v, k) => v !== b[k])) badF++;
  }
  /* the stored file is written to 5 dp, so exact agreement can only be claimed
     to that precision — state the bound rather than implying more */
  const numericalOk = nv && nf && badF === 0 && worstV <= 0.5e-5;
  console.log(`      NOT byte-equal. Falling back to numerical identity (84.3 G0-fallback).`);
  console.log(`      verts ${stored.verts.length} vs ${built.verts.length} ${nv ? 'OK' : 'MISMATCH'}` +
    `   faces ${stored.faces.length} vs ${built.faces.length} ${nf ? 'OK' : 'MISMATCH'}` +
    `   face-order mismatches ${badF}`);
  console.log(`      worst vertex coordinate difference ${worstV.toExponential(3)} m` +
    `   (the stored file is written to 5 dp, so 0.5e-5 is its own rounding floor)`);
  if (numericalOk) {
    console.log('      G0 PASS ON THE FALLBACK.');
    console.log('      DECLARED REASON: ' + declaredReason(storedText, builtText));
    console.log('');
  } else {
    console.log('      G0 FAIL — neither byte nor numerical identity. A1: global hard stop.\n');
    fail++;
  }
}

/** state exactly where the two texts first differ, so the fallback is never vague */
function declaredReason(a, b) {
  const la = a.split('\n'), lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return `first differing line ${i + 1}: stored "${(la[i] || '').slice(0, 60)}" vs built "${(lb[i] || '').slice(0, 60)}"`;
  }
  return 'texts differ only in trailing whitespace';
}

/* ---------------- baseline geometry, for the record ---------------- */
const P = built.params, V = built.validity;
console.log('  BASELINE, for the record (not a result):');
console.log(`      params      extraM ${P.extraM}  attach ${P.attach}  P ${P.P}  W ${P.W}  rTip ${P.rTip}`);
console.log(`      derived     ra ${P.ra.toFixed(3)} m at xA ${P.xA.toFixed(2)} m   xTip ${P.xTip} m   rTip ${P.rTipM.toFixed(3)} m`);
console.log(`      mesh        ${built.verts.length.toLocaleString()} verts / ${built.faces.length.toLocaleString()} faces` +
  `   (RINGS ${FIXED.RINGS}, SEGS ${FIXED.SEGS})`);
console.log(`      validity    minR ${V.minRadius.toFixed(4)}  maxFairingR ${V.maxFairingRadius.toFixed(3)}` +
  `  envelopeMaxR ${V.envelopeMaxRadius.toFixed(3)}  worstSlope ${V.worstSlope.toFixed(4)}  ${V.ok ? 'OK' : 'INVALID'}`);

console.log('');
if (fail) { console.log(`  ${fail} GATE FAILURE(S) — step 3 does not start.\n`); process.exitCode = 1; }
else console.log('  BOTH GATES PASS. Step 3 may run.\n');
