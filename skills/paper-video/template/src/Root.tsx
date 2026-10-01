import { Composition, Folder, Still } from "remotion";
import { calcVFilmMetadata, calcVSceneMetadata, VerticalFilm, VScenePreview } from "./vertical/VerticalFilm";
import { VSCENES } from "./vertical/scenes/registry";
import { Cover, CoverBili, CoverV } from "./Cover";
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

      {/* vertical-native cuts (9:16, own scene layouts, same audio): src/vertical/, reference/vertical.md */}
      <Composition id={`${PREFIX}-V-ZH`} component={VerticalFilm} width={1080} height={1920} fps={30} durationInFrames={300} defaultProps={{ lang: "zh" as const }} calculateMetadata={calcVFilmMetadata} />
      <Composition id={`${PREFIX}-V-EN`} component={VerticalFilm} width={1080} height={1920} fps={30} durationInFrames={300} defaultProps={{ lang: "en" as const }} calculateMetadata={calcVFilmMetadata} />
      <Folder name="Vertical-scenes">
        {VSCENES.map((s) => (
          <Composition
            key={s.id}
            id={`V-${s.name}`}
            component={VScenePreview}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={300}
            defaultProps={{ sceneId: s.id, lang: "zh" as const }}
            calculateMetadata={calcVSceneMetadata}
          />
        ))}
      </Folder>

      <Folder name="Covers">
        <Still id="Cover-EN" component={Cover} width={1920} height={1080} defaultProps={{ lang: "en" as const }} />
        <Still id="Cover-ZH" component={Cover} width={1920} height={1080} defaultProps={{ lang: "zh" as const }} />
        <Still id="Cover-Bili" component={CoverBili} width={1920} height={1080} defaultProps={{ lang: "zh" as const }} />
        <Still id="Cover-Bili-Guides" component={CoverBili} width={1920} height={1080} defaultProps={{ lang: "zh" as const, guides: true }} />
        <Still id="Cover-ZH-3x4" component={CoverV} width={1080} height={1440} defaultProps={{ lang: "zh" as const }} />
        <Still id="Cover-ZH-9x16" component={CoverV} width={1080} height={1920} defaultProps={{ lang: "zh" as const }} />
        <Still id="Cover-EN-3x4" component={CoverV} width={1080} height={1440} defaultProps={{ lang: "en" as const }} />
      </Folder>
    </>
  );
};
