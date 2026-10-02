# Visual style

Reference point: 3Blue1Brown — dark background, few colours with fixed meaning, strokes that draw themselves, calm easing, the camera serving the mathematical object. Motion exists to explain. Make it impressive by making the idea visible, not by adding effects.

## Design system (in `template/src/theme`)
- Near-black background, greys for structure, **two or three semantic colours** with one meaning each for the whole film (e.g. "our method", "the thing being changed", "readable/active"). Categorical palettes only inside data charts.
- Type: a serif for headlines, a clean sans for UI, a mono for sources/data labels, KaTeX for formulas (copy the paper's notation exactly). CJK: local subset of Noto Sans SC (`scripts/zh_font_subset.py`, re-run after changing Chinese text).
- Every data shot has a small source line bottom-left (PAPER Fig. 3 · model · metric · n); illustrations say SCHEMATIC; selected examples say so.
- Keep content above the caption band; captions are global.

## Motion rules
- Only `useCurrentFrame()` + `interpolate`/`spring` (no CSS transitions); seeded randomness only.
- Key every beat to a voice-over anchor, with a fallback frame. A fallback must make sense inside the scene: after splitting or rewriting a scene, an anchor that no longer exists falls back to its default frame and the element pops up there (e.g. a title card suddenly inside the hook) — delete such uses or move them. Word order differs between languages (a Chinese sentence may name the affiliations before the venue): when a reveal belongs to a whole sentence, start it at that line's first word (`useLine(id).from`; SFX cue `at: "line:<id>"`) instead of an anchor word that sits early in one language and late in the other. When two anchors can come in either order, start the beat at whichever comes first.
- Reveal with stroke-draw, wipe, fade-and-rise; one new thing at a time.
- Numbers appear at their final value (no count-ups: intermediate frames would show numbers that are not in the paper). Bars grow from zero; log axes are labelled.
- Emphasis goes on the element (outline, glow, a hand-drawn loop, a short pulse), **never on the whole frame** — no full-frame punch-ins, shakes or zooms. Gentle camera moves inside a single diagram (a pan across a heatmap, an orbit around a 3D plot) are fine when they serve the explanation.
- Scene transitions: content fades over a persistent backdrop; no flashes.
- Everything settles before a scene ends.

## Ideas that worked well
- The hero visual of the paper, **with real data**, in the first seconds, then explained properly later and called back at the end.
- A primer scene that makes the task tangible for someone with zero context (e.g. the actual input, the pointer/arrow structure, what "correct" means).
- Heatmaps / grids that fill as a cursor sweeps through layers or time; contours that grow with the cursor; dimming everything except the part the narration is about.
- Before/after pairs with identical axes; small multiples for "same pattern in every model". Two dense matrices side by side leave ~15 px per cell at 1080p: show values only in the cells the narration is about and let colour carry the rest.
- Real model outputs typed out with the relevant phrases highlighted (labelled as selected examples, with model/setting).
- 2.5D perspective via CSS 3D transforms or a small projection helper is usually enough; reach for WebGL (`@remotion/three`) only for genuinely 3D or very dense scenes (text in WebGL is worse, renders are slower).

## Review loop
- Render stills in every language at anchor-based frames (a few per scene), tile them into contact sheets (`scripts/review.py`), and actually look. Check: overlaps, clipping, text too small, empty or half-built frames at the moments the voice talks about them, captions colliding with source lines, layout breaking with longer translations.
- When the user reports a problem at a timestamp, map it to the scene and anchor (`scripts/timeline_info.py`), extract the real frames from the rendered MP4 (not just stills) and compare consecutive frames if it is about motion or jitter.
