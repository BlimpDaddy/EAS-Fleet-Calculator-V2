/**
 * DEEP LINK — owner 2026-11-13: "going externally to CALC does NOT bring up the settings of the generation that linked
 * you there, that's a mistake". The Sunship Futures game links here with a ship's settings in the address:
 *
 *   https://calc.electricairshipping.com/?length=246&temp=500&ideal=1#ship
 *     length  metres (any positive length; above 400 m is "Over Max Size", as when typed)
 *     temp    lift-gas temperature, C, inside the slider's 20-600
 *     ideal=1 the EAS Ideal flight controls (the dynamic page's own ideal button: 116 km/h, tail, S 28%)
 *     #ship   which page opens (the bundle's own page routing, unchanged)
 *
 * Read ONCE when the page loads; with nothing in the address nothing happens and the calculator opens exactly as
 * before. HOW, WITHOUT TOUCHING THE FROZEN BUNDLE: the same route as v2/eas-length.js. Each setting goes in through
 * the control a person would use (a synthetic input event on the slider at the exact view value, or a click on the
 * ideal button); main.js stays byte-identical. Tests: test/deep-link-fixtures.mjs.
 */
import { driveLengthSlider } from './eas-length.js?v=1.0';

/** main.js domainConfig.temperature: the slider's 0-100 view maps linearly onto 20-600 C. */
export const TEMP_RANGE_C = Object.freeze({ min: 20, max: 600 });
export const temperatureView = (tempC) => ((tempC - TEMP_RANGE_C.min) * 100) / (TEMP_RANGE_C.max - TEMP_RANGE_C.min);

/** '?length=246&temp=500&ideal=1' -> { lengthM, tempC, ideal }, or null when there is nothing to apply. Bad values are
 *  ignored one by one (the rest still apply). */
export function parseDeepLink(search) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const num = (k) => (q.has(k) && q.get(k).trim() !== '' && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : null);
  const L = num('length'), T = num('temp');
  const out = {
    lengthM: L !== null && L > 0 ? L : null,
    tempC: T !== null && T >= TEMP_RANGE_C.min && T <= TEMP_RANGE_C.max ? T : null,
    ideal: q.get('ideal') === '1',
  };
  return out.lengthM === null && out.tempC === null && !out.ideal ? null : out;
}

/** Drive a 0-100 slider to an exact (possibly fractional) view value through its ordinary input path. */
function driveSlider(slider, view) {
  const before = slider.hasAttribute('step') ? slider.getAttribute('step') : null;
  slider.setAttribute('step', 'any');
  slider.value = String(view);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  if (before === null) slider.removeAttribute('step'); else slider.setAttribute('step', before);
}

// ---------------------------------------------------------------- page wiring
if (typeof document !== 'undefined' && typeof location !== 'undefined') {
  const link = parseDeepLink(location.search);
  if (link) {
    // after every other module has wired its listeners (the bundle and the dynamic page build on load)
    const apply = () => {
      const temp = document.querySelector('[data-ship="temperature"]');
      const length = document.querySelector('[data-ship="length"]');
      if (link.tempC !== null && temp) driveSlider(temp, temperatureView(link.tempC));
      if (link.lengthM !== null && length) driveLengthSlider(length, link.lengthM);
      const ideal = document.querySelector('[data-v2="dynamic-ideal"]');
      if (link.ideal && ideal) ideal.click();
    };
    if (document.readyState === 'complete') setTimeout(apply, 0);
    else window.addEventListener('load', () => setTimeout(apply, 0), { once: true });
  }
}
