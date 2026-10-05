import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  OffthreadVideo,
  Video,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type Caption, CaptionTrack } from "./captions.ts";
import { ClipGeometry, type Crop } from "./geometry.ts";

export type ClipProps = {
  src: string;
  inSec: number;
  outSec: number;
  fps: number;
  srcWidth: number;
  srcHeight: number;
  format: string;
  captions: Caption[];
  showCaptions: boolean;
  crop?: Crop;
  cropX?: number;
};

export const CLIP_COMPOSITION_ID = "Clip";

export const DEFAULT_CLIP_PROPS: ClipProps = {
  src: "",
  inSec: 0,
  outSec: 10,
  fps: 30,
  srcWidth: 1920,
  srcHeight: 1080,
  format: "9:16",
  captions: [],
  showCaptions: true,
  crop: { x: 0.25, y: 0, w: 0.5, h: 1 },
};

export function CaptionOverlay({
  captions,
  inSec,
  fps,
}: {
  captions: Caption[];
  inSec: number;
  fps: number;
}) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const active = CaptionTrack.activeAt(captions, inSec + frame / fps);
  if (!active || !active.text.trim()) return null;
  const fontSize = Math.round(height * 0.05);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: `0 ${height * 0.06}px ${height * 0.08}px`,
      }}
    >
      <span
        style={{
          color: "white",
          fontFamily: "sans-serif",
          fontSize,
          fontWeight: 800,
          lineHeight: 1.2,
          textAlign: "center",
          textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          background: "rgba(0,0,0,0.35)",
          padding: `${fontSize * 0.18}px ${fontSize * 0.4}px`,
          borderRadius: fontSize * 0.25,
          maxWidth: "90%",
        }}
      >
        {active.text}
      </span>
    </AbsoluteFill>
  );
}

export function ClipComposition(props: ClipProps) {
  const { src, inSec, outSec, fps, captions, showCaptions } = props;
  const { x, y, w, h } = ClipGeometry.resolveCrop(props);
  const startFrom = Math.round(inSec * fps);
  const endAt = Math.round(outSec * fps);
  const style: CSSProperties = {
    position: "absolute",
    width: `${(1 / w) * 100}%`,
    height: `${(1 / h) * 100}%`,
    left: `${-(x / w) * 100}%`,
    top: `${-(y / h) * 100}%`,
    maxWidth: "none",
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      {getRemotionEnvironment().isRendering ? (
        <OffthreadVideo src={src} startFrom={startFrom} endAt={endAt} style={style} />
      ) : (
        <Video src={src} startFrom={startFrom} endAt={endAt} style={style} pauseWhenBuffering />
      )}
      {showCaptions ? <CaptionOverlay captions={captions} inSec={inSec} fps={fps} /> : null}
    </AbsoluteFill>
  );
}

export const clipCalcMeta: CalculateMetadataFunction<ClipProps> = ({ props }) => {
  const { width, height } = ClipGeometry.cropDims(
    ClipGeometry.resolveCrop(props),
    props.srcWidth,
    props.srcHeight,
  );
  return {
    durationInFrames: ClipGeometry.durationInFrames(props.inSec, props.outSec, props.fps),
    fps: props.fps,
    width,
    height,
  };
};
