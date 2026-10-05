import { Composition } from "remotion";
import {
  CAPTIONED_COMPOSITION_ID,
  CaptionedComposition,
  DEFAULT_CAPTIONED_PROPS,
  captionedCalcMeta,
} from "./captioned-composition.tsx";
import {
  CLIP_COMPOSITION_ID,
  ClipComposition,
  DEFAULT_CLIP_PROPS,
  clipCalcMeta,
} from "./clip-composition.tsx";
import {
  DEFAULT_STORY_PROPS,
  STORY_COMPOSITION_ID,
  StoryVideo,
  storyCalcMeta,
} from "./story-composition.tsx";

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
        calculateMetadata={clipCalcMeta}
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
