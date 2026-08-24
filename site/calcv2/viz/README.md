# viz/ — the DYNAMIC visualizer (build authority: DYNAMIC-VISUALIZER-BUILD-PLAN.md, SEALED 2026-08-21)

Three layers, one crossing point:

```
layer1/   RENDER PAYLOAD   ribbon-render/1 generator (estimator-land; the ONLY crossing)
layer2/   FLOW ENGINE      headless deterministic particle rules  (V1+, not yet built)
layer3/   RENDERER         Canvas 2D, three views, all styling    (V1+, not yet built)
```

Layers 2–3 import **nothing** from `src/` or `spike/` — the payload is the
entire interface. The reverse ban holds too: no numerical module imports
anything from layers 2–3 (the M7 one-way gate, fixture at V5).

## Status

- **V0 — payload: DONE 2026-08-21.** All fixtures green
  (`node viz/test/run-fixtures.mjs` from `CalcV2/`): byte-stable across two
  clean processes, decode-vs-source quantization, second body through the
  same path, E+A+S round trip (sphere accepts the generic tail, washing
  machine refuses with the toggle untouched — exemplar amended 2026-08-22
  when the cigar's mis-declared axis was caught; the true cigar refuses), size budget, non-finite
  refusal, canonical round-trip, payloadId exclusion rule, grid contract.
- **V1 — skeleton: BUILT 2026-08-21.** Engine (`layer2/engine.mjs`, pure
  state-transition, mulberry32 in-state), frozen wake metric
  (`layer2/metrics.mjs`), adapter with the M3 parked rule
  (`bench/adapter.mjs`), and the elevation bench page (`bench/`,
  `node viz/bench/serve-bench.mjs` → localhost:5199/viz/bench/). All 15
  headless gates green (`node viz/test/run-v1-fixtures.mjs`): crossing
  108 ticks vs L/v 108.0 exact; bit-identical reruns; Cd moves wake
  severity only (detachment stations byte-identical); S inert as declared;
  **frozen metric separates sphere 1.068 vs Sunship+tail 0.041** (gate:
  ≥ 0.1); parked = zero engine calls with control persistence; ineligible
  bodies degrade soft; engine p95 0.026 ms/tick at the mobile count.
  Browser pipeline verified end-to-end via the `window.__bench` debug
  handle (hidden browser panes suspend rAF — known trap, handle exists
  for exactly that). **Pending: the live look + the browser p95 ≤ 17 ms
  frame benchmark need a visible pane / the reference device** (benchmark
  button is on the page).
- **V2 — three views: BUILT 2026-08-21.** Particles went 3D onto ribbon
  lanes (each rides its own r(x,θ) rail — the sealed plan's V2/V3
  interleave; refined detachment + BLI stay V3). New pure projection core
  `layer3/mapping.mjs` (`view` + `flowAxis` parameters, sphere-1 centred
  at the universal scale in every view, frontal occlusion rule as a pure
  function). Payload gained `frontalContourStation[48]` (additive). All
  V0 + V1 + V2 gates green (`run-v2-fixtures.mjs`): anchors exact for all
  six view × flowAxis combos; hand-particle projections exact; frontal
  occlusion zero-violations (and the tailed wake never even leaves the
  silhouette — the tidy-wake story); degraded = no rail-follow; hull
  outlines finite everywhere. Bench has view/flow selectors; near-side
  ribbons draw in front of the hull, far side dimmed behind (Toby's V1
  note delivered). Browser-verified via `__bench` (pane still hidden).
- **V3 — flow behaviours: BUILT 2026-08-22.** Frozen-tangent detachment
  (turning rule on the payload tangent field, earned domain respected),
  cube preset (K1 perfect: every detachment in the rear-face band), BLI
  capture (side-sector riders approaching detachment are captured instead
  of shed, accelerated ×(1+1.2·S), traverse the spike), counter-based
  per-particle RNG (isolation gates exact). All V0–V3 suites green.
  **OPEN OWNER RULING: the wake-breadth trio gate** — the slender tail
  sheds at cone-base radius so the frozen breadth metric reads it wide;
  options (re-base gate / widen capture beyond side sectors / soften the
  hull shoulder) are in the sealed plan's 2026-08-22 amendment. Capture
  is currently RARE (~1–2 of 512 at any instant) — widening sectors is
  also the lever that makes the BLI visual legible.
- Next: Toby reassesses; then V4 aesthetics. The calculator is untouched
  until V5.

## Files

| File | What |
|---|---|
| `SCHEMA.md` | the `ribbon-render/1` contract — fields, units, quantization; read before consuming a payload |
| `layer1/constants.mjs` | frozen/blessed constants (grid, BLI zone, display normalization, budgets, quanta) |
| `layer1/canonical-json.mjs` | canonical serialization + payloadId (the definition of byte-stable) |
| `layer1/render-payload.mjs` | the generator — packages the frozen machinery (`ribbonContext`, `measureSections`, Welzl, §4.2 projection); measures nothing new; port-guards its one derived field |
| `layer1/tail-rule.mjs` | the generic E+A+S tail (ported from `lab/tail-any-shape.mjs` per the sealed plan); refusal = visual absence only |
| `run-payloads.mjs` | node shell: loading, declared frames/scales, canonical upload-hull rule, writes `fixtures/` (test fixtures only — the product generates in-browser) |
| `test/run-fixtures.mjs` | the V0 gates, pre-registered in the sealed plan §4 |
| `fixtures/*.render.json` | golden payloads (sunship with authored tail, sphere) |

## House rules carried from the programme

- Pre-registered gates; self-tests before results; cross-check new numbers
  against recorded ones (`frontalAreaM2` 40522 reproduced exactly).
- Frames and scales DECLARED, never detected.
- Nothing here can move a number: `feedsNumbers: false` is the schema's
  first fact, and the engine's output type is particle states, full stop.
