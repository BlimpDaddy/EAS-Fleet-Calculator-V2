/**
 * PHASE 1F — SURFACE FEATURE CURVES AND PATCH PARTITIONING. Spec 40.3 / 41,
 * frozen dccc1f4.
 *
 * SPEC 41.2 INFORMATION CONSTRAINT: everything here reads ONLY mesh vertices
 * and connectivity. No analytic label, no known chine location, no
 * section-oracle value, no hand-authored feature coordinate. Analytic truth
 * scores controls afterwards; it never enters this file.
 *
 * SPEC 41.3 PERSISTENCE IS HARD: a feature is a COHERENT SURFACE CURVE. A
 * single high-dihedral edge is not a feature however large its angle, because
 * isolated noisy vertices and tessellation edges are exactly what this
 * architecture exists to be insensitive to. Detection is therefore two-stage:
 * an angle test proposes candidate edges, and a connected-curve length test
 * disposes of everything that is not persistent.
 *
 * NOT A RESURRECTION OF K. K was a per-section turn threshold applied to a
 * section polygon, and it is void. This operates on the surface, before any
 * slicing, and its output is a curve rather than a per-station event.
 */

const EKEY = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

function faceNormal(verts, f) {
  const [a, b, c] = f.map((i) => verts[i]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const m = Math.hypot(...n);
  return m > 0 ? n.map((q) => q / m) : null;
}

/** Dihedral angle across every manifold edge, in radians. Connectivity only. */
export function edgeDihedrals(verts, faces) {
  const edge = new Map();
  faces.forEach((f, fi) => {
    for (let e = 0; e < f.length; e++) {
      const k = EKEY(f[e], f[(e + 1) % f.length]);
      if (!edge.has(k)) edge.set(k, []);
      edge.get(k).push(fi);
    }
  });
  const N = faces.map((f) => faceNormal(verts, f));
  const out = new Map();
  let nonManifold = 0, boundary = 0;
  for (const [k, fs] of edge) {
    if (fs.length === 1) { boundary++; continue; }
    if (fs.length !== 2) { nonManifold++; continue; }
    const n1 = N[fs[0]], n2 = N[fs[1]];
    if (!n1 || !n2) continue;
    const d = Math.max(-1, Math.min(1, n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]));
    out.set(k, Math.acos(d));
  }
  return { dihedral: out, edgeFaces: edge, nonManifold, boundary };
}

/**
 * Feature curves: candidate edges above `dihedralRad`, chained by shared
 * vertices, keeping only connected components of at least `minEdges` edges.
 */
export function detectFeatureCurves(verts, faces, { dihedralRad, minEdges }) {
  const { dihedral, edgeFaces, nonManifold, boundary } = edgeDihedrals(verts, faces);
  const cand = [];
  for (const [k, ang] of dihedral) if (ang > dihedralRad) cand.push(k);

  // connected components over candidate edges, adjacency = shared vertex
  const byVert = new Map();
  for (const k of cand) {
    const [a, b] = k.split('_').map(Number);
    if (!byVert.has(a)) byVert.set(a, []); byVert.get(a).push(k);
    if (!byVert.has(b)) byVert.set(b, []); byVert.get(b).push(k);
  }
  const seen = new Set(), curves = [];
  for (const start of cand) {
    if (seen.has(start)) continue;
    const stack = [start], comp = [];
    seen.add(start);
    while (stack.length) {
      const k = stack.pop(); comp.push(k);
      const [a, b] = k.split('_').map(Number);
      for (const v of [a, b]) for (const nb of byVert.get(v) || []) {
        if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    curves.push(comp);
  }
  const kept = curves.filter((c) => c.length >= minEdges);
  const featureEdges = new Set();
  for (const c of kept) for (const k of c) featureEdges.add(k);

  return {
    featureEdges,
    curves: kept,
    stats: {
      candidateEdges: cand.length,
      components: curves.length,
      keptCurves: kept.length,
      rejectedShort: curves.length - kept.length,
      featureEdges: featureEdges.size,
      longestCurve: curves.length ? Math.max(...curves.map((c) => c.length)) : 0,
      nonManifold, boundary,
    },
    edgeFaces,
    dihedral,
  };
}

/**
 * Partition the surface into smooth patches bounded by feature curves.
 *
 * SPEC 41.4: positional continuity is preserved and tangent continuity is
 * not. A vertex ON a feature curve belongs to EVERY patch that touches it, so
 * both sides fit through the same crease points -- that is the positional
 * continuity. Each side then fits independently using only its own patch's
 * vertices, which is what allows the tangent to break.
 */
export function partitionSurface(verts, faces, featureEdges, edgeFaces) {
  const adj = faces.map(() => []);
  for (const [k, fs] of edgeFaces) {
    if (fs.length !== 2 || featureEdges.has(k)) continue;
    adj[fs[0]].push(fs[1]); adj[fs[1]].push(fs[0]);
  }
  const facePatch = new Array(faces.length).fill(-1);
  let nPatches = 0;
  for (let f = 0; f < faces.length; f++) {
    if (facePatch[f] >= 0) continue;
    const id = nPatches++, stack = [f];
    facePatch[f] = id;
    while (stack.length) {
      const g = stack.pop();
      for (const h of adj[g]) if (facePatch[h] < 0) { facePatch[h] = id; stack.push(h); }
    }
  }
  const vertexPatches = new Map();
  faces.forEach((f, fi) => {
    for (const v of f) {
      if (!vertexPatches.has(v)) vertexPatches.set(v, new Set());
      vertexPatches.get(v).add(facePatch[fi]);
    }
  });
  const creaseVertex = new Set();
  for (const k of featureEdges) { const [a, b] = k.split('_').map(Number); creaseVertex.add(a); creaseVertex.add(b); }
  const sizes = new Array(nPatches).fill(0);
  facePatch.forEach((p) => { sizes[p]++; });
  return { facePatch, vertexPatches, creaseVertex, nPatches, patchFaceCounts: sizes };
}

/* ------------------------------------------------------------------ */
/* DIAGNOSTIC — dihedral distributions. Development data only.         */
/* ------------------------------------------------------------------ */
if (process.argv[1] && process.argv[1].endsWith('features.mjs')) {
  const { analyticBody } = await import('./ribbons.mjs');
  const { GENERATORS } = await import('./ribbons-generators.mjs');
  const DEG = 180 / Math.PI, A = 3, NX = 240, D = 0.700;
  const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
  const chineFn = (x, th) => { const c = Math.cos(th); return c < -1e-12 ? Math.min(rc(x), D / -c) : rc(x); };

  console.log('\nDIHEDRAL DISTRIBUTIONS — development data only (burned Gate 2 chine + Gate 1 smooth).');
  console.log('The independent control is NOT touched.\n');
  console.log('  body                          nt    p50      p90      p99      p999     max      >30deg');
  const rows = [];
  for (const nt of [30, 96, 118]) {
    for (const [lab, fn, gen] of [
      ['SMOOTH regular', rc, null], ['SMOOTH G1 jitter', rc, 'sineJitter'],
      ['SMOOTH G3 shear', rc, 'azimuthalShear'], ['SMOOTH G4 walk', rc, 'surfaceWalk'],
      ['CHINE regular', chineFn, null], ['CHINE G1 jitter', chineFn, 'sineJitter'],
    ]) {
      const mesh = gen ? GENERATORS[gen](fn, A, NX, nt, 0.4) : analyticBody(fn, A, { nx: NX, nt });
      const { dihedral } = edgeDihedrals(mesh.verts, mesh.faces);
      const a = [...dihedral.values()].sort((p, q) => p - q);
      const q = (f) => a[Math.min(a.length - 1, Math.floor(f * a.length))] * DEG;
      const over = a.filter((v) => v * DEG > 30).length;
      rows.push({ lab, nt, p50: q(0.5), p90: q(0.9), p99: q(0.99), p999: q(0.999), max: a[a.length - 1] * DEG, over });
      console.log(`  ${lab.padEnd(28)} ${String(nt).padEnd(5)} ${q(0.5).toFixed(2).padStart(7)} ${q(0.9).toFixed(2).padStart(8)} ` +
        `${q(0.99).toFixed(2).padStart(8)} ${q(0.999).toFixed(2).padStart(8)} ${(a[a.length - 1] * DEG).toFixed(2).padStart(8)} ${String(over).padStart(7)}`);
    }
  }
  const sm = rows.filter((r) => r.lab.startsWith('SMOOTH')), ch = rows.filter((r) => r.lab.startsWith('CHINE'));
  console.log(`\n  worst SMOOTH dihedral anywhere: ${Math.max(...sm.map((r) => r.max)).toFixed(2)} deg`);
  console.log(`  max CHINE dihedral:              ${Math.max(...ch.map((r) => r.max)).toFixed(2)} deg`);
  console.log(`  true chine angle (flat vs circle tangent at the corner): ${(Math.acos(D) * DEG).toFixed(3)} deg`);
}

/* ================================================================== */
/* DETECTOR v2 — POSITION-RESIDUAL CREASE EVIDENCE                     */
/*                                                                     */
/* v1 above (face-normal dihedral) FAILED its negative control and is   */
/* retained only as the record of that. Measured: at a 30 deg threshold */
/* on nt=30, the longest connected candidate curve was 255 edges on a   */
/* SMOOTH jittered mesh against 89 for a real chine on a clean one, so  */
/* no angle threshold and no persistence length can separate them.      */
/* Cause: face normals are sliver-sensitive, and azimuthal jitter on an */
/* anisotropic quad makes near-degenerate triangles whose normals flip  */
/* to 180 deg.                                                          */
/*                                                                     */
/* THE VERTICES THEMSELVES ARE EXACT (generator gate, 2.2e-16), so the  */
/* crease is a property of the POSITIONS, not of the triangulation. v2  */
/* never touches a face normal. It asks whether ONE smooth local        */
/* surface can explain a vertex's neighbourhood, which is precisely the */
/* question "is there a derivative discontinuity here".                 */
/*                                                                     */
/* SPEC 41.2 RESPECTED: positions and connectivity only. No analytic    */
/* label, no known chine location, no oracle value.                     */
/* ================================================================== */

const TWO_PI2 = Math.PI * 2;
const wrap2 = (d) => { let t = d; while (t > Math.PI) t -= TWO_PI2; while (t < -Math.PI) t += TWO_PI2; return t; };
const W2 = (t) => (t >= 1 ? 0 : (1 - t) ** 4 * (4 * t + 1));

function solve2(M, b, n) {
  const Aa = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(Aa[r][c]) > Math.abs(Aa[piv][c])) piv = r;
    if (Math.abs(Aa[piv][c]) < 1e-14) return null;
    const t = Aa[c]; Aa[c] = Aa[piv]; Aa[piv] = t;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = Aa[r][c] / Aa[c][c];
      for (let k = c; k <= n; k++) Aa[r][k] -= f * Aa[c][k];
    }
  }
  return Aa.map((r, i) => r[n] / Aa[i][i]);
}

function meshScaleLocal(verts, faces, rMin) {
  const seen = new Set(), dxs = [], dus = [];
  for (const f of faces) {
    for (let e = 0; e < f.length; e++) {
      const a = f[e], b = f[(e + 1) % f.length];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const A2 = verts[a], B2 = verts[b];
      if (Math.hypot(A2[1], A2[2]) < rMin || Math.hypot(B2[1], B2[2]) < rMin) continue;
      dxs.push(Math.abs(B2[0] - A2[0]));
      dus.push(Math.abs(wrap2(Math.atan2(B2[2], B2[1]) - Math.atan2(A2[2], A2[1]))));
    }
  }
  const med = (a) => { const z = a.filter((v) => v > 1e-12).sort((p, q) => p - q); return z.length ? z[Math.floor(z.length / 2)] : 0; };
  return { dx: med(dxs), du: med(dus) };
}

/**
 * LEAVE-ONE-OUT residual of a local quadratic surface fit at every vertex.
 * A vertex on a smooth patch is predicted well by its neighbours; a vertex on
 * a crease is not, because no single quadratic covers both sides of a roof.
 * Leave-one-out is essential -- including the vertex would let the fit
 * interpolate it and hide exactly the signal being looked for.
 */
export function creaseResiduals(verts, faces, { cx = 2.5, cu = 2.5, rMin = 1e-9 } = {}) {
  const scale = meshScaleLocal(verts, faces, rMin);
  const hx = cx * scale.dx, hu = cu * scale.du;
  const P = verts.map((v) => {
    const r = Math.hypot(v[1], v[2]);
    return r < rMin ? null : { x: v[0], u: Math.atan2(v[2], v[1]), y: v[1], z: v[2] };
  });
  const idx = [];
  P.forEach((p, i) => { if (p) idx.push(i); });
  let x0 = Infinity, x1 = -Infinity;
  for (const i of idx) { if (P[i].x < x0) x0 = P[i].x; if (P[i].x > x1) x1 = P[i].x; }
  const nbx = Math.max(1, Math.ceil((x1 - x0) / hx)), nbu = Math.max(3, Math.ceil(TWO_PI2 / hu));
  const bins = Array.from({ length: nbx * nbu }, () => []);
  const bx = (x) => Math.min(nbx - 1, Math.max(0, Math.floor(((x - x0) / (x1 - x0 || 1)) * nbx)));
  const bu = (u) => ((Math.floor(((u + Math.PI) / TWO_PI2) * nbu) % nbu) + nbu) % nbu;
  for (const i of idx) bins[bx(P[i].x) * nbu + bu(P[i].u)].push(i);

  const res = new Array(verts.length).fill(0);
  const spread = new Array(verts.length).fill(0);
  const kink = new Array(verts.length).fill(0);
  for (const i of idx) {
    const p0 = P[i], ix = bx(p0.x), iu = bu(p0.u);
    const M = Array.from({ length: 6 }, () => new Array(6).fill(0));
    const by = new Array(6).fill(0), bz = new Array(6).fill(0);
    let n = 0, wsum = 0, sp2 = 0;
    const r0 = Math.hypot(p0.y, p0.z);
    for (let a = -1; a <= 1; a++) {
      const jx = ix + a;
      if (jx < 0 || jx >= nbx) continue;
      for (let c = -1; c <= 1; c++) {
        const ju = ((iu + c) % nbu + nbu) % nbu;
        for (const j of bins[jx * nbu + ju]) {
          if (j === i) continue;                       // LEAVE ONE OUT
          const p = P[j];
          const dx = (p.x - p0.x) / hx, du = wrap2(p.u - p0.u) / hu;
          const w = W2(Math.hypot(dx, du));
          if (w <= 0) continue;
          const B = [1, dx, du, dx * dx, dx * du, du * du];
          for (let r = 0; r < 6; r++) {
            for (let s = 0; s < 6; s++) M[r][s] += w * B[r] * B[s];
            by[r] += w * B[r] * p.y;
            bz[r] += w * B[r] * p.z;
          }
          // PHYSICAL spread of the neighbourhood actually used, for the
          // dimensional normaliser below. Arc length, not parameter units.
          const ax = p.x - p0.x, au = r0 * wrap2(p.u - p0.u);
          sp2 += w * (ax * ax + au * au); wsum += w;
          n++;
        }
      }
    }
    if (n < 8) continue;
    const cy = solve2(M.map((r) => [...r]), by, 6), cz = solve2(M.map((r) => [...r]), bz, 6);
    if (!cy || !cz) continue;
    res[i] = Math.hypot(cy[0] - p0.y, cz[0] - p0.z);
    spread[i] = wsum > 0 ? Math.sqrt(sp2 / wsum) : 0;
    kink[i] = spread[i] > 0 ? res[i] / spread[i] : 0;
  }
  return { residual: res, spread, kink, scale, hx, hu, considered: idx.length };
}

/**
 * v2 feature curves, DIMENSIONAL normaliser.
 *
 * A MEDIAN-RATIO THRESHOLD WAS TRIED FIRST AND FAILED ITS NEGATIVE CONTROL:
 * on a CLEAN smooth lathe at nt=96 it returned a 960-edge "curve" at ratio 32,
 * because on a regular mesh the median residual is machine noise and any
 * multiple of it is meaningless. A distributional normaliser cannot work here.
 *
 * The dimensional one can. Leave-one-out residual scales as O(h^4) times a
 * fourth derivative on a smooth patch, but as h*tan(delta/2) across a crease of
 * turn delta. Dividing by the neighbourhood's own weighted PHYSICAL spread
 * therefore gives a dimensionless kink that is ~(h/R)^3 on smooth geometry --
 * about 0.004 for these bodies -- and ~0.1 at a real chine. That separation is
 * derived from the geometry, not fitted to the observations.
 */
export function detectFeatureCurvesV2(verts, faces, { kinkThreshold, minEdges, cx = 2.5, cu = 2.5 }) {
  const { kink, hx, hu } = creaseResiduals(verts, faces, { cx, cu });
  const isCand = kink.map((v) => v > kinkThreshold && v > 0);

  const edgeFaces = new Map();
  faces.forEach((f, fi) => {
    for (let e = 0; e < f.length; e++) {
      const k = EKEY(f[e], f[(e + 1) % f.length]);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k).push(fi);
    }
  });
  const cand = [];
  for (const k of edgeFaces.keys()) {
    const ab = k.split('_');
    if (isCand[+ab[0]] && isCand[+ab[1]]) cand.push(k);
  }
  const byVert = new Map();
  for (const k of cand) {
    const ab = k.split('_').map(Number);
    for (const v of ab) { if (!byVert.has(v)) byVert.set(v, []); byVert.get(v).push(k); }
  }
  const seen = new Set(), curves = [];
  for (const s of cand) {
    if (seen.has(s)) continue;
    const stack = [s], comp = [];
    seen.add(s);
    while (stack.length) {
      const k = stack.pop();
      comp.push(k);
      for (const v of k.split('_').map(Number)) {
        for (const nb of byVert.get(v) || []) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    curves.push(comp);
  }
  const kept = curves.filter((c) => c.length >= minEdges);
  const featureEdges = new Set();
  for (const c of kept) for (const k of c) featureEdges.add(k);
  return {
    featureEdges, curves: kept, edgeFaces,
    stats: {
      kinkThreshold,
      candidateVertices: isCand.filter(Boolean).length, candidateEdges: cand.length,
      components: curves.length, keptCurves: kept.length, featureEdges: featureEdges.size,
      longestCurve: curves.length ? Math.max(...curves.map((c) => c.length)) : 0, hx, hu,
    },
  };
}

/* ================================================================== */
/* CURVE COMPLETION — spec 43, frozen 1ca33c9.                         */
/*                                                                     */
/* Seeds are strong evidence and are NEVER revised here. Completion may */
/* only bridge gaps, and only where all four frozen conditions hold. If */
/* no unambiguous continuation exists the feature is LEFT INCOMPLETE    */
/* and reported -- no boundary is invented to make flood fill succeed.  */
/*                                                                     */
/* Nothing analytic enters: seeds, the kink field, vertex positions and */
/* mesh connectivity only (spec 41.2).                                  */
/* ================================================================== */

/** Physical surface offset between two vertices: (dx, arc). */
function surfDelta(P, a, b) {
  const ra = Math.hypot(P[a].y, P[a].z), rb = Math.hypot(P[b].y, P[b].z);
  return [P[b].x - P[a].x, ((ra + rb) / 2) * wrap2(P[b].u - P[a].u)];
}
const unit = (v) => { const m = Math.hypot(v[0], v[1]); return m > 0 ? [v[0] / m, v[1] / m] : [0, 0]; };
const angBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));

/**
 * @param {object} det  result of detectFeatureCurvesV2
 * @param {number[]} kink  per-vertex kink field from creaseResiduals
 */
export function completeFeatureCurves(verts, faces, det, kink, {
  thetaMax, kappaSoft, lambda, gapMax, rho,
}) {
  // parameter samples, matching the detector's own parameterisation
  const P = verts.map((v) => {
    const r = Math.hypot(v[1], v[2]);
    return r < 1e-9 ? null : { x: v[0], u: Math.atan2(v[2], v[1]), y: v[1], z: v[2] };
  });

  // mesh adjacency and boundary edges
  const adj = new Map(), boundaryVert = new Set();
  for (const [k, fs] of det.edgeFaces) {
    const [a, b] = k.split('_').map(Number);
    if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b);
    if (!adj.has(b)) adj.set(b, []); adj.get(b).push(a);
    if (fs.length === 1) { boundaryVert.add(a); boundaryVert.add(b); }
  }

  // seed subgraph, and which component each seed vertex belongs to
  const seedEdges = new Set(det.featureEdges);
  const seedAdj = new Map(), compOf = new Map();
  det.curves.forEach((comp, ci) => {
    for (const k of comp) {
      const [a, b] = k.split('_').map(Number);
      if (!seedAdj.has(a)) seedAdj.set(a, []); seedAdj.get(a).push(b);
      if (!seedAdj.has(b)) seedAdj.set(b, []); seedAdj.get(b).push(a);
      compOf.set(a, ci); compOf.set(b, ci);
    }
  });

  // background kink: vertices neither in a seed nor within gapMax edges of one
  const near = new Set(seedAdj.keys());
  let frontier = [...near];
  for (let d = 0; d < gapMax; d++) {
    const next = [];
    for (const v of frontier) for (const w of adj.get(v) || []) if (!near.has(w)) { near.add(w); next.push(w); }
    frontier = next;
  }
  const bg = [];
  for (let i = 0; i < verts.length; i++) if (P[i] && !near.has(i) && kink[i] > 0) bg.push(kink[i]);
  bg.sort((a, b) => a - b);
  const kappaBg = bg.length ? bg[Math.floor(0.9 * bg.length)] : 0;
  const supportFloor = Math.max(kappaSoft, lambda * kappaBg);
  const supported = (v) => kink[v] >= supportFloor;

  const bridges = new Set();
  const ambiguous = [], unresolved = [];
  const stats = { kappaBg, supportFloor, endpoints: 0, accepted: 0, ambiguous: 0, unresolved: 0, rounds: 0 };

  const endpointsOf = () => {
    const deg = new Map();
    const bump = (v) => deg.set(v, (deg.get(v) || 0) + 1);
    for (const k of [...seedEdges, ...bridges]) { const [a, b] = k.split('_').map(Number); bump(a); bump(b); }
    return [...deg.entries()].filter(([, d]) => d === 1).map(([v]) => v);
  };

  /** Unit tangent of the last <=3 curve edges arriving at v, pointing outward. */
  const tangentAt = (v) => {
    const cur = new Set([...seedEdges, ...bridges]);
    let prev = v, back = v;
    for (let s = 0; s < 3; s++) {
      let nxt = null;
      for (const w of adj.get(back) || []) {
        const k = back < w ? `${back}_${w}` : `${w}_${back}`;
        if (cur.has(k) && w !== prev) { nxt = w; break; }
      }
      if (nxt === null) break;
      prev = back; back = nxt;
    }
    if (back === v) return null;
    return unit(surfDelta(P, back, v));            // pointing away from the curve
  };

  for (let round = 0; round < 12; round++) {
    stats.rounds = round + 1;
    const eps = endpointsOf();
    if (!eps.length) break;
    let acceptedThisRound = 0;

    for (const v of eps) {
      if (boundaryVert.has(v)) continue;                   // legitimate termination
      const tv = tangentAt(v);
      if (!tv) continue;
      const myComp = compOf.get(v);

      // BFS over SUPPORTED non-seed vertices only, depth <= gapMax
      const cands = [];
      const seenPath = new Map([[v, null]]);
      let level = [v];
      for (let d = 1; d <= gapMax && level.length; d++) {
        const nl = [];
        for (const a of level) {
          for (const b of adj.get(a) || []) {
            if (seenPath.has(b)) continue;
            const isSeedV = seedAdj.has(b);
            if (isSeedV) {
              // terminal: reconstruct path
              const path = [b, a];
              let p = seenPath.get(a);
              while (p !== null && p !== undefined) { path.push(p); p = seenPath.get(p); }
              path.reverse();
              if (path[0] !== v) continue;
              if (compOf.get(b) === myComp && d <= 2) continue;   // trivial re-join
              cands.push(path);
              continue;
            }
            if (!supported(b)) continue;                    // CONDITION 2
            seenPath.set(b, a); nl.push(b);
          }
        }
        level = nl;
      }
      if (!cands.length) { unresolved.push(v); continue; }

      const scored = [];
      for (const path of cands) {
        const far = path[path.length - 1];
        const dir = unit(surfDelta(P, v, far));
        const aStart = angBetween(tv, dir);                 // CONDITION 1
        if (aStart > thetaMax) continue;
        const tf = tangentAt(far);
        let aEnd = 0;
        if (tf) {
          // a continuation, not a T-junction: the far tangent must oppose the
          // arrival direction (i.e. the curve carries on through)
          aEnd = angBetween(tf, [-dir[0], -dir[1]]);
          if (aEnd > thetaMax) continue;
        }
        const len = path.length - 1;                        // CONDITION 3 (edges)
        scored.push({ path, score: aStart + aEnd + (len / gapMax) * thetaMax });
      }
      if (!scored.length) { unresolved.push(v); continue; }
      scored.sort((a, b) => a.score - b.score);
      if (scored.length > 1 && scored[1].score < rho * scored[0].score) {  // CONDITION 4
        ambiguous.push(v); continue;
      }
      const best = scored[0].path;
      for (let i = 0; i + 1 < best.length; i++) {
        const a = best[i], b = best[i + 1];
        bridges.add(a < b ? `${a}_${b}` : `${b}_${a}`);
      }
      acceptedThisRound++; stats.accepted++;
    }
    if (!acceptedThisRound) break;
  }

  const eps = endpointsOf();
  stats.endpoints = eps.length;
  stats.ambiguous = new Set(ambiguous).size;
  stats.unresolved = new Set(unresolved).size;
  stats.bridgeEdges = bridges.size;
  stats.seedEdges = seedEdges.size;
  // an endpoint that is neither closed nor on a genuine boundary = INCOMPLETE
  stats.incompleteEndpoints = eps.filter((v) => !boundaryVert.has(v)).length;
  stats.complete = stats.incompleteEndpoints === 0;

  const featureEdges = new Set([...seedEdges, ...bridges]);
  return { featureEdges, bridges, stats };
}
