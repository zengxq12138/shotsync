/// <reference types="@cloudflare/workers-types" />
import { env } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import { handleArchiveInit, handleArchiveCommit, handleArchiveAbort, handleArchiveThumb, handlePromote } from "../src/handlers/archive";
import { presignPut, archiveConfigured } from "../src/s3";
import { fullKey, thumbKey, inboxKey, makeId, MAX_ARCHIVE_BYTES } from "../src/ids";
import { decodeMetaText, encodeMetaText } from "../src/metatext";
import { Env } from "../src/responses";

// The S3 copy cannot run in tests (Miniflare serves no S3 API), so copyObject
// is replaced with a simulation through the binding — keeping the handler's
// copy-then-delete ordering real — with a switch to force a copy failure.
// NB: the factory must not import "cloudflare:test" (deadlock with the static
// import below), so it uses the env argument the handler already passes.
const copyState = vi.hoisted(() => ({ impl: "simulate" as "simulate" | "fail" }));
vi.mock("../src/s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/s3")>();
  return {
    ...actual,
    copyObject: async (
      env: Env,
      srcKey: string,
      dstKey: string,
      meta: { contentType: string; customMetadata?: Record<string, string> },
    ) => {
      if (copyState.impl === "fail") throw new Error("simulated copy failure");
      const bucket = env.BUCKET;
      const src = await bucket.get(srcKey);
      if (!src) throw new Error("copy: source missing");
      await bucket.put(dstKey, await src.arrayBuffer(), {
        httpMetadata: { contentType: meta.contentType },
        customMetadata: meta.customMetadata,
      });
    },
  } as typeof actual;
});

declare global {
  interface ProvidedEnv extends Env {}
}

const E = env as Env;
const B = E.BUCKET;
const TOKEN = { authorization: "Bearer test-token" };

function jsonReq(path: string, body: unknown, headers: Record<string, string> = TOKEN): Request {
  return new Request(`https://x${path}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("s3 helpers (unit)", () => {
  it("presignPut signs host-only query-string PUTs (browser sends no headers)", async () => {
    const url = new URL(await presignPut(E, "a/inbox/0000001234567890-abc123"));
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/test-bucket/a/inbox/0000001234567890-abc123");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Content-Sha256")).toBe("UNSIGNED-PAYLOAD");
    expect(Number(url.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(3600);
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    // the client PUTs a type-less Blob, so no Content-Type header is sent and
    // the signature only needs to cover the host
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });

  it("archiveConfigured requires all three settings", () => {
    expect(archiveConfigured(E)).toBe(true);
    expect(archiveConfigured({ ...E, R2_S3_ENDPOINT: undefined })).toBe(false);
    expect(archiveConfigured({ ...E, R2_ACCESS_KEY_ID: undefined })).toBe(false);
    expect(archiveConfigured({ ...E, R2_SECRET_ACCESS_KEY: undefined })).toBe(false);
  });

  it("metatext round-trips unicode filenames and leaves ASCII alone", () => {
    expect(encodeMetaText("plain.zip")).toBe("plain.zip");
    expect(decodeMetaText(encodeMetaText("截图 001.png"))).toBe("截图 001.png");
    expect(decodeMetaText("binding-written 原名.png")).toBe("binding-written 原名.png");
    // an ASCII filename that collides with the prefix must survive
    expect(decodeMetaText("b64:notbase64!!")).toBe("b64:notbase64!!");
  });
});

describe("handleArchiveInit", () => {
  it("401 without token", async () => {
    const res = await handleArchiveInit(jsonReq("/api/archive/init", { contentType: "application/zip" }, {}), E);
    expect(res.status).toBe(401);
  });

  it("503 without R2 credentials (e.g. demo deployment)", async () => {
    const noCreds = { ...E, R2_ACCESS_KEY_ID: undefined, R2_SECRET_ACCESS_KEY: undefined, R2_S3_ENDPOINT: undefined };
    const res = await handleArchiveInit(jsonReq("/api/archive/init", { contentType: "application/zip" }), noCreds);
    expect(res.status).toBe(503);
  });

  it("returns an id and a signed upload URL for the staging key", async () => {
    const res = await handleArchiveInit(
      jsonReq("/api/archive/init", { contentType: "application/zip", origName: "docs.zip", size: 1024 }),
      E,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ id: string; uploadUrl: string; maxBytes: number }>();
    expect(body.id).toMatch(/^\d{16}-[0-9a-z]{6}$/);
    expect(body.uploadUrl).toContain(`/test-bucket/a/inbox/${body.id}`);
    expect(body.maxBytes).toBe(MAX_ARCHIVE_BYTES);
  });

  it("400 without contentType, 413 when size already exceeds the cap", async () => {
    expect((await handleArchiveInit(jsonReq("/api/archive/init", {}), E)).status).toBe(400);
    const tooBig = await handleArchiveInit(jsonReq("/api/archive/init", { contentType: "application/zip", size: MAX_ARCHIVE_BYTES + 1 }), E);
    expect(tooBig.status).toBe(413);
  });
});

describe("handleArchiveCommit", () => {
  it("401 without token", async () => {
    const res = await handleArchiveCommit(jsonReq("/api/archive/commit", { id: makeId(0, "aaaaaa") }, {}), E);
    expect(res.status).toBe(401);
  });

  it("400 on a traversal id before any key is built", async () => {
    const res = await handleArchiveCommit(jsonReq("/api/archive/commit", { id: "../../evil", contentType: "application/zip" }), E);
    expect(res.status).toBe(400);
    expect(await B.head("evil")).toBeNull();
  });

  it("404 when the staged upload never happened", async () => {
    const id = makeId(1000, "aaaaaa");
    const res = await handleArchiveCommit(jsonReq("/api/archive/commit", { id, contentType: "application/zip" }), E);
    expect(res.status).toBe(404);
  });

  it("copies the staged object into a/full/ with metadata, then drops staging", async () => {
    const id = makeId(1000, "comm11");
    await B.put(inboxKey(id), new Uint8Array([9, 9, 9]));
    const res = await handleArchiveCommit(
      jsonReq("/api/archive/commit", { id, contentType: "application/zip", origName: "打包 文件.zip", hasThumb: true }),
      E,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id, pool: "archive" });

    const dst = await B.get(fullKey("archive", id, "bin"));
    expect(dst).not.toBeNull();
    expect(new Uint8Array(await dst!.arrayBuffer())).toEqual(new Uint8Array([9, 9, 9]));
    expect(dst!.httpMetadata?.contentType).toBe("application/zip");
    expect(dst!.customMetadata?.source).toBe("pwa-archive");
    expect(dst!.customMetadata?.hasThumb).toBe("true");
    expect(decodeMetaText(dst!.customMetadata?.origName)).toBe("打包 文件.zip");
    expect(await B.head(inboxKey(id))).toBeNull();
  });

  it("keeps staging when the copy fails, so nothing is lost", async () => {
    copyState.impl = "fail";
    try {
      const id = makeId(1000, "fail11");
      await B.put(inboxKey(id), new Uint8Array([1]));
      const res = await handleArchiveCommit(jsonReq("/api/archive/commit", { id, contentType: "application/zip" }), E);
      expect(res.status).toBe(500);
      expect(await B.head(inboxKey(id))).not.toBeNull(); // staging survives for retry/sweep
      expect(await B.head(fullKey("archive", id, "bin"))).toBeNull();
    } finally {
      copyState.impl = "simulate";
    }
  });
});

describe("handleArchiveAbort", () => {
  it("401 without token", async () => {
    const res = await handleArchiveAbort(jsonReq("/api/archive/abort", { id: makeId(0, "aaaaaa") }, {}), E);
    expect(res.status).toBe(401);
  });

  it("deletes the staged object", async () => {
    const id = makeId(1000, "abort1");
    await B.put(inboxKey(id), new Uint8Array([1]));
    const res = await handleArchiveAbort(jsonReq("/api/archive/abort", { id }), E);
    expect(res.status).toBe(200);
    expect(await B.head(inboxKey(id))).toBeNull();
  });

  it("400 on a bad id", async () => {
    const res = await handleArchiveAbort(jsonReq("/api/archive/abort", { id: "../x" }), E);
    expect(res.status).toBe(400);
  });
});

describe("handleArchiveThumb", () => {
  it("401 without token, 400 without id", async () => {
    expect(
      (await handleArchiveThumb(new Request("https://x/api/archive/thumb?id=1", { method: "POST" }), E)).status
    ).toBe(401);
    const form = new FormData();
    form.append("thumb", new Blob([new Uint8Array([1])], { type: "image/jpeg" }));
    const noId = new Request("https://x/api/archive/thumb", {
      method: "POST",
      headers: TOKEN,
      body: form,
    });
    expect((await handleArchiveThumb(noId, E)).status).toBe(400);
  });

  it("stores the thumbnail under a/thumb/", async () => {
    const id = makeId(1000, "thumb1");
    const form = new FormData();
    form.append("thumb", new Blob([new Uint8Array([7, 7])], { type: "image/jpeg" }));
    const req = new Request(`https://x/api/archive/thumb?id=${id}`, {
      method: "POST",
      headers: TOKEN,
      body: form,
    });
    const res = await handleArchiveThumb(req, E);
    expect(res.status).toBe(200);
    const t1 = await B.get(thumbKey("archive", id));
    expect(t1).not.toBeNull();
    await t1!.body.cancel(); // drain: unconsumed bodies break storage isolation
  });
});

describe("handlePromote", () => {
  it("401 without token", async () => {
    const res = await handlePromote(new Request("https://x/api/promote/x", { method: "POST" }), E, makeId(0, "aaaaaa"));
    expect(res.status).toBe(401);
  });

  it("404 for an id that is not in the transit pool", async () => {
    const id = makeId(0, "ghost1");
    const res = await handlePromote(new Request(`https://x/api/promote/${id}`, { method: "POST", headers: TOKEN }), E, id);
    expect(res.status).toBe(404);
  });

  it("moves full + thumb to the archive with metadata preserved", async () => {
    const id = makeId(1000, "promo1");
    await B.put(fullKey("transit", id, "png"), new Uint8Array([1, 2]), {
      httpMetadata: { contentType: "image/png" },
      customMetadata: { source: "mac", origName: "", uploadedAt: "x", hasThumb: "true" },
    });
    await B.put(thumbKey("transit", id), new Uint8Array([3]));

    const res = await handlePromote(new Request(`https://x/api/promote/${id}`, { method: "POST", headers: TOKEN }), E, id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id, pool: "archive" });

    const archived = await B.get(fullKey("archive", id, "png"));
    expect(archived).not.toBeNull();
    expect(new Uint8Array(await archived!.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(archived!.httpMetadata?.contentType).toBe("image/png");
    expect(archived!.customMetadata?.source).toBe("mac");
    const t1 = await B.get(thumbKey("archive", id));
    expect(t1).not.toBeNull();
    await t1!.body.cancel(); // drain: unconsumed bodies break storage isolation
    // originals gone
    expect(await B.head(fullKey("transit", id, "png"))).toBeNull();
    expect(await B.head(thumbKey("transit", id))).toBeNull();
  });

  it("works without a thumbnail and carries the hasThumb flag", async () => {
    const id = makeId(1000, "promo2");
    await B.put(fullKey("transit", id, "txt"), new TextEncoder().encode("hi"), {
      httpMetadata: { contentType: "text/plain" },
      customMetadata: { source: "mac", origName: "", uploadedAt: "x", hasThumb: "false" },
    });
    const res = await handlePromote(new Request(`https://x/api/promote/${id}`, { method: "POST", headers: TOKEN }), E, id);
    expect(res.status).toBe(200);
    const archived = await B.get(fullKey("archive", id, "txt"));
    expect(archived!.customMetadata?.hasThumb).toBe("false");
    await archived!.body.cancel(); // drain
    expect(await B.head(thumbKey("archive", id))).toBeNull();
  });
});
