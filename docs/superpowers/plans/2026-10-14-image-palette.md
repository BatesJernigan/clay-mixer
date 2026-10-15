# Image Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/palette` page that loads an image from a URL or the clipboard, finds its predominant colors, marks each with a lettered dot (A, B, C…), lets the user add/remove markers with a zoom loupe, and shows a clay recipe for each marker.

**Architecture:** Pure, unit-tested logic in `src/lib/` — `palette.ts` (color extraction), `imageSource.ts` (decode URL/Blob into pixels), `paletteUrl.ts` (share-link state), `markers.ts` (lettered marker list). Two presentational components — `ImageMarkerCanvas` (image, dots, loupe, picking) and `PaletteMarkerList` (rows + collapsible recipes) — wired together by a client page at `src/app/palette/page.tsx`. Everything runs in the browser; the app stays a static export.

**Tech Stack:** Next.js 16.3.6 (App Router, `output: "export"`), React 19.2, TypeScript, Tailwind 4, Vitest (new, dev-only).

**Spec:** `docs/superpowers/specs/2026-10-14-image-palette-design.md`

## Global Constraints

- Before writing page/component code, read the relevant guide in `node_modules/next/dist/docs/` (per `AGENTS.md`: this Next.js version has breaking changes).
- Static export only (`output: "export"` in `next.config.ts`): no server routes, no API routes. All image loading and analysis runs in the browser.
- Client pages read query state from `window.location` inside an effect (the pattern in `src/app/mix/page.tsx`), not `useSearchParams`.
- Dark mode works by flipping the palette in `src/app/globals.css` (`white`, `black` and the `neutral-*` scale invert). Use the existing classes (`bg-white`, `border-neutral-200`, `text-neutral-900`, …) for page chrome. Marker dots and the loupe must use **inline styles** for white/black outlines, since Tailwind's white/black flip.
- No new runtime dependencies. The only new dev dependency is `vitest`.
- Slider: range 1–10%, step 1, default 3%.
- Extraction constants: `ANALYSIS_MAX_SIDE = 200`, `INITIAL_CLUSTERS = 16`, `KMEANS_MAX_ITERATIONS = 12`, `MERGE_DELTA_E = 10`, `MAJORITY_PASSES = 2`, `MAX_SCANNED_COLORS = 10`. Decode cap: `MAX_DECODE_SIDE = 4096`.
- Recipes: `computeRecipe(inStockColors, hex, { maxColors: 6 })` — the same in-stock library and color limit as `/mix`.
- Share URL: `/palette/?img=<encoded url>&min=3&add=412,880;95,1200&hide=5a0f12`.
- Error copy, verbatim from the spec:
  - "Couldn't load an image from that link."
  - "This site doesn't allow its images to be read. Right-click the image → Copy Image, then paste it here."
  - "No single color covers N% of this image — try lowering the slider."
- Commit messages follow the repo style (plain imperative sentence, e.g. "Add colors-used bar and out-of-stock filtering") and end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM
  ```
- Run commands from the repo root. Node is managed by mise (`mise run <task>`); plain `npm` works too.

## Review Focus

Inputs the spec implies that are most likely to bite a real user. Each has a test in the task named.

1. **Huge photos** (a 48 MP phone photo, 8000×6000): must load without exhausting tab memory, so decoding is capped at 4096 px on the long side. Test: `fitWithin` (Task 3).
2. **Transparent PNG/WebP** (logos, stickers): transparent pixels must be ignored, not counted as black, and a fully transparent image yields no colors without crashing. Test: transparency cases (Task 1).
3. **Pasting text into the URL field**: the page-wide paste handler must only take images, so pasting a link into the field still works. Test: `imageFromClipboard` with text-only clipboard (Task 3).
4. **Messy URL input** (leading/trailing spaces, no `https://`, `javascript:`): trim, accept only http(s), otherwise show the invalid-link message. Test: `parseImageUrl` (Task 3).
5. **Hand-edited or stale share links** (`min=abc`, `min=50`, garbage in `add`/`hide`, picks outside the image): ignore the bad parts and keep the rest. Tests: `parsePaletteSearch` (Task 4), out-of-bounds picks in `buildMarkers` (Task 4).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `vitest.config.mts` | create | Vitest config with the `@/` alias |
| `package.json` | modify | `test` script, `vitest` dev dependency |
| `mise.toml` | modify | `test` task |
| `src/lib/palette.ts` | create | `PixelGrid`, `analyzeImage`, `extractPalette`, `pixelHex` |
| `src/lib/palette.test.ts` | create | Extraction tests on synthetic grids |
| `src/lib/imageSource.ts` | create | `loadImagePixels`, `ImageLoadError`, `parseImageUrl`, `fitWithin`, `imageFromClipboard` |
| `src/lib/imageSource.test.ts` | create | Tests for the pure helpers |
| `src/lib/paletteUrl.ts` | create | `Point`, share-link parse/build, slider bounds |
| `src/lib/markers.ts` | create | `Marker`, `markerLabel`, `buildMarkers` |
| `src/lib/paletteUrl.test.ts`, `src/lib/markers.test.ts` | create | Tests |
| `src/components/ImageMarkerCanvas.tsx` | create | Image canvas, lettered dots, loupe, click / press-and-hold picking |
| `src/components/PaletteMarkerList.tsx` | create | Marker rows, remove buttons, collapsible recipes |
| `src/app/palette/page.tsx` | create | Page state, wiring, share link, paste |
| `src/components/NavBar.tsx` | modify | "Palette" nav link |

---

### Task 1: Vitest setup and core color extraction

**Files:**
- Create: `vitest.config.mts`, `src/lib/palette.ts`, `src/lib/palette.test.ts`
- Modify: `package.json` (scripts + devDependencies), `mise.toml`

**Interfaces:**
- Consumes: `Lab`, `RGB`, `deltaE`, `rgbToHex`, `rgbToLab` from `src/lib/color.ts` (existing).
- Produces:
  ```ts
  interface PixelGrid { width: number; height: number; data: Uint8ClampedArray } // RGBA
  interface PaletteColor { hex: string; share: number; x: number; y: number }
  interface ImageAnalysis { colors: PaletteColor[] }
  function analyzeImage(pixels: PixelGrid): ImageAnalysis
  function extractPalette(analysis: ImageAnalysis, opts: { minShare: number }): PaletteColor[]
  function pixelHex(pixels: PixelGrid, x: number, y: number): string // "#rrggbb"
  const MAX_SCANNED_COLORS = 10
  ```

- [ ] **Step 1: Install Vitest and wire up the scripts**

Run: `npm install --save-dev vitest`

In `package.json` `"scripts"`, add after `"lint": "eslint",`:
```json
    "test": "vitest run",
```

Create `vitest.config.mts`:
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

In `mise.toml`, add after the `[tasks.lint]` block:
```toml
[tasks.test]
description = "Run unit tests"
depends = ["install"]
run = "npm test"
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/palette.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { analyzeImage, extractPalette, pixelHex, PixelGrid } from "./palette";

type RGBA = [number, number, number, number?];

function grid(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => RGBA
): PixelGrid {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = colorAt(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const RED: RGBA = [255, 0, 0];
const BLUE: RGBA = [0, 0, 255];
const GREEN: RGBA = [0, 160, 0];
const CORAL: RGBA = [0xe8, 0x39, 0x4f];
const MAROON: RGBA = [0x5a, 0x0f, 0x12];
const MID: RGBA = [0xa1, 0x24, 0x30]; // halfway between coral and maroon
const CLEAR: RGBA = [0, 0, 0, 0];

describe("analyzeImage", () => {
  it("recovers solid blocks with exact hexes and shares", () => {
    const img = grid(100, 100, (x) => (x < 50 ? RED : BLUE));
    const colors = extractPalette(analyzeImage(img), { minShare: 0.03 });
    expect(colors.map((c) => [c.hex, c.share])).toEqual([
      ["#0000ff", 0.5],
      ["#ff0000", 0.5],
    ]);
  });

  it("keeps a solid band of an in-between color", () => {
    const img = grid(90, 90, (_x, y) => (y < 35 ? CORAL : y < 55 ? MID : MAROON));
    const colors = extractPalette(analyzeImage(img), { minShare: 0.03 });
    expect(colors.map((c) => c.hex).sort()).toEqual([
      "#5a0f12",
      "#a12430",
      "#e8394f",
    ]);
  });

  it("places the dot inside the largest patch, in original-image coordinates", () => {
    // 400px wide, so the analysis runs on a 200px copy and must scale back up.
    const img = grid(400, 400, (x, y) =>
      (x >= 200 && x < 320 && y >= 40 && y < 160) || (x < 20 && y >= 380)
        ? BLUE
        : RED
    );
    const blue = analyzeImage(img).colors.find((c) => c.hex === "#0000ff")!;
    // Center of the big square is (260, 100); allow a few px either way.
    expect(blue.x).toBeGreaterThanOrEqual(240);
    expect(blue.x).toBeLessThan(280);
    expect(blue.y).toBeGreaterThanOrEqual(80);
    expect(blue.y).toBeLessThan(120);
  });

  it("ignores transparent pixels", () => {
    const img = grid(100, 100, (x) => (x < 50 ? CLEAR : RED));
    expect(analyzeImage(img).colors.map((c) => [c.hex, c.share])).toEqual([
      ["#ff0000", 1],
    ]);
  });

  it("returns no colors for a fully transparent image", () => {
    expect(analyzeImage(grid(10, 10, () => CLEAR)).colors).toEqual([]);
  });

  it("handles a 1×1 image", () => {
    expect(analyzeImage(grid(1, 1, () => RED)).colors).toEqual([
      { hex: "#ff0000", share: 1, x: 0, y: 0 },
    ]);
  });

  it("is deterministic, so shared links reproduce the same palette", () => {
    const img = grid(300, 200, (x, y) => [
      (x * 7) % 256,
      (y * 5) % 256,
      ((x + y) * 3) % 256,
    ]);
    expect(analyzeImage(img)).toEqual(analyzeImage(img));
  });
});

describe("extractPalette", () => {
  it("drops colors below the minimum share", () => {
    const img = grid(100, 100, (x, y) => (x < 20 && y < 10 ? GREEN : RED)); // green = 2%
    const analysis = analyzeImage(img);
    expect(extractPalette(analysis, { minShare: 0.03 }).map((c) => c.hex)).toEqual([
      "#ff0000",
    ]);
    expect(extractPalette(analysis, { minShare: 0.01 }).map((c) => c.hex)).toEqual([
      "#ff0000",
      "#00a000",
    ]);
  });
});

describe("pixelHex", () => {
  it("reads one pixel", () => {
    expect(pixelHex(grid(2, 1, (x) => (x ? BLUE : RED)), 1, 0)).toBe("#0000ff");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. `src/lib/palette.test.ts` cannot resolve `./palette`.

- [ ] **Step 4: Implement `src/lib/palette.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 9 tests in `src/lib/palette.test.ts`.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.mts package.json package-lock.json mise.toml src/lib/palette.ts src/lib/palette.test.ts
git commit -m "Add image color extraction with Vitest tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM"
```

---

### Task 2: Absorb in-between pixels with a majority filter

Stipple mid-tones, anti-aliased edges and JPEG noise form their own small clusters, and without this step they show up as palette colors.

**Files:**
- Modify: `src/lib/palette.ts`
- Test: `src/lib/palette.test.ts`

**Interfaces:**
- Consumes: Task 1's `analyzeImage` internals (`labels`, `clusters`, `sample`).
- Produces: `export const MAJORITY_PASSES = 2`. No signature changes.

- [ ] **Step 1: Write the failing test**

In `src/lib/palette.test.ts`, inside `describe("analyzeImage", …)`, after the "keeps a solid band of an in-between color" test, add:
```ts
  it("absorbs isolated pixels of an in-between color", () => {
    // Every third pixel on every third row is MID: 11% of the image, but
    // never two MID pixels side by side, like stipple or anti-aliasing.
    const img = grid(90, 90, (x, y) =>
      x % 3 === 1 && y % 3 === 1 ? MID : y < 45 ? CORAL : MAROON
    );
    const colors = extractPalette(analyzeImage(img), { minShare: 0.03 });
    expect(colors.map((c) => c.hex).sort()).toEqual(["#5a0f12", "#e8394f"]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/palette.test.ts -t "absorbs isolated"`
Expected: FAIL. The received list also contains `"#a12430"`.

- [ ] **Step 3: Implement the filter**

In `src/lib/palette.ts`, after `export const MERGE_DELTA_E = 10;`, add:
```ts
/**
 * Passes of the 3×3 majority filter. Each pass hands scattered pixels
 * (stipple, anti-aliased edges, JPEG noise) to the color around them.
 */
export const MAJORITY_PASSES = 2;
```

In `analyzeImage`, replace:
```ts
  mergeNearDuplicates(clusters, labels);
```
with:
```ts
  mergeNearDuplicates(clusters, labels);
  for (let pass = 0; pass < MAJORITY_PASSES; pass++) {
    majorityFilter(labels, sample.width, sample.height);
  }
  for (const cluster of clusters) cluster.count = 0;
  for (const c of labels) if (c >= 0) clusters[c].count++;
```

Add this function directly above `function median(`:
```ts
/**
 * Gives each pixel the most common label in its 3×3 neighborhood, keeping its
 * own on a tie. Solid regions are untouched; isolated pixels of an in-between
 * color are absorbed into whatever surrounds them.
 */
function majorityFilter(labels: Int32Array, width: number, height: number) {
  const source = labels.slice();
  const counts = new Map<number, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const own = source[y * width + x];
      if (own < 0) continue;
      counts.clear();
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const c = source[ny * width + nx];
          if (c >= 0) counts.set(c, (counts.get(c) ?? 0) + 1);
        }
      }
      let best = own;
      let bestCount = counts.get(own)!;
      for (const [c, n] of counts) {
        if (n > bestCount) {
          best = c;
          bestCount = n;
        }
      }
      labels[y * width + x] = best;
    }
  }
}
```

Also update the `Cluster.count` doc comment to: `/** Pixels assigned to the cluster; 0 once it has been merged or filtered away. */`

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS, 10 tests. (The solid-band and 1×1 tests confirm the filter leaves solid regions and tiny images alone.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/palette.ts src/lib/palette.test.ts
git commit -m "Absorb stipple and edge pixels into surrounding colors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM"
```

---

### Task 3: Image loading from a URL or a Blob

**Files:**
- Create: `src/lib/imageSource.ts`, `src/lib/imageSource.test.ts`

**Interfaces:**
- Consumes: `PixelGrid` from `src/lib/palette.ts` (Task 1).
- Produces:
  ```ts
  const MAX_DECODE_SIDE = 4096
  type ImageLoadErrorKind = "invalid-url" | "load-failed" | "blocked"
  class ImageLoadError extends Error { readonly kind: ImageLoadErrorKind }
  function parseImageUrl(text: string): string | null
  function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number }
  function imageFromClipboard(data: { items: ArrayLike<ClipboardItemLike> } | null): File | null
  function loadImagePixels(source: string | Blob): Promise<PixelGrid>
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/imageSource.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fitWithin, imageFromClipboard, parseImageUrl } from "./imageSource";

describe("parseImageUrl", () => {
  it("accepts http(s) URLs and trims whitespace", () => {
    expect(
      parseImageUrl("  https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg \n")
    ).toBe("https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg");
    expect(parseImageUrl("http://example.com/a.webp")).toBe("http://example.com/a.webp");
  });

  it("rejects text that isn't an http(s) URL", () => {
    expect(parseImageUrl("")).toBeNull();
    expect(parseImageUrl("m.media-amazon.com/images/x.jpg")).toBeNull();
    expect(parseImageUrl("javascript:alert(1)")).toBeNull();
    expect(parseImageUrl("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("fitWithin", () => {
  it("leaves images that already fit alone", () => {
    expect(fitWithin(1000, 1500, 4096)).toEqual({ width: 1000, height: 1500 });
  });

  it("scales the long side down to the limit, keeping the aspect ratio", () => {
    expect(fitWithin(8000, 6000, 4096)).toEqual({ width: 4096, height: 3072 });
    expect(fitWithin(3000, 9000, 4096)).toEqual({ width: 1365, height: 4096 });
  });

  it("never rounds a side down to zero", () => {
    expect(fitWithin(1, 10000, 4096)).toEqual({ width: 1, height: 4096 });
  });
});

describe("imageFromClipboard", () => {
  const item = (kind: string, type: string, file: File | null = null) => ({
    kind,
    type,
    getAsFile: () => file,
  });

  it("returns null without clipboard data", () => {
    expect(imageFromClipboard(null)).toBeNull();
  });

  it("returns null for text-only pastes, so pasting into the URL field still works", () => {
    expect(
      imageFromClipboard({
        items: [item("string", "text/plain"), item("string", "text/html")],
      })
    ).toBeNull();
  });

  it("returns the first image file", () => {
    const png = new File([new Uint8Array([1])], "image.png", { type: "image/png" });
    expect(
      imageFromClipboard({
        items: [item("string", "text/html"), item("file", "image/png", png)],
      })
    ).toBe(png);
  });

  it("ignores non-image files", () => {
    const pdf = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    expect(
      imageFromClipboard({ items: [item("file", "application/pdf", pdf)] })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/imageSource.test.ts`
Expected: FAIL. Cannot resolve `./imageSource`.

- [ ] **Step 3: Implement `src/lib/imageSource.ts`**

```ts
import { PixelGrid } from "./palette";

/** Images are decoded no larger than this on their long side, to bound memory. */
export const MAX_DECODE_SIDE = 4096;

export type ImageLoadErrorKind = "invalid-url" | "load-failed" | "blocked";

export class ImageLoadError extends Error {
  readonly kind: ImageLoadErrorKind;

  constructor(kind: ImageLoadErrorKind) {
    super(`Image load failed: ${kind}`);
    this.name = "ImageLoadError";
    this.kind = kind;
  }
}

/** The trimmed URL if `text` is an http(s) URL, otherwise null. */
export function parseImageUrl(text: string): string | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function fitWithin(
  width: number,
  height: number,
  maxSide: number
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

interface ClipboardItemLike {
  kind: string;
  type: string;
  getAsFile(): File | null;
}

/** The first image file in a paste, or null if it holds only text or other files. */
export function imageFromClipboard(
  data: { items: ArrayLike<ClipboardItemLike> } | null
): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

function decode(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageLoadError("load-failed"));
    img.src = src;
  });
}

/**
 * A cross-origin image whose host sends no CORS headers fails to load
 * outright when requested with `crossOrigin`. Loading it again without tells
 * "this site blocks reading its images" apart from "there's no image here".
 */
async function decodeRemote(url: string): Promise<HTMLImageElement> {
  try {
    return await decode(url, true);
  } catch {
    await decode(url, false); // rethrows load-failed if there's no image at all
    throw new ImageLoadError("blocked");
  }
}

/** Decodes an image URL, or an uploaded/pasted file, into RGBA pixels. */
export async function loadImagePixels(source: string | Blob): Promise<PixelGrid> {
  let img: HTMLImageElement;
  if (typeof source === "string") {
    const url = parseImageUrl(source);
    if (!url) throw new ImageLoadError("invalid-url");
    img = await decodeRemote(url);
  } else {
    const objectUrl = URL.createObjectURL(source);
    try {
      img = await decode(objectUrl, false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const { width, height } = fitWithin(
    img.naturalWidth,
    img.naturalHeight,
    MAX_DECODE_SIDE
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  try {
    return { width, height, data: ctx.getImageData(0, 0, width, height).data };
  } catch {
    // SecurityError: the canvas is tainted by a cross-origin image.
    throw new ImageLoadError("blocked");
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. All `palette` and `imageSource` tests are green.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint` (expected: no errors), then:
```bash
git add src/lib/imageSource.ts src/lib/imageSource.test.ts
git commit -m "Load image pixels from a URL or a pasted file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM"
```

`loadImagePixels` touches the DOM and is verified in the browser in Task 5.

---

### Task 4: Share-link state and the lettered marker list

**Files:**
- Create: `src/lib/paletteUrl.ts`, `src/lib/paletteUrl.test.ts`, `src/lib/markers.ts`, `src/lib/markers.test.ts`

**Interfaces:**
- Consumes: `parseImageUrl` (Task 3); `PaletteColor`, `PixelGrid`, `pixelHex` (Task 1).
- Produces:
  ```ts
  // paletteUrl.ts
  interface Point { x: number; y: number }
  interface PaletteUrlState { img: string; minPercent: number; added: Point[]; hidden: string[] }
  const MIN_PERCENT = 1, MAX_PERCENT = 10, DEFAULT_MIN_PERCENT = 3
  function parsePaletteSearch(search: string): PaletteUrlState | null
  function buildPaletteSearch(state: PaletteUrlState): string // starts with "?"

  // markers.ts
  interface Marker {
    key: string; label: string; hex: string; x: number; y: number;
    source: "scan" | "pick"; share: number | null;
  }
  function markerLabel(index: number): string
  function buildMarkers(scanned: PaletteColor[], picked: Point[], hidden: string[], pixels: PixelGrid): Marker[]
  ```
  `hidden` entries are 6-digit lowercase hex **without** `#` (as in the URL). `Marker.hex` has the `#`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/paletteUrl.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  buildPaletteSearch,
  DEFAULT_MIN_PERCENT,
  parsePaletteSearch,
  PaletteUrlState,
} from "./paletteUrl";

const IMG = "https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg";

describe("buildPaletteSearch / parsePaletteSearch", () => {
  it("round-trips the full state", () => {
    const state: PaletteUrlState = {
      img: IMG,
      minPercent: 4,
      added: [
        { x: 412, y: 880 },
        { x: 95, y: 1200 },
      ],
      hidden: ["5a0f12", "ee3a4b"],
    };
    const search = buildPaletteSearch(state);
    expect(search).toBe(
      `?img=${encodeURIComponent(IMG)}&min=4&add=412,880;95,1200&hide=5a0f12,ee3a4b`
    );
    expect(parsePaletteSearch(search)).toEqual(state);
  });

  it("omits empty add and hide lists", () => {
    expect(
      buildPaletteSearch({ img: IMG, minPercent: 3, added: [], hidden: [] })
    ).toBe(`?img=${encodeURIComponent(IMG)}&min=3`);
  });

  it("round-trips image URLs that have their own query string", () => {
    const img = "https://example.com/pic.jpg?w=800&h=600";
    const search = buildPaletteSearch({ img, minPercent: 3, added: [], hidden: [] });
    expect(parsePaletteSearch(search)?.img).toBe(img);
  });
});

describe("parsePaletteSearch", () => {
  it("returns null without a usable image URL", () => {
    expect(parsePaletteSearch("")).toBeNull();
    expect(parsePaletteSearch("?min=3")).toBeNull();
    expect(parsePaletteSearch("?img=not-a-url")).toBeNull();
  });

  it("defaults or clamps a bad minimum share", () => {
    const img = `img=${encodeURIComponent(IMG)}`;
    expect(parsePaletteSearch(`?${img}`)?.minPercent).toBe(DEFAULT_MIN_PERCENT);
    expect(parsePaletteSearch(`?${img}&min=abc`)?.minPercent).toBe(DEFAULT_MIN_PERCENT);
    expect(parsePaletteSearch(`?${img}&min=50`)?.minPercent).toBe(10);
    expect(parsePaletteSearch(`?${img}&min=0`)?.minPercent).toBe(1);
    expect(parsePaletteSearch(`?${img}&min=2.6`)?.minPercent).toBe(3);
  });

  it("skips malformed points and hexes but keeps the good ones", () => {
    const parsed = parsePaletteSearch(
      `?img=${encodeURIComponent(IMG)}&add=10,20;oops;-5,3;7,8,9;30,40&hide=5A0F12,zzzzzz,123`
    );
    expect(parsed?.added).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    expect(parsed?.hidden).toEqual(["5a0f12"]);
  });
});
```

Create `src/lib/markers.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildMarkers, markerLabel } from "./markers";
import { PaletteColor, PixelGrid } from "./palette";

describe("markerLabel", () => {
  it("counts A–Z, then AA, AB…", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(markerLabel)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });
});

describe("buildMarkers", () => {
  // 4×2 image: top row red, bottom row blue.
  const data = new Uint8ClampedArray(4 * 2 * 4);
  for (let i = 0; i < 8; i++) data.set(i < 4 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
  const pixels: PixelGrid = { width: 4, height: 2, data };

  const scanned: PaletteColor[] = [
    { hex: "#ee3a4b", share: 0.56, x: 1, y: 0 },
    { hex: "#60050a", share: 0.3, x: 2, y: 1 },
  ];

  it("letters scanned colors first, then picks in the order added", () => {
    const markers = buildMarkers(scanned, [{ x: 3, y: 1 }], [], pixels);
    expect(markers.map((m) => [m.label, m.hex, m.source, m.share])).toEqual([
      ["A", "#ee3a4b", "scan", 0.56],
      ["B", "#60050a", "scan", 0.3],
      ["C", "#0000ff", "pick", null],
    ]);
  });

  it("drops hidden scanned colors and reletters the rest", () => {
    const markers = buildMarkers(scanned, [{ x: 0, y: 0 }], ["ee3a4b"], pixels);
    expect(markers.map((m) => [m.label, m.hex])).toEqual([
      ["A", "#60050a"],
      ["B", "#ff0000"],
    ]);
  });

  it("drops picks outside the image, as from a link made for another image", () => {
    const markers = buildMarkers([], [{ x: 4, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 1 }], [], pixels);
    expect(markers.map((m) => [m.x, m.y])).toEqual([[1, 1]]);
  });

  it("gives every marker a distinct key", () => {
    const markers = buildMarkers(scanned, [{ x: 0, y: 0 }, { x: 1, y: 0 }], [], pixels);
    expect(new Set(markers.map((m) => m.key)).size).toBe(markers.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/paletteUrl.test.ts src/lib/markers.test.ts`
Expected: FAIL. Cannot resolve `./paletteUrl` and `./markers`.

- [ ] **Step 3: Implement `src/lib/paletteUrl.ts`**

```ts
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
  return text.split(";").flatMap((pair) => {
    const match = /^(\d+),(\d+)$/.exec(pair.trim());
    return match ? [{ x: Number(match[1]), y: Number(match[2]) }] : [];
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
```

- [ ] **Step 4: Implement `src/lib/markers.ts`**

```ts
import { PaletteColor, PixelGrid, pixelHex } from "./palette";
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
    .filter((c) => !hidden.includes(c.hex.slice(1)))
    .map((c) => ({
      key: `scan-${c.hex}-${c.x}-${c.y}`,
      hex: c.hex,
      x: c.x,
      y: c.y,
      source: "scan" as const,
      share: c.share,
    }));
  const fromPicks = picked
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < pixels.width && p.y < pixels.height)
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. All four test files are green.

- [ ] **Step 6: Lint and commit**

Run: `npm run lint` (expected: no errors), then:
```bash
git add src/lib/paletteUrl.ts src/lib/paletteUrl.test.ts src/lib/markers.ts src/lib/markers.test.ts
git commit -m "Add palette share-link state and lettered markers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM"
```

---

### Task 5: Palette page with markers, loupe and slider

**Files:**
- Create: `src/components/ImageMarkerCanvas.tsx`, `src/components/PaletteMarkerList.tsx`, `src/app/palette/page.tsx`
- Modify: `src/components/NavBar.tsx:6-10`

**Interfaces:**
- Consumes: `analyzeImage`, `extractPalette`, `pixelHex`, `PixelGrid` (Task 1); `loadImagePixels`, `ImageLoadError`, `ImageLoadErrorKind`, `parseImageUrl` (Task 3); `buildMarkers`, `Marker`, `Point`, `MIN_PERCENT`, `MAX_PERCENT`, `DEFAULT_MIN_PERCENT` (Task 4); `hexToLab` (existing `color.ts`); `ColorSwatch` (existing).
- Produces:
  ```ts
  // ImageMarkerCanvas.tsx
  function markerBadgeStyle(hex: string): CSSProperties
  function ImageMarkerCanvas(props: {
    pixels: PixelGrid; markers: Marker[]; highlightedKey: string | null;
    onHover: (key: string | null) => void; onPick: (x: number, y: number) => void;
  }): JSX.Element
  // PaletteMarkerList.tsx (this task's version; Task 6 adds `recipes`)
  function PaletteMarkerList(props: {
    markers: Marker[]; highlightedKey: string | null;
    onHover: (key: string | null) => void; onRemove: (marker: Marker) => void;
  }): JSX.Element | null
  ```

- [ ] **Step 1: Read the Next.js docs for this version**

Skim the client-component and static-export guides under `node_modules/next/dist/docs/` (find them with `ls node_modules/next/dist/docs/`). Note anything that contradicts the code below, especially `"use client"` pages and `output: "export"`, and adjust if needed.

- [ ] **Step 2: Create `src/components/ImageMarkerCanvas.tsx`**

```tsx
"use client";

import { CSSProperties, PointerEvent, useEffect, useRef, useState } from "react";
import { hexToLab } from "@/lib/color";
import { Marker } from "@/lib/markers";
import { PixelGrid, pixelHex } from "@/lib/palette";

/** Pixels across the loupe, and how large each one is drawn. */
const LOUPE_PIXELS = 11;
const LOUPE_ZOOM = 12;
const LOUPE_SIZE = LOUPE_PIXELS * LOUPE_ZOOM;
/** Gap between the pointer and the loupe. */
const LOUPE_OFFSET = 24;
/** How long a finger must rest before the loupe appears… */
const HOLD_MS = 300;
/** …and how far it may drift first before the touch counts as a scroll. */
const HOLD_SLOP_PX = 10;

/**
 * Inline rather than Tailwind: dark mode flips the white/black tokens, but a
 * marker needs a white ring and dark shadow on any image in either theme.
 */
export function markerBadgeStyle(hex: string): CSSProperties {
  return {
    backgroundColor: hex,
    color: hexToLab(hex).l > 60 ? "#000000" : "#ffffff",
    border: "2px solid #ffffff",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)",
  };
}

interface Loupe {
  /** Image pixel under the pointer. */
  x: number;
  y: number;
  /** Pointer position within the image box, in CSS pixels. */
  left: number;
  top: number;
  boxWidth: number;
  touch: boolean;
}

interface ImageMarkerCanvasProps {
  pixels: PixelGrid;
  markers: Marker[];
  highlightedKey: string | null;
  onHover: (key: string | null) => void;
  /** Called with image pixel coordinates when the user places a marker. */
  onPick: (x: number, y: number) => void;
}

export function ImageMarkerCanvas({
  pixels,
  markers,
  highlightedKey,
  onHover,
  onPick,
}: ImageMarkerCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [loupe, setLoupe] = useState<Loupe | null>(null);
  const hold = useRef<{ timer: number; startX: number; startY: number } | null>(null);
  // Mirrors "a touch loupe is showing" for the native touchmove listener.
  const touchLoupe = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height),
        0,
        0
      );
  }, [pixels]);

  useEffect(() => {
    const canvas = loupeRef.current;
    if (!canvas || !loupe) return;
    const ctx = canvas.getContext("2d")!;
    const half = Math.floor(LOUPE_PIXELS / 2);
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = loupe.x + dx;
        const y = loupe.y + dy;
        if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) continue;
        ctx.fillStyle = pixelHex(pixels, x, y);
        ctx.fillRect((dx + half) * LOUPE_ZOOM, (dy + half) * LOUPE_ZOOM, LOUPE_ZOOM, LOUPE_ZOOM);
      }
    }
    // Outline the pixel that will be picked, legible on light and dark.
    const at = half * LOUPE_ZOOM;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(at, at, LOUPE_ZOOM, LOUPE_ZOOM);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(at - 1.5, at - 1.5, LOUPE_ZOOM + 3, LOUPE_ZOOM + 3);
  }, [loupe, pixels]);

  useEffect(() => {
    // Once the touch loupe is up, finger movement steers it instead of
    // scrolling the page. React's touch listeners are passive, so this one
    // is attached natively.
    const box = boxRef.current;
    if (!box) return;
    const block = (e: TouchEvent) => {
      if (touchLoupe.current) e.preventDefault();
    };
    box.addEventListener("touchmove", block, { passive: false });
    return () => box.removeEventListener("touchmove", block);
  }, []);

  useEffect(
    () => () => {
      if (hold.current) clearTimeout(hold.current.timer);
    },
    []
  );

  const locate = (clientX: number, clientY: number, touch: boolean): Loupe => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const left = clientX - rect.left;
    const top = clientY - rect.top;
    return {
      x: Math.min(pixels.width - 1, Math.max(0, Math.floor((left / rect.width) * pixels.width))),
      y: Math.min(pixels.height - 1, Math.max(0, Math.floor((top / rect.height) * pixels.height))),
      left,
      top,
      boxWidth: rect.width,
      touch,
    };
  };

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  };

  const endTouchLoupe = () => {
    cancelHold();
    touchLoupe.current = false;
    setLoupe(null);
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return; // mouse picks on click
    const { clientX, clientY } = e;
    cancelHold();
    hold.current = {
      startX: clientX,
      startY: clientY,
      timer: window.setTimeout(() => {
        touchLoupe.current = true;
        setLoupe(locate(clientX, clientY, true));
      }, HOLD_MS),
    };
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      setLoupe(locate(e.clientX, e.clientY, false));
    } else if (touchLoupe.current) {
      setLoupe(locate(e.clientX, e.clientY, true));
    } else if (
      hold.current &&
      Math.hypot(e.clientX - hold.current.startX, e.clientY - hold.current.startY) > HOLD_SLOP_PX
    ) {
      cancelHold(); // the finger is scrolling, not holding
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      const { x, y } = locate(e.clientX, e.clientY, false);
      onPick(x, y);
      return;
    }
    const wasShowing = touchLoupe.current;
    endTouchLoupe();
    if (wasShowing) {
      const { x, y } = locate(e.clientX, e.clientY, true);
      onPick(x, y);
    }
  };

  const loupeLeft = loupe
    ? loupe.touch
      ? Math.min(Math.max(0, loupe.left - LOUPE_SIZE / 2), loupe.boxWidth - LOUPE_SIZE)
      : loupe.left + LOUPE_OFFSET + LOUPE_SIZE <= loupe.boxWidth
        ? loupe.left + LOUPE_OFFSET
        : loupe.left - LOUPE_OFFSET - LOUPE_SIZE
    : 0;
  const loupeTop = loupe
    ? loupe.touch
      ? loupe.top - LOUPE_SIZE - 2 * LOUPE_OFFSET // clear of the finger
      : loupe.top + LOUPE_OFFSET
    : 0;

  return (
    <div
      ref={boxRef}
      className="relative cursor-crosshair select-none"
      style={{ WebkitTouchCallout: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={endTouchLoupe}
      onPointerCancel={endTouchLoupe}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block h-auto w-full rounded-lg" />

      {markers.map((marker) => (
        <button
          key={marker.key}
          type="button"
          aria-label={`Marker ${marker.label}, ${marker.hex}`}
          onPointerEnter={() => onHover(marker.key)}
          onPointerLeave={() => onHover(null)}
          // Clicking a dot shouldn't drop a new marker underneath it.
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-transform"
          style={{
            ...markerBadgeStyle(marker.hex),
            left: `${((marker.x + 0.5) / pixels.width) * 100}%`,
            top: `${((marker.y + 0.5) / pixels.height) * 100}%`,
            transform: `translate(-50%, -50%) scale(${marker.key === highlightedKey ? 1.35 : 1})`,
          }}
        >
          {marker.label}
        </button>
      ))}

      {loupe && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col items-center gap-1"
          style={{ left: loupeLeft, top: loupeTop }}
        >
          <canvas
            ref={loupeRef}
            width={LOUPE_SIZE}
            height={LOUPE_SIZE}
            className="rounded-full"
            style={{
              boxShadow:
                "0 0 0 2px #ffffff, 0 0 0 3px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.35)",
            }}
          />
          <span
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{ color: "#ffffff", background: "rgba(0,0,0,0.75)" }}
          >
            {pixelHex(pixels, loupe.x, loupe.y)}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/PaletteMarkerList.tsx`**

```tsx
"use client";

import { Marker } from "@/lib/markers";
import { ColorSwatch } from "./ColorSwatch";
import { markerBadgeStyle } from "./ImageMarkerCanvas";

interface PaletteMarkerListProps {
  markers: Marker[];
  highlightedKey: string | null;
  onHover: (key: string | null) => void;
  onRemove: (marker: Marker) => void;
}

export function PaletteMarkerList({
  markers,
  highlightedKey,
  onHover,
  onRemove,
}: PaletteMarkerListProps) {
  if (markers.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {markers.map((marker) => (
        <li
          key={marker.key}
          onPointerEnter={() => onHover(marker.key)}
          onPointerLeave={() => onHover(null)}
          className={`rounded-lg border bg-white p-4 ${
            marker.key === highlightedKey ? "border-neutral-900" : "border-neutral-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={markerBadgeStyle(marker.hex)}
            >
              {marker.label}
            </span>
            <ColorSwatch hex={marker.hex} size={32} />
            <span className="font-mono text-sm text-neutral-900">{marker.hex}</span>
            <span className="text-xs text-neutral-500">
              {marker.share === null ? "picked" : `${Math.round(marker.share * 100)}%`}
            </span>
            <button
              type="button"
              onClick={() => onRemove(marker)}
              aria-label={`Remove marker ${marker.label}`}
              className="ml-auto rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Create `src/app/palette/page.tsx`**

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { ImageMarkerCanvas } from "@/components/ImageMarkerCanvas";
import { PaletteMarkerList } from "@/components/PaletteMarkerList";
import {
  ImageLoadError,
  ImageLoadErrorKind,
  loadImagePixels,
  parseImageUrl,
} from "@/lib/imageSource";
import { buildMarkers, Marker } from "@/lib/markers";
import { analyzeImage, extractPalette, PixelGrid } from "@/lib/palette";
import {
  DEFAULT_MIN_PERCENT,
  MAX_PERCENT,
  MIN_PERCENT,
  Point,
} from "@/lib/paletteUrl";

interface LoadedImage {
  pixels: PixelGrid;
  /** The image's URL, or null for a pasted image, which can't go in a share link. */
  sourceUrl: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: ImageLoadErrorKind; pasted: boolean };

function errorMessage(error: ImageLoadErrorKind, pasted: boolean): string {
  if (error === "blocked") {
    return "This site doesn't allow its images to be read. Right-click the image → Copy Image, then paste it here.";
  }
  return pasted ? "Couldn't read the pasted image." : "Couldn't load an image from that link.";
}

export default function PalettePage() {
  const [urlInput, setUrlInput] = useState("");
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [minPercent, setMinPercent] = useState(DEFAULT_MIN_PERCENT);
  const [picked, setPicked] = useState<Point[]>([]);
  // Scanned colors the user removed, as hex without "#".
  const [hidden, setHidden] = useState<string[]>([]);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const loadId = useRef(0);

  const load = async (source: string | Blob) => {
    const id = ++loadId.current;
    const pasted = typeof source !== "string";
    setStatus({ kind: "loading" });
    try {
      const pixels = await loadImagePixels(source);
      // A newer scan started while this one loaded; let it win.
      if (id !== loadId.current) return;
      setImage({
        pixels,
        sourceUrl: typeof source === "string" ? parseImageUrl(source) : null,
      });
      setPicked([]);
      setHidden([]);
      setHighlightedKey(null);
      setStatus({ kind: "idle" });
    } catch (err) {
      if (id !== loadId.current) return;
      setStatus({
        kind: "error",
        error: err instanceof ImageLoadError ? err.kind : "load-failed",
        pasted,
      });
    }
  };

  // Analysis runs once per image; the slider only re-filters its result.
  const analysis = useMemo(() => (image ? analyzeImage(image.pixels) : null), [image]);
  const scanned = useMemo(
    () => (analysis ? extractPalette(analysis, { minShare: minPercent / 100 }) : []),
    [analysis, minPercent]
  );
  const markers = useMemo(
    () => (image ? buildMarkers(scanned, picked, hidden, image.pixels) : []),
    [image, scanned, picked, hidden]
  );

  const addMarker = (x: number, y: number) =>
    setPicked((prev) =>
      prev.some((p) => p.x === x && p.y === y) ? prev : [...prev, { x, y }]
    );

  const removeMarker = (marker: Marker) => {
    if (marker.source === "pick") {
      setPicked((prev) => prev.filter((p) => p.x !== marker.x || p.y !== marker.y));
    } else {
      setHidden((prev) => [...prev, marker.hex.slice(1)]);
    }
    setHighlightedKey(null);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Image Palette</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pull the main colors out of an image and get a clay recipe for each.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(urlInput);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="text"
            inputMode="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            aria-label="Image URL"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <button
            type="submit"
            disabled={status.kind === "loading" || !urlInput.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {status.kind === "loading" ? "Scanning…" : "Scan"}
          </button>
        </form>
        {status.kind === "error" && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(status.error, status.pasted)}
          </p>
        )}
      </div>

      {image && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:sticky md:top-6 md:self-start">
            <ImageMarkerCanvas
              pixels={image.pixels}
              markers={markers}
              highlightedKey={highlightedKey}
              onHover={setHighlightedKey}
              onPick={addMarker}
            />
            <p className="mt-2 text-xs text-neutral-500">
              Click the image to add a marker. On a phone, press and hold.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Minimum share: {minPercent}%
              <input
                type="range"
                min={MIN_PERCENT}
                max={MAX_PERCENT}
                step={1}
                value={minPercent}
                onChange={(e) => setMinPercent(Number(e.target.value))}
                className="accent-neutral-900"
              />
            </label>

            {scanned.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
                No single color covers {minPercent}% of this image — try lowering the slider.
              </p>
            )}

            <PaletteMarkerList
              markers={markers}
              highlightedKey={highlightedKey}
              onHover={setHighlightedKey}
              onRemove={removeMarker}
            />
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Add the nav link**

In `src/components/NavBar.tsx`, replace:
```ts
const links = [
  { href: "/mix", label: "Mixer" },
  { href: "/library", label: "Library" },
```
with:
```ts
const links = [
  { href: "/mix", label: "Mixer" },
  { href: "/palette", label: "Palette" },
  { href: "/library", label: "Library" },
```

- [ ] **Step 6: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: no lint errors; all tests pass; the build succeeds and lists `/palette` among the static routes.

- [ ] **Step 7: Verify in the browser**

Run `mise run dev`, open `http://localhost:3000/palette/`, and check each item. Use the Playwright MCP tools if available; for the touch checks, use device emulation or a real phone on the LAN.

1. Paste `https://m.media-amazon.com/images/I/81OBhRM2tjL._SL1500_.jpg` and click **Scan**. The cover appears with markers **A, B, C**: coral (~`#ee3a4b`), maroon (~`#60050a`) and yellow-green (~`#e1e22f`). Each dot sits on its color, not on an edge.
2. Drag the slider to 1%. Two more markers appear (a dark coral and a white near "SARAH"). Back at 3% they go away. The slider stays smooth while dragging.
3. Hover the image. The loupe follows the cursor, the center pixel is outlined, and the hex under it shows. Near the right edge the loupe flips to the left of the cursor.
4. Click a yellow letter. A new marker **D** appears with the "picked" label. Clicking an existing dot does **not** add a marker.
5. Hovering a list row enlarges its dot; hovering a dot outlines its row.
6. Remove **B** with ×. Its dot disappears and the others are relettered. Remove the picked marker; it disappears.
7. Enter `not a url` and Scan: "Couldn't load an image from that link." Enter `https://example.com/nothing.jpg`: the same message.
8. Find an image on a host that sends no CORS headers (e.g. try an image on `https://upload.wikimedia.org` first; if that works, try images on other sites until one is blocked). Expected: "This site doesn't allow its images to be read. Right-click the image → Copy Image, then paste it here."
9. Touch emulation: a quick swipe over the image scrolls the page. Press and hold for ~0.3 s: the loupe appears above the finger, dragging steers it without scrolling, and lifting drops a marker.
10. Toggle the OS to dark mode. The dots still show a white ring, and the page chrome follows the dark palette.

- [ ] **Step 8: Commit**

```bash
git add src/components/ImageMarkerCanvas.tsx src/components/PaletteMarkerList.tsx src/app/palette/page.tsx src/components/NavBar.tsx
git commit -m "Add image palette page with lettered markers and loupe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM"
```

---

### Task 6: Recipes under each marker

**Files:**
- Modify: `src/components/PaletteMarkerList.tsx` (replace whole file), `src/app/palette/page.tsx`

**Interfaces:**
- Consumes: `computeRecipe(library: ClayColor[], targetHex: string, options?: { maxColors?: number }): Recipe | null` from `src/lib/mix.ts` (existing; returns the closest recipe found across 1…`maxColors` clays); `Recipe` from `src/lib/types.ts`; `RecipeResult`, `ColorSwatch` (existing); `useLibrary()` → `{ colors, inStockColors, loaded }` (existing).
- Produces: `PaletteMarkerList` gains a prop `recipes: Map<string, Recipe | null> | null`. Keyed by marker hex: a missing key means the recipe is still computing, `null` means no in-stock clays, and a `null` map means no library, so recipe sections are hidden.

- [ ] **Step 1: Replace `src/components/PaletteMarkerList.tsx`**

```tsx
"use client";

import { Marker } from "@/lib/markers";
import { Recipe } from "@/lib/types";
import { ColorSwatch } from "./ColorSwatch";
import { markerBadgeStyle } from "./ImageMarkerCanvas";
import { RecipeResult } from "./RecipeResult";

interface PaletteMarkerListProps {
  markers: Marker[];
  /**
   * Best recipe per marker hex. A missing hex is still being computed; null
   * means there are no in-stock clays. A null map (empty library) hides
   * recipes entirely.
   */
  recipes: Map<string, Recipe | null> | null;
  highlightedKey: string | null;
  onHover: (key: string | null) => void;
  onRemove: (marker: Marker) => void;
}

export function PaletteMarkerList({
  markers,
  recipes,
  highlightedKey,
  onHover,
  onRemove,
}: PaletteMarkerListProps) {
  if (markers.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {markers.map((marker) => (
        <li
          key={marker.key}
          onPointerEnter={() => onHover(marker.key)}
          onPointerLeave={() => onHover(null)}
          className={`rounded-lg border bg-white p-4 ${
            marker.key === highlightedKey ? "border-neutral-900" : "border-neutral-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={markerBadgeStyle(marker.hex)}
            >
              {marker.label}
            </span>
            <ColorSwatch hex={marker.hex} size={32} />
            <span className="font-mono text-sm text-neutral-900">{marker.hex}</span>
            <span className="text-xs text-neutral-500">
              {marker.share === null ? "picked" : `${Math.round(marker.share * 100)}%`}
            </span>
            <button
              type="button"
              onClick={() => onRemove(marker)}
              aria-label={`Remove marker ${marker.label}`}
              className="ml-auto rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
            >
              ×
            </button>
          </div>

          {recipes && (
            <MarkerRecipe recipe={recipes.get(marker.hex)} targetHex={marker.hex} />
          )}
        </li>
      ))}
    </ul>
  );
}

function MarkerRecipe({
  recipe,
  targetHex,
}: {
  recipe: Recipe | null | undefined;
  targetHex: string;
}) {
  if (recipe === undefined) {
    return <p className="mt-3 text-sm text-neutral-500">Mixing…</p>;
  }
  if (recipe === null) {
    return <p className="mt-3 text-sm text-neutral-500">No in-stock clays to mix from.</p>;
  }
  return (
    <details className="group mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-sm text-neutral-700">
        <span className="text-neutral-400 transition-transform group-open:rotate-90">▸</span>
        <ColorSwatch hex={recipe.predictedHex} size={20} />
        <span className="min-w-0 flex-1 truncate">
          {recipe.ingredients.map((i) => `${i.parts} ${i.clay.name}`).join(" + ")}
        </span>
        <span className="shrink-0 text-xs text-neutral-500">
          ΔE {recipe.deltaE.toFixed(1)}
        </span>
      </summary>
      <div className="mt-3">
        <RecipeResult recipe={recipe} targetHex={targetHex} />
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Compute recipes in the page**

In `src/app/palette/page.tsx`:

Replace the first import line:
```tsx
import { useMemo, useRef, useState } from "react";
```
with:
```tsx
import { useDeferredValue, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLibrary } from "@/context/LibraryContext";
```

After the `@/lib/palette` import, add:
```tsx
import { computeRecipe } from "@/lib/mix";
import { Recipe } from "@/lib/types";
```

After the `Status` type, add:
```tsx
const MAX_RECIPE_COLORS = 6;
```

As the first line inside `PalettePage()`, add:
```tsx
  const { colors: library, inStockColors, loaded } = useLibrary();
```

Directly after the `markers` `useMemo`, add:
```tsx
  // Recipes take tens of ms each, so they trail marker changes instead of
  // making the slider stutter.
  const recipeHexes = useDeferredValue(markers.map((m) => m.hex).join(","));
  const recipes = useMemo(() => {
    const byHex = new Map<string, Recipe | null>();
    for (const hex of recipeHexes ? recipeHexes.split(",") : []) {
      if (!byHex.has(hex)) {
        byHex.set(hex, computeRecipe(inStockColors, hex, { maxColors: MAX_RECIPE_COLORS }));
      }
    }
    return byHex;
  }, [recipeHexes, inStockColors]);
```

Directly before `{image && (`, add the empty-library prompt (same wording style as `/mix`):
```tsx
      {loaded && library.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
          <p className="text-sm text-neutral-700">
            Your library is empty, so there are no recipes yet. Add some clay colors first.
          </p>
          <Link
            href="/library"
            className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Go to Library
          </Link>
        </div>
      )}

```

In the `<PaletteMarkerList … />` element, add after `markers={markers}`:
```tsx
              recipes={loaded && library.length > 0 ? recipes : null}
```

- [ ] **Step 3: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: all pass.

- [ ] **Step 4: Verify in the browser**

With `mise run dev` running, at `http://localhost:3000/palette/`:
1. Scan the reference image. Each row briefly shows "Mixing…", then a collapsed summary: predicted swatch, "N Clay + M Clay", ΔE.
2. Expand a row with ▸. The full `RecipeResult` card appears, the same as on `/mix`. Collapse it again.
3. Open `http://localhost:3000/mix/ee3a4b/` in another tab. Its closest recipe matches marker A's recipe.
4. On `/library`, mark every color out of stock, then return. Rows say "No in-stock clays to mix from." Restore them.
5. Drag the slider quickly. It stays smooth, and recipes catch up after.

- [ ] **Step 5: Commit**

```bash
git add src/components/PaletteMarkerList.tsx src/app/palette/page.tsx
git commit -m "Show a clay recipe under each palette marker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM"
```

---

### Task 7: Share links and pasting images

**Files:**
- Modify: `src/app/palette/page.tsx` (replace whole file)

**Interfaces:**
- Consumes: `parsePaletteSearch`, `buildPaletteSearch` (Task 4); `imageFromClipboard` (Task 3); everything Task 6's page used.
- Produces: the final page. `load(source, saved?)` restores marker state from a share link.

- [ ] **Step 1: Replace `src/app/palette/page.tsx`**

```tsx
"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useLibrary } from "@/context/LibraryContext";
import { ImageMarkerCanvas } from "@/components/ImageMarkerCanvas";
import { PaletteMarkerList } from "@/components/PaletteMarkerList";
import {
  ImageLoadError,
  ImageLoadErrorKind,
  imageFromClipboard,
  loadImagePixels,
  parseImageUrl,
} from "@/lib/imageSource";
import { buildMarkers, Marker } from "@/lib/markers";
import { analyzeImage, extractPalette, PixelGrid } from "@/lib/palette";
import { computeRecipe } from "@/lib/mix";
import { Recipe } from "@/lib/types";
import {
  buildPaletteSearch,
  DEFAULT_MIN_PERCENT,
  MAX_PERCENT,
  MIN_PERCENT,
  parsePaletteSearch,
  Point,
} from "@/lib/paletteUrl";

interface LoadedImage {
  pixels: PixelGrid;
  /** The image's URL, or null for a pasted image, which can't go in a share link. */
  sourceUrl: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: ImageLoadErrorKind; pasted: boolean };

/** Marker state restored from a share link. */
interface SavedMarkers {
  minPercent: number;
  picked: Point[];
  hidden: string[];
}

const MAX_RECIPE_COLORS = 6;

function errorMessage(error: ImageLoadErrorKind, pasted: boolean): string {
  if (error === "blocked") {
    return "This site doesn't allow its images to be read. Right-click the image → Copy Image, then paste it here.";
  }
  return pasted ? "Couldn't read the pasted image." : "Couldn't load an image from that link.";
}

export default function PalettePage() {
  const { colors: library, inStockColors, loaded } = useLibrary();
  const [urlInput, setUrlInput] = useState("");
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [minPercent, setMinPercent] = useState(DEFAULT_MIN_PERCENT);
  const [picked, setPicked] = useState<Point[]>([]);
  // Scanned colors the user removed, as hex without "#".
  const [hidden, setHidden] = useState<string[]>([]);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const loadId = useRef(0);

  const load = useCallback(async (source: string | Blob, saved?: SavedMarkers) => {
    const id = ++loadId.current;
    const pasted = typeof source !== "string";
    setStatus({ kind: "loading" });
    try {
      const pixels = await loadImagePixels(source);
      // A newer scan or paste started while this one loaded; let it win.
      if (id !== loadId.current) return;
      setImage({
        pixels,
        sourceUrl: typeof source === "string" ? parseImageUrl(source) : null,
      });
      if (saved) setMinPercent(saved.minPercent);
      setPicked(saved?.picked ?? []);
      setHidden(saved?.hidden ?? []);
      setHighlightedKey(null);
      setStatus({ kind: "idle" });
    } catch (err) {
      if (id !== loadId.current) return;
      setStatus({
        kind: "error",
        error: err instanceof ImageLoadError ? err.kind : "load-failed",
        pasted,
      });
    }
  }, []);

  useEffect(() => {
    // Share links carry the image and markers in the query string, which is
    // only readable client-side in a static export.
    const saved = parsePaletteSearch(window.location.search);
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlInput(saved.img);
    load(saved.img, {
      minPercent: saved.minPercent,
      picked: saved.added,
      hidden: saved.hidden,
    });
  }, [load]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromClipboard(e.clipboardData);
      if (!file) return; // text pastes, like into the URL field, behave normally
      e.preventDefault();
      setUrlInput("");
      load(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [load]);

  // Analysis runs once per image; the slider only re-filters its result.
  const analysis = useMemo(() => (image ? analyzeImage(image.pixels) : null), [image]);
  const scanned = useMemo(
    () => (analysis ? extractPalette(analysis, { minShare: minPercent / 100 }) : []),
    [analysis, minPercent]
  );
  const markers = useMemo(
    () => (image ? buildMarkers(scanned, picked, hidden, image.pixels) : []),
    [image, scanned, picked, hidden]
  );

  // Recipes take tens of ms each, so they trail marker changes instead of
  // making the slider stutter.
  const recipeHexes = useDeferredValue(markers.map((m) => m.hex).join(","));
  const recipes = useMemo(() => {
    const byHex = new Map<string, Recipe | null>();
    for (const hex of recipeHexes ? recipeHexes.split(",") : []) {
      if (!byHex.has(hex)) {
        byHex.set(hex, computeRecipe(inStockColors, hex, { maxColors: MAX_RECIPE_COLORS }));
      }
    }
    return byHex;
  }, [recipeHexes, inStockColors]);

  const sharePath = image?.sourceUrl
    ? `/palette/${buildPaletteSearch({
        img: image.sourceUrl,
        minPercent,
        added: picked,
        hidden,
      })}`
    : null;
  const hasImage = image !== null;

  useEffect(() => {
    // Until an image loads, leave the URL alone: it may be a share link
    // whose image is still loading (or failed to).
    if (!hasImage) return;
    // Debounced: the slider fires continuously while dragging, and browsers
    // throttle rapid history updates.
    const timeout = setTimeout(() => {
      window.history.replaceState(null, "", sharePath ?? "/palette/");
    }, 300);
    return () => clearTimeout(timeout);
  }, [hasImage, sharePath]);

  const share = async () => {
    if (!sharePath) return;
    const url = new URL(sharePath, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Clay palette", url });
      } catch {
        // User dismissed the share sheet.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setShareStatus("copied");
    setTimeout(() => setShareStatus("idle"), 2000);
  };

  const addMarker = (x: number, y: number) =>
    setPicked((prev) =>
      prev.some((p) => p.x === x && p.y === y) ? prev : [...prev, { x, y }]
    );

  const removeMarker = (marker: Marker) => {
    if (marker.source === "pick") {
      setPicked((prev) => prev.filter((p) => p.x !== marker.x || p.y !== marker.y));
    } else {
      setHidden((prev) => [...prev, marker.hex.slice(1)]);
    }
    setHighlightedKey(null);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Image Palette</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pull the main colors out of an image and get a clay recipe for each.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(urlInput);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="text"
            inputMode="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            aria-label="Image URL"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <button
            type="submit"
            disabled={status.kind === "loading" || !urlInput.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {status.kind === "loading" ? "Scanning…" : "Scan"}
          </button>
        </form>
        <p
          className={`text-xs ${
            status.kind === "error" && status.error === "blocked"
              ? "font-medium text-neutral-900"
              : "text-neutral-500"
          }`}
        >
          …or paste an image anywhere on this page.
        </p>
        {status.kind === "error" && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(status.error, status.pasted)}
          </p>
        )}
      </div>

      {loaded && library.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
          <p className="text-sm text-neutral-700">
            Your library is empty, so there are no recipes yet. Add some clay colors first.
          </p>
          <Link
            href="/library"
            className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Go to Library
          </Link>
        </div>
      )}

      {image && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:sticky md:top-6 md:self-start">
            <ImageMarkerCanvas
              pixels={image.pixels}
              markers={markers}
              highlightedKey={highlightedKey}
              onHover={setHighlightedKey}
              onPick={addMarker}
            />
            <p className="mt-2 text-xs text-neutral-500">
              Click the image to add a marker. On a phone, press and hold.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-4">
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-neutral-700">
                Minimum share: {minPercent}%
                <input
                  type="range"
                  min={MIN_PERCENT}
                  max={MAX_PERCENT}
                  step={1}
                  value={minPercent}
                  onChange={(e) => setMinPercent(Number(e.target.value))}
                  className="accent-neutral-900"
                />
              </label>
              {sharePath && (
                <button
                  type="button"
                  onClick={share}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  {shareStatus === "copied" ? "Link copied" : "Share"}
                </button>
              )}
            </div>

            {scanned.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
                No single color covers {minPercent}% of this image — try lowering the slider.
              </p>
            )}

            <PaletteMarkerList
              markers={markers}
              recipes={loaded && library.length > 0 ? recipes : null}
              highlightedKey={highlightedKey}
              onHover={setHighlightedKey}
              onRemove={removeMarker}
            />
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: all pass. If ESLint flags `react-hooks/set-state-in-effect` on the `load(...)` call inside the first effect, put the same `// eslint-disable-next-line react-hooks/set-state-in-effect` comment on the line above it (the pattern `src/app/mix/page.tsx` uses).

- [ ] **Step 3: Verify in the browser**

With `mise run dev` running:
1. At `http://localhost:3000/palette/`, scan the reference URL, add a marker, remove scanned marker B, and set the slider to 4%. Within about 0.3 s the address bar reads `/palette/?img=…&min=4&add=<x>,<y>&hide=<hex>`.
2. Click **Share**. The link is copied ("Link copied") or the share sheet opens. Open that link in a new tab: the same image, slider, markers and letters appear.
3. Open `/palette/?img=https%3A%2F%2Fexample.com%2Fnothing.jpg`. The error shows and the address bar keeps its query.
4. Open `/palette/?img=<encoded reference url>&min=abc&add=junk;5,5&hide=zz`. The image loads at 3%, with one picked marker at (5, 5).
5. In another tab, right-click the cover image on Amazon → **Copy Image**, then press Cmd/Ctrl+V on the palette page (focus anywhere). The image loads, the URL field clears, the Share button is hidden, and the address bar becomes `/palette/`.
6. Copy some text and paste it into the URL field. It pastes as text; nothing loads.
7. Scan a blocked-host image. The error appears and the "…or paste an image" hint turns bold. Paste the copied image: it loads and the error clears.
8. Quickly scan URL A, then paste an image before A finishes loading. The pasted image wins and is not replaced when A arrives.

- [ ] **Step 4: Commit**

```bash
git add src/app/palette/page.tsx
git commit -m "Add share links and image pasting to the palette page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0141BBsvYYCfTv7vvNGngHuM"
```
