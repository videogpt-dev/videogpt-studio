import { spawn } from "node:child_process";
import {
  CLIP_COMPOSITION_ID,
  type ClipProps,
  cropDims,
  formatDims,
  parseEditDoc,
  resolveCrop,
} from "@vcs/remotion";
import type { RenderDriver, RenderJob } from "./driver.ts";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const evenFloor = (n: number) => Math.max(0, Math.floor(n / 2) * 2);

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

  async render(job: RenderJob, outputLocation: string): Promise<void> {
    const { inputProps } = parseEditDoc(job.compositionId, job.inputProps);
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
}
