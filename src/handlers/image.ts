import { Env, err } from "../responses";
import { canRead } from "../auth";
import { FULL_EXTS, thumbKey } from "../ids";

const SAFE_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
]);

export function responseHeaders(obj: R2ObjectBody, cacheControl: string): Headers {
  const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": cacheControl,
    "x-content-type-options": "nosniff",
  });
  // Keep images and the app's text notes viewable. All other content is an
  // attachment, avoiding accidental in-browser execution of uploaded files.
  if (!SAFE_IMAGE_TYPES.has(contentType) && contentType !== "text/plain") {
    const name = obj.customMetadata?.origName || "download";
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  return headers;
}

// Try to find full image with one of the supported extensions
export async function getFull(env: Env, id: string): Promise<R2ObjectBody | null> {
  for (const ext of FULL_EXTS) {
    const obj = await env.BUCKET.get(`full/${id}.${ext}`);
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
  if (size === "thumb") obj = await env.BUCKET.get(thumbKey(id));

  // Fall back to full image if thumb not found or not requested
  if (!obj) obj = await getFull(env, id);

  // Return 404 if nothing found
  if (!obj) return err(404, "not found");

  // Return image with proper headers
  return new Response(obj.body, {
    headers: responseHeaders(obj, "private, max-age=31536000, immutable"),
  });
}
