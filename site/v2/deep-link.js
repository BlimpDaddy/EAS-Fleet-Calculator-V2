/**
 * DEEP LINK + SHARE SETTINGS.
 *
 * Owner 2026-11-13: "going externally to CALC does NOT bring up the settings of the generation that linked you there,
 * that's a mistake", then "the share link button is a good idea, happy if it contains many things e.g. S, Cd and any
 * other changes, market size, etc ... long link isn't the end of the world if you press the button and instantly it's
 * just copied to clipboard".
 *
 * One address carries any of the calculator's settings; only what is given is applied:
 *   shape    a preset: sunship cigar bottle car washingmachine aerosmena (an uploaded .obj cannot travel in a link)
 *   length   metres (any positive length; above 400 m is "Over Max Size", as when typed)
 *   temp     lift-gas temperature, C, inside the slider's 20-600
 *   ideal=1  the dynamic page's EAS Ideal (116 km/h, tail, S 28%), applied before any dynamic setting below
 *   fas fut fdist    fleet airspeed / utilisation / trip distance: the sliders' own positions
 *   mkt      total work performed, trillion t-km a year (as typed)
 *   spd s    dynamic airspeed (km/h) and power saving S: the sliders' values
 *   cd       a drag coefficient the person set (left out while the page is still tracking its estimate)
 *   tail bli 1 or 0
 *   rate co2 capex opex pre   the economics sliders' positions
 * e.g. https://calc.electricairshipping.com/?length=246&temp=500&ideal=1#ship   (Sunship Futures links this way)
 *
 * Read ONCE when the page loads, after the Sunship's live VE measurement has landed (so nothing given is overwritten by
 * it); with nothing in the address nothing happens. Every setting goes in through the control a person would use (a
 * synthetic input/change/focusout on the slider, field or switch); main.js stays byte-identical. SHARE SETTINGS (next to
 * COPY SUMMARY) builds the link from the page as it stands and copies it; COPY SUMMARY ends with the same link.
 * Tests: test/deep-link-fixtures.mjs, test/share-link-fixtures.mjs.
 */
import { driveLengthSlider } from './eas-length.js?v=1.0';

/** main.js domainConfig.temperature: the slider's 0-100 view maps linearly onto 20-600 C. */
export const TEMP_RANGE_C = Object.freeze({ min: 20, max: 600 });
export const temperatureView = (tempC) => ((tempC - TEMP_RANGE_C.min) * 100) / (TEMP_RANGE_C.max - TEMP_RANGE_C.min);
export const SHAPES = Object.freeze(['sunship', 'cigar', 'bottle', 'car', 'washingmachine', 'aerosmena']);

// grouped settings: [group, key in the object, key in the address]
const GROUPS = [
  ['fleet', 'airspeed', 'fas'], ['fleet', 'util', 'fut'], ['fleet', 'market', 'mkt'], ['fleet', 'dist', 'fdist'],
  ['dyn', 'speed', 'spd'], ['dyn', 'cd', 'cd'], ['dyn', 's', 's'], ['dyn', 'tail', 'tail'], ['dyn', 'bli', 'bli'],
  ['econ', 'rate', 'rate'], ['econ', 'co2', 'co2'], ['econ', 'capex', 'capex'], ['econ', 'opex', 'opex'], ['econ', 'pre', 'pre'],
];
const SWITCHES = new Set(['tail', 'bli']);
const num = (v) => (v !== null && v !== undefined && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const fmt = (x) => String(Number(Number(x).toPrecision(15)));   // no float noise in the address

/** An address's query -> the settings it carries (only those present; `ideal` always), or null when there are none. */
export function parseDeepLink(search) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const out = {};
  if (q.has('shape') && SHAPES.includes(q.get('shape'))) out.shape = q.get('shape');
  const L = num(q.get('length')), T = num(q.get('temp'));
  if (L !== null && L > 0) out.lengthM = L;
  if (T !== null && T >= TEMP_RANGE_C.min && T <= TEMP_RANGE_C.max) out.tempC = T;
  out.ideal = q.get('ideal') === '1';
  for (const [g, k, p] of GROUPS) {
    if (!q.has(p)) continue;
    let v;
    if (SWITCHES.has(k)) { const s = q.get(p); v = s === '1' ? true : s === '0' ? false : null; }
    else v = num(q.get(p));
    if (v === null) continue;
    (out[g] ??= {})[k] = v;
  }
  const given = Object.keys(out).some((k) => k !== 'ideal' && out[k] !== null) || out.ideal;
  return given ? out : null;
}

/** Settings -> '?key=value&...' (only what is given), the inverse of parseDeepLink. */
export function buildQuery(st) {
  const parts = [];
  const add = (k, v) => parts.push(`${k}=${encodeURIComponent(v)}`);
  if (st.shape && st.shape !== 'sunship') add('shape', st.shape);
  if (Number.isFinite(st.lengthM)) add('length', fmt(st.lengthM));
  if (Number.isFinite(st.tempC)) add('temp', fmt(st.tempC));
  if (st.ideal) add('ideal', 1);
  for (const [g, k, p] of GROUPS) {
    const v = st[g]?.[k];
    if (v === undefined || v === null) continue;
    if (SWITCHES.has(k)) add(p, v ? 1 : 0); else if (Number.isFinite(v)) add(p, fmt(v));
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Drive a slider to an exact (possibly fractional) value through its ordinary input path. */
function driveSlider(slider, value) {
  const before = ['step', 'max', 'min'].map((k) => [k, slider.hasAttribute(k) ? slider.getAttribute(k) : null]);
  slider.setAttribute('step', 'any');
  if (Number(slider.max) < value) slider.setAttribute('max', String(value));
  if (Number(slider.min) > value) slider.setAttribute('min', String(value));
  slider.value = String(value);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  for (const [k, v] of before) { if (v === null) slider.removeAttribute(k); else slider.setAttribute(k, v); }
}

// ---------------------------------------------------------------- the page
if (typeof document !== 'undefined' && typeof location !== 'undefined') {
  const $ = (s) => document.querySelector(s);
  const inSection = (sec, sel) => [...document.querySelectorAll(`section.${sec} ${sel}`)];
  // the dynamic and economics controls carry no data attributes: their order on the page is fixed by their own modules
  const dyn = () => { const r = inSection('section-dynamic', 'input[type=range]'), c = inSection('section-dynamic', 'input[type=checkbox]');
    return { speed: r[0], cd: r[1], s: r[2], cdText: inSection('section-dynamic', 'input.dyn-cd-input')[0], tail: c[0], bli: c[1] }; };
  const econ = () => { const r = inSection('section-economics', 'input[type=range]'); return { rate: r[0], co2: r[1], capex: r[2], opex: r[3], pre: r[4] }; };
  const SHAPE_NAMES = { SUNSHIP: 'sunship', CIGAR: 'cigar', BOTTLE: 'bottle', CAR: 'car', 'WASHING MACHINE': 'washingmachine', 'LENTICULAR (UFO)': 'aerosmena' };

  /** The page as it stands -> settings. */
  function capture() {
    const st = {};
    const shapeName = ($('[data-shape="shape"]')?.textContent || '').trim().toUpperCase();
    if (SHAPE_NAMES[shapeName]) st.shape = SHAPE_NAMES[shapeName];
    const L = parseFloat($('[data-ship="length-output"]')?.textContent), T = parseFloat($('[data-ship="temperature-output"]')?.textContent);
    if (L > 0) st.lengthM = L;
    if (Number.isFinite(T)) st.tempC = T;
    const val = (el) => (el ? Number(el.value) : undefined);
    st.fleet = { airspeed: val($('[data-fleet="airSpeed"]')), util: val($('[data-fleet="utilisation"]')),
      market: parseFloat($('[data-fleet="marketsize-output"]')?.value), dist: val($('[data-fleet="averagedistance"]')) };
    if (!Number.isFinite(st.fleet.market)) delete st.fleet.market;
    const d = dyn();
    const cdTracking = !(window.__v2DynamicCdSet && window.__v2DynamicCdSet());   // the dynamic page's own state (v2/dynamic-page.js)
    st.dyn = { speed: val(d.speed), s: val(d.s), tail: !!d.tail?.checked, bli: !!d.bli?.checked };
    const cdTyped = parseFloat(d.cdText?.value);
    if (!cdTracking && Number.isFinite(cdTyped)) st.dyn.cd = cdTyped;
    const e = econ();
    st.econ = { rate: val(e.rate), co2: val(e.co2), capex: val(e.capex), opex: val(e.opex), pre: val(e.pre) };
    return st;
  }
  const shareLink = () => `${location.origin}${location.pathname}${buildQuery(capture())}${location.hash}`;
  window.__v2ShareLink = shareLink;   // COPY SUMMARY ends with it (v2/revenue.js); tests use it too

  /** Settings -> the page, through its own controls. */
  function apply(link) {
    if (link.shape && link.shape !== 'sunship') $(`[data-shape-button="${link.shape}"]`)?.click();
    const temp = $('[data-ship="temperature"]'), length = $('[data-ship="length"]');
    if (Number.isFinite(link.tempC) && temp) driveSlider(temp, temperatureView(link.tempC));
    if (Number.isFinite(link.lengthM) && length) driveLengthSlider(length, link.lengthM);
    const f = link.fleet || {};
    for (const [k, sel] of [['airspeed', 'airSpeed'], ['util', 'utilisation'], ['dist', 'averagedistance']]) {
      const el = $(`[data-fleet="${sel}"]`); if (Number.isFinite(f[k]) && el) driveSlider(el, f[k]);
    }
    const mk = $('[data-fleet="marketsize-output"]');
    if (Number.isFinite(f.market) && mk) { mk.value = String(f.market); mk.dispatchEvent(new Event('focusout', { bubbles: true })); }
    if (link.ideal) $('[data-v2="dynamic-ideal"]')?.click();
    const d = dyn(), y = link.dyn || {};
    if (Number.isFinite(y.speed) && d.speed) driveSlider(d.speed, y.speed);
    if (Number.isFinite(y.s) && d.s) driveSlider(d.s, y.s);
    for (const k of ['tail', 'bli']) if (typeof y[k] === 'boolean' && d[k] && d[k].checked !== y[k]) { d[k].checked = y[k]; d[k].dispatchEvent(new Event('change', { bubbles: true })); }
    if (Number.isFinite(y.cd) && d.cdText) { d.cdText.value = String(y.cd); d.cdText.dispatchEvent(new Event('change', { bubbles: true })); }
    const e = econ(), z = link.econ || {};
    for (const k of ['rate', 'co2', 'capex', 'opex', 'pre']) if (Number.isFinite(z[k]) && e[k]) driveSlider(e[k], z[k]);
  }

  const link = parseDeepLink(location.search);
  if (link) {
    // after the Sunship's live VE measurement lands (shape-upload.js writes "54.394%"), so it cannot overwrite anything
    const start = Date.now();
    const ready = () => /\d\.\d{3}%$/.test($('[data-shape="input-volume-efficiency"]')?.value || '') || Date.now() - start > 8000;
    const go = () => (ready() ? setTimeout(() => apply(link), 50) : setTimeout(go, 100));
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  }

  // SHARE SETTINGS, beside COPY SUMMARY: the link of the page as it stands, copied in one press
  const addButton = () => {
    const copy = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'COPY SUMMARY');
    if (!copy || copy.parentElement.querySelector('[data-v2="share-settings"]')) return !!copy;
    const btn = document.createElement('button');
    btn.className = copy.className;
    btn.dataset.v2 = 'share-settings';
    btn.textContent = 'SHARE SETTINGS';
    btn.title = 'Copy a link that opens the calculator with these settings';
    btn.addEventListener('click', async () => {
      const text = shareLink();
      try { await navigator.clipboard.writeText(text); } catch {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      const old = btn.textContent; btn.textContent = 'COPIED ✓'; setTimeout(() => { btn.textContent = old; }, 1500);
    });
    copy.insertAdjacentElement('afterend', btn);
    return true;
  };
  if (!addButton()) window.addEventListener('load', addButton, { once: true });
}
