/**
 * ITEM 4 — THE CORPUS. Spec 90, rulings 90.7. Data via QUIET IMPORT of the
 * existing exam modules — nothing re-transcribed, one source of truth. The
 * exam scripts print their own output on import; console is muted for the
 * duration of the import and restored, nothing else touched.
 *
 * CANONICAL CONVENTION (90.1 as ruled):
 *   tabulated axisymmetric      -> pchip + 96x28 lathe (the frozen-knot path)
 *   exact-equation axisymmetric -> exact r(x) + 96x28 lathe
 *   non-axisymmetric            -> source geometry preserved, equivalent
 *                                  declared resolution
 *   every lathe body also scored at 768x224, PROVENANCE ONLY
 *
 * Every body: +X flight axis, volume centroid (4.1), its own published test
 * condition. Measured values carried RAW; the ITTC-based quantity is the
 * CANONICAL / MODEL-EQUIVALENT PRESSURE RESIDUAL (R3), never "measured
 * pressure Cd".
 */
import { BODIES as TN, pchip } from './tn614-bodies.mjs';
import { SOLVED_ALL } from './item4-s58.mjs';
import { makeCube, makePlate, makeTeardrop } from '../flow-chamber/shapes.mjs';
import { volumeCentroid } from './ribbons.mjs';

export const NU = 1.5e-5;

export async function quietImport(spec) {
  const logs = [console.log, console.error, console.warn];
  console.log = console.error = console.warn = () => {};
  try { return await import(spec); }
  finally { [console.log, console.error, console.warn] = logs; }
}

/* ---------------- canonical builders ---------------- */

/** pchip + rings x segs lathe of [station, radius] ordinates (any units). */
export function latheOrdinates(pts, rings = 96, segs = 28) {
  const f = pchip(pts);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  return latheFn((x) => Math.max(f(x), 0), x0, x1, rings, segs);
}

/** exact r(x) lathe over [x0, x1]. */
export function latheFn(rOf, x0, x1, rings = 96, segs = 28) {
  const verts = [], faces = [], ringIdx = [];
  for (let i = 0; i <= rings; i++) {
    const x = x0 + ((x1 - x0) * i) / rings;
    const r = Math.max(rOf(x), 0);
    if (r < 1e-9 * (x1 - x0)) { ringIdx.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
    ringIdx.push(first);
  }
  const size = (i) => (i < rings ? ringIdx[i + 1] - ringIdx[i] : verts.length - ringIdx[i]);
  for (let i = 0; i < rings; i++) {
    const a = ringIdx[i], b = ringIdx[i + 1], aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      if (aP) faces.push([a, b + s, b + s1]);
      else if (bP) faces.push([b, a + s1, a + s]);
      else faces.push([a + s, b + s, b + s1], [a + s, b + s1, a + s1]);
    }
  }
  return centre({ verts, faces });
}

/** square-section lathe with the SAME A(x) as a given radius profile (TM-267). */
export function latheSquare(rOf, x0, x1, rings = 96, segsPerSide = 8) {
  const verts = [], faces = [], ringIdx = [];
  const segs = 4 * segsPerSide;
  for (let i = 0; i <= rings; i++) {
    const x = x0 + ((x1 - x0) * i) / rings;
    const r = Math.max(rOf(x), 0);
    if (r < 1e-9 * (x1 - x0)) { ringIdx.push(verts.push([x, 0, 0]) - 1); continue; }
    const half = (r * Math.sqrt(Math.PI)) / 2;          // square of area pi r^2
    const first = verts.length;
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      const rr = half / Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th)));
      verts.push([x, rr * Math.cos(th), rr * Math.sin(th)]);
    }
    ringIdx.push(first);
  }
  const size = (i) => (i < rings ? ringIdx[i + 1] - ringIdx[i] : verts.length - ringIdx[i]);
  for (let i = 0; i < rings; i++) {
    const a = ringIdx[i], b = ringIdx[i + 1], aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      if (aP) faces.push([a, b + s, b + s1]);
      else if (bP) faces.push([b, a + s1, a + s]);
      else faces.push([a + s, b + s, b + s1], [a + s, b + s1, a + s1]);
    }
  }
  return centre({ verts, faces });
}

function centre(m) {
  const c = volumeCentroid(m.verts, m.faces).c;
  return { verts: m.verts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]), faces: m.faces };
}

/** max radius per axial band of a mesh -> radius profile (TM-267 round donor). */
export function profileOf(mesh, bands = 96) {
  let x0 = Infinity, x1 = -Infinity;
  for (const p of mesh.verts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; }
  const r = new Array(bands + 1).fill(0);
  for (const p of mesh.verts) {
    const i = Math.round(((p[0] - x0) / (x1 - x0)) * bands);
    const rr = Math.hypot(p[1], p[2]);
    if (rr > r[i]) r[i] = rr;
  }
  return { x0, x1, rOf: (x) => {
    const t = ((x - x0) / (x1 - x0)) * bands;
    const i = Math.max(0, Math.min(bands - 1, Math.floor(t)));
    return r[i] + (r[i + 1] - r[i]) * (t - i);
  } };
}

/* ---------------- the corpus ---------------- */
/**
 * Each entry: id, family, role, grade, medium, build(rings,segs), lengthM,
 * speedKmh at the published test condition, measured {total (CD_A frontal
 * basis), basis, note} or null, ordering info where that is the evidence.
 * `gottingenMeasured` deliberately ABSENT here — joined only in the full
 * phase (90.7 R2 blind protocol).
 */
export async function loadCorpus() {
  const tr397 = await quietImport('./tr397.mjs');
  const tr291 = await quietImport('./tr291.mjs');
  const akron = await quietImport('./tr432-akron.mjs');
  const n451 = await quietImport('./naca451-stern.mjs');
  const out = [];

  /* --- TN-614: tabulated axisymmetric; Re_eff 66e6 on 40-in model length --- */
  const TN_L = 1.016;
  const TN_V = (66e6 * NU) / TN_L;
  for (const id of Object.keys(TN)) {
    out.push({
      id: `TN614-${id}`, family: 'streamlined BoR', medium: 'air',
      role: id === '111' || id === '332' ? 'calibration-consumed' : 'spent',
      grade: 'tabulated-ordinates',
      build: (r = 96, s = 28) => latheOrdinates(TN[id].pts.map(([a, b]) => [a / 100, b / 100]), r, s),
      lengthM: TN_L, speedKmh: TN_V * 3.6,
      measured: { total: TN[id].cdA, basis: 'CD_A frontal, Table III, Re_eff 66e6' },
    });
  }

  /* --- textbook anchors --- */
  out.push({
    id: 'sphere', family: 'bluff (crisis-class)', medium: 'air', role: 'calibration-consumed',
    grade: 'exact-equation',
    build: (r = 96, s = 28) => latheFn((x) => Math.sqrt(Math.max(0, 0.25 - x * x)), -0.5, 0.5, r, s),
    lengthM: 1, speedKmh: ((1.85e8 * NU) / 1) * 3.6,
    measured: { total: 0.19, basis: 'Achenbach 1972 transcritical, literature grade' },
  });
  out.push({
    id: 'cube', family: 'bluff (pinned)', medium: 'air', role: 'calibration-consumed',
    grade: 'exact-equation', nonAxisym: true,
    build: () => centre(makeCube()),
    lengthM: 1, speedKmh: ((1e7 * NU) / 1) * 3.6,
    measured: { total: 1.05, basis: 'textbook, Re-insensitive pinned class' },
  });
  out.push({
    id: 'flat-plate', family: 'bluff (pinned)', medium: 'air', role: 'calibration-consumed',
    grade: 'exact-equation', nonAxisym: true,
    build: () => centre(makePlate()),
    lengthM: 1, speedKmh: ((1e7 * NU) / 1) * 3.6,
    measured: { total: 1.17, basis: 'textbook square plate, normal' },
  });

  /* --- TR-432 Akron: published offsets; volume-basis Re 4.30e6 --- */
  {
    const L_FT = 19.62, L_IN = L_FT * 12, L_M = L_FT * 0.3048;
    const D_FT = (2 * 19.9) / 12, A_FT2 = (Math.PI * D_FT * D_FT) / 4;
    const CS_TO_CDA = Math.pow(115, 2 / 3) / A_FT2;
    const vol13 = Math.pow(115, 1 / 3) * 0.3048;
    const V = (4.30e6 * NU) / vol13;
    out.push({
      id: 'TR432-Akron', family: 'streamlined BoR', medium: 'air', role: 'spent',
      grade: 'published-offsets',
      build: (r = 96, s = 28) => latheOrdinates(akron.AKRON_OFFSETS.map(([aL, rIn]) => [aL, rIn / L_IN]), r, s),
      lengthM: L_M, speedKmh: V * 3.6,
      measured: { total: 0.0190 * CS_TO_CDA, basis: 'P.R.T. 1/40 this-model Cs 0.0190 @ ReV 3.73e6-4.3e6 -> CD_A',
        also: { vdtMain: 0.0180 * CS_TO_CDA } },
    });
  }

  /* --- TR-397: six real airships, traced bare profiles, flight Re --- */
  for (const ship of tr397.SHIPS) {
    const L_M = ship.lengthFt * 0.3048;
    const frontal = (Math.PI * ship.diameterFt * ship.diameterFt) / 4;
    const V = (ship.reM * 1e6 * NU) / L_M;
    out.push({
      id: `TR397-${ship.key}`, family: 'airship (complete, appendaged)', medium: 'air',
      role: 'spent/ordering+bounded', grade: 'traced-profile',
      build: (r = 96, s = 28) => latheOrdinates(tr397.PROFILES[ship.profile].map(([a, b]) => [a / 100, b / 100]), r, s),
      lengthM: L_M, speedKmh: V * 3.6,
      measured: { total: ship.dragAreaFt2 / frontal,
        basis: 'deceleration drag area / frontal — COMPLETE AIRSHIP incl. appendages (upper bound on bare hull)' },
    });
  }

  /* --- TR-291: eight C-class fineness hulls at 40 mph. PERMANENTLY BARRED. --- */
  {
    const V_FS = 58.67, RHO = 0.00237, D_FT = 0.6417;
    const A_FT2 = (Math.PI * D_FT * D_FT) / 4, q = 0.5 * RHO * V_FS * V_FS;
    for (const h of tr291.TR291_HULLS) {
      const L_M = h.lengthIn * 0.0254;
      out.push({
        id: `TR291-fr${h.fr.toFixed(2)}`, family: 'C-class fineness sweep', medium: 'air (LOW Re, laminar caveat)',
        role: 'independent/outcome-exposed — PERMANENTLY BARRED from anchoring', grade: 'published-offsets',
        build: (r = 96, s = 28) => latheOrdinates(
          tr291.TR291_OFFSETS_IN.map(([st, rr]) => [st * h.interval, rr]), r, s),
        lengthM: L_M, speedKmh: (40 * 1.609344),
        measured: { total: h.r40 / (q * A_FT2), basis: `Table IV net resistance ${h.r40} lb @ 40 mph -> CD_A` },
      });
    }
  }

  /* --- Series 58: 24 exact-equation hulls. WATER; ordering evidence only. --- */
  for (const [mid, m] of Object.entries(SOLVED_ALL)) {
    out.push({
      id: `S58-${mid}`, family: 'Series 58 (water)', medium: 'water',
      role: `spent/ordering${m.exposed ? ' (EXPOSED)' : ''}`, grade: 'exact-equation',
      build: (r = 96, s = 28) => latheFn((X) => {
        const x = (X + m.LD / 2) / m.LD;
        if (x <= 0 || x >= 1) return 0;
        let y2 = 0;
        for (let n = 0; n < 6; n++) y2 += m.a[n] * Math.pow(x, n + 1);
        return y2 > 0 ? Math.sqrt(y2) : 0;
      }, -m.LD / 2, m.LD / 2, r, s),
      lengthM: m.LD, speedKmh: ((1e7 * NU) / m.LD) * 3.6,
      measured: null, ordering: 'residual-resistance ordering, spec 61-65; no absolute air Cd claim',
    });
  }

  /* --- Göttingen ellipsoids: exact-equation. Measured JOINED ONLY IN FULL PHASE. --- */
  out.push({
    id: 'GOTT-oblate', family: 'ellipsoid (crisis-class)', medium: 'air',
    role: 'held-out -> SPENT BY THIS RUN (90.7 R2)', grade: 'exact-equation',
    build: (r = 96, s = 28) => latheFn((x) => 0.100 * Math.sqrt(Math.max(0, 1 - (x / 0.075) ** 2)), -0.075, 0.075, r, s),
    lengthM: 0.150, speedKmh: 30 * 3.6,      // declared blind condition: v = 30 m/s
    measured: null, gottingen: 'T35_OBLATE',
  });
  out.push({
    id: 'GOTT-prolate', family: 'ellipsoid (crisis-class)', medium: 'air',
    role: 'held-out -> SPENT BY THIS RUN (90.7 R2)', grade: 'exact-equation',
    build: (r = 96, s = 28) => latheFn((x) => 0.100 * Math.sqrt(Math.max(0, 1 - (x / 0.180) ** 2)), -0.180, 0.180, r, s),
    lengthM: 0.360, speedKmh: 30 * 3.6,
    measured: null, gottingen: 'T36_PROLATE',
  });

  /* --- Report 451 stern pair: ordering-only --- */
  for (const [key, pts] of [['original', n451.ORIGINAL], ['altered', n451.ALTERED]]) {
    const xMax = pts[pts.length - 1][0];
    out.push({
      id: `R451-${key}`, family: 'streamlined BoR (stern pair)', medium: 'air',
      role: 'ordering-only/outcome-exposed', grade: 'tabulated-ordinates',
      build: (r = 96, s = 28) => latheOrdinates(pts.map(([a, b]) => [a / xMax, b / xMax]), r, s),
      lengthM: xMax * 0.0254, speedKmh: ((1e7 * NU) / (xMax * 0.0254)) * 3.6,
      measured: null, ordering: 'report p8: altered stern ~+5% drag at highest Re',
    });
  }

  /* --- TM-267 synthetic pair: geometry/control --- */
  {
    const L_M = 0.81, AREA = 0.0136, D = Math.sqrt((4 * AREA) / Math.PI);
    const donor = makeTeardrop(L_M / D, 96, 32);
    const prof = profileOf(donor, 96);
    out.push({
      id: 'TM267-round', family: 'section-shape pair', medium: 'air',
      role: 'geometry-only/control', grade: 'synthetic-realization',
      build: (r = 96, s = 28) => latheFn(prof.rOf, prof.x0, prof.x1, r, s),
      lengthM: L_M, speedKmh: 18.5 * 3.6,
      measured: null, ordering: 'measured pair 0.046/0.050 (ratio 1.087), report warns accuracy low',
    });
    out.push({
      id: 'TM267-square', family: 'section-shape pair', medium: 'air',
      role: 'geometry-only/control', grade: 'synthetic-realization', nonAxisym: true,
      build: (r = 96) => latheSquare(prof.rOf, prof.x0, prof.x1, r, 7),
      lengthM: L_M, speedKmh: 18.5 * 3.6,
      measured: null, ordering: 'the square half of the pair',
    });
  }

  return out;
}
