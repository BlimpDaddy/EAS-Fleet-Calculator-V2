# EAS Calculator V2 — Shape Pipeline

Measures **simple VS**, **VS∞** and **VE** from any `.obj` file, in JavaScript.

This is the first piece of Calc V2. It's the part that replaces the six hard-coded
volume-efficiency numbers in the current calculator with values computed from real geometry.

---

## Running it (no terminal needed)

**Double-click `START SHAPE INSPECTOR.bat`.**

A black window opens and stays open — that's the little web server, leave it alone.
Your browser opens automatically at the shape inspector.

**To stop it:** close the black window.

If the browser doesn't open by itself, go to <http://localhost:5178/> manually.

### Using it

- **Pick a shape** from the *Library* dropdown — it reads the `3D OBJ` folder next door.
- **Or drag any `.obj` file** onto the drop zone.
- **Samples** trades speed for precision. 69,420 is the reference figure used in the
  Shape-Volume Scalar paper; 5,000 is near-instant and good enough for a quick look.

Big shapes take a few seconds. The VS∞ number updates live as it converges, so you can
watch it settle rather than staring at a blank box.

### What the 3D view is showing

The shape's convex hull in magenta, inside its **actual computed minimum bounding sphere**.
That sphere is not decoration — VE is literally the hull's volume divided by that sphere's
volume, so what you're looking at *is* the measurement.

### The row that matters most

**Bounding sphere check** should read `exact ✓`. That means every hull vertex was verified
to sit inside the sphere VE divided by. If it ever says *grown to fit*, the number is
slightly conservative and worth telling me about.

---

## The text-only version

To check many shapes at once, open a terminal here and run:

```bash
npm run validate
```

Prints a table for eight reference shapes. Options:

```bash
node test/validate.mjs --samples 5000          # faster
node test/validate.mjs --seeds 5               # shows VS-infinity's random spread
node test/validate.mjs "C:/path/to/thing.obj"  # specific files
```

---

## Accuracy

Checked against the Python reference (`PythonCodes/CalcV2.vsve.py`) using scipy + miniball.
**Simple VS and VE match to every digit printed.** VS∞ is a Monte-Carlo estimate, so it
agrees within sampling noise — both implementations show comparable spread across seeds.

One thing worth knowing: at 69,420 samples VS∞ is reproducible to about ±0.05% for
compact shapes like the Sunship, but only ±0.3–0.6% for very elongated ones (cigar, pencil).
Quoting those to three decimal places claims more precision than the estimator has.

The minimum bounding sphere uses **exact Welzl**, deliberately not the Ritter approximation
that most JavaScript libraries ship — Ritter runs 5–20% oversized, and since VE divides by
r³ that would understate every VE by 15–25% without looking obviously wrong.

---

## Layout

```
src/            the pipeline — no DOM, no browser assumptions, reusable anywhere
  obj.js          .obj vertex reader
  hull.js         convex hull + hull volume
  miniball.js     exact minimum enclosing sphere (Welzl)
  rng.js          seeded random + Gaussian direction sampling
  shapeMetrics.js simple VS, VS-infinity, VE
web/            the throwaway inspector page
vendor/         quickhull3d, vendored (see the note at the top of that file)
test/           validation harness
serve.mjs       the little web server
```

`src/` is the part that survives into the real app. `web/` is a diagnostic tool and is
meant to be thrown away once this is wired into the real Shape page.

No `npm install` required — the one dependency is vendored.
