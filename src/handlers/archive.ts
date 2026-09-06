import { Env, err, json } from "../responses";
import { isAuthed } from "../auth";
import {
  FULL_EXTS,
  MAX_ARCHIVE_BYTES,
  MAX_TRANSIT_BYTES,
  extForType,
  fullKey,
  inboxKey,
  isValidId,
  makeId,
  normalizeMime,
  randSuffix,
  thumbKey,
} from "../ids";
import { archiveConfigured, copyObject, presignPut } from "../s3";

// The archive pool's writes. Large files cannot transit the Worker (the
// Workers request-body cap is 100 MB on the free plan), so the browser uploads
// directly to R2 through a presigned PUT and the Worker only orchestrates:
//
//   init    → mints an id + a 1-hour signed PUT URL for the staging key
//   (browser PUTs the file to R2, bypassing the Worker entirely)
//   thumb   → small client-generated thumbnail, still sent through the Worker
//   commit  → verifies the staged object, server-side-copies it into place
//             with proper metadata, drops the staging object
//   abort   → best-effort cleanup when the browser gives up mid-upload
//
// A lifecycle rule on a/inbox/ (1 day) is the backstop for uploads whose
// browser died before abort could fire.

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function handleArchiveInit(request: Request, env: Env): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");
  if (!archiveConfigured(env)) return err(503, "archive storage is not configured on this deployment");

  const body = await readJson(request);
  if (!body) return err(400, "expected JSON body");
  const contentType = normalizeMime(String(body.contentType ?? ""));
  if (!contentType) return err(400, "missing contentType");
  // Advisory-only early reject; the binding HEAD in commit is the real gate,
  // because a presigned PUT cannot enforce a size cap.
  if (typeof body.size === "number" && body.size > MAX_ARCHIVE_BYTES) {
    return err(413, "file too large for the archive pool");
  }

  const id = makeId(Date.now(), randSuffix());
  const uploadUrl = await presignPut(env, inboxKey(id));
  return json({ id, uploadUrl, expiresIn: 3600, maxBytes: MAX_ARCHIVE_BYTES });
}

export async function handleArchiveCommit(request: Request, env: Env): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");
  if (!archiveConfigured(env)) return err(503, "archive storage is not configured on this deployment");

  const body = await readJson(request);
  if (!body) return err(400, "expected JSON body");
  // The id came from the network and is interpolated into an R2 key below —
  // validate before anything else so it cannot escape the archive prefix.
  if (!isValidId(body.id)) return err(400, "bad id");
  const id = body.id;
  const contentType = normalizeMime(String(body.contentType ?? ""));
  if (!contentType) return err(400, "missing contentType");

  const staged = await env.BUCKET.head(inboxKey(id));
  if (!staged) return err(404, "staged upload not found — the direct PUT did not complete");
  if (staged.size > MAX_ARCHIVE_BYTES) return err(413, "file too large for the archive pool");

  const ext = extForType(contentType);
  const meta = {
    source: "pwa-archive",
    origName: String(body.origName ?? ""),
    uploadedAt: new Date().toISOString(),
    hasThumb: String(body.hasThumb === true),
  };
  // Copy first: a failed copy leaves the staging object in place (swept later
  // by the inbox lifecycle rule) instead of destroying the only copy.
  try {
    await copyObject(env, inboxKey(id), fullKey("archive", id, ext), {
      contentType,
      customMetadata: meta,
    });
  } catch (e) {
    console.error("archive commit copy failed:", e);
    return err(500, "archive copy failed; staged upload kept for retry");
  }
  await env.BUCKET.delete(inboxKey(id));

  return json({ id, pool: "archive" });
}

export async function handleArchiveAbort(request: Request, env: Env): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");

  const body = await readJson(request);
  if (!body || !isValidId(body.id)) return err(400, "bad id");
  await env.BUCKET.delete(inboxKey(body.id));
  return json({ aborted: true });
}

// Thumbnails for archive uploads. Only small images get one (client-generated
// 480px JPEG); they are tiny and can safely transit the Worker.
export async function handleArchiveThumb(request: Request, env: Env): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!isValidId(id)) return err(400, "bad id");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err(400, "expected multipart/form-data");
  }
  const entry = form.get("thumb");
  if (!entry || typeof entry !== "object" || !("stream" in entry)) return err(400, "missing thumb");
  const thumb = entry as Blob;
  if (thumb.size > MAX_TRANSIT_BYTES) return err(413, "thumb too large");

  await env.BUCKET.put(thumbKey("archive", id), thumb.stream(), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  return json({ ok: true });
}

// Transit → archive, in place: server-side copy of full (+ thumb), then delete
// the originals. The id never changes, so /i/ and /s/ links keep working via
// the dual-pool probe in image.ts.
export async function handlePromote(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthed(request, env)) return err(401, "unauthorized");
  if (!archiveConfigured(env)) return err(503, "archive storage is not configured on this deployment");
  if (!isValidId(id)) return err(400, "bad id");

  // Find the transit object to learn its extension (keys carry it; metadata
  // has only the MIME).
  let ext: string | null = null;
  let srcFull: R2Object | null = null;
  for (const e of FULL_EXTS) {
    const head = await env.BUCKET.head(fullKey("transit", id, e));
    if (head) {
      ext = e;
      srcFull = head;
      break;
    }
  }
  if (!srcFull || !ext) return err(404, "not found in the transit pool");

  const hasThumb = Boolean(await env.BUCKET.head(thumbKey("transit", id)));
  try {
    await copyObject(env, fullKey("transit", id, ext), fullKey("archive", id, ext), {
      contentType: srcFull.httpMetadata?.contentType || "application/octet-stream",
      customMetadata: { ...(srcFull.customMetadata ?? {}), hasThumb: String(hasThumb) },
    });
    if (hasThumb) {
      await copyObject(env, thumbKey("transit", id), thumbKey("archive", id), {
        contentType: "image/jpeg",
      });
    }
  } catch (e) {
    console.error("promote copy failed:", e);
    return err(500, "archive copy failed; transit item untouched");
  }
  // Originals go last: a failure above leaves the transit copy untouched, so a
  // retry simply overwrites the archive copy.
  await env.BUCKET.delete(hasThumb ? [fullKey("transit", id, ext), thumbKey("transit", id)] : [fullKey("transit", id, ext)]);

  return json({ id, pool: "archive" });
}
