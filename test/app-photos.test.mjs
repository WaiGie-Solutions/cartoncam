import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { setupDom, sleep, setField, click, attachFiles, fileNamed } from "./helpers.mjs";

describe("photos pipeline and download", () => {
  before(async () => {
    setupDom();
    await import("../app.js");
    await sleep(50);
  });

  it("skips non-images with a notice, accepts images", async () => {
    attachFiles("fileInput", [fileNamed("a.txt", "text/plain")]);
    await sleep(120);
    assert.match(document.getElementById("status").textContent, /skipped/);
    assert.equal(document.querySelectorAll("#photoGrid .ph").length, 0);
    attachFiles("fileInput", []);
    await sleep(120);
    assert.equal(document.getElementById("status").textContent, "");
    attachFiles("fileInput", [fileNamed("a.jpg", "image/jpeg"), fileNamed("b.jpg", "image/jpeg")]);
    await sleep(150);
    assert.equal(document.querySelectorAll("#photoGrid .ph").length, 2);
    assert.equal(document.getElementById("photoCount").textContent, "(2)");
  });

  it("skips undecodable images with a notice", async () => {
    globalThis.__imgFail = true;
    attachFiles("fileInput", [fileNamed("bad.jpg", "image/jpeg")]);
    await sleep(120);
    globalThis.__imgFail = false;
    assert.match(document.getElementById("status").textContent, /skipped/);
  });

  it("edits captions and removes photos", async () => {
    const first = document.querySelector("#photoGrid .ph input");
    first.value = "A&<>\"'B";
    first.dispatchEvent(new window.Event("input", { bubbles: true }));
    attachFiles("fileInput", [fileNamed("c.jpg", "image/jpeg")]);
    await sleep(200);
    assert.equal(document.querySelector("#photoGrid .ph input").value, "A&<>\"'B");
    await sleep(280);
    assert.match(document.getElementById("preview").innerHTML, /A&amp;&lt;&gt;&quot;'B/);
    const n = document.querySelectorAll("#photoGrid .ph").length;
    document.querySelector("#photoGrid .ph .rm").click();
    assert.equal(document.querySelectorAll("#photoGrid .ph").length, n - 1);
  });

  it("marks photos with missing data as unavailable", async () => {
    globalThis.__toDataUrl = undefined;
    attachFiles("fileInput", [fileNamed("u.jpg", "image/jpeg")]);
    await sleep(150);
    globalThis.__toDataUrl = "data:image/jpeg;base64,AAA";
    await sleep(280);
    assert.match(document.getElementById("preview").innerHTML, /unavailable in preview/);
  });

  it("blocks download without pqf no or quantity", async () => {
    setField("pqfNo", "");
    click("downloadBtn");
    await sleep(50);
    assert.equal(document.getElementById("status").textContent, "Enter a PQF No. first.");
    setField("pqfNo", "ST-1");
    setField("quantity", "");
    click("downloadBtn");
    await sleep(50);
    assert.equal(document.getElementById("status").textContent, "Enter Quantity first (drives CTN list).");
    setField("quantity", "2");
  });

  it("downloads with defaults, fallback filename, library memory", async () => {
    setField("filename", "");
    setField("unitPrice", "5");
    click("downloadBtn");
    await sleep(900);
    assert.match(document.getElementById("status").textContent, /Done — \d+ photo\(s\), CTN 1…2\./);
    const libs = JSON.parse(localStorage.getItem("pqf.libs.v1"));
    assert.ok(libs.pos.includes("PO00066312"));
    assert.ok(libs.pqfNos.includes("ST-1"));
  });

  it("skips unreadable photo bytes per-photo and caps quantity", async () => {
    globalThis.__toDataUrl = "junk";
    attachFiles("fileInput", [fileNamed("x.jpg", "image/jpeg")]);
    await sleep(150);
    globalThis.__toDataUrl = "data:image/jpeg;base64,AAA";
    await sleep(280);
    assert.match(document.getElementById("preview").innerHTML, /unavailable in preview/);
    setField("quantity", "600");
    setField("filename", "a/b\\c:d");
    click("downloadBtn");
    await sleep(900);
    assert.match(document.getElementById("status").textContent, /skipped as unreadable/);
    assert.match(document.getElementById("status").textContent, /capped at 500/);
    setField("filename", "///");
    click("downloadBtn");
    await sleep(900);
    assert.match(document.getElementById("status").textContent, /Done/);
    setField("quantity", "2");
  });

  it("reports build failure instead of hanging", async () => {
    const RealBlob = globalThis.Blob;
    globalThis.Blob = class {
      constructor() { throw new Error("no blob"); }
    };
    click("downloadBtn");
    await sleep(900);
    globalThis.Blob = RealBlob;
    assert.equal(document.getElementById("status").textContent, "Build failed. Reload the page and retry.");
  });
});
