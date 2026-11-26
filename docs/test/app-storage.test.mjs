import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { setupDom, sleep, setField, click } from "./helpers.mjs";

describe("storage, recents, libraries, clear", () => {
  let mock;
  before(async () => {
    ({ mock } = setupDom());
    await import("../app.js");
    await sleep(80);
  });

  it("starts empty and tolerates corrupt or missing libraries", async () => {
    await sleep(120);
    assert.match(document.getElementById("recentList").innerHTML, /Nothing saved yet/);
    localStorage.setItem("pqf.libs.v1", "{bad json");
    setField("pqfNo", "ST-1");
    setField("quantity", "2");
    setField("invoicePo", "PO9");
    setField("filename", "t");
    click("downloadBtn");
    await sleep(900);
    assert.match(document.getElementById("status").textContent, /Done/);
    localStorage.removeItem("pqf.libs.v1");
    click("downloadBtn");
    await sleep(900);
    assert.match(document.getElementById("status").textContent, /Done/);
  });

  it("saves, lists sorted, reloads full and partial records", async () => {
    setField("pqfNo", "ST-900");
    click("saveRecent");
    await sleep(120);
    setField("pqfNo", "ST-901");
    click("saveRecent");
    await sleep(120);
    const buttons = [...document.querySelectorAll("#recentList button")];
    assert.equal(buttons.length, 2);
    assert.match(buttons[0].textContent, /ST-901/);
    buttons[0].click();
    await sleep(120);
    assert.equal(document.getElementById("pqfNo").value, "ST-901");
    assert.match(document.getElementById("status").textContent, /Saved on this device/);
    const ids = [...mock._store.keys()];
    mock._store.set(3, { id: 3, data: { productDesc: "Loose Item" } });
    click("saveRecent");
    await sleep(120);
    const all = [...document.querySelectorAll("#recentList button")];
    const loose = all.find((b) => b.textContent.includes("DRAFT"));
    assert.ok(loose);
    loose.click();
    await sleep(120);
    assert.equal(document.getElementById("pqfNo").value, "ST-901");
    assert.ok(!ids.includes(undefined));
  });

  it("handles missing records and failing loads", async () => {
    const buttons = [...document.querySelectorAll("#recentList button")];
    assert.ok(buttons.length >= 2);
    mock._store.clear();
    buttons[0].click();
    await sleep(120);
    assert.equal(document.getElementById("status").textContent, "Saved on this device.");
    click("saveRecent");
    await sleep(120);
    const fresh = [...document.querySelectorAll("#recentList button")].at(-1);
    mock._failOp = "get";
    fresh.click();
    await sleep(120);
    mock._failOp = null;
    assert.equal(document.getElementById("status").textContent, "Couldn't open that saved report.");
  });

  it("tolerates outlet removal in writeForm then restores", async () => {
    click("saveRecent");
    await sleep(120);
    const outlet = document.getElementById("outlet");
    outlet.remove();
    const btn = [...document.querySelectorAll("#recentList button")].at(-1);
    btn.click();
    await sleep(120);
    const wrap = document.createElement("label");
    wrap.innerHTML = `Outlet<input id="outlet" type="text" />`;
    document.getElementById("customerCard").appendChild(wrap);
    assert.ok(document.getElementById("outlet"));
  });

  it("fills partial libraries and survives store failures", async () => {
    localStorage.setItem("pqf.libs.v1", JSON.stringify({ suppliers: ["S1"] }));
    setField("filename", "partial-libs");
    click("downloadBtn");
    await sleep(900);
    assert.match(document.getElementById("status").textContent, /Done/);
    mock._nullGetAll = true;
    click("saveRecent");
    await sleep(150);
    mock._nullGetAll = false;
    assert.match(document.getElementById("recentList").innerHTML, /Nothing saved yet/);
    mock._failOp = "getAll";
    click("saveRecent");
    await sleep(150);
    mock._failOp = null;
    assert.match(document.getElementById("recentList").innerHTML, /unavailable/);
    mock._failOp = "put";
    click("saveRecent");
    await sleep(120);
    mock._failOp = null;
    assert.match(document.getElementById("status").textContent, /Couldn't save/);
    mock._failOpen = true;
    click("saveRecent");
    await sleep(120);
    mock._failOpen = false;
    assert.match(document.getElementById("status").textContent, /Couldn't save/);
  });

  it("clear respects confirm and reports clear failure", async () => {
    globalThis.__confirmResult = false;
    click("clearAll");
    await sleep(50);
    assert.ok(localStorage.getItem("pqf.libs.v1"));
    globalThis.__confirmResult = true;
    mock._failOp = "clear";
    click("clearAll");
    await sleep(120);
    mock._failOp = null;
    assert.match(document.getElementById("status").textContent, /couldn't be cleared/);
    click("clearAll");
    await sleep(150);
    assert.equal(localStorage.getItem("pqf.libs.v1"), null);
    assert.match(document.getElementById("recentList").innerHTML, /Nothing saved yet/);
  });
});
