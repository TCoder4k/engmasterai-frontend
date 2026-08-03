// Sprint 10.5 — UUID v4 generation for study-time session ids and tab ids.
//
// WHY THIS IS NOT JUST `crypto.randomUUID()`.
//
// `crypto.randomUUID` only exists in a SECURE CONTEXT. `localhost` qualifies,
// so `npm run dev` on the developer's own machine is fine — but the moment the
// dev server is opened from another device on the LAN (`http://192.168.1.x:5174`,
// which is how phone testing is done here) the property is undefined and the
// call throws. Study-time tracking would then break on exactly the devices the
// mobile QA pass uses, and the failure would look like "heartbeats don't work
// on my phone" rather than "this is a secure-context API".
//
// The fallback produces a genuine v4-SHAPED string because the backend DTO
// validates it with @IsUUID('4'). A loose random string would be a 400 on every
// heartbeat from those devices.
//
// `crypto.getRandomValues` has no secure-context requirement, so it is the
// preferred fallback. Math.random is the last resort: these ids are correlation
// keys and idempotency keys, never secrets — a collision costs one deduplicated
// heartbeat, not a security property.

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  const webCrypto =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

/**
 * A RFC 4122 version 4 UUID, with or without `crypto.randomUUID`.
 *
 * Sets the version nibble to `4` and the variant bits to `10xx` by hand, so the
 * fallback output passes the same validation the native one does.
 */
export const newUuidV4 = (): string => {
  const webCrypto =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex: string[] = [];
  for (let index = 0; index < 16; index += 1) {
    hex.push(bytes[index].toString(16).padStart(2, '0'));
  }

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
};
