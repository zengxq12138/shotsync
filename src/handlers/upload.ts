import { Env, err, json } from "../responses";
import { isAuthed } from "../auth";
import { MAX_TRANSIT_BYTES, extForType, fullKey, makeId, normalizeMime, randSuffix, thumbKey } from "../ids";

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err(400, "expected multipart/form-data");
  }

  // Duck-type the File: `form.get()` returns `string | File | null`, and TS strict
  // rejects `instanceof File` on that union (TS2358), so narrow by shape instead.
  const fullEntry = form.get("full");
  if (!fullEntry || typeof fullEntry !== "object" || !("stream" in fullEntry) || !("name" in fullEntry)) {
    return err(400, "missing full");
  }
  const full = fullEntry as File;

  // Normalize the MIME: strip any parameters like "; charset=utf-8" so a
  // non-PWA client (curl, Shortcut) isn't silently 415'd on text uploads.
  const mimeType = normalizeMime(full.type) || "application/octet-stream";
  // Images and plain text keep their historic suffixes. Other content is kept
  // verbatim under a neutral suffix; MIME type and original filename are
  // stored as metadata and returned to the client for a proper download.
  const ext = extForType(mimeType);
  if (full.size > MAX_TRANSIT_BYTES) return err(413, "full too large");

  const thumbEntry = form.get("thumb");
  const hasThumb = !!(thumbEntry && typeof thumbEntry === "object" && "stream" in thumbEntry && "name" in thumbEntry);

  const id = makeId(Date.now(), randSuffix());
  const meta = {
    source: request.headers.get("x-source") || "unknown",
    origName: request.headers.get("x-filename") || full.name || "",
    uploadedAt: new Date().toISOString(),
    hasThumb: String(hasThumb),
  };

  await env.BUCKET.put(fullKey("transit", id, ext), full.stream(), {
    httpMetadata: { contentType: mimeType },
    customMetadata: meta,
  });

  if (hasThumb) {
    const thumb = thumbEntry as Blob;
    await env.BUCKET.put(thumbKey("transit", id), thumb.stream(), {
      httpMetadata: { contentType: "image/jpeg" },
    });
  }

  return json({ id });
}
