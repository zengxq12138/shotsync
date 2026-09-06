import { Env, err } from "../responses";
import { canRead } from "../auth";
import { FULL_EXTS, POOLS, fullKey, thumbKey } from "../ids";
import { decodeMetaText } from "../metatext";

const SAFE_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
]);

export function responseHeaders(obj: R2ObjectBody, cacheControl: string): Headers {
  const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
  const headers = new Headers({
    "content-type": contentType,
    // Editable text must always be revalidated. Images and immutable files keep
    // their existing long-lived browser cache behaviour.
    "cache-control": contentType === "text/plain" ? "private, no-store" : cacheControl,
    "x-content-type-options": "nosniff",
  });
  // Keep images and the app's text notes viewable. All other content is an
  // attachment, avoiding accidental in-browser execution of uploaded files.
  if (!SAFE_IMAGE_TYPES.has(contentType) && contentType !== "text/plain") {
    const name = decodeMetaText(obj.customMetadata?.origName) || "download";
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  return headers;
}

// Try to find a full object with one of the supported extensions, probing the
// transit pool first. Probing both pools is what keeps /i/ and /s/ links
// working after an item is promoted from transit to archive — the id never
// changes, only its prefix.
export async function getFull(env: Env, id: string): Promise<R2ObjectBody | null> {
  for (const pool of POOLS) {
    for (const ext of FULL_EXTS) {
      const obj = await env.BUCKET.get(fullKey(pool, id, ext));
      if (obj) return obj;
    }
  }
  return null;
}

async function getThumb(env: Env, id: string): Promise<R2ObjectBody | null> {
  for (const pool of POOLS) {
    const obj = await env.BUCKET.get(thumbKey(pool, id));
    if (obj) return obj;
  }
  return null;
}

export async function handleImage(request: Request, env: Env, id: string): Promise<Response> {
  // Check authentication
  if (!canRead(request, env)) return err(401, "unauthorized");

  // Get size parameter from query string
  const size = new URL(request.url).searchParams.get("size");

  let obj: R2ObjectBody | null = null;

  // If size=thumb is requested, try to fetch thumb
  if (size === "thumb") obj = await getThumb(env, id);

  // Fall back to full image if thumb not found or not requested
  if (!obj) obj = await getFull(env, id);

  // Return 404 if nothing found
  if (!obj) return err(404, "not found");

  // Return image with proper headers
  return new Response(obj.body, {
    headers: responseHeaders(obj, "private, max-age=31536000, immutable"),
  });
}
