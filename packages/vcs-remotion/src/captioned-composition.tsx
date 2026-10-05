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

export const DEFAULT_CAPTIONED_PROPS: CaptionedProps = {
  src: "",
  fps: 30,
  width: 1080,
  height: 1920,
  inSec: 0,
  durationSec: 10,
  captions: [],
};

const fill: CSSProperties = { width: "100%", height: "100%" };

export function CaptionedComposition({ src, inSec, fps, captions }: CaptionedProps) {
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

export const captionedCalcMeta: CalculateMetadataFunction<CaptionedProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.durationSec * props.fps)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});
