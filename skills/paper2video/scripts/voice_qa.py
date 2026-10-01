#!/usr/bin/env python3
"""Objective voice-over QA: measure every take instead of trusting your ears (or lack of them).

For each audio file:
  - prosody: F0 contour (YIN) -> median pitch, pitch variation in semitones (std, 5-95% range),
    loudness dynamics, pause statistics, duration
  - optional ASR round-trip (--asr): transcript, audio events (laughter etc., Scribe only) and
    word / character error rate against the intended text, plus a short diff of mismatches.
    Engine: ElevenLabs Scribe when ELEVENLABS_API_KEY is available (env or .env), else local
    faster-whisper (free, runs on CPU; first use downloads the model). Force with --engine.

Usage (numpy required; uv keeps it out of the system Python):
  uv run --with numpy python scripts/voice_qa.py a.mp3 b.mp3 --text "..." --lang en --asr
  uv run --with numpy python scripts/voice_qa.py --manifest takes.json --asr --engine whisper --whisper-model base
  (manifest: JSON list of {"file", "text", "lang", "label"})

--fmax: raise to ~600 for high voices (F0 search ceiling in Hz; the floor rises with it).
Keys are never printed.
"""
from __future__ import annotations

import argparse
import difflib
import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import CJK, TAG, env_key, is_cjk_lang, run_with  # noqa: E402

SR = 16000
SCRIBE_LANG = {"zh": "zho", "en": "eng", "ja": "jpn", "ko": "kor", "de": "deu", "fr": "fra", "es": "spa"}


# ---------------------------------------------------------------- prosody
def load(path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def yin_f0(x, fmin=65.0, fmax=420.0, frame=0.04, hop=0.01, thresh=0.2):
    """YIN pitch track (cumulative mean normalised difference); NaN for unvoiced / silent frames."""
    import numpy as np
    n, h = int(frame * SR), int(hop * SR)
    tmin, tmax = int(SR / fmax), int(SR / fmin)
    starts = range(0, len(x) - n - tmax, h)
    rms = np.array([np.sqrt(np.mean(x[s:s + n] ** 2)) for s in starts])
    gate = max(0.002, 0.08 * float(np.percentile(rms, 99))) if len(rms) else 0.01
    f0 = []
    for s, e in zip(starts, rms):
        if e < gate:  # silence, relative to the clip's own level
            f0.append(np.nan)
            continue
        seg = x[s:s + n + tmax]
        w = seg[:n]
        d = np.zeros(tmax + 1)
        for tau in range(1, tmax + 1):
            diff = w - seg[tau:tau + n]
            d[tau] = np.dot(diff, diff)
        cmnd = np.ones_like(d)
        cmnd[1:] = d[1:] * np.arange(1, tmax + 1) / np.maximum(np.cumsum(d[1:]), 1e-12)
        tau = None
        for t in range(tmin, tmax):
            if cmnd[t] < thresh:
                while t + 1 < tmax and cmnd[t + 1] < cmnd[t]:
                    t += 1
                tau = t
                break
        f0.append(SR / tau if tau else np.nan)
    return np.array(f0)


def pauses(x, hop=0.01, floor_db=-40.0, min_pause=0.18):
    """Interior silences (s) plus the dB envelope of the speech span and its start/end times."""
    import numpy as np
    h = int(hop * SR)
    rms = np.array([np.sqrt(np.mean(x[i * h:(i + 1) * h] ** 2)) + 1e-9 for i in range(len(x) // h)])
    db = 20 * np.log10(rms)
    silent = db < max(floor_db, np.percentile(db, 99) - 38)
    idx = np.where(~silent)[0]
    if len(idx) == 0:
        return [], db, 0.0, 0.0
    a, b = idx[0], idx[-1]
    out, run = [], 0
    for i in range(a, b + 1):
        if silent[i]:
            run += 1
        else:
            if run * hop >= min_pause:
                out.append(round(run * hop, 2))
            run = 0
    return out, db[a:b + 1], a * hop, (b + 1) * hop


def prosody(path, fmax=420.0) -> dict:
    import numpy as np
    x = load(path)
    f0 = yin_f0(x, fmin=65.0 if fmax <= 420 else 110.0, fmax=fmax)
    v = f0[~np.isnan(f0)]
    ps, db, t0, t1 = pauses(x)
    voiced = db[db > np.percentile(db, 30)] if len(db) else db
    res = {"durationS": round(len(x) / SR, 2), "speechS": round(t1 - t0, 2), "voicedFrac": round(len(v) / max(1, len(f0)), 2)}
    if len(v) > 20:
        st = 12 * np.log2(v / np.median(v))
        res |= {"f0MedianHz": round(float(np.median(v)), 1), "f0StdSt": round(float(np.std(st)), 2),
                "f0Range90St": round(float(np.percentile(st, 95) - np.percentile(st, 5)), 2)}
    res |= {"loudStdDb": round(float(np.std(voiced)), 2) if len(voiced) else 0.0, "pauses": len(ps),
            "pauseMeanS": round(float(np.mean(ps)), 2) if ps else 0, "pauseMaxS": max(ps) if ps else 0}
    return res


# ---------------------------------------------------------------- ASR engines
def scribe(path, lang=None) -> dict:
    """ElevenLabs Scribe (paid, counts against the same subscription). Tries scribe_v2, then v1."""
    boundary = uuid.uuid4().hex
    data = pathlib.Path(path).read_bytes()
    key = env_key("ELEVENLABS_API_KEY")
    for model in ("scribe_v2", "scribe_v1"):
        fields = {"model_id": model, "tag_audio_events": "true", "timestamps_granularity": "word"}
        if lang:
            fields["language_code"] = SCRIBE_LANG.get(lang.split("-")[0], lang)
        body = b"".join(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode() for k, v in fields.items())
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{pathlib.Path(path).name}\"\r\n"
                 f"Content-Type: application/octet-stream\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
        r = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body, method="POST",
                                   headers={"xi-api-key": key, "Content-Type": f"multipart/form-data; boundary={boundary}"})
        try:
            with urllib.request.urlopen(r, timeout=180) as resp:
                out = json.load(resp)
        except urllib.error.HTTPError as e:
            if model == "scribe_v1":
                sys.exit(f"Scribe HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")
            continue
        words = [w for w in out.get("words", []) if w.get("type") == "word"]
        return {"engine": model, "text": out.get("text", ""),
                "events": [w.get("text") for w in out.get("words", []) if w.get("type") == "audio_event"],
                "words": [(w["text"], float(w["start"]), float(w["end"])) for w in words]}


def whisper(path, lang=None, model="base", prompt=None) -> dict:
    """Local faster-whisper with word timestamps (free). Runs in a uv environment if not installed.
    `prompt` biases the transcript: pass the script when aligning a known text (recorded narration);
    leave it None for QA so the check stays independent (Chinese then gets a neutral simplified-
    Chinese prompt, otherwise Whisper may answer in traditional characters)."""
    if prompt is None and lang and lang.startswith("zh"):
        prompt = "以下是普通话的句子。"
    args = ["_whisper", str(pathlib.Path(path).resolve()), "--model", model]
    if lang:
        args += ["--lang", lang.split("-")[0]]
    if prompt:
        args += ["--prompt", TAG.sub(" ", prompt)[:800]]
    out = run_with(["faster-whisper", "numpy"], pathlib.Path(__file__).resolve(), args)
    return {"engine": f"whisper-{model}", "text": out["text"], "events": [], "words": [tuple(w) for w in out["words"]]}


def asr(path, lang=None, engine="auto", whisper_model="base", prompt=None) -> dict:
    """engine: auto (Scribe if a key is available, else whisper) | scribe | whisper."""
    if engine == "auto":
        engine = "scribe" if env_key("ELEVENLABS_API_KEY", required=False) else "whisper"
    return scribe(path, lang) if engine == "scribe" else whisper(path, lang, whisper_model, prompt)


def _whisper_worker(argv):
    """Entry point executed inside the faster-whisper environment; prints JSON to stdout."""
    p = argparse.ArgumentParser()
    p.add_argument("file")
    p.add_argument("--model", default="base")
    p.add_argument("--lang")
    p.add_argument("--prompt")
    a = p.parse_args(argv)
    from faster_whisper import WhisperModel
    m = WhisperModel(a.model, device="cpu", compute_type="int8")
    # decode with ffmpeg ourselves: faster-whisper's PyAV path breaks with some PyAV releases
    segs, _ = m.transcribe(load(a.file), language=a.lang, word_timestamps=True, initial_prompt=a.prompt, vad_filter=False,
                           condition_on_previous_text=True)
    words, text = [], []
    for s in segs:
        text.append(s.text)
        for w in s.words or []:
            words.append([w.word.strip(), round(w.start, 3), round(w.end, 3)])
    print(json.dumps({"text": "".join(text).strip(), "words": words}, ensure_ascii=False))


# ---------------------------------------------------------------- error rate
def norm_words(s, cjk: bool):
    """Comparable tokens: CJK characters one by one plus latin words / numbers."""
    s = TAG.sub(" ", s).lower()
    if cjk:
        return re.findall(r"[a-z0-9]+|" + CJK.pattern, s)
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?", s.replace("’", "'"))


def edit_distance(a, b) -> int:
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return d[len(b)]


def diff_summary(ref, hyp) -> list[str]:
    """Short human-readable list of mismatching spans."""
    sm = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
    return [f"{op}: '{' '.join(ref[i1:i2])}' -> '{' '.join(hyp[j1:j2])}'"
            for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]


def score(text, lang, result) -> dict:
    """Compare an ASR result with the intended text: err (WER, or CER for CJK), diffs, events."""
    cjk = is_cjk_lang(lang or "en")
    ref, hyp = norm_words(text, cjk), norm_words(result["text"], cjk)
    return {"asrEngine": result["engine"], "asr": result["text"], "events": result["events"],
            "err": round(edit_distance(ref, hyp) / max(1, len(ref)), 3), "diffs": diff_summary(ref, hyp)}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("files", nargs="*")
    p.add_argument("--text", help="intended text (audio tags allowed)")
    p.add_argument("--manifest", help="JSON list of {file, text, lang, label}")
    p.add_argument("--lang", default="en")
    p.add_argument("--asr", action="store_true", help="ASR round-trip against --text")
    p.add_argument("--engine", choices=["auto", "scribe", "whisper"], default="auto")
    p.add_argument("--whisper-model", default="base")
    p.add_argument("--fmax", type=float, default=420.0)
    p.add_argument("--json", help="write results here")
    a = p.parse_args()
    items = json.loads(pathlib.Path(a.manifest).read_text()) if a.manifest else [
        {"file": f, "text": a.text, "lang": a.lang, "label": pathlib.Path(f).stem} for f in a.files]
    if not items:
        p.error("give audio files or --manifest")
    results = []
    for it in items:
        r = {"label": it.get("label"), "file": it["file"]} | prosody(it["file"], a.fmax)
        if a.asr and it.get("text"):
            res = asr(it["file"], it.get("lang"), a.engine, a.whisper_model)
            r |= score(it["text"], it.get("lang"), res)
        results.append(r)
        print(json.dumps(r, ensure_ascii=False))
    if a.json:
        pathlib.Path(a.json).write_text(json.dumps(results, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    if sys.argv[1:2] == ["_whisper"]:
        _whisper_worker(sys.argv[2:])
    else:
        main()
