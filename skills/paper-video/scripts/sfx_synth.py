#!/usr/bin/env python3
"""Procedural sound-design palette: deterministic, no API, nothing to license.

Subtle UI-style sounds whose spectrum and envelope are designed and measurable, instead of trusting
a generator you cannot audition (generated "whoosh" prompts often come back as dull low thumps).

  whoosh     band-passed noise, centre rises then falls, soft attack       scene changes
  pop        short sine blip with a quick downward glide                   chips / labels appear
  tick       tiny filtered click (+ tick1..3, pitch variants)              counters, dial detents
  hit        soft low thump + noise transient, short tail                  a key result lands
  stamp      dull thump + paper-like noise burst                           a seal / verdict appears
  shimmer    staggered high partials, gentle decay                         end card
  riser      airy noise swell, 300 Hz -> 3.5 kHz, ends at the reveal        build-up before a reveal
  powerdown  soft descending tone, 620 -> 140 Hz                           something fails / collapses

Writes public/audio/sfx/<name>.wav (44.1 kHz mono, peak -3 dBFS). Mix levels belong in the video
(cue list in the template's src/timeline/sfx.ts); keep them low, under the voice.
Run: python3 scripts/sfx_synth.py   (numpy is pulled in via uv if missing)
"""
import pathlib
import sys
import wave

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import ROOT, reexec_with  # noqa: E402

reexec_with(["numpy"])
import numpy as np  # noqa: E402

SR = 44100
OUT = ROOT / "public" / "audio" / "sfx"
rng = np.random.default_rng(7)


def env(n, attack, release, curve=3.0):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1) ** 1.5
    r = np.clip((t[-1] - t) / max(release, 1e-4), 0, 1) ** curve
    return a * r


def biquad_bandpass(x, f0s, q):
    """Time-varying band-pass (RBJ cookbook), f0s: per-sample centre frequency."""
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        w0 = 2 * np.pi * f0s[i] / SR
        alpha = np.sin(w0) / (2 * q)
        b0, b1, b2 = alpha, 0.0, -alpha
        a0, a1, a2 = 1 + alpha, -2 * np.cos(w0), 1 - alpha
        yi = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def whoosh(d=0.75):
    n = int(d * SR)
    noise = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    f = 500 * (1 - t) ** 2 + 2600 * 2 * t * (1 - t) + 900 * t ** 2  # rises then falls
    y = biquad_bandpass(noise, f, 1.4)
    return y * env(n, 0.22, 0.45, 2.0)


def pop(d=0.16):
    n = int(d * SR)
    t = np.arange(n) / SR
    f = 880 * np.exp(-t / 0.035) + 440
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.045)
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return y


def tick(d=0.05):
    n = int(d * SR)
    t = np.arange(n) / SR
    y = rng.standard_normal(n) * np.exp(-t / 0.004)
    y = y - onepole_lp(y, 1800)  # keep the crisp part
    y += 0.4 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.006)
    return y


def hit(d=0.9):
    n = int(d * SR)
    t = np.arange(n) / SR
    f = 55 + 60 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    click = onepole_lp(rng.standard_normal(n), 3000) * np.exp(-t / 0.012) * 0.5
    air = biquad_bandpass(rng.standard_normal(n), np.full(n, 1800.0), 0.7) * np.exp(-t / 0.18) * 0.12
    y = body + click + air
    y[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return y


def stamp(d=0.45):
    n = int(d * SR)
    t = np.arange(n) / SR
    f = 90 + 70 * np.exp(-t / 0.03)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    paper = biquad_bandpass(rng.standard_normal(n), np.full(n, 2500.0), 0.9) * np.exp(-t / 0.035) * 0.55
    y = thump + paper
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return y


def shimmer(d=1.6):
    n = int(d * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, (fr, on) in enumerate([(2093, 0.0), (2637, 0.07), (3136, 0.14), (3951, 0.21), (4186, 0.3)]):
        tt = np.clip(t - on, 0, None)
        e = (t >= on) * (1 - np.exp(-tt / 0.01)) * np.exp(-tt / 0.45)
        y += np.sin(2 * np.pi * fr * tt + k) * e * (0.8 ** k)
    return y


def tick_var(f_click, d=0.05, seed=0):
    r = np.random.default_rng(seed)
    n = int(d * SR)
    t = np.arange(n) / SR
    y = r.standard_normal(n) * np.exp(-t / 0.004)
    y = y - onepole_lp(y, 1800)
    y += 0.4 * np.sin(2 * np.pi * f_click * t) * np.exp(-t / 0.006)
    return y


def riser(d=1.1):
    """Soft airy swell (noise, band-pass centre rising 300 Hz -> 3.5 kHz), ends abruptly at the reveal."""
    n = int(d * SR)
    t = np.linspace(0, 1, n)
    f = 300 * (3500 / 300) ** (t ** 1.4)
    y = biquad_bandpass(rng.standard_normal(n), f, 1.1)
    e = t ** 2.2
    e[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return y * e


def powerdown(d=0.38):
    """Filtered descending tone for 'collapses': 620 Hz -> 140 Hz, soft, no click."""
    n = int(d * SR)
    t = np.arange(n) / SR
    f = 140 + 480 * np.exp(-t / 0.11)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)
    y = onepole_lp(y, 1500) * env(n, 0.01, 0.3, 1.5)
    return y


def save(name, y):
    """Peak-normalise to -3 dBFS and write 16-bit mono WAV."""
    y = y / (np.max(np.abs(y)) + 1e-9) * 10 ** (-3 / 20)
    pcm = (y * 32767).astype(np.int16)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{name:10} {len(y) / SR:.2f}s -> public/audio/sfx/{name}.wav")


if __name__ == "__main__":
    for name, fn in [("whoosh", whoosh), ("pop", pop), ("tick", tick), ("hit", hit), ("stamp", stamp), ("shimmer", shimmer),
                     ("riser", riser), ("powerdown", powerdown)]:
        save(name, fn())
    # detent clicks with slight pitch variation (never the identical sample twice in a row)
    for k, fc in enumerate([2250, 2400, 2600]):
        save(f"tick{k + 1}", tick_var(fc, seed=11 + k))
