import { Lab, deltaE, hexToRgb, rgbToLab } from "./color";
import { kMeans, medianCutSeeds, MIN_ALPHA, PixelGrid } from "./palette";
import { BeadColor, beadByName, ponyBeadColors } from "./ponyBeadColors";

export type ColorMode =
  | { mode: "bw" }
  | { mode: "bgw" }
  | { mode: "match"; count: number };

export interface BeadChartOptions {
  /** Beads across. */
  width: number;
  /** Beads down. */
  height: number;
  colors: ColorMode;
  removeBackground: boolean;
  outline: boolean;
}

export interface BeadChart {
  width: number;
  height: number;
  /** Row-major, one entry per cell: an index into `palette`, or -1 for empty. */
  cells: Int16Array;
  /** The beads the chart uses, in catalog order. */
  palette: BeadColor[];
  /** How many of each bead the chart needs, parallel to `palette`. */
  counts: number[];
}

/** Long side, in pixels, images are shrunk to once before charts are built. */
export const BEAD_SOURCE_MAX_SIDE = 400;
/** Cells within this distance (ΔE) of the border's color are background. */
export const BACKGROUND_DELTA_E = 18;
/**
 * Fraction of the border that must share one color for it to count as a
 * background. A busy border (a photo of a room) removes nothing rather than
 * eating into the subject.
 */
export const BORDER_AGREEMENT = 0.5;
/** Most colors "Match image" can use: the spec's 12, or the whole catalog if smaller. */
export const MATCH_MAX_COLORS = Math.min(12, ponyBeadColors.length);
/** Passes of the speck cleanup filter. */
export const CLEANUP_PASSES = 2;
/**
 * A bead only joins the color around it when the two are closer than this
 * (ΔE): Orange in Red (41) is absorbed, Black in White (87) is kept.
 */
export const SPECK_DELTA_E = 45;
/** Below this lightness range the subject is one shade, and k-means has nothing to split. */
const SINGLE_SHADE_RANGE = 10;
const LIGHTNESS_ITERATIONS = 20;

/** A cell's average color, or null when the cell is mostly transparent. */
type CellColor = Lab | null;

/** The source pixels a cell (or shrunk pixel) at `i` of `cells` covers, along one axis. */
function span(i: number, cells: number, pixels: number): [number, number] {
  const start = Math.min(pixels - 1, Math.floor((i * pixels) / cells));
  // An image smaller than the grid leaves some cells covering no whole
  // pixel; they take the pixel they start in.
  const end = Math.max(start + 1, Math.floor(((i + 1) * pixels) / cells));
  return [start, end];
}

/**
 * Area-averages an image down to `maxSide` on its long side, once per image,
 * so that rebuilding the chart on every setting change stays fast. Never
 * enlarges.
 */
export function shrinkImage(pixels: PixelGrid, maxSide: number): PixelGrid {
  const factor = Math.max(pixels.width, pixels.height) / maxSide;
  if (factor <= 1) return pixels;
  const width = Math.max(1, Math.round(pixels.width / factor));
  const height = Math.max(1, Math.round(pixels.height / factor));
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const [y0, y1] = span(y, height, pixels.height);
    for (let x = 0; x < width; x++) {
      const [x0, x1] = span(x, width, pixels.width);
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const o = (sy * pixels.width + sx) * 4;
          // Weight color by alpha so transparent pixels don't darken edges.
          const alpha = pixels.data[o + 3];
          r += pixels.data[o] * alpha;
          g += pixels.data[o + 1] * alpha;
          b += pixels.data[o + 2] * alpha;
          a += alpha;
        }
      }
      const n = (x1 - x0) * (y1 - y0);
      const o = (y * width + x) * 4;
      if (a > 0) data.set([r / a, g / a, b / a, a / n], o);
    }
  }
  return { width, height, data };
}

function reduceToCells(pixels: PixelGrid, width: number, height: number): CellColor[] {
  const cells: CellColor[] = new Array(width * height);
  for (let y = 0; y < height; y++) {
    const [y0, y1] = span(y, height, pixels.height);
    for (let x = 0; x < width; x++) {
      const [x0, x1] = span(x, width, pixels.width);
      let r = 0, g = 0, b = 0, opaque = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const o = (sy * pixels.width + sx) * 4;
          if (pixels.data[o + 3] < MIN_ALPHA) continue;
          r += pixels.data[o];
          g += pixels.data[o + 1];
          b += pixels.data[o + 2];
          opaque++;
        }
      }
      const total = (x1 - x0) * (y1 - y0);
      cells[y * width + x] =
        opaque * 2 < total
          ? null
          : rgbToLab({ r: r / opaque, g: g / opaque, b: b / opaque });
    }
  }
  return cells;
}

function neighbors4(i: number, width: number, height: number): number[] {
  const x = i % width;
  const y = (i - x) / width;
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < width - 1) out.push(i + 1);
  if (y > 0) out.push(i - width);
  if (y < height - 1) out.push(i + width);
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Marks the cells connected to the grid's edge that share the border's
 * color. Returns all-false when the border is busy.
 */
function findBackground(cells: CellColor[], width: number, height: number): Uint8Array {
  const background = new Uint8Array(cells.length);
  const edge: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const x = i % width;
    const y = (i - x) / width;
    const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (onEdge && cells[i]) edge.push(i);
  }
  if (edge.length === 0) return background;

  const reference: Lab = {
    l: median(edge.map((i) => cells[i]!.l)),
    a: median(edge.map((i) => cells[i]!.a)),
    b: median(edge.map((i) => cells[i]!.b)),
  };
  const isBackground = (i: number) =>
    cells[i] !== null && deltaE(cells[i]!, reference) < BACKGROUND_DELTA_E;
  const seeds = edge.filter(isBackground);
  if (seeds.length < BORDER_AGREEMENT * edge.length) return background;

  for (const i of seeds) background[i] = 1;
  for (let q = 0; q < seeds.length; q++) {
    for (const n of neighbors4(seeds[q], width, height)) {
      if (!background[n] && isBackground(n)) {
        background[n] = 1;
        seeds.push(n);
      }
    }
  }
  return background;
}

function catalogIndex(name: string): number {
  return ponyBeadColors.indexOf(beadByName(name));
}

const beadLab = ponyBeadColors.map((b) => rgbToLab(hexToRgb(b.hex)));

/**
 * Black/white and black/grey/white: splits the subject by lightness, so a
 * color photo keeps its light and dark areas. Writes catalog indices.
 */
function assignByLightness(
  cells: CellColor[],
  subject: number[],
  presetNames: string[],
  beads: Int16Array
) {
  const preset = presetNames.map(catalogIndex);
  const ls = subject.map((i) => cells[i]!.l);
  if (ls.length === 0) return;

  const sorted = [...ls].sort((a, b) => a - b);
  if (sorted[sorted.length - 1] - sorted[0] < SINGLE_SHADE_RANGE) {
    // One shade: take the preset bead nearest in lightness.
    subject.forEach((cell, j) => {
      let best = preset[0];
      for (const p of preset) {
        if (Math.abs(beadLab[p].l - ls[j]) < Math.abs(beadLab[best].l - ls[j])) best = p;
      }
      beads[cell] = best;
    });
    return;
  }

  // 1-D k-means on lightness, seeded at evenly spaced quantiles.
  const k = preset.length;
  let centers = Array.from(
    { length: k },
    (_, c) => sorted[Math.floor(((c + 0.5) / k) * sorted.length)]
  );
  const assignment = new Int32Array(ls.length);
  const nearestCenter = (l: number) => {
    let best = 0;
    for (let c = 1; c < k; c++) {
      if (Math.abs(centers[c] - l) < Math.abs(centers[best] - l)) best = c;
    }
    return best;
  };
  for (let iter = 0; iter < LIGHTNESS_ITERATIONS; iter++) {
    const sums = new Array(k).fill(0);
    const counts = new Array(k).fill(0);
    ls.forEach((l, j) => {
      assignment[j] = nearestCenter(l);
      sums[assignment[j]] += l;
      counts[assignment[j]]++;
    });
    centers = centers.map((c, i) => (counts[i] ? sums[i] / counts[i] : c));
  }

  // Darkest cluster takes the first (darkest) preset bead, and so on.
  const rank = new Int32Array(k);
  [...centers.keys()]
    .sort((a, b) => centers[a] - centers[b])
    .forEach((c, r) => (rank[c] = r));
  subject.forEach((cell, j) => (beads[cell] = preset[rank[assignment[j]]]));
}

function nearestBead(lab: Lab, candidates: number[]): number {
  let best = candidates[0];
  for (const b of candidates) {
    if (deltaE(lab, beadLab[b]) < deltaE(lab, beadLab[best])) best = b;
  }
  return best;
}

/**
 * Match image: clusters the subject's colors and snaps each cluster, largest
 * first, to its nearest catalog bead. Clusters that snap to a bead already
 * taken merge into it, so fewer than `count` beads may come back. Writes
 * catalog indices.
 */
function assignByMatch(
  cells: CellColor[],
  subject: number[],
  count: number,
  beads: Int16Array
) {
  if (subject.length === 0) return;
  const k = Math.max(1, Math.min(MATCH_MAX_COLORS, Math.round(count)));
  const points = subject.map((i) => cells[i]!);
  const { centroids, assignment } = kMeans(points, medianCutSeeds(points, k));

  const sizes = new Array(centroids.length).fill(0);
  for (const c of assignment) sizes[c]++;
  const allBeads = [...ponyBeadColors.keys()];
  const chosen = new Set<number>();
  [...centroids.keys()]
    .filter((c) => sizes[c] > 0)
    .sort((a, b) => sizes[b] - sizes[a] || a - b)
    .forEach((c) => chosen.add(nearestBead(centroids[c], allBeads)));

  const candidates = [...chosen];
  for (const i of subject) beads[i] = nearestBead(cells[i]!, candidates);
}

/**
 * Gives each bead the most common bead in its 3×3 neighborhood, keeping its
 * own on a tie, but only when the two are close shades: stray specks join
 * the area around them, while a high-contrast single bead (an eye) stays.
 */
function cleanUpSpecks(beads: Int16Array, width: number, height: number) {
  const counts = new Map<number, number>();
  for (let pass = 0; pass < CLEANUP_PASSES; pass++) {
    const source = beads.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const own = source[y * width + x];
        if (own < 0) continue;
        counts.clear();
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            const b = source[ny * width + nx];
            if (b >= 0) counts.set(b, (counts.get(b) ?? 0) + 1);
          }
        }
        let best = own;
        let bestCount = counts.get(own)!;
        for (const [b, n] of counts) {
          if (n > bestCount) {
            best = b;
            bestCount = n;
          }
        }
        if (best !== own && deltaE(beadLab[own], beadLab[best]) < SPECK_DELTA_E) {
          beads[y * width + x] = best;
        }
      }
    }
  }
}

/** Turns subject beads next to an empty cell into the darkest bead in use. */
function outlineSubject(beads: Int16Array, width: number, height: number) {
  let darkest = -1;
  for (const b of beads) {
    if (b >= 0 && (darkest < 0 || beadLab[b].l < beadLab[darkest].l)) darkest = b;
  }
  if (darkest < 0) return;

  const source = beads.slice();
  source.forEach((b, i) => {
    if (b >= 0 && neighbors4(i, width, height).some((n) => source[n] < 0)) {
      beads[i] = darkest;
    }
  });
}

/** Turns catalog indices per cell into the chart's own palette, counts and cells. */
function finish(beads: Int16Array, width: number, height: number): BeadChart {
  const catalogCounts = new Array(ponyBeadColors.length).fill(0);
  for (const b of beads) if (b >= 0) catalogCounts[b]++;

  const paletteIndex = new Int16Array(ponyBeadColors.length).fill(-1);
  const palette: BeadColor[] = [];
  const counts: number[] = [];
  catalogCounts.forEach((n, b) => {
    if (!n) return;
    paletteIndex[b] = palette.length;
    palette.push(ponyBeadColors[b]);
    counts.push(n);
  });

  const cells = beads.map((b) => (b < 0 ? -1 : paletteIndex[b]));
  return { width, height, cells, palette, counts };
}

/** Turns an image into a pony bead chart. Deterministic. */
export function buildBeadChart(pixels: PixelGrid, opts: BeadChartOptions): BeadChart {
  const { width, height } = opts;
  const cells = reduceToCells(pixels, width, height);
  const background = opts.removeBackground
    ? findBackground(cells, width, height)
    : new Uint8Array(cells.length);

  const subject: number[] = [];
  cells.forEach((c, i) => {
    if (c && !background[i]) subject.push(i);
  });

  // Catalog index per cell, -1 for empty.
  const beads = new Int16Array(cells.length).fill(-1);
  switch (opts.colors.mode) {
    case "bw":
      assignByLightness(cells, subject, ["Black", "White"], beads);
      break;
    case "bgw":
      assignByLightness(cells, subject, ["Black", "Gray", "White"], beads);
      break;
    case "match":
      assignByMatch(cells, subject, opts.colors.count, beads);
      break;
  }

  cleanUpSpecks(beads, width, height);
  if (opts.outline && opts.removeBackground) outlineSubject(beads, width, height);

  return finish(beads, width, height);
}
