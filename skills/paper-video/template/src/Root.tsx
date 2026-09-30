import { Composition, Folder, Still } from "remotion";
import { Cover, CoverV } from "./Cover";
import { SCENES } from "./scenes/registry";
import { calcVerticalMetadata, VerticalVideo } from "./Vertical";
import { calcSceneMetadata, calcVideoMetadata, MainVideo, ScenePreview, VideoProps } from "./Video";

/** Composition id prefix: VIDEO-EN, VIDEO-ZH, VIDEO-ZH-Vertical ... Rename once per project. */
export const PREFIX = "VIDEO";

const film = { component: MainVideo, width: 1920, height: 1080, fps: 30, durationInFrames: 300, calculateMetadata: calcVideoMetadata };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id={`${PREFIX}-EN`} {...film} defaultProps={{ lang: "en", mute: [] } satisfies VideoProps} />
      <Composition id={`${PREFIX}-ZH`} {...film} defaultProps={{ lang: "zh", mute: [] } satisfies VideoProps} />
      {/* more cuts: <Composition id={`${PREFIX}-EN-SHORT`} {...film} defaultProps={{ lang: "en", cut: "en-short" }} /> */}

      <Folder name="Scenes-EN">
        {SCENES.map((s) => (
          <Composition
            key={s.id}
            id={`EN-${s.name}`}
            component={ScenePreview}
            width={1920}
            height={1080}
            fps={30}
            durationInFrames={300}
            defaultProps={{ sceneId: s.id, lang: "en" as const }}
            calculateMetadata={calcSceneMetadata}
          />
        ))}
      </Folder>
      <Folder name="Scenes-ZH">
        {SCENES.map((s) => (
          <Composition
            key={s.id}
            id={`ZH-${s.name}`}
            component={ScenePreview}
            width={1920}
            height={1080}
            fps={30}
            durationInFrames={300}
            defaultProps={{ sceneId: s.id, lang: "zh" as const }}
            calculateMetadata={calcSceneMetadata}
          />
        ))}
      </Folder>

      <Composition
        id={`${PREFIX}-Vertical`}
        component={VerticalVideo}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={300}
        calculateMetadata={calcVerticalMetadata}
      />

      <Folder name="Covers">
        <Still id="Cover-EN" component={Cover} width={1920} height={1080} defaultProps={{ lang: "en" as const }} />
        <Still id="Cover-ZH" component={Cover} width={1920} height={1080} defaultProps={{ lang: "zh" as const }} />
        <Still id="Cover-ZH-3x4" component={CoverV} width={1080} height={1440} defaultProps={{ lang: "zh" as const }} />
        <Still id="Cover-ZH-9x16" component={CoverV} width={1080} height={1920} defaultProps={{ lang: "zh" as const }} />
        <Still id="Cover-EN-3x4" component={CoverV} width={1080} height={1440} defaultProps={{ lang: "en" as const }} />
      </Folder>
    </>
  );
};
