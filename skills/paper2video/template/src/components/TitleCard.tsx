// Full-screen title card, shown right after the hook (hook → title → body): within 10–20 s the viewer knows what they
// are watching — the paper's title, its authors and institutions, where it is published, and its one-sentence claim.
// The narration names the paper on the same beat. Works at 16:9 and 9:16 (the layout follows the composition size).
//
// Optional `shot`: a screenshot of the paper's page (the arXiv abstract page, or the first screen of the paper's own web
// page; made with scripts/page_shot.mjs) that eases in while the title is read.
//   16:9  text column on the left, the page as a card centre-right; it eases in on the title and then stays put.
//   9:16  one focus at a time: kicker + title on top, the page large below them while the title is read; on the
//         authors beat (or beats.shotOut) the page gives way and the authors, institutions and claim take its place.
// Only the card moves (fade, a small rise and settle, a top-down reveal), never the whole frame.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { appear, prog } from "./core";
import { color, ease, font } from "../theme";

export type TitleCardProps = {
  kicker?: string; // e.g. "arXiv 2603.12228 · 2026" or "NeurIPS 2025"
  title: React.ReactNode; // the paper's short title / name
  subtitle?: string; // the rest of the title, or the original title under a translation
  authors: string;
  affiliation?: string;
  claim?: React.ReactNode; // one sentence, appears on its beat
  note?: string; // e.g. "Unofficial explainer"
  bg?: string; // optional staticFile image, shown blurred behind the card
  // frames (relative to the scene). shot: when the page screenshot eases in (default: with the title).
  // shotOut (9:16 only): when the page gives way to the authors and claim (default: the authors beat, ≥ 60 frames after shot).
  beats?: { title?: number; authors?: number; claim?: number; shot?: number; shotOut?: number };
  hot?: string; // accent colour of the title
  serif?: boolean;
  titleSize?: number;
  subtitleSize?: number;
  authorsSize?: number;
  claimSize?: number;
  top?: number; // y of the block (default 22% of the height, 330 px vertical; with a shot 18% / 300 px)
  // titleSize / subtitleSize / authorsSize / claimSize: shrink for a long title or author list (check the 9:16 card clears the captions)
  shot?: string; // staticFile path of the page screenshot, e.g. "shots/arxiv.png" (scripts/page_shot.mjs)
  shotWidth?: number; // card width in px (default 16:9: 660, right-aligned at x 1780; 9:16: 960, centred)
  shotMaxHeight?: number; // taller pages are cropped at this height, the cut softened by a fade (16:9 default 640;
  // at 9:16 the card is also cropped to the space between the title and the captions)
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
  shotWidth,
  shotMaxHeight,
}) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const vertical = H > W;
  const wide = Boolean(shot) && !vertical; // 16:9 with the page card: a narrower, smaller text column
  const t0 = beats.title ?? 0;
  const pK = prog(f, Math.max(0, t0 - 12), 14, ease.out);
  const pT = prog(f, Math.max(0, t0 - 6), 20, ease.out);
  const pS = prog(f, t0 + 10, 18, ease.out);
  let pA = prog(f, (beats.authors ?? t0 + 30) - 6, 18, ease.out);
  let pC = prog(f, (beats.claim ?? t0 + 90) - 6, 18, ease.out);

  // the page card: fades in, rises and settles while a top-down reveal "loads" it; 9:16: leaves for the authors
  const tShot = beats.shot ?? t0;
  const pShot = prog(f, tShot - 4, 30, ease.out);
  const pReveal = prog(f, tShot - 4, 40, ease.inOut);
  let pOut = 0;
  if (shot && vertical) {
    const tOut = beats.shotOut ?? Math.max(beats.authors ?? t0 + 75, tShot + 60); // the page stays ≥ 2 s by default
    pOut = prog(f, tOut - 14, 16, ease.inOut);
    pA = prog(f, tOut - 2, 18, ease.out);
    pC = prog(f, Math.max(beats.claim ?? t0 + 90, tOut + 12) - 6, 18, ease.out);
  }
  const shotCard = shot ? (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: vertical ? "flex-start" : "center",
        opacity: pShot * (1 - pOut),
        translate: `0px ${(1 - pShot) * 40 + pOut * 30}px`,
        scale: String(0.965 + 0.035 * pShot - 0.03 * pOut),
        transformOrigin: vertical ? "50% 0%" : "50% 50%",
        filter: "drop-shadow(0 28px 56px rgba(0,0,0,0.55)) drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxHeight: shotMaxHeight ?? (vertical ? "100%" : 640),
          overflow: "hidden",
          borderRadius: vertical ? 18 : 14,
          background: "#fff",
          clipPath: `inset(0 0 ${(1 - pReveal) * 100}% 0 round ${vertical ? 18 : 14}px)`,
          // the page runs on below the crop: its last lines fade out
          maskImage: "linear-gradient(180deg, black 90%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, black 90%, transparent 100%)",
        }}
      >
        <Img src={staticFile(shot)} style={{ display: "block", width: "100%", height: "auto" }} />
      </div>
    </div>
  ) : null;

  const left = vertical ? 120 : wide ? 150 : 160;
  const width = vertical ? 768 : wide ? 920 : W - 2 * left;
  const y0 = top ?? (vertical ? (shot ? 300 : 330) : H * (wide ? 0.18 : 0.22));

  const kickerEl = kicker ? (
    <div style={{ fontFamily: font.mono, fontSize: vertical ? 30 : wide ? 22 : 24, letterSpacing: "0.16em", textTransform: "uppercase", color: color.text2, ...appear(pK) }}>
      {kicker}
    </div>
  ) : null;
  const titleEl = (
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
  );
  const subtitleEl = subtitle ? (
    <div style={{ marginTop: wide ? 18 : 22, fontFamily: font.serif, fontSize: subtitleSize ?? (vertical ? 52 : wide ? 40 : 46), lineHeight: 1.25, color: color.text2, maxWidth: vertical ? width : 1300, ...appear(pS) }}>
      {subtitle}
    </div>
  ) : null;
  const authorsEl = (marginTop: number) => (
    <div style={{ marginTop, ...appear(pA) }}>
      <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: authorsSize ?? (vertical ? 62 : wide ? 38 : 44), lineHeight: 1.35, color: color.text }}>{authors}</div>
      {affiliation ? <div style={{ marginTop: 10, fontFamily: font.sans, fontSize: vertical ? 52 : wide ? 32 : 34, color: color.accent }}>{affiliation}</div> : null}
    </div>
  );
  const claimEl = claim ? (
    <div style={{ marginTop: vertical ? 70 : wide ? 40 : 50, fontFamily: font.sans, fontSize: claimSize ?? (vertical ? 64 : wide ? 38 : 40), lineHeight: 1.35, color: color.text, ...appear(pC) }}>{claim}</div>
  ) : null;
  const noteEl = note ? (
    <div style={{ marginTop: vertical ? 50 : wide ? 30 : 36, fontFamily: font.mono, fontSize: vertical ? 30 : 19, letterSpacing: "0.12em", textTransform: "uppercase", color: color.text3, opacity: pA }}>
      {note}
    </div>
  ) : null;

  return (
    <AbsoluteFill>
      {bg ? (
        <AbsoluteFill style={{ opacity: 0.3 }}>
          <Img src={staticFile(bg)} style={{ width: W, height: H, objectFit: "cover", filter: "blur(70px) saturate(1.15)" }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 40% 45%, rgba(11,14,19,0.35), rgba(11,14,19,0.9))" }} />
      {shot && vertical ? (
        // 9:16: kicker + title on top; below them one slot, ending above the captions (y 1270): first the page (cropped
        // to the slot), then the authors, institutions, claim and note in its place
        <div style={{ position: "absolute", left, width, top: y0, bottom: H - 1270, display: "flex", flexDirection: "column" }}>
          {kickerEl}
          {titleEl}
          {subtitleEl}
          <div style={{ flex: 1, minHeight: 0, position: "relative", marginTop: 60 }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: (width - (shotWidth ?? 960)) / 2, width: shotWidth ?? 960, display: "flex" }}>{shotCard}</div>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
              {authorsEl(0)}
              {claimEl}
              {noteEl}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position: "absolute", left, width, top: y0 }}>
          {kickerEl}
          {titleEl}
          {subtitleEl}
          {authorsEl(vertical ? 70 : wide ? 44 : 54)}
          {claimEl}
          {noteEl}
        </div>
      )}
      {wide ? (
        // 16:9: the page card centre-right, vertically centred in the content area (y 130–860, above the captions)
        <div style={{ position: "absolute", right: W - 1780, width: shotWidth ?? 660, top: 130, bottom: H - 860, display: "flex", alignItems: "center" }}>
          {shotCard}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
