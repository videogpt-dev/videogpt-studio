import { Player } from "@remotion/player";
import { ClipComposition, type ClipProps, durationInFrames, formatDims } from "@vcs/remotion";

/**
 * WYSIWYG preview: the same Clip composition the server renders, so what plays
 * here is what exports. Composition size is the format's output dimensions.
 */
export function PreviewPlayer({ doc }: { doc: ClipProps }) {
  const dims = formatDims(doc.format);
  const frames = durationInFrames(doc.inSec, doc.outSec, doc.fps);
  return (
    <Player
      component={ClipComposition}
      inputProps={doc}
      durationInFrames={frames}
      compositionWidth={dims.width}
      compositionHeight={dims.height}
      fps={doc.fps}
      controls
      clickToPlay
      loop
      style={{ width: "100%", height: "100%" }}
    />
  );
}
