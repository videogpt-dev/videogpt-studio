import { z } from "zod";
import { CAPTIONED_COMPOSITION_ID } from "./captioned-composition.tsx";
import { CLIP_COMPOSITION_ID } from "./clip-composition.tsx";
import { STORY_COMPOSITION_ID } from "./story-composition.tsx";

const caption = z.object({ start: z.number(), end: z.number(), text: z.string() });
const captionWord = z.object({ word: z.string(), start: z.number(), end: z.number() });
const crop = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

const clipInput = z.object({
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

const captionedInput = z.object({
  src: z.string(),
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  inSec: z.number(),
  durationSec: z.number().positive(),
  captions: z.array(caption),
});

const storyInput = z.object({
  scenes: z
    .array(
      z.object({
        image: z.string(),
        video: z.string().optional(),
        video_seconds: z.number().optional(),
        video_audio: z.boolean().optional(),
        audio: z.string().optional(),
        seconds: z.number().positive(),
        words: z.array(captionWord),
      }),
    )
    .min(1),
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

export type EditDoc =
  | { compositionId: typeof CLIP_COMPOSITION_ID; inputProps: z.infer<typeof clipInput> }
  | { compositionId: typeof CAPTIONED_COMPOSITION_ID; inputProps: z.infer<typeof captionedInput> }
  | { compositionId: typeof STORY_COMPOSITION_ID; inputProps: z.infer<typeof storyInput> };

export class EditDocs {
  private static readonly schemas = {
    [CLIP_COMPOSITION_ID]: clipInput,
    [CAPTIONED_COMPOSITION_ID]: captionedInput,
    [STORY_COMPOSITION_ID]: storyInput,
  } as const;

  static parse(compositionId: string, inputProps: unknown): EditDoc {
    if (!EditDocs.known(compositionId)) throw new Error(`unknown compositionId: ${compositionId}`);
    const parsed = EditDocs.schemas[compositionId].parse(inputProps);
    return { compositionId, inputProps: parsed } as EditDoc;
  }

  private static known(id: string): id is keyof typeof EditDocs.schemas {
    return id in EditDocs.schemas;
  }
}
