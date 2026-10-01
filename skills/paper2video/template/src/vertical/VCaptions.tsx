// Phone captions: two short lines at most, very large, centred in the safe width, spoken words bright.
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { color, font } from "../theme";
import type { Timeline, TimedWord } from "../timeline/timeline";
import { CAP } from "./layout";

type Page = { from: number; to: number; lines: TimedWord[][] };

const cjk = (s: string) => (s.match(/[㐀-鿿]/g) ?? []).length;
// widths in CJK cells: a Latin letter at 72 px bold is ≈ 0.68 of a Chinese character
const tokLen = (w: TimedWord, zh: boolean) => (zh ? cjk(w.w) + (w.w.length - cjk(w.w)) * 0.68 + (w.sp ? 0.4 : 0) : w.w.length + 1);
const len = (ws: TimedWord[], zh: boolean) => ws.reduce((a, w) => a + tokLen(w, zh), 0);
const isBreak = (w: TimedWord) => /[,:;.!?，。：；！？、…」—]$/.test(w.w);

// Chinese has no spaces: break only between words. Word boundaries come from jieba (scripts/zh_breaks.py →
// public/data/zh_breaks.json, keyed "<scene>:<line>"): the renderer's Intl.Segmenter splits e.g. 金门大桥 as 金门|大|桥.
import zhBreaks from "../../public/data/zh_breaks.json";

/** Word indices i (1..n-1) of a caption line before which it may break. */
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

/** Split a line's words into pages of ≤ 2 caption lines: pages close at clause ends when possible; a two-line page is
 * split where the two lines are most even (a clause end wins if it is nearly as even), never inside a word. */
const paginate = (words: TimedWord[], zh: boolean, key: string): TimedWord[][][] => {
  const per = zh ? CAP.perLine.zh : CAP.perLine.en;
  const ok = zh ? breaksOf(words, key) : new Set(words.map((_, i) => i).filter((i) => i > 0));
  // 1. pages (index ranges into `words`)
  const pages: [number, number][] = [];
  let p0 = 0;
  for (let i = 0; i < words.length; i++) {
    const cur = words.slice(p0, i + 1);
    if (i > p0 && len(cur, zh) > 2 * per) {
      // close the page before word i: at the last clause end in its second half, else at the last word boundary
      let cut = -1;
      for (let j = i; j > p0; j--) if (isBreak(words[j - 1]) && ok.has(j) && len(words.slice(p0, j), zh) >= per * 0.6) { cut = j; break; }
      if (cut < 0) for (let j = i; j > p0; j--) if (ok.has(j)) { cut = j; break; }
      if (cut < 0) cut = i;
      pages.push([p0, cut]);
      p0 = cut;
    }
    if (isBreak(words[i]) && len(words.slice(p0, i + 1), zh) >= per * 1.2 && (i + 1 === words.length || ok.has(i + 1))) {
      pages.push([p0, i + 1]);
      p0 = i + 1;
    }
  }
  if (p0 < words.length) pages.push([p0, words.length]);
  // 2. each page → one or two caption lines, split at the most even word boundary (a clause end wins if nearly as even)
  return pages.map(([a, b]) => {
    const pg = words.slice(a, b);
    if (len(pg, zh) <= per) return [pg];
    let best = -1;
    let bestScore = Infinity;
    for (const strict of [true, false]) {
      for (let i = 1; i < pg.length; i++) {
        if (!ok.has(a + i)) continue;
        const x = len(pg.slice(0, i), zh);
        const y = len(pg.slice(i), zh);
        if (strict && (x > per + 0.5 || y > per + 0.5)) continue;
        const score = (strict ? 0 : 100 + Math.max(x, y)) + Math.abs(x - y) - (isBreak(pg[i - 1]) ? 3 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best >= 0) break;
    }
    if (best < 0) best = Math.ceil(pg.length / 2);
    return [pg.slice(0, best), pg.slice(best)];
  });
};

const zhShown = (w: string, last: boolean) => {
  const s = w.replace(/[，。、；：,.;:…]+$/u, "");
  return s === w ? { t: w, gap: false } : { t: s, gap: !last };
};

export const VCaptions: React.FC<{ timeline: Timeline; zh?: boolean }> = ({ timeline, zh = true }) => {
  const frame = useCurrentFrame();
  const pages: Page[] = useMemo(() => {
    const out: Page[] = [];
    for (const s of timeline.scenes) {
      for (const l of s.lines) {
        // a timed "word" can hold a list ("wait、however、suppose"): split it after 、/，/, into pieces with the same
        // timing, so a caption line may break inside the list instead of shrinking the whole page
        const abs = l.words.flatMap((w) =>
          w.w
            .split(/(?<=[、，])(?=.)|(?<=,)(?=\D)/u) // not inside numbers like 65,537
            .map((piece, k) => ({ ...w, w: piece, sp: k === 0 ? w.sp : false, from: w.from + s.from, to: w.to + s.from })),
        );
        for (const pg of paginate(abs, zh, `${s.id}:${l.id}`)) {
          const flat = pg.flat();
          out.push({ from: flat[0].from, to: flat[flat.length - 1].to, lines: pg });
        }
      }
    }
    return out.map((p, i) => {
      const next = out[i + 1];
      const hold = p.to + Math.round(0.5 * timeline.fps);
      return { ...p, to: next ? Math.min(hold, next.from) : hold };
    });
  }, [timeline, zh]);
  const page = pages.find((p) => frame >= p.from && frame < p.to);
  if (!page) return null;
  const fadeIn = Math.min(1, (frame - page.from + 1) / 3);
  // a page whose longest line is wider than the box is set smaller so it always fits
  const per = zh ? CAP.perLine.zh : CAP.perLine.en;
  const longest = Math.max(...page.lines.map((l) => len(l, zh)));
  const size = Math.floor((zh ? CAP.size.zh : CAP.size.en) * Math.min(1, (per + 0.6) / longest));
  return (
    <div
      style={{
        position: "absolute",
        left: CAP.left,
        width: CAP.right - CAP.left,
        top: CAP.top,
        height: CAP.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
        opacity: fadeIn,
      }}
    >
      {page.lines.map((ln, li) => (
        <div
          key={li}
          style={{
            fontFamily: zh ? font.zh : font.sans,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.28,
            letterSpacing: zh ? "0.03em" : "-0.01em",
            textAlign: "center",
            whiteSpace: "pre",
            textShadow: "0 3px 14px rgba(0,0,0,0.95)",
            WebkitTextStroke: "5px rgba(0,0,0,0.92)",
            paintOrder: "stroke fill",
          }}
        >
          {ln.map((w, i) => {
            const last = li === page.lines.length - 1 && i === ln.length - 1;
            const s = zh ? zhShown(w.w, last) : { t: w.w, gap: false };
            return (
              <span key={i} style={{ color: frame >= w.from ? color.text : "rgba(236,239,244,0.42)" }}>
                {i > 0 && w.sp ? " " : ""}
                {s.t}
                {s.gap ? " " : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
