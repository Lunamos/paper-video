---
name: paper-video
description: Turn a research paper or project (a repo, a paper PDF/arXiv link, a project page, or a working directory) into a polished, 3Blue1Brown-style explainer / promo video built with Remotion — script, voice-over (optional TTS key; free or self-recorded alternatives), real-data animations, captions, music, bilingual cuts, vertical cut, covers, and platform copy for YouTube and Bilibili. Use when the user asks for a paper video, project video, research promo, explainer video, 论文宣传片 / 论文讲解视频, or wants to publish a video about their work.
---

# paper-video

Make a video that a stranger with no context can follow, that stays true to the work, and that looks good enough to share: real data on screen early, one idea per beat, smooth motion that explains rather than decorates.

You are the **lead**: you plan, build the shared pieces, hand out well-scoped work to subagents when useful, integrate, and own correctness. Work autonomously end to end unless the user asks for checkpoints; show the user results (stills, drafts, renders), not questions, whenever a sensible default exists.

Supporting material (read when you reach that stage):
- `reference/rigor.md` — claims ledger, data handling, independent fact-check
- `reference/voice.md` — narration backends (ElevenLabs / free edge-tts / the user's own recording / none), QA, pronunciation
- `reference/visual-style.md` — design system, motion rules, data honesty, review loop
- `reference/platforms.md` — YouTube + Bilibili deliverables: specs, covers, titles, descriptions, chapters, vertical cut
- `reference/handoff.md` — using the user's own materials, and exporting for editing software
- `scripts/` — the pipeline (see `scripts/README.md`); `template/` — the Remotion starter (see `template/README.md`)

## 0. Intake (keep it short)

You need: **access to the work** (repo URL or path, paper PDF/arXiv link, project page, or remote machine the user can let you read), **languages** (default: English; add Chinese for Bilibili), **target platforms** (default: YouTube + Bilibili), and **narration** (see `reference/voice.md`; default: ElevenLabs if a key is available in env/.env, otherwise edge-tts, and say so). Ask only what you cannot default. Also ask once: first person ("our paper") or third person ("this paper"), and anything that must not appear (unpublished side projects, anonymous submissions, private data).

Treat every remote/shared resource as **read-only** unless told otherwise; list files and sizes before pulling anything large (ask above ~500 MB); never print or commit keys.

## 1. Set up the workshop

1. Create a Remotion project in a new folder (e.g. `npx create-video@latest --blank`, or copy the latest Remotion blank template); do not make the user install anything by hand — install Node deps yourself, and check `ffmpeg`, `python3` and `uv` (install `uv` via its official script or pip if missing).
2. Install the official Remotion agent skills if they are not already available (`~/.agents/skills/remotion-*` or listed in your skills): `npx -y skills add remotion-dev/skills` (see remotion.dev/docs/ai for the current command). Follow them for Remotion API details.
3. Copy `template/` into the project (merge `package.additions.json` into `package.json`, `npm install`), copy `scripts/` to `<project>/scripts/`, create `notes/`, `data/` (raw, git-ignored), `public/data/`, `out/`, and a project `CLAUDE.md` that records: the goal, audiences, languages, voice choice, the "must not appear" list, source-of-truth document, and any user feedback as it arrives (dated). Keep it current — it is how later sessions (and subagents) stay consistent.
4. `npx tsc --noEmit` and render one still of the template to prove the toolchain works.

## 2. Understand the work before writing a word

Read the paper end to end (and appendix), the README / project page, and skim the code for what the figures are made from. Find the **core finding and why it is surprising**, the 2–4 claims that carry the story, and the visuals that can show them with *real* data (figure-data exports, result JSONs, logged metrics, demo outputs). Prefer exported figure data or raw results over digitising plots. Write `notes/understanding.md`: the one-sentence story, the claims with their numbers and settings, the candidate visuals, and anything confusing or easy to overstate.

## 3. Story, script and claims

- **Structure** (adapt, don't force): hook with the strongest real visual in the first ~10 s → a primer that lets a no-context viewer follow (what is the task/object, in plain words, animated) → the problem, shown with data → the idea → why it works (mechanism) → results, including the honest caveats → takeaway + where to find the paper/code. Put good visuals early; don't save them for the end.
- **Write for the ear**: short sentences, one number per sentence, concrete nouns, no "Not X but Y" tics, no fake Q&A, even tone across scene boundaries (an abrupt "Now the fun part!" jars). Give formulas and charts a beat of silence.
- Put the script in `scenes.json` (schema: `template/scenes.example.json`): per scene and language, lines with `text` (captions), `tts` (what is spoken: respellings, sparse audio tags), `anchors` (words that time visual beats), optional `pauseAfterMs`; per scene an optional `chapter`. Write each language natively rather than translating word for word; keep technical terms in English where the audience expects them.
- Start `notes/claims.md` now (`reference/rigor.md`): every number and factual sentence → its source. Write `notes/storyboard.md`: per scene the visual, the anchor-driven beats, the data file, the source line.

## 4. Data → `public/data/*.json`

One agent (you or one subagent) owns turning raw material into clean JSON with a `source` field per file, and writes `notes/data_report.md` that cross-checks every headline number against the paper and lists discrepancies and pitfalls (metric variants, renamed terms, rounding). Scenes only read `public/data`.

## 5. Voice first, then picture

Build the narration before animating (`reference/voice.md`): `scripts/vo.py build --lang <l>` produces per-scene audio and `public/data/vo.<l>.json` with word timings and anchor frames. The picture is then keyed to anchors, so both languages stay in sync automatically. Check the report: ASR round-trip errors, odd prosody, missing anchors; fix wording/respellings, regenerate only affected scenes (outputs are cached by content hash).

## 6. Build the scenes

- You build the theme, shared components and anything reused across scenes first (see `reference/visual-style.md`); then scenes can be parallelised across subagents with **explicit file ownership** (one scene set per agent, nobody edits shared files — they report requested changes back to you). Give each agent: `CLAUDE.md`, the storyboard entry, the `scenes.json` lines and anchor names, the data files, the style rules, and the requirement to render and inspect stills in every language before reporting.
- Every scene: headline, beats driven by anchors (with fallbacks), a source line on data shots, SCHEMATIC on illustrations, both languages' on-screen strings, content clear of the caption band.
- Review: render stills at anchor-based frames for the whole film in every language, tile them into contact sheets (`scripts/contact_sheet.py`), and look — overlaps, clipping, empty frames, illegible text, anything off-message. Iterate.

## 7. Independent fact-check

Spawn a fresh agent that did not build anything to check the script and every on-screen string/number against the paper (prompt in `reference/rigor.md`). Fix MUST-FIX items (including voice-over wording, then regenerate those scenes) and most SHOULD-FIX items.

## 8. Sound, render, verify

Music (optional, `scripts/music.py` or a user-supplied royalty-free track) ducked under speech; a few procedural SFX on visual beats (`scripts/sfx_synth.py`, cues in `src/timeline/sfx.ts`; subtle, ≤2 "hits" per film). Render and master with `scripts/finalize.sh` (−14 LUFS / −1.5 dBTP), export captions with `scripts/srt.py`. Verify the files: duration, streams, loudness, a full-mix ASR pass against the script, and a frame-difference check on held shots (no jitter). Report honestly what was checked.

## 9. Deliverables and handoff

Per `reference/platforms.md`: horizontal cuts per language, optional vertical cut, covers (16:9 and vertical), SRTs, and `out/social_copy.md` with titles/descriptions/chapters per platform (plus any other platform the user asks for — research its current conventions then). If the user wants to finish in an editor or bring their own footage, follow `reference/handoff.md`.

## Iterating with the user

Expect feedback on tone, pacing, clarity and specific frames (they quote timestamps — map them to scene + anchor with `scripts/timeline_info.py`). Record durable preferences in the project `CLAUDE.md`. Re-render only what changed; keep chapters/timestamps in the copy in sync after timing changes.

## Hard-won rules (short list — details in the references)

- Truth over hype: no number without a source; don't state claims more strongly than the paper; show caveats the paper states.
- Real data on real-data charts; illustrations labelled SCHEMATIC; no count-up number animations; bars from zero unless the axis says log.
- No full-frame shake/punch-in/zoom effects — emphasise the specific card; full-frame scale changes also caused visible text jitter in renders.
- The production tool is a credit line, not the pitch (unless the user explicitly wants that angle).
- Never print, log or commit keys; check paid-API quota before every batch and stop if it would be exceeded.
