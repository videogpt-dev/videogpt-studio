import {
  CaptionLayout,
  type CaptionLine,
  CaptionLines,
  type CaptionPosition,
  type CaptionWord,
  DEFAULT_CAPTION_COLOR,
} from "@vcs/remotion";

export type CaptionStyle = {
  width: number;
  height: number;
  color?: string;
  scale?: number;
  position?: CaptionPosition;
  karaoke?: boolean;
};

const ALIGNMENT: Record<CaptionPosition, number> = { bottom: 2, middle: 5, top: 8 };
/** An ASS colour: blue-green-red hex plus alpha, where alpha 00 is opaque. */
type AssColour = { bgr: string; alpha: string };

const SPOKEN: AssColour = { bgr: "FFFFFF", alpha: "00" };
const UNSPOKEN: AssColour = { bgr: "FFFFFF", alpha: "73" }; // white at 55%, as in the composition

/**
 * One scene's caption words as an ASS subtitle that ffmpeg burns in with libass. It uses the
 * composition's own line breaking, size and safe margins (CaptionLayout), so a captioned story
 * renders on the fast lane and still reads like the preview: each line shows from its first
 * word until the next line, and karaoke colours the word being spoken, whitens spoken words
 * and dims the rest.
 */
export class AssCaptions {
  static build(words: CaptionWord[], sceneSeconds: number, style: CaptionStyle): string | null {
    const position = style.position ?? "bottom";
    const layout = CaptionLayout.of(style.width, style.height, style.scale ?? 1, position);
    const lines = CaptionLines.build(words, layout.maxChars);
    if (!lines.length) return null;
    const color = AssCaptions.colour(style.color || DEFAULT_CAPTION_COLOR);
    const events = lines.flatMap((line, index) => {
      const until = index + 1 < lines.length ? lines[index + 1].start : sceneSeconds;
      return style.karaoke
        ? AssCaptions.karaoke(line, until, color)
        : [AssCaptions.dialogue(line.start, until, AssCaptions.text(line, () => color))];
    });
    const margin = position === "top" ? layout.inset.top : position === "bottom" ? layout.inset.bottom : 0;
    return [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${style.width}`,
      `PlayResY: ${style.height}`,
      "WrapStyle: 0",
      "ScaledBorderAndShadow: yes",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      `Style: Caption,DejaVu Sans,${layout.fontSize},&H${color.alpha}${color.bgr},&H${color.alpha}${color.bgr},&H26000000,&H0D000000,-1,0,0,0,100,100,0,0,1,${layout.stroke * 2},2,${ALIGNMENT[position]},${Math.round(layout.inset.left)},${Math.round(layout.inset.right)},${Math.round(margin)},1`,
      "",
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      ...events.filter(Boolean),
      "",
    ].join("\n");
  }

  /** One event per word boundary, each with the word colours of that moment. */
  private static karaoke(line: CaptionLine, until: number, color: AssColour): string[] {
    const cuts = new Set<number>([line.start, until]);
    for (const word of line.words) {
      for (const t of [word.start, word.end]) if (t > line.start && t < until) cuts.add(t);
    }
    const times = [...cuts].sort((a, b) => a - b);
    return times.slice(0, -1).map((start, i) => {
      const at = (start + times[i + 1]) / 2;
      return AssCaptions.dialogue(
        start,
        times[i + 1],
        AssCaptions.text(line, (word) =>
          at >= word.end ? SPOKEN : at >= word.start ? color : UNSPOKEN,
        ),
      );
    });
  }

  private static text(line: CaptionLine, colourOf: (word: CaptionWord) => AssColour): string {
    return line.words
      .map((word) => {
        const { bgr, alpha } = colourOf(word);
        return `{\\1c&H${bgr}&\\1a&H${alpha}&}${AssCaptions.escape(word.word)}`;
      })
      .join(" ");
  }

  private static dialogue(start: number, end: number, text: string): string {
    if (end <= start) return "";
    return `Dialogue: 0,${AssCaptions.time(start)},${AssCaptions.time(end)},Caption,,0,0,0,,${text}`;
  }

  /** "#RRGGBB" to an opaque ASS colour; anything else falls back to the default. */
  private static colour(hex: string): AssColour {
    const valid = /^#?([0-9a-f]{6})$/i;
    const rgb = (valid.exec(hex.trim()) ?? valid.exec(DEFAULT_CAPTION_COLOR)!)[1].toUpperCase();
    return { bgr: rgb.slice(4, 6) + rgb.slice(2, 4) + rgb.slice(0, 2), alpha: "00" };
  }

  private static time(seconds: number): string {
    const cs = Math.max(0, Math.round(seconds * 100));
    const h = Math.floor(cs / 360000);
    const m = Math.floor((cs % 360000) / 6000);
    const s = Math.floor((cs % 6000) / 100);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`;
  }

  private static escape(word: string): string {
    return word.replace(/\\/g, "").replace(/[{}]/g, "");
  }
}
