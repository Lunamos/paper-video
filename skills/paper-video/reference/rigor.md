# Rigor: claims, data, fact-check

A promo video still has to be right. Viewers who know the field will check, and the authors' names are on it.

## Source of truth
Pick one document (usually the paper version that is public, e.g. arXiv v1) and write it into the project `CLAUDE.md`. Numbers and wording follow it. If the code or an internal draft disagrees, the video follows the public paper and you mention the mismatch to the user privately — the video is not a code audit.

## Claims ledger — `notes/claims.md`
One row per spoken or on-screen claim: `scene | claim (as said/shown) | source (file + table/figure/line) | settings/notes`. Include the evaluation setting in small print on screen where a number appears (dataset/split, model, metric, sample size). Fill it while writing the script, not afterwards.

Typical ways a video overclaims — watch for them:
- a stronger verb than the paper ("predicts" vs "locates within tolerance in 3 of 4"; "any strength" vs "stable over the tested range");
- mixing metrics or settings in one sentence or chart (choice vs exact accuracy; different sample sizes; different model sizes);
- implying transfer that did not happen (a model trained separately for each task);
- showing only the largest win; hiding a result that contradicts the narration (if the chart shows it, the voice-over must not say otherwise);
- picking a "best" configuration on the same data it is evaluated on without saying so;
- calling an illustration data, or a selected example representative (label "selected example").

## Data handling
- Prefer exact exported values (figure-data dumps, result JSON/CSV) over digitised plots. Never invent intermediate values; if a chart needs a value the source lacks, drop it or mark it.
- One owner converts raw data to `public/data/*.json` with a `source` field and writes `notes/data_report.md`: every headline number checked against the paper text, and a "discrepancies and pitfalls" list at the top (renamed terms, stale labels, metric variants, rounding).
- Things the user said must not appear (unpublished work, anonymous submissions, private logs, collaborators' side projects) stay out of data files, stills, copy and repo history.

## Independent fact-check (spawn a fresh agent)
Prompt skeleton:

> You are an independent fact-checker; you did not build anything. Source of truth: `<paper>`. Read `CLAUDE.md`, `notes/data_report.md`. Check (1) every sentence and number in `scenes.json` (`text`, every language) against the paper, including whether each language says the same thing; (2) every on-screen string, number, label, axis, legend, unit, metric name and source line in `src/scenes/**` and the data they plot; (3) framing: overclaims, missing settings/caveats, illustrations presented as data, selected examples not labelled, anything that must not appear. You may render stills to see the screen. Do not edit code; write `notes/factcheck.md` with MUST FIX (wrong or misleading) and SHOULD FIX (imprecise), each with location, what the paper says (with location), and exact replacement text for every language. Final reply: the two lists.

Apply fixes, re-render affected scenes, and re-check the specific items. Voice-over fixes mean regenerating those scenes' audio; then re-time the music with `scripts/music.py --lang <cut> --refit` (stretches each music section to its new length, no new credits) and recompute chapter timestamps in the copy. Run the fact-check on the script as soon as the voice-over exists, in parallel with building the scenes: wording fixes are cheapest before the picture is final.
