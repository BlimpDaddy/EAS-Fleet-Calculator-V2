/**
 * SPIKE closure — the ONE sanctioned knob (tau -> nu_eff -> Re_eff), pushed
 * to its stability edge. Question: does any reachable regime flip
 * teardrop < sphere with real separation? Kill is clean either way.
 */
import { runChamber } from './chamber.mjs';
import { makeSphere, makeTeardrop } from './shapes.mjs';

const teardrop = makeTeardrop(3), sphere = makeSphere();
for (const tau of [0.56, 0.53, 0.52, 0.51, 0.505]) {
  const nu = (tau - 0.5) / 3, Re = (0.1 * 11) / nu;
  const t = runChamber(teardrop.verts, teardrop.faces, { tau });
  const s = runChamber(sphere.verts, sphere.faces, { tau });
  const fmt = (r) => Number.isFinite(r.proxy) ? `${r.proxy.toFixed(3)}${r.converged ? '' : ' (UNCONVERGED)'}` : 'NaN/UNSTABLE';
  console.log(`tau ${tau} (Re_eff ~${Math.round(Re)}): teardrop ${fmt(t)} vs sphere ${fmt(s)} -> ${
    Number.isFinite(t.proxy) && Number.isFinite(s.proxy)
      ? (t.proxy < 0.6 * s.proxy ? 'ORDER + SEPARATION OK' : t.proxy < s.proxy ? 'ordered, separation too weak' : 'STILL INVERTED')
      : 'UNSTABLE — past the edge'}`);
}
