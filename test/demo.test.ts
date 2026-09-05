/// <reference types="@cloudflare/workers-types" />
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { handleList } from "../src/handlers/list";
import { handleImage } from "../src/handlers/image";
import { handleUpload } from "../src/handlers/upload";
import { handleDelete } from "../src/handlers/del";
import { fullKey, makeId } from "../src/ids";
import { Env } from "../src/responses";

declare global {
  interface ProvidedEnv extends Env {}
}

function demoEnv(): Env {
  return { ...(env as Env), DEMO_MODE: "1" };
}

async function seedOne(): Promise<string> {
  const id = makeId(1000, "aaaa1");
  await (env as Env).BUCKET.put(fullKey(id, "png"), new Uint8Array([1]), {
    httpMetadata: { contentType: "image/png" },
    customMetadata: { hasThumb: "false", source: "mac", uploadedAt: "x", origName: "" },
  });
  return id;
}

describe("demo mode", () => {
  it("list is public when DEMO_MODE=1", async () => {
    await seedOne();
    const res = await handleList(new Request("https://x/api/list"), demoEnv());
    expect(res.status).toBe(200);
    const body = await res.json<{ items: unknown[] }>();
    expect(body.items.length).toBe(1);
  });

  it("image view is public when DEMO_MODE=1", async () => {
    const id = await seedOne();
    const res = await handleImage(new Request(`https://x/i/${id}`), demoEnv(), id);
    expect(res.status).toBe(200);
    await res.arrayBuffer(); // drain the R2 stream so isolated storage can unwind
  });

  it("upload still requires token in demo mode", async () => {
    const res = await handleUpload(
      new Request("https://x/api/upload", { method: "POST" }),
      demoEnv(),
    );
    expect(res.status).toBe(401);
  });

  it("delete still requires token in demo mode", async () => {
    const id = await seedOne();
    const res = await handleDelete(
      new Request(`https://x/api/img/${id}`, { method: "DELETE" }),
      demoEnv(),
      id,
    );
    expect(res.status).toBe(401);
  });

  it("list stays gated when DEMO_MODE is unset", async () => {
    const res = await handleList(new Request("https://x/api/list"), env as Env);
    expect(res.status).toBe(401);
  });

  // Guards the string-replace marker: if the `const DEMO = false` line in
  // gallery/page.ts ever drifts, replace() silently no-ops and the demo
  // frontend ships with the token gate still on. Assert the served HTML.
  it("gallery HTML has the demo flag flipped when DEMO_MODE=1", async () => {
    const res = await worker.fetch(new Request("https://x/"), demoEnv());
    const html = await res.text();
    expect(html).toContain("const DEMO = true");
  });

  it("gallery HTML keeps the flag off in normal mode", async () => {
    const res = await worker.fetch(new Request("https://x/"), env as Env);
    const html = await res.text();
    expect(html).toContain("const DEMO = false");
  });
});
