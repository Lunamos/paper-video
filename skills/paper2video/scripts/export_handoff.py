#!/usr/bin/env python3
"""Hand a cut over to an editing app (Premiere Pro, Final Cut Pro, DaVinci Resolve, CapCut / 剪映 ...).

Writes out/handoff/<name>/:
  picture.mp4 | picture.mov   full picture, no audio, captions NOT burned in (unless --burn-captions)
  scenes/NN_<scene>.mp4|.mov  per-scene clips cut frame-exactly from the picture (--per-scene)
  stems/voice.wav             voice-over only           }  each rendered by Remotion with the other
  stems/music.wav             music bed only (ducked)   }  tracks muted; all start at 00:00:00:00,
  stems/sfx.wav               sound effects only        }  so they line up when dropped at frame 0
  stems/mix.wav               everything (only with --stems ...,mix)
  captions.srt                captions (same paging as the burned-in ones)
  scenes.csv                  scene boundaries: frames, timecodes, seconds, chapter, first line
  scenes.edl                  CMX3600 EDL, one video event per scene (chapters in comments)

Stems are pre-master: after editing, master the final mix to -14 LUFS / -1.5 dBTP (see finalize.sh).
The music stem already contains the ducking under the voice; the raw bed is public/audio/bgm_<cut>.mp3.

Template contract: the video composition accepts an input prop `mute`, a list of any of
"voice" | "music" | "sfx" | "captions"; muted tracks are simply not mounted. This script renders:
  picture  --muted --props '{"mute": ["captions"]}'
  stem X   --codec=wav --props '{"mute": [every audio track except X, "captions"]}'
Extra props (e.g. '{"lang": "zh"}') can be merged in with --props.

Usage:
  python3 scripts/export_handoff.py VIDEO-EN --lang en [--per-scene] [--codec prores] [--stems voice,music,sfx]
  python3 scripts/export_handoff.py VIDEO-ZH --lang zh --skip-render     # only SRT / CSV / EDL
"""
from __future__ import annotations

import argparse
import csv
import json
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import srt  # noqa: E402
from common import ROOT, load_script, load_vo, project_fps, scene_spans, text_lang  # noqa: E402

AUDIO_TRACKS = ("voice", "music", "sfx")


def tc(frame: int, fps: int, start: int = 0) -> str:
    """Non-drop-frame timecode HH:MM:SS:FF."""
    f = frame + start
    return f"{f // (3600 * fps):02d}:{f // (60 * fps) % 60:02d}:{f // fps % 60:02d}:{f % fps:02d}"


def parse_tc(s: str, fps: int) -> int:
    h, m, sec, fr = (int(x) for x in s.split(":"))
    return ((h * 60 + m) * 60 + sec) * fps + fr


def remotion(args: list[str]):
    print("  $ npx remotion " + " ".join(args))
    subprocess.run(["npx", "remotion", *args], cwd=ROOT, check=True)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("composition", help="Remotion composition id of the full video")
    p.add_argument("--lang", required=True, help="cut id whose public/data/vo.<cut>.json the composition uses")
    p.add_argument("--name", help="output folder name (default: composition id)")
    p.add_argument("--per-scene", action="store_true", help="also split the picture into one clip per scene")
    p.add_argument("--codec", choices=["h264", "prores"], default="h264", help="picture codec (prores = ProRes 422 HQ .mov)")
    p.add_argument("--stems", default="voice,music,sfx", help="comma list of voice,music,sfx,mix; 'none' to skip")
    p.add_argument("--burn-captions", action="store_true", help="keep captions in the picture")
    p.add_argument("--props", default="{}", help="extra input props (JSON) merged into every render")
    p.add_argument("--tc-start", default="00:00:00:00", help="record timecode of frame 0 in the EDL, e.g. 01:00:00:00")
    p.add_argument("--skip-render", action="store_true", help="write SRT / CSV / EDL only")
    a = p.parse_args()

    fps = project_fps()
    out = ROOT / "out" / "handoff" / (a.name or a.composition)
    out.mkdir(parents=True, exist_ok=True)
    extra = json.loads(a.props)
    script = load_script()
    info = {s["id"]: s for s in script["scenes"]}
    tl = text_lang(script, a.lang)
    spans = scene_spans(load_vo(a.lang), fps)
    total = spans[-1][1] + spans[-1][2] if spans else 0
    start = parse_tc(a.tc_start, fps)
    ext = "mov" if a.codec == "prores" else "mp4"
    picture = out / f"picture.{ext}"

    # ---- captions, scene list, EDL (cheap, always)
    n = srt.write_srt(a.lang, out / "captions.srt", fps)
    rows = []
    for k, (s, f0, d) in enumerate(spans, 1):
        first = s["lines"][0]["text"] if s["lines"] else ""
        rows.append({"index": k, "scene": s["id"], "chapter": info.get(s["id"], {}).get("chapter", ""),
                     "startFrame": f0, "endFrame": f0 + d, "durationFrames": d,
                     "startTC": tc(f0, fps, start), "endTC": tc(f0 + d, fps, start),
                     "startS": round(f0 / fps, 3), "durationS": round(d / fps, 3),
                     "clip": f"{k:02d}_{s['id']}.{ext}", "firstLine": first})
    with (out / "scenes.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    edl = [f"TITLE: {(a.name or a.composition)[:60]}", "FCM: NON-DROP FRAME", ""]
    for r in rows:
        if a.per_scene:  # each event plays its own clip from 0
            src_in, src_out, clip = tc(0, fps), tc(r["durationFrames"], fps), r["clip"]
        else:  # each event is the matching range of the one picture file
            src_in, src_out, clip = tc(r["startFrame"], fps), tc(r["endFrame"], fps), picture.name
        edl += [f"{r['index']:03d}  AX       V     C        {src_in} {src_out} {r['startTC']} {r['endTC']}",
                f"* FROM CLIP NAME: {clip}",
                f"* COMMENT: {r['scene']}" + (f" | chapter: {r['chapter']}" if r["chapter"] else ""), ""]
    (out / "scenes.edl").write_text("\n".join(edl))
    print(f"[handoff] {len(rows)} scenes, {total} frames @ {fps} fps ({total / fps:.2f}s), {n} caption cues, text={tl}")
    if a.skip_render:
        print(f"[done] {out}")
        return

    # ---- picture (silent)
    codec = ["--codec=prores", "--prores-profile=hq"] if a.codec == "prores" else ["--codec=h264", "--crf=15"]
    mute = [] if a.burn_captions else ["captions"]
    remotion(["render", a.composition, str(picture), *codec, "--muted", "--log=error",
              f"--props={json.dumps(extra | {'mute': list(AUDIO_TRACKS) + mute})}"])

    # ---- stems
    stems = [] if a.stems == "none" else [x.strip() for x in a.stems.split(",") if x.strip()]
    for st in stems:
        if st not in (*AUDIO_TRACKS, "mix"):
            sys.exit(f"unknown stem {st}")
        (out / "stems").mkdir(exist_ok=True)
        muted = [t for t in AUDIO_TRACKS if t != st and st != "mix"] + ["captions"]
        remotion(["render", a.composition, str(out / "stems" / f"{st}.wav"), "--codec=wav", "--log=error",
                  f"--props={json.dumps(extra | {'mute': muted})}"])

    # ---- per-scene clips, frame-exact from the picture
    if a.per_scene:
        (out / "scenes").mkdir(exist_ok=True)
        vcodec = ["-c:v", "prores_ks", "-profile:v", "3"] if a.codec == "prores" else ["-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p"]
        for r in rows:
            subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{r['startFrame'] / fps:.6f}", "-i", str(picture),
                            "-frames:v", str(r["durationFrames"]), "-an", *vcodec, str(out / "scenes" / r["clip"])], check=True)
    print(f"[done] {out}")


if __name__ == "__main__":
    main()
