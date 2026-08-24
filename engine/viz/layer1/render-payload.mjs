/**
 * ribbon-render/1 GENERATOR — Layer 1 of the sealed visualizer plan.
 *
 * Assembles the render payload from the sealed estimator machinery. It
 * MEASURES NOTHING NEW: rails, eligibility and the scalar context come from
 * the frozen `ribbonContext` (spec 70); silhouettes from the production
 * `measureSections`; spheres from the exact Welzl miniball; frontal area
 * from the §4.2 projection. This module packages, quantizes and never
 * calibrates.
 *
 * Payload frame: +X flight, θ=0 UP, metres, retracted-state volume centroid
 * at the origin. Callers hand in meshes ALREADY in that frame (the runner /
 * page adapter owns loading, orientation and scale).
 *
 * PORT GUARD: the per-station tangent field re-implements the frozen secant
 * rule (spec 4.6). Before any payload is returned, its per-zone integrated
 * turning is checked against `ribbonMetrics` for EVERY ribbon of EVERY
 * state — a drifted port fails loudly here, not in a picture.
 */
import { ribbonContext } from '../../spike/sectional/ribbon-context.mjs';
import { ribbonMetrics, ZONES, SECANT_FRAC } from '../../spike/sectional/ribbons.mjs';
import { TIP } from '../../spike/sectional/support-skin.mjs';
import { miniball } from '../../src/miniball.js';
import { projectedFrontalArea } from '../../src/dynamicsGeometry.js';
import {
  SCHEMA, AUTHORITY, N_STATIONS, N_THETA, BLI,
  SPHERE1_VIEWPORT_FRAC, SPHERE2_VIEWPORT_FRAC,
  WAKE_MARGIN_FRAC, UPSTREAM_MARGIN_FRAC, LATERAL_MARGIN_FACTOR, Q,
  LINEWORK_SEG_BUDGET, LINEWORK_POINT_BUDGET,
} from './constants.mjs';
import { quantize, quantizeArray } from './canonical-json.mjs';

/** Frozen secant tangent (spec 4.6) per station; 0 outside the tip-trimmed domain. */
function tangentField(r, L) {
  const N = r.length, dx = L / (N - 1);
  const half = Math.max(1, Math.round(((SECANT_FRAC / 2) * L) / dx));
  const i0 = Math.ceil(TIP * (N - 1)), i1 = Math.floor((1 - TIP) * (N - 1));
  const phi = new Array(N).fill(0);
  for (let i = i0; i <= i1; i++) {
    const a = Math.max(0, i - half), b = Math.min(N - 1, i + half);
    phi[i] = Math.atan2(r[b] - r[a], (b - a) * dx);
  }
  return { phi, i0, i1 };
}

/** PORT GUARD — integrated |Δφ| per zone must equal ribbonMetrics exactly. */
function assertTangentsMatchMetrics(rail, phi, i0, i1, L, label) {
  const m = ribbonMetrics(rail, L, { tipFrac: TIP });
  const z = new Array(ZONES).fill(0);
  const span = i1 - i0;
  for (let i = i0; i + 1 <= i1; i++) {
    const u = (i - i0) / span;
    const zi = Math.min(ZONES - 1, Math.floor(u * ZONES));
    z[zi] += Math.abs(phi[i + 1] - phi[i]);
  }
  for (let k = 0; k < ZONES; k++) {
    if (Math.abs(z[k] - m.zones[k].abs) > 1e-9) {
      throw new Error(`tangent port drifted from ribbonMetrics (${label}, zone ${k}: ${z[k]} vs ${m.zones[k].abs})`);
    }
  }
}

/**
 * Silhouettes FROM THE RAILS (2026-08-22, replaces the ray-parity scan):
 * for convex-per-section bodies the view envelope IS the support radius in
 * the cardinal direction — exact for the composite two-shell union, immune
 * to the parity confusion that notched the tail-on outline at the graft,
 * and to the ray-grid bin noise the V1 gates caught earlier. Cardinal rail
 * indices: 0 = +y (up), 12 = +z, 24 = −y, 36 = −z (spec-70 enumeration).
 * Axis-explicit names: elevation (side) view draws yLoM/yHiM; plan
 * (top-down) view draws zLoM/zHiM.
 */
function silhouettesFromRails(R, xs, verts = null) {
  const n = xs.length, nT = R.length;
  /* CORRECTION 2026-08-22 (owner-flagged "point at the very front"): the
     cardinal rails alone are exact only where the section ENCLOSES the
     axis. Where a ray misses the surface its rail carries 0, and reading
     that as "surface at the axis" drew a spur on the axis ahead of the
     Sunship's low-slung nose (elevation) and pinched the plan outline to
     a needle. The envelope is now the min/max of y = r·cosθ, z = r·sinθ
     over the COVERED rays (r > 0) of the full clock — byte-identical to
     the cardinals wherever coverage is full (sphere, cube, mid-hull),
     honestly convergent at part-covered boundary stations. A station
     with no covered ray copies its nearest covered neighbour
     (sanitizedBins counts them, per the schema). Still measures nothing
     new — a repackaging of the same frozen rail field. */
  const yHi = new Array(n), yLo = new Array(n), zHi = new Array(n), zLo = new Array(n);
  const covered = new Array(n).fill(false);
  const rayN = new Array(n).fill(0);                   // covered-ray count per station
  let sanitizedBins = 0;
  for (let s = 0; s < n; s++) {
    let hi = -Infinity, lo = Infinity, zh = -Infinity, zl = Infinity;
    for (let t = 0; t < nT; t++) {
      const r = R[t][s];
      if (!(r > 0)) continue;                          // ray missed the surface — no claim
      const th = (2 * Math.PI * t) / nT;               // spec-70 enumeration: θ=0 UP, toward +z
      const y = r * Math.cos(th), z = r * Math.sin(th);
      if (y > hi) hi = y;
      if (y < lo) lo = y;
      if (z > zh) zh = z;
      if (z < zl) zl = z;
      covered[s] = true;
      rayN[s]++;
    }
    if (covered[s]) { yHi[s] = hi; yLo[s] = lo; zHi[s] = zh; zLo[s] = zl; }
  }
  /* VERTEX PASS (2026-08-22, third correction — owner: the lifted tail's
     glow line zigzagged at the cone→spike handoff): where a thin section
     sits at the edge of containing the axis, the 48-ray fan alternates
     hit/miss between stations and the envelope flips by metres. Every
     mesh vertex is an on-surface sample, so the envelope takes the max
     over ray far-hits ∪ vertices per station band — a strictly tighter
     lower bound everywhere (never worse: both sample sets lie on the
     surface of a convex-per-section body; interior points can never
     exceed the extremes). Dense tail rings pin the envelope exactly
     where rays are noisy; sparse meshes (cube corners) keep the rail
     values where bands carry no vertices. */
  if (verts) {
    const x0 = xs[0], dx = (xs[n - 1] - xs[0]) / (n - 1);
    const vHi = new Array(n), vLo = new Array(n), vzH = new Array(n), vzL = new Array(n);
    const vCount = new Array(n).fill(0);
    for (const p of verts) {
      const s = Math.round((p[0] - x0) / dx);
      if (s < 0 || s >= n) continue;
      if (!vCount[s]) { vHi[s] = p[1]; vLo[s] = p[1]; vzH[s] = p[2]; vzL[s] = p[2]; }
      else {
        if (p[1] > vHi[s]) vHi[s] = p[1];
        if (p[1] < vLo[s]) vLo[s] = p[1];
        if (p[2] > vzH[s]) vzH[s] = p[2];
        if (p[2] < vzL[s]) vzL[s] = p[2];
      }
      vCount[s]++;
    }
    for (let s = 0; s < n; s++) {
      if (!vCount[s]) continue;
      /* OFF-AXIS OVERRIDE (2026-08-22, the lifted-tail zigzag): the rail
         field cannot represent a section that does not contain the axis —
         rays that miss carry 0 and the skin's station window smears
         upstream geometry into thin stations (measured: spike stations
         reporting the cone's flank). Where the band has at least a full
         ring of vertices AND the vertex envelope shows the section fully
         off-axis AND the ray coverage corroborates it (an off-axis blob
         subtends at most half the clock from the axis — a mid-hull band
         whose sparse vertices happen to sit one-sided must NOT trigger:
         that regression drew the outline diving through the body), the
         vertex envelope is authoritative. On-axis stations keep the
         union of both sample sets (strictly tighter, never worse). */
      const offAxis = vCount[s] >= 16 && rayN[s] <= nT / 2
        && (vLo[s] > 0 || vHi[s] < 0 || vzL[s] > 0 || vzH[s] < 0);
      if (offAxis || !covered[s]) {
        covered[s] = true;
        yHi[s] = vHi[s]; yLo[s] = vLo[s]; zHi[s] = vzH[s]; zLo[s] = vzL[s];
      } else {
        if (vHi[s] > yHi[s]) yHi[s] = vHi[s];
        if (vLo[s] < yLo[s]) yLo[s] = vLo[s];
        if (vzH[s] > zHi[s]) zHi[s] = vzH[s];
        if (vzL[s] < zLo[s]) zLo[s] = vzL[s];
      }
    }
  }
  for (let s = 0; s < n; s++) {
    if (covered[s]) continue;
    sanitizedBins++;
    let d = 1, k = -1;
    while (k < 0 && d < n) {
      if (s - d >= 0 && covered[s - d]) k = s - d;
      else if (s + d < n && covered[s + d]) k = s + d;
      d++;
    }
    if (k < 0) { yHi[s] = 0; yLo[s] = 0; zHi[s] = 0; zLo[s] = 0; }
    else { yHi[s] = yHi[k]; yLo[s] = yLo[k]; zHi[s] = zHi[k]; zLo[s] = zLo[k]; }
  }
  return {
    xGrid: {
      x0M: quantize(xs[0], Q.METERS),
      dxM: quantize((xs[n - 1] - xs[0]) / (n - 1), Q.METERS + 2),
      count: n,
      convention: 'station centers at x0M + s * dxM (the rail station grid)',
    },
    yHiM: quantizeArray(yHi, Q.METERS),
    yLoM: quantizeArray(yLo, Q.METERS),
    zHiM: quantizeArray(zHi, Q.METERS),
    zLoM: quantizeArray(zLo, Q.METERS),
    sanitizedBins,
  };
}

/**
 * LINEWORK — the raw shape's display geometry (owner ruling 2026-08-22:
 * "draw both the shape and its hull, hull in magenta same as page 1,
 * shape in orange, same visuals as page 1"). Page-1 grammar: edges when
 * the file has any (face boundaries + explicit `l` polylines), dots for
 * genuinely lineless point clouds; decimated by uniform stride to the
 * blessed budgets. Display-only: the hull remains the geometry identity
 * for every measurement (canonical upload-hull rule, 2026-08-16).
 */
function buildLinework(display) {
  if (!display) return null;
  const note = 'raw shape display geometry (page-1 grammar); the hull remains the measured aero object';
  let segs = display.segs && display.segs.length ? display.segs : null;
  if (segs) {
    if (segs.length > LINEWORK_SEG_BUDGET) {
      /* STRATIFIED LONGEST-FIRST selection (2026-08-22; second pass same
         day, owner: the lines "blank out a little" — pure longest-first
         clustered all the picks where the mesh has big panels and left
         other stretches of the body empty). Edges are binned by axial
         midpoint; each bin keeps its longest edges up to an equal quota,
         and leftover budget refills globally longest-first. Deterministic
         throughout: length desc, original index tiebreak, original order
         restored. (The first pass replaced uniform stride, which kept
         mostly few-metre edges that render sub-pixel — confetti.) */
      const NBINS = 16;
      const len2 = (s) => (s[3] - s[0]) ** 2 + (s[4] - s[1]) ** 2 + (s[5] - s[2]) ** 2;
      const xs = segs.map((s) => (s[0] + s[3]) / 2);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const binOf = (x) => Math.min(NBINS - 1, Math.max(0, Math.floor(((x - x0) / (x1 - x0 || 1)) * NBINS)));
      const ranked = segs.map((s, i) => ({ l: len2(s), i, s, bin: binOf(xs[i]) }))
        .sort((a, b) => b.l - a.l || a.i - b.i);
      const quota = Math.floor(LINEWORK_SEG_BUDGET / NBINS);
      const perBin = new Array(NBINS).fill(0);
      const picked = [], leftovers = [];
      for (const e of ranked) {
        if (perBin[e.bin] < quota) { perBin[e.bin]++; picked.push(e); }
        else leftovers.push(e);
      }
      picked.push(...leftovers.slice(0, LINEWORK_SEG_BUDGET - picked.length));
      segs = picked.sort((a, b) => a.i - b.i).map((e) => e.s);
    }
    return { source: display.source, segsM: quantizeArray(segs.flat(), Q.METERS), pointsM: null, note };
  }
  let points = display.points && display.points.length ? display.points : null;
  if (!points) return null;
  if (points.length > LINEWORK_POINT_BUDGET) {
    const stride = Math.ceil(points.length / LINEWORK_POINT_BUDGET);
    points = points.filter((_, i) => i % stride === 0);
  }
  return { source: display.source, segsM: null, pointsM: quantizeArray(points.flat(), Q.METERS), note };
}

/** One complete state-scoped geometry block (round-2 F7).
 * `scalarOverride`: {compositeV1, softAft, softFore, cls, source} — used when
 * the VISUAL geometry differs from the geometry the estimator scored (the
 * composite tail state): rails/silhouettes come from the visual mesh, the
 * scalar stays sourced from the estimator-blessed surrogate, labelled. */
function stateBlock(verts, faces, identity, label, scalarOverride = null) {
  const ctx = ribbonContext(verts, faces, { label, geometrySource: identity });
  const { xs, R } = ctx.positional;
  const x0M = xs[0], x1M = xs[xs.length - 1], lengthM = x1M - x0M;
  if (R.length !== N_THETA || R[0].length !== N_STATIONS) {
    throw new Error(`stateBlock(${label}): grid ${R.length}x${R[0].length} != ${N_THETA}x${N_STATIONS}`);
  }

  const railsRM = new Array(N_THETA * N_STATIONS);
  const tangentRad = new Array(N_THETA * N_STATIONS);
  let maxR = 0, dom = null;
  for (let t = 0; t < N_THETA; t++) {
    const rail = R[t];
    const { phi, i0, i1 } = tangentField(rail, lengthM);
    assertTangentsMatchMetrics(rail, phi, i0, i1, lengthM, `${label} θ#${t}`);
    dom = { i0, i1 };
    for (let s = 0; s < N_STATIONS; s++) {
      const r = rail[s];
      if (r > maxR) maxR = r;
      railsRM[t * N_STATIONS + s] = quantize(r, Q.METERS);
      tangentRad[t * N_STATIONS + s] = quantize(phi[s], Q.RADIANS_TANGENT);
    }
  }

  const frontalContourRM = R.map((rail) => quantize(Math.max(...rail), Q.METERS));
  /* station index where each rail peaks — the frontal view's occlusion rule
     reads this; the renderer derives nothing, not even an argmax (V2) */
  const frontalContourStation = R.map((rail) => rail.indexOf(Math.max(...rail)));

  const e = ctx.eligibility;
  const eligSummary = (el) => ({
    outcome: el.outcome,
    E2: { pass: el.checks.E2.pass, multi: el.checks.E2.multi, missed: el.checks.E2.missed },
    E3: { pass: el.checks.E3.pass },
    E4: { pass: el.checks.E4.pass, worstShift: quantize(el.checks.E4.worstShift, Q.FRACTION) },
  });
  /* AUTHORITY SPLIT for composite states: estimator-context fields
     (scalar AND eligibility) come from the geometry the estimator scored;
     the visual mesh's own checks are still recorded for transparency.
     The composite's positional checks are clean (E2, convexity, manifold);
     only the descriptor-convergence criterion (E4) trips on the honest
     junction crease — a derivative-claim refusal, not a rails defect. */
  const block = {
      identity,
      eligibility: scalarOverride ? eligSummary(scalarOverride.eligibility) : eligSummary(e),
      eligibilitySource: scalarOverride ? scalarOverride.source : 'measured-self',
      visualGeometryChecks: scalarOverride ? eligSummary(e) : null,
      extentM: {
        x0M: quantize(x0M, Q.METERS),
        x1M: quantize(x1M, Q.METERS),
        lengthM: quantize(lengthM, Q.METERS),
      },
      maxRadiusM: quantize(maxR, Q.METERS),
      railsRM,
      tangentRad,
      tangentDomain: {
        i0: dom.i0, i1: dom.i1,
        note: 'frozen secant rule (spec 4.6); stations outside [i0,i1] carry 0 and make no derivative claim (spec 55.2)',
      },
      silhouettes: silhouettesFromRails(R, xs, verts),
      frontalContourRM,
      frontalContourStation,
      scalar: scalarOverride ? {
        compositeV1: quantize(scalarOverride.compositeV1, Q.SCORE),
        softAft: quantize(scalarOverride.softAft, Q.SCORE),
        softFore: quantize(scalarOverride.softFore, Q.SCORE),
        cls: scalarOverride.cls,
      } : {
        compositeV1: quantize(ctx.scalar.compositeV1, Q.SCORE),
        softAft: quantize(ctx.scalar.softAft, Q.SCORE),
        softFore: quantize(ctx.scalar.softFore, Q.SCORE),
        cls: ctx.scalar.cls,
      },
      scalarSource: scalarOverride ? scalarOverride.source : 'measured-self',
  };
  return {
    block,
    raw: { maxRadiusM: maxR, rail0: Array.from(R[0]) },
    thetaRad: ctx.positional.rays,
  };
}

/**
 * Build the (unfinalized) payload. Call `finalizePayload` on `.payload` to
 * stamp payloadId and obtain canonical bytes.
 *
 * @param name        stable body name (part of the payload, not a filename)
 * @param retracted   { verts, faces, identity } — payload frame, metres
 * @param extended    null | { verts, faces, identity, source } — same frame.
 *                    `source`: 'authored' | 'generic-tail-rule'
 * @param extendedReason  why extended is what it is (schema-required string)
 * @param orientationAxis DYNAMIC's declared file-frame orientation ('+Z' etc.)
 * @param display     null | { segs, points, source } — the RAW shape's
 *                    display geometry in payload frame (owner ruling
 *                    2026-08-22: shape orange inside magenta hull, page-1
 *                    grammar). segs: [x0,y0,z0,x1,y1,z1][]; points:
 *                    [x,y,z][] for lineless clouds. Display-only — the
 *                    hull remains the measured aero object.
 */
export function buildRenderPayload({ name, retracted, extended = null, extendedReason = 'not requested', orientationAxis, display = null }) {
  if (!orientationAxis) throw new Error('buildRenderPayload: orientationAxis is required (round-2 F3)');

  const ret = stateBlock(retracted.verts, retracted.faces, retracted.identity, `${name}/retracted`);
  const ext = extended
    ? stateBlock(extended.verts, extended.faces, extended.identity, `${name}/extended`, extended.scalar ?? null)
    : null;

  const m1 = miniball(retracted.verts);
  const sphere1 = { centerM: quantizeArray(m1.centre, Q.METERS), radiusM: quantize(m1.radius, Q.METERS) };
  let sphere2 = null;
  if (extended) {
    const m2 = miniball([...retracted.verts, ...extended.verts]);
    sphere2 = { centerM: quantizeArray(m2.centre, Q.METERS), radiusM: quantize(m2.radius, Q.METERS) };
  }

  /* worldBounds — particle lifecycle only; display scale NEVER derives from
     this box (round-2 F5 / Q8). Null extended ⇒ retracted extent + margins
     (round-4 F3). */
  const act = ext ? ext.block.extentM : ret.block.extentM;
  const outerR = sphere2 ? sphere2.radiusM : sphere1.radiusM;
  const lat = quantize(LATERAL_MARGIN_FACTOR * outerR, Q.METERS);
  const worldBounds = {
    xMinM: quantize(act.x0M - UPSTREAM_MARGIN_FRAC * act.lengthM, Q.METERS),
    xMaxM: quantize(act.x1M + WAKE_MARGIN_FRAC * act.lengthM, Q.METERS),
    yAbsM: lat, zAbsM: lat,
    spawnPlane: 'x = xMinM',
    wakeMarginFrac: WAKE_MARGIN_FRAC,
    note: 'Layer-2 lifecycle box; covers the wake-metric window (tail tip + 0.5 L)',
  };

  const A = projectedFrontalArea(retracted.verts, 'X');

  const payload = {
    schema: SCHEMA,
    authority: AUTHORITY,
    feedsNumbers: false,
    name,
    provenance: {
      generator: 'CalcV2/viz/layer1/render-payload.mjs',
      machinery: ['spec 53 support skin', 'spec 70 ribbonContext', 'src/sections.js silhouettes', 'src/miniball.js Welzl', 'src/dynamicsGeometry.js §4.2 projection'],
      note: 'real measurements from estimator-land; this consumer is read-only and feeds no number back',
    },
    frame: {
      flight: '+X',
      thetaZero: 'UP',
      orientationAxis,
      originNote: 'retracted-state volume centroid at origin (spec 4.1)',
      frontalAreaM2: quantize(A, Q.AREA_M2),
    },
    grid: {
      nStations: N_STATIONS,
      nTheta: N_THETA,
      stationConvention: 'uniform inclusive grid per state: x_i = extentM.x0M + i * (extentM.lengthM / (nStations - 1))',
      indexing: 'flat[thetaIndex * nStations + stationIndex]',
      thetaRad: quantizeArray(ret.thetaRad, Q.RADIANS_GRID),
      thetaConvention: 'theta = 0 is UP (+y), increasing toward +z; array order is the canonical half-plane enumeration (spec 70)',
    },
    retracted: ret.block,
    extended: ext ? ext.block : null,
    extendedReason,
    spheres: { sphere1, sphere2 },
    worldBounds,
    displayNormalization: {
      sphere1ViewportFrac: SPHERE1_VIEWPORT_FRAC,
      sunshipSphere2ViewportFrac: SPHERE2_VIEWPORT_FRAC,
      rule: 'sphere 1 universal on-screen size for every shape; scene scaled from the canonical tail-on composition; no rescale on toggle; E+A+S keeps this scale and clips truthfully (Q8)',
    },
    linework: buildLinework(display),
    bli: {
      uRange: BLI.uRange.map((v) => quantize(v, Q.FRACTION)),
      thetaSectorsRad: BLI.thetaSectorsRad.map((s) => s.map((v) => quantize(v, Q.RADIANS_GRID))),
      captureBandFrac: quantize(BLI.captureBandFrac, Q.FRACTION),
      approachStations: BLI.approachStations,
      captureCondition: BLI.captureCondition,
      authoredFor: 'Sunship (centre + rear two-thirds, side-mounted); generic bodies use the same constants on their own rail field',
    },
  };

  return {
    payload,
    raw: {
      frontalAreaM2: A,
      sphere1RadiusM: m1.radius,
      retractedMaxRadiusM: ret.raw.maxRadiusM,
      retractedRail0: ret.raw.rail0,
    },
  };
}
