/**
 * ORDERED SECTION CONTOUR — the primitive Phase 1E needs (2026-08-20).
 * Frozen repair per ruling. This file contains NO feature detection and no
 * knowledge of K: it recovers only the ordered loop that the mesh-plane
 * intersection already defines. Keeping K out of its own input is the
 * point.
 *
 * NO ANGULAR-SORT FALLBACK. Segment connectivity is ground truth. If the
 * segments cannot be chained unambiguously into the expected loop, this
 * reports a contour-quality FAILURE rather than inventing an ordering.
 */
const KEY = (p, tol) => `${Math.round(p[0] / tol)}_${Math.round(p[1] / tol)}`;

/**
 * @param {number[][][]} segs  [[ [a0,a1], [b0,b1] ], ...] in the section plane
 * @returns {{ok:boolean, loop:number[][]|null, reason:string|null, stats:object}}
 */
export function chainContour(segs, { tol = 1e-9 } = {}) {
  const stats = { rawSegments: segs.length, dropped: 0, collinearRemoved: 0 };
  // drop zero-length segments
  const S = segs.filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > tol);
  stats.dropped = segs.length - S.length;
  if (S.length < 3) return { ok: false, loop: null, reason: `only ${S.length} usable segments`, stats };

  // adjacency by shared endpoint
  const nodes = new Map();
  const add = (p, si) => { const k = KEY(p, tol);
    if (!nodes.has(k)) nodes.set(k, { p, segs: [] });
    nodes.get(k).segs.push(si); };
  S.forEach(([a, b], i) => { add(a, i); add(b, i); });

  // every node of a clean closed loop has degree exactly 2
  let bad = 0;
  for (const n of nodes.values()) if (n.segs.length !== 2) bad++;
  if (bad) return { ok: false, loop: null, reason: `${bad} of ${nodes.size} vertices have degree != 2 (open or branching contour)`, stats };

  // walk the loop
  const used = new Set();
  const startK = nodes.keys().next().value;
  let curK = startK, loop = [], guard = 0;
  for (;;) {
    if (++guard > S.length + 2) return { ok: false, loop: null, reason: 'walk did not terminate', stats };
    const node = nodes.get(curK);
    loop.push(node.p);
    const si = node.segs.find((i) => !used.has(i));
    if (si === undefined) break;
    used.add(si);
    const [a, b] = S[si];
    curK = KEY(a, tol) === curK ? KEY(b, tol) : KEY(a, tol);
    if (curK === startK) break;
  }
  if (used.size !== S.length) return { ok: false, loop: null, reason: `chained ${used.size} of ${S.length} segments (multiple loops)`, stats };

  // remove ONLY numerically collinear intermediate points; keep every real corner
  const out = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const p = loop[(i - 1 + n) % n], q = loop[i], r = loop[(i + 1) % n];
    const cr = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const scale = Math.hypot(q[0] - p[0], q[1] - p[1]) * Math.hypot(r[0] - q[0], r[1] - q[1]);
    if (scale > 0 && Math.abs(cr) / scale < 1e-10) { stats.collinearRemoved++; continue; }
    out.push(q);
  }
  stats.vertices = out.length;
  if (out.length < 3) return { ok: false, loop: null, reason: 'degenerate after collinear removal', stats };
  return { ok: true, loop: out, reason: null, stats };
}

/** Signed area — winding consistency check. */
export function signedArea(loop) {
  let a = 0; const n = loop.length;
  for (let i = 0; i < n; i++) { const p = loop[i], q = loop[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
