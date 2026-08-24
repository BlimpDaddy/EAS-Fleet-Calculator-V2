# TR-291 exam — pre-registration

Written **before** the PDF was opened or any TR-291 number was read.
Timestamped by its commit, which precedes every TR-291 data commit.

## Status of these eight hulls

**EXAM. Held out. Permanently.**

None of the eight TR-291 hulls may become a calibration knot, now or later,
whatever the results look like. If the estimator misses, the miss is the
result; it is not an invitation to add an anchor at fineness 1.0 or 1.5 and
re-run.

Reason: TN-614 carries this scar. Two of its six bodies were promoted to
knots, so the remaining four count as interpolation evidence rather than
independent confirmation, and `RESULTS.md` says so. TR-291 is the only
identified route to independent support in the fat-body mid-map, and it is
worth exactly nothing if it is spent as calibration.

If a future thread decides the calibration genuinely must change in this
region, it must find a *different* source for the knots. TR-291 stays the
exam.

## The procedure, fixed in advance

1. Transcribe published offsets (station %, radius %) per hull.
2. Rebuild by monotone-cubic (Fritsch-Carlson) lathe — same as `tn614.mjs`,
   `tr432-akron.mjs`.
3. Score down the PRODUCTION path, `measureSectionalProxy` -> `estimateCd`,
   at the reported test Re. **Frozen estimator. Zero retuning.**
4. Report ordering AND absolutes, all eight, whatever they say.

## What counts as a pass, stated before seeing the data

- **Ordering** across the eight — the primary result, as in TN-614.
- **Trend shape** as the bodies get fatter: the curve must bend the right
  way, not just rank correctly.
- **Absolutes**: screening-grade. The Akron precedent is ~19% high and that
  was called useful; anything inside roughly +/-25% at fineness 1.0-1.5 is
  a pass on absolutes, and a factor-of-two miss is a fail that demotes the
  bare-Sunship 0.178.

## What this exam does NOT test

**Reynolds number.** Model scale, probably ~1e6, like the Akron. This tests
the SHAPE mapping only. The Re 1e9 extrapolation stays a separate,
possibly unanswerable, problem, and no TR-291 result may be quoted as
support for it.

## Known threat to the most valuable point

The fineness-1.0 model is near-spherical in an 8x8 ft tunnel. Blockage
correction may make that point — the one nearest the Sunship's 1.33 —
unusable. Whether the report documents its corrections must be established
during transcription, not argued about afterwards.
