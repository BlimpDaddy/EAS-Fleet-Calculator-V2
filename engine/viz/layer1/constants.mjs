/**
 * ribbon-render/1 — DECLARED CONSTANTS.
 *
 * Authority: DYNAMIC-VISUALIZER-BUILD-PLAN.md (SEALED 2026-08-21) §2.1.
 * Every value here is either a frozen ruling or a blessed styling/test
 * constant ("visualizer constants, not aerodynamic claims" — owner,
 * 2026-08-21). Changing any of them requires a dated amendment to the
 * sealed plan, never a quiet edit.
 */

export const SCHEMA = 'ribbon-render/1';
export const AUTHORITY = 'VISUAL_READ_ONLY';

/* ---- grid (inherited from the frozen support skin, spec 53) ---------- */
export const N_STATIONS = 128;      // stations per state, uniform x0M..x1M inclusive
export const N_THETA = 48;          // ribbon clock angles (24 half-plane pairs)

/* ---- BLI zone — Sunship-authored, generic-by-same-constants elsewhere.
 * Values pinned by round-3 F6, blessed by owner 2026-08-21.
 * θ=0 is UP (spec 4.2); the side sectors are 90°/270° ± 30°. ------------ */
export const BLI = Object.freeze({
  uRange: [0.33, 1.0],
  thetaSectorsRad: [
    [Math.PI / 3, (2 * Math.PI) / 3],           //  60°..120°  (starboard-side sector)
    [(4 * Math.PI) / 3, (5 * Math.PI) / 3],     // 240°..300°  (port-side sector)
  ],
  captureBandFrac: 0.15,            // × local body radius, distance from skin
  approachStations: 8,              // capture only within this many stations of detachment
  captureCondition: 'approachingDetachment',
});

/* ---- displayNormalization — VIEW NORMALISATION / SPHERES ruling + Q8.
 * Sphere 1 has ONE universal on-screen size for every shape; the canonical
 * Sunship composition puts sphere 2 just under half the viewport height.
 * SPHERE1_VIEWPORT_FRAC = SPHERE2_VIEWPORT_FRAC × (r1/r2 of the canonical
 * Sunship), frozen numerically below from the measured payload of
 * 2026-08-21: r1 = 152.48 m, r2 = 258.47 m (axial extent scaled to 300 m
 * per DYNAMIC-SPEC §12.2; the miniball diameter of a 300 × 249 × 237 body
 * legitimately exceeds 300). E+A+S payloads keep this scale and clip
 * truthfully — display scale is NEVER derived from an arbitrary extended
 * worldBounds (round-2 F5). ------------------------------------------- */
export const SPHERE2_VIEWPORT_FRAC = 0.48;
export const SPHERE1_VIEWPORT_FRAC = 0.2832;   // 0.48 × (152.48 / 258.47)

/* ---- worldBounds margins (Layer-2 particle lifecycle only) ----------- */
export const WAKE_MARGIN_FRAC = 0.5;    // ≥ 0.5 L downstream — sealed plan §2.1;
                                        // also covers the wake-metric window (§4)
export const UPSTREAM_MARGIN_FRAC = 0.25; // spawn-plane clearance ahead of the nose
export const LATERAL_MARGIN_FACTOR = 1.05; // × outer sphere radius

/* ---- serialization quanta (SCHEMA.md enumerates field → class) ------- */
export const Q = Object.freeze({
  METERS: 2,          // 0.01 m — beyond pixel resolution at any body scale
  AREA_M2: 1,
  RADIANS_GRID: 6,    // θ sample values
  RADIANS_TANGENT: 4, // 1e-4 rad ≈ 0.006° — far below any styling threshold
  FRACTION: 5,
  SCORE: 6,           // scalar context (softAft etc.)
});

/* ---- linework — the raw shape's display geometry (owner ruling
 * 2026-08-22: "draw both the shape and its hull, hull in magenta same as
 * page 1, shape in orange, same visuals as page 1"). Page-1 grammar
 * carried over: linework = face boundary edges + explicit `l` polyline
 * edges, decimated by uniform stride; genuinely lineless files carry the
 * vertices as dots instead (worker.js does exactly this). Display-only —
 * the hull remains the geometry identity for every measurement
 * (canonical upload-hull rule, 2026-08-16). ---------------------------- */
export const LINEWORK_SEG_BUDGET = 800;     // max segments (uniform stride beyond)
export const LINEWORK_POINT_BUDGET = 2000;  // max dots for lineless point clouds

/* ---- payload size budget (sealed plan §2.1) -------------------------- */
export const SIZE_WARN_BYTES = 200 * 1024;
export const SIZE_FAIL_BYTES = 256 * 1024;
