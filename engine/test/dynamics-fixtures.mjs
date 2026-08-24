/**
 * M1 fixture suite — dynamicsGeometry (DYNAMIC-SPEC §14, build amendment r4).
 *
 * Two tiers:
 *   1. SYNTHETIC invariants — always run, no external files. These catch whole
 *      classes of bugs (units, winding, translation) rather than single values.
 *   2. CORPUS fixtures — run when ../3D OBJ/ exists (local shape corpus, never
 *      committed). Includes THE calibration fixture: Sunship Z-forward at
 *      L = 300 m -> frontal ~40,522 m^2.
 *
 * Plain node, zero deps: `node test/dynamics-fixtures.mjs`. Exit code = verdict.
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
  axisExtents,
  projectedFrontalArea,
  faceAreaSum,
  hullSurfaceArea,
  measureDynamicsGeometry,
  FLIGHT_AXES,
} = await import(new URL('dynamicsGeometry.js', ENGINE_ROOT).href);
const { parseObjMesh } = await import(new URL('obj.js', ENGINE_ROOT).href);

let passed = 0, failed = 0, skipped = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
function skip(name, why) { skipped++; console.log(`skip  ${name} — ${why}`); }
function near(a, b, rel) { return Math.abs(a - b) <= rel * Math.abs(b); }

/* ---------- synthetic geometry ---------- */

/** Axis-aligned box [0,ex]x[0,ey]x[0,ez], 8 verts, 12 triangles, outward winding. */
function box(ex, ey, ez) {
  const v = [];
  for (const x of [0, ex]) for (const y of [0, ey]) for (const z of [0, ez]) v.push([x, y, z]);
  // vertex index = 4*(x?1:0) + 2*(y?1:0) + (z?1:0)
  const f = [
    [0, 1, 3], [0, 3, 2],   // x = 0
    [4, 6, 7], [4, 7, 5],   // x = ex
    [0, 4, 5], [0, 5, 1],   // y = 0
    [2, 3, 7], [2, 7, 6],   // y = ey
    [0, 2, 6], [0, 6, 4],   // z = 0
    [1, 5, 7], [1, 7, 3],   // z = ez
  ];
  return { verts: v, faces: f };
}

const transform = (verts, fn) => verts.map((p) => fn(p));

console.log('\n== synthetic: box 1 x 2 x 3 ==');
{
  const { verts, faces } = box(1, 2, 3);
  const areas = { X: 2 * 3, Y: 1 * 3, Z: 1 * 2 };
  for (const ax of FLIGHT_AXES) {
    const got = projectedFrontalArea(verts, ax);
    check(`frontal ${ax} = ${areas[ax]}`, near(got, areas[ax], 1e-12), `got ${got}`);
  }
  const wet = faceAreaSum(verts, faces);
  check('wetted = 22 (2*(2+3+6))', near(wet, 22, 1e-12), `got ${wet}`);
  check('hull area = wetted for a convex box', near(hullSurfaceArea(verts), wet, 1e-9));

  // Translation invariance
  const t = transform(verts, ([x, y, z]) => [x + 5, y - 3, z + 11]);
  check('translation leaves frontal unchanged',
    near(projectedFrontalArea(t, 'X'), areas.X, 1e-12));
  check('translation leaves wetted unchanged', near(faceAreaSum(t, faces), 22, 1e-9));

  // Uniform scaling by k multiplies areas by k^2
  const k = 2.5;
  const s = transform(verts, ([x, y, z]) => [x * k, y * k, z * k]);
  check('scaling k -> frontal x k^2', near(projectedFrontalArea(s, 'Z'), areas.Z * k * k, 1e-12));
  check('scaling k -> wetted x k^2', near(faceAreaSum(s, faces), 22 * k * k, 1e-9));

  // Winding must not matter for area
  const rev = faces.map((f) => [...f].reverse());
  check('reversed winding, same wetted', near(faceAreaSum(verts, rev), 22, 1e-12));

  // +axis and -axis are the same silhouette (mirror the mesh)
  const m = transform(verts, ([x, y, z]) => [x, y, -z]);
  check('mirrored mesh, same Z silhouette', near(projectedFrontalArea(m, 'Z'), areas.Z, 1e-12));

  // At most three distinct frontal areas exist, by construction of the API
  const set = new Set(FLIGHT_AXES.map((ax) => projectedFrontalArea(verts, ax).toFixed(9)));
  check('<= 3 distinct frontal areas', set.size <= 3, `got ${set.size}`);
}

console.log('\n== synthetic: concave faces (send-back #2) ==');
{
  // U-shaped planar 8-gon, true area 7. A naive fan-from-v0 absolute sum
  // returns 11 — Newell's method must return 7.
  const u = [[0, 0, 0], [3, 0, 0], [3, 3, 0], [2, 3, 0], [2, 1, 0], [1, 1, 0], [1, 3, 0], [0, 3, 0]];
  const got = faceAreaSum(u, [[0, 1, 2, 3, 4, 5, 6, 7]]);
  check('concave planar 8-gon area = 7 (fan would say 11)', near(got, 7, 1e-12), `got ${got}`);
}

console.log('\n== synthetic: junk-mesh policy (send-back #1: suspect values never returned) ==');
{
  const { verts, faces } = box(1, 1, 1);

  // Degenerate triangle contributes exactly zero, never NaN
  const degen = [...faces, [0, 0, 3], [1, 1, 1]];
  const wet = faceAreaSum(verts, degen);
  check('degenerate faces add 0', near(wet, 6, 1e-12), `got ${wet}`);
  check('no NaN from degenerate faces', Number.isFinite(wet));

  // Duplicated faces: warn AND fall back — the inflated sum must not escape
  const dup = [...faces, ...faces, ...faces, ...faces];
  const junk = measureDynamicsGeometry(verts, dup, { flightAxis: 'Z' });
  check('junk warning fires at 4x faces',
    junk.warnings.some((w) => w.startsWith('wetted-junk-suspect')), junk.warnings.join('; '));
  check('junk wettedArea = hull area, not the 4x sum', near(junk.wettedArea, 6, 1e-9),
    `got ${junk.wettedArea}`);
  check('junk flagged hull-fallback', junk.wettedSource === 'hull-fallback');
  check('junk meshArea preserved for diagnostics (24)', near(junk.meshArea, 24, 1e-9),
    `got ${junk.meshArea}`);

  // Point cloud falls back to hull area with a warning, never throws
  const cloud = measureDynamicsGeometry(verts, [], { flightAxis: 'Z' });
  check('no-faces fallback = hull area', near(cloud.wettedArea, 6, 1e-9), `got ${cloud.wettedArea}`);
  check('no-faces fallback flagged', cloud.wettedSource === 'hull-fallback');

  // Open mesh (faces missing): warn AND fall back to hull area
  const open = measureDynamicsGeometry(verts, faces.slice(0, 10), { flightAxis: 'Z' });
  check('open mesh warns wetted-below-hull',
    open.warnings.some((w) => w.startsWith('wetted-below-hull')), open.warnings.join('; '));
  check('open mesh wettedArea = hull area', near(open.wettedArea, 6, 1e-9),
    `got ${open.wettedArea}`);

  // Units are explicit (send-back hardening)
  check('raw record units = mesh-units', cloud.units === 'mesh-units');
}

console.log('\n== synthetic: scaling to physical length ==');
{
  const { verts, faces } = box(2, 1, 1); // flight along X, raw length 2
  const m = measureDynamicsGeometry(verts, faces, { flightAxis: 'X', lengthM: 300 });
  check('scaled record units = m', m.units === 'm');
  check('scale = 150', near(m.scale, 150, 1e-12), `got ${m.scale}`);
  check('frontal scales to m^2', near(m.frontalArea, 1 * 150 * 150, 1e-9), `got ${m.frontalArea}`);
  check('extent along flight = 300 m', near(m.extents[0], 300, 1e-9));
  check('wetted/frontal ratio is scale-free',
    near(m.wettedOverFrontal, faceAreaSum(verts, faces) / 1, 1e-9));
}

/* ---------- corpus fixtures ---------- */

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, '..', '..', '..', '3D OBJ');

console.log('\n== corpus ==');
if (!existsSync(corpus)) {
  skip('corpus fixtures', `${corpus} not found (local shape corpus)`);
} else {
  const load = (name) => parseObjMesh(readFileSync(join(corpus, name), 'utf8'));

  // Sphere: analytic ground truth. Mesh is inscribed, so measured areas sit
  // slightly BELOW analytic — tolerances reflect discretisation, not error.
  {
    const { verts, faces } = load('sphere.obj');
    const [ex] = axisExtents(verts);
    const r = ex / 2;
    const analyticFrontal = Math.PI * r * r;
    const analyticSurface = 4 * Math.PI * r * r;
    const frontal = projectedFrontalArea(verts, 'X');
    const wetted = faceAreaSum(verts, faces);
    check('sphere frontal ~ pi r^2 (0.2%)', near(frontal, analyticFrontal, 2e-3),
      `got ${frontal}, analytic ${analyticFrontal}`);
    check('sphere wetted ~ 4 pi r^2 (2%, from below)',
      wetted <= analyticSurface * 1.001 && wetted >= analyticSurface * 0.97,
      `got ${wetted}, analytic ${analyticSurface}`);
    check('sphere wetted/frontal ~ 4', near(wetted / frontal, 4, 0.03),
      `got ${wetted / frontal}`);
  }

  // THE calibration fixture: Sunship, Z-forward (the export is Y-up/Z-forward),
  // scaled to L = 300 m along travel. Expected frontal measured 2026-08-12.
  {
    const { verts, faces } = load('Sunship.obj');
    const m = measureDynamicsGeometry(verts, faces, { flightAxis: 'Z', lengthM: 300 });
    check('Sunship frontal ~ 40,522 m^2 (0.3%)', near(m.frontalArea, 40522, 3e-3),
      `got ${Math.round(m.frontalArea)}`);
    check('Sunship cross-section ~ 249 x 237 m',
      near(m.extents[0], 249, 0.01) && near(m.extents[1], 237, 0.01),
      `got ${m.extents[0].toFixed(0)} x ${m.extents[1].toFixed(0)}`);
    check('Sunship mesh is clean (no junk/open warnings)', m.warnings.length === 0,
      m.warnings.join('; '));

    // CANONICAL wetted fixture (send-back #3): the 2026-08-13 measurement is
    // in the implementation authority (spec §12.3) — pinned here so a future
    // bug cannot silently drift it. Tolerances are guardbands on a fixed
    // mesh, not uncertainty about the value.
    check('Sunship wetted = 206,795 m^2 (0.5%)', near(m.wettedArea, 206795, 5e-3),
      `got ${Math.round(m.wettedArea)}`);
    check('Sunship hull surface = 206,503 m^2 (0.5%)', near(m.hullArea, 206503, 5e-3),
      `got ${Math.round(m.hullArea)}`);
    check('Sunship wetted/frontal = 5.10 (+/-0.02)',
      Math.abs(m.wettedOverFrontal - 5.10) <= 0.02, `got ${m.wettedOverFrontal.toFixed(3)}`);
    check('Sunship wetted source = mesh', m.wettedSource === 'mesh');

    console.log(`      MEASURED Sunship: wetted ${Math.round(m.wettedArea).toLocaleString()} m^2`
      + ` | hull ${Math.round(m.hullArea).toLocaleString()} m^2`
      + ` | wetted/frontal ${m.wettedOverFrontal.toFixed(2)}`
      + ` | source ${m.wettedSource}`);
  }
}

/* ---------- verdict ---------- */

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exitCode = failed ? 1 : 0;
