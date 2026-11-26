// Shared jsdom + browser-API mocks for app.js tests. Test-only file.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function setupDom({ serviceWorker } = {}) {
  const html = readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
  globalThis.File = window.File;

  // ---- controllable Image mock (canvas decode) ----
  globalThis.__imgW = 800;
  globalThis.__imgH = 600;
  globalThis.__imgFail = false;
  globalThis.Image = class {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.width = 0;
      this.height = 0;
    }
    set src(v) {
      this.width = globalThis.__imgW;
      this.height = globalThis.__imgH;
      setTimeout(() => {
        if (globalThis.__imgFail) this.onerror?.(new Error("decode"));
        else this.onload?.();
      }, 0);
    }
  };

  // ---- canvas mock (jsdom has no 2d context) ----
  globalThis.__toDataUrl = "data:image/jpeg;base64,AAA";
  const origCreate = window.document.createElement.bind(window.document);
  window.document.createElement = (tag, opts) => {
    if (String(tag).toLowerCase() === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() { /* recorded by mock */ } }),
        toDataURL: () => globalThis.__toDataUrl,
      };
    }
    return origCreate(tag, opts);
  };

  // ---- URL object-URL mocks ----
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
  globalThis.URL.createObjectURL = () => "blob:mock";
  globalThis.URL.revokeObjectURL = () => {};

  // ---- dialogs / shell ----
  globalThis.__confirmResult = true;
  globalThis.confirm = () => globalThis.__confirmResult;
  globalThis.__printed = 0;
  window.print = () => { globalThis.__printed += 1; };
  window.scrollTo = () => {};

  // ---- service worker (absent unless requested) ----
  if (serviceWorker !== undefined) {
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: serviceWorker,
      configurable: true,
    });
  }

  // ---- in-memory IndexedDB mock ----
  const mock = {
    _store: new Map(),
    _failOpen: false,
    _failOp: null,
  };
  function op(kind, fn) {
    const req = {};
    setTimeout(() => {
      if (mock._failOp === kind) {
        req.error = new Error(kind);
        if (req.onerror) req.onerror({ target: req });
        return;
      }
      const v = fn();
      req.result = v;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  mock.open = () => {
    const req = {};
    setTimeout(() => {
      if (mock._failOpen) {
        req.error = new Error("open");
        if (req.onerror) req.onerror({ target: req });
        return;
      }
      req.result = {
        createObjectStore() {},
        transaction() {
          return {
            objectStore: () => ({
              getAll: () => op("getAll", () => (mock._nullGetAll ? null : [...mock._store.values()])),
              put: (rec) => op("put", () => { mock._store.set(rec.id, rec); }),
              get: (id) => op("get", () => mock._store.get(id)),
              clear: () => op("clear", () => { mock._store.clear(); }),
            }),
          };
        },
      };
      if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  };
  globalThis.indexedDB = mock;
  return { window, mock };
}

export function setField(id, value) {
  const el = document.getElementById(id);
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

export function click(id) {
  document.getElementById(id).click();
}

export function fileNamed(name, type, content = "bytes") {
  return new window.File([content], name, { type });
}

export function attachFiles(inputId, files) {
  const input = document.getElementById(inputId);
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

export function dropFiles(files) {
  const dz = document.getElementById("dropzone");
  const ev = new window.Event("drop", { bubbles: true, cancelable: true });
  ev.dataTransfer = { files };
  dz.dispatchEvent(ev);
}

export function dropEmpty() {
  const dz = document.getElementById("dropzone");
  dz.dispatchEvent(new window.Event("drop", { bubbles: true, cancelable: true }));
}

export function pasteFiles(files) {
  const ev = new window.Event("paste", { bubbles: true, cancelable: true });
  if (files) ev.clipboardData = { files };
  document.getElementById("f").dispatchEvent(ev);
}
