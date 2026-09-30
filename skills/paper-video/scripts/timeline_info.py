#!/usr/bin/env python3
"""Print each scene's start frame, duration and anchor frames exactly as src/timeline/timeline.ts
computes them - handy when placing animation beats or checking a cut's total length.

Anchor frames are absolute (from the start of the video); negative leadInMs (a J-cut, voice
starting before the picture changes) shows up as anchors earlier than the scene's own start.

Usage: python3 scripts/timeline_info.py <cut> [--fps 30]
"""
import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import frames, load_vo, project_fps, scene_spans  # noqa: E402

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("cut", nargs="?", default="en")
p.add_argument("--fps", type=int, default=project_fps())
a = p.parse_args()
total = 0
for s, t, dur in scene_spans(load_vo(a.cut), a.fps):
    anchors = {k: t + frames(s["leadInMs"] + v, a.fps) for l in s["lines"] for k, v in l["anchors"].items()}
    print(f"{s['id']:16} from={t:5d} ({t / a.fps:6.2f}s) dur={dur:4d} ({dur / a.fps:5.2f}s)  "
          + " ".join(f"{k}={v}" for k, v in anchors.items()))
    total = t + dur
print(f"TOTAL {total} frames = {total / a.fps:.2f}s")
