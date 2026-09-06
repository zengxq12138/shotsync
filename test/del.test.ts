/// <reference types="@cloudflare/workers-types" />
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { handleDelete } from "../src/handlers/del";
import { fullKey, thumbKey } from "../src/ids";
import { Env } from "../src/responses";

declare global {
  interface ProvidedEnv extends Env {}
}

function req(token = "test-token"): Request {
  return new Request("https://x/api/img/ID", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
}

describe("handleDelete", () => {
  it("401 without token", async () => {
    const res = await handleDelete(new Request("https://x/api/img/ID", { method: "DELETE" }), env as Env, "ID");
    expect(res.status).toBe(401);
  });

  it("deletes both full and thumb objects", async () => {
    await (env as Env).BUCKET.put(fullKey("transit", "ID", "png"), new Uint8Array([1]));
    await (env as Env).BUCKET.put(thumbKey("transit", "ID"), new Uint8Array([2]));
    const res = await handleDelete(req(), env as Env, "ID");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(await (env as Env).BUCKET.get(fullKey("transit", "ID", "png"))).toBeNull();
    expect(await (env as Env).BUCKET.get(thumbKey("transit", "ID"))).toBeNull();
  });

  it("sweeps both pools — an id survives promote, delete removes it everywhere", async () => {
    await (env as Env).BUCKET.put(fullKey("transit", "MOV", "png"), new Uint8Array([1]));
    await (env as Env).BUCKET.put(fullKey("archive", "MOV", "png"), new Uint8Array([2]));
    await (env as Env).BUCKET.put(thumbKey("archive", "MOV"), new Uint8Array([3]));
    const res = await handleDelete(req(), env as Env, "MOV");
    expect(res.status).toBe(200);
    expect(await (env as Env).BUCKET.get(fullKey("transit", "MOV", "png"))).toBeNull();
    expect(await (env as Env).BUCKET.get(fullKey("archive", "MOV", "png"))).toBeNull();
    expect(await (env as Env).BUCKET.get(thumbKey("archive", "MOV"))).toBeNull();
  });

  it("deletes arbitrary .bin files", async () => {
    await (env as Env).BUCKET.put(fullKey("transit", "FILE", "bin"), new Uint8Array([1]));
    const res = await handleDelete(req(), env as Env, "FILE");
    expect(res.status).toBe(200);
    expect(await (env as Env).BUCKET.get(fullKey("transit", "FILE", "bin"))).toBeNull();
  });

  it("idempotent when nothing exists", async () => {
    const res = await handleDelete(req(), env as Env, "GHOST");
    expect(res.status).toBe(200);
  });
});
