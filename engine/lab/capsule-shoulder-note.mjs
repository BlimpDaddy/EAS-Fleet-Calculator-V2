/**
 * CAPSULE SHOULDER-CALL NOTE (r20 kit item 2) — dev-only lab
 * instrument, never bakes.
 *
 * WHAT:  a 5:1 CAPSULE (hemispherical nose + cylinder + hemispherical
 *        butt) run through the frozen estimator at several mesh
 *        densities. The hemisphere-butt aft closure scores
 *        shoulder ≈ 0.228 (dense-mesh converged) — ABOVE the r19
 *        threshold 0.13 — so the capsule classifies PINNED and is
 *        DENIED the rounded-class drag-crisis discount.
 * WHY:   during the cigar aeroHullMesh authoring (2026-08-17) this
 *        read looked severe for a body with no sharp edge anywhere.
 *        Builder's position: DEFENSIBLE — a hemispherical stern closes
 *        a quarter-circle in half a diameter; its shoulder region
 *        genuinely separates at high Re (unlike a long tapered stern),
 *        and the r19 guarantee band (~26°+ breaks at ≥~70% radius)
 *        covers exactly this geometry: steep closure onset at large
 *        radius. Denying the discount is conservative-correct, not a
 *        misclassification.
 * PROVENANCE: session record 2026-08-17 (pinned in NEXT-THREAD.md);
 *        reproduction converges 0.2274/0.2282 at rings 128/192.
 * LIMITATION: 'pinned' prices the capsule on the vNEXT-verbatim line —
 *        if real capsule drag data ever lands mid-map it would be a
 *        kill-test body (proxy ~0.82, sadly sphere-adjacent, so the
 *        mid-map gap question is untouched by this note).
 * REPLACE WHEN: the reviewer rules the call at r20 (accept as
 *        conservative-correct, or prescribe a hemisphere-specific
 *        treatment — builder recommends accept).
 *
 * Run: node lab/capsule-shoulder-note.mjs
 */
import { makeLathe } from '../spike/flow-chamber/shapes.mjs';
import { measureSectionalProxy } from '../src/cdEstimator.js';

// 5:1 capsule — cap depth = R = 0.5 D = 0.1 L.
const prof = (t) => t < 0.1 ? 0.5 * Math.sqrt(1 - ((0.1 - t) / 0.1) ** 2)
  : t > 0.9 ? 0.5 * Math.sqrt(1 - ((t - 0.9) / 0.1) ** 2)
  : 0.5;

console.log('5:1 capsule (hemisphere nose + cylinder + hemisphere butt), axis +X:');
for (const rings of [48, 64, 96, 128, 192]) {
  const m = makeLathe(prof, 5, rings, 48);
  const p = measureSectionalProxy(m.verts, m.faces, { axis: '+X' });
  console.log(`  rings ${String(rings).padStart(3)}  shoulder ${p.triggers.shoulder.toFixed(4)}  class ${p.cls}  proxy ${p.proxy.toFixed(3)}  (threshold 0.13)`);
}
console.log('\nExpected: shoulder converges ~0.228 dense-mesh; PINNED at every density.');
