// Full-screen title card, shown right after the hook (hook → title → body): within 10–20 s the viewer knows what they
// are watching — the paper's title, its authors and institutions, where it is published, and its one-sentence claim.
// The narration names the paper on the same beat. Works at 16:9 and 9:16 (the layout follows the composition size).
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { appear, prog } from "./core";
import { color, ease, font } from "../theme";

export type TitleCardProps = {
  kicker?: string; // e.g. "arXiv 2603.12228 · 2026" or "NeurIPS 2025"
  title: string; // the paper's short title / name
  subtitle?: string; // the rest of the title, or the original title under a translation
  authors: string;
  affiliation?: string;
  claim?: React.ReactNode; // one sentence, appears on its beat
  note?: string; // e.g. "Unofficial explainer"
  bg?: string; // optional staticFile image, shown blurred behind the card
  beats?: { title?: number; authors?: number; claim?: number }; // frames (relative to the scene)
  hot?: string; // accent colour of the title
  serif?: boolean;
};

export const TitleCard: React.FC<TitleCardProps> = ({
  kicker,
  title,
  subtitle,
  authors,
  affiliation,
  claim,
  note,
  bg,
  beats = {},
  hot = color.text,
  serif = true,
}) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const vertical = H > W;
  const t0 = beats.title ?? 0;
  const pK = prog(f, Math.max(0, t0 - 12), 14, ease.out);
  const pT = prog(f, Math.max(0, t0 - 6), 20, ease.out);
  const pS = prog(f, t0 + 10, 18, ease.out);
  const pA = prog(f, (beats.authors ?? t0 + 30) - 6, 18, ease.out);
  const pC = prog(f, (beats.claim ?? t0 + 90) - 6, 18, ease.out);
  const left = vertical ? 120 : 160;
  const width = vertical ? 768 : W - 2 * left;
  return (
    <AbsoluteFill>
      {bg ? (
        <AbsoluteFill style={{ opacity: 0.3 }}>
          <Img src={staticFile(bg)} style={{ width: W, height: H, objectFit: "cover", filter: "blur(70px) saturate(1.15)" }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 40% 45%, rgba(11,14,19,0.35), rgba(11,14,19,0.9))" }} />
      <div style={{ position: "absolute", left, width, top: vertical ? 330 : H * 0.22 }}>
        {kicker ? (
          <div style={{ fontFamily: font.mono, fontSize: vertical ? 30 : 24, letterSpacing: "0.16em", textTransform: "uppercase", color: color.text2, ...appear(pK) }}>
            {kicker}
          </div>
        ) : null}
        <div
          style={{
            marginTop: vertical ? 30 : 26,
            fontFamily: serif ? font.serif : font.sans,
            fontWeight: serif ? 500 : 900,
            fontSize: vertical ? 150 : 150,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            color: hot,
            textShadow: hot !== color.text ? `0 0 60px ${hot}55` : undefined,
            ...appear(pT, 24),
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 22, fontFamily: font.serif, fontSize: vertical ? 52 : 46, lineHeight: 1.25, color: color.text2, maxWidth: vertical ? width : 1300, ...appear(pS) }}>
            {subtitle}
          </div>
        ) : null}
        <div style={{ marginTop: vertical ? 70 : 54, ...appear(pA) }}>
          <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: vertical ? 62 : 44, color: color.text }}>{authors}</div>
          {affiliation ? <div style={{ marginTop: 10, fontFamily: font.sans, fontSize: vertical ? 52 : 34, color: color.accent }}>{affiliation}</div> : null}
        </div>
        {claim ? (
          <div style={{ marginTop: vertical ? 70 : 50, fontFamily: font.sans, fontSize: vertical ? 64 : 40, lineHeight: 1.35, color: color.text, ...appear(pC) }}>{claim}</div>
        ) : null}
        {note ? (
          <div style={{ marginTop: vertical ? 50 : 36, fontFamily: font.mono, fontSize: vertical ? 30 : 19, letterSpacing: "0.12em", textTransform: "uppercase", color: color.text3, opacity: pA }}>
            {note}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
