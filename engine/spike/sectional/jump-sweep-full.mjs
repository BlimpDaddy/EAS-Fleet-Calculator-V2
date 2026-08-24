/**
 * THE SWEEP AS ACTUALLY PRE-REGISTERED. Spec 48.5 + the corrected 48.4
 * localisation reading recorded in 49.4.
 *
 * `jump-localise.mjs` evaluated the chine side of the criterion on REGULAR
 * bodies only, which was narrower than the registration (spec 49.3). This
 * includes every authorised burned-chine variant: regular AND jittered, at
 * nt = 30, 96 and 118. Adding 118 is strictly harder than the frozen pair and
 * is included rather than excluded.
 *
 * NOTHING ELSE IS ALTERED: tangent-jump basis, detector window cu = 4, skin
 * bandwidth, span requirement S = 46, fixed-window linker, completion, and
 * every fidelity tolerance stand. The independent chine is NOT touched.
 *
 * The field grid is computed ONCE per body and reused across thresholds, so
 * the sweep measures thresholds rather than re-deriving the field each time.
 */
import { analyticBody } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { makeJumpField } from './ridge.mjs';

const DEG = 180 / Math.PI, A = 3, NX = 240, D = 0.700, JIT = 0.4;
const GRID = { nx: 128, nu: 256 };
const S = 46;                                   // frozen span criterion
const LINK_TOL_STEPS = 3;                       // frozen linker
const SWEEP = [2, 3, 5, 7.5, 10, 15, 20, 25, 30, 35, 40];
const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
const chineFn = (x, th) => { const c = Math.cos(th); return c < -1e-12 ? Math.min(rc(x), D / -c) : rc(x); };
const cornerTh = (x) => (rc(x) > D ? Math.acos(-D / rc(x)) : null);      // SCORING ONLY
const X_END = A * Math.sqrt(1 - D * D);
const wrap = (d) => { let t = d; while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; return t; };
const build = (fn, gen, nt) => (gen ? GENERATORS[gen](fn, A, NX, nt, JIT) : analyticBody(fn, A, { nx: NX, nt }));

const NEG = [];
for (const nt of [30, 118]) for (const [lab, gen] of [['regular', null], ['G1 jitter', 'sineJitter'],
  ['G2 density', 'blockDensity'], ['G3 shear', 'azimuthalShear'], ['G4 walk', 'surfaceWalk']]) NEG.push([lab, gen, nt]);
const POS = [];
for (const nt of [30, 96, 118]) for (const [lab, gen] of [['regular', null], ['G1 jitter', 'sineJitter']]) POS.push([lab, gen, nt]);

/** Compute the field grid once. */
function gridOf(fn, gen, nt) {
  const m = build(fn, gen, nt);
  const f = makeJumpField(m.verts, m.faces);
  const du = 2 * Math.PI / GRID.nu;
  const xs = Array.from({ length: GRID.nx }, (_, i) => f.x0 + (f.x1 - f.x0) * i / (GRID.nx - 1));
  const rows = xs.map((x) => {
    const row = new Array(GRID.nu);
    for (let j = 0; j < GRID.nu; j++) { const v = f.J(x, -Math.PI + j * du); row[j] = Number.isNaN(v) ? 0 : v; }
    return row;
  });
  return { rows, xs, du, nt };
}

/** Peaks + fixed-window linking at a given floor. Identical rule to extractJumpRidges. */
function curvesAt(g, floorRad) {
  const { rows, du } = g;
  const peaks = rows.map((row) => {
    const pk = [];
    for (let j = 0; j < GRID.nu; j++) {
      const a = row[(j - 1 + GRID.nu) % GRID.nu], b = row[j], c = row[(j + 1) % GRID.nu];
      if (b >= floorRad && b >= a && b > c) {
        const den = a - 2 * b + c;
        const off = Math.abs(den) > 1e-18 ? (0.5 * (a - c)) / den : 0;
        pk.push(-Math.PI + (j + Math.max(-1, Math.min(1, off))) * du);
      }
    }
    return pk;
  });
  const tol = LINK_TOL_STEPS * du;
  const used = peaks.map((p) => new Array(p.length).fill(false));
  const curves = [];
  for (let i = 0; i < GRID.nx; i++) {
    for (let a = 0; a < peaks[i].length; a++) {
      if (used[i][a]) continue;
      const cur = [peaks[i][a]];
      used[i][a] = true;
      let ci = i, cu2 = peaks[i][a];
      while (ci + 1 < GRID.nx) {
        let best = -1, bd = Infinity;
        for (let b = 0; b < peaks[ci + 1].length; b++) {
          if (used[ci + 1][b]) continue;
          const d = Math.abs(wrap(peaks[ci + 1][b] - cu2));
          if (d < bd) { bd = d; best = b; }
        }
        if (best < 0 || bd > tol) break;
        used[ci + 1][best] = true;
        cur.push(peaks[ci + 1][best]);
        cu2 = peaks[ci + 1][best]; ci++;
      }
      curves.push(cur);
    }
  }
  return { curves, peaks };
}

console.log('\nTHE SWEEP AS PRE-REGISTERED — all authorised burned-chine variants included.');
console.log(`negatives ${NEG.length}, chine variants ${POS.length}, span S = ${S}, linker and window frozen.\n`);

const negG = NEG.map(([lab, gen, nt]) => ({ lab, nt, g: gridOf(rc, gen, nt) }));
const posG = POS.map(([lab, gen, nt]) => ({ lab, nt, g: gridOf(chineFn, gen, nt) }));

console.log('   thresh   worst negative (curves>=S)      chine variants with >=2 curves of span>=S');
console.log('                                            reg30 jit30 reg96 jit96 reg118 jit118   valid');
const valid = [];
for (const t of SWEEP) {
  const fr = t / DEG;
  let worstNeg = 0, who = '';
  for (const n of negG) {
    const c = curvesAt(n.g, fr).curves.filter((x) => x.length >= S).length;
    if (c > worstNeg) { worstNeg = c; who = `${n.lab} nt=${n.nt}`; }
  }
  const cells = posG.map((p) => curvesAt(p.g, fr).curves.filter((x) => x.length >= S).length);
  const ok = worstNeg === 0 && cells.every((c) => c >= 2);
  if (ok) valid.push(t);
  console.log(`   ${String(t).padStart(6)}   ${String(worstNeg).padStart(6)}${worstNeg ? ` ${who}`.padEnd(22) : ''.padEnd(23)}` +
    `${cells.map((c) => String(c).padStart(5)).join(' ')}${' '.repeat(4)}${ok ? 'YES' : 'no'}`);
}

if (!valid.length) {
  console.log('\n  ==> NO VALID INTERVAL under the criterion as actually registered.');
  console.log('      Per spec 48.5 the detector FAILS; the criterion is not relaxed.');
} else {
  let bi = 0, bl = 1, ci = 0, cl = 1;
  for (let i = 1; i < valid.length; i++) {
    if (SWEEP.indexOf(valid[i]) === SWEEP.indexOf(valid[i - 1]) + 1) cl++; else { ci = i; cl = 1; }
    if (cl > bl) { bl = cl; bi = ci; }
  }
  const run = valid.slice(bi, bi + bl);
  const centre = (run[0] + run[run.length - 1]) / 2;
  console.log(`\n  valid: ${valid.join(', ')} deg   widest run ${run[0]}-${run[run.length - 1]}  ->  CENTRE ${centre.toFixed(2)} deg`);

  console.log(`\n  DEMONSTRATION 2/4 AT ${centre.toFixed(2)} deg — one centred response per TRUE CORNER,`);
  console.log('  within +/-1 vertex spacing (the corrected 49.4 reading):');
  console.log('    body            nt    corner slots   exactly one   zero   multi   mean offset');
  for (const p of posG) {
    const fr = centre / DEG, tol = 2 * Math.PI / p.nt;
    const { peaks } = curvesAt(p.g, fr);
    let slots = 0, one = 0, zero = 0, multi = 0, offSum = 0, offN = 0;
    p.g.xs.forEach((x, i) => {
      const c = cornerTh(x);
      if (c === null || Math.abs(x) > X_END - 0.1) return;
      for (const w of [c, -c]) {
        slots++;
        const near = peaks[i].filter((q) => Math.abs(wrap(q - w)) <= tol);
        if (near.length === 1) { one++; offSum += Math.abs(wrap(near[0] - w)) * DEG; offN++; }
        else if (near.length === 0) zero++; else multi++;
      }
    });
    console.log(`    ${p.lab.padEnd(14)} ${String(p.nt).padEnd(5)} ${String(slots).padStart(12)} ` +
      `${`${one} (${(100 * one / slots).toFixed(0)}%)`.padStart(13)} ${String(zero).padStart(6)} ${String(multi).padStart(7)}   ${(offSum / Math.max(1, offN)).toFixed(2)} deg`);
  }
  console.log('\n    DEMO 3 — longest curve span vs the chine\'s 91-x-step analytic extent:');
  for (const p of posG) {
    const c = curvesAt(p.g, centre / DEG).curves.map((x) => x.length).sort((a, b) => b - a);
    console.log(`      ${p.lab.padEnd(14)} nt=${String(p.nt).padEnd(4)} longest ${String(c[0] ?? 0).padStart(3)} / 91  (${(100 * (c[0] ?? 0) / 91).toFixed(0)}%)   curves>=S: ${c.filter((v) => v >= S).length}`);
  }
}
