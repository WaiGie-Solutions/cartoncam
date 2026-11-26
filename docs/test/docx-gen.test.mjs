import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Packer } from "docx";
import AdmZip from "adm-zip";
import {
  MAX_CTNS,
  buildPqfDocument,
  calcTotal,
  cell,
  checkCell,
  ctnList,
  defaultDetail,
  escapeHtml,
  heading,
  labelCell,
  p,
  parseQty,
  simpleTable,
  suggestFilename,
  tr,
} from "../docx-gen.js";
import { TableCell } from "docx";

const BASE = {
  reportType: "receiving",
  dateOfFeedback: "25/11/2026",
  pqfNo: "ST-31426",
  supplierName: "ACME",
  invoicePo: "PO00066312",
  dateReceived: "25/11/2026",
  containerNo: "PCIU6163160",
  companyName: "C",
  outlet: "O",
  customerName: "N",
  doDate: "D",
  email: "e@x.co",
  contact: "123",
  productCode: "ST-C230001391",
  productDesc: "CHICKEN 3JW 15KG BULK LP FADEL 0091",
  expiry: "1/4/2028",
  quantity: "334",
  uom: "CS",
  unitPrice: "",
  writeOff: "B",
  detail: "Finding during unloading, 334 cartons found damaged",
  rootCause: "rc",
  corrections: "corr",
  corrective: "ca",
};

async function xmlOf(doc) {
  const buf = await Packer.toBuffer(doc);
  const zip = new AdmZip(buf);
  return zip.readAsText("word/document.xml");
}

describe("parseQty", () => {
  it("parses, clamps, and rejects", () => {
    assert.equal(parseQty("334"), 334);
    assert.equal(parseQty(5), 5);
    assert.equal(parseQty("3.9"), 3);
    assert.equal(parseQty("999999"), MAX_CTNS);
    assert.equal(MAX_CTNS, 500);
    assert.equal(parseQty("0"), 0);
    assert.equal(parseQty("-5"), 0);
    assert.equal(parseQty("abc"), 0);
    assert.equal(parseQty(""), 0);
    assert.equal(parseQty(undefined), 0);
  });
});

describe("calcTotal", () => {
  it("computes or stays blank", () => {
    assert.equal(calcTotal("2", "10"), "20.00");
    assert.equal(calcTotal(5, "10"), "50.00");
    assert.equal(calcTotal("2", 0), "0.00");
    assert.equal(calcTotal("0", "10"), "");
    assert.equal(calcTotal("abc", "10"), "");
    assert.equal(calcTotal("2", "abc"), "");
    assert.equal(calcTotal("2", ""), "");
    assert.equal(calcTotal("2", null), "");
    assert.equal(calcTotal("2", undefined), "");
  });
});

describe("ctnList", () => {
  it("lists, empties, clamps", () => {
    assert.deepEqual(ctnList("3"), ["CTN 1", "CTN 2", "CTN 3"]);
    assert.deepEqual(ctnList("0"), []);
    assert.equal(ctnList("999999").length, MAX_CTNS);
  });
});

describe("defaultDetail", () => {
  it("inserts quantity or placeholder", () => {
    assert.equal(defaultDetail("5"), "Finding during unloading, 5 cartons found damaged");
    assert.equal(defaultDetail(""), "Finding during unloading, ___ cartons found damaged");
    assert.equal(defaultDetail(undefined), "Finding during unloading, ___ cartons found damaged");
  });
});

describe("suggestFilename", () => {
  it("builds from fields with fallbacks", () => {
    assert.equal(
      suggestFilename({ pqfNo: "ST-1", productCode: "ST-C1", productDesc: "CHICKEN 3JW 15KG BULK LP EXTRA WORDS" }),
      "PQF ST-1 ST-C1 CHICKEN 3JW 15KG BULK"
    );
    assert.equal(suggestFilename({}), "PQF DRAFT ITEM");
    assert.equal(suggestFilename({ productCode: "***", productDesc: "", pqfNo: "" }), "PQF DRAFT ITEM");
    assert.equal(suggestFilename({ productCode: "A&B", productDesc: "X (Y)!", pqfNo: "1" }), "PQF 1 AB X Y");
    const long = suggestFilename({ pqfNo: "N".repeat(150), productCode: "C".repeat(40), productDesc: "D E F G H I" });
    assert.ok(long.length <= 120);
  });
});

describe("escapeHtml", () => {
  it("escapes markup and blanks nullish", () => {
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
    assert.equal(escapeHtml(`A&<>"'B`), "A&amp;&lt;&gt;&quot;&#39;B");
    assert.equal(escapeHtml("plain"), "plain");
  });
});

describe("helpers", () => {
  it("cover text, paragraph, heading, cell, check, label, table branches", () => {
    assert.ok(tr("hi"));
    assert.ok(tr(null));
    assert.ok(tr("x", { size: 11, bold: true, italic: true }));
    assert.ok(p("x"));
    assert.ok(p("x", { align: 1 }));
    assert.ok(p(["raw-child"]));
    assert.ok(heading("t"));
    assert.ok(cell("x"));
    assert.ok(cell("x", { w: 500, bold: true, size: 12, shade: "FFFFFF", align: 1 }));
    assert.ok(checkCell(true));
    assert.ok(checkCell(false));
    assert.deepEqual(labelCell("a", "b").length, 2);
    assert.deepEqual(labelCell("a", "b", 1, 2).length, 2);
    assert.ok(simpleTable([100], [[new TableCell({ children: [] })]]));
    assert.ok(simpleTable([100], [["a", null]]));
  });
});

describe("buildPqfDocument", () => {
  it("replicates the chicken report (receiving)", async () => {
    const xml = await xmlOf(buildPqfDocument(BASE));
    assert.equal(xml.match(/<w:tbl[\s>]/g).length, 16);
    assert.ok(xml.includes("ST-C230001391"));
    assert.ok(xml.includes("PO00066312"));
    const ticks = xml.split("√").length - 1;
    assert.equal(ticks, 1);
    assert.ok(xml.includes("CTN 334"));
    assert.ok(!xml.includes("CTN 335"));
    assert.equal(xml.split("PCIU6163160").length - 1, 3);
    assert.ok(xml.includes("(No photos attached)"));
  });

  it("renders feedback mode with customer block", async () => {
    const xml = await xmlOf(buildPqfDocument({ ...BASE, reportType: "feedback" }));
    assert.ok(xml.includes("Customer Information"));
    assert.ok(!xml.includes("Supplier Information"));
    assert.ok(xml.includes("e@x.co"));
  });

  it("defaults photos, handles split containers, empty CTNs, tick variants", async () => {
    const xml = await xmlOf(
      buildPqfDocument({ ...BASE, reportType: undefined, quantity: "0", writeOff: "Z", containerNo2: "C2", containerNo3: "C3" })
    );
    assert.ok(!xml.includes("Customer Information"));
    assert.ok(xml.includes("(no CTNs"));
    assert.equal(xml.split("√").length - 1, 0);
    assert.ok(xml.includes("C2"));
    assert.ok(xml.includes("C3"));
  });

  it("shows totals when priced", async () => {
    const xml = await xmlOf(buildPqfDocument({ ...BASE, quantity: "2", unitPrice: "10" }));
    assert.ok(xml.includes("20.00"));
  });

  it("lays out photos 1/2/3 with scale, kind, caption branches", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const one = await xmlOf(buildPqfDocument(BASE, [{ bytes, kind: "jpg", width: 800, height: 600, caption: "CTN 1" }]));
    assert.equal(one.split("<w:drawing").length - 1, 1);
    assert.ok(one.includes("CTN 1"));
    const two = await xmlOf(
      buildPqfDocument(BASE, [
        { bytes, kind: "png", width: 100, height: 100, caption: "" },
        { bytes, kind: undefined, width: undefined, height: undefined, caption: "second" },
      ])
    );
    assert.equal(two.split("<w:drawing").length - 1, 2);
    const three = await xmlOf(
      buildPqfDocument(BASE, [
        { bytes, kind: "jpg", width: 800, height: 600, caption: "a" },
        { bytes, kind: "jpg", width: 800, height: 600, caption: "b" },
        { bytes, kind: "jpg", width: 800, height: 600, caption: "c" },
      ])
    );
    assert.equal(three.split("<w:drawing").length - 1, 3);
  });
});
