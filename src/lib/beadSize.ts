export type SizePreset = "small" | "medium" | "large";

/** Beads along the chart's long side for each preset. */
export const SIZE_PRESETS: Record<SizePreset, number> = {
  small: 15,
  medium: 25,
  large: 40,
};

export const MIN_SIDE = 5;
export const MAX_SIDE = 100;

export interface ChartSize {
  width: number;
  height: number;
}

function clampSide(value: number): number {
  if (!Number.isFinite(value) || value < 1) return MIN_SIDE;
  return Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.round(value)));
}

/**
 * The preset size for an image: the long side is `longSide` beads and the
 * short side follows the image's aspect ratio, so a very wide image keeps
 * its preset width and gets the minimum height.
 */
export function sizeForLongSide(
  imageWidth: number,
  imageHeight: number,
  longSide: number
): ChartSize {
  const long = clampSide(longSide);
  if (imageWidth >= imageHeight) {
    return { width: long, height: clampSide((long * imageHeight) / imageWidth) };
  }
  return { width: clampSide((long * imageWidth) / imageHeight), height: long };
}

/**
 * The size after the user types `value` into the width or height field: the
 * other side follows the image's aspect ratio. When that pushes the other
 * side past a bound, it is clamped and the typed side is recomputed from it,
 * so the ratio holds as closely as the bounds allow.
 */
export function linkedSize(
  imageWidth: number,
  imageHeight: number,
  changed: "width" | "height",
  value: number
): ChartSize {
  // Beads of the other side per bead of the changed side.
  const ratio =
    changed === "width" ? imageHeight / imageWidth : imageWidth / imageHeight;
  let side = clampSide(value);
  const exactOther = side * ratio;
  const other = clampSide(exactOther);
  if (other !== Math.round(exactOther)) side = clampSide(other / ratio);
  return changed === "width"
    ? { width: side, height: other }
    : { width: other, height: side };
}

/** The preset that gives exactly `size` for this image, or null for a custom size. */
export function presetFor(
  imageWidth: number,
  imageHeight: number,
  size: ChartSize
): SizePreset | null {
  for (const preset of Object.keys(SIZE_PRESETS) as SizePreset[]) {
    const s = sizeForLongSide(imageWidth, imageHeight, SIZE_PRESETS[preset]);
    if (s.width === size.width && s.height === size.height) return preset;
  }
  return null;
}
