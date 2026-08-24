/**
 * PRESET DYNAMICS GENERATOR (M6 stage 2 — the hybrid geometry
 * inheritance rule: preset records PRECOMPUTED at bake time with an
 * asset-hash guard; uploads measured live).
 *
 * Run from CalcV2: `node tools/gen-preset-dynamics.mjs`
 * Writes: src/presetDynamics.js (GENERATED module — bakes with src/).
 *
 * WHY THIS EXISTS: the deployed preset .glb files are Frazer's authored
 * WIREFRAMES — pure line primitives, zero triangles (verified
 * 2026-08-16) — so the estimator cannot ray-cast them in the browser,
 * and the corpus never ships (3D OBJ/ stays local). The RECORDS (pure
 * numbers with provenance) are computed here, locally, and committed.
 *
 * GEOMETRY SOURCE HIERARCHY, per preset:
 *  1. corpus .obj WITH real faces (Sunship, washing machine) — the true
 *     skin; the same source the pinned M1 Sunship record came from.
 *  2. otherwise: CONVEX HULL of the deployed .glb's own vertices — the
 *     exact displayed object, closed by its hull (the VS pipeline's
 *     measurement precedent). Labelled 'convex-hull(glb)': for concave
 *     bodies this smooths concavities — screening-grade, declared.
 *  If a corpus mesh fails the estimator's parity gate (broken faces),
 *  the generator falls back to source 2 and says so.
 *
 * ASSET-HASH GUARD: each record carries the sha256 of the deployed .glb
 * (and the corpus .obj when used). The fixture suite recomputes hashes
 * and fails loudly if an asset changed without regeneration.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { parseGlbVertices } from '../src/glb.js';
import { convexHull } from '../src/hull.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';
import { measureSectionalProxy } from '../src/cdEstimator.js';

const here = dirname(fileURLToPath(import.meta.url));
const GLB_DIR = join(here, '..', '..', 'site', 'assets', 'shape-models');
const CORPUS = join(here, '..', '..', '..', '3D OBJ');
const OUT = join(here, '..', 'src', 'presetDynamics.js');

/** preset id (deployed) -> corpus .obj filename (null = no faced corpus mesh). */
const PRESETS = {
  sunship: 'Sunship.obj',
  cigar: 'cigar.obj',
  bottle: 'Bottle.obj',
  car: 'car.obj',
  washingmachine: 'washingmachine.obj',
  aerosmena: 'Aerosmena.obj',
};

/**
 * AUTHORED default flight axes (Toby's orientation ruling, 2026-08-16,
 * dictated: bottle "flying upwards... must be turned"; "cigar obvs not
 * broadside"; "car frontal"; "lenticular side on like a frisbee (but
 * not spinning)"; washing machine "maybe like bottle turned on side").
 * §4.1 discipline: DECLARED (authored here), never detected at runtime.
 * SIGNS RULED by Toby (2026-08-16, second pass): NATURAL attitudes —
 * "the cigar should be flying forwards [tapered end leading]… bottle
 * going cap/opening forwards". These are NOT the low-drag directions
 * (drag lives in the WAKE: a blunt TRAILING end is what costs — the
 * teardrop's round-nose/sharp-tail lesson), and the estimator prices
 * that honestly: cigar +Z 0.925 (vs 0.606 taper-trailing), bottle -Y
 * 0.905 (vs 0.531 neck-trailing). Owner may re-rule per shape with one
 * word; the profile card (lab/preset-profiles.svg) shows both. Sunship
 * '+Z' canonical. Uploads default '+Z'; rotate is the visualiser's job.
 */
const DEFAULT_AXES = {
  sunship: '+Z',
  cigar: '+Z', // superseded by AERO_HULLS.cigar ('+X' — the authored hull's own frame)
  bottle: '-Y',
  car: '+Z',
  washingmachine: '+Y',
  aerosmena: '+Z',
};

/**
 * AERO HULLS — RATIFIED authored aerodynamic bodies (displayMesh /
 * aeroHullMesh doctrine, r14 ruling 2026-08-16; r17: catalogue presets
 * REQUIRE an aeroHullMesh for comparison-grade numbers)
 * WHAT:  preset id -> { file (CalcV2-relative), axis } — when present,
 *        the ENTIRE dynamics record (raw geometry + all six signed-axis
 *        proxies) derives from the authored aero hull instead of the
 *        source hierarchy below, and defaultAxis comes from the entry
 *        (the hull's own frame, not DEFAULT_AXES).
 * WHY:   the deployed cigar .glb is a display wireframe with tail fins,
 *        and its corpus point-cloud export is corrupted (fat end cap
 *        flipped inside-out, owner's read 2026-08-17) — its numbers
 *        were DISQUALIFIED as comparisons at r17. The authored 5:1
 *        formula hull (ellipsoidal nose 15%L, cylinder, tapered stern
 *        45%L) states the design intent as clean geometry. The display
 *        .glb stays untouched forever; page-1 VS/VE still measures the
 *        DISPLAY object (whole-vehicle metrics, fins included, per Toby
 *        2026-08-17) — only the DRAG record uses the bare aero hull.
 * PROVENANCE: OWNER RATIFICATION 2026-08-17 ("the 5:1 formula aero
 *        hull IS the cigar preset aeroHullMesh");
 *        lab/cigar-aerohull-candidate.obj + .svg inspection card.
 * LIMITATION: a missing/faceless/parity-failing aero hull is a HARD
 *        ERROR, never a fallback — silently reverting to disqualified
 *        geometry is the exact failure the doctrine exists to prevent.
 * REPLACE WHEN: a ratified re-export of the authored CAD supersedes the
 *        formula hull (thicccigar analog awaits its own ratification).
 */
const AERO_HULLS = {
  cigar: { file: 'lab/cigar-aerohull-candidate.obj', axis: '+X' },
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const AXES = ['X', 'Y', 'Z'];
const SIGNED = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

function measure(verts, faces) {
  const per = {};
  for (const ax of AXES) per[ax] = measureDynamicsGeometry(verts, faces, { flightAxis: ax });
  const raw = {
    extents: per.Z.extents,
    frontalRaw: { X: per.X.frontalArea, Y: per.Y.frontalArea, Z: per.Z.frontalArea },
    wettedRaw: per.Z.wettedArea,
    hullRaw: per.Z.hullArea,
    meshRaw: per.Z.meshArea,
    wettedSource: per.Z.wettedSource,
    volumeRaw: per.Z.volume,       // axis-independent; contract amendment 2026-08-16
    volumeSource: per.Z.volumeSource,
    warnings: per.Z.warnings,
  };
  const proxies = {};
  let anyBad = false;
  for (const ax of SIGNED) {
    const p = measureSectionalProxy(verts, faces, { axis: ax });
    proxies[ax] = {
      proxy: p.proxy,
      cls: p.cls,               // mechanism class (graduation 2026-08-16)
      triggers: p.triggers,     // the four trigger values, for provenance
      oddFraction: p.quality ? p.quality.oddFraction : null,
    };
    if (!Number.isFinite(p.proxy)) anyBad = true;
  }
  return { raw, proxies, anyBad };
}

const records = {};
for (const [id, objName] of Object.entries(PRESETS)) {
  const glbPath = join(GLB_DIR, `${id}.glb`);
  const glbBuf = readFileSync(glbPath);
  const glbHash = sha256(glbBuf);

  // Source hierarchy (amended 2026-08-16 after Toby's catch — the cigar
  // .glb carries TAIL FINS, and a convex hull of it is a wedge fattest
  // at the tail, not a cigar): 1. corpus .obj with real FACES (true
  // skin); 2. convex hull of the corpus .obj POINTS (the bare design
  // body — appendage-free, per the bare-hull doctrine the estimator and
  // TR-397 share); 3. convex hull of the deployed .glb vertices (last
  // resort — glb wireframes may include fins/appendages, and the hull
  // bridges across them).
  let source = null, objHash = null, result = null;
  const aero = AERO_HULLS[id];
  if (aero) {
    const aeroPath = join(here, '..', aero.file);
    if (!existsSync(aeroPath)) throw new Error(`${id}: ratified aero hull MISSING (${aero.file}) — hard error by doctrine, no fallback`);
    const objText = readFileSync(aeroPath, 'utf8');
    const mesh = parseObjMesh(objText);
    if (mesh.faces.length === 0) throw new Error(`${id}: ratified aero hull has no faces (${aero.file})`);
    const m = measure(mesh.verts, mesh.faces);
    if (m.anyBad) throw new Error(`${id}: ratified aero hull failed the parity gate (${aero.file})`);
    source = `aero-hull(${aero.file})`;
    objHash = sha256(objText);
    result = m;
  }
  const objPath = objName && join(CORPUS, objName);
  if (!result && objPath && existsSync(objPath)) {
    const objText = readFileSync(objPath, 'utf8');
    const mesh = parseObjMesh(objText);
    const faced = mesh.faces.length > 0;
    const faces = faced ? mesh.faces : convexHull(mesh.verts).faces;
    const m = measure(mesh.verts, faces);
    if (!m.anyBad) {
      source = faced ? `corpus-obj(${objName})` : `convex-hull(corpus ${objName})`;
      objHash = sha256(objText);
      result = m;
    } else {
      console.warn(`${id}: corpus mesh failed the parity gate on some axis — falling back to glb hull`);
    }
  }
  if (!result) {
    const verts = parseGlbVertices(new Uint8Array(glbBuf));
    const hull = convexHull(verts);
    const m = measure(verts, hull.faces);
    source = 'convex-hull(glb — may include appendages)';
    result = m;
    if (m.anyBad) throw new Error(`${id}: even the convex hull failed the parity gate — investigate`);
  }
  records[id] = {
    id, source, glbSha256: glbHash, objSha256: objHash,
    aeroObj: aero ? aero.file : null, // CalcV2-relative path; hash-guarded by fixture [J]
    defaultAxis: aero ? aero.axis : (DEFAULT_AXES[id] ?? '+Z'),
    raw: result.raw, proxies: result.proxies,
  };
  const ax = records[id].defaultAxis;
  console.log(`${id.padEnd(16)} ${source.padEnd(28)} axis ${ax}  proxy ${result.proxies[ax].proxy.toFixed(4)}  frontal(${ax[1]}) ${result.raw.frontalRaw[ax[1]].toFixed(3)} (mesh-units²)`);
}

const banner = `/**
 * GENERATED FILE — do not hand-edit. Regenerate: node tools/gen-preset-dynamics.mjs
 * (M6 stage 2, hybrid geometry inheritance: preset dynamics records precomputed
 * at bake time; asset-hash guarded by the estimator fixture suite.)
 *
 * Raw values are MESH UNITS — scale at page time via scaleGeometryRecord()
 * (dynamicsGeometry.js) with the inherited length. Proxies are scale-free.
 * Generated ${new Date().toISOString().slice(0, 10)}.
 */
export const PRESET_DYNAMICS = `;
writeFileSync(OUT, banner + JSON.stringify(records, null, 2) + ';\n');
console.log(`\nwrote ${OUT}`);
