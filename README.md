<p align="center">
  <img src="assets/logo.png" alt="VideoGPT Studio" width="104" height="104">
</p>

<h1 align="center">VideoGPT Studio</h1>

<p align="center">
  An open render and editor service for short-form and AI-generated video.
</p>

---

This is the pixels half of the [videogpt.dev](https://videogpt.dev) pipeline. It takes a
declarative edit document, previews it in the browser, and renders it to an mp4. The "brain"
(finding moments, transcription, script) lives elsewhere and hands this service a render
command; from there a person can edit, reframe, and compose layers.

It renders through two interchangeable engines behind one seam: a fast **ffmpeg** lane for
plain cuts and reframing, and a rich **Remotion** lane for burned captions, layered output,
and story assembly. What the browser preview shows is what the headless render produces,
because both run the same composition code.

## Packages

| Path | Name | Job |
|---|---|---|
| `packages/vcs-remotion` | `@vcs/remotion` | shared compositions (clip, captioned, story) plus a zod-validated EditDoc |
| `apps/vcs-editor-service` | `vcs-editor-service` | the render service (ffmpeg + Remotion drivers, smart router, cache) and editor web UI |

## Run

You need Node 20+ and pnpm.

```sh
pnpm install
pnpm -C apps/vcs-editor-service dev        # render API on :3000
pnpm -C apps/vcs-editor-service web:dev     # editor UI on :5180 (proxies the API)
```

The service is stateless: POST an edit document, get an mp4. It runs on its own, with no
backend. See `apps/vcs-editor-service/README.md` for the endpoints, the two-engine seam, and
the environment.

## License

This repository's own code is [MIT](LICENSE) licensed. It depends on Remotion and ffmpeg,
which carry their own, different terms. If you self-host commercially, read [NOTICE.md](NOTICE.md)
first: Remotion is source-available (free for individuals and companies up to 3 people, paid
above that), and the obligation is on whoever runs it.
