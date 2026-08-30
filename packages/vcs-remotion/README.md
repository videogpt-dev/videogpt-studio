# @vcs/remotion

Shared Remotion compositions and the edit-document contract for VideoGPT Studio.
One set of composition code drives both the browser `<Player>` preview and the
headless render, so what you preview is what you render.

## What's here

- **Compositions.** `Clip` (cut plus crop/scale plus optional captions), `Captioned`
  (burn a caption track onto a base clip), `Story` (assemble images or clips with voiceover,
  captions, and music). Registered in `RemotionRoot` for the renderer.
- **Crop math.** `resolveCrop`, `cropDims`, `formatDims`, `centeredCrop`. The fast ffmpeg
  render lane reuses these so its output matches the composition.
- **Edit document.** zod schemas (`ClipInputSchema`, `CaptionedInputSchema`,
  `StoryInputSchema`) plus `parseEditDoc(compositionId, inputProps)`, the one validated
  contract the editor produces and the renderer consumes.

## Use

Preview (any React app):

```tsx
import { Player } from "@remotion/player";
import { ClipComposition, calcMeta, CLIP_COMPOSITION_ID } from "@vcs/remotion";
```

Validate a render request:

```ts
import { parseEditDoc } from "@vcs/remotion";
const doc = parseEditDoc(compositionId, inputProps); // throws on a bad shape
```

## License

MIT (`LICENSE`). Note that `remotion` and `@remotion/player`, which this package builds on,
are under the separate Remotion License. See the repository's [NOTICE.md](../../NOTICE.md).
