"""Shared helpers for the paper2video scripts (stdlib only).

- project root discovery (the folder holding scenes.json)
- API keys: read from the environment or the project's .env, never printed
- text helpers: CJK detection, audio-tag stripping
- ffmpeg helpers: duration, integrated loudness, linear-gain normalisation
- timeline maths identical to the template's src/timeline/timeline.ts
- running optional heavy dependencies (edge-tts, faster-whisper) through `uv run --with ...`
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

SCRIPTS = pathlib.Path(__file__).resolve().parent


def find_root() -> pathlib.Path:
    """Project root: $PAPER_VIDEO_ROOT, else the first of cwd / scripts' parent that has scenes.json."""
    env = os.environ.get("PAPER_VIDEO_ROOT")
    if env:
        return pathlib.Path(env).resolve()
    for cand in (pathlib.Path.cwd(), SCRIPTS.parent):
        if (cand / "scenes.json").exists():
            return cand.resolve()
    return pathlib.Path.cwd().resolve()


ROOT = find_root()

# CJK ideographs, kana, compatibility ideographs: every character is its own caption token.
CJK = re.compile(r"[぀-ヿ㐀-鿿豈-﫿〇]")
TAG = re.compile(r"\[[^\]]*\]")
CJK_LANGS = ("zh", "ja")


def is_cjk_lang(lang: str) -> bool:
    return lang.split("-")[0].lower() in CJK_LANGS


def strip_tags(text: str) -> str:
    """Remove ElevenLabs v3 audio tags like [curious] and tidy the whitespace they leave."""
    return re.sub(r"\s{2,}", " ", TAG.sub(" ", text)).strip()


def env_key(name: str, required: bool = True) -> str | None:
    """Read an API key from the environment or ROOT/.env. The value is never printed."""
    if os.environ.get(name):
        return os.environ[name].strip()
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:]
            if line.startswith(f"{name}="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return val
    if required:
        sys.exit(f"{name} is not set (export it or add it to {env}); it is never printed or stored elsewhere.")
    return None


def load_script() -> dict:
    path = ROOT / "scenes.json"
    if not path.exists():
        sys.exit(f"no scenes.json in {ROOT} (run from the project folder or set PAPER_VIDEO_ROOT)")
    return json.loads(path.read_text())


def text_lang(script: dict, cut: str) -> str:
    """A cut (e.g. 'zh_vertical') may read another language's text via voices.<cut>.lang."""
    return script.get("voices", {}).get(cut, {}).get("lang", cut)


# ---------------------------------------------------------------- ffmpeg
def dur_s(path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def loudness(path) -> float:
    """Integrated loudness (LUFS) via ffmpeg loudnorm analysis."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    return float(json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])["input_i"])


def normalise(src, dst, target_lufs: float, limiter: bool = True, extra_af: str = "", bitrate: str = "192k") -> float:
    """Linear gain to target_lufs (+ optional true-peak-safe limiter), encode mp3. Returns the gain in dB."""
    gain = target_lufs - loudness(src)
    af = f"volume={gain:.2f}dB"
    if limiter:
        af += ",alimiter=limit=0.89:attack=2:release=40:level=false"
    if extra_af:
        af += "," + extra_af
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), "-af", af, "-ar", "44100",
                    "-c:a", "libmp3lame", "-b:a", bitrate, str(dst)], check=True)
    return gain


# ---------------------------------------------------------------- timeline (mirrors src/timeline/timeline.ts)
def frames(ms: float, fps: int) -> int:
    return round(ms / 1000 * fps)


def load_vo(cut: str) -> dict:
    path = ROOT / "public" / "data" / f"vo.{cut}.json"
    if not path.exists():
        sys.exit(f"{path} missing: run scripts/vo.py build --lang {cut} first")
    return json.loads(path.read_text())


def scene_spans(vo: dict, fps: int) -> list[tuple[dict, int, int]]:
    """[(scene, fromFrame, durationInFrames)] exactly as buildTimeline() lays scenes out back to back."""
    out, t = [], 0
    for s in vo["scenes"]:
        d = frames(max(s["minSeconds"] * 1000, s["leadInMs"] + s["durationMs"] + s["tailMs"]), fps)
        out.append((s, t, d))
        t += d
    return out


def project_fps(default: int = 30) -> int:
    path = ROOT / "scenes.json"
    return int(json.loads(path.read_text()).get("fps", default)) if path.exists() else default


# ---------------------------------------------------------------- optional deps via uv
def reexec_with(packages: list[str]) -> None:
    """If a package is missing, restart this very command under `uv run --with <packages>`."""
    try:
        for p in packages:
            __import__(p.replace("-", "_"))
    except ImportError:
        if not shutil.which("uv") or os.environ.get("PAPER_VIDEO_REEXEC"):
            sys.exit(f"needs {', '.join(packages)}: run with `uv run --with {' --with '.join(packages)} python ...`")
        os.environ["PAPER_VIDEO_REEXEC"] = "1"
        cmd = ["uv", "run", "--quiet", "--no-project", *sum((["--with", p] for p in packages), []), "python", *sys.argv]
        os.execvp("uv", cmd)


def run_with(packages: list[str], script: pathlib.Path, args: list[str]) -> dict:
    """Run `python script args` in an environment that has `packages` and parse its JSON stdout.
    Uses the current interpreter if the packages import, else `uv run --with ...` (downloads once, cached)."""
    mods = [p.replace("-", "_") for p in packages]
    have = subprocess.run([sys.executable, "-c", "import " + ",".join(mods)], capture_output=True).returncode == 0
    if have:
        cmd = [sys.executable, str(script), *args]
    elif shutil.which("uv"):
        cmd = ["uv", "run", "--quiet", "--no-project", *sum((["--with", p] for p in packages), []), "python", str(script), *args]
    else:
        sys.exit(f"needs {', '.join(packages)}: install uv (https://docs.astral.sh/uv/) or pip install them")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"{script.name} {args[0] if args else ''} failed:\n{r.stderr[-2000:]}")
    return json.loads(r.stdout[r.stdout.find("{"):])
