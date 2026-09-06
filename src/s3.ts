import { AwsClient } from "aws4fetch";
import { Env } from "./responses";
import { encodeMetaText } from "./metatext";

// The R2 binding has no server-side copy (verified against workerd: the
// prototype only exposes head/get/put/multipart/delete/list), but the S3 API
// does — CopyObject moves bytes inside R2 without streaming them through the
// Worker. These helpers speak that API with the account's R2 access keys,
// the same credentials the presigned browser upload uses.

export const PRESIGN_EXPIRES_SEC = 3600;

export function archiveConfigured(env: Env): boolean {
  return Boolean(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_S3_ENDPOINT);
}

// R2_S3_ENDPOINT is the per-bucket S3 endpoint shown in the R2 dashboard:
// https://<account>.r2.cloudflarestorage.com/<bucket>
function objectUrl(env: Env, key: string): string {
  return `${env.R2_S3_ENDPOINT!.replace(/\/+$/, "")}/${key}`;
}

function client(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
}

// Signed PUT URL the browser uploads a staged archive object to. Only the host
// is signed: the client PUTs a type-less Blob (`new Blob([file])`), which keeps
// the browser from attaching a Content-Type header that would break the SigV4
// signature. UNSIGNED-PAYLOAD spares the browser hashing a 500 MB body. The
// real content type is attached later by commit's metadata-replacing copy.
export async function presignPut(env: Env, key: string): Promise<string> {
  const url = new URL(objectUrl(env, key));
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_EXPIRES_SEC));
  url.searchParams.set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD");
  const signed = await client(env).sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

export interface CopyMeta {
  contentType: string;
  customMetadata?: Record<string, string>;
}

// Server-side copy within the bucket. Metadata is always REPLACEd (the staged
// browser upload carries none worth keeping), and string values go through
// encodeMetaText so non-ASCII filenames survive the header round-trip.
export async function copyObject(env: Env, srcKey: string, dstKey: string, meta: CopyMeta): Promise<void> {
  const bucket = new URL(env.R2_S3_ENDPOINT!).pathname.replace(/^\/+|\/+$/g, "");
  const headers: Record<string, string> = {
    "x-amz-copy-source": `/${bucket}/${srcKey}`,
    "x-amz-metadata-directive": "REPLACE",
    "content-type": meta.contentType,
  };
  for (const [k, v] of Object.entries(meta.customMetadata ?? {})) {
    headers[`x-amz-meta-${k}`] = encodeMetaText(v);
  }
  const res = await client(env).fetch(objectUrl(env, dstKey), { method: "PUT", headers });
  if (!res.ok) throw new Error(`R2 server-side copy failed (${res.status})`);
}
