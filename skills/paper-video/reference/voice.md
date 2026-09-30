# Narration

`scripts/vo.py` turns the lines in `scenes.json` into per-scene audio plus word timings (`public/data/vo.<lang>.json`). The picture is keyed to anchor words, so every backend must end up with timings.

## Choosing a backend (per language, `voices.<lang>.backend`)

| Backend | Needs | Quality | Notes |
|---|---|---|---|
| `elevenlabs` | `ELEVENLABS_API_KEY` in env or `.env` | best expressiveness; v3 audio tags (`[curious]`, `[sighs]`, `[chuckles]`) | character-level timestamps; paid — check quota before every batch |
| `edge` | nothing (internet) | clear, a bit announcer-like; no tags | free neural voices via the `edge-tts` package; word timings from its word-boundary events |
| `recorded` | the user's own narration per scene in `recordings/<lang>/<scene>.wav` | the most human | timings from local faster-whisper, aligned to the script |
| `none` | nothing | — | silent timeline from reading speed; captions + music only |

Default: ElevenLabs if a key is present, else edge; tell the user which and why, and offer the others. Other good options exist (local open-source TTS such as CosyVoice / IndexTTS / F5-TTS / Kokoro, or commercial ones) — add a backend only if the user wants it; anything that yields audio + word timings plugs in, and forced alignment (faster-whisper) can supply timings for any audio.

## Casting
Audition 3–4 candidate voices per language with two or three representative sentences (`vo.py audition`), cheap/fast model for drafts, best model for finals. Prefer a library voice with native pronunciation for each language. Don't imitate or clone any real person's voice without their consent (e.g. a character's voice actor); the user's own voice is fine.

## Generation strategy that sounds alive
- **One request per scene**, not per sentence — sentence-by-sentence synthesis sounds stiff and starts every sentence cold.
- **Several seeds per scene** (e.g. 3); pick automatically by ASR accuracy first, then prosody (pitch variation) with a small penalty for length. Manual picks go in `notes/vo_picks.<lang>.json`. For a scene that must stay calm, set `"pick": "steady"` (closest to the film's typical expressiveness).
- **Sparse audio tags** (≈4 per language per film). A tag at the very start of a scene can slur the first word — put the tag later or drop it.
- **Tighten pauses by context** (clause < line break < sentence end < ellipsis) and enforce minimum gaps after lines that need air (`pauseAfterMs`). Normalise loudness per clip; the master is normalised again at the end.
- **J-cuts**: a negative `leadInMs` lets the next scene's voice start slightly before its picture.

## Objective QA (you cannot listen — measure)
`vo.py` runs `voice_qa.py` on every take: ASR round-trip (ElevenLabs Scribe if a key is present, else faster-whisper) with a diff against the script, pitch statistics, pause statistics. Read the diffs: many are just formatting (numbers written as digits, respelled names); real problems are misread words. Test fixes on short snippets before regenerating whole scenes.

Pronunciation tricks (only change `tts`, never the caption `text`):
- respell names and acronyms phonetically, test variants with ASR, keep the one that round-trips;
- spell numbers as words the way you want them read ("twenty-twenty-six", "zero point six"; in Chinese write the characters);
- **polyphones** (e.g. Chinese 行 háng/xíng, 调 diào/tiáo, 长 cháng/zhǎng): rewrite with an unambiguous homophone in `tts` or rephrase;
- a word misheard in all takes is usually mispronounced — rephrase with a synonym.

## Cost, caching, keys
Every paid batch: query remaining quota, estimate the batch, print both, abort if it would exceed. Audio is cached by a hash of text + voice + model + settings + seed, so re-runs only pay for what changed. Keys live only in env/`.env` (git-ignored); never print them.

## Recorded narration (collaboration)
Give the user the final script per scene (`scripts/srt.py` or a printed table), ask for one file per scene (any common format, quiet room, 30 cm from the mic), put them in `recordings/<lang>/`, and build with `backend: "recorded"`. Their performance sets the timing; the picture follows via anchors.
