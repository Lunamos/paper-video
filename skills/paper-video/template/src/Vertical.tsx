// Vertical cut (1080×1920) for short-video platforms. The 16:9 film is re-rendered (not a rescaled video file) inside
// a band in the middle: 60 px cropped on each side, so it is shown at 0.6 scale (1080 × 648). Above it: a title block
// and the current chapter; below it: a chapter progress bar and larger captions. The bottom ~20% of the frame and the
// right edge are left free for the platforms' UI overlays (like/comment buttons, description).
// All text comes from VERTICAL below.
import React, { useMemo } from "react";
import { AbsoluteFill, CalculateMetadataFunction, interpolate, useCurrentFrame } from "remotion";
import { Captions } from "./components/Captions";
import { Backdrop, useFontsReady } from "./components/core";
import { clamp, color, ease, font, Lang } from "./theme";
import { buildTimeline, FPS } from "./timeline/timeline";
import { MainVideo } from "./Video";

export type VerticalConfig = {
  lang: Lang; // on-screen text of the embedded film + captions
  cut?: string; // voice track (default: lang)
  kicker: string; // small mono line above the title
  title: string;
  /** subtitle as [before, emphasised (accent colour), after] */
  subtitle: [string, string, string];
  authors: string;
  credit: string;
  /** scene id -> chapter name shown in the pill. Scenes missing here fall back to `chapter` in the vo JSON. */
  chapters: Record<string, string>;
};

export const VERTICAL: VerticalConfig = {
  lang: "zh",
  kicker: "论文讲解 · PAPER EXPLAINER",
  title: "一个示例标题",
  subtitle: ["副标题里 ", "强调", " 的部分"],
  authors: "Author One · Author Two · Institution",
  credit: "Made with Remotion",
  chapters: {
    s_example: "示例场景",
  },
};

// 16:9 band geometry
const CROP = 60;
const S = 1080 / (1920 - 2 * CROP); // = 0.6
const BAND_TOP = 520;
const BAND_H = 1080 * S;
const BAR_Y = BAND_TOP + BAND_H + 34;
const CAP_TOP = BAR_Y + 40;
const CAP_SCALE = 1.1;

export const VerticalVideo: React.FC = () => {
  useFontsReady();
  const V = VERTICAL;
  const cut = V.cut ?? V.lang;
  const zh = V.lang === "zh";
  const frame = useCurrentFrame();
  const tl = useMemo(() => buildTimeline(cut), [cut]);
  const total = tl.durationInFrames;
  const cur = tl.scenes.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? tl.scenes[0];
  const chapter = V.chapters[cur.id] ?? cur.chapter ?? "";
  const chapIn = interpolate(frame - cur.from, [0, 14], [0, 1], { ...clamp, easing: ease.out });
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <Backdrop glowAt="50% 38%" width={1080} height={1920} />

      {/* title block */}
      <div style={{ position: "absolute", left: 72, right: 72, top: 150 }}>
        <div style={{ fontFamily: font.mono, fontSize: 26, letterSpacing: "0.14em", color: color.text3 }}>{V.kicker}</div>
        <div style={{ marginTop: 18, fontFamily: font.sans, fontWeight: 900, fontSize: 68, lineHeight: 1.15, color: color.text }}>{V.title}</div>
        <div style={{ marginTop: 8, fontFamily: font.sans, fontWeight: 700, fontSize: 44, color: color.text2 }}>
          {V.subtitle[0]}
          <span style={{ color: color.accent }}>{V.subtitle[1]}</span>
          {V.subtitle[2]}
        </div>
        {chapter ? (
          <div
            style={{
              marginTop: 30,
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              padding: "8px 20px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${color.panelBorder}`,
              fontFamily: font.sans,
              fontWeight: 600,
              fontSize: 30,
              color: color.text,
              opacity: chapIn,
              transform: `translateY(${(1 - chapIn) * 10}px)`,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 5, background: color.highlight }} />
            {chapter}
          </div>
        ) : null}
      </div>

      {/* the 16:9 film, re-rendered at 0.6 scale */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: BAND_TOP,
          width: 1080,
          height: BAND_H,
          overflow: "hidden",
          borderTop: `1px solid ${color.panelBorder}`,
          borderBottom: `1px solid ${color.panelBorder}`,
        }}
      >
        <div style={{ position: "absolute", left: -CROP * S, top: 0, width: 1920, height: 1080, transform: `scale(${S})`, transformOrigin: "0 0" }}>
          <MainVideo lang={V.lang} cut={cut} captions={false} />
        </div>
      </div>

      {/* chapter progress bar: one segment per scene */}
      <svg width={1080} height={20} style={{ position: "absolute", left: 0, top: BAR_Y }}>
        {tl.scenes.map((s) => {
          const x0 = 72 + ((1080 - 144) * s.from) / total;
          const x1 = 72 + ((1080 - 144) * (s.from + s.durationInFrames)) / total - 4;
          const fill = Math.max(0, Math.min(1, (frame - s.from) / s.durationInFrames));
          return (
            <g key={s.id}>
              <rect x={x0} y={7} width={Math.max(0, x1 - x0)} height={6} rx={3} fill="rgba(255,255,255,0.1)" />
              <rect
                x={x0}
                y={7}
                width={Math.max(0, (x1 - x0) * fill)}
                height={6}
                rx={3}
                fill={s.id === cur.id ? color.highlight : color.highlightSoft}
              />
            </g>
          );
        })}
      </svg>

      {/* larger captions below the film */}
      <div
        style={{
          position: "absolute",
          left: (1080 - 1080 / CAP_SCALE) / 2,
          top: CAP_TOP,
          width: 1080 / CAP_SCALE,
          height: 200,
          transform: `scale(${CAP_SCALE})`,
          transformOrigin: "50% 0",
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: "translateY(-60px)" }}>
          <Captions timeline={tl} fontFamily={zh ? font.zh : font.sans} zh={zh} maxWidth={900} />
        </div>
      </div>

      <div style={{ position: "absolute", left: 72, top: CAP_TOP + 250, fontFamily: font.mono, fontSize: 20, lineHeight: 1.7, color: color.text3 }}>
        <div>{V.authors}</div>
        <div>{V.credit}</div>
      </div>
    </AbsoluteFill>
  );
};

export const calcVerticalMetadata: CalculateMetadataFunction<Record<string, unknown>> = () => ({
  durationInFrames: buildTimeline(VERTICAL.cut ?? VERTICAL.lang).durationInFrames,
  fps: FPS,
});
