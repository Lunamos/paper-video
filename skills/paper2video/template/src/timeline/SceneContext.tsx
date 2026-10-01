import React, { createContext, useContext } from "react";
import type { Lang } from "../theme";
import type { TimedScene } from "./timeline";

// Per-scene context. Scene components never compute timing themselves: they ask for anchors (frames, relative to the
// scene start, of the word named in scenes.json `anchors`) and animate against them, so re-recording the voice
// re-times every beat automatically.
// lang: on-screen text language; cut: which voice track this render uses (defaults to lang)
type Ctx = { scene: TimedScene; lang: Lang; cut?: string };
const SceneCtx = createContext<Ctx | null>(null);

export const SceneProvider: React.FC<{ scene: TimedScene; lang: Lang; cut?: string; children: React.ReactNode }> = ({
  scene,
  lang,
  cut,
  children,
}) => <SceneCtx.Provider value={{ scene, lang, cut }}>{children}</SceneCtx.Provider>;

export const useScene = () => {
  const c = useContext(SceneCtx);
  if (!c) throw new Error("useScene() outside <SceneProvider>");
  return c;
};

/** Frame (relative to scene start) where the anchor word starts. `fallback` is used if the anchor is missing. */
export const useAnchor = (name: string, fallback = 0): number => {
  const { scene } = useScene();
  for (const l of scene.lines) {
    if (name in l.anchors) return l.anchors[name];
  }
  return fallback;
};

/** All anchors of the scene as a map name -> frame (relative to scene start). */
export const useAnchors = (): Record<string, number> => {
  const { scene } = useScene();
  return Object.assign({}, ...scene.lines.map((l) => l.anchors));
};

/** Start frame + duration of a VO line (relative to scene start). */
export const useLine = (id: string) => {
  const { scene } = useScene();
  const l = scene.lines.find((x) => x.id === id);
  return l ? { from: l.from, to: l.from + l.durationInFrames, durationInFrames: l.durationInFrames } : { from: 0, to: 0, durationInFrames: 0 };
};

export const useSceneDuration = () => useScene().scene.durationInFrames;
/** The current chapter name (from vo JSON `chapter`), if any. */
export const useChapter = () => useScene().scene.chapter;
export const useLang = () => useScene().lang;
export const useCut = () => {
  const { cut, lang } = useScene();
  return cut ?? lang;
};
