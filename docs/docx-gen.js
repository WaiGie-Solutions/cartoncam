import {
  AlignmentType,
  Document,
  Header,
  ImageRun,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const A4 = { width: 11906, height: 16838 };
const FULL = 9026; // usable DXA with ~1in margins
const FONT = "Arial";
const FS = (n) => n * 2; // pt -> half-points

export const MAX_CTNS = 500;

export function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

export function tr(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: FS(opts.size ?? 9),
    bold: !!opts.bold,
    italics: !!opts.italic,
  });
}

export function p(text, opts = {}) {
  if (Array.isArray(text)) return new Paragraph({ children: text, alignment: opts.align, spacing: { after: 40 } });
  return new Paragraph({
    children: [tr(text, opts)],
    alignment: opts.align,
    spacing: { after: 40 },
  });
}

export function heading(title) {
  return new Paragraph({
    children: [tr(title, { bold: true, size: 11 })],
    shading: { type: ShadingType.CLEAR, fill: "D9E2F3" },
    spacing: { before: 200, after: 80 },
  });
}

export function cell(text, { w, bold, size, shade, align } = {}) {
  return new TableCell({
    width: { size: w ?? 1000, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    children: [p(text, { bold, size, align })],
  });
}

export function checkCell(checked) {
  return cell(checked ? "√" : "", { w: 400, align: AlignmentType.CENTER, bold: true, size: 12 });
}

export function labelCell(label, value, wLabel = 1600, wValue = 2900) {
  return [cell(label, { w: wLabel, bold: true, size: 9, shade: "EAEFF7" }), cell(value, { w: wValue, size: 9 })];
}

export function simpleTable(columnWidths, rows) {
  return new Table({
    columnWidths,
    width: { size: FULL, type: WidthType.DXA },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: r.map((c, i) =>
            c instanceof TableCell ? c : cell(c ?? "", { w: columnWidths[i] ?? 1000 })
          ),
        })
    ),
  });
}

const WRITEOFF = [
  ["A", "In-House Non-Conformance"],
  ["B", "Receiving Non-Conformance"],
  ["C", "Sales Return"],
  ["D", "QA Sample"],
  ["E", "Customer Phase Out"],
  ["F", "Inventory Overstock"],
  ["G", "Vendor Return"],
];

export function parseQty(v) { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_CTNS) : 0; }
export function calcTotal(qty, unitPrice) { if (unitPrice === "" || unitPrice == null) return ""; const q = typeof qty === "number" ? qty : parseQty(qty); const p = Number(unitPrice); return q && Number.isFinite(p) ? (q * p).toFixed(2) : ""; }
export function ctnList(quantity) {
  const n = parseQty(quantity);
  const out = [];
  for (let i = 1; i <= n; i++) out.push(`CTN ${i}`);
  return out;
}

export function defaultDetail(qty) {
  return `Finding during unloading, ${qty || "___"} cartons found damaged`;
}

export function suggestFilename(data) {
  const code = (data.productCode || "ITEM").replace(/[^A-Za-z0-9-]+/g, "").slice(0, 24) || "ITEM";
  const desc = (data.productDesc || "").split(" ").slice(0, 4).join(" ").replace(/[^A-Za-z0-9 ]+/g, "").trim();
  return `PQF ${data.pqfNo || "DRAFT"} ${code}${desc ? " " + desc : ""}`.trim().slice(0, 120);
}

/** data: flat form object. photos: [{bytes:Uint8Array, kind, width, height, caption}] */
export function buildPqfDocument(data, photos = []) {
  const d = data;
  const total = calcTotal(d.quantity, d.unitPrice);

  const header = new Header({
    children: [
      p("COMMONWEALTH KOKUBU LOGISTICS PTE LTD", { bold: true, size: 10, align: AlignmentType.CENTER }),
      simpleTable([3000, 3000, 3026], [
        [cell("Product Quality Feedback Form", { w: 3000, bold: true, size: 9 }), cell("Form Identification:", { w: 3000, bold: true, size: 8 }), cell("CKL-P-089-(F01)-00", { w: 3026, size: 8 })],
        [cell("Title: Product Quality Feedback Form", { w: 3000, bold: true, size: 8 }), cell("Form Effective Date:", { w: 3000, bold: true, size: 8 }), cell("01 March 2021", { w: 3026, size: 8 })],
      ]),
    ],
  });

  const children = [];
  children.push(
    simpleTable([1500, 3013, 1500, 3013], [[...labelCell("Date of Feedback:", d.dateOfFeedback, 1500, 3013), ...labelCell("PQF No.:", d.pqfNo, 1500, 3013)]])
  );

  if (d.reportType === "feedback") {
    children.push(heading("Customer Information (For Customer Feedback)"));
    children.push(
      simpleTable([1500, 3013, 1500, 3013], [
        [...labelCell("Company Name", d.companyName, 1500, 3013), ...labelCell("Outlet", d.outlet, 1500, 3013)],
        [...labelCell("Customer Name", d.customerName, 1500, 3013), ...labelCell("Delivery Order/Date", d.doDate, 1500, 3013)],
        [...labelCell("Email Address", d.email, 1500, 3013), ...labelCell("Contact Number", d.contact, 1500, 3013)],
      ])
    );
  } else {
    children.push(heading("Supplier Information (For Receiving Damaged)"));
    children.push(
      simpleTable([1500, 3013, 1500, 3013], [
        [cell("Name of Supplier", { w: 1500, bold: true, size: 9, shade: "EAEFF7" }), cell(d.supplierName, { w: 3013, size: 9 }), cell("", { w: 1500 }), cell("", { w: 3013 })],
        [...labelCell("Invoice/DO/PO No.", d.invoicePo, 1500, 3013), ...labelCell("Date Received", d.dateReceived, 1500, 3013)],
        [...labelCell("Container No.", d.containerNo, 1500, 3013), cell(d.containerNo2 || d.containerNo, { w: 1500, size: 9 }), cell(d.containerNo3 || d.containerNo, { w: 3013, size: 9 })], // 3-cell row mirrors the reference doc which repeats the single container number (Q1 replica); loaded records may carry split values.
      ])
    );
  }

  children.push(heading("Product Information"));
  children.push(
    simpleTable([1400, 2800, 1200, 900, 700, 1000, 1026], [
      [
        cell("Product Code", { w: 1400, bold: true, size: 8, shade: "EAEFF7" }),
        cell("Product Description", { w: 2800, bold: true, size: 8, shade: "EAEFF7" }),
        cell("Expiry Date", { w: 1200, bold: true, size: 8, shade: "EAEFF7" }),
        cell("Quantity", { w: 900, bold: true, size: 8, shade: "EAEFF7" }),
        cell("UOM", { w: 700, bold: true, size: 8, shade: "EAEFF7" }),
        cell("Unit Price (S$)", { w: 1000, bold: true, size: 8, shade: "EAEFF7" }),
        cell("Total Cost (S$)", { w: 1026, bold: true, size: 8, shade: "EAEFF7" }),
      ],
      [
        cell(d.productCode, { w: 1400, size: 9 }),
        cell(d.productDesc, { w: 2800, size: 9 }),
        cell(d.expiry, { w: 1200, size: 9 }),
        cell(d.quantity, { w: 900, size: 9 }),
        cell(d.uom, { w: 700, size: 9 }),
        cell(d.unitPrice, { w: 1000, size: 9 }),
        cell(total, { w: 1026, size: 9 }),
      ],
    ])
  );

  children.push(heading("Write Off Nature"));
  const left = ["A", "B", "C", "D"].map((k) => {
    const label = WRITEOFF.find((w) => w[0] === k)[1];
    return [cell(`(${k})`, { w: 500, size: 9 }), cell(label, { w: 2600, size: 9 }), checkCell(d.writeOff === k)];
  });
  const right = ["E", "F", "G", ""].map((k) => {
    if (!k) return [cell("", { w: 500 }), cell("", { w: 2600 }), cell("", { w: 400 })];
    const label = WRITEOFF.find((w) => w[0] === k)[1];
    return [cell(`(${k})`, { w: 500, size: 9 }), cell(label, { w: 1600, size: 9 }), checkCell(d.writeOff === k)];
  });
  children.push(
    new Table({
      columnWidths: [500, 2600, 400, 500, 1600, 400],
      width: { size: FULL, type: WidthType.DXA },
      rows: left.map(
        (lr, i) =>
          new TableRow({
            children: [
              ...lr.map((c) => c),
              ...right[i].map((c) => c),
            ],
          })
      ),
    })
  );

  children.push(heading("Detail of Feedback"));
  children.push(simpleTable([FULL], [[cell(d.detail, { w: FULL, size: 9 })]]));

  children.push(heading("Root Cause Analysis, Corrections & Corrective Actions"));
  children.push(
    simpleTable([2200, 6826], [
      [cell("Root Cause Analysis", { w: 2200, bold: true, size: 9, shade: "EAEFF7" }), cell(d.rootCause, { w: 6826, size: 9 })],
      [cell("Corrections", { w: 2200, bold: true, size: 9, shade: "EAEFF7" }), cell(d.corrections, { w: 6826, size: 9 })],
      [cell("Corrective Actions", { w: 2200, bold: true, size: 9, shade: "EAEFF7" }), cell(d.corrective, { w: 6826, size: 9 })],
    ])
  );

  children.push(heading("Verification of Corrective Actions"));
  children.push(
    simpleTable([2256, 2250, 2250, 2270], [
      [
        cell("Corrective Actions", { w: 2256, bold: true, size: 8, shade: "EAEFF7" }),
        cell("Satisfactory / Not Satisfactory", { w: 2250, size: 8 }),
        cell("Satisfactory / Not Satisfactory", { w: 2250, size: 8 }),
        cell("Satisfactory / Not Satisfactory", { w: 2270, size: 8 }),
      ],
      [cell("Verified by", { w: 2256, bold: true, size: 8, shade: "EAEFF7" }), cell("", { w: 2250 }), cell("Date", { w: 2250, bold: true, size: 8, shade: "EAEFF7" }), cell("", { w: 2270 })],
    ])
  );

  children.push(heading("Recall Activation"));
  children.push(
    simpleTable([2256, 2250, 2250, 2270], [
      [cell("Recall Required", { w: 2256, bold: true, size: 8, shade: "EAEFF7" }), cell("Yes / No", { w: 2250, size: 8 }), cell("Yes / No", { w: 2250, size: 8 }), cell("Yes / No", { w: 2270, size: 8 })],
      [cell("Recall Coordinator", { w: 2256, bold: true, size: 8, shade: "EAEFF7" }), cell("", { w: 2250 }), cell("Recall Authorized by (Name & Signature)", { w: 2250, bold: true, size: 8, shade: "EAEFF7" }), cell("", { w: 2270 })],
      [cell("Date", { w: 2256, bold: true, size: 8, shade: "EAEFF7" }), cell("", { w: 2250 }), cell("Recall Authorized by (Name & Signature)", { w: 2250, bold: true, size: 8, shade: "EAEFF7" }), cell("", { w: 2270 })],
    ])
  );

  children.push(heading("Costing"));
  children.push(p("A. CKL's Inventory", { bold: true, size: 9 }));
  children.push(p("(i) Billable to external party", { italic: true, size: 9 }));
  children.push(
    simpleTable([800, 1700, 800, 1700, 800, 2226], [
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Customer:", { w: 1700, size: 9 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("", { w: 1700 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Supplier:", { w: 2226, size: 9 })],
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Service Provider:", { w: 1700, size: 9 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("", { w: 1700 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Staff:", { w: 2226, size: 9 })],
    ])
  );
  children.push(p("(ii) Not billable to external party", { italic: true, size: 9 }));
  children.push(
    simpleTable([800, 1700, 800, 1700, 800, 2226], [
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("DC", { w: 1700, size: 9 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("", { w: 1700 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Inventory", { w: 2226, size: 9 })],
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Logistics", { w: 1700, size: 9 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("", { w: 1700 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Business Decision (Good will)", { w: 2226, size: 9 })],
    ])
  );
  children.push(p("B. Third Party Logistics Customer's Inventory", { bold: true, size: 9 }));
  children.push(
    simpleTable([800, 1700, 800, 1700, 800, 2226], [
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("DC to absorb", { w: 1700, size: 9 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("", { w: 1700 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("No cost complication (with customer consent)", { w: 2226, size: 8 })],
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Logistics to absorb", { w: 1700, size: 9 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("", { w: 1700 }), cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("No cost complication (alignment of WMS and SAP)", { w: 2226, size: 8 })],
    ])
  );

  children.push(heading("Acknowledgement"));
  children.push(
    simpleTable([3008, 3009, 3009], [
      [cell("Head of Department (Ops / Inv)", { w: 3008, bold: true, size: 8, shade: "EAEFF7" }), cell("Signature, Name:", { w: 3009, size: 8 }), cell("Date:", { w: 3009, size: 8 })],
      [cell("Executive Director", { w: 3008, bold: true, size: 8, shade: "EAEFF7" }), cell("Signature, Name:", { w: 3009, size: 8 }), cell("Date:", { w: 3009, size: 8 })],
    ])
  );

  children.push(heading("System Adjustment"));
  children.push(
    simpleTable([2256, 2250, 2250, 2270], [
      [cell("Adjustment", { w: 2256, bold: true, size: 8, shade: "EAEFF7" }), cell("Performed by (Signature, Name)", { w: 2250, bold: true, size: 8, shade: "EAEFF7" }), cell("Reference Number", { w: 2250, bold: true, size: 8, shade: "EAEFF7" }), cell("Date", { w: 2270, bold: true, size: 8, shade: "EAEFF7" })],
      [cell("A. WMS adjustment", { w: 2256, size: 8 }), cell("", { w: 2250 }), cell("", { w: 2250 }), cell("", { w: 2270 })],
      [cell("B. SAP adjustment", { w: 2256, size: 8 }), cell("", { w: 2250 }), cell("", { w: 2250 }), cell("", { w: 2270 })],
      [cell("C. Finance review", { w: 2256, size: 8 }), cell("", { w: 2250 }), cell("", { w: 2250 }), cell("", { w: 2270 })],
    ])
  );

  children.push(heading("Product Disposition"));
  children.push(p("A. Disposition", { bold: true, size: 9 }));
  children.push(
    simpleTable([800, 2200, 3000, 3026], [
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Disposal", { w: 2200, size: 9 }), cell("Disposed by:", { w: 3000, size: 8 }), cell("Date:", { w: 3026, size: 8 })],
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Delivered to customer", { w: 2200, size: 9 }), cell("Doc. Ref. No.:", { w: 3000, size: 8 }), cell("Date:", { w: 3026, size: 8 })],
      [cell("☐", { w: 800, align: AlignmentType.CENTER }), cell("Exchanged with supplier", { w: 2200, size: 9 }), cell("Doc. Ref. No.:", { w: 3000, size: 8 }), cell("Date:", { w: 3026, size: 8 })],
    ])
  );
  children.push(p("B. Verification", { bold: true, size: 9 }));
  children.push(
    simpleTable([4513, 4513], [
      [cell("QA Verification", { w: 4513, bold: true, size: 9, shade: "EAEFF7" }), cell("Operation Verification", { w: 4513, bold: true, size: 9, shade: "EAEFF7" })],
      [cell("Signature, Name:", { w: 4513, size: 8 }), cell("Signature, Name:", { w: 4513, size: 8 })],
      [cell("Date:", { w: 4513, size: 8 }), cell("Date:", { w: 4513, size: 8 })],
    ])
  );

  children.push(heading("Supporting Attachments"));
  const ctns = ctnList(d.quantity);
  children.push(
    simpleTable([FULL], [[cell(ctns.join("    ") || "(no CTNs — set Quantity)", { w: FULL, size: 8 })]])
  );

  if (photos.length) {
    for (let i = 0; i < photos.length; i += 2) {
      const pair = photos.slice(i, i + 2);
      children.push(
        new Table({
          columnWidths: [4513, 4513],
          width: { size: FULL, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: pair.map((ph) => {
                const scale = Math.min(1, 300 / (ph.width || 300));
                const w = Math.round((ph.width || 300) * scale);
                const h = Math.round((ph.height || 300) * scale);
                const img = new ImageRun({ data: ph.bytes, transformation: { width: w, height: h }, type: ph.kind === "png" ? "png" : "jpg" });
                const cap = ph.caption ? [new Paragraph({ children: [tr(ph.caption, { size: 8, italic: true })], alignment: AlignmentType.CENTER })] : [];
                return new TableCell({
                  width: { size: 4513, type: WidthType.DXA },
                  children: [new Paragraph({ children: [img], alignment: AlignmentType.CENTER }), ...cap],
                });
              }),
            }),
          ],
        })
      );
    }
  } else {
    children.push(p("(No photos attached)", { italic: true, size: 9 }));
  }

  return new Document({
    sections: [
      {
        headers: { default: header },
        properties: { page: { size: A4 } },
        children,
      },
    ],
  });
}
