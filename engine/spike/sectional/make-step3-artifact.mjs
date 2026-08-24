import fs from 'fs';
const SP = 'C:/Users/Toby/AppData/Local/Temp/claude/C--Users-Toby-Desktop-CodeEverything/f43d7c0e-d817-4e82-a2e0-166450772ca9/scratchpad/';
const rows = JSON.parse(fs.readFileSync(SP + 's3a.json', 'utf8'));
const KNOT = 0.180789;
const BASE = { extraM: 216, attach: 0.80, P: 0.8, W: 0, rTip: 0 };

const FAM = [
  { key: 'T-LEN', param: 'extraM', title: 'Deployed length', unit: 'EXTRA_M, metres beyond the 300 m envelope' },
  { key: 'T-ATT', param: 'attach', title: 'Fairing pickup', unit: 'ATTACH, fraction of envelope length' },
  { key: 'T-EXP', param: 'P', title: 'Closure law', unit: 'P, taper exponent' },
  { key: 'T-WST', param: 'W', title: 'Flare and waist', unit: 'W, mid-fairing radius perturbation' },
  { key: 'T-BAS', param: 'rTip', title: 'Terminal radius', unit: 'rTip / ra, base radius as a fraction of attach radius' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (v) => (Math.abs(v) >= 1 || v === 0 ? String(v) : String(v));

/* ---------- one small-multiple: Cd against the parameter ---------- */
function chart(fam) {
  const d = rows.filter((r) => r.param === fam.param).sort((a, b) => a.value - b.value);
  const W = 460, H = 300, L = 62, R = 18, T = 22, B = 52;
  const xs = d.map((r) => r.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yLo = 0.018, yHi = 0.5;
  const px = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const py = (v) => {
    const t = (Math.log10(Math.max(v, yLo)) - Math.log10(yLo)) / (Math.log10(yHi) - Math.log10(yLo));
    return H - B - t * (H - B - T);
  };

  let s = '';
  /* the 0.02-0.03 band */
  s += `<rect class="band" x="${L}" y="${py(0.03).toFixed(1)}" width="${W - L - R}" height="${(py(0.02) - py(0.03)).toFixed(1)}"/>`;
  /* y gridlines */
  for (const g of [0.02, 0.03, 0.05, 0.1, 0.2, 0.4]) {
    s += `<line class="grid" x1="${L}" y1="${py(g).toFixed(1)}" x2="${W - R}" y2="${py(g).toFixed(1)}"/>`;
    s += `<text class="tick" x="${L - 9}" y="${(py(g) + 3.5).toFixed(1)}" text-anchor="end">${g}</text>`;
  }
  /* segments, recoloured where the proxy crosses the knot */
  for (let i = 1; i < d.length; i++) {
    const a = d[i - 1], b = d[i];
    const crosses = (a.proxy - KNOT) * (b.proxy - KNOT) < 0;
    s += `<line class="seg${crosses ? ' seg-knot' : ''}" x1="${px(a.value).toFixed(1)}" y1="${py(a.cd).toFixed(1)}" ` +
      `x2="${px(b.value).toFixed(1)}" y2="${py(b.cd).toFixed(1)}"/>`;
    if (crosses) {
      const mx = (px(a.value) + px(b.value)) / 2, my = (py(a.cd) + py(b.cd)) / 2;
      s += `<text class="knotlab" x="${(mx + 7).toFixed(1)}" y="${(my - 6).toFixed(1)}">knot</text>`;
    }
  }
  /* points: filled = rounded, hollow ring = pinned */
  for (const r of d) {
    const isBase = Math.abs(r.value - BASE[fam.param]) < 1e-12;
    const cx = px(r.value).toFixed(1), cy = py(r.cd).toFixed(1);
    if (isBase) s += `<circle class="halo" cx="${cx}" cy="${cy}" r="8.5"/>`;
    s += r.cls === 'pinned'
      ? `<circle class="pt pinned" cx="${cx}" cy="${cy}" r="4.2"/>`
      : `<circle class="pt" cx="${cx}" cy="${cy}" r="4.2"/>`;
    if (isBase) s += `<text class="baselab" x="${cx}" y="${(py(r.cd) - 15).toFixed(1)}" text-anchor="middle">baseline</text>`;
  }
  /* x ticks: ends plus the baseline */
  const ticks = [...new Set([x0, BASE[fam.param], x1])].sort((a, b) => a - b);
  for (const t of ticks) {
    s += `<text class="tick" x="${px(t).toFixed(1)}" y="${H - B + 18}" text-anchor="middle">${fmt(t)}</text>`;
  }
  s += `<line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>`;
  s += `<text class="axlab" x="${L}" y="${H - 12}">${esc(fam.unit)}</text>`;
  s += `<text class="axlab" x="${L - 46}" y="${T - 6}">Cd</text>`;

  const inBand = d.filter((r) => r.cd >= 0.02 && r.cd < 0.03);
  const lo = Math.min(...d.map((r) => r.cd)), hi = Math.max(...d.map((r) => r.cd));
  return `<figure class="card">
  <figcaption><span class="key">${fam.key}</span><h3>${esc(fam.title)}</h3></figcaption>
  <div class="plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(fam.title)}: Cd against ${esc(fam.unit)}">${s}</svg></div>
  <dl class="facts">
    <div><dt>in band</dt><dd>${inBand.length} of ${d.length}</dd></div>
    <div><dt>Cd range</dt><dd>${lo.toFixed(5)} – ${hi.toFixed(5)}</dd></div>
    <div><dt>eligible</dt><dd>${d.filter((r) => r.elig === 'ELIGIBLE').length} of ${d.length}</dd></div>
  </dl>
</figure>`;
}

/* ---------- the synthesis: Cd against the proxy, all 36 rows ---------- */
function synthesis() {
  const W = 940, H = 400, L = 74, R = 26, T = 28, B = 62;
  const pxs = rows.map((r) => r.proxy);
  const x0 = 0.06, x1 = Math.max(...pxs) * 1.05;
  const yLo = 0.018, yHi = 0.5;
  const px = (v) => L + ((Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0))) * (W - L - R);
  const py = (v) => {
    const t = (Math.log10(Math.max(v, yLo)) - Math.log10(yLo)) / (Math.log10(yHi) - Math.log10(yLo));
    return H - B - t * (H - B - T);
  };
  let s = '';
  s += `<rect class="band" x="${L}" y="${py(0.03).toFixed(1)}" width="${W - L - R}" height="${(py(0.02) - py(0.03)).toFixed(1)}"/>`;
  for (const g of [0.02, 0.03, 0.05, 0.1, 0.2, 0.4]) {
    s += `<line class="grid" x1="${L}" y1="${py(g).toFixed(1)}" x2="${W - R}" y2="${py(g).toFixed(1)}"/>`;
    s += `<text class="tick" x="${L - 9}" y="${(py(g) + 3.5).toFixed(1)}" text-anchor="end">${g}</text>`;
  }
  for (const g of [0.06, 0.1, 0.18, 0.3, 0.5, 0.8]) {
    s += `<text class="tick" x="${px(g).toFixed(1)}" y="${H - B + 18}" text-anchor="middle">${g}</text>`;
  }
  /* the knot */
  s += `<line class="knotline" x1="${px(KNOT).toFixed(1)}" y1="${T}" x2="${px(KNOT).toFixed(1)}" y2="${H - B}"/>`;
  s += `<text class="knotlab big" x="${(px(KNOT) + 9).toFixed(1)}" y="${T + 14}">calibration knot 2 — proxy 0.180789</text>`;
  s += `<text class="knotsub" x="${(px(KNOT) + 9).toFixed(1)}" y="${T + 30}">map slope jumps 27×</text>`;
  for (const r of rows) {
    const isBase = r.label === 'T-LEN extraM=216';
    const cx = px(r.proxy).toFixed(1), cy = py(r.cd).toFixed(1);
    if (isBase) s += `<circle class="halo" cx="${cx}" cy="${cy}" r="9.5"/>`;
    s += r.cls === 'pinned'
      ? `<circle class="pt pinned" cx="${cx}" cy="${cy}" r="4"/>`
      : `<circle class="pt" cx="${cx}" cy="${cy}" r="4"/>`;
    if (isBase) {
      s += `<text class="baselab" x="${(px(r.proxy) - 10).toFixed(1)}" y="${(py(r.cd) + 4).toFixed(1)}" text-anchor="end">Sunship baseline 0.1612</text>`;
    }
  }
  s += `<line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>`;
  s += `<text class="axlab" x="${L}" y="${H - 16}">compositeV1 — the production scalar</text>`;
  s += `<text class="axlab" x="${L - 58}" y="${T - 8}">Cd</text>`;
  return `<div class="plot wide"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cd against the production scalar for all 36 rows, with calibration knot 2 marked">${s}</svg></div>`;
}

/* ---------- the summary table ---------- */
function table() {
  const band = { 'T-LEN': 'EXTRA_M 216 – 324', 'T-ATT': 'ATTACH 0.60 – 0.80', 'T-EXP': 'P 0.6 – 1.0',
    'T-WST': 'W −0.10 – +0.10', 'T-BAS': 'rTip/ra 0 – 0.28' };
  let body = '';
  for (const f of FAM) {
    const d = rows.filter((r) => r.param === f.param).sort((a, b) => a.value - b.value);
    const cds = d.map((r) => r.cd);
    const lo = Math.min(...cds), hi = Math.max(...cds);
    const at = (v) => fmt(d[cds.indexOf(v)].value);
    let flips = 0;
    for (let i = 1; i < d.length; i++) if (d[i].cls !== d[i - 1].cls) flips++;
    const worstPx = Math.max(...d.map((r) => 100 * r.dProxy));
    const inBand = d.filter((r) => r.cd >= 0.02 && r.cd < 0.03).length;
    body += `<tr>
      <th scope="row"><span class="key">${f.key}</span> ${esc(f.title)}</th>
      <td class="n">${d.length}</td>
      <td class="n">${lo.toFixed(5)}<span class="at">at ${at(lo)}</span></td>
      <td class="n">${hi.toFixed(5)}<span class="at">at ${at(hi)}</span></td>
      <td class="n">${inBand}/${d.length}</td>
      <td class="n">${d.filter((r) => r.elig === 'ELIGIBLE').length}/${d.length}</td>
      <td class="n">${flips}</td>
      <td class="n">${worstPx.toFixed(1)}%</td>
      <td>${esc(band[f.key])}</td>
    </tr>`;
  }
  return `<div class="tablewrap"><table>
    <thead><tr>
      <th scope="col">family</th><th scope="col">n</th><th scope="col">Cd min</th><th scope="col">Cd max</th>
      <th scope="col">in band</th><th scope="col">eligible</th><th scope="col">flips</th>
      <th scope="col">worst Δproxy</th><th scope="col">contiguous run through baseline</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

const html = `<title>Smart Tail Response Basin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
:root{
  --paper:#f4f6f8; --ground:#ffffff; --ink:#0d1418; --ink-2:#44535d; --ink-3:#7a8892;
  --rule:#dde3e8; --rule-2:#eaeef1;
  --band:#0d6f68; --band-fill:rgba(13,111,104,.11);
  --knot:#a8501b; --knot-fill:rgba(168,80,27,.10);
  --shadow:0 1px 2px rgba(13,20,24,.05), 0 8px 24px rgba(13,20,24,.05);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#0b1014; --ground:#131b21; --ink:#e7edf1; --ink-2:#9db0bb; --ink-3:#6c7d88;
    --rule:#24303a; --rule-2:#1b242c;
    --band:#45b8ab; --band-fill:rgba(69,184,171,.13);
    --knot:#df9257; --knot-fill:rgba(223,146,87,.13);
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"]{
  --paper:#0b1014; --ground:#131b21; --ink:#e7edf1; --ink-2:#9db0bb; --ink-3:#6c7d88;
  --rule:#24303a; --rule-2:#1b242c;
  --band:#45b8ab; --band-fill:rgba(69,184,171,.13);
  --knot:#df9257; --knot-fill:rgba(223,146,87,.13);
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;
  font-size:16px; line-height:1.6; -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1040px; margin:0 auto; padding:56px 24px 88px; display:flex; flex-direction:column; gap:44px}
header{display:flex; flex-direction:column; gap:18px}
.eyebrow{
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:12px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ink-3);
}
h1{
  margin:0; font-size:clamp(30px,4.4vw,46px); line-height:1.1; font-weight:600;
  letter-spacing:-.02em; text-wrap:balance; max-width:22ch;
}
.standfirst{margin:0; max-width:62ch; color:var(--ink-2); font-size:18px}
.verdict{
  border-left:3px solid var(--band); padding:14px 0 14px 20px; margin:0;
  font-size:19px; max-width:60ch; text-wrap:pretty;
}
.verdict strong{font-weight:600}
h2{
  margin:0 0 4px; font-size:13px; font-family:"IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.13em; text-transform:uppercase; color:var(--ink-3); font-weight:500;
}
section{display:flex; flex-direction:column; gap:18px}
p{margin:0; max-width:66ch; color:var(--ink-2)}
p.lead{color:var(--ink)}
.grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:20px}
.card{
  margin:0; background:var(--ground); border:1px solid var(--rule); border-radius:4px;
  padding:18px 18px 14px; display:flex; flex-direction:column; gap:12px; box-shadow:var(--shadow);
}
figcaption{display:flex; align-items:baseline; gap:10px}
.card h3{margin:0; font-size:17px; font-weight:600; letter-spacing:-.01em}
.key{
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:11px; font-weight:500;
  letter-spacing:.09em; color:var(--ink-3); border:1px solid var(--rule); border-radius:3px;
  padding:2px 6px;
}
.plot{overflow-x:auto}
.plot svg{display:block; width:100%; height:auto; min-width:300px}
.plot.wide svg{min-width:660px}
.facts{
  display:flex; gap:22px; margin:0; padding-top:10px; border-top:1px solid var(--rule-2);
  flex-wrap:wrap;
}
.facts div{display:flex; flex-direction:column; gap:1px}
.facts dt{font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3)}
.facts dd{
  margin:0; font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:13px;
  font-variant-numeric:tabular-nums; color:var(--ink);
}
.band{fill:var(--band-fill)}
.grid line, line.grid{stroke:var(--rule); stroke-width:1}
.axis{stroke:var(--rule); stroke-width:1}
.seg{stroke:var(--ink-2); stroke-width:1.6; fill:none}
.seg-knot{stroke:var(--knot); stroke-width:2.4; stroke-dasharray:5 3}
.knotline{stroke:var(--knot); stroke-width:1.6; stroke-dasharray:5 4}
.pt{fill:var(--ink); stroke:var(--ground); stroke-width:1.2}
.pt.pinned{fill:var(--ground); stroke:var(--ink); stroke-width:2}
.halo{fill:none; stroke:var(--band); stroke-width:2}
text{font-family:"IBM Plex Mono",ui-monospace,monospace; font-variant-numeric:tabular-nums}
.tick{font-size:11px; fill:var(--ink-3)}
.axlab{font-size:11px; fill:var(--ink-3); letter-spacing:.05em}
.baselab{font-size:11px; fill:var(--band); font-weight:600; font-family:"IBM Plex Sans",sans-serif}
.knotlab{font-size:11px; fill:var(--knot); font-weight:600; font-family:"IBM Plex Sans",sans-serif}
.knotlab.big{font-size:13px}
.knotsub{font-size:11px; fill:var(--ink-3); font-family:"IBM Plex Sans",sans-serif}
.tablewrap{overflow-x:auto; background:var(--ground); border:1px solid var(--rule); border-radius:4px; box-shadow:var(--shadow)}
table{border-collapse:collapse; width:100%; min-width:820px; font-size:14px}
th,td{text-align:left; padding:11px 14px; border-bottom:1px solid var(--rule-2)}
thead th{
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:11px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--ink-3); font-weight:500; border-bottom:1px solid var(--rule);
}
tbody th{font-weight:500; white-space:nowrap}
tbody tr:last-child th, tbody tr:last-child td{border-bottom:none}
td.n{font-family:"IBM Plex Mono",ui-monospace,monospace; font-variant-numeric:tabular-nums; white-space:nowrap}
.at{display:block; font-size:11px; color:var(--ink-3)}
.legend{display:flex; gap:20px; flex-wrap:wrap; font-size:13px; color:var(--ink-2); align-items:center}
.legend span{display:inline-flex; align-items:center; gap:7px}
.sw{width:13px; height:13px; border-radius:50%; display:inline-block}
.sw.round{background:var(--ink)}
.sw.pin{background:var(--ground); border:2px solid var(--ink)}
.sw.bandsw{border-radius:2px; background:var(--band-fill); border:1px solid var(--band)}
.sw.knotsw{border-radius:2px; background:var(--knot); height:3px; width:16px}
.cautions{display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px}
.caution{
  background:var(--ground); border:1px solid var(--rule); border-top:3px solid var(--knot);
  border-radius:4px; padding:20px; display:flex; flex-direction:column; gap:10px; box-shadow:var(--shadow);
}
.caution h3{margin:0; font-size:17px; font-weight:600; letter-spacing:-.01em}
.caution p{font-size:15px}
.gates{display:flex; flex-wrap:wrap; gap:8px}
.gate{
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:12px; padding:5px 10px;
  border:1px solid var(--rule); border-radius:3px; background:var(--ground); color:var(--ink-2);
}
.gate b{color:var(--band); font-weight:600}
footer{
  border-top:1px solid var(--rule); padding-top:22px; color:var(--ink-3); font-size:13px;
  display:flex; flex-direction:column; gap:6px;
}
footer code{font-family:"IBM Plex Mono",ui-monospace,monospace; color:var(--ink-2)}
@media (prefers-reduced-motion:reduce){*{animation:none!important; transition:none!important}}
</style>

<div class="wrap">
<header>
  <div class="eyebrow">Step 3 · spec 84–85 · 2026-08-21</div>
  <h1>Is the Sunship Smart Tail a basin or a knife-edge?</h1>
  <p class="standfirst">Five one-at-a-time sweeps around the authored Smart Tail surrogate, 32 distinct
  variants, run through the frozen production estimator. No calibration was read or written and no
  aerodynamic direction was pre-registered.</p>
  <p class="verdict"><strong>A basin.</strong> 19 of 32 variants land in Cd 0.02–0.03, and every one of the
  five families holds a contiguous in-band run straight through the baseline. But the basin's upper edge
  is not geometry — it is a calibration knot.</p>
  <div class="gates">
    <span class="gate">G0 refactor identity <b>byte-for-byte</b></span>
    <span class="gate">G0b one engine <b>pass</b></span>
    <span class="gate">S1 determinism <b>pass</b></span>
    <span class="gate">A5 frozen path <b>pass</b></span>
    <span class="gate">Cd ≠ f(ribbons) <b>36/36</b></span>
    <span class="gate">eligible <b>32/32</b></span>
  </div>
</header>

<section>
  <h2>The five curves</h2>
  <p class="lead">Cd on a log axis against each parameter. The tinted band is 0.02–0.03. A ringed point is
  the baseline; a hollow point is classified <em>pinned</em> rather than <em>rounded</em>. A dashed
  segment is where that step crosses calibration knot 2.</p>
  <div class="legend">
    <span><i class="sw round"></i>rounded</span>
    <span><i class="sw pin"></i>pinned</span>
    <span><i class="sw bandsw"></i>Cd 0.02–0.03</span>
    <span><i class="sw knotsw"></i>crosses the knot</span>
  </div>
  <div class="grid">
${FAM.map(chart).join('\n')}
  </div>
</section>

<section>
  <h2>Summary</h2>
  ${table()}
</section>

<section>
  <h2>Why every cliff is the same cliff</h2>
  <p class="lead">Plotting all 36 rows against the scalar they are scored from collapses the five families
  onto one curve — and the elbow sits exactly at the knot. The frozen pressure map is piecewise-linear in
  the proxy, and its slope jumps from 0.02617 to 0.70888 at proxy 0.180789. Every large Cd step in this
  experiment is a row crossing that line.</p>
  ${synthesis()}
  <div class="cautions">
    <div class="caution">
      <h3>The basin's edge is a calibration feature</h3>
      <p>The baseline sits at proxy 0.161170 — 10.9% below the knot. A modest geometry change that pushes
      the proxy past 0.180789 produces a disproportionate Cd jump, because the map is 27× steeper on the
      far side. This is the same knot spec 81.4 already flagged for a 3.3% provenance discrepancy: it
      computes 0.186851 through the harness path while <em>being</em> the knot at 0.180789. Nothing was
      moved.</p>
    </div>
    <div class="caution">
      <h3>The baseline is not the best-supported point</h3>
      <p>At the baseline the authored and hulled representations differ by 40.3% in proxy while Cd moves
      7.5% — spec 78.4's “most dangerous” case, where agreement is a property of a flat map region rather
      than of the geometry. Every earlier fairing pickup (ATTACH 0.60–0.75) scores 6.6–7.8% <em>lower</em>
      on robust geometry, Δproxy 0.0–4.9%, within the same class.</p>
    </div>
  </div>
</section>

<section>
  <h2>The prediction that was frozen first</h2>
  <p class="lead">Before the terminal-radius family was built, the classifier crossing was pre-registered
  between rTip/ra 0.20 and 0.28, derived from the frozen threshold: a base trips it once rTip exceeds
  rMax·√TAU = 25.27 m = 0.2751 ra. It flipped exactly there, fired by trigger (b), terminal base 0.0574
  against TAU 0.05. The measured base fraction runs 10.8% above analytic — the same fixed-cell raster
  over-count recorded in spec 83.3, at the same magnitude, in a second independent family.</p>
</section>

<footer>
  <div>Estimator-response experiment, not aerodynamic validation. No statement about the real drag of any
  shape follows from it.</div>
  <div>Production byte-untouched at <code>12e8c5e</code> · engine fingerprint identical before and after the
  run · <code>CalcV2</code> spec 85</div>
</footer>
</div>
`;

fs.writeFileSync(SP + 'smart-tail-basin.html', html);
console.log('wrote smart-tail-basin.html', html.length, 'bytes');
