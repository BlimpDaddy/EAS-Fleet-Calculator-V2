/**
 * STEP 2b — KNOWN-TRUTH VALIDATION OF THE ELIGIBILITY GATE. Spec 51.6 step 2.
 *
 * THE FALSIFIABLE TARGET, as ruled:
 *     all ten known-good controls        -> ELIGIBLE
 *     all burned sharp-feature controls  -> INELIGIBLE
 *     invalid geometry                   -> INPUT FAILURE (E3 invariant)
 *
 * E1-E5 are reported INDIVIDUALLY for every family, not merely the final
 * classification. If the matrix fails anywhere this run STOPS and reports;
 * nothing in spec 51 is altered here.
 *
 * E5 STATUS: `elig-select-e5.mjs` ran the frozen 51.4 ascent on the ten
 * known-good controls and NO ladder value through 20 deg was clean. Per the
 * pre-registered branch, E5 FAILS AS A CRITERION and the gate runs E1-E4 with
 * the sharp-feature screening hole recorded. That is the registered fallback,
 * not an alteration. The jump magnitude is still PRINTED for every body as a
 * diagnostic, because it is informative -- but it is NOT a criterion here and
 * does not enter any verdict.
 *
 * The independent asymmetric chine is NOT touched by this file.
 */
import { analyticBody } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { evaluate, jumpCounts } from './eligibility.mjs';

const A = 3, B = 1, NX = 240, JIT = 0.4, D_FLAT = 0.700;
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
/** Burned Gate-2 body: prolate spheroid cut by the plane y = -0.700. */
const rcB = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2)) * B;
const chineFn = (x, th) => { const c = Math.cos(th); return c < -1e-12 ? Math.min(rcB(x), D_FLAT / -c) : rcB(x); };

const build = (fn, gen, nt) => (gen ? GENERATORS[gen](fn, A, NX, nt, JIT) : analyticBody(fn, A, { nx: NX, nt }));

/* ---- the ten Gate-1 known-good controls, verbatim from skin-gate1.mjs */
const GOOD = [];
for (const nt of [30, 118]) {
  for (const [label, gen] of [['regular', null], ['G1 sine jitter', 'sineJitter'], ['G2 block density', 'blockDensity'],
    ['G3 azimuthal shear', 'azimuthalShear'], ['G4 surface walk', 'surfaceWalk']]) {
    GOOD.push({ label: `${label} nt=${nt}`, fn: rc, gen, nt, want: 'ELIGIBLE' });
  }
}
/* ---- the four burned Gate-2 sharp-feature controls, verbatim from skin-gate2.mjs */
const BAD = [];
for (const nt of [96, 30]) {
  for (const [label, gen] of [['regular', null], ['G1 jitter 0.4', 'sineJitter']]) {
    BAD.push({ label: `chine ${label} nt=${nt}`, fn: chineFn, gen, nt, want: 'INELIGIBLE' });
  }
}

const E5_APPLIED = null;   // E5 failed selection on known-good controls — registered E1-E4 fallback

function row(r, want, jump) {
  const f = (k) => (r[k] ? (r[k].pass ? ' PASS' : ' FAIL') : '  -  ');
  const ok = r.outcome === want;
  return `  ${r.label.padEnd(24)} ${f('E1')} ${f('E2')} ${f('E3')} ${f('E4')} ${f('E5')}   ` +
    `${jump.padStart(9)}  ${r.outcome.padEnd(14)} ${ok ? 'as expected' : `*** EXPECTED ${want} ***`}`;
}

console.log('\nSTEP 2b — KNOWN-TRUTH VALIDATION OF THE ELIGIBILITY GATE (spec 51.6 step 2)');
console.log('E5 not applied: it failed the 51.4 selection ascent on the known-good ten.');
console.log('Gate runs E1-E4, the pre-registered fallback. Jump magnitude shown as DIAGNOSTIC ONLY.\n');
console.log('  body                       E1    E2    E3    E4    E5    maxJump  outcome        check');

const results = [];
for (const b of [...GOOD, ...BAD]) {
  const mesh = build(b.fn, b.gen, b.nt);
  const r = evaluate(mesh.verts, mesh.faces, { e5ThresholdDeg: E5_APPLIED, label: b.label });
  let jump = 'n/a';
  try { jump = `${jumpCounts(mesh.verts, mesh.faces, []).maxDeg.toFixed(2)}deg`; } catch { /* diagnostic only */ }
  results.push({ ...b, r, jump });
  console.log(row(r, b.want, jump));
}

/* ---- E3 invariant: invalid geometry must become INPUT FAILURE, never
   either eligibility outcome. Synthetic garbage only; no control is spent. */
console.log('\n  E3 FAILURE-HANDLING INVARIANT — invalid geometry must NOT reach an eligibility answer:');
const base = analyticBody(rc, A, { nx: NX, nt: 30 });
const clone = () => ({ verts: base.verts.map((v) => [...v]), faces: base.faces.map((f) => [...f]) });

const INVALID = [
  ['non-manifold (extra face on an existing edge)', () => {
    const m = clone(); const f0 = m.faces[0];
    m.verts.push([m.verts[f0[0]][0], m.verts[f0[0]][1] * 1.5, m.verts[f0[0]][2] * 1.5]);
    m.faces.push([f0[0], f0[1], m.verts.length - 1]);
    return m;
  }],
  ['open surface (faces removed)', () => { const m = clone(); m.faces.splice(0, 40); return m; }],
  ['degenerate faces (repeated index)', () => { const m = clone(); for (let i = 0; i < 5; i++) m.faces[i] = [m.faces[i][0], m.faces[i][1], m.faces[i][1]]; return m; }],
  ['degenerate scale (all vertices coincident)', () => {
    const m = clone(); m.verts = m.verts.map(() => [0, 0, 0]); return m;
  }],
  ['too few vertices', () => ({ verts: [[0, 0, 0], [1, 0, 0]], faces: [[0, 1, 0]] })],
];

let e3ok = true;
for (const [label, make] of INVALID) {
  const m = make();
  const r = evaluate(m.verts, m.faces, { e5ThresholdDeg: E5_APPLIED, label });
  const ok = r.outcome === 'INPUT FAILURE';
  if (!ok) e3ok = false;
  console.log(`    ${label.padEnd(46)} -> ${r.outcome.padEnd(14)} ${ok ? 'correct' : '*** LEAKED TO AN ELIGIBILITY ANSWER ***'}`);
  console.log(`      ${(r.E3.problems || []).slice(0, 2).join('; ') || '(none reported)'}`);
}
console.log(`    self-intersection: NOT TESTED — declared hole, 51.4 / eligibility.mjs header`);

/* ---- per-condition detail, since the classification alone is not the report */
console.log('\n  E1 detail — fit fallbacks over the retained domain (nearest + empty + linear must be 0):');
for (const x of results) {
  const e = x.r.E1;
  if (!e) { console.log(`    ${x.label.padEnd(24)} (not reached — ${x.r.outcome})`); continue; }
  console.log(`    ${x.label.padEnd(24)} quad ${String(e.quadratic).padStart(7)}  lin ${String(e.linear).padStart(6)}  ` +
    `nearest ${String(e.nearest).padStart(5)}  empty ${String(e.empty).padStart(5)}   hu ${e.huDeg.toFixed(2)}deg  ${e.pass ? 'PASS' : 'FAIL'}`);
}

console.log('\n  E2 detail — multi-hit / missed rays per ribbon count (both must be 0 at 12, 24 and 48):');
for (const x of results) {
  const e = x.r.E2;
  if (!e) { console.log(`    ${x.label.padEnd(24)} (not reached)`); continue; }
  console.log(`    ${x.label.padEnd(24)} ` + e.byCount.map((c) => `p${c.planes}: multi ${c.multi} missed ${c.missed}`).join('   ') + `   ${e.pass ? 'PASS' : 'FAIL'}`);
}

console.log('\n  E4 detail — worst median zone-turning shift across 12/24/48 (must be < 5%):');
for (const x of results) {
  const e = x.r.E4;
  if (!e) { console.log(`    ${x.label.padEnd(24)} (not reached)`); continue; }
  const at = e.worstShiftAt;
  console.log(`    ${x.label.padEnd(24)} worst ${(100 * e.worstShift).toFixed(2).padStart(7)}%  ` +
    `${at ? `at ${at.pair} zone ${at.zone} (${at.a.toFixed(3)} -> ${at.b.toFixed(3)} deg)` : ''}   ${e.pass ? 'PASS' : 'FAIL'}`);
}

console.log('\n  10 reporting rule — median / worst / spread across ribbons, p=24, zones 1..8 (deg):');
for (const x of results) {
  const e = x.r.E4;
  if (!e) continue;
  const p = e.profile.find((q) => q.planes === 24);
  console.log(`    ${x.label.padEnd(24)} med ` + p.zones.map((z) => z.median.toFixed(2).padStart(6)).join(''));
  console.log(`    ${''.padEnd(24)} wst ` + p.zones.map((z) => z.worst.toFixed(2).padStart(6)).join('') +
    `   maxSpread ${Math.max(...p.zones.map((z) => z.spread)).toFixed(3)}`);
}

/* ---- verdict */
const goodRes = results.filter((r) => r.want === 'ELIGIBLE');
const badRes = results.filter((r) => r.want === 'INELIGIBLE');
const goodOk = goodRes.filter((r) => r.r.outcome === 'ELIGIBLE').length;
const badOk = badRes.filter((r) => r.r.outcome === 'INELIGIBLE').length;

console.log('\n' + '='.repeat(78));
console.log(`  known-good -> ELIGIBLE      : ${goodOk} / ${goodRes.length}`);
console.log(`  burned chine -> INELIGIBLE  : ${badOk} / ${badRes.length}`);
console.log(`  invalid -> INPUT FAILURE    : ${e3ok ? 'all correct' : 'LEAK DETECTED'}`);
const pass = goodOk === goodRes.length && badOk === badRes.length && e3ok;
console.log(`\n  STEP 2: ${pass ? 'PASS — the gate separates known-good from known-bad.' : 'FAIL — STOP AND REPORT. Spec 51 is NOT to be altered here.'}`);
if (!pass) {
  const wrong = results.filter((r) => r.r.outcome !== r.want);
  for (const w of wrong) console.log(`    ${w.label}: got ${w.r.outcome}, expected ${w.want}` +
    `${w.r.failed && w.r.failed.length ? ` (failed ${w.r.failed.join(', ')})` : ' (no condition failed)'}`);
}
console.log('='.repeat(78) + '\n');
