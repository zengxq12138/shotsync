// Custom-metadata values travel by two roads in this codebase: the R2 binding
// (transit upload) carries arbitrary Unicode fine, but the S3 API path
// (archive commit / promote copies) moves them in HTTP headers, which the
// Workers runtime restricts to Latin-1 — a raw "截图.png" header would throw.
// So S3-path writes use this tiny scheme: printable-ASCII values verbatim,
// everything else "b64:"-prefixed base64 (UTF-8). Readers funnel every origName
// through decodeMetaText, which leaves plain and binding-written values intact.

export function encodeMetaText(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return "b64:" + btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

export function decodeMetaText(value: string | undefined): string {
  if (!value || !value.startsWith("b64:")) return value || "";
  const payload = value.slice(4);
  if (!/^[A-Za-z0-9+/=]+$/.test(payload)) return value;
  try {
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    // fatal: reject payloads that are not well-formed UTF-8, so a plain-ASCII
    // filename that merely collides with the prefix survives unmangled.
    return new TextDecoder("utf-8", { ignoreBOM: false, fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}
