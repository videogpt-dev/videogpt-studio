export type Crop = { x: number; y: number; w: number; h: number };

export interface Size {
  width: number;
  height: number;
}

export interface CropSource {
  format: string;
  srcWidth: number;
  srcHeight: number;
  crop?: Crop;
  cropX?: number;
}

export const CLIP_FORMATS = ["9:16", "1:1", "16:9"] as const;

export class ClipGeometry {
  static formatDims(format: string): Size {
    switch (format) {
      case "16:9":
        return { width: 1920, height: 1080 };
      case "1:1":
        return { width: 1080, height: 1080 };
      default:
        return { width: 1080, height: 1920 };
    }
  }

  static centeredCrop(aspect: number, srcWidth: number, srcHeight: number): Crop {
    const srcAspect = srcWidth / srcHeight;
    if (aspect <= srcAspect) {
      const w = aspect / srcAspect;
      return { x: (1 - w) / 2, y: 0, w, h: 1 };
    }
    const h = srcAspect / aspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }

  static cropForFormat(format: string, srcWidth: number, srcHeight: number): Crop {
    const { width, height } = ClipGeometry.formatDims(format);
    return ClipGeometry.centeredCrop(width / height, srcWidth, srcHeight);
  }

  static resolveCrop(source: CropSource): Crop {
    if (source.crop) {
      const { x, y, w, h } = source.crop;
      return {
        x: ClipGeometry.clamp01(x),
        y: ClipGeometry.clamp01(y),
        w: ClipGeometry.clamp01(w),
        h: ClipGeometry.clamp01(h),
      };
    }
    const base = ClipGeometry.cropForFormat(source.format, source.srcWidth, source.srcHeight);
    if (source.cropX != null) base.x = ClipGeometry.clamp01(source.cropX) * (1 - base.w);
    return base;
  }

  static cropDims(crop: Crop, srcWidth: number, srcHeight: number): Size {
    return {
      width: ClipGeometry.even(crop.w * srcWidth),
      height: ClipGeometry.even(crop.h * srcHeight),
    };
  }

  static durationInFrames(inSec: number, outSec: number, fps: number): number {
    return Math.max(1, Math.round((outSec - inSec) * fps));
  }

  private static clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private static even(value: number): number {
    return Math.max(2, Math.round(value / 2) * 2);
  }
}
