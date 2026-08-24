/**
 * EAS VISUALIZER PALETTE — the V4 token module (meaning-mapped, per
 * DYNAMIC-VISUAL.md "colour must map to meaning, not decoration").
 *
 * PROVENANCE (owner ruling 2026-08-22): Toby delegated the final picks —
 * "the palette is all a little wrong and live has been a bit wrong for
 * ages... if there is a 'canonical' berry that's the right one; just
 * choose the best for now and we'll do a full colour review once it's all
 * integrated into the calculator before launching V2."
 *
 * Sources, in order of authority:
 *   - EAS-PALETTE.md (Toby, 2026-08-07 + resolved Flags): canonical berry
 *     #c428a3 — the deployed site's #c628a4 is recorded drift, repaint
 *     deliberately deferred; dark grey confirmed #676667.
 *   - Owner bench-tuning ledger 2026-08-22 (HANDOVER-VISUALIZER.md §3.11):
 *     ship = page-1 EAS orange #ff9900 ("it's orange every other page"),
 *     BLI = toothpaste #9feacc, wake = burnt #b07850 (kept clearly apart
 *     from the ship orange), canvas #111, spheres brightened #9a9a9a.
 *   - Live site constants still current: bg #111, critical #ff2a2a.
 *
 * STATUS: provisional-final — binding for the V4/V5 build; the full
 * colour review happens at calculator integration, pre-V2-launch.
 * Changes here only with a dated provenance note (blessed-constant rule).
 */
export const TOKENS = {
  // ground
  bgBase: '#111111',          // canvas + page ground (live site)
  panel: '#474747',           // charcoal (EAS dark palette)
  panelAlt: '#2e294f',        // deep purple (EAS dark palette)
  border: '#404040',          // live site border (hsl 0,0%,25%)

  // text
  textPrimary: '#eaeaea',
  textSecondary: '#888888',

  // identity — page-1 grammar carried into the visualizer (owner ruling
  // 2026-08-22: "draw both the shape and its hull, hull in magenta same
  // as page 1, shape in orange, same visuals as page 1"). The 2026-08-21
  // "ship stays orange" ruling survives via the SHAPE being orange; the
  // hull envelope takes the canonical berry, as on page 1.
  identity: '#c428a3',        // CANONICAL berry — hull envelope + active selection, chips
  ship: '#ff9900',            // the raw shape's linework: page-1 EAS orange

  // flow field (owner bench-tuned 2026-08-22)
  flowNeutral: '#e8e8e8',     // freestream + attached riders
  flowWake: '#c4473b',        // shed/wake particles. #b07850 → #c4473b (Toby, 2026-08-22
                              // round 5: "make the drag particles more of a red colour —
                              // that's a 'bad' colour, better for the connotation");
                              // muted brick red: apart from ship orange #ff9900 AND from
                              // statusDanger #ff2a2a, still reads on #111
  flowBli: '#9feacc',         // captured (BLI) particles — toothpaste 2, reads on #111

  // spheres — 2026-08-22 V4 round (Toby): "make both spheres a bit
  // lighter / easier to see" — #9a9a9a → #c8c8c8; the sphereLabel token
  // is retired with the text labels ("remove 'sphere 1' and 'sphere 2'")
  sphereLine: '#c8c8c8',

  // status (chips arrive later in V4)
  statusPass: '#77cbbd',      // toothpaste 1 — deeper than flowBli so chip ≠ particle
  statusCaution: '#ff9900',   // chips live outside the flow field; collision with ship accepted
  statusDanger: '#ff2a2a',    // live site critical
};
