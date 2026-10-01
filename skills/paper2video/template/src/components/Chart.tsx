// Minimal data-chart helpers. Rules: only real data; bar axes start at 0; bars grow, but numbers only appear at
// their final value (never count up: in-between frames would show numbers that are not in the source).
import React from "react";
import { interpolate } from "remotion";
import { clamp, color, font } from "../theme";

export type Series = {
  name: string;
  pts: number[][]; // [x, y]
  color: string;
  width?: number;
  dashed?: boolean;
  marker?: "circle" | "square" | "tri" | "tri-down" | "diamond" | "none";
  opacity?: number;
};

type Frame = { x: number; y: number; w: number; h: number; xDomain: [number, number]; yDomain: [number, number] };

const sx = (f: Frame, v: number) => f.x + ((v - f.xDomain[0]) / (f.xDomain[1] - f.xDomain[0])) * f.w;
const sy = (f: Frame, v: number) => f.y + f.h - ((v - f.yDomain[0]) / (f.yDomain[1] - f.yDomain[0])) * f.h;

const Marker: React.FC<{ kind: Series["marker"]; x: number; y: number; c: string; r?: number }> = ({ kind, x, y, c, r = 6 }) => {
  switch (kind) {
    case "square":
      return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} fill={c} />;
    case "tri":
      return <path d={`M${x} ${y - r} L${x + r} ${y + r * 0.8} L${x - r} ${y + r * 0.8} Z`} fill={c} />;
    case "tri-down":
      return <path d={`M${x} ${y + r} L${x + r} ${y - r * 0.8} L${x - r} ${y - r * 0.8} Z`} fill={c} />;
    case "diamond":
      return <path d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z`} fill={c} />;
    case "none":
      return null;
    default:
      return <circle cx={x} cy={y} r={r * 0.85} fill={c} />;
  }
};

/**
 * Axes + line series. `progress` (0..1) draws every series left-to-right in data space
 * (the x-reveal is shared, so all curves advance together). Coordinates are in the 1920×1080 frame.
 */
export const LineChart: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: number[];
  yTicks: number[];
  xLabel?: string;
  yLabel?: string;
  title?: string;
  series: Series[];
  progress?: number;
  axisP?: number;
  fmtX?: (v: number) => string;
  fmtY?: (v: number) => string;
}> = ({ x, y, w, h, xDomain, yDomain, xTicks, yTicks, xLabel, yLabel, title, series, progress = 1, axisP = 1, fmtX = (v) => String(v), fmtY = (v) => String(v) }) => {
  const f: Frame = { x, y, w, h, xDomain, yDomain };
  const xCut = xDomain[0] + (xDomain[1] - xDomain[0]) * progress;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={axisP}>
        {title ? (
          <text x={x} y={y - 22} fill={color.text} fontFamily={font.sans} fontSize={26} fontWeight={600}>
            {title}
          </text>
        ) : null}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={x} x2={x + w} y1={sy(f, t)} y2={sy(f, t)} stroke={t === yDomain[0] ? color.gridStrong : color.grid} />
            <text x={x - 12} y={sy(f, t) + 6} fill={color.text3} fontFamily={font.mono} fontSize={16} textAnchor="end">
              {fmtY(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(f, t)} x2={sx(f, t)} y1={y + h} y2={y + h + 7} stroke={color.gridStrong} />
            <text x={sx(f, t)} y={y + h + 30} fill={color.text3} fontFamily={font.mono} fontSize={16} textAnchor="middle">
              {fmtX(t)}
            </text>
          </g>
        ))}
        {xLabel ? (
          <text x={x + w / 2} y={y + h + 62} fill={color.text3} fontFamily={font.mono} fontSize={16} textAnchor="middle" letterSpacing="0.06em">
            {xLabel}
          </text>
        ) : null}
        {yLabel ? (
          <text x={x - 58} y={y + h / 2} fill={color.text3} fontFamily={font.mono} fontSize={16} textAnchor="middle" transform={`rotate(-90 ${x - 58} ${y + h / 2})`}>
            {yLabel}
          </text>
        ) : null}
      </g>
      {series.map((s) => {
        const pts = s.pts.filter((p) => p[1] !== null && p[1] !== undefined);
        const shown: number[][] = [];
        for (let i = 0; i < pts.length; i++) {
          if (pts[i][0] <= xCut) shown.push(pts[i]);
          else {
            if (i > 0 && pts[i - 1][0] < xCut) {
              const a = pts[i - 1];
              const b = pts[i];
              const t = (xCut - a[0]) / (b[0] - a[0]);
              shown.push([xCut, a[1] + (b[1] - a[1]) * t]);
            }
            break;
          }
        }
        if (shown.length === 0) return null;
        const d = shown.map((p, i) => `${i ? "L" : "M"}${sx(f, p[0]).toFixed(1)} ${sy(f, p[1]).toFixed(1)}`).join(" ");
        return (
          <g key={s.name} opacity={s.opacity ?? 1}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 3} strokeDasharray={s.dashed ? "10 7" : undefined} strokeLinecap="round" strokeLinejoin="round" />
            {pts
              .filter((p) => p[0] <= xCut + 1e-9)
              .map((p, i) => (
                <Marker key={i} kind={s.marker ?? "circle"} x={sx(f, p[0])} y={sy(f, p[1])} c={s.color} />
              ))}
          </g>
        );
      })}
    </svg>
  );
};

/** Horizontal bar that grows from 0; the value label only appears when the bar reaches its final length. */
export const HBar: React.FC<{
  x: number;
  y: number;
  maxW: number;
  domainMax: number;
  value: number;
  p: number;
  color: string;
  h?: number;
  label?: string;
  labelColor?: string;
  bold?: boolean;
}> = ({ x, y, maxW, domainMax, value, p, color: c, h = 30, label, labelColor = color.text2, bold }) => {
  const w = (value / domainMax) * maxW * p;
  const labelOpacity = interpolate(p, [0.92, 1], [0, 1], clamp);
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 4, background: c }} />
      <div
        style={{
          position: "absolute",
          left: x + (value / domainMax) * maxW + 12,
          top: y + h / 2 - 14,
          fontFamily: font.mono,
          fontSize: 21,
          fontWeight: bold ? 700 : 400,
          color: labelColor,
          opacity: labelOpacity,
        }}
      >
        {label ?? value.toFixed(3)}
      </div>
    </>
  );
};

/** Vertical bar growing up from the baseline (y = bottom of the plot, value 0). Label appears only at full height. */
export const VBar: React.FC<{
  x: number;
  bottom: number; // y (px) of the zero line
  w: number;
  maxH: number;
  domainMax: number;
  value: number;
  p: number;
  color: string;
  label?: string;
  labelColor?: string;
  bold?: boolean;
  caption?: React.ReactNode; // category label under the bar
}> = ({ x, bottom, w, maxH, domainMax, value, p, color: c, label, labelColor = color.text2, bold, caption }) => {
  const full = (value / domainMax) * maxH;
  const h = full * p;
  const labelOpacity = interpolate(p, [0.92, 1], [0, 1], clamp);
  return (
    <>
      <div style={{ position: "absolute", left: x, top: bottom - h, width: w, height: h, borderRadius: "4px 4px 0 0", background: c }} />
      <div
        style={{
          position: "absolute",
          left: x - 40,
          width: w + 80,
          top: bottom - full - 38,
          textAlign: "center",
          fontFamily: font.mono,
          fontSize: 22,
          fontWeight: bold ? 700 : 400,
          color: labelColor,
          opacity: labelOpacity,
        }}
      >
        {label ?? String(value)}
      </div>
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: x - 60,
            width: w + 120,
            top: bottom + 14,
            textAlign: "center",
            fontFamily: font.sans,
            fontSize: 22,
            color: color.text2,
          }}
        >
          {caption}
        </div>
      ) : null}
    </>
  );
};
