// Screenshot of the paper's page for the title card: the arXiv abstract page (id + title + authors + start of the
// abstract), or the first screen of any URL (a blog-style paper without arXiv). Light page as it is, 2× pixels.
//
// Usage: node scripts/page_shot.mjs <arXiv id | arXiv URL | URL> [--out public/shots/arxiv.png] [--width 640|1100]
//          [--height auto|<css px>] [--until <selector>] [--scale 2] [--hide "<css selectors>"] [--wait 1500]
//   arXiv id (2309.16588, 2309.16588v2, hep-th/9901001) → https://arxiv.org/abs/<id>, cropped from the top of the page
//   down to the first lines of the abstract. Any other URL: the first screen (--height, default 760 css px).
//   --until <selector>: crop down to that element instead (its bottom, capped by --height when a number is given).
//   --hide: extra elements to remove before the shot (cookie / consent banners are removed by default).
// Prints the output path and its pixel size. No dependencies beyond Remotion: it drives Remotion's headless Chrome
// (the one `npx remotion` downloads) through the DevTools protocol. Temp profile under $PAPER_VIDEO_TMPDIR, removed
// at the end; the browser is always closed.
import { ensureBrowser } from "@remotion/renderer";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

if (process.env.PAPER_VIDEO_TMPDIR) process.env.TMPDIR = process.env.PAPER_VIDEO_TMPDIR;

const [target, ...rest] = process.argv.slice(2);
if (!target || target.startsWith("--")) {
  console.error("usage: node scripts/page_shot.mjs <arXiv id | URL> [--out public/shots/arxiv.png] [--width 640|1100] [--height auto|px] [--until selector] [--scale 2] [--hide selectors]");
  process.exit(1);
}
const opt = (name, def) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : def;
};

const ARXIV_ID = /^(\d{4}\.\d{4,5}(v\d+)?|[a-z-]+(\.[A-Z]{2})?\/\d{7}(v\d+)?)$/;
const arxivFromUrl = target.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#]+?)(?:\.pdf)?\/?$/);
const arxivId = ARXIV_ID.test(target) ? target : arxivFromUrl ? arxivFromUrl[1] : null;
const url = arxivId ? `https://arxiv.org/abs/${arxivId}` : target;
const out = path.resolve(opt("--out", arxivId ? "public/shots/arxiv.png" : "public/shots/page.png"));
const width = Number(opt("--width", arxivId ? "640" : "1100")); // arXiv below 768 px: its one-column layout, with the "arXiv:<id>" line
const scale = Number(opt("--scale", "2"));
const heightArg = opt("--height", "auto");
const until = opt("--until", arxivId ? "blockquote.abstract" : null);
const waitMs = Number(opt("--wait", "1500"));
const HIDE = [
  '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]', '[aria-label*="cookie" i]',
  ...(arxivId ? [".mobile-submission-download", ".slider-wrapper", ".bps-banner", "aside.slider"] : []), // arXiv: the big PDF / HTML buttons, banners
  ...(opt("--hide", "") ? [opt("--hide", "")] : []),
].join(", ");

// ---------------------------------------------------------------- browser
const { path: chrome } = await ensureBrowser().then((s) => ("path" in s ? s : Promise.reject(new Error(`no browser: ${s.type}`))));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "page-shot-"));
const proc = spawn(
  chrome,
  ["--headless", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--mute-audio", "--lang=en-US", "about:blank"],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const cleanup = () => {
  if (proc.exitCode === null) proc.kill("SIGKILL");
  fs.rmSync(profile, { recursive: true, force: true });
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
  await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: scale, mobile: false }, s);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] }, s);
  const loaded = once("Page.loadEventFired", s);
  const nav = await send("Page.navigate", { url }, s);
  if (nav.errorText) throw new Error(`could not load ${url}: ${nav.errorText}`);
  await loaded;
  await evaluate(`document.fonts.ready.then(() => true)`);
  await evaluate(`window.MathJax?.startup?.promise ? window.MathJax.startup.promise.then(() => true) : true`);
  await new Promise((r) => setTimeout(r, waitMs)); // late layout: web fonts, MathJax, lazy images
  const removed = await evaluate(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(HIDE)})]; els.forEach((e) => e.remove()); return els.length; })()`);

  // crop: from the top of the page, down to `until` (first lines of the arXiv abstract) or a fixed height
  const box = until
    ? await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(until)}); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; })()`)
    : null;
  if (until && !box) console.error(`warning: ${until} not found on the page; using a fixed height`);
  let height;
  if (heightArg !== "auto") height = Number(heightArg);
  else if (box && arxivId) height = Math.min(box.bottom, box.top + 320); // id, title, authors and most of the abstract (the 9:16 card crops it)
  else if (box) height = box.bottom;
  else height = 760;
  if (box && heightArg !== "auto") height = Math.min(height, box.bottom);
  height = Math.round(Math.max(200, height));

  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } }, s);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`${path.relative(process.cwd(), out)}  ${width * scale}×${height * scale}  (${url}${removed ? `, removed ${removed} banner element(s)` : ""})`);
  await send("Browser.close").catch(() => undefined);
} finally {
  ws.close();
  cleanup();
}
process.exit(0);
