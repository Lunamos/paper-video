// Render many stills of one composition with a single bundle (much faster than repeated `npx remotion still`).
//
// Usage: node scripts/stills.mjs <CompositionId> <outDir> <frames> [--scale 0.5] [--props '{"k":1}']
//   <frames>: comma-separated absolute frames, or "@file" with one frame per line ("frame label" allowed).
// Writes <outDir>/<CompositionId>_<frame>[_<label>].png and prints the paths (one per line).
// Typical use: python3 scripts/review.py builds the frame list from the anchors and tiles a contact sheet.
// Cleans up after itself: the bundle (a copy of the project incl. public/, often 50+ MB, written to $TMPDIR) is deleted
// and the headless browser closed on success, error or Ctrl-C. (An earlier version left one bundle per run: 30+ GB.)
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [comp, outDir, framesArg, ...rest] = process.argv.slice(2);
if (!comp || !outDir || !framesArg) {
  console.error("usage: node scripts/stills.mjs <CompositionId> <outDir> <frames|@file> [--scale 0.5] [--props JSON]");
  process.exit(1);
}
const opt = (name, def) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : def;
};
const scale = Number(opt("--scale", "1"));
const inputProps = JSON.parse(opt("--props", "{}"));
const items = (framesArg.startsWith("@") ? fs.readFileSync(framesArg.slice(1), "utf8").split("\n") : framesArg.split(","))
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [f, ...label] = s.split(/\s+/);
    return { frame: Number(f), label: label.join("_").replace(/[^\w.-]/g, "") };
  });

fs.mkdirSync(outDir, { recursive: true });
let serveUrl = null;
let browser = null;
// Remotion's temp dirs (bundle, downloaded assets) that appear while this script runs are removed at the end.
const tmp = os.tmpdir();
const ours = (n) => n.startsWith("remotion-");
const before = new Set(fs.readdirSync(tmp).filter(ours));
const removeTemp = () => {
  // synchronous on purpose: on Ctrl-C the renderer's own handler may exit the process before async work finishes
  if (serveUrl) fs.rmSync(serveUrl, { recursive: true, force: true });
  serveUrl = null;
  for (const n of fs.readdirSync(tmp).filter(ours)) if (!before.has(n)) fs.rmSync(path.join(tmp, n), { recursive: true, force: true });
};
const cleanup = async () => {
  removeTemp();
  if (browser) await browser.close({ silent: true }).catch(() => undefined);
  browser = null;
};
process.on("exit", removeTemp);
for (const sig of ["SIGINT", "SIGTERM"]) process.prependListener(sig, () => { removeTemp(); cleanup().finally(() => process.exit(130)); });
try {
  serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => undefined });
  browser = await openBrowser("chrome", { logLevel: "error" });
  const composition = await selectComposition({ serveUrl, id: comp, inputProps, puppeteerInstance: browser });
  for (const { frame, label } of items) {
    const f = Math.max(0, Math.min(composition.durationInFrames - 1, frame));
    const output = path.join(outDir, `${comp}_${String(f).padStart(5, "0")}${label ? "_" + label : ""}.png`);
    await renderStill({ composition, serveUrl, output, frame: f, scale, inputProps, logLevel: "error", puppeteerInstance: browser });
    console.log(output);
  }
} finally {
  await cleanup();
}
