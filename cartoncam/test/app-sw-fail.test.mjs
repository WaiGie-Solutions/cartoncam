import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { setupDom, sleep } from "./helpers.mjs";

describe("service worker registration rejects", () => {
  it("swallows the failure", async () => {
    setupDom({
      serviceWorker: {
        register: () => Promise.reject(new Error("no sw")),
      },
    });
    let threw = false;
    try {
      await import("../app.js");
      await sleep(30);
    } catch {
      threw = true;
    }
    assert.equal(threw, false);
  });
});
