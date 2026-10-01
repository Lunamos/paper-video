# Platforms and deliverables

Built in: **YouTube** and **Bilibili**. For any other platform the user names (X, 小红书, LinkedIn, TikTok/抖音, WeChat groups …), look up its current specs and conventions first, then produce the same kinds of outputs.

## Video files
| | YouTube | Bilibili |
|---|---|---|
| Main cut | 16:9, 1920×1080, 30 fps, H.264 + AAC 48 kHz | same |
| Loudness | −14 LUFS integrated, −1.5 dBTP (`scripts/finalize.sh`) | same |
| Language | usually English | usually Chinese (hard captions are normal) |
| Captions | burned in + `.srt` for CC (optional) | burned in; `.srt` as CC only if not burned in |
| Vertical | Shorts: 1080×1920, ≤ 60 s — make a short teaser if wanted | 竖屏: 1080×1920, full length OK |

Vertical cut: build it **natively for the phone** (`reference/vertical.md`): same audio, new 9:16 layouts with very big type and one focus per beat, inside the platforms' safe area. The template's `Vertical` composition (the 16:9 film re-rendered in a band between a title block and captions) is only a quick draft — its text is too small on a phone.

## Covers
- YouTube: 16:9 1920×1080 (under 2 MB).
- **Bilibili takes ONE cover image** but shows it twice: cropped to **4:3 in the home feed** and as **16:9 on the video page and the user's space**. Make one 16:9 master (`Cover-Bili`, rendered with `--scale=2` → 3840×2160, exported as JPEG ~1 MB) with every readable element and the key visual inside the centred 4:3 area (x 240–1680 of 1920) and only background extension in the side bands; check both crops (`ffmpeg -i cover_bilibili.png -vf crop=iw*0.75:ih cover_bilibili_preview_4x3.jpg`) and tell the user to keep the uploader's 4:3 crop centred. Nothing important in the bottom-right corner (duration badge). Don't hand over separate 16:9 / 16:10 / 4:3 files for Bilibili — only one can be uploaded.
- Vertical covers: 3:4 1080×1440 and 9:16 1080×1920.
- One strong visual from the film (real data), a 2–6 word headline about the finding (not about the tool), one small pill with the key number or claim. High contrast, readable as a thumbnail.
- The headline obeys the same truth rules as the script: if the result holds only for some settings (e.g. on par for the small model, better for the large ones), say "same or better", not "better", and let the pill name the setting of the number.
- YouTube thumbnails must be under 2 MB: a 1920×1080 PNG with a busy backdrop often is not — export a JPEG (quality ~90) next to it.

## Titles, descriptions, chapters (`out/social_copy.md`)
Use the structure of `template/social_copy.example.md` — the same sections in the same order every time, so the user
can paste each block straight into the upload form:
- **Header**: paper, authors, links, the files to upload (with durations), the cover file, the stance (first/third person, what is illustration).
- **Per platform**: cover note → 3–5 titles (★ recommended) → description → chapters → (Bilibili) pinned comment → tags → category / AI declaration.
- **Description shape**: 1–2 lines of hook (the surprising finding in plain words — this is what shows before "more" /
  in the feed) → one sentence on whose paper and what it does → 2–4 short bullets, each one finding with its number
  and setting → links (identifiers only on Bilibili) → authors → one line of stance and credits → third-party asset
  credits last, compact (author · licence; full URLs only where the licence needs them). Short paragraphs; no walls of
  text; settings in brackets only where a number needs them; what the video does not cover goes in at most one
  short "also in the paper" bullet, or nowhere.
- **Chapters**: computed from the final timeline (`scripts/timeline_info.py`), floor to whole seconds, first at 0:00,
  ≥ 3, each ≥ 10 s (merge a short outro into the previous chapter); YouTube: in the description right after the
  links; Bilibili: a separate block for the 分段章节 field.
- **Limits**: YouTube title ≤ 100 chars (aim ≤ 70), description ≤ 5,000; Bilibili title ≤ 80, 简介 ≤ 2,000 字, ≤ 10 tags.
- Chinese: a space between Chinese and Latin letters / numbers, full-width punctuation, 「」 for quotes.

- Lead with the concrete surprising thing, in the audience's words; the paper title belongs in the description. Offer 3–5 title options per platform. YouTube ≤ 100 chars (aim ≤ 70); Bilibili ≤ 80 chars.
- Descriptions: a hook paragraph, 2–4 lines of what the work found (numbers with settings), links, authors, a line of credits.
- **Links**: YouTube and X: real links. Bilibili (and 小红书): external links are not clickable and can hurt reach — write plain identifiers ("arXiv 2601.01234", "GitHub: owner/repo") instead of URLs.
- Chapters: from `scripts/timeline_info.py` scene starts (first at 0:00, ≥ 3 chapters, ≥ 10 s each on YouTube); re-generate after any timing change.
- Bilibili: choose the 知识 zone (科学科普 or 计算机技术), up to 10 tags, and tick the AI-generated-content declaration when voice/music/visuals are AI-made.
- Credit the production tools in one low-key line if the user wants; the pitch is the work itself.

## Writing good copy
Be lively and specific, but every number stays true to the paper. Each platform has its own flavour: YouTube — searchable, clear, the finding in the title; Bilibili — curious and conversational, a concrete hook in the first line of the 简介. For someone else's paper, the copy presents *their* work: name the authors and institutions, link the paper, and never write as if you were the authors (see `third-party.md`).
