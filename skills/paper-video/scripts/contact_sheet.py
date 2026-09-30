#!/usr/bin/env python3
"""Tile still frames (e.g. from `npx remotion still`) into one contact sheet with ffmpeg, to review
many key frames at a glance. Each cell is 640x360 (16:9) unless --cell is given.

Usage: python3 scripts/contact_sheet.py out/sheet.png a.png b.png ... [--cols 3] [--cell 640x360]
"""
import argparse
import subprocess

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("out")
p.add_argument("files", nargs="+")
p.add_argument("--cols", type=int, default=3)
p.add_argument("--cell", default="640x360", help="WxH per tile, e.g. 360x640 for vertical frames")
a = p.parse_args()
w, h = (int(x) for x in a.cell.split("x"))
n = len(a.files)
args = ["ffmpeg", "-y", "-loglevel", "error"] + sum((["-i", f] for f in a.files), [])
filt = "".join(f"[{i}]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2[v{i}];" for i in range(n))
if n == 1:
    filt += "[v0]null[out]"
else:
    layout = "|".join(f"{(k % a.cols) * w}_{(k // a.cols) * h}" for k in range(n))
    filt += "".join(f"[v{k}]" for k in range(n)) + f"xstack=inputs={n}:layout={layout}:fill=black[out]"
subprocess.run(args + ["-filter_complex", filt, "-map", "[out]", "-frames:v", "1", a.out], check=True)
print(a.out)
