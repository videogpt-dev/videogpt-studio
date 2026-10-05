export interface Caption {
  start: number;
  end: number;
  text: string;
}

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export class CaptionTrack {
  static activeAt(captions: readonly Caption[], seconds: number): Caption | undefined {
    let active: Caption | undefined;
    for (const caption of captions) {
      if (
        seconds >= caption.start &&
        seconds <= caption.end &&
        (!active || caption.start > active.start)
      ) {
        active = caption;
      }
    }
    return active;
  }
}
