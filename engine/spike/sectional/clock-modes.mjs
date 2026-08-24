/**
 * ANGULAR SYMMETRY MODES of the ribbon positional field — spec 89, promoted to
 * a SHADOW descriptor by the 89.6 ruling.
 *
 *   A_m = 2|sum_k R_k e^{-i m th_k}| / (N rbar)   per station, m = 1, 2, 4,
 *   median over retained-domain stations with rbar >= minFrac of the body max.
 *
 * A1/A2/A4 identify DOMINANT ANGULAR SYMMETRY CONTENT — an ellipse strongly
 * excites m=2, a square-ish superellipse m=4, camber m=1 — but other shapes
 * can excite the same modes too. They are symmetry measurements, NOT unique
 * family labels (89.6 ruling, wording binding).
 *
 * SHADOW ONLY. Consumes ribbonContext's existing positional field; the frozen
 * 70.4 schema and the frozen 59.3 F1-F5 set (F5 included — NOT replaced) are
 * untouched. Validated against analytic section curves at 0.3-7% in 89.2.
 */
export function clockModes(ctx, { minFrac = 0.10 } = {}) {
  const R = ctx.positional.R, rays = ctx.positional.rays;
  const nRib = R.length, nSt = R[0].length;
  let rMax = 0;
  for (let k = 0; k < nRib; k++) for (let i = 0; i < nSt; i++) if (R[k][i] > rMax) rMax = R[k][i];
  const per = [];
  for (let i = 0; i < nSt; i++) {
    let mean = 0;
    for (let k = 0; k < nRib; k++) mean += R[k][i];
    mean /= nRib;
    if (mean < minFrac * rMax) continue;
    const amp = (m) => {
      let re = 0, im = 0;
      for (let k = 0; k < nRib; k++) { re += R[k][i] * Math.cos(m * rays[k]); im += R[k][i] * Math.sin(m * rays[k]); }
      return (2 * Math.hypot(re, im)) / nRib / mean;
    };
    let lo = Infinity, hi = 0;
    for (let k = 0; k < nRib; k++) { if (R[k][i] < lo) lo = R[k][i]; if (R[k][i] > hi) hi = R[k][i]; }
    per.push({ A1: amp(1), A2: amp(2), A4: amp(4), ratio: hi / lo });
  }
  const med = (key) => { const v = per.map((p) => p[key]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  return { A1: med('A1'), A2: med('A2'), A4: med('A4'), ratio: med('ratio'), stations: per.length };
}
