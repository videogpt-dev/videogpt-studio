import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPTIONED_COMPOSITION_ID,
  type Caption,
  type CaptionWord,
  parseEditDoc,
  STORY_COMPOSITION_ID,
} from "@vcs/remotion";
import express, { type Request, type Response } from "express";
import { CachingDriver } from "./caching-driver.ts";
import type { RenderJob } from "./driver.ts";
import { FfmpegDriver } from "./ffmpeg-driver.ts";
import { RemotionDriver } from "./remotion-driver.ts";
import { SmartDriver } from "./smart-driver.ts";

const PORT = Number(process.env.PORT || 3000);
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/app/output";
const CACHE_DIR = process.env.RENDER_CACHE_DIR || path.join(OUTPUT_DIR, ".render-cache");

// Two engines behind the seam: ffmpeg (fast, plain cuts) and Remotion (rich,
// composited). SmartDriver routes by capability; CachingDriver skips re-encodes.
// Add a license-free rich driver by swapping RemotionDriver here.
const driver = new CachingDriver(
  new SmartDriver(new FfmpegDriver(), new RemotionDriver(), FfmpegDriver.supports),
  CACHE_DIR,
);

const app = express();
app.use(express.json({ limit: "20mb" }));

// Serve the source video (and any output media) locally so headless Chromium
// reads frames straight off the mounted volume — no cross-container streaming.
app.use("/media", express.static(OUTPUT_DIR));

// Serve the built editor SPA when present, so the one service ships both the
// render API and the UI. In dev the UI runs from Vite (web:dev) and proxies here.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.join(__dirname, "..", "web", "dist");
if (fs.existsSync(WEB_DIST)) app.use(express.static(WEB_DIST));

function safeSegment(s: string): boolean {
  return !!s && !s.includes("..") && !s.includes("/") && !s.includes("\\");
}

/** A relative dir under OUTPUT_DIR that cannot escape it (no "..", not absolute). */
function safeRelDir(s: string | undefined): boolean {
  if (!s || s.includes("..") || s.includes("\\") || path.isAbsolute(s)) return false;
  const resolved = path.resolve(OUTPUT_DIR, s);
  return resolved === OUTPUT_DIR || resolved.startsWith(OUTPUT_DIR + path.sep);
}

function mediaUrl(sourceRel: string): string {
  // Already absolute (a signed assets-gateway URL from the backend) — use it as-is; only a
  // bare OUTPUT-relative path is served off this service's local /media mount.
  if (/^https?:\/\//i.test(sourceRel)) return sourceRel;
  const encoded = sourceRel.split("/").map(encodeURIComponent).join("/");
  return `http://127.0.0.1:${PORT}/media/${encoded}`;
}

// Where a render writes and how it is delivered. When the backend supplies a signed
// `uploadUrl`, the service owns its own output: render to a private temp file, PUT it to the
// assets gateway, then delete the temp — it never touches a shared volume. With no uploadUrl
// (local dev), it writes into OUTPUT_DIR/<relDir>/<name> as before, off the mounted volume.
async function renderTo(
  job: RenderJob,
  localDir: string,
  name: string,
  uploadUrl: string | undefined,
): Promise<void> {
  if (!uploadUrl) {
    fs.mkdirSync(localDir, { recursive: true });
    await driver.render(job, path.join(localDir, name));
    return;
  }
  const tmp = path.join(os.tmpdir(), `render-${randomUUID()}.mp4`);
  try {
    await driver.render(job, tmp);
    const data = await fs.promises.readFile(tmp);
    const resp = await fetch(uploadUrl, {
      method: "PUT",
      body: data,
      headers: { "Content-Type": "video/mp4" },
    });
    if (!resp.ok) {
      throw new Error(`assets upload ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    }
  } finally {
    await fs.promises.unlink(tmp).catch(() => {});
  }
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "vcs-editor-service" });
});

interface CaptionBody {
  slug: string;
  clip_id: string;
  clipRel: string; // base clip path relative to OUTPUT_DIR (already cut/cropped)
  width: number;
  height: number;
  fps: number;
  inSec: number; // base clip's absolute start in source (caption time offset)
  durationSec: number;
  captions?: Caption[];
  uploadUrl?: string; // signed gateway PUT url; when set the service uploads its output itself
}

// ---------------------------------------------------------------------------
// Captioned variant: burn the caption track onto an already-cut base clip.
// Written to clips/<clip_id>/variants/captioned.mp4. Same stateless contract as
// /render — the Python worker tracks queueing/progress.
// ---------------------------------------------------------------------------
app.post("/caption", async (req: Request, res: Response) => {
  const b = req.body as CaptionBody;
  if (!safeSegment(b?.slug) || !safeSegment(b?.clip_id)) {
    return res.status(400).json({ ok: false, error: "Invalid slug or clip_id" });
  }
  if (!b.clipRel) {
    return res.status(400).json({ ok: false, error: "Missing clipRel" });
  }

  const inputProps = {
    src: mediaUrl(b.clipRel),
    fps: b.fps,
    width: b.width,
    height: b.height,
    inSec: b.inSec,
    durationSec: b.durationSec,
    captions: b.captions || [],
  };

  try {
    const outDir = path.join(OUTPUT_DIR, "videos", b.slug, "clips", b.clip_id, "variants");
    await renderTo(
      { compositionId: CAPTIONED_COMPOSITION_ID, inputProps },
      outDir,
      "captioned.mp4",
      b.uploadUrl,
    );
    res.json({ ok: true, file: `${b.clip_id}/variants/captioned.mp4` });
  } catch (e) {
    console.error("Caption render failed:", e);
    res.status(500).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
});

interface StoryScene {
  image: string; // path relative to OUTPUT_DIR
  video?: string; // generated clip (Video Mode); plays instead of the Ken Burns still
  video_seconds?: number; // the clip's own length; it loops to fill a longer scene
  video_audio?: boolean; // preserve clip-native audio instead of muting it for voiceover
  audio?: string; // path relative to OUTPUT_DIR
  seconds: number;
  words?: CaptionWord[];
}

interface StoryBody {
  pid: string;
  width: number;
  height: number;
  fps: number;
  showCaptions?: boolean;
  karaoke?: boolean;
  captionColor?: string;
  captionScale?: number;
  sceneGap?: number;
  music?: string; // path relative to OUTPUT_DIR
  out?: string; // output basename (e.g. "video-2.mp4"); backend versions renders
  out_dir?: string; // dir relative to OUTPUT_DIR (e.g. videogen/series/<sid>/episodes/3)
  uploadUrl?: string; // signed gateway PUT url; when set the service uploads its output itself
  scenes: StoryScene[];
}

// ---------------------------------------------------------------------------
// AI video-gen assembly: still images (Ken Burns) + per-scene voiceover +
// captions -> one mp4 at videogen/<pid>/video.mp4. Stateless like /render; the
// Python worker tracks progress.
// ---------------------------------------------------------------------------
app.post("/render-story", async (req: Request, res: Response) => {
  const b = req.body as StoryBody;
  if (!safeSegment(b?.pid)) {
    return res.status(400).json({ ok: false, error: "Invalid pid" });
  }
  if (!Array.isArray(b.scenes) || b.scenes.length === 0) {
    return res.status(400).json({ ok: false, error: "Missing scenes" });
  }

  const inputProps = {
    fps: b.fps,
    width: b.width,
    height: b.height,
    showCaptions: b.showCaptions !== false,
    karaoke: b.karaoke === true,
    captionColor: b.captionColor || undefined,
    captionScale: b.captionScale || undefined,
    sceneGap: typeof b.sceneGap === "number" ? b.sceneGap : undefined,
    music: b.music ? mediaUrl(b.music) : undefined,
    scenes: b.scenes.map((s) => ({
      image: s.image ? mediaUrl(s.image) : "",
      video: s.video ? mediaUrl(s.video) : undefined,
      video_seconds: s.video_seconds,
      video_audio: s.video_audio === true,
      audio: s.audio ? mediaUrl(s.audio) : undefined,
      seconds: s.seconds,
      words: s.words || [],
    })),
  };

  try {
    const outName = b.out && safeSegment(b.out) && b.out.endsWith(".mp4") ? b.out : "video.mp4";
    // The backend picks the folder (flat videogen/<pid>, or a nested series
    // episode); accept it only when it stays inside OUTPUT_DIR.
    const relDir = safeRelDir(b.out_dir) ? b.out_dir! : `videogen/${b.pid}`;
    await renderTo(
      { compositionId: STORY_COMPOSITION_ID, inputProps },
      path.join(OUTPUT_DIR, relDir),
      outName,
      b.uploadUrl,
    );
    res.json({ ok: true, file: `${relDir}/${outName}` });
  } catch (e) {
    console.error("Story render failed:", e);
    res.status(500).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
});

const SOURCE_EXT = /^\.(mp4|mov|webm|mkv|m4v|jpg|jpeg|png|mp3|wav|m4a)$/;

// ---------------------------------------------------------------------------
// Import a source file for the editor: raw bytes in, a servable /media URL out.
// Stored under uploads/ with a random id so names never collide or escape. Lets
// the standalone editor work on local media without a separate asset store.
// ---------------------------------------------------------------------------
app.put(
  "/v1/source",
  express.raw({ type: () => true, limit: "4096mb" }),
  (req: Request, res: Response) => {
    const ext = path.extname(String(req.query.name || "")).toLowerCase();
    if (!SOURCE_EXT.test(ext)) {
      return res.status(400).json({ ok: false, error: "unsupported file type" });
    }
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ ok: false, error: "empty body" });
    }
    const rel = `uploads/${randomUUID()}${ext}`;
    fs.mkdirSync(path.join(OUTPUT_DIR, "uploads"), { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, rel), body);
    res.json({ ok: true, url: `/media/${rel}` });
  },
);

interface RenderBody {
  compositionId: string;
  inputProps: Record<string, unknown>;
  out?: string; // output basename (default render.mp4)
  out_dir?: string; // dir relative to OUTPUT_DIR (default "renders")
  uploadUrl?: string; // signed gateway PUT url; when set the service uploads its own output
}

// ---------------------------------------------------------------------------
// Generic render command: an EditDoc in, an mp4 out. The single entry the editor
// and the backend call for any composition. inputProps are validated up front so
// a bad shape is a 400 (caller error), not a mid-render 500. SmartDriver picks
// ffmpeg or Remotion; CachingDriver skips a re-encode of an identical doc.
// ---------------------------------------------------------------------------
app.post("/v1/render", async (req: Request, res: Response) => {
  const b = req.body as RenderBody;
  if (!b?.compositionId || typeof b.inputProps !== "object" || b.inputProps === null) {
    return res.status(400).json({ ok: false, error: "compositionId and inputProps are required" });
  }
  try {
    parseEditDoc(b.compositionId, b.inputProps);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
  try {
    const outName = b.out && safeSegment(b.out) && b.out.endsWith(".mp4") ? b.out : "render.mp4";
    const relDir = safeRelDir(b.out_dir) ? b.out_dir! : "renders";
    await renderTo(
      { compositionId: b.compositionId, inputProps: b.inputProps },
      path.join(OUTPUT_DIR, relDir),
      outName,
      b.uploadUrl,
    );
    res.json({ ok: true, file: `${relDir}/${outName}` });
  } catch (e) {
    console.error("Render failed:", e);
    res.status(500).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
});

app.listen(PORT, () => {
  console.log(`vcs-editor-service listening on :${PORT} (output=${OUTPUT_DIR})`);
});
