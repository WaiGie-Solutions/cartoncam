import { Packer } from "docx";
import { writeFileSync } from "node:fs";
import { buildPqfDocument } from "./docx-gen.js";

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
