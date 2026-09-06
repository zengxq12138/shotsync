export const INV_BASE = 8_000_000_000_000_000;

export const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt",
};

// Candidate extensions a `full/<id>.<ext>` object may carry. Used when probing
// for an object whose ext is unknown (image serve / delete). Shared so the
// serve and delete paths can never drift out of sync.
// Known types retain friendly extensions. Everything else uses .bin; its MIME
// type and original filename live in R2 metadata, so this still supports any
// file without trusting a user-supplied extension in the object key.
export const FULL_EXTS = ["png", "jpg", "webp", "txt", "bin"];

// The bucket holds two pools under disjoint prefixes. The transit pool sits on
// the historic `full/` + `thumb/` prefixes so existing objects keep working
// untouched, and its lifecycle cleanup (a dashboard rule scoped to those
// prefixes) is what makes it a 30-day pool. The archive pool lives under `a/`
// — deliberately NOT covered by any lifecycle rule — and never auto-deletes.
// `a/inbox/` stages in-flight direct-to-R2 archive uploads and gets its own
// short-TTL lifecycle rule, so an upload that dies mid-PUT is swept up.
export type Pool = "transit" | "archive";
export const POOLS: Pool[] = ["transit", "archive"];

const FULL_PREFIX: Record<Pool, string> = { transit: "full/", archive: "a/full/" };
const THUMB_PREFIX: Record<Pool, string> = { transit: "thumb/", archive: "a/thumb/" };
const INBOX_PREFIX = "a/inbox/";

export const MAX_TRANSIT_BYTES = 50 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
// R2's free tier is 10 GB of average stored bytes; above that, billing kicks
// in. The client uses this to warn before an upload would cross the line.
export const QUOTA_BYTES = 10 * 1024 ** 3;

export function makeId(epochMs: number, rand: string): string {
  const inv = (INV_BASE - epochMs).toString().padStart(16, "0");
  return `${inv}-${rand}`;
}

export function epochMsFromId(id: string): number {
  const inv = Number(id.slice(0, 16));
  return INV_BASE - inv;
}

// Ids are server-generated (`<16 digits>-<6 base36 chars>`). Everything taken
// from a request body or URL path must pass this before it is interpolated
// into an R2 key — otherwise `../../` or `/` in an id would let a client
// address objects outside the intended prefix.
const ID_RE = /^\d{16}-[0-9a-z]{6}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

export function fullKey(pool: Pool, id: string, ext: string): string {
  return `${FULL_PREFIX[pool]}${id}.${ext}`;
}

export function thumbKey(pool: Pool, id: string): string {
  return `${THUMB_PREFIX[pool]}${id}.jpg`;
}

export function inboxKey(id: string): string {
  return `${INBOX_PREFIX}${id}`;
}

export function idFromFullKey(pool: Pool, key: string): string {
  const name = key.slice(FULL_PREFIX[pool].length);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

// Inverse of fullKey: which pool an object key belongs to, or null for keys
// outside both pools (thumbs, inbox staging, foreign objects).
export function poolFromFullKey(key: string): Pool | null {
  for (const pool of POOLS) {
    if (key.startsWith(FULL_PREFIX[pool])) return pool;
  }
  return null;
}

// Uploads normalize the MIME before mapping it to an extension (curl, the
// Shortcut and the mac app can all send parameters like "; charset=utf-8").
// Both the transit upload path and the archive init/commit paths share this so
// the stored extension can never drift from the stored content type.
export function normalizeMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function extForType(mime: string): string {
  return EXT_BY_TYPE[normalizeMime(mime)] || "bin";
}

export function randSuffix(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz"; // 36 symbols
  const out: string[] = [];
  const bytes = new Uint8Array(6);
  while (out.length < 6) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (out.length >= 6) break;
      if (b < 252) out.push(chars[b % 36]); // reject 252-255 to keep distribution uniform
    }
  }
  return out.join("");
}
