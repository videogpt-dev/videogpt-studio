import { z } from "zod";
import { CAPTIONED_COMPOSITION_ID } from "./captioned-composition.tsx";
import { CLIP_COMPOSITION_ID } from "./clip-composition.tsx";
import { STORY_COMPOSITION_ID } from "./story-composition.tsx";

/**
 * The render seam: one zod-validated document per composition, keyed by
 * compositionId. The editor produces an EditDoc, the <Player> previews it, and
 * the render driver consumes the same shape, so preview and export stay
 * pixel-identical and every render is validated at the boundary. Keep these
 * mirrored with the composition prop types they name.
 */

const caption = z.object({ start: z.number(), end: z.number(), text: z.string() });
const captionWord = z.object({ word: z.string(), start: z.number(), end: z.number() });
const crop = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

export const ClipInputSchema = z.object({
  src: z.string(),
  inSec: z.number(),
  outSec: z.number(),
  fps: z.number().positive(),
  srcWidth: z.number().positive(),
  srcHeight: z.number().positive(),
  format: z.string(),
  captions: z.array(caption),
  showCaptions: z.boolean(),
  crop: crop.optional(),
  cropX: z.number().optional(),
});

export const CaptionedInputSchema = z.object({
  src: z.string(),
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  inSec: z.number(),
  durationSec: z.number().positive(),
  captions: z.array(caption),
});

const storyScene = z.object({
  image: z.string(),
  video: z.string().optional(),
  video_seconds: z.number().optional(),
  video_audio: z.boolean().optional(),
  audio: z.string().optional(),
  seconds: z.number().positive(),
  words: z.array(captionWord),
});

export const StoryInputSchema = z.object({
  scenes: z.array(storyScene).min(1),
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  showCaptions: z.boolean(),
  karaoke: z.boolean().optional(),
  captionColor: z.string().optional(),
  captionScale: z.number().optional(),
  sceneGap: z.number().optional(),
  music: z.string().optional(),
  musicVolume: z.number().optional(),
});

/** compositionId -> its inputProps schema. The single source the driver validates against. */
export const EDIT_DOC_SCHEMAS = {
  [CLIP_COMPOSITION_ID]: ClipInputSchema,
  [CAPTIONED_COMPOSITION_ID]: CaptionedInputSchema,
  [STORY_COMPOSITION_ID]: StoryInputSchema,
} as const;

export type CompositionId = keyof typeof EDIT_DOC_SCHEMAS;

export type EditDoc =
  | { compositionId: typeof CLIP_COMPOSITION_ID; inputProps: z.infer<typeof ClipInputSchema> }
  | {
      compositionId: typeof CAPTIONED_COMPOSITION_ID;
      inputProps: z.infer<typeof CaptionedInputSchema>;
    }
  | { compositionId: typeof STORY_COMPOSITION_ID; inputProps: z.infer<typeof StoryInputSchema> };

export function isCompositionId(id: string): id is CompositionId {
  return id in EDIT_DOC_SCHEMAS;
}

/** Validate raw inputProps for a composition; throws on an unknown id or a bad shape. */
export function parseEditDoc(compositionId: string, inputProps: unknown): EditDoc {
  if (!isCompositionId(compositionId)) {
    throw new Error(`unknown compositionId: ${compositionId}`);
  }
  const parsed = EDIT_DOC_SCHEMAS[compositionId].parse(inputProps);
  return { compositionId, inputProps: parsed } as EditDoc;
}
