import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { setupDom, click } from "./helpers.mjs";

describe("install prompt, print", () => {
  before(async () => {
    setupDom();
    await import("../app.js");
    await sleep50();
  });

  it("ignores install click with no prompt, then honours prompt incl. rejection", async () => {
    click("installBtn");
    assert.equal(document.getElementById("installBtn").hidden, true);
    const fail = new window.Event("beforeinstallprompt", { cancelable: true });
    fail.prompt = () => Promise.reject(new Error("dismissed"));
    window.dispatchEvent(fail);
    assert.equal(document.getElementById("installBtn").hidden, false);
    assert.equal(fail.defaultPrevented, true);
    click("installBtn");
    await new Promise((r) => setTimeout(r, 30));
    const ok = new window.Event("beforeinstallprompt", { cancelable: true });
    let prompted = 0;
    ok.prompt = () => { prompted += 1; return Promise.resolve({ outcome: "accepted" }); };
    window.dispatchEvent(ok);
    click("installBtn");
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(prompted, 1);
    click("printBtn");
    assert.equal(globalThis.__printed, 1);
  });

  async function sleep50() {
    await new Promise((r) => setTimeout(r, 50));
  }
});
