/**
 * SPIKE — synthetic calibration anchors (DYNAMIC-SPEC §5.2), procedural.
 * All meshes: flow axis +X, unit-ish cross-section, centered at origin.
 * {verts: [[x,y,z]...], faces: [[i,j,k]...]} — same shape contract as
 * parseObjMesh. Never baked, never deployed: spike/ is outside the bake.
 */

/** UV sphere, diameter 1. */
export function makeSphere(segs = 28, rings = 18) {
  const verts = [], faces = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (Math.PI * r) / rings;
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      verts.push([0.5 * Math.cos(phi), 0.5 * Math.sin(phi) * Math.cos(th), 0.5 * Math.sin(phi) * Math.sin(th)]);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * segs + s, b = r * segs + ((s + 1) % segs);
      const c = (r + 1) * segs + s, d = (r + 1) * segs + ((s + 1) % segs);
      faces.push([a, b, d], [a, d, c]);
    }
  }
  return { verts, faces };
}

/** Axis-aligned cube, side 1. */
export function makeCube() {
  const s = 0.5;
  const verts = [];
  for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) verts.push([x, y, z]);
  // 12 triangles, outward winding not required (parity voxeliser is winding-blind)
  const faces = [
    [0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], // x faces
    [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6], // y faces
    [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3], // z faces
  ];
  return { verts, faces };
}

/** Thin plate 1×1, normal to the flow (thickness 0.08 along X). */
export function makePlate() {
  const { verts, faces } = makeCube();
  return { verts: verts.map(([x, y, z]) => [x * 0.08, y, z]), faces };
}

/** Streamlined body of revolution: rounded nose, tapered tail.
 *  Diameter 1, length = fineness. Profile r(t) ∝ √t·(1−t)^1.5. */
export function makeTeardrop(fineness = 3, rings = 40, segs = 24) {
  const rmax = Math.sqrt(0.25) * Math.pow(0.75, 1.5); // profile max at t=0.25
  const profile = (t) => 0.5 * (Math.sqrt(t) * Math.pow(1 - t, 1.5)) / rmax;
  const verts = [], faces = [];
  const nose = verts.push([-fineness / 2, 0, 0]) - 1;
  for (let r = 1; r < rings; r++) {
    const t = r / rings;
    const x = -fineness / 2 + fineness * t, rad = Math.max(profile(t), 1e-4);
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      verts.push([x, rad * Math.cos(th), rad * Math.sin(th)]);
    }
  }
  const tail = verts.push([fineness / 2, 0, 0]) - 1;
  const ring = (r) => 1 + (r - 1) * segs; // first vertex index of ring r
  for (let s = 0; s < segs; s++) faces.push([nose, ring(1) + s, ring(1) + ((s + 1) % segs)]);
  for (let r = 1; r < rings - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = ring(r) + s, b = ring(r) + ((s + 1) % segs);
      const c = ring(r + 1) + s, d = ring(r + 1) + ((s + 1) % segs);
      faces.push([a, b, d], [a, d, c]);
    }
  }
  for (let s = 0; s < segs; s++) faces.push([tail, ring(rings - 1) + ((s + 1) % segs), ring(rings - 1) + s]);
  return { verts, faces };
}

/** Smooth 3:1 ellipsoid (elongated along flow) — OUT-OF-SAMPLE only. */
export function makeEllipsoid(ratio = 3) {
  const { verts, faces } = makeSphere();
  return { verts: verts.map(([x, y, z]) => [x * ratio, y, z]), faces };
}

/** Generic capped lathe: profile r(t) over t∈[0,1] along X, flat caps at
 *  both ends wherever r > 0. For adversarial bodies (r9 fixtures). */
export function makeLathe(profile, length = 4, rings = 48, segs = 24) {
  const verts = [], faces = [];
  const ring = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, rad = Math.max(profile(t), 0);
    const x = -length / 2 + length * t;
    if (rad < 1e-6) { ring.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      verts.push([x, rad * Math.cos(th), rad * Math.sin(th)]);
    }
    ring.push(first);
  }
  const isPole = (i) => Math.max(profile(i / rings), 0) < 1e-6;
  for (let i = 0; i < rings; i++) {
    const a = ring[i], b = ring[i + 1];
    const aPole = isPole(i), bPole = isPole(i + 1);
    if (aPole && bPole) continue;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      if (aPole) faces.push([a, b + s, b + s1]);
      else if (bPole) faces.push([b, a + s1, a + s]);
      else faces.push([a + s, b + s, b + s1], [a + s, b + s1, a + s1]);
    }
  }
  // Flat caps on open ends (r > 0 at t = 0 or 1).
  if (!isPole(0)) {
    const c = verts.push([-length / 2, 0, 0]) - 1;
    for (let s = 0; s < segs; s++) faces.push([c, ring[0] + s, ring[0] + ((s + 1) % segs)]);
  }
  if (!isPole(rings)) {
    const c = verts.push([length / 2, 0, 0]) - 1;
    for (let s = 0; s < segs; s++) faces.push([c, ring[rings] + ((s + 1) % segs), ring[rings] + s]);
  }
  return { verts, faces };
}

/** r9 adversary A: flat circular front face + long gentle conical
 *  boat-tail. The aft-only model called this 18× better than a teardrop. */
export function makeFlatFrontBoatTail(fineness = 4) {
  return makeLathe((t) => 0.5 * (1 - t), fineness);
}

/** r9 adversary B: neck/re-expansion body — contracts steeply, re-expands,
 *  then closes steeply. Short (L=1.5) so slopes bite: drives the
 *  unenveloped aft walk past 1 (the old calibration-Infinity path). */
export function makeNeckBody() {
  return makeLathe((t) => {
    if (t < 0.2) return 0.5;
    if (t < 0.4) return 0.5 - 1.75 * (t - 0.2);     // neck down to 0.15
    if (t < 0.6) return 0.15 + 1.75 * (t - 0.4);    // re-expand to 0.5
    return Math.max(0.5 - 1.25 * (t - 0.6), 0.03);  // steep final closure
  }, 1.5);
}

/** r9 known-blindness pair: round vs square sections with IDENTICAL A(x)
 *  (square side = √π × radius). Equal area curves → equal scores — the
 *  documented sectional-shape blind spot. */
export function makeRoundRod(length = 3, r = 0.5) {
  return makeLathe(() => r, length);
}
export function makeSquareRod(length = 3, r = 0.5) {
  const s = Math.sqrt(Math.PI) * r; // side/2 giving area πr² is √π·r / ... side = √(πr²) => half-side = √π·r/2
  const { verts, faces } = makeCube();
  return { verts: verts.map(([x, y, z]) => [x * length, y * s, z * s]), faces };
}

/** Teardrop truncated at cutFrac of its length, sealed with a flat cap —
 *  the "sharp-cut sanity" body: chopping the tail MUST worsen the aft
 *  score (battery invariant, 2026-08-15). */
export function makeChoppedTeardrop(fineness = 3, cutFrac = 0.7, rings = 40, segs = 24) {
  const full = makeTeardrop(fineness, rings, segs);
  const xCut = -fineness / 2 + fineness * cutFrac;
  // Keep vertices ahead of the cut; ring structure: verts[0]=nose, then
  // (rings-1) rings of `segs`, then tail vertex. Rebuild simply: filter
  // faces fully ahead of the cut, then cap the last surviving ring.
  const keep = full.verts.map((v) => v[0] <= xCut + 1e-9);
  const faces = full.faces.filter((f) => f.every((i) => keep[i]));
  const verts = [...full.verts];
  // Find the last full ring still present (all segs vertices kept).
  const ring = (r) => 1 + (r - 1) * segs;
  let lastRing = -1;
  for (let r = 1; r < rings; r++) {
    let all = true;
    for (let s = 0; s < segs; s++) if (!keep[ring(r) + s]) { all = false; break; }
    if (all) lastRing = r; else break;
  }
  if (lastRing > 0) {
    const cx = full.verts[ring(lastRing)][0];
    const centre = verts.push([cx, 0, 0]) - 1;
    for (let s = 0; s < segs; s++) {
      faces.push([centre, ring(lastRing) + ((s + 1) % segs), ring(lastRing) + s]);
    }
  }
  return { verts, faces };
}
