/**
 * Caption types owned by the render package so it stays self-contained (no
 * closed-monorepo dependency) and open-sourceable on its own. Structurally
 * identical to the shared @vcs/types versions, so values cross the boundary
 * freely.
 */

/** A transcript segment with absolute source times. */
export interface Caption {
  start: number;
  end: number;
  text: string;
}

/** One word with its spoken timing (karaoke captions). */
export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}
