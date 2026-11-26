import { Packer } from "docx";
import { writeFileSync, readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { buildPqfDocument, ctnList, calcTotal, MAX_CTNS } from "./docx-gen.js";

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

// Minimal ZIP reader (node builtins only): EOCD -> central directory -> local entries.
function unzipFiles(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert(eocd >= 0, "EOCD record found");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    assert(buf.readUInt32LE(p) === 0x02014b50, "central directory entry signature");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comLen = buf.readUInt16LE(p + 32);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const localOff = buf.readUInt32LE(p + 42);
    const nl = buf.readUInt16LE(localOff + 26);
    const el = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + nl + el;
    const raw = buf.subarray(start, start + compSize);
    out.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw));
    p += 46 + nameLen + extraLen + comLen;
  }
  return out;
}

function documentXml(buf) {
  const files = unzipFiles(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  assert(files.has("word/document.xml"), "word/document.xml present");
  return files.get("word/document.xml").toString("utf8");
}

const data = {
  reportType: "receiving",
  dateOfFeedback: "25/11/2026",
  pqfNo: "ST-31426",
  supplierName: "",
  invoicePo: "PO00066312",
  dateReceived: "25/11/2026",
  containerNo: "PCIU6163160",
  companyName: "",
  outlet: "",
  customerName: "",
  doDate: "",
  email: "",
  contact: "",
  productCode: "ST-C230001391",
  productDesc: "CHICKEN 3JW 15KG BULK LP FADEL 0091",
  expiry: "1/4/2028",
  quantity: "334",
  uom: "CS",
  unitPrice: "",
  writeOff: "B",
  detail: "Finding during unloading, 334 cartons found damaged",
  rootCause: "Non-conformance originated from supplier/ shipper",
  corrections: "Product isolated in non-conformance holding area pending for customer further instruction on product disposition.",
  corrective: "Feedback to CS to inform customer on product arrangement",
};

const doc = buildPqfDocument(data, []);
const buf = await Packer.toBuffer(doc);
writeFileSync("sample-pqf.docx", buf);
console.log("wrote sample-pqf.docx", buf.length, "bytes");

// --- body tables ---
const xml = documentXml(buf);
const tblCount = (xml.match(/<w:tbl[\s>]/g) || []).length;
assert(tblCount === 16, `body tables === 16 (got ${tblCount})`);

// --- product row matches the chicken example ---
for (const s of ["ST-C230001391", "CHICKEN 3JW 15KG BULK LP FADEL 0091", "1/4/2028", "334", "CS"]) {
  assert(xml.includes(s), `product row contains ${JSON.stringify(s)}`);
}

// --- write-off B cell is ticked (exactly one tick, sitting in the B row) ---
assert((xml.match(/√/g) || []).length === 1, "exactly one write-off tick");
const iB = xml.indexOf("(B)");
const iTick = xml.indexOf("√");
const iC = xml.indexOf("(C)");
assert(iB >= 0 && iTick > iB && iTick < iC, "tick sits in the (B) row");

// --- core input limits ---
assert(MAX_CTNS === 500, "MAX_CTNS === 500");
assert(ctnList("334").length === 334, `ctnList("334") === 334`);
assert(ctnList("999999").length === MAX_CTNS, "absurd quantity clamps to MAX_CTNS");
assert(calcTotal("abc", "x") === "", `calcTotal bad input renders ""`);
assert(calcTotal("334", "") === "", "blank unit price renders blank");
assert(calcTotal("10", "2.5") === "25.00", "valid total math unchanged");

// --- 2 photos produce exactly 2 drawings ---
const imgBytes = readFileSync("package.json"); // any bytes do; kind/100x100 drive the drawing
const photoDoc = buildPqfDocument(data, [
  { bytes: imgBytes, kind: "jpg", width: 100, height: 100, caption: "cap 1" },
  { bytes: imgBytes, kind: "jpg", width: 100, height: 100, caption: "cap 2" },
]);
const photoXml = documentXml(await Packer.toBuffer(photoDoc));
const drawings = (photoXml.match(/<w:drawing/g) || []).length;
assert(drawings === 2, `2 photos yield 2 drawings (got ${drawings})`);

console.log("all assertions passed");
