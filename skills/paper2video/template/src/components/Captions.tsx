import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { color, font, layout, type } from "../theme";
import type { Timeline, TimedWord } from "../timeline/timeline";
import zhBreaks from "../../public/data/zh_breaks.json";

// Chinese: break inside a clause only between words (jieba boundaries from scripts/zh_breaks.py, keyed "<scene>:<line>",
// as offsets in characters); without a table every word boundary is allowed.
const breaksOf = (ws: TimedWord[], key: string): Set<number> => {
  const table = (zhBreaks as unknown as Record<string, number[]>)[key];
  const ok = new Set<number>();
  if (!table) {
    for (let i = 1; i < ws.length; i++) ok.add(i);
    return ok;
  }
  const allowed = new Set(table);
  let off = 0;
  ws.forEach((w, i) => {
    if (i > 0 && (allowed.has(off) || w.sp || /^[A-Za-z0-9]/.test(w.w) !== /[A-Za-z0-9]$/.test(ws[i - 1].w))) ok.add(i);
    off += w.w.length;
  });
  return ok;
};

type Page = { from: number; to: number; words: TimedWord[] };

const MAX_EN = 58; // one caption page ≈ one line at 40px Inter within 1480px
const MAX_ZH = 18; // Chinese: one line of ≤ 16–18 characters (common zh-Hans subtitle practice)

const tokenLen = (w: TimedWord, zh: boolean) => {
  if (!zh) return w.w.length + 1;
  // latin runs count ~half a CJK cell per letter
  const cjk = (w.w.match(/[㐀-鿿]/g) ?? []).length;
  return cjk + (w.w.length - cjk) * 0.55 + (w.sp ? 0.5 : 0);
};

// Break a line's words into pages: split into clauses at punctuation, pack whole clauses into pages up to the
// limit, and only split inside a clause when the clause alone is too long (then as evenly as possible).
const paginate = (words: TimedWord[], zh: boolean, key = ""): TimedWord[][] => {
  const ok = zh ? breaksOf(words, key) : null;
  const idx = new Map(words.map((w, i) => [w, i]));
  const len = (ws: TimedWord[]) => ws.reduce((a, w) => a + tokenLen(w, zh), 0);
  const limit = zh ? MAX_ZH : MAX_EN;
  if (len(words) <= limit) return [words];
  const clauses: TimedWord[][] = [];
  let cur: TimedWord[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[,:;.!?，。：；！？、…」—]$/.test(w.w)) {
      clauses.push(cur);
      cur = [];
    }
  }
  if (cur.length) clauses.push(cur);
  const pieces: TimedWord[][] = [];
  for (const c of clauses) {
    if (len(c) <= limit) {
      pieces.push(c);
      continue;
    }
    const n = Math.ceil(len(c) / limit);
    const target = len(c) / n;
    let part: TimedWord[] = [];
    for (const w of c) {
      if (part.length && len(part) + tokenLen(w, zh) > target + (zh ? 1 : 4) && (!ok || ok.has(idx.get(w) ?? 0))) {
        pieces.push(part);
        part = [];
      }
      part.push(w);
    }
    if (part.length) pieces.push(part);
  }
  const pages: TimedWord[][] = [];
  let page: TimedWord[] = [];
  for (const pc of pieces) {
    if (page.length && len(page) + len(pc) > limit) {
      pages.push(page);
      page = [];
    }
    page = page.concat(pc);
  }
  if (page.length) pages.push(page);
  return pages;
};

// Chinese subtitle convention: no commas / full stops on screen; inner ones become a gap, final ones are dropped.
const zhDisplay = (w: string, last: boolean) => {
  const stripped = w.replace(/[，。、；：,.;:…]+$/u, "");
  if (stripped === w) return { text: w, gap: false };
  return { text: stripped, gap: !last };
};

/**
 * Global caption layer (positioned at the bottom of its container). Words already spoken are bright; upcoming words
 * are dimmed. Pages break at clause punctuation; Chinese pages drop commas / full stops (a gap replaces inner ones).
 */
export const Captions: React.FC<{ timeline: Timeline; fontFamily?: string; zh?: boolean; maxWidth?: number }> = ({
  timeline,
  fontFamily = font.sans,
  zh = false,
  maxWidth = 1480,
}) => {
  const frame = useCurrentFrame();
  const pages: Page[] = useMemo(() => {
    const out: Page[] = [];
    for (const s of timeline.scenes) {
      for (const l of s.lines) {
        const abs = l.words.map((w) => ({ ...w, from: w.from + s.from, to: w.to + s.from }));
        for (const pg of paginate(abs, zh, `${s.id}:${l.id}`)) {
          out.push({ from: pg[0].from, to: pg[pg.length - 1].to, words: pg });
        }
      }
    }
    // hold each page until the next one starts (max 0.6s after its last word)
    return out.map((p, i) => {
      const next = out[i + 1];
      const hold = p.to + Math.round(0.6 * timeline.fps);
      return { ...p, to: next ? Math.min(hold, next.from) : hold };
    });
  }, [timeline, zh]);

  const page = pages.find((p) => frame >= p.from && frame < p.to);
  if (!page) return null;
  const fadeIn = Math.min(1, (frame - page.from + 1) / 4);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: zh ? 84 : layout.captionBottom,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth,
          textAlign: "center",
          fontFamily,
          fontSize: zh ? 50 : type.caption,
          fontWeight: zh ? 600 : 500,
          lineHeight: 1.35,
          letterSpacing: zh ? "0.04em" : "-0.005em",
          textShadow: "0 2px 18px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)",
          opacity: fadeIn,
          whiteSpace: "pre-wrap",
        }}
      >
        {page.words.map((w, i) => {
          const last = i === page.words.length - 1;
          const shown = zh ? zhDisplay(w.w, last) : { text: w.w, gap: false };
          const lead = i > 0 && w.sp ? " " : "";
          return (
            <span key={i} style={{ color: frame >= w.from ? color.text : "rgba(236,239,244,0.5)" }}>
              {lead}
              {shown.text}
              {shown.gap ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};
