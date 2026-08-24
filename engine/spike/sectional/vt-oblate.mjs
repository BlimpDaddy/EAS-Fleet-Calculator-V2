/**
 * VT OBLATE ELLIPSOID (DeMoss 2007, VT Stability Tunnel) — GEOMETRY ONLY.
 * Spec 98 pass 1. Source: DeMoss MS thesis ch.2 (hdl 10919/34908).
 *
 * EXACT ANALYTIC BODY (2.2.1): L = 1.6 m = 0.4 m bow + 0.8 m parallel
 * mid-section + 0.4 m stern. Bow and stern are the two halves of a SCALENE
 * ellipsoid (0.8 m long, 0.4 m wide, 0.231 m high); every cross-section is an
 * oblate ellipse of fixed aspect w/h = 0.4/0.231 = 1.7316, scaled by
 * s(x) = sqrt(1 - ((0.4-x)/0.4)^2) through the bow, 1 through the mid-body,
 * mirrored through the stern. Model dimensional uncertainty 0.1-0.6%.
 *
 * NON-BODY-OF-REVOLUTION: sections are ellipses, so this is simultaneously
 * the independent OBLATE-family exam and the first MEASURED non-circular-
 * section drag body since TM-267 — the A2 case (spec 89) with real drag data.
 */
export const L = 1.6, HALF_W = 0.2, HALF_H = 0.1155;
export const K_SECTION = HALF_W / HALF_H;          // 1.7316
const CAP = 0.4;

/** section scale factor along the body */
export function scaleAt(x) {
  if (x <= 0 || x >= L) return 0;
  if (x < CAP) return Math.sqrt(Math.max(0, 1 - ((CAP - x) / CAP) ** 2));
  if (x > L - CAP) return Math.sqrt(Math.max(0, 1 - ((x - (L - CAP)) / CAP) ** 2));
  return 1;
}

/** authored mesh: elliptical sections, rings x azimuths */
export function buildVtOblate(rings = 96, naz = 28) {
  const verts = [], faces = [], ringStart = [];
  for (let i = 0; i <= rings; i++) {
    const x = (L * i) / rings;
    const s = scaleAt(x);
    if (s < 1e-9) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
    ringStart.push(verts.length);
    for (let j = 0; j < naz; j++) {
      const th = (2 * Math.PI * j) / naz;
      /* width along z (span), height along y — orientation is inert to the
         estimator (axisymmetric raster) and to A2 (magnitude only) */
      verts.push([x, HALF_H * s * Math.sin(th), HALF_W * s * Math.cos(th)]);
    }
  }
  const size = (i) => (i < rings ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
  for (let i = 0; i < rings; i++) {
    const a = ringStart[i], b = ringStart[i + 1], aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let j = 0; j < naz; j++) {
      const j1 = (j + 1) % naz;
      if (aP) faces.push([a, b + j, b + j1]);
      else if (bP) faces.push([b, a + j1, a + j]);
      else faces.push([a + j, b + j, b + j1], [a + j, b + j1, a + j1]);
    }
  }
  return { verts, faces };
}

/** geometry self-test: volume vs analytic (ellipsoid + elliptic cylinder) */
export function vtSelfTest() {
  const problems = [];
  /* analytic: scalene ellipsoid 4/3 pi a b c with a=0.4,b=0.2,c=0.1155 plus
     cylinder pi b c * 0.8 */
  const vEll = (4 / 3) * Math.PI * 0.4 * HALF_W * HALF_H;
  const vCyl = Math.PI * HALF_W * HALF_H * 0.8;
  const vAn = vEll + vCyl;
  const m = buildVtOblate(400, 96);
  let six = 0;
  for (const f of m.faces) {
    const a = m.verts[f[0]], b = m.verts[f[1]], c = m.verts[f[2]];
    six += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  const vMesh = Math.abs(six) / 6;
  if (Math.abs(vMesh - vAn) / vAn > 0.01) problems.push(`volume ${vMesh.toFixed(5)} vs analytic ${vAn.toFixed(5)}`);
  return { ok: problems.length === 0, problems, vMesh, vAn };
}
