# B1 — does surface roughness invalidate the sphere-HR anchor?

*Literature review, 2026-08-19, answering the r20 reviewer's point that
"Achenbach's rough-sphere work found transcritical Cd rising as high as
~0.4" against the smooth 0.19 our `ROUNDED_KNOTS` top anchor uses.*

## Verdict: the anchor stands, by one to two orders of magnitude

The concern is real physics and would matter enormously at model scale.
It does not reach us, because **relative roughness scales as 1/D and the
Sunship is 226 m across.**

| | k/D |
|---|---|
| fabric weave (~0.2 mm) | 8.8 × 10⁻⁷ |
| coated skin (~0.5 mm) | 2.2 × 10⁻⁶ |
| ship-hull grade, AHR 150 µm | 6.6 × 10⁻⁷ |
| seams / panel joins (~10 mm) | 4.4 × 10⁻⁵ |
| battens / structural ribs (~30 mm) | 1.3 × 10⁻⁴ |
| **Achenbach 1974, SMOOTHEST tested** | **1.5 × 10⁻³** |
| Achenbach 1974, roughest tested | 1.25 × 10⁻² |

Achenbach's five roughnesses run 1.5 × 10⁻³ to 1.25 × 10⁻², and the
transcritical Cd of 0.4 belongs to the **roughest** of them. The Sunship at
its most pessimistic plausible finish — 30 mm structural ribs standing
proud of the skin — is still **11× smoother than his smoothest roughened
sphere**, and on any ordinary surface treatment it is 1,000× smoother.
Extrapolating his trend downward, transcritical Cd tends to the smooth
value as k/D → 0, which is the 0.19 already in use.

## The one place roughness DOES bite, and it is not the anchor

Search results note that k/D ≈ 10⁻⁵ can significantly lower the CRITICAL
Reynolds number — and the Sunship sits in that band. But that governs
*where* the drag crisis happens, not the transcritical level, and at
Re ≈ 5 × 10⁸ we are far past any critical Re however early it is
triggered. Being pushed transcritical sooner changes nothing when you were
always going to be transcritical.

> ### ⚠️ CORRECTED 2026-08-19 (B1 implementation)
>
> **The table and percentages below were wrong in two compounding ways,
> and the corrected version follows.** Both errors were found by
> computing against the real engine while implementing B1, not by
> re-reading. Neither ever reached the reviewer — `R20-SEND/` contains
> no ITTC-78 content — so nothing false was circulated. Recorded here
> because the wrong figures were used to write the B1 handover, which
> proposed a default roughness ~10x too large.
>
> **Error 1 — wrong operating point.** The deployed Sunship's ideal
> posture is **120 km/h** on the **aero** length 516 m, so friction Re is
> **1.147 x 10⁹**, not 5 x 10⁸. (Confirmed: at 120 km/h the estimator
> reproduces the shipped 0.0099 / 0.0221 / 45% split exactly.)
>
> **Error 2 — a dropped multiplier, and this is the bigger one.** ΔCf is
> a coefficient on **wetted** area. Turning it into a Cd increment on the
> **frontal** basis requires x(wetted/frontal) = **6.582**. The
> percentages below skipped that and compared ΔCf against frictionCd
> instead, which is how "1 mm -> ~+1%" was produced. The true figure is
> ~7.6%.

The live question is instead **friction**, via the roughness Reynolds
number — small k/D can still be hydrodynamically rough if Re is high
enough, which is the classic ship-hull problem. Applying the ITTC-78
correlation allowance at the deployed Sunship's real operating point —
**L = 516 m, Re = 1.147 x 10⁹, wetted/frontal 6.582, total Cd 0.0221**:

| equivalent sand roughness kₛ | ΔCf | ΔCd | % of total Cd |
|---|---|---|---|
| 0.164 mm | 0 | 0 | **0** — hydraulically smooth, the clamp point |
| 0.3 mm | 7.19 x 10⁻⁵ | 4.73 x 10⁻⁴ | 2.1% |
| **0.43 mm — ADOPTED** | **1.187 x 10⁻⁴** | **7.81 x 10⁻⁴** | **3.54%** |
| 1 mm | 2.53 x 10⁻⁴ | 1.67 x 10⁻³ | 7.6% |
| 3 mm | 4.96 x 10⁻⁴ | 3.26 x 10⁻³ | 14.8% |
| 10 mm | 8.87 x 10⁻⁴ | 5.84 x 10⁻³ | 26.5% |

Our friction Cd is 0.0099 of a 0.0221 total (45%). So a skin at
**ship-hull grade or better costs literally nothing** — it is
hydraulically smooth at this scale and the allowance clamps to zero —
while a **badly** finished one, 10 mm of proud seam everywhere, would
cost more than four times what the Job A geometry correction found.

The gap between those is where the design lives, and it is much narrower
than the original version of this note suggested: at 516 m and Re 10⁹ the
crossover from "free" to "expensive" happens between roughly 0.15 mm and
1 mm, not between 1 mm and 10 mm.

## What this changes

- **`ROUNDED_KNOTS` sphere-HR anchor at 0.19: KEEP.** No correction
  warranted; the send-back concern does not reach airship scale.
- **NEW, and not previously tracked: skin finish is a real design
  variable on the friction side**, worth 0–26% of total Cd across the
  plausible finish range (NOT 0–8% — see the correction above). It was
  modelled as perfectly smooth by omission. That is an optimistic
  assumption and a bigger one than this note first said, and it should be
  declared rather than left implicit.
- **CLOSED 2026-08-19 (B1):** it is now declared. `dynamicsCore.js`
  carries an ITTC-78 correlation allowance at a fixed **kₛ = 0.43 mm**
  applied to every shape, costing the deployed Sunship **3.54%** of total
  Cd — inside Toby's approved 3–4% budget. Cd 0.022056 -> 0.022837.
  Seams, panel joins and battens are explicitly NOT covered: that finish
  costs ~15% and was not what was approved.
- The r20 answer to "what breaks first at that extrapolation" is
  therefore: **not roughness.** Which sharpens the remaining question to
  the absence of measured rounded bodies in the high-Re mid-map.

## Limits of this note

Achenbach's tabulated k/D values were taken from secondary sources citing
his 1972/1974 papers, not from the papers themselves — the figures are
consistent across sources and the conclusion has three orders of magnitude
of headroom, but the primary tables have not been read. The ΔCf figures
are the ITTC-78 ship correlation allowance applied to an airship, which is
a defensible transfer (both are large, smooth, fully-submerged bodies at
high Re) but is a transfer nonetheless.

**Sources:** Achenbach, *Experiments on the flow past spheres at very high
Reynolds numbers*, JFM 54(3), 1972 · Achenbach, *The effects of surface
roughness and tunnel blockage on the flow past spheres*, JFM 65(1), 1974.
