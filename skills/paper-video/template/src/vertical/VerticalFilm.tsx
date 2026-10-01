// The vertical-native cut (1080×1920): its own scene components (src/vertical/scenes), the same voice-over,
// SFX and music as the 16:9 film. Scenes listed in V_DROP are left out; the music is played per scene from the
// scene's position in the original score, so it stays in step with the picture without a new music file.
import { Audio } from "@remotion/media";
import React, { useMemo } from "react";
import { AbsoluteFill, CalculateMetadataFunction, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { useFontsReady } from "../components/core";
import { clamp, color, Lang } from "../theme";
import { SceneProvider } from "../timeline/SceneContext";
import { MUSIC_DROPOUTS, resolveCues } from "../timeline/sfx";
import { buildTimeline, FPS, hasStaticFile, TimedScene, Timeline } from "../timeline/timeline";
import { V_DROP } from "./layout";
import { VSCENES } from "./scenes/registry";
import { VCaptions } from "./VCaptions";
import { VBackdrop } from "./VKit";

export type VTimeline = { timeline: Timeline; orig: Record<string, number> };

export const buildVTimeline = (lang: string): VTimeline => {
  const full = buildTimeline(lang);
  const orig = Object.fromEntries(full.scenes.map((s) => [s.id, s.from]));
  let from = 0;
  const scenes = full.scenes
    .filter((s) => !V_DROP.includes(s.id))
    .map((s) => {
      const o = { ...s, from };
      from += s.durationInFrames;
      return o;
    });
  return { timeline: { fps: full.fps, durationInFrames: from, scenes }, orig };
};

const FADE = 8;

const VSceneFade: React.FC<{ scene: TimedScene; first?: boolean; last?: boolean; children: React.ReactNode }> = ({ scene, first, last, children }) => {
  const frame = useCurrentFrame();
  const d = scene.durationInFrames;
  const o = Math.min(first ? 1 : interpolate(frame, [0, FADE], [0, 1], clamp), last ? 1 : interpolate(frame, [d - FADE, d], [1, 0], clamp));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const VSceneShell: React.FC<{ scene: TimedScene; lang: Lang; first?: boolean; last?: boolean }> = ({ scene, lang, first, last }) => {
  const Comp = VSCENES.find((s) => s.id === scene.id)?.comp ?? (() => null);
  return (
    <SceneProvider scene={scene} lang={lang} cut={lang}>
      <VSceneFade scene={scene} first={first} last={last}>
        <Comp />
      </VSceneFade>
    </SceneProvider>
  );
};

const VoiceTrack: React.FC<{ timeline: Timeline }> = ({ timeline }) => (
  <>
    {timeline.scenes.map((s) =>
      s.audio ? (
        <Sequence key={s.id} from={s.from + s.audio.from} durationInFrames={s.audio.durationInFrames} name={`vo ${s.id}`} layout="none">
          <Audio src={staticFile(s.audio.src)} />
        </Sequence>
      ) : null,
    )}
  </>
);

// music: same ducking as the 16:9 film (≈20 dB under speech), played scene by scene from the original score
const BGM_SPEECH = 0.08;
const BGM_GAP = 0.2;
const BGM_OPEN = 0.35;
const MERGE_GAP = 36;
const RAMP = 9;
const JOIN = 10; // frames of fade where the vertical cut jumps over a left-out scene

const BgmSegments: React.FC<{ vt: VTimeline; track: string }> = ({ vt, track }) => {
  const { timeline, orig } = vt;
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
  const total = timeline.durationInFrames;
  const first = spans.length ? spans[0][0] : 0;
  const lastSpeech = spans.length ? spans[spans.length - 1][1] : total;
  const duck = (f: number) => {
    let d = Infinity;
    for (const [a, b] of spans) d = Math.min(d, f < a ? a - f : f > b ? f - b : 0);
    const idle = f < first || f > lastSpeech ? BGM_OPEN : BGM_GAP;
    let v = interpolate(d, [0, RAMP], [BGM_SPEECH, idle], clamp);
    for (const [a, b] of drops) v *= interpolate(f, [a - 6, a, b, b + 6], [1, 0.12, 0.12, 1], clamp);
    return v * interpolate(f, [0, 12], [0.4, 1], clamp) * interpolate(f, [total - 45, total - 2], [1, 0], clamp);
  };
  const sc = timeline.scenes;
  return (
    <>
      {sc.map((s, i) => {
        // contiguous with the previous/next kept scene in the original score?
        const joinIn = i > 0 && orig[s.id] !== orig[sc[i - 1].id] + sc[i - 1].durationInFrames;
        const joinOut = i < sc.length - 1 && orig[sc[i + 1].id] !== orig[s.id] + s.durationInFrames;
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={`bgm ${s.id}`} layout="none">
            <Audio
              src={staticFile(`audio/bgm_${track}.mp3`)}
              trimBefore={orig[s.id]}
              volume={(f) =>
                duck(s.from + f) *
                (joinIn ? interpolate(f, [0, JOIN], [0, 1], clamp) : 1) *
                (joinOut ? interpolate(f, [s.durationInFrames - JOIN, s.durationInFrames], [1, 0], clamp) : 1)
              }
            />
          </Sequence>
        );
      })}
    </>
  );
};

const Sfx: React.FC<{ timeline: Timeline; lang: Lang }> = ({ timeline, lang }) => {
  const cues = useMemo(() => resolveCues(timeline, lang).filter((c) => hasStaticFile(`audio/sfx/${c.sfx}.wav`)), [timeline, lang]);
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

export type VFilmProps = { lang: Lang };

export const VerticalFilm: React.FC<VFilmProps> = ({ lang }) => {
  useFontsReady();
  const vt = useMemo(() => buildVTimeline(lang), [lang]);
  const { timeline } = vt;
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <VBackdrop />
      {timeline.scenes.map((s, i) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={s.id}>
          <VSceneShell scene={s} lang={lang} first={i === 0} last={i === timeline.scenes.length - 1} />
        </Sequence>
      ))}
      <VCaptions timeline={timeline} zh={lang === "zh"} />
      <VoiceTrack timeline={timeline} />
      {hasStaticFile(`audio/bgm_${lang}.mp3`) ? <BgmSegments vt={vt} track={lang} /> : null}
      <Sfx timeline={timeline} lang={lang} />
    </AbsoluteFill>
  );
};

export const calcVFilmMetadata: CalculateMetadataFunction<VFilmProps> = ({ props }) => {
  const { timeline } = buildVTimeline(props.lang);
  return { durationInFrames: timeline.durationInFrames, fps: FPS, defaultOutName: `vertical-${props.lang}` };
};

// ---- one vertical scene on its own (for building and reviewing scenes)
export type VScenePreviewProps = { sceneId: string; lang: Lang };

export const VScenePreview: React.FC<VScenePreviewProps> = ({ sceneId, lang }) => {
  useFontsReady();
  const { timeline } = useMemo(() => buildVTimeline(lang), [lang]);
  const s = timeline.scenes.find((x) => x.id === sceneId)!;
  const local: TimedScene = { ...s, from: 0 };
  const localTl: Timeline = { fps: timeline.fps, durationInFrames: s.durationInFrames, scenes: [local] };
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <VBackdrop />
      <VSceneShell scene={local} lang={lang} first last />
      <VCaptions timeline={localTl} zh={lang === "zh"} />
      {local.audio ? (
        <Sequence from={Math.max(0, local.audio.from)} durationInFrames={local.audio.durationInFrames} layout="none">
          <Audio src={staticFile(local.audio.src)} trimBefore={Math.max(0, -local.audio.from)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export const calcVSceneMetadata: CalculateMetadataFunction<VScenePreviewProps> = ({ props }) => {
  const { timeline } = buildVTimeline(props.lang);
  const s = timeline.scenes.find((x) => x.id === props.sceneId);
  return { durationInFrames: s ? s.durationInFrames : 30, fps: FPS };
};
