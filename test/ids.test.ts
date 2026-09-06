import { describe, it, expect } from "vitest";
import {
  makeId, epochMsFromId, fullKey, thumbKey, idFromFullKey, poolFromFullKey,
  inboxKey, isValidId, normalizeMime, extForType,
  MAX_TRANSIT_BYTES, MAX_ARCHIVE_BYTES, QUOTA_BYTES,
  EXT_BY_TYPE, randSuffix, INV_BASE,
} from "../src/ids";

describe("ids", () => {
  it("makeId pads to 16 digits + suffix", () => {
    const id = makeId(0, "abc123");
    expect(id).toBe(`${String(INV_BASE).padStart(16, "0")}-abc123`);
  });

  it("newer time sorts before older (inverted)", () => {
    const older = makeId(1000, "aaaaaa");
    const newer = makeId(2000, "aaaaaa");
    expect(newer < older).toBe(true); // lexicographic: newer is smaller, sorts first
  });

  it("epochMsFromId is inverse of makeId", () => {
    const id = makeId(1719312000000, "zzzzzz");
    expect(epochMsFromId(id)).toBe(1719312000000);
  });

  it("key helpers", () => {
    expect(fullKey("transit", "ID", "png")).toBe("full/ID.png");
    expect(fullKey("archive", "ID", "png")).toBe("a/full/ID.png");
    expect(thumbKey("transit", "ID")).toBe("thumb/ID.jpg");
    expect(thumbKey("archive", "ID")).toBe("a/thumb/ID.jpg");
    expect(inboxKey("ID")).toBe("a/inbox/ID");
    expect(idFromFullKey("transit", "full/ID.png")).toBe("ID");
    expect(idFromFullKey("transit", "full/0007-xy.webp")).toBe("0007-xy");
    expect(idFromFullKey("archive", "a/full/ID.bin")).toBe("ID");
  });

  it("poolFromFullKey distinguishes the pools", () => {
    expect(poolFromFullKey("full/ID.png")).toBe("transit");
    expect(poolFromFullKey("a/full/ID.png")).toBe("archive");
    // transit prefix must not swallow archive keys or other prefixes
    expect(poolFromFullKey("a/inbox/ID")).toBeNull();
    expect(poolFromFullKey("thumb/ID.jpg")).toBeNull();
  });

  it("isValidId rejects traversal and malformed ids", () => {
    expect(isValidId("0000001234567890-abc123")).toBe(true);
    expect(isValidId("../../secret")).toBe(false);
    expect(isValidId("full/x.png")).toBe(false);
    expect(isValidId("")).toBe(false);
    expect(isValidId(123)).toBe(false);
    expect(isValidId("0000001234567890-ABC123")).toBe(false); // base36 only
  });

  it("limits match the platform constraints", () => {
    expect(MAX_TRANSIT_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_ARCHIVE_BYTES).toBe(500 * 1024 * 1024);
    expect(QUOTA_BYTES).toBe(10 * 1024 ** 3);
  });

  it("normalizeMime strips parameters and case", () => {
    expect(normalizeMime("Text/Plain; charset=utf-8")).toBe("text/plain");
    expect(normalizeMime("IMAGE/PNG")).toBe("image/png");
    expect(extForType("text/plain; charset=utf-8")).toBe("txt");
    expect(extForType("application/zip")).toBe("bin");
  });

  it("EXT_BY_TYPE maps web-safe types", () => {
    expect(EXT_BY_TYPE["image/jpeg"]).toBe("jpg");
    expect(EXT_BY_TYPE["image/png"]).toBe("png");
    expect(EXT_BY_TYPE["image/webp"]).toBe("webp");
  });

  it("randSuffix is 6 base36 chars", () => {
    expect(randSuffix()).toMatch(/^[0-9a-z]{6}$/);
  });
});
