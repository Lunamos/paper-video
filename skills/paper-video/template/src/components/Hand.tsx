// Hand-drawn annotations: at most one circled number per data shot, with a short note.
// Warm-white "pen" so they read as the author's marks, not as data. Coordinates are in the 1920×1080 frame.
import React from "react";
import { color, font } from "../theme";

export const PEN = "#F3EEE4";

const rand = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/** Catmull-Rom through points -> cubic Bézier path. */
const smooth = (pts: [number, number][]) => {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

/** A slightly wobbly loop around a box, drawn on with p ∈ [0, 1]; it overshoots its start like a real pen stroke. */
export const HandLoop: React.FC<{ x: number; y: number; w: number; h: number; p: number; seed?: number; stroke?: string; width?: number }> = ({
  x,
  y,
  w,
  h,
  p,
  seed = 3,
  stroke = PEN,
  width = 2.6,
}) => {
  if (p <= 0) return null; // a round line cap would otherwise leave a dot
  const r = rand(seed);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2 + 14;
  const ry = h / 2 + 12;
  const n = 26;
  const start = -2.4 + r() * 0.4;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n + 3; i++) {
    const a = start + (i / n) * Math.PI * 2 * 1.0;
    // superellipse-ish so wide boxes stay boxy, plus a little hand wobble and a slow drift (the loop does not close)
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const k = 0.62;
    const ex = Math.sign(ca) * Math.pow(Math.abs(ca), k);
    const ey = Math.sign(sa) * Math.pow(Math.abs(sa), k);
    const drift = 1 + (i / n) * 0.05;
    pts.push([cx + rx * ex * drift + (r() - 0.5) * 3.2, cy + ry * ey * drift + (r() - 0.5) * 3.2]);
  }
  const d = smooth(pts);
  const L = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) * 1.25;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={L}
        strokeDashoffset={L * (1 - p)}
        opacity={0.92}
      />
    </svg>
  );
};

/** A two-stroke check mark drawn on with p. */
export const HandCheck: React.FC<{ x: number; y: number; size?: number; p: number; stroke?: string }> = ({ x, y, size = 26, p, stroke = color.accent }) => {
  if (p <= 0) return null;
  const s = size / 26;
  const a = Math.min(1, p * 2);
  const b = Math.max(0, p * 2 - 1);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      <path d={`M${x} ${y + 13 * s} L${x + 9 * s} ${y + 22 * s}`} stroke={stroke} strokeWidth={3.4} strokeLinecap="round" fill="none"
        strokeDasharray={14 * s} strokeDashoffset={14 * s * (1 - a)} />
      <path d={`M${x + 9 * s} ${y + 22 * s} L${x + 27 * s} ${y - 2 * s}`} stroke={stroke} strokeWidth={3.4} strokeLinecap="round" fill="none"
        strokeDasharray={31 * s} strokeDashoffset={31 * s * (1 - b)} />
    </svg>
  );
};

/** Handwritten note (Caveat; CJK uses the optional `hand` font from fonts-zh.json), slightly rotated. */
export const HandNote: React.FC<{ x: number; y: number; p: number; children: React.ReactNode; size?: number; rotate?: number; zh?: boolean }> = ({
  x,
  y,
  p,
  children,
  size = 34,
  rotate = -3,
  zh = false,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      fontFamily: font.hand,
      fontWeight: zh ? 400 : 600,
      fontSize: zh ? size * 0.92 : size,
      lineHeight: 1.05,
      color: PEN,
      whiteSpace: "nowrap",
      transform: `rotate(${rotate}deg) translateY(${(1 - p) * 6}px)`,
      transformOrigin: "left center",
      opacity: p,
      textShadow: "0 2px 10px rgba(0,0,0,0.7)",
    }}
  >
    {children}
  </div>
);
