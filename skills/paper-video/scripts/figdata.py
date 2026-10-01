#!/usr/bin/env python3
"""Get numbers out of a paper's figure files (arXiv source: figs/*.pdf|png) when no data was released.

Subcommands (see reference/third-party.md for when to use which; always prefer tables and released data):
  dump     vector figure PDF -> JSON of every drawing (type, stroke/fill colour, rect, points) and every text span
           with its box. Map tick labels to their positions and write a few lines that turn path coordinates into
           data (exact up to float precision). Prints a summary of the colours and labels found.
  images   extract the raster panels embedded in a figure PDF (many "vector" PDFs wrap PNG plots) -> PNG files.
  heatmap  rectangles filled from a matplotlib colormap (token heatmaps, confusion matrices, attention maps) ->
           value per rectangle via the colormap's LUT, plus the text drawn inside it (per character, so tokens that
           PyMuPDF merges into one span are split correctly). Reports the worst LUT distance (should be ~1e-6).
  markers  raster line+marker plot (matplotlib style, tick marks outside the axes) -> marker centres per series on
           a known x grid. Axes are calibrated from the tick marks; a marker hidden under a series drawn later takes
           that series' value (flag "occluded"); unrecoverable points are null. Always look at the --overlay image.

Usage:
  uv run --with pymupdf python scripts/figdata.py dump data/paper/src/figs/fig3.pdf --out data/fig3_dump.json
  uv run --with pymupdf python scripts/figdata.py images data/paper/src/figs/curves.pdf --out data/figimg/
  uv run --with pymupdf --with matplotlib --with numpy python scripts/figdata.py heatmap figs/tokens_p1.pdf \
      --cmap coolwarm --alpha 0.3 --vmin 0 --vmax 6.58 --out data/tokens_p1.json
  uv run --with numpy --with scipy --with pillow python scripts/figdata.py markers data/figimg/curves_0.png \
      --series ours=#8B0000 baseline=#5E8AD2 --xticks 0 500 1000 1500 --yticks 20 30 40 50 60 --grid 16 \
      --exclude 630,1100,1835,1330 --overlay /tmp/overlay.png --out data/curves_0.json

Report every extracted file in notes/data_report.md with its method and expected error, label digitised charts on
screen ("digitised from Fig. N"), and quote only numbers printed in the paper.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
from collections import Counter


# ------------------------------------------------------------------ vector PDFs
def _rgb(c):
    return None if c is None else "#" + "".join(f"{round(255 * v):02X}" for v in c[:3])


def dump(pdf, page=0):
    import pymupdf as fitz
    p = fitz.open(pdf)[page]
    drawings = []
    for i, d in enumerate(p.get_drawings()):
        pts = []
        for it in d["items"]:
            for q in it[1:]:
                if hasattr(q, "x") and hasattr(q, "y"):
                    pts.append([round(q.x, 2), round(q.y, 2)])
                elif hasattr(q, "x0"):
                    pts.append([round(q.x0, 2), round(q.y0, 2)])
                    pts.append([round(q.x1, 2), round(q.y1, 2)])
        r = d["rect"]
        drawings.append({"i": i, "type": d["type"], "stroke": _rgb(d.get("color")), "fill": _rgb(d.get("fill")),
                         "fillOpacity": d.get("fill_opacity"), "width": d.get("width"), "dashes": d.get("dashes"),
                         "rect": [round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)],
                         "items": [it[0] for it in d["items"]], "points": pts})
    spans = [{"text": s["text"], "bbox": [round(v, 2) for v in s["bbox"]], "size": round(s["size"], 1)}
             for b in p.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
    return {"pdf": str(pdf), "page": page, "size": [p.rect.width, p.rect.height], "drawings": drawings, "text": spans,
            "images": len(p.get_images())}


def summarise(d):
    print(f"{d['pdf']} page {d['page']}: {len(d['drawings'])} drawings, {len(d['text'])} text spans, "
          f"{d['images']} embedded images (use `images` if the plot is raster)")
    kinds = Counter((x["type"], x["stroke"], x["fill"], len(x["points"]) > 4) for x in d["drawings"])
    print("drawings by (type, stroke, fill, is-polyline): count")
    for k, n in kinds.most_common(15):
        print(f"  {k}: {n}")
    nums = [s for s in d["text"] if re.fullmatch(r"[-+−]?\d+(\.\d+)?%?", s["text"].strip())]
    print(f"numeric labels ({len(nums)}): " + ", ".join(f"{s['text']}@({s['bbox'][0]:.0f},{s['bbox'][1]:.0f})" for s in nums[:30]))


def images(pdf, out):
    import pymupdf as fitz
    doc = fitz.open(pdf)
    out = pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    stem = pathlib.Path(pdf).stem
    n = 0
    for pi, p in enumerate(doc):
        for info in p.get_images(full=True):
            pix = fitz.Pixmap(doc, info[0])
            if pix.n - pix.alpha >= 4:  # CMYK -> RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            path = out / f"{stem}_{n}.png"
            pix.save(path)
            rects = p.get_image_rects(info[0])
            where = f" at {[round(v) for v in rects[0]]}" if rects else ""
            print(f"  {path} {pix.width}x{pix.height}{where}")
            n += 1
    if not n:
        print("no embedded images: the figure is vector, use `dump`")


def heatmap(pdf, cmap, vmin, vmax, alpha=None, page=0, levels=256):
    """Colormap inversion. With fill opacity (alpha < 1) PDF viewers blend over white, but the PDF stores the
    unblended colour, so the LUT match is exact; `alpha` only selects which rectangles are cells."""
    import matplotlib
    import numpy as np
    import pymupdf as fitz
    p = fitz.open(pdf)[page]
    lut = matplotlib.colormaps[cmap].resampled(levels)(np.arange(levels))[:, :3]
    cells = [d for d in p.get_drawings() if d.get("fill") and d["type"] in ("f", "fs")
             and (alpha is None or abs((d.get("fill_opacity") or 1) - alpha) < 1e-3)]
    chars = [(c["c"], (c["bbox"][0] + c["bbox"][2]) / 2, (c["bbox"][1] + c["bbox"][3]) / 2)
             for b in p.get_text("rawdict")["blocks"] for l in b.get("lines", []) for s in l["spans"] for c in s["chars"]]
    out, worst = [], 0.0
    for d in sorted(cells, key=lambda d: (round(d["rect"].y0, 1), d["rect"].x0)):
        r = d["rect"]
        dist = np.linalg.norm(lut - np.array(d["fill"][:3]), axis=1)
        i = int(dist.argmin())
        worst = max(worst, float(dist.min()))
        text = "".join(ch for _, ch in sorted((x, ch) for ch, x, y in chars if r.x0 <= x < r.x1 and r.y0 <= y < r.y1))
        out.append({"text": text, "value": round(vmin + (i + 0.5) / levels * (vmax - vmin), 4),
                    "rect": [round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)]})
    print(f"{len(out)} cells; worst LUT distance {worst:.1e} (>1e-3: wrong colormap/levels, or not a colormap fill); "
          f"resolution ±{(vmax - vmin) / levels / 2:.4f}")
    return {"pdf": str(pdf), "cmap": cmap, "levels": levels, "vmin": vmin, "vmax": vmax, "maxLutDistance": worst, "cells": out}


# ------------------------------------------------------------------ raster line+marker plots
def _frame(dark):
    """Axes spines: the longest dark row/column runs, ignoring a few pixels at the image border."""
    import numpy as np
    h, w = dark.shape
    m = dark.copy()
    m[:6, :] = m[-6:, :] = False
    m[:, :6] = m[:, -6:] = False
    col, row = m.sum(0), m.sum(1)
    return (int(np.argmax(col[: w // 3])), int(w // 2 + np.argmax(col[w // 2:])),
            int(np.argmax(row[: h // 3])), int(h // 2 + np.argmax(row[h // 2:])))


def _clusters(idx):
    out, cur = [], []
    for i in idx:
        if cur and i - cur[-1] > 2:
            out.append(cur)
            cur = []
        cur.append(i)
    if cur:
        out.append(cur)
    return [sum(c) / len(c) for c in out]


def calibrate(img, xticks, yticks, ylog=False):
    """Pixel -> value maps from the tick marks (short dark segments just outside the frame)."""
    import numpy as np
    dark = img.astype(int).max(2) < 70
    left, right, top, bottom = _frame(dark)
    xs = _clusters(np.where(dark[bottom + 4: bottom + 14, left - 5: right + 6].any(0))[0] + left - 5)
    ys = _clusters(np.where(dark[top - 5: bottom + 6, left - 14: left - 4].any(1))[0] + top - 5)
    if len(xs) < len(xticks) or len(ys) < len(yticks):
        raise SystemExit(f"found {len(xs)} x / {len(ys)} y tick marks for {len(xticks)} / {len(yticks)} labels: give the "
                         "ticks from the left/bottom up to the last visible one, or crop the panel")
    xs = xs[: len(xticks)]
    ys = sorted(ys, reverse=True)[: len(yticks)]
    px = np.polyfit(xs, xticks, 1)
    py = np.polyfit(ys, np.log10(yticks) if ylog else np.array(yticks, float), 1)
    fx = lambda p: np.polyval(px, p)
    fy = (lambda p: 10 ** np.polyval(py, p)) if ylog else (lambda p: np.polyval(py, p))
    inv_x = lambda v: (v - px[1]) / px[0]
    inv_y = lambda v: ((np.log10(v) if ylog else v) - py[1]) / py[0]
    return (left, right, top, bottom), fx, fy, inv_x, inv_y


def markers(png, series, xticks, yticks, grid, exclude=(), tol=40, overlay=None, kmax=None, ylog=False, avoid=()):
    """series: {name: (r, g, b)} in drawing order (later = on top). At every grid x, a marker centre is where a disc
    of the marker radius fits inside (own colour | colours drawn later) and covers the most own colour.
    avoid: (x, y) data points of glyphs in a series colour (stars marking a best value): their arms are wider than a
    marker and would be taken for points in the neighbouring columns, so ~2.2 marker radii around them are ignored."""
    import numpy as np
    from PIL import Image, ImageDraw
    from scipy import ndimage
    img = np.array(Image.open(png).convert("RGB"))
    (left, right, top, bottom), fx, fy, inv_x, inv_y = calibrate(img, xticks, yticks, ylog)
    a = img.astype(int)
    keep = np.zeros(a.shape[:2], bool)
    keep[top + 2: bottom - 1, left + 2: right - 1] = True
    for x0, y0, x1, y1 in exclude:
        keep[y0:y1, x0:x1] = False
    masks = {n: (np.abs(a - np.array(c)).sum(2) < tol) & keep for n, c in series.items()}
    names = list(series)
    ext = {}
    for j, n in enumerate(names):
        e = masks[n].copy()
        for o in names[j + 1:]:
            e |= masks[o]
        ext[n] = e
    colmax = ndimage.distance_transform_edt(masks[names[-1]])[top + 3: bottom - 2].max(0)
    r_est = float(np.median(colmax[colmax > 5])) if (colmax > 5).any() else 8.0
    rr = max(3, int(np.floor(r_est)) - 1)
    yy, xx = np.ogrid[-rr:rr + 1, -rr:rr + 1]
    disc = ((xx * xx + yy * yy) <= rr * rr).astype(float)
    area = disc.sum()
    own_cnt = {n: ndimage.convolve(masks[n].astype(float), disc, mode="constant") for n in names}
    ext_frac = {n: ndimage.convolve(ext[n].astype(float), disc, mode="constant") / area for n in names}
    kmax = kmax or int(fx(right - 2) // grid)
    found = {n: {} for n in names}
    for k in range(1, kmax + 1):
        X = inv_x(k * grid)
        if X < left + rr or X > right - rr:
            continue
        xi = int(round(X))
        for n in names:
            score = own_cnt[n][:, xi] * (ext_frac[n][:, xi] >= 0.9)
            score[: top + 3] = 0
            score[bottom - 2:] = 0
            for ax, ay in avoid:
                if abs(xi - inv_x(ax)) <= 2.2 * r_est:
                    ay_px = inv_y(ay)
                    score[max(0, int(ay_px - 2.2 * r_est)): max(0, int(ay_px + 2.2 * r_est) + 1)] = 0
            m = score.max()
            if m < 0.12 * area:
                continue
            best = int(np.argmax(score))
            run = [best]
            for step in (-1, 1):
                t = best + step
                while 0 <= t < len(score) and score[t] >= m - 0.5:
                    run.append(t)
                    t += step
            cy = float(np.mean(run))
            found[n][k] = (float(fy(cy)), (X, cy))
    out = {}
    for j, n in enumerate(names):
        ys, flags = [], []
        for k in range(1, kmax + 1):
            if k in found[n]:
                ys.append(round(found[n][k][0], 4))
                flags.append("")
                continue
            X = inv_x(k * grid)
            xi = int(round(X))
            own = np.where(masks[n][:, max(0, xi - 2): xi + 3].any(1) & keep[:, min(max(xi, 0), keep.shape[1] - 1)])[0] \
                if left + 2 < X < right - 2 else []
            occ = next((found[o][k] for o in names[j + 1:] if k in found[o] and len(own)
                        and np.min(np.abs(own - found[o][k][1][1])) < 2.2 * r_est), None)
            ys.append(round(occ[0], 4) if occ else None)
            flags.append("occluded" if occ else "missing")
        out[n] = {"x": [k * grid for k in range(1, kmax + 1)], "y": ys, "flags": flags}
    if overlay:
        im = Image.fromarray(img).convert("RGB")
        d = ImageDraw.Draw(im)
        for n in names:
            for v, (cx, cy) in found[n].values():
                d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], outline=(0, 255, 0), width=3)
            for x, fl in zip(out[n]["x"], out[n]["flags"]):
                X = inv_x(x)
                if fl == "occluded":
                    d.rectangle([X - 5, top + 4, X + 5, top + 14], fill=(255, 0, 255))
                elif fl == "missing" and left < X < right:
                    d.rectangle([X - 5, bottom - 14, X + 5, bottom - 4], fill=(255, 140, 0))
        for x0, y0, x1, y1 in exclude:
            d.rectangle([x0, y0, x1, y1], outline=(255, 0, 255), width=2)
        im.save(overlay)
        print(f"overlay: {overlay} (green = found, magenta = occluded, orange = missing, boxes = excluded)")
    return {"png": str(png), "markerRadiusPx": round(r_est, 1), "frame": [left, right, top, bottom], "series": out}


def _hex(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("dump")
    d.add_argument("pdf")
    d.add_argument("--page", type=int, default=0)
    d.add_argument("--out")
    i = sub.add_parser("images")
    i.add_argument("pdf")
    i.add_argument("--out", required=True)
    h = sub.add_parser("heatmap")
    h.add_argument("pdf")
    h.add_argument("--cmap", required=True)
    h.add_argument("--vmin", type=float, required=True)
    h.add_argument("--vmax", type=float, required=True)
    h.add_argument("--alpha", type=float, help="fill opacity of the cells (to tell them from other filled shapes)")
    h.add_argument("--levels", type=int, default=256)
    h.add_argument("--page", type=int, default=0)
    h.add_argument("--out", required=True)
    m = sub.add_parser("markers")
    m.add_argument("png")
    m.add_argument("--series", nargs="+", required=True, help="name=#RRGGBB in drawing order (later = on top)")
    m.add_argument("--xticks", nargs="+", type=float, required=True)
    m.add_argument("--yticks", nargs="+", type=float, required=True)
    m.add_argument("--grid", type=float, required=True, help="x spacing of the evaluation points")
    m.add_argument("--kmax", type=int, help="number of grid points (default: up to the right spine)")
    m.add_argument("--ylog", action="store_true")
    m.add_argument("--exclude", nargs="*", default=[], help="x0,y0,x1,y1 pixel boxes to ignore (legend, labels)")
    m.add_argument("--avoid", nargs="*", default=[], help="x,y data points of star/label glyphs drawn in a series colour")
    m.add_argument("--tol", type=int, default=40, help="colour tolerance (sum of |dR|+|dG|+|dB|)")
    m.add_argument("--overlay")
    m.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.cmd == "dump":
        res = dump(a.pdf, a.page)
        summarise(res)
        if a.out:
            pathlib.Path(a.out).write_text(json.dumps(res, indent=1))
    elif a.cmd == "images":
        images(a.pdf, a.out)
    elif a.cmd == "heatmap":
        pathlib.Path(a.out).write_text(json.dumps(heatmap(a.pdf, a.cmap, a.vmin, a.vmax, a.alpha, a.page, a.levels),
                                                  ensure_ascii=False, indent=1))
    else:
        series = dict((kv.split("=")[0], _hex(kv.split("=")[1])) for kv in a.series)
        ex = [tuple(int(v) for v in e.split(",")) for e in a.exclude]
        av = [tuple(float(v) for v in e.split(",")) for e in a.avoid]
        res = markers(a.png, series, a.xticks, a.yticks, a.grid, ex, a.tol, a.overlay, a.kmax, a.ylog, av)
        for n, s in res["series"].items():
            print(f"  {n}: {sum(1 for f in s['flags'] if not f)} found, {s['flags'].count('occluded')} occluded, "
                  f"{s['flags'].count('missing')} missing")
        pathlib.Path(a.out).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
