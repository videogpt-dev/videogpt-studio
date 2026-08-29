import { CLIP_COMPOSITION_ID, type ClipProps } from "@vcs/remotion";

export interface RenderResult {
  ok: boolean;
  file?: string;
  error?: string;
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/** Upload a local source file; returns a /media URL to use as the doc source. */
export async function uploadSource(file: File): Promise<UploadResult> {
  const res = await fetch(`/v1/source?name=${encodeURIComponent(file.name)}`, {
    method: "PUT",
    body: file,
  });
  return (await res.json()) as UploadResult;
}

/** POST the current Clip EditDoc to the render command endpoint. */
export async function renderClip(doc: ClipProps): Promise<RenderResult> {
  const res = await fetch("/v1/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compositionId: CLIP_COMPOSITION_ID,
      inputProps: doc,
      out: `render-${Date.now()}.mp4`,
    }),
  });
  return (await res.json()) as RenderResult;
}
