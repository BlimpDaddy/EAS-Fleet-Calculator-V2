/**
 * FLOW ENGINE — Layer 2 of the sealed visualizer plan (V3 form).
 *
 * A pure state-transition function, no hidden module state:
 *
 *     step(payload, controls, previousState, dt) -> nextState
 *
 * V3 UPGRADES:
 *
 * 1. PER-PARTICLE COUNTER RNG. Every random draw is a pure hash of
 *    (seed, particle slot, spawn generation, draw counter) — no shared
 *    cursor in the state at all. Particle streams cannot couple, so the
 *    isolation gates are EXACT: a control change touches only the
 *    particles it is supposed to touch, bit-for-bit, forever.
 *
 * 2. DETACHMENT ON THE FROZEN TANGENT FIELD (the ruled V3 rule): a rail
 *    detaches where the LOCAL AFT TURNING — the change of the payload's
 *    `tangentRad` (spec-4.6 secant tangents, port-guarded upstream) over a
 *    fixed station window — exceeds one global styling threshold. Turning
 *    detaches where the surface BENDS: a cube corner is a turning spike, a
 *    sphere's turning accumulates past the cap partway aft, the slender
 *    tail's cone crease fires exactly at the crease. Evaluated only inside
 *    the earned tangent domain (spec 55.2); beyond it the body simply ends
 *    (tip release). The V1/V2 interim slope cap is retired.
 *
 * 3. BLI CAPTURE (the ruled behaviour, zone semantics from payload.bli):
 *    a RIDING particle inside the side sectors, the u-range and the
 *    near-surface band, whose own rail's detachment fires within
 *    `approachStations` ahead, is CAPTURED instead of shed: it skips
 *    detachment, rides the remaining surface (and the tail spike) at a
 *    tick accelerated by (1 + BLI_ACCEL_COEF × selectedS) — monotone in S,
 *    zero effect at S = 0 — carries a recolour flag, and re-emerges
 *    downstream as fast NON-wake flow. Wake tidies as a mechanical
 *    consequence of capture, never as authored animation. Degraded
 *    (INELIGIBLE) geometry never captures.
 *
 * Everything else stands from V1/V2: world-unit advection (§7.2), fixed
 * count with disc-uniform + cardinal-weighted + contour lanes, Cd drives
 * wake severity only, v ≤ 0 refused (M3), payload change invalidates
 * state, degraded = no rail-follow. The engine's output type is particle
 * states, full stop — nothing numerical may import this (M7 one-way gate).
 */

export const DT_S = 0.1;                 // 10 Hz logic — the ruled tick-tick grammar
export const COUNT_DESKTOP = 1800;       // 256 → 512 → 1000 → 1800 (Toby, 2026-08-22 V4 round:
                                         // "make default 1800 particles" — the sim box now fills
                                         // the whole instrument rectangle, so density needs it)
export const COUNT_MOBILE = 160;

/* INSTRUMENT-FILLING SIM BOX (Toby, 2026-08-22 V4 round: "other shapes —
   the entire viewport appears to change size, particles not touching
   rectangular edges"). The particle lifecycle box is the UNION of the
   payload's worldBounds and the box the instrument can SEE at the
   universal sphere-1 scale, so the flow fills the rectangle for every
   body instead of shrinking with it. worldBounds itself is untouched and
   remains the wake-metric coverage guarantee (schema row unchanged);
   the union can only be larger. The instrument aspect is DECLARED, never
   detected (house rule) — bench canvas is 960×480. Visible half-height
   at the universal scale = r1 / (2 · sphere1ViewportFrac). */
/* WIDE INSTRUMENT (owner ruling 2026-08-23: "particles going entirely
   L→R… keeping the ship the same size and circles but increasing the
   length of the flow… making the 'starting line' where it is currently
   to reduce a long waiting time"): the rectangle is 2.6:1, the ship sits
   LEFT of centre — upstream extent UNCHANGED from the original 2:1
   instrument (same spawn line, same arrival time), ALL the extra room
   goes to the wake run-out. Supersedes-in-part the 2026-08-21 sphere-1
   horizontal centring (vertical centring stands); dated amendment in the
   sealed plan §8. Declared constants — never window-derived (bit-exact
   determinism per payload). */
export const VIEW_UP = 2.0;              // upstream extent, × visible half-height (unchanged)
export const VIEW_DOWN = 3.2;            // downstream extent — the wake's run-out
export const VIEW_ASPECT = (VIEW_UP + VIEW_DOWN) / 2;   // = 2.6, instrument width : height
export function simBox(payload) {
  const wb = payload.worldBounds;
  const s1 = payload.spheres.sphere1;
  const halfH = s1.radiusM / (2 * payload.displayNormalization.sphere1ViewportFrac);
  return {
    xMinM: Math.min(wb.xMinM, s1.centerM[0] - VIEW_UP * halfH),
    xMaxM: Math.max(wb.xMaxM, s1.centerM[0] + VIEW_DOWN * halfH),
    yAbsM: Math.max(wb.yAbsM, halfH),
  };
}

/* V3 styling constants (blessed class: visualizer constants, not physics) */
export const TURN_WINDOW_M = 10;         // the turning window, DECLARED IN METRES (2026-08-22,
                                         // dated amendment): a station-count window gave the same
                                         // physical hull shoulder opposite verdicts on the 300 m and
                                         // 516 m grids (stations are normalized per body). A physical
                                         // surface must get one verdict; the window is physical.
export const TURN_CAP_RAD = 0.09;        // local aft turning per window that sheds a rail.
                                         // Trio-tuned: sphere sheds broadly (~0.74 R), the bare
                                         // hull's shoulder (~0.07 rad/10 m) rides through in BOTH
                                         // states, the slender tail's cone crease fires at the crease.
/* SMART-TAIL ATTACHMENT (owner ruling 2026-08-24, prototype).
 * WHAT:  on the DEPLOYED tail (stations aft of the retracted hull end)
 *        a rider tolerates TAIL_ATTACH_MULT × the ordinary aft-turning
 *        cap before it sheds — the fairing holds flow around its own
 *        curvature instead of shedding at the cone crease.
 * WHY:   the deployed tail's whole claim, on the same page, is a body
 *        that separates late (estimator 0.0217 / ruled 0.028 vs 0.18
 *        bare). Before this, the visualiser shed at the crease and gave
 *        the tail NO visible effect until BLI was switched on — the
 *        picture contradicted the page's own numbers (owner: "ideally
 *        the tail is working fairly well on its own, atm it really has
 *        no visible effect").
 * PROVENANCE: authored visual constant, owner-tuned; the crease geometry
 *        itself is untouched and every OTHER body keeps the plain cap.
 * LIMITATION: a styling/test-contract constant, not an aerodynamic
 *        claim — it says "this designed surface keeps its flow", which
 *        no solver here verifies.
 * REPLACE WHEN: a measured separation location for the deployed tail
 *        exists, or the owner re-rules the look. */
export const TAIL_ATTACH_MULT = 3.0;

export const JITTER_COEF = 0.05;         // wake radial jitter, × selectedCd × maxRadiusM per tick
export const SURFACE_BAND_FRAC = 0.03;   // riding offset off the rail, × maxRadiusM
export const CARDINAL_LANE_FRAC = 0;     // RETIRED (Toby, 2026-08-22): the 10× cardinal spokes
                                         // stacked riders on identical rails and fed the dense
                                         // central vanish-streams; with contour lanes at 0.5 and
                                         // 1000 particles, uniform θ traces better everywhere.
                                         // Constant kept at 0 so the mechanism stays documented.
export const CONTOUR_LANE_FRAC = 0.5;    // 0.35 → 0.5 (Toby, 2026-08-22: more outline tracing)
/* S-DRIVEN CAPTURE REACH (Toby, 2026-08-22 — the graded form of option (b)
   from the pending wake ruling): at S = 0 capture is EXACTLY the ruled
   zone (side sectors ± 30°, base approach window). Raising S widens the
   sector half-width, lengthens the approach window, starts capture
   earlier along the body and speeds the captured stream — all monotone
   (round-2 F2). The ramps are FRONT-LOADED in √S (Toby: "much more BLI
   evidence, especially at like 10–15%"), so the published-zone S already
   reads clearly; the full clock is reached near max S (the teal
   takeover). The DRAWN zone (V4) stays the authored side geography. */
export const BLI_ACCEL_COEF = 3.0;                 // captured tick ×(1 + coef·S^0.25). 2.2 → 3.0 (Toby,
                                                   // 2026-08-22 V4 round: "BLI should seem like a few
                                                   // less particles — just a slight reduction"), then
                                                   // √S → S^0.25 in the same round's second pass so
                                                   // residence front-loads with the rest of the capture
                                                   // system (×2.9 at S 0.15) and the near-total aft
                                                   // capture doesn't flood the screen green.
                                                   // 5 was "DEFS too fast" (Toby)
/* CAPTURE STRENGTH IS QUARTER-ROOT FRONT-LOADED (Toby, 2026-08-22 V4
   round, second pass: "roughly where the effect is now at .7 I want to
   look like that at around .15"): the capture-fraction and approach-
   horizon terms ramp in S^0.25 instead of √S, so the drag-eating look
   saturates by the published-zone S values. Still monotone in S; S = 0
   still exactly the ruled base behaviour. Sector widening stays √S (it
   already reaches the full clock by S ≈ 0.15). */
export const BLI_CAPTURE_FRAC_BASE = 0.35;         // fraction of would-be shedders eaten: base +
export const BLI_CAPTURE_FRAC_COEF = 0.6;          // coef·S^0.25 (per-particle deterministic) — the
                                                   // rest shed and swirl. 0.3/0.5·√S → 0.35/0.6·S^0.25
                                                   // in the same second pass (mid-hull odds at S 0.15
                                                   // ≈ 0.72, the old S 0.7 value)
/* AFT CAPTURE BOOST (Toby, 2026-08-22 V4 round: "make BLI a bit more
   effective on the drag particles, esp. the ones appearing at around 80%
   of the body", then "grabbing a little bit more… accentuate further"):
   extra capture odds ramping up over the aft hull, so the late shedders —
   the browns born at the hull's back shoulder — get eaten preferentially.
   Measured on the RETRACTED hull length like the capture floor, so the
   boost sits at the same physical stations in both states. */
export const BLI_AFT_RAMP_U0 = 0.6;                // boost ramps 0 → 1 over this hull fraction…
export const BLI_AFT_RAMP_U1 = 0.85;               // …reaching full strength by 85% of the hull
export const BLI_CAPTURE_AFT_BONUS = 0.7;          // extra capture fraction × ramp × S^0.25
                                                   // (0.35 → 0.7 same round; aft odds saturate ≈ 1
                                                   // by S 0.15 — the ruled "eats ALL the drag" read)

/* WAKE = DRIFTING EDDIES (Toby, 2026-08-22 V4 round: "the drag particles
   should move in circles, quite large, so as to emphasise the turbulence —
   rather than moving in a straight line after the body… it'll fill in,
   for instance, the space after the sphere instead of 2 lines of 'drag'
   and some void"). SUPERSEDES the same-day coherent-swirl sinusoid: each
   shed particle now rides a drifting circle (a cycloid) in the (x, r)
   plane — per-particle phase and eddy size, fixed angular period, eddy
   radius monotone in selectedCd (the severity ruling), baseline still
   decaying inward so the loops fill the void aft. A loop visibly curls
   back when R·ω exceeds the airspeed — the big eddies do, the small ones
   just weave, which mixes into a turbulent read instead of two lines. */
export const WAKE_EDDY_RAD_FRAC = 0.65;            // eddy size × maxRadius × per-particle 0.6–1.4
export const WAKE_EDDY_SEV_BASE = 0.2;             // severity weighting (base + slope·cd): 0.3+0.7·cd
export const WAKE_EDDY_SEV_SLOPE = 0.8;            // → 0.2+0.8·cd with frac 0.7 → 0.65 (Toby,
                                                   // 2026-08-22 V4 round 3: "just a bit too big —
                                                   // moving vertically into the white stream above and
                                                   // below… a bit smaller in circle size would do the
                                                   // job"): at his viewed Cd 0.043 the eddies come out
                                                   // ~34% smaller, while high-Cd wakes keep their
                                                   // churn — which is also what keeps the frozen H5
                                                   // sphere-vs-default separation ≥ 0.1
export const WAKE_EDDY_X_SEV = 0.55;               // the x-leg's FIXED severity factor: Cd may never
                                                   // move any particle's x (H3 pre-registered rule —
                                                   // "no slowdown", recycle timing Cd-independent), so
                                                   // only the RADIAL leg scales with (0.3 + 0.7·cd);
                                                   // the eddy is an ellipse whose height is severity
export const WAKE_EDDY_PERIOD_S = 3;               // seconds per eddy revolution
export const WAKE_DECAY_FLOOR = 0.8;               // 0.35 → 0.8 with the eddy design (2026-08-22, same
                                                   // round): the LOOPS fill the void now, so the deep
                                                   // inward decay lost its job — and it drowned the
                                                   // Cd-scaled radial leg (|−c + R·sin| aggregates
                                                   // FLAT until R exceeds the decay depth), breaking
                                                   // H3's strictly-increasing severity. Shallow decay
                                                   // keeps eddies centred near the shed radius.
export const WAKE_RESIDUAL_JITTER = 0.012;         // × maxRadius × cd per tick (kept)
/* CAPTURE = EAT THE WOULD-BE SHEDDERS (Toby, 2026-08-22, settling round:
   the back-third blanket suction flooded the interior with teal at low S,
   while top/bottom drag lines survived out of sector reach. Capture is
   now purely riders APPROACHING THEIR DETACHMENT — the drag eaten at its
   source — with the eligible clock fraction ramping fast: sides-only at
   S = 0, the full clock by S ≈ 0.15, so the visible wake lines above and
   below get sucked once any published-zone S is dialled. Captured
   population ≈ the shedder flux: selective, not a flood.) */
export const BLI_BASE_HALF_RAD = Math.PI / 4;      // ±45° at S = 0 (sides only)
export const BLI_SECTOR_WIDEN_RAD = (3 * Math.PI) / 4; // full clock by √S ≈ 0.6 (S ≈ 0.15 in practice)
export const BLI_APPROACH_BASE_X = 1;              // horizon = approachStations × (baseX + coef·√S)
export const BLI_APPROACH_COEF = 2;                // modest: capture near the shed point, not far upstream
export const BLI_X_START_HULL_FRAC = 0.55;         // capture begins just aft of HULL-halfway
                                                   // (0.5 → 0.55, Toby at V4 entry: "a fraction
                                                   // later along the body") — measured on the
                                                   // retracted hull length, so the tail-on state's
                                                   // floor sits at the same physical station.

/* ---- counter-based RNG: pure hash, no shared stream ------------------- */
function pRand(seed, slot, gen, draw) {
  let h = (seed | 0) ^ Math.imul(slot + 1, 0x9e3779b1) ^ Math.imul(gen + 1, 0x85ebca6b) ^ Math.imul(draw + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

function activeState(payload, controls) {
  if (controls.smartTail && payload.extended) return { geo: payload.extended, softFail: false };
  if (controls.smartTail && !payload.extended) return { geo: payload.retracted, softFail: true };
  return { geo: payload.retracted, softFail: false };
}

/** nearest station index of x on this state's uniform inclusive grid, or null outside */
export function stationOf(geo, x, nStations) {
  const { x0M, lengthM } = geo.extentM;
  if (x < x0M || x > x0M + lengthM) return null;
  return Math.round(((x - x0M) / lengthM) * (nStations - 1));
}

export function railAt(geo, thetaIdx, station, nStations) {
  const s = Math.min(nStations - 1, Math.max(0, station));
  return geo.railsRM[thetaIdx * nStations + s];
}

/** world position of a particle (θ = 0 is UP, +y; increasing toward +z) */
export function worldPos(payload, p) {
  const th = payload.grid.thetaRad[p.thetaIdx];
  return { x: p.x, y: p.r * Math.cos(th), z: p.r * Math.sin(th) };
}

/**
 * THE FROZEN-TANGENT DETACHMENT RULE: does the rail at thetaIdx fire at
 * station s? Local aft turning = φ(s − w) − φ(s) over the fixed window
 * (positive when the tangent rotates closed). Only inside the earned
 * domain; the fixture-facing helper below also reports the first firing
 * station at or after `from` (BLI's approaching-detachment predicate).
 */
export function turningFires(geo, thetaIdx, s, nStations, cap = TURN_CAP_RAD) {
  const d = geo.tangentDomain;
  const dxs = geo.extentM.lengthM / (nStations - 1);
  const w = Math.max(1, Math.round(TURN_WINDOW_M / dxs));      // physical window → stations
  if (s - w < d.i0 || s > d.i1) return false;
  const phiBack = geo.tangentRad[thetaIdx * nStations + s - w];
  const phiHere = geo.tangentRad[thetaIdx * nStations + s];
  /* AFT turning only: the surface must actually be CLOSING here. Without
     the phiHere < 0 guard the rule also fired where nose expansion eases
     off — mass shedding at hull-fraction 0.1–0.4, caught by the suction
     diagnostic 2026-08-22. */
  return phiHere < 0 && phiBack - phiHere > cap;
}

export function nextDetachStation(geo, thetaIdx, from, horizon, nStations) {
  for (let s = from; s <= Math.min(from + horizon, geo.tangentDomain.i1); s++) {
    if (turningFires(geo, thetaIdx, s, nStations)) return s;
  }
  return null;
}

function drawLane(seed, slot, gen, wb, nTheta, geo) {
  const d1 = pRand(seed, slot, gen, 0);
  const d2 = pRand(seed, slot, gen, 1);
  const d3 = pRand(seed, slot, gen, 2);
  let thetaIdx;
  if (d2 < CARDINAL_LANE_FRAC) {
    const q = nTheta / 4;
    const slotIdx = Math.min(11, Math.floor(d3 * 12));
    const card = Math.floor(slotIdx / 3) * q;
    thetaIdx = (card + (slotIdx % 3) - 1 + nTheta) % nTheta;
  } else {
    thetaIdx = Math.min(nTheta - 1, Math.floor(d3 * nTheta));
  }
  let lane;
  if (d1 < CONTOUR_LANE_FRAC) {
    const v = d1 / CONTOUR_LANE_FRAC;
    lane = geo.frontalContourRM[thetaIdx] * (0.15 + 0.8 * v);
  } else {
    const v = (d1 - CONTOUR_LANE_FRAC) / (1 - CONTOUR_LANE_FRAC);
    lane = wb.yAbsM * Math.sqrt(v);
  }
  return { lane, thetaIdx };
}

export function initState(payload, { seed = 1, count = COUNT_DESKTOP } = {}) {
  const wb = simBox(payload);                    // instrument-filling lifecycle box (⊇ worldBounds)
  const nTheta = payload.grid.nTheta;
  const particles = [];
  for (let i = 0; i < count; i++) {
    const x = wb.xMinM + ((wb.xMaxM - wb.xMinM) * i) / count;
    const d = drawLane(seed, i, 0, wb, nTheta, payload.retracted);
    particles.push({
      slot: i, gen: 0, x, r: d.lane, thetaIdx: d.thetaIdx, lane: d.lane,
      riding: false, wake: false, captured: false, wakeStartX: null, wakeStartR: null,
    });
  }
  return {
    payloadId: payload.payloadId, seed,
    simTimeS: 0, stepCount: 0, particles,
    softFail: false, degraded: false,
  };
}

function inBliZone(payload, geo, p, nStations, sqrtS) {
  const th = payload.grid.thetaRad[p.thetaIdx];
  /* sector test widened by √S: distance to the nearest side-sector CENTRE */
  const halfWidth = BLI_BASE_HALF_RAD + sqrtS * BLI_SECTOR_WIDEN_RAD;
  const dSide = Math.min(
    Math.abs(th - Math.PI / 2),
    Math.abs(th - (3 * Math.PI) / 2),
  );
  if (dSide > halfWidth) return false;
  const xFloor = geo.extentM.x0M + BLI_X_START_HULL_FRAC * payload.retracted.extentM.lengthM;
  if (p.x < xFloor) return false;
  const u = (p.x - geo.extentM.x0M) / geo.extentM.lengthM;
  if (u > payload.bli.uRange[1]) return false;
  const s = stationOf(geo, p.x, nStations);
  if (s === null) return false;
  if (p.riding) return true;                 // a rider is ON the surface by construction — the
                                             // band test rejected riders on thin tail sections
                                             // (15% of a 6 m rail < our own riding offset)
  const rail = railAt(geo, p.thetaIdx, s, nStations);
  return p.r - rail <= payload.bli.captureBandFrac * rail;
}

export function step(payload, controls, prev, dt = DT_S) {
  const v = controls.airspeedMps;
  if (!(v > 0)) throw new Error('step: airspeedMps must be > 0 (PARKED never consults the engine — M3)');
  if (prev.payloadId !== payload.payloadId) {
    throw new Error('step: state was built for a different payload — regeneration must reset state (round-3 F2)');
  }
  const { geo, softFail } = activeState(payload, controls);
  const geoKey = geo === payload.extended ? 'extended' : 'retracted';
  /* GEOMETRY-STATE TOGGLE: wake/captured particles belong to the state
     that made them — carried across a toggle they appear as stale brown
     mid-body on the other silhouette (caught on the bench 2026-08-22).
     A toggle selects one complete state (sealed plan §2.1): old-state
     wake and captures recycle; riders simply re-snap to the new rails. */
  const stateSwitched = prev.geoKey !== undefined && prev.geoKey !== geoKey;
  const degraded = geo.eligibility.outcome !== 'ELIGIBLE';
  const wb = simBox(payload);                    // instrument-filling lifecycle box (⊇ worldBounds)
  const nStations = payload.grid.nStations;
  const nTheta = payload.grid.nTheta;
  const cd = Math.min(1, Math.max(0, controls.selectedCd ?? 0));
  const sVal = Math.min(1, Math.max(0, controls.selectedS ?? 0));
  const sqrtS = Math.sqrt(sVal);                             // front-loaded BLI ramps
  const band = SURFACE_BAND_FRAC * geo.maxRadiusM;
  const seed = prev.seed, tick = prev.stepCount;

  const particles = prev.particles.map((p0) => {
    const p = { ...p0 };
    const speedFactor = p.captured ? 1 + BLI_ACCEL_COEF * Math.sqrt(sqrtS) : 1;   // S^0.25 front-load
    p.x += v * dt * speedFactor;

    if (p.x > wb.xMaxM || (stateSwitched && (p.wake || p.captured))) {   // recycle: boundary, or stale cross-state flow
      p.gen += 1;
      const d = drawLane(seed, p.slot, p.gen, wb, nTheta, geo);
      /* de-phased respawn: captured cohorts share a speed and a capture
         spot, so exact-plane respawn produced a synchronized vertical
         wall marching across every lap (Toby caught it). Spread re-entry
         over 15% of the box, per-particle deterministic. */
      p.x = wb.xMinM + pRand(seed, p.slot, p.gen, 3) * 0.15 * (wb.xMaxM - wb.xMinM);
      p.lane = d.lane; p.thetaIdx = d.thetaIdx; p.r = p.lane;
      p.riding = false; p.wake = false; p.captured = false; p.wakeStartX = null; p.wakeStartR = null; p.wakeAge = 0;
      return p;
    }

    if (p.wake) {                                           // drifting eddies; severity monotone in selectedCd
      const age = (p.wakeAge = (p.wakeAge ?? 0) + 1);
      const phase = pRand(seed, p.slot, p.gen, 5) * 2 * Math.PI;
      const rf = 0.6 + 0.8 * pRand(seed, p.slot, p.gen, 6);
      const Re = WAKE_EDDY_RAD_FRAC * geo.maxRadiusM * rf;
      const Rx = Re * WAKE_EDDY_X_SEV;                      // Cd-free — see WAKE_EDDY_X_SEV
      const Rr = Re * (WAKE_EDDY_SEV_BASE + WAKE_EDDY_SEV_SLOPE * cd);   // severity is the radial leg
      const om = (2 * Math.PI) / WAKE_EDDY_PERIOD_S;
      const a1 = phase + om * age * dt, a0 = phase + om * (age - 1) * dt;
      p.x += Rx * (Math.cos(a1) - Math.cos(a0));            // the eddy's x-leg on top of the drift → loops
      const L = geo.extentM.lengthM;
      const base = p.wakeStartR * Math.max(WAKE_DECAY_FLOOR, 1 - 0.5 * ((p.x - p.wakeStartX) / L));
      const jr = pRand(seed, p.slot, p.gen, 1000 + tick);
      const jitter = (jr * 2 - 1) * WAKE_RESIDUAL_JITTER * cd * geo.maxRadiusM;
      p.r = Math.max(0, base + Rr * Math.sin(a1) + jitter); // clamp, not fold — folding broke severity monotonicity
      return p;
    }

    const s = stationOf(geo, p.x, nStations);

    if (degraded) {                                         // ruled fallback: no rail-follow, no detachment, no capture
      if (p.lane < geo.maxRadiusM && p.x > geo.extentM.x1M) {
        p.wake = true; p.wakeStartX = p.x; p.wakeStartR = p.r;
      }
      return p;
    }

    if (p.captured) {                                       // ride the remaining surface, then stream downstream fast
      if (s !== null) p.r = railAt(geo, p.thetaIdx, s, nStations) + band;
      return p;                                             // never wake — capture instead of shed
    }

    /* BLI capture: a FRACTION of riders approaching their own detachment
       are sucked in instead of shed (per-particle deterministic draw);
       the rest shed and swirl — the wake is a feature now */
    const hull = payload.retracted.extentM;
    const aftRamp = Math.min(1, Math.max(0,
      ((p.x - hull.x0M) / hull.lengthM - BLI_AFT_RAMP_U0) / (BLI_AFT_RAMP_U1 - BLI_AFT_RAMP_U0)));
    const sCap = Math.sqrt(sqrtS);                          // S^0.25 — the quarter-root front-load
    if (controls.bli && p.riding && s !== null && inBliZone(payload, geo, p, nStations, sqrtS)
      && pRand(seed, p.slot, p.gen, 4) < BLI_CAPTURE_FRAC_BASE + (BLI_CAPTURE_FRAC_COEF + BLI_CAPTURE_AFT_BONUS * aftRamp) * sCap
      && nextDetachStation(geo, p.thetaIdx, s,
        Math.round(payload.bli.approachStations * (BLI_APPROACH_BASE_X + BLI_APPROACH_COEF * sCap)), nStations) !== null) {
      p.captured = true;
      p.r = railAt(geo, p.thetaIdx, s, nStations) + band;
      return p;
    }

    if (!p.riding) {
      if (s !== null && p.lane < railAt(geo, p.thetaIdx, s, nStations)) {
        p.riding = true;
        p.r = railAt(geo, p.thetaIdx, s, nStations) + band;
      }
      return p;                                             // freestream: straight lane
    }

    /* riding */
    if (s === null || p.x > geo.extentM.x1M) {              // body ended — tip release
      p.wake = true; p.wakeStartX = p.x; p.wakeStartR = p.r;
      return p;
    }
    /* the DEPLOYED body is one continuous designed surface — its raised
       cap applies along the whole of it, not just aft of the graft:
       measured 2026-08-24, 87% of detachments were happening on the
       HULL's aft shoulder, upstream of the tail, which is precisely the
       separation the fairing exists to prevent. The bare hull keeps the
       plain cap and its honest early shedding. */
    if (turningFires(geo, p.thetaIdx, s, nStations,
      geoKey === 'extended' ? TURN_CAP_RAD * TAIL_ATTACH_MULT : TURN_CAP_RAD)) {   // frozen-tangent rule
      p.wake = true; p.wakeStartX = p.x; p.wakeStartR = p.r;
      return p;
    }
    p.r = railAt(geo, p.thetaIdx, s, nStations) + band;
    return p;
  });

  return {
    payloadId: prev.payloadId, seed, geoKey,
    simTimeS: prev.simTimeS + dt, stepCount: prev.stepCount + 1,
    particles, softFail, degraded,
  };
}
