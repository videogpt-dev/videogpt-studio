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
  /** Tags written into the output file's metadata (e.g. comment). */
  metadata?: Record<string, string>;
}

/** A caller's metadata, kept to short plain-text tags, and as ffmpeg arguments. */
export class RenderTags {
  static of(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== "object") return undefined;
    const tags = Object.entries(value).filter(
      ([key, tag]) => /^[a-z_]{1,32}$/.test(key) && typeof tag === "string" && tag.length <= 500,
    );
    return tags.length ? Object.fromEntries(tags) : undefined;
  }

  static args(tags: Record<string, string> | undefined): string[] {
    return Object.entries(tags ?? {}).flatMap(([key, tag]) => ["-metadata", `${key}=${tag}`]);
  }
}

export interface RenderDriver {
  /** Encode the job and write the result to outputLocation. Throws on failure. */
  render(job: RenderJob, outputLocation: string): Promise<void>;
}
