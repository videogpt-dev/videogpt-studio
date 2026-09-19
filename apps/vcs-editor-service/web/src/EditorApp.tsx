import { useEffect, useRef, useState } from "react";
import { type ClipProps, DEFAULT_CLIP_PROPS } from "@vcs/remotion";
import { renderClip, uploadSource } from "./api.ts";
import { Controls } from "./components/Controls.tsx";
import { PreviewPlayer } from "./components/PreviewPlayer.tsx";
import { Timeline } from "./components/Timeline.tsx";

/**
 * The open editor shell. Holds one Clip EditDoc and edits it live: trim, reframe,
 * captions. Preview and export run the same composition, so it is WYSIWYG.
 * `initialDoc` lets a host (dashboard / self-host) mount it on a doc handed in
 * by the backend, the embeddable seam.
 */
export function EditorApp({ initialDoc }: { initialDoc?: Partial<ClipProps> }) {
  const [doc, setDoc] = useState<ClipProps>({ ...DEFAULT_CLIP_PROPS...initialDoc });
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("");
  const [rendering, setRendering] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const probe = useRef<HTMLVideoElement>(null);

  const patch = (p: Partial<ClipProps>) => setDoc((d) => ({ ...d...p }));

  const onImport = async (file: File) => {
    setStatus(`Uploading ${file.name}...`);
    const r = await uploadSource(file);
    if (r.ok && r.url) {
      patch({ src: r.url });
      setStatus("");
    } else {
      setStatus(`Upload failed: ${r.error}`);
    }
  };

  // Read real duration + source dimensions off the loaded video so the timeline
  // and crop math work against the true source, not the defaults.
  useEffect(() => {
    const v = probe.current;
    if (!v || !doc.src) return;
    const onMeta = () => {
      setDuration(v.duration || 0);
      patch({
        srcWidth: v.videoWidth || doc.srcWidth,
        srcHeight: v.videoHeight || doc.srcHeight,
        outSec: doc.outSec > (v.duration || 0) || doc.outSec <= doc.inSec ? v.duration || 0 : doc.outSec,
      });
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.src]);

  const onRender = async () => {
    setRendering(true);
    setStatus("Rendering...");
    setResultUrl("");
    try {
      const r = await renderClip(doc);
      if (r.ok && r.file) {
        setResultUrl(`/media/${r.file}`);
        setStatus("Done");
      } else {
        setStatus(`Error: ${r.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">VideoGPT Studio</div>
        <div className="topbar-right">
          {status && <span className="status">{status}</span>}
          {resultUrl && (
            <a className="status" href={resultUrl} target="_blank" rel="noreferrer">
              open result
            </a>
          )}
          <button className="render-btn" type="button" onClick={onRender} disabled={!doc.src || rendering}>
            {rendering ? "Rendering..." : "Render"}
          </button>
        </div>
      </header>

      <main className="stage">
        <section className="preview">
          {doc.src ? (
            <PreviewPlayer doc={doc} />
          ) : (
            <div className="preview-empty">Paste a source URL to begin</div>
          )}
        </section>
        <aside className="panel">
          <Controls doc={doc} onChange={patch} onImport={onImport} />
        </aside>
      </main>

      <footer className="dock">
        <Timeline
          inSec={doc.inSec}
          outSec={doc.outSec}
          duration={duration}
          onChange={patch}
        />
      </footer>

      {/* Hidden metadata probe. */}
      <video ref={probe} src={doc.src || undefined} preload="metadata" style={{ display: "none" }} muted />
    </div>
  );
}
