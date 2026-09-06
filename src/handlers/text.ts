import { isAuthed } from "../auth";
import { Env, err, json } from "../responses";
import { MAX_TRANSIT_BYTES, Pool, fullKey, isValidId, normalizeMime } from "../ids";

// Text edits travel through the Worker rather than the archive presigned-upload
// path. Keep them below the transit cap so the request and in-memory validation
// stay comfortably inside the Workers request limits for both pools.
export async function handleTextUpdate(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");
  if (!isValidId(id)) return err(400, "bad id");
  if (normalizeMime(request.headers.get("content-type") || "") !== "text/plain") {
    return err(415, "expected text/plain");
  }

  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_TRANSIT_BYTES) {
    return err(413, "text too large");
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_TRANSIT_BYTES) return err(413, "text too large");

  const requestedPool = new URL(request.url).searchParams.get("pool");
  const pools: Pool[] = requestedPool === "archive" || requestedPool === "transit"
    ? [requestedPool]
    : ["transit", "archive"];

  for (const pool of pools) {
    const key = fullKey(pool, id, "txt");
    const existing = await env.BUCKET.head(key);
    if (!existing) continue;
    if (normalizeMime(existing.httpMetadata?.contentType || "") !== "text/plain") {
      return err(415, "item is not editable text");
    }
    await env.BUCKET.put(key, body, {
      httpMetadata: { contentType: "text/plain" },
      customMetadata: {
        ...(existing.customMetadata ?? {}),
        updatedAt: new Date().toISOString(),
      },
    });
    return json({ id, pool, updated: true });
  }

  return err(404, "text item not found");
}
