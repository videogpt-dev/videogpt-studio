import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  CLIP_COMPOSITION_ID,
  type ClipProps,
  cropDims,
  formatDims,
  parseEditDoc,
  resolveCrop,
  STORY_COMPOSITION_ID,
  type StoryScene,
  type StoryVideoProps,
} from "@vcs/remotion";
import type { RenderDriver, RenderJob } from "./driver.ts";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const evenFloor = (n: number) => Math.max(0, Math.floor(n / 2) * 2);

// Mirror the Remotion story composition's timing + grade so the fast lane stays a
// close visual match (not byte-identical — that is the parity contract's Remotion lane).
const DEFAULT_SCENE_GAP = 0.5;
const DEFAULT_MUSIC_VOLUME = 0.18;
// Upscale the still before zoompan so the Ken Burns move samples from extra pixels
// instead of blurring — base zoom is this factor (crop window = input / Q = canvas).
const KB_UPSCALE = 2;

const sceneDurationSec = (scene: StoryScene, gap: number): number =>
  (scene.seconds || 1) + Math.max(0, gap);

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`)),
    );
  });
}

/**
 * The fast render lane: a straight ffmpeg trim + crop/scale-to-format, no
 * headless Chromium. It shares the composition's own crop math (resolveCrop /
 * cropDims / formatDims) so the output is pixel-parity with the Remotion Player
 * preview. Anything composited (burned captions, rich layers, story assembly)
 * is NOT expressible here and routes to Remotion — see SmartDriver.
 */
export class FfmpegDriver implements RenderDriver {
  /** True only for a plain Clip cut with no burned captions (parity-safe for ffmpeg). */
  static supports(job: RenderJob): boolean {
    if (job.compositionId !== CLIP_COMPOSITION_ID) return false;
    const p = job.inputProps as Partial<ClipProps>;
    return !(p.showCaptions && (p.captions?.length ?? 0) > 0);
  }

  /** A story with no burned captions: ffmpeg reproduces the Ken Burns + grain +
   *  vignette grade closely (not byte-identical). Any caption text routes to Remotion,
   *  whose per-word timing/karaoke ffmpeg cannot match pixel-for-pixel. */
  static supportsStory(job: RenderJob): boolean {
    if (job.compositionId !== STORY_COMPOSITION_ID) return false;
    const p = job.inputProps as Partial<StoryVideoProps>;
    if (p.showCaptions === false) return true;
    return !(p.scenes || []).some((s) => (s.words?.length ?? 0) > 0);
  }

  async render(job: RenderJob, outputLocation: string): Promise<void> {
    const { compositionId, inputProps } = parseEditDoc(job.compositionId, job.inputProps);
    if (compositionId === STORY_COMPOSITION_ID) {
      return this.renderStory(inputProps as StoryVideoProps, outputLocation);
    }
    const p = inputProps as ClipProps;
    const crop = resolveCrop(p);
    const { width: cw, height: ch } = cropDims(crop, p.srcWidth, p.srcHeight);
    const cx = evenFloor(crop.x * p.srcWidth);
    const cy = evenFloor(crop.y * p.srcHeight);
    const { width: fw, height: fh } = formatDims(p.format);
    const duration = Math.max(0.001, p.outSec - p.inSec);
    const vf = `crop=${cw}:${ch}:${cx}:${cy},scale=${fw}:${fh}`;
    await run(FFMPEG, [
      "-y",
      "-ss",
      String(p.inSec),
      "-i",
      p.src,
      "-t",
      String(duration),
      "-filter:v",
      vf,
      "-r",
      String(p.fps),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputLocation,
    ]);
  }

  /**
   * Captionless story render without Chromium: each scene becomes a self-contained
   * segment (Ken Burns still or looped/held clip, vignette + film grain, its own audio
   * padded to the scene+gap length), the segments concat, then a looped music bed mixes
   * over the whole. Minutes of Remotion frame-painting collapse to a few ffmpeg passes.
   */
  private async renderStory(props: StoryVideoProps, outputLocation: string): Promise<void> {
    const fps = props.fps;
    const width = evenFloor(props.width);
    const height = evenFloor(props.height);
    const gap = typeof props.sceneGap === "number" ? props.sceneGap : DEFAULT_SCENE_GAP;
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "story-"));
    try {
      const segments: string[] = [];
      for (let i = 0; i < props.scenes.length; i++) {
        const seg = path.join(work, `seg_${i}.mp4`);
        await this.renderScene(props.scenes[i], i, width, height, fps, gap, seg);
        segments.push(seg);
      }

      const joined = props.music ? path.join(work, "joined.mp4") : outputLocation;
      const listFile = path.join(work, "concat.txt");
      fs.writeFileSync(listFile, segments.map((s) => `file '${s}'`).join("\n"));
      await run(FFMPEG, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        joined,
      ]);

      if (props.music) {
        const volume = typeof props.musicVolume === "number" ? props.musicVolume : DEFAULT_MUSIC_VOLUME;
        await run(FFMPEG, [
          "-y",
          "-i",
          joined,
          "-stream_loop",
          "-1",
          "-i",
          props.music,
          "-filter_complex",
          `[1:a]volume=${volume}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]`,
          "-map",
          "0:v",
          "-map",
          "[a]",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-shortest",
          "-movflags",
          "+faststart",
          outputLocation,
        ]);
      }
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }

  /** One scene as a standalone segment: video (Ken Burns still or clip) + graded overlays
   *  + an audio track padded to the exact scene length so the concat lines up. */
  private async renderScene(
    scene: StoryScene,
    index: number,
    width: number,
    height: number,
    fps: number,
    gap: number,
    segPath: string,
  ): Promise<void> {
    const dur = sceneDurationSec(scene, gap);
    const frames = Math.max(1, Math.round(dur * fps));
    const grade = `vignette=PI/5,noise=alls=8:allf=t,format=yuv420p`;

    const inputs: string[] = [];
    let videoChain: string;
    let audioLabel: string; // the [n:a] the audio chain reads from
    let loopClip = false;

    if (scene.video) {
      inputs.push("-i", scene.video);
      if (scene.video_audio) {
        // Native-audio clip: play once, clone the last frame to fill the scene, keep its sound.
        videoChain = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},tpad=stop_mode=clone:stop_duration=${dur},${grade}[v]`;
        audioLabel = "0:a";
      } else {
        // Voiceover clip: loop it muted to fill the scene; the voiceover is a separate track.
        loopClip = true;
        videoChain = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},${grade}[v]`;
        audioLabel = "";
      }
    } else {
      // Still: Ken Burns (alternating zoom-in / zoom-out + a gentle drift), matching the
      // composition. Upscale first so the zoom samples real pixels instead of blurring.
      if (!scene.image) throw new Error(`scene ${index + 1} has no image or clip to render`);
      inputs.push("-loop", "1", "-i", scene.image);
      const zoomIn = index % 2 === 0;
      const z0 = zoomIn ? 1.05 : 1.14;
      const z1 = zoomIn ? 1.14 : 1.05;
      const pxs = zoomIn ? -1.8 : 1.8;
      const pxe = zoomIn ? 1.8 : -1.8;
      const pys = 1.2;
      const pye = -1.2;
      const d = Math.max(1, frames - 1);
      const q = KB_UPSCALE;
      const z = `${q}*(${z0}+(${(z1 - z0).toFixed(5)})*on/${d})`;
      const x = `(iw-iw/zoom)/2+((${pxs})+(${(pxe - pxs).toFixed(5)})*on/${d})/100*iw/${q}`;
      const y = `(ih-ih/zoom)/2+((${pys})+(${(pye - pys).toFixed(5)})*on/${d})/100*ih/${q}`;
      videoChain =
        `[0:v]scale=${width * KB_UPSCALE}:${height * KB_UPSCALE}:force_original_aspect_ratio=increase,` +
        `crop=${width * KB_UPSCALE}:${height * KB_UPSCALE},` +
        `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${width}x${height}:fps=${fps},${grade}[v]`;
      audioLabel = "";
    }

    // Resolve the audio track. Native-audio clips already have audioLabel; others take the
    // scene voiceover, or silence for an image/looped-clip scene with none.
    let audioChain: string;
    if (audioLabel) {
      audioChain = `[${audioLabel}]apad,atrim=0:${dur},asetpts=N/SR/TB[a]`;
    } else if (scene.audio) {
      const ai = 1;
      inputs.push("-i", scene.audio);
      audioChain = `[${ai}:a]apad,atrim=0:${dur},asetpts=N/SR/TB[a]`;
    } else {
      const ai = 1;
      inputs.push("-f", "lavfi", "-t", String(dur), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
      audioChain = `[${ai}:a]atrim=0:${dur},asetpts=N/SR/TB[a]`;
    }

    const pre: string[] = ["-y"];
    if (loopClip) pre.push("-stream_loop", "-1");
    await run(FFMPEG, [
      ...pre,
      ...inputs,
      "-filter_complex",
      `${videoChain};${audioChain}`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-r",
      String(fps),
      "-t",
      String(dur),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      segPath,
    ]);
  }
}
