import { deltaE, hexToLab } from "./color";
import { MIN_ALPHA, PaletteColor, PixelGrid, pixelHex } from "./palette";
import { Point } from "./paletteUrl";

export interface Marker {
  /** Stable React key: survives relettering when the scanned set changes. */
  key: string;
  /** "A", "B", … in display order. */
  label: string;
  hex: string;
  /** Image pixel coordinates of the dot. */
  x: number;
  y: number;
  source: "scan" | "pick";
  /** Fraction of the image, for scanned markers; null for ones the user placed. */
  share: number | null;
}

/**
 * A hidden hex also hides scanned colors this close to it (ΔE): the same image
 * can decode a shade differently on another browser or device, and a shared
 * link should still hide the color it named.
 */
export const HIDE_MATCH_DELTA_E = 5;

function isHidden(hex: string, hidden: string[]): boolean {
  const lab = hexToLab(hex);
  return hidden.some((h) => deltaE(lab, hexToLab(h)) < HIDE_MATCH_DELTA_E);
}

/** A, B, …, Z, AA, AB, … */
export function markerLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return index < 26 ? letter : markerLabel(Math.floor(index / 26) - 1) + letter;
}

/** Scanned colors (minus hidden ones) first, then the user's picks in the order added. */
export function buildMarkers(
  scanned: PaletteColor[],
  picked: Point[],
  hidden: string[],
  pixels: PixelGrid
): Marker[] {
  const fromScan = scanned
    .filter((c) => !isHidden(c.hex, hidden))
    .map((c) => ({
      key: `scan-${c.hex}-${c.x}-${c.y}`,
      hex: c.hex,
      x: c.x,
      y: c.y,
      source: "scan" as const,
      share: c.share,
    }));
  const fromPicks = picked
    .filter(
      (p) =>
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < pixels.width &&
        p.y < pixels.height &&
        // A transparent spot has no color to mix; it would read as black.
        pixels.data[(p.y * pixels.width + p.x) * 4 + 3] >= MIN_ALPHA
    )
    .map((p) => ({
      key: `pick-${p.x}-${p.y}`,
      hex: pixelHex(pixels, p.x, p.y),
      x: p.x,
      y: p.y,
      source: "pick" as const,
      share: null,
    }));
  return [...fromScan, ...fromPicks].map((m, i) => ({ ...m, label: markerLabel(i) }));
}
