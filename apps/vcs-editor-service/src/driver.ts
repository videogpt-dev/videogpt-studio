/**
 * The render seam. A driver takes a validated composition + inputProps and writes
 * an mp4 to a path. Nothing here imports Remotion, so a license-free backend
 * (ffmpeg, WebCodecs) can drop in behind the same interface without touching the
 * server routes. See remotion-driver.ts for the current backend.
 */

export interface RenderJob {
  compositionId: string;
  inputProps: Record<string, unknown>;
  codec?: "h264";
}

export interface RenderDriver {
  /** Encode the job and write the result to outputLocation. Throws on failure. */
  render(job: RenderJob, outputLocation: string): Promise<void>;
}
