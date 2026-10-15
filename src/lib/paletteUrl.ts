import { parseImageUrl } from "./imageSource";

export interface Point {
  x: number;
  y: number;
}

export interface PaletteUrlState {
  img: string;
  /** Slider value, in whole percent. */
  minPercent: number;
  /** Markers the user placed, in image pixel coordinates. */
  added: Point[];
  /** Scanned colors the user removed, as 6-digit lowercase hex without "#". */
  hidden: string[];
}

export const MIN_PERCENT = 1;
export const MAX_PERCENT = 10;
export const DEFAULT_MIN_PERCENT = 3;

function clampPercent(value: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value)));
}

function parsePoints(text: string): Point[] {
  const seen = new Set<string>();
  return text.split(";").flatMap((pair) => {
    const match = /^(\d+),(\d+)$/.exec(pair.trim());
    // Repeats are dropped: each point is one marker, removed as one.
    if (!match || seen.has(match[0])) return [];
    seen.add(match[0]);
    return [{ x: Number(match[1]), y: Number(match[2]) }];
  });
}

/** Reads `?img=…&min=…&add=…&hide=…`; null when there's no usable image URL. */
export function parsePaletteSearch(search: string): PaletteUrlState | null {
  const params = new URLSearchParams(search);
  const img = parseImageUrl(params.get("img") ?? "");
  if (!img) return null;

  const min = Number(params.get("min"));
  return {
    img,
    minPercent:
      params.has("min") && Number.isFinite(min)
        ? clampPercent(min)
        : DEFAULT_MIN_PERCENT,
    added: parsePoints(params.get("add") ?? ""),
    hidden: (params.get("hide") ?? "")
      .split(",")
      .map((hex) => hex.trim().toLowerCase())
      .filter((hex) => /^[0-9a-f]{6}$/.test(hex)),
  };
}

export function buildPaletteSearch(state: PaletteUrlState): string {
  // Built by hand so points and hexes stay readable (",;" unescaped).
  const parts = [`img=${encodeURIComponent(state.img)}`, `min=${state.minPercent}`];
  if (state.added.length) {
    parts.push(`add=${state.added.map((p) => `${p.x},${p.y}`).join(";")}`);
  }
  if (state.hidden.length) parts.push(`hide=${state.hidden.join(",")}`);
  return `?${parts.join("&")}`;
}
