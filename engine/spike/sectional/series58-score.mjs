/**
 * SERIES 58 — THE REVEAL. Spec 61.4 scoring, run ONCE.
 *
 * Both orderings were frozen in spec 63 (commit e3baaa2) before Table 2 was
 * opened. Nothing here is fitted; this only counts concordant pairs.
 *
 * TABLE 2, "Net Residual-Resistance Coefficients for Series 58 Forms at Deep
 * Submergence", PDF p29, transcribed below. Units 1e-3 throughout.
 *
 * OCR ON 4170 — RESOLVED FROM THE REPORT'S OWN TEXT, NOT FROM INFERENCE.
 * The cell reads "0o.8 x 10-3". I first read it 0.08, reasoning from the
 * abstract. THAT WAS WRONG. The discussion (PDF p40) states: "The nose radius
 * of 0.5, used on the parent, appears to be most satisfactory and it does not
 * seem to be advisable to use a nose radius greater than 0.8." So r0 = 1.00
 * must be WORSE than the parent's 0.13, which forces 0.18. The abstract's
 * "no definite minimum ... except for the nose radius" refers to the EHP
 * merit curve being flat and uncritical, not to the residual coefficient.
 *
 * The transcription is corroborated at four independent points by the same
 * discussion: r1 = 0.2 "most satisfactory" -> 4174 lowest in G-TAIL (0.10);
 * m = 0.36 optimum -> 4160 lowest in G-M (0.12); model 4165 "approximately
 * 1 percent higher than the selected minimum" -> 4165 lowest in G-CP (0.07);
 * and residual falling monotonically with L/D while friction rises, giving
 * the stated EHP optimum near L/D 6.5.
 */
import { GROUPS, EXPOSED, SOLVED } from './series58-data.mjs';

const CD = {
  4154: 0.58, 4155: 0.36, 4156: 0.22, 4157: 0.13, 4158: 0.09, 4159: 0.075,
  4160: 0.12, 4161: 0.15, 4162: 0.17, 4163: 0.19, 4164: 0.37, 4165: 0.07,
  4166: 0.28, 4167: 0.16, 4168: 0.14, 4169: 0.14, 4170: 0.18, 4171: 0.13,
  4172: 0.13, 4173: 0.13, 4174: 0.10, 4175: 0.32, 4176: 0.41, 4177: 0.16,
};
const OCR_AMBIGUOUS = [4170];

/* frozen in spec 63, most drag -> least */
const PRED_RIBBON = {
  'G-NOSE': [4170, 4169, 4157, 4168, 4167],
  'G-TAIL': [4171, 4172, 4157, 4173, 4174],
  'G-M':    [4163, 4162, 4161, 4157, 4160, 4177],
  'G-CP':   [4164, 4165, 4166, 4157],
  'G-LD':   [4154, 4155, 4156, 4157, 4158, 4159],
  'G-CP5':  [4176, 4175, 4155],
};
const PRED_SCALAR = {   // compositeV1 descending, from spec 63.4
  'G-NOSE': [4167, 4168, 4157, 4169, 4170],
  'G-TAIL': [4174, 4173, 4157, 4172, 4171],
  'G-M':    [4163, 4177, 4162, 4160, 4161, 4157],
  'G-CP':   [4166, 4157, 4165, 4164],
  'G-LD':   [4154, 4155, 4156, 4157, 4158, 4159],
  'G-CP5':  [4175, 4176, 4155],
};

/** concordant / discordant / tied pairs against measured resistance */
function score(order, ids) {
  const rank = new Map(order.map((m, i) => [m, i]));   // 0 = predicted worst
  let c = 0, d = 0, tie = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    if (CD[a] === CD[b]) { tie++; continue; }
    const measuredWorse = CD[a] > CD[b] ? a : b;
    const predictedWorse = rank.get(a) < rank.get(b) ? a : b;
    if (measuredWorse === predictedWorse) c++; else d++;
  }
  return { c, d, tie, n: c + d };
}

const fmt = (s) => `${s.c}/${s.n}` + (s.tie ? ` (+${s.tie} tied)` : '');

console.log('\nSPEC 61.4 REVEAL — Series 58 net residual resistance vs the spec-63 frozen orderings');
console.log('  Orderings frozen at commit e3baaa2 BEFORE this table was opened. Nothing fitted.\n');
console.log('  group     varies   measured, most drag -> least (1e-3)');
for (const [g, ids] of Object.entries(GROUPS)) {
  const byCd = [...ids].sort((a, b) => CD[b] - CD[a]);
  console.log(`  ${g.padEnd(8)}  ${(g === 'G-NOSE' ? 'r0' : g === 'G-TAIL' ? 'r1' : g === 'G-M' ? 'm' : g === 'G-LD' ? 'L/D' : 'Cp').padEnd(6)}  ` +
    byCd.map((m) => `${m}:${CD[m].toFixed(3)}${EXPOSED.includes(m) ? '*' : ''}`).join('  '));
}

console.log('\n  CONCORDANT PAIRS — frozen prediction vs measured (ties excluded from n):');
console.log('  group      RIBBONS (59.4)      SCALAR (compositeV1)   winner');
let rw = 0, sw = 0, rc = 0, rn = 0, sc2 = 0, sn = 0;
for (const [g, ids] of Object.entries(GROUPS)) {
  const R = score(PRED_RIBBON[g], ids), S = score(PRED_SCALAR[g], ids);
  rc += R.c; rn += R.n; sc2 += S.c; sn += S.n;
  const w = R.c > S.c ? 'RIBBONS' : S.c > R.c ? 'scalar' : 'tie';
  if (R.c > S.c) rw++; if (S.c > R.c) sw++;
  console.log(`  ${g.padEnd(8)}   ${fmt(R).padEnd(19)} ${fmt(S).padEnd(22)} ${w}`);
}
console.log(`  ${'TOTAL'.padEnd(8)}   ${(rc + '/' + rn).padEnd(19)} ${(sc2 + '/' + sn).padEnd(22)} ` +
  `groups won: ribbons ${rw}, scalar ${sw}`);

console.log('\n  UNSEEN-VALUE SUBSET (spec 63.5) — models whose values were never exposed:');
let rc2 = 0, rn2 = 0, sc3 = 0, sn2 = 0;
for (const [g, ids] of Object.entries(GROUPS)) {
  const clean = ids.filter((m) => !EXPOSED.includes(m));
  if (clean.length < 2) { console.log(`  ${g.padEnd(8)}   <${clean.length} model(s), no pairs>`); continue; }
  const R = score(PRED_RIBBON[g], clean), S = score(PRED_SCALAR[g], clean);
  rc2 += R.c; rn2 += R.n; sc3 += S.c; sn2 += S.n;
  console.log(`  ${g.padEnd(8)}   ribbons ${fmt(R).padEnd(16)} scalar ${fmt(S)}`);
}
console.log(`  ${'TOTAL'.padEnd(8)}   ribbons ${rc2}/${rn2}          scalar ${sc3}/${sn2}`);

console.log('\n  THE HEAD-TO-HEAD (spec 63.3) — G-NOSE, where the two predicted OPPOSITE orderings:');
const ids = GROUPS['G-NOSE'];
console.log('    model  r0    measured   ribbons said   scalar said');
for (const m of [...ids].sort((a, b) => SOLVED[a].r0 - SOLVED[b].r0)) {
  console.log(`    ${m}  ${SOLVED[m].r0.toFixed(2)}  ${CD[m].toFixed(3)}${EXPOSED.includes(m) ? '*' : ' '}${OCR_AMBIGUOUS.includes(m) ? ' (OCR?)' : '       '}` +
    `   rank ${PRED_RIBBON['G-NOSE'].indexOf(m) + 1}/5        rank ${PRED_SCALAR['G-NOSE'].indexOf(m) + 1}/5`);
}
const Rn = score(PRED_RIBBON['G-NOSE'], ids), Sn = score(PRED_SCALAR['G-NOSE'], ids);
console.log(`    ribbons ${fmt(Rn)}   scalar ${fmt(Sn)}`);
console.log('\n  ( * = value exposed before groups were frozen, spec 62.1 )\n');
