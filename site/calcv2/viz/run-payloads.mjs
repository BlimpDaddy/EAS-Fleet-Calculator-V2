/**
 * ribbon-render/1 RUNNER — node shell around the pure Layer-1 generator.
 *
 * Owns everything the generator deliberately does not: file loading,
 * declared orientation relabels, scale to metres, the canonical upload-hull
 * rule, and where the bytes land. In the product the page adapter plays
 * this role; baked JSON from here is TEST FIXTURES ONLY (sealed plan §2.1).
 *
 * Frames and scales are DECLARED, never detected (the eas-bodies.mjs
 * lesson): each body states its file-frame orientation axis; scale maps the
 * axial extent to the declared length in metres (DYNAMIC-SPEC §12.2:
 * "scaled to L = 300 m along travel").
 *
 *   node viz/run-payloads.mjs                 build all presets, write viz/fixtures/
 *   node viz/run-payloads.mjs --hash-only sunship   print payloadId only (byte-stability fixture)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjVertices, parseObjMesh, facesToEdgeList } from '../src/obj.js';
import { ribbonContext } from '../spike/sectional/ribbon-context.mjs';
import { hullMesh } from '../spike/sectional/hull-bodies.mjs';
import { volumeCentroid } from '../spike/sectional/ribbons.mjs';
import { capOpenRings } from '../spike/sectional/eas-bodies.mjs';
import { BASELINE } from '../spike/sectional/smart-tail.mjs';
import { buildRenderPayload } from './layer1/render-payload.mjs';
import { buildGenericTailBody } from './layer1/tail-rule.mjs';
import { buildDesignTailShell, buildPastedDesignTail } from './layer1/tail-visual.mjs';
import { finalizePayload } from './layer1/canonical-json.mjs';
import { SIZE_WARN_BYTES, SIZE_FAIL_BYTES } from './layer1/constants.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OBJ_DIR = join(here, '..', '..', '3D OBJ');
const FIXTURE_DIR = join(here, 'fixtures');

/* declared file-frame → payload-frame (+X flight) relabels, right-handed */
const RELABEL = {
  '+X': (p) => p,
  '-X': (p) => [-p[0], p[1], -p[2]],                 // +X then yaw 180° (right-handed)
  '+Y': (p) => [p[1], p[2], p[0]],
  '-Y': (p) => [-p[1], p[2], -p[0]],                 // +Y then yaw 180°
  '+Z': (p) => [p[2], p[1], -p[0]],
  '-Z': (p) => [-p[2], p[1], p[0]],                  // +Z then yaw 180°
};

export const BODIES = {
  sunship: { file: 'Sunship.obj', orientationAxis: '+Z', lengthM: 300, authoredTail: true },
  sphere: { file: 'sphere.obj', orientationAxis: '+Z', lengthM: 300 },
  cube: { generate: 'box', orientationAxis: '+X', lengthM: 300 },   // analytic — the trio's corner case
  cigar: { file: 'cigar.obj', orientationAxis: '-Z', lengthM: 300 },   // '+X' was a never-exercised
                                                                       // mis-declaration (caught when the
                                                                       // bench gained the body, 2026-08-22:
                                                                       // 1101 m sphere1); file long axis
                                                                       // inspected = z, like the other exports.
                                                                       // NOTE (same day, corrected against
                                                                       // the live page): the obj is a FINNED
                                                                       // airship — 4 fin blades in a cross
                                                                       // (azimuths 0/±90/180°, r 0.139 vs
                                                                       // body 0.110) at the fat end. The
                                                                       // canonical upload-hull rule (owner,
                                                                       // 2026-08-16, worker.js) bridges the
                                                                       // fins, which is why the silhouette
                                                                       // reads flat-ended — same squarish
                                                                       // wrap page 1 shows in magenta.
                                                                       // Page-1 preset + calibration corpus
                                                                       // asset: NOT to be edited here.
                                                                       // '-Z' CONFIRMED by owner 2026-08-22
                                                                       // ("an airship doesn't fly fins
                                                                       // first... of course not"): pointed
                                                                       // end leads, fins trail. The bench
                                                                       // orientation buttons cover any body
                                                                       // loaded the wrong way round.
  /* "cigar is a name for an airship shape — it's not literally a cigar"
     (Toby, 2026-08-22): the airship-cigar concept is rounded both ends,
     which no obj in the corpus is. Analytic prolate spheroid, bench test
     body only — fineness 5:1, measured ELIGIBLE (the 7.3:1 cigar.obj
     trips the E4 slender-body limitation; higher fineness untested). */
  airshipcigar: { generate: 'spheroid', fineness: 5, orientationAxis: '+X', lengthM: 300 },
  washingmachine: { file: 'washingmachine.obj', orientationAxis: '+Y', lengthM: 300 },
  /* V5 step 1 (2026-08-23): the remaining page-1 presets, axes from the
     RATIFIED natural-attitude ruling (2026-08-16, pinned in the page's
     generated records): bottle −Y cap-first, car +Z, lenticular (the
     Aerosmena) +Z. The cigar's ratified sign is '+Z' but the owner's
     2026-08-22 visual confirmation ('-Z', fins trail) stands for the
     visual payloads — RECONCILE at the V5 orientation-binding gate. */
  bottle: { file: 'Bottle.obj', orientationAxis: '-Y', lengthM: 300 },
  car: { file: 'car.obj', orientationAxis: '+Z', lengthM: 300 },
  aerosmena: { file: 'Aerosmena.obj', orientationAxis: '+Z', lengthM: 300 },
};

/** analytic axis-aligned box, side = 1 (scaled by the normal pipeline) */
function boxMesh() {
  const v = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) v.push([x, y, z]);
  return v;
}

/** the box's 12 edges (indices into boxMesh order) */
function boxEdges() {
  const idx = (x, y, z) => (x ? 4 : 0) + (y ? 2 : 0) + (z ? 1 : 0);
  const e = [];
  for (const a of [0, 1]) for (const b of [0, 1]) {
    e.push([idx(0, a, b), idx(1, a, b)], [idx(a, 0, b), idx(a, 1, b)], [idx(a, b, 0), idx(a, b, 1)]);
  }
  return e;
}

/** spheroid display lattice: every 4th ring + 8 meridians (indices into spheroidMesh order) */
function spheroidEdges(fineness) {
  const RINGS = 48, SEGS = 32;
  const at = (i, s) => 2 + (i - 1) * SEGS + (s % SEGS);      // rings start after the two poles
  const e = [];
  for (let i = 4; i < RINGS; i += 4) {
    for (let s = 0; s < SEGS; s++) e.push([at(i, s), at(i, s + 1)]);
  }
  for (let s = 0; s < SEGS; s += 4) {
    e.push([0, at(1, s)]);
    for (let i = 1; i < RINGS - 1; i++) e.push([at(i, s), at(i + 1, s)]);
    e.push([at(RINGS - 1, s), 1]);
  }
  return e;
}

/** analytic prolate spheroid, length 1 along x, diameter 1/fineness (convex —
    the hull step is exact on it); dense enough that the support skin sees a
    smooth dome at both poles */
function spheroidMesh(fineness) {
  const b = 0.5 / fineness, v = [[-0.5, 0, 0], [0.5, 0, 0]];
  const RINGS = 48, SEGS = 32;
  for (let i = 1; i < RINGS; i++) {
    const phi = (Math.PI * i) / RINGS;
    const x = -0.5 * Math.cos(phi), r = b * Math.sin(phi);
    for (let s = 0; s < SEGS; s++) {
      const th = (2 * Math.PI * s) / SEGS;
      v.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
  }
  return v;
}

const CANDIDATE_OBJ = join(here, '..', 'lab', 'sunship-tail-aerohull-candidate.obj');

/** Canonical retracted state: relabel → scale axial extent to lengthM → hull → centroid at origin.
 * Also carries the RAW shape's display geometry through the same transform
 * (owner ruling 2026-08-22: shape + hull drawn together, page-1 grammar) —
 * edges when the file has any (face boundaries + `l` polylines, exactly as
 * the page-1 worker extracts them), dots for lineless clouds, a generated
 * lattice for analytic bodies. */
/* ---- the 24 proper rotations (bench orientation group, 2026-08-22) ----
 * Owner round: the six signed-axis variants could never put a body's long
 * axis screen-vertical ("I CAN'T get it to face up>down") — axis choice
 * alone spans 6 of the 24 snap orientations. The buttons are now the two
 * the owner originally asked for — pitch 90° (rotate in the elevation
 * plane) and yaw 90° (rotate in the plan plane) — which generate the full
 * group. Matrices are row-major 9-int, applied AFTER the declared relabel
 * and AFTER scaling (size is fixed in the declared frame — orientation
 * must never rescale the object). */
export const ROT_IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const ROT_PITCH = [0, -1, 0, 1, 0, 0, 0, 0, 1];   // +90° about +Z: x→y (nose rotates up in elevation)
export const ROT_YAW = [0, 0, 1, 0, 1, 0, -1, 0, 0];     // +90° about +Y: z→x (nose rotates in plan)
export const rotApply = (M, p) => [
  M[0] * p[0] + M[1] * p[1] + M[2] * p[2],
  M[3] * p[0] + M[4] * p[1] + M[5] * p[2],
  M[6] * p[0] + M[7] * p[1] + M[8] * p[2],
];
export const rotCompose = (A, B) => {               // A·B (apply B, then A)
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  }
  return C;
};
export const rotKey = (M) => M.join(',');
export function rotationGroup() {                   // BFS over {pitch, yaw} from identity → all 24
  const seen = new Map([[rotKey(ROT_IDENTITY), ROT_IDENTITY]]);
  const queue = [ROT_IDENTITY];
  while (queue.length) {
    const M = queue.shift();
    for (const G of [ROT_PITCH, ROT_YAW]) {
      const N = rotCompose(G, M);
      const k = rotKey(N);
      if (!seen.has(k)) { seen.set(k, N); queue.push(N); }
    }
  }
  return [...seen.values()];                        // 24, identity first
}

export function loadRetracted(key, rot = null) {
  const b = BODIES[key];
  if (!b) throw new Error(`loadRetracted: unknown body '${key}'`);
  const axis = b.orientationAxis;
  const relabel = RELABEL[axis];
  if (!relabel) throw new Error(`loadRetracted(${key}): no relabel for axis '${axis}'`);
  let rawVerts, rawEdges = [], source;
  if (b.generate === 'box') {
    rawVerts = boxMesh();
    rawEdges = boxEdges();
    source = 'generated(box edges)';
  } else if (b.generate === 'spheroid') {
    rawVerts = spheroidMesh(b.fineness);
    rawEdges = spheroidEdges(b.fineness);
    source = 'generated(spheroid lattice)';
  } else {
    const mesh = parseObjMesh(readFileSync(join(OBJ_DIR, b.file), 'utf8'));
    rawVerts = mesh.verts;
    const edges = facesToEdgeList(mesh.faces);
    const seen = new Set(edges.map(([a, e2]) => (a < e2 ? a * 16777216 + e2 : e2 * 16777216 + a)));
    for (const [a, e2] of mesh.lineEdges) {
      const k2 = a < e2 ? a * 16777216 + e2 : e2 * 16777216 + a;
      if (!seen.has(k2)) { seen.add(k2); edges.push([a, e2]); }
    }
    rawEdges = edges;
    source = edges.length ? `mesh-edges(${b.file})` : `point-cloud(${b.file})`;
  }
  const raw = rawVerts.map(relabel);
  const xs = raw.map((p) => p[0]);
  const axial = Math.max(...xs) - Math.min(...xs);
  if (!(axial > 0)) throw new Error(`loadRetracted(${key}): zero axial extent`);
  const s = b.lengthM / axial;                      // scale FIXED in the declared frame —
  const M = rot ?? ROT_IDENTITY;                    // orientation never rescales the object
  const h = hullMesh(raw.map((p) => rotApply(M, [p[0] * s, p[1] * s, p[2] * s])));
  const { c } = volumeCentroid(h.verts, h.faces);
  const xf = (p) => {
    const q = rotApply(M, [p[0] * s, p[1] * s, p[2] * s]);
    return [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
  };
  const rawXf = raw.map(xf);
  const display = rawEdges.length
    ? { segs: rawEdges.map(([a, e2]) => [...rawXf[a], ...rawXf[e2]]), points: null, source }
    : { segs: null, points: rawXf, source };
  return {
    verts: h.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]),
    faces: h.faces,
    identity: 'convex-hull(canonical)',
    orientationAxis: axis,
    name: key,
    display,
  };
}

/**
 * The Sunship's extended (tail-deployed) state — a COMPOSITE (Toby ruling
 * 2026-08-22, after the plan-view screenshots): the authored aero-hull
 * candidate is a body of revolution, so with the tail on every view showed
 * the same round profile. The VISUAL extended geometry is therefore the
 * TRUE hull up to the authored attach point, plus a grafted tail whose
 * cross-section is the hull's own attach-ring section shrinking under the
 * authored taper law (t^P over the authored extra length) — radius-
 * continuous at the join in every clock direction, wide-oval in plan,
 * flat-bellied in elevation, exactly as the ship actually is.
 *
 * THE SCALAR STAYS THE SURROGATE'S: the estimator's tailed number was
 * measured on the axisymmetric candidate, so that geometry keeps supplying
 * softAft/compositeV1, labelled `scalarSource: authored-surrogate`. Visual
 * composite, authoritative scalar, both declared.
 */
/**
 * VISUAL TAIL SHAPE — the DESIGN-INTENT slender tail (owner ruling, Toby
 * 2026-08-22).
 *
 * WHAT: the tail-on visual is a small concave cone off the hull's aft
 *   collapsing to a long thin spike out to the authored deployed length —
 *   NOT the tadpole fairing surrogate.
 * WHY: the tadpole was the estimator's scoreable stand-in and was flagged
 *   a placeholder by the owner on 2026-08-19 (IDEAS-BACKLOG, swappable
 *   tails): huge enclosed volume, +59k m² skin, zero modelled mass. The
 *   published VISION claim was always the long tension-supported slender
 *   tail (DYNAMIC-SPEC §6 provenance; VISION-NOTES mechanisms). The
 *   visualizer shows the design being claimed; the numbers stay declared.
 * PROVENANCE: page Cd remains the authored EAS-IDEAL declared assumption
 *   (untouched); scalar + eligibility remain the scored surrogate's, via
 *   the payload's declared authority split (`scalarSource`).
 * LIMITATION: this geometry is NOT estimator-scored, and no synergy
 *   ("BLI eats the drag along the tail") is modelled anywhere — that
 *   story lives in VISION language and, visually, in V3's BLI capture.
 *   Passive flow legitimately sheds at the concave cone; the tail+BLI
 *   system, not the tail alone, is the claim.
 * REPLACEMENT TRIGGER: a scored slender-tail geometry, or the
 *   swappable-tails backlog item landing.
 */
/* TAIL_VISUAL + the shell loft moved to viz/layer1/tail-visual.mjs
   (2026-08-24) so the browser payload worker lofts the SAME tail — full
   provenance travelled with them. Re-exported here for compatibility. */
export { TAIL_VISUAL } from './layer1/tail-visual.mjs';

export function buildCompositeExtended(retracted) {
  const { attach, extraM } = BASELINE;                           // authored attach + deployed length
  const retX0 = Math.min(...retracted.verts.map((p) => p[0]));
  /* the loft itself moved VERBATIM to layer1/tail-visual.mjs (2026-08-24,
     so the browser worker pastes the same tail) — byte-identical payload
     verified at extraction (--hash-only d6e7ac1c6a1b1a9c unchanged). */
  const { verts, faces } = buildDesignTailShell(retracted, {
    xA: retX0 + attach * 300,
    xHullEnd: retX0 + 300,
    xTip: retX0 + 300 + extraM,
  });

  /* the authoritative estimator context — scalar AND eligibility — from
     the surrogate the estimator actually scored (ELIGIBLE per spec 80).
     The composite's own checks are recorded beside it for transparency. */
  const m = parseObjMesh(readFileSync(CANDIDATE_OBJ, 'utf8'));
  const capped = capOpenRings(m.verts, m.faces);
  const sctx = ribbonContext(m.verts, capped.faces, { label: 'sunship/aero-surrogate', geometrySource: 'authored-smart-tail(candidate)' });

  return {
    verts, faces,
    identity: 'composite: true hull + authored-taper tail (visual)',
    scalar: {
      compositeV1: sctx.scalar.compositeV1, softAft: sctx.scalar.softAft,
      softFore: sctx.scalar.softFore, cls: sctx.scalar.cls,
      source: 'authored-surrogate(estimator geometry)',
      eligibility: sctx.eligibility,
    },
  };
}

/**
 * Build one body's payload.
 * `tail`: 'authored' (Sunship preset) | 'generic' (E+A+S path) | 'none'
 */
export function buildBodyPayload(key, tail = 'none', rot = null) {
  const retracted = loadRetracted(key, rot);
  let extended = null, extendedReason = 'not requested';
  if (tail === 'authored') {
    extended = buildCompositeExtended(retracted);
    extendedReason = 'authored Sunship Smart Tail (composite: true hull + authored taper; scalar from the surrogate)';
  } else if (tail === 'generic') {
    const t = buildGenericTailBody(retracted.verts, retracted.faces);
    if (t.refused) {
      extendedReason = `generic tail rule refused (visual only — toggle and numbers untouched): ${t.reason}`;
    } else {
      extended = { verts: t.verts, faces: t.faces, identity: 'generic-smart-tail(rule)' };
      extendedReason = 'generic tail rule (E+A+S unlock path)';
    }
  } else if (tail === 'design') {
    /* the PASTE (owner 2026-08-24): the Sunship's design-intent tail at
       its authored proportions on ANY body — always accepted, absurdity
       intended. The generic RULE above stays as machinery + G4 gate. */
    const t = buildPastedDesignTail(retracted);
    extended = { verts: t.verts, faces: t.faces, identity: 'design-intent-tail(pasted)' };
    extendedReason = 'design-intent tail pasted (E+A+S unlock — the Sunship design on any body; absurdity is the point)';
  }
  const built = buildRenderPayload({
    name: key, retracted, extended, extendedReason,
    orientationAxis: retracted.orientationAxis,
    display: retracted.display,
  });
  return { ...finalizePayload(built.payload), raw: built.raw };
}

/* ------------------------------ CLI ---------------------------------- */
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (args[0] === '--hash-only') {
    const key = args[1] || 'sunship';
    const { payloadId } = buildBodyPayload(key, BODIES[key]?.authoredTail ? 'authored' : 'none');
    process.stdout.write(payloadId + '\n');
  } else {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    for (const key of Object.keys(BODIES)) {                   // all declared bodies (bench test set)
      const tail = BODIES[key].authoredTail ? 'authored' : 'none';
      const t0 = performance.now();
      const { payload, payloadId, bytes } = buildBodyPayload(key, tail);
      const ms = (performance.now() - t0).toFixed(0);
      const file = join(FIXTURE_DIR, `${key}.render.json`);
      writeFileSync(file, bytes);
      const kb = (bytes.length / 1024).toFixed(1);
      const flag = bytes.length > SIZE_FAIL_BYTES ? '  ** OVER FAIL BUDGET **'
        : bytes.length > SIZE_WARN_BYTES ? '  (over warn budget)' : '';
      console.log(`${key.padEnd(14)} ${payloadId}  ${kb.padStart(7)} KB  ${ms.padStart(5)} ms  ` +
        `elig ${payload.retracted.eligibility.outcome}${payload.extended ? ' / ' + payload.extended.eligibility.outcome : ''}${flag}`);
      console.log(`  sphere1 r=${payload.spheres.sphere1.radiusM} m` +
        (payload.spheres.sphere2 ? `  sphere2 r=${payload.spheres.sphere2.radiusM} m  (r1/r2 = ${(payload.spheres.sphere1.radiusM / payload.spheres.sphere2.radiusM).toFixed(4)})` : ''));
    }
    /* ORIENTATION VARIANTS (owner, 2026-08-22, second pass: "pressing
       axis on the airship cigar I CAN'T get it to face up>down"): the
       FULL 24-rotation snap group baked per body, deduped by payloadId
       (a sphere collapses to 1 file, the spheroid to a handful; only
       fully asymmetric bodies need all 24). The bench pitch/yaw buttons
       walk the group via orientations.json — the fixture-side stand-in
       for the page's regenerate-on-snap (round-2 F3; the product
       regenerates in-browser at V5). The Sunship is exempt: authored
       orientation, composite tail nose-to-tail. */
    const group = rotationGroup();
    const manifest = {};
    for (const key of Object.keys(BODIES)) {
      if (BODIES[key].authoredTail) continue;
      const byId = new Map();                        // payloadId → filename
      manifest[key] = {};
      let n = 0;
      for (const M of group) {
        const { payloadId, bytes } = buildBodyPayload(key, 'none', M);
        if (!byId.has(payloadId)) {
          const file = rotKey(M) === rotKey(ROT_IDENTITY)
            ? `${key}.render.json`                   // identity = the default file itself
            : `${key}.o${n++}.render.json`;
          if (file !== `${key}.render.json`) writeFileSync(join(FIXTURE_DIR, file), bytes);
          byId.set(payloadId, file);
        }
        manifest[key][rotKey(M)] = byId.get(payloadId);
      }
      console.log(`${key.padEnd(14)} orientation group: ${byId.size} unique of ${group.length}`);
    }
    writeFileSync(join(FIXTURE_DIR, 'orientations.json'), JSON.stringify(manifest, null, 1));
    /* E+A+S VISUAL TAIL (owner 2026-08-23, re-ruled 2026-08-24: the
       generic fairing "looks weird compared to the one we've settled
       on… just 'paste' this tail onto anything/everything, even if
       it's absurd"): the DESIGN-INTENT tail at the Sunship's authored
       proportions on every page preset, default orientation. Always
       accepted — the washing machine with a plasma tail is the point. */
    for (const key of ['cigar', 'bottle', 'car', 'washingmachine', 'aerosmena']) {
      const { payload, bytes } = buildBodyPayload(key, 'design');
      writeFileSync(join(FIXTURE_DIR, `${key}.eas.render.json`), bytes);
      console.log(`${key.padEnd(14)} eas tail: ${payload.extended ? 'pasted' : 'MISSING?'} — sphere2 r=${payload.spheres.sphere2?.radiusM ?? '—'}`);
    }
    console.log('written to viz/fixtures/ (test fixtures only — the product generates in-browser)');
  }
}
