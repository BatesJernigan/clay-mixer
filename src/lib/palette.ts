import { Lab, RGB, deltaE, rgbToHex, rgbToLab } from "./color";

export interface PixelGrid {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel: the layout of ImageData.data. */
  data: Uint8ClampedArray;
}

export interface PaletteColor {
  /** A real pixel color from the image, as "#rrggbb". */
  hex: string;
  /** Fraction (0–1) of the image's opaque pixels that belong to this color. */
  share: number;
  /** Where to put this color's marker, in image pixel coordinates. */
  x: number;
  y: number;
}

export interface ImageAnalysis {
  /** Every color the image breaks down into, largest share first. */
  colors: PaletteColor[];
}

/** Long side, in pixels, of the reduced copy the analysis runs on. */
export const ANALYSIS_MAX_SIDE = 200;
/** How many clusters k-means starts from, before merging. */
export const INITIAL_CLUSTERS = 16;
export const KMEANS_MAX_ITERATIONS = 12;
/** Clusters whose centers are closer than this (ΔE) are one color. */
export const MERGE_DELTA_E = 10;
export const MAX_SCANNED_COLORS = 10;

const MIN_ALPHA = 128;

interface Sample {
  width: number;
  height: number;
  /** Image pixels per sample pixel, horizontally and vertically. */
  scaleX: number;
  scaleY: number;
  /** Indices of the opaque sample pixels. */
  opaque: number[];
  rgb: RGB[];
  lab: Lab[];
}

interface Cluster {
  lab: Lab;
  /** Pixels assigned to the cluster; 0 once it has been merged away. */
  count: number;
}

export function pixelHex(pixels: PixelGrid, x: number, y: number): string {
  const o = (y * pixels.width + x) * 4;
  return rgbToHex({
    r: pixels.data[o],
    g: pixels.data[o + 1],
    b: pixels.data[o + 2],
  });
}

/** Breaks an image down into its colors. Tens of ms: run once per image. */
export function analyzeImage(pixels: PixelGrid): ImageAnalysis {
  const sample = downsample(pixels);
  if (sample.opaque.length === 0) return { colors: [] };

  const points = sample.opaque.map((i) => sample.lab[i]);
  const { centroids, assignment } = kMeans(
    points,
    medianCutSeeds(points, INITIAL_CLUSTERS)
  );

  const labels = new Int32Array(sample.width * sample.height).fill(-1);
  sample.opaque.forEach((pixel, j) => (labels[pixel] = assignment[j]));
  const clusters: Cluster[] = centroids.map((lab) => ({ lab, count: 0 }));
  for (const c of assignment) clusters[c].count++;

  mergeNearDuplicates(clusters, labels);

  const colors = locateColors(clusters, labels, sample, pixels).sort(
    (a, b) => b.share - a.share || a.hex.localeCompare(b.hex)
  );
  return { colors };
}

/** The colors covering at least `minShare` of the image. Cheap: run on every slider change. */
export function extractPalette(
  analysis: ImageAnalysis,
  { minShare }: { minShare: number }
): PaletteColor[] {
  return analysis.colors
    .filter((c) => c.share >= minShare - 1e-9)
    .slice(0, MAX_SCANNED_COLORS);
}

function downsample(pixels: PixelGrid): Sample {
  const factor = Math.max(
    1,
    Math.max(pixels.width, pixels.height) / ANALYSIS_MAX_SIDE
  );
  const width = Math.max(1, Math.round(pixels.width / factor));
  const height = Math.max(1, Math.round(pixels.height / factor));
  const scaleX = pixels.width / width;
  const scaleY = pixels.height / height;

  const opaque: number[] = [];
  const rgb: RGB[] = new Array(width * height);
  const lab: Lab[] = new Array(width * height);
  const labCache = new Map<number, Lab>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Nearest-neighbor rather than averaging: averaging would turn stippled
      // or dithered areas into solid patches of an in-between color.
      const sx = Math.min(pixels.width - 1, Math.floor((x + 0.5) * scaleX));
      const sy = Math.min(pixels.height - 1, Math.floor((y + 0.5) * scaleY));
      const o = (sy * pixels.width + sx) * 4;
      if (pixels.data[o + 3] < MIN_ALPHA) continue;

      const r = pixels.data[o];
      const g = pixels.data[o + 1];
      const b = pixels.data[o + 2];
      const packed = (r << 16) | (g << 8) | b;
      let l = labCache.get(packed);
      if (!l) {
        l = rgbToLab({ r, g, b });
        labCache.set(packed, l);
      }

      const i = y * width + x;
      opaque.push(i);
      rgb[i] = { r, g, b };
      lab[i] = l;
    }
  }
  return { width, height, scaleX, scaleY, opaque, rgb, lab };
}

const CHANNELS = ["l", "a", "b"] as const;

function meanLab(points: Lab[]): Lab {
  const sum = { l: 0, a: 0, b: 0 };
  for (const p of points) {
    sum.l += p.l;
    sum.a += p.a;
    sum.b += p.b;
  }
  return {
    l: sum.l / points.length,
    a: sum.a / points.length,
    b: sum.b / points.length,
  };
}

/**
 * Deterministic k-means seeds: repeatedly halve the box with the widest
 * channel range at its median. Same input, same seeds, same palette, which
 * shared links depend on.
 */
function medianCutSeeds(points: Lab[], k: number): Lab[] {
  const boxes: Lab[][] = [points];
  while (boxes.length < k) {
    let best = -1;
    let bestRange = 0;
    let bestChannel: (typeof CHANNELS)[number] = "l";
    boxes.forEach((box, i) => {
      for (const c of CHANNELS) {
        let min = Infinity;
        let max = -Infinity;
        for (const p of box) {
          if (p[c] < min) min = p[c];
          if (p[c] > max) max = p[c];
        }
        if (max - min > bestRange) {
          best = i;
          bestRange = max - min;
          bestChannel = c;
        }
      }
    });
    if (best < 0) break; // every box is a single color

    const sorted = [...boxes[best]].sort(
      (p, q) => p[bestChannel] - q[bestChannel]
    );
    const mid = Math.floor(sorted.length / 2);
    boxes.splice(best, 1, sorted.slice(0, mid), sorted.slice(mid));
  }
  return boxes.map(meanLab);
}

function nearest(p: Lab, centers: Lab[]): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const d = deltaE(p, centers[i]);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  }
  return best;
}

function kMeans(points: Lab[], seeds: Lab[]) {
  let centroids = seeds;
  const assignment = new Int32Array(points.length);
  for (let iter = 0; iter < KMEANS_MAX_ITERATIONS; iter++) {
    let changed = iter === 0;
    points.forEach((p, i) => {
      const c = nearest(p, centroids);
      if (c !== assignment[i]) {
        assignment[i] = c;
        changed = true;
      }
    });
    if (!changed) break;

    const members: Lab[][] = centroids.map(() => []);
    points.forEach((p, i) => members[assignment[i]].push(p));
    // An emptied cluster keeps its old center; it ends with a count of 0.
    centroids = members.map((m, i) => (m.length ? meanLab(m) : centroids[i]));
  }
  return { centroids, assignment };
}

function relabel(labels: Int32Array, from: number, to: number) {
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === from) labels[i] = to;
  }
}

function mergeNearDuplicates(clusters: Cluster[], labels: Int32Array) {
  for (;;) {
    let bestI = -1;
    let bestJ = -1;
    let bestDistance = MERGE_DELTA_E;
    for (let i = 0; i < clusters.length; i++) {
      if (!clusters[i].count) continue;
      for (let j = i + 1; j < clusters.length; j++) {
        if (!clusters[j].count) continue;
        const d = deltaE(clusters[i].lab, clusters[j].lab);
        if (d < bestDistance) {
          bestI = i;
          bestJ = j;
          bestDistance = d;
        }
      }
    }
    if (bestI < 0) return;

    const a = clusters[bestI];
    const b = clusters[bestJ];
    const n = a.count + b.count;
    a.lab = {
      l: (a.lab.l * a.count + b.lab.l * b.count) / n,
      a: (a.lab.a * a.count + b.lab.a * b.count) / n,
      b: (a.lab.b * a.count + b.lab.b * b.count) / n,
    };
    a.count = n;
    b.count = 0;
    relabel(labels, bestJ, bestI);
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * For each cluster, picks the swatch (the real pixel nearest the median color
 * of its largest patch) and the marker spot (the point of that patch farthest
 * from its edge).
 */
function locateColors(
  clusters: Cluster[],
  labels: Int32Array,
  sample: Sample,
  pixels: PixelGrid
): PaletteColor[] {
  const { width, height } = sample;
  const component = new Int32Array(labels.length).fill(-1);
  const largest = new Map<number, number[]>(); // cluster -> pixels of its largest patch

  const neighbors = (i: number): number[] => {
    const x = i % width;
    const y = (i - x) / width;
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < width - 1) out.push(i + 1);
    if (y > 0) out.push(i - width);
    if (y < height - 1) out.push(i + width);
    return out;
  };

  let nextComponent = 0;
  for (let start = 0; start < labels.length; start++) {
    const c = labels[start];
    if (c < 0 || component[start] >= 0) continue;
    const id = nextComponent++;
    const members = [start];
    component[start] = id;
    for (let q = 0; q < members.length; q++) {
      for (const n of neighbors(members[q])) {
        if (component[n] < 0 && labels[n] === c) {
          component[n] = id;
          members.push(n);
        }
      }
    }
    if (members.length > (largest.get(c)?.length ?? 0)) largest.set(c, members);
  }

  const total = sample.opaque.length;
  const colors: PaletteColor[] = [];
  for (const [c, members] of largest) {
    const id = component[members[0]];

    const target = {
      l: median(members.map((i) => sample.lab[i].l)),
      a: median(members.map((i) => sample.lab[i].a)),
      b: median(members.map((i) => sample.lab[i].b)),
    };
    let swatch = members[0];
    for (const i of members) {
      if (deltaE(sample.lab[i], target) < deltaE(sample.lab[swatch], target)) {
        swatch = i;
      }
    }

    // Distance from the patch edge (or image border), by breadth-first search
    // inward from the edge pixels.
    const distance = new Map<number, number>();
    const queue: number[] = [];
    for (const i of members) {
      const n = neighbors(i);
      if (n.length < 4 || n.some((j) => component[j] !== id)) {
        distance.set(i, 0);
        queue.push(i);
      }
    }
    let deepest = queue[0];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const d = distance.get(i)!;
      const deepestD = distance.get(deepest)!;
      if (d > deepestD || (d === deepestD && i < deepest)) deepest = i;
      for (const j of neighbors(i)) {
        if (component[j] === id && !distance.has(j)) {
          distance.set(j, d + 1);
          queue.push(j);
        }
      }
    }

    const sx = deepest % width;
    const sy = (deepest - sx) / width;
    colors.push({
      hex: rgbToHex(sample.rgb[swatch]),
      share: clusters[c].count / total,
      x: Math.min(pixels.width - 1, Math.floor((sx + 0.5) * sample.scaleX)),
      y: Math.min(pixels.height - 1, Math.floor((sy + 0.5) * sample.scaleY)),
    });
  }
  return colors;
}
