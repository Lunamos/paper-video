// Design tokens (3Blue1Brown-rooted, technical): near-black backdrop, grayscale structure, and a few
// semantic accents whose meaning is fixed for the whole film (the same symbol has the same colour in
// equations, diagrams and captions).
//   accent    = the method / "ours"            (default cyan)
//   accent2   = the key input / concept        (default amber)
//   highlight = the one thing to look at now   (default orange; use sparingly)
// Categorical colours (`series`) are only for data charts with many groups.
import { loadFont as loadLocalFont } from "@remotion/fonts";
import { Easing, staticFile } from "remotion";
import zhFonts from "./fonts-zh.json";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";

const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext"],
});
const serif = loadSerif("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadSerif("italic", { weights: ["400", "500"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });
// handwriting for the hand-drawn annotations (components/Hand.tsx)
const caveat = loadCaveat("normal", { weights: ["500", "600"], subsets: ["latin"] });

// ---- CJK: an optional local font subset (e.g. Noto Sans SC) with exactly the glyphs the ZH cut uses.
// fonts-zh.json = { family, files: { "<weight>": "fonts/zh/<file>.woff2" }, hand?: { family, file } }, paths
// relative to public/. With `files: {}` (the shipped placeholder) nothing is loaded and CJK text falls back to
// the system font. It is appended as a fallback to every family, so Latin keeps Inter / Source Serif / Mono.
type ZhFonts = { family: string; files: Record<string, string>; hand?: { family: string; file: string } };
const ZH = zhFonts as ZhFonts;
const zhFiles = Object.entries(ZH.files ?? {});
const ZH_FAMILY = zhFiles.length ? ZH.family : null;
for (const [weight, url] of zhFiles) {
  loadLocalFont({ family: ZH.family, url: staticFile(url), weight, format: "woff2" }).catch(() => undefined);
}
const HAND_ZH = ZH.hand;
if (HAND_ZH) {
  loadLocalFont({ family: HAND_ZH.family, url: staticFile(HAND_ZH.file), weight: "400", format: "woff2" }).catch(() => undefined);
}
const CJK_SYS = `"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
const withZh = (f: string) => `${f}${ZH_FAMILY ? `, "${ZH_FAMILY}"` : ""}, ${CJK_SYS}`;

/** On-screen text language. Add a code here (and a text block in each scene) to support another language. */
export type Lang = "en" | "zh";

export const font = {
  sans: withZh(inter.fontFamily),
  serif: withZh(serif.fontFamily),
  mono: withZh(mono.fontFamily),
  zh: withZh(inter.fontFamily),
  hand: `${caveat.fontFamily}${HAND_ZH ? `, "${HAND_ZH.family}"` : ""}, ${withZh(inter.fontFamily)}`,
};

export const color = {
  bg: "#0B0E13",
  bgLift: "#111823",
  bgDeep: "#07090C",
  panel: "rgba(255,255,255,0.028)",
  panelBorder: "rgba(255,255,255,0.09)",
  grid: "rgba(255,255,255,0.05)",
  gridStrong: "rgba(255,255,255,0.12)",
  text: "#ECEFF4",
  text2: "#A7B0BB",
  text3: "#6B7581",
  // semantic accents (keep katex-colors.css in sync)
  accent: "#5CC8E8",
  accentSoft: "rgba(92,200,232,0.16)",
  accentGlow: "rgba(92,200,232,0.45)",
  accent2: "#F5C862",
  accent2Soft: "rgba(245,200,98,0.14)",
  accent2Glow: "rgba(245,200,98,0.35)",
  highlight: "#FF8A4C",
  highlightSoft: "rgba(255,138,76,0.16)",
  highlightGlow: "rgba(255,138,76,0.5)",
  // neutral roles
  baseline: "#8A939E", // "the other methods" in charts
  chance: "#5E6874",
  // categorical series (data charts only)
  series: ["#6FA8FF", "#F2A07B", "#6FD6B0", "#B69CFF", "#ECEFF4", "#FF6B6B"],
};

export const layout = {
  w: 1920,
  h: 1080,
  marginX: 120,
  marginTop: 96,
  headlineTop: 100,
  captionBottom: 58,
  footnoteBottom: 166,
  // content must stay above this y so captions + footnote never collide
  contentBottom: 860,
};

export const type = {
  display: 88,
  headline: 54,
  h2: 40,
  body: 30,
  small: 24,
  micro: 19,
  caption: 40,
};

// Motion presets. "smooth" approximates 3Blue1Brown's default rate function.
export const ease = {
  smooth: Easing.bezier(0.45, 0.0, 0.25, 1.0),
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  spring: Easing.spring({ damping: 200 }),
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
