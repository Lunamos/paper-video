// Full-screen title card, shown right after the hook (hook → title → body): within 10–20 s the viewer knows what they
// are watching — the paper's title, its authors and institutions, where it is published, and its one-sentence claim.
// The narration names the paper on the same beat. Works at 16:9 and 9:16 (the layout follows the composition size).
//
// Optional `shot`: the first page of the paper's PDF (or the first screen of its web article) as a background element,
// made with scripts/paper_shot.mjs. It sits above the dark gradient and below the text, dimmed and faded at its edges,
// and eases in on the title beat (fade + a small slide), then drifts very slowly upwards.
//   16:9  text column on the left, the page centre-right, faded out towards the text and above the caption band.
//   9:16  the page under the title, clearly visible while the title is read; on the authors beat (or beats.shotDim)
//         it dims (and softens) so the authors, institutions and claim read cleanly on top of it.
// Only the page layer moves, never the whole frame (no zoom, no shake).
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { appear, prog } from "./core";
import { clamp, color, ease, font } from "../theme";

export type TitleCardProps = {
  kicker?: string; // e.g. "arXiv 2603.12228 · 2026" or "NeurIPS 2025"
  title: React.ReactNode; // the paper's short title / name
  subtitle?: string; // the rest of the title, or the original title under a translation
  authors: string;
  affiliation?: string;
  claim?: React.ReactNode; // one sentence, appears on its beat
  note?: string; // e.g. "Unofficial explainer"
  bg?: string; // optional staticFile image, shown blurred behind the card
  // frames (relative to the scene). shot: when the paper page eases in (default: with the title).
  // shotDim (9:16 only): when the page dims under the authors and claim (default: the authors beat, ≥ 60 frames after shot).
  beats?: { title?: number; authors?: number; claim?: number; shot?: number; shotDim?: number };
  hot?: string; // accent colour of the title
  serif?: boolean;
  titleSize?: number;
  subtitleSize?: number;
  authorsSize?: number;
  claimSize?: number;
  top?: number; // y of the block (default 22% of the height, 330 px vertical; 16:9 with a shot 18%)
  // titleSize / subtitleSize / authorsSize / claimSize: shrink for a long title or author list (check the 9:16 card clears the captions)
  shot?: string; // staticFile path of the paper page, e.g. "shots/paper.png" (scripts/paper_shot.mjs)
  shotOpacity?: number; // the page's opacity (16:9 default 0.34; 9:16 0.5 while the title is read)
  shotDimOpacity?: number; // 9:16: its opacity under the authors and claim (default 0.08)
  shotWidth?: number; // px (16:9 default 820, from x 1000; 9:16 default 1000, centred)
  shotTop?: number; // y of the page's top edge (16:9 default 60; 9:16 default 760, under the title block: move it below a
  // long title or subtitle)
  shotDrift?: number; // slow upward drift in px per second after the entrance (default 4; 0 = still)
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
  titleSize,
  subtitleSize,
  authorsSize,
  claimSize,
  top,
  shot,
  shotOpacity,
  shotDimOpacity = 0.08,
  shotWidth,
  shotTop,
  shotDrift = 4,
}) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const vertical = H > W;
  const wide = Boolean(shot) && !vertical; // 16:9 with the page: a narrower, smaller text column on the left
  const t0 = beats.title ?? 0;
  const pK = prog(f, Math.max(0, t0 - 12), 14, ease.out);
  const pT = prog(f, Math.max(0, t0 - 6), 20, ease.out);
  const pS = prog(f, t0 + 10, 18, ease.out);
  const pA = prog(f, (beats.authors ?? t0 + 30) - 6, 18, ease.out);
  const pC = prog(f, (beats.claim ?? t0 + 90) - 6, 18, ease.out);
  const left = vertical ? 120 : wide ? 150 : 160;
  const width = vertical ? 768 : wide ? 920 : W - 2 * left;

  // ---- the paper page (background layer)
  let page: React.ReactNode = null;
  if (shot) {
    const tShot = beats.shot ?? t0;
    const pIn = prog(f, tShot - 6, 45, ease.out);
    const tDim = beats.shotDim ?? Math.max(beats.authors ?? t0 + 75, tShot + 60);
    const pDim = vertical ? prog(f, tDim - 10, 24, ease.inOut) : 0;
    const full = shotOpacity ?? (vertical ? 0.5 : 0.34);
    const op = pIn * interpolate(pDim, [0, 1], [full, Math.min(full, shotDimOpacity)], clamp);
    const drift = (shotDrift * Math.max(0, f - tShot)) / fps;
    const pw = shotWidth ?? (vertical ? 1000 : 820);
    const px = vertical ? (W - pw) / 2 : 1000;
    const py = shotTop ?? (vertical ? 760 : 60);
    // soft edges fixed in the frame (the page drifts under them): in over 90 px (9:16: 140 px) from its top position, out before the
    // captions (16:9 y ≈ 760–900; 9:16 y ≈ 1140–1290)
    const fadeFrom = (vertical ? 1140 : 760) - py + drift;
    const fadeTo = (vertical ? 1290 : 900) - py + drift;
    const vMask = `linear-gradient(180deg, transparent ${drift}px, black ${drift + (vertical ? 140 : 90)}px, black ${fadeFrom}px, transparent ${fadeTo}px)`;
    // sides: 16:9 fades towards the text column on the left and out at the right edge; 9:16 softens both edges
    const hMask = vertical
      ? "linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)"
      : "linear-gradient(90deg, transparent 0%, black 34%, black 86%, transparent 100%)";
    page = (
      <div
        style={{
          position: "absolute",
          left: px,
          top: py,
          width: pw,
          opacity: op,
          filter: pDim > 0 ? `blur(${pDim * 5}px)` : undefined, // 9:16: under the text the page turns into texture
          translate: `${vertical ? 0 : (1 - pIn) * 40}px ${(1 - pIn) * 28 - drift}px`,
          maskImage: hMask,
          WebkitMaskImage: hMask,
        }}
      >
        <div style={{ maskImage: vMask, WebkitMaskImage: vMask }}>
          <Img src={staticFile(shot)} style={{ display: "block", width: "100%", height: "auto" }} />
        </div>
      </div>
    );
  }

  return (
    <AbsoluteFill>
      {bg ? (
        <AbsoluteFill style={{ opacity: 0.3 }}>
          <Img src={staticFile(bg)} style={{ width: W, height: H, objectFit: "cover", filter: "blur(70px) saturate(1.15)" }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 40% 45%, rgba(11,14,19,0.35), rgba(11,14,19,0.9))" }} />
      {page}
      <div style={{ position: "absolute", left, width, top: top ?? (vertical ? 330 : H * (wide ? 0.18 : 0.22)) }}>
        {kicker ? (
          <div style={{ fontFamily: font.mono, fontSize: vertical ? 30 : wide ? 22 : 24, letterSpacing: "0.16em", textTransform: "uppercase", color: color.text2, ...appear(pK) }}>
            {kicker}
          </div>
        ) : null}
        <div
          style={{
            marginTop: vertical ? 30 : 26,
            fontFamily: serif ? font.serif : font.sans,
            fontWeight: serif ? 500 : 900,
            fontSize: titleSize ?? (wide ? 96 : 150),
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
          <div style={{ marginTop: wide ? 18 : 22, fontFamily: font.serif, fontSize: subtitleSize ?? (vertical ? 52 : wide ? 40 : 46), lineHeight: 1.25, color: color.text2, maxWidth: vertical ? width : 1300, ...appear(pS) }}>
            {subtitle}
          </div>
        ) : null}
        <div style={{ marginTop: vertical ? 70 : wide ? 44 : 54, ...appear(pA) }}>
          <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: authorsSize ?? (vertical ? 62 : wide ? 38 : 44), lineHeight: 1.35, color: color.text }}>{authors}</div>
          {affiliation ? <div style={{ marginTop: 10, fontFamily: font.sans, fontSize: vertical ? 52 : wide ? 32 : 34, color: color.accent }}>{affiliation}</div> : null}
        </div>
        {claim ? (
          <div style={{ marginTop: vertical ? 70 : wide ? 40 : 50, fontFamily: font.sans, fontSize: claimSize ?? (vertical ? 64 : wide ? 38 : 40), lineHeight: 1.35, color: color.text, ...appear(pC) }}>{claim}</div>
        ) : null}
        {note ? (
          <div style={{ marginTop: vertical ? 50 : wide ? 30 : 36, fontFamily: font.mono, fontSize: vertical ? 30 : 19, letterSpacing: "0.12em", textTransform: "uppercase", color: color.text3, opacity: pA }}>
            {note}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
