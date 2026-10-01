// Covers / thumbnails. 16:9 (1920×1080) for YouTube / Bilibili, plus vertical 3:4 (1080×1440) and 9:16 (1080×1920).
// Layout: kicker, a big 2–3 line headline (one line can be "hot" = highlight colour), a pill with the key claim, a
// small footnote with the evaluation setting, and a hero visual (right side on 16:9, lower half on vertical).
// Replace <CoverHero> with a real visual from the film (e.g. the main chart or diagram, rendered with real data).
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Backdrop, useFontsReady } from "./components/core";
import { color, font, Lang } from "./theme";

export type CoverText = {
  kicker: string;
  lines: [string, boolean?][]; // [text, hot]
  pill: [string, string]; // [label, value] — the value is set in mono, e.g. a number from the paper
  foot: string; // evaluation setting / source, small
};

export const COVER: Record<Lang, CoverText> = {
  en: {
    kicker: "NEW PAPER · FIELD",
    lines: [["A short"], ["catchy"], ["headline", true]],
    pill: ["the method", "key number"],
    foot: "model · benchmark · setting (from the paper)",
  },
  zh: {
    kicker: "新论文 · 领域",
    lines: [["一句"], ["抓人的"], ["标题", true]],
    pill: ["方法名", "关键数字"],
    foot: "模型 · 基准 · 设置（出自论文）",
  },
};

/** Placeholder hero visual: stroke-drawn curves fanning out from a point. Swap for a real figure from the film. */
export const CoverHero: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const n = 7;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      {Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const y1 = h * (0.12 + 0.76 * t);
        const hot = i === n - 2;
        return (
          <path
            key={i}
            d={`M ${w * 0.08} ${h * 0.5} C ${w * 0.45} ${h * 0.5}, ${w * 0.5} ${y1}, ${w * 0.92} ${y1}`}
            fill="none"
            stroke={hot ? color.accent : color.gridStrong}
            strokeWidth={hot ? 6 : 3}
            strokeLinecap="round"
            style={hot ? { filter: `drop-shadow(0 0 18px ${color.accentGlow})` } : undefined}
          />
        );
      })}
      <circle cx={w * 0.08} cy={h * 0.5} r={12} fill={color.text} />
      <circle cx={w * 0.92} cy={h * (0.12 + 0.76 * ((n - 2) / (n - 1)))} r={11} fill={color.accent} />
    </svg>
  );
};

const HotLine: React.FC<{ text: string; hot?: boolean }> = ({ text, hot }) => (
  <div style={hot ? { color: color.highlight, textShadow: `0 0 50px ${color.highlightGlow}` } : undefined}>{text}</div>
);

const CoverPill: React.FC<{ pill: [string, string]; size: number }> = ({ pill, size }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 20,
      padding: "14px 28px",
      borderRadius: 16,
      background: color.accentSoft,
      border: `2px solid ${color.accent}88`,
      fontFamily: font.sans,
      fontWeight: 700,
      fontSize: size,
      color: color.accent,
    }}
  >
    {pill[0]}
    <span style={{ color: color.text, fontFamily: font.mono, fontWeight: 700 }}>{pill[1]}</span>
  </div>
);

/** 16:9 cover. `hero` replaces the placeholder visual on the right. */
export const Cover: React.FC<{ lang?: Lang; hero?: React.ReactNode }> = ({ lang = "en", hero }) => {
  useFontsReady();
  const T = COVER[lang];
  const zh = lang === "zh";
  const { width: W, height: H } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <Backdrop glowAt="72% 60%" width={W} height={H} />
      <div style={{ position: "absolute", right: 60, top: (H - 760) / 2 }}>{hero ?? <CoverHero w={900} h={760} />}</div>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(11,14,19,0.96) 0%, rgba(11,14,19,0.85) 38%, rgba(11,14,19,0) 60%)" }} />
      <div style={{ position: "absolute", left: 110, top: (H - 700) / 2 }}>
        <div style={{ fontFamily: font.mono, fontSize: 26, letterSpacing: "0.16em", color: color.text2 }}>{T.kicker}</div>
        <div
          style={{
            marginTop: 26,
            fontFamily: zh ? font.sans : font.serif,
            fontWeight: zh ? 900 : 500,
            fontSize: zh ? 150 : 132,
            lineHeight: 1.04,
            color: color.text,
            letterSpacing: zh ? "0.02em" : "-0.02em",
          }}
        >
          {T.lines.map(([w, hot]) => (
            <HotLine key={w} text={w} hot={hot} />
          ))}
        </div>
        <div style={{ marginTop: 44 }}>
          <CoverPill pill={T.pill} size={46} />
        </div>
        <div style={{ marginTop: 22, fontFamily: font.mono, fontSize: 22, color: color.text3 }}>{T.foot}</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Bilibili cover: ONE uploaded image is shown as 16:9 on the video page and the user's space and cropped to 4:3 for the
 * home feed. Everything readable is centred inside the middle 4:3 area (x 240–1680 at 1920 wide); the hero runs as a
 * band across the full width, so the 16:9 view is not empty at the sides. Render with --scale=2 (3840×2160) and check
 * both crops (`guides` draws the 4:3 borders).
 */
export const CoverBili: React.FC<{ lang?: Lang; hero?: React.ReactNode; guides?: boolean }> = ({ lang = "zh", hero, guides = false }) => {
  useFontsReady();
  const T = COVER[lang];
  const zh = lang === "zh";
  const { width: W, height: H } = useVideoConfig();
  const x0 = W * 0.125;
  const x1 = W * 0.875;
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <Backdrop glowAt="50% 70%" width={W} height={H} />
      <div style={{ position: "absolute", left: 0, top: H * 0.62, width: W, height: H * 0.32 }}>{hero ?? <CoverHero w={W} h={H * 0.32} />}</div>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,14,19,0.95) 0%, rgba(11,14,19,0.85) 52%, rgba(11,14,19,0) 66%)" }} />
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: H * 0.08, textAlign: "center" }}>
        <div style={{ fontFamily: font.mono, fontSize: 34, letterSpacing: "0.16em", color: color.text2 }}>{T.kicker}</div>
        <div
          style={{
            marginTop: 22,
            fontFamily: zh ? font.sans : font.serif,
            fontWeight: zh ? 900 : 600,
            fontSize: zh ? 140 : 120,
            lineHeight: 1.06,
            color: color.text,
            letterSpacing: zh ? "0.02em" : "-0.02em",
          }}
        >
          {T.lines.map(([w, hot]) => (
            <HotLine key={w} text={w} hot={hot} />
          ))}
        </div>
        <div style={{ marginTop: 28 }}>
          <CoverPill pill={T.pill} size={44} />
        </div>
      </div>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: H * 0.955, textAlign: "center", fontFamily: font.mono, fontSize: 22, color: color.text3 }}>
        {T.foot}
      </div>
      {guides ? (
        <>
          <div style={{ position: "absolute", left: x0, top: 0, width: 2, height: H, background: "#ff00ff" }} />
          <div style={{ position: "absolute", left: x1, top: 0, width: 2, height: H, background: "#ff00ff" }} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Vertical covers: 3:4 (1080×1440) and 9:16 (1080×1920); layout adapts to the composition height. */
export const CoverV: React.FC<{ lang?: Lang; hero?: React.ReactNode }> = ({ lang = "zh", hero }) => {
  useFontsReady();
  const T = COVER[lang];
  const zh = lang === "zh";
  const { width: W, height: H } = useVideoConfig();
  const tall = H > 1600;
  const heroH = tall ? 700 : 520;
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 45% at 50% ${tall ? 70 : 72}%, ${color.accentSoft}, rgba(11,14,19,0) 70%)` }} />
      <div style={{ position: "absolute", left: (W - 960) / 2, top: H - heroH - (tall ? 260 : 150) }}>{hero ?? <CoverHero w={960} h={heroH} />}</div>
      <div style={{ position: "absolute", left: 90, right: 90, top: tall ? 200 : 110 }}>
        <div style={{ fontFamily: font.mono, fontSize: 30, letterSpacing: "0.14em", color: color.text2 }}>{T.kicker}</div>
        <div
          style={{
            marginTop: 26,
            fontFamily: zh ? font.sans : font.serif,
            fontWeight: zh ? 900 : 600,
            fontSize: (tall ? 176 : 150) * (zh ? 1 : 0.8),
            lineHeight: 1.08,
            color: color.text,
            letterSpacing: zh ? "0.02em" : "-0.02em",
          }}
        >
          {T.lines.map(([w, hot]) => (
            <HotLine key={w} text={w} hot={hot} />
          ))}
        </div>
        <div style={{ marginTop: 40 }}>
          <CoverPill pill={T.pill} size={44} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, bottom: tall ? 150 : 70, fontFamily: font.mono, fontSize: 24, color: color.text3 }}>{T.foot}</div>
    </AbsoluteFill>
  );
};
