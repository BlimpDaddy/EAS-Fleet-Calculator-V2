/**
 * NACA TN-614 bodies — shared module (profiles, measured values, lathe).
 * Transcription provenance: see tn614.mjs header + RESULTS.md (2026-08-16).
 * Ordinates: Table II (% of basic length); measured CD_A: Table III
 * (frontal basis, effective Re 66e6). Tested 121/211 are footnote-a
 * composites (donor nose + donor tail joined at station B).
 */

export const NOSE_111 = [[-0.18, 0], [1.25, 2.075], [2.50, 3.135], [5, 4.700], [10, 6.725], [20, 8.880], [30, 9.800], [38.83, 10.000]];
export const TAIL_111 = [[38.83, 10.000], [50, 9.700], [60, 8.875], [70, 7.350], [80, 5.145], [85, 3.930], [90, 2.655], [95, 1.340], [97.5, 0.675], [100, 0]];
export const NOSE_222 = [[-1.17, 0], [0, 2.735], [1.25, 3.900], [2.50, 4.755], [5, 6.035], [10, 7.700], [20, 9.370], [30, 9.900], [40.02, 10.000]];
export const TAIL_221 = [[41.05, 10.000], [50, 9.930], [60, 9.540], [70, 8.485], [80, 6.450], [85, 5.035], [90, 3.460], [95, 1.800], [97.5, 0.920], [100, 0]];
const shift = (pts, dx) => pts.map(([x, r]) => [x + dx, r]);

export const BODIES = {
  '111': { pts: [...NOSE_111, ...TAIL_111.slice(1)], cdA: 0.0401 },
  '121T': { pts: [...NOSE_111, ...shift(TAIL_221, 38.83 - 41.05).slice(1)], cdA: 0.0405 },
  '211T': { pts: [...NOSE_222, ...shift(TAIL_111, 40.02 - 38.83).slice(1)], cdA: 0.0415 },
  '221': {
    pts: [[-1.17, 0], [0, 2.725], [1.25, 3.890], [2.50, 4.745], [5, 6.025], [10, 7.695], [20, 9.365], [30, 9.885], [41.05, 10.000], ...TAIL_221.slice(1)],
    cdA: 0.0437,
  },
  '222': {
    pts: [...NOSE_222, [50, 9.895], [60, 9.500], [70, 8.690], [80, 7.335], [85, 6.345], [90, 5.005], [95, 3.035], [97.5, 1.700], [100, 0]],
    cdA: 0.0472,
  },
  '332': {
    // A = 1.89 chosen over ambiguous glyph 1.39 (identical nose constants
    // to 321 A=1.91 / 322 A=1.88); immaterial to results; documented.
    pts: [[-1.89, 0], [0, 3.825], [1.25, 4.865], [2.50, 5.670], [5, 6.865], [10, 8.375], [20, 9.620], [30, 9.925], [42.00, 10.000],
      [50, 9.970], [60, 9.760], [70, 9.170], [80, 7.985], [85, 7.070], [90, 5.800], [95, 3.895], [97.5, 2.455], [100, 0]],
    cdA: 0.0508,
  },
};
export const TEST_RE = 66e6; // effective Reynolds (fuselage length), Table III

/** Monotone cubic (Fritsch–Carlson) through profile points. */
export function pchip(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const h = [], d = [];
  for (let i = 0; i + 1 < n; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = [d[0]];
  for (let i = 1; i + 1 < n; i++) {
    if (d[i - 1] * d[i] <= 0) m.push(0);
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m.push((w1 + w2) / (w1 / d[i - 1] + w2 / d[i])); }
  }
  m.push(d[n - 2]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (xs[i + 1] < x) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return ys[i] * (2 * t3 - 3 * t2 + 1) + h[i] * m[i] * (t3 - 2 * t2 + t)
      + ys[i + 1] * (-2 * t3 + 3 * t2) + h[i] * m[i + 1] * (t3 - t2);
  };
}

/** Lathe a profile into a mesh, flow along +X. */
export function latheProfile(pts, rings = 96, segs = 28) {
  const f = pchip(pts);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const verts = [], faces = [], ringIdx = [];
  for (let i = 0; i <= rings; i++) {
    const x = x0 + ((x1 - x0) * i) / rings;
    const r = Math.max(f(x), 0);
    if (r < 1e-4) { ringIdx.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
    ringIdx.push(first);
  }
  const size = (i) => (i < rings ? ringIdx[i + 1] - ringIdx[i] : verts.length - ringIdx[i]);
  for (let i = 0; i < rings; i++) {
    const a = ringIdx[i], b = ringIdx[i + 1], aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      if (aP) faces.push([a, b + s, b + s1]);
      else if (bP) faces.push([b, a + s1, a + s]);
      else faces.push([a + s, b + s, b + s1], [a + s, b + s1, a + s1]);
    }
  }
  return { verts, faces };
}
