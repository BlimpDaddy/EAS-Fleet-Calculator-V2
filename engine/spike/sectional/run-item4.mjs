/**
 * ITEM 4 RUNNER — the corpus rescore. Spec 90, rulings 90.7.
 *
 *   node run-item4.mjs blind          -> Göttingen predictions ONLY, frozen to
 *                                        ITEM4-BLIND-GOTTINGEN.txt. Measured
 *                                        tables NOT read. Commit before full.
 *   node run-item4.mjs full [out.json]-> whole corpus; asserts the Göttingen
 *                                        predictions equal the blind file;
 *                                        joins measured c_w; full table.
 *
 * HARD RULES (90.5): no calibration/routing/authority change; bit-equality per
 * body (81.2, inside evaluate); flips print their trigger; eligibility
 * failures stay failures; defects recorded, not repaired.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadCorpus, quietImport, NU } from './item4-corpus.mjs';
import { evaluate } from './batch-harness.mjs';
import { ittcCf } from '../../../site/calcv2/src/dynamicsCore.js';
import { measureSectionalProxy } from '../../../site/calcv2/src/cdEstimator.js';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';
const ENGINE = ['obj.js', 'sections.js', 'cdEstimator.js', 'dynamicsGeometry.js', 'dynamicsCore.js'];
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const fingerprint = () => ENGINE.map((f) => f + ':' + sha(readFileSync(`${ROOT}site/calcv2/src/${f}`))).join(' ');
const BLIND_FILE = 'ITEM4-BLIND-GOTTINGEN.txt';

function scoreBody(b) {
  const s = b.build();
  const r = evaluate({ ...s, identity: `${b.grade}(${b.id})` },
    { label: b.id, lengthM: b.lengthM, speedKmh: b.speedKmh });
  /* resolution-sensitivity column: same builder at 768x224, PROXY ONLY (90.1) */
  let resDrift = null;
  if (!b.nonAxisym) {
    const hi = b.build(768, 224);
    const p = measureSectionalProxy(hi.verts, hi.faces, { axis: '+X' });
    resDrift = (p.proxy - r.scalar.compositeV1) / Math.max(r.scalar.compositeV1, 1e-12);
  }
  /* R3 quantities, kept separate and named precisely */
  const reL = ((b.speedKmh / 3.6) * b.lengthM) / NU;
  const cf = ittcCf(reL);
  const frictionCanon = cf * (r.geometry.wettedArea / r.geometry.frontalArea);
  const residual = b.measured ? b.measured.total - frictionCanon : null;
  return { b, r, resDrift, reL, frictionCanon, residual };
}

const blindLine = (x) =>
  `${x.b.id}  proxy ${x.r.scalar.compositeV1.toFixed(6)}  class ${x.r.scalar.cls}  ` +
  `Cd ${x.r.cd.value.toFixed(5)}  press ${x.r.cd.pressure.toFixed(5)}  fric ${x.r.cd.friction.toFixed(5)}  ` +
  `F1 ${x.r.ribbon.F1.toFixed(4)}  F2a ${x.r.ribbon.F2a.toFixed(3)}  F3 ${x.r.ribbon.F3.toFixed(4)}  ` +
  `F4 ${x.r.ribbon.F4.toFixed(4)}  F5 ${x.r.ribbon.F5.toFixed(4)}  ` +
  `A1 ${x.r.ribbon.modes.A1.toFixed(4)}  A2 ${x.r.ribbon.modes.A2.toFixed(4)}  A4 ${x.r.ribbon.modes.A4.toFixed(4)}  ` +
  `elig ${x.r.ribbon.eligibility}  conf ${x.r.ood.confidence}`;

const mode = process.argv[2];
if (mode !== 'blind' && mode !== 'full') { console.error('usage: node run-item4.mjs blind|full [out.json]'); process.exit(2); }

const fpBefore = fingerprint();
const corpus = await loadCorpus();

if (mode === 'blind') {
  /* ---- Göttingen ONLY. The measured tables are NOT imported in this phase. ---- */
  const rows = corpus.filter((b) => b.gottingen).map(scoreBody);
  let out = 'ITEM 4 — GÖTTINGEN BLIND PREDICTIONS (spec 90.7 R2). FROZEN BEFORE the\n';
  out += 'measured c_w tables are joined. Declared blind condition: v = 30 m/s.\n';
  out += 'Disclosure (90.7): T35 oblate rows were displayed during inventory; the\n';
  out += 'oblate reveal is procedurally blind, not epistemically blind. T36 is clean.\n\n';
  for (const x of rows) out += blindLine(x) + '\n';
  out += `\nengine ${fpBefore}\n`;
  writeFileSync(BLIND_FILE, out);
  console.log(out);
  console.log(`written to ${BLIND_FILE} — COMMIT THIS before running the full phase.`);
  process.exit(0);
}

/* ================= FULL PHASE ================= */
console.log('\nITEM 4 — THE CORPUS RESCORE (spec 90, rulings 90.7)');
console.log(`  ${corpus.length} bodies, one canonical convention. No calibration read or written.\n`);

/* the blind gate: Göttingen predictions must equal the committed blind file */
const blindText = readFileSync(BLIND_FILE, 'utf8');
const rows = [];
for (const b of corpus) {
  let x;
  try { x = scoreBody(b); }
  catch (e) { console.log(`  ${b.id}: EVALUATION FAILED — ${e.message}`); rows.push({ b, error: e.message }); continue; }
  if (b.gottingen) {
    const line = blindLine(x);
    if (!blindText.includes(line)) {
      throw new Error(`BLIND GATE VIOLATION: ${b.id} prediction differs from the committed blind file.\n  now:  ${line}`);
    }
  }
  rows.push(x);
}

/* join the Göttingen measured values — the SPEND (90.7 R2) */
const gott = await quietImport('./gottingen2-ellipsoids.mjs');
for (const x of rows) {
  if (!x.b || !x.b.gottingen || x.error) continue;
  const table = gott[x.b.gottingen];
  /* nearest tabulated row to the declared blind condition v = 30 m/s */
  let best = null;
  for (const row of table) if (!best || Math.abs(row[1] - 30) < Math.abs(best[1] - 30)) best = row;
  x.b.measured = { total: best[4], basis: `Zahlentafel c_w ${best[4]} at v=${best[1]} m/s (nearest tabulated to the declared 30 m/s)` };
  x.residual = x.b.measured.total - x.frictionCanon;
  x.spent = true;
}

/* ================= the table ================= */
console.log('  id                    role                          proxy      class    CdPred   CdMeas   fricCanon resid    F2a     A2      A4      elig        conf       resDrift');
for (const x of rows) {
  if (x.error) continue;
  const m = x.b.measured;
  console.log(`  ${x.b.id.padEnd(21)} ${x.b.role.slice(0, 29).padEnd(29)} ${x.r.scalar.compositeV1.toFixed(6)}  ` +
    `${x.r.scalar.cls.padEnd(8)} ${x.r.cd.value.toFixed(5)}  ${m ? m.total.toFixed(5) : '   -   '}  ` +
    `${x.frictionCanon.toFixed(5)}  ${x.residual !== null && x.residual !== undefined ? x.residual.toFixed(5).padStart(8) : '    -   '} ` +
    `${x.r.ribbon.F2a.toFixed(3).padStart(6)}  ${x.r.ribbon.modes.A2.toFixed(4)}  ${x.r.ribbon.modes.A4.toFixed(4)}  ` +
    `${x.r.ribbon.eligibility.padEnd(11)} ${x.r.ood.confidence.padEnd(9)}  ` +
    `${x.resDrift === null ? '  n/a' : ((100 * x.resDrift).toFixed(1) + '%').padStart(6)}`);
}

/* ================= per-question summaries (data only; interpretation is 90.6's separate step) ================= */
const abs = rows.filter((x) => !x.error && x.b.measured && x.b.medium.startsWith('air') && x.b.family !== 'airship (complete, appendaged)');
console.log('\n  ABSOLUTE-CAPABLE AIR BODIES (excl. appendaged TR-397), sorted by proxy — the Q1/Q5 spine:');
console.log('    id                    proxy      canonical residual   pred pressure   meas total   pred total   err%');
for (const x of [...abs].sort((p, q) => p.r.scalar.compositeV1 - q.r.scalar.compositeV1)) {
  const err = (100 * (x.r.cd.value - x.b.measured.total)) / x.b.measured.total;
  console.log(`    ${x.b.id.padEnd(21)} ${x.r.scalar.compositeV1.toFixed(6)}   ${x.residual.toFixed(5).padStart(8)}          ` +
    `${x.r.cd.pressure.toFixed(5)}         ${x.b.measured.total.toFixed(5)}      ${x.r.cd.value.toFixed(5)}    ${err.toFixed(1).padStart(7)}%`);
}

/* Q4: error vs eligibility/OOD */
console.log('\n  Q4 SPINE — |total error| grouped by confidence (absolute-capable air bodies):');
for (const conf of ['SUPPORTED', 'REDUCED', 'LOW']) {
  const g = abs.filter((x) => x.r.ood.confidence === conf);
  if (!g.length) continue;
  const errs = g.map((x) => Math.abs((x.r.cd.value - x.b.measured.total) / x.b.measured.total));
  console.log(`    ${conf.padEnd(10)} n=${g.length}   median |err| ${(100 * errs.sort((a, b) => a - b)[Math.floor(errs.length / 2)]).toFixed(1)}%`);
}

/* orderings */
const o451 = rows.filter((x) => !x.error && x.b.id.startsWith('R451'));
if (o451.length === 2) {
  const ratio = o451[1].r.cd.value / o451[0].r.cd.value;
  console.log(`\n  R451 stern pair: predicted altered/original = ${ratio.toFixed(3)} (report: ~1.05)`);
}
const tm = rows.filter((x) => !x.error && x.b.id.startsWith('TM267'));
if (tm.length === 2) {
  console.log(`  TM267 pair: predicted square/round = ${(tm[1].r.cd.value / tm[0].r.cd.value).toFixed(3)} (measured 1.087, low accuracy)` +
    `   A4 round ${tm[0].r.ribbon.modes.A4.toFixed(4)} vs square ${tm[1].r.ribbon.modes.A4.toFixed(4)}`);
}

/* A5 */
const fpAfter = fingerprint();
console.log(`\n  A5 ${fpBefore === fpAfter ? 'PASS — engine byte-identical before and after' : '*** FAIL — ENGINE CHANGED DURING RUN'}`);
console.log('  Göttingen: SPENT by this run (90.7 R2). Blind gate held.');
console.log('  No calibration, routing or descriptor-authority change. Production untouched.\n');

if (process.argv[3]) {
  const dump = rows.filter((x) => !x.error).map((x) => ({
    id: x.b.id, family: x.b.family, role: x.b.role, grade: x.b.grade, medium: x.b.medium,
    proxy: x.r.scalar.compositeV1, cls: x.r.scalar.cls,
    cdPred: x.r.cd.value, press: x.r.cd.pressure, fric: x.r.cd.friction,
    measTotal: x.b.measured ? x.b.measured.total : null, measBasis: x.b.measured ? x.b.measured.basis : null,
    fricCanon: x.frictionCanon, residualCanon: x.residual, reL: x.reL,
    F1: x.r.ribbon.F1, F2a: x.r.ribbon.F2a, F3: x.r.ribbon.F3, F4: x.r.ribbon.F4, F5: x.r.ribbon.F5,
    A1: x.r.ribbon.modes.A1, A2: x.r.ribbon.modes.A2, A4: x.r.ribbon.modes.A4,
    elig: x.r.ribbon.eligibility, conf: x.r.ood.confidence, resDrift: x.resDrift,
    wetted: x.r.geometry.wettedArea, frontal: x.r.geometry.frontalArea,
    dProxyHull: x.r.sensitivity ? x.r.sensitivity.dProxy : null,
  }));
  writeFileSync(process.argv[3], JSON.stringify(dump, null, 1));
  console.log(`  wrote ${process.argv[3]}\n`);
}
