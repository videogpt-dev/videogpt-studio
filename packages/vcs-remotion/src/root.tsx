import { Composition } from "remotion";
import {
  CLIP_COMPOSITION_ID,
  ClipComposition,
  DEFAULT_CLIP_PROPS,
  calcMeta,
} from "./clip-composition.tsx";
import {
  CAPTIONED_COMPOSITION_ID,
  CaptionedComposition,
  DEFAULT_CAPTIONED_PROPS,
  captionedCalcMeta,
} from "./captioned-composition.tsx";
import {
  STORY_COMPOSITION_ID,
  StoryVideo,
  DEFAULT_STORY_PROPS,
  storyCalcMeta,
} from "./story-composition.tsx";

/**
 * Remotion root registered for the renderer (selectComposition/renderMedia).
 * Dimensions and duration are computed per-render from inputProps via
 * calculateMetadata, so one composition outputs any format/length.
 */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id={CLIP_COMPOSITION_ID}
        component={ClipComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_CLIP_PROPS}
        calculateMetadata={calcMeta}
      />
      <Composition
        id={CAPTIONED_COMPOSITION_ID}
        component={CaptionedComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_CAPTIONED_PROPS}
        calculateMetadata={captionedCalcMeta}
      />
      <Composition
        id={STORY_COMPOSITION_ID}
        component={StoryVideo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_STORY_PROPS}
        calculateMetadata={storyCalcMeta}
      />
    </>
  );
}
