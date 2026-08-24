/**
 * EAS BODY LOADER — each file's frame and scale DECLARED, never assumed.
 *
 * Written after a real error: the bare hull and the tailed aero-hull candidate
 * use DIFFERENT conventions, and applying the bare hull's relabel to the
 * tailed file rotated it 90 degrees off its own flight axis and forced the
 * wrong length. Every tailed number computed that way was wrong by ~9x.
 *
 *   Sunship.obj                        +Z forward, +Y up, UNIT scale
 *   sunship-tail-aerohull-candidate.obj  +X forward already, METRES, L = 516 m
 *
 * The loader ASSERTS that the declared flight axis is the longest extent, so a
 * mis-declaration fails loudly instead of producing a plausible wrong number.
 */
import { readFileSync } from 'node:fs';
import { parseObjVertices, parseObjMesh } from '../../../site/calcv2/src/obj.js';
import { volumeCentroid } from './ribbons.mjs';
import { hullMesh } from './hull-bodies.mjs';

const ROOT = 'C:/Users/Toby/Desktop/CodeEverything/';

export const EAS_BODIES = {
  bare: {
    label: 'Sunship BARE',
    path: `${ROOT}3D OBJ/Sunship.obj`,
    // (X,Y,Z) -> (Z, Y, -X): +Z fwd becomes +X, +Y up stays at theta 0, right-handed
    relabel: (p) => [p[2], p[1], -p[0]],
    lengthM: 300,                       // canonical circumsphere diameter
    note: 'canonical bare hull, unit-scale OBJ normalised to 300 m',
  },
  tailed: {
    label: 'Sunship TAILED (deployed fairing)',
    path: `${ROOT}CalcV2/lab/sunship-tail-aerohull-candidate.obj`,
    relabel: (p) => p,                  // ALREADY +X forward
    lengthM: 516,                       // its own header: envelope 300 + fairing 216
    note: 'authored-by-formula aero-hull candidate, already metric at 516 m deployed',
  },
};

export function loadEasBody(key) {
  const b = EAS_BODIES[key];
  if (!b) throw new Error(`loadEasBody: unknown body '${key}'`);
  const raw = parseObjVertices(readFileSync(b.path, 'utf8')).map(b.relabel);

  // ASSERT the declared frame: flight axis must be the longest extent.
  const ext = [0, 1, 2].map((i) => {
    const a = raw.map((p) => p[i]);
    return Math.max(...a) - Math.min(...a);
  });
  const longest = ext.indexOf(Math.max(...ext));
  if (longest !== 0) {
    throw new Error(`loadEasBody(${key}): declared flight axis is +X but the longest extent is ` +
      `${['X', 'Y', 'Z'][longest]} (${ext.map((e) => e.toFixed(3)).join(' / ')}). Frame mis-declared.`);
  }

  const h0 = hullMesh(raw);                                   // canonical upload-hull rule
  const c = volumeCentroid(h0.verts, h0.faces).c;             // spec 4.1 volume centroid
  const shift = (p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];

  // BOTH GEOMETRY PATHS, always (spec 78). The authored path is what the
  // preset Cd actually uses; the hull path is what uploads use and what the
  // ribbon layer requires. Returning only one hides which geometry a number
  // came from -- the mismatch that spec 77.2 exposed.
  const m = parseObjMesh(readFileSync(b.path, 'utf8'));
  const authoredVerts = m.verts.map(b.relabel).map(shift);
  const authoredFaces = capOpenRings(authoredVerts, m.faces);
  return {
    ...b,
    hull: { verts: h0.verts.map(shift), faces: h0.faces, identity: 'convex-hull(canonical)' },
    authored: m.faces.length
      ? { verts: authoredVerts, faces: authoredFaces.faces, identity: 'authored-mesh(as-supplied)',
          capped: authoredFaces.capped }
      : null,
    // back-compat: the hull is still the default surface
    verts: h0.verts.map(shift), faces: h0.faces,
    extentRatio: (ext[1] / ext[2]),                           // 1.0 => transversely axisymmetric
    extents: ext,
  };
}

/**
 * MESH COMPLETION, NOT DESIGN INVENTION.
 *
 * The tailed surrogate's lathe starts at a small non-zero radius and never
 * closes its first ring, leaving one 64-edge boundary loop AT THE NOSE
 * (x = 0.0000 of length, r = 4.112 m on a 516 m body). That is an incomplete
 * mesh, not an aerodynamic opening — it is neither the tail root nor a distal
 * trailing rim — so E3's closed-surface requirement stands unrelaxed and the
 * ring is simply closed.
 *
 * Each open loop is fanned to its own centroid. The cap sits inside the 2.5%
 * tip exclusion, so it cannot reach any earned zone. A loop found anywhere
 * OTHER than within the tip band is NOT capped — that would be inventing
 * geometry — and is left to fail E3 loudly.
 */
export function capOpenRings(verts, faces, tipFrac = 0.025) {
  const inc = new Map();
  for (const f of faces) {
    for (let e = 0; e < f.length; e++) {
      const a = f[e], c = f[(e + 1) % f.length];
      if (a === c) continue;
      const k = a < c ? `${a}_${c}` : `${c}_${a}`;
      inc.set(k, (inc.get(k) || 0) + 1);
    }
  }
  const bnd = [...inc.entries()].filter(([, n]) => n === 1).map(([k]) => k.split('_').map(Number));
  if (!bnd.length) return { faces, capped: 0 };

  const xs = verts.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), L = x1 - x0;
  const adj = new Map();
  for (const [a, c] of bnd) {
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(c)) adj.set(c, []);
    adj.get(a).push(c); adj.get(c).push(a);
  }
  const out = faces.slice();
  const seen = new Set();
  let capped = 0;
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = []; const stack = [start];
    while (stack.length) {
      const u = stack.pop(); if (seen.has(u)) continue;
      seen.add(u); loop.push(u);
      for (const w of adj.get(u)) if (!seen.has(w)) stack.push(w);
    }
    const lx = loop.map((i) => verts[i][0]);
    const near = (Math.min(...lx) - x0) / L, far = (x1 - Math.max(...lx)) / L;
    if (Math.min(near, far) > tipFrac) continue;          // not a tip ring: DO NOT invent geometry
    // order the loop by azimuth about the axis, then fan to its centroid
    const cen = loop.reduce((a, i) => [a[0] + verts[i][0], a[1] + verts[i][1], a[2] + verts[i][2]], [0, 0, 0])
      .map((v) => v / loop.length);
    const ci = verts.push(cen) - 1;
    const ordered = [...loop].sort((a, c) =>
      Math.atan2(verts[a][2] - cen[2], verts[a][1] - cen[1]) - Math.atan2(verts[c][2] - cen[2], verts[c][1] - cen[1]));
    for (let i = 0; i < ordered.length; i++) out.push([ci, ordered[i], ordered[(i + 1) % ordered.length]]);
    capped++;
  }
  return { faces: out, capped };
}
