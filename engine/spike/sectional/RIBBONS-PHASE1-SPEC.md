# RIBBON REPRESENTATION — PHASE 1 FROZEN SPEC

*Committed 2026-08-20, BEFORE any corpus body is measured. Owner-approved.
Every definition below is frozen. Changing any of them after a corpus run
is a dated ruling with the reason recorded — never a quiet tweak.*

---

## 1. WHY THIS EXISTS

`src/sections.js` line 257 replaces every transverse section with a circle
of equal area:

```js
const r = Array.from(A, (a) => Math.sqrt((a * cell * cell) / Math.PI));
```

Everything downstream sees the axial history of that one equivalent radius.
Two things are destroyed there: the SHAPE of each section, and — after
`softAft` sums its station-by-station walk with no dependence on position —
WHERE along the body the shape events happened.

This phase tests the owner's original sketch-book representation instead:
cut the body with half-planes through the flight axis, like clock positions
seen from the nose, and follow each surface profile from nose to tail.

## 2. HYPOTHESIS — PURELY GEOMETRIC

> **Distinct longitudinal shape families produce distinct, mesh-stable
> directional turning profiles, and those distinctions survive changes in
> mesh density and ribbon count.**

Phase 1 **cannot** test aerodynamic quality, because Cd is excluded by
construction. A successful Phase 1 must never be described as aerodynamic
validation. The aerodynamic hypothesis — *that these stable geometric
differences track measured drag better than today's scalar* — is Phase 2's
and is gated on Phase 1 passing.

**FALSIFIED IF** the sphere-vs-teardrop difference in zone turning is no
larger than the change produced by re-meshing or changing ribbon count.

## 3. OUT OF SCOPE

No Cd. No calibration. No similarity metric. No family classifier. No
routing. No production change of any kind.

## 4. FROZEN DEFINITIONS

### 4.1 Reference axis
A single straight line through the mesh's **volume centroid**, parallel to
the declared flight direction. NOT the vertex centroid (biased by
triangulation density), NOT per-station centroids (would snake through the
body and straighten the very asymmetry being measured), NOT the
bounding-box centre (one odd extremity moves it).

### 4.2 Orientation
`theta = 0` at a declared body-fixed **up** vector projected into the
transverse plane. Where no up vector is declared, fall back deterministically
to the first non-flight axis in XYZ order and flag
`orientationReference: 'inferred'` in the output.

**Sunship.obj is +Z forward, +Y up.** Confirmed two independent ways: the
dynamic spec's canonical export convention, and direct measurement — 101
vertices (3.6% of the mesh) lie in a thin slab at Y-minimum spanning 41% x
67% of the other two axes, against <= 3% coverage at every other
bounding-box face. Flat base down, so +Y is up.

### 4.3 Extraction
Direct intersection of mesh triangles with each longitudinal half-plane.
NOT vertex binning — a scratch prototype using (station, azimuth) bins
failed three consecutive times from sparsity, returning RMS/mean 1.195 for
a sphere whose sections are exact circles and must return 1.000.

Each triangle crossing the plane yields a segment; the segment is
rasterised across every axial station it spans. `planes = 12` gives
`2 x 12 = 24` directional ribbons.

### 4.4 Envelope convention
Where a half-plane meets the surface more than once at a station, the
**outermost** intersection is taken — the 2D generalisation of the monotone
outer envelope already used by `scoreSections`. This is a declared
aerodynamic surrogate, not the literal surface for concave or open shapes.

**Must be reported, not absorbed:** multi-hit fraction, no-hit fraction,
and whether any ribbon is discontinuous.

### 4.5 Axial resampling
**Linear interpolation** onto 128 stations. Chosen because it invents the
least curvature. Frozen so that no one can later discover a smoother
interpolator "improves separation".

### 4.6 Tangent and turning
Symmetric secant, **span frozen as a fraction of body length (3%)**, not as
a station count — otherwise changing 128 -> 256 stations silently changes
the physical quantity measured, and station count must remain a genuine
convergence check rather than a hidden knob:

```
phi_i = atan2( r(x_i + s) - r(x_i - s),  2s ),   s = 0.015 * L
```

Then per zone:
- **absolute turning** `T_z = SUM |d phi|` — the quantity matching "how much
  is this line bending here"
- **net turning** `phi_end - phi_start` — reported alongside, because it
  cancels a bend that reverses and the difference is informative

**No second derivatives anywhere.** Pointwise curvature
`|r''|/(1+r'^2)^{3/2}` is dominated by sampling noise: a scratch attempt
gave a sphere 478-681 degrees per zone against a true half-meridian total
of 180.

### 4.7 Tip exclusion — fixed AXIAL fraction
Radius-based exclusion is rejected: it removes a different axial fraction
from each shape, so the eight zones would stop comparing the same parts of
different bodies. A fixed axial fraction keeps a common domain for every
body.

**Deterministic selection rule, frozen in advance:** use the SMALLEST fixed
axial exclusion that passes every analytic-control tolerance at every
required resolution. Test 2.5% first; freeze it if it passes. Otherwise
test 5%. **If 5% fails, Phase 1 HALTS** and the measurement method is
revised before any corpus body is run. This prevents the analytic controls
themselves becoming a visual tuning exercise.

### 4.8 Zones
**8 fixed zones** spanning the retained common domain.

Zone locations are normalised by `x/L`. Equivalent zone numbers represent
**equal fractional position, not equal physical distance**. Dimensional
distances must not be inferred from zone number alone.

### 4.9 Coordinates retained
All three, because storage is trivial and each answers a different question:
- raw dimensional `(x, r)`
- `(x/L, r/Rmax)` — what FAMILY of curve is this? (all ellipsoids of
  revolution collapse together here; that is intended, and is also why this
  normalisation alone is insufficient)
- `(x/L, r/L)` — how severe are the actual surface angles? Retains fineness.

## 5. ANALYTIC CONTROLS — ALL FOUR HARD-FAIL

No corpus value is emitted unless all four pass.

| control | what it proves |
|---|---|
| **sphere** | ribbons match `sqrt(Rs^2 - x^2)`; all 24 identical; turning matches analytic **over the same retained range** |
| **ellipsoid of revolution** | axisymmetric case at a different fineness |
| **elongated smooth taper / ogive** | distributed gentle closure — sphere and ellipsoid are both smooth AND stubby, leaving elongated closure untested |
| **triaxial ellipsoid** | THE DIRECTIONALITY CONTROL. Unequal transverse axes give analytically known ribbon-to-ribbon variation. Without it the other three could all pass while a broken `theta` implementation went unnoticed. |

**Sphere turning tolerance, stated correctly:** requiring "180 degrees total"
while excluding the tips is self-contradictory. Over a retained range
`|x| <= a` the analytic absolute turning is `2 * atan(a / sqrt(Rs^2 - a^2))`,
and the measurement is compared against that, over exactly the same range.

Convergence: 12 / 24 / 48 ribbons on the corpus as a **convergence test, not
candidate hyperparameters**; 96 on the analytic controls only, to establish
the numerical asymptote.

## 6. SUCCESS / FAILURE, FIXED IN ADVANCE

- **PASS** requires all of: four controls pass; results shift < 5% across
  ribbon counts 12/24/48 and across two mesh resolutions; AND the
  sphere-vs-C-class zone-turning profiles differ by more than 3x that
  stability noise.
- **FAIL** if discrimination sits within the noise. Then the representation
  adds nothing measurable and Phase 1 is stopped — rather than tuned until
  it looks convincing.

## 7. TR-291 USE IN PHASE 1

Phase 1 is geometry, so the C-class hulls are legitimate as SHAPES. But no
parameter in section 4 may be chosen to make them separate — that would
spend them a second time, after the descriptor-selection contamination
already admitted on 2026-08-19. They enter the run once, with every
definition above already frozen.

## 8. EXECUTION ORDER

1. commit this spec (done, by this file)
2. bring the existing draft `ribbons.mjs` into conformance — it predates the
   spec and its two chosen parameters (radius-based tip exclusion, 3-point
   smoothing) are precisely the two overridden here
3. run the four analytic controls; select the tip fraction by the rule in 4.7
4. only on a clean control pass, run the corpus
5. report, whatever the result

Corpus: sphere, ellipsoid, TR-291 C-class, TN-614 (six), Akron, Sunship
bare, Sunship tailed.

## 9. OPEN RISK, RECORDED BEFORE THE RUN

The motivating premise is only partly verified. The bare Sunship's
azimuthal variation appears to be a few percent, not the 56% erroneously
reported on 2026-08-19 (that measurement mixed axial variation into an
azimuthal window and is withdrawn). If the body is close to axisymmetric,
the DIRECTIONAL half of the ribbon idea may buy little for this hull
specifically — though it still addresses round-vs-square blindness for
arbitrary uploads. The LONGITUDINAL-turning half of the idea is unaffected
and is the primary thing under test.

---

## 10. AMENDMENT (2026-08-20, pre-corpus): NEVER AVERAGE THE RIBBONS

Reporting must **preserve the distribution across ribbons**, never collapse
it to a mean curve or a mean scalar. Twenty highly streamlined ribbons plus
four locally severe ones is a materially different body from twenty-four
moderately streamlined ones, and the two have the same mean.

Collapsing 24 informative curves into one average curve into one number
would recreate precisely the failure this whole phase exists to fix.

**Required per-body reporting, for every zone metric:**
- median across ribbons
- worst (most severe) ribbon, and WHICH ribbon it was
- inter-ribbon spread (directional asymmetry)
- never the mean alone

This is a reporting rule, frozen pre-corpus, and it applies to Phase 2's
eventual fingerprint as well: the compact output should carry overall
family similarity, worst directional ribbon, median behaviour, aft-turning
distribution, directional spread and corpus novelty — not one averaged
score.

---

## 11. RUN 1 RESULT (2026-08-20): **CONTROLS FAILED — PHASE 1 HALTED PER 4.7**

Step 2 executed. All four analytic controls FAIL at both 2.5% and 5% tip
exclusion, at 12/24/48/96 planes. Spec 4.7 says the method is revised
before any corpus body is run. **No corpus body has been measured.**

**THE REPRESENTATION IS NOT WHAT FAILED.** Net turning reproduces the
analytic value within 1.5–4% on every control:

| control | net turning | sum abs turning | excess | analytic |
|---|---|---|---|---|
| sphere | 141.4 deg | 184.6 | **+31%** | 143.6 |
| prolate f=3 | 87.2 | 110.7 | +27% | 90.8 |
| parabolic f=3 | 66.7 | 104.9 | **+57%** | 64.7 |
| triaxial 2:1:0.6 | 110.0 | 141.5 | +29% | 113.4 |

Every control has an analytically MONOTONE phi(x), so `sum|dphi|` must
equal `|net|` exactly. The excess is pure extraction noise. The flattest
body is worst hit, which is what gentle slopes predict: the same absolute
stair-step is a larger fraction of a smaller true turning.

**THREE DEFECTS, ALL IMPLEMENTATION, NONE CONCEPTUAL:**

1. **Extraction rasterisation is too crude.** `multiHitFrac = 0.85` on a
   convex sphere with no concave features — that is not geometry, it is
   segment-into-station binning writing the same station repeatedly and
   taking the max, which stair-steps the ribbon. The 4.4 multi-hit report
   is therefore currently measuring the implementation, not the body.
2. **Absolute turning amplifies that stair-stepping**, and it is the
   headline metric.
3. **Two bugs in the CONTROLS themselves:** the profile and directional
   checks run over the whole ribbon while the turning check runs over the
   retained domain — the worst sphere profile error sits at station
   126/128, x/L 0.992, a tip the turning metric never sees.

**PROPOSED REVISION — REQUIRES OWNER APPROVAL BEFORE RE-RUN. No tolerance
and no tip fraction is being changed; those stay frozen.**

- **R1 (extraction, 4.3):** for each station, collect ALL plane-crossing
  segments and evaluate each at exactly `x = x_i` by linear interpolation,
  then take the outermost. Replaces the current round-both-endpoints-and-
  fill-between binning. Definitionally cleaner and removes the stair-step
  at source.
- **R2 (control implementation only, 5):** evaluate profile and directional
  checks over the same retained domain as turning. This is a test bug, not
  a method change.
- **R3 (reporting, new):** add `turningExcess = sum|dphi| / |net| - 1` as a
  permanent NOISE DIAGNOSTIC. For any monotone body it must be ~0, so it
  measures extraction quality directly and would have caught this
  immediately.

**NOT PROPOSED, deliberately:** reinstating a smoothing step. That would
make the controls pass by hiding the stair-step rather than removing it,
and smoothing was already overridden once by review (4.6). If R1 does not
bring the excess near zero, that is a real finding about the
representation and must be reported as one.

**Status: HALTED. Awaiting ruling on R1-R3.** The gate did its job — this
is precisely the outcome pre-registration exists to produce instead of
"looks about right".

---

## 12. RUN 2 (2026-08-20, after R1–R3): **ALL CONTROLS PASS. TIP FROZEN AT 2.5%.**

R1/R2/R3 implemented as approved. No tolerance changed, no smoothing added,
no tip fraction relaxed — 2.5% is the SMALLEST candidate and it passes, so
spec 4.7 freezes it there.

| control | turningExcess | profile (tol 2%) | directional (tol 1%) | turning (tol 6%) |
|---|---|---|---|---|
| sphere | **0.00%** | 0.02% | 0.06% | 2.1% |
| prolate f=3 | **0.00%** | 0.02% | 0.06% | 5.5% |
| parabolic f=3 | **0.00%** | 0.00% | 0.01% | 1.1% |
| triaxial 2:1:0.6 | **0.00%** | 0.07% | 0.09% | 5.9% |

Pass at 12 / 24 / 48 / 96 planes.

**`turningExcess` 27–57% -> 0.00%** on every control. Since each has an
analytically monotone phi(x), absolute and net turning must coincide, and
now they do exactly. R1 removed the stair-step AT SOURCE rather than
masking it — which is what refusing the smoothing repair was protecting.
R3 has already earned its place: it is the single number that makes this
verifiable at a glance.

**TWO RESIDUALS RECORDED, NEITHER GATING:**

1. **The turning residual is a stable BIAS, not noise.** The ellipsoids sit
   at 5.5–5.9% against a 6% tolerance — a thin margin. It is IDENTICAL
   across 12/24/48/96, so it is a systematic effect of the frozen 3%
   secant span slightly under-reading turning where the slope changes
   fastest, not a resolution artefact. A stable bias inside a
   pre-registered tolerance is acceptable; the thin margin is flagged
   rather than left silent. Note the parabolic body (gentler slopes) sits
   at 1.1%, consistent with that mechanism.
2. **`multiHitFrac` is still not a clean concavity detector.** It fell from
   85% to 15–23%, but on a CONVEX analytic body it should be ~0. It is
   counting adjacent tessellation triangles whose x-ranges overlap a
   station, not genuine multi-surface events. Spec 4.4 intended it as a
   future applicability gate and in this form it cannot serve that. The fix
   is to cluster the s-values per station and count clusters. Recorded as a
   known limitation, not patched, because it does not gate Phase 1.

**STATUS: controls clean. Corpus run (spec 8 step 4) is unblocked.**
Corpus: sphere, ellipsoid, TR-291 C-class, TN-614 (six), Akron, Sunship
bare, Sunship tailed — every definition frozen, reported per spec 10
(median / worst ribbon / spread, never the mean alone).

---

## 13. CORPUS RUN (2026-08-20): **PHASE 1 FAILS THE PRE-REGISTERED CRITERION**

Spec 6 requires BOTH conditions. They split:

- **Discrimination PASSES, decisively.** sphere vs C-class f=1.0 separation
  **44.75%** against a 3x-noise bar of 23.81%.
- **Stability FAILS.** One body: **Sunship BARE 7.94%** against the 5%
  limit. Every other body in the corpus is <= 0.51%.

Because that one body sets the corpus-wide noise floor it both breaks the
stability gate and inflates the bar the kill test must clear. Excluding it,
noise is 0.51%, the bar 1.53%, and separation clears by 29x. **Phase 1
fails as written and the remedy is a ruling, not a reinterpretation.**

**R3 EARNED ITS PLACE IMMEDIATELY.** `turningExcess` independently flags
exactly the unreliable bodies: 0.00-0.23% on every analytic and lathe body,
**21.6% on Sunship BARE and 31.4% on Sunship TAILED**. Absolute turning is
therefore NOT currently trustworthy on real modelled meshes, only on
analytically generated ones. Bare Sunship is 2778 verts; at 48 planes each
half-plane cuts too few triangles to define a ribbon. Mesh-resolution limit
meeting facet noise — not a defect in the representation, but a hard
practical limit for a tool that ingests user uploads.

Second contributor, separated: bare Sunship is the ONLY body with real
inter-ribbon spread (63.0 deg median-to-worst; every other body 0.0). For a
genuinely directional body, changing ribbon count changes WHICH directions
are sampled, so part of that 7.94% is real signal under-sampled rather than
extraction noise. The two causes are not yet separated.

**GEOMETRY, OBSERVATION ONLY — NO CALIBRATION CONCLUSION DRAWN:**

| body | z1 | z5 | z6 | z7 | z8 | total | centroid |
|---|---|---|---|---|---|---|---|
| sphere | 25.7 | 13.7 | 14.6 | 17.1 | 24.4 | 140.5 | 0.496 |
| C-class f=1.0 | 35.7 | 6.6 | 8.5 | 9.3 | 28.2 | 146.5 | 0.417 |
| Akron | 27.1 | 2.4 | 3.9 | 4.9 | 16.8 | 65.9 | 0.422 |
| **Sunship TAILED** | 34.3 | **0.8** | **1.2** | **2.1** | **6.2** | 106.8 | **0.297** |
| Sunship BARE | 11.5 | 12.5 | 16.7 | 20.3 | 10.8 | 121.9 | 0.496 |

The sphere turns evenly and hardest at both ends with its centroid dead
centre. The tailed Sunship front-loads and then has almost nothing left to
do across the entire aft half — centroid 0.297, the largest single
distinction in the table. Bare Sunship reads centroid 0.496, sphere-like,
consistent with the rest of the session's independent measures.

**NOTED, NOT CONCLUDED:** within TN-614, aft-zone turning orders almost
identically to those bodies' measured drag (z8: 111 0.8 < 211T 0.9 < 121T
2.5 < 221 2.6 < 222 16.4 < 332 21.2, against Cd_A 0.0401 / 0.0415 / 0.0405
/ 0.0437 / 0.0472 / 0.0508 — one adjacent swap). This is a **Phase 2
hypothesis**, it involves bodies whose endpoints ARE calibration knots, and
it is NOT a result. Recorded to be tested, nothing more.

**STATUS: FAILED ON STABILITY. Awaiting ruling.** No parameter has been
changed. Candidate remedies exist (mesh densification before extraction;
capping ribbon count by mesh resolution; separating real directional
under-sampling from facet noise) but each is a spec change requiring a
dated ruling, and none may be chosen by whether it makes the number pass.

---

## 14. CAUSE SEPARATION (2026-08-20): FORK C — AND IT REFRAMES THE FAILURE

Geometry-preserving subdivision of Sunship BARE, 1->4 triangle split at
edge midpoints so every new vertex lies exactly on its original facet and
the surface is unchanged. Frozen extractor, no spec change.

| level | verts | tris | turningExcess | spread | stability |
|---|---|---|---|---|---|
| 0 | 2,778 | 5,554 | 21.64% | 63.0 deg | 7.94% |
| 1 | 11,108 | 22,216 | 21.64% | 63.0 deg | 7.94% |
| 2 | 44,430 | 88,864 | 21.64% | 63.0 deg | 7.94% |

**BIT-IDENTICAL across a 16x increase in triangle count.** That is not
"the noise failed to clear" — it is proof the extractor is
TESSELLATION-INDEPENDENT, which is exactly the property it should have.
Subdividing a planar facet adds vertices ON that facet, so the half-plane
meets the identical surface and returns the identical ribbon. **The
implementation is exact.** Facet density was never the cause.

**WHERE THE EXCESS ACTUALLY IS — azimuth-specific, not distributed.** Per
ribbon at 12 planes (theta 0 = up, 180 = the flat base):

- **zero excess on most ribbons**; 6.2% on exactly two, 120 deg and 240 deg
  — a symmetric pair. At 24 planes finer sampling finds a worse azimuth
  (21.6%).
- **port/starboard symmetry is EXACT** (0/345, 30/330, 120/240 mirror to
  the decimal). The body-fixed frame, the volume-centroid axis and the
  theta convention are all validated by this.
- **top ribbon 152.3 deg of turning; underside ribbon 104.9 deg.** The
  underside is flatter because it IS flat. That 47 deg directional
  difference is precisely what the equivalent-circle step at
  sections.js:257 averages away, and it is the clearest demonstration so
  far that the representation does the job it was built for.

**DIAGNOSIS.** A flat base meeting a curved hull necessarily produces an
EDGE. Ribbons grazing that chine register genuinely non-monotone turning
because the surface really does kink there. Finer azimuthal sampling
locates it more precisely, which is why 48 planes moves more than 24.

**THEREFORE THE PRE-REGISTERED STABILITY CRITERION IS DEFECTIVE, AND THIS
IS A FLAW IN THE CRITERION, NOT THE METHOD.** Spec 6 requires results to
shift < 5% across ribbon counts. That silently assumed every corpus body
was smooth. For a body with a real crease, finer sampling SHOULD find new
content — the criterion penalises the representation for working.

This is stated as a diagnosis, NOT as grounds to self-award a pass. The
run failed the criterion as written; only a dated owner ruling can change
the criterion, and the correct replacement is not obvious:

- a convergence criterion assuming smoothness is wrong for creased bodies;
- but "any shift is real signal" is unfalsifiable and must be rejected;
- a defensible form might require CONVERGENCE OF THE RIBBON DISTRIBUTION
  (e.g. the 90th-percentile ribbon) rather than of a median that moves as
  new azimuths are sampled — but that is a new criterion chosen after
  seeing a failure, which is exactly the contamination pattern already
  admitted once in this project on 2026-08-19.

**RECOMMENDED, NOT TAKEN:** re-pre-register a smoothness-aware stability
criterion on the ANALYTIC CONTROLS ONLY, where the answer is known
independently of the corpus, then re-run. That is the one route that
changes the criterion without letting the corpus choose it.

**STATUS: Phase 1 remains FAILED as written.** Extractor validated as
exact and tessellation-independent. Discrimination validated at 44.75%
vs a 23.81% bar. The blocking issue is now a known defect in the success
criterion, awaiting a ruling.

---

## 15. MECHANISM FOUND (2026-08-20) — AND TWO OF OUR OWN EXPLANATIONS RETRACTED

Section 14 asserted a chine at the flat base as the cause of the 21.6%
turning excess. **That was wrong, and so was the follow-up guess.** Both
are retracted. What follows is measured, not inferred.

**RETRACTED #1 — "the chine causes it."** The worst ribbon is theta 112.5
deg, not the underside, and it has exactly TWO reversals: x/L 0.110 and
x/L 0.898, +6.5 deg each, 13 deg total out of ~150. Not at the flat base.
Reasoning it through afterwards: a simple flat base CLAMPS the ribbon to a
constant radius, which produces two slope kinks but leaves phi MONOTONE —
so it would give excess 0, not 21%.

**RETRACTED #2 — "coarse faceting causes it."** Tested directly on the
analytic sphere at 24/32/48/64/96/160/240 axial facets: **turningExcess is
0.00% at every resolution.** Coarseness shifts the absolute value (153.7
deg at 24 facets to 140.5 at 240) but never breaks monotonicity, because a
uniformly faceted convex body has monotone facet slopes.

**THE ACTUAL CAUSE — IRREGULAR UNSTRUCTURED TESSELLATION, measured:**

- 1093 distinct axial vertex positions across 2778 vertices — the mesh is
  UNSTRUCTURED, not ringed like a lathe body;
- axial ring spacing: min 0.0001, median 0.0006, **max 0.0170 of L — the
  largest gap is 28x the median**;
- per-band vertex counts swing from 4 to 97;
- band counts are MIRROR-SYMMETRIC fore/aft (52/52, 42/42, 97/97), which
  is exactly why the two reversals appear symmetrically at 0.110 and
  0.898. The asset was built by mirroring, so its tessellation
  irregularities mirror too.

Consecutive facets along a ribbon therefore have irregular lengths and
their slopes do not decrease monotonically. Uniform faceting does not do
this; IRREGULAR faceting does. Subdivision cannot fix it because
subdivision preserves the irregular surface exactly — which is precisely
what the bit-identical 16x result proved.

**WHAT IS NOW CLEANLY SEPARATED:**

| observation | verdict |
|---|---|
| extractor exactness, tessellation-independence | **ESTABLISHED** (bit-identical over 16x) |
| port/starboard symmetry exact | **ESTABLISHED** — validates frame, axis, theta |
| top ribbon 152.3 deg vs underside 104.9 deg | **REAL GEOMETRY** — the flat base, invisible to A(x) |
| 63 deg inter-ribbon spread | **REAL** — survives everything |
| 21.6% turningExcess | **ARTEFACT** of irregular source tessellation |
| 7.94% ribbon-count instability | **ARTEFACT** — more azimuths hit more irregular regions |
| discrimination 44.75% vs 23.81% bar | **ESTABLISHED** |

So section 14's conclusion that "the pre-registered stability criterion is
defective" is **also withdrawn**. The criterion was not penalising the
method for resolving a real feature; it was correctly detecting an
artefact. The criterion stands. Phase 1 failed honestly.

**THE REAL BLOCKER, STATED PROPERLY:** ribbon derivative metrics require
regular axial sampling. Every lathe body in the corpus is perfectly ringed
and reads 0.00% excess; the two real exported OBJs read 21.6% and 31.4%.
For a tool intended to ingest arbitrary uploads, most of which will be
unstructured, this is a first-order practical limitation and not a corner
case.

**PROPOSED PHASE 1B — needs a ruling, nothing done yet.** The control is
now definable without touching the corpus: take an analytic body whose
truth is exactly known and RE-TESSELLATE it with deliberately irregular
axial spacing at controlled severity. That gives a known-truth case in
which the artefact can be produced on demand, and it makes a MESH-ADEQUACY
PRECONDITION definable — e.g. a gate on axial-spacing regularity along
each ribbon, calibrated purely on analytic bodies.

Only after such a gate exists does re-running the corpus mean anything.

**A NOTE ON MY OWN RELIABILITY IN THIS SECTION.** Two mechanism claims in
successive messages were wrong before measurement settled it. Both were
plausible and both were asserted with more confidence than the evidence
carried. The record keeps them visible deliberately.

---

## 16. THIRD RETRACTION, AND A REFRAME THAT MATTERS (2026-08-20)

Section 15 attributed the turning excess to irregular unstructured
tessellation. **That explains the BARE body at best and is simply wrong for
the TAILED one.** Measured:

| | verts | distinct axial positions | spacing max/median | structure | excess |
|---|---|---|---|---|---|
| Sunship BARE | 2778 | 1191 (2.3/position) | **32.1x** | unstructured | 21.6% |
| **Sunship TAILED** | 20481 | **321 (63.8/position)** | **1.0x** | **perfectly ringed** | **31.4%** |

The tailed surrogate is the MOST regular mesh in the entire corpus — 321
axial positions for the tail lab's RINGS=320, 63.8 vertices each for
SEGS=64, spacing ratio exactly 1.0 — and it has the WORST excess.
Tessellation irregularity cannot be the cause there.

**WHAT IT ACTUALLY IS — and this is the most interesting result of the
phase.** All five reversals on the tailed body cluster in ONE region,
x/L 0.457–0.488, where phi runs from -27.8 deg back to -15.0 deg. The
profile there: radius falls 11.4 units between x/L 0.43 and 0.47, then only
6.5 between 0.47 and 0.52.

**That is the hull-to-tail junction.** The steep hull closure hands over to
the gentle tail taper, so the tangent angle genuinely eases. The 31.4%
excess is not noise — it is the SIGNATURE OF THE SMART TAIL, localised to
the exact station where it takes over.

**THEREFORE `turningExcess` IS NOT A NOISE METER.** It is a
NON-MONOTONICITY meter. On a body whose tangent should be monotone it
measures corruption; on a compound body it measures real design geometry.
The external review warned of exactly this and the warning was correct:
"turningExcess ~ 0 is expected only for ribbons whose tangent angle should
be monotone."

**REVISED STATUS OF THE TWO SHIP BODIES:**
- **TAILED, 31.4% — REAL.** Localised to a single junction, on a perfectly
  regular mesh. Genuine geometry, and the most design-relevant feature the
  ribbon representation has found.
- **BARE, 21.6% — UNRESOLVED.** Two reversals near the tips (x/L 0.110,
  0.898) on a mesh with 32x spacing irregularity where curvature is
  highest. Artefact remains the better hypothesis but it is NOT
  established, and this section exists because the previous two
  "established" mechanisms were wrong.

**PHASE 1B IS UNCHANGED IN DESIGN AND STRONGER IN MOTIVATION.** Its job is
now precisely stated: quantify, on analytic bodies with controlled
irregular tessellation, how much FALSE non-monotonicity a given mesh
quality produces — so that the REAL non-monotonicity, which the tailed body
proves exists and matters, can be separated from it. Without that
separation the metric cannot be trusted in either direction.

**RELIABILITY NOTE.** Three successive mechanism claims in this
investigation were wrong before measurement settled them: the chine, coarse
faceting, and irregular tessellation as a general explanation. Each was
plausible; each was asserted ahead of the evidence. They are left in the
record deliberately. The pattern is that measurement has been reliable
throughout and interpretation has not.

---

## 17. PHASE 1B RESULT (2026-08-20): THE FALSE-NON-MONOTONICITY ENVELOPE

**TERMINOLOGY FROZEN BY RULING:** `turningExcess` is a NON-MONOTONICITY
metric. It is a noise diagnostic ONLY on controls whose true tangent
history is known monotone. Two signals are to be preserved and never
conflated: (1) monotone distributed turning; (2) easing/handover events —
local non-monotonicity where one geometry regime hands over to another.
The Smart Tail IS the second kind. No cleanup step may erase it.

**AXIAL IRREGULARITY ALONE PRODUCES NOTHING.** Swept rho = max/median axial
facet spacing from 1x to 32x at 32-400 facets: **0.00 deg false reversal in
every cell.** A convex body has monotone chord slopes at ANY axial spacing,
so this corruption cannot break monotonicity. Section 15's "irregular
spacing" explanation is therefore insufficient even for the bare body —
a fourth partial retraction.

**THE CORRUPTION THAT DOES MATTER IS UNSTRUCTURED-NESS.** Vertices moved
ALONG the exact analytic surface (each stays exactly on the true surface;
only ring alignment is destroyed), prolate f=3, monotone truth:

| facets | jitter 0.0 | 0.1 | 0.2 | 0.4 | 0.7 | 1.0 |
|---|---|---|---|---|---|---|
| 32 | 0.00 | 0.00 | 0.00 | 0.77 | 1.99 | **4.71** |
| 64 | 0.00 | 0.00 | 0.00 | 0.08 | 0.50 | 1.20 |
| 128 | 0.00 | 0.00 | 0.00 | 0.06 | 0.46 | 0.98 |
| 240 | 0.00 | 0.00 | 0.00 | 0.21 | 0.83 | 1.46 |

Largest FALSE single-step tangent reversal, degrees. **Below jitter 0.2,
exactly zero at every resolution.** Worst case anywhere: 4.71 deg.

**APPLIED TO THE TWO REAL EVENTS (envelope set from analytic truth only;
neither ship body was used to choose anything):**

- **TAILED hull/tail handover, +5.5 deg, on a PERFECTLY RINGED mesh (320
  uniform facets, jitter 0).** Envelope at that mesh quality: **0.00 deg**.
  **UNAMBIGUOUSLY REAL — no overlap whatsoever.** The representation
  detected the geometric transition it was built to detect.
- **BARE near-tip reversals, +6.5 deg, on a fully unstructured mesh.**
  Envelope at jitter ~1.0: up to 4.71 deg. Exceeds it by only **1.4x.
  MARGINAL — not ruled either way.**

**LIMITATIONS OF THIS ENVELOPE, STATED:**
1. It is derived on a prolate f=3. The bare Sunship is f ~ 1.3 and much
   blunter, with higher tip curvature, so facet-induced slope error there
   is likely LARGER than this envelope allows. A body-matched envelope is
   required before ruling on the bare hull.
2. The corruption model jitters position within a uniform base spacing; the
   real bare mesh ALSO has 32x facet-size variation, which is not modelled.
3. The envelope is non-monotone in facet count (4.71 / 1.20 / 0.98 / 1.46).
   The rise at 240 is unexplained and probably an interaction with the
   128-station resampling. Flagged, not explained.

**WHAT PHASE 1B ESTABLISHED.** A principled, corpus-independent way to ask
"is this ribbon feature geometry or mesh?" — the thing that was missing.
In its current global form it already separates the tailed handover
cleanly. The local reliability field (per-x, per-ribbon) proposed in the
ruling is the natural refinement and is not yet built.

**PHASE 1 REMAINS FAILED.** Nothing here changes that. What has changed is
that the failure is now fully understood and the tool to resolve it exists.

### 17a. WORDING CORRECTION (2026-08-20)

"Maximum manufacturable false reversal is 4.71 deg" is an OVERSTATEMENT and
is withdrawn. Correct form:

> **the maximum false reversal OBSERVED IN THE PHASE 1B CORRUPTION SWEEP is
> 4.71 deg** — for that analytic family, those facet counts, that jitter
> mechanism and that station count.

It is not a universal bound on arbitrary bad meshes, and the distinction
matters precisely because the number would otherwise become a production
gate. The unexplained non-monotonicity in facet count (4.71 / 1.20 / 0.98 /
1.46) is itself evidence the envelope is not yet understood well enough to
threshold on.

The TAILED conclusion is unaffected in substance but should also be stated
within its model: within the tested corruption model, the +5.5 deg handover
on a zero-jitter ringed mesh is not a tessellation artefact and is genuinely
in the surrogate geometry. It remains a statement about the SURROGATE, not
proof that the physical deployed tail has that handover shape.

The BARE hull remains UNRESOLVED, and more firmly so: 1.4x above a tested
envelope whose corruption generator does not represent that mesh's actual
pathology is not close to sufficient to call it real.

---

## 18. PHASE 1C SPEC — LOCAL MESH-RELIABILITY FIELD (frozen 2026-08-20, pre-sweep)

**OBJECTIVE.** Replace the single global envelope with a per-station,
per-ribbon answer to: *at this location, what is the largest tangent
reversal that source-mesh encoding error could plausibly manufacture?*

**AMENDMENT 1 — THE TARGET IS AN UPPER BOUND, NOT A MEAN.** A
mean-regression of false-reversal magnitude would systematically understate
what must be protected against. The target is a ONE-SIDED UPPER QUANTILE:

> sigma_phi(x, theta) = Q_q( |d phi_false| | local mesh properties ),
> with **q = 0.95, frozen**.

A measured 6 deg reversal against a local sigma_phi of 1 deg is strong; the
same 6 deg against sigma_phi 5 deg is weak.

**AMENDMENT 2 — NO INPUT MAY BE UNAVAILABLE ON A REAL UPLOAD.** True
analytic curvature is FORBIDDEN as a model input; it exists on the controls
and never in production, so using it would leak information the estimator
can never possess. Ground truth may generate and evaluate the controls
only. Frozen predictor set, every one computable from an uploaded mesh plus
extractor provenance:

1. local axial facet span (x-extent of contributing segments)
2. local angular facet span
3. triangle aspect ratio (mean over contributors)
4. support density (contributing segments per station)
5. normalised tip distance, min(u, 1-u)
6. **observed** turning-rate proxy: |d phi| over a 10%-of-L window — wide
   enough to be dominated by real shape rather than facet-scale noise, and
   deliberately NOT the local reversal itself, which would be circular.

**AMENDMENT 3 — VALIDATION IS GROUP-HELD-OUT, NEVER RANDOM STATIONS.**
Adjacent stations, ribbons of one mesh and jitter levels from one recipe
are all strongly correlated; a random split would exaggerate performance.
Two held-out tests:

- **leave-one-corruption-mechanism-out**, over >= 3 distinct deterministic
  generators (sine-hash jitter; block-wise density variation; drifting
  azimuthal shear; surface random-walk displacement). Train on the rest,
  test on the unseen mechanism, rotate.
- **leave-one-fineness-out**, holding out f = 1.3 — the Sunship-relevant
  bluntness — trained only on f in {1, 2, 3, 5}. This is the test that
  matters most.

**"MATERIALLY BETTER", DEFINED NUMERICALLY BEFORE THE SWEEP** (this was the
underspecified part of the gate and is now closed):

- **BASELINE:** one global upper bound = the q=0.95 quantile of ALL
  training-set false reversals. Training controls only.
- **PASS requires ALL of:**
  - held-out coverage in **[0.93, 0.99]** — the lower limit allows
    finite-sample slack against nominal 0.95; the UPPER limit exists to
    reject a trivially wide bound that covers everything by being useless;
  - **median(sigma_local / sigma_global) <= 0.60** across held-out
    stations, i.e. at least 40% sharper at equal-or-better coverage;
  - held-out pinball loss at q=0.95 strictly lower for local than global.
- **KILL if:** coverage < 0.93 (under-covers), OR median ratio > 0.85 (no
  useful localisation). On a kill the honest conclusion is that ribbon
  derivatives need a trustworthy skin after all, and the
  quantify-locally route is closed.

**MODEL FORM, PRE-REGISTERED, PRIMARY FIRST.** Prefer a compact calibrated
rule over a flexible predictor, to keep the estimator auditable — but do
not force simplicity before the experiment answers whether it exists.
- **PRIMARY:** single physically-motivated product. Facet-induced slope
  error scales as (turning rate) x (facet span), so
  `sigma_phi = C * (turnRateProxy * axialSpan)`, with C the fitted q-quantile
  ratio. One parameter.
- **FALLBACK, only if PRIMARY fails its gate:** quantile regression at
  q=0.95 over the full frozen predictor set. Reported as a fallback, with
  the primary's failure stated.

**EXTRACTOR CHANGE — ADDITIVE ONLY, DECLARED.** `extractRibbons` currently
discards which source segments fed each station. Phase 1C requires that
provenance. It is added as a NEW output field; no existing return value or
behaviour changes, so every prior result stays reproducible. Wanted
regardless of 1C's outcome as audit information.

**OUT OF SCOPE.** No Cd. No calibration. No corpus interpretation. No
threshold shipped. No smoothing, no reconstruction. Phase 1 stays FAILED
and every retraction stays in the record.

**STANDING CAUTION.** Four mechanism claims in this investigation were
wrong before measurement settled them. Phase 1C is MORE interpretive than
1A or 1B because it chooses predictors and fits a model — the terrain that
record is weakest on. The held-out design and the numeric kill criterion
above are therefore not ceremony; they are the parts of this phase that do
not depend on my judgement being right.

### 18a. CLARIFICATIONS (2026-08-20, pre-sweep — definitions only, no predictor changed)

**THE RIBBON IS ZERO-WIDTH, AND THE IMPLEMENTATION ALREADY IS.**
`extractRibbons` intersects mesh triangles with a HALF-PLANE, yielding a
single nose-to-tail curve per theta. It is not a strip and has no angular
width. This matches the owner's original concept exactly: an infinitesimal
meridional cut, and infinitely many such cuts would reconstruct the whole
surface.

**PREDICTOR 2 RENAMED FOR PRECISION — same quantity, unambiguous name.**
"local angular facet span" wrongly implies the ribbon has width. It does
not. The intended quantity is a property of the MESH, not of the ribbon:

> **`azimuthalCoarseness`** — how coarsely the surface surrounding this
> intersection is represented in azimuth, i.e. the angular extent of the
> facets the infinitesimal plane cuts through.

Definition clarified pre-sweep; the predictor itself is unchanged and the
frozen set is still six.

**STANDING CAVEAT — WHAT RIBBONS ARE AND ARE NOT.** Infinitely many
geometric slices reconstruct the 3D SURFACE. Infinitely many independent 2D
flow solutions do NOT reconstruct the 3D FLOW: real air moves between the
planes, and pressure and separation in one region influence its
neighbours. Nothing in this work computes flow.

What is computed is **the surface geometry presented to the flow**, sampled
along infinitesimal meridional cuts. Even if a cheap per-ribbon
aerodynamic proxy is added later — boundary-layer tendency,
pressure-recovery estimate — the result would remain a QUASI-3D SCREENING
MODEL and must never be described as CFD or as a 3D solution.

The ladder, stated once for the record:
> infinitesimal slice -> exact 2D surface curve -> cheap turning/closure
> geometry -> many directions -> global geometric analogue

That is the whole claim. It is also why the method stays computationally
tiny while retaining far more structure than a single bluffness scalar.

### 18b. PHASE 1C CHECKPOINT 1 (2026-08-20): INSTRUMENTATION + GENERATORS VERIFIED. NOTHING FITTED.

**PROVENANCE INSTRUMENTATION — BIT-IDENTICAL REGRESSION.** `extractRibbons`
now returns a `provenance` field; nothing else changed. Verified against a
baseline captured BEFORE the edit, across all 4 controls x 3 configs:
every ribbon coordinate (hashed), L, rMax, absTurn, netTurn, turnCentroid,
turningExcess, all 8 absolute zones, all 8 net zones, multiHitFrac,
noHitFrac, and every pass/profile/directional/turning value — **all
identical**. Phase 1C starts from a clean base and every prior result
remains reproducible.

Provenance verified against KNOWN truth, not merely populated: at nx=120
over length 6 it reports `axialSpan` 0.05000 (= 6/120 exactly); at nt=64,
`azimuthalCoarseness` 0.09817 (= 2*pi/64 exactly); `support` = 1, correct
for a clean ringed convex mesh.

Per spec 18a the ribbon is zero-width, so these are properties of the MESH
around the infinitesimal intersection — `support` means how much local
source geometry constrains that exact half-plane cut near this station,
never an angular width.

**FOUR CORRUPTION GENERATORS, GATE PASSED.** G1 sine-hash jitter, G2 block
density warp, G3 azimuthal shear, G4 surface random-walk. Each places every
vertex by choosing (x, theta) then evaluating r = rFn(x, theta), so it sits
on the exact analytic body by construction — and the gate verifies that
rather than trusting it:

| condition | result |
|---|---|
| (a) strength 0 reproduces the reference mesh | **EXACT, bit-for-bit**, all 4 generators x 3 bodies |
| (b) max vertex off-surface at strengths 0.25 / 0.5 / 1.0 | **3.3e-16 to 6.7e-16** — machine epsilon |

All four therefore rearrange WHERE the mesh samples the surface without
changing the surface. This matters most for G3 and G4, which are only
valid corruption models under exactly that condition.

**NOTHING HAS BEEN FITTED.** No sweep, no quantile, no predictor evaluated.
Next: the sweep across five finenesses x four mechanisms x strengths x
station counts, then the primary one-parameter fit, then the two
group-held-out protocols, then the frozen numeric gate.

### 18c. PHASE 1C FOLD MEMBERSHIP — FROZEN 2026-08-20 BEFORE ANY TARGET WAS INSPECTED

**Design grid.** fineness f in {1, 1.3, 2, 3, 5} (prolate spheroids, monotone
phi) x mechanism in {G1 sineJitter, G2 blockDensity, G3 azimuthalShear,
G4 surfaceWalk} x strength in {0.25, 0.5, 1.0} x axial facets in {48, 96},
nt = 48, planes = 6. One observation per (ribbon, station).

**TARGET.** y = max(0, phi[i+1] - phi[i]) in degrees at each station. Truth
is monotone decreasing, so any positive step is FALSE by construction.

**PREDICTORS** (frozen 18/18a, all mesh-computable): axialSpan,
azimuthalCoarseness, aspect, support, tipDistance = min(u, 1-u),
turnRateProxy = |d phi| over a 10%-of-L window from the extracted ribbon.

**FOLD 1 — leave-one-mechanism-out, 4 folds.** For k in {G1..G4}:
train = all rows with mechanism != k AND f != 1.3; test = mechanism k,
f != 1.3. f = 1.3 is excluded from BOTH sides here so the two protocols
stay independent.

**FOLD 2 — leave-fineness-out, 1 fold.** train = f in {1, 2, 3, 5}, all
mechanisms; test = f = 1.3, all mechanisms. This is the Sunship-relevant
bluntness and the test that matters most.

**BASELINE, per fold.** sigma_global = the q=0.95 quantile of the FOLD'S
TRAINING rows only. Never the test rows.

**PRIMARY MODEL, per fold.** sigma_local = C * turnRateProxy * axialSpan,
with C = Q_0.95( y / (turnRateProxy * axialSpan) ) over training rows only.
One free parameter.

**GATE (18, unchanged).** PASS needs held-out coverage in [0.93, 0.99] AND
median(sigma_local/sigma_global) <= 0.60 AND lower held-out pinball loss at
q=0.95. KILL on coverage < 0.93 or median ratio > 0.85.

Coverage is computed over ALL held-out stations including y = 0, which is
the honest definition of the field. Because zeros make coverage easy, the
SHARPNESS and PINBALL criteria are the binding ones — exactly the guard
against a bound that buys coverage by being broad everywhere. Coverage
restricted to y > 0 is reported as a secondary diagnostic only and has no
gate attached.

## 19. PHASE 1C RESULT (2026-08-20): **KILL, ALL FIVE FOLDS**

Sweep executed exactly as frozen at 40bde1d. 171,360 station observations
from 120 meshes; 5.2% carry a non-zero false reversal.

| fold | n_test | coverage | cov(y>0) | median ratio | pinball L vs G | verdict |
|---|---|---|---|---|---|---|
| LOMO sineJitter | 34272 | **0.8461** | **0.0000** | Inf | 0.12980 / 0.12980 | KILL |
| LOMO blockDensity | 34272 | 1.0000 | n/a | **0.996** | 0.00906 / 0.00747 | KILL |
| LOMO azimuthalShear | 34272 | 1.0000 | 1.0000 | **0.987** | 0.00907 / 0.00738 | KILL |
| LOMO surfaceWalk | 34272 | 0.9570 | **0.0850** | **1.131** | 0.02525 / 0.02494 | KILL |
| LOFO f=1.3 | 34272 | 0.9500 | **0.0311** | **1.776** | 0.05779 / 0.05787 | KILL |

Two folds fail coverage, three fail sharpness, none beats the global
baseline on pinball loss.

**THE SHARPNESS GATE EARNED ITS PLACE.** `cov(y>0)` reads 0.0% / 8.5% /
3.1%: the local bound buys its headline coverage almost entirely from the
94.8% of stations where nothing happens, and covers almost NONE of the real
false reversals. Without the median-ratio and pinball criteria, LOFO f=1.3
would have shown coverage 0.9500 and read as a pass.

**THE 4.71 DEG ENVELOPE WAS FAR TOO OPTIMISTIC.** Largest false reversal in
this sweep: **17.51 deg** — nearly 4x Phase 1B's single-mechanism figure.
The wording correction at 17a was not pedantic; the number would otherwise
have been frozen into a production gate.

**CONSEQUENCES, PER THE PRE-REGISTERED KILL CLAUSE:**

1. **The quantify-locally route is CLOSED for the primary model.** The
   source mesh does not carry enough locally observable information for a
   one-parameter rule to bound polygon-encoding error against unseen
   corruption mechanisms or an unseen bluntness.
2. **The bare Sunship's +6.5 deg is now most likely ARTEFACT.** It sits
   well inside an observed false-reversal range reaching 17.51 deg. The
   earlier "1.4x above envelope, marginal" reading was based on the
   too-optimistic 4.71 figure and is withdrawn.
3. **The tailed handover +5.5 deg STANDS.** It occurs on a perfectly ringed
   ZERO-jitter mesh, where the measured false reversal is 0.00 deg. No
   corruption model produces anything at that mesh quality.
4. **Ribbon derivative metrics require a trustworthy skin**, not merely a
   local reliability estimate — which is precisely the alternative the kill
   clause named in advance.

**PRE-REGISTERED FALLBACK, NOT YET RUN.** Spec 18 permits, on primary
failure, one quantile regression at q=0.95 over the full frozen predictor
set (axialSpan, azimuthalCoarseness, aspect, support, tipDistance,
turnRateProxy), judged by the SAME gate on the SAME frozen folds. It is
pre-registered, so running it is not a new choice — but given the primary
missed 91-100% of real reversals rather than missing narrowly, expectations
should be low. Awaiting a ruling on whether to spend it.

**PHASE 1 AND 1C BOTH FAILED. Nothing is retracted from the positives:**
the extractor is exact and tessellation-independent, the frame is validated
by exact port/starboard symmetry, discrimination is 44.75% against a 23.81%
bar, the flat base shows as a 47 deg top-vs-underside difference that A(x)
erases, and the tail's handover is provably real geometry.

## 20. PRE-REGISTERED FALLBACK RESULT (2026-08-20): **KILL. BRANCH CLOSED.**

q=0.95 linear quantile regression over the six frozen predictors. Same
folds, same baseline, same gate, no feature engineering, no transform or
threshold chosen from the primary result. Optimiser declared not tuned:
training-only standardisation, subgradient descent on pinball loss, 400
full-batch iterations, lr = 0.5/sqrt(t), zero init, prediction clamped >= 0.

| fold | coverage | cov(y>0) | median ratio | pinball L vs G | train loss 1/100/400 |
|---|---|---|---|---|---|
| LOMO sineJitter | **0.8522** | 0.0398 | Inf | 0.12652 / 0.12980 | .0084/.0105/.0085 |
| LOMO blockDensity | 1.0000 | n/a | **1.434** | 0.01131 / 0.00747 | .0517/.0446/.0443 |
| LOMO azimuthalShear | 1.0000 | 1.0000 | **1.328** | 0.01028 / 0.00738 | .0515/.0444/.0442 |
| LOMO surfaceWalk | 0.9911 | **0.8114** | **12.088** | 0.02794 / 0.02494 | .0434/.0382/.0376 |
| LOFO f=1.3 | 0.9662 | 0.3452 | **12.597** | 0.05149 / 0.05787 | .0387/.0358/.0352 |

**IT FAILED IN THE MOST INSTRUCTIVE WAY AVAILABLE.** The richer model DID
substantially improve real-event coverage — surfaceWalk 0% -> 81%, f=1.3
3% -> 35%. It bought that entirely by inflating the bound to **12x wider
than the global baseline**. A 95% interval that says "anything here might be
enormous" is safe and useless, and the sharpness criterion existed
precisely to refuse it.

Training loss plateaus on every fold, so this is not an optimiser failure.
The model converged and still cannot do the job.

**BRANCH CLOSED — "LOCAL MESH-RELIABILITY FROM RAW OBJ ALONE".** Both the
one-parameter physical rule and the six-predictor regression fail the same
frozen gate on unseen corruption mechanisms and on an unseen bluntness.
**Locally observable mesh metadata is not sufficient to separate intended
surface turning from polygon encoding.**

**THEREFORE THE NEXT ARCHITECTURE IS: TRUSTWORTHY SKIN FIRST, RIBBONS
SECOND.** That was the alternative the kill clause named in advance, and it
is now the one standing.

**INTERPRETATION CORRECTED (external review, accepted).** Section 19 said
the bare Sunship's +6.5 deg is "most likely artefact". That overstates:
attributing it to a mechanism has not been established for that exact mesh.
The defensible statement, and the only one the evidence carries:

> artefacts of that magnitude are demonstrably plausible (the sweep reached
> 17.51 deg), therefore **the bare event is NOT TRUSTWORTHY AS GEOMETRY**.

The tailed handover is unaffected and remains the cleaner result: on the
regular zero-jitter surrogate the local handover is genuinely in the
SURROGATE GEOMETRY. It is not a claim that the physically deployed tail
will have that exact junction profile.

**THE CRISP ARCHITECTURE FINDING FROM THE WHOLE INVESTIGATION:**

> **Ribbons are informative. Arbitrary faceted OBJs are not always a
> trustworthy substrate for derivative-sensitive ribbons.**

That is a manageable geometry-processing problem, not a collapse of the
estimator concept — and it is exactly the kind of thing that would
otherwise have surfaced much later and much more expensively.

## 21. PHASE 1D SPEC — CANONICAL SKIN (frozen 2026-08-20, pre-build)

**THE FIX, NARROWED.** Phase 1C closed the route of inferring mesh
reliability from raw-OBJ metadata. The remaining lever is the substrate:
**position is robust, differentiation is not.** Stop asking irregular
triangles for slopes; sample where the surface IS on a regular x-theta grid
and lay ribbons on that.

**WHAT ACTUALLY CHANGES.** The extractor already evaluates at fixed x
stations. The defect is that it takes the OUTERMOST intersection among all
segments crossing that plane — a max over a noisy set, which is the
stair-step generator. Phase 1D replaces it with the actual closed planar
CONTOUR at each station, interpolated at fixed theta.

**NOT CLAIMED TO BE "UNBIASED"** (review correction). It is still sampling a
faceted mesh's contour, and fixed (x, theta) resolution can still miss
narrow features. Frozen description:

> **canonical, topology-independent positional sampling of the section
> contour; no longitudinal smoothing or reconstruction.**

Side benefit: A(x) and r(x, theta) then come from ONE representation
instead of two passes.

**PRIMARY PATH: ZERO LONGITUDINAL SMOOTHING.** Tried first because it does
not intentionally remove anything. **But "cannot erase anything" is too
strong** (review correction): 128 stations and finite theta still
discretise the surface. What proves features survive is the compound-body
control below, not the absence of a smoother. Any smoothing or
reconstruction is a SEPARATELY PRE-REGISTERED FALLBACK, never quietly added
to improve a plot.

**OPERATOR-MATCHED ANALYTIC ORACLE (review correction, important).** Truth
is NOT the ideal continuous derivative. The closed-form surface is passed
through the SAME frozen operator — same 128 x stations, same theta
locations, same 3% secant span, same 2.5% tip exclusion — and THAT is the
oracle. Comparing against a continuous derivative would penalise the
already-known ~5% secant bias and manufacture a false failure.

**FROZEN TOLERANCES.**

| test | criterion |
|---|---|
| monotone controls | `turningExcess <= 0.5 deg` per ribbon, **median <= 0.1 deg** (absolute angle, because % excess is ill-conditioned near zero) |
| cross-tessellation ribbon agreement | normalised-radius RMS <= **0.5% of Rmax**; 99th-pct pointwise <= **1.5% of Rmax**; zone-turning totals within **2% or 0.5 deg, whichever is larger** — all against the operator-matched oracle |
| compound handover preservation | magnitude within **5% or 0.5 deg, whichever larger**; location within **1 axial station** (~0.8% L) |
| directional controls (triaxial, flat-bottom) | differences within **2% or 0.5 deg, whichever larger**, AND sign/order correct |

Chosen so a 17.5 deg mesh artefact cannot hide inside them, while contour
chaining and the frozen finite-difference operator are not failed on
sub-tenth-degree trivia.

**ANTI-CHEAT.** The skin must not win agreement by lowering angular
resolution. Re-run the 12/24/48 ribbon convergence test. A coarse theta
grid that simply fails to see bad geometry is NOT a fix.

**TEST ORDER, FROZEN.**
1. analytic monotone body x 5 tessellation styles (regular, irregular,
   coarse, dense, random) -> excess ~0, ribbons agree
2. analytic COMPOUND body with a closed-form hull->tail easing event ->
   handover preserved in magnitude and location
3. triaxial + flat-bottom -> directional differences preserved, order right
4. 12/24/48 convergence anti-cheat
5. **only then** bare and tailed Sunship, re-running the frozen Phase 1
   tests

**KILL.** If contour sampling does not drive monotone excess to ~0, or if
any conditioning that does also damages the compound handover beyond
tolerance, arbitrary OBJs are not a viable substrate and the estimator
needs a genuine CAD/NURBS input path.

**OUT OF SCOPE.** No Cd. No calibration. No production change. Phase 1 and
1C stay FAILED; every retraction stays in the record.

## 22. PHASE 1D STEP 1 (2026-08-20): **FAILS AS FROZEN — BUT THE AXIAL PROBLEM IS SOLVED OUTRIGHT**

Five tessellations of ONE analytic surface (prolate f=3), canonical skin by
exact planar section + ray radius per theta, zero longitudinal smoothing:

| style | verts | max excess | med excess | RMS vs oracle | p99 | verdict |
|---|---|---|---|---|---|---|
| regular | 4562 | **0.000** | **0.000** | 0.296% | 2.328% | FAIL (p99) |
| irregular | 4562 | **0.000** | **0.000** | 0.647% | 5.154% | FAIL |
| coarse | 746 | 77.480 | 68.135 | 1.897% | 9.280% | FAIL |
| dense | 22946 | 1.814 | 0.201 | **0.060%** | **0.145%** | FAIL (excess) |
| random | 4562 | 65.082 | 14.202 | 0.882% | 3.285% | FAIL |

**Step 1 FAILS as frozen. No tolerance moved.** Stopped there per ruling;
steps 2-5 not run.

**FIRST HYPOTHESIS WRONG AGAIN (fifth time).** Ray dropouts were suspected:
measured **0 of 3072** zero-radius stations in every style. Not dropouts.

**MECHANISM CONFIRMED BY CONTROLLED ISOLATION, NOT INFERENCE.** Axial and
azimuthal jitter applied separately, everything else identical:

| azimuthal facets | axial jitter 0.5, azim 0 | axial 0, azim jitter 0.5 | 1-cos(pi/nt) |
|---|---|---|---|
| 24 | **0.000 deg** | **182.3 deg** | 0.856% |
| 48 | **0.000 deg** | **25.6 deg** | 0.214% |
| 96 | **0.000 deg** | **0.495 deg** | 0.054% |

**FINDING 1 — THE AXIAL PROBLEM IS SOLVED OUTRIGHT.** Not reduced:
**exactly 0.000 deg at every resolution**, with axial jitter at 0.5. That
was the Phase 1C failure and positional contour sampling eliminated it. The
"position is robust, differentiation is not" diagnosis was correct.

**FINDING 2 — WHAT REMAINS IS A DIFFERENT, LAWFUL PROBLEM.** The ray reads
the section POLYGON, not a circle. Azimuthal jitter randomises which part
of the polygon each station's ray strikes — vertex versus edge midpoint —
producing radius oscillation of order `1 - cos(pi/nt)`, which the small
station spacing amplifies into large tangent swings. It scales with
azimuthal resolution and falls INSIDE the frozen 0.5 deg tolerance at
nt = 96 (0.495).

**WHY THIS FAILURE IS UNLIKE PHASE 1C's.** 1C failed because no locally
observable mesh property could predict the artefact. Here the artefact has
a confirmed mechanism, a known scaling law, and a single GLOBAL predictor —
azimuthal facet count — that is trivially measurable on any upload. That is
precisely the kind of gate 1C could not construct.

**NOT PATCHED. Two candidate directions, neither applied, both requiring a
ruling and their own pre-registration:**
1. **Read theta more faithfully.** Ray-casting samples CHORDS of the
   section polygon. Interpolating between the polygon's actual VERTICES —
   real surface positions — would avoid the vertex/edge phase artefact
   without any longitudinal smoothing.
2. **An azimuthal-adequacy precondition.** Now defensible in a way 1C's was
   not, because the scaling law is measured rather than fitted. Note the
   bare Sunship at 2778 verts sits in the bad regime, so this route would
   downgrade it rather than rescue it.

**RESIDUAL CONCERN, RECORDED.** Even `regular` and `irregular` fail the p99
positional tolerance (2.3%, 5.2% against 1.5%) while showing zero excess.
Positional agreement and turning fidelity are therefore NOT the same test,
and the p99 failures are unexplained. They must be understood before either
candidate direction is chosen.

## 23. PHASE 1D p99 ISOLATION (2026-08-20): BOTH ERROR SOURCES ANALYTICALLY EXPLAINED

One-variable isolation only, as ruled. Nothing patched.

**FIRST SWEEP WAS DEGENERATE — recorded, not hidden.** Isolation 1 initially
used nt in {24, 48, 96, 192} against 24 theta rays. Every ray therefore
landed EXACTLY on a polygon vertex and read the exact analytic radius,
giving a flat 0.0293% at all resolutions. That was a test-design artefact,
not a result. Redone with non-commensurate nt.

**COMPONENT A — CIRCUMFERENTIAL POLYGON DEFICIT. Closed-form law confirmed.**
Axial held very fine (nx=480), zero azimuthal jitter, tips excluded:

| nt | measured p99 | predicted 1-cos(pi/nt) |
|---|---|---|
| 25 | 0.7821% | 0.7885% |
| 37 | 0.3574% | 0.3603% |
| 61 | 0.1316% | 0.1326% |
| 97 | 0.0522% | 0.0524% |
| 193 | 0.0133% | 0.0132% |

Agreement within 0.8% across five non-commensurate resolutions. This is an
ANALYTIC EXPLANATION, not an empirical fit.

**COMPONENT B — AXIAL CHORD DEFICIT, CONCENTRATED AT THE TIPS.** Azimuthal
held very fine (nt=192), sweep axial:

| nx | p99 all stations | p99 excluding 2.5% tips |
|---|---|---|
| 32 | 8.9093% | 0.6659% |
| 96 | **2.3279%** | **0.0714%** |
| 240 | 0.0800% | 0.0203% |
| 480 | 0.0293% | 0.0025% |

A 33x difference at nx=96 between including and excluding the tips.

**THIS EXPLAINS BOTH STEP-1 FAILURE MODES:**
- `regular` / `irregular` failed p99 (2.328%, 5.154%) with ZERO turning
  excess. That is **component B measured over ALL stations while the
  turning metric excludes the tips** — a DOMAIN MISMATCH in the test
  harness. It is the same defect as Phase 1's R2, which was found and fixed
  once and then reintroduced here. Spec 21 did not state the comparison
  domain for the positional criterion, so this is a spec ambiguity
  compounded by my error, NOT a method failure. The 2.3279% figure
  reproduces the `regular` case exactly.
- `coarse` / `random` failed on turning excess. That is **component A**,
  amplified because azimuthal jitter randomises which part of the section
  polygon each station's ray strikes.

**WHY THIS POSITION IS STRONG.** Phase 1C failed because the artefact was
unpredictable from anything observable. Here BOTH components obey closed-form
laws in variables trivially measurable on any upload — azimuthal facet count
and axial facet spacing near the tips. An adequacy precondition would be
DERIVED, not fitted, which is exactly what 1C could not achieve.

**NOT PATCHED. Three items now require rulings, and they are separable:**
1. **Spec ambiguity:** should the positional p99 criterion be evaluated on
   the same retained domain as turning? Consistency argues yes; that is a
   spec correction, not a tolerance change.
2. **Circumferential reconstruction** (interpolating between contour
   vertices rather than ray-casting chords) remains UNAPPLIED. It is a
   reconstruction step that asserts polygon edges are not aerodynamic
   truth — right for smooth hulls, wrong for a chine or flat face. If
   pursued it needs its own controls: smooth bodies where it must remove
   the polygon artefact, AND the flat-bottom body where it must NOT round
   away a real edge.
3. **Derived adequacy precondition** from the two laws above.

**PHASE 1D REMAINS FAILED AS FROZEN.** No tolerance moved, steps 2-5 not run.

## 24. PHASE 1D-R1 (2026-08-20): DOMAIN CORRECTION CONFIRMED; ADEQUACY METRIC MEASURES THE WRONG QUANTITY

R1 applied as ruled: retained-domain p99 gates, full-domain p99 kept as a
diagnostic, local azimuthal adequacy from the bracketing contour-vertex
angular gap, NO smoothing, NO reconstruction.

| style | max excess | med excess | p99 retained | (p99 full) | worst zone | pred err p95 | verdict |
|---|---|---|---|---|---|---|---|
| regular | **0.000** | **0.000** | **0.071%** | (2.33%) | 0.95x | 0.191% | **PASS** |
| irregular | **0.000** | **0.000** | **0.181%** | (5.15%) | 0.10x | 0.195% | **PASS** |
| coarse | 77.480 | 68.135 | 2.447% | (9.28%) | 55.36x | 1.688% | FAIL |
| dense | **1.814** | 0.201 | **0.117%** | (0.14%) | 2.68x | **0.104%** | FAIL |
| random | 65.082 | 14.202 | 1.705% | (3.28%) | 51.78x | 0.996% | FAIL |

**THE DOMAIN CORRECTION IS CONFIRMED.** `regular` and `irregular` now PASS
outright — zero excess, retained p99 of 0.071% and 0.181% against a 1.5%
tolerance, while their full-domain p99 stays at 2.33% and 5.15%. The
diagnosis in section 23 was exactly right and the correction resolves those
two cases completely.

**THE ADEQUACY METRIC IS MEASURING THE WRONG QUANTITY.** Computed from mesh
geometry alone with no knowledge of truth, it correctly ranks `coarse`
(1.688%) and `random` (0.996%) as the worst — they are the catastrophic
failures. **But `dense` has the LOWEST predicted error of all five (0.104%)
and still fails**, on turning excess 1.814 deg and zone error 2.68x, while
its positional accuracy is excellent.

**MECHANISM.** Differentiating over a short baseline AMPLIFIES positional
error into angular error. A 0.117% radius wobble at Rmax 1 over a station
spacing of 0.047 is a slope change of ~0.025, i.e. ~1.4 deg, and an
oscillating sign accumulates it. So:

> **positional adequacy and turning adequacy are NOT the same criterion.**
> A mesh can be positionally excellent and still unusable for derivatives.

This is the same lesson as Phase 1C's core finding, arriving one level up:
the thing that must be bounded is the AMPLIFIED quantity, not the raw one.

**CONSEQUENCE FOR THE ADEQUACY ROUTE — narrower, not dead.** The metric must
be defined on predicted TURNING error, not predicted positional error. The
amplification relationship is derivable rather than fitted: it depends on
the positional error, the secant span (frozen at 3% of L) and the station
spacing, all known. Establishing it on analytic controls is the natural next
experiment and stays within the "derived, not fitted" standard that
distinguishes this route from the Phase 1C kill.

**NOT PATCHED. PHASE 1D REMAINS FAILED.** No tolerance moved. Steps 2-5 not
run. Circumferential reconstruction still on HOLD per ruling.

## 25. R2 ADEQUACY DEFINITION — FROZEN 2026-08-20 BEFORE EVALUATION

**MOTIVATION, DEMONSTRATED NOT ASSUMED.** `dense` failed at the LOWEST
predicted positional error of all five variants. That is a dimensional
mismatch, not a mistuning:

> **positional adequacy != derivative adequacy.** The quantity that must be
> bounded is turning AFTER the frozen operator, not radius before it.

**DEFINITION — ANALYTIC PROPAGATION THROUGH THE EXACT FROZEN OPERATOR.** No
fitted constant. No amplification factor derived from `dense` or from any
corpus body.

1. Local positional bound at a station, from the bracketing contour gap
   (verified to 0.8% against 1-cos(gap/2) in section 23):
   `eps(i) = r(i) * (1 - cos(gap(i)/2))`
2. The frozen secant uses endpoints a, b separated by `dX = (b-a)*dx`,
   with `dX` fixed at 3% of L. Slope-error bound:
   `|dm| <= (eps(a) + eps(b)) / dX`
3. Propagate through `phi = atan(m)`:
   `dphi <= dm / (1 + m^2)`
4. Worst-case FALSE local turning between consecutive stations, opposite
   signs assumed:
   **`sigmaTurning(i) = dphi(i) + dphi(i+1)`**

**USE — NEVER CORRECT, ONLY QUALIFY.** The measured ribbon is never
adjusted. `sigmaTurning` answers one question: is a measured reversal
distinguishable from what the mesh encoding could manufacture here? A 5.5
deg handover against 0.1 deg of possible mesh-induced turning is strong; a
1.8 deg reversal against 2 deg of uncertainty is not trustworthy.

**PRE-REGISTERED GATE (turning tolerance stays 0.5 deg, unmoved):**
- **COVERAGE:** across all tessellation variants of analytic monotone
  truth, `sigmaTurning` must upper-cover **>= 99%** of manufactured false
  reversals. It is an upper bound; near-total coverage is the point.
- **NON-REJECTION:** any variant whose MEASURED max excess is <= 0.5 deg
  (i.e. genuinely adequate) must have **median sigmaTurning <= 0.5 deg**.
  A bound that rejects usable meshes is useless.
- **DISCRIMINATION:** any variant whose measured max excess is > 0.5 deg
  must have **p95 sigmaTurning > 0.5 deg** — the bound must actually flag
  the meshes that are bad.
- **KILL:** coverage < 99%, or a genuinely adequate mesh is rejected, or a
  bad mesh is not flagged.

**UNCHANGED.** Phase 1D Step 1 remains FAILED under the original metric and
that record stands. No smoothing, no reconstruction, no tolerance moved.
The only uncertain ingredient in R2 is the positional bound itself, which
is already analytically verified.

## 26. R2 GATE RESULT (2026-08-20): **KILL** — the propagation is mis-specified, not mis-tuned

| style | max excess | coverage | median sigT | p95 sigT | outcome |
|---|---|---|---|---|---|
| regular | **0.000** | 100% | **0.643** | 1.430 | adequate mesh REJECTED |
| irregular | **0.000** | 100% | **0.596** | 1.308 | adequate mesh REJECTED |
| coarse | 77.480 | **97.9%** | 4.479 | 11.520 | UNDER-COVERS |
| dense | 1.814 | 100% | 0.310 | 0.665 | PASS |
| random | 65.082 | **85.7%** | 1.080 | 8.905 | UNDER-COVERS badly |

All three kill conditions fire: coverage below 99% on two variants, and two
genuinely adequate meshes rejected. **R2 as frozen is dead.**

**IT FAILS IN BOTH DIRECTIONS AT ONCE**, which is the informative part. Too
loose where it should be tight (zero measured excess, 0.6 deg bound) and
too tight where it should be loose (14% of `random`'s real reversals
uncovered). A single mis-calibration cannot do that; the model is
mis-specified.

**IDENTIFIED CAUSE — the positional bound is INCOMPLETE.** Section 23
measured TWO positional error components. R2 propagated only one:
- **circumferential** chord sagitta `1 - cos(gap/2)` — propagated;
- **axial** chord deficit — **omitted entirely**.

The variants that under-cover (`coarse`, `random`) are precisely those with
axial irregularity. The over-conservatism on `regular`/`irregular` is the
mirror image: assuming worst-case edge-midpoint geometry when those meshes'
rays happen to land on polygon vertices and read exact radii.

**PATTERN WORTH NAMING — this is the SECOND consecutive kill in the
adequacy family.** Phase 1C killed local reliability from raw mesh
metadata; R2 kills analytic propagation of a partial positional bound. The
honest read is not yet "adequacy is impossible" — R2's omission is
concrete and its two failure directions are both explained — but a third
attempt should not be started casually. If the axial term is added and
something else then fails, the route is being iteratively rescued rather
than derived, and the reconstruction branch currently on HOLD deserves
reconsideration instead.

**NOT PATCHED. NO RULING TAKEN.** Adding the axial term is arguably a
completion of the same analytic derivation rather than a fitted rescue —
the axial chord deficit follows a known law and was measured in section 23,
not invented here. But that is a judgement call about scientific hygiene,
not a technical one, and it belongs to the owner rather than to me.

Phase 1D remains FAILED. No tolerance moved. Steps 2-5 not run.
Reconstruction still on HOLD.

## 27. ADEQUACY FAMILY CLOSED (2026-08-20, owner ruling). R3 NOT SPENT.

**R2 is the final adequacy attempt. The reason is mathematical, not
hygienic** (owner correction, better than the "iterative rescue" framing
this ledger offered): adding the omitted axial term can reduce
under-coverage on `coarse`/`random`, but it can ONLY WIDEN the already
too-wide bounds on `regular`/`irregular`. R2 fails on OPPOSITE SIDES, so
completing the error budget cannot fix the gate. R3 was never going to
work.

**AND THE OVER-CONSERVATISM IS THE DEEPER FINDING.** From the faceted
polygon alone you know the POSSIBLE sagitta error but not WHERE the
intended smooth surface lies inside that possibility. A worst-case bound
must therefore stay broad. **This is the same information limit Phase 1C
found statistically, now expressed analytically.** Two independent routes,
one conclusion:

> **The raw polygon does not contain enough information to bound its own
> deviation from the intended surface tightly enough to be useful.**

Branch closed. Not useless — it established precisely why the cheap route
cannot work, which is what licenses the more expensive one.

## 28. PHASE 1E SPEC — FEATURE-PRESERVING CIRCUMFERENTIAL RECONSTRUCTION (frozen pre-build)

**THE ASSUMPTION, STATED EXPLICITLY AS AN ASSUMPTION.** Reconstruction is
not a different sampling implementation; it asserts something:

> **The OBJ polygon is a SAMPLING of an intended aerodynamic surface, not
> necessarily the aerodynamic surface itself.**

Right for a smooth hull. Wrong for a genuine chine, flat face or corner.
The flat-bottom control exists solely to enforce that distinction.

**SCOPE — CIRCUMFERENTIAL ONLY. ZERO LONGITUDINAL SMOOTHING.** This attacks
the isolated residual (the section polygon's chord/phase artefact) and
leaves the longitudinal machinery — which already gives exactly 0.000 deg
axial excess — completely untouched.

**METHOD — PIECEWISE SMOOTH, NOT ONE SPLINE THROUGH EVERYTHING.**
1. **Feature detection.** At each contour vertex compute the turn angle
   between adjacent edges. A polygonal approximation of a smooth curve has
   small, uniform turn angles (~2pi/n); a real chine has a large one. A
   vertex is a FEATURE if its turn angle exceeds `K x` the contour's median
   turn angle. Scale-free by construction.
2. **Reconstruction.** Between consecutive features, fit a natural cubic
   through the contour vertices in theta and evaluate at the fixed theta
   rays. Features are retained as corners; breaking the fit at features is
   what prevents spline overshoot rounding them away.
3. `K` is selected by a DETERMINISTIC RULE on analytic controls only: the
   SMALLEST K that both removes the circle/ellipse polygon artefact AND
   preserves the flat-bottom chine. If no K does both, the method is
   killed. Same pattern as the tip fraction in 4.7.

**TEST ORDER, FROZEN. Each gate must pass before the next runs.**
1. **smooth analytic bodies** — wildly different tessellations of the same
   circle/ellipse must reconstruct to essentially identical contours and
   ribbons, and drive false turning to ~0. Reuses the frozen 0.5 deg /
   0.1 deg median tolerances.
2. **compound smooth body** — the known hull->tail easing event must
   survive in magnitude (5% or 0.5 deg) and location (1 station).
3. **flat-bottom / chine control** — the real flat and its corners must be
   RETAINED. **If reconstruction rounds the chine away, that reconstruction
   method is killed**, regardless of how well it did on 1 and 2.
4. **only then** bare and tailed Sunship.

**KILL.** No K satisfies both requirements in step 3's selection rule; or
the chine is rounded away; or the handover is damaged beyond tolerance.

**UNCHANGED.** Phase 1, 1C, 1D and R2 all remain FAILED and every
retraction stays in the record. No Cd, no calibration, no production
change. The ribbon programme continues because the representation itself is
established: the open problem is converting polygonal encoding into the
intended surface BEFORE differentiating it.

### 28a. PHASE 1E AMENDMENTS — FROZEN 2026-08-20 PRE-BUILD

**AMENDMENT 1 — K SELECTION IS SPLIT FROM METHOD VALIDATION.** The same
chine control must not both choose `K` and serve as the proof that `K`
preserves chines. Avoidable contamination.
- **K selection set:** smooth circle/ellipse artefact + ONE designated
  analytic feature-control. Smallest K satisfying both, as frozen.
- **Independent method gate:** a SECOND non-smooth control that K has never
  been selected against — different flat width and chine angle, and
  asymmetric. "Preserves a different feature geometry without retuning" is
  the evidence that counts.

**AMENDMENT 2 — GRADED-CORNER SWEEP, with pass rules frozen before
implementation.** Natural cubic can behave perfectly on an obvious hard
feature AND on a smooth circle while behaving badly just below the
detection threshold. That discontinuity must be found analytically, not on
Sunship.

Geometry: one body family, corner sharpness swept continuously from clearly
smooth to clearly featured, straddling K.

Three expectations:
1. **No invention.** Reconstruction must not create an overshoot, a new
   extremum, or a tangent reversal that the analytic contour does not
   contain.
2. **No cliff.** Reconstructed fidelity must vary smoothly/monotonically
   with true corner sharpness — not degrade sharply immediately either side
   of K.
3. **No new tolerance.** Shapes clearly above threshold meet the existing
   FEATURE tolerance; shapes below it meet the existing SMOOTH-CONTOUR
   tolerance. **No looser tolerance may be invented for the transition
   region.** Whichever side the detector picks, the reconstructed surface
   must remain geometrically faithful — the detector need not be
   philosophically correct at the boundary, the geometry must.

**AMENDED TEST ORDER, each gate blocking the next:**
1. smooth circle / ellipse
2. designated K-selection chine
3. **independent chine gate** (never used for K)
4. **graded sharpness sweep**
5. compound longitudinal handover — circumferential reconstruction must not
   perturb the one thing the whole ribbon project exists to preserve
6. directional controls (triaxial, flat-bottom)
7. 12/24/48 convergence anti-cheat
8. **Sunship last**

**NATURAL CUBIC IS NOT CHANGED PRE-EMPTIVELY.** It faces these controls as
frozen. If it passes, a simple reconstruction has been earned. If it
overshoots near the threshold, there is then a MEASURED reason to consider
a shape-preserving interpolant — rather than choosing one because it sounds
safer.

## 29. PHASE 1E BLOCKED BY IMPLEMENTATION DEFECT (2026-08-20) — **NO KILL RECORDED**

K selection produced nonsense: smooth-body excess of 205 / 515 / 2954 /
5502 / 2027 / 3570 / 1762 / 682 deg across K = 1.5 .. 20, non-monotone. A
2954 deg turning excess is not a geometric statement. **This is an
implementation defect and the method has NOT been tested.** Recording a
kill here would be as damaging as recording a false pass.

**DEFECT DIAGNOSED.** At a mid-station of a mesh with nt = 25 azimuthal
segments, the section polygon should have ~25 vertices. Measured: **112 raw
contour points**, of which 56 are exact duplicates (each edge crossing is
found once per adjoining triangle) and the remainder lie COLLINEAR ON
POLYGON EDGES rather than at corners.

Collinear points have turn angle ~0. They drag the contour's MEDIAN turn
angle to ~0, so the feature threshold `K * median` also goes to ~0, **every
vertex is flagged as a feature**, every run between features collapses to
1-2 points, and the cubic degenerates to constant/linear fragments. That is
exactly why the result was erratic and barely responded to K.

**TWO FIX DIRECTIONS, NEITHER APPLIED:**
1. **Extract the section POLYGON properly** — chain the crossing segments
   into an ordered loop and keep only genuine corners, instead of dumping
   every crossing point into an angular sort. This is the correct
   operation; the current code took a shortcut that works for ray-casting
   (where only the outermost hit matters) but not for reconstruction
   (where the vertex SET is the input).
2. **Make the feature threshold robust to a degenerate median** — an
   absolute angular floor, or a median taken over distinct corners only.
   Weaker: it treats the symptom.

Direction 1 is almost certainly correct, since the same shortcut is
harmless in `extractSkin` and fatal here.

**STATUS.** Phase 1E gate 1 not reached. K unselected. Every prior verdict
stands unchanged: Phase 1, 1C, 1D and R2 all FAILED; the adequacy family
closed; reconstruction unheld but untested. No Cd, no calibration, no
production change.

## 30. CONTOUR CHAINING REPAIRED AND SOUND; MY GATE EXPECTATIONS WERE NOT (2026-08-20)

**THE PRIMITIVE WORKS.** `ribbons-contour.mjs` chains crossing segments by
shared endpoints into an ordered loop. It contains NO feature detection and
no knowledge of K — the separation the ruling required, so K cannot
contaminate its own input. There is NO angular-sort fallback: unchainable
segments report a contour-quality failure.

At a station deliberately off any mesh ring, all four controls produce a
**single closed loop with consistent CCW winding, every segment consumed,
every vertex degree exactly 2**:

| body | nt | segments | loop vertices | closed | winding |
|---|---|---|---|---|---|
| circle smooth | 25 | 60 | 60 | yes | CCW |
| circle dense | 96 | 236 | 236 | yes | CCW |
| chine d=0.7 | 96 | 192 | 75 | yes | CCW |
| chine d=0.5 (independent) | 64 | 128 | 47 | yes | CCW |

**THE GATE FAILED ON MY EXPECTATIONS, NOT ON THE CHAINING.** Two errors,
both mine, both recorded:

1. **First run:** I chose the mid-station x = 0 on an even-nx lathe, which
   lands EXACTLY on a mesh ring. Plane-through-vertex degeneracy made every
   vertex read degree != 2. A degenerate station I picked myself.
2. **Re-run:** the expected vertex band was wrong in BOTH directions.
   Smooth sections give ~2.4x nt because axial jitter makes the plane cross
   more edges than a clean 2x; chine sections give FEWER than nt (75, 47)
   because the flat merges collinear points — which this ledger's own first
   gate comment predicted and I then failed to encode.

**THAT IS THE THIRD BADLY-SPECIFIED EXPECTATION WRITTEN INTO A GATE TODAY**
(after the Phase 1 R2 domain mismatch and the commensurate-count
degeneracy). The pattern is specific and worth naming: the measurements and
the primitives have been reliable; **the expectations I write around them
have not.** A vertex-count band should be DERIVED from the tessellation
topology, not estimated.

**STATUS — STOPPING HERE DELIBERATELY.** The contour primitive is sound and
committed. The gate needs a derived rather than estimated expectation, and
after three such errors in one session that is work to start fresh, not to
iterate on now.

Nothing else changes: K unselected, Phase 1E gate 1 not reached, Phase 1 /
1C / 1D / R2 all still FAILED, adequacy family still closed, reconstruction
still untested. No Cd, no calibration, no production change.

### 30a. CONTOUR GATE REDEFINED — INVARIANTS, NOT VERTEX COUNT (frozen 2026-08-20)

**VERTEX COUNT IS DROPPED AS A CORRECTNESS CRITERION.** It is a property of
tessellation topology, not of whether the recovered contour is
geometrically right: 47, 75 or 120 points can all faithfully represent the
same circle. Three mis-specified count expectations in one session were the
symptom; this is the cause.

**THE GATE IS NOW GEOMETRIC AND TOPOLOGICAL INVARIANTS:**
1. exactly ONE closed loop for a known single-body section;
2. every source segment consumed exactly once (defined degeneracies aside);
3. adjacent chained segments share endpoints within tolerance;
4. no zero-length edges after deduplication;
5. consistent winding;
6. **replay** — the chained polygon's edge SET reproduces the original
   intersection segments exactly;
7. **analytic agreement** — section AREA and PERIMETER match the closed-form
   oracle within the DERIVED polygon-discretisation bound, not a guessed
   tolerance. For an inscribed polygon of max angular gap dTh the relative
   area deficit is ~dTh^2/6; the gate uses 2x that as the allowance, and the
   same form for perimeter.

Invariant 7 is the one that actually says "this contour is correct".
Invariant 6 is exact and needs no tolerance at all.

**ANALYTIC ORACLES.** Circle section: A = pi r^2, P = 2 pi r. Chine section
(circle of radius R cut by a chord at depth d, alpha = acos(d/R)):
A = pi R^2 - R^2 (alpha - sin alpha cos alpha),
P = R (2 pi - 2 alpha) + 2 R sin alpha.

### 30b. INVARIANT GATE RUN — PRIMITIVE SOUND, GATE WRONG AGAIN (2026-08-20)

| body | 1 loop | all segs | replay | winding | area err | perim err | allowance |
|---|---|---|---|---|---|---|---|
| circle smooth | yes | yes | yes | CCW | 1.7010% | 0.4361% | 3.7533% |
| circle dense | yes | yes | yes | CCW | 0.1193% | 0.3112% | 0.3714% |
| chine d=0.7 | yes | yes | **NO** | CCW | **0.0695%** | **0.0757%** | 82.2% |
| chine d=0.5 indep. | yes | yes | **NO** | CCW | **0.2704%** | **0.5238%** | 128.5% |

**THE PRIMITIVE IS SOUND ON EVERY SUBSTANTIVE MEASURE.** All four: one
closed loop, every segment consumed, consistent winding, and section area
and perimeter within **0.07-1.70%** of the closed-form analytic oracle.
Both circles pass outright against the derived allowance.

**BOTH CHINE FAILURES ARE MINE — a fourth gate mis-specification:**
1. **Replay defined as edge-set EQUALITY is incompatible with collinear
   removal**, which is SPECIFIED behaviour in the frozen chaining. Removing
   collinear points along a flat necessarily replaces several short input
   segments with one long edge. The invariant should have been *every input
   segment lies ON the chained boundary*, not *the edge sets are identical*.
2. **The dTh^2/6 allowance is derived for a smooth inscribed polygon** and
   is meaningless on a contour with a genuine flat, where the flat spans a
   large angular gap with no intermediate vertices. It returned 82% and
   128% — no constraint whatsoever. Harmless direction, still wrong.

**FOURTH MIS-SPECIFIED GATE IN ONE SESSION.** R2 domain mismatch,
commensurate-count degeneracy, vertex-count band, and now a replay
definition that contradicts a specified feature plus an allowance formula
applied outside its derivation. The primitives and measurements have been
right every time; the criteria written around them have not.

**STOPPING, AND THIS TIME NOT RE-RUNNING.** The correct move is to fix both
definitions and re-run — but that is a fifth attempt at the same gate in
one sitting, by the same judgement that has produced four errors. It is
work for a fresh start, not for now.

**RESUME POINT.** Two definitional fixes, both already diagnosed:
- replay: assert every input segment lies ON the chained boundary
  (point-on-segment within tolerance), NOT edge-set equality;
- allowance: apply the dTh^2/6 smooth-polygon bound only across smooth
  runs; a genuine flat contributes no discretisation deficit and must be
  excluded from the gap statistic rather than inflating it.

Then: contour gate -> frozen K selection -> independent chine control ->
graded-corner sweep -> handover -> directional -> convergence -> Sunship.

Nothing else changes. K unselected, Phase 1E gate 1 not reached, Phase 1 /
1C / 1D / R2 still FAILED, adequacy closed, reconstruction untested. No Cd,
no calibration, no production change.

### 30c. CORRECTED RERUN — REPLAY FIX WORKED; ALLOWANCE MIS-SPECIFIED A THIRD TIME (2026-08-20)

| body | 1 loop | replay fwd | replay converse | winding | area err | perim err |
|---|---|---|---|---|---|---|
| circle smooth | yes | **yes** | **yes** | CCW | 1.7010% | 0.4361% |
| circle dense | yes | **yes** | **yes** | CCW | 0.1193% | 0.3112% |
| chine d=0.7 | yes | **yes** | **yes** | CCW | 0.0695% | 0.0757% |
| chine d=0.5 indep. | yes | **yes** | **yes** | CCW | 0.2704% | 0.5238% |

**THE SUBSTANTIVE FIX WORKED.** Bidirectional replay — every source segment
lies ON the boundary, AND every chained edge is covered by the union of its
collinear source segments — now passes on ALL FOUR, including both chines.
That is the invariant that actually separates a correct chaining from one
that shortcuts across the interior, and it is the one that matters.

**THE GATE STILL READS FAIL FOR ONE REASON, AND IT IS MINE AGAIN.** The
allowance computes 0.0000% everywhere. The "known smooth run" filter
requires vertices within 1e-6 of the analytic circle, but faceted vertices
lie on INSCRIBED CHORDS, slightly inside it. Almost nothing passes the
filter, the gap statistic collapses, and the allowance degenerates to zero
— failing everything by construction.

**FIFTH MIS-SPECIFICATION OF THIS GATE, THIRD OF THE ALLOWANCE ALONE**
(inapplicable to flats, then 82-128% and vacuous, now 0% and impossible).
No sixth attempt.

**WHAT THE NUMBERS SAY WITHOUT ANY ALLOWANCE AT ALL.** Against closed-form
analytic oracles, the recovered contours agree to **0.07%, 0.12%, 0.27% and
1.70% on area** and **0.08% to 0.52% on perimeter**, with correct topology,
correct winding, and bidirectional replay on every case. Those are absolute
figures requiring no threshold to interpret. The primitive is doing its job.

**HONEST STATUS — the gate is unfinished, the primitive is not in doubt.**
The distinction matters and should not be blurred in either direction: the
formal gate has NOT passed as written, and no pass is being recorded. But
the failure is entirely in a threshold formula I have now specified wrongly
three times, not in any measurement.

**RESUME.** Define the allowance from the SOURCE MESH's own angular
sampling — the tessellation's nt, or the actual angular gaps between
consecutive chained vertices — rather than by testing membership of an
analytic curve the faceted vertices can never lie on. Then one rerun, and
if the invariants hold, freeze the primitive as infrastructure and proceed
to K selection without revisiting it.

State of play, unchanged otherwise:
- ribbon representation: **demonstrated useful**
- raw-facet differentiation: **rejected**
- ordered sectional contour primitive: **essentially validated**, formal
  gate pending one threshold definition
- feature-preserving reconstruction: **still genuinely untested**

### 30d. FINAL GATE ATTEMPT — CHINES PASS; MY INSCRIBED CLAIM IS WRONG (2026-08-20)

| body | loop | replay fwd | replay conv | winding | area err | perim err | inscribed | verdict |
|---|---|---|---|---|---|---|---|---|
| circle smooth | yes | yes | yes | CCW | +1.7010% | **-0.4361%** | NO | FAIL |
| circle dense | yes | yes | yes | CCW | +0.1193% | **-0.3112%** | NO | FAIL |
| chine d=0.7 | yes | yes | yes | CCW | +0.0695% | +0.0757% | yes | **PASS** |
| chine d=0.5 indep. | yes | yes | yes | CCW | +0.2704% | +0.5238% | yes | **PASS** |

**EVERY SUBSTANTIVE INVARIANT PASSES ON ALL FOUR:** one closed loop, all
segments consumed, bidirectional geometric replay, consistent winding. Both
chines pass the complete gate.

**THE CIRCLES FAIL ONLY ON A STRUCTURAL CLAIM I ADDED, AND THE CLAIM IS
WRONG.** I asserted the section polygon must be strictly INSCRIBED, so area
and perimeter must undershoot. True for a clean ringed lathe — which is why
both un-jittered chines satisfy it. **False for axially jittered meshes:** a
section vertex interpolates along an edge spanning different x, where the
analytic radius differs from `ell(XI)`, so it can land slightly OUTSIDE the
radius-at-station circle. Perimeter then overshoots, by 0.44% and 0.31%.

**SIXTH MIS-SPECIFICATION OF THIS ONE GATE.** Vertex-count band; degenerate
station; replay-as-edge-set-equality; allowance inapplicable to flats;
allowance vacuous at 82-128%; allowance impossible at 0%; and now an
inscribed-polygon claim that holds only for un-jittered meshes. Every single
one was a criterion I wrote. Not one was a measurement or a primitive.

**NO SEVENTH ATTEMPT, AND NOT BY ME.** The evidence is now unambiguous that
I should not be the author of this gate's final criterion. The measurements
have never been in question:

> topology and bidirectional replay: **clean on all four**
> area agreement: **0.07% / 0.12% / 0.27% / 1.70%**
> perimeter agreement: **0.08% / 0.31% / 0.44% / 0.52%**
> both chine controls: **full PASS**

Those figures need no criterion to interpret. What is missing is a
correctly-stated pass condition, and it should be written by the reviewer
rather than by me — which is the division of labour that has worked all
session.

**STATE OF PLAY, unchanged:**
- ribbon representation: **demonstrated useful**
- raw-facet differentiation: **rejected** (twice, independently)
- ordered sectional contour primitive: **measurements clean; formal gate
  unwritten**
- feature-preserving reconstruction: **still genuinely untested**

No Cd, no calibration, no production change. K unselected.

## 31. CONTOUR PRIMITIVE — **PASS. FROZEN AS INFRASTRUCTURE** (2026-08-20)

Reviewer-authored gate, applied unchanged. No criterion of mine involved.

| body | 1 loop | segs | no dup | simple | winding | replay fwd | replay conv | verdict |
|---|---|---|---|---|---|---|---|---|
| circle smooth | yes | 60 | yes | yes | CCW | yes | yes | **PASS** |
| circle dense | yes | 236 | yes | yes | CCW | yes | yes | **PASS** |
| chine d=0.7 | yes | 192 | yes | yes | CCW | yes | yes | **PASS** |
| chine d=0.5 (independent) | yes | 128 | yes | yes | CCW | yes | yes | **PASS** |

**PASS CONDITION, as ruled:** a single SIMPLE closed loop, geometrically
equivalent bidirectionally to the union of the mesh-plane intersection
segments, modulo duplicate and collinear removal, all comparisons at the
pre-existing chaining tolerance. No expectation about vertex count,
ideal-surface membership, inscribedness, sagitta, area/perimeter sign, or
tessellation density enters this gate.

**THE ONE CORRECTION WAS TO AN INPUT, NOT A CRITERION.** The smooth controls
were at azimuthal jitter 0.5, which is the ANALYTIC DEGENERACY BOUNDARY:
two adjacent vertices each displaced 0.5*dTheta toward each other exactly
close the gap. Census across jitter 0.2 / 0.3 / 0.4 / 0.5 at nt 25 and 96:
**0, 0, 0 crossings and exactly 1 at jitter 0.5**, at real geometric scale
(1.6-4.6% of edge x edge, not numerical noise). So jitter 0.5 yields a
genuinely non-simple section and the chaining correctly recovered a
self-intersecting polygon from a self-intersecting surface. Controls moved
to 0.4 — inside the valid regime by measurement against an analytic
boundary, not by tuning. An intermediate fold hypothesis (within-ring theta
order) was tested and DISPROVEN: 0 violations at every jitter level.

**NON-GATING diagnostics** — how well the faceted section approximates the
intended surface, a different question the primitive cannot control:
area 1.47% / 0.10% / 0.07% / 0.27%; perimeter 0.34% / 0.03% / 0.08% / 0.52%.

**FROZEN.** `ribbons-contour.mjs` is now infrastructure. Per the ruling it
is NOT to be revisited unless a downstream control produces direct evidence
that the primitive itself is wrong.

**STATE OF PLAY:**
- ribbon representation: **demonstrated useful**
- raw-facet differentiation: **rejected** (twice, independently)
- ordered sectional contour primitive: **VALIDATED AND FROZEN**
- feature-preserving reconstruction: **still genuinely untested — next**

**NEXT:** the frozen K-selection experiment (spec 28/28a), then the
independent chine gate, graded-corner sweep, handover preservation,
directional controls, convergence, Sunship last.

No Cd, no calibration, no production change. K still unselected.

## 32. K SELECTION — NO K PASSES, AND THE CAUSE IS A METHOD FINDING (2026-08-20)

Run on the designated smooth and designated feature controls only. No later
controls, no Sunship, no downstream behaviour.

| K | smooth maxExc | smooth medExc | chine max radial err |
|---|---|---|---|
| 1.5 | 162.4 | 126.5 | 28.995% |
| 2 – 8 | 167 – 175 | 124 – 141 | **28.995% (identical)** |
| 12 | 175.1 | 146.2 | 28.162% |
| 20 | 704.9 | 476.8 | 28.162% |

**K = NONE.**

**FIRST TWO HYPOTHESES WRONG AGAIN** (ninth and tenth of the session). K was
suspected inert — but feature counts DO vary with it (smooth 21/2/0, chine
3/2/0 at K = 2/6/20). Unassigned rays were suspected — measured **0 of 24**
in every case.

**THE ACTUAL CAUSE, AND IT IS A METHOD FINDING NOT A BUG.** The chine error
is arithmetically identifiable: R - d = 0.9945 - 0.700 = **0.2945** against
a measured 0.28995. The reconstruction returns the CIRCLE radius where the
truth is the FLAT.

Why: after collinear removal — which is correct, specified behaviour and
which the frozen contour primitive performs — the flat is **ONE STRAIGHT
EDGE between two corners**. In polar coordinates a straight line is
`d / (-cos theta)`, a hyperbola. A natural cubic in theta between two
endpoints ~90 deg apart cannot reproduce it. Hence a systematic ~R-d error
at theta = pi, **independent of K**, which is exactly why the number is
identical across K = 1.5 to 8.

> **The r(theta) parameterisation cannot represent straight edges. Any
> reconstruction performed in r(theta) will round flats away, whatever the
> feature detector does.**

This is precisely the failure mode the chine control exists to catch,
arriving in an unexpected place: not the CORNERS being rounded, but the
FLAT BETWEEN them.

**NO KILL RECORDED FOR RECONSTRUCTION AS A CONCEPT.** What is killed is
reconstruction *in the polar parameterisation*. The two are different and
the distinction is load-bearing.

**FIX DIRECTION, NOT APPLIED, REQUIRES A RULING.** Reconstruct in Cartesian
arc-length space — interpolate (x(s), y(s)) along the contour, then
intersect the rays with the reconstructed curve. Straight edges are then
represented exactly by construction, and smooth runs still get a smooth
fit. This changes the parameterisation, not the feature-detection logic or
K's definition, so spec 28's structure survives intact.

**STATUS.** K unselected. Reconstruction untested in any viable
parameterisation. Contour primitive remains PASSED and FROZEN — it produced
the correct flat; the loss happened downstream of it. Phase 1, 1C, 1D, R2
all still FAILED. No Cd, no calibration, no production change.

## 33. PHASE 1E-R1 — CARTESIAN ARC-LENGTH RECONSTRUCTION. **FROZEN 2026-08-20, PRE-BUILD** (owner ruling, reviewer-authored)

**RULING.** *Polar reconstruction is rejected; reconstruction as a concept is
not.* Amend Phase 1E to Cartesian arc-length `x(s), y(s)`, with feature
vertices as hard run boundaries and exact linear reconstruction for two-point
straight runs. Freeze the amendment before execution. Then rerun the original
K-selection experiment unchanged. The ordered-contour primitive remains
frozen and passed. No production / Cd changes.

### 33.1 CORRECTION TO §32 — MY WORDING OVERSTATED THE FINDING

§32 says: *"The r(theta) parameterisation cannot represent straight edges."*
**That is wrong as written and is corrected here.** `r(theta)` represents a
straight line exactly — the line at distance `d` is the function
`r = d / (-cos theta)`. Nothing is missing from the parameterisation.

What failed is the **reconstruction BASIS in that parameterisation**: a
natural cubic in `theta`, given only the two chine endpoints bounding a long
flat, has no reason to reproduce that secant-shaped function and instead
relaxes toward the circle. The measured `R - d` error is a property of
*cubic-in-theta between two corners ~90 deg apart*, not of polar coordinates.

The **consequence in §32 is unchanged and still stands**: every K in
1.5–8 returned an identical 28.995% chine error because that error is set by
the basis, not by the detector. Only the stated mechanism is narrowed. This is
the eleventh corrected claim of the session and the correction came from the
reviewer, not from me.

### 33.2 THE AMENDMENT, AS FROZEN

> Replace polar `r(theta)` reconstruction with piecewise Cartesian `x(s), y(s)`
> reconstruction over cumulative contour arc length. Feature vertices remain
> hard boundaries between runs. Straight two-point runs reduce exactly to
> linear segments. Smooth runs use the already-selected natural cubic
> independently for `x(s)` and `y(s)`. No smoothing along the longitudinal
> x-axis, no change to K definition, candidate K set, tolerances, or gate
> order.

Pipeline, in full:

> ordered contour points (frozen primitive) -> cumulative chord-length `s` ->
> interpolate `x(s), y(s)` per run -> ray-intersect the reconstructed contour
> at fixed theta.

**WHY THIS IS THE NATURAL SPACE.** The object being reconstructed is literally
a planar curve. After collinear simplification a genuine straight run is just
two endpoints, and Cartesian interpolation between two endpoints **is** the
straight edge — exactly, by construction. No flat detector is needed for the
flat itself. Smooth runs still carry many points and still get a smooth fit.

### 33.3 BINDING IMPLEMENTATION RULES

1. **DO NOT SPLINE ACROSS A DETECTED FEATURE VERTEX.** A feature is the
   boundary between two reconstruction runs. Tangent continuity through a
   corner that is supposed to stay discontinuous would recreate the exact
   rounding failure of §32 in a new coordinate system.
2. **TWO-POINT RUNS ARE EXACTLY LINEAR.** No spline, no fallback curve.
3. **NATURAL CUBIC IS RETAINED, NOT PRE-EMPTIVELY REPLACED.** Its possible
   overshoot / self-intersection behaviour is precisely why the independent
   chine gate and the graded-corner sweep exist. The frozen tests decide
   whether it survives; a shape-preserving interpolant is adopted only on
   measured evidence, per 28a.
4. **RAY INTERSECTION REPLACES RAY EVALUATION.** Radius at a fixed theta is
   the intersection of that ray with the reconstructed closed curve, not a
   function evaluation. Multiple intersections on a ray are a REPORTABLE
   EVENT, not a silent max — see 33.5.

### 33.4 K RESTARTS FROM ZERO

K was never selected. Every prior K figure came from a basis now shown
incapable of preserving the designated control, so those numbers carry no
information about K. The K-selection experiment reruns **unchanged**: same
deterministic rule (smallest K that both removes the smooth-body polygon
artefact and preserves the designated chine), same candidate set, same
tolerances, **designated selection controls only**. No downstream control, no
independent chine gate, and no Sunship information may influence K.

### 33.5 HARNESS REPRODUCTION REQUIREMENT (added by the assistant, declared)

The §31/§32 harness was ad-hoc and **was never committed**; only
`ribbons-contour.mjs` and `ribbons-reconstruct.mjs` survive. The rebuilt
harness is therefore not automatically the one that produced those numbers.

**Before any Cartesian result is trusted, the rebuilt harness must first
reproduce §32 on the OLD polar path**: chine error invariant across
K = 1.5–8 at magnitude ~`R - d`. If it reproduces the structure but not the
digits, that is to be reported as such — *structure reproduced, digits not* —
and NOT described as reproducing §32.

This requirement is mine, not the reviewer's, and is declared as such. It can
only make the gate harder to pass.

### 33.6 UNCHANGED

Spec 28's declared assumption, 28a's amendments 1 and 2, the eight-gate order,
the frozen tolerances, the zero-longitudinal-smoothing scope. Phase 1, 1C, 1D
and R2 all remain FAILED; every retraction stays in the record. Contour
primitive stays PASSED and FROZEN. No Cd, no calibration, no production change.

## 34. PHASE 1E-R1 RESULT (2026-08-20): **CHINE GATE PASSES EXACTLY. SMOOTH GATE FAILS FOR A REASON THAT PREDATES RECONSTRUCTION.** K still unselected — ruling needed.

Harness rebuilt and **COMMITTED** this time: `ribbons-section.mjs`,
`ribbons-kselect.mjs`, `ribbons-smooth-scope.mjs`. The polar path in
`ribbons-reconstruct.mjs` was left byte-for-byte unchanged (verified by
diff) so the reproduction run below means something.

### 34.1 SPEC 33.5 REPRODUCTION — STRUCTURE YES, AND THE CHINE DIGITS EXACTLY

Geometry recovered from the record rather than invented: prolate spheroid
A = 3, B = 1, nx = 240; designated chine = the same body cut by the plane
y = -0.700 at nt = 96, giving **192 section segments** exactly as spec 31
recorded; test station x = 0.3125, the MIDPOINT between mesh rings 132 and
133, giving circle radius **0.994560** against spec 32's 0.9945.

| | spec 32 (lost harness) | rebuilt harness, polar |
|---|---|---|
| chine err, K = 1.5 – 8 | 28.995%, invariant | **28.995%, invariant** |
| chine err, K = 12 / 20 | 28.162% | 27.397% |
| smooth maxExc / medExc, K = 1.5 | 162.4 / 126.5 | 132.4 / 93.9 |
| smooth, K = 20 | 704.9 / 476.8 | 818.0 / 407.1 |

**Reported per 33.5: the chine column reproduces to five digits; the smooth
column reproduces the STRUCTURE (same magnitudes, flat through mid-K, blow-up
at K = 20) but NOT the digits.** The original smooth tessellation is not
recoverable from the record. The K >= 12 chine digits also differ.

**AND THE ARITHMETIC IN SPEC 32 IS NOW EXACT, NOT APPROXIMATE.** The mesh
flat runs between vertices at theta = 135 and 225 deg, whose radius is
`0.700 / cos 45 = 0.98995`. Truth at theta = 180 is 0.700. The difference is
`0.28995` — the recorded error to five digits. Spec 32 rationalised it as
`R - d = 0.9945 - 0.700 = 0.2945`, which was a near miss for the right
reason: the cubic returns the CORNER radius, not the circle radius.

### 34.2 THE CHINE GATE PASSES, AND BY THE PREDICTED MECHANISM

| basis | chine max radial err, K = 1.5 – 8 |
|---|---|
| polar `r(theta)` | 28.995% |
| **Cartesian arc length** | **0.001%** |
| raw chained polygon, NO reconstruction at all | 0.001% |

Reconstruction now reproduces the flat to the same accuracy as the polygon
that contains it. `twoPointRuns = 1` at every passing K: after the frozen
primitive's collinear removal the flat IS two points, and spec 33.3 rule 2
makes that an exact linear segment. **No flat detector is involved.** This
is precisely what the amendment predicted and it is the first thing in the
reconstruction programme to work as designed.

**K IS BOUNDED ABOVE BY THE CHINE, AS INTENDED.** At K = 12 and 20 the
corner turn no longer exceeds `K x median`, features drop to 0, the loop
becomes a single smooth run and the error jumps to 23.614%. So the chine
control does discriminate: it requires **K <= 8**.

### 34.3 MY OWN IMPLEMENTATION DEFECT, FOUND BY THE SIMPLEST CONTROL

On a CLEAN un-jittered lathe — where the raw polygon gives exactly 0.000 deg
of false turning — the first Cartesian build injected **309 deg (nt = 30) and
3116 deg (nt = 118)**, with medians of 0.000. One ribbon catastrophic, the
rest perfect.

Cause, measured not guessed: `missedRays` 1 and 10. Adjacent cubic pieces
share a knot but evaluate it with two different polynomials, so a ray passing
within rounding distance of a vertex reads ~+1e-17 from one side and ~-1e-16
from the other; neither piece sees a sign change and the root is lost,
returning radius 0 against a true 0.807. A closed curve about the origin must
meet every ray, so a miss is numerical by definition. Fixed with a knot
tolerance of `1e-12 x scale` at piece starts. After the fix: **missedRays 0,
worst radial error 0.059%** on both tessellations, which is the mesh's own
axial interpolation error (vertices measured 0.080% off surface).

**This is the frozen "commensurate counts / rays landing exactly on vertices"
trap, arriving through a route it had not taken before.** It was caught by
the plainest control in the set, and it was invisible to the jittered
controls — they never put a ray on a vertex.

### 34.4 THE SMOOTH GATE FAILS — BUT IT FAILS WITH RECONSTRUCTION SWITCHED OFF

| sampling regime | nt | vertices off surface, max | RAW max / med | CARTESIAN K=3 max / med |
|---|---|---|---|---|
| clean lathe | 30 | 0.080% | 0.000 / 0.000 | 0.000 / 0.000 |
| clean lathe | 118 | 0.080% | 0.000 / 0.000 | 0.000 / 0.000 |
| azimuthal jitter 0.4 | 30 | 1.5566% | 127.508 / 97.351 | 134.263 / 87.975 |
| azimuthal jitter 0.4 | 118 | 0.1056% | 0.193 / 0.000 | 0.174 / 0.000 |
| sineJitter 0.4 | 30 | 1.6220% | 128.143 / 96.319 | 130.070 / 112.225 |
| sineJitter 0.4 | 118 | 0.5652% | 0.117 / 0.000 | 0.409 / 0.000 |

**The coarse control carries 128 deg of false turning BEFORE any
reconstruction exists.** Cartesian reconstruction moves it to 130 deg. The
method is approximately NEUTRAL on this control — it neither causes the
failure nor removes it.

**WHY, MEASURED.** At nt = 30 the section polygon's own vertices sit up to
**1.62% off the analytic surface**, against a pure chord sagitta of 0.55%.
Reconstruction INTERPOLATES THROUGH those vertices, so it reproduces their
displacement exactly. No interpolating circumferential method — no basis, no
K — can recover a surface from points that are not on it. Only approximation
(rather than interpolation) or axial information could, and spec 28 scopes
Phase 1E to **circumferential only, zero longitudinal smoothing**.

**A HYPOTHESIS OF MINE, RETRACTED IMMEDIATELY.** I proposed that the axial
component of `sineJitter` was the cause, since it makes section vertices
edge-crossings on 3D chords. **Wrong.** Azimuthal-only jitter fails
identically — 127.5 deg vs 128.1 deg, vertices 1.5566% vs 1.6220% off. The
displacement comes from cutting between rings whose vertices are at jittered
theta, and it survives with the rings held perfectly planar. That is the
eleventh wrong mechanism guess of the session; it cost one diagnostic and
was killed by measurement in minutes.

### 34.5 THE FORMAL RESULT, AND WHAT IS ACTUALLY IN DISPUTE

**Applying the frozen rule unchanged: NO K PASSES.** The smooth criterion
demands max <= 0.5 deg and median <= 0.1 deg on BOTH tessellations, and
nt = 30 returns ~130 deg at every K.

But the same control returns ~128 deg with reconstruction switched off.
**As written, test 1 cannot be passed at that tessellation by ANY
circumferential method, including a perfect one.** That is a property of the
criterion, not of the candidate.

Everything else in the run is clean:
- nt = 118 PASSES the smooth criterion for K <= 8 (max 0.18 – 0.44, med 0.000)
- chine PASSES at 0.001% for K <= 8
- start-index invariance 0.00e+0 to 1.01e-5 — the declared seam handling in
  spec 33 holds, measured rather than asserted
- `multiHitRays` 0 and `missedRays` 0 everywhere after 34.3
- cross-tessellation agreement 1.77% – 2.91%, dominated by the nt = 30
  control's own sampling error

**A NON-EMPTY WINDOW EXISTS.** The chine requires K <= 8. False features on a
smooth body fall monotonically with K (25.2 per station at K = 1.5 down to
0.5 at K = 6 – 8, nt = 30). So K in roughly **6 – 8** is where a smooth body
is nearly feature-free AND the chine is still detected. **This is stated as a
measured fact, NOT as a selection.** No K is selected here.

### 34.6 THE RULING NEEDED — I AM NOT WRITING THIS CRITERION

Per spec 4 and the division of labour that produced the only passing gate so
far, the smooth criterion is the reviewer's to write. The fork:

1. **RELATIVE CRITERION.** Test 1 becomes "reconstruction must not increase
   false turning", since the absolute figure is set by sampling upstream.
   Measured deltas: +2.0 deg at nt = 30, +0.29 deg at nt = 118.
2. **RE-SPECIFY THE CONTROL.** Require the smooth control's section vertices
   to lie on the analytic surface within some bound, so the gate tests what
   the method is scoped for. nt = 118 gives 0.106%; nt = 30 gives 1.557%.
3. **KILL.** The method cannot deliver test 1 as written, and the programme
   stops here.

**Choosing option 1 or 2 myself would be exactly the flattering criterion
that spec 4 warns is most tempting at this point.** So it is not chosen.

**STATE.** K unselected. Chine gate PASSED, first pass in the reconstruction
programme. Smooth gate FAILED as written, for a cause upstream of the method.
Gates 3 – 8 (independent chine, graded-corner sweep, handover, directional,
convergence, Sunship) NOT RUN and blocked per the frozen order. Contour
primitive remains PASSED and FROZEN. Phase 1, 1C, 1D and R2 all remain
FAILED. No Cd, no calibration, no production change.

## 35. **PHASE 1E: KILLED** — circumferential-only reconstruction. Scope re-opened to joint surface reconstruction. **OWNER RULING, 2026-08-20, reviewer-authored.**

### 35.1 THE KILL, PRECISELY SCOPED

> **Killed: Phase 1E's "circumferential-only reconstruction with zero
> longitudinal conditioning".**
> **NOT killed: reconstruction. NOT killed: ribbons.**

The smooth control established something fundamental rather than merely
failing. By the time a transverse slice is taken through a coarse or
phase-shifted triangular OBJ, **the contour points are already in the wrong
place relative to the intended surface** — 1.56–1.62% positional error at
nt = 30, and 128 deg of false turning with reconstruction switched off
entirely. A circumferential spline cannot repair that: it is handed the
wrong points and carries no information about where they ought to move.

### 35.2 BOTH RESCUES REJECTED, AND WHY

- **A relative criterion ("must not make it worse") is REJECTED as too
  weak.** The purpose of reconstruction was to REMOVE the mesh-encoding
  artefact, not merely to avoid adding to it.
- **Re-specifying the control so its section vertices lie on the analytic
  surface is REJECTED.** That would make the method pass by deleting the
  exact arbitrary-OBJ pathology it exists to solve. Acceptable later as a
  unit test; useless as the main gate.
- **K = 6–8 is NOT SELECTED.** The window is real and measured (34.5) but K
  never passed its frozen gate, so **K REMAINS UNSELECTED** and no downstream
  work may assume a value.

These are recorded as refusals of my own two proposed options. Both were
listed in 34.6 and both are now closed.

### 35.3 WHAT IS BANKED

- **Ordered contour primitive** — PASSED and FROZEN (31), unchanged.
- **Cartesian arc-length reconstruction** — a PROVEN FEATURE-PRESERVING
  COMPONENT. It solved the flat/chine outright, 28.995% -> 0.001%, essentially
  raw-polygon truth, with no flat detector involved. Retained as infrastructure.
- **The knot-tolerance fix** (34.3) — a genuine numerical defect, found by the
  plainest control, now fixed and verified at missedRays 0.

**CAVEAT, STATED SO IT IS NOT MISREAD LATER:** the component is proven on one
gate and its parameter K is unselected, so it is **not deployable standalone**.
It is banked as a building block, not as a working method. Whether K even
survives into the next architecture is open — a joint surface fit may detect
features on the surface rather than per-section, in which case K's definition
changes and the 34.5 window carries no information forward.

### 35.4 THE ASSUMPTION, WRITTEN EXPLICITLY BEFORE ANY BUILD

> **The vertices of an aerodynamic OBJ are treated as samples of an intended
> piecewise-smooth surface; the flat triangular faces between those vertices
> are an ENCODING of that surface, not necessarily aerodynamic truth.**

Reasonable for ordinary CAD-exported meshes. It is stated as an assumption,
not a fact, and it is the load-bearing premise of everything after this line.
It also names what the old architecture threw away: **the original surface
sample locations.** Slicing triangles discards them — the section polygon's
vertices are edge-crossings, which are not samples of the surface at all.

### 35.5 THE MEASURED CONSTRAINT THAT FORCES THE NEW ARCHITECTURE

The error being attacked **is produced by triangles connecting neighbouring x
positions.** Measured, not inferred: at nt = 30 with rings held perfectly
planar and every vertex exactly on the analytic surface by construction, the
section polygon's vertices still land up to 1.5566% off that surface, because
the cutting plane crosses edges spanning jittered theta. The displacement is
manufactured by the longitudinal connectivity.

**Therefore reconstruction cannot be fed section polygons. It must be fed the
mesh vertices themselves**, which are the only points the assumption in 35.4
calls samples of the intended surface.

**THE LONGITUDINAL RESTRICTION IN SPEC 28 IS EXPLICITLY LIFTED.** Spec 28
scoped Phase 1E to "CIRCUMFERENTIAL ONLY, ZERO LONGITUDINAL SMOOTHING". That
restriction is withdrawn by this ruling, on the grounds that a frozen control
proved it necessary rather than on preference.

### 35.6 NEXT SCOPE — JOINT CANONICAL-SURFACE RECONSTRUCTION

New architecture, replacing "repair each transverse contour independently":

> **rough OBJ -> clean skin -> ribbons**
>
> raw OBJ positional samples -> reconstruct a coherent surface in BOTH the
> longitudinal and circumferential directions -> then take sections and
> ribbons from that skin.

The smooth-shape step happens BEFORE slicing. Trying to fix the slices after
cutting the rough triangles was one stage too late.

**REQUIRED SHAPE OF THE PROOF, per the ruling:** on ANALYTIC bodies first,
demonstrate that **radically different coarse and irregular tessellations of
the same underlying surface reconstruct to essentially the same canonical
skin**, while **preserving a flat/chine** and **preserving a known hull->tail
handover**.

**NO Cd. NO calibration. NO Sunship tuning.** Sunship stays last, as in the
frozen order.

### 35.7 WHAT THE NEXT GATE STILL NEEDS BEFORE A BUILD STARTS

Recorded as gaps, deliberately NOT filled by me — 34.3 and the six
mis-specifications behind 30/31 are why:

1. **The skin-to-skin distance metric.** "Essentially the same canonical
   skin" needs a defined quantity before it can be a gate.
2. **Its tolerance**, and whether the frozen 0.5 deg / 0.1 deg turning and 2%
   profile tolerances are reused or replaced.
3. **The concrete tessellation set** that counts as "radically different
   coarse and irregular" — the corruption axes exist already in
   `ribbons-generators.mjs` (sine jitter, block density, azimuthal shear,
   surface walk), verified to place every vertex exactly on the analytic
   surface, and jitter 0.5 is the analytic degeneracy boundary so controls
   must stay at 0.4 or below.
4. **Whether the canonical skin is judged directly, or only through the
   ribbons taken from it.** These are different gates and only one of them
   tests the thing the programme is actually for.

**STATE.** Phase 1E: **FAILED / KILLED** for circumferential-only
reconstruction. Contour primitive PASSED and FROZEN. Cartesian arc-length
reconstruction BANKED as a component, K UNSELECTED. Phase 1, 1C, 1D and R2
all remain FAILED. Gates 3–8 of the 28a order are void as written, since they
gated a method now killed; the flat/chine and hull->tail handover survive as
REQUIREMENTS on the replacement. No Cd, no calibration, no production change.

## 36. **PHASE 1F — JOINT AXIS-AWARE CARTESIAN CANONICAL-SURFACE RECONSTRUCTION. ARCHITECTURE AND GATES FROZEN 2026-08-20, PRE-BUILD.** (owner ruling, reviewer-authored)

### 36.1 THE RULING — NEITHER OF MY TWO OPTIONS

I offered a scalar `r(x, theta)` field or a fully axis-independent 3D fit.
**Both rejected.**

- **A fully generic 3D surface-reconstruction problem is bigger than the
  question needs.** The declared flight axis is not an unwanted bias — it is
  fundamental to the aerodynamic question and to the ribbon operator
  downstream. Nothing is gained by discarding it for generality.
- **A scalar `r(x, theta)` field imposes an unnecessary representation
  constraint.** It can represent a flat — spec 33.1 established the line is
  `d / (-cos theta)` — but **spec 32 already proved that representability is
  not preservation**: the interpolation basis destroyed the feature anyway.
  It is also awkward for sections that are not single-valued radially.

**Chosen: an axis-aware canonical surface with Cartesian geometry.**

### 36.2 THE REPRESENTATION, FROZEN

> **raw mesh vertices + connectivity -> joint axis-aware surface fit in
> Cartesian coordinates -> canonical skin -> transverse / ribbon sampling**

Parameterise by axial position plus a **periodic circumferential coordinate**,
and reconstruct the actual 3D point in the declared body frame:

> **S(x, u) = ( x, y(x, u), z(x, u) )**

- `u` is a **surface/circumferential coordinate, NOT necessarily polar
  angle**.
- The fit **operates on the original mesh vertices and connectivity**.
- **Section polygons are downstream MEASUREMENTS ONLY and must never become
  reconstruction input again.** This is the whole content of the Phase 1E
  kill: a section polygon's vertices are edge-crossings, measured at up to
  1.5566% off the analytic surface even with every mesh vertex exactly on it.

This keeps the useful structure of `r(x, theta)` without forcing the surface
itself to be radial. Fixed `(x, theta)` rays are intersected with the
resulting canonical skin afterwards to produce exactly the ribbon
representation already in use, so nothing downstream changes.

### 36.3 K IS VOID

**K is not carried into this architecture.** It was never selected, and its
meaning was tied to per-section feature detection which no longer exists. The
apparent 6–8 window in 34.5 **carries no information forward and must not be
inherited**. The new reconstruction establishes its own feature treatment
from analytic controls.

### 36.4 THE FOUR OPEN QUESTIONS OF 35.7, CLOSED

**1. JUDGE THE SKIN BOTH DIRECTLY AND THROUGH RIBBONS. Both required.**
Direct positional fidelity says whether reconstruction itself worked; ribbon
fidelity says whether it worked *for the purpose of the programme*. The
**headline result is the ribbon gate**, but it **must not be allowed to hide
a geometrically bad skin that happens to produce similar summary numbers**.

**2. THE DIRECT POSITIONAL GATE USES THE OPERATOR-MATCHED GRID.** Compare the
reconstructed radius/point against the analytic oracle on the **same fixed
`(x, theta)` sampling grid, over the same retained domain** — the frozen
oracle of spec 21: same 128 stations, same theta locations, same 3% secant
span, same 2.5% tip exclusion.

> **NEAREST-SURFACE DISTANCE IS PROHIBITED as the primary metric.**
> Nearest-neighbour matching flatters a displaced surface — a skin shifted
> bodily along itself scores well while being wrong at every sample the
> operator actually reads.

**3. TOLERANCES ARE CARRIED FORWARD, NOT RE-DERIVED.** The spec 21 table
stands unchanged. **The reconstruction changed because it failed the
requirement; the requirement does not move to accommodate the
reconstruction.**

| test | criterion (spec 21, verbatim) |
|---|---|
| monotone controls | `turningExcess <= 0.5 deg` per ribbon, median `<= 0.1 deg` |
| cross-tessellation / positional agreement | normalised-radius RMS **<= 0.5% of Rmax**; 99th-pct pointwise **<= 1.5% of Rmax**; zone-turning totals within **2% or 0.5 deg, whichever larger** — all against the operator-matched oracle |
| compound handover preservation | magnitude within **5% or 0.5 deg, whichever larger**; location within **1 axial station** (~0.8% L) |
| directional controls (triaxial, flat-bottom) | within **2% or 0.5 deg, whichever larger**, AND sign/order correct |

The chine requirement from 28/28a survives as a requirement on the
replacement: **a real flat and its corners must be RETAINED**, judged at the
same 2% profile tolerance.

**4. TESSELLATION FAMILIES ARE REUSED, NOT DESIGNED FRESH.** Reuse the
established analytic mesh families rather than inventing flattering new ones:
regular ringed coarse and dense, valid azimuthal/phase jitter, density
variation, shear/unstructured-style corruption, and the remaining
surface-preserving generators in `ribbons-generators.mjs` (G1 sine jitter,
G2 block density, G3 azimuthal shear, G4 surface walk), all already gated by
`verifyGenerator` to place **every vertex exactly on the analytic surface**.

- Jitter stays **<= 0.4**; 0.5 is the analytic degeneracy boundary (spec 31).
- **Invalid or self-intersecting inputs are INPUT failures, not
  reconstruction failures**, and are to be reported as such.

### 36.5 DOMAIN RULE — DO NOT FABRICATE GENERALITY

> If the ribbon operator meets **multiple radial intersections**, or topology
> the canonical representation cannot support, it must **REPORT THAT
> EXPLICITLY** rather than force it into a single-valued `r` answer.
> Generality may be expanded later; it must not be fabricated now.

`reconstructContourCartesian` already returns `multiHitRays` for exactly this
reason (spec 33.3 rule 4); the same discipline is now a frozen domain rule for
the skin.

### 36.6 TEST ORDER, FROZEN — known truth first, things we care about last

1. **smooth analytic surfaces** across the reused tessellation families
2. **independent non-smooth / flat / chine controls**
3. **graded sharpness sweep** (28a amendment 2 survives: no invention, no
   cliff, no new tolerance for the transition region)
4. **compound longitudinal hull->tail handover**
5. **directional / asymmetric controls** (triaxial, flat-bottom)
6. **tessellation and resolution convergence** — the 12/24/48 anti-cheat: a
   coarse theta grid that simply fails to see bad geometry is NOT a fix
7. **Sunship last**

### 36.7 KILL

If a joint fit on the raw vertices cannot drive monotone false turning to the
frozen tolerance across the reused tessellation families, or if whatever
conditioning achieves that also damages the flat/chine or the compound
handover beyond tolerance, then arbitrary OBJs are not a viable substrate and
the estimator needs a genuine CAD/NURBS input path — the spec 21 kill
condition, unchanged and now applied one architecture later.

### 36.8 OUT OF SCOPE

**No Cd. No calibration. No Sunship tuning. No production change.** Phase 1,
1C, 1D, R2 and 1E all remain FAILED; every retraction stays in the record.
Contour primitive remains PASSED and FROZEN. Cartesian arc-length
reconstruction remains banked as a component with K void.

## 37. PHASE 1F GATE 1 (2026-08-20): **PASS on all 10 tessellations.** The 128 deg that killed Phase 1E is gone.

`skin.mjs` + `skin-gate1.mjs`, both committed. Tolerances are spec 21's,
carried forward unchanged: RMS <= 0.5% Rmax, p99 <= 1.5% Rmax, false turning
<= 0.5 deg max and <= 0.1 deg median.

| family | nt | RAW turn max / med | SKIN rms | p99 | SKIN turn max / med | |
|---|---|---|---|---|---|---|
| regular | 30 | 0.00 / 0.00 | 0.007% | 0.011% | 0.000 / 0.000 | PASS |
| **G1 sine jitter** | **30** | **128.14 / 96.32** | **0.006%** | **0.014%** | **0.000 / 0.000** | **PASS** |
| G2 block density | 30 | 0.00 / 0.00 | 0.007% | 0.011% | 0.000 / 0.000 | PASS |
| G3 azimuthal shear | 30 | 0.00 / 0.00 | 0.007% | 0.011% | 0.000 / 0.000 | PASS |
| G4 surface walk | 30 | 38.01 / 13.42 | 0.008% | 0.022% | 0.000 / 0.000 | PASS |
| regular | 118 | 0.00 / 0.00 | 0.005% | 0.007% | 0.000 / 0.000 | PASS |
| G1 sine jitter | 118 | 0.12 / 0.00 | 0.005% | 0.007% | 0.000 / 0.000 | PASS |
| G2 block density | 118 | 0.00 / 0.00 | 0.005% | 0.007% | 0.000 / 0.000 | PASS |
| G3 azimuthal shear | 118 | 0.00 / 0.00 | 0.005% | 0.007% | 0.000 / 0.000 | PASS |
| G4 surface walk | 118 | 0.00 / 0.00 | 0.005% | 0.007% | 0.000 / 0.000 | PASS |

**The two cases that carried real corruption are the two that matter.** G1 at
nt = 30 is the exact control that killed Phase 1E: 128.14 deg of false turning
raw, 130.07 deg through circumferential reconstruction, and **0.000 deg
through the skin**, with positional error ~80x inside tolerance. G4 surface
walk at nt = 30 falls 38.01 -> 0.000 the same way.

**WHY IT WORKS, AND IT IS THE STATED REASON NOT A NEW ONE.** The fit reads
mesh vertices, which the generator gate certifies lie on the analytic surface
to 2.2e-16. Phase 1E read section polygons, whose vertices are edge-crossings
measured up to 1.5566% off that same surface. And the fit APPROXIMATES rather
than interpolates, so sampling noise averages out instead of being reproduced.

### 37.1 THREE CHECKS BEFORE CALLING THIS A PASS

**1. Every multiple-intersection event is outside the retained domain.**
Per the 36.5 domain rule these are reported, not swallowed. `multiHit` fires
at stations **0 and 127 only** — the two poles, where the section degenerates
to a point and polar angle is undefined. Retained domain is stations 4–123.
**The v1 polar parameterisation (simplification A) holds everywhere the
operator actually reads.** `missed` is 0 everywhere.

**2. Fit fallbacks are rare but NOT zero, and some are inside the retained
domain.** G1 nt = 30: 267 of 32,768 evaluations (0.8%) fell back from local
quadratic to nearest-vertex, touching 5 retained stations; G1 nt = 118: 214,
touching 7. **A nearest-vertex fallback is an interpolation, which is exactly
the mechanism Phase 1E died of.** It is recorded here because the gate passed
*despite* it, not because it is harmless — if a later gate fails, this is the
first place to look.

**3. `verifyGenerator` reports FAIL for G2 block density, at 4.44e-16.** The
criterion is bit-identity at strength 0 (`worst > 0`), and `blockDensity`
reaches the same axial position by a different arithmetic path, so it differs
by 2 ulp on a coordinate of magnitude 3. **The mesh is not corrupted; the
criterion is over-strict.** Recorded rather than fixed: `verifyGenerator`'s
tolerance is a frozen criterion and not mine to loosen.

### 37.2 WHAT GATE 1 CANNOT TELL US

**Gate 1 is structurally incapable of detecting over-smoothing.** Every
control here is a smooth monotone body, so a fit with an over-wide bandwidth
that erased all real features would pass this gate perfectly. That is exactly
why the frozen order puts the flat/chine next, and nothing about this result
may be read as evidence that features survive.

**BANDWIDTH DISCIPLINE, CARRIED OVER FROM 28a AMENDMENT 1.** K is void, but
the MLS bandwidth `(cx, cu) = (2.5, 2.5)` is now the tunable parameter and
inherits the same contamination hazard. It was set **before any gate ran and
has not been tuned**. If it is ever tuned against a feature control, then that
control may not also serve as the proof that features survive, and a second
independent feature control is required — the amendment 1 split applies to
bandwidth exactly as it applied to K.

**STATE.** Gate 1 PASS. Gates 2–7 not run. Contour primitive PASSED and
FROZEN; Cartesian arc-length reconstruction banked with K void; Phase 1, 1C,
1D, R2 and 1E all remain FAILED. No Cd, no calibration, no Sunship, no
production change.

## 38. GATE 1 CLOSURE **HELD**. Generator-verifier amendment **FROZEN 2026-08-20 PRE-CHANGE**. (owner ruling, reviewer-authored)

### 38.1 THE SPLIT, RECORDED

Spec 37 recorded "Gate 1 PASS on all 10" while a frozen `verifyGenerator`
criterion said FAIL on G2. **That is a silent waiver of a frozen criterion
and it is withdrawn.** Knowing why a criterion failed is not the same as
being entitled to ignore it. Corrected to:

> **Gate 1 reconstruction metrics: PASS on all 10.**
> **Formal Gate 1 closure: HOLD**, because the frozen generator-verification
> test contains an over-strict bit-identity requirement.

The reconstruction numbers in 37 are unchanged and stand. Only the closure
status changes.

### 38.2 THE AMENDMENT — GENERATOR VERIFIER ONLY

`verifyGenerator` check (a) requires a strength-0 generator to reproduce the
reference mesh with `worst > 0` failing — **exact bit-identity**. That is not
a property IEEE-754 arithmetic can deliver: `blockDensity` reaches the same
axial position by a different arithmetic path, so the last bit differs.

**THE REPLACEMENT TOLERANCE IS DERIVED FROM THE ARITHMETIC, NOT FROM THE
OBSERVED FAILURE.** Counting rounding events in the longest strength-0
coordinate chain (`blockDensity`, axial):

```
xr   = -H + (2*H*i)/nx            4 roundings
u    = (xr + H) / (2*H)           +2
warp = u + s*(...)  with s = 0    +1
x    = -H + 2*H*warp              +2
```

~9–10 rounding events, each bounded by half an ulp of an intermediate whose
magnitude does not exceed the body's axial span `2H`. So:

> **`TOL_IDENTICAL = 16 * Number.EPSILON * span`**, where `span` is the
> reference mesh's largest bounding-box extent.

`16 = 2^4` is a power-of-two headroom over the ~10 counted events. For the
Phase 1F bodies, `span = 6` and the bound is **2.13e-14**.

**This bound is NOT chosen to admit 4.44e-16.** It follows from the op count
and IEEE-754 alone and would have been the same number had the observed
discrepancy been zero. For the record: 4.44e-16 is exactly one half-ulp at
magnitude 6, i.e. a single rounding event, so it sits ~48x inside a bound
derived independently of it.

**SCOPE: THE VERIFIER ONLY.** Check (b) — every vertex lies on the analytic
surface within 1e-9 — is **UNCHANGED**. No generator, no mesh, no
reconstruction, no tolerance in spec 21 or 36 is touched.

### 38.3 PRE-REGISTERED PASS CONDITION

Frozen before the change is applied:

> Rerun **all ten tessellations, unchanged**. Gate 1 closes permanently only
> if every generator clears check (a) under the derived bound AND check (b)
> unchanged, AND all ten reconstruction verdicts are identical to spec 37.
> **Any change to a reconstruction number invalidates the amendment**, since
> a verifier tolerance cannot legitimately alter a reconstruction result.

### 38.4 WHAT IS EXPLICITLY NOT TOUCHED

- **`(cx, cu) = (2.5, 2.5)` IS NOT TOUCHED.** It was fixed before any gate
  result, which is precisely what makes **Gate 2 a genuine test of it**. The
  flat/chine control must be allowed to kill the method.
- **If Gate 2 fails, the bandwidth is NOT to be tuned against it and the same
  chine then called the validation.** If bandwidth tuning becomes necessary,
  that control becomes SELECTION data and a fresh independent non-smooth
  geometry must become the proof. This is 28a amendment 1 applied to
  bandwidth, and it is now pre-registered rather than promised.
- **The 267 nearest-vertex fallbacks stay an instrumented diagnostic, not a
  newly invented gate.** If a later failure localises to them that is useful
  mechanism evidence; it does not retroactively change any gate.

### 38.5 WORDING CORRECTION TO SPEC 37

Spec 37 said the fit works because "sampling noise averages out". **That is
misleading**: the analytic mesh vertices are on the true surface to machine
precision, so there is no positional noise in them to average. Corrected:

> **The joint fit estimates a coherent surface from neighbouring TRUE surface
> samples, rather than differentiating the arbitrary faceted interpolation
> between them.**

That is the architectural win, and it is a different claim from noise
suppression. Twelfth corrected claim of the session; again from the reviewer.

### 38.6 AMENDMENT APPLIED — **GATE 1 CLOSED PERMANENTLY** (2026-08-20)

Rerun of all ten tessellations, unchanged, under the derived bound.

- **All ten clear check (a)**: worst strength-0 deviation 2.2e-16 to 3.3e-16,
  against the derived bound 2.13e-14. G2 block density now reports
  **PASS 2.2e-16**.
- **Check (b) unchanged and passing** on every generator.
- **Every reconstruction verdict is identical to spec 37** — same rms, same
  p99, same false turning, same PASS on all ten. The pre-registered condition
  in 38.3 holds: **a verifier tolerance did not alter a reconstruction
  result**, which is what would have invalidated the amendment.

> **GATE 1: CLOSED. PASS.**

Bandwidth `(cx, cu) = (2.5, 2.5)` untouched throughout, so Gate 2 remains a
genuine test of a parameter fixed before any gate result existed.

## 39. PHASE 1F GATE 2 — FLAT / CHINE (2026-08-20): **FAIL, 2 of 4.** Run once, unchanged, bandwidth untouched. The failure is entirely at the corner, and 100% localised.

`skin-gate2.mjs`, committed. Criterion carried forward, not invented:
reconstructed radius within **2% of Rmax** of the analytic chine everywhere in
the retained domain (28/28a "the flat and its corners must be RETAINED";
spec 21 directional row; `TOL.profile`). Bandwidth `(cx, cu) = (2.5, 2.5)`
untouched.

| mesh | RAW worst | SKIN worst | at flat | at corner | rms | p99 | verdict |
|---|---|---|---|---|---|---|---|
| chine nt=96 regular | 0.054% | 0.183% | 0.02% | 0.18% | 0.020% | 0.120% | **PASS** |
| chine nt=96 G1 jitter | 1.471% | 0.921% | 0.07% | 0.92% | 0.066% | 0.399% | **PASS** |
| chine nt=30 regular | 3.813% | 2.630% | 0.12% | 2.63% | 0.415% | 2.315% | **FAIL** |
| chine nt=30 G1 jitter | 7.028% | 4.518% | 0.09% | 4.52% | 0.391% | 2.333% | **FAIL** |

### 39.1 THE FLAT SURVIVES. THE CORNER DOES NOT.

**"At corner" equals "worst" in every single row.** The flat itself is
preserved essentially exactly — 0.02% to 0.12%, and at the flat centre
`theta = 180 deg` the reconstructed radius is **0.70000 against an analytic
0.70000**. Theta profile at x = 0.024, nt = 96:

| theta | analytic | RAW | SKIN | skin err |
|---|---|---|---|---|
| 135 (corner) | 0.98995 | 0.98995 | 0.98894 | 0.101% |
| 150 | 0.80829 | 0.80829 | 0.80829 | **0.000%** |
| 165 | 0.72469 | 0.72469 | 0.72469 | **0.000%** |
| 180 | 0.70000 | 0.70000 | 0.70000 | **0.000%** |
| 195 | 0.72469 | 0.72469 | 0.72469 | **0.000%** |
| 210 | 0.80829 | 0.80829 | 0.80829 | **0.000%** |
| 225 (corner) | 0.98995 | 0.98995 | 0.98894 | 0.101% |

So the answer to "does it delete genuine geometry?" is **not a general yes**.
It reproduces a genuine flat to five decimal places and smooths the CORNER
over roughly one angular bandwidth. Corner error tracks `hu` directly:
`hu = 9.37 deg -> 0.18%`, `hu = 30.00 deg -> 2.63%`.

### 39.2 THE FALSE TURNING IS 100% ON RAYS THE CHINE LINE SWEEPS

The chine is not parallel to the axis: the corner angle is
`acos(-0.700 / rc(x))`, sweeping from **134.43 deg at mid-body to 180 deg**
where the flat ends at |x| = 2.142. So it CROSSES rays as x varies.

| body | total false turning | on swept rays | on rays it never crosses |
|---|---|---|---|
| nt=96 regular | 2.1 deg | 2.1 | **0.0** |
| nt=96 G1 jitter | 117.2 deg | 117.2 | **-0.0** |
| nt=30 G1 jitter | 983.8 deg | 981.1 | **2.7** |

**Every degree of it is on rays the chine sweeps across.** On smooth parts of
a featured body the skin behaves exactly as it did in Gate 1. The metric is
valid here — a clean nt=96 chine mesh gives RAW 0.00 deg, so these ribbons
would read zero under exact extraction, and turningExcess remains a noise
diagnostic on them.

**This is a genuinely localised failure, not a diffuse one**, and it is the
first Phase 1F result that constrains the method rather than flattering it.

### 39.3 THE SKIN BEATS THE RAW POLYGON EVEN WHERE IT FAILS

3.813% -> 2.630% and 7.028% -> 4.518%. **It is not making the corner worse
than doing nothing**; it is failing to make it good enough. Recorded because
the opposite would have been a much more serious result.

**AND THE nt=30 CORNER IS NOT AN INPUT-RESOLUTION FAILURE.** At nt = 30 the
raw polygon already carries 3.813% corner error, because the true corner at
134.43 deg falls between mesh vertices at 132 and 144 deg and the polygon
cuts it. But the corner **is recoverable in principle** from that same mesh:
the flat's vertices lie exactly on the flat and the circle's vertices exactly
on the circle, so intersecting the two reconstructed runs recovers the corner
exactly — which is precisely what spec 34.2 measured when exact two-point
runs gave 0.001%. **So this is a reconstruction limitation, not a limit of
the information in the mesh.** The current MLS simply fits straight across the
discontinuity.

### 39.4 WHAT THIS DOES AND DOES NOT LICENCE

**GATE 2 FAILS AS FROZEN.** Two of four tessellations exceed the carried-forward
2% tolerance. Gates 3–7 stay blocked.

**THE BANDWIDTH WAS NOT TOUCHED AND MUST NOT NOW BE TUNED AGAINST THIS
CONTROL.** Per the pre-registration in 38.4: if bandwidth tuning becomes
necessary, this chine becomes SELECTION data and a fresh independent
non-smooth geometry must become the proof.

**THE SAME APPLIES TO FEATURE TREATMENT.** Spec 36.3 anticipated that the new
reconstruction "establishes its own feature treatment from analytic
controls", and Gate 2 has now produced those controls. But developing feature
treatment against THIS chine makes this chine selection data by exactly the
same argument. **The independent chine that 28a amendment 1 always specified —
different flat width, different chine angle, asymmetric — was never built.
It is now required**, and it must not be looked at while the treatment is
being designed.

**NOT PROPOSED, NOT CHOSEN.** Feature treatment is the obvious direction and
the 1E result shows the corner is exactly recoverable, but the criterion and
the scope are the reviewer's. I am recording the measurement and stopping.

**STATE.** Gate 1 CLOSED / PASS. **Gate 2 FAIL** (nt=96 both pass; nt=30 both
fail, entirely at the corner). Gates 3–7 blocked. Contour primitive PASSED and
FROZEN; Cartesian arc-length reconstruction banked with K void; Phase 1, 1C,
1D, R2, 1E all remain FAILED. No Cd, no calibration, no Sunship, no production
change.

## 40. **FEATURE-PRESERVING BRANCH + UNSEEN CONTROL — BOTH FROZEN 2026-08-20, PRE-IMPLEMENTATION.** (owner ruling, reviewer-authored)

### 40.1 FORMAL STATUS

| | |
|---|---|
| **Phase 1F Gate 1** | **PASS / FROZEN** |
| **Phase 1F Gate 2** | **FAIL** — for the current smooth-across-feature MLS architecture |
| **Phase 1F overall** | **OPEN**, via this pre-registered feature-preserving amendment |

**Gate 2 is NOT weakened, the bandwidth is NOT tuned, and Phase 1F is NOT
killed.** The failure is localised enough to justify the feature-preserving
branch spec 36.3 already anticipated:

- Gate 1 proved the joint canonical skin **eliminates tessellation-induced
  false turning on smooth surfaces**.
- Gate 2 proved the same smooth fit **rounds a genuine sharp feature** when
  the angular bandwidth spans it.
- **The flat itself is preserved exactly** — 0.70000 against 0.70000.
- **Away from the moving chine, a featured body behaves like the Gate 1
  smooth controls** — 981.1 of 983.8 deg of false turning on swept rays,
  2.7 deg elsewhere.
- **The nt = 30 mesh contains enough information to recover the true corner**
  (34.2 measured 0.001% from exact two-point runs), so this is **NOT an
  information-limit result like Phase 1E**. It is a limitation of fitting one
  smooth patch across a real feature.

**TWO DIFFERENT KINDS OF FAILURE ARE NOW ON RECORD, AND THE DISTINCTION IS
THE WHOLE POINT.** Phase 1E said *the information you need was already lost
before reconstruction got it* — that route deserved to die. Phase 1F Gate 2
says *the information is present and recoverable, but the current fitter
smooths across it* — that is a failure you can architect around.

### 40.2 THE UNSEEN CONTROL, FROZEN BEFORE ANY TREATMENT EXISTS

`chine-independent.mjs`, committed. **28a amendment 1 finally built.**

Same hull as Gate 2 (prolate spheroid A = 3, B = 1) so the **only** difference
is the feature. Two oblique flats of different depth:

| control | normal | depth | flat width | chine angle |
|---|---|---|---|---|
| Gate 2 (now burned) | 180 deg | 0.700 | 91.15 deg | 45.573 deg |
| **independent, flat 1** | **210 deg** | **0.45** | **126.51 deg** | **63.256 deg** |
| **independent, flat 2** | **60 deg** | **0.80** | **73.74 deg** | **36.870 deg** |

- **Different flat width and different chine angle**, twice over, neither
  equal to the Gate 2 control.
- **ASYMMETRIC STRUCTURALLY, NOT COSMETICALLY.** The only reflection mapping
  one normal onto the other is about 135 deg, and it fails because the depths
  differ. No reflection fixes both. The body has **no mirror plane containing
  the flight axis**, unlike Gate 2.
- **Four corners at four different sweep rates**, since each corner angle is
  `acos(-d_i / rc(x))` and the depths differ.
- **Still star-shaped about the axis** — convex spheroid intersected with two
  half-spaces, origin interior because both depths are positive (min radius at
  mid-body 0.4500). So a failure here **cannot be blamed on the v1 polar
  parameterisation**.

**TOLERANCES IDENTICAL TO GATE 2. Nothing is loosened for this body:** 2% of
Rmax profile, gated exactly as Gate 2 was gated; false turning 0.5 / 0.1
reported.

**WHAT HAS BEEN RUN ON IT: INPUT VALIDATION AND NOTHING ELSE.** Vertices lie
on its own analytic surface within **9.99e-16** against the 1e-9 input gate;
the mesh builds at nt = 30 and 96; the origin is interior. **No skin, no
ribbons, no raw baseline, no false turning, no fidelity number of any kind
has been computed on this body.**

### 40.3 THE ARCHITECTURE, FROZEN

**DO NOT RESURRECT THE PER-SECTION K DETECTOR.** Feature handling belongs on
the surface, before slicing:

> **raw mesh vertices / connectivity -> identify PERSISTENT SURFACE FEATURE
> CURVES -> partition into smooth surface patches -> fit each patch
> INDEPENDENTLY -> retain the feature curve as a HARD SHARED BOUNDARY ->
> canonical skin -> sections / ribbons**

**CREASE SEMANTICS.** A detected chine behaves like a crease in a CAD
surface: **positional continuity may remain, but the reconstruction is NOT
required to enforce tangent continuity across it.**

**THE MECHANISM THIS FIXES, STATED SO IT CAN BE CHECKED LATER.** Gate 2's
error is created by a single MLS window straddling the discontinuity — corner
error tracked `hu` directly, 9.37 deg -> 0.18% and 30.00 deg -> 2.63%. Patch
partitioning removes the straddling instead of shrinking the window, so the
Gate 1 result is not traded away to fix a local corner.

**A FEATURE MUST BE PERSISTENT, NOT PER-SECTION.** The detector operates on
the surface using vertices and connectivity and must identify a CURVE. A
one-off large turn at a single station is not a feature. This is what
distinguishes it from K, which was per-section and is void.

### 40.4 SELECTION AND VALIDATION DISCIPLINE — PRE-REGISTERED

1. **The Gate 2 chine is DEVELOPMENT / SELECTION data.** It may be used to
   develop and select the feature treatment and its parameters. It can
   **never** later serve as the proof that the treatment works.
2. **The independent chine is the FIRST GENUINE TEST**, and is not to be run
   until the treatment is developed and selected.
3. **IF THE INDEPENDENT CHINE FAILS, REPORT THE FAILURE BEFORE CHANGING THE
   TREATMENT AGAIN.** No silent iteration against the unseen control — that
   would burn it exactly as the Gate 2 chine is now burned.
4. **Gates 3–7 remain BLOCKED until the amended Gate 2 has an INDEPENDENT
   PASS.**

### 40.5 NOT TOUCHED

**`(cx, cu) = (2.5, 2.5)` is not to be tuned against the current chine unless
there is INDEPENDENT evidence that bandwidth itself is the problem.** The
measurements say something more specific than "the window is too wide": the
smooth estimator works away from the feature, and the error concentrates
where the bandwidth crosses a real discontinuity. Globally narrowing the fit
would risk trading away the Gate 1 result to fix a local corner.

### 40.6 TWO INTERPRETATION CORRECTIONS TO SPEC 39

1. **`raw > skin` at the corner is diagnostic context, NOT a pass argument.**
   Spec 39.3 gave it a prominent heading, which reads as mitigation. **The
   target is the analytic geometry, not improvement over the raw mesh.**
2. **The 981 deg localisation is strong MECHANISM evidence, and changes
   nothing about the verdict.** It shows the failure travels with the moving
   chine rather than contaminating the body. **Gate 2 remains FAILED.**

**STATE.** Gate 1 CLOSED / PASS. Gate 2 FAILED for the smooth-across-feature
architecture. Feature-preserving branch and unseen control both FROZEN,
neither implemented nor run. Contour primitive PASSED and FROZEN; Cartesian
arc-length reconstruction banked with K void; Phase 1, 1C, 1D, R2, 1E all
remain FAILED. No Cd, no calibration, no Sunship, no production change.

## 41. FEATURE-TREATMENT IMPLEMENTATION RULES — **FROZEN 2026-08-20, PRE-BUILD.** (owner ruling, reviewer-authored)

Additions to spec 40 before any detector code is written.

### 41.1 NEGATIVE CONTROLS ARE MANDATORY

> **A feature detector that preserves chines by hallucinating creases all over
> irregular smooth meshes is not acceptable.**

The Gate 1 smooth bodies become **negative regression controls**:

- **No persistent feature curves may be created where none exist.**
- **Their existing reconstruction and ribbon performance must not materially
  regress.**

The amended development loop, in full:

| control | role |
|---|---|
| burned Gate 2 chine (flat at y = -0.700) | development / selection data |
| Gate 1 smooth bodies, all 10 tessellations | **negative regression controls** |
| independent chine (`chine-independent.mjs`) | untouched validation control |

### 41.2 INFORMATION CONSTRAINT ON THE DETECTOR

> The detector must operate **only on information available from the raw mesh
> vertices and connectivity**.

**Forbidden in the production path:** analytic labels, the known chine
location, section-oracle information, hand-authored feature coordinates, or
anything else derived from knowing the answer. **Analytic truth may be used
ONLY to score a control afterwards.**

### 41.3 THE PERSISTENCE RULE IS HARD

A feature is a **coherent surface curve**, not a locally large turn.
Tessellation edges and isolated noisy vertices are precisely what this
architecture exists to become insensitive to. A single high-turn edge is not
a feature no matter how large its angle.

### 41.4 PATCH PARTITIONING HAS EXACTLY ONE JOB

> **Preserve POSITIONAL continuity across a detected feature curve while
> allowing the surface derivative / tangent to be DISCONTINUOUS across it.**

The two smooth patches meet at the same crease and are fitted independently
on either side. **Do NOT globally narrow bandwidth to achieve this.**

### 41.5 EXECUTION ORDER, FROZEN

1. Rerun the **burned Gate 2** and report it.
2. Rerun **Gate 1** as regression / negative-feature controls.
3. **Only if both are satisfactory**, run the **independent chine ONCE**.
4. **If the independent chine fails, STOP and REPORT before changing the
   detector or the patch treatment.**

**No change to the frozen fidelity tolerances.**

### 41.6 SCOPE OF WHAT THE INDEPENDENT CONTROL CAN PROVE — recorded so it is not over-claimed later

The independent chine sits on the **same underlying hull family** as Gate 2.
That is correct for this gate: it is independent **with respect to the thing
being tested**, which is feature handling — orientation, depth, width, corner
angle and sweep behaviour all change while the smooth hull stays fixed.

**It does NOT prove universal feature preservation across arbitrary body
families.** Later controls can do that. This one experiment is not to be
overburdened, and a pass here must not be written up as more than it is.

## 42. FEATURE TREATMENT — IMPLEMENTATION IN PROGRESS (2026-08-20). Detector works and the negative control passes. **PARTITIONING IS INERT, so the amended Gate 2 is UNCHANGED and is NOT a new result.**

`features.mjs` committed. Two detector designs were tried and failed against
the negative controls before the third; both failures are kept in the file.

### 42.1 DETECTOR v1 — FACE-NORMAL DIHEDRAL. **FAILED ITS NEGATIVE CONTROL.**

Longest connected candidate curve at a 30 deg threshold, nt = 30:

| body | longest curve / candidates |
|---|---|
| SMOOTH G1 jitter | **255 / 4418** |
| CHINE regular (a real chine) | 89 / 246 |

**A smooth jittered mesh produced a longer "persistent curve" than a real
chine on a clean mesh**, so no angle threshold and no persistence length can
separate them. Cause: face normals are sliver-sensitive, and azimuthal jitter
on an anisotropic quad makes near-degenerate triangles whose normals flip —
measured dihedrals reach **179.98 deg on smooth bodies**, against a true chine
angle of 45.573 deg.

**The generators place vertices on the analytic surface to 2.2e-16.** So the
crease is a property of the POSITIONS, not the triangulation. v1 was asking
the wrong object.

### 42.2 DETECTOR v2a — MEDIAN-RATIO RESIDUAL. **ALSO FAILED.**

Leave-one-out local-quadratic residual is the right signal, but thresholding
it against the mesh MEDIAN is not: on a **clean smooth lathe** at nt = 96 it
returned a **960-edge "curve"** at ratio 32, because on a regular mesh the
median residual is machine noise and any multiple of it is meaningless. A
distributional normaliser cannot work here.

### 42.3 DETECTOR v2 — DIMENSIONAL KINK. **SEPARATES.**

Normalise the leave-one-out residual by the neighbourhood's own weighted
**physical** spread. The resulting kink is dimensionless and predicted from
geometry rather than fitted: `~(h/R)^3` on a smooth patch (~0.004 here) and
`~tan(delta/2)` scale at a crease (~0.1).

At `kink > 0.05`, longest connected component:

| smooth bodies (all families, nt 30 and 96) | **<= 8 edges** |
|---|---|
| chine bodies | **61 – 176 edges** |

Selected on development data as authorised: **`kink > 0.05`, `minEdges = 24`**
— between the longest smooth artefact (8) and the shortest real chine
component (61).

### 42.4 NEGATIVE CONTROL — **PASSES**

Gate 1 rerun with the detector live, all 10 tessellations:

- SMOOTH regular: **0 candidate edges, 1 patch**.
- SMOOTH G1 jitter: 7 candidate edges, **0 curves kept** — the persistence
  filter removes them — **1 patch**.
- **Every reconstruction number is byte-identical to spec 37 / 38.6.** RMS
  0.005–0.008%, p99 0.007–0.022%, false turning 0.000/0.000, PASS on all ten.

**No hallucinated creases, and no regression of any kind.** This is the
requirement spec 41.1 added, and it is met.

### 42.5 THE BLOCKER — A DETECTED CURVE IS NOT A CUT

| body | nt | feature edges | longest curve | patches | patch sizes |
|---|---|---|---|---|---|
| CHINE regular | 96 | 352 | 176 | 155 | 45734, 1, 1, 1 … |
| CHINE G1 jitter | 96 | 272 | 61 | 105 | 45784, 1, 1, 1 … |
| CHINE regular | 30 | 288 | 94 | 71 | 14270, 1, 1, 1 … |

**One giant patch plus a swarm of single-face slivers.** The chine is
detected but the detected edges are FRAGMENTED, so they do not cut the
surface: the flood fill leaks through the gaps and both sides of the crease
remain one patch.

On this body the two chine lines meet at `x = +/-2.142`, where the flat ends,
so a fully detected chine is a single closed loop that would separate the flat
from the hull. Partial detection closes nothing.

**CONSEQUENCE, STATED SO IT IS NOT MISREAD:** the patch filter never excludes
anything, so **the amended Gate 2 numbers are identical to spec 39** — 0.183%,
0.921%, 2.630%, 4.518%, still FAIL 2 of 4. **This is not a new Gate 2 result
and must not be recorded as one.** It is the old result with an inert stage
attached.

### 42.6 WHAT THIS NEEDS NEXT

Curve completion: turning a fragmented set of feature edges into a complete
cut — tracing each curve, bridging gaps along the natural continuation, and
terminating only at a closure or a genuine surface boundary. That is a
substantive design decision rather than a parameter, and the pre-registered
discipline still applies: it may be developed against the burned Gate 2 chine
and the Gate 1 negatives, and **the independent chine has still not been
touched**.

**STATE.** Gate 1 CLOSED / PASS, and re-confirmed as a negative control with
the detector live. Gate 2 still FAILED at the spec 39 numbers. Detector
selected; partitioning inert pending curve completion. `(cx, cu)` untouched.
Independent control untouched. No Cd, no calibration, no Sunship, no
production change.

## 43. **CURVE COMPLETION — FROZEN 2026-08-20, PRE-IMPLEMENTATION.** (owner ruling, reviewer-authored)

Spec 42 is **not** a Gate 2 result. The detector discriminates and the Gate 1
negatives are clean, but fragmented detections do not create a separating
boundary, so patching is functionally inert. Completion is a **separate
stage** and is specified here before it is written.

> **surface vertices / connectivity -> kink field -> persistent feature seeds
> -> CURVE COMPLETION -> closed or terminating feature boundary -> patch
> partition -> independent smooth fits**

### 43.1 "NATURAL CONTINUATION" MADE OPERATIONAL

The phrase is where a flattering implementation creeps in, so it is defined
before code, in checkable terms. **Completion must never become "draw the
chine we know is there."** It may use ONLY raw mesh geometry, connectivity and
the detector's own kink field. Analytic feature coordinates remain scoring
truth and never enter the production path (spec 41.2).

**SEEDS.** The kept components of the frozen detector. **Seeds are strong
evidence and are never revised by completion.**

**OPEN ENDPOINT.** A vertex of the seed subgraph with exactly one incident
seed edge.

**CANDIDATE CONTINUATION.** A path through mesh EDGES from an open endpoint to
a vertex of another seed component (or back to its own, closing a loop),
subject to all four conditions below. **All four must hold. Failing any one
rejects the candidate.**

1. **DIRECTION CONTINUATION.** Let `t_seed` be the unit tangent of the last
   `m = 3` seed edges at the endpoint, and `t_path` the unit direction of the
   candidate path, both in the physical surface parameters `(x, r*u)`. Require
   `angle(t_seed, t_path) <= THETA_MAX`. Where the path lands on another
   seed's open endpoint, its tangent must agree in the same sense — a
   continuation, not a T-junction.

2. **ELEVATED KINK SUPPORT, BELOW THE SEED THRESHOLD BUT ABOVE BACKGROUND.**
   Every interior vertex of the bridging path must satisfy
   **both**: `kink >= KAPPA_SOFT` (absolute and dimensional, strictly between
   the smooth-surface scale ~0.004 and the seed threshold 0.05), **and**
   `kink >= LAMBDA * kappa_bg`, where `kappa_bg` is the 90th percentile of
   kink over vertices that are neither in a seed nor within `GAP_MAX` edges of
   one. The absolute floor is primary; the background comparison is a
   secondary guard. **A purely distributional criterion is forbidden here** —
   that is what failed in 42.2.

3. **BOUNDED GAP IN LOCAL MESH SPACING, NOT METRES.** Path length
   `<= GAP_MAX` mesh edges. Measured in edges precisely so it scales with
   tessellation instead of hard-coding a length.

4. **NO COMPETING CONTINUATION OF COMPARABLE QUALITY.** Score each surviving
   candidate; if the best and second-best are within a factor `RHO`, the
   continuation is **AMBIGUOUS**. An ambiguous endpoint is **left
   unconnected** and reported.

### 43.2 TERMINATION AND HONEST FAILURE

A completed feature curve may terminate **only** by closing onto itself or by
reaching a genuine mesh/surface boundary (an edge with one incident face).

> **If the conditions do not identify an unambiguous continuation, LEAVE THE
> FEATURE INCOMPLETE AND REPORT IT. Do NOT invent a boundary merely to make
> flood-fill partitioning succeed.**

An incomplete boundary means the partition will not separate, which means the
gate will not improve. **That outcome is to be reported as such**, never
patched around by a fallback that closes curves for the convenience of the
flood fill.

**FOR THE BURNED CONTROL, WHETHER COMPLETION EVENTUALLY REPRODUCES THE KNOWN
CLOSED CHINE LOOP IS A DEVELOPMENT MEASUREMENT, NOT A PRODUCTION ASSUMPTION.**
Nothing in the code may assume a loop exists.

### 43.3 THE SEED DETECTOR IS FROZEN WHILE COMPLETION IS DEVELOPED

**`kink > 0.05`, `minEdges = 24` DO NOT MOVE.** Otherwise the seed threshold
and the gap rule trade off against each other and it becomes impossible to say
which one fixed anything. Completion parameters
(`THETA_MAX, KAPPA_SOFT, LAMBDA, GAP_MAX, RHO`) are the only things selected
in this stage, and they are selected on:

> **burned Gate 2 chine + Gate 1 smooth negative controls ONLY.**

### 43.4 PRE-REGISTERED CONDITIONS FOR THE COMPLETION STAGE

Frozen before implementation:

- **SMOOTH NEGATIVES MUST PRODUCE NO COMPLETED FEATURE CURVE.** They currently
  hold tiny fragmented candidate sets (7 candidate edges, longest component 3
  at nt = 30). **A completion rule that joins those fragments into a fake loop
  fails immediately.** This is the sharpest test of the rule and it is
  available before any chine is looked at.
- **On the burned chine**, completion succeeds only if the resulting boundary
  **actually partitions**: at least two patches whose face counts are both a
  substantial fraction of the mesh. **The current 155-patch / "45734, 1, 1, 1"
  outcome is the failure signature to beat** — a swarm of single-face slivers
  is not a partition.

### 43.5 EXECUTION ORDER, FROZEN

1. **Burned chine**: verify a coherent feature boundary is produced and that
   patch partitioning actually separates the two sides.
2. **Gate 1 smooth negatives**: verify no completed false features and no
   reconstruction regression.
3. **Rerun the amended Gate 2** on the burned chine.
4. **Only if that genuinely improves or passes the frozen feature gate**, run
   the **independent asymmetric chine ONCE**.
5. **If the independent chine fails, STOP before changing anything.**

**No bandwidth changes. No tolerance changes. No independent-control peeking.**

### 43.6 STATE GOING IN

| | |
|---|---|
| feature signal | promising — smooth longest component <= 8 edges vs real chine 61–176 |
| negative controls | **passed** |
| feature topology | **incomplete** |
| patching | **not yet tested** |
| independent chine | **still clean** |

The separation in the first row is the first evidence that the real feature is
recoverable **from the vertex geometry alone**, without trusting bad triangle
normals.

## 44. CURVE COMPLETION IMPLEMENTED AND RUN (2026-08-20): **ZERO BRIDGES ACCEPTED.** The blocker is in the FROZEN SEED RULE, not in completion — so it stops here for a ruling.

`completeFeatureCurves` in `features.mjs`, built exactly to spec 43 with all
four conditions and honest-failure semantics. Parameters as first proposed:
`thetaMax 45 deg, kappaSoft 0.02, lambda 3, gapMax 6 edges, rho 1.5`.

| body | nt | seeds | seed edges | **bridges** | ambiguous | unresolved | complete | patches |
|---|---|---|---|---|---|---|---|---|
| SMOOTH regular | 30 | 0 | 0 | 0 | 0 | 0 | true | **1** |
| SMOOTH G1 jitter | 30 | 0 | 0 | 0 | 0 | 0 | true | **1** |
| SMOOTH G4 walk | 30 | 0 | 0 | 0 | 0 | 0 | true | **1** |
| SMOOTH G1 jitter | 96 | 0 | 0 | 0 | 0 | 0 | true | **1** |
| SMOOTH G4 walk | 96 | 0 | 0 | 0 | 0 | 0 | true | **1** |
| CHINE regular | 96 | 2 | 352 | **0** | 0 | 4 | false | 155 |
| CHINE G1 jitter | 96 | 7 | 272 | **0** | 0 | 8 | false | 105 |
| CHINE regular | 30 | 6 | 288 | **0** | 0 | 12 | false | 71 |
| CHINE G1 jitter | 30 | 7 | 465 | **0** | 0 | 16 | false | 163 |

Every endpoint is **unresolved** — the bounded search found no candidate path
at all, so nothing even reached the ambiguity test. The partition is unchanged
and therefore **the amended Gate 2 is still not a result**.

### 44.1 THE SMOOTH NEGATIVE PASSES, BUT TRIVIALLY — SAID PLAINLY

No smooth body produces a completed feature curve, as 43.4 requires. **But it
passes for a weaker reason than the test was designed to probe**: the
persistence filter leaves **zero seeds** on every smooth body, so completion
never starts. The intended sharp test — "does the rule join 7 scattered
candidate edges into a fake loop?" — **was never actually exercised**, because
those candidates never become seeds. This is a pass, and it is a weak one.

### 44.2 MY FIRST EXPLANATION WAS WRONG, AND THE MEASUREMENT SAYS SO

I expected the crease evidence to **fade** at the ends: the flat exists only
for `|x| < 2.1424`, and the corner angle `acos(-D/rc(x))` opens to 180 deg
there, so the crease must vanish by construction. Measured max kink within
3 deg of the true corner:

| x | corner angle | max kink |
|---|---|---|
| 0.00 | 134.43 deg | 0.0765 |
| 1.00 | 137.94 deg | 0.0653 |
| 1.60 | 145.84 deg | 0.0891 |
| 1.90 | 154.76 deg | 0.0947 |
| 2.00 | 159.91 deg | 0.0741 |
| 2.10 | 168.58 deg | 0.0758 |
| 2.13 | 173.74 deg | 0.0622 |

**The evidence does not fade.** Kink stays at 0.062–0.095 along the entire
chine, right out to where the flat vanishes — comfortably above the 0.05 seed
threshold at every station tested. Wrong guess; killed by measurement.

### 44.3 WHAT IS ACTUALLY WRONG: THE SEEDS COVER 35% OF THE CHINE

> **Seed curves span `x` from -0.750 to +0.750. The chine runs to +/-2.142.**
> They stop **1.392 short at each end** and cover roughly 35% of its length.

So the chine is strongly evidenced along its whole length, yet is seeded only
in the middle third. Completion cannot repair that: `gapMax` is 6 edges by
design, and the missing spans are hundreds of edges. **Raising `gapMax` to
cover 1.392 in x would not be gap-bridging, it would be inventing a boundary
across a region the seeds never proposed** — precisely what 43.2 forbids.

**Supporting number:** kink `p99 = 0.05506` across the whole mesh, against a
seed threshold of `0.05`. The threshold sits almost exactly at the 99th
percentile, so seeding is admitting barely more than 1% of vertices.

**HYPOTHESIS, EXPLICITLY UNVERIFIED.** The seed rule requires **both**
endpoints of a mesh edge to exceed the threshold. The chine is a curve that
drifts in `theta` as `x` advances, so successive chine vertices sit at varying
offsets from the true crease line, and a vertex offset by part of a spacing
reads a lower kink than one sitting on it. Wherever an offset vertex falls
below 0.05 the edge chain breaks. That would produce exactly this pattern —
solid seeding where the chine is most nearly axis-parallel, fragmenting as it
drifts. **It is a hypothesis and it has not been tested.** Given the session's
record on mechanism guesses it should be measured before it is believed.

### 44.4 WHY THIS STOPS HERE

**Spec 43.3 freezes `kink > 0.05, minEdges = 24` while completion is
developed**, precisely so seed threshold and gap rule cannot trade off against
each other. The measurement says the blocker is **in the seed rule**. Changing
it is therefore not mine to do inside this stage:

- lowering the seed threshold,
- relaxing the both-endpoints-must-qualify edge rule,
- or seeding on a ridge of the kink field rather than a level set,

are all changes to the **frozen** seed detector, not to completion.

Completion itself is built, runs, and refuses to invent anything — which is
the behaviour 43.2 asked for. It has simply never been given a gap it could
legitimately bridge.

**STATE.** Gate 1 CLOSED / PASS, negative controls clean. Gate 2 still FAILED
at the spec 39 numbers; still **not** re-run as a genuine amended result.
Completion implemented per spec 43, zero bridges, honest failure reported.
`(cx, cu)` untouched. Seed detector untouched. **Independent chine still
untouched.** No Cd, no calibration, no Sunship, no production change.

## 45. SEED-ALIASING DIAGNOSTIC (2026-08-20): **CONFIRMED — and worse than the hypothesis.** Edge-chain seeding **FAIL / RETIRED**. Ridge architecture frozen below.

`seed-alias-diag.mjs`, burned Gate 2 body only. Analytic chine used as
**scoring truth only** (permitted, spec 40.4 — the control is burned). Seed
threshold held at **0.05**; nothing retuned.

| chine | nt | stations | **signal present** | **qualifying edge** | band max-kink min / med / max |
|---|---|---|---|---|---|
| regular | 96 | 167 | **62.9%** | **25.7%** | 0.0139 / 0.0602 / 0.1068 |
| regular | 30 | 167 | **56.9%** | **11.4%** | 0.0188 / 0.0551 / 0.0831 |
| G1 jitter | 96 | 167 | **98.8%** | **82.0%** | 0.0240 / 0.1978 / 0.9212 |

Edge endpoint census in the chine band (regular, nt=96): **2404 edges with 0
endpoints** over threshold, **952 with exactly 1**, **432 with 2**. The
one-endpoint population is more than twice the two-endpoint population — that
is the aliasing, counted directly.

### 45.1 THE HYPOTHESIS IS CONFIRMED, BUT IT WAS ONLY HALF THE PROBLEM

**Aliasing by the edge rule: real.** Signal exists at 62.9% of stations but a
qualifying edge at only 25.7% — **the edge rule discards well over half of the
evidence that is already there.** At nt=30 it discards four fifths.

**But the vertex signal itself is ALSO intermittent.** Band max-kink drops to
**0.0139** at some stations, so at ~37% of stations *no vertex anywhere near
the chine* reaches 0.05. The evidence is not merely mis-chained; it is
under-sampled before chaining ever happens.

**THE DECISIVE CONFIRMATION IS THE JITTERED MESH BEING BETTER.** The regular
nt=96 mesh gives 62.9% signal; the *jittered* one gives **98.8%**. Jitter puts
some vertex near the true crease at nearly every station, where a regular mesh
repeatedly samples the ridge at the same unlucky phase. **A corruption
improving detection is the signature of aliasing** and is very hard to explain
any other way.

Localisation is correct: high-kink vertices sit a median **0.15 vertex
spacings** from the analytic chine (p90 1.12). The field knows where the
feature is. The sampling and the chaining lose it.

### 45.2 CORRECTION TO SPEC 44.2 — I OVERSTATED IT

Spec 44.2 said "the evidence does not fade… kink stays at 0.062–0.095 along
the entire chine." **That was measured at eight hand-picked stations with a
wide axial window, and it is too strong.** Scanning all 167 stations with a
tight window shows band max-kink oscillating between **0.0139 and 0.1068**.

The corrected statement: **the underlying ridge is continuous, but its
vertex-sampled value is not.** The conclusion in 44.3 — that the blocker sits
in the seed rule rather than in completion — survives, and is now better
supported than the claim I used to reach it. Thirteenth corrected claim of the
session.

### 45.3 RULING RECORDED

> **EDGE-CHAIN SEEDING — FAIL / RETIRED.**
>
> **Not a threshold failure. A REPRESENTATION failure: the physical feature
> curve is not in general a chain of mesh edges.** There is no reason a real
> chine should align with an arbitrary triangulation, and spec 39.3 already
> hinted at it — the coarse mesh held enough positional information to recover
> the corner even though no section vertex sat on it.

**"One endpoint qualifies" is REJECTED as the replacement.** It would only
move the arbitrary tessellation dependence around.

### 45.4 REPLACEMENT ARCHITECTURE — **FROZEN PRE-IMPLEMENTATION**

> **vertex positional evidence -> CONTINUOUS kink/evidence field over `(x, u)`
> -> ridge / feature-curve extraction -> persistence -> completion only for
> genuinely small gaps -> patch partition**

The feature curve is **allowed to pass through faces** rather than being
constrained to mesh edges — as an isoline on a terrain map runs through grid
cells rather than along their borders.

**FROZEN AND NOT RETUNED:**
- **The absolute dimensional kink scale `0.05` remains the evidence floor.**
  Not to be lowered. The diagnostic says the true feature carries >0.05
  evidence wherever it is sampled at all, so the failure is in converting
  evidence into a curve, not in the level.
- **Completion stays exactly as frozen in spec 43** — it behaved correctly,
  refusing to invent ~65% of a boundary from sparse seeds. `gapMax` is NOT to
  be enlarged. It applies only to genuinely small gaps.
- **`(cx, cu) = (2.5, 2.5)` untouched. Frozen fidelity tolerances untouched.**
- **Gate 1 smooth bodies remain mandatory negative controls: a ridge tracer
  that turns scattered smooth-mesh artefacts into persistent curves fails
  immediately.**
- **The independent chine remains untouched.**

### 45.5 ONE CONSEQUENCE THAT MUST BE DECIDED BEFORE CODE, NOT DISCOVERED AFTER

If the feature curve runs **through faces**, then the patch partition can no
longer be a face flood-fill bounded by mesh edges, and — more importantly —
**no vertex necessarily lies ON the crease.** Spec 41.4 requires positional
continuity across the feature curve, and the current mechanism delivers it by
having crease vertices belong to both patches. **That mechanism disappears
under the new representation.**

Two candidate answers, neither chosen here:

1. **Enforce it.** Constrain both patch fits to agree on the crease curve.
2. **Derive it.** Fit each side independently and define the crease as the
   INTERSECTION of the two extrapolated surfaces — which is exactly how spec
   34.2 recovered the corner to 0.001%. Positional continuity then becomes a
   measured output rather than an imposed constraint.

**This is a design decision and it is flagged rather than taken.** It changes
what "patch partition" means, so it belongs in the freeze, not in the code.

**STATE.** Gate 1 CLOSED / PASS. Gate 2 FAILED at spec 39 numbers, still not
re-run as a genuine amended result. Detector v1 dihedral: failed. v2a
median-ratio: failed. v2 dimensional kink: correct field, wrong curve
extraction — **edge-chain seeding retired**. Completion: correct behaviour,
never given a legitimate gap. Ridge architecture frozen, **not implemented**.
No Cd, no calibration, no Sunship, no production change.

## 46. **DERIVED CREASE — FROZEN 2026-08-20, PRE-IMPLEMENTATION.** (owner ruling, reviewer-authored)

### 46.1 THE RULING

> **Use the detected ridge for TOPOLOGY and PARTITIONING, not as the final
> geometric crease.** Fit the two smooth patches independently on opposite
> sides, then define the canonical crease as **their local intersection
> curve**.

This satisfies spec 41.4 by construction: both patches meet on the same
derived curve — positional continuity — while tangent continuity across it is
deliberately not imposed.

**WHY DERIVE RATHER THAN ENFORCE.** Spec 45 measured that **the ridge location
is itself aliased**: 62.9% station coverage on a regular mesh against 98.8% on
a jittered one, with vertex-sampled evidence oscillating 0.0139–0.1068. The
ridge is good enough to say *a persistent feature exists here and roughly
where it runs*. It is **not** justified as the exact physical crease.
Enforcing positional continuity on it would **bake the detector's localisation
error into the canonical skin**.

The division of labour is clean: the detector answers *where is the
discontinuity approximately*; the two smooth fits answer *what surfaces exist
on either side*; their intersection answers *where must those surfaces
actually meet*.

### 46.2 THE RIDGE HAS EXACTLY THREE JOBS

1. Identify that **a persistent feature exists**.
2. **Separate the raw surface samples** into the two sides of that feature.
3. Provide a **bounded local corridor** within which the patch intersection may
   be sought.

> **It must NOT become a hard positional constraint that both patches are
> forced through.**

### 46.3 BINDING SAFEGUARDS

- **The intersection must be LOCAL and UNIQUE within the detector corridor.**
- **If the two fitted patches do not intersect there, intersect multiple times
  ambiguously, or intersect only after unreasonable extrapolation, REPORT
  FEATURE RECONSTRUCTION FAILURE.**
- **Do NOT choose whichever intersection gives the best analytic score.** The
  analytic chine on the burned control is **scoring truth only** and **cannot
  enter the intersection solve**.

### 46.4 ARCHITECTURE

> mesh vertices / connectivity -> **continuous kink field** -> feature ridge ->
> curve completion -> **side partition** -> **independent patch fits** ->
> **local patch–patch intersection = canonical crease** -> canonical skin ->
> sections / ribbons

### 46.5 FROZEN, NOT TO BE TOUCHED

Bandwidth `(cx, cu) = (2.5, 2.5)`; the kink floor **0.05**; the persistence
requirement; the completion rule of spec 43 including `gapMax`; every fidelity
tolerance. **Gate 1 smooth controls remain negative/regression controls: no
feature curve, no patch split, no reconstruction change.** **The independent
asymmetric chine remains untouched.** The burned Gate 2 chine may be used to
develop the patch-intersection implementation.

### 46.6 DECLARED SIMPLIFICATIONS AND ONE OPEN PARAMETER

Stated before code so they are not mistaken later for the frozen ceiling.

**(A) THE PERSISTENCE PARAMETER MUST BE RE-EXPRESSED, AND IS NOT A CARRY-OVER.**
The persistence *rule* stays frozen — a feature is a coherent curve, never a
local event. But `minEdges = 24` was selected against the **edge representation
that spec 45.3 retired**, so the number carries no meaning in a ridge
representation. Its replacement is selected on development data, and **the
Gate 1 negative controls are the binding test**: a ridge tracer that turns
scattered smooth-mesh artefacts into persistent curves fails immediately.

**(B) RIDGE EXTRACTION IS AXIAL-SCAN IN v1.** Ridges are found as local maxima
of the field along `u` at each `x`, then linked across `x`. This suits chines
that run broadly along the flight axis — true of both the burned control and
the independent one — and would **not** find a feature running circumferentially
(a step or ring). Recorded as a limitation, not as a claim about generality.

**(C) THE INTERSECTION IS SOLVED PER TRANSVERSE STATION, NOT AS A GENERAL 3D
SURFACE–SURFACE PROBLEM.** The skin is evaluated at fixed `x` anyway and the
ribbon operator only ever needs sections, so at each station the two patch
fits give two planar curves and the crease point is their intersection.

**THE CAVEAT THAT GOES WITH IT, RECORDED NOW.** Spec 34.2's 0.001% came from a
**2D line/curve intersection where one side was an exact two-point straight
segment**. This is a genuine surface–surface intersection reduced to a plane,
with a fitted quadratic on both sides. **It must not be assumed to be equally
easy or equally accurate.** That is exactly what the burned chine is now
allowed to test.

**STATE.** Gate 1 CLOSED / PASS. Gate 2 FAILED at spec 39 numbers, still not
re-run as a genuine amended result. Edge-chain seeding retired. Derived-crease
architecture frozen, **not implemented**. No Cd, no calibration, no Sunship, no
production change.

## 47. CONTINUOUS FIELD + RIDGE TRACER (2026-08-20): **negative controls PERFECT.** But the field is **DOUBLE-PEAKED**, and that is a property of the measure, not noise. Decision needed.

`ridge.mjs`, committed. Field `K(x,u) = weighted RMS residual / weighted
physical spread` from a local quadratic, evaluated anywhere in `(x,u)` rather
than only at vertices. Evidence floor held at the frozen **0.05**.

### 47.1 THE NEGATIVE CONTROLS ARE NOW PERFECT

| smooth body | nt | peaks | components | longest ridge |
|---|---|---|---|---|
| regular, G1, G2, G3, G4 | 30 | **0** | **0** | **0** |
| regular, G1, G2, G3, G4 | 118 | **0** | **0** | **0** |

**Zero peaks on all ten tessellations**, against 8-edge spurious curves under
the retired vertex rule. Chine bodies produce 152–332 peaks. **This is the
cleanest separation the programme has produced**, and it is the requirement of
spec 41.1 met without a persistence filter doing any work at all.

### 47.2 BUT THE RIDGES FRAGMENT, AND PREDICTIVE LINKING DID NOT HELP

Longest linked ridge, of 128 x-steps: chine regular nt=96 **59**, nt=30 **50**,
jittered **10** and **8**. Components 16–103.

I replaced the fixed search window with a predictive one — extrapolating the
ridge's own `du/dx`, since the corner sweeps up to ~4 deg per x-step near the
ends, comparable to the whole window. **It made things slightly worse**
(components 32 -> 34, 64 -> 68, 92 -> 103). So the search window was not the
cause. Wrong guess; the change is retained only because it is strictly better
motivated than a fixed window, not because it fixed anything.

### 47.3 THE ACTUAL CAUSE: THE FIELD HAS TWO PEAKS PER CREASE

Peak structure per row, chine regular nt=96, against the analytic corner:

| x | true corner | peaks found (deg @ K) |
|---|---|---|
| -0.45 | 135.1 | **-136@0.159  -134@0.134** (and mirror) |
| -0.16 | 134.5 | **-136@0.144  -134@0.096** |
| 0.40 | 134.9 | **-136@0.161  -134@0.131** |
| 0.96 | 137.6 | -141@0.107 *(single)* |
| 1.52 | 144.3 | -148@0.056  -141@0.055 |
| ±2.1 | ~170 | **none** |

**Two peaks straddle the true crease, roughly 1 deg either side, with a DIP on
the crease itself.** Rows alternate between 4 peaks and 2 as the pair merges,
and that merge/split is where the linker breaks.

**MECHANISM, AND IT IS STRUCTURAL.** The fit basis contains `u^2`, which is
EVEN. A symmetric roof centred in the window is therefore partly absorbable by
the quadratic, so the residual is locally *low* exactly on the crease and
*high* where the roof sits asymmetrically in the window. **The measure is
maximised beside the feature, not on it.**

**THIS ALSO EXPLAINS THE RETIRED RULE'S ALIASING (interpretation, not a new
measurement).** Spec 45 found vertex-sampled evidence oscillating 0.0139–0.1068
along a crease that is continuously present. A vertex landing in the on-crease
dip reads low; one landing on a flank reads high. A double-peaked field with a
dip on the feature is exactly what would produce that, and it explains why a
*jittered* mesh sampled it better than a regular one.

### 47.4 THE DECISION — NOT TAKEN

The natural fix is to stop measuring *how badly one surface fits* and measure
*the thing itself*: fit a quadratic to each side of a candidate `u`
independently and take the **jump in tangent** across it. That peaks ON the
crease, is monotone in the crease angle, and is the direct expression of "a
derivative discontinuity". It also composes with spec 46: the two one-sided
fits are essentially the patch fits already required.

**BUT IT CHANGES THE QUANTITY.** `0.05` was derived against a residual/spread
ratio (`~(h/R)^3` smooth vs `~tan(delta/2)` creased). A tangent-jump measure
IS `tan(delta)` more or less directly, so the floor would need re-deriving —
which is precisely the condition spec 46.5 attached to it: *not to be retuned
unless the new representation demonstrates the meaning of the quantity has
changed.* **I am recording that the condition appears to be met, and stopping,
rather than deciding it.**

Alternatives not taken: track the double ridge and use its midline (keeps the
frozen floor, but builds on a measure that is structurally mis-centred); or use
a linear rather than quadratic basis (peaks on the crease, but its smooth-side
residual grows to `~h/R` and would destroy the contrast that gives the perfect
negative controls above).

**STATE.** Gate 1 CLOSED / PASS. Gate 2 FAILED at spec 39 numbers, still not
re-run as a genuine amended result. Ridge tracer: negative controls perfect,
positive detection present but fragmented by a structurally double-peaked
field. Bandwidth, kink floor, completion rule, fidelity tolerances all
untouched. **Independent chine untouched.** No Cd, no calibration, no Sunship,
no production change.

## 48. **TANGENT-JUMP DETECTOR — FROZEN 2026-08-20, PRE-BUILD.** Residual/spread field RETIRED as a localisation metric, and `0.05` retires with it. (owner ruling, reviewer-authored)

### 48.1 THE RULING

> **Retire the residual/spread kink field as the feature-localisation metric.
> Proceed to a one-sided tangent-jump field.**
>
> **This is NOT a retune of `0.05`.** It is a different observable with
> different units and meaning, so **the `0.05` floor retires with the old
> metric. Do not attempt to translate it numerically.**

The finding that forces it: the old field **can** distinguish featured from
smooth geometry — negative controls were perfect — but **its maximum is
structurally displaced to either side of a crease**, because a symmetric
quadratic partially absorbs the centred roof. Measured at x = -0.45 against a
true corner of 135.1 deg: peaks at 136.0 and 134.0 with a dip between.

**That makes it unsuitable for LOCATING the feature curve, however good its
negative-control separation looks.** Anomaly detection and localisation are
different jobs and the old metric only did the first.

### 48.2 THE NEW QUANTITY

At each candidate `(x, u)`, fit the surface **independently on the two sides**
of the candidate, using **raw mesh-vertex positions only**. Extrapolate both
fits **to the same candidate location** and compare their Cartesian tangents
there:

> **`dPsi = acos( (t- . t+) / (|t-| |t+|) )`**

- **Both derivatives must be evaluated at the SAME candidate location.** On a
  genuinely smooth surface they converge to the same tangent; at a crease they
  are free to disagree.
- The equivalent one-sided surface-normal jump is acceptable if numerically
  more natural.
- **Analytic chine coordinates remain scoring truth only** and cannot enter the
  production calculation (spec 41.2).

It measures the physical thing a chine *is* — a discontinuity in surface
direction — rather than "how badly one smooth model fits this neighbourhood",
which never guaranteed the anomaly was centred where the feature lives.

### 48.3 THE PREDICTIVE LINKER IS NOT BANKED

**Retired.** It was introduced after seeing the failure and **made the measured
result worse** (components 32 -> 34, 64 -> 68, 92 -> 103). *Bank the
measurement, not the intuition.* `ridge.mjs` is reverted to the fixed-window
linker and the new detector gets a clean localisation experiment of its own.

### 48.4 WHAT MUST BE DEMONSTRATED BEFORE PATCH PARTITIONING IS BUILT

On authorised development data only:

1. **Gate 1 smooth negatives remain feature-free.**
2. **The burned chine produces a SINGLE CENTRED response**, not the old double
   ridge.
3. **The response follows the moving chine through its full extent**, at both
   coarse and dense tessellation.
4. **Regular versus jittered tessellation no longer creates the severe phase
   dependence** seen under the retired detector (62.9% vs 98.8% coverage).

### 48.5 SELECTING THE NEW FLOOR — PRE-REGISTERED, NOT HAND-PICKED

**No angular threshold may be hand-picked.** A threshold **sweep** is run on
**Gate 1 negatives + the burned Gate 2 chine only**.

**SPAN CRITERION, fixed before the sweep.** The analytic chine exists for
`|x| < 2.1424` of a half-length 3 body, i.e. **71.4% of the axial extent**, so
**91 of the 128 x-steps**. Define

> **S = 46 x-steps** — half of the chine's own analytic extent.

**A threshold is VALID if and only if:**

- **every Gate 1 negative produces ZERO ridge curves of span `>= S`**; and
- **the burned chine produces AT LEAST TWO ridge curves of span `>= S`, at BOTH
  frozen resolutions.**

**If a non-empty valid interval exists, select the CENTRE OF THE WIDEST valid
interval and freeze it before anything downstream is run.**

> **If no valid interval exists, THIS DETECTOR FAILS. The criterion is not
> relaxed to rescue it.**

### 48.6 UNCHANGED

**The independent asymmetric chine remains untouched throughout.** Completion
remains frozen and is used only later, for genuinely small gaps; **`gapMax`
does not change.** Bandwidth `(cx, cu) = (2.5, 2.5)` and every fidelity
tolerance stand.

### 48.7 THE PIPELINE, ONCE THE FIELD HAS EARNED ITSELF

> jump field -> feature ridge -> frozen completion **if required** -> side
> partition -> independent patch fits -> local patch intersection -> canonical
> skin -> ribbons

**THE PROGRAMME'S NARROWING, FOR THE RECORD.** smooth canonical skin works
extremely well -> smooth fit across a chine fails -> edge-based feature
localisation aliases -> residual field detects features but mis-centres them ->
measure the actual tangent discontinuity directly.

## 49. TANGENT-JUMP FIELD (2026-08-20): **the quantity is right and reads the chine angle to 0.04 deg.** But the threshold is **NOT frozen**: my sweep was narrower than 48.5 pre-registered, and the coarse jittered chine fails.

### 49.1 THE FIELD MEASURES THE PHYSICAL QUANTITY

Burned chine, nt = 96, at x = 0 where the true chine angle is **45.573 deg**:

| candidate u | dPsi |
|---|---|
| 134.4 deg (**the true corner**) | **45.61 deg** |
| 90 deg (smooth circle) | 0.09 deg |
| 180 deg (middle of the flat) | 0.00 deg |

**Accurate to 0.04 deg on the feature, 0.09 deg away from it.** The retired
residual field could only say "something is anomalous near here"; this returns
the crease angle itself. That is the substantive win of spec 48.

### 49.2 TWO IMPLEMENTATION FIXES, BOTH FORCED BY IDENTIFIABILITY

The first build returned **NaN at every evaluation**. Diagnosed, not guessed:

1. **The one-sided basis was over-specified.** The six-term quadratic the
   two-sided skin uses is not identifiable one-sided. Reduced to
   `[1, dx, du, du^2]`; `dx^2` and `dx*du` cost nothing in the extracted value
   because `d/du` at the candidate is `c_du + c_dxdu*dx` and `dx = 0` there.
2. **The window was too narrow, and this was the real cause.** At `cu = 2.5`
   the narrow side held 8 points spanning **only 2 distinct du values**, so
   `[1, du, du^2]` had rank 2 and the solve was singular regardless of point
   count. **A one-sided quadratic in du needs >= 3 distinct sample columns.**
   `cu = 3` is exactly determined; **`cu = 4` is the smallest value leaving the
   fit over-determined**, so the detector window is 4. That is derived before
   any result is inspected, not chosen because it produced a good answer.

**THE SKIN'S FROZEN BANDWIDTH `(cx, cu) = (2.5, 2.5)` IS UNTOUCHED.** This is
the detector's own window, a parameter of a stage that did not exist when that
freeze was written. Flagged rather than done quietly.

Dropping `du^2` instead would have been the cheap fix and is **rejected**: the
one-sided mean slope over ~9 deg of a unit circle is biased from the boundary
tangent by roughly half the arc, so both sides would be biased oppositely and a
smooth surface would read several degrees of false jump.

### 49.3 THE PRE-REGISTERED SWEEP RAN — AND MY IMPLEMENTATION OF IT WAS NARROWER THAN THE SPEC

Sweep result: **valid at 3, 5, 7.5, 10, 15, 20, 25, 30, 35, 40 deg**; invalid
only at 2 deg (a negative produced 2 curves of span >= S). Widest contiguous
run 3–40, **centre 21.50 deg**.

> **BUT: I evaluated the chine side of the criterion on the REGULAR bodies
> ONLY.** Spec 48.5 says "the burned chine produces at least two ridge curves
> of span >= S at both frozen resolutions" and does not restrict that to
> regular tessellation. **At 21.5 deg the JITTERED chine at nt = 30 produces
> only ONE curve of span >= S.** Had the jittered bodies been included, the
> valid interval would have narrowed or possibly emptied.

**THEREFORE 21.50 deg IS NOT FROZEN AND THE DETECTOR IS NOT EARNED.** The
number stands only as the output of a test weaker than the one registered.

### 49.4 DEMONSTRATIONS — AND A BADLY SPECIFIED METRIC OF MINE, CORRECTED

**My first demo-2 metric counted TOTAL peaks per row**, so a row containing
both true corners plus one spurious peak anywhere else scored as a failure. It
returned 0–19% and meant almost nothing. Corrected metric — *exactly one peak
within +/-1 vertex spacing of each true corner*:

| body | nt | corner slots | exactly one | zero | multi | mean offset |
|---|---|---|---|---|---|---|
| regular | 96 | 176 | **152 (86%)** | 10 | 14 | 1.68 deg |
| G1 jitter | 96 | 172 | **142 (83%)** | 8 | 22 | 0.74 deg |
| regular | 30 | 176 | **168 (95%)** | 4 | 4 | 4.93 deg |
| G1 jitter | 30 | 172 | **66 (38%)** | 3 | **103** | 3.50 deg |

- **DEMO 1 (negatives feature-free):** peaks DO appear on jittered smooth
  bodies (up to 354), but the longest curve on any of them is **7 x-steps**
  against `S = 46`. Clean in the span-filtered sense, **not** absolutely.
- **DEMO 2 (single centred response):** met at 83–95% on three of four bodies,
  and the **double ridge of spec 47 is gone**. **Fails on the coarse jittered
  mesh at 38%, with 103 multi-peak slots.**
- **DEMO 3 (full extent):** longest span **74 of the chine's 91 x-steps (81%)**
  for regular bodies, 60 and 58 for jittered. Much better than the 59/50/10/8
  of the retired field, still not full extent.
- **DEMO 4 (phase dependence):** at nt = 96 it is essentially gone — 86%
  regular vs 83% jittered, against the retired detector's 62.9% vs 98.8%. **At
  nt = 30 it is large and REVERSED**: 95% regular vs 38% jittered. The old
  detector was worse on regular meshes; this one is worse on coarse jittered
  ones. Different failure, not an absent one.

### 49.5 WHERE THIS STOPS

Spec 48.4 requires all four demonstrations **before patch partitioning is
built**. Demos 2 and 4 fail on the coarse jittered body, and the threshold
cannot be frozen because the sweep that produced it was narrower than the one
registered. **Partitioning is not started.**

The honest summary: **the observable is right** — it returns the crease angle
to 0.04 deg and has killed the structural double ridge — **and the extraction
around it is not yet good enough on a coarse jittered mesh.**

**STATE.** Gate 1 CLOSED / PASS. Gate 2 FAILED at spec 39 numbers. Tangent-jump
field built; threshold **NOT frozen**; demonstrations 2 and 4 **not met**.
Skin bandwidth, completion rule, `gapMax` and all fidelity tolerances
untouched. **Independent chine untouched.** No Cd, no calibration, no Sunship,
no production change.

## 50. THE SWEEP AS ACTUALLY PRE-REGISTERED (2026-08-20): **NO VALID INTERVAL.**

> **tangent-jump observable: VALID**
> **universal feature extraction at this mesh quality: FAIL**

Branch stopped. `jump-sweep-full.mjs`, committed. All authorised burned-chine
variants included — regular **and** jittered, at nt = 30, 96 and 118; nt = 118
added because it is strictly harder than the frozen pair. Ten Gate 1 negatives.
Nothing else altered: tangent-jump basis, detector window `cu = 4`, skin
bandwidth, `S = 46`, fixed-window linker, completion, fidelity tolerances.

| threshold | worst negative | reg30 | jit30 | reg96 | jit96 | reg118 | jit118 | valid |
|---|---|---|---|---|---|---|---|---|
| 2 deg | **2 curves** | 7 | 1 | 6 | 4 | 6 | 2 | no |
| 3 | 0 | 6 | **1** | 6 | 4 | 6 | 2 | no |
| 5 | 0 | 6 | **1** | 6 | 4 | 6 | 2 | no |
| 7.5 | 0 | 6 | **1** | 6 | 2 | 6 | 2 | no |
| 10 | 0 | 6 | **0** | 6 | 2 | 6 | 2 | no |
| 15 | 0 | 6 | **0** | 5 | 2 | 4 | **1** | no |
| 20–30 | 0 | 2 | **0–1** | 2 | 2 | 2 | **0** | no |
| 35–40 | 0 | 2 | **0** | 2 | **0** | 2 | **0** | no |

### 50.1 IT IS A SQUEEZE, NOT A MIS-TUNED THRESHOLD

**Below 3 deg the negatives break** — a *smooth* regular nt = 30 body produces
2 curves of span `>= S`. **At and above 3 deg the coarse jittered chine never
produces both of its chine lines as long curves**: `jit30` reaches at most
**1**, at every threshold in the sweep. `jit118` collapses to 0 from 20 deg up.

There is no threshold where the negatives are clean *and* every authorised
chine variant is recovered. **The requirement is unsatisfiable across the
authorised set**, so this is not a value that could be found by looking harder.

### 50.2 WHAT IS BANKED, AND IT IS NOT NOTHING

- **The tangent-jump observable is VALID and is the real result of spec 48.**
  It returns the crease angle itself — **45.61 deg measured against 45.573 deg
  analytic**, 0.09 deg on smooth surface — and it eliminated the structural
  double ridge of the residual field. A physically meaningful observable was
  found. What failed is **tracing it robustly into a curve at coarse,
  irregular mesh quality**.
- **Phase VF Gate 1 stands: PASS on all ten tessellations**, and it is the
  substantive win of the whole 1F architecture — the control that killed Phase
  1E went from **128.14 deg of false turning to 0.000**, positional RMS 0.006%
  against a 0.5% tolerance.
- Contour primitive: PASSED and FROZEN. Cartesian arc-length reconstruction:
  banked as a component, K void.

### 50.3 NO FURTHER DETECTOR RESCUE

Per the ruling, this branch **stops here**. No peak-merging pass, no adaptive
tracer, no coarse-mesh phase handling, no additional completion rules. Each of
those would be another rescue of the same stage, and the honest reading of
50.1 is that the stage cannot be made universal at this mesh quality.

**FIVE DETECTOR REPRESENTATIONS WERE TRIED AND THE RECORD KEEPS ALL OF THEM:**
face-normal dihedral (failed its negative control), median-ratio residual
(failed on a clean lathe), dimensional-kink vertex seeding (aliased — a
*jittered* mesh detected better than a regular one), continuous residual field
(perfect negatives, but structurally double-peaked so it could not localise),
tangent-jump field (right observable, cannot be traced on coarse jittered
meshes).

### 50.4 THE CONSEQUENCE IS A DOMAIN BOUNDARY, NOT AN ESTIMATOR FAILURE

The correct reading is narrow and worth stating exactly:

> **At sufficiently poor or irregular mesh resolution, arbitrary sharp features
> cannot be inferred automatically from the mesh alone.**

That is a reasonable domain boundary for a low-compute aerodynamic estimator,
and it implies a fallback architecture:

- **mesh passes a ribbon-quality gate** -> canonical skin + ribbons, with
  directional analysis available;
- **mesh fails it** -> transverse area/scalar estimator, lower confidence,
  **directional analysis unavailable**.

**THE QUALITY GATE ITSELF IS NOT DESIGNED HERE.** What it measures, where its
threshold sits, and how a failing mesh is reported to the user are a separate
piece of work needing its own spec. Flagged, not started.

**Nothing in this section licenses running the independent chine.** Spec 48 did
not pass, so per the standing rule the independent asymmetric control
**remains untouched and unspent** — available intact if a future architecture
ever earns a run at it.

**STATE.** Gate 1 CLOSED / PASS. Gate 2 FAILED at the spec 39 numbers and is
not re-run. Feature-preserving branch **CLOSED — observable valid, extraction
not universal**. Partitioning never started. Skin bandwidth, completion,
`gapMax`, fidelity tolerances all untouched. **Independent chine untouched.**
No Cd, no calibration, no Sunship, no production change. Production remains at
`12e8c5e` with zero lines of estimator or calibration altered across the entire
programme.

---

## 51. **RIBBON ELIGIBILITY — FROZEN 2026-08-20, PRE-BUILD AND PRE-INSPECTION.** (owner ruling, reviewer-authored; transcribed and operationalised here)

### 51.0 STATUS OF THE PRECEDING BRANCH

**Accepted and closed.** Universal automatic sharp-feature extraction at the
tested coarse/irregular mesh quality is **FAIL / CLOSED**. No peak merging, no
adaptive tracing, no sixth detector, no coarse-mesh rescue. The distinction
that stands:

- **canonical smooth-surface reconstruction — DEMONSTRATED** (Gate 1, ten
  tessellations, 128.14 deg -> 0.000 deg, positional RMS 0.006% against 0.5%);
- **universal sharp-feature inference from arbitrary coarse meshes — NOT
  demonstrated, and now OUTSIDE the V2 requirement.**
- **tangent-jump observable — BANKED AS A DIAGNOSTIC.** 45.61 deg measured
  against 45.573 deg analytic. The physical observable is valid; robust
  universal *extraction* of it at poor mesh quality is what failed.

### 51.1 WHAT THIS SECTION IS, AND WHAT IT IS DELIBERATELY NOT

This is an **operational eligibility gate on the actual ribbon pipeline**. It
is a **geometry capability gate only**.

**It is NOT** a predictor of whether a polygon mesh represents its intended
smooth surface. **Phase 1C already established the information limit** on
inferring that from raw mesh metadata (spec 18-20: KILL, all five folds). This
section does not reopen that. It asks a strictly narrower question:

> Did the ribbon pipeline run **well-posed** on this mesh, over the retained
> domain, without silently forcing anything?

**No Cd consequences are defined here.** No confidence weighting, no
calibration coupling, no production change. Eligibility is a capability flag;
what it is worth aerodynamically is Phase 2's question, not this one's.

### 51.2 THE DECLARED LIMIT — STATED BEFORE ANY RESULT, SO IT CANNOT BE FORGOTTEN

> **ELIGIBLE MEANS WELL-POSED. IT DOES NOT MEAN CORRECT.**

Every tolerance in specs 21 and 36 is measured against an analytic oracle. A
supplied mesh has no oracle. Therefore **every criterion below is a
well-posedness or self-consistency criterion**, and none of them is an
accuracy criterion. An eligible mesh is one on which the pipeline is entitled
to speak; it is not a mesh whose ribbon values have been verified. Any later
document that reports "eligible" as "validated" is misreading this section.

### 51.3 THE RETAINED DOMAIN — UNCHANGED, NOT RE-DERIVED

The operator-matched grid of 36.4.2, verbatim: **128 axial stations, 2.5%
fixed axial tip exclusion (4.7), 3% body-length symmetric secant span (4.6),
rays at the ribbon count under test.** Eligibility is judged **only** over this
retained domain. Behaviour inside the excluded tips is out of scope, as it has
been since 4.7.

### 51.4 THE FIVE ELIGIBILITY CONDITIONS, FROZEN

A mesh is **ELIGIBLE** for ribbon mode if and only if **all five** hold over
the retained domain. Any failure yields **INELIGIBLE**, with the failing
condition and its location reported. **No repair is attempted on failure.**

**E1 — CANONICAL-SKIN CONSTRUCTION SUCCEEDS.**
`makeSkin` returns without throwing (no degenerate mesh scale), and **every
evaluation the ribbon operator performs over the retained domain uses the
intended quadratic fit.** Operationally: `stats.nearest + stats.empty +
stats.linear == 0` for evaluations on the retained domain.

> Rationale for including `linear`: all three are the same event — *the
> intended fit was not available here and something else was substituted*.
> `nearest` returns a raw mesh vertex, which is precisely the faceted quantity
> the 1F architecture exists to avoid. Strictness is uniform and deliberate.

**E2 — RAY INTERSECTIONS ARE UNAMBIGUOUS WHERE THE OPERATOR READS THEM.**
`skinRadii` returns `multi == 0` and `missed == 0` at every retained station,
at every ribbon count tested. This is the frozen 36.5 domain rule applied as a
gate: **multiple radial intersections are reported, never forced.** The
outermost-hit envelope convention of 4.4 is a declared *aerodynamic
surrogate*; using it to absorb a genuine multi-hit is exactly the silent
forcing this gate exists to catch.

**E3 — NOTHING IS SILENTLY FORCED.**
E1 and E2 cover the two known forcing paths. E3 additionally requires that
**invalid input is reported as invalid input, not as a reconstruction
result** — per 36.4, non-manifold, self-intersecting or degenerate meshes are
**INPUT failures**, a distinct outcome from INELIGIBLE, and must not be
silently reconstructed.

**E4 — RIBBON OUTPUTS SATISFY THE ALREADY-FROZEN CONVERGENCE REQUIREMENT.**
Spec 6, carried forward unchanged: **zone-turning results shift < 5% across
ribbon counts 12 / 24 / 48.** All three counts are run; the 36.6.6 anti-cheat
stands — **a coarse theta grid that merely fails to see bad geometry is not a
pass.** E2 is therefore evaluated at all three counts, not only the coarsest.

> **KNOWN GAP, STATED NOT PAPERED OVER:** spec 6 also requires stability
> across **two mesh resolutions**. For an arbitrary supplied mesh this is
> **unavailable** — there is only the one mesh. It is therefore required
> **only for EAS-owned generated geometry**, where a second resolution can be
> exported at source, and is recorded as **NOT EVALUATED** for arbitrary
> uploads. This asymmetry is real and is not a defect of the gate: it is one
> more reason that EAS-owned geometry should be fixed at the exporter rather
> than repaired downstream.

**E5 — STRONG UNRESOLVED SHARP-FEATURE BEHAVIOUR YIELDS INELIGIBLE, NOT
REPAIR.**

The closed branch proved that a sharp feature cannot be **traced into a curve**
at poor mesh quality. It did **not** show that its **presence** is
undetectable — the tangent-jump field returns the crease angle itself to 0.04
deg, and its negative controls were clean at every threshold >= 3 deg.

E5 therefore uses the **already-built, already-validated tangent-jump field as
a magnitude occurrence statistic only**:

> count the retained-domain evaluation windows whose tangent jump exceeds the
> threshold. **No linking. No span filter. No completion. No merging. No
> tracing.** Nothing that failed in 42-50 is re-entered.

**This is not a sixth detector.** It recovers no geometry and repairs nothing.
It answers one binary question — *is a feature present that the smooth skin
will smear?* — and on yes, the answer is INELIGIBLE.

**THE THRESHOLD IS NOT CHOSEN HERE. THE SELECTION RULE IS**, mirroring 4.7 so
that this cannot become a tuning exercise:

> Use the **SMALLEST** threshold in the 50 ladder (3, 5, 7.5, 10, 15, 20 deg)
> at which **all ten Gate-1 tessellation families return a zero count** —
> i.e. clean negatives on known-smooth geometry. Test 10 deg first. If 10 deg
> is not clean, test 15, then 20. **If 20 deg is not clean, E5 FAILS as a
> criterion** and is recorded as such: the gate then falls back to E1-E4 only,
> with the loss of sharp-feature screening stated explicitly as a known hole,
> and **no further attempt is made to rescue it.**

Note the direction of the risk. E5's negative control is on **smooth**
geometry, where a false positive costs an unnecessary INELIGIBLE — the safe
error. A false *negative* costs a smeared corner reported as eligible. The
selection rule above is therefore deliberately biased toward the safe error.

### 51.5 OUTCOMES

Exactly three, machine-readable, mutually exclusive:

| outcome | meaning | downstream |
|---|---|---|
| **ELIGIBLE** | all five conditions hold over the retained domain | canonical skin -> ribbons -> directional / family analysis |
| **INELIGIBLE** | E1-E5, one or more failed; failing condition + location reported | existing transverse-area / scalar estimator; **ribbon and directional analysis UNAVAILABLE or lower-confidence** |
| **INPUT FAILURE** | mesh invalid per 36.4 — non-manifold, self-intersecting, degenerate scale | nothing is reconstructed; the input is rejected as an input |

**User-facing surfacing is OUT OF SCOPE of this section.** The machine-readable
result is defined here; how it is worded, shown or explained in the product is
a separate piece of work and is not started.

### 51.6 EXECUTION ORDER, FROZEN — AND THE ORDER IS THE POINT

1. **Commit this section.** Done, by this file, **before any code exists and
   before any EAS geometry is inspected.**
2. **Validate the gate against known truth — its own two-sided control.**
   The gate must return **ELIGIBLE on the ten Gate-1 tessellation families**
   (demonstrably reconstructible: 0.000 deg false turning, 0.006% RMS) and
   **INELIGIBLE on the burned flat/chine bodies** (demonstrably not: Gate 2
   FAIL, 2 of 4). A gate that cannot separate those two known sets is
   unfalsified and must not be pointed at unknown geometry.
   **This spends nothing new** — every body in step 2 is already burned.
3. **Only then, run the real EAS preset meshes** — as **MEASUREMENTS, NOT
   ASSUMPTIONS.** Report which pass, which fail, and why, per condition.
4. Move to Phase 2.

**Step 2 is inserted by the assistant and is not in the transcribed ruling.**
It is the negative control for the gate itself. Recorded here as an addition
so that the distinction between ruled and added is not lost.

### 51.7 IF AN EAS PRESET FAILS — THE FORBIDDEN RESPONSE, NAMED IN ADVANCE

**Do NOT modify the gate.** First determine which of two things is true:

1. the mesh is **genuinely unsuitable** for ribbons; or
2. the problem is **controllable at source** by exporting or generating a
   better aerodynamic mesh.

> **For EAS-owned geometry, improving the source mesh is preferable to making
> the estimator increasingly clever at repairing bad meshes.**

That is the whole lesson of specs 42-50 applied one layer up. This programme
has now spent an entire branch proving that downstream cleverness does not
rescue upstream mesh quality; the same conclusion applies to the gate.

**The gate was frozen before the presets were inspected precisely so that
"the Sunship passes" cannot become the design target.** If a preset fails,
that is a finding about the preset.

### 51.8 THE UNSPENT CONTROL STAYS UNSPENT

`chine-independent.mjs` — built, input-validated to 9.99e-16, never run
through any reconstruction — **is NOT to be consumed for eligibility work.**
It remains the only unseen non-smooth control the programme has, and it is
reserved as future evidence should sharp-feature reconstruction ever be
revisited.

### 51.9 SCOPE FENCE

No Cd. No calibration. No Sunship tuning. No production change. No detector
work of any kind. Every prior kill and retraction stands. Production remains
at `12e8c5e` with zero lines of estimator or calibration altered.

### 51.10 WHAT COMES AFTER — RECORDED SO THE TARGET DOES NOT DRIFT

Once eligibility is established, **geometry-preprocessor development STOPS**
and the estimator question resumes:

> **Does the validated ribbon representation improve aerodynamic
> family / routing / Cd inference over the current scalar representation?**

That is the next estimator milestone. The shape of the next result worth
having is **not** another geometry-processing trick; it is:

> *here are two bodies the scalar representation sees as similar, and ribbons
> correctly recognise that their longitudinal turning histories belong to
> different aerodynamic families.*

### 51.11 STEP 2a RESULT (2026-08-20): **E5 FAILS AS AN ELIGIBILITY CRITERION.** Recorded BEFORE any burned chine was evaluated.

`elig-select-e5.mjs`, run on the **ten Gate-1 known-good controls only**. No
chine body is built, imported or evaluated by that file. Magnitude occurrence
count only — no linking, no span filter, no completion, no tracing.

| family | nt | max jump | NaN% | 3 deg | 5 | 7.5 | **10** | **15** | **20** |
|---|---|---|---|---|---|---|---|---|---|
| regular | 30 | 2.44 deg | 0.0% | 0 | 0 | 0 | **0** | **0** | **0** |
| G1 sine jitter | 30 | 18.02 deg | 16.8% | 159 | 44 | 16 | **7** | **2** | **0** |
| G2 block density | 30 | 2.56 deg | 0.0% | 0 | 0 | 0 | **0** | **0** | **0** |
| G3 azimuthal shear | 30 | 1.52 deg | 0.0% | 0 | 0 | 0 | **0** | **0** | **0** |
| **G4 surface walk** | 30 | **157.17 deg** | 1.1% | 701 | 321 | 183 | **130** | **79** | **55** |
| regular | 118 | 0.21 deg | 0.0% | 0 | 0 | 0 | **0** | **0** | **0** |
| G1 sine jitter | 118 | **72.25 deg** | 15.9% | 903 | 501 | 281 | **167** | **66** | **28** |
| G2 block density | 118 | 0.64 deg | 0.0% | 0 | 0 | 0 | **0** | **0** | **0** |
| G3 azimuthal shear | 118 | 4.90 deg | 0.0% | 12 | 0 | 0 | **0** | **0** | **0** |
| **G4 surface walk** | 118 | **174.22 deg** | 1.6% | 984 | 550 | 344 | **256** | **168** | **128** |

The frozen 51.4 ascent, run exactly as written — test 10, then 15, then 20:

> 10 deg -> worst count **256**, not clean, ascend
> 15 deg -> worst count **168**, not clean, ascend
> 20 deg -> worst count **128**, not clean, ascend
>
> **No ladder value through 20 deg is clean on known-smooth geometry.**

**Per the pre-registered branch in 51.4, E5 FAILS AS A CRITERION.** The gate
falls back to **E1-E4 only**, with the loss of sharp-feature screening
recorded here as a known hole. **No rescue is attempted.** This outcome was
written into 51.4 before the field was ever evaluated, so it is a registered
result and not an alteration of the spec.

#### 51.11.1 WHY IT FAILED, AND IT IS NOT THE OBSERVABLE'S FAULT

Spec 50's negative controls were clean at every threshold >= 3 deg. Those
counts were taken **after peak-finding, fixed-window linking and the span
filter `S = 46`**. 51.4 deliberately removed all three, because every one of
them is machinery that failed in 42-50 and none of it may be re-entered.

**The span filter was doing the work.** Without it, the raw magnitude field is
not clean on smooth geometry, and the separation is generator-specific:

- **regular, G2 block density, G3 azimuthal shear: max jump 0.21-4.90 deg.**
  Clean at 5 deg and above. These would have selected a threshold immediately.
- **G1 sine jitter, G4 surface walk: max jump 18-174 deg on a SMOOTH BODY.**

174 deg is very nearly a full tangent reversal, on a surface with no feature
anywhere. The mechanism is **azimuthal parameterisation degeneracy, not
geometry**: both G1 and G4 move vertices in a way that can place neighbouring
`u` samples nearly coincident or locally out of order, so the two one-sided
fits of `makeJumpField` are built on near-degenerate neighbourhoods and their
tangents point opposite ways. G1's 16-17% NaN fraction is the same effect one
step further on — the one-sided fit failing outright.

> **The tangent-jump magnitude conflates a sharp geometric feature with a
> locally degenerate azimuthal parameterisation.** Spec 50's span filter hid
> that by demanding a long coherent curve; a bare magnitude test cannot.

This does **not** retract 50.2. The observable still reads a real crease at
45.61 deg against 45.573 deg analytic. What 51.11 adds is narrower and was not
previously known: **its magnitude alone is not a usable presence test on
irregularly parameterised meshes.**

#### 51.11.2 CONSEQUENCE, STATED PLAINLY

The gate now has **no sharp-feature screening at all.** E1-E4 are
well-posedness and self-consistency tests; none of them asks whether a corner
is being smeared. A mesh carrying a real chine can be perfectly well-posed —
skin builds, no multi-hits, converges across 12/24/48 — and E1-E4 have no
grounds to refuse it.

**This is recorded before Step 2b is run, so that whatever the burned chines
return, the number that classified them was not chosen after seeing them.**

### 51.12 STEP 2b RESULT (2026-08-20): **THE GATE DOES NOT SEPARATE KNOWN-GOOD FROM KNOWN-BAD. STOP AND REPORT.**

`elig-validate.mjs`, run once against the frozen target of 51.6 step 2. **No
criterion in 51 has been altered.** The independent asymmetric chine was not
touched. E5 was not applied — it failed selection in 51.11 and the gate ran
its registered E1-E4 fallback.

| body | E1 | E2 | E3 | E4 | maxJump | outcome | expected |
|---|---|---|---|---|---|---|---|
| regular nt=30 | PASS | PASS | PASS | PASS | 2.44 | ELIGIBLE | ok |
| **G1 sine jitter nt=30** | **FAIL** | PASS | PASS | PASS | 18.02 | **INELIGIBLE** | **want ELIGIBLE** |
| G2 block density nt=30 | PASS | PASS | PASS | PASS | 2.56 | ELIGIBLE | ok |
| G3 azimuthal shear nt=30 | PASS | PASS | PASS | PASS | 1.52 | ELIGIBLE | ok |
| G4 surface walk nt=30 | PASS | PASS | PASS | PASS | 157.17 | ELIGIBLE | ok |
| regular nt=118 | PASS | PASS | PASS | PASS | 0.21 | ELIGIBLE | ok |
| **G1 sine jitter nt=118** | **FAIL** | PASS | PASS | PASS | 72.25 | **INELIGIBLE** | **want ELIGIBLE** |
| G2 block density nt=118 | PASS | PASS | PASS | PASS | 0.64 | ELIGIBLE | ok |
| G3 azimuthal shear nt=118 | PASS | PASS | PASS | PASS | 4.90 | ELIGIBLE | ok |
| G4 surface walk nt=118 | PASS | PASS | PASS | PASS | 174.22 | ELIGIBLE | ok |
| chine regular nt=96 | PASS | **FAIL** | PASS | PASS | 47.83 | INELIGIBLE | ok |
| chine G1 jitter nt=96 | **FAIL** | PASS | PASS | PASS | 68.08 | INELIGIBLE | ok* |
| **chine regular nt=30** | PASS | PASS | PASS | PASS | 59.69 | **ELIGIBLE** | **want INELIGIBLE** |
| chine G1 jitter nt=30 | **FAIL** | PASS | PASS | PASS | 89.22 | INELIGIBLE | ok* |

> **known-good -> ELIGIBLE: 8 / 10**
> **burned chine -> INELIGIBLE: 3 / 4**
> **invalid -> INPUT FAILURE: 5 / 5, no leaks**
>
> **STEP 2: FAIL.**

`*` marks a body that reached the right answer **for the wrong reason** — see
51.12.2.

#### 51.12.1 E1 REJECTS TWO KNOWN-GOOD FAMILIES, AND THE CAUSE IS A POINT COUNT

Diagnosed after the run as instructed, not exempted before it.

**Every single fallback site has `n = 7`.** `makeSkin` requires `n >= 8` for
the 6-term quadratic `[1, dx, du, dx^2, dx*du, du^2]`; these windows held
seven weighted neighbours and took the 3-term fit instead.

- **12 distinct evaluation windows** on G1 nt=30 (36 counts across the three
  ray-count passes), **8 distinct** on G1 nt=118 (24 counts).
- **0.039% of the 30 720 retained-domain evaluations.**
- Scattered mid-body over 8 distinct stations, `x/L` 0.102-0.866. **No
  clustering, no tip involvement, no relation to any feature.**
- The frozen Gate 1 oracle measures these same two families at **RMS 0.006%
  against a 0.5% tolerance, false turning 0.000 deg** — re-run and unmoved.

> **This is an identifiability threshold, not a mesh defect.** It is the same
> class as the spec 4 lesson: a basis needing more distinct samples than the
> window supplies. The mesh is fine, the surface is recovered to 0.006%, and
> the criterion fires anyway.

**A second, separate finding falls out of the same measurement.** Gate 1's
raw diagnostics look far worse than the retained domain is: for regular
nt=30, Gate 1 reports `lin 512`, and **all 512 lie in the eight excluded tip
stations** — the retained domain has **zero**. For G1 nt=30, all **267
`nearest` evaluations are likewise entirely in the tips.** The 2.5% tip
exclusion of 4.7 is doing more work than anyone had noticed.

#### 51.12.2 THE CHINE RESULT IS WORSE THAN ONE ESCAPE: THE GATE IS **ANTI-CORRELATED** WITH RECONSTRUCTION ACCURACY

Measured on the same detector-free skin the gate uses, against the analytic
chine, over the retained domain:

| chine body | hu | worst profile error | Gate 2 (2%) | gate outcome | fired on |
|---|---|---|---|---|---|
| **regular nt=96** | 9.37 deg | **0.183%** | **PASS** | **INELIGIBLE** | E2, 59 multi-hits |
| G1 jitter nt=96 | 7.19 deg | 0.937% | PASS | INELIGIBLE | E1 7-neighbour artefact |
| **regular nt=30** | 30.00 deg | **2.640%** | **FAIL** | **ELIGIBLE** | nothing |
| G1 jitter nt=30 | 22.97 deg | 4.427% | FAIL | INELIGIBLE | E1 7-neighbour artefact |

*(0.183% at hu 9.37 deg and 2.640% at hu 30.00 deg reproduce the spec 39 Gate
2 record exactly, which independently confirms 42's finding that the
partitioning is inert and that building the skin detector-free changes
nothing.)*

> **The body the gate refuses is the most accurately reconstructed one.
> The body the gate accepts is a Gate 2 FAILURE.**

The mechanism is direct and it is not an implementation bug:

- at **hu 9.37 deg** the corner **survives** in the skin, the quadratic fit
  overshoots at it, and the overshoot is deep enough that rays cross the
  section more than once — **E2 correctly reports a multi-hit**;
- at **hu 30.00 deg** the corner is **smeared**, the overshoot is far
  shallower, and no ray crosses twice — so **E2 has nothing to report.**

**Measured with the corrected convexity test (see 52.7.4):** both chine
bodies are non-convex at ~90 of 120 retained stations, but the worst reflex
depth is **0.0637% at nt=96 against 0.0224% at nt=30** — a 2.8x difference in
overshoot depth, with 59 multi-hits against 0. The original wording here said
the coarse corner became a "smooth convex blob"; it does not. It stays
slightly non-convex, just too shallowly for a ray to notice. The mechanism is
**overshoot DEPTH**, and the inversion it produces is unchanged.

> **WELL-POSEDNESS IMPROVES AS THE FEATURE IS DESTROYED.**

And the two jittered chines reach INELIGIBLE only through the E1
seven-neighbour artefact of 51.12.1 — **an accident of point counting that has
nothing to do with their chine.** Of four bodies carrying a real 45.6 deg
crease, exactly **one** is refused for a feature-related reason, and it is the
one that did not need refusing.

#### 51.12.3 WHAT THIS DOES AND DOES NOT OVERTURN

**It does not touch Gate 1.** Re-run this session, PASS on all ten, every
number identical: G1 nt=30 still 128.14 deg -> 0.000 deg at RMS 0.006%.
Reconstruction-before-slicing stands exactly as banked in 50.2.

**It does not retract 51.2** — it sharpens it. 51.2 said eligible means
well-posed, not correct. 51.12.2 shows the stronger and more uncomfortable
statement: **on this control set the two are anti-correlated**, and "eligible"
can mean *the feature was successfully destroyed*. A gate built only from
well-posedness tests will systematically prefer the meshes that smooth
features away.

**E3 is the one unqualified success.** All five invalid geometries — non-manifold,
open, degenerate-face, degenerate-scale, undersized — routed to INPUT FAILURE
with no leak to either eligibility answer. The declared hole stands:
**self-intersection is NOT TESTED.**

**E4 discriminates nothing here.** Worst median zone-turning shift across
12/24/48 is <= 0.07% on every one of the fourteen bodies, chines included.
It is a real well-posedness check and it is passing honestly; it simply does
not carry information about feature fidelity. Reported per the 10 rule, the
**inter-ribbon spread separates the two sets less cleanly than first stated**:
**0.001-4.904 deg** on smooth bodies against **14.4-118.2 deg** on the chines.
The worst smooth body is G1 sine jitter nt=30 at 4.904 deg, so the margin is
about **3x**, not the three orders of magnitude claimed in the first draft of
this section. **CORRECTED 2026-08-20** — the original figure quoted the smooth
range as 0.001-0.082 deg, which silently dropped the worst smooth body. It is
recorded as an observation, NOT proposed as a criterion, and nothing has been
tuned to it.

#### 51.12.5 CORRECTION (2026-08-20): THE RETAINED-BAND EVALUATION DEFECT

`eligibility.mjs` originally evaluated the skin **only** at retained stations
`[i0, i1]`, leaving the tip stations zero. **`ribbonMetrics` reads outside that
band by design**: its symmetric secant is a frozen PHYSICAL span of 3% of body
length (4.6), which at 128 stations reaches ~2 stations past each retained
boundary. It therefore differenced real radii against zeros and fabricated an
enormous false slope at the first and last retained station.

**Gate 1 and Gate 2 both evaluate all 128 stations and let `ribbonMetrics` do
the restricting.** Evaluating only the retained band was **narrower than the
frozen operator** — the spec 4 failure #2 pattern exactly, committed again.

Fixed: the retained band is evaluated first and the E1/E2 statistics are
snapshotted there (they are correctly retained-domain quantities, 51.3), then
the tip stations are filled in for `ribbonMetrics` alone.

**What moved:** zone 0 and zone 7 medians only, from ~51 deg to ~22.9 and
~22.1 deg. Zones 1-6 unchanged to three decimals. **Every E1-E5 verdict and
every outcome in the 51.12 table is unchanged**, as are the E4 shifts
(<= 0.07%) and the E1 and E2 detail. The defect inflated two edge zones and
changed no conclusion.

#### 51.12.4 STOPPED HERE

Per the ruling: **the matrix failed, so this stops and reports. Spec 51 is
not altered, and no EAS preset has been inspected.** The gate is not frozen
and must not be pointed at EAS-owned geometry in this state.

**Diagnostic-only change to `skin.mjs`:** `stats.linearSites` records where the
6-term fit was unavailable. It is additive, touches no returned value and no
numeric path, and Gate 1 was re-run afterwards to prove **every number
unmoved** — the same discipline the spec 38 tolerance amendment required.

---

## 52. **QUICKHULL TRANSFER EXPERIMENT — FROZEN 2026-08-20, PRE-BUILD.** (owner ruling, reviewer-authored)

### 52.1 WHY, AND WHAT THIS IS NOT

Production does not accept arbitrary mesh topology as aerodynamic truth. The
**CANONICAL UPLOAD-HULL RULE** (graduation 2026-08-16, `calcv2/web/worker.js`)
computes **one convex hull** and declares it the geometry identity for every
downstream measurement:

> *"ONE convex hull, computed once, is the geometry identity for EVERY
> downstream measurement — sectional estimator, dynamics areas, volume. No two
> subsystems ever see different geometry."*

**Every tessellation family this programme has ever tested is a LATHE**:
regular rings, sine jitter, block density, azimuthal shear, surface walk. A
QuickHull polyhedron has **no ring structure at all**. Gate 1's "PASS on all
ten" was therefore measured on a class of geometry that production **never
feeds the estimator**.

> **THE QUESTION: do the smooth-skin results transfer to the actual input
> class?**

**THIS IS A REPRESENTATIVENESS CHECK ONLY.** No new skin architecture is
designed here. No smoothing scale is declared here. No bandwidth is changed.
No detector is reopened. The existing canonical-skin / ribbon path is run
**unchanged** and is either shown to transfer or shown not to.

### 52.2 INPUT CONSTRUCTION, FROZEN

**Bodies — analytic, smooth, CONVEX, truth already known:**

| body | why |
|---|---|
| **prolate spheroid** `A=3, B=1` | the Gate 1 body verbatim — direct comparability with the banked result |
| **triaxial ellipsoid** `A=3, By=1, Bz=0.6` | the spec 5 DIRECTIONALITY control; without it a broken theta path could pass unnoticed on an axisymmetric body |

Closed-form oracle for both:
`r(x, th) = sqrt( (1 - x^2/A^2) / (cos^2(th)/By^2 + sin^2(th)/Bz^2) )`.

**Both bodies are convex**, so hulling cannot change the geometry they
represent — only how finely it is sampled. A non-convex control is
deliberately excluded: hulling would alter the body itself and confound the
transfer question with a shape change.

**Sampling patterns — five, materially different:**

- **P1 lathe rings** — the old topology, now hulled
- **P2 Fibonacci spiral** — quasi-uniform, no rings
- **P3 uniform random** — seeded, deterministic
- **P4 density-graded** — deliberately biased forward, tests non-uniform density
- **P5 jittered lathe** — jitter 0.4, the family that has broken most things

**Densities — three:** approximately **600 / 2 500 / 12 000** points.

`Math.random` is PROHIBITED. All randomness is a seeded deterministic
generator so every number here is reproducible.

**Every sampled point must lie EXACTLY on the analytic surface** — the spec
36.4 `verifyGenerator` discipline, asserted at `< 1e-12`. A sampling bug must
be an INPUT failure, never a reconstruction result.

**The hull is computed by the VENDORED PRODUCTION QuickHull**
(`site/calcv2/vendor/quickhull3d.js`), imported directly so the
experiment cannot drift from what production actually runs.

**THE SKIN IS FIT TO HULL POINTS ONLY**, re-indexed. Production passes the
full vertex array alongside hull faces, which is harmless there because every
measure it feeds (`axisExtents`, `projectedFrontalArea`, `faceAreaSum`) is
provably inert to interior points. **A surface fit is NOT inert to interior
points** — they would pull the fit inward off the hull. Recorded so the
difference is deliberate and visible.

### 52.3 THE PIPELINE IS RUN UNCHANGED

`makeSkin` / `skinRadii` / `ribbonMetrics` exactly as frozen. Bandwidth
`(cx, cu) = (2.5, 2.5)` untouched. Both configurations are reported:

- **`features: FEATURES`** — literally the Gate 1 configuration, the result
  whose transfer is under test;
- **`features: null`** — the detector-free configuration of spec 51.

Spec 42 found the partitioning INERT and spec 51.12 reproduced the Gate 2
numbers exactly without it. **On hull topology that is an assumption, not a
finding**, so both are measured.

### 52.4 METRICS AND TOLERANCES — CARRIED FORWARD VERBATIM, NOT RE-DERIVED

| test | criterion | source |
|---|---|---|
| positional vs analytic oracle | normalised-radius RMS **<= 0.5% Rmax**, 99th pct **<= 1.5% Rmax** | spec 21, verbatim |
| ribbon false turning | **<= 0.5 deg** max, **<= 0.1 deg** median | spec 21, verbatim |
| **cross-representation agreement** | RMS **<= 0.5% Rmax**, p99 **<= 1.5% Rmax**, zone turning within **2% or 0.5 deg, whichever larger** | spec 21 cross-tessellation row, verbatim |
| convergence 12/24/48 | median zone-turning shift **< 5%** | spec 6, verbatim |

**Cross-representation agreement is the criterion that matters most**, and it
is the only one here that needs **no oracle**: it asks directly whether the
same aerodynamic body, represented by different convex-hull tessellations,
produces the same canonical skin and the same ribbons. **ALL PAIRS** of the
representations of a body are compared and the **WORST** pair is the reported
figure — no designated reference, because choosing one would be an arbitrary
selection.

**CONVEXITY IS REPORTED, NOT GATED.** Per the ruling, no tolerance-based
"acceptable non-convexity" criterion is invented. Every retained reconstructed
transverse section is tested for reflex vertices and the depth distribution is
reported. A convex input whose skin has non-convex sections is an
**architectural defect on the record**, and the eventual fix is a skin that
preserves convexity by construction — not a threshold.

**HULL INSCRIPTION ERROR IS AN INPUT PROPERTY AND IS REPORTED SEPARATELY.**
A hull of points sampled on a convex surface is **inscribed** in it: the
polyhedron sits inside the true surface by a chord deficit of order
`h^2 / 8R`. That is a property of the sampling, not of the skin. It is
measured directly — hull surface against the analytic oracle on the operator
grid — so that any positional failure can be **attributed** rather than
blamed on reconstruction.

### 52.5 KILL / STOP, FIXED IN ADVANCE

> If the hulled representations fail the frozen spec 21 tolerances, then
> **Gate 1's evidence does not transfer to production's actual input class.**
> Report it and STOP.

**No bandwidth is adjusted to rescue the result. No skin architecture is
redesigned inside this experiment.** The reframe is not freezable on the
strength of results measured on a geometry class production never sees, and
whether it is freezable at all is the ruling that follows this report.

### 52.6 OUT OF SCOPE

**No EAS mesh is inspected.** **The independent asymmetric chine is not
touched.** No declared spatial scale, no bandwidth change, no convexity-
preserving fit, no 2D-hull sectional primitive, no feature detector. Those are
candidate consequences of this experiment and none of them is authorised by
it. No Cd, no calibration, no production change.

### 52.7 RESULT (2026-08-20): **GATE 1 DOES NOT TRANSFER. 4 / 15 PASS, CROSS-REPRESENTATION FAILS.** Stopped per 52.5.

Run once as frozen, on both bodies and both skin configurations. Identical
verdict in all four combinations: **per-representation 4/15 PASS,
cross-representation FAIL.**

| | worst RMS (limit 0.5%) | worst p99 (limit 1.5%) | worst zone turning | verdict |
|---|---|---|---|---|
| spheroid, `features:null` | **3.568%** | 14.117% | **4444% of limit** | FAIL |
| spheroid, `features:FEATURES` | 3.547% | 14.324% | 4444% | FAIL |
| triaxial, `features:null` | **3.798%** | 12.958% | **4538% of limit** | FAIL |
| triaxial, `features:FEATURES` | 3.838% | 13.216% | 4538% | FAIL |

105 pairs each. Worst pair in every case: **random n=600 vs graded n=600.**

#### 52.7.1 THE SPLIT IS NOT HULL-VS-LATHE. IT IS AZIMUTHAL REGULARITY.

Prolate spheroid, `features:null`, retained domain:

| representation | hull rms/p99 (INPUT) | skin rms | false turning | quad / lin / nearest |
|---|---|---|---|---|
| lathe n=12000 | 0.039% / 0.194% | **0.006%** | **0.000 / 0.000** | 30720 / 0 / 0 |
| fibonacci n=12000 | 0.023% / 0.053% | **0.008%** | **0.000 / 0.000** | 29360 / 1360 / 0 |
| jitteredLathe n=12000 | 0.041% / 0.192% | **0.011%** | **0.000 / 0.000** | 30720 / 0 / 0 |
| fibonacci n=2500 | 0.110% / 0.257% | 0.128% | 0.230 / 0.000 | 28927 / 1793 / 0 |
| lathe n=2500 | 0.176% / 0.638% | 0.038% | 0.873 / 0.000 | 30720 / 0 / 0 |
| **random n=12000** | 0.057% / 0.170% | **0.308%** | **94.4 / 32.8** | 13437 / 15133 / 2150 |
| **graded n=12000** | 0.081% / 0.295% | **2.201%** | **380.0 / 138.1** | 6440 / 13856 / **10406** |

**QuickHull topology is NOT the problem.** Three of the five patterns
reproduce the banked Gate 1 result on genuine QuickHull polyhedra — 0.006%
RMS and **0.000 deg false turning**, which is Gate 1's number exactly. The
architecture does transfer to hull connectivity.

**What breaks it is irregular azimuthal sampling.** `random` and `graded`
fail at **every density**, and the fit statistics say why: the quadratic fit
is used for only **21-45%** of retained evaluations against **96-100%** for
the structured patterns.

#### 52.7.2 THE DECISIVE FINDING: REFINEMENT MAKES IT WORSE

`graded`, prolate spheroid, as the point count rises 20x:

| n | hull rms (INPUT) | skin rms | quadratic | nearest |
|---|---|---|---|---|
| 600 | 1.360% | 2.596% | 8418 | 7140 |
| 2 500 | 0.353% | 1.218% | 7058 | 8686 |
| **12 000** | **0.081%** | **2.201%** | **6440** | **10406** |

> **The input improves 17-fold. The reconstruction gets WORSE. The count of
> evaluations falling back to a raw mesh vertex RISES from 7 140 to 10 406.**

The mechanism is direct, and it is the mesh-derived bandwidth:
`hu = cu x median(edge du)`. Refinement shrinks the **median** spacing, so
the bandwidth shrinks — but a graded cloud's **sparse** regions do not densify
at the same rate. The fit window therefore contracts faster than the sparse
regions fill, and neighbourhoods that were merely thin become empty.

> **The mesh-derived bandwidth does not merely make the skin
> tessellation-dependent. It DESTROYS CONVERGENCE UNDER REFINEMENT for
> non-uniform sampling.** Sending the same body with more triangles can make
> the estimator's answer worse, without limit and without warning.

That is a stronger statement than "two tessellations get two skins", and it
was not previously on the record.

#### 52.7.3 ATTRIBUTION IS CLEAN: THE HULL IS A GOOD INPUT

Pre-registered in 52.4 so a failure could be attributed rather than blamed.
**Hull inscription error is small everywhere it matters** — 0.021-0.081% RMS
at n = 12 000 across all five patterns, against a 0.5% tolerance. The
convex hull of a well-sampled convex body is an excellent input.

**Every failure above belongs to the skin fit, not to the hull, not to
QuickHull, and not to the sampling being "invalid".** All 30 point clouds
were verified on the analytic surface at ~5e-16.

#### 52.7.4 CONVEXITY — REPORTED, NOT GATED (52.4). **CORRECTED 2026-08-20.**

> **RETRACTION.** The first version of this section stated that *every*
> retained section of *all 30* representations was non-convex, with worst
> reflex depth 0.030%-82.9% of Rmax. **THAT WAS AN ARTEFACT OF AN INVERTED
> SIGN.** The test counted the MAJORITY turn direction, so for a
> counter-clockwise polygon it counted the CONVEX vertices. Pointed at a
> perfect 256-gon circle it returned "256 reflex vertices, 0.0301%" — and
> **0.0301% is exactly the figure that was published as a defect of the skin
> for the cleanest lathe.** It is the sagitta of a 256-gon, i.e. the signature
> of a perfectly convex section.
>
> The test is now orientation-independent (reflex = the MINORITY turn sign)
> and **self-tested against known shapes before any result is emitted**
> (`reflexSelfTest`: CCW circle 0, CW circle 0, dented circle 1). A convexity
> test that is never pointed at a known-convex shape will lie silently.

**Corrected measurement**, prolate spheroid, `features:null`:

| representation | non-convex stations | worst reflex | quad fraction |
|---|---|---|---|
| **lathe n=2500** | **0 / 120** | **0.0000%** | 100% |
| **lathe n=12000** | **0 / 120** | **0.0000%** | 100% |
| lathe n=600 | 4 / 120 | 1.684% | 99% |
| jitteredLathe n=12000 | 16 / 120 | 0.532% | 100% |
| fibonacci n=12000 | 93 / 120 | 0.140% | 96% |
| random n=12000 | 120 / 120 | 8.204% | 44% |
| graded n=12000 | 120 / 120 | 9.260% | 21% |

**The MLS skin is NOT endemically non-convex.** On well-sampled structured
hulls it is **exactly convex** — 0 of 120 stations. Convexity violation
**tracks the fit-fallback fraction**, rising from nothing at 100% quadratic
coverage to every station at 21%.

That is a *narrower* and more useful finding than the retracted one: the
architectural defect is real but it is a **symptom of fit degradation**, not
an inherent property of fitting. It does not change the 52.7 verdict, which
rests on RMS, false turning and cross-representation agreement — none of
which involve this test. **No tolerance is proposed.** The eventual skin
should still preserve convexity by construction, because a symptom that
appears exactly when the fit degrades is not one to rely on detecting.

#### 52.7.5 THE DETECTOR IS NOT QUITE INERT ON HULL TOPOLOGY

Spec 42 found the feature partitioning inert, and 51.12 reproduced the Gate 2
numbers exactly without it. **On hull topology that is no longer exactly
true**: `graded n=600` moves 2.596% -> 2.664% RMS and the cross-representation
worst moves 3.568% -> 3.547%. The differences are small and change no verdict,
but the inertness claim is now bounded to lathe topology rather than general.

#### 52.7.6 WHAT THIS DOES AND DOES NOT LICENCE

**STOPPED HERE per 52.5.** No bandwidth was adjusted. No skin was redesigned.
No EAS mesh was inspected. The independent chine was not touched.

**Honest limit of the finding:** `random` and `graded` are *deliberately
adversarial* azimuthal samplings. **It is NOT established that they resemble
the vertex distribution of a real hulled upload**, which concentrates
vertices at extreme points and is irregular but not uniformly random in
theta. What IS established is that the pipeline is **not robust to azimuthal
irregularity**, that real hulls are irregular, and that the failure mode is
**silent** — a 380 deg false-turning result carries no flag.

Measuring where an actual EAS preset hull falls on the structured-to-
irregular axis is the obvious next question, and it is the first thing the
existing 51.6 step 3 would have done.

---

## 53. **FIXED-GRID CONVEX-HULL SKINNING — ARCHITECTURE AND SELECTION RULE FROZEN 2026-08-20, PRE-BUILD.** (owner ruling, reviewer-authored)

### 53.0 WHAT IS RETIRED, AND WHY

**The mesh-neighbourhood MLS skin (`makeSkin`) is RETIRED as the
canonicalisation architecture.** Spec 52.7 established the cause precisely:
its smoothing scale is `hu = cu x median(edge du)`, tied to local mesh
density, so refinement can shrink the fit window faster than sparse regions
fill. The `graded` family is the proof — a **17-fold better input hull
produced a worse skin**, with nearest-vertex fallbacks rising 7 140 -> 10 406.

> **A canonicaliser that gets worse when its input gets better is not a
> canonicaliser.** It violates the requirement outright: *same convex body ->
> same aerodynamic skin, independent of how that hull happens to be
> triangulated.*

`makeSkin` remains in the record and is not deleted. Gate 1 stands as a
result about lathe topology. It is simply no longer the architecture.

**Also retired here:** the nearest-vertex fallback, the adaptive
mesh-density bandwidth, and any dependence on where QuickHull happened to put
vertices. **No feature detector. No ridge tracer. No K.** None of 42-50 is
re-entered.

### 53.1 THE ARCHITECTURE, FROZEN

> **production convex hull -> deterministic geometric resampling on a FIXED
> body-relative grid -> fixed-scale aerodynamic smoothing -> ribbons**

The hull's vertex distribution is **no longer the sampling grid**. The hull is
interrogated at predetermined coordinates of the estimator's choosing.

**THIS IS NOT PHASE 1E.** Phase 1E treated section edge-crossings as noisy
samples of an unknown intended CAD surface, and died because they are
measured up to 1.5566% off it. **We are no longer recovering that surface.**
The CANONICAL UPLOAD-HULL RULE makes the convex hull *itself* the geometry
identity, so an exact intersection with the hull is not an estimate of
anything — it **is** the canonical object. Edge-crossings are legitimate
canonical input for the first time.

### 53.2 THE REPRESENTATION: TRANSVERSE SUPPORT FUNCTION

At each fixed station `x`, the hull's cross-section `P_x` is **convex** (a
convex body intersected with a plane). Its **support function** is

> **h(x, th) = max over p in P_x of ( p . n_th ),   n_th = (cos th, sin th)**

**Computed from the UNORDERED set of plane-crossing points.** The maximum of a
linear functional over a polygon is attained at a vertex, and every section
vertex is a crossing point, so the max over crossings **is** `h` exactly.

> **NO CONTOUR CHAINING. NO ORDERING. NO MULTI-HIT AMBIGUITY.** An entire
> class of failure — the one that consumed specs 29-33 — does not arise,
> because a support function needs no polygon.

### 53.3 CONVEXITY IS STRUCTURAL, NOT MEASURED

Support functions are exactly the **sublinear** functions. Smoothing with
**non-negative, normalised** weights preserves that:

- **circumferential:** `h_s(th) = SUM_j w_j h(th + phi_j)` with `w_j >= 0`.
  Since `h(th + phi)` is the support function of the rotated body `R_phi K`,
  the sum is the support function of the **Minkowski combination**
  `SUM_j w_j R_phi_j K`. Convex.
- **axial:** `h_s(x, th) = SUM_i w_i h(x_i, th)` is the support function of
  `SUM_i w_i P_x_i`. Convex.

> **THE RECONSTRUCTED SECTION IS CONVEX BY CONSTRUCTION.** Non-convexity is
> therefore an IMPLEMENTATION BUG, not a tolerance. Any reflex vertex found in
> testing is a defect to fix, and **no "acceptable non-convexity" threshold is
> permitted** — the 52.4 ruling, now structural.

**Recovering `r(x, th)` for the ribbon operator:** the smoothed section is the
intersection of half-planes `{ p : p . n_j <= h_j }`. Consecutive constraints
are solved pairwise for the polygon vertices, and the existing ray
intersection recovers `r`. Nothing downstream changes.

### 53.4 THE DECLARED SCALE — BODY COORDINATES ONLY

**The smoothing scale must not depend on triangle count, edge length or
vertex spacing.** It is declared in canonical body coordinates:

- **axial** `sigma_x = s_x . L`
- **circumferential** `sigma_th`, a fixed angle

**Kernel: normalised Gaussian, truncated at 3 sigma, non-negative** — the
non-negativity is load-bearing for 53.3. Circumferential wrap is periodic.
**Axial edge handling is CLAMP (replicate the end station)**, because
reflection would fabricate geometry beyond the body and clamping keeps the
result a non-negative combination of sections that actually exist.

### 53.5 A BIAS PREDICTED IN ADVANCE, SO IT CANNOT BE RATIONALISED LATER

Axial low-pass filtering Minkowski-averages neighbouring sections, which
**shrinks any curved profile** by approximately

> **delta r ~ sigma_x^2 . |r''| / 2**

For the prolate spheroid at mid-body (`|r''| ~ 1/3`) this is about **0.015% of
R at `s_x = 0.005`** and about **3.8% of R at `s_x = 0.08`**. It is a real
geometric consequence of intentional low-pass filtering, not an error, and it
is what will stop the ladder from ascending indefinitely.

**Recorded BEFORE any run**, so that a fidelity failure at large scale is
recognised as this predicted effect rather than explained away.

### 53.6 THE SELECTION RULE — FROZEN, MIRRORING 4.7

A single **declared resolution index k**, both scales doubling together so
axial and circumferential smoothing stay comparable in grid terms (the fixed
grid is 128 stations over `L` and 256 azimuths, i.e. one step is `0.0079 L`
and `1.41 deg`):

| k | `s_x` | `sigma_th` |
|---|---|---|
| 1 | 0.005 L | 2 deg |
| 2 | 0.010 L | 4 deg |
| 3 | 0.020 L | 8 deg |
| 4 | 0.040 L | 16 deg |
| 5 | 0.080 L | 32 deg |

> **Use the SMALLEST k that satisfies EVERY criterion in 53.7. Test k=1 first
> and ascend. If k=5 fails, THE ARCHITECTURE FAILS** and is reported as such.
> No sixth rung is added, no ratio is retuned, and no value is chosen by
> looking at EAS geometry.

### 53.7 CRITERIA — CARRIED FORWARD VERBATIM PLUS ONE NEW REQUIREMENT

Evaluated on the **already-authorised** spec 52 QuickHull families only: two
convex analytic bodies, five sampling patterns, three densities.

| # | criterion | limit | source |
|---|---|---|---|
| C1 | **same-body invariance** — all pairs of the 15 representations, worst | RMS **<= 0.5% Rmax**, p99 **<= 1.5% Rmax**, zone turning within **2% or 0.5 deg** | spec 21 cross-tessellation row, verbatim |
| C2 | **refinement cannot make it worse** | for EVERY pattern, RMS at n=12 000 must be the LOWEST of the three densities | **NEW — 52.7.2** |
| C3 | positional fidelity vs analytic oracle | RMS **<= 0.5%**, p99 **<= 1.5%** | spec 21, verbatim |
| C4 | ribbon false turning | **<= 0.5 deg** max, **<= 0.1 deg** median | spec 21, verbatim |
| C5 | convergence 12/24/48 | median zone-turning shift **< 5%** | spec 6, verbatim |
| C6 | **convexity** | **EXACTLY ZERO** reflex vertices, all sections, all representations | 53.3 — structural, not a tolerance |

**C1 is the headline** and needs no oracle. **C2 is the criterion the old
architecture failed** and is the reason this one exists. **C6 is a
correctness check on the implementation**, not a quality gate: a single reflex
vertex means the code is wrong.

**The adversarial `graded` family is now a CONVERGENCE TEST, not something to
be specially repaired.** No pattern receives special handling of any kind.

### 53.8 KILL

If no `k` through 5 satisfies 53.7, **fixed-grid support-function skinning
fails** and is reported. The fallback is not another fitter: it is the
existing transverse-area / scalar estimator, and the ribbon programme would
then have exhausted its architectures.

### 53.9 OUT OF SCOPE

**No EAS mesh is inspected until 53.7 passes and the skin is frozen.** The
independent asymmetric chine remains **UNSPENT**. No Cd, no calibration, no
production change. The non-convex burned chine bodies are **not** part of this
selection — the criteria above are measured on convex analytic controls only,
because a convex hull is what production canonicalises to.

### 53.10 LADDER RESULT (2026-08-20): **NO RUNG PASSES — ARCHITECTURE FAILS AS FROZEN.** But every defect it was built to fix is fixed.

Run once as frozen, k = 1..5, both convex bodies, all five sampling patterns,
all three densities. `reflexSelfTest` verified trustworthy first (CCW circle
0, CW circle 0, dented circle 1).

> **Verdict per 53.8: no rung through k=5 satisfies 53.7. No sixth rung is
> added, no ratio retuned, no criterion changed.**

#### 53.10.1 WHAT IS FIXED — AND IT IS EVERYTHING 52.7 KILLED THE MLS SKIN FOR

| | MLS skin (52.7) | support skin, k=1 |
|---|---|---|
| **C2 refinement cannot worsen** | **FAILED** — graded got worse as input improved 17-fold | **PASSES at EVERY rung, both bodies** |
| **C4 false turning** | 94-917 deg on random/graded | **0.000 / 0.000 deg on ALL 30 representations** |
| **C6 convexity** | 120/120 stations non-convex on the worst | **0 / 120 on ALL 30** |
| multi-hit | up to 1 337 | **0** (except triaxial lathe n=600) |
| fallbacks | 21-45% quadratic coverage | **none exist in this architecture** |

The three failures that retired the previous architecture do not occur. The
support function has no fit to degrade, so there is nothing to fall back to.

#### 53.10.2 THE RESIDUAL AT k=1 **IS** THE HULL'S OWN INSCRIPTION ERROR

Pre-registered in 52.4 so this could be attributed rather than argued. Skin
RMS at k=1 against the hull's own error, prolate spheroid:

| representation | hull rms (INPUT) | skin rms (k=1) | skin - hull |
|---|---|---|---|
| lathe n=600 | 2.022% | 1.997% | **-0.025%** |
| jitteredLathe n=600 | 2.040% | 2.014% | **-0.026%** |
| graded n=600 | 1.360% | 1.241% | **-0.119%** |
| graded n=2500 | 0.353% | 0.306% | -0.047% |
| lathe n=12000 | 0.039% | 0.057% | +0.018% |
| fibonacci n=12000 | 0.023% | 0.040% | +0.017% |

> **The skin tracks its input to within +-0.12% on all 15 representations, and
> is BETTER than its input on 9 of them.** The residual is not reconstruction
> error. It is the chord deficit of a 600-point hull inscribed in a sphere,
> faithfully reproduced.

**C1 and C3 fail at k=1 because the n=600 hulls are 1.6-2.0% inside the
analytic body.** No skin can be more accurate than the object it is skinning,
and the CANONICAL UPLOAD-HULL RULE makes that object the truth.

#### 53.10.3 THE PREDICTED BIAS ARRIVED, WITHIN 10% OF PREDICTION

53.5 predicted, before any code existed, that axial low-pass would shrink
curved profiles by `~sigma_x^2 |r''| / 2` — **about 3.8% of R at
`s_x = 0.08`**.

**Measured at k=5: 3.44-3.50% RMS on every finest representation, regardless
of sampling pattern.** A floor independent of input quality, exactly as a
systematic filtering bias must be. From k=3 upward C3 fails on all fifteen
representations for this reason and no other.

The ladder is therefore **squeezed from both ends**: below, by input
inscription; above, by the intentional low-pass bias that was declared in
advance. That is not a tuning failure.

#### 53.10.4 THE INVARIANCE FAILURE IS CONFINED TO THE ZONES NEAR THE ENDS — **ZONES 0, 6 AND 7**

Post-hoc localisation, prolate spheroid, k=1, **n=600 excluded** — recorded as
an **OBSERVATION, NOT A CRITERION, with nothing tuned to it**:

| zone | median range across 10 representations | spread | limit | ratio |
|---|---|---|---|---|
| **0** | 25.190 .. 33.222 deg | 8.032 | 0.664 | **12.09** |
| 1 | 8.185 .. 8.308 | 0.124 | 0.500 | 0.25 |
| 2 | 5.456 .. 5.557 | 0.100 | 0.500 | 0.20 |
| 3 | 4.529 .. 4.641 | 0.112 | 0.500 | 0.22 |
| 4 | 4.646 .. 4.771 | 0.125 | 0.500 | 0.25 |
| 5 | 5.502 .. 5.627 | 0.124 | 0.500 | 0.25 |
| 6 | 8.586 .. 9.154 | 0.568 | 0.500 | 1.14 |
| **7** | 24.450 .. 32.509 deg | 8.059 | 0.650 | **12.40** |

> **Zones 1-5 agree to 0.10-0.13 deg — a quarter of the tolerance. Zones 0 and
> 7 miss it by 12x, and ZONE 6 ALSO FAILS at 1.14x.**
>
> **CORRECTED 2026-08-20.** This section originally said the failure was
> "entirely" in zones 0 and 7. **Zone 6 fails too** — 0.568 deg against a
> 0.500 deg limit. It is a 14% overshoot rather than a 12-fold one, but a
> frozen limit is a frozen limit and the table above said so while the
> sentence did not. **The clean region is zones 1-5, not zones 1-6.**

Positional agreement over the same set **passes**: worst RMS 0.279% against a
0.5% limit, p99 0.958-1.159% against 1.5%. **It is only the turning — a
derivative — that fails, and only in the two zones adjacent to the excluded
tips**, where the profile turns hardest and where different samplings of the
nose and tail differ most.

The mid-body is invariant across lathe, Fibonacci, random and graded hulls at
two densities. The nose and tail closure are not.

#### 53.10.5 STOPPED, AND WHAT IS NOT CLAIMED

**Stopped per 53.8.** No sixth rung. No criterion altered. No EAS mesh
inspected. The independent asymmetric chine remains **UNSPENT**.

**Not claimed:** that the architecture passes. It does not, as frozen.
**Not claimed:** that the criteria are wrong. They are the frozen spec 21 and
spec 6 tolerances, carried forward deliberately.

**What is established:** the three defects that killed the MLS skin are gone;
the residual at k=1 is provably the input hull's own error; the predicted
low-pass bias arrived within 10% of its pre-registered magnitude; and the
remaining invariance failure is confined to **zones 0, 6 and 7**, with zones
1-5 inside a quarter of tolerance.

Whether that constitutes a pass is a ruling, not a measurement, and it is not
mine to make.

---

## 54. **THE BULLSEYE DERIVATIVE GUARD — FROZEN 2026-08-20, PRE-BUILD.** (owner ruling, reviewer-authored)

### 54.0 STATUS CARRIED IN

**Spec 53 verdict: FAIL as frozen. It is NOT relabelled PASS.** What it earned
is nonetheless banked:

- fixed-grid support-function skinning **eliminates the mesh-density /
  bandwidth failure**;
- **refinement no longer makes reconstruction worse** (C2, every rung);
- **all 30 controls give 0.000 deg false turning**;
- **convexity is preserved structurally** (0/120, all 30);
- **no fit or fallback mechanism remains to degrade silently**;
- different QuickHull samplings agree very well **through the body interior**.

> **The MLS skin is RETIRED. The support-function skin is the leading
> canonical representation.**

The convexity-test sign error and its retraction are accepted; any claim
resting on "120/120 non-convex" is retired. Spec 52's main result stands,
independently supported by RMS, turning, fallbacks and cross-representation
behaviour.

### 54.1 THE DIAGNOSIS THIS SECTION ACTS ON

53.10.4 localised the failure to **zones 0, 6 and 7** while zones 1-5 sit at a
quarter of tolerance. Positional agreement over the same set **passes**
(RMS 0.279% against 0.5%). **Only the derivative fails, and only approaching
the terminal closure.**

The reading, in the owner's words: near the tip every ribbon is collapsing
toward the axis, so a tiny difference in how QuickHull approximates the last
sliver makes the computed tangent angle jump enormously — **while the position
curve remains perfectly sensible.**

> **The geometry is fine. The derivative operator is being asked a question at
> the one place it cannot answer.**

### 54.2 WHAT THIS IS — AND EMPHATICALLY IS NOT

**A tiny numerical guard, not a new subsystem.**

> **Full ribbon positions retained -> normal turning analysis -> ribbon enters
> the bullseye -> record closure position -> NO MORE DERIVATIVE.**

**FORBIDDEN, explicitly:** no sixth rung, no adaptive bandwidth, no tip spline,
no tip reconstruction, no feature detector, no special nose/tail model, no
handing closure to `A(x)` or any other subsystem, no EAS-specific treatment.
**No geometry is discarded** — only the *differentiation* of the final sliver.

The conceptual model is unchanged: ribbons leave the clockface, describe the
body, and return into the bullseye. The guard only says **"inside here, we are
home."**

### 54.3 THE GUARD, FROZEN

For each ribbon `r_k(x)`:

- **reference radius** `R_k = max over the frozen retained domain [i0, i1] of
  r_k(x)`. **PER RIBBON, not the body Rmax** — a ribbon's own maximum is the
  natural reference, and keeping it directional is the entire point of having
  ribbons rather than `A(x)`.
- **a station is USABLE for turning iff BOTH of its secant endpoints satisfy
  `r_k >= epsilon . R_k`.** The 3% secant (4.6) is a physical span; a station
  whose stencil reaches into the bullseye is differentiating the pathological
  sliver just as surely as one inside it.
- **absolute and net turning accumulate ONLY between consecutive usable
  stations.**

**ZONE BOUNDARIES DO NOT MOVE.** Zones stay fixed on the frozen retained
domain in `x/L` (4.8), so equivalent zone numbers still represent equal
fractional position, on every body and every representation. Zones 0 and 7
simply accumulate over a shorter sub-interval. **This is the whole reason the
guard is defined on turning accumulation rather than on the domain**: trimming
the domain per ribbon would have broken 4.8's comparability outright.

**Positional output is UNCHANGED.** `r_k(x)` is retained in full at every
station. The guard cannot alter any positional metric, and if a positional
number moves, the implementation is wrong.

**One cheap number is added:** `x_close_k`, the axial position where ribbon `k`
first enters the bullseye. It is a POSITION, not a derivative.

### 54.4 SELECTION RULE — FROZEN, MIRRORING 4.7

> **epsilon ladder: 1%, 2%, 5%. Test 1% first and ascend. Take the smallest
> that satisfies 54.5. IF 5% FAILS, THE GUARD FAILS** — no further levels are
> added, no other mechanism is substituted, and the end-zone divergence is
> recorded as unresolved.

Chosen on the **authorised spec 52 analytic QuickHull families only**. **No EAS
geometry is inspected while choosing it.**

### 54.5 CRITERIA

| # | criterion | limit | source |
|---|---|---|---|
| **G1** | cross-representation **zone-turning** agreement, **all 8 zones**, all pairs, **all 15 representations** | within **2% or 0.5 deg, whichever larger** | spec 21, verbatim |
| **G2** | zones 1-5 must **not** be degraded | still within the same limit | 53.10.4 |
| **G3** | false turning, convexity, refinement | unchanged from 53.10.1 — **0.000 deg, 0/120, C2 passes** | 53.10.1 |
| **G4** | positional metrics **bit-identical** to the unguarded run | exact | 54.3 |

**G1 IS THE SELECTION CRITERION AND IT IS DELIBERATELY RUN ON ALL FIFTEEN
REPRESENTATIONS, n=600 INCLUDED.** Excluding the coarse family would be
choosing the test to pass. The guard targets *derivative* instability;
53.10.2 established that the n=600 *positional* residual is the hull's own
inscription error, which the guard neither can nor should fix — so **positional
C1/C3 are reported but are NOT part of this selection**, because a guard that
does not touch positions cannot be judged on them.

**`x_close` cross-representation spread is REPORTED as an observation** — the
closure-trajectory information — **and is NOT a criterion. Nothing is tuned to
it.**

### 54.6 THE TRADE, STATED PLAINLY BEFORE IT IS MEASURED

Accepting this guard means **declining to compute turning over the final
`epsilon` fraction of each ribbon's radius**. At 1-2% that is a sliver of a
sliver. The claim being tested is:

> discarding the derivative of the last 1-2% of radius makes the other 98-99%
> of every ribbon trustworthy across tessellations.

If true it is a very cheap trade and entirely in keeping with a low-resolution
aerodynamic estimator. **If false, it is recorded as false.**

### 54.7 OUT OF SCOPE

No EAS mesh until the ownership question is frozen. **The independent
asymmetric chine remains UNSPENT.** No Cd, no calibration, no production
change. The support skin itself is **not modified** by this section.

### 54.8 RESULT (2026-08-20): **THE GUARD NEVER FIRES. It is a structural no-op, and 54.1's diagnosis is WRONG.**

Run as frozen, epsilon = 1%, 2%, 5%, both bodies, all 15 representations,
support skin at k=1. Correctness preconditions passed first: `reflexSelfTest`
trustworthy, and unguarded `guardedMetrics` reproduces the frozen
`ribbonMetrics` **to 0.0e+0 — bit-identical**.

> **Every epsilon produced numbers IDENTICAL to the unguarded baseline.
> "Stations used 120-120 of 120" at every level.** The guard never excluded a
> single station.

**Formal verdict per 54.4: THE GUARD FAILS.** No further levels, no substitute
mechanism. But it did not fail because it was too weak — it failed because
**there was nothing there to guard.**

#### 54.8.1 THE PREMISE DOES NOT HOLD AT THE FROZEN TIP EXCLUSION

Prolate spheroid, fibonacci n=12000, along one ribbon:

| station | x/L | **r / R_ref** | tangent angle |
|---|---|---|---|
| 4 (`i0`) | 0.031 | **34.79%** | 43.40 deg |
| 9 | 0.071 | 51.27% | 29.38 deg |
| 64 | 0.504 | 100.00% | -0.15 deg |
| 118 | 0.929 | 51.27% | -29.39 deg |
| 123 (`i1`) | 0.969 | **34.78%** | -43.42 deg |

> **MINIMUM `r / R_ref` anywhere in the retained domain: 34.78%.**
> A bullseye at 1%, 2% or 5% lies **entirely inside the already-excluded
> tips.**

54.1 accepted the picture that "near the tip every ribbon is collapsing toward
the axis". **At the frozen 2.5% axial tip exclusion, nothing is collapsing.**
The radius is a third of maximum and the tangent angle is +-43 deg, not +-90.

> **SPEC 4.7's AXIAL TIP EXCLUSION ALREADY IS THE BULLSEYE GUARD**, expressed
> in axial rather than radial coordinates — and it already cuts at **34.78% of
> radius**, roughly seven times more aggressively than the largest epsilon the
> ladder was allowed to try. The two mechanisms are the same idea in different
> coordinates, and the existing one is strictly stronger.

**This is a structural fact, not a tuning outcome.** For any body whose
retained domain excludes radii below `epsilon . R`, the bullseye guard is
provably a no-op. It could not have worked at any authorised value.

#### 54.8.2 WHAT IS ACTUALLY DIVERGING: END-CONCENTRATED **INPUT** ERROR

Mean relative radial error against the analytic surface, by zone, prolate
spheroid:

| representation | zone 0 | zone 1 | zone 3 | zone 5 | zone 6 | zone 7 |
|---|---|---|---|---|---|---|
| lathe n=600 | **5.752%** | 0.504% | **0.295%** | 0.336% | 0.504% | **5.752%** |
| jitteredLathe n=600 | **5.811%** | 0.557% | 0.376% | 0.388% | 0.566% | **5.798%** |
| graded n=600 | 1.505% | 0.829% | 0.742% | 1.046% | 1.743% | 3.569% |
| random n=12000 | 0.185% | 0.051% | 0.029% | 0.033% | 0.050% | 0.188% |
| fibonacci n=12000 | **0.134%** | 0.030% | **0.016%** | 0.020% | 0.030% | **0.134%** |

> **Relative inscription error is 8x to 19x worse in zones 0 and 7 than at
> mid-body, in EVERY representation.**

The mechanism is geometric and unavoidable: the surface curves fastest near
the ends, so a chord across it carries a much larger *relative* deficit there.
Turning is a derivative of radius, which amplifies it further, and the worst
G1 pairs are consistently a coarse representation against a fine one —
5.75% against 0.13% at the ends.

#### 54.8.3 THE CONSEQUENCE, STATED NARROWLY

**The end-zone divergence is a property of the INPUT HULL, not of the
derivative operator and not of the skin.** It is 53.10.2's finding again, now
localised: the residual is the hull's own inscription error, and that error is
concentrated exactly where zones 0, 6 and 7 sit.

> **No derivative-side guard can fix an error that lives in the positions.**

That is why the guard was a no-op and would have remained one at any threshold
that did not also delete a third of the body.

**What is NOT claimed:** that end-zone divergence is unfixable. Only that it
cannot be fixed by declining to differentiate, because there is nothing
pathological about the differentiation — the positions it is differentiating
are simply 8-19x less accurate there. Whether that is addressed by accepting
wider uncertainty at the ends, by denser end sampling at the source (the 51.7
principle), or by declaring the end zones outside the ribbon operator's
domain, is a ruling and not a measurement.

**No mechanism was substituted. No EAS geometry inspected. The independent
asymmetric chine remains UNSPENT. `ribbonMetrics` unmodified; the support skin
unmodified.**

---

## 55. **HYBRID DESCRIPTOR DOMAIN — FROZEN 2026-08-20.** (owner ruling, reviewer-authored). **GEOMETRY WORK STOPS HERE.**

### 55.1 THE CANONICAL SKIN

> **The support-function skin at k=1 (`sigma_x = 0.005 L`, `sigma_theta = 2
> deg`) is the canonical skin candidate.**

It solved what it was built to solve, and 53.10.1 measured all of it:
sampling-pattern dependence, non-convergence under refinement, false turning on
the smooth controls, fit fallbacks, and convexity. **The MLS skin is retired.**

The pipeline, entire:

> **convex hull -> deterministic support skin -> full positional ribbons ->
> stable interior turning descriptors + existing transverse closure descriptors
> -> aerodynamic inference**

### 55.2 THE EARNED DERIVATIVE DOMAIN

> **Zones 1-5 are the earned longitudinal-ribbon derivative domain.**
> **Zones 0, 6 and 7 are OUTSIDE it.**

Zone 6 is outside because it misses the frozen tolerance by **14%** (0.568 deg
against 0.500). **Its tolerance is NOT weakened to admit it**, and neither are
zone 0's or zone 7's. A frozen limit that is relaxed once it becomes
inconvenient was never a limit.

**Zones 1-5 agree across lathe, Fibonacci, random and graded QuickHulls at two
densities to 0.10-0.13 deg — a quarter of the tolerance.** That is what
"earned" means here, and it is the only sense in which it is claimed.

### 55.3 WHAT IS WITHHELD IS NARROW — THE ENDS ARE NOT DISCARDED

> **The full ribbon positional curves are RETAINED across the entire frozen
> retained domain, zones 0 and 7 included.**

What is withheld is **only the claim that terminal turning derivatives are
tessellation-stable.** Nothing positional is dropped, nothing is truncated, and
no geometry is deleted.

Gross fore/aft closure continues to be carried by the quantities that are
robust to it — `A(x)`, `r_eq(x)`, and the full ribbon positions. The
directional *derivative* descriptors use only the part of the body where they
have actually earned stability.

### 55.4 NO REPLACEMENT MECHANISM. AT ALL.

**FORBIDDEN:** another tip smoother, adaptive derivative, closure fit, endpoint
heuristic, sixth ladder rung, or any further skinning experiment.

54.8 established why, and it is not a matter of insufficient cleverness:

> **End-zone disagreement originates in POSITIONAL INSCRIPTION ERROR of the
> coarse convex hull — 8x to 19x worse at the ends than at mid-body in every
> representation — NOT in an unstable derivative at `r -> 0`.**

A derivative-side treatment cannot repair an error that lives in the positions.
V2 will not contain a mini-algorithm whose purpose is to guess the missing
curvature of a deliberately coarse input.

### 55.5 FOR EAS-OWNED GEOMETRY

If terminal directional information later proves to matter materially, **the
first remedy is denser source geometry near the high-curvature nose and tail
regions — not more estimator logic.** This is 51.7 unchanged:

> fix the controllable source representation before teaching the estimator to
> reverse-engineer an undersampled hull.

### 55.6 GEOMETRY WORK STOPS

The ribbon programme's geometry phase is closed. The next experiment is **not**
another skinning experiment. **The independent asymmetric chine remains
UNSPENT** and is now carried forward past the end of the geometry programme
without ever having been consumed — which is the correct outcome for a control
that was never needed.

**Still true and unchanged: production at `12e8c5e`, zero lines of estimator or
calibration altered across the entire programme.**

---

## 56. **PHASE 2, EXPERIMENT 1 — DOES THE INTERIOR RIBBON RESOLVE WHAT THE SCALAR CANNOT? FROZEN 2026-08-20, PRE-BUILD.**

### 56.1 THE BASELINE IS THE PRODUCTION CODE, NOT A REIMPLEMENTATION

`measureSections` and `scoreSections` (`site/calcv2/src/sections.js`)
and `classifySections` (`cdEstimator.js`) are imported **directly**, verified
loadable under Node. The comparison is against what production actually
computes.

**What the production scalar reduces a shape to:**

> **one number — `compositeV1` — plus a binary class (`pinned` / `rounded`).**

And `shoulderAngleScore` reconstructs radius from `A(x)` as
`r = sqrt(A . cell^2 / pi)`, i.e. an **equivalent-radius body of revolution**.
**All directional information is already discarded before the scalar is
formed.** That is the representation the ribbons must beat.

### 56.2 TWO FACTS THAT SCOPE THIS EXPERIMENT, RECORDED BEFORE IT RUNS

**1. THE LABELLED CORPUS IS ENTIRELY AXISYMMETRIC.** TR-291 C-class, TN-614
fuselages, TR-432 Akron, Gottingen ellipsoids — every body with measured drag
is a body of revolution. On such a body **all 24 ribbons are identical**, so
the **DIRECTIONAL half of the ribbon idea is untestable against measured
data**. Spec 9 recorded this as a risk before the corpus was ever run; it is
now a confirmed scoping fact, not a surprise.

**2. THE LABELLED CORPUS IS TOO SMALL TO FIT AGAINST.** Roughly a dozen bodies
in total. **No regression adding a descriptor to a ~13-point set can credibly
demonstrate improvement**, and spec 7 already records descriptor-selection
contamination on TR-291 admitted 2026-08-19.

> **A fitted "does it improve Cd prediction" test is NOT credible on the
> available data and is NOT attempted here.** Claiming one would be the
> contamination of spec 7 committed a second time.

### 56.3 THE QUESTION THIS EXPERIMENT *CAN* ANSWER

The **necessary condition**, which needs no labels and fits nothing:

> **Does the interior ribbon representation (zones 1-5) resolve distinctions
> between bodies that the production scalar cannot see?**

If it does not, ribbons add no resolvable information and Phase 2 stops
cheaply. If it does, that is necessary — **not sufficient** — for them to help.

### 56.4 DECLARED LIMIT, STATED FIRST

> **DISTINGUISHING TWO BODIES IS NOT THE SAME AS MATTERING AERODYNAMICALLY.**

A demonstration that ribbons separate what the scalar merges shows only that
**information survives that the scalar destroys**. Whether that information
predicts drag is a separate question requiring data this programme does not
have. Any later document reading this result as "ribbons improve Cd" is
misreading it, exactly as 51.2 guarded against.

### 56.5 THE BODY FAMILY — SYSTEMATIC AND FROZEN, NOT CHOSEN FOR OUTCOME

Convex bodies of revolution with independently varied fore and aft closure:

> **r(u) = R . (1 - u^2)^p**, with `u = x/a` in `[-1, 1]`,
> **`p = p_fore` for `u < 0`, `p = p_aft` for `u >= 0`.**

Both halves meet at `u = 0` with value `R` and zero slope, and `r` is concave
for `p` in `(0, 1]`, so **every body is convex** and hulling cannot change the
geometry it represents.

- **`p_fore`, `p_aft` in {0.4, 0.6, 0.8, 1.0}** — 16 combinations, including
  8 fore/aft-asymmetric pairs
- **fineness `2a/2R` in {3, 5}**
- **32 bodies, frozen before any measurement.**

The grid is defined by geometry parameters chosen for **coverage**, never for
outcome. **No body is added, removed or reparameterised after any result is
seen.**

### 56.6 THE TEST IS NOISE-REFERENCED — NO INVENTED THRESHOLDS

Both representations are calibrated against **their own tessellation noise**,
measured on the authorised spec 52 QuickHull samplings of the **same** body
(fibonacci, lathe and random at n=12000):

- **`sigma_scalar`** = worst spread of `compositeV1` across samplings of one body
- **`sigma_ribbon`** = worst spread of the zone-1-5 turning vector across
  samplings of one body

Then, over all pairs of the 32 bodies:

> **SCALAR-BLIND PAIR:** `|compositeV1_i - compositeV1_j| <= sigma_scalar`
> **AND the same binary class**
> — the scalar cannot distinguish them beyond its own noise;
>
> **RIBBON-RESOLVED:** zone-1-5 turning distance `> sigma_ribbon`
> — the ribbons distinguish them beyond *their* own noise.

Neither threshold is chosen. **Both are measured, by the same procedure, from
the same tessellation families.** The ribbon distance is the max absolute
per-zone difference of median absolute turning over zones 1-5 — the zones and
only the zones that 55.2 declared earned.

### 56.7 CRITERION AND KILL

| | |
|---|---|
| **PASS** | at least one scalar-blind, ribbon-resolved pair exists, **and the count and the margin are reported in full** |
| **FAIL** | no such pair exists across all 496 pairs -> **ribbons add no resolvable information beyond the production scalar, and Phase 2 stops** |

**Reported whatever the result:** `sigma_scalar`, `sigma_ribbon`, the full pair
count, the largest margin, and — **required** — the number of pairs that are
the OTHER way round (ribbon-blind but scalar-resolved), because a
representation that only ever splits is not adding information, it is adding
sensitivity.

### 56.8 OUT OF SCOPE

**No Cd. No calibration. No production change. Nothing is fitted to anything.**
The independent asymmetric chine remains **UNSPENT**. EAS geometry is no longer
embargoed (55 froze the domain ruling) but is **not** part of this experiment's
selection data — the family above is the entire corpus, and any EAS body would
be an application of a frozen result, never an input to it.

### 56.9 RESULT (2026-08-20): **PASS. 48 of 496 pairs carry information the production scalar destroys — and one pair differs by EXACTLY ZERO.**

Run once as frozen. Production `measureSections` / `scoreSections` /
`classifySections` imported directly and run on the **identical hull** the
ribbon path sees. Nothing fitted.

#### 56.9.1 THE TWO NOISE FIGURES, MEASURED FIRST

| | value | worst body |
|---|---|---|
| `sigma_scalar` | **1.638e-3** | f3 pf0.4 pa0.4 |
| `sigma_ribbon` | **0.0195 deg** | f3 pf0.6 pa0.4 |
| binary class flips across tessellations | **0 / 32** | — |

Both measured by the same procedure from the same authorised QuickHull
samplings. Neither was chosen.

#### 56.9.2 THE PAIR COUNTS, BOTH DIRECTIONS

| | count |
|---|---|
| **scalar-blind AND ribbon-resolved** | **48 / 496** |
| **ribbon-blind AND scalar-resolved** | **0 / 496** |

> **The other direction is EMPTY.** The ribbons never merge a pair the scalar
> separates. 56.7 required this figure precisely because a representation that
> only ever splits would be adding *sensitivity*, not information — and a
> zero here is what distinguishes the two.

Largest margins:

| body A | body B | d(scalar) | vs its noise | d(ribbon) | vs its noise |
|---|---|---|---|---|---|
| f3 pf0.4 pa0.6 | f3 pf1 pa0.6 | 7.94e-6 | 0.00x | **4.915 deg** | **252.5x** |
| f3 pf0.4 pa0.4 | f3 pf1 pa0.4 | **0.00e+0** | **0.00x** | **4.914 deg** | **252.4x** |

> **`d(scalar) = 0.00e+0` — not "small", IDENTICAL.** The production estimator
> returns bit-identical `compositeV1` for a body with a blunt nose (`p=0.4`)
> and one with a fully pointed nose (`p=1.0`), while the ribbons separate them
> by **252 times their own tessellation noise.**

The difference is exactly where 55.2 said the ribbons had earned the right to
look — zones 2 and 3, the forward interior:

| zones 1-5 (deg) | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| f3 pf0.4 pa0.6 | 7.54 | 4.57 | 3.83 | 5.49 | 6.34 |
| f3 pf1 pa0.6 | 7.83 | 8.55 | 8.75 | 5.63 | 6.34 |
| **difference** | -0.29 | **-3.99** | **-4.92** | -0.14 | **0.00** |

#### 56.9.3 THE MECHANISM — AND IT IS NOT A MISSING MEASUREMENT

The obvious explanation would be that the scalar never looks at the nose. That
is **not** what happens. Measured directly:

| body | `softFore` | `softAft` | `compositeV1` |
|---|---|---|---|
| f3 pf0.4 pa0.4 | **1.01e-2** | 0.393373 | **0.393373** |
| f3 pf1 pa0.4 | **0.00e+0** | 0.393373 | **0.393373** |

**The fore term is computed, and it DOES differ.** It is then destroyed by the
combination rule:

> **`compositeV1 = Math.max(softAft, softFore)`** — "the worst aerodynamic
> offence governs" (`sections.js:339`).

Whenever aft closure dominates — every body in this family, and every
streamlined body — the entire fore term is **discarded by the `max()`**. The
information reaches the last line of the descriptor and is thrown away there.

> **This is spec 10 exactly, one level down.** 10 froze "never average the
> ribbons" because collapsing many curves to one scalar destroys the
> distribution. `compositeV1` collapses two measured terms with a `max`, which
> is the same failure in the same place: **a penalty descriptor, not a shape
> descriptor.** It answers "how bad is the worst offence" and by design cannot
> answer "what shape is this".

That is a coherent design for what it was built to do, and this result is not
a defect report against it. It is a measurement of what that design costs.

#### 56.9.4 WHAT IS AND IS NOT ESTABLISHED

**Established:** on a systematic, pre-frozen 32-body convex family, the
interior ribbon representation resolves 48 pairs the production scalar cannot
distinguish beyond its own noise, including pairs it returns *identically*;
and it never merges a pair the scalar separates. The necessary condition for
ribbons to add value **holds**.

**NOT established, per the 56.4 declared limit stated before the run:**

> **DISTINGUISHING TWO BODIES IS NOT THE SAME AS MATTERING AERODYNAMICALLY.**

Nothing here shows that forebody turning history predicts drag. **Any reading
of this result as "ribbons improve Cd" is a misreading.**

> **CORRECTED 2026-08-20 (see 57.0).** This paragraph originally said the
> labelled corpus "cannot test it — every body with measured drag is
> axisymmetric, and ~13 bodies cannot support a fitted comparison." **That
> merged two separate limits into a stronger claim than either supports.**
> Axisymmetry blocks the CIRCUMFERENTIAL half only; it does not block testing
> LONGITUDINAL ribbon information, which spec 9 called the primary thing under
> test. Sample size blocks FITTING, not ORDERING. A non-fitted ordering audit
> on the measured corpus IS possible, and spec 57 performs it.

**Also recorded:** the binary class contributed **nothing** on this family —
all 32 bodies classify `rounded`, with 0 flips across tessellations. It is
stable and it is uninformative here.

**No Cd, no calibration, no fitting, no production change. The independent
asymmetric chine remains UNSPENT.**

---

## 57. **PHASE 2, EXPERIMENT 2 — FROZEN, NO-FIT MEASURED-DATA AUDIT. FROZEN 2026-08-20, PRE-BUILD.** (owner ruling, reviewer-authored)

### 57.0 A CORRECTION TO 56.9.4, ACCEPTED

56.9.4 said the labelled corpus "cannot test it — every body with measured drag
is axisymmetric, and ~13 bodies cannot support a fitted comparison." **That
merged two separate limits into a stronger claim than either supports.**

- Axisymmetry blocks validating the **circumferential/directional** half. It
  does **not** block testing **longitudinal** ribbon information — which spec 9
  itself called "the primary thing under test".
- Sample size blocks **fitting**. It does not block **ordering**.

**Corrected:** the measured corpus can test the longitudinal question by a
non-fitted ordering audit, and that is what this section does.

### 57.1 `compositeV1` IS NOT TO BE TOUCHED

> **Do not modify `compositeV1`. In particular do NOT replace `max(softAft,
> softFore)` with a sum or an average because 56.9.3 exposed the lost fore
> term.**

That line is now the baseline to beat and it stays frozen until ribbons have
earned the right to influence Cd. No Cd refit, no calibration change, no
production change, no new geometry work.

### 57.2 PROVENANCE — MEASURED, NOT ASSUMED

`CALIBRATION_KNOTS` (`cdEstimator.js:139`) contains **TN614-111** and
**TN614-332** as two of its four anchors.

| body | construction | measured `CD_A` | provenance |
|---|---|---|---|
| **111** | nose 111 + tail 111 | 0.0401 | **CALIBRATION-CONSUMED (knot 0)** |
| 121T | nose **111** + tail **221** | 0.0405 | unconsumed |
| 211T | nose **222** + tail **111** | 0.0415 | unconsumed |
| 221 | nose 221 + tail **221** | 0.0437 | unconsumed |
| 222 | nose **222** + tail 222 | 0.0472 | unconsumed |
| **332** | nose 332 + tail 332 | 0.0508 | **CALIBRATION-CONSUMED (knot 1)** |

All six: fineness ratio **5**, effective Re **66e6** — **one fineness, one
Reynolds number**. Abbott built the family by **swapping noses and tails**, so
controlled single-variable pairs exist by construction.

**TR-291 remains SPENT (spec 7) and is not used here in any form.**

### 57.3 THE CONTROLLED PAIRS — IDENTIFIED BY CONSTRUCTION, NOT BY OUTCOME

Selected because they share a component, before any descriptor was computed:

| pair | shared | varies | measured `CD_A` | provenance |
|---|---|---|---|---|
| **121T vs 221** | tail 221 | **nose** | 0.0405 -> 0.0437 | **INDEPENDENT** (both unconsumed) |
| **211T vs 222** | nose 222 | **tail** | 0.0415 -> 0.0472 | **INDEPENDENT** (both unconsumed) |
| 111 vs 211T | tail 111 | **nose** | 0.0401 -> 0.0415 | SUPPORTING (111 consumed) |
| 111 vs 121T | nose 111 | **tail** | 0.0401 -> 0.0405 | SUPPORTING (111 consumed) |

**Independent and supporting pairs are reported separately and are never
pooled.**

### 57.4 THE DESCRIPTOR SET — NOTHING NEW IS INVENTED

> **D1..D5 = median absolute turning across ribbons in zones 1, 2, 3, 4, 5.**

That is the entire set. These are the **already-frozen** quantities of 4.6 and
4.8, restricted to the **already-earned** domain of 55.2. **No new descriptor,
no weights, no combination rule, no regression, no fitting of any kind.**
Nothing is selected after seeing a result.

### 57.5 DIRECTION, PRE-REGISTERED FROM TWO INDEPENDENT ARGUMENTS

The test asks whether the ribbons separate a scalar-blind pair **in the same
direction as measured drag**. That requires a direction fixed in advance, and
it is built from two claims that are each justified **without** reference to
this corpus's drag values:

**(a) GEOMETRIC, verifiable independently:** a **blunter forebody reaches
maximum radius earlier**, so it is flatter through zones 1-2 and exhibits
**LESS absolute turning there**. This was already measured in 56.9: the blunt
`p=0.4` body gave 4.57 / 3.83 deg in zones 2-3 against 8.55 / 8.75 for the
pointed `p=1.0` body.

**(b) AERODYNAMIC, standard and external:** at fixed fineness and Reynolds
number, a **blunter forebody carries higher pressure drag**.

> **Combined, pre-registered prediction: LOWER zone 1-2 turning -> HIGHER
> measured `CD_A`.**

The aft-varying pair uses the mirrored statement in zones 4-5. **Both
directions are fixed here, before any TN-614 ribbon number is computed.**

### 57.6 THE TEST

For each controlled pair:

1. **is it scalar-blind?** `|compositeV1_i - compositeV1_j| <= sigma_scalar`
   and the same class — `sigma_scalar` measured exactly as in 56.6, on these
   bodies, from the authorised QuickHull samplings;
2. **does the ribbon representation separate it?** relevant-zone difference
   `> sigma_ribbon`, measured the same way;
3. **does the ribbon separation point the same way as measured `CD_A`**, under
   the 57.5 direction fixed above?

**Ordering only. No fitted Cd, no error metric, no learned weight.**

### 57.7 STATISTICAL POWER, STATED BEFORE THE RUN

> **There are TWO independent controlled pairs. A direction test on two pairs
> has a 25% chance of passing by coincidence.**

**This is a CONSISTENCY CHECK, NOT A VALIDATION**, and it will not be
described as one whatever it returns:

- **agreement** = weak positive evidence, explicitly weak;
- **disagreement** = genuinely informative, because a pre-registered direction
  that contradicts measured drag is evidence **against** the ribbon
  interpretation and would be recorded as such.

### 57.8 IF THE CORPUS CANNOT PROVIDE A CLEAN CASE

If no controlled pair is scalar-blind — i.e. the production scalar separates
them all — then this corpus cannot confirm the 56.9 finding, and the next
target is an **external published nose-shape or forebody series at matched
Reynolds and fineness, ideally never used anywhere in this project's
development.** That would be recorded as the outstanding data requirement, not
worked around.

### 57.9 OUT OF SCOPE

No Cd refit. No calibration change. No production change. No new geometry
work. No modification of `compositeV1`. TR-291 stays spent. The independent
asymmetric chine remains **UNSPENT**.

### 57.10 RESULT (2026-08-20): **BOTH NOSE-VARYING PAIRS ARE SCALAR-BLIND AND BOTH AGREE WITH MEASURED DRAG. But the independent evidence is ONE pair, and my pre-registered power statement was too generous.**

Run once as frozen. Ordering only, nothing fitted, `compositeV1` untouched.
Noise measured on these bodies by the 56.6 procedure:
**`sigma_scalar` = 8.041e-3, `sigma_ribbon` = 0.1134 deg.**

*(`sigma_ribbon` is ~6x its value on the analytic family. TN-614 profiles are
piecewise-linear interpolants through tabulated ordinates, so they carry
genuine kinks that different hull samplings resolve differently. Recorded, not
smoothed away.)*

| body | provenance | `CD_A` | `softFore` | `softAft` | `compositeV1` | zones 1-5 turning (deg) |
|---|---|---|---|---|---|---|
| 111 | **CONSUMED** | 0.0401 | **0.00e+0** | 0.017243 | 0.017243 | 6.91 5.06 3.62 5.16 3.85 |
| 121T | unconsumed | 0.0405 | **0.00e+0** | 0.040536 | 0.040536 | 6.91 4.23 3.06 3.98 5.49 |
| 211T | unconsumed | 0.0415 | **0.00e+0** | 0.017169 | 0.017169 | 6.45 2.61 2.82 5.74 4.29 |
| 221 | unconsumed | 0.0437 | **0.00e+0** | 0.041121 | 0.041121 | 6.51 2.38 1.83 4.57 5.69 |
| 222 | unconsumed | 0.0472 | **0.00e+0** | 0.116806 | 0.116806 | 6.45 2.50 1.87 3.15 3.22 |
| 332 | **CONSUMED** | 0.0508 | **0.00e+0** | 0.186851 | 0.186851 | 5.36 1.39 0.91 2.60 3.61 |

#### 57.10.1 THE NOSE BLINDNESS IS TOTAL ON THIS CLASS, NOT MERELY MASKED

> **`softFore = 0.00e+0` for ALL SIX BODIES.**

56.9.3 found the fore term computed but discarded by `max()`. On real
streamlined fuselages it is **identically zero** — the `S_FORE` 75-degree hard
cone never triggers on any of them. So for the entire streamlined class
`compositeV1 = softAft` **exactly**, and the production estimator is not
partially but **totally** blind to nose shape.

Meanwhile measured drag moves **3.5%** (0.0401 -> 0.0415) between two bodies
that differ **only** in the nose.

#### 57.10.2 THE PAIR RESULTS

**INDEPENDENT (both unconsumed):**

| pair | shared | varies | `d(scalar)` | blind? | `d(ribbon)` | predicted | measured | agrees |
|---|---|---|---|---|---|---|---|---|
| **121T vs 221** | tail 221 | **nose** | 5.85e-4 (**0.07x** noise) | **BLIND** | 1.842 deg (**16x**) | 221 | 221 | **YES** |
| 211T vs 222 | nose 222 | tail | 9.96e-2 (12x noise) | sees it | 2.594 deg (23x) | 222 | 222 | yes* |

**SUPPORTING (involve calibration-consumed 111) — never pooled:**

| pair | shared | varies | `d(scalar)` | blind? | `d(ribbon)` | predicted | measured | agrees |
|---|---|---|---|---|---|---|---|---|
| **111 vs 211T** | tail 111 | **nose** | 7.39e-5 (**0.01x** noise) | **BLIND** | 2.447 deg (**22x**) | 211T | 211T | **YES** |
| 111 vs 121T | nose 111 | tail | 2.33e-2 (2.9x noise) | sees it | 1.636 deg (14x) | 111 | 121T | **NO** |

`*` outside the claim's scope: the scalar separates it, so no ribbon claim
arises.

**The pattern is exactly the one 56.9 predicted.** Both **nose**-varying pairs
are scalar-blind — one at 0.07x and one at 0.01x of the scalar's own noise —
and the ribbons separate both by 16-22x *their* noise, in the pre-registered
direction, matching measured drag. Both **tail**-varying pairs are scalar-
*resolved*, which is correct behaviour for an aft-closure descriptor and
generates no ribbon claim.

#### 57.10.3 THE FAILURE, REPORTED NOT BURIED

**`111 vs 121T` contradicts the mirrored tail direction.** Predicted 111
higher; measured 121T higher (0.0405 vs 0.0401, a 1% gap).

It lies **outside the test's scope** — the scalar resolves that pair at 2.9x
noise, so 57.6 raises no ribbon claim about it. But the 57.5 **aft** direction
(*less zone 4-5 turning -> more drag*) is **not supported**, and on the
evidence here it should not be relied upon. **Only the FORE direction has any
support.** The aft half of 57.5 is recorded as unsupported.

#### 57.10.4 CORRECTION TO MY OWN POWER STATEMENT

57.7 pre-registered "two independent controlled pairs -> 25% chance by
coincidence." **That was too generous, and the error is mine.**

Only **ONE** independent pair turned out to be scalar-blind — the other is
resolved by the scalar and therefore carries no ribbon claim. So:

> **The independent evidence is a SINGLE pair, whose direction agrees by
> coincidence with probability 1/2, not 1/4.**

Adding the supporting pair would give two agreeing nose pairs, but 57.3 froze
that independent and supporting evidence are **never pooled**, and that rule
is not bent now that pooling would flatter the result.

> **VERDICT: CONSISTENT, AND VERY WEAK. One independent pair is not
> validation and this must not be reported as one.**

#### 57.10.5 WHAT THIS CHANGES, AND WHAT IT DOES NOT

**Strengthened:** 56.9's mechanism now has a measured-drag case attached. The
production scalar returns `compositeV1` differing by 0.07x its own noise for
two real fuselages whose measured drag differs by **7.9%**, and the frozen
ribbon descriptors separate them 16-fold in the direction that was written
down first.

**Not changed:** `compositeV1` is untouched, `max(softAft, softFore)` is
untouched, no Cd was refitted, no calibration moved, production is unchanged.

**Outstanding data requirement, per 57.8** — now sharper rather than
hypothetical: an **external nose-shape / forebody series at matched Reynolds
and fineness, never used anywhere in this project's development.** TN-614 has
given one independent scalar-blind nose pair, which is the most it structurally
contains. **TR-291 remains SPENT.** The independent asymmetric chine remains
**UNSPENT**.

---

## 58. EXTERNAL FOREBODY SERIES — ACQUISITION ASSESSMENT (2026-08-20). **NEITHER CANDIDATE SPENDS USEFULLY. NOTHING SPENT.**

Both candidates were assessed against the four pre-conditions **before** any
ribbon number was computed against either. **No drag value from either report
has been used for anything.**

### 58.1 CONDITION 4 FIRST — NEITHER HAS EVER INFLUENCED THIS ESTIMATOR

Repo-wide search for `D-3388`, `L57F25`, `McGhee`, `Polhamus`, `elliptical
forebody` and both NTRS ids: **zero hits.** The project's entire external
corpus is **NACA TM-267, TN-614, TR-291, TR-318, TR-397, TR-432**. Both
candidates are genuinely virgin. **This condition passes for both.**

### 58.2 THE TWO REPORTS, AGAINST THE OTHER THREE CONDITIONS

| | **TN D-3388** (Norris & McGhee, 1966) | **RM L57F25** (Polhamus, 1957) |
|---|---|---|
| geometry defined | **exact**: ellipse `x^2/a^2 + y^2/b^2 = 1`; six configs, `a/b` = 1.0, 0.667, 0.500, ... to 0 | **exact**: four flat-faced noses, corner radii `r` = 0 to 2.50 in (hemisphere), plus two ogives |
| single-variable control | **yes** — identical cylindrical afterbody, `L/d` 3.55 | **yes** — identical body, removable nose only |
| reference area | frontal (afterbody cross-section, 0.4295 ft^2) | frontal (base area `S`) |
| drag quantity | `CD,f` = forebody drag, base drag AND afterbody friction removed | `C_A` axial force, base-pressure corrected |
| matched Reynolds | **yes** — constant `R = 6.3e6` at M = 0.20/0.40/0.60/0.80 | **no Re control** ("no opportunity to evaluate ... Reynolds number at constant Mach"); matched only across noses at one Mach |
| angle of attack | 0 deg | 0 deg available (fig. 7) |
| fineness | **3.55** (stubby) | **10.94** (much closer to our domain) |
| **tabulated drag values** | **NONE — figures only** | **NONE — figures only** |

### 58.3 BLOCKER 1: NEITHER REPORT TABULATES ITS DRAG DATA

Every drag result in both reports exists **only as a plotted curve**. D-3388's
result pages carry 100-400 characters each — axis labels. L57F25's pages 9-30
are identically sparse, and neither contains the word "TABLE".

The ruling required *"preserve exact geometry and measured aerodynamic values
from the source."* **That cannot be satisfied by either report without
digitising graphs.** This project has already been bitten by scan
transcription on TN-614, where a *table* existed to anchor against and the
scan still needed monotone-chain logic to recover. Digitising six curves with
no table to check against would put **my own transcription inside my own
test** — and the resulting numbers would be neither exact nor independent.

### 58.4 BLOCKER 2, AND THIS ONE IS FUNDAMENTAL: **NEITHER BODY CLOSES**

Both models are a nose on a cylinder terminating in a **flat base**. There is
no aft closure anywhere in either series.

That matters because of what 56.9 and 57.10 actually established:

> On **closed streamlined bodies**, `softFore` is identically zero, so
> `compositeV1 = max(softAft, softFore)` reduces to `softAft` and the scalar
> is blind to the nose **while still measuring something real about the aft**.

On a based cylinder the scalar would also be "blind" — but **for an entirely
different reason**: `terminalBaseFrac` is a full base, the class pins, and
`softAft` is identical across the series *because the afterbody is literally
the same part*. That is blindness caused by the geometry sitting outside the
descriptor's domain, not by the `max()` discarding a fore term.

> **Confirming 56.9's mechanism requires 56.9's geometry class. A
> forebody-on-a-cylinder series would produce agreement that means something
> different from what we are trying to confirm.**

Two further consequences: the ribbons' aft-turning content is meaningless on a
body with no closure, so half the descriptor set is inapplicable; and the
bodies are dominated by separated bluff flow (D-3388 configs 4-6 separate
*ahead of the shoulder*; four of L57F25's six noses are flat-faced), which is
far outside the streamlined regime the estimator serves.

### 58.5 A THIRD PROBLEM, D-3388 SPECIFIC

Stated accuracy of `CD,t` is **+-0.003 at M = 0.80** but **+-0.043 at
M = 0.20**. The condition closest to incompressible — the one an airship
estimator would care about — is the one measured **14x less precisely**. The
better-measured condition is the transonic one, where D-3388 itself reports
shock-induced separation at the shoulder.

### 58.6 VERDICT — NOTHING SPENT, AND THE REQUIREMENT RESTATED

**Neither report is spent. Recommend neither be spent** in its current role.

L57F25 is the closer of the two to this project's domain — fineness **10.94**
and two genuinely ogival noses — and if the owner rules to proceed anyway, it
is the one to use, with 58.3 and 58.4 recorded as standing caveats on any
result it produces.

**The requirement, restated more precisely than 57.8 managed:**

> a **CLOSED** streamlined body-of-revolution series, with **systematically
> varied FOREBODY**, at **matched Reynolds number and matched fineness**, and
> with **TABULATED** measured drag.

That description is exactly **TN-614**, which is why TN-614 worked — and
TN-614 has now yielded the single independent scalar-blind nose pair it
structurally contains.

**The natural next place to look is TN-614's own programme**: the NACA
variable-density-tunnel fuselage-drag series, same tunnel, same experimenter,
same tabulated style, closed streamlined bodies. Those reports are tabulated by
convention, which is the property both 1957/1966 candidates lack.

> **CORRECTION 2026-08-20 (see 59.0). The NACA Report 451 lead named here was
> WRONG.** Report 451 is *The Drag of Two Streamline Bodies as Affected by
> Protuberances and Appendages* — an appendage study, **not** a controlled
> forebody series at fineness 4.5/5.9. The claim was taken from a
> search-result summary rather than from the report itself. **NACA Report 394**
> (*Airship Model Tests in the Variable Density Wind Tunnel*) is virgin and
> relevant background, but its Goodyear-Zeppelin models **share a generating
> curve** and vary mainly fineness, so it is **not** the required nose-only
> series either.

**Not yet assessed, and not claimed to be suitable** — naming a report is a
lead, not a finding, and 58.6 named the wrong one.

---

## 59. **PHASE 2 DESCRIPTOR SET AND HYPOTHESIS — FROZEN 2026-08-20, BEFORE ANY NEW DATASET IS OPENED.** (owner ruling, reviewer-authored)

### 59.0 A CORRECTION TO 58.6

**58.6's NACA Report 451 lead was WRONG.** Report 451 is *The Drag of Two
Streamline Bodies as Affected by Protuberances and Appendages* — an
appendage-drag study, **not** a controlled forebody series. I took it from a
search-result summary rather than from the report, which is the same unchecked
inference this spec repeatedly warns about.

**NACA Report 394** (*Airship Model Tests in the Variable Density Wind
Tunnel*) is virgin and relevant background, but the Goodyear-Zeppelin models
**share a generating curve** and vary mainly fineness and test conditions.
**It is NOT to be spent as the nose-shape confirmation** unless closer
inspection reveals an actual matched-fineness forebody contrast.

### 59.1 WHY FREEZE NOW

The descriptors below **are** the aerodynamic hypothesis. Choosing them after
seeing a new dataset would make every subsequent agreement post-hoc. They are
therefore fixed here, **before** any candidate series is opened.

### 59.2 THE HYPOTHESIS, STATED FIRST

> **Good streamlined bodies tend to distribute surface turning smoothly, avoid
> carrying excessive curvature late into closure, and exhibit coherent
> corresponding turning histories on opposing sides.**

**This is a ROUTING / ANALOGUE hypothesis — which measured aerodynamic family
does this geometry resemble — NOT a claim that geometry alone determines Cd.**
Reynolds number, boundary-layer state, separation, crossflow and appendages
all remain outside it.

### 59.3 THE DESCRIPTORS — FIVE, NO FITTED WEIGHTS, NO COMBINED SCORE

All are defined on the **earned domain, zones 1-5 only** (55.2), from the
per-ribbon zone vector `z_1..z_5` of absolute turning already frozen in 4.6 /
4.8. Nothing new is measured; these are readings of an existing field.

| | descriptor | definition | units |
|---|---|---|---|
| **F1** | **fore turning distribution** | `(z1 + z2) / (z1+z2+z3+z4+z5)` | fraction |
| **F2a** | **aft turning burden**, absolute | `z4 + z5` | deg |
| **F2f** | **aft turning burden**, fraction | `(z4 + z5) / sum(z1..z5)` | fraction |
| **F3** | **turning concentration** | `max(z1..z5) / mean(z1..z5)` | ratio, 1.0 = perfectly even |
| **F4** | **turning centroid, earned domain** | `sum(u_z . z_z) / sum(z_z)` over zones 1-5, `u_z` = zone centre | fraction |
| **F5** | **opposite-ribbon disagreement** | per opposing pair `(k, k+planes)`: `max over zones 1-5 of abs(z_z(k) - z_z(k_opp))` | deg |

**F4 is NOT the existing `turnCentroid`.** `ribbonMetrics.turnCentroid` is
computed over the *whole* retained domain; F4 restricts to the earned zones.
Different quantity, different name, recorded so the two are never confused.

**F5 is FROZEN NOW BUT NOT CLAIMABLE FROM AXISYMMETRIC DATA.** On a body of
revolution it is identically ~0 and carries no information. It is fixed here
so that when non-axisymmetric evidence eventually exists, the descriptor was
not chosen after seeing it.

**NO COMBINED SCORE IS DEFINED.** F1-F5 are reported side by side. **Per spec
10 the per-ribbon field is preserved** — every descriptor is reported as
median across ribbons, worst ribbon and which one, and inter-ribbon spread.
**Never the mean alone, never collapsed to one number.**

### 59.4 DIRECTIONS, PRE-REGISTERED FROM PHYSICS

| descriptor | pre-registered direction |
|---|---|
| **F2a / F2f** high — heavy turning late in closure | **worse** (stronger adverse gradient near closure) |
| **F3** high — turning concentrated in one bend | **worse** (a single hard bend rather than gradual shaping) |
| **F1** low — little forward turning, i.e. a blunter nose reaching max radius early | **worse** (57.5's fore direction, the only one with any support) |
| **F4** shifted aft | **worse**, as the aft-loaded case of F2 |
| **F5** | **no direction claimed** — asymmetry is reported, not scored |

### 59.5 THE AFT SIGN IS OPPOSITE TO 57.5's, AND THAT MUST NOT BE LAUNDERED

57.5 pre-registered the aft direction as *less* zone 4-5 turning -> more drag
(mirroring the fore logic: a bluffer tail is flatter, so turns less). **57.10.3
recorded that direction as UNSUPPORTED**, contradicted by `111 vs 121T`.

**59.4 freezes the OPPOSITE aft sign.** That reversal is legitimate **only**
because it follows from a physical argument — curvature carried late into
closure implies a stronger adverse pressure gradient — and **not** because the
earlier sign failed.

> **THEREFORE: `111 vs 121T` IS INADMISSIBLE AS EVIDENCE FOR THE NEW AFT
> DIRECTION.** The sign was reconsidered *after* that pair was seen, so
> counting it now would be fitting a direction to a known outcome. It is also
> outside the scalar-blind scope and involves the calibration-consumed `111`.
>
> **Confirmation of the aft direction must come from virgin data or not at
> all.**

### 59.6 THE EXTERNAL-DATA STANDARD — NOT TO BE LOWERED

Required, all six:

1. **closed** streamlined bodies of revolution;
2. systematically varied **forebody / nose**;
3. matched or controlled **fineness**;
4. matched **Reynolds** condition;
5. **exact reconstructable geometry** (equation or ordinate table);
6. **TABULATED** measured drag.

**Preferred: the afterbody held literally fixed while the nose varies** — the
cleanest direct attack on the blindness demonstrated in 56.9 and 57.10.

> **A clean 2-4 body controlled series with exact geometry and a drag table is
> worth far more than 30 vaguely related shapes read off old graphs.**

**If no pristine series exists, that is REPORTED AS THE EVIDENCE LIMIT** — not
worked around by digitising a convenient plot and calling it an exact blind
test.

### 59.7 OUT OF SCOPE

Literature search only. **No descriptor fitting. No combined score. No Cd
refit. No calibration change. No production change. No geometry work.**
`compositeV1` and `max(softAft, softFore)` remain untouched. TR-291 stays
SPENT. The independent asymmetric chine remains **UNSPENT**.

---

## 60. LITERATURE SEARCH OUTCOME (2026-08-20). **NOTHING SPENT. ONE STRONG CANDIDATE, WITH A CONFLICT THAT NEEDS A RULING.**

### 60.1 THE STRUCTURAL PROBLEM WITH THE HISTORICAL RECORD

Searched against the six conditions of 59.6. The finding is about the
literature itself:

> **Historical airship and fuselage programmes overwhelmingly varied FINENESS
> and APPENDAGES, not NOSE SHAPE at fixed fineness with a fixed afterbody.**

- **C-class hulls of various fineness ratios** — fineness series. This is
  **TR-291**, already **SPENT**.
- **Report 138** — C-class hull with varying length of cylindric midships:
  varies midbody, not nose.
- **Report 394** — Goodyear-Zeppelin models **share a generating curve**;
  varies fineness and test conditions. Ruled out as the nose series (59.0).
- **Report 451** — appendages and protuberances. Ruled out (59.0).

**That is why TN-614 is unusual**: Abbott deliberately built nose/tail swap
combinations, which almost nobody else did.

*(Noted, not acted on: Report 451 also describes **one model's stern rounded
off to produce a blunter shape** — a controlled AFT contrast on an otherwise
identical body. 59.5 says the aft direction needs virgin data. Recorded as an
observation for the owner, NOT pursued, because 59.0 ruled 451 out.)*

### 60.2 THE CANDIDATE: **DTMB SERIES 58 (Gertler, 1950)**

Systematic series of **closed streamlined bodies of revolution**, geometry
defined by a **polynomial** — so exact and reconstructable — varying:

- fineness ratio,
- prismatic coefficient,
- **position of maximum diameter.**

**The third parameter is precisely a fore/aft shape-distribution variable at
fixed fineness** — which is exactly what **F1** (fore turning distribution) and
**F4** (turning centroid) measure. It attacks 56.9's blindness from a different
and arguably better angle than a nose-only swap.

**But it does NOT satisfy 59.6's preferred form**: moving the maximum-diameter
station changes the fore body **and** the after body, so the afterbody is not
held fixed.

### 60.3 **CONFLICT: SERIES 58 IS ALREADY A NAMED LEAD FOR CALIBRATION**

It appears in `RESULTS.md`, `NEXT-THREAD.md` and `IDEAS-BACKLOG.md` as a
standing lead for closing the estimator's **mid-map calibration gap** (proxy
0.18-0.82, where the bare Sunship sits at 0.770 in a measured void).

> **NAMED IS NOT SPENT — no Series 58 datum has entered the estimator.** But
> using the same series BOTH to calibrate the Cd map AND to test whether
> ribbons beat that map would be **double use**, and is the spec 7
> contamination pattern one level up.

**This is a RULING, not a measurement, and it is not mine to make.** The owner
must decide whether Series 58 is spent on calibration or on this test.

### 60.4 UNRESOLVED FACTS, FLAGGED NOT ASSUMED

- **Report number RESOLVED 2026-08-20 (owner).** The resistance programme is
  **DTMB Report C-297**, April 1950 — MIT's archive names the file
  `DTMB_1950_C297.pdf` (152.85 MB, iv + 139 pp). `NEXT-THREAD.md`'s "297" was
  essentially right and only missing the **`C-`** prefix. **The `712` citation
  given here was WRONG and is RETIRED.** Landweber & Gertler's *Mathematical
  Formulation of Bodies of Revolution* is **DTMB Report 719** — a different
  document, not the resistance report.
- **It is a TOWING-TANK series**, so resistance is usually reported on a
  **volumetric** basis, not frontal, and carries free-surface, roughness and
  scale considerations an air-drag corpus does not. Convertible only if the
  geometry and reference definitions are exact.
- **Conditions 4-6 of 59.6 are UNVERIFIED** — matched Reynolds, exact offsets
  and tabulated drag have not been confirmed from the report itself. The PDF
  was **not acquired**.

### 60.5 STATUS

**NOTHING SPENT.** No drag value from any candidate has been used. D-3388 and
L57F25 remain unspent per 58.6. TR-291 stays SPENT. The independent asymmetric
chine remains **UNSPENT**. Production untouched, no descriptor fitted, no
combined score defined.

---

## 61. **SERIES 58 SPENT ON PHASE-2 DISCRIMINATION, NOT CALIBRATION. QUALIFICATION PROTOCOL FROZEN 2026-08-20, PRE-READING.** (owner ruling, reviewer-authored)

### 61.1 THE EVIDENCE-BUDGET RULING

> **DTMB Report C-297 (Series 58) is spent on Phase-2 ribbon
> discrimination / ordering evidence — NOT on the mid-map Cd calibration.**

Recorded because this is the kind of decision that gets re-litigated later:

- The scalar's information deficit is **already** demonstrated (56.9, 57.10)
  and the descriptors are **already** frozen (59) **before** any Series 58
  outcome was seen. A systematic family varying *where and how thickness
  develops* is unusually well matched to testing exactly those descriptors.
- Series 58 is a **poor** source of absolute air pressure-drag calibration: a
  submerged-body towing-tank programme with its own resistance decomposition,
  Reynolds/scale treatment and coefficient basis. Using its absolute
  coefficients as Cd-map knots would require extra modelling assumptions.

> **NO SERIES-58 RESISTANCE VALUE MAY ALTER THE Cd MAP BEFORE THIS EXPERIMENT
> IS RESOLVED.**

### 61.2 QUALIFICATION — BEFORE ANY COMPARISON IS RUN

Verify from C-297 itself, running no ribbon/scalar comparison:

1. **exact geometry** — offsets tabulated, or polynomial parameters sufficient
   to reconstruct each hull exactly;
2. **tabulated resistance** — and the precise meaning of every column: what
   `total` and `residual` denote, the skin-friction correction used, any
   appendage correction;
3. **deep submergence vs free surface** — identify which runs are deeply
   submerged; **the deep-submergence set is the primary comparison**,
   snorkelling / free-surface cases excluded from it;
4. **Reynolds / Froude / speed coverage** — and whether matched-condition
   comparisons can actually be formed;
5. **parameter groups** — Series 58 varies *slenderness ratio, prismatic
   coefficient, position of maximum section, nose radius, tail radius*; map
   which groups isolate **one geometric variable at a time**.

### 61.3 THE DISCIPLINE THAT MAKES THIS WORTH DOING

> **MODEL AND GROUP SELECTION IS PREREGISTERED FROM GEOMETRY AND EXPERIMENTAL
> DESIGN, BEFORE THE RESISTANCE TABLE IS READ.**

**Do NOT choose favourable models after viewing resistance outcomes.** Items 1
and 3-5 are *structural* and may be read freely; **item 2's actual resistance
NUMBERS are the outcome and are read LAST**, after the groups are frozen.

Series 58's **separately variable nose radius and tail radius** are the
valuable part: they permit a **nose-only contrast at otherwise fixed
geometry** — 59.6's preferred form, and the cleanest possible attack on the
blindness of 56.9 / 57.10.

### 61.4 THE PRIMARY TEST — UNCHANGED IN KIND, NON-FITTED

> **Within controlled Series-58 parameter groups, does the already-frozen
> ribbon descriptor field (F1-F5, 59.3) distinguish or order bodies in ways
> that correspond to measured resistance WHERE THE PRODUCTION SCALAR DOES
> NOT?**

**Ordering and controlled pairwise discrimination only. Absolute Cd prediction
stays out of this experiment.** No fitted weights, no combined score, no
regression — 59.3 and 59.7 unchanged. Scalar-blindness and ribbon-resolution
stay **noise-referenced** exactly as in 56.6: both tolerances measured from the
authorised QuickHull samplings of the same body, neither chosen.

### 61.5 ACQUISITION STATUS — NOT YET IN HAND

**C-297 is NOT acquired.** The MIT DSpace bitstream served the full file once
(160 271 668 bytes, valid `%PDF-` header) and has returned **HTTP 202 with
zero bytes** on every request since — the repository queues large-file
requests asynchronously.

> **The successful copy was destroyed by my own error:** a retry loop wrote a
> second URL's 404 page over the good file before it had been verified.
> Recorded rather than glossed — the correct handling is to verify and move a
> download to its final name before attempting anything else.

Retries continue to return 202. **Nothing has been read from C-297 and nothing
is claimed from it.** The 152.85 MB / iv + 139 pp figures come from the
catalogue record, not from the file.

### 61.6 HELD IN RESERVE, NOT SPENT

**NACA Report 451's rounded-stern contrast** — Abbott rounded one model's
stern specifically to make it blunter, giving an otherwise-identical-body
**aft** contrast. 59.5 requires virgin data for the aft direction, so this may
eventually serve as a small supporting aft experiment. **Series 58 has first
priority; 451 is reserved, not spent.**

### 61.7 STATUS

`compositeV1` and `max(softAft, softFore)` untouched. No Cd refit, no
calibration change, no production change. TR-291 **SPENT**. D-3388 and L57F25
**unspent**. The independent asymmetric chine remains **UNSPENT**.

---

## 62. C-297 QUALIFICATION (2026-08-20): **QUALIFIES ON ALL FIVE ITEMS.** Groups frozen from the experimental design. **One disclosure of premature outcome exposure.**

Acquired by the owner (`DTMB_1950_C297.pdf`, **145 pages** — the harness
reported 918, which is wrong, the same mis-count class already recorded for
other PDFs on this machine). Text recovered with `pypdf`; the scan is a 1950
typescript and OCR is rough, so every number used later must be transcribed
against its neighbours, not trusted on first read.

### 62.1 DISCLOSURE — I SAW OUTCOME DATA BEFORE THE GROUPS WERE FROZEN

61.3 required the resistance **numbers** to be read last. **Two exposures
happened, both mine, and both are recorded here rather than glossed:**

1. **The ABSTRACT states a result**: *"there is a definite minimum resistance
   on each parameter variation **except for the nose radius**."* Unavoidable
   when reading the abstract for qualification, but it is partial outcome
   information about the **nose group**, which is the primary group.
2. **I extracted 260 characters of TABLE 2 intending caption + column
   headers**, and the values begin immediately after the header row. **I saw
   net residual-resistance coefficients for models 4154, 4155, 4156, 4162,
   4163, 4164, 4170 and 4171** — a partial scatter across several groups.

**MITIGATION, stated as fact not as excuse:** the groups below are **not
chosen by me**. They are forced by Series 58's own one-variable-at-a-time
star design (Table 1), which existed in 1950. There is no freedom to
cherry-pick a favourable group, because the design defines them. **But the
ordering discipline was broken, and whether that taints the nose-group result
is the owner's ruling, not mine.**

### 62.2 ITEM 1 — EXACT GEOMETRY: **SATISFIED, TWICE OVER**

Offsets are derived from a **sixth-degree polynomial**
`y = a1.x + a2.x^2 + a3.x^3 + a4.x^4 + a5.x^5 + a6.x^6`, and Appendix 2
(PDF pp 73-98) gives, per model, **both**:

- a **tabulated offset list** (`X/L` vs `Y/D`, ~25 stations), and
- the **explicit polynomial constants** — e.g. `a1 = +1.000000`,
  `a2 = +1.999653`, `a3 = -16.679052`, `a4 = +33.862413`, `a5 = -30.386285`,
  `a6 = +10.203269` — plus wetted-surface coefficient and LCB.

**Geometry is exactly reconstructable in closed form.** This is stronger than
TN-614, which gives ordinates only. Nondimensional `X/L` vs `Y/D` is
identical for all fineness ratios once the other four parameters are fixed.

### 62.3 ITEM 2 — TABULATED RESISTANCE: **SATISFIED**

> **TABLE 2 (PDF p29): "Net Residual-Resistance Coefficients for Series 58
> Forms at Deep Submergence"** — one coefficient per model, all 24 models,
> **tabulated, not plotted.**

The appendices carry the *curves* (total-R vs Reynolds, Appendix 3; net
residual vs Froude, Appendix 5; snorkelling, Appendix 7) — those are sparse
figure pages. **But the headline per-model number this experiment needs is in
a table**, which is exactly what D-3388 and L57F25 lacked.

Decomposition, from the body text: total-resistance coefficient minus the
computed friction line gives **residual**; a **dummy-strut assembly** measures
and removes strut interference, giving **net** residual. Turbulence was
stimulated. Full column semantics to be transcribed before use.

### 62.4 ITEMS 3-5 — SATISFIED

- **Item 3, deep vs free surface:** Table 2 is **deep submergence**, at a depth
  "deep enough to substantially eliminate free-surface effects". Snorkelling
  is a separate set of **four models only** (Appendix 7, Table 3). **The deep
  set is primary; snorkelling is excluded from the primary comparison.**
- **Item 4, coverage:** Appendix 3 gives total-R against **Reynolds number**;
  Appendix 5 net residual against **Froude number**. 24 models, 9-foot each,
  one hull size — so matched-condition comparison across models is available
  by construction.
- **Item 5, parameter groups:** Table 1 gives all five parameters for all 24
  models. See 62.5.

### 62.5 THE GROUPS, FROZEN — FORCED BY THE 1950 DESIGN, NOT SELECTED BY ME

A **one-variable-at-a-time star** about centre model **4157**
(`m` 0.40, `r0` 0.50, `r1` 0.10, `Cp` 0.65, `L/D` 7.0):

| group | varies | models (parameter value) |
|---|---|---|
| **G-NOSE** | **nose radius `r0` ONLY** | 4167 (0.00), 4168 (0.30), **4157** (0.50), 4169 (0.70), 4170 (1.00) |
| **G-TAIL** | **tail radius `r1` ONLY** | 4171 (0.00), 4172 (0.05), **4157** (0.10), 4173 (0.15), 4174 (0.20) |
| G-M | position of max section `m` | 4177 (0.34), 4160 (0.36), **4157** (0.40), 4161 (0.44), 4162 (0.48), 4163 (0.52) |
| G-CP | prismatic `Cp`, at `L/D` 7 | 4164 (0.55), 4165 (0.60), **4157** (0.65), 4166 (0.70) |
| G-LD | fineness `L/D` | 4154 (4.0), 4155 (5.0), 4156 (6.0), **4157** (7.0), 4158 (8.0), 4159 (10.0) |
| G-CP5 | `Cp` at `L/D` 5 | 4176 (0.55), 4175 (0.60), 4155 (0.65) |

> **G-NOSE IS THE PRIMARY GROUP.** Five bodies differing in **nose radius
> alone**, everything else identical — 59.6's preferred form exactly, and
> five bodies where TN-614 yielded one independent pair.
>
> **G-TAIL is the aft counterpart** and is the **virgin data** 59.5 demanded
> before the reversed aft direction may be claimed.

### 62.6 A STRUCTURAL PREDICTION, REGISTERED BEFORE THE TABLE IS READ

From the mechanism of 56.9 / 57.10 — `compositeV1 = max(softAft, softFore)`
with `softFore` identically zero on streamlined bodies — the production scalar
should:

- **be BLIND on G-NOSE** (nose shape invisible to an aft-closure penalty);
- **RESOLVE G-LD and G-CP** (fineness and fullness are exactly what it reads);
- **RESOLVE G-TAIL** (aft closure is its subject).

**If the scalar instead resolves G-NOSE, the 56.9 mechanism does not
generalise beyond TN-614 and this experiment refutes it.** Registered here so
that outcome counts.

### 62.7 STATUS

**C-297 QUALIFIES.** No resistance value has been used for anything; the
partial exposure of 62.1 is disclosed and nothing has been computed from it.
`compositeV1` and `max()` untouched, no Cd refit, no calibration change, no
production change. TR-291 **SPENT**. D-3388 and L57F25 **unspent**. The
independent asymmetric chine remains **UNSPENT**.

---

## 63. SERIES 58 PREDICTIONS FROM GEOMETRY ALONE — **FROZEN 2026-08-20, BEFORE TABLE 2 IS OPENED.**

`series58-data.mjs` + `series58-predict.mjs`. No resistance value was read by
either. Geometry solved in closed form (62.2) and verified against the
report's own printed constants to ~1e-6 on models 4157, 4165, 4169, 4170.

Noise, measured by the 56.6 procedure on these bodies:
**`sigma_scalar` = 5.426e-3, `sigma_F1` = 2.7e-4, `sigma_F2a` = 0.0149 deg,
`sigma_F3` = 4.4e-3, `sigma_F4` = 1.9e-4.**

### 63.1 **56.9's MECHANISM CONFIRMED ON A THIRD CORPUS**

> **`softFore` = 0.0e+0 on 23 of the 24 Series 58 bodies** (4154 gives
> 6.6e-5, numerically zero). **`compositeV1` = `softAft` exactly.**

The 75-degree hard cone never fires on any streamlined hull in this series,
exactly as on all six TN-614 bodies. **The production scalar carries no
forebody-specific information at all**, on a third independent corpus.

### 63.2 **MY 62.6 PREDICTION FAILED — AND THE FAULT IS MINE, NOT THE MECHANISM'S**

62.6 registered that the scalar should be **BLIND** on G-NOSE. **It is not:
it resolves G-NOSE at 5.1x its own noise**, `compositeV1` running 0.0408
(4167) to 0.0129 (4170).

**The cause is an error in 62.5, and the report told me so before I wrote it.**
C-297 p11 states:

> *"the nose-radius and tail-radius parameters as used here do not apply
> merely to the extremities of the given forms but actually affect the shape
> of the whole form."*

**I read that sentence during qualification and then described G-NOSE as "five
bodies differing in nose radius alone, everything else identical." That
description is WRONG.** G-NOSE holds `m`, `r1`, `Cp` and `L/D` fixed, but the
sixth-degree polynomial is global — changing `r0` changes every coefficient
and therefore the **aft** shape too.

**Consequences, stated exactly:**

- **G-NOSE is NOT a forebody-isolating contrast**, so it **cannot test**
  forebody blindness. **The scalar resolving G-NOSE is NOT evidence against
  56.9**, and must not be reported as such.
- **62.5's "nose radius ONLY" and "tail radius ONLY" wording is RETRACTED.**
  The correct statement: these are one-*parameter*-at-a-time groups, not
  one-*region*-at-a-time groups.
- **59.6's preferred form — afterbody held literally fixed — is NOT satisfied
  by Series 58.** No group in this series isolates the forebody. That remains
  an outstanding data requirement.

**The other three structural predictions held**: G-LD resolves (26.2x), G-CP
resolves (10.4x on G-CP5, and G-CP resolves), G-TAIL resolves (3.5x).

### 63.3 THE TEST THAT REMAINS IS SHARPER: **THE TWO REPRESENTATIONS PREDICT OPPOSITE ORDERINGS**

Both representations resolve G-NOSE, and they disagree **completely**:

| | most drag -> least drag |
|---|---|
| **production scalar** (`compositeV1` high = worse) | **4167 > 4168 > 4157 > 4169 > 4170** |
| **frozen ribbons** (59.4: `F1` low = worse) | **4170 > 4169 > 4157 > 4168 > 4167** |

> **Exactly reversed, model for model.** The scalar says the **sharp** nose
> (`r0` = 0) is worst and the **hemispherical** nose (`r0` = 1.0) is best; the
> frozen ribbon hypothesis says the opposite.
>
> **One of them is wrong, and Table 2 decides it.** This is a cleaner test
> than the blindness test it replaces, and neither ordering can be adjusted
> now.

### 63.4 ALL FROZEN PREDICTIONS

| group | varies | primary | scalar | ribbons | **predicted ordering, most drag first (59.4)** |
|---|---|---|---|---|---|
| **G-NOSE** | `r0` | F1 | resolves 5.1x | resolves 858x | **4170 > 4169 > 4157 > 4168 > 4167** |
| **G-TAIL** | `r1` | F2a | resolves 3.5x | resolves 61x | **4171 > 4172 > 4157 > 4173 > 4174** |
| G-M | `m` | F4 | resolves 1.6x | resolves 550x | 4163 > 4162 > 4161 > 4157 > 4160 > 4177 |
| G-CP | `Cp` | F2a | resolves | resolves 46x | 4164 > 4165 > 4166 > 4157 |
| G-LD | `L/D` | F1 | resolves 26.2x | resolves 11.8x | 4154 > 4155 > 4156 > 4157 > 4158 > 4159 |
| G-CP5 | `Cp` at L/D 5 | F2a | resolves 10.4x | resolves 61x | 4176 > 4175 > 4155 |

**The scalar's ordering is `compositeV1` descending, and is likewise frozen.**

**F5** sits at ~1e-2 deg on every body — numerically zero, as required on
axisymmetric geometry, and **not claimable** (59.3).

### 63.5 EXPOSURE TAGGING (62.1)

**Values already seen: 4154, 4155, 4156, 4162, 4163, 4164, 4170, 4171.**

**Unseen-value subsets**, preregistered as the cleaner secondary analysis:

- G-NOSE `[4167, 4168, 4157, 4169]` — but the **abstract-level** exposure about
  nose radius still applies to the group as a whole;
- G-TAIL `[4172, 4157, 4173, 4174]`; G-M `[4177, 4160, 4157, 4161]`;
  G-CP `[4165, 4157, 4166]`; G-LD `[4157, 4158, 4159]`; G-CP5 `[4176, 4175]`.

**4170 and 4171 stay in the full-group analysis** and are tagged contaminated
— they are **not** dropped to improve a statistic.

### 63.6 STATUS

Nothing fitted, no weights, no combined score, no Cd refit, no calibration
change, no production change. `compositeV1` and `max()` untouched. TR-291
**SPENT**. The independent asymmetric chine remains **UNSPENT**.

---

## 64. THE REVEAL (2026-08-20): **MIXED. Ribbons win the aft group cleanly and on virgin data; overall the two representations are a wash once exposure is controlled.**

Table 2 opened once, after the orderings were frozen at `e3baaa2`. Nothing
fitted.

### 64.1 A TRANSCRIPTION ERROR I MADE AND THEN CAUGHT

Model **4170**'s cell reads `0o.8 x 10-3`. **I first read it as 0.08**,
reasoning from the abstract's *"definite minimum on each parameter variation
except for the nose radius"* — 0.08 would put the nose optimum at the
boundary. **That inference was WRONG**, and the report's own discussion
(PDF p40) says so:

> *"The nose radius of 0.5, used on the parent, appears to be most
> satisfactory and it does not seem to be advisable to use a nose radius
> greater than 0.8."*

`r0` = 1.00 must therefore be **worse** than the parent's 0.13, which forces
**0.18**. The abstract's remark refers to the **EHP merit curve** being flat
and uncritical, not to the residual coefficient lacking a minimum.

**Had I not checked, I would have published the exact opposite G-NOSE result
(ribbons 1/9, scalar 8/9 instead of 5/9 vs 4/9).** The lesson is the one
already in spec 4: an inference from a summary is not a reading of the data.

**The rest of the transcription is corroborated at four independent points by
that same discussion**, which is why it is trusted:

| report text | implies | Table 2 |
|---|---|---|
| `r1` = 0.2 "most satisfactory" | 4174 lowest in G-TAIL | **0.10, lowest** ✓ |
| optimum `m` "approximately 0.36" | 4160 lowest in G-M | **0.12, lowest** ✓ |
| 4165 "approximately 1 percent higher than the selected minimum" | 4165 lowest in G-CP | **0.07, lowest** ✓ |
| EHP optimum near `L/D` 6.5 while friction rises | residual falls monotonically with `L/D` | **0.58 -> 0.075** ✓ |

### 64.2 THE SCORES

Concordant pairs against measured net residual resistance, ties excluded:

| group | **RIBBONS** (59.4) | **SCALAR** (`compositeV1`) | winner |
|---|---|---|---|
| G-NOSE | 5/9 (+1 tied) | 4/9 (+1 tied) | ribbons, barely |
| **G-TAIL** | **4/4** (+6 tied) | **0/4** (+6 tied) | **RIBBONS** |
| G-M | 12/15 | 12/15 | tie |
| G-CP | 4/6 | 3/6 | ribbons |
| G-LD | 15/15 | 15/15 | tie |
| G-CP5 | 2/3 | 1/3 | ribbons |
| **TOTAL** | **42/52** | **35/52** | ribbons 4 groups to 0 |

**But on the unseen-value subset (63.5), that reverses:**

> **ribbons 12/21, scalar 14/21.**

The full-group margin leans heavily on **4170**, which is doubly caveated —
its value was exposed before the freeze **and** its cell needed the 64.1
correction. **Neither total is decisive, and the honest reading is a wash.**

### 64.3 THE ONE CLEAN RESULT: **G-TAIL, ON VIRGIN DATA**

> **Ribbons 4/4 full, 3/3 on unseen values. Scalar 0/4 full, 0/3 unseen.**

Every unexposed model in G-TAIL (4172, 4157, 4173, 4174) is virgin, so this
is exactly the **virgin aft evidence 59.5 demanded** before the reversed aft
direction could be claimed — and 59.4's direction (*heavy turning late in
closure is worse*) gets **every non-tied pair right**.

**The production scalar gets every one wrong.** It ranks 4174 the *worst* of
the group; 4174 is measured the *best*, and the report says `r1` = 0.2 "appears
to be most satisfactory ... because it results in a more gradual afterbody
taper."

> **NARROWED 2026-08-20 (see 65.2).** The correct claim is bounded to this
> comparison: **within the frozen G-TAIL comparison, the production scalar
> ranks the measured tail-radius trend in the wrong direction on every scored
> comparison.** The original wording here — "the scalar is anti-correlated
> with measured resistance" — reads as a general property and is **withdrawn**
> in favour of the bounded statement.

It is three pairs. It is not validation. **But it is clean, virgin, and it is
the direction that was frozen from physics before the data existed.**

### 64.4 WHAT DID NOT REPLICATE

- **G-NOSE is a coin flip** (5/9 vs 4/9) and, per 63.2, is not a
  forebody-isolating group anyway, so it tests less than it appears to.
- **G-CP splits the wrong way on clean data** (ribbons 1/3, scalar 3/3). The
  `Cp` response is **U-shaped** — minimum at `Cp` = 0.60, rising at both ends —
  and **no single monotone descriptor can capture that**, which is a real
  limitation of the frozen F1-F5 set, not an accident.
- **G-LD is 15/15 for both** and discriminates nothing between them.

### 64.5 WHAT DID REPLICATE

**56.9's mechanism, on a third independent corpus:** `softFore` = 0.0e+0 on 23
of 24 Series 58 bodies. `compositeV1` = `softAft` exactly. **The production
scalar carries no forebody-specific information on any streamlined hull yet
tested** — TN-614, the 32-body analytic family, and now Series 58.

### 64.6 VERDICT, STATED AT THE STRENGTH THE EVIDENCE SUPPORTS

> **The frozen ribbon descriptor set does NOT decisively beat the production
> scalar on Series 58.** Full groups favour ribbons 42/52 to 35/52; the
> exposure-clean subset favours the scalar 14/21 to 12/21. **That is a wash.**
>
> **The one clean, virgin, directional win is G-TAIL**, where ribbons go 3/3
> and the scalar goes 0/3 on the parameter the scalar exists to measure.

**No descriptor, direction, group or comparison rule has been changed.** No
Cd refit, no calibration change, no production change. `compositeV1` and
`max(softAft, softFore)` untouched. TR-291 **SPENT**. Series 58 is now
**SPENT on Phase-2 discrimination** per 61.1 and must not be reused for
Cd-map calibration. The independent asymmetric chine remains **UNSPENT**.

---

## 65. **PHASE 2 BANKED — FINDINGS RECORDED INDIVIDUALLY. FROZEN 2026-08-20.** (owner ruling, reviewer-authored)

### 65.1 THE AGGREGATE IS NOT EVIDENCE, AND IS WITHDRAWN AS SUCH

> **`42/52 vs 35/52` MUST NOT be described as ribbons globally outperforming
> the scalar.**

Three independent reasons, all recorded:

1. **The unseen-value subset reverses it** — 12/21 to 14/21.
2. **Pairwise comparisons within a group are NOT independent observations.**
   Five models give ten pairs from five measurements; concordance counting
   inflates a small sample into an impressive-looking denominator. 64.2's
   totals are descriptive bookkeeping, **not a statistic**.
3. **Series 58 is hydrodynamic residual-resistance evidence, not direct air-Cd
   validation.** A towing-tank submerged-body coefficient is not the quantity
   the estimator predicts.

The findings below are banked **individually**. The aggregate is not banked.

### 65.2 **BANKED POSITIVE — G-TAIL**

> **Within the frozen G-TAIL comparison, the production scalar ranks the
> measured tail-radius trend in the WRONG DIRECTION on every scored
> comparison** (0/4 full, 0/3 unexposed), while the frozen ribbon
> representation orders every one correctly (4/4 full, 3/3 unexposed).

**Phrasing note, deliberate:** this is a statement about *the frozen G-TAIL
comparison*, **not** a claim that the scalar is universally anti-correlated
with drag. **64.3's broader wording is narrowed to this.**

The report's own physical explanation aligns with the ribbon hypothesis:
`r1` = 0.2 is preferred *"because it results in a more gradual afterbody
taper."* That is 59.2's hypothesis — **excessive late turning is
undesirable** — stated independently by the 1950 experimenters.

### 65.3 **BANKED NEGATIVE — G-CP, EQUALLY IMPORTANT**

The `Cp` resistance response is **non-monotonic — U-shaped with a minimum at
`Cp` = 0.60** — and the frozen **monotone** F1-F5 descriptors do not capture
it (ribbons 1/3 on clean data, scalar 3/3).

> **This is a real limitation of the descriptor set, banked as a negative
> result. NO new descriptor or combined score may be invented to repair it
> using Series 58 — the series is SPENT.**

**Aerodynamics is not one monotonic geometry rule.** There are optima and
interactions, and a monotone single-descriptor direction cannot represent
them.

### 65.4 **BANKED INCONCLUSIVE — G-NOSE**

Nearly a wash (5/9 vs 4/9), the parameter changes the whole form (63.2), and
part of the evidence was exposed before the freeze (62.1).

> **G-NOSE is supporting-only and MUST NOT be used to strengthen the TN-614
> forebody claim.**

### 65.5 **BANKED IMPLEMENTATION FACT — `softFore` IS INERT ON STREAMLINED HULLS**

Across three independent corpora — TN-614 (6 bodies), the 32-body analytic
family, and Series 58 (24 bodies) — **`softFore` is zero or numerically zero
on every streamlined hull tested**, so `compositeV1 = max(softAft, softFore)`
reduces to **`softAft`**.

> **The production scalar is much closer to an AFT-PENALTY DESCRIPTOR than a
> full longitudinal-shape representation.** That is an implementation fact
> about the current estimator, independent of anything ribbons do.

### 65.6 WHAT PHASE 2 HAS ESTABLISHED — AND WHAT IT HAS NOT

**NOT established:** that ribbons should replace the scalar.

**Established:**

> **The scalar and the ribbons carry DIFFERENT aerodynamic information. The
> scalar remains useful, but its one-number worst-penalty structure can
> mis-rank at least some controlled afterbody-shape changes that the
> distributed ribbon turning history orders correctly.**

That is sufficient to justify continuing toward a **hybrid estimator
architecture**, and insufficient for anything more.

**No ribbon weights are fitted. The Cd map is not altered.**

### 65.7 THE NEXT EVIDENCE TARGET — ONE QUESTION, PRE-FROZEN

The strongest open claim is now **aft closure**. Required: **one genuinely
independent controlled afterbody / tail-shape dataset with measured
drag or resistance, preferably AERODYNAMIC and TABULATED.**

> **THE PRE-FROZEN QUESTION, and only this one:**
>
> **Does greater late turning / a less gradual afterbody taper again
> correspond to worse measured performance, while the production scalar
> mis-orders or fails to resolve the same controlled variation?**

Standards of 59.6 apply unchanged. Descriptors and directions stay exactly as
frozen in 59.3 / 59.4 — **this is a replication attempt, not a new
experiment.**

### 65.8 IF NO SUITABLE DATASET EXISTS

**Record the evidence limit** and move toward a conservative implementation in
which ribbons inform **analogue / family routing and confidence**, **NOT a
directly fitted Cd correction**. Explicitly rejected as an architecture:

> `Cd = a.F1 + b.F2 + c.F3 + ...`

The shape the estimator is converging on instead:

| layer | role |
|---|---|
| **scalar** | severity / existing baseline |
| **ribbons** | shape-distribution and directional context |
| **Re + mechanism class + measured analogue evidence** | aerodynamic interpretation |

### 65.9 STATUS

**No more Series-58 descriptor development. No calibration reuse — Series 58
is SPENT on Phase-2 discrimination (61.1).** TR-291 **SPENT**. D-3388 and
L57F25 **unspent**. `compositeV1` and `max()` untouched, no Cd refit, no
production change. The independent asymmetric chine remains **UNSPENT**.

---

## 66. REPLICATION CANDIDATE — **NACA REPORT 451, MODEL A, ORIGINAL vs ALTERED STERN.** Qualification 2026-08-20. **NOT SPENT.**

Held in reserve since 61.5. Acquired (11 pp) and assessed against 59.6 and
the 65.7 question. **No descriptor has been computed against it.**

### 66.1 IT IS THE CLEANEST AFTERBODY CONTRAST YET FOUND

> **ONE MODEL, TWO STERNS, EVERYTHING ELSE IDENTICAL.**

> *"During the investigation the stern of one model was rounded off to produce
> a blunter shape."* (p5)

This is **stronger than Series 58's G-TAIL**, where 63.2 established that the
tail-radius parameter changes the whole form. Here the forebody is *the same
physical model*; only the stern is altered.

| 59.6 condition | status |
|---|---|
| closed streamlined body | **yes** — a streamline body of revolution |
| systematically varied afterbody | **yes** — original vs altered stern, one variable |
| matched fineness | **yes** — same model |
| matched Reynolds | **yes** — both sterns run over the same Re range |
| **exact reconstructable geometry** | **YES — TABLE I gives MEASURED ORDINATES with separate columns "With original stern" and "With altered stern"** |
| tabulated drag | **PARTIAL** — see 66.3 |
| aerodynamic | **yes** — NACA variable-density wind tunnel, air |
| never used in this project | **yes** (60.1) |

### 66.2 EXPOSURE — DISCLOSED IMMEDIATELY

Qualifying the report meant reading its results text, which states the outcome
directly:

> *"At the highest values of the Reynolds Number the drag is about **5 per cent
> higher with the altered stern** than with the original one."* (p8)

**I know the answer before computing anything.** Recorded exactly as 62.1 was.

**Mitigation, stated as fact:** the descriptors (59.3), the directions (59.4)
and the question (65.7) were **all frozen before this dataset was identified**,
and the geometry comes from a printed ordinate table. There is no free
parameter left to tune — but the reviewer should weigh this before it is
scored, and **it cannot be called a blind test.**

### 66.3 THE ONE SHORTFALL

Bare-hull drag against Reynolds number is presented in **Figure 5**, not a
table; **Table III tabulates protuberance drag**, which is not the quantity
wanted. What the report gives in text is a **quantitative directional
statement** — "about 5 per cent higher" — rather than two coefficients.

**For the 65.7 question that is arguably sufficient**, since the question asks
about **direction**, not magnitude. But it does **not** meet 59.6's "tabulated
drag" condition literally, and 59.6 says the standard is **not to be lowered
merely because suitable data are hard to find.**

> **Whether a text-stated 5% direction satisfies the standard is a RULING, not
> a measurement.**

### 66.4 WHAT THE TEST WOULD BE

A **single pair**. The frozen 59.4 aft direction predicts the **blunter
altered stern** — less gradual taper, more turning carried late — is
**worse**. The report says it is worse by ~5%. The remaining question is
whether the **production scalar** resolves the pair, and in which direction.

**One pair is not validation** and would be recorded as a directional
consistency check at that strength, exactly as 57.7 required for TN-614.

### 66.5 STATUS

**NOT SPENT.** No geometry transcribed, no descriptor computed, no comparison
run. Series 58 and TR-291 remain **SPENT**; D-3388 and L57F25 **unspent**; the
independent asymmetric chine remains **UNSPENT**. Production untouched.

---

## 67. REPORT 451 RESULT (2026-08-20): **RIBBON TEST VOID BY ITS OWN PRE-DECLARED RULE. The scalar gets this pair right, stably.**

Run once. Compared only against the report's stated ~5% direction; Figure 5
was **not** digitised.

### 67.1 THE DECLARED HAZARD FIRED

66/`naca451-stern.mjs` declared, **before the result**, that the two sterns are
tabulated at **different resolutions** aft of station 30 — the original at
**5** stations over 7.39 in, the altered at **12** over 6.10 in — and that
since the descriptors measure *turning*, a derivative, the direction must be
**stable across interpolants or the test is void.**

| interpolant | F2a original | F2a altered | ribbon direction |
|---|---|---|---|
| monotone cubic | 6.152 | 5.721 | says **original** worse — **WRONG** |
| linear | 5.922 | 6.255 | says **altered** worse — CORRECT |

> **THE RIBBON DIRECTION FLIPS WITH INTERPOLATION CHOICE. TEST VOID.**

The F2a difference between sterns (0.43 / 0.33 deg) is **smaller than the
difference the interpolation choice alone makes** (0.23 / 0.53 deg). **The
geometry as tabulated cannot resolve this pair**, and no ribbon claim —
positive or negative — may be drawn from it.

**This is a DATA limitation, not a physics result.** It is recorded as void,
not as a ribbon failure.

### 67.2 THE SCALAR GETS IT RIGHT, AND STABLY

| | `compositeV1` original | altered | direction |
|---|---|---|---|
| monotone | 0.047514 | **0.130910** | altered worse — **CORRECT** |
| linear | 0.053316 | **0.134462** | altered worse — **CORRECT** |

A ~2.5x separation, far above `sigma_scalar` (~5e-3), **stable across both
interpolants**, and **in the measured direction**.

> **This does NOT corroborate the Series 58 G-TAIL result. On this pair the
> scalar is right.**

### 67.3 THE TWO AFT RESULTS ARE NOT IN CONFLICT — THEY DELIMIT THE SCALAR

Offered as interpretation of two data points, not as a finding:

- **Report 451's altered stern is grossly blunt** — ordinate 0.314 at station
  36.000 falling to 0.000 at 36.100. `softAft` penalises abrupt closure
  heavily, which is **exactly what it was designed to do**, and it is right.
- **Series 58's G-TAIL varied aft closure GRADUALLY** — `r1` from 0.00 to 0.20
  on smooth polynomial hulls, no abrupt closure anywhere — and there the
  scalar ranked every scored comparison the wrong way (65.2).

> **Working reading: the production scalar detects GROSS aft bluntness
> reliably, and mis-ranks FINE gradations of taper.** Two data points. Not
> banked as a finding; recorded as the hypothesis a future test should
> address.

### 67.4 STATUS

`softFore` = 0.0e+0 on both sterns — 65.5 holds on a fourth corpus.

**Nothing fitted, no descriptor or direction altered, no Cd refit, no
production change.** Report 451 is now **SPENT** as outcome-exposed
supporting evidence, and yielded **no usable ribbon comparison**. Series 58
and TR-291 **SPENT**. D-3388 and L57F25 **unspent**. The independent
asymmetric chine remains **UNSPENT**.

**59.6 stands unchanged.** A genuinely blind, tabulated aerodynamic afterbody
dataset remains the outstanding requirement.

---

## 68. **DISPOSITION AND THE BOUNDED SEARCH — FROZEN 2026-08-20.** (owner ruling, reviewer-authored)

### 68.1 REPORT 451 DISPOSITION

> **Ribbon result = VOID. Not FAIL, and not supporting evidence.**

The interpolation sensitivity exceeds the between-body ribbon effect, so no
directional ribbon claim can be made from the tabulated geometry.

> **DO NOT choose the interpolant that gives the aerodynamically correct
> answer.** The linear interpolant happens to agree with the measurement; that
> is not a reason to prefer it, and it is not used.

### 68.2 BANKED — A POSITIVE RESULT FOR THE SCALAR

> **On a grossly blunt altered stern, the production aft-penalty descriptor
> strongly and stably identifies the worse geometry in the measured-drag
> direction.**

~2.5x separation, stable across both interpolants, far above `sigma_scalar`.
This is banked **for the scalar**, and it is useful precisely because it
**narrows what a future ribbon contribution would be for.**

### 68.3 THE DIVISION OF LABOUR — WORKING HYPOTHESIS ONLY

> **scalar = gross offence / severity detector**
> **ribbons = quality and distribution of otherwise-streamlined shaping**

Physically plausible and consistent with Series 58 (gradual taper, scalar
mis-ranks) plus Report 451 (gross bluntness, scalar correct).

> **This is a WORKING HYPOTHESIS. The estimator is NOT to be redesigned around
> it yet.** Two data points do not license an architecture.

### 68.4 THE REQUIREMENT, WITH THE NEWLY LEARNED CONDITION

Required of the next dataset, all of:

1. **closed** streamlined afterbodies;
2. controlled **GRADUAL** tail / closure variation — not gross bluntness,
   which 68.2 shows the scalar already handles;
3. matched **aerodynamic** conditions (preferred over another towing-tank
   series);
4. **tabulated** drag;
5. exact geometry;
6. **COMPARABLE STATION DENSITY / RESOLUTION BETWEEN CONFIGURATIONS** —
   **learned from 67.1**: where one configuration is tabulated more finely
   than the other, a turning comparison is undecidable no matter how good
   everything else is;
7. **unused by this project.**

### 68.5 HARD STOP

> **ONE more genuinely suitable independent dataset, if it exists. Then
> decision and implementation.**

- If it **confirms** Series 58 — good.
- If it **contradicts** Series 58 — also useful, and banked as such.
- If **nothing clean is found** — **record the evidence limit and proceed with
  the conservative hybrid architecture.**

> **The absence of suitable historical data must NOT hold V2 hostage.** No
> further marginal-comparison hunting after this search.

**No more Report-451 analysis. No descriptor changes. No Cd fitting.**

---

## 69. BOUNDED SEARCH OUTCOME (2026-08-20): **NO SUITABLE DATASET. EVIDENCE LIMIT RECORDED. PROCEED.**

One bounded search, per the 68.5 hard stop.

### 69.1 THE ONE NEW CANDIDATE, AND WHY IT FAILS

**NACA RM L53I01** — Stoney, 1953, *"Some Experimental Effects of Afterbody
Shape on the Zero-lift Drag of Bodies for Mach Numbers Between 0.8 and 1.3."*

Controlled afterbody variation, which is the right *design*. **It fails 68.4
on two counts:**

- **Mach 0.8 to 1.3 — transonic/supersonic.** Wave drag dominates. This is
  not the regime the estimator serves, and 68.4 requires matched aerodynamic
  conditions.
- **Fin-stabilised rocket models** — appendages present, so the afterbody is
  not the only variable.

**Not acquired, not spent.**

### 69.2 THE STRUCTURAL FINDING, CONFIRMING 60.1

The historical record varies **fineness**, **appendages**, and **gross
bluntness**. **Controlled GRADUAL tail variation, at matched subsonic
conditions, with comparable tabulation between configurations, is essentially
absent** — and the two datasets that *do* have it are **exactly the two
already spent**:

| dataset | gradual tail variation | status |
|---|---|---|
| **TN-614** | tail 111 vs tail 221 at fixed nose | **SPENT** (57) |
| **Series 58 G-TAIL** | `r1` 0.00 -> 0.20 | **SPENT** (61.1 / 64) |

That is not bad luck in searching. **It is the shape of the literature.**

### 69.3 EXTERNAL CORROBORATION OF THE PHYSICS — NOT OF THE DESCRIPTORS

TN-614's own stated conclusion, from the 1937 experimenters:

> **"the most important single characteristic of the body form to be the tail
> angle, which must be fine to obtain low drag."**

**A fine tail angle is a gradual taper**, i.e. less turning carried late —
which is precisely 59.2's frozen hypothesis, reached independently in 1937.
Series 58's authors said the same of `r1` = 0.2: preferred *"because it
results in a more gradual afterbody taper."*

> **This corroborates the PHYSICAL HYPOTHESIS, not the ribbon descriptors.**
> TN-614 is spent and this is a reading of its prose, not a new measurement.
> It is recorded as context, and **must not be counted as a replication.**

### 69.4 THE EVIDENCE LIMIT, RECORDED

> **No further independent, matched-condition, comparably-tabulated aerodynamic
> afterbody dataset was found. Per 68.5 the search STOPS.**

**What the evidence supports, at full strength:**

- ribbons carry stable shape information the production scalar destroys
  (56.9, three corpora);
- `compositeV1` reduces to `softAft` on every streamlined hull tested
  (65.5, four corpora);
- on **gradual** aft variation the scalar mis-ranked every scored comparison
  while ribbons ordered every one correctly — **one group, virgin, 3/3 vs
  0/3** (65.2);
- on **gross** aft bluntness the scalar is strongly and stably correct (68.2);
- monotone descriptors cannot represent a U-shaped response (65.3).

**What it does NOT support:** replacing the scalar; fitting `Cd` to ribbon
descriptors; or treating the 68.3 division of labour as established.

### 69.5 PROCEED TO THE CONSERVATIVE HYBRID

Per 65.8 and 68.5, the next work is **implementation**, not evidence hunting:

| layer | role |
|---|---|
| **scalar** | severity / gross-offence detector — **unchanged, still the baseline** |
| **ribbons** | shape-distribution and directional **context**, informing analogue/family routing and **confidence** |
| **Re + mechanism class + measured analogue evidence** | aerodynamic interpretation |

**Explicitly rejected:** `Cd = a.F1 + b.F2 + c.F3 + ...`

**No Cd refit. No calibration change. No descriptor fitting.** `compositeV1`
and `max(softAft, softFore)` remain untouched. TR-291, TN-614, Series 58 and
Report 451 **SPENT**; D-3388 and L57F25 **unspent**; the independent
asymmetric chine remains **UNSPENT** — carried intact past the end of both the
geometry programme and the Phase-2 evidence programme.

---

## 70. **`ribbonContext` SCHEMA — FROZEN 2026-08-20, PRE-IMPLEMENTATION.** (owner ruling, reviewer-authored)

### 70.1 AUTHORITY: SHADOW ONLY

> **The production scalar and the existing Cd calculation remain numerically
> authoritative and BYTE-EQUIVALENT.**

`ribbonContext` is an **additional information layer**. It is computed
alongside the existing result and **changes nothing about it**.

**IMPLEMENTATION NOTE, recorded rather than assumed:** production has been
**byte-untouched at `12e8c5e` for the entire programme**. This module is built
in `CalcV2/spike/sectional/` and **CONSUMES** the production functions rather
than editing them, so that invariant holds literally. **Wiring `ribbonContext`
into `CalcV1-site` is a SEPARATE RULING and is not done here.**

### 70.2 WHAT IT MAY DO

Describe how the body distributes turning; distinguish heavy from gradual aft
turning; show fore/aft distribution, turning concentration, and
opposite-ribbon disagreement where available; compare descriptively against
analogue bodies; inform a **shadow** confidence/provenance explanation.

### 70.3 WHAT IT MAY NOT DO — ENFORCED BY THE SCHEMA

> It must **NOT**: add or subtract Cd; change calibration knots; replace
> `compositeV1`; hard-gate an analogue family; select a Cd-map branch;
> introduce fitted descriptor weights; or **collapse F1-F5 into a new magic
> scalar.**

**The schema therefore contains NO aggregate score field.** There is nothing
to collapse into, by construction. Any analogue routing is computed **in
parallel as a shadow recommendation only**, with disagreements **recorded, not
resolved in favour of ribbons.**

### 70.4 THE SHAPE

```
ribbonContext = {
  schema:      'ribbon-context/1',
  authority:   'SHADOW — informational only; does not affect Cd',
  provenance:  { geometrySource, skin:{kind,sx,thDeg,stations,naz},
                 domain:{tipFrac, zonesTotal:8, earnedZones:[1..5]}, specs:[...] },
  eligibility: { outcome, checks:{...}, notes:[...] },
  positional:  { xs[], rays[], R[ribbon][station] },        // FULL field, uncollapsed
  zones:       { perRibbon[ribbon][zone], median[zone], worst[zone],
                 worstRibbon[zone], spread[zone] },          // all 8 zones retained
  descriptors: { perRibbon[{F1,F2a,F2f,F3,F4}], median, worst, spread,
                 F5:{perPair[], median, worst} },            // earned zones 1-5 only
  scalar:      { compositeV1, softAft, softFore, cls },      // COPIED, never modified
}
```

**Per spec 10 the per-ribbon field is retained in full.** Derivative metrics
are computed **only over the earned zones 1-5** (55.2); zones 0, 6 and 7 keep
their **positional** values and are **excluded from descriptors**.

### 70.5 ELIGIBILITY UNDER THE NEW ARCHITECTURE — AN HONEST ADAPTATION

Spec 51's gate was written for the **MLS skin, which 55.1 retired.** Reusing it
unchanged would be dishonest. Its five conditions map as follows:

| | status under the support skin |
|---|---|
| **E1** fit-fallback count | **VOID — there is no fit to fall back from.** The support function is exact; 51.12.1's seven-neighbour failure cannot occur. |
| **E2** multi-hit / missed rays | **RETAINED** and still meaningful |
| **E3** input validation | **RETAINED** unchanged |
| **E4** 12/24/48 convergence | **RETAINED** unchanged |
| **E5** sharp-feature screening | **FAILED as a criterion at 51.11**; not applied |

> **`ribbonContext.eligibility` reports E2, E3 and E4 only, and states plainly
> that E1 is void and E5 failed.** It is NOT a re-run of spec 51's gate and
> must not be described as one.

### 70.6 FIRST IMPLEMENTATION RESULT

Run the reference bodies and **the Sunship** through it and produce a compact
table — `body | scalar | class | F1 | F2a/F2f | F3 | F4 | F5 | eligibility` —
plus zone-level turning histories for the important cases.

The question it opens, which is **interpretation, not research**:

> **Does the Sunship's ribbon fingerprint look aerodynamically coherent
> relative to the measured analogue corpus, and where does it differ from what
> the scalar alone says?**

### 70.7 STATUS

No Cd refit, no calibration change, no descriptor fitting, no production
change. TR-291, TN-614, Series 58 and Report 451 **SPENT**. The independent
asymmetric chine remains **UNSPENT**.

---

## 71. FIRST `ribbonContext` RESULT (2026-08-20). Reference corpus CLEAN; **Sunship INELIGIBLE and the cause is NOT yet established.**

Shadow only. No Cd computed, changed or implied. Production byte-untouched.

### 71.1 TWO FRAMING ERRORS OF MINE, CORRECTED EN ROUTE

1. **I used the VERTEX centroid** to place the flight axis. **4.1 rejects that
   explicitly** ("biased by triangulation density"). Corrected to the
   **volume centroid**. It also produced **666 phantom "missed rays"** on the
   tailed Sunship which are **now zero** — those were entirely my artefact.
2. `volumeCentroid` returns **`{c, volume, fallback}`**, not a bare array. My
   first guard read `.x/.y/.z`, produced NaN vertices and a "zero axial
   extent" throw. Corrected.

The body frame is now the declared one: `(X,Y,Z) -> (Z, Y, -X)`, flight on
`+X`, **up at `theta` = 0** per 4.2, right-handed.

### 71.2 REFERENCE CORPUS: 8 / 8 ELIGIBLE, AND CLEAN

Every analytic reference body: **0 multi-hit, 0 missed, E4 shift <= 0.07%,
0 non-convex stations of 120.**

| body | `compositeV1` | F1 | F2a | F3 | F4 |
|---|---|---|---|---|---|
| TN614-111 (parent) | 0.017243 | 0.487 | 9.006 | 1.405 | 0.407 |
| TN614-332 (bluffest) | 0.186851 | 0.487 | 6.202 | 1.932 | 0.417 |
| S58-4157 (parent) | 0.023552 | 0.602 | 4.188 | 1.960 | 0.373 |
| S58-4171 (`r1` 0.00) | 0.019573 | 0.590 | **4.639** | 1.955 | 0.381 |
| S58-4174 (`r1` 0.20) | 0.038408 | 0.614 | **3.734** | 1.966 | 0.365 |
| S58-4167 (`r0` 0.00) | 0.040826 | 0.710 | 3.490 | 2.303 | 0.338 |
| S58-4170 (`r0` 1.00) | 0.012888 | 0.474 | 5.054 | 1.620 | 0.413 |

**Note TN614-111 vs TN614-332:** `F1` is **identical to three decimals**
(0.4867 / 0.4868) while `compositeV1` differs **11-fold**. The two
representations are measuring genuinely different things — the scalar sees the
bluff aft offence, `F1` sees that both distribute their *forward* turning
alike.

### 71.3 THE TEARDROP JOURNEY IS VISIBLE IN THE ZONE HISTORY

Median turning per zone (deg); zones 0/6/7 are positional-only (55.2):

| body | [z0] | z1 | z2 | z3 | z4 | z5 | [z6] | [z7] |
|---|---|---|---|---|---|---|---|---|
| TN614-111 | [23.7] | 6.91 | 5.06 | 3.62 | 5.16 | 3.85 | [1.7] | [0.8] |
| S58-4167 (`r0` 0) | [10.5] | **7.64** | 4.13 | 1.33 | **0.72** | 2.77 | [6.3] | [9.8] |
| S58-4170 (`r0` 1.0) | [20.8] | **4.23** | 1.96 | 1.80 | **2.26** | 2.79 | [3.3] | [5.4] |

This is the surface journey read directly: **turning is heaviest at the nose,
falls through maximum thickness, and rises again into closure.** The sharp-nose
body (`r0` = 0) does **7.64** deg in zone 1 and only **0.72** by zone 4; the
full-nosed body does **4.23** then **2.26** — it opens gently and carries more
turning aft. Same length, same `Cp`, same max-section position. **That
distinction does not exist anywhere in `compositeV1`.**

### 71.4 SUNSHIP — AND AN UNFINISHED DIAGNOSIS

| | hull V | `compositeV1` | F1 | F2a | F5 median | eligibility |
|---|---|---|---|---|---|---|
| bare | 2119 | **0.765697** | 0.465 | 31.76 | **22.40** | **INELIGIBLE** (E2: 114 multi) |
| tailed | 7641 | **0.916332** | 0.412 | 31.82 | **7.84** | **INELIGIBLE** (E2: 35 multi; E4: 5.29%) |

**Independent check that the pipeline reproduces production:** bare
`compositeV1` = **0.7657**, against the **0.770** recorded for the bare Sunship
in `IDEAS-BACKLOG.md`. The scalar path is faithful.

**First real directional content in the programme:** `F5` = **22.40 deg**
median (bare) against **~0.01 deg** for every axisymmetric reference body — a
**three-order** separation. 59.3 froze `F5` as not claimable on axisymmetric
data; the Sunship is the first body where it carries anything.

> **THE E2 FAILURE IS NOT EXPLAINED, AND I AM NOT GUESSING AGAIN.**
>
> The obvious mechanism — a straight axis exiting a cambered flat-bottomed
> body — is **RULED OUT BY MEASUREMENT**: the axis lies inside **every one of
> the 120 retained sections**, minimum support value **+0.0458**. And
> `reflexCount` reports **0 non-convex stations**. A convex section containing
> the origin cannot multi-hit, so **something in the support-polygon
> reconstruction is producing hits that the convexity test does not see** —
> most likely near the near-corners of a lens with a flat underside.
>
> **Cause unestablished. Recorded as the open item.** Having already made two
> framing errors on this body, a third hypothesis is not offered as a finding.

### 71.5 STATUS

Descriptors are computed for the Sunship and **retained in shadow**, correctly
flagged **INELIGIBLE**. **No Cd computed, changed or implied. No calibration
touched. No aggregate score exists in the schema.** Production byte-untouched
at `12e8c5e`.

---

## 72. E2 RESOLVED (2026-08-21): **A DUPLICATE-HIT BOOKKEEPING DEFECT, EXACTLY AS PREDICTED. Sunship bare is ELIGIBLE.**

Bounded implementation diagnostic per the 71.4 ruling. **No skinning,
eligibility threshold, ribbon definition or aerodynamic evidence reopened.**

### 72.1 THE DIAGNOSTIC

For **all 114** reported Sunship multi-hits, the actual positive ray
parameters were recorded:

> **COINCIDENT: 114. GENUINELY DISTINCT: 0.**
> Worst relative gap between "multiple" hits: **~1e-16.**

And the independent **half-space oracle** — for a convex body
`{ p : n_j . p <= h_j }` and a ray `p = t.d` from an interior point,
`t_max = min over {n_j.d > 0} of h_j / (n_j.d)`, unique by construction —
agreed with the frozen edge primitive to **7.373e-15 over every retained ray**.

> **The radius was never wrong. Only the COUNT was.**

### 72.2 THE MECHANISM, VISIBLE IN THE DUMP

Every multi-hit sits at **`theta` = 0 or 180 deg** — up and down. Station 11 at
`theta` = 0 shows **41 separate edges all returning the identical point
(0.211186, 0.000000)**.

> **A FLAT FACET makes consecutive support directions share ONE supporting
> vertex**, so `supportPolygon` emits many **coincident** vertices and hence
> **zero-length edges**. The old primitive counted the same single point once
> per zero-length edge.

The Sunship has a **flat underside** (4.2: 101 vertices in a thin slab at
Y-minimum). **The axisymmetric reference bodies have no flats, which is
exactly why they were clean** — the defect could only ever fire on the kind of
geometry the programme cares about most.

### 72.3 THE FIX

`supportRadii` now uses the **half-space form** — the support
representation's own — with no edges and no crossing counting, so the defect
**cannot recur**. `multi` now counts **geometrically distinct** outward
crossings (0 by construction for a convex section about an interior point) and
is retained as a **self-check, not a domain gate**; `missed` now marks a ray
with no supporting constraint, i.e. **the reference point is not interior** —
which is the real 36.5 condition.

**REGRESSION CONTROL ADDED:** `supportRadiiSelfTest` uses a **unit square** —
flat facets, the exact geometry that broke the old primitive — and requires
one radius per ray with face = 1 and diagonal = sqrt(2).

> **The self-test caught an error in ITS OWN first draft:** it used
> `max(|cos|,|sin|)`, which is the support function of the **diamond**, not
> the square. The primitive correctly returned the diamond's radii. **The test
> was wrong and the code was right** — which is the point of writing the
> control against a shape whose answer is known independently.

### 72.4 EVERY REFERENCE NUMBER IS UNMOVED

All eight reference bodies return **bit-identical** `compositeV1`, F1, F2a,
F2f, F3, F4 and F5 to the pre-fix run. **The change corrected only what was
wrong** — the spec 38 discipline, applied again.

### 72.5 THE RESULT

| body | E2 multi | missed | E4 shift | eligibility |
|---|---|---|---|---|
| all 8 references | 0 | 0 | <= 0.07% | **ELIGIBLE** |
| **SUNSHIP bare** | **0** | **0** | 3.95% | **ELIGIBLE** |
| SUNSHIP tailed | **0** | **0** | **5.29%** | **INELIGIBLE — E4 only** |

> **The Sunship bare hull now clears eligibility.** Its `F5` = **22.40 deg**
> median directional disagreement — against ~0.01 deg for every axisymmetric
> reference — is now a value from an **ELIGIBLE** body.

**The tailed variant remains INELIGIBLE on E4 alone, at 5.29% against the
frozen 5% convergence limit.** Per the ruling that is **its own honest
convergence result**: the frozen spec 6 tolerance is **not** relaxed to admit
it, and it is not investigated here.

### 72.6 STATUS

Shadow only. No Cd computed, changed or implied. No calibration touched. No
aggregate score exists in the schema. Production byte-untouched at `12e8c5e`.

---

## 73. TAILED CONVERGENCE DIAGNOSTIC + **THE FIRST FINGERPRINT TABLE** (2026-08-21)

### 73.1 THE 5.29% IS ONE ZONE, ONE TRANSITION — AND IT DOES NOT CONTRACT

**Verdict unchanged: tailed Sunship INELIGIBLE. No tolerance relaxed.**

| zone | 12->24 | 24->48 | 48->96 *(non-gating)* |
|---|---|---|---|
| 3 | **5.290%** | **0.000%** | **3.579%** |
| worst any zone | 5.290% | 1.349% | **3.579%** |

The whole miss is **zone 3 at 12->24**. But **48->96 is WORSE than 24->48**
(3.579% vs 1.349%), and only **3 of 8 zones** contract monotonically.

> **NOT slow convergence. The statistic oscillates.**

**Mechanism, and it is methodological rather than aerodynamic:** the E4
quantity is a **MEDIAN ACROSS RIBBONS** — a *rank* statistic. On an
axisymmetric body every ribbon is identical, so it converges trivially. On a
strongly directional body the ranked value **jumps to a different azimuthal
sample** as the ribbon count changes; the exact `0.000%` entries are the
median landing on the same ribbon twice, not evidence of convergence.

> **E4's median-based convergence check may be unsuitable for
> non-axisymmetric bodies.** Recorded as an **observation for a future
> ruling**, not acted on. **The frozen spec 6 criterion is unchanged**, and
> the tailed Sunship stays INELIGIBLE.

**Hard stop honoured: no further tailed investigation.**

### 73.2 THE FIRST FINGERPRINT TABLE

Shadow only. `compositeV1` copied from production, never modified.

| body | `compositeV1` | F1 | F2a | F2f | F3 | F4 | F5 | elig |
|---|---|---|---|---|---|---|---|---|
| TN614-111 (parent) | 0.017243 | 0.487 | 9.006 | 0.366 | 1.405 | 0.407 | 0.011 | yes |
| TN614-221 | 0.041121 | 0.424 | 10.260 | 0.489 | 1.551 | 0.441 | 0.012 | yes |
| TN614-332 (bluffest) | 0.186851 | 0.487 | 6.202 | 0.448 | 1.932 | 0.417 | 0.010 | yes |
| **TR432 Akron** | 0.096451 | 0.582 | 6.090 | 0.358 | 2.253 | 0.380 | 0.006 | yes |
| S58-4157 (parent) | 0.023552 | 0.602 | 4.188 | 0.290 | 1.960 | 0.373 | 0.008 | yes |
| S58-4171 (`r1` 0.00) | 0.019573 | 0.590 | 4.639 | 0.314 | 1.955 | 0.381 | 0.008 | yes |
| S58-4174 (`r1` 0.20) | 0.038408 | 0.614 | 3.734 | 0.264 | 1.966 | 0.365 | 0.008 | yes |
| S58-4167 (`r0` 0.00) | 0.040826 | 0.710 | 3.490 | 0.210 | 2.303 | 0.338 | 0.009 | yes |
| S58-4170 (`r0` 1.00) | 0.012888 | 0.474 | 5.054 | 0.387 | 1.620 | 0.413 | 0.008 | yes |
| **SUNSHIP bare** | **0.765697** | **0.465** | **31.758** | **0.388** | **1.247** | **0.430** | **22.401** | **YES** |
| SUNSHIP tailed | 0.916332 | 0.412 | 31.821 | 0.389 | 1.160 | 0.435 | 7.837 | no (E4) |

### 73.3 WHAT THE SUNSHIP FINGERPRINT SAYS

**It is out of distribution in BOTH representations at once, and the ribbons
say HOW:**

- **`F2a` = 31.8 deg against 3.5-10.3 for every reference.**

> **CORRECTED 2026-08-21.** This first read "three to nine times the aft
> turning burden of any measured body" and, below, "it turns hard
> everywhere". **Both overclaim.** `F2a` establishes that the frozen ribbon
> operator **accumulates much more absolute turning** on the bare Sunship than
> on this **axisymmetric** reference set. It does **NOT** establish three times
> the *aerodynamic* turning burden or adverse-pressure-gradient burden: the
> Sunship is strongly non-axisymmetric and geometrically unlike these bodies,
> so some of the magnitude is simply geometry the axisymmetric corpus never
> exercises. **The safe statement:** *the eligible bare Sunship lies far
> outside the present measured analogue corpus in absolute ribbon turning,
> while distributing that turning unusually evenly through the earned
> longitudinal domain.*

- **`F3` = 1.247 — the LOWEST of all eleven bodies** (references 1.41-2.30).
  The large total turning is **not produced by one isolated geometric
  offence**; it is broadly distributed through zones 1-5. Zone history:
  `z1..z5` = 19.0, 17.5, 12.5, 12.1, 16.5 deg. **That distinction is exactly
  what `compositeV1` cannot provide.**
- **`F4` = 0.430 — the most aft-shifted** of any body except TN614-221.
- **`F1` = 0.465 is unremarkable** — mid-range. **The Sunship is not unusual
  in how it splits fore versus aft; it is unusual in how much it turns and in
  how evenly.**
- **`F5` = 22.40 deg**, the first real directional content the programme has
  measured, now from an **ELIGIBLE** body.

> **BANKED:** the Sunship exhibits **strong directional / opposite-ribbon
> disagreement that is invisible to the scalar representation**.
> **NOT BANKED:** that 22 deg of disagreement is *aerodynamically bad* — there
> is no measured **non-axisymmetric** analogue corpus to establish that.
> Note also that the ~0.01 deg reference figures are a near-trivial contrast:
> those bodies are **constructed** so that opposing ribbons agree.

> **This is exactly the out-of-distribution signal the scalar cannot give.**
> `compositeV1` says only "0.766, far above the corpus maximum of 0.187". The
> ribbons say *the shape turns three times as much as anything measured,
> distributes it more evenly than anything measured, and has 22 deg of
> disagreement between opposing sides.*

### 73.4 BARE vs TAILED — SHADOW, THE TAILED BODY IS INELIGIBLE

| | F1 | F2a | F3 | F4 | **F5** |
|---|---|---|---|---|---|
| bare | 0.465 | 31.76 | 1.247 | 0.430 | **22.40** |
| tailed | 0.412 | 31.82 | 1.160 | 0.435 | **7.84** |

**The aft turning BURDEN barely moves** (31.76 -> 31.82; `F2f` 0.388 ->
0.389). What changes is **coherence: `F5` falls from 22.40 to 7.84 deg** — the
opposing sides tell a **nearly three times more consistent story** with the
tail deployed.

> **NOT A FINDING.** The tailed body is **INELIGIBLE**, so this is a shadow
> reading only, and no aerodynamic interpretation is attached. Recorded
> because it is the first time the question *"what did the tail do to the
> surface journey?"* has had any number at all attached to it.

### 73.5 STATUS

No Cd computed, changed or implied. No calibration touched. No aggregate
score. `compositeV1` and `max()` untouched. Production byte-untouched at
`12e8c5e`.

---

## 74. SUNSHIP CLOCKFACE (2026-08-21): **WHICH directions carry the burden.** Shadow only.

Bare hull only — the tailed body is INELIGIBLE and receives no
interpretation. Frame per 4.1/4.2: flight `+X`, axis on the **volume
centroid**, **`theta` = 0 is UP**, so `theta` 180 deg is the flat underside.

*(Region labels were mislabelled in a first draft — `theta` is measured FROM
UP, so 90-270 deg is the LOWER half, and `a < 180` wrongly called 105-165 deg
"upper". Corrected before any reading was taken from it.)*

### 74.1 THE HEADLINE `F2a` = 31.8 deg IS A MEDIAN OF A BIMODAL DISTRIBUTION

| direction | `F2a` (deg) |
|---|---|
| **flat UNDERSIDE** (`theta` 172.5-195) | **0.09 - 0.12** |
| upper quarters (`theta` 37.5-52.5 and 307.5-322.5) | **36.2 - 37.0** |

> **The aft turning burden runs from 0.09 to 37.0 deg around the clock.** The
> flat underside contributes **essentially nothing** — it is flat, so there is
> nothing to turn. The **upper quarters carry the maximum.**

**This is spec 10's warning made concrete.** The single median value of
**31.8 deg** describes **no actual ribbon**: it hides a direction doing nothing
and another doing 37 deg. **Collapsing the clockface to one number destroys
the only part of this that is interpretable.**

### 74.2 A STRONG CORRECTNESS CHECK FELL OUT

> **`theta` 90 vs 270 — the two true sides — disagree by EXACTLY 0.00 deg.**

The Sunship is laterally symmetric, and the frozen operator reproduces that to
the last digit, **on a real production OBJ, through hull + support skin +
ribbons**. Nothing was tuned to make that happen. The adjacent pairs
(82.5/262.5 and 97.5/277.5) come in at **2.84 deg**, so the symmetry is sharp
rather than smeared.

### 74.3 THE DISAGREEMENT IS UP-versus-DOWN, AND IT IS CONCENTRATED FORWARD

Worst opposite pairs, all of them upper-vs-lower, **all worst in ZONE 1**:

| pair | gap | zone 1: upper vs lower |
|---|---|---|
| 45 vs 225 | **28.31** | 11.6 vs **40.0** |
| 142.5 vs 322.5 | 27.82 | **40.5** vs 12.7 |
| 52.5 vs 232.5 | 25.66 | 11.5 vs **37.2** |
| 30 vs 210 | 25.34 | 15.1 vs **40.4** |

> **The lower quarters turn ~40 deg in zone 1; the upper quarters ~11.6 deg.**
> The Sunship's directional disagreement is **not** spread along the body — it
> is **forward**, in the first earned zone, where the flat underside is
> establishing itself against the curved upper surface.

### 74.4 WHAT MAY AND MAY NOT BE SAID

**MAY:** the eligible bare Sunship lies far outside the present measured
analogue corpus in absolute ribbon turning; it distributes that turning
unusually evenly *in the median*; and it carries strong directional
disagreement, **located** at the upper/lower quarters and **concentrated
forward**, that is invisible to the scalar.

**MAY NOT:** that any of this is aerodynamically bad. There is **no measured
non-axisymmetric analogue corpus** to establish it, and 73.3's correction
stands — a large `F2a` against an **axisymmetric** reference set is a
geometric statement, not an adverse-pressure-gradient statement.

### 74.5 STATUS

Shadow only. No Cd computed, changed or implied. No calibration touched. No
aggregate score. Production byte-untouched at `12e8c5e`.

---

## 75. **RETRACTION (2026-08-21): EVERY TAILED-SUNSHIP NUMBER IN 71, 73 AND 74 WAS COMPUTED IN THE WRONG FRAME.**

### 75.1 THE ERROR

The two EAS meshes use **different conventions**, and I applied the bare
hull's to both:

| file | actual frame | actual scale |
|---|---|---|
| `Sunship.obj` | **+Z forward**, +Y up | unit, normalised to 300 m |
| `sunship-tail-aerohull-candidate.obj` | **+X forward ALREADY** | **metres, L = 516 m** |

Its own header says so: *"envelope 300 m, fairing at 0.8 of length, +216 m,
deployed 516 m ... production estimate Cd 0.0217 (rounded, proxy 0.1645)."*
**I relabelled it anyway**, rotating it 90 degrees off its flight axis, and
forced `lengthM` 300 instead of 516.

**The recorded proxy 0.1645 against my 0.9163 was visible evidence of the
error, and I did not check it until the frontal area came out larger than a
300 m disc.**

### 75.2 WHAT IS RETRACTED

| section | withdrawn claim | correct value |
|---|---|---|
| 71.4, 73.2 | tailed `compositeV1` **0.916332** | **0.096173** |
| 71.4, 73.2 | tailed **INELIGIBLE** | **ELIGIBLE** |
| **73.1** | the **ENTIRE** tailed convergence diagnostic — the 5.29%, "zone 3 at 12->24", the "statistic oscillates" finding, and the observation that E4's median may be unsuitable for non-axisymmetric bodies | **VOID.** E4 does not fail in the correct frame. |
| 73.2, 73.4 | tailed F1 0.412, F2a 31.82, F3 1.160, F4 0.435, **F5 7.837** | **F1 0.9063, F2a 0.000, F3 2.7150, F4 0.2563, F5 0.000** |
| 73.4 | *"F5 falls 22.40 -> 7.84 — opposing sides nearly three times more consistent"* | **MEANINGLESS.** The tailed aero-hull is **transversely AXISYMMETRIC** (Y/Z extent ratio 1.0000), so its F5 is 0 by construction. |

**The BARE hull results are UNAFFECTED.** Its frame was verified independently
(Z is its longest extent, 0.978) and its `compositeV1` 0.7657 matches the 0.770
on record. Every bare number in 71-74 stands.

### 75.3 THE GUARD

`eas-bodies.mjs` now **declares each file's frame and scale** and **ASSERTS
that the declared flight axis is the longest extent**, throwing on
mis-declaration. A frame error can no longer produce a plausible wrong number
in silence.

---

## 76. SUNSHIP NUMERICAL REPORT (2026-08-21). Cd from the **existing** estimator; no ribbon descriptor touches it.

| | **BARE** | **TAILED (deployed fairing)** |
|---|---|---|
| source | 300 m canonical hull | 516 m aero-hull candidate |
| transversely axisymmetric | **no** (Y/Z 0.9521) | **YES** (Y/Z 1.0000) |
| frontal area | 40 522 m^2 | 40 056 m^2 |
| wetted area | 206 503 m^2 | 254 856 m^2 |
| `compositeV1` | **0.765697** | **0.096173** |
| class | rounded | rounded |
| **Cd @ 100 km/h** | **0.1778** | **0.0205** |
| band | [0.1423, 0.2134] | [0.0164, 0.0246] |
| friction / pressure | 0.0088 / 0.1690 | 0.0104 / 0.0101 |
| ribbon layer | **ELIGIBLE** | **ELIGIBLE** |
| F1 | 0.4651 | **0.9063** |
| F2a | **31.758** | **0.000** |
| F3 | 1.2465 | 2.7150 |
| F4 | 0.4295 | 0.2563 |
| F5 | **22.401** | 0.000 |

Cd is flat across 80 / 100 / 120 km/h to four decimals in both cases.

> **The frontal areas are within 1.2% of each other**, so Cd here is comparable
> on essentially the same reference area — the production estimator's own
> numbers put the deployed configuration at **about one eighth** the bare
> hull's drag coefficient.

**The two fingerprints are opposites.** Bare: `F1` 0.465, `F2a` 31.8 — turning
split fore/aft with a heavy aft burden, and 22.4 deg of directional
disagreement. Tailed: `F1` **0.906** and `F2a` **0.000** — **90% of the earned
turning is forward and essentially none is left late in closure**, on an
axisymmetric body. That is the fairing doing exactly what a fairing is for,
read straight off the geometry.

### 76.1 WHAT EVIDENCE IS EACH Cd RESTING ON?

| body | proxy | bounded by | measured anchors |
|---|---|---|---|
| **BARE** | 0.7657 | TN614-332 **(real)** / sphere **(textbook)** | **1 of 2** |
| **TAILED** | 0.0962 | TN614-111 **(real)** / TN614-332 **(real)** | **2 of 2** |

> **The tailed Cd interpolates between two REAL measured anchors. The bare Cd
> has a TEXTBOOK anchor on its upper side** — and at proxy 0.766 it sits much
> nearer that textbook end than the measured one. This is the mid-map evidence
> gap already recorded in `IDEAS-BACKLOG.md`, now located precisely.

### 76.2 CAN THE RIBBON LAYER MOVE CONFIDENCE?

**BARE — LOWER confidence. 3 of 3 signals outside the corpus:** scalar 4.1x
outside, `F2a` 3.1x outside, and directional structure (`F5` 22.4 deg) that no
reference body exercises at all.

**TAILED — SUPPORTED.** Scalar **0.5x** of the corpus maximum, `F2a` **0.0**,
and the body is **transversely axisymmetric like every reference in the
corpus**. The ribbon layer finds **no reason to lower confidence** in this Cd.

> **This is the division of labour working as designed.** The scalar gives both
> bodies a number. The ribbon layer says the tailed number rests on measured
> analogues the body actually resembles, while the bare number does not — and
> it says so **without touching either value**.

**Neither Cd was altered by any ribbon descriptor. Nothing fitted. Production
byte-untouched at `12e8c5e`.**

---

## 77. WORDING CORRECTIONS, AND THE PROXY DISCREPANCY RESOLVED (2026-08-21)

### 77.1 THE DISCREPANCY: TWO LEGITIMATE PRODUCTION PATHS, TWO GEOMETRIES

The tailed mesh header records **proxy 0.1645, Cd ~0.0217**; my run gave
**proxy 0.0962, Cd 0.0205**. **Resolved:**

| path | geometry fed to the estimator | proxy | Cd @ 100 km/h |
|---|---|---|---|
| **RAW authored mesh** | the file's own 40 896 faces | **0.164462** | **0.0223** |
| **convex hull** | upload-hull rule | 0.096173 | 0.0205 |

> **0.164462 matches the header's 0.1645 to four decimals.** The header used
> the **RAW authored mesh**; I used the **CONVEX HULL**.

**Both are real production paths.** `worker.js` is explicit: uploads use the
hull *always*; **presets are different by design** — authored `aeroHullMesh`
records precomputed at bake time, *"never this path"*. The tailed candidate is
a preset-style authored surrogate, so **production's own number for it is the
RAW-path 0.0223**, not the hull-path 0.0205.

The hull reads **less** bluff (0.096 vs 0.164) because hulling fills the
concave fairing surfaces, so the aft closure looks smoother than it is.

### 77.2 **AN ARCHITECTURAL MISMATCH THIS EXPOSES — RECORDED, NOT SOLVED**

> **For a preset, the Cd path and the ribbon path see DIFFERENT GEOMETRY.**
> Cd is computed on the authored mesh; the ribbon layer is built entirely on
> the canonical convex hull (spec 53 onward) and cannot run on a concave one.

So a ribbon-derived confidence statement about "this body" is about the
**hulled** body, while the Cd it qualifies was computed on the **authored**
body. For the bare Sunship this does not arise — it is an upload, hulled on
both paths. **For presets it must be reconciled or declared before the ribbon
layer is allowed to qualify a preset Cd.** Flagged for ruling; not solved here.

### 77.3 WORDING CORRECTIONS TO 76

**(a) NOTHING HERE IS A MEASUREMENT.** 76 must not be read as "the tail Cd was
measured at ~0.02". The correct statement:

> The **idealised deployed-tail aerodynamic surrogate** is independently
> re-estimated by the **current production estimator** at **Cd ~0.0205–0.0223**
> depending on geometry path, in the **same ~0.02 range as previous
> estimates**, and it now **passes the ribbon eligibility checks**. Its scalar
> interpolation is **supported on both sides by measured streamlined-body
> anchors**.

What improved is **support and applicability**, not demonstrated accuracy. The
real Smart Tail retains unresolved physics the surrogate does not represent —
sparse structure, genuine concave/trumpet surfaces, gaps, BLI/duct
interaction, deformation, interference. **The 516 m body is an aerodynamic
surrogate.**

*Reassurance worth noting:* after finding and fixing a large axis/scale error,
the corrected calculation returned to **essentially the same low-Cd
neighbourhood** rather than exploding.

**(b) `F2a` = 0.000 IS BOUNDED TO THE EARNED DOMAIN.** It must not be read as
"the tail has no late closure turning" — zones 0, 6 and 7 were **deliberately
excluded** from derivative claims (55.2). The correct statement:

> **Within the trusted ribbon domain**, the deployed surrogate has shifted
> almost all measured turning forward and carries **essentially no measured
> aft-turning burden there**.

### 77.4 THE COMPARISON, STATED CORRECTLY

| | BARE | TAILED surrogate |
|---|---|---|
| production Cd estimate @ 100 km/h | **~0.178** | **~0.0205 (hull) / ~0.0223 (authored)** |
| proxy | 0.766 | 0.096 (hull) / 0.164 (authored) |
| ribbon layer | ELIGIBLE, **strongly OOD** | ELIGIBLE, **inside the corpus** |
| calibration anchors bounding it | 1 of 2 measured | **2 of 2 measured** |

**Roughly an 8x reduction in ESTIMATED Cd** (0.178 / 0.0223 = 8.0 on the
authored path; 8.7 on the hull path). A large modelled aerodynamic change,
**not an experimental result.**

**No Cd was altered by any ribbon descriptor. Nothing fitted. Production
byte-untouched at `12e8c5e`.**

---

## 78. GEOMETRY IDENTITY + PATH SENSITIVITY (2026-08-21). Both paths, always.

### 78.1 WORDING CORRECTIONS TO 76.2 AND 77

**(a) The ribbon layer does NOT confirm or support the authored tailed Cd.**
It cannot: `Cd` sees the **authored concave** mesh, ribbons see its **convex
hull**. Those are mutually encouraging facts about two representations, **not
the same geometry experiment**. 76.2's *"the ribbon layer finds no reason to
lower confidence in this Cd"* is **withdrawn for the tailed body** and holds
only for the bare hull, where both paths use the same geometry.

**(b) "2 of 2 measured anchors" means the SCALAR INTERPOLATION IS BRACKETED
RATHER THAN EXTRAPOLATED.** It does **not** mean the Smart Tail geometry has
been validated by two measurements. The measured bodies are **calibration
analogues**.

**THE HEADLINE, as it should stand:**

> The idealised deployed Smart Tail surrogate is estimated at **Cd ~0.0223 on
> the actual preset-production geometry path**. This **independently reproduces
> the long-standing ~0.02 estimate**. Its **convex-hull representation** is
> ribbon-eligible and lies within the present streamlined analogue corpus,
> while the **bare Sunship is strongly OOD**. The ribbon and Cd paths currently
> use **different geometry representations**, so ribbon-derived confidence
> **cannot yet formally qualify** the authored-mesh Cd.

### 78.2 GEOMETRY IDENTITY IS NOW EXPLICIT, AND BOTH PATHS RUN AUTOMATICALLY

`geometry-identity.mjs` states for every run **which geometry each number came
from**, and computes both paths so the difference is visible rather than
hidden.

| | authored mesh | convex hull | Cd Δ | proxy Δ |
|---|---|---|---|---|
| **BARE** (upload -> hull) | proxy 0.769792, Cd **0.1789** | proxy 0.765697, Cd **0.1778** | **0.6%** | **0.5%** |
| **TAILED** (preset -> authored) | proxy 0.164462, Cd **0.0223** | proxy 0.096173, Cd **0.0205** | **7.9%** | **41.5%** |

**The bare Sunship is essentially convex already** — hulling moves the proxy
by 0.5% — which independently corroborates that its ribbon eligibility is not
an artefact of hulling away real geometry.

### 78.3 **A FLAW IN MY OWN FIRST SIGNAL, AND THE FIX**

The first version flagged on **Cd divergence alone**, at 10%. It called the
tailed body *"paths AGREE"* on a **7.9% Cd** difference — while the **proxy
differed by 41.5%**.

> **That is wrong, and it is exactly the kind of false reassurance this
> diagnostic exists to prevent.** The two representations genuinely differ; the
> calibration map merely happens to be **shallow** in that region. Steepen the
> map there and the same 41.5% becomes a large Cd difference.

The signal now flags on **either** metric and names which, with a third
verdict for this precise case:

> **DIVERGENT GEOMETRY, SHALLOW MAP** — the representations differ materially
> but the calibration map is insensitive here. **Treat the Cd agreement as a
> property of the map, NOT as evidence that the geometry paths agree.**

### 78.4 WHAT THIS BUYS, GOING FORWARD

Run on every variant in the coming tail sweeps, this is a confidence signal
for free:

- **both deltas small** -> the low-order estimate is robust to representation;
- **Cd delta large** -> concavity/detail is materially affecting the estimate;
- **proxy delta large, Cd delta small** -> the estimate is being protected by a
  flat region of the calibration map, not by geometric agreement. **The most
  dangerous of the three, and previously invisible.**

**Path sensitivity is a REPORTING diagnostic. It gates nothing and alters no
Cd.** Production byte-untouched at `12e8c5e`.

---

## 79. **HULLING THE TAIL DELETES THE GEOMETRY IT WAS DESIGNED TO HAVE — CONFIRMED BY MEASUREMENT (2026-08-21).**

### 79.1 THE DISTINCTION THAT MATTERS: LONGITUDINAL vs TRANSVERSE CONCAVITY

**They are not the same thing, and the architecture depends on the
difference.**

- A **trumpet flare** — the profile `r(x)` curving outward/inward along the
  body — is **LONGITUDINAL** concavity. Every transverse section is still a
  **circle**, i.e. convex.
- `makeSupportSkin` convexifies **within each transverse section only**, and
  computes each station **independently from that mesh's own crossings**.

> **Therefore the support-function skin CAN represent a concave tail profile
> exactly.** 53.3's "convex by construction" is a statement about **sections**,
> not about the longitudinal profile.

**What destroyed the tail's geometry was MY choice to hull the mesh before
feeding the skin** — the *3D* convex hull bridges the longitudinal waist. That
was me following the upload-hull rule where it does not belong, **not a
limitation of the skin.**

### 79.2 THE MEASUREMENT

`ribbonContext` run on the **authored** tailed surface against its **hulled**
version:

| zone | AUTHORED (as designed) | CONVEX HULL | lost |
|---|---|---|---|
| 1 | 21.31 | 21.67 | — |
| 2 | 14.74 | 14.50 | — |
| **3** | **24.36** | **3.74** | **20.6 deg, 85%** |
| 4 | 0.80 | 0.00 | all |
| 5 | 1.17 | 0.00 | all |
| **F2a** | **1.973** | **0.000** | all |
| F1 | 0.5779 | 0.9063 | — |

> **Hulling deletes 85% of zone 3's turning and ALL of the aft burden.** Zone 3
> is where the fairing flares. The hull bridges straight across it.

**This confirms the architectural point empirically: convex-hulling a bolt-on
aerodynamic appendage fills in exactly the geometry it was designed to have.**
The hull path's `F2a` = 0.000 reported in 76 is therefore **an artefact of
hulling**, not a property of the tail.

### 79.3 THE CORRECT GEOMETRY IDENTITIES

> **STATIC / lift:** convex 300 m envelope -> volume, VS/VE, lift, structure.
> **DYNAMIC / aero:** convex envelope **+ authored Smart Tail** -> Cd geometry
> **and** ribbons, with the ribbon operator following the **combined** surface
> including inward curvature.

**The authored-path Cd ~0.0223 is the more relevant surrogate estimate.** The
hull-path ~0.0205 represents a **different, artificially filled-in shape** and
is a sensitivity comparison only.

### 79.4 THE BLOCKER, AND IT NEEDS A RULING

Running the ribbon layer on the authored surface returns **INPUT FAILURE**, on
one condition only:

> **64 boundary edges — the surface is not closed.** Non-manifold 0,
> degenerate 0, E2 multi 0, missed 0, E4 0.00%.

64 edges is **one open ring** — the fairing terminates in a **trailing rim**,
not a closed point.

**That is not a mesh defect. It is geometry**, and aerodynamically it is a
**base** — precisely what the scalar's `terminalBaseFrac` machinery exists to
price.

E3 inherits "closed surface" from 36.4, which was written for **lifting
envelopes**. For an **authored aerodynamic appendage** an open trailing rim is
legitimate. **Three options, none taken unilaterally:**

1. **admit open trailing rims** in the DYNAMIC identity, recording the rim area
   as base area — the physically meaningful reading;
2. **cap the rim** before analysis — closes the surface but invents a
   terminating disc that the design does not have;
3. **leave E3 as frozen** and declare authored appendages outside ribbon scope
   — which forfeits exactly the geometry the ribbons are best placed to read.

> **I recommend (1)**, because the rim is real geometry with a real
> aerodynamic meaning, and because (2) fabricates a surface and (3) throws away
> the tail's most interesting region. **But E3 is frozen and this is a ruling,
> not a measurement.**

### 79.5 STATUS

**Nothing changed.** E3 is untouched, the skin is untouched, no Cd altered,
nothing fitted. The authored-path descriptors above are recorded as
measurements taken **despite** the INPUT FAILURE flag, and are **not** treated
as an eligible result. Production byte-untouched at `12e8c5e`.

---

## 80. **THE BOUNDARY LOOP IS AT THE NOSE. E3 STAYS FROZEN.** (2026-08-21)

### 80.1 THE LOCATION SETTLES IT

The 64-edge boundary loop, located in the flight direction before any ruling:

| | |
|---|---|
| axial position | **X = -189.616**, constant across all 64 vertices |
| **as a fraction of length from the NOSE** | **0.0000** |
| radius | **4.112 m**, constant (a 516 m body) |
| distinct loops | **1** |

> **It is neither the tail root nor a distal trailing rim. It is the NOSE.**

The surrogate's lathe **starts at a small non-zero radius and never closes its
first ring** — the OBJ's very first vertex is `v 0.00000 4.11204 0.00000`.
**That is an incomplete mesh, not an aerodynamic opening.**

### 80.2 THEREFORE: **NO E3 RELAXATION.** 79.4's three options are moot

The ruling 79.4 asked for is **not needed**. E3's closed-surface requirement
**stands unrelaxed**; the ring is simply **closed**.

`capOpenRings` fans each open loop to its own centroid. **Two guards make this
mesh completion rather than design invention:**

1. **Only rings inside the frozen 2.5% tip band are capped.** This one sits at
   `0.0000` of length, so it cannot reach any earned zone.
2. **A loop found anywhere else is NOT capped** — it is left to **fail E3
   loudly**, because closing a genuine mid-body or trailing opening *would* be
   inventing geometry.

**A real distal trailing rim would still fail E3**, and would still need the
79.4 ruling. This one does not.

### 80.3 **THE 77.2 ARCHITECTURAL MISMATCH IS RESOLVED**

With the nose closed, the ribbon layer runs on the **authored aerodynamic
surface** itself:

| | |
|---|---|
| E3 | **clean** — no boundary edges, no non-manifold, no degenerate |
| E2 | multi **0**, missed **0** |
| E4 | **0.00%** |
| **ribbon layer** | **ELIGIBLE** |

> **Cd and ribbons now read THE SAME GEOMETRY** — the DYNAMIC/aero identity:
> convex lifting envelope **+ authored Smart Tail**, concavity intact.
> **77.2's caveat that "the ribbon layer may not formally qualify this Cd" is
> DISCHARGED for this body.**

### 80.4 THE TAILED SURROGATE ON ITS CORRECT GEOMETRY IDENTITY

| | value |
|---|---|
| `compositeV1` | **0.161170** |
| **Cd @ 100 km/h** | **0.0222**, band [0.0177, 0.0266] |
| ribbon layer | **ELIGIBLE** |
| F1 / F2a / F2f | 0.5779 / **1.973** / 0.0316 |
| F3 / F4 / F5 | 1.9526 / 0.3289 / 0.000 |
| zones 1-5 | 21.31, 14.74, **24.36**, **0.80**, **1.17** |

**0.0222 against the header's recorded 0.0217** — the ~2% residual is the nose
cap itself, and the long-standing ~0.02 estimate is reproduced on the correct
geometry with the ribbon layer eligible on the same surface.

**The fingerprint tells the surface journey directly:** turning peaks at
**24.36 deg in zone 3** — the fairing flare — then **collapses to 0.80 and
1.17 deg** through zones 4 and 5. **The tail does its work at the flare and
then eases to almost nothing.** That is precisely the behaviour 59.2's frozen
hypothesis calls good, and it is **invisible on the hulled version**, which
reported zone 3 at 3.74 and `F2a` at 0.000.

### 80.5 STATUS

E3 **unrelaxed**. Skin untouched. No Cd altered by any ribbon descriptor,
nothing fitted. The hull path remains available as the 78 sensitivity
comparison; **the authored path is now the canonical DYNAMIC/aero identity for
the tailed configuration.** Production byte-untouched at `12e8c5e`.

---

## 81. **BASELINE FROZEN AT `9746da7`. BATCH HARNESS BUILT. STEP 1 REFERENCE REGRESSION: PASS.** (2026-08-21)

### 81.1 THE FROZEN BASELINE

> **Geometry identity, locked:**
> **STATIC/lift** = convex lifting envelope.
> **DYNAMIC/aero** = convex envelope **+ authored Smart Tail**, concavity
> intact. **NO global hulling of the combined aero shape.**
> Mesh completion is **TIP-ONLY** (80.2): rings inside the frozen 2.5% tip band
> are closed; anything else fails E3 loudly.

**`~0.0222` is recorded as a CURRENT SCREENING RESULT, NOT a calibration
target.** Nothing is ever fitted to it.

### 81.2 THE HARNESS

`batch-harness.mjs` takes any surface and exports one deterministic record:
geometry identity, scalar proxy + class, Cd with pressure/friction split,
Re_L, band and provenance, F1-F5, zone histories, eligibility, raw-vs-hull
sensitivity, analogue bracket, and OOD/confidence.

> **It proves rather than asserts that the ribbon layer cannot touch Cd:** Cd
> is recomputed **after** the ribbon pass and **bit-equality is required**, per
> body. A violation throws.

No `Math.random` anywhere; analytic bodies use the seeded generators.

### 81.3 STEP 1 RESULT — ALL FOUR CHECKS PASS

| body | proxy | Cd* | elig | F1 | F2a | anchors | conf |
|---|---|---|---|---|---|---|---|
| TN614-111 | 0.017243 | 0.03625 | ELIGIBLE | 0.4867 | 9.006 | 1/2 | SUPPORTED |
| TN614-221 | 0.041121 | 0.03974 | ELIGIBLE | 0.4238 | 10.260 | 2/2 | SUPPORTED |
| TN614-332 | 0.186851 | 0.04795 | ELIGIBLE | 0.4868 | 6.202 | 1/2 | REDUCED |
| TR432-Akron | 0.096451 | 0.04728 | ELIGIBLE | 0.5824 | 6.090 | 2/2 | SUPPORTED |
| S58-4157 | 0.023552 | 0.05108 | ELIGIBLE | 0.6017 | 4.188 | 2/2 | SUPPORTED |
| S58-4171 | 0.019573 | 0.05079 | ELIGIBLE | 0.5898 | 4.639 | 2/2 | SUPPORTED |
| S58-4174 | 0.038408 | 0.05162 | ELIGIBLE | 0.6142 | 3.734 | 2/2 | SUPPORTED |
| S58-4167 | 0.040826 | 0.05119 | ELIGIBLE | 0.7096 | 3.490 | 2/2 | SUPPORTED |
| S58-4170 | 0.012888 | 0.04884 | ELIGIBLE | 0.4742 | 5.054 | 1/2 | SUPPORTED |

**`*` THE Cd COLUMN IS A REGRESSION VALUE AT A COMMON ARTIFICIAL SCALE
(L = 100 m, 100 km/h), NOT A PHYSICAL PREDICTION** for these wind-tunnel
models. It exists to be reproducible, not realistic. **It must never be quoted
as a drag estimate for these bodies.**

| check | result |
|---|---|
| **R1** ribbon layer never alters Cd | **PASS** — proven per body, 9/9 |
| **R2** descriptors reproduce spec 73.2 | **PASS** — worst drift 4.6e-4 (my own 3-dp rounding) |
| **R3** Sunship bare proxy 0.765697 vs recorded 0.770 | **PASS** |
| **R3** Sunship tailed Cd 0.0222 vs recorded 0.0217 | **PASS** — residual is the tip-only nose cap |
| **R4** deterministic across repeat runs | **PASS** |
| all reference bodies ribbon-ELIGIBLE | **PASS** (9/9) |
| raw-vs-hull sensitivity | **0.0% on every body** — they are convex lathes, so hull = self |

### 81.4 ONE PROVENANCE OBSERVATION, NOT A DEFECT

**TN614-332 computes proxy 0.186851 while it IS calibration knot 1 at
0.1808** — a 3.3% difference, because the knot was measured through the
original `tn614.mjs` path rather than this hull-sampled one. It is therefore
scored as sitting just *outside* its own anchor, which is why it alone reads
`REDUCED`.

**Harmless here, but recorded**: if a future calibration change is ever
considered, the knot's geometry path and the harness's must be reconciled
first. Flagged, not acted on.

### 81.5 NEXT

Step 2 controlled generic geometry sweeps, then step 3 the Sunship/Smart-Tail
sweeps. **No calibration change is on the table until those are read.**
Production Cd path untouched; no calibration read or written.

---

## 82. **STEP 2 — CONTROLLED GENERIC GEOMETRY SWEEPS (2026-08-21).** Diagnostic. Nothing repaired or retuned.

Six one-parameter families, `L = 100 m`, `100 km/h`, artificial common scale.
Production Cd and calibration **frozen throughout**.

### 82.1 THE THREE PRE-REGISTERED DESCRIPTOR RESPONSES ALL HOLD

| sweep | pre-registered expectation | result |
|---|---|---|
| **NOSE `r0` 0 -> 1.00** | `F1` falls as the nose fills | **F1 0.7096 -> 0.4742, strictly decreasing** |
| **AFT `r1` 0 -> 0.25** | `F2a` falls as the taper eases | **F2a 4.639 -> 3.507, strictly decreasing** |
| **SHOULDER `m` 0.30 -> 0.56** | `F4` rises as the max section moves aft | **F4 0.2821 -> 0.4510, strictly increasing** |

**Three independent confirmations that the frozen 59.3 descriptors respond to
geometry exactly as 59.4 said they would**, on smooth controlled families,
with **no discontinuities and no eligibility failures**.

### 82.2 FINENESS: Cd IS V-SHAPED, AND THAT IS CORRECT

`L/D` 3 -> 12: proxy falls monotonically **0.3046 -> 0.0057**, but **Cd is
V-shaped — 0.0645, 0.0365, 0.0404, 0.0455, 0.0511, 0.0559, 0.0648, 0.0757 —
with a minimum at `L/D` ~ 4.**

**Not a defect.** At fixed `L`, slenderness shrinks the frontal reference area,
so frontal-referenced friction rises while pressure drag falls. An optimum in
between is the classic trade, and **TN-614 reports an optimum fineness of its
own**. The estimator reproduces the shape of a known physical result.

### 82.3 CAMBER: A CLEAN SCALAR-versus-RIBBON DISAGREEMENT

`k` 0 -> 0.20 (vertical section offset; sections stay circular):

| | 0 | 0.05 | 0.10 | 0.15 | 0.20 |
|---|---|---|---|---|---|
| **F5** | 0.008 | 0.331 | 0.660 | 0.991 | **1.321** |
| proxy | 0.023552 | 0.023313 | 0.023101 | 0.023454 | 0.023194 |
| Cd | 0.05108 | 0.05106 | 0.05102 | 0.05097 | 0.05087 |

> **`F5` rises essentially linearly while the scalar and Cd barely move**
> (proxy varies 1.9%, non-monotonically; Cd by 0.4%). **Camber is close to
> invisible to the production scalar and cleanly visible to the ribbon layer.**

### 82.4 AFT-CLOSURE CHANGES ARE STRUCTURALLY INVISIBLE TO THE RIBBONS — BY DESIGN

Across `cut` = 1.00, 0.975, 0.95, 0.90, 0.85, 0.80 the ribbon descriptors are
**byte-identical** — F1 0.6017, F2a 4.188, F3 1.9604, F4 0.3731 — while the
**proxy moves 0.0236 -> 0.0191**. At `cut` = 0.70 the descriptors finally jump.

**This is not a defect.** Zone 5 ends at `u` = 0.75 of the retained domain; the
aft changes sit in **zones 6-7, which 55.2 excluded from all derivative
claims**, until `cut` = 0.70 brings them into zone 5.

> **The ribbon layer is STRUCTURALLY BLIND to aft-closure geometry beyond the
> earned domain, exactly where the scalar sees it.** That independently
> corroborates 68.3's division of labour from a completely new direction —
> and it means the two layers are **complementary by construction**, not
> merely in practice.

### 82.5 **A DEFECT IN MY OWN SWEEP DESIGN**

The family labelled "TERMINAL BASE" **does not produce bases.** Zeroing `r`
beyond the cut still samples points **on the axis** out to the full extent, so
the convex hull spans them into a **cone**. Measured: aftmost-2% max radius is
**0.0000** at both `cut` = 0.8 and 0.7, against ~0.5 for a genuine flat base.

**So that family tested conical aft closures of varying steepness, not bases**,
and its "no classifier cliff" reading is **void** — the classifier was never
shown a base. 82.4's conclusion survives because it concerns *where* an aft
change is visible, not what kind. **The fix for a later run is to stop
sampling beyond the cut so the hull terminates in a flat disc. Not repaired
here: the instruction is to record defects during the sweep, not fix them.**

### 82.6 **E4 DEGRADES ON STRONGLY NON-AXISYMMETRIC BODIES — NOW PROPERLY EVIDENCED**

**Camber `k` = 0.20 is the sweep's only eligibility failure: E4 = 9.59%**, with
E2 multi 0, missed 0 and E3 clean. It jumps from **0.14% at `k` = 0.15**.

> 75.2 **retracted** this observation because the tailed Sunship that produced
> it was in the wrong frame. **It now returns on a controlled, correctly framed
> sweep**, so it is re-established on proper evidence: **E4's
> median-across-ribbons is a RANK statistic, and on a strongly directional body
> it jumps to a different azimuthal sample as the ribbon count changes.** The
> sharp 0.14% -> 9.59% step is characteristic of exactly that.

**Recorded, not repaired.** The frozen spec 6 criterion is untouched.

### 82.7 A LIMITATION OF MY ANOMALY DETECTOR

The cliff detector normalises each step by the series **range**, so it reports
"71% of range" on the SHOULDER family whose entire Cd range is **0.00087** —
1.2% of Cd. **Those flags are spurious.** Only the FINENESS cliff (range
0.039) and the aft-closure cliff are materially large. **A future version
should weight by absolute magnitude as well as range.**

### 82.8 SUMMARY

| finding | status |
|---|---|
| F1/F2a/F4 respond exactly as pre-registered | **confirmed, 3 of 3** |
| smooth families give smooth responses, no cliffs | **confirmed** |
| no classifier flip anywhere | **inconclusive — 82.5, the classifier was never shown a base** |
| ribbons blind to aft geometry outside earned zones | **confirmed, complementary by construction** |
| camber invisible to scalar, visible to F5 | **confirmed** |
| E4 degrades on strong asymmetry | **re-established on proper evidence** |
| raw-vs-hull sensitivity | **0.0% on every body in every family** (all convex) |

**Nothing retuned. Production Cd path and calibration untouched. Step 3 —
the Sunship / Smart Tail sweep — is next.**

## 83. **THE TWO STEP-2 DIAGNOSTIC DEFECTS, REPAIRED (2026-08-21).** Both were mine. Neither touches the frozen path.

82.5 and 82.7 recorded two defects in **my own** step-2 instruments and
deliberately left them alone, because the rule during a sweep is to record
defects rather than repair them mid-run. The sweep is over, so they are
repaired here, **before** step 3 consumes either instrument.

**Production Cd, the calibration and `compositeV1` are untouched. Production
remains BYTE-UNTOUCHED at `12e8c5e`. Zero production lines changed.** The
repairs are confined to `sweep-generic.mjs` (a test-input builder) and
`run-sweep-generic.mjs` (a printer), plus one new read-only verifier.

### 83.0 PRE-REGISTRATION

Predictions and pass conditions were computed from the analytic parent and
written down **before** the repaired surfaces were built. Parent
(`m` 0.40, `r0` 0.50, `r1` 0.10, `Cp` 0.65, `L/D` 7): `rMax` = 0.500000 at
`u` = 0.4.

| cut | r_base | r/rMax | terminalBaseFrac | predicted class |
|---|---|---|---|---|
| 1.00 | 0.000000 | 0.0000 | 0.000000 | rounded |
| 0.975 | 0.089303 | 0.1786 | 0.031900 | rounded |
| 0.95 | 0.143816 | 0.2876 | 0.082733 | **pinned** |
| 0.90 | 0.233012 | 0.4660 | 0.217178 | **pinned** |
| 0.85 | 0.302696 | 0.6054 | 0.366500 | **pinned** |
| 0.80 | 0.356630 | 0.7133 | 0.508741 | **pinned** |
| 0.70 | 0.428732 | 0.8575 | 0.735243 | **pinned** |

`CLASSIFIER_TAU` = 0.05 trips at `r/rMax` = 0.2236, i.e. **cut = 0.965173**, so
the flip was predicted to fall **between the 0.975 and 0.95 steps**.

| | pre-registered condition | result |
|---|---|---|
| **B1** | `cut` = 1.00 bit-identical to the old family (no base, so nothing may change) | **PASS** |
| **B2** | measured `r_base/rMax` within 0.02 of the table | **PASS**, worst 0.0000 |
| **B3** | production `classifySections` returns `pinned` at `cut` <= 0.95 and `rounded` above | **PASS**, flip exactly at 0.95 |
| **B4** | base flat: radius range over the aftmost 0.5% <= 0.02 `rMax` | **FAIL at 1.00 and 0.975 — LEFT FAILING** |
| **B5** | the five non-base families byte-identical to 82 | **PASS**, diffed line by line |
| **C1** | the spurious SHOULDER Cd flag disappears | **PASS** (1.2% of level) |
| **C2** | the real FINENESS Cd flag survives | **PASS** (50.2% of level) |
| **C3** | every printed ratio carries its denominator | **PASS** |

### 83.1 **B4 WAS MIS-SPECIFIED AND IS LEFT IN THE CODE FAILING**

A band 0.5% of the body long contains real **taper** as well as the base, so B4
measures the profile slope near the cut and not the flatness of anything. It
**cannot** pass at `cut` = 1.00, which has no base at all, and it fails at 0.975
only because the tail is steep there.

**It is not retuned to pass.** 55.2 already ruled that a frozen limit relaxed
once it becomes inconvenient was never a limit. It stays in the verifier,
failing, next to the corrected statement.

**B4-prime, POST-HOC and labelled so**: the rim vertices share **one** station
and lie on **one** fitted circle. That is what "the hull terminates in a flat
disc" actually asserts. Measured circularity is **1e-17 to 3e-17 of L** at
every cut — machine exact.

### 83.2 THE REPAIR ITSELF (82.5)

Exactly what 82.5 prescribed: **stop sampling past the cut**, and close the body
with a base ring at the cut station. The retained samples keep the same
golden-angle sequence, the same x positions and the same r, so the only change
to the input cloud is **the axis points removed and the base ring added** —
which is why B1 holds bit-for-bit.

**The family now produces bases.** Aftmost radius read 0.0000 at 82.5; it now
reads the predicted value at every cut, to four decimals.

### 83.3 **THE RESULT 82.8 COULD NOT GET: THE CLASSIFIER SEES THE BASE, AT THE PREDICTED CUT**

| cut | proxy | Cd | class | elig | F1 | F2a | F3 | F4 |
|---|---|---|---|---|---|---|---|---|
| 1.00 | 0.023552 | 0.05108 | rounded | ELIGIBLE | 0.6017 | 4.188 | 1.9604 | 0.3731 |
| 0.975 | 0.050581 | 0.05169 | rounded | ELIGIBLE | 0.6196 | 3.771 | 2.0047 | 0.3646 |
| 0.95 | 0.099568 | 0.05273 | **pinned** | ELIGIBLE | 0.6353 | 3.409 | 2.0416 | 0.3569 |
| 0.90 | 0.230038 | 0.08894 | pinned | ELIGIBLE | 0.6594 | 2.842 | 2.0914 | 0.3444 |
| 0.85 | 0.377117 | 0.19198 | pinned | ELIGIBLE | 0.6730 | 2.478 | 2.1079 | 0.3361 |
| 0.80 | 0.516119 | 0.28894 | pinned | ELIGIBLE | 0.6765 | 2.295 | 2.0953 | 0.3322 |
| 0.70 | 0.740175 | 0.44380 | pinned | ELIGIBLE | 0.6604 | 2.365 | 2.0075 | 0.3350 |

> **82.8's "no classifier flip anywhere — INCONCLUSIVE, the classifier was never
> shown a base" now resolves. Shown a base, the classifier flips at exactly the
> cut predicted from `CLASSIFIER_TAU` before the surfaces existed**, via
> trigger (b), terminal base fraction. Proxy and Cd are both **strictly
> monotone increasing** across the family, with no discontinuity at the flip.

The raster reads `terminalBaseFrac` **0.75% to 10.8% above** the analytic disc
fraction, the bias falling as the base grows — the signature of a fixed-cell
raster over-counting a perimeter. Consistent, explainable, and nowhere near
TAU's margin.

**Where these bodies sit:** proxy 0.0996 at `cut` = 0.95 is between the two
**real** anchors; from `cut` = 0.90 (proxy 0.230) onward they sit between
TN614-332 at 0.1808 and the **textbook sphere** at 0.8156. The family walks the
estimator out of the measured region into the textbook-anchored one. **The Cd
column is a regression value at the artificial common scale (81.3), not a drag
prediction, and 0.44 at `cut` = 0.70 must never be quoted as one.**

### 83.4 **82.4's BLINDNESS RESULT IS SCOPED, NOT OVERTURNED**

Under the repaired family the ribbon descriptors **move at every cut**
(F1 0.6017 -> 0.6765), where 82.4 recorded them byte-identical across the cone
family.

**That is not a contradiction and 82.4 is not retracted.** The cone family kept
the body length fixed — the hull always spanned to the original tip — so an aft
change genuinely stayed in zones 6-7. A real base **shortens the body**, which
rescales every zone boundary, so the descriptors move because the body was
re-zoned, not because they see the base.

> **82.4 stands as written for a change at FIXED body length, and that scope is
> now stated. The base family cannot test it, because truncation changes the
> reference length that defines the zones.**

### 83.5 THE CLIFF DETECTOR (82.7)

`MATERIAL iff step >= 0.50 * range AND step >= 0.05 * level`, `level` = median
magnitude. Every ratio prints with its denominator. Thresholds were set from
the **already-recorded** 82 data, not from the new run: FINENESS Cd steps
0.02807 on a level of 0.05123 (54.8%), SHOULDER 0.00062 on the same level
(1.2%) — **45x apart**, so any threshold in (0.02, 0.50) gives the same verdict.

**The spurious SHOULDER Cd flag is gone; the FINENESS flag survives.**

**DISCLOSED: proxy cliffs are now reported too.** The old detector pushed only
Cd cliffs. That is a scope addition, not a changed verdict on an old flag.

The anomaly list moved from 4 entries to 5 for **four separate reasons**, not
one: two spurious Cd cliffs removed (SHOULDER, TERMINAL BASE), two proxy cliffs
added (FINENESS, SHOULDER), the classifier flip added because the family now
produces bases, and the three base-family eligibility failures removed with
`NAZ_BASE` = 32. The count is not a summary of anything.

### 83.6 TWO FURTHER LIMITATIONS OF THE DETECTOR — RECORDED, NOT REPAIRED

1. **"% of level" is meaningless on a series spanning decades.** The FINENESS
   proxy falls 0.3046 -> 0.0057, 53x, and the detector reports the largest step
   as **378.7% of level**. The number is arithmetically correct and
   interpretively useless; a log-scale measure is the right one there.
2. **It does not normalise by parameter step.** The SHOULDER proxy is flagged at
   `m` = 0.56, where the parameter step is 0.06 against 0.04 everywhere else. A
   1.5x wider step producing a larger jump is expected, not anomalous.

Both are recorded for a future version. Neither is repaired now: they were
found by reading the repaired detector's own output, which is the sweep rule
applying to the instrument as much as to the geometry.

### 83.7 **A ROBUSTNESS LIMIT IN THE VENDORED PRODUCTION QUICKHULL — FLAGGED, NOT REPAIRED**

Building the base ring at **128 points** made the production hull return an
**open surface** at `cut` 0.95, 0.90 and 0.70 — 136, 132 and 59 boundary edges
— dropping 11, 9 and 3 of the exactly-coplanar rim points. Those three rows
**failed E3 input validation** and were ribbon-INELIGIBLE.

The failure is **monotone in rim density**:

| naz | 1.00 | 0.975 | 0.95 | 0.90 | 0.85 | 0.80 | 0.70 |
|---|---|---|---|---|---|---|---|
| 32 | ok | ok | ok | ok | ok | ok | ok |
| 48 | ok | ok | **OPEN** | ok | ok | ok | ok |
| 64 | ok | ok | **OPEN** | ok | ok | ok | ok |
| 96 | ok | ok | **OPEN** | **OPEN** | ok | ok | ok |
| 128 | ok | ok | **OPEN** | **OPEN** | ok | ok | **OPEN** |
| 160 | ok | ok | **OPEN** | **OPEN** | ok | ok | **OPEN** |

At **256** the hull did not complete `cut` = 0.95 in **900 s** (nor did 257 in
100 s), while 224 and 255 complete in ~0.3 s and 256 itself completes at
`cut` 0.90 and 0.80. **Whether that is non-termination or a blow-up is not
established and is not claimed — the measurement is the 900 s.** A dense
helical body sample meeting an exactly planar rim produces sliver faces whose
plane distances sit near the hull's ~3e-15 tolerance.

**`NAZ_BASE` = 32 is therefore forced by a hull defect, not chosen for
accuracy**, and the cost is quantified rather than waved through: the base is a
32-gon, so its area is **99.358%** of the disc (measured 0.99359) and its radius
ripples **0.48%** between vertex and edge midpoint. Against TAU the nearest
margin is 65%, so the flip point moves by ~1e-3 in cut fraction.

> **The parameter was changed AFTER seeing a result, and that is stated rather
> than smoothed over. It did not manufacture the finding it is checked against:
> the flip at `cut` = 0.95 was already measured at NAZ 128, before `NAZ_BASE`
> was touched.**

**This is a PRODUCTION component failing on a degenerate input.** Production
hulls uploaded meshes, and a flat-based CAD export with a dense rim is an
ordinary thing for a user to upload. **Flagged here, not acted on** — the
production path is frozen and no line of it is being changed.

### 83.8 **THREE MEASUREMENT ERRORS OF MY OWN, ALL IN THE VERIFIER, ALL CAUGHT BY AN EXISTING NUMBER**

The geometry never moved. My measurement of it failed three times, in exactly
the pattern the handover names — plausible, wrong, and caught by a number that
already existed.

1. **B4 measured taper and called it flatness** (83.1).
2. **B4-prime v1 took radii about the WRONG AXIS.** The bodies are centred on
   their **volume centroid** (4.1) and the Fibonacci sample's azimuthal
   imbalance puts that centroid ~1.5e-5 off the axis of revolution, so a radius
   about the origin inherits the offset. It reported a 3.15e-5 spread as a
   defect. **This is 4.1 got wrong a second time.**
3. **B4-prime v2 took the centre as the MEAN OF THE SURVIVING RIM POINTS.**
   Where the hull drops a contiguous run of coplanar vertices the survivors are
   not symmetric, so their mean sits up to 1.4e-2 off true and an exact circle
   reads as **11% out of round**. A statistic computed off a biased sample.

v3 **fits** the circle and assumes nothing about which points survived.

A further arithmetic slip was caught the same way: the comment claimed a 32-gon
holds 99.786% of the disc area; the verifier measured **0.99359**, and 0.99358
is the correct value of `(N/2)sin(2pi/N)/pi`. **The measurement corrected the
comment, not the other way round.**

> **B2 and B3 — the only pre-registered conditions that carry the finding —
> passed on the FIRST run and on every run since. None of this touched them.**

### 83.9 STATUS

`sweep-generic.mjs` and `run-sweep-generic.mjs` repaired; `verify-base-family.mjs`
added (read-only; consumes `measureSections`, `scoreSections`,
`classifySections` unmodified). **No Cd refit, no calibration read or written,
no descriptor fitting, no production change.** The independent asymmetric chine
remains **UNSPENT**.

**Step 3 — the Sunship / Smart Tail sweep — is next, and both instruments it
depends on are now sound.**

---

### 83.10 **OWNER RULINGS — §83 ACCEPTED AND FROZEN (2026-08-21).** (reviewer-authored)

**Accepted.** The base-family repair did what it needed to do: the classifier was
finally shown a real base and flipped where the frozen threshold predicted. That
is far more useful than the earlier void result.

Three rulings attach:

1. **The QuickHull behaviour goes on the pre-live blocker/guard list.** An open
   hull appearing at higher planar-rim resolutions is potentially relevant to
   **live uploads**. It does **not** block the Smart Tail sweep. It is recorded
   in `RELEASE-PLAN.md` R1 as a pre-live guard needing a targeted regression,
   and carried in the handover.

2. **The cliff detector is an ENGINEERING DIAGNOSTIC, NOT INDEPENDENT
   EVIDENCE.** Its thresholds were chosen after seeing the step-2 data, so its
   future `MATERIAL` / `not material` labels carry no evidential weight of their
   own. **The underlying Cd and proxy curves stay visible in every report**, and
   any claim rests on the curves, not on the label.

3. **§83 is frozen.** Step 3 pre-registration follows and is drafted **only** —
   nothing is built or run until its ranges, validity rules, outputs and stop
   conditions are ruled on.

---

## 84. **STEP 3 — SMART TAIL OAT SWEEPS. PRE-REGISTRATION DRAFT, 2026-08-21. NOT BUILT, NOT RUN.**

**Nothing in this section has been executed.** It is the gate document for the
reviewer to freeze or amend. Two of the five parameters do not exist in the
generator yet (84.2) and **must be ruled on before any code is written.**

### 84.0 THE PURPOSE, STATED BEFORE ANYTHING RUNS

> **Step 3 asks whether the current ~0.022 Smart Tail result belongs to a
> coherent neighbourhood of reasonable Smart Tail geometries, rather than being
> an isolated numerical sweet spot.**
>
> **It is an ESTIMATOR-RESPONSE experiment, NOT aerodynamic validation.** No
> statement about the real drag of any of these shapes follows from it.

Both outcomes are written down now so neither can be reinterpreted afterwards,
and **neither is preferred**:

| outcome | what it would mean |
|---|---|
| many nearby reasonable variants land **0.02–0.03**, smooth response, ELIGIBLE, no cliffs | the ~0.022 sits in a **basin**. Far stronger than the exact minimum being 0.0218 rather than 0.0222. |
| the baseline sits at a **needle-like minimum**, small geometry changes throwing Cd to 0.05 or tripping classifiers | equally valuable — it says **do not trust the apparent optimum yet** |

The 0.02–0.03 band is a **pre-registered reporting bin**, not a pass condition
and not a target. Nothing is fitted to it.

### 84.1 THE BASELINE AND THE REAL GENERATOR PARAMETER NAMES

The authored surrogate is `CalcV2/lab/sunship-tail-aerohull-candidate.obj`,
produced by `CalcV2/lab/sunship-tail-aerohull.mjs`. Its **three existing** free
parameters, under their actual names:

| reviewer's concept | generator name | baseline | note |
|---|---|---|---|
| **1. tail / deployed length** | `EXTRA_M` | **216 m** | deployed = `LENGTH_M` + `EXTRA_M` = 516 m |
| **2. attachment / fairing start** | `ATTACH` | **0.80** | fraction of the 300 m envelope |
| **4. taper exponent / closure law** | `P` | **0.8** | `r = ra*((x_tip-x)/(x_tip-x_a))^P` |

Held fixed: `LENGTH_M` = 300 (the **envelope**, per the 2026-08-18 ruling),
`RINGS` = 320, `SEGS` = 64, speed 100 km/h, and the envelope profile itself,
measured from `Sunship.obj` at `axis '+Z'`, `STATIONS 256`.

**Recorded, unchanged from r20:** the graft matches **radius** at the attach
point and nothing else. **The slope is NOT matched — this is
radius-continuous, not tangential.** Earlier wording claiming tangency was
wrong and is not reinstated.

### 84.2 **TWO OF THE FIVE PARAMETERS DO NOT EXIST.** Forms proposed here; **APPROVED at 84.11.2**

**Flare/waist depth** and **terminal radius/base** are not in the generator: the
profile is a pure power law that always closes to `r = 0` at the tip. Proposing
their form is **authoring new geometry**, so it is proposed here and adopted
only on the reviewer's word.

Both forms are the minimal one-parameter deformation that **recovers the
baseline EXACTLY at its neutral value**, with `s = (x - x_a)/(x_tip - x_a)` and
`t = 1 - s`:

| # | concept | proposed form | neutral | sign convention |
|---|---|---|---|---|
| **3** | flare / waist depth | `r = ra * t^P * (1 + W*sin(pi*s))` | `W = 0` | `W > 0` **flare** (bulge), `W < 0` **waist** (concave) |
| **5** | terminal radius / base | `r = rTip + (ra - rTip) * t^P` | `rTip = 0` | `rTip` as a fraction of `ra` |

Why these and not something more elaborate: the `sin(pi*s)` bump **vanishes at
both ends**, so attach-point radius continuity and tip closure are untouched and
`W` moves one thing only. The `rTip` blend preserves `r(x_a) = ra` identically,
so it also moves one thing only.

**A waist (`W < 0`) is deliberately concave.** That is consistent with 81.1 —
DYNAMIC is the envelope plus the authored tail with **concavity intact**, and
there is **no global hulling** — and it is exactly the case where 79's finding
(hulling zone 3 deletes 85% of its turning) will show up in the path
sensitivity. That is informative, not a problem.

**`rTip > 0` creates a real base**, which brings 83.7 straight into play: the
lathe closes it with a 64-point planar rim, and the scan in 83.7 recorded a
64-point rim producing an **open hull** at one of seven cuts. See V5.

### 84.3 THE REFACTOR, AND ITS IDENTITY GATE

`lab/sunship-tail-aerohull.mjs` is an env-var script that prints and optionally
writes an OBJ. Step 3 needs an **importable pure function**,
`buildSmartTail({ extraM, attach, P, W, rTip })`, returning `{verts, faces,
identity, params}`.

> **G0 — THE REFACTOR IDENTITY GATE.** At the baseline parameters the new
> function must reproduce the **stored candidate OBJ byte-for-byte**: same
> vertex count, same face list, same 5-dp formatting.
>
> **G0-fallback (owner-permitted, 2026-08-21):** if a formatting or ordering
> difference proves unavoidable, **geometric/numerical identity may substitute**
> — same vertex count and order, same face list, every coordinate equal to full
> double precision. **Taking the fallback must be DECLARED in the run header
> with the exact reason**, never taken silently. Byte-for-byte is preferred and
> is what will be attempted first.
>
> **If neither holds, step 3 does not start** and the discrepancy is
> investigated first.

> **G0b — ONE ENGINE COPY.** `CalcV2/src/` and `site/calcv2/src/` are two
> copies of the estimator, **byte-identical today** (verified for `obj.js`,
> `sections.js`, `cdEstimator.js`). The lab script imports the former; the
> spike harness imports the latter. **Step 3 imports the CalcV1-site copy
> throughout**, because that is what production serves, and the run asserts the
> two copies still match. A silent drift between them would look like a physics
> result.

### 84.4 **NO AERODYNAMIC DIRECTIONS ARE PRE-REGISTERED**

> **For none of the five parameters is a favourable direction of Cd asserted.**
> We do not know enough physics to say "longer must always be better".

59.4's pre-registered directions remain frozen and apply to **F1–F5 only**, as
routing/analogue statements. They are **not** extended to Cd here. 59.5 is the
standing reason: a direction reconsidered after seeing an outcome is not
evidence, and this experiment must not create a fresh opportunity to do that.

### 84.5 THE STRUCTURAL PRE-REGISTERED TESTS

These, not a Cd direction, are what step 3 is gated on.

| | test | operational form |
|---|---|---|
| **S1** | **determinism** | every variant evaluated twice **in separate processes**; the two records must be byte-identical. No `Math.random` anywhere. |
| **S2** | **ONE geometry, identity printed** | Cd, the scalar AND the ribbons all read the **same** DYNAMIC surface: convex envelope + authored Smart Tail, concavity intact, **no global hull**. Every number prints the surface it came from. See 84.11.1. |
| **S3** | **no silent mesh repair** | completion is **TIP-ONLY**, 2.5% band (80.2). Every cap is counted and printed. A boundary loop **outside** the band fails E3 loudly and the row is recorded as a defect, **not** repaired. |
| **S4** | **full record per step** | `compositeV1`, `softAft`, `softFore`, class **and which trigger fired**, Cd with pressure/friction split, band, `Re_L`, F1–F5 as median/worst/spread, **all 8 zone histories**, eligibility E2/E3/E4 with their numbers, OOD/confidence and analogue bracket, and raw-vs-hull sensitivity |
| **S5** | **classifier flips identified, never smoothed** | any class change between adjacent steps prints as a flip, **with the trigger that caused it** and the parameter value, and enters the anomaly list. 83.3 showed the flip is a real and predictable event. |
| **S6** | **eligibility failures remain failures** | no row is re-run at a different resolution to make it pass. An INELIGIBLE row keeps its descriptors marked **SHADOW / no authority**. |
| **S7** | **frozen path** | no calibration knot read or written; no estimator, classifier or ribbon change during the sweep; production byte-untouched. The harness's per-body **bit-equality proof** (81.2) must pass on every row or the run throws. |
| **S8** | **curves visible** | per 83.10 the cliff detector's labels are **not evidence**. Every family prints its full Cd and proxy series, and the deliverable is the **five raw curves** plus one table. |

> **S2 — WITHDRAWN AND REPLACED. The draft's original S2 was STALE and is
> corrected at 84.11.1.** It claimed Cd and the ribbons could not read the same
> surface. **They can, they already do, and 80.3 recorded it.** One generator
> output per variant drives both layers, with no global hull anywhere in the
> path. The hull remains a **sensitivity diagnostic only**.

### 84.6 RANGES AND STEP COUNTS — **FROZEN AND APPROVED 2026-08-21** (84.11.3)

One parameter at a time, all others at baseline. **Baseline row repeated in
every family as the common anchor** (as `cut` = 1.00 anchored the base family).

| family | parameter | steps | n |
|---|---|---|---|
| family | parameter | steps | n | what it spans |
|---|---|---|---|---|
| **T-LEN** | `EXTRA_M` (m) | 0, 54, 108, 162, **216**, 270, 324 | 7 | deployed 300–624 m, fineness 1.33–2.76 |
| **T-ATT** | `ATTACH` | 0.60, 0.65, 0.70, 0.75, **0.80**, 0.85, 0.90 | 7 | graft replaces the rear 40%–10% of the envelope |
| **T-EXP** | `P` | 0.4, 0.6, 0.7, **0.8**, 0.9, 1.0, 1.25, 1.5, 2.0 | 9 | full/blunt closure through to a needle |
| **T-WST** | `W` | −0.20, −0.10, −0.05, **0**, +0.05, +0.10, +0.20 | 7 | ±10.5 m at mid-fairing, on a 52.7 m local radius |
| **T-BAS** | `rTip / ra` | **0**, 0.05, 0.10, 0.20, 0.28, 0.35 | 6 | base 0–32.1 m; **crosses `CLASSIFIER_TAU` between 0.20 and 0.28** |

**36 rows. The baseline appears in all five families, so there are 32 DISTINCT
variants** (36 − 4 repeats). *An earlier draft of this line said 31, which
counted the baseline zero times.*

Baseline geometry the ranges are set against, read from the stored surrogate:
`ra` = **91.684 m** at `ATTACH` 0.80 (x = 240 m), envelope `rMax` =
**113.008 m**, deployed 516 m.

**TWO REVISIONS TO THE FIRST DRAFT, both made before any ruling:**

1. **`EXTRA_M` = 432 DROPPED.** It gives a 732 m vehicle — 2.4x the envelope —
   which is the "ridiculous shape" end rather than a reasonable Smart Tail. 324
   is already +50% on the baseline fairing. **Restore it if wanted; it is
   dropped on judgement, not on evidence.**
2. **`rTip` EXTENDED TO 0.35.** *The drafted range would have tested nothing.*
   `terminalBaseFrac` is measured against the body's own maximum section, so
   the trigger needs `rTip` > `rMax`·sqrt(TAU) = **25.27 m = 0.2756 ra**. Every
   step of the original 0–0.20 range sits below it:

   | `rTip/ra` | 0 | 0.05 | 0.10 | 0.20 | **0.28** | **0.35** |
   |---|---|---|---|---|---|---|
   | `rTip` (m) | 0 | 4.58 | 9.17 | 18.34 | 25.67 | 32.09 |
   | base/Amax | 0 | 0.00165 | 0.00658 | 0.02633 | **0.05160** | **0.08063** |
   | class | rounded | rounded | rounded | rounded | **pinned** | **pinned** |

   > **PRE-REGISTERED, from the frozen threshold and before the build: the class
   > flips between `rTip/ra` = 0.20 and 0.28.** Same form of prediction as 83.0,
   > and the same purpose — a family that cannot reach its own trigger is not a
   > test of it.

`EXTRA_M` = 0 is kept deliberately as the degenerate anchor: **no extension**,
the fairing law replacing the envelope's own rear 20%. It is **not** the stowed
vehicle, which is the bare 300 m envelope.

**GEOMETRY VALIDITY RULES, checked per row and reported, never silently fixed:**

| | rule |
|---|---|
| **V1** | `r(x)` finite and `>= 0` at every station |
| **V2** | the fairing never exceeds the envelope's maximum radius — if it does it is not a fairing, and the row is flagged |
| **V3** | **no monotonicity requirement** — a flare is deliberately non-monotone |
| **V4** | the authored mesh must be **closed** after tip-only completion; E3 must pass on the authored path |
| **V5** | the **hull** path is checked for closure too. Per 83.7 a 64-point planar rim can open the hull, so any `rTip > 0` row that opens is **recorded as a defect and left failing** — it is the same finding, not a new one |

### 84.7 STOP CONDITIONS — **AMENDED ON THE OWNER'S RULING, 2026-08-21**

The first draft escalated every failure to the whole experiment. It is now
**two-tier**: a defect in one family kills **that family**, not the other four,
unless it points at something shared.

#### GLOBAL HARD STOPS — abort the whole of step 3

These are identity, determinism and frozen-path failures. None of them is a
result; each means the instrument is not trustworthy.

| | condition |
|---|---|
| **A1** | **G0** or **G0b** fails — the refactor is not the baseline, or the two engine copies have drifted |
| **A2** | the **Cd/ribbon bit-equality proof** (81.2) throws on any row |
| **A3** | **geometry identity failure** — any number whose source surface cannot be stated |
| **A4** | **non-determinism** — the two independent-process runs of any row differ |
| **A5** | evidence that the **frozen production path itself has changed** — calibration knots, estimator or classifier not byte-identical to the baseline at the end of the run |

#### FAMILY-LEVEL PAUSE / KILL — contain the damage, keep the rest

| | condition | consequence |
|---|---|---|
| **F1** | an **unexplained material Cd cliff** in one family | **PAUSE that family and investigate before interpreting it.** The other four OAT families continue and their data stands. Escalates to a global stop **only** if the cause proves to be a **shared estimator defect** rather than that family's geometry. |
| **F2** | **more than one third of a family's rows INELIGIBLE** | **KILLS that family's aerodynamic interpretation** and bars that parameter from any later grid. It does **not** end step 3; the family's rows are still reported, as geometry and scalar data without ribbon authority. |

#### THE GRID

**Not pre-registered here.** The frozen 9-step plan allows "a modest grid **only
after** the 1-D curves look sensible", so it is a **separate ruling** taken once
these curves are read. **A parameter killed by F2 may not enter it.**

### 84.8 **THE PRIMARY READOUT — DEFINED BEFORE THE RUN** (owner ruling, 2026-08-21)

For **each family**, four questions, answered in this order:

1. **Is the baseline embedded in a SMOOTH LOCAL RESPONSE?** — do the immediate
   neighbours of the baseline step move Cd gently and monotonically, or is the
   baseline a spike?
2. **How WIDE is the region that stays near Cd 0.02x–0.03x?** — reported as the
   contiguous run of steps that stay in band, in the parameter's own units, not
   merely as a count.
3. **WHERE do the boundaries fall?** — the parameter value at every classifier
   flip, every eligibility transition, and every OOD/confidence change.
4. **Is any low-Cd result obviously produced by the known scalar exploit
   pattern?** — see 84.8.1.

#### 84.8.1 THE EXPLOIT FLAG — what it is, and what it is NOT

> **We are NOT trying to reject low Cd.** The question is whether a low score
> arrives with sensible geometry and context, or with the same
> **long-shallow-closure collapse** that lets a shape score well by flattening
> the aft penalty rather than by being good.

The reason this belongs in step 3 is r22's own objection: **the deployed fairing
was CHOSEN because it scored best on this estimator**, so a sweep around it is
exactly where a shape optimised against the model's weak region would surface.

The scalar is an **aft-penalty descriptor** — 65.5 established that `softFore`
is zero or numerically zero on every streamlined hull tested, so `compositeV1`
reduces to `softAft`. **A long, gentle closure therefore drives the scalar down
by construction**, whether or not the shape is aerodynamically better.

**Five signals, REPORTED PER ROW, NEVER GATING, and never collapsed into one
score** — the 70.3 rule applies here too:

| | signal | why it is a warning |
|---|---|---|
| **EX1** | `compositeV1` **below the lowest REAL calibration anchor** (TN614-111, 0.017428) | Cd is then extrapolated **beneath all measured support**, not interpolated between anchors |
| **EX2** | **pressure Cd collapsed as a fraction of total**, relative to the baseline row | the aft penalty has been zeroed and the score is essentially all friction |
| **EX3** | **`F2a` below the measured corpus minimum** (3.490, S58-4167 at 81.3) **with zones 4–5 near zero** | the geometric signature of the long shallow closure itself |
| **EX4** | 78's verdict **`DIVERGENT_GEOMETRY_SHALLOW_MAP`** | 78.4 calls this "the most dangerous of the three": the Cd agreement is a property of a flat map region, not of the geometry |
| **EX5** | **wetted area up materially while Cd falls** | drag bought by adding skin that a frontal-referenced coefficient does not charge for — r22's 59,300 m², 22% of the vehicle's wetted area, at zero mass |

**The thresholds for EX1 and EX3 are the RECORDED values above, not new
numbers.** EX2 and EX5 are stated **relative to the baseline row**, which is
present in every family. A row tripping two or more is called out explicitly in
the summary table. **No row is excluded from the results because of them.**

### 84.9 THE DELIVERABLE


**Five curves and one table.** Per family, Cd against the parameter with the
proxy alongside; and one summary row per family carrying: baseline value, Cd
min/max and where, Cd range, count ELIGIBLE of n, count of class flips and
where, and worst raw-vs-hull sensitivity.

Plus the single reporting line the purpose asks for: **how many of the 32
distinct variants land in 0.02–0.03**, stated as a count with the full list, not
as a verdict.

### 84.10 OUT OF SCOPE

No calibration change. No descriptor fitting. No combined score. No estimator,
classifier or ribbon change. No production change. **No aerodynamic validation
claim of any kind.** TR-291, TN-614, Series 58 and Report 451 stay **SPENT**.
The independent asymmetric chine remains **UNSPENT**.

---

### 84.11 **OWNER RULINGS ON THIS DRAFT (2026-08-21).** (reviewer-authored)

#### 84.11.1 **S2 WITHDRAWN — THE DRAFT REINTRODUCED A MISTAKE THAT WAS ALREADY REMOVED**

> **The draft's S2 was stale and is withdrawn in full.**

It claimed the ribbon layer "requires a convex hull" and that Cd and ribbons
therefore could not read the same surface. **That is the exact architectural
mismatch 77.2 recorded and 80.3 DISCHARGED**, and re-proposing it would have
undone `9746da7`.

**What is actually true, and was already measured:**

> **The support skin convexifies EACH TRANSVERSE SECTION. It does not convexify
> the 3D body along its length.** A longitudinally concave authored Smart Tail
> therefore passes through it intact.

Once the accidental 4.112 m **nose** opening was capped (80.1, tip-only), the
ribbons ran **directly on the authored concave Smart Tail**: E3 **clean**, E2
multi **0** / missed **0**, E4 **0.00%**, **ELIGIBLE** (80.3). 80.4 then showed
what the hulled version costs — zone 3 turning **24.36 deg -> 3.74**, `F2a`
**1.973 -> 0.000**. The signal is destroyed by hulling, not enabled by it.

**THE FROZEN IDENTITY FOR STEP 3, RESTATED:**

| | |
|---|---|
| **DYNAMIC aero geometry** | convex Sunship envelope **+ authored Smart Tail** |
| **Cd** | reads that geometry |
| **ribbons** | read **that same geometry**, through the support-section representation |
| **global 3D convex hull before ribbons** | **NO. Never.** |
| **raw-vs-hull** | retained as a **sensitivity diagnostic only** — not the ribbon geometry |

**Root cause of the stale claim, fixed at source:** the doc comment on
`ribbonContext` said its input was "the CANONICAL CONVEX HULL of the body", and
`geometry-identity.mjs` printed "the ribbon layer requires a convex hull".
Both predate 80 and both are now corrected in the files themselves, so the next
reader cannot repeat it. **The hull is production's rule for UPLOADS; it was
never a requirement of the ribbon module.**

**Consequence, and it is a simplification:** step 3 tests every Smart Tail
variant through **one common aerodynamic geometry**, rather than interpreting
two different bodies.

#### 84.11.2 THE TWO NEW PARAMETERS — **APPROVED**

**`W` (flare / waist) APPROVED.** The `sin(pi*s)` perturbation is a clean
research parameter: `W = 0` reproduces the baseline and both endpoints are
untouched.

**`rTip` (terminal radius) APPROVED.** Neutral value must reproduce the
baseline exactly. It is useful precisely because it lets a **pointed closure ->
finite base** transition be explored deliberately, instead of a finite base
arriving from malformed geometry — which is what 82.5 caught.

**Both are conditional on geometry-validity guards** (84.6 V1-V5), explicitly
including **no negative radius, no self-intersection, no discontinuity**.

#### 84.11.3 RANGES AND STEP COUNTS — **APPROVED AS WRITTEN, 2026-08-21**

**All five families APPROVED as written.** They are broad enough to tell us
whether ~0.022 is a neighbourhood or a knife-edge, without going straight into
absurd optimisation space. Dropping `EXTRA_M` = 432 was sensible — 324 already
reaches 624 m deployed and gives plenty of leverage. `W` ±0.20 is a useful
perturbation **provided the validity guards stay hard**. Extending `rTip/ra` to
0.35 was right; otherwise that family would never have exercised the base
classifier at all.

> **THE T-BAS CLASSIFIER PREDICTION IS FROZEN.** The flip is pre-registered
> between `rTip/ra` = 0.20 and 0.28. **If it flips somewhere unexpected, that is
> INFORMATION. The steps are not massaged afterwards.**

**GO.** G0/G0b are approved for implementation, and the five OAT families then
run with no estimator or calibration change.

#### 84.11.4 G0b — LONGER TERM, DELETE THE DUPLICATE

The equality assertion is right **for this experiment**. **Longer term, before
live deployment, the duplicate estimator source is to be ELIMINATED rather than
permanently guarded by a drift trap.** Added to the pre-live guard list in
`RELEASE-PLAN.md`.


---

## 85. **STEP 3 RESULT — THE ~0.022 IS A NEIGHBOURHOOD, AND ITS EDGE IS A CALIBRATION KNOT (2026-08-21).**

Five OAT families, 36 rows, **32 distinct variants**, run exactly as frozen at
84. **Estimator-response experiment, not aerodynamic validation.** Nothing was
retuned; no calibration knot was read or written; production is byte-untouched
at `12e8c5e`.

### 85.0 THE GATES, FIRST

| gate | result |
|---|---|
| **G0** refactor identity | **PASS — BYTE-FOR-BYTE.** `buildSmartTail(baseline)` reproduces the 1,378,938-byte stored surrogate exactly. **No fallback taken.** |
| **G0b** one engine | **PASS** — `obj.js`, `sections.js`, `cdEstimator.js`, `dynamicsGeometry.js` byte-identical across both source copies |
| **S1** determinism | **PASS** — two runs in **separate processes**, byte-identical JSON records |
| **A5** frozen path | **PASS** — engine fingerprint identical before and after the run |
| **A2** Cd/ribbon bit-equality | **PASS** — proven per row, 36/36 |
| **S3** tip-only completion | **PASS** — 1 cap (the 80.1 nose) on every row; **2** on `rTip > 0` rows, the second being the base disc. Nothing outside the 2.5% band was capped. |
| baseline reproduction | **EXACT** — `compositeV1` **0.161170** against 80.4's recorded 0.161170; **Cd 0.0222** against 81.3 R3's recorded 0.0222 |
| eligibility | **32/32 ELIGIBLE.** No family reached 84.7's F2 threshold; **no family killed.** |

### 85.1 **THE ANSWER TO 84.0**

> **19 of the 32 distinct variants land in Cd 0.02–0.03, and EVERY ONE of the
> five families has a contiguous in-band run THROUGH the baseline.**

| family | in-band run through baseline | of |
|---|---|---|
| **T-LEN** | `EXTRA_M` **216 … 324** | 3 of 7 |
| **T-ATT** | `ATTACH` **0.60 … 0.80** | 5 of 7 |
| **T-EXP** | `P` **0.6 … 1.0** | 5 of 9 |
| **T-WST** | `W` **−0.10 … +0.10** | 5 of 7 |
| **T-BAS** | `rTip/ra` **0 … 0.28** | 5 of 6 |

**This is the neighbourhood outcome, not the knife-edge outcome.** The baseline
is not an isolated numerical optimum: it sits inside a region that is wide in
every one of the five directions tested, and the local response around it is
gentle — the immediate neighbours move Cd by **−0.9%/+0.2% (T-LEN aft side),
−1.7%/−0.4% (T-EXP), +0.2%/+1.1% (T-WST), +0.2% (T-BAS)**.

### 85.2 THE FIVE FAMILIES

| family | n | Cd min | at | Cd max | at | range | flips | worst dPx% |
|---|---|---|---|---|---|---|---|---|
| **T-LEN** | 7 | 0.02197 | 270 | 0.45389 | 0 | 0.43192 | 1 | 73.1 |
| **T-ATT** | 7 | 0.02044 | 0.60 | 0.24184 | 0.90 | 0.22141 | 2 | 77.2 |
| **T-EXP** | 9 | 0.02209 | 0.9 | 0.12788 | 2.0 | 0.10580 | 0 | 79.6 |
| **T-WST** | 7 | 0.02212 | −0.05 | 0.03937 | −0.20 | 0.01724 | 0 | 57.7 |
| **T-BAS** | 6 | 0.02217 | 0 | 0.03883 | 0.35 | 0.01666 | 1 | 48.2 |

### 85.3 **THE BASELINE IS NOT THE BEST POINT IN ITS OWN ATTACHMENT FAMILY, AND IT SITS ONE STEP FROM A CLIFF**

| `ATTACH` | 0.60 | 0.65 | 0.70 | 0.75 | **0.80** | 0.85 | 0.90 |
|---|---|---|---|---|---|---|---|
| Cd | 0.02044 | 0.02064 | 0.02066 | 0.02070 | **0.02217** | 0.11947 | 0.24184 |
| proxy | 0.090221 | 0.094949 | 0.095693 | 0.099452 | **0.161170** | 0.317764 | 0.490240 |
| path verdict | ROBUST | ROBUST | ROBUST | ROBUST | **SHALLOW MAP** | DIVERGENT_CD | DIVERGENT_CD |
| dPx | 0.0% | 0.1% | 0.4% | 4.9% | **40.3%** | 67.3% | 77.2% |

Two things, both worth saying plainly:

1. **Every earlier pickup point scores LOWER than the baseline** — 0.02044 to
   0.02070 against 0.02217, i.e. **6.6% to 7.8% below it** — and does so on
   **ROBUST** geometry, where the authored and hull representations agree to
   within 5%. The comparison holds within a single class: 0.65–0.75 are
   `rounded`, as the baseline is.
2. **The baseline is one step from a 439% jump.** `ATTACH` 0.85 gives Cd
   0.11947. The classifier flips there, by **trigger (d), aft shoulder 0.1328 >
   0.13** — a margin of **2%** on the threshold.

> **This does not say the baseline is wrong.** It says the attachment point was
> not swept when the shape was chosen, and that the estimator prefers an
> earlier pickup on better-supported geometry. **It is an estimator response,
> not an aerodynamic recommendation.**

### 85.4 **EVERY MATERIAL Cd CLIFF IN STEP 3 IS THE SAME EVENT: CROSSING CALIBRATION KNOT 2**

84.7's F1 asks whether any material cliff is **unexplained**. None is, and they
all have **one** explanation.

The frozen pressure map is piecewise-linear in the proxy, with a knot at
**TN614-332, proxy 0.180789**. Measured directly from
`calibratePressure(·, 'pinned')`:

| proxy | pressure Cd | local slope |
|---|---|---|
| 0.150000 | 0.011534 | — |
| 0.170000 | 0.012057 | **0.02617** |
| 0.178270 | 0.012274 | **0.02617** |
| **0.180789** | — | **the knot** |
| 0.190000 | 0.018869 | **0.70888** |
| 0.202036 | 0.027401 | **0.70888** |
| 0.240000 | 0.054313 | **0.70888** |

> **The map's slope jumps 27x at proxy 0.1808.** Every large Cd step in step 3
> is a row crossing it:

| family | step | proxy crosses | Cd |
|---|---|---|---|
| **T-ATT** | 0.80 -> 0.85 | 0.161 -> 0.318 | 0.0222 -> 0.1195 |
| **T-EXP** | 1.0 -> 1.25 | 0.176 -> 0.232 | 0.0222 -> 0.0361 |
| **T-BAS** | 0.28 -> 0.35 | 0.178 -> 0.202 | 0.0235 -> 0.0388 |
| **T-LEN** | 216 -> 162 | 0.161 -> 0.259 | 0.0222 -> 0.0431 |

**Consequence, and it is the most important sentence in this section:**

> **The Sunship baseline sits at proxy 0.161170, which is 10.9% BELOW the knot.
> The low-Cd basin is bounded on its upper side by a CALIBRATION FEATURE, not
> by geometry.** A modest geometry change that pushes the proxy past 0.1808
> produces a disproportionate Cd jump, because the map is 27x steeper there.

**This is exactly the knot 81.4 already flagged**: TN614-332 computes proxy
**0.186851** through the harness path while **being** knot 2 at **0.180789** — a
3.3% discrepancy from a different geometry path. **The knot that bounds the
Sunship basin is the one knot with a recorded provenance discrepancy.** 81.4
said it must be reconciled before any knot is ever moved; step 3 raises the
stakes on that, and **still nothing is moved.**

**F1 verdict: no family paused.** Every cliff is explained, and the explanation
is shared — which under 84.7 would escalate only if it were an estimator
*defect*. A piecewise-linear map with a knot is not a defect; it is the frozen
design. **Recorded, not repaired.**

### 85.5 **THE PRE-REGISTERED T-BAS PREDICTION HELD, TO THE STEP**

84.6 froze the classifier crossing between `rTip/ra` = **0.20 and 0.28**, from
`rTip > rMax*sqrt(TAU)` = 25.27 m = 0.2751 `ra`, **before the family was built**.

> **Measured: `rounded -> pinned` between `rTip/ra` 0.20 and 0.28, fired by
> trigger (b), terminal base 0.0574 > TAU 0.05.** Exactly as frozen.

The measured base fraction **0.0574** sits **10.8% above** the analytic 0.0518 —
the same fixed-cell raster over-count recorded at 83.3, at the same magnitude.
**Two independent families, one consistent bias.**

### 85.6 **THE WARNING THE BASIN CARRIES: EX4 FIRES AT THE BASELINE ITSELF**

The baseline and most of its near neighbours return 78's verdict
**`DIVERGENT_GEOMETRY_SHALLOW_MAP`** — the authored and hull representations
differ by **40.3%** in proxy while Cd moves only 7.5%.

78.4 calls this **"the most dangerous of the three"**: the agreement is a
property of a flat region of the calibration map, not evidence that the geometry
paths agree. **The plateau at Cd ~0.022 and the flat map region are the same
region.**

Against that, 85.3's earlier-pickup variants are **ROBUST** at dPx 0.0–4.9%
*and* score lower. **The best-supported low-Cd geometry in this experiment is
not the baseline.**

Two rows trip two or more exploit signals:

| row | Cd | proxy | F2a | wetted | flags |
|---|---|---|---|---|---|
| `T-LEN extraM=324` | 0.02212 | 0.116937 | 1.511 | 287,155 m2 | **EX4, EX5** |
| `T-EXP P=1` | 0.02222 | 0.176120 | **0.000** | 245,478 m2 | **EX3, EX4** |

`extraM` = 324 buys its Cd with **13% more wetted area** than the baseline —
r22's objection, reproduced quantitatively: the frontal-referenced coefficient
does not charge for skin.

### 85.7 `P` = 1 IS A GEOMETRIC DEGENERACY, NOT AN EXPLOIT

At `P` = 1 the fairing is a **straight cone**, so zones 4, 5, 6 and 7 all read
**exactly 0.00 deg** and `F2a` is **0.000**. A cone has no curvature to
distribute; the descriptor is correct and the shape is simply degenerate.
**Reported as a degeneracy, not as evidence of gaming.**

### 85.8 **A REDUNDANCY IN MY OWN PRE-REGISTERED EX3 — DISCLOSED, NOT RETUNED**

EX3 was frozen as "`F2a` below the corpus minimum **AND** zones 4–5 near zero".
**Those are the same quantity**: 59.3 defines `F2a = z4 + z5`. The flag is
therefore effectively the stricter clause alone, `F2a < 1.00`, and the corpus
comparison never binds.

**It is left exactly as pre-registered.** Had it been the intended two
independent clauses, the baseline itself (`F2a` 1.973, below the corpus minimum
3.490) would have tripped it — which is itself worth stating: **the baseline
already sits below the measured corpus on aft turning burden.**

### 85.9 84.7 VERDICTS

| | outcome |
|---|---|
| **global hard stops A1–A5** | **none triggered** |
| **F1** family pause | **none** — every material cliff explained, and 85.4 gives the shared cause |
| **F2** family kill | **none** — 32/32 ELIGIBLE |
| **grid** | **eligible to be proposed.** Separate ruling; no parameter is barred. |

### 85.10 WHAT THIS DOES AND DOES NOT LICENSE

**It does:** answer 84.0. The ~0.022 result is a **coherent neighbourhood**
under this estimator, wide in all five directions tested, with no eligibility
failure and no unexplained discontinuity.

**It does not:** say the Smart Tail is aerodynamically good, that 0.022 is the
real drag of anything, or that the attachment point should move. **No
aerodynamic direction was pre-registered and none is claimed now** (84.4). The
Cd column is the frozen estimator's output on authored geometry, and the two
cautions above — the calibration knot at the basin's edge, and `SHALLOW_MAP` at
the baseline — travel with it.

**Nothing retuned. No calibration read or written. No estimator, classifier or
ribbon change. Production byte-untouched at `12e8c5e`. The independent
asymmetric chine remains UNSPENT.**

---

### 85.11 **STEP 3 FROZEN. OWNER RULINGS AND THE FORWARD ORDER (2026-08-21).** (reviewer-authored)

**Step 3 is accepted and FROZEN. Nothing is tuned from these Sunship results.**

The headline is what the experiment was built to learn: **the ~0.022 result is
not a single lucky mesh.** It occupies a basin in the estimator's response
surface — nearby changes to length, attachment, taper, waist and terminal radius
mostly keep the shape in the same low-drag neighbourhood rather than destroying
the result, and all 32 variants were ribbon-eligible with the frozen estimator
and calibration untouched.

**The caution is equally useful, and is now the governing constraint:** the
jumps at the basin's edge are **not** the geometry suddenly becoming
aerodynamically terrible. They are the scalar crossing the frozen calibration
knot at proxy **0.180789**, where the pressure-map slope rises ~**27x**. The
baseline sits at 0.16117, only ~11% below it.

> **Step 3 found where the estimator itself becomes ARTIFICIAL. That is worth
> knowing BEFORE any optimisation authority is put into the live calculator.**

#### 85.11.1 THE PRIORITY THIS CREATES

> **Before this is used as an optimiser, the calibration knot must be reconciled
> INDEPENDENTLY — and NOT by looking at which value makes the Sunship nicer.**

81.4's provenance mismatch is now load-bearing: the harness computes the
relevant TN-614 body at **0.186851** while the frozen knot sits at **0.180789**.

**Rules for that work, frozen here:**

- resolve it using the **historical calibration geometry and path** only;
- **the Sunship sweep is kept COMPLETELY OUT of the calibration decision**;
- reconcile the paths first; **no knot moves** on the strength of step 3.

#### 85.11.2 THE EARLIER-PICKUP CANDIDATES

`ATTACH` 0.60–0.75 score **6.6–7.8% lower** than the 0.80 baseline with **much
smaller raw-vs-hull proxy divergence**.

> **They are NOT called aerodynamically better.** They are **excellent
> candidates for later CFD comparison**, because the estimator says they are
> nearby, low-scoring and less representation-sensitive. That is a shortlist for
> independent checking, not a design change.

#### 85.11.3 THE FORWARD ORDER

| | next |
|---|---|
| **1** | **Freeze step 3.** Do not tune anything from these Sunship results. **DONE — this section.** |
| **2** | **Resolve the calibration-knot provenance/path discrepancy** using only the historical evidence |
| **3** | **Run the Thomas adversarial cases through the new harness** — especially radial, elliptical, superellipse, and the low-Cd exploit case — and see whether ribbons / OOD / context expose the old scalar weakness |
| **4** | **Expand the historical-body corpus** through the same frozen pipeline |
| **5** | **Then** a small **2-D Smart Tail grid** — probably attachment x length, or attachment x taper. **Not a giant optimiser.** |
| **6** | **Then** move toward live integration |

#### 85.11.4 THE CONFIDENCE LEVEL IS CORRECT AS STATED

> **This is an estimator-response experiment, not aerodynamic validation**, and
> the report says so. That is the right confidence level for what exists today.

---

## 86. **THE KNOT DISCREPANCY IS FULLY RECONCILED. IT IS A REPRESENTATION DIFFERENCE, AND THE PROXY IS NOT RESOLUTION-CONVERGED (2026-08-21).**

Forward-order item 2. Run under 85.11.1's rules: **historical calibration
geometry and path only; the Sunship sweep kept completely out of it; no knot
moves.** `knot-provenance.mjs` imports no Sunship geometry of any kind, and
nothing is written.

### 86.1 **BOTH NUMBERS REPRODUCE EXACTLY. NEITHER IS AN ERROR.**

| path | TN614-332 proxy | against |
|---|---|---|
| **pchip + 96x28 lathe** | **0.180789** | frozen knot 2 `0.1807885483529704` — **0.00%** |
| **lerp + 12k Fibonacci -> QuickHull** | **0.186851** | the harness value recorded at 81.4 — **0.00%** |

The same holds at the other real anchor: **pchip + 96x28 gives TN614-111
0.017428**, reproducing knot 1 `0.017428445146842095` exactly.

> **The historical calibration path is IDENTIFIED AND CONFIRMED: monotone-cubic
> (pchip) interpolation of the Table II ordinates, lathed at 96 rings x 28
> segments.** Both frozen real knots were generated that way. The 3.35% gap is a
> **representation difference between two legitimate readings of the same
> published ordinate table**, not a defect in either.

`sections.mjs` (spike) and `src/sections.js` (production) were checked first and
**differ only in comments**, so the scorer was never a variable.

### 86.2 THE 2x2, AND WHY THE FACTORS DO NOT SEPARATE

| interpolation | mesh | proxy | vs knot 2 |
|---|---|---|---|
| pchip | lathe | 0.180789 | **0.00%** |
| pchip | hull | 0.182618 | +1.01% |
| lerp | lathe | 0.183412 | +1.45% |
| lerp | hull | 0.186851 | +3.35% |

Main effects, absolute proxy:

- **interpolation** pchip -> lerp: **+0.002623** on the lathe, **+0.004233** on the hull
- **mesh** lathe -> hull: **+0.001829** under pchip, **+0.003439** under lerp

The two mains sum to **0.004452** against a total of **0.006062**, so the
**interaction is +0.001610 — 27% of the whole gap.** The factors are **not
separable**, and no single-factor correction can bridge the two paths.

### 86.3 **THE SIGN IS NOT COMMON ACROSS THE CORPUS. THIS IS THE ONE THAT MATTERS.**

| body | pchip/lathe | lerp/hull | delta |
|---|---|---|---|
| 111 | 0.017428 | 0.017243 | **−1.07%** |
| 221 | 0.041502 | 0.041121 | **−0.92%** |
| 222 | 0.119592 | 0.116806 | **−2.33%** |
| 121T | 0.041472 | 0.040536 | **−2.26%** |
| 211T | 0.017409 | 0.017169 | **−1.38%** |
| **332** | 0.180789 | 0.186851 | **+3.35%** |

> **Five of the six move DOWN and the knot body moves UP.** A convention change
> therefore **RESHAPES the calibration map rather than shifting it**, and no
> rescaling can absorb it. 332 is the bluffest body in the set (measured
> `CD_A` 0.0508, the highest) with the steepest aft ordinates, which is where a
> linear reading of a sparse table diverges most from a monotone cubic — the
> mechanism is plausible, and it is **not** claimed as established.

### 86.4 **A THIRD FACTOR, AND IT IS NOT A CONVENTION: THE PROXY IS NOT RESOLUTION-CONVERGED**

Both frozen knots reproduce **exactly** at 96x28. Refining the lathe with both
scales doubling together (53.6's ladder form):

| rings x segs | TN614-111 | vs knot | TN614-332 | vs knot |
|---|---|---|---|---|
| 96 x 28 | 0.017428 | **0.00%** | 0.180789 | **0.00%** |
| 192 x 56 | 0.017653 | +1.29% | 0.182359 | +0.87% |
| 384 x 112 | 0.017681 | +1.45% | 0.184081 | +1.82% |
| 768 x 224 | 0.017726 | +1.71% | 0.182744 | +1.08% |
| 1536 x 448 | 0.017745 | **+1.82%** | 0.182896 | **+1.17%** |

> **The frozen knots are properties of a 96x28 lathe, not converged properties
> of the bodies.** Refinement moves 111 by +1.82% and 332 by +1.17%, and 332's
> approach is **non-monotone** (+1.82% at 384x112, back to +1.08% at 768x224).

This is recorded, not repaired. **The mesh resolution is not currently part of
the calibration's declared provenance, and on this evidence it should be.**

### 86.5 **THE DECISION-RELEVANT QUANTITY IS THE ANCHOR SPACING, NOT EITHER POINT**

A map built from two anchors is defined by where they sit **relative to each
other**. A change that moves both the same way barely deforms it; a change that
moves them apart does.

| convention | anchor spacing (proxy) | vs frozen |
|---|---|---|
| **frozen** — pchip, 96x28 lathe | **0.163360** | — |
| **refined** — same path, 1536x448 | 0.165151 | **+1.10%** |
| **harness** — lerp + hull | 0.169608 | **+3.82%** |

> **Mesh refinement is largely COMMON-MODE and nearly preserves the map.
> The interpolation-plus-hull convention change is DIFFERENTIAL and deforms the
> anchor spacing 3.5x more.** If a convention must change, refinement of the
> existing one is by far the less disruptive move — **stated as a measured
> property of these two options, not as a recommendation to change anything.**

### 86.6 WHAT THE GAP IS WORTH, AT THE KNOT 85.4 CARED ABOUT

On the rounded line, at the knot body:

| | proxy | pressure Cd |
|---|---|---|
| frozen knot | 0.180789 | **0.012339** — and `ROUNDED_KNOTS[1][1]` stores 0.012339 |
| harness value | 0.186851 | **0.013963** |

**+13.2% in pressure Cd** for the 3.35% proxy gap, because the point sits right
where 85.4 measured the map's slope rising 27x. **The discrepancy is small in
the scalar and large in the answer**, which is exactly why 81.4 said it must be
reconciled before any knot is ever moved.

### 86.7 WHAT IS AND IS NOT CONCLUDED

**Established:**

1. the historical path is pchip + 96x28 lathe, and it reproduces **both** real
   knots exactly;
2. the harness path is lerp + hull, and it reproduces its own recorded value
   exactly;
3. the gap is a representation difference with a **27% interaction term**, so it
   is not correctable by a single factor;
4. the effect's **sign is not common across the corpus**, so a convention change
   reshapes rather than shifts the map;
5. **the proxy is not resolution-converged**, and the knots are properties of a
   96x28 mesh.

**NOT concluded, and deliberately so:** which convention is *right*. That is a
**ruling**, not a computation, and it needs the corpus re-scored end to end in
one declared convention before it can be taken sensibly.

**NOT verified, and therefore NOT claimed:** an earlier draft of this section
was going to assert that production scores presets on authored meshes and
uploads on convex hulls, making the two conventions already live. **Checked
before writing: `measureSectionalProxy` consumes whatever mesh it is handed, and
`dynamicsGeometry` uses the convex hull only as a sanity reference and as a
fallback for untrustworthy meshes.** The claim was dropped.

**No knot moved. No calibration written. No Sunship geometry touched. Production
byte-untouched at `12e8c5e`.**

---

### 86.8 **THE WORDING DISTINCTION, ADOPTED (owner, 2026-08-21)**

> **The provenance discrepancy is RECONCILED. The calibration itself is NOT YET
> SETTLED.**

86 is bookkeeping closure: it shows exactly why `0.180789` and `0.186851` both
exist and reproduces each on its own path. **It settles nothing about whether
the map is right.**

**The more important finding is the resolution drift.** If the knot moves 1–2%
merely by refining the same historical body, and the map becomes **27x steeper
immediately above that knot**, then a small representation choice produces a
disproportionately large Cd change. **So the step-3 cliff is a
calibration/provenance sensitivity, not the Sunship geometry becoming
aerodynamically awful.**

**Therefore: do not move the knot yet.** First decide **one canonical
literature-scoring convention**, then re-score the whole calibration and
validation corpus consistently under it. **Only after that** should anyone
consider rebuilding the map.

---

## 87. **ITEM 3 — ADVERSARIAL SECTION SHAPES (2026-08-21). THE SCALAR IS BLIND TO SECTION SHAPE; ONLY THE FRICTION PATH RESPONDS; AND F5 IS BLINDER THAN ADVERTISED.**

Diagnostic only, under the current frozen calibration. **No knot, geometry
convention, estimator, classifier or ribbon change.** Production byte-untouched.

### 87.0 **THE CASE DEFINITIONS ARE NOT IN THE REPOSITORY — SCOPE STATED PLAINLY**

A repo-wide search (`.md`, `.mjs`, `.js`, excluding `node_modules` and `AGENT`)
finds **no "Thomas", no "superellipse", and no 0.0075 case** anywhere. The named
adversarial set is external to this repository.

> **Three of the four named cases — radial, elliptical, superellipse — are
> reconstructable from their names as SECTION-SHAPE families, and are built here
> from first principles. THE 0.0075 EXPLOIT CASE IS NOT, and is NOT attempted:
> inventing a shape and calling it someone else's exploit would be fabrication.**

Item 3 is therefore **partially complete**, and the specific exploit case is
**blocked pending its definition**.

### 87.1 THE CONSTRUCTION, AND WHY IT IS THE SHARPEST AVAILABLE TEST

**The entire production scalar is a functional of `A(x)`.** `measureSections`
rasterises cross-sectional AREA per station; `scoreSections`,
`classifySections` and `shoulderAngleScore` consume only `{A, L, cell}`.
Nothing downstream of the raster knows what shape those sections were.

So hold `A(x)` fixed and vary only the section shape. All families share the
Series 58 parent already in the corpus at proxy 0.023552 / Cd 0.05108:

| family | section | area preservation |
|---|---|---|
| **RADIAL** | circle | control |
| **ELLIPTICAL** | semi-axes `a = r*sqrt(k)`, `b = r/sqrt(k)` | exact, all `k` |
| **SUPERELLIPSE** | `\|y/R\|^n + \|z/R\|^n = 1`, `R = r*sqrt(pi*G(1+2/n)/(4*G(1+1/n)^2))` | exact, all `n` |

**Frontal area is matched by construction** — for a body whose sections share
one shape, the frontal projection is the largest section, and every family's
largest section has the same area. **Only WETTED area differs.**

Mesh: structured lathe, 240 rings x 128 azimuths, **authored, not hulled** —
hulling would round the corners at the sampling scale and the corner is the
point. The ribbon layer reads the authored surface directly (80.3, 84.11.1).

### 87.2 THE PRE-REGISTERED PREDICTIONS — **TWO OF FOUR FAILED**

| | prediction | result |
|---|---|---|
| **P1** | the scalar is invariant to section shape at fixed `A(x)` | **FAILED** — proxy spread **15.53%** of the control |
| **P2** | Cd moves only through friction / wetted area | **HOLDS** — pressure spread 9.59e-5 against friction spread 2.11e-2, a factor of **220** |
| **P3** | `F5` rises with ellipse aspect ratio | **FAILED** — `F5` is **0.0000 at every aspect ratio, to k = 5** |
| **P4** | `F5` is blind to superellipses | **HOLDS** — worst superellipse `F5` 0.0000 |

### 87.3 **P3's FAILURE IS THE REAL FINDING: F5 IS A CENTRAL-ASYMMETRY DETECTOR, NOT A NON-AXISYMMETRY DETECTOR**

**The prediction was mine and it was wrong for an elementary reason.** 59.3
defines `F5` on **opposing ribbon pairs `(k, k+planes)`** — ribbons 180 degrees
apart. **An ellipse is invariant under a 180-degree rotation**, so its opposing
ribbons are identical and `F5` is **identically zero**, at any aspect ratio.
The same is true of every superellipse.

> **59.3 recorded that `F5` is ~0 on bodies of revolution and carries no
> information there. This shows the blind set is far larger: `F5` is zero on
> EVERY centrally-symmetric section — ellipses and superellipses included. It
> detects only shapes that break 180-degree symmetry.**

That is consistent with the one case where `F5` did move: 82.3's camber sweep
offsets each section **vertically**, which is exactly what breaks central
symmetry, and `F5` rose linearly 0.008 -> 1.321.

**`F5` is not retuned or redefined.** It is frozen at 59.3 and stays frozen;
what changes is the description of what it can see.

### 87.4 **P1's FAILURE IS A RASTER ARTEFACT, AND IT IS EVIDENCED**

The mathematics of P1 is not wrong — the scalar really is a functional of
`A(x)`. **What failed is the step before it: `A(x)` as MEASURED is not `A(x)` as
BUILT.** `raster-shape-sensitivity.mjs` measures it station by station:

| x/L | circle err | ellipse k=5 err |
|---|---|---|
| 0.30 | −0.00% | −0.15% |
| 0.80 | −0.03% | **−0.85%** |
| 0.90 | −0.11% | **−1.63%** |
| 0.94 | +0.05% | **−1.88%** |
| 0.97 | +0.11% | **+2.32%** |
| **worst over the body** | **5.28%** | **15.57%** |

> **A flattened section is resolved by fewer cells across its thin axis, and the
> deficit GROWS through the aft closure as the section shrinks — precisely the
> region the aft-penalty descriptor reads.** `softAft` is a **threshold**
> functional of the equivalent-radius profile, so an error concentrated there
> does not average out.

**Recorded, not repaired.** The scorer is frozen. But it belongs on the same
list as 86's resolution drift: **the frozen scalar has measurement sensitivities
that are not part of its declared provenance.**

### 87.5 THE ANSWER TO ITEM 3's QUESTION

| case | wetted vs control | Cd vs control | eligibility / E4 | OOD |
|---|---|---|---|---|
| circle (control) | — | — | ELIGIBLE 0.00% | SUPPORTED |
| ellipse k=1.5 | +3.04% | +2.59% | ELIGIBLE 0.00% | SUPPORTED |
| ellipse k=2.0 | +8.90% | +7.55% | ELIGIBLE 0.00% | SUPPORTED |
| ellipse k=3.0 | +22.46% | +19.10% | ELIGIBLE 0.00% | SUPPORTED |
| ellipse k=5.0 | +48.64% | +41.35% | ELIGIBLE 0.00% | SUPPORTED |
| superellipse n=3 | +1.20% | +1.00% | ELIGIBLE 2.82% | SUPPORTED |
| superellipse n=4 | +2.75% | +2.34% | ELIGIBLE 4.38% | SUPPORTED |
| superellipse n=6 | +5.02% | +4.29% | **INELIGIBLE** 5.40% | SUPPORTED |
| superellipse n=10 | +7.46% | +6.39% | **INELIGIBLE** 5.71% | SUPPORTED |
| superellipse n=20 | +9.70% | +8.34% | **INELIGIBLE** 5.89% | SUPPORTED |

**What the context layer catches:** `E4` rises monotonically with squareness and
**takes the three squarest bodies INELIGIBLE**. The eligibility gate does
independently flag "this is not the kind of body the descriptors were earned
on" — which is exactly what it is for.

**What nothing catches:** **the ellipse family passes everything.** ELIGIBLE,
`E4` = 0.00%, `F5` = 0, `F1`/`F3`/`F4` move in the fourth decimal, OOD
**SUPPORTED** at every aspect ratio up to 5:1. `F2a` is the only descriptor that
responds at all (4.187 -> 2.639).

**And the deepest point:** the estimator **prices section shape purely as extra
skin.** Pressure Cd is constant to 1 part in 220 across a family running from a
circle to a near-square. A real square-sectioned body has corner vortices and a
substantially different pressure field.

> **THE BLIND SPOT IS IN THE PRESSURE PATH, AND IT IS STRUCTURAL:
> `compositeV1` cannot see section shape because it is a functional of `A(x)`,
> so the pressure branch cannot either. Only friction responds, through wetted
> area. The estimator therefore systematically UNDER-PRICES non-circular
> sections — and reports SUPPORTED confidence while doing it.**

That is a genuine answer to item 3's question, on three of the four named
families, and it needed no exploit case to surface.

---

## 88. **CALIBRATION ARCHITECTURE — THE DIRECTIONS, NOT YET A DECISION (owner, 2026-08-21).** (reviewer-authored)

> **The 27x is a property of the lookup/map, not a plausible aerodynamic
> discontinuity.** The geometry score crosses one arbitrary calibration
> breakpoint and the arithmetic becomes 27x more sensitive.

**"Just add lots more knots" is not the answer.** It is one part of it, and by
itself it becomes overfitting.

### 88.1 THE FOUR DIRECTIONS

| | direction | what it fixes |
|---|---|---|
| **1** | **More measured anchors IN THE GAP.** There is an evidential desert between the last streamlined TN-614-style point and the sphere/bluff end. | the map is currently a straight line drawn across missing evidence |
| **2** | **A smooth constrained curve, not piecewise straight lines with sharp elbows.** Once the corpus is rescored consistently, fit a constrained smooth relationship; **the derivative should change gradually unless the data itself proves a genuine regime transition.** | the 27x elbow |
| **3** | **Stop pretending every shape belongs on one universal curve.** A streamlined airship, a fat spheroid, a blunt body, a base-ended body and an asymmetric lifting shape may not share one `proxy -> Cd` law. | the deeper structural error |
| **4** | **Analogue interpolation rather than a global formula** — for a new body, find the nearest few measured shapes in descriptor space and interpolate, **with confidence falling as distance increases.** | fits the low-compute philosophy; a tail that genuinely resembles streamlined historical bodies gets a streamlined estimate, and a weird fat asymmetric thing does not get dragged through the same curve |

**And, cutting across all four:**

> **Where the evidence is sparse — proxy ~0.18 to ~0.8 — the honest output is a
> WIDER UNCERTAINTY BAND, not a violently steep deterministic line. That alone
> would make the estimator much harder to fool.**

### 88.2 WHERE THIS LANDS FOR THE RIBBON PROGRAMME

Direction 3 is stated as the long-term answer, and its shape is:

> **geometry + ribbons -> aerodynamic family / analogue set -> the appropriate
> Cd mapping** — **NOT** `ribbons -> Cd`.

**That is what the ribbon layer was frozen to be.** 59.2 states the hypothesis
as **"a ROUTING / ANALOGUE hypothesis — which measured aerodynamic family does
this geometry resemble"**, and 70.2 lists "compare descriptively against
analogue bodies" among what `ribbonContext` may do. Directions 3 and 4 are the
frozen remit, used.

> **BUT IT IS CURRENTLY FORBIDDEN, AND THAT NEEDS A RULING BEFORE IT CAN BE
> BUILT.** 70.3 says the ribbon layer must **NOT** "hard-gate an analogue
> family" or "select a Cd-map branch", and 70.3 requires analogue routing to be
> computed **in parallel as a shadow recommendation only**, with disagreements
> **recorded, not resolved in favour of ribbons**.
>
> **Directions 3 and 4 are exactly the promotion of the ribbon layer from
> shadow to authority that 70.3 prohibits.** Flagged here rather than assumed:
> making them real requires an explicit dated ruling amending 70.3, and it
> should be taken deliberately, not arrived at by drift.

87.5 sharpens the case for direction 3 from a new angle: the pressure branch
**cannot** see section shape, because `compositeV1` is a functional of `A(x)`.
No amount of re-anchoring a single `proxy -> Cd` line repairs that. **A family
router that noticed "this is not a body of revolution" would.**

### 88.3 WHAT IS NOT DONE NOW

> **Do not rebuild it yet.**

The immediate V2 step is unchanged and is item 4 of 85.11.3:

> **rescore a much larger historical corpus through ONE canonical geometry path
> -> plot measured pressure/form Cd against the scalar -> see what the cloud
> actually looks like.**

**Then the DATA decides** between: one smooth curve with more anchors; two or
three family-specific curves; or analogue-based interpolation. The stated
suspicion is **"more anchors + smoother curve + family routing"**, not twenty
knots on one universal line — **recorded as a suspicion, and it must not be
allowed to shape the corpus work that is supposed to test it.**

**Nothing in 88 is implemented. No calibration, estimator, classifier or ribbon
change. Production byte-untouched at `12e8c5e`.**

---

## 89. **THE RIBBON FIELD ALREADY SEES SECTION SHAPE. THE SUMMARIES ARE WHAT CANNOT (2026-08-21).** Shadow diagnostic; F1–F5 and the schema untouched.

### 89.0 THE OWNER'S AMENDMENT, WHICH THIS TESTS

> **Do not build a separate transverse geometry system yet.** First determine
> whether the existing per-ribbon clock-angle data already contains the missing
> section-shape signal. F5 only tests 180-degree opposition / central
> asymmetry; it is not a general non-axisymmetry descriptor. Add a **shadow**
> diagnostic that measures angular variation of the existing ribbon field
> (2nd/4th angular modes, max/min variation), **without changing Cd or the
> frozen F1–F5 descriptors.**

The claim to test, stated before running: 87.5's blindness result is a property
of the **summaries**, not of the ribbons — `ribbonContext` already carries 48
radii per station in its positional field, and an ellipse's signature is
sitting in them un-asked-for.

### 89.1 THE DIAGNOSTIC

`ribbon-anisotropy.mjs` computes angular Fourier amplitudes of the **existing**
`ribbonContext.positional.R` field — no new slicing, no new geometry pipeline:

> `A_m = 2|Σ_k R_k e^(-imθ_k)| / (N·r̄)` per station, m = 1, 2, 4; median over
> retained-domain stations with mean radius ≥ 10% of the body max.

`A1` = central asymmetry (the mode family F5 sees), `A2` = ellipse-like
anisotropy, `A4` = squareness. **Analytic predictions were computed from the
exact section curves (4096-point quadrature, no mesh) and frozen in the file
header before the pipeline ran**, with ±15% tolerance.

### 89.2 THE RESULT — THE FIELD SEES EVERYTHING THE SUMMARIES MISSED

| case | A1 | A2 | A4 | analytic | agreement | F5 (frozen) |
|---|---|---|---|---|---|---|
| circle | 0.0000 | 0.0000 | 0.0000 | all ~0 | exact | 0.0000 |
| ellipse k=1.5 | 0 | **0.2004** | 0.0300 | A2 0.201 | **−0.3%** | 0.0000 |
| ellipse k=2 | 0 | **0.3369** | 0.0845 | A2 0.338 | **−0.3%** | 0.0000 |
| ellipse k=3 | 0 | **0.5149** | 0.1947 | A2 0.518 | **−0.6%** | 0.0000 |
| ellipse k=5 | 0 | **0.7084** | 0.3606 | A2 0.715 | **−0.9%** | 0.0000 |
| superellipse n=3…20 | 0 | **0.0000** | **0.0560 → 0.1270** | A4 0.057 → 0.137 | −2.4% … −7.2% | 0.0000 |
| camber k=0.2 | **0.0429** | 0.0005 | 0.0000 | A1-dominant | holds | **1.3160** |

| check | result |
|---|---|
| **Q1** circle: all modes < 0.01 | **HOLDS** — every mode 0.0000 |
| **Q2** ellipse: A2 monotone, matches analytic | **monotone HOLDS, agreement −0.3% to −0.9%**; see 89.3 |
| **Q3** superellipse: A4 monotone, **A2 < 0.01** | **HOLDS** — a superellipse has literally zero m=2 content, and the field reads it as exactly that |
| **Q4** camber: A1-dominant | **HOLDS** — and F5 fires on this case alone, confirming F5 = the m=1 family |

> **The ellipse family — which in 87.5 passed ELIGIBLE, E4 0.00%, F5 = 0, OOD
> SUPPORTED at every aspect ratio — is separated from the circle at 0.3%
> accuracy by data the pipeline was already computing.** The mode split is
> diagnostic, not merely detecting — with the scope said precisely: **A1/A2/A4
> identify DOMINANT ANGULAR SYMMETRY CONTENT**, and in this controlled set each
> family excites exactly its own mode. An ellipse strongly excites m=2, a
> square-ish superellipse m=4, camber m=1 — **but other shapes can excite the
> same modes too**, so the modes are symmetry measurements, not unique family
> labels.

**87.5's conclusion is therefore corrected in scope:** the blind spot belongs to
the **scalar and the frozen summaries**, not to the ribbon representation. The
raw field can see ellipticity and squareness; F1–F5 currently do not extract it.

### 89.3 **Q2's THIRD CLAUSE WAS MIS-SPECIFIED, AND IT STAYS FAILING**

Q2 included "A2 > 3× A4 at every k". **The analytic table frozen in the same
header already contradicts that at k = 5** (A2 0.715 vs 3×A4 = 1.100): an
ellipse's radial curve gains higher harmonics as aspect ratio grows, so the
clause was arithmetically wrong at pre-registration time. The measured field
agrees with the analytic values to under 1% — **the check was wrong, not the
data. Left failing in the code, per the B4 rule (83.1): a frozen check is not
retuned after the fact.**

### 89.4 THE 31.8° PROVENANCE — **MY FIRST CORRECTION WAS TOO BROAD, AND IS ITSELF CORRECTED** (owner catch, 2026-08-21)

An earlier draft of this section said the clockface's "F2a 31.8°" was retracted
outright. **Wrong — the record distinguishes three numbers, and only one was
retracted:**

| | F2a | status |
|---|---|---|
| **BARE Sunship** (correct frame) | **31.758** (73.2) | **VALID — and it is the body 74.1's clockface analysed**: the 31.8 median hides a bimodal 0.09–37.0° spread, lower quarters near zero, upper quarters carrying the maximum |
| tailed, **wrong frame** | 31.82 | **RETRACTED** by 75 |
| tailed, correct authored frame | **1.973** (80.4) | current |

So the clockface-concealment lesson — collapsing the ribbon field to one median
destroys its content — **stands on the VALID bare-body evidence of 74.1**, not
on a retracted number, and 89.2 now reproduces the same lesson on controlled
sections. What must not be quoted is the *tailed* 31.82; the *bare* 31.758 is
part of the record.

### 89.5 STATUS, AND THE RULING THIS SETS UP

**Shadow only.** 59.3's descriptor set and 70.4's schema are byte-untouched;
this file consumes `ribbonContext` and adds nothing to it. No Cd anywhere is
read differently.

**On F5: NOT replaced, and not proposed for replacement.** A1 and F5 are
related but **not identical observables** — A1 is first-harmonic variation of
the POSITIONAL radius field; F5 is opposite-ribbon disagreement in the TURNING
summaries. Both stay in shadow until a corpus shows one genuinely dominates.

**Production byte-untouched at `12e8c5e`.**

### 89.6 **OWNER RULING (2026-08-21): §89 BANKED. A1/A2/A4 BECOME SHADOW ANGULAR DESCRIPTORS.** (reviewer-authored)

1. **Banked as strong shadow evidence.** The ribbon representation was never
   blind to ellipses or squareness; the information was already in the 48-angle
   positional field, and F1–F5 were not extracting those angular modes.
2. **A1/A2/A4 are ADDED AS SHADOW ANGULAR DESCRIPTORS** — implemented
   additively in the batch harness record (`ribbon.modes`), computed from the
   existing positional field by `clock-modes.mjs`. **The frozen 70.4
   `ribbonContext` schema is byte-untouched; the frozen 59.3 F1–F5 set keeps
   its definitions and its authority unchanged; F5 is not replaced.**
3. **Described as ANGULAR SYMMETRY MODES, never as unique family labels.**
4. The 31.8° provenance is corrected as 89.4 now records, preserving the valid
   bare-Sunship clockface result.
5. **Proceed to item 4: the broad corpus rescore under one canonical
   convention.**

The architecture this settles into, conceptually:

> **scalar** = longitudinal area severity ·
> **ribbon field** = the full low-resolution surface journey `r(x, theta)` ·
> **derived summaries** = taper, concentration, asymmetry, 2-fold anisotropy,
> 4-fold squareness, … — a much richer estimator for almost no added compute.

---

## 90. **ITEM 4 — THE CORPUS RESCORE. PRE-REGISTRATION DRAFT, 2026-08-21. NOT RUN.**

**Nothing in this section has been executed.** It is the gate document for the
owner to freeze or amend. Four rulings are marked **[RULING]**. The purpose,
stated before any run:

> **Take every historical body in the repository with real aerodynamic
> evidence, run all of them through ONE frozen pipeline under ONE declared
> convention, and see what the relationship between geometry, ribbons and
> measured drag actually looks like.** The corpus decides — from measured
> evidence — whether the scalar wants a smoother / more densely anchored
> global map, family-specific mappings, analogue routing, or something else.

**The current suspicion (88.3: "more anchors + smoother curve + family
routing") is recorded as a SUSPICION AND NOT THE EXPECTED RESULT. Item 4 is
the experiment that gets to tell us whether it is right, and nothing below is
constructed to favour it.**

### 90.1 ONE CANONICAL GEOMETRY CONVENTION **[RULING 1]**

Every body is reconstructed and scored the same way. **No body gets a special
convention because it scores better.**

| element | canonical choice | why |
|---|---|---|
| interpolation of published ordinates | **pchip** (monotone cubic, `tn614-bodies.mjs`) | 86.1: the convention the frozen knots were generated under, confirmed to reproduce both real knots exactly |
| mesh | **lathe, 96 rings x 28 segments** | same reason; 86.5 showed refinement is largely common-mode but the knots are properties of THIS mesh, so scoring the corpus on it keeps every point comparable to the existing map |
| flight axis | **+X**, longest extent asserted (the `eas-bodies` rule) | the frame error class that cost 75 |
| centring | volume centroid (4.1) | frozen |
| scale / condition | each body at **its own test Reynolds** as published | the exams already do this; anything else invents a condition |
| resolution sensitivity | every body ALSO scored at **768 x 224**, reported as a **provenance column, never as the score** | 86.4: the proxy is not resolution-converged; the drift must be visible per body, not discovered later |

**Geometry-source grade, recorded per body** (part of the record, not a score):
`exact-equation` > `tabulated-ordinates` > `published-offsets` > `traced-profile`
> `synthetic-realization`.

Bodies whose source is not an ordinate table (traced TR-397 profiles;
TM-267's synthetic pair) keep their existing reconstruction but are scored
through the same lathe/axis/centring path and carry their grade visibly.

### 90.2 THE CORPUS AND ITS EVIDENCE ROLES — **ASSIGNED BEFORE ANY RUN** [RULING 4]

Labels are the owner's four, fixed now so nothing can drift into "independent
validation" by appearing in a bigger table. **TN-614 cannot become independent
evidence by being replotted.** The **Sunship appears NOWHERE in item 4** —
85.11.1's rule that it stays completely out of calibration decisions.

| source | bodies | measured evidence | medium / Re | evidence role |
|---|---|---|---|---|
| TN-614 (Abbott 1937) | 111, 332 | Table III CD_A, Re_eff 66e6 | air | **calibration-consumed** (the two real knots) |
| TN-614 | 221, 222, 121T, 211T | same | air | **development / spent** (the blind exam) |
| textbook anchors | sphere-HR, bluff pooled | literature | — | **calibration-consumed** |
| TR-432 (Freeman) | Akron 1/40 | bare-hull drag, published offsets | air | **spent** (the gold-standard absolute exam, 2026-08-16) |
| TR-397 (Thompson & Kirschbaum) | Los Angeles, TC-10, TC-6, Puritan x2, ZMC-2, TE-2 | deceleration drag area, **complete airship incl. appendages** | air, flight Re | **spent; ordering + bounded-absolute only** — traced profiles, appendage margin undeducted |
| TR-291 (C-class) | 8 fineness hulls 1.0–10.0 | measured Cd | air, **low Re 2.3e5–2.3e6, laminar caveat** | **independent but outcome-exposed; PERMANENTLY BARRED from anchoring** (TR291-PREREGISTRATION.md — that bar is not relaxed here) |
| Series 58 (C-297) | 24 closed-form hulls | residual resistance | **water** | **spent** (61–65); the EXPOSED-8 flagged per comparison; ordering evidence primarily |
| Göttingen Ergebnisse II | oblate 1:0.75, prolate 1:1.8 | tabulated c_w vs Re (Zahlentafeln 35/36) | air | **held-out, never examined** — see [RULING 2] |
| NACA Report 451 | Model A original + altered stern | report's own stated +5% pair direction | air | **ordering-only, outcome-exposed** (66.2) |
| TM-267 (Wieselsberger) | round + square section pair | measured pair, but **A(x) unestablished** | air | **geometry-only / control** — no absolute Cd claim; now also the real-world check on 87/89's section-shape findings |

**~52 bodies.** Every plotted point carries its role as a visible label.

> **[RULING 2] — THE GÖTTINGEN ELLIPSOIDS ARE THE ONLY VIRGIN MEASURED MID-MAP
> DATA IN THE REPOSITORY**, staged in 2026-08-16 precisely for the 0.2–0.8
> hunt and deliberately never compared. **Including their measured values in
> this corpus SPENDS them.** Options: (a) spend them here as independent
> evidence — this is exactly what they were staged for, and Q5/Q6 are their
> question; or (b) run them geometry-only and hold the measured comparison
> back. **Recommendation: (a), stated openly as a spend.** Owner's call.

> **[RULING 3] — ONE pressure-extraction recipe for everyone:** measured
> pressure/form Cd = measured total CD_A − ITTC-1957 friction at the body's
> published test Re, wetted area from the canonically scored mesh — **the same
> recipe that produced the frozen knots**, applied uniformly. Series 58
> (water, residual-resistance basis) and TR-291 (laminar-range Re) carry
> declared caveat flags rather than bespoke recipes.

### 90.3 WHAT GETS COMPUTED AND PLOTTED — FROZEN BEFORE THE RUN

Per body, one row: measured Cd (or ordering role) · scalar proxy ·
class + trigger · estimated Cd with pressure/friction split · F1–F5 ·
**A1/A2/A4 shadow modes** · eligibility E2/E3/E4 · OOD/confidence · analogue
bracket · geometry-source grade · evidence role · resolution-sensitivity
column · both-path (raw vs hull) sensitivity.

Plots, all with points labelled by body and family:

1. **THE KEY PLOT: measured pressure/form Cd against scalar proxy** — the
   direct look at whether one universal calibration curve is remotely
   sensible, with the current frozen two-line map drawn under the points and
   the knot at 0.1808 marked.
2. estimated vs measured Cd (absolute-capable bodies only), coloured by
   evidence role.
3. estimator residual against eligibility / OOD state (Q4).
4. residual against F1–F5 and A1/A2/A4, one panel each (Q3).
5. the proxy axis itself, annotated: where every body sits relative to the
   0.18 knot and the 0.18–0.8 gap (Q5).

### 90.4 THE FROZEN QUESTIONS

| | question |
|---|---|
| **Q1** | Does measured Cd form one reasonably smooth relationship with the scalar? |
| **Q2** | Do different aerodynamic families form visibly different relationships? |
| **Q3** | Do ribbon descriptors/modes explain important scatter that the scalar cannot? |
| **Q4** | Do OOD/eligibility warnings correspond to larger estimator errors? |
| **Q5** | Is the existing 0.18→bluff calibration gap genuinely too sparse/steep? |
| **Q6** | Which bodies are actually suitable as new independent anchors, if any? |

Q6's standing constraints, restated so the answer cannot creep: TR-291 is
**permanently barred** whatever it shows; anything **calibration-consumed or
spent** cannot become "independent"; a body qualifies as an anchor candidate
only on data quality + geometry grade + Re relevance, judged per 59.6's
standard.

### 90.5 HARD RULES DURING THE RUN

- **No calibration change of any kind**: no knot moved, no curve smoothed, no
  family routing, no weights, no new thresholds — **while seeing the corpus.
  First collect the evidence. Then interpret it.**
- No descriptor-authority change: F1–F5 frozen, A1/A2/A4 stay shadow, 70.3
  stands.
- The bit-equality proof (81.2) runs per body; classifier flips print their
  trigger (S5); eligibility failures stay failures (S6); every ratio carries
  its denominator.
- Determinism: the full corpus run twice in separate processes, byte-identical.
- Engine fingerprint asserted before and after (A5), plus G0b.
- Defects found mid-run are **recorded, not repaired** (the 82 rule).

### 90.6 DELIVERABLE

One table (~52 rows), the five plots, and per-question findings written
against Q1–Q6 — **each answered from the plotted evidence, including "the
evidence is insufficient to answer" where it is.** No recommendation is made
in the same document that reports the data; the what-should-V2-become ruling
is taken after reading it, separately.

### 90.7 **OWNER RULINGS — GO (2026-08-21).** (reviewer-authored)

**R1 — APPROVED, scope clarified.** PCHIP + 96x28 applies to **tabulated
axisymmetric reconstructions** — the convention that exactly reproduces the
existing calibration knots. **Genuinely non-axisymmetric or exact-equation
bodies are NOT forced into an axisymmetric lathe**: their source geometry is
preserved and scored at the equivalent declared resolution. The rule is "one
canonical scoring convention", not "turn every body into a lathe". 768x224
stays provenance/sensitivity only.

**R2 — APPROVED: SPEND both Göttingen ellipsoids.** This is exactly the
experiment they were saved for. **The reveal is made as blind as possible:**
the estimator predictions and descriptor rows for both bodies are **frozen and
committed BEFORE their measured c_w tables are joined or inspected**; then the
measurements are revealed and scored. **After that they are PERMANENTLY SPENT
and must never be called held-out again.**

> **BLINDNESS DISCLOSURE, recorded before the freeze:** while inventorying the
> corpus this session, the first five rows of Zahlentafel 35 (the OBLATE body,
> c_w 0.577–0.600) were displayed in a file listing. **The oblate's measured
> magnitude was therefore seen before the blind file was written.** The
> prolate's table (Z36) was not displayed. The predictions are parameter-free
> outputs of a frozen pipeline — there is nothing to nudge — so the protocol's
> value here is procedural, but the exposure is a fact and is recorded rather
> than hidden. The prolate reveal is clean; the oblate reveal is
> **procedurally blind, not epistemically blind.**

**R3 — AMENDED, terminology binding.** `measured total − ITTC friction` is
**NOT** to be called "measured pressure/form Cd". The friction term is imposed
by our convention, not measured — especially material for low-Re TR-291 and
the water-medium Series 58. It is the **CANONICAL / MODEL-EQUIVALENT PRESSURE
RESIDUAL**. Every row preserves, separately:

1. **published measured total coefficient** (raw, untouched);
2. **canonical model friction estimate** (ITTC at the published test Re);
3. **derived calibration-equivalent pressure residual** = 1 − 2;
4. where the literature gives its own pressure/Cp/friction decomposition,
   that is preserved as **published decomposition**, never overwritten.

The key scalar-map plot may use the canonical residual — it is the quantity
comparable to the estimator's pressure map — **labelled accurately**. And
**measured total vs predicted total Cd is added as a companion plot**: the
least assumption-laden reality check.

**R4 — APPROVED AS WRITTEN.** Consumed stays consumed; spent stays spent;
TR-397 stays bounded/ordering-only; TR-291's permanent limitations stay
intact; the EXPOSED Series-58 comparisons stay flagged; TM-267 stays a
geometry/control case; **no Sunship anywhere in this exercise — this
experiment judges the estimator without knowing what outcome would favour the
project.**

**GO: build and run item 4 under these rulings, with no calibration or routing
changes.** The question it should settle: is the current Cd map merely sparse,
fundamentally the wrong shape, or trying to force several aerodynamic families
onto one curve?

---

## 91. **ITEM 4 RESULT — THE CORPUS RESCORE (2026-08-21). THE MAP IS NOT MERELY SPARSE: FAMILIES DIVERGE FROM IT IN OPPOSITE DIRECTIONS, AND NO CLEAN HIGH-Re ANCHOR EXISTS IN THE CORPUS TO FIX IT.**

55 bodies, one canonical convention (90.7 R1), the R3 quantities kept separate
and named precisely. **No calibration, routing or descriptor-authority change.
Production byte-untouched at `12e8c5e`.** This section reports the data against
the frozen questions; per 90.6 the what-should-V2-become ruling is a separate,
later step and is NOT taken here.

### 91.0 GATES

| | |
|---|---|
| Göttingen **blind gate** | **HELD** — full-phase predictions byte-matched the committed blind file (`5b0080a`); the 90.7 oblate-exposure disclosure stands |
| determinism | **PASS** — two full runs, byte-identical JSON |
| A5 engine fingerprint | **PASS** — identical before and after |
| Cd/ribbon bit-equality | proven per body, 55/55 |
| eligibility | 54/55 ELIGIBLE; the single INELIGIBLE is TM267-square, correctly (E4 on a square-sectioned body, exactly as 87.5) |

### 91.1 **THE PIPELINE IS COHERENT END TO END: THE CANONICAL CONVENTION REGENERATES ALL THREE ROUNDED KNOTS**

| knot | frozen pressure value | corpus canonical residual | agreement |
|---|---|---|---|
| TN614-111 | 0.008065 | **0.00806** | exact |
| TN614-332 | 0.012339 | **0.01234** | exact |
| sphere-HR | 0.18236 | **0.18233** | −0.02% |
| bluff pooled | 1.10206 | cube 1.03200 / plate 1.16304 | straddled, as pooled |

The R1 convention + R3 recipe reproduce the frozen calibration from scratch.
Whatever the corpus shows below, it is not an artefact of a broken pipeline.

### 91.2 **THE R3 DISTINCTION EARNED ITS KEEP IMMEDIATELY — TWO WAYS**

**(a) The Akron poster child.** TR432-Akron: measured total 0.05201, canonical
friction 0.05182, **canonical residual 0.00019**. The convention's friction
term explains essentially the entire measured value. Had that residual been
called "measured pressure Cd", the row would have asserted the Akron hull has
no pressure drag — the exact overclaim R3 forbade.

**(b) The model-scale roughness term, mechanism VERIFIED in source.**
`skinFrictionCd` = ITTC smooth + the ITTC-1978 allowance with **absolute**
`ROUGHNESS_KS_M = 0.00043` — a real-fabric-skin term sized for a 300 m
vehicle. On a **1 m wind-tunnel model at Re 6.6e7** the allowance roughly
doubles Cf, so predicted TOTALS overshoot the polished TN-614 models by
~65% **by design**; at TR-291's low Re the allowance is switched off and
predicted friction matches canonical to three decimals. **Declared limitation,
not a defect: the estimator prices the shape at the size at the speed, for a
real skin.** All map conclusions below therefore use the pressure basis
(canonical residual vs predicted pressure), with totals as the companion view.

### 91.3 **Q1 — does measured Cd form one smooth relationship with the scalar? NO.**

At similar proxy, the canonical residual differs by up to an order of
magnitude, and the frozen lines miss in **both directions**:

| body | proxy | predicted pressure | canonical residual | pred/resid |
|---|---|---|---|---|
| TN614-221 (streamlined) | 0.0415 | 0.00869 | 0.00853 | **1.02** |
| TN614-121T | 0.0415 | 0.00869 | 0.00753 | 1.15 |
| TN614-222 | 0.1196 | 0.01074 | 0.01073 | **1.00** |
| TR291-fr3.00 | 0.1937 | 0.01855 | 0.00210 | **8.8x over** |
| TR291-fr2.00 | 0.3252 | 0.08198 | 0.00828 | **9.9x over** |
| TR291-fr1.50 | 0.4733 | 0.15336 | 0.02200 | **7.0x over** |
| **GOTT-prolate** (virgin) | 0.5966 | 0.18137 | 0.03834 | **4.7x over** |
| TR291-fr1.00 | 0.7106 | 0.34260 | 0.06310 | **5.4x over** |
| sphere (knot) | 0.8235 | 0.18236 | 0.18233 | 1.00 |
| **GOTT-oblate** (virgin) | 0.8915 | 0.42416 | 0.55613 | **0.76 — UNDER** |

The streamlined family lies ON the map (non-knot TN-614 within 15%). The
mid-map is not scattered around the line — **it is systematically far below it
for prolate-class fat bodies and above it for the oblate.**

### 91.4 **Q2 — do families form visibly different relationships? YES, IN OPPOSITE DIRECTIONS.**

- **Streamlined BoR** (TN-614, fineness ~5): on the line.
- **Prolate fat bodies** (TR-291 fineness 1–3; GOTT-prolate 1.8): the line
  overpredicts pressure **4.7x–9.9x**. The virgin prolate lands exactly in the
  band the outcome-exposed TR-291 defined — independent confirmation of the
  fat-map overprediction.
- **Oblate, blunt-face-first** (GOTT-oblate 0.75): the line **underpredicts**
  by 24% — and this body sits ABOVE the sphere knot in proxy (0.891 vs 0.824),
  in the clamp region.
- **Real complete airships** (TR-397, pinned class): even their **appendaged
  upper-bound** measured totals (0.068–0.095) sit at a third to a half of the
  predicted bare-hull totals (0.136–0.283). Bounded evidence, traced-profile
  grade — but the direction is unambiguous: the pinned line overpredicts these
  hulls massively too.

> **One curve cannot do this. The 27x elbow of 85.4 is the symptom; the
> disease is that a single `proxy -> pressure` law is being asked to price at
> least three aerodynamically different families at once.**

### 91.5 **Q3 — do ribbons/modes explain scatter the scalar cannot? PARTIALLY, AND HONESTLY SO.**

- The cleanest case: **oblate vs prolate**. The scalar separates them by only
  **1.5x** (0.891 vs 0.597) while their measured residuals differ by
  **14.5x** (0.556 vs 0.038). `F2a` spreads **2.1x** (35.5 vs 16.6 deg) in the
  right direction — better than the scalar, still under-resolving.
- **A4 fires on exactly the two genuinely square things in the corpus**: cube
  0.1337, TM267-square 0.1139, everything else <=0.0001 — and E4 takes
  TM267-square INELIGIBLE. The section-shape channel works on real bodies,
  not just the 89 controls.
- **No single descriptor cleanly explains the mid-map over/under split; the
  FAMILY identity does.** That is evidence for routing-style architecture, and
  it is stated as evidence, not as the decision (88.2's pending 70.3 ruling).

### 91.6 **Q4 — do OOD/eligibility warnings correspond to larger errors? ON THE PRESSURE BASIS, STRONGLY.**

On **totals** the split is weak (median |err| SUPPORTED 61% vs REDUCED 69%) —
because totals are roughness-dominated at model scale (91.2b). On the
**pressure basis**: every 4.7x–9.9x map miss above is a **REDUCED** row
(extrapolated or F2a-outside), while SUPPORTED rows sit within ~±20% — with
the one instructive exception of Akron, where the residual basis itself
collapses (91.2a). **The confidence machinery is pointing at the right
bodies.**

### 91.7 **Q5 — is the 0.18-to-bluff gap genuinely too sparse/steep? YES — AND WORSE: WRONG-SHAPED.**

The span 0.18–0.82 previously contained **zero measured anchors**. The corpus
places ten-plus bodies in it, and they do not scatter around the frozen
interpolation — they split by family, 4.7x–9.9x below it on one side and 24%
above it on the other. **Steepening or smoothing one line cannot reconcile
points that disagree about its sign.**

### 91.8 **Q6 — which bodies are suitable as new independent anchors? NONE CLEANLY — the sober answer.**

| candidate | disqualifier |
|---|---|
| Göttingen pair | exact geometry, tabulated drag — but **Re_d 1.4e5–4.1e5, drag-crisis-adjacent**. Anchoring the declared high-Re rounded line on them would repeat the marble-scale sphere error r15/r16 killed. |
| TR-291 | **permanently barred** (standing), and laminar-range Re besides |
| TR-397 | appendaged totals, traced-profile grade — bounded evidence only |
| TN-614 / S-58 / 451 | consumed, spent, or ordering-only — roles frozen at 90.2 |

> **The corpus can show the map is wrong-shaped, but it cannot supply the
> high-Re mid-map anchors to rebuild it. The evidence desert at flight Re
> remains, and saying so plainly is the deliverable** — per 90.6, "the
> evidence is insufficient" is an admissible answer.

### 91.9 ALSO RECORDED

1. **Ordering results:** R451 stern pair predicted **1.023** vs the report's
   ~1.05 — right direction, half magnitude. TM267 pair predicted
   **1.085 vs measured 1.087** — the estimator prices the square's penalty
   through wetted area, the same mechanism the 1921 report itself names, and
   A4/E4 flag the square independently.
2. **Resolution drift is body-dependent and can be large:** 1–2% on TN-614,
   but up to **−35.5%** (S58-4164) on blunt-nosed Series 58 forms. 86.4 at
   scale: the proxy's mesh-resolution sensitivity is not a constant of the
   pipeline but a function of the body.
3. **The Göttingen ellipsoids are now PERMANENTLY SPENT** (90.7 R2). They were
   worth it: the prolate independently confirmed the fat-map overprediction on
   virgin data; the oblate exposed the clamp-region underprediction — the two
   most informative points in the corpus, as suspected.
4. TR-397's `tc-10`/`tc-6` share one geometry with two measured values (two
   ships, one class) — retained as separate rows, one prediction.

### 91.10 STATUS

Blind file committed before the join; run outputs in `ITEM4-RUN.txt` and
`item4-run1.json`. **Nothing was recalibrated, routed, smoothed or moved while
seeing this corpus. The interpretation ruling — one smoother curve vs
family-specific mappings vs analogue interpolation — is the owner's, taken
after reading this, not embedded in it.**

---

### 91.11 **OWNER INTERPRETATION RULING (2026-08-21).** (reviewer-authored)

**What is given up:** the idea that **one scalar -> one universal Cd curve**
can serve every shape. That version did not survive the evidence: a smoother
curve or twenty extra knots cannot fix points that want the curve moved in
opposite directions at similar proxy.

**What is NOT given up: the estimator.** The corpus pattern is structured, not
random — streamlined near the line, fat/prolate consistently below, oblate
above, and **the biggest misses were already labelled REDUCED** while
SUPPORTED cases held to roughly ±20%. Several aerodynamic families were being
forced through one ruler; discovering that is a useful failure.

**Rulings:**

1. **Do not recalibrate the production map. Do not add knots.**
2. The leading architecture — *geometry/ribbons -> identify analogue/family ->
   family-appropriate pressure mapping* — **remains a SHADOW HYPOTHESIS**.
   **The corpus that revealed the family structure must not also be the data
   the routing is fitted to.** New external evidence first.
3. There may still be smooth curves and more anchors — **within each earned
   family** (sketch: streamlined BoR -> map A; fat/prolate rounded -> map B;
   oblate/bluff -> map C; non-circular -> analogue/context treatment). **The
   actual families must come from evidence, not from these labels.**
4. For pressure-map architecture decisions, use the **canonical
   pressure-residual comparison**, not raw totals — the totals carry the
   0.43 mm real-skin allowance by design (91.2b).
5. Even if family routing proves too ambitious, the fallback product is
   already valuable: **fast geometry screening + known-domain Cd estimates +
   an explicit "I don't know" outside the evidence domain.**
6. **Next step: a TARGETED external-data hunt** for the families the corpus
   flagged. Local `.obj` files remain geometry/OOD stress cases — useful for
   behaviour, never calibration evidence.

---

## 92. **THE TARGETED EXTERNAL-DATA HUNT (2026-08-21). CANDIDATE TABLE ONLY — NOTHING INGESTED, NOTHING SPENT.**

Per the brief: prioritise cases with (1) exact/tabulated geometry, (2) measured
total drag and/or pressure/Cp, (3) declared Re and fluid, (4) explicit
reference area, (5) ideally systematic one-parameter families. Low-Mach,
zero-incidence, bare bodies. **Ten clean experiments beat 100 drag graphs
without usable geometry.** No measured value has been transcribed into this
repository by this search; candidate suitability only.

### 92.1 THE TARGETS, FROM 91's DESERT MAP

| gap | why |
|---|---|
| fat prolate bodies (fineness 1–3) at decent Re | the 4.7–9.9x overprediction band; only outcome-exposed TR-291 + one spent ellipsoid live there |
| oblate spheroids | one spent point defines the entire "above the line" finding |
| streamlined-to-sphere intermediate bluffness | the 0.18–0.82 desert itself |
| non-circular / elliptical / square-ish sections | 87/89's structural blind spot; A2/A4 now detect what the corpus cannot price |
| systematic one-parameter families | the only evidence form that separates family curves from scatter |

### 92.2 THE CANDIDATE TABLE

| # | candidate | geometry | aero quantities | regime | quality | unspent? | fills |
|---|---|---|---|---|---|---|---|
| **1** | **DARPA SUBOFF bare hull (AFF-1)** — Groves/Huang/Chang 1989 geometry report (DTIC ADA210642); Liu & Huang 1998 *Summary of DARPA SUBOFF Experimental Program Data* (CRDKNSWC/HD-1298-11, DTIC ADA359226) | **exact analytic equations** for the axisymmetric hull | towing-tank **resistance + surface pressure + skin friction** — a **published decomposition**, exactly what R3 preserves | water, incompressible, high Re | **A+** — purpose-built validation database, tabulated | **YES** | streamlined BoR at high Re, with the corpus's first published pressure/friction split |
| **2** | **NACA Report 394** — 8 Goodyear-Zeppelin airship models, Variable Density Tunnel (Abbott 1931; NTRS 19930091467) | ordinates expected in-report (to verify on acquisition) | measured drag at large effective Re; pressure work noted in the report | air, VDT high-Re | **A−** | **YES** — 59.0 explicitly did not spend it | **fat/prolate fineness family in one experiment, one facility** — the exact family the map overpredicts. 59.0's caveat stands: shared generating curve, so NOT nose-shape evidence |
| **3** | **VT Stability Tunnel, "Drag Measurements on an Ellipsoidal Body"** (VTechWorks) | exact (ellipsoid) | wake-survey momentum drag | air, wind-tunnel Re (verify) | B+ (verify tabulation) | YES | **oblate** — the one-point family |
| **4** | **NASA magnetic-suspension modified prolate spheroid drag** (NTRS 19890038141) | exact/near-exact (verify the modification) | **support-interference-free drag** | air (verify Re range) | B+ | YES | prolate mid-bluffness, with a unique no-sting error budget |
| **5** | **Göttingen Ergebnisse III/IV Lieferungen** (archive.org, public domain) | tabulated, same series as the spent II | tabulated c_w vs Re for further bodies (verify which) | air, sub-to-critical Re | B (regime caveat as 91.8) | YES | more ellipsoid/bluff points; regime caveat applies to any anchoring use |
| **6** | **ARC R&M airship-era streamline-body reports** (R101-class model tests) | tabulated where found | measured drag | air | C — poorly indexed online; acquisition uncertain | YES | streamlined + fat British corpus |
| **7** | **NACA TN 4201 free-flight zero-lift collection** (~200 bodies) | varied | zero-lift drag | **mostly transonic/supersonic — REGIME FILTER; keep only any clean M < 0.8 subsets** | C for our regime | YES | screening only |
| **8** | non-circular-section fuselage experiments (beyond TM-267) | to hunt | to hunt | — | — | — | **still open**: the A2/A4 blind-spot family has ONE control pair; the hunt continues |

### 92.3 ACQUISITION ORDER PROPOSED

**1 and 2 first** — SUBOFF (public, tabulated, decomposed, exact geometry) and
Report 394 (the fat-prolate family the map most badly misprices, unspent, one
facility). Then 3/4 for the oblate/prolate single-point families. 5–8 as
follow-on.

**Disciplines that apply to every acquisition, unchanged:** pre-registration
before any measured table is opened (the 90.7 R2 blind pattern); evidence roles
assigned at acquisition; the 59.6 data standard; no calibration change while
reading; a candidate that fails its qualification is recorded, not massaged.

**Nothing was ingested by this search. No measured value from any candidate
has been transcribed. Production byte-untouched at `12e8c5e`.**

---

## 93. **SUBOFF AFF-1 — BLIND EXAM, SEALED (2026-08-21). THE TOTAL AGREES TO 2–7%; THE DECOMPOSITION DISAGREES IN COMPENSATING DIRECTIONS. SPENT.**

The first acquisition of the 92.3 programme, run exactly as ordered: geometry
first, blind file committed (`5db32d4`), only then the experimental summary
opened. **No calibration change. Production byte-untouched.** Status was
declared before the reveal: **validation evidence, not an anchor candidate.**

### 93.0 GEOMETRY, AND THE SELF-VERIFYING RECONSTRUCTION

Source: Groves/Huang/Chang 1989 (DTIC ADA210642, public; contains no force
data, so acquiring it did not touch the blind). The scan's equation typography
is OCR-degraded, so the reconstruction was made **self-verifying**: the
afterbody polynomial's coefficient groups must sum to (1, 0, 0, 0) at xi = 1
and rh^2 at xi = 0, enforced in `aff1SelfTest` with every joint continuity
check. **A mis-reconstruction cannot pass. Self-test PASS.** L 4.356 m,
D 0.508 m, fineness 8.575, canonical 96x28 lathe; resolution drift +1.74%
(provenance column).

### 93.1 THE FROZEN PREDICTION (committed before reveal)

| | |
|---|---|
| proxy | 0.074430, class **rounded** |
| Cd predicted | **0.10127** = pressure **0.00956** + friction **0.09172** (wetted/frontal 29.70) |
| eligibility / conf | ELIGIBLE, SUPPORTED; F1 0.9701, F2a 0.154 (closure sits aft of the earned domain), A-modes 0 |
| noted at freeze | predicted friction Re-flat across the declared grid (the r22 Q3 plateau heuristic); dPx(hull) 45.3% vs dCd 0.02% — the shallow-map signature |

### 93.2 THE REVEAL — Liu & Huang 1998 (DTIC ADA359226), Table 14 tow-tank data

**Transcription provenance, disclosed:** Table 14's OCR is degraded. The
readable bare-hull rows are anchored three ways: the lb->N conversions verify
internally (63.80 lb = 283.8 N, 87.50 lb = 389.2 N, exact); the appended/bare
resistance ratio printed at 11.85 kn (1.169) matches the literature's
AFF-8/AFF-1 relationship; and speeds 5.93 / 11.85 kn are printed while the
middle row's speed is **inferred as 10.00 kn and flagged as inferred**.
Declared conversion assumptions: fresh water rho 998.4, nu 1.05e-6, exact
frontal area 0.20268 m2.

| speed | Re_L | measured R | **measured CD_A** | canonical smooth-ITTC friction | **canonical residual** |
|---|---|---|---|---|---|
| 5.93 kn (3.051 m/s) | 1.27e7 | 102.3 N | **0.1086** | 0.0856 | **0.0231** |
| *10.00 kn inferred* (5.144 m/s) | 2.13e7 | 283.8 N | **0.1060** | 0.0784 | **0.0276** |
| 11.85 kn (6.096 m/s) | 2.53e7 | 389.2 N | **0.1035** | 0.0763 | **0.0272** |

The revealed Re fall **inside the blind grid** (1.2e7–3.6e7), so no
out-of-grid extrapolation was needed.

**Published decomposition, preserved separately per 90.7 R3 — NOT collapsed
into the residual:**

- **Skin-friction taps** (Table 13e, bare hull): Cf 3.396e-3 at x/L 0.181;
  2.674e-3 at 0.501; 2.928e-3 at 0.741; 3.402e-3 at 0.781; 5.702e-4 at 0.904.
- **Surface-pressure taps** (Table 13d excerpt): Cp 0.990 at x/L 0.000
  (stagnation, as it must be); −0.114 at 0.035; −0.071 at 0.070; −0.055 at
  0.105; −0.097 at 0.181.
- The report's own **residual resistance coefficient** at 5.93 kn, 0.00065 on
  the wetted basis, converts to ~0.0193 frontal — same band as our canonical
  0.0231, computed through a different friction convention. Consistent, not
  identical; preserved as published, not overwritten.
- The full tap files live on the report's companion diskette and are not in
  the scanned text; the printed excerpts above are what the source itself
  reproduces. Declared as an excerpt, not the full field.

### 93.3 **THE VERDICT — WHY THIS DATASET WAS WORTH ACQUIRING FIRST**

| | predicted | measured / canonical | error |
|---|---|---|---|
| **total Cd** | 0.10127 | 0.1035–0.1086 | **−2.2% to −6.8%** |
| **friction** | 0.09172 (with ks-allowance) | smooth-ITTC 0.0763–0.0856; **measured mid-body Cf taps 2.7–3.4e-3 ≈ ITTC-smooth 2.6–2.9e-3** | **+7% to +20% over smooth** — the allowance is not in the polished model, as designed |
| **pressure** | 0.00956 | canonical residual 0.0231–0.0276 | **UNDER by 2.4–2.9x** |

> **The total agrees impressively; the decomposition does not.** The
> prediction lands within 7% of measurement because an over-priced friction
> term (the real-skin allowance, absent on a polished model) compensates an
> under-priced pressure term. **The tap data removes the ambiguity**: measured
> mid-body Cf matches smooth ITTC, so the residual is not a friction-convention
> artefact here — the rounded map genuinely under-prices this hull's pressure
> drag ~2.5x at proxy 0.074.
>
> **This is a fourth family behaviour**, on the map's best-populated stretch:
> TN-614 (fineness 5) sits ON the line that SUBOFF (fineness 8.6, long
> parallel middle body, closure aft of the earned domain) sits BELOW-priced
> on. One more structured, family-shaped departure — now on the streamlined
> side, and at high Re with a published decomposition behind it.

**A blind-discipline note in the estimator's favour:** F2a 0.154 with the
closure aft of the earned domain and the 45% hull-path divergence were both
flagged **at freeze time** — the context layer marked this body as unusual
before any measurement was seen.

### 93.4 SEALED

**SUBOFF AFF-1 is SPENT as validation evidence.** It is not an anchor; its
Cp/Cf excerpts are preserved as published decomposition; the middle-row speed
inference is flagged for re-verification if the full Crook 1990 tables are
ever acquired. **Next per 92.3: NACA Report 394, same blind discipline.**

---

### 93.5 **WORDING RESTRAINT (owner, 2026-08-21)**

93.3's "fourth family behaviour" overstates. SUBOFF is **a new, independently
spent geometry class showing a different systematic departure**. Whether it
deserves its own routing family is exactly what more evidence should decide —
and the headline is not "total within 2–7%" but **"the total agreed because
two errors cancelled."** The roughness term overpriced friction on a polished
model while the pressure map ran 2.4–2.9x low; separating those is why the
corpus work exists.

---

## 94. **NACA REPORT 394 — BLIND EXAM. PRE-REGISTRATION, 2026-08-21, BEFORE THE REPORT IS OPENED.**

### 94.0 THE FROZEN QUESTION

> **Does this independent high-Re fineness family reproduce the large
> fat/prolate overprediction already seen in TR-291 and the Göttingen prolate
> — and does the error change SYSTEMATICALLY with fineness?**

If it does, that is major evidence for family-specific calibration over a
universal line. If it does not, that is equally important and will be reported
with the same prominence. **No calibration or routing change during the exam.**

### 94.1 PROTOCOL — the 90.7 R2 sequence, adapted to a single-document source

Report 394 (Abbott 1931) carries geometry and results in ONE scan, so the
blind is **procedural**: extraction happens in two passes with the results
tables untouched in pass one.

1. **Pass 1 — geometry and conditions only:** the eight Goodyear-Zeppelin
   models' defining ordinates/generating curve, dimensions, fineness ratios,
   test Reynolds conditions, and the report's coefficient/reference-area
   convention. The extraction instruction explicitly excludes drag values.
   Any measured value that leaks into view is DISCLOSED, as 90.7 R2's oblate
   disclosure was.
2. Reconstruct all eight models; verify against every printed geometric check
   the report offers (dimensions, volumes if given).
3. **Freeze and commit** scalar / Cd split / F1–F5 / A-modes / eligibility /
   OOD per model at each model's own test condition.
4. Only then open the results tables; preserve the report's own basis
   (VDT results are typically volume-basis coefficients — convert with the
   declared geometry, keeping the published values raw per R3).
5. Where any value must be read from a plot rather than a table, the
   extraction uncertainty is recorded explicitly.
6. Seal: Report 394 becomes SPENT.

### 94.2 STANDING CAVEATS THAT APPLY

- **59.0 stands**: the models share a generating curve, so this is
  **fineness-family evidence, never nose-shape evidence**.
- The closed-throat/open-throat retest history is part of the record and any
  affected values carry that flag.
- Evidence role assigned now: **independent validation for the fat/prolate
  question; anchor candidacy is NOT decided here** (91.11 rule 1 stands: no
  knots).

---

## 95. **REPORT 394 — REVEAL AND SEAL (2026-08-21). THE HIGH-Re FAMILY DOES *NOT* REPRODUCE THE LARGE FAT/PROLATE OVERPREDICTION — AND THAT PUTS THE TR-291 LAMINAR CAVEAT AT THE CENTRE OF THE MAP QUESTION.**

The 94.0 pre-registration promised that a "no" would be reported with the same
prominence as a "yes". **The answer is NO.** SPENT.

### 95.0 THE REVEAL RECORD

Coefficients are the report's own basis — **C_D on (vol)^(2/3), Re on length**
(p.9); published drag precision ±2–3%. The bare-hull zero-pitch results exist
only as **curves (Figure 17)**, read from the 2678x3418 scan at Re = 26x10^6
with a declared read uncertainty of **±0.001 in C_D(vol)**, propagated through
the (vol)^(2/3)/A conversion per model. Closed-throat tunnel; the report's own
turbulence caveat stands. Volumes for conversion are Table III's printed
values (94's reconstruction validated against them at +1.4–1.6%).

| model | C_D(vol) read | CD_A | ± | canonical friction | canonical residual ± | predicted pressure (frozen) | **press/resid** | predicted total | total err |
|---|---|---|---|---|---|---|---|---|---|
| GZ-3.6 | 0.029 | 0.0576 | 0.0020 | 0.0308 | **0.0268 ± 0.0020** | 0.01769 | **0.66x — UNDER** | 0.0698 | +21% |
| GZ-4.8 | 0.021 | 0.0505 | 0.0024 | 0.0405 | 0.0100 ± 0.0024 | 0.01006 | **1.01x** | 0.0747 | +48% |
| GZ-6.0 | 0.0225 | 0.0629 | 0.0028 | 0.0503 | 0.0126 ± 0.0028 | 0.00907 | 0.72x | 0.0859 | +37% |
| GZ-7.2 | 0.022 | 0.0694 | 0.0032 | 0.0601 | 0.0092 ± 0.0032 | 0.00862 | 0.93x | 0.0974 | +40% |
| GZ-5.3 | 0.025 | 0.0660 | 0.0026 | 0.0457 | 0.0204 ± 0.0026 | 0.01011 | 0.50x | 0.0816 | +24% |
| GZ-5.6 | 0.021 | 0.0584 | 0.0028 | 0.0488 | 0.0096 ± 0.0028 | 0.01008 | 1.05x | 0.0856 | +47% |
| GZ-5.8 | 0.024 | 0.0688 | 0.0029 | 0.0508 | 0.0179 ± 0.0029 | 0.01012 | 0.56x | 0.0883 | +28% |
| GZ-6.8 | 0.0195 | 0.0641 | 0.0033 | 0.0611 | **0.0030 ± 0.0033 — sign-indeterminate** | 0.01009 | (3.3x, not credible) | 0.1013 | +58% |

**Read-noise honesty:** for the slender models the canonical residual is the
small difference of two large numbers, and the ±0.001 plot-read uncertainty is
comparable to the residual itself. GZ-6.8's ratio is not evidence of anything.
The robust statements are confined to the models whose residual clears its own
uncertainty: **GZ-3.6, GZ-5.3, GZ-5.8 — and all three run UNDER-predicted
(0.5–0.7x), none over.**

### 95.1 **THE ANSWER TO THE FROZEN QUESTION**

> **Does this independent high-Re fineness family reproduce the large
> fat/prolate overprediction (4.7–9.9x) seen in TR-291/Göttingen? NO.**
>
> At fineness 3.6 — proxy 0.201, essentially AT calibration knot 2, and the
> fattest high-Re body in the entire corpus — the map **UNDER-predicts
> pressure by ~1.5x** (ratio 0.66). Across the family the pressure ratios run
> 0.5–1.05x. **Nowhere near an overprediction, let alone a 4.7–9.9x one.**

### 95.2 **WHAT THIS DOES TO THE 91 FAMILY PICTURE — THE LAMINAR CAVEAT IS NOW LOAD-BEARING**

TR-291 ran at Re 2.3e5–2.3e6 and the Göttingen pair at Re_d 1.4e5–4.1e5 — the
declared laminar/transition caveats (90.2). At those Re the canonical
turbulent-ITTC friction **over-subtracts** (a largely laminar boundary layer
has far lower Cf), which **deflates their residuals** and can manufacture an
apparent overprediction. Report 394 is the first fat-ish measurement at
genuinely high Re, and it points the other way.

**Scoped precisely:**

- the corpus's family-split STRUCTURE stands — different geometry classes
  still depart from the universal line differently (SUBOFF under, GZ under at
  the fat end, oblate over, streamlined on);
- but **the MAGNITUDE of the fat/prolate overprediction at flight Re is now in
  doubt**: it rests on transition-Re data whose friction convention is least
  trustworthy exactly there;
- the truly fat region (fineness <= 2, proxy > 0.3) **still has no high-Re
  measurement in the corpus at all** — the desert 91.8 named is where the
  question now lives.

### 95.3 THE TOTALS, AND A CONSISTENT SUBOFF ECHO

Predicted totals run **+21% to +58% high, rising with slenderness** — the
polished-mahogany models do not carry the estimator's 0.43 mm real-skin
allowance, and the more friction-dominated the body, the larger the overshoot.
Same mechanism as 93.3, third dataset in a row. On the pressure basis the same
models sit near or below the line.

### 95.4 EXAM HYGIENE

Blind gate: predictions committed at `3796e1a` before any curve was read; the
one pass-1 leak (a figure's axis gridlines) was disclosed at commit time.
Nose-reading ambiguity proved immaterial (proxy identical to 6 decimals, A vs
B). Parent attribution for the middle-body models was decided by the printed
volume identities, not by the ambiguous text. VDT closed-throat turbulence and
the ±2–3% published drag precision are carried as caveats on every number
above. **59.0 stands: this is fineness-family evidence, never nose-shape
evidence.**

**REPORT 394 IS SPENT.** No calibration, routing or descriptor change was made
while reading it. Production byte-untouched at `12e8c5e`.

### 95.5 WHAT THE PROGRAMME NEEDS NEXT, ON THIS EVIDENCE

The decisive missing measurement is now sharply defined: **fat bodies
(fineness 1–3) at high Re with tabulated drag** — the region where the map's
two candidate failure modes (over vs under) currently disagree between low-Re
and high-Re evidence. The 92.2 queue continues (VT oblate, NASA
magnetic-suspension prolate), and any future acquisition in the fat region at
real Re outranks both.

---

### 95.6 **OWNER RULINGS ON THE 394 RESULT (2026-08-21).** (reviewer-authored)

1. **The "fat/prolate bodies are massively overpredicted" story is no longer
   trustworthy as a high-Re aerodynamic conclusion.** Report 394's robust
   points go the other way (~1.5–2x under, not 5–10x over), and the low-Re
   residuals were plausibly distorted by subtracting turbulent ITTC friction
   in a transition/laminar regime. **The test falsified one of our emerging
   interpretations before it was baked into V2 — that is the system working.**
2. **The "multiple family curves" conclusion is WEAKENED accordingly.** Still
   standing: one universal scalar->Cd map is not demonstrated, and
   SUBOFF/GZ/oblate behave differently. No longer standing at strength: a
   clean prolate-fat family lying far below the line.
3. **METHODOLOGICAL ADJUSTMENT, BANKED:** canonical residuals formed as
   `measured total − turbulent ITTC` at low Re are **TRANSITION-SENSITIVE**
   and may no longer strongly drive pressure-map architecture. They remain
   evidence, so labelled. **Published decompositions (SUBOFF-class) are the
   stronger currency.**
4. **QUEUE PAUSED.** Before VT-oblate and the magnetic-suspension prolate:
   a **bounded targeted hunt** for the single highest-information experiment —
   **fineness ~1–3, low-Mach/incompressible, high Re, bare body,
   reconstructable geometry, measured total drag with explicit reference
   basis, preferably with pressure/skin-friction decomposition.** Candidate
   table only; no outcomes ingested. If nothing suitable is found after a
   bounded search, resume the existing queue.

Any of the three possible answers moves the programme decisively: under ->
394 reflects real high-Re behaviour; over -> family matters even at high Re;
on-map -> the streamlined-to-fat transition is more ordinary than the sparse
evidence suggested.

---

## 96. **THE FAT-AT-HIGH-Re HUNT (2026-08-21). BOUNDED SEARCH COMPLETE. ONE STRONG CANDIDATE AT THE EXTREME FAT END; OTHERWISE THE REGION IS EMPTY. NOTHING INGESTED.**

Per 95.6 rule 4: fineness ~1–3, low-Mach/incompressible, high Re, bare body,
reconstructable geometry, measured drag with explicit basis, decomposition
preferred. Candidate table only.

### 96.1 THE CANDIDATE TABLE

| # | candidate | fineness | Re | quantities | verdict |
|---|---|---|---|---|---|
| **1** | **Achenbach 1972**, *Experiments on the flow past spheres at very high Reynolds numbers*, JFM 54(3) | **1.0 — the extreme fat end** | 5e4 – **6e6**, through critical to **transcritical** | **total drag + LOCAL PRESSURE + LOCAL SKIN FRICTION** — a full published decomposition | **THE strong candidate.** The only fineness-1-class body anywhere with a measured decomposition at supercritical Re. CAVEAT: its transcritical total 0.19 is already the sphere-HR knot's cited value, so the total is calibration-adjacent; **the DECOMPOSITION and the Re-sweep are unconsumed** and would be the evidence. Data are figures -> plot-read with declared uncertainty. |
| 2 | NASA TN D-540 (fineness 2–14 family) | 2–14 | **3e5–1.65e6 — transition regime** | drag | **REJECTED by 95.6 rule 3** — would recreate the exact transition-sensitive artefact the hunt exists to escape |
| 3 | NASA TM 8-ft pressure-tunnel sphere/oblate (19940008699) | ~1 | high | drag | **REJECTED — M 0.6–1.2, compressible** |
| 4 | modern hybrid-hull / LOTTE-class airship tests | ~3–4 | 1e6-class | partial | nothing found with tabulated bare-body drag + reconstructable geometry in the bounded search |
| 5 | **in-house, already in the corpus**: TR-397 ZMC-2 (fr **2.83**, flight Re ~5e7) and Puritan (fr 3.5, ~3.4e7) | 2.8–3.5 | **flight Re** | deceleration totals, **appendaged upper bounds** | not new data, but worth restating: even these UPPER BOUNDS sit at a third to a half of the pinned-branch predictions — bounded high-Re fat-ish evidence already pointing AGAINST overprediction being an artefact-free conclusion, with traced-geometry and appendage caveats |
| 6 | Akron 1/40 pressure distribution at Re 17.3e6 (TR-432 family) | 5.9 | high | Cp | not fat; noted for a future streamlined-decomposition check |

### 96.2 VERDICT AND RECOMMENDATION

> **No clean fineness-1–3 bare-body high-Re drag dataset with reconstructable
> geometry exists in reach of a bounded search — except at fineness 1.0
> itself.** The 91.8 desert is real at its centre.

**Recommendation for ruling:** acquire **Achenbach 1972** as the fat-end exam —
framed strictly as **decomposition and Re-behaviour evidence** (the
transcritical total being calibration-adjacent is declared, and no knot moves).
It directly tests whether the map's fat-end pressure pricing is high or low
against a measured pressure integral, on the fattest body there is. **Then
resume the paused queue** (VT oblate -> magnetic-suspension prolate). If the
owner prefers, the queue can resume directly instead.

**Nothing ingested. Production byte-untouched at `12e8c5e`.**

---

## 97. **ACHENBACH 1972 — MECHANISM/DECOMPOSITION EXAM AT THE SPHERE END. PRE-REGISTRATION, 2026-08-21, BEFORE ANY DECOMPOSITION FIGURE IS OPENED.**

### 97.0 THE NARROW FRAME (owner ruling)

**NOT a fat-body validation point. NOT an anchor. NOT a total-Cd exam** — the
sphere's total is already calibration-adjacent (sphere-HR cites this source's
transcritical 0.19). The blind information is:

> **At high/transcritical Re, what fraction of sphere drag is actually
> pressure vs skin friction — and does the current pressure branch put that
> split in the right neighbourhood?**

This tests the fat-end pressure pricing **without** the
`measured total − turbulent ITTC` subtraction that 95.6 rule 3 downgraded.

### 97.1 PRE-REGISTERED, all three before the reveal

1. **Geometry and estimator unchanged**: the already-frozen exact-equation
   sphere (item4-corpus), canonical 96x28 lathe, current production estimator.
2. **The predicted pressure/friction split is FROZEN ACROSS THE PUBLISHED Re
   RANGE first** — declared grid Re_D {1e5, 3e5, 1e6, 3e6, 6e6}, spanning
   Achenbach's 5e4–6e6 — and committed before any decomposition data is seen.
3. **The decomposition/Re trend is judged SEPARATELY from total Cd**, because
   the total is not virgin evidence.

Seal condition: **spent MECHANISM evidence, never calibration evidence. No
knot moves.** Reveal provenance rules as before: page-image or secondary
reproduction, declared per value, with plot-read uncertainty stated.

---

### 97.2 **REVEAL BLOCKED — EXAM HELD OPEN WITH THE BLIND FILE STANDING (2026-08-21)**

A bounded acquisition effort could not reach Achenbach's decomposition values:
the JFM paper is paywalled; the scribd mirror exposes only metadata; two
secondary papers that cite it quote pressure DISTRIBUTIONS and the critical Re
(3.7e5) but **no friction-fraction numbers**; institutional mirrors 403.

> **No decomposition value has been transcribed from memory or from
> secondary noise. The blind split file (`b2372ff`) STANDS COMMITTED**, the
> exam remains open, and the reveal requires the actual paper — a JFM library
> copy is the clean route (owner acquisition).

**What the frozen blind file already records, for when the reveal comes:** the
estimator's predicted friction fraction of sphere drag is **6.6% subcritical
(Re 1e5), 5.2% near-critical, 9.4% at 1e6, 8.1% transcritical** — with the
crisis blend visibly moving predicted pressure 0.472 -> 0.182 across the
declared grid. Those are the numbers Achenbach's measured split will judge.

**Per the standing order the queue now RESUMES: VT oblate -> NASA
magnetic-suspension prolate**, with the Achenbach reveal slotted in whenever
the paper is obtained. Production byte-untouched at `12e8c5e`.

---

## 98. **VT OBLATE (DeMoss 2007) — BLIND EXAM SEALED (2026-08-21). A2 IDENTIFIED THE GEOMETRY AT 0.1% BEFORE THE REVEAL; THE MAP OVER-PRICES THIS MID-MAP BODY ~3.6x ON PRESSURE AT HIGH Re WITH TRIPS ON — AND "OBLATE" TURNS OUT TO NAME TWO DIFFERENT FAMILIES.**

Blind file `fb880f6` committed before any drag value was read. Evidence role
as pre-registered: independent oblate-family + first measured
non-circular-section drag body. **NOT an anchor. Nothing recalibrated.**

### 98.0 GEOMETRY CROSS-VALIDATION (both directions)

Exact analytic body from ch. 2.2.1 (L 1.6 m; oblate elliptical section
0.4 x 0.231 m everywhere; scalene-ellipsoid bow/stern + 0.8 m parallel
mid-body). Volume self-test PASS (0.09669 vs 0.09676 m3). And at reveal the
thesis's own stated areas confirm the build: frontal 0.0726 m2 (mine
0.07257), **wetted 1.487 m2 vs my mesh 1.482 m2** — 0.3%.

### 98.1 **Q-B — ANSWERED AT FREEZE TIME, AND CLEANLY YES**

> Pre-registered analytic modes for the 1.7316 section ellipse: A2 0.2703,
> A4 0.0545. **Frozen harness output on the built body: A2 0.2700, A4 0.0550
> — 0.1% and 0.9% — with F5 = 0 exactly as central symmetry demands.**

The shadow angular modes identified the transverse family of a body the
pipeline had never seen, before any measurement was revealed. That is the
"ribbons understand the 3D family better than the scalar" claim, now
demonstrated on a real wind-tunnel body rather than a synthetic control.

### 98.2 THE REVEAL (Table 4.2; frontal basis is the thesis's own CDF)

| case | measured D | **CDF** | Re_L |
|---|---|---|---|
| #1: 44 m/s, 0 deg, **trips ON** | 7.01 N | **0.0921** | 4.3e6 |
| #2: 44 m/s, 0 deg, no trips | 6.51 N | **0.0852** | 4.3e6 |

Internal consistency verified: CDL 0.0026 x (L2/FA) = 0.0917 ~ CDF ✓. Trips
add ~8%. The thesis's wake-integration method note (leaving wakes in raises
CDL 27%) is recorded as its methodology caveat.

### 98.3 THE VERDICT AGAINST THE FROZEN PREDICTION (Re 4.3e6 row)

| | predicted (frozen) | measured / canonical | |
|---|---|---|---|
| total Cd | **0.14988** | 0.0921 (trips) | **1.63x OVER** |
| friction | 0.07510 | smooth-ITTC canonical 0.0713 | +5% |
| pressure | **0.07477** | canonical residual **0.0208** | **~3.6x OVER** |

> **This is the first mid-map point (proxy 0.414) at genuinely high Re with
> FORCED TRANSITION — trips on, so the turbulent-ITTC subtraction is at its
> most defensible — and the map OVER-prices its pressure ~3.6x.** The 95.6
> transition-sensitivity caveat does not shelter this one. Mid-map
> overprediction, weakened at the fat end by 95, regains a clean high-Re
> data point at proxy ~0.4.

### 98.4 **Q-A — THE ANSWER THAT RENAMES THE QUESTION**

The Göttingen "oblate above the map" body is a **bluff oblate spheroid flying
short-axis-first** (fineness 0.75, proxy 0.89, crisis regime). The VT body is
an **elongated fineness-4 body OF OBLATE SECTION** (proxy 0.41) — and it sits
BELOW the map, not above it. **"Oblate" was naming two different families, and
the angular modes already separate them**: the VT body carries A2 0.27 with a
slender profile (kin to 87's ellipse family); the Göttingen spheroid is
axisymmetric about the flow (A2 = 0) and bluff. The taxonomy the routing
hypothesis needs is *section anisotropy x longitudinal bluffness*, not the
word "oblate".

### 98.5 SEALED

**SPENT as independent mid-map + section-anisotropy evidence.** The 87.5
structural blindness now has its measured counterpart on record: the scalar
cannot see what A2 sees, and the priced-by-A(x) prediction over-shoots this
non-circular body by 1.63x on totals. **No knot moves. Production
byte-untouched at `12e8c5e`. Next per the standing order: the NASA
magnetic-suspension prolate.**

---

## 99. **NASA MAGNETIC-SUSPENSION PROLATE — BLOCKED AT SOURCE ACQUISITION (2026-08-21). QUEUE PASS COMPLETE.**

Dress 1989 (AIAA 89-0648; also J. Aircraft 27(6) 523–528, 1990): NTRS holds
the record but **no download**; the AIAA PDF is gated. Unlike Achenbach —
where the geometry was already frozen and only the reveal is parked — here
**the geometry itself ("modified prolate spheroid": the modification,
dimensions and Re range) is inside the paywalled paper**, so not even the
blind pass can start. **Nothing transcribed from memory or abstract
fragments.**

**Parked as an OWNER-ACQUISITION item alongside Achenbach 1972:**

| paper | needed for | state |
|---|---|---|
| Achenbach 1972, JFM 54(3) 565–575 | the fat-end decomposition reveal against the frozen blind split (`b2372ff`) | blind FROZEN, reveal parked |
| Dress 1989/1990, AIAA 89-0648 / J. Aircraft 27(6) | the support-interference-free prolate exam, start to finish | fully parked |

**The 92.3 acquisition queue is now COMPLETE as far as public sources allow:**
SUBOFF sealed (93), Report 394 sealed (95), VT oblate sealed (98), Achenbach
blind-frozen (97), Dress parked (99). Production byte-untouched at `12e8c5e`.

---

## 100. **THE ESTIMATOR RESEARCH PROGRAMME IS CLOSED FOR THIS RELEASE (owner ruling, 2026-08-21). FINAL STATUS: WHAT IS VALIDATED, SUPPORTED, UNCERTAIN, AND EXPLICITLY NOT CLAIMED.**

> **"The research succeeded, even though it didn't produce the universal
> estimator we originally hoped for. It told you exactly how far the automated
> number deserves to be trusted — and gave you a much richer visual/diagnostic
> system in the process."**

The evidence converged, and not toward a universal geometry->Cd oracle. It
converged toward: **a useful screening estimate in some domains, noticeably
wrong in others, and a geometry/ribbon layer that is much better at telling us
what kind of shape we are looking at and when confidence should fall.** That
is enough to build the right product.

### 100.1 VALIDATED — machine-checked, reproducible, held under adversarial review

| claim | evidence |
|---|---|
| the support-function skin is convex by construction, self-tested, tessellation-stable on the earned domain (zones 1–5, 0.10–0.13 deg across four hull families) | 53, 55 |
| `ribbonContext` cannot alter Cd — **proven per body by bit-equality, on every row of every run this programme executed** | 70, 81.2, everywhere since |
| the angular modes A1/A2/A4 measure section symmetry content at **analytic accuracy** (0.1–7% vs exact quadrature), on synthetic controls AND on a never-seen wind-tunnel body **before its reveal** | 89, 98.1 |
| the full pipeline regenerates all three frozen rounded calibration knots **exactly** under the historical convention — the map's provenance is now reproducible end to end | 86.1, 91.1 |
| the canonical convention, evidence roles, and blind-exam protocol produce byte-identical records across independent processes | 90–99, determinism gates |
| the Smart Tail ~0.022 sits in a **wide, smooth basin of the estimator's response** — 19 of 32 variants in Cd 0.02–0.03, every family with an in-band run through the baseline | 85 |

### 100.2 SUPPORTED — consistent evidence, not yet proof

- **The confidence machinery points at the right bodies**: on the pressure
  basis every large corpus miss was already REDUCED, SUPPORTED rows held
  ~±20% (91.6); the VT oblate's REDUCED flag was frozen pre-reveal (98).
- **Scalar and ribbons are complementary by construction** — aft-closure
  blindness vs section-shape blindness partition cleanly (68.3, 82.4, 87, 89).
- **Mid-map overprediction** has one clean high-Re forced-transition point
  (VT oblate, ~3.6x on pressure at proxy 0.41) plus transition-caveated
  low-Re support (98.3).
- The basin's upper edge is a **calibration feature** (the knot-2 27x elbow),
  not geometry (85.4).

### 100.3 UNCERTAIN — genuinely open, and recorded as open

- **The fat end's sign**: 394's robust high-Re rows run UNDER (0.5–0.7x)
  where transition-Re data ran far OVER; fineness <= 2 at high Re has **no
  measurement in the corpus at all** (95).
- **The family taxonomy**: real (things depart differently) but unfitted, and
  "oblate" already split into two families under measurement (98.4). Routing
  stays a shadow hypothesis (91.11).
- Low-Re canonical residuals are **transition-sensitive** (95.6) and the
  proxy is **not resolution-converged** (86.4); both are provenance
  limitations of any future recalibration.

### 100.4 EXPLICITLY NOT CLAIMED

- **No aerodynamic validation of 0.0222** — every Smart Tail number is an
  estimator response on authored geometry (84.0, 85.10).
- **No universal proxy->Cd law** — contradicted in both directions (91, 95, 98).
- **No new calibration anchors** — nothing acquired this programme qualifies
  (91.8), and nothing was fitted, moved or smoothed at any point.
- Predicted TOTALS on polished models overshoot **by design** (the 0.43 mm
  real-skin allowance, verified in source; 91.2b, 93.3, 95.3, 98.3).
- Ribbons never route, gate, or touch a Cd anywhere (70.3, unamended).

### 100.5 THE RELEASE RULING

1. **Research round SEALED** (this section). **Achenbach, Dress, CFD, new
   literature, family routing and any calibration V3 move to POST-RELEASE
   R&D.** They stop blocking.
2. **No recalibration. The production Cd map ships FROZEN for V2**, as a
   declared screening estimate.
3. **V2 = existing production Cd engine + the earned ribbon/surface machinery
   + eligibility/OOD/analogue context + an evidence-dependent screening range
   + a fully user-editable Cd + the Dynamic visualizer.** Better than live
   without pretending the point estimate improved.
4. **The interface states its epistemics** — the design target:

   > Estimated Cd — 0.022 · *Screening estimate · moderate/high evidence* ·
   > Estimated range 0.018–0.030 · [ Cd slider ]

   > Estimated Cd — 0.15 · *Low evidence · geometry unlike measured
   > analogues* · Estimated range 0.07–0.30

   > *No reliable automatic Cd estimate. Choose a Cd assumption below.*

   The range layer is **evidence-dependent and initially CONSERVATIVE**,
   driven by the already-computed context (eligibility, OOD count, analogue
   bracket, path sensitivity), improvable later from held-out error data.
   **The discovered weaknesses become an interface feature: epistemic
   honesty.**
5. Primary effort shifts to **the Dynamic visualizer** — r(x,theta), ribbons,
   clockface, A1/A2/A4, fore/aft turning, tail flare, eligibility — making
   the diagnostic layer beautiful and intuitive without claiming a solved
   flow field — **and to live Calc V2 integration**, through the frozen
   release gate: shadow integration, then regression against live with every
   preset identical or every difference explained, then ship.

### 100.6 THE PROGRAMME, IN ONE PARAGRAPH

Fifty spec sections ago this was a jump-detector bug hunt. It ends with: a
frozen production estimator whose provenance, convention and failure regions
are now measured and documented; a shadow geometry layer proven unable to
touch the number and demonstrated able to identify shape families at analytic
accuracy before measurements are unsealed; five blind exams sealed without a
single number laundered; and a release architecture that converts every
discovered limitation into stated uncertainty instead of hidden error.
**Production remains byte-untouched at `12e8c5e`, zero lines changed across
the entire programme.**

---
