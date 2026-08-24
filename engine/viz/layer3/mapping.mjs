/**
 * VIEW MAPPING — Layer 3's pure projection core (V2).
 *
 * `view` (elevation | plan | frontal) and `flowAxis` (LR | TB) are
 * PARAMETERS from day one (M7 binding consequence). Headless-testable: no
 * canvas here, only arithmetic on payload data. The renderer draws what
 * this module projects and derives no geometry of its own.
 *
 * DECLARED CONVENTIONS (payload frame: +X flight, +Y up, θ=0 UP toward +z):
 *   - Screen scale comes from displayNormalization ONLY — sphere 1 at the
 *     universal viewport fraction, centred on screen, identical in every
 *     view; the tail toggle can never rescale (Q8 / round-2 F5).
 *   - elevation (side view, the default "port view"): camera on −Z looking
 *     +Z. Screen-x = world x, screen-y = world y (up is up). NEAR side =
 *     z < 0, drawn in front of the hull; far side behind, dimmed (Toby's
 *     V1 feedback: ribbons cross the body).
 *   - plan (top-down): camera on +Y looking down. Screen-x = world x,
 *     screen-DOWN = +z (declared). NEAR side = y > 0 (over the top).
 *   - frontal (nose-on): viewer upstream, looking +X (flow AWAY from the
 *     viewer — the binding no-tail-on-view rule). Screen-right = −z,
 *     screen-up = +y. Recession: linear shrink 1.0 → 0.35 across
 *     worldBounds (deterministic; no motion interpolation is implied).
 *   - flowAxis TB rotates the flow onto screen-down (M7 portrait = plan
 *     view TB). Frontal ignores flowAxis: its flow is into the screen.
 *
 * FRONTAL OCCLUSION RULE (round-1 F14, gate frozen round 2): a particle is
 * HIDDEN iff it is downstream of the hull's widest station at its clock
 * angle (payload `frontalContourStation`) AND inside the contour radius —
 * wake behind the body inside the silhouette is hidden too; only shedding
 * outside the silhouette stays visible. Pure function, browser-independent.
 */

import { VIEW_UP, VIEW_DOWN } from '../layer2/engine.mjs';

export function makeMapping({ view, flowAxis = 'LR', payload, width, height }) {
  const s1 = payload.spheres.sphere1;
  /* M7 PORTRAIT (2026-08-24, layout consequence of the 2026-08-18 M7
     ruling): the sphere scale rides the CROSS-FLOW screen dimension —
     height in LR (unchanged), width in TB (the portrait instrument is
     the same 2.6 rectangle turned tall), min(width, height) in frontal
     (no flow axis on screen; the circle is constrained by the short
     side either way). sphere1ViewportFrac stays authored against the
     instrument's short side, exactly as the normalisation ruling reads. */
  const crossDim = view === 'frontal' ? Math.min(width, height)
    : (flowAxis === 'TB' ? width : height);
  const k = (crossDim * payload.displayNormalization.sphere1ViewportFrac) / s1.radiusM;
  /* WIDE INSTRUMENT (owner ruling 2026-08-23, amending the 2026-08-21
     centring ruling IN THE FLOW AXIS ONLY): sphere 1 sits at the
     VIEW_UP/(VIEW_UP+VIEW_DOWN) station along the flow — left of centre
     in LR views, upper in TB — so the wake gets the run-out while the
     approach (and the spawn line) stays exactly where it was. The
     cross-axis stays centred. Frontal keeps full centring (no flow axis
     on screen). */
  const f = VIEW_UP / (VIEW_UP + VIEW_DOWN);
  const cxLR = view === 'frontal' ? width / 2 : (flowAxis === 'TB' ? width / 2 : width * f);
  const cyLR = view === 'frontal' ? height / 2 : (flowAxis === 'TB' ? height * f : height / 2);
  const cx = cxLR, cy = cyLR;
  const c = s1.centerM;
  const wb = payload.worldBounds;

  /* FRONTAL RECESSION IS TRUE PERSPECTIVE (2026-08-22, replaces the linear
     shrink): camera on the flight axis upstream of the spawn plane; screen
     offset scales as cameraDepth(sphere-1 centre) / cameraDepth(point), so
     incoming flow visibly swoops toward the vanishing point while the
     body's deflection bends each particle outward toward its clock
     position — the "ribboning around the body" read. Scale is 1 exactly at
     the sphere-1 centre plane, preserving the universal sphere-1 size. */
  const xCam = wb.xMinM - 0.35 * (wb.xMaxM - wb.xMinM);
  const d0 = c[0] - xCam;
  const recession = (x) => Math.min(2.2, Math.max(0.22, d0 / (x - xCam)));

  /* per-view: flow coordinate F, lateral coordinate L (screen-down in LR is −L), depth */
  function split(pt) {
    if (view === 'elevation') return { F: pt.x - c[0], L: pt.y - c[1], depth: pt.z - c[2], near: pt.z < 0 };
    if (view === 'plan') return { F: pt.x - c[0], L: -(pt.z - c[2]), depth: -(pt.y - c[1]), near: pt.y > 0 };
    if (view === 'frontal') return { F: 0, L: 0, depth: pt.x, near: false };
    throw new Error(`makeMapping: unknown view '${view}'`);
  }

  function project(pt) {
    if (view === 'frontal') {
      const f = recession(pt.x);
      return {
        sx: cx - (pt.z - c[2]) * k * f,       // screen-right = −z
        sy: cy - (pt.y - c[1]) * k * f,
        scale: f,
        depth: pt.x,                          // larger = farther
        near: false,
      };
    }
    const { F, L, depth, near } = split(pt);
    const sx = flowAxis === 'TB' ? cx + L * k : cx + F * k;
    const sy = flowAxis === 'TB' ? cy + F * k : cy - L * k;
    return { sx, sy, scale: 1, depth, near };
  }

  function anchors() {
    const ret = payload.retracted.extentM;
    const nose = project({ x: ret.x0M, y: 0, z: 0 });
    const tail = project({ x: ret.x1M, y: 0, z: 0 });
    return {
      sphere1Center: project({ x: c[0], y: c[1], z: c[2] }),
      nose, tail,
      flowScreenDir: view === 'frontal' ? null : (flowAxis === 'TB' ? { dx: 0, dy: 1 } : { dx: 1, dy: 0 }),
    };
  }

  /* xCamM exposed (additive, 2026-08-22): the engine's sim box may extend
     upstream of the frontal camera plane (instrument-filling flow); the
     renderer must not draw frontal particles BEHIND the camera. The
     projection arithmetic itself is unchanged. */
  return { project, anchors, recession, pxPerM: k, xCamM: xCam };
}

/** The frozen frontal-visibility rule. Works on engine particles. */
export function frontalVisible(payload, geo, p) {
  const n = payload.grid.nStations;
  const { x0M, lengthM } = geo.extentM;
  const peakX = x0M + (geo.frontalContourStation[p.thetaIdx] / (n - 1)) * lengthM;
  const inside = p.r < geo.frontalContourRM[p.thetaIdx];
  return !(p.x > peakX && inside);
}

/** Hull outline for a view, as world-space points (renderer projects them). */
export function hullOutline(payload, geo, view) {
  const sil = geo.silhouettes, g = sil.xGrid;
  const xAt = (s) => g.x0M + s * g.dxM;          // station-center grid (see xGrid.convention)
  if (view === 'elevation') {
    const top = [], bot = [];
    for (let s = 0; s < g.count; s++) { top.push({ x: xAt(s), y: sil.yHiM[s], z: 0 }); bot.push({ x: xAt(s), y: sil.yLoM[s], z: 0 }); }
    return [...top, ...bot.reverse()];
  }
  if (view === 'plan') {
    const a = [], b = [];
    for (let s = 0; s < g.count; s++) { a.push({ x: xAt(s), y: 0, z: sil.zHiM[s] }); b.push({ x: xAt(s), y: 0, z: sil.zLoM[s] }); }
    return [...a, ...b.reverse()];
  }
  if (view === 'frontal') {
    /* contour polygon sorted by clock angle; drawn at the hull's own widest
       stations, so each vertex carries its true x for recession */
    const idx = payload.grid.thetaRad.map((th, i) => ({ th, i })).sort((p, q) => p.th - q.th);
    const n = payload.grid.nStations, { x0M, lengthM } = geo.extentM;
    return idx.map(({ th, i }) => ({
      x: x0M + (geo.frontalContourStation[i] / (n - 1)) * lengthM,
      y: geo.frontalContourRM[i] * Math.cos(th),
      z: geo.frontalContourRM[i] * Math.sin(th),
    }));
  }
  throw new Error(`hullOutline: unknown view '${view}'`);
}
