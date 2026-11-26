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
npm install   # dev-only: jsdom + adm-zip for the test suite (docx ships in node_modules too)
npm test      # 38 node:test cases, enforced 100% lines/branches/functions on app.js, docx-gen.js, sw.js
```

## Quality gates (all green, no suppressions)

- `npm test` — 38 `node:test` cases with enforced thresholds: 100% lines,
  100% branches, 100% functions on `app.js`, `docx-gen.js`, `sw.js`.
- Semgrep (containers): `auto + javascript + security-audit + secrets +
  owasp-top-ten` — 0 findings.
- SonarQube Community (local podman): 0 open issues, 0 hotspots, Quality
  Gate OK (new coverage 100%, 0 violations, 0 duplication). Feed it LCOV via
  `sonar.javascript.lcov.reportPaths=coverage/lcov.info`
  (see `sonar-project.properties`).
- Gitleaks (container): no leaks. `npm audit`: 0 vulnerabilities.

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
- `docx-gen.js` — shared pure document builder (`escapeHtml`, `parseQty`, `calcTotal`, `ctnList`, `buildPqfDocument`), imported by `app.js`
- `test/` — node:test suite (jsdom harness in `helpers.mjs`); 100% line/branch/function coverage enforced by `npm test`
- `vendor/docx.mjs` — vendored Word library (no CDN at runtime)
- `manifest.webmanifest`, `sw.js` — installable PWA, offline app shell
