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
import type { Caption } from "./captions.ts";

/** A crop rectangle as fractions of the source frame (0..1). */
export type Crop = { x: number; y: number; w: number; h: number };

/**
 * inputProps for the <Clip> composition (used by the Player preview + renderer).
 *
 * A `type` (not `interface`) so it gets an implicit index signature and thus
 * satisfies Remotion's `Record<string, unknown>` props constraint.
 */
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
  /** Free crop rectangle (fractions of source). Takes precedence over `cropX`. */
  crop?: Crop;
  /** Legacy horizontal crop focus (0..1); used only when `crop` is absent. */
  cropX?: number;
};

/** The aspect-ratio formats the Clip composition can output. Single source for
 *  any picker so the UI never hardcodes its own list. */
export const CLIP_FORMATS = ["9:16", "1:1", "16:9"] as const;
export type ClipFormat = (typeof CLIP_FORMATS)[number];

/** Target pixel dimensions for an aspect-ratio format string. */
export function formatDims(format: string): { width: number; height: number } {
  switch (format) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const evenRound = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** The largest crop of `aspect` (w/h) centered in a `srcW × srcH` source. */
export function centeredCrop(aspect: number, srcW: number, srcH: number): Crop {
  const srcAspect = srcW / srcH;
  if (aspect <= srcAspect) {
    const w = aspect / srcAspect; // full height, narrower width
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = srcAspect / aspect; // full width, shorter height
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

export function cropForFormat(format: string, srcW: number, srcH: number): Crop {
  const { width, height } = formatDims(format);
  return centeredCrop(width / height, srcW, srcH);
}

/** Resolve the effective crop: explicit `crop`, else legacy `cropX`, else format-centered. */
export function resolveCrop(props: ClipProps): Crop {
  if (props.crop) {
    const { x, y, w, h } = props.crop;
    return { x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) };
  }
  const base = cropForFormat(props.format, props.srcWidth, props.srcHeight);
  if (props.cropX != null) {
    base.x = clamp01(props.cropX) * (1 - base.w); // slide the legacy vertical slice
  }
  return base;
}

/** Even output pixel dimensions for a crop of a given source (h264-safe). */
export function cropDims(crop: Crop, srcW: number, srcH: number): { width: number; height: number } {
  return { width: evenRound(crop.w * srcW), height: evenRound(crop.h * srcH) };
}

export function durationInFrames(inSec: number, outSec: number, fps: number): number {
  return Math.max(1, Math.round((outSec - inSec) * fps));
}

/** Transcript segments overlapping [inSec, outSec] (absolute times kept). */
export function captionsFor(transcript: Caption[], inSec: number, outSec: number): Caption[] {
  return transcript.filter((c) => c.end > inSec && c.start < outSec);
}

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
  const t = inSec + frame / fps;
  // Prefer the most recently-started caption still on screen. Transcripts use a
  // sliding window, so several segments overlap; taking the first match would keep
  // an older segment up after a newer one has begun — captions trailing the audio.
  let active: Caption | undefined;
  for (const c of captions) {
    if (t >= c.start && t <= c.end && (!active || c.start > active.start)) active = c;
  }
  if (!active || !active.text.trim()) return null;
  // Scale caption typography to the output height so it reads well at any crop size.
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

/** The single composition: a free-rectangle crop of the source with captions. */
export function ClipComposition(props: ClipProps) {
  const { src, inSec, outSec, fps, captions, showCaptions } = props;
  const { x, y, w, h } = resolveCrop(props);

  // Show only the crop sub-rect: the composition equals the crop, so the full
  // source is sized 1/w × 1/h of the frame and offset by -(x/w, y/h). The crop
  // and composition share an aspect ratio ⇒ uniform native-scale pan (no
  // distortion, no oversized layer → safe in the <Video> Player).
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

  // OffthreadVideo is frame-exact for the headless renderer (but a black frame in
  // the browser <Player>). The Player uses a plain HTML5 <Video> with
  // pauseWhenBuffering so its clock waits for the media instead of running ahead
  // (otherwise the timeline keeps moving while picture/sound stall on long sources).
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

/** Lets the renderer derive dimensions/duration/fps from inputProps. */
export const calcMeta: CalculateMetadataFunction<ClipProps> = ({ props }) => {
  const { width, height } = cropDims(resolveCrop(props), props.srcWidth, props.srcHeight);
  return {
    durationInFrames: durationInFrames(props.inSec, props.outSec, props.fps),
    fps: props.fps,
    width,
    height,
  };
};

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

/** Composition id shared by the renderer (selectComposition) and registration. */
export const CLIP_COMPOSITION_ID = "Clip";
