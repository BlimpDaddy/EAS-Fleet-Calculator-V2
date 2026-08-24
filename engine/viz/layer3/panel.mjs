/**
 * VIZ PANEL — the embeddable visualizer (V5 step 1, owner go-ahead
 * 2026-08-23). ONE renderer, two hosts: the DYNAMIC page mounts this in
 * its centre-band reservation; the bench mounts the same module and adds
 * its dev apparatus around it. All drawing code moved here VERBATIM from
 * the owner-tuned bench renderer — no visual behaviour changed by the
 * extraction.
 *
 * BINDING mechanics honoured (unchanged from the bench):
 *   - logic ticks at DT_S (10 Hz); requestAnimationFrame PAINTS ONLY —
 *     positions held between ticks, never interpolated (round-3 F3);
 *   - all projection through mapping.mjs (`view` + `flowAxis` parameters —
 *     M7); sphere 1 centred at the universal scale in every view; the
 *     tail toggle never rescales;
 *   - PARKED at v = 0: the adapter never consults the engine (M3);
 *   - PAUSE (owner ruling 2026-08-22) freezes the tick accumulator ONLY —
 *     it never touches the page airspeed or any number;
 *   - the renderer computes NO geometry — everything projected comes from
 *     the payload or the engine state; the panel never writes page state
 *     (feedsNumbers: false is structural, not aspirational).
 *
 * IN-RECTANGLE UI (owner rulings 2026-08-22/23): three small view buttons
 * bottom-left (Side / Top / Front); bottom-right the orientation pair and
 * pause — "⟳ Side", "⟳ Top", "⏸" — very small. Orientation presses call
 * the host's onOrientate callback; the HOST resolves the re-measured
 * payload (fixtures on the bench; the page's provider in the product) and
 * calls setPayload — real geometry, never a screen transform.
 */
import { createAdapter } from '../adapter.mjs';
import { DT_S, COUNT_DESKTOP, worldPos, simBox, VIEW_ASPECT } from '../layer2/engine.mjs';
import { makeMapping, frontalVisible, hullOutline } from './mapping.mjs';
import { TOKENS } from './palette.mjs';

const PALETTE = {
  hull: TOKENS.identity,      // hull envelope — page-1 magenta (owner ruling 2026-08-22)
  shape: TOKENS.ship,         // raw shape linework — page-1 orange
  sphere: TOKENS.sphereLine,
  flow: TOKENS.flowNeutral,
  wake: TOKENS.flowWake,
  captured: TOKENS.flowBli,
};

export function createVizPanel({ container, seed: seed0 = 1, count: count0 = COUNT_DESKTOP, onOrientate = null }) {
  let seed = seed0, count = count0;
  // ---- DOM: wrapper + canvas + overlay buttons -------------------------
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'position:relative;';          // the bars pin to the CANVAS corners
  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;background:#111;';
  box.appendChild(cv);
  wrap.appendChild(box);

  const btnCss = 'font:10px/1.6 monospace;padding:1px 7px;background:rgba(17,17,17,0.7);'
    + `color:${TOKENS.textSecondary};border:1px solid #333;border-radius:3px;cursor:pointer;`;
  const mkBtn = (label, title) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.style.cssText = btnCss;
    b.addEventListener('mouseenter', () => { b.style.color = TOKENS.textPrimary; b.style.borderColor = '#555'; });
    b.addEventListener('mouseleave', () => { b.style.color = TOKENS.textSecondary; b.style.borderColor = '#333'; });
    return b;
  };
  const viewBar = document.createElement('div');
  viewBar.style.cssText = 'position:absolute;left:8px;bottom:8px;display:flex;gap:4px;';
  const orientBar = document.createElement('div');
  orientBar.style.cssText = 'position:absolute;right:8px;bottom:8px;display:flex;gap:4px;';
  const viewBtns = {
    elevation: mkBtn('SIDE', 'Side view (elevation)'),
    plan: mkBtn('TOP', 'Top view (plan)'),
    frontal: mkBtn('FRONT', 'Nose-on view (frontal)'),
  };
  for (const [v, b] of Object.entries(viewBtns)) {
    b.addEventListener('click', () => setView(v));
    viewBar.appendChild(b);
  }
  const pitchBtn = mkBtn('⟳ Side', 'Rotate the shape 90° in the side view');
  const yawBtn = mkBtn('⟳ Top', 'Rotate the shape 90° in the top view');
  const pauseBtn = mkBtn('⏸', 'Pause the particles where they are (numbers untouched)');
  pitchBtn.addEventListener('click', () => onOrientate && onOrientate('pitch'));
  yawBtn.addEventListener('click', () => onOrientate && onOrientate('yaw'));
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  orientBar.append(pitchBtn, yawBtn, pauseBtn);
  box.append(viewBar, orientBar);
  container.appendChild(wrap);

  const ctx = cv.getContext('2d');

  // ---- state -----------------------------------------------------------
  let payload = null;
  let adapter = null;
  let view = 'elevation', flowAxis = 'LR';
  let paused = false;
  let destroyed = false;
  let frameTimes = null, benchEndsAt = 0, benchResolve = null;

  function markView() {
    for (const [v, b] of Object.entries(viewBtns)) {
      b.style.outline = v === view ? `1px solid ${TOKENS.identity}` : 'none';
    }
  }
  markView();

  function sizeCanvas() {
    /* the instrument rectangle is VIEW_ASPECT:1 (2.6 — the wide-flow
       ruling 2026-08-23); it fits INSIDE the host box — a host with an
       explicit height constrains it (the page's centre band), a host
       without one gets width-driven sizing (bench).
       M7 PORTRAIT (2026-08-24): flowAxis TB turns the same rectangle
       tall — 1:VIEW_ASPECT, height-driven first, width the constraint. */
    const availW = Math.max(80, wrap.clientWidth);
    const availH = wrap.clientHeight;
    let w, h;
    if (flowAxis === 'TB') {
      h = availH > 20 ? availH : Math.round(availW * VIEW_ASPECT);
      w = Math.round(h / VIEW_ASPECT);
      if (w > availW) { w = availW; h = Math.round(w * VIEW_ASPECT); }
    } else {
      h = Math.round(availW / VIEW_ASPECT);
      if (availH > 20 && h > availH) h = availH;
      w = Math.min(availW, Math.round(h * VIEW_ASPECT));
    }
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { sizeCanvas(); paint(); }) : null;
  ro?.observe(wrap);
  sizeCanvas();

  const activeGeo = () => {
    const c = adapter.getControls();
    return c.smartTail && payload.extended ? payload.extended : payload.retracted;
  };

  // ---- drawing (moved verbatim from the owner-tuned bench renderer) ----
  function drawSphereCircle(m, sph) {
    if (!sph) return;
    const q = m.project({ x: sph.centerM[0], y: sph.centerM[1], z: sph.centerM[2] });
    ctx.strokeStyle = PALETTE.sphere;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.arc(q.sx, q.sy, sph.radiusM * m.pxPerM * q.scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }

  function drawHull(m, geo) {
    const pts = hullOutline(payload, geo, view).map((p) => m.project(p));
    ctx.strokeStyle = PALETTE.hull;                  // the aero envelope — page-1 magenta
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.sx, q.sy) : ctx.moveTo(q.sx, q.sy)));
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  /* the RAW shape inside its envelope (owner ruling 2026-08-22 — page-1
     grammar: orange shape, magenta hull) */
  function drawLinework(m) {
    const lw = payload.linework;
    if (!lw) return;
    ctx.globalAlpha = 0.8;
    if (lw.segsM) {
      ctx.strokeStyle = PALETTE.shape;
      ctx.beginPath();
      for (let i = 0; i < lw.segsM.length; i += 6) {
        const a = m.project({ x: lw.segsM[i], y: lw.segsM[i + 1], z: lw.segsM[i + 2] });
        const b = m.project({ x: lw.segsM[i + 3], y: lw.segsM[i + 4], z: lw.segsM[i + 5] });
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
      }
      ctx.stroke();
    } else if (lw.pointsM) {
      ctx.fillStyle = PALETTE.shape;
      for (let i = 0; i < lw.pointsM.length; i += 3) {
        const q = m.project({ x: lw.pointsM[i], y: lw.pointsM[i + 1], z: lw.pointsM[i + 2] });
        ctx.fillRect(q.sx - 1, q.sy - 1, 2 * q.scale, 2 * q.scale);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* SMART-TAIL EXTRAS (owner rounds 2026-08-22): glow + guy fan. */
  function tailGeom(geo) {
    if (view === 'frontal') return null;
    const hullEnd = payload.retracted.extentM.x1M;
    const xTip = geo.extentM.x1M;
    if (!(xTip > hullEnd + 1)) return null;
    const sil = geo.silhouettes, g = sil.xGrid;
    return {
      hullEnd, xTip, g,
      hi: view === 'elevation' ? sil.yHiM : sil.zHiM,
      lo: view === 'elevation' ? sil.yLoM : sil.zLoM,
      stationAt: (x) => Math.min(g.count - 1, Math.max(0, Math.round((x - g.x0M) / g.dxM))),
      world: (x, lat) => (view === 'elevation' ? { x, y: lat, z: 0 } : { x, y: 0, z: lat }),
    };
  }

  /* NESTED FAN (owner, with the design-PDF page as reference): five stays
     per side, own anchors along the aft dome, long-outer → short-inner;
     bottom drops its outermost two, top its longest; droop 3.5% of span. */
  function guyCurves(m, t) {
    const { hullEnd, xTip, stationAt, world, hi, lo } = t;
    const L = payload.retracted.extentM.lengthM;
    const ANCHOR_FRAC = [0.18, 0.14, 0.10, 0.06, 0.02];
    const END_FRAC = [0.96, 0.80, 0.63, 0.46, 0.30];
    const TOP_IDX = [1, 2, 3, 4], BOT_IDX = [2, 3, 4];
    const sides = view === 'elevation' ? [[hi, TOP_IDX], [lo, BOT_IDX]] : [[hi, TOP_IDX], [lo, TOP_IDX]];
    const curves = [];
    for (const [side, idxs] of sides) {
      for (const i of idxs) {
        const xA = hullEnd - ANCHOR_FRAC[i] * L;
        const xg = hullEnd + END_FRAC[i] * (xTip - hullEnd);
        const aLat = side[stationAt(xA)];
        const bLat = side[stationAt(xg)];
        const sag = view === 'elevation' ? 0.035 * (xg - xA) : 0;
        curves.push({
          a: m.project(world(xA, aLat)),
          cm: m.project(world((xA + xg) / 2, (aLat + bLat) / 2 - sag)),
          b: m.project(world(xg, bLat)),
        });
      }
    }
    return curves;
  }

  /* additive glow OVER the flow — tail outline + a fainter share on the
     guys; base included (glow starts 0.2 hull-lengths before the hull end) */
  function drawTailGlow(m, geo) {
    const t = tailGeom(geo);
    if (!t) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.hull;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const s0 = t.stationAt(t.hullEnd - 0.2 * payload.retracted.extentM.lengthM);
    for (const [w, a] of [[26, 0.035], [18, 0.05], [12, 0.08], [7, 0.12], [3, 0.16]]) {
      ctx.lineWidth = w;
      ctx.globalAlpha = a;
      for (const arr of [t.hi, t.lo]) {
        ctx.beginPath();
        for (let s = s0; s < t.g.count; s++) {
          const q = m.project(t.world(t.g.x0M + s * t.g.dxM, arr[s]));
          if (s === s0) ctx.moveTo(q.sx, q.sy);
          else ctx.lineTo(q.sx, q.sy);
        }
        ctx.stroke();
      }
    }
    for (const [w, a] of [[9, 0.04], [6, 0.06], [3, 0.09], [1.5, 0.13]]) {
      ctx.lineWidth = w;
      ctx.globalAlpha = a;
      for (const c of guyCurves(m, t)) {
        ctx.beginPath();
        ctx.moveTo(c.a.sx, c.a.sy);
        ctx.quadraticCurveTo(c.cm.sx, c.cm.sy, c.b.sx, c.b.sy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTailExtras(m, geo) {
    const t = tailGeom(geo);
    if (!t) return;
    ctx.save();                                      // guy lines: ultra-thin, slight droop
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = PALETTE.shape;
    ctx.lineWidth = 0.75;
    for (const c of guyCurves(m, t)) {
      ctx.beginPath();
      ctx.moveTo(c.a.sx, c.a.sy);
      ctx.quadraticCurveTo(c.cm.sx, c.cm.sy, c.b.sx, c.b.sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticle(q, p, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.captured ? PALETTE.captured : p.wake ? PALETTE.wake : PALETTE.flow;
    const s = ((p.wake ? 3 : 4) + (p.captured ? 1 : 0)) * q.scale;
    ctx.fillRect(q.sx - s / 2, q.sy - s / 2, s, s);
    ctx.globalAlpha = 1;
  }

  /* frontal contact-weighted alpha: near-invisible approach ramp
     0.06 → 0.28, full on contact, fade downstream (owner rounds) */
  function frontalAlpha(geo, wb, x) {
    if (x < geo.extentM.x0M) {
      const t = Math.min(1, Math.max(0, (x - wb.xMinM) / (geo.extentM.x0M - wb.xMinM)));
      return 0.06 + 0.22 * t;
    }
    if (x <= geo.extentM.x1M) return 1;
    const t = (x - geo.extentM.x1M) / (wb.xMaxM - geo.extentM.x1M);
    return 1 - 0.9 * Math.min(1, t);
  }

  function insideOutline(geo, w) {
    if (view === 'frontal') return null;
    const g = geo.silhouettes.xGrid;
    const s = Math.round((w.x - g.x0M) / g.dxM);
    if (s < 0 || s >= g.count) return false;
    return view === 'elevation'
      ? w.y > geo.silhouettes.yLoM[s] && w.y < geo.silhouettes.yHiM[s]
      : w.z > geo.silhouettes.zLoM[s] && w.z < geo.silhouettes.zHiM[s];
  }

  /* VIEW SLICES: each side/plan view renders the clock slice near its
     plane; frontal shows the whole clock; captured flow exempt. */
  const SLICE_HALF_RAD = Math.PI / 6;
  function inSlice(p) {
    if (view === 'frontal') return true;
    const th = payload.grid.thetaRad[p.thetaIdx];
    const centers = view === 'elevation' ? [0, Math.PI, 2 * Math.PI] : [Math.PI / 2, (3 * Math.PI) / 2];
    return centers.some((c) => Math.abs(th - c) <= SLICE_HALF_RAD);
  }

  function paint() {
    sizeCanvas();     // sizing rides paint, not the rAF loop: correct even when rAF is suspended (hidden panes)
    if (!payload || !adapter || !(cv.width > 0)) return;
    const m = makeMapping({ view, flowAxis, payload, width: cv.width, height: cv.height });
    const c = adapter.getControls();
    const st = adapter.getState();
    const geo = activeGeo();
    ctx.clearRect(0, 0, cv.width, cv.height);

    drawSphereCircle(m, payload.spheres.sphere1);
    if (c.smartTail && payload.spheres.sphere2) drawSphereCircle(m, payload.spheres.sphere2);

    const projected = st.particles.map((p) => ({ p, w: worldPos(payload, p) }))
      .map((e) => ({ ...e, q: m.project(e.w) }));

    if (view === 'frontal') {
      const box = simBox(payload);
      const visible = projected.filter((e) => e.p.x > m.xCamM && frontalVisible(payload, geo, e.p));
      drawHull(m, geo);
      drawLinework(m);
      if (c.smartTail && payload.extended) drawTailExtras(m, geo);
      for (const e of visible.sort((a, b) => b.q.depth - a.q.depth)) {
        drawParticle(e.q, e.p, frontalAlpha(geo, box, e.p.x));
      }
      if (c.smartTail && payload.extended) drawTailGlow(m, geo);
    } else {
      drawHull(m, geo);
      drawLinework(m);
      if (c.smartTail && payload.extended) drawTailExtras(m, geo);
      for (const e of projected.filter((e) => e.p.captured || (inSlice(e.p) && !insideOutline(geo, e.w)))) {
        drawParticle(e.q, e.p);
      }
      if (c.smartTail && payload.extended) drawTailGlow(m, geo);
    }
  }

  // ---- loop: fixed-dt accumulator; rAF paints only ---------------------
  let last = performance.now(), acc = 0;
  function loop(now) {
    if (destroyed) return;
    const dtMs = now - last; last = now;
    if (adapter && !adapter.parked && !paused) {
      acc += dtMs / 1000;
      while (acc >= DT_S) { adapter.tick(DT_S); acc -= DT_S; }
    }
    if (frameTimes) {
      frameTimes.push(dtMs);
      if (now >= benchEndsAt) {
        const t = frameTimes.slice(20).sort((a, b) => a - b);
        const p95 = t[Math.floor(0.95 * t.length)];
        const mean = t.reduce((s, v) => s + v, 0) / t.length;
        benchResolve?.({ p95, mean, frames: t.length });
        frameTimes = null; benchResolve = null;
      }
    }
    paint();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function setView(v) { view = v; markView(); paint(); }
  function setFlowAxis(f) {
    flowAxis = f;
    /* M7 portrait: the narrow instrument can't seat six buttons in a
       row — both corner bars stack vertically in TB */
    viewBar.style.flexDirection = orientBar.style.flexDirection = f === 'TB' ? 'column' : 'row';
    paint();
  }
  function setPaused(p) {
    paused = p;
    pauseBtn.textContent = paused ? '▶' : '⏸';
    pauseBtn.title = paused ? 'Resume the particles' : 'Pause the particles where they are (numbers untouched)';
  }

  return {
    // payload + controls (one-way: host state → panel; nothing flows back)
    setPayload(p, opts = {}) {
      payload = p;
      if (opts.seed != null) seed = opts.seed;
      if (opts.count != null) count = opts.count;
      if (!adapter) adapter = createAdapter(p, { seed, count });
      else {
        const keep = adapter.getControls();
        adapter.setPayload(p, { seed, count });
        adapter.setControls(keep);                    // controls persist across payload swaps
      }
      if (opts.paint !== false) paint();
    },
    /* drop the payload and blank the canvas — the host shows its own
       placeholder (an upload with no payload yet must never keep drawing
       the PREVIOUS shape — caught by the owner, 2026-08-23) */
    clear() {
      payload = null;
      ctx.clearRect(0, 0, cv.width, cv.height);
    },
    setControls(partial) { adapter?.setControls(partial); },
    setView,
    setFlowAxis,
    setPaused,
    get paused() { return paused; },
    get view() { return view; },
    get payload() { return payload; },
    adapter: () => adapter,
    setOrientEnabled(on) {
      pitchBtn.disabled = yawBtn.disabled = !on;
      pitchBtn.style.opacity = yawBtn.style.opacity = on ? '' : '0.35';
    },
    /* headless drive (hidden panes suspend rAF — the known trap) */
    tick(n = 1, dt = DT_S) {
      for (let i = 0; i < n; i++) adapter?.tick(dt);
      paint();
      return adapter?.getState().simTimeS;
    },
    paint,
    benchmark(seconds = 30) {
      return new Promise((resolve) => {
        frameTimes = [];
        benchEndsAt = performance.now() + seconds * 1000;
        benchResolve = resolve;
      });
    },
    destroy() { destroyed = true; ro?.disconnect(); wrap.remove(); },
  };
}
