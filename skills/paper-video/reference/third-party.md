# Starting from an arXiv link or a title (someone else's paper)

Most videos start with nothing but `arXiv:XXXX.XXXXX` or a paper title, no repo access and no GPU. This file covers finding the material, getting real numbers out of it, and staying faithful to authors you are not.

## 1. Collect everything public (into `data/`, git-ignored)
1. **Resolve the paper**: from a title, search arXiv (`http://export.arxiv.org/api/query?search_query=ti:"..."`) and confirm authors/year; note the latest version number and use it as the source of truth (record `vN` in `CLAUDE.md`).
2. **PDF and LaTeX source**: `https://arxiv.org/pdf/<id>` and the source tarball `https://arxiv.org/e-print/<id>` (gzip'd tar, sometimes a single gzip'd .tex). Extract to `data/paper/src/`. The source gives exact table values, macros/notation for KaTeX, captions, and the figure files.
3. **Code, project page, data**: links in the abstract/paper/README of the source; the arXiv page's "Code, Data, Media" section; Papers with Code; GitHub search by title; Hugging Face (models, datasets, Spaces) by title or author; the authors' homepages. Note licences.
4. **Talks/blogs/threads** by the authors can show which result they consider the headline — useful for emphasis, never as a number source.

## 2. Getting numbers, in order of preference
1. **Tables in the LaTeX source** — parse the `tabular` directly.
2. **Released results**: JSON/CSV/logs in the repo, released checkpoints' eval files, Hugging Face dataset cards.
3. **Figure data embedded in the source**: pgfplots/TikZ coordinates or `\addplot table` files; some figures ship as PDF/SVG with vector paths whose coordinates can be extracted (e.g. `pdftocairo -svg`, then read path coordinates and map axis ticks to data).
4. **Plotting scripts in the repo** that re-create a figure from shipped data — run them on CPU and export the arrays.
5. **Digitising raster figures** (last resort): calibrate on two labelled ticks per axis, extract marks by colour (numpy over the PNG), and record the expected error (≈ ±1 pixel in data units). Mark such charts on screen as "digitised from Fig. N" and never present digitised values as exact numbers — show the curve, quote only numbers that appear in the text or tables.
6. **Small CPU reproductions** — only when cheap and clearly labelled: e.g. running a small public model for a few dozen examples to *illustrate* a phenomenon (token probabilities, attention, an embedding plot). Say on screen what was run ("illustration · Qwen2.5-0.5B on 20 prompts, run for this video"), keep it out of any "the paper shows" sentence, and never compare it numerically against the paper's results. No training, no large downloads without asking (ask above ~5 GB), no GPU assumptions.

Record every source in `notes/data_report.md` (which file/table/figure, which method, expected error).

## 3. Faithfulness for someone else's work
- The video explains the authors' work. Say "the authors" / "this paper" / "作者" / "这篇论文"; never "we" or "our method". Name the authors and institutions on screen near the start and on the end card, and link the paper in the descriptions.
- No new claims, no opinions dressed as findings, no "SOTA" unless the paper says so for that setting. Keep their terminology and notation. Present their stated limitations and scope; if a result is contested elsewhere, either leave it out or say so neutrally only if the user asks.
- Little creative re-framing: the story follows the paper's own argument (motivation → observation → method → results → limitations). Analogies are fine to explain a concept, not to strengthen a result.
- Redraw figures from data rather than pasting the paper's figure images; if an original figure is shown (e.g. a qualitative example), show it small, credited ("Figure 3 of <paper>"), and only briefly. Check the paper's licence (arXiv licence on the abs page); when in doubt, redraw.
- Thumbnails/titles describe the finding, not the authors' reputation; don't imply endorsement by the authors or their institutions. Add a line in descriptions: "Unofficial explainer of <title> by <authors>." (and the Chinese equivalent 「非官方解读」).
