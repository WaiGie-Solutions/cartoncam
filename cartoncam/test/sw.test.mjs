import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("sw.js offline shell", () => {
  it("caches app shell incl. vendored lib, purges old caches, serves cache-first", async () => {
    const listeners = {};
    const added = [];
    let skipped = false;
    let claimed = false;
    globalThis.__cacheHit = null;
    globalThis.self = {
      addEventListener: (t, f) => { listeners[t] = f; },
      skipWaiting: () => { skipped = true; },
      clients: { claim: () => { claimed = true; return Promise.resolve(); } },
    };
    globalThis.caches = {
      open: async () => ({ addAll: async (a) => { added.push(...a); } }),
      match: async () => globalThis.__cacheHit,
      keys: async () => ["pqf-old", "pqf-v2"],
      delete: async () => true,
    };
    globalThis.fetch = async () => "network-res";

    await import("../sw.js");

    let waited = null;
    await listeners.install({ waitUntil: (p) => { waited = p; } });
    await waited;
    assert.ok(added.includes("./vendor/docx.mjs"));
    assert.ok(added.includes("./index.html"));
    assert.equal(skipped, true);

    await listeners.activate({ waitUntil: (p) => { waited = p; } });
    await waited;
    assert.equal(claimed, true);

    const grab = async () => { let res; listeners.fetch({ request: "r", respondWith: (v) => { res = v; } }); return res; };
    globalThis.__cacheHit = "cached-res";
    assert.equal(await grab(), "cached-res");
    globalThis.__cacheHit = null;
    assert.equal(await grab(), "network-res");
  });
});
