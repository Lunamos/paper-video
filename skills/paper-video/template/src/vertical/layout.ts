// Vertical (9:16, 1080×1920) design system for phones: big type, one focus per beat, and the WHOLE frame used.
//
// TEXT-safe area (anything a viewer must read): x 120–888, y 260–1500; below y 840 keep text at x ≤ 780 (the platform's
// like/comment/share column). PICTURE: the whole 1080×1920 frame — visuals may run under the platform UI and should
// bleed into the top (0–260) and bottom (1500–1920) bands; an empty top/bottom makes the clip look like a square video.
// Stack: headline (y 280–620) → the main visual, TALL (y 620–1280, full width) → captions (y 1300–1500).
export const VW = 1080;
export const VH = 1920;
export const SAFE = { top: 260, left: 120, right: 888, rightLow: 780, lowY: 840, bottom: 1500 } as const;
/** Headline / keyword zone. */
export const HEAD = { y: 280, maxY: 620 } as const;
/** Content area for visuals (headline + main visual); visuals may extend beyond it to the frame edges. */
export const CONTENT = { x: 40, y: 280, w: 1000, h: 1000 } as const;
/** The main visual of a beat when a headline is shown above it: y 620–1280, full width. */
export const STAGE = { x: 40, y: 620, w: 1000, h: 660 } as const;
/** Captions: ≤ 2 lines × 9 Chinese characters (≈ 18 latin), 72 px bold, at 68–78 % of the height, clear of the buttons. */
export const CAP = { top: 1300, height: 200, left: 120, right: 780, size: { zh: 72, en: 60 }, perLine: { zh: 9, en: 18 } } as const;
/** Type scale (px at 1080 wide). Nothing a viewer must read is smaller than `label`; the source line is the exception. */
export const VT = { kicker: 34, head: 120, key: 88, big: 220, sub: 64, label: 46, chip: 34, source: 26 } as const;
/** Scenes the vertical cut leaves out (their audio is simply not played). */
export const V_DROP: string[] = []; // e.g. ["s_details"] — technical scenes the phone cut skips
