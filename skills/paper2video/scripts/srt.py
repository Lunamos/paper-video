#!/usr/bin/env python3
"""Export the captions of a cut as .srt (YouTube CC, Bilibili subtitles, editing apps).

Timing and paging mirror the template's src/components/Captions.tsx: one page ~ one line
(58 characters for latin scripts; 18 for CJK, where full-width punctuation at a page end is
dropped and mid-page punctuation becomes a space, as in Chinese subtitle practice).
Pages break at clause punctuation first, then evenly. Each cue ends 0.6 s after its last word
(or when the next cue starts).

Usage: python3 scripts/srt.py <cut> [--out out/<cut>.srt] [--fps 30]
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import CJK, ROOT, frames, is_cjk_lang, load_vo, project_fps, scene_spans  # noqa: E402

LIMIT_LATIN, LIMIT_CJK = 58, 18
HOLD = 0.6  # s a cue stays up after its last word


def tlen(w, cjk):
    if not cjk:
        return len(w["w"]) + 1
    n = len(CJK.findall(w["w"]))
    return n + (len(w["w"]) - n) * 0.55 + (0.5 if w.get("sp") else 0)


def paginate(words, cjk):
    limit = LIMIT_CJK if cjk else LIMIT_LATIN
    L = lambda ws: sum(tlen(w, cjk) for w in ws)  # noqa: E731
    if L(words) <= limit:
        return [words]
    clauses, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[,:;.!?，。：；！？、…」—]$", w["w"]):
            clauses.append(cur)
            cur = []
    if cur:
        clauses.append(cur)
    pieces = []
    for c in clauses:
        if L(c) <= limit:
            pieces.append(c)
            continue
        target = L(c) / -(-L(c) // limit)
        part = []
        for w in c:
            if part and L(part) + tlen(w, cjk) > target + (1 if cjk else 4):
                pieces.append(part)
                part = []
            part.append(w)
        if part:
            pieces.append(part)
    pages, page = [], []
    for pc in pieces:
        if page and L(page) + L(pc) > limit:
            pages.append(page)
            page = []
        page += pc
    if page:
        pages.append(page)
    return pages


def text_of(ws, cjk):
    out = ""
    for i, w in enumerate(ws):
        t = w["w"]
        if cjk:
            stripped = re.sub(r"[，。、；：,.;:…]+$", "", t)
            t = stripped + ("" if i == len(ws) - 1 or stripped == t else " ")
        out += (" " if i and w.get("sp") else "") + t
    return out.strip()


def timecode(frame, fps):
    ms = round(frame / fps * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def cues(cut, fps):
    """[(fromFrame, toFrame, text)] for the whole cut."""
    vo = load_vo(cut)
    cjk = is_cjk_lang(vo["meta"].get("textLang", cut))
    pages = []
    for s, t0, _ in scene_spans(vo, fps):
        lead = s["leadInMs"]
        for l in s["lines"]:
            ws = [{"w": w["w"], "sp": w.get("sp", 0), "from": t0 + frames(lead + w["startMs"], fps),
                   "to": t0 + frames(lead + w["endMs"], fps)} for w in l["words"]]
            for pg in paginate(ws, cjk) if ws else []:
                pages.append((max(0, pg[0]["from"]), pg[-1]["to"], text_of(pg, cjk)))
    hold = round(HOLD * fps)
    return [(a, min(b + hold, pages[i + 1][0] if i + 1 < len(pages) else b + hold), txt) for i, (a, b, txt) in enumerate(pages)]


def write_srt(cut, out, fps):
    cs = cues(cut, fps)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(f"{i + 1}\n{timecode(a, fps)} --> {timecode(b, fps)}\n{txt}\n" for i, (a, b, txt) in enumerate(cs)))
    return len(cs)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cut", nargs="?", default="en")
    p.add_argument("--out")
    p.add_argument("--fps", type=int, default=project_fps())
    a = p.parse_args()
    if a.out:
        out = pathlib.Path(a.out)
    else:  # out/<slug>_<cut>.srt, slug = package.json "name" (the workspace convention); else out/<cut>.srt
        try:
            slug = json.loads((ROOT / "package.json").read_text()).get("name", "")
        except (OSError, ValueError):
            slug = ""
        out = ROOT / "out" / (f"{slug}_{a.cut}.srt" if slug and slug != "paper-video" else f"{a.cut}.srt")
    print(f"{write_srt(a.cut, out, a.fps)} cues -> {out}")


if __name__ == "__main__":
    main()
