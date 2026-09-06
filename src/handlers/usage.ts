import { Env, err, json } from "../responses";
import { canRead } from "../auth";
import { Pool, QUOTA_BYTES, fullPrefix, thumbPrefix, inboxPrefix } from "../ids";

// Bytes that count toward the R2 free tier but belong to neither pool: an
// archive upload that died mid-PUT still occupies the bucket until the
// `a/inbox/` lifecycle rule sweeps it, so the usage bar should show it.
const STAGING_PREFIX = inboxPrefix();

// R2 list pages cap at 1000 keys; a personal pool stays orders of magnitude
// below that per call, so a full walk is a handful of ops. Computed per request
// rather than cached — correctness beats caching at this scale, and the client
// refreshes it after every mutation anyway.
async function walk(env: Env, prefix: string) {
  let bytes = 0;
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({ prefix, limit: 1000, cursor });
    for (const o of page.objects) {
      bytes += o.size;
      count++;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { bytes, count };
}

// A pool's footprint is its fulls plus its thumbs (both prefixes share the
// lifecycle rule that defines the pool). `count` is items, so thumbs don't
// inflate it — the client shows one card per full object.
async function sumPool(env: Env, pool: Pool) {
  const fulls = await walk(env, fullPrefix(pool));
  const thumbs = await walk(env, thumbPrefix(pool));
  return { bytes: fulls.bytes + thumbs.bytes, count: fulls.count };
}

export async function handleUsage(request: Request, env: Env): Promise<Response> {
  if (!canRead(request, env)) return err(401, "unauthorized");

  const transit = await sumPool(env, "transit");
  const archive = await sumPool(env, "archive");
  const staging = await walk(env, STAGING_PREFIX);

  return json({
    transitBytes: transit.bytes,
    archiveBytes: archive.bytes,
    stagingBytes: staging.bytes,
    totalBytes: transit.bytes + archive.bytes + staging.bytes,
    quotaBytes: QUOTA_BYTES,
    transitCount: transit.count,
    archiveCount: archive.count,
  });
}
