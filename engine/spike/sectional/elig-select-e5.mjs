/**
 * STEP 2a — E5 THRESHOLD SELECTION. Spec 51.4 / 51.6 step 2.
 *
 * SELECTION DATA IS THE TEN GATE-1 KNOWN-GOOD CONTROLS AND NOTHING ELSE.
 * The burned flat/chine bodies are VALIDATION data now, not selection data,
 * and this file does not import, build or evaluate one. The selected value is
 * frozen into the spec BEFORE `elig-validate.mjs` is run, so the chines
 * cannot move the number that is supposed to classify them.
 *
 * THE RULE, AS FROZEN IN 51.4 AND RESTATED BY THE REVIEWER:
 *   use the smallest clean value from the ladder, STARTING AT 10 deg;
 *   ascend 10 -> 15 -> 20; take the first at which ALL TEN families return a
 *   zero count. If none through 20 deg is clean, E5 FAILS AS A CRITERION and
 *   the gate falls back to E1-E4 with the hole recorded.
 *
 * Values below 10 deg are printed for information ONLY. They are NOT
 * selection-eligible: the ascent starts at 10 by the frozen rule, and
 * reporting them must not become a reason to reach lower.
 *
 * "Clean" is a ZERO count of retained-domain windows above the threshold, on
 * geometry that is known-smooth. There is no tracing, linking or span filter
 * anywhere in this file.
 */
import { analyticBody } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { jumpCounts, E5_SELECT_LADDER_DEG, E5_REPORT_LADDER_DEG } from './eligibility.mjs';

const A = 3, NX = 240, JIT = 0.4;
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));

/** The ten Gate-1 families, verbatim from `skin-gate1.mjs`. */
const FAMILIES = [
  ['regular', null], ['G1 sine jitter', 'sineJitter'], ['G2 block density', 'blockDensity'],
  ['G3 azimuthal shear', 'azimuthalShear'], ['G4 surface walk', 'surfaceWalk'],
];
const BODIES = [];
for (const nt of [30, 118]) for (const [label, gen] of FAMILIES) BODIES.push({ label, gen, nt });

console.log('\nSTEP 2a — E5 THRESHOLD SELECTION (spec 51.4)');
console.log('selection data: the TEN GATE-1 KNOWN-GOOD controls only. No chine body is built here.');
console.log('magnitude occurrence count only — no linking, no span filter, no completion, no tracing.\n');

const head = E5_REPORT_LADDER_DEG.map((d) => `${d}deg`.padStart(8)).join('');
console.log(`  family              nt     maxJump    NaN%${head}`);

const rows = [];
for (const b of BODIES) {
  const mesh = b.gen ? GENERATORS[b.gen](rc, A, NX, b.nt, JIT) : analyticBody(rc, A, { nx: NX, nt: b.nt });
  const jc = jumpCounts(mesh.verts, mesh.faces, E5_REPORT_LADDER_DEG);
  rows.push({ ...b, jc });
  const cells = E5_REPORT_LADDER_DEG.map((d) => String(jc.counts.get(d)).padStart(8)).join('');
  console.log(`  ${b.label.padEnd(19)} ${String(b.nt).padEnd(5)} ${jc.maxDeg.toFixed(2).padStart(8)}deg ` +
    `${(100 * jc.nanFrac).toFixed(1).padStart(5)}%${cells}`);
}

console.log('\n  worst count across the ten families, per ladder value:');
for (const d of E5_REPORT_LADDER_DEG) {
  const worst = Math.max(...rows.map((r) => r.jc.counts.get(d)));
  const who = rows.filter((r) => r.jc.counts.get(d) === worst).map((r) => `${r.label} nt=${r.nt}`);
  const eligible = E5_SELECT_LADDER_DEG.includes(d);
  console.log(`    ${String(d).padStart(4)} deg  worst ${String(worst).padStart(6)}  ` +
    `${worst === 0 ? 'CLEAN' : `dirty (${who.slice(0, 2).join(', ')}${who.length > 2 ? ', ...' : ''})`}` +
    `${eligible ? '' : '   [report only — not selection-eligible]'}`);
}

let selected = null;
for (const d of E5_SELECT_LADDER_DEG) {
  const worst = Math.max(...rows.map((r) => r.jc.counts.get(d)));
  console.log(`\n  ascent step: test ${d} deg -> worst count ${worst} -> ${worst === 0 ? 'CLEAN, SELECTED' : 'not clean, ascend'}`);
  if (worst === 0) { selected = d; break; }
}

console.log('\n' + '='.repeat(78));
if (selected !== null) {
  console.log(`  E5 THRESHOLD SELECTED: ${selected} deg`);
  console.log('  Selected on known-good controls only. FREEZE THIS INTO THE SPEC BEFORE');
  console.log('  ANY BURNED CHINE BODY IS EVALUATED.');
} else {
  console.log('  E5 FAILS AS AN ELIGIBILITY CRITERION — no ladder value through 20 deg is clean.');
  console.log('  Per 51.4 the gate falls back to E1-E4 only, with the loss of sharp-feature');
  console.log('  screening recorded as a known hole. NO RESCUE IS ATTEMPTED.');
}
console.log('='.repeat(78) + '\n');
