import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { setupDom, sleep } from "./helpers.mjs";

describe("service worker registration resolves", () => {
  it("registers without error", async () => {
    const seen = [];
    setupDom({
      serviceWorker: {
        register: (url) => { seen.push(url); return Promise.resolve("ok"); },
      },
    });
    await import("../app.js");
    await sleep(30);
    assert.deepEqual(seen, ["./sw.js"]);
  });
});
