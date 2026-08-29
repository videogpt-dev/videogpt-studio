import { CLIP_FORMATS, type ClipProps } from "@vcs/remotion";

/**
 * Reframe + caption controls. Format picker is driven by CLIP_FORMATS (the
 * composition's own list) so the UI never hardcodes its own set.
 */
export function Controls({
  doc,
  onChange,
  onImport,
}: {
  doc: ClipProps;
  onChange: (patch: Partial<ClipProps>) => void;
  onImport: (file: File) => void;
}) {
  return (
    <div className="controls">
      <label className="field">
        <span>Source URL</span>
        <input
          type="text"
          placeholder="https:// or /media/..."
          value={doc.src}
          onChange={(e) => onChange({ src: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Or import a file</span>
        <input
          type="file"
          accept="video/*,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
          }}
        />
      </label>

      <div className="field">
        <span>Format</span>
        <div className="segmented">
          {CLIP_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              className={doc.format === f ? "seg active" : "seg"}
              onClick={() => onChange({ format: f })}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Reframe focus {Math.round((doc.cropX ?? 0.5) * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={doc.cropX ?? 0.5}
          onChange={(e) => onChange({ cropX: Number(e.target.value), crop: undefined })}
        />
      </label>

      <label className="field field-row">
        <input
          type="checkbox"
          checked={doc.showCaptions}
          onChange={(e) => onChange({ showCaptions: e.target.checked })}
        />
        <span>Burn captions {doc.captions.length ? `(${doc.captions.length})` : "(none loaded)"}</span>
      </label>
    </div>
  );
}
