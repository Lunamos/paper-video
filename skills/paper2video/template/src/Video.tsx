import { Audio } from "@remotion/media";
import React, { useMemo } from "react";
import { AbsoluteFill, CalculateMetadataFunction, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Captions } from "./components/Captions";
import { Backdrop, useFontsReady } from "./components/core";
import { SCENES } from "./scenes/registry";
import { clamp, color, font, Lang } from "./theme";
import { SceneProvider } from "./timeline/SceneContext";
import { MUSIC_DROPOUTS, resolveCues } from "./timeline/sfx";
import { buildTimeline, FPS, hasStaticFile, TimedScene, Timeline } from "./timeline/timeline";

/** Output file stem, e.g. "video-en.mp4". Change together with PREFIX in Root.tsx. */
export const OUT_STEM = "video";

const FADE = 9; // frames of content fade at scene boundaries (the backdrop stays, so cuts never flash)

/**
 * Content fade in/out at scene boundaries. Deliberately NO full-frame push-ins / zooms / camera drift: scaling the
 * whole frame made text and hairlines shimmer visibly. To emphasise something, animate that card or object itself.
 */
const SceneFade: React.FC<{ scene: TimedScene; children: React.ReactNode; first?: boolean; last?: boolean }> = ({
  scene,
  children,
  first,
  last,
}) => {
  const frame = useCurrentFrame();
  const duration = scene.durationInFrames;
  const inP = first ? 1 : interpolate(frame, [0, FADE], [0, 1], clamp);
  const outP = last ? 1 : interpolate(frame, [duration - FADE, duration], [1, 0], clamp);
  return <AbsoluteFill style={{ opacity: Math.min(inP, outP) }}>{children}</AbsoluteFill>;
};

export const SceneShell: React.FC<{ scene: TimedScene; lang: Lang; cut?: string; first?: boolean; last?: boolean; withAudio?: boolean }> = ({
  scene,
  lang,
  cut,
  first,
  last,
  withAudio = true,
}) => {
  const entry = SCENES.find((s) => s.id === scene.id);
  const Comp = entry?.comp ?? MissingScene;
  return (
    <SceneProvider scene={scene} lang={lang} cut={cut}>
      <SceneFade scene={scene} first={first} last={last}>
        <Comp />
      </SceneFade>
      {withAudio && scene.audio ? (
        <Sequence from={Math.max(0, scene.audio.from)} durationInFrames={scene.audio.durationInFrames} name={`vo ${scene.id}`} layout="none">
          <Audio src={staticFile(scene.audio.src)} trimBefore={Math.max(0, -scene.audio.from)} />
        </Sequence>
      ) : null}
    </SceneProvider>
  );
};

/** Placeholder for a scene id that is in the vo JSON but not yet in scenes/registry.ts. */
const MissingScene: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: font.mono, fontSize: 28, color: color.text3 }}>
    scene not registered in src/scenes/registry.ts
  </AbsoluteFill>
);

// ---- voice-over: one global track so a scene's first words can start before its picture (J-cut, leadInMs < 0)
const VoiceTrack: React.FC<{ timeline: Timeline }> = ({ timeline }) => (
  <>
    {timeline.scenes.map((s) => {
      if (!s.audio) return null;
      const start = s.from + s.audio.from;
      return (
        <Sequence key={s.id} from={Math.max(0, start)} durationInFrames={s.audio.durationInFrames} name={`vo ${s.id}`} layout="none">
          <Audio src={staticFile(s.audio.src)} trimBefore={Math.max(0, -start)} />
        </Sequence>
      );
    })}
  </>
);

// ---- background music: ≈20 dB under the voice while speaking; lines < 1.2 s apart count as one stretch of speech
// so the bed does not pump; it rises only in real pauses and is fullest with no voice at all (intro / outro).
// File: public/audio/bgm_<cut>.mp3, composed to this cut's timeline (starts at frame 0). Skipped if missing.
const BGM_SPEECH = 0.08;
const BGM_GAP = 0.2;
const BGM_OPEN = 0.35;
const MERGE_GAP = 36; // frames
const RAMP = 9; // frames

export const bgmPath = (cut: string) => `audio/bgm_${cut}.mp3`;

const Bgm: React.FC<{ timeline: Timeline; cut: string }> = ({ timeline, cut }) => {
  const spans = useMemo(() => {
    const raw = timeline.scenes
      .flatMap((s) => s.lines.map((l) => [s.from + l.from, s.from + l.from + l.durationInFrames] as [number, number]))
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const r of raw) {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] < MERGE_GAP) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    return merged;
  }, [timeline]);
  const drops = useMemo(
    () =>
      MUSIC_DROPOUTS.flatMap(([sid, at, before, after]) => {
        const s = timeline.scenes.find((x) => x.id === sid);
        const l = s?.lines.find((x) => at in x.anchors);
        return s && l ? [[s.from + l.anchors[at] - before, s.from + l.anchors[at] + after] as [number, number]] : [];
      }),
    [timeline],
  );
  const src = bgmPath(cut);
  if (!hasStaticFile(src)) return null;
  const total = timeline.durationInFrames;
  const first = spans.length ? spans[0][0] : 0;
  const last = spans.length ? spans[spans.length - 1][1] : total;
  const volume = (f: number) => {
    let d = Infinity; // distance (frames) to the nearest stretch of speech
    for (const [a, b] of spans) d = Math.min(d, f < a ? a - f : f > b ? f - b : 0);
    const idle = f < first || f > last ? BGM_OPEN : BGM_GAP;
    let v = interpolate(d, [0, RAMP], [BGM_SPEECH, idle], clamp);
    for (const [a, b] of drops) v *= interpolate(f, [a - 6, a, b, b + 6], [1, 0.12, 0.12, 1], clamp);
    const fadeIn = interpolate(f, [0, 12], [0.4, 1], clamp);
    const fadeOut = interpolate(f, [total - 45, total - 2], [1, 0], clamp);
    return v * fadeIn * fadeOut;
  };
  return <Audio src={staticFile(src)} volume={volume} />;
};

// ---- sound design: short cues on visual beats (not ducked; levels set per cue in timeline/sfx.ts)
const Sfx: React.FC<{ timeline: Timeline; cut: string }> = ({ timeline, cut }) => {
  const cues = useMemo(() => resolveCues(timeline, cut).filter((c) => hasStaticFile(`audio/sfx/${c.sfx}.wav`)), [timeline, cut]);
  return (
    <>
      {cues.map((c) => (
        <Sequence key={c.key} from={c.frame} durationInFrames={60} name={`sfx ${c.sfx}`} layout="none">
          <Audio src={staticFile(`audio/sfx/${c.sfx}.wav`)} volume={c.vol} />
        </Sequence>
      ))}
    </>
  );
};

/** Layers that `mute` can switch off (for exporting stems / a clean picture to an editor). */
export type Layer = "voice" | "music" | "sfx" | "captions";

export type VideoProps = {
  /** On-screen text language. */
  lang: Lang;
  /** Voice track / timing file: public/data/vo.<cut>.json (must be registered in timeline.ts voFiles). Default: lang. */
  cut?: string;
  /** Burned-in captions (default true). The vertical cut passes false and draws its own. */
  captions?: boolean;
  /** Layers to leave out. ["music","sfx","captions"] = voice stem + picture; all four = clean picture, silent. */
  mute?: Layer[];
};

export const MainVideo: React.FC<VideoProps> = ({ lang, cut, captions = true, mute = [] }) => {
  useFontsReady();
  const track = cut ?? lang;
  const timeline: Timeline = useMemo(() => buildTimeline(track), [track]);
  const on = (l: Layer) => !mute.includes(l);
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <Backdrop />
      {timeline.scenes.map((s, i) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={s.id}>
          <SceneShell scene={s} lang={lang} cut={track} first={i === 0} last={i === timeline.scenes.length - 1} withAudio={false} />
        </Sequence>
      ))}
      {captions && on("captions") ? <Captions timeline={timeline} fontFamily={lang === "zh" ? font.zh : font.sans} zh={lang === "zh"} /> : null}
      {on("voice") ? <VoiceTrack timeline={timeline} /> : null}
      {on("music") ? <Bgm timeline={timeline} cut={track} /> : null}
      {on("sfx") ? <Sfx timeline={timeline} cut={track} /> : null}
    </AbsoluteFill>
  );
};

export const calcVideoMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
  const track = props.cut ?? props.lang;
  const tl = buildTimeline(track);
  return { durationInFrames: tl.durationInFrames, fps: FPS, defaultOutName: `${OUT_STEM}-${track}` };
};

// ---- standalone scene preview (one composition per scene, for fast iteration in the Studio)
export type ScenePreviewProps = { sceneId: string; lang: Lang; cut?: string };

export const ScenePreview: React.FC<ScenePreviewProps> = ({ sceneId, lang, cut }) => {
  useFontsReady();
  const track = cut ?? lang;
  const tl = useMemo(() => buildTimeline(track), [track]);
  const s = tl.scenes.find((x) => x.id === sceneId);
  if (!s) {
    return (
      <AbsoluteFill style={{ background: color.bg, alignItems: "center", justifyContent: "center", color: color.text3, fontFamily: font.mono, fontSize: 28 }}>
        {`scene "${sceneId}" is not in public/data/vo.${track}.json`}
      </AbsoluteFill>
    );
  }
  const local: TimedScene = { ...s, from: 0 };
  const localTl: Timeline = { fps: tl.fps, durationInFrames: s.durationInFrames, scenes: [local] };
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <Backdrop />
      <SceneShell scene={local} lang={lang} cut={track} first last />
      <Captions timeline={localTl} fontFamily={lang === "zh" ? font.zh : font.sans} zh={lang === "zh"} />
    </AbsoluteFill>
  );
};

export const calcSceneMetadata: CalculateMetadataFunction<ScenePreviewProps> = ({ props }) => {
  const tl = buildTimeline(props.cut ?? props.lang);
  const s = tl.scenes.find((x) => x.id === props.sceneId);
  return { durationInFrames: s ? s.durationInFrames : 30, fps: FPS };
};
