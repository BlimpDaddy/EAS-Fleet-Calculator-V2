/**
 * TYPED LENGTH — owner F-calcLength400 (2026-11-10), revised 2026-11-11:
 * "just keep the slider max to 400 but you can enter 400+ by hand, same as
 * you can type into the total work and VE boxes but it's kind of hidden
 * that you can". (The first cut hid this behind the E+A+S chord; the owner
 * retired that as "an old relic".)
 *
 * The Ship page's Length slider still runs 0-400 m. The metres figure beside
 * it is now a text field built exactly like V1's own Total work and VE
 * fields: the same marketsize-input class (reads as plain text, pink outline
 * on focus), committed on focusout, nothing advertised. Any positive length
 * is accepted, above 400 m included; anything that is not a positive number
 * is abandoned and the field re-renders the length in force.
 *
 * HOW, WITHOUT TOUCHING THE FROZEN BUNDLE. main.js maps the slider's view
 * value 0-100 linearly onto 0-400 m and its model stores whatever domain
 * value arrives (no clamp). So a commit widens the slider's max for ONE
 * synthetic input event carrying the exact view value of the typed length,
 * then restores every slider attribute exactly. The bundle takes its own,
 * ordinary input path; main.js stays byte-identical to its committed hash.
 * V1's own length span stays in the DOM (hidden) and keeps being written by
 * the bundle, so every reader of [data-ship="length-output"] is unchanged.
 *
 * Beyond 400 m the ship is outside the V1 structure (weight) formula's
 * validated range, and the page says "Over Max Size" (owner, 2026-11-11) under the length whenever the
 * displayed length is above 400.
 */

/** The V1 bundle's diameter (length) domain: slider view 0-100 <-> 0-400 m. */
export const V1_LENGTH_MAX_M = 400;
const VIEW_MAX = 100;

/** Typed text -> metres, or null to abandon. Commas, spaces and a unit are
 *  ignored; anything that is not one finite positive number is abandoned. */
export function parseTypedLength(text) {
  const s = String(text ?? '').replace(/[,\s]/g, '').replace(/(metres|meters|m)$/i, '');
  if (!/^\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** The slider view value that the bundle maps to exactly `lengthM`, and a
 *  max that admits it (never below the slider's own 100). */
export function sliderTarget(lengthM) {
  const view = (lengthM * VIEW_MAX) / V1_LENGTH_MAX_M;
  return { view, max: Math.max(VIEW_MAX, Math.ceil(view)) };
}

export const outsideV1Domain = (lengthM) => Number.isFinite(lengthM) && lengthM > V1_LENGTH_MAX_M;

/** The disclosure shown beside a length above 400 m ('' otherwise). */
export function lengthNote(lengthM) {
  return outsideV1Domain(lengthM)
    ? 'Over Max Size'
    : '';
}

/** Drive the bundle's own slider path to `lengthM`, then put the slider's
 *  attributes back exactly as they were (absent stays absent). */
export function driveLengthSlider(slider, lengthM) {
  const { view, max } = sliderTarget(lengthM);
  const before = ['step', 'max'].map((k) => [k, slider.hasAttribute(k) ? slider.getAttribute(k) : null]);
  slider.setAttribute('step', 'any');
  slider.setAttribute('max', String(max));
  slider.value = String(view);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  for (const [k, v] of before) {
    if (v === null) slider.removeAttribute(k); else slider.setAttribute(k, v);
  }
}

/** Commit typed text: a valid length drives the slider once and is returned;
 *  anything else drives nothing and returns null (the caller re-renders). */
export function commitTypedLength(slider, text) {
  const L = parseTypedLength(text);
  if (L !== null) driveLengthSlider(slider, L);
  return L;
}

// ---------------------------------------------------------------- page wiring
if (typeof document !== 'undefined') {
  const slider = document.querySelector('[data-ship="length"]');
  const lengthOut = document.querySelector('[data-ship="length-output"]');
  const output = lengthOut?.closest('.ship-control-output');

  if (slider && lengthOut && output) {
    const style = document.createElement('style');
    style.textContent = `
      .section-ship .ship-control-output .marketsize-input { width: 3.2em; }
      .typed-length-note { display: none; width: 100%; text-align: end;
        font-size: 0.75em; color: var(--color-secondary); }
    `;
    document.head.appendChild(style);

    // V1's typeable-number field, in the length span's place. The span stays
    // (hidden) as the bundle's render target and every reader's source.
    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'marketsize-input';
    field.dataset.ship = 'length-input';
    field.setAttribute('aria-label', 'Length in metres');
    lengthOut.insertAdjacentElement('beforebegin', field);
    lengthOut.style.display = 'none';

    const note = document.createElement('div');
    note.className = 'typed-length-note';
    output.insertAdjacentElement('afterend', note);

    const shown = () => lengthOut.textContent;
    function sync() {
      if (document.activeElement !== field) field.value = shown();
      const L = parseFloat(shown());
      note.textContent = lengthNote(L);
      note.style.display = outsideV1Domain(L) ? 'block' : 'none';
    }
    new MutationObserver(sync).observe(lengthOut, { childList: true, characterData: true, subtree: true });

    field.addEventListener('focusout', () => {
      commitTypedLength(slider, field.value);
      field.value = shown();   // valid or not, re-render the length in force
      sync();
    });

    sync();
  }
}
