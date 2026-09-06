/// <reference types="@cloudflare/workers-types" />
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { handleUsage } from "../src/handlers/usage";
import { fullKey, thumbKey, inboxKey, makeId, QUOTA_BYTES } from "../src/ids";
import { Env } from "../src/responses";

declare global {
  interface ProvidedEnv extends Env {}
}

function req(token = "test-token"): Request {
  return new Request("https://x/api/usage", { headers: { authorization: `Bearer ${token}` } });
}

const B = (env as Env).BUCKET;

describe("handleUsage", () => {
  it("401 without token", async () => {
    const res = await handleUsage(new Request("https://x/api/usage"), env as Env);
    expect(res.status).toBe(401);
  });

  it("zeros on an empty bucket", async () => {
    const body = await (await handleUsage(req(), env as Env)).json<any>();
    expect(body).toMatchObject({
      transitBytes: 0, archiveBytes: 0, stagingBytes: 0, totalBytes: 0,
      transitCount: 0, archiveCount: 0, quotaBytes: QUOTA_BYTES,
    });
  });

  it("sums bytes per pool (fulls + thumbs) and counts items", async () => {
    const id1 = makeId(1_700_000_000_000, "aaaaaa");
    const id2 = makeId(1_700_000_001_000, "bbbbbb");
    await B.put(fullKey("transit", id1, "png"), new Uint8Array(100));
    await B.put(thumbKey("transit", id1), new Uint8Array(10));
    await B.put(fullKey("archive", id2, "bin"), new Uint8Array(1000));
    await B.put(inboxKey(id2), new Uint8Array(5));

    const body = await (await handleUsage(req(), env as Env)).json<any>();
    // Thumbs occupy the bucket and count toward the pool's bytes, but not its
    // item count; staging is reported separately and added to the total.
    expect(body.transitBytes).toBe(110);
    expect(body.archiveBytes).toBe(1000);
    expect(body.stagingBytes).toBe(5);
    expect(body.totalBytes).toBe(1115);
    expect(body.transitCount).toBe(1);
    expect(body.archiveCount).toBe(1);
  });

  it("walks past the 1000-key page size", async () => {
    // R2/Miniflare list pages cap at 1000; a pool bigger than one page must
    // still be fully summed.
    const base = 1_700_000_000_000;
    for (let i = 0; i < 1001; i++) {
      await B.put(fullKey("transit", makeId(base + i, "aaaaaa"), "txt"), new Uint8Array(2));
    }
    const body = await (await handleUsage(req(), env as Env)).json<any>();
    expect(body.transitCount).toBe(1001);
    expect(body.transitBytes).toBe(2002);
  });
});
