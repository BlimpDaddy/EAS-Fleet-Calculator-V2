# `ribbon-render/1` — payload schema

*Layer-1 contract of the DYNAMIC visualizer. Authority:
`DYNAMIC-VISUALIZER-BUILD-PLAN.md` (SEALED 2026-08-21) §2.1. This file is
the per-field precision/units enumeration that V0's byte-stability gate
requires — the golden hashes are only meaningful against exactly this.*

## Canonical serialization (what "byte-stable" means)

- Object keys serialize in **Unicode-lexicographic order**, always.
- Numbers are quantized at build time (table below) and rendered by JS
  shortest-round-trip `toString` (fully determined by ECMA-262).
- **Non-finite numbers and `undefined` throw**; `-0` normalizes to `0`.
- No timestamps anywhere in the payload — it is a pure function of
  geometry + config, which is what makes two clean processes byte-agree.
- `payloadId = fnv1a64(canonicalBytes(payload excluding payloadId))` —
  the exclusion rule is part of this schema (round-4 F2). FNV-1a is an
  identity, not a security boundary.

## Quantization classes

| Class | Decimals | Used for |
|---|---|---|
| METERS | 2 (0.01 m) | rails, silhouettes, contours, extents, spheres, bounds |
| AREA_M2 | 1 | frontal area |
| RADIANS_GRID | 6 | θ sample values, BLI sectors |
| RADIANS_TANGENT | 4 (≈0.006°) | per-station tangent field |
| FRACTION | 5 | uRange, captureBandFrac, E4 worstShift |
| SCORE | 6 | scalar context (softAft etc.) |

The decode-vs-source fixture (G2) asserts every quantized value sits
within 0.5 quantum of its unrounded source — byte-stability can never be
achieved by silently degrading geometry (round-2 F13).

## Top-level fields

| Field | Type / units | Meaning |
|---|---|---|
| `schema` | `"ribbon-render/1"` | version; consumers declare what they accept |
| `authority` | `"VISUAL_READ_ONLY"` | the data are real measurements; THIS consumer is read-only and feeds no number back (`feedsNumbers: false` alongside) |
| `name` | string | stable body name |
| `provenance` | object | generator + machinery names |
| `frame` | object | `flight:"+X"`, `thetaZero:"UP"`, `orientationAxis` (DYNAMIC's declared file-frame axis — regenerate the payload on every 90° snap, round-2 F3), origin = retracted volume centroid, `frontalAreaM2` (AREA_M2 — the §4.2 projection of the retracted true geometry; V5 asserts it equals the page's `frontalAreaM2` within quantum) |
| `grid` | object | `nStations` (128), `nTheta` (48), station convention (uniform inclusive per state), flat `indexing` string, explicit `thetaRad[48]` (RADIANS_GRID) in the canonical half-plane order, θ=0 UP |
| `retracted` | state block | always present |
| `extended` | state block \| `null` | authored (Sunship preset) or generic-tail-rule (E+A+S). `null` = **visual absence only** — Smart Tail availability and numbers are the page's and are never gated here (round-3 F1) |
| `extendedReason` | string | 'authored …' / 'generic tail rule …' / 'not requested' / refusal text |
| `spheres` | object | `sphere1 {centerM[3], radiusM}` = Welzl miniball of retracted; `sphere2` = miniball of retracted ∪ extended, or `null` when `extended` is null (round-4 F3) |
| `worldBounds` | object | Layer-2 particle lifecycle box ONLY: spawn plane at `xMinM` (nose − 0.25 L), `xMaxM` = tail tip + 0.5 L wake margin (covers the wake-metric window), lateral ± 1.05 × outer sphere radius. Falls back to retracted extent when extended is null. **Display scale never derives from this box** (round-2 F5) |
| `displayNormalization` | object | the renderer's screen-mapping rule: `sphere1ViewportFrac` 0.2832 (universal — 0.48 × r1/r2 of the canonical Sunship, measured 152.48 / 258.47 m), `sunshipSphere2ViewportFrac` 0.48, Q8 clip-truthfully rule stated |
| `linework` | object \| `null` | ADDED 2026-08-22 (owner ruling: "draw both the shape and its hull, hull in magenta same as page 1, shape in orange"). The RAW shape's display geometry, payload frame, METERS: `segsM` flat `[x0,y0,z0,x1,y1,z1]×n` (face-boundary + `l`-polyline edges, uniform-stride decimated to the blessed budget) OR `pointsM` flat `[x,y,z]×n` for lineless point clouds; `source` labels which. DISPLAY-ONLY — the hull remains the geometry identity for every measurement (canonical upload-hull rule 2026-08-16); nothing in layers 2–3 may read geometry from this field |
| `bli` | object | frozen body-frame semantics (round-3 F6): `uRange [0.33, 1.0]`, `thetaSectorsRad` 90°/270° ± 30°, `captureBandFrac 0.15` × local radius, `approachStations 8`, `captureCondition "approachingDetachment"`. Same constants for every body |
| `payloadId` | 16 hex chars | identity; any change invalidates Layer-2 `previousState` (round-3 F2) |

## State block (`retracted` / `extended` — each complete, round-2 F7)

| Field | Type / units | Meaning |
|---|---|---|
| `identity` | string | `convex-hull(canonical)` / `authored-smart-tail(candidate)` / `generic-smart-tail(rule)` |
| `eligibility` | object | spec-70 outcome + E2/E3/E4 summaries; INELIGIBLE ⇒ Layer 2 runs the degraded path |
| `extentM` | object | `x0M`, `x1M`, `lengthM` (METERS) — this state's axial extent; station grid spans it |
| `maxRadiusM` | METERS | normalization anchor (wake metric etc.) |
| `railsRM` | flat number[6144] | r(x,θ), METERS, `flat[θIndex * 128 + stationIndex]` — the meridian rails from the frozen support skin (spec 53) via `ribbonContext` (spec 70) |
| `tangentRad` | flat number[6144] | per-station tangent angle (RADIANS_TANGENT) by the frozen secant rule (spec 4.6); the generator cross-checks its per-zone integral against `ribbonMetrics` for every ribbon before returning |
| `tangentDomain` | object | `{i0, i1}` — stations outside carry 0 and make no derivative claim (spec 55.2) |
| `silhouettes` | object | true envelopes from production `measureSections({silhouettes:true})`, published under **axis-explicit names**: `yLoM/yHiM[128]` (vertical envelope — the ELEVATION/side view draws this) and `zLoM/zHiM[128]` (lateral envelope — the PLAN/top-down view draws this), METERS, on a declared bin grid (`xGrid`), uncovered bins clamped (`sanitizedBins` counted) |
| `frontalContourRM` | number[48] | nose-on outline: per-θ max rail radius (METERS) — the frontal view never re-derives geometry (round-2 F3) |
| `frontalContourStation` | int[48] | station index where each rail attains that maximum (added V2, additive) — the frontal occlusion rule: a particle is hidden iff it is downstream of this station at its θ AND inside the contour radius |
| `scalar` | object | `compositeV1`, `softAft`, `softFore` (SCORE), `cls` — production scorer, copied never modified. Geometry context only: wake *severity* presentation is driven by `selectedCd` in the controls, not by this (round-2 F2) |
| `scalarSource` / `eligibilitySource` | string | `measured-self`, or for composite states `authored-surrogate(estimator geometry)` — the AUTHORITY SPLIT (2026-08-22): when the visual mesh differs from the geometry the estimator scored (the Sunship's tail-on composite: true hull + authored-taper tail), estimator-context fields (scalar AND eligibility) come from the estimator's surrogate, while rails/silhouettes/contours come from the visual mesh |
| `visualGeometryChecks` | object \| null | when the sources are split: the visual mesh's own E2/E3/E4 summary, recorded for transparency (the composite's positional checks are clean; only the descriptor-convergence criterion E4 trips on the honest junction crease) |

## Reference values (canonical Sunship, 2026-08-21)

- `frontalAreaM2` **40522** — reproduces the canonical measured constant
  (`DYNAMIC-SPEC.md` §11/§12.2) exactly.
- `softAft` retracted **0.7657** → extended **0.1612** — the measured
  aft-penalty collapse the Smart Tail exists for.
- Extents 300 m / 516 m; sphere1 152.48 m; sphere2 258.47 m.
- Payload 169.4 KB (budget: warn 200 KB, fail 256 KB).
