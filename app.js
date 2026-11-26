import { Packer } from "docx";
import { buildPqfDocument, ctnList, defaultDetail, suggestFilename } from "./docx-gen.js";

const $ = (id) => document.getElementById(id);
const FIELDS = ["dateOfFeedback","pqfNo","supplierName","invoicePo","dateReceived","containerNo",
  "companyName","outlet","customerName","doDate","email","contact",
  "productCode","productDesc","expiry","quantity","uom","unitPrice",
  "detail","rootCause","corrections","corrective","filename"];
const WRITEOFF = [["A","In-House"],["B","Receiving"],["C","Sales Return"],["D","QA Sample"],["E","Phase Out"],["F","Overstock"],["G","Vendor Return"]];

const EXAMPLE = {
  reportType: "receiving",
  dateOfFeedback: "25/11/2026",
  pqfNo: "ST-31426",
  supplierName: "",
  invoicePo: "PO00066312",
  dateReceived: "25/11/2026",
  containerNo: "PCIU6163160",
  companyName: "", outlet: "", customerName: "", doDate: "", email: "", contact: "",
  productCode: "ST-C230001391",
  productDesc: "CHICKEN 3JW 15KG BULK LP FADEL 0091",
  expiry: "1/4/2028", quantity: "334", uom: "CS", unitPrice: "",
  writeOff: "B",
  detail: "Finding during unloading, 334 cartons found damaged",
  rootCause: "Non-conformance originated from supplier/ shipper",
  corrections: "Product isolated in non-conformance holding area pending for customer further instruction on product disposition.",
  corrective: "Feedback to CS to inform customer on product arrangement",
};

let state = { reportType: "receiving", writeOff: "B" };
let photos = []; // {dataUrl, width, height, caption}

/* ---------- storage ---------- */
const LS_LIBS = "pqf.libs.v1";
function getLibs() {
  try { return JSON.parse(localStorage.getItem(LS_LIBS)) || { suppliers: [], products: [], pos: [], containers: [] }; }
  catch { return { suppliers: [], products: [], pos: [], containers: [] }; }
}
function setLibs(l) { localStorage.setItem(LS_LIBS, JSON.stringify(l)); }
function pushLib(arr, v) {
  v = (v || "").trim(); if (!v) return;
  if (!arr.includes(v)) { arr.unshift(v); arr.splice(12); }
}

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("pqf-db", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("reports", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbAll() {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("reports").objectStore("reports").getAll();
    tx.onsuccess = () => res(tx.result || []);
    tx.onerror = () => rej(tx.error);
  });
}
async function idbPut(rec) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("reports", "readwrite").objectStore("reports").put(rec);
    tx.onsuccess = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(id) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("reports").objectStore("reports").get(id);
    tx.onsuccess = () => res(tx.result);
    tx.onerror = () => rej(tx.error);
  });
}
async function idbClear() {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("reports", "readwrite").objectStore("reports").clear();
    tx.onsuccess = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* ---------- form ---------- */
function todayStr() {
  const t = new Date();
  return `${String(t.getDate()).padStart(2,"0")}/${String(t.getMonth()+1).padStart(2,"0")}/${t.getFullYear()}`;
}
function readForm() {
  const d = { reportType: state.reportType, writeOff: state.writeOff };
  for (const f of FIELDS) d[f] = $(f).value.trim();
  return d;
}
function writeForm(d) {
  state.reportType = d.reportType || "receiving";
  state.writeOff = d.writeOff || "B";
  for (const f of FIELDS) if ($(f) && d[f] != null) $(f).value = d[f];
  syncType(); syncChips(); updateDerived();
}
function syncType() {
  const r = state.reportType === "receiving";
  $("typeReceiving").classList.toggle("active", r);
  $("typeFeedback").classList.toggle("active", !r);
  $("supplierCard").hidden = !r;
  $("customerCard").hidden = r;
}
function syncChips() {
  const box = $("writeOffChips"); box.innerHTML = "";
  for (const [k, label] of WRITEOFF) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.writeOff === k ? " active" : "");
    b.textContent = `${k} · ${label}`;
    b.onclick = () => { state.writeOff = k; syncChips(); updateDerived(); };
    box.appendChild(b);
  }
}
function updateDerived() {
  const q = $("quantity").value.trim();
  const up = parseFloat($("unitPrice").value);
  $("totalHint").textContent = (!Number.isNaN(up) && q) ? `Total ≈ S$${(Number(q) * up).toFixed(2)} (auto in Word)` : "";
  $("photoCount").textContent = photos.length ? `(${photos.length})` : "";
  renderPreview();
}
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ---------- preview ---------- */
let previewT = 0;
function renderPreview() {
  clearTimeout(previewT);
  previewT = setTimeout(() => {
    const d = readForm();
    const ctns = ctnList(d.quantity);
    const rows = d.reportType === "receiving"
      ? `<tr><td><b>Supplier</b></td><td>${esc(d.supplierName)}</td><td><b>PO</b></td><td>${esc(d.invoicePo)}</td></tr>
         <tr><td><b>Received</b></td><td>${esc(d.dateReceived)}</td><td><b>Container</b></td><td>${esc(d.containerNo)}</td></tr>`
      : `<tr><td><b>Company</b></td><td>${esc(d.companyName)}</td><td><b>Outlet</b></td><td>${esc(d.outlet)}</td></tr>
         <tr><td><b>Customer</b></td><td>${esc(d.customerName)}</td><td><b>DO/Date</b></td><td>${esc(d.doDate)}</td></tr>`;
    $("preview").innerHTML = `
      <p><b>PQF ${esc(d.pqfNo || "DRAFT")}</b> · ${esc(d.dateOfFeedback)} · ${d.reportType === "receiving" ? "Receiving Damaged" : "Customer Feedback"} · Write-off <b>${esc(state.writeOff)}</b></p>
      <table>${rows}</table>
      <table><tr><th>Code</th><th>Description</th><th>Exp</th><th>Qty</th><th>UOM</th></tr>
      <tr><td>${esc(d.productCode)}</td><td>${esc(d.productDesc)}</td><td>${esc(d.expiry)}</td><td>${esc(d.quantity)}</td><td>${esc(d.uom)}</td></tr></table>
      <p>${esc(d.detail)}</p>
      <h3>Supporting Attachments — CTN 1…${ctns.length} (${ctns.length} cartons)</h3>
      <p style="color:#64748b">${esc(ctns.slice(0, 24).join("   "))}${ctns.length > 24 ? " …" : ""}</p>
      <div class="phs">${photos.map((p) => `<div><img src="${p.dataUrl}" alt=""/><br/><small>${esc(p.caption || "")}</small></div>`).join("") || "<small>No photos yet</small>"}</div>`;
  }, 200);
}

/* ---------- photos ---------- */
function compressImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res({ dataUrl: c.toDataURL("image/jpeg", 0.82), width: w, height: h });
    };
    img.onerror = rej;
    img.src = url;
  });
}
async function addFiles(list) {
  $("status").textContent = "Compressing photos…";
  for (const f of list) {
    try {
      if (!f.type.startsWith("image/")) continue;
      const c = await compressImage(f);
      photos.push({ ...c, caption: "" });
    } catch { /* skip unreadable */ }
  }
  $("status").textContent = "";
  renderPhotos(); updateDerived();
}
function renderPhotos() {
  const g = $("photoGrid"); g.innerHTML = "";
  photos.forEach((ph, i) => {
    const div = document.createElement("div"); div.className = "ph";
    div.innerHTML = `<img alt="damage ${i+1}"/><input placeholder="Caption (optional)" value="${esc(ph.caption)}"/><button class="rm" type="button">Remove</button>`;
    div.querySelector("img").src = ph.dataUrl;
    div.querySelector("input").oninput = (e) => { ph.caption = e.target.value; updateDerived(); };
    div.querySelector(".rm").onclick = () => { photos.splice(i, 1); renderPhotos(); updateDerived(); };
    g.appendChild(div);
  });
}
function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/* ---------- actions ---------- */
function suggestNextPqfNo() {
  const libs = getLibs();
  const all = libs.pqfNos || [];
  const last = $("pqfNo").value.trim() || all[0] || EXAMPLE.pqfNo;
  const m = last.match(/(\d+)\D*$/);
  if (m) {
    const n = m[1]; const inc = String(Number(n) + 1).padStart(n.length, "0");
    return last.slice(0, last.length - n.length) + inc;
  }
  return last + "-2";
}

async function download() {
  const d = readForm();
  if (!d.pqfNo) { $("status").textContent = "Enter a PQF No. first."; $("pqfNo").focus(); return; }
  if (!d.quantity) { $("status").textContent = "Enter Quantity first (drives CTN list)."; $("quantity").focus(); return; }
  $("status").textContent = "Building .docx…";
  try {
    const phs = photos.map((p) => ({ bytes: dataUrlToBytes(p.dataUrl), kind: "jpg", width: p.width, height: p.height, caption: p.caption }));
    const doc = buildPqfDocument(d, phs);
    const blob = await Packer.toBlob(doc);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (d.filename || suggestFilename(d)) + ".docx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    const libs = getLibs();
    pushLib(libs.suppliers, d.supplierName); pushLib(libs.pos, d.invoicePo); pushLib(libs.containers, d.containerNo);
    if (d.productCode) pushLib(libs.products, `${d.productCode} — ${d.productDesc}`);
    libs.pqfNos = libs.pqfNos || []; pushLib(libs.pqfNos, d.pqfNo);
    setLibs(libs); fillLibraries();
    $("status").textContent = `Done — ${phs.length} photo(s), CTN 1…${ctnList(d.quantity).length}.`;
  } catch (e) {
    console.error(e);
    $("status").textContent = "Build failed (network needed once for the Word library). Reconnect and retry.";
  }
}

function fillLibraries() {
  const libs = getLibs();
  const fill = (id, arr) => { $(id).innerHTML = arr.map((v) => `<option value="${esc(v)}">`).join(""); };
  fill("dlSuppliers", libs.suppliers || []); fill("dlPos", libs.pos || []);
  fill("dlContainers", libs.containers || []); fill("dlProducts", libs.products || []);
}

async function refreshRecents() {
  const box = $("recentList");
  try {
    const all = (await idbAll()).sort((a, b) => b.id - a.id).slice(0, 20);
    box.innerHTML = all.length ? "" : `<p class="hint">Nothing saved yet — fill a report and tap Save current.</p>`;
    for (const r of all) {
      const b = document.createElement("button");
      b.className = "ghost";
      b.textContent = `${new Date(r.id).toLocaleDateString()} · PQF ${r.data.pqfNo || "DRAFT"} · ${r.data.productDesc?.slice(0, 40) || ""} (${(r.photos || []).length} photos)`;
      b.onclick = async () => {
        const full = await idbGet(r.id);
        if (full) { writeForm(full.data); photos = full.photos || []; renderPhotos(); updateDerived(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      };
      box.appendChild(b);
    }
  } catch { box.innerHTML = `<p class="hint">Saved reports unavailable in this browser mode.</p>`; }
}

/* ---------- init ---------- */
function init() {
  writeForm({ ...EXAMPLE, dateOfFeedback: todayStr(), dateReceived: todayStr(), filename: suggestFilename(EXAMPLE) });
  fillLibraries();
  $("typeReceiving").onclick = () => { state.reportType = "receiving"; syncType(); renderPreview(); };
  $("typeFeedback").onclick = () => { state.reportType = "feedback"; syncType(); renderPreview(); };
  $("f").addEventListener("input", updateDerived);
  $("autoDetail").onclick = () => { $("detail").value = defaultDetail($("quantity").value.trim()); updateDerived(); };
  $("suggestPqf").onclick = () => { $("pqfNo").value = suggestNextPqfNo(); $("filename").value = suggestFilename(readForm()); updateDerived(); };
  $("loadExample").onclick = () => { const keepType = state.reportType; writeForm({ ...EXAMPLE, reportType: keepType, filename: suggestFilename(EXAMPLE) }); };
  $("autoFilename").onclick = () => { $("filename").value = suggestFilename(readForm()); };
  $("camInput").onchange = (e) => addFiles(e.target.files);
  $("fileInput").onchange = (e) => addFiles(e.target.files);
  $("downloadBtn").onclick = download;
  $("printBtn").onclick = () => window.print();
  $("saveRecent").onclick = async () => {
    const d = readForm();
    await idbPut({ id: Date.now(), data: d, photos });
    await refreshRecents();
    $("status").textContent = "Saved on this device.";
  };
  $("clearAll").onclick = async () => {
    if (!confirm("Clear saved reports + dropdown memory on this device?")) return;
    localStorage.removeItem(LS_LIBS); await idbClear();
    fillLibraries(); await refreshRecents();
  };
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("installBtn").hidden = false; });
  $("installBtn").onclick = () => deferred?.prompt();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  refreshRecents(); renderPhotos(); updateDerived();
}
init();
