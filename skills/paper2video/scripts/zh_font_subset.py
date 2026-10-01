#!/usr/bin/env python3
"""Build a small local CJK font subset (default: Noto Sans SC / 思源黑体) for the CJK cuts.

Why: loading Noto Sans SC from Google Fonts at render time means ~100 unicode-range slices per
weight, i.e. hundreds of requests per render tab (slow, flaky). Instead, collect every CJK
character the video can show - caption text of all CJK-language blocks in scenes.json plus every
CJK string in src/ - and ask Google Fonts for exactly those glyphs (css2 `text=` parameter),
one woff2 per weight.

Writes public/fonts/<lang>/<Family>-<weight>.woff2 and the manifest src/theme/fonts-<lang>.json:
  {"family": "<Family> Subset", "chars": N, "files": {"400": "fonts/zh/NotoSansSC-400.woff2", ...},
   "hand": {"family": "<Hand> Subset", "file": "..."}}       # only with --hand
The template's theme loads these with FontFace and uses the family as the CJK fallback.

Re-run after changing any CJK text:
  python3 scripts/zh_font_subset.py [--lang zh] [--family "Noto Sans SC"] [--weights 400,500,700] [--hand "Long Cang"]
"""
import argparse
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import ROOT, is_cjk_lang, load_script  # noqa: E402

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
CHARS = re.compile(r"[　-〿぀-ヿ㐀-鿿＀-￯—…“”‘’·]")
BASE = "，。、；：？！「」『』（）《》〈〉【】——……“”‘’·～"


def collect(langs) -> str:
    chars = set(BASE)
    for s in load_script()["scenes"]:
        for lang in langs:
            for l in s.get(lang, {}).get("lines", []):
                chars.update(CHARS.findall(l["text"]))
    for f in (ROOT / "src").rglob("*.ts*"):
        chars.update(CHARS.findall(f.read_text(errors="ignore")))
    return "".join(sorted(chars))


def fetch(family, weight, text) -> bytes:
    spec = f"{family}:wght@{weight}" if weight else family
    q = urllib.parse.urlencode({"family": spec, "text": text, "display": "block"})
    css = urllib.request.urlopen(urllib.request.Request(f"https://fonts.googleapis.com/css2?{q}", headers={"User-Agent": UA}),
                                 timeout=60).read().decode()
    urls = re.findall(r"url\((https://[^)]+)\)", css)
    if len(urls) != 1:
        sys.exit(f"unexpected css for {spec}: {len(urls)} font urls")
    return urllib.request.urlopen(urllib.request.Request(urls[0], headers={"User-Agent": UA}), timeout=60).read()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lang", default="zh", help="text language whose blocks are collected; also names the output folder")
    p.add_argument("--family", default="Noto Sans SC", help="Google Fonts family (Noto Sans JP for Japanese, ...)")
    p.add_argument("--weights", default="400,500,600,700,900")
    p.add_argument("--hand", help="optional handwriting family for annotations, e.g. 'Long Cang'")
    a = p.parse_args()
    if not is_cjk_lang(a.lang):
        sys.exit(f"{a.lang} is not a CJK language")
    text = collect([a.lang])
    out = ROOT / "public" / "fonts" / a.lang
    out.mkdir(parents=True, exist_ok=True)
    stem = a.family.replace(" ", "")
    manifest = {"family": f"{a.family} Subset", "chars": len(text), "files": {}}
    for w in [int(x) for x in a.weights.split(",")]:
        data = fetch(a.family, w, text)
        dst = out / f"{stem}-{w}.woff2"
        dst.write_bytes(data)
        manifest["files"][str(w)] = f"fonts/{a.lang}/{dst.name}"
        print(f"{a.family} {w}: {len(data) / 1024:.0f} KB")
    if a.hand:
        data = fetch(a.hand, None, text)
        dst = out / f"{a.hand.replace(' ', '')}-400.woff2"
        dst.write_bytes(data)
        manifest["hand"] = {"family": f"{a.hand} Subset", "file": f"fonts/{a.lang}/{dst.name}"}
        print(f"{a.hand}: {len(data) / 1024:.0f} KB")
    dst = ROOT / "src" / "theme" / f"fonts-{a.lang}.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"{len(text)} characters -> {out.relative_to(ROOT)}, manifest {dst.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
