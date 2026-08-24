/**
 * SPIKE — the coarse geometric flow chamber (M6 pressure-proxy candidate B).
 *
 * WHAT: voxelise a mesh into a small 3D lattice; run a deliberately coarse
 * D3Q19 lattice-Boltzmann relaxation (BGK) with bounce-back walls; accumulate
 * the streamwise momentum the flow hands the body each tick (the
 * momentum-exchange method — how real LBM codes compute force); time-average
 * after the transient; normalise by ½·ρ·U²·A_frontal → a dimensionless
 * pressure-drag PROXY.
 *
 * WHAT IT IS NOT: CFD. It resolves no boundary layer, claims no Reynolds
 * fidelity. ν_eff (via τ) sets an EFFECTIVE regime; the proxy is only ever
 * mapped to Cd through a monotone calibration on the §5.2 anchors, ±50%.
 * KILL RULE (gate): τ and that calibration map are the only tunables.
 *
 * Spike-only: no engine imports this; spike/ never enters the bake.
 */

/* D3Q19 lattice: rest + 6 axis + 12 edge-diagonal directions. */
const CX = [0, 1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0];
const CY = [0, 0, 0, 1, -1, 0, 0, 1, -1, -1, 1, 0, 0, 0, 0, 1, -1, 1, -1];
const CZ = [0, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, 1, -1, -1, 1, 1, -1, -1, 1];
const W = [1 / 3,
  1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18,
  1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = CX.map((_, i) => CX.findIndex((_, j) => CX[j] === -CX[i] && CY[j] === -CY[i] && CZ[j] === -CZ[i]));
const Q = 19;

/** Map a mesh into flow coordinates: flow along +gx. axis ∈ ±X/±Y/±Z. */
function toFlowCoords(verts, axis) {
  const sign = axis[0] === '-' ? -1 : 1;
  const a = axis[1] ?? axis[0]; // accept 'Z' as '+Z'
  const pick = { X: [0, 1, 2], Y: [1, 2, 0], Z: [2, 0, 1] }[a.toUpperCase()];
  return verts.map((p) => [sign * p[pick[0]], p[pick[1]], p[pick[2]]]);
}

/**
 * Parity voxelisation: rasterise each triangle's x-intersections into
 * (y,z) columns, sort, fill between pairs. Winding-blind; odd trailing
 * intersections (junk meshes) are dropped.
 * `offset` = sub-cell raster shift in cells (the grid-alignment test knob).
 */
export function voxelise(verts, faces, { axis = '+X', NX, NY, NZ, targetCross, startX, offset = [0, 0, 0] }) {
  const fv = toFlowCoords(verts, axis);
  let minX = 1 / 0, maxX = -1 / 0, minY = 1 / 0, maxY = -1 / 0, minZ = 1 / 0, maxZ = -1 / 0;
  for (const [x, y, z] of fv) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cross = Math.max(maxY - minY, maxZ - minZ);
  let scale = targetCross / cross;
  // Flow length must leave room for the wake; shrink if needed.
  const maxLen = NX - startX - Math.round(NX * 0.3);
  if ((maxX - minX) * scale > maxLen) scale = maxLen / (maxX - minX);

  const gx = (x) => (x - minX) * scale + startX + offset[0];
  const gy = (y) => (y - (minY + maxY) / 2) * scale + NY / 2 + offset[1];
  const gz = (z) => (z - (minZ + maxZ) / 2) * scale + NZ / 2 + offset[2];

  const columns = new Map(); // (j*NZ+k) -> [x,...]
  for (const face of faces) {
    for (let t = 1; t + 1 < face.length; t++) { // fan triangulation
      const tri = [face[0], face[t], face[t + 1]].map((i) => fv[i]);
      if (tri.some((p) => !p)) continue;
      const [p0, p1, p2] = tri.map(([x, y, z]) => [gx(x), gy(y), gz(z)]);
      const jMin = Math.max(0, Math.ceil(Math.min(p0[1], p1[1], p2[1]) - 0.5));
      const jMax = Math.min(NY - 1, Math.floor(Math.max(p0[1], p1[1], p2[1]) - 0.5) + 1);
      const kMin = Math.max(0, Math.ceil(Math.min(p0[2], p1[2], p2[2]) - 0.5));
      const kMax = Math.min(NZ - 1, Math.floor(Math.max(p0[2], p1[2], p2[2]) - 0.5) + 1);
      const d = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p2[1] - p0[1]) * (p1[2] - p0[2]);
      if (Math.abs(d) < 1e-12) continue; // edge-on triangle contributes nothing in x
      for (let j = jMin; j <= jMax; j++) {
        for (let k = kMin; k <= kMax; k++) {
          const py = j + 0.5, pz = k + 0.5;
          const w0 = ((p1[1] - py) * (p2[2] - pz) - (p2[1] - py) * (p1[2] - pz)) / d;
          const w1 = ((p2[1] - py) * (p0[2] - pz) - (p0[1] - py) * (p2[2] - pz)) / d;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
          const xHit = w0 * p0[0] + w1 * p1[0] + w2 * p2[0];
          const key = j * NZ + k;
          if (!columns.has(key)) columns.set(key, []);
          columns.get(key).push(xHit);
        }
      }
    }
  }

  const solid = new Uint8Array(NX * NY * NZ);
  let solidCount = 0;
  const frontal = new Set();
  for (const [key, xs] of columns) {
    xs.sort((a, b) => a - b);
    // Merge near-duplicate hits (shared triangle edges register twice).
    const merged = [];
    for (const x of xs) {
      if (merged.length && Math.abs(x - merged[merged.length - 1]) < 1e-6) continue;
      merged.push(x);
    }
    const j = Math.floor(key / NZ), k = key % NZ;
    for (let p = 0; p + 1 < merged.length; p += 2) {
      const i0 = Math.max(0, Math.ceil(merged[p] - 0.5));
      const i1 = Math.min(NX - 1, Math.floor(merged[p + 1] - 0.5));
      for (let i = i0; i <= i1; i++) {
        const idx = (i * NY + j) * NZ + k;
        if (!solid[idx]) { solid[idx] = 1; solidCount++; }
      }
      if (i1 >= i0) frontal.add(key);
    }
  }
  return { solid, solidCount, frontalArea: frontal.size, scale };
}

/**
 * Run the chamber to (quasi-)steady state. Returns the dimensionless
 * streamwise momentum-transfer proxy + convergence + timing.
 */
export function runChamber(verts, faces, {
  axis = '+X', NX = 80, NY = 36, NZ = 36,
  targetCross = 11, startX = 18, offset = [0, 0, 0],
  U = 0.1, tau = 0.56, ticks = 700,
} = {}) {
  const t0 = performance.now();
  const { solid, solidCount, frontalArea } = voxelise(verts, faces, { axis, NX, NY, NZ, targetCross, startX, offset });
  if (!solidCount || !frontalArea) return { ok: false, reason: 'empty voxelisation' };

  const NC = NX * NY * NZ;
  let f = new Float32Array(NC * Q), f2 = new Float32Array(NC * Q);
  const omega = 1 / tau, u2c = 1.5 * U * U;
  // Equilibrium at freestream, everywhere.
  const eq = new Float32Array(Q);
  for (let i = 0; i < Q; i++) {
    const cu = 3 * CX[i] * U;
    eq[i] = W[i] * (1 + cu + 0.5 * cu * cu - u2c);
  }
  for (let c = 0; c < NC; c++) for (let i = 0; i < Q; i++) f[c * Q + i] = eq[i];

  const fxSeries = new Float64Array(ticks);
  for (let t = 0; t < ticks; t++) {
    let fxTick = 0;
    for (let x = 0; x < NX; x++) {
      for (let y = 0; y < NY; y++) {
        for (let z = 0; z < NZ; z++) {
          const c = (x * NY + y) * NZ + z;
          if (solid[c]) continue;
          const b = c * Q;
          // macroscopics
          let rho = 0, ux = 0, uy = 0, uz = 0;
          for (let i = 0; i < Q; i++) {
            const fi = f[b + i];
            rho += fi; ux += fi * CX[i]; uy += fi * CY[i]; uz += fi * CZ[i];
          }
          ux /= rho; uy /= rho; uz /= rho;
          const usq = 1.5 * (ux * ux + uy * uy + uz * uz);
          for (let i = 0; i < Q; i++) {
            const cu = 3 * (CX[i] * ux + CY[i] * uy + CZ[i] * uz);
            const feq = W[i] * rho * (1 + cu + 0.5 * cu * cu - usq);
            const fs = f[b + i] + omega * (feq - f[b + i]); // post-collision
            const nx = x + CX[i];
            if (nx < 0 || nx >= NX) continue; // leaves domain (boundary layers are refreshed below)
            let ny = y + CY[i]; if (ny < 0) ny += NY; else if (ny >= NY) ny -= NY;
            let nz = z + CZ[i]; if (nz < 0) nz += NZ; else if (nz >= NZ) nz -= NZ;
            const n = (nx * NY + ny) * NZ + nz;
            if (solid[n]) {
              f2[b + OPP[i]] = fs;            // bounce back
              fxTick += 2 * fs * CX[i];       // momentum handed to the body
            } else {
              f2[n * Q + i] = fs;
            }
          }
        }
      }
    }
    // Inflow: fresh freestream equilibrium; outflow: copy the previous slab.
    for (let y = 0; y < NY; y++) {
      for (let z = 0; z < NZ; z++) {
        const cin = ((0 * NY + y) * NZ + z) * Q;
        const cout = (((NX - 1) * NY + y) * NZ + z) * Q;
        const cprev = (((NX - 2) * NY + y) * NZ + z) * Q;
        for (let i = 0; i < Q; i++) { f2[cin + i] = eq[i]; f2[cout + i] = f2[cprev + i]; }
      }
    }
    fxSeries[t] = fxTick;
    const tmp = f; f = f2; f2 = tmp;
  }

  const mean = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += fxSeries[i]; return s / (b - a); };
  const q3 = mean(Math.floor(ticks * 0.5), Math.floor(ticks * 0.75));
  const q4 = mean(Math.floor(ticks * 0.75), ticks);
  const F = mean(Math.floor(ticks * 0.5), ticks);
  const proxy = F / (0.5 * U * U * frontalArea);
  const converged = Number.isFinite(proxy) && Math.abs(q4 - q3) <= 0.03 * Math.max(Math.abs(q4), 1e-12);
  return {
    ok: Number.isFinite(proxy), proxy, converged,
    frontalArea, solidCount, ticks, ms: performance.now() - t0,
  };
}

/** Monotone piecewise-linear calibration through the anchor (proxy, Cd) pairs. */
export function makeCalibration(pairs) {
  const p = [...pairs].sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= p[0][0]) return Math.max(0, p[0][1] + (x - p[0][0]) * (p[1][1] - p[1][0] ? (p[1][1] - p[0][1]) / (p[1][0] - p[0][0]) : 0));
    for (let i = 0; i + 1 < p.length; i++) {
      if (x <= p[i + 1][0]) {
        const t = (x - p[i][0]) / (p[i + 1][0] - p[i][0]);
        return p[i][1] + t * (p[i + 1][1] - p[i][1]);
      }
    }
    const i = p.length - 2;
    const slope = (p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]);
    return p[i + 1][1] + (x - p[i + 1][0]) * slope;
  };
}
