#!/usr/bin/env python3
"""Background music bed for one cut, composed chapter by chapter to the voice-over timeline.

Optional. Two ways:
  1. ElevenLabs Music (paid, ELEVENLABS_API_KEY in env or .env): one instrumental composition whose
     sections match your chapters in length, so the mood changes where the story does.
  2. Your own royalty-free track (--file): levelled, trimmed to the video and faded out.
Either way the result is public/audio/bgm_<cut>.mp3 at -17.4 LUFS (linear gain, no dynamics
processing); the video ducks it under the voice.

Chapters come from scenes.json: a scene may carry "musicSection" (or, if absent, "chapter"): "<name>" (scenes
without one join the previous section) and "musicStyles": [...] (merged into that chapter's local styles). Global styles:
  "music": {"positive": [...], "negative": [...], "cutStyles": {"<cut>": [...]}, "seed": 7,
            "creditsPerSecond": 14}
Section lengths come from public/data/vo.<cut>.json (same maths as src/timeline/timeline.ts), so
build the voice-over first. The quota is queried before the request and the run aborts if the
estimate exceeds it. Keys are never printed.

After a voice-over change, `--refit` re-times the composition already generated for this cut (cached audio +
notes/music_plan.<cut>.json) to the new section lengths: each section is cut out and time-stretched on its own
(a few percent is inaudible for ambient music) - no new request, no credits. If sections were added or renamed, or a
section changes by more than --max-stretch, it stops and you regenerate instead.

Usage:
  python3 scripts/music.py --lang en [--dry-run]
  python3 scripts/music.py --lang en --refit [--max-stretch 0.12]
  python3 scripts/music.py --lang zh --refit --from en      (reuse the English bed for the Chinese cut, no credits)
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
        # "musicSection" groups scenes into music sections independently of the (finer) video chapters
        name = sc.get("musicSection") or sc.get("chapter") or (out[-1]["name"] if out else s["id"])
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


def refit(script, cut, fps, dst, max_stretch, src_cut=None):
    """Time-stretch each section of the cached composition to the current section lengths (no API call).
    With src_cut (e.g. reuse the English bed for the Chinese cut): sections beyond max_stretch are stretched to the limit
    and then trimmed (or padded with silence) to length, and sections are joined with short crossfades."""
    plan_path = ROOT / "notes" / f"music_plan.{src_cut or cut}.json"
    if not plan_path.exists():
        sys.exit(f"{plan_path.relative_to(ROOT)} missing: generate the music first")
    comp = json.loads(plan_path.read_text())
    seed = script.get("music", {}).get("seed", 7)
    src = CACHE / f"{hashlib.sha256(json.dumps([comp, seed], sort_keys=True).encode()).hexdigest()[:20]}.mp3"
    if not src.exists():
        sys.exit(f"cached composition {src.name} not found (music settings changed?): regenerate instead")
    old = [x["duration_ms"] / 1000 for x in comp["sections"]]
    new_secs = chapters(script, cut, fps)
    if [x["section_name"] for x in comp["sections"]] != [c["name"] for c in new_secs]:
        sys.exit("music sections were added, removed or renamed: regenerate with music.py instead")
    new = [c["ms"] / 1000 for c in new_secs]
    k = dur_s(src) / sum(old)  # the generated audio is a little longer/shorter than planned: scale the cut points
    bounds = [0.0]
    for o in old:
        bounds.append(bounds[-1] + o * k)
    parts, fade = [], 0.015
    xf = 0.6 if src_cut else 0.0  # crossfade between sections when sections may be trimmed
    for i, (a0, a1, n) in enumerate(zip(bounds, bounds[1:], new)):
        tempo = (a1 - a0) / n
        last = i == len(new) - 1
        target = n + (0 if last else xf)  # each joined section overlaps the next one by xf
        tempo_t = (a1 - a0) / target
        if abs(tempo_t - 1) > max_stretch and not src_cut:
            print(f"  {comp['sections'][i]['section_name']:24} {a1 - a0:6.2f}s -> {n:6.2f}s  (tempo {tempo:.3f})")
            sys.exit(f"section changes by more than {max_stretch:.0%}: regenerate with music.py instead (or --from another cut)")
        t = min(max(tempo_t, 1 - max_stretch), 1 + max_stretch)
        how = "stretch" if t == tempo_t else ("stretch+trim" if tempo_t > t else "stretch+pad")
        print(f"  {comp['sections'][i]['section_name']:24} {a1 - a0:6.2f}s -> {n:6.2f}s  (tempo {t:.3f}, {how})")
        fin = fade if i == 0 or not xf else 0.0
        parts.append(f"[0:a]atrim=start={a0:.4f}:end={a1:.4f},asetpts=PTS-STARTPTS,atempo={t:.5f},apad,atrim=end={target:.4f},"
                     f"afade=t=in:d={max(fin, fade)},afade=t=out:st={max(0.0, target - max(fade, 0.8 if how != 'stretch' else fade)):.4f}:d={max(fade, 0.8 if how != 'stretch' else fade)}[s{i}]")
    if xf and len(new) > 1:
        chain, prev = [], "s0"
        for i in range(1, len(new)):
            out = "out" if i == len(new) - 1 else f"x{i}"
            chain.append(f"[{prev}][s{i}]acrossfade=d={xf}:c1=tri:c2=tri[{out}]")
            prev = out
        graph = ";".join(parts) + ";" + ";".join(chain)
    else:
        graph = ";".join(parts) + ";" + "".join(f"[s{i}]" for i in range(len(new))) + f"concat=n={len(new)}:v=0:a=1[out]"
    tmp = dst.with_suffix(".refit.wav")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), "-filter_complex", graph,
                    "-map", "[out]", "-ar", "44100", "-ac", "2", str(tmp)], check=True)
    level(tmp, dst)
    tmp.unlink()
    print(f"[refit] {dur_s(dst):.1f}s for a {sum(new):.1f}s timeline (no credits used)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", default="en", help="cut id (reads public/data/vo.<cut>.json)")
    ap.add_argument("--file", help="use this royalty-free track instead of generating one")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--refit", action="store_true", help="re-time the cached composition to the current timeline")
    ap.add_argument("--max-stretch", type=float, default=0.12)
    ap.add_argument("--from", dest="src_cut", help="with --refit: reuse this cut's generated composition (e.g. --lang zh --refit --from en)")
    a = ap.parse_args()
    script, fps = load_script(), project_fps()
    dst = ROOT / "public" / "audio" / f"bgm_{a.lang}.mp3"
    dst.parent.mkdir(parents=True, exist_ok=True)
    total_s = sum(d for _, _, d in scene_spans(load_vo(a.lang), fps)) / fps + RING_OUT_S
    if a.file:
        level(pathlib.Path(a.file).expanduser(), dst, total_s)
        return
    if a.refit:
        refit(script, a.lang, fps, dst, a.max_stretch, a.src_cut)
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
    print(f"[done] remaining={rem2} (spent {rem - rem2} so far; the quota API often lags for music — "
          f"budget with the estimate, ≈{est} credits{' (cached, no new request)' if rem == rem2 and cached.exists() and est else ''})")


if __name__ == "__main__":
    main()
