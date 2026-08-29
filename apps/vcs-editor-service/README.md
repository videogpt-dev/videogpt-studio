# VideoGPT Studio — open render + editor service

A standalone video render service (and, in time, editor UI) for short-form and
AI-generated video. It takes a declarative edit document, previews it in the
browser, and renders it to an mp4 — using two interchangeable engines.

It is the pixels half of the pipeline. The "brain" (finding moments,
transcription, metadata) lives elsewhere and hands this service a render command;
from there a user can edit, reframe, and (soon) compose rich layers.

## Two engines, one seam

Every render goes through a `RenderDriver`. Two implementations sit behind it:

| Engine     | For                                             | Cost              |
| ---------- | ----------------------------------------------- | ----------------- |
| **ffmpeg** | plain cuts, crop / scale to a target format     | fast, no browser  |
| **Remotion** | burned captions, layered / composited output, story assembly | rich, headless Chromium |

`SmartDriver` routes each job to the fast lane when it can express it, otherwise
the rich lane. The ffmpeg lane reuses the Remotion composition's own crop math,
so a fast cut is pixel-parity with the browser preview. A `CachingDriver`
wraps both: identical jobs (same composition + inputProps) reuse the cached mp4
instead of re-encoding.

```
CachingDriver ─ SmartDriver ─┬─ FfmpegDriver   (fast)
                             └─ RemotionDriver (rich)
```

The seam means you can add a fully license-free rich backend, or a cloud/lambda
backend, by writing one class — the routes never change.

## The edit document

`@vcs/remotion` defines the compositions (`Clip`, `Captioned`, `Story`) and a
zod-validated `EditDoc` — the single contract the editor produces, the
`<Player>` previews, and the renderer consumes. Because preview and render run
the same composition code, what you see is what you get. `parseEditDoc` validates
every render at the boundary.

## Run it

Requires Node 24+, pnpm, and a system `ffmpeg` on PATH.

```bash
pnpm install
pnpm --filter vcs-editor-service dev      # render API, tsx watch on :3000
pnpm --filter vcs-editor-service web:dev  # editor UI, Vite on :5180 (proxies the API)
```

Open http://localhost:5180, paste a source video URL, trim / reframe / toggle
captions, and hit Render. The editor edits one `EditDoc` and previews it with the
same composition the server renders — WYSIWYG. In production the service serves
the built UI itself (`web:build` → `web/dist`), so it is one app.

The service is stateless: it reads source media (a local path under `OUTPUT_DIR`
or an absolute URL), renders, and either writes to `OUTPUT_DIR` or PUTs the
result to a signed `uploadUrl` you supply. It does not need a database.

### Endpoints

- `GET /health` — liveness.
- `POST /v1/render` — the generic command: `{compositionId, inputProps}` (an
  EditDoc) in, an mp4 out. Validated up front (bad shape → 400). What the editor
  and backend call.
- `POST /caption` — burn a caption track onto an already-cut base clip.
- `POST /render-story` — assemble images / clips + voiceover + captions + music
  into one mp4.
- `GET /media/*` — static passthrough of `OUTPUT_DIR` so the headless renderer
  reads frames off the local volume.

Example:

```bash
curl -s localhost:3000/health
# {"ok":true,"service":"vcs-editor-service"}
```

## Configuration

| Env                | Default                | Purpose                                  |
| ------------------ | ---------------------- | ---------------------------------------- |
| `PORT`             | `3000`                 | HTTP port                                |
| `OUTPUT_DIR`       | `/app/output`          | media root (read source, write output)   |
| `RENDER_CACHE_DIR` | `$OUTPUT_DIR/.render-cache` | content-addressed render cache      |
| `FFMPEG_PATH`      | `ffmpeg`               | ffmpeg binary for the fast lane          |

## Docker

```bash
# build context is the repo root (workspace deps)
docker build -f apps/vcs-editor-service/Dockerfile -t videogpt-studio .
docker run -p 3000:3000 -v "$PWD/output:/app/output" videogpt-studio
```

## Licensing

This project's code is MIT (`LICENSE`). It depends on **Remotion**, which is
source-available and free for individuals and companies up to 3 people, paid
above that — and **FFmpeg** (LGPL/GPL by build). See `NOTICE.md`. The
`RenderDriver` seam exists so you can run entirely on the ffmpeg lane if
Remotion's terms do not suit you.

## Contributing

See `CONTRIBUTING.md`. The high-value open surface is the editor UI (a `<Player>`
timeline that reads and writes the `EditDoc`) and new render layers.
