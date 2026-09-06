/// <reference types="@cloudflare/workers-types" />
import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { fullKey, makeId } from "../src/ids";
import { Env } from "../src/responses";

declare global {
  interface ProvidedEnv extends Env {}
}

const T = { authorization: "Bearer test-token", "content-type": "text/plain;charset=utf-8" };

async function seed(pool: "transit" | "archive", id: string, text: string) {
  await (env as Env).BUCKET.put(fullKey(pool, id, "txt"), text, {
    httpMetadata: { contentType: "text/plain" },
    customMetadata: { source: "pwa", origName: "note.txt", uploadedAt: "original", hasThumb: "false" },
  });
}

describe("PUT /api/text/:id", () => {
  for (const pool of ["transit", "archive"] as const) {
    it(`edits text in the ${pool} pool in place`, async () => {
      const id = makeId(1000, pool === "transit" ? "edittr" : "editar");
      await seed(pool, id, "before");

      const res = await SELF.fetch(`https://x/api/text/${id}?pool=${pool}`, {
        method: "PUT", headers: T, body: "修改后内容",
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id, pool, updated: true });
      const saved = await (env as Env).BUCKET.get(fullKey(pool, id, "txt"));
      expect(await saved!.text()).toBe("修改后内容");
      expect(saved!.customMetadata?.uploadedAt).toBe("original");
      expect(saved!.customMetadata?.updatedAt).toBeTruthy();
    });
  }

  it("requires auth and text/plain", async () => {
    const id = makeId(1000, "guards");
    await seed("transit", id, "before");
    expect((await SELF.fetch(`https://x/api/text/${id}`, { method: "PUT", body: "x" })).status).toBe(401);
    expect((await SELF.fetch(`https://x/api/text/${id}`, {
      method: "PUT", headers: { authorization: "Bearer test-token", "content-type": "application/json" }, body: "{}",
    })).status).toBe(415);
  });

  it("does not edit a missing item or a different pool", async () => {
    const id = makeId(1000, "missng");
    await seed("transit", id, "before");
    expect((await SELF.fetch(`https://x/api/text/${id}?pool=archive`, {
      method: "PUT", headers: T, body: "after",
    })).status).toBe(404);
    const saved = await (env as Env).BUCKET.get(fullKey("transit", id, "txt"));
    expect(await saved!.text()).toBe("before");
  });
});
