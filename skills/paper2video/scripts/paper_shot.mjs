// Picture of the paper for the title card's background: the first page of its PDF (title, authors, affiliations,
// abstract) rendered as a sharp PNG — or, for a paper that only exists as a web article, the first screen of that page.
//
// Usage: node scripts/paper_shot.mjs <arXiv id | arXiv URL | paper.pdf | PDF URL | web URL> [--out public/shots/paper.png]
//   arXiv id / URL (2309.16588, 2309.16588v2, https://arxiv.org/abs/...): downloads https://arxiv.org/pdf/<id> to
//     data/arxiv_<id>.pdf (kept: later runs reuse it) and renders page 1.
//   local PDF path or a URL ending in .pdf: renders page 1 (a downloaded PDF is kept in data/).
//   any other URL: screenshot of the page's first screen in a light colour scheme, cookie / consent banners removed.
// PDF options:  --page 1  --dpi 200 (a US-letter page → 1700×2200 px)
// Web options:  --width 1100 --height 1000 (css px) --scale 2 --until <selector> (crop at its bottom) --hide "<selectors>"
//               --wait 1500 (ms for late fonts / MathJax)
// Prints the output path and its pixel size.
// PDF rendering: poppler's `pdftoppm` when it is installed, else PyMuPDF through `uv run --with pymupdf` (uv cache:
// $UV_CACHE_DIR). Web pages: Remotion's headless Chrome (the one `npx remotion` downloads) over the DevTools protocol.
// No new dependencies. Temp files under $PAPER_VIDEO_TMPDIR, removed at the end; the browser is always closed.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

if (process.env.PAPER_VIDEO_TMPDIR) process.env.TMPDIR = process.env.PAPER_VIDEO_TMPDIR;

const [target, ...rest] = process.argv.slice(2);
if (!target || target.startsWith("--")) {
  console.error("usage: node scripts/paper_shot.mjs <arXiv id | paper.pdf | PDF URL | web URL> [--out public/shots/paper.png] [--page 1] [--dpi 200] [--width 1100] [--height 1000]");
  process.exit(1);
}
const opt = (name, def) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : def;
};
const out = path.resolve(opt("--out", "public/shots/paper.png"));
const rel = (p) => path.relative(process.cwd(), p);
const pngSize = (file) => {
  const b = fs.readFileSync(file);
  return `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`;
};

const ARXIV_ID = /^(\d{4}\.\d{4,5}(v\d+)?|[a-z-]+(\.[A-Z]{2})?\/\d{7}(v\d+)?)$/;
const arxivFromUrl = target.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#]+?)(?:\.pdf)?\/?$/);
const arxivId = ARXIV_ID.test(target) ? target : arxivFromUrl ? arxivFromUrl[1] : null;

// ---------------------------------------------------------------- PDF → page 1 as PNG
const download = async (url, file) => {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  const res = await fetch(url, { headers: { "User-Agent": "paper2video paper_shot (title-card still)" }, redirect: "follow" });
  if (!res.ok) throw new Error(`download failed: ${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`not a PDF: ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.error(`downloaded ${rel(file)} (${(buf.length / 1e6).toFixed(1)} MB)`);
  return file;
};

const renderPdf = (pdf) => {
  const page = Number(opt("--page", "1"));
  const dpi = Number(opt("--dpi", "200"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const hasPdftoppm = spawnSync("pdftoppm", ["-v"], { stdio: "ignore" }).error === undefined;
  if (hasPdftoppm) {
    // -singlefile writes <stem>.png exactly
    execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-r", String(dpi), "-png", "-singlefile", pdf, out.replace(/\.png$/i, "")]);
  } else {
    const py = "import sys, pymupdf\nd = pymupdf.open(sys.argv[1])\nd[int(sys.argv[3]) - 1].get_pixmap(dpi=int(sys.argv[4]), alpha=False).save(sys.argv[2])\n";
    execFileSync("uv", ["run", "--quiet", "--with", "pymupdf", "python", "-c", py, pdf, out, String(page), String(dpi)], { stdio: ["ignore", "inherit", "inherit"] });
  }
  console.log(`${rel(out)}  ${pngSize(out)}  (page ${page} of ${rel(pdf)}, ${dpi} dpi, ${hasPdftoppm ? "pdftoppm" : "pymupdf"})`);
};

if (arxivId || /\.pdf$/i.test(target.split(/[?#]/)[0])) {
  let pdf;
  if (arxivId) pdf = await download(`https://arxiv.org/pdf/${arxivId}`, path.resolve("data", `arxiv_${arxivId.replace(/\//g, "_")}.pdf`));
  else if (/^https?:\/\//.test(target)) pdf = await download(target, path.resolve("data", path.basename(new URL(target).pathname)));
  else pdf = path.resolve(target);
  if (!fs.existsSync(pdf)) throw new Error(`no such PDF: ${pdf}`);
  renderPdf(pdf);
  process.exit(0);
}

// ---------------------------------------------------------------- web article → first screen
const { ensureBrowser } = await import("@remotion/renderer");
const url = target;
const width = Number(opt("--width", "1100"));
const height = Number(opt("--height", "1000"));
const scale = Number(opt("--scale", "2"));
const until = opt("--until", null);
const waitMs = Number(opt("--wait", "1500"));
const HIDE = [
  '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]', '[aria-label*="cookie" i]',
  ...(opt("--hide", "") ? [opt("--hide", "")] : []),
].join(", ");

const { path: chrome } = await ensureBrowser().then((s) => ("path" in s ? s : Promise.reject(new Error(`no browser: ${s.type}`))));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "paper-shot-"));
const proc = spawn(
  chrome,
  ["--headless", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--mute-audio", "--lang=en-US", "about:blank"],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const exited = new Promise((r) => proc.once("exit", r));
const cleanup = () => {
  if (proc.exitCode === null) proc.kill("SIGKILL");
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    console.error(`note: could not remove ${profile}`);
  }
};
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));

const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("browser did not start:\n" + buf)), 20000);
  proc.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) {
      clearTimeout(t);
      resolve(m[1]);
    }
  });
  proc.on("exit", (c) => reject(new Error(`browser exited (${c}):\n${buf}`)));
});

const ws = new WebSocket(wsUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let nextId = 1;
const pending = new Map();
const listeners = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
    else resolve(msg.result);
  } else if (msg.method) for (const l of listeners) l(msg);
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
const once = (method, sessionId, ms = 45000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), ms);
    listeners.push((m) => {
      if (m.method === method && m.sessionId === sessionId) {
        clearTimeout(t);
        resolve(m.params);
      }
    });
  });

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, s);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send("Page.enable", {}, s);
  // a desktop-width page, light colour scheme, 2× pixels
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false }, s);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] }, s);
  const loaded = once("Page.loadEventFired", s);
  const nav = await send("Page.navigate", { url }, s);
  if (nav.errorText) throw new Error(`could not load ${url}: ${nav.errorText}`);
  await loaded;
  await evaluate(`document.fonts.ready.then(() => true)`);
  await evaluate(`window.MathJax?.startup?.promise ? window.MathJax.startup.promise.then(() => true) : true`);
  await new Promise((r) => setTimeout(r, waitMs)); // late layout: web fonts, MathJax, lazy images
  const removed = await evaluate(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(HIDE)})]; els.forEach((e) => e.remove()); return els.length; })()`);

  // crop: the first screen, or from the top down to the bottom of `until` (at most --height)
  let h = height;
  if (until) {
    const bottom = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(until)}); return e ? e.getBoundingClientRect().bottom + scrollY : null; })()`);
    if (bottom === null) console.error(`warning: ${until} not found on the page; using --height`);
    else h = Math.min(height, Math.round(bottom));
  }
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } }, s);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`${rel(out)}  ${pngSize(out)}  (first screen of ${url}${removed ? `, removed ${removed} banner element(s)` : ""})`);
  await send("Browser.close").catch(() => undefined);
} finally {
  ws.close();
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]); // let Chrome finish writing its profile
  cleanup();
}
process.exit(0);
