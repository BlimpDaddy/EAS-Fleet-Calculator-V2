# Flow-chamber spike — VERDICT: GATE FAIL, shelved (2026-08-15)

One-session spike per the agreed gate (NEXT-THREAD, r8-amended). The
question: can a deliberately coarse 3D D3Q19 momentum chamber rank the
§5.2 anchor bodies well enough to serve as M6's pressure-term estimator?

**Answer: no — and the failure is diagnostic, not a bug.**

## Gate result: 11 passed, 7 failed (`node spike/flow-chamber/gate.mjs`)

FAILED: anchor ordering (teardrop 2.324 ABOVE sphere 1.968, at base AND
2× resolution; cube 2.375 above plate 2.019) · smooth 3:1 ellipsoid
scored WORST of all (2.631) · teardrop 2×-resolution ratio 0.58 (outside
×/÷1.6) · ±axis fore/aft distinction only 1.7% (needs >5%) · interactive
cost 21–36 s/run base, ~6.5 min at 2× (budget: <5 s).

PASSED: bit-exact determinism · convergence within tick cap · grid-
alignment stability (6.0–6.6% spread — the stair-stepping fear was NOT
the killer) · corpus values plausible after calibration (Sunship 0.70,
washing machine 1.31, tubby 0.74) — but corpus proxies cluster at
2.13–2.39: the calibration map was flattering a signal that isn't there.

## The one-knob sweep to the stability edge (tau-sweep.mjs)

| τ | Re_eff | teardrop | sphere | verdict |
|---|---|---|---|---|
| 0.56 | ~55 | 2.324 | 1.968 | inverted |
| 0.53 | ~110 | 1.540 | 1.410 | inverted |
| 0.52 | ~165 | 1.242 | 1.197 | inverted |
| 0.51 | ~330 | 0.913 | 0.959 | ordered — separation 5%, gate needs 40%+ |

## Why it failed (the regime problem)

At the effective Reynolds numbers a stable coarse lattice can reach
(~50–330), drag is viscosity-dominated: it tracks WETTED EXTENT, not
bluffness. Long smooth bodies pay for their length (hence the ellipsoid
inversion); nothing separates; the pressure-drag physics the estimator
needs ranked does not exist in the reachable regime. Resolution was NOT
the main killer (alignment stability passed; 2× didn't fix ordering).

## Disposition

- Kill rule fired as designed: the chamber is DEAD as M6's estimator.
- No authority amendment was ever made; none is needed (nothing ships).
- Shelved, not deleted: the machinery (exact-x parity voxeliser,
  stable LBM loop, momentum-exchange accounting) is sound and remains
  a candidate for M7 VISUAL wake generation, where it only has to look
  right and numbers never depend on it.
- M6's pressure term proceeds on the descriptor branch — with the
  sectional/multi-slice silhouette formulation (blockage profile A(x)
  from exact ray crossings; closure-rate analysis) as the leading
  implementation candidate, to be assessed fresh. Note: the voxeliser's
  per-column x-crossings already provide exact continuous A(x) — the
  sectional approach inherits working machinery from this spike.
