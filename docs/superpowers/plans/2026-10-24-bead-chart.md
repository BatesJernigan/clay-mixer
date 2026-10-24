# Bead Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/beads` page that turns an uploaded image into a bold, color-only pony bead chart with bead counts, using real Creatology pony bead colors.

**Architecture:** A pure, DOM-free module `src/lib/beadChart.ts` turns a `PixelGrid` into a `BeadChart` (grid of catalog-bead indices, -1 = empty) through fixed steps: reduce → background → pick colors → assign → clean up → outline → count. A bead catalog lives in `src/lib/ponyBeadColors.ts`. The page reuses `src/lib/imageSource.ts` for upload/paste/drop, shrinks the image once on load, and rebuilds the chart in a `useMemo` on every setting change. Rendering is an SVG component.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-bead-chart-design.md`

## Global Constraints

- Static export on Cloudflare Workers static assets: no server routes; everything runs in the browser. `/beads/` needs no rewrite in `next.config.ts` or `public/_redirects`.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing page code (`AGENTS.md`: this Next.js has breaking changes).
- Uploads over 5 MB are rejected before decoding: "That image is over 5 MB. Try a smaller one."
- Chart style is color only: no letters or symbols on beads.
- Every chart color is a catalog bead; the outline never adds a color beyond the chosen ones.
- Size presets set the long side: Small 15, Medium 25 (default), Large 40. Custom sides range 5–100, linked to the image's aspect ratio.
- "Match image" color count: 2 to `min(12, catalog size)`, default 6.
- Remove background and Outline toggles both default on.
- The page must not scroll sideways at phone width; zoom is the browser's own pinch-zoom.
- All pipeline tunables are named, exported constants at the top of `beadChart.ts`, as in `palette.ts`.
- Pipeline output is deterministic: same input, same chart.
- Match the existing code style (see `palette.ts`, `palette.test.ts`, `src/app/palette/page.tsx`): doc comments on exports, Tailwind neutral palette, `@/` imports.

## Review Focus

1. **Extreme aspect ratios** (a 10:1 panorama): the short side clamps to 5, never 0 or NaN. Test in Task 2.
2. **A plain, single-color image**: with removal on, every cell is background and the page shows "Couldn't find a subject in this image. Try turning off Remove background." instead of an empty chart; with removal off it's all beads. Test in Task 3.
3. **A busy photo whose border is many colors**: nothing is removed (the subject is not eaten), so the user still gets a chart. Test in Task 3.
4. **An image smaller than the grid** (a 3×3 icon at 15×15): every cell still gets a color; no empty or NaN cells from cells that cover no source pixel. Test in Task 3.
5. **Match count larger than the image's distinct colors, or than the catalog**: returns fewer colors, never duplicates, never throws. Test in Task 4.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/ponyBeadColors.ts` (new) | `BeadColor` type and the Creatology catalog |
| `src/lib/beadSize.ts` (new) | Size presets and aspect-linked sizing |
| `src/lib/beadChart.ts` (new) | The conversion pipeline |
| `src/lib/palette.ts` (modify) | Export `kMeans` and `medianCutSeeds` for reuse |
| `src/components/BeadChartView.tsx` (new) | SVG chart with rulers |
| `src/components/BeadCountList.tsx` (new) | "Beads needed" list |
| `src/app/beads/page.tsx` (new) | Page state, upload, settings, errors, print |
| `src/lib/imageSource.ts` (modify) | `MAX_UPLOAD_BYTES` |
| `src/components/NavBar.tsx` (modify) | "Beads" nav entry |

---

### Task 1: Pony bead catalog

**Files:**
- Create: `src/lib/ponyBeadColors.ts`
- Test: `src/lib/ponyBeadColors.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface BeadColor { name: string; hex: string; url?: string }
  export const PONY_BEAD_BRAND = "Creatology";
  export const ponyBeadColors: BeadColor[];
  /** Throws if the name isn't in the catalog. */
  export function beadByName(name: string): BeadColor;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
it("has unique names and valid lowercase hexes", () => {
  expect(new Set(ponyBeadColors.map((b) => b.name)).size).toBe(ponyBeadColors.length);
  for (const b of ponyBeadColors) expect(b.hex).toMatch(/^#[0-9a-f]{6}$/);
});
it("includes the beads the black/white presets need", () => {
  for (const n of ["Black", "White", "Gray"]) expect(beadByName(n).name).toBe(n);
});
it("throws for an unknown bead", () => {
  expect(() => beadByName("Chartreuse")).toThrow();
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ponyBeadColors.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Write the catalog.** Doc comment like `premoColors.ts`: Creatology Opaque Pony Beads 6×9 mm, Michaels' own brand; hexes are hand-picked approximations, not manufacturer values; source URL. Colors, in this order, from the Michaels color list:

| name | hex | url |
|---|---|---|
| Black | `#1a1a1a` | `https://www.michaels.com/product/opaque-pony-beads-by-creatology-6mm-x-9mm-10054267` |
| White | `#f5f5f2` | product page |
| Gray | `#8c8c8c` | `https://www.michaels.com/product/opaque-pony-beads-by-creatology-6mm-x-9mm-10647296` |
| Red | `#d0202e` | product page |
| Pink | `#f28bb5` | product page |
| Purple | `#6a2c91` | product page |
| Lavender | `#b49ad6` | product page |
| Orange | `#f07a1a` | product page |
| Yellow | `#f7d417` | product page |
| Kelly Green | `#1e9a3c` | product page |
| Royal Blue | `#2346b0` | product page |

"Product page" = `https://www.michaels.com/product/opaque-pony-beads-by-creatology-6mm-x-9mm-10054284`. Michaels returns 403 to scripted fetches, so don't block on verifying URLs.

- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add Creatology pony bead catalog"`

---

### Task 2: Chart sizing

**Files:**
- Create: `src/lib/beadSize.ts`
- Test: `src/lib/beadSize.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SizePreset = "small" | "medium" | "large";
  export const SIZE_PRESETS: Record<SizePreset, number>; // { small: 15, medium: 25, large: 40 }
  export const MIN_SIDE = 5;
  export const MAX_SIDE = 100;
  export interface ChartSize { width: number; height: number }
  /** Long side = `longSide`, short side by aspect ratio; both clamped to MIN_SIDE–MAX_SIDE. */
  export function sizeForLongSide(imageWidth: number, imageHeight: number, longSide: number): ChartSize;
  /** The user typed `value` into one field; the other follows the aspect ratio. Both clamped. */
  export function linkedSize(imageWidth: number, imageHeight: number, changed: "width" | "height", value: number): ChartSize;
  /** The preset whose size equals `size` for this image, or null (custom). */
  export function presetFor(imageWidth: number, imageHeight: number, size: ChartSize): SizePreset | null;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
expect(sizeForLongSide(800, 600, 25)).toEqual({ width: 25, height: 19 });
expect(sizeForLongSide(600, 800, 40)).toEqual({ width: 30, height: 40 });
expect(sizeForLongSide(1000, 100, 15)).toEqual({ width: 15, height: 5 }); // clamped, Review Focus 1
expect(linkedSize(800, 600, "width", 40)).toEqual({ width: 40, height: 30 });
expect(linkedSize(800, 600, "height", 200)).toEqual({ width: 100, height: 75 }); // clamped, ratio kept
expect(linkedSize(800, 600, "width", 0)).toEqual({ width: 7, height: 5 }); // short side floored at 5
expect(presetFor(800, 600, { width: 25, height: 19 })).toBe("medium");
expect(presetFor(800, 600, { width: 26, height: 20 })).toBeNull();
```

- [ ] **Step 2: Run** `npx vitest run src/lib/beadSize.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Round to nearest integer. When clamping one side forces the other out of range, clamp that side and recompute the first from the ratio, then clamp again (so the ratio holds as closely as the bounds allow). Non-finite or <1 input values are treated as `MIN_SIDE`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add bead chart sizing"`

---

### Task 3: Pipeline: reduce, background, black/white modes, counts

**Files:**
- Create: `src/lib/beadChart.ts`
- Test: `src/lib/beadChart.test.ts` (copy the `grid()` helper from `palette.test.ts`)

**Interfaces:**
- Consumes: `PixelGrid`, `MIN_ALPHA` from `palette.ts`; `rgbToLab`, `deltaE` from `color.ts`; `BeadColor`, `ponyBeadColors`, `beadByName` from Task 1.
- Produces:
  ```ts
  export type ColorMode = { mode: "bw" } | { mode: "bgw" } | { mode: "match"; count: number };
  export interface BeadChartOptions {
    width: number; height: number;
    colors: ColorMode;
    removeBackground: boolean;
    outline: boolean;
  }
  export interface BeadChart {
    width: number; height: number;
    /** Row-major: index into `palette`, or -1 for empty. */
    cells: Int16Array;
    /** Only beads actually used, in catalog order. */
    palette: BeadColor[];
    counts: number[]; // parallel to palette
  }
  export const BEAD_SOURCE_MAX_SIDE = 400;
  export const BACKGROUND_DELTA_E = 18;
  export const BORDER_AGREEMENT = 0.5;
  /** Area-average shrink, run once per image before building charts. Never enlarges. */
  export function shrinkImage(pixels: PixelGrid, maxSide: number): PixelGrid;
  export function buildBeadChart(pixels: PixelGrid, opts: BeadChartOptions): BeadChart;
  ```

Pipeline behavior pinned for this task:

1. **Reduce.** Each cell covers the source rectangle `[x·W/w, (x+1)·W/w) × …`. Its color is the mean RGB of the opaque pixels (alpha ≥ `MIN_ALPHA`) in it. A cell is *transparent* if under half its pixels are opaque. A cell covering no whole source pixel (image smaller than grid) samples the source pixel at its center.
2. **Background** (only when `removeBackground`). Take the opaque cells on the grid's edge; reference = their per-channel median Lab. If fewer than `BORDER_AGREEMENT` of them are within `BACKGROUND_DELTA_E` of the reference, the border is busy: nothing is background. Otherwise flood-fill (4-connected) from those agreeing edge cells through cells within `BACKGROUND_DELTA_E` of the reference; filled cells are background. Transparent cells are always empty.
3. **bw / bgw.** 1-D k-means on the subject cells' L (k = 2 or 3, seeds at evenly spaced quantiles, deterministic). Clusters darkest→lightest map to Black, White (bw) or Black, Gray, White (bgw). Single-shade rule: if the subject's L range is under 10, k-means is meaningless, so each cell instead takes the preset bead nearest in L (red L≈46 → Black; yellow L≈86 → White).
4. **Count** and build `palette`/`counts` for beads with count > 0, catalog order.

Match mode, cleanup and outline come in Tasks 4–5; until then `match` may throw "not implemented" and `outline` is ignored.

- [ ] **Step 1: Write the failing tests**
  - `shrinkImage`: a 800×400 half-red/half-blue image → 400×200, left pixel `#ff0000`, right `#0000ff`; a 100×50 image is returned unchanged in size.
  - Red 10×10 square centered on a 30×30 white image, 15×15 grid, `bw`, removal on: edge cells are -1, center cell is Black (red is darker than white), every non-empty cell is Black.
  - Same with removal off: no -1 cells; the white border is White.
  - Transparent pixels (`CLEAR`) around an opaque square → those cells are -1, even with removal off.
  - `bgw` on three horizontal bands black/gray(128)/white with removal off → palette names `["Black", "White", "Gray"]` (catalog order); top band Black, middle Gray, bottom White.
  - `bw` on a solid yellow square on white, removal on → the subject is White (single-shade rule: yellow is light).
  - Solid gray image, removal on → `counts` empty, every cell -1; removal off → all cells one bead (Review Focus 2).
  - Busy border: 30×30 image at 15×15 whose outer 2-pixel ring is 2×2 blocks cycling red/green/blue/yellow, white inside with a black square in the middle, removal on → no -1 cells (Review Focus 3).
  - 3×3 source image (checkerboard black/white) at 15×15, removal off → no -1 cells (Review Focus 4).
  - `counts` sum equals the number of non-empty cells; `buildBeadChart` called twice on the same input gives equal `cells`.
- [ ] **Step 2: Run** `npx vitest run src/lib/beadChart.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the pieces above in `beadChart.ts`.
- [ ] **Step 4: Run** the tests. Expected: PASS. Also `npm test` (all green).
- [ ] **Step 5: Commit** `git commit -m "Add bead chart pipeline with background removal"`

---

### Task 4: Match-image color mode

**Files:**
- Modify: `src/lib/palette.ts` (export `kMeans`, `medianCutSeeds`; no behavior change)
- Modify: `src/lib/beadChart.ts`
- Test: `src/lib/beadChart.test.ts`

**Interfaces:**
- Consumes: `medianCutSeeds(points: Lab[], k: number): Lab[]`, `kMeans(points: Lab[], seeds: Lab[]): { centroids: Lab[]; assignment: Int32Array }` from `palette.ts`.
- Produces: `export const MATCH_MAX_COLORS = Math.min(12, ponyBeadColors.length);` and `match` mode in `buildBeadChart`.

Behavior: k-means in Lab on subject cells with k = `count` (clamped to 1…`MATCH_MAX_COLORS`). Visit clusters largest first; each snaps to its nearest catalog bead (`deltaE`). If that bead is already taken, the cluster merges into it (so fewer colors may come back). Then every subject cell takes its nearest *chosen* bead.

- [ ] **Step 1: Write the failing tests**
  - Four solid quadrants red/yellow/royal-blue/kelly-green (exact catalog hexes), removal off, `count: 4` → palette names are exactly those four.
  - Same image, `count: 2` → palette length ≤ 2, every name in `ponyBeadColors`.
  - Two-color image, `count: 6` → palette length 2 (Review Focus 5).
  - Any image, `count: 50` → no throw, palette length ≤ `MATCH_MAX_COLORS`, names unique (Review Focus 5).
  - `palette.test.ts` still passes unchanged.
- [ ] **Step 2: Run** the tests. Expected: new ones FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add match-image color mode to bead chart"`

---

### Task 5: Speck cleanup and outline

**Files:**
- Modify: `src/lib/beadChart.ts`
- Test: `src/lib/beadChart.test.ts`

**Interfaces:**
- Produces: `export const CLEANUP_PASSES = 2;` `export const SPECK_DELTA_E = 45;`

Behavior (runs after assign, before count):

- **Cleanup**, `CLEANUP_PASSES` passes over subject cells: a cell takes the most common bead among its non-empty 3×3 neighbors (keeping its own on a tie, like `majorityFilter` in `palette.ts`), **but only if** `deltaE(own bead, majority bead) < SPECK_DELTA_E`. Close shades get absorbed; high-contrast single cells (an eye) survive. With the catalog hexes: Orange→Red (41) absorbs, Black on White (87) stays.
- **Outline**, when `outline && removeBackground`: every subject cell 4-adjacent to a background cell becomes the darkest (lowest L) bead in the chosen palette. Cells next to transparent cells count too. Grid edges don't.

- [ ] **Step 1: Write the failing tests** (match mode, removal off unless stated)
  - 15×15 red image with one cell-sized orange block in the middle, `count: 2` → no Orange in the palette.
  - 15×15 white image with one cell-sized black block in the middle, `count: 2` → the center cell is Black.
  - Yellow square with a royal-blue patch in its center, on white, removal on, `count: 2`: outline on → every subject cell touching a -1 cell is Royal Blue (the darkest chosen bead); outline off → those cells are Yellow.
  - Outline on but removal off → output equals outline off.
  - Outline never grows `palette` beyond `count`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Add speck cleanup and outline to bead chart"`

---

### Task 6: Chart and count components

**Files:**
- Create: `src/components/BeadChartView.tsx`, `src/components/BeadCountList.tsx`

**Interfaces:**
- Consumes: `BeadChart` from Task 3.
- Produces: `export function BeadChartView({ chart }: { chart: BeadChart })` and `export function BeadCountList({ chart }: { chart: BeadChart })`.

- [ ] **Step 1: Implement `BeadChartView`** as one `<svg>` with a `viewBox` in cell units (plus a margin for rulers), `width="100%"`, no fixed pixel width, so it fits any screen. Each bead: `<circle r={0.42}>` filled with its hex and a thin darker stroke so White shows on white paper. Empty cells: `<circle r={0.42}>` with no fill and a faint dashed `neutral-300` stroke. Rulers: numbers 5, 10, 15… (1-based) above the top row and left of the first column, small `neutral-400` text. `role="img"` with an `aria-label` like "Bead chart, 25 by 19".
- [ ] **Step 2: Implement `BeadCountList`**: a heading "Beads needed", one row per bead sorted by count descending (swatch circle, name, count right-aligned), then a "Total" row. Use the same row styling as `PaletteMarkerList`.
- [ ] **Step 3: Verify** `npx tsc --noEmit` and `npm run lint` pass.
- [ ] **Step 4: Commit** `git commit -m "Add bead chart and bead count components"`

---

### Task 7: `/beads` page

**Files:**
- Create: `src/app/beads/page.tsx`
- Modify: `src/lib/imageSource.ts` (add `export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;`)
- Modify: `src/components/NavBar.tsx` (add `{ href: "/beads", label: "Beads" }` after Palette)

**Interfaces:**
- Consumes: everything above; `imageFromFiles`, `imageFromClipboard`, `loadImagePixels`, `ImageLoadError` from `imageSource.ts`.

- [ ] **Step 1: Read** the Next.js docs in `node_modules/next/dist/docs/` for client pages, then model loading, paste and drop handling on `src/app/palette/page.tsx` (including the `loadId` guard against out-of-order loads and resetting the file input's value).
- [ ] **Step 2: Implement the page.**
  - State: shrunk image (`shrinkImage(pixels, BEAD_SOURCE_MAX_SIDE)` once per load), `size: ChartSize`, color mode (`"bw" | "bgw" | "match"`), `matchCount` (default 6), `removeBackground` (true), `outline` (true), load status.
  - On load: size = `sizeForLongSide(…, SIZE_PRESETS.medium)`.
  - Files over `MAX_UPLOAD_BYTES` → "That image is over 5 MB. Try a smaller one." without decoding. Decode failure → "Couldn't read that image." A chart with no beads → "Couldn't find a subject in this image. Try turning off Remove background." All inline `role="alert"` in the palette page's red style.
  - Settings: Small/Medium/Large buttons (selected one highlighted via `presetFor`); number inputs width × height using `linkedSize`; color buttons "Black / white", "Black / grey / white", "Match image" with a 2–`MATCH_MAX_COLORS` number stepper shown only for Match; checkboxes "Remove background" and "Outline" (Outline disabled while removal is off).
  - Chart: `useMemo(() => buildBeadChart(...))`, fed through `useDeferredValue` so typing in size fields stays responsive.
  - Layout: stacked on mobile; on `md:` upload+settings left, chart+counts right. Thumbnail of the uploaded image (draw the shrunk `PixelGrid` to a small canvas).
  - Print button → `window.print()`. Everything except the chart and `BeadCountList` gets Tailwind `print:hidden` (including `NavBar`'s header); the chart fits one page.
- [ ] **Step 3: Verify** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- [ ] **Step 4: Manual check** with `npm run dev` at desktop and 375px width:
  - Pet/person photo on a plain background → background empty, outline around the subject.
  - Busy-background photo → a chart still appears; toggling removal off fills every cell.
  - Simple logo, and a transparent PNG (transparent area empty).
  - A >5 MB file → the size message.
  - Presets, custom sizes, all three color modes and both toggles update the chart live.
  - No sideways page scroll at 375px with a 100×100 chart; Print preview shows only chart + counts.
- [ ] **Step 5: Commit** `git commit -m "Add bead chart page"`

---

## Notes for the executor

- The catalog has 11 colors, so "Match image" tops out at 11, not the spec's 12. There's no brown, tan or skin-tone bead in the Creatology opaque line; skin tones will snap to Pink/Orange/White. Mention this to the user at the end; adding another bead line is a follow-up, not part of this plan.
