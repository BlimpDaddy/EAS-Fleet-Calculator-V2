/**
 * CANONICAL SERIALIZATION for ribbon-render/1.
 *
 * "Byte-stable" means: the same geometry and config produce the SAME BYTES
 * from two clean processes (sealed plan §2.1, round-1 F8). The rules that
 * make that true are all here, in one place:
 *
 *   - object keys serialize in Unicode-lexicographic order, always —
 *     construction order can never leak into the bytes;
 *   - numbers are quantized at build time (constants.Q) and rendered by
 *     JS shortest-round-trip toString, which ECMA-262 fully determines;
 *   - non-finite numbers THROW — a payload may not carry NaN/Infinity;
 *   - -0 normalizes to 0;
 *   - undefined and functions THROW (a field is present or it is null).
 *
 * payloadId = fnv1a64(canonical bytes of the payload WITHOUT the payloadId
 * field) — the exclusion rule is part of the schema (round-4 F2), so the
 * hash can never be self-referential. FNV-1a is an identity, not a
 * security boundary.
 */

export function quantize(v, decimals) {
  if (!Number.isFinite(v)) throw new Error(`quantize: non-finite value ${v}`);
  const f = 10 ** decimals;
  const q = Math.round(v * f) / f;
  return Object.is(q, -0) ? 0 : q;
}

export function quantizeArray(arr, decimals) {
  return arr.map((v) => quantize(v, decimals));
}

export function canonicalStringify(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new Error(`canonicalStringify: non-finite number ${value}`);
    return String(Object.is(value, -0) ? 0 : value);
  }
  if (t === 'string') return JSON.stringify(value);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      if (value[k] === undefined) throw new Error(`canonicalStringify: undefined at key '${k}'`);
      parts.push(`${JSON.stringify(k)}:${canonicalStringify(value[k])}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new Error(`canonicalStringify: unserializable type '${t}'`);
}

/** FNV-1a 64-bit over the UTF-8 bytes of `str`, as 16 hex chars. */
export function fnv1a64(str) {
  const PRIME = 0x100000001b3n, MASK = 0xffffffffffffffffn;
  let h = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(str);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * PRIME) & MASK;
  }
  return h.toString(16).padStart(16, '0');
}

/**
 * Stamp the payload with its identity and return the final canonical bytes.
 * The id hashes the payload WITHOUT payloadId; the returned bytes include it.
 */
export function finalizePayload(payload) {
  if ('payloadId' in payload) throw new Error('finalizePayload: payload already has payloadId');
  const payloadId = fnv1a64(canonicalStringify(payload));
  const full = { ...payload, payloadId };
  return { payload: full, payloadId, bytes: canonicalStringify(full) };
}

/** Recompute and verify a finalized payload's id. Fixture helper. */
export function verifyPayloadId(full) {
  const { payloadId, ...rest } = full;
  return fnv1a64(canonicalStringify(rest)) === payloadId;
}
