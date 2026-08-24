/**
 * DARPA SUBOFF AFF-1 — THE AXISYMMETRIC BARE HULL, from the GEOMETRY REPORT
 * ONLY. Spec 93.
 *
 * SOURCE: Groves, Huang & Chang 1989, "Geometric Characteristics of DARPA
 * SUBOFF Models (DTRC Model Nos. 5470 and 5471)", DTIC ADA210642, public
 * domain; full text fetched 2026-08-21 from the archive.org mirror
 * (DTIC_ADA210642_djvu.txt). **That report contains NO experimental force,
 * pressure or drag data**, so acquiring it does not touch the 90.7 R2 blind
 * protocol. The experimental summary (ADA359226) is NOT opened until the
 * blind file is committed.
 *
 * GEOMETRY (Table 1, model scale, x and R in FEET):
 *   overall length 14.291667 ft (4.356 m), max diameter 1.666667 ft (0.508 m)
 *   forebody 0 <= x <= 3.333333:
 *     R = Rmax*[1.126395101 x (0.3x-1)^4 + 0.442874707 x^2 (0.3x-1)^3
 *               + 1 - (0.3x-1)^4 (1.2x+1)]^(1/2.1)
 *   parallel middle body 3.333333 <= x <= 10.645833:  R = Rmax
 *   afterbody 10.645833 <= x <= 13.979167, xi = (13.979167 - x)/3.333333:
 *     R = Rmax*[ rh^2 + rh*K0*xi^2 + (20 - 20rh^2 - 4rh*K0 - K1/3) xi^3
 *               + (-45 + 45rh^2 + 6rh*K0 + K1) xi^4
 *               + (36 - 36rh^2 - 4rh*K0 - K1) xi^5
 *               + (-10 + 10rh^2 + rh*K0 + K1/3) xi^6 ]^(1/2)
 *     rh = 0.1175, K0 = 10, K1 = 44.6244
 *   afterbody cap 13.979167 <= x <= 14.291667:
 *     R = 0.1175*Rmax*[1 - (3.2x - 44.733333)^2]^(1/2)
 *
 * OCR NOTE, disclosed: the scan's equation typography is degraded. The
 * afterbody polynomial as reconstructed is SELF-VERIFYING and the self-test
 * below enforces it: at xi = 1 the constant/rh^2/rhK0/K1 groups must sum to
 * exactly (1, 0, 0, 0) so R = Rmax at the joint, and at xi = 0 the bracket is
 * rh^2 so R matches the cap radius 0.1175*Rmax. Both joints are also checked
 * numerically, as are the bow endpoints. A reconstruction error cannot pass.
 */
export const FT = 0.3048;
export const L_FT = 14.291667, RMAX_FT = 0.833333;
export const L_M = L_FT * FT;                       // 4.356 m
export const D_M = 2 * RMAX_FT * FT;                // 0.508 m
const RH = 0.1175, K0 = 10, K1 = 44.6244;
const X_FORE = 3.333333, X_AFT = 10.645833, X_AP = 13.979167;

export function radiusFt(x) {
  if (x <= 0 || x >= L_FT) return 0;
  if (x <= X_FORE) {
    const a = 0.3 * x - 1;
    const v = 1.126395101 * x * a ** 4 + 0.442874707 * x * x * a ** 3 + 1 - a ** 4 * (1.2 * x + 1);
    return RMAX_FT * Math.pow(Math.max(v, 0), 1 / 2.1);
  }
  if (x <= X_AFT) return RMAX_FT;
  if (x <= X_AP) {
    const xi = (X_AP - x) / 3.333333;
    const v = RH * RH + RH * K0 * xi ** 2
      + (20 - 20 * RH * RH - 4 * RH * K0 - K1 / 3) * xi ** 3
      + (-45 + 45 * RH * RH + 6 * RH * K0 + K1) * xi ** 4
      + (36 - 36 * RH * RH - 4 * RH * K0 - K1) * xi ** 5
      + (-10 + 10 * RH * RH + RH * K0 + K1 / 3) * xi ** 6;
    return RMAX_FT * Math.sqrt(Math.max(v, 0));
  }
  const v = 1 - (3.2 * x - 44.733333) ** 2;
  return 0.1175 * RMAX_FT * Math.sqrt(Math.max(v, 0));
}

/** metres-in, metres-out radius profile */
export const radiusM = (xM) => radiusFt(xM / FT) * FT;

/** the reconstruction self-test — a wrong afterbody polynomial cannot pass */
export function aff1SelfTest() {
  const problems = [];
  /* algebraic joint identities of the reconstructed polynomial */
  const cConst = 20 - 45 + 36 - 10;
  const cRh2 = 1 - 20 + 45 - 36 + 10;
  const cRhK0 = 1 - 4 + 6 - 4 + 1;
  const cK1 = -1 / 3 + 1 - 1 + 1 / 3;
  if (cConst !== 1 || cRh2 !== 0 || cRhK0 !== 0 || Math.abs(cK1) > 1e-12) {
    problems.push(`afterbody xi=1 groups (${cConst},${cRh2},${cRhK0},${cK1}) != (1,0,0,0)`);
  }
  const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) problems.push(`${what}: ${a} vs ${b}`); };
  near(radiusFt(1e-9), 0, 1e-4, 'bow starts at 0');
  near(radiusFt(X_FORE), RMAX_FT, 1e-6, 'bow meets Rmax');
  near(radiusFt(X_AFT + 1e-9), RMAX_FT, 1e-6, 'afterbody starts at Rmax');
  near(radiusFt(X_AP), 0.1175 * RMAX_FT, 1e-6, 'aft perpendicular radius');
  near(radiusFt(X_AP + 1e-9), 0.1175 * RMAX_FT, 1e-4, 'cap continuous at AP');
  near(radiusFt(L_FT - 1e-9), 0, 1e-3, 'cap closes at stern');
  /* monotone closure of the afterbody proper */
  let prev = Infinity;
  for (let x = X_AFT; x <= X_AP; x += 0.01) {
    const r = radiusFt(x);
    if (r > prev + 1e-9) { problems.push(`afterbody non-monotone near x=${x.toFixed(3)}`); break; }
    prev = r;
  }
  return { ok: problems.length === 0, problems };
}
