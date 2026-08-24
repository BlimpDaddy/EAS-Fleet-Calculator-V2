# Sectional estimator spike — VERDICT: PASS (2026-08-15)

*(Terminology reconciled per r10 #5: this file's early sections used
"zero tuning" and "exact geometry" — both retired in r9; "raw" means
BEFORE Cd CALIBRATION throughout. Battery counts grew 19 → 31 → 36 →
38 as review fixtures accumulated; the LATEST run is authoritative.)*

Same-day successor to the failed flow-chamber spike (../flow-chamber/
RESULTS.md). The converged question: does the anchor ordering fall out of
measured sectional geometry alone — no solver, no fitted weights — before any
calibration? Run: `node spike/sectional/run.mjs`.

**Answer: yes. 9/9 gate-lite criteria before calibration. Worst measurement 129 ms.**

## Method (one file: sections.mjs)

Exact ray–mesh crossings on a 160×160 cross-grid → per-column solid
intervals, CONTINUOUS in x (no voxel stair-step) → the longitudinal area
distribution A(x) at 128 stations (event sweep) + the frontal silhouette
(area, perimeter → compactness). Scores, in equivalent-radius space
(scale-free):
- **aftBaseFrac** — THE term: walk from the tail tip at the critical
  closure slope S_CRIT = tan(15°) (the ONE knob); any radius unreachable
  is "cliff" — effective base area fraction. Unifies aft-recovery
  severity and base bluntness (a blunt base IS infinite closure slope).
- noseFrac (reported, not in composite v0) · profile roughness Σ|Δ²r|
  (reported) · cornerPenalty = 1 − compactness.
- Composite v0, deliberately dumb: `aftBaseFrac × (1 + cornerPenalty)`.

## Raw results

| shape | composite | note |
|---|---|---|
| teardrop f3 | 0.000 | fully recoverable closure |
| ellipsoid 3:1 | 0.316 | smooth+elongated beats sphere ✓ |
| teardrop REVERSED | 0.666 | ±axis sensitivity native ✓ |
| Sunship (bare, Z) | 0.763 | bluff-ish, a touch better than sphere |
| tubby | 0.783 | just behind Sunship |
| sphere | 0.809 | |
| gömböc | 0.836 | |
| washing machine | 1.154 | hammered ✓ |
| cube | 1.210 | |
| plate (normal) | 1.214 | worst ✓ |

Every criterion the 3D chamber failed, this passes untuned: ordering with
real separation, smooth-ellipsoid direction correct, fore/aft asymmetry
strong (0.000 vs 0.666), corpus sane, ~100–300× faster than the chamber.

## Why it works where the chamber didn't

The chamber tried to make coarse fake physics discover geometry; this
measures the geometry directly and applies one physical assumption (air
follows closures gentler than ~15°). The information was never in the
flow — it was in A(x) all along.

## Status + next (M6 proper, not spike work)

- Candidate CONFIRMED as M6's pressure-term implementation, pending
  Toby's ratification and the normal review loop.
- M6 stage 1 becomes: productionize sections.mjs into the engine
  (measure + score + calibration to the four §5.2 anchors → Cd_pressure),
  behind the frozen estimator API `{cdEstimate, frictionCd, pressureCd,
  band, status, provenance}`; friction stays ITTC; ±50% band unchanged.
- Discipline carried over: S_CRIT + monotone anchor calibration are the
  only tunables; anchors + monotonicity + alignment/resolution
  invariances become engine fixtures (r8 #2 satisfied by measurement,
  not ontology).
- The particles (M7) can later FOLLOW the same sectional envelope —
  visual field derived from A(x) and the closure scores; rendered
  pixels never feed back.

## TEST BATTERY — 19/19 (2026-08-15, same session, Toby's go)

Battery: `node spike/sectional/battery.mjs`. Answers the two owner
questions the 9/9 raw pass left open, plus invariants + convergence.

**[A] Calibration (pressure basis, per the arbitrage):** anchor pressure
= published total − ITTC friction for that same shape; monotone map on
proxy→pressure; total = calibrated pressure + friction. **Sphere
round-trips 0.470 exactly; teardrop 0.045 exactly; cube 1.050.** Plate
1.043 vs 1.17 (−11%): cube/plate are near-degenerate in pure geometry
(both 100% cliff) — accepted as noise at the ±50% screening grade.
Held-out (never calibrated): ellipsoid 3:1 → 0.220, reversed teardrop →
0.408, both in broad bands, ordering ellipsoid < reversed < sphere ✓.

**[B] The teardrop-zero defect (Toby's catch) — FIXED, with one honest
detour:** v1 quadratic@15° FAILED its own battery (teardrop closure
slopes sit at that cap; discrimination collapsed — recorded, not
hidden). Final form: quartic penalty, θcrit = 30° (min(1,(slope/tan
θ)⁴) per shed area element + terminal base at full price). Family now
separates and orders: f4 0.013 < f3 0.042 < f2 0.213.

**Corner term REMOVED from the composite (second battery finding):**
raster Manhattan perimeter caps a circle's compactness at π²/16 ≈ 0.617
vs a square's exact 0.785 — the penalty was INVERTED (round punished
harder than square) and v0 passed with it by luck. softAft alone
separates everything tested; compactness stays reported-with-known-bias;
reinstate only on a demonstrated blind spot, with a Crofton estimator.

**[C] Invariants, all green:** scale ×3 identical (1e-15) · translation
identical · mesh density 14×9 vs 56×36 sphere: 0.2% · sharp-cut: chopped
teardrop 0.212 vs full 0.042 (5×) · sphere fwd = rev exactly.

**[D] Convergence (Toby's infinite-slices intuition, measured):**
teardrop 32/64/128 stations → 0.042/0.042/0.042; sphere → 0.827/0.817/
0.816; cross-grid 128 vs 192 → 1.2%. ~32 slices already ≈ infinity.

**Corpus under final form:** Sunship 0.770 < tubby 0.778 < gömböc 0.797
< sphere 0.816 < washing machine 1.000. Note: calibrated bare-Sunship
total lands ≈ 0.44 — the estimator reads the bare gömböc-hull (fineness
1.32, blunt aft) as near-sphere-bluff, HARSHER than the authored 0.26
body-only lore. Not a bug by construction — an honest disagreement to
resolve at M6 calibration review (the authored ladder remains authored;
the estimate remains an estimate; spec §5.4 already allows them to
disagree).

**Final accounting:** tunables = θcrit (30°, quartic form chosen by an
8-point declared sweep, then frozen) + the monotone anchor map. Terms =
ONE (soft aft closure). Everything else reported, nothing else consumed.

## r9 VALIDATION REVIEW — SEND-BACK, fixed same-day (2026-08-15)

External review attacked the code with adversarial geometry and found two
hard defects the 19/19 battery missed. Both fixed; battery now 31/31.

**#1 CONFIRMED, fixed — calibration Infinity path.** Cube and plate were
duplicate x-knots (both proxy 1.000) → division by ~zero on extrapolation;
a neck/re-expansion body drove the unenveloped aft walk past 1 and
produced Infinity. Fixes: (a) the CONSUMED aft score now walks the
MONOTONE OUTER ENVELOPE (a later re-expansion means the earlier neck was
never successful closure) — bounded ≤ 1 by construction; raw unbounded
walk kept as diagnostic only (neck adversary: raw 1.836, consumed 0.975);
(b) near-coincident calibration knots AGGREGATED (cube+plate pooled →
one bluff-cliff knot, as isotonic fitting does); (c) map CLAMPS flat
above the top knot; finiteness fixtured across proxy ∈ [0, 1.6].

**#2 CONFIRMED, fixed — the flat-front blind spot.** Reviewer's adversary
(flat circular face + gentle boat-tail) scored 18× better than the
teardrop under the aft-only model. Fix: FORE term, earned per the kill
rule. Formulation detour on record: soft quartic@60° FAILED the battery
(taxed the teardrop's harmless √x nose 0.27; broke sharp-cut and
convergence); final form = mirrored HARD walk @75° (fore separation is
face-like-or-nothing; favourable gradients round steep noses). Composite
= max(aft, fore) — worst offence governs; k=1 provisional pending the
TN-614 corpus. Adversary now: fore 0.778 → predicted total 0.459
(bluff-ish ✓); teardrop family, anchors, sphere untouched.

**Other dispositions:** #3 language corrected — the accurate claim is
"one-parameter-per-term geometric proxy; functional forms selected in
declared synthetic sweeps then frozen; Cd calibration separate; anchors
round-trip BY CONSTRUCTION (consistency, not accuracy)"; "zero tuning"
retired for the final candidate · #4 equal-A(x) round-vs-square sectional
blindness DOCUMENTED as a battery diagnostic (identical by design
limitation; compactness re-entry requires independent evidence + Crofton
perimeter) · #6 "exact A(x)" retired → "sectional area profile from
exact mesh crossings, ray-parity sampled on the cross-grid" · #7 parity
quality now COUNTED ({oddColumns, oddFraction}; holed-mesh fixture:
0.491 vs 0.000 clean; production maps large fractions to
estimate-unavailable) · #8 Sunship ruling recommendation ADOPTED pending
Toby: keep BOTH — authored 0.26 stays the active tail-OFF value
(REFERENCE ASSUMPTION), estimator marker ~0.44 ± band sits beside it
(0.26 lies INSIDE the ±50% band; note 0.043×10 ≈ 0.43 vs the published
~10× tail claim) · #9 knots deduped; piecewise-linear kept, no cubic ·
#10 ±50% = engineering honesty grade, not statistical confidence ·
#11 QUEUED for M6: NACA TN-614 six-body family as the first genuinely
independent held-out validation corpus, then TR-397 (TC-6 + Los Angeles,
basis verification first), then TR-253 quadrics · #12 spec residue
queued: §5.3 "descriptors shown" wording vs the no-copy product ruling.

**Battery: 31/31.** Score accounting after r9: TWO consumed terms (aft
soft quartic@30° on the monotone envelope; fore hard walk@75°), max
composition (k=1 provisional), deduped monotone map, clamped, finite
everywhere, junk counted.

## r10 REVIEW — SEND-BACK (very narrow), fixed same-day (2026-08-16)

The estimator itself SURVIVED the r10 adversarial pass: fore@75°+max()
CONFIRMED against its nose sweep ("does not broadly tax normal
ogive/conical/rounded noses; behaves like a guard against an
effectively wall-like front"), monotone envelope CONFIRMED, calibration
pooling CONFIRMED, equal-A(x) limitation CONFIRMED as documented. Its
verdict: "stop adversarially redesigning it before M6 productionization
— another afternoon of synthetic bodies is lower-value than putting the
frozen function into the engine and testing against real published
geometries."

Fixed same-day (battery 38/38):
- **#1 (the one hard bug): oddFraction denominator** — a 3-crossing ray
  (closed body + open sheet) is odd AND carries a valid interval; the
  old `intervals.size + oddColumns` counted it twice → reported 0.50
  where truth ≈ 1.0. Now `oddColumns / hitColumns`. Permanent fixture:
  cube + open sheet → 1.000.
- **#4: failure semantics** — calibrate(NaN) now returns NaN
  (estimate-unavailable in the production API), never the top knot: NaN
  is not "very bluff". Fixtured. EPS tightened 0.05 → 1e-3 (numerical
  coincidence only; future distinct anchors must never silently pool).
- **#5: record/header reconciliation** — this file's terminology
  corrected above; sections.mjs header now states the real parameter
  set (aft quartic@30° on the envelope + fore hard walk@75°, max
  composition k=1 provisional, deduped monotone map; the exported
  sCrit affects the 15° DIAGNOSTIC walk only).

Owner-ruling votes now unanimous (Toby leaning + Claude + reviewer):
(1) ratify sectional architecture · (2) RETIRE the authored 0.26
(reviewer REVERSED its keep-both on the clarified provenance: "bare
geometry is always owned by the estimator — sphere, upload, washing
machine, Sunship, same rule"; the ~10× reveal aligns with the design
narrative WITHOUT having been tuned to) · (3) ±30% screening range ·
(4) TN-614 incremental. **Consequent dated amendment for M6 (r10):
Tail OFF = snap Cd to the bare estimate, slider STAYS EDITABLE
(estimator proposes, slider disposes — the forced-and-disabled
behaviour belonged to the authored-0.26 era); Tail ON restores the
prior tail-on selection.**

Pinned session insight (Toby): the aft closure-severity map is an
inherent picture of where the wake's avoidable energy concentrates —
where the tail conditions flow and where BLI ingestion belongs. S stays
a flat credit in the model (sealed); the map is a visual/narrative
asset for M7.

## TN-614 HELD-OUT VALIDATION — first real experimental exam (2026-08-16)

Report acquired (NTRS 19930081378, public domain), ordinates + measured
CD_A transcribed from 300-dpi renders of the 1937 scan (skew-anchored;
method + the one ambiguous glyph documented in tn614.mjs). Six bodies
rebuilt as meshes from Table II via monotone-cubic lathe; tested 121/211
assembled from donor nose/tail sections per the report's footnote a.
Basis: CD_A (frontal — the report's own Table III), effective Re 66e6.

**Exam 1 — frozen estimator, frozen anchors, zero retuning:**
ORDERING: near-perfect — predicted 111 < 211 < 121 < 221 < 222 < 332 vs
measured 111 < 121 < 211 < 221 < 222 < 332; only swap is the 2.4%-apart
121/211 pair (statistical tie). THE GEOMETRIC SIGNAL IS REAL.
ABSOLUTES: sharp tails within band (111 +10.7%, 211 +11.1%); full tails
blow up (222 +132%, 332 +187%). Median 54%. DIAGNOSIS (r11 wording): Table III values are corrected-to-effective-Re
TOTALS (test Re 25M × 0.875); subtracting the calculator's ITTC
friction estimate implies a nearly FLAT RESIDUAL pressure term
(0.008→0.012) across the family while proxies span 10×; the synthetic teardrop anchor's pressure
split (0.030, regime-fuzzy textbook total) poisons the streamlined
segment of the map. θ-sweep (30–50°, diagnostic only) helps extremes,
cannot fix the mid-family: the defect is the CALIBRATION's low end, not
primarily the angle.

**Exam 2 — PROPOSED CALIBRATION vNEXT (dated decision required):**
promote the family extremes to real-data calibration knots — 111
(proxy 0.0174 → pressure 0.0081) and 332 (0.1808 → 0.0123), pressure =
measured − ITTC at 66e6 — RETIRE the synthetic teardrop knot for cause;
sphere/cube textbook anchors unchanged. WITHIN-FAMILY INTERPOLATION RESULTS (r11 label correction: the four
non-knot family members — never used to fit the map, but 121T/211T
reuse the knots' physical nose/tail sections (proxies match 111/221
to 4 decimals) and all six had informed vNEXT's design; this is
interpolation/regression evidence, NOT an independent accuracy test):
  121T +2.9% · 211T +0.9% · 221 +0.4% · 222 0.0%
Sphere still round-trips 0.470; cube 1.114; the Sunship bare-hull
estimate is essentially unchanged (~0.44 — the bluff segment was not
touched). Friction-only for comparison: −19..−24% on all six — the
real-anchored pressure term supplies almost exactly the missing part.

**Honest limits (r11-hardened):** the non-knot bodies share physical
nose/tail sections with the knots AND participated in the
model-selection knowledge that produced vNEXT; the BLIND ORDERING
result (exam 1, pre-vNEXT) is the genuinely external evidence — lead
with it. TR-397 (six real airships, incl. TC-6 and USS Los
Angeles, deceleration tests) is the genuinely independent next exam —
basis verification first. The ±20–25% band discussion now has actual
evidence under it for the smooth-body class.

**Awaiting ruling (Toby + review round):** adopt calibration vNEXT
(dated; TN-614 111+332 flip to in-calibration: true; teardrop knot
retired for cause; θ_aft stays 30°) — then TR-397 as the new exam.

## TR-397 ACQUIRED + BASIS VERIFIED (2026-08-16) — the independent exam, staged

Report downloaded (NTRS 19930091470, Thompson & Kirschbaum 1931): six
REAL airships by deceleration test — Los Angeles (f.r. 7.23, Re 350e6,
Cd .023) · TC-6 & TC-10 (4.4, 71e6, .035/.040) · TE-2 (4.0, 36e6,
.045) · Puritan (3.5, 34e6, .044/.049) · ZMC-2 (2.83, 50e6, .043).

**BASIS VERIFICATION COMPLETE (the gate the authority demanded before
TC-6/Los Angeles could ever be imported): C_D is defined "based on
v^(2/3)" — VOLUMETRIC, not frontal.** Conversion per ship:
CD_A = CD_v × v^(2/3) / A_frontal, from each ship's published volume
and max diameter (in the report's per-ship sections). Additional
declared complications for this corpus: measured values INCLUDE fins
and cars (only propellers + air-speed head were subtracted), so the
bare-hull estimator needs a declared appendage allowance; the report
itself flags unexplained 10% day-to-day scatter (Puritan) — this exam
is inherently looser than TN-614's controlled family.

**What the full exam still needs (next session):** per-ship volume +
diameter transcription; hull PROFILES (fig. 24 silhouettes are
traceable; Los Angeles/ZMC-2 offsets also exist in other NACA
literature); the appendage-allowance ruling. Then: blind run, frozen
estimator, calibration vNEXT untouched.

## r11 REVIEW — PASS (architecture, vNEXT, blind-ordering claim); label
## send-back applied same-day (2026-08-16)

Dispositions: #1 "held-out" relabelled WITHIN-FAMILY INTERPOLATION
throughout (reviewer measured 211T proxy ≡ 111 and 121T ≡ 221 to 4
decimals — the composites re-test the knots' own sections) · #2
"measured pressure/fully attached" corrected to "corrected-to-
effective-Re totals; ITTC decomposition implies a nearly flat residual
pressure term" · #4 teardrop-prediction claim softened: ~0.024 is a
PLAUSIBLE high-Re prediction, not independently validated; the old
0.045 anchor was regime-fuzzy and empirically incompatible with TN-614
at the low end (no stronger claim) · #5 fore/k provenance corrected:
ALL six TN-614 noses return softFore = 0 exactly — TN-614 is
NON-INFORMATIVE for the fore guard; k=1 rests on synthetic adversarial
and invariance tests only · #6 transcription chain credible (reviewer's
own sensitivity runs: PCHIP-vs-linear moves proxies 0.8–3.6%; the 332
glyph choice 0.66% — neither can manufacture the family result);
QUEUED provenance audit: independent re-key of the AFT ordinates
(70–100%) + profile overlay vs the report's Figure 3 · #7 BAND RULING
CONVERGED: ship ±25% universal screening range (owner leaning +
reviewer support + evidence), display "ESTIMATED Cd 0.44 · screening
range 0.33–0.55", ±20% stays evidence-gated, NO shape-class tiering
(any future tiering from objective diagnostics — mesh quality,
calibration-support distance — never a classifier) · #8 TR-397 EXAM
RULES FROZEN BEFORE THE EXAM: predict the BARE HULL and report the gap
vs measured complete-airship values openly; NO post-hoc appendage
subtraction (predeclare-and-freeze an independent correction or report
the raw gap); silhouette tracing acceptable if anchored to published
dims, done before seeing errors, with tracing sensitivity; the exam is
INVALID if traces/k/θ/knots/basis/allowance change after seeing
results · #9 battery section renamed NON-KNOT WITHIN-FAMILY REGRESSION;
tn614.mjs frozen as the permanent historical blind-exam artifact · #10
speed claim wording: "50–130 ms/mesh, single-threaded Node benchmark,
this dev machine" · #11 no kill-rule or sealed-architecture violations.

Reviewer's summary line, worth keeping verbatim: "an extraordinarily
cheap, blind, low-order geometric initializer for an editable Cd
slider — now with real historical aerodynamic evidence that its
primary shape signal is not invented."

## TR-397 BLIND EXAM — RUN 2026-08-16: PRE-REGISTERED HYPOTHESIS CONFIRMED

Run: `node spike/sectional/tr397.mjs` (the frozen exam artifact — rules
frozen r11 #8 BEFORE the run; hypothesis pre-registered in
NEXT-THREAD.md BEFORE the run; NO calibration was changed).

**Source:** NACA Report 397 (Thompson & Kirschbaum 1931, NTRS
19930091470) re-fetched; Table II transcribed and INTERNALLY VERIFIED
(CD_v = dragArea/totalAirVol^(2/3) reproduces every printed
coefficient to the last digit). Basis conversion to the calculator's
frontal basis is EXACT per ship: CD_A = dragArea/(πD²/4). Hull
profiles traced programmatically from fig. 24 (500 dpi, top-contour,
tip-anchored axis, 9-px median denoise, fin-clip rule with the hull
max forced into the forward 65%, ordinates anchored to published L and
D; -RAWFINS variants kept as sensitivity).

**RESULT — the frozen estimator vs six real airships (bare-hull
predictions vs with-fins-and-cars measurements):**

| ship | f.r. | proxy | predicted | measured CD_A | raw gap |
|---|---|---|---|---|---|
| USS Los Angeles | 7.23 | 0.297 | 0.135 | 0.072 | +88% |
| Army TC-10 | 4.40 | 0.426 | 0.217 | 0.091 | +140% |
| Army TC-6 | 4.40 | 0.426 | 0.217 | 0.080 | +172% |
| Puritan (1st) | 3.50 | 0.387 | 0.186 | 0.084 | +122% |
| Puritan (2nd) | 3.50 | 0.387 | 0.186 | 0.093 | +100% |
| Navy ZMC-2 | 2.83 | 0.443 | 0.219 | 0.068 | +221% |
| Army TE-2 | 4.00 | 0.518 | 0.283 | 0.095 | +199% |

Mean raw gap **+149%** — and the true over-charge is LARGER, because
bare-hull predictions should sit BELOW with-appendage measurements.
**The hypothesis (mid-map over-charge, predictions high by ~1.5–2.5×)
is CONFIRMED.** The owner's sustained challenge ("the cigar should be
lower") was correct: every real airship lands its proxy (0.30–0.52) in
the calibration desert between the last real knot (0.181) and the
sphere (0.816), where the linear ramp over-charges pressure ~3–4×
(implied real pressure at these proxies: 0.03–0.06 incl. appendages;
the map says 0.09–0.25).

**What survives untouched:** the streamlined end (TN-614-anchored),
the bluff end (sphere/cube anchors — washing machine 1.0), and the
blind-ordering signal (predicted ordering roughly tracks measured
here too: LA predicted best, TE-2 predicted worst = measured worst,
on data the report itself flags at ~10% scatter). **What is now
evidence-based:** the mid-map needs real knots.

**Sensitivity:** RAWFINS traces (fins kept) inflate proxies 0.67–0.86
— the declared fin-clip rule is load-bearing and must be scrutinized
in review.

**PROPOSED (dated ruling + external review required, NOT applied):
calibration vNEXT2** — promote mid-map knots from this corpus (e.g.
Los Angeles 0.297 and TE-2/ZMC-2 region ~0.44–0.52), with the open
question for review: these measurements INCLUDE appendages, so knots
derived as measured−friction carry an appendage margin — options are
(a) accept as a conservative "real complete airship" grade, or (b) a
declared appendage allowance before knot derivation. Consequence
preview: cigar-class mid bodies would drop from ~0.29 to ~0.08–0.10
frontal — matching both the real-blimp row above and the owner's
prior expectation.

## TR-397 SENSITIVITY #2 — bare-hull reconstruction (r14-prescribed, run 2026-08-16): THE FIN-CLIP ARTIFACT DOMINATED EXAM #1

Run: `node spike/sectional/tr397-recon.mjs` (exam #1 left frozen; this
is the separately-declared sensitivity the r14 interim review
prescribed — geometry-only reconstruction rule stated in the header
before results; no drag value entered the reconstruction; no
calibration changed).

**Rule:** delete the fin-deviation stations (RAWFINS > hull by 2% rmax)
plus every plateau station the exam-1 clip manufactured, bridge with
monotone cubic. Removed: LA 83–92%L · TC 75–88%L · Puritan 83–92%L ·
ZMC-2 79–83%L · TE-2 71–83%L.

**RESULT — the artifact was load-bearing, exactly as the reviewer
suspected (quartic slope penalty on plateau-then-cliff):**

| ship | fin-clip proxy | recon proxy | fin-clip pred | recon pred | measured (w/ appendages) | recon gap |
|---|---|---|---|---|---|---|
| Los Angeles | 0.297 | 0.008 | 0.135 | 0.042 | 0.072 | −42% |
| TC-10 | 0.426 | 0.154 | 0.217 | 0.042 | 0.091 | −54% |
| TC-6 | 0.426 | 0.154 | 0.217 | 0.042 | 0.080 | −47% |
| Puritan (1st) | 0.387 | 0.113 | 0.186 | 0.036 | 0.084 | −57% |
| Puritan (2nd) | 0.387 | 0.113 | 0.186 | 0.036 | 0.093 | −61% |
| ZMC-2 | 0.443 | 0.197 | 0.219 | 0.045 | 0.068 | −34% |
| TE-2 | 0.518 | 0.135 | 0.283 | 0.042 | 0.095 | −56% |

**Honest reading, all directions at once:**
1. **Exam #1's "+149% mid-map over-charge" was largely a TRACING
   ARTIFACT.** With smooth hulls, no ship's proxy is mid-map at all —
   they land 0.01–0.20, i.e. the streamlined region ALREADY anchored
   by real TN-614 knots.
2. **The reconstructed predictions are plausible bare-hull values:**
   under with-appendage measurements by 34–61%, the CORRECT direction,
   and consistent with the literature's bare-hull ≈ 55–70% of total
   blimp drag (e.g. TC-class: measured 0.080–0.091 × ~0.6 ≈ 0.05 vs
   predicted 0.042). At face value this is a PASS-shaped result for
   the estimator on honest geometry.
3. **The vNEXT2 mid-knot proposal loses its evidence base:** TR-397's
   real hulls do not produce mid-map proxies, so this corpus cannot
   anchor proxy ≈ 0.3–0.8. The mid-map desert remains unanchored —
   and the cigar-preset question (proxy 0.499, rounded butt) remains
   OPEN, neither vindicated nor refuted by TR-397.
4. **The dominant uncertainty is now the tracing itself:** fin-clip vs
   reconstruction spans 0.30 vs 0.01 in proxy — the whole conclusion
   space. VERDICT IMPLICATION: no knot of ANY kind should be promoted
   from fig-24 tracing; published bare-hull offsets (TR-318 for Los
   Angeles; the ZMC-2's analytic ellipsoid+hyperboloid description)
   are the only acceptable geometry source for calibration-grade
   claims from this corpus.

**Status: vNEXT2 HELD (likely dead in its proposed form); r14 resumes
from these numbers. Exam #1 remains frozen as the record of what the
fin-clip rule produced; this sensitivity is the record of why.**

## r14 SEALED (2026-08-16) — verdicts, corrections, and the revised trust framing

**Verdicts:** TR-397 exam #1 — PASS as frozen historical evidence,
FAIL as evidence of a mid-map calibration defect (the fin-clip
manufactured exactly the plateau/cliff the quartic aft term punishes).
Sensitivity #2 — PASS as a diagnostic sensitivity only; NOT a
validation ("directionally consistent result on a plausible bare-hull
reconstruction" — devised after exam #1, and the reconstructed hull is
not known to be the true hull). **vNEXT2 — FAIL / DO NOT APPLY;
vNEXT stays frozen unchanged.**

**Corrections accepted by the builder (on record):** (1) the
"appendages ≈ 30–45%, so the estimator is only 10–25% low" arithmetic
was POST-HOC appendage subtraction — precisely what the frozen exam
rules prohibit; the licensed claim is only that a negative residual is
the expected DIRECTION. (2) "very little curve left to over/under-
compensate" softened: the sensitivity does not prove vNEXT isn't
somewhat off; it only removes the evidence of a large error, because
the reconstructed predictions are friction-dominated with pressure in
the TN-614-anchored region. TR-397 cannot certify vNEXT's absolute
accuracy either way.

**Revised trust framing (owner's methodological challenge, ratified by
the review):** trust is layered — the GEOMETRIC SIGNAL is fairly well
supported (TN-614 blind ordering); the calibration is reasonably
supported ONLY where real knots exist (proxy ≤ ~0.18) and at the bluff
anchors; **the middle (proxy ~0.2–0.8) is NOT validated — a data
desert with the cigar at ~0.5 sitting in it**; arbitrary uploads are
an experimental low-order screen, not established quantitative Cd.
TR-397 currently provides qualitative/directional evidence only; it
does not validate the ±20% band and does not resolve the mid-map.

**The reconstruction itself is unresolved (owner's second challenge,
ratified):** fin-clip vs smooth-bridge moves LA 0.297→0.008, TE-2
0.518→0.135 — the geometry PREPROCESSING is deciding the aerodynamic
class. TR-397 therefore tells us almost nothing quantitative about
estimator accuracy; what it establishes is that ACCURATE AFT GEOMETRY
IS CRITICAL (internally consistent with the quartic design), and that
neither tracing variant is authoritative.

**THE KILL TEST (declared as the standing science objective):** find
genuinely independent bodies with KNOWN CLEAN GEOMETRY and MEASURED
DRAG whose proxies populate 0.2–0.8 (especially 0.4–0.6). If similar
proxies map to wildly different pressure Cd with no other observable
explaining it, the methodology needs another dimension — not another
calibration tweak. If clean cigar-class bodies land on a sensible
monotone map, the methodology gains real credibility. For true
ABSOLUTE validation: independently defined bare-hull geometry AND
bare-hull drag (wind-tunnel bare-hull data, not appendage-laden
flight totals).

**Immediate prescribed step (before judging anything further):
eliminate the geometry uncertainty** — published numerical hull
offsets (Los Angeles / TR-318 first), exact analytic ZMC-2 if
parameters suffice, any historical body with actual ordinates +
measured drag; feed EXACT hulls through the frozen estimator and see
which reconstruction the truth resembles.

## TR-432 AKRON EXAM — EXACT GEOMETRY, BARE-HULL DRAG (run 2026-08-16): FIRST ABSOLUTE VALIDATION — INSIDE THE BAND

Run: `node spike/sectional/tr432-akron.mjs`. The r14-prescribed gold
standard: independently defined bare-hull geometry AND bare-hull drag
— NACA TR-432 (Freeman, 1/40-scale USS Akron, NTRS 19930091505):
22 published offset stations (crisp print, zero tracing), L 19.62 ft,
vol 115 ft³, f.r. 5.9 — the same body family TR-397's fig. 25 leans
on. Measured bare-hull Cs (vol^2/3 basis) from FOUR independent
tunnel entries (P.R.T. 1/40; V.D.T. wooden 1/200 aux + main; V.D.T.
metal 1/250), converted to frontal EXACTLY via vol^(2/3)/(πD²/4) =
2.737; ITTC friction at length-based Re = Re_v·L/vol^(1/3) ≈
1.2–1.7e7. Frozen estimator, frozen calibration.

**RESULT:** exact-geometry proxy **0.090** (streamlined region,
parity-clean) → pressure 0.0100; predictions 0.062–0.065 vs measured
0.049–0.062 across the four sources:

| Re_v | predicted | P.R.T. (this model) | VDT wood aux | VDT metal | VDT wood main |
|---|---|---|---|---|---|
| 3.05e6 | 0.0647 | 0.0542 | 0.0588 | 0.0624 | — |
| 3.73e6 | 0.0629 | 0.0528 | 0.0580 | 0.0610 | — |
| 4.30e6 | 0.0617 | 0.0520 | 0.0572 | 0.0599 | 0.0493 |

Headline vs the 1/40 model itself (mid Re): **predicted 0.0629 vs
measured 0.0528 → +19%, INSIDE the ±20% band.** Vs the VDT metal
model: +3–4%. The prediction sits WITHIN the inter-tunnel scatter of
the four 1930s measurements of this same body (0.049–0.062).

**What this establishes and does not:**
- FIRST absolute (not ordering) validation of the frozen estimator on
  a real airship hull — bare-to-bare, exact geometry, band honoured.
- CORROBORATES sensitivity #2's class claim with exact geometry: a
  real f-5.9 rigid hull proxies at 0.090, not 0.3–0.5 — the fin-clip
  artifact story is confirmed from an independent direction.
- The MID-MAP (0.2–0.8) KILL TEST REMAINS OPEN: the Akron, like every
  real airship hull, is a streamlined-region body. Clean mid-map
  bodies with measured drag are still the missing evidence class.
- Model-scale Re (~1.5e7): comfortably in ITTC's zone; full-scale
  extrapolation not claimed here.
- Declared approximation: the model is polygonal (36→24 sides); the
  lathe uses the published circumscribed radii as a body of
  revolution. Misprint flagged: P.R.T. third value "0.1090" read as
  ≈0.0190 from fig. 8 (noted in the artifact header).

## TM-267 CROSS-SECTION EXAM (run 2026-08-16): THE EQUAL-A(x) BLINDNESS, QUANTIFIED AGAINST 1924 MEASUREMENT

Run: `node spike/sectional/tm267-crosssection.mjs`. Source: NACA
TM-267 (Wieselsberger, Göttingen Report II) — a streamlined body with
ROUND vs SQUARE cross-section, SAME length (81 cm), SAME volume, same
max section (136 cm²) ⇒ same A(x) BY CONSTRUCTION: the cleanest
possible probe of the estimator's one documented blindness (corner
term removed from the composite, r9 #4). Measured at α = 0°: round CD
0.046, square 0.050 → RATIO 1.087 (report warns forces were small,
accuracy below usual). Regime: Re_L ≈ 1.0e6, TRANSITIONAL — absolute
values declared out of regime (ITTC fully-turbulent overshoots, the
TN-614 regime lesson; predicted absolutes 0.075/0.085 vs measured
0.046/0.050 — reported, not claimed).

**THE CLEAN RESULT — the ratio:** estimator predicts square/round =
**1.138** (identical pressure by design — proxy diff 0.003; the whole
predicted difference comes from MEASURED wetted area: mesh ratio
1.126 vs the analytic 2/√π = 1.128 ✓) vs measured **1.087**. Within
~5%, and Wieselsberger's own 1924 explanation of the difference
("smaller friction due to the smaller surface… frictional drag
constitutes a large share") is the SAME MECHANISM the architecture
assumes. VERDICT: at zero incidence on streamlined bodies, the
corner physics beyond friction-surface is ≤ ~5% — the corner-term
REMOVAL is now quantified against measurement, erring mildly
CONSERVATIVE (over-charging the square). The blindness bound at
oblique angles / bluff bodies remains unmeasured (the square's LIFT
is 4× the round's when yawed — cross-section matters enormously off-
axis; out of the estimator's zero-incidence scope, noted).

Also this session: TR-253 (Zahm) examined and RETIRED as an exam
source — theory treatise; its one measured spheroid item is
pressure-integration drag on a 2-inch model at Re ~2e5, readable
only by curve-tracing: fails the clean-data bar on all three counts.
TN-84 (Wieselsberger's sphere/disk/cylinder laws) — nothing
actionable beyond the existing sphere anchor. The Göttingen
ELLIPSOID family (the true mid-map corpus) remains unlocated in
NTRS translations — still the standing kill-test target.

## r14 POST-SEAL ANNOTATION (reviewer, 2026-08-16) — dispositions applied same-day

**TR-432 Akron: CONCUR** — "strong independent post-freeze absolute
check; published numerical geometry, zero tracing, bare-to-bare; +19%
against the corresponding P.R.T. model at the selected condition,
inside the frozen ±20% screen." Wording corrections applied: "exact
geometry" → "published-offset geometry, zero tracing" (the physical
model was polygonal, lathed here from circumscribed radii — a ~0.5–1%
area effect, declared); "four independent tunnels" → four measurement
series across TWO facilities (P.R.T. + V.D.T., differing models/
balances). The 0.1090→0.0190 misprint reading is immaterial: the
headline uses the unambiguous mid-Re 0.0193 datum.

**TM-267: SEND-BACK on the geometry inference — applied.** Same
length + volume + max section fix ∫A dx and max A but do NOT
determine A(x); equal A(x) holds for OUR synthetic realization, not
provenly for Wieselsberger's actual models, and the wetted areas are
mesh-computed, not historical. The "corner physics ≤ ~5%" bound is
RETRACTED. Retained claim (reviewer's wording): TM-267 independently
reports only an 8.7% drag increase for the square body at zero
incidence and attributes it largely to greater surface/friction; a
synthetic equal-A(x) realization gives the frozen estimator a
similar-order penalty (~13.8%) — QUALITATIVE corroboration of the
architecture's friction mechanism, not quantitative validation of
the blindness. Artifact header and output re-worded accordingly.

**Ledger wording corrected (audit-proof form):** the evidence ledger
now spans four historical corpora. Following the vNEXT calibration
ruling informed by TN-614, subsequent independent exams were run
against the frozen estimator without further retuning. Roles:
TN-614 — blind geometric ordering + subsequently calibration
evidence · TR-432 — strong post-freeze absolute bare-hull check ·
TR-397 — geometry-input sensitivity / cautionary corpus, not
quantitative validation · TM-267 — qualitative friction-mechanism
corroboration unless actual longitudinal geometry is established.

**Unchanged: vNEXT, the ±20% band (the Akron result landed AT the
band edge — evidence the width is well-chosen, not narrowable), and
the mid-map kill test as the highest-value next science target.**

## MID-MAP CORPUS HUNT — FIRST KILL-TEST BODY FOUND (2026-08-16, staging only)

**Source located and acquired:** "Ergebnisse der Aerodynamischen
Versuchsanstalt zu Göttingen", II. Lieferung (1923), §3b "Der
Widerstand von Kugeln, Ellipsoiden und Scheiben" (Wieselsberger),
pp. 28–32 — archive.org scan `ergebnissederaer02betzuoft`, public
domain. Volumes I–IV all confirmed on archive.org; III (1927) adds
no bodies of revolution; IV (1932) adds sphere critical-Re studies
(anchor corroboration only, incl. the interference lesson: a support
wire at the sphere equator raised supercritical drag >100% — the
era's sphere scatter explained). The hoped-for fineness-1.3–8
ellipsoid SERIES does not exist in the Ergebnisse: the yield is
exactly TWO ellipsoids of revolution, tabulated (Zahlentafeln 35/36).

**The find (staging artifact `gottingen2-ellipsoids.mjs`):**

| body | geometry | frozen-estimator proxy | measured c (frontal) |
|---|---|---|---|
| prolate 1:1.8 | d 200 mm / l 360 mm, analytic | **0.597 — dead centre of the kill-test region 0.4–0.6** | min 0.055 @ Re_d 137k; rising to 0.084 @ Re_d 550k |
| oblate 1:0.75 | d 200 mm / l 150 mm, analytic | 0.894 (bluff end — corroborative only) | 0.600 subcritical → 0.205 @ Re_d 546k |

This is the first real body with measured drag found at mid-map
proxy. Geometry is ANALYTIC (an ellipsoid is a formula — zero
tracing, the strongest geometry grade in the ledger). Frontal basis
verified by recomputation (c = W/(q·πd²/4), rounding-level
agreement); transcription is OCR-draft with a per-row consistency
check — ONE row flagged (T36 row 3, printed c 0.117 vs recomputed
0.133) — page-image verification required before any exam.

**The regime problem, stated before anyone falls in love:** Re is
diameter-based 44k–550k; length-based tops out ≈1e6 — transitional,
below the estimator's regime, and the prolate's supercritical c is
still RISING (0.055 → 0.084) at the last measured point — transition
physics in motion. TM-267 precedent: Re ~1e6 was declared
out-of-regime for absolutes. An exam on this corpus must open with a
regime ruling: (a) reject for absolutes / accept as
ordering+qualitative, or (b) compare at the top-Re datum with the
transitional caveat declared. NOT pre-registered here; that is the
owner's + reviewer's call.

**NO exam was run: no prediction-vs-measured number exists in this
record.** The staging script computes proxies only; the comparison
is gated on frozen rules + pre-registration per r14.

**Named leads that remain (next hunt round):** DTMB Series 58
(Gertler 1950, DTMB Report 297 — 24 towed bodies, clean polynomial
geometry, high Re; mostly streamlined but the full-stern/low-fineness
corner may reach the gap edge; PDF not yet acquired) · modern
magnetic-suspension axial-flow cylinder data (JStage, J. Wind Eng.
29(4), Re 50k–100k, interference-free) · axial-flow cylinder water
data L/D 2–35 at Re 2.2–7.0e5 (Tandfonline, 2022) · hemisphere-ended
finite cylinder studies (CFD-heavy, thin on measured drag). Dress
AIAA 89-0648 (magnetic-suspension modified prolate spheroid) is
metadata-only on NTRS. TR-253 stays retired.

## E2 ELLIPSOID EXAM RUN (2026-08-16, owner go: "do the exam") — PRE-REGISTERED HYPOTHESIS CONFIRMED AT ITS UPPER EDGE

Pre-registration commit `b553c69` (rules + hypothesis frozen BEFORE
first run); exam artifact `gottingen2-ellipsoids.mjs`. Transcription
print-verified against the page image (leaf 40) — all rows match;
T36 row 3 is a typo in the 1923 original (excluded, subcritical,
immaterial). Re column verified diameter-based.

**PROLATE 1:1.8 (the kill-test body, proxy 0.597): predicted 0.337
vs measured 0.084 at the primary datum (top Re) → HIGH 4.0×.** The
hypothesis said HIGH 2–4×; it landed at 4.0. The transitional-Re
caveat cannot absorb this: even granting a turbulent-regime truth of
~0.10–0.15 for this body, the prediction is still 2.2–3.4× high.
FIRST REAL-DATA CONFIRMATION that the mid-map linear interpolation
over-charges — the cigar challenge now has measured evidence, with
analytic geometry and zero tracing.

**OBLATE 1:0.75 (corroborative, proxy 0.894): predicted 0.752 vs
measured 0.205 (supercritical) → HIGH 3.7×** — and this points at
something SHARPER than mid-map: the oblate sits nearly ON the sphere
knot (0.816), and its measured supercritical value (0.205) matches
the SUPERCRITICAL sphere (~0.2 at high Re), while the calibration
sphere knot carries the SUBCRITICAL textbook 0.47. Coherent single
diagnosis, stated for review (NOT ruled): the map's upper half is
anchored to SUBCRITICAL bluff values while the friction term assumes
high-Re turbulent flow — a regime inconsistency inside the anchor
set itself. Cube/plate knots are Re-independent (unaffected); the
rounded-bluff (sphere-class) region is where it bites.

**CONSEQUENCE PREVIEW (no change made — rule 1 holds):** if a knot
review confirms the diagnosis, everything above proxy ~0.2 drops,
INCLUDING the bare-Sunship marker (proxy 0.770, currently ESTIMATED
0.438 — plausibly ~0.2-class under a supercritical sphere anchor)
and therefore the size of the ~10× reveal-by-removal delta. The
validated streamlined end (TN-614, Akron) is untouched. This
touches product-visible numbers and the sealed stage-1 display —
OWNER RULING + EXTERNAL SCIENCE REVIEW (r15) REQUIRED before any
calibration edit. Open questions for r15: (a) promote supercritical
sphere (~0.2 at high Re) in place of 0.47, (b) promote the E2
prolate as a mid-map knot despite transitional Re (with a declared
allowance), or (c) demand the higher-Re mid-map corpus first
(Series 58 low-fineness corner named as lead).

Frozen estimator, frozen calibration vNEXT, zero retuning. The
exam changed nothing; it produced evidence.

## r15 TRIAGE REVIEW RAN 2026-08-16 (external, on the R15-TRIAGE-KIT) — VERDICT: KEEP / RESTRICT / REBUILD-CALIBRATION

**Reviewer verdict (recorded verbatim in intent):** KEEP the
estimator architecture. RESTRICT trust in the present calibration
above proxy ~0.18. Do NOT promote E2 as high-Re validation or as a
calibration knot. Do NOT merely swap sphere 0.47 -> 0.20 and declare
victory. REBUILD the rounded-body calibration on regime-consistent
high-Re data, then rerun the entire frozen exam ledger. If that
fails, then revisit the proxy architecture.

**Question 1 (sphere anchor): CONFIRMED** — 0.47 is a subcritical
smooth-sphere value and indefensible as the declared Re~1.85e8
reference (Achenbach cited to 6e6 + roughness sensitivity). But the
reviewer stopped short of endorsing 0.20 as the replacement: the
verified experimental record tops out ~6e6-1e7 and roughness moves
the transcritical level materially.

**Question 2 (E2 defeater): SUSTAINED IN PART.** E2 disposition per
the reviewer: "strong evidence that the existing calibration is
regime-incoherent; insufficient evidence to measure its error at the
intended high-Re operating point." The 4.0x headline is an
out-of-domain absolute comparison by the exam's own declared rules
and may NOT be summarized as "the estimator is 4x wrong at airship
scale." No clean high-Re fat-prolate (~1.8:1) experiment was found
by either party; the canonical high-Re body is the slender 6:1.

**REVIEWER'S ADVERSARIAL CATCH (builder CONCURS, correcting the
builder's own one-knot preview as too optimistic):** lowering only
the sphere knot largely cures the PROLATE mid-map over-charge
(reviewer's swept table: sphere 0.30/0.25/0.20 -> prolate prediction
0.225/0.193/0.160; bare-Sunship ~0.28/0.23/0.19) but does NOT cure
the OBLATE — proxy 0.894 sits ABOVE the sphere knot (0.816), so the
segment rocketing to cube/plate (~1.10) still hammers rounded-bluff
bodies. Diagnosis upgraded: the upper map mixes TWO separation
regimes — rounded bluff (drag crisis, regime-sensitive) and
sharp-edged bluff (fixed separation, Re-independent) — into one
geometry-only line. A 1D proxy map cannot cleanly separate classes
that overlap on the proxy axis; if a split is ever needed, it must
come from an objective diagnostic (e.g. corner-penalty share), the
r11 #7 seam — RECORDED, NOT BUILT.

**CONCEPTUAL REFRAMING ADOPTED IN LANGUAGE (owner-initiated, refined
by reviewer, builder concurs):** the sectional proxy is SCALE-FREE
AERODYNAMIC SHAPE QUALITY ("does the body ask the flow to do
something gentle or horrible" — geometric at any size); its
calibration maps that quality to a REFERENCE HIGH-RE FORM-DRAG
COEFFICIENT appropriate to large vehicles; the selected ship's
actual Re independently sets friction (already implemented: the
size/speed linkage is live in estimateCd). Turbulent != incoherent:
attached turbulent boundary layers on good shapes are exactly the
intended regime. The 1923 exam asked "what was this small ellipsoid
doing mid-transition", not "how good is this geometry at scale" —
different questions, honestly distinguishable.

**CODE IMPLICATIONS (reviewer + builder agree):** sections.js NO
CHANGE · geometry measurement NO CHANGE · API NO CHANGE ·
size/speed/Re linkage already correct · friction NO immediate change
· calibration knots/provenance LIKELY CHANGE after the science
settles (small software change: knots + fixtures + full ledger
rerun) · pressure(proxy, Re) seam RESERVED, not implemented without
evidence (estimateCd already computes re adjacent to the call — the
seam is one argument away).

**PRODUCT-VISIBLE FLAG FOR THE OWNER (not actioned):** the reviewer
holds that the silent +/-20% band cannot presently be defended above
the validated region (proxy > ~0.18) even silently. Display ruling
needed: band only in the validated region / wider band above /
other. Touches sealed stage-1 display semantics — owner ruling +
proper review before any edit.

**STATUS AFTER r15:** calibration vNEXT remains FROZEN and the
product untouched. The mid-map kill-test hunt CONTINUES but with a
sharpened spec: REGIME-CONSISTENT high-Re rounded-body data only
(Re >= ~1e7 preferred; Achenbach sphere incl. roughness branch is
the bluff-end lead; DTMB Series 58 low-fineness corner remains the
mid lead; the 6:1 canonical prolate anchors the streamlined side of
the rounded family). E2 stands as a regime-incoherence exhibit, not
a calibration input.

## CALIBRATION vHR CANDIDATE BUILT + LEDGER RE-RUN (2026-08-16, owner go: "try bounded rebuild") — NOT ADOPTED, r16 GATE

Artifact: `calibration-hr.mjs` (candidate; frozen files untouched;
production runs vNEXT). Method: the owner-proposed SPHERE-CRISIS-
RATIO CLASS SCALING — Achenbach 1972 sphere (subcritical ~0.50 →
transcritical ~0.19 at 6e6; literature grade, primary paywalled,
verification queued) gives crisis ratio 0.38; applied as a declared
correction to the print-verified E2 subcritical values. Six knots,
monotone, same structure and failure semantics as vNEXT:
streamlined pair UNCHANGED · E2-prolate scaled (0.597→0.090) ·
sphere-HR direct (0.816→0.182) · E2-oblate scaled (0.894→0.214) ·
cube+plate pooled UNCHANGED (no crisis — sharp edges, physics).

**CLASSIFIER QUESTION RESOLVED (owner asked whether VS could grade
shapes):** no classifier needed — the proxy already prices pinned
separation (angular bodies all proxy ≥~1.0, rounded ≤~0.9; the
steep 0.894→1.0 segment IS the rounded→pinned transition). VS
REJECTED for this job (measures compactness; cube VS ~1.24 sits
beside spheres with opposite separation physics). VS-style bands
(sphere/near-sphere/blob/average/elongated ~ fineness 1/1.2/2/10+)
noted as future DISPLAY vocabulary + the parked directionality
warning, not calibration machinery.

**LEDGER RE-RUN:**
- TN-614 six bodies @66e6: vHR IDENTICAL to vNEXT to 4 decimals on
  all six — the validated streamlined end provably does not move.
- TR-432 Akron: 0.0629 vs measured 0.0528, unchanged (+19%, in band).
- E2 knots reproduce scaled targets by construction (0.102 / 0.220 /
  0.190).
- Product presets, bare hull @300 m/100 km/h (vNEXT → vHR):
  sunship 0.438 → **0.171** (tail-ON 0.043 ⇒ reveal delta ~4.0×,
  matching the owner's stated preference for a ~5×-class story) ·
  cigar 0.292 → **0.126** (the owner's original "should be ~0.1"
  instinct, now derived) · car 0.213 → 0.080 · aerosmena 0.380 →
  0.137 · bottle 0.794 → 0.329 (steep-segment body, honest price) ·
  washingmachine 1.113 → 1.113 EXACTLY (angular class untouched —
  the physics split working as intended).

**DECLARED UNCERTAINTIES (band must carry them):** prolate knot
method-spread 0.10–0.15 (ratio vs recovery-factor cross-check);
sphere 6e6→REF extrapolation (transcritical ~flat-to-slowly-rising);
roughness raises transcritical levels (smooth-surface assumption
declared); E2 subcritical references are single-source (one body
each).

**ADOPTION PATH (nothing done):** r16 external review of this
candidate → owner ruling → then the production edit is small
(calibration.mjs knots + fixture updates + battery + full gate +
page live-verify + pinned-number updates incl. the SUNSHIP_SECTIONAL
dial/marker consequences). Band-display ruling (r15 flag) rides the
same round.

## r16 REVIEW RAN 2026-08-16 — SEND-BACK (vHR NOT ADOPTED); builder verification of the killing finding SAME-DAY

**Verdict:** SEND-BACK vHR as an adoptable calibration · PASS the
high-Re reference framing · PASS ledger integrity (TN-614/Akron
provably unchanged) · PASS the self-service check (no Sunship
fingerprint; the correction is global, competitors benefit as much
or more, and the marketing delta SHRINKS) with the hard distinction
kept: an adopted 0.171 would be an estimator output under new
assumptions, never an external validation of the Sunship ·
REJECT E2×sphere-ratio as calibration-grade knots · REJECT the
no-classifier proof · HOLD adoption.

**Finding 1 (method): ×0.38 is a SENSITIVITY ESTIMATE, not
calibration-grade.** Modelled extrapolation of low-Re data does not
become measured high-Re evidence (r15's own prescription). Crisis
depth varies with geometry. PROLATE 0.269 REFERENCE: FAIL — no
subcritical plateau exists (0.269→0.165→~0.07 immediately); calling
the first row "the subcritical reference" was a choice, not
physics. The prolate knot is OUT. Oblate reference (real plateau
0.60→0.57) acknowledged better but still not knot-grade under a
universal ratio. Sphere 0.50→0.19 plausible as SMOOTH-EQUIVALENT
reference only (Achenbach 1974: roughness can raise transcritical
Cd to ~0.4); 6e6→1.85e8 stays a declared extrapolation.

**Finding 3 (no-classifier claim): FALSIFIED BY OUR OWN FROZEN
BATTERY — the strongest finding, and the builder VERIFIED it
same-day:** flat-front boat-tail softAft 0.002 / softFore 0.778 →
composite 0.778; Sunship +Z softAft 0.770 / softFore 0.005 →
composite 0.770. Same scalar within 0.008, OPPOSITE mechanism
(fore-pinned face vs aft rounded closure). compositeV1 = max(aft,
fore) throws away exactly the bit the calibration branch needs —
and lowering the rounded line without that bit would FLATTER
fore-pinned bodies (the dangerous error direction, which vNEXT
never had). Chopped teardrop 0.212 (terminal-base case) confirmed.
The scorer ALREADY returns softAft/softFore separately; terminal-
base fraction is computable from existing walk terms. The next
candidate informs its calibration branch from those existing
diagnostics — NOT from VS (rejected again), NOT from cornerPenalty
(documented raster bias).

**Finding 6 (band): reviewer ruling proposed — silent ±20% at proxy
≤ ~0.18 ONLY; NO band above (not ±50%: an invented width would look
evidenced when it is not). Internal proof: vHR's own prolate method
spread 0.10–0.15 exceeds ±20% of 0.102. Marker still initializes
the slider; absence of a band = that region is not accuracy-graded.
AWAITING the owner's ruling (touches sealed stage-1 display).**

**Required regression fixtures for the next candidate (vHR2), per
the reviewer:** (1) flat-front+boat-tail ~0.778 must NOT receive
rounded-recovery calibration; (2) chopped teardrop ~0.212 stays
recognized as terminal-base/pinned; (3) Sunship fixtures its
dominant term (measured: AFT, 0.770 vs fore 0.005); (4) TN-614 +
Akron bit-identical; (5) knots finite/monotone, failure semantics
unchanged; (6) no band above the supported region.

**Reviewer's closing frame (adopted):** the geometric machinery
carries MORE information than the single scalar exposes — the
calibration work discovered the case where the REASON for the score
matters to absolute Cd. "The candidate got close enough that the
next problem is now sharply defined." Not a collapse; a productive
send-back.

**BUILDER NOTE FOR THE vHR2 DESIGN (recorded, not built):** with the
prolate knot dead, a minimal map (streamlined pair + sphere-HR +
cube/plate, E2 knots dropped) lands nearly the same product numbers
(Sunship bare ~0.178, cigar ~0.106) via the shallower 0.181→0.816
segment — BUT that is exactly the configuration that would flatter
the fore-dominated 0.778 alias, so vHR2's real work is the
fore/aft-aware treatment (aft-dominated rounded → crisis-aware
line; fore-dominated or terminal-base → no rounded rescue), built
on softAft/softFore + terminal-base fraction, with the six required
fixtures. Design round + r17 before anything moves.

## vHR2 CANDIDATE BUILT (2026-08-16, same-day answer to r16) — 14/14 FIXTURES GREEN; r17 KIT ASSEMBLED

Artifact `calibration-hr2.mjs` (CalcV2 `9d18870`); kit
R17-REVIEW-KIT.md. Mechanism-aware two-line calibration: ROUNDED
line (streamlined pair + sphere-HR 0.1824 + clamp; zero E2 knots —
r16 compliance) vs PINNED line (frozen vNEXT verbatim). Classifier =
three scorer-native triggers: fore-dominance · terminal-base > 0.05
at the last OCCUPIED station · re-expansion rawRatio > 1.15.
Invariant fixtured: rounded ≤ pinned everywhere — the branch can
only withhold the discount, never grant extra.

Build honesty on record: TAU first draft 0.20 sat INSIDE the
population (chopped teardrop honest base 0.181) — caught by the
fixtures, moved to 0.05 (measured 20× empty span), correction
documented not silent. The terminal-base read also hardened to
last-occupied-station (chopped constructor leaves orphan verts).
NEW ALIAS FOUND by the zoo: the r9 neck adversary (rawRatio 1.88)
classified rounded under two triggers — the re-expansion guard
closes it; r16 had not named this case.

DISCOVERY FOR THE RECORD: the corpus cigar's 0.499 proxy is
FORE-dominated (aft only 0.253) — the point-hull nose is flattened
into a face. Under vHR2 the cigar honestly KEEPS 0.2919; the
owner's ~0.1 cigar instinct now waits on the queued FACED cigar
mesh, not on calibration. Doctrine question sent to r17: should
catalogue presets REQUIRE a proper aeroHullMesh (r14 architecture)
rather than measure hull-artifact noses?

Presets (bare, 300 m/100 km/h, vNEXT → vHR2): sunship 0.4383 →
0.1785 (aft-dominated 0.770 vs 0.005, measured) · aerosmena 0.3798
→ 0.1573 · cigar/bottle/car/washingmachine UNCHANGED (pinned; each
trigger printed). TN-614 + Akron BIT-IDENTICAL. E2 held-out markers
bracket the rounded line (prolate: line 0.124 vs markers
0.084–0.102; oblate: clamp 0.182 vs 0.205/0.220).

AWAITING: r17 external review (kit ready) → owner ruling →
production graduation (classifier + lines behind the frozen API,
14 fixtures into the battery, gate, live-verify).

## r17 VERDICT (2026-08-16): TWO NARROW SEND-BACKS — vHR2 HELD, CdA PASS, Cd_v held on volume-trust semantics

**Part A (vHR2): SEND-BACK.** Dispositions: classifier SEND-BACK ·
rounded line CONDITIONAL PASS (zero E2 knots confirmed; screening
assumption honestly declared) · alias hunt FAIL — **the reviewer
constructed the next alias: a CONVEX rounded-nose body with a SHARP
AFT SHOULDER into a conical boattail** (their run: proxy ~0.557–
0.644, softFore 0, terminal base ~0, rawRatio exactly 1 → classified
ROUNDED; ~2.5× pressure discount vs the pinned line) — edge-dictated
separation passing all three guards; NASA axisymmetric-afterbody
work cited: smooth-to-separated purely by afterbody geometry ·
cigar: **aeroHullMesh REQUIRED for catalogue presets** (owner +
reviewer now aligned; uploads stay unstripped; current cigar
0.292/280/0.073 numbers DISQUALIFIED as comparison points —
wrong-nose representation) · ledger/invariants PASS · self-service
PASS (no rigging fingerprint; 0.179 remains model output, never
external validation) · adoption HOLD. Prescribed direction for
vHR3, adopted: NOT a bespoke trigger #4 — ONE general,
resolution-stable diagnostic separating SMOOTH severe recovery from
EDGE/SHOULDER-dictated recovery, its threshold EARNED by a swept
family (smooth afterbody → abrupt shoulder). Builder note recorded:
the candidate diagnostic is the max adjacent-station slope JUMP on
the aft envelope (converges to the kink angle for shoulders, → 0
for smooth bodies as stations → ∞ — resolution-stable by
construction; the sweep must demonstrate it). Hygiene fix applied
same-day: vHR2 provenance now names all three triggers.

**Part B: CdA PASS · Cd_v SEND-BACK (narrow).** Definitions PASS
(selectedCd correct; V^⅔ basis matches TR-397's own artifact) ·
display PASS conditional · contract growth PASS (package omission
noted: the updated 36-field fixture file didn't reach the reviewer —
attach next round) · sequencing CONCUR, **standing rule adopted:
implementation work may land on dev before external review;
sealed-contract changes become authoritative/deployable only after
their review gate passes.** THE VOLUME-TRUST DEFECT, builder-verified
same-day: `meshVolume` assumes watertight consistent winding but the
guards never test it — a perfectly convex unit cube with ONE
triangle's winding flipped keeps wetted 6.000/source 'mesh'/zero
warnings while volume reads 0.6667 (Cd_v inflated ~1.31×). The
wetted trust test and watertightness are NOT equivalent tests; the
code comment claimed more than the checks establish. RULING OPTIONS
FOR THE OWNER: (a) define Cd_v on CONVEX-ENVELOPE volume always
(hull volume, labelled honestly — philosophy-consistent with VS/VE
and the convex frontal silhouette; kills the whole attack class;
reviewer: "maybe even preferable"); or (b) implement a real
watertightness/winding validation (every edge exactly twice,
opposite orientation) and keep true-mesh volume for meshes that
pass, dash otherwise. Never silently mix the two meanings under one
number.

**Cross-part retraction (applied): the "Sunship 0.044 vs cigar
0.073 per-volume" narrative is RETRACTED until the cigar
aeroHullMesh exists** — the arithmetic stands, the cigar input was
the wrong-nose asset. The Sunship 0.044 stays arithmetic-on-authored,
never experimental validation; "classic airships ~0.02x" stays
CONTEXT, not a validated 2× claim.

**Closure question (m): implicitly NOT yet grantable — both parts
have one more candidate round each (vHR3 + the Cd_v semantics fix),
then r18 can be the closing review.**

## vHR3 BUILT (2026-08-16, owner go) — 21/21 GREEN; r18 = THE CLOSING REVIEW

`calibration-hr3.mjs`: vHR2 map + classifier UNCHANGED plus the r17-
prescribed FOURTH trigger — shoulderScore: max adjacent-window (L/32,
fixed fraction = resolution-stable) closure-slope INCREASE on the aft
monotone envelope, weighted (r/rMax)^4 (area-fraction squared — the
exponent earned empirically: every smooth body ends steep at its tail
pole; w^2 decays the sphere pole while a full-radius kink keeps its
angle). Threshold 0.25 declared AFTER measurement, mid-gap: highest
smooth body (sphere) 0.146; sharp shoulder family >=0.309; the
fillet SWEEP falls monotonically 0.325 -> 0.050 (knife -> blended,
crossing between 2-5% blend), stable 128 vs 256 stations. Units bug
(raster-cell A vs mesh-unit lengths, 100x slope inflation) caught by
the sweep itself and fixed on record. r17 shoulder adversary: PINNED,
pressure BIT-IDENTICAL to frozen vNEXT. Entire zoo + TN-614 (six,
bit-identical) + presets hold; sunship rounded (shoulder 0.124) ->
0.179; aerosmena rounded (0.100); cigar stays fore-pinned pending
its required aeroHullMesh. Production untouched; adoption gated on
r18 + owner.

## r18 VERDICT + vHR4 WIP (2026-08-16, session end)

**r18: PART B PASS — the volume/Cd_v question is CLOSED** (convex-
envelope semantics, retired-label rejection, 36-field snapshot,
winding fixture all verified by the reviewer). CdA + Cd_v stand.
**PART A SEND-BACK:** the reviewer built the next alias INSIDE the
shoulder family — a ~26° tangent break at 75% radius (56% of max
area) scored only ~0.12 under vHR3's Δslope×(r/rMax)⁴ (the w⁴
existed to tame the sphere pole and over-suppressed inboard
corners; 68% of the signal lost to the weight). Prescription:
REPLACE with bounded ANGLE jump × area fraction (Δatan(slope) ×
(r/rMax)²), earned on a TWO-dimensional family (sharpness ×
shoulder radius). Correction trail PASS. Closure (m) NOT granted —
by exactly the counterexample the kit requested. Also: graduation
checklist gains the CANONICAL UPLOAD-HULL rule (upload → convexHull
once → same hull to sectional + dynamics + volume/frontal/wetted;
presets use authored aeroHullMesh); the flipped-cap cigar claim
SOFTENED to "strong evidence of a corrupted/inverted cap;
promoted to demonstrated cause only when the corrected export
reproduces the rounded envelope"; vHR3 doc mismatch (²-vs-⁴) noted.

**vHR4 BUILT SAME-DAY (`calibration-hr4.mjs`, WIP, 22/25):** the
prescribed angle-based diagnostic. GREEN: the reviewer's EXACT r18
body caught (0.169 > 0.15, PINNED, pressure bit-identical to
vNEXT, resolution-stable 0.169/0.183); entire zoo + TN-614
(bit-identical) + presets hold; 2D sweep runs (and the family
itself honestly grows a SECOND corner at small rSh — the
diagnostic correctly reports the worst corner, my
monotonicity-in-radius assertion was misconceived and replaced).
**OPEN, documented, deliberately NOT threshold-squeezed at session
end:** at L/32 windows + width-3 anti-raster smoothing, a 26°
corner at 55% radius (0.131) overlaps the sphere's raster-driven
smooth floor (0.128; analytic ideal 0.0625). THE REMAINING KNOB:
window size — the smooth floor scales with the window while a
kink's angle does not; sweep window ∈ {L/64, L/48, L/32} × the 2D
family fresh, place the threshold only if a clean gap opens, then
r19 re-poses closure. The reviewer's own framing stands: "replace,
don't augment; no calibration redesign, no scorer redesign, no new
corpus required for that gate."

## vHR4 FINALIZED + WINDOW SWEEP DISCOVERY (2026-08-16): 27/27; r19 KIT READY — ONE RULING REQUESTED

Sweep (`sweep-window.mjs`) ran the r18-prescribed 2D family across
window {L/64..L/24} × smoothing {1,3,5} × RES {160..480} × mesh
density. DISCOVERY: the smooth floor is MESH FACETING (sphere 28×18
0.118 → 56×36 0.071 → 96×64 0.059; flat vs window AND RES) — real
corners in the supplied geometry, which any honest mesh measure sees.
No config opens a wide gap; ~26° corners at ≤55% radius share the
faceting band. FINAL: L/48 sw3, threshold 0.13 (Sunship 0.102 /
sphere 0.118 below; r18 adversary 0.144 above; margins ~10%,
declared). DETECTION LIMIT DECLARED (equal-A(x) precedent): catch
guarantee ≥~26° at ≥~70% radius; below = documented boundary with
bounded ~2× rare-class residual. 27/27 incl. the r18 body verbatim,
classification-level resolution stability, facet-floor fixtures.
r19 = one ruling (accept/reject the declared limit) + closure (m).

## r19 VERDICT (2026-08-16): PASS-CONDITIONAL — CONDITIONS APPLIED SAME-DAY — **THE ESTIMATOR CHAPTER IS CLOSED**

Reviewer: ACCEPT the declared detection-limit concept; vHR4 suitable
at its fixed production sampling settings; validated catch region
stated conservatively (~26°+ abrupt aft breaks at >=~70% radius;
deeper corners documented-unsupported, not guaranteed); "no r20
science review required after the record/fixture corrections"; and
the closing words: **"The estimator chapter can close."** Their own
independent constant-angle sweep confirmed the boundary (0.70 →
0.161/0.182 pinned; 0.55 → 0.100/0.115 rounded). Corrections
required and APPLIED (CalcV2 `latest`, 31/31): stale 0.15 header ·
catch-region wording (45°@44% claim retracted — reviewer falsified
it at 0.125/0.139 straddle) · faceting "dominated-by" wording with
the raster residual acknowledged (their RES rerun 0.118/0.136/
0.125/0.128) · residual risk restated (branch delta ~2× is NOT an
established aerodynamic bound) · the mislabelled family member
honestly recorded as ~14°@55% · TWO new permanent fixtures: the
FIXED-26° radius sweep (angle constant by construction; 0.70/0.75
pinned 0.137/0.159; 0.55 below guarantee 0.079; 0.60/0.65
transition recorded, not tuned) and the METROLOGY-CONFIGURATION PIN
(STATIONS 128 default, kFrac 48, smoothW 3, threshold 0.13 — the
documented limit belongs to this configuration). Threshold NOT
moved. REMAINING = GRADUATION ONLY (mechanical): four-trigger
classifier + two lines behind the frozen API, fixtures into the
battery, canonical upload-hull rule (upload → convexHull once →
same hull everywhere; presets on authored aeroHullMesh), full gate,
live-verify, pinned numbers (bare Sunship marker → ~0.179, reveal
~4×). Parked, unchanged: mid-map high-Re absolutes, equal-A(x),
band display ruling, cigar corrected asset, Achenbach primary,
pressure(proxy,Re) seam.

## vRE BUILT (2026-08-17, owner order): Re-AWARE ROUNDED-CLASS PRESSURE — r20 REVIEW PENDING

The owner redefined the job correctly ("estimate the shape at the
size at the speed") and re-opened the reserved pressure(proxy, Re)
seam WITH the evidence r16/r19 demanded. Design: the rounded class
BLENDS two measured maps across the drag crisis (smoothstep in
log10 equivalent-diameter Re, declared window 2.5e5–8e5, Achenbach
centre); the SUBCRITICAL line's anchors are the original vNEXT
sphere knot (never wrong, only mis-regimed — returned home) + the
1923 E2 measurements (out-of-regime for the high map, EXACTLY
in-regime here) + the shared streamlined pair; pinned class Re-flat
by physics; streamlined friction-driven as always. HEADLINES:
4 m sphere @ 3 km/h → 0.501 (subcritical, the owner's probe
answered) · 300 m @ 100 → 0.189 (vehicle regime unchanged — all
sealed numbers hold, fixtured) · **THE 1923 REPRODUCTION: the E2
prolate at its own tunnel condition reads 0.269 vs measured 0.269
exact** — the corpus that exposed the regime incoherence now closes
the loop as the subcritical anchor. Suites 118+118+39 + 120 UI;
GATE GREEN. Declared limitations: per-shape crisis location (window
is the class reference; transition zone lowest-confidence); ITTC
split at transitional measurement Re. AWAITING r20.

## TR-291 C-CLASS FINENESS EXAM (run 2026-08-19): **THE FAT MID-MAP FAILS.** SLENDER END CONFIRMED AGAIN

**The kill test the record kept asking for, and it did not pass.** This
is the first measured data ever put into the estimator's fat region, and
the region the bare Sunship (proxy 0.770) lives in over-predicts by a
factor of 2 to 5.

**PRE-REGISTERED.** `TR291-PREREGISTRATION.md` was committed BEFORE the
PDF was opened (`ddee849`, precedes every TR-291 data commit). These
eight hulls are **held out permanently** and may never become calibration
knots — TN-614's scar is not being repeated. If the fat map is rebuilt,
it must be rebuilt on a different source, and TR-291 stays the exam.

**SOURCE.** NACA Report 291, Zahm/Smith/Louden 1928 (NTRS 19930091360,
public domain). Navy Aerodynamic Laboratory, **8 by 8 ft** tunnel, 0°
pitch and yaw, 20–60 mph. Eight hulls at fineness 1.0 / 1.5 / 2.0 / 3.0
/ 4.62 / 6.0 / 8.0 / 10.0. Table I publishes full offsets — the question
that decided whether this job existed at all.

**THE DATASET IS BETTER THAN WE THOUGHT, IN A WAY THAT MATTERS.** The
eight hulls are ONE profile axially stretched: identical radius
ordinates, identical 7.700 in maximum diameter, only the station
interval changes. Three consequences:

1. **Frontal area is identical across the family**, so ordering by
   measured force IS ordering by frontal Cd — no conversion to rank.
2. **Blockage is 0.505% and identical for all eight.** The handover's
   worry that the fineness-1.0 point would be blockage-spoiled is dead;
   it is the cleanest point, not the dirtiest.
3. **A transcription error cannot produce a fineness-dependent result.**
   One profile feeds all eight. This is the internal control that makes
   the finding below hard to dismiss as a transcription bug.

**VERIFICATION BEFORE INTERPRETATION** (fixtures passing ≠ correct):

- lathe volume reproduces all eight published volumes (worst 0.8%);
- L/D from the transcribed geometry returns 1.000/1.500/2.000/3.000/
  4.621/6.000/8.000/10.000 against nominal;
- mesh frontal area within 0.3% of analytic for all eight;
- Table IV self-verifies: R × disk-ratio returns the report's own 1.544 lb
  for all eight rows;
- the thin disk reduces to **Cd 1.169** against the textbook 1.17,
  independently confirming q, area and the unit chain;
- our volumetric Cs reproduces the report's own Table III to rounding.

**COEFFICIENT BASIS.** The report's "shape coefficient" is VOLUMETRIC,
Cs = 2R/[ρ(Vol)^(2/3)V²]. Not used as the comparison basis — we go to
the force in pounds and form frontal Cd directly.

**RESULT — frozen estimator, production entry (`estimateCd`), 40 mph,
192×48 (converged; swept 64×24 → 256×64, Cd spread 2.4% at f.r. 1 and
0.5% at f.r. 10):**

| f.r. | proxy | class | predicted | measured | error |
|---|---|---|---|---|---|
| 1.00 | 0.707 | rounded | 0.3652 | 0.0896 | **+308%** |
| 1.50 | 0.475 | rounded | 0.1864 | 0.0541 | **+244%** |
| 2.00 | 0.324 | rounded | 0.1194 | 0.0462 | **+158%** |
| 3.00 | 0.196 | rounded | 0.0688 | 0.0516 | +33% |
| 4.62 | 0.104 | rounded | 0.0776 | 0.0634 | +23% |
| 6.00 | 0.076 | rounded | 0.0916 | 0.0802 | +14% |
| 8.00 | 0.059 | rounded | 0.1115 | 0.1033 | +8% |
| 10.00 | 0.042 | rounded | 0.1307 | 0.1231 | +6% |

**ORDERING FAILS.** Spearman ρ = 0.31, 10 of 28 pairs inverted. Measured
order (low→high): 2.0, 3.0, 1.5, 4.62, 6.0, 1.0, 8.0, 10.0. Predicted:
3.0, 4.62, 6.0, 8.0, 2.0, 10.0, 1.5, 1.0. **The trend shape is wrong,
not just the level**: measured Cd is a shallow U with a minimum at
fineness 2.0 and only a modest rise below it (0.046 → 0.090 at f.r. 1.0),
while the estimator produces a steep unbounded climb into the fat end
(0.069 → 0.365). It predicts the minimum at 3.0, not 2.0.

Contrast TN-614, where ordering was near-perfect. There the six bodies
shared fineness 5 and differed in nose/tail detail — the slender regime.
Here the sweep runs straight into the un-calibrated region and the
ranking collapses.

**DIAGNOSIS — it is the proxy→pressure map, not the regime blend and not
friction.**

- **Regime blend eliminated.** Every hull has the same diameter, so every
  hull sits at the same Re_D (2.33e5) and the same blend (0.00, fully
  subcritical). A common factor cannot produce a fineness-dependent
  failure.
- **Friction eliminated as the cause.** A Blasius laminar bound (the
  opposite extreme from the production ITTC line) still leaves +290% at
  f.r. 1.0 and +207% at 1.5. The fat end is robust to any friction
  assumption; only the slender end is friction-sensitive.
- **Roughness is exactly zero** for all eight (each sits below its own
  ks = 0.43 mm switch-on Re) — asserted in the run, correct physics for
  small varnished models.
- **The pressure term is the whole story.** Implied measured pressure
  (measured total − ITTC friction) at f.r. 1.0 is **0.063** (0.079 on the
  laminar bound). The subcritical line says 0.339 (**5.4×**); the high-Re
  line says 0.153 (**2.4×**). Both over-price.

**WHY, PHYSICALLY.** The C-class hull at fineness 1.0 is a *faired
teardrop*: max radius at 34.6% of length, then a long continuous taper
closing to a point. A sphere is proxy 0.816; this body is 0.707 — the
proxy sees the difference, but only as 13%, while the real drag differs
by 3–5×. **The proxy has the right sign and a badly wrong gain in the fat
region.** It cannot see that a faired closure suppresses the separation
that a sphere or ellipsoid suffers, which is precisely what the
subcritical anchors (sphere 0.462, E2 oblate 0.559) encode.

**CONSEQUENCE FOR THE SHIPPED NUMBERS — READ CAREFULLY, IT CUTS BOTH WAYS.**

- The **bare-Sunship 0.178** is friction ~0.010 + pressure **0.1701**,
  which is exactly the high-Re rounded line at proxy 0.770. That number
  now sits in a region the exam showed the map cannot price reliably.
  **It is DEMOTED, not rescaled** — see the correction below, which
  retracts an earlier draft of this line.
- **This is the flattering direction, which is exactly why it needs more
  scepticism, not less.** A lower bare hull does NOT make the ship
  better. It makes the **tail's claimed benefit smaller**, because the
  baseline the tail is measured against is inflated. The reveal-by-removal
  delta shrinks with it.
- **The shipped tailed figure is NOT implicated.** At the deployed
  proxy (~0.17–0.18) the estimate sits essentially ON the real measured
  TN614-332 knot (0.1808 → 0.01234), inside the validated streamlined
  region, and both lines agree there. Cd 0.0228 stands.
- **The un-modelled caveat.** The C-class hull closes to a point; the
  bare Sunship is a blunt-aft gömböc-ish hull that may genuinely separate
  where the C-class does not. The proxy claims they are comparable and
  TR-291 shows the proxy under-discriminates here — so this is evidence
  the bare figure is unreliable, NOT a measurement of what it should be.
  It cannot be corrected from this file, and must not be.

**WHAT THIS DOES NOT TEST.** Reynolds. Re_L 2.3e5–2.3e6, model scale,
below ITTC-1957's intended range. Nothing here supports or attacks the
Re 1e9 extrapolation; that remains a separate and possibly unanswerable
problem. Also untested: the mounting arrangement differs between the
f.r. ≤ 3.0 group (fig. 1) and the f.r. ≥ 4.62 group (fig. 2), a
systematic tare difference between exactly the two groups that behave
differently here — it is not remotely large enough to explain 5×, but it
is on the record.

**STATUS.** Frozen estimator, frozen calibration, zero retuning, no
calibration change follows from this file. CalcV2 suites 140+39+125 green,
production code untouched. The exam produced evidence; the ruling is the
owner's. The record's own r15 "consequence preview" — that everything
above proxy ~0.2 drops once real mid-map data arrives — is now supported
by measurement rather than argument, and the graduation to the two-line
map moved in the right direction but **not far enough**.

### TR-291 SAME-DAY CORRECTION: "f.r. 1.3" IS NOT "A 1.3:1 SPHEROID" (owner challenge, 2026-08-19)

**Toby's challenge, and it lands.** Fineness ratio is a coarse scalar. The
Sunship is ~1.3:1 but is not an axisymmetric prolate body — it is
monomonostatic (gömböc-class), non-axisymmetric, and asymmetric fore/aft.
A C-class hull at the same nominal fineness is a different geometric
class, and the first draft of the section above leaned on the proxy to
carry a C-class measurement onto the Sunship anyway.

**That inference was self-undermining and is retracted.** The exam's own
finding is that the proxy UNDER-DISCRIMINATES in the fat region — 13% of
proxy separating a 3–5× drag difference. A proxy with that property
cannot then be trusted to establish that two bodies near 0.7–0.8 are
aerodynamically comparable. The earlier wording ("the bare hull is
over-predicted, plausibly by ~2× or more") claimed more than the evidence
supports and has been replaced with a demotion.

**MEASURED, not argued** (`tr291-vs-sunship.mjs`):

| | proxy | max section at x/L | shoulder score | aft ramp (A/Amax at 0.70 → 0.975) |
|---|---|---|---|---|
| Sunship (bare) | 0.770 | **0.492** | 0.102 | 0.91 → 0.05 |
| C-class f.r. 1.0 | 0.707 | **0.344** | 0.064 | 0.66 → 0.05 |
| C-class f.r. 1.5 | 0.475 | 0.344 | 0.043 | 0.66 → 0.05 |

- Cross-section aspect of the Sunship across the two non-flight axes is
  **1.050 : 1** — a body of revolution reads exactly 1.000. It is not one.
- The two bodies' normalised area curves differ by **RMS 0.178** on a
  0–1 scale. The two C-class hulls differ by **0.000** (one profile,
  stretched). So the Sunship is far from the C-class family in exactly
  the quantity the proxy compresses to a single number.
- **They are different in a way that matters, and it does not favour the
  ship.** The C-class is a classic airship form: max section forward at
  34%, then a long faired taper. The Sunship peaks at mid-body and still
  carries 0.91 of max area at 70% length before dumping it — a
  materially steeper aft ramp, and a shoulder score 60% higher (0.102
  against 0.064, both still under the 0.13 trigger, both 'rounded').

**REVISED CONCLUSION ON THE BARE HULL.** TR-291 demonstrates the fat-region
map over-prices *well-faired* fat bodies. The Sunship is not one of those:
its aft closure is steeper than the C-class's, so it may legitimately
deserve more pressure drag than a C-class hull of the same fineness. The
honest statement is therefore:

> The bare-Sunship 0.178 is **un-supported**, not **known to be high**.
> The direction of the fat-region evidence is over-prediction, but the
> magnitude cannot be transferred onto a monomonostatic body by way of a
> proxy the same exam showed to be under-discriminating there.

**WHAT THIS SHARPENS — the test the method actually needs.** The
outstanding validation is *same fineness, very different shapes → does
the estimator rank their measured drag correctly?* That is precisely what
TN-614 did, and it PASSED — six bodies, all fineness 5, differing in
nose/tail detail. So we have that test in the SLENDER regime and the
estimator won it. What does not exist anywhere in the record is the same
test in the FAT regime, and it is now the single highest-value thing to
look for: a fat-body family at one fineness with several distinct
closures. TR-291 cannot supply it — it is one shape at eight lengths,
which is the orthogonal experiment.

**WHAT THIS DOES NOT CHANGE.** Everything else in the TR-291 section
stands: the fat map fails, the slender end passes a third time, the
diagnosis to the proxy→pressure mapping holds (it rests on the C-class
family internally, not on any Sunship comparison), and the shipped tailed
Cd 0.0228 is still anchored on the real TN614-332 knot and unaffected.

### TR-291 FOLLOW-UP: DOES THE FAT REGION NEED A NEW KNOT? NO — IT NEEDS A DISCRIMINATOR (2026-08-19)

**The measurement that settles it.** Adding the sphere — the anchor that
actually prices proxy ~0.8 — to the same comparison:

| body | proxy | class | max section at x/L | shoulder | RMS area-curve distance from Sunship |
|---|---|---|---|---|---|
| Sunship (bare) | 0.770 | rounded | 0.492 | 0.102 | — |
| **sphere (anchor)** | **0.823** | rounded | **0.492** | 0.057 | **0.038** |
| gömböc | 0.797 | pinned | 0.492 | 0.195 | — |
| C-class f.r. 1.0 | 0.707 | rounded | **0.344** | 0.064 | **0.178** |

**THE BARE-SUNSHIP FIGURE IS BETTER SUPPORTED THAN THE EXAM FIRST
SUGGESTED, AND THIS CORRECTS THE CORRECTION.** In section evolution the
bare Sunship is 0.038 from the SPHERE and 0.178 from the C-class
teardrop — it is nearly five times closer to the anchor than to the body
that failed. Both peak at x/L 0.492; the C-class peaks at 0.344 and
closes over 66% of its length. So the high-Re line placing proxy 0.770 at
pressure 0.170, just under the sphere-HR knot at 0.182, is landing a
near-sphere body next to the sphere anchor. That is interpolation
arriving at the right place for the right reason, not by luck, and it
does NOT depend on the stretch of map TR-291 broke.

Net: TR-291 demonstrates the map over-prices **faired forward-max
teardrops**. The bare Sunship is not one — it is a mid-max, sphere-like
body sitting beside a measured sphere anchor. The bare 0.178 stands as an
estimate with its own nearby anchor. The earlier "plausibly 2× high"
retraction was right to retract; this is why.

**WHY A NEW KNOT IS THE WRONG FIX.** The fat-region failure is an
IDENTIFIABILITY failure, not a wrong line height:

- C-class teardrop, proxy 0.707 → measured pressure **0.063**
- sphere, proxy 0.823 → measured pressure **0.462** subcritical

Two bodies **0.116 apart in proxy** and about **7× apart in pressure**.
No monotone single-valued function of proxy can serve both. Inserting a
knot at (0.707, 0.063) would force a near-vertical segment across that
0.116 of proxy, and every body landing inside it — including the Sunship
at 0.770 — would get an essentially arbitrary answer that swings wildly
on tiny proxy differences. That is strictly worse than the present line,
which at least is smooth and conservative. **Fitting the two points makes
the map more wrong, not less.**

**WHAT IS ACTUALLY NEEDED — the same medicine, one level down.** r16
found flat-front 0.778 vs Sunship 0.770: same proxy, opposite physics.
The answer was not a knot, it was the MECHANISM CLASSIFIER and the
two-line split. TR-291 is that same disease again, now INSIDE the rounded
class: sphere and C-class teardrop are both 'rounded', both smooth-closing,
and 7× apart. The existing four triggers grade whether separation is
FIXED (faces, flat bases, sharp shoulders); nothing grades how gently a
rounded body gives its area back.

The discriminator is visible in the data above and is the classic
afterbody parameter: **where the max section sits and how long the
closure is.** C-class 0.344 (closes over 66% of length) against
sphere/Sunship 0.492 (closes over ~50%). A forward-max, long-afterbody
body keeps flow attached; a mid-max body does not.

**AND TR-291 CANNOT CALIBRATE IT — for a structural reason, not just the
pre-registration.** All eight hulls are one profile axially stretched, so
their max-section location is IDENTICAL (0.344) for every one of them.
The afterbody fraction has ZERO variance across the whole dataset. TR-291
can prove the current map is wrong; it contains no information with which
to build the replacement. It is the orthogonal experiment.

**SO THE REQUIREMENT IS UNCHANGED AND NOW SHARPER:** a fat-body family at
ONE fineness with SEVERAL distinct afterbody closures, measured. That is
TN-614's design (which passed, at fineness 5) transplanted to the fat
regime. Until such a corpus exists, the correct action on the fat map is
**nothing** — no knot, no discriminator fitted to guesswork.

**STANDING RULE UNCHANGED:** any calibration edit needs OWNER RULING +
EXTERNAL SCIENCE REVIEW. Nothing in this file changes the estimator, and
the eight TR-291 hulls remain held out permanently.

### TR-291 RE-INVESTIGATION — THREE CORRECTIONS TO OUR OWN WRITE-UP (2026-08-19, external challenge)

Re-audited on challenge. Three things in the TR-291 sections above were
over-stated. All three are corrected here; the central finding survives.

**CORRECTION 1 — "ORDERING FAILS" WAS TOO CRUDE. The proxy still ranks;
the fat branch is at the wrong LEVEL.**

| group | inversions | Spearman |
|---|---|---|
| slender (f.r. 4.62–10) | **0 / 6** | **1.000** |
| fat (f.r. 1.0–3.0) | **1 / 6** | **0.800** |
| cross-group | **9 / 16** | — |

Within each regime the ranking is essentially intact — including the fat
one, whose single inversion is f.r. 2.0 vs 3.0, an 11% gap in measured Cd
(0.0462 vs 0.0516). The global ρ = 0.310 is produced almost entirely by
the fat branch being offset far too high, which then inverts every
fat-vs-slender pair. **That is a calibration-LEVEL failure, not a failure
of the geometric signal**, and the earlier heading obscured the
difference. Both curves are also U-shaped; the estimator finds the U and
puts its minimum at f.r. 3.0 where measurement puts it at 2.0.

This partially restores the standing claim that sectional geometry
carries real ranking information — TR-291 does not overturn it, it shows
the fat branch is mis-levelled.

**CORRECTION 2 — "INTERPOLATION ARRIVING IN THE RIGHT PLACE FOR THE RIGHT
REASON" WAS TOO STRONG.** Replace with: the Sunship's proximity to the
sphere in full area-curve shape (RMS 0.038) makes the high-Re
interpolation **substantially more defensible than the TR-291 result
initially suggested**. It is supporting geometric evidence, not a
measurement of the Sunship. Two bodies can share a gross sectional
evolution and still differ in 3D curvature, crossflow and separation
behaviour. The bare 0.178 is best labelled **"a plausible, physically
anchored high-Re screening estimate, not independently validated"** —
which is neither the "unsupported" of the first draft nor anything
resembling validated.

**CORRECTION 3 — THE DEGENERACY IS DEMONSTRATED SUBCRITICALLY, NOT AT
Re 1e9.** The claim "no monotone single-valued function of proxy can serve
both" rests on two SUBCRITICAL measurements: C-class teardrop 0.063 at
proxy 0.707, sphere 0.462 at 0.816. That is a real ~7× degeneracy in the
regime where both were measured. It is NOT measured on the high-Re line,
because no fat faired teardrop has been tested at high Re. Physically the
degeneracy should persist — the sphere's crisis drop to ~0.19 is bounded
and a faired attached body has less to lose — which would still leave
roughly 4×, but that figure is inference, not data. Stated properly:
**the proxy's geometric insufficiency is a property of the metric and is
regime-independent; the MAGNITUDE of the resulting error at vehicle Re is
unmeasured.**

**BOOKKEEPING QUERY ANSWERED — the sphere proxy 0.823 vs the pinned knot
0.8156213.** Not an inconsistency, and worth recording:
- the pinned knot is `makeSphere(28, 18)` from `spike/flow-chamber/shapes.mjs`
  scored on **+X** — verified an EXACT bit-for-bit match to
  0.8156212975892966;
- the comparison file used `../3D OBJ/sphere.obj`, a different and much
  finer mesh (8066 verts / 8192 faces against the generator's 532 / 1008),
  which reads 0.8227;
- the generator is **axis-dependent** — 0.8156 on +X but 0.8251 on +Z and
  +Y, a 1.2% spread that is a pure UV-pole discretisation artefact — while
  the finer sphere.obj is axis-independent to 0.0001, as a true sphere
  should be.

So the frozen sphere knot carries a ~0.9% discretisation bias below the
converged value and is orientation-sensitive at the 1.2% level. Immaterial
to every conclusion here (the Sunship comparison is on area CURVES, not on
the proxy scalar), but it is a real property of a pinned calibration
anchor and belongs in the record. The 0.492 max-section location for both
sphere and Sunship is likewise the 128-station metrology grid resolving an
exact 0.5, not a shape feature.

**WHAT SURVIVES UNCHANGED.** The fat-region map over-prices well-faired
forward-max teardrops by 2–5× at the measured regime; the diagnosis to the
proxy→pressure mapping; the elimination of the regime blend, friction and
roughness as causes; the conclusion that a new knot is the wrong fix and
that TR-291 structurally cannot calibrate the discriminator that IS needed;
and the shipped tailed Cd 0.0228 sitting on the real TN614-332 knot,
untouched.

### TR-291, THE DECISIVE FINDING: THE FAT MAP'S MONOTONICITY IS FALSIFIED — AND THE MISSING AXIS IS NAMED (2026-08-19)

Chasing "what would actually fix the fat region" produced the cleanest
result of the exam. Every fat anchor on the subcritical rounded line,
placed beside the body that failed:

| body | role | proxy | max section at x/L | measured pressure Cd |
|---|---|---|---|---|
| E2 prolate 1:1.8 | **ANCHOR** | 0.599 | **0.492** | **0.213** |
| **C-class f.r. 1.0** | **MEASURED, failed** | **0.707** | **0.344** | **0.063** |
| sphere | **ANCHOR** | 0.816 | **0.492** | **0.462** |
| E2 oblate 1:0.75 | **ANCHOR** | 0.890 | **0.492** | **0.559** |

**1. MONOTONICITY IS FALSIFIED.** The C-class hull sits at a HIGHER proxy
than the E2 prolate (0.707 vs 0.599) and measures **3.4× LESS** pressure
drag (0.063 vs 0.213). The calibration is a monotone piecewise-linear
function of proxy **by construction**. Reality, in this region, is not
monotone in proxy.

This is stronger than "a new knot won't help". It means **no
one-dimensional monotone map of the proxy can fit the fat region**,
regardless of how many knots are added or where they are placed. The
failure is structural, not a matter of resolution. Any attempt to fit
both the C-class and the prolate on one monotone line is arithmetically
impossible, not merely inaccurate.

**2. THE MISSING AXIS IS NAMED, AND IT IS CLEAN.** Every one of the three
fat anchors is a **mid-max** body — sphere and both ellipsoids peak at
x/L 0.492. The single body that fails is **forward-max**, peaking at
0.344 and then recovering over 66% of its length. That is the classic
afterbody/pressure-recovery distinction: a long gentle closure keeps the
flow attached; a mid-max body dumps its area over half the length and
separates.

So the fat region's anchor set is not merely sparse — it is **entirely
composed of one shape family**, and the proxy cannot tell that family
from the other one.

**3. AND THE BARE SUNSHIP IS ON THE ANCHOR SIDE.** The Sunship's max
section is at **0.492** — the same as the sphere and both ellipsoids, and
nothing like the C-class's 0.344. This is now a MECHANISTIC version of
the earlier area-curve argument (RMS 0.038 from the sphere, 0.178 from
the C-class) rather than a similarity score: the Sunship is a member of
the family the fat anchors were measured from. Its 0.178 is priced off
bodies of its own kind.

**4. WHAT THIS MEANS FOR PRIORITY.** The fat-map defect is a
**general-purpose product-quality issue** — it misprices user-uploaded
forward-max fat shapes — and NOT a bare-Sunship issue. That is a
different, and much lower, urgency than the raw exam result implied.

**5. THE AWKWARD PART — the data to build the discriminator is the exam
itself.** The three mid-max anchors give one curve. TR-291 gives four fat
forward-max points (proxy 0.707 / 0.475 / 0.324 / 0.196, all at
max-section 0.344) — precisely the second curve a two-axis map needs.
Spending it would build the discriminator and destroy the only held-out
fat-region exam in the record, exactly the TN-614 mistake at larger scale.

**RECOMMENDED (not ruled):** do NOT spend TR-291. Build the
discriminator's FORM from published afterbody/boat-tail correlations —
reference-grade provenance, the same class as ITTC-1957 — and then test
that form against TR-291 as the held-out exam. If it passes, the record
gains a validated second axis AND keeps its exam. Only if it fails does
spending TR-291 as calibration become worth discussing, and that needs a
dated owner ruling overriding the pre-registration.

**IMMEDIATE, COSTS NOTHING:** the estimator should decline to give a
confident absolute number for forward-max fat bodies, or widen its band
there. The defect is now characterised precisely enough to gate on.

No estimator change made. TR-291 remains held out.

### CANDIDATE AFTERBODY DESCRIPTORS SCREENED (2026-08-19) — AND THE CONSTRAINT THAT OUTRANKS THE CHOICE

External proposal (correct in architecture): keep the proxy, add one
afterbody-recovery scalar off the same area curve, and calibrate rounded
pressure on a 2D surface instead of a 1D line. Screened six candidates,
all free at runtime. Separation = distance between the ANCHOR family
(sphere, E2 prolate, E2 oblate) and the FAILED family (C-class), as a
percentage of their mean level.

| descriptor | anchors | failed | separation | Sunship lands |
|---|---|---|---|---|
| **closure slope** | 2.400 | 1.670 | **35.9%** | anchor side |
| **closure length** (0.95→0.05 Amax) | 0.375 | 0.539 | **35.9%** | anchor side |
| **x_max** | 0.492 | 0.344 | **35.5%** | anchor side |
| **A(0.7L)/Amax** | 0.821 | 0.612 | **29.2%** | anchor side |
| R_aft, un-normalised | 0.339 | 0.406 | 17.9% | anchor side |
| **R_aft, normalised by aft length** (as proposed) | 0.667 | 0.618 | **7.7%** | anchor side |

**FINDING 1 — the proposed formula is the WEAKEST of the six.** Dividing
the retained-area integral by the afterbody length (1 − x_max) removes
precisely the information that distinguishes the two families, which IS
the afterbody length. It compresses a ~35% geometric difference into
7.7%. Simply not dividing more than doubles it to 17.9%; the direct
measures (closure slope, closure length, x_max) do best at ~36%.
Recommendation: if a descriptor is registered, use closure slope or
closure length, not the length-normalised mean.

**FINDING 2 — and this outranks the choice of metric. THE ENTIRE FAT
ANCHOR SET IS ONE SHAPE.** Sphere, E2 prolate 1:1.8 and E2 oblate 1:0.75
return IDENTICAL values on every descriptor — x_max 0.492, R_aft 0.667,
closure 0.375, A(0.7L) 0.821. That is not a coincidence or a mesh
artefact: **every ellipsoid of revolution has A(x)/A_max = 1 − (2x/L − 1)²
regardless of aspect ratio.** The normalised area distribution is
aspect-ratio-invariant. The three fat anchors are one afterbody geometry
sampled at three aspect ratios, and aspect ratio is what the proxy
already encodes.

**CONSEQUENCE.** A 2D calibration surface would be fitted on exactly TWO
distinct values of the new axis — ellipsoid 0.492 and C-class 0.344.
That is not a surface. It is two lines with wholly unvalidated space
between them, which is the same disease as the current 1D map, one
dimension up. Worse, the C-class side is the held-out exam, so building
even those two lines spends TR-291.

**SO THE BINDING CONSTRAINT IS DATA, NOT DESIGN.** Picking the descriptor
is the easy part and is now effectively done. What does not exist is a
third and fourth DISTINCT fat afterbody geometry with measured drag.
Until two or three more exist, "2D surface" is not an honest description
of what could be built, and the correct action remains: derive the
descriptor's FORM from published boat-tail/afterbody correlations rather
than fitting it, and hold TR-291 as the test.

**FINDING 3 — the Sunship lands on the ANCHOR side of all six
descriptors, unanimously.** Third independent corroboration, now on six
metrics rather than one similarity score. Its closure is marginally more
abrupt than a true ellipsoid's (closure length 0.344 vs 0.375, slope 2.62
vs 2.40), which sits on the CONSERVATIVE side — slightly draggier than
the anchors it is priced against, not flattered by them.

Nothing calibrated, nothing fitted, estimator untouched, TR-291 still
held out. `aft-descriptor-candidates.mjs`.

### DESCRIPTOR STABILITY, A CONTAMINATION ADMISSION, AND THE ANCHOR-COVERAGE AUDIT (2026-08-19)

**1. STABILITY CHANGES THE DESCRIPTOR RANKING.** Largest family separation
is the wrong selection criterion; separation per unit of mesh noise is the
right one. Five lathe resolutions, C-class f.r. 1.0:

| descriptor | mesh spread | separation | signal/noise |
|---|---|---|---|
| **A(0.7L)/Amax** | **0.34%** | 29.2% | **87** |
| closure length / slope | 2.9% | 35.9% | 12 |
| x_max | 4.7% | 35.5% | 7.6 |
| R_aft normalised | 1.5% | 7.7% | 5.2 |

**A(0.7L)/Amax is the strongest CANDIDATE** — by 7× on usable signal —
and the reason generalises beyond this project: every other candidate must
first LOCATE THE MAXIMUM SECTION, and argmax on a broad flat maximum
jitters with mesh resolution. A(0.7L) never references x_max.

> **General lesson worth keeping: a robust reduced-order geometric metric
> should avoid unstable geometric events like "find the exact widest
> station" and instead sample the sectional history at FIXED normalised
> locations.**

It is a candidate, not a winner. The mesh-convergence result is clean; its
aerodynamic usefulness is unvalidated.

**2. CONTAMINATION ADMISSION — TR-291 IS SPENT AS A BLIND TEST OF ANY NEW
DESCRIPTOR.** The six candidates were screened for their ability to
separate the family TR-291 showed to fail. No measured drag entered the
descriptor selection, but the TARGET of the discrimination was set by
TR-291's outcome, and the 0.7L station was chosen after seeing the
failure. That is development work.

- **STILL CLEAN:** the exam of the EXISTING estimator. Pre-registered
  before the PDF was opened, run once, reported as it came out. Unaffected.
- **SPENT:** TR-291 as a blind test of a NEW closure descriptor. It can
  never be claimed that the descriptor "passed TR-291 blind".
- **UNAFFECTED:** the stability ranking, which uses no drag data at all.

Recorded rather than quietly absorbed. This is the pre-registration's own
failure mode occurring within hours of it being written, which is a
useful demonstration of how easily it happens.

**3. ANCHOR-COVERAGE AUDIT — the high-Re line is the sparse one.**

| line | knots | largest unanchored span |
|---|---|---|
| **HIGH-Re rounded (the line the VEHICLE uses)** | **3** | **0.181 → 0.816, width 0.635** |
| subcritical rounded (the line TR-291 tested) | 5 | 0.181 → 0.597, width 0.416 |

The bare Sunship at proxy 0.770 sits INSIDE the 0.635-wide unanchored span
— though near its upper edge, adjacent to the sphere-HR anchor, which is
the saving grace already established. Note the uncomfortable corollary:
**TR-291 falsified the BETTER-anchored of the two lines.** Nothing implies
the sparser high-Re line is in better shape; it simply has not been tested.

**4. WHY AN INVERSE CORRECTION CANNOT WORK — the question stated plainly.**
"Calibrate it by however much it is wrong" requires the correction to be a
FUNCTION of something, and the only available input is proxy. At proxy
0.707 the C-class teardrop needs ÷5.4 and an ellipsoid of the same proxy
needs ×1. **Same input, opposite required corrections.** No function of
proxy alone can deliver both, at any knot count. That is the identifiability
wall, and it is why the fix must be a second input rather than a better
line.

**5. WHAT WOULD ACTUALLY BE ENOUGH DATA.** Two separate deficits, needing
different data:
- **identifiability** — 3–4 DISTINCT fat afterbody geometries across 2–3
  proxy levels, roughly 8–12 measured bodies. Currently: 2 distinct
  geometries, one of them the spent exam.
- **high-Re sparsity** — fat-body drag at vehicle-scale Re, of which the
  line currently holds exactly one point (sphere-HR, literature-grade
  Achenbach, not a measurement of any body in the map's own families).

**6. THE ROUTE THAT IS ACTUALLY AVAILABLE.** Measured fat-faired-body data
is thin because almost nobody builds fat faired bodies, so waiting for
literature may not terminate. CFD is the realistic generator, and
validating a solver against TR-291's published measured drag is a CLEAN
use — qualifying a different tool against public measurements is not
calibrating the estimator and spends nothing further.

**7. WHAT CAN BE DONE TODAY, COSTING NOTHING.** The failing condition is
now geometrically DETECTABLE (high proxy together with low A(0.7L)). So
correct the CONFIDENCE rather than the value: widen the band, or withhold
the absolute number, in that region. That requires no new evidence and no
calibration change.

**STATE OF THE FOUR CLAIMS, SETTLED:**
- **Tailed ~0.0228** — strongest-supported output. Proxy 0.1645 sits 90%
  of the way up the bracket between the two real TN-614 knots (9.0% below
  the upper in proxy, 3.5% in pressure): interpolation inside measured
  points, not extrapolation. Still the idealised CLOSED surrogate, not the
  physical pneumatic/cable/fabric tail.
- **Bare ~0.178** — plausible high-Re screening estimate, sphere-adjacent
  in sectional geometry, independently unvalidated.
- **TR-291** — clean falsification of the existing map for absolute
  fat-faired Cd; thereafter development data, spent as a blind test.
- **A(0.7L)/Amax** — strongest candidate descriptor on numerical-stability
  grounds; not an earned aerodynamic correction.

**EVIDENCE WORDING, CORRECTED.** Do NOT say the streamlined region is
"independently validated three times". TN-614's endpoints ARE two of the
calibration knots, so it underpins the calibration rather than
independently validating it. Correct form: *the streamlined region has
multiple experimental supports — the independent Akron check, the held-out
TR-291 slender end, and the TN-614 family that underpins its calibration
(plus four TN-614 interpolation-evidence bodies).*

### RETRACTION: "MONOTONICITY FALSIFIED / NO 1-D MAP CAN WORK" WAS REYNOLDS-CONFOUNDED (2026-08-19)

Owner asked whether the fix could simply be reading the area curve's local
steepness at fixed stations rather than summing it. Testing that produced
a negative result, and chasing the negative result exposed a confound in
this ledger's own strongest claim. Both are recorded here.

**A. THE MECHANISM FINDINGS ARE REAL** (`scoreSections`, src/sections.js):
- The aft walk scores each station as `min(1, (slope/tan30°)^4) · dA`.
  It DOES measure local steepness — but it SATURATES at 30°. Measured
  dA-weighted saturation: **C-class 58.6%, sphere 73.9%, Sunship 72.2%**
  of shed area sits at the cap, where every slope scores identically.
  Mean closure angles are 36.3° / 44.6° / 40.6° — a spread that is
  roughly the attached-vs-separated boundary, and the metric cannot see
  it.
- The sum carries no dependence on station index, so WHERE the area is
  shed is discarded. The positions differ sharply: C-class sheds 10.3% of
  its area in 25–50%L; the sphere and Sunship shed **nothing** before 50%.

**B. BUT FIXING EITHER DOES NOT RESTORE THE ORDERING.** Four variants
scored against the four measured bodies:

| variant | C-class | prolate | sphere | oblate | orders correctly? |
|---|---|---|---|---|---|
| cap 30° (live) | 0.707 | 0.599 | 0.816 | 0.890 | **no** |
| cap 60° | 0.196 | 0.154 | 0.349 | 0.489 | **no** |
| smooth, non-saturating | 0.568 | 0.482 | 0.719 | 0.809 | **no** |
| position-weighted | 0.584 | 0.540 | 0.706 | 0.757 | **no** |

Every variant still puts the C-class ABOVE the prolate, whose measured
pressure is 3.4× higher. Un-saturating and position-weighting both move
the numbers substantially and neither changes the ordering.

**C. WHICH FORCED A RE-EXAMINATION — AND THE ORDERING CLAIM IS
CONFOUNDED. RETRACTED AS STATED.** The "monotonicity falsified, therefore
no monotone 1-D map of the proxy can fit the fat region" argument compared
**two different datasets at Reynolds numbers differing 5.3×**:

- E2 prolate, pressure 0.213, at **Re_d 44,000** (1923)
- C-class f.r. 1.0, pressure 0.063, at **Re_D 233,000** (1928)

233,000 sits directly at the lower edge of the declared crisis window
(2.5e5), in a 1928 tunnel whose freestream turbulence would lower the true
critical Reynolds further. The two bodies may simply not be in the same
flow regime, which would explain an ordering inversion with no shape
ambiguity involved at all. **That confound was absent from the claim and
should not have been.**

**AND THE CONTROL CONFIRMS IT.** Within TR-291 alone — eight bodies, one
tunnel, one campaign, all at the SAME Re_D — the proxy orders the fat
group's implied measured pressures **correctly and monotonically**
(0.196→0.0023, 0.324→0.0084, 0.475→0.0221, 0.707→0.0632). The violation
appears ONLY across datasets. Within a constant-Re dataset the proxy
behaves.

**D. WHAT SURVIVES, AND IT IS STILL SERIOUS.** The over-prediction itself
is regime-proof:

| | pressure at proxy 0.707 | vs measured 0.063 |
|---|---|---|
| subcritical line | 0.3385 | 5.4× |
| **HIGH-Re line (the map's FLOOR)** | **0.1533** | **2.4×** |
| high line vs laminar-friction bound | 0.1533 | 1.9× |

Blend = 1 is the lowest value the map can produce for this body at any
Reynolds number. It is still ~2× over. **No regime choice reproduces the
measurement**, so the level error in the fat region is real and is not a
crisis-window artefact.

**E. REVISED CONCLUSIONS.**
- **STANDS:** the map over-prices fat faired bodies by ~2× minimum, and no
  Reynolds regime choice explains it away.
- **STANDS:** the slender end passes; within-dataset ordering works.
- **RETRACTED:** "no monotone one-dimensional map can fit the fat region."
  The evidence for that was a cross-dataset, cross-Reynolds comparison.
  **Whether a 1-D map suffices in the fat region is now OPEN, not settled.**
- **THEREFORE ALSO SOFTENED:** "a new knot is the wrong fix." If the defect
  is a LEVEL error rather than an identifiability failure, better fat
  anchors could genuinely help. That possibility was closed off too early.
- **STANDS:** the saturation and position-blindness findings, as mechanism
  — they are real properties of the scorer whatever the calibration does.

**F. THE DATA REQUIREMENT IS NOW MUCH SMALLER, AND SHARPER.** The earlier
call for "8–12 fat bodies across several closures" assumed an
identifiability failure that is no longer established. What the record
actually needs first is a **CONTROLLED COMPARISON**: an ellipsoid and a
faired teardrop of similar fineness, in the SAME tunnel at the SAME
Reynolds number. Two or three bodies, one run. That single experiment
decides whether the fat region needs a second axis at all, or merely
better-placed anchors — and it is a far cheaper question to answer than
the one this ledger was proposing an hour ago.

Estimator untouched throughout. TR-291 remains held out for calibration,
though spent as a blind descriptor test (§ earlier admission).

### CLOSURE CENTROID IMPLEMENTED — AND IT FOUND SOMETHING WE WERE NOT LOOKING FOR (2026-08-19)

External implementation brief adopted over this ledger's earlier A(0.7L)
proposal. It is better on three counts and the numbers confirm all three.
`closure-centroid.mjs`, diagnostic only, nothing consumed by the engine.

**DEFINITION** (no fitted constants, no argmax, no magic station): from
a_i = A_i/A_max, take the backward monotone envelope, shed_i = env_i −
env_{i+1}, and report the first moment `SUM(u_i·shed_i)/SUM(shed_i)`.
Because the backward envelope sets env[0] = 1 for every body, shedding is
automatically zero ahead of the maximum section — the descriptor never has
to LOCATE the max, which was the instability A(0.7L) dodged rather than
solved.

**CONVERGENCE — the best of anything tested.** Five lathe resolutions:
C-class 0.7496 / 0.7497 / 0.7498 / 0.7494 / 0.7498; Akron 0.7959 / 0.7959
/ 0.7961 / 0.7956 / 0.7960. **~0.05% spread**, against A(0.7L)'s 0.34% and
x_max's 4.7%.

**IT DISCRIMINATES.** TN-614's six bodies — same fineness 5, deliberately
different closures — span **0.710 → 0.830**, ordered with their proxies
and their measured drag. C-class 0.749. And all three fat anchors read
**0.8311 exactly**, confirming for the third time that sphere, prolate and
oblate are one geometry.

| body | proxy | centroid | early/mid/late shed |
|---|---|---|---|
| TN614-111 | 0.018 | 0.710 | 0.40 / 0.39 / 0.16 |
| TN614-332 | 0.182 | 0.830 | 0.15 / 0.33 / 0.51 |
| TR-291 C-class (all 8) | 0.707 | 0.749 | 0.28 / 0.27 / 0.35 |
| Akron | 0.091 | 0.796 | 0.22 / 0.39 / 0.39 |
| sphere / prolate / oblate | 0.60–0.89 | **0.8311** | 0.17 / 0.32 / 0.51 |
| **Sunship BARE** | 0.770 | **0.8318** | 0.13 / 0.39 / 0.48 |
| **Sunship TAILED** | 0.164 | **0.5833** | 0.34 / 0.17 / 0.09 |

**FINDING 1 — THE PROPOSED RESIDUAL TEST CANNOT RUN ON THIS CORPUS.** The
brief's key step is "check whether the current estimator's residuals
correlate with the descriptor". They cannot be correlated, for a
structural reason:

- **closure VARIES** in the slender regime — TN-614, six distinct values
  spanning 0.120 — where the residuals are ~0–3%, i.e. nothing to explain;
- **residuals are LARGE** (2–5×) in the fat regime — where closure takes
  essentially TWO values, 0.749 (C-class, all eight identical by
  construction) and 0.8311 (all three anchors identical by mathematics).

The variance and the residual are in different places. No amount of care
extracts a correlation from that, and it is the same "controlled
comparison missing" conclusion arriving by a third independent route.

**FINDING 2 — WHAT IS ANSWERABLE TODAY, AND IT IS NEW: A DOMAIN-OF-VALIDITY
CHECK.** Calibrated closure range across every body the map is built on:
**[0.7103, 0.8311]**.

- **Sunship BARE, 0.8318** — sits essentially exactly ON the ellipsoid
  anchors (0.8311, a 0.08% difference). The binary in/out test calls this
  "outside" but that is the test being too crude: it is AT the boundary,
  and it corroborates for the fourth time that the bare hull is an
  ellipsoid-class closure priced against ellipsoid-class anchors.
- **Sunship TAILED, 0.5833** — **substantially OUTSIDE**, 18% below the
  bottom of the entire calibrated range. Nothing in the corpus closes as
  gradually as the deployed configuration does.

**THIS QUALIFIES A REASSURANCE GIVEN EARLIER IN THIS SESSION.** The tailed
figure was described as the best-supported output because its PROXY
(0.164) interpolates inside the measured TN-614 bracket [0.018, 0.182].
That remains true and is unaffected. But in the CLOSURE dimension the
tailed configuration extrapolates further from the corpus than the bare
hull does. Two honest observations follow:

1. the current estimator does not read closure at all, so this changes no
   present number;
2. it does mean the tailed configuration has an unchecked dimension of its
   own. The direction is probably benign — it extrapolates toward GENTLER,
   more gradual closure than anything measured, which is the
   less-separation direction — but "probably benign" is not "validated",
   and it should not be described as fully anchored without this caveat.

**REVISED WORDING FOR THE TAILED CLAIM:** *Cd 0.0228 interpolates between
two real wind-tunnel knots in the proxy dimension, which is the dimension
the estimator actually uses. In the closure dimension it extrapolates
beyond every calibration body, toward gentler closure. That dimension is
currently unread by the engine and unvalidated by the corpus.*

**STATUS.** Descriptor implemented, converged, and shown to discriminate.
Not calibrated, not consumed, no production change. TR-291 unspent for
calibration. The corpus cannot yet earn this descriptor a place in the Cd
path — the controlled comparison is still the blocking experiment.

### CURVE-FINGERPRINT ARCHITECTURE ASSESSED — AND IT REVERSES WHICH CONFIG IS THE SHAKY ONE (2026-08-19)

Proposal: stop using the 128-point curve as a regression input (hopeless
on this corpus) and use it as a SHAPE-FAMILY CLASSIFIER, routing a body to
whichever measured family it resembles, then pricing with that family's
low-dimensional calibration. Classify first, price second.

**THE PROPOSAL IS SOUND, AND THIS SESSION ALREADY PROVED IT IN MINIATURE.**
The Sunship-vs-C-class RMS curve comparison run earlier today IS this
method, and it produced the most decision-relevant result of the exam —
it is what rescued the bare-hull figure. What follows promotes it from an
ad-hoc diagnostic to an assessed architecture.

**IT DEMONSTRABLY CARRIES MORE INFORMATION THAN THE SCALAR:**

| | proxy distance | curve distance |
|---|---|---|
| Sunship ↔ sphere | 0.046 | **0.037** |
| Sunship ↔ C-class | 0.063 | **0.177** |

The scalar rates both roughly equally close; the curve separates them by
5×. That is the TR-291 failure restated as an information-loss statement:
the discriminating information existed and was discarded before the drag
evidence was selected.

**AND THE FINGERPRINT IS MEANINGFUL, NOT NOISE:** Akron ↔ TN614-222 =
0.022 — an independently-defined real airship hull and a 1938 wind-tunnel
body land almost on top of each other. The metric groups bodies the way an
aerodynamicist would.

**PROBLEM 1 — THE CORPUS HAS NO FAMILIES TO ROUTE TO.** Within-family
spreads: ELLIPSOID 0.000 (three members, mathematically one curve), TN614
**0.199** (six members). The TN-614 "family" is internally more scattered
than the entire C-class↔ellipsoid separation of 0.167. So the corpus is
**one degenerate cluster plus eight effective singletons**, not a set of
families. Routing needs destinations that do not currently exist.

**PROBLEM 2 — each family still needs its own proxy→Cd line.** Only the
ellipsoids and the C-class offer multiple proxy values with measured drag;
one is the held-out exam and the two were measured 5.3× apart in Reynolds
(the confound retracted earlier today). So today the architecture would
have ONE usable destination plus "unknown".

**PROBLEM 3 — inherited blindness.** Two bodies with identical A(x) and
different cross-section shape (round vs square) are indistinguishable to
any A(x) fingerprint. The risk is worse than for the scalar: a confident
family match could give confident wrong pricing where the scalar was
merely vague. Any implementation must keep the existing mechanism
classifier upstream, not replace it.

**THE FINDING THAT MATTERS — IT REVERSES WHICH CONFIGURATION IS EXPOSED.**
Run honestly on today's corpus:

- **Sunship BARE — CONFIDENT MATCH.** Nearest neighbour sphere at 0.037,
  farthest 0.211. Routes cleanly to the ellipsoid family, which has real
  measured anchors. **This SUPPORTS the 0.178**, a fifth independent
  corroboration.
- **Sunship TAILED — NO MATCH.** Nearest neighbour is TN614-111 at
  **0.202**, which is FURTHER than the TN-614 family's own internal spread
  (0.199) and further than the inter-family distance (0.167). Under the
  proposal's own rule this is "far from all known families → weak
  confidence, do not overclaim."

**So the classifier would flag the DEPLOYED configuration, not the bare
hull.** That inverts the characterisation used throughout this session.

**PROPORTION, HONESTLY.** The tailed body is a hull-plus-216 m-tail
compound; being unlike a corpus of simple bodies is partly unsurprising.
And it is unlike them in the GENTLER, more drawn-out direction — the
low-separation side. This AGREES with the closure-centroid result
(0.5833 against a calibrated range starting at 0.7103). **Two independent
measures now concur: the deployed shape extrapolates toward gentler
closure than anything ever measured.** Its PROXY still interpolates inside
the measured TN-614 bracket, which is the only dimension the engine reads,
so no present number changes.

**REQUIRED WORDING GOING FORWARD:** the tailed Cd 0.0228 is
best-supported *in the dimension the estimator actually uses*, and
unprecedented in the two dimensions it does not. Both statements must
travel together.

**WHAT IS DELIVERABLE TODAY, UNCHANGED BY ALL OF THE ABOVE:** the "far
from every known family → weak confidence" gate. It needs no calibration,
no new data, and no second axis in the Cd path — only a distance
computation against stored reference curves. It is the single highest-value
piece of this architecture and the only piece the corpus can currently
support.

Nothing calibrated, nothing consumed, estimator untouched.

### FOUR CORRECTIONS ACCEPTED, AND THE NOVELTY SCORE REBUILT PROPERLY (2026-08-19, close of session)

**CORRECTION 1 — "this supports the bare 0.178" was too strong.** Curve
similarity supports the *choice of aerodynamic family* for the bare
Sunship — it routes toward the sphere/ellipsoid side rather than the
C-class side. That makes 0.178 more DEFENSIBLE. It does not independently
validate the Cd value, and nothing in this session does.

**CORRECTION 2 — "five independent corroborations" was inflated.** The
max-section location, the RMS area distance, the closure centroid, the six
screened descriptors and the fingerprint distance are five geometric
SUMMARIES OF ONE UNDERLYING FACT: the bare Sunship's area evolution is
ellipsoid-like. Metrics agreeing is robustness against measurement
artefact; it is not five experiments. Correct wording: **one fact,
measured five ways, robustly.**

**CORRECTION 3 — the ~0.2 novelty threshold was arbitrary, and is
REPLACED.** Using TN-614's internal spread as the cutoff is unfounded: a
deliberately diverse family inflates the threshold. The proper score is
the distribution of LEAVE-ONE-OUT NEAREST-NEIGHBOUR distances among the
reference bodies — the corpus's own natural scale.

| body | LOO-NN | nearest |
|---|---|---|
| Akron | 0.0221 | TN614-222 |
| TN614-222 | 0.0221 | Akron |
| TN614-111 / 211T | 0.0460 | each other |
| TN614-221 / 121T | 0.0484 | each other |
| TN614-332 | 0.0616 | TN614-222 |
| C-class | 0.0763 | TN614-221 |
| sphere / prolate / oblate | 0.0000 | degenerate — one curve, excluded |

**Non-degenerate corpus scale: min 0.0221, median 0.0460, max 0.0763.**

- **Sunship BARE — NN 0.0374 = 0.49× the corpus maximum, BELOW its
  median.** Comfortably inside the corpus's own scatter. **Not novel.**
- **Sunship TAILED — NN 0.2023 = 2.65× the corpus maximum.** **Novel,
  beyond anything measured.**

The principled score SHARPENS the earlier finding rather than softening
it: the separation is now 0.49× against 2.65× of a scale derived from the
data itself, with no chosen constant anywhere.

**CORRECTION 4 — the build order was too eager.** Revised, and more
disciplined than the version this ledger proposed an hour ago:

1. **store** the normalised 128-point curve and the frozen diagnostics on
   every shape. Records only.
2. **build the novelty/distance score in the LAB**, not production. The
   threshold has only just acquired a principled basis and should be
   exercised before it gates anything user-visible.
3. **accumulate** measured/reference bodies. This is the long pole.
4. **only then** let curve similarity become a routing mechanism — once
   there are destinations to route to.

**SETTLED STATUS, ADOPTED VERBATIM:**
- **bare 0.178** — better CLASSIFIED, not validated.
- **tailed 0.0228** — strongly scalar-bracketed, geometrically novel.
- **full curve** — demonstrably valuable.
- **routing** — promising but premature.

**AND THE RIGHT READING OF THE TAILED RESULT — it is interesting, not
alarming.** The Smart-Tail surrogate appears MORE streamlined in its
sectional evolution than any historical body available. So historical
analogy weakens exactly where the design is deliberately trying to be
unusual. That is not evidence the scalar calibration is wrong there — the
proxy still interpolates inside the measured TN-614 bracket. It is a
principled reason the tailed figure deserves an eventual CFD or tunnel
challenge: **not because the calibration looks bad, but because the
geometry has moved beyond the measured corpus.**

**THE NARROWEST STATEMENT OF THE WHOLE SESSION'S FINDING:** the slicer is
not the problem, the 128-point representation is not the problem, and
geometry-based screening is not the problem. The lossy step is collapsing
a rich sectional history into ONE SCALAR before deciding which drag
evidence applies. That is an architectural limitation, and a fixable one.
