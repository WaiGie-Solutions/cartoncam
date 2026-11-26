# ADR 1: Client-only PWA on GitHub Pages, no server

Date: 2026-11-26

## Context

Single non-technical user (wife) fills PQF damage reports on mobile/laptop.
Requested: no login, private repo, GitHub Pages hosting. Report photos are
sensitive; 40-photo reports reach ~19MB.

## Options

1. Static PWA, all generation + storage in browser (chosen)
2. Small backend (upload photos, generate server-side, share links)
3. Google Forms / Sheets + Apps Script mail-merge

## Decision

Option 1. `docx` runs in-browser via CDN importmap; photos compressed to
~1600px JPEG on-device; form libraries in `localStorage`; full reports
(incl. photo bytes) in IndexedDB. Nothing is uploaded anywhere.

## Consequences

- Good: zero cost, zero ops, works offline after first load, privacy by
  construction, matches "unlisted URL is fine".
- Bad: no cross-device sync (reports live on the device that made them);
  first load needs network for the `docx` CDN; very large photo sets are
  limited by device memory. Acceptable for v1 — export `.docx` is the
  transfer mechanism.
- Revisit if: multi-user review flow or shared history is ever needed.
