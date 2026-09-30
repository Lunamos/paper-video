// Turns public/data/vo.<cut>.json (written by the voice-over pipeline, format version 2) into frame-accurate scene
// timelines. One voice-over clip per scene (performed as one continuous read); lines and words are spans inside it.
//
// A "cut" is one voice track + its timings (en, zh, en-short, zh-vertical, ...). The on-screen text language (`lang`)
// is chosen separately, so e.g. a "zh-vertical" cut can reuse the zh text blocks. To add a cut: write
// public/data/vo.<cut>.json and add one import + one entry to `voFiles` below.
import { getStaticFiles } from "remotion";
import voEn from "../../public/data/vo.en.json";
import voZh from "../../public/data/vo.zh.json";

// ------------------------------------------------------------------ vo.<cut>.json format (version 2)
export type Word = {
  w: string; // the word as displayed in captions (EN: with trailing punctuation; ZH: one token / char run)
  startMs: number; // relative to the start of the scene's audio clip
  endMs: number;
  sp?: number | boolean; // 1 = a space precedes this word when captions join words (EN: 1, ZH: 0 except Latin runs)
};
export type VOLine = {
  id: string; // stable id shared across languages (a, b, c ...)
  text: string; // caption text (may differ from what was spoken, e.g. respellings live only in `tts`)
  startMs: number; // relative to the scene clip
  endMs: number;
  words: Word[];
  anchors: Record<string, number>; // anchor name -> ms (relative to the scene clip) where the anchor word starts
};
export type VOScene = {
  id: string; // must match an id in scenes/registry.ts
  audio: string; // path under public/, e.g. "audio/en/s_intro.mp3"; "" = no audio (silent / timing-only scene)
  durationMs: number; // length of the audio clip (or of the estimated read when there is no audio)
  minSeconds: number; // the scene lasts at least this long, even if the read is shorter
  leadInMs: number; // picture before the voice starts; NEGATIVE = J-cut (the voice starts before the cut)
  tailMs: number; // picture held after the voice ends
  chapter?: string; // optional chapter name (vertical cut pill / progress bar)
  lines: VOLine[];
};
export type VOFile = { version?: number; meta: Record<string, unknown>; scenes: VOScene[] };

// ------------------------------------------------------------------ frame-based timeline
export type TimedWord = { w: string; from: number; to: number; sp: boolean };
export type TimedLine = {
  id: string;
  text: string;
  from: number; // frame, relative to scene start
  durationInFrames: number;
  words: TimedWord[]; // frames relative to scene start
  anchors: Record<string, number>; // frames relative to scene start
};
export type TimedScene = {
  id: string;
  from: number; // absolute frame in the full video
  durationInFrames: number;
  chapter?: string;
  // `from` is relative to the scene start and negative for a J-cut
  audio: { src: string; from: number; durationInFrames: number } | null;
  lines: TimedLine[];
};
export type Timeline = { fps: number; durationInFrames: number; scenes: TimedScene[] };

export const FPS = 30;

/** cut name -> voice-over timing file. Extend here. The first entry is the fallback for unknown / empty cuts. */
export const voFiles: Record<string, VOFile> = {
  en: voEn as unknown as VOFile,
  zh: voZh as unknown as VOFile,
};

/** True if `path` (relative to public/) exists. Unknown environments (empty file list) are trusted. */
export const hasStaticFile = (path: string): boolean => {
  if (!path) return false;
  let files: { name: string }[] = [];
  try {
    files = getStaticFiles();
  } catch {
    return true;
  }
  if (!files.length) return true;
  const want = path.replace(/^\/+/, "");
  return files.some((f) => f.name === want);
};

const f = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

export const buildSceneTimeline = (s: VOScene, fps = FPS): Omit<TimedScene, "from"> => {
  const lead = s.leadInMs;
  const lines: TimedLine[] = s.lines.map((l) => ({
    id: l.id,
    text: l.text,
    from: f(lead + l.startMs, fps),
    durationInFrames: Math.max(1, f(l.endMs - l.startMs, fps)),
    words: l.words.map((w) => ({ w: w.w, from: f(lead + w.startMs, fps), to: f(lead + w.endMs, fps), sp: Boolean(w.sp) })),
    anchors: Object.fromEntries(Object.entries(l.anchors ?? {}).map(([k, v]) => [k, f(lead + v, fps)])),
  }));
  const total = Math.max(s.minSeconds * 1000, lead + s.durationMs + s.tailMs);
  return {
    id: s.id,
    durationInFrames: Math.max(1, f(total, fps)),
    chapter: s.chapter,
    audio: s.audio && hasStaticFile(s.audio) ? { src: s.audio, from: f(lead, fps), durationInFrames: f(s.durationMs, fps) + 2 } : null,
    lines,
  };
};

export const buildTimeline = (cut: string, fps = FPS): Timeline => {
  const fallback = Object.values(voFiles)[0];
  const vo = voFiles[cut]?.scenes?.length ? voFiles[cut] : fallback;
  let from = 0;
  const scenes = vo.scenes.map((s) => {
    const st = buildSceneTimeline(s, fps);
    const scene = { ...st, from };
    from += st.durationInFrames;
    return scene;
  });
  return { fps, durationInFrames: Math.max(1, from), scenes };
};
