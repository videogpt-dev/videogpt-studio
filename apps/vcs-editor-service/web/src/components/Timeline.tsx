/**
 * Trim: set the in/out window over the source duration. The cut is a param, not
 * a pre-rendered file, moving these updates the preview live.
 */
export function Timeline({
  inSec,
  outSec,
  duration,
  onChange,
}: {
  inSec: number;
  outSec: number;
  duration: number;
  onChange: (patch: { inSec?: number; outSec?: number }) => void;
}) {
  const max = Math.max(duration, outSec, 1);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="timeline">
      <div className="timeline-row">
        <span className="timeline-label">In {fmt(inSec)}</span>
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={inSec}
          onChange={(e) => onChange({ inSec: Math.min(Number(e.target.value), outSec - 0.1) })}
        />
      </div>
      <div className="timeline-row">
        <span className="timeline-label">Out {fmt(outSec)}</span>
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={outSec}
          onChange={(e) => onChange({ outSec: Math.max(Number(e.target.value), inSec + 0.1) })}
        />
      </div>
      <div className="timeline-dur">Clip length {(outSec - inSec).toFixed(1)}s</div>
    </div>
  );
}
