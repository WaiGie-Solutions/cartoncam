import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { setupDom, sleep, setField, click, attachFiles, fileNamed } from "./helpers.mjs";

describe("form, toggles, chips, preview, libraries", () => {
  before(async () => {
    setupDom();
    await import("../app.js");
    await sleep(50);
  });

  it("seeds the chicken example with Receiving active", () => {
    assert.equal(document.getElementById("pqfNo").value, "ST-31426");
    assert.equal(document.getElementById("typeReceiving").getAttribute("aria-pressed"), "true");
    assert.equal(document.getElementById("supplierCard").hidden, false);
    assert.equal(document.getElementById("customerCard").hidden, true);
  });

  it("toggles to feedback and back with preview following", async () => {
    click("typeFeedback");
    assert.equal(document.getElementById("supplierCard").hidden, true);
    assert.equal(document.getElementById("typeFeedback").getAttribute("aria-pressed"), "true");
    await sleep(280);
    assert.match(document.getElementById("preview").innerHTML, /Company/);
    click("typeReceiving");
    await sleep(280);
    assert.match(document.getElementById("preview").innerHTML, /Supplier/);
  });

  it("chips move write-off with radio roles", () => {
    const chips = [...document.querySelectorAll("#writeOffChips .chip")];
    assert.equal(chips.length, 7);
    chips[2].click();
    const active = document.querySelector("#writeOffChips .chip.active");
    assert.match(active.textContent, /C ·/);
    assert.equal(active.getAttribute("aria-checked"), "true");
    assert.equal(active.getAttribute("role"), "radio");
    chips[1].click();
  });

  it("derives totals, pqf suggestions, detail, filename", () => {
    setField("unitPrice", "5");
    setField("quantity", "10");
    assert.match(document.getElementById("totalHint").textContent, /Total ≈ S\$50\.00/);
    setField("unitPrice", "");
    assert.equal(document.getElementById("totalHint").textContent, "");
    click("suggestPqf");
    assert.equal(document.getElementById("pqfNo").value, "ST-31427");
    setField("pqfNo", "ABC");
    click("suggestPqf");
    assert.equal(document.getElementById("pqfNo").value, "ABC-2");
    setField("pqfNo", "123");
    click("suggestPqf");
    assert.equal(document.getElementById("pqfNo").value, "124");
    setField("quantity", "7");
    click("autoDetail");
    assert.match(document.getElementById("detail").value, /7 cartons/);
    setField("filename", "");
    click("autoFilename");
    assert.match(document.getElementById("filename").value, /PQF/);
  });

  it("suggests from saved pqf numbers and keeps type on example reload", () => {
    localStorage.setItem("pqf.libs.v1", JSON.stringify({ suppliers: [], products: [], pos: [], containers: [], pqfNos: ["ST-999"] }));
    setField("pqfNo", "");
    click("suggestPqf");
    assert.equal(document.getElementById("pqfNo").value, "ST-1000");
    localStorage.removeItem("pqf.libs.v1");
    setField("pqfNo", "");
    click("suggestPqf");
    assert.equal(document.getElementById("pqfNo").value, "ST-31427");
    click("typeFeedback");
    click("loadExample");
    assert.equal(document.getElementById("customerCard").hidden, false);
    assert.equal(document.getElementById("productCode").value, "ST-C230001391");
    click("typeReceiving");
  });

  it("form input re-renders preview with DRAFT fallback", async () => {
    setField("pqfNo", "");
    document.getElementById("f").dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(280);
    assert.match(document.getElementById("preview").innerHTML, /DRAFT/);
    setField("pqfNo", "ST-31426");
  });

  it("prints via button", () => {
    click("printBtn");
    assert.equal(globalThis.__printed, 1);
  });

  it("camera input feeds the photo pipeline", async () => {
    attachFiles("camInput", [fileNamed("c.jpg", "image/jpeg")]);
    await sleep(120);
    assert.equal(document.querySelectorAll("#photoGrid .ph").length, 1);
  });
});
