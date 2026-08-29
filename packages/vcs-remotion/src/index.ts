export { type Caption, type CaptionWord } from "./captions.ts";
export {
  ClipComposition,
  CaptionOverlay,
  calcMeta,
  formatDims,
  durationInFrames,
  captionsFor,
  centeredCrop,
  cropForFormat,
  resolveCrop,
  cropDims,
  DEFAULT_CLIP_PROPS,
  CLIP_COMPOSITION_ID,
  CLIP_FORMATS,
  type ClipFormat,
  type ClipProps,
  type Crop,
} from "./clip-composition.tsx";
export {
  CaptionedComposition,
  captionedCalcMeta,
  DEFAULT_CAPTIONED_PROPS,
  CAPTIONED_COMPOSITION_ID,
  type CaptionedProps,
} from "./captioned-composition.tsx";
export {
  StoryVideo,
  storyCalcMeta,
  DEFAULT_STORY_PROPS,
  STORY_COMPOSITION_ID,
  type StoryVideoProps,
  type StoryScene,
} from "./story-composition.tsx";
export { RemotionRoot } from "./root.tsx";
export {
  ClipInputSchema,
  CaptionedInputSchema,
  StoryInputSchema,
  EDIT_DOC_SCHEMAS,
  isCompositionId,
  parseEditDoc,
  type CompositionId,
  type EditDoc,
} from "./edit-doc.ts";
