# CartonCam

No-login PWA that produces CKL Product Quality Feedback Forms (`CKL-P-089-(F01)-00`)
from phone photos — snap damage, auto-caption `CTN 1, 2, 3…`, download a
print-ready `.docx`. Built for one person on the warehouse floor, hosted free
on GitHub Pages.

- **App lives in [`docs/`](docs/)** (GitHub Pages serves it from there).
  See [`docs/README.md`](docs/README.md) for use, develop, and deploy notes.
- **Private repo, public unlisted URL.** Code is private to the
  `WaiGie-Solutions` org; the Pages URL works for anyone with the link.
  No report data ever leaves the device (browser-only storage, on-device Word
  generation, zero network calls at runtime).
- **Reference `.docx` files are never committed.** The original 19MB
  supplier template stays on disk next to the repo, ignored via `.gitignore`.

## Quality gates (all green, no suppressions)

| Gate | Result |
|---|---|
| `npm test` (run in `docs/`) — 39 tests, enforced 100% lines/branches/functions | ✅ pass |
| Semgrep (`auto + javascript + security-audit + secrets + owasp-top-ten`, podman) | ✅ 0 findings |
| SonarQube Community (podman server + scanner) | ✅ 0 issues, 0 hotspots, Quality Gate OK |
| Gitleaks | ✅ no leaks |
| `npm audit` | ✅ 0 vulnerabilities |

## Deploy

Repo Settings → **Pages** → Deploy from branch → `main` → folder `/docs`.
The app is then live at `https://<org>.github.io/cartoncam/`. No build step.
