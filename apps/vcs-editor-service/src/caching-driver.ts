import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { RenderDriver, RenderJob } from "./driver.ts";

/** Stable-stringify: object keys sorted so equal jobs hash equal regardless of key order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

function jobHash(job: RenderJob): string {
  const key = stableStringify({ c: job.compositionId, i: job.inputProps, k: job.codec ?? "h264" });
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Content-addressed render cache decorator. The output of a deterministic
 * composition depends only on (compositionId, inputProps, codec), so an
 * identical job re-uses the cached mp4 instead of re-encoding. Wraps any driver
 * — the cache survives swapping the Remotion backend for another.
 */
export class CachingDriver implements RenderDriver {
  constructor(
    private readonly inner: RenderDriver,
    private readonly cacheDir: string,
  ) {}

  async render(job: RenderJob, outputLocation: string): Promise<void> {
    const cachePath = path.join(this.cacheDir, `${jobHash(job)}.mp4`);
    if (fs.existsSync(cachePath)) {
      await fs.promises.mkdir(path.dirname(outputLocation), { recursive: true });
      await fs.promises.copyFile(cachePath, outputLocation);
      return;
    }
    await this.inner.render(job, outputLocation);
    try {
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
      await fs.promises.copyFile(outputLocation, cachePath);
    } catch {
      // A cache write failure must never fail the render the caller already has.
    }
  }
}
