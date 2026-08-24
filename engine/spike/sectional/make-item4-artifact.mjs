/**
 * ITEM 4 deliverable page — the corpus in one picture. Reads item4-run1.json.
 * Key plot: canonical pressure residual vs scalar, with BOTH frozen
 * calibration lines drawn under the points (90.3 plot 1, R3 labelling).
 * Companion: measured total vs predicted total (the least assumption-laden
 * check, 90.7 R3). Writes item4-corpus.html.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CALIBRATION_KNOTS, ROUNDED_KNOTS } from '../../../site/calcv2/src/cdEstimator.js';

const rows = JSON.parse(readFileSync('item4-run1.json', 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FAM = {
  'streamlined BoR': { c: 'var(--f-stream)', label: 'streamlined BoR (TN-614, Akron, 451)' },
  'streamlined BoR (stern pair)': { c: 'var(--f-stream)', skipLegend: true },
  'C-class fineness sweep': { c: 'var(--f-fat)', label: 'prolate fat bodies (TR-291)' },
  'ellipsoid (crisis-class)': { c: 'var(--f-ell)', label: 'Göttingen ellipsoids (virgin, now spent)' },
  'airship (complete, appendaged)': { c: 'var(--f-air)', label: 'real airships, appendaged (TR-397)' },
  'bluff (crisis-class)': { c: 'var(--f-bluff)', label: 'anchors: sphere, cube, plate' },
  'bluff (pinned)': { c: 'var(--f-bluff)', skipLegend: true },
  'Series 58 (water)': { c: 'var(--f-s58)', label: 'Series 58 (water, ordering only)' },
  'section-shape pair': { c: 'var(--f-s58)', skipLegend: true },
};
const colorOf = (r) => (FAM[r.family] || { c: 'var(--ink-3)' }).c;

/* ---------------- plot 1: residual vs proxy ---------------- */
function plot1() {
  const W = 960, H = 520, L = 70, R = 24, T = 26, B = 58;
  const x0 = 0.008, x1 = 1.15, yF = 5e-4, y1 = 1.6;
  const px = (v) => L + ((Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0))) * (W - L - R);
  const py = (v) => {
    const t = (Math.log10(Math.max(v, yF)) - Math.log10(yF)) / (Math.log10(y1) - Math.log10(yF));
    return H - B - t * (H - B - T);
  };
  let s = '';
  for (const g of [0.001, 0.01, 0.1, 1]) {
    s += `<line class="grid" x1="${L}" y1="${py(g).toFixed(1)}" x2="${W - R}" y2="${py(g).toFixed(1)}"/>`;
    s += `<text class="tick" x="${L - 8}" y="${(py(g) + 3.5).toFixed(1)}" text-anchor="end">${g}</text>`;
  }
  for (const g of [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]) {
    s += `<text class="tick" x="${px(g).toFixed(1)}" y="${H - B + 17}" text-anchor="middle">${g}</text>`;
  }
  /* the two frozen lines, sampled linearly then drawn in log space */
  const line = (knots, cls) => {
    const pts = [];
    for (let i = 0; i + 1 < knots.length; i++) {
      for (let t = 0; t <= 24; t++) {
        const p = knots[i][0] + ((knots[i + 1][0] - knots[i][0]) * t) / 24;
        const v = knots[i][1] + ((knots[i + 1][1] - knots[i][1]) * t) / 24;
        if (p >= x0 && v > 0) pts.push(`${px(p).toFixed(1)},${py(v).toFixed(1)}`);
      }
    }
    return `<polyline class="${cls}" points="${pts.join(' ')}"/>`;
  };
  s += line(CALIBRATION_KNOTS, 'mapline pinnedline');
  s += line(ROUNDED_KNOTS, 'mapline roundedline');
  s += `<line class="knotline" x1="${px(0.180789).toFixed(1)}" y1="${T}" x2="${px(0.180789).toFixed(1)}" y2="${H - B}"/>`;
  s += `<text class="knotlab" x="${(px(0.180789) + 7).toFixed(1)}" y="${T + 13}">knot 2 — the 27× elbow</text>`;

  const CALL = new Set(['GOTT-oblate', 'GOTT-prolate', 'TR291-fr1.00', 'TR291-fr2.00', 'TN614-332', 'TN614-111', 'sphere', 'TR432-Akron', 'cube']);
  for (const r of rows) {
    if (r.residualCanon === null || r.residualCanon === undefined) continue;
    const cx = px(r.proxy).toFixed(1);
    const below = r.residualCanon < yF;
    const cy = py(Math.max(r.residualCanon, yF)).toFixed(1);
    const c = colorOf(r);
    s += below
      ? `<path class="ptp" d="M ${cx} ${cy} m -5 -4 l 10 0 l -5 8 z" fill="${c}"/>`
      : `<circle class="ptc" cx="${cx}" cy="${cy}" r="4.6" fill="${c}"/>`;
    if (CALL.has(r.id)) {
      const dy = r.id === 'GOTT-prolate' || r.id === 'TN614-111' ? 16 : -9;
      s += `<text class="call" x="${cx}" y="${(Number(cy) + dy).toFixed(1)}" text-anchor="middle">${esc(r.id.replace('TN614-', '614-').replace('TR291-fr', 'C-'))}</text>`;
    }
  }
  s += `<line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>`;
  s += `<text class="axlab" x="${L}" y="${H - 14}">compositeV1 — the production scalar (log)</text>`;
  s += `<text class="axlab" x="${L - 54}" y="${T - 8}">canonical pressure residual = measured total − ITTC friction at test Re (log; ▼ = at or below 5e-4)</text>`;
  return s;
}

/* ---------------- plot 2: measured vs predicted total ---------------- */
function plot2() {
  const W = 460, H = 430, L = 64, R = 18, T = 24, B = 56;
  const lo = 0.03, hi = 1.6;
  const p = (v) => (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  const px = (v) => L + p(v) * (W - L - R), py = (v) => H - B - p(v) * (H - B - T);
  let s = `<line class="diag" x1="${px(lo)}" y1="${py(lo)}" x2="${px(hi)}" y2="${py(hi)}"/>`;
  for (const g of [0.05, 0.1, 0.2, 0.5, 1]) {
    s += `<text class="tick" x="${px(g).toFixed(1)}" y="${H - B + 17}" text-anchor="middle">${g}</text>`;
    s += `<text class="tick" x="${L - 8}" y="${(py(g) + 3.5).toFixed(1)}" text-anchor="end">${g}</text>`;
    s += `<line class="grid" x1="${L}" y1="${py(g).toFixed(1)}" x2="${W - R}" y2="${py(g).toFixed(1)}"/>`;
  }
  for (const r of rows) {
    if (!r.measTotal) continue;
    s += `<circle class="ptc" cx="${px(Math.min(Math.max(r.cdPred, lo), hi)).toFixed(1)}" cy="${py(Math.min(Math.max(r.measTotal, lo), hi)).toFixed(1)}" r="4.2" fill="${colorOf(r)}"/>`;
  }
  s += `<line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>`;
  s += `<text class="axlab" x="${L}" y="${H - 14}">predicted total Cd (incl. real-skin allowance)</text>`;
  s += `<text class="axlab" x="${L - 48}" y="${T - 6}">measured total Cd</text>`;
  return s;
}

const legend = Object.values(FAM).filter((f) => !f.skipLegend)
  .map((f) => `<span><i class="sw" style="background:${f.c}"></i>${esc(f.label)}</span>`).join('');

const html = `<title>The Corpus and the Two Lines</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
:root{
  --paper:#f4f6f8; --ground:#ffffff; --ink:#0d1418; --ink-2:#44535d; --ink-3:#7a8892;
  --rule:#dde3e8; --rule-2:#eaeef1; --accent:#0d6f68; --warn:#a8501b;
  --f-stream:#0d6f68; --f-fat:#a8501b; --f-ell:#7b3fa0; --f-air:#3a6ea5; --f-bluff:#5c6670; --f-s58:#b8bec4;
  --shadow:0 1px 2px rgba(13,20,24,.05), 0 8px 24px rgba(13,20,24,.05);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#0b1014; --ground:#131b21; --ink:#e7edf1; --ink-2:#9db0bb; --ink-3:#6c7d88;
    --rule:#24303a; --rule-2:#1b242c; --accent:#45b8ab; --warn:#df9257;
    --f-stream:#45b8ab; --f-fat:#df9257; --f-ell:#c08ae0; --f-air:#7aa7d9; --f-bluff:#8b98a3; --f-s58:#3d4a55;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"]{
  --paper:#0b1014; --ground:#131b21; --ink:#e7edf1; --ink-2:#9db0bb; --ink-3:#6c7d88;
  --rule:#24303a; --rule-2:#1b242c; --accent:#45b8ab; --warn:#df9257;
  --f-stream:#45b8ab; --f-fat:#df9257; --f-ell:#c08ae0; --f-air:#7aa7d9; --f-bluff:#8b98a3; --f-s58:#3d4a55;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1060px;margin:0 auto;padding:56px 24px 88px;display:flex;flex-direction:column;gap:40px}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
h1{margin:0;font-size:clamp(29px,4.2vw,44px);line-height:1.12;font-weight:600;letter-spacing:-.02em;text-wrap:balance;max-width:24ch}
.standfirst{margin:0;max-width:64ch;color:var(--ink-2);font-size:18px}
.verdict{border-left:3px solid var(--warn);padding:13px 0 13px 20px;margin:0;font-size:19px;max-width:62ch;text-wrap:pretty}
h2{margin:0 0 2px;font-size:13px;font-family:"IBM Plex Mono",monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3);font-weight:500}
header,section{display:flex;flex-direction:column;gap:16px}
p{margin:0;max-width:68ch;color:var(--ink-2)}
p.lead{color:var(--ink)}
.card{background:var(--ground);border:1px solid var(--rule);border-radius:4px;padding:18px;box-shadow:var(--shadow)}
.plot{overflow-x:auto}
.plot svg{display:block;width:100%;height:auto;min-width:640px}
.plot.small svg{min-width:360px}
.grid{stroke:var(--rule);stroke-width:1}
.axis{stroke:var(--rule);stroke-width:1}
.diag{stroke:var(--ink-3);stroke-width:1;stroke-dasharray:4 4}
.mapline{fill:none;stroke-width:2}
.roundedline{stroke:var(--accent)}
.pinnedline{stroke:var(--ink-3);stroke-dasharray:6 4}
.knotline{stroke:var(--warn);stroke-width:1.4;stroke-dasharray:5 4}
.ptc{stroke:var(--ground);stroke-width:1.1}
text{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
.tick{font-size:11px;fill:var(--ink-3)}
.axlab{font-size:11px;fill:var(--ink-3);letter-spacing:.04em}
.call{font-size:11px;fill:var(--ink);font-family:"IBM Plex Sans",sans-serif;font-weight:600}
.knotlab{font-size:12px;fill:var(--warn);font-weight:600;font-family:"IBM Plex Sans",sans-serif}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink-2);align-items:center}
.legend span{display:inline-flex;align-items:center;gap:7px}
.sw{width:12px;height:12px;border-radius:50%;display:inline-block}
.lswatch{width:22px;height:0;border-top:2px solid var(--accent);display:inline-block}
.lswatch.pin{border-top:2px dashed var(--ink-3)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:820px){.two{grid-template-columns:1fr}}
.note{font-size:14px;color:var(--ink-3);max-width:70ch}
.qgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.q{background:var(--ground);border:1px solid var(--rule);border-top:3px solid var(--accent);border-radius:4px;padding:18px;box-shadow:var(--shadow)}
.q h3{margin:0 0 8px;font-size:16px;font-weight:600}
.q p{font-size:14.5px}
.q.warn{border-top-color:var(--warn)}
footer{border-top:1px solid var(--rule);padding-top:20px;color:var(--ink-3);font-size:13px;display:flex;flex-direction:column;gap:5px}
footer code{font-family:"IBM Plex Mono",monospace;color:var(--ink-2)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Item 4 · spec 90–91 · 55 bodies · 2026-08-21</div>
  <h1>Does the drag map fit the historical record?</h1>
  <p class="standfirst">Every body in the repository with real aerodynamic evidence, rescored through one
  frozen pipeline under one declared convention. The Göttingen ellipsoids were revealed against
  predictions committed first. Nothing was recalibrated while looking.</p>
  <p class="verdict"><strong>The map is not merely sparse — it is being contradicted in both
  directions at once.</strong> Streamlined bodies sit on it; prolate fat bodies sit 4.7–9.9× below it;
  the oblate ellipsoid sits 24% above it. One proxy→pressure law is pricing at least three
  aerodynamic families.</p>
</header>

<section>
  <h2>The key plot</h2>
  <p class="lead">Canonical pressure residual (measured total − ITTC friction at the body's own test
  Reynolds — a model-equivalent quantity, not "measured pressure Cd") against the production scalar.
  The solid line is the frozen rounded map; the dashed line is the pinned map.</p>
  <div class="legend">${legend}
    <span><i class="lswatch"></i>rounded line</span><span><i class="lswatch pin"></i>pinned line</span></div>
  <figure class="card plot"><svg viewBox="0 0 960 520" role="img" aria-label="Canonical pressure residual against the production scalar for 30 measured bodies, with both frozen calibration lines">${plot1()}</svg></figure>
  <p class="note">Triangles are residuals at or below 5·10⁻⁴ — including Akron, whose measured total is
  explained almost entirely by the friction convention (residual 0.0002), the case that shows why this
  quantity must not be called "measured pressure".</p>
</section>

<section>
  <div class="two">
    <div>
      <h2>Companion — the raw reality check</h2>
      <figure class="card plot small"><svg viewBox="0 0 460 430" role="img" aria-label="Measured total Cd against predicted total Cd">${plot2()}</svg></figure>
      <p class="note">Predicted totals include the estimator's real-fabric-skin allowance
      (ks = 0.43 mm) — sized for a 300 m vehicle and dominant on 1 m polished models, which is why
      the streamlined models sit above the diagonal by design. Verified in source, declared, not a defect.</p>
    </div>
    <div>
      <h2>The six frozen questions</h2>
      <div class="qgrid" style="grid-template-columns:1fr">
        <div class="q warn"><h3>Q1 — one smooth relationship? No.</h3><p>Same-proxy bodies differ in residual by an order of magnitude. TN-614 non-knots land within 15% of the line; C-class and the virgin prolate land 4.7–9.9× under it.</p></div>
        <div class="q warn"><h3>Q2 — distinct families? Yes, opposite signs.</h3><p>Prolate fat bodies far below the line, the oblate above it, streamlined on it. No single curve can satisfy points that disagree about its sign.</p></div>
        <div class="q"><h3>Q3 — do ribbons explain the scatter? Partially.</h3><p>Oblate/prolate residuals differ 14.5× where the scalar separates 1.5×; F2a spreads 2.1× — better, still short. A4 fires on exactly the two square bodies in the corpus. Family identity explains the split best.</p></div>
        <div class="q"><h3>Q4 — do warnings track error? On pressure, yes.</h3><p>Every 4.7–9.9× miss is a REDUCED-confidence row; SUPPORTED rows sit within ~±20%.</p></div>
        <div class="q warn"><h3>Q5 — is the mid-map gap real? Worse than sparse.</h3><p>The 0.18–0.82 span had zero measured anchors. Ten-plus corpus bodies now populate it — and split by family rather than scattering around the line.</p></div>
        <div class="q"><h3>Q6 — new anchors available? None cleanly.</h3><p>The Göttingen pair is drag-crisis-adjacent Re; TR-291 is permanently barred; TR-397 is appendaged and traced. The high-Re mid-map desert remains, and saying so is the deliverable.</p></div>
      </div>
    </div>
  </div>
</section>

<footer>
  <div>Estimator-response evidence, not aerodynamic validation. The interpretation ruling — smoother
  global curve, family-specific mappings, or analogue interpolation — is taken separately from this page.</div>
  <div>Blind gate held (Göttingen predictions committed at <code>5b0080a</code> before the join) ·
  determinism pass · engine byte-identical before and after · production untouched at <code>12e8c5e</code> · spec 91</div>
</footer>
</div>
`;
writeFileSync('item4-corpus.html', html);
console.log('wrote item4-corpus.html', html.length, 'bytes');
