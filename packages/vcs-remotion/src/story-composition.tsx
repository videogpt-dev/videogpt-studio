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

/**
 * A generated (AI video-gen) scene: a still image with a Ken Burns move, its own
 * voiceover audio, and word-level caption timing. `seconds` is authoritative (the
 * backend sets it from the real voiceover length) so picture and audio stay in
 * step. `words` carry times relative to this scene's audio.
 */
export type StoryScene = {
  image: string;
  /** Generated AI video clip (Video Mode). When present it plays instead of the
   *  Ken Burns still. */
  video?: string;
  /** The clip's own length. Video is bought by the second and capped, so a clip is
   *  usually shorter than its scene and loops to fill it. */
  video_seconds?: number;
  /** Play audio embedded in generated clip instead of separate voiceover. */
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
  /** Highlight each word as it is spoken (karaoke) instead of a plain line. */
  karaoke?: boolean;
  /** Caption emphasis color (whole line when plain; active word when karaoke). */
  captionColor?: string;
  /** Caption size multiplier over the default (1 = default). */
  captionScale?: number;
  /** Silent hold after each scene's voiceover, in seconds (breathing room). */
  sceneGap?: number;
  music?: string;
  musicVolume?: number;
};

const DEFAULT_CAPTION_COLOR = "#FFD84D";
const DEFAULT_SCENE_GAP = 0.5;

export const STORY_COMPOSITION_ID = "StoryVideo";

const cover = { width: "100%", height: "100%", objectFit: "cover" as const };

function sceneFrames(seconds: number, gap: number, fps: number): number {
  return Math.max(1, Math.round(((seconds || 1) + Math.max(0, gap)) * fps));
}

type CaptionLine = { words: CaptionWord[]; start: number; end: number };

/** Group words into lines that fit one line at the given width (dynamic, not a
 * fixed word count), short words pack more per line, long words fewer. */
function buildLines(words: CaptionWord[], maxChars: number): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let cur: CaptionWord[] = [];
  let len = 0;
  for (const w of words) {
    const word = (w.word || "").trim();
    if (!word) continue;
    const candidate = cur.length ? len + 1 + word.length : word.length;
    if (cur.length && candidate > maxChars) {
      lines.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
      cur = [{ ...w, word }];
      len = word.length;
    } else {
      cur.push({ ...w, word });
      len = candidate;
    }
  }
  if (cur.length) lines.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
  return lines;
}

/** Word-timed captions: one fitted line at a time, optionally karaoke-highlighted.
 * Uses a text outline (no solid box) so the image stays visible behind it. */
function SceneCaptions({
  words,
  fps,
  karaoke,
  color,
  scale,
}: {
  words: CaptionWord[];
  fps: number;
  karaoke: boolean;
  color: string;
  scale: number;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / fps;

  const fontSize = Math.round(height * 0.052 * (scale || 1));
  // Rough average glyph width for a bold sans face; enough to fit one line.
  const maxChars = Math.max(8, Math.floor((width * 0.86) / (fontSize * 0.52)));
  const lines = useMemo(() => buildLines(words, maxChars), [words, maxChars]);

  // The most recently started line stays until the next one begins (no flicker).
  let active: CaptionLine | undefined;
  for (const ln of lines) {
    if (ln.start <= t) active = ln;
    else break;
  }
  if (!active) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: `0 ${width * 0.07}px ${height * 0.12}px`,
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
        {active.words.map((w, i) => {
          const spoken = t >= w.end;
          const speaking = t >= w.start && t < w.end;
          const wordColor = !karaoke
            ? color
            : speaking
              ? color
              : spoken
                ? "#fff"
                : "rgba(255,255,255,0.55)";
          return (
            <span key={i} style={{ color: wordColor }}>
              {i > 0 ? " " : ""}
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// A darkened frame edge draws the eye to the centre and hides the tell-tale even
// lighting of a generated still. Static, so it also visually ties the cuts together.
const VIGNETTE = "radial-gradient(125% 120% at 50% 45%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.4) 100%)";

/** Animated film grain over the picture. Grain is the single strongest cue that
 * separates "photo" from "footage"; the same layer on every scene also makes the
 * stills feel shot on one camera rather than assembled from separate renders. */
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

/** One still with a slow zoom (Ken Burns), its voiceover, and its captions. */
function SceneClip({
  scene,
  index,
  fps,
  showCaptions,
  karaoke,
  captionColor,
  captionScale,
}: {
  scene: StoryScene;
  index: number;
  fps: number;
  showCaptions: boolean;
  karaoke: boolean;
  captionColor: string;
  captionScale: number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // How much clip there actually is. Older projects recorded no length, and theirs runs
  // the whole scene, which is what it did before there was a cap to loop under.
  const clipFrames = scene.video_seconds
    ? Math.max(1, Math.round(scene.video_seconds * fps))
    : durationInFrames;
  // Alternate zoom-in / zoom-out per scene so consecutive stills don't feel static.
  const zoomIn = index % 2 === 0;
  const from = zoomIn ? 1.05 : 1.14;
  const to = zoomIn ? 1.14 : 1.05;
  const scale = interpolate(frame, [0, durationInFrames], [from, to], {
    extrapolateRight: "clamp",
  });
  // A gentle handheld pan (alternating direction) on top of the zoom, so a still
  // reads as filmed footage rather than a flat slideshow. Kept under the overscan
  // (min scale 1.05, about 2.5% margin per side) so no black edge is ever revealed.
  const panX = interpolate(
    frame,
    [0, durationInFrames],
    [zoomIn ? -1.8 : 1.8, zoomIn ? 1.8 : -1.8],
    {
      extrapolateRight: "clamp",
    });
  const panY = interpolate(frame, [0, durationInFrames], [1.2, -1.2], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      {/* Video Mode: play the generated clip (already in motion, no Ken Burns).
          Otherwise animate the still with a zoom + gentle pan. */}
      {scene.video ? (
        // Clips are bought by the second and capped, so one is usually shorter than the
        // narration it plays under. Loop fills the rest of the scene with it; without
        // that the frame goes black the moment the clip runs out. Voiceover scenes mute
        // clip audio; native-audio scenes play the clip once with its own synchronized sound.
        scene.video_audio ? (
          <OffthreadVideo src={scene.video} style={cover} />
        ) : (
          <Loop durationInFrames={clipFrames}>
            <OffthreadVideo src={scene.video} style={cover} muted />
          </Loop>
        )
      ) : (
        <Img
          src={scene.image}
          style={{ ...cover, transform: `scale(${scale}) translate(${panX}%, ${panY}%)` }}
        />
      )}
      {/* Grade the picture (grain + vignette) before captions so text stays crisp on top. */}
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
  sceneGap = DEFAULT_SCENE_GAP,
  music,
  musicVolume = 0.18,
}: StoryVideoProps) {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenes.map((scene, i) => {
        const frames = sceneFrames(scene.seconds, sceneGap, fps);
        const from = cursor;
        cursor += frames;
        return (
          <Sequence key={i} from={from} durationInFrames={frames}>
            <SceneClip
              scene={scene}
              index={i}
              fps={fps}
              showCaptions={showCaptions}
              karaoke={karaoke}
              captionColor={captionColor}
              captionScale={captionScale}
            />
          </Sequence>
        );
      })}
      {music ? <Audio src={music} volume={musicVolume} loop /> : null}
    </AbsoluteFill>
  );
}

/** Total duration = sum of the scenes' frames; dimensions from inputProps. */
export const storyCalcMeta: CalculateMetadataFunction<StoryVideoProps> = ({ props }) => {
  const gap = props.sceneGap ?? DEFAULT_SCENE_GAP;
  const total = (props.scenes || []).reduce(
    (sum, s) => sum + sceneFrames(s.seconds, gap, props.fps),
    0);
  return {
    durationInFrames: Math.max(1, total),
    fps: props.fps,
    width: props.width,
    height: props.height,
  };
};

export const DEFAULT_STORY_PROPS: StoryVideoProps = {
  scenes: [],
  fps: 30,
  width: 1080,
  height: 1920,
  showCaptions: true,
  karaoke: false,
  captionColor: DEFAULT_CAPTION_COLOR,
  captionScale: 1,
  sceneGap: DEFAULT_SCENE_GAP,
};
