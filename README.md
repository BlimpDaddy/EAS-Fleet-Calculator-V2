# EAS Fleet Calculator

**The live calculator behind [electricairshipping.com](https://www.electricairshipping.com) —
[calc.electricairshipping.com](https://calc.electricairshipping.com)**

An airship design calculator. You pick (or upload) a hull shape, size it, fly it,
build a fleet from it, and find out whether the economics work — with the tool
arguing honestly at every step about what it does and doesn't know.

Its stance is *"beat us with your own shape"*: drop in your own `.obj` and it will
measure and price it with exactly the same machinery it uses on the Sunship.

This repo is the calculator's home from **v2.0** onward. The v1 line (through
v1.8) lives in [EAS-Fleet-Calculator](https://github.com/BlimpDaddy/EAS-Fleet-Calculator),
kept intact as the provenance record and rollback line.

---

## Repo layout

```
site/     the deployed tree — Cloudflare Pages serves exactly this folder, nothing else
engine/   the headless engine's development home — sources, dev bench, gate suites,
          payload runner, research lab. site/calcv2 is BAKED from this (see below)
tools/    dev scripts: local server, engine bake, release gate, sync
test/     fixtures (plain Node, zero dependencies)
```

Everything a visitor's browser can fetch is inside `site/`; everything outside it
exists only for development and release checks.

## Run it locally

You need [Node](https://nodejs.org) (built on v24; anything modern works).
**There are no dependencies to install — no `npm install`, nothing to build.**

```bash
node tools/serve.mjs
```

Then open <http://localhost:5179/>. On Windows you can double-click
**`START CALCULATOR.bat`** instead.

That's it. The server is a ~70-line static file server whose only job is to mimic
Cloudflare Pages' SPA fallback so client-side routes like `/fleet` resolve.

### Run the tests

```bash
node test/dynamic-state-fixtures.mjs    # UI-boundary fixtures (state/display rules)
node test/economics-fixtures.mjs        # economics model
node tools/gate-calcv2.mjs              # the full release gate (see below)
```

---

## The five pages, and how they chain

Each page's outputs feed the next, and **never the other way** — earlier pages
never repaint when a later one changes.

```
SHAPE      geometry → convex hull → exact minimum bounding sphere → Monte-Carlo VS∞
           out: VS, VS∞, VE%
             ↓
SHIP        ├─ STATICS   size + internal temperature → NET LIFT
            └─ DYNAMICS  Cd × system credit × airspeed → drag → power → LH2 + storage
             ↓
FLEET      trip distance + utilisation + market → ships required, CO₂ displaced
             ↓
ECONOMIC   freight rate + carbon price + capex/opex → revenue, profit, breakeven
```

### The flow visualizer (new in V2)

The DYNAMICS page carries a wind-tunnel-style instrument: the selected hull —
preset or your own upload — rendered as measured orthogonal projections (side /
top / nose-on) with a rule-based particle flow read driven by the page's own
controls. Airspeed, Cd, Smart Tail and BLI all show their story visually.

Two rules define it, and both are structural, not stylistic:

- **One-way.** The page's controls feed the visualizer; the visualizer feeds
  **nothing** back. It cannot change a number anywhere in the calculator — its
  output type is pixels. Numerical code imports nothing from it (gated by an
  import-graph fixture).
- **Honest geometry.** Everything drawn is measured from the same canonical hull
  the calculator prices. Uploads are measured in-browser by a worker running the
  same sealed generator; the 90° orientation buttons *re-measure*, they never
  just rotate pixels. Shapes the low-order flow model can't honestly handle run
  a visibly degraded path rather than a pretty guess.

---

## How the code is arranged (the one thing to understand)

This repo contains a calculator whose **original bundle cannot be edited**.

`site/main.js` is the minified production build of the first version of this app,
by its original author; the readable source doesn't exist here. Rather than fork
or reverse it, everything new is added as **adapters**: ES modules in `site/v2/`
that select the existing DOM, read its outputs, and push values back through *its
own* input pathways (set `.value`, dispatch `input`) — exactly as a user's
interaction would.

**`main.js` is byte-identical to the version first mirrored in the v1 repo, and
the release gate asserts its SHA-256 on every build.** If you're auditing one
thing, audit that.

```
site/
  index.html          the page shell (V1's markup + our <script type="module"> tags)
  style.css           V1's hand-authored stylesheet
  main.js             V1's minified bundle — NEVER EDITED (hash-guarded)
  main.js.sha256      the guard's expected hash
  _headers            Cloudflare cache rules (no-cache HTML/JS — see the file's header
                      for the incident that made this mandatory)
  _redirects          SPA fallback

  v2/                 the adapter layer — everything new lives here
    shape-upload.js     .obj/.glb upload + live shape measurement
    viewer3d.js         3D viewer (a parameter-for-parameter replica of V1's renderer)
    dynamic-state.js    PURE state/display module for the DYNAMICS page (engine injected)
    dynamic-page.js     DYNAMICS DOM — computes nothing itself
    dynamic-viz.js      mounts the flow visualizer, one-way push from page state
    ship-split.js       the STATICS ⇄ DYNAMICS split, chooser and nav semantics
    fleet-routes.js     the rotating world-routes globe
    route-data.js       generated ocean-clean city pairs (see its header for the rules)
    fleet-results-relabel.js  fleet/economic result labels + cross-page warning flags
    geometry-warnings.js      rectilinear / directionality / no-lift screens
    economics.js        pure economics model (takes net lift, returns money)
    revenue.js          economics page DOM + the COPY SUMMARY
    mobile.js           ALL phone layout + tap-to-reveal (scoped to ≤768px)
    *-config.js         the numbers a human is meant to edit (thresholds, CO₂, rates)

  calcv2/             BAKED COPY of the headless engine — do not hand-edit
    src/                shape metrics, dynamics, and the drag-coefficient estimator
    viz/                the visualizer: payload generator, flow engine, renderer, fixtures
    spike/sectional/    the ribbon machinery's pure closure (browser-safed at bake time)

engine/
  src/                the headless engine sources (canonical)
  viz/                the visualizer: payload generator, flow engine, renderer,
                      the dev bench, the four gate suites, the payload runner
  spike/sectional/    the ribbon machinery — research programme + frozen modules
  lab/, test/         research harnesses and the engine's own fixture suites

test/                 fixtures (plain node, zero deps)
tools/
  serve.mjs           the local mirror server
  bake-calcv2.mjs     bakes engine/ into site/calcv2/
  gate-calcv2.mjs     the release gate
  sync-site.mjs       dev-machine sync scripts (transitional — see their headers)
  sync-engine.mjs
```

### Where the physics actually lives

`site/calcv2/` is a **baked copy** of the headless library in `engine/` — the
shippable subset (dev bench and gate suites excluded), copied byte-identically
with two mechanical, hash-verified transforms. The engine has no DOM and no
dependencies, so every number it produces is testable in plain Node. It holds the
shape metrics (VS/VS∞/VE), the dynamics model (drag → power → fuel), and a
low-order **sectional geometric drag-coefficient estimator** that measures a
hull's own blockage profile, classifies how it separates, and prices it against
real historical wind-tunnel data (NACA TN-614, TR-432 *Akron*, 1923 Göttingen
ellipsoids).

That estimator **proposes** a Cd; the slider always **disposes**. Cd and the
system credit are declared inputs with an estimate offered, never outputs of a
flow solver — that distinction is deliberate and is enforced throughout the UI
copy. The visualizer inherits the same split: it *draws* the story of the
selected numbers, it never generates them.

### The release gate

`node tools/gate-calcv2.mjs` runs the checks that must pass before anything
deploys: `main.js` hash unchanged (before *and* after baking) → bake →
byte-parity sweep of the baked engine → every fixture suite against **both** the
source and baked engines → and a guard that the bake touched *only*
`site/calcv2/` paths. The engine carries its own fixture suites in
`engine/test/` and the visualizer's four gate suites in `engine/viz/test/`;
this gate proves the copy that ships is the engine that passed them.

## Deployment

Cloudflare Pages, git-connected: build command **none**, root directory
**`site/`**. Push to `main` is live in about a minute. `site/_headers` carries
the cache rules that keep returning browsers off stale physics — read its
header comment before touching it. The post-deploy check is always by
**content, not status code** (the SPA fallback answers 200 for everything):
verify live *numbers* against the local mirror.

---

## Conventions you'll notice while reading

- **Comments explain *why*, and cite the ruling or measurement behind a number.**
  Constants that encode a judgement carry a five-field block: what it is, why, its
  provenance, its known limitation, and what would justify replacing it.
- **Warnings are the only status language.** Silence means pass. Nothing is coloured
  green to congratulate you.
- **Config files are meant to be edited by a human in a text editor**, not tuned in code.
- **Phone changes live only in `site/v2/mobile.js`**, inside `@media (max-width: 768px)`,
  so desktop/tablet layouts can't be affected by them.

## Licence

Source code is **MIT** (see `LICENSE`). Read **`NOTICE`** before assuming that
extends further: the Sunship design is patent pending (AU 2026902104, PCT under way),
no patent rights are granted here, and the 3D geometry is included for verifying the
calculator's measurements rather than for reuse.
