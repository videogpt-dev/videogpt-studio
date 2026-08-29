# Contributing

Thanks for helping build an open render + editor for video.

## Layout

- `apps/vcs-editor-service` — the service: HTTP routes + the render drivers.
  - `driver.ts` — the `RenderDriver` seam (framework-agnostic).
  - `remotion-driver.ts` — the Remotion backend (the only file importing
    `@remotion/*`).
  - `ffmpeg-driver.ts` — the fast ffmpeg lane.
  - `smart-driver.ts` — routes a job to fast or rich.
  - `caching-driver.ts` — content-addressed cache decorator.
  - `server.ts` — Express routes; wires the drivers together.
- `packages/vcs-remotion` — the compositions (`Clip`, `Captioned`, `Story`), the
  shared crop math, and the zod `EditDoc` schema. Self-contained (deps: remotion,
  zod). This is the preview/render source of truth.

## Ground rules

- **Preview must equal render.** The whole point is that the browser `<Player>`
  and the server output come from the same composition code. A new render backend
  (or a widening of the ffmpeg lane) must produce pixel-parity output before its
  `supports()` predicate claims a job. When in doubt, route to Remotion.
- **Validate at the boundary.** Every render input passes through `parseEditDoc`.
  New composition props get a matching zod schema in `edit-doc.ts`.
- **Keep Remotion isolated.** Only `remotion-driver.ts` / `remotion-entry.ts`
  import `@remotion/*`, so the app can run license-free on the ffmpeg lane. Do not
  import Remotion elsewhere.
- **New visual features are layers.** Captions, memes, stickers, text, b-roll,
  transitions — add a composition layer + one `EditDoc` schema entry. Additive;
  never change the render seam.

## Before a PR

```bash
pnpm --filter @vcs/remotion typecheck
pnpm --filter vcs-editor-service typecheck
```

Both must be clean. Describe how you verified render parity for anything that
touches pixels.
