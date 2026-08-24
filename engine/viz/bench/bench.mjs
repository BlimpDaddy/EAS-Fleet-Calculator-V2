/**
 * BENCH HOST — since V5 step 1 (2026-08-23) the renderer lives in
 * layer3/panel.mjs (ONE renderer, two hosts: this bench and the DYNAMIC
 * page). This file is the dev apparatus around the panel: fixture
 * loading, body/seed/count controls, orientation manifest lookup, the
 * HUD, and the 30 s benchmark button. The panel's own in-rectangle
 * buttons (view + ⟳ Side / ⟳ Top / ⏸) are the PRODUCT UI and appear
 * here exactly as they will on the page.
 */
import { COUNT_MOBILE, DT_S } from '../layer2/engine.mjs';
import { createVizPanel } from '../layer3/panel.mjs';

const $ = (id) => document.getElementById(id);

/* payload cache: default file per body, plus lazily-fetched orientation
   variants (the bench stand-in for the page's regenerate-on-snap). */
const payloads = {};
for (const name of ['sunship', 'sphere', 'cube', 'cigar', 'airshipcigar', 'washingmachine']) {
  payloads[name] = await (await fetch(`../fixtures/${name}.render.json`)).json();
}
const orientations = await (await fetch('../fixtures/orientations.json')).json();
const variantCache = {};
async function payloadFor(name, file) {
  if (!file || file === `${name}.render.json`) return payloads[name];
  const url = `../fixtures/${file}`;
  if (!variantCache[url]) variantCache[url] = await (await fetch(url)).json();
  return variantCache[url];
}

/* ORIENTATION: pitch/yaw generate the full 24-rotation snap group; each
   press swaps to the baked payload for that orientation (real re-measured
   geometry). Sunship exempt: authored, composite tail nose-to-tail. */
const ROT_I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const ROT_P = [0, -1, 0, 1, 0, 0, 0, 0, 1];         // +90° about +Z (elevation plane)
const ROT_Y = [0, 0, 1, 0, 1, 0, -1, 0, 0];         // +90° about +Y (plan plane)
const rotCompose = (A, B) => {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  }
  return C;
};
let orientM = ROT_I;

const panel = createVizPanel({
  container: $('cv-host'),
  seed: Number($('seed').value),
  count: Number($('count').value),
  onOrientate: async (which) => {
    if ($('body').value === 'sunship') return;
    orientM = rotCompose(which === 'pitch' ? ROT_P : ROT_Y, orientM);
    const file = orientations[$('body').value][orientM.join(',')];
    panel.setPayload(await payloadFor($('body').value, file));
    setAxisUI();
  },
});
panel.setPayload(payloads.sunship);
panel.setControls({ smartTail: true, bli: true, selectedCd: 0.043, selectedS: 0.30 });   // ruled default load state (§7.1)

function setAxisUI() {
  const isSunship = $('body').value === 'sunship';
  panel.setOrientEnabled(!isSunship);
  $('axisLabel').textContent = isSunship ? 'orient authored'
    : (orientM.join(',') === ROT_I.join(',') ? 'orient default' : `orient ${orientations[$('body').value][orientM.join(',')]}`);
}
setAxisUI();

/* ---- bench controls --------------------------------------------------- */
const resetRun = () => panel.setPayload(panel.payload, {
  seed: Number($('seed').value), count: Number($('count').value),
});

$('v').addEventListener('input', () => {
  const kmh = Number($('v').value);
  $('vLabel').textContent = kmh > 0 ? `${kmh} km/h` : '0 km/h (PARKED)';
  panel.setControls({ airspeedMps: kmh / 3.6 });
});
$('cd').addEventListener('input', () => panel.setControls({ selectedCd: Number($('cd').value) }));
$('tail').addEventListener('input', () => panel.setControls({ smartTail: $('tail').checked }));
$('bli').addEventListener('input', () => panel.setControls({ bli: $('bli').checked }));
$('s').addEventListener('input', () => {
  $('sLabel').textContent = Number($('s').value).toFixed(2);
  panel.setControls({ selectedS: Number($('s').value) });
});
$('view').addEventListener('input', () => {
  panel.setView($('view').value);
  $('flow').disabled = $('view').value === 'frontal';
});
$('flow').addEventListener('input', () => panel.setFlowAxis($('flow').value));

$('body').addEventListener('input', () => {
  orientM = ROT_I;
  const payload = payloads[$('body').value];
  const isSunship = payload.name === 'sunship';
  /* availability is the PAGE'S rule, mirrored: Smart Tail + BLI are
     Sunship-only (owner ruling 2026-08-22). Engine stays generic. */
  $('tail').disabled = !isSunship;
  $('bli').disabled = !isSunship;
  if (!isSunship) {
    $('tail').checked = false; panel.setControls({ smartTail: false });
    $('bli').checked = false; panel.setControls({ bli: false });
  }
  panel.setPayload(payload);
  setAxisUI();
});
$('reset').addEventListener('click', resetRun);
$('count').addEventListener('change', resetRun);

/* HUD from panel getters, painted on a light interval (dev-only text) */
function hud() {
  const adapter = panel.adapter();
  const payload = panel.payload;
  if (!adapter || !payload) return;
  const c = adapter.getControls();
  const st = adapter.getState();
  const geo = c.smartTail && payload.extended ? payload.extended : payload.retracted;
  const L = geo.extentM.lengthM;
  const vMps = c.airspeedMps;
  $('hud').textContent =
    `body ${payload.name}   view ${panel.view}   state ${c.smartTail && payload.extended ? 'EXTENDED (tail)' : 'RETRACTED'}` +
    `${st.softFail ? '  SOFT-FAIL(no tail geometry)' : ''}${st.degraded ? '  DEGRADED(ineligible)' : ''}\n` +
    `L ${L.toFixed(0)} m   crossing L/v ${vMps > 0 ? (L / vMps).toFixed(1) + ' s' : '—'}   ` +
    `sim ${st.simTimeS.toFixed(1)} s   ticks ${st.stepCount}   engine calls ${adapter.stepCalls}   ` +
    `${adapter.parked ? 'PARKED (engine not consulted)' : (panel.paused ? 'PAUSED (viz only)' : 'running')}\n` +
    `Cd ${c.selectedCd}   S ${c.selectedS}${c.bli ? '' : ' (BLI off)'}   particles ${st.particles.length}   ` +
    `wake ${st.particles.filter((p) => p.wake).length}   captured ${st.particles.filter((p) => p.captured).length}`;
}
setInterval(hud, 250);

/* engineer debug handle (hidden panes suspend rAF — known trap) */
window.__bench = {
  adapter: () => panel.adapter(),
  panel,
  paint: () => panel.paint(),
  setView(v2, f2) { panel.setView(v2); if (f2) panel.setFlowAxis(f2); },
  tick(n = 1, dt = DT_S) { const t = panel.tick(n, dt); hud(); return t; },
};

$('benchBtn').addEventListener('click', async () => {
  panel.setPayload(panel.payload, { count: COUNT_MOBILE });   // the gate runs at the mobile count
  panel.setControls({ airspeedMps: 100 / 3.6 });
  $('v').value = 100; $('vLabel').textContent = '100 km/h';
  $('bench').textContent = ' running 30 s…';
  const r = await panel.benchmark(30);
  $('bench').textContent = ` p95 ${r.p95.toFixed(1)} ms, mean ${r.mean.toFixed(1)} ms over ${r.frames} frames (gate: p95 ≤ 17 ms)`;
  console.log(`BENCHMARK p95=${r.p95.toFixed(2)}ms mean=${r.mean.toFixed(2)}ms frames=${r.frames}`);
});
