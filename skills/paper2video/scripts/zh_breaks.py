#!/usr/bin/env python3
"""Word boundaries for the Chinese captions (16:9 and vertical cut): public/data/zh_breaks.json = {"<scene>:<line>":
[character offsets where a caption line may break]}, computed with jieba on the caption words of
public/data/vo.zh.json (joined without spaces, exactly as src/vertical/VCaptions.tsx joins them). The renderer's
Intl.Segmenter splits e.g. 金门大桥 as 金门|大|桥, which strands 「桥」 on the next caption page.
Re-run after every Chinese voice build:  uv run --with jieba python scripts/zh_breaks.py [--cut zh]
"""
import argparse
import json
import logging
import pathlib
import sys
import warnings

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import ROOT  # noqa: E402

warnings.filterwarnings("ignore")
try:
    import jieba
except ImportError:
    sys.exit("needs jieba: uv run --with jieba python scripts/zh_breaks.py")
jieba.setLogLevel(logging.ERROR)

ap = argparse.ArgumentParser()
ap.add_argument("--cut", default="zh")
a = ap.parse_args()
vo = json.loads((ROOT / f"public/data/vo.{a.cut}.json").read_text())
out = {}
for s in vo["scenes"]:
    for l in s["lines"]:
        text = "".join(w["w"] for w in l["words"])
        offs, o = [], 0
        for tok in jieba.cut(text, HMM=True):
            if o > 0:
                offs.append(o)
            o += len(tok)
        out[f"{s['id']}:{l['id']}"] = offs
(ROOT / "public/data/zh_breaks.json").write_text(json.dumps(out, ensure_ascii=False))
print(f"{len(out)} lines -> public/data/zh_breaks.json")
