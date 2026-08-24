/**
 * M2 fixture suite — dynamicsCore (DYNAMIC-SPEC s14, build amendment r4).
 *
 * Tiers: validation / physics invariants / unit conversions / floors /
 * known cells (the authority's own numbers, independently reproduced by the
 * external reviewer: 13.52 MW, 60.85 t, 338 t) / classifier boundary
 * semantics / (L/300)^3 scaling / state passthrough / contract snapshot /
 * corpus integration (M1 -> M2 full chain, skipped if corpus absent).
 *
 * Plain node, zero deps: `node test/dynamics-core-fixtures.mjs`.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Engine-root override — baked-vs-source parity (DYNAMIC-SPEC §14, r5
 * Phase-B entry gate): the SAME fixtures must run against CalcV2 source
 * (default, ../src) AND the bake-calcv2.mjs artifact. Set
 * DYNAMICS_ENGINE_ROOT to an absolute path to a src/ directory (e.g.
 * site/calcv2/src) to retarget every engine import. */
const ENGINE_ROOT = process.env.DYNAMICS_ENGINE_ROOT
  ? pathToFileURL(process.env.DYNAMICS_ENGINE_ROOT.replace(/[\\/]*$/, '/'))
  : new URL('../src/', import.meta.url);
if (process.env.DYNAMICS_ENGINE_ROOT) console.log(`engine root: ${ENGINE_ROOT.href}`);

const {
  computeDynamics,
  aerodynamicStatus,
  sEvidenceZone,
  fuelMassStatus,
  ittcCf,
  skinFrictionCd,
  roughnessAllowanceCf,
  ROUGHNESS_KS_M,
  RHO_KG_M3,
  E_EFF_J_PER_KG,
  TANKAGE_FACTOR,
  PROPULSION_CHAIN_EFF,
} = await import(new URL('dynamicsCore.js', ENGINE_ROOT).href);
const { measureDynamicsGeometry } = await import(new URL('dynamicsGeometry.js', ENGINE_ROOT).href);
const { parseObjMesh } = await import(new URL('obj.js', ENGINE_ROOT).href);

let passed = 0, failed = 0, skipped = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
function skip(name, why) { skipped++; console.log(`skip  ${name} — ${why}`); }
function near(a, b, rel) { return Math.abs(a - b) <= rel * Math.abs(b); }
function throws(fn) { try { fn(); return false; } catch { return true; } }

/** Synthetic Sunship-shaped M1 record — the canonical measured values, so the
 *  core suite never depends on the corpus being present. */
const SUNSHIP = {
  flightAxis: 'Z', scale: 1, lengthM: 300, units: 'm',
  extents: [249, 237, 300],
  frontalArea: 40522, wettedArea: 206795, hullArea: 206503, meshArea: 206795,
  wettedOverFrontal: 206795 / 40522, wettedSource: 'mesh', warnings: [],
};
const VISION = { airspeedKmh: 100, cd: 0.04, s: 0.30, scenario: 'VISION' };

console.log('\n== validation: hard-fail only where the calculation is undefined ==');
{
  check('rejects mesh-units geometry',
    throws(() => computeDynamics({ ...SUNSHIP, units: 'mesh-units' }, VISION)));
  check('rejects s = 1', throws(() => computeDynamics(SUNSHIP, { ...VISION, s: 1 })));
  check('rejects s < 0', throws(() => computeDynamics(SUNSHIP, { ...VISION, s: -0.1 })));
  check('rejects cd = 0', throws(() => computeDynamics(SUNSHIP, { ...VISION, cd: 0 })));
  check('rejects zero airspeed', throws(() => computeDynamics(SUNSHIP, { ...VISION, airspeedKmh: 0 })));
  check('rejects missing frontal area',
    throws(() => computeDynamics({ ...SUNSHIP, frontalArea: 0 }, VISION)));
  check('accepts s = 0 (the no-credit control is a legal state)',
    !throws(() => computeDynamics(SUNSHIP, { ...VISION, s: 0 })));

  // Finite/type hardening (send-back #3): coercion must not leak through
  check('rejects Infinity airspeed',
    throws(() => computeDynamics(SUNSHIP, { ...VISION, airspeedKmh: Infinity })));
  check('rejects Infinity cd',
    throws(() => computeDynamics(SUNSHIP, { ...VISION, cd: Infinity })));
  check('rejects NaN cd', throws(() => computeDynamics(SUNSHIP, { ...VISION, cd: NaN })));
  check('rejects numeric-string s',
    throws(() => computeDynamics(SUNSHIP, { ...VISION, s: '0.3' })));
  check('rejects Infinity frontal area',
    throws(() => computeDynamics({ ...SUNSHIP, frontalArea: Infinity }, VISION)));
  check('rejects NaN lengthM',
    throws(() => computeDynamics({ ...SUNSHIP, lengthM: NaN }, VISION)));
  check('rejects bogus frontalAreaSource',
    throws(() => computeDynamics({ ...SUNSHIP, frontalAreaSource: 'guessed' }, VISION)));
}

console.log('\n== physics invariants (r4: classes of bugs, not single cells) ==');
{
  const base = computeDynamics(SUNSHIP, VISION);

  const cd2 = computeDynamics(SUNSHIP, { ...VISION, cd: 0.08 });
  check('drag linear in Cd', near(cd2.dragN, 2 * base.dragN, 1e-12));

  const a2 = computeDynamics({ ...SUNSHIP, frontalArea: 81044 }, VISION);
  check('drag linear in A', near(a2.dragN, 2 * base.dragN, 1e-12));

  const v2 = computeDynamics(SUNSHIP, { ...VISION, airspeedKmh: 200 });
  check('drag quadratic in speed', near(v2.dragN, 4 * base.dragN, 1e-12));
  check('no-credit power cubic in speed', near(v2.powerNoCreditMW, 8 * base.powerNoCreditMW, 1e-12));
  check('fuel per 1,000 km scales as v^2 (one v goes to the clock)',
    near(v2.fuelPer1000kmT, 4 * base.fuelPer1000kmT, 1e-9));

  check('powerNoCredit = dragN x v exactly',
    near(base.powerNoCreditMW * 1e6, base.dragN * (100 / 3.6), 1e-12));
  check('power / powerNoCredit = 1 - S exactly',
    near(base.powerMW / base.powerNoCreditMW, 0.70, 1e-12));

  const s0 = computeDynamics(SUNSHIP, { ...VISION, s: 0 });
  const cubic = 0.5 * RHO_KG_M3 * 0.04 * 40522 * Math.pow(100 / 3.6, 3);
  check('S = 0 reduces exactly to the ideal cubic', near(s0.powerMW * 1e6, cubic, 1e-12));
  check('S = 0 means zero benefit at every speed',
    near(s0.powerMW, s0.powerNoCreditMW, 1e-12));
}

console.log('\n== unit conversions (3.6 and 1000 are likelier bugs than calculus) ==');
{
  const r = computeDynamics(SUNSHIP, VISION);
  check('ref trip 9,000 km at 100 km/h = 3.75 days', near(r.refTripDays, 9000 / 100 / 24, 1e-12));
  // 2026-08-18: energy now derives from ELECTRICAL demand, not propulsive
  // power. This assertion is the guard that the two never get conflated
  // again — that conflation was the defect PROPULSION_CHAIN_EFF fixed.
  check('energy MWh consistent with ELECTRICAL power x time',
    near(r.energyPer1000kmMWh * 3.6e9, r.electricalMW * 1e6 * (1e6 / (100 / 3.6)), 1e-9));
  check('electrical = propulsive / chain efficiency, exactly',
    near(r.electricalMW * PROPULSION_CHAIN_EFF, r.powerMW, 1e-12));
  check('energy is NOT propulsive x time (the old, flattering identity)',
    !near(r.energyPer1000kmMWh * 3.6e9, r.powerMW * 1e6 * (1e6 / (100 / 3.6)), 1e-6));
  check('fuel t consistent with energy / e_eff',
    near(r.fuelPer1000kmT * 1000 * E_EFF_J_PER_KG, r.energyPer1000kmMWh * 3.6e9, 1e-9));
  check('fuel system = 5 x LH2 exactly',
    near(r.refTripFuelSystemT, TANKAGE_FACTOR * r.refTripFuelT, 1e-12));
  check('e_eff = 71,992,800 J/kg (19.998 kWh/kg)', near(E_EFF_J_PER_KG, 71992800, 1e-9));
}


/* ---------------- B1: the skin-roughness allowance (2026-08-19) ------
 * Toby's ruling: "a default across all input shapes skin finish which
 * isn't chosen to be like impossibly smooth... it's fine if it adds 3-4%
 * total Cd". These fixtures pin that the allowance EXISTS, that it is
 * BOUNDED, and that it never does anything nonsensical. */
console.log('\n== B1 skin-roughness allowance (ITTC-78, ks 0.43 mm) ==');
{
  check('ks default is 0.43 mm — the OWNER-RULED constant, not a slider',
    ROUGHNESS_KS_M === 0.00043);

  // It must actually DO something at vehicle scale, or the whole job is
  // a no-op that passes every test.
  // 116 km/h, not 120: the ideal posture was re-ruled 2026-08-19 and this
  // fixture must guard the posture the ship ACTUALLY flies, or the owner
  // budget is being checked at a speed nothing uses.
  const AERO_L = 516, reIdeal = (116 / 3.6) * AERO_L / 1.5e-5;
  check('allowance is LIVE at the Sunship ideal posture (120 km/h, L 516)',
    roughnessAllowanceCf(AERO_L, reIdeal) > 0,
    `dCf ${roughnessAllowanceCf(AERO_L, reIdeal).toExponential(3)}`);

  // THE BUDGET. This is the fixture that holds Toby's ruling: the
  // allowance costs 3-4% of the deployed Sunship's total Cd. If a future
  // change to ks, to the geometry or to the correlation pushes this out
  // of band, that is a RULING breach and must go back to Toby.
  {
    const W = 266094, A = 40426.66, PRESSURE = 0.0121498;
    const smooth = ittcCf(reIdeal) * (W / A);
    const rough = skinFrictionCd(reIdeal, AERO_L, W, A);
    const pct = 100 * (rough - smooth) / (smooth + PRESSURE);
    check('OWNER BUDGET: allowance costs 3-4% of deployed Sunship total Cd',
      pct >= 3 && pct <= 4, `${pct.toFixed(2)}% at the ruled 116 km/h posture`);
  }

  // Clamped at zero — the ITTC-78 form goes negative at large L / high Re
  // and a roughness allowance may NEVER reduce drag.
  check('allowance clamps at ZERO, never negative (smooth-skin limit)',
    roughnessAllowanceCf(516, 1e12) >= 0 && roughnessAllowanceCf(1e6, 1e6) === 0);
  check('a slow small body is hydraulically smooth — allowance exactly 0',
    roughnessAllowanceCf(10, (20 / 3.6) * 10 / 1.5e-5) === 0);

  // Scaling: rougher-relative bodies (shorter L) get a bigger allowance
  // at the same Re; and the allowance grows with Re at fixed L.
  // Re chosen so ALL THREE lengths are past their switch-on and the
  // comparison is between live values — at 5e8 both 516 m and 2000 m
  // clamp to zero and the check passes/fails for the wrong reason.
  const RE = 3e9;
  check('allowance grows as L shrinks (relative roughness is ks/L)',
    roughnessAllowanceCf(100, RE) > roughnessAllowanceCf(516, RE)
    && roughnessAllowanceCf(516, RE) > roughnessAllowanceCf(2000, RE));
  check('allowance grows with Re at fixed L',
    roughnessAllowanceCf(516, 1e9) > roughnessAllowanceCf(516, 6e8));

  // The plateau (see cfTotal): total friction may STOP falling with speed,
  // but must never RISE — a fully-rough Cf is Re-independent, not
  // Re-increasing. Swept across the whole plausible input domain.
  {
    let rises = [];
    for (const L of [4, 10, 20, 50, 100, 200, 300, 516, 800, 1500, 5000]) {
      let prev = Infinity;
      for (let kmh = 1; kmh <= 400; kmh += 0.5) {
        const f = skinFrictionCd((kmh / 3.6) * L / 1.5e-5, L, 4, 1);
        if (f > prev + 1e-12) { rises.push(`L=${L}@${kmh}km/h`); break; }
        prev = f;
      }
    }
    check('friction Cd is NON-INCREASING with speed for every L in the domain',
      rises.length === 0, rises.join(', '));
  }

  // And the plateau must not have quietly changed the ship.
  check('the plateau does NOT touch the Sunship (its allowance switches on past Re*)',
    Math.abs(skinFrictionCd(reIdeal, 516, 266094, 40426.66)
      - (ittcCf(reIdeal) + roughnessAllowanceCf(516, reIdeal)) * (266094 / 40426.66)) < 1e-15);
}

console.log('\n== ITTC friction + floors (spec s3.4, s5.1) ==');
{
  const r = computeDynamics(SUNSHIP, VISION);
  check('ittcCf(5.56e8) ~ 0.001649', near(ittcCf(5.55556e8), 0.0016487, 1e-3));
  // RE-PINNED 2026-08-19 (B1): 0.008414 -> 0.008852. The smooth ITTC line
  // is unchanged; the skin-roughness allowance (ks 0.43 mm) is new and is
  // the whole of the difference. This fixture now pins smooth + allowance.
  check('Sunship friction Cd ~ 0.00885 (M1-measured ratio 5.10, incl. roughness allowance)',
    near(r.frictionCd, 0.008852, 2e-3), `got ${r.frictionCd.toFixed(6)}`);
  check('product floor = friction x 0.65', near(r.productFloor, r.frictionCd * 0.65, 1e-12));
  check('VISION product 0.028 clears the floor', r.floorStatus === 'OK');

  const under = computeDynamics(SUNSHIP, { ...VISION, cd: 0.008, s: 0.40 });
  check('product below floor -> floorStatus RED', under.floorStatus === 'RED');
  check('floor breach warns, not hides',
    under.warnings.some((w) => w.startsWith('below-screening-floor')));
  check('cd below friction estimate warns',
    under.warnings.some((w) => w.startsWith('cd-below-friction-estimate')));

  // Send-back #1: Cd below the friction floor with S = 0 — the product still
  // clears the power floor (0.008 > 0.00547), but the CLAIM is below the
  // drag floor, and the RED state is the only home for below-floor states.
  const cdOnly = computeDynamics(SUNSHIP, { ...VISION, cd: 0.008, s: 0 });
  check('cd-below-friction alone (S=0) -> floorStatus RED', cdOnly.floorStatus === 'RED',
    `got ${cdOnly.floorStatus}`);
  check('cd-only breach warns cd-below-friction, not product',
    cdOnly.warnings.some((w) => w.startsWith('cd-below-friction-estimate'))
    && !cdOnly.warnings.some((w) => w.startsWith('below-screening-floor')));
}

console.log('\n== frontalAreaSource passthrough (send-back #2) ==');
{
  const computed = computeDynamics(SUNSHIP, VISION);
  check('default geometry -> computed', computed.frontalAreaSource === 'computed');
  const authored = computeDynamics({ ...SUNSHIP, frontalAreaSource: 'authored' }, VISION);
  check('authored preset geometry -> authored', authored.frontalAreaSource === 'authored');
}

console.log('\n== known cells (authority numbers; reviewer independently got 13.52 MW / 60.85 t / 338 t) ==');
{
  const v = computeDynamics(SUNSHIP, VISION);
  check('VISION no-credit power ~ 19.32 MW', near(v.powerNoCreditMW, 19.316, 1e-3),
    `got ${v.powerNoCreditMW.toFixed(3)}`);
  check('VISION power ~ 13.52 MW', near(v.powerMW, 13.521, 1e-3), `got ${v.powerMW.toFixed(3)}`);
  // 2026-08-18 RE-PINNED for the propulsion-chain split. Propulsive power
  // (13.52 MW) is UNCHANGED — the fix does not touch aerodynamics. What
  // moved is everything downstream of the busbar: electrical demand is now
  // 13.521 / 0.78, and fuel follows it. Values re-derived from the engine,
  // not scaled by hand.
  check('VISION electrical demand ~ 17.34 MW (propulsive / 0.78)',
    near(v.electricalMW, 17.335, 2e-3), `got ${v.electricalMW.toFixed(3)}`);
  check('VISION ref-trip LH2 ~ 78.0 t', near(v.refTripFuelT, 78.015, 2e-3),
    `got ${v.refTripFuelT.toFixed(2)}`);
  check('VISION fuel system ~ 390 t', near(v.refTripFuelSystemT, 390.07, 2e-3),
    `got ${v.refTripFuelSystemT.toFixed(1)}`);
  check('VISION loads GREEN on fuel (under the 350 t design target)', v.fuelMassStatus === 'GREEN');
  check('VISION aero GREEN (0.04 <= 0.12)', v.aerodynamicStatus === 'GREEN');
  check('VISION S zone = bound (0.30 <= 0.35)', v.sEvidenceZone === 'bound');
  check('VISION payload ~ 4,710 t', near(v.payloadT, 4710, 1e-2), `got ${v.payloadT.toFixed(0)}`);

  const ref = computeDynamics(SUNSHIP, { airspeedKmh: 100, cd: 0.10, s: 0.10, scenario: 'REFERENCE' });
  check('REFERENCE ref-trip LH2 ~ 250.8 t', near(ref.refTripFuelT, 250.76, 2e-3),
    `got ${ref.refTripFuelT.toFixed(1)}`);
  // BEHAVIOURAL CHANGE ON RECORD (2026-08-18): the REFERENCE cell crossed
  // the 1,000 t fuel-system threshold and now reads RED, where it read
  // ORANGE before the propulsion-chain split. The thresholds did NOT move —
  // the honest fuel figure did. This is the screen doing its job: a Cd 0.10
  // / S 0.10 ship with a real powertrain genuinely does not close.
  check('REFERENCE fuel system ~ 1,254 t -> RED (crossed 1,000 t when the chain became honest; thresholds unchanged)',
    ref.fuelMassStatus === 'RED' && near(ref.refTripFuelSystemT, 1253.8, 2e-3),
    `got ${ref.refTripFuelSystemT.toFixed(0)} t, ${ref.fuelMassStatus}`);
  check('REFERENCE aero GREEN (0.10 <= 0.12)', ref.aerodynamicStatus === 'GREEN');
  check('REFERENCE S zone = published (0.10 <= 0.15)', ref.sEvidenceZone === 'published');
}

console.log('\n== aero length vs LIFT length (2026-08-18: the deployable-tail contract) ==');
{
  // The exact scenario that produced the 5x error in build: a body whose
  // aerodynamic extent is 1.72x its buoyant extent (the Sunship with its
  // Smart Tail deployed — 300 m envelope, 516 m in the flow).
  const AERO_L = 516, ENV_L = 300, ENV_V = 8085778;
  const tailed = {
    ...SUNSHIP, lengthM: AERO_L, wettedArea: 253919, volume: 10218828,
    liftLengthM: ENV_L, liftVolumeM3: ENV_V,
  };
  const bare = { ...SUNSHIP, volume: ENV_V };
  const t = computeDynamics(tailed, VISION);
  const b = computeDynamics(bare, VISION);

  check('absent lift overrides: aeroLengthM equals shipLengthM (every legacy record)',
    b.aeroLengthM === b.shipLengthM && b.shipLengthM === 300);
  check('declared: aeroLengthM is the FLOW body, shipLengthM the BUOYANT one',
    t.aeroLengthM === AERO_L && t.shipLengthM === ENV_L);

  // THE REGRESSION GUARD. fuelMassStatus scales gross lift, structure and
  // both bands by (length/300)^3. Feeding it the aero length inflates k3
  // by (516/300)^3 = 5.09 — 5,600 t of lift would read 28,495 t.
  check('payload uses the ENVELOPE, not the fairing (the 5x bug)',
    near(t.payloadT + t.refTripFuelSystemT, b.payloadT + b.refTripFuelSystemT, 1e-9),
    `tailed net lift ${(t.payloadT + t.refTripFuelSystemT).toFixed(0)} vs bare ${(b.payloadT + b.refTripFuelSystemT).toFixed(0)}`);
  const wrong = computeDynamics({ ...tailed, liftLengthM: undefined }, VISION);
  check('and the guard is real: without it the same body claims ~5x the lift',
    (wrong.payloadT + wrong.refTripFuelSystemT) / (t.payloadT + t.refTripFuelSystemT) > 5,
    `ratio ${((wrong.payloadT + wrong.refTripFuelSystemT) / (t.payloadT + t.refTripFuelSystemT)).toFixed(2)}x`);

  // Cd_v on ENVELOPE volume (owner ruling 2026-08-18): a fairing full of
  // ambient air must never improve drag-per-carried-volume.
  check('Cd_v is priced on LIFTING volume, not the enclosing body',
    near(t.cdVolumetric, (t.selectedCd * t.frontalAreaM2) / Math.pow(ENV_V, 2 / 3), 1e-12));
  check('volumeM3 reports the buoyant volume', t.volumeM3 === ENV_V);
  const flattered = computeDynamics({ ...tailed, liftVolumeM3: undefined }, VISION);
  check('and that guard is real too: body volume would flatter Cd_v ~17%',
    flattered.cdVolumetric < t.cdVolumetric
    && near(t.cdVolumetric / flattered.cdVolumetric, 1.17, 0.02),
    `${(t.cdVolumetric / flattered.cdVolumetric).toFixed(3)}x`);

  // Friction still belongs to the FLOW body — the longer body sits at a
  // higher Reynolds number, so its Cf is lower.
  check('friction uses the AERO length (higher Re on the longer body)',
    near(t.frictionCd, skinFrictionCd((100 / 3.6) * AERO_L / 1.5e-5, AERO_L, 253919, t.frontalAreaM2), 1e-9));

  check('liftLengthM must be finite > 0 when present',
    (() => { try { computeDynamics({ ...tailed, liftLengthM: 0 }, VISION); return false; } catch { return true; } })());
  check('liftVolumeM3 must be finite > 0 when present',
    (() => { try { computeDynamics({ ...tailed, liftVolumeM3: -1 }, VISION); return false; } catch { return true; } })());
}

console.log('\n== classifier boundaries (equality semantics frozen, r4) ==');
{
  check('aero: 0.12 is GREEN (inclusive top)', aerodynamicStatus(0.12) === 'GREEN');
  check('aero: 0.1201 is ORANGE', aerodynamicStatus(0.1201) === 'ORANGE');
  check('aero: 0.22 is ORANGE (inclusive top)', aerodynamicStatus(0.22) === 'ORANGE');
  check('aero: 0.2201 is RED', aerodynamicStatus(0.2201) === 'RED');
  check('zone: 0.15 is published (inclusive top)', sEvidenceZone(0.15) === 'published');
  check('zone: 0.1501 is bound', sEvidenceZone(0.1501) === 'bound');
  check('zone: 0.35 is bound (inclusive top)', sEvidenceZone(0.35) === 'bound');
  check('zone: 0.3501 is experimental', sEvidenceZone(0.3501) === 'experimental');
  check('fuel: exactly 500 t at 300 m is GREEN (inclusive top; relaxed from 350, 2026-08-13)',
    fuelMassStatus(500, 300).status === 'GREEN');
  check('fuel: 500.01 t is ORANGE', fuelMassStatus(500.01, 300).status === 'ORANGE');
  check('fuel: exactly 1,000 t is ORANGE (inclusive top)',
    fuelMassStatus(1000, 300).status === 'ORANGE');
  check('fuel: 1,000.01 t is RED', fuelMassStatus(1000.01, 300).status === 'RED');
  check('fuel: payload exactly 0 is RED', fuelMassStatus(5100, 300).status === 'RED');
  check('fuel: payload value reported', near(fuelMassStatus(5100, 300).payloadT, 0, 1e-9)
    || fuelMassStatus(5100, 300).payloadT === 0);
}

console.log('\n== (L/300)^3 scaling vs gentle-Re friction (two different systems, r4) ==');
{
  const half = fuelMassStatus(100, 150);
  check('bands scale by k^3: green max at 150 m = 62.5 t', near(half.greenMaxT, 62.5, 1e-12));
  check('bands scale by k^3: orange max at 150 m = 125 t', near(half.orangeMaxT, 125, 1e-12));

  const r300 = computeDynamics(SUNSHIP, VISION);
  const r150 = computeDynamics({ ...SUNSHIP, lengthM: 150, extents: [124.5, 118.5, 150],
    frontalArea: 40522 / 4, wettedArea: 206795 / 4, hullArea: 206503 / 4, meshArea: 206795 / 4 }, VISION);
  const ratio = r150.frictionCd / r300.frictionCd;
  check('friction floor moves gently with Re (Cf up < 15% at half scale)',
    ratio > 1 && ratio < 1.15, `got x${ratio.toFixed(3)}`);
}

console.log('\n== state passthrough + provenance (spec s10) ==');
{
  const warned = computeDynamics({ ...SUNSHIP, warnings: ['no-faces: wetted area falls back to hull surface area'] },
    { ...VISION, cdSource: 'estimated', sSource: 'authored', configurationId: 'sunship/smartTailBLI' });
  check('geometry warnings propagate into the contract',
    warned.warnings.some((w) => w.startsWith('no-faces')));
  check('cdSource passthrough', warned.cdSource === 'estimated');
  check('sSource passthrough', warned.sSource === 'authored');
  check('configurationId passthrough', warned.configurationId === 'sunship/smartTailBLI');
  check('scenario travels (screenshot self-identifies)', warned.scenario === 'VISION');
  check('provenance summary names both drivers',
    warned.provenance.summary.includes('Cd [') && warned.provenance.summary.includes('S ['));
  check('headline is never CALCULATED alone',
    warned.provenance.summary.startsWith('CALCULATED from'));
  check('orientation echoed (drives A drives everything)', warned.orientationAxis === 'Z');
}

console.log('\n== contract snapshot (r4: field drift fails loudly before the browser does) ==');
{
  // Code-unit sort order (plain .sort()) — deterministic across locales.
  // M6 amendment 2026-08-16: + estimate, wettedAreaM2, wettedSource.
  // Comparison-metrics amendment 2026-08-16 (owner request): +
  // dragAreaM2, cdVolumetric, volumeM3, volumeSource.
  const FROZEN_KEYS = [
    'aeroLengthM',
    'aerodynamicStatus', 'airspeedKmh', 'cdBasis', 'cdSource', 'cdVolumetric',
    'configurationId', 'dragAreaM2',
    'dragN', 'electricalMW', 'energyPer1000kmMWh', 'estimate', 'floorStatus', 'frictionCd',
    'frontalAreaM2', 'frontalAreaSource', 'fuelMassStatus', 'fuelPer1000kmT',
    'orientationAxis', 'payloadT', 'powerMW', 'powerNoCreditMW', 'productFloor',
    'propulsionChainEff',
    'provenance', 'refTripDays', 'refTripFuelSystemT', 'refTripFuelT',
    'sEvidenceZone', 'sSource', 'scenario', 'selectedCd', 'selectedS',
    'shipLengthM', 'volumeM3', 'volumeSource', 'warnings', 'wettedAreaM2', 'wettedSource',
  ];
  const keys = Object.keys(computeDynamics(SUNSHIP, VISION)).sort();
  check(`contract has exactly ${FROZEN_KEYS.length} frozen fields`,
    JSON.stringify(keys) === JSON.stringify(FROZEN_KEYS),
    `diff: ${keys.filter((k) => !FROZEN_KEYS.includes(k)).join(',') || '-'} / missing: ${FROZEN_KEYS.filter((k) => !keys.includes(k)).join(',') || '-'}`);
}

console.log('\n== M6 contract amendment: wetted-via-contract (r7 #5) + estimate echo ==');
{
  const r = computeDynamics(SUNSHIP, VISION);
  check('wettedAreaM2 published in the contract, equal to the geometry record',
    r.wettedAreaM2 === SUNSHIP.wettedArea, `got ${r.wettedAreaM2}`);
  check('wettedSource travels with the number', r.wettedSource === 'mesh');
  const fb = computeDynamics({ ...SUNSHIP, wettedSource: 'hull-fallback' }, VISION);
  check('hull-fallback wettedSource passes through', fb.wettedSource === 'hull-fallback');
  check('invalid wettedSource rejected at the trust boundary',
    throws(() => computeDynamics({ ...SUNSHIP, wettedSource: 'guess' }, VISION)));

  check('estimate defaults to null (dormant/not run — pre-M6 behaviour intact)', r.estimate === null);
  // A well-formed frozen-API echo WITHOUT input identity (a "foreign"
  // estimate) — friction matching this geometry+speed:
  const est = {
    cdEstimate: r.frictionCd + 0.43, frictionCd: r.frictionCd, pressureCd: 0.43,
    band: [(r.frictionCd + 0.43) * 0.8, (r.frictionCd + 0.43) * 1.2],
    status: 'ok', provenance: { label: 'ESTIMATED' },
  };
  const withEst = computeDynamics(SUNSHIP, { ...VISION, estimate: est });
  check('well-formed estimate echoes through untouched', withEst.estimate === est);
  check('matching foreign estimate raises no warning (friction screen passes)',
    !withEst.warnings.some((w) => w.startsWith('estimate-')));
  const stale = computeDynamics(SUNSHIP, { ...VISION, estimate: { ...est, frictionCd: r.frictionCd * 2, cdEstimate: r.frictionCd * 2 + 0.43, band: [(r.frictionCd * 2 + 0.43) * 0.8, (r.frictionCd * 2 + 0.43) * 1.2] } });
  check('foreign estimate with wrong friction is FLAGGED (consistency screen)',
    stale.warnings.some((w) => w.startsWith('estimate-friction-mismatch')));
  const unavailable = computeDynamics(SUNSHIP, {
    ...VISION,
    estimate: { cdEstimate: null, frictionCd: r.frictionCd, pressureCd: null, band: null, status: 'unavailable', provenance: { label: 'ESTIMATED' } },
  });
  check('unavailable estimate echoes with nulls (s5.5 fallback state)',
    unavailable.estimate.status === 'unavailable' && unavailable.estimate.cdEstimate === null);
  check('malformed estimate rejected (missing frozen keys)',
    throws(() => computeDynamics(SUNSHIP, { ...VISION, estimate: { cdEstimate: 0.4 } })));
  check('bad estimate status rejected',
    throws(() => computeDynamics(SUNSHIP, { ...VISION, estimate: { ...est, status: 'maybe' } })));
}

console.log('\n== r12 #1a: SEMANTIC estimate validation (contents, not just envelope) ==');
{
  const r = computeDynamics(SUNSHIP, VISION);
  const good = {
    cdEstimate: r.frictionCd + 0.43, frictionCd: r.frictionCd, pressureCd: 0.43,
    band: [(r.frictionCd + 0.43) * 0.8, (r.frictionCd + 0.43) * 1.2],
    status: 'ok', provenance: { label: 'ESTIMATED' },
  };
  const rejects = (name, estimate) =>
    check(name, throws(() => computeDynamics(SUNSHIP, { ...VISION, estimate })));
  // The reviewer's exact repro: six keys, status ok, band null — the
  // object that previously passed and crashed the renderer.
  rejects("r12 repro: status 'ok' with band:null is REJECTED", { ...good, band: null });
  rejects('non-finite cdEstimate rejected', { ...good, cdEstimate: NaN });
  rejects('non-finite pressureCd rejected', { ...good, pressureCd: Infinity });
  rejects('one-element band rejected', { ...good, band: [0.3] });
  rejects('non-finite band edge rejected', { ...good, band: [0.3, NaN] });
  rejects('band that does not bracket the estimate rejected',
    { ...good, band: [good.cdEstimate * 1.1, good.cdEstimate * 1.3] });
  rejects('sum inconsistency rejected (cdEstimate != friction + pressure)',
    { ...good, pressureCd: 0.10 });
  rejects('provenance null rejected', { ...good, provenance: null });
  rejects('provenance ARRAY rejected (typeof [] === "object" must not pass — r12 re-review)',
    { ...good, provenance: [] });
  // r12 re-review residual: finite is not physical. The reviewer's exact
  // all-negative object (previously passed the semantic validator, then
  // broke the page through the earlier cd-rejection path):
  rejects('r12 re-review repro: negative estimate family REJECTED with a clear message',
    { cdEstimate: -1, frictionCd: -0.2, pressureCd: -0.8, band: [-1.2, -0.8], status: 'ok', provenance: {} });
  rejects('zero cdEstimate rejected (must be > 0)',
    { ...good, cdEstimate: 0, frictionCd: 0, pressureCd: 0, band: [0, 0] });
  rejects('negative pressureCd rejected (must be >= 0)',
    { ...good, pressureCd: -0.01, cdEstimate: good.frictionCd - 0.01, band: [good.frictionCd - 0.011, good.frictionCd] });
  rejects("unavailable with a non-null band rejected",
    { cdEstimate: null, frictionCd: r.frictionCd, pressureCd: null, band: [0.1, 0.2], status: 'unavailable', provenance: {} });
  rejects('unavailable with non-finite friction rejected (the dial bottom must survive)',
    { cdEstimate: null, frictionCd: NaN, pressureCd: null, band: null, status: 'unavailable', provenance: {} });
}

console.log('\n== r12 #1b: input IDENTITY guard (friction alone is not identity) ==');
{
  const r = computeDynamics(SUNSHIP, VISION);
  const mkEst = (inputs) => ({
    cdEstimate: r.frictionCd + 0.43, frictionCd: r.frictionCd, pressureCd: 0.43,
    band: [(r.frictionCd + 0.43) * 0.8, (r.frictionCd + 0.43) * 1.2],
    status: 'ok', provenance: { label: 'ESTIMATED', inputs },
  });
  const rightInputs = { frontalAreaM2: SUNSHIP.frontalArea, wettedAreaM2: SUNSHIP.wettedArea, lengthM: SUNSHIP.lengthM, airspeedKmh: VISION.airspeedKmh };
  const okEcho = computeDynamics(SUNSHIP, { ...VISION, estimate: mkEst(rightInputs) });
  check('estimate with MATCHING input identity: no warning',
    !okEcho.warnings.some((w) => w.startsWith('estimate-')));
  // The reviewer's attack: a DIFFERENT geometry with the same length and
  // the same wetted/frontal ratio — friction is identical, so the old
  // friction screen passed it silently. Identity now catches it.
  const otherGeom = { frontalAreaM2: SUNSHIP.frontalArea * 2, wettedAreaM2: SUNSHIP.wettedArea * 2, lengthM: SUNSHIP.lengthM, airspeedKmh: VISION.airspeedKmh };
  const caught = computeDynamics(SUNSHIP, { ...VISION, estimate: mkEst(otherGeom) });
  check('r12 attack: same-ratio same-length geometry is CAUGHT by identity',
    caught.warnings.some((w) => w.startsWith('estimate-identity-mismatch')));
  const wrongSpeed = computeDynamics(SUNSHIP, { ...VISION, estimate: mkEst({ ...rightInputs, airspeedKmh: 90 }) });
  check('estimate computed at another speed is CAUGHT by identity',
    wrongSpeed.warnings.some((w) => w.startsWith('estimate-identity-mismatch')));
}

console.log('\n== corpus integration: full M1 -> M2 chain ==');
{
  const here = dirname(fileURLToPath(import.meta.url));
  const corpus = join(here, '..', '..', '..', '3D OBJ');
  if (!existsSync(corpus)) {
    skip('corpus chain', `${corpus} not found`);
  } else {
    const { verts, faces } = parseObjMesh(readFileSync(join(corpus, 'Sunship.obj'), 'utf8'));
    const geo = measureDynamicsGeometry(verts, faces, { flightAxis: 'Z', lengthM: 300 });
    const r = computeDynamics(geo, VISION);
    check('real-mesh VISION power ~ 13.52 MW', near(r.powerMW, 13.521, 3e-3),
      `got ${r.powerMW.toFixed(3)}`);
    check('real-mesh VISION fuel system ~ 390 t GREEN',
      near(r.refTripFuelSystemT, 390.07, 3e-3) && r.fuelMassStatus === 'GREEN',
      `got ${r.refTripFuelSystemT.toFixed(1)} t, ${r.fuelMassStatus}`);
    check('real-mesh friction Cd ~ 0.00885 (incl. roughness allowance)', near(r.frictionCd, 0.008852, 3e-3),
      `got ${r.frictionCd.toFixed(6)}`);
    check('real-mesh chain carries no warnings', r.warnings.length === 0, r.warnings.join('; '));
  }
}

console.log('\n== comparison-metrics amendment 2026-08-16: dragAreaM2 + cdVolumetric ==');
{
  const r = computeDynamics(SUNSHIP, VISION);
  check('dragAreaM2 = selectedCd × frontalAreaM2, exactly',
    r.dragAreaM2 === r.selectedCd * r.frontalAreaM2, `got ${r.dragAreaM2}`);
  if (r.volumeM3 !== null) {
    check('cdVolumetric = dragAreaM2 / volume^(2/3), exactly',
      r.cdVolumetric === r.dragAreaM2 / Math.pow(r.volumeM3, 2 / 3), `got ${r.cdVolumetric}`);
    check('volumeSource is THE ruled value (owner 2026-08-16: convex-envelope, always)',
      r.volumeSource === 'convex-envelope', r.volumeSource);
  } else {
    check('null volume → cdVolumetric null, source unavailable',
      r.cdVolumetric === null && r.volumeSource === 'unavailable');
  }
  // Pre-amendment geometry records (no volume field) stay legal: null out.
  const legacy = { ...SUNSHIP };
  delete legacy.volume; delete legacy.volumeSource;
  const rl = computeDynamics(legacy, VISION);
  check('legacy record without volume: volumeM3 null, cdVolumetric null, no throw',
    rl.volumeM3 === null && rl.cdVolumetric === null && rl.volumeSource === 'unavailable');
  let threw = false;
  try { computeDynamics({ ...SUNSHIP, volume: -5 }, VISION); } catch { threw = true; }
  check('negative volume rejected at the trust boundary', threw);
  threw = false;
  try { computeDynamics({ ...SUNSHIP, volume: 100, volumeSource: 'authored-guess' }, VISION); } catch { threw = true; }
  check('unruled volumeSource rejected', threw);
  threw = false;
  try { computeDynamics({ ...SUNSHIP, volume: 100, volumeSource: 'mesh' }, VISION); } catch { threw = true; }
  check("retired 'mesh' volumeSource rejected (one meaning only — owner ruling)", threw);
  // Analytic check on a unit cube: convex-envelope volume exactly 1.
  const cubeVerts = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) cubeVerts.push([x, y, z]);
  const cubeFaces = [
    [0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1],
    [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3],
  ];
  const cubeGeo = measureDynamicsGeometry(cubeVerts, cubeFaces, { flightAxis: 'Z', lengthM: 1 });
  check('unit cube: convex-envelope volume exactly 1 m³',
    Math.abs(cubeGeo.volume - 1) < 1e-9 && cubeGeo.volumeSource === 'convex-envelope', `got ${cubeGeo.volume}`);
  const cube300 = measureDynamicsGeometry(cubeVerts, cubeFaces, { flightAxis: 'Z', lengthM: 300 });
  check('volume scales as s³ (unit cube at 300 m = 2.7e7 m³)',
    Math.abs(cube300.volume - 300 ** 3) < 1e-2, `got ${cube300.volume}`);
  // THE r17 WINDING ATTACK, permanent fixture (reviewer-built,
  // builder-verified: one flipped triangle left area screens green
  // while the SIGNED mesh sum read 0.667 as 'mesh'). Under the
  // convex-envelope ruling the attack is retired by construction.
  const flipped = cubeFaces.map((f, i) => (i === 10 ? [f[0], f[2], f[1]] : f));
  const attacked = measureDynamicsGeometry(cubeVerts, flipped, { flightAxis: 'Z', lengthM: 1 });
  check('r17 winding attack RETIRED: flipped-winding cube still reads volume 1 (convex envelope)',
    Math.abs(attacked.volume - 1) < 1e-9 && attacked.volumeSource === 'convex-envelope',
    `got ${attacked.volume} (${attacked.volumeSource})`);
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exitCode = failed ? 1 : 0;
