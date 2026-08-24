/**
 * `ribbonContext` — spec 70, implemented as frozen.
 *
 *   AUTHORITY: SHADOW ONLY. Informational. It does not affect Cd.
 *
 * Production is BYTE-UNTOUCHED at 12e8c5e. This module CONSUMES the
 * production functions (`measureSections`, `scoreSections`,
 * `classifySections`) and never edits them. Wiring this into CalcV1-site is a
 * separate ruling (70.1).
 *
 * THERE IS NO AGGREGATE SCORE FIELD (70.3). F1-F5 cannot be collapsed into a
 * new magic scalar because there is nothing here to collapse them into. No
 * fitted weights exist anywhere in this file.
 *
 * Per spec 10 the per-ribbon field is retained in full. Derivative metrics are
 * computed ONLY over the earned zones 1-5 (55.2); zones 0, 6 and 7 keep their
 * positional values and are excluded from the descriptors.
 */
import { ZONES, ribbonMetrics } from './ribbons.mjs';
import { makeSupportSkin, supportRadii, supportPolygon, reflexCount, STATIONS, TIP } from './support-skin.mjs';
import { validateInput } from './eligibility.mjs';
import { measureSections, scoreSections } from '../../src/sections.js';
import { classifySections } from '../../src/cdEstimator.js';

const DEG = 180 / Math.PI;
export const RUNG = { sx: 0.005, thDeg: 2 };        // 55.1 canonical skin
export const EARNED = [1, 2, 3, 4, 5];              // 55.2 earned derivative domain
const PLANES_CONV = [12, 24, 48];                   // spec 6 convergence check
const CANON = 24;

const raysOf = (p) => Array.from({ length: 2 * p }, (_, k) => (Math.PI * (k % p)) / p + (k >= p ? Math.PI : 0));
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/**
 * @param verts,faces  THE AERODYNAMIC SURFACE ITSELF. It does NOT have to be a
 *                     convex hull, and for the tailed configuration it must not
 *                     be (80.5). The support skin convexifies EACH TRANSVERSE
 *                     SECTION, never the 3D body along its length, so a
 *                     longitudinally concave authored tail passes through
 *                     intact: 80.3 measured E3 clean, E2 0/0, E4 0.00% and
 *                     ELIGIBLE on the authored Smart Tail, and 80.4 showed the
 *                     HULLED version destroying the signal (zone 3 24.36 deg ->
 *                     3.74, F2a 1.973 -> 0.000).
 *
 *                     For an UPLOAD the canonical hull is still the geometry
 *                     identity, because production's upload rule makes it so —
 *                     that is a rule about uploads, NOT a requirement of this
 *                     module. An earlier version of this comment said the
 *                     ribbon layer "requires a convex hull"; it does not, and
 *                     the wording misled a later reader into re-proposing the
 *                     mismatch 77.2 recorded and 80.3 discharged.
 * @param axisLength   body length along the flight axis
 */
export function ribbonContext(verts, faces, { label = '', geometrySource = 'convex-hull(canonical)' } = {}) {
  const notes = [];
  const input = validateInput(verts, faces);

  const skin = makeSupportSkin(verts, faces, RUNG);
  const L = skin.L;
  const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));
  const rays = raysOf(CANON);

  /* ---- full positional field, all stations, all ribbons (70.4) ---- */
  const R = Array.from({ length: rays.length }, () => new Array(STATIONS).fill(0));
  let multi = 0, missed = 0, reflexStations = 0;
  let Rmax = 0;
  for (let i = 0; i < STATIONS; i++) {
    const got = supportRadii(skin, i, rays);
    for (let k = 0; k < rays.length; k++) { R[k][i] = got.r[k]; if (got.r[k] > Rmax) Rmax = got.r[k]; }
    if (i >= i0 && i <= i1) { multi += got.multi; missed += got.missed; }
  }
  for (let i = i0; i <= i1; i++) {
    if (reflexCount(supportPolygon(skin.H[i], skin.naz), Rmax || 1).count > 0) reflexStations++;
  }

  /* ---- zones: ALL EIGHT retained positionally ---- */
  const met = R.map((rib) => ribbonMetrics(rib, L, { tipFrac: TIP }));
  const perRibbonZones = met.map((q) => Array.from({ length: ZONES }, (_, z) => q.zones[z].abs * DEG));
  const zoneStat = (fn) => Array.from({ length: ZONES }, (_, z) => fn(perRibbonZones.map((r) => r[z])));

  /* ---- descriptors: EARNED ZONES 1-5 ONLY (55.2) ---- */
  const uc = EARNED.map((z) => (z + 0.5) / ZONES);
  const perRibbonDesc = perRibbonZones.map((all) => {
    const z = EARNED.map((zi) => all[zi]);
    const tot = z.reduce((s, v) => s + v, 0);
    const mean = tot / z.length;
    return {
      F1: tot > 0 ? (z[0] + z[1]) / tot : 0,
      F2a: z[3] + z[4],
      F2f: tot > 0 ? (z[3] + z[4]) / tot : 0,
      F3: mean > 0 ? Math.max(...z) / mean : 0,
      F4: tot > 0 ? z.reduce((s, v, k) => s + v * uc[k], 0) / tot : 0,
    };
  });
  const KEYS = ['F1', 'F2a', 'F2f', 'F3', 'F4'];
  const dstat = (fn) => Object.fromEntries(KEYS.map((k) => [k, fn(perRibbonDesc.map((d) => d[k]))]));

  /* ---- F5: opposite-ribbon disagreement, per PAIR (59.3) ---- */
  const F5pairs = [];
  for (let k = 0; k < CANON; k++) {
    F5pairs.push(Math.max(...EARNED.map((zi) => Math.abs(perRibbonZones[k][zi] - perRibbonZones[k + CANON][zi]))));
  }
  if (Math.max(...F5pairs) < 0.05) notes.push('F5 ~ 0: body is effectively axisymmetric; 59.3 says F5 is not claimable here');

  /* ---- 70.5 eligibility: E2/E3/E4 only; E1 void, E5 failed ---- */
  const conv = PLANES_CONV.map((p) => {
    const rr = raysOf(p);
    const RR = Array.from({ length: rr.length }, () => new Array(STATIONS).fill(0));
    for (let i = 0; i < STATIONS; i++) {
      const got = supportRadii(skin, i, rr);
      for (let k = 0; k < rr.length; k++) RR[k][i] = got.r[k];
    }
    const m2 = RR.map((rib) => ribbonMetrics(rib, L, { tipFrac: TIP }));
    return Array.from({ length: ZONES }, (_, z) => med(m2.map((q) => q.zones[z].abs * DEG)));
  });
  let shift = 0;
  for (let q = 0; q + 1 < conv.length; q++) for (let z = 0; z < ZONES; z++) {
    const a = conv[q][z], b = conv[q + 1][z], mx = Math.max(Math.abs(a), Math.abs(b));
    if (mx > 1e-9) shift = Math.max(shift, Math.abs(a - b) / mx);
  }
  const E2 = multi === 0 && missed === 0, E3 = input.ok, E4 = shift < 0.05;
  const failed = [!E2 && 'E2', !E3 && 'E3', !E4 && 'E4'].filter(Boolean);

  /* ---- the production scalar, COPIED, never modified ---- */
  const ms = measureSections(verts, faces, { axis: '+X' });
  const sc = scoreSections(ms);
  const { cls } = classifySections(ms, sc);

  return {
    schema: 'ribbon-context/1',
    authority: 'SHADOW — informational only; does not affect Cd',
    label,
    provenance: {
      geometrySource,
      skin: { kind: 'support-function', ...RUNG, stations: STATIONS, naz: skin.naz },
      domain: { tipFrac: TIP, zonesTotal: ZONES, earnedZones: [...EARNED] },
      specs: ['53 support skin', '55 earned domain', '59 descriptors', '70 schema'],
    },
    eligibility: {
      outcome: !E3 ? 'INPUT FAILURE' : failed.length ? 'INELIGIBLE' : 'ELIGIBLE',
      checks: { E2: { pass: E2, multi, missed }, E3: { pass: E3, problems: input.problems },
        E4: { pass: E4, worstShift: shift } },
      notes: ['E1 VOID under the support skin — no fit to fall back from (70.5)',
        'E5 FAILED as a criterion at 51.11 — not applied',
        'this is NOT a re-run of spec 51 gate'],
      convexity: { nonConvexStations: reflexStations, retained: i1 - i0 + 1 },
    },
    positional: { xs: skin.xs, rays, R },
    zones: {
      perRibbon: perRibbonZones,
      median: zoneStat(med), worst: zoneStat((v) => Math.max(...v)),
      spread: zoneStat((v) => Math.max(...v) - Math.min(...v)),
    },
    descriptors: {
      perRibbon: perRibbonDesc,
      median: dstat(med), worst: dstat((v) => Math.max(...v)),
      spread: dstat((v) => Math.max(...v) - Math.min(...v)),
      F5: { perPair: F5pairs, median: med(F5pairs), worst: Math.max(...F5pairs) },
    },
    scalar: { compositeV1: sc.compositeV1, softAft: sc.softAft, softFore: sc.softFore, cls },
    notes,
  };
}
