import type { RenderDriver, RenderJob } from "./driver.ts";

/**
 * Routes each job to the fast lane when it can express it, else the rich lane.
 * ffmpeg (fast, no compositing) handles plain cuts; Remotion (rich, slower)
 * handles captions, layers, and story assembly. The `fastSupports` predicate is
 * the single source of truth for the boundary, keep it conservative so the fast
 * lane only takes jobs it renders pixel-parity with the preview.
 */
export class SmartDriver implements RenderDriver {
  constructor(
    private readonly fast: RenderDriver,
    private readonly rich: RenderDriver,
    private readonly fastSupports: (job: RenderJob) => boolean) {}

  render(job: RenderJob, outputLocation: string): Promise<void> {
    const driver = this.fastSupports(job) ? this.fast : this.rich;
    return driver.render(job, outputLocation);
  }
}
