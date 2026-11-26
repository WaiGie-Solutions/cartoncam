# Glossary — PQF damage reporter

Ubiquitous language for this repo. No implementation details.

- **PQF (Product Quality Feedback)**: The CKL form `CKL-P-089-(F01)-00`.
  One report covers one damage / quality event.
- **PQF No.**: Free-text report identifier, e.g. `ST-31426`. Suggested by the
  app (increments last trailing number), always editable. Filename defaults
  from it but is also free.
- **Receiving Damaged**: Damage found on inbound receipt (unloading).
  Fills the **Supplier Information** block; Customer block is hidden.
  Default mode. Example Write-Off Nature: **(B) Receiving Non-Conformance**.
- **Customer Feedback**: Complaint / return from a customer. Fills the
  **Customer Information** block; Supplier block is hidden.
- **Write-Off Nature (A–G)**: Single-letter classification. `A` In-House,
  `B` Receiving, `C` Sales Return, `D` QA Sample, `E` Customer Phase Out,
  `F` Inventory Overstock, `G` Vendor Return. v1 selects one, default `B`.
- **CTN list**: `CTN 1 … CTN N` where N = Quantity. Auto-generated from
  Quantity into Supporting Attachments. Quantity 334 → CTN 1–334.
- **Supporting Attachments**: CTN list + damage photos with optional captions,
  laid out 2-per-row in the generated `.docx`.
- **Recent reports / Libraries**: Browser-only memory of past form values
  (suppliers, products, containers) for dropdown reuse. Cleared with one button.
  Photos persist in IndexedDB on the same device; nothing is uploaded.
