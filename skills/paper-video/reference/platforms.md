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

Vertical cut (`template` Vertical composition): title block and current chapter on top, the 16:9 film re-rendered in the middle (not a downscaled video — it stays sharp), chapter progress bar, larger captions below, bottom ~20% and the right edge left free for the platform's buttons.

## Covers
- 16:9 1920×1080 (YouTube, Bilibili); Bilibili also shows 16:10/4:3 crops — keep the text inside a centred safe area, nothing important in the bottom-right corner (duration badge).
- Vertical covers: 3:4 1080×1440 and 9:16 1080×1920.
- One strong visual from the film (real data), a 2–6 word headline about the finding (not about the tool), one small pill with the key number or claim. High contrast, readable as a thumbnail.

## Titles, descriptions, chapters (`out/social_copy.md`)
- Lead with the concrete surprising thing, in the audience's words; the paper title belongs in the description. Offer 3–5 title options per platform. YouTube ≤ 100 chars (aim ≤ 70); Bilibili ≤ 80 chars.
- Descriptions: a hook paragraph, 2–4 lines of what the work found (numbers with settings), links, authors, a line of credits.
- **Links**: YouTube and X: real links. Bilibili (and 小红书): external links are not clickable and can hurt reach — write plain identifiers ("arXiv 2601.01234", "GitHub: owner/repo") instead of URLs.
- Chapters: from `scripts/timeline_info.py` scene starts (first at 0:00, ≥ 3 chapters, ≥ 10 s each on YouTube); re-generate after any timing change.
- Bilibili: choose the 知识 zone (科学科普 or 计算机技术), up to 10 tags, and tick the AI-generated-content declaration when voice/music/visuals are AI-made.
- Credit the production tools in one low-key line if the user wants; the pitch is the work itself.

## Writing good copy
Be lively and specific; each platform has its own flavour (YouTube: searchable, clear; Bilibili: curious, conversational; X: a scroll-stopping first post then a thread; group chats: a friendly "sharing our work" note with the pain point, the idea, one fun observation, links). Keep every number true to the paper. If a stronger writing model/agent is available to you, it is worth delegating copy to it with the full context (paper, verified claims, the video script, style examples from the user, platform constraints) and then fact-checking the result yourself.
