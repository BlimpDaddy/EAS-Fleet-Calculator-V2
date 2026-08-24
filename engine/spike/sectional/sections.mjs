/**
 * SPIKE 2 — the SECTIONAL estimator (descriptor branch done right).
 *
 * No solver, no timesteps, no voxels: exact ray-mesh crossings on a fine
 * cross-grid give the longitudinal area distribution A(x) CONTINUOUSLY in
 * x, plus the frontal silhouette. From those, a handful of geometric
 * scores — the questions are "how violently must the air move aside?"
 * and "how hard is it asked to close behind?" (per the converged design,
 * 2026-08-15). Friction stays ITTC in the real engine; this file is the
 * pressure-side candidate only.
 *
 * MODEL PARAMETERS (header reconciled r10 #5 — the consumed estimator
 * is no longer one-knob):
 *   CONSUMED: aft soft closure severity (quartic penalty, θ_aft = 30°,
 *   walked on the monotone aft envelope) + fore face guard (hard walk,
 *   θ_fore = 75°), composed as max(aft, fore) with k = 1 provisional —
 *   then a deduped monotone anchor calibration (battery-side).
 *   DIAGNOSTIC ONLY: the 15° hard walk below (aftBaseFrac/noseFrac) and
 *   the exported `sCrit` option, which affects ONLY that diagnostic.
 */

const S_CRIT = Math.tan(15 * Math.PI / 180); // ≈ 0.268 — DIAGNOSTIC hard walk only (r10)

function toFlowCoords(verts, axis) {
  const sign = axis[0] === '-' ? -1 : 1;
  const a = (axis[1] ?? axis[0]).toUpperCase();
  const pick = { X: [0, 1, 2], Y: [1, 2, 0], Z: [2, 0, 1] }[a];
  return verts.map((p) => [sign * p[pick[0]], p[pick[1]], p[pick[2]]]);
}

/**
 * Exact sectional measurement: RES×RES rays along x over the cross bbox;
 * per-ray in/out crossings by triangle parity; stations sampled from the
 * interval set. Returns curves + frontal-silhouette stats, all
 * dimensionless where it matters.
 */
export function measureSections(verts, faces, opts = {}) {
  const { axis = '+X', RES = 160, STATIONS = 128 } = opts;
  const t0 = performance.now();
  const fv = toFlowCoords(verts, axis);
  let minX = 1 / 0, maxX = -1 / 0, minY = 1 / 0, maxY = -1 / 0, minZ = 1 / 0, maxZ = -1 / 0;
  for (const [x, y, z] of fv) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const L = maxX - minX, cross = Math.max(maxY - minY, maxZ - minZ) || 1;
  const cell = cross / RES; // square cells over the cross plane
  const y0 = (minY + maxY) / 2 - (RES / 2) * cell, z0 = (minZ + maxZ) / 2 - (RES / 2) * cell;

  let oddColumns = 0; // parity-quality counter (r9 #7: junk must be COUNTED, not silently dropped)
  const columns = new Map(); // j*RES+k -> [xHit, ...]
  for (const face of faces) {
    for (let t = 1; t + 1 < face.length; t++) {
      const tri = [face[0], face[t], face[t + 1]].map((i) => fv[i]);
      if (tri.some((p) => !p)) continue;
      const [p0, p1, p2] = tri;
      const d = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p2[1] - p0[1]) * (p1[2] - p0[2]);
      if (Math.abs(d) < 1e-14) continue;
      const jMin = Math.max(0, Math.floor((Math.min(p0[1], p1[1], p2[1]) - y0) / cell));
      const jMax = Math.min(RES - 1, Math.ceil((Math.max(p0[1], p1[1], p2[1]) - y0) / cell));
      const kMin = Math.max(0, Math.floor((Math.min(p0[2], p1[2], p2[2]) - z0) / cell));
      const kMax = Math.min(RES - 1, Math.ceil((Math.max(p0[2], p1[2], p2[2]) - z0) / cell));
      for (let j = jMin; j <= jMax; j++) {
        const py = y0 + (j + 0.5) * cell;
        for (let k = kMin; k <= kMax; k++) {
          const pz = z0 + (k + 0.5) * cell;
          const w0 = ((p1[1] - py) * (p2[2] - pz) - (p2[1] - py) * (p1[2] - pz)) / d;
          const w1 = ((p2[1] - py) * (p0[2] - pz) - (p0[1] - py) * (p2[2] - pz)) / d;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
          const xHit = w0 * p0[0] + w1 * p1[0] + w2 * p2[0];
          const key = j * RES + k;
          if (!columns.has(key)) columns.set(key, []);
          columns.get(key).push(xHit);
        }
      }
    }
  }

  // Per-column solid intervals (parity), frontal mask, station area curve.
  const intervals = new Map();
  const mask = new Uint8Array(RES * RES);
  for (const [key, xs] of columns) {
    xs.sort((a, b) => a - b);
    const merged = [];
    for (const x of xs) {
      if (merged.length && Math.abs(x - merged[merged.length - 1]) < 1e-9) continue;
      merged.push(x);
    }
    if (merged.length % 2 === 1) oddColumns++; // open/nonmanifold geometry hit this ray
    const iv = [];
    for (let p = 0; p + 1 < merged.length; p += 2) iv.push([merged[p], merged[p + 1]]);
    if (iv.length) { intervals.set(key, iv); mask[key] = 1; }
  }

  // Station areas by event sweep: O(intervals + stations), not O(both).
  // Intervals within a column are disjoint, so no station double-counts.
  const A = new Float64Array(STATIONS); // cell-count area per station
  {
    const diff = new Float64Array(STATIONS + 1);
    for (const iv of intervals.values()) {
      for (const [a, b] of iv) {
        const s0 = Math.max(0, Math.ceil(((a - minX) / L) * STATIONS - 0.5));
        const s1 = Math.min(STATIONS - 1, Math.floor(((b - minX) / L) * STATIONS - 0.5));
        if (s1 >= s0) { diff[s0]++; diff[s1 + 1]--; }
      }
    }
    let acc = 0;
    for (let s = 0; s < STATIONS; s++) { acc += diff[s]; A[s] = acc; }
  }

  // Frontal silhouette: area + boundary-cell perimeter -> compactness.
  let maskArea = 0, perim = 0;
  for (let j = 0; j < RES; j++) {
    for (let k = 0; k < RES; k++) {
      if (!mask[j * RES + k]) continue;
      maskArea++;
      if (j === 0 || !mask[(j - 1) * RES + k]) perim++;
      if (j === RES - 1 || !mask[(j + 1) * RES + k]) perim++;
      if (k === 0 || !mask[j * RES + k - 1]) perim++;
      if (k === RES - 1 || !mask[j * RES + k + 1]) perim++;
    }
  }
  const compactness = maskArea ? (4 * Math.PI * maskArea) / (perim * perim) : 0;

  // Optional TRUE silhouettes (viewer/M7 use; the SCORER never consumes
  // these): per-station min/max cross extents from the same ray intervals.
  // cross1 = j (first cross axis), cross2 = k (second; mesh-vertical for
  // flight axis Z) — the asymmetry the equivalent-radius abstraction
  // deliberately discards (flat base visible here, invisible to A(x)).
  let silhouettes = null;
  if (opts.silhouettes) {
    const mk = () => ({ lo: new Float64Array(STATIONS).fill(Infinity), hi: new Float64Array(STATIONS).fill(-Infinity) });
    const plan = mk(), elev = mk();
    for (const [key, iv] of intervals) {
      const j = Math.floor(key / RES), k = key % RES;
      const cy = y0 + (j + 0.5) * cell, cz = z0 + (k + 0.5) * cell;
      for (const [a, b] of iv) {
        const s0 = Math.max(0, Math.ceil(((a - minX) / L) * STATIONS - 0.5));
        const s1 = Math.min(STATIONS - 1, Math.floor(((b - minX) / L) * STATIONS - 0.5));
        for (let s = s0; s <= s1; s++) {
          if (cy < plan.lo[s]) plan.lo[s] = cy; if (cy > plan.hi[s]) plan.hi[s] = cy;
          if (cz < elev.lo[s]) elev.lo[s] = cz; if (cz > elev.hi[s]) elev.hi[s] = cz;
        }
      }
    }
    silhouettes = { plan, elev };
  }

  // Geometry-quality record (r9 #7; denominator corrected r10 #1: a
  // 3-crossing ray is odd AND carries a valid first interval — the old
  // `intervals.size + oddColumns` counted it twice, halving the reported
  // damage for closed-body-plus-open-sheet meshes. The denominator is
  // simply every ray that hit anything). Caller decides the threshold —
  // small oddFraction → estimate + internal warning; large → the frozen
  // API's 'estimate unavailable' status. Never a silently confident number.
  const quality = {
    oddColumns,
    hitColumns: columns.size,
    solidColumns: intervals.size,
    oddFraction: columns.size ? oddColumns / columns.size : 0,
  };
  return { A, L, cell, minX, maxX, frontalCells: maskArea, compactness, quality, silhouettes, ms: performance.now() - t0 };
}

/**
 * Scores from the area curve. r(x) = equivalent radius (same-area circle),
 * in the same length unit as x — slopes are dimensionless and scale-free.
 */
/** thetaAft: DIAGNOSTIC-SWEEP parameter (TN-614 evidence run, 2026-08-16).
 *  Default 30° = the frozen production value. Changing the default is a
 *  dated ruling requiring fresh held-out bodies — never a quiet tweak. */
export function scoreSections(m, { sCrit = S_CRIT, thetaAft = 30 } = {}) {
  const { A, L, cell } = m;
  const N = A.length, dx = L / N;
  const r = Array.from(A, (a) => Math.sqrt((a * cell * cell) / Math.PI));
  const rMax = Math.max(...r);
  const iMax = r.indexOf(rMax);
  const xOf = (i) => (i + 0.5) * dx;

  // EFFECTIVE BASE (aft): largest r unreachable from the tail tip at
  // <= sCrit closure. Cube: r stays rMax to the end -> ~1. Teardrop:
  // gentle taper -> ~0. Unifies "aft severity" + "base bluntness".
  const xEnd = xOf(N - 1) + 0.5 * dx;
  let rBase = 0;
  for (let i = iMax; i < N; i++) {
    const reachable = sCrit * (xEnd - xOf(i));
    rBase = Math.max(rBase, r[i] - reachable);
  }
  const aftBaseFrac = rMax ? (rBase / rMax) ** 2 : 0; // fraction of frontal area

  // NOSE severity (same walk, mirrored) — reported, NOT in composite v0.
  const xStart = xOf(0) - 0.5 * dx;
  let rNose = 0;
  for (let i = 0; i <= iMax; i++) {
    const reachable = sCrit * (xOf(i) - xStart);
    rNose = Math.max(rNose, r[i] - reachable);
  }
  const noseFrac = rMax ? (rNose / rMax) ** 2 : 0;

  // Profile roughness: total second-difference of r, normalised.
  let rough = 0;
  for (let i = 1; i + 1 < N; i++) rough += Math.abs(r[i + 1] - 2 * r[i] + r[i - 1]);
  rough = rMax ? rough / rMax : 0;

  const cornerPenalty = Math.max(0, 1 - m.compactness);
  // Naive composite v0 — deliberately dumb: unrecovered base fraction,
  // amplified by non-compact cross-section. No fitted weights.
  const composite = aftBaseFrac * (1 + cornerPenalty);

  // SOFT closure severity (v1 — earned by a demonstrated failure: the
  // binary walk saturates at 0 for every gently-closed body, so teardrop
  // f2/f3/f4 were indistinguishable and the calibration point degenerate;
  // Toby's "how can a teardrop be ~0" catch, 2026-08-15). Each shed area
  // element pays min(1, (closureSlope / tan θcrit)^4): QUARTIC, so gentle
  // closures pay pennies and cliffs pay full price. First attempt used
  // quadratic @15° — battery FAILED it (teardrop slopes sit at that cap;
  // everything compressed to ~1 and ordering broke). θ_CRIT_SOFT = 30° is
  // now THE one active knob; the 15° hard walk above stays as a reported
  // diagnostic only, not part of the composite.
  const S_SOFT = Math.tan(thetaAft * Math.PI / 180); // default 30° — the aft knob
  const Amax = Math.PI * rMax * rMax;

  // RAW walk (unbounded) kept as a DIAGNOSTIC only — r9 #1 demonstrated a
  // neck/re-expansion body drives it past 1 (≈1.59), which fed the
  // calibration map Infinity. Reported, never consumed.
  let rawSoft = 0;
  for (let i = iMax; i + 1 < N; i++) {
    const dA = Math.PI * (r[i] * r[i] - r[i + 1] * r[i + 1]);
    if (dA <= 0) continue;
    rawSoft += Math.min(1, (((r[i] - r[i + 1]) / dx) / S_SOFT) ** 4) * dA;
  }
  rawSoft += Math.PI * r[N - 1] * r[N - 1];
  const softAftRaw = Amax ? rawSoft / Amax : 0;

  // CONSUMED aft score walks the MONOTONE OUTER ENVELOPE (r9 #1 fix):
  // looking back from the tail, a later re-expansion means an earlier
  // neck never was successful closure — the envelope restores the
  // "fraction of frontal area being closed" meaning and BOUNDS the
  // score ≤ 1 by construction (total envelope shed = Amax exactly).
  const envA = r.slice();
  for (let i = N - 2; i >= iMax; i--) envA[i] = Math.max(envA[i], envA[i + 1]);
  let soft = 0;
  for (let i = iMax; i + 1 < N; i++) {
    const dA = Math.PI * (envA[i] * envA[i] - envA[i + 1] * envA[i + 1]);
    if (dA <= 0) continue;
    soft += Math.min(1, (((envA[i] - envA[i + 1]) / dx) / S_SOFT) ** 4) * dA;
  }
  soft += Math.PI * envA[N - 1] * envA[N - 1]; // terminal base = infinite slope, full price
  const softAft = Amax ? soft / Amax : 0;

  // FORE term (r9 #2 — EARNED by the flat-front/boat-tail adversary: the
  // aft-only model scored a wall-fronted body 18× better than the
  // teardrop). Formulation: the mirrored HARD walk, not the graded soft
  // one — fore separation is essentially face-like-or-nothing (favourable
  // pressure gradient rounds steep noses; a hemispherical nose is fine, a
  // wall is not), so the criterion is a harsh θ_FORE = 75° and the score
  // is the frontal-area fraction unreachable from the nose tip at that
  // expansion. First attempt (soft quartic@60°) FAILED the battery — it
  // taxed the teardrop's harmless √x nose 0.27 and broke sharp-cut and
  // station convergence; the hard walk is smooth and resolution-stable.
  const S_FORE = Math.tan(75 * Math.PI / 180); // ≈ 3.732 — the fore knob
  const envF = r.slice();
  for (let i = 1; i <= iMax; i++) envF[i] = Math.max(envF[i], envF[i - 1]);
  let rFore = 0;
  for (let i = 0; i <= iMax; i++) {
    const reachable = S_FORE * (xOf(i) - xStart);
    rFore = Math.max(rFore, envF[i] - reachable);
  }
  const softFore = rMax ? (rFore / rMax) ** 2 : 0;
  // Composite v3 = max(aft, fore): the worst aerodynamic offence governs
  // (r9's recommended form; k = 1 PROVISIONAL, declared). r11 provenance
  // correction: TN-614 is NON-INFORMATIVE for the fore guard — all six
  // tested noses return softFore = 0 exactly (below the 75° activation
  // threshold), so k presently rests on synthetic adversarial and
  // invariance tests only. A future corpus with face-like fronts is the
  // empirical lever; kill rule stands. Corner multiplier remains REMOVED from the composite
  // (battery finding: raster Manhattan perimeter caps a circle's
  // compactness at π²/16 ≈ 0.617 vs a square's exact 0.785 — inverted
  // penalty); cornerPenalty stays reported-with-known-bias; equal-A(x)
  // sectional-shape blindness is a DOCUMENTED limitation (battery
  // diagnostic), revisited only on independent evidence, with a Crofton
  // perimeter estimator.
  const compositeV1 = Math.max(softAft, softFore);

  return {
    aftBaseFrac, noseFrac, rough, compactness: m.compactness, cornerPenalty,
    composite, softAft, softAftRaw, softFore, compositeV1,
    fineness: rMax ? L / (2 * rMax) : 0,
  };
}
