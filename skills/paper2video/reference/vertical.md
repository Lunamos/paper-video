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
  line, broken between words, Chinese punctuation replaced by spaces. For Chinese, precompute word boundaries with jieba
  (a small script over the caption words of `vo.zh.json` → a JSON table of allowed break offsets per line): the
  renderer's `Intl.Segmenter` splits e.g. 金门大桥 as 金门|大|桥, which puts 「桥」 alone on the next caption page.
  A timed "word" that holds a list (「wait、however、suppose」) is split after 、/，/, into pieces with the same timing,
  so the caption can break inside the list instead of shrinking the whole page (numbers like 65,537 stay whole).
- The only small text: the source line (≈ 26 px) and honesty chips (≈ 34 px) — rigor survives the format change.
- At most three elements at once (focus, one label or headline, the caption), one thing moving at a time.
- Charts: ≤ 4–5 bars or ≤ 3 lines, 2–4 ticks, direct labels instead of legends, no grid, ours highlighted, bars from
  zero. Formulas: one line of ≤ ~15 symbols at ≥ 100 px, built term by term — or leave them to the 16:9 film.
- Long text (model outputs, examples): the one or two sentences that matter, very big, key words highlighted.
- Filling the frame works best with the subject itself: a tower of layers running top to bottom, a bridge whose towers
  reach the top band and whose reflection fills the bottom, real trajectories running off the edges, a chat window from
  top to bottom, a field covering the whole frame. A dim texture of real text (all concept names, the whole email)
  can fill bands too, but keep it quiet (≈ half the normal opacity) so it never becomes a second focus.
- Pictures now run under text: give source lines and labels a soft dark halo or plate.
- Loop: the end scene should import the intro's frame-0 constants (or a shared component) instead of copying values.

## Pacing and structure
- **Frame 0 is the hook**: the subject on screen with a claim of ≤ 7 words at ≥ 110 px — no logo, black frame or fade-in.
- **Then the title card** (same scene as the 16:9 cut, `TitleCard` lays itself out for 9:16): paper title, authors, institution, claim — on screen by ~20 s; with `shot` the paper's page shows large under the title while it is read, then gives way to the authors and claim (`beats.shotOut`).
- A visible change every 1–3 s, on the voice anchors; calm motion (fade/rise, draw-on, swap, highlight), no full-frame zoom.
- Shorter than the 16:9 film when possible: leave out whole technical scenes (their audio simply isn't played) — check
  that the next scene's first line still follows. Chinese knowledge-vertical norm 1–3 min; Shorts ≤ 3 min.
- End on a frame that leads back to the first one (the clip loops), not on a credits card; a question to the viewer
  works well as the last line.
- On Bilibili, knowledge videos are still mostly landscape: the vertical cut is a companion to the 16:9 upload.

## Building it (the template's `src/vertical/`)
- `layout.ts`: the safe-area and type constants above, and `V_DROP` (scenes the phone cut skips; their audio is
  simply not played — check that the next scene's first line still follows).
- `VKit.tsx`: `VHead` (headline), `Hot` (accent word), `VSub`, `VChip` (honesty tag), `VSource` / `VSourceLines`
  (source lines with a dark halo), `VBigNumber` (final value only), `VPanel`, `VBackdrop` (a full-frame backdrop — the
  16:9 grain layer would stop at y = 1080).
- `VCaptions.tsx`: ≤ 2 lines, words bright as spoken, broken between words (Chinese: `scripts/zh_breaks.py` →
  `public/data/zh_breaks.json`, run after every Chinese voice build), auto-shrinks a page that would not fit.
- `VerticalFilm.tsx`: the vertical timeline (the cut's scenes minus `V_DROP`, back to back, each keeping its anchors),
  voice per scene, SFX resolved on the vertical timeline, and the music played **per scene from that scene's position in
  the original score** (10-frame fades where the cut jumps over a left-out scene) — no new music file. Compositions
  `<PREFIX>-V-ZH` / `<PREFIX>-V-EN`, plus `V-<Name>` previews of single scenes.
- `scenes/`: one component per scene (`VExample.tsx` shows the pattern), registered in `scenes/registry.ts`. They reuse
  the 16:9 film's data files and honesty labels; components that draw on a fixed 1920×1080 canvas get a rect in canvas
  coordinates and a positioned wrapper.
- Workflow: write `notes/vertical_storyboard.md` (per scene: the one picture that fills the frame, the beats per anchor)
  → scene subagents with explicit file ownership (they study an approved vertical cut for the style) → review every
  anchor with `python3 scripts/vreview.py [--scenes …]` (contact sheets per scene) → fix → render with
  `scripts/finalize.sh <PREFIX>-V-ZH <name>_zh_vertical` → check the first and last frames match (loop) and sample a
  frame every 5–6 s of the final file to see the pacing.

## Fact-check the vertical cut too
New headlines, labels and layouts are new claims: run an independent screen fact-check on the vertical scenes (and the
vertical copy) before uploading. What it found on three cuts:
- a headline stronger than the voice-over or the paper (「多是这些词」 for "such as …", 「循环也没用」 for "add little");
- a dropped scene that carried context the remaining ones need (the default setting was only said in the dropped
  scene) — and copy that still described a dropped scene;
- an animated counter paired with the wrong result (loop 4 shown next to the result after loop 3);
- an illustration's hero number whose "not the paper's model" label was only in the small source line — put a chip
  next to the number;
- bars of different widths (area overstates a ratio); a source line running under the button column;
- an end card saying 「见简介」 at all (don't point to the description; end on the paper's point).
Small print over a bright picture needs a dark plate, not just a halo.
