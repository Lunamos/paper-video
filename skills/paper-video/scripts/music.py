#!/usr/bin/env python3
"""Background music bed for one cut, composed chapter by chapter to the voice-over timeline.

Optional. Two ways:
  1. ElevenLabs Music (paid, ELEVENLABS_API_KEY in env or .env): one instrumental composition whose
     sections match your chapters in length, so the mood changes where the story does.
  2. Your own royalty-free track (--file): levelled, trimmed to the video and faded out.
Either way the result is public/audio/bgm_<cut>.mp3 at -17.4 LUFS (linear gain, no dynamics
processing); the video ducks it under the voice.

Chapters come from scenes.json: a scene may carry "chapter": "<name>" (scenes without one join the
previous chapter) and "musicStyles": [...] (merged into that chapter's local styles). Global styles:
  "music": {"positive": [...], "negative": [...], "cutStyles": {"<cut>": [...]}, "seed": 7,
            "creditsPerSecond": 14}
Section lengths come from public/data/vo.<cut>.json (same maths as src/timeline/timeline.ts), so
build the voice-over first. The quota is queried before the request and the run aborts if the
estimate exceeds it. Keys are never printed.

Usage:
  python3 scripts/music.py --lang en [--dry-run]
  python3 scripts/music.py --lang en --file ~/Music/some_cc0_track.mp3
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import ROOT, dur_s, env_key, load_script, load_vo, loudness, project_fps, scene_spans  # noqa: E402

CACHE = ROOT / "audio_cache" / "music"
TARGET_LUFS = -17.4
RING_OUT_S = 1.5
SECTION_MIN_MS, SECTION_MAX_MS = 3000, 120000
GLOBAL_POS = ["minimal ambient electronic", "warm analog synth pads", "soft plucked arpeggios", "gentle felt piano",
              "curious, hopeful, clean modern science explainer", "instrumental"]
GLOBAL_NEG = ["vocals", "choir", "heavy drums", "aggressive", "EDM drop", "cinematic trailer hits", "dubstep", "lo-fi vinyl hiss",
              "busy melody that competes with narration"]


def call(path, payload=None, raw=False):
    r = urllib.request.Request("https://api.elevenlabs.io" + path, data=json.dumps(payload).encode() if payload else None,
                               headers={"xi-api-key": env_key("ELEVENLABS_API_KEY"), "Content-Type": "application/json"},
                               method="POST" if payload else "GET")
    try:
        with urllib.request.urlopen(r, timeout=600) as resp:
            return resp.read() if raw else json.load(resp)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} on {path.split('?')[0]}: {e.read().decode(errors='replace')[:400]}") from None


def remaining():
    s = call("/v1/user/subscription")
    return s["character_limit"] - s["character_count"]


def chapters(script, cut, fps):
    """[{name, ms, styles}] from the scenes' chapter / musicStyles fields and the built timeline."""
    info = {s["id"]: s for s in script["scenes"]}
    out = []
    for s, _, d in scene_spans(load_vo(cut), fps):
        sc = info.get(s["id"], {})
        name = sc.get("chapter") or (out[-1]["name"] if out else s["id"])
        if not out or out[-1]["name"] != name:
            out.append({"name": name, "ms": 0, "styles": []})
        out[-1]["ms"] += round(d / fps * 1000)
        out[-1]["styles"] += [x for x in sc.get("musicStyles", []) if x not in out[-1]["styles"]]
    out[-1]["ms"] += round(RING_OUT_S * 1000)
    merged = []  # the API wants 3-120 s per section
    for c in out:
        if merged and c["ms"] < SECTION_MIN_MS:
            merged[-1]["ms"] += c["ms"]
            continue
        n = -(-c["ms"] // SECTION_MAX_MS)
        merged += [{"name": c["name"] + (f" ({k + 1})" if n > 1 else ""), "ms": c["ms"] // n + (c["ms"] % n if k == n - 1 else 0),
                    "styles": c["styles"]} for k in range(n)]
    return merged


def level(src, dst, total_s=None):
    """Linear gain to TARGET_LUFS; with total_s, trim to it and fade out over the last 3 s."""
    af = []
    if total_s and dur_s(src) > total_s:
        af += [f"atrim=0:{total_s:.3f}", f"afade=t=out:st={max(0.0, total_s - 3):.3f}:d=3"]
    tmp = dst.with_suffix(".tmp.wav")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src)] + (["-af", ",".join(af)] if af else [])
                   + ["-ar", "44100", "-ac", "2", str(tmp)], check=True)
    gain = TARGET_LUFS - loudness(tmp)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(tmp), "-af", f"volume={gain:.2f}dB",
                    "-c:a", "libmp3lame", "-b:a", "192k", str(dst)], check=True)
    tmp.unlink()
    print(f"[level] gain {gain:+.2f} dB -> {TARGET_LUFS} LUFS  {dst.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", default="en", help="cut id (reads public/data/vo.<cut>.json)")
    ap.add_argument("--file", help="use this royalty-free track instead of generating one")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    script, fps = load_script(), project_fps()
    dst = ROOT / "public" / "audio" / f"bgm_{a.lang}.mp3"
    dst.parent.mkdir(parents=True, exist_ok=True)
    total_s = sum(d for _, _, d in scene_spans(load_vo(a.lang), fps)) / fps + RING_OUT_S
    if a.file:
        level(pathlib.Path(a.file).expanduser(), dst, total_s)
        return
    if not env_key("ELEVENLABS_API_KEY", required=False):
        print("No ELEVENLABS_API_KEY: music generation skipped (the video works without music).\n"
              "To add a bed, pick a royalty-free / CC0 instrumental track (e.g. YouTube Audio Library,\n"
              "Pixabay Music, Free Music Archive - check each licence) and run:\n"
              f"  python3 scripts/music.py --lang {a.lang} --file path/to/track.mp3")
        return
    cfg = script.get("music", {})
    secs = chapters(script, a.lang, fps)
    comp = {"positive_global_styles": cfg.get("positive", GLOBAL_POS) + cfg.get("cutStyles", {}).get(a.lang, []),
            "negative_global_styles": cfg.get("negative", GLOBAL_NEG),
            "sections": [{"section_name": c["name"], "positive_local_styles": c["styles"], "negative_local_styles": [],
                          "duration_ms": c["ms"], "lines": []} for c in secs]}
    length = sum(c["ms"] for c in secs) / 1000
    for c in secs:
        print(f"  {c['name']:24} {c['ms'] / 1000:6.1f}s  {', '.join(c['styles']) or '(global styles only)'}")
    seed = cfg.get("seed", 7)
    key = hashlib.sha256(json.dumps([comp, seed], sort_keys=True).encode()).hexdigest()[:20]
    cached = CACHE / f"{key}.mp3"
    est = round(length * cfg.get("creditsPerSecond", 14))
    rem = remaining()
    print(f"[quota] remaining={rem}  [music] cut={a.lang} length={length:.1f}s est_credits≈{est} cached={cached.exists()}")
    if not cached.exists() and est > rem:
        sys.exit("ABORT: would exceed the remaining quota")
    if a.dry_run:
        return
    if not cached.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(call("/v1/music?output_format=mp3_44100_128",
                                {"composition_plan": comp, "model_id": "music_v1", "seed": seed}, raw=True))
    level(cached, dst)
    rem2 = remaining()
    (ROOT / "notes").mkdir(exist_ok=True)
    with (ROOT / "notes" / "tts_log.md").open("a") as f:
        f.write(f"- {dt.datetime.now().isoformat(timespec='seconds')} music cut={a.lang} length={length:.1f}s est={est} "
                f"remaining_before={rem} remaining_after={rem2}\n")
    (ROOT / "notes" / f"music_plan.{a.lang}.json").write_text(json.dumps(comp, indent=1, ensure_ascii=False))
    print(f"[done] remaining={rem2} (spent {rem - rem2})")


if __name__ == "__main__":
    main()
