/// <reference types="@cloudflare/workers-types" />

export interface Env {
  BUCKET: R2Bucket;
  AUTH_TOKEN: string;
  // "1" on the public demo deployment: reads (list/view) skip auth, writes
  // (upload/delete/share-create) still require the token. Unset in normal pools.
  DEMO_MODE?: string;
  // R2 S3 credentials for the archive pool's direct-to-R2 uploads (presigned
  // PUT) and server-side copies (promote, commit). Scoped to this one bucket;
  // unset on deployments without an archive pool (init/commit/promote 503).
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_S3_ENDPOINT?: string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function err(status: number, message: string): Response {
  return json({ error: message }, status);
}
