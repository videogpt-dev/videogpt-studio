import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  type CalculateMetadataFunction,
  Img,
  Loop,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CaptionWord } from "./captions.ts";

export type StoryScene = {
  image: string;
  video?: string;
  video_seconds?: number;
  video_audio?: boolean;
  audio?: string;
  seconds: number;
  words: CaptionWord[];
};

export type StoryVideoProps = {
  scenes: StoryScene[];
  fps: number;
  width: number;
  height: number;
  showCaptions: boolean;
  karaoke?: boolean;
  captionColor?: string;
  captionScale?: number;
  captionPosition?: CaptionPosition;
  sceneGap?: number;
  music?: string;
  musicVolume?: number;
};

export const CAPTION_POSITIONS = ["bottom", "middle", "top"] as const;
export type CaptionPosition = (typeof CAPTION_POSITIONS)[number];

export class CaptionPlacement {
  static of(value: unknown): CaptionPosition | undefined {
    return CAPTION_POSITIONS.find((position) => position === value);
  }
}

export const STORY_COMPOSITION_ID = "StoryVideo";

const DEFAULT_CAPTION_COLOR = "#FFD84D";
const DEFAULT_SCENE_GAP = 0.5;
const VIGNETTE = "radial-gradient(125% 120% at 50% 45%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.4) 100%)";
const COVER = { width: "100%", height: "100%", objectFit: "cover" as const };

export const DEFAULT_STORY_PROPS: StoryVideoProps = {
  scenes: [],
  fps: 30,
  width: 1080,
  height: 1920,
  showCaptions: true,
  karaoke: false,
  captionColor: DEFAULT_CAPTION_COLOR,
  captionScale: 1,
  captionPosition: "bottom",
  sceneGap: DEFAULT_SCENE_GAP,
};

type CaptionLine = { words: CaptionWord[]; start: number; end: number };

class StoryTimeline {
  static sceneFrames(seconds: number, gap: number, fps: number): number {
    return Math.max(1, Math.round(((seconds || 1) + Math.max(0, gap)) * fps));
  }

  static totalFrames(props: StoryVideoProps): number {
    const gap = props.sceneGap ?? DEFAULT_SCENE_GAP;
    return (props.scenes || []).reduce(
      (sum, scene) => sum + StoryTimeline.sceneFrames(scene.seconds, gap, props.fps),
      0,
    );
  }
}

class CaptionLines {
  static build(words: CaptionWord[], maxChars: number): CaptionLine[] {
    const lines: CaptionLine[] = [];
    let current: CaptionWord[] = [];
    let length = 0;
    for (const entry of words) {
      const word = (entry.word || "").trim();
      if (!word) continue;
      const candidate = current.length ? length + 1 + word.length : word.length;
      if (current.length && candidate > maxChars) {
        lines.push(CaptionLines.line(current));
        current = [{ ...entry, word }];
        length = word.length;
      } else {
        current.push({ ...entry, word });
        length = candidate;
      }
    }
    if (current.length) lines.push(CaptionLines.line(current));
    return lines;
  }

  static activeAt(lines: CaptionLine[], seconds: number): CaptionLine | undefined {
    let active: CaptionLine | undefined;
    for (const line of lines) {
      if (line.start > seconds) break;
      active = line;
    }
    return active;
  }

  private static line(words: CaptionWord[]): CaptionLine {
    return { words, start: words[0].start, end: words[words.length - 1].end };
  }
}

/** Keeps captions clear of the chrome Shorts, Reels and TikTok draw over a vertical frame:
 *  the caption, buttons and progress bar along the bottom, the action rail on the right, the
 *  header on top. Landscape frames have little overlay and keep slim margins. */
class CaptionSafeArea {
  static insets(position: CaptionPosition, width: number, height: number) {
    const vertical = height > width;
    return {
      left: width * 0.07,
      right: width * (vertical ? 0.15 : 0.07),
      top: position === "top" ? height * (vertical ? 0.16 : 0.08) : 0,
      bottom: position === "bottom" ? height * (vertical ? 0.24 : 0.12) : 0,
    };
  }

  static justify(position: CaptionPosition): "flex-start" | "center" | "flex-end" {
    return position === "top" ? "flex-start" : position === "middle" ? "center" : "flex-end";
  }
}

function SceneCaptions({
  words,
  fps,
  karaoke,
  color,
  scale,
  position,
}: {
  words: CaptionWord[];
  fps: number;
  karaoke: boolean;
  color: string;
  scale: number;
  position: CaptionPosition;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const seconds = frame / fps;
  const fontSize = Math.round(height * 0.052 * (scale || 1));
  const inset = CaptionSafeArea.insets(position, width, height);
  const lineWidth = width - inset.left - inset.right;
  const maxChars = Math.max(8, Math.floor(lineWidth / (fontSize * 0.52)));
  const lines = useMemo(() => CaptionLines.build(words, maxChars), [words, maxChars]);
  const active = CaptionLines.activeAt(lines, seconds);
  if (!active) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: CaptionSafeArea.justify(position),
        alignItems: "center",
        padding: `${inset.top}px ${inset.right}px ${inset.bottom}px ${inset.left}px`,
      }}
    >
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize,
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: "center",
          textShadow: "0 3px 10px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95)",
          WebkitTextStroke: `${Math.max(1, Math.round(fontSize * 0.03))}px rgba(0,0,0,0.85)`,
        }}
      >
        {active.words.map((word, index) => {
          const spoken = seconds >= word.end;
          const speaking = seconds >= word.start && seconds < word.end;
          const wordColor =
            !karaoke || speaking ? color : spoken ? "#fff" : "rgba(255,255,255,0.55)";
          return (
            <span key={index} style={{ color: wordColor }}>
              {index > 0 ? " " : ""}
              {word.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function FilmGrain() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={frame % 12}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}

function SceneClip({
  scene,
  index,
  fps,
  showCaptions,
  karaoke,
  captionColor,
  captionScale,
  captionPosition,
}: {
  scene: StoryScene;
  index: number;
  fps: number;
  showCaptions: boolean;
  karaoke: boolean;
  captionColor: string;
  captionScale: number;
  captionPosition: CaptionPosition;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const clipFrames = scene.video_seconds
    ? Math.max(1, Math.round(scene.video_seconds * fps))
    : durationInFrames;
  const zoomIn = index % 2 === 0;
  const range = [0, durationInFrames];
  const clamp = { extrapolateRight: "clamp" } as const;
  const scale = interpolate(frame, range, zoomIn ? [1.05, 1.14] : [1.14, 1.05], clamp);
  const panX = interpolate(frame, range, zoomIn ? [-1.8, 1.8] : [1.8, -1.8], clamp);
  const panY = interpolate(frame, range, [1.2, -1.2], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      {scene.video ? (
        scene.video_audio ? (
          <OffthreadVideo src={scene.video} style={COVER} />
        ) : (
          <Loop durationInFrames={clipFrames}>
            <OffthreadVideo src={scene.video} style={COVER} muted />
          </Loop>
        )
      ) : (
        <Img
          src={scene.image}
          style={{ ...COVER, transform: `scale(${scale}) translate(${panX}%, ${panY}%)` }}
        />
      )}
      <AbsoluteFill style={{ background: VIGNETTE, pointerEvents: "none" }} />
      <FilmGrain />
      {scene.audio ? <Audio src={scene.audio} /> : null}
      {showCaptions && (scene.words || []).length ? (
        <SceneCaptions
          words={scene.words}
          fps={fps}
          karaoke={karaoke}
          color={captionColor}
          scale={captionScale}
          position={captionPosition}
        />
      ) : null}
    </AbsoluteFill>
  );
}

export function StoryVideo({
  scenes,
  fps,
  showCaptions,
  karaoke = false,
  captionColor = DEFAULT_CAPTION_COLOR,
  captionScale = 1,
  captionPosition = "bottom",
  sceneGap = DEFAULT_SCENE_GAP,
  music,
  musicVolume = 0.18,
}: StoryVideoProps) {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenes.map((scene, index) => {
        const frames = StoryTimeline.sceneFrames(scene.seconds, sceneGap, fps);
        const from = cursor;
        cursor += frames;
        return (
          <Sequence key={index} from={from} durationInFrames={frames}>
            <SceneClip
              scene={scene}
              index={index}
              fps={fps}
              showCaptions={showCaptions}
              karaoke={karaoke}
              captionColor={captionColor}
              captionScale={captionScale}
              captionPosition={captionPosition}
            />
          </Sequence>
        );
      })}
      {music ? <Audio src={music} volume={musicVolume} loop /> : null}
    </AbsoluteFill>
  );
}

export const storyCalcMeta: CalculateMetadataFunction<StoryVideoProps> = ({ props }) => ({
  durationInFrames: Math.max(1, StoryTimeline.totalFrames(props)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});
