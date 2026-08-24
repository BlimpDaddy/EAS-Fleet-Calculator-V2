/**
 * TRANSVERSE SECTION CUTTER — shared harness infrastructure (spec 33.5).
 *
 * The Phase 1E K-selection driver was ad-hoc and was never committed, so
 * the numbers in spec 31/32 have no surviving code. This file and
 * `ribbons-kselect.mjs` rebuild it AND ARE COMMITTED. Nothing here does
 * feature detection, reconstruction or fitting: it returns only the raw
 * plane-intersection segments that the frozen contour primitive consumes.
 *
 * Bodies handled here are analytic controls built by `analyticBody`, which
 * are centred on the origin with flight along +X, e0 = +Y, e1 = +Z. No
 * centroid or frame inference is involved — introducing it would put a
 * second unvalidated stage between the mesh and the primitive.
 */

/** 24 rays, matching `extractRibbons` at planes = 12 exactly. */
export const PLANES = 12;
export const RAYS = Array.from({ length: 2 * PLANES }, (_, k) =>
  (Math.PI * (k % PLANES)) / PLANES + (k >= PLANES ? Math.PI : 0));

/**
 * Segments of the intersection of the mesh with the plane x = xi,
 * expressed in the transverse (Y, Z) plane.
 *
 * A vertex lying ON the cutting plane produces duplicated hits and can push
 * a triangle to three, which would inject a spurious segment. That is the
 * frozen "do not pick a station coincident with a mesh ring" trap, so it is
 * DETECTED here rather than trusted: `onPlane` is returned and the caller
 * is expected to treat a non-zero value as a harness fault.
 */
export function sectionSegments(verts, faces, xi, { eps = 1e-12 } = {}) {
  const segs = [];
  let onPlane = 0, tripleHit = 0;
  for (const f of faces) {
    const P = f.map((i) => verts[i]);
    const hits = [];
    for (let e = 0; e < P.length; e++) {
      const A = P[e], B = P[(e + 1) % P.length];
      const da = A[0] - xi, db = B[0] - xi;
      if (Math.abs(da) < eps) onPlane++;
      if ((da < 0 && db < 0) || (da > 0 && db > 0) || da === db) continue;
      const t = da / (da - db);
      if (t < 0 || t > 1) continue;
      hits.push([A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])]);
    }
    if (hits.length > 2) tripleHit++;
    for (let h = 0; h + 1 < hits.length; h++) segs.push([hits[h], hits[h + 1]]);
  }
  return { segs, onPlane, tripleHit };
}

/** Station grid identical to `extractRibbons`: `stations` samples over [x0, x1]. */
export function stationGrid(halfLen, stations) {
  return Array.from({ length: stations }, (_, i) => -halfLen + (2 * halfLen * i) / (stations - 1));
}
