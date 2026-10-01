// Render many stills of one composition with a single bundle (much faster than repeated `npx remotion still`).
//
// Usage: node scripts/stills.mjs <CompositionId> <outDir> <frames> [--scale 0.5] [--props '{"k":1}']
//   <frames>: comma-separated absolute frames, or "@file" with one frame per line ("frame label" allowed).
// Writes <outDir>/<CompositionId>_<frame>[_<label>].png and prints the paths (one per line).
// Typical use: python3 scripts/review.py builds the frame list from the anchors and tiles a contact sheet.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
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
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => undefined });
const composition = await selectComposition({ serveUrl, id: comp, inputProps });
for (const { frame, label } of items) {
  const f = Math.max(0, Math.min(composition.durationInFrames - 1, frame));
  const output = path.join(outDir, `${comp}_${String(f).padStart(5, "0")}${label ? "_" + label : ""}.png`);
  await renderStill({ composition, serveUrl, output, frame: f, scale, inputProps, logLevel: "error" });
  console.log(output);
}
