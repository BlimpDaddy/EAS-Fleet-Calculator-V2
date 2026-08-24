/**
 * THE BULLSEYE DERIVATIVE GUARD — spec 54, implemented as frozen.
 *
 *   full ribbon positions retained -> normal turning analysis
 *   -> ribbon enters the bullseye -> record closure position -> NO DERIVATIVE
 *
 * A tiny numerical guard, not a subsystem. No geometry is discarded; only the
 * DIFFERENTIATION of the final sliver stops. No spline, no tip
 * reconstruction, no detector, no nose/tail model, nothing handed to A(x).
 *
 * `ribbonMetrics` in ribbons.mjs is NOT modified. This is a parallel metric so
 * the guarded and unguarded numbers can be compared directly, which is how
 * G4 (positional output bit-identical) is verified rather than asserted.
 */
import { ZONES } from './ribbons.mjs';

const SECANT_FRAC = 0.03;          // 4.6, frozen
export const LADDER = [0.01, 0.02, 0.05];   // 54.4

/**
 * Guarded turning metrics for one ribbon.
 *
 * 54.3:
 *  - reference radius is the ribbon's OWN max over the frozen retained domain;
 *  - a station is usable iff BOTH secant endpoints clear the bullseye, because
 *    the secant is a physical span and a stencil reaching into the sliver
 *    differentiates it just as surely as a station inside it;
 *  - turning accumulates only between CONSECUTIVE usable stations;
 *  - ZONE BOUNDARIES DO NOT MOVE — zones stay fixed on the retained domain in
 *    x/L (4.8), so zone k means the same fractional position on every body and
 *    every representation. Zones 0 and 7 simply accumulate over less of it.
 *
 * @param eps  bullseye fraction; null runs the metric completely unguarded,
 *             which must reproduce `ribbonMetrics` exactly.
 */
export function guardedMetrics(r, L, { tipFrac, eps = null, zones = ZONES, secantFrac = SECANT_FRAC } = {}) {
  const N = r.length, dx = L / (N - 1);
  const half = Math.max(1, Math.round(((secantFrac / 2) * L) / dx));
  const i0 = Math.ceil(tipFrac * (N - 1)), i1 = Math.floor((1 - tipFrac) * (N - 1));

  let Rref = 0;
  for (let i = i0; i <= i1; i++) if (r[i] > Rref) Rref = r[i];
  const floor = eps === null ? -Infinity : eps * Rref;

  /* x_close: first entry into the bullseye, scanning inward from each end.
     A POSITION, not a derivative (54.3). Reported, never a criterion. */
  let closeAft = null, closeFore = null;
  for (let i = i1; i >= i0; i--) { if (r[i] >= floor) { closeAft = i; break; } }
  for (let i = i0; i <= i1; i++) { if (r[i] >= floor) { closeFore = i; break; } }

  const phi = [], idx = [];
  for (let i = i0; i <= i1; i++) {
    const a = Math.max(0, i - half), b = Math.min(N - 1, i + half);
    // BOTH secant endpoints must clear the bullseye
    if (r[a] < floor || r[b] < floor) continue;
    phi.push(Math.atan2(r[b] - r[a], (b - a) * dx));
    idx.push(i);
  }

  const z = Array.from({ length: zones }, () => ({ abs: 0, net: 0 }));
  let absTurn = 0, moment = 0;
  const span = i1 - i0;
  for (let k = 0; k + 1 < phi.length; k++) {
    // only accumulate between CONSECUTIVE usable stations
    if (idx[k + 1] !== idx[k] + 1) continue;
    const d = phi[k + 1] - phi[k];
    const u = (idx[k] - i0) / span;                   // zones fixed on the retained domain
    const zi = Math.min(zones - 1, Math.floor(u * zones));
    z[zi].abs += Math.abs(d); z[zi].net += d;
    absTurn += Math.abs(d); moment += u * Math.abs(d);
  }
  const netTurn = phi.length ? phi[phi.length - 1] - phi[0] : 0;
  return {
    i0, i1, zones: z, absTurn, netTurn, Rref,
    usable: idx.length, offered: i1 - i0 + 1,
    xCloseFore: closeFore, xCloseAft: closeAft,
    turnCentroid: absTurn > 0 ? moment / absTurn : 0,
    turningExcess: Math.abs(netTurn) > 1e-9 ? absTurn / Math.abs(netTurn) - 1 : 0,
  };
}
