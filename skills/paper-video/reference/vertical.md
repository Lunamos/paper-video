# Vertical cut (9:16) for phones

A 16:9 film shrunk into a 9:16 frame is shown at 0.56×: a 48 px label becomes ~27 px, below what a phone can read, and
the screen is busy and half empty. Build the vertical cut **natively**: the same voice-over, music and SFX, new scene
layouts for the phone. Viewers asked for: very big text, very few things on screen, one focus at a time.

## Safe area for text, the whole frame for the picture (1080×1920)
- **Text** (anything a viewer must read) stays in the text-safe area, measured from the official overlays (YouTube
  Shorts, Reels, TikTok) and what 抖音 / B 站竖屏 show: x 120–888, y ≈ 260–1500; below y 840 keep text at x ≤ 780
  (button column). Captions sit at 68–78 % of the height (y ≈ 1300–1500), where popular Chinese and English
  explainers put them.
- **The picture uses the whole frame.** Visuals may run under the platform UI and should bleed into the top (0–260)
  and bottom (1500–1920) bands. Do not confine the picture to the text-safe box: a design that leaves the top and
  bottom empty looks like a square video on a phone (user feedback on a first attempt).
- Check a frame against the platforms' overlay images when in doubt.

## Layout and type
- Stack: headline / keyword (y ≈ 280–620) → **one** main visual, **tall** and full-width (y ≈ 620–1280, bleeding
  beyond) → captions (y ≈ 1300–1500). Compose vertically: stacks, columns, towers, horizontal bars stacked down the
  screen, big objects that run off the frame edges — not a 16:9 chart shrunk into the middle.
- Sizes at 1080 wide: headline 100–140 px bold; key phrase 72–96 px; hero number 180–260 px; labels ≥ 44 px (never
  < 36); captions 60–72 px bold with a dark stroke, ≤ 2 lines, ≈ 9–10 Chinese characters or ≈ 18 Latin characters per
  line, broken between words (Chinese: `Intl.Segmenter`), Chinese punctuation replaced by spaces.
- The only small text: the source line (≈ 26 px) and honesty chips (≈ 34 px) — rigor survives the format change.
- At most three elements at once (focus, one label or headline, the caption), one thing moving at a time.
- Charts: ≤ 4–5 bars or ≤ 3 lines, 2–4 ticks, direct labels instead of legends, no grid, ours highlighted, bars from
  zero. Formulas: one line of ≤ ~15 symbols at ≥ 100 px, built term by term — or leave them to the 16:9 film.
- Long text (model outputs, examples): the one or two sentences that matter, very big, key words highlighted.

## Pacing and structure
- **Frame 0 is the hook**: the subject on screen with a claim of ≤ 7 words at ≥ 110 px — no logo, black frame or fade-in.
- A visible change every 1–3 s, on the voice anchors; calm motion (fade/rise, draw-on, swap, highlight), no full-frame zoom.
- Shorter than the 16:9 film when possible: leave out whole technical scenes (their audio simply isn't played) — check
  that the next scene's first line still follows. Chinese knowledge-vertical norm 1–3 min; Shorts ≤ 3 min.
- End on a frame that leads back to the first one (the clip loops), not on a credits card; a question to the viewer
  works well as the last line.
- On Bilibili, knowledge videos are still mostly landscape: the vertical cut is a companion to the 16:9 upload.

## Building it (Remotion)
- A vertical timeline = the cut's scenes minus the left-out ones, laid back to back; each scene keeps its own anchors.
- Voice: each kept scene's clip at its new start. SFX: resolve cues against the vertical timeline (cues of left-out
  scenes disappear). Music: play the score **per scene from that scene's position in the original score** (`trimBefore`
  = original start), with ~10-frame fades where the cut jumps over a left-out scene — no new music file needed.
- One vertical component per scene (keyed to the same anchors), reusing the film's data files and honesty labels;
  shared kit: safe-area constants, big captions, headline / big number / chip / source components. Scenes can be built
  in parallel by subagents with explicit file ownership, reviewed with per-scene contact sheets at every anchor.
- Components that draw into a fixed 16:9 canvas (SVG 1920×1080) need a rect in canvas coordinates and a positioned
  wrapper to be placed in the 9:16 frame.
