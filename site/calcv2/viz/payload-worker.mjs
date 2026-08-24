/**
 * PAYLOAD WORKER — in-browser render-payload generation for UPLOADS
 * (V5 step 2, 2026-08-23). The browser-side counterpart of
 * run-payloads.mjs's loadRetracted: the page's shape worker has already
 * parsed the mesh and computed the canonical hull (the upload-hull rule,
 * 2026-08-16), so this worker receives that geometry and does what the
 * node runner does — relabel to the declared flight axis, scale the
 * DECLARED-frame axial extent to the inherited length, apply the
 * orientation rotation (regenerate-on-snap, round-2 F3 — pitch/yaw on
 * uploads is REAL re-measured geometry), centroid to origin, extract
 * display linework — then runs the sealed Layer-1 generator. Heavy
 * (ribbonContext measures the full support skin), hence a worker: the
 * page stays live, the host shows MEASURING.
 *
 * Baked JSON remains fixtures/presets-only; THIS is the product's
 * generation path for uploads, exactly as the sealed plan requires.
 *
 * NOTE: RELABEL and the rotation helpers mirror run-payloads.mjs
 * (node-side). Unifying them into a shared module is queued
 * housekeeping; until then the two copies carry this cross-reference.
 */
import { buildRenderPayload } from './layer1/render-payload.mjs';
import { finalizePayload } from './layer1/canonical-json.mjs';
import { buildPastedDesignTail } from './layer1/tail-visual.mjs';
import { volumeCentroid } from '../spike/sectional/ribbons.mjs';

const RELABEL = {
  '+X': (p) => p,
  '-X': (p) => [-p[0], p[1], -p[2]],
  '+Y': (p) => [p[1], p[2], p[0]],
  '-Y': (p) => [-p[1], p[2], -p[0]],
  '+Z': (p) => [p[2], p[1], -p[0]],
  '-Z': (p) => [-p[2], p[1], p[0]],
};
const rotApply = (M, p) => [
  M[0] * p[0] + M[1] * p[1] + M[2] * p[2],
  M[3] * p[0] + M[4] * p[1] + M[5] * p[2],
  M[6] * p[0] + M[7] * p[1] + M[8] * p[2],
];
const ROT_I = [1, 0, 0, 0, 1, 0, 0, 0, 1];

self.onmessage = (e) => {
  const { seq, name, hullPoints, hullFaces, meshSegments, meshPoints, centre, radius, axis, rot, lengthM, tail } = e.data;
  try {
    const relabel = RELABEL[axis];
    if (!relabel) throw new Error(`no relabel for declared axis '${axis}'`);
    const M = rot ?? ROT_I;

    // scale is FIXED in the declared frame (orientation never rescales)
    const hull0 = hullPoints.map(relabel);
    const xs = hull0.map((p) => p[0]);
    const axial = Math.max(...xs) - Math.min(...xs);
    if (!(axial > 0)) throw new Error('zero axial extent in the declared frame');
    const s = lengthM / axial;
    const rotScale = (p) => rotApply(M, [p[0] * s, p[1] * s, p[2] * s]);

    const hullXf = hull0.map(rotScale);
    const { c } = volumeCentroid(hullXf, hullFaces);
    const xf = (p) => {
      const q = rotScale(relabel(p));
      return [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    };
    const verts = hullXf.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);

    /* display linework: the page worker's viewer arrays are normalized to
       unit-measuring-sphere space — de-normalize (× radius + centre) back
       to the file frame, then through the same transform */
    const deNorm = (x, i) => x * radius + centre[i % 3];
    let display = null;
    if (meshSegments && meshSegments.length) {
      const segs = [];
      for (let i = 0; i < meshSegments.length; i += 6) {
        const a = xf([deNorm(meshSegments[i], 0), deNorm(meshSegments[i + 1], 1), deNorm(meshSegments[i + 2], 2)]);
        const b = xf([deNorm(meshSegments[i + 3], 0), deNorm(meshSegments[i + 4], 1), deNorm(meshSegments[i + 5], 2)]);
        segs.push([...a, ...b]);
      }
      display = { segs, points: null, source: `mesh-edges(upload:${name})` };
    } else if (meshPoints && meshPoints.length) {
      const points = [];
      for (let i = 0; i < meshPoints.length; i += 3) {
        points.push(xf([deNorm(meshPoints[i], 0), deNorm(meshPoints[i + 1], 1), deNorm(meshPoints[i + 2], 2)]));
      }
      display = { segs: null, points, source: `point-cloud(upload:${name})` };
    }

    /* E+A+S unlock path (owner re-ruling 2026-08-24): the DESIGN-INTENT
       tail pasted at the Sunship's authored proportions on any upload —
       always accepted, absurdity intended (toggle and numbers untouched
       either way; the generic RULE remains estimator-land machinery). */
    let extended = null, extendedReason = 'not requested';
    if (tail === 'generic') {
      const t = buildPastedDesignTail({ verts, faces: hullFaces });
      extended = { verts: t.verts, faces: t.faces, identity: 'design-intent-tail(pasted)' };
      extendedReason = 'design-intent tail pasted (E+A+S unlock — the Sunship design on any body)';
    }

    const built = buildRenderPayload({
      name: `upload:${name}`,
      retracted: { verts, faces: hullFaces, identity: 'convex-hull(canonical)' },
      extended,
      extendedReason,
      orientationAxis: axis,
      display,
    });
    const { payload } = finalizePayload(built.payload);
    self.postMessage({ seq, payload });
  } catch (err) {
    self.postMessage({ seq, error: err.message });
  }
};
