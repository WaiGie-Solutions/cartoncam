# Product Quality Feedback (PQF) — damage reporter

No-login mobile + laptop web app that produces the CKL `CKL-P-089-(F01)-00`
Product Quality Feedback Form as a `.docx` identical in structure to the
reference file `PQF ST-31426 CHICKEN 3JW 15KG BULK LP FADEL 0091.docx`.

## Use

1. Open `index.html` (or the GitHub Pages URL) on mobile or laptop.
2. Pick **Receiving Damaged** (default) or **Customer Feedback**.
3. Fill the highlighted fields, snap / upload damage photos, add captions.
4. Tap **Download .docx**. Use **Print / PDF** for a PDF copy.

Everything stays in the browser (`localStorage` + IndexedDB). No account,
no server upload.

## Develop

Static site — no build step. The only dependency is `docx` (v9.16.0) vendored at `vendor/docx.mjs` in the browser via `importmap` (see `index.html`) and cached by the service worker for offline export.

```bash
npm install   # only for local node verification of the generator
npm test      # generates sample-pqf.docx from the chicken example
```

## Deploy to GitHub Pages (private repo, public unlisted URL)

1. `git init && git add . && git commit -m "pqf reporter"`
2. Create a **private** repo on GitHub, push.
3. Repo → **Settings → Pages** → Deploy from branch → `main` → `/ (root)`.
4. Share the `https://<user>.github.io/<repo>/` link. Code stays private,
   the URL is public-but-unlisted. No report data ever leaves the device.

> The 19MB reference `.docx` is intentionally **not** committed
> (see `.gitignore`). The app seeds the chicken example as defaults in code.

## Structure

- `index.html` — form + preview + recents
- `styles.css` — mobile-first styles + print CSS for PDF
- `app.js` — state, storage, photo compression, preview
- `docx-gen.js` — shared `buildPqfDocument(data)` used by browser + node test
- `test-generate.mjs` — node smoke test (`npm test`)
- `manifest.webmanifest`, `sw.js` — installable PWA, offline app shell
