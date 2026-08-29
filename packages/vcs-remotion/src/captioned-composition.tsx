import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  OffthreadVideo,
  Video,
  getRemotionEnvironment,
} from "remotion";
import type { Caption } from "./captions.ts";
import { CaptionOverlay } from "./clip-composition.tsx";

/**
 * inputProps for the <Captioned> composition: burns captions onto an
 * already-cut base clip. No crop/trim here — the base mp4 is the final framing,
 * so this just plays it whole and overlays the caption track. `inSec` is the
 * base clip's absolute start in the source, used to line captions (which carry
 * source-absolute times) up with the clip.
 */
export type CaptionedProps = {
  src: string;
  fps: number;
  width: number;
  height: number;
  inSec: number;
  durationSec: number;
  captions: Caption[];
};

export const CAPTIONED_COMPOSITION_ID = "Captioned";

const fill: CSSProperties = { width: "100%", height: "100%" };

/** Base clip + caption overlay (the "captioned" variant). */
export function CaptionedComposition(props: CaptionedProps) {
  const { src, inSec, fps, captions } = props;
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      {getRemotionEnvironment().isRendering ? (
        <OffthreadVideo src={src} style={fill} />
      ) : (
        <Video src={src} style={fill} pauseWhenBuffering />
      )}
      <CaptionOverlay captions={captions} inSec={inSec} fps={fps} />
    </AbsoluteFill>
  );
}

/** Duration/dimensions come from the base clip (passed in inputProps). */
export const captionedCalcMeta: CalculateMetadataFunction<CaptionedProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.durationSec * props.fps)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

export const DEFAULT_CAPTIONED_PROPS: CaptionedProps = {
  src: "",
  fps: 30,
  width: 1080,
  height: 1920,
  inSec: 0,
  durationSec: 10,
  captions: [],
};
