/**
 * PHASE 1C SWEEP + FROZEN GATE (2026-08-20)
 * Executes spec 18 / 18a / 18b / 18c exactly. Folds were frozen at 40bde1d
 * before any target was inspected. No parameter is chosen here.
 */
import { extractRibbons, ribbonMetrics, SECANT_FRAC } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';

const DEG = 180 / Math.PI, TIP = 0.025, Q = 0.95;
const FIN = [1, 1.3, 2, 3, 5], MECH = Object.keys(GENERATORS);
const STR = [0.25, 0.5, 1.0], FAC = [48, 96], NT = 48, PLANES = 6;
const prolate = (A) => (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));

const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1)); return s[i]; };
const median = (a) => quantile(a, 0.5);
const pinball = (rows, pred) => rows.reduce((acc, r) => {
  const d = r.y - pred(r); return acc + (d >= 0 ? Q * d : (Q - 1) * d); }, 0) / (rows.length || 1);

/** One mesh -> rows of {y, predictors, mech, f}. */
function rowsFor(mech, f, s, nf) {
  const A = f, rFn = prolate(A);
  const mesh = GENERATORS[mech](rFn, A, nf, NT, s);
  const F = extractRibbons(mesh.verts, mesh.faces, { axis: 'X', up: 'Y', planes: PLANES });
  const N = F.stations, dx = F.L / (N - 1);
  const half = Math.max(1, Math.round(((SECANT_FRAC / 2) * F.L) / dx));
  const wide = Math.max(2, Math.round((0.10 * F.L) / dx));      // 10%-of-L window
  const out = [];
  F.ribbons.forEach((rib, k) => {
    const g = ribbonMetrics(rib, F.L, { tipFrac: TIP });
    const phi = [];
    for (let i = g.i0; i <= g.i1; i++) {
      const a = Math.max(0, i - half), b = Math.min(N - 1, i + half);
      phi.push(Math.atan2(rib[b] - rib[a], (b - a) * dx) * DEG);
    }
    for (let t = 0; t + 1 < phi.length; t++) {
      const i = g.i0 + t, pv = F.provenance[k][i];
      if (!pv) continue;
      const a = Math.max(0, i - wide), b = Math.min(N - 1, i + wide);
      const pa = Math.atan2(rib[Math.min(N - 1, a + half)] - rib[Math.max(0, a - half)], 2 * half * dx) * DEG;
      const pb = Math.atan2(rib[Math.min(N - 1, b + half)] - rib[Math.max(0, b - half)], 2 * half * dx) * DEG;
      const turnRate = Math.abs(pb - pa) / ((b - a) * dx);       // deg per unit length
      const u = i / (N - 1);
      out.push({ y: Math.max(0, phi[t + 1] - phi[t]), mech, f,
        turnRate, axialSpan: pv.axialSpan, x: turnRate * pv.axialSpan,
        azim: pv.azimuthalCoarseness, aspect: pv.aspect, support: pv.support,
        tipDist: Math.min(u, 1 - u) });
    }
  });
  return out;
}

console.log('== PHASE 1C SWEEP ==');
const ALL = [];
for (const m of MECH) for (const f of FIN) for (const s of STR) for (const nf of FAC)
  ALL.push(...rowsFor(m, f, s, nf));
console.log(`${ALL.length} station observations from ${MECH.length}x${FIN.length}x${STR.length}x${FAC.length} = ${MECH.length*FIN.length*STR.length*FAC.length} meshes`);
console.log(`non-zero false reversals: ${ALL.filter(r=>r.y>0).length} (${(100*ALL.filter(r=>r.y>0).length/ALL.length).toFixed(1)}%)`);
console.log(`largest false reversal anywhere in the sweep: ${ALL.reduce((m,r)=>r.y>m?r.y:m,0).toFixed(2)} deg\n`);

function evaluate(label, train, test) {
  const gGlobal = quantile(train.map((r) => r.y), Q);
  const ratios = train.filter((r) => r.x > 1e-12).map((r) => r.y / r.x);
  const C = quantile(ratios, Q);
  const sLocal = (r) => C * r.x;
  const cov = test.filter((r) => r.y <= sLocal(r)).length / test.length;
  const covNz = (() => { const nz = test.filter((r) => r.y > 0); return nz.length ? nz.filter((r) => r.y <= sLocal(r)).length / nz.length : NaN; })();
  const ratio = median(test.map((r) => (gGlobal > 0 ? sLocal(r) / gGlobal : Infinity)));
  const pbL = pinball(test, sLocal), pbG = pinball(test, () => gGlobal);
  const pass = cov >= 0.93 && cov <= 0.99 && ratio <= 0.60 && pbL < pbG;
  const kill = cov < 0.93 || ratio > 0.85;
  return { label, C, gGlobal, cov, covNz, ratio, pbL, pbG, pass, kill, n: test.length };
}

const noF13 = ALL.filter((r) => r.f !== 1.3);
const res = [];
for (const k of MECH) res.push(evaluate(`LOMO ${k}`, noF13.filter((r) => r.mech !== k), noF13.filter((r) => r.mech === k)));
res.push(evaluate('LOFO f=1.3', ALL.filter((r) => r.f !== 1.3), ALL.filter((r) => r.f === 1.3)));

console.log('fold              n_test   coverage  cov(y>0)  median ratio  pinball L vs G     verdict');
for (const r of res)
  console.log(`${r.label.padEnd(17)} ${String(r.n).padStart(6)}   ${r.cov.toFixed(4)}    ${Number.isNaN(r.covNz)?'  n/a ':r.covNz.toFixed(4)}    ${r.ratio.toFixed(3).padStart(10)}   ${r.pbL.toFixed(5)} vs ${r.pbG.toFixed(5)}  ${r.pass ? 'PASS' : r.kill ? 'KILL' : 'fail'}`);

const allPass = res.every((r) => r.pass), anyKill = res.some((r) => r.kill);
console.log(`\n>>> PHASE 1C: ${allPass ? 'PASS' : anyKill ? 'KILL' : 'FAIL (no pass, no kill trigger)'} <<<`);
console.log('gate: coverage in [0.93,0.99] AND median ratio <= 0.60 AND pinball local < global.');
console.log('kill: coverage < 0.93 OR median ratio > 0.85.');


/* ------------------------------------------------------------------ */
/* PRE-REGISTERED FALLBACK (spec 18): q=0.95 linear quantile regression */
/* over the SIX frozen predictors. Same folds, same baseline, same gate.*/
/* Optimiser declared, not tuned: predictors standardised on TRAINING   */
/* moments only, subgradient descent on pinball loss, 400 full-batch    */
/* iterations, lr = 0.5/sqrt(t), zero init, prediction clamped >= 0.    */
/* No feature engineering. No transform chosen from the primary result. */
/* ------------------------------------------------------------------ */
const FEATS = ['axialSpan', 'azim', 'aspect', 'support', 'tipDist', 'turnRate'];
const featOf = (r) => FEATS.map((k) => (Number.isFinite(r[k]) ? r[k] : 1e6));

function fitQR(train) {
  const X = train.map(featOf), y = train.map((r) => r.y), n = X.length, d = FEATS.length;
  const mu = [], sd = [];
  for (let j = 0; j < d; j++) {
    let m = 0; for (const x of X) m += x[j]; m /= n;
    let v = 0; for (const x of X) v += (x[j] - m) ** 2; v = Math.sqrt(v / n) || 1;
    mu.push(m); sd.push(v);
  }
  const Z = X.map((x) => x.map((v, j) => (v - mu[j]) / sd[j]));
  const w = new Array(d).fill(0); let b = 0;
  const traj = [];
  for (let t = 1; t <= 400; t++) {
    const g = new Array(d).fill(0); let gb = 0, loss = 0;
    for (let i = 0; i < n; i++) {
      let p = b; for (let j = 0; j < d; j++) p += w[j] * Z[i][j];
      const diff = y[i] - p;
      loss += diff >= 0 ? Q * diff : (Q - 1) * diff;
      const sg = diff >= 0 ? -Q : (1 - Q);
      gb += sg; for (let j = 0; j < d; j++) g[j] += sg * Z[i][j];
    }
    const lr = 0.5 / Math.sqrt(t);
    b -= (lr * gb) / n; for (let j = 0; j < d; j++) w[j] -= (lr * g[j]) / n;
    if (t === 1 || t === 100 || t === 400) traj.push((loss / n).toFixed(6));
  }
  return { predict: (r) => { const x = featOf(r); let p = b;
    for (let j = 0; j < d; j++) p += w[j] * ((x[j] - mu[j]) / sd[j]); return Math.max(0, p); }, traj, w, b };
}

function evaluateQR(label, train, test) {
  const gGlobal = quantile(train.map((r) => r.y), Q);
  const M = fitQR(train);
  const cov = test.filter((r) => r.y <= M.predict(r)).length / test.length;
  const nz = test.filter((r) => r.y > 0);
  const covNz = nz.length ? nz.filter((r) => r.y <= M.predict(r)).length / nz.length : NaN;
  const ratio = median(test.map((r) => (gGlobal > 0 ? M.predict(r) / gGlobal : Infinity)));
  const pbL = pinball(test, M.predict), pbG = pinball(test, () => gGlobal);
  const pass = cov >= 0.93 && cov <= 0.99 && ratio <= 0.60 && pbL < pbG;
  const kill = cov < 0.93 || ratio > 0.85;
  return { label, cov, covNz, ratio, pbL, pbG, pass, kill, n: test.length, traj: M.traj };
}

console.log('== PRE-REGISTERED FALLBACK: q=0.95 quantile regression, six predictors ==');
console.log('Same frozen folds, same baseline, same gate. Nothing re-chosen.');
console.log('fold              n_test   coverage  cov(y>0)  median ratio  pinball L vs G     train loss t=1/100/400   verdict');
const fres = [];
for (const k of MECH) fres.push(evaluateQR(`LOMO ${k}`, noF13.filter((r) => r.mech !== k), noF13.filter((r) => r.mech === k)));
fres.push(evaluateQR('LOFO f=1.3', ALL.filter((r) => r.f !== 1.3), ALL.filter((r) => r.f === 1.3)));
for (const r of fres)
  console.log(`${r.label.padEnd(17)} ${String(r.n).padStart(6)}   ${r.cov.toFixed(4)}    ${Number.isNaN(r.covNz)?'  n/a ':r.covNz.toFixed(4)}    ${(Number.isFinite(r.ratio)?r.ratio.toFixed(3):'Inf').padStart(10)}   ${r.pbL.toFixed(5)} vs ${r.pbG.toFixed(5)}  ${r.traj.join(' / ')}   ${r.pass ? 'PASS' : r.kill ? 'KILL' : 'fail'}`);
const fAll = fres.every((r) => r.pass), fKill = fres.some((r) => r.kill);
console.log(`>>> FALLBACK: ${fAll ? 'PASS' : fKill ? 'KILL' : 'FAIL'} <<<`);
