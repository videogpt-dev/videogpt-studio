# vcs-editor-service

The render server and web editor for VideoGPT Studio. You give it an edit document, it gives
you back an mp4. The web editor is a small UI for building that document by hand.

It does not find moments or transcribe. Something upstream decides what to render and calls
this service. This service turns that into video.

## Two engines

Every render goes through a `RenderDriver`. There are two:

| Engine | For | Cost |
|---|---|---|
| ffmpeg | plain cuts, crop or scale to a format | fast, no browser |
| Remotion | burned captions, layered scenes, story assembly | slower, headless Chromium |

`SmartDriver` sends a job to the fast lane when it can, otherwise the rich lane. The ffmpeg
lane reuses the Remotion composition's own crop math, so a fast cut matches the browser
preview pixel for pixel. `CachingDriver` wraps both: an identical job (same composition and
inputProps) reuses the cached mp4 instead of encoding again.

```
CachingDriver > SmartDriver > FfmpegDriver   (fast)
                            > RemotionDriver  (rich)
```

You can add another rich backend (say a cloud or lambda renderer) by writing one class. The
routes do not change.

## The edit document

`@vcs/remotion` holds the compositions (`Clip`, `Captioned`, `Story`) and a zod-validated
edit document. The editor produces it, the `<Player>` previews it, and the renderer consumes
it. Preview and render run the same composition code, so the preview matches the output.
`parseEditDoc` validates every render before it starts.

## Run

Node 20 or newer, pnpm, and a system `ffmpeg` on PATH.

```sh
pnpm install
pnpm --filter vcs-editor-service dev      # render API on :3000
pnpm --filter vcs-editor-service web:dev  # editor on :5180 (proxies the API)
```

Open http://localhost:5180, paste a source video URL, trim or reframe, toggle captions, hit
Render. In production the service serves the built UI itself (`web:build` writes `web/dist`),
so it is one app.

The service keeps no state. It reads source media (a local path under `OUTPUT_DIR` or an
absolute URL), renders, and either writes to `OUTPUT_DIR` or PUTs the result to a signed
`uploadUrl` you pass. No database.

### Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/v1/render` | generic command: `{compositionId, inputProps}` in, mp4 out (bad shape is a 400) |
| POST | `/caption` | burn a caption track onto an already cut clip |
| POST | `/render-story` | assemble scene images or clips with voiceover, captions, and music into one mp4 |
| PUT | `/v1/source` | upload a local source file, get a `/media` URL back |
| GET | `/media/*` | serve `OUTPUT_DIR` so the headless renderer reads frames off the volume |

```sh
curl -s localhost:3000/health
# {"ok":true,"service":"vcs-editor-service"}
```

## Configuration

| Env | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `OUTPUT_DIR` | `/app/output` | media root (reads source, writes output) |
| `RENDER_CACHE_DIR` | `$OUTPUT_DIR/.render-cache` | content addressed render cache |
| `FFMPEG_PATH` | `ffmpeg` | ffmpeg binary for the fast lane |

## Docker

The build context is the repo root, because it installs workspace dependencies.

```sh
docker build -f apps/vcs-editor-service/Dockerfile -t videogpt-studio .
docker run -p 3000:3000 -v "$PWD/output:/app/output" videogpt-studio
```

## Licensing

The code here is MIT (`LICENSE`). It uses Remotion, which is source-available and free for
individuals and companies up to three people, paid above that. It also uses ffmpeg (LGPL or
GPL by build). See [NOTICE.md](../../NOTICE.md). The `RenderDriver` seam lets you run on the
ffmpeg lane alone if Remotion's terms do not suit you.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md). The most useful place to help is the editor UI
(a `<Player>` timeline that reads and writes the edit document) and new render layers.
